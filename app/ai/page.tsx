'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import Markdown from '@/components/Markdown'
import MicButton from '@/components/MicButton'

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant' | 'system'

interface Message {
  id: string
  role: Role
  content: string
  timestamp: Date
  thinking?: string
  sources?: string[]
  actions?: Action[]
  imageUrl?: string                  // pré-visualização da imagem enviada (data: URL)
}

interface Action {
  label: string
  href?: string
  prompt?: string
}

interface FamilyProfileCtx {
  id: string
  name: string
  relation?: string
  age?: number
  sex?: string
  weight?: number
  creatinine?: number
  conditions?: string
  allergies?: string
}

interface PatientContext {
  meds: { name: string; dose?: string; frequency?: string; indication?: string }[]
  history: { query: string; type: string; result_severity?: string }[]
  plan: string
  familyProfile?: FamilyProfileCtx
  clinicalPatient?: {
    id: string
    name: string
    age?: number | null
    sex?: string | null
    conditions?: string | null
    allergies?: string | null
    creatinine?: number | null
    weight?: number | null
    crCl?: number | null
  }
}

// ─── Suggested Prompts ───────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'Analisa os meus medicamentos e diz-me se há algum problema',
  'Preciso de um AINE para dor — qual é mais seguro para mim?',
  'Estou a fazer exames — o que devo suspender antes?',
  'Tenho tosse com o ramipril. Qual a alternativa?',
  'Posso tomar ibuprofeno com a minha medicação?',
  'Explica-me para que serve cada um dos meus medicamentos',
]

const PRO_PROMPTS = [
  'Gera o protocolo terapêutico para este doente com IC e DM2',
  'Este doente precisa de antibioterapia empírica — qual escolher com este perfil?',
  'Calcula o ajuste de dose de gentamicina para TFG 28',
  'Que interações devo vigiar neste doente polimedicado?',
]

const CLINICAL_PROMPTS = [
  'Gera um SOAP farmacêutico para este doente',
  'Que interações devo vigiar nesta polimedicação?',
  'Calcula o ajuste de dose de gentamicina para TFG 28',
  'Protocolo terapêutico para IC + DM2',
  'Critérios STOPP/START para doente ≥ 75 anos',
  'Antibioterapia empírica para infecção respiratória',
]

const STUDENT_PROMPTS = [
  'Explica o mecanismo da varfarina e as suas interações',
  'Qual a diferença entre AINEs selectivos e não selectivos?',
  'O que é o efeito de primeira passagem?',
  'Explica os critérios STOPP/START de forma simples',
  'Como calcular o ajuste de dose com insuficiência renal?',
  'Qual a diferença entre clearance e volume de distribuição?',
]

const CAREGIVER_PROMPTS = [
  'Há interações entre os medicamentos do meu familiar?',
  'A dosagem é segura para a idade dele/dela?',
  'Que efeitos adversos devo vigiar?',
  'O que fazer se esqueceu uma dose?',
  'Que alimentos deve evitar com esta medicação?',
  'Posso partir ou triturar este comprimido?',
]

const FAMILY_PROMPTS = [
  'Há interações entre os medicamentos deste perfil?',
  'A medicação é adequada para a idade?',
  'Que efeitos adversos devo vigiar?',
  'Preciso de ajuste de dose com esta função renal?',
]

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          🧠
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Phlox AI — Farmacologista Clínico
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 8 }}>
          O teu farmacologista clínico pessoal. Conhece os teus medicamentos, faz as perguntas certas, e dá respostas clínicas reais — com raciocínio transparente e fontes verificadas.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
          Disponível no plano Plus (3,99€/mês).
        </p>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
          {[
            { text: 'Chat conversacional com memória do teu doente' },
            { text: 'Raciocínio clínico transparente — vês como pensa' },
            { text: 'Integrado com os teus medicamentos pessoais' },
            { text: 'Suporte a perfis familiares — consulta para qualquer familiar' },
            { text: 'Respostas ao nível de um farmacologista clínico' },
          ].map(({ text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
            Desbloquear Phlox AI →
          </Link>
          <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 20px', borderRadius: 6, fontSize: 13, border: '1px solid var(--border-2)' }}>
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const [showThinking, setShowThinking] = useState(false)
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {msg.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.imageUrl} alt="enviada" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 14, border: '1px solid rgba(255,255,255,0.3)', objectFit: 'cover', boxShadow: '0 6px 18px -8px rgba(13,110,66,0.35)' }} />
          )}
          {(msg.content && msg.content !== '(imagem)') && (
            <div style={{ background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', boxShadow: '0 6px 18px -8px rgba(13,110,66,0.45)' }}>
              <p style={{ fontSize: 14, color: 'white', lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 22, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, boxShadow: '0 4px 12px rgba(13,110,66,0.25)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.thinking && (
          <button onClick={() => setShowThinking(!showThinking)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10 }}>{showThinking ? '▾' : '▸'}</span>
            Raciocínio clínico
          </button>
        )}
        {showThinking && msg.thinking && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', marginBottom: 10, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
            {msg.thinking}
          </div>
        )}
        <div style={{ background: 'white', border: '1px solid #eef0f3', borderRadius: '6px 18px 18px 18px', padding: '16px 20px', boxShadow: '0 2px 8px -2px rgba(8,12,24,0.04)' }}>
          <div style={{ fontSize: 14.5, color: '#1a202c', lineHeight: 1.7 }}>
            <Markdown text={msg.content} />
          </div>
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {msg.sources.map(s => (
              <span key={s} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 7px' }}>
                {s}
              </span>
            ))}
          </div>
        )}
        {msg.actions && msg.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {msg.actions.map(action =>
              action.href ? (
                <Link key={action.label} href={action.href}
                  style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green-2)', textDecoration: 'none', border: '1px solid var(--green-mid)', borderRadius: 4, padding: '5px 12px', fontWeight: 600 }}>
                  {action.label} →
                </Link>
              ) : null
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
            {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={handleCopy}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 10, color: copied ? 'var(--green)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 3 }}>
            {copied ? '✓ copiado' : '⎘ copiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(13,110,66,0.25)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
      </div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px 16px 16px 16px', padding: '14px 18px', display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 2px 8px rgba(8,12,24,0.04)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d6e42', animation: `typingBounce 1.4s ${i * 0.16}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Inner chat component (needs useSearchParams → must be inside Suspense) ───

function AIChat() {
  const { user, supabase } = useAuth()
  const searchParams = useSearchParams()
  const profileId = searchParams.get('profile')   // UUID or 'self' or null (family profiles)
  const patientId  = searchParams.get('patient')   // UUID (Pro clinical patients)
  const initialQuery = searchParams.get('q')       // pre-filled question from homepage

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'
  const isFamilyProfile = !!profileId && profileId !== 'self'
  const isClinicalPatient = !!patientId

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [patientCtx, setPatientCtx] = useState<PatientContext | null>(null)
  const [ctxLoaded, setCtxLoaded] = useState(false)
  // 2026-06-01: o utilizador pediu que a AI fosse um chat normal — guarda
  // conversas anteriores e permite escolher se queremos contexto pessoal.
  const [chatId, setChatId] = useState<string>(() => `c_${Date.now().toString(36)}`)
  const [includeContext, setIncludeContext] = useState<boolean>(true)
  const [showHistory, setShowHistory] = useState(false)
  const [savedChats, setSavedChats] = useState<{ id: string; title: string; updated: number; count: number }[]>([])

  // Auto-guarda o chat atual em localStorage sempre que muda. Limpa lista
  // antiga ao mesmo tempo (cap 25 chats).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (messages.length < 2) return
    try {
      const key = `phlox-ai-chat:${chatId}`
      const title = messages.find(m => m.role === 'user')?.content?.slice(0, 80) || 'Conversa'
      const payload = {
        id: chatId, title, updated: Date.now(), count: messages.length,
        messages: messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp })),
      }
      localStorage.setItem(key, JSON.stringify(payload))
      // Mantém index global
      const idx = JSON.parse(localStorage.getItem('phlox-ai-chats') || '[]') as any[]
      const others = idx.filter(c => c.id !== chatId)
      const next = [{ id: chatId, title, updated: payload.updated, count: messages.length }, ...others].slice(0, 25)
      localStorage.setItem('phlox-ai-chats', JSON.stringify(next))
      setSavedChats(next)
    } catch { /* quota */ }
  }, [messages, chatId])

  // Carrega a lista de chats anteriores quando abre o painel
  useEffect(() => {
    if (!showHistory) return
    try {
      const idx = JSON.parse(localStorage.getItem('phlox-ai-chats') || '[]') as any[]
      setSavedChats(idx)
    } catch {}
  }, [showHistory])

  function openSavedChat(id: string) {
    try {
      const raw = localStorage.getItem(`phlox-ai-chat:${id}`)
      if (!raw) return
      const p = JSON.parse(raw)
      setChatId(id)
      setMessages((p.messages || []).map((m: any) => ({ ...m, id: m.id || `r${Math.random()}`, timestamp: new Date(m.timestamp || Date.now()) })))
      setShowHistory(false)
    } catch {}
  }
  function newChat() {
    setChatId(`c_${Date.now().toString(36)}`)
    setMessages([])
    setShowHistory(false)
  }
  function deleteSavedChat(id: string) {
    try {
      localStorage.removeItem(`phlox-ai-chat:${id}`)
      const idx = JSON.parse(localStorage.getItem('phlox-ai-chats') || '[]') as any[]
      const next = idx.filter(c => c.id !== id)
      localStorage.setItem('phlox-ai-chats', JSON.stringify(next))
      setSavedChats(next)
      if (id === chatId) newChat()
    } catch {}
  }
  const [familyProfile, setFamilyProfile] = useState<FamilyProfileCtx | null>(null)
  const [clinicalPatient, setClinicalPatient] = useState<PatientContext['clinicalPatient'] | null>(null)
  // Imagem pendente para enviar com a próxima mensagem (preview no input)
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; mime: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialQuerySent = useRef(false)

  // Comprime + converte para dataURL (limita ao máximo 1600px de lado)
  async function fileToImage(file: File): Promise<{ dataUrl: string; mime: string } | null> {
    if (!file.type.startsWith('image/')) return null
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const max = 1600
          const ratio = Math.min(1, max / Math.max(img.width, img.height))
          const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio)
          const c = document.createElement('canvas'); c.width = w; c.height = h
          const ctx = c.getContext('2d'); if (!ctx) { resolve(null); return }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = c.toDataURL('image/jpeg', 0.85)
          resolve({ dataUrl, mime: 'image/jpeg' })
        }
        img.onerror = () => resolve(null)
        img.src = String(reader.result || '')
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const img = await fileToImage(f); if (img) setPendingImage(img)
    e.target.value = ''
  }

  // Paste — colar imagem do clipboard
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items; if (!items) return
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile(); if (!f) continue
          e.preventDefault()
          fileToImage(f).then(img => { if (img) setPendingImage(img) })
          return
        }
      }
    }
    window.addEventListener('paste', onPaste as any)
    return () => window.removeEventListener('paste', onPaste as any)
  }, [])

  async function sendImageMessage() {
    if (!pendingImage || isTyping) return
    const question = input.trim()
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: question || '(imagem)', timestamp: new Date(), imageUrl: pendingImage.dataUrl }
    setMessages(prev => [...prev, userMsg])
    setInput(''); setIsTyping(true)
    const imageBase64 = pendingImage.dataUrl.split(',')[1] || ''
    const mime = pendingImage.mime
    setPendingImage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      const res = await fetch('/api/ai-vision', {
        method: 'POST', headers,
        body: JSON.stringify({ imageBase64, mimeType: mime, question, experienceMode: (user as any)?.experience_mode || 'personal' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.text, timestamp: new Date() }])
    } catch (e: any) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Não consegui analisar a imagem. ${String(e?.message || e).slice(0, 200)}`, timestamp: new Date() }])
    } finally {
      setIsTyping(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Load personal context (skip when viewing a family profile)
  useEffect(() => {
    if (!user || isFamilyProfile || isClinicalPatient) return
    Promise.all([
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id).limit(20),
      supabase.from('search_history').select('query, type, result_severity').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([medsRes, histRes]) => {
      setPatientCtx({
        meds: medsRes.data || [],
        history: histRes.data || [],
        plan: user.plan as string,
      })
      setCtxLoaded(true)
    })
  }, [user, isFamilyProfile, supabase])

  // Load family profile context
  useEffect(() => {
    if (!user || !isFamilyProfile || !profileId) return
    Promise.all([
      supabase.from('family_profiles').select('*').eq('id', profileId).eq('user_id', user.id).single(),
      supabase.from('family_profile_meds').select('name, dose, frequency').eq('profile_id', profileId).limit(20),
    ]).then(([profileRes, medsRes]) => {
      if (!profileRes.data) return
      const fp: FamilyProfileCtx = profileRes.data
      setFamilyProfile(fp)
      setPatientCtx({
        meds: medsRes.data || [],
        history: [],
        plan: user.plan as string,
        familyProfile: fp,
      })
      setCtxLoaded(true)
    })
  }, [user, isFamilyProfile, profileId, supabase])

  // Load clinical patient context (Pro ?patient= param)
  useEffect(() => {
    if (!user || !isClinicalPatient || !patientId) return
    Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).eq('user_id', user.id).single(),
      supabase.from('patient_meds').select('name, dose, frequency, indication').eq('patient_id', patientId).eq('active', true).limit(30),
    ]).then(([patRes, medsRes]) => {
      if (!patRes.data) { setCtxLoaded(true); return }
      const pat = patRes.data
      setClinicalPatient(pat)
      // CrCl calculation
      const crCl = pat.age && pat.weight && pat.creatinine && pat.sex
        ? Math.round(((140 - pat.age) * pat.weight * (pat.sex === 'F' ? 0.85 : 1)) / (72 * pat.creatinine))
        : null
      setPatientCtx({
        meds: medsRes.data || [],
        history: [],
        plan: user.plan as string,
        clinicalPatient: { ...pat, crCl },
      })
      setCtxLoaded(true)
    })
  }, [user, isClinicalPatient, patientId, supabase])

  // Welcome message after context loads
  useEffect(() => {
    if (!ctxLoaded || !patientCtx || messages.length > 0) return

    let greeting: string
    let actions: Action[]
    let sources: string[] | undefined

    if (clinicalPatient) {
      // Clinical patient context (Pro ?patient= param from patients/[id] page)
      const pat = clinicalPatient
      const hasMeds = patientCtx.meds.length > 0
      const crClStr = pat.crCl ? ` | CrCl: **${pat.crCl} mL/min**${pat.crCl < 30 ? ' ⚠ DRC severa' : pat.crCl < 60 ? ' — ajuste renal necessário' : ''}` : ''
      
      greeting = `Co-piloto activado para **${pat.name}**${pat.age ? ` (${pat.age} anos` : ''}${pat.sex ? `, ${pat.sex}` : ''}${pat.age ? ')' : ''}.${crClStr}
      
${pat.conditions ? `**Diagnósticos:** ${pat.conditions}\n` : ''}${pat.allergies ? `**Alergias:** ${pat.allergies}\n` : ''}
${hasMeds ? `**Medicação actual:** ${patientCtx.meds.map((m: any) => m.name).join(', ')}\n\nO que analisas?` : 'Sem medicação registada. Adiciona medicamentos no perfil do doente.'}`
      
      sources = [`Doente: ${pat.name}`, 'Dados clínicos']
      actions = hasMeds ? [
        { label: 'Analisar interações', prompt: `Analisa todas as interações medicamentosas na medicação actual de ${pat.name}: ${patientCtx.meds.map((m: any) => m.name).join(', ')}. Inclui gravidade e recomendações.` },
        { label: 'Verificar doses renais', prompt: `${pat.crCl ? `Com CrCl de ${pat.crCl} mL/min, que` : 'Que'} ajustes de dose são necessários para ${pat.name} com a medicação: ${patientCtx.meds.map((m: any) => m.name).join(', ')}?` },
        { label: 'Ver perfil completo', href: `/patients/${pat.id}` },
      ] : [
        { label: 'Adicionar medicação', href: `/patients/${pat.id}` },
      ]
    } else if (familyProfile) {
      const fp = familyProfile
      const hasMeds = patientCtx.meds.length > 0
      const parts: string[] = []
      if (fp.age) parts.push(`${fp.age} anos`)
      if (fp.sex) parts.push(fp.sex === 'F' ? 'sexo feminino' : 'sexo masculino')
      if (fp.conditions) parts.push(fp.conditions)
      if (fp.allergies) parts.push(`alergias: ${fp.allergies}`)

      greeting = `A consultar o perfil de **${fp.name}**${parts.length > 0 ? ` (${parts.join(', ')})` : ''}.\n\n${hasMeds ? `Medicação registada: ${patientCtx.meds.map(m => m.name).join(', ')}.\n\n` : 'Sem medicação registada neste perfil.\n\n'}Como posso ajudar?`
      sources = [`Perfil: ${fp.name}`]
      actions = hasMeds ? [
        { label: `Analisar medicação de ${fp.name}`, prompt: `Analisa a medicação de ${fp.name} (${patientCtx.meds.map(m => m.name).join(', ')}) e diz-me se há interações, doses inadequadas para a idade ou outros problemas.` },
      ] : [
        { label: 'Adicionar medicação ao perfil', href: `/perfil/${profileId}` },
      ]
    } else {
      const hasMeds = patientCtx.meds.length > 0
      greeting = hasMeds
        ? `Olá${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Sou o teu farmacologista clínico da Phlox.\n\nVejo que tens **${patientCtx.meds.length} medicamento${patientCtx.meds.length !== 1 ? 's' : ''}** registado${patientCtx.meds.length !== 1 ? 's' : ''}: ${patientCtx.meds.slice(0, 3).map(m => m.name).join(', ')}${patientCtx.meds.length > 3 ? ` e mais ${patientCtx.meds.length - 3}` : ''}.\n\nPosso ajudar-te a verificar interações, esclarecer dúvidas farmacológicas, ou analisar a tua medicação completa. O que precisas?`
        : `Olá${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Sou o teu farmacologista clínico da Phlox.\n\nAinda não tens medicamentos registados no teu perfil. Podes adicioná-los no [Dashboard](/dashboard?tab=meds) para que eu possa analisar a tua medicação completa.\n\nMas podes também fazer-me perguntas directamente — sobre qualquer medicamento, interação, ou dúvida clínica.`
      sources = hasMeds ? ['Perfil do utilizador'] : undefined
      actions = hasMeds ? [
        { label: 'Analisar toda a minha medicação', prompt: `Analisa todos os meus medicamentos (${patientCtx.meds.map(m => m.name).join(', ')}) e diz-me se há interações, redundâncias ou problemas que devo saber.` },
      ] : [
        { label: 'Adicionar medicamentos', href: '/dashboard?tab=meds' },
      ]
    }

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
      sources,
      actions,
    }])
  }, [ctxLoaded, patientCtx, familyProfile, user, messages.length, profileId])

  // Auto-send ?q= param after welcome message appears
  useEffect(() => {
    if (!initialQuery || initialQuerySent.current || messages.length !== 1) return
    initialQuerySent.current = true
    const timer = setTimeout(() => sendMessage(initialQuery), 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, initialQuery])

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || isTyping) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }

      // 2026-06-01: contexto pessoal é opt-in. Antes assumia sempre que o
      // utilizador queria falar da sua medicação, mas o pedido "tirar dúvida
      // de saúde" pode ser sobre qualquer tema.
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          patientContext: includeContext ? patientCtx : null,
          experienceMode: (user as any)?.experience_mode || 'personal',
        }),
      })

      const data = await res.json()
      if (res.status === 429 || data.limit_reached) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Chegaste ao limite de perguntas grátis de hoje. Com o **Pro** (12,99€/mês) o Phlox AI é ilimitado e conhece a tua medicação — vê em [/pricing](/pricing). O limite renova à meia-noite.',
          timestamp: new Date(),
        }])
        setIsTyping(false)
        return
      }
      if (!res.ok) throw new Error(data.error)

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        thinking: data.thinking,
        sources: data.sources,
        actions: data.actions,
      }])

      if (user && !familyProfile) {
        supabase.from('search_history').insert({
          user_id: user.id,
          type: 'interaction',
          query: text.slice(0, 200),
          result_severity: null,
          result_source: 'ai-chat',
        }).then(() => {})
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro. Tenta novamente.',
        timestamp: new Date(),
      }])
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }, [input, isTyping, messages, patientCtx, user, familyProfile, supabase])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestionsToShow = familyProfile
    ? FAMILY_PROMPTS
    : isClinicalPatient
    ? PRO_PROMPTS
    : (() => {
        const mode = (user as any)?.experience_mode || 'personal'
        if (mode === 'clinical') return isPro ? [...CLINICAL_PROMPTS.slice(0, 4), ...PRO_PROMPTS.slice(0, 2)] : CLINICAL_PROMPTS
        if (mode === 'student') return STUDENT_PROMPTS
        if (mode === 'caregiver') return CAREGIVER_PROMPTS
        return isPro ? [...SUGGESTED_PROMPTS.slice(0, 4), ...PRO_PROMPTS.slice(0, 2)] : SUGGESTED_PROMPTS
      })()

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>


      {/* Toda a gente entra. O plano Base tem 3 perguntas/dia (limite imposto no
          servidor); Plus/Pro são ilimitados. Antes havia um paywall total aqui,
          o que contradizia o "free_limited" do registry. */}
      {false ? (
        <UpgradeGate />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 880, width: '100%', margin: '0 auto', padding: '0 22px' }}>

          {/* Top bar — refined */}
          <div className="ai-topbar" style={{ padding: '20px 0 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div className="ai-mark" style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgba(13,110,66,0.25)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: 'var(--ink)', letterSpacing: '-0.015em', fontWeight: 400, lineHeight: 1 }}>Phlox AI</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 10.5, fontWeight: 700, color: '#15803d', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} /> ONLINE
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>
                    {familyProfile
                      ? <>Perfil familiar · <strong style={{ color: 'var(--ink-3)' }}>{patientCtx?.meds.length || 0}</strong> medicamentos</>
                      : <>Farmacologista clínico · <strong style={{ color: 'var(--ink-3)' }}>{patientCtx?.meds.length || 0}</strong> medicamentos no perfil</>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={newChat}
                  style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  + Nova conversa
                </button>
                <button onClick={() => setShowHistory(s => !s)}
                  style={{ background: showHistory ? 'var(--ink)' : 'white', color: showHistory ? 'white' : 'var(--ink-3)', border: `1px solid ${showHistory ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  💬 Histórico ({savedChats.length})
                </button>
                {/* Toggle de contexto pessoal */}
                <button onClick={() => setIncludeContext(c => !c)} title={includeContext ? 'A AI conhece a tua medicação e perfil' : 'Modo anónimo: não enviar contexto pessoal'}
                  style={{ background: includeContext ? '#f0fdf4' : 'white', color: includeContext ? '#0d6e42' : 'var(--ink-3)', border: `1px solid ${includeContext ? '#bbf7d0' : 'var(--border)'}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {includeContext ? '✓ Com o meu Phlox' : '◻ Anónimo'}
                </button>
                {familyProfile ? (
                  <Link href={`/perfil/${profileId}`}
                    style={{ background: 'white', border: '1px solid #ddd6fe', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#6d28d9', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
                    Ver perfil
                  </Link>
                ) : (
                  <Link href="/dashboard?tab=meds"
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#0d6e42', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
                    Editar medicação
                  </Link>
                )}
                {familyProfile && (
                  <Link href="/ai"
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-sans)' }}>
                    Meu perfil
                  </Link>
                )}
              </div>
            </div>
            {familyProfile && (
              <div style={{ marginTop: 12, padding: '8px 14px', background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)', border: '1px solid #e9d5ff', borderRadius: 9, fontSize: 12.5, color: '#6d28d9', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                A conversar sobre <strong style={{ marginLeft: 3 }}>{familyProfile.name}</strong>
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0 12px', minHeight: 0 }}>
            {messages.length === 0 && ctxLoaded && (
              <div style={{ padding: '32px 0 16px', textAlign: 'center' }}>
                {/* Hero */}
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 18, background: 'radial-gradient(circle at 30% 30%, #16a34a 0%, #0d6e42 100%)', marginBottom: 18, boxShadow: '0 12px 30px rgba(13,110,66,0.25)', position: 'relative' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
                  <div style={{ position: 'absolute', inset: -6, borderRadius: 22, border: '1px solid #bbf7d0', opacity: 0.6, pointerEvents: 'none' }} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Como posso ajudar?</h2>
                <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '0 0 24px', lineHeight: 1.55 }}>
                  Pergunta sobre a tua medicação, sintomas ou um caso clínico. Tenho contexto do teu perfil.
                </p>
                <div className="ai-empty-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: 9, textAlign: 'left', maxWidth: 620, margin: '0 auto' }}>
                  {suggestionsToShow.map(p => (
                    <button key={p} onClick={() => sendMessage(p)} className="ai-suggest"
                      style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, fontFamily: 'var(--font-sans)', display: 'flex', gap: 10, alignItems: 'flex-start', transition: 'all 0.15s ease' }}>
                      <span style={{ color: '#0d6e42', flexShrink: 0, marginTop: 1, fontWeight: 800 }}>→</span>
                      <span style={{ minWidth: 0 }}>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showHistory && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Conversas anteriores</div>
                  <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16 }}>×</button>
                </div>
                {savedChats.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: 12 }}>Sem conversas guardadas ainda.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {savedChats.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: c.id === chatId ? 'var(--bg-2)' : 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <button onClick={() => openSavedChat(c.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', minWidth: 0, padding: 0, fontFamily: 'var(--font-sans)' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{c.count} msg · {new Date(c.updated).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        </button>
                        <button onClick={() => deleteSavedChat(c.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 14, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {messages.length > 0 && messages[messages.length - 1].actions?.map(action =>
              action.prompt ? (
                <div key={action.label} style={{ paddingLeft: 42, marginTop: -12, marginBottom: 16 }}>
                  <button onClick={() => sendMessage(action.prompt!)}
                    style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green-2)', border: '1px solid var(--green-mid)', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                    {action.label} →
                  </button>
                </div>
              ) : null
            )}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input — refined */}
          <div style={{ padding: '14px 0 22px', borderTop: '1px solid var(--border)' }}>
            {messages.length > 0 && messages.length < 4 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {(familyProfile
                  ? ['Há contra-indicações com a idade?', 'Quais os efeitos adversos a vigiar?', 'Precisa de ajuste de dose?', 'É seguro tomar tudo junto?']
                  : ['Posso tomar com álcool?', 'Quais os efeitos adversos?', 'É seguro na gravidez?', 'Qual a dose correcta?']
                ).map(s => (
                  <button key={s} onClick={() => sendMessage(s)} className="ai-chip"
                    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 13px', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s ease' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Preview da imagem anexada */}
            {pendingImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.dataUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid white' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>Imagem pronta a enviar</div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>Escreve uma pergunta opcional (ex: "que medicamento é?") e carrega em ↑</div>
                </div>
                <button onClick={() => setPendingImage(null)} aria-label="Remover" style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: 7, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: '#15803d', cursor: 'pointer' }}>Remover</button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFilePick} style={{ display: 'none' }} />

            <div className="ai-input-card" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 0 rgba(8,12,24,0.02), 0 8px 24px -16px rgba(8,12,24,0.12)', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (pendingImage) sendImageMessage()
                    else if (input.trim() && !isTyping) sendMessage()
                  }
                }}
                placeholder={pendingImage ? 'Pergunta sobre a imagem (opcional)…' : familyProfile ? `Pergunta sobre ${familyProfile.name}…` : 'Pergunta — ou cola/anexa uma foto…'}
                rows={1}
                style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'transparent', lineHeight: 1.55, maxHeight: 160, overflow: 'auto', padding: '4px 0' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Anexar imagem"
                title="Anexar foto (ou colar com Ctrl+V)"
                style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <MicButton onTranscript={(t) => { setInput(prev => (prev ? prev + ' ' : '') + t); setTimeout(() => inputRef.current?.focus(), 10) }} />
              <button
                onClick={() => pendingImage ? sendImageMessage() : sendMessage()}
                disabled={(!pendingImage && !input.trim()) || isTyping}
                aria-label="Enviar"
                style={{ background: ((pendingImage || input.trim()) && !isTyping) ? 'linear-gradient(135deg, #16a34a 0%, #0d6e42 100%)' : 'var(--bg-3)', color: ((pendingImage || input.trim()) && !isTyping) ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, width: 38, height: 38, cursor: ((pendingImage || input.trim()) && !isTyping) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.1s ease, box-shadow 0.15s', boxShadow: ((pendingImage || input.trim()) && !isTyping) ? '0 4px 12px rgba(13,110,66,0.3)' : 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 9, padding: '0 4px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                <kbd style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> enviar · <kbd style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Shift+Enter</kbd> nova linha
              </div>
              {input.length > 80 && (
                <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: input.length > 900 ? '#dc2626' : 'var(--ink-5)' }}>
                  {input.length}/1000
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes typingBounce { 0%,80%,100%{transform:translateY(0); opacity:0.5} 40%{transform:translateY(-4px); opacity:1} }
        .ai-input-card:focus-within { border-color: #0d6e42; box-shadow: 0 0 0 4px rgba(13,110,66,0.08), 0 8px 24px -16px rgba(13,110,66,0.18); }
        .ai-suggest:hover { border-color: #0d6e42; background: #f8fdfb; transform: translateY(-1px); }
        .ai-chip:hover { border-color: #0d6e42; color: #0d6e42; }
      `}</style>
    </div>
  )
}

// ─── Page export (Suspense required for useSearchParams) ─────────────────────

export default function AIPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    }>
      <AIChat />
    </Suspense>
  )
}