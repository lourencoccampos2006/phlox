'use client'

import { useState } from 'react'

interface Ref {
  found: boolean
  normalized?: string
  generic_name?: string | null
  brand_names?: string[]
  boxed_warning?: string | null
  indications?: string | null
  dosage?: string | null
  warnings?: string | null
  interactions?: string | null
  adverse_reactions?: string | null
  contraindications?: string | null
  source?: string
  message?: string
}

export default function DrugReferenceButton({ drug }: { drug: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Ref | null>(null)
  const [err, setErr] = useState('')

  async function load() {
    setOpen(true)
    if (data || loading) return
    setLoading(true); setErr('')
    try {
      const r = await fetch(`/api/drug-reference?q=${encodeURIComponent(drug)}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setData(j)
    } catch (e: any) {
      setErr(e.message || 'Não foi possível obter a referência.')
    } finally {
      setLoading(false)
    }
  }

  const SECTIONS: { key: keyof Ref; label: string; color: string }[] = [
    { key: 'boxed_warning', label: 'Aviso de caixa preta', color: '#dc2626' },
    { key: 'interactions', label: 'Interações', color: '#b45309' },
    { key: 'contraindications', label: 'Contraindicações', color: '#dc2626' },
    { key: 'warnings', label: 'Avisos e precauções', color: '#d97706' },
    { key: 'dosage', label: 'Posologia', color: '#1d4ed8' },
    { key: 'indications', label: 'Indicações', color: '#0d6e42' },
    { key: 'adverse_reactions', label: 'Reações adversas', color: '#6b7280' },
  ]

  return (
    <>
      <button onClick={load} title="Referência farmacológica (FDA)"
        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
        REF
      </button>

      {open && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e6e8eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, position: 'sticky', top: 0, background: '#fff' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{data?.generic_name || data?.normalized || drug}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{data?.brand_names?.length ? data.brand_names.join(' · ') : 'Referência farmacológica'}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {loading && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 24 }}>A consultar referência…</div>}
              {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
              {data && !loading && (
                data.found ? (
                  <>
                    {SECTIONS.filter(s => data[s.key]).map(s => (
                      <div key={s.key} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{s.label}</div>
                        <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.55 }}>{String(data[s.key])}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 6 }}>{data.source}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{data.message}</div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
