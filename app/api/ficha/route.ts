import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Ficha de Fármaco')

  const body = await req.json().catch(() => null)
  if (!body?.drug) return NextResponse.json({ error: 'Fármaco obrigatório' }, { status: 400 })

  const drug = String(body.drug).trim()

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacologista clínico e pedagogo. Crias fichas de estudo completas sobre fármacos para estudantes de farmácia e medicina em Portugal. Responde APENAS com JSON válido, sem markdown. Língua: português europeu (PT-PT).

JSON esperado:
{
  "drug_name": "nome comum em PT",
  "dci": "denominação comum internacional",
  "class": "classe farmacológica",
  "mechanism": {
    "simple": "mecanismo em 2-3 frases claras",
    "analogy": "analogia criativa que facilita memorização"
  },
  "indications": ["indicação 1", "indicação 2"],
  "adverse_effects": [
    { "effect": "nome do efeito", "severity": "grave|moderado|ligeiro", "frequency": "muito frequente|frequente|pouco frequente" }
  ],
  "mnemonic": {
    "word": "PALAVRA MNEMÓNICA",
    "letters": [{ "letter": "P", "meaning": "significado do efeito adverso" }]
  },
  "key_interactions": [
    { "drug": "nome do fármaco", "effect": "consequência clínica como frase curta", "mechanism": "mecanismo da interação" }
  ],
  "pharmacokinetics": {
    "absorption": "texto",
    "half_life": "texto",
    "elimination": "texto",
    "notes": "nota clínica relevante"
  },
  "monitoring": ["parâmetro a monitorizar 1", "parâmetro 2"],
  "clinical_pearl": "pearl clínico surpreendente e útil",
  "quiz": [
    { "question": "pergunta", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "explicação da resposta correcta" }
  ]
}

Regras:
- adverse_effects: lista os 5-8 mais importantes
- mnemonic: cria uma palavra com as iniciais dos efeitos adversos principais
- key_interactions: as 3-5 mais clinicamente relevantes
- quiz: exactamente 3 perguntas de escolha múltipla, correct é o índice (0-3)
- clinical_pearl: algo surpreendente que os livros normalmente não destacam`,
    },
    { role: 'user', content: `Cria a ficha completa de: ${drug}` },
  ], { maxTokens: 3000, temperature: 0.3 })

  return NextResponse.json(result)
}