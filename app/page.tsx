import Link from 'next/link'
import Header from '@/components/Header'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Phlox — Plataforma Farmacológica Clínica',
  description: 'Verifica interações medicamentosas, consulta informação clínica e estuda farmacologia. Dados FDA e NIH. Gratuito.',
}

const TOOLS = [
  {
    href: '/labs',
    code: '🌟',
    title: 'O teu médico explica em 10 min. O Phlox explica tudo.',
    desc: 'Cola os resultados das tuas análises clínicas. Recebe uma interpretação completa — o que está fora do normal, o que significa, e as perguntas certas para levar ao médico.',
    badge: 'A ferramenta que faltava',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
  {
    href: '/scanner',
    code: '🌟',
    title: 'Posso tomar este medicamento?',
    desc: 'Escreve qualquer medicamento. Sabe o que é, como tomar, o que evitar — e se é seguro com a tua medicação pessoal. Para toda a gente, sem excepção.',
    badge: 'O mais popular',
    badgeColor: '#166534',
    badgeBg: '#dcfce7',
  },
  {
    href: '/quickcheck',
    code: '🔍',
    title: 'Análise Rápida de Medicação',
    desc: 'Cola a lista de medicamentos. Recebe análise completa em linguagem simples ou técnica — interações, problemas, recomendações. Sem conta necessária.',
    badge: 'Para todos',
    badgeColor: '#166534',
    badgeBg: '#dcfce7',
  },
  {
    href: '/ai',
    code: '🧠',
    title: 'Phlox AI — Farmacologista Clínico',
    desc: 'O teu farmacologista clínico pessoal. Conhece os teus medicamentos, analisa interações e responde a qualquer dúvida clínica com raciocínio transparente.',
    badge: 'Student+',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
  {
    href: '/interactions',
    code: '01',
    title: 'Verificador de Interações',
    desc: 'Analisa interações entre medicamentos, suplementos e plantas medicinais. Classificação por gravidade com base em dados RxNorm/NIH.',
    badge: 'Mais usado',
    badgeColor: '#166534',
    badgeBg: '#dcfce7',
  },
  {
    href: '/drugs',
    code: '02',
    title: 'Base de Dados de Fármacos',
    desc: 'Informação clínica completa — mecanismo de acção, posologia, efeitos adversos, contraindicações. Dados FDA traduzidos para PT.',
    badge: null,
  },
  {
    href: '/mymeds',
    code: '03',
    title: 'A Minha Medicação',
    desc: 'Regista os teus medicamentos e verifica automaticamente todas as interações entre eles. O teu perfil farmacológico pessoal.',
    badge: 'Student',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
  {
    href: '/dilutions',
    code: '04',
    title: 'Diluições e Perfusões IV',
    desc: 'Protocolos de diluição, velocidades de perfusão, estabilidade e calculadora integrada para 10 fármacos IV.',
    badge: 'Enfermeiros',
    badgeColor: '#0369a1',
    badgeBg: '#f0f9ff',
  },
  {
    href: '/monograph',
    code: '05',
    title: 'Monografia Clínica IA',
    desc: 'Monografia farmacológica completa em PT-PT para qualquer fármaco — incluindo biológicos e medicamentos europeus não cobertos pela FDA.',
    badge: 'Novo',
    badgeColor: '#166534',
    badgeBg: '#dcfce7',
  },
  {
    href: '/doses',
    code: '06',
    title: 'Posologia por Indicação',
    desc: 'Escreve uma indicação clínica e obtém fármacos de 1ª linha com doses, duração e alternativas baseadas em guidelines.',
    badge: null,
  },
  {
    href: '/compatibility',
    code: '07',
    title: 'Compatibilidade IV',
    desc: "Verifica compatibilidade de dois fármacos em linha IV, Y-site ou mistura em soro. Baseado em Trissel's e King Guide.",
    badge: null,
  },
  {
    href: '/calculators',
    code: '08',
    title: 'Calculadoras Clínicas',
    desc: 'SCORE2, HAS-BLED, conversão de opióides, ajuste de dose renal, peso ideal, Cockcroft-Gault, CKD-EPI e mais.',
    badge: 'Profissionais',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
  },
  {
    href: '/exam',
    code: '09',
    title: 'Modo Exame',
    desc: 'Simulação real de exame de Farmacologia Clínica. Timer, análise de pontos fracos por classe. Plano Student.',
    badge: 'Student',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
  {
    href: '/cases',
    code: '10',
    title: 'Casos Clínicos',
    desc: 'Cenários reais com diagnóstico diferencial e decisão terapêutica guiada. Com feedback clínico detalhado. Plano Student.',
    badge: 'Student',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
  {
    href: '/briefing',
    code: '⭐',
    title: 'Briefing Clínico de Consulta',
    desc: 'Cola os medicamentos e o motivo da consulta. Em 15 segundos: red flags, interações críticas, o que perguntar, o que monitorizar. Para médicos, farmacêuticos e internos.',
    badge: 'Pro exclusivo',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
  },
  {
    href: '/med-review',
    code: '⭐',
    title: 'Revisão Clínica de Medicação',
    desc: 'O farmacêutico clínico que devias ter. Analisa o teu perfil completo de medicação, identifica riscos, recomenda exames e gera um relatório PDF para levar ao médico.',
    badge: 'Pro exclusivo',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
  },
  {
    href: '/strategy',
    code: '⭐',
    title: 'Simulador de Estratégia Terapêutica',
    desc: 'Define um objectivo clínico e o perfil do doente. Recebe 3–5 estratégias alternativas com evidência A/B/C, trade-offs e score de adequação personalizado.',
    badge: 'Pro — Novo',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
  },
  {
    href: '/protocol',
    code: '11',
    title: 'Protocolo Terapêutico',
    desc: 'Contexto do doente → protocolo completo com fármacos, doses e alvos. Baseado em guidelines ESC, ADA, NICE. Plano Pro.',
    badge: 'Pro',
    badgeColor: '#1e40af',
    badgeBg: '#dbeafe',
  },
  {
    href: '/safety',
    code: '12',
    title: 'Segurança do Medicamento',
    desc: 'Condução, desporto, gravidez, álcool e uso em idosos — perfil de segurança completo para qualquer medicamento.',
    badge: null,
  },
  {
    href: '/study',
    code: '13',
    title: 'Plataforma de Estudo',
    desc: 'Flashcards e quizzes gerados por IA para 24 classes farmacológicas. Para estudantes de farmácia, medicina e enfermagem.',
    badge: 'Estudantes',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
  },
]

const SOCIAL_PROOF = [
  { text: 'Finalmente uma ferramenta de interações que funciona bem em português.', role: 'Estudante de Farmácia, Porto' },
  { text: 'Uso o verificador de interações todos os dias na farmácia comunitária.', role: 'Farmacêutica, Lisboa' },
  { text: 'As calculadoras clínicas são exactamente o que precisava para o internato.', role: 'Interno de Medicina, Coimbra' },
]

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Announcement bar */}
      <div style={{ background: 'var(--green)', padding: '8px 0' }}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            ✓ Dados de farmacovigilância FDA · RxNorm/NIH · Completamente gratuito
          </span>
        </div>
      </div>

      <Header />

      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--border)', padding: '48px 0 40px' }}>
        <div className="page-container">
          <div className="hero-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 20, padding: '4px 12px', marginBottom: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>PLATAFORMA FARMACOLÓGICA</span>
              </div>

              <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', lineHeight: 1.08, letterSpacing: '-0.025em', color: 'var(--ink)', marginBottom: 20 }}>
                Farmacologia clínica<br />
                <em style={{ fontStyle: 'italic', color: 'var(--green-2)' }}>ao teu alcance.</em>
              </h1>

              <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.75, marginBottom: 32, maxWidth: 480 }}>
                Verifica interações medicamentosas, consulta informação clínica detalhada,
                calcula doses e prepara-te para exames. Gratuito, sem registo obrigatório.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                <Link href="/interactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green)', color: 'white', padding: '13px 24px', borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                  Verificar interações
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/drugs" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'white', color: 'var(--ink)', padding: '13px 24px', borderRadius: 6, fontSize: 15, fontWeight: 500, textDecoration: 'none', border: '1px solid var(--border-2)' }}>
                  Pesquisar fármaco
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { icon: '✓', text: 'Dados FDA e NIH verificados' },
                  { icon: '✓', text: 'RGPD compliant' },
                  { icon: '✓', text: 'Sem anúncios invasivos' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-4)' }}>
                    <span style={{ color: 'var(--green-2)', fontWeight: 700 }}>{icon}</span>
                    {text}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick tool card — hidden on mobile via .hero-card */}
            <div className="hero-card" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ background: 'var(--green)', padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>VERIFICADOR RÁPIDO</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'white' }}>Verificar Interações</div>
              </div>
              <div style={{ padding: '20px' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.5 }}>
                  Experimenta directamente. Sem registo, sem limites neste momento.
                </p>
                <Link href="/interactions" style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', textAlign: 'center', padding: '12px', borderRadius: 4, fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                  Abrir verificador →
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { drugs: 'ibuprofeno + varfarina', severity: 'GRAVE', color: '#c53030' },
                    { drugs: 'metformina + álcool', severity: 'MODERADA', color: '#dd6b20' },
                    { drugs: 'paracetamol + codeína', severity: 'LIGEIRA', color: '#d69e2e' },
                  ].map(({ drugs, severity, color }) => (
                    <div key={drugs} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 4 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{drugs}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section style={{ padding: '48px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>Ferramentas disponíveis</div>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Tudo o que precisas</h2>
            </div>
            <Link href="/about" style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Saber mais →</Link>
          </div>

          <div className="card-grid-3" style={{ gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {TOOLS.map(({ href, code, title, desc, badge, badgeColor, badgeBg }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', background: 'white', padding: '28px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.15em' }}>{code}</div>
                  {badge && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', background: badgeBg, color: badgeColor, padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
                      {badge}
                    </div>
                  )}
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, margin: '0 0 20px', flex: 1 }}>{desc}</p>
                <div style={{ fontSize: 13, color: 'var(--green-2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Aceder
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 32, textAlign: 'center' }}>
            O que dizem os utilizadores
          </div>
          <div className="testimonials-grid">
            {SOCIAL_PROOF.map(({ text, role }) => (
              <div key={role} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(i => <span key={i} style={{ color: '#f59e0b', fontSize: 14 }}>★</span>)}
                </div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>"{text}"</p>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 'auto' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 0' }}>
        <div className="page-container">
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Pronto para começar?
            </h2>
            <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.7 }}>
              As ferramentas core são gratuitas e não precisam de registo.
              Cria uma conta para guardar o teu histórico e aceder a funcionalidades avançadas.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/interactions" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600 }}>
                Começar agora — grátis
              </Link>
              <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '13px 28px', borderRadius: 6, fontSize: 15, fontWeight: 500, border: '1px solid var(--border-2)' }}>
                Criar conta
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0', background: 'white' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Phlox</div>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7 }}>Plataforma farmacológica clínica. Dados FDA e NIH.</p>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas</div>
              {[{ href: '/interactions', label: 'Interações' }, { href: '/drugs', label: 'Medicamentos' }, { href: '/monograph', label: 'Monografias' }, { href: '/doses', label: 'Posologia' }, { href: '/compatibility', label: 'Compat. IV' }, { href: '/calculators', label: 'Calculadoras' }, { href: '/study', label: 'Estudo' }].map(({ href, label }) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 8 }}>{label}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 12 }}>Empresa</div>
              {[{ href: '/about', label: 'Sobre' }, { href: '/pricing', label: 'Preços' }, { href: '/privacy', label: 'Privacidade' }, { href: '/terms', label: 'Termos' }].map(({ href, label }) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', marginBottom: 8 }}>{label}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 12 }}>Contacto</div>
              <a href="mailto:hello@phlox.health" style={{ fontSize: 13, color: 'var(--green-2)', textDecoration: 'none' }}>hello@phlox.health</a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento profissional.</span>
            <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Dados: OpenFDA · RxNorm · NIH</span>
          </div>
        </div>
      </footer>
    </div>
  )
}