'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Mode config ──────────────────────────────────────────────────────────────

const MODE_HERO: Record<string, {
  gradient: string; accent: string; greeting: string; sub: string; emoji: string
}> = {
  personal: {
    gradient: 'linear-gradient(135deg, #065f46 0%, #047857 60%, #059669 100%)',
    accent: '#059669',
    greeting: 'O que quer fazer hoje?',
    sub: 'Saúde simples, ao seu ritmo.',
    emoji: '🌱',
  },
  caregiver: {
    gradient: 'linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%)',
    accent: '#d97706',
    greeting: 'Como está a família?',
    sub: 'Cuide de quem mais ama.',
    emoji: '🏡',
  },
  clinical: {
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #2563eb 100%)',
    accent: '#2563eb',
    greeting: 'Pronto para o turno?',
    sub: 'Tudo o que precisa, num ecrã.',
    emoji: '🏥',
  },
  student: {
    gradient: 'linear-gradient(135deg, #3b0764 0%, #6d28d9 60%, #7c3aed 100%)',
    accent: '#7c3aed',
    greeting: 'Hora de aprender!',
    sub: 'Cada sessão conta.',
    emoji: '📚',
  },
}

// ─── Tiles per mode ───────────────────────────────────────────────────────────

const TILES: Record<string, {
  icon: string; label: string; desc: string; href: string; accent: string; primary?: boolean
}[]> = {
  personal: [
    { icon: '💊', label: 'Os meus medicamentos',  desc: 'Ver lista, adicionar e configurar lembretes diários', href: '/mymeds',       accent: '#059669', primary: true },
    { icon: '🔍', label: 'Verificar segurança',   desc: 'Os meus medicamentos são seguros juntos?',            href: '/interactions', accent: '#3b82f6' },
    { icon: '❤️', label: 'A minha saúde',         desc: 'Registe tensão arterial, pulso e peso',               href: '/vitals',       accent: '#ef4444' },
    { icon: '🤖', label: 'Tenho uma dúvida',      desc: 'Faça qualquer pergunta de saúde à inteligência artificial', href: '/ai',    accent: '#8b5cf6' },
    { icon: '🆘', label: 'Passaporte de saúde',   desc: 'Cartão de emergência com QR code — para urgências',   href: '/passport',     accent: '#f59e0b' },
    { icon: '📄', label: 'Perceber uma bula',     desc: 'Cole o texto de uma bula — explicamos em português simples', href: '/bula', accent: '#0891b2' },
  ],
  caregiver: [
    { icon: '👨‍👩‍👧', label: 'A minha família',       desc: 'Ver e gerir os perfis de todos os familiares',        href: '/perfis',       accent: '#7c3aed', primary: true },
    { icon: '💊',   label: 'Medicamentos',          desc: 'Lista, lembretes e verificação de toda a família',    href: '/mymeds',       accent: '#059669' },
    { icon: '🔍',   label: 'Verificar segurança',   desc: 'Os medicamentos são seguros juntos?',                  href: '/interactions', accent: '#3b82f6' },
    { icon: '🆘',   label: 'Passaporte de saúde',   desc: 'QR code para urgências — dados completos',            href: '/passport',     accent: '#f59e0b' },
    { icon: '❤️',   label: 'Sinais vitais',         desc: 'Registe tensão, pulso e outros dados do corpo',       href: '/vitals',       accent: '#ef4444' },
    { icon: '🤖',   label: 'Tenho uma dúvida',      desc: 'Faça qualquer pergunta de saúde à IA',                href: '/ai',           accent: '#8b5cf6' },
  ],
  clinical: [
    { icon: '🏥', label: 'Turno',          desc: 'Todos os doentes, doses e alertas do turno atual',  href: '/turno',        accent: '#2563eb', primary: true },
    { icon: '📋', label: 'Ronda',          desc: 'Revisão, intervenções pendentes e métricas PCNE',   href: '/rounds',       accent: '#0f766e' },
    { icon: '📝', label: 'MAR',            desc: 'Registo de administração de medicação',              href: '/mar',          accent: '#059669' },
    { icon: '👥', label: 'Doentes',        desc: 'Fichas completas, medicação e alertas',              href: '/patients',     accent: '#7c3aed' },
    { icon: '🤖', label: 'Oracle AI',      desc: 'Consulta farmacêutica com SOAP e PCNE',              href: '/oracle',       accent: '#8b5cf6' },
    { icon: '🔍', label: 'Interações',     desc: 'Análise com mecanismo e grau de evidência',          href: '/interactions', accent: '#3b82f6' },
  ],
  student: [
    { icon: '🏆', label: 'Arena',               desc: 'Competição em ligas Bronze → Diamante',                href: '/arena',     accent: '#7c3aed', primary: true },
    { icon: '🎮', label: 'Simulador clínico',   desc: 'Casos clínicos realistas com inteligência artificial', href: '/simulador', accent: '#2563eb' },
    { icon: '🃏', label: 'Flashcards',          desc: 'Estudar com repetição espaçada — 200+ tópicos',        href: '/study',     accent: '#059669' },
    { icon: '🤖', label: 'AI Tutor',            desc: 'Explicações passo a passo em português',               href: '/tutor',     accent: '#8b5cf6' },
    { icon: '🎯', label: 'Simulação OSCE',      desc: 'A IA é o doente — feedback imediato',                  href: '/osce',      accent: '#f59e0b' },
    { icon: '📈', label: 'O meu progresso',     desc: 'XP, streak e os seus pontos fracos',                   href: '/progresso', accent: '#ef4444' },
  ],
}

// ─── Today's meds widget ──────────────────────────────────────────────────────

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function TodayMedsWidget({ accent }: { accent: string }) {
  const { user, supabase } = useAuth()
  const [rows, setRows] = useState<{ name: string; dose: string|null; slot: string; taken: boolean }[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('personal_meds').select('id,name,dose,reminder_times').eq('user_id', user.id).not('reminder_times','is',null),
      supabase.from('med_logs').select('med_id,logged_at,status').eq('user_id', user.id).eq('date', today).eq('status','taken'),
    ]).then(([{ data: meds }, { data: logs }]) => {
      const taken = logs || []
      const schedule = (meds || []).flatMap((m: any) =>
        (m.reminder_times as string[]).map((slot: string) => {
          const slotMin = toMin(slot)
          const isTaken = taken.some(l => {
            const d = new Date(l.logged_at)
            return l.med_id === m.id && Math.abs(d.getHours()*60+d.getMinutes() - slotMin) <= 90
          })
          return { name: m.name, dose: m.dose, slot, taken: isTaken }
        })
      ).sort((a, b) => toMin(a.slot) - toMin(b.slot))
      setRows(schedule)
      setReady(true)
    })
  }, [user, supabase])

  if (!ready || rows.length === 0) return null

  const nowMin = new Date().getHours()*60 + new Date().getMinutes()
  const done = rows.filter(r => r.taken).length
  const total = rows.length
  const pct = Math.round(done / total * 100)
  const next = rows.find(r => !r.taken && toMin(r.slot) >= nowMin - 15)
  const allDone = done === total

  return (
    <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
      <div style={{
        background: allDone ? '#f0fdf4' : 'white',
        border: `2px solid ${allDone ? '#86efac' : '#e5e7eb'}`,
        borderRadius: 20,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          fontSize: 72, opacity: 0.05, pointerEvents: 'none', userSelect: 'none',
        }}>💊</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: allDone ? '#dcfce7' : accent + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>💊</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>
                Doses de hoje
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>
                {done} de {total} tomadas
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 28, fontWeight: 900,
            color: allDone ? '#16a34a' : accent,
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}>{pct}%</div>
        </div>

        <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: allDone ? '#22c55e' : accent,
            borderRadius: 4,
            transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>

        {next ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>
              {next.slot} — {next.name}{next.dose ? ` ${next.dose}` : ''}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: accent, fontWeight: 700 }}>
              Tomar →
            </span>
          </div>
        ) : allDone ? (
          <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 700 }}>
            ✓ Todas as doses tomadas hoje
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#9ca3af' }}>Sem doses pendentes agora</div>
        )}
      </div>
    </Link>
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth()

  const mode   = ((user as any)?.experience_mode as string) || 'personal'
  const hero   = MODE_HERO[mode] || MODE_HERO.personal
  const tiles  = TILES[mode] || TILES.personal
  const firstName = user?.name?.split(' ')[0] || 'Bem-vindo'

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'

  const primaryTile   = tiles[0]
  const secondaryTiles = tiles.slice(1)

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* ── HERO ── */}
      <div style={{
        background: hero.gradient,
        padding: '36px 24px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -10, bottom: -20,
          fontSize: 160, opacity: 0.07, lineHeight: 1,
          pointerEvents: 'none', userSelect: 'none',
          transform: 'rotate(-8deg)',
        }}>{hero.emoji}</div>

        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>{timeGreeting}</div>

          <h1 style={{
            fontSize: 34,
            fontWeight: 900,
            color: 'white',
            margin: '0 0 6px',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}>{firstName}</h1>

          <p style={{
            fontSize: 17,
            color: 'rgba(255,255,255,0.75)',
            margin: 0,
            fontWeight: 400,
          }}>{hero.greeting}</p>
        </div>
      </div>

      {/* ── CONTENT (overlaps hero slightly) ── */}
      <div style={{
        maxWidth: 900,
        margin: '-20px auto 0',
        padding: '0 16px 40px',
        position: 'relative',
      }}>

        {/* Today's meds widget */}
        {(mode === 'personal' || mode === 'caregiver') && (
          <TodayMedsWidget accent={hero.accent} />
        )}

        {/* ── PRIMARY TILE (full-width, large) ── */}
        <Link href={primaryTile.href} style={{ display: 'block', textDecoration: 'none', marginBottom: 12 }}
          className="tile-primary">
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: '24px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            borderLeft: `6px solid ${primaryTile.accent}`,
            minHeight: 96,
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: primaryTile.accent + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, flexShrink: 0,
            }}>{primaryTile.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: '#111', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {primaryTile.label}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.4 }}>
                {primaryTile.desc}
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: primaryTile.accent + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={primaryTile.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </Link>

        {/* ── SECONDARY TILES (2-column grid) ── */}
        <div className="tiles-grid">
          {secondaryTiles.map(tile => (
            <Link key={tile.href} href={tile.href} style={{ display: 'block', textDecoration: 'none' }}
              className="tile-secondary">
              <div style={{
                background: 'white',
                borderRadius: 18,
                padding: '20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                borderTop: `4px solid ${tile.accent}`,
                height: '100%',
                minHeight: 130,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 13,
                  background: tile.accent + '15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26,
                }}>{tile.icon}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1.2 }}>
                    {tile.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
                    {tile.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── ALL TOOLS CTA ── */}
        <Link href="/ferramentas" style={{ display: 'block', textDecoration: 'none', marginTop: 16 }}>
          <div style={{
            background: '#111827',
            borderRadius: 20,
            padding: '22px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>
                Ver todas as ferramentas
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                Mais de 30 ferramentas de saúde e medicação
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </Link>

      </div>

      <style>{`
        .tiles-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 0;
        }
        @media (max-width: 480px) {
          .tiles-grid { grid-template-columns: 1fr; }
        }
        .tile-primary > div { transition: transform 0.15s, box-shadow 0.15s; }
        .tile-primary:hover > div {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important;
        }
        .tile-secondary > div { transition: transform 0.15s, box-shadow 0.15s; }
        .tile-secondary:hover > div {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important;
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
    if ((user as any)?.onboarded !== true) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#059669', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return <DashboardContent />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f9fafb' }} />}>
      <DashboardRouter />
    </Suspense>
  )
}
