// app/api/farmacia/avisar/route.ts
// ───────────────────────────────────────────────────────────────────────────
// AVISAR A FARMÁCIA DE QUE A MEDICAÇÃO MUDOU
//
// Chamado pela ficha depois de cada alteração (ver `depoisDeMudarMedicacao`).
// Se o utente tiver o mapa partilhado com uma farmácia que deu email, manda-lhe
// UM email — no máximo um a cada 30 minutos, para uma manhã de acertos não
// virar dez emails.
//
// ── O EMAIL NÃO DIZ DE QUEM É ──────────────────────────────────────────────
// Diz que há alterações ao mapa de um utente da casa, e traz o endereço. Um
// email pode ir parar ao sítio errado; o nome e a medicação de alguém, não.
//
// Lê com o token de quem pediu: a RLS garante que só quem pode ver a
// medicação daquela pessoa consegue mandar avisar a farmácia dela.
import { NextRequest, NextResponse } from 'next/server'
import { authedClient } from '@/lib/orgAuth'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sendEmail, emailLayout, urlAbsoluto } from '@/lib/email'

export const runtime = 'nodejs'

const INTERVALO = 30 * 60_000

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  if (!req.headers.get('authorization')) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const sb = authedClient(req)
  const { data: auth, error: erroAuth } = await sb.auth.getUser()
  if (erroAuth || !auth?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const corpo = await req.json().catch(() => ({}))
  const pid = String(corpo?.patient_id || '')
  if (!/^[0-9a-f-]{36}$/i.test(pid)) return NextResponse.json({ error: 'Falta o utente.' }, { status: 400 })

  const { data: p, error } = await sb.from('partilhas_farmacia')
    .select('id, org_id, token, farmacia_email, ultimo_aviso_em')
    .eq('patient_id', pid).is('revogada_em', null)
    .order('criada_em', { ascending: false }).limit(1).maybeSingle()
  if (error) {
    // Sem o sprint189 a tabela não existe: não há farmácia a avisar.
    console.error('[phlox:farmacia-avisar]', error)
    return NextResponse.json({ enviado: false })
  }
  if (!p || !p.farmacia_email) return NextResponse.json({ enviado: false })
  if (p.ultimo_aviso_em && Date.now() - new Date(p.ultimo_aviso_em).getTime() < INTERVALO) {
    return NextResponse.json({ enviado: false, motivo: 'avisada há pouco' })
  }

  let nomeCasa = 'a instituição'
  if (p.org_id) {
    const { data: org, error: eOrg } = await sb.from('organizations').select('name').eq('id', p.org_id).maybeSingle()
    if (eOrg) console.error('[phlox:farmacia-avisar:casa]', eOrg)
    if (org?.name) nomeCasa = org.name
  }

  const r = await sendEmail({
    to: p.farmacia_email,
    subject: `Alterações à medicação — ${nomeCasa}`,
    html: emailLayout({
      preheader: 'Há alterações ao mapa terapêutico de um utente.',
      heading: 'Há alterações à medicação',
      body: `<p>${nomeCasa} registou alterações ao mapa terapêutico de um utente cuja medicação a farmácia prepara.</p>`
        + '<p>Abra a ligação para ver o que mudou e marcar como recebido.</p>',
      cta: { label: 'Ver o mapa', url: urlAbsoluto(`/farmacia/${p.token}`) },
      footnote: 'Recebe este email porque a instituição partilhou o mapa de um utente com esta farmácia. Por segurança, o email não identifica a pessoa.',
    }),
  })
  if (!r.ok) {
    console.error('[phlox:farmacia-avisar:email]', r.error)
    return NextResponse.json({ enviado: false })
  }

  const { error: eAviso } = await sb.from('partilhas_farmacia')
    .update({ ultimo_aviso_em: new Date().toISOString() }).eq('id', p.id)
  if (eAviso) console.error('[phlox:farmacia-avisar:marca]', eAviso)
  return NextResponse.json({ enviado: true })
}
