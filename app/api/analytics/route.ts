import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_type, drug_names, result_severity, result_source, user_id } = body

    // Store anonymous analytics
    await supabase.from('analytics_events').insert({
      event_type,
      drug_names: drug_names || [],
      result_severity: result_severity || null,
      result_source: result_source || null,
      country_code: request.headers.get('cf-ipcountry') || null,
    })

    // Store user history if logged in
    if (user_id) {
      await supabase.from('search_history').insert({
        user_id,
        type: event_type === 'interaction_check' ? 'interaction' : 'drug',
        query: drug_names?.join(' + ') || '',
        result_severity: result_severity || null,
        result_source: result_source || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Analytics failures should never break the app
    return NextResponse.json({ ok: false })
  }
}