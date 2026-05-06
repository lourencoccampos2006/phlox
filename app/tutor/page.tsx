'use client'

// ─── NOVO: app/tutor/page.tsx ───
// Phlox AI Tutor — experiência de tutoria socrática completamente diferente do chat.
// A AI não responde directamente. Conduz o estudante num diálogo estruturado:
// 1. Activa conhecimento prévio com perguntas abertas
// 2. Vai revelando conceitos progressivamente
// 3. Corrije erros de forma construtiva
// 4. Avalia o raciocínio e dá score no final
// É diferente do /ai — não é um chatbot, é um tutor.

import { useState, useRef, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

interface TutorMessage {
  role: 'tutor' | 'student'
  content: string
  type?: 'question' | 'feedback_good' | 'feedback_correct' | 'hint' | 'explanation' | 'summary'
  score?: number
}

interface TutorSession {
  topic: string
  domain: string
  messages: TutorMessage[]
  phase: 'intro' | 'exploration' | 'deepening' | 'consolidation' | 'complete'
  exchangeCount: number
  totalScore: number
  maxScore: number
}

const DOMAINS_SIMPLE = [
  { id: 'farmacologia', label: 'Farmacologia', icon: '💊', color: '#0d6e42' },
  { id: 'medicina_interna', label: 'Medicina Interna', icon: '🫀', color: '#dc2626' },
  { id: 'emergencia', label: 'Emergência', icon: '🚨', color: '#b45309' },
  { id: 'cirurgia', label: 'Cirurgia', icon: '🔪', color: '#1d4ed8' },
  { id: 'pediatria', label: 'Pediatria', icon: '👶', color: '#7c3aed' },
  { id: 'gineco_obstetricia', label: 'Gineco-Obstetrícia', icon: '🤰', color: '#be185d' },
  { id: 'anatomia_fisiologia', label: 'Anatomia e Fisiologia', icon: '🫁', color: '#0891b2' },
  { id: 'semiologia', label: 'Semiologia', icon: '🩺', color: '#374151' },
  { id: 'enfermagem', label: 'Enfermagem', icon: '💉', color: '#0f766e' },
  { id: 'nutricao', label: 'Nutrição', icon: '🥗', color: '#65a30d' },
]

const SUGGESTED_TOPICS: Record<string, string[]> = {
  farmacologia: ['Mecanismo dos beta-bloqueadores', 'Interações da varfarina', 'Farmacocinética dos aminoglicosídeos'],
  medicina_interna: ['Diagnóstico diferencial da dispneia', 'Abordagem da insuficiência cardíaca', 'Gestão da DRC'],
  emergencia: ['Algoritmo ACLS para FV', 'Abordagem do choque séptico', 'Protocolo de AVC'],
  cirurgia: ['Avaliação pré-operatória', 'Diagnóstico diferencial de dor abdominal aguda'],
  pediatria: ['Febre na criança < 3 meses', 'Abordagem da criança com convulsão'],
  gineco_obstetricia: ['Pré-eclâmpsia — diagnóstico e gestão', 'Contracepção hormonal'],
  anatomia_fisiologia: ['Ciclo cardíaco e pressões', 'Regulação do pH — tampões'],
  semiologia: ['Auscultação cardíaca — sopros', 'Exame neurológico básico'],
  enfermagem: ['Administração de heparina SC', 'Prevenção de úlceras de pressão'],
  nutricao: ['Nutrição entérica vs parentérica', 'Dieta na DRC'],
}

const MSG_STYLE: Record<NonNullable<TutorMessage['type']>, { bg: string; border: string; icon: string }> = {
  question:         { bg: '#eff6ff', border: '#bfdbfe', icon: '❓' },
  feedback_good:    { bg: '#d1fae5', border: '#6ee7b7', icon: '✅' },
  feedback_correct: { bg: '#fef9c3', border: '#fde68a', icon: '💡' },
  hint:             { bg: '#faf5ff', border: '#e9d5ff', icon: '🔍' },
  explanation:      { bg: 'white',   border: 'var(--border)', icon: '📖' },
  summary:          { bg: '#0f172a', border: '#1e293b', icon: '🏆' },
}

export default function TutorPage() {
  const { user, supabase } = useAuth()
  const [session, setSession] = useState<TutorSession | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS_SIMPLE[0])
  const [topic, setTopic] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  const startSession = async () => {
    const t = topic.trim()
    if (!t) return
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ action: 'start', topic: t, domain: selectedDomain.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSession({
        topic: t, domain: selectedDomain.id,
        messages: [{ role: 'tutor', content: data.message, type: 'question' }],
        phase: 'intro', exchangeCount: 0, totalScore: 0, maxScore: 100,
      })
    } catch (e: any) { alert(e.message) }
    finally { setLoading(false) }
  }

  const sendMessage = async () => {
    if (!input.trim() || !session || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    const newSession = {
      ...session,
      messages: [...session.messages, { role: 'student' as const, content: userMsg }],
      exchangeCount: session.exchangeCount + 1,
    }
    setSession(newSession)

    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          action: 'respond',
          topic: session.topic,
          domain: session.domain,
          exchangeCount: newSession.exchangeCount,
          messages: newSession.messages.map(m => ({ role: m.role, content: m.content })),
          studentAnswer: userMsg,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const tutorMsg: TutorMessage = {
        role: 'tutor',
        content: data.message,
        type: data.type || 'question',
        score: data.score,
      }

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tutorMsg],
        phase: data.phase || prev.phase,
        totalScore: prev.totalScore + (data.score || 0),
        maxScore: prev.maxScore,
      } : null)

      // Save session to Supabase if complete
      if (data.phase === 'complete' && user) {
        try {
          await supabase.from('study_sessions').insert({
            user_id: user.id, type: 'case', drug_class: session.topic,
            xp_earned: Math.round(((session.totalScore + (data.score||0)) / session.maxScore) * 30) + 5,
            metadata: { topic: session.topic, domain: session.domain, exchanges: newSession.exchangeCount },
          })
        } catch {}
      }
    } catch (e: any) {
      setSession(prev => prev ? { ...prev, messages: [...prev.messages, { role: 'tutor', content: 'Erro de ligação. Tenta novamente.', type: 'explanation' }] } : null)
    } finally { setLoading(false) }
  }

  const domain = DOMAINS_SIMPLE.find(d => d.id === session?.domain) || selectedDomain

  if (!isStudent) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🧑‍🏫</div>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', marginBottom:12 }}>Phlox AI Tutor</div>
          <p style={{ fontSize:14, color:'var(--ink-4)', lineHeight:1.7, marginBottom:24, maxWidth:400, margin:'0 auto 24px' }}>
            Tutoria socrática em qualquer área das ciências da saúde. A AI não te dá as respostas — guia o teu raciocínio, corrige erros, e avalia o teu conhecimento. Exclusivo Student.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'#7c3aed', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius:8, fontSize:14, fontWeight:700 }}>
            Ver plano Student →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)', display:'flex', flexDirection:'column' }}>
      <Header />

      {!session ? (
        /* ── Setup ── */
        <div className="page-container page-body" style={{ maxWidth:680, margin:'0 auto', flex:1 }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'#7c3aed', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:10, height:2, background:'#7c3aed', borderRadius:1 }} />Phlox AI Tutor · Student
            </div>
            <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,30px)', color:'var(--ink)', fontWeight:400, marginBottom:10 }}>Tutoria Socrática</h1>
            <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.7, maxWidth:500 }}>
              Diferente do chat normal: o tutor não te dá as respostas directamente. Faz perguntas, activa o teu raciocínio, e guia-te até à compreensão real. Mais difícil. Mais eficaz.
            </p>
          </div>

          {/* How it works */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%,200px),1fr))', gap:8, marginBottom:24 }}>
            {[
              { step:'1', title:'Activa', desc:'O tutor começa com o que já sabes sobre o tema', icon:'💭' },
              { step:'2', title:'Explora', desc:'Vai fazendo perguntas para construir o conceito', icon:'🔍' },
              { step:'3', title:'Aprofunda', desc:'Aplica a clínica difícil e os casos excepcionais', icon:'🧠' },
              { step:'4', title:'Consolida', desc:'Resume e avalia o teu raciocínio com score final', icon:'🏆' },
            ].map(s => (
              <div key={s.step} style={{ padding:'14px', background:'white', border:'1px solid var(--border)', borderRadius:10, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'#7c3aed', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
                  Fase {s.step} — {s.title}
                </div>
                <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Domain selector */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Área de estudo</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DOMAINS_SIMPLE.map(d => (
                <button key={d.id} onClick={() => setSelectedDomain(d)}
                  style={{ padding:'7px 14px', border:`1.5px solid ${selectedDomain.id===d.id?d.color:'var(--border)'}`, borderRadius:20, background:selectedDomain.id===d.id?d.color:'white', color:selectedDomain.id===d.id?'white':'var(--ink-3)', cursor:'pointer', fontSize:12, fontWeight:selectedDomain.id===d.id?700:400, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
                  <span>{d.icon}</span>{d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic input */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Tema a estudar</div>
            <div style={{ background:'white', border:`2px solid ${selectedDomain.color}40`, borderRadius:12, overflow:'hidden', transition:'border-color 0.15s' }}>
              <div style={{ display:'flex', padding:'4px 4px 4px 16px', gap:8 }}>
                <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key==='Enter' && startSession()}
                  placeholder={`Ex: ${SUGGESTED_TOPICS[selectedDomain.id]?.[0] || 'Escreve um tema...'}`}
                  style={{ flex:1, border:'none', outline:'none', fontSize:15, fontFamily:'var(--font-sans)', color:'var(--ink)', background:'transparent', padding:'12px 0' }} />
                <button onClick={startSession} disabled={!topic.trim() || loading}
                  style={{ background:topic.trim()?selectedDomain.color:'var(--bg-3)', color:topic.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, padding:'11px 20px', fontSize:13, fontWeight:700, cursor:topic.trim()?'pointer':'not-allowed', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                  {loading ? 'A iniciar...' : 'Começar sessão →'}
                </button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {SUGGESTED_TOPICS[selectedDomain.id] && (
            <div>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Sugestões para {selectedDomain.label}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {SUGGESTED_TOPICS[selectedDomain.id].map(s => (
                  <button key={s} onClick={() => { setTopic(s) }}
                    style={{ padding:'6px 12px', border:`1px solid ${selectedDomain.color}40`, borderRadius:20, background:`${selectedDomain.color}10`, cursor:'pointer', fontSize:12, color:selectedDomain.color, fontFamily:'var(--font-sans)', fontWeight:500 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Session ── */
        <div style={{ flex:1, display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 60px)' }}>
          {/* Session header */}
          <div style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'12px 0', flexShrink:0 }}>
            <div className="page-container" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <button onClick={() => setSession(null)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--ink-4)', fontFamily:'var(--font-sans)', padding:0, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                ← Nova sessão
              </button>
              <div style={{ width:1, height:16, background:'var(--border)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                <span style={{ fontSize:16 }}>{domain.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.topic}</div>
                  <div style={{ fontSize:10, color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>{domain.label} · {session.exchangeCount} trocas</div>
                </div>
              </div>
              {/* Phase indicator */}
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {(['intro','exploration','deepening','consolidation','complete'] as const).map((p, i) => (
                  <div key={p} style={{ width:8, height:8, borderRadius:'50%', background: (['intro','exploration','deepening','consolidation','complete'] as const).indexOf(session.phase) >= i ? domain.color : 'var(--bg-3)', transition:'background 0.3s' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'20px 0' }}>
            <div className="page-container" style={{ maxWidth:720, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
              {session.messages.map((msg, i) => {
                if (msg.role === 'student') return (
                  <div key={i} style={{ display:'flex', justifyContent:'flex-end' }}>
                    <div style={{ maxWidth:'75%', padding:'12px 16px', background:domain.color, color:'white', borderRadius:'12px 12px 4px 12px', fontSize:14, lineHeight:1.6 }}>
                      {msg.content}
                    </div>
                  </div>
                )
                const style = msg.type ? MSG_STYLE[msg.type] : MSG_STYLE.explanation
                return (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:domain.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {domain.icon}
                    </div>
                    <div style={{ maxWidth:'80%', padding:'14px 16px', background:style.bg, border:`1px solid ${style.border}`, borderRadius:'4px 12px 12px 12px' }}>
                      {msg.score !== undefined && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', fontWeight:700, color:domain.color, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                            +{msg.score} pontos
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize:14, lineHeight:1.7, color:msg.type==='summary'?'#f8fafc':'var(--ink)', whiteSpace:'pre-wrap' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:domain.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                    {domain.icon}
                  </div>
                  <div style={{ padding:'14px 18px', background:'white', border:'1px solid var(--border)', borderRadius:'4px 12px 12px 12px', display:'flex', gap:6 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:'var(--ink-4)', animation:`bounce 0.9s ease ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          {session.phase !== 'complete' && (
            <div style={{ background:'white', borderTop:'1px solid var(--border)', padding:'12px 0', flexShrink:0 }}>
              <div className="page-container" style={{ maxWidth:720, margin:'0 auto' }}>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendMessage()}
                    placeholder="A tua resposta..."
                    disabled={loading}
                    style={{ flex:1, border:'1.5px solid var(--border)', borderRadius:10, padding:'12px 16px', fontSize:14, fontFamily:'var(--font-sans)', outline:'none', resize:'none' }} />
                  <button onClick={sendMessage} disabled={!input.trim() || loading}
                    style={{ padding:'12px 20px', background:input.trim()?domain.color:'var(--bg-3)', color:input.trim()?'white':'var(--ink-5)', border:'none', borderRadius:10, cursor:input.trim()?'pointer':'not-allowed', fontSize:14, fontWeight:700, fontFamily:'var(--font-sans)', transition:'all 0.15s', flexShrink:0 }}>
                    Responder
                  </button>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginTop:6, textAlign:'center' }}>
                  Enter para enviar · O tutor guia o teu raciocínio — não esperes respostas directas
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  )
}