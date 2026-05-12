'use client'

// app/page.tsx — Homepage Phlox Clinical
// Design: editorial, sem clichês de IA, sem grids quadriculados
// Inspiração: revistas médicas de qualidade, anuários de design editorial europeu

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useEffect, useRef } from 'react'

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function Reveal({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, inView } = useInView()
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(24px)', transition: `opacity 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.7s ${delay}s cubic-bezier(0.16,1,0.3,1)`, ...style }}>
      {children}
    </div>
  )
}

// ─── Ferramenta destaque interactiva ─────────────────────────────────────────
const TOOL_DEMOS = [
  {
    id: 'interactions',
    label: 'Interações medicamentosas',
    href: '/interactions',
    input: 'Varfarina 5mg + Ibuprofeno 400mg',
    output: {
      severity: 'GRAVE',
      color: '#991b1b',
      bg: '#fee2e2',
      border: '#fca5a5',
      text: 'Risco de hemorragia grave. O ibuprofeno inibe a COX-1 plaquetária e potencia o efeito anticoagulante da varfarina.',
      cyp: 'CYP2C9 · deslocamento da ligação à albumina',
      alt: 'Paracetamol (com monitorização de INR)',
    },
  },
  {
    id: 'ward',
    label: 'Passagem de turno',
    href: '/teams',
    input: '3 doentes · turno da manhã',
    output: {
      severity: 'IA',
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: 'Doente 1 — Risco CRÍTICO. Varfarina + INR 4.2 + AINEs prescritos. Intervenção farmacêutica necessária antes da próxima ronda.',
      cyp: 'Passagem gerada em 8 segundos',
      alt: 'Pronto para imprimir e assinar',
    },
  },
  {
    id: 'arena',
    label: 'Caso clínico Arena',
    href: '/arena',
    input: 'Farmacologia · Nível Médio · 90s',
    output: {
      severity: '+20 XP',
      color: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
      text: 'Mulher 58a, DM2 + IC-FEr (FE 35%) + DRC G3b. Qual o antidiabético de 1ª linha?',
      cyp: 'Empagliflozina — evidência de mortalidade CV e renal',
      alt: 'Correcto em 34s · +26 XP com bónus',
    },
  },
]

function LiveDemo() {
  const [active, setActive] = useState(0)
  const [animating, setAnimating] = useState(false)

  const switchTool = (idx: number) => {
    if (idx === active) return
    setAnimating(true)
    setTimeout(() => { setActive(idx); setAnimating(false) }, 160)
  }

  const demo = TOOL_DEMOS[active]

  return (
    <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', overflowX: 'auto' }}>
        {TOOL_DEMOS.map((t, i) => (
          <button key={t.id} onClick={() => switchTool(i)}
            style={{ padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: active === i ? 700 : 400, color: active === i ? '#f9fafb' : '#6b7280', whiteSpace: 'nowrap', borderBottom: `2px solid ${active === i ? '#22c55e' : 'transparent'}`, transition: 'all 0.15s', fontFamily: 'var(--font-sans)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0, animation: 'pulse-green 2s infinite' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9ca3af' }}>{demo.input}</span>
      </div>

      {/* Output */}
      <div style={{ padding: '16px 18px', opacity: animating ? 0 : 1, transform: animating ? 'translateY(6px)' : 'none', transition: 'opacity 0.16s, transform 0.16s' }}>
        <div style={{ background: demo.output.bg, border: `1px solid ${demo.output.border}`, borderLeft: `3px solid ${demo.output.color}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: demo.output.color, background: `${demo.output.color}15`, padding: '2px 8px', borderRadius: 3, letterSpacing: '0.1em' }}>{demo.output.severity}</span>
          </div>
          <p style={{ fontSize: 13, color: demo.output.color, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{demo.output.text}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Mecanismo</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{demo.output.cyp}</div>
          </div>
          <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 7, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Alternativa</div>
            <div style={{ fontSize: 11, color: '#4ade80' }}>{demo.output.alt}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Link href={demo.href} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#22c55e', textDecoration: 'none', fontWeight: 700 }}>
            Experimentar →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Número animado ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, inView } = useInView()
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!inView) return
    const duration = 1200
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, value])
  return <span ref={ref}>{display}{suffix}</span>
}

// ─── Linha horizontal com texto ───────────────────────────────────────────────
function Rule({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {children && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.18em', textTransform: 'uppercase', flexShrink: 0 }}>{children}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ─── Profissional feature card ────────────────────────────────────────────────
const PRO_TOOLS = [
  { title: 'Phlox Ward', color: '#1d4ed8', href: '/teams', desc: 'Ficha clínica colaborativa em tempo real. Toda a equipa no mesmo doente.', detail: 'Feed por tipo de entrada · Passagem de turno AI · Histórico auditável' },
  { title: 'Phlox Connect', color: '#0d6e42', href: '/connect', desc: 'Comunicação inter-profissional documentada. Farmacêutico → Médico → Enfermeiro.', detail: 'Análise AI · Aceite documentado · Registo por doente' },
  { title: 'Phlox Rounds', color: '#7c3aed', href: '/rounds', desc: 'Ronda farmacêutica digital com classificação PCNE v9.1 completa.', detail: 'Score de risco automático · Relatório de acreditação · 1 clique' },
  { title: 'Phlox Carta', color: '#0891b2', href: '/carta', desc: 'Referenciação, nota de alta, intervenção farmacêutica. Pronto para assinar.', detail: '5 tipos de carta clínica · Formato PCNE · Imprimível', badge: 'Novo' },
  { title: 'Escalas Clínicas', color: '#b45309', href: '/escalas', desc: 'PHQ-9, NIHSS, Braden, Morse, MNA, APGAR e mais. Com interpretação clínica.', detail: '8 escalas validadas · Resultado imediato · Gratuito', badge: 'Novo' },
  { title: 'Phlox Residentes', color: '#dc2626', href: '/residentes', desc: 'Revisão farmacoterapêutica automatizada de residentes de lar. STOPP/START + Beers.', detail: 'Dashboard de risco · Relatório por residente · Acreditação', badge: 'Novo' },
]

const STUDENT_TOOLS = [
  { title: 'Phlox Arena', color: '#7c3aed', href: '/arena', desc: 'Ligas de conhecimento clínico. Bronze a Diamante. XP real, ranking global.' },
  { title: 'Phlox OSCE', color: '#dc2626', href: '/osce', desc: 'Simulação de OSCE com AI como doente. 6 cursos. Timer real por estação.' },
  { title: 'Phlox Decisão', color: '#0891b2', href: '/decisao', desc: 'O caso clínico evolui com as tuas decisões. O doente piora se decides mal.', badge: 'Exclusivo' },
  { title: 'Phlox Hive', color: '#d97706', href: '/hive', desc: 'A inteligência colectiva da comunidade. Os teus pontos cegos específicos.' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0c0f1a', minHeight: '92vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Linha diagonal — elemento editorial, não grid quadriculado */}
        <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: 'linear-gradient(135deg, transparent 0%, #0f172a 100%)', pointerEvents: 'none' }} />
        {/* Acento verde subtil */}
        <div aria-hidden style={{ position: 'absolute', bottom: -100, left: '30%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(34,197,94,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }} className="hero-grid">

            {/* Texto */}
            <div>
              {/* Tag line editorial — não marketing */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
                <div style={{ width: 28, height: 1, background: '#22c55e' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4b5563', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                  Farmacologia clínica · Portugal · 2026
                </span>
              </div>

              {/* Headline tipográfica — serif grande, não hero genérico */}
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px,4.5vw,64px)', color: '#f9fafb', fontWeight: 400, lineHeight: 1.08, letterSpacing: '-0.03em', margin: '0 0 32px' }}>
                A clínica<br />
                <span style={{ color: '#22c55e', fontStyle: 'italic' }}>precisa</span><br />
                de melhor.
              </h1>

              <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8, maxWidth: 400, margin: '0 0 40px' }}>
                Ferramentas para profissionais que trabalham. Competição para estudantes que querem ser os melhores. Clareza para famílias que gerem medicação.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 48 }}>
                <Link href="/login"
                  style={{ padding: '13px 28px', background: '#22c55e', color: '#0c0f1a', textDecoration: 'none', borderRadius: 7, fontSize: 14, fontWeight: 800, letterSpacing: '0.01em', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                  className="hero-cta-primary">
                  Começar grátis
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/institucional"
                  style={{ padding: '13px 22px', background: 'transparent', color: '#9ca3af', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, border: '1px solid #1f2937', transition: 'all 0.15s' }}
                  className="hero-cta-secondary">
                  Para instituições
                </Link>
              </div>

              {/* Números — horizontais, tipográficos */}
              <div style={{ display: 'flex', gap: 32 }}>
                {[
                  { value: 35, suffix: '+', label: 'ferramentas' },
                  { value: 10, suffix: '', label: 'domínios' },
                  { value: 100, suffix: '%', label: 'grátis para começar' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#f9fafb', lineHeight: 1 }}>
                      <AnimatedNumber value={s.value} suffix={s.suffix} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo interactiva */}
            <div>
              <LiveDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── FERRAMENTAS GRATUITAS ────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto' }}>
            <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 20 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '4px 10px', border: '1px solid #22c55e', borderRadius: 20 }}>Grátis · Sem conta</span>
            </div>
            {[
              { label: 'Verificar Interações', href: '/interactions' },
              { label: 'Tradutor de Bula', href: '/bula' },
              { label: 'Dose Pediátrica', href: '/dose-crianca' },
              { label: 'Calculadoras Clínicas', href: '/calculators' },
              { label: 'Escalas Clínicas', href: '/escalas' },
            ].map((t, i) => (
              <Link key={t.href} href={t.href}
                style={{ display: 'flex', alignItems: 'center', padding: '16px 18px', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textDecoration: 'none', borderLeft: '1px solid var(--border)', transition: 'color 0.1s, background 0.1s', whiteSpace: 'nowrap' }}
                className="free-tool-link">
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── PARA PROFISSIONAIS ────────────────────────────────────────────── */}
      <section style={{ padding: '120px 0 100px', background: 'var(--bg)' }}>
        <div className="page-container">
          <Reveal>
            <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', marginBottom: 72, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 auto' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#1d4ed8', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 1, background: '#1d4ed8' }} />Profissionais e Instituições
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,50px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, margin: 0, maxWidth: 480 }}>
                  Ferramentas feitas<br />para o trabalho real.
                </h2>
              </div>
              <div style={{ flex: 1, minWidth: 280, paddingTop: 8 }}>
                <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 20 }}>
                  Farmácias, hospitais, clínicas, lares. As ferramentas que substituem o papel, o fax, e o WhatsApp clínico.
                </p>
                <Link href="/institucional"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Ver planos institucionais
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Tools — layout em lista tipográfica, não cards quadrados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PRO_TOOLS.map((tool, i) => (
              <Reveal key={tool.title} delay={i * 0.06}>
                <Link href={tool.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '28px 0', borderTop: '1px solid var(--border)', textDecoration: 'none', transition: 'background 0.1s' }}
                  className="pro-tool-row">
                  {/* Number */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', width: 28, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  {/* Accent dot */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: tool.color, flexShrink: 0 }} />
                  {/* Title */}
                  <div style={{ width: 180, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>{tool.title}</span>
                    {'badge' in tool && tool.badge && (
                      <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, color: tool.color, background: `${tool.color}12`, border: `1px solid ${tool.color}30`, padding: '1px 6px', borderRadius: 3, verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tool.badge}</span>
                    )}
                  </div>
                  {/* Desc */}
                  <div style={{ flex: 1, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.5 }}>{tool.desc}</div>
                  {/* Detail */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textAlign: 'right', maxWidth: 220, flexShrink: 0, display: 'none' }} className="pro-tool-detail">
                    {tool.detail}
                  </div>
                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </Reveal>
            ))}
            <div style={{ borderTop: '1px solid var(--border)' }} />
          </div>
        </div>
      </section>

      {/* ── PARA ESTUDANTES ──────────────────────────────────────────────── */}
      <section style={{ padding: '100px 0', background: '#0c0f1a', position: 'relative', overflow: 'hidden' }}>
        {/* Acento diagonal direita */}
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: 'linear-gradient(135deg, #0f172a 0%, transparent 100%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '20%', transform: 'translateY(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
          <Reveal>
            <div style={{ marginBottom: 64 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#7c3aed', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 1, background: '#7c3aed' }} />Student
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,52px)', color: '#f9fafb', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 20px' }}>
                Estuda como<br />
                <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>um profissional.</span>
              </h2>
              <p style={{ fontSize: 16, color: '#4b5563', lineHeight: 1.75, maxWidth: 480 }}>
                Medicina, Farmácia, Enfermagem, Nutrição, Fisioterapia, Dentária. Arena, OSCE, Hive, Decisão — o que nenhuma plataforma oferece em português.
              </p>
            </div>
          </Reveal>

          {/* Student tools — layout assimétrico, 2+2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
            {STUDENT_TOOLS.map((tool, i) => (
              <Reveal key={tool.title} delay={i * 0.08}>
                <Link href={tool.href}
                  style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: '#111827', border: '1px solid #1f2937', borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.15s, transform 0.15s', minHeight: 160 }}
                  className="student-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: tool.color, marginTop: 4 }} />
                    {'badge' in tool && tool.badge && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, color: tool.color, background: `${tool.color}15`, border: `1px solid ${tool.color}30`, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tool.badge}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: '#f9fafb', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.01em' }}>{tool.title}</div>
                  <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.65, margin: 0, flex: 1 }}>{tool.desc}</p>
                  <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10, color: tool.color, fontWeight: 700 }}>Abrir →</div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUEM ────────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 0', background: 'white' }}>
        <div className="page-container">
          <Reveal>
            <Rule>Para quem</Rule>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.5vw,44px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 56, maxWidth: 500 }}>
              Uma plataforma.<br />
              Quatro experiências<br />completamente diferentes.
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 2, border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {[
              { title: 'Profissional de Saúde', sub: 'Farmácia · Hospital · Clínica · Lar', color: '#1d4ed8', href: '/login?mode=clinical', tools: ['Ward — ficha colaborativa', 'Connect — inter-profissional', 'Rounds — PCNE v9.1', 'Carta — referenciação', 'Residentes — gestão de lar'] },
              { title: 'Estudante', sub: 'Medicina · Farmácia · Enfermagem e mais', color: '#7c3aed', href: '/login?mode=student', tools: ['Arena — ligas Bronze→Diamante', 'OSCE — AI como doente', 'Decisão — caso que evolui', 'Hive — inteligência colectiva', 'Tutor AI socrático'] },
              { title: 'Cuidador Familiar', sub: 'Pais · Filhos · Cônjuge · Avós', color: '#b45309', href: '/login?mode=caregiver', tools: ['Perfis familiares', 'Care Plan imprimível', 'Calendário de tomas', 'Monitor de adesão', 'Verificar interações'] },
              { title: 'Uso Pessoal', sub: 'A minha saúde', color: '#0d6e42', href: '/login?mode=personal', tools: ['Os meus medicamentos', 'Registo de saúde', 'Análises e vacinas', 'Timeline clínica', 'Phlox AI'] },
            ].map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <Link href={p.href}
                  style={{ display: 'flex', flexDirection: 'column', padding: '28px 24px', background: 'white', textDecoration: 'none', height: '100%', transition: 'background 0.1s' }}
                  className="persona-tile">
                  <div style={{ width: 20, height: 3, background: p.color, borderRadius: 1.5, marginBottom: 20 }} />
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, marginBottom: 4, lineHeight: 1.25 }}>{p.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 22 }}>{p.sub}</div>
                  <div style={{ flex: 1 }}>
                    {p.tools.map((t, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: j < p.tools.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                        <div style={{ width: 3, height: 3, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: p.color }}>
                    Entrar
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTITUCIONAL CTA ─────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div className="page-container">
          <Reveal>
            <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#1d4ed8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 1, background: '#1d4ed8' }} />Plano Institucional
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
                  Para farmácias, hospitais,<br />clínicas e lares.
                </h2>
                <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 0 }}>
                  Ward + Connect + Rounds + Residentes para toda a equipa. Múltiplos utilizadores, dashboard de risco institucional, relatórios de acreditação. Contacto directo sem compromisso.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                <Link href="/institucional"
                  style={{ padding: '14px 28px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center', display: 'block', whiteSpace: 'nowrap' }}>
                  Ver plano institucional
                </Link>
                <Link href="/pricing"
                  style={{ padding: '12px 24px', background: 'white', color: 'var(--ink-3)', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', textAlign: 'center', display: 'block' }}>
                  Comparar todos os planos
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FONTES ────────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '28px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.16em', flexShrink: 0 }}>Fontes verificáveis</span>
            {['OpenFDA', 'INFARMED', 'EMA', 'RxNorm · NIH', 'ESC 2024', 'ADA 2024', 'NICE', 'DGS', 'KDIGO', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} className="source-pill">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 0', background: '#0c0f1a', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="page-container" style={{ textAlign: 'center', position: 'relative', maxWidth: 560 }}>
          <Reveal>
            {/* Headline final — directa, sem exagero */}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#374151', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>
              Começa hoje
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,4.5vw,56px)', color: '#f9fafb', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 20 }}>
              Grátis para sempre.
            </h2>
            <p style={{ fontSize: 15, color: '#4b5563', marginBottom: 40, lineHeight: 1.75 }}>
              Três ferramentas sem conta. Upgrade quando fizer sentido. Cancela sem consequências.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/login"
                style={{ padding: '14px 32px', background: '#22c55e', color: '#0c0f1a', textDecoration: 'none', borderRadius: 7, fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                className="hero-cta-primary">
                Criar conta grátis
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <Link href="/pricing"
                style={{ padding: '14px 22px', background: 'transparent', color: '#6b7280', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, border: '1px solid #1f2937' }}>
                Ver planos
              </Link>
            </div>
            <div style={{ marginTop: 40, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              © 2026 Phlox Clinical · Feito em Portugal
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        .hero-cta-primary:hover { background: #16a34a !important; transform: translateY(-2px); }
        .hero-cta-secondary:hover { border-color: #374151 !important; color: #d1d5db !important; }
        .free-tool-link:hover { color: var(--green) !important; background: var(--bg) !important; }
        .pro-tool-row:hover { background: var(--bg) !important; }
        .student-card:hover { border-color: rgba(124,58,237,0.4) !important; transform: translateY(-3px); }
        .persona-tile:hover { background: var(--bg) !important; }
        @keyframes pulse-green { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media(max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
        }
        @media(max-width: 768px) {
          .free-tools-bar { display: none !important; }
          .pro-tool-row { padding: 20px 0 !important; }
          .pro-tool-row-num { display: none !important; }
          .pro-tool-row-detail-col { flex: 1 !important; }
        }
      `}</style>
    </div>
  )
}