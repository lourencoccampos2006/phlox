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
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { logStudy } from '@/lib/studyProgress'
import { usePhloxContext } from '@/lib/copilotContext'
import ExplicarMnemonica from '@/components/tutor/ExplicarMnemonica'
import SimulacaoExame from '@/components/tutor/SimulacaoExame'
import FichaFarmaco from '@/components/tutor/FichaFarmaco'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

type TutorMode = 'socratico' | 'explicar' | 'exame' | 'ficha'
const MODES: { id: TutorMode; label: string; icon: string }[] = [
  { id: 'socratico', label: 'Tutoria socrática', icon: '🧑‍🏫' },
  { id: 'explicar', label: 'Explicar & Mnemónica', icon: '✨' },
  { id: 'exame', label: 'Simulação de exame', icon: 'trophy' },
  { id: 'ficha', label: 'Ficha de Fármaco', icon: 'spark' },
]

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
  { id: 'farmacologia', label: 'Farmacologia', icon: 'pill', color: 'var(--green)' },
  { id: 'medicina_interna', label: 'Medicina Interna', icon: 'heart', color: 'var(--red)' },
  { id: 'emergencia', label: 'Emergência', icon: 'alert', color: 'var(--amber)' },
  { id: 'cirurgia', label: 'Cirurgia', icon: 'grid', color: 'var(--ink-2)' },
  { id: 'pediatria', label: 'Pediatria', icon: 'family', color: 'var(--roxo)' },
  { id: 'gineco_obstetricia', label: 'Gineco-Obstetrícia', icon: 'family', color: 'var(--red)' },
  { id: 'anatomia_fisiologia', label: 'Anatomia e Fisiologia', icon: 'heart', color: 'var(--green)' },
  { id: 'semiologia', label: 'Semiologia', icon: 'stethoscope', color: 'var(--ink-3)' },
  { id: 'enfermagem', label: 'Enfermagem', icon: 'pill', color: 'var(--green-3)' },
  { id: 'nutricao', label: 'Nutrição', icon: 'meal', color: 'var(--green)' },
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

// Sessão em curso sobrevive a sair da página — antes, sair a meio de uma
// tutoria perdia todo o diálogo (só gravava em study_sessions no fim).
const TUTOR_SESSION_KEY = 'phlox-tutor-session'

const MSG_STYLE: Record<NonNullable<TutorMessage['type']>, { bg: string; border: string; icon: string }> = {
  question:         { bg: 'var(--bg-2)', border: 'var(--border)', icon: 'question' },
  feedback_good:    { bg: 'var(--badge-green-bg)', border: 'var(--green-mid)', icon: 'check' },
  feedback_correct: { bg: 'var(--amber-light)', border: 'var(--badge-amber-border)', icon: 'spark' },
  hint:             { bg: 'var(--roxo-claro)', border: 'var(--roxo-borda)', icon: 'search' },
  explanation:      { bg: 'white',   border: 'var(--border)', icon: 'book' },
  summary:          { bg: 'var(--ink)', border: 'var(--ink-2)', icon: 'trophy' },
}

export default function TutorPage() {
  const { user, supabase } = useAuth()
  const [mode, setMode] = useState<TutorMode>('socratico')
  const [initialDrug, setInitialDrug] = useState<string | undefined>(undefined)
  const [session, setSession] = useState<TutorSession | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS_SIMPLE[0])
  const [topic, setTopic] = useState('')
  const [resumable, setResumable] = useState<TutorSession | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Deep-link a partir de outras ferramentas: ?mode=ficha&drug=... ou ?mode=exame
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const m = params.get('mode') as TutorMode | null
    if (m && MODES.some(x => x.id === m)) setMode(m)
    const drug = params.get('drug')
    if (drug) setInitialDrug(drug)
  }, [])

  // Ao chegar, há uma tutoria por acabar? Convida a retomar em vez de aplicar
  // em silêncio (pode já não fazer sentido continuar de onde ficou).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TUTOR_SESSION_KEY)
      if (!raw) return
      const s: TutorSession = JSON.parse(raw)
      if (s.phase !== 'complete' && s.messages?.length) setResumable(s)
      else localStorage.removeItem(TUTOR_SESSION_KEY)
    } catch { localStorage.removeItem(TUTOR_SESSION_KEY) }
  }, [])

  // Guarda a sessão em curso a cada troca (não quando completa: já foi gravada
  // em study_sessions e não há nada por retomar).
  useEffect(() => {
    if (!session || session.phase === 'complete') return
    try { localStorage.setItem(TUTOR_SESSION_KEY, JSON.stringify(session)) } catch {}
  }, [session])

  function resumeSession() { if (resumable) { setSession(resumable); setResumable(null) } }
  function discardResumable() { try { localStorage.removeItem(TUTOR_SESSION_KEY) } catch {}; setResumable(null) }

  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  // Contexto p/ o Copilot: o tópico em estudo + a última troca do tutor.
  usePhloxContext(
    session ? `Tutoria: ${session.topic}` : '',
    session ? { topico: session.topic, ultima_pergunta: session.messages.filter(m => m.role === 'tutor').slice(-1)[0]?.content?.slice(0, 300) } : null as any
  )

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
      logStudy({ kind: 'tutor', area: (selectedDomain as any).label || selectedDomain.id })
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
        try { localStorage.removeItem(TUTOR_SESSION_KEY) } catch {}
      }
    } catch (e: any) {
      setSession(prev => prev ? { ...prev, messages: [...prev.messages, { role: 'tutor', content: 'Erro de ligação. Tenta novamente.', type: 'explanation' }] } : null)
    } finally { setLoading(false) }
  }

  const domain = DOMAINS_SIMPLE.find(d => d.id === session?.domain) || selectedDomain

  if (!isStudent) return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Tutor</span>
        </BarraDeTrabalho>
      }
    >

      <div className="page-container page-body" style={{ maxWidth:520, margin:'0 auto' }}>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius: 'var(--r-xl)', padding:'48px 28px', textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize: 'var(--t-numero)', color:'var(--ink)', marginBottom:12 }}>Phlox AI Tutor</div>
          <p style={{ fontSize: 'var(--t-corpo)', color:'var(--ink-4)', lineHeight:1.7, marginBottom:24, maxWidth:400, margin:'0 auto 24px' }}>
            Tutoria socrática em qualquer área das ciências da saúde. A AI não te dá as respostas — guia o teu raciocínio, corrige erros, e avalia o teu conhecimento. Exclusivo Plus.
          </p>
          <Link href="/pricing" style={{ display:'inline-block', background:'var(--roxo)', color:'white', textDecoration:'none', padding:'12px 24px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>
            Ver plano Plus →
          </Link>
        </div>
      </div>
    </Mesa>
  )

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--roxo)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Tutor</span>
        </BarraDeTrabalho>
      }
    >

      {(mode !== 'socratico' || !session) && (
        <div className="page-container" style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: `1.5px solid ${mode === m.id ? 'var(--roxo)' : 'var(--border)'}`, background: mode === m.id ? 'var(--roxo)' : 'white', color: mode === m.id ? 'white' : 'var(--ink-3)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <Icon name={m.icon} size={15} />  {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'explicar' && <div className="page-container page-body"><ExplicarMnemonica /></div>}
      {mode === 'exame' && <div className="page-container page-body"><SimulacaoExame /></div>}
      {mode === 'ficha' && <div className="page-container page-body"><FichaFarmaco initialDrug={initialDrug} /></div>}

      {mode === 'socratico' && (!session ? (
        /* ── Setup ── */
        <div className="page-container page-body" style={{ maxWidth:680, margin:'0 auto', flex:1 }}>
          {/* Tutoria por acabar — sair a meio já não perde o diálogo. */}
          {resumable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-lg)', padding: '12px 16px', marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--t-destaque)' }}>⏳</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Tem uma tutoria por acabar</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{resumable.topic}</div>
              </div>
              <button onClick={resumeSession} style={{ padding: '8px 16px', background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>Continuar →</button>
              <button onClick={discardResumable} style={{ padding: '8px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', cursor: 'pointer' }}>Começar de novo</button>
            </div>
          )}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--roxo)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:10, height:2, background:'var(--roxo)', borderRadius:'var(--r-sm)' }} />Phlox AI Tutor · Plus
            </div>
            <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,30px)', color:'var(--ink)', fontWeight: 'var(--peso-normal)' as any, marginBottom:10 }}>Tutoria Socrática</h1>
            <p style={{ fontSize: 'var(--t-corpo)', color:'var(--ink-3)', lineHeight:1.7, maxWidth:500 }}>
              Diferente do chat normal: o tutor não te dá as respostas directamente. Faz perguntas, activa o teu raciocínio, e guia-te até à compreensão real. Mais difícil. Mais eficaz.
            </p>
            {/* Q&A com guidelines fica em /study/biblioteca — explicar/mnemónica/exame/ficha agora são separadores acima. */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:14 }}>
              <Link href="/study/biblioteca" style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', border:'1px solid var(--border)', borderRadius: 'var(--r-md)', textDecoration:'none', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color:'var(--ink-3)' }}>Pergunta clínica (guidelines)</Link>
            </div>
          </div>

          {/* How it works */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%,200px),1fr))', gap:8, marginBottom:24 }}>
            {[
              { step:'1', title:'Activa', desc:'O tutor começa com o que já sabes sobre o tema', icon:'chat' },
              { step:'2', title:'Explora', desc:'Vai fazendo perguntas para construir o conceito', icon:'search' },
              { step:'3', title:'Aprofunda', desc:'Aplica a clínica difícil e os casos excepcionais', icon:'spark' },
              { step:'4', title:'Consolida', desc:'Resume e avalia o teu raciocínio com score final', icon:'trophy' },
            ].map(s => (
              <div key={s.step} style={{ padding:'14px', background:'white', border:'1px solid var(--border)', borderRadius: 'var(--r-lg)', textAlign:'center' }}>
                <div style={{ fontSize: 'var(--t-numero)', marginBottom:6 }}><Icon name={s.icon} size={16} /></div>
                <div style={{ fontSize: 'var(--t-meta)', fontFamily:'var(--font-mono)', color:'var(--roxo)', fontWeight: 'var(--peso-forte)' as any, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
                  Fase {s.step} — {s.title}
                </div>
                <div style={{ fontSize: 'var(--t-meta)', color:'var(--ink-3)', lineHeight:1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Domain selector */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Área de estudo</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {DOMAINS_SIMPLE.map(d => (
                <button key={d.id} onClick={() => setSelectedDomain(d)}
                  style={{ padding:'7px 14px', border:`1.5px solid ${selectedDomain.id===d.id?d.color:'var(--border)'}`, borderRadius: 'var(--r-xl)', background:selectedDomain.id===d.id?d.color:'white', color:selectedDomain.id===d.id?'white':'var(--ink-3)', cursor:'pointer', fontSize: 'var(--t-meta)', fontWeight:selectedDomain.id===d.id?700:400, fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
                  <span><Icon name={d.icon} size={16} /></span>{d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic input */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Tema a estudar</div>
            <div style={{ background:'white', border:`2px solid ${selectedDomain.color}40`, borderRadius: 'var(--r-xl)', overflow:'hidden', transition:'border-color 0.15s' }}>
              <div style={{ display:'flex', padding:'4px 4px 4px 16px', gap:8 }}>
                <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key==='Enter' && startSession()}
                  placeholder={`Ex: ${SUGGESTED_TOPICS[selectedDomain.id]?.[0] || 'Escreve um tema...'}`}
                  style={{ flex:1, border:'none', outline:'none', fontSize: 'var(--t-corpo)', fontFamily:'var(--font-sans)', color:'var(--ink)', background:'transparent', padding:'12px 0' }} />
                <button onClick={startSession} disabled={!topic.trim() || loading}
                  style={{ background:topic.trim()?selectedDomain.color:'var(--bg-3)', color:topic.trim()?'white':'var(--ink-5)', border:'none', borderRadius: 'var(--r-md)', padding:'11px 20px', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor:topic.trim()?'pointer':'not-allowed', fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                  {loading ? 'A iniciar...' : 'Começar sessão →'}
                </button>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          {SUGGESTED_TOPICS[selectedDomain.id] && (
            <div>
              <div style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Sugestões para {selectedDomain.label}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {SUGGESTED_TOPICS[selectedDomain.id].map(s => (
                  <button key={s} onClick={() => { setTopic(s) }}
                    style={{ padding:'6px 12px', border:`1px solid ${selectedDomain.color}40`, borderRadius: 'var(--r-xl)', background:`${selectedDomain.color}10`, cursor:'pointer', fontSize: 'var(--t-meta)', color:selectedDomain.color, fontFamily:'var(--font-sans)', fontWeight: 'var(--peso-corpo)' as any }}>
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
              <button onClick={() => { setSession(null); try { localStorage.removeItem(TUTOR_SESSION_KEY) } catch {} }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize: 'var(--t-meta)', color:'var(--ink-4)', fontFamily:'var(--font-sans)', padding:0, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                ← Nova sessão
              </button>
              <div style={{ width:1, height:16, background:'var(--border)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
                <Icon name={domain.icon} size={16} />
                <div>
                  <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color:'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.topic}</div>
                  <div style={{ fontSize: 'var(--t-micro)', color:'var(--ink-4)', fontFamily:'var(--font-mono)' }}>{domain.label} · {session.exchangeCount} trocas</div>
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
                    <div style={{ maxWidth:'75%', padding:'12px 16px', background:domain.color, color:'white', borderRadius:'12px 12px 4px 12px', fontSize: 'var(--t-corpo)', lineHeight:1.6 }}>
                      {msg.content}
                    </div>
                  </div>
                )
                const style = msg.type ? MSG_STYLE[msg.type] : MSG_STYLE.explanation
                return (
                  <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:domain.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--t-corpo)', flexShrink:0 }}>
                      {domain.icon}
                    </div>
                    <div style={{ maxWidth:'80%', padding:'14px 16px', background:style.bg, border:`1px solid ${style.border}`, borderRadius:'4px 12px 12px 12px' }}>
                      {msg.score !== undefined && (
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <span style={{ fontSize: 'var(--t-micro)', fontFamily:'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color:domain.color, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                            +{msg.score} pontos
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 'var(--t-corpo)', lineHeight:1.7, color:msg.type==='summary'?'var(--bg-2)':'var(--ink)', whiteSpace:'pre-wrap' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:domain.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 'var(--t-corpo)', flexShrink:0 }}>
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
                    style={{ flex:1, border:'1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding:'12px 16px', fontSize: 'var(--t-corpo)', fontFamily:'var(--font-sans)', outline:'none', resize:'none' }} />
                  <button onClick={sendMessage} disabled={!input.trim() || loading}
                    style={{ padding:'12px 20px', background:input.trim()?domain.color:'var(--bg-3)', color:input.trim()?'white':'var(--ink-5)', border:'none', borderRadius: 'var(--r-lg)', cursor:input.trim()?'pointer':'not-allowed', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, fontFamily:'var(--font-sans)', transition:'all 0.15s', flexShrink:0 }}>
                    Responder
                  </button>
                </div>
                <div style={{ fontSize: 'var(--t-meta)', color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginTop:6, textAlign:'center' }}>
                  Enter para enviar · O tutor guia o teu raciocínio — não esperes respostas directas
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </Mesa>
  )
}