'use client'

// app/preparar-consulta/page.tsx — Preparar a consulta.
//
// A API (/api/preparar-consulta) já existia — transforma o que a pessoa
// escreve numa folha organizada para levar ao médico (resumo, perguntas a
// fazer, sinais a não esquecer, o que levar, red flags, possíveis ligações
// entre sintomas e medicação). Mas não tinha NENHUMA página a chamá-la:
// zero utilizadores conseguiam lá chegar. Esta página é essa ligação, com
// dados REAIS da conta (medicação atual, sintomas e sinais vitais recentes)
// em vez de o utilizador ter de escrever tudo de novo.
//
// Linguagem de apoio à decisão, nunca diagnóstica — as "possíveis ligações"
// vêm sempre com "pode"/"é possível" (garantido pelo prompt da API), nunca
// uma afirmação.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { useUsageLimit } from '@/lib/useUsageLimit'
import UpgradeNudge from '@/components/UpgradeNudge'
import { printDoc } from '@/lib/print'

const ACCENT = '#0f172a'

interface PrepResult {
  id?: string | null
  summary?: string
  timeline?: string[]
  questions_to_ask?: string[]
  symptoms_to_mention?: string[]
  to_bring?: string[]
  red_flags?: string[]
  possible_connections?: string[]
  suggested_specialty?: string
  context_used?: string
}

interface SavedPrep {
  id: string
  specialty: string | null
  notes: string
  result: PrepResult
  created_at: string
}

const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PrepararConsultaPage() {
  const { user, supabase } = useAuth() as any
  const [profile, setProfile] = useState<ActiveProfile | null>(null)

  // Dados reais da conta, para contexto (opcional, ligado por defeito).
  const [meds, setMeds] = useState<{ name: string; dose?: string | null; frequency?: string | null }[]>([])
  const [symptomsCount, setSymptomsCount] = useState<string[]>([])
  const [vitalsCount, setVitalsCount] = useState<string[]>([])
  const [useContext, setUseContext] = useState(true)

  const [notes, setNotes] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<PrepResult | null>(null)

  const [history, setHistory] = useState<SavedPrep[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [viewing, setViewing] = useState<SavedPrep | null>(null)

  const usage = useUsageLimit('preparar_consulta')

  useEffect(() => { setProfile(getActiveProfile()) }, [])

  const loadContext = useCallback(async () => {
    if (!user) return
    if (profile?.type === 'family') {
      const [{ data: m }, { data: s }, { data: v }] = await Promise.all([
        supabase.from('family_profile_meds').select('name, dose, frequency').eq('profile_id', profile.id),
        supabase.from('symptom_logs').select('at, symptoms, pain, temperature').eq('profile_id', profile.id).gte('at', new Date(Date.now() - 14 * 86400000).toISOString()).order('at', { ascending: false }),
        supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').eq('profile_id', profile.id).order('recorded_at', { ascending: false }).limit(5),
      ])
      setMeds(m || [])
      setSymptomsCount(formatSymptoms(s || []))
      setVitalsCount(formatVitals(v || []))
    } else {
      const [{ data: m }, { data: s }, { data: v }] = await Promise.all([
        supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id).eq('active', true),
        supabase.from('symptom_logs').select('at, symptoms, pain, temperature').eq('user_id', user.id).is('profile_id', null).gte('at', new Date(Date.now() - 14 * 86400000).toISOString()).order('at', { ascending: false }),
        supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp').eq('user_id', user.id).is('profile_id', null).order('recorded_at', { ascending: false }).limit(5),
      ])
      setMeds(m || [])
      setSymptomsCount(formatSymptoms(s || []))
      setVitalsCount(formatVitals(v || []))
    }
  }, [user, supabase, profile])

  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    const { data: sd } = await supabase.auth.getSession()
    const pp = profile?.type === 'family' ? `?profile_id=${profile.id}` : ''
    const res = await fetch(`/api/preparar-consulta${pp}`, { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
    const data = await res.json().catch(() => ({}))
    setHistory(res.ok ? (data.preps || []) : [])
    setHistoryLoading(false)
  }, [user, supabase, profile])

  useEffect(() => { loadContext(); loadHistory() }, [loadContext, loadHistory])

  function formatSymptoms(rows: any[]): string[] {
    return rows.slice(0, 10).map(r => {
      const parts = [
        (r.symptoms || []).join(', '),
        r.pain != null ? `dor ${r.pain}/10` : '',
        r.temperature != null ? `${r.temperature}°C` : '',
      ].filter(Boolean).join(' · ')
      return `${new Date(r.at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}: ${parts || 'sem detalhe'}`
    })
  }
  function formatVitals(rows: any[]): string[] {
    return rows.slice(0, 5).map(r => {
      const parts = [
        r.bp_sys != null ? `TA ${r.bp_sys}/${r.bp_dia ?? '—'}` : '',
        r.hr != null ? `FC ${r.hr}bpm` : '',
        r.spo2 != null ? `SpO₂ ${r.spo2}%` : '',
        r.weight != null ? `${r.weight}kg` : '',
        r.glucose != null ? `Glicemia ${r.glucose}` : '',
        r.temp != null ? `${r.temp}°C` : '',
      ].filter(Boolean).join(' · ')
      return `${new Date(r.recorded_at).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}: ${parts}`
    })
  }

  const canSubmit = notes.trim().length > 0 && !loading && !usage.hit

  async function submit() {
    if (!canSubmit) return
    setLoading(true); setErr(''); setResult(null)
    usage.increment()
    try {
      const { data: sd } = await supabase.auth.getSession()
      const medsStr = meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`).join('\n')
      const res = await fetch('/api/preparar-consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          notes,
          who: profile?.type === 'family' ? profile.name : '',
          specialty,
          profile_id: profile?.type === 'family' ? profile.id : undefined,
          meds: useContext ? medsStr : '',
          recent_symptoms: useContext ? symptomsCount : [],
          recent_vitals: useContext ? vitalsCount : [],
          suggest_specialty: !specialty.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.limit_reached) { setErr(''); }
        else setErr(data.error || 'Não foi possível preparar a folha agora.')
        setLoading(false)
        return
      }
      setResult(data)
      loadHistory()
    } catch {
      setErr('Não foi possível preparar a folha agora. Tenta de novo.')
    }
    setLoading(false)
  }

  function reset() {
    setResult(null); setNotes(''); setSpecialty(''); setErr('')
  }

  async function removePrep(id: string) {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/preparar-consulta', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ id }),
    })
    setHistory(p => p.filter(x => x.id !== id))
    if (viewing?.id === id) setViewing(null)
  }

  function printSheet(r: PrepResult, meta: { notes: string; specialty?: string | null; created_at?: string }) {
    printDoc({
      docTitle: 'Preparar a consulta',
      docSubtitle: `${meta.specialty || r.suggested_specialty || 'Consulta'} · ${meta.created_at ? fmtDate(meta.created_at) : new Date().toLocaleDateString('pt-PT')}`,
      sections: [
        { heading: 'O que se passa', records: [{ title: 'Resumo', body: r.summary || meta.notes }] },
        ...(r.timeline?.length ? [{ heading: 'Cronologia', records: [{ title: 'Factos relevantes', bullets: r.timeline }] }] : []),
        ...(r.questions_to_ask?.length ? [{ heading: 'Perguntas a fazer ao médico', records: [{ title: 'Não esquecer', bullets: r.questions_to_ask }] }] : []),
        ...(r.symptoms_to_mention?.length ? [{ heading: 'Sinais a referir', records: [{ title: 'Mencionar na consulta', bullets: r.symptoms_to_mention }] }] : []),
        ...(r.to_bring?.length ? [{ heading: 'O que levar', records: [{ title: 'Preparar antes de sair de casa', bullets: r.to_bring }] }] : []),
        ...(r.red_flags?.length ? [{ heading: 'Se aparecer antes da consulta', note: 'considerar ir mais cedo', records: [{ title: 'Sinais de alarme', bullets: r.red_flags }] }] : []),
        ...(r.possible_connections?.length ? [{ heading: 'Possíveis ligações (não é diagnóstico)', records: [{ title: 'Para levar ao médico, não para concluir sozinho', bullets: r.possible_connections }] }] : []),
      ],
      footerNote: 'Gerado pelo utilizador a partir dos seus próprios dados no Phlox. Documento de apoio — não substitui avaliação médica.',
    })
  }

  const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }
  const contextChips = [
    meds.length > 0 ? `${meds.length} medicamento${meds.length === 1 ? '' : 's'}` : null,
    symptomsCount.length > 0 ? `${symptomsCount.length} registo${symptomsCount.length === 1 ? '' : 's'} de sintomas (14 dias)` : null,
    vitalsCount.length > 0 ? `${vitalsCount.length} medição${vitalsCount.length === 1 ? '' : 'ões'} recente${vitalsCount.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean) as string[]

  const shown = viewing?.result || result

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: ACCENT, padding: '26px 24px 22px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(21px,3vw,28px)', color: 'white', fontWeight: 400, margin: 0 }}>Preparar a consulta</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', margin: '5px 0 0', maxWidth: 560, lineHeight: 1.5 }}>
              Descreve o que se passa e o Phlox organiza numa folha para levares ao médico — perguntas, sinais a não esquecer e o que preparar antes de saíres de casa.
            </p>
          </div>
          <div style={{ background: 'white', borderRadius: 10, padding: 3 }}><ProfileSelector onChange={p => { setProfile(p); setResult(null) }} /></div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!shown && (
          <>
            <div style={card}>
              <div style={eyebrow}>O que se passa?</div>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Descreve com as tuas palavras: quando começou, o que sentes, o que já tentaste…"
                rows={5}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', color: 'var(--ink)' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <input
                  value={specialty} onChange={e => setSpecialty(e.target.value)}
                  placeholder="Especialidade (opcional — sugerimos se deixares em branco)"
                  style={{ flex: 1, minWidth: 240, border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
              </div>

              {contextChips.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '11px 13px', background: 'var(--bg-2)', borderRadius: 9, cursor: 'pointer' }}>
                  <input type="checkbox" checked={useContext} onChange={e => setUseContext(e.target.checked)} style={{ marginTop: 2 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    Usar os meus dados recentes: <strong>{contextChips.join(' · ')}</strong>
                  </span>
                </label>
              )}

              {err && <div style={{ marginTop: 12, fontSize: 12.5, color: '#991b1b' }}>{err}</div>}

              {usage.hit ? (
                <UpgradeNudge used={usage.used} limit={usage.limit} what="folhas de preparação" plan="pro" />
              ) : (
                <button onClick={submit} disabled={!canSubmit}
                  style={{ marginTop: 14, width: '100%', padding: 13, background: canSubmit ? ACCENT : 'var(--bg-3)', color: canSubmit ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default' }}>
                  {loading ? 'A preparar…' : 'Preparar folha'}
                </button>
              )}
              {!usage.unlimited && !usage.hit && (
                <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', marginTop: 8 }}>{usage.remaining} de {usage.limit} hoje neste plano</div>
              )}
            </div>

            {!historyLoading && history.length > 0 && (
              <div style={card}>
                <div style={eyebrow}>Folhas anteriores</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {history.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setViewing(h)}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{h.specialty || h.result?.suggested_specialty || 'Consulta'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtDate(h.created_at)} · {h.notes}</div>
                      </div>
                      <button onClick={() => removePrep(h.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16, padding: 4 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {shown && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => { setViewing(null); reset() }} style={{ background: 'none', border: 'none', color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 }}>← {viewing ? 'Voltar' : 'Nova folha'}</button>
              <button onClick={() => printSheet(shown, { notes: viewing?.notes || notes, specialty: viewing?.specialty || specialty, created_at: viewing?.created_at })}
                style={{ padding: '9px 16px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Imprimir / Guardar PDF
              </button>
            </div>

            {shown.suggested_specialty && (
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, color: ACCENT, background: '#e2e8f0', padding: '5px 12px', borderRadius: 20 }}>
                Especialidade sugerida: {shown.suggested_specialty}
              </div>
            )}

            {shown.summary && <div style={card}><div style={eyebrow}>Resumo</div><div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{shown.summary}</div></div>}

            {!!shown.timeline?.length && (
              <div style={card}><div style={eyebrow}>Cronologia</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>{shown.timeline.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            {!!shown.questions_to_ask?.length && (
              <div style={card}><div style={eyebrow}>Perguntas a fazer ao médico</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>{shown.questions_to_ask.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            {!!shown.symptoms_to_mention?.length && (
              <div style={card}><div style={eyebrow}>Sinais a não esquecer de referir</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>{shown.symptoms_to_mention.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            {!!shown.to_bring?.length && (
              <div style={card}><div style={eyebrow}>O que levar</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>{shown.to_bring.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            {!!shown.red_flags?.length && (
              <div style={{ ...card, background: '#fef2f2', borderColor: '#fca5a5' }}>
                <div style={{ ...eyebrow, color: '#991b1b' }}>Se algum destes aparecer antes da consulta</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#991b1b', lineHeight: 1.8 }}>{shown.red_flags.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>Vale a pena ir mais cedo em vez de esperar pela consulta marcada.</div>
              </div>
            )}

            {!!shown.possible_connections?.length && (
              <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div style={{ ...eyebrow, color: '#1d4ed8' }}>Possíveis ligações</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#1e3a8a', lineHeight: 1.8 }}>{shown.possible_connections.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <div style={{ fontSize: 11.5, color: '#3b5a8a', marginTop: 8, lineHeight: 1.5 }}>Não é um diagnóstico — são hipóteses para levares ao médico, que é quem pode confirmar.</div>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.6 }}>
              Documento de apoio à consulta, gerado a partir do que descreveste e dos teus próprios registos. Não substitui avaliação médica.
            </div>
          </div>
        )}

        {!shown && (
          <div style={{ textAlign: 'center' }}>
            <Link href="/mymeds" style={{ fontSize: 12, color: 'var(--ink-5)' }}>← Voltar aos meus comprimidos</Link>
          </div>
        )}
      </div>
    </div>
  )
}
