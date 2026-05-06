'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface Alert {
  id: string
  type: 'interaction' | 'fda_recall' | 'ema_signal' | 'infarmed' | 'missing_renewal'
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  body: string
  drug?: string
  profile_name?: string
  source: string
  date: string
  read: boolean
  action_url?: string
}

interface WatchedMed { id: string; name: string; profile: string }

const SEV = {
  critical: { label:'CRÍTICO', bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', dot:'#dc2626', icon:'🚨' },
  high:     { label:'ALTO',    bg:'#fef9c3', border:'#fde68a', color:'#854d0e', dot:'#d97706', icon:'⚠️' },
  medium:   { label:'MÉDIO',   bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', dot:'#3b82f6', icon:'📋' },
  low:      { label:'INFO',    bg:'#f0fdf5', border:'#bbf7d0', color:'#14532d', dot:'#16a34a', icon:'ℹ️' },
}
const TYPE = {
  fda_recall:      { label:'Retirada FDA',      icon:'🇺🇸' },
  interaction:     { label:'Interação',          icon:'⚡' },
  ema_signal:      { label:'Alerta EMA',         icon:'🇪🇺' },
  infarmed:        { label:'INFARMED',           icon:'🇵🇹' },
  missing_renewal: { label:'Renovação em falta', icon:'📅' },
}

export default function MonitorPage() {
  const { user, supabase } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [watchedMeds, setWatchedMeds] = useState<WatchedMed[]>([])
  const [filter, setFilter] = useState<'all'|'unread'|'critical'>('all')
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [tab, setTab] = useState<'alerts'|'watching'>('alerts')

  // ─── Carregar dados reais ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return

    // Alertas guardados no Supabase (se tabela existir)
    let alertData: Alert[] = []
    try {
      const { data } = await supabase
        .from('phlox_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50)
      alertData = data || []
    } catch {}
    setAlerts(alertData)

    // Medicamentos vigiados — pessoais + familiares
    const [{ data: personal }, { data: family }] = await Promise.all([
      supabase.from('personal_meds').select('id, name').eq('user_id', user.id),
      supabase.from('family_profile_meds')
        .select('id, name, family_profiles(name)')
        .eq('user_id', user.id),
    ])

    const meds: WatchedMed[] = [
      ...(personal || []).map((m: any) => ({ id: m.id, name: m.name, profile: 'Eu' })),
      ...(family || []).map((m: any) => ({ id: m.id, name: m.name, profile: (m.family_profiles as any)?.name || 'Familiar' })),
    ]
    setWatchedMeds(meds)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  // ─── Analisar interações em tempo real ───────────────────────────────────
  const runAnalysis = async () => {
    if (!user || watchedMeds.length < 2) return
    setAnalysing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          medications: watchedMeds.map(m => ({ name: m.name })),
        }),
      })
      const data = await res.json()
      if (data.alerts?.length) {
        // Guardar no Supabase e adicionar ao estado
        const newAlerts: Alert[] = data.alerts.map((a: any, i: number) => ({
          id: `analysis-${Date.now()}-${i}`,
          type: 'interaction' as const,
          severity: a.severity === 'critical' ? 'critical' : a.severity === 'major' ? 'high' : a.severity === 'moderate' ? 'medium' : 'low',
          title: `Interação detectada: ${a.drugs_involved?.join(' + ')}`,
          body: a.message,
          drug: a.drugs_involved?.join(' + '),
          source: 'Análise Phlox',
          date: new Date().toISOString().split('T')[0],
          read: false,
          action_url: '/interactions',
        }))
        setAlerts(prev => [...newAlerts, ...prev])
      }
    } catch {}
    setAnalysing(false)
  }

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
    void supabase.from('phlox_alerts').update({ read: true }).eq('id', id)
  }
  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    void supabase.from('phlox_alerts').update({ read: true }).eq('user_id', user?.id)
  }

  const unreadCount = alerts.filter(a => !a.read).length
  const filtered = alerts.filter(a =>
    filter === 'unread' ? !a.read :
    filter === 'critical' ? (a.severity === 'critical' || a.severity === 'high') : true
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />

      <div style={{ background:'var(--ink)', borderBottom:'1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, marginBottom:20, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#475569', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite' }} />
                Phlox Watcher · Monitorização activa
              </div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'#f8fafc', fontWeight:400 }}>Alertas e Monitorização</div>
              <div style={{ fontSize:13, color:'#475569', marginTop:4 }}>
                {watchedMeds.length} medicamentos em vigilância · {unreadCount > 0 ? `${unreadCount} não lidos` : 'todos lidos'}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              {watchedMeds.length >= 2 && (
                <button onClick={runAnalysis} disabled={analysing}
                  style={{ padding:'9px 16px', background:'#1d4ed8', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:analysing?'wait':'pointer', fontFamily:'var(--font-sans)', letterSpacing:'0.04em', textTransform:'uppercase', opacity:analysing?0.7:1 }}>
                  {analysing ? 'A analisar...' : '⚡ Analisar agora'}
                </button>
              )}
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  style={{ padding:'9px 16px', background:'transparent', color:'#64748b', border:'1px solid #1e293b', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                  Marcar todos como lidos
                </button>
              )}
            </div>
          </div>
          <div style={{ display:'flex', borderTop:'1px solid #1e293b' }}>
            {[['alerts', `Alertas${unreadCount > 0 ? ` (${unreadCount})` : ''}`], ['watching','Em vigilância']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id as any)}
                style={{ padding:'10px 16px', background:'none', border:'none', borderBottom:`2px solid ${tab===id?'#22c55e':'transparent'}`, cursor:'pointer', fontSize:12, fontWeight:700, color:tab===id?'#f8fafc':'#475569', fontFamily:'var(--font-sans)', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:-1, whiteSpace:'nowrap' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">
        {tab === 'alerts' && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              {[['all','Todos'],['unread','Não lidos'],['critical','Críticos / Altos']].map(([id,label]) => (
                <button key={id} onClick={() => setFilter(id as any)}
                  style={{ padding:'7px 14px', border:`1.5px solid ${filter===id?'var(--ink)':'var(--border)'}`, borderRadius:20, background:filter===id?'var(--ink)':'white', color:filter===id?'white':'var(--ink-3)', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:10 }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'56px 24px', textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>
                  {filter === 'unread' ? 'Sem alertas por ler' : 'Sem alertas activos'}
                </div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>
                  {watchedMeds.length >= 2 ? 'Clica em "Analisar agora" para verificar interações.' : 'Adiciona medicamentos aos teus perfis para activar a vigilância.'}
                </div>
                {watchedMeds.length >= 2 && (
                  <button onClick={runAnalysis} disabled={analysing}
                    style={{ padding:'11px 24px', background:'var(--ink)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-sans)' }}>
                    ⚡ Analisar interações agora
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(alert => {
                  const sev = SEV[alert.severity]
                  const type = TYPE[alert.type]
                  return (
                    <div key={alert.id} onClick={() => markRead(alert.id)}
                      style={{ background:alert.read?'white':sev.bg, border:`1px solid ${alert.read?'var(--border)':sev.border}`, borderRadius:10, padding:'16px 18px', cursor:'pointer', transition:'all 0.15s', position:'relative' }}
                      className="alert-card">
                      {!alert.read && <div style={{ position:'absolute', top:16, right:16, width:8, height:8, borderRadius:'50%', background:sev.dot }} />}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <span style={{ fontSize:20, flexShrink:0 }}>{sev.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:sev.color, background:sev.bg, border:`1px solid ${sev.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>{sev.label}</span>
                            <span style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>{type?.icon} {type?.label}</span>
                            {alert.profile_name && <span style={{ fontSize:10, color:'#7c3aed', fontFamily:'var(--font-mono)', background:'#faf5ff', border:'1px solid #e9d5ff', padding:'1px 6px', borderRadius:3 }}>👤 {alert.profile_name}</span>}
                          </div>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', marginBottom:5, lineHeight:1.4 }}>{alert.title}</div>
                          <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.6, marginBottom:8 }}>{alert.body}</div>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)' }}>{alert.source} · {new Date(alert.date).toLocaleDateString('pt-PT', { day:'numeric', month:'short' })}</span>
                            {alert.action_url && <Link href={alert.action_url} onClick={e => e.stopPropagation()} style={{ fontSize:12, fontWeight:700, color:sev.color, textDecoration:'none', fontFamily:'var(--font-mono)' }}>Ver detalhes →</Link>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tab === 'watching' && (
          <div>
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px', marginBottom:14, display:'flex', gap:12 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>🔍</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:4 }}>Como funciona o Phlox Watcher</div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.7 }}>Clica em "Analisar agora" para verificar interações entre todos os teus medicamentos. Em versões futuras, a análise será automática quando adicionas um novo medicamento.</div>
              </div>
            </div>

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height:52, borderRadius:8 }} />)}
              </div>
            ) : watchedMeds.length === 0 ? (
              <div style={{ background:'white', border:'2px dashed var(--border)', borderRadius:10, padding:'48px 24px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:12 }}>💊</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)', marginBottom:8 }}>Sem medicamentos em vigilância</div>
                <div style={{ fontSize:13, color:'var(--ink-4)', marginBottom:20 }}>Adiciona medicamentos aos teus perfis para activar a monitorização.</div>
                <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <Link href="/mymeds" style={{ padding:'10px 18px', background:'var(--ink)', color:'white', textDecoration:'none', borderRadius:7, fontSize:13, fontWeight:700 }}>Os meus medicamentos →</Link>
                  <Link href="/perfis" style={{ padding:'10px 18px', background:'white', color:'var(--ink)', textDecoration:'none', borderRadius:7, fontSize:13, fontWeight:700, border:'1px solid var(--border)' }}>Perfis familiares →</Link>
                </div>
              </div>
            ) : (
              <>
                <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
                  {watchedMeds.map((med, i) => (
                    <div key={med.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderBottom:i<watchedMeds.length-1?'1px solid var(--bg-3)':'none' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>💊</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>{med.name}</div>
                        <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>👤 {med.profile}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e' }} />
                        <span style={{ fontSize:11, color:'#16a34a', fontFamily:'var(--font-mono)' }}>Em vigilância</span>
                      </div>
                    </div>
                  ))}
                </div>
                {watchedMeds.length >= 2 && (
                  <button onClick={runAnalysis} disabled={analysing}
                    style={{ width:'100%', padding:'13px', background:analysing?'var(--bg-3)':'var(--ink)', color:analysing?'var(--ink-4)':'white', border:'none', borderRadius:8, cursor:analysing?'wait':'pointer', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    {analysing ? <><div style={{ width:14, height:14, border:'2px solid var(--ink-4)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /> A verificar interações...</> : '⚡ Analisar interações agora'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} @keyframes spin{to{transform:rotate(360deg)}} .alert-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.06);transform:translateY(-1px)}`}</style>
    </div>
  )
}