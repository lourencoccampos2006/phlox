import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Deriva o user_id do TOKEN (não confiar no body — evita forjar histórico de outros).
async function userFromToken(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token || token.split('.').length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.sub || null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(getIP(request), 60, 60_000).allowed) return rateLimitResponse()
  try {
    const body = await request.json()
    const { event_type, drug_names, result_severity, result_source } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Analytics anónimos (sem PII — só tipo de evento e país)
    await supabase.from('analytics_events').insert({
      event_type: String(event_type || 'unknown').slice(0, 60),
      drug_names: Array.isArray(drug_names) ? drug_names.slice(0, 20) : [],
      result_severity: result_severity || null,
      result_source: result_source || null,
      country_code: request.headers.get('cf-ipcountry') || null,
    })

    // Histórico SÓ para o utilizador autenticado (user_id derivado do token, não do body)
    const userId = await userFromToken(request)
    if (userId) {
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: request.headers.get('authorization') || '' } } }
      )
      await userClient.from('search_history').insert({
        user_id: userId,
        type: event_type === 'interaction_check' ? 'interaction' : 'drug',
        query: (Array.isArray(drug_names) ? drug_names.join(' + ') : String(drug_names || '')).slice(0, 200),
        result_severity: result_severity || null,
        result_source: result_source || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}