'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'
import { MODE_QUICK_ACTIONS } from '@/lib/navigation'

// ─── Today's doses widget ─────────────────────────────────────────────────────

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

function TodayDoses() {
  const { user, supabase } = useAuth()
  const [data, setData] = useState<{ done: number; total: number; nextName: string; nextSlot: string; allDone: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    Promise.all([
      supabase.from('personal_meds').select('id,name,dose,reminder_times').eq('user_id', user.id).not('reminder_times', 'is', null),
      supabase.from('med_logs').select('med_id,logged_at,status').eq('user_id', user.id).eq('date', today).eq('status', 'taken'),
    ]).then(([{ data: meds }, { data: logs }]) => {
      const takenLogs = logs || []
      const rows = (meds || []).flatMap((m: any) =>
        (m.reminder_times as string[]).map((slot: string) => ({
          name: m.name, slot,
          taken: takenLogs.some((l: any) => {
            const d = new Date(l.logged_at)
            return l.med_id === m.id && Math.abs(d.getHours() * 60 + d.getMinutes() - toMin(slot)) <= 90
          }),
        }))
      ).sort((a, b) => toMin(a.slot) - toMin(b.slot))
      if (rows.length === 0) return
      const done = rows.filter(r => r.taken).length
      const next = rows.find(r => !r.taken && toMin(r.slot) >= nowMin - 15)
      setData({ done, total: rows.length, nextName: next?.name || '', nextSlot: next?.slot || '', allDone: done === rows.length })
    })
  }, [user, supabase])

  if (!data) return null
  const pct = Math.round(data.done / data.total * 100)

  return (
    <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none', marginBottom: 24 }}>
      <div style={{
        background: data.allDone ? '#f0fdf4' : '#f8fafc',
        border: `1px solid ${data.allDone ? '#bbf7d0' : '#e2e8f0'}`,
        borderRadius: 14,
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
              Medicação hoje
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
              {data.done}<span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}> / {data.total} doses</span>
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: data.allDone ? '#059669' : '#0f172a', letterSpacing: '-0.03em' }}>
            {pct}%
          </div>
        </div>
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: data.allDone ? '#059669' : '#0f172a', borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
          {data.allDone ? '✓ Todas as doses tomadas' : data.nextSlot ? `Próxima: ${data.nextSlot} — ${data.nextName}` : 'Sem doses pendentes agora'}
        </div>
      </div>
    </Link>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth()
  const mode = ((user as any)?.experience_mode as string) || 'personal'
  const modeMeta = MODE_META[mode as ExperienceMode] || MODE_META.personal
  const actions = MODE_QUICK_ACTIONS[mode] || MODE_QUICK_ACTIONS.personal

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'
  const firstName = user?.name?.split(' ')[0] || ''
  const dateStr = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* Greeting */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '28px 24px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px 3px 7px', borderRadius: 20,
            background: `${modeMeta.color}14`, marginBottom: 12,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: modeMeta.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: modeMeta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {modeMeta.labelShort}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '0 0 5px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize', margin: 0 }}>
            {dateStr}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Today doses — personal & caregiver */}
        {(mode === 'personal' || mode === 'caregiver') && <TodayDoses />}

        {/* Quick actions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Ações rápidas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="dash-grid">
            {actions.map(action => (
              <Link key={action.href} href={action.href} style={{ textDecoration: 'none' }} className="dash-card">
                <div style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: '16px 14px 14px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  minHeight: 100,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{action.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 3 }}>
                      {action.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                      {action.desc}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* All tools link */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link href="/ferramentas" style={{ fontSize: 13, color: modeMeta.color, fontWeight: 600, textDecoration: 'none' }}>
            Ver todas as ferramentas →
          </Link>
        </div>
      </div>

      <style>{`
        .dash-card > div:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
        }
        @media (max-width: 480px) {
          .dash-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function DashboardRouter() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!(user as any).onboarded) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #e2e8f0', borderTopColor: '#0d6e42', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
  return <DashboardContent />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <DashboardRouter />
    </Suspense>
  )
}
