'use client'

// /risco — Perfil de risco pessoal. Cruza o que está no Phlox (mymeds, vitals,
// labs) com algoritmos validados (SCORE2, ACB, STOPP/Beers simplificados).
// Não substitui consulta médica — apenas dá contexto e prepara o utilizador.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { computeRisk, type RiskResult, type RiskInput } from '@/lib/riskEngine'
import Link from 'next/link'
import SaveButton from '@/components/SaveButton'

export default function RiscoPage() {
  const { user, supabase } = useAuth()
  const [input, setInput] = useState<RiskInput>({ meds: [] })
  const [result, setResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(true)
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  // Carrega dados existentes do Phlox: medicação, vitais recentes
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const [meds, vit] = await Promise.all([
          supabase.from('personal_meds').select('name, dose').eq('user_id', user.id),
          supabase.from('vital_signs').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }).limit(20),
        ])
        const medNames = (meds.data || []).map((m: any) => (m.name || '').trim()).filter(Boolean)
        const lastSbp = (vit.data || []).find((v: any) => v.systolic)?.systolic
        setInput(prev => ({
          ...prev,
          meds: medNames,
          sbp: lastSbp || prev.sbp,
        }))
      } catch {}
      finally { setLoading(false) }
    })()
  }, [user?.id])

  function recompute() {
    setResult(computeRisk(input))
  }

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)' }}>Perfil de risco pessoal</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          O Phlox cruza a tua medicação e os teus vitais com algoritmos validados (SCORE2, ACB, STOPP/Beers) e mostra-te o que conversar com o médico.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#0d6e42', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Pessoal · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 3vw, 36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Perfil de risco</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>
            Estimativa de risco a partir do que já tens no Phlox. Para conversares com o médico — não para te diagnosticar.
          </p>
        </div>

        {/* Inputs */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
            <Field label="Idade" value={input.age} onChange={n => setInput(p => ({ ...p, age: n }))} suffix="anos" />
            <Field label="TA sistólica" value={input.sbp} onChange={n => setInput(p => ({ ...p, sbp: n }))} suffix="mmHg" />
            <Field label="Colesterol total" value={input.totalChol_mmolL} onChange={n => setInput(p => ({ ...p, totalChol_mmolL: n }))} suffix="mmol/L" step={0.1} />
            <Field label="HDL" value={input.hdlChol_mmolL} onChange={n => setInput(p => ({ ...p, hdlChol_mmolL: n }))} suffix="mmol/L" step={0.1} />
            <Field label="HbA1c" value={input.hba1c_pct} onChange={n => setInput(p => ({ ...p, hba1c_pct: n }))} suffix="%" step={0.1} />
            <Field label="eGFR" value={input.ckdEgfr} onChange={n => setInput(p => ({ ...p, ckdEgfr: n }))} suffix="mL/min" />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <SelectChip label="Sexo" value={input.sex || ''} options={[['M', 'Masculino'], ['F', 'Feminino']]} onChange={v => setInput(p => ({ ...p, sex: v as 'M' | 'F' }))} />
            <ToggleChip label="Fumador" active={!!input.smoker} onClick={() => setInput(p => ({ ...p, smoker: !p.smoker }))} />
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
              <strong>{input.meds.length}</strong> fármacos do teu perfil
            </div>
          </div>
          <button onClick={recompute} disabled={loading}
            style={{ marginTop: 14, width: '100%', padding: 12, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            Calcular perfil de risco →
          </button>
        </div>

        {result && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Banda de risco global</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: bandColor(result.overall_band), fontWeight: 700, lineHeight: 1 }}>
                  {bandLabel(result.overall_band)}
                </div>
              </div>
              {typeof result.cv_10y_pct === 'number' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{result.cv_method} · CV 10 anos</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#0b1120', fontWeight: 700 }}>{result.cv_10y_pct}%</div>
                </div>
              )}
              <SaveButton kind="other" title={`Perfil de risco: ${bandLabel(result.overall_band)}`}
                preview={`Risco CV 10 anos: ${result.cv_10y_pct ?? '—'}% · ACB ${result.anticholinergic_burden} · ${result.items.length} alertas`}
                data={result} href="/risco" color="#0d6e42" />
            </div>

            <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12, color: '#475569', flexWrap: 'wrap' }}>
              <Stat label="Polifarmácia" value={result.polypharmacy_count} />
              <Stat label="Carga anticolinérgica (ACB)" value={result.anticholinergic_burden} />
              <Stat label="Alertas" value={result.items.length} />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Análise detalhada</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.items.length === 0 && <div style={{ color: '#16a34a', fontSize: 13 }}>✓ Nenhum alerta — perfil de baixo risco com os dados atuais.</div>}
                {result.items.map(it => <RiskRow key={it.id} item={it} />)}
              </div>
            </div>

            {result.recommendations.length > 0 && (
              <div style={{ marginTop: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '3px solid #16a34a', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#15803d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>O que fazer agora</div>
                <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
                  {result.recommendations.map((r, i) => <li key={i} style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>{r}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 14, fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
              Este perfil é informativo. Os algoritmos foram validados em populações gerais e podem não refletir a tua situação específica. Confirma com o teu médico.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function Field({ label, value, onChange, suffix, step = 1 }: { label: string; value?: number; onChange: (n: number | undefined) => void; suffix?: string; step?: number }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <input type="number" step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '7px 9px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        {suffix && <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{suffix}</span>}
      </div>
    </div>
  )
}
function SelectChip({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}:</span>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${value === v ? '#0d6e42' : '#e5e7eb'}`, background: value === v ? '#0d6e4214' : 'white', color: value === v ? '#0d6e42' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{l}</button>
      ))}
    </div>
  )
}
function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${active ? '#dc2626' : '#e5e7eb'}`, background: active ? '#fef2f2' : 'white', color: active ? '#dc2626' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
      {active ? '✓ ' : ''}{label}
    </button>
  )
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#0b1120' }}>{value}</div>
    </div>
  )
}
function RiskRow({ item }: { item: any }) {
  const c = item.severity === 'critical' ? '#dc2626' : item.severity === 'warning' ? '#d97706' : '#1d4ed8'
  const bg = item.severity === 'critical' ? '#fef2f2' : item.severity === 'warning' ? '#fffbeb' : '#eff6ff'
  return (
    <div style={{ background: bg, border: `1px solid ${c}40`, borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: c, marginBottom: 3 }}>{item.label}</div>
      <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>{item.detail}</div>
      {item.reference && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{item.reference}</div>}
    </div>
  )
}

function bandLabel(b: string) {
  return ({ baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto', muito_alto: 'Muito alto' } as any)[b] || b
}
function bandColor(b: string) {
  return ({ baixo: '#16a34a', moderado: '#d97706', alto: '#dc2626', muito_alto: '#991b1b' } as any)[b] || '#0b1120'
}
