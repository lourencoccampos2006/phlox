// app/api/vigilancia/cron/route.ts
// Vigilância noturna AUTOMÁTICA. Corre via cron (Vercel) — varre os residentes
// de cada utilizador com plano clínico e atualiza o risco. De manhã o coordenador
// abre /vigia e está tudo feito, com destaque para quem PIOROU.
// Protegido por CRON_SECRET. Usa service role (sem sessão de utilizador).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { analyzeFamilyMember } from '@/lib/caregiverWatch'
import { sendPushNotification } from '@/lib/webPush'
import { sendEmail, caregiverWatchEmail } from '@/lib/email'

export const maxDuration = 60

// STOPP/Beers local (igual ao /api/vigilancia — determinístico, sem IA)
function stoppFlags(p: any, meds: any[]): string[] {
  const flags: string[] = []
  const names = meds.map(m => (m.name || '').toLowerCase()).join(' ')
  const age = p.age || 0
  const has = (re: RegExp) => re.test(names)
  if (meds.length >= 5) flags.push('Polimedicação (≥5 fármacos)')
  if (age >= 75) {
    if (has(/diazepam|lorazepam|alprazolam|bromazepam|clonazepam|benzodiaz/)) flags.push('Benzodiazepina em idoso')
    if (has(/amitriptilina|clomipramina|imipramina|doxepina/)) flags.push('Tricíclico em idoso')
    if (has(/diclofenac|ibuprofeno|naproxeno|cetorolac|aine/)) flags.push('AINE em idoso')
    if (has(/haloperidol|risperidona|olanzapina|quetiapina|antipsic/)) flags.push('Antipsicótico em idoso')
  }
  if (has(/varfarina|apixaban|rivaroxaban|edoxaban|dabigatran/) && has(/diclofenac|ibuprofeno|naproxeno|aine|aspirina|ácido acetilsalic/)) flags.push('Anticoagulante + AINE/AAS')
  return flags
}

export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  const secret = bearer || req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Utilizadores com plano clínico/pro (são quem tem residentes a vigiar)
  const { data: profiles, error } = await db.from('profiles').select('id').in('plan', ['clinic', 'pro'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let scanned = 0, worsened = 0
  const userLimit = Math.min(Number(req.nextUrl.searchParams.get('users') || 20), 50)

  for (const prof of (profiles || []).slice(0, userLimit)) {
    const { data: patients } = await db.from('patients').select('*').eq('user_id', prof.id)
    if (!patients?.length) continue
    for (const p of patients.slice(0, 30)) {  // teto por utilizador (custo/tempo)
      const { data: meds } = await db.from('patient_meds').select('name, dose, frequency').eq('patient_id', p.id)
      const flags = stoppFlags(p, meds || [])
      let alerts: any[] = [], summary = ''
      if ((meds || []).length >= 2) {
        try {
          const res = await aiJSON<any>([
            { role: 'system', content: `És farmacêutico clínico. Devolve alertas da medicação. JSON: { "alerts":[{"type":"interaction|dose|beers|monitoring","severity":"grave|moderada|info","message":"...","action":"..."}], "summary":"1 frase" }. PT-PT.` },
            { role: 'user', content: `Doente ${p.age || '?'}a. Medicação: ${(meds || []).map((m: any) => `${m.name} ${m.dose || ''}`).join('; ')}` },
          ], { maxTokens: 800, temperature: 0.2 })
          alerts = res?.alerts || []; summary = res?.summary || ''
        } catch {}
      }
      const critical = alerts.filter(a => a.severity === 'grave').length
      const moderate = alerts.filter(a => a.severity === 'moderada').length
      const riskScore = Math.min(100, critical * 30 + moderate * 15 + flags.length * 8 + Math.min(20, (meds || []).length * 2))

      // lê risco anterior para detetar piora
      const { data: prev } = await db.from('patient_vigilance').select('risk_score').eq('user_id', prof.id).eq('patient_id', p.id).maybeSingle()
      const prevScore = prev?.risk_score || 0
      if (riskScore > prevScore + 5) worsened++

      await db.from('patient_vigilance').upsert({
        user_id: prof.id, patient_id: p.id, risk_score: riskScore, prev_risk_score: prevScore,
        alerts, flags, summary, analysed_at: new Date().toISOString(), auto_scanned_at: new Date().toISOString(),
      }, { onConflict: 'user_id,patient_id' })
      scanned++
    }
  }

  // ─── Vigilância do CUIDADOR (modo familiar) ──────────────────────────────────
  // Corre o motor determinístico (lib/caregiverWatch) por familiar de cada cuidador,
  // persiste os sinais crítico/major em family_alerts (dedup pelo índice único
  // profile_id+kind+dia) e envia 1 push + 1 email RESUMO por cuidador, só com o que
  // for NOVO (ainda não notificado). Tudo best-effort: se faltar SQL/env, não rebenta.
  const caregiver = await runCaregiverWatch(db)

  return NextResponse.json({ ok: true, scanned, worsened, caregiver })
}

async function runCaregiverWatch(db: any) {
  let users = 0, alertsNew = 0, notified = 0
  try {
    // Quem tem familiares a cuidar (qualquer plano vê os alertas em /familia;
    // a NOTIFICAÇÃO proativa é o valor Pro/Institucional).
    const { data: profs, error: pe } = await db
      .from('family_profiles')
      .select('id, user_id, name, age, sex, weight, conditions, allergies')
    if (pe || !profs?.length) return { users: 0, alertsNew: 0, notified: 0 }

    // Agrupa por cuidador.
    const byUser: Record<string, any[]> = {}
    for (const p of profs) (byUser[p.user_id] ||= []).push(p)

    const since = new Date(Date.now() - 90 * 86400000).toISOString()

    for (const userId of Object.keys(byUser).slice(0, 200)) {
      users++
      const members = byUser[userId]
      const memberIds = members.map((m: any) => m.id)

      // Dados reais (degrada a vazio se tabela/coluna em falta).
      const [meds, vitals, syms, plan] = await Promise.all([
        db.from('family_profile_meds').select('profile_id, name, pills_remaining, pills_per_day').in('profile_id', memberIds).then((r: any) => r.data || [], () => []),
        db.from('vitals').select('profile_id, recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').in('profile_id', memberIds).gte('recorded_at', since).then((r: any) => r.data || [], () => []),
        db.from('symptom_logs').select('profile_id, at, pain, temperature, symptoms').in('profile_id', memberIds).gte('at', since).then((r: any) => r.data || [], () => []),
        db.from('profiles').select('plan').eq('id', userId).maybeSingle().then((r: any) => r.data?.plan || 'free', () => 'free'),
      ])

      const fresh: { who: string; title: string; detail: string }[] = []

      for (const m of members) {
        const result = analyzeFamilyMember({
          age: m.age, sex: m.sex, weight: m.weight, conditions: m.conditions, allergies: m.allergies,
          meds: meds.filter((x: any) => x.profile_id === m.id),
          vitals: vitals.filter((x: any) => x.profile_id === m.id),
          symptoms: syms.filter((x: any) => x.profile_id === m.id),
        })
        const urgent = result.signals.filter(s => s.severity === 'critical' || s.severity === 'major')
        for (const s of urgent) {
          // Insere; o índice único (profile_id, kind, dia) trava duplicados → conflito
          // silencioso. Pedimos o registo de volta para saber se é NOVO.
          const ins = await db.from('family_alerts').insert({
            user_id: userId, profile_id: m.id, kind: s.kind, severity: s.severity,
            title: s.title, detail: s.detail, action: s.action || null, cta_href: s.cta?.href || null,
          }).select('id').maybeSingle()
          if (ins.data?.id) {
            alertsNew++
            fresh.push({ who: m.name.split(' ')[0], title: s.title, detail: s.detail })
          }
          // (Se houve conflito de dedup, ins.error existe e ignoramos — já estava lá.)
        }
      }

      // Notifica 1x por cuidador, só com o que é novo, e só nos planos com valor proativo.
      if (fresh.length && (plan === 'pro' || plan === 'clinic')) {
        let didNotify = false
        const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)
        for (const sub of subs || []) {
          const ok = await sendPushNotification(sub, {
            title: fresh.length === 1 ? `Phlox — ${fresh[0].who}: ${fresh[0].title}` : `Phlox — ${fresh.length} alertas na sua família`,
            body: fresh.length === 1 ? fresh[0].detail : fresh.map(f => `${f.who}: ${f.title}`).slice(0, 3).join(' · '),
            url: '/familia', tag: `fam-watch-${userId}`,
          })
          if (ok) didNotify = true
          else await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        // Email resumo (best-effort; só se houver email do cuidador).
        const { data: au } = await db.auth.admin.getUserById(userId).catch(() => ({ data: null }))
        const email = au?.user?.email
        if (email) {
          const { subject, html } = caregiverWatchEmail(fresh)
          const r = await sendEmail({ to: email, subject, html })
          if (r.ok) didNotify = true
        }
        if (didNotify) {
          notified++
          // Marca como notificado os alertas abertos deste cuidador ainda sem notified_at.
          await db.from('family_alerts').update({ notified_at: new Date().toISOString() })
            .eq('user_id', userId).is('notified_at', null).is('dismissed_at', null)
        }
      }
    }
  } catch (e) {
    // Vigilância do cuidador é best-effort — nunca derruba o cron institucional.
    return { users, alertsNew, notified, error: String((e as any)?.message || e).slice(0, 160) }
  }
  return { users, alertsNew, notified }
}
