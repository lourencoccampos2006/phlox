// app/api/vigilancia/route.ts
// Vigia Clínico do Lar (institucional). Orquestra a análise de TODOS os doentes:
//   GET                  → painel: doentes ordenados por risco + flags + alertas
//   POST {action:'scan'} → corre análise farmacológica em todos (lote) e grava
//   POST {action:'report'} → relatório clínico do lar a partir de tudo
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON, aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export const maxDuration = 60

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}

// STOPP/Beers simplificado — deteção local determinística (sem IA, instantâneo)
function stoppFlags(p: any, meds: any[]): string[] {
  const flags: string[] = []
  const names = meds.map(m => (m.name || '').toLowerCase()).join(' ')
  const age = p.age || 0
  const has = (re: RegExp) => re.test(names)
  if (meds.length >= 5) flags.push('Polimedicação (≥5 fármacos)')
  if (age >= 75) {
    if (has(/diazepam|lorazepam|alprazolam|bromazepam|clonazepam|benzodiaz/)) flags.push('Benzodiazepina em idoso (risco de queda/confusão)')
    if (has(/amitriptilina|clomipramina|imipramina|doxepina/)) flags.push('Antidepressivo tricíclico em idoso (anticolinérgico)')
    if (has(/diclofenac|ibuprofeno|naproxeno|cetorolac|aine/)) flags.push('AINE em idoso (risco GI/renal/HTA)')
    if (has(/haloperidol|risperidona|olanzapina|quetiapina|antipsic/)) flags.push('Antipsicótico em idoso (rever indicação, risco AVC)')
  }
  if (has(/varfarina|apixaban|rivaroxaban|edoxaban|dabigatran/) && has(/diclofenac|ibuprofeno|naproxeno|aine|aspirina|ácido acetilsalic/)) flags.push('Anticoagulante + AINE/AAS (risco hemorrágico)')
  if (has(/digoxina/) && age >= 75) flags.push('Digoxina em idoso (vigiar dose/toxicidade)')
  return flags
}

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('clinic', 'Vigia Clínico do Lar')
  const db = sb(req)
  const [pats, vig] = await Promise.all([
    db.from('patients').select('id, name, age, sex, room, risk_level, alert_count, last_review').eq('user_id', userId),
    db.from('patient_vigilance').select('*').eq('user_id', userId),
  ])
  if (pats.error && /does not exist/i.test(pats.error.message)) return NextResponse.json({ patients: [], needs_migration: true })
  const vigMap: Record<string, any> = {}
  for (const v of (vig.data || [])) vigMap[v.patient_id] = v
  const rows = (pats.data || []).map((p: any) => ({ ...p, vigilance: vigMap[p.id] || null }))
  rows.sort((a: any, b: any) => (b.vigilance?.risk_score || 0) - (a.vigilance?.risk_score || 0))
  return NextResponse.json({ patients: rows })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 8, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('clinic', 'Vigia Clínico do Lar')
  const body = await req.json().catch(() => null) as any
  const db = sb(req)

  // ── SCAN: analisa todos os doentes (ou um lote) ──
  if (body?.action === 'scan') {
    const { data: patients, error } = await db.from('patients').select('*').eq('user_id', userId)
    if (error) return NextResponse.json({ error: error.message, hint: 'Aplica supabase/sprint82_vigilancia.sql se faltar a tabela' }, { status: 500 })
    const limit = Math.min(body.limit || 8, 12)  // lote por chamada (evita timeout)
    const offset = body.offset || 0
    const batch = (patients || []).slice(offset, offset + limit)
    let analysed = 0

    for (const p of batch) {
      const { data: meds } = await db.from('patient_meds').select('name, dose, frequency, indication').eq('patient_id', p.id)
      const flags = stoppFlags(p, meds || [])
      let alerts: any[] = []
      let summary = ''
      if ((meds || []).length >= 2) {
        try {
          const res = await aiJSON<any>([
            { role: 'system', content: `És farmacêutico clínico. Analisa a medicação do doente e devolve alertas. JSON: { "alerts": [{ "type":"interaction|dose|beers|monitoring", "severity":"grave|moderada|info", "message":"...", "action":"..." }], "summary":"1 frase" }. PT-PT.` },
            { role: 'user', content: `Doente: ${p.age || '?'}a ${p.sex || ''}. Condições: ${p.conditions || p.notes || '—'}. Medicação: ${(meds || []).map((m: any) => `${m.name} ${m.dose || ''} ${m.frequency || ''}`).join('; ')}` },
          ], { maxTokens: 900, temperature: 0.2 })
          alerts = res?.alerts || []
          summary = res?.summary || ''
        } catch {}
      }
      const critical = alerts.filter(a => a.severity === 'grave').length
      const moderate = alerts.filter(a => a.severity === 'moderada').length
      const riskScore = Math.min(100, critical * 30 + moderate * 15 + flags.length * 8 + Math.min(20, (meds || []).length * 2))
      await db.from('patient_vigilance').upsert({
        user_id: userId, patient_id: p.id, risk_score: riskScore,
        alerts, flags, summary, analysed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,patient_id' })
      analysed++
    }
    const done = offset + batch.length
    return NextResponse.json({ analysed, done, total: (patients || []).length, has_more: done < (patients || []).length })
  }

  // ── REPORT: relatório clínico do lar ──
  if (body?.action === 'report') {
    const { data: vig } = await db.from('patient_vigilance').select('*').eq('user_id', userId).order('risk_score', { ascending: false })
    const { data: patients } = await db.from('patients').select('id, name, age, room').eq('user_id', userId)
    const pMap: Record<string, any> = {}
    for (const p of (patients || [])) pMap[p.id] = p
    const lines = (vig || []).map((v: any) => {
      const p = pMap[v.patient_id] || {}
      return `- ${p.name || 'Residente'} (${p.age || '?'}a${p.room ? ', ' + p.room : ''}): risco ${v.risk_score}/100. ${(v.flags || []).join('; ')}. ${(v.alerts || []).filter((a: any) => a.severity === 'grave').map((a: any) => a.message).join(' | ')}`
    }).join('\n')
    try {
      const { text } = await aiComplete([
        { role: 'system', content: `És diretor clínico de um lar. Escreve um relatório clínico mensal profissional em PT-PT, em markdown, a partir dos dados de vigilância farmacológica dos residentes. Secções: ## Resumo executivo, ## Residentes de risco elevado, ## Problemas farmacológicos a corrigir, ## Recomendações. Anonimiza apropriadamente. Sério e pronto a entregar.` },
        { role: 'user', content: `Total de residentes analisados: ${(vig || []).length}\n\nDados:\n${lines || '(sem dados — corre primeiro o scan)'}` },
      ], { maxTokens: 2200, temperature: 0.3 })
      return NextResponse.json({ report: text })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
