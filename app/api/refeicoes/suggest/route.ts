// app/api/refeicoes/suggest/route.ts
// Sugestão semanal de refeições. Duas fontes possíveis por horário: um prato
// JÁ EXISTENTE na biblioteca (id sempre validado contra a lista real enviada,
// nunca confiado às cegas) OU um prato NOVO proposto pela IA quando a
// biblioteca está vazia, curta, ou nada nela serve para aquele horário —
// 2026-08-07: antes a IA só podia escolher da biblioteca, por isso com uma
// biblioteca vazia a sugestão simplesmente não funcionava. Pratos novos vêm
// sempre como PROPOSTA (nunca gravados sozinhos) e a equipa revê/edita antes
// de aplicar — ao aplicar é que ficam realmente na biblioteca.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

const MEAL_TYPES = ['pequeno_almoco', 'almoco', 'lanche', 'jantar']
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
const TEXTURES = ['Normal', 'Mole', 'Triturada', 'Liquidificada', 'Pastosa', 'Picada']
const DIET_TAGS = ['Normal', 'Hipossódica', 'Hipoglicídica', 'Hipoproteica', 'Hipercalórica', 'Vegetariana', 'Diabética']
const COST_TIERS = ['baixo', 'medio', 'alto']

interface Dish { id: string; name: string; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string }
interface NewDish { temp_id: string; name: string; meal_types?: string[] | null; allergens?: string[] | null; texture?: string | null; diet_tags?: string[] | null; cost_tier?: string }
interface Assignment { weekday: number; meal_type: string; dish_id?: string | null; new_dish_temp_id?: string | null }

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
  if (!body) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })

  const dishes = Array.isArray(body.dishes) ? body.dishes : []
  const dishById = new Map(dishes.map(d => [d.id, d]))
  const dishList = dishes.length
    ? dishes.map(d => `- id:${d.id} | ${d.name} | refeições: ${(d.meal_types || ['qualquer']).join(',')} | alergénios: ${(d.allergens || []).join(',') || 'nenhum'} | textura: ${d.texture || 'normal'} | dieta: ${(d.diet_tags || []).join(',') || 'nenhuma'} | custo: ${d.cost_tier}`).join('\n')
    : '(vazia — ainda não há nenhum prato registado)'
  const avoidAllergens = (body.avoidAllergens || []).map(a => a.toLowerCase().trim()).filter(Boolean)

  try {
    const out = await aiJSON<{ newDishes: NewDish[]; assignments: Assignment[] }>([
      {
        role: 'system',
        content: `És um assistente que ajuda a cozinha de um centro de dia/lar português a planear o cardápio da semana.

Tens DUAS formas de preencher cada horário:
1. Escolher um prato pelo "id" EXATO da biblioteca abaixo (nunca inventes um id que não esteja na lista).
2. Se a biblioteca estiver vazia, curta, ou nada nela servir para esse horário/restrição, PROPÕE um prato novo, realista da cozinha portuguesa (nome concreto, ex: "Sopa de legumes", "Bacalhau com natas", "Salada de fruta") — dá-lhe um "temp_id" curto (ex: "n1","n2") e inclui-o em "newDishes", depois referencia-o em "assignments" por "new_dish_temp_id" (deixa "dish_id" a null nesse caso).

Nunca uses os dois ao mesmo tempo no mesmo horário — ou "dish_id" ou "new_dish_temp_id", nunca ambos.

Restrições a respeitar em TODOS os pratos (existentes ou novos):
- Alergénios a EVITAR sempre — em pratos novos, lista SEMPRE em "allergens" qualquer alergénio real do prato: ${avoidAllergens.length ? avoidAllergens.join(', ') : 'nenhum registado'}
- Texturas necessárias na casa (usa quando fizer sentido): ${body.neededTextures?.length ? body.neededTextures.join(', ') : 'sem restrição'}
- Tipos de dieta necessários: ${body.neededDietTags?.length ? body.neededDietTags.join(', ') : 'sem restrição'}
${body.budgetHint?.trim() ? `- Orçamento / outras instruções da equipa (respeita tudo o que pedirem aqui): ${body.budgetHint.trim()}` : ''}

Para pratos novos, "texture" tem de ser um destes: ${TEXTURES.join(', ')}. "diet_tags" só destes: ${DIET_TAGS.join(', ')}. "cost_tier" só um destes: ${COST_TIERS.join(', ')}.
Varia os pratos ao longo da semana (não repitas o mesmo prato em dias seguidos).
Biblioteca de pratos disponível:
${dishList}
Responde EXCLUSIVAMENTE em JSON: {"newDishes":[{"temp_id":"n1","name":"...","meal_types":["almoco"],"allergens":[],"texture":"Normal","diet_tags":[],"cost_tier":"medio"}],"assignments":[{"weekday":0-6,"meal_type":"pequeno_almoco|almoco|lanche|jantar","dish_id":"id da lista ou null","new_dish_temp_id":"temp_id ou null"}]} — um item de assignment por cada combinação de dia (0=domingo..6=sábado) × refeição (${MEAL_TYPES.join(',')}), ${WEEKDAYS.length * MEAL_TYPES.length} itens no total.`,
      },
      { role: 'user', content: 'Sugere o cardápio da semana.' },
    ], { maxTokens: 3000, temperature: 0.5 })

    // Rede de segurança para pratos NOVOS: estrutura válida + nunca um
    // alergénio a evitar listado nos próprios allergens do prato (se a IA
    // marcou-o corretamente, isto apanha-o; nunca confiar cegamente).
    const newDishesRaw = Array.isArray(out.newDishes) ? out.newDishes : []
    const seenTempIds = new Set<string>()
    const safeNewDishes = newDishesRaw
      .filter(d => d && typeof d.name === 'string' && d.name.trim() && typeof d.temp_id === 'string' && d.temp_id.trim())
      .filter(d => !seenTempIds.has(d.temp_id) && seenTempIds.add(d.temp_id))
      .map(d => ({
        temp_id: d.temp_id,
        name: d.name.trim().slice(0, 120),
        meal_types: Array.isArray(d.meal_types) ? d.meal_types.filter(m => MEAL_TYPES.includes(m)) : null,
        allergens: Array.isArray(d.allergens) ? d.allergens.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()) : null,
        texture: d.texture && TEXTURES.includes(d.texture) ? d.texture : 'Normal',
        diet_tags: Array.isArray(d.diet_tags) ? d.diet_tags.filter(t => DIET_TAGS.includes(t)) : null,
        cost_tier: d.cost_tier && COST_TIERS.includes(d.cost_tier) ? d.cost_tier : 'medio',
      }))
      .filter(d => !(d.allergens || []).some(a => avoidAllergens.includes(a.toLowerCase())))
    const newDishByTempId = new Map(safeNewDishes.map(d => [d.temp_id, d]))

    // Rede de segurança para assignments: dish_id tem de estar mesmo na
    // biblioteca enviada; new_dish_temp_id tem de referenciar um prato novo
    // que sobreviveu à validação acima. Nunca os dois ao mesmo tempo.
    const safeAssignments = (out.assignments || [])
      .filter(a => WEEKDAYS.includes(a.weekday) && MEAL_TYPES.includes(a.meal_type))
      .map(a => {
        if (a.dish_id && dishById.has(a.dish_id)) return { weekday: a.weekday, meal_type: a.meal_type, dish_id: a.dish_id, new_dish_temp_id: null }
        if (a.new_dish_temp_id && newDishByTempId.has(a.new_dish_temp_id)) return { weekday: a.weekday, meal_type: a.meal_type, dish_id: null, new_dish_temp_id: a.new_dish_temp_id }
        return { weekday: a.weekday, meal_type: a.meal_type, dish_id: null, new_dish_temp_id: null }
      })

    return NextResponse.json({ assignments: safeAssignments, newDishes: safeNewDishes })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível sugerir agora.' }, { status: 500 })
  }
}
