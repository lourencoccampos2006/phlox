import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.entries || body.entries.length < 3) {
    return NextResponse.json({ error: 'Mínimo 3 dias de registos' }, { status: 400 })
  }

  const entries = body.entries.slice(0, 30)
  const medications: string[] = body.medications || []

  // Build summary for AI
  const entrySummary = entries.map((e: any) =>
    `${e.date}: bem-estar ${e.wellbeing}/5, sintomas: [${(e.symptoms || []).join(', ') || 'nenhum'}]${e.notes ? `, notas: "${e.notes}"` : ''}`
  ).join('\n')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacêutico clínico a analisar um diário de sintomas e medicação de um doente. Responde em português europeu (PT-PT) com linguagem simples e directa.

Analisa os padrões entre sintomas e medicação e identifica o que é clinicamente relevante.

Responde APENAS com JSON válido sem markdown:
{
  "summary": "resumo geral em 2-3 frases do estado do doente ao longo do período — em linguagem simples",
  "patterns": [
    {
      "observation": "padrão observado — conciso",
      "significance": "o que pode significar farmacologicamente",
      "action": "o que o doente deve fazer"
    }
  ],
  "adverse_effects_possible": ["possível efeito adverso detectado — com base nos sintomas recorrentes e medicação"],
  "bring_to_doctor": ["ponto concreto para levar à próxima consulta — específico e accionável"],
  "positive_trends": ["tendência positiva observada — se existir"]
}

Regras:
- Máximo 4 padrões, 3 efeitos adversos possíveis, 4 pontos para o médico
- Sê conservador — não diagnósticas, sugeres
- Usa linguagem que qualquer pessoa percebe
- Se não houver padrões claros, diz isso com honestidade
- Patterns só se houver evidência real nos dados`,
      },
      {
        role: 'user',
        content: `Medicação actual: ${medications.length > 0 ? medications.join(', ') : 'não especificada'}

Registos diários (${entries.length} dias):
${entrySummary}`,
      },
    ], { maxTokens: 1200, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}