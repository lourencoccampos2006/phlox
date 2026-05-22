'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Inputs {
  residents: number
  staff: number
  avgWage: number
  softwareCost: number
  fallsPerYear: number
  medErrorsPerYear: number
  docHoursPerShift: number
  shiftsPerMonth: number
}

function calcSavings(inp: Inputs) {
  // 1. Medication errors: avg cost of a medication error in PT nursing home ~€180 (treatment, incident report, family communication, potential liability)
  const medErrorSaving = inp.medErrorsPerYear * 180 * 0.6 // 60% reduction with digital MAR

  // 2. Fall prevention: avg cost of a fall incident in Portugal ~€320 (ER, treatment, documentation, staff time)
  const fallSaving = inp.fallsPerYear * 320 * 0.35 // 35% reduction with risk assessment protocols

  // 3. Documentation time saved: nurses/caregivers spend X hours/shift on documentation
  //    Digital reduces it by ~40min/shift (~40%)
  const docTimeSavedHoursPerMonth = inp.shiftsPerMonth * (inp.docHoursPerShift * 0.4)
  const docTimeSaving = docTimeSavedHoursPerMonth * (inp.avgWage / 160) // hourly rate

  // 4. Compliance & audit readiness: avoid fines, ACSS visits easier
  //    Avg fine for documentation failure in ERPI: €500-5000. Conservative: €400/year avoided
  const complianceSaving = 400

  // 5. Family communication: fewer calls because info is accessible
  //    2 calls/month/resident × 10min × avg wage = time saved
  const famCommSaving = inp.residents * 2 * (10 / 60) * (inp.avgWage / 160) * 12

  // 6. Staff turnover reduction: better tools = less frustration
  //    Conservative: save 0.5 staff replacements/year. Cost to replace = 1 month salary
  const turnoverSaving = 0.5 * inp.avgWage

  const totalYearly = medErrorSaving + fallSaving + docTimeSaving * 12 + complianceSaving + famCommSaving + turnoverSaving
  const totalMonthly = totalYearly / 12
  const roi = inp.softwareCost > 0 ? Math.round((totalMonthly / inp.softwareCost) * 100) : 0
  const paybackDays = inp.softwareCost > 0 && totalMonthly > 0 ? Math.round((inp.softwareCost / totalMonthly) * 30) : 0

  return {
    medErrorSaving: medErrorSaving / 12,
    fallSaving: fallSaving / 12,
    docTimeSaving,
    complianceSaving: complianceSaving / 12,
    famCommSaving: famCommSaving / 12,
    turnoverSaving: turnoverSaving / 12,
    totalMonthly,
    totalYearly,
    roi,
    paybackDays,
  }
}

function euro(v: number) { return `€${Math.round(v).toLocaleString('pt-PT')}` }

export default function ROIPage() {
  const [inp, setInp] = useState<Inputs>({
    residents: 30,
    staff: 12,
    avgWage: 900,
    softwareCost: 199,
    fallsPerYear: 18,
    medErrorsPerYear: 12,
    docHoursPerShift: 1.5,
    shiftsPerMonth: 90,
  })

  const r = calcSavings(inp)
  const f = (k: keyof Inputs, v: number) => setInp(p => ({ ...p, [k]: v }))

  const breakeven = r.roi >= 100
  const multiplier = r.totalMonthly > 0 && inp.softwareCost > 0 ? (r.totalMonthly / inp.softwareCost).toFixed(1) : '0'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Gestão · Valor</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Calculadora de Retorno</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 560 }}>
            Quanto poupa o vosso lar ao usar o Phlox? Ajusta os valores e vê o impacto real — em euros, por mês.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }}>

          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionHead>Sobre o lar</SectionHead>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
              <Row label="Número de residentes" hint="Capacidade atual">
                <Slider value={inp.residents} min={5} max={200} step={5} onChange={v => f('residents', v)} />
              </Row>
              <Row label="Funcionários total" hint="Enfermeiros + AADs + outros">
                <Slider value={inp.staff} min={2} max={60} step={1} onChange={v => f('staff', v)} />
              </Row>
              <Row label="Salário médio mensal" hint="Bruto €/mês">
                <Slider value={inp.avgWage} min={700} max={2000} step={50} onChange={v => f('avgWage', v)} format={euro} />
              </Row>
              <Row label="Custo do Phlox (€/mês)" hint="Plano atual" last>
                <Slider value={inp.softwareCost} min={99} max={499} step={50} onChange={v => f('softwareCost', v)} format={euro} />
              </Row>
            </div>

            <SectionHead>Operações (estimativas anuais)</SectionHead>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
              <Row label="Quedas por ano" hint="Incidentes registados">
                <Slider value={inp.fallsPerYear} min={0} max={60} step={1} onChange={v => f('fallsPerYear', v)} />
              </Row>
              <Row label="Erros de medicação por ano" hint="Doses erradas, omissões">
                <Slider value={inp.medErrorsPerYear} min={0} max={50} step={1} onChange={v => f('medErrorsPerYear', v)} />
              </Row>
              <Row label="Horas de documentação por turno" hint="Tempo médio de cada profissional">
                <Slider value={inp.docHoursPerShift} min={0.5} max={4} step={0.25} onChange={v => f('docHoursPerShift', v)} format={v => `${v}h`} />
              </Row>
              <Row label="Turnos por mês (total equipa)" hint="Ex: 3 turnos/dia × 30 dias" last>
                <Slider value={inp.shiftsPerMonth} min={10} max={300} step={5} onChange={v => f('shiftsPerMonth', v)} />
              </Row>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Main result */}
            <div style={{ background: breakeven ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' : 'white', border: breakeven ? 'none' : '1px solid var(--border)', borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: breakeven ? 'rgba(255,255,255,0.5)' : 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                Poupança estimada por mês
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 52, color: breakeven ? '#4ade80' : 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
                {euro(r.totalMonthly)}
              </div>
              <div style={{ fontSize: 13, color: breakeven ? 'rgba(255,255,255,0.6)' : 'var(--ink-4)', marginBottom: 16 }}>
                {euro(r.totalYearly)} por ano
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: breakeven ? 'rgba(255,255,255,0.08)' : 'var(--bg-2)', borderRadius: 10, padding: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: breakeven ? '#fff' : 'var(--ink)', lineHeight: 1 }}>{multiplier}×</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: breakeven ? 'rgba(255,255,255,0.45)' : 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Retorno</div>
                </div>
                <div style={{ background: breakeven ? 'rgba(255,255,255,0.08)' : 'var(--bg-2)', borderRadius: 10, padding: '10px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: breakeven ? '#fff' : 'var(--ink)', lineHeight: 1 }}>{r.paybackDays}d</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: breakeven ? 'rgba(255,255,255,0.45)' : 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Payback</div>
                </div>
              </div>

              {breakeven && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#86efac', fontWeight: 600 }}>
                  O Phlox paga-se {Math.round(parseFloat(multiplier))}× por si mesmo todos os meses
                </div>
              )}
            </div>

            {/* Breakdown */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Origem das poupanças (€/mês)
              </div>
              {[
                { label: 'Redução de erros de medicação',   value: r.medErrorSaving,    icon: '💊', desc: '60% menos erros com MAR digital' },
                { label: 'Prevenção de quedas',             value: r.fallSaving,         icon: '🛡️', desc: '35% menos quedas com avaliações Morse' },
                { label: 'Tempo de documentação',           value: r.docTimeSaving,      icon: '⏱️', desc: '40% menos tempo em papelada' },
                { label: 'Conformidade regulatória',        value: r.complianceSaving,   icon: '📋', desc: 'Menos risco de multas ACSS' },
                { label: 'Comunicação com familiares',      value: r.famCommSaving,      icon: '👨‍👩‍👧', desc: 'Menos chamadas com info disponível' },
                { label: 'Retenção de funcionários',        value: r.turnoverSaving,     icon: '🤝', desc: 'Melhores ferramentas = menos rotatividade' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>{item.desc}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>{euro(item.value)}</div>
                </div>
              ))}
              {/* Cost row */}
              <div style={{ padding: '11px 16px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 12, borderTop: '2px solid var(--border)' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>Custo do Phlox</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>Plano clínico institucional</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>−{euro(inp.softwareCost)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: r.totalMonthly > inp.softwareCost ? '#f0fdf4' : 'var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Saldo líquido / mês</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 900, color: r.totalMonthly - inp.softwareCost > 0 ? '#16a34a' : '#dc2626' }}>
                  {euro(r.totalMonthly - inp.softwareCost)}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 14 }}>
                Estes valores são estimativas conservadoras baseadas em estudos do setor. O impacto real pode ser superior.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/connect" style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                  Falar com a equipa →
                </Link>
                <button onClick={() => window.print()} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Imprimir relatório
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .page-body > div > div:last-child { grid-column: 1/-1; }
          .page-body > div > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>{children}</div>
}

function Row({ label, hint, children, last = false }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: last ? 0 : 12, marginBottom: last ? 0 : 12, borderBottom: last ? 'none' : '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ minWidth: 140 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 1 }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Slider({ value, min, max, step, onChange, format }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 120, accentColor: '#1d4ed8', cursor: 'pointer' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--ink)', minWidth: 48, textAlign: 'right' }}>
        {format ? format(value) : value}
      </span>
    </div>
  )
}
