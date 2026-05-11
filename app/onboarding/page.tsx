'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

type ProfileType = 'personal' | 'student' | 'professional' | 'caregiver'

const STEPS = ['perfil', 'detalhe', 'pronto']

export default function OnboardingPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!user) router.push('/login')
    else if ((user as any)?.onboarded === true) router.push('/dashboard')
  }, [user, router])

  const next = (p?: ProfileType) => {
    setAnimating(true)
    setTimeout(() => {
      if (p) setProfile(p)
      setStep(s => s + 1)
      setAnimating(false)
    }, 180)
  }

  function getExperienceMode(): string {
    if (profile === 'professional') return 'clinical'
    if (profile === 'caregiver') return 'caregiver'
    if (profile === 'student') return 'student'
    if (profile === 'personal' && (sub === 'family' || sub === 'both')) return 'caregiver'
    return 'personal'
  }

  const finish = async (dest?: string) => {
    if (!user || saving) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({
        onboarded: true,
        profile_type: profile === 'caregiver' ? 'personal' : profile,
        profile_sub: sub,
        experience_mode: getExperienceMode(),
      }).eq('id', user.id)
    } catch (_e: any) {}
    const fallback = profile === 'professional' ? '/dashboard'
      : profile === 'student' ? '/dashboard'
      : '/dashboard'
    router.push(dest || fallback)
  }

  const PROFILES = [
    {
      id: 'personal' as ProfileType,
      label: 'Uso pessoal',
      desc: 'Giro a minha própria saúde e medicação',
      accent: '#0d6e42',
      bg: '#f0fdf5',
      border: '#bbf7d0',
      pills: ['Medicação pessoal', 'Interações', 'Care Plan', 'Timeline'],
    },
    {
      id: 'caregiver' as ProfileType,
      label: 'Cuidador familiar',
      desc: 'Cuido da medicação de um familiar',
      accent: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
      pills: ['Perfis familiares', 'Calendário de tomas', 'Alertas', 'Consultas'],
    },
    {
      id: 'student' as ProfileType,
      label: 'Estudante de saúde',
      desc: 'Medicina, farmácia, enfermagem ou nutrição',
      accent: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
      pills: ['Arena de ligas', 'OSCE', 'AI Tutor', 'Flashcards'],
    },
    {
      id: 'professional' as ProfileType,
      label: 'Profissional de saúde',
      desc: 'Farmacêutico, médico, enfermeiro ou técnico',
      accent: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
      pills: ['Ward colaborativo', 'Co-piloto IA', 'Rounds PCNE', 'Connect'],
    },
  ]

  const SUBS: Record<ProfileType, { id: string; label: string; desc: string }[]> = {
    personal: [
      { id: 'myself', label: 'Para mim próprio', desc: 'Giro a minha própria medicação' },
      { id: 'family', label: 'Para um familiar', desc: 'Cuido da medicação de outra pessoa' },
      { id: 'both', label: 'Para mim e família', desc: 'Múltiplos perfis de medicação' },
    ],
    caregiver: [
      { id: 'parent', label: 'Pai ou mãe', desc: 'Cuido da medicação dos meus pais' },
      { id: 'child', label: 'Filho ou filha', desc: 'Cuido da medicação dos meus filhos' },
      { id: 'spouse', label: 'Cônjuge ou parceiro', desc: 'Cuido da medicação do meu cônjuge' },
      { id: 'other', label: 'Outro familiar', desc: 'Avós, irmãos ou outro familiar próximo' },
    ],
    student: [
      { id: 'medicine', label: 'Medicina', desc: 'Curso de medicina' },
      { id: 'pharmacy', label: 'Farmácia', desc: 'Curso de farmácia' },
      { id: 'nursing', label: 'Enfermagem', desc: 'Curso de enfermagem' },
      { id: 'other', label: 'Outro', desc: 'Nutrição, fisioterapia, dentária ou outra' },
    ],
    professional: [
      { id: 'pharmacist', label: 'Farmacêutico', desc: 'Comunitário ou hospitalar' },
      { id: 'doctor', label: 'Médico', desc: 'Clínica geral, especialidade ou hospital' },
      { id: 'nurse', label: 'Enfermeiro', desc: 'Hospital, clínica ou cuidados domiciliários' },
      { id: 'other', label: 'Outro profissional', desc: 'Técnico, nutricionista ou outra área' },
    ],
  }

  const FINISH_ACTIONS: Record<ProfileType, { label: string; href: string; primary: boolean }[]> = {
    personal: [
      { label: 'Adicionar os meus medicamentos', href: '/mymeds', primary: true },
      { label: 'Verificar interações', href: '/interactions', primary: false },
      { label: 'Explorar o dashboard', href: '/dashboard', primary: false },
    ],
    caregiver: [
      { label: 'Criar perfil familiar', href: '/perfis', primary: true },
      { label: 'Verificar interações', href: '/interactions', primary: false },
      { label: 'Explorar o dashboard', href: '/dashboard', primary: false },
    ],
    student: [
      { label: 'Entrar na Arena', href: '/arena', primary: true },
      { label: 'Falar com o AI Tutor', href: '/ai', primary: false },
      { label: 'Começar flashcards', href: '/study', primary: false },
    ],
    professional: [
      { label: 'Criar primeiro doente', href: '/patients', primary: true },
      { label: 'Abrir co-piloto IA', href: '/ai', primary: false },
      { label: 'Ver ferramentas clínicas', href: '/dashboard', primary: false },
    ],
  }

  const currentProfile = PROFILES.find(p => p.id === profile)
  const subs = profile ? SUBS[profile] : []
  const finishActions = profile ? FINISH_ACTIONS[profile] : []

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <svg width="34" height="34" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 10 }}>
            <rect width="28" height="28" rx="6" fill="var(--green)"/>
            <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>PHLOX</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-5)', letterSpacing: '0.2em', marginTop: 3 }}>CLINICAL</div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? (currentProfile?.accent || 'var(--green)') : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div style={{
          opacity: animating ? 0 : 1,
          transform: animating ? 'translateY(10px)' : 'none',
          transition: 'opacity 0.18s, transform 0.18s',
        }}>

          {/* STEP 0 — escolher perfil */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Bem-vindo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </h1>
                <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.65 }}>
                  Como vais usar o Phlox? A plataforma adapta-se completamente ao teu perfil.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PROFILES.map(p => (
                  <button key={p.id} onClick={() => next(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 18,
                      padding: '18px 22px',
                      background: 'white',
                      border: '1.5px solid var(--border)',
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
                      width: '100%',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = p.accent
                      e.currentTarget.style.background = p.bg
                      e.currentTarget.style.boxShadow = 'var(--shadow-xs)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'white'
                      e.currentTarget.style.boxShadow = 'none'
                    }}>
                    {/* Accent dot */}
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, letterSpacing: '-0.01em' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, marginBottom: 10 }}>{p.desc}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {p.pills.map(f => (
                          <span key={f} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.accent, background: p.bg, border: `1px solid ${p.border}`, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — detalhe */}
          {step === 1 && profile && (
            <div>
              <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: currentProfile?.accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {currentProfile?.label}
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {profile === 'personal' ? 'Para quem é a medicação?'
                    : profile === 'caregiver' ? 'De quem cuidas principalmente?'
                    : profile === 'student' ? 'Que curso estás a fazer?'
                    : 'Qual é a tua função?'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6 }}>
                  Isto personaliza os exemplos e sugestões do AI.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {subs.map(s => (
                  <button key={s.id} onClick={() => setSub(s.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px',
                      background: sub === s.id ? currentProfile?.bg : 'white',
                      border: `1.5px solid ${sub === s.id ? (currentProfile?.accent || 'var(--green)') : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s', width: '100%',
                    }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{s.desc}</div>
                    </div>
                    {sub === s.id && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={currentProfile?.accent} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setStep(0); setSub(null); setProfile(null) }}
                  style={{ padding: '13px 18px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
                  ← Voltar
                </button>
                <button onClick={() => next()} disabled={!sub}
                  style={{ flex: 1, padding: '13px', background: sub ? (currentProfile?.accent || 'var(--ink)') : 'var(--bg-3)', color: sub ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: sub ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — pronto */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              {/* Check circle */}
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: currentProfile?.bg, border: `2px solid ${currentProfile?.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={currentProfile?.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>

              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Pronto, {user?.name?.split(' ')[0] || 'bem-vindo'}!
              </h2>

              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
                {profile === 'personal'
                  ? 'O teu espaço pessoal está configurado. Começa por adicionar os teus medicamentos.'
                  : profile === 'caregiver'
                  ? 'O teu espaço de cuidador está pronto. Cria um perfil para cada familiar.'
                  : profile === 'student'
                  ? 'Modo estudo activado. Entra na Arena ou faz uma pergunta ao AI Tutor.'
                  : 'Espaço clínico pronto. Cria o primeiro doente e o co-piloto IA tem contexto imediato.'
                }
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, margin: '0 auto' }}>
                {finishActions.map(({ label, href, primary }) => (
                  <button key={href}
                    onClick={() => finish(href)}
                    disabled={saving}
                    style={{
                      padding: '13px',
                      background: primary ? (currentProfile?.accent || 'var(--ink)') : 'white',
                      color: primary ? 'white' : 'var(--ink-2)',
                      border: primary ? 'none' : '1.5px solid var(--border)',
                      borderRadius: 9, fontSize: 14, fontWeight: primary ? 700 : 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em',
                      transition: 'opacity 0.15s',
                      opacity: saving ? 0.6 : 1,
                    }}>
                    {saving && primary ? 'A guardar...' : label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Skip */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button onClick={() => finish('/dashboard')}
            style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--ink-5)', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            Saltar e ir ao dashboard →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
