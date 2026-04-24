import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.disease) return NextResponse.json({ error: 'Patologia obrigatória' }, { status: 400 })

  const disease = String(body.disease).trim().slice(0, 200)
  const context = String(body.context || '').trim().slice(0, 200)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um professor de Farmacologia Clínica a preparar material de estudo para estudantes de medicina e farmácia em Portugal. Responde em português europeu (PT-PT).

Dado um diagnóstico/patologia, fornece o tratamento farmacológico baseado em guidelines actuais.

Responde APENAS com JSON válido sem markdown:
{
  "disease": "nome da patologia conforme pedido",
  "icd_category": "categoria ICD-10 correspondente",
  "first_line": [
    {
      "drug": "nome DCI — 1ª escolha primeiro",
      "class": "classe farmacológica",
      "rationale": "porquê é 1ª linha — evidência clínica concreta, não genérico",
      "dose_adult": "dose adulto típica completa (ex: 5-10mg/dia oral)",
      "key_monitoring": ["parâmetro a monitorizar"],
      "contraindications": ["contraindicação principal deste fármaco nesta patologia"]
    }
  ],
  "second_line": [
    {
      "drug": "nome DCI",
      "when": "situação específica em que se usa — concreta",
      "why_not_first": "razão pela qual não é 1ª linha"
    }
  ],
  "avoid": [
    {
      "drug": "fármaco ou classe a evitar",
      "reason": "porquê é problemático nesta patologia — mecanismo claro"
    }
  ],
  "guideline_source": "fonte das guidelines usadas (ex: 'ESC 2023, ADA 2024')",
  "study_mnemonic": "mnemónica útil para memorizar a terapêutica, se existir — null se não aplicável",
  "exam_pearls": [
    "dica de exame específica sobre esta patologia/tratamento — padrão de pergunta + resposta"
  ]
}

Regras:
- Máximo 3 fármacos de 1ª linha (os mais importantes)
- Máximo 4 de 2ª linha
- Máximo 3 de "avoid" — só os mais importantes
- As doses devem ser reais e específicas
- exam_pearls: mínimo 3 dicas reais que saem em exames
- Adapta sempre ao contexto fornecido${context ? ` (contexto: ${context})` : ''}
- Para patologias com múltiplas fases (ex: IC: estável vs descompensada), foca na fase mais comum/importante para estudo`,
      },
      { role: 'user', content: `Tratamento farmacológico: ${disease}${context ? ` — contexto: ${context}` : ''}` },
    ], { maxTokens: 2000, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}