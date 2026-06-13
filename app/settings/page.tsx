'use client'

// ─── PHLOX SETTINGS ───────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { type ToolMode } from '@/lib/toolRegistry'
import { planById, planName } from '@/lib/plans'
import SecuritySettings from '@/components/settings/SecuritySettings'
import IntegrationsSettings from '@/components/settings/IntegrationsSettings'

const ROLE_OPTIONS = [
  { value: 'pharmacist',  label: 'Farmacêutico' },
  { value: 'physician',   label: 'Médico' },
  { value: 'nurse',       label: 'Enfermeiro' },
  { value: 'intern',      label: 'Interno' },
  { value: 'student',     label: 'Estudante' },
  { value: 'other',       label: 'Outro' },
]

const MODE_OPTIONS = [
  { value: 'clinical',  label: 'Profissional Clínico', sub: 'Farmácia · Hospital · Clínica' },
  { value: 'student',   label: 'Estudante',             sub: 'Medicina · Farmácia · Enfermagem · +3' },
  { value: 'caregiver', label: 'Cuidador Familiar',     sub: 'Gestão de medicação de familiares' },
  { value: 'personal',  label: 'Uso Pessoal',           sub: 'A minha própria saúde' },
]

const INSTITUTION_OPTIONS = [
  { value: 'nursing_home',       label: 'Lar / ERPI',            sub: 'Residentes · Turnos · MAR' },
  { value: 'day_care',           label: 'Centro de Dia',         sub: 'Utentes · Atividades · Famílias' },
  { value: 'hospital',           label: 'Hospital',              sub: 'Doentes · Rondas · Validação' },
  { value: 'clinic',             label: 'Clínica',               sub: 'Doentes · Consultas' },
  { value: 'pharmacy_hospital',  label: 'Farmácia Hospitalar',   sub: 'Validação · Farmacoterapia' },
  { value: 'pharmacy_community', label: 'Farmácia Comunitária',  sub: 'Clientes · Interações' },
  { value: 'health_center',      label: 'Centro de Saúde',       sub: 'Utentes · CSP' },
]
const INST_KEY = 'phlox-clinic-institution'

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <SettingsPage />
    </Suspense>
  )
}

function SettingsPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const validTabs = ['profile', 'seguranca', 'integracoes', 'connect', 'account', 'notifications'] as const
  type SettingsTab = typeof validTabs[number]
  const requestedTab = searchParams?.get('tab')
  // Separadores antigos (ferramentas/organizacoes/institution) foram removidos na
  // reformulação institucional — o tipo de instituição vive agora em "Perfil" e o
  // produto monta-se sozinho a partir dele. Pedidos antigos caem em "Perfil".
  const initialTab = ((requestedTab && (validTabs as readonly string[]).includes(requestedTab)
    ? (requestedTab as SettingsTab)
    : 'profile')) as SettingsTab
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelMsg, setCancelMsg] = useState('')

  async function cancelSubscription(immediate = false) {
    if (!confirm(immediate ? 'Cancelar já e perder o acesso imediatamente?' : 'Cancelar a subscrição no fim do período pago? Manténs o acesso até lá.')) return
    setCancelBusy(true); setCancelMsg('')
    try {
      const t = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/stripe/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ immediate }) })
      const j = await r.json()
      if (r.ok) setCancelMsg(j.immediate ? 'Subscrição cancelada.' : 'Cancelamento agendado para o fim do período. Manténs o acesso até lá.')
      else setCancelMsg(j.error || 'Não foi possível cancelar.')
    } catch { setCancelMsg('Erro de ligação.') }
    setCancelBusy(false)
  }

  useEffect(() => {
    if (!('Notification' in window)) { setPushPerm('unsupported'); return }
    setPushPerm(Notification.permission)
  }, [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [instType, setInstType] = useState('hospital')

  useEffect(() => {
    const stored = localStorage.getItem(INST_KEY)
    if (stored) setInstType(stored)
  }, [])

  const changeInstType = (v: string) => {
    setInstType(v)
    localStorage.setItem(INST_KEY, v)
    // Notify nav/cockpit in this tab (storage event only fires cross-tab)
    window.dispatchEvent(new StorageEvent('storage', { key: INST_KEY, newValue: v }))
  }

  // Adaptive tool visibility (personal/caregiver/student/clinical)
  // 2026-06-01: clínico agora customiza por instituição selecionada.
  const expMode: string = (user as any)?.experience_mode || 'personal'
  const toolMode: ToolMode = (['personal', 'caregiver', 'student', 'clinical'].includes(expMode) ? expMode : 'personal') as ToolMode
  const [clinicInst, setClinicInst] = useState<any>(null)
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    setClinicInst(localStorage.getItem(INST_KEY) || 'nursing_home')
    const h = (e: StorageEvent) => { if (e.key === INST_KEY && e.newValue) setClinicInst(e.newValue) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const downloadExport = async (format: 'json' | 'csv') => {
    setExporting(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch(`/api/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Falhou')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phlox-export-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExporting(false)
  }
  const [handleChecking, setHandleChecking] = useState(false)
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null)
  const [handleError, setHandleError] = useState('')
  const [form, setForm] = useState({
    display_name: '',
    connect_handle: '',
    professional_role: '',
    institution: '',
    speciality: '',
    experience_mode: 'personal',
    connect_visible: false,
  })

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    supabase.from('profiles')
      .select('display_name, connect_handle, professional_role, institution, speciality, experience_mode, connect_visible')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setForm({
          display_name:      data.display_name || user.name || '',
          connect_handle:    data.connect_handle || '',
          professional_role: data.professional_role || '',
          institution:       data.institution || '',
          speciality:        data.speciality || '',
          experience_mode:   data.experience_mode || 'personal',
          connect_visible:   data.connect_visible || false,
        })
      })
  }, [user, supabase, router])

  const checkHandle = useCallback(async (handle: string) => {
    if (!handle.trim() || !user) { setHandleAvailable(null); setHandleError(''); return }
    // Validate format
    if (!/^[a-z0-9_\.]{3,30}$/.test(handle.toLowerCase())) {
      setHandleError('3-30 caracteres. Apenas letras minúsculas, números, _ e .')
      setHandleAvailable(false)
      return
    }
    setHandleChecking(true)
    const { data } = await supabase.rpc('is_handle_available', {
      h: handle.toLowerCase(),
      uid: user.id
    })
    setHandleAvailable(!!data)
    setHandleError(data ? '' : 'Este handle já está a ser usado.')
    setHandleChecking(false)
  }, [supabase, user])

  // Debounce handle check
  useEffect(() => {
    const timer = setTimeout(() => checkHandle(form.connect_handle), 600)
    return () => clearTimeout(timer)
  }, [form.connect_handle, checkHandle])

  const save = async () => {
    if (!user) return
    if (form.connect_visible && !handleAvailable && form.connect_handle) return
    setSaving(true); setSaved(false)
    await supabase.from('profiles').update({
      display_name:      form.display_name || null,
      connect_handle:    form.connect_handle ? form.connect_handle.toLowerCase() : null,
      professional_role: form.professional_role || null,
      institution:       form.institution || null,
      speciality:        form.speciality || null,
      experience_mode:   form.experience_mode,
      connect_visible:   form.connect_visible,
    }).eq('id', user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const inp = {
    width: '100%', border: '1.5px solid var(--border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white',
  }
  const lbl = {
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

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Conta</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 14 }}>Definições</h1>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
            <button onClick={() => setTab('profile')} style={tabStyle('profile')}>Perfil</button>
            <button onClick={() => setTab('seguranca')} style={tabStyle('seguranca')}>Segurança</button>
            <button onClick={() => setTab('integracoes')} style={tabStyle('integracoes')}>Integrações</button>
            <button onClick={() => setTab('connect')} style={tabStyle('connect')}>Phlox Connect</button>
            <button onClick={() => setTab('notifications')} style={tabStyle('notifications')}>Notificações</button>
            <button onClick={() => setTab('account')} style={tabStyle('account')}>Conta</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 580 }}>

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Tipo de instituição</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>O Phlox monta-se à volta do tipo que escolheres — o painel, o menu e as ferramentas certas para a tua instituição. Sem configurar nada.</div>
              <div className="inst-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {INSTITUTION_OPTIONS.map(o => {
                  const active = instType === o.value
                  return (
                    <button key={o.value} onClick={() => changeInstType(o.value)}
                      style={{ padding: '11px 14px', border: `1.5px solid ${active ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 8, background: active ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#1d4ed8' : 'var(--ink)', marginBottom: 2 }}>{o.label}</div>
                      <div style={{ fontSize: 10, color: active ? '#3b82f6' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{o.sub}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Modo de experiência</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>Define as ferramentas e o contexto que aparecem no menu.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODE_OPTIONS.map(m => (
                  <button key={m.value} onClick={() => set('experience_mode', m.value)}
                    style={{ padding: '11px 14px', border: `1.5px solid ${form.experience_mode === m.value ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 8, background: form.experience_mode === m.value ? 'var(--ink)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.experience_mode === m.value ? 'white' : 'var(--ink)', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: form.experience_mode === m.value ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Informação pessoal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={lbl}>Nome de apresentação</label>
                  <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                    placeholder="Ex: Dra. Ana Silva" style={inp} />
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    Aparece nos documentos e relatórios que geras no Phlox
                  </div>
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input value={user?.email || ''} disabled
                    style={{ ...inp, background: 'var(--bg-2)', color: 'var(--ink-4)', cursor: 'not-allowed' }} />
                </div>
              </div>
            </div>

            <button onClick={save} disabled={saving}
              style={{ padding: '12px', background: saving ? 'var(--bg-3)' : saved ? '#0d6e42' : 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'background 0.2s' }}>
              {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar alterações'}
            </button>
          </div>
        )}


        {tab === 'seguranca' && <SecuritySettings />}

        {tab === 'integracoes' && <IntegrationsSettings />}

        {tab === 'connect' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#1d4ed8', lineHeight: 1.7 }}>
              O <strong>Phlox Connect</strong> permite que outros profissionais te encontrem pelo diretório e enviem consultas clínicas. Precisas de um handle único — é o teu identificador na rede.
            </div>

            {/* Handle */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Handle único *</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12 }}>O teu identificador público no Connect. Único e permanente (como um username).</div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>@</div>
                <input value={form.connect_handle} onChange={e => set('connect_handle', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="ex: ana.silva.farm"
                  style={{ ...inp, paddingLeft: 28, fontFamily: 'var(--font-mono)', borderColor: form.connect_handle ? (handleAvailable === true ? '#6ee7b7' : handleAvailable === false ? '#fca5a5' : 'var(--border)') : 'var(--border)' }} />
                {form.connect_handle && (
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>
                    {handleChecking ? '⏳' : handleAvailable === true ? '✓' : handleAvailable === false ? '✗' : ''}
                  </div>
                )}
              </div>
              {handleError && <div style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-mono)', marginTop: 5 }}>{handleError}</div>}
              {handleAvailable === true && form.connect_handle && (
                <div style={{ fontSize: 11, color: '#0d6e42', fontFamily: 'var(--font-mono)', marginTop: 5 }}>@{form.connect_handle} está disponível</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                3-30 caracteres. Letras minúsculas, números, underscore, ponto.
              </div>
            </div>

            {/* Visibility toggle */}
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
                  <label style={lbl}>Papel profissional *</label>
                  <select value={form.professional_role} onChange={e => set('professional_role', e.target.value)} style={{ ...inp }}>
                    <option value="">Selecciona o teu papel...</option>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Instituição</label>
                  <input value={form.institution} onChange={e => set('institution', e.target.value)}
                    placeholder="Ex: Farmácia Central de Lisboa, Hospital São João" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Especialidade (opcional)</label>
                  <input value={form.speciality} onChange={e => set('speciality', e.target.value)}
                    placeholder="Ex: Farmácia Hospitalar, Cardiologia" style={inp} />
                </div>
              </div>

              {form.connect_visible && !form.connect_handle && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#854d0e' }}>
                  Define um handle único antes de activar a visibilidade.
                </div>
              )}
              {form.connect_visible && !form.professional_role && form.connect_handle && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#854d0e' }}>
                  Define o teu papel profissional para aparecer no diretório.
                </div>
              )}
            </div>

            {/* Preview */}
            {form.connect_visible && form.connect_handle && form.professional_role && handleAvailable !== false && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pré-visualização no diretório</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
                    {(form.display_name || user?.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{form.display_name || user?.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#7c3aed', marginBottom: 2 }}>@{form.connect_handle}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                      {ROLE_OPTIONS.find(r => r.value === form.professional_role)?.label}
                      {form.institution && <span> · {form.institution}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button onClick={save}
              disabled={saving || (form.connect_visible && (!form.connect_handle || !form.professional_role || handleAvailable === false))}
              style={{ padding: '12px', background: saving ? 'var(--bg-3)' : saved ? '#0d6e42' : 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'background 0.2s' }}>
              {saving ? 'A guardar...' : saved ? '✓ Guardado' : 'Guardar definições Connect'}
            </button>
            <Link href="/connect" style={{ display: 'block', padding: '11px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
              Ir para o Phlox Connect →
            </Link>
          </div>
        )}

        {tab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Push permission card */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                Notificações push
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.65 }}>
                Recebe alertas de toma de medicação directamente no teu dispositivo, mesmo com o browser fechado.
              </div>

              {pushPerm === 'unsupported' && (
                <div style={{ padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12, color: '#854d0e' }}>
                  O teu browser não suporta notificações push. Tenta no Chrome, Edge ou Firefox.
                </div>
              )}

              {pushPerm === 'granted' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>Notificações push activas</div>
                </div>
              )}

              {pushPerm === 'denied' && (
                <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 7, fontSize: 12, color: '#c53030', lineHeight: 1.65 }}>
                  As notificações foram bloqueadas. Para activar, vai às definições do teu browser e permite notificações para este site.
                </div>
              )}

              {pushPerm === 'default' && (
                <button
                  onClick={() => {
                    Notification.requestPermission().then(p => setPushPerm(p))
                  }}
                  style={{
                    padding: '11px 20px', background: 'var(--ink)', color: 'white',
                    border: 'none', borderRadius: 7, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
                  }}>
                  Activar notificações push →
                </button>
              )}
            </div>

            {/* What you'll receive */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
                O que vais receber
              </div>
              {[
                { icon: '💊', title: 'Lembretes de toma', desc: 'Aviso quando está na hora de tomar cada medicamento. Configura os horários em Os meus medicamentos.', active: pushPerm === 'granted' },
                { icon: '⚠️', title: 'Alertas de interações', desc: 'Aviso imediato quando adicionas um medicamento com interação grave.', active: pushPerm === 'granted' },
                { icon: '🏥', title: 'Alertas de MAR', desc: 'Para coordenadores: aviso de doses não registadas antes do fim do turno.', active: pushPerm === 'granted' },
                { icon: '📊', title: 'Resumo semanal', desc: 'Taxa de adesão da semana todos os domingos às 18h.', active: false },
              ].map(item => (
                <div key={item.title} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '11px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9,
                    background: item.active ? '#f0fdf4' : 'var(--bg-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.title}
                      {item.active && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#f0fdf4', border: '1px solid #86efac', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Activo
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.55 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ paddingTop: 10, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                Os lembretes de toma requerem horários configurados em <strong>Os meus medicamentos</strong>.
                Resumo semanal em breve.
              </div>
            </div>

          </div>
        )}

        {tab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Plano actual</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>{planName(user?.plan)}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                    {!user?.plan || user?.plan === 'free' ? 'Ferramentas básicas, com anúncios' : `${planById(user.plan).price.monthly.toFixed(2).replace('.', ',')}€/mês`}
                  </div>
                </div>
                {(!user?.plan || user?.plan === 'free' || user?.plan === 'student') && (
                  <Link href="/pricing" style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700 }}>
                    Fazer upgrade
                  </Link>
                )}
              </div>
              {(user?.plan === 'student' || user?.plan === 'pro' || user?.plan === 'clinic') && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  {cancelMsg && <div style={{ fontSize: 12.5, color: cancelMsg.includes('cancelad') || cancelMsg.includes('agendad') ? '#16a34a' : '#dc2626', marginBottom: 10 }}>{cancelMsg}</div>}
                  <button onClick={() => cancelSubscription(false)} disabled={cancelBusy}
                    style={{ padding: '8px 14px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, cursor: cancelBusy ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                    {cancelBusy ? 'A processar…' : 'Cancelar subscrição'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 8, lineHeight: 1.5 }}>Cancela no fim do período pago — manténs o acesso até lá. Sem emails, sem fidelização.</div>
                </div>
              )}
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Ajuda e contacto</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6 }}>
                Precisas de ajuda? Escreve para <a href="mailto:suporte@phloxclinical.com" style={{ color: '#0d6e42', textDecoration: 'none', fontWeight: 600 }}>suporte@phloxclinical.com</a>.<br />
                Parcerias e instituições: <a href="mailto:info@phloxclinical.com" style={{ color: '#0d6e42', textDecoration: 'none', fontWeight: 600 }}>info@phloxclinical.com</a>.
              </div>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Sessão</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14 }}>{user?.email}</div>
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
                style={{ padding: '9px 16px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                Terminar sessão
              </button>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Exportar os meus dados</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.5 }}>
                Descarrega todos os teus medicamentos, sinais vitais e histórico em formato portátil. Os teus dados são teus.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => downloadExport('json')} disabled={exporting}
                  style={{ padding: '9px 16px', background: exporting ? 'var(--bg-3)' : 'var(--ink)', color: exporting ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, cursor: exporting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {exporting ? 'A exportar...' : '⬇ JSON'}
                </button>
                <button onClick={() => downloadExport('csv')} disabled={exporting}
                  style={{ padding: '9px 16px', background: 'white', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, cursor: exporting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  ⬇ CSV
                </button>
              </div>
            </div>
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#742a2a', marginBottom: 4 }}>Zona de perigo</div>
              <div style={{ fontSize: 12, color: '#742a2a', opacity: 0.7, marginBottom: 14 }}>Apagar a conta remove todos os teus dados permanentemente.</div>
              <button onClick={() => { if (confirm('Tens a certeza?')) supabase.auth.signOut().then(() => router.push('/')) }}
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