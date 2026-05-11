'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState } from 'react'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// ─── Interactive demo component ───────────────────────────────────────────────
function InteractionDemo() {
  const DEMOS = [
    {
      drugs: ['Varfarina', 'Ibuprofeno'],
      severity: 'GRAVE',
      color: '#991b1b', bg: '#fee2e2', border: '#fca5a5',
      summary: 'Risco de hemorragia grave. O ibuprofeno inibe a COX-1 plaquetária e potencia o efeito anticoagulante da varfarina, aumentando o INR.',
      mechanism: 'Inibição COX-1 + deslocamento da ligação à albumina',
      alt: 'Paracetamol (com monitorização de INR)',
    },
    {
      drugs: ['Sertralina', 'Tramadol'],
      severity: 'GRAVE',
      color: '#7c2d12', bg: '#fff7ed', border: '#fed7aa',
      summary: 'Risco de síndrome serotoninérgica. Ambos aumentam a serotonina central. Pode causar hipertermia, clonus, agitação e instabilidade autonómica.',
      mechanism: 'Efeito aditivo serotoninérgico (ISRS + agonismo 5-HT)',
      alt: 'Paracetamol ou AINE tópico para a dor',
    },
    {
      drugs: ['Atorvastatina', 'Claritromicina'],
      severity: 'MODERADA',
      color: '#92400e', bg: '#fffbeb', border: '#fde68a',
      summary: 'A claritromicina inibe o CYP3A4, aumentando os níveis de atorvastatina até 4×. Risco de miopatia e rabdomiólise.',
      mechanism: 'Inibição CYP3A4 → aumento da AUC da estatina',
      alt: 'Suspender estatina durante o antibiótico ou usar rosuvastatina',
    },
  ]

  const [active, setActive] = useState(0)
  const demo = DEMOS[active]

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden', maxWidth: 520, width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#22c55e' }} />)}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#475569', letterSpacing: '0.12em' }}>phlox — verificador de interações</span>
      </div>

      {/* Drug pills selector */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Exemplo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEMOS.map((d, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${active === i ? '#334155' : 'transparent'}`, background: active === i ? '#334155' : 'transparent', color: active === i ? '#f8fafc' : '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: active === i ? 700 : 400, transition: 'all 0.1s' }}>
              {d.drugs.join(' + ')}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <div style={{ padding: '18px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {demo.drugs.map(d => (
            <span key={d} style={{ padding: '4px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>{d}</span>
          ))}
        </div>

        <div style={{ background: demo.bg, border: `1px solid ${demo.border}`, borderLeft: `3px solid ${demo.color}`, borderRadius: 7, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: demo.color, letterSpacing: '0.1em', textTransform: 'uppercase', background: `${demo.color}20`, padding: '2px 8px', borderRadius: 3 }}>{demo.severity}</span>
          </div>
          <p style={{ fontSize: 13, color: demo.color, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{demo.summary}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 7, border: '1px solid #1e293b' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Mecanismo CYP450</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{demo.mechanism}</div>
          </div>
          <div style={{ padding: '10px 12px', background: '#0f172a', borderRadius: 7, border: '1px solid #1e293b' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22c55e', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Alternativa</div>
            <div style={{ fontSize: 12, color: '#4ade80', lineHeight: 1.5 }}>{demo.alt}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Trust bar numbers ────────────────────────────────────────────────────────
const STATS = [
  { value: '35+', label: 'ferramentas clínicas' },
  { value: '15', label: 'calculadoras validadas' },
  { value: '5', label: 'ligas de competição' },
  { value: '6', label: 'cursos simulados' },
]

// ─── Feature comparison vs alternatives ──────────────────────────────────────
const COMPARISON_ROWS = [
  { feature: 'OSCE com AI como doente',         phlox: true,  uptodate: false, mims: false },
  { feature: 'Ligas de conhecimento clínico',   phlox: true,  uptodate: false, mims: false },
  { feature: 'Ward colaborativo multi-equipa',  phlox: true,  uptodate: false, mims: false },
  { feature: 'Comunicação inter-profissional',  phlox: true,  uptodate: false, mims: false },
  { feature: 'Passagem de turno AI',            phlox: true,  uptodate: false, mims: false },
  { feature: 'Interações medicamentosas',       phlox: true,  uptodate: true,  mims: true  },
  { feature: 'Mecanismo CYP450 detalhado',      phlox: true,  uptodate: true,  mims: false },
  { feature: 'Em português europeu',            phlox: true,  uptodate: false, mims: false },
  { feature: 'Preço para estudantes (mês)',     phlox: '3,99€', uptodate: '45€', mims: '12€' },
]

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'O Ward substituiu o WhatsApp da equipa. Tudo documentado, auditável, com passagem de turno em 30 segundos.',
    name: 'A.M.', role: 'Farmacêutica Hospitalar', location: 'Lisboa',
    color: '#1d4ed8',
  },
  {
    quote: 'Passei de Bronze a Ouro na Arena em 3 semanas. Os casos são mais difíceis que os exames reais — e isso é bom.',
    name: 'R.S.', role: 'Estudante de Medicina, 4.º ano', location: 'Porto',
    color: '#7c3aed',
  },
  {
    quote: 'Os meus pais têm 6 medicamentos cada. Finalmente percebo o que tomam e porquê. O Care Plan impresso foi à consulta.',
    name: 'C.L.', role: 'Cuidador familiar', location: 'Braga',
    color: '#b45309',
  },
]

// ─── Audience sections ────────────────────────────────────────────────────────
const AUDIENCES = [
  {
    id: 'profissional',
    tag: 'Para profissionais',
    title: 'O co-piloto clínico\nque faltava.',
    sub: 'Ward + Connect + Rounds + AI. A alternativa moderna ao papel, ao fax e ao WhatsApp de grupo.',
    color: '#1d4ed8',
    bg: '#eff6ff',
    href: '/login?mode=clinical',
    cta: 'Ver ferramentas Pro',
    points: [
      { title: 'Phlox Ward', desc: 'Ficha clínica colaborativa em tempo real. Toda a equipa no mesmo doente.' },
      { title: 'Passagem de turno AI', desc: 'Gerada em 1 clique. Com alertas, decisões, e tarefas abertas por doente.' },
      { title: 'Phlox Rounds + PCNE', desc: 'Ronda farmacêutica digital. Score de risco automático. Relatório para acreditação.' },
      { title: 'Phlox Connect', desc: 'Farmacêutico comunica directamente com médico. Documentado e auditável.' },
    ],
  },
  {
    id: 'estudante',
    tag: 'Para estudantes',
    title: 'Estuda como\num profissional.',
    sub: 'Arena, OSCE, Hive, Tutor AI, Flashcards SRS. Medicina, Farmácia, Enfermagem, Nutrição, Fisioterapia, Dentária.',
    color: '#7c3aed',
    bg: '#faf5ff',
    href: '/login?mode=student',
    cta: 'Ver ferramentas Student',
    points: [
      { title: 'Phlox Arena', desc: '5 ligas, Bronze a Diamante. Casos em 10 domínios. XP e ranking global.' },
      { title: 'Phlox OSCE', desc: 'A AI responde como doente. Checklist, timer e feedback item a item como examinador.' },
      { title: 'Phlox Hive', desc: 'Inteligência colectiva. Os pontos cegos da comunidade + os teus especificamente.' },
      { title: 'AI Tutor Socrático', desc: '4 fases de deepening. Aprende por raciocínio, não por memorização.' },
    ],
  },
  {
    id: 'familia',
    tag: 'Para famílias',
    title: 'A medicação\nda tua família,\nfinalmente organizada.',
    sub: 'Perfis familiares, calendário de tomas, monitor de adesão, care plan imprimível. Para quem cuida.',
    color: '#b45309',
    bg: '#fffbeb',
    href: '/login?mode=caregiver',
    cta: 'Criar conta grátis',
    points: [
      { title: 'Perfis familiares', desc: 'Um perfil por pessoa. Medicação, condições, alergias. Partilhável com o médico.' },
      { title: 'Verificador de interações', desc: 'Verifica a medicação completa de um familiar em segundos.' },
      { title: 'Care Plan imprimível', desc: 'Uma página A4 com toda a medicação e instruções. Para levar à consulta.' },
      { title: 'Monitor de adesão', desc: 'Registo de tomas, padrões de não-adesão, e razões. Com sugestões personalizadas.' },
    ],
  },
]

export default function HomePage() {
  const [demoActive, setDemoActive] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f172a', padding: '80px 0 72px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="hero-grid">

            {/* Left */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '5px 14px 5px 10px', marginBottom: 28 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 2s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Portugal · Online agora</span>
              </div>

              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px,4vw,54px)', color: '#f8fafc', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 20 }}>
                A plataforma clínica<br />
                <span style={{ color: '#22c55e' }}>feita para Portugal.</span>
              </h1>

              <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.8, marginBottom: 12 }}>
                Para profissionais que precisam de ferramentas reais.
              </p>
              <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.8, marginBottom: 12 }}>
                Para estudantes que querem competir a sério.
              </p>
              <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.8, marginBottom: 36 }}>
                Para famílias que merecem perceber a sua medicação.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
                <Link href="/login"
                  style={{ padding: '14px 32px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', letterSpacing: '-0.01em' }}
                  className="hero-cta-primary">
                  Começar grátis
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/interactions"
                  style={{ padding: '14px 22px', background: 'transparent', color: '#94a3b8', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155', transition: 'all 0.15s' }}>
                  Verificar interações — sem conta
                </Link>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {STATS.map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#f8fafc', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — interactive demo */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <InteractionDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── FREE TOOLS BAR ───────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '13px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.16em', flexShrink: 0 }}>Grátis · Sem conta</span>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            {[
              { label: 'Verificar Interações', href: '/interactions' },
              { label: 'Tradutor de Bula', href: '/bula' },
              { label: 'Dose Pediátrica', href: '/dose-crianca' },
              { label: 'Calculadoras Clínicas', href: '/calculators' },
            ].map((t, i, arr) => (
              <span key={t.href} style={{ display: 'flex', alignItems: 'center' }}>
                <Link href={t.href} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none', padding: '2px 0', transition: 'color 0.1s' }} className="free-link">{t.label}</Link>
                {i < arr.length - 1 && <span style={{ color: 'var(--border-2)', margin: '0 12px' }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── AUDIENCE SECTIONS ─────────────────────────────────────────────── */}
      {AUDIENCES.map((aud, idx) => (
        <section key={aud.id} style={{ padding: '88px 0', background: idx % 2 === 1 ? '#0f172a' : 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
          {idx % 2 === 1 && (
            <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
          )}
          <div className="page-container" style={{ position: 'relative' }}>
            <div style={{ display: 'grid', gridTemplateColumns: idx % 2 === 0 ? '1fr 1fr' : '1fr 1fr', gap: 64, alignItems: 'center' }} className="audience-grid">

              {/* Text side */}
              <div style={{ order: idx % 2 === 0 ? 0 : 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: aud.color, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 16, opacity: 0.9 }}>{aud.tag}</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,3.5vw,44px)', color: idx % 2 === 1 ? '#f8fafc' : 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.12, marginBottom: 18, whiteSpace: 'pre-line' }}>{aud.title}</h2>
                <p style={{ fontSize: 16, color: idx % 2 === 1 ? '#64748b' : 'var(--ink-3)', lineHeight: 1.75, marginBottom: 36, maxWidth: 440 }}>{aud.sub}</p>
                <Link href={aud.href}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 28px', background: aud.color, color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, marginBottom: 36 }}>
                  {aud.cta}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>

              {/* Points side */}
              <div style={{ order: idx % 2 === 0 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {aud.points.map((pt, i) => (
                    <div key={i} style={{ padding: '18px 20px', background: idx % 2 === 1 ? '#1e293b' : 'white', border: `1px solid ${idx % 2 === 1 ? '#334155' : 'var(--border)'}`, borderRadius: 10, borderLeft: `3px solid ${aud.color}`, transition: 'transform 0.1s' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: idx % 2 === 1 ? '#f8fafc' : 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>{pt.title}</div>
                      <div style={{ fontSize: 13, color: idx % 2 === 1 ? '#64748b' : 'var(--ink-3)', lineHeight: 1.6 }}>{pt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Utilizado por profissionais e estudantes em Portugal</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>O que dizem os utilizadores</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px),1fr))', gap: 16 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ padding: '24px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, borderTop: `3px solid ${t.color}` }}>
                <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.75, margin: '0 0 20px', fontStyle: 'italic' }}>"{t.quote}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${t.color}15`, border: `1px solid ${t.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, color: t.color, fontWeight: 600 }}>
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{t.role} · {t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VS ALTERNATIVAS ───────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--bg)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>
              Porque o Phlox é diferente
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.6 }}>Comparação honesta com alternativas internacionais.</p>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', maxWidth: 700, margin: '0 auto' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', width: '45%' }}>Funcionalidade</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--green)' }}>Phlox</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-4)' }}>UpToDate</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-4)' }}>MIMS</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.feature} style={{ borderBottom: '1px solid var(--bg-3)', background: i % 2 === 0 ? 'white' : 'var(--bg-2)' }}>
                      <td style={{ padding: '10px 20px', fontSize: 13, color: 'var(--ink-2)' }}>{row.feature}</td>
                      {[
                        { v: row.phlox, accent: 'var(--green)' },
                        { v: row.uptodate, accent: 'var(--ink-4)' },
                        { v: row.mims, accent: 'var(--ink-4)' },
                      ].map(({ v, accent }, j) => (
                        <td key={j} style={{ padding: '10px 16px', textAlign: 'center' }}>
                          {typeof v === 'boolean' ? (
                            v ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                            ) : (
                              <span style={{ color: 'var(--border-2)', fontSize: 16 }}>—</span>
                            )
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: j === 0 ? 'var(--green)' : 'var(--ink-3)', fontWeight: j === 0 ? 700 : 400 }}>{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST / FONTES ────────────────────────────────────────────────── */}
      <section style={{ padding: '48px 0', background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>Fontes verificáveis — nunca inventadas</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {['OpenFDA', 'INFARMED', 'EMA', 'RxNorm · NIH', 'ESC 2024', 'ADA 2024', 'NICE', 'DGS', 'KDIGO', 'Lexicomp'].map(s => (
              <span key={s} className="source-pill">{s}</span>
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            A AI é usada para síntese e raciocínio clínico.<br />Toda a informação crítica é verificável nas fontes originais.
          </p>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '88px 0', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 580, position: 'relative' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,46px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 18 }}>
            Começa hoje.<br />É grátis para sempre.
          </h2>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 14, lineHeight: 1.7 }}>
            Três ferramentas sem conta. Upgrade quando faz sentido.
          </p>
          <p style={{ fontSize: 14, color: '#334155', marginBottom: 40, fontFamily: 'var(--font-mono)' }}>
            Cancela quando quiseres. Sem fidelização.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            <Link href="/login"
              style={{ padding: '15px 36px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 16, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}
              className="hero-cta-primary">
              Criar conta grátis
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/pricing"
              style={{ padding: '15px 24px', background: 'transparent', color: '#64748b', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155' }}>
              Ver planos
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Sem cartão de crédito', 'Cancela quando quiseres', 'Sem anúncios'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .hero-cta-primary:hover { background: #16a34a !important; transform: translateY(-2px); }
        .free-link:hover { color: var(--green) !important; }
        @media(max-width:768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .audience-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}