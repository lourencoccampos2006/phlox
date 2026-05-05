'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

type Billing = 'monthly' | 'annual'

const PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    price: { monthly: '0€', annual: '0€' },
    description: 'Para famílias e cuidadores que querem começar.',
    cta: 'Começar grátis',
    ctaHref: '/login',
    highlight: false,
    modes: ['caregiver', 'personal'],
    features: [
      { text: 'Tradutor de Bula (ilimitado)', ok: true },
      { text: 'Dose Pediátrica (ilimitado)', ok: true },
      { text: 'Verificador de Interações — 10/dia', ok: true },
      { text: '2 Perfis familiares', ok: true },
      { text: 'Base de dados FDA — 15 pesquisas/dia', ok: true },
      { text: 'Calculadoras clínicas', ok: true },
      { text: 'Phlox AI', ok: false },
      { text: 'Histórico guardado', ok: false },
      { text: 'Sem anúncios', ok: false },
    ],
  },
  {
    id: 'student',
    name: 'Student',
    price: { monthly: '3,99€', annual: '2,99€' },
    description: 'Para estudantes de farmácia, medicina, enfermagem e nutrição.',
    cta: 'Começar Student',
    ctaHref: '/checkout?plan=student',
    highlight: false,
    badge: 'Para estudantes',
    badgeColor: '#7c3aed',
    modes: ['student'],
    features: [
      { text: 'Tudo do Gratuito, sem limites diários', ok: true },
      { text: '5 Perfis familiares', ok: true },
      { text: 'Phlox AI Tutor — socrático, modo estudo', ok: true },
      { text: 'Flashcards — 24 classes farmacológicas', ok: true },
      { text: 'Quizzes com score e feedback', ok: true },
      { text: 'Casos clínicos interactivos', ok: true },
      { text: 'Turno virtual com doentes gerados por IA', ok: true },
      { text: 'Modo exame com análise de erros', ok: true },
      { text: 'Histórico de pesquisas guardado', ok: true },
      { text: 'Sem anúncios', ok: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro Individual',
    price: { monthly: '14,99€', annual: '11,99€' },
    description: 'Para profissionais em uso individual ou freelance.',
    cta: 'Começar Pro',
    ctaHref: '/checkout?plan=pro',
    highlight: true,
    badge: 'Mais completo',
    badgeColor: '#0d6e42',
    modes: ['clinical', 'personal', 'caregiver'],
    features: [
      { text: 'Tudo do Student', ok: true },
      { text: 'Perfis ilimitados', ok: true },
      { text: 'Phlox AI Clínico Pro — protocolo, análise, dictation', ok: true },
      { text: 'Gestão de doentes/utentes ilimitados', ok: true },
      { text: 'Briefing de Consulta em 15s', ok: true },
      { text: 'Revisão de Medicação com PDF', ok: true },
      { text: 'Protocolo Terapêutico IA (ESC/ADA/NICE/DGS)', ok: true },
      { text: 'MAR digital por turno', ok: true },
      { text: 'Importar medicamentos (Sifarma · SClínico)', ok: true },
      { text: 'Export PDF de relatórios', ok: true },
    ],
  },
]

const INSTITUTIONAL = {
  name: 'Institucional',
  price: 'Desde 89€/mês',
  priceSub: 'por localização · faturação anual',
  description: 'Para farmácias, clínicas, lares e hospitais. A unidade de subscrição é a instituição — toda a equipa incluída.',
  cta: 'Falar com a equipa',
  ctaHref: 'mailto:hello@phlox-clinical.com?subject=Licença Institucional Phlox',
  features: [
    'Tudo do Pro para até 10 membros da equipa',
    'Dashboard multi-utilizador com hierarquias',
    'Atribuição de doentes a profissionais',
    'MAR digital multi-turno com auditoria',
    'Importação Sifarma / SClínico / CSV',
    'Onboarding dedicado da equipa',
    'Suporte prioritário com SLA',
    'Faturação centralizada mensal ou anual',
    'Gestão de stock (em breve)',
    'API de integração (em breve)',
  ],
  types: [
    { icon: '💊', name: 'Farmácias', price: '89€/mês' },
    { icon: '🏥', name: 'Clínicas', price: '25€/utilizador/mês' },
    { icon: '🏠', name: 'Lares / IPSS', price: '149€/mês' },
    { icon: '🏨', name: 'Hospitais', price: 'Contactar' },
  ],
}

const FAQ = [
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim. Sem contratos. Cancelas quando quiseres e manténs acesso até ao fim do período pago.' },
  { q: 'Como funciona o plano Institucional?', a: 'A farmácia ou clínica subscreve como instituição e toda a equipa tem acesso. Um owner gere os membros, planos e faturação. Não é necessário que cada profissional tenha a sua própria conta paga.' },
  { q: 'A informação farmacológica é fiável?', a: 'Os dados primários vêm de OpenFDA, RxNorm/NIH e INFARMED. A IA (Llama 3.3 via Groq + Gemini 2.5) é usada para análise e geração de conteúdo — sempre com aviso claro. Confirma sempre com fontes primárias.' },
  { q: 'Existe desconto para estudantes?', a: 'O plano Student já é o preço especial. No plano anual tens mais 25% de desconto. Para licenças de faculdade, contacta-nos.' },
  { q: 'Posso mudar de plano a qualquer altura?', a: 'Sim. Podes fazer upgrade ou downgrade a qualquer momento. O crédito proporcional é aplicado automaticamente.' },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [billing, setBilling] = useState<Billing>('annual')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const experienceMode = (user as any)?.experience_mode || null

  // ─── Determinar plano em destaque por modo ────────────────────────────────
  const highlightPlan = experienceMode === 'student' ? 'student'
    : experienceMode === 'clinical' ? 'pro'
    : experienceMode === 'caregiver' ? 'free'
    : 'pro'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 4vw, 38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Preços simples, valor real
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 28 }}>
            Começa grátis. Faz upgrade quando precisares de mais.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 4, gap: 4 }}>
            {(['monthly', 'annual'] as Billing[]).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ padding: '8px 20px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', background: billing === b ? 'var(--ink)' : 'transparent', color: billing === b ? 'white' : 'var(--ink-3)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}>
                {b === 'monthly' ? 'Mensal' : 'Anual'}
                {b === 'annual' && <span style={{ fontSize: 10, background: '#d1fae5', color: '#0d6e42', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>−25%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Planos B2C */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginBottom: 48 }}>
          {PLANS.map(plan => {
            const isHighlighted = plan.id === highlightPlan
            return (
              <div key={plan.id}
                style={{ background: isHighlighted ? 'var(--ink)' : 'white', border: `1.5px solid ${isHighlighted ? 'transparent' : 'var(--border)'}`, borderRadius: 14, padding: '28px 24px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: isHighlighted ? '0 8px 32px rgba(0,0,0,0.15)' : 'none' }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: plan.badgeColor, color: 'white', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '3px 12px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isHighlighted ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)', marginBottom: 8 }}>
                  {plan.name}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 700, color: isHighlighted ? 'white' : 'var(--ink)' }}>
                    {plan.price[billing]}
                  </span>
                  {plan.price.monthly !== '0€' && (
                    <span style={{ fontSize: 13, color: isHighlighted ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)', marginLeft: 6 }}>
                      /mês{billing === 'annual' ? ' (anual)' : ''}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: isHighlighted ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)', lineHeight: 1.6, marginBottom: 20 }}>
                  {plan.description}
                </p>
                {user && user.plan === plan.id ? (
                  <div style={{ padding: '11px', borderRadius: 6, border: `1px solid ${isHighlighted ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`, textAlign: 'center', fontSize: 13, color: isHighlighted ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginBottom: 24, fontFamily: 'var(--font-mono)' }}>
                    ✓ Plano actual
                  </div>
                ) : (
                  <Link href={!user ? '/login' : plan.ctaHref}
                    style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 24, background: isHighlighted ? 'white' : 'var(--green)', color: isHighlighted ? 'var(--ink)' : 'white' }}>
                    {!user && plan.id !== 'free' ? 'Criar conta e começar' : plan.cta}
                  </Link>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'auto' }}>
                  {plan.features.map(({ text, ok }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: ok ? 1 : 0.3 }}>
                      <span style={{ fontSize: 13, color: isHighlighted ? (ok ? '#86efac' : 'rgba(255,255,255,0.3)') : (ok ? 'var(--green-2)' : 'var(--ink-4)'), flexShrink: 0, marginTop: 1 }}>
                        {ok ? '✓' : '—'}
                      </span>
                      <span style={{ fontSize: 13, color: isHighlighted ? 'rgba(255,255,255,0.85)' : 'var(--ink-2)', lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Plano Institucional */}
        <div id="institucional" style={{ background: '#0f172a', borderRadius: 16, padding: '40px', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 2, background: '#1d4ed8', borderRadius: 1 }} />
                Plano Institucional
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 30px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8 }}>
                Para farmácias, clínicas, lares e hospitais
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 28 }}>
                A instituição subscreve, toda a equipa usa. Multi-utilizador, MAR digital, importação de sistemas, auditoria completa. O padrão da indústria em Portugal.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 28 }}>
                {INSTITUTIONAL.types.map(t => (
                  <div key={t.name} style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#1d4ed8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{t.price}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={INSTITUTIONAL.ctaHref}
                  style={{ background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                  Falar com a equipa →
                </a>
                <Link href="/about"
                  style={{ background: 'transparent', color: '#94a3b8', textDecoration: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: '1px solid #1e293b' }}>
                  Saber mais
                </Link>
              </div>
            </div>

            <div style={{ minWidth: 240 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Incluído em todas as licenças</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {INSTITUTIONAL.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: '#1d4ed8', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
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

      </div>
    </div>
  )
}