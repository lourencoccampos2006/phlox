import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 5, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Care Plan')

  const body = await req.json().catch(() => null)
  if (!body?.medications) return NextResponse.json({ error: 'Medicamentos obrigatórios' }, { status: 400 })

  const { medications, conditions, age, patient_name, mode } = body

  const modeInstructions: Record<string, string> = {
    clinical: `MODO CLÍNICO: És um farmacologista clínico sénior a preparar um briefing para um colega profissional de saúde. Usa nomenclatura DCI, referencia mecanismos e guias clínicas (ESC/ADA/NICE/DGS). what_it_does deve ser técnico e preciso. Inclui student_insights com raciocínio clínico avançado.`,
    caregiver: `MODO CUIDADOR: Estás a criar um guia para um cuidador familiar sem formação médica. what_it_does deve usar linguagem completamente simples — "este medicamento baixa a tensão arterial" em vez de "inibidor da ECA". red_flags devem ser em linguagem de acção imediata: "Se o pai ficar tonto ao levantar-se...". avoid deve incluir alimentos e hábitos do dia-a-dia. questions_for_doctor deve ser perguntas que um familiar faria ao médico.`,
    personal: `MODO PESSOAL: Estás a criar um guia para o próprio utente. Linguagem directa e acessível, sem jargão. Foca no que é importante para o dia-a-dia. Evita terminologia técnica.`,
    student: `MODO ESTUDANTE: Estás a criar um plano pedagógico completo. what_it_does deve incluir o mecanismo de acção. Inclui student_insights com mecanismos detalhados, farmacocinética relevante (semi-vida, interações CYP450, eliminação) e raciocínio clínico desta combinação específica.`,
  }

  const modeCtx = modeInstructions[mode || 'personal'] || modeInstructions.personal

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacologista clínico especialista a gerar Planos de Cuidado Farmacológico personalizados. ${modeCtx}

Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "profile_summary": "resumo clínico em 1 frase (ex: 'Doente de 68 anos com HTA, DM2 e dislipidemia sob 4 fármacos')",
  "generated_for": "nome do doente ou 'Plano de Cuidado'",
  "mode": "${mode || 'personal'}",
  "medications": [
    {
      "name": "nome comercial ou como foi escrito",
      "dci": "DCI/nome genérico",
      "what_it_does": "adaptado ao modo — ver instruções acima",
      "when_to_take": "horário óptimo e porquê (ex: 'De manhã em jejum — melhor absorção')",
      "with_food": "sim|não|indiferente|preferencialmente",
      "duration": "se for tratamento limitado ou crónico",
      "critical_note": "aviso específico PARA ESTA COMBINAÇÃO (opcional)"
    }
  ],
  "optimised_schedule": [
    {
      "time": "Manhã (08h00)",
      "meds": [{ "name": "Nome", "dose": "dose", "note": "com 250mL água (opcional)" }]
    }
  ],
  "monitoring": [
    {
      "parameter": "o que monitorizar (ex: Tensão arterial)",
      "target": "valor alvo (ex: < 130/80 mmHg)",
      "frequency": "com que frequência (ex: 2x/semana)",
      "why": "porquê monitorizar para esta combinação",
      "red_flag": "valor ou situação que exige contacto médico imediato"
    }
  ],
  "red_flags": [
    {
      "sign": "sinal/sintoma específico",
      "meaning": "o que pode significar clinicamente",
      "action": "urgência|médico em 24h|farmacêutico|vigiar",
      "severity": "crítico|importante|atenção"
    }
  ],
  "avoid": [
    {
      "category": "alimento|bebida|actividade|medicamento_otc|suplemento",
      "item": "o que evitar",
      "reason": "porquê (em linguagem adaptada ao modo)",
      "applies_to": "nome do medicamento específico"
    }
  ],
  "renewals": [
    { "medication": "nome", "renew_in": "ex: 25 dias", "note": "nota opcional" }
  ],
  "questions_for_doctor": [
    "pergunta concreta e específica para a próxima consulta"
  ],
  "student_insights": {
    "mechanisms": "mecanismos de acção detalhados da combinação",
    "pharmacokinetics": "farmacocinética relevante — semi-vida, metabolismo CYP, eliminação",
    "clinical_reasoning": "raciocínio clínico por trás desta escolha terapêutica"
  },
  "disclaimer": "texto de aviso — confirmar sempre com médico ou farmacêutico"
}

Regras críticas:
- optimised_schedule: organiza os medicamentos nos horários que minimizam interações de absorção (ex: levotiroxina 30min antes de cálcio)
- red_flags: inclui 4-6 sinais específicos desta combinação, não genéricos
- avoid: inclui pelo menos 2-3 itens reais e específicos (ex: não só "álcool" mas "vinho tinto com metronidazol causa flush")
- questions_for_doctor: 4-6 perguntas específicas, não genéricas
- student_insights: só incluir se mode === 'student' ou mode === 'clinical'
- Se a lista de medicamentos parece incompleta, usa o contexto disponível
- Usa sempre português PT-PT correcto`,
    },
    {
      role: 'user',
      content: `Gera o plano de cuidado para:
Nome: ${patient_name || 'Doente'}
${age ? `Idade: ${age} anos` : ''}
${conditions ? `Diagnósticos/Condições: ${conditions}` : ''}
Medicação:
${medications}`,
    },
  ], { maxTokens: 2500, temperature: 0.2 })

  return NextResponse.json(result)
}