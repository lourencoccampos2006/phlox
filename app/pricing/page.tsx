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
    period: 'para sempre',
    description: 'Para quem quer verificar interações e consultar medicamentos ocasionalmente.',
    cta: 'Começar grátis',
    ctaHref: '/login',
    highlight: false,
    features: [
      { text: 'Verificador de interações — 10/dia', ok: true },
      { text: 'Base de dados de medicamentos — 15/dia', ok: true },
      { text: 'Calculadoras clínicas básicas', ok: true },
      { text: '10.000+ páginas de medicamentos', ok: true },
      { text: 'Histórico de pesquisas', ok: false },
      { text: 'Lista de medicamentos pessoais', ok: false },
      { text: 'Flashcards e quizzes', ok: false },
      { text: 'Pesquisas ilimitadas', ok: false },
      { text: 'Sem anúncios', ok: false },
    ],
  },
  {
    id: 'student',
    name: 'Student',
    price: { monthly: '3,99€', annual: '3,19€' },
    period: 'por mês',
    description: 'Para estudantes de farmácia, medicina, enfermagem e nutrição.',
    cta: 'Começar Student',
    ctaHref: '/checkout?plan=student',
    highlight: true,
    badge: 'Mais popular',
    features: [
      { text: 'Tudo do plano Gratuito', ok: true },
      { text: 'Pesquisas ilimitadas', ok: true },
      { text: 'Histórico de pesquisas guardado', ok: true },
      { text: 'Lista de medicamentos pessoais', ok: true },
      { text: 'Flashcards por classe farmacológica', ok: true },
      { text: 'Quizzes adaptativos', ok: true },
      { text: 'Casos clínicos simulados', ok: true },
      { text: 'Sem anúncios', ok: true },
      { text: 'Calculadoras clínicas avançadas', ok: false },
      { text: 'Exportação de relatórios PDF', ok: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: '12,99€', annual: '10,39€' },
    period: 'por mês',
    description: 'Para farmacêuticos, médicos e profissionais de saúde.',
    cta: 'Começar Pro',
    ctaHref: '/checkout?plan=pro',
    highlight: false,
    features: [
      { text: 'Tudo do plano Student', ok: true },
      { text: 'Calculadoras clínicas avançadas', ok: true },
      { text: 'Ajuste de dose renal e hepática', ok: true },
      { text: 'Compatibilidade em soro', ok: true },
      { text: 'Exportação de relatórios PDF', ok: true },
      { text: 'Histórico ilimitado', ok: true },
      { text: 'API access (em breve)', ok: true },
      { text: 'Suporte prioritário por email', ok: true },
    ],
  },
]

const FAQ = [
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Não há contratos nem compromissos. Cancelas quando quiseres e manténs o acesso até ao fim do período pago.' },
  { q: 'Os dados são seguros?', a: 'Sim. Usamos Supabase com encriptação em repouso e em trânsito. Nunca vendemos dados pessoais. Os dados de pesquisa são anonimizados.' },
  { q: 'A informação farmacológica é fiável?', a: 'Os dados primários vêm de fontes oficiais — OpenFDA, RxNorm (NIH). A IA é usada apenas quando as bases de dados oficiais não têm informação suficiente.' },
  { q: 'Existe desconto para estudantes?', a: 'O plano Student já tem um preço especial. No plano anual tens 20% de desconto adicional. Para licenças institucionais contacta-nos.' },
  { q: 'Posso usar em contexto clínico profissional?', a: 'A plataforma é uma ferramenta de apoio à decisão clínica e não substitui o julgamento profissional. Recomendamos sempre confirmar com fontes primárias.' },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 40px 80px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 16 }}>Planos e Preços</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 44, color: 'var(--ink)', marginBottom: 16, letterSpacing: '-0.02em' }}>
            Começa grátis.<br />
            <em style={{ color: 'var(--green-2)', fontStyle: 'italic' }}>Cresce quando precisares.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-3)', maxWidth: 500, margin: '0 auto 32px' }}>
            Ferramentas farmacológicas profissionais acessíveis a toda a gente.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '4px' }}>
            <button onClick={() => setBilling('monthly')}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: billing === 'monthly' ? 'var(--green)' : 'transparent', color: billing === 'monthly' ? 'white' : 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              Mensal
            </button>
            <button onClick={() => setBilling('annual')}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: billing === 'annual' ? 'var(--green)' : 'transparent', color: billing === 'annual' ? 'white' : 'var(--ink-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Anual
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 3 }}>-20%</span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 64 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: plan.highlight ? 'var(--green)' : 'white', padding: '32px 28px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {plan.badge && (
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'white', color: 'var(--green)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginBottom: 12 }}>
                {plan.name}
              </div>

              <div style={{ marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 700, color: plan.highlight ? 'white' : 'var(--ink)' }}>
                  {plan.price[billing]}
                </span>
                {plan.price.monthly !== '0€' && (
                  <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginLeft: 6 }}>
                    /mês{billing === 'annual' ? ' (faturado anualmente)' : ''}
                  </span>
                )}
              </div>

              <p style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.75)' : 'var(--ink-3)', lineHeight: 1.6, marginBottom: 24 }}>
                {plan.description}
              </p>

              {user && user.plan === plan.id ? (
                <div style={{ padding: '11px', borderRadius: 6, border: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`, textAlign: 'center', fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)', marginBottom: 28, fontFamily: 'var(--font-mono)' }}>
                  ✓ Plano actual
                </div>
              ) : (
                <Link href={!user ? '/login' : plan.ctaHref} style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 28, background: plan.highlight ? 'white' : 'var(--green)', color: plan.highlight ? 'var(--green)' : 'white' }}>
                  {!user && plan.id !== 'free' ? 'Criar conta e começar' : plan.cta}
                </Link>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                {plan.features.map(({ text, ok }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: ok ? 1 : 0.4 }}>
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

        {/* FAQ */}
        <div style={{ maxWidth: 680, margin: '0 auto 64px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 32, textAlign: 'center', letterSpacing: '-0.01em' }}>Perguntas frequentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {FAQ.map(({ q, a }, i) => (
              <div key={i} style={{ background: 'white' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>{q}</span>
                  <span style={{ color: 'var(--ink-4)', fontSize: 20, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 24px 18px' }}>
                    <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', padding: '48px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>Tens dúvidas ou és uma instituição?</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6 }}>Para licenças institucionais, universidades ou clínicas, contacta-nos directamente.</p>
          <a href="mailto:hello@phlox.health" style={{ display: 'inline-block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
            hello@phlox.health
          </a>
        </div>
      </div>
    </div>
  )
}