// ─── NOVO: app/api/profiles/route.ts ───
// CRUD de perfis familiares (family_profiles).
// Requer autenticação em todos os métodos.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

// Limites de perfis familiares por plano
const PROFILE_LIMITS: Record<string, number> = {
  free: 2,
  student: 3,
  pro: Infinity,
  clinic: Infinity,
}

function makeSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookie = req.headers.get('cookie') || ''
  const patterns = [
    /sb-[^=]+-auth-token=([^;]+)/,
    /supabase-auth-token=([^;]+)/,
    /sb-access-token=([^;]+)/,
  ]
  for (const p of patterns) {
    const m = cookie.match(p)
    if (m) {
      try {
        const dec = decodeURIComponent(m[1])
        if (dec.split('.').length === 3) return dec
        const parsed = JSON.parse(dec)
        if (Array.isArray(parsed) && parsed[0]) return parsed[0]
        if (parsed?.access_token) return parsed.access_token
      } catch { }
    }
  }
  return null
}

// GET — lista perfis familiares do utilizador autenticado
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  const { data, error } = await supabase
    .from('family_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data })
}

// POST — criar perfil familiar
export async function POST(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  // Verificar limite de perfis por plano
  const limit = PROFILE_LIMITS[plan] ?? 2
  if (isFinite(limit)) {
    const { count } = await supabase
      .from('family_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count || 0) >= limit) {
      return NextResponse.json({
        error: `Limite de ${limit} perfis familiares atingido no plano ${plan === 'free' ? 'Gratuito' : plan}. Faz upgrade para adicionar mais.`,
        limit_reached: true,
        upgrade_url: '/pricing',
      }, { status: 429 })
    }
  }

  const body = await req.json()
  const { name, relation, age, sex, weight, height, creatinine, conditions, allergies, notes } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('family_profiles')
    .insert({
      user_id: userId,
      name: name.trim(),
      relation: relation || null,
      age: age || null,
      sex: sex || null,
      weight: weight || null,
      height: height || null,
      creatinine: creatinine || null,
      conditions: conditions || null,
      allergies: allergies || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data }, { status: 201 })
}

// PUT — actualizar perfil familiar (ownership verificado via RLS)
export async function PUT(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  const body = await req.json()
  const { id, name, relation, age, sex, weight, height, creatinine, conditions, allergies, notes } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('family_profiles')
    .update({
      name: name.trim(),
      relation: relation || null,
      age: age || null,
      sex: sex || null,
      weight: weight || null,
      height: height || null,
      creatinine: creatinine || null,
      conditions: conditions || null,
      allergies: allergies || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  return NextResponse.json({ profile: data })
}

// DELETE — apagar perfil familiar
export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase
    .from('family_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
