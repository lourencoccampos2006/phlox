import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Gera um protocolo operacional para um lar/ERPI (formato: título/categoria/passos),
// pronto a inserir na ferramenta de Protocolos. Baseado em boas práticas PT (DGS/INEM).

const CATS = ['fall', 'pressure_ulcer', 'emergency', 'admission', 'infection', 'restraint', 'medication', 'end_of_life', 'nutrition', 'other']

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const topic = String(body?.topic || '').trim().slice(0, 160)
  if (!topic) return NextResponse.json({ error: 'Indica o tema do protocolo' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És enfermeiro(a) coordenador(a) de um lar/ERPI em Portugal. Crias PROCEDIMENTOS operacionais claros para a equipa de ação direta e enfermagem, segundo boas práticas (DGS, INEM, NPUAP/EPUAP). PT-PT.

Responde APENAS com JSON válido (sem markdown):
{
  "title": "título curto do protocolo",
  "category": "uma de: ${CATS.join(', ')}",
  "description": "1 frase sobre o objetivo do protocolo",
  "steps": [ { "text": "passo concreto e acionável pela equipa", "critical": true/false } ],
  "review_months": 12
}

Regras:
- 5 a 9 passos, por ordem de execução, linguagem clara para auxiliares de ação direta.
- Marca critical=true nos passos de segurança / obrigatórios / com risco de vida.
- Inclui sempre o passo de REGISTAR no Phlox quando aplicável (ocorrência, ferida, etc.).
- Adapta a categoria ao tema. Rigor factual; nada de inventar fármacos ou doses sem necessidade.`,
      },
      { role: 'user', content: `Cria o protocolo: ${topic}` },
    ], { maxTokens: 1200, temperature: 0.1 })

    if (!CATS.includes(result?.category)) result.category = 'other'
    if (!Array.isArray(result?.steps)) result.steps = []
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar protocolo.' }, { status: 500 })
  }
}
