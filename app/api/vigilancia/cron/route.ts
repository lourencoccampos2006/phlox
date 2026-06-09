// app/api/vigilancia/cron/route.ts
// Vigilância noturna AUTOMÁTICA. Corre via cron (Vercel) — varre os residentes
// de cada utilizador com plano clínico e atualiza o risco. De manhã o coordenador
// abre /vigia e está tudo feito, com destaque para quem PIOROU.
// Protegido por CRON_SECRET. Usa service role (sem sessão de utilizador).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'

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

  return NextResponse.json({ ok: true, scanned, worsened })
}
