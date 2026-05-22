'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

interface FamilyContact {
  id: string
  name: string
  relationship?: string
  phone?: string
  email?: string
  is_emergency: boolean
  is_legal_guardian: boolean
  patient_id: string
  patient_name?: string
  patient_room?: string
}

interface FamilyMessage {
  id: string
  contact_id: string
  patient_id: string
  contact_name?: string
  patient_name?: string
  subject: string
  body: string
  type: 'update' | 'alert' | 'visit' | 'report' | 'general'
  direction: 'sent' | 'received'
  read: boolean
  created_at: string
}

interface VisitRequest {
  id: string
  contact_id: string
  patient_id: string
  contact_name?: string
  patient_name?: string
  requested_date: string
  requested_time: string
  notes?: string
  status: 'pending' | 'approved' | 'declined' | 'completed'
  created_at: string
}

interface Patient {
  id: string
  name: string
  room?: string
}

const MSG_TYPES = {
  update:  { label: 'Atualização',  color: '#2563eb',  bg: '#eff6ff',  border: '#bfdbfe',  emoji: '📋' },
  alert:   { label: 'Alerta',       color: '#dc2626',  bg: '#fef2f2',  border: '#fecaca',  emoji: '⚠️' },
  visit:   { label: 'Visita',       color: '#7c3aed',  bg: '#faf5ff',  border: '#e9d5ff',  emoji: '👨‍👩‍👧' },
  report:  { label: 'Relatório',    color: '#16a34a',  bg: '#f0fdf4',  border: '#bbf7d0',  emoji: '📊' },
  general: { label: 'Geral',        color: '#6b7280',  bg: '#f9fafb',  border: '#e5e7eb',  emoji: '💬' },
}

const VISIT_STATUS = {
  pending:   { label: 'Pendente',   bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  approved:  { label: 'Aprovada',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  declined:  { label: 'Recusada',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  completed: { label: 'Realizada',  bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}

const TEMPLATES = [
  { label: 'Atualização de saúde', subject: 'Atualização de estado de saúde', body: 'Informamos que {nome} está bem e a adaptar-se positivamente. Caso tenha questões, estamos disponíveis.' },
  { label: 'Avaliação realizada',  subject: 'Avaliação de {nome} realizada', body: 'Foi realizada uma avaliação de rotina a {nome}. Os resultados serão partilhados em breve com a família.' },
  { label: 'Lembrete de visita',   subject: 'Lembrete — horário de visitas', body: 'Lembramos que os horários de visita são das 14h às 18h nos dias úteis e das 10h às 18h aos fins de semana.' },
  { label: 'Alta de enfermagem',   subject: 'Nota de enfermagem — {nome}', body: 'Informamos que {nome} necessitou de cuidados adicionais hoje. A equipa de enfermagem acompanhou a situação. Não há motivo de alarme.' },
]

export default function FamilyPage() {
  const { user, supabase } = useAuth() as any
  const [tab, setTab] = useState<'messages' | 'visits' | 'contacts'>('messages')
  const [contacts, setContacts] = useState<FamilyContact[]>([])
  const [messages, setMessages] = useState<FamilyMessage[]>([])
  const [visits, setVisits] = useState<VisitRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FamilyMessage | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [saving, setSaving] = useState(false)

  const [compose, setCompose] = useState({
    patient_id: '', contact_id: '', subject: '', body: '', type: 'update' as FamilyMessage['type'],
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: ctcs }, { data: msgs }, { data: vsts }] = await Promise.all([
      supabase.from('patients').select('id, name, room').eq('user_id', user.id).order('name'),
      supabase.from('resident_contacts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('family_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('visit_requests').select('*').eq('user_id', user.id).order('requested_date', { ascending: false }),
    ])
    setPatients(pats || [])
    setContacts(ctcs || [])
    setMessages(msgs || [])
    setVisits(vsts || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  // Enrich contacts with patient names
  const enrichedContacts: FamilyContact[] = contacts.map(c => ({
    ...c,
    patient_name: patients.find(p => p.id === c.patient_id)?.name,
    patient_room: patients.find(p => p.id === c.patient_id)?.room,
  }))

  const enrichedMessages: FamilyMessage[] = messages.map(m => ({
    ...m,
    contact_name: contacts.find(c => c.id === m.contact_id)?.name,
    patient_name: patients.find(p => p.id === m.patient_id)?.name,
  }))

  const enrichedVisits: VisitRequest[] = visits.map(v => ({
    ...v,
    contact_name: contacts.find(c => c.id === v.contact_id)?.name,
    patient_name: patients.find(p => p.id === v.patient_id)?.name,
  }))

  const patientContacts = compose.patient_id
    ? enrichedContacts.filter(c => c.patient_id === compose.patient_id)
    : []

  function applyTemplate(tpl: typeof TEMPLATES[0]) {
    const patName = patients.find(p => p.id === compose.patient_id)?.name || '{nome}'
    setCompose(prev => ({
      ...prev,
      subject: tpl.subject.replace('{nome}', patName),
      body: tpl.body.replace(/{nome}/g, patName),
    }))
  }

  async function sendMessage() {
    if (!compose.patient_id || !compose.subject.trim() || !compose.body.trim() || !user) return
    setSaving(true)
    await supabase.from('family_messages').insert({
      user_id: user.id,
      patient_id: compose.patient_id,
      contact_id: compose.contact_id || null,
      subject: compose.subject.trim(),
      body: compose.body.trim(),
      type: compose.type,
      direction: 'sent',
      read: true,
    })
    setSaving(false)
    setShowCompose(false)
    setCompose({ patient_id: '', contact_id: '', subject: '', body: '', type: 'update' })
    load()
  }

  async function updateVisitStatus(id: string, status: VisitRequest['status']) {
    await supabase.from('visit_requests').update({ status }).eq('id', id)
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  const unreadCount = messages.filter(m => !m.read && m.direction === 'received').length
  const pendingVisits = visits.filter(v => v.status === 'pending').length

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0b1120' }}>Portal Família</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Comunicação com familiares e tutores legais dos residentes</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + Nova Mensagem
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Contactos ativos',  value: enrichedContacts.length,                         color: '#2563eb' },
          { label: 'Mensagens enviadas', value: messages.filter(m => m.direction === 'sent').length, color: '#7c3aed' },
          { label: 'Não lidas',         value: unreadCount,                                     color: unreadCount > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Visitas pendentes', value: pendingVisits,                                   color: pendingVisits > 0 ? '#d97706' : '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1.5px solid #e5e7eb' }}>
        {([
          ['messages', 'Mensagens'],
          ['visits',   'Visitas'],
          ['contacts', 'Contactos'],
        ] as const).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: '10px 18px', border: 'none', borderBottom: `2px solid ${tab === t ? '#2563eb' : 'transparent'}`, background: 'none', color: tab === t ? '#2563eb' : '#6b7280', fontWeight: tab === t ? 600 : 400, fontSize: 14, cursor: 'pointer', marginBottom: -1.5 }}
          >
            {l}
            {t === 'visits' && pendingVisits > 0 && (
              <span style={{ marginLeft: 6, background: '#d97706', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{pendingVisits}</span>
            )}
            {t === 'messages' && unreadCount > 0 && (
              <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>A carregar...</div>
      ) : (
        <>
          {/* Messages tab */}
          {tab === 'messages' && (
            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 16 }}>
              <div>
                {enrichedMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <div style={{ fontWeight: 600, color: '#374151' }}>Sem mensagens ainda</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Clica em "+ Nova Mensagem" para comunicar com as famílias</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {enrichedMessages.map(msg => {
                      const mt = MSG_TYPES[msg.type]
                      const isSelected = selected?.id === msg.id
                      const isUnread = !msg.read && msg.direction === 'received'
                      return (
                        <div
                          key={msg.id}
                          onClick={() => setSelected(isSelected ? null : msg)}
                          style={{ background: '#fff', border: `1.5px solid ${isSelected ? '#2563eb' : isUnread ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: mt.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{mt.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: isUnread ? 700 : 600, fontSize: 14, color: '#0b1120' }}>{msg.subject}</span>
                              <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: mt.bg, color: mt.color, border: `1px solid ${mt.border}` }}>{mt.label}</span>
                              {msg.direction === 'sent' && <span style={{ fontSize: 11, color: '#9ca3af' }}>Enviada</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                              {msg.patient_name && <span style={{ fontWeight: 500 }}>{msg.patient_name}</span>}
                              {msg.contact_name && <span> · {msg.contact_name}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{msg.body}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
                            {new Date(msg.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {selected && (() => {
                const mt = MSG_TYPES[selected.type]
                return (
                  <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 20, position: 'sticky', top: 20, alignSelf: 'start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: mt.bg, color: mt.color, border: `1px solid ${mt.border}` }}>{mt.emoji} {mt.label}</span>
                      <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#0b1120', marginBottom: 8 }}>{selected.subject}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                      {selected.patient_name && <div><strong>Residente:</strong> {selected.patient_name}</div>}
                      {selected.contact_name && <div><strong>Familiar:</strong> {selected.contact_name}</div>}
                      <div><strong>Data:</strong> {new Date(selected.created_at).toLocaleString('pt-PT')}</div>
                    </div>
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.body}</div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Visits tab */}
          {tab === 'visits' && (
            <div>
              {enrichedVisits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Sem visitas registadas</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Os pedidos de visita das famílias aparecerão aqui</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {enrichedVisits.map(v => {
                    const vs = VISIT_STATUS[v.status]
                    return (
                      <div key={v.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0b1120' }}>
                            {v.contact_name || 'Familiar'} → {v.patient_name || 'Residente'}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                            📅 {new Date(v.requested_date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às {v.requested_time}
                          </div>
                          {v.notes && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{v.notes}</div>}
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: vs.bg, color: vs.color, border: `1px solid ${vs.border}` }}>{vs.label}</span>
                        {v.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => updateVisitStatus(v.id, 'approved')} style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Aprovar</button>
                            <button onClick={() => updateVisitStatus(v.id, 'declined')} style={{ padding: '5px 12px', background: '#f3f4f6', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Recusar</button>
                          </div>
                        )}
                        {v.status === 'approved' && (
                          <button onClick={() => updateVisitStatus(v.id, 'completed')} style={{ padding: '5px 12px', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Marcar realizada</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Contacts tab */}
          {tab === 'contacts' && (
            <div>
              {enrichedContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                  <div style={{ fontWeight: 600, color: '#374151' }}>Sem contactos familiares</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Adiciona contactos no perfil de cada residente</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {enrichedContacts.map(c => (
                    <div key={c.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0b1120' }}>{c.name}</div>
                          {c.relationship && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.relationship}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.is_emergency && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20 }}>Urgência</span>}
                          {c.is_legal_guardian && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 20 }}>Tutor</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                        🏠 <strong>{c.patient_name}</strong>{c.patient_room ? ` · Q.${c.patient_room}` : ''}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📞 {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✉️ {c.email}
                          </a>
                        )}
                      </div>
                      {c.email && (
                        <button
                          onClick={() => { setCompose(prev => ({ ...prev, patient_id: c.patient_id, contact_id: c.id })); setShowCompose(true) }}
                          style={{ marginTop: 10, width: '100%', padding: '7px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                        >Enviar mensagem</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Compose modal */}
      {showCompose && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowCompose(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nova Mensagem</h2>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Template quick fills */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Modelo rápido</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => applyTemplate(tpl)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer' }}
                    >{tpl.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Residente *</label>
                  <select value={compose.patient_id} onChange={e => setCompose(p => ({ ...p, patient_id: e.target.value, contact_id: '' }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">Selecionar...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.room ? ` (Q.${p.room})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Para (familiar)</label>
                  <select value={compose.contact_id} onChange={e => setCompose(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} disabled={!compose.patient_id}>
                    <option value="">Todos / General</option>
                    {patientContacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.relationship ? ` (${c.relationship})` : ''}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.entries(MSG_TYPES) as [FamilyMessage['type'], typeof MSG_TYPES.update][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setCompose(p => ({ ...p, type: key }))}
                      style={{ padding: '5px 10px', borderRadius: 20, border: `1.5px solid ${compose.type === key ? cfg.color : '#e5e7eb'}`, background: compose.type === key ? cfg.bg : '#fff', color: compose.type === key ? cfg.color : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                    >{cfg.emoji} {cfg.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Assunto *</label>
                <input value={compose.subject} onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))} placeholder="Assunto da mensagem" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mensagem *</label>
                <textarea value={compose.body} onChange={e => setCompose(p => ({ ...p, body: e.target.value }))} rows={5} placeholder="Escreve a mensagem para a família..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <button
                onClick={sendMessage}
                disabled={!compose.patient_id || !compose.subject.trim() || !compose.body.trim() || saving}
                style={{ padding: '12px 20px', background: compose.patient_id && compose.subject.trim() && compose.body.trim() ? '#2563eb' : '#e5e7eb', color: compose.patient_id && compose.subject.trim() && compose.body.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 4 }}
              >{saving ? 'A enviar...' : 'Registar Mensagem'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
