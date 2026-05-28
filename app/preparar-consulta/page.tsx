'use client'

// "Preparar a consulta" (pessoal/família) — organiza sintomas e dúvidas numa folha
// para levar ao médico. Por perfil ativo. Imprimível.

import { useState, useEffect } from 'react'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { printDoc } from '@/lib/print'
import ProfileSelector from '@/components/ProfileSelector'

interface Result {
  summary: string; timeline: string[]; questions_to_ask: string[]
  symptoms_to_mention: string[]; to_bring: string[]; red_flags: string[]
}

export default function PrepararConsultaPage() {
  const [profile, setProfile] = useState<ActiveProfile | null>(null)
  const [notes, setNotes] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [meds, setMeds] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { setProfile(getActiveProfile()) }, [])

  async function run() {
    if (!notes.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/preparar-consulta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim(), specialty: specialty.trim(), meds: meds.trim(), who: profile?.type === 'family' ? profile.name : '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  function print() {
    if (!result) return
    const sections: any[] = [{ heading: 'Motivo da consulta', records: [{ title: '', body: result.summary }] }]
    if (result.timeline?.length) sections.push({ heading: 'Cronologia', records: [{ title: '', bullets: result.timeline }] })
    if (result.symptoms_to_mention?.length) sections.push({ heading: 'A referir ao médico', records: [{ title: '', bullets: result.symptoms_to_mention }] })
    if (result.questions_to_ask?.length) sections.push({ heading: 'Perguntas a fazer', records: [{ title: '', bullets: result.questions_to_ask }] })
    if (result.to_bring?.length) sections.push({ heading: 'O que levar', records: [{ title: '', bullets: result.to_bring }] })
    printDoc({ docTitle: 'Preparação da Consulta', docSubtitle: profile?.type === 'family' ? profile.name : undefined, sections, footerNote: 'Folha de preparação de consulta · Phlox' })
  }

  const who = profile?.type === 'family' ? profile.name.split(' ')[0] : 'mim'
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const block = (title: string, items: string[], emoji: string, color: string, bg: string) => items?.length ? (
    <div style={{ ...card, borderColor: bg, background: bg + '0c' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{emoji} {title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  ) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg,#0d6e42,#16a34a)', padding: '24px 24px 20px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(21px,3vw,28px)', color: 'white', fontWeight: 400, margin: 0 }}>Preparar a consulta</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.9)', margin: '5px 0 0', maxWidth: 520 }}>Escreve o que se passa e levamos-te uma folha organizada para não te esqueceres de nada no médico.</p>
          </div>
          <div style={{ background: 'white', borderRadius: 10, padding: 3 }}><ProfileSelector onChange={p => setProfile(p)} /></div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ ...card, marginBottom: 16 }}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder={`O que se passa com ${who}? Sintomas, há quanto tempo, o que melhora/piora, dúvidas…`}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.55, marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Especialidade (opcional)" style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <input value={meds} onChange={e => setMeds(e.target.value)} placeholder="Medicação atual (opcional)" style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={run} disabled={loading || !notes.trim()} style={{ width: '100%', padding: 13, background: notes.trim() && !loading ? '#0d6e42' : 'var(--bg-3)', color: notes.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: notes.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? 'A preparar…' : 'Preparar folha'}</button>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 14.5, color: '#14532d', lineHeight: 1.6 }}>{result.summary}</div>
                <button onClick={print} style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#15803d', background: 'white', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>Imprimir</button>
              </div>
            </div>
            {block('Cronologia', result.timeline, '📅', '#1d4ed8', '#2563eb')}
            {block('A referir ao médico', result.symptoms_to_mention, '🗣️', '#7c3aed', '#7c3aed')}
            {block('Perguntas a fazer', result.questions_to_ask, '❓', '#0d6e42', '#16a34a')}
            {block('O que levar', result.to_bring, '🎒', '#b45309', '#d97706')}
            {result.red_flags?.length > 0 && (
              <div style={{ ...card, borderColor: '#fca5a5', background: '#fff7f7' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>⚠️ Ir mais cedo / urgência se</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#991b1b', lineHeight: 1.6 }}>{result.red_flags.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center' }}>Ajuda a organizar a conversa — não substitui o médico.</div>
          </div>
        )}
      </div>
    </div>
  )
}
