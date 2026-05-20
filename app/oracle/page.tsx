'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface Med { id:string; name:string; dose:string|null; frequency:string|null }
interface Question { question:string; type:'yesno'|'scale'|'duration'|'text'; options?:string[] }
interface SOAPNote {
  subjective:string; objective:string; assessment:string; plan:string[]
  monitoring:string; when_to_seek_help:string; evidence_level:'A'|'B'|'C'
  pcne_problem?:string; pcne_cause?:string; pcne_intervention?:string
  urgency:'routine'|'soon'|'urgent'|'emergency'
}

const URGENCY = {
  routine:   { bg:'#d1fae5', border:'#6ee7b7', color:'#065f46', label:'Acompanhamento de rotina',     icon:'✅' },
  soon:      { bg:'#fef9c3', border:'#fde68a', color:'#854d0e', label:'Consulta em breve',            icon:'⏰' },
  urgent:    { bg:'#fff7ed', border:'#fed7aa', color:'#9a3412', label:'Contactar médico hoje',        icon:'⚠️' },
  emergency: { bg:'#fee2e2', border:'#fca5a5', color:'#991b1b', label:'Urgência / emergência',       icon:'🚨' },
}

const EVIDENCE = {
  A: { color:'#065f46', bg:'#d1fae5', label:'Evidência A', note:'Ensaios clínicos / meta-análises' },
  B: { color:'#1d4ed8', bg:'#eff6ff', label:'Evidência B', note:'Estudos observacionais / guidelines' },
  C: { color:'#6b7280', bg:'#f9fafb', label:'Evidência C', note:'Consenso / opinião de especialistas' },
}

const EXAMPLE_PROBLEMS = [
  'Tenho tonturas quando me levanto há 3 dias',
  'Comecei um antibiótico e tenho diarreia',
  'A minha tensão está a subir apesar da medicação',
  'Esqueço-me das doses e quero saber o que fazer',
  'Tenho dores de cabeça frequentes desde que mudei de medicação',
]

type Phase = 'input'|'clarifying'|'result'

export default function OraclePage() {
  const { user, supabase } = useAuth()
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [phase, setPhase] = useState<Phase>('input')
  const [problem, setProblem] = useState('')
  const [mode, setMode] = useState<'personal'|'clinical'>('personal')
  const [age, setAge] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [immediateConcern, setImmediateConcern] = useState(false)
  const [soap, setSOAP] = useState<SOAPNote|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [copied, setCopied] = useState(false)
  const [patients, setPatients] = useState<{id:string;name:string;age:number|null;conditions:string|null;weight:number|null;creatinine:number|null;sex:string|null}[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')

  useEffect(() => {
    const p = getActiveProfile()
    setActiveProfileState(p)
    if (p?.type === 'family' && p.age) setAge(String(p.age))
  }, [])

  useEffect(() => {
    if (!user) return
    if (activeProfile?.type === 'family') {
      supabase.from('family_profile_meds').select('id,name,dose,frequency').eq('profile_id', activeProfile.id).then(({ data }) => setMeds(data || []))
    } else {
      supabase.from('personal_meds').select('id,name,dose,frequency').eq('user_id', user.id).then(({ data }) => setMeds(data || []))
    }
  }, [user, supabase, activeProfile])

  useEffect(() => {
    if (!user || mode !== 'clinical') return
    supabase.from('patients').select('id,name,age,conditions,weight,creatinine,sex').eq('user_id', user.id).order('name').then(({ data }) => setPatients(data || []))
  }, [user, supabase, mode])

  const getClarifyQuestions = async () => {
    if (!problem.trim()) return
    setLoading(true); setError(null)
    const { data: sd } = await supabase.auth.getSession()
    const selPt = patients.find(p => p.id === selectedPatientId)
    try {
      const res = await fetch('/api/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ phase: 'clarify', problem, medications: meds.map(m=>({name:m.name,dose:m.dose,frequency:m.frequency})), mode, age: age ? parseInt(age) : null, patientContext: selPt ? { conditions: selPt.conditions, weight: selPt.weight, creatinine: selPt.creatinine } : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setQuestions(data.questions || [])
      setImmediateConcern(data.immediate_concern || false)
      setPhase('clarifying')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const getAssessment = async () => {
    setLoading(true); setError(null)
    const { data: sd } = await supabase.auth.getSession()
    const selPt = patients.find(p => p.id === selectedPatientId)
    try {
      const res = await fetch('/api/oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          phase: 'assess', problem, medications: meds.map(m=>({name:m.name,dose:m.dose,frequency:m.frequency})),
          answers, mode, age: age ? parseInt(age) : null, patientContext: selPt ? { conditions: selPt.conditions, weight: selPt.weight, creatinine: selPt.creatinine } : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setSOAP(data.soap)
      setPhase('result')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const reset = () => { setPhase('input'); setProblem(''); setQuestions([]); setAnswers({}); setSOAP(null); setError(null); setCopied(false) }

  const copySOAP = () => {
    if (!soap) return
    const date = new Date().toLocaleDateString('pt-PT')
    const lines = [
      `AVALIAÇÃO FARMACÊUTICA — ${date}`,
      mode === 'clinical' ? `Modo: Clínico` : `Modo: Pessoal`,
      age ? `Idade: ${age} anos` : '',
      '',
      `S — SUBJECTIVO`,
      soap.subjective,
      '',
      `O — OBJECTIVO`,
      soap.objective,
      '',
      `A — AVALIAÇÃO`,
      soap.assessment,
      '',
      `P — PLANO`,
      soap.plan.map((s, i) => `${i+1}. ${s}`).join('\n'),
      '',
      `MONITORIZAÇÃO`,
      soap.monitoring,
      '',
      `SINAIS DE ALERTA`,
      soap.when_to_seek_help,
      soap.pcne_problem ? `\nPCNE — Problema: ${soap.pcne_problem}` : '',
      soap.pcne_cause ? `PCNE — Causa: ${soap.pcne_cause}` : '',
      soap.pcne_intervention ? `PCNE — Intervenção: ${soap.pcne_intervention}` : '',
      '',
      `Gerado pelo Phlox Oracle · ${EVIDENCE[soap.evidence_level].label}`,
    ].filter(l => l !== undefined).join('\n')
    navigator.clipboard.writeText(lines).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  const selectPatient = (id: string) => {
    setSelectedPatientId(id)
    const p = patients.find(pt => pt.id === id)
    if (!p) return
    if (p.age) setAge(String(p.age))
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>


      {/* Header */}
      <div style={{ background:'#0f172a', borderBottom:'1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop:28, paddingBottom:24 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.35)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8 }}>Phlox Oracle</div>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:26, color:'white', fontWeight:400, marginBottom:8 }}>
                Consulta Farmacêutica Estruturada
              </div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6, maxWidth:480 }}>
                Apresenta o teu problema. O Oracle faz as perguntas certas e produz uma avaliação clínica completa com plano de ação.
              </div>
            </div>
            <div style={{ marginTop:4 }}>
              <ProfileSelector onChange={p => { setActiveProfileState(p); setMeds([]); if (p.type === 'family' && p.age) setAge(String(p.age)) }} />
            </div>
          </div>
          {/* Progress indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:16 }}>
            {(['input','clarifying','result'] as Phase[]).map((p, i) => (
              <div key={p} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background: phase===p?'white':i<(['input','clarifying','result'] as Phase[]).indexOf(phase)?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: phase===p?'#0f172a':i<(['input','clarifying','result'] as Phase[]).indexOf(phase)?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.3)', flexShrink:0 }}>
                  {i+1}
                </div>
                <span style={{ fontSize:11, color: phase===p?'white':'rgba(255,255,255,0.35)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em' }}>
                  {p==='input'?'PROBLEMA':p==='clarifying'?'CLARIFICAÇÃO':'AVALIAÇÃO'}
                </span>
                {i < 2 && <div style={{ width:24, height:1, background:'rgba(255,255,255,0.15)' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth:680 }}>

        {error && (
          <div style={{ padding:'12px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, fontSize:13, color:'#991b1b', marginBottom:16 }}>{error}</div>
        )}

        {/* ─── PHASE 1: Input ─── */}
        {phase === 'input' && (
          <div>
            {/* Mode + context */}
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Modo de resposta</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {(['personal','clinical'] as const).map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        style={{ flex:1, padding:'8px', background:mode===m?'#0f172a':'var(--bg-2)', border:`1.5px solid ${mode===m?'#0f172a':'var(--border)'}`, borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700, color:mode===m?'white':'var(--ink-4)', fontFamily:'var(--font-mono)' }}>
                        {m==='personal'?'Simples':'Clínico'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Idade (opcional)</label>
                  <input value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 65" type="number"
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'8px 11px', fontSize:13, outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box' }} />
                </div>
              </div>
              {mode === 'clinical' && patients.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Doente registado (pré-preenche dados)</label>
                  <select value={selectedPatientId} onChange={e => selectPatient(e.target.value)}
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:7, padding:'8px 11px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', background:'white', cursor:'pointer' }}>
                    <option value=''>— Selecionar doente —</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}{p.conditions ? ` · ${p.conditions.split(',')[0]}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Meds context */}
              {meds.length > 0 && (
                <div style={{ padding:'10px 13px', background:'var(--bg-2)', borderRadius:8, marginBottom:16 }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Medicação (carregada automaticamente)</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {meds.slice(0,8).map(m => (
                      <span key={m.id} style={{ fontSize:11, color:'var(--green-2)', background:'var(--green-light)', border:'1px solid var(--green-mid)', padding:'3px 9px', borderRadius:20, fontWeight:600 }}>
                        {m.name}
                      </span>
                    ))}
                    {meds.length > 8 && <span style={{ fontSize:11, color:'var(--ink-5)', fontFamily:'var(--font-mono)' }}>+{meds.length-8} mais</span>}
                  </div>
                </div>
              )}

              {/* Problem input */}
              <label style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:8 }}>O teu problema ou dúvida</label>
              <textarea value={problem} onChange={e => setProblem(e.target.value)}
                placeholder="Descreve o teu problema com o máximo de detalhe possível. Ex: Comecei a tomar lisinopril há 2 semanas e tenho uma tosse seca que não passa..."
                rows={4}
                style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'12px 14px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', resize:'vertical', boxSizing:'border-box', lineHeight:1.6 }} />

              {/* Examples */}
              {!problem && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8 }}>Exemplos</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {EXAMPLE_PROBLEMS.map(ex => (
                      <button key={ex} onClick={() => setProblem(ex)}
                        style={{ textAlign:'left', padding:'8px 12px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', fontSize:12, color:'var(--ink-3)', lineHeight:1.4 }}>
                        "{ex}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={getClarifyQuestions} disabled={!problem.trim() || loading || !user}
              style={{ width:'100%', padding:'16px', background:problem.trim() && !loading && user?'#0f172a':'var(--bg-3)', color:problem.trim() && !loading && user?'white':'var(--ink-5)', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:problem.trim() && !loading && user?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
              {loading
                ? <><span style={{ width:16, height:16, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A preparar consulta...</>
                : !user ? 'Inicia sessão para usar o Oracle'
                : '→ Iniciar consulta farmacêutica'}
            </button>
            {!user && <div style={{ textAlign:'center', marginTop:10 }}><Link href="/login" style={{ fontSize:13, color:'var(--green-2)', fontWeight:700 }}>Iniciar sessão →</Link></div>}
          </div>
        )}

        {/* ─── PHASE 2: Clarifying questions ─── */}
        {phase === 'clarifying' && (
          <div>
            {immediateConcern && (
              <div style={{ padding:'14px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10, marginBottom:16, display:'flex', gap:10 }}>
                <span style={{ fontSize:20 }}>⚠️</span>
                <div style={{ fontSize:13, color:'#991b1b' }}>
                  <span style={{ fontWeight:700 }}>Nota: </span>
                  Este problema pode requerer atenção médica urgente. Se os sintomas forem graves, não aguardes — contacta um profissional de saúde imediatamente.
                </div>
              </div>
            )}

            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🩺</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)' }}>Farmacêutico Oracle</div>
                  <div style={{ fontSize:12, color:'var(--ink-4)' }}>Tenho algumas perguntas para te dar a melhor resposta possível.</div>
                </div>
              </div>

              {/* Problem summary */}
              <div style={{ padding:'10px 14px', background:'var(--bg-2)', borderRadius:8, marginBottom:20, fontSize:12, color:'var(--ink-3)', fontStyle:'italic', lineHeight:1.5 }}>
                "{problem}"
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {questions.map((q, i) => (
                  <div key={i}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)', marginBottom:8, lineHeight:1.5 }}>
                      <span style={{ color:'var(--ink-5)', fontFamily:'var(--font-mono)', marginRight:8, fontSize:11 }}>{i+1}.</span>
                      {q.question}
                    </div>
                    {q.type === 'yesno' && (
                      <div style={{ display:'flex', gap:8 }}>
                        {['Sim','Não','Não tenho a certeza'].map(opt => (
                          <button key={opt} onClick={() => setAnswers(p => ({...p,[q.question]:opt}))}
                            style={{ padding:'9px 16px', background:answers[q.question]===opt?'#0f172a':'var(--bg-2)', color:answers[q.question]===opt?'white':'var(--ink)', border:`1.5px solid ${answers[q.question]===opt?'#0f172a':'var(--border)'}`, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:answers[q.question]===opt?700:400 }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'scale' && (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {(q.options || ['1','2','3','4','5','6','7','8','9','10']).map(opt => (
                          <button key={opt} onClick={() => setAnswers(p => ({...p,[q.question]:opt}))}
                            style={{ width:40, height:40, background:answers[q.question]===opt?'#0f172a':'var(--bg-2)', color:answers[q.question]===opt?'white':'var(--ink)', border:`1.5px solid ${answers[q.question]===opt?'#0f172a':'var(--border)'}`, borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-mono)' }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'duration' && (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {(q.options || ['Hoje','1-3 dias','4-7 dias','1-2 semanas','Mais de 2 semanas']).map(opt => (
                          <button key={opt} onClick={() => setAnswers(p => ({...p,[q.question]:opt}))}
                            style={{ padding:'8px 14px', background:answers[q.question]===opt?'#0f172a':'var(--bg-2)', color:answers[q.question]===opt?'white':'var(--ink)', border:`1.5px solid ${answers[q.question]===opt?'#0f172a':'var(--border)'}`, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:answers[q.question]===opt?700:400 }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.type === 'text' && (
                      <input value={answers[q.question] || ''} onChange={e => setAnswers(p => ({...p,[q.question]:e.target.value}))}
                        placeholder="A tua resposta..."
                        style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'10px 13px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={getAssessment} disabled={loading}
                style={{ flex:1, padding:'15px', background:loading?'var(--bg-3)':'#0f172a', color:loading?'var(--ink-5)':'white', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:loading?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                {loading
                  ? <><span style={{ width:16, height:16, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }} /> A gerar avaliação...</>
                  : '→ Obter avaliação farmacêutica'}
              </button>
              <button onClick={reset} style={{ padding:'15px 18px', background:'white', color:'var(--ink-4)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', fontSize:13 }}>
                ← Recomeçar
              </button>
            </div>
          </div>
        )}

        {/* ─── PHASE 3: SOAP Result ─── */}
        {phase === 'result' && soap && (
          <div>
            {/* Urgency banner */}
            {(() => {
              const u = URGENCY[soap.urgency]
              return (
                <div style={{ padding:'16px 18px', background:u.bg, border:`1px solid ${u.border}`, borderRadius:12, marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{u.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:u.color }}>{u.label}</div>
                    {soap.urgency === 'emergency' && (
                      <div style={{ fontSize:13, color:u.color, marginTop:2 }}>Procura ajuda médica imediata.</div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {(() => { const ev = EVIDENCE[soap.evidence_level]; return (
                      <span style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:ev.color, background:ev.bg, padding:'3px 10px', borderRadius:20, border:`1px solid ${ev.color}30` }}>
                        {ev.label}
                      </span>
                    )})()}
                  </div>
                </div>
              )
            })()}

            {/* SOAP card */}
            <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', marginBottom:14 }}>
              <div style={{ padding:'14px 18px', background:'#0f172a', display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>🩺</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'white' }}>Avaliação Farmacêutica — Phlox Oracle</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontFamily:'var(--font-mono)' }}>
                    {new Date().toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' })}
                    {mode === 'clinical' ? ' · Formato clínico SOAP + PCNE' : ' · Linguagem acessível'}
                  </div>
                </div>
              </div>

              {[
                { key:'S', label:'Subjetivo', content:soap.subjective,  color:'#7c3aed', bg:'#faf5ff' },
                { key:'O', label:'Objetivo',  content:soap.objective,   color:'#1d4ed8', bg:'#eff6ff' },
                { key:'A', label:'Avaliação', content:soap.assessment,  color:'#0f172a', bg:'white'   },
              ].map(section => (
                <div key={section.key} style={{ padding:'16px 18px', borderBottom:'1px solid var(--bg-3)', background:section.bg }}>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    <div style={{ width:28, height:28, borderRadius:6, background:section.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'white', fontFamily:'var(--font-mono)' }}>{section.key}</span>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:section.color, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:5 }}>{section.label}</div>
                      <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.7 }}>{section.content}</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Plan */}
              <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--bg-3)', background:'#f0fdf4' }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:'#0d6e42', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'white', fontFamily:'var(--font-mono)' }}>P</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#0d6e42', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>Plano</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                      {soap.plan.map((item, i) => (
                        <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                          <div style={{ width:22, height:22, borderRadius:'50%', background:'#0d6e42', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:'white', fontFamily:'var(--font-mono)', marginTop:1 }}>{i+1}</div>
                          <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.6 }}>{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Monitoring + warning */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid var(--bg-3)' }}>
                <div style={{ padding:'14px 18px', borderRight:'1px solid var(--bg-3)' }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:6 }}>Monitorização</div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', lineHeight:1.5 }}>{soap.monitoring}</div>
                </div>
                <div style={{ padding:'14px 18px', background:'#fff7ed' }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#d97706', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:6 }}>Sinais de alerta</div>
                  <div style={{ fontSize:12, color:'#92400e', lineHeight:1.5 }}>{soap.when_to_seek_help}</div>
                </div>
              </div>

              {/* PCNE block (clinical mode) */}
              {mode === 'clinical' && (soap.pcne_problem || soap.pcne_cause || soap.pcne_intervention) && (
                <div style={{ padding:'14px 18px', background:'#f8fafc', borderBottom:'1px solid var(--bg-3)' }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-5)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:700, marginBottom:8 }}>PCNE v9.1</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {soap.pcne_problem && <div style={{ fontSize:12, color:'var(--ink-3)' }}><span style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'#dc2626' }}>P</span> {soap.pcne_problem}</div>}
                    {soap.pcne_cause   && <div style={{ fontSize:12, color:'var(--ink-3)' }}><span style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'#d97706' }}>C</span> {soap.pcne_cause}</div>}
                    {soap.pcne_intervention && <div style={{ fontSize:12, color:'var(--ink-3)' }}><span style={{ fontWeight:700, fontFamily:'var(--font-mono)', color:'#0d6e42' }}>I</span> {soap.pcne_intervention}</div>}
                  </div>
                </div>
              )}

              {/* Footer disclaimer */}
              <div style={{ padding:'12px 18px', fontSize:10, color:'var(--ink-5)', fontFamily:'var(--font-mono)', lineHeight:1.5 }}>
                {EVIDENCE[soap.evidence_level].label} · {EVIDENCE[soap.evidence_level].note} · Esta avaliação é gerada por IA e não substitui uma consulta presencial com um profissional de saúde.
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={copySOAP}
                style={{ flex:1, padding:'12px', background: copied ? '#d1fae5' : 'white', color: copied ? '#065f46' : 'var(--ink)', border:`1px solid ${copied ? '#6ee7b7' : 'var(--border)'}`, borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s' }}>
                {copied ? '✓ Copiado' : '📋 Copiar SOAP'}
              </button>
              <button onClick={() => window.print()}
                style={{ flex:1, padding:'12px', background:'white', color:'var(--ink)', border:'1px solid var(--border)', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🖨️ Imprimir
              </button>
              <button onClick={reset}
                style={{ flex:1, padding:'12px', background:'#0f172a', color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                → Nova consulta
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media print {
          .no-print { display: none !important }
        }
      `}</style>
    </div>
  )
}
