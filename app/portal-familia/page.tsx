'use client'

// Portal do familiar — multi-residente. O cuidador adiciona um ou vários códigos
// e fala com todos os entes queridos na mesma janela. Sessão guardada no dispositivo.

import { useState, useEffect, useRef, useCallback } from 'react'

interface Msg {
  id: string; author_side: 'staff' | 'family'; author_name?: string
  kind: 'message' | 'update' | 'wellbeing' | 'photo' | 'milestone' | 'system'
  content?: string; photo_url?: string; mood?: string; meals?: string; activity?: string; created_at: string
}
interface Access { code: string; verify: string; name: string; room?: string }

function normalizeCode(raw: string): string {
  const s = (raw || '').toUpperCase()
  const m = s.match(/C[ÓO]DIGO[:\s]*([A-Z0-9]{4,12})/)
  if (m) return m[1]
  return s.replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

const MOOD = { bom: '😊 Bem-disposto(a)', razoavel: '😐 Razoável', mau: '😔 Em baixo' } as Record<string, string>
const MEALS = { tudo: '🍽️ Comeu tudo', parte: '🥄 Comeu parte', pouco: '⚠️ Comeu pouco' } as Record<string, string>
const ACT = { ativo: '🚶 Ativo(a)', calmo: '🛋️ Tranquilo(a)', na_cama: '🛏️ Mais na cama' } as Record<string, string>

const ACCESSES_KEY = 'phlox-familia-accesses'
const NAME_KEY = 'phlox-familia-name'

function downscale(file: File, maxDim = 1280, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('img')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve((c.toDataURL('image/jpeg', q).split(',')[1]) || '')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

export default function FamilyPortalPage() {
  const [accesses, setAccesses] = useState<Access[]>([])
  const [activeCode, setActiveCode] = useState('')   // código selecionado
  const [name, setName] = useState('')
  const [hydrated, setHydrated] = useState(false)

  // ── Adicionar código (ecrã/painel) ──
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [verifyName, setVerifyName] = useState('')
  const [addErr, setAddErr] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  // ── Conversa do residente ativo ──
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [days, setDays] = useState<{ date: string; lines: string[]; mood?: number; attention: boolean }[]>([])
  const [homeMeds, setHomeMeds] = useState<{ id: string; name: string; dose?: string; frequency?: string }[]>([])
  const [todayDoses, setTodayDoses] = useState<{ med_id: string; status: string; source: string; home_by?: string; shift?: string }[]>([])
  const [markingMed, setMarkingMed] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestMed, setSuggestMed] = useState({ name: '', dose: '', frequency: '' })
  const [suggestBusy, setSuggestBusy] = useState(false)
  const [suggestMsg, setSuggestMsg] = useState('')
  const [loadingThread, setLoadingThread] = useState(false)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const active = accesses.find(a => a.code === activeCode) || null

  // Carregar sessões guardadas
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCESSES_KEY)
      const list: Access[] = raw ? JSON.parse(raw) : []
      // migração do formato antigo (1 código)
      const oldC = localStorage.getItem('phlox-familia-code')
      if (oldC && !list.some(a => a.code === oldC)) {
        list.push({ code: normalizeCode(oldC), verify: localStorage.getItem('phlox-familia-verify') || '', name: 'O meu familiar' })
        localStorage.removeItem('phlox-familia-code'); localStorage.removeItem('phlox-familia-verify')
      }
      setAccesses(list)
      if (list.length) setActiveCode(list[0].code)
      const n = localStorage.getItem(NAME_KEY); if (n) setName(n)
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  const persist = (list: Access[]) => { localStorage.setItem(ACCESSES_KEY, JSON.stringify(list)); setAccesses(list) }

  // Verificar/adicionar um código novo
  const tryAdd = useCallback(async (c: string, vDigits: string) => {
    const nc = normalizeCode(c)
    if (!nc || nc.length < 4) { setAddErr('Código demasiado curto.'); return }
    setAddBusy(true); setAddErr('')
    try {
      const qs = `code=${encodeURIComponent(nc)}${vDigits ? `&verify=${encodeURIComponent(vDigits)}` : ''}`
      const res = await fetch(`/api/family-portal?${qs}`)
      const data = await res.json()
      if (!res.ok) { setAddErr(data.error || 'Código inválido.'); return }
      if (data.needsVerify) { setNeedsVerify(true); setVerifyName(data.patientName || ''); if (data.error) setAddErr(data.error); return }
      // sucesso → guarda acesso
      const acc: Access = { code: nc, verify: vDigits, name: data.patient?.name || 'Familiar', room: data.patient?.room_number || '' }
      const next = [...accesses.filter(a => a.code !== nc), acc]
      persist(next)
      setActiveCode(nc); setMsgs(data.messages || []); setDays(data.dailySummaries || [])
      setAdding(false); setNeedsVerify(false); setCode(''); setVerify(''); setAddErr('')
    } catch { setAddErr('Falha de ligação. Tenta novamente.') }
    finally { setAddBusy(false) }
  }, [accesses])

  // Buscar o fio do residente ativo
  const fetchThread = useCallback(async (acc: Access) => {
    setLoadingThread(true)
    try {
      const qs = `code=${encodeURIComponent(acc.code)}${acc.verify ? `&verify=${encodeURIComponent(acc.verify)}` : ''}`
      const res = await fetch(`/api/family-portal?${qs}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 404) { const next = accesses.filter(a => a.code !== acc.code); persist(next); setActiveCode(next[0]?.code || '') }
        return
      }
      if (data.needsVerify) return
      setMsgs(data.messages || []); setDays(data.dailySummaries || [])
      setHomeMeds(data.homeMeds || []); setTodayDoses(data.todayDoses || [])
      // atualiza nome/quarto se mudaram
      if (data.patient && (data.patient.name !== acc.name || data.patient.room_number !== acc.room)) {
        persist(accesses.map(a => a.code === acc.code ? { ...a, name: data.patient.name, room: data.patient.room_number || '' } : a))
      }
    } catch { /* mantém */ }
    finally { setLoadingThread(false) }
  }, [accesses])

  // Marca (ou desmarca) uma toma dada em casa → escreve no /mar da instituição.
  async function markDose(medId: string) {
    if (!active) return
    setMarkingMed(medId)
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_dose', code: active.code, verify: active.verify || '', name, medId }),
      })
      const data = await res.json()
      if (res.ok) await fetchThread(active)   // recarrega para refletir o estado
    } catch { /* ignora */ }
    finally { setMarkingMed('') }
  }

  // Família sugere um medicamento que dá em casa → vai para a ficha do utente.
  async function submitSuggestMed() {
    if (!active || !suggestMed.name.trim()) return
    setSuggestBusy(true); setSuggestMsg('')
    try {
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest_med', code: active.code, verify: active.verify || '', medName: suggestMed.name, dose: suggestMed.dose, frequency: suggestMed.frequency }),
      })
      const data = await res.json()
      if (res.ok) { setSuggestMsg('✓ Enviado. A equipa vai confirmar.'); setSuggestMed({ name: '', dose: '', frequency: '' }); setSuggestOpen(false); await fetchThread(active) }
      else setSuggestMsg(data.error || 'Erro.')
    } catch { setSuggestMsg('Erro de ligação.') }
    finally { setSuggestBusy(false); setTimeout(() => setSuggestMsg(''), 4000) }
  }

  // Ao mudar de residente ativo, carrega e faz poll
  useEffect(() => {
    if (!active) { setMsgs([]); return }
    fetchThread(active)
    const t = setInterval(() => fetchThread(active), 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!active || (!text.trim() && !photo) || sending) return
    setSending(true)
    try {
      localStorage.setItem(NAME_KEY, name)
      let imageBase64 = ''
      if (photo) { try { imageBase64 = await downscale(photo) } catch { /* */ } }
      const res = await fetch('/api/family-portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: active.code, verify: active.verify, name, content: text.trim(), imageBase64 }),
      })
      const data = await res.json()
      if (res.ok && data.message) { setMsgs(prev => [...prev, data.message]); setText(''); setPhoto(null) }
    } finally { setSending(false) }
  }

  function removeAccess(c: string) {
    const next = accesses.filter(a => a.code !== c)
    persist(next)
    if (activeCode === c) setActiveCode(next[0]?.code || '')
  }

  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }

  if (!hydrated) return <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#9ca3af' }}>A carregar…</div></div>

  // ── Sem acessos OU a adicionar → ecrã de código ──
  const showAdder = accesses.length === 0 || adding
  if (showAdder) {
    return (
      <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Phlox · Portal Família</div>
          {needsVerify ? (
            <>
              <h1 style={{ fontSize: 21, fontWeight: 800, color: '#0b1120', margin: '0 0 6px' }}>Confirme que é da família{verifyName ? ` de ${verifyName}` : ''}</h1>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 22px' }}>Introduza os <strong>últimos 4 dígitos</strong> do telemóvel que deu à instituição.</p>
              <input value={verify} onChange={e => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" inputMode="numeric" maxLength={4}
                onKeyDown={e => e.key === 'Enter' && verify.length === 4 && tryAdd(code, verify)}
                style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 22, fontWeight: 700, letterSpacing: '0.3em', textAlign: 'center', boxSizing: 'border-box', outline: 'none' }} />
              {addErr && <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{addErr}</div>}
              <button onClick={() => verify.length === 4 && tryAdd(code, verify)} disabled={verify.length !== 4 || addBusy}
                style={{ width: '100%', marginTop: 16, padding: 14, background: verify.length === 4 ? '#2563eb' : '#e5e7eb', color: verify.length === 4 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: verify.length === 4 ? 'pointer' : 'default' }}>
                {addBusy ? 'A verificar…' : 'Confirmar'}
              </button>
              <button onClick={() => { setNeedsVerify(false); setVerify(''); setAddErr('') }} style={{ width: '100%', marginTop: 8, padding: 10, background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>← Usar outro código</button>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1120', margin: '0 0 6px' }}>{accesses.length ? 'Adicionar familiar' : 'Acompanhe o seu familiar'}</h1>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 22px' }}>Introduza o código que a instituição lhe forneceu. Pode adicionar vários — um por cada familiar.</p>
              <input value={code} onChange={e => setCode(normalizeCode(e.target.value))} placeholder="Ex: AB12CD" inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                onKeyDown={e => e.key === 'Enter' && code.trim() && tryAdd(code, '')}
                style={{ width: '100%', padding: '13px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center', boxSizing: 'border-box', outline: 'none', textTransform: 'uppercase' }} />
              {addErr && <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{addErr}</div>}
              <button onClick={() => code.trim() && tryAdd(code, '')} disabled={!code.trim() || addBusy}
                style={{ width: '100%', marginTop: 16, padding: 14, background: code.trim() ? '#2563eb' : '#e5e7eb', color: code.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: code.trim() ? 'pointer' : 'default' }}>
                {addBusy ? 'A entrar…' : 'Entrar'}
              </button>
              {accesses.length > 0 && (
                <button onClick={() => { setAdding(false); setCode(''); setAddErr('') }} style={{ width: '100%', marginTop: 8, padding: 10, background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>← Voltar às conversas</button>
              )}
              <div style={{ marginTop: 18, fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>O acesso é pessoal. Não partilhe o código fora do círculo familiar.</div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Vista principal: lista de familiares + conversa ──
  return (
    <div style={wrap}>
      {/* Topo */}
      <div style={{ background: '#2563eb', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Portal Família · Phlox</div>
        <button onClick={() => { setAdding(true); setCode(''); setVerify(''); setNeedsVerify(false); setAddErr('') }}
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Adicionar código</button>
      </div>

      <div className="fp-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 0 }}>
        {/* Lista de familiares */}
        <div className="fp-list" style={{ background: '#fff', borderRight: '1px solid #e5e7eb', overflowY: 'auto' }}>
          {accesses.map(a => {
            const on = a.code === activeCode
            return (
              <div key={a.code} onClick={() => setActiveCode(a.code)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: on ? '#eff6ff' : '#fff' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: on ? '#2563eb' : '#f1f5f9', color: on ? '#fff' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{a.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{a.room ? `Quarto ${a.room}` : 'Código ' + a.code}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); removeAccess(a.code) }} title="Remover" style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
              </div>
            )
          })}
          <button onClick={() => { setAdding(true); setCode(''); setVerify(''); setNeedsVerify(false); setAddErr('') }}
            style={{ width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>+ Adicionar outro familiar</button>
        </div>

        {/* Conversa */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Selecione um familiar.</div>
          ) : (
            <>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{active.name}{active.room ? ` · Quarto ${active.room}` : ''}</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
                {/* "O dia de X" — resumo automático dos registos da equipa, em
                    linguagem simples. É o que torna o cuidado visível à família. */}
                {days.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Como tem corrido</div>
                    {days.map(d => {
                      const dl = new Date(d.date + 'T12:00:00')
                      const today = new Date().toISOString().slice(0, 10)
                      const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                      const label = d.date === today ? 'Hoje' : d.date === yest ? 'Ontem' : dl.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
                      return (
                        <div key={d.date} style={{ background: d.attention ? '#fffbeb' : '#f0fdf5', border: `1px solid ${d.attention ? '#fde68a' : '#bbf7d0'}`, borderRadius: 12, padding: '13px 15px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0b1120', textTransform: 'capitalize' }}>{label}</span>
                            {d.mood && <span style={{ fontSize: 16 }}>{['', '😟', '😐', '🙂', '😊', '😄'][d.mood]}</span>}
                            {d.attention && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 99 }}>a acompanhar</span>}
                          </div>
                          {d.lines.length ? d.lines.map((l, i) => (
                            <div key={i} style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55, marginBottom: 2 }}>{l}</div>
                          )) : <div style={{ fontSize: 13, color: '#6b7280' }}>Sem registos detalhados neste dia.</div>}
                        </div>
                      )
                    })}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.5 }}>Resumo gerado a partir dos registos da equipa de cuidados. Para questões clínicas, contacte a instituição.</div>
                  </div>
                )}

                {/* Medicação que a família dá em CASA — marca a toma e ela aparece
                    no painel da instituição (a ponte casa→centro). Mostra-se quando
                    há medicação de casa OU para a família poder sugerir uma. */}
                {(homeMeds.length > 0 || suggestOpen || msgs.length > 0) && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Medicação em casa</div>
                    {homeMeds.map(m => {
                      const dose = todayDoses.find(d => d.med_id === m.id && d.source === 'home')
                      const givenAtCentre = todayDoses.find(d => d.med_id === m.id && d.source === 'centro' && (d.status === 'administered' || d.status === 'given' || d.status === 'taken'))
                      const done = !!dose
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: `1px solid ${done ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0b1120' }}>{m.name}{m.dose ? <span style={{ fontWeight: 500, color: '#6b7280' }}> · {m.dose}</span> : ''}</div>
                            <div style={{ fontSize: 12.5, color: '#9ca3af' }}>{m.frequency || 'Conforme indicado'}{givenAtCentre ? ' · também dado no centro hoje' : ''}</div>
                          </div>
                          <button onClick={() => markDose(m.id)} disabled={markingMed === m.id}
                            style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 10, border: done ? '1px solid #16a34a' : 'none', background: done ? '#f0fdf4' : '#0d6e42', color: done ? '#15803d' : 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minWidth: 96 }}>
                            {markingMed === m.id ? '…' : done ? '✓ Tomado' : 'Marcar toma'}
                          </button>
                        </div>
                      )
                    })}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, lineHeight: 1.5 }}>Ao marcar, a equipa do centro vê que já foi dado em casa.</div>
                    {/* Família sugere um medicamento de casa que falte na ficha */}
                    {!suggestOpen ? (
                      <button onClick={() => setSuggestOpen(true)} style={{ marginTop: 6, background: 'none', border: 'none', color: '#0d6e42', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>+ Falta um medicamento que dá em casa?</button>
                    ) : (
                      <div style={{ marginTop: 8, background: '#f6f9f7', border: '1px solid #d1e7db', borderRadius: 10, padding: 12 }}>
                        <input value={suggestMed.name} onChange={e => setSuggestMed(p => ({ ...p, name: e.target.value }))} placeholder="Nome do medicamento" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box', marginBottom: 6 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={suggestMed.dose} onChange={e => setSuggestMed(p => ({ ...p, dose: e.target.value }))} placeholder="Dose" style={{ flex: 1, minWidth: 0, border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' }} />
                          <input value={suggestMed.frequency} onChange={e => setSuggestMed(p => ({ ...p, frequency: e.target.value }))} placeholder="Quando" style={{ flex: 1, minWidth: 0, border: '1px solid #d1d5db', borderRadius: 8, padding: '9px 11px', fontSize: 14, boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button onClick={submitSuggestMed} disabled={suggestBusy || !suggestMed.name.trim()} style={{ flex: 1, padding: '9px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{suggestBusy ? 'A enviar…' : 'Enviar à equipa'}</button>
                          <button onClick={() => setSuggestOpen(false)} style={{ padding: '9px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {suggestMsg && <div style={{ marginTop: 6, fontSize: 12, color: suggestMsg.startsWith('✓') ? '#15803d' : '#dc2626' }}>{suggestMsg}</div>}
                  </div>
                )}

                {loadingThread && msgs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 30 }}>A carregar…</div>
                ) : msgs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: 40, lineHeight: 1.6 }}>Ainda não há mensagens. A equipa irá partilhar atualizações sobre {active.name} aqui.</div>
                ) : msgs.map(m => {
                  const isFamily = m.author_side === 'family'
                  const time = new Date(m.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isFamily ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                      <div style={{ maxWidth: '82%' }}>
                        <div style={{ background: isFamily ? '#2563eb' : '#fff', color: isFamily ? '#fff' : '#0b1120', border: isFamily ? 'none' : '1px solid #e5e7eb', borderRadius: isFamily ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '11px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          {m.kind === 'wellbeing' ? (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: 6 }}>Como correu o dia</div>
                              {[MOOD[m.mood || ''], MEALS[m.meals || ''], ACT[m.activity || '']].filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 14, marginBottom: 2 }}>{l}</div>)}
                              {m.content && <div style={{ fontSize: 14, marginTop: 7, lineHeight: 1.5 }}>{m.content}</div>}
                            </div>
                          ) : (
                            <>
                              {m.kind === 'update' && <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.65, marginBottom: 4 }}>📋 Atualização</div>}
                              {m.photo_url && <img src={m.photo_url} alt="" style={{ width: '100%', borderRadius: 9, marginBottom: m.content ? 7 : 0, display: 'block' }} />}
                              {m.content && <div style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, textAlign: isFamily ? 'right' : 'left' }}>{m.author_name || (isFamily ? 'Família' : 'Equipa')} · {time}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff', padding: '10px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!name && (
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="O seu nome (ex: Maria, filha)"
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <label style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${photo ? '#2563eb' : '#e5e7eb'}`, background: photo ? '#eff6ff' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }} title="Anexar foto">
                      📷
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPhoto(e.target.files?.[0] || null)} />
                    </label>
                    <textarea value={text} onChange={e => setText(e.target.value)} rows={1} placeholder={`Mensagem à equipa de ${active.name.split(' ')[0]}…`}
                      style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 13px', fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    <button onClick={send} disabled={(!text.trim() && !photo) || sending}
                      style={{ flexShrink: 0, padding: '11px 18px', background: (text.trim() || photo) ? '#2563eb' : '#e5e7eb', color: (text.trim() || photo) ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (text.trim() || photo) ? 'pointer' : 'default' }}>
                      {sending ? '…' : 'Enviar'}
                    </button>
                  </div>
                  {photo && <div style={{ fontSize: 12, color: '#2563eb' }}>📎 {photo.name} <button onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>remover</button></div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loop viral: cada familiar que vê o portal é um cuidador — convida-o a
          usar o Phlox para a sua própria saúde / de quem cuida. */}
      <div style={{ borderTop: '1px solid #e5e7eb', background: '#f8fafc', padding: '18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 10, lineHeight: 1.6 }}>
          Este acompanhamento é feito com o <strong>Phlox</strong> — também pode usá-lo para a sua própria medicação e saúde, ou para cuidar de um familiar.
        </div>
        <a href="/" style={{ display: 'inline-block', padding: '9px 18px', background: '#0d6e42', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Conhecer o Phlox →</a>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .fp-grid { grid-template-columns: 1fr !important; }
          .fp-list { display: flex; overflow-x: auto; border-right: none !important; border-bottom: 1px solid #e5e7eb; }
          .fp-list > div { flex-direction: column; min-width: 120px; text-align: center; border-bottom: none !important; border-right: 1px solid #f3f4f6; }
          .fp-list > button { white-space: nowrap; }
        }
      `}</style>
    </div>
  )
}
