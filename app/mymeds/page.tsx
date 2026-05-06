'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'
import { resolveDrugName, suggestDrugs } from '@/lib/drugNames'

interface Med {
  id: string; name: string; dose: string|null
  frequency: string|null; indication: string|null
  started_at: string|null; created_at: string
}

interface Alert {
  severity: 'grave'|'moderada'|'info'
  message: string; action: string; drugs?: string[]
}

const SEV = {
  grave:    { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', dot:'#dc2626', label:'GRAVE',    icon:'🚨' },
  moderada: { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', dot:'#d97706', label:'MODERADA', icon:'⚠️' },
  info:     { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', dot:'#3b82f6', label:'INFO',     icon:'ℹ️' },
}

function RiskScore({ score, alerts }: { score: number; alerts: Alert[] }) {
  const level = score >= 60 ? 'critical' : score >= 30 ? 'moderate' : 'low'
  const style = {
    critical: { color:'#991b1b', bg:'#fee2e2', label:'Risco Elevado',   desc:'Requer atenção médica imediata' },
    moderate: { color:'#854d0e', bg:'#fef9c3', label:'Risco Moderado',  desc:'Discute com o teu farmacêutico' },
    low:      { color:'#0d6e42', bg:'#d1fae5', label:'Risco Baixo',     desc:'Sem problemas conhecidos' },
  }[level]

  return (
    <div style={{ background:style.bg, border:`1px solid`, borderColor:level==='critical'?'#fca5a5':level==='moderate'?'#fde68a':'#6ee7b7', borderRadius:10, padding:'16px 18px', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ textAlign:'center', flexShrink:0 }}>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:40, color:style.color, lineHeight:1 }}>{score}</div>
        <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:style.color, textTransform:'uppercase', letterSpacing:'0.08em', marginTop:2 }}>score</div>
      </div>
      <div style={{ width:1, height:44, background:`${style.color}30`, flexShrink:0 }} />
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:style.color, marginBottom:3 }}>{style.label}</div>
        <div style={{ fontSize:12, color:style.color, opacity:0.8 }}>{style.desc}</div>
        <div style={{ fontSize:11, color:style.color, opacity:0.6, fontFamily:'var(--font-mono)', marginTop:3 }}>
          {alerts.filter(a=>a.severity==='grave').length} grave · {alerts.filter(a=>a.severity==='moderada').length} moderada
        </div>
      </div>
      <div style={{ marginLeft:'auto', flexShrink:0 }}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="22" fill="none" stroke={`${style.color}20`} strokeWidth="6" />
          <circle cx="26" cy="26" r="22" fill="none" stroke={style.color} strokeWidth="6"
            strokeDasharray={`${(score/100)*138} 138`} strokeLinecap="round"
            transform="rotate(-90 26 26)" />
        </svg>
      </div>
    </div>
  )
}

export default function MyMedsPage() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<Med[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [analysing, setAnalysing] = useState(false)
  const [analysed, setAnalysed] = useState(false)
  const [tab, setTab] = useState<'overview'|'alerts'|'add'>('overview')
  const [newMed, setNewMed] = useState({ name:'', dose:'', frequency:'', indication:'' })
  const [adding, setAdding] = useState(false)
  const [suggestions, setSuggestions] = useState<{ display: string; dci: string; isBrand: boolean }[]>([])
  const plan = (user?.plan||'free') as string
  const canAnalyse = plan !== 'free'

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('personal_meds').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setMeds(data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const analyse = async () => {
    if (meds.length < 2) return
    setAnalysing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/quickcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ medications: meds.map(m => `${m.name}${m.dose?' '+m.dose:''}${m.frequency?' '+m.frequency:''}`).join('\n'), mode: 'simple' }),
      })
      const data = await res.json()
      if (data.alerts) {
        setAlerts(data.alerts)
        const critical = data.alerts.filter((a: Alert) => a.severity==='grave').length
        const moderate = data.alerts.filter((a: Alert) => a.severity==='moderada').length
        setRiskScore(Math.min(100, critical*30 + moderate*15 + Math.min(25, meds.length*3)))
        setAnalysed(true)
        setTab('alerts')
      }
    } catch {}
    setAnalysing(false)
  }

  const addMed = async () => {
    if (!newMed.name.trim() || !user) return
    setAdding(true)
    const resolved = resolveDrugName(newMed.name)
    const finalName = resolved ? resolved.dci : newMed.name.trim()
    const { data } = await supabase.from('personal_meds').insert({
      user_id: user.id, name: finalName,
      dose: newMed.dose || null, frequency: newMed.frequency || null, indication: newMed.indication || null,
    }).select().single()
    if (data) { setMeds(p => [data, ...p]); setAnalysed(false) }
    setNewMed({ name:'', dose:'', frequency:'', indication:'' })
    setSuggestions([])
    setAdding(false)
    setTab('overview')
  }

  const removeMed = async (id: string) => {
    await supabase.from('personal_meds').delete().eq('id', id)
    setMeds(p => p.filter(m => m.id !== id))
    setAnalysed(false)
  }

  const tabStyle = (t: string) => ({
    padding:'9px 16px', background:'none', border:'none',
    borderBottom:`2px solid ${tab===t?'var(--green)':'transparent'}`,
    cursor:'pointer', fontSize:12, fontWeight:700,
    color:tab===t?'var(--green)':'var(--ink-4)',
    fontFamily:'var(--font-sans)', letterSpacing:'0.04em',
    textTransform:'uppercase' as const, marginBottom:-1, whiteSpace:'nowrap' as const,
  })

  const unreadAlerts = alerts.filter(a => a.severity==='grave').length

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />

      {/* Page header */}
      <div style={{ background:'white', borderBottom:'1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Os Meus Medicamentos</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', fontWeight:400 }}>
                {loading ? '—' : `${meds.length} medicamento${meds.length!==1?'s':''}`}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {canAnalyse && meds.length >= 2 && (
                <button onClick={analyse} disabled={analysing}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 16px', background:analysing?'var(--bg-3)':'var(--green)', color:analysing?'var(--ink-4)':'white', border:'none', borderRadius:8, cursor:analysing?'wait':'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                  {analysing ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />A analisar...</> : '⚡ Analisar interações'}
                </button>
              )}
              <Link href="/ai" style={{ padding:'10px 16px', background:'white', color:'var(--ink)', border:'1px solid var(--border)', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:700 }}>
                🤖 Perguntar à AI
              </Link>
            </div>
          </div>
          <div style={{ display:'flex', borderTop:'1px solid var(--border)', overflowX:'auto' }}>
            <button onClick={() => setTab('overview')} style={tabStyle('overview')}>Medicação</button>
            <button onClick={() => setTab('alerts')} style={tabStyle('alerts')}>
              Alertas {unreadAlerts>0 && <span style={{ marginLeft:4, background:'#dc2626', color:'white', fontSize:9, fontFamily:'var(--font-mono)', padding:'1px 5px', borderRadius:10, fontWeight:700 }}>{unreadAlerts}</span>}
            </button>
            <button onClick={() => setTab('add')} style={tabStyle('add')}>+ Adicionar</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            {/* Risk score */}
            {analysed && <div style={{ marginBottom:14 }}><RiskScore score={riskScore} alerts={alerts} /></div>}

            {!canAnalyse && meds.length >= 2 && (
              <div style={{ background:'var(--green-light)', border:'1px solid var(--green-mid)', borderRadius:10, padding:'14px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>⚡</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--green-2)', marginBottom:2 }}>Verifica as interações entre os teus {meds.length} medicamentos</div>
                  <div style={{ fontSize:12, color:'var(--green-2)', opacity:0.8 }}>Disponível no plano Student — 3,99€/mês</div>
                </div>
                <Link href="/pricing" style={{ padding:'8px 14px', background:'var(--green)', color:'white', textDecoration:'none', borderRadius:7, fontSize:12, fontWeight:700, flexShrink:0 }}>
                  Desbloquear →
                </Link>
              </div>
            )}

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:72, borderRadius:8 }} />)}
              </div>
            ) : meds.length === 0 ? (
              <div style={{ background:'white', border:'2px dashed var(--border)', borderRadius:10, padding:'56px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>💊</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Nenhum medicamento ainda</div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>Adiciona os teus medicamentos para verificar interações e receber alertas.</div>
                <button onClick={() => setTab('add')} style={{ background:'var(--green)', color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Adicionar primeiro medicamento →
                </button>
              </div>
            ) : (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                {meds.map((med, i) => {
                  const medAlerts = alerts.filter(a => a.drugs?.some(d => d.toLowerCase().includes(med.name.toLowerCase())))
                  const hasGrave = medAlerts.some(a => a.severity==='grave')
                  return (
                    <div key={med.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:i<meds.length-1?'1px solid var(--bg-3)':'none' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:hasGrave?'#fee2e2':'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                        💊
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'var(--ink)', letterSpacing:'-0.01em' }}>{med.name}</span>
                          {hasGrave && <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:'#991b1b', background:'#fee2e2', border:'1px solid #fca5a5', padding:'1px 5px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Alerta</span>}
                        </div>
                        <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                          {[med.dose, med.frequency, med.indication].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <Link href={`/ai?q=${encodeURIComponent(`Fala-me sobre ${med.name}${med.dose?' '+med.dose:''} — indicações, efeitos adversos e interações importantes`)}`}
                          style={{ padding:'6px 10px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:6, textDecoration:'none', fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', fontWeight:700 }}>
                          AI
                        </Link>
                        <button onClick={() => removeMed(med.id)}
                          style={{ padding:'6px 8px', background:'white', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--ink-5)', fontSize:14, lineHeight:1 }}>
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ALERTS */}
        {tab === 'alerts' && (
          <div>
            {!analysed && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'40px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>⚡</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Sem análise ainda</div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>
                  {!canAnalyse ? 'Requer plano Student para análise automática de interações.' : meds.length < 2 ? 'Adiciona pelo menos 2 medicamentos para analisar interações.' : 'Clica em "Analisar interações" para verificar a tua medicação.'}
                </div>
                {canAnalyse && meds.length >= 2 && (
                  <button onClick={analyse} disabled={analysing}
                    style={{ padding:'11px 22px', background:'var(--green)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                    Analisar agora →
                  </button>
                )}
                {!canAnalyse && <Link href="/pricing" style={{ display:'inline-block', padding:'11px 22px', background:'var(--green)', color:'white', textDecoration:'none', borderRadius:8, fontSize:13, fontWeight:700 }}>Ver plano Student →</Link>}
              </div>
            )}

            {analysed && alerts.length === 0 && (
              <div style={{ background:'#d1fae5', border:'1px solid #6ee7b7', borderRadius:10, padding:'32px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#065f46', marginBottom:6 }}>Sem interações conhecidas</div>
                <div style={{ fontSize:13, color:'#065f46', opacity:0.8 }}>A combinação dos teus medicamentos não tem interações clinicamente relevantes conhecidas.</div>
              </div>
            )}

            {analysed && alerts.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {alerts.map((alert, i) => {
                  const s = SEV[alert.severity]
                  return (
                    <div key={i} style={{ padding:'14px 16px', background:s.bg, border:`1px solid ${s.border}`, borderRadius:10 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>{s.label}</span>
                            {alert.drugs?.map(d => <span key={d} style={{ fontSize:10, color:s.color, fontFamily:'var(--font-mono)' }}>{d}</span>)}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:s.color, lineHeight:1.5, marginBottom:5 }}>{alert.message}</div>
                          <div style={{ fontSize:12, color:s.color, opacity:0.8, lineHeight:1.5 }}>→ {alert.action}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                  Discute sempre estes alertas com o teu médico ou farmacêutico antes de alterar medicação.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADD */}
        {tab === 'add' && (
          <div style={{ maxWidth:520 }}>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:16 }}>Novo medicamento</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ position:'relative' }}>
                  <input value={newMed.name} onChange={e => { setNewMed(p=>({...p,name:e.target.value})); setSuggestions(suggestDrugs(e.target.value)) }}
                    placeholder="Nome do medicamento *"
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, fontFamily:'var(--font-sans)', outline:'none' }} />
                  {suggestions.length > 0 && newMed.name.length > 1 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', zIndex:10, overflow:'hidden', marginTop:2 }}>
                      {suggestions.slice(0,6).map(s => (
                        <button key={s.dci} onClick={() => { setNewMed(p=>({...p,name:s.display})); setSuggestions([]) }}
                          style={{ width:'100%', textAlign:'left', padding:'10px 14px', background:'white', border:'none', borderBottom:'1px solid var(--bg-3)', cursor:'pointer', fontSize:13, fontFamily:'var(--font-sans)', color:'var(--ink)' }}
                          className="suggestion-item">
                          {s.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={newMed.dose} onChange={e => setNewMed(p=>({...p,dose:e.target.value}))} placeholder="Dose (ex: 500mg)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, fontFamily:'var(--font-sans)', outline:'none' }} />
                <input value={newMed.frequency} onChange={e => setNewMed(p=>({...p,frequency:e.target.value}))} placeholder="Frequência (ex: 1x/dia, de manhã)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, fontFamily:'var(--font-sans)', outline:'none' }} />
                <input value={newMed.indication} onChange={e => setNewMed(p=>({...p,indication:e.target.value}))} placeholder="Indicação (ex: HTA, diabetes)"
                  style={{ border:'1.5px solid var(--border)', borderRadius:8, padding:'11px 14px', fontSize:14, fontFamily:'var(--font-sans)', outline:'none' }} />
                <button onClick={addMed} disabled={!newMed.name.trim() || adding}
                  style={{ padding:'12px', background:newMed.name.trim()?'var(--green)':'var(--bg-3)', color:newMed.name.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, cursor:newMed.name.trim()?'pointer':'not-allowed', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                  {adding ? 'A adicionar...' : 'Adicionar medicamento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .suggestion-item:hover{background:var(--bg-2)!important}`}</style>
    </div>
  )
}