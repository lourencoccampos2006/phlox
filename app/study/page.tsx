'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Domínios de estudo — TODAS as áreas das ciências da saúde ───────────────

const DOMAINS = [
  {
    id: 'farmacologia',
    label: 'Farmacologia',
    icon: '💊',
    color: '#0d6e42',
    bg: '#f0fdf5',
    border: '#bbf7d0',
    desc: 'Mecanismos, interações, farmacocinética',
    topics: [
      'Beta-bloqueadores', 'IECA / ARA-II', 'Estatinas', 'Anticoagulantes', 'Antiarrítmicos',
      'Benzodiazepinas', 'ISRS / IRSN', 'Antipsicóticos', 'Antiepilépticos',
      'Antibióticos Beta-lactâmicos', 'Fluoroquinolonas', 'Macrólidos', 'Antifúngicos', 'Antivirais',
      'AINEs', 'Opióides', 'Antidiabéticos orais', 'Inibidores da Bomba de Protões', 'Corticosteróides',
      'Diuréticos', 'Broncodilatadores', 'Imunossupressores', 'Hormonas tiróideias',
      'Anticolinérgicos', 'Dopaminérgicos', 'Biológicos e Imunológicos',
    ],
  },
  {
    id: 'medicina_interna',
    label: 'Medicina Interna',
    icon: '🫀',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    desc: 'Cardiologia, pneumologia, gastro, nefrologia',
    topics: [
      'Insuficiência Cardíaca', 'Fibrilhação Auricular', 'Síndromes Coronários Agudos', 'HTA e Hipertensão Resistente',
      'DPOC e Asma', 'Pneumonia Adquirida na Comunidade', 'Embolia Pulmonar', 'Síndrome de Dificuldade Respiratória',
      'Diabetes Mellitus tipo 2', 'Dislipidemia', 'Obesidade e Síndrome Metabólico',
      'Doença Renal Crónica', 'Síndrome Nefrótico', 'Glomerulonefrites',
      'Doença de Crohn e Colite Ulcerosa', 'Cirrose Hepática', 'Hepatite Viral',
      'Anemia', 'Trombocitopenia', 'Coagulopatias',
      'Artrite Reumatoide', 'Lúpus Eritematoso Sistémico', 'Vasculites',
    ],
  },
  {
    id: 'emergencia',
    label: 'Emergência',
    icon: '🚨',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    desc: 'Algoritmos, protocolos, suporte de vida',
    topics: [
      'Paragem Cardiorrespiratória e RCP', 'SAV — Suporte Avançado de Vida', 'SBV — Suporte Básico de Vida',
      'Choque — Tipos e Tratamento', 'Choque Séptico e Sepsis', 'Choque Anafilático',
      'AVC Isquémico — Protocolo', 'Hemorragia Intracraniana', 'Status Epilepticus',
      'Crise Hipertensiva', 'Edema Agudo do Pulmão', 'Tamponamento Cardíaco',
      'Trauma e ABCDE', 'Trauma Crânio-encefálico', 'Abdómen Agudo',
      'Cetoacidose Diabética', 'Estado Hiperosmolar', 'Hipoglicemia Grave',
      'Intoxicações Agudas', 'Overdose por Opióides', 'Queimaduras',
    ],
  },
  {
    id: 'cirurgia',
    label: 'Cirurgia',
    icon: '🔪',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    desc: 'Pré e pós-operatório, patologia cirúrgica',
    topics: [
      'Apendicite Aguda', 'Colecistite e Coledocolitíase', 'Oclusão Intestinal',
      'Hérnia Inguinal e Umbilical', 'Peritonite', 'Pancreatite Aguda e Crónica',
      'Cancro Colorrectal', 'Cancro Gástrico', 'Cancro do Pâncreas',
      'Avaliação Pré-operatória', 'Gestão Peri-operatória de Anticoagulantes',
      'Complicações Pós-operatórias', 'Deiscência e Infecção de Ferida',
      'Drenos e Sondas', 'Nutrição no Doente Cirúrgico',
      'Cancro da Mama', 'Nódulo Tiróideu', 'Supra-renais',
    ],
  },
  {
    id: 'pediatria',
    label: 'Pediatria',
    icon: '👶',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    desc: 'Desenvolvimento, doenças pediátricas, doses',
    topics: [
      'Desenvolvimento Psicomotor Normal', 'Calendário Vacinal PNV',
      'Febre na Criança — Abordagem', 'Convulsão Febril', 'Otite Média Aguda',
      'Bronquiolite', 'Asma Pediátrica', 'Pneumonia Pediátrica',
      'Gastroenterite Aguda Pediátrica', 'Desidratação — Graus e Tratamento',
      'Diabetes Mellitus tipo 1 Pediátrica', 'Hipotiroidismo Congénito',
      'RN — Adaptação à Vida Extra-uterina', 'Icterícia Neonatal',
      'Cardiopatias Congénitas', 'Sindrome de Down e outras Trissomias',
      'Doses Pediátricas e Ajustes', 'Antibioterapia em Pediatria',
    ],
  },
  {
    id: 'gineco_obstetricia',
    label: 'Ginecologia e Obstetrícia',
    icon: '🤰',
    color: '#be185d',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    desc: 'Gravidez, parto, patologia ginecológica',
    topics: [
      'Vigilância da Gravidez Normal', 'Náuseas e Vómitos na Gravidez',
      'Hipertensão na Gravidez e Pré-eclâmpsia', 'Diabetes Gestacional',
      'Parto Normal e Distócia', 'Cesareana — Indicações e Técnica',
      'Puerpério e Amamentação', 'Hemorragia Pós-Parto',
      'Aborto Espontâneo e Induzido', 'Gravidez Ectópica',
      'Endometriose', 'Síndrome do Ovário Poliquístico', 'Miomas',
      'Cancro do Colo do Útero e Rastreio', 'Cancro do Ovário',
      'Menopausa e THS', 'Contracepção — Métodos e Contraindicações',
      'Fármacos na Gravidez — Categorias FDA/EMA',
    ],
  },
  {
    id: 'anatomia_fisiologia',
    label: 'Anatomia e Fisiologia',
    icon: '🫁',
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    desc: 'Estrutura e função dos sistemas',
    topics: [
      'Sistema Cardiovascular — Anatomia', 'Fisiologia Cardíaca e Ciclo Cardíaco',
      'Sistema Respiratório — Anatomia', 'Mecânica Respiratória e Trocas Gasosas',
      'Sistema Nervoso Central — Anatomia', 'Sistema Nervoso Periférico',
      'Rim — Anatomia e Fisiologia', 'Equilíbrio Ácido-Base',
      'Fígado — Anatomia e Funções', 'Sistema Digestivo — Fisiologia',
      'Sistema Endócrino — Eixos Hormonais', 'Pâncreas Endócrino',
      'Sistema Imunitário — Inato e Adaptativo', 'Hemostase e Coagulação',
      'Sistema Musculoesquelético', 'Dermatologia — Estrutura da Pele',
    ],
  },
  {
    id: 'semiologia',
    label: 'Semiologia',
    icon: '🩺',
    color: '#374151',
    bg: 'var(--bg-2)',
    border: 'var(--border)',
    desc: 'Exame físico, sinais e sintomas',
    topics: [
      'Exame Físico Geral — Metodologia', 'Auscultação Cardíaca — Sons e Sopros',
      'Auscultação Pulmonar — Ruídos Adventícios', 'Palpação e Percussão Abdominal',
      'Exame Neurológico — Pares Cranianos', 'Reflexos Osteotendinosos',
      'Sinais Meníngeos', 'Avaliação do Nível de Consciência — GCS',
      'Edema — Causas e Classificação', 'Cianose — Central vs Periférica',
      'Icterícia — Diagnóstico Diferencial', 'Hepatoesplenomegalia',
      'Adenomegalias — Abordagem', 'Sopros Cardíacos — Classificação',
    ],
  },
  {
    id: 'enfermagem',
    label: 'Enfermagem Clínica',
    icon: '💉',
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
    desc: 'Técnicas, protocolos, cuidados',
    topics: [
      'Administração de Medicação IV, IM, SC', 'Preparação e Cálculo de Doses',
      'Cateterismo Venoso Periférico', 'Cateter Venoso Central — Cuidados',
      'Sondagem Nasogástrica', 'Sondagem Vesical — Algaliação',
      'Prevenção de Úlceras de Pressão', 'Pensos e Cuidados à Ferida',
      'Monitorização de Sinais Vitais', 'Oximetria e Oxigenoterapia',
      'Processo de Enfermagem — NANDA', 'Escalas — Braden, Morse, Barthel',
      'Isolamento e Controlo de Infecção', 'Triagem de Manchester',
      'Cuidados Paliativos e Controlo Sintomático',
    ],
  },
  {
    id: 'nutricao',
    label: 'Nutrição Clínica',
    icon: '🥗',
    color: '#65a30d',
    bg: '#f7fee7',
    border: '#d9f99d',
    desc: 'Dietética, suporte nutricional, patologias',
    topics: [
      'Avaliação do Estado Nutricional', 'IMC, PCT, CMB — Interpretação',
      'Necessidades Energéticas e Proteicas', 'Macronutrientes e Micronutrientes',
      'Dieta na Diabetes Mellitus', 'Dieta na Doença Renal Crónica',
      'Dieta na Insuficiência Cardíaca', 'Dieta na Doença Hepática',
      'Suporte Nutricional Entérico', 'Nutrição Parentérica Total',
      'Desnutrição — Classificação e Tratamento', 'Obesidade — Abordagem Clínica',
      'Alergias e Intolerâncias Alimentares', 'Nutrição na Gravidez',
      'Nutrição Pediátrica e Aleitamento',
    ],
  },
]

type StudyMode = 'home' | 'flashcards' | 'quiz'
type FlashCard = { front: string; back: string }
type QuizQ = { question: string; options: string[]; correct: number; explanation: string }

// ─── Flashcards com SRS (Spaced Repetition System) ───────────────────────────

function FlashcardsMode({ topic, domain, cards, onBack, onSession }: {
  topic: string; domain: typeof DOMAINS[0]; cards: FlashCard[]
  onBack: () => void; onSession: (known: number, total: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<('easy'|'medium'|'hard')[]>([])
  const [done, setDone] = useState(false)

  const answer = (rating: 'easy'|'medium'|'hard') => {
    const newResults = [...results, rating]
    setResults(newResults)
    setFlipped(false)
    if (index + 1 >= cards.length) {
      const known = newResults.filter(r => r !== 'hard').length
      onSession(known, cards.length)
      setDone(true)
    } else {
      setTimeout(() => setIndex(p => p + 1), 150)
    }
  }

  if (done) {
    const easy = results.filter(r => r === 'easy').length
    const medium = results.filter(r => r === 'medium').length
    const hard = results.filter(r => r === 'hard').length
    const pct = Math.round(((easy + medium) / results.length) * 100)
    return (
      <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', padding:'48px 20px' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{pct>=80?'🏆':pct>=60?'👍':'📚'}</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:'var(--ink)', marginBottom:8 }}>Sessão concluída</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:48, color:domain.color, marginBottom:16 }}>{pct}%</div>
        <div style={{ display:'flex', gap:20, justifyContent:'center', marginBottom:28 }}>
          {[['Fácil', easy, '#0d6e42'], ['Médio', medium, '#d97706'], ['Difícil', hard, '#dc2626']].map(([l,v,c]) => (
            <div key={l as string}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:28, color:c as string }}>{v}</div>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:24, fontSize:13, color:'var(--ink-3)' }}>
          {hard > 0 ? `${hard} cartão${hard>1?'s':''} marcado${hard>1?'s':''} para revisão prioritária.` : 'Excelente! Todos os cartões dominados.'}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => { setIndex(0); setFlipped(false); setResults([]); setDone(false) }}
            style={{ background:domain.color, color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            Repetir
          </button>
          <button onClick={onBack}
            style={{ background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 22px', fontSize:14, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  const card = cards[index]
  const progress = (index / cards.length) * 100

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{topic} · {index+1}/{cards.length}</div>
        <div style={{ display:'flex', gap:10, fontSize:11, fontFamily:'var(--font-mono)' }}>
          <span style={{ color:'#0d6e42' }}>{results.filter(r=>r==='easy').length} fácil</span>
          <span style={{ color:'#d97706' }}>{results.filter(r=>r==='medium').length} médio</span>
          <span style={{ color:'#dc2626' }}>{results.filter(r=>r==='hard').length} difícil</span>
        </div>
      </div>
      <div style={{ height:5, background:'var(--bg-3)', borderRadius:3, marginBottom:24, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${progress}%`, background:domain.color, borderRadius:3, transition:'width 0.3s' }} />
      </div>

      <div onClick={() => setFlipped(!flipped)}
        style={{ background:'white', border:`2px solid ${flipped ? domain.color : 'var(--border)'}`, borderRadius:12, padding:'44px 28px', minHeight:240, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', marginBottom:20, transition:'border-color 0.2s', position:'relative' }}>
        <div style={{ position:'absolute', top:14, left:16, right:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:flipped?domain.color:'var(--ink-5)', letterSpacing:'0.12em', textTransform:'uppercase' }}>
            {flipped ? '✓ RESPOSTA' : 'PERGUNTA'}
          </span>
          <span style={{ fontSize:11, color:'var(--ink-5)' }}>toca para {flipped?'ocultar':'revelar'}</span>
        </div>
        {!flipped
          ? <p style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'var(--ink)', lineHeight:1.5, margin:0, maxWidth:520 }}>{card.front}</p>
          : <p style={{ fontSize:15, color:'var(--ink-2)', lineHeight:1.8, margin:0, maxWidth:520 }}>{card.back}</p>
        }
      </div>

      {flipped ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          {[
            { label:'Difícil', sub:'Vou rever', rating:'hard' as const, bg:'#fee2e2', border:'#fca5a5', color:'#991b1b' },
            { label:'Médio', sub:'Quase certo', rating:'medium' as const, bg:'#fef9c3', border:'#fde68a', color:'#854d0e' },
            { label:'Fácil', sub:'Sei bem', rating:'easy' as const, bg:'#d1fae5', border:'#6ee7b7', color:'#065f46' },
          ].map(btn => (
            <button key={btn.rating} onClick={() => answer(btn.rating)}
              style={{ padding:'12px 8px', background:btn.bg, border:`1.5px solid ${btn.border}`, borderRadius:8, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:btn.color, marginBottom:2 }}>{btn.label}</div>
              <div style={{ fontSize:11, color:btn.color, opacity:0.7 }}>{btn.sub}</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'14px 0', fontSize:13, color:'var(--ink-4)' }}>
          Avalia o teu conhecimento depois de revelar a resposta
        </div>
      )}
    </div>
  )
}

// ─── Quiz Mode ────────────────────────────────────────────────────────────────

function QuizMode({ topic, domain, questions, onBack, onSession }: {
  topic: string; domain: typeof DOMAINS[0]; questions: QuizQ[]
  onBack: () => void; onSession: (correct: number, total: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number|null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    const pct = Math.round((score/questions.length)*100)
    return (
      <div style={{ maxWidth:600, margin:'0 auto', textAlign:'center', padding:'48px 20px' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>{pct>=80?'🏆':pct>=60?'📚':'💪'}</div>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'var(--ink)', marginBottom:8 }}>Quiz concluído</div>
        <div style={{ fontSize:52, fontWeight:700, color:pct>=70?domain.color:pct>=50?'#d97706':'#dc2626', margin:'8px 0 16px' }}>{pct}%</div>
        <p style={{ fontSize:15, color:'var(--ink-3)', marginBottom:28 }}>{score} correctas em {questions.length} perguntas</p>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => { setIndex(0); setSelected(null); setScore(0); setDone(false) }}
            style={{ background:domain.color, color:'white', border:'none', borderRadius:8, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Repetir</button>
          <button onClick={onBack}
            style={{ background:'white', color:'var(--ink-3)', border:'1px solid var(--border)', borderRadius:8, padding:'11px 22px', fontSize:14, cursor:'pointer', fontFamily:'var(--font-sans)' }}>Voltar</button>
        </div>
      </div>
    )
  }

  const q = questions[index]
  const answer = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    if (i === q.correct) setScore(p=>p+1)
  }
  const next = () => {
    if (index+1 >= questions.length) { onSession(score + (selected===q.correct?1:0), questions.length); setDone(true) }
    else { setSelected(null); setIndex(p=>p+1) }
  }

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>{topic} · {index+1}/{questions.length}</span>
        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:domain.color }}>{score} correctas</span>
      </div>
      <div style={{ height:5, background:'var(--bg-3)', borderRadius:3, marginBottom:24, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(index/questions.length)*100}%`, background:domain.color, borderRadius:3 }} />
      </div>

      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'24px 22px 20px', marginBottom:12 }}>
        <p style={{ fontFamily:'var(--font-serif)', fontSize:18, color:'var(--ink)', lineHeight:1.6, margin:'0 0 20px' }}>{q.question}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {q.options.map((opt, i) => {
            let bg='var(--bg-2)', border='var(--border-2)', color='var(--ink-2)'
            if (selected !== null) {
              if (i===q.correct) { bg='#d1fae5'; border='#6ee7b7'; color='#065f46' }
              else if (i===selected) { bg='#fee2e2'; border='#fca5a5'; color='#991b1b' }
              else { bg='white'; color='var(--ink-5)' }
            }
            return (
              <button key={i} onClick={() => answer(i)}
                style={{ background:bg, border:`1px solid ${border}`, borderRadius:7, padding:'12px 14px', fontSize:14, color, cursor:selected===null?'pointer':'default', textAlign:'left', fontFamily:'var(--font-sans)', lineHeight:1.5, display:'flex', alignItems:'flex-start', gap:10, transition:'all 0.15s' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, minWidth:18, flexShrink:0, marginTop:1 }}>{String.fromCharCode(65+i)}.</span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {selected !== null && (
        <>
          <div style={{ background:'#f0fdf5', border:'1px solid #bbf7d0', borderLeft:`4px solid ${domain.color}`, borderRadius:8, padding:'14px 18px', marginBottom:12 }}>
            <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--green-2)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>EXPLICAÇÃO</div>
            <p style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.7, margin:0 }}>{q.explanation}</p>
          </div>
          <button onClick={next}
            style={{ width:'100%', background:domain.color, color:'white', border:'none', borderRadius:8, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
            {index<questions.length-1 ? 'Próxima →' : 'Ver resultado'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudyPage() {
  const { user, supabase } = useAuth()
  const [mode, setMode] = useState<StudyMode>('home')
  const [selectedDomain, setSelectedDomain] = useState<typeof DOMAINS[0] | null>(null)
  const [selectedTopic, setSelectedTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flashcards, setFlashcards] = useState<FlashCard[]>([])
  const [quiz, setQuiz] = useState<QuizQ[]>([])
  const [activeDomainId, setActiveDomainId] = useState<string|null>(null)
  const [sessionStats, setSessionStats] = useState<Record<string, { sessions: number; lastScore: number }>>({})
  const plan = (user?.plan || 'free') as string
  const isStudent = plan==='student'||plan==='pro'||plan==='clinic'

  // Load session stats
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data } = await supabase.from('study_sessions').select('type, metadata, xp_earned')
          .eq('user_id', user.id)
        if (!data) return
        const stats: Record<string, { sessions: number; lastScore: number }> = {}
        data.forEach((s: any) => {
          const key = s.metadata?.topic
          if (!key) return
          if (!stats[key]) stats[key] = { sessions: 0, lastScore: 0 }
          stats[key].sessions++
          if (s.metadata?.score) stats[key].lastScore = s.metadata.score
        })
        setSessionStats(stats)
      } catch {}
    })()
  }, [user, supabase])

  const recordSession = useCallback(async (topic: string, known: number, total: number) => {
    if (!user) return
    try {
      await supabase.from('study_sessions').insert({
        user_id: user.id,
        type: mode === 'flashcards' ? 'flashcard' : 'quiz',
        drug_class: topic,
        xp_earned: Math.round((known/total) * 20) + 5,
        metadata: { topic, score: Math.round((known/total)*100), known, total, domain: selectedDomain?.id },
      })
      if (mode === 'quiz') {
        await supabase.from('quiz_results').insert({
          user_id: user.id, drug_class: topic, correct: known > total/2,
        })
      }
    } catch {}

    setSessionStats(prev => ({
      ...prev,
      [topic]: { sessions: (prev[topic]?.sessions || 0) + 1, lastScore: Math.round((known/total)*100) }
    }))
  }, [user, supabase, mode, selectedDomain])

  const start = async (topic: string, studyMode: 'flashcards'|'quiz') => {
    if (!isStudent) return
    setLoading(true); setError(''); setSelectedTopic(topic)
    try {
      const endpoint = studyMode === 'flashcards' ? '/api/study/flashcards' : '/api/study/quiz'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugClass: topic, domain: selectedDomain?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (studyMode === 'flashcards') { setFlashcards(data.flashcards); setMode('flashcards') }
      else { setQuiz(data.questions); setMode('quiz') }
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const goBack = () => {
    setMode('home')
    if (!activeDomainId) setSelectedDomain(null)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        {mode !== 'home' && (
          <button onClick={goBack}
            style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', marginBottom:24, padding:0, display:'flex', alignItems:'center', gap:6 }}>
            ← Voltar
          </button>
        )}

        {error && (
          <div style={{ background:'var(--red-light)', border:'1px solid #fca5a5', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'var(--red)' }}>{error}</div>
        )}

        {loading && (
          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:'56px', textAlign:'center' }}>
            <div style={{ width:36, height:36, border:`3px solid ${selectedDomain?.color || 'var(--green)'}30`, borderTop:`3px solid ${selectedDomain?.color || 'var(--green)'}`, borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }} />
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.12em' }}>A gerar conteúdo pedagógico para {selectedTopic}...</div>
          </div>
        )}

        {/* HOME */}
        {!loading && mode === 'home' && (
          <>
            {!selectedDomain ? (
              <>
                {/* Header */}
                <div style={{ marginBottom:28 }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8 }}>Plataforma de Estudo · Student</div>
                  <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,32px)', color:'var(--ink)', fontWeight:400, marginBottom:8, letterSpacing:'-0.01em' }}>
                    Todas as áreas das ciências da saúde
                  </h1>
                  <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6 }}>
                    {DOMAINS.reduce((acc, d) => acc + d.topics.length, 0)} tópicos · {DOMAINS.length} domínios · Flashcards e quizzes gerados por AI · Repetição espaçada (SRS)
                  </p>
                </div>

                {!isStudent && (
                  <div style={{ background:'#faf5ff', border:'2px solid #e9d5ff', borderRadius:12, padding:'24px', marginBottom:24, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                    <span style={{ fontSize:32, flexShrink:0 }}>🎓</span>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'#5b21b6', marginBottom:4 }}>Plataforma Student — Todas as áreas</div>
                      <div style={{ fontSize:13, color:'#7c3aed', lineHeight:1.6 }}>Farmacologia, Medicina Interna, Emergência, Cirurgia, Pediatria e mais. Com repetição espaçada e tracking real.</div>
                    </div>
                    <Link href="/pricing" style={{ background:'#7c3aed', color:'white', textDecoration:'none', padding:'11px 22px', borderRadius:8, fontSize:14, fontWeight:700, flexShrink:0 }}>
                      Activar Student →
                    </Link>
                  </div>
                )}

                {/* Domain cards */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap:10 }}>
                  {DOMAINS.map(domain => {
                    const domainSessions = domain.topics.reduce((acc, t) => acc + (sessionStats[t]?.sessions || 0), 0)
                    const topicsStudied = domain.topics.filter(t => sessionStats[t]?.sessions > 0).length
                    const avgScore = domain.topics.reduce((acc, t) => acc + (sessionStats[t]?.lastScore || 0), 0) / domain.topics.length

                    return (
                      <button key={domain.id} onClick={() => { setSelectedDomain(domain); setActiveDomainId(domain.id) }}
                        disabled={!isStudent}
                        style={{ display:'flex', flexDirection:'column', padding:'20px', background:isStudent?'white':'var(--bg-2)', border:`1px solid ${domain.border}`, borderRadius:12, cursor:isStudent?'pointer':'not-allowed', textAlign:'left', transition:'all 0.15s', opacity:isStudent?1:0.6 }}
                        className="domain-card">
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                          <span style={{ fontSize:24 }}>{domain.icon}</span>
                          <div>
                            <div style={{ fontSize:15, fontWeight:700, color:domain.color, letterSpacing:'-0.01em' }}>{domain.label}</div>
                            <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>{domain.topics.length} tópicos</div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5, marginBottom:12 }}>{domain.desc}</div>
                        {domainSessions > 0 ? (
                          <div style={{ marginTop:'auto' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{topicsStudied}/{domain.topics.length} estudados</span>
                              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:domain.color }}>{Math.round(avgScore)}% média</span>
                            </div>
                            <div style={{ height:3, background:domain.border, borderRadius:2, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${(topicsStudied/domain.topics.length)*100}%`, background:domain.color, borderRadius:2 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop:'auto', fontSize:11, color:domain.color, fontFamily:'var(--font-mono)', fontWeight:700 }}>
                            {isStudent ? 'Começar →' : 'Requer Student'}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Domain topics */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                  <button onClick={() => setSelectedDomain(null)}
                    style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', padding:0, display:'flex', alignItems:'center', gap:4 }}>
                    ← Domínios
                  </button>
                  <div style={{ width:1, height:16, background:'var(--border)' }} />
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{selectedDomain.icon}</span>
                    <span style={{ fontSize:16, fontWeight:700, color:selectedDomain.color }}>{selectedDomain.label}</span>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {selectedDomain.topics.map(topic => {
                    const ts = sessionStats[topic]
                    const scoreColor = !ts ? 'var(--ink-4)' : ts.lastScore>=80?'#0d6e42':ts.lastScore>=60?'#d97706':'#dc2626'
                    return (
                      <div key={topic} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'white', border:'1px solid var(--border)', borderRadius:10, transition:'border-color 0.15s' }}
                        className="topic-row">
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)', letterSpacing:'-0.01em' }}>{topic}</div>
                          {ts && <div style={{ fontSize:11, color:'var(--ink-4)', fontFamily:'var(--font-mono)', marginTop:2 }}>{ts.sessions} sessão{ts.sessions>1?'ões':''} · último score: <span style={{ color:scoreColor, fontWeight:700 }}>{ts.lastScore}%</span></div>}
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          <button onClick={() => start(topic, 'flashcards')}
                            style={{ padding:'8px 14px', background:selectedDomain.color, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                            Flashcards
                          </button>
                          <button onClick={() => start(topic, 'quiz')}
                            style={{ padding:'8px 14px', background:'white', color:selectedDomain.color, border:`1.5px solid ${selectedDomain.border}`, borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
                            Quiz
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* FLASHCARDS */}
        {!loading && mode==='flashcards' && flashcards.length>0 && selectedDomain && (
          <FlashcardsMode topic={selectedTopic} domain={selectedDomain} cards={flashcards}
            onBack={goBack} onSession={(k,t) => recordSession(selectedTopic, k, t)} />
        )}

        {/* QUIZ */}
        {!loading && mode==='quiz' && quiz.length>0 && selectedDomain && (
          <QuizMode topic={selectedTopic} domain={selectedDomain} questions={quiz}
            onBack={goBack} onSession={(k,t) => recordSession(selectedTopic, k, t)} />
        )}
      </div>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .domain-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.06);transform:translateY(-2px)}
        .topic-row:hover{border-color:var(--border-2)!important}
      `}</style>
    </div>
  )
}