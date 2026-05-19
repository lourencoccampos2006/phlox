'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NAV_CATEGORIES, PERSONA_NAV, type NavTool } from '@/lib/navigation'
import { MODE_META, type ExperienceMode } from '@/lib/experienceMode'

// ─── Mode definitions ─────────────────────────────────────────────────────────

const MODES = [
  {
    id: 'personal' as ExperienceMode,
    icon: '👤',
    label: 'Pessoal',
    desc: 'Gere a tua própria medicação, sinais vitais e saúde.',
    longDesc: 'Modo ideal para quem quer controlar a sua medicação pessoal, registar sinais vitais, perceber bulas e receber alertas de interações.',
  },
  {
    id: 'caregiver' as ExperienceMode,
    icon: '👨‍👩‍👧',
    label: 'Cuidador Familiar',
    desc: 'Gere a saúde e medicação de toda a família.',
    longDesc: 'Cria perfis para cada familiar, acompanha a medicação de todos, verifica interações e tem o passaporte de saúde sempre pronto.',
  },
  {
    id: 'clinical' as ExperienceMode,
    icon: '🏥',
    label: 'Clínico',
    desc: 'Ferramentas para profissionais de saúde.',
    longDesc: 'Acesso à gestão de doentes, MAR, rondas farmacêuticas, reconciliação, Oracle AI, calculadoras clínicas e notificação de RAM.',
  },
  {
    id: 'student' as ExperienceMode,
    icon: '🎓',
    label: 'Estudante',
    desc: 'Aprende farmacologia através de prática e competição.',
    longDesc: 'Arena de ligas, simulador clínico, OSCE, flashcards, AI tutor e acompanhamento de progresso com XP e streak diário.',
  },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      {right}
    </div>
  )
}

// ─── ModeCard ─────────────────────────────────────────────────────────────────

function ModeCard({
  mode,
  active,
  saving,
  onSwitch,
}: {
  mode: typeof MODES[number]
  active: boolean
  saving: boolean
  onSwitch: (id: ExperienceMode) => void
}) {
  const meta = MODE_META[mode.id]

  return (
    <button
      onClick={() => !active && !saving && onSwitch(mode.id)}
      disabled={saving || active}
      className={!active && !saving ? 'dash-mode-btn' : ''}
      style={{
        background: active ? `${meta.color}08` : 'white',
        border: active ? `2px solid ${meta.color}45` : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16, padding: '20px 16px',
        textAlign: 'left',
        cursor: active ? 'default' : saving ? 'wait' : 'pointer',
        transition: 'all 0.15s', position: 'relative',
        opacity: saving && !active ? 0.55 : 1,
        fontFamily: 'inherit',
      }}>
      {/* Active indicator dot */}
      {active && (
        <div style={{
          position: 'absolute', top: 13, right: 13,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: meta.color,
            boxShadow: `0 0 0 2px ${meta.color}25`,
          }} />
        </div>
      )}

      {/* Icon */}
      <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>{mode.icon}</div>

      {/* Labels */}
      <div style={{ fontSize: 14, fontWeight: 800, color: active ? meta.color : '#0f172a', marginBottom: 4 }}>
        {mode.label}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 10 }}>
        {mode.desc}
      </div>

      {/* Active badge */}
      {active && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20,
          background: `${meta.color}15`,
          fontSize: 11, fontWeight: 700, color: meta.color,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color }} />
          Ativo
        </div>
      )}

      {/* Switching state */}
      {saving && !active && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 15,
          background: 'rgba(255,255,255,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: `2px solid ${meta.color}30`,
            borderTopColor: meta.color,
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      )}
    </button>
  )
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────

function DashToolCard({ tool, color }: { tool: NavTool; color: string }) {
  return (
    <Link href={tool.href} style={{ textDecoration: 'none' }} className="dash-tool-card">
      <div style={{
        background: 'white', borderRadius: 13, padding: '14px 16px',
        border: '1px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', gap: 13,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}>
        {/* Icon circle */}
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: `${color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {tool.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{tool.label}</span>
            {tool.badge && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: color,
                background: `${color}15`, padding: '1px 6px',
                borderRadius: 4, letterSpacing: '0.05em',
                textTransform: 'uppercase', flexShrink: 0,
              }}>
                {tool.badge}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{tool.desc}</div>
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
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
  rightText,
  isLast,
}: {
  href: string
  icon: string
  label: string
  desc: string
  rightText?: string
  isLast?: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="acc-row">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        borderBottom: isLast ? 'none' : '1px solid #f8fafc',
        transition: 'background 0.1s',
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
        </div>
        {rightText && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#64748b',
            background: '#f1f5f9', padding: '3px 9px', borderRadius: 8,
            flexShrink: 0,
          }}>
            {rightText}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, icon, color, loading }: {
  label: string; value: number | string; unit?: string; icon: string; color: string; loading: boolean
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '18px 18px 16px',
      border: '1px solid rgba(0,0,0,0.07)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${color}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div style={{ height: 32, display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: `2px solid ${color}30`, borderTopColor: color,
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
          {unit && <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>{unit}</span>}
        </div>
      )}
    </div>
  )
}

// ─── FeatureCard ──────────────────────────────────────────────────────────────

function FeatureCard({ href, icon, title, desc, color, tag }: {
  href: string; icon: string; title: string; desc: string; color: string; tag?: string
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="feat-card">
      <div style={{
        background: 'white', borderRadius: 16, padding: '20px',
        border: `1px solid ${color}18`,
        display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
        boxSizing: 'border-box', transition: 'transform 0.12s, box-shadow 0.12s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `${color}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
          }}>
            {icon}
          </div>
          {tag && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: color,
              background: `${color}15`, padding: '2px 7px',
              borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {tag}
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 5 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>{desc}</div>
        </div>
        <div style={{ fontSize: 12, color: color, fontWeight: 700, marginTop: 'auto' }}>Abrir →</div>
      </div>
    </Link>
  )
}

// ─── ChangelogItem ────────────────────────────────────────────────────────────

function ChangelogItem({ date, title, desc, type }: {
  date: string; title: string; desc: string; type: 'novo' | 'melhoria' | 'fix'
}) {
  const typeColors: Record<string, { bg: string; text: string; label: string }> = {
    novo:     { bg: '#f0fdf4', text: '#059669', label: 'Novo' },
    melhoria: { bg: '#eff6ff', text: '#2563eb', label: 'Melhoria' },
    fix:      { bg: '#fef2f2', text: '#dc2626', label: 'Correção' },
  }
  const t = typeColors[type]
  return (
    <div style={{
      display: 'flex', gap: 14, paddingBottom: 16,
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: t.text,
          background: t.bg, padding: '3px 7px',
          borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {t.label}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{date}</span>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </div>
  )
}

// ─── ResourceLink ─────────────────────────────────────────────────────────────

function ResourceLink({ href, icon, label, desc, external, isLast }: {
  href: string; icon: string; label: string; desc: string; external?: boolean; isLast?: boolean
}) {
  const props = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <Link href={href} {...props} style={{ textDecoration: 'none' }} className="res-link">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: isLast ? 'none' : '1px solid #f8fafc', transition: 'background 0.1s',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{desc}</div>
        </div>
        {external ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        )}
      </div>
    </Link>
  )
}

// ─── CHANGELOG data (not user data — platform release notes) ──────────────────

const CHANGELOG = [
  {
    date: 'Mai 2025', title: 'Otimizador de prescrição', type: 'novo' as const,
    desc: 'Analisa a tua lista completa com critérios STOPP/START e sugere alternativas mais seguras. Disponível em Medicação → Otimizar.',
  },
  {
    date: 'Mai 2025', title: 'Relatório semanal com IA', type: 'novo' as const,
    desc: 'A IA analisa a tua semana de adesão, sinais vitais e atividade e gera um relatório personalizado. Disponível em Saúde → Relatório.',
  },
  {
    date: 'Abr 2025', title: 'Horário inteligente de medicação', type: 'novo' as const,
    desc: 'Diz à IA os teus medicamentos e ela cria o horário ideal, evitando interações e respeitando refeições.',
  },
  {
    date: 'Abr 2025', title: 'Notificação de RAM (INFARMED)', type: 'novo' as const,
    desc: 'Formulário guiado para notificação de reações adversas a medicamentos segundo critérios WHO-UMC e INFARMED.',
  },
  {
    date: 'Mar 2025', title: 'Pesquisa global com ⌘K', type: 'melhoria' as const,
    desc: 'Preme Ctrl+K em qualquer página para pesquisar imediatamente entre todas as ferramentas da plataforma.',
  },
  {
    date: 'Mar 2025', title: 'Início personalizado por persona', type: 'melhoria' as const,
    desc: 'A página de início é agora completamente diferente para cada modo: pessoal, cuidador, clínico e estudante.',
  },
] as const

// ─── FEATURED tools per mode ──────────────────────────────────────────────────

const FEATURED_TOOLS: Record<ExperienceMode, Array<{ href: string; icon: string; title: string; desc: string; tag?: string }>> = {
  personal: [
    { href: '/interactions', icon: '🔍', title: 'Verificar interações', desc: 'Cola dois ou mais medicamentos e descobre riscos, mecanismo e o que fazer. Cobre milhares de combinações.', tag: 'Mais usado' },
    { href: '/schedule', icon: '⏰', title: 'Horário inteligente', desc: 'Descreve os teus medicamentos e a IA cria o horário ideal respeitando refeições, sono e intervalos mínimos.', tag: 'IA' },
    { href: '/ai', icon: '🤖', title: 'Phlox AI', desc: 'Farmacêutico virtual disponível 24h. Responde a qualquer dúvida sobre a tua medicação em linguagem simples.', tag: 'IA' },
  ],
  caregiver: [
    { href: '/interactions', icon: '🔍', title: 'Verificar interações', desc: 'Verifica se os medicamentos dos teus familiares são seguros juntos. Inclui todos os perfis de uma vez.', tag: 'Essencial' },
    { href: '/passport', icon: '🆘', title: 'Passaporte de saúde', desc: 'QR code de emergência com toda a informação médica dos teus familiares, acessível em segundos.', tag: 'Essencial' },
    { href: '/bula', icon: '📄', title: 'Perceber uma bula', desc: 'Cola qualquer bula e a IA explica em linguagem simples o que importa saber antes de tomar.', },
  ],
  clinical: [
    { href: '/oracle', icon: '🤖', title: 'Oracle AI', desc: 'IA clínica especializada em SOAP farmacêutico. Gera intervenções, avalia riscos e sugere plano de cuidados.', tag: 'IA Clínica' },
    { href: '/rounds', icon: '📋', title: 'Ronda Farmacêutica', desc: 'Regista intervenções PCNE, acompanha doentes e exporta relatório clínico com um clique.', tag: 'Essencial' },
    { href: '/reconciliacao', icon: '🔄', title: 'Reconciliação', desc: 'Compara medicação de admissão vs atual, identifica discrepâncias e gera lista de reconciliação para o processo.', },
  ],
  student: [
    { href: '/arena', icon: '🏆', title: 'Arena — Ligas', desc: 'Competição em tempo real com outros estudantes. Sobe de Bronze a Diamante respondendo a casos clínicos.', tag: 'Competição' },
    { href: '/simulador', icon: '🎮', title: 'Simulador Clínico', desc: 'Casos clínicos realistas gerados por IA. Pratica diagnóstico farmacêutico, SOAP e intervenção antes do estágio.', tag: 'IA' },
    { href: '/osce', icon: '🎯', title: 'OSCE — Exame simulado', desc: 'A IA simula um doente real. Pratica a entrevista clínica, recolha de informação e aconselhamento farmacêutico.', tag: 'IA' },
  ],
}

// ─── DashboardContent ─────────────────────────────────────────────────────────

function DashboardContent() {
  const { user, supabase } = useAuth()
  const mode = (user?.experience_mode as ExperienceMode) || 'personal'
  const meta = MODE_META[mode]
  const [saving, setSaving] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState({ meds: 0, vitals: 0, logs: 0, profiles: 0, patients: 0 })

  useEffect(() => {
    if (!user?.id) return
    const today30 = new Date()
    today30.setDate(today30.getDate() - 30)
    const since = today30.toISOString()
    Promise.all([
      supabase.from('personal_meds').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('vitals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('med_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('logged_at', since),
      supabase.from('family_profiles').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([m, v, l, fp, p]) => {
      setStats({
        meds:     m.count ?? 0,
        vitals:   v.count ?? 0,
        logs:     l.count ?? 0,
        profiles: fp.count ?? 0,
        patients: p.count ?? 0,
      })
      setStatsLoading(false)
    })
  }, [user, supabase])

  async function switchMode(newMode: ExperienceMode) {
    if (!user || saving) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ experience_mode: newMode }).eq('id', user.id)
      window.location.reload()
    } catch {
      setSaving(false)
    }
  }

  const personaLinks = PERSONA_NAV[mode] || PERSONA_NAV.personal

  const planLabels: Record<string, string> = {
    free: 'Grátis', student: 'Estudante', pro: 'Pro', clinic: 'Clínica',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 56 }}>

      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '32px 24px 28px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{
                fontSize: 11, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px',
              }}>
                Phlox
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
                Painel de controlo
              </h1>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                Gere o teu modo, acede a todas as ferramentas e personaliza a tua experiência.
              </p>
            </div>
            {user && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: `${meta.color}08`,
                border: `1px solid ${meta.color}25`,
                borderRadius: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: meta.color, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 15, fontWeight: 700, flexShrink: 0,
                }}>
                  {user.avatar
                    ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (user.name?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: meta.color,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
                      {meta.labelShort}
                    </span>
                    {user.plan && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        · {planLabels[user.plan] || user.plan}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* ── Section 1: Modo ativo ─────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Modo ativo" />
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
                saving={saving}
                onSwitch={switchMode}
              />
            ))}
          </div>
          {/* Switching overlay */}
          {saving && (
            <div style={{
              marginTop: 12, padding: '10px 16px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid #bbf7d0', borderTopColor: '#059669',
                animation: 'spin 0.7s linear infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                A mudar modo... a página vai recarregar.
              </span>
            </div>
          )}
        </section>

        {/* ── Section 2: Acesso rápido ──────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Acesso rápido" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))',
            gap: 10,
          }}>
            {personaLinks.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }} className="quick-btn">
                <div style={{
                  background: 'white',
                  border: `1px solid ${meta.color}20`,
                  borderRadius: 12, padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  cursor: 'pointer',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: meta.color,
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>Abrir →</div>
                </div>
              </Link>
            ))}
            {/* Dashboard itself */}
            <Link href="/inicio" style={{ textDecoration: 'none' }} className="quick-btn">
              <div style={{
                background: `${meta.color}08`,
                border: `1px solid ${meta.color}30`,
                borderRadius: 12, padding: '14px',
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'transform 0.12s, box-shadow 0.12s',
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 16 }}>🏠</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>Início</div>
                <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, opacity: 0.7 }}>Espaço diário →</div>
              </div>
            </Link>
          </div>
        </section>

        {/* ── Section 2b: Estatísticas ─────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Os teus dados" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))',
            gap: 10,
          }}>
            {mode === 'personal' && (<>
              <StatCard label="Medicamentos" value={stats.meds} icon="💊" color="#0d9488" loading={statsLoading} />
              <StatCard label="Sinais vitais" value={stats.vitals} icon="❤️" color="#e11d48" loading={statsLoading} />
              <StatCard label="Tomas (30 dias)" value={stats.logs} icon="✅" color="#0d9488" loading={statsLoading} />
            </>)}
            {mode === 'caregiver' && (<>
              <StatCard label="Perfis familiares" value={stats.profiles} icon="👨‍👩‍👧" color="#b45309" loading={statsLoading} />
              <StatCard label="Medicamentos" value={stats.meds} icon="💊" color="#0d9488" loading={statsLoading} />
              <StatCard label="Tomas (30 dias)" value={stats.logs} icon="✅" color="#0d9488" loading={statsLoading} />
            </>)}
            {mode === 'clinical' && (<>
              <StatCard label="Doentes" value={stats.patients} icon="👥" color="#2563eb" loading={statsLoading} />
              <StatCard label="Medicamentos" value={stats.meds} icon="💊" color="#0d9488" loading={statsLoading} />
              <StatCard label="Tomas (30 dias)" value={stats.logs} icon="📝" color="#2563eb" loading={statsLoading} />
            </>)}
            {mode === 'student' && (<>
              <StatCard label="Perfis familiares" value={stats.profiles} icon="👨‍👩‍👧" color="#7c3aed" loading={statsLoading} />
              <StatCard label="Medicamentos" value={stats.meds} icon="💊" color="#0d9488" loading={statsLoading} />
              <StatCard label="Tomas registadas" value={stats.logs} icon="📚" color="#7c3aed" loading={statsLoading} />
            </>)}
          </div>
        </section>

        {/* ── Section 2c: Em destaque ───────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader
            label="Em destaque"
            right={<Link href="/ferramentas" style={{ fontSize: 12, color: meta.color, fontWeight: 600, textDecoration: 'none' }}>Ver todas →</Link>}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 12,
          }}>
            {FEATURED_TOOLS[mode].map(t => (
              <FeatureCard key={t.href} href={t.href} icon={t.icon} title={t.title} desc={t.desc} color={meta.color} tag={t.tag} />
            ))}
          </div>
        </section>

        {/* ── Section 3: Ferramentas ────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Todas as ferramentas" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Medication category */}
            {(() => {
              const cat = NAV_CATEGORIES.find(c => c.id === 'medication')!
              return (
                <div key={cat.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{cat.label}</span>
                    </div>
                    <Link href="/mymeds" style={{ fontSize: 12, color: cat.color, fontWeight: 600, textDecoration: 'none' }}>
                      ver mais →
                    </Link>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                    gap: 8,
                  }}>
                    {cat.tools.map(tool => (
                      <DashToolCard key={tool.href} tool={tool} color={cat.color} />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Health category */}
            {(() => {
              const cat = NAV_CATEGORIES.find(c => c.id === 'health')!
              return (
                <div key={cat.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{cat.label}</span>
                    </div>
                    <Link href="/vitals" style={{ fontSize: 12, color: cat.color, fontWeight: 600, textDecoration: 'none' }}>
                      ver mais →
                    </Link>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                    gap: 8,
                  }}>
                    {cat.tools.map(tool => (
                      <DashToolCard key={tool.href} tool={tool} color={cat.color} />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Clinical category */}
            {(() => {
              const cat = NAV_CATEGORIES.find(c => c.id === 'clinical')!
              return (
                <div key={cat.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{cat.label}</span>
                    </div>
                    <Link href="/turno" style={{ fontSize: 12, color: cat.color, fontWeight: 600, textDecoration: 'none' }}>
                      ver mais →
                    </Link>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                    gap: 8,
                  }}>
                    {cat.tools.map(tool => (
                      <DashToolCard key={tool.href} tool={tool} color={cat.color} />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Student category */}
            {(() => {
              const cat = NAV_CATEGORIES.find(c => c.id === 'student')!
              return (
                <div key={cat.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{cat.label}</span>
                    </div>
                    <Link href="/arena" style={{ fontSize: 12, color: cat.color, fontWeight: 600, textDecoration: 'none' }}>
                      ver mais →
                    </Link>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                    gap: 8,
                  }}>
                    {cat.tools.map(tool => (
                      <DashToolCard key={tool.href} tool={tool} color={cat.color} />
                    ))}
                  </div>
                </div>
              )
            })()}

          </div>
        </section>

        {/* ── Section 4: Conta e definições ─────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Conta e definições" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            overflow: 'hidden',
          }}>
            <AccountRow
              href="/settings"
              icon="👤"
              label="O meu perfil"
              desc="Nome, email, foto de perfil"
            />
            <AccountRow
              href="/pricing"
              icon="💳"
              label="Plano atual"
              desc="Vê as funcionalidades do teu plano e faz upgrade"
              rightText={planLabels[(user?.plan as string) || 'free'] || 'Grátis'}
            />
            <AccountRow
              href="/notifications"
              icon="🔔"
              label="Notificações"
              desc="Lembretes de medicação, alertas e novidades"
            />
            <AccountRow
              href="/passport"
              icon="🆘"
              label="Passaporte de saúde"
              desc="QR code de emergência com os teus dados"
            />
            <AccountRow
              href="/ferramentas"
              icon="🔧"
              label="Todas as ferramentas"
              desc="Pesquisa por qualquer ferramenta da plataforma"
            />
            <AccountRow
              href="/importar"
              icon="📥"
              label="Importar dados"
              desc="Migrar de outra plataforma ou importar CSV/PDF"
              isLast
            />
          </div>
        </section>

        {/* ── Section 4b: Novidades ────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Novidades na plataforma" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            padding: '20px 20px 4px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            {CHANGELOG.map((item, i) => (
              <ChangelogItem key={i} date={item.date} title={item.title} desc={item.desc} type={item.type} />
            ))}
          </div>
        </section>

        {/* ── Section 4c: Recursos e suporte ───────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Recursos e suporte" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            overflow: 'hidden',
          }}>
            <ResourceLink href="/blog"           icon="📖" label="Blog Phlox"             desc="Artigos sobre medicação, interações e saúde" />
            <ResourceLink href="/about"          icon="ℹ️" label="Sobre o Phlox"           desc="A missão, a equipa e a tecnologia por trás" />
            <ResourceLink href="/ferramentas"    icon="🔧" label="Todas as ferramentas"    desc="Pesquisa e acesso a 35+ ferramentas" />
            <ResourceLink href="/api-docs"       icon="⚙️" label="API & Integrações"       desc="Conecta o Phlox ao teu sistema clínico" />
            <ResourceLink href="/privacy"        icon="🔒" label="Privacidade e segurança" desc="Como protegemos e armazenamos os teus dados" />
            <ResourceLink href="/terms"          icon="📋" label="Termos de serviço"       desc="Condições de utilização da plataforma" isLast />
          </div>
          {/* Privacy assurance */}
          <div style={{
            marginTop: 12, padding: '14px 18px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 3 }}>Os teus dados são teus</div>
              <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.6 }}>
                Toda a informação de saúde é encriptada e armazenada em servidores europeus. Nunca vendemos ou partilhamos dados com terceiros. Podes exportar ou apagar tudo a qualquer momento.
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4d: Plano atual ───────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Plano atual" right={
            <Link href="/pricing" style={{ fontSize: 12, color: meta.color, fontWeight: 600, textDecoration: 'none' }}>
              Ver planos →
            </Link>
          } />
          <div style={{
            background: 'white', borderRadius: 16,
            border: `1px solid ${meta.color}20`,
            padding: '20px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Plano ativo
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {({ free: 'Grátis', student: 'Estudante', pro: 'Pro', clinic: 'Clínica' } as Record<string, string>)[user?.plan as string] || 'Grátis'}
                </span>
                {(!user?.plan || user?.plan === 'free') && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#b45309',
                    background: '#fef3c7', padding: '2px 7px', borderRadius: 4,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Limitado
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                {(!user?.plan || user?.plan === 'free')
                  ? 'Acesso a funcionalidades básicas. Faz upgrade para desbloquear tudo.'
                  : 'Acesso completo a todas as funcionalidades da plataforma.'}
              </div>
            </div>
            {(!user?.plan || user?.plan === 'free') && (
              <Link href="/pricing" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 24,
                background: '#0f172a', color: 'white',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>
                Fazer upgrade
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            )}
          </div>
        </section>

        {/* ── Section 5: Atalhos de teclado ────────────────────────────────── */}
        <section>
          <SectionHeader label="Atalhos de teclado" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            padding: '20px',
          }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
                Atalhos globais que funcionam em qualquer página da plataforma.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                {
                  keys: ['⌘', 'K'],
                  label: 'Pesquisar',
                  desc: 'Abre a barra de pesquisa de ferramentas',
                },
                {
                  keys: ['Clique no logo'],
                  label: 'Ir para Início',
                  desc: 'Clica no logótipo Phlox para voltar ao início',
                  wide: true,
                },
                {
                  keys: ['Esc'],
                  label: 'Fechar overlays',
                  desc: 'Fecha pesquisa, dropdowns e modais abertos',
                },
              ].map((shortcut, i, arr) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none',
                }}>
                  {/* Key badges */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    minWidth: shortcut.wide ? 'auto' : 80, flexShrink: 0,
                  }}>
                    {shortcut.keys.map((k, ki) => (
                      <kbd key={ki} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: shortcut.wide ? '4px 10px' : '4px 7px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderBottom: '2px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: shortcut.wide ? 11 : 12,
                        fontWeight: 700, color: '#374151',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}>
                        {k}
                      </kbd>
                    ))}
                  </div>
                  {/* Description */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                      {shortcut.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{shortcut.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tip box */}
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
              <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
                <strong>Dica:</strong> A pesquisa (⌘K) é a forma mais rápida de navegar entre ferramentas.
                Digita o nome de qualquer ferramenta ou categoria para a encontrar imediatamente.
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 6: Diretório de ferramentas ──────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Todas as ferramentas" right={
            <Link href="/ferramentas" style={{ fontSize: 12, color: meta.color, fontWeight: 600, textDecoration: 'none' }}>
              Ver em modo expandido →
            </Link>
          } />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NAV_CATEGORIES.map(cat => (
              <div key={cat.id} style={{
                background: 'white', borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.07)',
                overflow: 'hidden',
              }}>
                {/* Category header */}
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{cat.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 2 }}>{cat.tools.length} ferramentas</span>
                </div>
                {/* Tool rows */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
                  {cat.tools.map((tool, i) => (
                    <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none' }} className="dash-tool-card">
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '13px 18px',
                        borderBottom: '1px solid #f8fafc',
                        transition: 'transform 0.12s, box-shadow 0.12s',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: `${cat.color}12`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 17, flexShrink: 0,
                        }}>
                          {tool.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: '#0f172a',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            {tool.label}
                            {tool.badge && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, color: cat.color,
                                background: `${cat.color}15`, padding: '1px 5px',
                                borderRadius: 3, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                              }}>
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tool.desc}
                          </div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 7: Dicas de utilização ───────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Dicas de utilização" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 10 }}>
            {[
              {
                icon: '⌘K',
                title: 'Pesquisa instantânea',
                body: 'Pressiona ⌘K (ou Ctrl+K) em qualquer página para encontrar qualquer ferramenta, sem sair do contexto atual.',
                color: '#0d9488',
              },
              {
                icon: '⚡',
                title: 'Ações rápidas',
                body: 'O botão ⚡ no cabeçalho abre um painel com as 6 ações mais úteis para o teu modo atual — sem navegar.',
                color: '#7c3aed',
              },
              {
                icon: '🔄',
                title: 'Muda de modo',
                body: 'Usa os separadores de persona no cabeçalho ou nas definições para mudar entre pessoal, cuidador, clínico e estudante.',
                color: '#2563eb',
              },
              {
                icon: '🆘',
                title: 'Passaporte de saúde',
                body: 'O passaporte de saúde gera um QR code com informação crítica para emergências — acedido por qualquer profissional de saúde.',
                color: '#e11d48',
              },
              {
                icon: '📊',
                title: 'Painel de controlo',
                body: 'Este painel serve como centro de controlo: troca de modo, acesso a todas as ferramentas, estatísticas e definições da conta.',
                color: '#0f172a',
              },
              {
                icon: '🔒',
                title: 'Privacidade por design',
                body: 'Toda a informação de saúde é encriptada em repouso e em trânsito. Os teus dados nunca são vendidos nem partilhados.',
                color: '#065f46',
              },
            ].map(tip => (
              <div key={tip.title} style={{
                background: 'white', borderRadius: 14,
                border: '1px solid rgba(0,0,0,0.07)',
                padding: '18px 20px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${tip.color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: tip.icon.length <= 2 ? 12 : 18,
                  fontWeight: 800, color: tip.color, flexShrink: 0,
                  fontFamily: 'monospace',
                }}>
                  {tip.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>{tip.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.65 }}>{tip.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 8: Feedback e contacto ───────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Feedback e contacto" />
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(0,0,0,0.07)',
            padding: '24px 24px',
            display: 'flex', gap: 24, alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Ajuda-nos a melhorar
              </div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 16 }}>
                O Phlox está em constante desenvolvimento. O teu feedback é o que nos guia.
                Reporta problemas, sugere funcionalidades ou conta-nos como usas a plataforma.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Link href="/feedback" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 10,
                  background: meta.color, color: 'white',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  Enviar feedback
                </Link>
                <Link href="/changelog" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 10,
                  background: '#f8fafc', color: '#374151',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  border: '1px solid #e2e8f0',
                }}>
                  Ver changelog completo
                </Link>
              </div>
            </div>
            <div style={{
              padding: '16px 20px', background: '#f8fafc',
              borderRadius: 12, minWidth: 200, flex: 1,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>
                Contacto direto
              </div>
              {[
                { label: 'Suporte técnico', value: 'suporte@phlox.pt' },
                { label: 'Parcerias clínicas', value: 'clinico@phlox.pt' },
                { label: 'Privacidade', value: 'privacidade@phlox.pt' },
              ].map(c => (
                <div key={c.label} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>{c.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 9: Comparação de planos ──────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <SectionHeader label="Planos disponíveis" right={
            <Link href="/pricing" style={{ fontSize: 12, color: meta.color, fontWeight: 600, textDecoration: 'none' }}>
              Ver detalhes →
            </Link>
          } />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
            gap: 10,
          }}>
            {[
              {
                name: 'Grátis',
                price: '0€',
                desc: 'Para experimentar a plataforma',
                features: ['Verificação de interações', 'Bula simplificada', 'Alimentos a evitar'],
                color: '#64748b',
                current: !user?.plan || user?.plan === 'free',
              },
              {
                name: 'Pro',
                price: '4,99€/mês',
                desc: 'Para cuidadores e doentes crónicos',
                features: ['Tudo do Grátis', 'Lembretes push', 'Horário inteligente', 'Passaporte de saúde', 'Relatório semanal'],
                color: '#0d9488',
                current: user?.plan === 'pro',
              },
              {
                name: 'Estudante',
                price: '2,99€/mês',
                desc: 'Para estudantes de ciências da saúde',
                features: ['Tudo do Pro', 'Arena e ligas', 'Simulador clínico', 'OSCE', 'AI Tutor'],
                color: '#7c3aed',
                current: user?.plan === 'student',
              },
              {
                name: 'Clínica',
                price: '19,99€/mês',
                desc: 'Para farmácias e clínicas',
                features: ['Tudo do Pro', 'Turno e Ronda', 'MAR', 'Oracle AI', 'Reconciliação'],
                color: '#2563eb',
                current: user?.plan === 'clinic',
              },
            ].map(plan => (
              <div key={plan.name} style={{
                background: 'white', borderRadius: 14,
                border: `1.5px solid ${plan.current ? plan.color : 'rgba(0,0,0,0.07)'}`,
                padding: '18px 18px',
                position: 'relative',
              }}>
                {plan.current && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    fontSize: 9, fontWeight: 700, color: plan.color,
                    background: `${plan.color}15`, padding: '2px 7px',
                    borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                  }}>
                    Ativo
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 2 }}>{plan.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, marginBottom: 4 }}>{plan.price}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, lineHeight: 1.4 }}>{plan.desc}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#374151' }}>
                      <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                {!plan.current && (
                  <Link href="/pricing" style={{
                    display: 'block', marginTop: 12, padding: '8px',
                    background: `${plan.color}10`, borderRadius: 8,
                    fontSize: 12, fontWeight: 700, color: plan.color,
                    textDecoration: 'none', textAlign: 'center',
                  }}>
                    Ver plano →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }

        .dash-mode-btn:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important;
          transform: translateY(-2px) !important;
        }
        .dash-tool-card > div:hover {
          transform: translateX(3px) !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.07) !important;
        }
        .acc-row > div:hover {
          background: #f8fafc !important;
        }
        .quick-btn > div:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08) !important;
        }

        @media (max-width: 640px) {
          .dash-tool-card > div {
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}

// ─── PlanBadge helper ─────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string | undefined }) {
  const labels: Record<string, { label: string; color: string }> = {
    free:     { label: 'Grátis',    color: '#64748b' },
    pro:      { label: 'Pro',       color: '#0d9488' },
    student:  { label: 'Estudante', color: '#7c3aed' },
    clinic:   { label: 'Clínica',   color: '#2563eb' },
  }
  const p = labels[plan || 'free'] || labels.free
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20,
      background: `${p.color}15`,
      fontSize: 11, fontWeight: 700, color: p.color,
      letterSpacing: '0.04em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
      {p.label}
    </span>
  )
}

// ─── ModeColorDot helper ──────────────────────────────────────────────────────

function ModeColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}

// ─── SectionDivider helper ────────────────────────────────────────────────────

function SectionDivider({ label }: { label?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      margin: '4px 0 16px',
    }}>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
      {label && (
        <span style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
    </div>
  )
}

// ─── Note: PlanBadge, ModeColorDot, SectionDivider are available
// for use in sub-components and future dashboard sections.
// They are exported-ready utility helpers.
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
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid #e2e8f0',
          borderTopColor: '#0d6e42',
          animation: 'dashSpin 0.7s linear infinite',
        }} />
        <style>{`@keyframes dashSpin { to { transform:rotate(360deg); } }`}</style>
      </div>
    )
  }

  return <DashboardContent />
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <DashboardRouter />
    </Suspense>
  )
}
