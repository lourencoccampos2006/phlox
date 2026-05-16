import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/webPush'

// Called every 15 minutes by Vercel Cron (vercel.json) or an external scheduler.
// Vercel sends: Authorization: Bearer <CRON_SECRET>
// Manual/Cloudflare: x-cron-secret header or ?secret= query param
export async function GET(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const secret = bearerToken || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const today = now.toISOString().split('T')[0]

  let sent = 0
  let errors = 0

  // ─── 1. Medication reminders ─────────────────────────────────────────────────
  // Find all personal_meds with a reminder_time that matches ±10min of now
  const { data: medsWithReminders } = await supabase
    .from('personal_meds')
    .select('id, user_id, name, dose, reminder_times')
    .not('reminder_times', 'is', null)

  const dueReminders = (medsWithReminders || []).filter((med: any) => {
    const times: string[] = med.reminder_times || []
    return times.some(t => isWithin10Min(t, nowHHMM))
  })

  if (dueReminders.length > 0) {
    // Check which ones already have a log today at this hour (avoid duplicate pushes)
    const dueIds = dueReminders.map((m: any) => m.id)
    const hourKey = nowHHMM.slice(0, 2) // "09" from "09:23"

    const { data: todayLogs } = await supabase
      .from('med_logs')
      .select('med_id')
      .in('med_id', dueIds)
      .eq('date', today)
      .gte('logged_at', `${today}T${hourKey}:00:00Z`)
      .lt('logged_at', `${today}T${hourKey}:59:59Z`)

    const alreadyLogged = new Set((todayLogs || []).map((l: any) => l.med_id))

    for (const med of dueReminders) {
      if (alreadyLogged.has(med.id)) continue

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', med.user_id)

      for (const sub of subs || []) {
        const ok = await sendPushNotification(sub, {
          title: `Phlox — ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          body: `Hora de tomar o ${med.name}. Toca para confirmar.`,
          url: `/mymeds?confirm=${med.id}&date=${today}`,
          tag: `reminder-${med.id}`,
        })
        if (ok) sent++
        else {
          errors++
          // Remove expired subscription
          if (!ok) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      }
    }
  }

  // ─── 2. MAR omission alerts (near shift end) ─────────────────────────────────
  // Shift end windows: manhã ends ~13:45-14:15, tarde ~20:45-21:15, noite ~6:45-7:15
  const SHIFT_END_WINDOWS: Record<string, [string, string]> = {
    manha: ['13:45', '14:15'],
    tarde:  ['20:45', '21:15'],
    noite:  ['06:45', '07:15'],
  }

  for (const [shiftName, [start, end]] of Object.entries(SHIFT_END_WINDOWS)) {
    if (!isInWindow(nowHHMM, start, end)) continue

    // Only send once per shift end — check if we already sent this alert today
    const alertTag = `mar-alert-${today}-${shiftName}`
    const { count: alreadySent } = await supabase
      .from('push_notifications_sent')
      .select('*', { count: 'exact', head: true })
      .eq('tag', alertTag)

    if ((alreadySent || 0) > 0) continue

    // Find orgs with institutional plan
    const { data: orgUsers } = await supabase
      .from('profiles')
      .select('id, org_id, org_role, name')
      .eq('plan', 'clinic')
      .not('org_id', 'is', null)
      .in('org_role', ['admin', 'coordinator', 'pharmacist'])

    const orgIds = [...new Set((orgUsers || []).map((u: any) => u.org_id))]

    for (const orgId of orgIds) {
      const orgMembers = (orgUsers || []).filter((u: any) => u.org_id === orgId)
      const memberIds = orgMembers.map((u: any) => u.id)

      // Get all patients for this org
      const { data: orgPatients } = await supabase
        .from('patients')
        .select('id, name')
        .in('user_id', memberIds)

      if (!orgPatients?.length) continue

      const patientIds = orgPatients.map((p: any) => p.id)

      // Count active meds per patient
      const { data: allMeds } = await supabase
        .from('patient_meds')
        .select('patient_id')
        .eq('active', true)
        .in('patient_id', patientIds)

      // Count records for today/shift
      const { data: todayRecs } = await supabase
        .from('mar_records')
        .select('patient_id')
        .eq('date', today)
        .eq('shift', shiftName)
        .in('patient_id', patientIds)

      const medsCount: Record<string, number> = {}
      ;(allMeds || []).forEach((m: any) => { medsCount[m.patient_id] = (medsCount[m.patient_id] || 0) + 1 })
      const recsCount: Record<string, number> = {}
      ;(todayRecs || []).forEach((r: any) => { recsCount[r.patient_id] = (recsCount[r.patient_id] || 0) + 1 })

      const omissions = orgPatients.filter((p: any) => (medsCount[p.id] || 0) - (recsCount[p.id] || 0) > 0)
      if (omissions.length === 0) continue

      const totalMissing = omissions.reduce((s: number, p: any) => s + (medsCount[p.id] || 0) - (recsCount[p.id] || 0), 0)
      const names = omissions.slice(0, 3).map((p: any) => p.name).join(', ')

      // Send to coordinators/admins of this org
      const coordinators = orgMembers.filter((u: any) => ['admin', 'coordinator'].includes(u.org_role))
      for (const coord of coordinators) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', coord.id)

        for (const sub of subs || []) {
          const ok = await sendPushNotification(sub, {
            title: `MAR — ${totalMissing} doses em falta`,
            body: `Turno da ${shiftName === 'manha' ? 'manhã' : shiftName === 'tarde' ? 'tarde' : 'noite'}: ${names}${omissions.length > 3 ? ` e mais ${omissions.length - 3}` : ''}`,
            url: '/mar',
            tag: alertTag,
          })
          if (ok) sent++
          else await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }

      // Mark as sent
      await supabase.from('push_notifications_sent').insert({ tag: alertTag, sent_at: new Date().toISOString() })
    }
  }

  return NextResponse.json({ ok: true, sent, errors, time: nowHHMM })
}

function isWithin10Min(target: string, current: string): boolean {
  const [th, tm] = target.split(':').map(Number)
  const [ch, cm] = current.split(':').map(Number)
  const diff = Math.abs((th * 60 + tm) - (ch * 60 + cm))
  return diff <= 10
}

function isInWindow(current: string, start: string, end: string): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const c = toMin(current), s = toMin(start), e = toMin(end)
  // Handle midnight crossing
  if (s <= e) return c >= s && c <= e
  return c >= s || c <= e
}
