'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

interface Patient { id: string; name: string; room_number?: string | null; active?: boolean }
interface Log { id: string; patient_id: string; at: string; kind: 'fluid' | 'bowel' | 'urine'; fluid_ml?: number | null; bristol?: number | null; urine?: string | null; notes?: string | null }

const FLUID_GOAL = 1500 // ml/dia (meta de referência para idosos)
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function HidratacaoPage() {
  const { user, supabase } = useAuth() as any
  const [patients, setPatients] = useState<Patient[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [search, setSearch] = useState('')
  const [bowelFor, setBowelFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const [p, l] = await Promise.all([
      supabase.from('patients').select('id,name,room_number,active').eq('user_id', user.id).order('name'),
      supabase.from('hydration_logs').select('*').eq('user_id', user.id).gte('at', since).order('at', { ascending: false }),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    if (l.error) { setTableMissing(true); setLogs([]) }
    else { setTableMissing(false); setLogs(l.data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['hydration_logs', 'patients'], userId: user?.id, onChange: load })

  const today = todayStr()
  function fluidToday(pid: string) { return logs.filter(l => l.patient_id === pid && l.kind === 'fluid' && l.at.slice(0, 10) === today).reduce((s, l) => s + (l.fluid_ml || 0), 0) }
  function lastBowel(pid: string): { date: string | null; days: number | null } {
    const b = logs.filter(l => l.patient_id === pid && l.kind === 'bowel').sort((a, c) => c.at.localeCompare(a.at))[0]
    if (!b) return { date: null, days: null }
    const days = Math.floor((Date.now() - new Date(b.at).getTime()) / 86400000)
    return { date: b.at, days }
  }

  async function addFluid(pid: string, ml: number) {
    if (!user) return
    await supabase.from('hydration_logs').insert({ user_id: user.id, patient_id: pid, kind: 'fluid', fluid_ml: ml })
    load()
  }
  async function addBowel(pid: string, bristol: number) {
    if (!user) return
    setSaving(true)
    await supabase.from('hydration_logs').insert({ user_id: user.id, patient_id: pid, kind: 'bowel', bristol })
    setSaving(false); setBowelFor(null); load()
  }

  const rows = patients.map(p => {
    const fluid = fluidToday(p.id)
    const lb = lastBowel(p.id)
    const dehydration = fluid < 1000 // alerta se < 1000ml até agora
    const constipation = lb.days != null && lb.days >= 3
    return { p, fluid, lb, dehydration, constipation, alert: constipation || (lb.days === null) }
  })
  const filtered = rows.filter(r => !search || r.p.name.toLowerCase().includes(search.toLowerCase()))
  filtered.sort((a, b) => Number(b.constipation) - Number(a.constipation) || a.fluid - b.fluid || a.p.name.localeCompare(b.p.name))

  const stats = {
    lowFluid: rows.filter(r => r.fluid < 1000).length,
    constip: rows.filter(r => r.constipation).length,
    noBowelData: rows.filter(r => r.lb.days === null).length,
  }

  const BRISTOL = [1, 2, 3, 4, 5, 6, 7]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Clínico · Hidratação & Eliminação</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Hidratação & Eliminação</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Balanço hídrico do dia e controlo de dejeções, com alertas de desidratação e obstipação.</p>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Base de dados por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint20_hydration.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { n: stats.lowFluid, l: 'Ingestão baixa hoje', c: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe' },
                { n: stats.constip, l: 'Sem dejeção ≥3 dias', c: '#dc2626', bg: '#fef2f2', bd: '#fca5a5' },
                { n: stats.noBowelData, l: 'Sem registo de dejeção', c: '#64748b', bg: 'white', bd: 'var(--border)' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 140px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar residente..." style={{ width: '100%', maxWidth: 280, marginBottom: 14, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />)}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(({ p, fluid, lb, constipation }) => {
                  const pct = Math.min(100, Math.round((fluid / FLUID_GOAL) * 100))
                  const fluidColor = fluid >= FLUID_GOAL ? '#16a34a' : fluid >= 1000 ? '#2563eb' : '#d97706'
                  return (
                    <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${constipation ? '#dc2626' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name} {p.room_number && <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 400 }}>Q{p.room_number}</span>}</div>
                          <div style={{ fontSize: 12, color: constipation ? '#dc2626' : 'var(--ink-4)', marginTop: 2, fontWeight: constipation ? 700 : 400 }}>
                            {lb.days === null ? 'Sem registo de dejeção' : lb.days === 0 ? 'Dejeção hoje' : `Última dejeção há ${lb.days} dia${lb.days !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                        {/* Fluid progress */}
                        <div style={{ minWidth: 150, flex: '0 1 180px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>hidratação hoje</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: fluidColor }}>{fluid} / {FLUID_GOAL} ml</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: fluidColor, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        {/* Quick actions */}
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          {[150, 250].map(ml => (
                            <button key={ml} onClick={() => addFluid(p.id, ml)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+{ml}ml</button>
                          ))}
                          <button onClick={() => setBowelFor(bowelFor === p.id ? null : p.id)} style={{ padding: '7px 11px', borderRadius: 8, border: `1px solid ${bowelFor === p.id ? '#0d6e42' : 'var(--border)'}`, background: bowelFor === p.id ? '#eef6f1' : 'white', color: bowelFor === p.id ? '#0d6e42' : 'var(--ink-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Dejeção</button>
                        </div>
                      </div>
                      {bowelFor === p.id && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bg-3)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Escala de Bristol — tipo de fezes</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {BRISTOL.map(b => (
                              <button key={b} onClick={() => addBowel(p.id, b)} disabled={saving} style={{ width: 38, height: 38, borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: b <= 2 ? '#d97706' : b >= 6 ? '#dc2626' : '#16a34a', fontFamily: 'var(--font-mono)' }}>{b}</button>
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--ink-5)', marginTop: 6 }}>1-2 obstipação · 3-5 normal · 6-7 diarreia</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
