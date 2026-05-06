'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Domínios de casos — todos os cursos de saúde ─────────────────────────────
const DOMAINS = [
  { id: 'farmacologia',       label: 'Farmacologia Clínica', icon: '💊', color: '#0d6e42' },
  { id: 'medicina_interna',   label: 'Medicina Interna',     icon: '🫀', color: '#dc2626' },
  { id: 'emergencia',         label: 'Emergência',           icon: '🚨', color: '#b45309' },
  { id: 'cirurgia',           label: 'Cirurgia',             icon: '🔪', color: '#1d4ed8' },
  { id: 'pediatria',          label: 'Pediatria',            icon: '👶', color: '#7c3aed' },
  { id: 'gineco_obstetricia', label: 'Gineco-Obstetrícia',   icon: '🤰', color: '#be185d' },
  { id: 'enfermagem',         label: 'Enfermagem',           icon: '💉', color: '#0f766e' },
  { id: 'nutricao',           label: 'Nutrição Clínica',     icon: '🥗', color: '#65a30d' },
]

const EXAMPLES: Record<string, { label: string; prompt: string }[]> = {
  farmacologia: [
    { label: 'FA + DRC + Risco Hemorrágico', prompt: 'Homem 72 anos, FA permanente, HTA, DRC G3 (TFG 38), INR lábil, história de úlcera péptica. Qual a estratégia de anticoagulação?' },
    { label: 'Antibioterapia em Alérgico', prompt: 'Mulher 34 anos, alérgica a penicilinas (rash), pneumonia comunitária moderada. Antibioterapia empírica?' },
    { label: 'DM2 + IC + DRC', prompt: 'Homem 65 anos, DM2, IC com FE reduzida (FEVE 35%), DRC G3b. Que antidiabético escolher?' },
    { label: 'Dor crónica no Idoso', prompt: 'Mulher 80 anos, osteoartrose bilateral, insuficiência renal ligeira, anticoagulada com varfarina. Opções analgésicas?' },
    { label: 'HTA Resistente', prompt: 'Homem 58 anos, HTA resistente sob 3 fármacos a doses máximas, K 3.2. Próximo passo terapêutico?' },
  ],
  medicina_interna: [
    { label: 'Dispneia aguda na urgência', prompt: 'Homem 68 anos com dispneia progressiva há 3 dias, ortopneia, edemas nos MI, SpO2 89%. BNP 1200. Como abordar?' },
    { label: 'Síncope no jovem', prompt: 'Rapaz 22 anos, síncope durante exercício físico, sem pródromos, QT prolongado no ECG. Diagnóstico diferencial e abordagem?' },
    { label: 'Febre + adenopatias', prompt: 'Mulher 28 anos, febre vespertina há 6 semanas, perda ponderal 8kg, adenopatias cervicais bilaterais, suores nocturnos. Workup?' },
  ],
  emergencia: [
    { label: 'PCR em FV refractária', prompt: 'Doente em PCR por FV refractária após 3 desfibrilhações. 5 minutos de RCP em curso. Próximos passos segundo ACLS?' },
    { label: 'Choque séptico', prompt: 'Mulher 55 anos, TA 80/50, FC 128, febre 39.5°C, leucocitose 22000, lactato 4.2. Abordagem inicial segundo Surviving Sepsis?' },
    { label: 'AVC na janela terapêutica', prompt: 'Homem 60 anos, défice neurológico focal de instalação súbita há 2h30. TC sem hemorragia. Critérios de fibrinólise e abordagem?' },
  ],
  cirurgia: [
    { label: 'Abdómen agudo', prompt: 'Mulher 45 anos, dor abdominal em fossa ilíaca direita há 18h, náuseas, febre 38.2°C, Blumberg positivo, leucocitose. Abordagem cirúrgica?' },
    { label: 'Gestão peri-op de anticoagulante', prompt: 'Doente anticoagulado com rivaroxabano por FA, programado para colecistectomia laparoscópica. Como gerir a anticoagulação?' },
  ],
  pediatria: [
    { label: 'Febre no lactente', prompt: 'Lactente 6 semanas, febre 38.5°C axilar, sem foco aparente, bom estado geral. Abordagem e critérios de internamento?' },
    { label: 'Criança com convulsão', prompt: 'Criança 3 anos, convulsão tónico-clónica generalizada há 4 minutos no contexto de febre 39.8°C. Abordagem aguda e chronic?' },
    { label: 'Asma pediátrica grave', prompt: 'Criança 8 anos, crise asmática grave, SpO2 88%, sem resposta a 3 nebulizações com salbutamol. Próximos passos?' },
  ],
  gineco_obstetricia: [
    { label: 'Pré-eclâmpsia grave', prompt: 'Grávida 32 semanas, TA 165/110, proteinúria 3+, cefaleia intensa, edemas faciais. Diagnóstico e abordagem imediata?' },
    { label: 'Hemorragia pós-parto', prompt: 'Puérpera com hemorragia pós-parto imediata, perda estimada 800mL, útero hipotónico. Algoritmo de actuação?' },
  ],
  enfermagem: [
    { label: 'Extravasão de citostático', prompt: 'Doente com extravasão de doxorrubicina durante perfusão IV. Quais os passos imediatos e cuidados à ferida?' },
    { label: 'Delirium no idoso hospitalizado', prompt: 'Idoso 78 anos, cirurgia ontem, agitação nocturna, desorientação. Avaliação de enfermagem e intervenções não farmacológicas?' },
  ],
  nutricao: [
    { label: 'Desnutrição grave no internamento', prompt: 'Doente 70 anos, IMC 16, albumina 2.1, internado por pneumonia. Como calcular necessidades e iniciar suporte nutricional?' },
    { label: 'Dieta na DRC avançada', prompt: 'Doente com DRC G4, K 5.8, P 6.2, proteinúria. Como adaptar a dieta e que restrições são prioritárias?' },
  ],
}

type Stage = 'setup' | 'presentation' | 'differential' | 'decision' | 'outcome'

function UpgradeGate({ plan }: { plan: string }) {
  if (plan === 'student' || plan === 'pro' || plan === 'clinic') return null
  return (
    <div style={{ background:'white', border:'2px solid var(--green)', borderRadius:10, padding:'48px 32px', textAlign:'center', maxWidth:500, margin:'0 auto' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🏥</div>
      <h2 style={{ fontFamily:'var(--font-serif)', fontSize:24, color:'var(--ink)', marginBottom:12, letterSpacing:'-0.01em' }}>Casos Clínicos Interactivos</h2>
      <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.7, marginBottom:24, maxWidth:380, margin:'0 auto 24px' }}>
        Casos de todas as áreas da saúde. Farmacologia, Medicina Interna, Emergência, Cirurgia, Pediatria e mais. Com diagnóstico diferencial guiado e feedback detalhado.
      </p>
      <Link href="/pricing" style={{ background:'var(--green)', color:'white', textDecoration:'none', padding:'12px 28px', borderRadius:8, fontSize:14, fontWeight:700 }}>
        Ver plano Student →
      </Link>
    </div>
  )
}

export default function CasesPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS[0])
  const [customCase, setCustomCase] = useState('')
  const [caseData, setCaseData] = useState<any>(null)
  const [stage, setStage] = useState<Stage>('setup')
  const [selectedDx, setSelectedDx] = useState<string|null>(null)
  const [selectedTx, setSelectedTx] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (prompt?: string) => {
    const text = (prompt || customCase).trim()
    if (!text) return
    setLoading(true); setError(''); setCaseData(null); setSelectedDx(null); setSelectedTx(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ prompt: text, domain: selectedDomain.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCaseData(data)
      setStage('presentation')
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const examples = EXAMPLES[selectedDomain.id] || EXAMPLES.farmacologia

  const SEV: Record<string, { bg: string; color: string; border: string }> = {
    correcto: { bg:'#d1fae5', color:'#065f46', border:'#6ee7b7' },
    parcial:  { bg:'#fef9c3', color:'#854d0e', border:'#fde68a' },
    errado:   { bg:'#fee2e2', color:'#991b1b', border:'#fca5a5' },
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--ink-4)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8 }}>Casos Clínicos · Student</div>
          <h1 style={{ fontFamily:'var(--font-serif)', fontSize:'clamp(22px,3vw,30px)', color:'var(--ink)', fontWeight:400, marginBottom:8 }}>Casos Clínicos Interactivos</h1>
          <p style={{ fontSize:14, color:'var(--ink-3)', lineHeight:1.6, maxWidth:540 }}>Raciocínio clínico guiado em todas as áreas da saúde. Apresentação do caso, diagnóstico diferencial, decisão terapêutica e feedback detalhado.</p>
        </div>

        <UpgradeGate plan={plan} />

        {(plan === 'student' || plan === 'pro' || plan === 'clinic') && (
          <>
            {/* Domain selector */}
            {stage === 'setup' && (
              <>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Área clínica</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {DOMAINS.map(d => (
                      <button key={d.id} onClick={() => setSelectedDomain(d)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:`1.5px solid ${selectedDomain.id===d.id?d.color:'var(--border)'}`, borderRadius:20, background:selectedDomain.id===d.id?d.color:'white', color:selectedDomain.id===d.id?'white':'var(--ink-3)', cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'var(--font-sans)', transition:'all 0.15s' }}>
                        <span>{d.icon}</span>{d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Examples */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>
                    Casos de {selectedDomain.label}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {examples.map(ex => (
                      <button key={ex.label} onClick={() => { setCustomCase(ex.prompt); generate(ex.prompt) }}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'white', border:`1px solid ${selectedDomain.color}30`, borderRadius:10, cursor:'pointer', textAlign:'left', gap:12, transition:'all 0.15s' }}
                        className="case-btn">
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--ink)', marginBottom:3 }}>{ex.label}</div>
                          <div style={{ fontSize:12, color:'var(--ink-4)', lineHeight:1.5 }}>{ex.prompt.slice(0, 90)}...</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={selectedDomain.color} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom case */}
                <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:16 }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Ou escreve o teu próprio caso</div>
                  <textarea value={customCase} onChange={e => setCustomCase(e.target.value)}
                    placeholder="Descreve o doente, os dados clínicos, e a questão que queres explorar..."
                    rows={4}
                    style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'12px 14px', fontSize:13, fontFamily:'var(--font-sans)', outline:'none', resize:'vertical', lineHeight:1.6, marginBottom:10 }} />
                  <button onClick={() => generate()} disabled={!customCase.trim() || loading}
                    style={{ width:'100%', background:customCase.trim()?selectedDomain.color:'var(--bg-3)', color:customCase.trim()?'white':'var(--ink-5)', border:'none', borderRadius:8, padding:'12px', fontSize:14, fontWeight:700, cursor:customCase.trim()?'pointer':'not-allowed', fontFamily:'var(--font-sans)' }}>
                    {loading ? 'A gerar caso...' : 'Gerar caso clínico →'}
                  </button>
                </div>
              </>
            )}

            {error && <div style={{ padding:'12px 16px', background:'var(--red-light)', border:'1px solid #fca5a5', borderRadius:8, fontSize:13, color:'var(--red)', marginTop:14 }}>{error}</div>}

            {loading && (
              <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'56px 24px', textAlign:'center', marginTop:14 }}>
                <div style={{ width:32, height:32, border:`3px solid ${selectedDomain.color}30`, borderTop:`3px solid ${selectedDomain.color}`, borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }} />
                <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--ink-4)' }}>A construir caso clínico de {selectedDomain.label}...</div>
              </div>
            )}

            {/* Case stages */}
            {caseData && !loading && (
              <div style={{ marginTop:14 }}>
                <button onClick={() => { setStage('setup'); setCaseData(null) }}
                  style={{ background:'none', border:'none', fontSize:13, color:'var(--ink-4)', cursor:'pointer', fontFamily:'var(--font-sans)', padding:0, marginBottom:16, display:'flex', alignItems:'center', gap:4 }}>
                  ← Novo caso
                </button>

                {/* Stage progress */}
                <div style={{ display:'flex', gap:4, marginBottom:20 }}>
                  {['Apresentação','Diagnóstico','Tratamento','Resultado'].map((s, i) => {
                    const stageIndex = ['presentation','differential','decision','outcome'].indexOf(stage)
                    const done = i < stageIndex
                    const active = i === stageIndex
                    return (
                      <div key={s} style={{ flex:1, height:3, borderRadius:2, background:done?selectedDomain.color:active?selectedDomain.color+'80':'var(--bg-3)', transition:'background 0.3s' }} />
                    )
                  })}
                </div>

                {/* PRESENTATION */}
                {stage === 'presentation' && (
                  <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                    <div style={{ background:selectedDomain.color, padding:'18px 22px' }}>
                      <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'rgba(255,255,255,0.6)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>Apresentação do Caso · {selectedDomain.label}</div>
                      <div style={{ fontFamily:'var(--font-serif)', fontSize:20, color:'white', fontWeight:400 }}>{caseData.title || 'Caso Clínico'}</div>
                    </div>
                    <div style={{ padding:22 }}>
                      <p style={{ fontSize:15, color:'var(--ink)', lineHeight:1.8, marginBottom:20 }}>{caseData.presentation}</p>
                      {caseData.vitals && Object.keys(caseData.vitals).length > 0 && (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8, marginBottom:20 }}>
                          {Object.entries(caseData.vitals).map(([k,v]) => (
                            <div key={k} style={{ background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px' }}>
                              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--ink-4)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{k}</div>
                              <div style={{ fontSize:15, fontWeight:700, color:'var(--ink)' }}>{v as string}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {caseData.question && (
                        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'14px 16px', marginBottom:20 }}>
                          <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'#1d4ed8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>Questão clínica</div>
                          <div style={{ fontSize:14, color:'#1d4ed8', lineHeight:1.6, fontWeight:600 }}>{caseData.question}</div>
                        </div>
                      )}
                      <button onClick={() => setStage('differential')}
                        style={{ width:'100%', background:selectedDomain.color, color:'white', border:'none', borderRadius:8, padding:'13px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                        Qual é o diagnóstico diferencial? →
                      </button>
                    </div>
                  </div>
                )}

                {/* DIFFERENTIAL */}
                {stage === 'differential' && caseData.differential_diagnosis && (
                  <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:22 }}>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>
                      Diagnóstico diferencial — selecciona o mais provável
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                      {caseData.differential_diagnosis.map((dx: any, i: number) => (
                        <button key={i} onClick={() => setSelectedDx(dx.diagnosis)}
                          style={{ padding:'13px 16px', border:`1.5px solid ${selectedDx===dx.diagnosis?selectedDomain.color:'var(--border)'}`, borderRadius:8, background:selectedDx===dx.diagnosis?`${selectedDomain.color}10`:'white', cursor:'pointer', textAlign:'left', transition:'all 0.15s', fontFamily:'var(--font-sans)' }}>
                          <div style={{ fontSize:14, fontWeight:700, color:selectedDx===dx.diagnosis?selectedDomain.color:'var(--ink)', marginBottom:3 }}>{dx.diagnosis}</div>
                          <div style={{ fontSize:12, color:'var(--ink-4)' }}>{dx.rationale}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStage('decision')} disabled={!selectedDx}
                      style={{ width:'100%', background:selectedDx?selectedDomain.color:'var(--bg-3)', color:selectedDx?'white':'var(--ink-5)', border:'none', borderRadius:8, padding:'13px', fontSize:14, fontWeight:700, cursor:selectedDx?'pointer':'not-allowed', fontFamily:'var(--font-sans)' }}>
                      Confirmar diagnóstico e ver opções terapêuticas →
                    </button>
                  </div>
                )}

                {/* DECISION */}
                {stage === 'decision' && caseData.treatment_options && (
                  <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:12, padding:22 }}>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ink)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>
                      Abordagem terapêutica — selecciona a melhor opção
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                      {caseData.treatment_options.map((tx: any, i: number) => (
                        <button key={i} onClick={() => setSelectedTx(tx.option)}
                          style={{ padding:'13px 16px', border:`1.5px solid ${selectedTx===tx.option?selectedDomain.color:'var(--border)'}`, borderRadius:8, background:selectedTx===tx.option?`${selectedDomain.color}10`:'white', cursor:'pointer', textAlign:'left', transition:'all 0.15s', fontFamily:'var(--font-sans)' }}>
                          <div style={{ fontSize:14, fontWeight:700, color:selectedTx===tx.option?selectedDomain.color:'var(--ink)', marginBottom:3 }}>{tx.option}</div>
                          {tx.detail && <div style={{ fontSize:12, color:'var(--ink-4)' }}>{tx.detail}</div>}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStage('outcome')} disabled={!selectedTx}
                      style={{ width:'100%', background:selectedTx?selectedDomain.color:'var(--bg-3)', color:selectedTx?'white':'var(--ink-5)', border:'none', borderRadius:8, padding:'13px', fontSize:14, fontWeight:700, cursor:selectedTx?'pointer':'not-allowed', fontFamily:'var(--font-sans)' }}>
                      Ver resultado e feedback →
                    </button>
                  </div>
                )}

                {/* OUTCOME */}
                {stage === 'outcome' && caseData.outcome && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {/* Dx feedback */}
                    {caseData.outcome.diagnosis_feedback && (
                      <div style={{ padding:'16px 18px', background: selectedDx===caseData.outcome.correct_diagnosis?SEV.correcto.bg:SEV.parcial.bg, border:`1px solid ${selectedDx===caseData.outcome.correct_diagnosis?SEV.correcto.border:SEV.parcial.border}`, borderRadius:10 }}>
                        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:selectedDx===caseData.outcome.correct_diagnosis?SEV.correcto.color:SEV.parcial.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                          {selectedDx===caseData.outcome.correct_diagnosis ? '✓ Diagnóstico correcto' : `Diagnóstico: ${caseData.outcome.correct_diagnosis}`}
                        </div>
                        <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.7 }}>{caseData.outcome.diagnosis_feedback}</div>
                      </div>
                    )}
                    {/* Tx feedback */}
                    {caseData.outcome.treatment_feedback && (
                      <div style={{ padding:'16px 18px', background: caseData.outcome.best_treatment===selectedTx?SEV.correcto.bg:SEV.parcial.bg, border:`1px solid ${caseData.outcome.best_treatment===selectedTx?SEV.correcto.border:SEV.parcial.border}`, borderRadius:10 }}>
                        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:caseData.outcome.best_treatment===selectedTx?SEV.correcto.color:SEV.parcial.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                          {caseData.outcome.best_treatment===selectedTx ? '✓ Abordagem óptima' : `Abordagem recomendada: ${caseData.outcome.best_treatment}`}
                        </div>
                        <div style={{ fontSize:13, color:'var(--ink)', lineHeight:1.7 }}>{caseData.outcome.treatment_feedback}</div>
                      </div>
                    )}
                    {/* Learning points */}
                    {caseData.outcome.key_learning_points?.length > 0 && (
                      <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:10, padding:'18px' }}>
                        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:selectedDomain.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
                          💎 Pontos-chave a reter
                        </div>
                        {caseData.outcome.key_learning_points.map((point: string, i: number) => (
                          <div key={i} style={{ display:'flex', gap:10, marginBottom:8 }}>
                            <span style={{ color:selectedDomain.color, fontSize:13, flexShrink:0 }}>→</span>
                            <div style={{ fontSize:13, color:'var(--ink-2)', lineHeight:1.6 }}>{point}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setStage('setup'); setCaseData(null); setCustomCase('') }}
                      style={{ padding:'13px', background:selectedDomain.color, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                      Novo caso →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .case-btn:hover{background:var(--bg-2)!important;border-color:currentColor!important}`}</style>
    </div>
  )
}