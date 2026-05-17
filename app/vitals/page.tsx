'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'

interface Vital {
  id: string; recorded_at: string
  hr: number|null; bp_sys: number|null; bp_dia: number|null
  spo2: number|null; weight: number|null; glucose: number|null; temp: number|null; notes: string|null
}
interface TrendAlert { field: string; message: string; severity: 'critical'|'warning'|'info' }
interface TrendAnalysis { alerts: TrendAlert[]; trends: any[]; medication_correlations: any[]; summary: string }

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

export default function VitalsPage() {
  const { user, supabase } = useAuth()
  const [vitals, setVitals] = useState<Vital[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string,string>>({})
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [analysis, setAnalysis] = useState<TrendAnalysis|null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [meds, setMeds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data: sd } = await supabase.auth.getSession()
    const [vitalsRes, medsRes] = await Promise.all([
      fetch('/api/vitals', { headers: { 'Authorization': `Bearer ${sd.session?.access_token}` } }),
      supabase.from('personal_meds').select('name').eq('user_id', user.id),
    ])
    const vitalsData = await vitalsRes.json()
    setVitals(vitalsData.vitals || [])
    setMeds((medsRes.data || []).map((m: any) => m.name))
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const addVital = async () => {
    if (!user) return
    const hasValue = FIELDS.some(f => form[f.key]?.trim())
    if (!hasValue) return
    setAdding(true)
    const { data: sd } = await supabase.auth.getSession()
    const body: any = { notes: notes || null }
    FIELDS.forEach(f => { if (form[f.key]?.trim()) body[f.key] = parseFloat(form[f.key]) })
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
    setAnalysing(true); setAnalysis(null)
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/vitals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ vitals: vitals.slice(0, 30), medications: meds }),
    })
    const data = await res.json()
    setAnalysis(data)
    setAnalysing(false)
  }

  // Build sparkline data per field
  const sparkData = (field: string) =>
    vitals.slice(0, 30).reverse().map(v => (v as any)[field]).filter((v: any) => v != null) as number[]

  // Latest values
  const latest = vitals[0]

  const criticalAlerts = analysis?.alerts.filter(a => a.severity === 'critical') || []
  const warnings = analysis?.alerts.filter(a => a.severity === 'warning') || []

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />

      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:20 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Sinais Vitais</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', fontWeight:400 }}>
                {loading ? '—' : `${vitals.length} ${vitals.length===1?'medição':'medições'}`}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
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

        {/* ─── AI Analysis ─── */}
        {analysis && (
          <div style={{ marginBottom:20 }}>
            {criticalAlerts.length > 0 && criticalAlerts.map((a, i) => (
              <div key={i} style={{ padding:'14px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, marginBottom:8, display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>🚨</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#991b1b', marginBottom:2 }}>{a.message}</div>
                  <div style={{ fontSize:11, color:'#991b1b', fontFamily:'var(--font-mono)', opacity:0.7 }}>{a.field}</div>
                </div>
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
              return (
                <div key={f.key} style={{ background:'white', border:`1.5px solid ${status==='critical'?'#fca5a5':status==='warning'?'#fde68a':'var(--border)'}`, borderRadius:10, padding:'14px 16px' }}>
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
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-5)', marginTop:4 }}>{data.length} med{data.length!==1?'ições':'ição'}</div>
                </div>
              )
            })}
          </div>
        )}

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
                        <button onClick={() => deleteVital(v.id)}
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
