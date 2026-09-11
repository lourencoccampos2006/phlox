import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sub = body?.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'Subscrição inválida' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Uma subscricao por endpoint e por conta.
  // O erro deste upsert era ignorado: se a gravacao falhasse, a resposta era
  // `ok: true` na mesma e a pessoa ficava convencida de que tinha notificacoes
  // ativas sem ter nenhuma linha na tabela. Agora falha a frente.
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  }, { onConflict: 'endpoint' })

  if (error) {
    console.error('[phlox:push] gravar subscricao falhou:', error.message)
    return NextResponse.json({ error: 'Nao foi possivel guardar a subscricao.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  if (!endpoint) return NextResponse.json({ error: 'Endpoint obrigatório' }, { status: 400 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
