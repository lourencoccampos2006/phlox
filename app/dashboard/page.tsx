'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ExperienceMode } from '@/lib/experienceMode'
import PlanAds from '@/components/PlanAds'

// ─── Mode meta ────────────────────────────────────────────────────────────────

const MODE_COLORS: Record<ExperienceMode, string> = {
  personal:  '#0d9488',
  caregiver: '#d97706',
  clinical:  '#2563eb',
  student:   '#7c3aed',
}

const MODE_GRADIENTS: Record<ExperienceMode, string> = {
  personal:  'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
  caregiver: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
  clinical:  'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
  student:   'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
}

const MODE_HEROES: Record<ExperienceMode, {
  icon: string
  badge: string
  title: string
  subtitle: string
}> = {
  personal: {
    icon: '💊',
    badge: 'Modo Pessoal',
    title: 'A tua saúde.',
    subtitle: 'Medicação, sinais vitais e segurança — num só lugar.',
  },
  caregiver: {
    icon: '👨‍👩‍👧',
    badge: 'Modo Cuidador',
    title: 'Gere a família.',
    subtitle: 'Perfis familiares, medicação partilhada e passaporte de emergência.',
  },
  clinical: {
    icon: '🏥',
    badge: 'Modo Clínico',
    title: 'Farmácia clínica.',
    subtitle: 'Doentes, MAR, rondas PCNE e Oracle AI integrados no teu fluxo.',
  },
  student: {
    icon: '🎓',
    badge: 'Modo Estudante',
    title: 'Aprende.',
    subtitle: 'Arena, simulador clínico, OSCE e AI Tutor — tudo com feedback imediato.',
  },
}

// ─── Featured tools per mode ─────────────────────────────────────────────────

const FEATURED: Record<ExperienceMode, Array<{
  href: string; icon: string; title: string; desc: string; tag?: string
}>> = {
  personal: [
    {
      href: '/mymeds', icon: '💊', title: 'Medicação',
      desc: 'A tua lista completa. Regista tomas, activa lembretes e vê a adesão mensal.',
      tag: 'Essencial',
    },
    {
      href: '/interactions', icon: '🔍', title: 'Verificar interações',
      desc: 'Cola dois ou mais medicamentos e descobre riscos, mecanismo e o que fazer.',
    },
    {
      href: '/vitals', icon: '❤️', title: 'Sinais vitais',
      desc: 'Regista tensão arterial, pulso, peso e SpO₂. Vê tendências ao longo do tempo.',
    },
    {
      href: '/ai', icon: '🤖', title: 'Phlox AI',
      desc: 'Farmacêutico virtual disponível 24h. Qualquer dúvida sobre saúde ou medicação.',
      tag: 'IA',
    },
  ],
  caregiver: [
    {
      href: '/perfis', icon: '👨‍👩‍👧', title: 'Perfis familiares',
      desc: 'Cria e gere perfis para cada familiar. Medicação, alergias e condições num só sítio.',
      tag: 'Essencial',
    },
    {
      href: '/interactions', icon: '🔍', title: 'Verificar segurança',
      desc: 'Verifica se os medicamentos dos teus familiares são seguros juntos.',
    },
    {
      href: '/passport', icon: '🆘', title: 'Passaporte de saúde',
      desc: 'QR code de emergência com toda a informação médica. Acessível em segundos.',
      tag: 'Essencial',
    },
    {
      href: '/ai', icon: '🤖', title: 'Phlox AI',
      desc: 'Respostas claras e simples sobre medicação e saúde para toda a família.',
      tag: 'IA',
    },
  ],
  clinical: [
    {
      href: '/turno', icon: '🏥', title: 'Turno',
      desc: 'Todos os doentes, doses e alertas do turno num só ecrã. Ponto de partida diário.',
      tag: 'Fluxo',
    },
    {
      href: '/rounds', icon: '📋', title: 'Ronda farmacêutica',
      desc: 'Intervenções PCNE v9.1, acompanhamento de doentes e exportação de relatório.',
    },
    {
      href: '/mar', icon: '📝', title: 'MAR',
      desc: 'Registo de administração por turno com alertas de omissão e desvio de dose.',
    },
    {
      href: '/oracle', icon: '🤖', title: 'Oracle AI',
      desc: 'SOAP farmacêutico, avaliação de risco e plano de cuidados com IA clínica.',
      tag: 'IA Clínica',
    },
    {
      href: '/interactions', icon: '🔍', title: 'Interações',
      desc: 'Qualquer combinação com evidência clínica, mecanismo e grau de severidade.',
    },
  ],
  student: [
    {
      href: '/arena', icon: '🏆', title: 'Arena — Ligas',
      desc: 'Competição em tempo real. Sobe de Bronze a Diamante com casos clínicos gerados por IA.',
      tag: 'Competição',
    },
    {
      href: '/simulador', icon: '🎮', title: 'Simulador clínico',
      desc: 'Casos realistas com IA. Pratica diagnóstico farmacêutico e SOAP antes do estágio.',
      tag: 'IA',
    },
    {
      href: '/study', icon: '🃏', title: 'Flashcards',
      desc: '200+ tópicos em 10 áreas. Repetição espaçada que adapta aos teus pontos fracos.',
    },
    {
      href: '/osce', icon: '🎯', title: 'OSCE simulado',
      desc: 'A IA simula um doente real. Pratica entrevista clínica e aconselhamento farmacêutico.',
      tag: 'IA',
    },
    {
      href: '/tutor', icon: '🤖', title: 'AI Tutor',
      desc: 'Tutoria socrática: pergunta qualquer coisa e aprende passo a passo com contexto.',
    },
  ],
}

// ─── Quick actions per mode ───────────────────────────────────────────────────

const QUICK_ACTIONS: Record<ExperienceMode, Array<{
  href: string; icon: string; label: string
}>> = {
  personal: [
    { href: '/mymeds?action=add',    icon: '＋', label: 'Adicionar med' },
    { href: '/mymeds?action=log',    icon: '✅', label: 'Registar toma' },
    { href: '/interactions',         icon: '🔍', label: 'Verificar' },
    { href: '/vitals?action=record', icon: '❤️', label: 'Sinais vitais' },
    { href: '/bula',                 icon: '📄', label: 'Perceber bula' },
  ],
  caregiver: [
    { href: '/perfis?action=add',    icon: '＋', label: 'Adicionar familiar' },
    { href: '/interactions',         icon: '🔍', label: 'Verificar segurança' },
    { href: '/passport',             icon: '🆘', label: 'Passaporte' },
    { href: '/bula',                 icon: '📄', label: 'Perceber bula' },
  ],
  clinical: [
    { href: '/patients?action=new',  icon: '＋', label: 'Novo doente' },
    { href: '/mar',                  icon: '📝', label: 'Registar MAR' },
    { href: '/rounds',               icon: '📋', label: 'Ronda' },
    { href: '/reconciliacao',        icon: '🔄', label: 'Reconciliação' },
  ],
  student: [
    { href: '/arena',                icon: '🏆', label: 'Arena' },
    { href: '/simulador',            icon: '🎮', label: 'Simular caso' },
    { href: '/study',                icon: '🃏', label: 'Estudar agora' },
    { href: '/osce',                 icon: '🎯', label: 'Praticar OSCE' },
  ],
}

// ─── Mode definitions ─────────────────────────────────────────────────────────

const MODES: Array<{
  id: ExperienceMode
  icon: string
  label: string
  desc: string
}> = [
  {
    id: 'personal',
    icon: '👤',
    label: 'Pessoal',
    desc: 'Medicação, sinais vitais e segurança.',
  },
  {
    id: 'caregiver',
    icon: '👨‍👩‍👧',
    label: 'Cuidador',
    desc: 'Saúde e medicação de toda a família.',
  },
  {
    id: 'clinical',
    icon: '🏥',
    label: 'Clínico',
    desc: 'Ferramentas para profissionais de saúde.',
  },
  {
    id: 'student',
    icon: '🎓',
    label: 'Estudante',
    desc: 'Aprende com competição e simulação clínica.',
  },
]

const PLAN_LABELS: Record<string, string> = {
  free:    'Grátis',
  student: 'Estudante',
  pro:     'Pro',
  clinic:  'Clínica',
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 20, color = '#0d9488' }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: 'cc-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  right,
}: {
  label: string
  right?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </span>
      {right}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color, loading, soon,
}: {
  label: string
  value: number | string
  icon: string
  color: string
  loading: boolean
  soon?: boolean
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: '18px 20px 16px',
      border: '1px solid rgba(0,0,0,0.07)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
          <Spinner size={18} color={color} />
        </div>
      ) : soon ? (
        <div style={{ fontSize: 26, fontWeight: 900, color: '#cbd5e1', letterSpacing: '-0.02em', lineHeight: 1 }}>
          —
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginLeft: 8 }}>Em breve</span>
        </div>
      ) : (
        <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
        </div>
      )}
    </div>
  )
}

// ─── FeatureCard ──────────────────────────────────────────────────────────────

function FeatureCard({
  href, icon, title, desc, color, tag,
}: {
  href: string; icon: string; title: string; desc: string; color: string; tag?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="cc-feat-card">
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '20px',
        border: `1px solid ${color}18`,
        display: 'flex', flexDirection: 'column', gap: 10,
        height: '100%', boxSizing: 'border-box',
        transition: 'transform 0.12s, box-shadow 0.12s',
        cursor: 'pointer',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `${color}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            {icon}
          </div>
          {tag && (
            <span style={{
              fontSize: 9, fontWeight: 700, color,
              background: `${color}15`, padding: '2px 8px',
              borderRadius: 4, letterSpacing: '0.05em',
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {tag}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 5 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
            {desc}
          </div>
        </div>

        {/* CTA */}
        <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 'auto' }}>
          Abrir →
        </div>
      </div>
    </Link>
  )
}

// ─── ModeCard ─────────────────────────────────────────────────────────────────

function ModeCard({
  mode,
  active,
  switching,
  onSwitch,
}: {
  mode: typeof MODES[number]
  active: boolean
  switching: boolean
  onSwitch: (id: ExperienceMode) => void
}) {
  const color = MODE_COLORS[mode.id]

  return (
    <button
      onClick={() => !active && !switching && onSwitch(mode.id)}
      disabled={switching || active}
      className={!active && !switching ? 'cc-mode-btn' : ''}
      style={{
        background: active ? `${color}08` : 'white',
        border: active ? `2px solid ${color}45` : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        padding: '18px 16px',
        textAlign: 'left',
        cursor: active ? 'default' : switching ? 'wait' : 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        opacity: switching && !active ? 0.5 : 1,
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      {/* Active dot */}
      {active && (
        <div style={{
          position: 'absolute', top: 13, right: 13,
          width: 7, height: 7, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 2.5px ${color}25`,
        }} />
      )}

      {/* Icon */}
      <div style={{ fontSize: 26, marginBottom: 10, lineHeight: 1 }}>{mode.icon}</div>

      {/* Label */}
      <div style={{
        fontSize: 14, fontWeight: 800,
        color: active ? color : '#0f172a',
        marginBottom: 4,
      }}>
        {mode.label}
      </div>

      {/* Desc */}
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 8 }}>
        {mode.desc}
      </div>

      {/* Badge */}
      {active && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20,
          background: `${color}15`,
          fontSize: 11, fontWeight: 700, color,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />
          Ativo
        </div>
      )}

      {/* Switching overlay */}
      {switching && !active && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 15,
          background: 'rgba(255,255,255,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Spinner size={22} color={color} />
        </div>
      )}
    </button>
  )
}

// ─── QuickActionBtn ───────────────────────────────────────────────────────────

function QuickActionBtn({
  href, icon, label, color,
}: {
  href: string; icon: string; label: string; color: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="cc-qa-btn">
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '14px 10px',
        background: 'white',
        border: `1px solid ${color}18`,
        borderRadius: 14,
        transition: 'transform 0.12s, box-shadow 0.12s',
        cursor: 'pointer',
        minWidth: 72,
      }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', textAlign: 'center', lineHeight: 1.3 }}>
          {label}
        </span>
      </div>
    </Link>
  )
}

// ─── AccountRow ───────────────────────────────────────────────────────────────

function AccountRow({
  href,
  icon,
  label,
  desc,
  rightNode,
  isLast,
  onClick,
}: {
  href?: string
  icon: string
  label: string
  desc: string
  rightNode?: React.ReactNode
  isLast?: boolean
  onClick?: () => void
}) {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px',
      borderBottom: isLast ? 'none' : '1px solid #f8fafc',
      transition: 'background 0.1s',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
      </div>
      {rightNode}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )

  if (onClick) {
    return (
      <div onClick={onClick} className="cc-acc-row">
        {inner}
      </div>
    )
  }

  return (
    <Link href={href!} style={{ textDecoration: 'none' }} className="cc-acc-row">
      {inner}
    </Link>
  )
}

// ─── PlanPill ─────────────────────────────────────────────────────────────────

function PlanPill({ plan }: { plan: string | undefined }) {
  const map: Record<string, { label: string; color: string }> = {
    free:    { label: 'Grátis',    color: '#64748b' },
    pro:     { label: 'Pro',       color: '#0d9488' },
    student: { label: 'Estudante', color: '#7c3aed' },
    clinic:  { label: 'Clínica',   color: '#2563eb' },
  }
  const p = map[plan || 'free'] || map.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      background: `${p.color}15`,
      fontSize: 11, fontWeight: 700, color: p.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
      {p.label}
    </span>
  )
}

// ─── DashboardContent ─────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, supabase } = useAuth()
  const mode = (user?.experience_mode as ExperienceMode) || 'personal'
  const color = MODE_COLORS[mode]
  const gradient = MODE_GRADIENTS[mode]
  const hero = MODE_HEROES[mode]
  const featured = FEATURED[mode]
  const quickActions = QUICK_ACTIONS[mode]

  const [saving, setSaving] = useState(false)

  // Stats state
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState({
    meds: 0,
    vitals: 0,
    logs: 0,
    profiles: 0,
    patients: 0,
  })

  // Load stats from Supabase — all modes query their real tables
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const since30d = new Date()
      since30d.setDate(since30d.getDate() - 30)
      const since30dISO = since30d.toISOString()

      const [medsRes, vitalsRes, logsRes, profilesRes, patientsRes] = await Promise.all([
        supabase
          .from('personal_meds')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('vitals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('med_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('logged_at', since30dISO),
        supabase
          .from('family_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ])

      setStats({
        meds:     medsRes.count     ?? 0,
        vitals:   vitalsRes.count   ?? 0,
        logs:     logsRes.count     ?? 0,
        profiles: profilesRes.count ?? 0,
        patients: patientsRes.count ?? 0,
      })
      setStatsLoading(false)
    })()
  }, [user?.id])

  // Mode switch
  async function switchMode(newMode: ExperienceMode) {
    if (!user || saving || newMode === mode) return
    setSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({ experience_mode: newMode })
        .eq('id', user.id)
      window.location.reload()
    } catch {
      setSaving(false)
    }
  }

  // Hero subtitle with live data
  function heroSubtitleStat(): string {
    if (statsLoading) return hero.subtitle
    if (mode === 'personal') {
      if (stats.meds > 0)
        return `${stats.meds} medicamento${stats.meds !== 1 ? 's' : ''} ativo${stats.meds !== 1 ? 's' : ''} · ${hero.subtitle}`
      return hero.subtitle
    }
    if (mode === 'caregiver') {
      if (stats.profiles > 0)
        return `${stats.profiles} perfil${stats.profiles !== 1 ? 's' : ''} familiar${stats.profiles !== 1 ? 'es' : ''} · ${hero.subtitle}`
      return hero.subtitle
    }
    if (mode === 'clinical') {
      if (stats.patients > 0)
        return `${stats.patients} doente${stats.patients !== 1 ? 's' : ''} · ${hero.subtitle}`
      return hero.subtitle
    }
    return hero.subtitle
  }

  const planLabel = PLAN_LABELS[(user?.plan as string) || 'free'] || 'Grátis'
  const isFree = !user?.plan || user.plan === 'free'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* ── SECTION 1: HERO BANNER ──────────────────────────────────────────── */}
      <div style={{ background: gradient, padding: '40px 24px 36px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}>
            {/* Left: mode + title */}
            <div style={{ flex: 1, minWidth: 240 }}>
              {/* Mode badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 13px', borderRadius: 20,
                background: 'rgba(255,255,255,0.18)',
                marginBottom: 18,
              }}>
                <span style={{ fontSize: 14 }}>{hero.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {hero.badge}
                </span>
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: 38, fontWeight: 900, color: 'white',
                margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1.1,
              }}>
                {hero.title}
              </h1>

              {/* Subtitle with live stat */}
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', margin: 0, lineHeight: 1.65 }}>
                {heroSubtitleStat()}
              </p>
            </div>

            {/* Right: user card */}
            {user && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 16,
                backdropFilter: 'blur(8px)',
                flexShrink: 0,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  border: '2px solid rgba(255,255,255,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  color: 'white', fontSize: 18, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name?.[0] || 'U').toUpperCase()
                  }
                </div>
                {/* Name + plan */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>{user.name}</div>
                  <div style={{ marginTop: 3 }}>
                    <PlanPill plan={user.plan} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick action row inside hero */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap',
          }}>
            {quickActions.map(qa => (
              <Link
                key={qa.href}
                href={qa.href}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 14px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: 13, fontWeight: 700, color: 'white',
                  cursor: 'pointer', transition: 'background 0.12s',
                  whiteSpace: 'nowrap',
                }}
                  className="cc-hero-pill"
                >
                  <span>{qa.icon}</span>
                  <span>{qa.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page body ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px 96px' }}>

        {/* ── SECTION 2: STATS ROW ──────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Os teus números" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))',
            gap: 10,
          }}>
            {mode === 'personal' && (<>
              <StatCard
                label="Medicamentos"
                value={stats.meds}
                icon="💊"
                color={color}
                loading={statsLoading}
              />
              <StatCard
                label="Sinais vitais"
                value={stats.vitals}
                icon="❤️"
                color="#e11d48"
                loading={statsLoading}
              />
              <StatCard
                label="Tomas (30 dias)"
                value={stats.logs}
                icon="✅"
                color={color}
                loading={statsLoading}
              />
            </>)}

            {mode === 'caregiver' && (<>
              <StatCard
                label="Perfis familiares"
                value={stats.profiles}
                icon="👨‍👩‍👧"
                color={color}
                loading={statsLoading}
              />
              <StatCard
                label="Medicamentos"
                value={stats.meds}
                icon="💊"
                color="#0d9488"
                loading={statsLoading}
              />
              <StatCard
                label="Verificações (30d)"
                value={stats.logs}
                icon="🔍"
                color={color}
                loading={statsLoading}
              />
            </>)}

            {mode === 'clinical' && (<>
              <StatCard
                label="Doentes"
                value={stats.patients}
                icon="👥"
                color={color}
                loading={statsLoading}
              />
              <StatCard
                label="Tomas registadas"
                value={stats.logs}
                icon="📝"
                color={color}
                loading={statsLoading}
              />
              <StatCard
                label="Medicamentos"
                value={stats.meds}
                icon="💊"
                color="#0d9488"
                loading={statsLoading}
              />
            </>)}

            {mode === 'student' && (<>
              <StatCard
                label="XP Total"
                value="--"
                icon="⚡"
                color={color}
                loading={false}
                soon
              />
              <StatCard
                label="Streak atual"
                value="--"
                icon="🔥"
                color="#f97316"
                loading={false}
                soon
              />
              <StatCard
                label="Liga"
                value="--"
                icon="🏆"
                color={color}
                loading={false}
                soon
              />
            </>)}
          </div>
        </section>

        {/* ── SECTION 3: FEATURED TOOLS ────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            label="Ferramentas em destaque"
            right={
              <Link
                href="/inicio"
                style={{ fontSize: 12, color, fontWeight: 600, textDecoration: 'none' }}
              >
                Ver todas →
              </Link>
            }
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))',
            gap: 12,
          }}>
            {featured.map(f => (
              <FeatureCard
                key={f.href}
                href={f.href}
                icon={f.icon}
                title={f.title}
                desc={f.desc}
                color={color}
                tag={f.tag}
              />
            ))}
          </div>
        </section>

        {/* ── SECTION 4: QUICK ACTIONS ─────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Ações rápidas" />
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
          }}>
            {quickActions.map(qa => (
              <QuickActionBtn
                key={qa.href}
                href={qa.href}
                icon={qa.icon}
                label={qa.label}
                color={color}
              />
            ))}
          </div>
        </section>

        {/* ── SECTION 5: MODE SWITCHER ─────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Modo de experiência" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))',
            gap: 12,
          }}>
            {MODES.map(m => (
              <ModeCard
                key={m.id}
                mode={m}
                active={mode === m.id}
                switching={saving}
                onSwitch={switchMode}
              />
            ))}
          </div>

          {/* Switch progress banner */}
          {saving && (
            <div style={{
              marginTop: 12, padding: '10px 16px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <Spinner size={16} color="#059669" />
              <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                A mudar modo… a página vai recarregar.
              </span>
            </div>
          )}
        </section>

        {/* ── SECTION 6: ACCOUNT & SETTINGS ───────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Conta e definições" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            overflow: 'hidden',
          }}>
            {/* Profile */}
            <AccountRow
              href="/settings"
              icon="👤"
              label="O meu perfil"
              desc="Nome, email e foto de perfil"
            />

            {/* Plan */}
            <AccountRow
              href="/pricing"
              icon="💳"
              label="Plano atual"
              desc={isFree
                ? 'Funcionalidades básicas — faz upgrade para desbloquear tudo'
                : 'Acesso completo a todas as funcionalidades'
              }
              rightNode={
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: isFree ? '#b45309' : '#0d9488',
                  background: isFree ? '#fef3c7' : '#f0fdf4',
                  padding: '3px 9px', borderRadius: 8,
                  flexShrink: 0,
                }}>
                  {planLabel}
                </span>
              }
            />

            {/* Notifications */}
            <AccountRow
              href="/notifications"
              icon="🔔"
              label="Notificações"
              desc="Lembretes de medicação, alertas e novidades"
            />

            {/* Health passport */}
            <AccountRow
              href="/passport"
              icon="🆘"
              label="Passaporte de saúde"
              desc="QR code de emergência com a tua informação médica"
            />

            {/* All tools */}
            <AccountRow
              href="/inicio"
              icon="🔧"
              label="Todas as ferramentas"
              desc="35+ ferramentas organizadas por categoria"
              isLast={!isFree}
            />

            {/* Upgrade CTA — only for free users */}
            {isFree && (
              <div style={{
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
                background: '#fffbeb',
                borderTop: '1px solid #fde68a',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                    Desbloqueias muito mais com Pro
                  </div>
                  <div style={{ fontSize: 12, color: '#b45309' }}>
                    Lembretes push, relatório semanal, horário inteligente e passaporte.
                  </div>
                </div>
                <Link href="/pricing" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 22,
                  background: '#0f172a', color: 'white',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  Fazer upgrade
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 7: SIGN OUT ──────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            overflow: 'hidden',
          }}>
            <AccountRow
              href="/privacy"
              icon="🔒"
              label="Privacidade e segurança"
              desc="Como protegemos e armazenamos os teus dados"
            />
            <AccountRow
              href="/settings?tab=import"
              icon="📥"
              label="Importar dados"
              desc="Migrar de outra plataforma ou importar CSV / PDF"
            />
            <AccountRow
              href="/about"
              icon="ℹ️"
              label="Sobre o Phlox"
              desc="Missão, equipa e a tecnologia por trás da plataforma"
              isLast
            />
          </div>
        </section>

        {/* Anúncio — só plano gratuito; pagantes nunca veem */}
        <div style={{ maxWidth: 920, margin: '8px auto 0', padding: '0 16px' }}>
          <PlanAds slot="dashboard_footer" format="horizontal" />
        </div>

      </div>

      {/* ── Global styles ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes cc-spin { to { transform: rotate(360deg); } }

        .cc-feat-card > div:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important;
        }
        .cc-mode-btn:hover {
          box-shadow: 0 4px 18px rgba(0,0,0,0.09) !important;
          transform: translateY(-2px) !important;
        }
        .cc-qa-btn > div:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08) !important;
        }
        .cc-acc-row > div:hover {
          background: #f8fafc !important;
        }
        .cc-hero-pill:hover {
          background: rgba(255,255,255,0.28) !important;
        }

        @media (max-width: 480px) {
          .cc-feat-card > div { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── DashboardRouter — auth guard ─────────────────────────────────────────────

function DashboardRouter() {
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
        flexDirection: 'column', gap: 16,
      }}>
        <Spinner size={32} color="#0d9488" />
        <style>{`@keyframes cc-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <DashboardContent />
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f8fafc' }} />
    }>
      <DashboardRouter />
    </Suspense>
  )
}
