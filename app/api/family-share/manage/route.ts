import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { adminDb, hasEditorAccess } from '@/lib/familyShareAccess'

// Gestão a dois (Pro, sprint121) — vista de LEITURA+ESCRITA de um perfil de
// família para quem tem uma partilha com papel 'editor' (ou é o dono). Ao
// contrário de /api/family-share/view (só leitura, dados do dono), esta rota
// devolve TODOS os registos do perfil independentemente de quem os criou —
// vitais/sintomas registados pelo dono E pelo editor, para que os dois vejam
// exatamente os mesmos dados (o objetivo de "gerir a dois").

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const db = adminDb()
  if (!(await hasEditorAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso de gestão a este perfil.' }, { status: 403 })

  const [{ data: profile }, { data: meds }, { data: vitals }, { data: symptoms }] = await Promise.all([
    db.from('family_profiles').select('id, name, relation, age, sex, conditions, allergies, notes').eq('id', profileId).maybeSingle(),
    db.from('family_profile_meds').select('id, name, dose, frequency, indication, active').eq('profile_id', profileId).order('created_at', { ascending: false }),
    db.from('vitals').select('id, recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp, notes').eq('profile_id', profileId).order('recorded_at', { ascending: false }).limit(15),
    db.from('symptom_logs').select('id, at, symptoms, pain, temperature, notes').eq('profile_id', profileId).order('at', { ascending: false }).limit(15).then((r: any) => r, () => ({ data: [] })),
  ])
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })

  return NextResponse.json({ profile, meds: meds || [], vitals: vitals || [], symptoms: symptoms || [] })
}
