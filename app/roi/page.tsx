'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Inputs {
  residents: number; staff: number; avgWage: number; softwareCost: number
  fallsPerYear: number; medErrorsPerYear: number; docHoursPerShift: number; shiftsPerMonth: number
}

function calcSavings(inp: Inputs) {
  const medErrorSaving  = inp.medErrorsPerYear * 180 * 0.6
  const fallSaving      = inp.fallsPerYear * 320 * 0.35
  const docTimeSaving   = inp.shiftsPerMonth * (inp.docHoursPerShift * 0.4) * (inp.avgWage / 160)
  const complianceSaving = 400
  const famCommSaving   = inp.residents * 2 * (10 / 60) * (inp.avgWage / 160) * 12
  const turnoverSaving  = 0.5 * inp.avgWage
  const totalYearly     = medErrorSaving + fallSaving + docTimeSaving * 12 + complianceSaving + famCommSaving + turnoverSaving
  const totalMonthly    = totalYearly / 12
  const roi             = inp.softwareCost > 0 ? Math.round((totalMonthly / inp.softwareCost) * 100) : 0
  const paybackDays     = inp.softwareCost > 0 && totalMonthly > 0 ? Math.round((inp.softwareCost / totalMonthly) * 30) : 0
  return {
    medErrorSaving: medErrorSaving / 12, fallSaving: fallSaving / 12,
    docTimeSaving, complianceSaving: complianceSaving / 12,
    famCommSaving: famCommSaving / 12, turnoverSaving: turnoverSaving / 12,
    totalMonthly, totalYearly, roi, paybackDays,
  }
}

function euro(v: number) { return `€${Math.round(v).toLocaleString('pt-PT')}` }

function InputRow({ label, hint, value, min, max, step, onChange, format }: {
  label: string; hint?: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</span>
          {hint && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{hint}</span>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', height: 4 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: '#cbd5e1' }}>{format ? format(min) : min}</span>
        <span style={{ fontSize: 9, color: '#cbd5e1' }}>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

function SavingsRow({ label, value, pct, last = false }: { label: string; value: number; pct: number; last?: boolean }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: last ? 'none' : '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{euro(value)}</span>
      </div>
      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#059669', borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function ROIPage() {
  const [inp, setInp] = useState<Inputs>({
    residents: 30, staff: 12, avgWage: 900, softwareCost: 199,
    fallsPerYear: 18, medErrorsPerYear: 12, docHoursPerShift: 1.5, shiftsPerMonth: 90,
  })
  const r = calcSavings(inp)
  const f = (k: keyof Inputs, v: number) => setInp(p => ({ ...p, [k]: v }))
  const netMonthly = r.totalMonthly - inp.softwareCost
  const multiplier = inp.softwareCost > 0 ? (r.totalMonthly / inp.softwareCost) : 0
  const maxSaving = Math.max(r.medErrorSaving, r.fallSaving, r.docTimeSaving, r.famCommSaving, r.turnoverSaving)

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Gestão · Retorno sobre Investimento
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Calculadora de Poupança</div>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginTop: 6, maxWidth: 520 }}>
            Quantifica o impacto financeiro do Phlox no vosso lar. Ajusta os valores às vossas operações.
          </p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 900 }}>
        <div className="roi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* Left: inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sobre o lar
              </div>
              <div style={{ padding: '16px', paddingBottom: 2 }}>
                <InputRow label="Residentes" hint="capacidade actual" value={inp.residents} min={5} max={200} step={5} onChange={v => f('residents', v)} />
                <InputRow label="Funcionários" hint="total" value={inp.staff} min={2} max={60} step={1} onChange={v => f('staff', v)} />
                <InputRow label="Salário médio" value={inp.avgWage} min={700} max={2000} step={50} onChange={v => f('avgWage', v)} format={euro} />
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Custo do Phlox</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>{euro(inp.softwareCost)}/mês</span>
                  </div>
                  <input type="range" min={99} max={499} step={50} value={inp.softwareCost}
                    onChange={e => f('softwareCost', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', height: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: '#cbd5e1' }}>€99</span>
                    <span style={{ fontSize: 9, color: '#cbd5e1' }}>€499</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Operações — estimativas anuais
              </div>
              <div style={{ padding: '16px', paddingBottom: 2 }}>
                <InputRow label="Quedas por ano" value={inp.fallsPerYear} min={0} max={60} step={1} onChange={v => f('fallsPerYear', v)} />
                <InputRow label="Erros de medicação" hint="doses erradas, omissões" value={inp.medErrorsPerYear} min={0} max={50} step={1} onChange={v => f('medErrorsPerYear', v)} />
                <InputRow label="Horas doc. por turno" value={inp.docHoursPerShift} min={0.5} max={4} step={0.25} onChange={v => f('docHoursPerShift', v)} format={v => `${v}h`} />
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Turnos/mês</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>total equipa</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>{inp.shiftsPerMonth}</span>
                  </div>
                  <input type="range" min={10} max={300} step={5} value={inp.shiftsPerMonth}
                    onChange={e => f('shiftsPerMonth', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer', height: 4 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: '#cbd5e1' }}>10</span>
                    <span style={{ fontSize: 9, color: '#cbd5e1' }}>300</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, padding: '0 4px' }}>
              Valores baseados em estudos do setor e benchmarks de lares portugueses (ACSS, INR). Estimativas conservadoras.
            </div>
          </div>

          {/* Right: results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Main KPIs */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Poupança estimada / mês
              </div>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#059669', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 4 }}>
                {euro(r.totalMonthly)}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                {euro(r.totalYearly)} por ano
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Retorno', value: `${multiplier.toFixed(1)}×` },
                  { label: 'Payback', value: `${r.paybackDays}d` },
                  { label: 'ROI', value: `${r.roi}%` },
                ].map(k => (
                  <div key={k.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 8px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: netMonthly > 0 ? '#059669' : '#374151', lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Net balance */}
            <div style={{ background: netMonthly > 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${netMonthly > 0 ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: netMonthly > 0 ? '#166534' : '#991b1b' }}>
                  {netMonthly > 0 ? 'Saldo positivo mensal' : 'Investimento mensal'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Poupança {euro(r.totalMonthly)} − custo {euro(inp.softwareCost)}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: netMonthly > 0 ? '#059669' : '#dc2626' }}>
                {netMonthly > 0 ? '+' : ''}{euro(netMonthly)}
              </div>
            </div>

            {/* Savings breakdown */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Origem das poupanças — €/mês
              </div>
              <div style={{ padding: '12px 16px' }}>
                <SavingsRow label="Redução de erros de medicação"  value={r.medErrorSaving}  pct={r.medErrorSaving / maxSaving * 100} />
                <SavingsRow label="Prevenção de quedas"            value={r.fallSaving}       pct={r.fallSaving / maxSaving * 100} />
                <SavingsRow label="Tempo de documentação"          value={r.docTimeSaving}    pct={r.docTimeSaving / maxSaving * 100} />
                <SavingsRow label="Conformidade regulatória"       value={r.complianceSaving} pct={r.complianceSaving / maxSaving * 100} />
                <SavingsRow label="Comunicação com familiares"     value={r.famCommSaving}    pct={r.famCommSaving / maxSaving * 100} />
                <SavingsRow label="Retenção de funcionários"       value={r.turnoverSaving}   pct={r.turnoverSaving / maxSaving * 100} last />
              </div>
              <div style={{ padding: '12px 16px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Total poupança / mês</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#059669' }}>{euro(r.totalMonthly)}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Custo Phlox / mês</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>−{euro(inp.softwareCost)}</span>
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/connect"
                style={{ flex: 1, padding: '11px 16px', background: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                Falar com a equipa →
              </Link>
              <button onClick={() => window.print()}
                style={{ padding: '11px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .roi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
