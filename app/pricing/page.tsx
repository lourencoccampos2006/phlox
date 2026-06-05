'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLANS, formatPrice } from '@/lib/plans'

type Billing = 'monthly' | 'annual'

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const individual = PLANS.filter(p => p.audience === 'individual')
  const org = PLANS.find(p => p.audience === 'organization')!

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 16px 64px', boxSizing: 'border-box', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Planos</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,40px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>Começa grátis. Cresce quando precisares.</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 12, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            O plano Base é grátis (com anúncios). Qualquer upgrade remove os anúncios, aumenta os limites e desbloqueia mais ferramentas.
          </p>
        </div>

        {/* Billing toggle — desconto real calculado, não inventado */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            {(['monthly', 'annual'] as Billing[]).map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, background: billing === b ? 'var(--ink)' : 'transparent', color: billing === b ? 'white' : 'var(--ink-4)' }}>
                {b === 'monthly' ? 'Mensal' : 'Anual'}{b === 'annual' && <span style={{ fontSize: 10, marginLeft: 6, color: billing === b ? '#9fd3b6' : 'var(--green)' }}>poupa ~20%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Individual plans */}
        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 16 }}>
          {individual.map(p => {
            const price = billing === 'monthly' ? p.price.monthly : p.price.annual
            return (
              <div key={p.id} style={{ background: 'white', border: `1px solid ${p.highlight ? p.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: 22, position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: p.highlight ? 'var(--shadow-md)' : 'none' }}>
                {p.badge && <span style={{ position: 'absolute', top: -10, left: 22, fontSize: 10, fontWeight: 800, color: 'white', background: p.color, padding: '3px 10px', borderRadius: 6, letterSpacing: '0.04em' }}>{p.badge.toUpperCase()}</span>}
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2, minHeight: 32 }}>{p.tagline}</div>
                <div style={{ margin: '14px 0 16px', minHeight: 56 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', lineHeight: 1 }}>{formatPrice(price)}</span>
                    {price > 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>/mês</span>}
                  </div>
                  {/* Transparência: no plano anual mostramos o valor REAL cobrado por ano */}
                  {price > 0 && billing === 'annual' && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 5 }}>
                      {formatPrice(p.price.annualTotal)} cobrados uma vez por ano
                    </div>
                  )}
                  {price > 0 && billing === 'monthly' && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 5 }}>
                      ou {formatPrice(p.price.annualTotal)}/ano ({formatPrice(p.price.annual)}/mês)
                    </div>
                  )}
                </div>
                <Link href={p.href} style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 9, textDecoration: 'none', fontSize: 14, fontWeight: 700, marginBottom: 16, background: p.highlight ? p.color : 'white', color: p.highlight ? 'white' : 'var(--ink)', border: p.highlight ? 'none' : '1.5px solid var(--border)' }}>{p.cta}</Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5"/></svg>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Organization plan — full width banner */}
        <div style={{ background: '#0b1120', borderRadius: 16, padding: 24, color: 'white', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{org.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', background: 'rgba(147,197,253,0.15)', padding: '2px 8px', borderRadius: 5 }}>ORGANIZAÇÕES</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>{org.tagline}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px 18px' }}>
              {org.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, lineHeight: 1 }}>{formatPrice(billing === 'monthly' ? org.price.monthly : org.price.annual)}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>/mês</span></div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>por instituição</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
              {billing === 'annual'
                ? `${formatPrice(org.price.annualTotal)} cobrados uma vez por ano`
                : `ou ${formatPrice(org.price.annualTotal)}/ano`}
            </div>
            <Link href={org.href} style={{ display: 'block', padding: '11px 28px', background: '#2563eb', color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>{org.cta}</Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-5)', marginTop: 24 }}>
          Todos os planos podem mudar a qualquer momento. Sem fidelização.
        </p>
      </div>

      <style>{`
        @media (min-width: 760px) { .pricing-grid { grid-template-columns: repeat(3, 1fr) !important; } }
      `}</style>
    </div>
  )
}
