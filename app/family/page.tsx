'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { useToast } from '@/components/Toast'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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
  room_number?: string
}

const MSG_TYPES = {
  update:  { label: 'Atualização',  color: 'var(--ink-2)',  bg: 'var(--bg-2)',  border: 'var(--border)',  icon: 'note' },
  alert:   { label: 'Alerta',       color: 'var(--red)',  bg: 'var(--badge-red-bg)',  border: 'var(--badge-red-border)',  icon: 'alert' },
  visit:   { label: 'Visita',       color: 'var(--ink-3)',  bg: 'var(--bg-2)',  border: 'var(--border)',  icon: 'family' },
  report:  { label: 'Relatório',    color: 'var(--green)',  bg: 'var(--badge-green-bg)',  border: 'var(--badge-green-border)',  icon: 'chart' },
  general: { label: 'Geral',        color: 'var(--ink-4)',  bg: 'var(--bg-2)',  border: 'var(--border)',  icon: 'chat' },
}

const VISIT_STATUS = {
  pending:   { label: 'Pendente',   bg: 'var(--badge-amber-bg)', color: 'var(--amber)', border: 'var(--badge-amber-border)' },
  approved:  { label: 'Aprovada',   bg: 'var(--badge-green-bg)', color: 'var(--green)', border: 'var(--badge-green-border)' },
  declined:  { label: 'Recusada',   bg: 'var(--badge-red-bg)', color: 'var(--red)', border: 'var(--badge-red-border)' },
  completed: { label: 'Realizada',  bg: 'var(--bg-2)', color: 'var(--ink-4)', border: 'var(--border)' },
}

const TEMPLATES = [
  { label: 'Atualização de saúde', subject: 'Atualização de estado de saúde', body: 'Informamos que {nome} está bem e a adaptar-se positivamente. Caso tenha questões, estamos disponíveis.' },
  { label: 'Avaliação realizada',  subject: 'Avaliação de {nome} realizada', body: 'Foi realizada uma avaliação de rotina a {nome}. Os resultados serão partilhados em breve com a família.' },
  { label: 'Lembrete de visita',   subject: 'Lembrete — horário de visitas', body: 'Lembramos que os horários de visita são das 14h às 18h nos dias úteis e das 10h às 18h aos fins de semana.' },
  { label: 'Alta de enfermagem',   subject: 'Nota de enfermagem — {nome}', body: 'Informamos que {nome} necessitou de cuidados adicionais hoje. A equipa de enfermagem acompanhou a situação. Não há motivo de alarme.' },
]

export default function FamilyPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const toast = useToast()
  const cfg = institutionConfig(institution)
  const person = cfg.personNoun
  const personLower = person.toLowerCase()
  const [tab, setTab] = useState<'conversa' | 'visits' | 'contacts'>('conversa')
  const [contacts, setContacts] = useState<FamilyContact[]>([])
  const [messages, setMessages] = useState<FamilyMessage[]>([])
  const [visits, setVisits] = useState<VisitRequest[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FamilyMessage | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  // "O dia em 1 foto" — partilha 1 foto com TODAS as famílias dos presentes hoje
  const [dayPhotoBusy, setDayPhotoBusy] = useState(false)
  const [dayPhotoMsg, setDayPhotoMsg] = useState('')
  const dayPhotoInput = useRef<HTMLInputElement>(null)

  const [compose, setCompose] = useState({
    patient_id: '', contact_id: '', subject: '', body: '', type: 'update' as FamilyMessage['type'],
  })

  const [showVisit, setShowVisit] = useState(false)
  const [savingVisit, setSavingVisit] = useState(false)
  const [visitForm, setVisitForm] = useState({
    patient_id: '', contact_id: '', requested_date: new Date().toISOString().slice(0, 10),
    requested_time: new Date().toTimeString().slice(0, 5), notes: '', status: 'completed' as VisitRequest['status'],
  })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: pats }, { data: ctcs }, { data: msgs }, { data: vsts }] = await Promise.all([
      scope.filter(supabase.from('patients').select('*')).order('name'),
      scope.filter(supabase.from('resident_contacts').select('*')).order('name'),
      scope.filter(supabase.from('family_messages').select('*')).order('created_at', { ascending: false }),
      scope.filter(supabase.from('visit_requests').select('*')).order('requested_date', { ascending: false }),
    ])
    setPatients(pats || [])
    setContacts(ctcs || [])
    setMessages(msgs || [])
    setVisits(vsts || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  // Não-lidas: respostas da família por ler pela equipa, por residente
  const [unreadByPt, setUnreadByPt] = useState<Record<string, number>>({})
  const loadUnread = useCallback(async () => {
    if (!user) return
    const { data, error: erroLeitura1 } = await supabase.from('family_thread_messages')
      .select('patient_id').eq('user_id', user.id).eq('author_side', 'family').eq('read_by_staff', false)
    if (erroLeitura1) reportError('family-read', erroLeitura1)
    const counts: Record<string, number> = {}
    ;(data || []).forEach((r: any) => { counts[r.patient_id] = (counts[r.patient_id] || 0) + 1 })
    setUnreadByPt(counts)
  }, [user, supabase])
  useEffect(() => { loadUnread() }, [loadUnread])
  const totalUnread = Object.values(unreadByPt).reduce((s, n) => s + n, 0)

  // Atualiza ao vivo: mensagens novas das famílias (thread), avisos, pedidos de
  // visita e alterações aos utentes/contactos refletem-se sem recarregar.
  useLiveData({
    supabase, userId: user?.id,
    table: ['family_messages', 'family_thread_messages', 'visit_requests', 'resident_contacts', 'patients'],
    onChange: () => { load(); loadUnread() },
  })

  // Enrich contacts with patient names
  const enrichedContacts: FamilyContact[] = contacts.map(c => ({
    ...c,
    patient_name: patients.find(p => p.id === c.patient_id)?.name,
    patient_room: patients.find(p => p.id === c.patient_id)?.room_number,
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

  // Carta semanal por IA (Módulo 3, 2026-08-16) — junta dados reais da semana
  // (app/api/carta-semanal) e PREENCHE o formulário já existente, exatamente
  // como um modelo rápido; nunca envia sozinha. A pessoa revê/edita o texto
  // no mesmo textarea de sempre antes de tocar em "Registar Mensagem".
  const [generatingLetter, setGeneratingLetter] = useState(false)
  async function generateWeeklyLetter() {
    if (!compose.patient_id || generatingLetter) return
    setGeneratingLetter(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/carta-semanal', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ patient_id: compose.patient_id }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error('Não foi possível gerar a carta', j.error || 'Tenta de novo.'); return }
      setCompose(p => ({ ...p, subject: j.subject, body: j.body, type: 'report' }))
    } catch (e) {
      toast.error('Não foi possível gerar a carta', reportError('carta-semanal', e, 'Tenta de novo.'))
    } finally { setGeneratingLetter(false) }
  }

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
    const { error } = await supabase.from('family_messages').insert(scope.stamp({
      user_id: user.id,
      patient_id: compose.patient_id,
      contact_id: compose.contact_id || null,
      subject: compose.subject.trim(),
      body: compose.body.trim(),
      type: compose.type,
      direction: 'sent',
      read: true,
    }))
    setSaving(false)
    if (error) { toast.error('Não foi possível enviar a mensagem', reportError('family-msg', error, 'Tenta de novo.')); return }
    setShowCompose(false)
    setCompose({ patient_id: '', contact_id: '', subject: '', body: '', type: 'update' })
    load()
  }

  // "O dia em 1 foto": 1 upload → mensagem com foto para a família de cada utente
  // com registo de cuidado HOJE (os presentes). Pouco esforço, muito valor.
  async function broadcastDayPhoto(file: File) {
    if (!user || !file) return
    setDayPhotoBusy(true); setDayPhotoMsg('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      // presentes = quem tem care_record hoje (org-scoped)
      const { data: care } = await scope.filter(supabase.from('care_records').select('patient_id')).eq('date', today)
      const presentIds = [...new Set((care || []).map((c: any) => c.patient_id))]
      const targetIds = presentIds.length ? presentIds : patients.map(p => p.id)   // se ninguém marcado ainda, manda a todos
      if (!targetIds.length) { setDayPhotoMsg('Sem utentes para partilhar.'); setDayPhotoBusy(false); return }
      // downscale + upload UMA vez
      const dataUrl: string = await new Promise((res, rej) => {
        const img = new window.Image(); const url = URL.createObjectURL(file)
        img.onload = () => { URL.revokeObjectURL(url); let w = img.width, h = img.height; const max = 1280; if (w > max || h > max) { if (w >= h) { h = Math.round(h * max / w); w = max } else { w = Math.round(w * max / h); h = max } } const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); if (!ctx) return rej(new Error('canvas')); ctx.drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.82)) }
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')) }; img.src = url
      })
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${user.id}/day/${Date.now()}.jpg`
      const up = await supabase.storage.from('family').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      const photo_url = up.error ? null : supabase.storage.from('family').getPublicUrl(path).data.publicUrl
      if (!photo_url) { setDayPhotoMsg('Falha ao carregar a foto.'); setDayPhotoBusy(false); return }
      // 1 mensagem por utente presente
      const rows = targetIds.map(pid => scope.stamp({
        user_id: user.id, patient_id: pid, author_side: 'staff',
        author_name: user.name || 'Equipa', kind: 'photo',
        content: 'Um momento do dia 💛', photo_url, read_by_family: false, read_by_staff: true,
      }))
      const { error } = await supabase.from('family_thread_messages').insert(rows)
      setDayPhotoMsg(error ? 'Erro ao enviar.' : `✓ Foto partilhada com ${targetIds.length} ${targetIds.length === 1 ? 'família' : 'famílias'}.`)
    } catch { setDayPhotoMsg('Não foi possível partilhar a foto.') }
    finally { setDayPhotoBusy(false); setTimeout(() => setDayPhotoMsg(''), 4000) }
  }

  async function updateVisitStatus(id: string, status: VisitRequest['status']) {
    const { error } = await supabase.from('visit_requests').update({ status }).eq('id', id)
    if (error) { toast.error('Não foi possível atualizar a visita', reportError('family-visit-update', error, 'Tenta de novo.')); return }
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  const visitContacts = visitForm.patient_id ? enrichedContacts.filter(c => c.patient_id === visitForm.patient_id) : []
  async function saveVisit() {
    if (!visitForm.patient_id || !user) return
    setSavingVisit(true)
    const { error } = await supabase.from('visit_requests').insert(scope.stamp({
      user_id: user.id,
      patient_id: visitForm.patient_id,
      contact_id: visitForm.contact_id || null,
      requested_date: visitForm.requested_date,
      requested_time: visitForm.requested_time || '00:00',
      notes: visitForm.notes || null,
      status: visitForm.status,
    }))
    setSavingVisit(false)
    if (error) { toast.error('Não foi possível registar a visita', reportError('family-visit-register', error, 'Tenta de novo.')); return }
    setShowVisit(false)
    setVisitForm({ patient_id: '', contact_id: '', requested_date: new Date().toISOString().slice(0, 10), requested_time: new Date().toTimeString().slice(0, 5), notes: '', status: 'completed' })
    load()
  }

  const pendingVisits = visits.filter(v => v.status === 'pending').length
  const largo = useLargo()
  /* Se a foto do dia correu bem ou não era lido de `dayPhotoMsg.startsWith('✓')`
     — um emoji a servir de valor de retorno. Um estado não se lê do texto que
     se mostra a quem lá está. */
  const dayPhotoFalhou = /^[✕×]/.test(dayPhotoMsg || '') || /não|erro|falh/i.test(dayPhotoMsg || '')

  /* A MOLDURA — refeita (2026-10-08).

     Tinha «Portal Família» a 22px em negrito com um parágrafo por baixo, e a
     barra lateral já diz «Famílias». Dois títulos para a mesma coisa.

     As badges dos separadores FICAM: são a única coisa nesta página que diz
     «há coisas por responder». Mudam de língua, não de função. */
  return (
    <Mesa
      altura={tab === 'conversa' ? 'janela' : 'documento'}
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Famílias</span>

          <Seletor
            opcoes={[
              { id: 'conversa', rotulo: totalUnread > 0 ? `Conversa ${totalUnread}` : 'Conversa' },
              { id: 'visits', rotulo: pendingVisits > 0 ? `Visitas ${pendingVisits}` : 'Visitas' },
              { id: 'contacts', rotulo: `Contactos ${contacts.length}` },
            ]}
            ativa={tab} aoMudar={v => setTab(v as typeof tab)} />

          {totalUnread > 0 && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
              {totalUnread} POR LER
            </span>
          )}
          {pendingVisits > 0 && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
              {pendingVisits} VISITA{pendingVisits === 1 ? '' : 'S'} POR RESPONDER
            </span>
          )}

          <span style={{ display: 'inline-flex', gap: 6, marginLeft: largo ? 'auto' : undefined }}>
            <input ref={dayPhotoInput} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) broadcastDayPhoto(f); e.target.value = '' }} />
            <Botao onClick={() => dayPhotoInput.current?.click()} esperando={dayPhotoBusy}
              titulo="Uma foto do dia, enviada às famílias de quem esteve presente">FOTO DO DIA</Botao>
            <Botao feitio="principal" onClick={() => setShowCompose(true)}>NOVA MENSAGEM</Botao>
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>A família vê o que se escreve aqui</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Comunicação com familiares e tutores legais {cfg.personNounPlural ? `d${cfg.personNounPlural.toLowerCase().startsWith('u') ? 'o' : 'o'}s ${cfg.personNounPlural.toLowerCase()}` : ''}
          </span>
        </BarraDeEstado>
      }
    >
      {dayPhotoMsg && <Aviso tom={dayPhotoFalhou ? 'mau' : 'bom'}>{dayPhotoMsg.replace(/^[✓✕×]\s*/, '')}</Aviso>}

      {loading ? (
        <Painel><ACarregar oQue="A abrir as conversas…" /></Painel>
      ) : (
        <>
          {/* Conversa tab — fio em tempo real lar↔família por residente */}
          {tab === 'conversa' && (
            <FamilyThread patients={patients} contacts={enrichedContacts} user={user} supabase={supabase} cfg={cfg} orgId={scope.orgId}
              unreadByPt={unreadByPt} onRead={(pid: string) => setUnreadByPt(prev => { const n = { ...prev }; delete n[pid]; return n })} />
          )}

          {/* Messages tab */}
          {/* Visits tab */}
          {tab === 'visits' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)' }}>Livro de visitas e pedidos das famílias.</div>
                <button onClick={() => { setVisitForm(f => ({ ...f, patient_id: '', contact_id: '' })); setShowVisit(true) }}
                  style={{ padding: '8px 16px', background: 'var(--ink-3)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 'var(--peso-forte)' as any, fontSize: 'var(--t-dado)', cursor: 'pointer' }}>
                  + Registar visita
                </button>
              </div>
              {enrichedVisits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-5)' }}>
                  <div style={{ display: 'inline-flex', marginBottom: 12 }}><Icon name="family" size={38} color="var(--border-2)" /></div>
                  <div style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)' }}>Sem visitas registadas</div>
                  <div style={{ fontSize: 'var(--t-dado)', marginTop: 4 }}>Os pedidos de visita das famílias aparecerão aqui</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {enrichedVisits.map(v => {
                    const vs = VISIT_STATUS[v.status]
                    return (
                      <div key={v.id} style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>
                            {v.contact_name || 'Familiar'} → {v.patient_name || person}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 3 }}>
                            <Icon name="calendar" size={13} color="var(--ink-4)" /> {new Date(v.requested_date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}{v.requested_time ? ` às ${v.requested_time}` : ' · hora a combinar'}
                          </div>
                          {v.notes && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>{v.notes}</div>}
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, background: vs.bg, color: vs.color, border: `1px solid ${vs.border}` }}>{vs.label}</span>
                        {v.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => updateVisitStatus(v.id, 'approved')} style={{ padding: '5px 12px', background: 'var(--green)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontWeight: 'var(--peso-corpo)' as any }}>Aprovar</button>
                            <button onClick={() => updateVisitStatus(v.id, 'declined')} style={{ padding: '5px 12px', background: 'var(--bg-3)', color: 'var(--red)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', cursor: 'pointer' }}>Recusar</button>
                          </div>
                        )}
                        {v.status === 'approved' && (
                          <button onClick={() => updateVisitStatus(v.id, 'completed')} style={{ padding: '5px 12px', background: 'var(--bg-3)', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', cursor: 'pointer' }}>Marcar realizada</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Contacts tab */}
          {tab === 'contacts' && (() => {
            const ql = contactSearch.trim().toLowerCase()
            const filtered = enrichedContacts.filter(c =>
              !ql ||
              c.name.toLowerCase().includes(ql) ||
              (c.patient_name || '').toLowerCase().includes(ql) ||
              (c.relationship || '').toLowerCase().includes(ql) ||
              (c.phone || '').includes(ql)
            )
            // Group by resident
            const groups = new Map<string, { patientName: string; room?: string; contacts: FamilyContact[] }>()
            filtered.forEach(c => {
              const key = c.patient_id || 'sem'
              if (!groups.has(key)) groups.set(key, { patientName: c.patient_name || `Sem ${personLower}`, room: c.patient_room, contacts: [] })
              groups.get(key)!.contacts.push(c)
            })
            const groupList = Array.from(groups.values()).sort((a, b) => a.patientName.localeCompare(b.patientName))
            return (
              <div>
                {enrichedContacts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-5)' }}>
                    <div style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)' }}>Sem contactos familiares</div>
                    <div style={{ fontSize: 'var(--t-dado)', marginTop: 4 }}>Adiciona contactos no perfil de cada {personLower}</div>
                  </div>
                ) : (
                  <>
                    <input
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      placeholder={`Pesquisar por contacto, ${personLower}, parentesco ou telefone...`}
                      style={{ width: '100%', maxWidth: 420, marginBottom: 18, padding: '9px 13px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {groupList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>Nenhum contacto corresponde a “{contactSearch}”.</div>
                    ) : groupList.map(g => (
                      <div key={g.patientName} style={{ marginBottom: 22 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{g.patientName}</span>
                          {g.room && <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Quarto {g.room}</span>}
                          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>· {g.contacts.length} contacto{g.contacts.length !== 1 ? 's' : ''}</span>
                          <div style={{ flex: 1, height: 1, background: 'var(--bg-3)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                          {g.contacts.map(c => (
                            <div key={c.id} style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 6 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-corpo)', color: 'var(--ink)' }}>{c.name}</div>
                                  {c.relationship && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{c.relationship}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {c.is_emergency && <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-corpo)' as any, padding: '2px 6px', background: 'var(--badge-red-bg)', color: 'var(--red)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-xl)' }}>Urgência</span>}
                                  {c.is_legal_guardian && <span style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-corpo)' as any, padding: '2px 6px', background: 'var(--bg-2)', color: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)' }}>Tutor</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', textDecoration: 'none' }}>{c.phone}</a>}
                                {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', textDecoration: 'none' }}>{c.email}</a>}
                              </div>
                              <button
                                onClick={() => { setCompose(prev => ({ ...prev, patient_id: c.patient_id, contact_id: c.id })); setShowCompose(true) }}
                                style={{ marginTop: 10, width: '100%', padding: '7px', background: 'var(--bg-3)', color: 'var(--ink-3)', border: 'none', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontWeight: 'var(--peso-corpo)' as any }}
                              >Enviar mensagem</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* Compose modal */}
      {showCompose && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowCompose(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any }}>Nova Mensagem</h2>
              <button aria-label="Fechar" onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-5)' }}>×</button>            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Template quick fills */}
              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Modelo rápido</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => applyTemplate(tpl)}
                      style={{ padding: '5px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--ink-3)', fontSize: 'var(--t-meta)', cursor: 'pointer' }}
                    >{tpl.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{person} *</label>
                  <select value={compose.patient_id} onChange={e => setCompose(p => ({ ...p, patient_id: e.target.value, contact_id: '' }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }}>
                    <option value="">Selecionar...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.room_number ? ` (Q.${p.room_number})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Para (familiar)</label>
                  <select value={compose.contact_id} onChange={e => setCompose(p => ({ ...p, contact_id: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }} disabled={!compose.patient_id}>
                    <option value="">Todos / General</option>
                    {patientContacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.relationship ? ` (${c.relationship})` : ''}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={generateWeeklyLetter} disabled={!compose.patient_id || generatingLetter}
                title={!compose.patient_id ? `Escolhe primeiro ${personLower}` : undefined}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--border)', background: compose.patient_id ? 'var(--bg-2)' : 'var(--bg-2)', color: compose.patient_id ? 'var(--ink-2)' : 'var(--green-mid)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: compose.patient_id && !generatingLetter ? 'pointer' : 'not-allowed' }}>
                {generatingLetter ? 'A escrever a carta semanal…' : '✨ Gerar carta semanal com IA'}
              </button>

              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.entries(MSG_TYPES) as [FamilyMessage['type'], typeof MSG_TYPES.update][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setCompose(p => ({ ...p, type: key }))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-xl)', border: `1.5px solid ${compose.type === key ? cfg.color : 'var(--border)'}`, background: compose.type === key ? cfg.bg : 'var(--bg)', color: compose.type === key ? cfg.color : 'var(--ink-4)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontWeight: 'var(--peso-corpo)' as any }}
                    ><Icon name={cfg.icon} size={13} color={compose.type === key ? cfg.color : 'var(--ink-4)'} /> {cfg.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Assunto *</label>
                <input value={compose.subject} onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))} placeholder="Assunto da mensagem" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Mensagem *</label>
                <textarea value={compose.body} onChange={e => setCompose(p => ({ ...p, body: e.target.value }))} rows={5} placeholder="Escreve a mensagem para a família..." style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <button
                onClick={sendMessage}
                disabled={!compose.patient_id || !compose.subject.trim() || !compose.body.trim() || saving}
                style={{ padding: '12px 20px', background: compose.patient_id && compose.subject.trim() && compose.body.trim() ? 'var(--ink-2)' : 'var(--border)', color: compose.patient_id && compose.subject.trim() && compose.body.trim() ? 'var(--bg)' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-corpo)', cursor: 'pointer', marginTop: 4 }}
              >{saving ? 'A enviar...' : 'Registar Mensagem'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Registar visita modal */}
      {showVisit && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowVisit(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any }}>Registar visita</h2>
              <button aria-label="Fechar" onClick={() => setShowVisit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-5)' }}>×</button>            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="vf-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{person} *</label>
                  <select value={visitForm.patient_id} onChange={e => setVisitForm(p => ({ ...p, patient_id: e.target.value, contact_id: '' }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }}>
                    <option value="">Selecionar...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.room_number ? ` (Q.${p.room_number})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Visitante</label>
                  <select value={visitForm.contact_id} onChange={e => setVisitForm(p => ({ ...p, contact_id: e.target.value }))} disabled={!visitForm.patient_id} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }}>
                    <option value="">Familiar / outro</option>
                    {visitContacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.relationship ? ` (${c.relationship})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Data *</label>
                  <input type="date" value={visitForm.requested_date} onChange={e => setVisitForm(p => ({ ...p, requested_date: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Hora</label>
                  <input type="time" value={visitForm.requested_time} onChange={e => setVisitForm(p => ({ ...p, requested_time: e.target.value }))} style={{ width: '100%', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>Estado</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.entries(VISIT_STATUS) as [VisitRequest['status'], typeof VISIT_STATUS.pending][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setVisitForm(p => ({ ...p, status: key }))}
                      style={{ padding: '5px 12px', borderRadius: 'var(--r-xl)', border: `1.5px solid ${visitForm.status === key ? cfg.color : 'var(--border)'}`, background: visitForm.status === key ? cfg.bg : 'var(--bg)', color: visitForm.status === key ? cfg.color : 'var(--ink-4)', fontSize: 'var(--t-meta)', cursor: 'pointer', fontWeight: 'var(--peso-corpo)' as any }}>{cfg.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea value={visitForm.notes} onChange={e => setVisitForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder={`Ex: trouxe roupa lavada, almoçou com o/a ${personLower}...`} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <button onClick={saveVisit} disabled={!visitForm.patient_id || savingVisit}
                style={{ padding: '12px 20px', background: visitForm.patient_id ? 'var(--ink-3)' : 'var(--border)', color: visitForm.patient_id ? 'var(--bg)' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 'var(--peso-corpo)' as any, fontSize: 'var(--t-corpo)', cursor: visitForm.patient_id ? 'pointer' : 'default', marginTop: 4 }}>
                {savingVisit ? 'A guardar...' : 'Registar visita'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .family-msg-grid { grid-template-columns: 1fr !important; }
          .vf-grid { grid-template-columns: 1fr !important; }
          /* Conversa estilo WhatsApp: ou vejo a LISTA, ou a CONVERSA (uma de cada vez). */
          .ft-grid { grid-template-columns: 1fr !important; height: 100% !important; min-height: 0 !important; }
          .ft-list[data-open="chat"] { display: none !important; }
          .ft-chat[data-open="list"] { display: none !important; }
          .ft-list[data-open="list"], .ft-chat[data-open="chat"] { height: 100%; }
          .ft-back { display: inline-block !important; }
        }
      `}</style>
    </Mesa>
  )
}

// ─── Phlox Família: fio de conversa lar↔família por residente ──────────────────

interface ThreadMsg {
  id: string; patient_id: string; author_side: 'staff' | 'family'; author_name?: string
  kind: 'message' | 'update' | 'wellbeing' | 'photo' | 'milestone' | 'system'
  content?: string; photo_url?: string; mood?: string; meals?: string; activity?: string
  created_at: string
}

const MOOD_OPTS = [
  { v: 'bom', label: 'Bem-disposto(a)', emoji: '😊' },
  { v: 'razoavel', label: 'Razoável', emoji: '😐' },
  { v: 'mau', label: 'Em baixo', emoji: '😔' },
]
const MEALS_OPTS = [
  { v: 'tudo', label: 'Comeu tudo', emoji: 'meal' },
  { v: 'parte', label: 'Comeu parte', emoji: '🥄' },
  { v: 'pouco', label: 'Comeu pouco', emoji: '⚠️' },
]
const ACTIVITY_OPTS = [
  { v: 'ativo', label: 'Ativo(a)', emoji: 'route' },
  { v: 'calmo', label: 'Tranquilo(a)', emoji: '🛋️' },
  { v: 'na_cama', label: 'Mais na cama', emoji: 'home' },
]
const optLabel = (arr: { v: string; label: string; emoji: string }[], v?: string) => arr.find(o => o.v === v)

function FamilyThread({ patients, contacts, user, supabase, unreadByPt, onRead, cfg, orgId }: any) {
  const [patientId, setPatientId] = useState('')
  const [msgs, setMsgs] = useState<ThreadMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'message' | 'update' | 'wellbeing'>('message')
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [wb, setWb] = useState<{ mood?: string; meals?: string; activity?: string }>({})
  const [sending, setSending] = useState(false)
  // O recado nao saiu. Mostra-se ao lado do botao, e a caixa NAO se limpa.
  const [erroEnvio, setErroEnvio] = useState('')
  const [prefilling, setPrefilling] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [ptSearch, setPtSearch] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const patient = patients.find((p: Patient) => p.id === patientId)
  const ptContacts = contacts.filter((c: FamilyContact) => c.patient_id === patientId)

  const [familyCode, setFamilyCode] = useState<string | null>(null)
  const [codeBusy, setCodeBusy] = useState(false)
  useEffect(() => {
    if (!patientId) { setFamilyCode(null); return }
    supabase.from('patients').select('family_code').eq('id', patientId).single()
      .then(({ data }: any) => setFamilyCode(data?.family_code || null))
  }, [patientId, supabase])
  const [codeErr, setCodeErr] = useState('')
  async function genCode() {
    if (!patientId) return
    setCodeBusy(true); setCodeErr('')
    // Código com CSPRNG (crypto), não Math.random (previsível). O acesso é em 2
    // fatores: este código + os últimos 4 dígitos do telefone registado.
    const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const rnd = new Uint32Array(8); crypto.getRandomValues(rnd)
    const code = Array.from(rnd, n => alpha[n % 32]).join('')
    const { error } = await supabase.from('patients').update({ family_code: code }).eq('id', patientId).eq('user_id', user.id)
    if (!error) setFamilyCode(code)
    else setCodeErr(reportError('family-code', error, MSG.save))
    setCodeBusy(false)
  }

  const loadThread = useCallback(async (pid: string) => {
    if (!pid) { setMsgs([]); return }
    setLoading(true)
    // Por patient_id (o utente já é partilhado pela org) — evita o caso de mensagens
    // ligadas a outro user_id da equipa não aparecerem.
    const { data, error: erroLeitura2 } = await supabase.from('family_thread_messages').select('*')
      .eq('patient_id', pid).order('created_at', { ascending: true })
    if (erroLeitura2) reportError('family-read', erroLeitura2)
    setMsgs(data || [])
    setLoading(false)
    // marcar respostas da família como lidas pela equipa
    const unread = (data || []).filter((m: ThreadMsg & { read_by_staff?: boolean }) => m.author_side === 'family' && (m as any).read_by_staff === false)
    if (unread.length) {
      await supabase.from('family_thread_messages').update({ read_by_staff: true })
        .eq('patient_id', pid).eq('author_side', 'family').eq('read_by_staff', false)
      onRead?.(pid)
    }
  }, [supabase, user])

  useEffect(() => { loadThread(patientId) }, [patientId, loadThread])

  // Realtime para o residente selecionado
  useEffect(() => {
    if (!patientId) return
    const ch = supabase.channel(`fam-thread-${patientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_thread_messages', filter: `patient_id=eq.${patientId}` },
        (payload: any) => setMsgs(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new as ThreadMsg]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [patientId, supabase])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  function downscale(file: File, maxDim = 1280, q = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image(); const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('img')); return }
        ctx.drawImage(img, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', q))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
      img.src = url
    })
  }

  async function send() {
    if (!patientId || sending) return
    if (mode === 'message' && !text.trim() && !photo) return
    if (mode === 'wellbeing' && !wb.mood && !wb.meals && !wb.activity) return
    setSending(true)
    try {
      let photo_url: string | null = null
      if (photo) {
        const dataUrl = await downscale(photo)
        const blob = await (await fetch(dataUrl)).blob()
        const path = `${user.id}/${patientId}/${Date.now()}.jpg`
        const up = await supabase.storage.from('family').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
        if (!up.error) photo_url = supabase.storage.from('family').getPublicUrl(path).data.publicUrl
      }
      const row: any = {
        user_id: user.id, patient_id: patientId, author_side: 'staff',
        author_name: user.name || user.email || 'Equipa',
        kind: mode === 'wellbeing' ? 'wellbeing' : photo_url ? 'photo' : mode === 'update' ? 'update' : 'message',
        content: text.trim() || null, photo_url,
        mood: wb.mood || null, meals: wb.meals || null, activity: wb.activity || null,
        read_by_family: false,
      }
      if (orgId) { row.org_id = orgId; row.recorded_by_id = user.id }  // partilha + auditoria na equipa
      setErroEnvio('')
      const { data, error } = await supabase.from('family_thread_messages').insert(row).select().single()
      if (error || !data) {
        // NAO se limpa a caixa. Quem escreveu um recado e o viu desaparecer
        // conclui que foi enviado -- e a familia nunca o recebeu.
        setErroEnvio(reportError('family-msg-insert', error,
          isSetupError(error) ? MSG.unavailable
            : 'A mensagem não foi enviada. O que escreveu continua aqui — tente de novo.'))
        return
      }
      setMsgs(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
      setText(''); setPhoto(null); setWb({}); setMode('message')
    } finally { setSending(false) }
  }

  // Boletim pré-preenchido com os dados reais do dia (motor de ecossistema → comunicação)
  async function prefillFromToday() {
    if (!patientId) return
    setPrefilling(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error: erroLeitura3 } = await supabase.from('care_records').select('vitals,mood,nutrition,date,created_at')
        .eq('user_id', user.id).eq('patient_id', patientId).eq('date', today)
        .order('created_at', { ascending: false }).limit(1)
      if (erroLeitura3) reportError('family-read', erroLeitura3)
      const rec = (data || [])[0]
      const next: { mood?: string; meals?: string; activity?: string } = {}
      if (rec?.mood?.level != null) next.mood = rec.mood.level >= 4 ? 'bom' : rec.mood.level === 3 ? 'razoavel' : 'mau'
      const ap = rec?.nutrition?.appetite
      if (ap) next.meals = ap === 'Bom' ? 'tudo' : ap === 'Razoável' ? 'parte' : 'pouco'
      // atividade: heurística simples a partir de notas comportamentais
      const beh = (rec?.mood?.behavior || rec?.mood?.activities || '').toLowerCase()
      if (beh) next.activity = /cama|acamad|deita|prostrad/.test(beh) ? 'na_cama' : /agita|inquiet|deambul|passe|ativ/.test(beh) ? 'ativo' : 'calmo'
      setWb(next)
      setMode('wellbeing')
      if (!Object.keys(next).length) setText('Sem registo do dia ainda — preenche manualmente.')
    } finally { setPrefilling(false) }
  }

  // "Como correu o dia" — compõe uma mensagem CALOROSA a partir dos registos do
  // dia (humor, refeições, atividade, hidratação). Determinístico (sem custo de
  // IA, sempre fiável). É o que as famílias querem receber, em palavras. A equipa
  // revê e envia com um toque. Pensado para centro de dia, útil também no lar.
  async function composeDaySummary() {
    if (!patientId) return
    setPrefilling(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const first = (patients.find((p: any) => p.id === patientId)?.name || '').split(' ')[0] || (cfg?.personNoun || 'a pessoa')
      const dayStart = today + 'T00:00:00'
      const dayEnd = today + 'T23:59:59'
      // Atividades de hoje (a participação não tem data — vem da atividade).
      const todayActs = await supabase.from('activities').select('id').eq('user_id', user.id).eq('date', today)
        .then((r: any) => r.data || [], () => [])
      const todayActIds: string[] = (todayActs || []).map((a: any) => a.id)
      const [{ data: care }, { data: hydr }, { data: parts2 }] = await Promise.all([
        supabase.from('care_records').select('mood,nutrition').eq('user_id', user.id).eq('patient_id', patientId).eq('date', today).order('created_at', { ascending: false }).limit(1),
        supabase.from('hydration_logs').select('fluid_ml,kind,at').eq('user_id', user.id).eq('patient_id', patientId).gte('at', dayStart).lte('at', dayEnd),
        todayActIds.length
          ? supabase.from('activity_participations').select('activity_id,attended').eq('patient_id', patientId).in('activity_id', todayActIds)
          : Promise.resolve({ data: [] }),
      ].map(p => p.then((r: any) => r, () => ({ data: [] }))) as any)
      const rec = (care || [])[0]
      const parts: string[] = []
      // Humor
      const lvl = rec?.mood?.level
      if (lvl != null) parts.push(lvl >= 4 ? `esteve bem-disposto(a) e participativo(a)` : lvl === 3 ? `teve um dia tranquilo` : `esteve um pouco mais em baixo, demos-lhe atenção redobrada`)
      // Refeições
      const ap = rec?.nutrition?.appetite
      if (ap) parts.push(ap === 'Bom' ? `comeu bem às refeições` : ap === 'Razoável' ? `comeu razoavelmente` : `comeu pouco — vamos continuar atentos`)
      // Hidratação (só registos de fluido)
      const ml = (hydr || []).filter((x: any) => x.kind === 'fluid').reduce((s: number, x: any) => s + (Number(x.fluid_ml) || 0), 0)
      if (ml > 0) parts.push(`bebeu cerca de ${ml} ml de líquidos`)
      // Atividades (participações com presença confirmada)
      const nAct = (parts2 || []).filter((p: any) => p.attended).length
      if (nAct > 0) parts.push(`participou em ${nAct} atividade${nAct > 1 ? 's' : ''}`)

      let msg: string
      if (parts.length === 0) {
        msg = `Olá! Partilhamos como correu o dia do/a ${first}. Foi um dia tranquilo connosco. Qualquer questão, estamos à disposição. 🌿`
      } else {
        const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
        msg = `Olá! Hoje o/a ${first} ${body}. Foi um gosto tê-lo(a) connosco. Qualquer questão, estamos à disposição. 🌿`
      }
      setMode('message')
      setText(msg)
    } finally { setPrefilling(false) }
  }

  return (
    <div className="ft-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, height: '100%', minHeight: 0 }}>
      {/* Lista de residentes — em mobile esconde-se quando há conversa aberta */}
      <div className="ft-list" data-open={patientId ? 'chat' : 'list'} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflowY: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-3)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
          <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{cfg.personNounPlural}</div>
          <input value={ptSearch} onChange={e => setPtSearch(e.target.value)}
            placeholder={`Procurar por nome ou familiar…`}
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 11px', fontSize: 'var(--t-dado)', outline: 'none', background: 'var(--bg-2)' }} />
        </div>
        {(() => {
          const ql = ptSearch.trim().toLowerCase()
          const list = !ql ? patients : patients.filter((p: Patient) =>
            p.name.toLowerCase().includes(ql) ||
            contacts.some((c: FamilyContact) => c.patient_id === p.id && c.name.toLowerCase().includes(ql))
          )
          return list.length === 0 ? (
          <div style={{ padding: 16, fontSize: 'var(--t-dado)', color: 'var(--ink-5)' }}>{patients.length === 0 ? `Sem ${cfg.personNounPlural.toLowerCase()}.` : `Nada corresponde a “${ptSearch}”.`}</div>
        ) : list.map((p: Patient) => {
          const active = p.id === patientId
          const nContacts = contacts.filter((c: FamilyContact) => c.patient_id === p.id).length
          return (
            <button key={p.id} onClick={() => setPatientId(p.id)}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--bg-2)', background: active ? 'var(--bg-2)' : 'var(--bg)', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: active ? 'var(--ink-2)' : 'var(--bg-3)', color: active ? 'var(--bg)' : 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, flexShrink: 0 }}>{p.name.charAt(0)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>{p.room_number ? `Q.${p.room_number} · ` : ''}{nContacts} familiar{nContacts !== 1 ? 'es' : ''}</div>
              </div>
              {(unreadByPt?.[p.id] || 0) > 0 && (
                <span style={{ flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-lg)', background: 'var(--red)', color: 'var(--bg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadByPt[p.id]}</span>
              )}
            </button>
          )
        })
        })()}
      </div>

      {/* Fio */}
      <div className="ft-chat" data-open={patientId ? 'chat' : 'list'} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!patientId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-5)', gap: 8, padding: 24, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex' }}><Icon name="chat" size={36} color="var(--border-2)" /></div>
            <div style={{ fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)' }}>Seleciona {cfg.personNounIndef}</div>
            <div style={{ fontSize: 'var(--t-dado)', maxWidth: 320, lineHeight: 1.5 }}>Conversa direta com a família, com atualizações, fotos e boletins de bem-estar — tudo registado no Phlox.</div>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <button className="ft-back" onClick={() => setPatientId('')} title="Voltar" style={{ display: 'none', background: 'none', border: 'none', fontSize: 'var(--t-destaque)', color: 'var(--green)', cursor: 'pointer', padding: 0, flexShrink: 0 }}>←</button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient?.name}{patient?.room_number ? ` · ${cfg.roomLabel?.charAt(0) || 'Q'}.${patient.room_number}` : ''}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ptContacts.length ? ptContacts.map((c: FamilyContact) => c.name).join(', ') : 'Sem familiares ligados'}</div>
                </div>
              </div>
              {familyCode ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Código família</div>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>{familyCode}</div>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(`Acompanhe ${patient?.name} no Phlox: crie conta em ${typeof window !== 'undefined' ? window.location.origin : ''}/login?mode=family e ligue-se em "A minha família" com o código ${familyCode}`); }}
                    title="Copiar convite" style={{ padding: '7px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--ink-2)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>Copiar convite</button>
                </div>
              ) : (
                <button onClick={genCode} disabled={codeBusy} style={{ padding: '7px 12px', background: 'var(--ink-2)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer' }}>
                  {codeBusy ? '…' : 'Gerar código de acesso família'}
                </button>
              )}
            </div>
            {codeErr && (
              <div style={{ padding: '9px 14px', background: 'var(--badge-red-bg)', borderBottom: '1px solid var(--badge-red-border)', fontSize: 'var(--t-meta)', color: 'var(--red)' }}>{codeErr}</div>
            )}

            {/* Mensagens — fundo estilo WhatsApp */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', background: 'var(--chao)' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)', padding: 20 }}>A carregar…</div>
              ) : msgs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)', padding: 24, lineHeight: 1.6 }}>
                  Ainda sem conversa. Escreva à família ou partilhe uma foto do dia.
                </div>
              ) : msgs.map(m => <ThreadBubble key={m.id} m={m} mySide="staff" />)}
              <div ref={endRef} />
            </div>

            {/* Painel de extras — só quando se abre o "+" (não tapa as mensagens) */}
            {extrasOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', background: 'var(--bg-2)', maxHeight: '40vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <label style={{ padding: '8px 12px', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: '1.5px solid var(--border)', background: 'white', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="camera" size={15} color="var(--green)" /> Foto<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { setPhoto(e.target.files?.[0] || null); setExtrasOpen(false) }} />
                  </label>
                  <button onClick={() => { composeDaySummary(); setExtrasOpen(false) }} disabled={prefilling} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: '1.5px solid var(--green-mid)', background: 'var(--green-light)', color: 'var(--green)' }}>{prefilling ? 'A compor…' : <><Icon name="spark" size={15} color="var(--green)" /> Mensagem do dia</>}</button>
                  <button onClick={() => setMode(mode === 'wellbeing' ? 'message' : 'wellbeing')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: `1.5px solid ${mode === 'wellbeing' ? 'var(--green)' : 'var(--border)'}`, background: mode === 'wellbeing' ? 'var(--badge-green-bg)' : 'white', color: mode === 'wellbeing' ? 'var(--green)' : 'var(--ink-3)' }}><Icon name="heart" size={15} color={mode === 'wellbeing' ? 'var(--green)' : 'var(--ink-3)'} /> Boletim</button>
                </div>
                {mode === 'wellbeing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([['Humor', MOOD_OPTS, 'mood'], ['Refeições', MEALS_OPTS, 'meals'], ['Atividade', ACTIVITY_OPTS, 'activity']] as const).map(([lab, opts, key]) => (
                      <div key={key}>
                        <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{lab}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {opts.map(o => { const on = (wb as any)[key] === o.v; return <button key={o.v} onClick={() => setWb(p => ({ ...p, [key]: on ? undefined : o.v }))} style={{ padding: '6px 11px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', cursor: 'pointer', border: `1.5px solid ${on ? 'var(--green)' : 'var(--border)'}`, background: on ? 'var(--badge-green-bg)' : 'white', color: on ? 'var(--green)' : 'var(--ink-3)', fontWeight: on ? 700 : 400 }}><Icon name={o.emoji} size={15} />  {o.label}</button> })}
                        </div>
                      </div>
                    ))}
                    <button onClick={prefillFromToday} disabled={prefilling} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '6px 11px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', border: '1.5px solid var(--badge-green-border)', background: 'var(--badge-green-bg)', color: 'var(--green)' }}>{prefilling ? '…' : <><Icon name="spark" size={14} color="var(--green)" /> Pré-preencher do registo de hoje</>}</button>
                  </div>
                )}
              </div>
            )}

            {/* Compositor — barra única estilo WhatsApp */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 10px', background: 'var(--bg-2)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={() => setExtrasOpen(o => !o)} title="Mais (foto, boletim…)" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: 'none', background: extrasOpen ? 'var(--green)' : 'var(--border)', color: extrasOpen ? 'white' : 'var(--ink-3)', fontSize: 'var(--t-destaque)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{extrasOpen ? '×' : '+'}</button>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={mode === 'wellbeing' ? 'Nota para a família…' : 'Mensagem…'}
                style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 16px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', boxSizing: 'border-box', background: 'white', maxHeight: 110 }} />
              <button onClick={send} disabled={sending} title="Enviar"
                style={{ flexShrink: 0, width: 42, height: 42, borderRadius: '50%', background: 'var(--green)', color: 'white', border: 'none', fontSize: 'var(--t-destaque)', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {sending ? '…' : '➤'}
              </button>
            </div>
            {erroEnvio && (
              <div style={{
                padding: '9px 14px', background: 'var(--badge-red-bg)', borderTop: '1px solid var(--badge-red-border)',
                fontSize: 'var(--t-meta)', color: 'var(--red)', lineHeight: 1.5,
              }}>{erroEnvio}</div>
            )}
            {photo && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--green)', padding: '6px 14px', background: 'var(--bg-2)' }}>📎 {photo.name} — será enviada <button onClick={() => setPhoto(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 'var(--t-meta)' }}>remover</button></div>}
          </>
        )}
      </div>
    </div>
  )
}

// mySide = de que lado estou eu (na app da equipa = 'staff'). As MINHAS mensagens
// vão para a DIREITA (verde, estilo WhatsApp); as do outro lado, à esquerda (branco).
function ThreadBubble({ m, mySide = 'staff' }: { m: ThreadMsg; mySide?: 'staff' | 'family' }) {
  const mine = m.author_side === mySide
  const time = new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  const bubbleBg = mine ? 'var(--green-light)' : 'var(--bg)'   // verde-claro WhatsApp para as minhas
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      <div style={{ maxWidth: '82%' }}>
        <div style={{ background: bubbleBg, color: 'var(--ink)', border: mine ? 'none' : '1px solid var(--border)', borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '7px 11px 6px', boxShadow: '0 1px 1px rgba(0,0,0,0.06)' }}>
          {!mine && <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', marginBottom: 2 }}>{m.author_name || (m.author_side === 'staff' ? 'Equipa' : 'Família')}</div>}
          {m.kind === 'wellbeing' ? (
            <div>
              <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--green)', marginBottom: 5 }}>Como correu o dia</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[optLabel(MOOD_OPTS, m.mood), optLabel(MEALS_OPTS, m.meals), optLabel(ACTIVITY_OPTS, m.activity)].filter(Boolean).map((o: any, i) => (
                  <div key={i} style={{ fontSize: 'var(--t-dado)' }}><Icon name={o.emoji} size={15} />  {o.label}</div>
                ))}
              </div>
              {m.content && <div style={{ fontSize: 'var(--t-dado)', marginTop: 6, lineHeight: 1.45 }}>{m.content}</div>}
            </div>
          ) : (
            <>
              {m.photo_url && <img src={m.photo_url} alt="foto" style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: m.content ? 6 : 0, display: 'block' }} />}
              {m.content && <div style={{ fontSize: 'var(--t-corpo)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{m.content}</div>}
            </>
          )}
          <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textAlign: 'right', marginTop: 2 }}>{time}</div>
        </div>
      </div>
    </div>
  )
}
