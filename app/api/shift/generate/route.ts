// app/api/shift/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const specialty = body?.specialty || 'cardiology'
  const difficulty = body?.difficulty || 'intern'

  const SPECIALTY_CONTEXT: Record<string, string> = {
    cardiology: 'cardiologia — HTA, IC, FA, SCA, dislipidemia, anticoagulação',
    endocrinology: 'endocrinologia — DM tipo 1 e 2, tiróide, dislipidemia, obesidade',
    infectious: 'infecciologia — pneumonia, ITU, SARS, sepsis, antibioterapia',
    neurology: 'neurologia — epilepsia, Parkinson, demência, cefaleias, AVC',
    psychiatry: 'psiquiatria — depressão, bipolar, ansiedade, psicose, adição',
    mixed: 'medicina geral — várias especialidades em simultâneo',
  }

  const DIFFICULTY_CONTEXT: Record<string, string> = {
    intern: 'casos clássicos com apresentação típica. Diagnóstico directo. Tratamento de primeira linha standard.',
    resident: 'casos com comorbilidades relevantes (ex: DRC, insuficiência hepática, idoso). Há contraindicações a identificar.',
    specialist: 'casos atípicos, apresentações subtis, decisões terapêuticas difíceis com trade-offs claros.',
  }

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um médico especialista e professor universitário a criar casos clínicos para formação farmacológica. Responde em português europeu (PT-PT).

Cria 3 doentes para um turno de simulação de ${SPECIALTY_CONTEXT[specialty]}.
Nível de dificuldade: ${DIFFICULTY_CONTEXT[difficulty]}

Responde APENAS com JSON válido sem markdown:
{
  "specialty": "${specialty}",
  "difficulty": "${difficulty}",
  "duration_minutes": 30,
  "patients": [
    {
      "id": "p1",
      "name": "Nome português realista",
      "age": número,
      "sex": "M" ou "F",
      "chief_complaint": "queixa principal em 1 frase — o que o doente diz",
      "history": "história clínica completa em 3-5 frases — antecedentes, medicação prévia, contexto",
      "vitals": {
        "TA": "ex: 158/95 mmHg",
        "FC": "ex: 88 bpm",
        "SpO2": "ex: 97%",
        "Temp": "ex: 36.8°C"
      },
      "current_meds": ["medicação actual do doente"],
      "labs": {
        "Nome do exame": "valor com unidade"
      },
      "allergies": ["alergias se relevante — array vazio se não"]
    }
  ]
}

Regras:
- Casos realistas e clinicamente relevantes
- Labs incluídos só quando relevantes para o diagnóstico
- Cada doente deve ter um problema farmacológico claro a resolver
- Variar idade, sexo, e complexidade entre os 3 doentes
- Nomes portugueses realistas (José Silva, Maria Santos, António Ferreira, etc.)`,
      },
      { role: 'user', content: `Gera turno de ${specialty} (${difficulty})` },
    ], { maxTokens: 2500, temperature: 0.7 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao gerar turno' }, { status: 500 })
  }
}