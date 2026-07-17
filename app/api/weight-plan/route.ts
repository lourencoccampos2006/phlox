import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Plano de Perda de Peso — Pro, ligado ao Objetivo de Saúde "lose_weight".
// Contextualizado à medicação/condições REAIS da pessoa: um plano genérico de
// dieta+exercício não sabe que um beta-bloqueador baixa a FC máxima (zonas de
// FC ficam erradas), que insulina/sulfonilureia pedem cuidado com hipoglicemia
// no exercício, ou que um diurético mexe no peso da balança sem ser gordura.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 5, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Plano de Perda de Peso')

  const body = await req.json().catch(() => null)
  const { medications, conditions, age, sex, current_weight, target_note, weight_trend } = body || {}
  if (!medications?.trim() && !conditions?.trim()) {
    return NextResponse.json({ error: 'Indica pelo menos a medicação ou as condições — o plano tem de ser sobre ti.' }, { status: 400 })
  }

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um nutricionista clínico e fisiologista do exercício a criar um plano de perda de peso PERSONALIZADO — não um template genérico. O plano tem de ter em conta a medicação e condições reais da pessoa: efeitos na frequência cardíaca (beta-bloqueadores), risco de hipoglicemia no exercício (insulina/sulfonilureias), retenção/perda de líquidos que confunde a balança (diuréticos, corticoides), e qualquer contraindicação relevante.

Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "summary": "1-2 frases: meta realista para esta pessoa, adaptada à idade/peso/condições",
  "weekly_calorie_target": número (kcal/dia, défice moderado e seguro),
  "macro_split": { "protein_g": número, "carbs_g": número, "fat_g": número },
  "meal_plan": [ { "meal": "Pequeno-almoço|Almoço|Lanche|Jantar", "suggestion": "sugestão concreta e simples", "note": "nota opcional ligada à medicação real, ex: 'toma a metformina com esta refeição para reduzir náuseas'" } ],
  "exercise_plan": [ { "day": "Segunda|Terça|...", "activity": "atividade concreta e realista", "intensity": "leve|moderada|vigorosa", "caution": "aviso opcional ESPECÍFICO da medicação/condição desta pessoa" } ],
  "medication_considerations": [ { "medication": "nome do fármaco real da lista", "consideration": "o que isto muda no plano de perda de peso (ex: hipoglicemia, FC, retenção de líquidos)" } ],
  "weekly_milestones": ["semana 1: ...", "semana 2: ...", "semana 3: ...", "semana 4: ..."],
  "red_flags": ["sinal que exige parar e falar com o médico, específico desta combinação"],
  "disclaimer": "aviso curto: apoio informativo, não substitui nutricionista/médico"
}`,
    },
    {
      role: 'user',
      content: `Pessoa: ${age ? age + ' anos' : 'idade não indicada'}, ${sex || 'sexo não indicado'}.
Peso atual: ${current_weight ? current_weight + ' kg' : 'não indicado'}.
Tendência de peso recente: ${weight_trend || 'sem dados suficientes'}.
Medicação atual: ${medications?.trim() || 'nenhuma registada'}.
Condições/diagnósticos: ${conditions?.trim() || 'nenhuma registada'}.
Nota da pessoa sobre o objetivo: ${target_note?.trim() || 'sem nota adicional — objetivo geral de perder peso de forma sustentável'}.`,
    },
  ], { maxTokens: 1400, temperature: 0.4 })

  return NextResponse.json(result)
}
