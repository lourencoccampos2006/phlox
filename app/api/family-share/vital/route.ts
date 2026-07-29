import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { adminDb, hasEditorAccess } from '@/lib/familyShareAccess'

// Gestão a dois (Pro, sprint121) — registar um sinal vital num perfil de
// família como EDITOR. Mesma gama de valores plausíveis do /api/vitals
// (rede de segurança contra erros de digitação, não limites clínicos).

const VITAL_RANGES: Record<string, [number, number]> = {
  hr: [20, 300], bp_sys: [40, 300], bp_dia: [20, 200],
  spo2: [0, 100], weight: [0.5, 500], glucose: [10, 1000], temp: [25, 45],
}

function parseVital(field: string, raw: unknown): { value: number | null; error?: string } {
  if (raw == null || raw === '') return { value: null }
  const n = Number(raw)
  if (!Number.isFinite(n)) return { value: null, error: `${field}: valor inválido` }
  const range = VITAL_RANGES[field]
  if (range && (n < range[0] || n > range[1])) return { value: null, error: `${field}: fora da gama plausível (${range[0]}-${range[1]})` }
  return { value: n }
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const profileId = String(body?.profile_id || '')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const db = adminDb()
  if (!(await hasEditorAccess(db, userId, profileId))) return NextResponse.json({ error: 'Sem acesso de gestão a este perfil.' }, { status: 403 })

  const fields = ['hr', 'bp_sys', 'bp_dia', 'spo2', 'weight', 'glucose', 'temp'] as const
  const parsed: Record<string, number | null> = {}
  const errors: string[] = []
  for (const f of fields) {
    const r = parseVital(f, (body as any)[f])
    if (r.error) errors.push(r.error)
    parsed[f] = r.value
  }
  if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  if (Object.values(parsed).every(v => v == null)) return NextResponse.json({ error: 'Indica pelo menos um valor.' }, { status: 400 })

  const { data, error } = await db.from('vitals').insert({
    user_id: userId,
    profile_id: profileId,
    recorded_at: new Date().toISOString(),
    ...parsed,
    notes: body?.notes ? String(body.notes).slice(0, 500) : null,
  }).select('id, recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp, notes').single()

  if (error) { console.error('[phlox:family-share/vital]', error.message); return NextResponse.json({ error: 'Não foi possível guardar agora. Tenta de novo.' }, { status: 500 }) }
  return NextResponse.json({ vital: data })
}
