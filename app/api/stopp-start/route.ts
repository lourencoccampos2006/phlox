import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.medications) return NextResponse.json({ error: 'Lista de medicamentos obrigatória' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico especialista em revisão de medicação em idosos. Aplicas os critérios STOPP/START versão 3 (2023) e Critérios de Beers 2023 (AGS).

Dado um perfil de doente (idade, sexo, diagnósticos, medicação, parâmetros laboratoriais), identifica:
1. Critérios STOPP violados (fármacos potencialmente inapropriados)
2. Critérios START omitidos (fármacos potencialmente em falta)
3. Critérios de Beers relevantes

Responde APENAS com JSON válido:
{
  "stopp": [
    {
      "code": "código STOPP (ex: A1, B3, C2...)",
      "criterion": "descrição do critério STOPP",
      "drug": "fármaco ou classe implicada",
      "severity": "alto" | "moderado" | "baixo",
      "recommendation": "o que fazer (suspender, substituir, reduzir dose, etc.)",
      "rationale": "justificação clínica baseada em evidência",
      "alternative": "alternativa terapêutica se disponível"
    }
  ],
  "start": [
    {
      "code": "código START (ex: A1, B2...)",
      "criterion": "descrição do critério START",
      "condition": "condição que justifica o fármaco em falta",
      "drug_class": "classe/fármaco a considerar iniciar",
      "rationale": "justificação clínica",
      "note": "precauções ou condições"
    }
  ],
  "beers": [
    {
      "drug": "fármaco",
      "concern": "problema identificado",
      "recommendation": "recomendação"
    }
  ],
  "summary": {
    "total_stopp": número,
    "total_start": número,
    "total_beers": número,
    "high_priority": ["lista dos problemas mais urgentes"],
    "overall_assessment": "avaliação global da polimedicação"
  }
}

Se não há critérios identificados numa categoria, devolver array vazio [].
Ser rigoroso — só identificar critérios que estejam claramente suportados pelos dados fornecidos.`,
      },
      {
        role: 'user',
        content: `Perfil do doente:
Idade: ${body.age || 'não especificada'} anos
Sexo: ${body.sex || 'não especificado'}
Diagnósticos: ${body.diagnoses || 'não especificados'}
Parâmetros laboratoriais: ${body.labs || 'não disponíveis'}

Medicação actual:
${body.medications}`,
      },
    ], { maxTokens: 3000, temperature: 0.0 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro na análise STOPP/START.' }, { status: 500 })
  }
}
