'use client'

// PosologyEditor — editor estruturado de posologia.
// Em vez de "1 cp ao pequeno-almoço" como texto livre, guarda:
//   { dose_amount, dose_unit, frequency_per_day, schedule_times[],
//     duration_days, prn, prn_indication, route, with_food, notes }
//
// 2026-06-02.

import { useState, useEffect } from 'react'

export interface Posology {
  dose_amount?: number
  dose_unit?: string
  frequency_per_day?: number
  schedule_times?: string[]
  duration_days?: number | null
  prn?: boolean
  prn_indication?: string | null
  route?: string
  with_food?: boolean | null
  notes?: string
}

const UNITS = ['cp', 'mg', 'mcg', 'g', 'mL', 'UI', 'gtt', 'amp', 'puff', 'mL/h']
const ROUTES: { id: string; label: string }[] = [
  { id: 'oral', label: 'Oral (boca)' },
  { id: 'sc',   label: 'Subcutânea' },
  { id: 'im',   label: 'Intramuscular' },
  { id: 'iv',   label: 'Intravenosa' },
  { id: 'inh',  label: 'Inalada' },
  { id: 'top',  label: 'Tópica (pele)' },
  { id: 'rct',  label: 'Rectal' },
  { id: 'nas',  label: 'Nasal' },
  { id: 'sl',   label: 'Sublingual' },
  { id: 'tt',   label: 'Transdérmica (penso)' },
]
const PRESETS: { label: string; freq: number; times: string[] }[] = [
  { label: '1×/dia ao p.almoço',          freq: 1, times: ['08:00'] },
  { label: '1×/dia ao deitar',            freq: 1, times: ['22:00'] },
  { label: '2×/dia (almoço + jantar)',    freq: 2, times: ['13:00','20:00'] },
  { label: '3×/dia (refeições)',          freq: 3, times: ['08:00','13:00','20:00'] },
  { label: '8h/8h',                       freq: 3, times: ['08:00','16:00','00:00'] },
  { label: '12h/12h',                     freq: 2, times: ['08:00','20:00'] },
]

export function renderPosology(p: Posology | null | undefined): string {
  if (!p) return ''
  const parts: string[] = []
  if (p.dose_amount != null) parts.push(`${p.dose_amount}${p.dose_unit ? ' ' + p.dose_unit : ''}`)
  if (p.frequency_per_day) parts.push(`${p.frequency_per_day}×/dia`)
  if (p.schedule_times && p.schedule_times.length > 0) parts.push(`(${p.schedule_times.join(', ')})`)
  if (p.route) parts.push(ROUTES.find(r => r.id === p.route)?.label.split(' ')[0] || p.route)
  if (p.duration_days) parts.push(`durante ${p.duration_days} dias`)
  if (p.prn) parts.push('SOS')
  if (p.with_food === true) parts.push('com comida')
  if (p.with_food === false) parts.push('em jejum')
  return parts.join(' · ')
}

export default function PosologyEditor({ value, onChange }: { value: Posology; onChange: (v: Posology) => void }) {
  const v = value || {}
  const set = (patch: Partial<Posology>) => onChange({ ...v, ...patch })

  // Quando o utilizador escolhe frequency, ajusta auto schedule_times com defaults
  useEffect(() => {
    const f = v.frequency_per_day
    if (!f) return
    if (!v.schedule_times || v.schedule_times.length !== f) {
      const preset = PRESETS.find(p => p.freq === f)
      if (preset) set({ schedule_times: [...preset.times] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.frequency_per_day])

  return (
    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      {/* Dose */}
      <Label>Dose</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 6 }}>
        <input type="number" step="0.5" value={v.dose_amount ?? ''}
          onChange={e => set({ dose_amount: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="ex: 1" style={inp} />
        <select value={v.dose_unit || 'cp'} onChange={e => set({ dose_unit: e.target.value })} style={inp}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {/* Frequência + presets */}
      <Label>Frequência</Label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => set({ frequency_per_day: p.freq, schedule_times: [...p.times] })}
            style={{ padding: '5px 10px', borderRadius: 16, border: `1.5px solid ${v.frequency_per_day === p.freq ? '#0d6e42' : 'var(--border)'}`, background: v.frequency_per_day === p.freq ? '#f0fdf4' : 'white', color: v.frequency_per_day === p.freq ? '#0d6e42' : 'var(--ink-3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Horários */}
      {(v.frequency_per_day || 0) > 0 && (
        <>
          <Label>Horas</Label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(v.schedule_times || []).map((t, i) => (
              <input key={i} type="time" value={t}
                onChange={e => {
                  const next = [...(v.schedule_times || [])]
                  next[i] = e.target.value
                  set({ schedule_times: next })
                }}
                style={{ ...inp, width: 110 }} />
            ))}
          </div>
        </>
      )}

      {/* Via */}
      <Label>Via de administração</Label>
      <select value={v.route || 'oral'} onChange={e => set({ route: e.target.value })} style={inp}>
        {ROUTES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>

      {/* Duração */}
      <Label>Duração</Label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => set({ duration_days: null })}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${v.duration_days == null ? '#0d6e42' : 'var(--border)'}`, background: v.duration_days == null ? '#f0fdf4' : 'white', color: v.duration_days == null ? '#0d6e42' : 'var(--ink-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Crónica / contínua
        </button>
        <input type="number" min={1} value={v.duration_days ?? ''} onChange={e => set({ duration_days: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="dias" style={{ ...inp, width: 90 }} />
      </div>

      {/* SOS */}
      <div style={{ marginTop: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!v.prn} onChange={e => set({ prn: e.target.checked })} />
          Em SOS (só quando necessário)
        </label>
        {v.prn && (
          <input value={v.prn_indication || ''} onChange={e => set({ prn_indication: e.target.value })}
            placeholder="ex: para dor de cabeça" style={{ ...inp, marginTop: 6 }} />
        )}
      </div>

      {/* Refeição */}
      <Label>Em relação à comida</Label>
      <div style={{ display: 'flex', gap: 4 }}>
        {([['indiferente', null], ['com', true], ['em jejum', false]] as const).map(([lbl, val]) => (
          <button key={lbl} onClick={() => set({ with_food: val as any })}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 7, border: `1.5px solid ${v.with_food === val ? '#0d6e42' : 'var(--border)'}`, background: v.with_food === val ? '#f0fdf4' : 'white', color: v.with_food === val ? '#0d6e42' : 'var(--ink-3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{lbl}</button>
        ))}
      </div>

      {/* Preview */}
      <div style={{ marginTop: 12, padding: '9px 11px', background: 'white', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: 12.5, color: '#0d6e42', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
        {renderPosology(v) || 'sem informação suficiente'}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginTop: 10, marginBottom: 5 }}>{children}</div>
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }
