'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

type Profile = 'patient' | 'student' | 'professional' | 'other'

const PROFILES: { id: Profile; icon: string; title: string; desc: string; tools: string[] }[] = [
  {
    id: 'patient',
    icon: '🧑',
    title: 'Doente ou familiar',
    desc: 'Quero perceber a minha medicação e verificar se é segura',
    tools: ['Interpretação de análises', 'A minha medicação', 'Verificador de interações', 'Segurança do medicamento'],
  },
  {
    id: 'student',
    icon: '🎓',
    title: 'Estudante',
    desc: 'Estudo farmácia, medicina, enfermagem ou nutrição',
    tools: ['Casos clínicos interactivos', 'Modo Exame com timer', 'Flashcards e quizzes', 'Phlox AI'],
  },
  {
    id: 'professional',
    icon: '⚕️',
    title: 'Profissional de saúde',
    desc: 'Sou médico, farmacêutico, enfermeiro ou técnico',
    tools: ['Protocolo terapêutico', 'Simulador de estratégias', 'Revisão de medicação', 'Compatibilidade IV'],
  },
  {
    id: 'other',
    icon: '👀',
    title: 'Apenas explorar',
    desc: 'Quero ver o que a plataforma oferece',
    tools: ['Verificador de interações', 'Base de dados FDA', 'Calculadoras clínicas', 'Análise rápida'],
  },
]

const REDIRECT: Record<Profile, string> = {
  patient:      '/mymeds',
  student:      '/study',
  professional: '/strategy',
  other:        '/interactions',
}

export default function OnboardingPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  const finish = async () => {
    if (!selected || !user) return
    setSaving(true)
    try {
      // Save profile preference
      await supabase.from('profiles').update({ onboarded: true, profile_type: selected }).eq('id', user.id)
    } catch { /* non-critical */ }
    router.push(REDIRECT[selected])
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            Bem-vindo{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </div>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            Como descreves melhor o teu perfil?<br />
            <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>Vai personalizar as ferramentas que vês primeiro.</span>
          </p>
        </div>

        {/* Profile cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {PROFILES.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              style={{ background: selected === p.id ? 'var(--green-light)' : 'white', border: `2px solid ${selected === p.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 12, padding: '20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>{p.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5, marginBottom: 12 }}>{p.desc}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {p.tools.map(t => (
                  <div key={t} style={{ display: 'flex', gap: 6, fontSize: 11, color: selected === p.id ? 'var(--green-2)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    <span>→</span><span>{t}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={finish} disabled={!selected || saving}
            style={{ width: '100%', padding: '14px', background: selected && !saving ? 'var(--green)' : 'var(--bg-3)', color: selected && !saving ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 600, cursor: selected && !saving ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', transition: 'background 0.15s' }}>
            {saving ? 'A guardar...' : selected ? `Começar como ${PROFILES.find(p => p.id === selected)?.title} →` : 'Escolhe o teu perfil'}
          </button>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Saltar por agora
          </button>
        </div>

        <div style={{ marginTop: 24, fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
          Podes alterar o teu perfil a qualquer momento nas definições da conta.
        </div>
      </div>
    </div>
  )

}
