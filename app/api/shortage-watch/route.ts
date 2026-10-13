// app/api/shortage-watch/route.ts
// Vigia de Ruturas — cruza a medicação real do utilizador (ou de um familiar)
// com a Lista de Notificação Prévia do INFARMED já ingerida (ver
// lib/shortageIngest.ts + /api/cron/ingest-shortages). Matching CONSERVADOR:
// nome exato normalizado = confirmado; correspondência parcial = sinalizado
// como "parece corresponder", nunca apresentado como certeza.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { normalizeDrugName } from '@/lib/shortageIngest'
import { makeSupabase, getToken } from '@/lib/orgAuth'

interface MatchResult {
  medication: string
  match: 'exato' | 'parcial' | null
  matched_name: string | null
  source_document: string | null
  /** Quem a toma. Só no âmbito «utentes» — uma rutura sem dono não serve. */
  quem?: string | null
  patient_id?: string | null
}

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Vigia de Ruturas')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const profileId = req.nextUrl.searchParams.get('profile_id')

  // Confirma que o perfil pertence mesmo a este utilizador ANTES de ler a
  // medicação dele — o RLS de family_profile_meds (auth.uid() = user_id) já
  // bloqueava um profile_id alheio na prática, mas não depender só disso
  // (defesa em profundidade) e devolver um 404 claro em vez de um resultado
  // vazio sem explicação, tal como /api/risk-index e /api/crisis-playbook já
  // fazem.
  if (profileId) {
    const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  /* ── DE QUEM É A MEDICAÇÃO QUE SE CRUZA ──────────────────────────────────
     Numa casa, a resposta é «dos utentes». Era `personal_meds` — a medicação
     de quem tem a sessão aberta — e isso, numa conta de um lar, é
     precisamente a lista que não interessa: o enfermeiro não precisa de saber
     que o próprio Ozempic está em rutura; precisa de saber qual dos dezoito
     utentes vai ficar sem o dele.

     `?ambito=utentes` lê a `patient_meds` da casa e traz o nome de cada
     pessoa junto com o medicamento, para a rutura ter dono. Sem esse
     parâmetro, continua a servir o modo pessoal, que é o que a mesma página
     faz para quem não está numa instituição. */
  const ambito = req.nextUrl.searchParams.get('ambito')

  /* ── PORQUE É QUE ISTO NÃO LÊ OS UTENTES DE OUTRA CASA ───────────────────
     O `makeSupabase(token)` é um cliente DO UTILIZADOR: chave anónima mais o
     JWT de quem pede. O RLS aplica-se, e a `patient_meds` tem a política
     `patient_meds_org_access` (sprint91):

         org_id in (select org_id from org_members
                    where user_id = auth.uid() and active = true)

     A base de dados é que decide, e decide por organização. O mesmo vale para
     a `patients` embutida — o PostgREST aplica o RLS às tabelas embutidas.

     O que a confirmação abaixo acrescenta não é segurança: é HONESTIDADE.
     Sem organização, o RLS devolveria uma lista vazia — e uma lista vazia,
     nesta página, lê-se como «não há ruturas». É precisamente o modo de falhar
     que esta aplicação já teve demasiadas vezes. Um 403 diz o que se passa. */
  if (ambito === 'utentes') {
    const { data: pertenca, error: erroPertenca } = await supabase
      .from('org_members').select('org_id').eq('user_id', userId).eq('active', true).limit(1).maybeSingle()
    /* Se a LEITURA falhar, isso não é «não pertence a nenhuma casa» — é «não
       sei». Tratar as duas como a mesma coisa mandaria alguém com casa embora
       com uma frase que diz o contrário do que se passa. */
    if (erroPertenca) {
      console.error('[phlox:ambito-utentes]', erroPertenca)
      return NextResponse.json({ error: 'Não foi possível confirmar a sua instituição.' }, { status: 503 })
    }
    if (!pertenca?.org_id) {
      return NextResponse.json(
        { error: 'Esta verificação é da medicação de uma casa, e esta conta não pertence a nenhuma.' },
        { status: 403 })
    }
  }

  const leitura = ambito === 'utentes'
    ? supabase.from('patient_meds')
        .select('name, patient_id, patients!inner(name, active)')
        .eq('active', true)
    : profileId
      ? supabase.from('family_profile_meds').select('name').eq('profile_id', profileId)
      : supabase.from('personal_meds').select('name').eq('user_id', userId)

  const [{ data: meds }, { data: shortageList }, { data: sync }] = await Promise.all([
    leitura,
    supabase.from('infarmed_shortage_list').select('medicine_name, source_document'),
    supabase.from('infarmed_shortage_sync').select('*').eq('id', 1).maybeSingle(),
  ])

  const list = (shortageList || []) as { medicine_name: string; source_document: string }[]
  const byExact = new Map(list.map(l => [normalizeDrugName(l.medicine_name), l]))

  const results: MatchResult[] = (meds || []).map((m: any) => {
    const quem = m.patients?.name ?? null
    const patient_id = m.patient_id ?? null
    const norm = normalizeDrugName(m.name)
    const exact = byExact.get(norm)
    if (exact) return { medication: m.name, quem, patient_id, match: 'exato', matched_name: exact.medicine_name, source_document: exact.source_document }

    // Correspondência parcial: o nome do medicamento do utilizador contém, ou
    // está contido, no nome da lista (cobre "Ozempic 1mg" vs "Ozempic").
    const partial = list.find(l => {
      const ln = normalizeDrugName(l.medicine_name)
      return norm.length > 3 && ln.length > 3 && (norm.includes(ln) || ln.includes(norm))
    })
    if (partial) return { medication: m.name, quem, patient_id, match: 'parcial', matched_name: partial.medicine_name, source_document: partial.source_document }

    return { medication: m.name, quem, patient_id, match: null, matched_name: null, source_document: null }
  })

  return NextResponse.json({
    results,
    list_status: sync || null,
    list_empty: list.length === 0,
  })
}
