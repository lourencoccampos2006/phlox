'use client'

import { useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MODE_QUICK_ACTIONS } from '@/lib/navigation'
import { MODE_META } from '@/lib/experienceMode'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

function dateStr() {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function QuickCard({ href, icon, label, desc, color }: { href: string; icon: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} className="qc-link">
      <div style={{
        background: 'white', borderRadius: 14, padding: '18px 16px',
        border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 110,
        transition: 'transform 0.12s, box-shadow 0.12s',
      }} className="qc-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {icon}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

// ─── Personal mode ────────────────────────────────────────────────────────────

function PersonalHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const actions = MODE_QUICK_ACTIONS.personal.slice(0, 4)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Greeting */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '28px 24px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Medication status card */}
        <Link href="/mymeds" style={{ display: 'block', textDecoration: 'none', marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Medicação hoje</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  0<span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}> / 0 doses</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>Ver todas →</div>
            </div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '0%', background: '#0d6e42', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem medicamentos registados — <span style={{ color: '#0d6e42', fontWeight: 600 }}>adicionar agora</span></div>
          </div>
        </Link>

        {/* Quick actions 2x2 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Ações rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }} className="inicio-grid">
          {actions.map(a => (
            <QuickCard key={a.href} href={a.href} icon={a.icon} label={a.label} desc={a.desc} color="#0d6e42" />
          ))}
        </div>

        {/* Recent health */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px 22px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Últimas medições</div>
          <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
            Nenhuma medição registada —{' '}
            <Link href="/vitals" style={{ color: '#0d6e42', fontWeight: 600, textDecoration: 'none' }}>registar agora</Link>
          </div>
        </div>
      </div>

      <style>{`
        .qc-inner:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        @media(max-width:480px) { .inicio-grid { grid-template-columns:1fr !important; } }
      `}</style>
    </div>
  )
}

// ─── Caregiver mode ───────────────────────────────────────────────────────────

function CaregiverHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const PLACEHOLDER_PROFILES = [
    { name: 'João', age: 78, meds: 3, color: '#b45309' },
    { name: 'Maria', age: 74, meds: 5, color: '#b45309' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fffbeb' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #fde68a', padding: '28px 24px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 6px', textTransform: 'capitalize' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: '#fef3c7', marginTop: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b45309' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cuidador Familiar</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Alert banner */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Verificar adesão da família</div>
            <div style={{ fontSize: 12, color: '#b45309' }}>Confirme se todos os familiares tomaram a medicação de hoje</div>
          </div>
          <Link href="/mymeds" style={{ fontSize: 12, fontWeight: 700, color: '#b45309', textDecoration: 'none', whiteSpace: 'nowrap' }}>Ver →</Link>
        </div>

        {/* Family profiles */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>A minha família</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }} className="inicio-grid">
          {PLACEHOLDER_PROFILES.map(p => (
            <div key={p.name} style={{ background: 'white', borderRadius: 14, padding: '16px', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${p.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>
                👤
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.age} anos · {p.meds} meds</div>
            </div>
          ))}
          <Link href="/perfis" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', borderRadius: 14, padding: '16px', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 100, cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>+</div>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Adicionar familiar</div>
            </div>
          </Link>
        </div>

        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Ações rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="inicio-grid">
          {MODE_QUICK_ACTIONS.caregiver.slice(0, 4).map(a => (
            <QuickCard key={a.href} href={a.href} icon={a.icon} label={a.label} desc={a.desc} color="#b45309" />
          ))}
        </div>
      </div>

      <style>{`
        .qc-inner:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        @media(max-width:480px) { .inicio-grid { grid-template-columns:1fr !important; } }
      `}</style>
    </div>
  )
}

// ─── Clinical mode ────────────────────────────────────────────────────────────

function ClinicalHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const now = new Date()
  const hour = now.getHours()
  const shiftLabel = hour < 8 ? 'Noite (00:00–08:00)' : hour < 20 ? 'Dia (08:00–20:00)' : 'Noite (20:00–08:00)'

  const PENDING = [
    { name: 'Manuel S.', room: '12A', alert: 'Dose pendente — Digoxina 08:00', color: '#dc2626' },
    { name: 'Ana C.', room: '07B', alert: 'Interação detectada — verificar', color: '#d97706' },
    { name: 'José F.', room: '15', alert: 'Ronda farmacêutica — pendente', color: '#3b82f6' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Dark header section */}
      <div style={{ background: '#0f172a', padding: '28px 24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {shiftLabel}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: '0 0 16px', letterSpacing: '-0.03em' }}>
            Bom dia{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Doentes', value: '0' },
              { label: 'Intervenções', value: '0' },
              { label: 'MAR', value: '0%' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 18px', minWidth: 80 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'white', letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>
        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Ferramentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }} className="inicio-grid-3">
          {MODE_QUICK_ACTIONS.clinical.map(a => (
            <QuickCard key={a.href} href={a.href} icon={a.icon} label={a.label} desc={a.desc} color="#2563eb" />
          ))}
        </div>

        {/* Pending */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Pendentes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PENDING.map(p => (
            <div key={p.name} style={{ background: 'white', borderRadius: 12, padding: '14px 18px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.name} <span style={{ fontWeight: 400, color: '#94a3b8' }}>· Cama {p.room}</span></div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.alert}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .qc-inner:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        @media(max-width:600px) {
          .inicio-grid-3 { grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Student mode ─────────────────────────────────────────────────────────────

const FLASHCARDS = [
  { q: 'Qual o mecanismo principal das estatinas?', a: 'Inibição competitiva da HMG-CoA redutase → ↓ síntese hepática de colesterol → ↑ LDL-R → ↓ LDL plasmático.' },
  { q: 'Porque é que a varfarina tem interacções tão frequentes?', a: 'É metabolizada pelo CYP2C9 e inibe a epóxido redutase da vitamina K. Qualquer indutor/inibidor do CYP2C9 ou alimento rico em vitamina K altera o INR.' },
  { q: 'Qual a diferença entre farmacocinética e farmacodinâmica?', a: 'PK = o que o corpo faz ao fármaco (ADME). PD = o que o fármaco faz ao corpo (mecanismo, efeito, relação concentração-resposta).' },
  { q: 'O que é o efeito de primeira passagem?', a: 'Metabolismo pré-sistémico no intestino/fígado que reduz a biodisponibilidade oral. Ex: morfina oral tem biodisponibilidade ~25% vs IV 100%.' },
  { q: 'Para que serve o CKD-EPI?', a: 'Estima a taxa de filtração glomerular (TFG) a partir da creatinina sérica, idade e sexo — usado para ajuste de dose em insuficiência renal.' },
]

function StudentHome({ user }: { user: any }) {
  const firstName = user?.name?.split(' ')[0] || ''
  const card = FLASHCARDS[new Date().getDate() % FLASHCARDS.length]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ff' }}>
      {/* Gamified banner */}
      <div style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)', padding: '28px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 6px' }}>{dateStr()}</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: '0 0 16px', letterSpacing: '-0.03em' }}>
            {greeting()}{firstName ? `, ${firstName}` : ''} 🎓
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { icon: '🔥', label: '12 dias de streak' },
              { icon: '⭐', label: '2.840 XP' },
              { icon: '🥉', label: 'Bronze III' },
            ].map(b => (
              <div key={b.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{b.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Performance bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Arena', value: '64%', color: '#7c3aed' },
            { label: 'OSCE', value: '71%', color: '#7c3aed' },
            { label: 'Horas', value: '18h', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '14px', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Flashcard of the day */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Flashcard do dia</div>
        <div style={{ background: 'white', borderRadius: 16, padding: '22px', border: '1px solid rgba(124,58,237,0.15)', boxShadow: '0 4px 16px rgba(124,58,237,0.08)', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14, lineHeight: 1.5 }}>{card.q}</div>
          <div style={{ background: '#faf5ff', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#6d28d9', lineHeight: 1.7, borderLeft: '3px solid #7c3aed' }}>
            {card.a}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Ferramentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} className="inicio-grid-3">
          {MODE_QUICK_ACTIONS.student.map(a => (
            <QuickCard key={a.href} href={a.href} icon={a.icon} label={a.label} desc={a.desc} color="#7c3aed" />
          ))}
        </div>
      </div>

      <style>{`
        .qc-inner:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.08) !important; }
        @media(max-width:600px) { .inicio-grid-3 { grid-template-columns:repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

// ─── Router + Auth guard ──────────────────────────────────────────────────────

function InicioContent() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!user.onboarded) { router.push('/onboarding'); return }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #e2e8f0', borderTopColor: '#0d6e42', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const mode = user.experience_mode || 'personal'

  if (mode === 'caregiver') return <CaregiverHome user={user} />
  if (mode === 'clinical')  return <ClinicalHome  user={user} />
  if (mode === 'student')   return <StudentHome   user={user} />
  return <PersonalHome user={user} />
}

export default function InicioPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <InicioContent />
    </Suspense>
  )
}
