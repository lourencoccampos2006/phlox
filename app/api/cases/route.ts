import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 15, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Casos Clínicos')

  const body = await req.json().catch(() => null)
  if (!body?.prompt) return NextResponse.json({ error: 'Caso obrigatório' }, { status: 400 })

  const domainCtx: Record<string, string> = {
    farmacologia: 'farmacologia clínica — foca em decisão terapêutica, interações, posologia, evidência',
    medicina_interna: 'medicina interna — foca em diagnóstico, fisiopatologia, guidelines terapêuticas',
    emergencia: 'medicina de emergência — foca em reconhecimento, algoritmos ACLS/ATLS, tratamento imediato',
    cirurgia: 'cirurgia geral — foca em indicações, técnica, complicações e cuidados peri-operatórios',
    pediatria: 'pediatria — considera especificidades pediátricas, doses por peso, desenvolvimento',
    gineco_obstetricia: 'ginecologia e obstetrícia — considera gravidez, paridade, contracepção, oncologia ginecológica',
    enfermagem: 'enfermagem clínica — foca em cuidados, técnicas, avaliação e intervenções de enfermagem',
    nutricao: 'nutrição clínica — foca em avaliação nutricional, necessidades e suporte nutricional',
  }
  const ctx = domainCtx[body.domain || 'farmacologia'] || domainCtx.farmacologia

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um clínico especialista e professor de ${ctx}. Crias casos clínicos pedagógicos e realistas. Responde APENAS com JSON válido, sem markdown, em português PT-PT.

JSON esperado:
{
  "title": "título breve do caso",
  "presentation": "apresentação clínica detalhada e realista (3-5 frases)",
  "vitals": { "TA": "130/80", "FC": "88", "SpO2": "96%", "Temp": "37.2°C" },
  "question": "questão clínica específica a responder",
  "differential_diagnosis": [
    { "diagnosis": "diagnóstico 1", "rationale": "justificação breve" },
    { "diagnosis": "diagnóstico 2", "rationale": "justificação breve" },
    { "diagnosis": "diagnóstico 3", "rationale": "justificação breve" }
  ],
  "treatment_options": [
    { "option": "opção terapêutica 1", "detail": "detalhe clínico" },
    { "option": "opção terapêutica 2", "detail": "detalhe clínico" },
    { "option": "opção terapêutica 3", "detail": "detalhe clínico" }
  ],
  "outcome": {
    "correct_diagnosis": "diagnóstico correcto do differential",
    "best_treatment": "opção terapêutica óptima",
    "diagnosis_feedback": "explicação do diagnóstico correcto com fundamentação",
    "treatment_feedback": "explicação da abordagem óptima com evidência",
    "key_learning_points": ["ponto 1", "ponto 2", "ponto 3"]
  }
}

Regras:
- vitals: inclui apenas os relevantes para o caso (pode não incluir todos)
- differential: 3-4 opções plausíveis, apenas uma correcta
- treatment_options: 3 opções, apenas uma é óptima
- key_learning_points: 3-4 pontos práticos que ficam para sempre
- Nível universitário avançado, realista, específico para Portugal`,
    },
    { role: 'user', content: `Cria um caso clínico baseado neste cenário: ${body.prompt}` },
  ], { maxTokens: 2500, temperature: 0.5 })

  return NextResponse.json(result)
}