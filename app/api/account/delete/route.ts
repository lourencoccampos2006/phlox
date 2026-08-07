import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractToken } from '@/lib/planGate'

// Apagamento real de conta (RGPD Art. 17.º — direito ao apagamento).
// O botão em /settings chamava só signOut() — nada era apagado. Isto substitui
// isso por um apagamento a sério: auth.admin.deleteUser() propaga por FK
// "on delete cascade" a todas as tabelas de dados pessoais (ver
// supabase/sprint128_account_deletion.sql — pré-requisito, corrige ~69 colunas
// de atribuição que antes bloqueavam este DELETE com violação de FK).
//
// Identidade vem SEMPRE do token verificado no servidor (nunca de um userId
// enviado pelo cliente) — ver o mesmo padrão em getUserPlan/lib/planGate.ts.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const token = extractToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: authData, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !authData?.user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const userId = authData.user.id
  const email = authData.user.email || ''

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'APAGAR') {
    return NextResponse.json({ error: 'Confirmação em falta' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Apagamento indisponível neste ambiente. Contacta suporte@phloxclinical.com.' }, { status: 503 })
  }

  const sb = admin()
  const { error: delErr } = await sb.auth.admin.deleteUser(userId)

  if (delErr) {
    try {
      await sb.from('account_deletions').insert({
        deleted_user_id: userId, email, status: 'failed', error_detail: delErr.message,
      })
    } catch { /* tabela ainda não migrada — ver sprint128 */ }
    return NextResponse.json({
      error: 'Não foi possível apagar a conta automaticamente. A nossa equipa foi notificada e trata do pedido manualmente em até 30 dias, conforme a política de privacidade.',
    }, { status: 500 })
  }

  try {
    await sb.from('account_deletions').insert({
      deleted_user_id: userId, email, status: 'completed', completed_at: new Date().toISOString(),
    })
  } catch { /* tabela ainda não migrada — não bloqueia o apagamento já feito */ }

  return NextResponse.json({ ok: true })
}
