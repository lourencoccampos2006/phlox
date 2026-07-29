import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { adminDb, hasEditorAccess } from '@/lib/familyShareAccess'

// Gestão a dois (Pro, sprint121) — registar sintomas num perfil de família
// como EDITOR.

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const profileId = String(body?.profile_id || '')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const symptoms = Array.isArray(body?.symptoms) ? body.symptoms.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 10) : []
  const pain = body?.pain != null && body.pain !== '' ? Math.max(0, Math.min(10, Number(body.pain))) : null
  const temperature = body?.temperature != null && body.temperature !== '' ? Number(body.temperature) : null
  const notes = body?.notes ? String(body.notes).slice(0, 500) : null
  if (!symptoms.length && pain == null && temperature == null && !notes) {
    return NextResponse.json({ error: 'Indica pelo menos um sintoma, dor, temperatura ou nota.' }, { status: 400 })
  }
  if (temperature != null && (!Number.isFinite(temperature) || temperature < 25 || temperature > 45)) {
    return NextResponse.json({ error: 'Temperatura fora da gama plausível (25-45°C).' }, { status: 400 })
  }

  const db = adminDb()
  if (!(await hasEditorAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso de gestão a este perfil.' }, { status: 403 })

  const { data, error } = await db.from('symptom_logs').insert({
    user_id: userId,
    profile_id: profileId,
    at: new Date().toISOString(),
    symptoms: symptoms.length ? symptoms : null,
    pain,
    temperature,
    notes,
  }).select('id, at, symptoms, pain, temperature, notes').single()

  if (error) { console.error('[phlox:family-share/symptom]', error.message); return NextResponse.json({ error: 'Não foi possível guardar agora. Tenta de novo.' }, { status: 500 }) }
  return NextResponse.json({ symptom: data })
}
