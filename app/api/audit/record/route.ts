import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { recordAudit } from '@/lib/auditServer'

// POST /api/audit/record — regista um evento no Audit Trail do utilizador.
// Server-side (service role) para garantir a integridade da cadeia SHA-256.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 120, 60_000).allowed) return rateLimitResponse()

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.action) return NextResponse.json({ error: 'action em falta' }, { status: 400 })

  const r = await recordAudit({
    user_id: userId,
    action: String(body.action).slice(0, 80),
    category: body.category,
    resource: body.resource ? String(body.resource).slice(0, 60) : undefined,
    resource_id: body.resource_id ? String(body.resource_id).slice(0, 80) : undefined,
    ip,
    user_agent: (req.headers.get('user-agent') || '').slice(0, 200),
    detail: body.detail,
  })
  if (!r.ok) return NextResponse.json({ error: r.error || 'Erro' }, { status: 500 })
  return NextResponse.json({ ok: true, id: r.id, seq: r.seq })
}
