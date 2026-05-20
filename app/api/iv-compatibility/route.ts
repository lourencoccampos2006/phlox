import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drugs || !Array.isArray(body.drugs) || body.drugs.length < 2) {
    return NextResponse.json({ error: 'Mínimo 2 fármacos obrigatório' }, { status: 400 })
  }

  const drugs: string[] = body.drugs.map((d: string) => d.trim()).filter(Boolean)

  try {
    const pairs: string[] = []
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        pairs.push(`${drugs[i]} + ${drugs[j]}`)
      }
    }

    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico especialista em compatibilidade de medicamentos IV.
Baseias as tuas respostas em fontes primárias: Trissel's Handbook on Injectable Drugs (2024), King Guide to Parenteral Admixtures, Micromedex IV Compatibility, e SmPC dos fabricantes.

Para cada par de fármacos IV indicado, avalia a compatibilidade em Y-site (mesmo acesso venoso, em paralelo).
Quando relevante, indica também compatibilidade em seringa ou em mistura direta.

Responde APENAS com JSON válido:
{
  "pairs": [
    {
      "drug_a": "nome do fármaco A",
      "drug_b": "nome do fármaco B",
      "ysite": "compatible" | "incompatible" | "conditional" | "unknown",
      "admixture": "compatible" | "incompatible" | "conditional" | "unknown" | "not_applicable",
      "syringe": "compatible" | "incompatible" | "conditional" | "unknown" | "not_applicable",
      "details": "mecanismo de incompatibilidade, condições de compatibilidade, ou confirmação de compatibilidade",
      "clinical_note": "relevância clínica e o que fazer (usar vias separadas, flush intermédio, etc.)",
      "evidence": "Trissel's 2024" | "King Guide" | "Micromedex" | "SmPC" | "Dados limitados"
    }
  ],
  "general_recommendations": "recomendações gerais para a combinação completa"
}

Para "conditional": explicar condições (concentração, diluente, temperatura, prazo de validade).
Ser preciso e conservador — quando há dúvida, indicar "unknown" em vez de arriscar.`,
      },
      {
        role: 'user',
        content: `Avaliar compatibilidade IV para os seguintes pares:\n${pairs.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nContext: administração numa unidade hospitalar. Vias IV periférica e central.`,
      },
    ], { maxTokens: 2000, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao verificar compatibilidade.' }, { status: 500 })
  }
}
