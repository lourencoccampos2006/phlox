'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ─── Scroll reveal ─────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
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

function RevealSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(28px)',
      transition: `opacity 0.7s ${delay}s, transform 0.7s ${delay}s`,
    }}>
      {children}
    </div>
  )
}

// ─── Animated counter ──────────────────────────────────────────────────────────
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

// ─── Interaction terminal demo ─────────────────────────────────────────────────
const DEMOS = [
  {
    drugs: ['Varfarina', 'Ibuprofeno'],
    sev: 'GRAVE', sevColor: '#dc2626', sevBg: '#fef2f2',
    line1: 'Inibição COX-1 plaquetária + deslocamento da albumina.',
    line2: 'Risco de hemorragia grave — INR descontrolado.',
    alt: 'Paracetamol · AINE tópico',
  },
  {
    drugs: ['Sertralina', 'Tramadol'],
    sev: 'GRAVE', sevColor: '#dc2626', sevBg: '#fef2f2',
    line1: 'Efeito aditivo serotoninérgico — ISRS + agonismo 5-HT.',
    line2: 'Síndrome serotoninérgica — hipertermia, clonus, instabilidade autonómica.',
    alt: 'Paracetamol para dor · evitar opióides serotoninérgicos',
  },
  {
    drugs: ['Atorvastatina', 'Claritromicina'],
    sev: 'MODERADA', sevColor: '#d97706', sevBg: '#fffbeb',
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
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #27272a',
      fontFamily: 'var(--font-mono)',
      boxShadow: '0 32px 80px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #18181b' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#d97706', opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', opacity: 0.7 }} />
        <span style={{ marginLeft: 8, fontSize: 10, color: '#52525b', letterSpacing: '0.06em' }}>phlox — verificador de interações</span>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #18181b' }}>
        {DEMOS.map((demo, i) => (
          <button key={i} onClick={() => cycle(i)}
            style={{
              padding: '8px 14px', background: 'none', border: 'none',
              borderBottom: `2px solid ${active === i ? '#22c55e' : 'transparent'}`,
              cursor: 'pointer', fontSize: 10, color: active === i ? '#22c55e' : '#52525b',
              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em',
              marginBottom: -1, transition: 'color 0.1s',
            }}>
            {demo.drugs.join(' + ')}
          </button>
        ))}
      </div>
      <div style={{
        padding: '20px',
        opacity: fading ? 0 : 1,
        transform: fading ? 'translateY(4px)' : 'none',
        transition: 'opacity 0.14s, transform 0.14s',
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
          <span style={{ color: '#22c55e', fontSize: 12, flexShrink: 0 }}>$</span>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>
            phlox check {d.drugs.map(x => x.toLowerCase()).join(' ')}
          </span>
        </div>
        <div style={{ background: '#111113', border: `1px solid ${d.sevColor}40`, borderLeft: `3px solid ${d.sevColor}`, borderRadius: 6, padding: '14px' }}>
          <div style={{ fontSize: 9, color: d.sevColor, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            [{d.sev}]
          </div>
          <div style={{ fontSize: 12, color: '#f4f4f5', lineHeight: 1.7, marginBottom: 6 }}>{d.line1}</div>
          <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.7 }}>{d.line2}</div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#52525b' }}>alternativa</span>
          <span style={{ fontSize: 10, color: '#22c55e' }}>{d.alt}</span>
        </div>
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

// ─── Persona section ───────────────────────────────────────────────────────────
function PersonaSection({ bg, label, heading, headingAccent, accentColor, description, tools, ctaHref, ctaLabel, dark = false }: {
  bg: string; label: string
  heading: string; headingAccent?: string; accentColor: string
  description: string; tools: string[]; ctaHref: string; ctaLabel: string; dark?: boolean
}) {
  return (
    <section style={{ background: bg, padding: '80px 0' }}>
      <div className="page-container">
        <RevealSection>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(40px,6vw,80px)', alignItems: 'center' }} className="persona-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: `${accentColor}15`, border: `1px solid ${accentColor}30`, marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
              </div>
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(28px,4vw,52px)',
                color: dark ? '#f8fafc' : '#1d1d1f',
                fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1,
                margin: '0 0 20px',
              }}>
                {heading}
                {headingAccent && <><br /><span style={{ color: accentColor, fontStyle: 'italic' }}>{headingAccent}</span></>}
              </h2>
              <p style={{ fontSize: 16, color: dark ? '#94a3b8' : '#6e6e73', lineHeight: 1.8, margin: '0 0 28px', maxWidth: 440 }}>
                {description}
              </p>
              <Link href={ctaHref} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', background: accentColor, color: 'white',
                textDecoration: 'none', borderRadius: 100, fontSize: 14, fontWeight: 700,
                transition: 'all 0.15s',
              }} className="persona-cta">
                {ctaLabel}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
            <div style={{
              background: dark ? '#1e293b' : 'white',
              borderRadius: 16,
              border: `1px solid ${dark ? '#334155' : 'rgba(0,0,0,0.06)'}`,
              padding: '24px',
              boxShadow: dark ? 'none' : '0 8px 32px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Ferramentas incluídas
              </div>
              {tools.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: i < tools.length - 1 ? `1px solid ${dark ? '#1e293b' : '#f1f5f9'}` : 'none',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: dark ? '#e2e8f0' : '#1d1d1f', fontWeight: 500 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div style={{ background: 'white', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'white', position: 'relative', overflow: 'hidden', paddingTop: 56 }}>

        {/* Subtle radial glow */}
        <div aria-hidden style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '80vw', height: '60vh',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="page-container" style={{ position: 'relative', zIndex: 1, paddingTop: 60, paddingBottom: 40, textAlign: 'center' }}>
          <div style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'none' : 'translateY(24px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}>
            {/* Eyebrow */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 32 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', letterSpacing: '0.06em' }}>Farmacologia Clínica · Portugal</span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(48px,7vw,100px)',
              color: '#1d1d1f',
              fontWeight: 400,
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
              margin: '0 0 clamp(20px,3vw,36px)',
            }}>
              A farmacologia que<br />
              o seu paciente<br />
              <span style={{ color: '#16a34a', fontStyle: 'italic' }}>merece.</span>
            </h1>

            {/* Sub */}
            <p style={{
              fontSize: 18, color: '#6e6e73', lineHeight: 1.8,
              maxWidth: 520, margin: '0 auto clamp(32px,4vw,48px)',
            }}>
              Para profissionais, estudantes, cuidadores e para a sua própria saúde. Ferramentas clínicas sérias, em português, grátis para começar.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
              <Link href="/login" style={{
                padding: '14px 32px', background: '#1d1d1f', color: 'white',
                textDecoration: 'none', borderRadius: 100, fontSize: 15, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'all 0.2s',
              }} className="hero-cta-primary">
                Começar grátis →
              </Link>
              <Link href="/ferramentas" style={{
                padding: '14px 28px', background: 'transparent', color: '#1d1d1f',
                textDecoration: 'none', borderRadius: 100, fontSize: 15, fontWeight: 500,
                border: '1px solid rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
              }} className="hero-cta-ghost">
                Ver ferramentas
              </Link>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 32, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {[
                { n: 35, s: '+', label: 'ferramentas' },
                { n: 10, s: '', label: 'domínios clínicos' },
                { n: 0, s: '€', label: 'para começar' },
              ].map(({ n, s, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: '#1d1d1f', lineHeight: 1, marginBottom: 4 }}>
                    {n === 0 ? '0€' : <Counter to={n} suffix={s} />}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FREE TOOLS BAR ────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fafafa' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 0 0', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#16a34a', letterSpacing: '0.14em', textTransform: 'uppercase', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', background: '#f0fdf4', whiteSpace: 'nowrap' }}>
                Grátis
              </span>
            </div>
            {[
              { label: 'Interações', href: '/interactions' },
              { label: 'Bula', href: '/bula' },
              { label: 'Dose Pediátrica', href: '/dose-crianca' },
              { label: 'Calculadoras', href: '/calculators' },
              { label: 'Escalas', href: '/escalas' },
            ].map(t => (
              <Link key={t.href} href={t.href}
                className="free-tool-lp"
                style={{
                  padding: '14px 18px', fontSize: 13, fontWeight: 500,
                  color: '#6e6e73', textDecoration: 'none',
                  borderLeft: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'nowrap',
                  transition: 'color 0.1s', display: 'block',
                }}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── DEMO SECTION ──────────────────────────────────────────────────── */}
      <section style={{ background: '#f5f5f7', padding: '100px 0' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(40px,6vw,80px)', alignItems: 'center' }} className="demo-grid">
            <RevealSection>
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(28px,4vw,52px)',
                color: '#1d1d1f', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 20px',
              }}>
                Verifica qualquer combinação de medicamentos em segundos.
              </h2>
              <p style={{ fontSize: 16, color: '#6e6e73', lineHeight: 1.8, margin: '0 0 28px' }}>
                Base de dados clínica verificável — INFARMED, EMA, DrugBank. Mecanismo de interação, gravidade e alternativas terapêuticas, sempre com fontes.
              </p>
              <Link href="/interactions" style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Verificar interações grátis
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </RevealSection>
            <RevealSection delay={0.1}>
              <InteractionTerminal />
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ─── FEATURE GRID (premium) ────────────────────────────────────────── */}
      <section style={{ background: 'white', padding: 'clamp(64px,8vw,110px) 0' }}>
        <div className="page-container">
          <RevealSection>
            <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto clamp(36px,5vw,56px)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#16a34a', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Porquê Phlox</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,48px)', color: '#1d1d1f', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.12, margin: 0 }}>
                Uma plataforma que se <span style={{ color: '#16a34a', fontStyle: 'italic' }}>adapta a si</span>.
              </h2>
            </div>
          </RevealSection>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px),1fr))', gap: 18 }}>
            {[
              { icon: '🧠', title: 'Inteligência clínica real', body: 'Interações, doses, escalas e protocolos baseados em fontes verificáveis — não em palpites.', c: '#16a34a' },
              { icon: '📷', title: 'Basta uma foto', body: 'Fotografa a caixa, a receita ou uma ferida. A IA lê, percebe e explica em segundos.', c: '#2563eb' },
              { icon: '👨‍👩‍👧', title: 'Toda a família num lugar', body: 'Um perfil por familiar. Medicação, sintomas e sinais vitais sempre organizados.', c: '#b45309' },
              { icon: '🏥', title: 'Feito para instituições', body: 'Lares, farmácias, clínicas e centros de saúde — fluxos de trabalho a sério, em português.', c: '#7c3aed' },
              { icon: '🎓', title: 'Estudar e treinar', body: 'Arena, simuladores, flashcards e atlas 3D. Aprende como um especialista treina.', c: '#0891b2' },
              { icon: '🔒', title: 'Privado e seguro', body: 'Os teus dados são teus. Acesso controlado, auditável e em conformidade com o RGPD.', c: '#0d6e42' },
            ].map((f, i) => (
              <RevealSection key={f.title} delay={i * 0.05}>
                <div className="feat-card" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: '26px 24px', height: '100%', transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${f.c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{f.title}</h3>
                  <p style={{ fontSize: 14.5, color: '#6e6e73', lineHeight: 1.65, margin: 0 }}>{f.body}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MARQUEE (animated band) ───────────────────────────────────────── */}
      <div style={{ background: '#0d6e42', overflow: 'hidden', padding: '16px 0' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', width: 'max-content' }}>
          {[...Array(2)].map((_, dup) => (
            <div key={dup} style={{ display: 'flex', gap: 40, alignItems: 'center' }} aria-hidden={dup === 1}>
              {['Interações medicamentosas', 'Doses pediátricas', 'Escalas clínicas', 'Análise de feridas por IA', 'Leitor de receitas', 'Atlas 3D', 'Simulador clínico', 'MAR digital', 'Portal família', 'Calculadoras', 'Primeiros socorros'].map(t => (
                <span key={t + dup} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sans)' }}>
                  {t}<span style={{ color: 'rgba(255,255,255,0.4)' }}>✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 4 PERSONAS ────────────────────────────────────────────────────── */}
      <PersonaSection
        bg="#0f172a"
        dark
        label="Para profissionais de saúde"
        heading="Farmácia clínica"
        headingAccent="sem papel."
        accentColor="#3b82f6"
        description="Ward colaborativo, ronda farmacêutica PCNE, MAR digital, passagem de turno AI. Para farmácias, hospitais, clínicas e lares."
        tools={['Turno — gestão de doentes e doses', 'Ronda Farmacêutica PCNE v9.1', 'MAR — registo de administração', 'Oracle AI — SOAP e intervenção', 'Calculadoras — SCORE2, CKD-EPI', 'Carta de Alta — IA']}
        ctaHref="/login?mode=clinical"
        ctaLabel="Começar como profissional"
      />

      <PersonaSection
        bg="white"
        label="Para estudantes de ciências da saúde"
        heading="Treina como"
        headingAccent="um especialista treina."
        accentColor="#7c3aed"
        description="Medicina, Farmácia, Enfermagem, Nutrição. Arena, OSCE, Simulador com doente evolutivo, AI Tutor socrático."
        tools={['Arena — Bronze → Diamante', 'Simulador Clínico — 3 modos', 'OSCE — AI como doente', 'Flashcards — 200+ tópicos', 'AI Tutor socrático', 'Progresso e XP']}
        ctaHref="/login?mode=student"
        ctaLabel="Começar a estudar"
      />

      <PersonaSection
        bg="#f5f5f7"
        label="Para quem cuida"
        heading="Toda a família"
        headingAccent="num só lugar."
        accentColor="#b45309"
        description="Perfis familiares, calendário de tomas, verificação automática de interações, passaporte de saúde com QR code."
        tools={['Perfis Familiares', 'Calendário de tomas semanal', 'Verificar interações', 'Passaporte de saúde', 'Horário inteligente AI', 'Monitor de adesão']}
        ctaHref="/login?mode=caregiver"
        ctaLabel="Começar a cuidar"
      />

      <PersonaSection
        bg="white"
        label="Para a sua saúde pessoal"
        heading="A sua medicação,"
        headingAccent="sob controlo."
        accentColor="#0d6e42"
        description="Liste os seus medicamentos, receba lembretes, verifique interações e fale com o Phlox AI sobre qualquer dúvida de saúde."
        tools={['Os Meus Medicamentos', 'Lembretes e adesão', 'Verificar interações', 'Sinais vitais', 'Phlox AI', 'Passaporte de saúde']}
        ctaHref="/login?mode=personal"
        ctaLabel="Começar grátis"
      />

      {/* ─── SOURCES BAR ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '28px 0', background: '#fafafa' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.14em', flexShrink: 0 }}>Fontes verificáveis</span>
            {['INFARMED', 'EMA', 'DGS', 'OpenFDA', 'RxNorm', 'ESC 2024', 'ADA 2024', 'NICE', 'KDIGO', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9ca3af', padding: '3px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 4, background: 'white' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ background: '#000', padding: '100px 0' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 600 }}>
          <RevealSection>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(40px,6vw,80px)',
              color: 'white', fontWeight: 400,
              letterSpacing: '-0.04em', lineHeight: 1.05,
              margin: '0 0 24px',
            }}>
              Grátis.<br />Sem cartão.<br />Sem compromissos.
            </h2>
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.8, margin: '0 0 40px' }}>
              Três ferramentas sem conta. Upgrade quando fizer sentido. Cancela quando quiser.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '16px 36px', background: 'white', color: '#000',
              textDecoration: 'none', borderRadius: 100, fontSize: 15, fontWeight: 800,
              transition: 'all 0.2s',
            }} className="final-cta">
              Criar conta grátis
            </Link>
          </RevealSection>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#000', borderTop: '1px solid #111', padding: '20px 0' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#374151', letterSpacing: '0.1em' }}>© 2026 PHLOX CLINICAL · FEITO EM PORTUGAL</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Termos', '/terms'], ['Privacidade', '/privacy'], ['Institucional', '/institucional']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4b5563', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.1s' }} className="footer-lp-link">{label}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes heroIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .hero-cta-primary:hover { background:#333 !important; transform:translateY(-2px); }
        .hero-cta-ghost:hover { background:rgba(0,0,0,0.04) !important; }
        .free-tool-lp:hover { color:#16a34a !important; }
        .persona-cta:hover { opacity:0.85; transform:translateY(-2px); }
        .final-cta:hover { opacity:0.9; transform:translateY(-2px); }
        .footer-lp-link:hover { color:#9ca3af !important; }
        .feat-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,0.08); border-color:rgba(0,0,0,0.12) !important; }
        @keyframes marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        .marquee-track { animation: marquee 26s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        @media(max-width:900px) {
          .demo-grid { grid-template-columns:1fr !important; }
          .persona-grid { grid-template-columns:1fr !important; }
        }
        @media(max-width:560px) {
          .hero-cta-primary, .hero-cta-ghost { width:100%; justify-content:center; box-sizing:border-box; }
        }
        @media(prefers-reduced-motion: reduce) {
          .marquee-track { animation:none; }
        }
      `}</style>
    </div>
  )
}
