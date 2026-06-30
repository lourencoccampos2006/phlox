'use client'

// "Preparar a consulta" (pessoal/família) — organiza sintomas e dúvidas numa folha
// para levar ao médico. Por perfil ativo. Imprimível.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { printDoc } from '@/lib/print'
import { downloadICS } from '@/lib/ics'
import ProfileSelector from '@/components/ProfileSelector'
import SaveButton from '@/components/SaveButton'
import { consumeReopen } from '@/lib/saves'
import { useAuth } from '@/components/AuthContext'
import { useHandoff } from '@/lib/toolBridge'
import { useToast } from '@/components/Toast'

interface Result {
  summary: string; timeline: string[]; questions_to_ask: string[]
  symptoms_to_mention: string[]; to_bring: string[]; red_flags: string[]
  possible_connections?: string[]
  suggested_specialty?: string
  context_used?: string
}

export default function PrepararConsultaPage() {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [profile, setProfile] = useState<ActiveProfile | null>(null)
  const [notes, setNotes] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [meds, setMeds] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  // 2026-06-01: novos campos a pedido do utilizador.
  const [anonymous, setAnonymous] = useState(false)     // por defeito usa contexto
  const [date, setDate] = useState('')                  // YYYY-MM-DD
  const [time, setTime] = useState('')                  // HH:MM
  const [recentSymptoms, setRecentSymptoms] = useState<string[]>([])
  const [recentVitals, setRecentVitals] = useState<string[]>([])
  const [creatingEvent, setCreatingEvent] = useState(false)

  useEffect(() => {
    setProfile(getActiveProfile())
    const d = consumeReopen<Result & { input?: string }>()
    if (d) { setResult(d); if (d.input) setNotes(d.input) }
  }, [])

  // Handoff de outra ferramenta (ex: otimizador → "falar disto na consulta").
  const noteHandoff = useHandoff('note')
  useEffect(() => {
    if (noteHandoff?.payload?.note) setNotes(prev => prev ? `${prev}\n${noteHandoff.payload.note}` : String(noteHandoff.payload.note))
  }, [noteHandoff])

  // Carrega contexto (medicação + sintomas + vitais) do perfil ativo,
  // a menos que o utilizador escolha modo anónimo.
  useEffect(() => {
    if (!user?.id || anonymous) {
      setMeds(''); setRecentSymptoms([]); setRecentVitals([]); return
    }
    ;(async () => {
      const isFamily = profile?.type === 'family'
      const since = new Date(Date.now() - 14 * 86400 * 1000).toISOString()
      const [medsR, symR, vitR] = await Promise.all([
        isFamily
          ? supabase.from('family_profile_meds').select('name, dose, frequency').eq('profile_id', profile.id)
          : supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id),
        // Tenta tabelas comuns de sintomas — toleramos ausência
        supabase.from('symptom_logs').select('note, severity, logged_at').eq('user_id', user.id).gte('logged_at', since).order('logged_at', { ascending: false }).limit(10).then((r: any) => r).catch(() => ({ data: [] })),
        supabase.from('vital_signs').select('*').eq('user_id', user.id).gte('measured_at', since).order('measured_at', { ascending: false }).limit(5),
      ])
      const medText = (medsR.data || []).map((m: any) => [m.name, m.dose, m.frequency].filter(Boolean).join(' · ')).join('\n')
      setMeds(medText)
      const syms = (symR.data || []).map((s: any) => `${new Date(s.logged_at || s.created_at).toLocaleDateString('pt-PT')}: ${s.note || s.symptom || '—'}${s.severity ? ` (${s.severity}/10)` : ''}`)
      setRecentSymptoms(syms)
      const vits = (vitR.data || []).slice(0, 3).map((v: any) => {
        const parts: string[] = []
        if (v.systolic) parts.push(`TA ${v.systolic}/${v.diastolic ?? '?'}`)
        if (v.pulse) parts.push(`FC ${v.pulse}`)
        if (v.weight) parts.push(`Peso ${v.weight} kg`)
        if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`)
        if (v.glucose) parts.push(`Glucose ${v.glucose}`)
        return `${new Date(v.measured_at || v.created_at).toLocaleDateString('pt-PT')}: ${parts.join(' · ')}`
      })
      setRecentVitals(vits)
    })()
  }, [user?.id, profile?.id, anonymous, supabase])

  async function run() {
    if (!notes.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/preparar-consulta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.trim(),
          specialty: specialty.trim(),
          meds: meds.trim(),
          recent_symptoms: recentSymptoms,
          recent_vitals: recentVitals,
          who: profile?.type === 'family' ? profile.name : '',
          // Quando não há especialidade indicada, pedimos à AI para sugerir uma.
          suggest_specialty: specialty.trim().length === 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
      // Se a AI sugeriu especialidade, preenche o campo (mas só se vazio)
      if (data.suggested_specialty && !specialty.trim()) setSpecialty(data.suggested_specialty)
    } catch (e: any) { setError(e.message || 'Não foi possível.') }
    finally { setLoading(false) }
  }

  // Cria evento "consulta" no calendário Phlox a partir da preparação.
  async function addToCalendar() {
    if (!user?.id || !date) { toast.error('Indica a data primeiro.'); return }
    setCreatingEvent(true)
    const starts = new Date(`${date}T${time || '09:00'}:00`).toISOString()
    const title = specialty
      ? `Consulta — ${specialty}${profile?.type === 'family' ? ` (${profile.name})` : ''}`
      : `Consulta médica${profile?.type === 'family' ? ` (${profile.name})` : ''}`
    const { error: ev } = await supabase.from('cal_events').insert({
      user_id: user.id, title,
      starts_at: starts, kind: 'consulta',
      description: (result?.summary || notes).slice(0, 500),
      remind_minutes_before: 60,
    })
    setCreatingEvent(false)
    if (ev) { toast.error(ev.message); return }
    toast.success('Consulta adicionada ao calendário Phlox.')
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

          {/* Contexto puxado automaticamente — modo anónimo é opt-in */}
          {!anonymous && (meds || recentSymptoms.length > 0 || recentVitals.length > 0) && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '9px 11px', marginBottom: 10, fontSize: 12, color: '#166534' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>✓ Vamos incluir do teu Phlox:</div>
              {meds && <div>· {meds.split('\n').length} medicamento(s) atual(is)</div>}
              {recentSymptoms.length > 0 && <div>· {recentSymptoms.length} sintoma(s) recente(s)</div>}
              {recentVitals.length > 0 && <div>· {recentVitals.length} medições de sinais vitais recentes</div>}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#475569', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
            Modo anónimo (não enviar a minha medicação/sintomas/vitais)
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Especialidade (deixa vazio para sugerir)" style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <input value={meds} onChange={e => setMeds(e.target.value)} placeholder="Medicação (auto)" style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Data e hora da consulta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} placeholder="Hora"
              style={{ border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={run} disabled={loading || !notes.trim()} style={{ width: '100%', padding: 13, background: notes.trim() && !loading ? '#0d6e42' : 'var(--bg-3)', color: notes.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: notes.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>{loading ? 'A preparar…' : 'Preparar folha'}</button>
          {date && (
            <button onClick={addToCalendar} disabled={creatingEvent}
              style={{ width: '100%', marginTop: 8, padding: 11, background: 'white', color: '#1d4ed8', border: '1.5px solid #bfdbfe', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {creatingEvent ? 'A adicionar…' : '📅 Adicionar ao calendário Phlox'}
            </button>
          )}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 14.5, color: '#14532d', lineHeight: 1.6 }}>{result.summary}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  <button onClick={print} style={{ fontSize: 12, fontWeight: 700, color: '#15803d', background: 'white', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>Imprimir</button>
                  <button onClick={() => {
                    // Cria um evento de calendário 7 dias depois ao meio-dia (utilizador ajusta no app)
                    const start = new Date(); start.setDate(start.getDate() + 7); start.setHours(12, 0, 0, 0)
                    const description = [
                      result.summary,
                      result.timeline?.length ? '\n— CRONOLOGIA —\n' + result.timeline.join('\n') : '',
                      result.symptoms_to_mention?.length ? '\n— A REFERIR —\n' + result.symptoms_to_mention.join('\n') : '',
                      result.questions_to_ask?.length ? '\n— PERGUNTAS —\n' + result.questions_to_ask.join('\n') : '',
                      result.to_bring?.length ? '\n— LEVAR —\n' + result.to_bring.join('\n') : '',
                    ].filter(Boolean).join('\n')
                    downloadICS([{ title: `Consulta médica${profile?.type === 'family' ? ` — ${profile.name}` : ''}`, description, start, durationMin: 30, alarmMinBefore: 60 }], 'consulta.ics', 'Phlox')
                  }} style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: 'white', border: '1px solid #bfdbfe', borderRadius: 7, padding: '5px 11px', cursor: 'pointer' }}>📅 Apple/Google</button>
                  <Link href={`/calendario?prefill=consult&title=${encodeURIComponent('Consulta médica' + (profile?.type === 'family' ? ` — ${profile.name}` : ''))}`} style={{ fontSize: 12, fontWeight: 700, color: '#0d6e42', background: 'white', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 11px', textDecoration: 'none' }}>📆 Phlox</Link>
                  <SaveButton kind="consult_prep" size="sm" color="#15803d"
                    title={`Consulta${profile?.type === 'family' ? ` — ${profile.name}` : ''}`}
                    preview={result.summary} data={{ profile, result, notes }} href="/preparar-consulta" />
                </div>
              </div>
            </div>
            {result.suggested_specialty && (
              <div style={{ ...card, borderColor: '#bfdbfe', background: '#eff6ff' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>🩺 Especialidade sugerida</div>
                <div style={{ fontSize: 14, color: '#0b1120', fontWeight: 700 }}>{result.suggested_specialty}</div>
              </div>
            )}
            {block('Cronologia', result.timeline, '📅', '#1d4ed8', '#2563eb')}
            {block('A referir ao médico', result.symptoms_to_mention, '🗣️', '#7c3aed', '#7c3aed')}
            {block('Perguntas a fazer', result.questions_to_ask, '❓', '#0d6e42', '#16a34a')}
            {block('O que levar', result.to_bring, '🎒', '#b45309', '#d97706')}
            {result.possible_connections && result.possible_connections.length > 0 && (
              <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>🔗 Conexões possíveis</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#78350f', lineHeight: 1.6 }}>{result.possible_connections.map((s, i) => <li key={i}>{s}</li>)}</ul>
                <div style={{ fontSize: 10.5, color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>Hipóteses geradas pela AI — confirma com o médico.</div>
              </div>
            )}
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
