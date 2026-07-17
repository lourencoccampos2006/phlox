import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

// Vista de SÓ LEITURA de um perfil partilhado. Service-role + verificação
// explícita (só há family_profile_shares válido, resgatado por este utilizador,
// não revogado) — ver nota em sprint112_family_profile_shares.sql sobre porque
// não se altera a RLS de family_profiles/family_profile_meds/vitals/symptom_logs.

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: share } = await db.from('family_profile_shares')
    .select('id').eq('profile_id', profileId).eq('viewer_user_id', userId).is('revoked_at', null).maybeSingle()
  if (!share) return NextResponse.json({ error: 'Não tens acesso a este perfil.' }, { status: 403 })

  const [{ data: profile }, { data: meds }, { data: vitals }, { data: symptoms }] = await Promise.all([
    db.from('family_profiles').select('name, relation, age, sex, conditions, allergies, notes').eq('id', profileId).maybeSingle(),
    db.from('family_profile_meds').select('name, dose, frequency, pills_remaining, pills_per_day').eq('profile_id', profileId),
    db.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').eq('profile_id', profileId).order('recorded_at', { ascending: false }).limit(10),
    db.from('symptom_logs').select('at, symptoms, pain, temperature, notes').eq('profile_id', profileId).order('at', { ascending: false }).limit(10).then((r: any) => r, () => ({ data: [] })),
  ])
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  return NextResponse.json({ profile, meds: meds || [], vitals: vitals || [], symptoms: symptoms || [] })
}
