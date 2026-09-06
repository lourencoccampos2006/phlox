// app/api/admin/org-tipo/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mudar o tipo de uma instituição — lar ↔ centro de dia.
//
// Saiu das /settings (2026-09-06): não é uma preferência de quem usa. Muda o
// vocabulário, as ferramentas, o cockpit e os relatórios da casa inteira, e um
// funcionário a carregar sem querer mudava o produto debaixo dos colegas.
// Passa a ser um ato do dono do Phlox, aqui.
//
// Escreve nos dois sítios que mandam: `organizations.kind` (a instituição) e
// `profiles.institution_type` de todos os membros (o que cada sessão lê).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']
const TIPOS = ['day_care', 'nursing_home']

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: u } = await anon.auth.getUser(token)
  if (!u?.user || !ADMIN_EMAILS.includes(u.user.email || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ error: 'Sem chave de serviço no ambiente.' }, { status: 503 })

  const body = await req.json().catch(() => null) as { orgId?: string; tipo?: string } | null
  const orgId = String(body?.orgId || '')
  const tipo = String(body?.tipo || '')
  if (!orgId || !TIPOS.includes(tipo)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave)

  const { error: e1 } = await sb.from('organizations').update({ kind: tipo }).eq('id', orgId)
  if (e1) return NextResponse.json({ error: 'Não foi possível mudar o tipo da instituição.' }, { status: 500 })

  // Os membros: o que cada sessão lê para montar o produto.
  const { data: membros } = await sb.from('org_members').select('user_id').eq('org_id', orgId)
  const ids = (membros || []).map((m: any) => m.user_id).filter(Boolean)
  if (ids.length) await sb.from('profiles').update({ institution_type: tipo }).in('id', ids)

  return NextResponse.json({ ok: true, tipo, membrosAtualizados: ids.length })
}
