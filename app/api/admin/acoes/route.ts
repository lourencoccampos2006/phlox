// app/api/admin/acoes/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Ações do dono do Phlox sobre contas e instituições.
//
// ── A FRONTEIRA ────────────────────────────────────────────────────────────
// Isto mexe em ACESSO e em FATURAÇÃO — quem pode entrar, com que plano, se a
// conta está suspensa. Não toca, e não pode vir a tocar, no conteúdo de
// nenhuma instituição: nem registos de cuidado, nem o livro de registos, nem
// fichas de pessoas. Ver a nota em supabase/sprint137_activity_log.sql.
//
// Apagar uma conta é irreversível e apaga em cascata o que lhe pertence, por
// isso exige o email escrito por extenso do lado do cliente — não basta
// carregar num botão.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ADMIN_EMAILS = ['lourencoccampos2006@gmail.com']
const PLANOS = ['free', 'student', 'pro', 'clinic']

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: u } = await anon.auth.getUser(token)
  const eu = u?.user
  if (!eu || !ADMIN_EMAILS.includes(eu.email || '')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) return NextResponse.json({ error: 'Sem chave de serviço no ambiente.' }, { status: 503 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave)

  const b = await req.json().catch(() => null) as {
    acao?: string; userId?: string; orgId?: string; plano?: string; confirmacao?: string
  } | null
  const acao = String(b?.acao || '')

  // Nunca sobre a própria conta: um clique errado e o dono fica de fora.
  if (b?.userId && b.userId === eu.id && acao !== 'plano') {
    return NextResponse.json({ error: 'Não podes fazer isso à tua própria conta.' }, { status: 400 })
  }

  try {
    switch (acao) {
      // ── Contas ───────────────────────────────────────────────────────────
      case 'bloquear':
      case 'desbloquear': {
        if (!b?.userId) return NextResponse.json({ error: 'Falta a conta.' }, { status: 400 })
        const bloquear = acao === 'bloquear'
        // ban_duration do Supabase Auth: a sessão cai e não volta a entrar.
        const { error } = await sb.auth.admin.updateUserById(b.userId, {
          ban_duration: bloquear ? '876000h' : 'none',   // ~100 anos = indefinido
        } as any)
        if (error) throw new Error(error.message)
        await sb.from('profiles').update({ blocked: bloquear }).eq('id', b.userId).then(() => {}, () => {})
        return NextResponse.json({ ok: true, bloqueado: bloquear })
      }

      case 'plano': {
        if (!b?.userId || !PLANOS.includes(String(b.plano))) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
        const { error } = await sb.from('profiles').update({ plan: b.plano }).eq('id', b.userId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true, plano: b.plano })
      }

      case 'apagar-conta': {
        if (!b?.userId) return NextResponse.json({ error: 'Falta a conta.' }, { status: 400 })
        // Confirmação por email escrito: apagar é definitivo.
        const { data: perfil } = await sb.from('profiles').select('email').eq('id', b.userId).maybeSingle()
        if (!perfil?.email || String(b.confirmacao || '').trim().toLowerCase() !== String(perfil.email).toLowerCase()) {
          return NextResponse.json({ error: 'Escreve o email da conta para confirmar.' }, { status: 400 })
        }
        const { error } = await sb.auth.admin.deleteUser(b.userId)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true, apagada: perfil.email })
      }

      // ── Instituições ─────────────────────────────────────────────────────
      case 'suspender-org':
      case 'reativar-org': {
        if (!b?.orgId) return NextResponse.json({ error: 'Falta a instituição.' }, { status: 400 })
        const suspender = acao === 'suspender-org'
        const { error } = await sb.from('organizations').update({ suspended: suspender }).eq('id', b.orgId)
        if (error) throw new Error(error.message)
        // Suspender uma casa faz descer o acesso de toda a equipa a free —
        // ninguém fica de fora do Phlox, só perdem o acesso institucional.
        const { data: membros } = await sb.from('org_members').select('user_id').eq('org_id', b.orgId)
        const ids = (membros || []).map((m: any) => m.user_id).filter(Boolean)
        if (ids.length) await sb.from('profiles').update({ plan: suspender ? 'free' : 'clinic' }).in('id', ids)
        return NextResponse.json({ ok: true, suspensa: suspender, membros: ids.length })
      }

      default:
        return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 180) }, { status: 500 })
  }
}
