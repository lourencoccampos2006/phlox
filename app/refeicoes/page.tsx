'use client'

// /refeicoes — RECONSTRUÍDO 2026-08-07 (auditoria: a versão anterior era um
// registo de "quanto cada pessoa comeu por refeição" — isso já existe em
// /care-log. O que faltava de facto, nas palavras do Fernando: uma ferramenta
// INTERNA para a cozinha organizar as refeições da semana com antecedência,
// com a IA a ajudar a escolher pratos respeitando alergias/orçamento.
//
// Duas peças: 1) biblioteca de pratos reutilizável (nome, alergénios, textura,
// tipo de dieta, custo) — 2) grelha semanal (dia × refeição → prato), com um
// botão que pede à IA uma proposta para a semana toda, escolhendo SÓ da
// biblioteca (nunca inventa pratos), respeitando as alergias/texturas/dietas
// REAIS de quem frequenta o centro (patients.allergies + care_plans.diet_*).
// A proposta fica pendente até a equipa a rever e aplicar — nada se grava só.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import { evaluateVital } from '@/lib/vitalRanges'
import EscolherPrato from './EscolherPrato'
import { useOrgName } from '@/lib/useOrgName'
import { imprimirDia, imprimirSemana, imprimirMes, type LinhaEmenta } from './imprimirEmenta'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { ptDate } from '@/lib/ptTime'

interface Dish { id: string; name: string; category?: string | null; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string; course?: string | null }
interface NewDish { temp_id: string; name: string; category?: string | null; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string; course?: string | null }
interface Entry { id: string; date: string; meal_type: string; course: string; dish_id: string | null; dish_name_free: string | null }
interface CarePlan { patient_id: string; diet_type?: string | null; diet_texture?: string | null }
interface Patient { id: string; allergies: string | null }

const MEAL_TYPES: { id: string; label: string }[] = [
  { id: 'pequeno_almoco', label: 'Pequeno-almoço' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
]
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const CAT_LABEL: Record<string, string> = {
  sopa: 'Sopas', carne: 'Carne', peixe: 'Peixe', vegetariano: 'Vegetariano',
  doce: 'Doces', fruta: 'Fruta', outro: 'Outros',
}
/** Uma sopa é sempre entrada, uma sobremesa é sempre doce ou fruta. */
const COURSE_DE_CAT: Record<string, string> = { sopa: 'sopa', doce: 'sobremesa', fruta: 'sobremesa' }

const chipCat = (on: boolean): React.CSSProperties => ({
  minHeight: 'var(--alvo)', padding: '0 10px', borderRadius: 'var(--r-xl)',
  border: `1px solid ${on ? 'var(--ink)' : 'var(--border-2)'}`,
  background: on ? 'var(--ink)' : 'var(--bg)', color: on ? 'var(--bg)' : 'var(--ink-4)',
  fontFamily: 'inherit', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer',
})

// Uma refeição tem momentos. Um lanche não leva sopa, e um almoço sem sopa
// não é como as ementas cá se escrevem.
const COURSES: { id: string; label: string; curto: string }[] = [
  { id: 'sopa', label: 'Sopa', curto: 'Sopa' },
  { id: 'prato', label: 'Prato principal', curto: 'Prato' },
  { id: 'sobremesa', label: 'Sobremesa', curto: 'Sobremesa' },
]
const MOMENTOS: Record<string, string[]> = {
  pequeno_almoco: ['prato'],
  almoco: ['sopa', 'prato', 'sobremesa'],
  lanche: ['prato'],
  jantar: ['sopa', 'prato', 'sobremesa'],
}
const TEXTURES = ['Normal', 'Mole', 'Triturada', 'Liquidificada', 'Pastosa', 'Picada']
const DIET_TAGS = ['Normal', 'Hipossódica', 'Hipoglicídica', 'Hipoproteica', 'Hipercalórica', 'Vegetariana', 'Diabética']
const COST_TIERS: { id: string; label: string }[] = [{ id: 'baixo', label: '€ Baixo' }, { id: 'medio', label: '€€ Médio' }, { id: 'alto', label: '€€€ Alto' }]

function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
/* ACHADO, 2026-10-08, ao ver o verde do «hoje» cair na SEXTA numa quinta-feira.
   Era `d.toISOString().slice(0, 10)`. As datas da semana nascem à meia-noite
   LOCAL; em Lisboa no verão isso é 23:00 UTC do dia ANTERIOR, e o
   `toISOString()` devolvia esse dia anterior. A grelha inteira andava um dia
   para trás: a ementa de terça gravava-se como segunda, e o «Imprimir dia»
   mandava para a cozinha o menu do dia errado. */
function fmtDate(d: Date) { return ptDate(d) }

import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function RefeicoesPage() {
  /* A coluna da esquerda não sai do ecrã quando a grelha rola na horizontal. */
  const PRESA: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1 }
  const hoje = ptDate()
  const largo = useLargo()
  /* Três vistas, em vez de duas camadas por cima da ementa. A biblioteca e o
     reforço abriam SOBRE a ementa — e com as duas abertas, a ementa (que é a
     razão de a página existir) ficava a 900px de rolar do topo. */
  const [vista, setVista] = useState<'ementa' | 'biblioteca' | 'reforco'>('ementa')
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('registos', 'editar')
  const toast = useToast()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }), [weekStart])

  const [dishes, setDishes] = useState<Dish[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [carePlans, setCarePlans] = useState<CarePlan[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showLibrary, setShowLibrary] = useState(false)
  // A biblioteca era uma lista corrida por ordem de criação. Com cem pratos,
  // encontrar um era impossível e ninguém sabia o que já lá estava — o que
  // levava a criar duplicados. Agora tem pesquisa e agrupa por categoria.
  const [buscaLib, setBuscaLib] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [aArrumar, setAArrumar] = useState(false)
  const [showReinforcement, setShowReinforcement] = useState(false)

  // Novo prato
  const [newName, setNewName] = useState('')
  const [newMealTypes, setNewMealTypes] = useState<string[]>([])
  const [newAllergens, setNewAllergens] = useState('')
  const [newTexture, setNewTexture] = useState('Normal')
  const [newDietTags, setNewDietTags] = useState<string[]>([])
  const [newCost, setNewCost] = useState('medio')
  const [savingDish, setSavingDish] = useState(false)

  // Sugestão IA
  const [instructions, setInstructions] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestErr, setSuggestErr] = useState('')
  // chave `${date}|${meal_type}` — NUNCA '_': meal_type já tem '_' dentro
  // (ex: "pequeno_almoco"), um separador '_' torna o key.split ambíguo.
  const [proposal, setProposal] = useState<Record<string, { dishId: string | null; newDishTempId: string | null }> | null>(null)
  const [proposedNewDishes, setProposedNewDishes] = useState<NewDish[]>([])
  const [applying, setApplying] = useState(false)

  // ── Imprimir a ementa ────────────────────────────────────────────────────
  // O papel que fica afixado na sala e que as famílias leem à porta. A semana
  // já está carregada; o dia sai dela, e o mês vai buscar o mês inteiro.
  const nomeCasa = useOrgName()
  const [aImprimir, setAImprimir] = useState('')

  const nomeDoPrato = useCallback((e: Entry) =>
    e.dish_name_free || dishes.find(d => d.id === e.dish_id)?.name || '', [dishes])

  const linhasDaSemana = useCallback((): LinhaEmenta[] => entries
    .map(e => ({ date: e.date, meal_type: e.meal_type, course: e.course || 'prato', nome: nomeDoPrato(e) }))
    .filter(l => l.nome), [entries, nomeDoPrato])

  async function imprimir(alcance: 'dia' | 'semana' | 'mes') {
    setAImprimir(alcance)
    try {
      const casa = nomeCasa || 'Ementa'
      if (alcance === 'semana') { imprimirSemana(casa, weekDates.map(fmtDate), linhasDaSemana()); return }
      if (alcance === 'dia') {
        const hojeStr = fmtDate(new Date())
        const alvo = weekDates.some(d => fmtDate(d) === hojeStr) ? hojeStr : fmtDate(weekDates[0])
        imprimirDia(casa, alvo, linhasDaSemana()); return
      }
      // O mês não está em memória — vai buscá-lo agora.
      const base = weekDates[3] || new Date()
      const ano = base.getFullYear(), mes = base.getMonth()
      const de = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
      const ate = fmtDate(new Date(ano, mes + 1, 0))
      const { data, error } = await scope.filter(
        supabase.from('meal_plan_entries').select('date,meal_type,course,dish_id,dish_name_free')
      ).gte('date', de).lte('date', ate)
      if (error) { toast.error('Não foi possível carregar o mês', reportError('refeicoes-imprimir-mes', error, MSG.load)); return }
      const linhas: LinhaEmenta[] = (data || [])
        .map((e: any) => ({ date: e.date, meal_type: e.meal_type, course: e.course || 'prato', nome: nomeDoPrato(e) }))
        .filter((l: LinhaEmenta) => l.nome)
      imprimirMes(casa, ano, mes, linhas)
    } finally { setAImprimir('') }
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const from = fmtDate(weekDates[0]); const to = fmtDate(weekDates[6])
    const [dsh, ent, pats, cps] = await Promise.all([
      scope.filter(supabase.from('meal_dishes').select('*')).eq('active', true).order('name'),
      scope.filter(supabase.from('meal_plan_entries').select('*')).gte('date', from).lte('date', to),
      scope.filter(supabase.from('patients').select('id,allergies')).eq('active', true),
      scope.filter(supabase.from('care_plans').select('patient_id,diet_type,diet_texture')),
    ])
    // As duas tabelas do sprint127, não só a primeira: uma migração aplicada
    // pela metade deixava meal_plan_entries a falhar em silêncio a cada visita.
    const emFalta = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')
    if (emFalta(dsh.error) || emFalta(ent.error)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setDishes(dsh.data || [])
    setEntries(ent.data || [])
    setPatients(pats.data || [])
    setCarePlans(cps.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, weekDates[0]])

  useEffect(() => { load() }, [load])

  // Necessidades REAIS agregadas de quem frequenta o centro — é isto que a IA
  // usa para não sugerir nada com alergénios ou incompatível com as dietas.
  const needs = useMemo(() => {
    const allergenTokens = new Set<string>()
    patients.forEach(p => { (p.allergies || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(t => allergenTokens.add(t)) })
    const textures = new Set<string>()
    const diets = new Set<string>()
    carePlans.forEach(cp => {
      if (cp.diet_texture && cp.diet_texture !== 'Normal') textures.add(cp.diet_texture)
      if (cp.diet_type && cp.diet_type !== 'Normal') diets.add(cp.diet_type)
    })
    return { allergens: [...allergenTokens], textures: [...textures], diets: [...diets] }
  }, [patients, carePlans])

  function entryFor(date: string, mealType: string, course: string) { return entries.find(e => e.date === date && e.meal_type === mealType && (e.course || 'prato') === course) }

  async function assignDish(date: string, mealType: string, course: string, dishId: string) {
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    const { data, error } = await supabase.from('meal_plan_entries').upsert(scope.stamp({
      user_id: user.id, date, meal_type: mealType, course, dish_id: dishId || null, dish_name_free: null,
    }), { onConflict: 'org_id,user_id,date,meal_type,course' }).select().single()
    if (error) { toast.error('Não foi possível guardar', reportError('refeicoes-assign', error, MSG.save)); return }
    setEntries(prev => { const rest = prev.filter(e => !(e.date === date && e.meal_type === mealType && (e.course || 'prato') === course)); return data ? [...rest, data] : rest })
  }

  /** Guarda na biblioteca um prato que a IA propôs, sem ter de aplicar a semana toda. */
  async function guardarPropostoNaBiblioteca(d: NewDish) {
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    const { data, error } = await supabase.from('meal_dishes').insert(scope.stamp({
      user_id: user.id, name: d.name, course: d.course || 'prato', category: d.category || null, meal_types: d.meal_types,
      allergens: d.allergens, texture: d.texture, diet_tags: d.diet_tags, cost_tier: d.cost_tier, active: true,
    })).select().single()
    if (error) { toast.error('Não foi possível guardar o prato', reportError('refeicoes-guardar-proposto', error, MSG.save)); return }
    // Passa a ser um prato real: sai da lista de propostas e entra na biblioteca,
    // e os lugares que o referenciavam passam a apontar para o id verdadeiro.
    setDishes(prev => [...prev, data].sort((a: any, b: any) => a.name.localeCompare(b.name)))
    setProposedNewDishes(prev => prev.filter(x => x.temp_id !== d.temp_id))
    setProposal(prev => {
      if (!prev) return prev
      const out = { ...prev }
      Object.keys(out).forEach(k => { if (out[k].newDishTempId === d.temp_id) out[k] = { dishId: data.id, newDishTempId: null } })
      return out
    })
    toast.success('Prato guardado', `"${d.name}" entrou na biblioteca.`)
  }

  /** Pede à IA para classificar os pratos que ainda não têm categoria.
   *  Uma biblioteca que cresce sem arrumação volta a ser uma lista de cem
   *  nomes — e é isso que faz alguém criar um prato que já lá estava. */
  async function arrumarBiblioteca() {
    const porArrumar = dishes.filter(d => !d.category)
    if (!porArrumar.length) return
    setAArrumar(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/refeicoes/arrumar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ pratos: porArrumar.map(d => ({ id: d.id, name: d.name })) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não foi possível arrumar.')
      // Grava em bloco, uma escrita por categoria.
      const porCat = new Map<string, string[]>()
      ;(d.classificados || []).forEach((c: any) => {
        if (!c?.id || !c?.category) return
        if (!porCat.has(c.category)) porCat.set(c.category, [])
        porCat.get(c.category)!.push(c.id)
      })
      for (const [cat, ids] of porCat) {
        await supabase.from('meal_dishes').update({ category: cat, course: COURSE_DE_CAT[cat] || undefined }).in('id', ids)
      }
      toast.success('Biblioteca arrumada', `${(d.classificados || []).length} pratos por categoria.`)
      load()
    } catch (e: any) {
      toast.error('Não foi possível arrumar', e?.message || MSG.generic)
    }
    setAArrumar(false)
  }

  async function createDish() {
    if (!newName.trim()) return
    setSavingDish(true)
    const { error } = await supabase.from('meal_dishes').insert(scope.stamp({
      user_id: user.id, name: newName.trim().slice(0, 120),
      meal_types: newMealTypes.length ? newMealTypes : null,
      allergens: newAllergens.trim() ? newAllergens.split(',').map(s => s.trim()).filter(Boolean) : null,
      texture: newTexture, diet_tags: newDietTags.length ? newDietTags : null, cost_tier: newCost, active: true,
    }))
    if (error) { toast.error('Não foi possível guardar', reportError('refeicoes-dish-create', error, MSG.save)); setSavingDish(false); return }
    setSavingDish(false); setNewName(''); setNewMealTypes([]); setNewAllergens(''); setNewTexture('Normal'); setNewDietTags([]); setNewCost('medio')
    load()
  }
  async function removeDish(id: string) {
    if (!confirm('Remover este prato da biblioteca?')) return
    const { error } = await supabase.from('meal_dishes').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('refeicoes-dish-remove', error, MSG.save)); return }
    load()
  }

  async function suggestWeek() {
    setSuggesting(true); setSuggestErr(''); setProposal(null); setProposedNewDishes([])
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/refeicoes/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ dishes, avoidAllergens: needs.allergens, neededTextures: needs.textures, neededDietTags: needs.diets, budgetHint: instructions }),
      })
      // Ler como texto primeiro: quando o pedido rebenta ANTES de chegar à
      // rota (tempo limite, erro da plataforma), o que volta é uma página HTML
      // e o r.json() rebentava com "Unexpected token 'A'" — uma mensagem que
      // não diz nada a quem está a usar.
      const bruto = await r.text()
      let d: any = null
      try { d = JSON.parse(bruto) } catch { /* não é JSON */ }
      if (!d) throw new Error(r.ok
        ? 'A resposta veio incompleta. Tenta outra vez.'
        : `O pedido não chegou ao fim (${r.status}). Se acontecer sempre, é sinal de que a semana é grande demais de uma vez — tenta com menos instruções.`)
      if (!r.ok) throw new Error(d.error || 'Não foi possível sugerir agora.')
      const map: Record<string, { dishId: string | null; newDishTempId: string | null }> = {}
      ;(d.assignments || []).forEach((a: any) => {
        const date = fmtDate(weekDates[a.weekday])
        map[`${date}|${a.meal_type}|${a.course || 'prato'}`] = { dishId: a.dish_id || null, newDishTempId: a.new_dish_temp_id || null }
      })
      setProposal(map)
      setProposedNewDishes(d.newDishes || [])
      // A IA já cortou respostas a meio por falta de espaço; se voltar a
      // acontecer, é melhor dizê-lo do que deixar a semana meio vazia sem
      // explicação nenhuma.
      const preenchidos = Object.keys(map).length
      if (d.esperados && preenchidos < d.esperados * 0.8) {
        setSuggestErr(`A IA só conseguiu preencher ${preenchidos} de ${d.esperados} lugares. Podes aplicar assim e completar à mão, ou pedir outra vez.`)
      }
    } catch (e: any) { setSuggestErr(e.message) }
    setSuggesting(false)
  }

  async function applyProposal() {
    if (!proposal) return
    setApplying(true)
    try {
      // Pratos novos referenciados por pelo menos um horário passam a fazer
      // parte real da biblioteca só agora, ao aplicar — não antes.
      const usedTempIds = new Set(Object.values(proposal).map(v => v.newDishTempId).filter(Boolean) as string[])
      const toCreate = proposedNewDishes.filter(d => usedTempIds.has(d.temp_id))
      const tempIdToRealId: Record<string, string> = {}
      if (toCreate.length) {
        const { data: created, error: createErr } = await supabase.from('meal_dishes').insert(
          toCreate.map(d => scope.stamp({ user_id: user.id, name: d.name, course: d.course || 'prato', category: d.category || null, meal_types: d.meal_types, allergens: d.allergens, texture: d.texture, diet_tags: d.diet_tags, cost_tier: d.cost_tier, active: true }))
        ).select()
        if (createErr) throw new Error(createErr.message)
        ;(created || []).forEach((row: any, i: number) => { tempIdToRealId[toCreate[i].temp_id] = row.id })
      }
      const rows = Object.entries(proposal).map(([key, v]) => {
        const [date, mealType, course] = key.split('|')
        const dishId = v.dishId || (v.newDishTempId ? tempIdToRealId[v.newDishTempId] : null)
        return dishId ? scope.stamp({ user_id: user.id, date, meal_type: mealType, course: course || 'prato', dish_id: dishId, dish_name_free: null }) : null
      }).filter(Boolean) as any[]
      if (rows.length) {
        const { error } = await supabase.from('meal_plan_entries').upsert(rows, { onConflict: 'org_id,user_id,date,meal_type,course' })
        if (error) throw new Error(error.message)
      }
      setProposal(null); setProposedNewDishes([]); load()
    } catch (e: any) {
      toast.error('Não foi possível guardar o plano', reportError('refeicoes-apply-proposal', e, MSG.save))
    }
    setApplying(false)
  }

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Refeições</span>

          <Seletor
            opcoes={[
              { id: 'ementa', rotulo: 'A ementa' },
              { id: 'biblioteca', rotulo: `Pratos ${dishes.length}` },
              { id: 'reforco', rotulo: 'Reforço diabético' },
            ]}
            ativa={vista} aoMudar={v => setVista(v as 'ementa' | 'biblioteca' | 'reforco')} />

          {vista === 'ementa' && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Botao onClick={() => setWeekStart(w => { const n = new Date(w); n.setDate(n.getDate() - 7); return n })}
                titulo="Semana anterior">←</Botao>
              <span style={{ ...MONO, fontSize: 'var(--t-dado)', color: 'var(--ink)', fontWeight: 'var(--peso-forte)' as any, whiteSpace: 'nowrap' }}>
                {weekDates[0].toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}–{weekDates[6].toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
              </span>
              <Botao onClick={() => setWeekStart(w => { const n = new Date(w); n.setDate(n.getDate() + 7); return n })}
                titulo="Semana seguinte">→</Botao>
            </span>
          )}

          {vista === 'ementa' && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={ROTULO}>Imprimir</span>
              {(['dia', 'semana', 'mes'] as const).map(a => (
                <Botao key={a} onClick={() => imprimir(a)} esperando={aImprimir === a}
                  titulo={`Imprimir a ementa d${a === 'mes' ? 'o mês' : a === 'dia' ? 'o dia' : 'a semana'}`}>
                  {a === 'dia' ? 'DIA' : a === 'semana' ? 'SEMANA' : 'MÊS'}
                </Botao>
              ))}
            </span>
          )}

        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>A ementa é o que vai para a cozinha</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Alergénio de alguém da casa</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            As texturas e as dietas saem das fichas — não se escrevem aqui outra vez
          </span>
        </BarraDeEstado>
      }
    >
        {vista === 'reforco' && <DiabeticReinforcementSection />}

        {needsSetup ? (
          <AvisoDeSetup codigo="PHX-J9" oQue="O planeamento de ementas ainda não está disponível nesta conta." />
        ) : <>
        {vista === 'biblioteca' && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
            <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>Biblioteca de pratos ({dishes.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do prato (ex: Sopa de legumes, Bacalhau à Brás)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(m => (
                  <button key={m.id} onClick={() => setNewMealTypes(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
                    style={{ padding: '5px 11px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: `1.5px solid ${newMealTypes.includes(m.id) ? 'var(--ink)' : 'var(--border)'}`, background: newMealTypes.includes(m.id) ? 'var(--ink)' : 'white', color: newMealTypes.includes(m.id) ? 'white' : 'var(--ink-4)' }}>{m.label}</button>
                ))}
                {newMealTypes.length === 0 && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', alignSelf: 'center' }}>(nenhum = serve para qualquer refeição)</span>}
              </div>
              <input value={newAllergens} onChange={e => setNewAllergens(e.target.value)} placeholder="Alergénios, separados por vírgula (ex: glúten, lactose)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={newTexture} onChange={e => setNewTexture(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-dado)', background: 'white' }}>
                  {TEXTURES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={newCost} onChange={e => setNewCost(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-dado)', background: 'white' }}>
                  {COST_TIERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DIET_TAGS.map(d => (
                  <button key={d} onClick={() => setNewDietTags(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                    style={{ padding: '5px 11px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: `1.5px solid ${newDietTags.includes(d) ? 'var(--green)' : 'var(--border)'}`, background: newDietTags.includes(d) ? 'var(--green-light)' : 'white', color: newDietTags.includes(d) ? 'var(--green)' : 'var(--ink-4)' }}>{d}</button>
                ))}
              </div>
              <button onClick={createDish} disabled={savingDish || !newName.trim()} style={{ alignSelf: 'flex-start', padding: '8px 18px', background: savingDish || !newName.trim() ? 'var(--bg-3)' : 'var(--green)', color: savingDish || !newName.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: savingDish || !newName.trim() ? 'not-allowed' : 'pointer' }}>
                {savingDish ? 'A guardar…' : '+ Adicionar à biblioteca'}
              </button>
            </div>
            {dishes.length > 0 && (() => {
              const semAcento = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              const q = semAcento(buscaLib.trim())
              const visiveis = dishes.filter(d =>
                (!q || semAcento(d.name).includes(q) || semAcento(d.category || '').includes(q)) &&
                (!filtroCat || (d.category || 'outro') === filtroCat))
              const porCat = new Map<string, typeof dishes>()
              visiveis.forEach(d => {
                const c = d.category || 'outro'
                if (!porCat.has(c)) porCat.set(c, [])
                porCat.get(c)!.push(d)
              })
              const ordem = ['sopa', 'carne', 'peixe', 'vegetariano', 'doce', 'fruta', 'outro']
              const grupos = [...porCat.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
              const catsExistentes = [...new Set(dishes.map(d => d.category || 'outro'))].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
              const semCategoria = dishes.filter(d => !d.category).length

              return (
              <div>
                {/* Pesquisa e filtro */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                  <input value={buscaLib} onChange={e => setBuscaLib(e.target.value)}
                    placeholder={`Procurar entre ${dishes.length} pratos…`}
                    style={{ flex: '1 1 190px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 11px', fontSize: 'var(--t-meta)', fontFamily: 'inherit', outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => setFiltroCat('')} style={chipCat(!filtroCat)}>Tudo</button>
                    {catsExistentes.map(c => (
                      <button key={c} onClick={() => setFiltroCat(filtroCat === c ? '' : c)} style={chipCat(filtroCat === c)}>
                        {CAT_LABEL[c] || c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Arrumar com IA: classifica os que ficaram por classificar */}
                {semCategoria > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '9px 12px', marginBottom: 12 }}>
                    <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', flex: '1 1 200px', lineHeight: 1.45 }}>
                      {semCategoria} {semCategoria === 1 ? 'prato ainda não está arrumado' : 'pratos ainda não estão arrumados'} por categoria.
                    </span>
                    <button onClick={arrumarBiblioteca} disabled={aArrumar} style={{
                      minHeight: 'var(--alvo)', padding: '0 12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--ink-2)',
                      color: 'white', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: aArrumar ? 'wait' : 'pointer', fontFamily: 'inherit',
                    }}>{aArrumar ? 'A ARRUMAR…' : 'ARRUMAR COM IA'}</button>
                  </div>
                )}

                {!visiveis.length && (
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', padding: '10px 0' }}>
                    Nada com “{buscaLib}”. Escreve o nome em baixo para acrescentar à biblioteca.
                  </div>
                )}

                {grupos.map(([cat, lista]) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 7 }}>
                      {CAT_LABEL[cat] || cat} · {lista.length}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lista.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                    <span style={{ flex: 1, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{d.name}</span>
                    {d.allergens && d.allergens.length > 0 && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--amber)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r)', padding: '1px 7px' }}>⚠ {d.allergens.join(', ')}</span>}
                    {d.texture && d.texture !== 'Normal' && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-2)', background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '1px 7px' }}>{d.texture}</span>}
                    <button onClick={() => removeDish(d.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 'var(--t-destaque)' }}>×</button>
                  </div>
                ))}
                    </div>
                  </div>
                ))}
              </div>
              )
            })()}
          </div>
        )}

        {/* A SUGESTÃO DA IA — refeita.
            Era um cartão com um emoji ✨ e uma frase corrida a dizer o que
            respeitava. O que ela respeita são restrições da casa, e cada uma
            tem um nome: saem em códigos, à vista, porque é por elas que se
            confere a proposta. */}
        <Painel
          cabeca={
            <Cabecalho>
              <span style={{ flex: 1 }}>Sugerir a semana</span>
              <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                {needs.allergens.length + needs.textures.length + needs.diets.length} RESTRIÇÕES DA CASA
              </span>
            </Cabecalho>
          }
        >
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {needs.allergens.map(a => <Codigo key={'a' + a} texto={a.toUpperCase()} cor="var(--red)" />)}
              {needs.textures.map(t => <Codigo key={'t' + t} texto={t.toUpperCase()} cor="var(--amber)" />)}
              {needs.diets.map(d => <Codigo key={'d' + d} texto={d.toUpperCase()} cor="var(--green)" />)}
              {!needs.allergens.length && !needs.textures.length && !needs.diets.length && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                  NENHUMA ALERGIA, TEXTURA OU DIETA REGISTADA NAS FICHAS
                </span>
              )}
            </div>

            {dishes.length === 0 && (
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 8, lineHeight: 1.5 }}>
                Ainda não há pratos na biblioteca — a IA propõe pratos novos, realistas, que revê antes de aplicar.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input id="refeicoes-instrucoes" value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Orçamento e outras instruções — ex: semana apertada, menu português, evitar fritos"
                style={{ ...CAIXA, flex: '1 1 260px' }} />
              <Botao feitio="principal" onClick={suggestWeek} esperando={suggesting}>SUGERIR A SEMANA</Botao>
            </div>
          </div>
          {suggestErr && <div style={{ padding: '0 12px 10px' }}><Aviso tom="mau">{suggestErr}</Aviso></div>}
          {proposedNewDishes.length > 0 && (
            <div style={{ margin: '0 12px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '9px 11px', background: 'var(--bg-2)' }}>
              <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', marginBottom: 6 }}>Pratos novos propostos pela IA ({proposedNewDishes.length}) — revê antes de aplicar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {proposedNewDishes.map(d => (
                  <div key={d.temp_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-meta)' }}>
                    <span style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{d.name}</span>
                    {d.allergens && d.allergens.length > 0 && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--amber)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r)', padding: '1px 6px' }}>⚠ {d.allergens.join(', ')}</span>}
                    {d.texture && d.texture !== 'Normal' && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-2)', background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '1px 6px' }}>{d.texture}</span>}
                    {d.course && <span style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-2)', background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '1px 6px' }}>{COURSES.find(c => c.id === d.course)?.curto || d.course}</span>}
                    {/* Guardar SÓ este prato, sem ter de aplicar a semana toda:
                        um bom prato proposto vale por si, mesmo que o resto da
                        ementa se descarte. */}
                    <button onClick={() => guardarPropostoNaBiblioteca(d)} style={{
                      marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r)',
                      padding: '3px 9px', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>+ biblioteca</button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 8 }}>Verifica sempre alergénios antes de confirmar — a IA pode falhar a listá-los.</div>
            </div>
          )}
          {proposal && (
            <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px' }}>
              <Botao feitio="principal" onClick={applyProposal} esperando={applying}>APLICAR À EMENTA</Botao>
              <Botao onClick={() => { setProposal(null); setProposedNewDishes([]) }} disabled={applying}>DESCARTAR</Botao>
            </div>
          )}
        </Painel>

        {/* A navegação da semana subiu para a barra de trabalho: custava uma
            fila inteira e desaparecia ao rolar. */}

        {/* Grelha semanal */}
        {loading ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 'var(--r-xl)' }} />
        ) : (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ flex: 1 }}>A ementa da semana</span>
                <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                  {entries.length} DE {MEAL_TYPES.reduce((n, mt) => n + (MOMENTOS[mt.id] || ['prato']).length, 0) * 7} PREENCHIDOS
                </span>
              </Cabecalho>
            }
          >
          {/* A grelha rola na horizontal DENTRO do painel, e a coluna das
              refeições fica presa à esquerda: sete dias não cabem em 1366px,
              e a coluna que diz «Almoço · Prato» é justamente a que não pode
              sair do ecrã — sem ela, a célula não quer dizer nada. */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-dado)' }}>
              <thead>
                <tr>
                  <th style={{ ...PRESA, padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', minWidth: 104, background: 'var(--bg-2)' }}></th>
                  {weekDates.map((d, i) => (
                    <th key={i} style={{
                      padding: '6px 9px', textAlign: 'left', background: 'var(--bg-2)',
                      borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 132,
                    }}>
                      <div style={{ ...ROTULO, color: hoje === fmtDate(d) ? 'var(--green)' : 'var(--ink-3)' }}>
                        {WEEKDAY_LABELS[d.getDay()]}
                      </div>
                      <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                        {d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.flatMap(mt => (MOMENTOS[mt.id] || ['prato']).map((cs, ci) => (
                  <tr key={`${mt.id}|${cs}`}>
                    <td style={{ ...PRESA, padding: '6px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap', background: 'var(--bg)' }}>
                      {ci === 0 && <div style={{ ...ROTULO, color: 'var(--ink-2)' }}>{mt.label}</div>}
                      {(MOMENTOS[mt.id] || []).length > 1 && (
                        <div style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: ci === 0 ? 2 : 0 }}>
                          {COURSES.find(c => c.id === cs)?.curto}
                        </div>
                      )}
                    </td>
                    {weekDates.map((d, i) => {
                      const mtId = mt.id
                      const date = fmtDate(d)
                      const entry = entryFor(date, mtId, cs)
                      const cellProposal = proposal?.[`${date}|${mtId}|${cs}`]
                      const showProposed = !!proposal && cellProposal !== undefined
                      const currentDishId = entry?.dish_id || ''
                      // prato NOVO proposto: ainda não tem id real, não dá para ser opção do <select>
                      if (showProposed && cellProposal?.newDishTempId) {
                        const nd = proposedNewDishes.find(x => x.temp_id === cellProposal.newDishTempId)
                        return (
                          <td key={i} style={{ padding: 5, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', verticalAlign: 'top', background: 'var(--green-light)' }}>
                            <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 8px', fontSize: 'var(--t-meta)', color: 'var(--ink-3)', background: 'white' }}>{nd?.name || 'Prato novo'}</div>
                            <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-3)', marginTop: 3 }}>prato novo · proposta da IA</div>
                          </td>
                        )
                      }
                      const proposedDishId = cellProposal?.dishId
                      return (
                        <td key={i} style={{ padding: 5, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', verticalAlign: 'top', background: showProposed ? 'var(--green-light)' : undefined }}>
                          {/* Seletor com pesquisa: um <select> nativo com cem
                              pratos por ordem alfabética era o que tornava
                              fazer a ementa à mão insuportável. */}
                          <EscolherPrato
                            pratos={dishes}
                            valor={showProposed ? (proposedDishId || '') : currentDishId}
                            momento={cs}
                            destaque={showProposed}
                            compacto
                            aoEscolher={id => assignDish(date, mtId, cs, id)}
                          />
                          {showProposed && !entry && proposedDishId && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-3)', marginTop: 3 }}>proposta da IA</div>}
                        </td>
                      )
                    })}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          </Painel>
        )}
        </>}
    </Mesa>
  )
}

// ─── Reforço alimentar a diabéticos ─────────────────────────────────────────
// Novo 2026-08-11 — auditoria direta contra o serviço "reforço alimentar aos
// idosos diabéticos" de um centro de dia real: /refeicoes só tinha uma tag de
// dieta num PRATO, nada ao nível do RESIDENTE, nada a marcar se o reforço foi
// de facto dado. Autónomo de propósito (própria fetch, própria tabela) — não
// depende de meal_plan_entries/meal_dishes (sprint127, ainda por aplicar),
// para não ficar bloqueado atrás de uma migração de outra funcionalidade.
//
// Deteção de diabetes reaproveita EXATAMENTE o mesmo critério que já existe
// em lib/vitalRanges.ts (evaluateVital ajusta o limiar de glicemia quando
// /diabet|dm2|dm1/i bate com patients.conditions) — o mesmo residente conta
// como diabético aqui e em /vitals e /care-log, nunca dois critérios a mais.
const DIABETIC_RE = /diabet|dm2|dm1/i
const SHIFT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

interface DiabPatient { id: string; name: string; conditions: string | null; age: number | null; room_number: string | null }
interface LatestVital { glucose: number | null; recorded_at: string | null }
interface ReinforcementRow { id: string; patient_id: string; shift: string; given: boolean }

function DiabeticReinforcementSection() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('registos', 'editar')
  const toast = useToast()
  const today = ptDate()

  const [patients, setPatients] = useState<DiabPatient[]>([])
  const [vitals, setVitals] = useState<Record<string, LatestVital>>({})
  const [rows, setRows] = useState<ReinforcementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = ptDate(new Date(Date.now() - 3 * 86400000))
    const [pats, cr, rf] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,conditions,age,room_number')).eq('active', true),
      scope.filter(supabase.from('care_records').select('patient_id,date,vitals')).gte('date', since).order('date', { ascending: false }),
      scope.filter(supabase.from('dietary_reinforcements').select('id,patient_id,shift,given')).eq('date', today),
    ])
    if (rf.error && /does not exist|schema cache/i.test(rf.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    const diabetic = ((pats.data || []) as DiabPatient[]).filter(p => DIABETIC_RE.test(p.conditions || ''))
    setPatients(diabetic)
    const latest: Record<string, LatestVital> = {}
    ;((cr.data || []) as any[]).forEach(r => {
      if (latest[r.patient_id]) return // já temos um mais recente (ordenado desc)
      const g = r.vitals?.glucose
      if (typeof g === 'number') latest[r.patient_id] = { glucose: g, recorded_at: r.date }
    })
    setVitals(latest)
    setRows((rf.data || []) as ReinforcementRow[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, today])

  useEffect(() => { load() }, [load])

  async function toggle(patientId: string, shift: string) {
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    const existing = rows.find(r => r.patient_id === patientId && r.shift === shift)
    const nextGiven = !existing?.given
    const { data, error } = await supabase.from('dietary_reinforcements').upsert(scope.stamp({
      user_id: user.id, patient_id: patientId, date: today, shift, given: nextGiven, recorded_by_id: user.id,
    }), { onConflict: 'patient_id,date,shift' }).select().single()
    if (error) { toast.error('Não foi possível marcar', reportError('reforco-diabetico-toggle', error, MSG.save)); return }
    setRows(prev => { const rest = prev.filter(r => !(r.patient_id === patientId && r.shift === shift)); return data ? [...rest, data] : rest })
  }

  if (needsSetup) {
    return (
      <AvisoDeSetup codigo="PHX-K7" oQue="O reforço alimentar a diabéticos ainda não está disponível nesta conta." compacto />
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-xl)', padding: 18 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Reforço alimentar · Diabéticos</div>
      <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: '0 0 14px', lineHeight: 1.5 }}>Identificados a partir das condições registadas em cada ficha. Marque quando o reforço for dado — a glicemia mostrada é a última registada.</p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 'var(--r-lg)' }} />)}</div>
      ) : patients.length === 0 ? (
        <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', padding: '10px 0' }}>Nenhum residente diabético identificado a partir das condições registadas em Doentes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patients.map(p => {
            const v = vitals[p.id]
            const reading = v?.glucose != null ? evaluateVital('glucose', v.glucose, { age: p.age, conditions: p.conditions }) : null
            return (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{p.name}{p.room_number ? <span style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-4)' }}> · Q.{p.room_number}</span> : ''}</div>
                  {reading && (
                    <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: reading.level === 'normal' ? 'var(--green)' : reading.level === 'warning' ? 'var(--amber)' : 'var(--red)' }}>
                      Glicemia {v!.glucose} mg/dL{v!.recorded_at && v!.recorded_at !== today ? ` (${v!.recorded_at.slice(8, 10)}/${v!.recorded_at.slice(5, 7)})` : ''} · {reading.label}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['manha', 'tarde', 'noite'] as const).map(shift => {
                    const given = !!rows.find(r => r.patient_id === p.id && r.shift === shift)?.given
                    return (
                      <button key={shift} onClick={() => toggle(p.id, shift)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: `1.5px solid ${given ? 'var(--green)' : 'var(--border)'}`, background: given ? 'var(--green-light)' : 'white', color: given ? 'var(--green)' : 'var(--ink-4)' }}>
                        {given ? '✓' : ''} {SHIFT_LABEL[shift]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
