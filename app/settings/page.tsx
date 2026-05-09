'use client'

// ─── PHLOX SETTINGS ───────────────────────────────────────────────────────────
// Definições de perfil, preferências, e configuração do Connect.

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ROLE_OPTIONS = [
  { value: 'pharmacist',  label: 'Farmacêutico' },
  { value: 'physician',   label: 'Médico' },
  { value: 'nurse',       label: 'Enfermeiro' },
  { value: 'intern',      label: 'Interno' },
  { value: 'student',     label: 'Estudante' },
  { value: 'other',       label: 'Outro' },
]

const MODE_OPTIONS = [
  { value: 'clinical',   label: 'Profissional Clínico', sub: 'Farmácia, hospital, clínica' },
  { value: 'student',    label: 'Estudante',             sub: 'Medicina, farmácia, enfermagem...' },
  { value: 'caregiver',  label: 'Cuidador Familiar',     sub: 'Gestão de medicação de familiares' },
  { value: 'personal',   label: 'Uso Pessoal',           sub: 'A minha própria saúde' },
]

export default function SettingsPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'connect' | 'account'>('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    display_name: '',
    professional_role: '',
    institution: '',
    speciality: '',
    experience_mode: '',
    connect_visible: false,
  })

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    supabase.from('profiles').select('display_name, professional_role, institution, speciality, experience_mode, connect_visible')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setForm({
          display_name: data.display_name || user.name || '',
          professional_role: data.professional_role || '',
          institution: data.institution || '',
          speciality: data.speciality || '',
          experience_mode: data.experience_mode || 'personal',
          connect_visible: data.connect_visible || false,
        })
      })
  }, [user, supabase, router])

  const save = async () => {
    if (!user) return
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({
      display_name: form.display_name || null,
      professional_role: form.professional_role || null,
      institution: form.institution || null,
      speciality: form.speciality || null,
      experience_mode: form.experience_mode,
      connect_visible: form.connect_visible,
    }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const deleteAccount = async () => {
    if (!confirm('Tens a certeza? Esta acção é irreversível e apaga todos os teus dados.')) return
    await supabase.auth.signOut()
    router.push('/')
  }

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const input_s = {
    width: '100%', border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'white',
  }
  const label_s = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)',
    textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6, display: 'block',
  }

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--ink)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? 'var(--ink)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Conta</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>
            Definições
          </h1>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
            <button onClick={() => setTab('profile')} style={tabStyle('profile')}>Perfil</button>
            <button onClick={() => setTab('connect')} style={tabStyle('connect')}>Phlox Connect</button>
            <button onClick={() => setTab('account')} style={tabStyle('account')}>Conta</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 580 }}>

        {/* ── PROFILE TAB ──────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Experience mode */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Modo de experiência</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Define as ferramentas e o contexto AI que aparecem na plataforma.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODE_OPTIONS.map(m => (
                  <button key={m.value} onClick={() => set('experience_mode', m.value)}
                    style={{ padding: '11px 14px', border: `1.5px solid ${form.experience_mode === m.value ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 8, background: form.experience_mode === m.value ? 'var(--ink)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.experience_mode === m.value ? 'white' : 'var(--ink)', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: form.experience_mode === m.value ? 'rgba(255,255,255,0.55)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Basic info */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Informação pessoal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={label_s}>Nome de apresentação</label>
                  <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                    placeholder="Ex: Dra. Ana Silva" style={input_s} />
                </div>
                <div>
                  <label style={label_s}>Email</label>
                  <input value={user?.email || ''} disabled
                    style={{ ...input_s, background: 'var(--bg-2)', color: 'var(--ink-4)', cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>

            <button onClick={save} disabled={saving}
              style={{ padding: '12px', background: saving ? 'var(--bg-3)' : 'var(--ink)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar alterações'}
            </button>
          </div>
        )}

        {/* ── CONNECT TAB ──────────────────────────────────────────────── */}
        {tab === 'connect' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1d4ed8', lineHeight: 1.7 }}>
              O <strong>Phlox Connect</strong> permite que outros profissionais te encontrem pelo diretório e te enviem consultas clínicas. Só apareces se activares a visibilidade.
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Visível no diretório</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Outros profissionais podem encontrar-te e enviar consultas</div>
                </div>
                <button onClick={() => set('connect_visible', !form.connect_visible)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.connect_visible ? '#0d6e42' : 'var(--bg-3)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: form.connect_visible ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: form.connect_visible ? 1 : 0.4, pointerEvents: form.connect_visible ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                <div>
                  <label style={label_s}>Nome de apresentação *</label>
                  <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                    placeholder="Ex: Dra. Ana Silva" style={input_s} />
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Este é o nome que aparece no diretório</div>
                </div>
                <div>
                  <label style={label_s}>Papel profissional *</label>
                  <select value={form.professional_role} onChange={e => set('professional_role', e.target.value)}
                    style={{ ...input_s }}>
                    <option value="">Selecciona o teu papel...</option>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label_s}>Instituição</label>
                  <input value={form.institution} onChange={e => set('institution', e.target.value)}
                    placeholder="Ex: Farmácia Central de Lisboa, Hospital São João" style={input_s} />
                </div>
                <div>
                  <label style={label_s}>Especialidade (opcional)</label>
                  <input value={form.speciality} onChange={e => set('speciality', e.target.value)}
                    placeholder="Ex: Farmácia Hospitalar, Cardiologia, Medicina Geral" style={input_s} />
                </div>
              </div>

              {form.connect_visible && !form.professional_role && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#854d0e' }}>
                  Define o teu papel profissional para aparecer no diretório.
                </div>
              )}
            </div>

            {/* Preview */}
            {form.connect_visible && form.display_name && form.professional_role && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pré-visualização no diretório</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--ink-3)' }}>
                    {form.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{form.display_name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      {ROLE_OPTIONS.find(r => r.value === form.professional_role)?.label}
                      {form.institution && <span> · {form.institution}</span>}
                      {form.speciality && <span> · {form.speciality}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={save} disabled={saving || (form.connect_visible && !form.professional_role)}
              style={{ padding: '12px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', opacity: form.connect_visible && !form.professional_role ? 0.5 : 1 }}>
              {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar definições Connect'}
            </button>

            <Link href="/connect"
              style={{ display: 'block', padding: '11px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
              Ir para o Phlox Connect →
            </Link>
          </div>
        )}

        {/* ── ACCOUNT TAB ──────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Plano actual</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ink)', textTransform: 'capitalize' }}>{user?.plan || 'Grátis'}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                    {user?.plan === 'free' ? 'Ferramentas básicas sem limite' : user?.plan === 'student' ? '3,99€/mês' : user?.plan === 'pro' ? '14,99€/mês' : 'Plano institucional'}
                  </div>
                </div>
                {(user?.plan === 'free' || user?.plan === 'student') && (
                  <Link href="/pricing"
                    style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                    Fazer upgrade
                  </Link>
                )}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Sessão</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Autenticado com {user?.email}</div>
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
                style={{ padding: '9px 16px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Terminar sessão
              </button>
            </div>

            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#742a2a', marginBottom: 4 }}>Zona de perigo</div>
              <div style={{ fontSize: 12, color: '#742a2a', opacity: 0.7, marginBottom: 14 }}>Apagar a conta remove todos os teus dados permanentemente.</div>
              <button onClick={deleteAccount}
                style={{ padding: '9px 16px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Apagar conta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}