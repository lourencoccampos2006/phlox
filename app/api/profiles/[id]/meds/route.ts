// ─── NOVO: app/api/profiles/[id]/meds/route.ts ───
// CRUD de medicamentos de um perfil familiar.
// Requer autenticação; ownership verificado por user_id.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

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

// GET — lista medicamentos do perfil
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  // Confirmar que o perfil pertence ao utilizador
  const { data: profile } = await supabase
    .from('family_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .from('family_profile_meds')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ meds: data })
}

// POST — adicionar medicamento ao perfil
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  // Confirmar ownership
  const { data: profile } = await supabase
    .from('family_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const body = await req.json()
  const { name, dose, frequency, indication, started_at } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('family_profile_meds')
    .insert({
      profile_id: profileId,
      user_id: userId,
      name: name.trim(),
      dose: dose || null,
      frequency: frequency || null,
      indication: indication || null,
      started_at: started_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ med: data }, { status: 201 })
}

// DELETE — remover medicamento via ?medId=<uuid>
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const token = extractToken(req)!
  const supabase = makeSupabase(token)

  const { searchParams } = new URL(req.url)
  const medId = searchParams.get('medId')
  if (!medId) return NextResponse.json({ error: 'medId obrigatório' }, { status: 400 })

  const { error } = await supabase
    .from('family_profile_meds')
    .delete()
    .eq('id', medId)
    .eq('profile_id', profileId)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
