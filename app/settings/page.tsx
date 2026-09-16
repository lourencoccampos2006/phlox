'use client'

// ─── PHLOX SETTINGS ───────────────────────────────────────────────────────────

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { planById, planName } from '@/lib/plans'
import { reportError, MSG } from '@/lib/clientError'
import SecuritySettings from '@/components/settings/SecuritySettings'
import HealthGoalPicker from '@/components/HealthGoalPicker'
import { activatePush as activatePushShared, needsHomeScreenForPush } from '@/lib/pushActivation'
import DiagnosticoPush from '@/components/DiagnosticoPush'
import PreferenciasNotificacao from '@/components/PreferenciasNotificacao'
import InstallInstructions from '@/components/InstallInstructions'
import { useClinicPrefs } from '@/lib/useClinicPrefs'

// O modo institucional NÃO está aqui de propósito: nunca é auto-selecionável.
// Fica só disponível a quem é membro ativo de uma organização (dono ou
// convidado) — atribuído automaticamente, nunca por escolha nem por plano.
const MODE_OPTIONS = [
  { value: 'student',   label: 'Estudante',             sub: 'Medicina · Farmácia · Enfermagem · +3' },
  { value: 'caregiver', label: 'Cuidador Familiar',     sub: 'Gestão de medicação de familiares' },
  { value: 'personal',  label: 'Uso Pessoal',           sub: 'A minha própria saúde' },
]

// Clínica e Centro de Saúde existem mas estão escondidos por agora; Hospital e
// Foco (decisão do Fernando): só Centro de Dia e Lar. Farmácia/Clínica/CSP
// arquivados — código no repo, mas fora dos seletores.
const INSTITUTION_OPTIONS = [
  { value: 'day_care',           label: 'Centro de Dia',         sub: 'Utentes · Atividades · Famílias' },
  { value: 'nursing_home',       label: 'Lar / ERPI',            sub: 'Residentes · Turnos · MAR' },
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
  const { user, loading: authLoading, supabase, refreshUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  // "ferramentas" só existe para modos NÃO-clínicos (pessoal/cuidador/estudante)
  // — esses escolhem as suas ferramentas. No modo clínico, o produto monta-se
  // sozinho a partir do tipo de instituição (blueprint), por isso não há picker.
  // "organizacoes" foi removido (criar org era confuso e inútil).
  const validTabs = ['profile', 'seguranca', 'account', 'notifications'] as const
  type SettingsTab = typeof validTabs[number]
  const requestedTab = searchParams?.get('tab')
  const initialTab = ((requestedTab && (validTabs as readonly string[]).includes(requestedTab)
    ? (requestedTab as SettingsTab)
    : 'profile')) as SettingsTab
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [pushPerm, setPushPerm] = useState<NotificationPermission | 'unsupported'>('default')
  // permissão do browser ('granted') não significa que exista uma subscrição real
  // guardada no servidor — antes o botão só pedia a permissão e mostrava sucesso,
  // sem nunca subscrever nem registar em /api/push/subscribe.
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushErr, setPushErr] = useState('')
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/sw.js')
        .then(reg => reg?.pushManager?.getSubscription())
        .then(sub => setPushSubscribed(!!sub))
        .catch(() => {})
    }
  }, [])

  // REDESIGN 2026-07-17: a dança de permissão+service-worker+subscrição+registo
  // no servidor foi extraída para lib/pushActivation.ts, para o PushNudge (em
  // /familia e /timeline) poder ativar push sem duplicar isto.
  async function activatePush() {
    setPushBusy(true); setPushErr('')
    const r = await activatePushShared(supabase)
    setPushPerm(typeof Notification !== 'undefined' ? Notification.permission : 'default')
    if (r.ok) setPushSubscribed(true)
    else setPushErr(r.error)
    setPushBusy(false)
  }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [exporting, setExporting] = useState(false)
  // Mesma fonte que todo o resto (lib/useClinicPrefs → perfil/organização).
  // Antes isto lia o localStorage por sua conta e dizia outra coisa que o /equipa.
  const { institution: instType } = useClinicPrefs()
  const [deleteStep, setDeleteStep] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  async function deleteAccount() {
    if (deleteConfirmText !== 'APAGAR') return
    setDeleting(true); setDeleteErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ confirm: 'APAGAR' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao apagar a conta')
      await supabase.auth.signOut()
      router.push('/')
    } catch (e: any) {
      setDeleteErr(e?.message || 'Falha ao apagar a conta')
    }
    setDeleting(false)
  }

  // O tipo já não se muda daqui (é do dono do Phlox, no /admin) nem se lê do
  // localStorage por conta própria — vem do useClinicPrefs, que é a fonte
  // única. As duas coisas que estavam aqui davam respostas diferentes das do
  // /equipa sobre a mesma instituição.


  // Adaptive tool visibility (personal/caregiver/student/clinical)
  // 2026-06-01: clínico agora customiza por instituição selecionada.
  const expMode: string = (user as any)?.experience_mode || 'personal'
  const [clinicInst, setClinicInst] = useState<any>(null)
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    setClinicInst(localStorage.getItem(INST_KEY) || 'nursing_home')
    const h = (e: StorageEvent) => { if (e.key === INST_KEY && e.newValue) setClinicInst(e.newValue) }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // Picker de atalhos fixos — só para modos não-clínicos. No clínico, as
  // ferramentas vêm do blueprint da instituição (não se escolhem). A secção
  const notClinical = expMode !== 'clinical'

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
  const [form, setForm] = useState({
    display_name: '',
    experience_mode: 'personal',
    daily_case_email: false,
  })

  useEffect(() => {
    // Esperar que a sessão carregue ANTES de decidir redirecionar — senão um
    // utilizador autenticado (com sessão a chegar com atraso) era atirado para
    // /login, que depois saltava para /inicio. As definições ficavam inacessíveis.
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    supabase.from('profiles')
      .select('display_name, experience_mode, daily_case_email')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setForm({
          display_name:      data.display_name || user.name || '',
          experience_mode:   data.experience_mode || 'personal',
          daily_case_email:  !!(data as any).daily_case_email,
        })
      })
  }, [user, authLoading, supabase, router])

  const save = async () => {
    if (!user) return
    setSaving(true); setSaved(false); setSaveErr('')
    // BUG CORRIGIDO 2026-07-29 (mesma classe do bug de /patients/[id]): o erro
    // do update nunca era verificado — "✓ Guardado" aparecia mesmo que nada
    // tivesse gravado. É o fluxo de guardar mais usado de toda a app (perfil
    // de qualquer conta), por isso o mais importante de corrigir primeiro.
    const { error } = await supabase.from('profiles').update({
      display_name:      form.display_name || null,
      experience_mode:   form.experience_mode,
      daily_case_email:  form.daily_case_email,
    }).eq('id', user.id)
    if (error) { setSaving(false); setSaveErr(reportError('settings-save', error, MSG.save)); return }
    // Atualiza o utilizador em memória (sem precisar de refresh do browser — essencial
    // na "app instalada", onde o utilizador não consegue recarregar a página).
    await refreshUser()
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
        </div>
        {/* Barra de tabs — no mobile fica fixa mesmo debaixo do header (nunca
            "sticky": este site tem overflow-x:hidden no body, que quebra
            sticky em qualquer página, ver globals.css). translateZ/backface
            evitam o mesmo "destacar" no bounce do iOS já corrigido no
            BottomNav — mesma técnica, aqui aplicada à barra de definições. */}
        <div className="settings-tabbar-wrap">
          <div className="page-container settings-tabbar" style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'white', overflowX: 'auto' }}>
            <button onClick={() => setTab('profile')} style={tabStyle('profile')}>Perfil</button>
            <button onClick={() => setTab('seguranca')} style={tabStyle('seguranca')}>Segurança</button>
            <button onClick={() => setTab('notifications')} style={tabStyle('notifications')}>Notificações</button>
            <button onClick={() => setTab('account')} style={tabStyle('account')}>Conta</button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .settings-tabbar-wrap { height: 42px; }
          .settings-tabbar {
            position: fixed; top: 56px; left: 0; right: 0; z-index: 90;
            border-bottom: 1px solid var(--border);
            transform: translateZ(0); -webkit-transform: translateZ(0);
            backface-visibility: hidden; -webkit-backface-visibility: hidden;
            will-change: transform;
          }
        }
      `}</style>

      <div className="page-container page-body" style={{ maxWidth: 580 }}>

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Só faz sentido para quem já está em modo institucional — achado
                por QA ao vivo 2026-07-28: contas pessoais/estudante/cuidador
                viam este cartão sem nenhum motivo, confuso (não é um risco de
                segurança — changeInstType só grava uma preferência local de
                pré-visualização, nunca escreve na base de dados). */}
            {/* ── Tipo de instituição: já NÃO se escolhe aqui ─────────────
                Decisão do Fernando (2026-09-06): o tipo é atribuído por ele no
                /admin, ao dar o primeiro acesso à instituição. Não é uma
                preferência de quem usa — muda o vocabulário, as ferramentas, o
                cockpit e os relatórios da casa inteira. Um funcionário a
                carregar aqui sem querer mudava o produto debaixo dos colegas.
                Fica só a dizer o que é, sem forma de trocar. */}
            {form.experience_mode === 'clinical' && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Tipo de instituição</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 13.5, fontWeight: 700, color: 'var(--ink)',
                    background: 'var(--bg-2)', border: '1px solid var(--border-2)',
                    borderRadius: 8, padding: '7px 13px',
                  }}>{INSTITUTION_OPTIONS.find(o => o.value === instType)?.label || 'Instituição'}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, flex: '1 1 220px' }}>
                    Definido pelo Phlox quando a instituição foi criada. Para mudar, fala connosco —
                    muda o vocabulário e as ferramentas de toda a casa.
                  </span>
                </div>
              </div>
            )}

            {/* Caso do dia — só para quem o pedir. Um email diário manda-se a
                quem o quer, nunca por omissão. */}
            {form.experience_mode === 'student' && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Caso clínico do dia</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12, lineHeight: 1.55 }}>
                  Um caso curto por email, de manhã, de segunda a sexta. A resposta não vem no email —
                  resolve-se aqui.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5 }}>
                  <input type="checkbox" checked={!!form.daily_case_email}
                    onChange={e => setForm(f => ({ ...f, daily_case_email: e.target.checked }))}
                    style={{ width: 17, height: 17, cursor: 'pointer' }} />
                  Receber o caso do dia
                </label>
              </div>
            )}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Modo de experiência</div>
              {form.experience_mode === 'clinical' ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.6 }}>
                    A sua conta está ligada a uma instituição — o acesso institucional é atribuído pela instituição, não se escolhe aqui.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {MODE_OPTIONS.map(m => (
                      <button key={m.value} onClick={() => set('experience_mode', m.value)}
                        style={{ padding: '11px 14px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.sub}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            <HealthGoalPicker />

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
            {saveErr && <div style={{ fontSize: 12, color: '#dc2626', fontFamily: 'var(--font-sans)' }}>{saveErr}</div>}
          </div>
        )}

        {/* Picker de atalhos + módulos — só modos não-clínicos. No clínico vem do blueprint. */}
        {/* A aba "Ferramentas" foi daqui removida a 2026-09-16.
            Ligava/desligava secoes, avisos, widgets e atalhos fixos do
            /inicio. Com o /inicio novo — uma acao e uma lista curta — nenhuma
            dessas partes existe, e a aba passou a ser quatro grupos de
            interruptores que rodavam sem produzir efeito nenhum. Um
            interruptor que nao faz nada e pior do que nao haver interruptor. */}

        {tab === 'seguranca' && <SecuritySettings />}

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

              {pushPerm === 'granted' && pushSubscribed && (
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

              {(pushPerm === 'default' || (pushPerm === 'granted' && !pushSubscribed)) && (
                <>
                  {!needsHomeScreenForPush() && (
                    <button
                      onClick={activatePush}
                      disabled={pushBusy}
                      style={{
                        padding: '11px 20px', background: pushBusy ? 'var(--bg-3)' : 'var(--ink)', color: pushBusy ? 'var(--ink-4)' : 'white',
                        border: 'none', borderRadius: 7, cursor: pushBusy ? 'wait' : 'pointer',
                        fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', marginBottom: 14,
                      }}>
                      {pushBusy ? 'A ativar…' : 'Activar notificações push →'}
                    </button>
                  )}
                  {pushErr && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 7, fontSize: 12, color: '#c53030', lineHeight: 1.6 }}>{pushErr}</div>
                  )}
                  <InstallInstructions compact />
                </>
              )}
            </div>

            {/* O que cada pessoa quer receber. Ver lib/notificacoes.ts. */}
            {user?.id && <PreferenciasNotificacao supabase={supabase} userId={user.id} />}

            {/* Porque e que nao chegam. Ver components/DiagnosticoPush.tsx */}
            <DiagnosticoPush supabase={supabase} />

            {/* A lista estatica "O que vais receber" foi daqui removida a
                2026-09-14: dizia quatro coisas, duas das quais nao existiam
                ("Alertas de interacoes" e "Resumo semanal em breve"), e estava
                escrita a mao ao lado dos interruptores reais. Duas listas de
                notificacoes, uma delas inventada, e pior do que nenhuma. O que
                se recebe vive agora em lib/notificacoes.ts, num sitio so. */}

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
              <div style={{ fontSize: 12, color: '#742a2a', opacity: 0.7, marginBottom: 14 }}>Apagar a conta remove todos os teus dados permanentemente. Não é reversível.</div>
              {!deleteStep ? (
                <button onClick={() => { setDeleteStep(true); setDeleteConfirmText(''); setDeleteErr('') }}
                  style={{ padding: '9px 16px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  Apagar conta
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: 12.5, color: '#742a2a', marginBottom: 8 }}>
                    Para confirmar, escreve <strong>APAGAR</strong> abaixo. Isto elimina a tua conta e os teus dados de imediato.
                  </div>
                  <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="APAGAR"
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #feb2b2', borderRadius: 7, padding: '8px 11px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 10 }} />
                  {deleteErr && <div style={{ fontSize: 12, color: '#c53030', marginBottom: 10 }}>{deleteErr}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setDeleteStep(false)} disabled={deleting}
                      style={{ padding: '9px 16px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                      Cancelar
                    </button>
                    <button onClick={deleteAccount} disabled={deleteConfirmText !== 'APAGAR' || deleting}
                      style={{ padding: '9px 16px', background: '#c53030', color: 'white', border: 'none', borderRadius: 7, cursor: deleteConfirmText !== 'APAGAR' || deleting ? 'not-allowed' : 'pointer', opacity: deleteConfirmText !== 'APAGAR' || deleting ? 0.5 : 1, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                      {deleting ? 'A apagar...' : 'Apagar definitivamente'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}