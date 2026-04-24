import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const cache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 48 // 48h — a informação do medicamento não muda

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Nome do medicamento obrigatório' }, { status: 400 })

  const drug = String(body.drug).trim().slice(0, 100)
  const personalMeds: string[] = Array.isArray(body.personal_meds)
    ? body.personal_meds.slice(0, 20).map(String)
    : []

  const cacheKey = `${drug.toLowerCase()}:${personalMeds.sort().join(',').toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.result)
  }

  const hasPersonalMeds = personalMeds.length > 0

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico a responder à pergunta "posso tomar este medicamento?" para qualquer pessoa — desde doentes a médicos.

Tens dois modos:
1. MODO SIMPLES — para doentes e pessoas sem formação médica: linguagem clara, sem jargão, directa, empática
2. MODO TÉCNICO — para profissionais: terminologia clínica correcta, mecanismo, dados PK/PD

Responde SEMPRE em português europeu (PT-PT).
Responde APENAS com JSON válido sem markdown:
{
  "name": "nome DCI correcto",
  "brand_names": ["nomes comerciais mais conhecidos em Portugal — máx 3"],
  "what_it_is": "para que serve em linguagem simples — 2-3 frases como se explicasses a um familiar",
  "how_it_works_simple": "mecanismo de acção numa frase acessível (ex: 'Bloqueia a produção de ácido no estômago')",
  "when_to_take": "quando e como tomar — específico e prático",
  "with_food": "SIM" | "NAO" | "TANTO_FAZ" | "PREFERIVELMENTE",
  "duration_typical": "duração típica de tratamento",
  "most_common_effects": ["efeito 1 em linguagem simples", "efeito 2", "efeito 3", "efeito 4"],
  "serious_effects": ["sinal de alarme 1 — quando ir ao médico", "sinal 2"],
  "avoid_with": ["o que evitar — alimentos, bebidas, situações — concreto e útil"],
  "safety_profile": {
    "driving": "SEGURO" | "CUIDADO" | "EVITAR",
    "alcohol": "SEGURO" | "CUIDADO" | "EVITAR",
    "pregnancy": "SEGURO" | "CUIDADO" | "EVITAR" | "PROIBIDO",
    "elderly": "SEGURO" | "CUIDADO" | "EVITAR"
  },
  ${hasPersonalMeds ? `"personal_check": {
    "status": "SEGURO" | "CUIDADO" | "EVITAR",
    "reason": "explicação específica sobre a combinação com a medicação pessoal — 1-2 frases claras",
    "conflicts": ["medicamento1 que conflitua", "medicamento2"]
  },` : ''}
  "quick_answer": "resposta directa e clara à pergunta 'posso tomar?' em 1 frase — o mais importante primeiro",
  "myth_bust": "um facto surpreendente ou mito comum sobre este medicamento que vale a pena saber — opcional, só se for relevante e útil"
}

Sê específico, útil e honesto. Se há risco real, diz claramente. Se é seguro, confirma com confiança.${hasPersonalMeds ? ` Analisa cuidadosamente a combinação com: ${personalMeds.join(', ')}.` : ''}`,
      },
      {
        role: 'user',
        content: `Informação completa sobre: ${drug}${hasPersonalMeds ? `\n\nVerifica também a compatibilidade com os meus medicamentos actuais: ${personalMeds.join(', ')}` : ''}`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    cache.set(cacheKey, { result, timestamp: Date.now() })
    return NextResponse.json(result)

  } catch (err: any) {
    console.error('Scanner error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao verificar. Tenta novamente.' }, { status: 500 })
  }
}