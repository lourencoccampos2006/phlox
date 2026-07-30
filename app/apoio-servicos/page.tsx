'use client'

// /apoio-servicos — Quadro de serviços de apoio (roupa, transporte) — GAP
// confirmado por levantamento (2026-07-30): um centro de dia trata disto todos
// os dias e não havia registo nenhum. Mesmo espírito do quadro "Preciso de
// ajuda" entre cuidadores (family_help_requests): pedido → em curso →
// concluído, qualquer pessoa da equipa pode publicar/assumir/concluir.
// Tabela: support_services (sprint122).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

interface Patient { id: string; name: string }
interface Service {
  id: string; patient_id: string | null; kind: 'roupa' | 'transporte' | 'outro'
  date: string; status: 'pedido' | 'em_curso' | 'concluido'; notes: string | null
  requested_by_id: string | null; completed_by_id: string | null; completed_at: string | null
}

const KIND_META: Record<Service['kind'], { label: string; icon: string }> = {
  roupa:      { label: 'Tratamento de roupa', icon: 'shirt' },
  transporte: { label: 'Transporte',           icon: 'route' },
  outro:      { label: 'Outro',                icon: 'package' },
}
const STATUS_META: Record<Service['status'], { label: string; color: string; bg: string }> = {
  pedido:    { label: 'Pedido',    color: '#b45309', bg: '#fffbeb' },
  em_curso:  { label: 'Em curso',  color: '#1d4ed8', bg: '#eff6ff' },
  concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
}

export default function ApoioServicosPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)

  const [patients, setPatients] = useState<Patient[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newKind, setNewKind] = useState<Service['kind']>('roupa')
  const [newPatient, setNewPatient] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: svcs }] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name')).eq('active', true).order('name'),
      scope.filter(supabase.from('support_services').select('*')).neq('status', 'concluido').order('created_at', { ascending: false }),
    ])
    setPatients(pats || [])
    setServices(svcs || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function nameOf(patientId: string | null) { return patients.find(p => p.id === patientId)?.name || null }

  async function create() {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('support_services').insert(scope.stamp({
      user_id: user.id,
      patient_id: newPatient || null,
      kind: newKind,
      status: 'pedido',
      notes: newNotes.trim() ? newNotes.trim().slice(0, 500) : null,
      requested_by_id: user.id,
    }))
    if (error) { setErr(reportError('support-services-create', error, MSG.save)); setSaving(false); return }
    setSaving(false); setShowNew(false); setNewPatient(''); setNewNotes(''); setNewKind('roupa')
    load()
  }

  async function advance(s: Service) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const next: Service['status'] = s.status === 'pedido' ? 'em_curso' : 'concluido'
    const patch: any = { status: next }
    if (next === 'concluido') { patch.completed_by_id = user.id; patch.completed_at = new Date().toISOString() }
    const { error } = await supabase.from('support_services').update(patch).eq('id', s.id)
    if (error) { toast.error('Não atualizado', reportError('support-services-advance', error, MSG.save)); return }
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('support_services').delete().eq('id', id)
    if (error) { toast.error('Não eliminado', reportError('support-services-delete', error, MSG.save)); return }
    load()
  }

  const columns: Service['status'][] = ['pedido', 'em_curso']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Serviços de apoio</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>Roupa, transporte e outros pedidos — quem publica, quem trata.</p>
          </div>
          <button onClick={() => setShowNew(v => !v)} style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {showNew ? 'Cancelar' : '+ Novo pedido'}
          </button>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {showNew && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(KIND_META) as Service['kind'][]).map(k => (
                <button key={k} onClick={() => setNewKind(k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newKind === k ? 'var(--ink)' : 'var(--border)'}`, background: newKind === k ? 'var(--ink)' : 'white', color: newKind === k ? 'white' : 'var(--ink-3)' }}>
                  <Icon name={KIND_META[k].icon} size={15} color={newKind === k ? 'white' : 'var(--ink-3)'} /> {KIND_META[k].label}
                </button>
              ))}
            </div>
            <select value={newPatient} onChange={e => setNewPatient(e.target.value)} style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}>
              <option value="">Sem {cfg.personNoun.toLowerCase()} associado</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Detalhe (opcional)"
              style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
            <button onClick={create} disabled={saving} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'A publicar…' : 'Publicar pedido'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {columns.map(colStatus => {
              const items = services.filter(s => s.status === colStatus)
              return (
                <div key={colStatus}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: STATUS_META[colStatus].color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
                    {STATUS_META[colStatus].label} ({items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.length === 0 && (
                      <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 12.5 }}>Nada aqui.</div>
                    )}
                    {items.map(s => (
                      <div key={s.id} style={{ background: STATUS_META[s.status].bg, border: `1px solid ${STATUS_META[s.status].color}33`, borderRadius: 10, padding: '11px 13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                            <Icon name={KIND_META[s.kind].icon} size={15} color="var(--ink)" /> {KIND_META[s.kind].label}
                          </div>
                          <button onClick={() => remove(s.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16, padding: 0 }}>×</button>
                        </div>
                        {nameOf(s.patient_id) && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{nameOf(s.patient_id)}</div>}
                        {s.notes && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{s.notes}</div>}
                        <button onClick={() => advance(s)} style={{ marginTop: 8, padding: '5px 11px', background: 'white', border: `1px solid ${STATUS_META[s.status].color}`, color: STATUS_META[s.status].color, borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                          {s.status === 'pedido' ? 'Assumir →' : 'Concluir ✓'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
