// app/api/org/colegas/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quem trabalha nesta casa, só os nomes.
//
// ── PORQUE É QUE ISTO NÃO É O /api/org/team ────────────────────────────────
// O /api/org/team exige ser quem gere a casa — e está certo, porque devolve
// emails, papéis, departamentos e convites pendentes. Mas quem escreve um
// recado dirigido no mural é uma auxiliar a dizer uma coisa a uma colega, e
// essa não pode chamar o /api/org/team.
//
// Então esta rota devolve o mínimo: o nome e o id. Nada de emails, nada de
// papéis, nada de quem convidou quem. Saber o nome de quem trabalha ao lado
// não é informação a proteger — é a lista telefónica da casa.
//
// ── PORQUE É QUE USA A CHAVE DE SERVIÇO ────────────────────────────────────
// Os nomes vivem em `profiles`, que é de pessoas e não de casas, e que uma
// colega não tem (nem deve ter) direito de ler diretamente. A rota confirma
// primeiro que quem pergunta é membro ATIVO desta casa e só depois lê — e só
// lê as duas colunas que devolve.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authedClient } from '@/lib/orgAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') || ''
  if (!orgId) return NextResponse.json({ colegas: [] })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ colegas: [] })
  }

  const sb = authedClient(req)
  const { data: auth } = await sb.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return NextResponse.json({ error: 'Inicia sessão.' }, { status: 401 })

  // Sou mesmo desta casa? Esta pergunta é feita com o token de quem pergunta,
  // por isso passa pela RLS — não é a chave de serviço a responder por si.
  const { data: sou, error: erroMembro } = await sb.from('org_members')
    .select('user_id').eq('org_id', orgId).eq('user_id', userId).eq('active', true).maybeSingle()
  if (erroMembro || !sou) {
    return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  }

  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: membros, error } = await a.from('org_members')
    .select('user_id').eq('org_id', orgId).eq('active', true)
  if (error) {
    console.error('[phlox:colegas]', error.message)
    return NextResponse.json({ colegas: [] })
  }
  const ids = (membros || []).map(m => m.user_id)
  if (!ids.length) return NextResponse.json({ colegas: [] })

  const { data: perfis, error: erroPerfis } = await a.from('profiles').select('id, name').in('id', ids)
  if (erroPerfis) {
    // Sem os nomes, a lista seria «Colega, Colega, Colega» — pior do que não
    // haver lista: quem escreve não sabe a quem está a escrever.
    console.error('[phlox:colegas] perfis', erroPerfis.message)
    return NextResponse.json({ colegas: [] })
  }
  const nomePorId: Record<string, string> = {}
  for (const p of perfis || []) nomePorId[p.id] = p.name || ''

  const colegas = ids
    .filter(id => id !== userId)     // não se manda um recado a si próprio
    .map(id => ({ user_id: id, nome: nomePorId[id] || 'Colega' }))
    .sort((x, y) => x.nome.localeCompare(y.nome, 'pt'))

  return NextResponse.json({ colegas })
}
