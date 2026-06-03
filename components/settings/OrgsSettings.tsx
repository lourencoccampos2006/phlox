'use client'

// components/settings/OrgsSettings.tsx
// Tab "Organizações" em /settings.
// Lista memberships do utilizador; permite criar nova org; abrir cada uma
// num drawer com membros + convites + identidade.

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useMemberships, setActiveOrgId } from '@/lib/orgContext'
import { ROLE_META, CAPABILITY_CATEGORIES } from '@/lib/capabilities'
import { useSearchParams } from 'next/navigation'

const KINDS = [
  { value: 'hospital',           label: 'Hospital' },
  { value: 'clinic',             label: 'Clínica' },
  { value: 'nursing_home',       label: 'Lar / ERPI' },
  { value: 'pharmacy_community', label: 'Farmácia comunitária' },
  { value: 'pharmacy_hospital',  label: 'Farmácia hospitalar' },
  { value: 'health_center',      label: 'Centro de saúde' },
  { value: 'solo',               label: 'Profissional individual' },
  { value: 'other',              label: 'Outro' },
]

const ASSIGNABLE_ROLES = ['admin','clinician','pharmacist','nurse','assistant','accountant','viewer']

export default function OrgsSettings() {
  const { supabase } = useAuth() as any
  const toast = useToast()
  const { memberships, refresh } = useMemberships()
  const searchParams = useSearchParams()
  const [creating, setCreating] = useState(searchParams?.get('new') === '1')
  const [opening, setOpening] = useState<string | null>(null)
  const [orgData, setOrgData] = useState<any | null>(null)

  async function openOrg(orgId: string) {
    setOpening(orgId); setOrgData(null)
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/orgs/${orgId}`, { headers: { Authorization: `Bearer ${sd?.session?.access_token}` } })
    const d = await r.json()
    if (!r.ok) { toast.error(d.error || 'Falhou'); setOpening(null); return }
    setOrgData(d)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>As tuas organizações</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.55 }}>
          Cada organização tem a sua equipa, dados clínicos, instituição e plano. Podes pertencer a várias (ex: trabalhar num hospital e numa farmácia comunitária).
        </div>
      </div>

      {/* Lista */}
      {memberships.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 10 }}>Ainda não tens organizações.</div>
          <button onClick={() => setCreating(true)} style={primaryBtn}>+ Criar primeira organização</button>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {memberships.map((m, i) => {
            const role = ROLE_META[m.role] || ROLE_META.viewer
            return (
              <div key={m.org.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < memberships.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: m.org.accent_color || '#0d6e42', color: 'white', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(m.org.short_name || m.org.name).charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{m.org.name}</div>
                  <div style={{ fontSize: 11, color: role.color, fontFamily: 'var(--font-mono)' }}>
                    {role.label} · {KINDS.find(k => k.value === m.org.kind)?.label || m.org.kind}
                  </div>
                </div>
                <button onClick={() => setActiveOrgId(m.org.id)} style={ghostBtn} title="Tornar ativa">Ativar</button>
                <button onClick={() => openOrg(m.org.id)} style={primaryBtn}>Abrir</button>
              </div>
            )
          })}
          <div style={{ padding: 12, background: '#f8fafc' }}>
            <button onClick={() => setCreating(true)} style={{ ...primaryBtn, width: '100%' }}>+ Nova organização</button>
          </div>
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh() }} />}
      {opening && orgData && <OrgDrawer org={orgData.org} members={orgData.members} invites={orgData.invites} onClose={() => { setOpening(null); setOrgData(null); refresh() }} onRefresh={() => openOrg(opening)} />}
    </div>
  )
}

// ─── Create ────────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { supabase } = useAuth() as any
  const toast = useToast()
  const [name, setName] = useState(''); const [shortName, setShortName] = useState('')
  const [kind, setKind] = useState('clinic'); const [city, setCity] = useState('')
  const [vat, setVat] = useState(''); const [color, setColor] = useState('#0d6e42')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ name: name.trim(), short_name: shortName.trim() || null, kind, city: city.trim() || null, vat_number: vat.trim() || null, accent_color: color }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou')
      toast.success('Organização criada.')
      onCreated()
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} title="Nova organização">
      <Label>Nome</Label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Lar São José Lda." style={input} autoFocus />
      <Label>Nome curto (opcional)</Label>
      <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="LSJ" style={input} />
      <Label>Tipo</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 4 }}>
        {KINDS.map(k => (
          <button key={k.value} onClick={() => setKind(k.value)}
            style={{ padding: '9px 11px', borderRadius: 8, border: `1.5px solid ${kind === k.value ? '#0d6e42' : 'var(--border)'}`, background: kind === k.value ? '#f0fdf4' : 'white', color: kind === k.value ? '#0d6e42' : 'var(--ink-3)', fontSize: 12.5, fontWeight: kind === k.value ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>{k.label}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 8 }}>
        <div><Label>Cidade</Label><input value={city} onChange={e => setCity(e.target.value)} placeholder="Lisboa" style={input} /></div>
        <div><Label>NIF</Label><input value={vat} onChange={e => setVat(e.target.value)} placeholder="500000000" style={input} /></div>
        <div><Label>Cor</Label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ ...input, padding: 4, height: 38 }} /></div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onClose} style={ghostBtn}>Cancelar</button>
        <button onClick={submit} disabled={busy || !name.trim()} style={{ ...primaryBtn, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? 'A criar…' : 'Criar'}</button>
      </div>
    </Modal>
  )
}

// ─── Org drawer ────────────────────────────────────────────────────────────
function OrgDrawer({ org, members, invites, onClose, onRefresh }: { org: any; members: any[]; invites: any[]; onClose: () => void; onRefresh: () => void }) {
  const { user, supabase } = useAuth() as any
  const toast = useToast()
  const [tab, setTab] = useState<'identity' | 'members' | 'invites'>('members')

  async function patch(updates: any) {
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/orgs/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
      body: JSON.stringify(updates),
    })
    if (!r.ok) toast.error((await r.json()).error || 'Falhou')
    else { toast.success('Atualizado.'); onRefresh() }
  }

  async function patchMember(memberId: string, body: any) {
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/orgs/${org.id}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
      body: JSON.stringify(body),
    })
    if (!r.ok) toast.error((await r.json()).error || 'Falhou')
    else onRefresh()
  }

  async function deleteMember(memberId: string) {
    if (!confirm('Remover este membro?')) return
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/orgs/${org.id}/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
    })
    if (!r.ok) toast.error((await r.json()).error || 'Falhou')
    else { toast.success('Removido.'); onRefresh() }
  }

  return (
    <Modal onClose={onClose} title={org.name} wide>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        {([['members', `Equipa (${members.length})`], ['invites', `Convites (${invites.filter((i: any) => !i.accepted_at && !i.revoked).length})`], ['identity', 'Identidade']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? '#0d6e42' : 'transparent'}`, fontSize: 12.5, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#0d6e42' : 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{label}</button>
        ))}
      </div>

      {tab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => {
            const role = ROLE_META[m.role] || ROLE_META.viewer
            const isMe = m.user_id === user?.id
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, alignItems: 'center' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: role.color, color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(m.user_id || '?').charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>{isMe ? 'Eu' : m.user_id.slice(0, 8) + '…'}</div>
                  <div style={{ fontSize: 11, color: role.color, fontWeight: 700 }}>{role.label}{m.department ? ` · ${m.department}` : ''}</div>
                </div>
                <select value={m.role} onChange={e => patchMember(m.id, { role: e.target.value })} disabled={isMe && m.role === 'owner'}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                  {Object.entries(ROLE_META).filter(([k]) => k !== 'self').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={() => patchMember(m.id, { active: !m.active })}
                  style={{ ...ghostBtn, color: m.active ? '#dc2626' : '#0d6e42' }}>{m.active ? 'Desativar' : 'Ativar'}</button>
                {!isMe && <button onClick={() => deleteMember(m.id)} style={{ ...ghostBtn, color: '#dc2626' }}>×</button>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'invites' && <InvitesPanel orgId={org.id} invites={invites} onRefresh={onRefresh} />}

      {tab === 'identity' && (
        <IdentityForm org={org} onSave={patch} />
      )}
    </Modal>
  )
}

function InvitesPanel({ orgId, invites, onRefresh }: { orgId: string; invites: any[]; onRefresh: () => void }) {
  const { supabase } = useAuth() as any
  const toast = useToast()
  const [email, setEmail] = useState(''); const [role, setRole] = useState('clinician')
  const [department, setDepartment] = useState(''); const [busy, setBusy] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)

  async function send() {
    if (!email.trim()) return
    setBusy(true); setLastLink(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch(`/api/orgs/${orgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ email: email.trim(), role, department: department.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou')
      setLastLink(d.link)
      setEmail(''); setDepartment('')
      toast.success('Convite criado. Copia o link e envia.')
      onRefresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="colega@hospital.pt" style={input} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
          <div>
            <Label>Função</Label>
            <select value={role} onChange={e => setRole(e.target.value)} style={input}>
              {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
            </select>
          </div>
          <div>
            <Label>Departamento (opcional)</Label>
            <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Cardiologia" style={input} />
          </div>
        </div>
        <button onClick={send} disabled={busy || !email.trim()} style={{ ...primaryBtn, width: '100%', marginTop: 10 }}>
          {busy ? 'A criar…' : 'Criar convite'}
        </button>
        {lastLink && (
          <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 12, color: '#166534', wordBreak: 'break-all' }}>
            <strong>Link de convite:</strong> {lastLink}
            <button onClick={() => navigator.clipboard.writeText(lastLink)}
              style={{ marginLeft: 8, padding: '3px 9px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Copiar</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {invites.filter((i: any) => !i.accepted_at).map((i: any) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i.email} · <span style={{ color: 'var(--ink-5)' }}>{ROLE_META[i.role]?.label || i.role}</span>
              {i.revoked && <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626' }}>REVOGADO</span>}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
              expira {new Date(i.expires_at).toLocaleDateString('pt-PT')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IdentityForm({ org, onSave }: { org: any; onSave: (u: any) => void }) {
  const [f, setF] = useState({
    name: org.name || '', short_name: org.short_name || '', vat_number: org.vat_number || '',
    address: org.address || '', postal_code: org.postal_code || '', city: org.city || '',
    phone: org.phone || '', email: org.email || '', accent_color: org.accent_color || '#0d6e42',
    logo_url: org.logo_url || '', director: org.director || '', total_beds: org.total_beds ?? '',
  })
  const submit = () => onSave({
    ...f,
    total_beds: f.total_beds === '' ? null : Number(f.total_beds),
  })
  return (
    <div>
      {/* Pré-visualização do logo + cor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f9fafb', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: f.accent_color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {f.logo_url
            ? <img src={f.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg width="22" height="22" viewBox="0 0 18 18" fill="none"><path d="M9 2v14M2 9h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{f.short_name || f.name || 'A tua organização'}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Aparece no cabeçalho clínico e em documentos impressos.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <div><Label>Nome</Label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={input} /></div>
        <div><Label>Nome curto</Label><input value={f.short_name} onChange={e => setF({ ...f, short_name: e.target.value })} style={input} /></div>
      </div>
      <Label>URL do logótipo</Label>
      <input value={f.logo_url} onChange={e => setF({ ...f, logo_url: e.target.value })} placeholder="https://..." style={input} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div><Label>NIF</Label><input value={f.vat_number} onChange={e => setF({ ...f, vat_number: e.target.value })} style={input} /></div>
        <div><Label>Diretor(a)</Label><input value={f.director} onChange={e => setF({ ...f, director: e.target.value })} style={input} /></div>
        <div><Label>Total camas</Label><input type="number" value={f.total_beds} onChange={e => setF({ ...f, total_beds: e.target.value })} style={input} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
        <div><Label>Cor da marca</Label><input type="color" value={f.accent_color} onChange={e => setF({ ...f, accent_color: e.target.value })} style={{ ...input, padding: 4, height: 38 }} /></div>
        <div />
      </div>
      <Label>Morada</Label>
      <input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} style={input} />
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
        <div><Label>Cód. postal</Label><input value={f.postal_code} onChange={e => setF({ ...f, postal_code: e.target.value })} style={input} /></div>
        <div><Label>Cidade</Label><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} style={input} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div><Label>Telefone</Label><input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} style={input} /></div>
        <div><Label>Email</Label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={input} /></div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-4)' }}>
        Os horários de turnos passaram para <strong>Equipa &amp; Escalas</strong>.
      </div>
      <button onClick={submit} style={{ ...primaryBtn, width: '100%', marginTop: 12 }}>Guardar alterações</button>
    </div>
  )
}

// ─── primitivos ────────────────────────────────────────────────────────────
function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.55)', zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 22, width: wide ? 600 : 440, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 4, marginTop: 8 }}>{children}</label>
}

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 4 }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const ghostBtn: React.CSSProperties = { padding: '7px 11px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
