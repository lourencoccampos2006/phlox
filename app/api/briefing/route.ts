import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.medications) {
    return NextResponse.json({ error: 'Lista de medicamentos obrigatória' }, { status: 400 })
  }

  const medications = String(body.medications).trim().slice(0, 1000)
  const chief_complaint = String(body.chief_complaint || '').trim().slice(0, 300)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico a preparar um briefing de consulta para um profissional de saúde (médico, farmacêutico, interno ou estudante avançado). O objetivo é dar ao clínico, em 15 segundos, tudo o que precisa de saber antes de entrar na sala.

Responde APENAS com JSON válido sem markdown:
{
  "patient_profile": "perfil clínico inferido dos medicamentos em 1 frase (ex: 'Doente com HTA, DM2 e dislipidemia sob 5 fármacos')",
  "chief_concern": "o que mais importa neste contexto clínico, em 1 frase directa",
  "red_flags": [
    {
      "flag": "red flag específico e concreto",
      "reason": "porquê é relevante dado a medicação e o motivo da consulta",
      "urgency": "IMEDIATA" | "CONSULTA" | "VIGIAR"
    }
  ],
  "questions_to_ask": [
    "Pergunta directa e específica ao doente sobre a sua medicação ou sintomas"
  ],
  "what_to_monitor": [
    { "parameter": "TA sistólica", "target": "< 130/80 mmHg", "reason": "IECA + amlodipina — possível hipotensão" }
  ],
  "drug_actions": [
    { "drug": "Nome do medicamento", "role": "Para que serve neste doente", "note": "aviso importante (opcional)" }
  ],
  "critical_interactions": [
    { "drugs": ["fármaco1", "fármaco2"], "severity": "descrição do risco clínico", "action": "o que fazer" }
  ],
  "suggested_labs": ["Análise sugerida e porquê"],
  "differential_considerations": ["Diagnóstico ou problema a considerar dado o contexto"],
  "clinical_note": "Síntese clínica de 2-3 frases — o que o clínico não pode perder nesta consulta, em linguagem directa e profissional"
}

Regras:
- Máximo 4 red flags, 5 perguntas, 4 parâmetros a monitorizar
- Sê específico e clínico — evita generalidades
- Red flags IMEDIATA = risco de vida ou deterioração aguda
- Red flags CONSULTA = requer acção nesta consulta
- Red flags VIGIAR = monitorizar ao longo do tempo
- Detecta proactivamente: efeitos adversos dos medicamentos que explicam os sintomas relatados, interações críticas, doses inadequadas, oportunidades de otimização terapêutica
- A clinical_note deve ser a joia — o insight que só um farmacologista clínico experiente daria`,
      },
      {
        role: 'user',
        content: `Medicação:\n${medications}${chief_complaint ? `\n\nMotivo da consulta/contexto:\n${chief_complaint}` : ''}`,
      },
    ], { maxTokens: 1800, temperature: 0.15 })

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Briefing error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao gerar briefing. Tenta novamente.' }, { status: 500 })
  }
}