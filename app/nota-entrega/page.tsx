'use client'

// ─── NOVO: app/nota-entrega/page.tsx ───
// Nota de Entrega de Medicação — para o cuidador dar ao familiar/doente.
// Gera um documento imprimível simples e claro com horários e instruções.

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'

interface MedEntry {
  name: string
  dose: string
  morning: boolean
  lunch: boolean
  dinner: boolean
  bedtime: boolean
  withFood: boolean
  special: string
}

export default function NotaEntregaPage() {
  const { user, supabase } = useAuth()
  const [patientName, setPatientName] = useState('')
  const [period, setPeriod] = useState('')
  const [notes, setNotes] = useState('')
  const [caretakerName, setCaretakerName] = useState('')
  const [meds, setMeds] = useState<MedEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newMed, setNewMed] = useState<MedEntry>({ name: '', dose: '', morning: false, lunch: false, dinner: false, bedtime: false, withFood: false, special: '' })

  // Pré-preencher com dados do utilizador
  useEffect(() => {
    if (user) setCaretakerName(user.name || '')
    const p = getActiveProfile()
    if (p?.type === 'family') setPatientName(p.name)
  }, [user])

  // Carregar meds do perfil activo automaticamente
  const handleProfileChange = async (p: any) => {
    if (p.type === 'family' && p.id !== 'self') {
      setPatientName(p.name)
      setLoading(true)
      const { data } = await supabase
        .from('family_profile_meds')
        .select('name, dose, frequency')
        .eq('profile_id', p.id)
      if (data && data.length > 0) {
        const loaded = data.map((m: any) => ({
          name: m.name, dose: m.dose || '', withFood: false, special: '',
          morning: (m.frequency || '').toLowerCase().includes('manhã') || (m.frequency || '').includes('24h') || (m.frequency || '').includes('12h'),
          lunch: (m.frequency || '').toLowerCase().includes('12h') || (m.frequency || '').toLowerCase().includes('almoço'),
          dinner: (m.frequency || '').toLowerCase().includes('jantar') || (m.frequency || '').includes('8h'),
          bedtime: (m.frequency || '').toLowerCase().includes('deit') || (m.frequency || '').toLowerCase().includes('noite'),
        }))
        setMeds(loaded)
      }
      setLoading(false)
    } else if (p.id === 'self' && user) {
      setPatientName(user.name)
      setLoading(true)
      const { data } = await supabase
        .from('personal_meds')
        .select('name, dose, frequency')
        .eq('user_id', user.id)
      if (data && data.length > 0) {
        setMeds(data.map((m: any) => ({
          name: m.name, dose: m.dose || '', withFood: false, special: '',
          morning: true, lunch: false, dinner: false, bedtime: false,
        })))
      }
      setLoading(false)
    }
  }

  const addMed = () => {
    if (!newMed.name.trim()) return
    setMeds(p => [...p, { ...newMed }])
    setNewMed({ name: '', dose: '', morning: false, lunch: false, dinner: false, bedtime: false, withFood: false, special: '' })
    setAdding(false)
  }

  const toggleSlot = (slot: keyof Pick<MedEntry, 'morning' | 'lunch' | 'dinner' | 'bedtime'>) =>
    setNewMed(p => ({ ...p, [slot]: !p[slot] }))

  const SLOTS: { key: keyof MedEntry; label: string; icon: string; time: string }[] = [
    { key: 'morning', label: 'Manhã', icon: '☀️', time: '08:00' },
    { key: 'lunch',   label: 'Almoço', icon: '🌤', time: '13:00' },
    { key: 'dinner',  label: 'Jantar', icon: '🌆', time: '19:00' },
    { key: 'bedtime', label: 'Deitar', icon: '🌙', time: '22:00' },
  ]

  const hasMeds = meds.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#b45309', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 2, background: '#b45309', borderRadius: 1 }} />
            Nota de Entrega de Medicação
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 8 }}>
            Nota de Entrega
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 540 }}>
            Cria uma nota de entrega clara para deixar com o familiar quando não estás presente. Mostra os medicamentos, horários e instruções especiais.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }} className="nota-grid">

          {/* ── Painel de edição ──────────────────────────────────────── */}
          <div>
            {/* Perfil */}
            {user && (
              <div style={{ marginBottom: 10 }}>
                <ProfileSelector onChange={handleProfileChange} />
              </div>
            )}

            {/* Info básica */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Informação</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={patientName} onChange={e => setPatientName(e.target.value)}
                  placeholder="Nome do doente / familiar"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={period} onChange={e => setPeriod(e.target.value)}
                  placeholder="Período (ex: 2 a 9 de Junho)"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={caretakerName} onChange={e => setCaretakerName(e.target.value)}
                  placeholder="Responsável pela medicação"
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notas importantes (ex: alergias, alerta de urgência...)"
                  rows={2}
                  style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical' }} />
              </div>
            </div>

            {/* Medicamentos */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Medicamentos {loading && <span style={{ color: 'var(--green)' }}>A carregar...</span>}
              </div>

              {meds.map((med, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bg-3)', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{med.name} {med.dose && <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>{med.dose}</span>}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {SLOTS.filter(s => med[s.key]).map(s => `${s.icon} ${s.label}`).join(' · ') || '—'}
                      {med.withFood && ' · 🍽 com alimento'}
                    </div>
                  </div>
                  <button onClick={() => setMeds(p => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16, padding: 4, flexShrink: 0 }}>×</button>
                </div>
              ))}

              {adding ? (
                <div style={{ marginTop: 10, padding: '12px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                    <input value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                      placeholder="Nome do medicamento" autoFocus
                      style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                      placeholder="Dose"
                      style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', width: 80 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {SLOTS.map(s => (
                      <button key={s.key} onClick={() => toggleSlot(s.key as any)}
                        style={{ padding: '6px 10px', border: `1.5px solid ${newMed[s.key] ? '#b45309' : 'var(--border)'}`, borderRadius: 6, background: newMed[s.key] ? '#fffbeb' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: newMed[s.key] ? 700 : 400, color: newMed[s.key] ? '#b45309' : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                    <button onClick={() => setNewMed(p => ({ ...p, withFood: !p.withFood }))}
                      style={{ padding: '6px 10px', border: `1.5px solid ${newMed.withFood ? '#0d6e42' : 'var(--border)'}`, borderRadius: 6, background: newMed.withFood ? 'var(--green-light)' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: newMed.withFood ? 700 : 400, color: newMed.withFood ? 'var(--green-2)' : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                      🍽 Com alimento
                    </button>
                  </div>
                  <input value={newMed.special} onChange={e => setNewMed(p => ({ ...p, special: e.target.value }))}
                    placeholder="Instrução especial (opcional)"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 11px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={addMed} disabled={!newMed.name.trim()}
                      style={{ background: '#b45309', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: newMed.name.trim() ? 1 : 0.5 }}>
                      Adicionar
                    </button>
                    <button onClick={() => setAdding(false)}
                      style={{ background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                  style={{ marginTop: 10, width: '100%', padding: '9px', background: 'transparent', border: '1.5px dashed var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  + Adicionar medicamento
                </button>
              )}
            </div>

            <button onClick={() => window.print()} disabled={!hasMeds || !patientName}
              style={{ width: '100%', padding: '13px', background: hasMeds && patientName ? 'var(--ink)' : 'var(--bg-3)', color: hasMeds && patientName ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: hasMeds && patientName ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🖨 Imprimir nota de entrega
            </button>
          </div>

          {/* ── Pré-visualização ─────────────────────────────────────── */}
          <div id="print-nota" style={{ background: 'white', border: '2px solid var(--ink)', borderRadius: 10, padding: '28px', minHeight: 400 }}>
            {/* Header da nota */}
            <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Nota de Entrega de Medicação</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
                    {patientName || 'Nome do doente'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                  <div>{period || new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  {caretakerName && <div style={{ marginTop: 4 }}>Responsável: {caretakerName}</div>}
                </div>
              </div>
            </div>

            {/* Tabela por horário */}
            {hasMeds ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SLOTS.map(slot => {
                  const slotMeds = meds.filter(m => m[slot.key])
                  if (slotMeds.length === 0) return null
                  return (
                    <div key={slot.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16 }}>{slot.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{slot.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{slot.time}</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                      {slotMeds.map((med, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: i % 2 === 0 ? 'var(--bg-2)' : 'white', borderRadius: 5, marginBottom: 3 }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{med.name}</span>
                            {med.dose && <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 6 }}>{med.dose}</span>}
                            {med.withFood && <span style={{ fontSize: 11, color: '#b45309', marginLeft: 8 }}>🍽 com alimento</span>}
                            {med.special && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{med.special}</div>}
                          </div>
                          {/* Checkbox */}
                          <div style={{ width: 20, height: 20, border: '2px solid var(--ink)', borderRadius: 3, flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Notas */}
                {notes && (
                  <div style={{ marginTop: 12, padding: '12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>⚠️ Notas importantes</div>
                    <div style={{ fontSize: 13, color: '#854d0e', lineHeight: 1.6 }}>{notes}</div>
                  </div>
                )}

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                  <span>Em caso de dúvida, contacta {caretakerName || 'o responsável pela medicação'}</span>
                  <span>phlox-clinical.com</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--ink-4)', gap: 10 }}>
                <span style={{ fontSize: 32 }}>💊</span>
                <span style={{ fontSize: 14 }}>Adiciona medicamentos para pré-visualizar</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .nota-grid { grid-template-columns: 1fr !important; } }
        @media print {
          header, .page-container > div:first-child, div:not(#print-nota) { display: none !important; }
          #print-nota { border: none !important; padding: 0 !important; margin: 0 !important; display: block !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}