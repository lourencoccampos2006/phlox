'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface DrugInfo {
  name_dci: string
  name_brand: string[]
  class: string
  mechanism: string
  indications: string[]
  contraindications: string[]
  interactions: { drug: string; severity: 'grave' | 'moderada' | 'leve'; description: string }[]
  dose_adult: string
  dose_renal: { stage: string; adjustment: string }[]
  dose_hepatic: string
  monitoring: string[]
  adverse_effects: { effect: string; frequency: string; severity: string }[]
  pregnancy: string
  notes: string
  references: string
}

const QUICK_DRUGS = [
  'Varfarina', 'Metformina', 'Atorvastatina', 'Lisinopril', 'Furosemida',
  'Amiodarona', 'Digoxina', 'Metoprolol', 'Omeprazol', 'Prednisolona',
  'Vancomicina', 'Piperacilina/Tazobactam', 'Ceftriaxona', 'Gentamicina',
]

const SEV_STYLE = {
  grave:    { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  moderada: { color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
  leve:     { color: '#166534', bg: '#dcfce7', border: '#86efac' },
}

export default function DrugInfoPage() {
  const { supabase } = useAuth()
  const [drug, setDrug] = useState('')
  const [result, setResult] = useState<DrugInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'dose' | 'interactions' | 'adr'>('overview')

  const search = async (name?: string) => {
    const query = (name || drug).trim()
    if (!query) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/drug-info', {
        method: 'POST', headers,
        body: JSON.stringify({ drug: query }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Fármaco não encontrado.'); setLoading(false); return }
      setResult(data)
      setTab('overview')
    } catch { setError('Erro de rede.') }
    setLoading(false)
  }

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' as const, marginBottom: -1,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: '#1d4ed8', borderRadius: 1 }} />
            Clínico · Referência
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 4 }}>
            Informação de Fármaco
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Mecanismo · Doses · Interações · RAM · Ajuste renal</div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Search bar */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input
              value={drug} onChange={e => setDrug(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Nome do fármaco (DCI ou nome comercial)..."
              autoFocus
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
            />
            <button onClick={() => search()} disabled={loading || !drug.trim()}
              style={{ padding: '12px 22px', background: loading || !drug.trim() ? 'var(--ink-5)' : '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, cursor: loading || !drug.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {loading ? 'A pesquisar...' : 'Pesquisar'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_DRUGS.map(d => (
              <button key={d} onClick={() => { setDrug(d); search(d) }}
                style={{ padding: '4px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, fontSize: 12, cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.1s' }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding: '14px 18px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px', textAlign: 'center', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            A consultar base de dados farmacológica...
          </div>
        )}

        {result && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>

            {/* Drug header */}
            <div style={{ background: '#0f172a', padding: '20px 24px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', marginBottom: 4 }}>
                {result.name_dci}
              </div>
              {result.name_brand?.length > 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                  Nomes comerciais: {result.name_brand.join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#93c5fd', background: 'rgba(147,197,253,0.15)', border: '1px solid rgba(147,197,253,0.3)', padding: '2px 10px', borderRadius: 3, letterSpacing: '0.06em' }}>
                  {result.class}
                </span>
                <Link href={`/interactions?drugs=${encodeURIComponent(result.name_dci)}`}
                  style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', padding: '2px 10px', borderRadius: 3, textDecoration: 'none', letterSpacing: '0.06em' }}>
                  Verificar interações →
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', overflowX: 'auto' }}>
              {[['overview', 'Visão Geral'], ['dose', 'Posologia'], ['interactions', 'Interações'], ['adr', 'Reações Adversas']].map(([k, v]) => (
                <button key={k} onClick={() => setTab(k as any)} style={tabStyle(k)}>{v}</button>
              ))}
            </div>

            <div style={{ padding: '20px 24px' }}>
              {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Mecanismo de Acção</div>
                    <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>{result.mechanism}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Indicações</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.indications?.map(ind => (
                        <span key={ind} style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 12 }}>{ind}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Contraindicações</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {result.contraindications?.map((ci, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#991b1b', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, marginTop: 3 }}>✕</span>{ci}
                        </div>
                      ))}
                    </div>
                  </div>
                  {result.monitoring?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Monitorização</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.monitoring.map(m => (
                          <span key={m} style={{ fontSize: 12, color: '#7c3aed', background: '#faf5ff', border: '1px solid #ddd6fe', padding: '3px 10px', borderRadius: 12 }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.notes && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#854d0e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Notas clínicas</div>
                      <div style={{ fontSize: 13, color: '#854d0e', lineHeight: 1.6 }}>{result.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'dose' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Dose adulto</div>
                    <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.dose_adult}</div>
                  </div>
                  {result.dose_renal?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Ajuste renal (CrCl)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {result.dose_renal.map((r, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'start', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 7 }}>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8' }}>{r.stage}</span>
                            <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{r.adjustment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.dose_hepatic && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#854d0e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Ajuste hepático</div>
                      <div style={{ fontSize: 13, color: '#854d0e', lineHeight: 1.6 }}>{result.dose_hepatic}</div>
                    </div>
                  )}
                  {result.pregnancy && (
                    <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Gravidez / Lactação</div>
                      <div style={{ fontSize: 13, color: '#7c3aed', lineHeight: 1.6 }}>{result.pregnancy}</div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'interactions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(!result.interactions || result.interactions.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-4)', fontSize: 14 }}>Sem interações significativas identificadas.</div>
                  ) : result.interactions.map((inter, i) => {
                    const s = SEV_STYLE[inter.severity] || SEV_STYLE.leve
                    return (
                      <div key={i} style={{ border: `1px solid ${s.border}`, borderRadius: 8, padding: '14px 16px', background: s.bg }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{inter.drug}</div>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, background: 'white', border: `1px solid ${s.border}`, padding: '2px 8px', borderRadius: 3, flexShrink: 0 }}>
                            {inter.severity.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: s.color, lineHeight: 1.6 }}>{inter.description}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'adr' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(!result.adverse_effects || result.adverse_effects.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-4)', fontSize: 14 }}>Sem dados de RAM disponíveis.</div>
                  ) : result.adverse_effects.map((adr, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 7, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{adr.effect}</div>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{adr.frequency}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: adr.severity === 'grave' ? '#991b1b' : adr.severity === 'moderada' ? '#854d0e' : '#166534',
                        background: adr.severity === 'grave' ? '#fee2e2' : adr.severity === 'moderada' ? '#fef9c3' : '#dcfce7',
                        padding: '2px 8px', borderRadius: 3 }}>
                        {adr.severity}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {result.references && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 7, fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                  Fontes: {result.references}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
