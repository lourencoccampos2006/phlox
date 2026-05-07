'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function AuthRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && user) {
      const onboarded = (user as any)?.onboarded === true
      router.replace(onboarded ? '/dashboard' : '/onboarding')
    }
  }, [user, loading, router])
  return null
}

// ─── SVG icons — sem emojis, geometria limpa ────────────────────────────────

function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
function IconLink() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}
function IconActivity() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconAward() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
}
function IconStethoscope() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6v0a6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/><path d="M8 15v1a6 6 0 006 6v0a6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
}
function IconGrid() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function IconArrowRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    Icon: IconUsers,
    title: 'Phlox Ward',
    tag: 'Pro',
    tagColor: '#1d4ed8',
    desc: 'Ficha clínica colaborativa em tempo real. Toda a equipa no mesmo doente — notas, alertas, decisões, parâmetros vitais. Passagem de turno estruturada e assinada.',
    href: '/teams',
    accentColor: '#1d4ed8',
    features: ['Feed por doente com 8 tipos de entrada clínica', 'Passagem de turno gerada por AI', 'Papéis por utilizador — médico, farmacêutico, enfermeiro', 'Histórico auditável e assinável'],
  },
  {
    Icon: IconLink,
    title: 'Phlox Connect',
    tag: 'Pro',
    tagColor: '#0d6e42',
    desc: 'A comunicação clínica inter-profissional que ainda não existe em Portugal. Farmacêutico envia consulta directa ao médico, dentro do contexto clínico do doente.',
    href: '/connect',
    accentColor: '#0d6e42',
    features: ['Farmacêutico → Médico → Enfermeiro', 'Análise AI automática da situação', 'Aceite ou rejeição documentada', 'Registo auditável por doente'],
  },
  {
    Icon: IconActivity,
    title: 'Phlox Rounds',
    tag: 'Pro',
    tagColor: '#7c3aed',
    desc: 'Ronda farmacêutica digital. Doentes por score de risco automático, registo de intervenção PCNE v9.1, e relatório mensal gerado em 1 clique para acreditação.',
    href: '/rounds',
    accentColor: '#7c3aed',
    features: ['Score de risco 0-100 automático', 'Classificação PCNE v9.1 completa', 'Relatório mensal para acreditação', 'Histórico de intervenções por doente'],
  },
]

const STUDENT_FEATURES = [
  {
    Icon: IconAward,
    title: 'Phlox Arena',
    tag: 'Student',
    tagColor: '#7c3aed',
    desc: 'Sistema de ligas de conhecimento clínico. Bronze a Diamante. Casos de todas as áreas da saúde gerados por AI, com timer e XP. Ranking global.',
    href: '/arena',
    accentColor: '#7c3aed',
    features: ['5 ligas: Bronze → Diamante', 'Casos em 10 domínios da saúde', 'XP com bónus de velocidade', 'Ranking global por especialidade'],
  },
  {
    Icon: IconStethoscope,
    title: 'Phlox OSCE',
    tag: 'Student',
    tagColor: '#dc2626',
    desc: 'Simulação de OSCE para 6 cursos de saúde. A AI responde como doente em tempo real. Checklist de avaliação, diagnóstico, e feedback item a item como examinador.',
    href: '/osce',
    accentColor: '#dc2626',
    features: ['Medicina · Farmácia · Enfermagem · Nutrição · Fisioterapia · Dentária', 'AI responde como doente', 'Timer real por estação', 'Feedback por item como examinador'],
  },
  {
    Icon: IconGrid,
    title: 'Phlox Hive',
    tag: 'Student',
    tagColor: '#d97706',
    desc: 'A inteligência colectiva dos estudantes de saúde. Os tópicos com maior taxa de erro da comunidade, os teus pontos cegos específicos, e o guia de estudo que resulta disso.',
    href: '/hive',
    accentColor: '#d97706',
    features: ['Dados agregados e anónimos da comunidade', 'Os teus pontos cegos vs a média', 'Tópicos mais difíceis em tempo real', 'Plano de estudo adaptado'],
  },
]

const PERSONAS = [
  {
    title: 'Profissional de Saúde',
    sub: 'Farmácia · Hospital · Clínica · Lar',
    color: '#1d4ed8',
    href: '/login?mode=clinical',
    tools: ['Phlox Ward', 'Phlox Connect', 'Phlox Rounds', 'MAR Digital', 'Reconciliação'],
  },
  {
    title: 'Estudante',
    sub: 'Medicina · Farmácia · Enfermagem · +3',
    color: '#7c3aed',
    href: '/login?mode=student',
    tools: ['Phlox Arena', 'Phlox OSCE', 'Phlox Hive', 'Flashcards + SRS', 'Turno Virtual'],
  },
  {
    title: 'Cuidador Familiar',
    sub: 'Pais · Filhos · Cônjuge',
    color: '#b45309',
    href: '/login?mode=caregiver',
    tools: ['Perfis familiares', 'Care Plan', 'Calendário de toma', 'Monitor de adesão', 'Timeline'],
  },
  {
    title: 'Uso Pessoal',
    sub: 'A minha saúde',
    color: '#0d6e42',
    href: '/login?mode=personal',
    tools: ['Os meus medicamentos', 'Care Plan', 'Monitor de adesão', 'Timeline clínica', 'Phlox AI'],
  },
]

const SOURCES = ['OpenFDA', 'INFARMED', 'EMA', 'RxNorm · NIH', 'ESC · ADA · NICE · DGS']

const FREE_TOOLS = [
  { label: 'Verificar Interações', href: '/interactions' },
  { label: 'Tradutor de Bula', href: '/bula' },
  { label: 'Dose Pediátrica', href: '/dose-crianca' },
]

// ─── Components ────────────────────────────────────────────────────────────────

function FeatureBlock({ feature, dark = false }: { feature: typeof PRO_FEATURES[0]; dark?: boolean }) {
  const { Icon, title, tag, tagColor, desc, href, accentColor, features } = feature
  return (
    <div style={{
      background: dark ? '#1e293b' : 'white',
      border: `1px solid ${dark ? '#334155' : 'var(--border)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
    }} className="feature-block">
      {/* Top accent line */}
      <div style={{ height: 3, background: accentColor }} />
      <div style={{ padding: '24px 24px 20px' }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: `${accentColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, flexShrink: 0 }}>
            <Icon />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: dark ? '#f8fafc' : 'var(--ink)', fontWeight: 400 }}>{title}</span>
              <span className={`badge badge-${tag === 'Pro' ? 'blue' : 'purple'}`} style={{ color: tagColor, background: `${tagColor}15`, border: `1px solid ${tagColor}30` }}>
                {tag}
              </span>
            </div>
            <p style={{ fontSize: 13, color: dark ? '#64748b' : 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
          </div>
        </div>
        {/* Features list */}
        <div style={{ borderTop: `1px solid ${dark ? '#334155' : 'var(--border)'}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {features.map((f, i) => (
            <div key={i} className="feature-pill" style={{ borderBottom: i < features.length - 1 ? `1px solid ${dark ? '#1e293b' : 'var(--bg-3)'}` : 'none' }}>
              <div className="feature-pill-dot" style={{ background: accentColor }} />
              <span style={{ fontSize: 12, color: dark ? '#94a3b8' : 'var(--ink-3)', flex: 1, lineHeight: 1.4 }}>{f}</span>
            </div>
          ))}
        </div>
        {/* CTA */}
        <Link href={href}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, fontWeight: 700, color: accentColor, textDecoration: 'none', fontFamily: 'var(--font-sans)', letterSpacing: '0.01em' }}>
          Ver {title}
          <IconArrowRight />
        </Link>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <AuthRedirect />
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0f172a', padding: '88px 0 72px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle grid */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        {/* Subtle radial */}
        <div aria-hidden style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>

            {/* Live badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '5px 14px 5px 10px', marginBottom: 32 }}>
              <div className="live-dot" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Portugal · Disponível agora
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px,5vw,58px)', color: '#f8fafc', fontWeight: 400, lineHeight: 1.12, letterSpacing: '-0.025em', marginBottom: 22 }}>
              A plataforma clínica que<br />
              <span style={{ color: '#22c55e' }}>a saúde em Portugal</span><br />
              estava a espera.
            </h1>

            {/* Sub */}
            <p style={{ fontSize: 'clamp(15px,1.8vw,18px)', color: '#475569', lineHeight: 1.75, maxWidth: 540, margin: '0 auto 40px' }}>
              Para profissionais que precisam de ferramentas reais.<br />
              Para estudantes que querem competir a sério.<br />
              Para famílias que merecem perceber a sua medicação.
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
              <Link href="/login"
                style={{ padding: '13px 30px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, letterSpacing: '0.01em', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                className="hero-cta-primary">
                Começar grátis
                <IconArrowRight />
              </Link>
              <Link href="/interactions"
                style={{ padding: '13px 22px', background: 'transparent', color: '#64748b', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155', transition: 'all 0.15s' }}
                className="hero-cta-secondary">
                Experimentar sem conta
              </Link>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#1e293b', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden', maxWidth: 520, margin: '0 auto' }}>
              {[['35+', 'ferramentas'], ['10', 'domínios clínicos'], ['6', 'cursos de saúde'], ['100%', 'grátis para começar']].map(([v, l]) => (
                <div key={l} style={{ background: '#0f172a', padding: '16px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#f8fafc', lineHeight: 1, marginBottom: 4 }}>{v}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FREE TOOLS BAR ──────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.16em', flexShrink: 0 }}>
              Grátis · Sem conta
            </span>
            <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
            {FREE_TOOLS.map((t, i) => (
              <span key={t.href} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <Link href={t.href}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none', padding: '4px 0', transition: 'color 0.1s' }}
                  className="free-link">
                  {t.label}
                </Link>
                {i < FREE_TOOLS.length - 1 && <span style={{ color: 'var(--border-2)', margin: '0 12px' }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRO / INSTITUCIONAL ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--bg)' }}>
        <div className="page-container">
          {/* Section header */}
          <div style={{ maxWidth: 680, marginBottom: 48 }}>
            <div className="eyebrow" style={{ marginBottom: 16, color: '#1d4ed8' }}>Pro e Institucional</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.5vw,40px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
              Ferramentas feitas para o trabalho.<br />Não para o fim-de-semana.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              Farmácias, hospitais, clínicas, lares — as ferramentas que substituem o papel, o fax, e o WhatsApp clínico.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
            {PRO_FEATURES.map(f => <FeatureBlock key={f.title} feature={f} />)}
          </div>

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/pricing"
              style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
              Ver planos Pro e Institucional
              <IconArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* ── STUDENT ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: 0, right: 0, width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="page-container" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 680, marginBottom: 48 }}>
            <div className="eyebrow" style={{ marginBottom: 16, color: '#a78bfa' }}>Student</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.5vw,40px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
              Para estudantes que querem<br />
              <span style={{ color: '#a78bfa' }}>ser os melhores.</span>
            </h2>
            <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.7 }}>
              Arena com ligas. OSCE com AI. Hive com inteligência colectiva. O estudo em saúde como nunca foi feito.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
            {STUDENT_FEATURES.map(f => <FeatureBlock key={f.title} feature={f} dark />)}
          </div>
        </div>
      </section>

      {/* ── PERSONAS ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'white' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 16 }}>Para todos os que trabalham com saúde</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,36px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.015em' }}>
              Uma plataforma. Quatro experiências.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,240px),1fr))', gap: 2, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {PERSONAS.map(p => (
              <Link key={p.title} href={p.href}
                style={{ display: 'flex', flexDirection: 'column', padding: '24px 22px', background: 'white', textDecoration: 'none', transition: 'background 0.12s' }}
                className="persona-tile">
                {/* Color accent bar */}
                <div style={{ width: 24, height: 3, background: p.color, borderRadius: 2, marginBottom: 16 }} />
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', fontWeight: 400, marginBottom: 4, lineHeight: 1.3 }}>{p.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>{p.sub}</div>
                <div style={{ flex: 1 }}>
                  {p.tools.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < p.tools.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.3 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: p.color }}>
                  Entrar
                  <IconArrowRight />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOURCES / TRUST ───────────────────────────────────────────────── */}
      <section style={{ padding: '48px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 20 }}>
            Fontes de informação verificáveis
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {SOURCES.map(s => (
              <span key={s} className="source-pill">{s}</span>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-5)', maxWidth: 460, margin: '0 auto', lineHeight: 1.7 }}>
            A AI é usada para síntese e raciocínio — nunca como fonte primária.<br />
            Toda a informação crítica é verificável nas fontes originais.
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: '#0f172a' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 580 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3.5vw,40px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 16 }}>
            Começa hoje.<br />É grátis.
          </h2>
          <p style={{ fontSize: 15, color: '#475569', marginBottom: 36, lineHeight: 1.7 }}>
            Três ferramentas sem conta. Upgrade quando faz sentido.<br />Cancela quando quiseres.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login"
              style={{ padding: '14px 32px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
              className="hero-cta-primary">
              Criar conta grátis
              <IconArrowRight />
            </Link>
            <Link href="/pricing"
              style={{ padding: '14px 22px', background: 'transparent', color: '#475569', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, border: '1px solid #334155' }}>
              Ver planos e preços
            </Link>
          </div>
          <div style={{ marginTop: 36, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            © 2026 Phlox Clinical · Feito em Portugal
          </div>
        </div>
      </section>

      <style>{`
        .hero-cta-primary:hover { background: #16a34a !important; transform: translateY(-2px); }
        .hero-cta-secondary:hover { border-color: #475569 !important; color: #94a3b8 !important; }
        .free-link:hover { color: var(--green) !important; }
        .feature-block:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
        .persona-tile:hover { background: var(--bg) !important; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        .live-dot { animation: pulse-dot 2s infinite; }
      `}</style>
    </div>
  )
}