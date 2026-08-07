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

interface Dish { id: string; name: string; meal_types: string[] | null; allergens: string[] | null; texture: string | null; diet_tags: string[] | null; cost_tier: string }
interface Entry { id: string; date: string; meal_type: string; dish_id: string | null; dish_name_free: string | null }
interface CarePlan { patient_id: string; diet_type?: string | null; diet_texture?: string | null }
interface Patient { id: string; allergies: string | null }

const MEAL_TYPES: { id: string; label: string }[] = [
  { id: 'pequeno_almoco', label: 'Pequeno-almoço' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
]
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TEXTURES = ['Normal', 'Mole', 'Triturada', 'Liquidificada', 'Pastosa', 'Picada']
const DIET_TAGS = ['Normal', 'Hipossódica', 'Hipoglicídica', 'Hipoproteica', 'Hipercalórica', 'Vegetariana', 'Diabética']
const COST_TIERS: { id: string; label: string }[] = [{ id: 'baixo', label: '€ Baixo' }, { id: 'medio', label: '€€ Médio' }, { id: 'alto', label: '€€€ Alto' }]

function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

export default function RefeicoesPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
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

  // Novo prato
  const [newName, setNewName] = useState('')
  const [newMealTypes, setNewMealTypes] = useState<string[]>([])
  const [newAllergens, setNewAllergens] = useState('')
  const [newTexture, setNewTexture] = useState('Normal')
  const [newDietTags, setNewDietTags] = useState<string[]>([])
  const [newCost, setNewCost] = useState('medio')
  const [savingDish, setSavingDish] = useState(false)

  // Sugestão IA
  const [budgetHint, setBudgetHint] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestErr, setSuggestErr] = useState('')
  const [proposal, setProposal] = useState<Record<string, string | null> | null>(null) // key `${date}_${meal_type}` -> dish_id

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
    if (dsh.error && /does not exist|schema cache/i.test(dsh.error.message)) { setNeedsSetup(true); setLoading(false); return }
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

  function entryFor(date: string, mealType: string) { return entries.find(e => e.date === date && e.meal_type === mealType) }

  async function assignDish(date: string, mealType: string, dishId: string) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const { data, error } = await supabase.from('meal_plan_entries').upsert(scope.stamp({
      user_id: user.id, date, meal_type: mealType, dish_id: dishId || null, dish_name_free: null,
    }), { onConflict: 'org_id,user_id,date,meal_type' }).select().single()
    if (error) { toast.error('Não foi possível guardar', reportError('refeicoes-assign', error, MSG.save)); return }
    setEntries(prev => { const rest = prev.filter(e => !(e.date === date && e.meal_type === mealType)); return data ? [...rest, data] : rest })
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
    if (dishes.length === 0) { setSuggestErr('Adiciona pelo menos um prato à biblioteca primeiro.'); return }
    setSuggesting(true); setSuggestErr(''); setProposal(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/refeicoes/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ dishes, avoidAllergens: needs.allergens, neededTextures: needs.textures, neededDietTags: needs.diets, budgetHint }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não foi possível sugerir agora.')
      const map: Record<string, string | null> = {}
      ;(d.assignments || []).forEach((a: any) => {
        const date = fmtDate(weekDates[a.weekday])
        map[`${date}_${a.meal_type}`] = a.dish_id
      })
      setProposal(map)
    } catch (e: any) { setSuggestErr(e.message) }
    setSuggesting(false)
  }

  async function applyProposal() {
    if (!proposal) return
    const rows = Object.entries(proposal).filter(([, dishId]) => dishId).map(([key, dishId]) => {
      const [date, mealType] = key.split('_')
      return scope.stamp({ user_id: user.id, date, meal_type: mealType, dish_id: dishId, dish_name_free: null })
    })
    if (rows.length === 0) { setProposal(null); return }
    const { error } = await supabase.from('meal_plan_entries').upsert(rows, { onConflict: 'org_id,user_id,date,meal_type' })
    if (error) { toast.error('Não foi possível guardar o plano', reportError('refeicoes-apply-proposal', error, MSG.save)); return }
    setProposal(null); load()
  }

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Para ativar o planeamento de refeições, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint127_meal_planning.sql</code> no Supabase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Refeições</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>Organiza o cardápio da semana para a cozinha — a IA ajuda, respeitando alergias e dietas.</p>
          </div>
          <button onClick={() => setShowLibrary(v => !v)} style={{ padding: '9px 16px', background: showLibrary ? 'var(--ink)' : 'white', color: showLibrary ? 'white' : 'var(--ink-3)', border: '1.5px solid var(--ink)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {showLibrary ? 'Fechar biblioteca' : '📖 Biblioteca de pratos'}
          </button>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {showLibrary && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Biblioteca de pratos ({dishes.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do prato (ex: Sopa de legumes, Bacalhau à Brás)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(m => (
                  <button key={m.id} onClick={() => setNewMealTypes(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
                    style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newMealTypes.includes(m.id) ? 'var(--ink)' : 'var(--border)'}`, background: newMealTypes.includes(m.id) ? 'var(--ink)' : 'white', color: newMealTypes.includes(m.id) ? 'white' : 'var(--ink-4)' }}>{m.label}</button>
                ))}
                {newMealTypes.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-5)', alignSelf: 'center' }}>(nenhum = serve para qualquer refeição)</span>}
              </div>
              <input value={newAllergens} onChange={e => setNewAllergens(e.target.value)} placeholder="Alergénios, separados por vírgula (ex: glúten, lactose)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={newTexture} onChange={e => setNewTexture(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: 'white' }}>
                  {TEXTURES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={newCost} onChange={e => setNewCost(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: 'white' }}>
                  {COST_TIERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {DIET_TAGS.map(d => (
                  <button key={d} onClick={() => setNewDietTags(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                    style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDietTags.includes(d) ? '#0d9488' : 'var(--border)'}`, background: newDietTags.includes(d) ? '#f0fdfa' : 'white', color: newDietTags.includes(d) ? '#0d9488' : 'var(--ink-4)' }}>{d}</button>
                ))}
              </div>
              <button onClick={createDish} disabled={savingDish || !newName.trim()} style={{ alignSelf: 'flex-start', padding: '8px 18px', background: savingDish || !newName.trim() ? 'var(--bg-3)' : '#0d9488', color: savingDish || !newName.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: savingDish || !newName.trim() ? 'not-allowed' : 'pointer' }}>
                {savingDish ? 'A guardar…' : '+ Adicionar à biblioteca'}
              </button>
            </div>
            {dishes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dishes.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{d.name}</span>
                    {d.allergens && d.allergens.length > 0 && <span style={{ fontSize: 10.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5, padding: '1px 7px' }}>⚠ {d.allergens.join(', ')}</span>}
                    {d.texture && d.texture !== 'Normal' && <span style={{ fontSize: 10.5, color: '#1d4ed8', background: '#eff6ff', borderRadius: 5, padding: '1px 7px' }}>{d.texture}</span>}
                    <button onClick={() => removeDish(d.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sugestão IA */}
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#5b21b6', marginBottom: 8 }}>✨ Sugerir a semana com IA</div>
          <div style={{ fontSize: 11.5, color: '#6d28d9', marginBottom: 8 }}>
            Respeita sempre: {needs.allergens.length ? `evita ${needs.allergens.join(', ')}` : 'sem alergias registadas'}
            {needs.textures.length ? ` · texturas: ${needs.textures.join(', ')}` : ''}
            {needs.diets.length ? ` · dietas: ${needs.diets.join(', ')}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={budgetHint} onChange={e => setBudgetHint(e.target.value)} placeholder="Pista de orçamento (opcional, ex: semana apertada, preferir pratos baratos)"
              style={{ flex: '1 1 260px', border: '1.5px solid #ddd6fe', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }} />
            <button onClick={suggestWeek} disabled={suggesting} style={{ padding: '8px 16px', background: suggesting ? '#e5e7eb' : '#5b21b6', color: suggesting ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: suggesting ? 'wait' : 'pointer' }}>
              {suggesting ? 'A pensar…' : 'Sugerir semana →'}
            </button>
          </div>
          {suggestErr && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{suggestErr}</div>}
          {proposal && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={applyProposal} style={{ padding: '8px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Aplicar proposta à grelha</button>
              <button onClick={() => setProposal(null)} style={{ padding: '8px 16px', background: 'white', border: '1.5px solid #ddd6fe', color: '#6d28d9', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Descartar</button>
            </div>
          )}
        </div>

        {/* Navegação de semana */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setWeekStart(w => { const n = new Date(w); n.setDate(n.getDate() - 7); return n })} style={{ padding: '7px 13px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-3)' }}>← Semana anterior</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{weekDates[0].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} – {weekDates[6].toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}</div>
          <button onClick={() => setWeekStart(w => { const n = new Date(w); n.setDate(n.getDate() + 7); return n })} style={{ padding: '7px 13px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--ink-3)' }}>Semana seguinte →</button>
        </div>

        {/* Grelha semanal */}
        {loading ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', borderBottom: '1px solid var(--border)', minWidth: 110 }}></th>
                  {weekDates.map((d, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minWidth: 150 }}>
                      {WEEKDAY_LABELS[d.getDay()]}<div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', fontWeight: 400 }}>{d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEAL_TYPES.map(mt => (
                  <tr key={mt.id}>
                    <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{mt.label}</td>
                    {weekDates.map((d, i) => {
                      const date = fmtDate(d)
                      const entry = entryFor(date, mt.id)
                      const proposedId = proposal?.[`${date}_${mt.id}`]
                      const showProposed = !!proposal && proposedId !== undefined
                      const currentDishId = entry?.dish_id || ''
                      return (
                        <td key={i} style={{ padding: 8, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', verticalAlign: 'top', background: showProposed ? '#faf5ff' : undefined }}>
                          <select value={showProposed ? (proposedId || '') : currentDishId}
                            onChange={e => assignDish(date, mt.id, e.target.value)}
                            style={{ width: '100%', border: `1.5px solid ${showProposed ? '#ddd6fe' : 'var(--border)'}`, borderRadius: 7, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'white', color: showProposed && !entry ? '#7c3aed' : 'var(--ink)' }}>
                            <option value="">—</option>
                            {dishes.map(dh => <option key={dh.id} value={dh.id}>{dh.name}</option>)}
                          </select>
                          {showProposed && !entry && <div style={{ fontSize: 9.5, color: '#7c3aed', marginTop: 3 }}>proposta da IA</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
