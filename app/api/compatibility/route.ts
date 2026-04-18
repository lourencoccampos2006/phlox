import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 48 // 48h — compatibilidade muda pouco

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.drug1 || !body?.drug2) {
    return NextResponse.json({ error: 'Dois fármacos obrigatórios' }, { status: 400 })
  }

  const drug1 = String(body.drug1).trim().slice(0, 80)
  const drug2 = String(body.drug2).trim().slice(0, 80)
  const solution = String(body.solution || 'NaCl 0.9%').slice(0, 50)

  const cacheKey = [drug1, drug2].sort().join('|').toLowerCase() + ':' + solution.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um farmacêutico hospitalar especialista em compatibilidade de fármacos IV.
Baseia-te em Trissel's Handbook of Injectable Drugs, King Guide to Parenteral Admixtures, e publicações científicas.
Responde APENAS com JSON válido sem markdown:
{
  "status": "COMPATIVEL" | "INCOMPATIVEL" | "CONDICIONAL" | "DESCONHECIDO",
  "summary": "Resumo claro em 1-2 frases em português europeu",
  "mechanism": "Mecanismo de incompatibilidade se aplicável (opcional)",
  "conditions": "Condições para compatibilidade se CONDICIONAL (opcional)",
  "concentration_limits": "Limites de concentração se relevantes (opcional)",
  "time_limit": "Estabilidade temporal se relevante (opcional)",
  "alternative": "Alternativa recomendada se INCOMPATIVEL (opcional)",
  "source": "Trissel's / King Guide / Literatura"
}
Status CONDICIONAL = compatível apenas em certas concentrações, tempo ou solução.
Status DESCONHECIDO = dados publicados insuficientes — indica isso claramente no summary.`
        },
        {
          role: 'user',
          content: `Compatibilidade IV de ${drug1} com ${drug2} em ${solution}. Incluindo Y-site e mistura directa.`
        }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Compatibility route error:', err?.message)
    return NextResponse.json({ error: 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}