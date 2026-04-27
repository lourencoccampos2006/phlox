import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.brand_name) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })

  const { brand_name, dci } = body

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico comunitário em Portugal especialista em medicamentos genéricos. Responde em português europeu (PT-PT).

Dado um medicamento de marca, informa se tem genérico disponível em Portugal e quanto se pode poupar.

Responde APENAS com JSON válido sem markdown:
{
  "brand_name": "nome de marca conforme pedido",
  "generic_name": "nome DCI correcto em português",
  "active_ingredient": "substância activa principal",
  "has_generic": true | false,
  "generics_available": [
    {
      "name": "nome do genérico disponível em PT",
      "manufacturer": "laboratório fabricante",
      "price_range": "preço estimado em PT (ex: '3-6€')",
      "bioequivalent": true | false
    }
  ],
  "savings_estimate": "poupança estimada por embalagem (ex: '60-80% menos') — null se sem genérico",
  "snf_info": "informação específica sobre como funciona no SNS português — comparticipação, obrigatoriedade de oferecer genérico",
  "clinical_equivalence": "são clinicamente equivalentes? Explicação em linguagem simples para o doente",
  "when_to_ask_doctor": ["situação em que é melhor perguntar ao médico antes de mudar para genérico"],
  "important_notes": ["nota importante sobre este medicamento específico — ex: janela terapêutica estreita, equivalência questionável"]
}

Regras:
- Sê honesto sobre disponibilidade real em Portugal — não inventes genéricos que não existem
- Para medicamentos com janela terapêutica estreita (lítio, varfarina, digoxina, antiepilépticos), menciona isso claramente
- Preços realistas para Portugal (não US ou UK)
- Se o medicamento não tem genérico (ex: ainda em patente), explica brevemente porquê
- Máximo 4 genéricos na lista — só os mais relevantes`,
      },
      {
        role: 'user',
        content: `Medicamento: ${brand_name}${dci && dci !== brand_name ? ` (${dci})` : ''}`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}