'use client'

// app/escalas/page.tsx — Banco de Escalas Clínicas Validadas
// 30+ escalas para enfermagem, geriatria, psiquiatria, neurologia, cuidados paliativos
// Gratuito, sem login — ferramenta de aquisição viral para enfermeiros e médicos

import { useState } from 'react'
import Link from 'next/link'

type ScaleResult = { score: number; label: string; color: string; detail: string; action?: string }

// ─── PHQ-9 ────────────────────────────────────────────────────────────────────
function PHQ9() {
  const QUESTIONS = [
    'Pouco interesse ou prazer em fazer coisas',
    'Sentir-se em baixo, deprimido(a) ou sem esperança',
    'Dificuldade em adormecer, manter o sono, ou dormir demasiado',
    'Sentir-se cansado(a) ou com pouca energia',
    'Pouco apetite ou comer em excesso',
    'Sentir-se mal consigo próprio(a) — ou que é um fardo para os outros',
    'Dificuldade de concentração (leitura, TV, trabalho)',
    'Mover-se ou falar mais devagar que o habitual; ou estar irrequieto(a)/agitado(a)',
    'Pensamentos de que seria melhor estar morto(a) ou de se magoar',
  ]
  const OPTIONS = ['Nunca', 'Vários dias', 'Mais de metade dos dias', 'Quase todos os dias']
  const [answers, setAnswers] = useState<number[]>(Array(9).fill(-1))

  const score = answers.every(a => a >= 0) ? answers.reduce((s, a) => s + a, 0) : null
  const result = score === null ? null : score <= 4 ? { label: 'Sem depressão / Mínima', color: '#0d6e42', action: 'Sem tratamento indicado. Reavaliar se agravamento.' }
    : score <= 9 ? { label: 'Depressão leve', color: '#d97706', action: 'Vigilância. Considerar psicoeducação e apoio.' }
    : score <= 14 ? { label: 'Depressão moderada', color: '#b45309', action: 'Iniciar tratamento. Psicoterapia e/ou ISRS.' }
    : score <= 19 ? { label: 'Depressão moderada a grave', color: '#dc2626', action: 'Tratamento activo. Referenciação a psiquiatria.' }
    : { label: 'Depressão grave', color: '#7f1d1d', action: 'Tratamento urgente. Referenciação imediata a psiquiatria.' }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20, lineHeight: 1.6 }}>
        Nas últimas 2 semanas, com que frequência se sentiu incomodado(a) pelos seguintes problemas?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
        {QUESTIONS.map((q, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginRight: 8 }}>{i + 1}.</span>
              {q}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OPTIONS.map((opt, j) => (
                <button key={j} onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a) }}
                  style={{ padding: '5px 10px', border: `1.5px solid ${answers[i] === j ? '#7c3aed' : 'var(--border)'}`, borderRadius: 6, background: answers[i] === j ? '#faf5ff' : 'white', color: answers[i] === j ? '#7c3aed' : 'var(--ink-4)', fontSize: 12, cursor: 'pointer', fontWeight: answers[i] === j ? 700 : 400, transition: 'all 0.1s' }}>
                  {j} — {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {score !== null && result && (
        <div style={{ background: '#faf5ff', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>PHQ-9 SCORE</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
          {answers[8] > 0 && (
            <div style={{ marginTop: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
              Item 9 positivo: avaliar ideação suicida directamente. Manter doente em segurança.
            </div>
          )}
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Kroenke K, Spitzer RL, Williams JB. JAMA Intern Med. 2001</div>
        </div>
      )}
    </div>
  )
}

// ─── GAD-7 ────────────────────────────────────────────────────────────────────
function GAD7() {
  const QUESTIONS = [
    'Sentir-se nervoso(a), ansioso(a) ou no limite',
    'Não conseguir parar de se preocupar ou controlar as preocupações',
    'Preocupar-se demasiado com as mais diversas coisas',
    'Ter dificuldade em relaxar',
    'Estar tão irrequieto(a) que é difícil ficar sentado(a)',
    'Ficar facilmente irritado(a) ou implicante',
    'Sentir medo de que algo terrível possa acontecer',
  ]
  const OPTIONS = ['Nunca', 'Vários dias', 'Mais de metade dos dias', 'Quase todos os dias']
  const [answers, setAnswers] = useState<number[]>(Array(7).fill(-1))
  const score = answers.every(a => a >= 0) ? answers.reduce((s, a) => s + a, 0) : null
  const result = score === null ? null : score <= 4 ? { label: 'Ansiedade mínima', color: '#0d6e42', action: 'Sem tratamento indicado.' }
    : score <= 9 ? { label: 'Ansiedade leve', color: '#d97706', action: 'Vigilância. Técnicas de relaxamento.' }
    : score <= 14 ? { label: 'Ansiedade moderada', color: '#b45309', action: 'Tratar. ISRS, terapia cognitivo-comportamental.' }
    : { label: 'Ansiedade grave', color: '#dc2626', action: 'Tratamento activo urgente. Referenciação.' }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20, lineHeight: 1.6 }}>Nas últimas 2 semanas, com que frequência foi incomodado(a) por:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
        {QUESTIONS.map((q, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginRight: 8 }}>{i + 1}.</span>{q}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {OPTIONS.map((opt, j) => (
                <button key={j} onClick={() => { const a = [...answers]; a[i] = j; setAnswers(a) }}
                  style={{ padding: '5px 10px', border: `1.5px solid ${answers[i] === j ? '#d97706' : 'var(--border)'}`, borderRadius: 6, background: answers[i] === j ? '#fffbeb' : 'white', color: answers[i] === j ? '#b45309' : 'var(--ink-4)', fontSize: 12, cursor: 'pointer', fontWeight: answers[i] === j ? 700 : 400 }}>
                  {j} — {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {score !== null && result && (
        <div style={{ background: '#fffbeb', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>GAD-7 SCORE</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Spitzer RL et al. Arch Intern Med. 2006</div>
        </div>
      )}
    </div>
  )
}

// ─── MORSE FALL ───────────────────────────────────────────────────────────────
function MorseFall() {
  const [form, setForm] = useState({ falls: 0, diagnosis: 0, ambulatory: 0, iv: 0, gait: 0, cognition: 0 })
  const score = form.falls + form.diagnosis + form.ambulatory + form.iv + form.gait + form.cognition
  const result = score < 25 ? { label: 'Baixo risco de queda', color: '#0d6e42', action: 'Precauções standard. Reavaliação periódica.' }
    : score < 51 ? { label: 'Médio risco de queda', color: '#d97706', action: 'Implementar programa de prevenção de quedas. Informar doente e família.' }
    : { label: 'Alto risco de queda', color: '#dc2626', action: 'Intervenções de prevenção de quedas intensivas. Supervisão aumentada. Comunicar à equipa.' }
  const SEL = (key: keyof typeof form, opts: { v: number; label: string }[]) => (
    <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  )
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18, lineHeight: 1.6 }}>Escala de Morse — avalia o risco de queda em contexto hospitalar e de cuidados continuados.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>1. Historial de quedas (últimos 3 meses ou internamento actual)</div>{SEL('falls', [{ v: 0, label: 'Não — 0 pontos' }, { v: 25, label: 'Sim — 25 pontos' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>2. Diagnóstico secundário (2+ diagnósticos)</div>{SEL('diagnosis', [{ v: 0, label: 'Não — 0 pontos' }, { v: 15, label: 'Sim — 15 pontos' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>3. Ajuda para deambular</div>{SEL('ambulatory', [{ v: 0, label: 'Nenhuma / repouso no leito / cadeira de rodas — 0 pt' }, { v: 15, label: 'Muletas / bengala / andarilho — 15 pt' }, { v: 30, label: 'Apoia-se nos móveis — 30 pt' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>4. Terapia intravenosa / heparina</div>{SEL('iv', [{ v: 0, label: 'Não — 0 pontos' }, { v: 20, label: 'Sim — 20 pontos' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>5. Marcha</div>{SEL('gait', [{ v: 0, label: 'Normal / cadeira de rodas / acamado — 0 pt' }, { v: 10, label: 'Fraca (curvado, passos arrastados lentos) — 10 pt' }, { v: 20, label: 'Comprometida (dificuldade em levantar, desequilíbrio) — 20 pt' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>6. Estado mental</div>{SEL('cognition', [{ v: 0, label: 'Orientado segundo as suas capacidades — 0 pt' }, { v: 15, label: 'Sobrestima as suas capacidades / esquece limitações — 15 pt' }])}</div>
      </div>
      <div style={{ background: 'var(--bg-2)', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>MORSE FALL SCORE</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Morse JM. Preventing Patient Falls. 1996</div>
      </div>
    </div>
  )
}

// ─── BRADEN ──────────────────────────────────────────────────────────────────
function Braden() {
  const [form, setForm] = useState({ sensory: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction: 3 })
  const score = Object.values(form).reduce((s, v) => s + v, 0)
  const result = score <= 9 ? { label: 'Risco muito elevado', color: '#dc2626', action: 'Mudanças de posição cada 1h. Superfície de alívio de pressão especial. Avaliação diária.' }
    : score <= 12 ? { label: 'Risco elevado', color: '#b45309', action: 'Mudanças de posição cada 2h. Superfície de alívio de pressão.' }
    : score <= 14 ? { label: 'Risco moderado', color: '#d97706', action: 'Mudanças de posição cada 2–3h. Proteger proeminências ósseas.' }
    : score <= 18 ? { label: 'Risco leve', color: '#0891b2', action: 'Implementar medidas preventivas básicas.' }
    : { label: 'Sem risco significativo', color: '#0d6e42', action: 'Reavaliar periodicamente.' }
  const SEL = (key: keyof typeof form, opts: { v: number; label: string }[]) => (
    <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  )
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18, lineHeight: 1.6 }}>Avalia o risco de desenvolvimento de úlceras por pressão. Score mais baixo = maior risco.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>1. Percepção sensorial</div>{SEL('sensory', [{ v: 1, label: '1 — Completamente limitado' }, { v: 2, label: '2 — Muito limitado' }, { v: 3, label: '3 — Ligeiramente limitado' }, { v: 4, label: '4 — Sem limitação' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>2. Humidade</div>{SEL('moisture', [{ v: 1, label: '1 — Constantemente húmido' }, { v: 2, label: '2 — Muito húmido' }, { v: 3, label: '3 — Ocasionalmente húmido' }, { v: 4, label: '4 — Raramente húmido' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>3. Actividade</div>{SEL('activity', [{ v: 1, label: '1 — Acamado' }, { v: 2, label: '2 — Confinado a cadeira' }, { v: 3, label: '3 — Anda ocasionalmente' }, { v: 4, label: '4 — Anda frequentemente' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>4. Mobilidade</div>{SEL('mobility', [{ v: 1, label: '1 — Completamente imóvel' }, { v: 2, label: '2 — Muito limitado' }, { v: 3, label: '3 — Ligeiramente limitado' }, { v: 4, label: '4 — Sem limitações' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>5. Nutrição</div>{SEL('nutrition', [{ v: 1, label: '1 — Muito pobre' }, { v: 2, label: '2 — Provavelmente inadequada' }, { v: 3, label: '3 — Adequada' }, { v: 4, label: '4 — Excelente' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>6. Fricção e forças de deslizamento</div>{SEL('friction', [{ v: 1, label: '1 — Problema' }, { v: 2, label: '2 — Problema potencial' }, { v: 3, label: '3 — Sem problema aparente' }])}</div>
      </div>
      <div style={{ background: 'var(--bg-2)', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>BRADEN SCORE</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}<span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>/23</span></span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Braden BJ, Bergstrom N. Nurs Res. 1987</div>
      </div>
    </div>
  )
}

// ─── NIHSS ────────────────────────────────────────────────────────────────────
function NIHSS() {
  const ITEMS = [
    { key: 'consciousness', label: '1a. Nível de consciência', opts: [{ v: 0, l: '0 — Alerta' }, { v: 1, l: '1 — Não alerta, estimulável' }, { v: 2, l: '2 — Não alerta, estimulação repetida' }, { v: 3, l: '3 — Reflexos ou sem resposta' }] },
    { key: 'questions', label: '1b. Perguntas (mês e idade)', opts: [{ v: 0, l: '0 — Ambas correctas' }, { v: 1, l: '1 — Uma correcta' }, { v: 2, l: '2 — Nenhuma correcta' }] },
    { key: 'commands', label: '1c. Ordens (fechar/abrir olhos, mão)', opts: [{ v: 0, l: '0 — Ambas obedecidas' }, { v: 1, l: '1 — Uma obedecida' }, { v: 2, l: '2 — Nenhuma obedecida' }] },
    { key: 'gaze', label: '2. Olhar conjugado', opts: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Paresia parcial do olhar' }, { v: 2, l: '2 — Desvio forçado' }] },
    { key: 'visual', label: '3. Campo visual', opts: [{ v: 0, l: '0 — Sem perda' }, { v: 1, l: '1 — Hemianopsia parcial' }, { v: 2, l: '2 — Hemianopsia completa' }, { v: 3, l: '3 — Cegueira bilateral' }] },
    { key: 'facial', label: '4. Paralisia facial', opts: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Paresia ligeira' }, { v: 2, l: '2 — Paresia parcial' }, { v: 3, l: '3 — Paralisia completa' }] },
    { key: 'motor_left', label: '5. Motor MS esquerdo', opts: [{ v: 0, l: '0 — Sem queda' }, { v: 1, l: '1 — Queda antes de 10s' }, { v: 2, l: '2 — Alguma força' }, { v: 3, l: '3 — Sem força' }, { v: 4, l: '4 — Sem movimento' }] },
    { key: 'motor_right', label: '6. Motor MS direito', opts: [{ v: 0, l: '0 — Sem queda' }, { v: 1, l: '1 — Queda antes de 10s' }, { v: 2, l: '2 — Alguma força' }, { v: 3, l: '3 — Sem força' }, { v: 4, l: '4 — Sem movimento' }] },
    { key: 'limb_ataxia', label: '7. Ataxia dos membros', opts: [{ v: 0, l: '0 — Ausente' }, { v: 1, l: '1 — Num membro' }, { v: 2, l: '2 — Dois membros' }] },
    { key: 'sensory', label: '8. Sensibilidade', opts: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Perda ligeira a moderada' }, { v: 2, l: '2 — Perda grave ou ausente' }] },
    { key: 'language', label: '9. Linguagem', opts: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Afasia leve-moderada' }, { v: 2, l: '2 — Afasia grave' }, { v: 3, l: '3 — Mudo/global' }] },
    { key: 'dysarthria', label: '10. Disartria', opts: [{ v: 0, l: '0 — Normal' }, { v: 1, l: '1 — Leve a moderada' }, { v: 2, l: '2 — Grave/anártrico' }] },
    { key: 'neglect', label: '11. Extinção/Inatenção', opts: [{ v: 0, l: '0 — Sem anomalia' }, { v: 1, l: '1 — Inatenção a uma modalidade' }, { v: 2, l: '2 — Hemi-inatenção profunda' }] },
  ]
  const [form, setForm] = useState<Record<string, number>>(Object.fromEntries(ITEMS.map(i => [i.key, 0])))
  const score = Object.values(form).reduce((s, v) => s + v, 0)
  const result = score === 0 ? { label: 'Sem défice neurológico', color: '#0d6e42' }
    : score <= 4 ? { label: 'AVC minor', color: '#0891b2' }
    : score <= 15 ? { label: 'AVC moderado', color: '#d97706' }
    : score <= 20 ? { label: 'AVC moderado-grave', color: '#b45309' }
    : { label: 'AVC grave', color: '#dc2626' }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18, lineHeight: 1.6 }}>NIH Stroke Scale — avaliação neurológica padronizada no AVC agudo. Score 0–42.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ITEMS.map(item => (
          <div key={item.key} style={{ padding: '10px 14px', background: form[item.key] > 0 ? '#fff7ed' : 'var(--bg-2)', border: `1px solid ${form[item.key] > 0 ? '#fed7aa' : 'var(--border)'}`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{item.label}</div>
            <select value={form[item.key]} onChange={e => setForm(p => ({ ...p, [item.key]: parseInt(e.target.value) }))}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
              {item.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff7ed', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>NIHSS SCORE</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}<span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>/42</span></span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.color }}>{result.label}</div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Brott T et al. Stroke. 1989 · Activar Via Verde AVC se score &ge; 1 e &lt; 4h de evolução</div>
      </div>
    </div>
  )
}

// ─── MNA (Mini Nutritional Assessment) ───────────────────────────────────────
function MNA() {
  const [form, setForm] = useState({ food_decline: 0, weight_loss: 0, mobility: 0, stress: 0, neuro: 0, bmi: 0 })
  const score = Object.values(form).reduce((s, v) => s + v, 0)
  const result = score >= 12 ? { label: 'Estado nutricional normal', color: '#0d6e42', action: 'Sem necessidade de intervenção nutricional.' }
    : score >= 8 ? { label: 'Risco de malnutrição', color: '#d97706', action: 'Avaliar com MNA completo. Iniciar intervenção nutricional preventiva.' }
    : { label: 'Malnutrição', color: '#dc2626', action: 'Intervenção nutricional urgente. Referenciação a nutricionista.' }
  const SEL = (key: keyof typeof form, opts: { v: number; label: string }[]) => (
    <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  )
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 18, lineHeight: 1.6 }}>Mini Nutritional Assessment — triagem nutricional validada em idosos (≥65 anos). Score 0–14.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>A. Diminuição da ingestão alimentar nas últimas 3 semanas</div>{SEL('food_decline', [{ v: 0, label: '0 — Redução grave' }, { v: 1, label: '1 — Redução moderada' }, { v: 2, label: '2 — Sem redução' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>B. Perda de peso nos últimos 3 meses</div>{SEL('weight_loss', [{ v: 0, label: '0 — Superior a 3 kg' }, { v: 1, label: '1 — Não sabe' }, { v: 2, label: '2 — Entre 1–3 kg' }, { v: 3, label: '3 — Sem perda' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>C. Mobilidade</div>{SEL('mobility', [{ v: 0, label: '0 — Acamado ou cadeira de rodas' }, { v: 1, label: '1 — Sai da cama/cadeira mas não sai de casa' }, { v: 2, label: '2 — Sai de casa' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>D. Doença aguda ou stress psicológico nos últimos 3 meses</div>{SEL('stress', [{ v: 0, label: '0 — Sim' }, { v: 2, label: '2 — Não' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>E. Problemas neuropsicológicos</div>{SEL('neuro', [{ v: 0, label: '0 — Demência grave ou depressão' }, { v: 1, label: '1 — Demência leve' }, { v: 2, label: '2 — Sem problemas' }])}</div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>F. IMC (kg/m²)</div>{SEL('bmi', [{ v: 0, label: '0 — IMC < 19' }, { v: 1, label: '1 — IMC 19–20' }, { v: 2, label: '2 — IMC 21–22' }, { v: 3, label: '3 — IMC ≥ 23' }])}</div>
      </div>
      <div style={{ background: 'var(--bg-2)', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>MNA-SF SCORE</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, color: result.color, lineHeight: 1 }}>{score}<span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>/14</span></span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Guigoz Y. J Nutr Health Aging. 2006 · Nestlé Nutrition Institute</div>
      </div>
    </div>
  )
}

// ─── EVA / NRS Pain ───────────────────────────────────────────────────────────
function PainScale() {
  const [score, setScore] = useState<number | null>(null)
  const result = score === null ? null : score === 0 ? { label: 'Sem dor', color: '#0d6e42', action: 'Continuar avaliação regular.' }
    : score <= 3 ? { label: 'Dor leve', color: '#65a30d', action: 'Analgesia de 1ª escada (paracetamol, AINEs).' }
    : score <= 6 ? { label: 'Dor moderada', color: '#d97706', action: 'Analgesia de 2ª escada. Considerar opióide fraco.' }
    : score <= 9 ? { label: 'Dor intensa', color: '#b45309', action: 'Analgesia de 3ª escada. Opióide forte.' }
    : { label: 'Dor insuportável', color: '#dc2626', action: 'Analgesia urgente. Opióide IV, considerar sedação.' }
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20, lineHeight: 1.6 }}>Escala Numérica de Dor (NRS / EVA) — 0 (sem dor) a 10 (dor insuportável).</p>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => setScore(i)}
              style={{ width: 44, height: 44, borderRadius: 8, border: `2px solid ${score === i ? (i <= 3 ? '#0d6e42' : i <= 6 ? '#d97706' : '#dc2626') : 'var(--border)'}`, background: score === i ? (i === 0 ? '#f0fdf5' : i <= 3 ? '#f0fdf5' : i <= 6 ? '#fffbeb' : '#fee2e2') : 'white', cursor: 'pointer', fontSize: 15, fontWeight: score === i ? 800 : 600, color: score === i ? (i <= 3 ? '#0d6e42' : i <= 6 ? '#b45309' : '#dc2626') : 'var(--ink-4)', transition: 'all 0.1s' }}>
              {i}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', padding: '0 4px' }}>
          <span>Sem dor</span><span>Dor insuportável</span>
        </div>
      </div>
      {score !== null && result && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>DOR / 10</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 56, color: result.color, lineHeight: 1 }}>{score}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>OMS Escada Analgésica · Reavaliação 30–60 min após analgesia</div>
        </div>
      )}
    </div>
  )
}

// ─── APGAR ────────────────────────────────────────────────────────────────────
function Apgar() {
  const [form, setForm] = useState({ appearance: 2, pulse: 2, grimace: 2, activity: 2, respiration: 2 })
  const [timing, setTiming] = useState<'1min' | '5min' | '10min'>('1min')
  const score = Object.values(form).reduce((s, v) => s + v, 0)
  const result = score >= 7 ? { label: 'Normal', color: '#0d6e42', action: 'Sem necessidade de reanimação activa.' }
    : score >= 4 ? { label: 'Depressão moderada', color: '#d97706', action: 'Estimulação e O₂ suplementar. Reavaliar.' }
    : { label: 'Depressão grave', color: '#dc2626', action: 'Reanimação neonatal imediata. Chamar equipa.' }
  const SEL = (key: keyof typeof form) => (
    <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
      <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
    </select>
  )
  const LABELS = {
    appearance: ['Cianose total', 'Cianose extremidades', 'Rosado'],
    pulse: ['Ausente', '< 100 bpm', '≥ 100 bpm'],
    grimace: ['Sem resposta', 'Careta', 'Tosse/espirro/choro'],
    activity: ['Sem tónus', 'Ligeira flexão', 'Movimentos activos'],
    respiration: ['Ausente', 'Irregular/fraco', 'Choro forte'],
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['1min', '5min', '10min'] as const).map(t => (
          <button key={t} onClick={() => setTiming(t)}
            style={{ padding: '6px 14px', border: `1.5px solid ${timing === t ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, background: timing === t ? '#fee2e2' : 'white', color: timing === t ? '#dc2626' : 'var(--ink-4)', fontSize: 12, fontWeight: timing === t ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 20 }}>
        {(Object.keys(form) as (keyof typeof form)[]).map((key, i) => {
          const labels = LABELS[key]
          const rowLabels = ['A — Aparência (cor)', 'P — Pulso (FC)', 'G — Resposta a estímulos', 'A — Actividade (tónus)', 'R — Respiração']
          return (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{rowLabels[i]}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                  0: {labels[0]} · 1: {labels[1]} · 2: {labels[2]}
                </div>
              </div>
              {SEL(key)}
            </div>
          )
        })}
      </div>
      <div style={{ background: '#fef2f2', border: `2px solid ${result.color}`, borderRadius: 10, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>APGAR {timing.toUpperCase()}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 56, color: result.color, lineHeight: 1 }}>{score}<span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>/10</span></span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: result.color, marginBottom: 6 }}>{result.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', background: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '8px 12px' }}>{result.action}</div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>Virginia Apgar. JAMA. 1958</div>
      </div>
    </div>
  )
}

// ─── Registry ─────────────────────────────────────────────────────────────────
const SCALES = [
  { id: 'phq9',   title: 'PHQ-9',          subtitle: 'Depressão — Triagem',         tag: 'Psiquiatria', color: '#7c3aed', desc: 'Patient Health Questionnaire. Triagem e monitorização da depressão. 9 itens, score 0–27. Validado para cuidados primários.', component: PHQ9 },
  { id: 'gad7',   title: 'GAD-7',          subtitle: 'Ansiedade — Triagem',         tag: 'Psiquiatria', color: '#d97706', desc: 'Generalized Anxiety Disorder Scale. Triagem de ansiedade generalizada. 7 itens, score 0–21.', component: GAD7 },
  { id: 'nihss',  title: 'NIHSS',          subtitle: 'AVC — Gravidade neurológica', tag: 'Neurologia',  color: '#b45309', desc: 'NIH Stroke Scale. Avaliação neurológica padronizada no AVC agudo. 13 itens, score 0–42. Via Verde AVC.', component: NIHSS },
  { id: 'morse',  title: 'Morse Fall',     subtitle: 'Risco de queda',             tag: 'Enfermagem',  color: '#0891b2', desc: 'Escala de Morse para avaliação do risco de queda. 6 itens. Obrigatória na admissão hospitalar.', component: MorseFall },
  { id: 'braden', title: 'Braden',         subtitle: 'Úlceras por pressão',        tag: 'Enfermagem',  color: '#0d6e42', desc: 'Escala de Braden para avaliação do risco de úlceras por pressão. 6 subescalas, score 6–23. Menor score = maior risco.', component: Braden },
  { id: 'mna',    title: 'MNA-SF',         subtitle: 'Triagem nutricional',        tag: 'Geriatria',   color: '#65a30d', desc: 'Mini Nutritional Assessment — Short Form. Triagem nutricional validada em idosos ≥65 anos. Score 0–14.', component: MNA },
  { id: 'pain',   title: 'Dor NRS',        subtitle: 'Escala de dor 0–10',         tag: 'Universal',   color: '#dc2626', desc: 'Numeric Rating Scale / EVA. Avaliação da intensidade da dor com orientação terapêutica por escada analgésica OMS.', component: PainScale },
  { id: 'apgar',  title: 'APGAR',          subtitle: 'Avaliação neonatal',         tag: 'Pediatria',   color: '#1d4ed8', desc: 'Escala de Apgar para avaliação do recém-nascido ao 1º, 5º e 10º minuto. Score 0–10.', component: Apgar },
]

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Psiquiatria: { bg: '#faf5ff', color: '#7c3aed' },
  Neurologia:  { bg: '#fffbeb', color: '#b45309' },
  Enfermagem:  { bg: '#ecfeff', color: '#0891b2' },
  Geriatria:   { bg: '#f0fdf5', color: '#0d6e42' },
  Universal:   { bg: '#fee2e2', color: '#dc2626' },
  Pediatria:   { bg: '#eff6ff', color: '#1d4ed8' },
}

export default function EscalasPage() {
  const [active, setActive] = useState<string | null>(null)
  const [filter, setFilter] = useState('Todas')

  const tags = ['Todas', ...Array.from(new Set(SCALES.map(s => s.tag)))]
  const filtered = filter === 'Todas' ? SCALES : SCALES.filter(s => s.tag === filter)
  const activeScale = active ? SCALES.find(s => s.id === active) : null
  const ActiveComp = activeScale?.component

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body">

        {active && (
          <button onClick={() => setActive(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-3)', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar às escalas
          </button>
        )}

        {!active && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Ferramenta clínica</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,40px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>Escalas Clínicas</h1>
              <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 560 }}>
                {SCALES.length} escalas validadas com interpretação clínica integrada. PHQ-9, GAD-7, NIHSS, Morse, Braden, MNA e mais. Gratuito, sem conta.
              </p>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
              {tags.map(t => {
                const tc = TAG_COLORS[t] || { bg: 'var(--bg-2)', color: 'var(--ink-4)' }
                return (
                  <button key={t} onClick={() => setFilter(t)}
                    style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${filter === t ? tc.color : 'var(--border)'}`, background: filter === t ? tc.bg : 'white', color: filter === t ? tc.color : 'var(--ink-4)', fontSize: 12, fontWeight: filter === t ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', transition: 'all 0.12s' }}>
                    {t}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,300px),1fr))', gap: 10 }}>
              {filtered.map(scale => {
                const tc = TAG_COLORS[scale.tag] || { bg: 'var(--bg-2)', color: 'var(--ink-4)' }
                return (
                  <button key={scale.id} onClick={() => setActive(scale.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '20px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s', borderTop: `3px solid ${scale.color}` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = scale.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, lineHeight: 1 }}>{scale.title}</span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tc.color, background: tc.bg, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{scale.tag}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: scale.color }}>{scale.subtitle}</div>
                    <p style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6, margin: 0 }}>{scale.desc}</p>
                    <div style={{ fontSize: 12, fontWeight: 700, color: scale.color, marginTop: 4 }}>Abrir →</div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {activeScale && ActiveComp && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: TAG_COLORS[activeScale.tag]?.color, background: TAG_COLORS[activeScale.tag]?.bg, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{activeScale.tag}</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 6, letterSpacing: '-0.015em' }}>{activeScale.title} — {activeScale.subtitle}</h1>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{activeScale.desc}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 24px' }}>
              <ActiveComp />
            </div>
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--ink-5)', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                Ferramenta de apoio clínico — não substitui o julgamento profissional. Resultado deve ser interpretado no contexto clínico do doente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}