'use client'

// components/settings/IntegrationsSettings.tsx
// Tab "Integrações" em /settings — gestão de webhooks FHIR para laboratórios
// externos. Mostra também URL do servidor FHIR para integração externa.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import { useActiveOrg } from '@/lib/orgContext'

const KIND_META: Record<string, { label: string; icon: string }> = {
  lab:     { label: 'Laboratório de análises',   icon: '🧪' },
  imaging: { label: 'Imagiologia / PACS',         icon: '🩻' },
  sus:     { label: 'SPMS / SNS24 / RSE',         icon: '🇵🇹' },
  other:   { label: 'Outro',                       icon: '·' },
}

export default function IntegrationsSettings() {
  const { supabase } = useAuth() as any
  const toast = useToast()
  const { org } = useActiveOrg()

  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newWebhook, setNewWebhook] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const fhirUrl = `${baseUrl}/api/fhir`

  const refresh = useCallback(async () => {
    if (!org?.id) { setIntegrations([]); setLoading(false); return }
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch(`/api/lab/integrations?org_id=${org.id}`, { headers: { Authorization: `Bearer ${sd?.session?.access_token}` } })
      const d = await r.json()
      setIntegrations(d.integrations || [])
    } finally { setLoading(false) }
  }, [org?.id, supabase])
  useEffect(() => { refresh() }, [refresh])

  async function patch(id: string, body: any) {
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/lab/integrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
      body: JSON.stringify(body),
    })
    if (r.ok) refresh()
    else toast.error((await r.json()).error)
  }

  async function rotate(id: string) {
    if (!confirm('Regenerar o token? O anterior deixa de funcionar imediatamente.')) return
    const { data: sd } = await supabase.auth.getSession()
    const r = await fetch(`/api/lab/integrations/${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sd?.session?.access_token}` },
    })
    const d = await r.json()
    if (r.ok) { toast.success('Token regenerado.'); setNewWebhook(d.webhook_url); refresh() }
    else toast.error(d.error)
  }

  async function remove(id: string) {
    if (!confirm('Eliminar esta integração? Não é possível reverter.')) return
    const { data: sd } = await supabase.auth.getSession()
    await fetch(`/api/lab/integrations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${sd?.session?.access_token}` } })
    refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Endpoint FHIR */}
      <Card title="Servidor FHIR R4" subtitle="Endpoint público para sistemas externos (laboratórios, SPMS, SClínico). Documentação em /api/fhir/metadata.">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', wordBreak: 'break-all', color: 'var(--ink-2)' }}>
          {fhirUrl}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 8, lineHeight: 1.55 }}>
          Autenticação por Bearer JWT (utilizadores) ou API key com scope <code>fhir:read</code>/<code>fhir:write</code>. Resources suportados: Patient, Encounter, Observation, MedicationRequest, AllergyIntolerance, Immunization.
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <a href="/api/fhir/metadata" target="_blank" rel="noopener" style={{ flex: 1, textAlign: 'center', padding: 9, background: 'white', color: '#0d6e42', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Ver CapabilityStatement</a>
        </div>
      </Card>

      {/* Webhooks de laboratório */}
      <Card title="Receção de laboratórios" subtitle="Cada laboratório envia um Bundle FHIR para o webhook URL. Resultados são automaticamente associados ao utente correto (por SNS ou NIF).">
        {!org && <div style={{ fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: 10 }}>Seleciona uma organização ativa para gerir integrações.</div>}

        {org && (
          <>
            <button onClick={() => setCreating(true)} style={primaryBtn}>+ Nova integração</button>

            {loading && <div style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', padding: 12 }}>A carregar…</div>}

            {!loading && integrations.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-5)', textAlign: 'center', padding: 14 }}>Sem integrações configuradas.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {integrations.map(it => {
                const meta = KIND_META[it.kind] || KIND_META.other
                const url = `${baseUrl}/api/lab/webhook/${it.webhook_token}`
                return (
                  <div key={it.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{meta.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                          {meta.label} · {it.total_received} bundles recebidos
                          {it.last_received_at && ` · último em ${new Date(it.last_received_at).toLocaleString('pt-PT')}`}
                        </div>
                      </div>
                      <button onClick={() => patch(it.id, { active: !it.active })}
                        style={{ ...ghostBtn, color: it.active ? '#0d6e42' : '#dc2626' }}>{it.active ? 'Ativo' : 'Inativo'}</button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', wordBreak: 'break-all', color: 'var(--ink-3)' }}>
                      {url}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => navigator.clipboard.writeText(url)} style={{ ...ghostBtn, flex: 1 }}>Copiar URL</button>
                      <button onClick={() => rotate(it.id)} style={{ ...ghostBtn, flex: 1 }}>Regenerar token</button>
                      <button onClick={() => remove(it.id)} style={{ ...ghostBtn, color: '#dc2626' }}>×</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {newWebhook && (
          <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 11.5, color: '#166534', wordBreak: 'break-all' }}>
            ✓ Novo URL: <strong>{newWebhook}</strong>
            <button onClick={() => { navigator.clipboard.writeText(newWebhook); setNewWebhook(null) }}
              style={{ marginLeft: 8, padding: '3px 9px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Copiar e fechar</button>
          </div>
        )}
      </Card>

      {creating && <CreateModal orgId={org?.id} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh() }} />}
    </div>
  )
}

function CreateModal({ orgId, onClose, onCreated }: { orgId: string | undefined; onClose: () => void; onCreated: () => void }) {
  const { supabase } = useAuth() as any
  const toast = useToast()
  const [name, setName] = useState(''); const [kind, setKind] = useState('lab')
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim() || !orgId) return
    setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/lab/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ org_id: orgId, name: name.trim(), kind, notes: notes.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falhou')
      toast.success('Integração criada.')
      navigator.clipboard.writeText(d.webhook_url)
      onCreated()
    } catch (e: any) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.55)', zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 22, width: 420, maxWidth: '100%' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, marginBottom: 12 }}>Nova integração</div>
        <label style={lbl}>Nome do parceiro</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Synlab Portugal" style={inp} autoFocus />
        <label style={lbl}>Tipo</label>
        <select value={kind} onChange={e => setKind(e.target.value)} style={inp}>
          {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <label style={lbl}>Notas (opcional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex: contacto técnico" style={inp} />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={ghostBtn}>Cancelar</button>
          <button onClick={submit} disabled={busy || !name.trim()} style={{ ...primaryBtn, flex: 1, opacity: busy || !name.trim() ? 0.5 : 1 }}>{busy ? 'A criar…' : 'Criar'}</button>
        </div>
      </div>
    </div>
  )
}

function Card({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 14, lineHeight: 1.55 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginTop: 8, marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' }
const primaryBtn: React.CSSProperties = { padding: '9px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
const ghostBtn: React.CSSProperties = { padding: '7px 11px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }
