import Link from 'next/link'
import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Phlox Clinical — Farmacologia Clínica em Português',
  description: 'Verifica interações medicamentosas, interpreta análises clínicas e acede a ferramentas farmacológicas. Grátis, sem registo.',
}

// Organizado por persona — não por ferramenta
const SEGMENTS = [
  {
    id: 'todos',
    label: 'Para toda a gente',
    color: 'var(--green)',
    bg: 'var(--green-light)',
    border: 'var(--green-mid)',
    intro: 'Sem formação clínica? Sem problema. Ferramentas que qualquer pessoa consegue usar.',
    tools: [
      { href: '/labs',         icon: '🔬', label: 'Análises Clínicas',     desc: 'Interpreta os teus resultados em linguagem simples' },
      { href: '/interactions', icon: '⚡', label: 'Verificar Interações',   desc: 'Escreve brufen ou voltaren — reconhecemos a marca' },
      { href: '/otc',          icon: '🏥', label: 'O que comprar',          desc: 'Guia de automedicação com doses e alertas' },
      { href: '/prescription', icon: '📄', label: 'Explicar Receita',       desc: 'Foto ou texto — explicamos em português simples' },
    ],
  },
  {
    id: 'estudantes',
    label: 'Estudantes',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    intro: 'Medicina, farmácia, enfermagem. Ferramentas feitas para passar nos exames e sobreviver ao estágio.',
    tools: [
      { href: '/study',  icon: '📚', label: 'Flashcards e Quizzes', desc: '24 classes farmacológicas, gerados por IA' },
      { href: '/exam',   icon: '⏱',  label: 'Modo Exame',           desc: 'Simulação com timer, banco cumulativo' },
      { href: '/cases',  icon: '🧠', label: 'Casos Clínicos',       desc: 'Raciocínio guiado como nos exames reais' },
      { href: '/mymeds', icon: '💊', label: 'A Minha Medicação',    desc: 'Perfil farmacológico pessoal' },
    ],
  },
  {
    id: 'profissionais',
    label: 'Profissionais de saúde',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    intro: 'Médicos, farmacêuticos, enfermeiros. Decisão clínica rápida sem sair do raciocínio.',
    tools: [
      { href: '/ai',        icon: '🧬', label: 'Phlox AI',              desc: 'Farmacologista clínico virtual' },
      { href: '/nursing',   icon: '⚗️', label: 'Farmacotecnia IV·SC·IM', desc: 'Compatibilidades e prep. para administração' },
      { href: '/strategy',  icon: '⚖️', label: 'Estratégias Terapêuticas', desc: 'Alternativas com evidência A/B/C comparada' },
      { href: '/protocol',  icon: '📋', label: 'Protocolos',             desc: 'ESC, ADA, NICE, DGS — em PT' },
    ],
  },
]

const PROOF = [
  { text: 'Finalmente percebo as minhas análises. Sempre tive dúvidas mas nunca sabia como perguntar ao médico.', role: 'Utente, 54 anos, Lisboa' },
  { text: 'O modo exame é exactamente igual aos exames de Farmacologia da faculdade. Uso antes de cada frequência.', role: 'Estudante de Medicina, Porto' },
  { text: 'As compatibilidades IV poupam-me tempo todos os dias no serviço. Antes tinha de ligar à farmácia para tudo.', role: 'Enfermeira, Serviço de Oncologia' },
]

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ── HERO ─────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid var(--border)', background: 'white', padding: '52px 0 48px' }}>
        <div className="page-container">
          <div className="hero-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24, padding: '4px 14px', marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 500 }}>Plataforma farmacológica clínica</span>
              </div>

              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 20 }}>
                Farmacologia clínica<br />
                <em style={{ color: 'var(--green)', fontStyle: 'italic' }}>sem compromissos.</em>
              </h1>

              <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 32, maxWidth: 480 }}>
                Do doente que quer perceber a sua medicação ao especialista que precisa de uma decisão rápida — ferramentas sérias, dados FDA e NIH, em português.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
                <Link href="/interactions"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--green)', color: 'white', padding: '12px 22px', borderRadius: 9, fontSize: 14, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                  Verificar interações
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/labs"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'var(--ink)', padding: '12px 22px', borderRadius: 9, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1.5px solid var(--border-2)', letterSpacing: '-0.01em' }}>
                  Interpretar análises
                </Link>
              </div>

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {['Dados FDA · RxNorm · NIH', 'RGPD compliant', 'Sem anúncios'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero card — only desktop */}
            <div className="hero-card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ background: 'var(--green)', padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', marginBottom: 5 }}>VERIFICADOR DE INTERAÇÕES</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'white' }}>ibuprofeno + varfarina</div>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '3px solid #ef4444', borderRadius: '0 6px 6px 0', padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.06em', marginBottom: 3 }}>GRAVE</div>
                  <div style={{ fontSize: 12, color: '#742a2a' }}>Risco hemorrágico significativo</div>
                </div>
                {[{ l: 'Mecanismo', v: 'Inibição plaquetária + lesão gástrica' }, { l: 'Alternativa', v: 'Paracetamol até 2g/dia' }].map(({ l, v }) => (
                  <div key={l} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: '1px solid var(--border)', padding: '7px 0' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingTop: 1 }}>{l}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
                <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: '10px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  Verificar os meus medicamentos →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── POR QUEM ÉS ──────────────────────────────── */}
      <section style={{ padding: '52px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>As tuas ferramentas</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>Para quem és?</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SEGMENTS.map(seg => (
              <div key={seg.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Segment header */}
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: seg.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: seg.color, letterSpacing: '-0.01em', marginBottom: 3 }}>{seg.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: 440 }}>{seg.intro}</div>
                  </div>
                </div>

                {/* Tools grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'var(--border)' }}>
                  {seg.tools.map(({ href, icon, label, desc }) => (
                    <Link key={href} href={href}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px', background: 'white', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DESTAQUES ────────────────────────────────── */}
      <section style={{ padding: '52px 0', borderBottom: '1px solid var(--border)', background: 'white' }}>
        <div className="page-container">
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Destaques</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>O que é diferente aqui</h2>
          </div>
          <div className="card-grid-3" style={{ gap: 12 }}>
            {[
              { icon: '🇵🇹', title: 'Em português europeu', desc: 'Tudo em PT-PT, incluindo os termos clínicos. Não uma tradução automática — escrito de raiz em português.' },
              { icon: '💊', title: 'Marcas e genéricos', desc: 'Pesquisa por Brufen, Voltaren ou Xarelto. Reconhecemos automaticamente o nome que está na caixa.' },
              { icon: '📊', title: 'Dados verificados', desc: 'OpenFDA, RxNorm, NIH. Não é opinião nem IA a inventar — é informação regulada e verificada.' },
              { icon: '📱', title: 'Mobile primeiro', desc: 'Desenhado para usar no telemóvel, na urgência, no corredor. Rápido e sem fricção.' },
              { icon: '🔒', title: 'Privacidade real', desc: 'RGPD compliant. Os teus dados de saúde não são vendidos nem usados para publicidade.' },
              { icon: '🆓', title: 'Grátis de verdade', desc: 'As ferramentas essenciais são grátis sem registo. Os planos pagos adicionam — não bloqueiam.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ padding: '20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-2)' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.65 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ─────────────────────────────── */}
      <section style={{ padding: '52px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>O que dizem</div>
          <div className="testimonials-grid">
            {PROOF.map(({ text, role }) => (
              <div key={role} style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: 10, background: 'white', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(i => <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0, fontStyle: 'italic', flex: 1 }}>"{text}"</p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section style={{ padding: '72px 0', background: 'var(--ink)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 5vw, 40px)', color: 'white', marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Pronto para começar?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginBottom: 32, lineHeight: 1.7, maxWidth: 440, margin: '0 auto 32px' }}>
            As ferramentas essenciais são gratuitas e não precisam de registo.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/interactions" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 26px', borderRadius: 9, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Começar — é grátis</Link>
            <Link href="/pricing" style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '13px 26px', borderRadius: 9, fontSize: 14, fontWeight: 500, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '-0.01em' }}>Ver planos</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '44px 0' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.03em', marginBottom: 8 }}>Phlox Clinical</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>Plataforma farmacológica clínica em português.</p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas</div>
              {['/interactions', '/labs', '/otc', '/nursing', '/study', '/ai'].map(href => {
                const ls: Record<string, string> = { '/interactions': 'Interações', '/labs': 'Análises', '/otc': 'Automedicação', '/nursing': 'Farmacotecnia', '/study': 'Estudo', '/ai': 'Phlox AI' }
                return <Link key={href} href={href} style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 7 }}>{ls[href]}</Link>
              })}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Empresa</div>
              {[{ h: '/about', l: 'Sobre' }, { h: '/pricing', l: 'Preços' }, { h: '/blog', l: 'Blog' }, { h: '/privacy', l: 'Privacidade' }, { h: '/terms', l: 'Termos' }].map(({ h, l }) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 7 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>hello@phlox-clinical.com</a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional.</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>OpenFDA · RxNorm · NIH</span>
          </div>
        </div>
      </footer>
    </div>
  )
}