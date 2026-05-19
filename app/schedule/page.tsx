'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface Med { id: string; name: string; dose: string | null; frequency: string | null; indication: string | null }
interface ScheduleMed { med_id: string; name: string; dose: string | null; reason: string; food: 'com_refeicao' | 'em_jejum' | 'indiferente'; notes?: string }
interface Slot { time: string; label: string; meds: ScheduleMed[] }
interface Warning { drug: string; warning: string; severity: 'alta' | 'media' | 'baixa' }
interface Schedule { slots: Slot[]; warnings: Warning[]; summary: string; wake_time: string; sleep_time: string }

const FOOD_ICON: Record<string, string> = {
  com_refeicao: '🍽️',
  em_jejum: '⏰',
  indiferente: '○',
}
const FOOD_LABEL: Record<string, string> = {
  com_refeicao: 'Com refeição',
  em_jejum: 'Em jejum',
  indiferente: 'Indiferente',
}
const SEV_COLOR = { alta: '#dc2626', media: '#d97706', baixa: '#2563eb' }
const SEV_BG   = { alta: '#fee2e2', media: '#fffbeb', baixa: '#eff6ff' }

export default function SchedulePage() {
  const { user, supabase } = useAuth()
  const [activeProfile, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [meds, setMeds] = useState<Med[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wakeTime, setWakeTime] = useState('07:30')
  const [sleepTime, setSleepTime] = useState('23:00')
  const [conditions, setConditions] = useState('')

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('personal_meds').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setMeds(data || []); setLoading(false) })
  }, [user, supabase])

  const generate = async () => {
    if (!user || meds.length === 0) return
    setGenerating(true)
    setError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ medications: meds, wake_time: wakeTime, sleep_time: sleepTime, conditions }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao gerar horário'); return }
      setSchedule(data)
    } catch (e: any) {
      setError(e.message || 'Erro de ligação')
    } finally {
      setGenerating(false)
    }
  }

  const printSchedule = () => window.print()

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40 }}>⏰</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Horário Inteligente</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginTop: 8 }}>Inicia sessão para criar o teu horário de medicação personalizado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="no-print">

        <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Horário Inteligente</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>O horário perfeito para a tua medicação</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ProfileSelector onChange={p => setActiveProfileState(p)} />
                {schedule && (
                  <button onClick={printSchedule} style={{ padding: '9px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    🖨️ Imprimir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {loading ? (
          <div className="skeleton" style={{ height: 100, borderRadius: 10 }} />
        ) : meds.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💊</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Sem medicamentos registados</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 20 }}>Adiciona os teus medicamentos primeiro.</div>
            <a href="/mymeds" style={{ padding: '10px 20px', background: 'var(--green)', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Ir para Os Meus Medicamentos →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Config panel */}
            {!schedule && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>⚙️ Configurar horário</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Hora de acordar</div>
                    <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Hora de dormir</div>
                    <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Condições clínicas (opcional)</div>
                  <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Ex: diabetes, insuficiência renal, hipertensão"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                </div>

                {/* Med preview */}
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {meds.length} medicamentos a organizar
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {meds.map(m => (
                      <span key={m.id} style={{ padding: '4px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>
                        {m.name}{m.dose ? ` ${m.dose}` : ''}
                      </span>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
                    ⚠️ {error}
                  </div>
                )}

                <button onClick={generate} disabled={generating} style={{
                  marginTop: 16, width: '100%', padding: '14px', background: generating ? '#9ca3af' : 'var(--green)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
                }}>
                  {generating ? '⏳ A calcular o horário ideal...' : '✨ Gerar Horário Inteligente'}
                </button>
              </div>
            )}

            {/* Schedule result */}
            {schedule && (
              <>
                {/* Summary */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📋 Resumo do horário</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>{schedule.summary}</div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 20 }}>
                      ☀️ Acorda: {schedule.wake_time}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 20 }}>
                      🌙 Dorme: {schedule.sleep_time}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 20 }}>
                      💊 {meds.length} medicamentos · {schedule.slots.length} momentos
                    </span>
                  </div>
                  <button onClick={() => setSchedule(null)} className="no-print" style={{ marginTop: 12, padding: '7px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: 'var(--ink-4)' }}>
                    ↩ Reconfigurar
                  </button>
                </div>

                {/* Warnings */}
                {schedule.warnings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {schedule.warnings.map((w, i) => (
                      <div key={i} style={{ background: SEV_BG[w.severity], border: `1px solid ${SEV_COLOR[w.severity]}30`, borderLeft: `4px solid ${SEV_COLOR[w.severity]}`, borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16 }}>{w.severity === 'alta' ? '🚨' : w.severity === 'media' ? '⚠️' : 'ℹ️'}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: SEV_COLOR[w.severity] }}>{w.drug}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{w.warning}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {schedule.slots.map((slot, si) => (
                    <div key={si} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ background: '#0f172a', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{slot.time}</div>
                        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{slot.label}</div>
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{slot.meds.length} medicamento{slot.meds.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div>
                        {slot.meds.map((m, mi) => (
                          <div key={mi} style={{ padding: '12px 18px', borderBottom: mi < slot.meds.length - 1 ? '1px solid var(--bg-2)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }} title={FOOD_LABEL[m.food]}>{FOOD_ICON[m.food]}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                                {m.dose && <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#1d4ed8', fontWeight: 600 }}>{m.dose}</span>}
                                <span style={{ fontSize: 10, padding: '2px 8px', background: m.food === 'em_jejum' ? '#fef9c3' : m.food === 'com_refeicao' ? '#d1fae5' : 'var(--bg-2)', border: '1px solid', borderColor: m.food === 'em_jejum' ? '#fde68a' : m.food === 'com_refeicao' ? '#6ee7b7' : 'var(--border)', borderRadius: 20, color: m.food === 'em_jejum' ? '#854d0e' : m.food === 'com_refeicao' ? '#065f46' : 'var(--ink-5)' }}>
                                  {FOOD_ICON[m.food]} {FOOD_LABEL[m.food]}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>{m.reason}</div>
                              {m.notes && <div style={{ fontSize: 11, color: '#d97706', marginTop: 3, fontWeight: 600 }}>⚠️ {m.notes}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important }
          body { background: white !important }
        }
      `}</style>
    </div>
  )
}
