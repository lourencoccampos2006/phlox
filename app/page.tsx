'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useEffect } from 'react'

// ─── Redirecionar utilizadores autenticados para o dashboard ──────────────────
function AuthRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && user) {
      // ─── NOVO: se não fez onboarding, vai para lá primeiro ───
      const onboarded = (user as any)?.onboarded
      const hasMode = (user as any)?.experience_mode
      if (!onboarded && !hasMode) {
        router.replace('/onboarding')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [user, loading, router])
  return null
}

// ─── Quatro entradas por persona ──────────────────────────────────────────────
const PERSONAS = [
  {
    mode: 'clinical',
    icon: '⚕️',
    title: 'Profissional de Saúde',
    sub: 'Farmácia · Clínica · Hospital · Lar',
    desc: 'Centro de operações clínico. Gestão de doentes, protocolos, MAR digital, e co-piloto IA para decisão terapêutica.',
    cta: 'Começar como profissional',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    features: ['Doentes e utentes ilimitados', 'Phlox AI Clínico', 'Protocolos ESC/ADA/NICE', 'MAR digital por turno'],
  },
  {
    mode: 'caregiver',
    icon: '👨‍👩‍👧',
    title: 'Cuidador Familiar',
    sub: 'Cuido dos meus pais, filhos ou cônjuge',
    desc: 'Gestão simples da medicação de cada familiar. Alertas de interações, tradutor de bula, e resposta a qualquer dúvida.',
    cta: 'Começar para a família',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    features: ['Perfis familiares', 'Tradutor de Bula grátis', 'Dose pediátrica grátis', 'Phlox AI para cada familiar'],
  },
  {
    mode: 'personal',
    icon: '👤',
    title: 'Uso Pessoal',
    sub: 'Giro a minha própria medicação',
    desc: 'Os teus medicamentos organizados. Verifica interações, percebe receitas e análises, e tem respostas sobre a tua saúde.',
    cta: 'Começar para mim',
    color: '#0d6e42',
    bg: '#f0fdf5',
    border: '#bbf7d0',
    features: ['Os meus medicamentos', 'Verificar interações', 'Perceber receitas', 'Perceber análises'],
  },
  {
    mode: 'student',
    icon: '🎓',
    title: 'Estudante',
    sub: 'Medicina · Farmácia · Enfermagem',
    desc: 'Flashcards, casos clínicos, turno virtual, modo exame. Tudo o que precisas para passar nos exames e raciocinar clinicamente.',
    cta: 'Começar a estudar',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    features: ['Flashcards 24 classes', 'Casos clínicos interactivos', 'Turno virtual com IA', 'Modo exame com análise'],
  },
]

// ─── Ferramentas gratuitas ─────────────────────────────────────────────────────
const FREE_TOOLS = [
  {
    href: '/interactions',
    badge: 'Grátis · Sem conta',
    title: 'Verificar Interações',
    desc: 'Escreve dois ou mais medicamentos. Analisamos o risco, explicamos o mecanismo e dizemos o que fazer.',
    example: 'Brufen 400mg + Xarelto 20mg → Risco hemorrágico aumentado',
    color: '#0d6e42',
    bg: '#f0fdf5',
    border: '#bbf7d0',
  },
  {
    href: '/bula',
    badge: 'Grátis · Sem conta',
    title: 'Tradutor de Bula',
    desc: 'Cola o texto técnico de qualquer bula — traduzimos para linguagem simples em 5 pontos práticos.',
    example: '"inibidor da recaptação de serotonina" → Antidepressivo que aumenta dois mensageiros no cérebro',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    href: '/dose-crianca',
    badge: 'Grátis · Sem conta',
    title: 'Dose Pediátrica',
    desc: 'Peso da criança + medicamento = dose exacta com alertas de segurança. Para pais e profissionais.',
    example: 'Amoxicilina · 15kg → 250mg a cada 8h · máx 3000mg/dia',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [aiQuery, setAiQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAiSubmit = () => {
    if (!aiQuery.trim()) return
    router.push(`/ai?q=${encodeURIComponent(aiQuery.trim())}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <AuthRedirect />
      <Header />

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '72px 0 56px' }}>
        <div className="page-container">
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '5px 14px 5px 10px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 500 }}>
                Phlox Clinical · Farmacologia clínica em português
              </span>
            </div>

            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 5vw, 48px)', color: 'var(--ink)', marginBottom: 20, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              A plataforma de farmacologia<br />
              <em style={{ color: 'var(--green)' }}>que se adapta a ti.</em>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 36, maxWidth: 500, margin: '0 auto 36px' }}>
              Para profissionais de saúde, estudantes, cuidadores e famílias. Cada experiência completamente diferente — cada uma exactamente certa.
            </p>

            {/* AI input */}
            <div style={{ background: 'white', border: '2px solid var(--ink)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', maxWidth: 600, margin: '0 auto 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 4px 4px 18px', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input ref={inputRef} value={aiQuery} onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSubmit()}
                  placeholder="Posso tomar brufen com o meu anticoagulante?"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'transparent', padding: '12px 0' }} />
                <button onClick={handleAiSubmit} disabled={!aiQuery.trim()}
                  style={{ background: aiQuery.trim() ? 'var(--ink)' : 'var(--bg-3)', color: aiQuery.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: aiQuery.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', flexShrink: 0, transition: 'all 0.15s' }}>
                  Perguntar →
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['Posso tomar brufen com o meu anticoagulante?', 'Qual a dose de paracetamol para uma criança de 12kg?', 'Há genérico mais barato para o Xarelto?'].map(s => (
                <button key={s} onClick={() => { setAiQuery(s); router.push(`/ai?q=${encodeURIComponent(s)}`) }}
                  style={{ fontSize: 11, color: 'var(--ink-4)', background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}
                  className="suggestion-chip">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ QUATRO ENTRADAS ══════════════════════════════════════════════════ */}
      <section style={{ padding: '64px 0', background: 'var(--bg)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Para quem és?</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
              O Phlox adapta-se completamente ao teu perfil
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
            {PERSONAS.map(p => (
              <Link key={p.mode} href={`/onboarding?mode=${p.mode}`}
                style={{ display: 'flex', flexDirection: 'column', padding: '24px', background: 'white', border: `1px solid ${p.border}`, borderRadius: 14, textDecoration: 'none', transition: 'all 0.2s', gap: 0 }}
                className="persona-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 24 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{p.sub}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>{p.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-3)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.cta}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FERRAMENTAS GRATUITAS ════════════════════════════════════════════ */}
      <section style={{ padding: '64px 0', background: 'white', borderTop: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 20, padding: '4px 12px', marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grátis · Sem conta obrigatória</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
              Começa agora, sem criar conta
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12, maxWidth: 1000, margin: '0 auto' }}>
            {FREE_TOOLS.map(tool => (
              <Link key={tool.href} href={tool.href}
                style={{ display: 'block', padding: '24px', background: tool.bg, border: `1px solid ${tool.border}`, borderRadius: 12, textDecoration: 'none', transition: 'all 0.2s' }}
                className="free-tool-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tool.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tool.badge}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tool.color} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 8 }}>{tool.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 14 }}>{tool.desc}</p>
                <div style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${tool.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                  {tool.example}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA INSTITUCIONAL ════════════════════════════════════════════════ */}
      <section style={{ padding: '64px 0', background: '#0f172a' }}>
        <div className="page-container">
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Para instituições</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 34px)', color: '#f8fafc', fontWeight: 400, marginBottom: 16, letterSpacing: '-0.01em' }}>
              O Phlox como plataforma da tua farmácia, clínica ou lar
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.8, marginBottom: 36 }}>
              Licença institucional para toda a equipa. Multi-utilizador, MAR digital, importação de sistemas (Sifarma, SClínico), gestão de doentes com hierarquias e auditoria completa.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/pricing#institucional"
                style={{ background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
                Ver plano institucional →
              </Link>
              <a href="mailto:hello@phlox-clinical.com?subject=Demonstração institucional"
                style={{ background: 'transparent', color: '#94a3b8', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: '1px solid #1e293b' }}>
                Agendar demonstração
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer minimalista */}
      <footer style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '24px 0' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>PHLOX CLINICAL</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[['Preços', '/pricing'], ['Blog', '/blog'], ['Privacidade', '/privacy'], ['Termos', '/terms'], ['API', '/api-docs']].map(([l, h]) => (
              <Link key={h} href={h} style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none' }}>{l}</Link>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>© 2025 Phlox Clinical</div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .persona-card:hover { border-color: currentColor; box-shadow: 0 8px 32px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .free-tool-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); transform: translateY(-1px); }
        .suggestion-chip:hover { background: var(--bg-2) !important; color: var(--ink) !important; border-color: var(--border-2) !important; }
      `}</style>
    </div>
  )
}