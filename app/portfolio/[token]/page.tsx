'use client'

// /portfolio/[token] — portefólio de estágio PÚBLICO só-leitura.
// O estudante partilha este link com supervisor/escola.

import { useEffect, useState, use } from 'react'

const ACCENT = '#0d6e42'

export default function PortfolioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [p, setP] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/internship/links?portfolio=${token}`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Indisponível')
        setP(j.portfolio)
      } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
    })()
  }, [token])

  if (loading) return <Shell><p style={{ color: '#6b7280' }}>A carregar…</p></Shell>
  if (err) return <Shell><div style={{ background: '#fbf2f2', color: '#a82828', padding: 14, borderRadius: 10 }}>{err}</div></Shell>

  const it = p?.internship || {}
  const objDone = (p?.objectives || []).filter((o: any) => ['completed', 'validated'].includes(o.status)).length

  return (
    <Shell>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8b8f99' }}>Portefólio de estágio</div>
      <h1 style={{ margin: '4px 0 2px', fontSize: 26, fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>{it.name}</h1>
      <p style={{ color: '#6b7280', fontSize: 13.5 }}>
        {[it.area, it.specialty, it.institution, it.ward].filter(Boolean).join(' · ')}<br />
        {it.period}{it.supervisor ? ` · Supervisor: ${it.supervisor}` : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, margin: '16px 0' }}>
        <Stat label="Doentes" v={p?.patient_count || 0} />
        <Stat label="Objetivos" v={`${objDone}/${(p?.objectives || []).length}`} />
        <Stat label="Procedimentos" v={(p?.procedures || []).length} />
        <Stat label="Horas" v={`${it.hours_done || 0}/${it.hours_required || 0}`} />
      </div>

      <Section title="Objetivos de aprendizagem">
        {(p?.objectives || []).map((o: any, i: number) => (
          <div key={i} style={row}>
            <span>{o.title}</span>
            <span style={{ fontSize: 11, color: ['completed', 'validated'].includes(o.status) ? ACCENT : '#9ca3af', fontWeight: 700 }}>
              {['completed', 'validated'].includes(o.status) ? '✓ concluído' : o.status}
            </span>
          </div>
        ))}
      </Section>

      <Section title="Procedimentos realizados">
        {(p?.procedures || []).map((pr: any, i: number) => (
          <div key={i} style={row}><span>{pr.name}</span><span style={{ fontSize: 11, color: '#6b7280' }}>{pr.level}</span></div>
        ))}
      </Section>

      <Section title="Casos clínicos">
        {(p?.cases || []).map((c: any, i: number) => (
          <div key={i} style={row}><span>{c.title}</span><span style={{ fontSize: 11, color: '#6b7280' }}>{c.diagnosis}</span></div>
        ))}
      </Section>

      {(p?.evaluations || []).length > 0 && (
        <Section title="Avaliações dos supervisores">
          {(p?.evaluations || []).map((e: any, i: number) => (
            <div key={i} style={row}>
              <span>{e.evaluator || 'Supervisor'} · {e.kind}</span>
              <span style={{ fontWeight: 700, color: ACCENT }}>{e.overall ? `${e.overall}/5` : '—'}</span>
            </div>
          ))}
        </Section>
      )}

      <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>Gerado pelo Phlox · só-leitura</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7f8', fontFamily: 'var(--font-sans,sans-serif)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 26 }}>{children}</div>
    </div>
  )
}
function Stat({ label, v }: { label: string; v: any }) {
  return <div style={{ border: '1px solid #e7e8ea', borderRadius: 10, padding: 12 }}><div style={{ fontSize: 10.5, color: '#8b8f99', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 3 }}>{v}</div></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const has = Array.isArray((children as any)?.props?.children) ? true : !!children
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13.5, color: '#374151' }
