// app/api/import-meds/route.ts
// Interprets any medication list format using AI
// Accepts: Sifarma exports, SClinico lists, handwritten, PDF text


import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.text?.trim()) {
    return NextResponse.json({ error: 'Texto obrigatório' }, { status: 400 })
  }

  try {
    const result = await aiJSON<{
      patient_name: string | null
      meds: Array<{
        name: string
        dose: string
        frequency: string
        indication: string
        confidence: 'high' | 'medium' | 'low'
      }>
      raw_count: number
      notes: string
    }>([
      {
        role: 'system',
        content: `És um farmacêutico clínico a interpretar uma lista de medicamentos em qualquer formato.
A lista pode vir do Sifarma, SClinico, Socrates, ou ser escrita manualmente.

Extrai todos os medicamentos e normaliza para DCI (nome genérico em português).
Converte nomes comerciais: Brufen→ibuprofeno, Voltaren→diclofenac, Xarelto→rivaroxabano, etc.

Formatos comuns:
- "Metformina 850mg 1+0+1" = manhã+almoço+noite
- "Ramipril 5mg 1x/dia" = uma vez por dia
- "Atorvastatina 40mg ao jantar" = à noite
- "toma brufen 400 de 8 em 8 horas" = ibuprofeno 400mg 8/8h

Responde APENAS com JSON válido sem markdown:
{
  "patient_name": "nome do doente se visível no texto, ou null",
  "meds": [
    {
      "name": "DCI em português — ex: metformina",
      "dose": "dose com unidade — ex: 850mg",
      "frequency": "frequência normalizada — ex: manhã e noite, 1x/dia, 8/8h",
      "indication": "indicação se visível — ex: diabetes, hipertensão",
      "confidence": "high se claro, medium se interpretado, low se incerto"
    }
  ],
  "raw_count": número de linhas/itens no texto original,
  "notes": "avisos importantes — medicamentos não reconhecidos, formatos ambíguos"
}

Regras:
- Normaliza sempre para DCI (nome genérico)
- Frequência em português simples: "manhã", "manhã e noite", "3x/dia", "8/8h"
- Se não consegues identificar um medicamento com confidence high, usa low
- Ignora linhas que claramente não são medicamentos (cabeçalhos, datas, etc.)
- Máximo 50 medicamentos por lista`,
      },
      {
        role: 'user',
        content: `Interpreta esta lista:\n\n${body.text.trim().slice(0, 3000)}`,
      },
    ], { maxTokens: 2000, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao interpretar. Tenta novamente.' }, { status: 500 })
  }
}
