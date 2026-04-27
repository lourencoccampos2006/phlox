import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.topic) return NextResponse.json({ error: 'Assunto obrigatório' }, { status: 400 })

  const { topic, doctor, medications, recent_symptoms, extra_context } = body

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico a ajudar um doente a preparar uma consulta médica. Responde em português europeu (PT-PT) com linguagem simples e directa — o utilizador não tem formação clínica.

O objectivo é que o doente aproveite ao máximo os 15 minutos de consulta com perguntas certas, por ordem de prioridade.

Responde APENAS com JSON válido sem markdown:
{
  "questions_for_doctor": [
    {
      "question": "pergunta concreta que o doente deve fazer — em português simples",
      "why": "porque é importante perguntar isto — em 1 frase simples",
      "priority": "alta" | "normal"
    }
  ],
  "symptoms_summary": "resumo dos sintomas recentes em 1-2 frases — para o doente ler ao médico",
  "medication_concerns": ["preocupação concreta sobre a medicação actual a discutir"],
  "labs_to_request": ["análise ou exame que faz sentido pedir nesta consulta"],
  "reminders": ["coisa concreta para levar à consulta — ex: lista de medicamentos, caderneta de saúde"]
}

Regras:
- Máximo 6 perguntas, ordenadas por prioridade (alta primeiro)
- As perguntas devem ser específicas — não genéricas como "como estou?"
- Se a medicação incluir anticoagulantes, antidiabéticos, ou antihipertensores — sempre uma pergunta sobre monitorização
- Se houver sintomas recentes — incluí-los nas perguntas
- Labs a pedir: só os que fazem sentido para a medicação e sintomas — não uma lista genérica
- Linguagem que qualquer pessoa de 60 anos percebe`,
      },
      {
        role: 'user',
        content: `Assunto da consulta: ${topic}
${doctor ? `Médico: ${doctor}` : ''}
${medications?.length > 0 ? `Medicação actual: ${medications.join(', ')}` : ''}
${recent_symptoms?.length > 0 ? `Sintomas recentes (última semana): ${recent_symptoms.join(', ')}` : ''}
${extra_context ? `Contexto adicional: ${extra_context}` : ''}`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}