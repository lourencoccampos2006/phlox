'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useEffect, useRef } from 'react'

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ─── Live interaction demo ────────────────────────────────────────────────────
const DEMOS = [
  {
    drugs: ['Varfarina', 'Ibuprofeno'],
    sev: 'GRAVE', sevColor: '#dc2626', sevBg: '#450a0a',
    line1: 'Inibição COX-1 plaquetária + deslocamento da albumina.',
    line2: 'Risco de hemorragia grave — INR descontrolado.',
    alt: 'Paracetamol · AINE tópico',
  },
  {
    drugs: ['Sertralina', 'Tramadol'],
    sev: 'GRAVE', sevColor: '#dc2626', sevBg: '#450a0a',
    line1: 'Efeito aditivo serotoninérgico — ISRS + agonismo 5-HT.',
    line2: 'Síndrome serotoninérgica — hipertermia, clonus, instabilidade autonómica.',
    alt: 'Paracetamol para dor · evitar opióides com acção serotonin.',
  },
  {
    drugs: ['Atorvastatina', 'Claritromicina'],
    sev: 'MODERADA', sevColor: '#d97706', sevBg: '#451a03',
    line1: 'Claritromicina inibe CYP3A4 → AUC da estatina ×4.',
    line2: 'Risco de miopatia e rabdomiólise.',
    alt: 'Suspender estatina durante o antibiótico',
  },
]

function InteractionTerminal() {
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)
  const d = DEMOS[active]

  const cycle = (i: number) => {
    setFading(true)
    setTimeout(() => { setActive(i); setFading(false) }, 140)
  }

  return (
    <div style={{
      background: '#09090b',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid #27272a',
      fontFamily: 'var(--font-mono)',
    }}>
      {/* Window chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #18181b' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706', opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
        <span style={{ marginLeft: 8, fontSize: 10, color: '#52525b', letterSpacing: '0.06em' }}>phlox — verificador de interações</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #18181b' }}>
        {DEMOS.map((demo, i) => (
          <button key={i} onClick={() => cycle(i)}
            style={{
              padding: '8px 14px', background: 'none', border: 'none',
              borderBottom: `1px solid ${active === i ? '#22c55e' : 'transparent'}`,
              cursor: 'pointer', fontSize: 10, color: active === i ? '#22c55e' : '#52525b',
              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em',
              marginBottom: -1, transition: 'color 0.1s',
            }}>
            {demo.drugs.join(' + ')}
          </button>
        ))}
      </div>

      {/* Output */}
      <div style={{
        padding: '20px',
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(4px)' : 'none',
        transition: 'opacity 0.14s, transform 0.14s',
      }}>
        {/* Prompt line */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
          <span style={{ color: '#22c55e', fontSize: 12, flexShrink: 0 }}>$</span>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            phlox check {d.drugs.map(x => x.toLowerCase()).join(' ')}
          </span>
        </div>

        {/* Result */}
        <div style={{ background: d.sevBg, border: `1px solid ${d.sevColor}40`, borderLeft: `3px solid ${d.sevColor}`, borderRadius: 6, padding: '14px' }}>
          <div style={{ fontSize: 9, color: d.sevColor, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            [{d.sev}]
          </div>
          <div style={{ fontSize: 12, color: '#f4f4f5', lineHeight: 1.7, marginBottom: 6 }}>{d.line1}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7 }}>{d.line2}</div>
        </div>

        {/* Alt */}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#52525b' }}>alternativa</span>
          <span style={{ fontSize: 10, color: '#22c55e' }}>{d.alt}</span>
        </div>

        {/* Try it */}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Link href="/interactions" style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: '#22c55e', textDecoration: 'none', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            verificar os teus medicamentos
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Section heading component ────────────────────────────────────────────────
function SectionLabel({ children, color = '#22c55e' }: { children: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 24, height: 1, background: color }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const { ref, visible } = useReveal()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!visible) return
    const dur = 1400
    const start = Date.now()
    const tick = () => {
      const t = Math.min((Date.now() - start) / dur, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setN(Math.round(ease * to))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, to])
  return <span ref={ref}>{n}{suffix}</span>
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomePage() {

  // Scroll-based parallax for hero text
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#050508', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
      <Header />

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section ref={heroRef} style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* Grain texture overlay */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
          pointerEvents: 'none',
        }} />

        {/* Vertical rule — far left, editorial */}
        <div aria-hidden style={{
          position: 'absolute', left: 48, top: 0, bottom: 0,
          width: 1, background: 'linear-gradient(to bottom, transparent 0%, #27272a 20%, #27272a 80%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Large background type — texture, not content */}
        <div aria-hidden style={{
          position: 'absolute', right: -40, top: '50%',
          transform: `translateY(calc(-50% + ${scrollY * 0.12}px))`,
          fontFamily: 'var(--font-serif)', fontSize: 'clamp(180px,22vw,340px)',
          color: 'transparent', WebkitTextStroke: '1px #18181b',
          lineHeight: 1, letterSpacing: '-0.06em', userSelect: 'none',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Phlox
        </div>

        <div className="page-container" style={{ position: 'relative', zIndex: 1, paddingTop: 80, paddingBottom: 80 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'clamp(40px,6vw,100px)',
            alignItems: 'center',
          }} className="hero-grid">

            {/* Left */}
            <div style={{ transform: `translateY(${scrollY * -0.06}px)` }}>
              <SectionLabel>Farmacologia clínica · Portugal</SectionLabel>

              {/* Headline — typographic, editorial, NOT marketing */}
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(38px,5vw,68px)',
                color: '#fafafa',
                fontWeight: 400,
                lineHeight: 1.06,
                letterSpacing: '-0.035em',
                margin: '0 0 clamp(24px,3vw,40px)',
              }}>
                Farmacologia<br />
                sem<br />
                <span style={{ color: '#22c55e', fontStyle: 'italic' }}>compromissos.</span>
              </h1>

              <p style={{
                fontSize: 'clamp(14px,1.6vw,17px)',
                color: '#71717a',
                lineHeight: 1.85,
                maxWidth: 400,
                margin: '0 0 clamp(28px,3vw,44px)',
              }}>
                Para quem trabalha em clínica e não tolera ferramentas medíocres. Para estudantes que levam a sério a competição. Para famílias que precisam de perceber.
              </p>

              {/* CTA — minimal, confident */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
                <Link href="/login"
                  style={{
                    padding: '12px 28px',
                    background: '#22c55e',
                    color: '#050508',
                    textDecoration: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.01em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s',
                  }}
                  className="cta-primary">
                  Começar — é grátis
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/interactions"
                  style={{
                    padding: '12px 20px',
                    background: 'transparent',
                    color: '#52525b',
                    textDecoration: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    border: '1px solid #27272a',
                    transition: 'all 0.15s',
                  }}
                  className="cta-ghost">
                  Verificar interações sem conta →
                </Link>
              </div>

              {/* Stats — horizontal, minimal */}
              <div style={{ display: 'flex', gap: 32, borderTop: '1px solid #18181b', paddingTop: 24 }}>
                {[
                  { n: 35, s: '+', label: 'ferramentas' },
                  { n: 10, s: '', label: 'domínios clínicos' },
                  { n: 0, s: '€', label: 'para começar' },
                ].map(({ n, s, label }) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#fafafa', lineHeight: 1 }}>
                      {n === 0 ? '0€' : <><Counter to={n} suffix={s} /></>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 5 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Terminal demo */}
            <div style={{ transform: `translateY(${scrollY * -0.03}px)` }}>
              <InteractionTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FREE TOOLS ───────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #18181b', borderBottom: '1px solid #18181b', background: '#09090b' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 0 0', flexShrink: 0, marginRight: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22c55e', letterSpacing: '0.16em', textTransform: 'uppercase', border: '1px solid #22c55e40', borderRadius: 20, padding: '3px 10px' }}>
                Grátis
              </span>
            </div>
            {[
              { label: 'Interações', href: '/interactions' },
              { label: 'Tradutor de Bula', href: '/bula' },
              { label: 'Dose Pediátrica', href: '/dose-crianca' },
              { label: 'Calculadoras', href: '/calculators' },
              { label: 'Escalas Clínicas', href: '/escalas' },
            ].map(t => (
              <Link key={t.href} href={t.href}
                className="free-tool"
                style={{
                  padding: '13px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#52525b',
                  textDecoration: 'none',
                  borderLeft: '1px solid #18181b',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.1s',
                  display: 'block',
                }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── PROFISSIONAIS ──────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 0', background: '#050508' }}>
        <div className="page-container">

          {(() => {
            const { ref, visible } = useReveal()
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(32px)', transition: 'opacity 0.7s, transform 0.7s' }}>
                <SectionLabel color="#3b82f6">Para profissionais</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(40px,6vw,80px)', alignItems: 'end', marginBottom: 60 }} className="section-grid">
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,52px)', color: '#fafafa', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                    Ferramentas feitas<br />para o trabalho real.
                  </h2>
                  <div>
                    <p style={{ fontSize: 15, color: '#52525b', lineHeight: 1.85, marginBottom: 20 }}>
                      Farmácias, hospitais, clínicas, lares. Substitui o papel, o fax e o WhatsApp clínico. Ward colaborativo, passagem de turno AI, ronda farmacêutica PCNE, cartas de referenciação.
                    </p>
                    <Link href="/institucional" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#3b82f6', textDecoration: 'none', fontWeight: 700, letterSpacing: '0.06em' }}>
                      Ver plano institucional →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Tool list — editorial horizontal lines */}
          {[
            { n: '01', title: 'Phlox Ward', sub: 'Ficha colaborativa · passagem de turno AI · histórico auditável', color: '#3b82f6', href: '/teams' },
            { n: '02', title: 'Phlox Connect', sub: 'Comunicação inter-profissional documentada e aceite', color: '#22c55e', href: '/connect' },
            { n: '03', title: 'Phlox Rounds', sub: 'Ronda farmacêutica digital · classificação PCNE v9.1', color: '#a78bfa', href: '/rounds' },
            { n: '04', title: 'Phlox Carta', sub: 'Referenciação · nota de alta · intervenção farmacêutica', color: '#38bdf8', href: '/carta', badge: 'Novo' },
            { n: '05', title: 'Phlox Residentes', sub: 'Revisão AI · STOPP/START + Beers · relatório acreditação', color: '#f87171', href: '/residentes', badge: 'Novo' },
            { n: '06', title: 'Phlox Migração', sub: 'Importa de Sifarma · SClínico · PHC · Excel · MySNS', color: '#fb923c', href: '/migrar', badge: 'Novo' },
          ].map((tool, i) => {
            const { ref, visible } = useReveal(0.05)
            return (
              <div key={tool.n} ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateX(-16px)', transition: `opacity 0.5s ${i * 0.07}s, transform 0.5s ${i * 0.07}s` }}>
                <Link href={tool.href}
                  className="tool-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'clamp(12px,2vw,32px)',
                    padding: 'clamp(16px,2vw,24px) 0',
                    borderTop: '1px solid #18181b',
                    textDecoration: 'none', transition: 'border-color 0.15s',
                    cursor: 'pointer',
                  }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#3f3f46', width: 28, flexShrink: 0 }}>{tool.n}</span>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: tool.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(16px,2vw,22px)', color: '#fafafa', letterSpacing: '-0.01em', flexShrink: 0 }}>
                    {tool.title}
                  </span>
                  {'badge' in tool && tool.badge && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, color: tool.color, background: `${tool.color}18`, border: `1px solid ${tool.color}30`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {tool.badge}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: '#3f3f46', marginLeft: 'auto', textAlign: 'right', maxWidth: 280, lineHeight: 1.4 }}>{tool.sub}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27272a" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid #18181b' }} />
        </div>
      </section>

      {/* ─── ESTUDANTES ──────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 0', background: '#09090b', borderTop: '1px solid #18181b' }}>
        <div className="page-container">
          {(() => {
            const { ref, visible } = useReveal()
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(32px)', transition: 'opacity 0.7s, transform 0.7s', marginBottom: 60 }}>
                <SectionLabel color="#a78bfa">Para estudantes</SectionLabel>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,52px)', color: '#fafafa', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 560, marginBottom: 20 }}>
                  Treina como<br />
                  <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>um especialista</span><br />
                  treina.
                </h2>
                <p style={{ fontSize: 15, color: '#52525b', lineHeight: 1.85, maxWidth: 480 }}>
                  Medicina, Farmácia, Enfermagem, Nutrição, Dentária, Fisioterapia. Arena, OSCE, Decisão, Hive — o único simulador em português onde o doente evolui com as tuas decisões.
                </p>
              </div>
            )
          })()}

          {/* Student tools — 2×2 grid, dark cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1, background: '#18181b', borderRadius: 12, overflow: 'hidden', border: '1px solid #18181b' }}>
            {[
              { title: 'Phlox Arena', sub: 'Bronze → Diamante · XP real · ranking global', color: '#a78bfa', href: '/arena', desc: 'Liga de conhecimento clínico. 10 domínios, 5 níveis, casos gerados por AI. O ranking existe.' },
              { title: 'Phlox OSCE', sub: 'AI como doente · 6 cursos · timer real', color: '#f87171', href: '/osce', desc: 'Simulação de OSCE com a AI no papel do doente. Checklists reais. Feedback por item.' },
              { title: 'Simulador Clínico', sub: 'Caso · Turno · Evolutivo', color: '#34d399', href: '/simulador', desc: 'O modo Evolutivo é único: o doente piora se decides mal. Consequências fisiológicas simuladas.', badge: 'Exclusivo' },
              { title: 'Phlox Hive', sub: 'Inteligência colectiva · pontos cegos', color: '#fbbf24', href: '/hive', desc: 'Os erros mais comuns da comunidade + os teus especificamente. Aprende com os erros de todos.' },
            ].map((t, i) => {
              const { ref, visible } = useReveal(0.05)
              return (
                <div key={t.title} ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: `opacity 0.5s ${i * 0.08}s, transform 0.5s ${i * 0.08}s` }}>
                  <Link href={t.href}
                    className="student-card"
                    style={{ display: 'flex', flexDirection: 'column', padding: 'clamp(20px,3vw,32px)', background: '#09090b', textDecoration: 'none', minHeight: 200, transition: 'background 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, marginTop: 3 }} />
                      {'badge' in t && t.badge && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, color: t.color, background: `${t.color}15`, border: `1px solid ${t.color}30`, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(17px,2vw,22px)', color: '#fafafa', fontWeight: 400, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                      {t.title}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.color, marginBottom: 12, letterSpacing: '0.04em' }}>
                      {t.sub}
                    </div>
                    <p style={{ fontSize: 13, color: '#52525b', lineHeight: 1.65, margin: '0', flex: 1 }}>{t.desc}</p>
                    <div style={{ marginTop: 20, fontFamily: 'var(--font-mono)', fontSize: 10, color: t.color, fontWeight: 700 }}>→ abrir</div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── PERSONAS ─────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 0', background: '#050508', borderTop: '1px solid #18181b' }}>
        <div className="page-container">
          {(() => {
            const { ref, visible } = useReveal()
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.7s, transform 0.7s', marginBottom: 48 }}>
                <SectionLabel>Para quem</SectionLabel>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.5vw,46px)', color: '#fafafa', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.12 }}>
                  Uma plataforma.<br />Quatro experiências.
                </h2>
              </div>
            )
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 1, border: '1px solid #18181b', borderRadius: 12, overflow: 'hidden', background: '#18181b' }}>
            {[
              { title: 'Profissional', sub: 'Farmácia · Hospital · Clínica · Lar', color: '#3b82f6', href: '/login?mode=clinical', tools: ['Ward — colaborativo', 'Connect — inter-prof.', 'Rounds — PCNE', 'Carta — referenciação', 'Residentes — lares'] },
              { title: 'Estudante', sub: 'Medicina · Farmácia · Enfermagem+', color: '#a78bfa', href: '/login?mode=student', tools: ['Arena — Bronze→Diamante', 'OSCE — AI como doente', 'Simulador — caso evolutivo', 'Hive — colectivo', 'Tutor AI socrático'] },
              { title: 'Cuidador', sub: 'Pais · Filhos · Cônjuge · Avós', color: '#fb923c', href: '/login?mode=caregiver', tools: ['Perfis familiares', 'Care Plan imprimível', 'Monitor de adesão', 'Verificar interações', 'Calendário de tomas'] },
              { title: 'Pessoal', sub: 'A minha saúde', color: '#34d399', href: '/login?mode=personal', tools: ['Os meus medicamentos', 'Análise integrada', 'Registo de saúde', 'Timeline clínica', 'Phlox AI'] },
            ].map((p, i) => {
              const { ref, visible } = useReveal(0.05)
              return (
                <div key={p.title} ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transition: `opacity 0.5s ${i * 0.08}s, transform 0.5s ${i * 0.08}s` }}>
                  <Link href={p.href}
                    className="persona-tile"
                    style={{ display: 'flex', flexDirection: 'column', padding: 'clamp(20px,3vw,28px)', background: '#050508', textDecoration: 'none', height: '100%', transition: 'background 0.1s' }}>
                    <div style={{ width: 20, height: 2, background: p.color, borderRadius: 1, marginBottom: 20 }} />
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(18px,2vw,22px)', color: '#fafafa', fontWeight: 400, marginBottom: 6, lineHeight: 1.2 }}>{p.title}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 22 }}>{p.sub}</div>
                    <div style={{ flex: 1 }}>
                      {p.tools.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: j < p.tools.length - 1 ? '1px solid #18181b' : 'none' }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#52525b' }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 24, fontSize: 11, fontWeight: 700, color: p.color, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      entrar
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── SOURCES ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #18181b', padding: '24px 0', background: '#09090b' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#27272a', textTransform: 'uppercase', letterSpacing: '0.16em', flexShrink: 0 }}>Fontes verificáveis</span>
            {['OpenFDA', 'INFARMED', 'EMA', 'RxNorm', 'ESC 2024', 'ADA 2024', 'NICE', 'DGS', 'KDIGO', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3f3f46', padding: '3px 8px', border: '1px solid #27272a', borderRadius: 4 }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CTA FINAL ────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(80px,10vw,140px) 0', background: '#050508', borderTop: '1px solid #18181b' }}>
        <div className="page-container" style={{ maxWidth: 600 }}>
          {(() => {
            const { ref, visible } = useReveal()
            return (
              <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(24px)', transition: 'opacity 0.7s, transform 0.7s', textAlign: 'center' }}>
                <SectionLabel>Começa hoje</SectionLabel>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px,5vw,62px)', color: '#fafafa', fontWeight: 400, letterSpacing: '-0.035em', lineHeight: 1.08, marginBottom: 20 }}>
                  Grátis.<br />Sem cartão.<br />Sem compromissos.
                </h2>
                <p style={{ fontSize: 15, color: '#52525b', marginBottom: 40, lineHeight: 1.8 }}>
                  Três ferramentas sem conta. Upgrade quando fizer sentido. Cancela sem consequências.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/login"
                    style={{ padding: '13px 32px', background: '#22c55e', color: '#050508', textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                    className="cta-primary">
                    Criar conta grátis
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                  <Link href="/pricing"
                    style={{ padding: '13px 22px', background: 'transparent', color: '#3f3f46', textDecoration: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, border: '1px solid #27272a', transition: 'all 0.15s' }}
                    className="cta-ghost">
                    Ver planos
                  </Link>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* Footer minimal */}
      <div style={{ borderTop: '1px solid #18181b', padding: '16px 0', background: '#050508' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#27272a', letterSpacing: '0.1em' }}>© 2026 PHLOX CLINICAL · FEITO EM PORTUGAL</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Termos', '/terms'], ['Privacidade', '/privacy'], ['Institucional', '/institucional']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3f3f46', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.1s' }} className="footer-link">{label}</Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .cta-primary:hover { transform: translateY(-2px); background: #16a34a !important; }
        .cta-ghost:hover { color: #a1a1aa !important; border-color: #3f3f46 !important; }
        .free-tool:hover { color: #22c55e !important; }
        .tool-row:hover { border-color: #27272a !important; }
        .tool-row:hover svg { stroke: #52525b !important; }
        .student-card:hover { background: #111113 !important; }
        .persona-tile:hover { background: #111113 !important; }
        .footer-link:hover { color: #71717a !important; }
        @media(max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .section-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        @media(max-width: 600px) {
          .tool-row { flex-wrap: wrap; gap: 8px; }
          .tool-row span:last-of-type { display: none; }
        }
      `}</style>
    </div>
  )
}