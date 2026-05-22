'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

type RiskLevel = 'CRITICO' | 'ALTO' | 'MODERADO' | 'BAIXO'

interface Resident {
  id: string; name: string; age: number; room: string
  diagnosis: string
  medications: { name: string; dose: string; frequency: string; route?: string }[]
  allergies: string[]
  weight?: number; creatinine?: number
  last_review?: string; risk_level?: RiskLevel; alert_count?: number
}
interface ReviewFinding {
  id: string; priority: 'CRITICA' | 'ALTA' | 'MEDIA' | 'INFO'; category: string
  title: string; description: string; action: string; drugs_involved: string[]
}
interface ReviewResult {
  overall_risk: RiskLevel
  findings: ReviewFinding[]
  positives: string[]
  lab_monitoring: { test: string; frequency: string; reason: string }[]
  pharmacist_note: string
  next_review_weeks: number
}

const RISK: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  CRITICO:  { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', label: 'Crítico' },
  ALTO:     { color: '#92400e', bg: '#fffbeb', border: '#fde68a', label: 'Alto' },
  MODERADO: { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', label: 'Moderado' },
  BAIXO:    { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0', label: 'Baixo' },
}
const PRIORITY: Record<string, { color: string; bg: string; border: string }> = {
  CRITICA: { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  ALTA:    { color: '#92400e', bg: '#fff7ed', border: '#fed7aa' },
  MEDIA:   { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  INFO:    { color: '#14532d', bg: '#f0fdf5', border: '#bbf7d0' },
}

function daysSince(iso?: string) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export default function ResidentesPage() {
  const { user, supabase } = useAuth()
  const canUse = ['pro', 'clinic'].includes((user as any)?.plan || '')

  const [residents, setResidents]   = useState<Resident[]>([])
  const [selected, setSelected]     = useState<Resident | null>(null)
  const [reviews, setReviews]       = useState<Record<string, ReviewResult>>({})
  const [reviewing, setReviewing]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all')

  useEffect(() => {
    if (!user || !canUse) { setLoading(false); return }
    load()
  }, [user])

  const load = async () => {
    setLoading(true)
    const { data: pts } = await supabase.from('patients').select('*').eq('user_id', user!.id).order('name')
    const ids = (pts || []).map((p: any) => p.id)
    let medsMap: Record<string, any[]> = {}
    if (ids.length) {
      const { data: meds } = await supabase.from('patient_meds').select('*').eq('active', true).in('patient_id', ids)
      ;(meds || []).forEach((m: any) => { if (!medsMap[m.patient_id]) medsMap[m.patient_id] = []; medsMap[m.patient_id].push(m) })
    }
    const mapped: Resident[] = (pts || []).map((p: any) => ({
      id: p.id, name: p.name,
      age: p.age ?? (p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000) : 0),
      room: p.room_number || '—',
      diagnosis: p.conditions || p.diagnosis || '—',
      medications: (medsMap[p.id] || []).map((m: any) => ({ name: m.name, dose: m.dose || '', frequency: m.frequency || '', route: m.route || 'oral' })),
      allergies: p.allergies ? p.allergies.split(/[,;]+/).map((a: string) => a.trim()).filter(Boolean) : [],
      weight: p.weight ?? undefined, creatinine: p.creatinine ?? undefined,
      last_review: p.last_review ?? undefined,
      risk_level: p.risk_level ?? undefined,
      alert_count: p.alert_count ?? 0,
    }))
    setResidents(mapped)
    setLoading(false)
  }

  const review = useCallback(async (r: Resident) => {
    setReviewing(r.id); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/residentes/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ name: r.name, age: r.age, diagnosis: r.diagnosis, medications: r.medications, allergies: r.allergies, weight: r.weight, creatinine: r.creatinine }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro')
      const data: ReviewResult = await res.json()
      setReviews(p => ({ ...p, [r.id]: data }))
      setResidents(p => p.map(x => x.id === r.id ? { ...x, risk_level: data.overall_risk, alert_count: data.findings.filter(f => f.priority === 'CRITICA' || f.priority === 'ALTA').length, last_review: new Date().toISOString() } : x))
    } catch (e: any) { setError(e.message || 'Erro ao rever') }
    setReviewing(null)
  }, [supabase])

  const filtered = residents.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q) || r.diagnosis.toLowerCase().includes(q))
      && (riskFilter === 'all' || r.risk_level === riskFilter)
  }).sort((a, b) => {
    const order: Record<string, number> = { CRITICO: 0, ALTO: 1, MODERADO: 2, BAIXO: 3 }
    return (order[a.risk_level || 'BAIXO'] ?? 3) - (order[b.risk_level || 'BAIXO'] ?? 3)
  })

  const stats = {
    total: residents.length,
    critical: residents.filter(r => r.risk_level === 'CRITICO').length,
    high: residents.filter(r => r.risk_level === 'ALTO').length,
    overdue: residents.filter(r => !r.last_review || (daysSince(r.last_review) ?? 0) > 90).length,
    meds: residents.reduce((s, r) => s + r.medications.length, 0),
  }

  if (!canUse) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 500, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0f172a', marginBottom: 12 }}>Phlox Residentes</div>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>Revisão farmacoterapêutica completa de todos os residentes — alertas automáticos, relatórios para o médico, conformidade ACSS.</p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#2563eb', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Ver planos →</Link>
        </div>
      </div>
    )
  }

  if (selected) {
    const rev = reviews[selected.id] ?? null
    const days = daysSince(selected.last_review)
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 40 }}>
          <div className="page-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54 }}>
              <button onClick={() => setSelected(null)}
                style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'var(--font-sans)' }}>
                ← Residentes
              </button>
              <div style={{ height: 18, width: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{selected.name}</span>
              {selected.risk_level && (
                <span style={{ fontSize: 10, fontWeight: 700, color: RISK[selected.risk_level].color, background: RISK[selected.risk_level].bg, border: `1px solid ${RISK[selected.risk_level].border}`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                  {RISK[selected.risk_level].label}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {rev && (
                <button onClick={() => {
                  const win = window.open('', '_blank')
                  if (!win) return
                  win.document.write(`<html><head><title>Revisão — ${selected.name}</title><style>body{font-family:Arial,sans-serif;font-size:11px;padding:24px;max-width:780px;margin:0 auto}h1{font-size:16px;border-bottom:2px solid #000;padding-bottom:6px}h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#666;margin:16px 0 6px}.finding{margin-bottom:8px;padding:8px 10px;border-radius:4px;border-left:3px solid;break-inside:avoid}@media print{body{padding:12px}}</style></head><body><h1>${selected.name}</h1><p>${selected.age} anos · Quarto ${selected.room} · ${selected.diagnosis}</p>${selected.allergies.length ? `<p><strong style="color:#dc2626">Alergias:</strong> ${selected.allergies.join(', ')}</p>` : ''}<h2>Medicação (${selected.medications.length})</h2><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #ddd;font-size:10px;color:#888"><th align="left">Medicamento</th><th align="left">Dose</th><th align="left">Frequência</th></tr>${selected.medications.map(m => `<tr style="border-bottom:1px solid #eee"><td>${m.name}</td><td>${m.dose}</td><td>${m.frequency}</td></tr>`).join('')}</table><h2>Alertas (${rev.findings.length})</h2>${rev.findings.map(f => `<div class="finding" style="background:${PRIORITY[f.priority]?.bg};border-color:${PRIORITY[f.priority]?.color}"><strong style="color:${PRIORITY[f.priority]?.color}">${f.title}</strong><br>${f.description}<br><em>→ ${f.action}</em></div>`).join('')}${rev.pharmacist_note ? `<h2>Nota do Farmacêutico</h2><p>${rev.pharmacist_note}</p>` : ''}<p style="margin-top:24px;font-size:10px;color:#aaa">Gerado por Phlox · phloxclinical.com · Próxima revisão: ${rev.next_review_weeks} semanas</p></body></html>`)
                  win.document.close(); setTimeout(() => win.print(), 300)
                }}
                  style={{ padding: '6px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>
                  Imprimir
                </button>
              )}
              <button onClick={() => review(selected)} disabled={reviewing === selected.id}
                style={{ padding: '6px 16px', background: reviewing === selected.id ? '#f1f5f9' : '#059669', color: reviewing === selected.id ? '#94a3b8' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: reviewing === selected.id ? 'not-allowed' : 'pointer' }}>
                {reviewing === selected.id ? 'A analisar...' : rev ? '↻ Rever AI' : 'Analisar AI'}
              </button>
            </div>
          </div>
        </div>

        <div className="page-container page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Patient profile card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  {selected.age} anos · Quarto {selected.room}
                  {selected.weight ? ` · ${selected.weight} kg` : ''}
                  {selected.creatinine ? ` · Cr ${selected.creatinine} mg/dL` : ''}
                </div>
                {selected.diagnosis !== '—' && <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{selected.diagnosis}</div>}
                {selected.allergies.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {selected.allergies.map(a => <span key={a} style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#faf5ff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: 4 }}>⚠ {a}</span>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {days !== null && (
                  <span style={{ fontSize: 11, color: days > 90 ? '#dc2626' : '#64748b', background: days > 90 ? '#fee2e2' : '#f8fafc', border: `1px solid ${days > 90 ? '#fca5a5' : '#e2e8f0'}`, padding: '3px 9px', borderRadius: 5, fontWeight: days > 90 ? 700 : 400 }}>
                    {days > 90 ? `Revisão em atraso — ${days}d` : `Revista há ${days}d`}
                  </span>
                )}
                <Link href={`/patients`} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none' }}>
                  Editar em Doentes →
                </Link>
              </div>
            </div>

            {/* Medications table */}
            {selected.medications.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Medicação activa — {selected.medications.length} fármacos
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {selected.medications.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '9px 14px', background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: i < selected.medications.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                      <span style={{ color: '#374151' }}>{m.dose || '—'}</span>
                      <span style={{ color: '#64748b', fontSize: 12 }}>{m.frequency || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Review results */}
          {reviewing === selected.id && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '48px', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#059669', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>A analisar medicação</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Verificar interações, doses, duplicações e monitorização necessária...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {!rev && reviewing !== selected.id && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Sem revisão recente</div>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
                Clica em "Analisar AI" para rever a medicação, detetar interações, doses inadequadas e critérios STOPP/START.
              </p>
              <button onClick={() => review(selected)} style={{ padding: '11px 28px', background: '#059669', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Analisar com AI
              </button>
            </div>
          )}

          {rev && reviewing !== selected.id && (
            <>
              {/* Risk summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div style={{ background: RISK[rev.overall_risk].bg, border: `1px solid ${RISK[rev.overall_risk].border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: RISK[rev.overall_risk].color }}>{RISK[rev.overall_risk].label}</div>
                  <div style={{ fontSize: 10, color: RISK[rev.overall_risk].color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Risco global</div>
                </div>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: rev.findings.filter(f => f.priority === 'CRITICA').length > 0 ? '#dc2626' : '#374151' }}>
                    {rev.findings.filter(f => f.priority === 'CRITICA').length}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Alertas críticos</div>
                </div>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#374151' }}>{rev.findings.length}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Total alertas</div>
                </div>
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#374151' }}>{rev.next_review_weeks}sem</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Próxima revisão</div>
                </div>
              </div>

              {/* Findings */}
              {rev.findings.length > 0 && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Alertas e observações
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: 10 }}>
                      {rev.findings.filter(f => f.priority === 'CRITICA').length > 0 ? `${rev.findings.filter(f => f.priority === 'CRITICA').length} crítico(s)` : `${rev.findings.length} total`}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...rev.findings].sort((a, b) => ['CRITICA','ALTA','MEDIA','INFO'].indexOf(a.priority) - ['CRITICA','ALTA','MEDIA','INFO'].indexOf(b.priority)).map((f, i) => {
                      const p = PRIORITY[f.priority] ?? PRIORITY.INFO
                      return (
                        <div key={i} style={{ background: p.bg, border: `1px solid ${p.border}`, borderLeft: `3px solid ${p.color}`, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: p.color, lineHeight: 1.3 }}>{f.title}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, color: p.color, background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{f.priority}</span>
                          </div>
                          <p style={{ fontSize: 12, color: p.color, lineHeight: 1.6, margin: '0 0 8px', opacity: 0.9 }}>{f.description}</p>
                          <div style={{ fontSize: 12, color: p.color, background: 'rgba(255,255,255,0.4)', padding: '5px 9px', borderRadius: 5, fontWeight: 600 }}>
                            → {f.action}
                          </div>
                          {f.drugs_involved?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {f.drugs_involved.map(d => <span key={d} style={{ fontSize: 10, color: p.color, background: 'rgba(255,255,255,0.5)', border: '1px solid currentColor', padding: '1px 6px', borderRadius: 3, opacity: 0.8 }}>{d}</span>)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lab monitoring */}
              {rev.lab_monitoring.length > 0 && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monitorização analítica</span>
                  </div>
                  {rev.lab_monitoring.map((l, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 2fr', gap: 12, padding: '10px 16px', background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: i < rev.lab_monitoring.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{l.test}</span>
                      <span style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4, textAlign: 'center' }}>{l.frequency}</span>
                      <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{l.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pharmacist note */}
              {rev.pharmacist_note && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '3px solid #059669', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nota do Farmacêutico</div>
                  <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.75, margin: 0 }}>{rev.pharmacist_note}</p>
                </div>
              )}

              {/* Positives */}
              {rev.positives?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Aspectos positivos</div>
                  {rev.positives.map((pos, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < rev.positives.length - 1 ? 6 : 0 }}>
                      <span style={{ color: '#059669', flexShrink: 0, fontWeight: 700 }}>✓</span>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{pos}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>
      {/* Sticky header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="page-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Revisão Farmacoterapêutica</span>
            <div style={{ flex: 1 }} />
            <Link href="/patients" style={{ padding: '6px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#374151', textDecoration: 'none', fontWeight: 600 }}>
              Gerir doentes →
            </Link>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {[
            { label: 'Residentes', value: stats.total, color: '#1e40af', alert: false },
            { label: 'Risco crítico', value: stats.critical, color: '#991b1b', alert: stats.critical > 0 },
            { label: 'Risco alto', value: stats.high, color: '#92400e', alert: stats.high > 0 },
            { label: 'Revisão em atraso', value: stats.overdue, color: '#d97706', alert: stats.overdue > 0 },
            { label: 'Total fármacos', value: stats.meds, color: '#374151', alert: false },
          ].map(k => (
            <div key={k.label} style={{ background: k.alert ? (k.label === 'Risco crítico' ? '#fee2e2' : '#fffbeb') : 'white', border: `1px solid ${k.alert ? (k.label === 'Risco crítico' ? '#fca5a5' : '#fde68a') : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, quarto ou diagnóstico..."
            style={{ flex: 1, minWidth: 200, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, gap: 2 }}>
            {(['all', 'CRITICO', 'ALTO', 'MODERADO', 'BAIXO'] as const).map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                style={{ padding: '5px 11px', background: riskFilter === r ? (r === 'all' ? '#374151' : RISK[r]?.color || '#374151') : 'transparent', color: riskFilter === r ? 'white' : '#64748b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.1s' }}>
                {r === 'all' ? 'Todos' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>{error}</div>}

        {/* Resident list — table format */}
        {loading ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>A carregar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🏥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              {residents.length === 0 ? 'Sem residentes' : 'Nenhum resultado'}
            </div>
            {residents.length === 0 && (
              <Link href="/patients" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Adicionar doentes →</Link>
            )}
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 1fr 120px 160px', gap: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '9px 16px' }}>
              {['Residente', 'Idade', 'Quarto', 'Diagnóstico', 'Medicação', 'Risco / Revisão'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {filtered.map((r, i) => {
              const rs = r.risk_level ? RISK[r.risk_level] : null
              const days = daysSince(r.last_review)
              const overdue = days === null || days > 90
              return (
                <div key={r.id}
                  onClick={() => setSelected(r)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 1fr 120px 160px', gap: 0, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s', borderLeft: `3px solid ${rs ? rs.color : '#e2e8f0'}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                    {r.allergies.length > 0 && <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 2 }}>⚠ {r.allergies.join(', ')}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{r.age}a</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{r.room}</div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{r.diagnosis}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: r.medications.length >= 5 ? '#d97706' : '#374151' }}>{r.medications.length} fármaco{r.medications.length !== 1 ? 's' : ''}</div>
                    {r.medications.length >= 5 && <div style={{ fontSize: 10, color: '#d97706' }}>Polimedicação</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    {rs ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                        {rs.label}
                      </span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); review(r) }} disabled={reviewing === r.id}
                        style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', textDecoration: 'none' }}>
                        {reviewing === r.id ? 'A analisar...' : 'Analisar AI'}
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: overdue ? '#dc2626' : '#94a3b8', fontWeight: overdue ? 700 : 400 }}>
                      {days === null ? 'Sem revisão' : overdue ? `Atraso ${days}d` : `${days}d atrás`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
