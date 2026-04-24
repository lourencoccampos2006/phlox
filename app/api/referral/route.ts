import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/referral — get or create referral code for the user
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Check if user already has a code
  const { data: existing } = await supabase
    .from('referrals')
    .select('code, uses, rewarded')
    .eq('referrer_id', userId)
    .single()

  if (existing) return NextResponse.json(existing)

  // Generate unique code: first 4 chars of userId + 4 random chars
  const code = userId.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

  const { data, error } = await supabase
    .from('referrals')
    .insert({ referrer_id: userId, code, uses: 0, rewarded: 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/referral — redeem a referral code (called during/after signup)
export async function POST(req: NextRequest) {
  const { code, newUserId } = await req.json().catch(() => ({}))
  if (!code || !newUserId) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { data: referral, error } = await supabase
    .from('referrals')
    .select('referrer_id, uses')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !referral) return NextResponse.json({ error: 'Código inválido' }, { status: 404 })

  // Prevent self-referral
  if (referral.referrer_id === newUserId) {
    return NextResponse.json({ error: 'Não podes usar o teu próprio código' }, { status: 400 })
  }

  // Check not already used by this user
  const { data: alreadyUsed } = await supabase
    .from('referral_uses')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('user_id', newUserId)
    .single()

  if (alreadyUsed) return NextResponse.json({ error: 'Código já utilizado' }, { status: 400 })

  // Record use
  await supabase.from('referral_uses').insert({ code: code.toUpperCase(), user_id: newUserId, referrer_id: referral.referrer_id })

  // Increment counter
  await supabase.from('referrals').update({ uses: (referral.uses || 0) + 1 }).eq('code', code.toUpperCase())

  // Give new user 30 days of Student free
  // (in production: create a Stripe coupon or just flag in DB)
  await supabase.from('profiles').update({ referral_bonus_days: 30 }).eq('id', newUserId)

  return NextResponse.json({ success: true, message: '30 dias de Student ativados!' })
}