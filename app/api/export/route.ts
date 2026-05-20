import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function makeSupabase(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: NextRequest) {
  const supabase = makeSupabase(req)
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const format = new URL(req.url).searchParams.get('format') || 'json'

  const [medsRes, logsRes, vitalsRes, familyRes, historyRes] = await Promise.all([
    supabase.from('personal_meds').select('name,dose,frequency,indication,reminder_times,started_at,created_at').eq('user_id', user.id),
    supabase.from('med_logs').select('med_id,date,status,logged_at').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(500),
    supabase.from('vitals').select('recorded_at,hr,bp_sys,bp_dia,spo2,weight,glucose,temp,notes').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(200),
    supabase.from('family_profiles').select('name,relation,age,sex,conditions,allergies,created_at').eq('user_id', user.id),
    supabase.from('search_history').select('query,type,result_severity,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    user: { email: user.email },
    medications: medsRes.data || [],
    medication_logs: logsRes.data || [],
    vitals: vitalsRes.data || [],
    family_profiles: familyRes.data || [],
    search_history: historyRes.data || [],
  }

  if (format === 'csv') {
    const rows: string[] = ['# Phlox Data Export — ' + payload.exported_at, '']

    rows.push('## MEDICATIONS')
    rows.push('name,dose,frequency,indication,started_at')
    payload.medications.forEach((m: any) => {
      rows.push([m.name, m.dose, m.frequency, m.indication, m.started_at].map(v => `"${v ?? ''}"`).join(','))
    })

    rows.push('', '## VITALS')
    rows.push('date,hr,bp_sys,bp_dia,spo2,weight,glucose,temp')
    payload.vitals.forEach((v: any) => {
      rows.push([v.recorded_at, v.hr, v.bp_sys, v.bp_dia, v.spo2, v.weight, v.glucose, v.temp].map(x => x ?? '').join(','))
    })

    const csv = rows.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="phlox-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="phlox-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}
