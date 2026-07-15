'use client'

// Passaporte de Saúde — junta num só sítio o que antes estava em 3 páginas:
// - Documento completo (era /passport): ficha bilingue PT/EN, medicação, QR permanente.
// - Cartão de emergência estilo carteira (era /cartao-emergencia): mesma tabela
//   `emergency_tokens` e API — só a apresentação visual mudava. Trazido para cá
//   como as ações "Descarregar QR" e "Desativar cartão" no documento.
// - Partilha temporária (era /health-pass): sessão de partilha com QR+PIN a
//   expirar, secções escolhidas pelo utente, histórico de visitas e devoluções
//   do profissional — modelo de dados diferente (health_pass_sessions), mantido
//   como segundo separador em vez de eliminado.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'

interface Med { id: string; name: string; dose: string | null; frequency: string | null; indication: string | null; started_at: string | null }
interface EmergencyCard { name: string; allergies: string; blood_type: string; emergency_contact: string; token: string; active?: boolean }
interface ShareSession { id: string; token: string; pin: string; sections: string[]; expires_at: string }
interface Visit { id: string; at: string; professional_name?: string; institution?: string; reason?: string; notes?: string }
interface Return { id: string; kind: string; payload: any; from_professional?: string }

const PT: Record<string, string> = {
  title: 'Passaporte de Saúde', name: 'Nome', dob: 'Data de Nasc.', blood: 'Grupo Sanguíneo',
  allergies: 'Alergias', emergency: 'Contacto de Emergência', medications: 'Medicação Atual',
  conditions: 'Condições Médicas', dose: 'Dose', freq: 'Frequência', since: 'Desde',
  generated: 'Gerado em', via: 'via Phlox', no_allergies: 'Sem alergias conhecidas',
  no_meds: 'Nenhum medicamento registado', scan: 'Digitalizar para versão atualizada',
  print: 'Imprimir', share: 'Partilhar', edit: 'Editar dados',
}
const EN: Record<string, string> = {
  title: 'Health Passport', name: 'Name', dob: 'Date of Birth', blood: 'Blood Type',
  allergies: 'Allergies', emergency: 'Emergency Contact', medications: 'Current Medications',
  conditions: 'Medical Conditions', dose: 'Dose', freq: 'Frequency', since: 'Since',
  generated: 'Generated on', via: 'via Phlox', no_allergies: 'No known allergies',
  no_meds: 'No medications recorded', scan: 'Scan for updated version',
  print: 'Print', share: 'Share', edit: 'Edit details',
}

const SHARE_SECTIONS = [
  { k: 'allergies', label: 'Alergias', always: true },
  { k: 'meds', label: 'Medicação atual', always: true },
  { k: 'conditions', label: 'Condições / diagnósticos' },
  { k: 'symptoms', label: 'Sintomas recentes' },
  { k: 'vitals', label: 'Sinais vitais' },
  { k: 'visits', label: 'Visitas anteriores' },
]

export default function PassportPage() {
  const { user, supabase } = useAuth()
  const [tab, setTab] = useState<'doc' | 'share'>('doc')
  const [lang, setLang] = useState<'PT' | 'EN'>('PT')
  const [meds, setMeds] = useState<Med[]>([])
  const [card, setCard] = useState<EmergencyCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', blood_type: '', allergies: '', emergency_contact: '', conditions: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [activeProfile, setActiveProfile] = useState<any>(null)

  // ── Partilha temporária (era /health-pass) ──
  const [session, setSession] = useState<ShareSession | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [returns, setReturns] = useState<Return[]>([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareErr, setShareErr] = useState('')
  const [chosen, setChosen] = useState<string[]>(['allergies', 'meds', 'conditions', 'vitals', 'visits'])
  const [minutes, setMinutes] = useState(15)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(Date.now())

  const t = lang === 'PT' ? PT : EN

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const isFamily = activeProfile?.type === 'family'
    const medsPromise = isFamily
      ? supabase.from('family_profile_meds').select('*').eq('profile_id', activeProfile.id).order('created_at', { ascending: false })
      : supabase.from('personal_meds').select('*').eq('user_id', user.id).order('started_at', { ascending: false })
    Promise.all([
      medsPromise,
      isFamily
        ? supabase.from('family_profiles').select('name, allergies, blood_type, emergency_contact').eq('id', activeProfile.id).maybeSingle()
        : supabase.from('emergency_tokens').select('*').eq('user_id', user.id).maybeSingle(),
    ]).then(async ([{ data: medsData }, { data: cardData }]) => {
      setMeds(medsData || [])
      if (cardData) {
        setCard(cardData as EmergencyCard)
        setForm({ name: cardData.name || '', blood_type: cardData.blood_type || '', allergies: cardData.allergies || '', emergency_contact: cardData.emergency_contact || '', conditions: '' })
      } else {
        const userName = (user as any).user_metadata?.full_name || user.email?.split('@')[0] || ''
        setForm(p => ({ ...p, name: userName }))
        if (userName) {
          try {
            const { data: sd } = await supabase.auth.getSession()
            const token = sd.session?.access_token
            if (token) {
              const res = await fetch('/api/emergency-card/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: userName }),
              })
              if (res.ok) {
                const created = await res.json()
                if (created.token) setCard({ name: userName, allergies: '', blood_type: '', emergency_contact: '', token: created.token, active: true })
              }
            }
          } catch {}
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, supabase, activeProfile?.id])

  const save = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token
      if (!token) { setSaveError('Sessão expirada. Recarrega a página.'); return }
      const res = await fetch('/api/emergency-card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, blood_type: form.blood_type, allergies: form.allergies, emergency_contact: form.emergency_contact }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Erro ao guardar'); return }
      if (data.token) setCard({ name: form.name, blood_type: form.blood_type, allergies: form.allergies, emergency_contact: form.emergency_contact, token: data.token, active: true })
      setEditing(false)
    } catch (e: any) {
      setSaveError(e.message || 'Erro de ligação')
    } finally {
      setSaving(false)
    }
  }

  async function deactivateCard() {
    if (!user || !confirm('Desativar o cartão? O link e o QR públicos deixam de funcionar.')) return
    setDeactivating(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd.session?.access_token
      await fetch('/api/emergency-card/generate', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setCard(prev => prev ? { ...prev, active: false } : null)
    } finally {
      setDeactivating(false)
    }
  }

  const emergencyUrl = card?.token && card.active !== false ? `${typeof window !== 'undefined' ? window.location.origin : ''}/emergency/${card.token}` : null
  const emergencyQrUrl = emergencyUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&data=${encodeURIComponent(emergencyUrl)}` : null

  async function savePassportToVault() {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const medsList = meds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` · ${m.frequency}` : ''}`).join('\n')
    const text = [
      `PASSAPORTE DE SAÚDE — ${today}`,
      `Nome: ${form.name || '—'}`,
      `Grupo sanguíneo: ${form.blood_type || '—'}`,
      `Alergias: ${form.allergies || 'Sem alergias conhecidas'}`,
      `Contacto de emergência: ${form.emergency_contact || '—'}`,
      '',
      'MEDICAÇÃO ATUAL:',
      medsList || '(sem medicação registada)',
      '',
      emergencyUrl ? `Versão online atualizada: ${emergencyUrl}` : '',
    ].filter(Boolean).join('\n')
    const { error } = await supabase.from('health_vault').insert({
      user_id: user.id,
      title: `Passaporte de saúde · ${today}`,
      category: 'report',
      notes: 'Snapshot do passaporte de saúde',
      body_text: text,
      issued_at: today,
    })
    if (error) { alert(`Não foi possível guardar: ${error.message}`); return }
    alert('Passaporte guardado no cofre.')
  }

  // ── Partilha temporária — carrega quando o separador abre pela 1ª vez ──
  const loadShare = useCallback(async () => {
    if (!user) return
    setShareLoading(true); setShareErr('')
    const { data: sd } = await supabase.auth.getSession()
    const pp = activeProfile?.type === 'family' ? `?profile_id=${activeProfile.id}` : ''
    const res = await fetch(`/api/health-pass/session${pp}`, { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
    const d = await res.json()
    if (!res.ok) { setShareErr(d.error || 'Erro'); setShareLoading(false); return }
    setSession(d.session); setVisits(d.visits || []); setReturns(d.returns || [])
    setShareLoading(false)
  }, [user, supabase, activeProfile])

  useEffect(() => { if (tab === 'share') loadShare() }, [tab, loadShare])
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])

  async function createShare() {
    setCreating(true)
    const { data: sd } = await supabase.auth.getSession()
    const body: any = { sections: chosen, minutes }
    if (activeProfile?.type === 'family') body.profile_id = activeProfile.id
    const res = await fetch('/api/health-pass/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify(body) })
    const d = await res.json()
    if (res.ok) setSession(d); else setShareErr(d.error || 'Erro')
    setCreating(false)
  }
  async function revokeShare() {
    if (!session) return
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/health-pass/session', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ revoke: session.id }) })
    setSession(null)
  }
  async function dismissReturn(id: string) {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/health-pass/session', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ dismissReturn: id }) })
    setReturns(p => p.filter(r => r.id !== id)); loadShare()
  }
  const toggleSection = (k: string) => setChosen(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])
  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = session ? `${shareOrigin}/hp/${session.token}` : ''
  const minsLeft = session ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - now) / 60000)) : 0
  const secsLeft = session ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - now) / 1000) % 60) : 0
  const shareExpired = session && new Date(session.expires_at).getTime() < now

  const panel: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const today = new Date().toLocaleDateString(lang === 'PT' ? 'pt-PT' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🪪</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Passaporte de Saúde</div>
        <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 24 }}>Inicia sessão para criar o teu passaporte de saúde personalizado.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Controls — hidden on print */}
      <div className="no-print">
        <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Passaporte de Saúde</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>O teu documento de saúde completo</div>
              </div>
              <ProfileSelector onChange={(p) => setActiveProfile(p)} />
            </div>

            {/* Separadores */}
            <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
              {([
                { k: 'doc', label: '🪪 Documento' },
                { k: 'share', label: '📲 Partilha temporária' },
              ] as const).map(x => (
                <button key={x.k} onClick={() => setTab(x.k)}
                  style={{ padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${tab === x.k ? 'var(--green)' : 'var(--border)'}`, background: tab === x.k ? 'var(--green)' : 'white', color: tab === x.k ? 'white' : 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {x.label}
                </button>
              ))}
            </div>

            {tab === 'doc' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
                <button onClick={() => setLang(l => l === 'PT' ? 'EN' : 'PT')}
                  style={{ padding: '9px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
                  {lang === 'PT' ? '🇬🇧 EN' : '🇵🇹 PT'}
                </button>
                <button onClick={() => setEditing(true)}
                  style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
                  ✏️ {t.edit}
                </button>
                {emergencyUrl && (
                  <button onClick={() => navigator.clipboard?.writeText(emergencyUrl)}
                    style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
                    🔗 {t.share}
                  </button>
                )}
                {emergencyQrUrl && (
                  <a href={emergencyQrUrl} download="phlox-emergency-qr.png"
                    style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)', textDecoration: 'none' }}>
                    ↓ QR
                  </a>
                )}
                <button onClick={savePassportToVault}
                  style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
                  🔒 Cofre
                </button>
                <button onClick={() => { document.body.classList.add('passport-pocket'); window.print(); document.body.classList.remove('passport-pocket') }}
                  style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}>
                  👛 Versão bolso
                </button>
                <button onClick={() => window.print()}
                  style={{ padding: '9px 18px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🖨️ {t.print}
                </button>
                {card && card.active !== false && (
                  <button onClick={deactivateCard} disabled={deactivating}
                    style={{ padding: '9px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12.5, cursor: 'pointer' }}>
                    {deactivating ? 'A desativar…' : 'Desativar cartão'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === 'doc' ? (
      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />)}
          </div>
        ) : (

        /* ─── PASSPORT CARD ─── */
        <div className="passport-card" style={{ background: 'white', border: '2px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          <div style={{ background: '#0f172a', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Phlox · {t.title}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', fontWeight: 400 }}>
                {form.name || '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🪪</div>
            </div>
          </div>

          <div className="passport-critical-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)', background: form.blood_type ? '#eff6ff' : 'var(--bg-2)' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{t.blood}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: form.blood_type ? '#1d4ed8' : 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                {form.blood_type || '—'}
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border)', background: form.allergies ? '#fee2e2' : 'var(--bg-2)' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{t.allergies}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: form.allergies ? '#991b1b' : 'var(--ink-5)', lineHeight: 1.4 }}>
                {form.allergies || t.no_allergies}
              </div>
            </div>
            <div style={{ padding: '14px 18px', background: 'var(--bg-2)' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{t.emergency}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
                {form.emergency_contact || '—'}
              </div>
            </div>
          </div>

          {form.conditions && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#fffbeb' }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{t.conditions}</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55 }}>{form.conditions}</div>
            </div>
          )}

          <div style={{ padding: '18px 18px 0' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t.medications} ({meds.length})
            </div>
            {meds.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ink-5)', fontStyle: 'italic', padding: '12px 0' }}>{t.no_meds}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>Medicamento</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{t.dose}</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{t.freq}</th>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, display: 'table-cell' }} className="passport-since">{t.since}</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: i < meds.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                      <td style={{ padding: '9px 0', fontWeight: 700, color: 'var(--ink)' }}>
                        {m.name}
                        {m.indication && <div style={{ fontSize: 10, color: 'var(--ink-5)', fontWeight: 400, fontStyle: 'italic', marginTop: 1 }}>{m.indication}</div>}
                      </td>
                      <td style={{ padding: '9px 8px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{m.dose || '—'}</td>
                      <td style={{ padding: '9px 8px', color: 'var(--ink-3)', fontSize: 11 }}>{m.frequency || '—'}</td>
                      <td style={{ padding: '9px 0', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', fontSize: 10 }} className="passport-since">
                        {m.started_at ? new Date(m.started_at).toLocaleDateString(lang === 'PT' ? 'pt-PT' : 'en-GB') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="passport-footer" style={{ padding: '18px 18px', borderTop: '1px solid var(--border)', marginTop: 16, background: 'var(--bg-2)' }}>
            {emergencyUrl && emergencyQrUrl && (
              <div className="passport-footer-qr" style={{ textAlign: 'center', marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emergencyQrUrl}
                  alt="QR de emergência" className="passport-qr"
                  style={{ width: 160, height: 160, borderRadius: 8, border: '3px solid white', background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }} />
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.45, fontWeight: 600 }}>{t.scan}</div>
              </div>
            )}
            <div style={{ textAlign: 'center', borderTop: emergencyUrl ? '1px solid var(--border)' : 'none', paddingTop: emergencyUrl ? 10 : 0 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>{t.generated} {today} · {t.via}</div>
              {emergencyUrl && <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', marginTop: 3, wordBreak: 'break-all' }}>{emergencyUrl}</div>}
            </div>
          </div>
        </div>
        )}
      </div>
      ) : (
      /* ─── PARTILHA TEMPORÁRIA (era /health-pass) ─── */
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        {shareErr && <div style={{ ...panel, marginBottom: 14, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13 }}>{shareErr}</div>}

        <p style={{ fontSize: 13.5, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
          Gera um QR + PIN temporário para mostrar a um profissional — sem precisar de conta do lado dele. Escolhe o que partilhar e por quanto tempo.
        </p>

        {returns.length > 0 && (
          <div style={{ ...panel, marginBottom: 14, borderColor: '#bfdbfe', background: '#eff6ff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>📥 O profissional enviou-te {returns.length} item(s)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {returns.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, background: 'white', border: '1px solid #bfdbfe', borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    <strong>{r.kind === 'medication' ? '💊 Medicação' : r.kind === 'appointment' ? '📅 Consulta' : '📝 Nota'}</strong>
                    {r.from_professional ? ` · ${r.from_professional}` : ''}
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{r.payload?.text || r.payload?.name || JSON.stringify(r.payload)}</div>
                  </div>
                  <button onClick={() => dismissReturn(r.id)} style={{ flexShrink: 0, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Arquivar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {session && !shareExpired ? (
          <div style={{ ...panel, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-block', background: 'white', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Código para o profissional</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>{session.pin}</div>
            <div style={{ fontSize: 13, color: minsLeft <= 2 ? '#dc2626' : 'var(--ink-4)', marginTop: 4 }}>Expira em {minsLeft}:{String(secsLeft).padStart(2, '0')}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => navigator.clipboard?.writeText(shareUrl)} style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)' }}>Copiar link</button>
              <button onClick={revokeShare} style={{ padding: '9px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>Terminar partilha</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 12 }}>A partilhar: {session.sections.map(s => SHARE_SECTIONS.find(x => x.k === s)?.label || s).join(' · ')}</div>
          </div>
        ) : (
          <div style={{ ...panel, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>O que queres partilhar?</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 12 }}>Alergias e medicação vão sempre. Escolhe o resto.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {SHARE_SECTIONS.map(s => {
                const on = s.always || chosen.includes(s.k)
                return (
                  <button key={s.k} onClick={() => !s.always && toggleSection(s.k)} disabled={s.always}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${on ? '#0d6e42' : 'var(--border)'}`, background: on ? '#eef6f1' : 'white', cursor: s.always ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: on ? '#0d6e42' : 'white', border: `1.5px solid ${on ? '#0d6e42' : 'var(--border)'}`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                    <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: on ? 600 : 400 }}>{s.label}</span>
                    {s.always && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase' }}>sempre</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Expira em</span>
              {[15, 30, 60].map(m => <button key={m} onClick={() => setMinutes(m)} style={{ padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${minutes === m ? '#0d6e42' : 'var(--border)'}`, background: minutes === m ? '#eef6f1' : 'white', color: minutes === m ? '#0d6e42' : 'var(--ink-4)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{m} min</button>)}
            </div>
            <button onClick={createShare} disabled={creating} style={{ width: '100%', padding: 14, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{creating ? 'A gerar…' : 'Gerar QR de partilha'}</button>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 8px' }}>Histórico de visitas</div>
        {shareLoading ? <div className="skeleton" style={{ height: 60, borderRadius: 10 }} /> : visits.length === 0 ? (
          <div style={{ ...panel, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem visitas registadas. Quando um profissional abrir o teu QR e registar a visita, aparece aqui.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visits.map(v => (
              <div key={v.id} style={{ ...panel, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{v.reason || 'Consulta'}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>{new Date(v.at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>{[v.institution, v.professional_name].filter(Boolean).join(' · ')}</div>
                {v.notes && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5, background: 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>{v.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ─── Edit modal ─── */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} className="no-print"
          onClick={() => setEditing(false)}>
          <div style={{ background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>✏️ {t.edit}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t.name + ' *'}
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              <input value={form.blood_type} onChange={e => setForm(p => ({ ...p, blood_type: e.target.value }))} placeholder={t.blood + ' (ex: A+, O-)'}
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              <input value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} placeholder={t.allergies + ' (ex: penicilina, AAS)'}
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              <input value={form.emergency_contact} onChange={e => setForm(p => ({ ...p, emergency_contact: e.target.value }))} placeholder={t.emergency}
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)' }} />
              <textarea value={form.conditions} onChange={e => setForm(p => ({ ...p, conditions: e.target.value }))} placeholder={t.conditions + ' (ex: HTA, DM2, FA)'}
                rows={2}
                style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', resize: 'none' }} />
            </div>
            {saveError && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                ⚠️ {saveError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={!form.name.trim() || saving}
                style={{ flex: 1, padding: '12px', background: form.name.trim() ? 'var(--green)' : 'var(--bg-3)', color: form.name.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: form.name.trim() ? 'pointer' : 'default' }}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: '12px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important }
          body { background: white !important }
          .passport-card { box-shadow: none !important; border: 1px solid #ccc !important }
          .page-container { padding: 12px !important; max-width: 100% !important }
        }
        @media (max-width: 520px) {
          .passport-since { display: none !important }
          .passport-critical-row { grid-template-columns: 1fr !important }
          .passport-critical-row > div { border-right: none !important; border-bottom: 1px solid var(--border) !important }
          .passport-critical-row > div:last-child { border-bottom: none !important }
          .passport-qr { width: 140px !important; height: 140px !important }
        }
        .passport-pocket .passport-card {
          max-width: 105mm !important;
          margin: 0 auto !important;
        }
        .passport-pocket .passport-since { display: none !important }
        .passport-pocket .passport-qr { width: 90px !important; height: 90px !important }
        @media print {
          .passport-card { max-width: 180mm !important; margin: 0 auto !important; box-shadow: none !important; }
          .passport-qr { width: 130px !important; height: 130px !important; }
        }
        @page { margin: 8mm }
      `}</style>
    </div>
  )
}
