'use client'

// /auditoria — Audit Trail do utilizador (todos os planos).
// Mostra eventos sensíveis com hash encadeado SHA-256, verifica integridade da cadeia
// e exporta para JSON (RGPD: direito à portabilidade).

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { AUDIT_ACTIONS, actionLabel, categoryLabel, verifyChain, type AuditCategory } from '@/lib/audit'

interface Ev {
  id: string; at: string; action: string; category: AuditCategory
  resource?: string | null; resource_id?: string | null
  ip?: string | null; user_agent?: string | null
  detail?: any; prev_hash?: string | null; event_hash: string; seq: number
  user_id: string
}

const CAT_COLOR: Record<string, string> = { clinical: '#dc2626', billing: '#0d6e42', auth: '#7c3aed', settings: '#2563eb', data: '#0891b2', integration: '#ca8a04', general: '#64748b' }

// Fundido em "Conformidade" (/documentos) como aba "Auditoria" (AuditoriaTool reutilizado).
export default function AuditoriaRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/documentos?tab=auditoria') }, [r])
  return null
}

export function AuditoriaTool() {
  const { user, supabase } = useAuth() as any
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [verify, setVerify] = useState<null | { ok: boolean; checked: number; reason?: string }>(null)
  const [verifying, setVerifying] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('audit_events').select('*').eq('user_id', user.id).order('seq', { ascending: false }).limit(500)
    if (error) { if (/relation .*audit_events.* does not exist/i.test(error.message)) setMissing(true); setEvents([]) }
    else { setMissing(false); setEvents(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  const shown = filterCat === 'all' ? events : events.filter(e => e.category === filterCat)

  async function runVerify() {
    setVerifying(true); setVerify(null)
    // tem de verificar TODA a cadeia, por ordem ascendente
    const r = await verifyChain(events as any)
    setVerify(r.ok ? { ok: true, checked: r.checked } : { ok: false, checked: r.checked, reason: r.firstBreak?.reason })
    setVerifying(false)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `phlox-auditoria-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const cats: string[] = Array.from(new Set(events.map(e => e.category)))
  const totalByCat: Record<string, number> = {}; events.forEach(e => { totalByCat[e.category] = (totalByCat[e.category] || 0) + 1 })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Auditoria</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Audit Trail</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>Cada acção sensível é registada e encadeada por hash SHA-256. Aqui podes ver, verificar a integridade e exportar.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportJson} disabled={!events.length} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'white', cursor: events.length ? 'pointer' : 'default', fontSize: 12.5, fontWeight: 700, color: '#374151', fontFamily: 'var(--font-sans)' }}>Exportar JSON</button>
            <button onClick={runVerify} disabled={verifying || !events.length} style={{ padding: '9px 14px', borderRadius: 8, background: '#0d6e42', color: 'white', border: 'none', cursor: verifying ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>{verifying ? 'A verificar…' : 'Verificar integridade'}</button>
          </div>
        </div>

        {verify && (
          <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${verify.ok ? '#bbf7d0' : '#fca5a5'}`, background: verify.ok ? '#f0fdf4' : '#fef2f2', color: verify.ok ? '#15803d' : '#991b1b', fontSize: 13.5, fontWeight: 600 }}>
            {verify.ok ? `✓ Cadeia íntegra. ${verify.checked} evento(s) verificados.` : `✗ Cadeia comprometida no seq ${verify.checked + 1}: ${verify.reason}`}
          </div>
        )}

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5 }}>
            Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              <Kpi label="Eventos" value={events.length} color="#0b1120" />
              {(Object.keys(totalByCat) as AuditCategory[]).slice(0, 5).map(c => (
                <Kpi key={c} label={categoryLabel(c)} value={totalByCat[c]} color={CAT_COLOR[c] || '#64748b'} />
              ))}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <FilterBtn active={filterCat === 'all'} onClick={() => setFilterCat('all')} color="#0b1120">Todos</FilterBtn>
              {cats.map(c => <FilterBtn key={c} active={filterCat === c} onClick={() => setFilterCat(c)} color={CAT_COLOR[c] || '#64748b'}>{categoryLabel(c as AuditCategory)}</FilterBtn>)}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 9 }} />)}</div>
            ) : shown.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 36, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem eventos para este filtro.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {shown.map(e => {
                  const color = CAT_COLOR[e.category] || '#64748b'
                  return (
                    <details key={e.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 9 }}>
                      <summary style={{ listStyle: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '14', padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>{categoryLabel(e.category)}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionLabel(e.action)}{e.resource ? <span style={{ color: 'var(--ink-5)', fontWeight: 400 }}> · {e.resource}</span> : ''}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-5)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>#{e.seq} · {new Date(e.at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </summary>
                      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6, wordBreak: 'break-all' }}>
                        <div><strong>action:</strong> {e.action}</div>
                        {e.resource_id && <div><strong>resource_id:</strong> {e.resource_id}</div>}
                        {e.ip && <div><strong>ip:</strong> {e.ip}</div>}
                        {e.user_agent && <div><strong>user_agent:</strong> {e.user_agent}</div>}
                        {e.detail && Object.keys(e.detail).length > 0 && <div><strong>detail:</strong> {JSON.stringify(e.detail)}</div>}
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--bg-3)' }}><strong>prev_hash:</strong> {e.prev_hash || '—'}</div>
                        <div><strong>hash:</strong> {e.event_hash}</div>
                      </div>
                    </details>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: 22, fontSize: 12, color: 'var(--ink-5)', lineHeight: 1.6 }}>
          O Audit Trail é só de leitura para a tua conta — as inserções acontecem só do lado do servidor (service role) para garantir a integridade da cadeia. <Link href="/seguranca" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Mais sobre o modelo de segurança →</Link>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function FilterBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? color : 'var(--border)'}`, background: active ? color + '14' : 'white', color: active ? color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{children}</button>
  )
}
