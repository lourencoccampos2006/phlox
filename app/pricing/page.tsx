'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'

type Billing = 'monthly' | 'annual'

const PLANS = [
  {
    id: 'free', name: 'Grátis', price: { monthly: '0€', annual: '0€' },
    desc: 'Para famílias e cuidadores. Sem cartão.',
    cta: 'Começar grátis', href: '/login', highlight: false,
    color: '#374151',
    features: [
      'Verificador de Interações (10/dia)',
      'Tradutor de Bula (ilimitado)',
      'Dose Pediátrica (ilimitado)',
      '2 Perfis familiares',
      'Calculadoras clínicas',
      'Base de dados FDA (15/dia)',
    ],
  },
  {
    id: 'student', name: 'Student', price: { monthly: '3,99€', annual: '2,99€' },
    desc: 'Medicina · Farmácia · Enfermagem · Nutrição · +',
    cta: 'Começar Student', href: '/checkout?plan=student', highlight: false,
    badge: 'Para estudantes', badgeColor: '#7c3aed', color: '#7c3aed',
    features: [
      'Tudo do Grátis sem limites',
      '5 Perfis familiares',
      'Phlox Arena — ligas Bronze→Diamante',
      'Phlox OSCE — 6 cursos, AI como doente',
      'Phlox Hive — inteligência colectiva',
      'Phlox AI Tutor socrático',
      'Plataforma de estudo — 10 domínios, 200+ tópicos',
      'Flashcards com SRS real',
      'Casos clínicos — todas as áreas',
      'Modo Exame — formato nacional',
      'Turno Virtual — 16 especialidades',
      'Ficha com Mnemónica',
      'Histórico guardado · Sem anúncios',
    ],
  },
  {
    id: 'pro', name: 'Pro', price: { monthly: '14,99€', annual: '11,99€' },
    desc: 'Para profissionais individuais.',
    cta: 'Começar Pro', href: '/checkout?plan=pro', highlight: true,
    badge: 'Mais popular', badgeColor: '#0d6e42', color: '#0d6e42',
    features: [
      'Tudo do Student',
      'Perfis ilimitados',
      'Phlox Ward — ficha clínica colaborativa',
      'Phlox Connect — comunicação inter-profissional',
      'Phlox Rounds — ronda farmacêutica + PCNE',
      'Phlox Care Plan — plano personalizado imprimível',
      'Phlox Consulta — copiloto bidirecional',
      'Phlox AI Clínico Pro',
      'Doentes/Utentes ilimitados',
      'MAR digital por turno',
      'Reconciliação Medicamentosa',
      'Export PDF · Relatórios mensais',
      'Análises de correlações temporais (Timeline)',
    ],
  },
  {
    id: 'clinic', name: 'Institucional', price: { monthly: '89€', annual: '69€' },
    desc: 'Farmácias · Hospitais · Clínicas · Lares',
    cta: 'Falar com a equipa', href: 'mailto:hello@phlox-clinical.com', highlight: false,
    badge: 'Por instituição', badgeColor: '#1d4ed8', color: '#1d4ed8',
    features: [
      'Tudo do Pro — para toda a equipa',
      'Utilizadores ilimitados por instituição',
      'Phlox Ward multi-equipa',
      'Phlox Connect entre todos os profissionais',
      'Protocolos institucionais partilhados',
      'Relatórios PCNE para acreditação',
      'Grand Round institucional',
      'Suporte dedicado em 24h',
      'Onboarding personalizado',
      'Faturação centralizada',
      'API de integração (Sifarma · SClínico)',
      'SLA garantido',
    ],
  },
]

const COMPARISON = [
  { feature: 'Interações medicamentosas',   free: '10/dia',     student: '∞',     pro: '∞',    clinic: '∞' },
  { feature: 'Tradutor de Bula',            free: '∞',          student: '∞',     pro: '∞',    clinic: '∞' },
  { feature: 'Phlox Arena (ligas)',          free: '—',          student: '✓',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox OSCE',                  free: '—',          student: '✓',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Hive',                  free: '—',          student: '✓',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Ward',                  free: '—',          student: '—',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Connect',               free: '—',          student: '—',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Rounds + PCNE',         free: '—',          student: '—',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Care Plan',             free: '—',          student: '—',     pro: '✓',    clinic: '✓' },
  { feature: 'Phlox Consulta',              free: '—',          student: '—',     pro: '✓',    clinic: '✓' },
  { feature: 'Protocolos institucionais',   free: '—',          student: '—',     pro: '—',    clinic: '✓' },
  { feature: 'Utilizadores ilimitados',     free: '—',          student: '—',     pro: '—',    clinic: '✓' },
  { feature: 'API de integração',           free: '—',          student: '—',     pro: '—',    clinic: '✓' },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '56px 0 48px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>Preços</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px,4vw,44px)', color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 14 }}>
            Simples. Transparente. Sem surpresas.
          </h1>
          <p style={{ fontSize: 16, color: '#475569', marginBottom: 28 }}>Começa grátis. Upgrade quando faz sentido.</p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 4, gap: 4 }}>
            {(['monthly','annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{ padding: '8px 20px', background: billing === b ? '#334155' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: billing === b ? '#f8fafc' : '#475569', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                {b === 'monthly' ? 'Mensal' : 'Anual'}{b === 'annual' && <span style={{ marginLeft: 6, fontSize: 10, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>-25%</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,240px),1fr))', gap: 12, marginBottom: 48 }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: 'white', border: plan.highlight ? `2px solid ${plan.color}` : '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', position: 'relative', transition: 'all 0.2s' }} className="plan-card">
              {plan.badge && (
                <div style={{ background: plan.badgeColor, color: 'white', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 0', textAlign: 'center' }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ padding: '22px 22px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: plan.color, marginBottom: 3 }}>{plan.name}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: '#0f172a', fontWeight: 400, marginBottom: 3 }}>
                  {plan.price[billing]}
                  {plan.id !== 'free' && <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-sans)', fontWeight: 400 }}>/mês</span>}
                </div>
                {billing === 'annual' && plan.id !== 'free' && (
                  <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>Faturado anualmente</div>
                )}
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 16 }}>{plan.desc}</div>
                <Link href={plan.href}
                  style={{ display: 'block', padding: '11px', background: plan.highlight ? plan.color : plan.id === 'free' ? '#f1f5f9' : `${plan.color}15`, color: plan.highlight ? 'white' : plan.color, textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, textAlign: 'center', border: plan.highlight ? 'none' : `1px solid ${plan.color}40`, transition: 'all 0.15s', marginBottom: 16 }}>
                  {plan.cta}
                </Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${plan.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke={plan.color} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                      </div>
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 40 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Comparação completa de funcionalidades</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', width: '40%' }}>Funcionalidade</th>
                  {PLANS.map(p => (
                    <th key={p.id} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: p.color }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 20px', fontSize: 13, color: '#374151' }}>{row.feature}</td>
                    {[row.free, row.student, row.pro, row.clinic].map((v, j) => (
                      <td key={j} style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13, color: v === '✓' ? '#0d6e42' : v === '—' ? '#e2e8f0' : '#374151', fontWeight: v === '✓' ? 700 : 400, fontFamily: v === '✓' || v === '—' ? 'inherit' : 'var(--font-mono)' }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ / Trust */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,280px),1fr))', gap: 12, marginBottom: 40 }}>
          {[
            { q: 'Posso cancelar quando quiser?', a: 'Sim. Sem fidelização, sem períodos de aviso. Cancelas quando quiseres e mantens o acesso até ao fim do período pago.' },
            { q: 'O plano grátis fica sempre grátis?', a: 'Sim. O plano grátis inclui sempre o Tradutor de Bula, a Dose Pediátrica, e o Verificador de Interações. Sem prazo limite.' },
            { q: 'Como funciona o Institucional?', a: 'Um único pagamento por instituição, utilizadores ilimitados. Faturação centralizada. Onboarding dedicado. Contacta-nos para demo.' },
            { q: 'Têm desconto para estudantes?', a: 'O plano Student é 3,99€/mês — o preço mais baixo possível para cobrir os custos de AI. Sem desconto adicional, mas podes pagar anualmente para ter 25% off.' },
          ].map(item => (
            <div key={item.q} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: '#0f172a', borderRadius: 12, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#f8fafc', fontWeight: 400, marginBottom: 12 }}>Ainda tens dúvidas?</div>
          <div style={{ fontSize: 14, color: '#475569', marginBottom: 24, lineHeight: 1.6 }}>Fala com a nossa equipa. Respondemos em menos de 24 horas.</div>
          <a href="mailto:hello@phlox-clinical.com"
            style={{ display: 'inline-block', padding: '12px 28px', background: '#22c55e', color: '#0f172a', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Enviar mensagem →
          </a>
        </div>
      </div>

      <style>{`.plan-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.06); transform: translateY(-2px) }`}</style>
    </div>
  )
}