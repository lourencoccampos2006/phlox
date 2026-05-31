import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { signPayload } from '@/lib/webhooks'
import { recordAudit } from '@/lib/auditServer'

// Dispara um evento para os webhooks do utilizador subscritos a esse evento.
// Assina com HMAC-SHA256 (X-Phlox-Signature). Regista cada entrega.
// `test: true` + `endpointId` → envia um ping a um único endpoint.

function authClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 60, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const event: string = body?.event || (body?.test ? 'ping.test' : '')
  if (!event) return NextResponse.json({ error: 'event em falta' }, { status: 400 })

  const sb = authClient(req)
  let endpoints: any[] = []
  if (body?.test && body?.endpointId) {
    const { data } = await sb.from('webhook_endpoints').select('*').eq('id', body.endpointId).eq('user_id', userId).maybeSingle()
    if (data) endpoints = [data]
  } else {
    const { data } = await sb.from('webhook_endpoints').select('*').eq('user_id', userId).eq('active', true)
    endpoints = (data || []).filter((e: any) => Array.isArray(e.events) && e.events.includes(event))
  }
  if (endpoints.length === 0) return NextResponse.json({ ok: true, delivered: 0 })

  const ts = new Date().toISOString()
  const results: any[] = []
  for (const ep of endpoints) {
    const envelope = JSON.stringify({ event, at: ts, data: body?.data ?? { message: 'Phlox webhook test' } })
    let status = 0, ok = false, responseText = ''
    try {
      const sig = await signPayload(ep.secret, envelope)
      const r = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Phlox-Event': event, 'X-Phlox-Signature': sig, 'X-Phlox-Timestamp': ts },
        body: envelope,
        signal: AbortSignal.timeout(8000),
      })
      status = r.status; ok = r.ok
      responseText = (await r.text().catch(() => '')).slice(0, 300)
    } catch (e: any) {
      status = 0; ok = false; responseText = String(e?.message || e).slice(0, 300)
    }
    await sb.from('webhook_deliveries').insert({ user_id: userId, endpoint_id: ep.id, event, status, ok, response: responseText }).then(() => {}, () => {})
    await sb.from('webhook_endpoints').update({ last_status: status, last_at: ts }).eq('id', ep.id).then(() => {}, () => {})
    results.push({ endpoint: ep.url, status, ok })
  }
  recordAudit({ user_id: userId, action: 'webhook.dispatched', category: 'integration', detail: { event, endpoints: endpoints.length, ok: results.filter(r => r.ok).length } }).catch(() => {})
  return NextResponse.json({ ok: true, delivered: results.filter(r => r.ok).length, results })
}
