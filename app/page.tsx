'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState } from 'react'

// Organized by the real questions people ask
const QUESTIONS = [
  {
    q: 'Posso tomar estes medicamentos juntos?',
    href: '/interactions',
    who: 'Para toda a gente',
    color: 'var(--green)',
  },
  {
    q: 'O que significam estas análises?',
    href: '/labs',
    who: 'Para toda a gente',
    color: 'var(--green)',
  },
  {
    q: 'O que comprar na farmácia para este sintoma?',
    href: '/otc',
    who: 'Para toda a gente',
    color: 'var(--green)',
  },
  {
    q: 'O que significa esta receita que me deram?',
    href: '/prescription',
    who: 'Para toda a gente',
    color: 'var(--green)',
  },
  {
    q: 'Qual é a diferença entre estes dois medicamentos?',
    href: '/compare',
    who: 'Estudantes',
    color: '#7c3aed',
  },
  {
    q: 'Que medicamentos se usam para esta doença?',
    href: '/disease',
    who: 'Estudantes',
    color: '#7c3aed',
  },
  {
    q: 'Posso administrar estes dois fármacos na mesma linha IV?',
    href: '/nursing',
    who: 'Profissionais',
    color: '#1d4ed8',
  },
  {
    q: 'Qual o protocolo mais recente para este diagnóstico?',
    href: '/protocol',
    who: 'Profissionais',
    color: '#1d4ed8',
  },
]

const STATS = [
  { n: '22', label: 'ferramentas clínicas' },
  { n: '500+', label: 'marcas reconhecidas em PT' },
  { n: 'FDA', label: 'dados verificados' },
  { n: 'PT-PT', label: 'português europeu' },
]

export default function HomePage() {
  const [activeWho, setActiveWho] = useState<string | null>(null)
  const filtered = activeWho ? QUESTIONS.filter(q => q.who === activeWho) : QUESTIONS

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 72, paddingBottom: 64 }}>
          <div className="hero-grid">
            <div>
              <div style={{ display: 'inline-block', marginBottom: 24 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Phlox Clinical · Portugal
                </span>
              </div>

              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 24, fontWeight: 400 }}>
                Tens uma dúvida<br />
                <em style={{ color: 'var(--green)', fontStyle: 'italic' }}>sobre medicamentos.</em><br />
                Nós respondemos.
              </h1>

              <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 36, maxWidth: 460 }}>
                Verificar interações, perceber análises, interpretar receitas, estudar farmacologia. Tudo em português, tudo grátis para começar.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
                <Link href="/interactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--ink)', color: 'white', padding: '13px 24px', borderRadius: 7, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Verificar interações
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/labs" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'var(--ink)', padding: '13px 24px', borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--border-2)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  Perceber análises
                </Link>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '0 1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: 440 }}>
                {STATS.map(({ n, label }) => (
                  <div key={label} style={{ padding: '12px 14px', background: 'white', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--green)', fontStyle: 'italic', fontWeight: 400, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero demo card — desktop only */}
            <div className="hero-card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.07)' }}>
              <div style={{ background: 'var(--ink)', padding: '18px 22px 16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Verificador de Interações</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['ibuprofeno', 'varfarina'].map(drug => (
                    <span key={drug} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 5, letterSpacing: '-0.01em' }}>{drug}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '18px 22px' }}>
                <div style={{ background: '#fef2f2', borderLeft: '3px solid #dc2626', padding: '12px 14px', borderRadius: '0 6px 6px 0', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#dc2626', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Interação Grave</div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>Risco hemorrágico elevado. Evitar esta combinação.</div>
                </div>
                {[
                  { l: 'Mecanismo', v: 'Ibuprofeno inibe plaquetas e lesa mucosa gástrica, aumentando hemorragia com anticoagulante' },
                  { l: 'Alternativa', v: 'Paracetamol até 2g/dia — seguro com varfarina' },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 1 }}>{l}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
                <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: '10px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Verificar os meus medicamentos
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERGUNTAS ─────────────────────────────────────────── */}
      <section style={{ padding: '56px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Ferramentas</div>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>Que pergunta tens?</h2>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[null, 'Para toda a gente', 'Estudantes', 'Profissionais'].map(who => (
                <button key={String(who)} onClick={() => setActiveWho(who)}
                  style={{ padding: '6px 14px', border: `1.5px solid ${activeWho === who ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 20, background: activeWho === who ? 'var(--ink)' : 'white', color: activeWho === who ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.15s', letterSpacing: '-0.01em' }}>
                  {who || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {filtered.map(({ q, href, who, color }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', background: 'white', textDecoration: 'none', gap: 16 }}
                className="question-link">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4 }}>{q}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{who}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <Link href="/pricing" style={{ fontSize: 13, color: 'var(--green)', textDecoration: 'none', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              Ver todos os planos e funcionalidades →
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTEMUNHOS ──────────────────────────────────────── */}
      <section style={{ padding: '56px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>O que dizem</div>
          <div className="testimonials-grid">
            {[
              { text: 'Tomei sempre brufen com o meu anticoagulante sem saber o risco. O Phlox explicou-me em dois segundos o que o médico nunca teve tempo de me dizer.', role: 'Utente com fibrilhação auricular, 67 anos' },
              { text: 'As flashcards são ao nível dos exames de verdade. Passei em Farmacologia com 17 depois de uma semana a usar o modo exame.', role: 'Estudante de Medicina, 3.º ano, Coimbra' },
              { text: 'Verifico as compatibilidades IV todos os dias no serviço. Antes ligava sempre à farmácia. Agora resolvo em 10 segundos.', role: 'Enfermeira, UCI, Hospital de Santa Maria' },
            ].map(({ text, role }) => (
              <div key={role} style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(i => <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0, flex: 1 }}>&ldquo;{text}&rdquo;</p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--ink)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 5vw, 42px)', color: 'white', marginBottom: 14, letterSpacing: '-0.025em', lineHeight: 1.15, fontWeight: 400 }}>
            Começa agora.<br />
            <em style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>É grátis.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 1.7 }}>
            Sem registo obrigatório. As ferramentas essenciais funcionam imediatamente.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interactions" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '13px 28px', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Começar — é grátis
            </Link>
            <Link href="/pricing" style={{ background: 'transparent', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '13px 28px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '48px 0 32px' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ marginBottom: 10 }}>
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 6 }}>PHLOX CLINICAL</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, maxWidth: 200 }}>Plataforma farmacológica clínica em português. Dados FDA, RxNorm e NIH.</p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas</div>
              {['/interactions', '/labs', '/otc', '/nursing', '/compare', '/ai'].map(href => {
                const ls: Record<string, string> = { '/interactions': 'Interações', '/labs': 'Análises', '/otc': 'Automedicação', '/nursing': 'IV · SC · IM', '/compare': 'Comparar', '/ai': 'Phlox AI' }
                return <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 8 }}>{ls[href]}</Link>
              })}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Empresa</div>
              {[{ h: '/about', l: 'Sobre' }, { h: '/pricing', l: 'Preços' }, { h: '/blog', l: 'Blog' }, { h: '/api-docs', l: 'API' }, { h: '/privacy', l: 'Privacidade' }, { h: '/terms', l: 'Termos' }].map(({ h, l }) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 8 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 8 }}>hello@phlox-clinical.com</a>
              <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>OpenFDA · RxNorm · NIH<br />RGPD Compliant · PT-PT</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento profissional.</span>
          </div>
        </div>
      </footer>

      <style>{`
        .question-link:hover { background: var(--bg-2) !important; }
        .question-link:hover svg { stroke: var(--green) !important; }
      `}</style>
    </div>
  )
}