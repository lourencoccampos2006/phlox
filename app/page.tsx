'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ─── Editorial palette (alinhada com globals.css) ───────────────────────────
const INK = '#16181d'
const INK_3 = '#585c66'
const INK_4 = '#8b8f99'
const GREEN = '#0d6e42'
const BORDER = '#e7e8ea'
const BORDER_2 = '#d2d4d8'

// ─── Scroll reveal (subtil, respeitando reduced-motion via globals.css) ──────
function useReveal(threshold = 0.14) {
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

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(14px)',
      transition: `opacity 0.6s ${delay}s cubic-bezier(0.16,1,0.3,1), transform 0.6s ${delay}s cubic-bezier(0.16,1,0.3,1)`,
    }}>
      {children}
    </div>
  )
}

// ─── Demo verificador (prova concreta, mantida — é forte) ────────────────────
const DEMOS = [
  {
    drugs: ['Varfarina', 'Ibuprofeno'],
    sev: 'GRAVE', sevColor: '#a82828',
    line1: 'Inibição COX-1 plaquetária + deslocamento da albumina.',
    line2: 'Risco de hemorragia grave — INR descontrolado.',
    alt: 'Paracetamol · AINE tópico',
  },
  {
    drugs: ['Sertralina', 'Tramadol'],
    sev: 'GRAVE', sevColor: '#a82828',
    line1: 'Efeito aditivo serotoninérgico — ISRS + agonismo 5-HT.',
    line2: 'Síndrome serotoninérgica — hipertermia, clonus, instabilidade autonómica.',
    alt: 'Paracetamol para dor · evitar opióides serotoninérgicos',
  },
  {
    drugs: ['Atorvastatina', 'Claritromicina'],
    sev: 'MODERADA', sevColor: '#8a5a16',
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
    setTimeout(() => { setActive(i); setFading(false) }, 130)
  }

  return (
    <div style={{
      background: '#0c0d10',
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid #23252b',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: '1px solid #18191d' }}>
        <span style={{ fontSize: 10, color: '#52555e', letterSpacing: '0.08em' }}>phlox · verificador de interações</span>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #18191d' }}>
        {DEMOS.map((demo, i) => (
          <button key={i} onClick={() => cycle(i)}
            style={{
              padding: '9px 14px', background: 'none', border: 'none',
              borderBottom: `2px solid ${active === i ? GREEN : 'transparent'}`,
              cursor: 'pointer', fontSize: 10, color: active === i ? '#cbd5cd' : '#52555e',
              fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.03em',
              marginBottom: -1, transition: 'color 0.15s',
            }}>
            {demo.drugs.join(' + ')}
          </button>
        ))}
      </div>
      <div style={{
        padding: 20,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.14s',
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <span style={{ color: GREEN, fontSize: 12 }}>$</span>
          <span style={{ fontSize: 12, color: '#9598a1' }}>
            phlox check {d.drugs.map(x => x.toLowerCase()).join(' ')}
          </span>
        </div>
        <div style={{ borderLeft: `2px solid ${d.sevColor}`, paddingLeft: 14 }}>
          <div style={{ fontSize: 9, color: d.sevColor, fontWeight: 500, letterSpacing: '0.18em', marginBottom: 10 }}>
            {d.sev}
          </div>
          <div style={{ fontSize: 12.5, color: '#eef0f2', lineHeight: 1.7, marginBottom: 6 }}>{d.line1}</div>
          <div style={{ fontSize: 12.5, color: '#9598a1', lineHeight: 1.7 }}>{d.line2}</div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontSize: 10, color: '#52555e', letterSpacing: '0.1em' }}>ALTERNATIVA</span>
          <span style={{ fontSize: 11, color: '#9fd3b6' }}>{d.alt}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Botão editorial (cantos discretos, sem pill, sem lift) ──────────────────
function BtnPrimary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="ed-btn-primary" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '13px 24px', background: INK, color: '#fff',
      textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
      transition: 'background 0.18s',
    }}>{children}</Link>
  )
}
function BtnGhost({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="ed-btn-ghost" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '13px 22px', background: 'transparent', color: INK,
      textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
      border: `1px solid ${BORDER_2}`, transition: 'border-color 0.18s, background 0.18s',
    }}>{children}</Link>
  )
}

// ─── Persona (layout editorial: tipografia + lista, sem caixa pesada) ────────
function Persona({ kicker, heading, accent, body, tools, ctaHref, ctaLabel, dark = false, index }: {
  kicker: string; heading: string; accent?: string; body: string
  tools: string[]; ctaHref: string; ctaLabel: string; dark?: boolean; index: number
}) {
  const flip = index % 2 === 1
  const ink = dark ? '#f4f5f6' : INK
  const sub = dark ? '#9aa0ab' : INK_3
  const line = dark ? '#23262d' : BORDER
  return (
    <section style={{ background: dark ? '#101216' : '#fff', padding: 'clamp(64px,9vw,108px) 0' }}>
      <div className="page-container">
        <Reveal>
          <div className="persona-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(36px,6vw,88px)', alignItems: 'center',
            direction: flip ? 'rtl' : 'ltr',
          }}>
            <div style={{ direction: 'ltr' }}>
              <div className="kicker" style={{ color: dark ? '#7e8693' : INK_4, marginBottom: 18 }}>{kicker}</div>
              <h2 style={{
                fontFamily: 'var(--font-serif)', fontWeight: 500,
                fontSize: 'clamp(26px,3.6vw,44px)', lineHeight: 1.1, letterSpacing: '-0.02em',
                color: ink, margin: '0 0 18px',
              }}>
                {heading}{accent && <> <span style={{ color: GREEN, fontStyle: 'italic' }}>{accent}</span></>}
              </h2>
              <p style={{ fontSize: 16, color: sub, lineHeight: 1.7, margin: '0 0 26px', maxWidth: '46ch' }}>{body}</p>
              <BtnPrimaryDark href={ctaHref} dark={dark}>{ctaLabel}</BtnPrimaryDark>
            </div>
            <div style={{ direction: 'ltr' }}>
              {tools.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'baseline', gap: 14,
                  padding: '13px 0', borderBottom: `1px solid ${line}`,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: dark ? '#6b7280' : INK_4, minWidth: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: 15, color: ink, fontWeight: 500 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function BtnPrimaryDark({ href, children, dark }: { href: string; children: React.ReactNode; dark: boolean }) {
  return (
    <Link href={href} className={dark ? 'ed-btn-ondark' : 'ed-btn-primary'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '12px 22px', background: dark ? '#fff' : INK, color: dark ? INK : '#fff',
      textDecoration: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
      transition: 'opacity 0.18s, background 0.18s',
    }}>
      {children}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
    </Link>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div style={{ background: '#fff', fontFamily: 'var(--font-sans)', overflowX: 'hidden', color: INK }}>

      {/* ─── HERO — editorial, assimétrico, sem glow ───────────────────────── */}
      <section style={{ paddingTop: 'clamp(96px,14vh,160px)', paddingBottom: 'clamp(48px,8vw,88px)' }}>
        <div className="page-container">
          <div className="hero-grid-ed" style={{
            display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 'clamp(40px,6vw,80px)', alignItems: 'end',
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div>
              <div className="kicker" style={{ marginBottom: 26 }}>Farmacologia clínica · Portugal</div>
              <h1 style={{
                fontFamily: 'var(--font-serif)', fontWeight: 500,
                fontSize: 'clamp(40px,6.4vw,82px)', lineHeight: 1.04, letterSpacing: '-0.03em',
                color: INK, margin: '0 0 26px',
              }}>
                Decisões sobre<br />medicamentos,<br /><span style={{ color: GREEN, fontStyle: 'italic' }}>com fundamento.</span>
              </h1>
              <p className="lead" style={{ margin: '0 0 32px' }}>
                Interações, doses, escalas e protocolos — verificáveis e em português.
                Para profissionais, estudantes, cuidadores e para a tua própria saúde.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <BtnPrimary href="/login">Começar grátis</BtnPrimary>
                <BtnGhost href="/pricing">Ver planos e preços</BtnGhost>
              </div>
            </div>

            {/* Coluna direita: prova concreta, não ilustração genérica */}
            <div className="hero-demo-ed">
              <InteractionTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Régua de números — sem caixas, só tipografia ──────────────────── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { n: '35+', label: 'ferramentas clínicas' },
              { n: '10', label: 'domínios clínicos' },
              { n: '0 €', label: 'para começar' },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '28px 24px',
                borderLeft: i > 0 ? `1px solid ${BORDER}` : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,40px)', color: INK, lineHeight: 1, marginBottom: 8 }}>{s.n}</div>
                <div className="kicker">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── DEMO — explicação ao lado da prova ────────────────────────────── */}
      <section style={{ padding: 'clamp(64px,9vw,108px) 0' }}>
        <div className="page-container">
          <div className="demo-grid-ed" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 'clamp(36px,6vw,80px)', alignItems: 'center' }}>
            <Reveal>
              <div className="kicker" style={{ marginBottom: 16 }}>Verificador de interações</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,3.6vw,44px)', lineHeight: 1.12, letterSpacing: '-0.02em', color: INK, margin: '0 0 18px' }}>
                Qualquer combinação, com mecanismo e gravidade.
              </h2>
              <p style={{ fontSize: 16, color: INK_3, lineHeight: 1.7, margin: '0 0 24px', maxWidth: '48ch' }}>
                Cada resultado mostra o mecanismo da interação, a gravidade e a alternativa terapêutica — fundamentado em fontes que podes consultar.
              </p>
              <Link href="/interactions" className="ed-textlink" style={{ fontSize: 14, fontWeight: 600, color: GREEN, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Verificar os teus medicamentos
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
            </Reveal>
            <Reveal delay={0.08}><InteractionTerminal /></Reveal>
          </div>
        </div>
      </section>

      {/* ─── POSICIONAMENTO — português clínico ────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${BORDER}`, background: '#fafafa', padding: 'clamp(56px,8vw,96px) 0' }}>
        <div className="page-container">
          <Reveal>
            <div style={{ maxWidth: 760 }}>
              <div className="kicker" style={{ marginBottom: 18 }}>Feito para Portugal</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(26px,4vw,46px)', lineHeight: 1.12, letterSpacing: '-0.02em', color: INK, margin: '0 0 18px' }}>
                A única IA de saúde que fala <span style={{ color: GREEN, fontStyle: 'italic' }}>português clínico</span>.
              </h2>
              <p style={{ fontSize: 16.5, color: INK_3, lineHeight: 1.75, maxWidth: '58ch', margin: '0 0 22px' }}>
                Não é tradução. Os fármacos são os que estão nas farmácias portuguesas (Ben-u-ron, Brufen, Concor…), o estado de receita segue as regras do INFARMED, e as guidelines são as que usas cá. Onde as ferramentas globais falham — nomes de marca, comparticipações, contexto do SNS — o Phlox acerta.
              </p>
              <div style={{ display: 'flex', gap: 'clamp(20px,4vw,48px)', flexWrap: 'wrap' }}>
                {[
                  ['Marcas PT', 'reconhece nomes comerciais portugueses, não só DCIs internacionais'],
                  ['Receita INFARMED', 'MNSRM vs MSRM segundo as regras nacionais'],
                  ['Guidelines daqui', 'DGS, ESC, e o que realmente é ensinado em PT'],
                ].map(([t, d]) => (
                  <div key={t} style={{ maxWidth: 220 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: INK, marginBottom: 4 }}>{t}</div>
                    <div style={{ fontSize: 13.5, color: INK_4, lineHeight: 1.55 }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── PERSONAS — alternância editorial ──────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${BORDER}` }} />
      <Persona index={0}
        kicker="Profissionais de saúde"
        heading="Farmácia clínica" accent="sem papel."
        body="Gestão de turno, ronda farmacêutica PCNE, MAR digital e passagem de turno assistida por IA. Para farmácias, hospitais, clínicas e lares."
        tools={['Turno — doentes e doses', 'Ronda farmacêutica PCNE v9.1', 'MAR — registo de administração', 'Oracle — SOAP e intervenção', 'Calculadoras — SCORE2, CKD-EPI', 'Carta de alta assistida']}
        ctaHref="/login?mode=clinical" ctaLabel="Entrar como profissional" dark
      />
      <Persona index={1}
        kicker="Estudantes de ciências da saúde"
        heading="Treina com" accent="rigor."
        body="Medicina, Farmácia, Enfermagem, Nutrição. Arena, OSCE, simulador com doente evolutivo e tutor socrático."
        tools={['Arena — Bronze a Diamante', 'Simulador clínico — 3 modos', 'OSCE — IA como doente', 'Flashcards — 200+ tópicos', 'Tutor socrático', 'Progresso e XP']}
        ctaHref="/login?mode=student" ctaLabel="Começar a estudar"
      />
      <Persona index={2}
        kicker="Quem cuida de alguém"
        heading="A família" accent="organizada."
        body="Um perfil por familiar, calendário de tomas, verificação automática de interações e cartão de saúde com QR."
        tools={['Perfis familiares', 'Calendário de tomas', 'Verificar interações', 'Cartão de saúde (QR)', 'Horário inteligente', 'Monitor de adesão']}
        ctaHref="/login?mode=caregiver" ctaLabel="Começar a cuidar" dark
      />
      <Persona index={3}
        kicker="A tua saúde"
        heading="A tua medicação," accent="sob controlo."
        body="Lista os teus medicamentos, recebe lembretes, verifica interações e tira dúvidas com o assistente Phlox."
        tools={['Os meus medicamentos', 'Lembretes e adesão', 'Verificar interações', 'Sinais vitais', 'Assistente Phlox', 'Cartão de saúde']}
        ctaHref="/login?mode=personal" ctaLabel="Começar grátis"
      />

      {/* ─── FONTES — barra sóbria ─────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: '26px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="kicker" style={{ flexShrink: 0 }}>Fontes verificáveis</span>
            {['INFARMED', 'EMA', 'DGS', 'OpenFDA', 'RxNorm', 'ESC 2024', 'ADA 2024', 'NICE', 'KDIGO', 'Beers 2023', 'STOPP/START v3'].map(s => (
              <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: INK_4, letterSpacing: '0.02em' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CTA FINAL — honesto, sem letras pequenas escondidas ────────────── */}
      <section style={{ background: INK, padding: 'clamp(72px,10vw,120px) 0' }}>
        <div className="page-container">
          <Reveal>
            <div style={{ maxWidth: 640 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 'clamp(32px,5vw,60px)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.06, margin: '0 0 20px' }}>
                Começa grátis. Sobe de plano se valer a pena.
              </h2>
              <p style={{ fontSize: 16, color: '#9aa0ab', lineHeight: 1.7, margin: '0 0 16px', maxWidth: '54ch' }}>
                O plano <strong style={{ color: '#fff' }}>Base</strong> dá-te as ferramentas essenciais com anúncios, sem cartão.
                O <strong style={{ color: '#fff' }}>Plus</strong> (3,99 €/mês) desbloqueia tudo o que é individual e remove os anúncios.
                Cancelas quando quiseres, nas Definições.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
                <Link href="/login" className="ed-btn-ondark" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', background: '#fff', color: INK, textDecoration: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700 }}>
                  Criar conta grátis
                </Link>
                <Link href="/pricing" className="ed-btn-ghost-dark" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', background: 'transparent', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500, border: '1px solid #3a3d44' }}>
                  Comparar planos
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ background: INK, borderTop: '1px solid #23262d', padding: '22px 0' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5a5e67', letterSpacing: '0.08em' }}>© 2026 PHLOX CLINICAL · FEITO EM PORTUGAL</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Termos', '/terms'], ['Privacidade', '/privacy'], ['Institucional', '/institucional']].map(([label, href]) => (
              <Link key={href} href={href} className="footer-lp-link" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#7e828b', textDecoration: 'none', letterSpacing: '0.06em' }}>{label}</Link>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        .ed-btn-primary:hover { background:#2b2e36 !important; }
        .ed-btn-ghost:hover { border-color:${INK} !important; background:${'#f6f7f8'} !important; }
        .ed-btn-ondark:hover { opacity:0.88; }
        .ed-btn-ghost-dark:hover { border-color:#5a5e67 !important; }
        .ed-textlink:hover { text-decoration:underline !important; text-underline-offset:3px; }
        .footer-lp-link:hover { color:#b9bcc4 !important; }
        @media(max-width:880px) {
          .hero-grid-ed { grid-template-columns:1fr !important; align-items:start !important; }
          .demo-grid-ed { grid-template-columns:1fr !important; }
          .persona-grid { grid-template-columns:1fr !important; direction:ltr !important; }
          .hero-demo-ed { margin-top:8px; }
        }
      `}</style>
    </div>
  )
}
