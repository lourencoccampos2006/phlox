'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

interface Patient { id: string; name: string; room_number?: string | null; age?: number | null; height?: number | null; active?: boolean }
interface CareRec { patient_id: string; date: string; vitals: { weight?: number | null } | null }
interface WeightPoint { date: string; weight: number }

const today = () => new Date().toISOString().slice(0, 10)

// Variação % de peso clinicamente relevante (sinal de desnutrição)
function lossFlag(series: WeightPoint[]): { level: 'high' | 'med' | null; label: string } {
  if (series.length < 2) return { level: null, label: '' }
  const last = series[series.length - 1]
  const lastTime = new Date(last.date).getTime()
  const pctOver = (days: number) => {
    const ref = [...series].reverse().find(p => (lastTime - new Date(p.date).getTime()) >= days * 86400000)
    if (!ref || ref.weight === 0) return null
    return ((ref.weight - last.weight) / ref.weight) * 100 // positivo = perdeu peso
  }
  const d30 = pctOver(25), d90 = pctOver(80), d180 = pctOver(170)
  if ((d30 ?? 0) >= 5 || (d90 ?? 0) >= 7.5 || (d180 ?? 0) >= 10) return { level: 'high', label: 'Perda significativa' }
  if ((d30 ?? 0) >= 2 || (d90 ?? 0) >= 5) return { level: 'med', label: 'A vigiar' }
  return { level: null, label: 'Estável' }
}

function Sparkline({ series, color }: { series: WeightPoint[]; color: string }) {
  if (series.length < 2) return null
  const ws = series.map(s => s.weight)
  const min = Math.min(...ws), max = Math.max(...ws), range = max - min || 1
  const w = 120, h = 32
  const pts = series.map((s, i) => `${(i / (series.length - 1)) * w},${h - ((s.weight - min) / range) * (h - 4) - 2}`).join(' ')
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export default function NutricaoPage() {
  const { user, supabase } = useAuth() as any
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [care, setCare] = useState<CareRec[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const [p, c] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id).order('name'),
      supabase.from('care_records').select('patient_id,date,vitals').eq('user_id', user.id).gte('date', since),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    setCare(c.data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['care_records', 'patients'], userId: user?.id, onChange: load })

  function seriesFor(pid: string): WeightPoint[] {
    return care.filter(c => c.patient_id === pid && c.vitals?.weight)
      .map(c => ({ date: c.date, weight: Number(c.vitals!.weight) }))
      .filter(p => p.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const rows = patients.map(p => {
    const s = seriesFor(p.id)
    const flag = lossFlag(s)
    const latest = s.length ? s[s.length - 1].weight : null
    const bmi = latest && p.height ? +(latest / Math.pow(p.height / 100, 2)).toFixed(1) : null
    return { p, series: s, flag, latest, bmi }
  })
  const order = { high: 0, med: 1, null: 2 } as Record<string, number>
  rows.sort((a, b) => (order[String(a.flag.level)] - order[String(b.flag.level)]) || a.p.name.localeCompare(b.p.name))

  const atRisk = rows.filter(r => r.flag.level === 'high').length
  const watch = rows.filter(r => r.flag.level === 'med').length
  const noData = rows.filter(r => r.series.length === 0).length
  const lowBmi = rows.filter(r => r.bmi != null && r.bmi < 21).length // idosos: <21 = risco

  const sel = selected ? rows.find(r => r.p.id === selected) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Clínico · Nutrição</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Peso & Nutrição</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Tendência de peso e alertas de desnutrição — a partir dos registos diários.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { n: atRisk, l: 'Perda significativa', c: '#dc2626', bg: '#fef2f2', bd: '#fca5a5' },
            { n: watch, l: 'A vigiar', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
            { n: lowBmi, l: 'IMC baixo (<21)', c: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
            { n: noData, l: 'Sem dados de peso', c: '#64748b', bg: 'white', bd: 'var(--border)' },
          ].map(s => (
            <div key={s.l} style={{ flex: '1 1 130px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(({ p, series, flag, latest, bmi }) => {
              const fc = flag.level === 'high' ? '#dc2626' : flag.level === 'med' ? '#d97706' : '#16a34a'
              const open = selected === p.id
              return (
                <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${flag.level ? fc : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setSelected(open ? null : p.id)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name} {p.room_number && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>Q{p.room_number}</span>}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>
                        {latest != null ? `${latest} kg` : 'sem peso registado'}{bmi != null ? ` · IMC ${bmi}` : ''}{series.length ? ` · ${series.length} registos` : ''}
                      </div>
                    </div>
                    <Sparkline series={series} color={fc} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: fc, flexShrink: 0 }}>{series.length < 2 ? '—' : flag.label}</span>
                  </div>
                  {open && series.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--bg-3)', padding: '12px 16px', background: 'var(--bg-2)' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {series.slice(-12).map((pt, i) => (
                          <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{pt.weight}</div>
                            <div style={{ fontSize: 9, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{new Date(pt.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' })}</div>
                          </div>
                        ))}
                      </div>
                      <Link href="/care-log" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Registar novo peso →</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
