'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyProfile { id: string; name: string; relation?: string }

// ─── Big action tiles per mode ─────────────────────────────────────────────────

const TILES: Record<string, { icon: string; label: string; desc: string; href: string; accent: string }[]> = {
  personal: [
    { icon: '💊', label: 'Os meus medicamentos', desc: 'Veja a lista, adicione novos e configure os lembretes', href: '/mymeds',       accent: '#0d6e42' },
    { icon: '🔍', label: 'Verificar segurança',  desc: 'Descubra se os medicamentos que toma são seguros juntos', href: '/interactions', accent: '#1d4ed8' },
    { icon: '❤️', label: 'A minha saúde',        desc: 'Registe tensão arterial, pulso e outros dados do corpo', href: '/vitals',       accent: '#dc2626' },
    { icon: '🤖', label: 'Tenho uma dúvida',     desc: 'Faça qualquer pergunta sobre saúde ou medicação à IA', href: '/ai',           accent: '#7c3aed' },
    { icon: '🆘', label: 'Passaporte de saúde',  desc: 'Cartão de emergência com a sua medicação completa', href: '/passport',     accent: '#d97706' },
    { icon: '📄', label: 'Perceber uma bula',    desc: 'Cole o texto de uma bula — explicamos em linguagem simples', href: '/bula',        accent: '#0891b2' },
  ],
  caregiver: [
    { icon: '👨‍👩‍👧', label: 'A minha família',      desc: 'Veja e gira os perfis de todos os familiares', href: '/perfis',       accent: '#7c3aed' },
    { icon: '💊',   label: 'Medicamentos',         desc: 'Gerir a medicação de cada familiar com lembretes', href: '/mymeds',       accent: '#0d6e42' },
    { icon: '🔍',   label: 'Verificar segurança',  desc: 'Descubra se os medicamentos são seguros juntos', href: '/interactions', accent: '#1d4ed8' },
    { icon: '🆘',   label: 'Passaporte de saúde',  desc: 'QR code para urgências com dados completos', href: '/passport',     accent: '#d97706' },
    { icon: '❤️',   label: 'Sinais vitais',        desc: 'Registe tensão, pulso e outros dados do corpo', href: '/vitals',       accent: '#dc2626' },
    { icon: '🤖',   label: 'Tenho uma dúvida',     desc: 'Faça qualquer pergunta de saúde à IA', href: '/ai',           accent: '#7c3aed' },
  ],
  clinical: [
    { icon: '🏥', label: 'Turno',         desc: 'Todos os doentes, doses e alertas do turno atual', href: '/turno',        accent: '#1d4ed8' },
    { icon: '📋', label: 'Ronda',         desc: 'Revisão PCNE, intervenções pendentes e métricas', href: '/rounds',       accent: '#0f766e' },
    { icon: '📝', label: 'MAR',           desc: 'Registo de administração de medicação', href: '/mar',          accent: '#0d6e42' },
    { icon: '👥', label: 'Doentes',       desc: 'Fichas completas, medicação e alertas de cada doente', href: '/patients',     accent: '#7c3aed' },
    { icon: '🤖', label: 'Oracle AI',     desc: 'Consulta farmacêutica estruturada com SOAP e PCNE', href: '/oracle',       accent: '#6d28d9' },
    { icon: '🔍', label: 'Interações',    desc: 'Análise de interações com mecanismo e evidência', href: '/interactions', accent: '#0891b2' },
  ],
  student: [
    { icon: '🏆', label: 'Arena',              desc: 'Competição em ligas Bronze → Diamante', href: '/arena',     accent: '#7c3aed' },
    { icon: '🎮', label: 'Simulador clínico',  desc: 'Casos clínicos realistas com inteligência artificial', href: '/simulador', accent: '#1d4ed8' },
    { icon: '🃏', label: 'Flashcards',         desc: 'Estudar com repetição espaçada — mais de 200 tópicos', href: '/study',     accent: '#0d6e42' },
    { icon: '🤖', label: 'AI Tutor',           desc: 'Explicações passo a passo em português simples', href: '/tutor',     accent: '#0891b2' },
    { icon: '🎯', label: 'Simulação OSCE',     desc: 'IA faz o papel de doente, feedback imediato', href: '/osce',      accent: '#d97706' },
    { icon: '📈', label: 'O meu progresso',    desc: 'XP, streak e identificação dos pontos fracos', href: '/progresso', accent: '#dc2626' },
  ],
}

// ─── Today's meds widget ──────────────────────────────────────────────────────

function toMin(t: string) { const [h,m] = t.split(':').map(Number); return h*60+m }

function TodayMedsWidget() {
  const { user, supabase } = useAuth()
  const [schedule, setSchedule] = useState<{ name: string; dose: string|null; slot: string; medId: string; taken: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('personal_meds').select('id,name,dose,reminder_times').eq('user_id', user.id).not('reminder_times','is',null),
      supabase.from('med_logs').select('med_id,logged_at,status').eq('user_id', user.id).eq('date', today).eq('status','taken'),
    ]).then(([{ data: medsData }, { data: logsData }]) => {
      const logs = logsData || []
      const rows = (medsData || []).flatMap((m: any) =>
        (m.reminder_times as string[]).map(slot => {
          const slotMin = toMin(slot)
          const taken = logs.some(l => {
            const d = new Date(l.logged_at)
            return l.med_id === m.id && Math.abs(d.getHours()*60+d.getMinutes() - slotMin) <= 90
          })
          return { name: m.name, dose: m.dose, slot, medId: m.id, taken }
        })
      ).sort((a, b) => toMin(a.slot) - toMin(b.slot))
      setSchedule(rows)
      setLoading(false)
    })
  }, [user, supabase])

  if (loading || schedule.length === 0) return null

  const nowMin = new Date().getHours()*60 + new Date().getMinutes()
  const done = schedule.filter(r => r.taken).length
  const next = schedule.find(r => !r.taken && toMin(r.slot) >= nowMin - 10)
  const pct = Math.round(done / schedule.length * 100)
  const allDone = done === schedule.length

  return (
    <Link href="/mymeds" style={{ display: 'block', background: allDone ? '#f0fdf4' : 'white', border: `1px solid ${allDone ? '#bbf7d0' : 'var(--border)'}`, borderRadius: 14, padding: '18px 20px', textDecoration: 'none', marginBottom: 24, transition: 'border-color 0.15s' }} className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>💊</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Doses de hoje</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{done} de {schedule.length} tomadas</div>
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: allDone ? 'var(--green)' : '#3b82f6' }}>{pct}%</div>
      </div>
      <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: allDone ? 'var(--green)' : '#3b82f6', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      {next ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>
            Próxima: {next.slot} — {next.name}{next.dose ? ` ${next.dose}` : ''}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>Tomar →</div>
        </div>
      ) : allDone ? (
        <div style={{ fontSize: 14, color: 'var(--green)', fontWeight: 700 }}>Todas as doses tomadas hoje ✓</div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--ink-4)' }}>Sem doses pendentes agora</div>
      )}
    </Link>
  )
}

// ─── Family profiles widget ───────────────────────────────────────────────────

function FamilyWidget() {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('family_profiles').select('id,name,relation').eq('user_id', user.id).order('created_at', { ascending: true })
      .then(({ data }) => { setProfiles(data || []); setLoading(false) })
  }, [user, supabase])

  if (loading || profiles.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>A minha família</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {profiles.map(p => (
          <Link key={p.id} href={`/perfil/${p.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s' }}
            className="family-chip">
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
              {p.relation && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{p.relation}</div>}
            </div>
          </Link>
        ))}
        <Link href="/perfis" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'var(--bg-2)', border: '1.5px dashed var(--border)', borderRadius: 10, textDecoration: 'none', color: 'var(--ink-4)', fontSize: 13 }}>
          + Ver todos
        </Link>
      </div>
    </div>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

function DashboardContent() {
  const { user, loading } = useAuth()
  const mode = (user as any)?.experience_mode || 'personal'
  const tiles = TILES[mode] || TILES.personal
  const firstName = user?.name?.split(' ')[0] || 'Bem-vindo'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="skeleton" style={{ width: 280, height: 20, borderRadius: 4 }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', padding: '32px 0 64px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1.2 }}>
            {greeting}, {firstName}!
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-4)', lineHeight: 1.5 }}>
            O que quer fazer hoje?
          </p>
        </div>

        {/* Today's meds widget — shown only for personal/caregiver with reminders */}
        {(mode === 'personal' || mode === 'caregiver') && <TodayMedsWidget />}

        {/* Family profiles — shown for caregiver */}
        {mode === 'caregiver' && <FamilyWidget />}

        {/* Big action tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 12, marginBottom: 32 }}>
          {tiles.map(tile => (
            <Link key={tile.href} href={tile.href}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 22px', background: 'white', border: '1px solid var(--border)', borderRadius: 14, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s' }}
              className="action-tile">
              <div style={{ width: 52, height: 52, borderRadius: 12, background: tile.accent + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                {tile.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, lineHeight: 1.3 }}>{tile.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.4 }}>{tile.desc}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tile.accent} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          ))}
        </div>

        {/* All tools link */}
        <div style={{ textAlign: 'center', padding: '20px', background: 'white', border: '1px solid var(--border)', borderRadius: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Quer ver todas as ferramentas disponíveis?</div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>O Phlox tem mais de 30 ferramentas de saúde e medicação.</div>
          <Link href="/ferramentas" style={{ display: 'inline-block', padding: '11px 24px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver todas as ferramentas →
          </Link>
        </div>

      </div>

      <style>{`
        .action-tile:hover { border-color: var(--border-2) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.07) !important; transform: translateY(-1px) !important; }
        .stat-card:hover { border-color: var(--green) !important; }
        .family-chip:hover { border-color: #7c3aed !important; }
      `}</style>
    </div>
  )
}

// ─── Router wrapper ───────────────────────────────────────────────────────────

function DashboardRouter() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if ((user as any)?.onboarded !== true) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="skeleton" style={{ width: 280, height: 20, borderRadius: 4 }} />
    </div>
  )

  return <DashboardContent />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-2)' }} />}>
      <DashboardRouter />
    </Suspense>
  )
}
