'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState } from 'react'

// ─── Tool sections by persona ────────────────────────────────────────────────

const PERSONAS = [
  {
    id: 'everyone',
    label: 'Para toda a gente',
    sub: 'Sem formação clínica. Basta saber o nome do medicamento.',
    accent: 'var(--green)',
    tools: [
      {
        href: '/labs',
        label: 'Interpretação de Análises',
        desc: 'Cola os resultados em texto ou faz upload do PDF. Recebe uma interpretação completa — o que está fora do normal, o que significa, e as perguntas certas para levar ao médico.',
        tag: 'Novo',
      },
      {
        href: '/interactions',
        label: 'Verificador de Interações',
        desc: 'Escreve o nome da caixa — Brufen, Voltaren, Xarelto. Reconhecemos automaticamente. Analisamos interações com gravidade, mecanismo e recomendação.',
        tag: null,
      },
      {
        href: '/otc',
        label: 'Guia de Automedicação',
        desc: 'Diz o sintoma. Recebe o que comprar na farmácia sem receita, com doses concretas, alertas de contraindicações, e quando ir ao médico.',
        tag: null,
      },
      {
        href: '/prescription',
        label: 'Explicador de Receita',
        desc: 'Tira foto à receita ou cola o texto. Explicamos em português simples para que serve cada medicamento, como tomar exactamente, e o que vigiar.',
        tag: null,
      },
      {
        href: '/drugs',
        label: 'Base de Dados de Fármacos',
        desc: 'Mais de 10.000 medicamentos com informação clínica completa em português europeu — mecanismo, posologia, efeitos adversos, contraindicações.',
        tag: null,
      },
      {
        href: '/safety',
        label: 'Segurança do Medicamento',
        desc: 'Condução, gravidez, amamentação, álcool, idosos e critérios Beers. Perfil de segurança completo para qualquer fármaco.',
        tag: null,
      },
    ],
  },
  {
    id: 'students',
    label: 'Estudantes',
    sub: 'Medicina, farmácia, enfermagem. Para passar nos exames e sobreviver ao estágio.',
    accent: '#7c3aed',
    tools: [
      {
        href: '/study',
        label: 'Flashcards e Quizzes',
        desc: 'Flashcards e quizzes gerados por IA para 24 classes farmacológicas. Mecanismo, farmacocinética, efeitos adversos — tudo o que sai nos exames.',
        tag: null,
      },
      {
        href: '/exam',
        label: 'Modo Exame',
        desc: 'Simulação real de exame com timer, banco cumulativo de questões, score por classe, e análise detalhada dos pontos fracos.',
        tag: null,
      },
      {
        href: '/cases',
        label: 'Casos Clínicos',
        desc: 'Cenários clínicos com diagnóstico diferencial interactivo e decisão terapêutica guiada. Com feedback completo de um farmacologista clínico.',
        tag: null,
      },
      {
        href: '/mymeds',
        label: 'A Minha Medicação',
        desc: 'Regista os teus medicamentos e verifica interações em contexto. O teu perfil farmacológico pessoal, sempre disponível.',
        tag: null,
      },
    ],
  },
  {
    id: 'professionals',
    label: 'Profissionais de saúde',
    sub: 'Médicos, farmacêuticos, enfermeiros. Decisão clínica rápida sem sair do raciocínio.',
    accent: '#1d4ed8',
    tools: [
      {
        href: '/ai',
        label: 'Phlox AI',
        desc: 'Farmacologista clínico virtual com acesso ao teu perfil e histórico. Responde a questões complexas com raciocínio transparente e citações.',
        tag: 'Pro',
      },
      {
        href: '/nursing',
        label: 'Farmacotecnia IV · SC · IM',
        desc: 'Compatibilidades de linha, concentrações máximas, estabilidade após diluição, e protocolos de administração subcutânea e intramuscular.',
        tag: null,
      },
      {
        href: '/strategy',
        label: 'Simulador de Estratégias Terapêuticas',
        desc: 'Define o objectivo clínico e o perfil do doente. Recebe 3–5 estratégias com evidência A/B/C, score de adequação e trade-offs.',
        tag: 'Pro',
      },
      {
        href: '/protocol',
        label: 'Protocolo Terapêutico',
        desc: 'Contexto clínico → protocolo faseado baseado nas guidelines mais recentes ESC, ADA, NICE e DGS. Em português.',
        tag: 'Pro',
      },
      {
        href: '/med-review',
        label: 'Revisão Clínica de Medicação',
        desc: 'Análise completa do perfil farmacológico do doente — interações, duplicações, critérios Beers, monitorização laboratorial, e relatório PDF.',
        tag: 'Pro',
      },
      {
        href: '/calculators',
        label: 'Calculadoras Clínicas',
        desc: 'SCORE2, HAS-BLED, CKD-EPI, Cockcroft-Gault, conversão de opióides, ajuste renal, peso ideal. Todas validadas clinicamente.',
        tag: null,
      },
    ],
  },
]

const DIFFERENTIATORS = [
  {
    label: 'Português europeu nativo',
    desc: 'Tudo em PT-PT. Não uma tradução automática — escrito de raiz, com a terminologia clínica correcta usada em Portugal.',
  },
  {
    label: 'Nomes comerciais reconhecidos',
    desc: 'Pesquisa por Brufen, Voltaren ou Xarelto. A plataforma resolve automaticamente para a substância activa e processa a verificação.',
  },
  {
    label: 'Dados regulados e verificados',
    desc: 'OpenFDA, RxNorm, NIH. Não é IA a inventar — é informação de fontes reguladas, interpretada com inteligência artificial transparente.',
  },
  {
    label: 'Grátis de verdade',
    desc: 'As ferramentas essenciais funcionam sem registo. Os planos pagos adicionam capacidades — não bloqueiam o que já existe.',
  },
]

const TESTIMONIALS = [
  {
    text: 'Finalmente percebo as minhas análises. Sempre tive dúvidas depois da consulta mas nunca sabia como formular a pergunta. Agora sei exactamente o que perguntar.',
    role: 'Utente, 54 anos, Lisboa',
  },
  {
    text: 'O modo exame é exactamente ao nível dos exames de Farmacologia Clínica. Uso na semana antes de cada frequência e os resultados melhoraram consideravelmente.',
    role: 'Estudante de Medicina, 4.º ano, Porto',
  },
  {
    text: 'As compatibilidades IV e SC poupam-me tempo todos os dias no serviço. Antes tinha de ligar à farmácia para confirmar cada combinação.',
    role: 'Enfermeira, Serviço de Oncologia, Coimbra',
  },
]

export default function HomePage() {
  const [activePersona, setActivePersona] = useState('everyone')
  const active = PERSONAS.find(p => p.id === activePersona) || PERSONAS[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '64px 0 56px' }}>
        <div className="page-container">
          <div className="hero-grid">
            <div>
              <div style={{
                display: 'inline-block', marginBottom: 28,
                padding: '4px 0',
              }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500,
                  color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>
                  Plataforma Farmacológica Clínica
                </span>
              </div>

              <h1 className="hero-title" style={{
                fontFamily: 'var(--font-serif)',
                color: 'var(--ink)',
                marginBottom: 24,
                fontWeight: 400,
              }}>
                Farmacologia clínica<br />
                <em style={{ color: 'var(--green)', fontStyle: 'italic' }}>em português.</em>
              </h1>

              <p style={{
                fontSize: 18, color: 'var(--ink-3)', lineHeight: 1.8,
                marginBottom: 36, maxWidth: 500,
                fontWeight: 400,
              }}>
                Do doente que quer perceber a sua medicação ao especialista que precisa de uma decisão rápida. Dados FDA e NIH. Sem compromissos.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
                <Link href="/interactions" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'var(--ink)', color: 'white',
                  padding: '13px 24px', borderRadius: 7,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  letterSpacing: '0.02em', textTransform: 'uppercase',
                }}>
                  Verificar interações
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
                <Link href="/labs" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', color: 'var(--ink)',
                  padding: '13px 24px', borderRadius: 7,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  border: '1.5px solid var(--border-2)',
                  letterSpacing: '0.02em', textTransform: 'uppercase',
                }}>
                  Interpretar análises
                </Link>
              </div>

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {['Dados FDA · RxNorm · NIH', 'RGPD compliant · PT-PT', 'Grátis sem registo'].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero card — desktop only */}
            <div className="hero-card" style={{
              background: 'white', border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{ background: 'var(--ink)', padding: '18px 22px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Verificador de Interações
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>
                  ibuprofeno + varfarina
                </div>
              </div>
              <div style={{ padding: '20px 22px' }}>
                <div style={{ background: 'var(--red-light)', borderLeft: '3px solid var(--red)', borderRadius: '0 6px 6px 0', padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Interação Grave
                  </div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>
                    Risco hemorrágico significativo — evitar combinação
                  </div>
                </div>
                {[
                  { l: 'Mecanismo', v: 'Inibição plaquetária + lesão da mucosa gástrica' },
                  { l: 'Alternativa', v: 'Paracetamol até 2g/dia — seguro com varfarina' },
                  { l: 'Se necessário', v: 'Monitorização INR intensiva + omeprazol' },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: 1 }}>{l}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{v}</span>
                  </div>
                ))}
                <Link href="/interactions" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 16, padding: '11px',
                  background: 'var(--ink)', color: 'white',
                  textDecoration: 'none', borderRadius: 7,
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Verificar os meus medicamentos
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FERRAMENTAS POR PERSONA ───────────────────────────────────────── */}
      <section style={{ padding: '60px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>
              Ferramentas
            </div>
            <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>
              Para quem és?
            </h2>
          </div>

          {/* Persona tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 32, overflowX: 'auto' }}>
            {PERSONAS.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePersona(p.id)}
                style={{
                  padding: '12px 20px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${activePersona === p.id ? p.accent : 'transparent'}`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  color: activePersona === p.id ? p.accent : 'var(--ink-4)',
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                  transition: 'color 0.15s, border-color 0.15s',
                  marginBottom: -1,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Persona subtitle */}
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.6, maxWidth: 560 }}>
            {active.sub}
          </p>

          {/* Tools grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {active.tools.map(({ href, label, desc, tag }) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', flexDirection: 'column',
                  padding: '24px 26px', background: 'white',
                  textDecoration: 'none',
                }}
                className="tool-card"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-serif)', fontSize: 17,
                    color: 'var(--ink)', fontWeight: 500,
                    letterSpacing: '-0.01em', lineHeight: 1.3, flex: 1,
                  }}>
                    {label}
                  </h3>
                  {tag && (
                    <span style={{
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: active.accent,
                      border: `1px solid ${active.accent}`,
                      padding: '2px 7px', borderRadius: 3,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      flexShrink: 0,
                    }}>
                      {tag}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, margin: '0 0 16px', flex: 1 }}>
                  {desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Aceder
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORQUE O PHLOX ───────────────────────────────────────────────── */}
      <section style={{ padding: '60px 0', borderBottom: '1px solid var(--border)', background: 'white' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {DIFFERENTIATORS.map(({ label, desc }, i) => (
              <div key={label} style={{ padding: '28px 28px', background: i % 2 === 0 ? 'white' : 'var(--bg-2)' }}>
                <div style={{ width: 28, height: 2, background: 'var(--green)', marginBottom: 16 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 32, textAlign: 'center' }}>
            Utilizado por
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map(({ text, role }) => (
              <div key={role} style={{
                padding: '28px', border: '1px solid var(--border)',
                borderRadius: 10, background: 'white',
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="var(--green)">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0, flex: 1 }}>
                  &ldquo;{text}&rdquo;
                </p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: 'var(--ink)' }}>
        <div className="page-container">
          <div style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontWeight: 400,
              fontSize: 'clamp(28px, 5vw, 44px)',
              color: 'white', marginBottom: 16,
              letterSpacing: '-0.025em', lineHeight: 1.15,
            }}>
              As ferramentas essenciais são grátis.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 36, lineHeight: 1.75 }}>
              Sem registo obrigatório. Sem cartão de crédito. Começa agora.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/interactions" style={{
                background: 'white', color: 'var(--ink)',
                textDecoration: 'none', padding: '13px 28px',
                borderRadius: 7, fontSize: 13, fontWeight: 700,
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Começar — é grátis
              </Link>
              <Link href="/pricing" style={{
                background: 'transparent', color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none', padding: '13px 28px',
                borderRadius: 7, fontSize: 13, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.2)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Ver planos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '48px 0 32px' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ marginBottom: 12 }}>
                <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
                  <rect width="30" height="30" rx="6" fill="var(--green)"/>
                  <path d="M15 7v16M8 15h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 4 }}>PHLOX CLINICAL</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, maxWidth: 200 }}>
                Plataforma farmacológica clínica em português. Dados FDA e NIH.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas</div>
              {[
                { href: '/interactions', label: 'Interações' },
                { href: '/labs', label: 'Análises' },
                { href: '/otc', label: 'Automedicação' },
                { href: '/nursing', label: 'IV · SC · IM' },
                { href: '/study', label: 'Estudo' },
                { href: '/ai', label: 'Phlox AI' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 9 }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Empresa</div>
              {[
                { href: '/about', label: 'Sobre' },
                { href: '/pricing', label: 'Preços' },
                { href: '/blog', label: 'Blog' },
                { href: '/api-docs', label: 'API' },
                { href: '/privacy', label: 'Privacidade' },
                { href: '/terms', label: 'Termos' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 9 }}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 9 }}>
                hello@phlox-clinical.com
              </a>
              <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                OpenFDA · RxNorm · NIH
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
              © 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento profissional.
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
              PT-PT · RGPD Compliant
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        .tool-card:hover { background: var(--bg-2) !important; }
        .tool-card:hover h3 { color: var(--green) !important; }
      `}</style>
    </div>
  )
}