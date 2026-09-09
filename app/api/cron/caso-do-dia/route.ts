// app/api/cron/caso-do-dia/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// O caso clínico do dia, por email, para quem estuda.
//
// É o hábito diário que traz alguém de volta — custa quase nada e é a
// diferença entre uma app que se abre quando alguém se lembra e uma que faz
// parte da manhã. Um caso curto, a pergunta, e o link para o resolver no
// produto (a resposta NÃO vai no email, senão não se abre a aplicação).
//
// Só a quem aceitou: `profiles.daily_case_email`. Sem isso, ninguém recebe.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, emailLayout } from '@/lib/email'
import { aiJSON } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 120

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function autorizado(req: NextRequest): boolean {
  const s = process.env.CRON_SECRET
  if (!s) return false
  return req.headers.get('authorization') === `Bearer ${s}`
    || req.headers.get('x-cron-secret') === s
    || req.nextUrl.searchParams.get('secret') === s
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ error: 'Sem chave de serviço.' }, { status: 503 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave)

  const { data: inscritos } = await sb.from('profiles')
    .select('id, email, blocked').eq('daily_case_email', true).limit(2000)
  const destinos = (inscritos || []).filter((p: any) => p.email && !p.blocked)
  if (!destinos.length) return NextResponse.json({ enviados: 0, motivo: 'ninguém inscrito' })

  // Um caso por dia, igual para toda a gente: é assim que se pode falar dele.
  let caso: { titulo: string; vinheta: string; pergunta: string; area: string }
  try {
    caso = await aiJSON<typeof caso>([
      { role: 'system', content: `Escreves um caso clínico curto por dia para estudantes de saúde em Portugal.
Regras: caso REALISTA e concreto (idade, sexo, queixa, achados relevantes), 4 a 6 linhas.
A pergunta é de raciocínio, não de memorização. NÃO dês a resposta.
Português de Portugal, sem anglicismos.
Responde só JSON: {"titulo":"...","area":"Cardiologia|Infecciologia|...","vinheta":"...","pergunta":"..."}` },
      { role: 'user', content: `Escreve o caso de hoje (${new Date().toISOString().slice(0, 10)}). Varia a área em relação ao habitual.` },
    ], { maxTokens: 700, temperature: 0.9 })
  } catch {
    return NextResponse.json({ enviados: 0, erro: 'IA indisponível' }, { status: 503 })
  }
  if (!caso?.vinheta || !caso?.pergunta) return NextResponse.json({ enviados: 0, erro: 'caso vazio' }, { status: 502 })

  const html = emailLayout({
    preheader: `${esc(caso.area)} — ${esc(caso.titulo)}`,
    heading: esc(caso.titulo),
    body: `<p style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#71717a;margin:0 0 10px">${esc(caso.area)}</p>
           <p>${esc(caso.vinheta)}</p>
           <p style="margin-top:16px"><strong>${esc(caso.pergunta)}</strong></p>
           <p style="font-size:13px;color:#71717a">A resposta não vem no email de propósito — pensa nela primeiro.</p>`,
    cta: { label: 'Resolver no Phlox', url: 'https://phloxclinical.com/decisao' },
    footnote: 'Recebes isto porque ativaste o caso do dia. Podes desligá-lo nas definições.',
  })

  let enviados = 0
  for (const p of destinos) {
    try { await sendEmail({ to: p.email, subject: `Caso do dia — ${caso.titulo}`, html }); enviados++ } catch {}
  }
  return NextResponse.json({ enviados, caso: caso.titulo })
}
