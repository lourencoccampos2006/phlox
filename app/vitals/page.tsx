'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { flagReading, VITAL_LEVEL_COLOR, VITAL_LABEL } from '@/lib/vitalRanges'

interface Vital {
  id: string; recorded_at: string
  hr: number|null; bp_sys: number|null; bp_dia: number|null
  spo2: number|null; weight: number|null; glucose: number|null; temp: number|null; notes: string|null
}
interface TrendAlert { field: string; message: string; severity: 'critical'|'warning'|'info' }
interface TrendAnalysis { alerts: TrendAlert[]; trends: any[]; medication_correlations: any[]; summary: string }
interface HydrationLog { id: string; at: string; fluid_ml: number }

// ─── Peso — gráfico de tendência 30 dias com área (era /pesar) ─────────────────
function WeightTrend({ points }: { points: { date: string; weight: number }[] }) {
  if (points.length < 2) return null
  const min = Math.min(...points.map(p => p.weight)), max = Math.max(...points.map(p => p.weight))
  const range = Math.max(0.5, max - min), padY = range * 0.15
  const W = 600, H = 140
  const path = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : (i / (points.length - 1)) * W
    const norm = (p.weight - (min - padY)) / (range + 2 * padY)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(H - norm * H).toFixed(1)}`
  }).join(' ')
  const latest = points[points.length - 1]
  const monthAgo = points.find(p => new Date(p.date).getTime() >= Date.now() - 30 * 86400000) || points[0]
  const delta = Math.round((latest.weight - monthAgo.weight) * 10) / 10
  const deltaColor = delta < -0.3 ? '#15803d' : delta > 0.3 ? '#b45309' : '#64748b'
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Tendência de peso — 30 dias</div>
        {delta !== 0 && <div style={{ fontSize: 13, fontWeight: 700, color: deltaColor }}>{delta > 0 ? '+' : ''}{delta} kg</div>}
      </div>
      <div style={{ position: 'relative', height: 130 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="weightArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={path + ` L${W},${H} L0,${H} Z`} fill="url(#weightArea)" />
          <path d={path} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

// ─── SVG Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ values, color, width=120, height=36 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values); const max = Math.max(...values)
  const range = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = pad + ((max - v) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1]
  const lx = pad + (width - pad * 2); const ly = pad + ((max - last) / range) * (height - pad * 2)
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  )
}

// ─── Normal ranges for color-coding ────────────────────────────────────────────
function vitalStatus(field: string, value: number): 'normal'|'warning'|'critical' {
  if (field === 'hr')     return value < 50 || value > 100 ? 'warning' : 'normal'
  if (field === 'bp_sys') return value > 180 ? 'critical' : value > 140 ? 'warning' : value < 90 ? 'warning' : 'normal'
  if (field === 'bp_dia') return value > 120 ? 'critical' : value > 90 ? 'warning' : 'normal'
  if (field === 'spo2')   return value < 90 ? 'critical' : value < 95 ? 'warning' : 'normal'
  if (field === 'glucose')return value < 70 || value > 250 ? 'critical' : value > 180 ? 'warning' : 'normal'
  if (field === 'temp')   return value > 39 ? 'critical' : value > 38.5 ? 'warning' : 'normal'
  return 'normal'
}

const STATUS_COLOR = { normal:'var(--ink)', warning:'#d97706', critical:'#dc2626' }

const FIELDS = [
  { key:'hr',      label:'FC',        unit:'bpm',   placeholder:'75',   color:'#dc2626' },
  { key:'bp_sys',  label:'TA Sist.',  unit:'mmHg',  placeholder:'120',  color:'#7c3aed' },
  { key:'bp_dia',  label:'TA Diast.', unit:'mmHg',  placeholder:'80',   color:'#4f46e5' },
  { key:'spo2',    label:'SpO₂',      unit:'%',     placeholder:'98',   color:'#0891b2' },
  { key:'weight',  label:'Peso',      unit:'kg',    placeholder:'70.5', color:'#0d6e42' },
  { key:'glucose', label:'Glicemia',  unit:'mg/dL', placeholder:'95',   color:'#d97706' },
  { key:'temp',    label:'Temp.',     unit:'°C',    placeholder:'36.8', color:'#ea580c' },
]

const WATER_GOAL_KEY = 'phlox-water-goal-ml'

export default function VitalsPage() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [vitals, setVitals] = useState<Vital[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string,string>>({})
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [analysis, setAnalysis] = useState<TrendAnalysis|null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [analysisErr, setAnalysisErr] = useState('')
  const [meds, setMeds] = useState<string[]>([])
  const [expandWeight, setExpandWeight] = useState(false)

  // ── Hidratação (era /agua) — sempre da própria pessoa, não segue o perfil ativo ──
  const [waterLogs, setWaterLogs] = useState<HydrationLog[]>([])
  const [waterGoal, setWaterGoal] = useState(2000)
  const [editingGoal, setEditingGoal] = useState(false)

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  useEffect(() => {
    try { const v = localStorage.getItem(WATER_GOAL_KEY); if (v) setWaterGoal(Number(v) || 2000) } catch { /* noop */ }
  }, [])

  const loadWater = useCallback(async () => {
    if (!user) return
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await supabase.from('hydration_logs')
      .select('id,at,fluid_ml').eq('user_id', user.id).eq('kind', 'fluid')
      .gte('at', since).order('at', { ascending: false }).limit(100)
    setWaterLogs(data || [])
  }, [user, supabase])
  useEffect(() => { loadWater() }, [loadWater])

  async function addWater(ml: number) {
    if (!user) return
    const { data, error } = await supabase.from('hydration_logs').insert({ user_id: user.id, kind: 'fluid', fluid_ml: ml, at: new Date().toISOString() }).select().single()
    if (error) toast.error('Não consegui guardar', reportError('vitals-water', error, 'Tenta de novo.'))
    else if (data) {
      setWaterLogs(p => [data, ...p])
      const todayKey = new Date().toISOString().slice(0, 10)
      const todayTotal = [data, ...waterLogs].filter(l => l.at.slice(0, 10) === todayKey).reduce((s, l) => s + (l.fluid_ml || 0), 0)
      if (todayTotal >= waterGoal) toast.success('Meta atingida! 💧', `${todayTotal} ml hoje. Boa.`)
    }
  }
  async function delWater(id: string) {
    await supabase.from('hydration_logs').delete().eq('id', id)
    setWaterLogs(p => p.filter(l => l.id !== id))
  }
  function saveWaterGoal() {
    try { localStorage.setItem(WATER_GOAL_KEY, String(waterGoal)) } catch { /* noop */ }
    setEditingGoal(false); toast.success('Meta guardada')
  }

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data: sd } = await supabase.auth.getSession()
    const profileParam = activeProfile?.type === 'family' ? `?profile_id=${activeProfile.id}` : ''
    const [vitalsRes, medsRes] = await Promise.all([
      fetch(`/api/vitals${profileParam}`, { headers: { 'Authorization': `Bearer ${sd.session?.access_token}` } }),
      activeProfile?.type === 'family'
        ? supabase.from('family_profile_meds').select('name').eq('profile_id', activeProfile.id)
        : supabase.from('personal_meds').select('name').eq('user_id', user.id),
    ])
    const vitalsData = await vitalsRes.json()
    setVitals(vitalsData.vitals || [])
    setMeds((medsRes.data || []).map((m: any) => m.name))
    setLoading(false)
  }, [user, supabase, activeProfile])

  useEffect(() => { load() }, [load])

  const addVital = async () => {
    if (!user) return
    const hasValue = FIELDS.some(f => form[f.key]?.trim())
    if (!hasValue) return
    setAdding(true)
    const { data: sd } = await supabase.auth.getSession()
    const body: any = { notes: notes || null }
    FIELDS.forEach(f => { if (form[f.key]?.trim()) body[f.key] = parseFloat(form[f.key]) })
    if (activeProfile?.type === 'family') body.profile_id = activeProfile.id
    const res = await fetch('/api/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.id) { setVitals(p => [data, ...p]); setForm({}); setNotes(''); setShowForm(false) }
    setAdding(false)
    setAnalysis(null)
  }

  const deleteVital = async (id: string) => {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/vitals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ id }),
    })
    setVitals(p => p.filter(v => v.id !== id))
  }

  const analyse = async () => {
    if (vitals.length < 2) return
    setAnalysing(true); setAnalysis(null); setAnalysisErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/vitals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ vitals: vitals.slice(0, 30), medications: meds }),
      })
      const data = await res.json()
      // BUG CORRIGIDO 2026-07-17: em erro (429 rate-limit, 401, 500) a API
      // devolve {error: msg} sem "alerts" — sem este check, analysis?.alerts
      // é undefined (analysis?. só protege null, não as suas propriedades) e
      // .filter() rebenta a página inteira ao renderizar.
      if (!res.ok || !Array.isArray(data?.alerts)) { setAnalysisErr(data?.error || 'Não foi possível analisar agora.'); return }
      setAnalysis(data)
    } catch (e: any) {
      setAnalysisErr(e?.message || 'Erro de ligação.')
    } finally {
      setAnalysing(false)
    }
  }

  // Build sparkline data per field
  const sparkData = (field: string) =>
    vitals.slice(0, 30).reverse().map(v => (v as any)[field]).filter((v: any) => v != null) as number[]

  // Latest values
  const latest = vitals[0]

  const criticalAlerts = analysis?.alerts.filter(a => a.severity === 'critical') || []
  const warnings = analysis?.alerts.filter(a => a.severity === 'warning') || []

  // ── Derivados de hidratação ──
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayWaterLogs = waterLogs.filter(l => l.at.slice(0, 10) === todayKey)
  const todayWaterMl = todayWaterLogs.reduce((s, l) => s + (l.fluid_ml || 0), 0)
  const waterPct = Math.min(100, Math.round((todayWaterMl / waterGoal) * 100))
  const waterDays: { key: string; label: string; ml: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    const ml = waterLogs.filter(l => l.at.slice(0, 10) === key).reduce((s, l) => s + (l.fluid_ml || 0), 0)
    waterDays.push({ key, label: d.toLocaleDateString('pt-PT', { weekday: 'short' }).slice(0, 3), ml })
  }
  const maxWaterDayMl = Math.max(waterGoal, ...waterDays.map(d => d.ml))

  // ── Pontos de peso (a partir dos vitais já carregados) para o gráfico de tendência ──
  const weightPoints = vitals.filter(v => v.weight != null).map(v => ({ date: v.recorded_at, weight: v.weight as number })).reverse()

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>


      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:20 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>
                {activeProfile?.type === 'family' ? `Sinais Vitais de` : 'Sinais Vitais'}
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', fontWeight:400 }}>
                {activeProfile?.type === 'family' ? activeProfile.name : (loading ? '—' : `${vitals.length} ${vitals.length===1?'medição':'medições'}`)}
              </div>
              {activeProfile?.type === 'family' && !loading && (
                <div style={{ fontSize:12, color:'var(--ink-4)', marginTop:3, fontFamily:'var(--font-mono)' }}>
                  {vitals.length} {vitals.length===1?'medição':'medições'}
                  {activeProfile.age ? ` · ${activeProfile.age} anos` : ''}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <ProfileSelector onChange={p => { setActiveProfileState(p); setVitals([]); setAnalysis(null); setLoading(true) }} />
              {vitals.length >= 2 && (
                <button onClick={analyse} disabled={analysing}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:analysing?'var(--bg-3)':'#4f46e5', color:analysing?'var(--ink-4)':'white', border:'none', borderRadius:8, cursor:analysing?'wait':'pointer', fontSize:13, fontWeight:700 }}>
                  {analysing ? <><span style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A analisar...</> : '🧠 Analisar tendências'}
                </button>
              )}
              <button onClick={() => setShowForm(p => !p)}
                style={{ padding:'10px 18px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {showForm ? '—' : '+ Registar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {analysisErr && (
          <div style={{ padding:'12px 16px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:10, marginBottom:16, fontSize:13, color:'#991b1b' }}>{analysisErr}</div>
        )}

        {/* ─── AI Analysis ─── */}
        {analysis && (
          <div style={{ marginBottom:20 }}>
            {criticalAlerts.length > 0 && criticalAlerts.map((a, i) => (
              <div key={i} style={{ padding:'14px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, marginBottom:8, display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>🚨</span>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#991b1b', marginBottom:2 }}>{a.message}</div>
                  <div style={{ fontSize:11, color:'#991b1b', fontFamily:'var(--font-mono)', opacity:0.7 }}>{a.field}</div>
                </div>
                {/* Valor crítico → ação direta, sem passar por uma página intermédia. */}
                <a href="tel:112" style={{ alignSelf:'center', padding:'8px 14px', background:'#991b1b', color:'white', borderRadius:8, fontSize:12.5, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                  📞 Ligar 112
                </a>
              </div>
            ))}
            {warnings.length > 0 && warnings.map((a, i) => (
              <div key={i} style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10, marginBottom:8, display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#854d0e' }}>{a.message}</div>
                </div>
              </div>
            ))}
            {analysis.medication_correlations?.length > 0 && analysis.medication_correlations.map((c: any, i: number) => (
              <div key={i} style={{ padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:8, fontSize:13, color:'#1d4ed8' }}>
                <span style={{ fontWeight:700 }}>💊 {c.drug}</span> · {c.observation}
              </div>
            ))}
            {analysis.summary && (
              <div style={{ padding:'14px 16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, fontSize:13, color:'var(--ink-3)', lineHeight:1.6 }}>
                🧠 {analysis.summary}
              </div>
            )}
          </div>
        )}

        {/* ─── Add form ─── */}
        {showForm && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>Nova medição</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:10 }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:4 }}>
                    {f.label} <span style={{ color:'var(--ink-5)', fontWeight:400 }}>({f.unit})</span>
                  </label>
                  <input value={form[f.key] || ''} onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder} type="number" step="any"
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 10px', fontSize:13, outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            {/* Aviso inteligente na hora — avalia os valores contra o intervalo seguro
                da pessoa (idade/condições). Só aparece o que sai do habitual. (Ronda 12) */}
            {(() => {
              const vals = { bp_sys: form.bp_sys, bp_dia: form.bp_dia, hr: form.hr, spo2: form.spo2, temp: form.temp, glucose: form.glucose }
              const num: any = {}; Object.entries(vals).forEach(([k, v]) => { if (v && v.trim() && !isNaN(Number(v))) num[k] = Number(v) })
              const flags = flagReading(num, { age: activeProfile?.age, conditions: activeProfile?.conditions })
              if (flags.length === 0) return null
              return (
                <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {flags.map(({ field, reading }) => {
                    const c = VITAL_LEVEL_COLOR[reading.level]
                    return (
                      <div key={field} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 9, padding: '8px 11px' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: c.color }}>
                          {reading.level === 'critical' ? '🔴' : '🟠'} {VITAL_LABEL[field]}: {reading.label} <span style={{ fontWeight: 400, color: '#94a3b8' }}>(ref. {reading.range})</span>
                        </div>
                        {reading.watch && <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.45 }}>{reading.watch}</div>}
                      </div>
                    )
                  })}
                  <div style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.4 }}>Sinal a partir de intervalos de referência — não é diagnóstico. A avaliação é do profissional.</div>
                </div>
              )
            })()}
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas (opcional)"
              style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'9px 12px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box', marginBottom:10 }} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={addVital} disabled={adding}
                style={{ flex:1, padding:'12px', background:'var(--green)', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                {adding ? 'A guardar...' : 'Guardar medição'}
              </button>
              <button onClick={() => { setShowForm(false); setForm({}) }}
                style={{ padding:'12px 16px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ─── Sparkline dashboard ─── */}
        {!loading && vitals.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginBottom:20 }}>
            {FIELDS.filter(f => sparkData(f.key).length > 0).map(f => {
              const data = sparkData(f.key)
              const latestVal = (latest as any)?.[f.key] as number|null
              const status = latestVal != null ? vitalStatus(f.key, latestVal) : 'normal'
              const clickable = f.key === 'weight' && weightPoints.length >= 2
              return (
                <div key={f.key} onClick={clickable ? () => setExpandWeight(p => !p) : undefined}
                  style={{ background:'white', border:`1.5px solid ${status==='critical'?'#fca5a5':status==='warning'?'#fde68a':'var(--border)'}`, borderRadius:10, padding:'14px 16px', cursor: clickable ? 'pointer' : 'default' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:2 }}>{f.label}</div>
                      <div style={{ fontSize:22, fontWeight:700, color: STATUS_COLOR[status], fontFamily:'var(--font-mono)', lineHeight:1 }}>
                        {latestVal != null ? latestVal : '—'}
                        <span style={{ fontSize:11, fontWeight:400, color:'var(--ink-5)', marginLeft:3 }}>{f.unit}</span>
                      </div>
                    </div>
                    {status !== 'normal' && <span style={{ fontSize:16 }}>{status==='critical'?'🚨':'⚠️'}</span>}
                  </div>
                  <Sparkline values={data} color={status==='critical'?'#dc2626':status==='warning'?'#d97706':f.color} />
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', marginTop:4 }}>{data.length} med{data.length!==1?'ições':'ição'}{clickable ? ' · toca para ver tendência' : ''}</div>
                </div>
              )
            })}
          </div>
        )}

        {expandWeight && weightPoints.length >= 2 && <WeightTrend points={weightPoints} />}

        {/* ─── Hidratação (era /agua) ─── */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>💧 Hidratação</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{todayWaterMl} / {waterGoal} ml hoje · {waterPct}%</div>
          </div>
          <div style={{ height: 14, background: '#e0f2fe', borderRadius: 7, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${waterPct}%`, background: waterPct >= 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#0284c7,#0ea5e9,#38bdf8)', borderRadius: 7, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[{ ml: 200, label: '200 ml' }, { ml: 330, label: '330 ml' }, { ml: 500, label: '500 ml' }, { ml: 750, label: '750 ml' }].map(b => (
              <button key={b.ml} onClick={() => addWater(b.ml)} style={{ padding: '10px 6px', background: 'white', border: '1.5px solid #bae6fd', borderRadius: 9, cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, color: '#0c4a6e' }}>
                💧 {b.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, alignItems: 'flex-end', height: 70, marginBottom: 10 }}>
            {waterDays.map(d => {
              const h = Math.max(6, Math.round((d.ml / maxWaterDayMl) * 100))
              const reach = d.ml >= waterGoal
              return (
                <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', maxWidth: 24, height: `${h}%`, background: reach ? 'linear-gradient(180deg,#22c55e,#16a34a)' : 'linear-gradient(180deg,#bae6fd,#7dd3fc)', borderRadius: 5 }} />
                  <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Meta diária</div>
            {editingGoal ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min={500} max={5000} step={250} value={waterGoal} onChange={e => setWaterGoal(Number(e.target.value))} style={{ width: 90, border: '1.5px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 12.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={saveWaterGoal} style={{ padding: '6px 12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
              </div>
            ) : (
              <button onClick={() => setEditingGoal(true)} style={{ fontSize: 12.5, fontWeight: 700, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer' }}>{waterGoal} ml — Mudar</button>
            )}
          </div>
          {todayWaterLogs.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 10 }}>
              {todayWaterLogs.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>💧 {l.fluid_ml} ml</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{new Date(l.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => delWater(l.id)} aria-label="Remover" style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── History table ─── */}
        {!loading && vitals.length > 0 && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              Histórico
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg-2)' }}>
                    <th style={{ textAlign:'left', padding:'8px 16px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap' }}>Data</th>
                    {FIELDS.map(f => (
                      <th key={f.key} style={{ textAlign:'right', padding:'8px 10px', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-5)', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:700, whiteSpace:'nowrap' }}>{f.label}</th>
                    ))}
                    <th style={{ width:32 }} />
                  </tr>
                </thead>
                <tbody>
                  {vitals.slice(0, 60).map((v, i) => (
                    <tr key={v.id} style={{ borderTop:i>0?'1px solid var(--bg-3)':'none' }}>
                      <td style={{ padding:'10px 16px', color:'var(--ink-4)', fontFamily:'var(--font-mono)', fontSize:11, whiteSpace:'nowrap' }}>
                        {new Date(v.recorded_at).toLocaleDateString('pt-PT', { day:'2-digit', month:'short' })}
                        <span style={{ marginLeft:6, color:'var(--ink-5)' }}>
                          {new Date(v.recorded_at).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </td>
                      {FIELDS.map(f => {
                        const val = (v as any)[f.key] as number|null
                        const st = val != null ? vitalStatus(f.key, val) : 'normal'
                        return (
                          <td key={f.key} style={{ textAlign:'right', padding:'10px 10px', fontFamily:'var(--font-mono)', fontWeight:val!=null?600:400, color:val!=null?STATUS_COLOR[st]:'var(--ink-5)', whiteSpace:'nowrap' }}>
                            {val != null ? val : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding:'10px 12px', textAlign:'right' }}>
                        <button aria-label="Eliminar" onClick={() => deleteVital(v.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-5)', fontSize:14, padding:0, lineHeight:1 }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && vitals.length === 0 && (
          <div style={{ background:'white', border:'2px dashed var(--border)', borderRadius:12, padding:'56px 24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:14 }}>💓</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Nenhuma medição ainda</div>
            <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:24, maxWidth:360, margin:'0 auto 24px' }}>
              Regista a tua tensão arterial, frequência cardíaca, SpO₂, peso e glicemia. A IA deteta tendências e correlações com a tua medicação.
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ background:'var(--green)', color:'white', border:'none', borderRadius:8, padding:'12px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Registar primeira medição →
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
