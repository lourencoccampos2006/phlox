// app/api/refeicoes/suggest/route.ts
// Ementa da semana proposta pela IA.
//
// ── O QUE ESTAVA MAL (2026-09-05) ──────────────────────────────────────────
// 1. `maxTokens: 3000` para 28 horários × até 3 momentos + os pratos novos.
//    A resposta era cortada a meio e chegava cá com um prato só — parecia que
//    a IA tinha "deixado de funcionar". O limite passa a 8000 e o formato de
//    saída ficou muito mais curto (chaves de uma letra em vez de objetos
//    verbosos), o que sozinho corta a resposta para menos de metade.
// 2. As instruções da equipa iam enterradas numa linha do meio do prompt de
//    sistema, e a mensagem do utilizador era um "Sugere o cardápio da semana."
//    fixo. Um modelo dá muito mais peso ao que vem na mensagem do utilizador —
//    era por isso que o que o Fernando escrevia era ignorado. Agora o que a
//    equipa pede É a mensagem do utilizador, e é repetido como regra dura.
// 3. Uma refeição tem momentos: sopa, prato, sobremesa. Só havia um prato por
//    horário, por isso "sopa de legumes + bacalhau com natas" era impossível.
//
// Continua a valer a regra de sempre: nada é gravado por esta rota. Os pratos
// novos vêm como PROPOSTA e só entram na biblioteca quando a equipa aplica.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

const MEAL_TYPES = ['pequeno_almoco', 'almoco', 'lanche', 'jantar']
const COURSES = ['sopa', 'prato', 'sobremesa']
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]
const TEXTURES = ['Normal', 'Mole', 'Triturada', 'Liquidificada', 'Pastosa', 'Picada']
const DIET_TAGS = ['Normal', 'Hipossódica', 'Hipoglicídica', 'Hipoproteica', 'Hipercalórica', 'Vegetariana', 'Diabética']
const COST_TIERS = ['baixo', 'medio', 'alto']

/** Que momentos fazem sentido em cada refeição. Um lanche não leva sopa. */
const MOMENTOS: Record<string, string[]> = {
  pequeno_almoco: ['prato'],
  almoco: ['sopa', 'prato', 'sobremesa'],
  lanche: ['prato'],
  jantar: ['sopa', 'prato', 'sobremesa'],
}

interface Dish { id: string; name: string; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string; course?: string | null }
interface NewDish { temp_id: string; name: string; meal_types?: string[] | null; allergens?: string[] | null; texture?: string | null; diet_tags?: string[] | null; cost_tier?: string; course?: string | null }

// Formato compacto de saída: `d` dia, `m` refeição, `c` momento, `i` id da
// biblioteca, `n` temp_id de prato novo. Cabe em muito menos tokens do que
// {"weekday":..,"meal_type":"..","dish_id":".."} repetido setenta vezes.
interface Slot { d: number; m: string; c: string; i?: string | null; n?: string | null }

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
    ? dishes.map(d => `${d.id}|${d.name}|${d.course || '?'}|${(d.meal_types || ['*']).join(',')}|alerg:${(d.allergens || []).join(',') || '-'}|text:${d.texture || 'Normal'}|dieta:${(d.diet_tags || []).join(',') || '-'}|€${d.cost_tier}`).join('\n')
    : '(vazia — ainda não há nenhum prato registado)'
  const avoidAllergens = (body.avoidAllergens || []).map(a => a.toLowerCase().trim()).filter(Boolean)
  const pedido = (body.budgetHint || '').trim()

  const totalSlots = WEEKDAYS.length * Object.values(MOMENTOS).reduce((s, m) => s + m.length, 0)

  try {
    const out = await aiJSON<{ newDishes: NewDish[]; slots: Slot[] }>([
      {
        role: 'system',
        content: `És o/a responsável pela cozinha de um centro de dia / lar em Portugal. Planeias a ementa da SEMANA INTEIRA.

MOMENTOS DE CADA REFEIÇÃO (respeita exatamente):
- pequeno_almoco → prato
- almoco → sopa, prato, sobremesa
- lanche → prato
- jantar → sopa, prato, sobremesa
São ${totalSlots} lugares a preencher (7 dias × os momentos acima). Preenche-os TODOS.

DUAS FORMAS de preencher cada lugar:
1. "i" = o id EXATO de um prato da biblioteca abaixo (nunca inventes um id).
2. "n" = o temp_id de um prato NOVO que propões (quando a biblioteca não tem
   nada que sirva). Declara-o em "newDishes" com temp_id curto ("n1","n2"…).
Nunca uses "i" e "n" no mesmo lugar.

REGRAS DE COZINHA:
- Cozinha portuguesa real e concreta ("Sopa de nabiças", "Bacalhau à Braz",
  "Arroz doce"), nunca genérico ("Sopa", "Carne").
- Sopa é sopa, prato é prato, sobremesa é sobremesa. Não trocar.
- Não repetir o mesmo prato em dias seguidos, nem a mesma sopa duas vezes na semana.
- Peixe e carne alternados ao longo da semana.

RESTRIÇÕES DA CASA (obrigatórias):
- Alergénios a evitar em absoluto: ${avoidAllergens.length ? avoidAllergens.join(', ') : 'nenhum registado'}
- Texturas necessárias: ${body.neededTextures?.length ? body.neededTextures.join(', ') : 'sem restrição'}
- Dietas necessárias: ${body.neededDietTags?.length ? body.neededDietTags.join(', ') : 'sem restrição'}

Em pratos novos: "texture" só de [${TEXTURES.join(', ')}]; "diet_tags" só de [${DIET_TAGS.join(', ')}]; "cost_tier" só de [${COST_TIERS.join(', ')}]; "course" só de [${COURSES.join(', ')}].

BIBLIOTECA (id|nome|momento|refeições|alergénios|textura|dieta|custo):
${dishList}

RESPONDE SÓ COM JSON, neste formato compacto:
{"newDishes":[{"temp_id":"n1","name":"Sopa de nabiças","course":"sopa","meal_types":["almoco","jantar"],"allergens":[],"texture":"Normal","diet_tags":[],"cost_tier":"baixo"}],
 "slots":[{"d":0,"m":"almoco","c":"sopa","i":null,"n":"n1"}]}
d = dia (0=domingo … 6=sábado). m = refeição. c = momento.`,
      },
      {
        // O que a equipa escreveu vai AQUI, na mensagem do utilizador, e não
        // enterrado no prompt de sistema — é a diferença entre ser respeitado
        // e ser ignorado.
        role: 'user',
        content: pedido
          ? `Planeia a ementa da semana inteira. Instruções da equipa, a cumprir à risca:\n\n${pedido}`
          : 'Planeia a ementa da semana inteira.',
      },
    ], { maxTokens: 8000, temperature: 0.6 })

    // ── Rede de segurança dos pratos novos ────────────────────────────────
    const newDishesRaw = Array.isArray(out.newDishes) ? out.newDishes : []
    const vistos = new Set<string>()
    const safeNewDishes = newDishesRaw
      .filter(d => d && typeof d.name === 'string' && d.name.trim() && typeof d.temp_id === 'string' && d.temp_id.trim())
      .filter(d => !vistos.has(d.temp_id) && vistos.add(d.temp_id))
      .map(d => ({
        temp_id: d.temp_id,
        name: d.name.trim().slice(0, 120),
        course: d.course && COURSES.includes(d.course) ? d.course : 'prato',
        meal_types: Array.isArray(d.meal_types) ? d.meal_types.filter(m => MEAL_TYPES.includes(m)) : null,
        allergens: Array.isArray(d.allergens) ? d.allergens.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()) : null,
        texture: d.texture && TEXTURES.includes(d.texture) ? d.texture : 'Normal',
        diet_tags: Array.isArray(d.diet_tags) ? d.diet_tags.filter(t => DIET_TAGS.includes(t)) : null,
        cost_tier: d.cost_tier && COST_TIERS.includes(d.cost_tier) ? d.cost_tier : 'medio',
      }))
      // Um prato que a própria IA marcou com um alergénio proibido não entra.
      .filter(d => !(d.allergens || []).some(a => avoidAllergens.includes(a.toLowerCase())))
    const novoPorTempId = new Map(safeNewDishes.map(d => [d.temp_id, d]))

    // ── Rede de segurança dos lugares ─────────────────────────────────────
    // O id tem de existir mesmo na biblioteca enviada; o temp_id tem de
    // referenciar um prato novo que sobreviveu à validação acima.
    const safeSlots = (out.slots || [])
      .filter(s => s && WEEKDAYS.includes(s.d) && MEAL_TYPES.includes(s.m) && (MOMENTOS[s.m] || []).includes(s.c))
      .map(s => {
        if (s.i && dishById.has(s.i)) return { weekday: s.d, meal_type: s.m, course: s.c, dish_id: s.i, new_dish_temp_id: null }
        if (s.n && novoPorTempId.has(s.n)) return { weekday: s.d, meal_type: s.m, course: s.c, dish_id: null, new_dish_temp_id: s.n }
        return null
      })
      .filter(Boolean) as { weekday: number; meal_type: string; course: string; dish_id: string | null; new_dish_temp_id: string | null }[]

    // Um lugar por combinação: se a IA repetir, fica o primeiro.
    const unico = new Map<string, typeof safeSlots[number]>()
    safeSlots.forEach(s => { const k = `${s.weekday}|${s.meal_type}|${s.course}`; if (!unico.has(k)) unico.set(k, s) })

    return NextResponse.json({
      assignments: [...unico.values()],
      newDishes: safeNewDishes,
      esperados: totalSlots,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Não foi possível sugerir agora.' }, { status: 500 })
  }
}
