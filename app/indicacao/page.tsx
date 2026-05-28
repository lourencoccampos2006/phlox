'use client'

// Indicação Farmacêutica — apoio ao atendimento ao balcão (farmácia comunitária).

import { useState } from 'react'
import { printDoc, type PrintRecord } from '@/lib/print'

interface Rec { name: string; active: string; dose: string; duration: string; notes: string }
interface Result {
  assessment: string; suitable_for_self_care: boolean; recommended: Rec[]
  non_pharmacological: string[]; refer_if: string[]; counseling: string[]; follow_up: string
}

export default function IndicacaoPage() {
  const [complaint, setComplaint] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function run() {
    if (!complaint.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/indicacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ complaint: complaint.trim(), context: context.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  function print() {
    if (!result) return
    const sections: any[] = [{ heading: 'Avaliação', records: [{ title: result.suitable_for_self_care ? 'Adequado a automedicação' : 'Referenciar — não automedicar', body: result.assessment }] }]
    if (result.recommended?.length) sections.push({ heading: 'Indicação', records: result.recommended.map(r => ({ title: `${r.name} (${r.active})`, fields: [{ label: 'Dose', value: r.dose }, { label: 'Duração', value: r.duration || '—' }], ...(r.notes ? { body: r.notes } : {}) })) })
    if (result.non_pharmacological?.length) sections.push({ heading: 'Medidas não farmacológicas', records: [{ title: '', bullets: result.non_pharmacological }] })
    if (result.refer_if?.length) sections.push({ heading: 'Referenciar ao médico se', records: [{ title: '', bullets: result.refer_if }] })
    if (result.counseling?.length) sections.push({ heading: 'Aconselhamento', records: [{ title: '', bullets: result.counseling }] })
    printDoc({ docTitle: 'Indicação Farmacêutica', docSubtitle: complaint.slice(0, 80), institution: 'Farmácia Comunitária', sections, footerNote: 'Protocolo de indicação farmacêutica · Phlox' })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const block = (title: string, items: string[], color: string, bg: string) => items?.length ? (
    <div style={{ ...card, borderColor: bg, background: bg + '0a' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  ) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Farmácia · Balcão</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Indicação Farmacêutica</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Apoio ao aconselhamento: protocolo de indicação, dose concreta e critérios de referenciação.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 820 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Queixa do utente</label>
          <textarea value={complaint} onChange={e => setComplaint(e.target.value)} rows={2} placeholder="Ex: dor de garganta há 2 dias, sem febre…" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Contexto (idade, gravidez, crónicos, medicação, alergias)</label>
          <input value={context} onChange={e => setContext(e.target.value)} placeholder="Ex: 34a, grávida 2º trim, sem alergias" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={run} disabled={loading || !complaint.trim()} style={{ width: '100%', padding: 13, background: complaint.trim() && !loading ? '#1d4ed8' : 'var(--bg-3)', color: complaint.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: complaint.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? 'A avaliar…' : 'Obter indicação'}</button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, borderColor: result.suitable_for_self_care ? '#bbf7d0' : '#fca5a5', background: result.suitable_for_self_care ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: result.suitable_for_self_care ? '#15803d' : '#b91c1c' }}>{result.suitable_for_self_care ? '✓ Adequado a automedicação' : '⚠ Referenciar ao médico'}</span>
                <button onClick={print} style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: 'white', border: '1px solid #bfdbfe', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>Imprimir</button>
              </div>
              {result.assessment && <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.6 }}>{result.assessment}</div>}
            </div>

            {result.recommended?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Indicação</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.recommended.map((r, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{r.name} <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 12.5 }}>{r.active}</span></div>
                      <div style={{ fontSize: 13.5, color: '#1d4ed8', marginTop: 4, fontWeight: 600 }}>{r.dose}</div>
                      {r.duration && <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>Máx: {r.duration}</div>}
                      {r.notes && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{r.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {block('Medidas não farmacológicas', result.non_pharmacological, '#15803d', '#16a34a')}
            {block('Referenciar ao médico se', result.refer_if, '#b91c1c', '#dc2626')}
            {block('Aconselhamento ao utente', result.counseling, '#1d4ed8', '#2563eb')}
            {result.follow_up && <div style={{ ...card, background: 'var(--bg-2)' }}><div style={{ fontSize: 13, color: 'var(--ink-3)' }}>🔁 Seguimento: {result.follow_up}</div></div>}
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>Apoio à decisão profissional — a responsabilidade clínica é do farmacêutico.</div>
          </div>
        )}
      </div>
    </div>
  )
}
