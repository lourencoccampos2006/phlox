'use client'

// /vigia — Vigia Clínico do Lar (institucional, Pro/Institucional).
// Painel inteligente que varre TODOS os residentes e prioriza por risco:
// vigilância farmacológica (interações/STOPP/dose), ronda do dia, e relatório.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

const ACCENT = '#0d6e42'

interface Vig { risk_score: number; alerts: any[]; flags: string[]; summary: string; analysed_at: string }
interface Patient { id: string; name: string; age: number|null; sex: string|null; room: string|null; risk_level: string|null; vigilance: Vig|null }

export default function VigiaPage() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [report, setReport] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [gated, setGated] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [open, setOpen] = useState<Patient | null>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const headers = await auth()
    const r = await fetch('/api/vigilancia', { headers })
    if (r.status === 403) { setGated(true); setLoading(false); return }
    const j = await r.json().catch(() => ({}))
    if (j.needs_migration) setNeedsMigration(true)
    setPatients(j.patients || []); setLoading(false)
  }, [auth])
  useEffect(() => { if (user) load() }, [user, load])

  async function scan() {
    setScanning(true); setReport(null)
    let offset = 0, total = 0, done = 0
    do {
      setScanMsg(`A analisar residentes… ${done}${total ? '/' + total : ''}`)
      const headers = await auth()
      const r = await fetch('/api/vigilancia', { method: 'POST', headers, body: JSON.stringify({ action: 'scan', offset }) })
      const j = await r.json().catch(() => ({}))
      if (j.error) { setScanMsg(j.error); break }
      done = j.done; total = j.total; offset = j.done
      if (!j.has_more) break
    } while (offset < total && offset < 200)
    setScanMsg(''); setScanning(false); await load()
  }

  async function genReport() {
    setReportBusy(true)
    const headers = await auth()
    const r = await fetch('/api/vigilancia', { method: 'POST', headers, body: JSON.stringify({ action: 'report' }) })
    const j = await r.json().catch(() => ({}))
    setReport(j.report || j.error || 'Sem relatório.'); setReportBusy(false)
  }

  if (loading) return <Shell><p style={{ color: '#6b7280' }}>A carregar…</p></Shell>
  if (gated) return (
    <Shell>
      <div style={{ textAlign: 'center', padding: 30 }}>
        <div style={{ fontSize: 38 }}>🏥</div>
        <h1 style={{ fontFamily: 'var(--font-serif,serif)', fontSize: 26 }}>Vigia Clínico do Lar</h1>
        <p style={{ color: '#6b7280', maxWidth: 460, margin: '8px auto 18px', lineHeight: 1.6 }}>Vigilância farmacológica automática de todos os residentes — interações graves, critérios STOPP/Beers, polimedicação — priorizada por risco. Disponível no plano Institucional.</p>
        <Link href="/pricing" style={{ display: 'inline-block', background: ACCENT, color: 'white', textDecoration: 'none', padding: '12px 26px', borderRadius: 8, fontWeight: 700 }}>Ver Institucional →</Link>
      </div>
    </Shell>
  )

  const counts = {
    critico: patients.filter(p => (p.vigilance?.risk_score || 0) >= 60).length,
    alto: patients.filter(p => { const s = p.vigilance?.risk_score || 0; return s >= 35 && s < 60 }).length,
    semScan: patients.filter(p => !p.vigilance).length,
  }

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8b8f99' }}>Institucional</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Vigia Clínico do Lar</h1>
          <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 4 }}>{patients.length} residentes · a IA varre a medicação de todos e prioriza por risco.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={scan} disabled={scanning} style={{ padding: '10px 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{scanning ? scanMsg || 'A analisar…' : '⚡ Analisar todos'}</button>
          <button onClick={genReport} disabled={reportBusy || scanning} style={{ padding: '10px 18px', background: 'white', color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>{reportBusy ? 'A gerar…' : '📄 Relatório do lar'}</button>
        </div>
      </div>

      {needsMigration && <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>Aplica <b>supabase/sprint82_vigilancia.sql</b> para ativar.</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
        <KPI label="Risco crítico" v={counts.critico} color="#dc2626" />
        <KPI label="Risco alto" v={counts.alto} color="#d97706" />
        <KPI label="Por analisar" v={counts.semScan} color="#6b7280" />
        <KPI label="Total residentes" v={patients.length} color={ACCENT} />
      </div>

      {report && (
        <article style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <b style={{ fontSize: 15 }}>Relatório clínico do lar</b>
            <button onClick={() => setReport(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>×</button>
          </div>
          <MarkdownLite text={report} />
        </article>
      )}

      {/* Lista priorizada — a ronda inteligente */}
      {patients.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: 30 }}>Sem residentes. Adiciona-os em /patients primeiro.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {patients.map(p => {
            const s = p.vigilance?.risk_score || 0
            const c = s >= 60 ? '#dc2626' : s >= 35 ? '#d97706' : s > 0 ? ACCENT : '#9ca3af'
            return (
              <button key={p.id} onClick={() => p.vigilance && setOpen(p)} style={{ textAlign: 'left', background: 'white', border: '1px solid #e7e8ea', borderLeft: `3px solid ${c}`, borderRadius: 10, padding: 14, cursor: p.vigilance ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name || 'Residente'}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{p.age ? `${p.age}a` : ''} {p.sex || ''} {p.room ? `· ${p.room}` : ''}</span>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: c + '18', color: c, fontWeight: 700, fontSize: 13 }}>{p.vigilance ? `${s}/100` : '—'}</span>
                </div>
                {p.vigilance?.flags && p.vigilance.flags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {p.vigilance.flags.map((f, i) => <span key={i} style={{ fontSize: 11, background: '#fef2f2', color: '#991b1b', borderRadius: 6, padding: '2px 8px' }}>{f}</span>)}
                  </div>
                )}
                {p.vigilance?.summary && <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 6 }}>{p.vigilance.summary}</div>}
                {!p.vigilance && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Carrega em "Analisar todos" para avaliar.</div>}
              </button>
            )
          })}
        </div>
      )}

      {/* Detalhe do residente */}
      {open?.vigilance && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 22, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{open.name} · risco {open.vigilance.risk_score}/100</h3>
              <button onClick={() => setOpen(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            {open.vigilance.alerts.length === 0 ? <p style={{ color: '#6b7280', fontSize: 13 }}>Sem alertas farmacológicos relevantes.</p> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {open.vigilance.alerts.map((a, i) => {
                  const ac = a.severity === 'grave' ? '#dc2626' : a.severity === 'moderada' ? '#d97706' : '#6b7280'
                  return (
                    <div key={i} style={{ borderLeft: `3px solid ${ac}`, paddingLeft: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ac, textTransform: 'uppercase' }}>{a.severity} · {a.type}</div>
                      <div style={{ fontSize: 13.5, color: '#16181d', marginTop: 2 }}>{a.message}</div>
                      {a.action && <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>➜ {a.action}</div>}
                    </div>
                  )
                })}
              </div>
            )}
            {/* Gémeo Farmacológico — simular mudança antes de prescrever */}
            <Simulator patientId={open.id} auth={auth} />

            <Link href={`/patients`} style={{ display: 'inline-block', marginTop: 14, fontSize: 13, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Abrir ficha do residente →</Link>
          </div>
        </div>
      )}
    </Shell>
  )
}

// Gémeo Farmacológico: simula adicionar/remover fármaco e mostra impacto
function Simulator({ patientId, auth }: { patientId: string; auth: () => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState('')
  const [remove, setRemove] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<any>(null)

  async function run() {
    setBusy(true); setRes(null)
    const headers = await auth()
    const r = await fetch('/api/patients/simulate', { method: 'POST', headers, body: JSON.stringify({ patient_id: patientId, changes: { add: add.split(',').map(s => s.trim()).filter(Boolean), remove: remove.split(',').map(s => s.trim()).filter(Boolean) } }) })
    const j = await r.json().catch(() => ({}))
    setRes(j.error ? { error: j.error } : j); setBusy(false)
  }

  const verdictMeta: Record<string, { label: string; color: string }> = {
    seguro: { label: 'Seguro', color: '#0d6e42' }, cuidado: { label: 'Com cuidado', color: '#d97706' }, nao_recomendado: { label: 'Não recomendado', color: '#dc2626' },
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eceef0' }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ padding: '8px 14px', background: '#faf5ff', color: '#6d28d9', border: '1px solid #e9d5ff', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🧪 Simular mudança de medicação</button>
      ) : (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🧪 Gémeo Farmacológico</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Vê o impacto ANTES de prescrever. Separa por vírgulas.</div>
          <input value={add} onChange={e => setAdd(e.target.value)} placeholder="Adicionar: ex. ibuprofeno, sertralina" style={inp} />
          <input value={remove} onChange={e => setRemove(e.target.value)} placeholder="Remover: ex. diazepam" style={{ ...inp, marginTop: 6 }} />
          <button onClick={run} disabled={busy} style={{ marginTop: 8, padding: '8px 14px', background: '#6d28d9', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{busy ? 'A simular…' : 'Simular impacto'}</button>
          {res?.error && <div style={{ marginTop: 8, color: '#a82828', fontSize: 13 }}>{res.error}</div>}
          {res && !res.error && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: (verdictMeta[res.verdict]?.color || '#6b7280') + '18', color: verdictMeta[res.verdict]?.color || '#6b7280', fontWeight: 700, fontSize: 13 }}>{verdictMeta[res.verdict]?.label || res.verdict}</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Risco {res.risk_before} → <b style={{ color: res.risk_after > res.risk_before ? '#dc2626' : '#0d6e42' }}>{res.risk_after}</b></span>
              </div>
              {res.summary && <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>{res.summary}</p>}
              {res.new_problems?.length > 0 && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Surgem</div>{res.new_problems.map((p: any, i: number) => <div key={i} style={{ fontSize: 12.5, color: '#7f1d1d' }}>· {p.problem} — {p.detail}</div>)}</div>}
              {res.resolved_problems?.length > 0 && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase' }}>Resolve</div>{res.resolved_problems.map((p: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: '#14532d' }}>· {p}</div>)}</div>}
              {res.monitoring?.length > 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>Vigiar: {res.monitoring.join(', ')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }

function Shell({ children }: { children: React.ReactNode }) {
  return <main style={{ padding: '20px clamp(14px,4vw,32px)', maxWidth: 1000, margin: '0 auto', fontFamily: 'var(--font-sans,sans-serif)' }}>{children}</main>
}
function KPI({ label, v, color }: { label: string; v: number; color: string }) {
  return <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: 14 }}>
    <div style={{ fontSize: 10.5, color: '#8b8f99', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 3 }}>{v}</div>
  </div>
}
function MarkdownLite({ text }: { text: string }) {
  const html = text
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:12px 0 4px">$1</h4>')
    .replace(/^## (.+)$/gm, `<h3 style="font-size:16px;font-weight:700;margin:16px 0 6px;color:${ACCENT}">$1</h3>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0;padding-left:20px">${m}</ul>`)
    .replace(/\n\n/g, '<br/>')
  return <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />
}
