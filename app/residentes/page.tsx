'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { printDoc, type PrintRecord } from '@/lib/print'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// Fundido em "Revisão de medicação" (/med-review) como aba "Por pessoa" (revisão
// por IA de cada residente/utente). Redirect p/ não partir links antigos.
export default function ResidentesRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/med-review?tab=pessoa') }, [r])
  return null
}

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
  CRITICO:  { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', label: 'Crítico' },
  ALTO:     { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', label: 'Alto' },
  MODERADO: { color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)', label: 'Moderado' },
  BAIXO:    { color: 'var(--green-3)', bg: 'var(--green-light)', border: 'var(--badge-green-border)', label: 'Baixo' },
}
const PRIORITY: Record<string, { color: string; bg: string; border: string }> = {
  CRITICA: { color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
  ALTA:    { color: 'var(--amber)', bg: 'var(--amber-light)', border: 'var(--badge-amber-border)' },
  MEDIA:   { color: 'var(--ink-2)', bg: 'var(--bg-2)', border: 'var(--border)' },
  INFO:    { color: 'var(--green-3)', bg: 'var(--green-light)', border: 'var(--badge-green-border)' },
}

function daysSince(iso?: string) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function ResidentesTool() {
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
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 500, padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', color: 'var(--ink)', marginBottom: 12 }}>Phlox Residentes</div>
          <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>Revisão farmacoterapêutica completa de todos os residentes — alertas automáticos, relatórios para o médico, conformidade ACSS.</p>
          <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--ink-2)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>Ver planos →</Link>
        </div>
      </div>
    )
  }

  if (selected) {
    const rev = reviews[selected.id] ?? null
    const days = daysSince(selected.last_review)
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-3)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ background: 'white', borderBottom: '1px solid var(--border)', position: 'sticky', top: 54, zIndex: 40 }}>
          <div className="page-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 54 }}>
              <button onClick={() => setSelected(null)}
                style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, fontFamily: 'var(--font-sans)' }}>
                ← Residentes
              </button>
              <div style={{ height: 18, width: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{selected.name}</span>
              {selected.risk_level && (
                <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: RISK[selected.risk_level].color, background: RISK[selected.risk_level].bg, border: `1px solid ${RISK[selected.risk_level].border}`, padding: '2px 8px', borderRadius: 'var(--r)', textTransform: 'uppercase' }}>
                  {RISK[selected.risk_level].label}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {rev && (
                <button onClick={() => {
                  const medRecord: PrintRecord = {
                    title: `Medicação activa — ${selected.medications.length} fármacos`,
                    bullets: selected.medications.map(m => `${m.name} — ${m.dose || 's/ dose'} · ${m.frequency || 's/ frequência'}${m.route ? ' · ' + m.route : ''}`),
                  }
                  const findingRecords: PrintRecord[] = rev.findings.map(f => ({
                    title: f.title,
                    tags: [{ label: f.priority, color: PRIORITY[f.priority]?.color || 'var(--ink-4)' }],
                    meta: f.category,
                    body: `${f.description}\n→ Ação: ${f.action}`,
                  }))
                  const profile: PrintRecord = {
                    title: selected.name,
                    meta: selected.diagnosis !== '—' ? selected.diagnosis : undefined,
                    fields: [
                      { label: 'Idade', value: `${selected.age} anos` },
                      { label: 'Quarto', value: selected.room || '—' },
                      { label: 'Peso', value: selected.weight ? `${selected.weight} kg` : '—' },
                      { label: 'Creatinina', value: selected.creatinine ? `${selected.creatinine} mg/dL` : '—' },
                    ],
                    bullets: selected.allergies.length ? [`Alergias: ${selected.allergies.join(', ')}`] : undefined,
                  }
                  printDoc({
                    docTitle: 'Revisão Farmacoterapêutica',
                    docSubtitle: `${selected.name} · ${selected.age} anos · Quarto ${selected.room}`,
                    institution: 'Lar / ERPI',
                    meta: [
                      { label: 'fármacos', value: String(selected.medications.length) },
                      { label: 'alertas', value: String(rev.findings.length) },
                      { label: 'próxima revisão', value: `${rev.next_review_weeks} sem` },
                    ],
                    sections: [
                      { heading: 'Perfil do residente', records: [profile] },
                      { heading: 'Medicação', records: [medRecord] },
                      { heading: `Alertas farmacoterapêuticos`, records: findingRecords.length ? findingRecords : [{ title: 'Sem alertas identificados' }] },
                      ...(rev.pharmacist_note ? [{ heading: 'Nota do farmacêutico', records: [{ title: 'Parecer clínico', body: rev.pharmacist_note }] }] : []),
                    ],
                    footerNote: 'Revisão farmacoterapêutica · Phlox',
                  })
                }}
                  style={{ padding: '6px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', color: 'var(--ink-2)', cursor: 'pointer', fontWeight: 'var(--peso-forte)' as any }}>
                  Imprimir
                </button>
              )}
              <button onClick={() => review(selected)} disabled={reviewing === selected.id}
                style={{ padding: '6px 16px', background: reviewing === selected.id ? 'var(--bg-3)' : 'var(--green)', color: reviewing === selected.id ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: reviewing === selected.id ? 'not-allowed' : 'pointer' }}>
                {reviewing === selected.id ? 'A analisar...' : rev ? '↻ Rever AI' : 'Analisar AI'}
              </button>
            </div>
          </div>
        </div>

        <div className="page-container page-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Patient profile card */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', marginBottom: 8 }}>
                  {selected.age} anos · Quarto {selected.room}
                  {selected.weight ? ` · ${selected.weight} kg` : ''}
                  {selected.creatinine ? ` · Cr ${selected.creatinine} mg/dL` : ''}
                </div>
                {selected.diagnosis !== '—' && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.5 }}>{selected.diagnosis}</div>}
                {selected.allergies.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {selected.allergies.map(a => <span key={a} style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--r)' }}>⚠ {a}</span>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {days !== null && (
                  <span style={{ fontSize: 'var(--t-meta)', color: days > 90 ? 'var(--red)' : 'var(--ink-4)', background: days > 90 ? 'var(--badge-red-bg)' : 'var(--bg-2)', border: `1px solid ${days > 90 ? 'var(--badge-red-border)' : 'var(--border)'}`, padding: '3px 9px', borderRadius: 'var(--r)', fontWeight: days > 90 ? 700 : 400 }}>
                    {days > 90 ? `Revisão em atraso — ${days}d` : `Revista há ${days}d`}
                  </span>
                )}
                <Link href={`/patients`} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', textDecoration: 'none' }}>
                  Editar em Doentes →
                </Link>
              </div>
            </div>

            {/* Medications table */}
            {selected.medications.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Medicação activa — {selected.medications.length} fármacos
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  {selected.medications.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, padding: '9px 14px', background: i % 2 === 0 ? 'white' : 'var(--bg-2)', borderBottom: i < selected.medications.length - 1 ? '1px solid var(--bg-3)' : 'none', fontSize: 'var(--t-dado)' }}>
                      <span style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{m.name}</span>
                      <span style={{ color: 'var(--ink-3)' }}>{m.dose || '—'}</span>
                      <span style={{ color: 'var(--ink-4)', fontSize: 'var(--t-meta)' }}>{m.frequency || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Review results */}
          {reviewing === selected.id && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '48px', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 6 }}>A analisar medicação</div>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>Verificar interações, doses, duplicações e monitorização necessária...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {!rev && reviewing !== selected.id && (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 8 }}>Sem revisão recente</div>
              <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)', lineHeight: 1.6, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
                Clica em "Analisar AI" para rever a medicação, detetar interações, doses inadequadas e critérios STOPP/START.
              </p>
              <button onClick={() => review(selected)} style={{ padding: '11px 28px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>
                Analisar com AI
              </button>
            </div>
          )}

          {rev && reviewing !== selected.id && (
            <>
              {/* Risk summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div style={{ background: RISK[rev.overall_risk].bg, border: `1px solid ${RISK[rev.overall_risk].border}`, borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: RISK[rev.overall_risk].color }}>{RISK[rev.overall_risk].label}</div>
                  <div style={{ fontSize: 'var(--t-micro)', color: RISK[rev.overall_risk].color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Risco global</div>
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: rev.findings.filter(f => f.priority === 'CRITICA').length > 0 ? 'var(--red)' : 'var(--ink-3)' }}>
                    {rev.findings.filter(f => f.priority === 'CRITICA').length}
                  </div>
                  <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Alertas críticos</div>
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>{rev.findings.length}</div>
                  <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Total alertas</div>
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>{rev.next_review_weeks}sem</div>
                  <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Próxima revisão</div>
                </div>
              </div>

              {/* Findings */}
              {rev.findings.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Alertas e observações
                    </span>
                    <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--red)', background: 'var(--badge-red-bg)', padding: '1px 7px', borderRadius: 'var(--r-lg)' }}>
                      {rev.findings.filter(f => f.priority === 'CRITICA').length > 0 ? `${rev.findings.filter(f => f.priority === 'CRITICA').length} crítico(s)` : `${rev.findings.length} total`}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...rev.findings].sort((a, b) => ['CRITICA','ALTA','MEDIA','INFO'].indexOf(a.priority) - ['CRITICA','ALTA','MEDIA','INFO'].indexOf(b.priority)).map((f, i) => {
                      const p = PRIORITY[f.priority] ?? PRIORITY.INFO
                      return (
                        <div key={i} style={{ background: p.bg, border: `1px solid ${p.border}`, borderLeft: `3px solid ${p.color}`, borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: p.color, lineHeight: 1.3 }}>{f.title}</span>
                            <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: p.color, background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 'var(--r-sm)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{f.priority}</span>
                          </div>
                          <p style={{ fontSize: 'var(--t-meta)', color: p.color, lineHeight: 1.6, margin: '0 0 8px', opacity: 0.9 }}>{f.description}</p>
                          <div style={{ fontSize: 'var(--t-meta)', color: p.color, background: 'rgba(255,255,255,0.4)', padding: '5px 9px', borderRadius: 'var(--r)', fontWeight: 'var(--peso-corpo)' as any }}>
                            → {f.action}
                          </div>
                          {f.drugs_involved?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {f.drugs_involved.map(d => <span key={d} style={{ fontSize: 'var(--t-micro)', color: p.color, background: 'rgba(255,255,255,0.5)', border: '1px solid currentColor', padding: '1px 6px', borderRadius: 'var(--r-sm)', opacity: 0.8 }}>{d}</span>)}
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
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-3)' }}>
                    <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monitorização analítica</span>
                  </div>
                  {rev.lab_monitoring.map((l, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 2fr', gap: 12, padding: '10px 16px', background: i % 2 === 0 ? 'white' : 'var(--bg-2)', borderBottom: i < rev.lab_monitoring.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{l.test}</span>
                      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 'var(--r)', textAlign: 'center' }}>{l.frequency}</span>
                      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5 }}>{l.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pharmacist note */}
              {rev.pharmacist_note && (
                <div style={{ background: 'var(--badge-green-bg)', border: '1px solid var(--badge-green-border)', borderLeft: '3px solid var(--green)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nota do Farmacêutico</div>
                  <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink)', lineHeight: 1.75, margin: 0 }}>{rev.pharmacist_note}</p>
                </div>
              )}

              {/* Positives */}
              {rev.positives?.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Aspectos positivos</div>
                  {rev.positives.map((pos, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < rev.positives.length - 1 ? 6 : 0 }}>
                      <span style={{ color: 'var(--green)', flexShrink: 0, fontWeight: 'var(--peso-forte)' as any }}>✓</span>
                      <span style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.5 }}>{pos}</span>
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
    /* A barra já cá estava e já era `sticky` — o que estava errado era o
       `top: 54` escrito à mão: é a altura da barra de cima, copiada para
       aqui. No dia em que essa mudar, esta descola e passa a tapar-lhe o
       fim. A `Mesa` resolve a sobreposição sozinha. */
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Revisão farmacoterapêutica</span>
          <span style={{ marginLeft: 'auto' }}>
            <Link href="/patients" style={{ textDecoration: 'none' }}><Botao>GERIR DOENTES</Botao></Link>
          </span>
        </BarraDeTrabalho>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {[
            { label: 'Residentes', value: stats.total, color: 'var(--ink-2)', alert: false },
            { label: 'Risco crítico', value: stats.critical, color: 'var(--red)', alert: stats.critical > 0 },
            { label: 'Risco alto', value: stats.high, color: 'var(--amber)', alert: stats.high > 0 },
            { label: 'Revisão em atraso', value: stats.overdue, color: 'var(--amber)', alert: stats.overdue > 0 },
            { label: 'Total fármacos', value: stats.meds, color: 'var(--ink-3)', alert: false },
          ].map(k => (
            <div key={k.label} style={{ background: k.alert ? (k.label === 'Risco crítico' ? 'var(--badge-red-bg)' : 'var(--badge-amber-bg)') : 'white', border: `1px solid ${k.alert ? (k.label === 'Risco crítico' ? 'var(--badge-red-border)' : 'var(--badge-amber-border)') : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '12px 14px' }}>
              <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginTop: 4, fontWeight: 'var(--peso-corpo)' as any, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, quarto ou diagnóstico..."
            style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
            {(['all', 'CRITICO', 'ALTO', 'MODERADO', 'BAIXO'] as const).map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                style={{ padding: '5px 11px', background: riskFilter === r ? (r === 'all' ? 'var(--ink-3)' : RISK[r]?.color || 'var(--ink-3)') : 'transparent', color: riskFilter === r ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, transition: 'all 0.1s' }}>
                {r === 'all' ? 'Todos' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{error}</div>}

        {/* Resident list — table format */}
        {loading ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>A carregar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 8 }}>
              {residents.length === 0 ? 'Sem residentes' : 'Nenhum resultado'}
            </div>
            {residents.length === 0 && (
              <Link href="/patients" style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', textDecoration: 'none', fontWeight: 'var(--peso-corpo)' as any }}>Adicionar doentes →</Link>
            )}
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 1fr 120px 160px', gap: 0, background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '9px 16px' }}>
              {['Residente', 'Idade', 'Quarto', 'Diagnóstico', 'Medicação', 'Risco / Revisão'].map(h => (
                <div key={h} style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>
            {filtered.map((r, i) => {
              const rs = r.risk_level ? RISK[r.risk_level] : null
              const days = daysSince(r.last_review)
              const overdue = days === null || days > 90
              return (
                <div key={r.id}
                  onClick={() => setSelected(r)}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 1fr 120px 160px', gap: 0, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s', borderLeft: `3px solid ${rs ? rs.color : 'var(--border)'}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{r.name}</div>
                    {r.allergies.length > 0 && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-3)', marginTop: 2 }}>⚠ {r.allergies.join(', ')}</div>}
                  </div>
                  <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>{r.age}a</div>
                  <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)' }}>{r.room}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{r.diagnosis}</div>
                  <div>
                    <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: r.medications.length >= 5 ? 'var(--amber)' : 'var(--ink-3)' }}>{r.medications.length} fármaco{r.medications.length !== 1 ? 's' : ''}</div>
                    {r.medications.length >= 5 && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--amber)' }}>Polimedicação</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    {rs ? (
                      <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: rs.color, background: rs.bg, border: `1px solid ${rs.border}`, padding: '2px 8px', borderRadius: 'var(--r)', textTransform: 'uppercase' }}>
                        {rs.label}
                      </span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); review(r) }} disabled={reviewing === r.id}
                        style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', background: 'var(--badge-green-bg)', border: '1px solid var(--badge-green-border)', padding: '2px 8px', borderRadius: 'var(--r)', cursor: 'pointer', textDecoration: 'none' }}>
                        {reviewing === r.id ? 'A analisar...' : 'Analisar AI'}
                      </button>
                    )}
                    <span style={{ fontSize: 'var(--t-micro)', color: overdue ? 'var(--red)' : 'var(--ink-5)', fontWeight: overdue ? 700 : 400 }}>
                      {days === null ? 'Sem revisão' : overdue ? `Atraso ${days}d` : `${days}d atrás`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Mesa>
  )
}
