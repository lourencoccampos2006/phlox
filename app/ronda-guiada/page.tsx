'use client'

// /ronda-guiada — Ronda coordenada (lar / centro de dia).
// Vários funcionários fazem a ronda ao mesmo tempo: os utentes dividem-se por
// eles (cada um a UM só). Ao atender, o utente passa para quem o atendeu
// (transferência automática) e fica registado. Otimizado e mobile-first.

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, currentShiftFor } from '@/lib/institutionConfig'

const ACCENT = '#0d6e42'
interface Assignment { id: string; patient_id: string; assigned_to: string; assigned_name: string; status: 'pending' | 'done' | 'skipped'; attended_by?: string | null; attended_name?: string | null; outcome?: string | null }
interface Member { user_id: string; name: string }
interface Patient { id: string; name: string }

const OUTCOMES = [
  { id: 'estavel', label: 'Estável', color: '#16a34a', bg: '#f0fdf4' },
  { id: 'vigiar', label: 'Vigiar', color: '#d97706', bg: '#fffbeb' },
  { id: 'alerta', label: 'Alerta', color: '#dc2626', bg: '#fef2f2' },
]

export default function RondaCoordenadaPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [round, setRound] = useState<any>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [patients, setPatients] = useState<Record<string, Patient>>({})
  const [members, setMembers] = useState<Member[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [swipe, setSwipe] = useState(0)
  const [panel, setPanel] = useState<{ meds: any[]; mar: any[] } | null>(null)
  const [medBusy, setMedBusy] = useState<string>('')
  const touchStart = useRef<number | null>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const loadedOnce = useRef(false)
  const load = useCallback(async () => {
    if (!user) return
    if (!loadedOnce.current) setLoading(true)
    try {
      const r = await fetch('/api/rounds', { headers: await auth() }).then(r => r.json())
      if (r.needsSetup) { setNeedsSetup(true); setLoading(false); return }
      setRound(r.round || null); setAssignments(r.assignments || [])
      if (r.round) {
        const ids = (r.assignments || []).map((a: Assignment) => a.patient_id)
        if (ids.length) {
          const { data } = await supabase.from('patients').select('id, name').in('id', ids)
          const m: Record<string, Patient> = {}; (data || []).forEach((p: Patient) => { m[p.id] = p }); setPatients(m)
        }
      }
    } catch { setErr('Não foi possível carregar.') }
    setLoading(false); loadedOnce.current = true
  }, [user, auth, supabase])

  useEffect(() => { load() }, [load])

  // membros da equipa (para escolher com quem se faz a ronda)
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('active_org_id, org_id').eq('id', user.id).maybeSingle()
        const orgId = prof?.active_org_id || prof?.org_id
        if (!orgId) { setMembers([{ user_id: user.id, name: user.name || 'Eu' }]); setChosen(new Set([user.id])); return }
        const { data: mem } = await supabase.from('org_members').select('user_id').eq('org_id', orgId).eq('active', true)
        const ids = (mem || []).map((m: any) => m.user_id)
        const { data: profs } = ids.length ? await supabase.from('profiles').select('id, name').in('id', ids) : { data: [] }
        const list = (profs || []).map((p: any) => ({ user_id: p.id, name: p.name || 'Colega' }))
        setMembers(list.length ? list : [{ user_id: user.id, name: user.name || 'Eu' }])
        setChosen(new Set([user.id]))
      } catch { setMembers([{ user_id: user.id, name: user.name || 'Eu' }]); setChosen(new Set([user.id])) }
    })()
  }, [user, supabase])

  // Tempo real: quando um colega atende, o utente sai da minha lista sem recarregar.
  useEffect(() => {
    if (!user || !round) return
    const ch = supabase.channel('round_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_assignments', filter: `round_id=eq.${round.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, round, supabase, load])

  async function startRound() {
    setBusy(true); setErr('')
    const participants = members.filter(m => chosen.has(m.user_id)).map(m => ({ id: m.user_id, name: m.name }))
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'start', participants }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    load()
  }
  async function attend(a: Assignment) {
    setBusy(true)
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'attend', assignment_id: a.id, outcome, note: note.trim() || null }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    setOutcome(null); setNote(''); load()
  }
  async function endRound() {
    if (!round || !confirm('Terminar a ronda?')) return
    await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'end', id: round.id }) })
    setRound(null); setAssignments([]); load()
  }

  // A MINHA fila: atribuídas a mim e ainda por fazer. (A pesquisa deixa atender
  // um utente de outro colega — ao atender, transfere-se para mim.)
  const mine = assignments.filter(a => a.assigned_to === user?.id && a.status === 'pending')
  const searchHits = search.trim()
    ? assignments.filter(a => a.status === 'pending' && (patients[a.patient_id]?.name || '').toLowerCase().includes(search.trim().toLowerCase()))
    : []
  const doneCount = assignments.filter(a => a.status === 'done').length
  const current = mine[0]
  const curName = current ? (patients[current.patient_id]?.name || cfg.personNoun) : ''

  // Carrega a medicação do utente atual (para dar medicação na ronda → /mar).
  const curPatientId = current?.patient_id
  useEffect(() => {
    if (!curPatientId) { setPanel(null); return }
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'panel', patient_id: curPatientId }) }).then(r => r.json())
        if (!cancel) setPanel(r.error ? { meds: [], mar: [] } : { meds: r.meds || [], mar: r.mar || [] })
      } catch { if (!cancel) setPanel({ meds: [], mar: [] }) }
    })()
    return () => { cancel = true }
  }, [curPatientId, auth])

  // Turno atual segundo a instituição (o centro de dia nunca tem "noite").
  // Enviamos SEMPRE o turno ao servidor para não haver duas verdades.
  const shiftNow = currentShiftFor(institution)
  const medGiven = (medId: string) => (panel?.mar || []).some(m => m.med_id === medId && (m.status === 'administered' || m.status === 'given' || m.status === 'taken'))
  async function giveMed(medId: string) {
    if (!current) return
    setMedBusy(medId)
    const given = medGiven(medId)
    // otimista
    setPanel(p => p ? { ...p, mar: given ? p.mar.filter(m => m.med_id !== medId) : [...p.mar, { med_id: medId, status: 'administered', shift: shiftNow }] } : p)
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'give_med', patient_id: current.patient_id, med_id: medId, shift: shiftNow }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    if (r.error) setPanel(p => p ? { ...p, mar: given ? [...p.mar, { med_id: medId, status: 'administered' }] : p.mar.filter(m => m.med_id !== medId) } : p)
    setMedBusy('')
  }

  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientX }
  function onTouchMove(e: React.TouchEvent) { if (touchStart.current != null) setSwipe(e.touches[0].clientX - touchStart.current) }
  function onTouchEnd() { const dx = swipe; touchStart.current = null; setSwipe(0); if (dx > 90 && current) attend(current) }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '22px clamp(14px,3vw,24px) 50px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Ronda</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', fontWeight: 400, color: '#0b1120', margin: '0 0 14px' }}>Ronda coordenada</h1>
        {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}
        {children}
      </div>
    </div>
  )

  if (loading) return shell(<div style={{ color: '#94a3b8', fontSize: 13 }}>A carregar…</div>)
  if (needsSetup) { console.error('[phlox:ronda-guiada] rounds tables not set up'); return shell(<div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 15px', fontSize: 13, color: '#92400e' }}>As rondas coordenadas ainda não estão disponíveis nesta conta. Fala connosco e ativamos.</div>) }

  if (!round) return shell(
    <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120', marginBottom: 6 }}>Quem faz a ronda?</div>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>Os {cfg.personNounPlural.toLowerCase()} dividem-se pelos escolhidos — cada um aparece a um só. Quem atender fica com o registo.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {members.map(m => {
          const on = chosen.has(m.user_id)
          return (
            <button key={m.user_id} onClick={() => setChosen(prev => { const n = new Set(prev); n.has(m.user_id) ? n.delete(m.user_id) : n.add(m.user_id); return n })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${on ? ACCENT : '#e2e8f0'}`, background: on ? '#f0fdf4' : 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? ACCENT : '#cbd5e1'}`, background: on ? ACCENT : 'white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{on ? '✓' : ''}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0b1120' }}>{m.name}{m.user_id === user?.id ? ' (eu)' : ''}</span>
            </button>
          )
        })}
      </div>
      <button onClick={startRound} disabled={busy || chosen.size === 0} style={{ width: '100%', padding: 13, background: chosen.size ? ACCENT : '#e2e8f0', color: chosen.size ? 'white' : '#94a3b8', border: 'none', borderRadius: 10, fontSize: 14.5, fontWeight: 800, cursor: chosen.size ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{busy ? 'A preparar…' : `Começar ronda (${chosen.size})`}</button>
    </div>
  )

  const total = assignments.length
  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: '#475569' }}><b>{doneCount}</b>/{total} feitos · <b>{mine.length}</b> na minha fila</div>
        <button onClick={endRound} style={{ fontSize: 12.5, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Terminar ronda</button>
      </div>
      <div style={{ height: 6, background: '#eceef0', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}><div style={{ height: '100%', width: `${total ? Math.round((doneCount / total) * 100) : 0}%`, background: ACCENT, borderRadius: 3, transition: 'width 0.3s' }} /></div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Atender outro utente (pesquisar)…" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 13px', fontSize: 14, outline: 'none', background: 'white' }} />
        {searchHits.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            {searchHits.slice(0, 6).map(a => {
              const mineAlready = a.assigned_to === user?.id
              return (
                <button key={a.id} onClick={() => { setSearch(''); attend(a) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 13px', border: 'none', borderBottom: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#0b1120' }}>{patients[a.patient_id]?.name || 'Utente'}</span>
                  <span style={{ fontSize: 11, color: mineAlready ? '#16a34a' : '#d97706', fontWeight: 700 }}>{mineAlready ? 'minha' : `de ${a.assigned_name?.split(' ')[0] || 'colega'} → atender`}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {mine.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: 34, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0b1120' }}>A tua fila está feita</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{total - doneCount > 0 ? `Faltam ${total - doneCount} com colegas — podes pesquisar para ajudar.` : 'Ronda completa!'}</div>
        </div>
      ) : (
        <>
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, overflow: 'hidden', transform: swipe ? `translateX(${swipe}px)` : undefined, transition: swipe ? 'none' : 'transform 0.25s', touchAction: 'pan-y' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', flex: 1 }}>{curName}</div>
                <Link href={`/patients/${current.patient_id}`} style={{ fontSize: 12, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Ficha →</Link>
                <Link href={`/care-log?patient=${current.patient_id}`} style={{ fontSize: 12, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Registo do dia →</Link>
              </div>
            </div>

            {/* Medicação — dar a partir da ronda (escreve no /mar). */}
            {panel && panel.meds.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Medicação deste turno</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panel.meds.map((m: any) => {
                    const given = medGiven(m.id); const busyM = medBusy === m.id
                    return (
                      <button key={m.id} onClick={() => giveMed(m.id)} disabled={busyM}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', padding: '9px 11px', borderRadius: 9, cursor: busyM ? 'wait' : 'pointer',
                          border: `1.5px solid ${given ? '#bbf7d0' : '#e5e7eb'}`, background: given ? '#f0fdf4' : 'white', fontFamily: 'inherit' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                          border: `2px solid ${given ? '#16a34a' : '#cbd5e1'}`, background: given ? '#16a34a' : 'white', color: 'white' }}>{given ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0b1120' }}>💊 {m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                          <span style={{ display: 'block', fontSize: 11, color: given ? '#16a34a' : '#94a3b8' }}>{busyM ? 'A guardar…' : given ? 'Dada — toque para desmarcar' : (m.frequency || 'Toque para dar')}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Como está</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                {OUTCOMES.map(o => (
                  <button key={o.id} onClick={() => setOutcome(outcome === o.id ? null : o.id)} style={{ padding: '13px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: `2px solid ${outcome === o.id ? o.color : '#e2e8f0'}`, background: outcome === o.id ? o.bg : 'white', color: outcome === o.id ? o.color : '#475569', fontSize: 14, fontWeight: outcome === o.id ? 700 : 600 }}>{o.label}</button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Nota rápida (opcional)…" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => { setOutcome(null); setNote('') }} style={{ flex: 1, padding: 14, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#64748b' }}>Limpar</button>
            <button onClick={() => current && attend(current)} disabled={busy} style={{ flex: 2, padding: 14, background: ACCENT, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{busy ? 'A guardar…' : 'Registar e seguinte →'}</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: '#94a3b8' }}>Arraste o cartão → para registar</div>
        </>
      )}
    </>
  )
}
