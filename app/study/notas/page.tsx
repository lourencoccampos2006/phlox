'use client'

// /study/notas — Sistema de memória clínica.
// Não é um editor: é um segundo cérebro que te faz REVER. Cada nota gera
// flashcards (IA) que entram em revisão espaçada (SM-2). A app abre em
// "Rever hoje" — o loop de retorno diário. Captura sem fricção: foto, voz, colar.
// Mantém templates clínicos, markdown, wiki-links [[ ]] e grafo.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface Note {
  id: string; title: string; body: string|null; domain: string|null
  tags: string[]|null; linked_ids: string[]|null; pinned: boolean
  updated_at: string; card_count?: number; mastery?: number; source?: string
}
interface Card {
  id: string; note_id: string; front: string; back: string; domain: string|null
  interval_days: number; repetitions: number
}
interface Dash { due_today: number; total_cards: number; total_notes: number; reviewed_today: number }

type Tab = 'review' | 'notes' | 'graph'

// ─── Templates clínicos ─────────────────────────────────────────────────────
const TEMPLATES: { id: string; icon: string; title: string; domain: string; body: string }[] = [
  { id: 'soap', icon: '📝', title: 'Nota SOAP', domain: 'clinico', body: `## S — Subjectivo\n(queixas, história relatada)\n\n## O — Objectivo\n(exame físico, vitais, exames)\n\n## A — Avaliação\n(diagnóstico/raciocínio)\n\n## P — Plano\n(terapêutica e seguimento)\n` },
  { id: 'caso', icon: '🩺', title: 'Caso clínico', domain: 'clinico', body: `## Identificação\nSexo, idade, profissão.\n\n## História da doença actual\n(HDA)\n\n## Antecedentes\n- Pessoais:\n- Familiares:\n- Hábitos:\n\n## Exame físico\nVitais: TA · FC · FR · SpO2 · T\n\n## Exames complementares\n\n## Diagnóstico diferencial\n\n## Conduta\n\n## Discussão / Pearls\n` },
  { id: 'farmaco', icon: '💊', title: 'Cartão de fármaco', domain: 'farmacologia', body: `## Princípio activo\n\n## Classe terapêutica\n\n## Mecanismo de acção\n\n## Indicações principais\n\n## Doses (adulto)\n\n## Efeitos adversos comuns\n\n## Contra-indicações\n\n## Interacções importantes\n\n## Pearls\n` },
  { id: 'patologia', icon: '🦠', title: 'Cartão de patologia', domain: 'medicina_interna', body: `## Definição\n\n## Epidemiologia\n\n## Fisiopatologia\n\n## Manifestações clínicas\n\n## Diagnóstico\n### Critérios\n### Exames\n\n## Diagnóstico diferencial\n\n## Tratamento\n### Primeira linha\n### Refractária\n\n## Complicações\n` },
  { id: 'ecg', icon: '💓', title: 'Cartão de ECG', domain: 'cardiologia', body: `## Tipo de ritmo\n\n## Frequência\n\n## PR · QRS · QTc\n\n## Achados-chave\n\n## Diagnóstico\n\n## Conduta\n\n## DDx\n` },
  { id: 'procedimento', icon: '✅', title: 'Procedimento', domain: 'clinico', body: `## Indicações\n\n## Contra-indicações\n\n## Material\n\n## Passos\n1.\n2.\n3.\n\n## Complicações\n` },
  { id: 'review', icon: '🔁', title: 'Review semanal', domain: 'estudo', body: `## O que aprendi\n\n## A aprofundar\n\n## Erros / lacunas\n\n## Plano próxima semana\n` },
]

const DOMAINS = ['farmacologia', 'cardiologia', 'medicina_interna', 'clinico', 'microbiologia', 'anatomia', 'fisiologia', 'estudo']

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export default function NotasPage() {
  const { supabase } = useAuth() as any
  const [tab, setTab] = useState<Tab>('review')
  const [notes, setNotes] = useState<Note[]>([])
  const [dash, setDash] = useState<Dash>({ due_today: 0, total_cards: 0, total_notes: 0, reviewed_today: 0 })
  const [loading, setLoading] = useState(true)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const loadNotes = useCallback(async (q = '') => {
    const headers = await auth()
    const url = new URL('/api/study/notes', window.location.origin)
    if (q) url.searchParams.set('q', q)
    const r = await fetch(url.toString(), { headers })
    const j = await r.json().catch(() => ({}))
    setNotes(j.notes || [])
  }, [auth])

  const loadDash = useCallback(async () => {
    const headers = await auth()
    const r = await fetch('/api/study/cards?limit=1', { headers })
    const j = await r.json().catch(() => ({}))
    if (j.dashboard) setDash(j.dashboard)
  }, [auth])

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadNotes(), loadDash()]); setLoading(false) })()
  }, [loadNotes, loadDash])

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  return (
    <main style={{ padding: '18px clamp(14px,4vw,32px)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Cabeçalho editorial */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8b8f99', marginBottom: 4 }}>Memória clínica</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(22px,4vw,30px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>As tuas notas, a estudar contigo.</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e7e8ea', marginBottom: 16, overflowX: 'auto' }}>
        {([['review', `Rever${dash.due_today ? ` · ${dash.due_today}` : ''}`], ['notes', 'Notas'], ['graph', 'Grafo']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 14, fontWeight: 600, color: tab === t ? ACCENT : '#6b7280',
            borderBottom: `2px solid ${tab === t ? ACCENT : 'transparent'}`, marginBottom: -1,
          }}>{label}{t === 'review' && dash.due_today > 0 && <span style={{ marginLeft: 6, background: '#a82828', color: 'white', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>{dash.due_today}</span>}</button>
        ))}
      </div>

      {tab === 'review' && <ReviewTab auth={auth} dash={dash} onAfter={loadDash} goNotes={() => setTab('notes')} />}
      {tab === 'notes' && <NotesTab auth={auth} notes={notes} reload={async () => { await Promise.all([loadNotes(), loadDash()]) }} />}
      {tab === 'graph' && <NotesGraph notes={notes} onOpen={() => setTab('notes')} />}
    </main>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// REVER — o loop diário (revisão espaçada)
// ════════════════════════════════════════════════════════════════════════════
function ReviewTab({ auth, dash, onAfter, goNotes }: { auth: () => Promise<any>; dash: Dash; onAfter: () => void; goNotes: () => void }) {
  const [cards, setCards] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(0)
  const [audioMode, setAudioMode] = useState(false)

  // TTS — lê em voz alta (pergunta → pausa → resposta), hands-free.
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-PT'; u.rate = 1
    u.onend = () => onEnd?.()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const headers = await auth()
    const r = await fetch('/api/study/cards?limit=40', { headers })
    const j = await r.json().catch(() => ({}))
    setCards(j.cards || []); setIdx(0); setShowBack(false); setLoading(false)
  }, [auth])
  useEffect(() => { load() }, [load])

  async function grade(quality: number) {
    const card = cards[idx]
    if (!card) return
    const headers = await auth()
    fetch('/api/study/cards', { method: 'POST', headers, body: JSON.stringify({ action: 'review', card_id: card.id, quality }) }).catch(() => {})
    setDone(d => d + 1)
    if (idx + 1 < cards.length) { setIdx(idx + 1); setShowBack(false) }
    else { setCards([]); onAfter(); if (typeof window !== 'undefined') window.speechSynthesis?.cancel() }
  }

  // Modo áudio (podcast): lê pergunta → pausa → mostra+lê resposta. Mãos livres.
  useEffect(() => {
    if (!audioMode || loading || cards.length === 0) return
    const card = cards[idx]; if (!card) return
    let cancelled = false
    setShowBack(false)
    speak(`Pergunta: ${card.front}`, () => {
      if (cancelled) return
      setTimeout(() => {
        if (cancelled) return
        setShowBack(true)
        speak(`Resposta: ${card.back}`)
      }, 2500)  // pausa para o utilizador pensar
    })
    return () => { cancelled = true; if (typeof window !== 'undefined') window.speechSynthesis?.cancel() }
  }, [audioMode, idx, loading, cards, speak])

  // Para a voz ao sair da revisão
  useEffect(() => () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel() }, [])

  if (loading) return <p style={{ color: '#6b7280' }}>A preparar a revisão…</p>

  // Estado vazio / concluído
  if (cards.length === 0) {
    const nothingEver = dash.total_cards === 0
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', border: '1px solid #e7e8ea', borderRadius: 12 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{nothingEver ? '🗂️' : '✓'}</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{nothingEver ? 'Ainda não tens cartões' : (done > 0 ? 'Revisão concluída!' : 'Nada para rever agora')}</h2>
        <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.5 }}>
          {nothingEver
            ? 'Cria uma nota e a IA transforma-a em flashcards. Eles voltam a ti no momento certo para fixares.'
            : done > 0 ? `Reviste ${done} cartões. Volta amanhã — a revisão espaçada reagenda automaticamente.`
            : 'Todos os cartões em dia. Volta mais tarde ou cria mais notas.'}
        </p>
        <button onClick={goNotes} style={btn('primary')}>{nothingEver ? '+ Criar primeira nota' : 'Ir às notas'}</button>
      </div>
    )
  }

  const card = cards[idx]
  const pct = Math.round(100 * idx / cards.length)
  return (
    <div>
      {/* Progresso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
        <span>Cartão {idx + 1} de {cards.length}</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setAudioMode(a => !a)} title="Estudar de ouvidos (mãos livres)" style={{
            padding: '4px 10px', borderRadius: 999, border: `1px solid ${audioMode ? '#6d28d9' : '#e7e8ea'}`,
            background: audioMode ? '#6d28d9' : 'white', color: audioMode ? 'white' : '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>{audioMode ? '🎧 A ouvir' : '🎧 Ouvir'}</button>
          <span>{dash.reviewed_today + done} revistos hoje</span>
        </div>
      </div>
      <div style={{ height: 4, background: '#eceef0', borderRadius: 4, marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, transition: 'width 0.3s' }} />
      </div>

      {/* Cartão */}
      <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 'clamp(20px,5vw,40px)', minHeight: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {card.domain && <div style={{ fontSize: 11, color: '#8b8f99', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>{card.domain.replace('_', ' ')}</div>}
        <div style={{ fontSize: 'clamp(16px,2.5vw,20px)', color: '#16181d', lineHeight: 1.5, fontWeight: 600 }}>{card.front}</div>
        {showBack && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e7e8ea', fontSize: 'clamp(14px,2.2vw,17px)', color: '#374151', lineHeight: 1.6 }}>
            {card.back}
          </div>
        )}
      </div>

      {/* Ações */}
      {!showBack ? (
        <button onClick={() => setShowBack(true)} style={{ ...btn('primary'), width: '100%', marginTop: 16, padding: '13px' }}>Mostrar resposta</button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 16 }}>
          {([['Errei', 0, '#a82828'], ['Difícil', 3, '#8a5a16'], ['Bom', 4, '#1f4a8a'], ['Fácil', 5, ACCENT]] as [string, number, string][]).map(([label, q, color]) => (
            <button key={q} onClick={() => grade(q)} style={{
              padding: '12px 6px', border: `1px solid ${color}`, borderRadius: 8, background: 'white', color,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      )}
      <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 12 }}>
        A tua resposta ajusta quando este cartão volta a aparecer (revisão espaçada).
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// NOTAS — lista + captura + editor
// ════════════════════════════════════════════════════════════════════════════
function NotesTab({ auth, notes, reload }: { auth: () => Promise<any>; notes: Note[]; reload: () => Promise<void> }) {
  const [active, setActive] = useState<Note | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return notes
    return notes.filter(n => n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q))
  }, [notes, search])

  if (active) {
    return <NoteEditor auth={auth} note={active} allNotes={notes} onClose={() => setActive(null)} reload={reload} onOpen={setActive} />
  }

  return (
    <div>
      <CaptureBar auth={auth} reload={reload} onCreated={setActive} />

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar nas notas…"
        style={{ ...input, width: '100%', marginBottom: 14, padding: '10px 12px' }} />

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', padding: 30 }}>
          {notes.length === 0 ? 'Sem notas ainda. Usa a captura acima ou um template.' : 'Nada encontrado.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(n => (
            <button key={n.id} onClick={() => setActive(n)} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e7e8ea', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#16181d' }}>{n.title}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {n.domain && <span style={{ fontSize: 11, color: '#6b7280' }}>{n.domain.replace('_', ' ')}</span>}
                  {!!n.card_count && <span style={{ fontSize: 11, color: '#6d28d9', background: '#ede9fe', borderRadius: 999, padding: '1px 8px', fontWeight: 700 }}>{n.card_count} cartões</span>}
                </div>
              </div>
              {n.body && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body.replace(/[#*\[\]]/g, '').slice(0, 160)}</p>}
              {typeof n.mastery === 'number' && n.mastery > 0 && (
                <div style={{ height: 3, background: '#eceef0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(n.mastery * 100)}%`, background: ACCENT }} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Barra de captura sem fricção ──
function CaptureBar({ auth, reload, onCreated }: { auth: () => Promise<any>; reload: () => Promise<void>; onCreated: (n: Note) => void }) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [recState, setRecState] = useState<'idle' | 'recording'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function create(payload: any) {
    setBusy(true)
    const headers = await auth()
    const r = await fetch('/api/study/notes', { method: 'POST', headers, body: JSON.stringify(payload) })
    const j = await r.json().catch(() => ({}))
    setBusy(false); setShowTemplates(false); setStatus('')
    if (j.note) { await reload(); onCreated(j.note) }
    return j.note
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true); setStatus('A ler a imagem…')
    const reader = new FileReader()
    reader.onload = async () => {
      const b64 = String(reader.result).split(',')[1]
      const headers = await auth()
      const r = await fetch('/api/study/note-capture', { method: 'POST', headers, body: JSON.stringify({ image: b64, mimeType: file.type }) })
      const j = await r.json().catch(() => ({}))
      if (j.note) await create({ ...j.note, source: 'photo' })
      else { alert(j.error || 'Não consegui ler a imagem.'); setBusy(false); setStatus('') }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Gravar aula → segmentos de 4 min → Whisper por segmento → estruturar.
  // Suporta aulas de 1h+ sem rebentar limites de tamanho/timeout.
  const SEGMENT_MS = 4 * 60_000
  const transcriptRef = useRef<string>('')
  const segTimerRef = useRef<any>(null)
  const stoppingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const segCountRef = useRef(0)

  async function transcribeBlob(blob: Blob): Promise<string> {
    if (blob.size < 2000) return ''
    const b64 = await blobToB64(blob)
    const headers = await auth()
    const tr = await fetch('/api/study/transcribe', { method: 'POST', headers, body: JSON.stringify({ action: 'transcribe', audio: b64, mimeType: 'audio/webm' }) })
    const tj = await tr.json().catch(() => ({}))
    return tj.transcript || ''
  }

  function startSegment() {
    const stream = streamRef.current
    if (!stream) return
    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data) }
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      segCountRef.current += 1
      setStatus(`A transcrever segmento ${segCountRef.current}…`)
      try {
        const t = await transcribeBlob(blob)
        if (t) transcriptRef.current += (transcriptRef.current ? ' ' : '') + t
      } catch {}
      if (stoppingRef.current) finishRecording()
      else { setStatus('⏺ A gravar…'); startSegment() }  // próximo segmento
    }
    mr.start(); mediaRef.current = mr
    // agenda corte do segmento
    segTimerRef.current = setTimeout(() => { try { mr.stop() } catch {} }, SEGMENT_MS)
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      transcriptRef.current = ''; segCountRef.current = 0; stoppingRef.current = false
      setRecState('recording'); setStatus('⏺ A gravar…')
      startSegment()
    } catch {
      alert('Não consegui aceder ao microfone. Verifica as permissões.')
    }
  }

  function stopRec() {
    stoppingRef.current = true
    setRecState('idle'); setBusy(true); setStatus('A finalizar…')
    if (segTimerRef.current) clearTimeout(segTimerRef.current)
    try { mediaRef.current?.stop() } catch { finishRecording() }
  }

  async function finishRecording() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    const transcript = transcriptRef.current.trim()
    if (!transcript) { setBusy(false); setStatus(''); alert('Não foi captado áudio suficiente.'); return }
    setStatus('A estruturar nota…')
    const headers = await auth()
    const sr = await fetch('/api/study/transcribe', { method: 'POST', headers, body: JSON.stringify({ action: 'structure', transcript, kind: 'aula' }) })
    const sj = await sr.json().catch(() => ({}))
    if (sj.note) await create({ ...sj.note, source: 'voice' })
    else { setBusy(false); setStatus(''); alert(sj.error || 'Falha ao estruturar.') }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        <button onClick={() => create({ title: 'Nova nota', source: 'manual' })} disabled={busy} style={captureBtn}>
          <span style={{ fontSize: 18 }}>✍️</span><span>Nota em branco</span>
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={captureBtn}>
          <span style={{ fontSize: 18 }}>📷</span><span>Foto do quadro</span>
        </button>
        <button onClick={recState === 'recording' ? stopRec : startRec} disabled={busy}
          style={{ ...captureBtn, ...(recState === 'recording' ? { borderColor: '#a82828', color: '#a82828' } : {}) }}>
          <span style={{ fontSize: 18 }}>{recState === 'recording' ? '⏹' : '🎙️'}</span>
          <span>{recState === 'recording' ? 'Parar gravação' : 'Gravar aula'}</span>
        </button>
        <button onClick={() => setShowTemplates(s => !s)} disabled={busy} style={captureBtn}>
          <span style={{ fontSize: 18 }}>📋</span><span>Template</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
      {recState === 'recording' && <p style={{ fontSize: 12, color: '#a82828', marginTop: 8, fontWeight: 600 }}>⏺ A gravar… carrega em "Parar gravação" quando terminares.</p>}
      {(busy || status) && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{status || 'A processar…'}</p>}
      {showTemplates && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 6, marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 10, border: '1px solid #e7e8ea' }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => create({ title: t.title, body: t.body, domain: t.domain, source: 'template' })} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'white', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left',
            }}>
              <span>{t.icon}</span><span>{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Editor de nota ──
function NoteEditor({ auth, note, allNotes, onClose, reload, onOpen }: {
  auth: () => Promise<any>; note: Note; allNotes: Note[]; onClose: () => void; reload: () => Promise<void>; onOpen: (n: Note) => void
}) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body || '')
  const [domain, setDomain] = useState(note.domain || '')
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState(false)
  const [cardCount, setCardCount] = useState(note.card_count || 0)
  const [msg, setMsg] = useState('')
  const [recording, setRecording] = useState(false)
  const recRef = useRef<any>(null)

  // Voz
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR(); r.lang = 'pt-PT'; r.continuous = true; r.interimResults = true
    r.onresult = (e: any) => {
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
      if (final) setBody(b => b + final)
    }
    r.onend = () => setRecording(false)
    recRef.current = r
  }, [])

  function toggleRec() {
    if (!recRef.current) { alert('Ditado por voz requer Chrome/Edge.'); return }
    if (recording) { recRef.current.stop(); setRecording(false) } else { recRef.current.start(); setRecording(true) }
  }

  async function save() {
    if (!title.trim() || busy) return
    setBusy(true); setMsg('')
    const headers = await auth()
    const linkedTitles = Array.from(body.matchAll(/\[\[([^\]]+)\]\]/g)).map(m => m[1].toLowerCase().trim())
    const linked = allNotes.filter(n => linkedTitles.includes(n.title.toLowerCase().trim())).map(n => n.id)
    await fetch('/api/study/notes', { method: 'PATCH', headers, body: JSON.stringify({ id: note.id, title: title.trim(), body, domain: domain || null, linked_ids: linked }) })
    await reload(); setBusy(false); setMsg('Guardado')
    setTimeout(() => setMsg(''), 1500)
  }

  // Guardar + gerar flashcards (o coração do conceito)
  async function saveAndGenerate() {
    if (!body.trim()) { alert('Escreve algo primeiro.'); return }
    await save()
    setBusy(true); setMsg('A gerar flashcards…')
    const headers = await auth()
    const r = await fetch('/api/study/cards', { method: 'POST', headers, body: JSON.stringify({ action: 'generate', note_id: note.id, title, text: body }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (j.count != null) { setCardCount(j.count); setMsg(`${j.count} flashcards criados`); await reload() }
    else setMsg(j.error || 'Erro a gerar')
    setTimeout(() => setMsg(''), 2500)
  }

  async function aiTransform(action: string) {
    if (!body.trim()) return
    setBusy(true); setMsg('IA a trabalhar…')
    const headers = await auth()
    const r = await fetch('/api/study/notes-ai', { method: 'POST', headers, body: JSON.stringify({ action, text: body, title, note_id: note.id }) })
    const j = await r.json().catch(() => ({})); setBusy(false); setMsg('')
    if (j.result) setBody(j.result)
    else if (j.error) setMsg(j.error)
  }

  async function remove() {
    if (!confirm('Eliminar esta nota e os seus cartões?')) return
    const headers = await auth()
    await fetch(`/api/study/notes?id=${note.id}`, { method: 'DELETE', headers })
    await reload(); onClose()
  }

  function openLink(t: string) {
    const target = allNotes.find(n => n.title.toLowerCase().trim() === t.toLowerCase().trim())
    if (target) onOpen(target)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <button onClick={onClose} style={btn('ghost')}>← Notas</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>{msg}</span>}
          <button onClick={remove} style={{ ...btn('ghost'), color: '#a82828' }}>Eliminar</button>
          <button onClick={save} disabled={busy} style={btn('ghost')}>Guardar</button>
        </div>
      </div>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título"
        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, fontFamily: 'var(--font-serif,serif)', marginBottom: 8, boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={input}>
          <option value="">Sem domínio</option>
          {DOMAINS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 7, padding: 2 }}>
          <button onClick={() => setView('edit')} style={tbtn(view === 'edit')}>Editar</button>
          <button onClick={() => setView('preview')} style={tbtn(view === 'preview')}>Ver</button>
        </div>
        <button onClick={toggleRec} style={{ ...aibtn, borderColor: recording ? '#a82828' : '#c4b5fd', color: recording ? '#a82828' : '#6d28d9' }}>
          {recording ? '⏺ A gravar…' : '🎤 Ditar'}
        </button>
      </div>

      {/* IA toolbar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {([['summarize', 'Resumir'], ['expand', 'Expandir'], ['simplify', 'Simplificar']] as [string, string][]).map(([a, l]) => (
          <button key={a} onClick={() => aiTransform(a)} disabled={busy} style={aibtn}>{l}</button>
        ))}
      </div>

      {view === 'edit' ? (
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Escreve em markdown. Usa [[título]] para ligar a outra nota."
          style={{ width: '100%', minHeight: 300, padding: 14, border: '1px solid #e7e8ea', borderRadius: 10, fontFamily: 'var(--font-mono,monospace)', fontSize: 14, lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical' }} />
      ) : (
        <div style={{ minHeight: 300, padding: 14, border: '1px solid #e7e8ea', borderRadius: 10 }}>
          <MarkdownRender text={body} onLink={openLink} />
        </div>
      )}

      {/* O coração: gerar flashcards */}
      <div style={{ marginTop: 14, padding: 16, background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#6d28d9' }}>Transformar em revisão</div>
            <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>
              {cardCount > 0 ? `${cardCount} flashcards desta nota entram na revisão espaçada.` : 'A IA cria flashcards e mete-os na tua revisão diária.'}
            </div>
          </div>
          <button onClick={saveAndGenerate} disabled={busy} style={{ ...btn('primary'), background: '#6d28d9', whiteSpace: 'nowrap' }}>
            {cardCount > 0 ? 'Regenerar flashcards' : 'Gerar flashcards'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MarkdownRender (preservado) ────────────────────────────────────────────
function MarkdownRender({ text, onLink }: { text: string; onLink?: (title: string) => void }) {
  if (!text) return <p style={{ color: '#9ca3af', fontSize: 13 }}>(Sem conteúdo)</p>
  let html = text
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-family:monospace;font-size:12.5px">$1</code>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0" />')
    .replace(/^\s*- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul style="margin:6px 0;padding-left:22px">$1</ul>')
    .replace(/\[\[([^\]]+)\]\]/g, (_m, t) => `<a href="#" data-link="${t}" style="background:#eff6ff;color:#1e40af;padding:1px 8px;border-radius:6px;text-decoration:none;border:1px solid #bfdbfe;font-weight:600;font-size:12.5px">${t}</a>`)
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
  html = `<p style="margin:8px 0">${html}</p>`
  return (
    <div className="md-content" onClick={e => { const t = e.target as HTMLElement; if (t.dataset?.link && onLink) { e.preventDefault(); onLink(t.dataset.link) } }} style={{ color: '#111827' }}>
      <style>{`.md-h1{font-size:22px;font-weight:700;margin:16px 0 8px}.md-h2{font-size:18px;font-weight:700;margin:14px 0 6px;color:${ACCENT}}.md-h3{font-size:15px;font-weight:700;margin:12px 0 4px;color:#374151}`}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

// ─── NotesGraph (preservado) ────────────────────────────────────────────────
function NotesGraph({ notes, onOpen }: { notes: Note[]; onOpen: (n: Note) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const { positions, edges } = useMemo(() => {
    const W = 900, H = 600, cx = W / 2, cy = H / 2
    const adj: Record<string, Set<string>> = {}
    for (const n of notes) { adj[n.id] = new Set(n.linked_ids || []); for (const o of notes) if ((o.linked_ids || []).includes(n.id)) adj[n.id].add(o.id) }
    const sorted = [...notes].sort((a, b) => (adj[b.id]?.size || 0) - (adj[a.id]?.size || 0))
    const positions: Record<string, { x: number; y: number; degree: number }> = {}
    sorted.forEach((n) => {
      const degree = adj[n.id]?.size || 0
      const ring = degree >= 4 ? 0 : degree >= 2 ? 1 : degree >= 1 ? 2 : 3
      const radius = [80, 180, 280, 360][ring] || 360
      const ringNodes = sorted.filter(m => { const d = adj[m.id]?.size || 0; const r = d >= 4 ? 0 : d >= 2 ? 1 : d >= 1 ? 2 : 3; return r === ring })
      const i = ringNodes.indexOf(n); const angle = (i / Math.max(1, ringNodes.length)) * 2 * Math.PI - Math.PI / 2
      positions[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), degree }
    })
    const edgeSet = new Set<string>(); const edges: { from: string; to: string }[] = []
    for (const n of notes) for (const link of (n.linked_ids || [])) { const key = [n.id, link].sort().join('|'); if (edgeSet.has(key) || !positions[link]) continue; edgeSet.add(key); edges.push({ from: n.id, to: link }) }
    return { positions, edges }
  }, [notes])

  if (notes.length === 0) return <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 14, padding: 40, textAlign: 'center', color: '#6b7280' }}>Sem notas. Usa [[título]] dentro das notas para criar ligações.</div>
  const W = 900, H = 600
  return (
    <div style={{ background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}><b>{notes.length}</b> notas · <b>{edges.length}</b> ligações</div>
      <div style={{ overflow: 'auto', background: '#fafafa', borderRadius: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 600, display: 'block' }}>
          {edges.map((e, i) => { const p1 = positions[e.from], p2 = positions[e.to]; if (!p1 || !p2) return null; const h = hover === e.from || hover === e.to; return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={h ? ACCENT : '#cbd5e1'} strokeWidth={h ? 2 : 1} opacity={hover && !h ? 0.25 : 0.65} /> })}
          {notes.map(n => { const p = positions[n.id]; if (!p) return null; const r = 8 + Math.min(14, p.degree * 3); const h = hover === n.id; return (
            <g key={n.id} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => onOpen(n)}>
              <circle cx={p.x} cy={p.y} r={r} fill={p.degree >= 4 ? '#dc2626' : p.degree >= 2 ? '#7c3aed' : p.degree >= 1 ? ACCENT : '#94a3b8'} opacity={hover && !h ? 0.4 : 1} stroke="white" strokeWidth={2} />
              <text x={p.x} y={p.y + r + 12} fontSize={11} fontWeight={h ? 700 : 500} fill="#111827" textAnchor="middle" opacity={hover && !h ? 0.4 : 1}>{n.title.length > 22 ? n.title.slice(0, 22) + '…' : n.title}</text>
            </g>
          ) })}
        </svg>
      </div>
    </div>
  )
}

// ─── estilos ────────────────────────────────────────────────────────────────
const input: React.CSSProperties = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const aibtn: React.CSSProperties = { padding: '6px 11px', background: 'white', border: '1px solid #c4b5fd', color: '#6d28d9', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }
const captureBtn: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 10px', background: 'white', border: '1px solid #e7e8ea', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#16181d' }
function tbtn(active: boolean): React.CSSProperties { return { padding: '5px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: active ? ACCENT : 'transparent', color: active ? 'white' : '#374151' } }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '9px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 13.5 }
  return { padding: '8px 14px', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 13 }
}
