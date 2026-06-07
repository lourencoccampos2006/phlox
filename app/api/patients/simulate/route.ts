// app/api/patients/simulate/route.ts
// Gémeo Farmacológico — simula uma mudança na medicação de um residente ANTES de
// prescrever e mostra o impacto: novas interações, novos critérios STOPP, alertas
// que aparecem ou desaparecem. "Sandbox clínico".
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('clinic', 'Gémeo Farmacológico')

  const body = await req.json().catch(() => null) as { patient_id?: string; changes?: { add?: string[]; remove?: string[] } } | null
  if (!body?.patient_id) return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
  const add = (body.changes?.add || []).filter(Boolean)
  const remove = (body.changes?.remove || []).filter(Boolean)
  if (!add.length && !remove.length) return NextResponse.json({ error: 'Indica pelo menos uma alteração (adicionar/remover).' }, { status: 400 })

  const db = sb(req)
  const { data: patient } = await db.from('patients').select('*').eq('id', body.patient_id).single()
  if (!patient) return NextResponse.json({ error: 'Doente não encontrado' }, { status: 404 })
  const { data: meds } = await db.from('patient_meds').select('name, dose, frequency, indication').eq('patient_id', body.patient_id)

  const current = (meds || []).map((m: any) => m.name)
  const after = current.filter((n: string) => !remove.some(r => n.toLowerCase().includes(r.toLowerCase()))).concat(add)

  try {
    const res = await aiJSON<any>([
      {
        role: 'system',
        content: `És farmacêutico clínico. Comparas o perfil farmacológico ANTES e DEPOIS de uma alteração proposta e devolves o impacto. PT-PT.
Responde APENAS JSON:
{
  "verdict": "seguro|cuidado|nao_recomendado",
  "risk_before": 0-100,
  "risk_after": 0-100,
  "new_problems": [{ "problem": "interação/STOPP/dose nova que SURGE com a alteração", "severity": "grave|moderada", "detail": "..." }],
  "resolved_problems": ["problema que DESAPARECE com a alteração, se aplicável"],
  "monitoring": ["o que vigiar se avançar"],
  "summary": "1-2 frases de conclusão para o coordenador"
}
Considera idade (${patient.age || '?'}), condições (${patient.conditions || patient.notes || '—'}). Critérios STOPP/Beers para idoso quando aplicável.`,
      },
      {
        role: 'user',
        content: `Medicação ANTES: ${current.join(', ') || '(nenhuma)'}
Alteração proposta: ${add.length ? 'ADICIONAR ' + add.join(', ') : ''}${add.length && remove.length ? ' · ' : ''}${remove.length ? 'REMOVER ' + remove.join(', ') : ''}
Medicação DEPOIS: ${after.join(', ') || '(nenhuma)'}`,
      },
    ], { maxTokens: 1400, temperature: 0.1 })
    return NextResponse.json({ ...res, before: current, after })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
