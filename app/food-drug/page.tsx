'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { suggestDrugs } from '@/lib/drugNames'

interface Interaction {
  food: string; drug: string
  severity: 'grave'|'moderada'|'ligeira'|'sem_interacao'
  mechanism: string; effect: string; advice: string; timing: string|null
}
interface Result { interactions: Interaction[]; summary: string; safe_foods: string[] }

const FOOD_BUTTONS = [
  { id: 'grapefruit',  label: 'Toranja / Grapefruit', emoji: '🍊', note: 'Inibe CYP3A4' },
  { id: 'alcohol',     label: 'Álcool',                emoji: '🍺', note: 'Hepatotóxico + SNC' },
  { id: 'dairy',       label: 'Leite / Laticínios',    emoji: '🥛', note: 'Quelação de minerais' },
  { id: 'coffee',      label: 'Café / Cafeína',         emoji: '☕', note: 'Estimulante + absorção' },
  { id: 'green_veg',   label: 'Vegetais verdes',        emoji: '🥬', note: 'Vitamina K · varfarina' },
  { id: 'tyramine',    label: 'Queijo curado / Fumados', emoji: '🧀', note: 'Tiramina · IMAOs' },
  { id: 'high_fiber',  label: 'Fibra / Farelo',         emoji: '🌾', note: 'Absorção oral' },
  { id: 'citrus',      label: 'Citrinos',               emoji: '🍋', note: 'Ácido ascórbico' },
  { id: 'soya',        label: 'Soja',                   emoji: '🫘', note: 'Fitoestrogénios + absorção' },
  { id: 'licorice',    label: 'Alcaçuz',                emoji: '🍬', note: 'Aldosterona-like' },
]

const SEV = {
  grave:         { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', label:'GRAVE',          icon:'🚨' },
  moderada:      { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', label:'MODERADA',       icon:'⚠️' },
  ligeira:       { bg:'#fff7ed', border:'#fed7aa', color:'#9a3412', label:'LIGEIRA',        icon:'ℹ️' },
  sem_interacao: { bg:'#d1fae5', border:'#6ee7b7', color:'#065f46', label:'SEM INTERAÇÃO',  icon:'✅' },
}

export default function FoodDrugPage() {
  const { user, supabase } = useAuth()

  const [selectedFoods, setSelectedFoods] = useState<string[]>([])
  const [customFood, setCustomFood]       = useState('')
  const [drugInput, setDrugInput]         = useState('')
  const [drugs, setDrugs]                 = useState<string[]>([])
  const [suggestions, setSuggestions]     = useState<{display:string;dci:string;isBrand:boolean}[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [result, setResult]               = useState<Result|null>(null)
  const [error, setError]                 = useState<string|null>(null)

  const toggleFood = (id: string) =>
    setSelectedFoods(p => p.includes(id) ? p.filter(f => f !== id) : [...p, id])

  const addDrug = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || drugs.includes(trimmed)) return
    setDrugs(p => [...p, trimmed])
    setDrugInput(''); setSuggestions([])
  }

  const loadFromProfile = async () => {
    if (!user) return
    setLoadingProfile(true)
    const { data } = await supabase.from('personal_meds').select('name').eq('user_id', user.id)
    if (data) setDrugs(data.map((m: any) => m.name))
    setLoadingProfile(false)
  }

  const allFoods = [
    ...FOOD_BUTTONS.filter(f => selectedFoods.includes(f.id)).map(f => f.label),
    ...customFood.split(',').map(s => s.trim()).filter(Boolean),
  ]

  const check = async () => {
    if (!drugs.length || !allFoods.length) return
    setLoading(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/food-drug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs, foods: allFoods }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const graveCount    = result?.interactions.filter(i => i.severity === 'grave').length    || 0
  const moderadaCount = result?.interactions.filter(i => i.severity === 'moderada').length || 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>


      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Interações Fármaco-Alimento</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--ink)', fontWeight:400, marginBottom:6 }}>O que posso comer?</div>
          <div style={{ fontSize:13, color:'var(--ink-4)', lineHeight:1.55 }}>Verifica se os teus medicamentos interagem com alimentos, bebidas ou suplementos.</div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth:640 }}>

        {/* ── Step 1: Drugs ── */}
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              1 — Medicamentos
            </div>
            {user && (
              <button onClick={loadFromProfile} disabled={loadingProfile} style={{ fontSize:12, fontWeight:700, color:'var(--green)', background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:20, padding:'5px 12px', cursor:'pointer' }}>
                {loadingProfile ? '...' : '⚡ Carregar do meu perfil'}
              </button>
            )}
          </div>
          <div style={{ position:'relative', marginBottom:10 }}>
            <input value={drugInput}
              onChange={e => { setDrugInput(e.target.value); setSuggestions(suggestDrugs(e.target.value)) }}
              onKeyDown={e => { if (e.key==='Enter') { addDrug(drugInput) } }}
              placeholder="Adicionar medicamento (ex: varfarina, atorvastatina)..."
              style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }} />
            {suggestions.length > 0 && drugInput.length > 1 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', zIndex:10, marginTop:2, overflow:'hidden' }}>
                {suggestions.slice(0,5).map(s => (
                  <button key={s.dci} onClick={() => addDrug(s.display)}
                    style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'white', border:'none', borderBottom:'1px solid var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--ink)' }}>
                    {s.display}
                  </button>
                ))}
              </div>
            )}
          </div>
          {drugs.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {drugs.map(d => (
                <span key={d} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:20, fontSize:12, color:'var(--green-2)', fontWeight:600 }}>
                  💊 {d}
                  <button onClick={() => setDrugs(p => p.filter(x => x !== d))}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green-2)', fontSize:14, lineHeight:1, padding:0, marginLeft:2 }}>×</button>
                </span>
              ))}
            </div>
          )}
          {drugs.length === 0 && (
            <div style={{ fontSize:12, color:'var(--ink-5)', fontFamily:'var(--font-mono)' }}>Nenhum medicamento adicionado ainda.</div>
          )}
          {user && (
            <Link href="/mymeds" style={{ display:'inline-block', marginTop:10, fontSize:12, color:'var(--green-2)', textDecoration:'none', fontFamily:'var(--font-mono)' }}>
              → Importar da minha lista de medicamentos
            </Link>
          )}
        </div>

        {/* ── Step 2: Foods ── */}
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:14 }}>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>
            2 — Alimentos e bebidas
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {FOOD_BUTTONS.map(f => {
              const active = selectedFoods.includes(f.id)
              return (
                <button key={f.id} onClick={() => toggleFood(f.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:active?'var(--green-light)':'var(--bg-2)', border:`1.5px solid ${active?'var(--green-mid)':'var(--border)'}`, borderRadius:10, cursor:'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{f.emoji}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:active?'var(--green-2)':'var(--ink)', lineHeight:1.3 }}>{f.label}</div>
                    <div style={{ fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginTop:1 }}>{f.note}</div>
                  </div>
                </button>
              )
            })}
          </div>
          <input value={customFood} onChange={e => setCustomFood(e.target.value)}
            placeholder="Outros alimentos separados por vírgula (ex: nozes, levedura de cerveja)"
            style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }} />
        </div>

        {/* ── Check button ── */}
        <button onClick={check} disabled={!drugs.length || !allFoods.length || loading}
          style={{ width:'100%', padding:'15px', background:drugs.length && allFoods.length && !loading?'var(--green)':'var(--bg-3)', color:drugs.length && allFoods.length && !loading?'white':'var(--ink-5)', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:drugs.length && allFoods.length && !loading?'pointer':'default', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          {loading
            ? <><span style={{ width:16, height:16, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A verificar interações...</>
            : '🔍 Verificar interações fármaco-alimento'}
        </button>

        {error && (
          <div style={{ padding:'12px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, fontSize:13, color:'#991b1b', marginBottom:14 }}>{error}</div>
        )}

        {/* ── Results ── */}
        {result && (
          <div>
            {/* Summary banner */}
            <div style={{ padding:'14px 16px', background: graveCount > 0 ? '#fee2e2' : moderadaCount > 0 ? '#fef9c3' : '#d1fae5', border:`1px solid ${graveCount > 0 ? '#fca5a5' : moderadaCount > 0 ? '#fde68a' : '#6ee7b7'}`, borderRadius:10, marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:24 }}>{graveCount > 0 ? '🚨' : moderadaCount > 0 ? '⚠️' : '✅'}</span>
              <div>
                {graveCount > 0 && <div style={{ fontSize:14, fontWeight:700, color:'#991b1b' }}>{graveCount} interação{graveCount!==1?'ões':''} grave{graveCount!==1?'s':''} detetada{graveCount!==1?'s':''}</div>}
                {moderadaCount > 0 && <div style={{ fontSize:13, fontWeight:600, color:'#854d0e' }}>{moderadaCount} interação{moderadaCount!==1?'ões':''} moderada{moderadaCount!==1?'s':''}</div>}
                {result.summary && <div style={{ fontSize:13, color: graveCount > 0 ? '#991b1b' : moderadaCount > 0 ? '#854d0e' : '#065f46', marginTop:4, lineHeight:1.5 }}>{result.summary}</div>}
              </div>
            </div>

            {/* Interaction cards */}
            {result.interactions.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[...result.interactions].sort((a,b) => {
                  const order = { grave:0, moderada:1, ligeira:2, sem_interacao:3 }
                  return order[a.severity] - order[b.severity]
                }).map((ix, i) => {
                  const s = SEV[ix.severity]
                  return (
                    <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:10, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{s.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.label}</span>
                            <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{ix.drug}</span>
                            <span style={{ fontSize:12, color:s.color, opacity:0.7 }}>+</span>
                            <span style={{ fontSize:13, fontWeight:600, color:s.color }}>{ix.food}</span>
                          </div>
                          {ix.effect && <div style={{ fontSize:13, color:s.color, lineHeight:1.55, marginBottom:6 }}>{ix.effect}</div>}
                          {ix.mechanism && <div style={{ fontSize:11, color:s.color, opacity:0.75, fontFamily:'var(--font-mono)', marginBottom:8 }}>Mecanismo: {ix.mechanism}</div>}
                          <div style={{ padding:'8px 12px', background:'white', borderRadius:7, border:`1px solid ${s.border}`, fontSize:12, color:s.color, fontWeight:600 }}>
                            → {ix.advice}
                            {ix.timing && <span style={{ fontWeight:400, opacity:0.8 }}> · {ix.timing}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:10, padding:'24px', textAlign:'center', marginBottom:16 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#065f46' }}>Sem interações conhecidas</div>
                <div style={{ fontSize:13, color:'#065f46', opacity:0.8, marginTop:4 }}>A combinação selecionada não tem interações clinicamente relevantes documentadas.</div>
              </div>
            )}

            {result.safe_foods.length > 0 && (
              <div style={{ padding:'12px 16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--ink-4)' }}>
                <span style={{ fontWeight:700, color:'var(--ink-3)' }}>Seguros com todos os medicamentos: </span>
                {result.safe_foods.join(' · ')}
              </div>
            )}

            <div style={{ marginTop:10, fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', textAlign:'center', lineHeight:1.5 }}>
              Esta análise é informativa. Confirma sempre com o teu farmacêutico ou médico.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  )
}
