'use client'

// ─── NOVO: app/consulta/page.tsx ─── Phlox Consulta
// O copiloto de consulta bidirecional.
// Loop completo: Antes → Briefing para médico → Depois.
// Não existe nada assim em Portugal nem no mundo fora de EHRs hospitalares.

import { useState, useEffect, useCallback } from 'react'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'before' | 'briefing' | 'after' | 'summary'

interface ConsultRecord {
  id: string
  date: string
  doctor: string
  specialty: string
  phase: Phase
  before_answers: BeforeAnswers
  briefing: DoctorBriefing | null
  after_answers: AfterAnswers | null
  summary: ConsultSummary | null
  profile_name: string
  meds: string[]
}

interface BeforeAnswers {
  feeling_since_last: string       // como te sentiste desde a última consulta
  main_concern: string             // principal preocupação para esta consulta
  symptoms: string[]               // sintomas que notaste
  medication_questions: string     // dúvidas sobre medicação
  other_context: string            // outros contextos relevantes
}

interface DoctorBriefing {
  patient_summary: string          // 1 frase sobre quem é o doente
  since_last_consult: string       // o que aconteceu desde a última consulta
  main_concern: string             // principal preocupação de hoje
  medication_alerts: { drug: string; concern: string; severity: 'alta' | 'media' | 'baixa' }[]
  questions_prioritised: { question: string; clinical_context: string }[]
  labs_suggested: string[]
  flag_for_physician: string | null  // alerta importante para o médico
}

interface AfterAnswers {
  changes_made: string             // o que o médico alterou
  new_medications: string          // novos medicamentos
  stopped_medications: string      // medicamentos parados
  exams_requested: string          // exames pedidos
  next_consult: string             // quando é a próxima
  patient_understanding: number    // 1-5: percebi bem?
  additional_notes: string
}

interface ConsultSummary {
  what_changed: string[]           // o que mudou nesta consulta
  action_plan: { action: string; by_when: string; who: string }[]
  updated_medication_notes: string
  follow_up_reminders: string[]
  generate_care_plan: boolean      // se deve gerar um Care Plan com as novas meds
}

// ─── Symptom options ──────────────────────────────────────────────────────────

const COMMON_SYMPTOMS = [
  'Fadiga', 'Tonturas', 'Dor de cabeça', 'Náuseas', 'Dores musculares',
  'Falta de ar', 'Palpitações', 'Edema nos pés', 'Dores abdominais',
  'Insónia', 'Ansiedade', 'Alterações do apetite', 'Obstipação', 'Diarreia',
]

const SPECIALTY_OPTIONS = [
  'Médico de Família', 'Cardiologista', 'Endocrinologista', 'Internista',
  'Neurologista', 'Pneumologista', 'Nefrologista', 'Reumatologista',
  'Farmacêutico', 'Outro',
]

// ─── Phase indicator ──────────────────────────────────────────────────────────

function PhaseBar({ phase }: { phase: Phase }) {
  const phases: { id: Phase; label: string; icon: string }[] = [
    { id: 'before',   label: 'Antes',    icon: '📝' },
    { id: 'briefing', label: 'Briefing', icon: '🏥' },
    { id: 'after',    label: 'Depois',   icon: '✅' },
    { id: 'summary',  label: 'Resumo',   icon: '📋' },
  ]
  const activeIdx = phases.findIndex(p => p.id === phase)
  return (
    <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {phases.map((p, i) => {
        const done = i < activeIdx
        const active = p.id === phase
        return (
          <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', background: active ? 'var(--ink)' : done ? '#d1fae5' : 'transparent', borderRight: i < phases.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.2s' }}>
            <span style={{ fontSize: 16, marginBottom: 3 }}>{done ? '✓' : p.icon}</span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: active ? 'white' : done ? '#0d6e42' : 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>{p.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Before phase ─────────────────────────────────────────────────────────────

function BeforePhase({ meds, onSubmit }: { meds: string[]; onSubmit: (a: BeforeAnswers) => void }) {
  const [answers, setAnswers] = useState<BeforeAnswers>({
    feeling_since_last: '', main_concern: '', symptoms: [],
    medication_questions: '', other_context: '',
  })
  const set = (k: keyof BeforeAnswers, v: any) => setAnswers(p => ({ ...p, [k]: v }))
  const toggleSymptom = (s: string) =>
    set('symptoms', answers.symptoms.includes(s) ? answers.symptoms.filter(x => x !== s) : [...answers.symptoms, s])

  const canSubmit = answers.feeling_since_last.trim() && answers.main_concern.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#1d4ed8', lineHeight: 1.6 }}>
        💡 Responde a estas perguntas antes da consulta. Com base nas tuas respostas, o Phlox vai gerar um briefing de 30 segundos que o médico pode ler antes de entrar na sala.
      </div>

      {/* Q1 */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Como te sentiste desde a última consulta? *
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>Inclui como está a medicação a correr, se notaste melhorias ou pioras.</div>
        <textarea value={answers.feeling_since_last} onChange={e => set('feeling_since_last', e.target.value)}
          placeholder="Ex: A tensão está mais controlada mas noto tonturas de manhã quando me levanto. O colesterol da última análise estava mais alto."
          rows={3} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {/* Q2 */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Qual é a tua principal preocupação hoje? *
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>O que mais queres discutir com o médico.</div>
        <textarea value={answers.main_concern} onChange={e => set('main_concern', e.target.value)}
          placeholder="Ex: Gostava de perceber se posso reduzir algum medicamento. Tenho dificuldade em dormir e não sei se é efeito adverso."
          rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {/* Q3 — Symptoms */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Sintomas que notaste
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>Selecciona os que sentiste desde a última consulta.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COMMON_SYMPTOMS.map(s => (
            <button key={s} onClick={() => toggleSymptom(s)}
              style={{ padding: '6px 12px', border: `1.5px solid ${answers.symptoms.includes(s) ? '#b45309' : 'var(--border)'}`, borderRadius: 20, background: answers.symptoms.includes(s) ? '#fffbeb' : 'white', color: answers.symptoms.includes(s) ? '#b45309' : 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontWeight: answers.symptoms.includes(s) ? 700 : 400, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
              {s}
            </button>
          ))}
        </div>
        {answers.symptoms.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#b45309', fontFamily: 'var(--font-mono)' }}>
            {answers.symptoms.length} sintoma{answers.symptoms.length !== 1 ? 's' : ''} seleccionado{answers.symptoms.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Q4 */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Dúvidas sobre a medicação
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 10 }}>Qualquer pergunta sobre os teus medicamentos actuais.</div>
        <textarea value={answers.medication_questions} onChange={e => set('medication_questions', e.target.value)}
          placeholder="Ex: Posso parar o omeprazol? Vi que o Xarelto tem alternativa mais barata. Preciso mesmo de tomar os dois antihipertensores?"
          rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {/* Q5 */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          Algo mais que o médico deva saber?
        </div>
        <textarea value={answers.other_context} onChange={e => set('other_context', e.target.value)}
          placeholder="Ex: Fui a outra especialidade e receitaram-me algo novo. Tive uma queda. Fiz análises recentemente."
          rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 13px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      <button onClick={() => onSubmit(answers)} disabled={!canSubmit}
        style={{ padding: '14px', background: canSubmit ? 'var(--ink)' : 'var(--bg-3)', color: canSubmit ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
        Gerar briefing para o médico →
      </button>
    </div>
  )
}

// ─── Briefing display (doctor-facing) ─────────────────────────────────────────

function BriefingDisplay({ briefing, onContinue }: { briefing: DoctorBriefing; onContinue: () => void }) {
  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>Briefing de Consulta</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px;line-height:1.6;color:#111}h1{font-size:18px;font-family:Georgia,serif;font-weight:400}h2{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#888;font-family:monospace;margin:14px 0 6px}p{margin:0 0 6px}.badge{display:inline-block;font-size:9px;font-family:monospace;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:.06em;text-transform:uppercase}.red{background:#fee2e2;color:#991b1b}.yellow{background:#fef9c3;color:#854d0e}.green{background:#d1fae5;color:#065f46}ul{padding-left:16px;margin:0}li{margin-bottom:4px}.flag{background:#fee2e2;border-left:4px solid #dc2626;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:12px}</style></head><body>
    <p style="font-size:10px;font-family:monospace;color:#888;margin-bottom:6px">BRIEFING DE CONSULTA · Gerado pelo Phlox Clinical · ${new Date().toLocaleDateString('pt-PT')}</p>
    <h1>${briefing.patient_summary}</h1>
    ${briefing.flag_for_physician ? `<div class="flag"><strong>⚠️ Atenção do médico:</strong> ${briefing.flag_for_physician}</div>` : ''}
    <h2>Desde a última consulta</h2><p>${briefing.since_last_consult}</p>
    <h2>Preocupação principal hoje</h2><p>${briefing.main_concern}</p>
    ${briefing.medication_alerts.length ? `<h2>Alertas de medicação</h2>${briefing.medication_alerts.map(a => `<p><span class="badge ${a.severity === 'alta' ? 'red' : a.severity === 'media' ? 'yellow' : 'green'}">${a.severity}</span> ${a.drug}: ${a.concern}</p>`).join('')}` : ''}
    <h2>Questões do doente (por prioridade)</h2><ul>${briefing.questions_prioritised.map(q => `<li><strong>${q.question}</strong><br><small>${q.clinical_context}</small></li>`).join('')}</ul>
    ${briefing.labs_suggested.length ? `<h2>Análises a considerar</h2><ul>${briefing.labs_suggested.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
          Briefing de consulta · Para o médico
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#f8fafc', fontWeight: 400, marginBottom: 8 }}>
          {briefing.patient_summary}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint}
            style={{ padding: '8px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            🖨 Imprimir / Mostrar ao médico
          </button>
          <button onClick={() => navigator.clipboard?.writeText(`Briefing de consulta:\n\n${briefing.patient_summary}\n\n${briefing.since_last_consult}\n\nPreocupação: ${briefing.main_concern}`)}
            style={{ padding: '8px 16px', background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            📋 Copiar texto
          </button>
        </div>
      </div>

      {/* Flag para médico */}
      {briefing.flag_for_physician && (
        <div style={{ padding: '14px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>⚠️ Atenção do médico</div>
          <div style={{ fontSize: 13, color: '#991b1b', lineHeight: 1.6 }}>{briefing.flag_for_physician}</div>
        </div>
      )}

      {/* Desde a última consulta */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Desde a última consulta</div>
        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{briefing.since_last_consult}</div>
      </div>

      {/* Preocupação + alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px),1fr))', gap: 10 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Preocupação principal</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{briefing.main_concern}</div>
        </div>

        {briefing.medication_alerts.length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Alertas de medicação</div>
            {briefing.medication_alerts.map((a, i) => {
              const s = a.severity === 'alta' ? { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' } : a.severity === 'media' ? { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' } : { bg: '#f0fdf5', color: '#0d6e42', border: '#bbf7d0' }
              return (
                <div key={i} style={{ padding: '8px 10px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 2 }}>{a.drug}</div>
                  <div style={{ fontSize: 12, color: s.color, opacity: 0.85 }}>{a.concern}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Questões do doente */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Questões do doente — por prioridade clínica</div>
        {briefing.questions_prioritised.map((q, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < briefing.questions_prioritised.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{q.question}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{q.clinical_context}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Análises sugeridas */}
      {briefing.labs_suggested.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Análises a considerar pedir</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {briefing.labs_suggested.map((lab, i) => (
              <span key={i} style={{ fontSize: 12, padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, color: '#1d4ed8', fontFamily: 'var(--font-mono)' }}>{lab}</span>
            ))}
          </div>
        </div>
      )}

      {/* CTA after briefing */}
      <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-2)', marginBottom: 3 }}>Consulta realizada?</div>
          <div style={{ fontSize: 12, color: 'var(--green-2)', opacity: 0.8 }}>Regista o que mudou para o Phlox actualizar o teu plano de cuidado.</div>
        </div>
        <button onClick={onContinue}
          style={{ padding: '11px 20px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          Registar o que mudou →
        </button>
      </div>
    </div>
  )
}

// ─── After phase ──────────────────────────────────────────────────────────────

function AfterPhase({ onSubmit }: { onSubmit: (a: AfterAnswers) => void }) {
  const [answers, setAnswers] = useState<AfterAnswers>({
    changes_made: '', new_medications: '', stopped_medications: '',
    exams_requested: '', next_consult: '', patient_understanding: 4, additional_notes: '',
  })
  const set = (k: keyof AfterAnswers, v: any) => setAnswers(p => ({ ...p, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
        ✅ Ótimo! Regista o que aconteceu na consulta para actualizar o teu plano de cuidado automaticamente.
      </div>

      {[
        ['O que o médico alterou / principais conclusões', 'changes_made', 'Ex: Aumentou a dose do ramipril para 10mg. Disse que devo perder peso. Suspeita de síndrome da apneia do sono.', 3],
        ['Novos medicamentos receitados', 'new_medications', 'Ex: Esomeprazol 40mg 1x/dia, Vitamina D 800 UI/dia', 2],
        ['Medicamentos que parou', 'stopped_medications', 'Ex: Parou o Ibuprofeno — incompatível com o Xarelto', 2],
        ['Exames / análises pedidos', 'exams_requested', 'Ex: Análises em 3 meses (hemograma, função renal), ecografia abdominal', 2],
        ['Próxima consulta', 'next_consult', 'Ex: Daqui a 3 meses, ou se surgirem sintomas antes', 1],
      ].map(([label, key, placeholder, rows]) => (
        <div key={key as string} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{label as string}</div>
          <textarea value={answers[key as keyof AfterAnswers] as string} onChange={e => set(key as keyof AfterAnswers, e.target.value)}
            placeholder={placeholder as string} rows={rows as number}
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
        </div>
      ))}

      {/* Understanding */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Senti que percebi bem o que foi explicado?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} onClick={() => set('patient_understanding', v)}
              style={{ flex: 1, padding: '10px 4px', border: `1.5px solid ${answers.patient_understanding === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: answers.patient_understanding === v ? 'var(--green-light)' : 'white', cursor: 'pointer', fontSize: 20, fontFamily: 'var(--font-sans)' }}>
              {['😕', '😐', '🙂', '😊', '🤩'][v - 1]}
            </button>
          ))}
        </div>
        {answers.patient_understanding <= 2 && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', fontFamily: 'var(--font-mono)' }}>
            O Phlox vai simplificar as explicações no resumo final.
          </div>
        )}
      </div>

      <button onClick={() => onSubmit(answers)}
        style={{ padding: '14px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
        Gerar resumo da consulta →
      </button>
    </div>
  )
}

// ─── Summary display ──────────────────────────────────────────────────────────

function SummaryDisplay({ summary, consult }: { summary: ConsultSummary; consult: ConsultRecord }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Resumo da consulta</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#f8fafc', fontWeight: 400 }}>
          {consult.doctor} · {new Date(consult.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* O que mudou */}
      {summary.what_changed.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>O que mudou nesta consulta</div>
          {summary.what_changed.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--green)', fontSize: 13, flexShrink: 0 }}>→</span>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{item}</div>
            </div>
          ))}
        </div>
      )}

      {/* Plano de acção */}
      {summary.action_plan.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plano de acção</div>
          </div>
          {summary.action_plan.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px', borderBottom: i < summary.action_plan.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{item.action}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{item.who}</div>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                {item.by_when}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Follow-up reminders */}
      {summary.follow_up_reminders.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>📅 Lembretes de acompanhamento</div>
          {summary.follow_up_reminders.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#b45309', flexShrink: 0 }}>·</span>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{r}</div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Care Plan CTA */}
      {summary.generate_care_plan && (
        <Link href="/plano" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', background: 'var(--ink)', borderRadius: 10, textDecoration: 'none', gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 3 }}>Gerar novo Care Plan com a medicação actualizada</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>A medicação mudou nesta consulta — actualiza o teu plano de cuidado.</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      )}

      <button onClick={() => window.location.href = '/consulta'}
        style={{ padding: '12px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
        + Registar nova consulta
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConsultaPage() {
  const { user, supabase } = useAuth()
  const [phase, setPhase] = useState<Phase>('setup')
  const [doctor, setDoctor] = useState('')
  const [specialty, setSpecialty] = useState('Médico de Família')
  const [consultDate, setConsultDate] = useState(new Date().toISOString().split('T')[0])
  const [profileName, setProfileName] = useState('')
  const [meds, setMeds] = useState<string[]>([])
  const [conditions, setConditions] = useState('')
  const [briefing, setBriefing] = useState<DoctorBriefing | null>(null)
  const [summary, setSummary] = useState<ConsultSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentRecord, setCurrentRecord] = useState<Partial<ConsultRecord>>({})

  const plan = (user?.plan || 'free') as string
  const canUse = plan !== 'free'

  const handleProfile = async (p: any) => {
    setProfileName(p.name || '')
    if (!supabase) return
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const id    = p.id === 'self' ? user?.id : p.id
    const { data } = await supabase.from(table).select('name, dose, frequency').eq(col, id)
    if (data) setMeds(data.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}`))
    if (p.conditions) setConditions(p.conditions)
  }

  const generateBriefing = async (answers: BeforeAnswers) => {
    setLoading(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/consulta/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ answers, meds, conditions, doctor, specialty, patient_name: profileName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBriefing(data)
      setCurrentRecord(prev => ({ ...prev, before_answers: answers, briefing: data }))
      setPhase('briefing')
    } catch (e: any) { setError(e.message || 'Erro.') }
    finally { setLoading(false) }
  }

  const generateSummary = async (afterAnswers: AfterAnswers) => {
    setLoading(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/consulta/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ after_answers: afterAnswers, briefing, patient_name: profileName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummary(data)
      setPhase('summary')

      // Save to Supabase
      if (user) {
        const { error: insertError } = await supabase.from('consult_records').insert({
          user_id: user.id,
          date: consultDate, doctor, specialty,
          before_answers: currentRecord.before_answers,
          briefing, after_answers: afterAnswers, summary: data,
          profile_name: profileName,
        })

        if (insertError) {
          console.error('Failed to save consult record', insertError)
        }
      }
    } catch (e: any) { setError(e.message || 'Erro.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Phlox Consulta</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em' }}>Copiloto de Consulta</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 540 }}>
            Antes: preparas-te e o Phlox gera um briefing que o médico lê em 30 segundos. Depois: registas o que mudou e o Phlox actualiza o teu plano de cuidado.
          </p>
        </div>

        {!canUse ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🏥</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 12 }}>Phlox Consulta</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
              O loop completo de consulta — briefing para o médico, registo do que mudou, e actualização automática do plano de cuidado. Disponível no plano Student.
            </p>
            <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
              Ver planos →
            </Link>
          </div>
        ) : (
          <>
            {/* Setup */}
            {phase === 'setup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {user && <ProfileSelector onChange={handleProfile} />}

                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,200px),1fr))', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Data da consulta</div>
                      <input type="date" value={consultDate} onChange={e => setConsultDate(e.target.value)}
                        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Médico / Especialista</div>
                      <input value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Ex: Dra. Silva"
                        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Especialidade</div>
                      <select value={specialty} onChange={e => setSpecialty(e.target.value)}
                        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}>
                        {SPECIALTY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <PhaseBar phase="before" />

                <button onClick={() => setPhase('before')}
                  style={{ padding: '14px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  Começar preparação →
                </button>
              </div>
            )}

            {phase === 'before' && (
              <>
                <PhaseBar phase="before" />
                <div style={{ marginTop: 16 }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '56px 0' }}>
                      <div style={{ width: 40, height: 40, border: '3px solid var(--bg-3)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>A gerar briefing para o médico...</div>
                    </div>
                  ) : <BeforePhase meds={meds} onSubmit={generateBriefing} />}
                  {error && <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
                </div>
              </>
            )}

            {phase === 'briefing' && briefing && (
              <>
                <PhaseBar phase="briefing" />
                <div style={{ marginTop: 16 }}>
                  <BriefingDisplay briefing={briefing} onContinue={() => setPhase('after')} />
                </div>
              </>
            )}

            {phase === 'after' && (
              <>
                <PhaseBar phase="after" />
                <div style={{ marginTop: 16 }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '56px 0' }}>
                      <div style={{ width: 40, height: 40, border: '3px solid var(--bg-3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>A gerar resumo da consulta...</div>
                    </div>
                  ) : <AfterPhase onSubmit={generateSummary} />}
                  {error && <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
                </div>
              </>
            )}

            {phase === 'summary' && summary && (
              <>
                <PhaseBar phase="summary" />
                <div style={{ marginTop: 16 }}>
                  <SummaryDisplay summary={summary} consult={currentRecord as ConsultRecord} />
                </div>
              </>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}