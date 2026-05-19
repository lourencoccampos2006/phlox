'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MODE_QUICK_ACTIONS } from '@/lib/navigation'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 19) return 'Boa tarde'
  return 'Boa noite'
}

function dateStr() {
  return new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Shared ToolCard ──────────────────────────────────────────────────────────

function ToolCard({
  href, icon, label, desc, color,
}: {
  href: string; icon: string; label: string; desc: string; color: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="ic-card">
      <div style={{
        background: 'white', borderRadius: 14, padding: '16px',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 96,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

// ─── BigLinkCard ──────────────────────────────────────────────────────────────

function BigLinkCard({
  href, icon, label, desc, color,
}: {
  href: string; icon: string; label: string; desc: string; color: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', flex: '1 1 0' }} className="big-card">
      <div style={{
        background: 'white', borderRadius: 16, padding: '22px 18px',
        border: `1px solid ${color}25`,
        display: 'flex', flexDirection: 'column', gap: 8,
        transition: 'transform 0.12s, box-shadow 0.12s',
        height: '100%', boxSizing: 'border-box',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
        <div style={{ marginTop: 'auto', fontSize: 12, color: color, fontWeight: 700 }}>Abrir →</div>
      </div>
    </Link>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  return (
    <div style={{
      background: 'white', borderRadius: 16, padding: '36px',
      border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid #e2e8f0', borderTopColor: color,
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({
  children, right,
}: {
  children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </div>
      {right}
    </div>
  )
}

// ─── PersonalHome ─────────────────────────────────────────────────────────────

function PersonalHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [meds, setMeds] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [vitals, setVitals] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const firstName = user?.name?.split(' ')[0] || ''
  const today = todayStr()
  const now = nowTimeStr()
  const color = '#0d9488'

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase
        .from('personal_meds')
        .select('id,name,dose,frequency,reminder_times')
        .eq('user_id', user.id)
        .order('name'),
      supabase
        .from('med_logs')
        .select('med_id,status,logged_at')
        .eq('user_id', user.id)
        .eq('date', today),
      supabase
        .from('vitals')
        .select('type,value,unit,measured_at')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(5),
    ]).then(([{ data: m }, { data: l }, { data: v }]) => {
      setMeds(m ?? [])
      setLogs(l ?? [])
      setVitals(v ?? [])
      setLoadingData(false)
    })
  }, [user, supabase, today])

  const takenIds = new Set(logs.filter(l => l.status === 'taken').map(l => l.med_id))
  const totalSlots = meds.reduce((acc, m) => acc + (Array.isArray(m.reminder_times) ? m.reminder_times.length : 1), 0)
  const takenCount = meds.filter(m => takenIds.has(m.id)).length
  const pct = totalSlots > 0 ? Math.round((takenCount / totalSlots) * 100) : 0

  // Build upcoming doses timeline (times >= now today)
  type UpcomingDose = { time: string; medName: string }
  const upcomingDoses: UpcomingDose[] = []
  meds.forEach(m => {
    if (Array.isArray(m.reminder_times)) {
      m.reminder_times.forEach((t: string) => {
        if (t >= now && !takenIds.has(m.id)) {
          upcomingDoses.push({ time: t, medName: m.name })
        }
      })
    }
  })
  upcomingDoses.sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>
      {/* Greeting banner — colored gradient */}
      <div style={{ background: `linear-gradient(135deg, ${color} 0%, #0891b2 100%)`, padding: '32px 24px 30px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'white', margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', margin: 0 }}>
            {meds.length > 0
              ? `Tens ${totalSlots} dose${totalSlots !== 1 ? 's' : ''} agendada${totalSlots !== 1 ? 's' : ''} para hoje.`
              : 'A tua saúde, organizada num só lugar.'}
          </p>
        </div>
      </div>

      {/* Próxima dose banner — destaque */}
      {!loadingData && upcomingDoses.length > 0 && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: '#fde68a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>⏰</div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                Próxima toma
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#78350f' }}>
                {upcomingDoses[0].time} — {upcomingDoses[0].medName}
              </div>
            </div>
            <Link href="/mymeds" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '11px 20px', borderRadius: 28,
              background: '#d97706', color: 'white',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Registar toma
            </Link>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Section 2 — Medicamentos hoje */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            meds.length > 0 && (
              <Link href="/mymeds" style={{ fontSize: 13, color: color, fontWeight: 700, textDecoration: 'none' }}>
                Ver todos →
              </Link>
            )
          }>
            Os teus medicamentos hoje
          </SectionLabel>

          {loadingData ? (
            <Spinner color={color} />
          ) : meds.length === 0 ? (
            <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white', borderRadius: 16, padding: '40px 24px',
                border: '2px dashed #e2e8f0', textAlign: 'center',
              }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>💊</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Ainda não tens medicamentos
                </div>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
                  Adiciona os teus medicamentos e o Phlox lembra-te quando é hora de tomar.
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '13px 26px', borderRadius: 28, background: color, color: 'white',
                  fontSize: 15, fontWeight: 800,
                }}>
                  + Adicionar medicamento
                </div>
              </div>
            </Link>
          ) : (
            <div style={{
              background: 'white', borderRadius: 16, padding: '22px 22px',
              border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              {/* Progress header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                    Tomados hoje
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {takenCount}
                    <span style={{ fontSize: 18, fontWeight: 500, color: '#94a3b8' }}> de {totalSlots}</span>
                  </div>
                </div>
                <div style={{
                  width: 62, height: 62,
                  borderRadius: '50%',
                  background: `conic-gradient(${pct === 100 ? '#059669' : pct >= 70 ? color : '#f59e0b'} ${pct * 3.6}deg, #f1f5f9 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', background: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900,
                    color: pct === 100 ? '#059669' : pct >= 70 ? color : '#f59e0b',
                  }}>
                    {pct}%
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: pct === 100 ? '#059669' : pct >= 70 ? color : '#f59e0b',
                  borderRadius: 4, transition: 'width 0.5s ease',
                }} />
              </div>

              {/* Med list — bigger, accessible */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {meds.slice(0, 6).map(m => {
                  const taken = takenIds.has(m.id)
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px', borderRadius: 12,
                      background: taken ? '#f0fdf4' : '#f8fafc',
                      border: `1.5px solid ${taken ? '#86efac' : '#e2e8f0'}`,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        border: `2.5px solid ${taken ? '#059669' : '#cbd5e1'}`,
                        background: taken ? '#059669' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s',
                      }}>
                        {taken && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: 15,
                          color: taken ? '#059669' : '#0f172a',
                          fontWeight: taken ? 500 : 700,
                          textDecoration: taken ? 'line-through' : 'none',
                        }}>
                          {m.name}
                        </span>
                        {m.dose && (
                          <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 7 }}>{m.dose}</span>
                        )}
                      </div>
                      {taken && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0 }}>✓ Tomado</span>
                      )}
                    </div>
                  )
                })}
                {meds.length > 6 && (
                  <Link href="/mymeds" style={{
                    fontSize: 13, color: color, fontWeight: 700, textDecoration: 'none',
                    textAlign: 'center', padding: '8px 0', display: 'block',
                  }}>
                    Ver mais {meds.length - 6} medicamentos →
                  </Link>
                )}
              </div>

              {/* Go to mymeds CTA */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                <Link href="/mymeds" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px 0', borderRadius: 12,
                  background: `${color}10`, border: `1.5px solid ${color}30`,
                  color: color, fontSize: 14, fontWeight: 700, textDecoration: 'none',
                }}>
                  Gerir os meus medicamentos →
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Section 3 — Próximas tomas (timeline) */}
        {upcomingDoses.length > 1 && (
          <section style={{ marginBottom: 32 }}>
            <SectionLabel>Horário de hoje</SectionLabel>
            <div style={{
              background: 'white', borderRadius: 16, padding: '6px 4px',
              border: '1px solid #f1f5f9',
            }}>
              {upcomingDoses.slice(0, 6).map((dose, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px',
                  borderBottom: i < Math.min(upcomingDoses.length, 6) - 1 ? '1px solid #f8fafc' : 'none',
                }}>
                  <div style={{
                    minWidth: 50, fontSize: 15, fontWeight: 800, color: color,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {dose.time}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', flex: 1 }}>
                    {dose.medName}
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: `${color}50`, flexShrink: 0,
                  }} />
                </div>
              ))}
              {upcomingDoses.length > 6 && (
                <div style={{ padding: '10px 16px', fontSize: 13, color: '#94a3b8' }}>
                  +{upcomingDoses.length - 6} tomas mais tarde
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 4 — Sinais vitais */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            <Link href="/vitals" style={{
              fontSize: 13, color: '#e11d48', fontWeight: 700, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 20, background: '#fff1f2', border: '1px solid #fecdd3',
            }}>
              + Registar medição
            </Link>
          }>
            Sinais vitais
          </SectionLabel>

          {loadingData ? (
            <Spinner color={color} />
          ) : vitals.length === 0 ? (
            <Link href="/vitals" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white', borderRadius: 16, padding: '36px 24px',
                border: '2px dashed #fecdd3', textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>❤️</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                  Regista os teus sinais vitais
                </div>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 18, lineHeight: 1.6 }}>
                  Tensão arterial, pulso, peso... acompanha a tua saúde ao longo do tempo.
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '12px 24px', borderRadius: 28, background: '#e11d48', color: 'white',
                  fontSize: 14, fontWeight: 800,
                }}>
                  Começar agora →
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
              {vitals.map((v, i) => (
                <Link key={i} href="/vitals" style={{ textDecoration: 'none' }} className="ic-card">
                  <div style={{
                    background: 'white', borderRadius: 14, padding: '16px 18px',
                    border: '1px solid #fce7f3',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>
                      {v.type === 'Tensão' ? '🩺' : v.type === 'Pulso' ? '💓' : v.type === 'Peso' ? '⚖️' : v.type === 'Glicemia' ? '🩸' : '📊'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                      {v.type || 'Medição'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                      {v.value}
                      {v.unit && <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}> {v.unit}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 5 }}>
                      {new Date(v.measured_at).toLocaleDateString('pt-PT')}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Section 5 — Ferramentas */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>O que queres fazer?</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.personal.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* Section 6 — Acesso rápido */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Acesso rápido</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard href="/ai"           icon="🤖" label="Phlox AI"    desc="Qualquer dúvida de saúde" color="#0d9488" />
            <BigLinkCard href="/interactions" icon="🔍" label="Verificar"   desc="Interações medicamentosas" color="#e11d48" />
            <BigLinkCard href="/passport"     icon="🆘" label="Passaporte"  desc="QR code de emergência" color="#f59e0b" />
          </div>
        </section>

        {/* Section 7 — AI assistente rápido */}
        <section style={{ marginBottom: 32 }}>
          <Link href="/ai" style={{ display: 'block', textDecoration: 'none' }} className="ai-banner">
            <div style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
              borderRadius: 20, padding: '28px 26px',
              display: 'flex', alignItems: 'center', gap: 20,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0,
              }}>
                🤖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Farmacêutico virtual 24h
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 6, lineHeight: 1.2 }}>
                  Phlox AI
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>
                  Podes perguntar qualquer coisa sobre os teus medicamentos, interações ou saúde.
                </div>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          </Link>
        </section>

        {/* Section 8 — Verificação de segurança */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Segurança da medicação</SectionLabel>
          <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              { href: '/interactions', icon: '🔍', label: 'Verificar interações', desc: 'Os meus medicamentos são seguros juntos?' },
              { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',   desc: 'O que não devo comer com estes meds?' },
              { href: '/schedule',     icon: '⏰', label: 'Horário inteligente',  desc: 'A que horas devo tomar cada medicamento?' },
              { href: '/bula',         icon: '📄', label: 'Perceber uma bula',    desc: 'O que significa este texto técnico?' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="sec-row">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13,
                    background: `${color}10`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{item.desc}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 9 — Objetivos e progresso */}
        <section>
          <SectionLabel right={<Link href="/objetivos" style={{ fontSize: 13, color: color, fontWeight: 700, textDecoration: 'none' }}>Ver todos →</Link>}>
            Objetivos de saúde
          </SectionLabel>
          <Link href="/objetivos" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: '28px 24px',
              border: '2px dashed #e2e8f0', textAlign: 'center',
              transition: 'border-color 0.12s',
            }} className="goals-empty">
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Define objetivos de saúde</div>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: 18, lineHeight: 1.6 }}>
                Controla a tua tensão, peso ou açúcar no sangue. O Phlox acompanha o teu progresso.
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '11px 22px', borderRadius: 28, background: `${color}12`,
                color: color, fontSize: 14, fontWeight: 800,
              }}>Definir primeiro objetivo →</span>
            </div>
          </Link>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover  { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-card > div:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09) !important; }
        .ai-banner > div:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(13,148,136,0.35) !important; }
        .sec-row > div:hover  { background:#f8fafc !important; }
        .goals-empty:hover    { border-color:${color} !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── CaregiverHome ────────────────────────────────────────────────────────────

function CaregiverHome({ user }: { user: any }) {
  const { supabase } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [medCounts, setMedCounts] = useState<Record<string, number>>({})
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const firstName = user?.name?.split(' ')[0] || ''
  const color = '#b45309'
  const bgColor = '#fffbeb'

  useEffect(() => {
    if (!user?.id) return
    setLoadingProfiles(true)
    ;(async () => {
      try {
        const { data: p, error: pe } = await supabase
          .from('family_profiles')
          .select('id,name,relation,age,avatar,date_of_birth,allergies')
          .eq('user_id', user.id)
          .order('name')
        if (pe) console.error('[CaregiverHome] family_profiles error:', pe)
        setProfiles(p ?? [])

        const { data: m, error: me } = await supabase
          .from('family_profile_meds')
          .select('profile_id')
          .in('profile_id', (p ?? []).map((x: any) => x.id))
        if (me) console.error('[CaregiverHome] family_profile_meds error:', me)
        const counts: Record<string, number> = {}
        ;(m ?? []).forEach((row: any) => {
          counts[row.profile_id] = (counts[row.profile_id] || 0) + 1
        })
        setMedCounts(counts)
      } catch (err) {
        console.error('[CaregiverHome] unexpected error:', err)
      } finally {
        setLoadingProfiles(false)
      }
    })()
  }, [user?.id])

  function getInitials(name: string) {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
  }

  function calcAge(dob: string | null, age: number | null) {
    if (age != null) return age
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  }

  return (
    <div style={{ minHeight: '100vh', background: bgColor, paddingTop: 56 }}>
      {/* Greeting banner */}
      <div style={{ background: 'white', borderBottom: '1px solid #fde68a', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 11px', borderRadius: 20, background: '#fef3c7',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cuidador Familiar
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Section 2 — A minha família */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            profiles.length > 0 && (
              <Link href="/perfis" style={{ fontSize: 12, color: color, fontWeight: 600, textDecoration: 'none' }}>
                Gerir perfis →
              </Link>
            )
          }>
            A minha família
          </SectionLabel>

          {loadingProfiles ? (
            <Spinner color={color} />
          ) : profiles.length === 0 ? (
            <Link href="/perfis" style={{ display: 'block', textDecoration: 'none' }}>
              <div style={{
                background: 'white', borderRadius: 16, padding: '40px 24px',
                border: '2px dashed #fde68a', textAlign: 'center',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Nenhum familiar adicionado
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
                  Adicione perfis para gerir a medicação<br />e saúde de cada familiar
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10,
                  background: color, color: 'white',
                  fontSize: 13, fontWeight: 700,
                }}>
                  + Adicionar primeiro perfil
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 175px), 1fr))', gap: 10 }}>
              {profiles.map(p => {
                const age = calcAge(p.date_of_birth, p.age)
                const medCount = medCounts[p.id] || 0
                return (
                  <Link key={p.id} href={`/perfil/${p.id}`} style={{ textDecoration: 'none' }} className="ic-card">
                    <div style={{
                      background: 'white', borderRadius: 14, padding: '18px',
                      border: '1px solid rgba(0,0,0,0.06)',
                      transition: 'transform 0.12s, box-shadow 0.12s',
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%',
                        background: '#fef3c7', border: `2px solid ${color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: p.avatar ? 22 : 15, fontWeight: 700,
                        color: color, marginBottom: 12, overflow: 'hidden',
                      }}>
                        {p.avatar
                          ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitials(p.name)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{p.name}</div>
                      {p.relation && (
                        <div style={{ fontSize: 11, color: color, fontWeight: 600, marginBottom: 2 }}>{p.relation}</div>
                      )}
                      {age != null && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{age} anos</div>
                      )}
                      {medCount > 0 && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          marginTop: 8, padding: '2px 8px', borderRadius: 10,
                          background: '#fef3c7',
                          fontSize: 11, fontWeight: 700, color: color,
                        }}>
                          💊 {medCount} med{medCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
              {/* Add profile card */}
              <Link href="/perfis" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'white', borderRadius: 14, padding: '18px',
                  border: '2px dashed #fde68a',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  minHeight: 140, cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }} className="add-profile-card">
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#fef3c7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, marginBottom: 8,
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

        {/* Section 3 — Verificação rápida */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Verificação rápida</SectionLabel>
          <Link href="/interactions" style={{ display: 'block', textDecoration: 'none' }}>
            <div style={{
              background: `linear-gradient(135deg, ${color}15 0%, #fef3c7 100%)`,
              border: `1px solid ${color}30`,
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }} className="ic-card-inner">
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `${color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
              }}>
                🔍
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                  Verifique as interações da medicação
                </div>
                <div style={{ fontSize: 13, color: '#78716c', lineHeight: 1.5 }}>
                  Confirme que os medicamentos dos seus familiares são seguros em conjunto
                </div>
              </div>
              <div style={{ fontSize: 22, color: color, flexShrink: 0 }}>→</div>
            </div>
          </Link>
        </section>

        {/* Section 4 — Ferramentas */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.caregiver.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* Section 5 — Emergência */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Emergência e documentos</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard href="/passport" icon="🆘" label="Passaporte de Saúde" desc="Documento completo + QR de emergência" color={color} />
            <BigLinkCard href="/bula"     icon="📄" label="Perceber a Bula"     desc="Texto técnico em linguagem simples" color="#64748b" />
          </div>
        </section>

        {/* Section 6 — Verificação de interações familiares */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Segurança da medicação familiar</SectionLabel>
          <Link href="/interactions" style={{ display: 'block', textDecoration: 'none' }} className="inter-banner">
            <div style={{
              background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
              borderRadius: 16, padding: '20px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>🔍</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 4 }}>Verificar interações</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  Verifica se os medicamentos dos teus familiares são seguros juntos. Cobre milhares de combinações.
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </Link>
        </section>

        {/* Section 7 — Mais ferramentas */}
        <section>
          <SectionLabel right={<Link href="/ferramentas" style={{ fontSize: 12, color, fontWeight: 600, textDecoration: 'none' }}>Ver todas →</Link>}>
            Mais ferramentas
          </SectionLabel>
          <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',    desc: 'O que não misturar com a medicação' },
              { href: '/schedule',     icon: '⏰', label: 'Horário inteligente',   desc: 'IA cria o horário perfeito' },
              { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',   desc: 'Critérios STOPP/START e genéricos' },
              { href: '/labs',         icon: '🧪', label: 'Perceber análises',     desc: 'O que cada valor significa' },
              { href: '/ai',           icon: '🤖', label: 'Phlox AI',              desc: 'Farmacêutico virtual 24h' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="more-row">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover       { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        .ic-card-inner:hover       { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-card > div:hover      { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09) !important; }
        .add-profile-card:hover    { border-color:#b45309 !important; }
        .inter-banner > div:hover  { transform:translateY(-2px); box-shadow:0 8px 24px rgba(180,83,9,0.3) !important; }
        .more-row > div:hover      { background:#f8fafc !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
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

  const h = new Date().getHours()
  const shiftLabel =
    h < 8 ? 'Turno Noite (00:00–08:00)' :
    h < 20 ? 'Turno Dia (08:00–20:00)' :
    'Turno Noite (20:00–08:00)'

  useEffect(() => {
    if (!user?.id) return
    setLoadingPatients(true)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('id,name,age,sex,conditions,updated_at,room,alerts_count')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(8)
        if (error) console.error('[ClinicalHome] patients error:', error)
        setPatients(data ?? [])
      } catch (err) {
        console.error('[ClinicalHome] unexpected error:', err)
      } finally {
        setLoadingPatients(false)
      }
    })()
  }, [user?.id])

  function truncateConditions(conditions: string[] | string | null) {
    if (!conditions) return ''
    const arr = Array.isArray(conditions) ? conditions : [conditions]
    if (arr.length === 0) return ''
    const first = arr.slice(0, 2).join(', ')
    return arr.length > 2 ? `${first} +${arr.length - 2}` : first
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* Section 1 — Shift banner */}
      <div style={{ background: '#0f172a', padding: '28px 24px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{
                fontSize: 11, color: '#475569', margin: '0 0 6px',
                fontFamily: 'monospace', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {shiftLabel}
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
                {greeting()}{firstName ? `, ${firstName}` : ''} 👋
              </h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', textTransform: 'capitalize' }}>
                {dateStr()}
              </p>
            </div>
            {/* Patient count stat card */}
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '12px 18px', textAlign: 'center',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: '-0.03em' }}>
                {loadingPatients ? '–' : patients.length}
              </div>
              <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Doentes
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Section 2 — Ferramentas clínicas */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas clínicas</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.clinical.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* Section 3 — Doentes */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel right={
            <Link href="/patients" style={{ fontSize: 12, color: color, fontWeight: 600, textDecoration: 'none' }}>
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
                background: 'white', borderRadius: 14, padding: '36px 24px',
                border: '2px dashed #dbeafe', textAlign: 'center',
              }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  Nenhum doente registado
                </div>
                <div style={{ fontSize: 13, color: color, fontWeight: 600 }}>
                  Adicionar primeiro doente →
                </div>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {patients.map(p => {
                const conditionsStr = truncateConditions(p.conditions)
                const alerts = p.alerts_count || 0
                return (
                  <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }} className="patient-row">
                    <div style={{
                      background: 'white', borderRadius: 12, padding: '13px 18px',
                      border: '1px solid rgba(0,0,0,0.06)',
                      display: 'flex', alignItems: 'center', gap: 14,
                      transition: 'transform 0.12s, box-shadow 0.12s',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${color}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0, fontWeight: 700, color: color,
                      }}>
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                          {[p.age ? `${p.age} anos` : null, p.sex].filter(Boolean).join(' · ')}
                          {conditionsStr && ` · ${conditionsStr}`}
                        </div>
                      </div>
                      {alerts > 0 && (
                        <div style={{
                          background: '#fef2f2', borderRadius: 6,
                          padding: '2px 9px', fontSize: 11, fontWeight: 700, color: '#dc2626',
                          flexShrink: 0,
                        }}>
                          {alerts} alerta{alerts !== 1 ? 's' : ''}
                        </div>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Section 4 — Ferramentas de verificação */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas de verificação</SectionLabel>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <BigLinkCard href="/interactions"  icon="🔍" label="Interações"    desc="Mecanismo e evidência clínica" color={color} />
            <BigLinkCard href="/reconciliacao" icon="🔄" label="Reconciliação" desc="Admissão vs. esquema atual" color="#0f766e" />
          </div>
        </section>

        {/* Section 5 — Oracle AI */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Assistente clínico</SectionLabel>
          <Link href="/oracle" style={{ display: 'block', textDecoration: 'none' }} className="oracle-banner">
            <div style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
              borderRadius: 16, padding: '22px 24px',
              display: 'flex', alignItems: 'center', gap: 18,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, flexShrink: 0,
              }}>🤖</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4 }}>Oracle AI</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.55 }}>
                  IA clínica especializada em SOAP farmacêutico. Gera intervenções e plano de cuidados em segundos.
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </Link>
        </section>

        {/* Section 6 — Mais ferramentas clínicas */}
        <section>
          <SectionLabel right={<Link href="/ferramentas" style={{ fontSize: 12, color, fontWeight: 600, textDecoration: 'none' }}>Ver todas →</Link>}>
            Mais ferramentas clínicas
          </SectionLabel>
          <div style={{
            background: 'white', borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {[
              { href: '/calculators',   icon: '🔢', label: 'Calculadoras',    desc: 'SCORE2, CKD-EPI, TFG, doses' },
              { href: '/adr-report',    icon: '⚠️', label: 'Notificação RAM', desc: 'WHO-UMC e INFARMED' },
              { href: '/mar',           icon: '📝', label: 'MAR',             desc: 'Registo de administração' },
              { href: '/rounds',        icon: '📋', label: 'Ronda',           desc: 'PCNE e intervenções farmacêuticas' },
              { href: '/dilutions',     icon: '🧫', label: 'Diluições IV',    desc: 'Cálculo de diluições intravenosas' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="clin-row">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .ic-card > div:hover       { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-card > div:hover      { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09) !important; }
        .patient-row > div:hover   { transform:translateX(3px) !important; box-shadow:0 2px 12px rgba(0,0,0,0.06) !important; }
        .oracle-banner > div:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(37,99,235,0.3) !important; }
        .clin-row > div:hover      { background:#f8fafc !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── StudentHome ──────────────────────────────────────────────────────────────

// Flashcards: educational pharmacology content, not user data — intentionally static.
const FLASHCARDS = [
  {
    q: 'Qual o mecanismo principal das estatinas?',
    a: 'Inibição competitiva da HMG-CoA redutase → ↓ síntese hepática de colesterol → ↑ expressão de LDL-R → ↓ LDL plasmático. Em parallelo, efeitos pleiotrópicos: anti-inflamatórios, estabilização de placa e melhoria da função endotelial.',
  },
  {
    q: 'Porque é que a varfarina tem tantas interações?',
    a: 'Metabolizada pelo CYP2C9 (S-varfarina, mais potente) e CYP3A4 (R-varfarina). Qualquer indutor ou inibidor destes CYPs altera o INR. Adicionalmente, fármacos que afetam vitamina K (antibióticos de largo espetro) ou a função plaquetária aumentam o risco hemorrágico.',
  },
  {
    q: 'O que é o efeito de primeira passagem?',
    a: 'Metabolismo pré-sistémico que ocorre na parede intestinal (CYP3A4 enterocitário) e no fígado antes de o fármaco atingir a circulação sistémica. A morfina oral tem biodisponibilidade ~25–35% vs 100% IV. Fármacos com elevado efeito de 1ª passagem beneficiam de vias alternativas (sublingual, transdérmica, rectal).',
  },
  {
    q: 'Para que serve a fórmula CKD-EPI?',
    a: 'Estima a taxa de filtração glomerular (TFG) a partir da creatinina sérica, idade, sexo e raça. Mais precisa que a Cockcroft-Gault para TFG >60 mL/min. Usada para estadiar DRC e calcular doses de fármacos eliminados por via renal (ex: metformina, HBPM, dabigatrano).',
  },
  {
    q: 'O que é a janela terapêutica?',
    a: 'Intervalo de concentrações plasmáticas entre a dose mínima eficaz (MEC) e a dose mínima tóxica (MTC). Fármacos com janela estreita (varfarina, digoxina, lítio, aminoglicosídeos) requerem monitorização terapêutica (TDM) e ajuste de dose frequente.',
  },
  {
    q: 'O que são critérios STOPP/START v2?',
    a: 'STOPP (Screening Tool of Older Persons Prescriptions): 114 critérios de fármacos potencialmente inapropriados em idosos ≥65 anos. START (Screening Tool to Alert doctors to Right Treatment): 34 critérios de fármacos indicados mas frequentemente omitidos. Ferramentas validadas para revisão de medicação em idosos polimedicados.',
  },
  {
    q: 'O que determina a semi-vida de eliminação?',
    a: 't½ = 0,693 × Vd / CL. Onde Vd é o volume de distribuição e CL o clearance. Determina o intervalo de dosagem adequado e o tempo para atingir estado de equilíbrio (~5 semividas). Fármacos com t½ longa acumulam mais facilmente em insuficiência renal/hepática.',
  },
]

function StudentHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const card = FLASHCARDS[new Date().getDate() % FLASHCARDS.length]
  const [revealed, setRevealed] = useState(false)
  const color = '#7c3aed'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff', paddingTop: 56 }}>

      {/* Purple gradient banner */}
      <div style={{
        background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #8b5cf6 100%)',
        padding: '28px 24px 26px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 4px', textTransform: 'capitalize' }}>
            {dateStr()}
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 🎓
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '8px 0 0' }}>
            Continuação da aprendizagem — cada dia conta
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* Section 1 — Flashcard do dia */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Flashcard do dia</SectionLabel>
          <div style={{
            background: 'white', borderRadius: 16, padding: '24px',
            border: `1px solid ${color}20`,
            boxShadow: `0 4px 20px ${color}10`,
          }}>
            {/* Question */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `${color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                ❓
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.6 }}>
                {card.q}
              </div>
            </div>

            {/* Answer or reveal button */}
            {revealed ? (
              <div style={{
                background: `${color}08`,
                border: `1px solid ${color}25`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 10, padding: '16px 18px',
                fontSize: 13, color: '#4c1d95', lineHeight: 1.75,
              }}>
                {card.a}
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                style={{
                  width: '100%', padding: '13px',
                  background: color, border: 'none',
                  borderRadius: 11, color: 'white',
                  fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}>
                Revelar resposta
              </button>
            )}

            {revealed && (
              <button
                onClick={() => setRevealed(false)}
                style={{
                  marginTop: 12, padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${color}30`,
                  borderRadius: 8, color: color,
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ← Esconder resposta
              </button>
            )}
          </div>
        </section>

        {/* Section 2 — Ferramentas de estudo */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas de estudo</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
            {MODE_QUICK_ACTIONS.student.map(a => (
              <ToolCard key={a.href} {...a} color={color} />
            ))}
          </div>
        </section>

        {/* Section 3 — Arena & Simulação */}
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

        {/* Section 4 — Recursos */}
        <section>
          <SectionLabel>Recursos</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
            {[
              { href: '/study',     icon: '🃏', label: 'Flashcards',  desc: '200+ tópicos de farmacologia' },
              { href: '/osce',      icon: '🎯', label: 'OSCE',        desc: 'AI como doente — exame simulado' },
              { href: '/tutor',     icon: '🤖', label: 'AI Tutor',    desc: 'Explicações passo a passo' },
            ].map(r => (
              <Link key={r.href} href={r.href} style={{ textDecoration: 'none' }} className="ic-card">
                <div style={{
                  background: 'white', borderRadius: 12, padding: '16px',
                  border: `1px solid ${color}15`,
                  display: 'flex', flexDirection: 'column', gap: 9,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${color}10`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {r.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{r.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 5 — Simulação OSCE */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Simulação de exame</SectionLabel>
          <div style={{
            background: `linear-gradient(135deg, ${color}12 0%, #ede9fe 100%)`,
            border: `1px solid ${color}25`,
            borderRadius: 16, padding: '22px',
            display: 'flex', gap: 16, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 36, flexShrink: 0 }}>🎯</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#4c1d95', marginBottom: 6 }}>
                OSCE — Simulação de doente
              </div>
              <div style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.65, marginBottom: 16 }}>
                A inteligência artificial interpreta o papel de doente. Tu conduzes a consulta: anamnese,
                avaliação da medicação, aconselhamento. Ideal para preparação de exames práticos.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Link href="/osce" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: color, color: 'white', padding: '10px 20px',
                  borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  Iniciar sessão OSCE
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/simulador" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'white', color: color, padding: '10px 18px',
                  borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  border: `1px solid ${color}30`,
                }}>
                  Simulador clínico
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 — Progresso e conquistas */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Evolução e conquistas</SectionLabel>
          <Link href="/progresso" style={{ textDecoration: 'none' }} className="big-card">
            <div style={{
              background: `linear-gradient(135deg, ${color} 0%, #5b21b6 100%)`,
              borderRadius: 16, padding: '24px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
                  Painel de progresso
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.03em' }}>
                  XP, streak e ligas
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
                  Acompanha a tua evolução e compara com colegas na Liga
                </div>
              </div>
              <div style={{ fontSize: 52, flexShrink: 0 }}>📈</div>
            </div>
          </Link>
        </section>

        {/* Section 7 — Ferramentas clínicas */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel>Ferramentas clínicas</SectionLabel>
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden',
          }}>
            {[
              { href: '/calculators',  icon: '🔢', label: 'Calculadoras clínicas',  desc: 'SCORE2, CKD-EPI, TFG, doses pediátricas' },
              { href: '/interactions', icon: '🔍', label: 'Verificar interações',   desc: 'Treina com casos reais de interações medicamentosas' },
              { href: '/bula',         icon: '📄', label: 'Perceber bulas',         desc: 'Cola qualquer bula e obtém explicação em linguagem simples' },
              { href: '/ai',           icon: '🤖', label: 'Phlox AI',              desc: 'Tira qualquer dúvida farmacológica ou clínica' },
            ].map((item, i, arr) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} className="clin-row">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: `${color}10`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 8 — Comunidade e Arena */}
        <section style={{ marginBottom: 16 }}>
          <SectionLabel>Comunidade e arena</SectionLabel>
          <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>
              Convida colegas para a Arena
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 14 }}>
              Compete em ligas com colegas de curso, compara conhecimentos e aprende com os melhores
              na tua área. As ligas reiniciam semanalmente — cada semana é uma nova oportunidade.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Link href="/arena" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 9, background: color,
                color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
                Ir para a Arena →
              </Link>
              <Link href="/progresso" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 9,
                background: 'white', color: color, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', border: `1px solid ${color}30`,
              }}>
                Ver progresso
              </Link>
            </div>
          </div>
        </section>

      </div>

      <style>{`
        .ic-card > div:hover  { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        .big-card > div:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09) !important; }
        .clin-row > div:hover { background:#f8fafc !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ─── InicioContent — auth router ──────────────────────────────────────────────

function InicioContent() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!user.onboarded) {
      router.push('/onboarding')
      return
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid #e2e8f0',
          borderTopColor: '#0d6e42',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    )
  }

  const mode = user.experience_mode || 'personal'
  if (mode === 'caregiver') return <CaregiverHome user={user} />
  if (mode === 'clinical')  return <ClinicalHome  user={user} />
  if (mode === 'student')   return <StudentHome   user={user} />
  return <PersonalHome user={user} />
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function InicioPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}
    >
      <InicioContent />
    </Suspense>
  )
}
