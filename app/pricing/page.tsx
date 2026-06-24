'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLANS, formatPrice } from '@/lib/plans'

// /pricing 2026-06-24 — mesma linguagem editorial da homepage: filetes, mono
// labels, preços em serif, verde muted, cantos retos. Lógica intacta.

type Billing = 'monthly' | 'annual'

const INK = '#16181d'
const INK_3 = '#545862'
const INK_4 = '#767b86'
const GREEN = '#0d6e42'
const BORDER = '#e7e8ea'
const PAPER = '#fbfaf7'

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const individual = PLANS.filter(p => p.audience === 'individual')
  const org = PLANS.find(p => p.audience === 'organization')!

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-sans)', color: INK }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(36px,6vw,72px) clamp(20px,5vw,40px) 72px', boxSizing: 'border-box', width: '100%' }}>

        {/* Cabeçalho editorial */}
        <div style={{ marginBottom: 'clamp(28px,4vw,44px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
            <span style={{ width: 34, height: 1.5, background: GREEN }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: INK_4, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>Planos</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px,5.4vw,52px)', color: INK, fontWeight: 500, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.04, maxWidth: '16ch' }}>
            Comece grátis.<br />Cresça quando precisar.
          </h1>
          <p style={{ fontSize: 'clamp(15px,1.7vw,17px)', color: INK_3, lineHeight: 1.62, marginTop: 18, maxWidth: '52ch' }}>
            O plano Base é grátis (com anúncios). Qualquer upgrade remove os anúncios, aumenta os
            limites e desbloqueia mais ferramentas. Sem fidelização.
          </p>
        </div>

        {/* Toggle de faturação */}
        <div style={{ display: 'flex', marginBottom: 'clamp(24px,3vw,36px)' }}>
          <div style={{ display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            {(['monthly', 'annual'] as Billing[]).map(b => (
              <button key={b} onClick={() => setBilling(b)} style={{ padding: '9px 18px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: billing === b ? INK : 'transparent', color: billing === b ? '#fff' : INK_4, transition: 'all .15s' }}>
                {b === 'monthly' ? 'Mensal' : 'Anual'}{b === 'annual' && <span style={{ marginLeft: 7, color: billing === b ? '#7fc4a0' : GREEN }}>−20%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Planos individuais — colunas editoriais separadas por filete */}
        <div className="pr-grid">
          {individual.map((p, i) => {
            const price = billing === 'monthly' ? p.price.monthly : p.price.annual
            return (
              <div key={p.id} className="pr-col" style={{ borderTop: `3px solid ${p.highlight ? GREEN : INK}`, background: p.highlight ? PAPER : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: INK_4 }}>0{i + 1}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{p.name}</span>
                  {p.badge && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: GREEN, border: `1px solid ${GREEN}55`, padding: '2px 7px', borderRadius: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.badge}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: INK_4, minHeight: 34, lineHeight: 1.45 }}>{p.tagline}</div>
                <div style={{ margin: '16px 0', minHeight: 60 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 40, color: INK, lineHeight: 1, letterSpacing: '-0.02em' }}>{formatPrice(price)}</span>
                    {price > 0 && <span style={{ fontSize: 12, color: INK_4 }}>/mês</span>}
                  </div>
                  {price > 0 && billing === 'annual' && <div style={{ fontSize: 11.5, color: INK_4, marginTop: 6, fontFamily: 'var(--font-mono)' }}>{formatPrice(p.price.annualTotal)} uma vez por ano</div>}
                  {price > 0 && billing === 'monthly' && <div style={{ fontSize: 11.5, color: INK_4, marginTop: 6, fontFamily: 'var(--font-mono)' }}>ou {formatPrice(p.price.annual)}/mês no anual</div>}
                </div>
                <Link href={p.href} className="pr-cta" style={{ background: p.highlight ? INK : '#fff', color: p.highlight ? '#fff' : INK, border: `1.5px solid ${INK}` }}>{p.cta}</Link>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${BORDER}` }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: GREEN, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>—</span>
                      <span style={{ fontSize: 13.5, color: INK_3, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Organização — bloco escuro sóbrio */}
        <div style={{ background: INK, padding: 'clamp(24px,4vw,36px)', color: '#fff', marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', justifyContent: 'space-between', borderTop: `3px solid ${GREEN}` }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{org.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: '#7fc4a0', border: '1px solid rgba(127,196,160,0.4)', padding: '2px 8px', borderRadius: 2, letterSpacing: '0.06em' }}>ORGANIZAÇÕES</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 18, lineHeight: 1.5 }}>{org.tagline}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 20px' }}>
              {org.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ color: '#7fc4a0', flexShrink: 0 }}>—</span>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, minWidth: 160 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, lineHeight: 1, letterSpacing: '-0.02em' }}>{formatPrice(billing === 'monthly' ? org.price.monthly : org.price.annual)}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>/mês</span></div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '6px 0 16px' }}>
              por instituição · {billing === 'annual' ? `${formatPrice(org.price.annualTotal)}/ano` : `ou ${formatPrice(org.price.annualTotal)}/ano`}
            </div>
            <Link href={org.href} style={{ display: 'inline-block', padding: '12px 28px', background: '#fff', color: INK, textDecoration: 'none', fontSize: 14, fontWeight: 700, borderRadius: 2 }}>{org.cta}</Link>
          </div>
        </div>

        <p style={{ fontSize: 12, color: INK_4, marginTop: 28, fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
          Todos os planos podem mudar a qualquer momento. Sem fidelização.
        </p>
      </div>

      <style>{`
        .pr-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
        .pr-col { padding: 22px 20px 24px; border-bottom: 1px solid ${BORDER}; }
        .pr-cta { display: block; text-align: center; padding: 12px; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 2px; transition: background .15s, color .15s; }
        .pr-col:hover .pr-cta { background: ${GREEN} !important; color: #fff !important; border-color: ${GREEN} !important; }
        @media (min-width: 760px) {
          .pr-grid { grid-template-columns: repeat(3, 1fr); gap: 0; border-left: 1px solid ${BORDER}; }
          .pr-col { border-bottom: none; border-right: 1px solid ${BORDER}; }
        }
      `}</style>
    </div>
  )
}
