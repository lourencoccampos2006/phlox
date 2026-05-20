'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MODE_QUICK_ACTIONS } from '@/lib/navigation'
import { setActiveProfile } from '@/lib/profileContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 19) return 'Boa tarde'
  return 'Boa noite'
}

function dateStr() {
  return new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Shared mini-components ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '3px solid #e2e8f0',
        borderTopColor: '#0d9488',
        animation: 'spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>A carregar…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function RedirectToLogin() {
  const router = useRouter()
  useEffect(() => {
    router.push('/login')
  }, [router])
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 14, color: '#64748b' }}>A redirecionar para o login…</div>
    </div>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '40px',
      border: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '2.5px solid #e2e8f0',
        borderTopColor: color,
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: '#94a3b8' }}>A carregar…</span>
    </div>
  )
}

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
      }}>
        {children}
      </div>
      {right}
    </div>
  )
}

function ToolCard({
  href,
  icon,
  label,
  desc,
  color,
}: {
  href: string
  icon: string
  label: string
  desc: string
  color: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="tool-card-link">
      <div style={{
        background: 'white',
        borderRadius: 14,
        padding: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 94,
        transition: 'transform 0.12s, box-shadow 0.12s',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${color}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          {icon}
        </div>
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: 2,
          }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

function BigLinkCard({
  href,
  icon,
  label,
  desc,
  color,
}: {
  href: string
  icon: string
  label: string
  desc: string
  color: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', flex: '1 1 0', minWidth: 140 }} className="big-link-card">
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '22px 18px',
        border: `1px solid ${color}22`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: '100%',
        boxSizing: 'border-box',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, flex: 1 }}>{desc}</div>
        <div style={{ fontSize: 12, color, fontWeight: 700, marginTop: 4 }}>Abrir →</div>
      </div>
    </Link>
  )
}

function MedSkeleton() {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '22px', border: '1px solid #e2e8f0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 0',
          borderBottom: i < 3 ? '1px solid #f8fafc' : 'none',
        }}>
          <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 13, width: '58%', marginBottom: 6, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 11, width: '38%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function ArrowRight({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color || 'rgba(255,255,255,0.7)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

// ─── PersonalHome ─────────────────────────────────────────────────────────────

function PersonalHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [meds, setMeds] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [weekLogs, setWeekLogs] = useState<any[]>([])
  const [vitals, setVitals] = useState<any[]>([])
  const [loadingMeds, setLoadingMeds] = useState(true)
  const [loadingVitals, setLoadingVitals] = useState(true)

  const firstName = user?.name?.split(' ')[0] || ''
  const today = todayStr()
  const now = nowTimeStr()
  const color = '#0d9488'

  // Fetch meds + today's logs
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoadingMeds(true)
      const since7d = new Date()
      since7d.setDate(since7d.getDate() - 6)
      const since7dStr = since7d.toISOString().split('T')[0]

      const [medsRes, logsRes, weekRes] = await Promise.all([
        supabase.from('personal_meds').select('id,name,dose,frequency,reminder_times').eq('user_id', user.id).order('name'),
        supabase.from('med_logs').select('med_id,status,logged_at').eq('user_id', user.id).eq('date', today),
        supabase.from('med_logs').select('med_id,status,date').eq('user_id', user.id).gte('date', since7dStr).lte('date', today),
      ])
      const medsData = medsRes.data ?? []
      setMeds(medsData)
      setLogs(logsRes.data ?? [])
      setWeekLogs(weekRes.data ?? [])
      setLoadingMeds(false)
    })()
  }, [user?.id])

  // Fetch vitals via API (tabela: hr,bp_sys,bp_dia,spo2,weight,glucose,temp,recorded_at)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoadingVitals(true)
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      if (!token) { setLoadingVitals(false); return }
      const res = await fetch('/api/vitals?limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setLoadingVitals(false); return }
      const d = await res.json()
      setVitals(d.vitals || [])
      setLoadingVitals(false)
    })()
  }, [user?.id])

  // Derived state
  const takenIds = new Set(logs.filter(l => l.status === 'taken').map(l => l.med_id))
  const totalSlots = meds.reduce(
    (acc, m) => acc + (Array.isArray(m.reminder_times) ? m.reminder_times.length || 1 : 1),
    0,
  )
  const takenCount = logs.filter(l => l.status === 'taken').length
  const pct = totalSlots > 0 ? Math.min(100, Math.round((takenCount / totalSlots) * 100)) : 0

  // Upcoming doses: reminder_times >= now, med not fully taken
  type Dose = { time: string; medName: string; medId: string }
  const upcomingDoses: Dose[] = []
  meds.forEach(m => {
    if (!takenIds.has(m.id) && Array.isArray(m.reminder_times)) {
      m.reminder_times.forEach((t: string) => {
        if (t >= now) upcomingDoses.push({ time: t, medName: m.name, medId: m.id })
      })
    }
  })
  upcomingDoses.sort((a, b) => a.time.localeCompare(b.time))

  const progressColor = pct === 100 ? '#059669' : pct >= 70 ? color : '#f59e0b'

  // Adherence streak: consecutive days (going back from today) with ≥80% adherence
  let adherenceStreak = 0
  if (!loadingMeds && meds.length > 0) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const iso = d.toISOString().split('T')[0]
      const dayTaken = weekLogs.filter(l => l.date === iso && l.status === 'taken').length
      if (Math.round((dayTaken / meds.length) * 100) >= 80) adherenceStreak++
      else break
    }
  }

  // Flatten latest vital records — keep current + previous per metric for trend arrows
  type VCard = { icon: string; label: string; value: string; unit: string; date: string; trend?: 'up' | 'down' | 'same' }
  const vitalPrev: Record<string, number> = {}
  const vitalCurrent: Record<string, number> = {}
  const vitalCards: VCard[] = []
  const seenVital = new Set<string>()
  vitals.forEach((v: any) => {
    const date = new Date(v.recorded_at).toLocaleDateString('pt-PT')
    const candidates: Array<{ icon: string; label: string; value: string; unit: string; date: string; num: number }> = []
    if (v.hr)               candidates.push({ icon: '💓', label: 'FC',       value: `${v.hr}`,              unit: 'bpm',   date, num: v.hr })
    if (v.bp_sys && v.bp_dia) candidates.push({ icon: '🩺', label: 'Tensão', value: `${v.bp_sys}/${v.bp_dia}`, unit: 'mmHg', date, num: v.bp_sys })
    if (v.spo2)             candidates.push({ icon: '🫁', label: 'SpO₂',     value: `${v.spo2}`,            unit: '%',     date, num: v.spo2 })
    if (v.weight)           candidates.push({ icon: '⚖️', label: 'Peso',     value: `${v.weight}`,          unit: 'kg',    date, num: v.weight })
    if (v.glucose)          candidates.push({ icon: '🩸', label: 'Glicemia', value: `${v.glucose}`,         unit: 'mg/dL', date, num: v.glucose })
    if (v.temp)             candidates.push({ icon: '🌡️', label: 'Temp.',    value: `${v.temp}`,            unit: '°C',    date, num: v.temp })
    candidates.forEach(({ num, ...c }) => {
      if (!seenVital.has(c.label)) {
        seenVital.add(c.label)
        vitalCurrent[c.label] = num
        const prev = vitalPrev[c.label]
        const trend: VCard['trend'] = prev === undefined ? undefined
          : num > prev ? 'up' : num < prev ? 'down' : 'same'
        vitalCards.push({ ...c, trend })
      } else if (vitalPrev[c.label] === undefined) {
        vitalPrev[c.label] = num
      }
    })
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* Hero — teal gradient */}
      <div style={{
        background: `linear-gradient(135deg, ${color} 0%, #0891b2 100%)`,
        padding: '32px 24px 32px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 6px',
            textTransform: 'capitalize',
          }}>
            {capitalise(dateStr())}
          </p>
          <h1 style={{
            fontSize: 30,
            fontWeight: 900,
            color: 'white',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', margin: 0 }}>
            {loadingMeds
              ? 'A carregar os teus medicamentos…'
              : meds.length > 0
                ? `${takenCount} de ${totalSlots} dose${totalSlots !== 1 ? 's' : ''} tomada${totalSlots !== 1 ? 's' : ''} hoje`
                : 'A tua saúde, organizada num só lugar.'}
          </p>
        </div>
      </div>

      {/* ALL DONE — celebration banner */}
      {!loadingMeds && meds.length > 0 && pct === 100 && (
        <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
          <div style={{
            maxWidth: 860, margin: '0 auto', padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>🎉</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 2 }}>
                Todas as tomas de hoje concluídas!
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>
                Excelente adesão ao tratamento. Continua assim amanhã!
              </div>
            </div>
            <div style={{ fontSize: 22 }}>✅</div>
          </div>
        </div>
      )}

      {/* Next dose banner */}
      {!loadingMeds && upcomingDoses.length > 0 && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
        }}>
          <div style={{
            maxWidth: 860,
            margin: '0 auto',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: '#fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>⏰</div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#92400e',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 2,
              }}>
                Próxima toma
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#78350f' }}>
                {upcomingDoses[0].time} — {upcomingDoses[0].medName}
              </div>
            </div>
            <Link href="/mymeds" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '11px 22px',
              borderRadius: 28,
              background: '#d97706',
              color: 'white',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              Registar toma
            </Link>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* MEDICAMENTOS HOJE */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            meds.length > 0 ? (
              <Link href="/mymeds" style={{
                fontSize: 13,
                color,
                fontWeight: 700,
                textDecoration: 'none',
              }}>
                Gerir →
              </Link>
            ) : undefined
          }>
            Os teus medicamentos hoje
          </SectionLabel>

          {loadingMeds ? (
            <MedSkeleton />
          ) : meds.length === 0 ? (
            <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: '44px 24px',
                border: '2px dashed #e2e8f0',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>💊</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Ainda não tens medicamentos
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#64748b',
                  marginBottom: 22,
                  lineHeight: 1.65,
                  maxWidth: 340,
                  margin: '0 auto 22px',
                }}>
                  Adiciona os teus medicamentos e o Phlox lembra-te quando é hora de tomar.
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '13px 28px',
                  borderRadius: 28,
                  background: color,
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 800,
                }}>
                  + Adicionar medicamento
                </div>
              </div>
            </Link>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: '22px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              {/* Progress header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
                    Tomados hoje
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}>
                    {takenCount}
                    <span style={{ fontSize: 18, fontWeight: 500, color: '#94a3b8' }}> de {totalSlots}</span>
                  </div>
                </div>
                {/* Circular progress */}
                <div style={{
                  width: 62,
                  height: 62,
                  borderRadius: '50%',
                  background: `conic-gradient(${progressColor} ${pct * 3.6}deg, #f1f5f9 0deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    color: progressColor,
                  }}>
                    {pct}%
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 7,
                background: '#f1f5f9',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 20,
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: progressColor,
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              {/* Med list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {meds.slice(0, 7).map(m => {
                  const taken = takenIds.has(m.id)
                  return (
                    <div key={m.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: taken ? '#f0fdf4' : '#f8fafc',
                      border: `1.5px solid ${taken ? '#86efac' : '#e2e8f0'}`,
                    }}>
                      {/* Big checkbox */}
                      <div style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        border: `2.5px solid ${taken ? '#059669' : '#cbd5e1'}`,
                        background: taken ? '#059669' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                      }}>
                        {taken && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: 15,
                          fontWeight: taken ? 500 : 700,
                          color: taken ? '#059669' : '#0f172a',
                          textDecoration: taken ? 'line-through' : 'none',
                        }}>
                          {m.name}
                        </span>
                        {m.dose && (
                          <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 7 }}>
                            {m.dose}
                          </span>
                        )}
                        {Array.isArray(m.reminder_times) && m.reminder_times.length > 0 && (
                          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 1 }}>
                            {m.reminder_times.join(' · ')}
                          </div>
                        )}
                      </div>
                      {taken && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#059669',
                          flexShrink: 0,
                        }}>
                          Tomado ✓
                        </span>
                      )}
                    </div>
                  )
                })}
                {meds.length > 7 && (
                  <Link href="/mymeds" style={{
                    fontSize: 13,
                    color,
                    fontWeight: 700,
                    textDecoration: 'none',
                    textAlign: 'center',
                    padding: '8px 0',
                    display: 'block',
                  }}>
                    + {meds.length - 7} medicamento{meds.length - 7 !== 1 ? 's' : ''} →
                  </Link>
                )}
              </div>

              {/* CTA footer */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                <Link href="/mymeds" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 0',
                  borderRadius: 12,
                  background: `${color}0e`,
                  border: `1.5px solid ${color}2a`,
                  color,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}>
                  Gerir os meus medicamentos →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ADESÃO — 7 DIAS */}
        {!loadingMeds && meds.length > 0 && weekLogs.length > 0 && (() => {
          const days: { label: string; date: string }[] = []
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i)
            const iso = d.toISOString().split('T')[0]
            const labels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
            days.push({ label: i === 0 ? 'Hoje' : labels[d.getDay()], date: iso })
          }
          const totalMeds = meds.length
          return (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel right={adherenceStreak > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 10px' }}>
                  <span style={{ fontSize: 14 }}>🔥</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e' }}>
                    {adherenceStreak} dia{adherenceStreak !== 1 ? 's' : ''} seguidos
                  </span>
                </div>
              ) : undefined}>Adesão — últimos 7 dias</SectionLabel>
              <div style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                  {days.map(d => {
                    const dayTaken = weekLogs.filter(l => l.date === d.date && l.status === 'taken').length
                    const pctDay = totalMeds > 0 ? Math.min(100, Math.round((dayTaken / totalMeds) * 100)) : 0
                    const bg = pctDay === 100 ? '#059669' : pctDay >= 60 ? '#d97706' : pctDay > 0 ? '#3b82f6' : '#f1f5f9'
                    const isToday = d.date === today
                    return (
                      <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <div style={{
                          width: '100%', aspectRatio: '1/1', borderRadius: 10,
                          background: bg,
                          border: isToday ? `2px solid ${color}` : '2px solid transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column',
                          cursor: 'default',
                        }}>
                          {pctDay > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: 'white', lineHeight: 1 }}>
                              {pctDay}%
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 9, fontWeight: isToday ? 800 : 500, color: isToday ? color : '#94a3b8', textAlign: 'center', letterSpacing: '-0.01em' }}>
                          {d.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f8fafc' }}>
                  {[['#059669','100%'],['#d97706','60–99%'],['#3b82f6','1–59%'],['#f1f5f9','0%']].map(([c,l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })()}

        {/* HORÁRIO DE HOJE (apenas se há doses pendentes) */}
        {!loadingMeds && upcomingDoses.length > 1 && (
          <section style={{ marginBottom: 32 }}>
            <SectionLabel>Horário de hoje</SectionLabel>
            <div style={{
              background: 'white',
              borderRadius: 16,
              border: '1px solid #f1f5f9',
              overflow: 'hidden',
            }}>
              {upcomingDoses.slice(0, 6).map((dose, i) => (
                <div key={`${dose.medId}-${dose.time}`} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  borderBottom: i < Math.min(upcomingDoses.length, 6) - 1
                    ? '1px solid #f8fafc'
                    : 'none',
                }}>
                  <div style={{
                    minWidth: 52,
                    fontSize: 15,
                    fontWeight: 800,
                    color,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {dose.time}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', flex: 1 }}>
                    {dose.medName}
                  </div>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: `${color}60`,
                    flexShrink: 0,
                  }} />
                </div>
              ))}
              {upcomingDoses.length > 6 && (
                <div style={{
                  padding: '10px 18px',
                  fontSize: 12,
                  color: '#94a3b8',
                  borderTop: '1px solid #f8fafc',
                }}>
                  +{upcomingDoses.length - 6} tomas mais tarde
                </div>
              )}
            </div>
          </section>
        )}

        {/* SINAIS VITAIS */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            <Link href="/vitals" style={{
              fontSize: 12,
              color: '#e11d48',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 12px',
              borderRadius: 20,
              background: '#fff1f2',
              border: '1px solid #fecdd3',
            }}>
              + Registar
            </Link>
          }>
            Sinais vitais
          </SectionLabel>

          {loadingVitals ? (
            <Spinner color={color} />
          ) : vitalCards.length === 0 ? (
            <Link href="/vitals" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: '36px 24px',
                border: '2px dashed #fecdd3',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>❤️</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Regista os teus sinais vitais
                </div>
                <div style={{
                  fontSize: 13,
                  color: '#64748b',
                  marginBottom: 20,
                  lineHeight: 1.65,
                  maxWidth: 300,
                  margin: '0 auto 20px',
                }}>
                  Tensão arterial, pulso, peso — acompanha a tua saúde ao longo do tempo.
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 24px',
                  borderRadius: 28,
                  background: '#e11d48',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 800,
                }}>
                  Começar agora →
                </div>
              </div>
            </Link>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 145px), 1fr))',
              gap: 10,
            }}>
              {vitalCards.slice(0, 6).map(c => (
                <Link key={c.label} href="/vitals" style={{ textDecoration: 'none' }} className="vital-card">
                  <div style={{
                    background: 'white',
                    borderRadius: 14,
                    padding: '16px',
                    border: '1px solid #fce7f3',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 22 }}>{c.icon}</div>
                      {c.trend && c.trend !== 'same' && (
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: c.trend === 'up' ? '#3b82f6' : '#10b981',
                        }}>
                          {c.trend === 'up' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 10, color: '#94a3b8',
                      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4,
                    }}>
                      {c.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                      {c.value}
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}> {c.unit}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 5 }}>{c.date}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* HEALTH SCORE */}
        {!loadingMeds && !loadingVitals && (meds.length > 0 || vitalCards.length > 0) && (() => {
          const adherenceScore = meds.length > 0 ? Math.round(pct * 0.45) : 0
          const streakBonus = Math.min(adherenceStreak * 3, 15)
          const vitalsScore = vitalCards.length > 0 ? 25 : 0
          const medsScore = meds.length > 0 ? 15 : 0
          const score = Math.min(100, adherenceScore + streakBonus + vitalsScore + medsScore)
          const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#e11d48'
          const scoreLabel = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : 'A melhorar'
          return (
            <section style={{ marginBottom: 32 }}>
              <SectionLabel>Score de saúde</SectionLabel>
              <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                    <circle cx="36" cy="36" r="30" fill="none" stroke={scoreColor} strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 30}`}
                      strokeDashoffset={`${2 * Math.PI * 30 * (1 - score / 100)}`}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{scoreLabel}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {meds.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: progressColor, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 80 }}>Adesão {pct}%</span>
                      </div>
                    )}
                    {adherenceStreak > 0 && (
                      <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>🔥 {adherenceStreak} dia{adherenceStreak !== 1 ? 's' : ''} em sequência</div>
                    )}
                    {vitalCards.length === 0 && (
                      <Link href="/vitals" style={{ fontSize: 11, color: '#e11d48', fontWeight: 600, textDecoration: 'none' }}>+ Regista sinais vitais para melhorar o teu score →</Link>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )
        })()}

        {/* FERRAMENTAS RÁPIDAS */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 155px), 1fr))',
            gap: 10,
          }}>
            {MODE_QUICK_ACTIONS.personal.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* PHLOX AI BANNER */}
        <section style={{ marginBottom: 32 }}>
          <Link href="/ai" style={{ display: 'block', textDecoration: 'none' }} className="ai-banner">
            <div style={{
              background: `linear-gradient(135deg, ${color} 0%, #0891b2 100%)`,
              borderRadius: 20,
              padding: '26px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: 17,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 5,
                }}>
                  Farmacêutico virtual 24h
                </div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: 'white',
                  marginBottom: 5,
                  letterSpacing: '-0.02em',
                }}>
                  Phlox AI
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55 }}>
                  Qualquer dúvida sobre medicamentos, interações ou saúde — resposta em segundos.
                </div>
              </div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ArrowRight />
              </div>
            </div>
          </Link>
        </section>

        {/* SEGURANÇA */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Segurança da medicação</SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              {
                href: '/interactions',
                icon: '🔍',
                label: 'Verificar interações',
                desc: 'Os meus medicamentos são seguros juntos?',
              },
              {
                href: '/food-drug',
                icon: '🥗',
                label: 'Alimentos a evitar',
                desc: 'O que não devo comer com estes meds?',
              },
              {
                href: '/bula',
                icon: '📄',
                label: 'Perceber uma bula',
                desc: 'Linguagem simples, sem jargão médico',
              },
              {
                href: '/passport',
                icon: '🆘',
                label: 'Passaporte de saúde',
                desc: 'QR code de emergência com toda a info',
              },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="sec-row">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '15px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${color}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
                  </div>
                  <ChevronRight />
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        .tool-card-link > div:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-link-card > div:hover  { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; }
        .ai-banner > div:hover      { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(13,148,136,0.32) !important; }
        .sec-row > div:hover        { background: #f8fafc !important; }
        .vital-card > div:hover     { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.07) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── CaregiverHome ────────────────────────────────────────────────────────────

function CaregiverHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [medCounts, setMedCounts] = useState<Record<string, number>>({})
  const [profileMeds, setProfileMeds] = useState<Record<string, string[]>>({})
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [todayLogs, setTodayLogs] = useState<any[]>([])

  const firstName = user?.name?.split(' ')[0] || ''
  const color = '#d97706'

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoadingProfiles(true)
      const today = new Date().toISOString().split('T')[0]
      const { data: p } = await supabase
        .from('family_profiles')
        .select('id,name,relation,age,sex,conditions,allergies,created_at')
        .eq('user_id', user.id)
        .order('name')
      const profileList = p ?? []
      setProfiles(profileList)

      if (profileList.length > 0) {
        const ids = profileList.map((x: any) => x.id)
        const [{ data: m }, { data: logs }] = await Promise.all([
          supabase.from('family_profile_meds').select('profile_id, name, reminder_times').in('profile_id', ids),
          supabase.from('med_logs').select('med_id, status, date').eq('user_id', user.id).eq('date', today),
        ])
        const counts: Record<string, number> = {}
        const medsMap: Record<string, string[]> = {}
        ;(m ?? []).forEach((row: any) => {
          counts[row.profile_id] = (counts[row.profile_id] || 0) + 1
          if (!medsMap[row.profile_id]) medsMap[row.profile_id] = []
          medsMap[row.profile_id].push(row.name)
        })
        setMedCounts(counts)
        setProfileMeds(medsMap)
        setTodayLogs(logs ?? [])
      }
      setLoadingProfiles(false)
    })()
  }, [user?.id])

  function getProfileRisk(p: any, medCount: number) {
    let score = 0
    if ((p.age || 0) >= 75) score += 25
    if (medCount >= 5) score += 25
    if (p.allergies) score += 10
    if (p.conditions?.toLowerCase().includes('renal') || p.conditions?.toLowerCase().includes('hepátic')) score += 20
    if (score >= 50) return { label: 'Alto risco', color: '#dc2626', bg: '#fee2e2' }
    if (score >= 25) return { label: 'Atenção', color: '#d97706', bg: '#fffbeb' }
    return null
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
  }

  function calcAge(age: number | null): number | null {
    return age ?? null
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fffbeb', paddingTop: 56 }}>

      {/* Hero — amber */}
      <div style={{
        background: `linear-gradient(135deg, #b45309 0%, ${color} 60%, #f59e0b 100%)`,
        padding: '32px 24px 30px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 6px',
            textTransform: 'capitalize',
          }}>
            {capitalise(dateStr())}
          </p>
          <h1 style={{
            fontSize: 30,
            fontWeight: 900,
            color: 'white',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.18)',
            }}>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                Cuidador familiar
              </span>
            </div>
            {!loadingProfiles && profiles.length > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.15)',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                  {profiles.length} perfil{profiles.length !== 1 ? 'is' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* A MINHA FAMÍLIA */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            profiles.length > 0 ? (
              <Link href="/perfis" style={{
                fontSize: 13,
                color,
                fontWeight: 700,
                textDecoration: 'none',
              }}>
                Gerir →
              </Link>
            ) : undefined
          }>
            A minha família
          </SectionLabel>

          {loadingProfiles ? (
            <Spinner color={color} />
          ) : profiles.length === 0 ? (
            <Link href="/perfis" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: '44px 24px',
                border: '2px dashed #fde68a',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Nenhum familiar adicionado
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#64748b',
                  marginBottom: 22,
                  lineHeight: 1.65,
                  maxWidth: 320,
                  margin: '0 auto 22px',
                }}>
                  Adiciona perfis para gerir a medicação e saúde de cada familiar.
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '13px 28px',
                  borderRadius: 28,
                  background: color,
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 800,
                }}>
                  + Adicionar familiar
                </div>
              </div>
            </Link>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))',
              gap: 10,
            }}>
              {profiles.map(p => {
                const age = calcAge(p.age)
                const medCount = medCounts[p.id] || 0
                const risk = getProfileRisk(p, medCount)
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{
                      background: 'white',
                      borderRadius: 14,
                      padding: '18px',
                      border: `1px solid ${risk ? risk.color + '30' : 'rgba(0,0,0,0.06)'}`,
                      height: '100%',
                      boxSizing: 'border-box',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: '#fef3c7',
                          border: `2px solid ${color}30`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 700,
                          color,
                          flexShrink: 0,
                        }}>
                          {getInitials(p.name)}
                        </div>
                        {risk && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: risk.color, background: risk.bg, border: `1px solid ${risk.color}40`, borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>
                            {risk.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 1 }}>{p.name}</div>
                      {p.relation && <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{p.relation}</div>}
                      {age != null && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{age} anos{(age as number) >= 75 ? ' · ≥75' : ''}</div>}
                      {p.conditions && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>{p.conditions}</div>}
                      {p.allergies && <div style={{ fontSize: 10, color: '#dc2626', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 4, padding: '2px 6px', marginBottom: 6, display: 'inline-block' }}>⚠️ {p.allergies}</div>}
                      {medCount > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 10, background: '#fef3c7', fontSize: 11, fontWeight: 700, color }}>
                          💊 {medCount} med{medCount !== 1 ? 's' : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                        <Link href="/mymeds" onClick={() => setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, conditions: p.conditions, allergies: p.allergies })} style={{ flex: 1, padding: '7px 0', background: color, color: 'white', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const }}>
                          Medicamentos
                        </Link>
                        <Link href="/vitals" onClick={() => setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, conditions: p.conditions, allergies: p.allergies })} style={{ flex: 1, padding: '7px 0', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const }}>
                          Vitais
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Add profile card */}
              <Link href="/perfis" style={{ textDecoration: 'none' }} className="add-profile-card">
                <div style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: '18px',
                  border: '2px dashed #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 130,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    marginBottom: 8,
                    color,
                  }}>
                    +
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>
                    Adicionar familiar
                  </div>
                </div>
              </Link>
            </div>
          )}
        </section>

        {/* FERRAMENTAS */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 155px), 1fr))',
            gap: 10,
          }}>
            {MODE_QUICK_ACTIONS.caregiver.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* RESUMO DE MEDICAÇÃO FAMILIAR */}
        {!loadingProfiles && profiles.length > 0 && Object.keys(profileMeds).length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <SectionLabel right={<Link href="/interactions" style={{ fontSize: 13, color, fontWeight: 700, textDecoration: 'none' }}>Ver interações →</Link>}>
              Medicação da família
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profiles.filter(p => (profileMeds[p.id] || []).length > 0).map(p => {
                const meds = profileMeds[p.id] || []
                const hasHighRisk = (p.age || 0) >= 75 && meds.length >= 3
                return (
                  <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: `1px solid ${hasHighRisk ? '#fde68a' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>
                      {getInitials(p.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{p.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {meds.slice(0, 4).map((m: string) => (
                          <span key={m} style={{ fontSize: 10, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{m}</span>
                        ))}
                        {meds.length > 4 && <span style={{ fontSize: 10, color: '#94a3b8', padding: '1px 0' }}>+{meds.length - 4} mais</span>}
                      </div>
                    </div>
                    <Link href="/interactions" onClick={() => { const drugsParam = meds.slice(0, 5).join(','); window.sessionStorage?.setItem('interactions_prefill', drugsParam) }} style={{ fontSize: 11, fontWeight: 700, color, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px', textDecoration: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                      Verificar
                    </Link>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* VERIFICAÇÃO RÁPIDA DE SEGURANÇA */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Verificação rápida de segurança</SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              {
                href: '/interactions',
                icon: '🔍',
                label: 'Verificar interações',
                desc: 'São seguros juntos? Cobre milhares de combinações.',
              },
              {
                href: '/food-drug',
                icon: '🥗',
                label: 'Alimentos a evitar',
                desc: 'O que não misturar com cada medicamento.',
              },
              {
                href: '/bula',
                icon: '📄',
                label: 'Perceber uma bula',
                desc: 'Qualquer bula em linguagem simples.',
              },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="sec-row">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '15px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
                  </div>
                  <ChevronRight />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* EMERGÊNCIA E DOCUMENTOS */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Emergência e documentos</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard
              href="/passport"
              icon="🆘"
              label="Passaporte de saúde"
              desc="Documento completo com QR code de emergência"
              color={color}
            />
            <BigLinkCard
              href="/ai"
              icon="🤖"
              label="Phlox AI"
              desc="Qualquer dúvida de saúde, resposta imediata"
              color="#0d9488"
            />
          </div>
        </section>

        {/* INTERAÇÕES BANNER */}
        <section style={{ marginBottom: 32 }}>
          <Link href="/interactions" style={{ display: 'block', textDecoration: 'none' }} className="cg-banner">
            <div style={{
              background: `linear-gradient(135deg, #b45309 0%, ${color} 100%)`,
              borderRadius: 16,
              padding: '22px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                flexShrink: 0,
              }}>🔍</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>
                  Verificar interações familiares
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>
                  Verifica se os medicamentos dos teus familiares são seguros juntos.
                  Cobre interações de milhares de combinações.
                </div>
              </div>
              <ArrowRight />
            </div>
          </Link>
        </section>

      </div>

      <style>{`
        .profile-card > div:hover        { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        .add-profile-card > div:hover    { border-color: ${color} !important; }
        .tool-card-link > div:hover      { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-link-card > div:hover       { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; }
        .sec-row > div:hover             { background: #f8fafc !important; }
        .cg-banner > div:hover           { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(180,83,9,0.3) !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── ClinicalHome ─────────────────────────────────────────────────────────────

function ClinicalHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [patients, setPatients] = useState<any[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)

  const firstName = user?.name?.split(' ')[0] || ''
  const color = '#2563eb'

  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const isDayShift = h >= 8 && h < 20
  const shiftLabel = isDayShift ? `Turno Manhã  ·  08:00 – 20:00` : `Turno Noite  ·  20:00 – 08:00`
  const shiftEmoji = isDayShift ? '🌤️' : '🌙'

  // Minutes remaining in current shift
  const currentMin = h * 60 + m
  const shiftEndMin = isDayShift ? 20 * 60 : (h >= 20 ? 32 * 60 : 8 * 60)
  const minutesLeft = shiftEndMin - currentMin
  const hoursLeft = Math.floor(minutesLeft / 60)
  const minsLeft = minutesLeft % 60
  const countdownLabel = minutesLeft <= 90
    ? `⚡ ${minutesLeft}min restantes`
    : `${hoursLeft}h ${minsLeft}min restantes`
  const countdownColor = minutesLeft <= 60 ? '#ef4444' : minutesLeft <= 120 ? '#f59e0b' : '#64748b'

  function getPatientRisk(p: any): { label: string; color: string; bg: string; border: string } {
    let score = (p.alerts || 0) * 20 + ((p.meds_count || 0) >= 5 ? 25 : 0) + ((p.age || 0) >= 75 ? 15 : 0)
    if (score >= 50) return { label: 'Risco alto', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
    if (score >= 20) return { label: 'Risco médio', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
    return { label: 'Risco baixo', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' }
  }

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoadingPatients(true)
      const { data, error } = await supabase
        .from('patients')
        .select('id,name,age,sex,conditions,updated_at,meds_count,alerts')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(8)
      if (error) console.error('[ClinicalHome] patients:', error)
      const sorted = (data ?? []).sort((a: any, b: any) =>
        (b.alerts || 0) - (a.alerts || 0)
      )
      setPatients(sorted)
      setLoadingPatients(false)
    })()
  }, [user?.id])

  function truncateConditions(conditions: string[] | string | null): string {
    if (!conditions) return ''
    const arr = Array.isArray(conditions) ? conditions : [conditions]
    if (arr.length === 0) return ''
    const shown = arr.slice(0, 2).join(', ')
    return arr.length > 2 ? `${shown} +${arr.length - 2}` : shown
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* Hero — dark navy */}
      <div style={{ background: '#0f172a', padding: '28px 24px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <div>
              {/* Shift badge + countdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontSize: 14 }}>{shiftEmoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'monospace' }}>
                    {shiftLabel}
                  </span>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${countdownColor}40`,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: countdownColor, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                    {countdownLabel}
                  </span>
                </div>
              </div>
              <h1 style={{
                fontSize: 26,
                fontWeight: 900,
                color: 'white',
                margin: '0 0 6px',
                letterSpacing: '-0.03em',
              }}>
                {greeting()}{firstName ? `, ${firstName}` : ''} 👋
              </h1>
              <p style={{
                fontSize: 13,
                color: '#475569',
                margin: 0,
                textTransform: 'capitalize',
              }}>
                {capitalise(dateStr())}
              </p>
            </div>
            {/* Patients stat */}
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12,
              padding: '14px 22px',
              flexShrink: 0,
              display: 'flex',
              gap: 24,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}>
                  {loadingPatients ? '–' : patients.length}
                </div>
                <div style={{
                  fontSize: 10,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: 4,
                }}>
                  Doentes
                </div>
              </div>
              {!loadingPatients && patients.reduce((s, p) => s + (p.alerts || 0), 0) > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 30,
                    fontWeight: 900,
                    color: '#f87171',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}>
                    {patients.reduce((s, p) => s + (p.alerts || 0), 0)}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 4,
                  }}>
                    Alertas
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* FERRAMENTAS CLÍNICAS */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas clínicas</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 148px), 1fr))',
            gap: 10,
          }}>
            {MODE_QUICK_ACTIONS.clinical.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* DOENTES */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            <Link href="/patients" style={{
              fontSize: 13,
              color,
              fontWeight: 700,
              textDecoration: 'none',
            }}>
              Ver todos →
            </Link>
          }>
            Doentes
          </SectionLabel>

          {loadingPatients ? (
            <Spinner color={color} />
          ) : patients.length === 0 ? (
            <Link href="/patients" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white',
                borderRadius: 16,
                padding: '44px 24px',
                border: '2px dashed #dbeafe',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🏥</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Nenhum doente registado
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#64748b',
                  marginBottom: 22,
                  lineHeight: 1.65,
                  maxWidth: 300,
                  margin: '0 auto 22px',
                }}>
                  Adiciona os teus doentes para acompanhar medicação e alertas clínicos.
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '13px 28px',
                  borderRadius: 28,
                  background: color,
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 800,
                }}>
                  + Adicionar doente
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {patients.map(p => {
                const condStr = truncateConditions(p.conditions)
                const alerts = p.alerts || 0
                const risk = getPatientRisk(p)
                const isPolymed = (p.meds_count || 0) >= 5
                const isElderly = (p.age || 0) >= 75
                return (
                  <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }} className="patient-row">
                    <div style={{
                      background: 'white', borderRadius: 12, padding: '14px 18px',
                      border: `1px solid ${alerts > 0 ? '#fca5a5' : 'rgba(0,0,0,0.06)'}`,
                      display: 'flex', alignItems: 'center', gap: 14, transition: 'transform 0.12s, box-shadow 0.12s',
                    }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: risk.bg, border: `1.5px solid ${risk.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: risk.color, flexShrink: 0 }}>
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {p.name}
                          {isPolymed && <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 3 }}>POLIMEDIC.</span>}
                          {isElderly && <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 5px', borderRadius: 3 }}>≥75</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {[p.age ? `${p.age}a` : null, p.sex, condStr || null, p.meds_count ? `${p.meds_count} meds` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: risk.color, whiteSpace: 'nowrap' }}>
                          {risk.label}
                        </div>
                        {alerts > 0 && (
                          <div style={{ background: '#fef2f2', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>
                            {alerts} alerta{alerts !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      <ChevronRight />
                    </div>
                  </Link>
                )
              })}
              <Link href="/patients" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 0',
                borderRadius: 12,
                background: `${color}0d`,
                border: `1.5px solid ${color}28`,
                color,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                marginTop: 6,
              }}>
                Ver todos os doentes →
              </Link>
            </div>
          )}
        </section>

        {/* VERIFICAÇÃO CLÍNICA */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Verificação rápida</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard
              href="/interactions"
              icon="🔍"
              label="Interações"
              desc="Mecanismo, gravidade e evidência clínica"
              color={color}
            />
            <BigLinkCard
              href="/reconciliacao"
              icon="🔄"
              label="Reconciliação"
              desc="Admissão vs. esquema atual"
              color="#0f766e"
            />
          </div>
        </section>

        {/* ORACLE AI BANNER */}
        <section style={{ marginBottom: 32 }}>
          <Link href="/oracle" style={{ display: 'block', textDecoration: 'none' }} className="oracle-banner">
            <div style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
              borderRadius: 16,
              padding: '22px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 54,
                height: 54,
                borderRadius: 15,
                background: 'rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 5,
                }}>
                  IA clínica especializada
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'white',
                  marginBottom: 5,
                  letterSpacing: '-0.02em',
                }}>
                  Oracle AI
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
                  SOAP farmacêutico, intervenções PCNE e plano de cuidados em segundos.
                </div>
              </div>
              <ArrowRight />
            </div>
          </Link>
        </section>

        {/* MAIS FERRAMENTAS CLÍNICAS */}
        <section>
          <SectionLabel right={
            <Link href="/ferramentas" style={{
              fontSize: 12,
              color,
              fontWeight: 600,
              textDecoration: 'none',
            }}>
              Ver todas →
            </Link>
          }>
            Mais ferramentas clínicas
          </SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              { href: '/calculators', icon: '🔢', label: 'Calculadoras', desc: 'SCORE2, CKD-EPI, TFG, doses' },
              { href: '/adr-report',  icon: '⚠️', label: 'Notificação RAM', desc: 'WHO-UMC e INFARMED' },
              { href: '/dilutions',   icon: '🧫', label: 'Diluições IV', desc: 'Cálculo de diluições intravenosas' },
              { href: '/labs',        icon: '🧪', label: 'Perceber análises', desc: 'O que cada valor significa' },
              { href: '/optimizer',   icon: '⚡', label: 'Otimizar prescrição', desc: 'STOPP/START e genéricos' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="clin-row">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: `${color}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <ChevronRight />
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        .tool-card-link > div:hover  { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-link-card > div:hover   { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; }
        .patient-row > div:hover     { transform: translateX(3px) !important; box-shadow: 0 2px 12px rgba(0,0,0,0.06) !important; }
        .oracle-banner > div:hover   { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,0.3) !important; }
        .clin-row > div:hover        { background: #f8fafc !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── StudentHome ──────────────────────────────────────────────────────────────

// Pharmacology flashcards — educational content, intentionally static.
const DAILY_FLASHCARDS = [
  {
    q: 'Qual o mecanismo principal das estatinas?',
    a: 'Inibição competitiva da HMG-CoA redutase → ↓ síntese hepática de colesterol → ↑ expressão de LDL-R → ↓ LDL plasmático. Em paralelo, efeitos pleiotrópicos: anti-inflamatórios, estabilização de placa aterosclerótica e melhoria da função endotelial.',
  },
  {
    q: 'Porque é que a varfarina tem tantas interações medicamentosas?',
    a: 'É metabolizada pelo CYP2C9 (S-varfarina, mais potente) e CYP3A4 (R-varfarina). Qualquer indutor/inibidor destes CYPs altera o INR. Além disso, antibióticos de largo espetro reduzem as bactérias intestinais produtoras de vitamina K, aumentando o efeito anticoagulante.',
  },
  {
    q: 'O que é o efeito de primeira passagem e qual o seu impacto clínico?',
    a: 'Metabolismo pré-sistémico na parede intestinal (CYP3A4 enterocitário) e no fígado. A morfina oral tem biodisponibilidade ~30% vs 100% IV. Fármacos com efeito de 1ª passagem elevado beneficiam de vias alternativas: sublingual, transdérmica, retal ou parentérica.',
  },
  {
    q: 'Para que serve a fórmula CKD-EPI e quando usá-la?',
    a: 'Estima a taxa de filtração glomerular (TFGe) a partir da creatinina sérica, idade e sexo. Mais precisa que a Cockcroft-Gault para TFGe >60 mL/min. Usada para estadiar DRC (KDIGO) e ajustar doses de fármacos eliminados por via renal: metformina, HBPM, dabigatrano, digoxina.',
  },
  {
    q: 'O que é a janela terapêutica estreita e por que razão é clinicamente relevante?',
    a: 'Intervalo entre concentração mínima eficaz (CME) e concentração mínima tóxica (CMT). Fármacos com janela estreita — varfarina, digoxina, lítio, fenitoína, aminoglicosídeos — requerem monitorização terapêutica (TDM) e ajuste frequente de dose para evitar toxicidade ou ineficácia.',
  },
  {
    q: 'O que são os critérios STOPP/START v2?',
    a: 'STOPP: 114 critérios de fármacos potencialmente inapropriados em idosos ≥65 anos (ex: BZD, AINEs, antihistamínicos de 1ª geração). START: 34 critérios de fármacos indicados mas frequentemente omitidos (ex: estatinas em doença cardiovascular estabelecida). Ferramentas validadas para revisão de medicação em idosos polimedicados.',
  },
  {
    q: 'O que determina a semi-vida de eliminação (t½)?',
    a: 't½ = 0,693 × Vd / CL — onde Vd é o volume de distribuição e CL o clearance total. Determina o intervalo de dosagem e o tempo para atingir estado estacionário (~5 semi-vidas). Fármacos com t½ longa (amiodarona ~50 dias) acumulam facilmente em insuficiência renal ou hepática.',
  },
  {
    q: 'Quais são as principais classes de interações farmacodinâmicas?',
    a: '1) Sinergismo aditivo: dois fármacos com o mesmo mecanismo (ex: dois IECA). 2) Sinergismo potenciador: mecanismos diferentes com efeito combinado superior (ex: amoxicilina + clavulanato). 3) Antagonismo: opiáceo + naloxona. 4) Efeitos opostos sobre o mesmo sistema (ex: anticoagulantes + vitamina K).',
  },
]

function StudentHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const cardIndex = new Date().getDate() % DAILY_FLASHCARDS.length
  const card = DAILY_FLASHCARDS[cardIndex]
  const [revealed, setRevealed] = useState(false)
  const color = '#7c3aed'
  const [streak, setStreak] = useState(0)
  const [xp, setXp] = useState(0)
  const [league, setLeague] = useState('Bronze')

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const raw = localStorage.getItem('phlox_study_dates')
    const dates: string[] = raw ? JSON.parse(raw) : []
    if (!dates.includes(today)) dates.push(today)
    localStorage.setItem('phlox_study_dates', JSON.stringify(dates))

    const sorted = [...new Set(dates)].sort().reverse()
    let s = 0
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date()
      expected.setDate(expected.getDate() - i)
      if (sorted[i] === expected.toISOString().split('T')[0]) s++
      else break
    }
    setStreak(s)

    const reveals = parseInt(localStorage.getItem('phlox_flashcard_reveals') || '0', 10)
    const totalXp = dates.length * 10 + reveals * 5
    setXp(totalXp)
    setLeague(totalXp >= 500 ? 'Diamante' : totalXp >= 200 ? 'Ouro' : totalXp >= 100 ? 'Prata' : 'Bronze')
  }, [])

  const handleReveal = () => {
    setRevealed(true)
    const reveals = parseInt(localStorage.getItem('phlox_flashcard_reveals') || '0', 10)
    localStorage.setItem('phlox_flashcard_reveals', String(reveals + 1))
    setXp(prev => {
      const next = prev + 5
      setLeague(next >= 500 ? 'Diamante' : next >= 200 ? 'Ouro' : next >= 100 ? 'Prata' : 'Bronze')
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff', paddingTop: 56 }}>

      {/* Hero — purple gradient */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #8b5cf6 100%)',
        padding: '32px 24px 28px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 5px',
            textTransform: 'capitalize',
          }}>
            {capitalise(dateStr())}
          </p>
          <h1 style={{
            fontSize: 30,
            fontWeight: 900,
            color: 'white',
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 🎓
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', margin: 0 }}>
            Cada dia de estudo conta — continua o bom trabalho.
          </p>
        </div>
      </div>

      {/* Progress mini-card — streak and XP are shown as "--" until real tables exist */}
      <div style={{
        background: `${color}0d`,
        borderBottom: `1px solid ${color}18`,
      }}>
        <div style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{streak > 0 ? `🔥${streak}` : '0'}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Streak</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{xp}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>XP</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em' }}>
                {league === 'Diamante' ? '💎' : league === 'Ouro' ? '🥇' : league === 'Prata' ? '🥈' : '🥉'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{league}</div>
            </div>
          </div>
          <Link href="/progresso" style={{
            fontSize: 12,
            color,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Ver progresso →
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* FLASHCARD DO DIA */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            <Link href="/study" style={{
              fontSize: 12,
              color,
              fontWeight: 700,
              textDecoration: 'none',
            }}>
              Mais flashcards →
            </Link>
          }>
            Flashcard do dia
          </SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '24px',
            border: `1px solid ${color}1a`,
            boxShadow: `0 4px 20px ${color}0c`,
          }}>
            {/* Question */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              marginBottom: 20,
            }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `${color}10`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}>
                ❓
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.65,
              }}>
                {card.q}
              </div>
            </div>

            {/* Answer / reveal */}
            {revealed ? (
              <>
                <div style={{
                  background: `${color}07`,
                  border: `1px solid ${color}22`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 10,
                  padding: '16px 18px',
                  fontSize: 13,
                  color: '#3b0764',
                  lineHeight: 1.8,
                  marginBottom: 14,
                }}>
                  {card.a}
                </div>
                <button
                  onClick={() => setRevealed(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: `1px solid ${color}25`,
                    borderRadius: 8,
                    color,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ← Esconder resposta
                </button>
              </>
            ) : (
              <button
                onClick={handleReveal}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: color,
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}
              >
                Revelar resposta (+5 XP)
              </button>
            )}
          </div>
        </section>

        {/* FERRAMENTAS DE ESTUDO */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas de estudo</SectionLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 155px), 1fr))',
            gap: 10,
          }}>
            {MODE_QUICK_ACTIONS.student.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* ARENA E SIMULAÇÃO */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Arena e simulação</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard
              href="/arena"
              icon="🏆"
              label="Arena"
              desc="Ligas Bronze → Diamante — compete e aprende"
              color={color}
            />
            <BigLinkCard
              href="/simulador"
              icon="🎮"
              label="Simulador Clínico"
              desc="Casos clínicos interativos com IA"
              color="#5b21b6"
            />
          </div>
        </section>

        {/* OSCE SIMULAÇÃO */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Simulação de exame</SectionLabel>
          <div style={{
            background: `linear-gradient(135deg, ${color}10 0%, #ede9fe 100%)`,
            border: `1px solid ${color}20`,
            borderRadius: 16,
            padding: '22px',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 38, flexShrink: 0 }}>🎯</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#4c1d95',
                  marginBottom: 6,
                }}>
                  OSCE — Simulação de doente
                </div>
                <div style={{
                  fontSize: 13,
                  color: '#5b21b6',
                  lineHeight: 1.7,
                  marginBottom: 18,
                }}>
                  A inteligência artificial interpreta o papel de doente. Tu conduzes a consulta:
                  anamnese, avaliação da medicação, aconselhamento. Ideal para preparação de exames práticos.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Link href="/osce" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: color,
                    color: 'white',
                    padding: '11px 22px',
                    borderRadius: 11,
                    fontSize: 13,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}>
                    Iniciar sessão OSCE →
                  </Link>
                  <Link href="/simulador" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'white',
                    color,
                    padding: '11px 18px',
                    borderRadius: 11,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    border: `1px solid ${color}30`,
                  }}>
                    Simulador clínico
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI TUTOR BANNER */}
        <section style={{ marginBottom: 32 }}>
          <Link href="/tutor" style={{ display: 'block', textDecoration: 'none' }} className="tutor-banner">
            <div style={{
              background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
              borderRadius: 16,
              padding: '22px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 54,
                height: 54,
                borderRadius: 15,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 5,
                }}>
                  Aprendizagem adaptativa
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'white',
                  marginBottom: 5,
                  letterSpacing: '-0.02em',
                }}>
                  AI Tutor
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
                  Tira qualquer dúvida farmacológica ou clínica — explicações passo a passo.
                </div>
              </div>
              <ArrowRight />
            </div>
          </Link>
        </section>

        {/* FERRAMENTAS CLÍNICAS PARA ESTUDO */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas clínicas</SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              {
                href: '/calculators',
                icon: '🔢',
                label: 'Calculadoras clínicas',
                desc: 'SCORE2, CKD-EPI, TFG, doses pediátricas',
              },
              {
                href: '/interactions',
                icon: '🔍',
                label: 'Verificar interações',
                desc: 'Treina com casos reais de interações',
              },
              {
                href: '/bula',
                icon: '📄',
                label: 'Perceber bulas',
                desc: 'Cola qualquer bula — explicação simples',
              },
              {
                href: '/ai',
                icon: '🤖',
                label: 'Phlox AI',
                desc: 'Qualquer dúvida farmacológica ou clínica',
              },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="clin-row">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: `${color}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <ChevronRight />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* COMUNIDADE */}
        <section>
          <SectionLabel>Comunidade e Arena</SectionLabel>
          <div style={{
            background: 'white',
            borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Convida colegas para a Arena
            </div>
            <div style={{
              fontSize: 13,
              color: '#64748b',
              lineHeight: 1.7,
              marginBottom: 18,
            }}>
              Compete em ligas com colegas de curso, compara conhecimentos e aprende com os
              melhores na tua área. As ligas reiniciam semanalmente.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link href="/arena" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 10,
                background: color,
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}>
                Ir para a Arena →
              </Link>
              <Link href="/progresso" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'white',
                color,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${color}2a`,
              }}>
                Ver progresso
              </Link>
            </div>
          </div>
        </section>

      </div>

      <style>{`
        .tool-card-link > div:hover  { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-link-card > div:hover   { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.09) !important; }
        .tutor-banner > div:hover    { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(124,58,237,0.3) !important; }
        .clin-row > div:hover        { background: #f8fafc !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── InicioPage — default export ──────────────────────────────────────────────

export default function InicioPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user && !(user as any).onboarded) {
      router.push('/onboarding')
    }
  }, [user, loading, router])

  if (loading) return <LoadingScreen />
  if (!user) return <RedirectToLogin />

  const mode = user.experience_mode || 'personal'
  if (mode === 'caregiver') return <CaregiverHome user={user} />
  if (mode === 'clinical') return <ClinicalHome user={user} />
  if (mode === 'student') return <StudentHome user={user} />
  return <PersonalHome user={user} />
}
