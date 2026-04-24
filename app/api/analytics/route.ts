import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_type, drug_names, result_severity, result_source, user_id } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Anonymous analytics
    await supabase.from('analytics_events').insert({
      event_type: event_type || 'unknown',
      drug_names: drug_names || [],
      result_severity: result_severity || null,
      result_source: result_source || null,
      country_code: request.headers.get('cf-ipcountry') || null,
    })

    // User history if logged in
    if (user_id) {
      await supabase.from('search_history').insert({
        user_id,
        type: event_type === 'interaction_check' ? 'interaction' : 'drug',
        query: Array.isArray(drug_names) ? drug_names.join(' + ') : (drug_names || ''),
        result_severity: result_severity || null,
        result_source: result_source || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}