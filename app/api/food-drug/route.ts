import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

interface FoodDrugInteraction {
  food: string
  drug: string
  severity: 'grave' | 'moderada' | 'ligeira' | 'sem_interacao'
  mechanism: string
  effect: string
  advice: string
  timing: string | null
}

interface FoodDrugResponse {
  interactions: FoodDrugInteraction[]
  summary: string
  safe_foods: string[]
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (checkRateLimit(ip, 10, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: { drugs: string[]; foods: string[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  const { drugs, foods } = body
  if (!drugs?.length) return NextResponse.json({ error: 'Lista de medicamentos em falta' }, { status: 400 })
  if (!foods?.length) return NextResponse.json({ error: 'Lista de alimentos em falta' }, { status: 400 })

  const drugList = drugs.slice(0, 15).join(', ')
  const foodList = foods.slice(0, 10).join(', ')

  const prompt = `És um farmacologista clínico especialista em interações fármaco-alimento.

MEDICAMENTOS: ${drugList}
ALIMENTOS/BEBIDAS: ${foodList}

Analisa cada combinação fármaco-alimento e devolve um objecto JSON:
{
  "interactions": [
    {
      "food": "nome do alimento",
      "drug": "nome do medicamento",
      "severity": "grave" | "moderada" | "ligeira" | "sem_interacao",
      "mechanism": "mecanismo farmacológico em 1 frase simples",
      "effect": "o que acontece clinicamente (max 1 frase)",
      "advice": "o que fazer — evitar totalmente / separar X horas / tomar com cuidado / sem problema",
      "timing": "separar X horas antes/depois" ou null se não aplicável
    }
  ],
  "summary": "resumo geral em PT-PT (2 frases, linguagem simples)",
  "safe_foods": ["lista de alimentos da lista que são seguros com TODOS os medicamentos"]
}

Regras:
- Só inclui interações com severity ≥ ligeira
- Se não há interação significativa entre food+drug, não incluas essa combinação
- Exemplos reais: toranja+estatinas (grave, inibe CYP3A4), álcool+metronidazol (grave, reação tipo dissulfiram), álcool+paracetamol (moderada, hepatotoxicidade), leite+ciprofloxacina (moderada, quelação), vitamina K alimentos+varfarina (grave, antagonismo), tiramina+IMAOs (grave, crise hipertensiva), cafeína+teofilina (moderada, toxicidade), fibra+levotiroxina (moderada, absorção)
- Responde APENAS JSON sem markdown`

  try {
    const result = await aiJSON<FoodDrugResponse>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1200 }
    )
    const safe: FoodDrugResponse = {
      interactions: (Array.isArray(result?.interactions) ? result.interactions : [])
        .slice(0, 20)
        .filter((i: any) => i?.food && i?.drug)
        .map((i: any) => ({
          food: String(i.food).slice(0, 80),
          drug: String(i.drug).slice(0, 80),
          severity: ['grave', 'moderada', 'ligeira', 'sem_interacao'].includes(i.severity) ? i.severity : 'ligeira',
          mechanism: String(i.mechanism || '').slice(0, 300),
          effect: String(i.effect || '').slice(0, 300),
          advice: String(i.advice || '').slice(0, 300),
          timing: i.timing ? String(i.timing).slice(0, 100) : null,
        })),
      summary: String(result?.summary || '').slice(0, 500),
      safe_foods: Array.isArray(result?.safe_foods) ? result.safe_foods.map((f: any) => String(f).slice(0, 60)) : [],
    }
    return NextResponse.json(safe)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro na análise' }, { status: 500 })
  }
}
