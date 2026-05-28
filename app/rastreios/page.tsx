'use client'

// Gestão de Rastreios (Centro de Saúde / USF) — plano de rastreios/vacinas por utente.

import { useState } from 'react'
import { printDoc } from '@/lib/print'

interface Due { name: string; rationale: string; frequency: string; action: string }
interface Up { name: string; when: string }
interface Result { profile: string; due_now: Due[]; upcoming: Up[]; risk_factors_to_address: string[]; notes: string }

export default function RastreiosPage() {
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('')
  const [risk, setRisk] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function run() {
    if (!age) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/rastreios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ age, sex, risk: risk.trim(), done: done.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  function print() {
    if (!result) return
    const sections: any[] = [
      { heading: 'Devido agora', records: (result.due_now || []).map(d => ({ title: d.name, fields: [{ label: 'Periodicidade', value: d.frequency || '—' }, { label: 'Ação', value: d.action || '—' }], body: d.rationale })) },
    ]
    if (result.upcoming?.length) sections.push({ heading: 'Futuro', records: [{ title: '', bullets: result.upcoming.map(u => `${u.name} — ${u.when}`) }] })
    if (result.risk_factors_to_address?.length) sections.push({ heading: 'Fatores de risco a abordar', records: [{ title: '', bullets: result.risk_factors_to_address }] })
    printDoc({ docTitle: 'Plano de Rastreios', docSubtitle: result.profile, institution: 'Centro de Saúde / USF', sections, footerNote: 'Plano de rastreios e vacinação · DGS · Phlox' })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg,#0d6e42,#16a34a)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Centro de Saúde · USF</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Gestão de Rastreios</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Para cada utente, vê os rastreios e vacinas devidos segundo a DGS — com a ação concreta a tomar.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Idade</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="54" min={0} max={120} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Sexo</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['F', 'Feminino'], ['M', 'Masculino']].map(([v, l]) => (
                  <button key={v} onClick={() => setSex(v)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1.5px solid ${sex === v ? '#0d6e42' : 'var(--border)'}`, background: sex === v ? '#eef6f1' : 'white', color: sex === v ? '#0d6e42' : 'var(--ink-3)', fontSize: 13, fontWeight: sex === v ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Fatores de risco / antecedentes</label>
          <input value={risk} onChange={e => setRisk(e.target.value)} placeholder="Ex: HTA, tabagismo, hist. familiar cancro cólon" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 4 }}>Rastreios já feitos (opcional)</label>
          <input value={done} onChange={e => setDone(e.target.value)} placeholder="Ex: mamografia há 1 ano, citologia 2023" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={run} disabled={loading || !age} style={{ width: '100%', padding: 13, background: age && !loading ? '#0d6e42' : 'var(--bg-3)', color: age && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: age && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? 'A calcular…' : 'Ver plano de rastreios'}</button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{result.profile}</span>
              <button onClick={print} style={{ fontSize: 12, fontWeight: 700, color: '#0d6e42', background: 'white', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>Imprimir</button>
            </div>
            {result.due_now?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Devido agora</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.due_now.map((d, i) => (
                    <div key={i} style={{ borderLeft: '3px solid #dc2626', background: '#fef2f2', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{d.name}</div>
                      {d.rationale && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>{d.rationale}</div>}
                      <div style={{ fontSize: 12.5, color: '#b91c1c', marginTop: 5, fontWeight: 600 }}>→ {d.action}{d.frequency ? ` · ${d.frequency}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.upcoming?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Futuro</div>
                {result.upcoming.map((u, i) => <div key={i} style={{ fontSize: 13.5, color: 'var(--ink-2)', padding: '4px 0' }}><strong>{u.name}</strong> — {u.when}</div>)}
              </div>
            )}
            {result.risk_factors_to_address?.length > 0 && (
              <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Fatores de risco a abordar</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#92400e', lineHeight: 1.6 }}>{result.risk_factors_to_address.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
            {result.notes && <div style={{ ...card, background: 'var(--bg-2)' }}><div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{result.notes}</div></div>}
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>Apoio à decisão — confirmar elegibilidade com as normas DGS vigentes.</div>
          </div>
        )}
      </div>
    </div>
  )
}
