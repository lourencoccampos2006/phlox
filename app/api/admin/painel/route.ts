// app/api/admin/painel/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os dados do painel pessoal do Fernando (/admin).
//
// ── PORQUE E QUE ISTO SAIU DO BROWSER ──────────────────────────────────────
// O /admin lia `profiles`, `search_history` e `analytics_events` DIRETAMENTE do
// browser, com a sessao de quem estava a ver. Isso obriga essas tabelas a
// estarem abertas a leitura por utilizadores autenticados — e foi por isso que
// a tabela `profiles`, com o email de toda a gente, respondia a quem nem sessao
// tinha.
//
// Com a leitura do lado do servidor, o `profiles` pode fechar-se: quem precisa
// destes dados e uma rota que confirma a identidade primeiro.
//
// ── QUEM PODE ──────────────────────────────────────────────────────────────
// So o dono do produto. A lista de emails vive aqui, no servidor, e nao numa
// constante do lado do cliente que qualquer pessoa le no codigo da pagina.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const DONOS = ['lourencoccampos2006@gmail.com']

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: auth, error: erroSessao } = await a.auth.getUser(token)
  const email = auth?.user?.email || ''
  if (erroSessao || !email || !DONOS.includes(email.toLowerCase())) {
    // A mesma resposta para "não tem sessão" e "não é o dono": dizer qual dos
    // dois é confirma a quem procura que a página existe.
    return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  }

  const [perfis, pesquisas, eventos] = await Promise.all([
    a.from('profiles').select('id, email, name, plan, created_at, blocked')
      .order('created_at', { ascending: false }).limit(100),
    a.from('search_history').select('query, type, result_severity, created_at')
      .order('created_at', { ascending: false }).limit(500),
    a.from('analytics_events').select('event_type, drug_names, result_severity, country_code, created_at')
      .order('created_at', { ascending: false }).limit(1000),
  ])

  // Uma lista vazia por causa de um erro de leitura seria indistinguível de
  // "não há dados" — e num painel de gestão isso leva a conclusões erradas.
  for (const [nome, r] of [['profiles', perfis], ['search_history', pesquisas], ['analytics_events', eventos]] as const) {
    if (r.error) console.error(`[phlox:admin-painel] ${nome}`, r.error)
  }

  return NextResponse.json({
    utilizadores: perfis.data || [],
    pesquisas: pesquisas.data || [],
    eventos: eventos.data || [],
    falhou: [
      perfis.error ? 'utilizadores' : null,
      pesquisas.error ? 'pesquisas' : null,
      eventos.error ? 'eventos' : null,
    ].filter(Boolean),
  })
}
