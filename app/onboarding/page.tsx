'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

// ─── NOVO: adicionado 'caregiver' como 4º tipo de perfil ───
type ProfileType = 'personal' | 'student' | 'professional' | 'caregiver'
type PersonalSub = 'myself' | 'family' | 'both'
type ProfSub = 'doctor' | 'pharmacist' | 'nurse' | 'other'
type StudentSub = 'medicine' | 'pharmacy' | 'nursing' | 'other'
type CaregiverSub = 'parent' | 'child' | 'spouse' | 'other'

const STEPS = ['perfil', 'detalhe', 'pronto']

export default function OnboardingPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [sub, setSub] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [animating, setAnimating] = useState(false)

  const next = (p?: ProfileType) => {
    setAnimating(true)
    setTimeout(() => {
      if (p) setProfile(p)
      setStep(s => s + 1)
      setAnimating(false)
    }, 200)
  }

  // ─── NOVO: mapeamento profile → experience_mode ───
  function getExperienceMode(): string {
    if (profile === 'professional') return 'clinical'
    if (profile === 'caregiver') return 'caregiver'
    if (profile === 'student') return 'student'
    if (profile === 'personal' && (sub === 'family' || sub === 'both')) return 'caregiver'
    return 'personal'
  }

  const finish = async () => {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({
        onboarded: true,
        profile_type: profile === 'caregiver' ? 'personal' : profile,
        profile_sub: sub,
        experience_mode: getExperienceMode(),
      }).eq('id', user.id)
    } catch {}
    const dest = profile === 'professional' ? '/dashboard?mode=pro'
      : profile === 'student' ? '/dashboard?mode=student'
      : '/dashboard?mode=personal'
    router.push(dest)
  }

  const PROFILES = [
    {
      id: 'personal' as ProfileType,
      label: 'Uso pessoal',
      desc: 'Giro a minha própria medicação',
      accent: 'var(--green)',
      bg: 'var(--green-light)',
      border: 'var(--green-mid)',
      features: ['Diário de sintomas', 'Alertas de renovação', 'Verificação de interações', 'Guia de automedicação'],
    },
    // ─── NOVO: perfil Cuidador ───
    {
      id: 'caregiver' as ProfileType,
      label: 'Cuidador familiar',
      desc: 'Cuido de um familiar — pais, filhos, cônjuge',
      accent: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      features: ['Perfis por familiar', 'Medicação de cada um', 'Interações cruzadas', 'Consultas preparadas'],
    },
    {
      id: 'student' as ProfileType,
      label: 'Estudante',
      desc: 'Medicina, farmácia, enfermagem ou nutrição',
      accent: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
      features: ['Tutor IA socrático', 'Progressão por classe', 'Banco de erros', 'Simulador de prescrição'],
    },
    {
      id: 'professional' as ProfileType,
      label: 'Profissional de saúde',
      desc: 'Médico, farmacêutico, enfermeiro ou técnico',
      accent: '#1d4ed8',
      bg: '#eff6ff',
      border: '#bfdbfe',
      features: ['Gestão de doentes', 'Co-piloto clínico IA', 'Validador de prescrição', 'Relatórios PDF'],
    },
  ]

  const PERSONAL_SUBS = [
    { id: 'myself', label: 'Para mim próprio', desc: 'Giro a minha própria medicação' },
    { id: 'family', label: 'Para um familiar', desc: 'Cuido da medicação de outra pessoa' },
    { id: 'both', label: 'Para mim e família', desc: 'Múltiplos perfis de medicação' },
  ]

  // ─── NOVO: subs do Cuidador ───
  const CAREGIVER_SUBS = [
    { id: 'parent', label: 'Pai ou mãe', desc: 'Cuido da medicação dos meus pais' },
    { id: 'child', label: 'Filho ou filha', desc: 'Cuido da medicação dos meus filhos' },
    { id: 'spouse', label: 'Cônjuge ou parceiro', desc: 'Cuido da medicação do meu cônjuge' },
    { id: 'other', label: 'Outro familiar', desc: 'Avós, irmãos, ou outro familiar próximo' },
  ]

  const STUDENT_SUBS = [
    { id: 'medicine', label: 'Medicina', desc: 'Curso de medicina' },
    { id: 'pharmacy', label: 'Farmácia', desc: 'Curso de farmácia' },
    { id: 'nursing', label: 'Enfermagem', desc: 'Curso de enfermagem' },
    { id: 'other', label: 'Outro', desc: 'Outra área de saúde' },
  ]

  const PROF_SUBS = [
    { id: 'doctor', label: 'Médico', desc: 'Clínica geral, especialidade ou hospital' },
    { id: 'pharmacist', label: 'Farmacêutico', desc: 'Comunitário ou hospitalar' },
    { id: 'nurse', label: 'Enfermeiro', desc: 'Hospital, clínica ou cuidados domiciliários' },
    { id: 'other', label: 'Outro profissional', desc: 'Técnico, nutricionista ou outra área' },
  ]

  const currentProfile = PROFILES.find(p => p.id === profile)
  const subs = profile === 'personal' ? PERSONAL_SUBS
    : profile === 'caregiver' ? CAREGIVER_SUBS
    : profile === 'student' ? STUDENT_SUBS
    : PROF_SUBS

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
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 12 }}>
            <rect width="28" height="28" rx="6" fill="var(--green)"/>
            <path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em' }}>PHLOX CLINICAL</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--green)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'none', transition: 'opacity 0.2s, transform 0.2s' }}>

          {/* STEP 0: Choose profile */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.02em' }}>
                  Bem-vindo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                </h1>
                <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  Como vais usar o Phlox? A plataforma adapta-se completamente ao teu perfil.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PROFILES.map(p => (
                  <button key={p.id} onClick={() => { next(p.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 22px', background: 'white', border: `2px solid var(--border)`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = p.accent; e.currentTarget.style.background = p.bg }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'white' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>{p.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5, marginBottom: 12 }}>{p.desc}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {p.features.map(f => (
                          <span key={f} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: p.accent, background: p.bg, border: `1px solid ${p.border}`, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: Detail */}
          {step === 1 && profile && (
            <div>
              <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: currentProfile?.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {currentProfile?.label}
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 10, letterSpacing: '-0.02em' }}>
                  {profile === 'personal' ? 'Para quem é a medicação?'
                    : profile === 'caregiver' ? 'De quem cuidas principalmente?'
                    : profile === 'student' ? 'Que curso estás a fazer?'
                    : 'Qual é a tua especialidade?'}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                  Isto ajuda-nos a personalizar as ferramentas e os exemplos.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {subs.map(s => (
                  <button key={s.id} onClick={() => setSub(s.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: sub === s.id ? currentProfile?.bg : 'white', border: `2px solid ${sub === s.id ? (currentProfile?.accent || 'var(--green)') : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{s.desc}</div>
                    </div>
                    {sub === s.id && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={currentProfile?.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => next()} disabled={!sub}
                style={{ width: '100%', padding: '14px', background: sub ? 'var(--ink)' : 'var(--bg-3)', color: sub ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: sub ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
                Continuar →
              </button>
            </div>
          )}

          {/* STEP 2: Ready */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: currentProfile?.bg, border: `2px solid ${currentProfile?.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={currentProfile?.accent} strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.02em' }}>
                Pronto, {user?.name?.split(' ')[0] || 'bem-vindo'}!
              </h2>
              <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
                {profile === 'personal'
                  ? 'O teu espaço pessoal está pronto. Começa por adicionar os teus medicamentos e criar perfis familiares.'
                  : profile === 'caregiver'
                  ? 'O teu espaço de cuidador está pronto. Cria um perfil para cada familiar e regista a medicação de cada um.'
                  : profile === 'student'
                  ? 'O teu modo de estudo está configurado. O Phlox AI é o teu tutor — começa por fazer uma pergunta sobre farmacologia.'
                  : 'O teu espaço clínico está pronto. Cria o primeiro perfil de doente e o co-piloto IA tem imediatamente contexto para ajudar.'
                }
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400, margin: '0 auto' }}>
                {profile === 'personal' && [
                  ['Adicionar a minha medicação', '/mymeds'],
                  ['Verificar interações', '/interactions'],
                  ['Perceber as minhas análises', '/labs'],
                ].map(([label, href]) => (
                  <button key={href} onClick={() => { finish(); }} style={{ padding: '13px', background: label.includes('medicação') ? 'var(--ink)' : 'white', color: label.includes('medicação') ? 'white' : 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                    {label}
                  </button>
                ))}
                {/* ─── NOVO: botões do Cuidador ─── */}
                {profile === 'caregiver' && [
                  ['Criar perfil familiar', '/perfis'],
                  ['Verificar interações', '/interactions'],
                  ['Perceber análises', '/labs'],
                ].map(([label, href]) => (
                  <button key={href} onClick={() => finish()} style={{ padding: '13px', background: label.includes('perfil') ? '#d97706' : 'white', color: label.includes('perfil') ? 'white' : 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                    {label}
                  </button>
                ))}
                {profile === 'student' && [
                  ['Falar com o Phlox AI', '/ai'],
                  ['Ver o meu progresso', '/dashboard'],
                  ['Começar flashcards', '/study'],
                ].map(([label, href]) => (
                  <button key={href} onClick={() => finish()} style={{ padding: '13px', background: label.includes('AI') ? '#7c3aed' : 'white', color: label.includes('AI') ? 'white' : 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                    {label}
                  </button>
                ))}
                {profile === 'professional' && [
                  ['Criar primeiro doente', '/dashboard?tab=patients'],
                  ['Abrir co-piloto IA', '/ai'],
                  ['Ver ferramentas clínicas', '/dashboard'],
                ].map(([label, href]) => (
                  <button key={href} onClick={() => finish()} style={{ padding: '13px', background: label.includes('doente') ? '#1d4ed8' : 'white', color: label.includes('doente') ? 'white' : 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-5)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            Saltar onboarding →
          </button>
        </div>
      </div>
    </div>
  )
}