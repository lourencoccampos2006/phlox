// app/api/monitor/route.ts — REESCRITO
// Fix: agora busca TODOS os medicamentos — pessoais + familiares + doentes Pro/Clinic

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

interface MedInput { name: string; dose?: string; frequency?: string; source?: string }
interface PatientCtx { age?: number; sex?: 'M'|'F'; conditions?: string }

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan, userId } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Watcher')

  const body = await req.json().catch(() => null)

  // Se o frontend enviou medicamentos explicitamente, usa esses
  // Se não, vai buscar TODOS ao Supabase (modo automático)
  let meds: MedInput[] = []
  const ctx: PatientCtx = body?.patient_context || {}

  if (body?.medications && Array.isArray(body.medications) && body.medications.length > 0) {
    meds = (body.medications as MedInput[]).slice(0, 30).map((m: MedInput) => ({
      name: String(m.name || '').trim().slice(0, 80),
      dose: m.dose ? String(m.dose).trim().slice(0, 40) : undefined,
      frequency: m.frequency ? String(m.frequency).trim().slice(0, 40) : undefined,
      source: m.source || 'manual',
    })).filter(m => m.name)
  } else if (userId) {
    // Modo automático: buscar TODOS os medicamentos do utilizador
    const authHeader = req.headers.get('authorization') || ''
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const [
      { data: personal },
      { data: family },
      { data: patients },
    ] = await Promise.all([
      // Medicamentos pessoais
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', userId),
      // Medicamentos familiares
      supabase.from('family_profile_meds').select('name, dose, frequency, family_profiles(name)').eq('user_id', userId),
      // Medicamentos de doentes (Pro/Clinic)
      plan === 'pro' || plan === 'clinic'
        ? supabase.from('patient_meds').select('name, dose, frequency, patients(name)').eq('user_id', userId)
        : Promise.resolve({ data: [] }),
    ])

    const allMeds: MedInput[] = [
      ...(personal || []).map((m: any) => ({ name: m.name, dose: m.dose, frequency: m.frequency, source: 'pessoal' })),
      ...(family || []).map((m: any) => ({ name: m.name, dose: m.dose, frequency: m.frequency, source: `familiar: ${(m.family_profiles as any)?.name || 'Familiar'}` })),
      ...((patients || []) as any[]).map((m: any) => ({ name: m.name, dose: m.dose, frequency: m.frequency, source: `doente: ${(m.patients as any)?.name || 'Doente'}` })),
    ]

    // Deduplica por nome
    const seen = new Set<string>()
    meds = allMeds.filter(m => { const k = m.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 30)
  }

  if (meds.length === 0) {
    return NextResponse.json({
      alerts: [],
      score: 0,
      summary: 'Sem medicamentos registados para monitorizar. Adiciona a tua medicação em "Os Meus Medicamentos" para activar o Phlox Watcher.',
      meds_monitored: 0,
    })
  }

  const medList = meds.map(m => {
    let s = `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`
    if (m.source) s += ` [${m.source}]`
    return s
  }).join('\n')

  const patientStr = [
    ctx.age ? `${ctx.age} anos` : null,
    ctx.sex ? (ctx.sex === 'F' ? 'sexo feminino' : 'sexo masculino') : null,
    ctx.conditions || null,
  ].filter(Boolean).join(', ')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico a monitorizar a segurança farmacoterapêutica de todos os medicamentos de um doente ou utilizador.
Analisa TODA a medicação listada, incluindo medicamentos de diferentes perfis (pessoal, familiar, doente).

Responde APENAS com JSON válido:
{
  "alerts": [
    {
      "type": "interaction"|"renal"|"beers"|"duplication"|"monitoring"|"contraindication"|"high_risk",
      "severity": "critical"|"high"|"moderate"|"low",
      "drugs_involved": ["fármaco1", "fármaco2"],
      "source_profiles": ["pessoal", "familiar: Nome"],
      "message": "descrição clara da preocupação em PT-PT",
      "action": "acção concreta recomendada",
      "evidence": "fonte ou guideline"
    }
  ],
  "score": 0-100,
  "summary": "resumo do estado geral da medicação em 1-2 frases",
  "meds_monitored": número_de_medicamentos_analisados,
  "next_check_days": número_de_dias_até_próxima_verificação_recomendada
}

Score:
- 90-100: sem preocupações significativas
- 70-89: preocupações menores, monitorizar
- 50-69: problemas moderados, acção recomendada
- 0-49: problemas graves ou críticos

Verifica sistematicamente:
1. Interações entre TODOS os medicamentos (incluindo entre perfis diferentes)
2. Medicamentos de alto risco: varfarina, digoxina, insulina, opióides, anticoagulantes
3. Critérios Beers em idosos (se idade ≥65 indicada)
4. Duplicações terapêuticas (mesma classe, especialmente entre perfis)
5. Medicamentos que requerem monitorização analítica regular`,
      },
      {
        role: 'user',
        content: `Medicação a monitorizar (${meds.length} fármacos):\n${medList}${patientStr ? `\n\nContexto do doente: ${patientStr}` : ''}`,
      },
    ], { maxTokens: 2000, temperature: 0.05 })

    return NextResponse.json({ ...result, meds_monitored: meds.length })
  } catch (err: any) {
    console.error('Monitor route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao analisar. Tenta novamente.' }, { status: 500 })
  }
}