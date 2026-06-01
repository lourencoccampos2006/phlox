'use client'

// /clinico360 — Hub clínico premium para o plano Pro/Clinic.
//   1. Workflow Pulse — KPIs do turno em tempo real
//   2. Risk Forecast — ordena doentes por risco farmacoterapêutico (STOPP/Beers)
//   3. Antibiotic Stewardship — top consumo + flags de sobreuso
//   4. Quality Benchmark — comparar com agregado anonimizado (mock dataset)
//   5. Audit Trail — últimas intervenções com filtragem

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { rankPatientsByRisk, workflowPulse, abxConsumption } from '@/lib/clinicalIntel'

type Tab = 'pulse' | 'risk' | 'abx' | 'bench' | 'audit'

// Benchmarks publicados (Norma DGS, INFARMED, Surviving Sepsis 2021, etc.)
const QUALITY_BENCHMARKS = [
  { id: 'mar_on_time', label: 'Administração on-time', target: 92, unit: '%', source: 'ISMP best practice 2022' },
  { id: 'mar_omissions', label: 'Omissões MAR', target: 2, unit: '%', source: 'NHS Safer Care 2020', invert: true },
  { id: 'intervention_per_patient', label: 'Intervenções farma. / 100 doentes-dia', target: 8, unit: '', source: 'ECP 2021' },
  { id: 'abx_de_escalation', label: 'De-escalation antibiótico ≤ 72h', target: 70, unit: '%', source: 'Surviving Sepsis 2021' },
  { id: 'falls_per_1000', label: 'Quedas / 1000 doentes-dia', target: 3.5, unit: '', source: 'AHRQ 2023', invert: true },
]

export default function Clinico360() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('pulse')
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan === 'pro' || plan === 'clinic'

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28 }}>Clínico 360°</h1>
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, marginBottom: 24 }}>
          Workflow pulse, ranking de risco, stewardship, benchmark e audit trail num só painel. Disponível nos planos Pro e Clinic.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Clínico · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Clínico 360°</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Pulse do turno, ranking de risco, stewardship, benchmark e audit.</p>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 16, overflowX: 'auto' }}>
          {([
            ['pulse', '📡 Workflow Pulse'],
            ['risk',  '🎯 Risk Forecast'],
            ['abx',   '💉 Stewardship'],
            ['bench', '📊 Benchmark'],
            ['audit', '📜 Audit Trail'],
          ] as [Tab, string][]).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '10px 14px', background: tab === id ? '#eff6ff' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#1d4ed8' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#1d4ed8' : '#475569', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{l}</button>
          ))}
        </div>

        {tab === 'pulse' && <PulseTab />}
        {tab === 'risk' && <RiskTab />}
        {tab === 'abx' && <AbxTab />}
        {tab === 'bench' && <BenchTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  )
}

// ─── Pulse ─────────────────────────────────────────────────────────────────
function PulseTab() {
  const { user, supabase } = useAuth()
  const [pulse, setPulse] = useState<any>(null)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const { data } = await supabase.from('mar_records').select('*').gte('scheduled_at', today.toISOString()).limit(500)
      setPulse(workflowPulse((data || []).map((r: any) => ({
        patient_id: r.patient_id, med_id: r.med_id,
        scheduled_at: r.scheduled_at, administered_at: r.administered_at, status: r.status,
      })), { lateThresholdMin: 30 }))
    })()
  }, [user?.id])
  if (!pulse) return <Empty msg="A obter dados do turno actual…" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
      <Stat label="Doses agendadas" v={pulse.mar_total} />
      <Stat label="Administradas" v={pulse.mar_given} color="#0d6e42" />
      <Stat label="Tardias (> 30 min)" v={pulse.mar_late} color="#d97706" />
      <Stat label="Omissões" v={pulse.mar_missed} color="#dc2626" />
      <Stat label="Conclusão" v={`${pulse.mar_completion_pct}%`} color="#1d4ed8" />
      <Stat label="On-time" v={`${pulse.on_time_pct}%`} color={pulse.on_time_pct >= 90 ? '#0d6e42' : pulse.on_time_pct >= 75 ? '#d97706' : '#dc2626'} />
    </div>
  )
}

// ─── Risk Forecast ───────────────────────────────────────────────────────────
function RiskTab() {
  const { user, supabase } = useAuth()
  const [ranked, setRanked] = useState<any[]>([])
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: ps } = await supabase.from('patients').select('id,name,age,meds,conditions,last_intervention_at').limit(150)
      const r = rankPatientsByRisk((ps || []) as any[])
      setRanked(r)
    })()
  }, [user?.id])
  if (!ranked.length) return <Empty msg="Sem doentes carregados ou nenhum tem medicação registada." />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ranked.slice(0, 30).map((r, i) => {
        const c = r.score >= 60 ? '#dc2626' : r.score >= 30 ? '#d97706' : '#0d6e42'
        return (
          <Link key={r.patient_id} href={`/patients/${r.patient_id}`} style={{ display: 'block', background: 'white', border: `1px solid ${c}30`, borderLeft: `4px solid ${c}`, borderRadius: 8, padding: '10px 12px', textDecoration: 'none', color: '#0b1120' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8' }}>#{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 700, marginLeft: 8 }}>{r.patient_name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{r.polypharmacy} fármacos</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{r.score}</div>
            </div>
            {r.flags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                {r.flags.map((f: string, j: number) => <span key={j} style={{ fontSize: 11, color: c, background: c + '14', border: `1px solid ${c}40`, borderRadius: 999, padding: '2px 8px' }}>{f}</span>)}
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Abx Stewardship ────────────────────────────────────────────────────────
function AbxTab() {
  const { user, supabase } = useAuth()
  const [abx, setAbx] = useState<any>(null)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      // Heurística: prescrições com nome a parecer antibiótico
      const { data } = await supabase.from('patients').select('meds').limit(500)
      const list: { med_name: string; days: number }[] = []
      ;(data || []).forEach((p: any) => {
        (p.meds || []).forEach((m: any) => {
          const n = (m.name || '').toLowerCase()
          if (/cilina|amoxic|cefuro|cefalo|ceftri|cefta|ceftaz|ciproflo|levoflo|moxiflo|azitr|claritr|metronid|vancomic|meropenem|imipenem|piperac|gentamic|amicacin/.test(n)) {
            list.push({ med_name: n, days: 7 })
          }
        })
      })
      setAbx(abxConsumption(list))
    })()
  }, [user?.id])
  if (!abx) return <Empty msg="A analisar consumo de antibióticos…" />
  return (
    <div>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Top consumo (dias-tratamento estimados)</div>
        {abx.top.length === 0 ? <div style={{ fontSize: 12, color: '#94a3b8' }}>Sem dados de antibióticos.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {abx.top.map((t: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#0b1120', textTransform: 'capitalize' }}>{t.med}</span>
                <div style={{ flex: 2, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                  <div style={{ width: `${t.pct}%`, height: '100%', background: '#1d4ed8', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>{t.days} d · {t.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {abx.flags.map((f: string, i: number) => (
        <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>{f}</div>
      ))}
    </div>
  )
}

// ─── Quality Benchmark ──────────────────────────────────────────────────────
function BenchTab() {
  // Não há um agregado nacional verificado; deixamos os benchmarks publicados
  // como referência e o utilizador insere o seu valor para comparar.
  const [my, setMy] = useState<Record<string, number>>({})
  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 12 }}>
        Indica o teu valor (último mês) para comparar com targets publicados. Sem dados a sair daqui — comparação local.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {QUALITY_BENCHMARKS.map(b => {
          const v = my[b.id]
          const ok = v == null ? null : (b.invert ? v <= b.target : v >= b.target)
          const c = ok === null ? '#94a3b8' : ok ? '#0d6e42' : '#dc2626'
          return (
            <div key={b.id} style={{ background: 'white', border: `1px solid ${c}30`, borderLeft: `3px solid ${c}`, borderRadius: 8, padding: '10px 12px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0b1120' }}>{b.label}</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{b.source}</div>
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>Target {b.invert ? '≤' : '≥'} <strong>{b.target}{b.unit}</strong></div>
              <input type="number" step={0.1} value={v ?? ''} onChange={e => setMy(p => ({ ...p, [b.id]: Number(e.target.value) }))}
                placeholder="seu valor"
                style={{ width: 80, border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '5px 8px', fontSize: 12.5, fontFamily: 'var(--font-mono)' }} />
              <div style={{ fontSize: 12, fontWeight: 800, color: c, textAlign: 'right' }}>
                {ok === null ? '—' : ok ? '✓ Atinge' : '✗ Abaixo'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Audit Trail ────────────────────────────────────────────────────────────
function AuditTab() {
  const { user, supabase } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      // Reaproveita tabelas existentes — rounds_interventions
      const { data } = await supabase.from('rounds_interventions').select('*').order('created_at', { ascending: false }).limit(80)
      setLogs(data || [])
    })()
  }, [user?.id])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return logs
    return logs.filter(l => JSON.stringify(l).toLowerCase().includes(t))
  }, [logs, q])

  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar (medicamento, doente, intervenção…)"
        style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', background: 'white' }} />
      {filtered.length === 0 ? <Empty msg="Sem intervenções registadas." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(l => (
            <div key={l.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong style={{ color: '#0b1120' }}>{l.intervention_type || l.category || '—'}</strong> · {l.description || l.notes || ''}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontSize: 11 }}>{new Date(l.created_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, v, color }: { label: string; v: number | string; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || '#0b1120', marginTop: 4 }}>{v}</div>
    </div>
  )
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{msg}</div>
}
