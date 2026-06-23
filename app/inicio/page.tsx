'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { planName } from '@/lib/plans'
import HealthAlertsCard from '@/components/HealthAlertsCard'
import WelcomeTour from '@/components/WelcomeTour'

// ─── Home refeita 2026-06-22 — clareza acima de tudo. ──────────────────────────
// O problema era "e agora?": demasiadas escolhas à entrada. Agora: uma pergunta
// humana + 4 cartões grandes em linguagem de NECESSIDADE (não nomes de
// ferramentas), avisos só quando há algo a dizer, e UM botão "Ver tudo".

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite' }

type NonClinicalMode = 'personal' | 'caregiver' | 'student'

// Ícones grandes e claros (line icons) por cartão.
function NeedIcon({ name, color }: { name: string; color: string }) {
  const p: Record<string, React.ReactNode> = {
    pill: <><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(45 12 12)" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></>,
    question: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.5a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2-2.6 3.5" /><circle cx="12" cy="17.4" r="0.6" fill={color} /></>,
    heart: <><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></>,
    family: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.2" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 15c2.3 0 4 1.6 4 4" /></>,
    qr: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><path d="M14 14h2v2M18 18h2M16 18v2" /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3M9 16h6M10 20h4M12 16v4" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 17H6a2 2 0 0 0-2 2" /></>,
    cards: <><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12" /></>,
  }
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {p[name] || p.pill}
    </svg>
  )
}

// Cartões de NECESSIDADE — o que a pessoa quer fazer, em português do dia-a-dia.
interface Need { href: string; icon: string; title: string; sub: string }
const NEEDS: Record<NonClinicalMode, Need[]> = {
  personal: [
    { href: '/mymeds',       icon: 'pill',     title: 'Ver os meus comprimidos', sub: 'A lista, os horários e os lembretes' },
    { href: '/scan',         icon: 'camera',   title: 'Tirar foto a uma receita', sub: 'O Phlox lê e organiza por si' },
    { href: '/ai',           icon: 'question', title: 'Tenho uma dúvida',         sub: 'Pergunte em português simples' },
    { href: '/saude-agora',  icon: 'heart',    title: 'Não me sinto bem',         sub: 'Ajuda a decidir o que fazer agora' },
  ],
  caregiver: [
    { href: '/familia',      icon: 'family',   title: 'A minha família',          sub: 'A saúde de cada pessoa num sítio' },
    { href: '/scan',         icon: 'camera',   title: 'Tirar foto a uma receita', sub: 'O Phlox lê e organiza por si' },
    { href: '/ai',           icon: 'question', title: 'Tenho uma dúvida',         sub: 'Pergunte em português simples' },
    { href: '/saude-agora',  icon: 'heart',    title: 'Alguém não se sente bem',  sub: 'Ajuda a decidir o que fazer agora' },
  ],
  student: [
    { href: '/arena',        icon: 'trophy',   title: 'Treinar com casos',        sub: 'Arena: ligas e casos clínicos' },
    { href: '/study',        icon: 'cards',    title: 'Rever com flashcards',     sub: 'Repetição espaçada por tópico' },
    { href: '/aprender',     icon: 'book',     title: 'Tudo para estudar',        sub: 'O teu progresso e ferramentas' },
    { href: '/ai',           icon: 'question', title: 'Tirar uma dúvida',         sub: 'Explicações passo a passo' },
  ],
}
const MODE_COLOR: Record<NonClinicalMode, string> = { personal: '#0d9488', caregiver: '#b45309', student: '#7c3aed' }

export default function InicioPage() {
  const { user, loading } = useAuth() as any
  const router = useRouter()
  const expMode: string = user?.experience_mode || 'personal'
  // Saudação/data só depois de montar — evita mismatch de hidratação (a hora do
  // servidor difere da do cliente, e o toLocaleDateString varia entre os dois).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    // Já NÃO redirecionamos clínico para /cockpit — o /inicio é o hub de entrada
    // para todos os modos. O modo clínico mostra paywall (se não-Pro) ou hub clínico.
  }, [loading, user, router])

  const plan = (user?.plan as string) || 'free'
  const clinicalAllowed = plan === 'pro' || plan === 'clinic'
  const toolMode: NonClinicalMode = (['personal', 'caregiver', 'student'].includes(expMode) ? expMode : 'personal') as NonClinicalMode
  const isFree = !user?.plan || user.plan === 'free'

  if (loading || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MODO CLÍNICO ──
  if (expMode === 'clinical') {
    // Free/Plus → paywall (o espaço clínico exige Institucional/Pro)
    if (!clinicalAllowed) {
      return (
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-sans)' }}>
          <div style={{ width: 'min(460px,100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px', textAlign: 'center', boxShadow: '0 12px 50px rgba(8,12,24,0.08)' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>🏥</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Espaço clínico</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, margin: '0 0 10px' }}>O modo clínico é para profissionais e instituições</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>O painel da instituição, a ronda, o MAR, a vigilância de utentes e os relatórios fazem parte dos planos Pro e Institucional. O teu plano atual é {planName(plan)}.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Link href="/pricing" style={{ padding: '13px 18px', background: '#1d4ed8', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Ver planos Pro e Institucional</Link>
              <Link href="/settings" style={{ padding: '11px', background: 'none', color: 'var(--ink-4)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Mudar de modo nas Definições</Link>
            </div>
          </div>
        </div>
      )
    }
    // Pro/Institucional → hub clínico (não /cockpit automático; entrada calma)
    return <ClinicalHub router={router} name={user?.name?.split(' ')[0] || ''} />
  }

  const firstName = user?.name?.split(' ')[0] || ''
  const needs = NEEDS[toolMode]
  const color = MODE_COLOR[toolMode]
  const askLabel = toolMode === 'student' ? 'O que queres fazer hoje?' : 'O que precisa hoje?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <WelcomeTour mode={toolMode} />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 40px', boxSizing: 'border-box', width: '100%' }}>

        {/* Saudação grande e calorosa — uma pergunta humana, não um painel */}
        <div style={{ marginBottom: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,6vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.12 }}>
            {mounted ? greeting() : 'Olá'}{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p style={{ fontSize: 'clamp(16px,4vw,18px)', color: 'var(--ink-3)', margin: '6px 0 0', fontWeight: 500 }}>{askLabel}</p>
        </div>

        {/* Aviso — só aparece quando há MESMO algo a dizer (Pro). Em frase, não cartão técnico. */}
        {(toolMode === 'personal' || toolMode === 'caregiver') && (
          <div data-tour="alerts"><HealthAlertsCard /></div>
        )}

        {/* OS CARTÕES — necessidades reais, grandes, fáceis de tocar */}
        <div className="need-grid" data-tour="needs" style={{ marginTop: 18 }}>
          {needs.map((n, i) => (
            <Link key={n.href} href={n.href} className="need-card" style={{ borderColor: i === 0 ? color + '55' : 'var(--border)' }}>
              <span className="need-ic" style={{ background: color + '12' }}>
                <NeedIcon name={n.icon} color={color} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'clamp(16px,4.2vw,18px)', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{n.title}</span>
                <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.4 }}>{n.sub}</span>
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          ))}
        </div>

        {/* UM botão para tudo o resto — sem decisões prematuras */}
        <Link href="/tudo" data-tour="all" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          padding: '15px', marginTop: 14,
          background: 'white', border: '1.5px solid var(--border)', borderRadius: 14,
          textDecoration: 'none', color: 'var(--ink-2)', fontSize: 15, fontWeight: 700,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          Ver tudo o que o Phlox faz
        </Link>

        {/* Momento difícil — discreto, só para os modos pessoais */}
        {(toolMode === 'personal' || toolMode === 'caregiver') && (
          <Link href="/comecar" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', marginTop: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, textDecoration: 'none' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🤍</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>A passar por um momento difícil?</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-4)', marginTop: 1 }}>Alta do hospital, diagnóstico novo, cuidar de alguém — começamos consigo.</span>
            </span>
          </Link>
        )}

        {/* Plano + ajuda, em pé de página discreto */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <Link href="/settings" style={{ fontSize: 13, color: 'var(--ink-4)', textDecoration: 'none', fontWeight: 600 }}>⚙️ Definições</Link>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFree ? '#94a3b8' : '#0d6e42' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>Plano {planName(user?.plan)}</span>
          </Link>
        </div>
      </div>

      <style>{`
        .need-grid { display: grid; grid-template-columns: 1fr; gap: 11px; }
        .need-card {
          display: flex; align-items: center; gap: 15px; text-decoration: none;
          background: white; border: 1.5px solid var(--border); border-radius: 16px;
          padding: 18px 17px; transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s;
        }
        .need-card:active { transform: scale(0.985); background: var(--bg-2); }
        .need-ic { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @media (min-width: 640px) {
          .need-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .need-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.06); border-color: var(--border-2); }
        }
      `}</style>
    </div>
  )
}

// Hub de entrada do modo clínico — entrada calma, não o cockpit direto.
function ClinicalHub({ name }: { router: any; name: string }) {
  const TOOLS = [
    { href: '/cockpit', icon: '▦', title: 'Cockpit', desc: 'Dashboard do turno · alertas · KPIs' },
    { href: '/patients', icon: '👥', title: 'Doentes', desc: 'Fichas, medicação, alertas' },
    { href: '/rounds', icon: '🩺', title: 'Ronda farmacêutica', desc: 'PCNE · intervenções' },
    { href: '/mar', icon: '💊', title: 'Administração (MAR)', desc: 'Registo por turno' },
    { href: '/vigia', icon: '🏥', title: 'Vigia Clínico', desc: 'Vigilância farmacológica de todos' },
    { href: '/oracle', icon: '✦', title: 'Oracle', desc: 'SOAP · PCNE · plano' },
    { href: '/turno', icon: '🕐', title: 'Turno', desc: 'Visão do turno atual' },
    { href: '/handover', icon: '🔄', title: 'Passagem de turno', desc: 'Relatório IA do turno' },
  ]
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Espaço clínico</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, margin: '0 0 4px' }}>Bom trabalho{name ? `, ${name}` : ''}.</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 20 }}>Por onde queres começar hoje?</p>
        <div className="home-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {TOOLS.map(t => (
            <Link key={t.href} href={t.href} className="home-card" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: '#1d4ed814', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{t.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-4)' }}>{t.desc}</span>
              </span>
            </Link>
          ))}
        </div>
        <style>{`
          .home-card:hover { border-color: var(--border-2); box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          @media (min-width: 700px) { .home-grid { grid-template-columns: 1fr 1fr !important; } }
        `}</style>
      </div>
    </div>
  )
}
