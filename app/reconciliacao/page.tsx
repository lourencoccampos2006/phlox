'use client'

// ─── NOVO: app/reconciliacao/page.tsx ───
// Reconciliação Medicamentosa — Pro+
// Compara lista de medicamentos antes/depois de internamento ou mudança de serviço.
// Identifica discrepâncias, omissões e adições não justificadas.

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import ProfileSelector from '@/components/ProfileSelector'

interface Discrepancy {
  type: 'added' | 'removed' | 'dose_changed' | 'frequency_changed' | 'intentional_omission'
  drug: string
  before: string
  after: string
  severity: 'critical' | 'moderate' | 'low'
  action_required: string
  justification_needed: boolean
}

interface ReconciliationResult {
  summary: string
  discrepancies: Discrepancy[]
  unintentional_omissions: string[]
  therapeutic_duplications: string[]
  recommendations: string[]
  reconciliation_complete: boolean
}

const DISC_STYLE = {
  critical: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', label: 'CRÍTICO', icon: '🚨' },
  moderate: { bg: '#fef9c3', border: '#fde68a', color: '#854d0e', label: 'MODERADO', icon: '⚠️' },
  low:      { bg: '#f0fdf5', border: '#bbf7d0', color: '#14532d', label: 'INFO',     icon: 'ℹ️' },
}

const TYPE_LABELS = {
  added:                 { label: 'Adicionado',           icon: '➕', color: '#0d6e42' },
  removed:               { label: 'Removido',             icon: '➖', color: '#dc2626' },
  dose_changed:          { label: 'Dose alterada',        icon: '🔄', color: '#d97706' },
  frequency_changed:     { label: 'Frequência alterada',  icon: '⏱',  color: '#1d4ed8' },
  intentional_omission:  { label: 'Omissão intencional',  icon: '⏸',  color: '#6d28d9' },
}

const EXAMPLES = {
  before: `Metformina 1000mg 2x/dia\nRamipril 5mg 1x/dia\nAtovastatina 20mg à noite\nAspirin 100mg 1x/dia\nOmeprazol 20mg 1x/dia`,
  after:  `Metformina 500mg 2x/dia\nEnalapril 10mg 2x/dia\nAtovastatina 40mg à noite\nHeparina BPMW 40mg SC 1x/dia\nOmeprazol 40mg 1x/dia\nFurosemida 40mg 1x/dia`,
}

export default function ReconciliacaoPage() {
  const { user, supabase } = useAuth()
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState<ReconciliationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const handleProfile = async (p: any) => {
    if (!supabase) return
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const id    = p.id === 'self' ? user?.id : p.id
    const { data } = await supabase.from(table).select('name, dose, frequency').eq(col, id)
    if (data?.length) {
      setBefore(data.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`).join('\n'))
    }
  }

  const reconcile = async () => {
    if (!before.trim() || !after.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/reconciliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ before: before.trim(), after: after.trim(), context: context.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  if (!isPro) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:480, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:14 }}>🔄</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--ink)', marginBottom:12 }}>Reconciliação Medicamentosa</div>
          <p style={{ fontSize:14, color:'var(--ink-4)', lineHeight:1.7, marginBottom:24 }}>
            Compara medicação antes e depois de internamento. Identifica discrepâncias, omissões não intencionais e duplicações terapêuticas.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'#1d4ed8', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius:8, fontSize:14, fontWeight:700 }}>
            Activar Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#1d4ed8', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:10, height:2, background:'#1d4ed8', borderRadius:1 }} />Reconciliação Medicamentosa · Pro
          </div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(20px,3vw,28px)', color:'var(--ink)', fontWeight:400, marginBottom:8 }}>Reconciliação Medicamentosa</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6, maxWidth:560 }}>
            Cola a lista de medicamentos antes e depois do internamento (ou mudança de serviço). Identificamos as discrepâncias e o que precisa de justificação.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:14 }} className="reconcil-grid">

          {/* Antes */}
          <div>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#0d6e42' }} />
              Medicação ANTES do internamento
            </div>
            {user && <div style={{ marginBottom:8 }}><ProfileSelector onChange={handleProfile} /></div>}
            <textarea value={before} onChange={e => setBefore(e.target.value)}
              placeholder="Um medicamento por linha&#10;Ex: Metformina 1000mg 2x/dia&#10;    Ramipril 5mg 1x/dia"
              rows={10}
              style={{ width:'100%', border:'1.5px solid #bbf7d0', borderRadius:8, padding:'12px 14px', fontSize:13, fontFamily:'var(--font-mono)', outline:'none', resize:'vertical', lineHeight:1.7 }} />
          </div>

          {/* Depois */}
          <div>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#dc2626' }} />
              Medicação DEPOIS (nota de alta / prescrição actual)
            </div>
            <div style={{ marginBottom:8, height:38 }} /> {/* spacer para alinhar com ProfileSelector */}
            <textarea value={after} onChange={e => setAfter(e.target.value)}
              placeholder="Um medicamento por linha&#10;Ex: Metformina 500mg 2x/dia&#10;    Enalapril 10mg 2x/dia"
              rows={10}
              style={{ width:'100%', border:'1.5px solid #fca5a5', borderRadius:8, padding:'12px 14px', fontSize:13, fontFamily:'var(--font-mono)', outline:'none', resize:'vertical', lineHeight:1.7 }} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Contexto clínico (opcional)</div>
          <input value={context} onChange={e => setContext(e.target.value)}
            placeholder="Ex: Internamento por IC descompensada, alta após 5 dias, doente com DRC G3"
            style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none' }} />
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={reconcile} disabled={!before.trim() || !after.trim() || loading}
            style={{ padding:'12px 24px', background:before.trim()&&after.trim()?'#1d4ed8':'var(--bg-3)', color:before.trim()&&after.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:8, opacity:loading?0.7:1 }}>
            {loading ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />A reconciliar...</> : '🔄 Reconciliar'}
          </button>
          <button onClick={() => { setBefore(EXAMPLES.before); setAfter(EXAMPLES.after) }}
            style={{ padding:'12px 18px', background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'var(--font-sans)' }}>
            Ver exemplo
          </button>
        </div>

        {error && <div style={{ padding:'12px 16px', background:'var(--red-light)', border:'1px solid #fca5a5', borderRadius:8, fontSize:13, color:'var(--red)', marginBottom:16 }}>{error}</div>}

        {result && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Resumo */}
            <div style={{ padding:'16px 18px', background:result.reconciliation_complete?'var(--green-light)':'#fef9c3', border:`1px solid ${result.reconciliation_complete?'var(--green-mid)':'#fde68a'}`, borderRadius:10, display:'flex', alignItems:'flex-start', gap:12 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{result.reconciliation_complete ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:result.reconciliation_complete?'var(--green-2)':'#854d0e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
                  {result.reconciliation_complete ? 'Reconciliação possível' : 'Requer revisão clínica'}
                </div>
                <div style={{ fontSize:14, color:'var(--ink)', lineHeight:1.6 }}>{result.summary}</div>
              </div>
            </div>

            {/* Discrepâncias */}
            {result.discrepancies.length > 0 && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                    Discrepâncias identificadas
                  </div>
                  <span style={{ marginLeft:'auto', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{result.discrepancies.length}</span>
                </div>
                {result.discrepancies.map((d, i) => {
                  const s = DISC_STYLE[d.severity]
                  const t = TYPE_LABELS[d.type]
                  return (
                    <div key={i} style={{ padding:'14px 18px', borderBottom:i<result.discrepancies.length-1?'1px solid var(--bg-3)':'none', background:s.bg }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16 }}>{s.icon}</span>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--ink)' }}>{d.drug}</span>
                        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:t.color, background:'white', border:`1px solid ${s.border}`, padding:'2px 7px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                          {t.icon} {t.label}
                        </span>
                        <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:s.color, background:s.bg, border:`1px solid ${s.border}`, padding:'2px 6px', borderRadius:3, letterSpacing:'0.06em', textTransform:'uppercase', marginLeft:'auto' }}>
                          {s.label}
                        </span>
                      </div>
                      {(d.before || d.after) && (
                        <div style={{ display:'flex', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                          {d.before && <div style={{ fontSize:12, color:'#dc2626', fontFamily:'var(--font-mono)' }}>Antes: {d.before}</div>}
                          {d.before && d.after && <div style={{ fontSize:12, color:'var(--ink-4)' }}>→</div>}
                          {d.after && <div style={{ fontSize:12, color:'#0d6e42', fontFamily:'var(--font-mono)' }}>Depois: {d.after}</div>}
                        </div>
                      )}
                      <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.5, marginBottom:d.justification_needed?6:0 }}>{d.action_required}</div>
                      {d.justification_needed && (
                        <div style={{ fontSize:11, color:'#7c3aed', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:4 }}>
                          ✏️ Requer justificação clínica no processo
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Omissões não intencionais */}
            {result.unintentional_omissions.length > 0 && (
              <div style={{ padding:'14px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10 }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'#991b1b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  🚨 Possíveis omissões não intencionais
                </div>
                {result.unintentional_omissions.map((o, i) => (
                  <div key={i} style={{ fontSize:13, color:'#991b1b', lineHeight:1.6, display:'flex', gap:8 }}>
                    <span style={{ flexShrink:0 }}>·</span>{o}
                  </div>
                ))}
              </div>
            )}

            {/* Duplicações */}
            {result.therapeutic_duplications.length > 0 && (
              <div style={{ padding:'14px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10 }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'#854d0e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  ⚠️ Possíveis duplicações terapêuticas
                </div>
                {result.therapeutic_duplications.map((d, i) => (
                  <div key={i} style={{ fontSize:13, color:'#854d0e', lineHeight:1.6, display:'flex', gap:8 }}>
                    <span style={{ flexShrink:0 }}>·</span>{d}
                  </div>
                ))}
              </div>
            )}

            {/* Recomendações */}
            {result.recommendations.length > 0 && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>Recomendações</div>
                {result.recommendations.map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                    <span style={{ color:'#1d4ed8', fontSize:13, flexShrink:0, marginTop:1 }}>→</span>
                    <div style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.6 }}>{r}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(max-width:640px){.reconcil-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  )
}