'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

// ─── Tile definitions per mode ────────────────────────────────────────────────

interface Tile {
  icon: string; label: string; desc: string; href: string
  bg: string; iconBg: string; iconColor: string; span?: boolean
}

const TILES: Record<string, Tile[]> = {
  personal: [
    {
      icon: '💊', label: 'Os meus medicamentos',
      desc: 'Ver lista, doses de hoje e lembretes',
      href: '/mymeds',
      bg: '#f0fdf4', iconBg: '#059669', iconColor: '#fff', span: true,
    },
    {
      icon: '🔍', label: 'Verificar segurança',
      desc: 'São seguros juntos?',
      href: '/interactions',
      bg: '#fff', iconBg: '#eff6ff', iconColor: '#2563eb',
    },
    {
      icon: '❤️', label: 'A minha saúde',
      desc: 'Tensão, pulso, peso',
      href: '/vitals',
      bg: '#fff', iconBg: '#fff1f2', iconColor: '#e11d48',
    },
    {
      icon: '🤖', label: 'Tenho uma dúvida',
      desc: 'Pergunte à inteligência artificial',
      href: '/ai',
      bg: '#fff', iconBg: '#faf5ff', iconColor: '#7c3aed',
    },
    {
      icon: '🆘', label: 'Passaporte de saúde',
      desc: 'QR code para urgências',
      href: '/passport',
      bg: '#fff', iconBg: '#fffbeb', iconColor: '#d97706',
    },
    {
      icon: '📄', label: 'Perceber uma bula',
      desc: 'Em português simples',
      href: '/bula',
      bg: '#fff', iconBg: '#f0f9ff', iconColor: '#0284c7',
    },
  ],
  caregiver: [
    {
      icon: '👨‍👩‍👧', label: 'A minha família',
      desc: 'Ver e gerir todos os perfis',
      href: '/perfis',
      bg: '#fdf4ff', iconBg: '#7c3aed', iconColor: '#fff', span: true,
    },
    {
      icon: '💊', label: 'Medicamentos',
      desc: 'Lista, doses e lembretes',
      href: '/mymeds',
      bg: '#fff', iconBg: '#f0fdf4', iconColor: '#059669',
    },
    {
      icon: '🔍', label: 'Verificar segurança',
      desc: 'São seguros juntos?',
      href: '/interactions',
      bg: '#fff', iconBg: '#eff6ff', iconColor: '#2563eb',
    },
    {
      icon: '🆘', label: 'Passaporte de saúde',
      desc: 'QR code para urgências',
      href: '/passport',
      bg: '#fff', iconBg: '#fffbeb', iconColor: '#d97706',
    },
    {
      icon: '❤️', label: 'Sinais vitais',
      desc: 'Tensão, pulso, peso',
      href: '/vitals',
      bg: '#fff', iconBg: '#fff1f2', iconColor: '#e11d48',
    },
    {
      icon: '🤖', label: 'Tenho uma dúvida',
      desc: 'Pergunte à IA',
      href: '/ai',
      bg: '#fff', iconBg: '#faf5ff', iconColor: '#7c3aed',
    },
  ],
  clinical: [
    {
      icon: '🏥', label: 'Turno',
      desc: 'Doentes, doses e alertas agora',
      href: '/turno',
      bg: '#eff6ff', iconBg: '#2563eb', iconColor: '#fff', span: true,
    },
    {
      icon: '📋', label: 'Ronda',
      desc: 'PCNE e intervenções',
      href: '/rounds',
      bg: '#fff', iconBg: '#f0fdfa', iconColor: '#0d9488',
    },
    {
      icon: '📝', label: 'MAR',
      desc: 'Registo de administração',
      href: '/mar',
      bg: '#fff', iconBg: '#f0fdf4', iconColor: '#059669',
    },
    {
      icon: '👥', label: 'Doentes',
      desc: 'Fichas e medicação completa',
      href: '/patients',
      bg: '#fff', iconBg: '#faf5ff', iconColor: '#7c3aed',
    },
    {
      icon: '🤖', label: 'Oracle AI',
      desc: 'SOAP e intervenção farmacêutica',
      href: '/oracle',
      bg: '#fff', iconBg: '#eff6ff', iconColor: '#2563eb',
    },
    {
      icon: '🔍', label: 'Interações',
      desc: 'Mecanismo e evidência',
      href: '/interactions',
      bg: '#fff', iconBg: '#f0f9ff', iconColor: '#0284c7',
    },
  ],
  student: [
    {
      icon: '🏆', label: 'Arena',
      desc: 'Ligas competitivas Bronze → Diamante',
      href: '/arena',
      bg: '#faf5ff', iconBg: '#7c3aed', iconColor: '#fff', span: true,
    },
    {
      icon: '🎮', label: 'Simulador',
      desc: 'Casos clínicos com IA',
      href: '/simulador',
      bg: '#fff', iconBg: '#eff6ff', iconColor: '#2563eb',
    },
    {
      icon: '🃏', label: 'Flashcards',
      desc: '200+ tópicos',
      href: '/study',
      bg: '#fff', iconBg: '#f0fdf4', iconColor: '#059669',
    },
    {
      icon: '🤖', label: 'AI Tutor',
      desc: 'Passo a passo',
      href: '/tutor',
      bg: '#fff', iconBg: '#faf5ff', iconColor: '#7c3aed',
    },
    {
      icon: '🎯', label: 'OSCE',
      desc: 'IA como doente',
      href: '/osce',
      bg: '#fff', iconBg: '#fffbeb', iconColor: '#d97706',
    },
    {
      icon: '📈', label: 'Progresso',
      desc: 'XP, streak e pontos fracos',
      href: '/progresso',
      bg: '#fff', iconBg: '#fff1f2', iconColor: '#e11d48',
    },
  ],
}

// ─── Today's doses widget ─────────────────────────────────────────────────────

function toMin(t: string) { const [h,m] = t.split(':').map(Number); return h*60+m }

function TodayDoses() {
  const { user, supabase } = useAuth()
  const [data, setData] = useState<{ done: number; total: number; nextName: string; nextSlot: string; allDone: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    const nowMin = new Date().getHours()*60 + new Date().getMinutes()
    Promise.all([
      supabase.from('personal_meds').select('id,name,dose,reminder_times').eq('user_id', user.id).not('reminder_times','is',null),
      supabase.from('med_logs').select('med_id,logged_at,status').eq('user_id', user.id).eq('date', today).eq('status','taken'),
    ]).then(([{ data: meds }, { data: logs }]) => {
      const takenLogs = logs || []
      const rows = (meds || []).flatMap((m: any) =>
        (m.reminder_times as string[]).map((slot: string) => ({
          name: m.name, dose: m.dose, slot,
          taken: takenLogs.some(l => {
            const d = new Date(l.logged_at)
            return l.med_id === m.id && Math.abs(d.getHours()*60+d.getMinutes() - toMin(slot)) <= 90
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
    <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none', margin: '0 20px 20px' }}>
      <div style={{
        background: data.allDone
          ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
          : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 20,
        padding: '20px 22px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 80, opacity: 0.08, lineHeight: 1, pointerEvents: 'none' }}>💊</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Doses de hoje</div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {data.done}<span style={{ fontSize: 16, opacity: 0.6, fontWeight: 500 }}> / {data.total}</span>
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, opacity: 0.9, letterSpacing: '-0.03em' }}>{pct}%</div>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: 14, opacity: 0.8, fontWeight: 500 }}>
          {data.allDone ? '✓ Todas as doses tomadas hoje' : data.nextSlot ? `Próxima: ${data.nextSlot} — ${data.nextName}` : 'Sem doses pendentes agora'}
        </div>
      </div>
    </Link>
  )
}

// ─── Dashboard main ───────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth()
  const mode  = ((user as any)?.experience_mode as string) || 'personal'
  const tiles = TILES[mode] || TILES.personal
  const modeMeta = MODE_META[mode as ExperienceMode] || MODE_META.personal

  const hour = new Date().getHours()
  const period = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'
  const firstName = user?.name?.split(' ')[0] || 'Bem-vindo'
  const dateStr = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

  const primaryTile    = tiles.find(t => t.span)!
  const secondaryTiles = tiles.filter(t => !t.span)

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>

      {/* ── Greeting ── */}
      <div style={{ padding: '28px 20px 22px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px 3px 7px', borderRadius: 20,
          background: `${modeMeta.color}18`, marginBottom: 12,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: modeMeta.color }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: modeMeta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {modeMeta.labelShort}
          </span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          {period}, {firstName} 👋
        </h1>
        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, textTransform: 'capitalize' }}>
          {dateStr}
        </div>
      </div>

      {/* ── Today's doses (personal/caregiver only) ── */}
      {(mode === 'personal' || mode === 'caregiver') && (
        <div style={{ background: 'white', paddingBottom: 4 }}>
          <TodayDoses />
        </div>
      )}

      {/* ── Tiles ── */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          O que quer fazer?
        </div>

        {/* Primary tile */}
        <Link href={primaryTile.href} style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}
          className="ph-tile">
          <div style={{
            background: primaryTile.bg,
            borderRadius: 18,
            padding: '22px 20px',
            display: 'flex', alignItems: 'center', gap: 18,
            border: '1.5px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: primaryTile.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}>{primaryTile.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {primaryTile.label}
              </div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.4 }}>
                {primaryTile.desc}
              </div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </Link>

        {/* Secondary grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {secondaryTiles.map(tile => (
            <Link key={tile.href} href={tile.href} style={{ textDecoration: 'none' }}
              className="ph-tile">
              <div style={{
                background: tile.bg,
                borderRadius: 18,
                padding: '18px 16px',
                display: 'flex', flexDirection: 'column', gap: 14,
                border: '1.5px solid rgba(0,0,0,0.05)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                minHeight: 130,
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: tile.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{tile.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.25, marginBottom: 5 }}>
                    {tile.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                    {tile.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>


      <style>{`
        .ph-tile { display: block; }
        .ph-tile > div { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .ph-tile:hover > div, .ph-tile:active > div {
          transform: scale(0.98);
          box-shadow: 0 0 0 3px rgba(0,0,0,0.06) !important;
        }
        @media (max-width: 380px) {
          .ph-tile > div { border-radius: 14px !important; }
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
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#059669', animation: 'spin 0.7s linear infinite' }} />
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
