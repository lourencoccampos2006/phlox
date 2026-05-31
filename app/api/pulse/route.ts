import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phlox Pulse — Server-Sent Events com KPIs operacionais ao vivo. Sem polling.
// Funciona em Cloudflare Workers (ReadableStream). Token de autenticação no
// query string (?token=) porque o EventSource do browser não permite headers.

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function userIdFromToken(token: string): Promise<string | null> {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.sub || null
  } catch { return null }
}

async function snapshot(userId: string) {
  const sb = adminClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()
  const [salesRes, waitRes, openIncRes, taskRes] = await Promise.all([
    sb.from('sales').select('gross,discount,at').eq('user_id', userId).gte('at', todayISO),
    sb.from('waiting_room').select('status').eq('user_id', userId).gte('arrived_at', todayISO),
    sb.from('incidents').select('id').eq('user_id', userId).neq('status', 'closed'),
    sb.from('team_tasks').select('id').eq('user_id', userId).neq('status', 'done'),
  ])
  const sales = salesRes.data || []
  const revenue_today = sales.reduce((a: number, s: any) => a + Math.max(0, (Number(s.gross) || 0) - (Number(s.discount) || 0)), 0)
  const waiting = (waitRes.data || []).filter((w: any) => w.status === 'waiting').length
  const inService = (waitRes.data || []).filter((w: any) => w.status === 'called' || w.status === 'in_service').length
  return {
    revenue_today,
    sales_count_today: sales.length,
    waiting_now: waiting,
    in_service_now: inService,
    open_incidents: (openIncRes.data || []).length,
    open_tasks: (taskRes.data || []).length,
    at: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  const userId = await userIdFromToken(token)
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let closed = false
      const close = () => { if (closed) return; closed = true; try { controller.close() } catch { /* noop */ } }
      // se o cliente sai, abortamos
      req.signal.addEventListener('abort', close)

      // primeiro snapshot imediato
      try { send('snapshot', await snapshot(userId)) } catch { /* segue */ }

      // intervalo a cada 5s, limite 5 minutos (60 emissões)
      let n = 0
      const maxEmissions = 60
      while (!closed && n < maxEmissions) {
        await new Promise(r => setTimeout(r, 5000))
        if (closed) break
        try { send('snapshot', await snapshot(userId)) } catch { /* segue */ }
        // heartbeat keep-alive (proxies cortam ligações idle)
        send('ping', { at: new Date().toISOString() })
        n++
      }
      close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
