// app/api/pharmacy/loyalty/members/[id]/route.ts
// GET   → membro + extracto
// PATCH → actions: earn (atribui pontos por valor gasto), redeem, adjust, update
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const { data: member, error } = await db.from('loyalty_members')
    .select('*, program:program_id (id, name, points_per_euro, euro_per_point, min_redeem_pts)')
    .eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const { data: tx } = await db.from('loyalty_transactions')
    .select('*')
    .eq('member_id', id)
    .order('created_at', { ascending: false })
    .limit(50)
  return NextResponse.json({ member, transactions: tx || [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as {
    action?: 'earn' | 'redeem' | 'adjust' | 'update'
    amount?: number       // valor da compra (earn)
    points?: number       // override
    reward_id?: string
    reward_name?: string
    note?: string
    name?: string
    phone?: string
    email?: string
    consent_marketing?: boolean
  } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  const db = sb(req)

  if (body.action === 'update') {
    const u: Record<string, any> = {}
    for (const k of ['name','phone','email','consent_marketing'] as const) {
      if (k in body) u[k] = (body as any)[k]
    }
    const { data, error } = await db.from('loyalty_members').update(u).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 403 })
    return NextResponse.json({ member: data })
  }

  // Para earn/redeem/adjust precisamos do programa e org_id do membro
  const { data: member, error: memErr } = await db.from('loyalty_members')
    .select('id, org_id, program:program_id ( points_per_euro, euro_per_point, min_redeem_pts )')
    .eq('id', id).single()
  if (memErr || !member) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  const program = (member as any).program

  let points = 0
  let amount: number | null = null
  let reward_id: string | null = null
  let reward_name: string | null = null

  if (body.action === 'earn') {
    if (body.amount == null || body.amount <= 0) {
      return NextResponse.json({ error: 'amount obrigatório (compra em euros)' }, { status: 400 })
    }
    amount = body.amount
    points = body.points ?? Math.floor(body.amount * (program?.points_per_euro ?? 1))
  } else if (body.action === 'redeem') {
    if (body.points == null || body.points <= 0) {
      return NextResponse.json({ error: 'points obrigatório (positivo)' }, { status: 400 })
    }
    points = -Math.abs(body.points)
    reward_id = body.reward_id || null
    reward_name = body.reward_name || null
  } else if (body.action === 'adjust') {
    if (body.points == null) return NextResponse.json({ error: 'points obrigatório' }, { status: 400 })
    points = body.points
  } else {
    return NextResponse.json({ error: 'action inválido' }, { status: 400 })
  }

  const { data: tx, error } = await db.from('loyalty_transactions').insert({
    org_id: (member as any).org_id,
    member_id: id,
    kind: body.action,
    points,
    amount,
    reward_id,
    reward_name,
    note: body.note || null,
    created_by: userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 403 })

  // Devolve membro actualizado
  const { data: updated } = await db.from('loyalty_members').select('*').eq('id', id).single()
  return NextResponse.json({ transaction: tx, member: updated })
}
