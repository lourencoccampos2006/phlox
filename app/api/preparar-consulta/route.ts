import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "Preparar a consulta" (pessoal/família) — transforma sintomas/dúvidas numa folha
// organizada para levar ao médico: resumo, perguntas a fazer, sinais a referir.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const notes = String(body?.notes || '').trim().slice(0, 800)
  if (!notes) return NextResponse.json({ error: 'Descreve o que se passa' }, { status: 400 })
  const who = String(body?.who || '').trim().slice(0, 60)
  const meds = String(body?.meds || '').trim().slice(0, 400)
  const specialty = String(body?.specialty || '').trim().slice(0, 60)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `Ajudas uma pessoa (ou um cuidador) a PREPARAR uma ida ao médico, em Portugal. Organizas o que ela escreveu numa folha clara para levar à consulta e ajudas a não esquecer nada. Linguagem simples, PT-PT. NÃO diagnosticas nem recomendas tratamento.

Responde APENAS com JSON válido (sem markdown):
{
  "summary": "resumo de 2-3 frases do motivo da consulta, em linguagem simples",
  "timeline": ["facto datado relevante (ex: 'há 1 semana começou a dor')"],
  "questions_to_ask": ["pergunta concreta e útil a fazer ao médico"],
  "symptoms_to_mention": ["sintoma/sinal importante a não esquecer de referir"],
  "to_bring": ["o que levar à consulta (ex: 'lista de medicação', 'análises recentes')"],
  "red_flags": ["sinal que, se aparecer antes da consulta, justifica ir mais cedo/urgência"]
}

Regras:
- As perguntas devem ser as que um doente informado faria (diagnóstico, exames, opções, prognóstico, o que vigiar).
- Não dês conselho médico nem nomes de fármacos como recomendação.
- Adequa ao contexto (idade implícita, medicação, especialidade).`,
      },
      { role: 'user', content: `Para: ${who || 'mim'}.${specialty ? ` Especialidade: ${specialty}.` : ''}${meds ? ` Medicação atual: ${meds}.` : ''}\n\nO que se passa:\n${notes}` },
    ], { maxTokens: 1200, temperature: 0.2 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
