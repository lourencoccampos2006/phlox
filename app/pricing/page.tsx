'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

const PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    price: { monthly: '0€', annual: '0€' },
    description: 'Para experimentar as ferramentas essenciais.',
    cta: 'Começar grátis',
    ctaHref: '/login',
    highlight: false,
    features: [
      { text: 'Análise Rápida de Medicação (limitada)', ok: true },
      { text: 'Diluições e Perfusões IV (completo)', ok: true },
      { text: 'Verificador de interações — 10/dia', ok: true },
      { text: 'Base de dados FDA — 15 pesquisas/dia', ok: true },
      { text: 'Calculadoras clínicas (todas)', ok: true },
      { text: 'Segurança do medicamento — 5/dia', ok: true },
      { text: 'Posologia por indicação — 5/dia', ok: true },
      { text: 'Compatibilidade IV — 5/dia', ok: true },
      { text: 'Histórico de pesquisas', ok: false },
      { text: 'Monografias IA ilimitadas', ok: false },
      { text: 'Casos clínicos interactivos', ok: false },
      { text: 'Sem anúncios', ok: false },
    ],
  },
  {
    id: 'student',
    name: 'Student',
    price: { monthly: '3,99€', annual: '3,19€' },
    description: 'Para estudantes de farmácia, medicina e enfermagem que levam os exames a sério.',
    cta: 'Começar Student',
    ctaHref: '/checkout?plan=student',
    highlight: true,
    badge: 'Mais popular',
    features: [
      { text: 'Tudo do Gratuito, sem limites diários', ok: true },
      { text: 'Análise Rápida de Medicação ilimitada', ok: true },
      { text: 'Histórico de pesquisas guardado', ok: true },
      { text: 'Lista de medicamentos pessoais', ok: true },
      { text: 'Monografias IA ilimitadas', ok: true },
      { text: 'Flashcards — 24 classes farmacológicas', ok: true },
      { text: 'Quizzes com score e feedback', ok: true },
      { text: 'Phlox AI — Farmacologista Clínico IA', ok: true },
      { text: 'Casos clínicos interactivos', ok: true },
      { text: 'Sem anúncios', ok: true },
      { text: 'Protocolo terapêutico IA', ok: false },
      { text: 'Export PDF de relatórios', ok: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: '12,99€', annual: '10,39€' },
    description: 'Para farmacêuticos, médicos e profissionais que usam a plataforma no dia a dia clínico.',
    cta: 'Começar Pro',
    ctaHref: '/checkout?plan=pro',
    highlight: false,
    features: [
      { text: 'Tudo do Student + Phlox AI Pro', ok: true },
      { text: 'Protocolo terapêutico IA (guidelines ESC/ADA/NICE)', ok: true },
      { text: 'Ajuste de dose renal/hepática ilimitado', ok: true },
      { text: 'Export PDF de relatórios de interações', ok: true },
      { text: 'Histórico ilimitado', ok: true },
      { text: 'API access (em breve)', ok: true },
      { text: 'Suporte prioritário', ok: true },
    ],
  },
]

const FAQ = [
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem contratos. Cancelas quando quiseres e manténs acesso até ao fim do período pago.' },
  { q: 'Os casos clínicos são mesmo bons?', a: 'São gerados por IA com base em cenários clínicos reais, com diagnóstico diferencial e decisão terapêutica guiada. Cada caso tem feedback detalhado com a justificação clínica completa.' },
  { q: 'A informação farmacológica é fiável?', a: 'Os dados primários vêm de OpenFDA, RxNorm/NIH. A IA (Llama 3.3) é usada para tradução, monografias e ferramentas avançadas — sempre com aviso claro. Confirma sempre com fontes primárias.' },
  { q: 'Existe desconto para estudantes?', a: 'O plano Student já é o preço especial para estudantes. No plano anual tens 20% adicional. Para licenças institucionais (faculdade, clínica), contacta-nos.' },
  { q: 'O que é o Protocolo Terapêutico?', a: 'Descreves o contexto do teu doente (idade, comorbilidades, analíticas) e recebes um protocolo terapêutico completo com fármacos, doses, alvos e follow-up baseado nas guidelines mais recentes (ESC, ADA, NICE, DGS).' },
]

// Value props para cada segmento
const VALUE_PROPS = [
  {
    icon: '🎓',
    title: 'Para estudantes',
    subtitle: 'Passa nos exames com mais confiança',
    points: [
      'Casos clínicos com o mesmo nível dos exames de Farmacologia Clínica',
      'Flashcards e quizzes para 24 classes — antipsicóticos, anticoagulantes, antibióticos...',
      'Monografias completas de qualquer fármaco em PT, incluindo os mais recentes',
    ],
    plan: 'Student — 3,99€/mês',
    href: '/checkout?plan=student',
  },
  {
    icon: '⚕️',
    title: 'Para profissionais',
    subtitle: 'Decisões clínicas em segundos',
    points: [
      'Protocolo terapêutico baseado em guidelines para o teu doente específico',
      'Compatibilidade IV — Trissel\'s e King Guide na palma da mão',
      'Ajuste de dose renal para qualquer medicamento com TFG',
    ],
    plan: 'Pro — 12,99€/mês',
    href: '/checkout?plan=pro',
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>Planos e Preços</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Começa grátis.<br />
            <em style={{ color: 'var(--green-2)', fontStyle: 'italic' }}>Cresce quando precisares.</em>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.7 }}>
            As ferramentas essenciais são sempre gratuitas. Os planos pagos desbloqueiam funcionalidades que fazem a diferença real — em estudos e na clínica.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '4px' }}>
            <button onClick={() => setBilling('monthly')}
              style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: billing === 'monthly' ? 'var(--green)' : 'transparent', color: billing === 'monthly' ? 'white' : 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Mensal
            </button>
            <button onClick={() => setBilling('annual')}
              style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: billing === 'annual' ? 'var(--green)' : 'transparent', color: billing === 'annual' ? 'white' : 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Anual
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 3 }}>-20%</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="plans-grid" style={{ marginBottom: 64 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: plan.highlight ? 'var(--green)' : 'white', padding: '28px 24px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {(plan as any).badge && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: 'white', color: 'var(--green)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>
                  {(plan as any).badge}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginBottom: 10 }}>
                {plan.name}
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 700, color: plan.highlight ? 'white' : 'var(--ink)' }}>
                  {plan.price[billing]}
                </span>
                {plan.price.monthly !== '0€' && (
                  <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginLeft: 6 }}>
                    /mês{billing === 'annual' ? ' (anual)' : ''}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.75)' : 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>
                {plan.description}
              </p>
              {user && user.plan === plan.id ? (
                <div style={{ padding: '11px', borderRadius: 6, border: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`, textAlign: 'center', fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)', marginBottom: 24, fontFamily: 'var(--font-mono)' }}>
                  ✓ Plano actual
                </div>
              ) : (
                <Link href={!user ? '/login' : plan.ctaHref} style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 24, background: plan.highlight ? 'white' : 'var(--green)', color: plan.highlight ? 'var(--green)' : 'white' }}>
                  {!user && plan.id !== 'free' ? 'Criar conta e começar' : plan.cta}
                </Link>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'auto' }}>
                {plan.features.map(({ text, ok }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: ok ? 1 : 0.35 }}>
                    <span style={{ fontSize: 13, color: plan.highlight ? (ok ? '#86efac' : 'rgba(255,255,255,0.3)') : (ok ? 'var(--green-2)' : 'var(--ink-4)'), flexShrink: 0, marginTop: 1 }}>
                      {ok ? '✓' : '—'}
                    </span>
                    <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.85)' : 'var(--ink-2)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Value props by segment */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 28, textAlign: 'center', letterSpacing: '-0.01em' }}>
            O que muda com o upgrade
          </h2>
          <div className="card-grid-2">
            {VALUE_PROPS.map(vp => (
              <div key={vp.title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '28px 24px' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{vp.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 4 }}>{vp.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20, fontStyle: 'italic' }}>{vp.subtitle}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                  {vp.points.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--green-2)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>
                <Link href={vp.href} style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '10px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                  {vp.plan} →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 680, margin: '0 auto 48px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 24, textAlign: 'center', letterSpacing: '-0.01em' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {FAQ.map(({ q, a }, i) => (
              <div key={i} style={{ background: 'white' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>{q}</span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 20, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 16px' }}>
                    <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Institutional CTA */}
        <div style={{ textAlign: 'center', padding: '40px 24px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 10 }}>Faculdade, clínica ou farmácia?</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px' }}>
            Licenças institucionais com desconto, onboarding dedicado e facturação centralizada. Para hospitais, faculdades de farmácia e grupos de clínicas.
          </p>
          <a href="mailto:hello@phlox.health?subject=Licença institucional" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
            Falar sobre licença institucional →
          </a>
        </div>
      </div>
    </div>
  )
}