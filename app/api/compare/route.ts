import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 15, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.drug_a || !body?.drug_b) return NextResponse.json({ error: 'Dois fármacos obrigatórios' }, { status: 400 })

  const drug_a = String(body.drug_a).trim().slice(0, 80)
  const drug_b = String(body.drug_b).trim().slice(0, 80)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico e professor universitário a comparar dois fármacos para estudantes de medicina, farmácia ou enfermagem. Responde em português europeu (PT-PT).

Responde APENAS com JSON válido sem markdown:
{
  "drug_a": "nome DCI correcto do fármaco A",
  "drug_b": "nome DCI correcto do fármaco B",
  "class": "classe farmacológica comum ou relação entre os dois",
  "comparison": [
    {
      "category": "categoria comparada (ex: 'Mecanismo', 'Potência', 'Semivida', 'Selectividade', 'Efeitos adversos', 'Interacções', 'Farmacocinética', 'Uso na DRC', 'Gravidez')",
      "drug_a": "característica do fármaco A nesta categoria — concreto e específico",
      "drug_b": "característica do fármaco B nesta categoria — concreto e específico",
      "winner": "A" | "B" | "igual" | "depende",
      "note": "nota clínica importante — null se não necessário"
    }
  ],
  "when_to_prefer_a": ["situação clínica concreta onde A é melhor escolha"],
  "when_to_prefer_b": ["situação clínica concreta onde B é melhor escolha"],
  "clinical_pearl": "o insight mais importante desta comparação — o que um clínico experiente sabe e um estudante não — 1-2 frases directas",
  "exam_tip": "o que costuma sair nos exames sobre esta comparação — padrão de pergunta típico e resposta"
}

Regras:
- Mínimo 8 categorias de comparação relevantes para estes dois fármacos específicos
- Sê específico com números quando possível (ex: semivida exacta, potência relativa)
- winner deve reflectir genuinamente qual é melhor nessa categoria — não "depende" para tudo
- clinical_pearl deve ser o tipo de conhecimento que distingue um bom clínico
- exam_tip deve referir o padrão real de pergunta de exame
- Se os fármacos não são comparáveis (classes diferentes sem relação), diz isso claramente em "class"`,
      },
      { role: 'user', content: `Compara: ${drug_a} vs ${drug_b}` },
    ], { maxTokens: 2000, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}