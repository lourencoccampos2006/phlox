// app/api/farmacia-publica/route.ts
// ───────────────────────────────────────────────────────────────────────────
// O QUE A FARMÁCIA VÊ, PELO ENDEREÇO SECRETO
//
// A farmácia não tem conta. Tem um endereço com 64 caracteres de acaso, que a
// casa lhe deu para UM utente, e que a casa revoga quando quiser.
//
// ── O QUE SAI, E O QUE NÃO SAI ─────────────────────────────────────────────
// Sai: o nome e a data de nascimento (para a farmácia saber de quem é a
// caixa), as alergias, a medicação ATIVA e as alterações dos últimos 60 dias
// — estas já em frases («dose: 1 → ½»), nunca a linha inteira da base de
// dados. A `antes` e a `depois` do histórico trazem a linha toda (notas
// internas, a indicação, o `org_id`); mandá-las para fora era mandar muito
// mais do que a farmácia precisa.
//
// Não sai: diagnósticos, condições, contactos, nada do processo individual.
//
// ── PORQUE É QUE ISTO USA A CHAVE DE SERVIÇO ───────────────────────────────
// Do outro lado não há sessão nenhuma, e a RLS é por casa. A chave só lê o que
// está acima, e só depois de o endereço corresponder a uma partilha não
// revogada.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { oQueMudou, quemIndicou, CAMPOS_PARA_A_FARMACIA, type Alteracao } from '@/lib/mapaTerapeutico'

export const runtime = 'nodejs'

function servico() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })
}

const CABECALHOS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const NAO_HA = () => NextResponse.json(
  { error: 'Esta ligação não existe ou foi revogada pela instituição.' },
  { status: 404, headers: CABECALHOS })

/** Só hexadecimal, 64 caracteres. Qualquer outra coisa nem chega à base de dados. */
const limpo = (t: string) => (/^[0-9a-f]{64}$/.test(t) ? t : null)

/**
 * A partilha deste endereço — mas SÓ se o utente for mesmo da casa que a criou.
 *
 * A base de dados já o garante (política de criação e gatilho no sprint189).
 * Isto volta a verificar porque esta rota corre com a chave de serviço e
 * serve dados de saúde a quem não tem sessão: se alguma vez uma linha
 * inconsistente lá chegar — por uma migração antiga, por uma escrita com a
 * chave de serviço — a última porta não pode ser a que a deixa sair.
 */
async function partilhaDe(sb: any, token: string) {
  const { data, error } = await sb.from('partilhas_farmacia')
    .select('id, org_id, user_id, patient_id, farmacia_nome, criada_em, visitas')
    .eq('token', token).is('revogada_em', null).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: dono, error: e2 } = await sb.from('patients')
    .select('org_id, user_id').eq('id', data.patient_id).maybeSingle()
  if (e2) throw e2
  const daMesmaCasa = !!dono && (data.org_id
    ? dono.org_id === data.org_id
    : !dono.org_id && dono.user_id === data.user_id)
  if (!daMesmaCasa) {
    console.error('[phlox:farmacia-publica] partilha com utente de outra casa — recusada', data.id)
    return null
  }
  return data as { id: string; org_id: string | null; user_id: string | null; patient_id: string; farmacia_nome: string; criada_em: string; visitas: number }
}

export async function GET(req: NextRequest) {
  /* Apertado: 64 caracteres hexadecimais não se adivinham, mas um tecto torna
     a tentativa cega inútil de vez e não incomoda ninguém. */
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const token = limpo(req.nextUrl.searchParams.get('t') || '')
  if (!token) return NAO_HA()
  const sb = servico()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503, headers: CABECALHOS })

  try {
    const p = await partilhaDe(sb, token)
    if (!p) return NAO_HA()

    const desde = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const [utente, casa, meds, alteracoes] = await Promise.all([
      sb.from('patients').select('name, date_of_birth, allergies').eq('id', p.patient_id).maybeSingle(),
      p.org_id
        ? sb.from('organizations').select('name').eq('id', p.org_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      sb.from('patient_meds').select(CAMPOS_PARA_A_FARMACIA)
        .eq('patient_id', p.patient_id).or('active.is.null,active.eq.true').order('name'),
      sb.from('medicacao_alteracoes')
        .select('id, created_at, tipo, med_nome, antes, depois, indicacao_de, indicacao_tipo, vista_farmacia_em')
        .eq('patient_id', p.patient_id).gte('created_at', desde)
        .order('created_at', { ascending: false }).limit(100),
    ])
    for (const r of [utente, casa, meds, alteracoes]) if (r.error) throw r.error
    if (!utente.data) return NAO_HA()

    /* A visita regista-se depois de tudo ler bem: uma visita que falhou não
       é uma visita, e a casa usa este número para saber que a farmácia viu. */
    const { error: eVisita } = await sb.from('partilhas_farmacia')
      .update({ ultima_visita_em: new Date().toISOString(), visitas: (p.visitas || 0) + 1 })
      .eq('id', p.id)
    if (eVisita) console.error('[phlox:farmacia-publica:visita]', eVisita)

    return NextResponse.json({
      farmacia: p.farmacia_nome,
      casa: (casa.data as any)?.name || null,
      utente: {
        nome: (utente.data as any).name,
        nascimento: (utente.data as any).date_of_birth || null,
        alergias: (utente.data as any).allergies || null,
      },
      medicacao: meds.data || [],
      alteracoes: ((alteracoes.data || []) as Alteracao[]).map(a => ({
        id: a.id, quando: a.created_at, tipo: a.tipo, medicamento: a.med_nome,
        oQueMudou: oQueMudou(a), indicacao: quemIndicou(a), vista: a.vista_farmacia_em,
      })),
    }, { headers: CABECALHOS })
  } catch (e) {
    console.error('[phlox:farmacia-publica]', e)
    return NextResponse.json({ error: 'Não foi possível ler o mapa agora.' }, { status: 500, headers: CABECALHOS })
  }
}

/** «Recebido»: marca como vistas todas as alterações ainda por ver. */
export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const corpo = await req.json().catch(() => ({}))
  const token = limpo(String(corpo?.t || ''))
  if (!token) return NAO_HA()
  const sb = servico()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503, headers: CABECALHOS })
  try {
    const p = await partilhaDe(sb, token)
    if (!p) return NAO_HA()
    const { data, error } = await sb.from('medicacao_alteracoes')
      .update({ vista_farmacia_em: new Date().toISOString() })
      .eq('patient_id', p.patient_id).is('vista_farmacia_em', null)
      .select('id')
    if (error) throw error
    return NextResponse.json({ marcadas: (data || []).length }, { headers: CABECALHOS })
  } catch (e) {
    console.error('[phlox:farmacia-publica:recebido]', e)
    return NextResponse.json({ error: 'Não foi possível marcar como recebido.' }, { status: 500, headers: CABECALHOS })
  }
}
