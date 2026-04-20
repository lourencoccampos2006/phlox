import Link from 'next/link'
import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Phlox — Plataforma Farmacológica Clínica',
  description: 'Verifica interações medicamentosas, interpreta análises clínicas e estuda farmacologia. Dados FDA e NIH.',
}

const TOOLS = [
  {
    href: '/labs',
    title: 'Interpretação de Análises',
    desc: 'Cola os resultados das tuas análises clínicas. Recebe uma interpretação completa — o que está fora do normal e as perguntas certas para levar ao médico.',
    plan: null,
    new: true,
  },
  {
    href: '/interactions',
    title: 'Verificador de Interações',
    desc: 'Analisa interações entre medicamentos, suplementos e plantas medicinais. Gravidade e mecanismo baseados em RxNorm/NIH.',
    plan: null,
    new: false,
  },
  {
    href: '/ai',
    title: 'Phlox AI',
    desc: 'Farmacologista clínico virtual. Conhece o teu perfil, analisa interações em contexto e responde com raciocínio transparente.',
    plan: 'student',
    new: false,
  },
  {
    href: '/strategy',
    title: 'Simulador de Estratégias',
    desc: 'Define um objectivo clínico. Recebe estratégias alternativas com evidência A/B/C e score de adequação para este doente.',
    plan: 'pro',
    new: false,
  },
  {
    href: '/drugs',
    title: 'Base de Dados FDA',
    desc: '10.000+ medicamentos com informação clínica completa em português europeu — mecanismo, posologia, efeitos adversos.',
    plan: null,
    new: false,
  },
  {
    href: '/safety',
    title: 'Segurança do Medicamento',
    desc: 'Condução, desporto, gravidez, álcool e idosos — perfil de segurança completo para qualquer medicamento.',
    plan: null,
    new: false,
  },
  {
    href: '/study',
    title: 'Plataforma de Estudo',
    desc: 'Flashcards e quizzes gerados por IA para 24 classes farmacológicas, com mecanismo e farmacocinética.',
    plan: null,
    new: false,
  },
  {
    href: '/calculators',
    title: 'Calculadoras Clínicas',
    desc: 'SCORE2, HAS-BLED, conversão de opióides, ajuste renal, CKD-EPI, Cockcroft-Gault e mais.',
    plan: null,
    new: false,
  },
  {
    href: '/exam',
    title: 'Modo Exame',
    desc: 'Simulação de exame de Farmacologia Clínica com timer, banco de questões e análise de pontos fracos.',
    plan: 'student',
    new: false,
  },
  {
    href: '/cases',
    title: 'Casos Clínicos',
    desc: 'Cenários reais com diagnóstico diferencial interactivo e decisão terapêutica guiada por IA.',
    plan: 'student',
    new: false,
  },
  {
    href: '/protocol',
    title: 'Protocolo Terapêutico',
    desc: 'Contexto do doente → protocolo faseado com fármacos, doses e alvos baseado em guidelines ESC, ADA, NICE.',
    plan: 'pro',
    new: false,
  },
  {
    href: '/med-review',
    title: 'Revisão de Medicação',
    desc: 'Análise completa do perfil farmacológico: interações, duplicações, critérios Beers, monitorização e relatório PDF.',
    plan: 'pro',
    new: false,
  },
]

const PLAN_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  student: { bg: '#ede9fe', color: '#7c3aed', label: 'Student' },
  pro:     { bg: '#dbeafe', color: '#1e40af', label: 'Pro' },
}

const TESTIMONIALS = [
  { text: 'Uso o verificador de interações antes de cada dispensa. É a ferramenta que mais falta fazia.', role: 'Farmacêutica, Lisboa', i: 'A' },
  { text: 'Os flashcards são exactamente o que precisava para o estágio. Resultados incríveis em farmacologia.', role: 'Estudante de Medicina, Porto', i: 'M' },
  { text: 'O Phlox AI respondeu em segundos a uma dúvida clínica que tive numa consulta. Impressionante.', role: 'Médico de Família, Coimbra', i: 'J' },
]

export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '72px 0 64px', background: 'white' }}>
        <div className="page-container">
          <div className="hero-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24, padding: '5px 14px', marginBottom: 28 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                <span style={{ fontSize: 12, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 500 }}>Plataforma Farmacológica Clínica</span>
              </div>
              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 24 }}>
                Farmacologia clínica<br />
                <em style={{ color: 'var(--green)', fontStyle: 'italic' }}>sem compromissos.</em>
              </h1>
              <p style={{ fontSize: 18, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 36, maxWidth: 480 }}>
                Do estudante ao especialista — ferramentas clínicas sérias, dados verificados FDA e NIH, inteligência artificial com raciocínio transparente.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
                <Link href="/interactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green)', color: 'white', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                  Verificar interações
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/labs" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--ink)', padding: '13px 24px', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none', border: '1.5px solid var(--border-2)', letterSpacing: '-0.01em' }}>
                  Interpretar análises
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {['Dados FDA e NIH verificados', 'RGPD compliant', 'Sem anúncios'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-4)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
              <div style={{ background: 'var(--green)', padding: '18px 22px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', marginBottom: 6 }}>VERIFICADOR DE INTERAÇÕES</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white' }}>ibuprofeno + varfarina</div>
              </div>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff5f5', border: '1px solid #fecaca', borderLeft: '3px solid #ef4444', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7f1d1d', letterSpacing: '0.06em' }}>GRAVE</div>
                    <div style={{ fontSize: 12, color: '#742a2a', marginTop: 2 }}>Risco hemorrágico significativo</div>
                  </div>
                </div>
                {[
                  { label: 'Mecanismo', value: 'Inibição plaquetária e lesão da mucosa gástrica' },
                  { label: 'Recomendação', value: 'Evitar combinação. Usar paracetamol como alternativa.' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 2 }}>{label}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{value}</span>
                  </div>
                ))}
                <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: '10px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  Abrir verificador →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderLeft: '1px solid var(--border)' }}>
            {[{ n: '10.000+', l: 'Medicamentos' }, { n: '200+', l: 'Interações indexadas' }, { n: '24', l: 'Classes farmacológicas' }, { n: '3', l: 'Providers de IA' }].map(({ n, l }) => (
              <div key={l} style={{ padding: '28px 24px', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--green)', marginBottom: 4, letterSpacing: '-0.02em' }}>{n}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section style={{ padding: '80px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas</div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Tudo o que precisas, num só lugar.</h2>
          </div>
          <div className="card-grid-3" style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {TOOLS.map(({ href, title, desc, plan, new: isNew }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', background: 'white', padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, gap: 5, minHeight: 22 }}>
                  {isNew && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, background: '#ede9fe', color: '#7c3aed', padding: '2px 8px', borderRadius: 12 }}>Novo</span>}
                  {plan && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, background: PLAN_STYLE[plan].bg, color: PLAN_STYLE[plan].color, padding: '2px 8px', borderRadius: 12 }}>{PLAN_STYLE[plan].label}</span>}
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, margin: '0 0 20px', flex: 1 }}>{desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--green-2)', fontWeight: 600 }}>
                  Aceder
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ padding: '80px 0', borderBottom: '1px solid var(--border)', background: 'white' }}>
        <div className="page-container">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 40, textAlign: 'center' }}>O que dizem os utilizadores</div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map(({ text, role, i }) => (
              <div key={role} style={{ padding: '28px', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(s => <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}</div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0, flex: 1, fontStyle: 'italic' }}>"{text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700 }}>{i}</div>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '100px 0', background: 'var(--ink)' }}>
        <div className="page-container">
          <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: 'white', marginBottom: 18, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Pronto para começar?</h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', marginBottom: 36, lineHeight: 1.7 }}>As ferramentas essenciais são gratuitas. Sem cartão de crédito, sem registo obrigatório.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/interactions" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Começar — é grátis</Link>
              <Link href="/pricing" style={{ background: 'transparent', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 500, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '-0.01em' }}>Ver planos</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 0' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: '-0.03em', marginBottom: 10 }}>Phlox</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>Plataforma farmacológica clínica.<br/>Dados FDA e NIH verificados.</p>
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas</div>
              {['/interactions', '/labs', '/drugs', '/calculators', '/study', '/ai'].map(href => {
                const ls: Record<string, string> = { '/interactions': 'Interações', '/labs': 'Análises', '/drugs': 'Base de dados', '/calculators': 'Calculadoras', '/study': 'Estudo', '/ai': 'Phlox AI' }
                return <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 8, letterSpacing: '-0.01em' }}>{ls[href]}</Link>
              })}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Empresa</div>
              {[{ href: '/about', l: 'Sobre' }, { href: '/pricing', l: 'Preços' }, { href: '/privacy', l: 'Privacidade' }, { href: '/terms', l: 'Termos' }].map(({ href, l }) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginBottom: 8 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Contacto</div>
              <a href="mailto:hello@phlox.health" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>hello@phlox.health</a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional.</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>OpenFDA · RxNorm · NIH</span>
          </div>
        </div>
      </footer>
    </div>
  )
}