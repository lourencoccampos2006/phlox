'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

// ════════════════════════════════════════════════════════════════════════════
//  ONBOARDING — a peça central. Igual para todos. Adapta a plataforma a cada um.
//  Captura: perfil → detalhes (instituição/função, área/ano, etc.) → confirma.
//  Guarda na BD (profiles) para futuros logins e configura o ambiente.
// ════════════════════════════════════════════════════════════════════════════

type Profile = 'personal' | 'caregiver' | 'student' | 'professional'

const PROFILES: { id: Profile; label: string; desc: string; accent: string; bg: string; border: string }[] = [
  { id: 'personal',     label: 'Uso pessoal',            desc: 'Gerir a minha saúde e medicação',                 accent: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0' },
  { id: 'caregiver',    label: 'Cuidador familiar',      desc: 'Cuidar da saúde de um familiar',                  accent: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { id: 'student',      label: 'Estudante de saúde',     desc: 'Estudar e treinar para a minha área',             accent: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
  { id: 'professional', label: 'Profissional / Instituição', desc: 'Gerir e trabalhar numa organização de saúde', accent: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
]

const INSTITUTIONS = [
  { id: 'nursing_home',       label: 'Lar / ERPI',           desc: 'Residentes, turnos, MAR' },
  { id: 'hospital',           label: 'Hospital',             desc: 'Doentes, rondas, validação' },
  { id: 'clinic',             label: 'Clínica',              desc: 'Doentes, consultas' },
  { id: 'pharmacy_hospital',  label: 'Farmácia Hospitalar',  desc: 'Validação, farmacoterapia' },
  { id: 'pharmacy_community', label: 'Farmácia Comunitária', desc: 'Clientes, interações' },
  { id: 'health_center',      label: 'Centro de Saúde',      desc: 'Utentes, CSP' },
]
const ROLES = [
  { id: 'nurse', label: 'Enfermeiro(a)' }, { id: 'pharmacist', label: 'Farmacêutico(a)' },
  { id: 'doctor', label: 'Médico(a)' }, { id: 'coordinator', label: 'Coordenador(a)' },
  { id: 'director', label: 'Diretor(a) Técnico(a)' }, { id: 'caregiver', label: 'Ajudante / Auxiliar' },
  { id: 'admin', label: 'Administrativo(a)' },
]
const STUDENT_AREAS = [
  { id: 'medicine', label: 'Medicina' }, { id: 'dentistry', label: 'Medicina Dentária' },
  { id: 'pharmacy', label: 'Farmácia' }, { id: 'nursing', label: 'Enfermagem' },
  { id: 'biomedical', label: 'Análises Clínicas / Biomédicas' }, { id: 'physiotherapy', label: 'Fisioterapia' },
  { id: 'nutrition', label: 'Nutrição' }, { id: 'veterinary', label: 'Veterinária' },
  { id: 'psychology', label: 'Psicologia' }, { id: 'other', label: 'Outra' },
]
const YEARS = ['1º', '2º', '3º', '4º', '5º', '6º', 'Mestrado', 'Outro']
const CAREGIVER_OF = [
  { id: 'parent', label: 'Pai / mãe' }, { id: 'spouse', label: 'Cônjuge' },
  { id: 'child', label: 'Filho(a)' }, { id: 'other', label: 'Outro familiar' },
]
const PERSONAL_GOALS = [
  { id: 'meds', label: 'Gerir a minha medicação' }, { id: 'track', label: 'Acompanhar a minha saúde' },
  { id: 'interactions', label: 'Verificar interações' }, { id: 'understand', label: 'Perceber receitas e análises' },
]

const STEP_TITLES = ['Perfil', 'Detalhes', 'Pronto']

export default function OnboardingPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [anim, setAnim] = useState(false)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [instType, setInstType] = useState('')
  const [role, setRole] = useState('')
  const [area, setArea] = useState('')
  const [year, setYear] = useState('')
  const [sub, setSub] = useState('')

  useEffect(() => {
    if (!user) router.push('/login')
    else if ((user as any)?.onboarded === true) router.push('/inicio')
  }, [user, router])

  const go = (n: number) => { setAnim(true); setTimeout(() => { setStep(n); setAnim(false) }, 160) }
  const meta = profile ? PROFILES.find(p => p.id === profile)! : null
  const accent = meta?.accent || 'var(--green)'

  // Detail step completeness
  const detailReady =
    profile === 'professional' ? !!instType :
    profile === 'student' ? !!area :
    true // caregiver/personal: sub is optional

  function experienceMode(): string {
    if (profile === 'professional') return 'clinical'
    if (profile === 'caregiver') return 'caregiver'
    if (profile === 'student') return 'student'
    return 'personal'
  }

  async function finish() {
    if (!user || saving) return
    setSaving(true)
    const answers = { profile, instType, role, area, year, sub }
    if (profile === 'professional' && instType) {
      try { localStorage.setItem('phlox-clinic-institution', instType) } catch {}
    }
    if (profile === 'student' && area) {
      try { localStorage.setItem('phlox-student-area', area) } catch {}
    }
    // 1) Colunas garantidas — completa o onboarding sempre
    await supabase.from('profiles').update({
      onboarded: true,
      profile_type: profile === 'caregiver' ? 'personal' : profile,
      profile_sub: sub || null,
      experience_mode: experienceMode(),
    }).eq('id', user.id)
    // 2) Colunas do sprint17 — best-effort (não bloqueia se ainda não existirem)
    await supabase.from('profiles').update({
      institution_type: profile === 'professional' ? instType : null,
      professional_role: profile === 'professional' ? role : (profile === 'caregiver' ? 'caregiver' : null),
      student_area: profile === 'student' ? area : null,
      student_year: profile === 'student' ? year : null,
      onboarding_answers: answers,
    }).eq('id', user.id)
    const dest = profile === 'professional' ? '/cockpit' : '/inicio'
    router.push(dest)
  }

  // ── Reusable bits ──
  const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '9px 15px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-sans)',
      border: `1.5px solid ${on ? accent : 'var(--border)'}`, background: on ? meta?.bg : 'white',
      color: on ? accent : 'var(--ink-3)', fontSize: 13, fontWeight: on ? 700 : 500,
    }}>{label}</button>
  )
  const SecLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{children}</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg width="34" height="34" viewBox="0 0 28 28" fill="none" style={{ marginBottom: 8 }}>
            <rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>PHLOX</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, alignItems: 'center' }}>
          {STEP_TITLES.map((t, i) => (
            <div key={t} style={{ flex: 1 }}>
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? accent : 'var(--border)', transition: 'background 0.3s' }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: i <= step ? accent : 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>{t}</div>
            </div>
          ))}
        </div>

        <div style={{ opacity: anim ? 0 : 1, transform: anim ? 'translateY(8px)' : 'none', transition: 'opacity 0.16s, transform 0.16s' }}>

          {/* STEP 0 — perfil */}
          {step === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, marginBottom: 8, letterSpacing: '-0.02em' }}>Bem-vindo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
                <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.6 }}>Como vais usar o Phlox? A plataforma adapta-se ao teu perfil e só te mostra o que precisas.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PROFILES.map(p => (
                  <button key={p.id} onClick={() => { setProfile(p.id); go(1) }} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = p.accent; e.currentTarget.style.background = p.bg }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'white' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{p.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>{p.desc}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — detalhes (por perfil) */}
          {step === 1 && profile && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 26 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{meta?.label}</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                  {profile === 'professional' ? 'Sobre a tua organização' : profile === 'student' ? 'Sobre o teu curso' : profile === 'caregiver' ? 'De quem cuidas?' : 'Qual é o teu objetivo?'}
                </h2>
              </div>

              {profile === 'professional' && (
                <>
                  <SecLabel>Tipo de instituição</SecLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
                    {INSTITUTIONS.map(i => (
                      <button key={i.id} onClick={() => setInstType(i.id)} style={{ padding: '13px 14px', borderRadius: 10, border: `1.5px solid ${instType === i.id ? accent : 'var(--border)'}`, background: instType === i.id ? meta?.bg : 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: instType === i.id ? accent : 'var(--ink)' }}>{i.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{i.desc}</div>
                      </button>
                    ))}
                  </div>
                  <SecLabel>A tua função</SecLabel>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                    {ROLES.map(r => <Chip key={r.id} on={role === r.id} label={r.label} onClick={() => setRole(r.id)} />)}
                  </div>
                </>
              )}

              {profile === 'student' && (
                <>
                  <SecLabel>Área de estudo</SecLabel>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
                    {STUDENT_AREAS.map(a => <Chip key={a.id} on={area === a.id} label={a.label} onClick={() => setArea(a.id)} />)}
                  </div>
                  <SecLabel>Ano</SecLabel>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {YEARS.map(y => <Chip key={y} on={year === y} label={y} onClick={() => setYear(y)} />)}
                  </div>
                </>
              )}

              {profile === 'caregiver' && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {CAREGIVER_OF.map(c => <Chip key={c.id} on={sub === c.id} label={c.label} onClick={() => setSub(c.id)} />)}
                </div>
              )}

              {profile === 'personal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PERSONAL_GOALS.map(g => (
                    <button key={g.id} onClick={() => setSub(g.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${sub === g.id ? accent : 'var(--border)'}`, background: sub === g.id ? meta?.bg : 'white', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{g.label}</span>
                      {sub === g.id && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 26 }}>
                <button onClick={() => { go(0); setProfile(null); setInstType(''); setRole(''); setArea(''); setYear(''); setSub('') }} style={{ padding: '13px 18px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>← Voltar</button>
                <button onClick={() => go(2)} disabled={!detailReady} style={{ flex: 1, padding: '13px', background: detailReady ? accent : 'var(--bg-3)', color: detailReady ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: detailReady ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Continuar</button>
              </div>
            </div>
          )}

          {/* STEP 2 — pronto */}
          {step === 2 && meta && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: meta.bg, border: `2px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, marginBottom: 12, letterSpacing: '-0.02em' }}>Está tudo pronto!</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
                {profile === 'professional' ? 'O teu espaço clínico está configurado para a tua instituição. Mostramos só as ferramentas profissionais que precisas — podes adicionar mais nas Definições.'
                  : profile === 'student' ? 'Modo estudo adaptado à tua área. Treina, estuda e compete na comunidade.'
                  : profile === 'caregiver' ? 'O teu espaço de cuidador está pronto, com ferramentas focadas na família.'
                  : 'O teu espaço pessoal está pronto, simples e direto ao que precisas.'}
              </p>
              <button onClick={finish} disabled={saving} style={{ width: '100%', maxWidth: 360, padding: '14px', background: saving ? 'var(--bg-3)' : accent, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                {saving ? 'A configurar…' : 'Entrar na plataforma →'}
              </button>
              <div style={{ marginTop: 14 }}>
                <button onClick={() => go(1)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-5)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>← Rever respostas</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
          Podes alterar tudo a qualquer momento nas Definições.
        </div>
      </div>
    </div>
  )
}
