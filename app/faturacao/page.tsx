'use client'

// Faturação — ESPECÍFICA por tipo de instituição:
//  • lar/ERPI  → mensalidades + comparticipações (MonthlyBilling)
//  • farmácia  → vendas/caixa diária (SalesBilling POS)
//  • clínica / centro de saúde / hospital → atos & recibos (SalesBilling fee-for-service)
//  • farmácia hospitalar → distribuição interna (sem faturação ao doente)

import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import MonthlyBilling from './MonthlyBilling'
import SalesBilling from './SalesBilling'

export default function FaturacaoPage() {
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)

  if (cfg.revenue === 'monthly_fee') return <MonthlyBilling />
  if (cfg.revenue === 'internal') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 720 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Financeiro · {cfg.unitNoun}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 14px' }}>Distribuição interna</h1>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 24, fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            A farmácia hospitalar não fatura ao doente — distribui internamente por serviço.
            A gestão de existências, lotes e validade faz-se em <a href="/stock" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Stock &amp; Validades</a> e a dispensa em <a href="/atendimentos" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Atendimentos</a>.
          </div>
        </div>
      </div>
    )
  }
  return <SalesBilling revenue={cfg.revenue} unitNoun={cfg.unitNoun} personNoun={cfg.personNoun} />
}
