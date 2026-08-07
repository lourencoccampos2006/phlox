'use client'

// VoiceLogger — "Regista falando". Botão flutuante sitewide (modo institucional,
// lar/centro de dia) que transforma uma frase falada durante a ronda em
// registos estruturados — refeições, enfermagem/acompanhamento, sinais
// vitais, atividades, medicação, serviços de apoio. Pensado para ambiente
// ruidoso (sala partilhada, TV, várias pessoas a falar): a decisão mais
// arriscada — DE QUEM se está a falar — nunca é adivinhada pela IA a partir
// do áudio. É sempre um toque explícito, ANTES de gravar. A transcrição é
// sempre mostrada e editável antes de seguir, e cada ação proposta só grava
// depois de confirmação individual — nada é automático em nenhum passo.
//
// 2026-08-07 (fortificação, a pedido de Fernando): transcrição passou de
// whisper-large-v3-turbo para o modelo completo + vocabulário de arranque
// (lib/ai.ts transcribeAudio) — rigor importa mais que velocidade numa
// gravação curta em sala ruidosa. Domínio ganhou sinais vitais e atividades
// (medicação e ocorrências continuam de fora por serem as duas áreas mais
// sensíveis a um erro de transcrição/interpretação).

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, currentShiftFor, type Shift } from '@/lib/institutionConfig'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string; room_number?: string | null }
interface ProposedAction {
  domain: 'nutrition' | 'health_checkin' | 'support_service' | 'medication' | 'vitals' | 'activity'
  summary: string
  payload: Record<string, any>
  approved: boolean
}

type Step = 'closed' | 'pick' | 'record' | 'transcribing' | 'transcript' | 'extracting' | 'actions' | 'saving' | 'done'

const DOMAIN_META: Record<ProposedAction['domain'], { label: string; icon: string }> = {
  nutrition:       { label: 'Refeição',            icon: 'meal' },
  health_checkin:  { label: 'Saúde & Apoio',       icon: 'stethoscope' },
  support_service: { label: 'Serviço de apoio',    icon: 'shirt' },
  medication:      { label: 'Medicação',           icon: 'pill' },
  vitals:          { label: 'Sinais vitais',       icon: 'heart' },
  activity:        { label: 'Atividade',           icon: 'trophy' },
}

const MAX_RECORD_MS = 60_000

// Mesma conversão já usada em app/study/notas/page.tsx (Gravar aula) — o
// endpoint de transcrição partilhado (lib/ai.ts transcribeAudio) espera
// base64 sem o prefixo "data:...;base64,", não um Blob/FormData.
function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

export default function VoiceLogger() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const cfg = institutionConfig(institution)

  const [step, setStep] = useState<Step>('closed')
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [transcript, setTranscript] = useState('')
  const [actions, setActions] = useState<ProposedAction[]>([])
  const [err, setErr] = useState('')
  const [level, setLevel] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [results, setResults] = useState<{ domain: string; ok: boolean }[]>([])

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const shift: Shift = currentShiftFor(institution)
  const today = new Date().toISOString().slice(0, 10)

  async function authHeader() {
    const { data } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }

  const loadPatients = useCallback(async () => {
    if (!user) return
    const { data } = await scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name')
    setPatients(data || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  function open() { setStep('pick'); setSearch(''); setErr(''); loadPatients() }
  function closeAll() {
    stopRecording(false)
    setStep('closed'); setPatient(null); setTranscript(''); setActions([]); setResults([]); setErr('')
  }

  function pick(p: Patient) { setPatient(p); startRecording() }

  // Retroceder até trocar de pessoa — nunca só "recomeçar o texto", também dá
  // para admitir que se tocou no nome errado, em qualquer ponto do fluxo.
  function changeResident() {
    stopRecording(false)
    setPatient(null); setTranscript(''); setActions([]); setErr('')
    setStep('pick'); setSearch(''); loadPatients()
  }

  async function startRecording() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { void handleStopped() }
      mr.start()
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setStep('record')

      // Medidor de nível — feedback visual de que o microfone está mesmo a
      // captar som, essencial em sala ruidosa (a pessoa vê, não tem de confiar
      // cegamente que está a gravar).
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((s, v) => s + v, 0) / data.length
        setLevel(Math.min(100, Math.round((avg / 140) * 100)))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()

      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current
        setElapsedMs(ms)
        if (ms >= MAX_RECORD_MS) stopRecording(true)
      }, 200)
    } catch {
      setErr('Não foi possível aceder ao microfone. Verifica as permissões do browser.')
      setStep('pick')
    }
  }

  function stopRecording(keep: boolean) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setLevel(0)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!keep) mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
  }

  async function handleStopped() {
    if (chunksRef.current.length === 0) { setStep('pick'); return }
    setStep('transcribing')
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const b64 = await blobToB64(blob)
      const res = await fetch('/api/voice-log/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ audio: b64, mimeType: 'audio/webm' }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro na transcrição.')
      setTranscript(j.transcript)
      setStep('transcript')
    } catch (e: any) {
      setErr(e.message || 'Não foi possível transcrever. Tenta de novo.')
      setStep('transcript')
      setTranscript('')
    }
  }

  function reRecord() { setTranscript(''); setActions([]); startRecording() }

  async function extract() {
    if (!transcript.trim() || !patient) return
    setStep('extracting'); setErr('')
    try {
      const res = await fetch('/api/voice-log/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ transcript: transcript.trim(), patient_id: patient.id }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro ao interpretar.')
      // Medicação começa por DEFEITO por confirmar (não pré-marcada) — é o domínio
      // de maior risco, exige um toque extra e deliberado antes de gravar.
      const withApproval: ProposedAction[] = (j.actions || []).map((a: any) => ({ ...a, approved: a.domain !== 'medication' }))
      if (withApproval.length === 0) { setErr('Não encontrei nada de refeições, saúde ou apoio nessa frase — tenta ser mais específico, ou regista à mão.') }
      setActions(withApproval)
      setStep('actions')
    } catch (e: any) {
      setErr(e.message || 'Não foi possível interpretar. Tenta de novo.')
      setStep('actions')
      setActions([])
    }
  }

  function toggleAction(i: number) { setActions(a => a.map((x, idx) => idx === i ? { ...x, approved: !x.approved } : x)) }

  async function commit() {
    const approved = actions.filter(a => a.approved)
    if (!patient || approved.length === 0) return
    setStep('saving'); setErr('')
    try {
      const res = await fetch('/api/voice-log/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ patient_id: patient.id, date: today, shift, actions: approved.map(({ domain, payload }) => ({ domain, payload })) }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro ao gravar.')
      setResults(j.results || [])
      setStep('done')
    } catch (e: any) {
      setErr(e.message || 'Não foi possível gravar. Tenta de novo.')
      setStep('actions')
    }
  }

  useEffect(() => () => { stopRecording(false) }, [])

  // Só faz sentido em lar/centro de dia — refeições/enfermagem/apoio não se
  // aplicam a farmácia/clínica.
  if (institution !== 'nursing_home' && institution !== 'day_care') return null

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const secondsLeft = Math.max(0, Math.round((MAX_RECORD_MS - elapsedMs) / 1000))

  return (
    <>
      <button onClick={open} aria-label="Regista falando" className="voicelogger-fab-avoid-nav" style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 9000, width: 52, height: 52, borderRadius: '50%',
        background: '#7c3aed', border: 'none', boxShadow: '0 4px 16px rgba(124,58,237,0.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="spark" size={22} color="white" />
      </button>

      {step !== 'closed' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget && step === 'pick') closeAll() }}>
          <div style={{ background: 'white', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: '18px 18px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Regista falando</div>
                {patient && step !== 'pick' && (
                  <button onClick={changeResident} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, color: '#7c3aed', fontWeight: 600, textDecoration: 'underline' }}>
                    Trocar de {cfg.personNoun.toLowerCase()} ({patient.name})
                  </button>
                )}
              </div>
              <button onClick={closeAll} aria-label="Fechar" style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--ink-4)', cursor: 'pointer', padding: 0 }}>×</button>
            </div>

            {step === 'pick' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>De quem se trata? Toca primeiro — só depois falas.</p>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
                  style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                  {filtered.map(p => (
                    <button key={p.id} onClick={() => pick(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 13px', background: 'var(--bg-2)', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                      {p.name}
                      {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{cfg.roomLabel} {p.room_number}</span>}
                    </button>
                  ))}
                  {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem resultados.</div>}
                </div>
                {err && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{err}</div>}
              </div>
            )}

            {step === 'record' && patient && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>A falar sobre <strong style={{ color: 'var(--ink)' }}>{patient.name}</strong></div>
                {/* Medidor de nível visível — em sala ruidosa, ver é mais fiável que confiar */}
                <div style={{ width: '100%', maxWidth: 220, height: 10, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${level}%`, height: '100%', background: level > 8 ? '#16a34a' : '#cbd5e1', transition: 'width 80ms linear' }} />
                </div>
                <div style={{ width: 84, height: 84, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 8px rgba(124,58,237,0.15)' }}>
                  <Icon name="spark" size={32} color="white" />
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>A gravar… {secondsLeft}s restantes</div>
                <button onClick={() => stopRecording(true)} style={{ padding: '10px 24px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                  Parar
                </button>
                {level <= 5 && (
                  <div style={{ fontSize: 12, color: '#b45309', textAlign: 'center' }}>Não estou a ouvir muito bem — fala mais perto do telemóvel.</div>
                )}
              </div>
            )}

            {step === 'transcribing' && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>A perceber o que foi dito…</div>
            )}

            {step === 'transcript' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0 }}>Confirma ou corrige antes de continuar — nada foi gravado ainda.</p>
                <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={4}
                  style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical' }} />
                {err && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={reRecord} style={{ flex: 1, padding: '10px', background: 'white', border: '1.5px solid var(--border)', color: 'var(--ink-3)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Gravar de novo
                  </button>
                  <button onClick={extract} disabled={!transcript.trim()} style={{ flex: 1, padding: '10px', background: transcript.trim() ? 'var(--ink)' : 'var(--bg-3)', color: transcript.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: transcript.trim() ? 'pointer' : 'not-allowed' }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {step === 'extracting' && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>A organizar em registos…</div>
            )}

            {step === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0 }}>Confirma o que fica registado — desmarca o que não quiseres.</p>
                {err && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{err}</div>}
                {actions.map((a, i) => {
                  const isMed = a.domain === 'medication'
                  return (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 9, cursor: 'pointer',
                      background: a.approved ? (isMed ? '#fffbeb' : 'var(--bg-2)') : 'white',
                      border: `1.5px solid ${a.approved ? (isMed ? '#f59e0b' : 'var(--border)') : 'var(--bg-3)'}`,
                      opacity: a.approved ? 1 : 0.5,
                    }}>
                      <input type="checkbox" checked={a.approved} onChange={() => toggleAction(i)} style={{ width: 16, height: 16 }} />
                      <Icon name={DOMAIN_META[a.domain].icon} size={16} color={isMed ? '#b45309' : 'var(--ink-3)'} />
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: isMed ? '#b45309' : 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: isMed ? 700 : 400 }}>{DOMAIN_META[a.domain].label}{isMed ? ' — confirma bem' : ''}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.summary}</div>
                      </div>
                    </label>
                  )
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => setStep('transcript')} style={{ flex: 1, padding: '10px', background: 'white', border: '1.5px solid var(--border)', color: 'var(--ink-3)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    ← Voltar ao texto
                  </button>
                  <button onClick={commit} disabled={!actions.some(a => a.approved)} style={{ flex: 1, padding: '10px', background: actions.some(a => a.approved) ? 'var(--green)' : 'var(--bg-3)', color: actions.some(a => a.approved) ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: actions.some(a => a.approved) ? 'pointer' : 'not-allowed' }}>
                    Confirmar e guardar
                  </button>
                </div>
              </div>
            )}

            {step === 'saving' && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>A guardar…</div>
            )}

            {step === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: r.ok ? 'var(--ink)' : '#dc2626' }}>
                    <Icon name={r.ok ? 'check' : 'alert'} size={16} color={r.ok ? '#16a34a' : '#dc2626'} />
                    {DOMAIN_META[r.domain as ProposedAction['domain']]?.label || r.domain} {r.ok ? 'guardado' : 'falhou'}
                  </div>
                ))}
                <button onClick={closeAll} style={{ marginTop: 6, padding: '10px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@media (max-width: 768px) { .voicelogger-fab-avoid-nav { bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 14px) !important; } }`}</style>
    </>
  )
}
