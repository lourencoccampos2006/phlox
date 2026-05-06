'use client'

// ─── NOVO: app/calendario-meds/page.tsx ───
// Calendário visual de medicamentos para um perfil.
// Gratuito. Para cuidadores e pessoal.

import { useState } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'

interface Med {
  name: string
  dose: string
  schedule: ('manha' | 'almoco' | 'jantar' | 'deitar')[]
  withFood: boolean
  notes: string
}

const SLOTS = [
  { id: 'manha', label: 'Manhã', icon: '☀️', time: '08:00' },
  { id: 'almoco', label: 'Almoço', icon: '🌤', time: '13:00' },
  { id: 'jantar', label: 'Jantar', icon: '🌆', time: '19:00' },
  { id: 'deitar', label: 'Deitar', icon: '🌙', time: '22:00' },
] as const

type Slot = typeof SLOTS[number]['id']

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarioMedsPage() {
  const { user } = useAuth()
  const [meds, setMeds] = useState<Med[]>([])
  const [newMed, setNewMed] = useState<Med>({ name: '', dose: '', schedule: [], withFood: false, notes: '' })
  const [adding, setAdding] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [printed, setPrinted] = useState(false)

  const toggleSlot = (slot: Slot) => {
    setNewMed(p => ({
      ...p,
      schedule: p.schedule.includes(slot)
        ? p.schedule.filter(s => s !== slot)
        : [...p.schedule, slot]
    }))
  }

  const addMed = () => {
    if (!newMed.name.trim() || newMed.schedule.length === 0) return
    setMeds(p => [...p, { ...newMed }])
    setNewMed({ name: '', dose: '', schedule: [], withFood: false, notes: '' })
    setAdding(false)
  }

  const removeMed = (i: number) => setMeds(p => p.filter((_, idx) => idx !== i))

  const medsAtSlot = (slot: Slot) => meds.filter(m => m.schedule.includes(slot))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">
        {/* Título */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: '#b45309', borderRadius: 1 }} />
            Calendário de Medicamentos
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8 }}>
            Calendário semanal de toma
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 560 }}>
            Cria um calendário visual com todos os medicamentos e horários. Imprime e entrega ao familiar ou ao doente.
          </p>
        </div>

        {/* Nome do doente/familiar */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', flexShrink: 0 }}>Para:</span>
          <input value={patientName} onChange={e => setPatientName(e.target.value)}
            placeholder="Nome do familiar ou doente"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--ink)' }} />
        </div>

        {/* Adicionar medicamento */}
        {adding ? (
          <div style={{ background: 'white', border: '2px solid #b45309', borderRadius: 10, padding: '18px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#b45309', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Novo medicamento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <input value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do medicamento *" autoFocus
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', gridColumn: '1 / -1' }} />
              <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                placeholder="Dose (ex: 500mg)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <input value={newMed.notes} onChange={e => setNewMed(p => ({ ...p, notes: e.target.value }))}
                placeholder="Notas (ex: com muita água)"
                style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Horários *</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SLOTS.map(slot => (
                  <button key={slot.id} onClick={() => toggleSlot(slot.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1.5px solid ${newMed.schedule.includes(slot.id) ? '#b45309' : 'var(--border)'}`, borderRadius: 8, background: newMed.schedule.includes(slot.id) ? '#fffbeb' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: newMed.schedule.includes(slot.id) ? 700 : 400, color: newMed.schedule.includes(slot.id) ? '#b45309' : 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                    <span>{slot.icon}</span> {slot.label}
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{slot.time}</span>
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={newMed.withFood} onChange={e => setNewMed(p => ({ ...p, withFood: e.target.checked }))} />
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Tomar com alimento</span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addMed} disabled={!newMed.name.trim() || newMed.schedule.length === 0}
                style={{ background: '#b45309', color: 'white', border: 'none', borderRadius: 7, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: (newMed.name.trim() && newMed.schedule.length > 0) ? 1 : 0.5 }}>
                Adicionar
              </button>
              <button onClick={() => setAdding(false)}
                style={{ background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', background: 'white', border: '1.5px dashed var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', width: '100%', marginBottom: 14, transition: 'all 0.15s' }}
            className="add-med-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar medicamento
          </button>
        )}

        {/* Calendário visual */}
        {meds.length > 0 && (
          <>
            <div id="calendar-print" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {/* Header do calendário */}
              <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Calendário de medicamentos</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{patientName || 'Sem nome'}</div>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569' }}>
                  {new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Grade por slot */}
              {SLOTS.map(slot => {
                const slotMeds = medsAtSlot(slot.id)
                if (slotMeds.length === 0) return null
                return (
                  <div key={slot.id} style={{ borderBottom: '1px solid var(--bg-3)' }}>
                    {/* Slot header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 16 }}>{slot.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{slot.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{slot.time}</span>
                    </div>
                    {/* Medicamentos neste slot */}
                    {slotMeds.map((med, mi) => (
                      <div key={mi} style={{ display: 'flex', padding: '10px 20px', borderBottom: mi < slotMeds.length - 1 ? '1px solid var(--bg-3)' : 'none', gap: 32, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                            {med.name} {med.dose && <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>{med.dose}</span>}
                          </div>
                          {med.withFood && <div style={{ fontSize: 11, color: '#b45309', fontFamily: 'var(--font-mono)' }}>🍽 Tomar com alimento</div>}
                          {med.notes && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{med.notes}</div>}
                        </div>
                        {/* Checkboxes para cada dia */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: 6, flexShrink: 0 }}>
                          {DAYS.map(d => (
                            <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase' }}>{d}</div>
                              <div style={{ width: 18, height: 18, border: '1.5px solid var(--border)', borderRadius: 3, background: 'white' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Footer */}
              <div style={{ padding: '12px 20px', background: 'var(--bg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  {meds.length} medicamento{meds.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>phlox-clinical.com</div>
              </div>
            </div>

            {/* Lista de medicamentos com botão remover */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Medicamentos adicionados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {meds.map((med, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{med.name}</span>
                      {med.dose && <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 6 }}>{med.dose}</span>}
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {med.schedule.map(s => SLOTS.find(sl => sl.id === s)?.label).join(' · ')}
                      </div>
                    </div>
                    <button onClick={() => removeMed(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', padding: 6, borderRadius: 4 }}
                      className="remove-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Imprimir */}
            <button onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir calendário
            </button>
          </>
        )}
      </div>

      <style>{`
        .add-med-btn:hover { border-color: #b45309 !important; color: #b45309 !important; }
        .remove-btn:hover { color: var(--red) !important; background: var(--red-light) !important; }
        @media print {
          header, .page-container > *:not(#calendar-print) { display: none !important; }
          #calendar-print { border: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}