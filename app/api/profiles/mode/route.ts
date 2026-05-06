// ─── NOVO: app/api/profiles/mode/route.ts ───
// Muda o experience_mode do utilizador autenticado.
// Usado pelo ModeSwitcher mobile onde o supabase client não está disponível directamente.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

const VALID_MODES = ['clinical', 'caregiver', 'personal', 'student'] as const
type Mode = typeof VALID_MODES[number]

export async function POST(req: NextRequest) {
  try {
    const { plan, userId } = await getUserPlan(req)
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const mode = body?.mode as Mode
    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: 'Modo inválido' }, { status: 400 })
    }

    // Extrair token para supabase com auth context
    const cookieHeader = req.headers.get('cookie') || ''
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)?.[1]?.split('%2C')?.[0]?.replace(/%22/g, '') || ''

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { error } = await supabase
      .from('profiles')
      .update({ experience_mode: mode })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, mode })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 })
  }
}