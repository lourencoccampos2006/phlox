// app/api/recall-watch/route.ts
// Vigia de Recalls — cruza a medicação do utilizador (ou de um familiar) com
// os alertas de qualidade/segurança do INFARMED já ingeridos (ver
// lib/recallIngest.ts + /api/cron/ingest-recalls). Matching por SUBSTRING no
// título da notícia (não há campos estruturados de nome de fármaco fiáveis
// em todas as notícias) — por isso é sempre "menciona", nunca "confirma
// lote", e liga sempre à notícia oficial para o utilizador confirmar.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { normalizeDrugName } from '@/lib/shortageIngest'
import { sb } from '@/lib/orgAuth'

interface RecallMatch { medication: string; url: string; title: string; notice_date: string | null }

const WINDOW_DAYS = 545 // ~18 meses — recalls mais antigos perdem relevância prática

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Vigia de Recalls')
  const supabase = sb(req)

  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (profileId) {
    const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
    if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  /* `?ambito=utentes` lê a medicação da casa em vez da de quem tem a sessão
     aberta. Mesma razão que na /api/shortage-watch: numa casa, quem abre isto
     quer saber se alguma recolha de lote toca a medicação dos UTENTES. */
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

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const [{ data: meds }, { data: notices }] = await Promise.all([
    ambito === 'utentes'
      ? supabase.from('patient_meds').select('name, patient_id, patients!inner(name)').eq('active', true)
      : profileId
        ? supabase.from('family_profile_meds').select('name').eq('profile_id', profileId)
        : supabase.from('personal_meds').select('name').eq('user_id', userId),
    supabase.from('infarmed_recall_notices').select('url, title, notice_date, first_seen_at').gte('first_seen_at', since).order('first_seen_at', { ascending: false }),
  ])

  const noticeList = (notices || []) as { url: string; title: string; notice_date: string | null }[]
  const matches: RecallMatch[] = []
  for (const m of (meds || []) as { name: string }[]) {
    const norm = normalizeDrugName(m.name)
    if (norm.length < 4) continue
    for (const n of noticeList) {
      if (normalizeDrugName(n.title).includes(norm)) {
        matches.push({ medication: m.name, url: n.url, title: n.title, notice_date: n.notice_date })
      }
    }
  }

  return NextResponse.json({ matches, checked_medications: (meds || []).length, notices_available: noticeList.length })
}
