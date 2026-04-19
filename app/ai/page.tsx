'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant' | 'system'

interface Message {
  id: string
  role: Role
  content: string
  timestamp: Date
  thinking?: string       // raciocínio visível
  sources?: string[]      // fontes consultadas
  actions?: Action[]      // acções sugeridas
}

interface Action {
  label: string
  href?: string
  prompt?: string         // enviar automaticamente como próxima mensagem
}

interface PatientContext {
  meds: { name: string; dose?: string; frequency?: string }[]
  history: { query: string; type: string; result_severity?: string }[]
  plan: string
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

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ plan }: { plan: string }) {
  const isLoggedIn = plan !== 'free' || plan === 'free' // always show if not logged in

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-light)', border: '2px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>
          🧠
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Phlox AI — Farmacologista Clínico
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 8 }}>
          O teu farmacologista clínico pessoal. Conhece os teus medicamentos, faz as perguntas certas, e dá respostas clínicas reais — com raciocínio transparente e fontes verificadas.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
          Disponível no plano Student (3,99€/mês).
        </p>

        {/* Feature preview */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 28, textAlign: 'left' }}>
          {[
            { icon: '💬', text: 'Chat conversacional com memória do teu doente' },
            { icon: '🔍', text: 'Raciocínio clínico transparente — vês como pensa' },
            { icon: '💊', text: 'Integrado com os teus medicamentos pessoais' },
            { icon: '📚', text: 'Consulta RxNorm, FDA e guidelines em tempo real' },
            { icon: '🏥', text: 'Respostas ao nível de um farmacologista clínico' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
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
  const isUser = msg.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ maxWidth: '75%', background: 'var(--green)', borderRadius: '16px 16px 4px 16px', padding: '12px 16px' }}>
          <p style={{ fontSize: 14, color: 'white', lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
        ⚕
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Thinking toggle */}
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

        {/* Main response */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px 16px 16px 16px', padding: '14px 16px' }}>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {msg.content}
          </div>
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {msg.sources.map(s => (
              <span key={s} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 7px' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {msg.actions && msg.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {msg.actions.map(action => (
              action.href ? (
                <Link key={action.label} href={action.href}
                  style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green-2)', textDecoration: 'none', border: '1px solid var(--green-mid)', borderRadius: 4, padding: '5px 12px', fontWeight: 600 }}>
                  {action.label} →
                </Link>
              ) : null
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
          {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>⚕</div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px 16px 16px 16px', padding: '14px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AIPage() {
  const { user, supabase } = useAuth()
  const plan = user?.plan || 'free'
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'
  const isPro = plan === 'pro' || plan === 'clinic'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [patientCtx, setPatientCtx] = useState<PatientContext | null>(null)
  const [ctxLoaded, setCtxLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Load patient context
  useEffect(() => {
    if (!user || !isStudent) return
    Promise.all([
      supabase.from('personal_meds').select('name, dose, frequency').eq('user_id', user.id).limit(20),
      supabase.from('search_history').select('query, type, result_severity').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([medsRes, histRes]) => {
      setPatientCtx({
        meds: medsRes.data || [],
        history: histRes.data || [],
        plan: user.plan,
      })
      setCtxLoaded(true)
    })
  }, [user, isStudent, supabase])

  // Welcome message after context loads
  useEffect(() => {
    if (!ctxLoaded || !patientCtx || messages.length > 0) return

    const hasMeds = patientCtx.meds.length > 0
    const greeting = hasMeds
      ? `Olá${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Sou o teu farmacologista clínico da Phlox.\n\nVejo que tens **${patientCtx.meds.length} medicamento${patientCtx.meds.length !== 1 ? 's' : ''}** registado${patientCtx.meds.length !== 1 ? 's' : ''}: ${patientCtx.meds.slice(0, 3).map(m => m.name).join(', ')}${patientCtx.meds.length > 3 ? ` e mais ${patientCtx.meds.length - 3}` : ''}.\n\nPosso ajudar-te a verificar interações, esclarecer dúvidas farmacológicas, ou analisar a tua medicação completa. O que precisas?`
      : `Olá${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! Sou o teu farmacologista clínico da Phlox.\n\nAinda não tens medicamentos registados no teu perfil. Podes adicioná-los no [Dashboard](/dashboard?tab=meds) para que eu possa analisar a tua medicação completa.\n\nMas podes também fazer-me perguntas directamente — sobre qualquer medicamento, interação, ou dúvida clínica.`

    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
      sources: hasMeds ? ['Perfil do utilizador'] : undefined,
      actions: hasMeds ? [
        { label: 'Analisar toda a minha medicação', prompt: `Analisa todos os meus medicamentos (${patientCtx.meds.map(m => m.name).join(', ')}) e diz-me se há interações, redundâncias ou problemas que devo saber.` },
      ] : [
        { label: 'Adicionar medicamentos', href: '/dashboard?tab=meds' },
      ],
    }])
  }, [ctxLoaded, patientCtx, user, messages.length])

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
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          patientContext: patientCtx,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        thinking: data.thinking,
        sources: data.sources,
        actions: data.actions,
      }

      setMessages(prev => [...prev, assistantMsg])

      // Save to history
      if (user) {
        supabase.from('search_history').insert({
          user_id: user.id,
          type: 'interaction',
          query: text.slice(0, 200),
          result_severity: null,
          result_source: 'ai-chat',
        }).then(() => {})
      }
    } catch (e: any) {
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
  }, [input, isTyping, messages, patientCtx, user, supabase])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />

      {!isStudent ? (
        <UpgradeGate plan={plan} />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 20px' }}>

          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Phlox AI</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Farmacologista clínico · {patientCtx?.meds.length || 0} medicamentos no perfil</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {messages.length > 1 && (
                <button onClick={() => setMessages([])}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 10px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  Nova conversa
                </button>
              )}
              <Link href="/dashboard?tab=meds"
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 10px', fontSize: 11, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>
                Editar medicamentos
              </Link>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', minHeight: 0 }}>
            {messages.length === 0 && ctxLoaded && (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚕️</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', marginBottom: 20 }}>Como posso ajudar?</div>
                <div className="card-grid-2" style={{ gap: 8, textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
                  {(isPro ? [...SUGGESTED_PROMPTS.slice(0,4), ...PRO_PROMPTS.slice(0,2)] : SUGGESTED_PROMPTS).map(p => (
                    <button key={p} onClick={() => sendMessage(p)}
                      style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4, fontFamily: 'var(--font-sans)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {/* Action prompts inside messages */}
            {messages.length > 0 && messages[messages.length-1].actions?.map(action =>
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

          {/* Input */}
          <div style={{ padding: '16px 0 20px', borderTop: '1px solid var(--border)' }}>
            {/* Quick suggestions while chatting */}
            {messages.length > 0 && messages.length < 4 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {['Posso tomar com álcool?', 'Quais os efeitos adversos?', 'É seguro na gravidez?', 'Qual a dose correcta?'].map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'white', border: '1px solid var(--border-2)', borderRadius: 12, padding: '10px 14px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunta ao teu farmacologista clínico..."
                rows={1}
                style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'transparent', lineHeight: 1.5, maxHeight: 120, overflow: 'auto' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                style={{ background: input.trim() && !isTyping ? 'var(--green)' : 'var(--bg-3)', color: input.trim() && !isTyping ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                ↑
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 8, textAlign: 'center' }}>
              Enter para enviar · Shift+Enter para nova linha · Informação educacional — não substitui consulta médica
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}