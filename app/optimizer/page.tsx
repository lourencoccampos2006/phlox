'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface Med { id:string; name:string; dose:string|null; frequency:string|null; indication:string|null }
interface SavingItem { drug:string; brand_cost:string; generic_name:string; generic_cost:string; monthly_saving:string; equivalence_note:string }
interface SafetyFlag { drug:string; issue:string; reason:string; severity:'high'|'medium'|'low'; action:string; evidence:string }
interface MonitoringGap { drug:string; monitoring:string; frequency:string; last_done:string|null; why_important:string }
interface DoseReview { drug:string; current_dose:string; suggested_dose:string; reason:string; condition:string }
interface Result { savings:SavingItem[]; safety_flags:SafetyFlag[]; monitoring_gaps:MonitoringGap[]; dose_reviews:DoseReview[]; summary:string; total_monthly_saving_estimate:string }

const SEV_FLAG = {
  high:   { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', icon:'🔴', label:'Alto risco' },
  medium: { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', icon:'🟡', label:'Moderado' },
  low:    { bg:'#f0fdf4', border:'#bbf7d0', color:'#166534', icon:'🟢', label:'Baixo' },
}

const CONDITION_ICON: Record<string,string> = {
  renal:'🫘', hepatic:'🫀', age:'👴', weight:'⚖️', interaction:'⚡', guideline:'📋'
}

export default function OptimizerPage() {
  const { user, supabase } = useAuth()
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [mode, setMode] = useState<'personal'|'clinical'>('personal')
  const [age, setAge] = useState('')
  const plan = (user?.plan || 'free') as string
  const canRun = plan !== 'free'

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('personal_meds').select('*').eq('user_id', user.id).then(({ data }) => {
      setMeds(data || [])
      setLoading(false)
    })
  }, [user, supabase])

  const run = async () => {
    if (!meds.length) return
    setRunning(true); setResult(null); setError(null)
    const { data: sd } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          medications: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency, indication: m.indication })),
          patient: { age: age ? parseInt(age) : null },
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message) }
    setRunning(false)
  }

  const totalIssues = result ? result.safety_flags.length + result.monitoring_gaps.length + result.dose_reviews.length : 0
  const highRisk = result?.safety_flags.filter(f => f.severity === 'high').length || 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />

      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:20 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Otimização de Prescrição</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--ink)', fontWeight:400, marginBottom:6 }}>Farmacêutico AI</div>
              <div style={{ fontSize:13, color:'var(--ink-4)', lineHeight:1.55, maxWidth:540 }}>
                Análise completa da tua medicação: poupanças com genéricos, sinalizadores de segurança, monitorização em falta e revisão de doses.
              </div>
            </div>
            <ProfileSelector onChange={p => setActiveProfileState(p)} />
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth:720 }}>

        {/* ─── Setup ─── */}
        {!result && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:24, marginBottom:16 }}>

            {/* Medication list preview */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>
                Medicamentos a analisar ({meds.length})
              </div>
              {loading ? (
                <div className="skeleton" style={{ height:56, borderRadius:8 }} />
              ) : meds.length === 0 ? (
                <div style={{ padding:'20px', background:'var(--bg-2)', borderRadius:8, textAlign:'center' }}>
                  <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:10 }}>Nenhum medicamento na tua lista.</div>
                  <Link href="/mymeds" style={{ fontSize:13, color:'var(--green-2)', textDecoration:'none', fontWeight:700 }}>→ Adicionar medicamentos em "Os Meus Medicamentos"</Link>
                </div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {meds.map(m => (
                    <span key={m.id} style={{ padding:'5px 11px', background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:20, fontSize:12, color:'var(--green-2)', fontWeight:600 }}>
                      💊 {m.name}{m.dose ? ` ${m.dose}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              <div>
                <label style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Modo</label>
                <div style={{ display:'flex', gap:6 }}>
                  {(['personal','clinical'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      style={{ flex:1, padding:'9px', background:mode===m?'var(--green-light)':'var(--bg-2)', border:`1.5px solid ${mode===m?'var(--green-mid)':'var(--border)'}`, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:mode===m?700:400, color:mode===m?'var(--green-2)':'var(--ink-4)' }}>
                      {m === 'personal' ? '👤 Pessoal' : '🏥 Clínico'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Idade (opcional)</label>
                <input value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 72" type="number"
                  style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
              </div>
            </div>

            {!canRun ? (
              <div style={{ padding:'16px', background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:10, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:24 }}>⚡</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--green-2)', marginBottom:2 }}>Requer plano Student ou superior</div>
                  <div style={{ fontSize:12, color:'var(--green-2)', opacity:0.8 }}>Análise completa de prescrição disponível a partir de 3,99€/mês.</div>
                </div>
                <Link href="/pricing" style={{ padding:'9px 16px', background:'var(--green)', color:'white', textDecoration:'none', borderRadius:8, fontSize:13, fontWeight:700, flexShrink:0 }}>Ver planos →</Link>
              </div>
            ) : (
              <button onClick={run} disabled={!meds.length || running}
                style={{ width:'100%', padding:'15px', background:meds.length && !running?'var(--green)':'var(--bg-3)', color:meds.length && !running?'white':'var(--ink-5)', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:meds.length && !running?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                {running
                  ? <><span style={{ width:16, height:16, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A analisar {meds.length} medicamentos...</>
                  : `⚡ Otimizar prescrição (${meds.length} medicamentos)`}
              </button>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding:'12px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, fontSize:13, color:'#991b1b', marginBottom:14 }}>{error}</div>
        )}

        {/* ─── Results ─── */}
        {result && (
          <div>
            {/* Executive summary */}
            <div style={{ padding:'18px 20px', background: highRisk > 0 ? '#fee2e2' : '#d1fae5', border:`1px solid ${highRisk > 0 ? '#fca5a5' : '#6ee7b7'}`, borderRadius:12, marginBottom:20, display:'flex', alignItems:'flex-start', gap:14 }}>
              <span style={{ fontSize:28, flexShrink:0 }}>{highRisk > 0 ? '⚠️' : '✅'}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:8 }}>
                  {totalIssues > 0 && <span style={{ fontSize:13, fontWeight:700, color: highRisk > 0 ? '#991b1b' : '#065f46' }}>{totalIssues} pontos de melhoria identificados</span>}
                  {result.total_monthly_saving_estimate && (
                    <span style={{ fontSize:13, fontWeight:700, color:'#065f46', background:'rgba(255,255,255,0.7)', padding:'2px 10px', borderRadius:20 }}>
                      💰 Poupança estimada: {result.total_monthly_saving_estimate}
                    </span>
                  )}
                </div>
                {result.summary && <div style={{ fontSize:13, color: highRisk > 0 ? '#991b1b' : '#065f46', lineHeight:1.6 }}>{result.summary}</div>}
              </div>
            </div>

            <button onClick={() => setResult(null)} style={{ marginBottom:20, padding:'8px 14px', background:'white', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer', color:'var(--ink-4)' }}>
              ← Nova análise
            </button>

            {/* Savings */}
            {result.savings.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  💰 Poupanças com genéricos
                  <span style={{ fontSize:11, color:'var(--green-2)', background:'var(--green-light)', border:'1px solid var(--green-mid)', padding:'2px 8px', borderRadius:20, fontWeight:400 }}>{result.savings.length} oportunidade{result.savings.length!==1?'s':''}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {result.savings.map((s, i) => (
                    <div key={i} style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:200 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>{s.drug}</div>
                          <div style={{ fontSize:12, color:'var(--ink-4)', marginBottom:4 }}>
                            → Genérico: <span style={{ fontWeight:700, color:'var(--ink-3)' }}>{s.generic_name}</span>
                          </div>
                          {s.equivalence_note && <div style={{ fontSize:11, color:'var(--ink-5)', fontStyle:'italic' }}>{s.equivalence_note}</div>}
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:11, color:'var(--ink-5)', textDecoration:'line-through', fontFamily:'var(--font-mono)' }}>{s.brand_cost}</div>
                          <div style={{ fontSize:12, color:'var(--green-2)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{s.generic_cost}</div>
                          <div style={{ fontSize:14, fontWeight:700, color:'#065f46', background:'#d1fae5', padding:'3px 10px', borderRadius:20, marginTop:4, border:'1px solid #6ee7b7' }}>
                            -{s.monthly_saving}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety flags */}
            {result.safety_flags.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  🔴 Sinalizadores de segurança
                  <span style={{ fontSize:11, color:'#991b1b', background:'#fee2e2', border:'1px solid #fca5a5', padding:'2px 8px', borderRadius:20, fontWeight:400 }}>{result.safety_flags.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[...result.safety_flags].sort((a,b) => ({high:0,medium:1,low:2}[a.severity])-({high:0,medium:1,low:2}[b.severity])).map((f, i) => {
                    const s = SEV_FLAG[f.severity]
                    return (
                      <div key={i} style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                              <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{f.drug}</span>
                              <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.label}</span>
                              {f.evidence && <span style={{ fontSize:10, color:s.color, opacity:0.6, fontFamily:'var(--font-mono)' }}>{f.evidence}</span>}
                            </div>
                            <div style={{ fontSize:13, fontWeight:600, color:s.color, marginBottom:4 }}>{f.issue}</div>
                            {f.reason && <div style={{ fontSize:12, color:s.color, opacity:0.85, lineHeight:1.5, marginBottom:8 }}>{f.reason}</div>}
                            <div style={{ padding:'7px 12px', background:'white', borderRadius:7, border:`1px solid ${s.border}`, fontSize:12, color:s.color, fontWeight:600 }}>
                              → {f.action}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Monitoring gaps */}
            {result.monitoring_gaps.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  🔬 Monitorização em falta
                  <span style={{ fontSize:11, color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', padding:'2px 8px', borderRadius:20, fontWeight:400 }}>{result.monitoring_gaps.length}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:8 }}>
                  {result.monitoring_gaps.map((m, i) => (
                    <div key={i} style={{ background:'white', border:'1px solid #bfdbfe', borderRadius:10, padding:'13px 15px' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:3 }}>{m.drug}</div>
                      <div style={{ fontSize:12, fontWeight:600, color:'#1d4ed8', marginBottom:3 }}>🔬 {m.monitoring}</div>
                      <div style={{ fontSize:11, color:'#1d4ed8', fontFamily:'var(--font-mono)', marginBottom:4, opacity:0.7 }}>Freq: {m.frequency}</div>
                      <div style={{ fontSize:11, color:'var(--ink-4)', lineHeight:1.45 }}>{m.why_important}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dose reviews */}
            {result.dose_reviews.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                  ⚖️ Revisão de doses
                  <span style={{ fontSize:11, color:'#92400e', background:'#fff7ed', border:'1px solid #fed7aa', padding:'2px 8px', borderRadius:20, fontWeight:400 }}>{result.dose_reviews.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {result.dose_reviews.map((d, i) => (
                    <div key={i} style={{ background:'white', border:'1px solid #fed7aa', borderRadius:10, padding:'13px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:18 }}>{CONDITION_ICON[d.condition] || '💊'}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{d.drug}</span>
                        <span style={{ fontSize:12, color:'var(--ink-4)', textDecoration:'line-through', fontFamily:'var(--font-mono)' }}>{d.current_dose}</span>
                        <span style={{ fontSize:14 }}>→</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#d97706', fontFamily:'var(--font-mono)' }}>{d.suggested_dose}</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5 }}>{d.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding:'12px 16px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', lineHeight:1.5 }}>
              Este relatório é gerado por IA e destina-se a suporte à decisão. Não substitui a avaliação de um farmacêutico ou médico. Discute qualquer alteração de medicação com o teu profissional de saúde.
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
