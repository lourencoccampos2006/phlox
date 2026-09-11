import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarPush } from '@/lib/webPush'
import { ptHHMM, ptDate } from '@/lib/ptTime'

// Called every 15 minutes by GitHub Actions (.github/workflows/push-cron.yml)
// or an external scheduler. NOT by Vercel Cron: the Hobby plan allows two cron
// jobs, once a day each. See .github/CRON_SETUP.md.
// Vercel sends: Authorization: Bearer <CRON_SECRET>
// Manual/Cloudflare: x-cron-secret header or ?secret= query param
export async function GET(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  // Só cabeçalhos — nunca query string (URLs ficam em logs de servidor,
  // proxies e histórico do browser). Ver app/api/cron/ingest-shortages.
  const secret = bearerToken || req.headers.get('x-cron-secret')
  // !CRON_SECRET primeiro: sem isto, se a env var nunca tivesse sido definida no
  // deploy, um pedido SEM nenhum cabeçalho (secret undefined) passava a
  // verificação (undefined !== undefined é falso) e corria sem autenticação
  // nenhuma, com a service-role key, sobre os dados de medicação/push de TODOS
  // os utilizadores. As outras 3 rotas de cron já tinham este guard.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // CRÍTICO: o servidor (Vercel) corre em UTC. Os horários de toma que o utilizador
  // escolhe estão em hora de PORTUGAL. Comparar UTC com hora local falhava por 1h
  // no verão → as notificações nunca batiam certo. ptHHMM/ptDate dão a hora/data de
  // Lisboa (tratam verão/inverno).
  const nowHHMM = ptHHMM()
  const today = ptDate()

  let sent = 0
  let errors = 0

  // ─── 1. Medication reminders ─────────────────────────────────────────────────
  // Find all personal_meds with a reminder_time that matches ±10min of now
  const { data: medsWithReminders } = await supabase
    .from('personal_meds')
    .select('id, user_id, name, dose, reminder_times, shifts, units_left, units_per_dose, low_notified_at')
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

      // ── A caixa está a acabar? ────────────────────────────────────────
      // O Phlox já sabe quantas doses são precisas por dia; com as unidades
      // que restam, sabe quantos dias faltam. Avisar com uma semana de folga
      // é a diferença entre passar na farmácia a caminho de casa e dar por si
      // ao domingo à noite com a caixa vazia. Um aviso por medicamento e por
      // semana — não é um alarme, é um recado.
      const restam = Number((med as any).units_left)
      const porDose = Number((med as any).units_per_dose) || 1
      if (!isNaN(restam) && restam > 0 && porDose > 0) {
        const dosesPorDia = Array.isArray((med as any).shifts) && (med as any).shifts.length ? (med as any).shifts.length : 1
        const diasQueFaltam = Math.floor(restam / (porDose * dosesPorDia))
        const jaAvisado = (med as any).low_notified_at
        const avisadoHaPouco = jaAvisado && (Date.now() - new Date(jaAvisado + 'T12:00:00').getTime()) < 7 * 86400000
        if (diasQueFaltam <= 7 && !avisadoHaPouco) {
          const { data: subsBaixo } = await supabase
            .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', med.user_id)
          for (const sub of subsBaixo || []) {
            await enviarPush(sub, {
              title: `${med.name} está a acabar`,
              body: diasQueFaltam <= 0
                ? 'Já não há unidades suficientes para a próxima toma.'
                : `Chega para mais ${diasQueFaltam} ${diasQueFaltam === 1 ? 'dia' : 'dias'}. Vale a pena passar na farmácia.`,
              url: '/mymeds',
              tag: `low-${med.id}`,
            }).catch(() => {})
          }
          await supabase.from('personal_meds')
            .update({ low_notified_at: new Date().toISOString().slice(0, 10) })
            .eq('id', med.id)
        }
      }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', med.user_id)

      for (const sub of subs || []) {
        const r = await enviarPush(sub, {
          title: `Phlox — ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          body: `Hora de tomar o ${med.name}. Toca para confirmar.`,
          url: `/mymeds?confirm=${med.id}&date=${today}`,
          tag: `reminder-${med.id}`,
        })
        if (r.ok) sent++
        else {
          errors++
          // Só o 410/404 diz que o dispositivo desapareceu. Qualquer outra
          // falha é NOSSA (chave em falta, rede, 403) — apagar aqui era o que
          // limpava a tabela inteira à primeira passagem do cron.
          if (r.expirada) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          } else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo)
        }
      }
    }
  }

  // ─── 1b. Lembretes de medicação de FAMILIARES (cuidador) ─────────────────────
  // Os medicamentos de quem o cuidador acompanha vivem em family_profile_meds.
  // O cuidador (user_id) recebe o push no SEU dispositivo, identificando a pessoa.
  const { data: famMeds } = await supabase
    .from('family_profile_meds')
    .select('id, user_id, profile_id, name, dose, reminder_times')
    .not('reminder_times', 'is', null)

  const dueFam = (famMeds || []).filter((med: any) =>
    (med.reminder_times || []).some((t: string) => isWithin10Min(t, nowHHMM)))

  if (dueFam.length > 0) {
    // nome de cada familiar para a mensagem
    const profIds = [...new Set(dueFam.map((m: any) => m.profile_id))]
    const { data: profs } = await supabase.from('family_profiles').select('id, name').in('id', profIds)
    const nameOf: Record<string, string> = {}
    ;(profs || []).forEach((p: any) => { nameOf[p.id] = p.name })

    for (const med of dueFam) {
      const who = (nameOf[med.profile_id] || 'familiar').split(' ')[0]
      const { data: subs } = await supabase
        .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', med.user_id)
      for (const sub of subs || []) {
        const r = await enviarPush(sub, {
          title: `Phlox — ${who}: ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          body: `Hora de dar o ${med.name} a ${who}.`,
          url: '/familia',
          tag: `fam-reminder-${med.id}`,
        })
        if (r.ok) sent++
        else { errors++; if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
      }
    }
  }

  // ─── 1c. Atividade em perfis partilhados (viewer de "Partilhado comigo") ─────
  // sprint115: o convite de visualização (sprint112) só avisava quem vê se
  // abrisse a app. Aqui avisamos quando há medicação/vitais/sintomas NOVOS
  // desde o último aviso (ou desde o resgate do código, à primeira vez) — nunca
  // sobre o histórico inteiro do perfil.
  const { data: activeShares } = await supabase
    .from('family_profile_shares')
    .select('id, profile_id, viewer_user_id, redeemed_at, last_activity_notified_at')
    .not('viewer_user_id', 'is', null)
    .is('revoked_at', null)

  for (const share of activeShares || []) {
    const since = share.last_activity_notified_at || share.redeemed_at
    if (!since) continue
    const [{ count: medCount }, { data: latestVital }, { data: latestSymptom }] = await Promise.all([
      supabase.from('family_profile_meds').select('id', { count: 'exact', head: true }).eq('profile_id', share.profile_id).gt('created_at', since),
      supabase.from('vitals').select('recorded_at').eq('profile_id', share.profile_id).gt('recorded_at', since).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('symptom_logs').select('at').eq('profile_id', share.profile_id).gt('at', since).order('at', { ascending: false }).limit(1).maybeSingle().then((r: any) => r, () => ({ data: null })),
    ])
    if ((medCount || 0) === 0 && !latestVital && !latestSymptom) continue

    const { data: prof } = await supabase.from('family_profiles').select('name').eq('id', share.profile_id).maybeSingle()
    const who = (prof?.name || 'Familiar').split(' ')[0]
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', share.viewer_user_id)
    for (const sub of subs || []) {
      const r = await enviarPush(sub, {
        title: `Phlox — ${who}`,
        body: `Há novidades na saúde de ${who} que partilharam consigo.`,
        url: '/partilhado-comigo',
        tag: `share-activity-${share.id}-${nowHHMM}`,
      })
      if (r.ok) sent++
      else { errors++; if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
    }
    await supabase.from('family_profile_shares').update({ last_activity_notified_at: new Date().toISOString() }).eq('id', share.id)
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
          const r = await enviarPush(sub, {
            title: `MAR — ${totalMissing} doses em falta`,
            body: `Turno da ${shiftName === 'manha' ? 'manhã' : shiftName === 'tarde' ? 'tarde' : 'noite'}: ${names}${omissions.length > 3 ? ` e mais ${omissions.length - 3}` : ''}`,
            url: '/mar',
            tag: alertTag,
          })
          if (r.ok) sent++
          else if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
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
