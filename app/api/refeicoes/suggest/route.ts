// app/api/refeicoes/suggest/route.ts
// Sugestão semanal de refeições — a IA escolhe pratos da BIBLIOTECA JÁ
// EXISTENTE (nunca inventa um prato novo) respeitando alergias/textura/dieta
// agregadas de quem frequenta o centro, mais uma pista de orçamento opcional.
// A equipa revê e ajusta a grelha antes de guardar — nada é gravado sozinho.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

const MEAL_TYPES = ['pequeno_almoco', 'almoco', 'lanche', 'jantar']
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

interface Dish { id: string; name: string; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string }
interface Assignment { weekday: number; meal_type: string; dish_id: string | null }

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 8, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    dishes?: Dish[]
    avoidAllergens?: string[]
    neededTextures?: string[]
    neededDietTags?: string[]
    budgetHint?: string
  } | null
  if (!body || !Array.isArray(body.dishes) || body.dishes.length === 0) {
    return NextResponse.json({ error: 'A biblioteca de pratos está vazia — adiciona pratos primeiro.' }, { status: 400 })
  }
  const dishById = new Map(body.dishes.map(d => [d.id, d]))
  const dishList = body.dishes.map(d => `- id:${d.id} | ${d.name} | refeições: ${(d.meal_types || ['qualquer']).join(',')} | alergénios: ${(d.allergens || []).join(',') || 'nenhum'} | textura: ${d.texture || 'normal'} | dieta: ${(d.diet_tags || []).join(',') || 'nenhuma'} | custo: ${d.cost_tier}`).join('\n')

  try {
    const out = await aiJSON<{ assignments: Assignment[] }>([
      {
        role: 'system',
        content: `És um assistente que ajuda a cozinha de um centro de dia/lar a planear o cardápio da semana. REGRA ABSOLUTA: só podes escolher pratos pelo "id" EXATO listado abaixo — nunca inventes um prato novo nem um id que não esteja na lista. Se nenhum prato da lista servir para um horário (por causa de alergénios/textura/dieta), usa dish_id null nesse horário em vez de forçar um prato inadequado.
Restrições a respeitar em TODOS os pratos escolhidos:
- Alergénios a EVITAR sempre: ${body.avoidAllergens?.length ? body.avoidAllergens.join(', ') : 'nenhum registado'}
- Texturas necessárias na casa (escolhe pratos compatíveis quando existirem): ${body.neededTextures?.length ? body.neededTextures.join(', ') : 'sem restrição'}
- Tipos de dieta necessários: ${body.neededDietTags?.length ? body.neededDietTags.join(', ') : 'sem restrição'}
${body.budgetHint?.trim() ? `- Pista de orçamento (preferência, não obrigatório): ${body.budgetHint.trim()}` : ''}
Varia os pratos ao longo da semana (não repitas o mesmo prato em dias seguidos, quando a biblioteca tiver alternativas).
Biblioteca de pratos disponível:
${dishList}
Responde EXCLUSIVAMENTE em JSON: {"assignments":[{"weekday":0-6,"meal_type":"pequeno_almoco|almoco|lanche|jantar","dish_id":"id da lista ou null"}]} — um item por cada combinação de dia (0=domingo..6=sábado) × refeição (${MEAL_TYPES.join(',')}), ${WEEKDAYS.length * MEAL_TYPES.length} itens no total.`,
      },
      { role: 'user', content: 'Sugere o cardápio da semana.' },
    ], { maxTokens: 2000, temperature: 0.4 })

    // Rede de segurança: descarta qualquer dish_id que não esteja mesmo na
    // biblioteca enviada — nunca confiar cegamente no que a IA devolveu.
    const safe = (out.assignments || [])
      .filter(a => WEEKDAYS.includes(a.weekday) && MEAL_TYPES.includes(a.meal_type))
      .map(a => ({ ...a, dish_id: a.dish_id && dishById.has(a.dish_id) ? a.dish_id : null }))

    return NextResponse.json({ assignments: safe })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível sugerir agora.' }, { status: 500 })
  }
}
