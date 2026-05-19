'use client'

// ─── NOVO: app/plano/page.tsx ─── Phlox Care Plan
// O Plano de Cuidado Farmacológico Personalizado.
// Dado um perfil com medicação e condições, gera em segundos um documento
// completo que responde ao gap de 3 meses entre consultas:
// o que tomar, quando, o que monitorizar, sinais de alerta, o que evitar,
// e perguntas para a próxima consulta.
// Adaptado ao modo de experiência: clínico, cuidador, pessoal ou estudante.
// Imprimível. Partilhável. Específico para aquela combinação de medicamentos.

import { useState, useEffect } from 'react'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Plan types ───────────────────────────────────────────────────────────────

interface CarePlan {
  profile_summary: string
  generated_for: string
  mode: 'clinical' | 'caregiver' | 'personal' | 'student'

  medications: {
    name: string
    dci: string
    what_it_does: string          // linguagem adaptada ao modo
    when_to_take: string          // horário optimizado
    with_food: 'sim' | 'não' | 'indiferente' | 'preferencialmente'
    duration: string
    critical_note?: string        // alerta específico para este doente
  }[]

  optimised_schedule: {           // calendário de toma optimizado
    time: string
    meds: { name: string; dose: string; note?: string }[]
  }[]

  monitoring: {
    parameter: string
    target: string
    frequency: string
    why: string
    red_flag: string              // valor que exige ida ao médico
  }[]

  red_flags: {                    // específicos desta combinação
    sign: string
    meaning: string
    action: 'urgência' | 'médico em 24h' | 'farmacêutico' | 'vigiar'
    severity: 'crítico' | 'importante' | 'atenção'
  }[]

  avoid: {
    category: 'alimento' | 'bebida' | 'actividade' | 'medicamento_otc' | 'suplemento'
    item: string
    reason: string
    applies_to: string            // qual dos medicamentos
  }[]

  renewals: {
    medication: string
    renew_in: string
    note?: string
  }[]

  questions_for_doctor: string[]  // perguntas concretas para a próxima consulta

  student_insights?: {            // só no modo student
    mechanisms: string
    pharmacokinetics: string
    clinical_reasoning: string
  }

  disclaimer: string
}

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  header, .no-print { display: none !important; }
  .page-body { padding: 0 !important; }
  body { font-size: 12px !important; }
  .plan-section { break-inside: avoid; }
}
`

// ─── Mode styles ──────────────────────────────────────────────────────────────

const MODE_META = {
  clinical:  { label: 'Clínico',         color: '#1d4ed8', bg: '#0f172a', headerText: '#f8fafc' },
  caregiver: { label: 'Cuidador',         color: '#b45309', bg: '#fffbeb', headerText: '#78350f' },
  personal:  { label: 'Pessoal',          color: '#0d6e42', bg: '#f0fdf5', headerText: '#14532d' },
  student:   { label: 'Estudante',        color: '#7c3aed', bg: '#faf5ff', headerText: '#5b21b6' },
}

// ─── Section components ───────────────────────────────────────────────────────

function Section({ title, icon, children, accent = 'var(--ink)' }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="plan-section" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</div>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function AlertBadge({ severity }: { severity: 'crítico' | 'importante' | 'atenção' }) {
  const s = {
    crítico:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    importante: { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
    atenção:    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  }[severity]
  return <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{severity}</span>
}

function ActionBadge({ action }: { action: string }) {
  const s = action === 'urgência'
    ? { bg: '#dc2626', color: 'white' }
    : action === 'médico em 24h'
    ? { bg: '#d97706', color: 'white' }
    : { bg: 'var(--bg-3)', color: 'var(--ink-3)' }
  return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, background: s.bg, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.04em', flexShrink: 0, textTransform: 'uppercase' }}>{action === 'urgência' ? '🚨 ' + action : action}</span>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PlanoPage() {
  const { user, supabase } = useAuth()
  const [plan, setPlan] = useState<CarePlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [meds, setMeds] = useState('')
  const [conditions, setConditions] = useState('')
  const [age, setAge] = useState('')
  const [patientName, setPatientName] = useState(user?.name?.split(' ')[0] || '')
  const [profileId, setProfileId] = useState<string | null>(null)
  const experienceMode = (user as any)?.experience_mode || 'personal'
  const modeMeta = MODE_META[experienceMode as keyof typeof MODE_META] || MODE_META.personal
  const userPlan = (user?.plan || 'free') as string
  const canGenerate = userPlan !== 'free'

  // Auto-load meds when profile changes
  const handleProfile = async (p: any) => {
    setProfileId(p.id === 'self' ? null : p.id)
    if (p.name) setPatientName(p.name)
    if (!supabase) return
    const table = p.id === 'self' ? 'personal_meds' : 'family_profile_meds'
    const col   = p.id === 'self' ? 'user_id' : 'profile_id'
    const id    = p.id === 'self' ? user?.id : p.id
    const { data } = await supabase.from(table).select('name, dose, frequency, indication').eq(col, id)
    if (data?.length) {
      setMeds(data.map((m: any) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' ' + m.frequency : ''}${m.indication ? ' (indicação: ' + m.indication + ')' : ''}`).join('\n'))
    }
    // Also load conditions from family_profiles
    if (p.id !== 'self' && p.conditions) setConditions(p.conditions)
  }

  const generate = async () => {
    if (!meds.trim()) return
    setLoading(true); setError(''); setPlan(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          medications: meds.trim(),
          conditions: conditions.trim(),
          age: age ? parseInt(age) : null,
          patient_name: patientName.trim() || null,
          mode: experienceMode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlan(data)
      setTimeout(() => window.scrollTo({ top: document.getElementById('plan-output')?.offsetTop || 0, behavior: 'smooth' }), 100)
    } catch (e: any) { setError(e.message || 'Erro. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win || !plan) return
    const content = document.getElementById('plan-output')?.innerHTML || ''
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>Plano de Cuidado — ${plan.generated_for}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#111;padding:24px;font-size:12px;line-height:1.6}
      h1{font-size:20px;font-weight:400;font-family:Georgia,serif;margin-bottom:4px}
      h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-family:monospace;margin:16px 0 8px;color:#555;display:flex;align-items:center;gap:6px}
      .section{background:#f9f9f9;border-radius:4px;padding:12px;margin-bottom:12px;break-inside:avoid}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th{font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-family:monospace;color:#888;text-align:left;padding:4px 8px;border-bottom:1px solid #e0e0e0}
      td{font-size:12px;padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
      .badge{font-size:9px;font-family:monospace;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
      .red{background:#fee2e2;color:#991b1b}.orange{background:#fef9c3;color:#854d0e}.blue{background:#eff6ff;color:#1d4ed8}.green{background:#d1fae5;color:#065f46}
      ul{padding-left:16px;margin-top:4px}.li{margin-bottom:4px}
      .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:10px;color:#aaa;font-family:monospace;display:flex;justify-content:space-between}
    </style></head><body>${content}<div class="footer"><span>Gerado pelo Phlox Clinical · phlox-clinical.com</span><span>${new Date().toLocaleDateString('pt-PT')}</span></div></body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  const handleShare = async () => {
    if (!plan) return
    const text = `Plano de Cuidado Farmacológico — ${plan.generated_for}\n\nGerado pelo Phlox Clinical (phlox-clinical.com)`
    if (navigator.share) {
      await navigator.share({ title: 'Plano de Cuidado Phlox', text, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(text)
      alert('Copiado para a área de transferência')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <style>{PRINT_STYLE}</style>

      {/* Hero */}
      <div style={{ background: modeMeta.bg, borderBottom: '1px solid var(--border)', padding: '32px 0 0' }}>
        <div className="page-container">
          <div style={{ maxWidth: 700, marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: modeMeta.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 2, background: modeMeta.color, borderRadius: 1 }} />
              Phlox Care Plan · {modeMeta.label}
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.01em' }}>
              Plano de Cuidado Farmacológico
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 560 }}>
              {experienceMode === 'clinical'
                ? 'Síntese farmacológica completa para o profissional. Calendário optimizado, monitorização, interações e bandeiras vermelhas específicas para esta combinação.'
                : experienceMode === 'caregiver'
                ? 'O guia completo para cuidar com segurança. Horários, o que monitorizar, sinais de alerta e o que evitar — em linguagem simples para o dia-a-dia.'
                : experienceMode === 'student'
                ? 'Análise farmacológica completa com raciocínio clínico, mecanismos e farmacocinética relevante para esta combinação.'
                : 'O teu guia personalizado de medicação. O que tomar, quando, o que evitar e quando ir ao médico — específico para os teus medicamentos.'}
            </p>
          </div>

          {/* Input panel */}
          <div style={{ background: 'white', borderRadius: '10px 10px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '20px 20px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,300px),1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                {user && <div style={{ marginBottom: 10 }}><ProfileSelector onChange={handleProfile} /></div>}
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Medicamentos (um por linha) *
                </div>
                <textarea value={meds} onChange={e => setMeds(e.target.value)}
                  placeholder={'Ramipril 5mg 1x/dia\nMetformina 1000mg 2x/dia\nAtovastatina 20mg à noite\nAspirin 100mg de manhã'}
                  rows={5}
                  style={{ width: '100%', border: `1.5px solid ${modeMeta.color}40`, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', lineHeight: 1.7 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Nome</div>
                  <input value={patientName} onChange={e => setPatientName(e.target.value)}
                    placeholder="Ex: Manuel"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Idade</div>
                    <input type="number" value={age} onChange={e => setAge(e.target.value)}
                      placeholder="Ex: 68"
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  </div>
                  <div />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Diagnósticos / Condições</div>
                  <input value={conditions} onChange={e => setConditions(e.target.value)}
                    placeholder="Ex: HTA, DM2, IRC leve"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </div>

                {!canGenerate ? (
                  <div style={{ padding: '12px 14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', marginBottom: 4 }}>Disponível no plano Student</div>
                    <div style={{ fontSize: 12, color: '#7c3aed', opacity: 0.8, marginBottom: 8 }}>O Care Plan requer processamento AI avançado</div>
                    <Link href="/pricing" style={{ fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, border: '1px solid #e9d5ff', padding: '5px 12px', borderRadius: 5, display: 'inline-block' }}>
                      Ver planos →
                    </Link>
                  </div>
                ) : (
                  <button onClick={generate} disabled={!meds.trim() || loading}
                    style={{ padding: '13px', background: meds.trim() && !loading ? modeMeta.color : 'var(--bg-3)', color: meds.trim() && !loading ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: meds.trim() && !loading ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 'auto', transition: 'all 0.15s' }}>
                    {loading
                      ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A gerar plano de cuidado...</>
                      : '📋 Gerar plano de cuidado →'}
                  </button>
                )}
              </div>
            </div>
            {error && <div style={{ padding: '10px 14px', background: 'var(--red-light)', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
          </div>
        </div>
      </div>

      {/* Plan output */}
      <div className="page-container page-body">
        {loading && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '72px 24px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, border: `3px solid ${modeMeta.color}30`, borderTop: `3px solid ${modeMeta.color}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 20px' }} />
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>A construir o teu plano de cuidado...</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              A analisar medicamentos · a calcular horários óptimos · a identificar sinais de alerta
            </div>
          </div>
        )}

        {plan && !loading && (
          <div id="plan-output">
            {/* Plan header */}
            <div style={{ background: experienceMode === 'clinical' ? '#0f172a' : 'white', border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', padding: '20px 22px 16px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: experienceMode === 'clinical' ? '#475569' : 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Plano de Cuidado Farmacológico · {new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: experienceMode === 'clinical' ? '#f8fafc' : 'var(--ink)', fontWeight: 400, marginBottom: 4 }}>
                  {plan.generated_for}
                </div>
                <div style={{ fontSize: 13, color: experienceMode === 'clinical' ? '#64748b' : 'var(--ink-3)', lineHeight: 1.5 }}>{plan.profile_summary}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} className="no-print">
                <button onClick={handlePrint}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: modeMeta.color, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  🖨 Imprimir
                </button>
                <button onClick={handleShare}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  ↗ Partilhar
                </button>
              </div>
            </div>

            {/* 1. Medicamentos */}
            {plan.medications?.length > 0 && (
              <Section title="Os teus medicamentos" icon="💊" accent={modeMeta.color}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {plan.medications.map((med, i) => (
                    <div key={i} style={{ padding: '14px', background: 'var(--bg-2)', borderRadius: 8, borderLeft: `3px solid ${modeMeta.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>{med.name}</div>
                          {med.dci !== med.name && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>DCI: {med.dci}</div>}
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: med.with_food === 'sim' ? '#0d6e42' : med.with_food === 'não' ? '#dc2626' : 'var(--ink-4)', background: 'white', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4, flexShrink: 0, fontWeight: 700 }}>
                          {med.with_food === 'sim' ? '🍽 Com alimento' : med.with_food === 'não' ? '🚫 Em jejum' : med.with_food === 'preferencialmente' ? '🍽 Preferencialmente com alimento' : '⚪ Indiferente'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 6 }}>
                        {med.what_it_does}
                      </div>
                      <div style={{ fontSize: 12, color: modeMeta.color, fontFamily: 'var(--font-mono)', marginBottom: med.critical_note ? 6 : 0 }}>
                        ⏰ {med.when_to_take}
                      </div>
                      {med.critical_note && (
                        <div style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '6px 10px', marginTop: 6 }}>
                          ⚠️ {med.critical_note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 2. Calendário optimizado */}
            {plan.optimised_schedule?.length > 0 && (
              <Section title="Calendário de toma optimizado" icon="📅" accent={modeMeta.color}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                  {plan.optimised_schedule.map((slot, i) => (
                    <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: modeMeta.color, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>
                          {slot.time.toLowerCase().includes('manhã') || slot.time.includes('08') || slot.time.includes('07') ? '☀️'
                           : slot.time.toLowerCase().includes('almoço') || slot.time.includes('13') || slot.time.includes('12') ? '🌤'
                           : slot.time.toLowerCase().includes('jantar') || slot.time.includes('19') || slot.time.includes('18') ? '🌆'
                           : slot.time.toLowerCase().includes('deitar') || slot.time.includes('22') || slot.time.includes('21') ? '🌙'
                           : '⏰'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{slot.time}</span>
                      </div>
                      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {slot.meds.map((m, j) => (
                          <div key={j}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.name} <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 12 }}>{m.dose}</span></div>
                            {m.note && <div style={{ fontSize: 11, color: modeMeta.color, fontFamily: 'var(--font-mono)', marginTop: 1 }}>{m.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 3. Monitorização */}
            {plan.monitoring?.length > 0 && (
              <Section title="O que monitorizar" icon="🔬" accent={modeMeta.color}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.monitoring.map((m, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 7, alignItems: 'center' }} className="monitor-row">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{m.parameter}</div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: modeMeta.color, marginTop: 2 }}>Alvo: {m.target}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.frequency}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{m.why}</div>
                      <div style={{ fontSize: 11, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '6px 8px', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                        🚨 Se: {m.red_flag}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 4. Sinais de alerta */}
            {plan.red_flags?.length > 0 && (
              <Section title="Sinais de alerta — o que fazer" icon="🚨" accent="#dc2626">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.red_flags.map((flag, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: flag.severity === 'crítico' ? '#fee2e2' : flag.severity === 'importante' ? '#fef9c3' : '#eff6ff', border: `1px solid ${flag.severity === 'crítico' ? '#fca5a5' : flag.severity === 'importante' ? '#fde68a' : '#bfdbfe'}`, borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{flag.sign}</span>
                          <AlertBadge severity={flag.severity} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 5 }}>{flag.meaning}</div>
                        <ActionBadge action={flag.action} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 5. O que evitar */}
            {plan.avoid?.length > 0 && (
              <Section title="O que evitar com esta medicação" icon="🚫" accent="#b45309">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,280px),1fr))', gap: 8 }}>
                  {plan.avoid.map((item, i) => {
                    const catIcon = { alimento:'🍎', bebida:'🍺', actividade:'🏃', medicamento_otc:'💊', suplemento:'🌿' }[item.category] || '⚠️'
                    return (
                      <div key={i} style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16 }}>{catIcon}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#854d0e' }}>{item.item}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5, marginBottom: 4 }}>{item.reason}</div>
                        <div style={{ fontSize: 10, color: '#b45309', fontFamily: 'var(--font-mono)' }}>Aplica-se a: {item.applies_to}</div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* 6. Renovações */}
            {plan.renewals?.length > 0 && (
              <Section title="Quando renovar as receitas" icon="📋" accent="#0891b2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.renewals.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 7 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.medication}</span>
                        {r.note && <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 8 }}>{r.note}</span>}
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#0891b2', fontWeight: 700, flexShrink: 0, background: '#ecfeff', border: '1px solid #a5f3fc', padding: '3px 10px', borderRadius: 4 }}>
                        Renovar em {r.renew_in}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 7. Perguntas para o médico */}
            {plan.questions_for_doctor?.length > 0 && (
              <Section title="Perguntas para a próxima consulta" icon="💬" accent="#7c3aed">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.questions_for_doctor.map((q, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 7 }}>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.6 }}>{q}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 8. Student insights */}
            {plan.student_insights && experienceMode === 'student' && (
              <Section title="Insights farmacológicos — modo estudo" icon="🎓" accent="#7c3aed">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['Mecanismos de acção', plan.student_insights.mechanisms], ['Farmacocinética relevante', plan.student_insights.pharmacokinetics], ['Raciocínio clínico', plan.student_insights.clinical_reasoning]].map(([label, text]) => (
                    <div key={label} style={{ padding: '12px 14px', background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.7 }}>{text}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Disclaimer */}
            <div style={{ padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 8, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              ⚠️ {plan.disclaimer}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 640px) { .monitor-row { grid-template-columns: 1fr !important } }
      `}</style>
    </div>
  )
}