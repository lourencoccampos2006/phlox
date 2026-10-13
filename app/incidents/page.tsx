'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Vazio, Aviso, ACarregar,
  Codigo, Bandeira, Botao, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import { TIPOS, POR_TIPO, seguimento, repeticoes, ordenarPorAtencao, type Ocorrencia,
  exigePessoa, aceitaPessoa, eDaCasa, problemaNaOcorrencia, sobreQuem, POR_GRUPO,
} from '@/lib/ocorrencias'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { printDoc } from '@/lib/print'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import PodeSerDaMedicacao from '@/components/institution/PodeSerDaMedicacao'

interface Patient { id: string; name: string; room_number?: string }

interface Incident {
  id: string
  patient_id: string
  patient_name?: string
  date: string
  time?: string
  type: string
  severity: string
  location?: string
  description: string
  witnesses?: string
  injuries?: string
  action_taken?: string
  reported_to?: string
  outcome?: string
  follow_up_required: boolean
  follow_up_notes?: string
  root_cause?: string
  status: 'open' | 'under_review' | 'closed'
  created_by?: string
  created_at: string
  // Seguimento com dono e prazo (sprint161). Sem isto, `follow_up_required`
  // era um sim/nao que nao obrigava ninguem a nada.
  responsavel?: string | null
  responsavel_id?: string | null
  prazo?: string | null
  fechado_em?: string | null
  fechado_por?: string | null
}

// Os tipos vem de lib/ocorrencias, que e a fonte unica: o SQL do sprint161, o
// formulario e os filtros tem de concordar, e duas listas da mesma coisa
// divergem sempre. Eram sete de enfermaria; passaram a catorze, com os que
// acontecem mesmo num centro de dia (fuga, transporte, reclamacao, falta de
// pessoal). «Outro» a apanhar metade e o mesmo que nao ter tipos nenhuns.
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.id, t.label]))
const TYPE_ICONS: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.id, t.icone]))

/* ─────────────────────────────────────────────────────────────────────────
   A GRAVIDADE SÃO QUATRO DEGRAUS, MAS NÃO QUATRO CORES
   ─────────────────────────────────────────────────────────────────────────
   A mesa tem três cores com significado — verde, âmbar, vermelho — e o
   cinzento de «nada a dizer». Mais nenhuma. O «Grave» andava com um laranja
   próprio (var(--amber)), que é uma quinta cor: quem aprendeu que o âmbar pede
   atenção e o vermelho pede ação não sabe o que fazer com um laranja.

   Os quatro degraus continuam quatro. O que os separa no fim da escala não é
   o tom, é o PESO: «Grave» é vermelho a traço, «Crítico» é vermelho cheio.
   Cheio só o último — e é por isso que o último se vê de longe.
   ───────────────────────────────────────────────────────────────────────── */
const SEV_STYLE: Record<string, { color: string; bg: string; border: string; label: string; cheio?: boolean }> = {
  minor:    { color: 'var(--ink-3)', bg: 'var(--bg-2)', border: 'var(--border)', label: 'Ligeiro' },
  moderate: { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', label: 'Moderado' },
  major:    { color: 'var(--red)', bg: 'transparent', border: 'var(--red)', label: 'Grave' },
  critical: { color: 'var(--sobre-acento)', bg: 'var(--red)', border: 'var(--red)', label: 'Crítico', cheio: true },
}

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  open:         { color: 'var(--red)', bg: 'var(--badge-red-bg)', label: 'Aberto' },
  under_review: { color: 'var(--amber)', bg: 'var(--badge-amber-bg)', label: 'Em revisão' },
  closed:       { color: 'var(--green)', bg: 'var(--badge-green-bg)', label: 'Fechado' },
}

const EMPTY_FORM = {
  patient_id: '',
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  type: 'fall',
  severity: 'minor',
  location: '',
  description: '',
  witnesses: '',
  injuries: '',
  action_taken: '',
  reported_to: '',
  outcome: '',
  follow_up_required: false,
  follow_up_notes: '',
  responsavel: '',
  prazo: '',
  root_cause: '',
  created_by: '',
}

export default function IncidentsPage() {
  const { user, supabase } = useAuth()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('ocorrencias', 'editar')
  const cfg = institutionConfig(institution)
  const person = cfg.personNoun                 // "Residente" | "Utente" | "Doente"
  const personLower = person.toLowerCase()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  // Comunicação à família de uma ocorrência grave: em vez de um confirm() cru,
  // um modal com a mensagem PRÉ-ESCRITA e EDITÁVEL, que se envia deliberadamente.
  const [notify, setNotify] = useState<{ patientId: string; patientName: string; body: string; sending: boolean; done: boolean; alsoText: boolean; textNote: string } | null>(null)
  // Registo rápido (IA) — nota informal → tipo/gravidade/descrição propostos,
  // revistos no formulário completo antes de guardar (nunca grava sozinho).
  const [quickNote, setQuickNote] = useState('')
  const [structuring, setStructuring] = useState(false)
  const [structureErr, setStructureErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: inc }, { data: pat }] = await Promise.all([
      scope.filter(supabase.from('incidents').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }),
      scope.filter(supabase.from('patients').select('*')).order('name'),
    ])
    setPatients(pat || [])
    const patMap: Record<string, string> = {}
    ;(pat || []).forEach((p: Patient) => { patMap[p.id] = p.name })
    // «—» lia-se como «falta aqui o nome». «A casa» diz o que é.
    setIncidents((inc || []).map((i: any) => ({
      ...i, patient_name: sobreQuem(i.type, patMap[i.patient_id]),
    })))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  useLiveData({ supabase, table: ['incidents', 'patients'], userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  // Ocorrência grave → abre o modal de comunicação à família com a mensagem já
  // escrita (o profissional revê, ajusta e envia — nada sai sem ele confirmar).
  const openNotifyFamily = (patientId: string, type: string, severity: string) => {
    const patName = patients.find(p => p.id === patientId)?.name || `o/a ${personLower}`
    const sevLabel = SEV_STYLE[severity]?.label || severity
    const body = `Informamos que ocorreu ${TYPE_LABELS[type] ? `um(a) ${TYPE_LABELS[type].toLowerCase()}` : 'uma ocorrência'} (gravidade ${sevLabel.toLowerCase()}) com ${patName}. A equipa prestou de imediato a assistência necessária e ${patName.split(' ')[0]} está a ser acompanhado(a). Estamos disponíveis para esclarecer qualquer questão.`
    setNotify({ patientId, patientName: patName, body, sending: false, done: false, alsoText: severity === 'critical' || severity === 'major', textNote: '' })
  }
  // Envia a mensagem para o FIO da família (family_thread_messages — o que /family
  // e /familia mostram). Antes escrevia em family_messages e a família não via.
  // 2026-08-11: soma SMS/WhatsApp real (opcional) — uma ocorrência é
  // precisamente o tipo de aviso que não deve depender de a família abrir a
  // app; pré-marcado para gravidade alta/crítica, mas sempre revisto e
  // desmarcável antes de enviar.
  const sendNotify = async () => {
    if (!notify || !user) return
    setNotify(n => n ? { ...n, sending: true } : n)
    const { error } = await supabase.from('family_thread_messages').insert(scope.stamp({
      user_id: user.id, patient_id: notify.patientId, author_side: 'staff',
      author_name: (user as any).name || 'Equipa', kind: 'update',
      content: notify.body, read_by_family: false, read_by_staff: true,
    }))
    if (error) { setNotify(n => n ? { ...n, sending: false } : n); setSaveError('Não foi possível comunicar à família: ' + error.message); return }
    let textNote = ''
    if (notify.alsoText) {
      try {
        const { data: sd } = await supabase.auth.getSession()
        const r = await fetch('/api/notify-family', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
          body: JSON.stringify({ patientId: notify.patientId, body: notify.body }),
        })
        const d = await r.json()
        if (d.error === 'not_configured') textNote = 'Mensagem enviada na app. SMS/WhatsApp ainda não está ativado nesta conta.'
        else if (d.ok) textNote = '✓ Também enviado por SMS/WhatsApp.'
        else textNote = 'Mensagem enviada na app; o SMS/WhatsApp falhou.'
      } catch { textNote = 'Mensagem enviada na app; não foi possível confirmar o SMS/WhatsApp.' }
    }
    setNotify(n => n ? { ...n, sending: false, done: true, textNote } : n)
    setTimeout(() => setNotify(null), 2400)
  }

  const save = async () => {
    if (!user) return
    if (!podeEditar) { setSaveError('A sua conta é só de leitura.'); return }
    setSaving(true)
    setSaveError('')
    try {
      // Quem decide se é preciso um utente é o TIPO, e não esta linha.
      //
      // Antes era `if (!form.patient_id) throw` para tudo — e por isso um cano
      // rebentado, uma falha de energia ou uma visita da ASAE não tinham onde
      // ser registados. São essas que explicam, três meses depois, porque é
      // que naquele dia a rotina foi outra.
      const problema = problemaNaOcorrencia(form.type, form.patient_id, cfg.personNounIndef)
      if (problema) throw new Error(problema)
      if (!form.description.trim()) throw new Error('A descrição é obrigatória')

      const payload = {
        user_id: user.id,
        // Um tipo da casa nunca leva utente, mesmo que tenha ficado um
        // escolhido de uma tentativa anterior. Sem isto, mudar de «Queda» para
        // «Água» gravava a falta de água na ficha de alguém.
        patient_id: aceitaPessoa(form.type) ? (form.patient_id || null) : null,
        date: form.date,
        time: form.time || null,
        type: form.type,
        severity: form.severity,
        location: form.location || null,
        description: form.description,
        witnesses: form.witnesses || null,
        injuries: form.injuries || null,
        action_taken: form.action_taken || null,
        reported_to: form.reported_to || null,
        outcome: form.outcome || null,
        follow_up_required: form.follow_up_required,
        follow_up_notes: form.follow_up_notes || null,
        responsavel: form.responsavel.trim() || null,
        prazo: form.prazo || null,
        root_cause: form.root_cause || null,
        created_by: form.created_by || null,
      }

      if (editingId) {
        // Org-scoped: numa organização, o admin pode editar ocorrências da equipa
        // (antes filtrava por user_id e bloqueava). RLS garante o limite por org.
        let q = supabase.from('incidents').update(payload).eq('id', editingId)
        if (!scope.orgId) q = q.eq('user_id', user.id)
        const { error: dbErr } = await q
        if (dbErr) throw new Error(dbErr.message)
        setSelected(prev => prev && prev.id === editingId ? { ...prev, ...payload } as Incident : prev)
      } else {
        const { error: dbErr } = await supabase.from('incidents').insert(scope.stamp({ ...payload, status: 'open' }))
        if (dbErr) throw new Error(dbErr.message)
        // Ocorrência grave/crítica → abre o modal para comunicar à família (o
        // profissional revê e envia). Guardamos os dados antes de limpar o form.
        // Só há família para avisar quando há uma pessoa. Uma falha de energia
        // é grave e não tem família nenhuma do outro lado.
        if (payload.patient_id && (form.severity === 'major' || form.severity === 'critical')) {
          openNotifyFamily(payload.patient_id, form.type, form.severity)
        }
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ ...EMPTY_FORM })
      setQuickNote(''); setStructureErr('')
      load()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (inc: Incident) => {
    setEditingId(inc.id)
    setForm({
      patient_id: inc.patient_id, date: inc.date, time: inc.time || '',
      type: inc.type, severity: inc.severity, location: inc.location || '',
      description: inc.description, witnesses: inc.witnesses || '', injuries: inc.injuries || '',
      action_taken: inc.action_taken || '', reported_to: inc.reported_to || '', outcome: inc.outcome || '',
      follow_up_required: inc.follow_up_required, follow_up_notes: inc.follow_up_notes || '',
      responsavel: inc.responsavel || '', prazo: inc.prazo || '',
      root_cause: inc.root_cause || '', created_by: inc.created_by || '',
    })
    setSaveError(''); setShowForm(true)
  }

  const updateStatus = async (id: string, status: string) => {
    if (!podeEditar) { setSaveError('A sua conta é só de leitura.'); return }
    let q = supabase.from('incidents').update({ status }).eq('id', id)
    if (!scope.orgId) q = q.eq('user_id', user!.id)
    const { error } = await q
    if (error) { setSaveError('Não foi possível atualizar: ' + error.message); return }
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: status as any } : i))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: status as any } : null)
  }

  const filtered = incidents.filter(i => {
    // ── POR TIPO DE OCORRENCIA (sprint164) ────────────────────────────────
    // Ficou prometido no sprint152 («deixar para quando refizer as
    // ocorrencias») e e agora. A animadora ve as ocorrencias e nao ve as
    // reclamacoes de familia; quem faz a escala nao ve as faltas de pessoal.
    //
    // Isto e CONFORTO, nao seguranca: quem escrever o endereco a mao continua
    // a poder pedir a linha. A defesa a serio para isto seria uma politica de
    // RLS que lesse o tipo da linha — fica escrito aqui para nao se perder.
    if (!scope.veDetalhe(`ocorrencias.${i.type}`)) return false
    if (filterType !== 'all' && i.type !== filterType) return false
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false
    if (search && !i.patient_name?.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Os que precisam de alguem AGORA, primeiro: prazo passado, depois prazo a
  // chegar, e as fechadas no fim. A ordem so por data punha uma queda de ontem
  // por fechar debaixo de uma reclamacao de hoje ja resolvida.
  const ordenadas = useMemo(() => ordenarPorAtencao(filtered as any) as typeof filtered, [filtered])

  // A repeticao olha para TUDO, e nao so para o que os filtros deixaram passar:
  // filtrar por «abertas» escondia justamente o padrao que se quer ver.
  const padroes = useMemo(() => repeticoes(incidents as any), [incidents])

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open').length,
    critical: incidents.filter(i => i.severity === 'critical' || i.severity === 'major').length,
    falls: incidents.filter(i => i.type === 'fall').length,
    thisMonth: incidents.filter(i => i.date?.startsWith(new Date().toISOString().slice(0, 7))).length,
  }

  const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  async function structureQuickNote() {
    if (!quickNote.trim()) return
    setStructuring(true); setStructureErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/incidents/structure', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token}` },
        body: JSON.stringify({ note: quickNote.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Não foi possível estruturar agora.')
      setForm(prev => ({
        ...prev, type: d.type, severity: d.severity, description: d.description,
        injuries: d.injuries || prev.injuries,
        action_taken: prev.action_taken || (d.action_taken_suggestion ? `Sugestão a rever: ${d.action_taken_suggestion}` : ''),
      }))
      setQuickNote('')
    } catch (e: any) { setStructureErr(e.message) }
    setStructuring(false)
  }

  // Padrões: mesmo utente com ≥2 ocorrências do mesmo tipo nos últimos 30 dias
  // — "mais contexto e inteligência" pedido pelo Fernando. Não é IA (não
  // precisa de ser): é contagem direta, sempre correta, sempre disponível.
  const patterns = (() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const groups: Record<string, Incident[]> = {}
    incidents.filter(i => i.date >= cutoffStr).forEach(i => {
      const key = `${i.patient_id}__${i.type}`
      ;(groups[key] = groups[key] || []).push(i)
    })
    return Object.values(groups).filter(g => g.length >= 2).sort((a, b) => b.length - a.length)
  })()

  /* O detalhe de uma ocorrencia. Era uma PAGINA a parte (`if (selected)
     return`); passa a ser a coluna da direita, para nao se perder o sitio na
     lista cada vez que se abre uma. */
  const largo = useLargo()

  const detalheDaOcorrencia = selected ? (() => {
    const ss = SEV_STYLE[selected.severity]
    const st = STATUS_STYLE[selected.status]
    return (
      <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-dado)', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Voltar à lista
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => openEdit(selected)}
              style={{ padding: '8px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
            <button onClick={() => {
              const fields = [
                { label: person, value: selected.patient_name || '—' },
                { label: 'Tipo', value: TYPE_LABELS[selected.type] || selected.type },
                { label: 'Gravidade', value: ss.label },
                { label: 'Estado', value: st.label },
                { label: 'Data', value: `${selected.date}${selected.time ? ' às ' + selected.time : ''}` },
                { label: 'Local', value: selected.location || '—' },
              ]
              const detail = [
                { label: 'Descrição', value: selected.description },
                selected.injuries && { label: 'Lesões', value: selected.injuries },
                selected.witnesses && { label: 'Testemunhas', value: selected.witnesses },
                selected.action_taken && { label: 'Ação imediata', value: selected.action_taken },
                selected.reported_to && { label: 'Comunicado a', value: selected.reported_to },
                selected.outcome && { label: 'Resultado', value: selected.outcome },
                selected.root_cause && { label: 'Causa raiz', value: selected.root_cause },
                selected.follow_up_required && { label: 'Seguimento', value: selected.follow_up_notes || 'Necessário' },
                selected.created_by && { label: 'Registado por', value: selected.created_by },
              ].filter(Boolean) as { label: string; value: string }[]
              printDoc({
                docTitle: 'Relatório de Ocorrência',
                docSubtitle: `${TYPE_LABELS[selected.type] || selected.type} · ${selected.patient_name || ''}`,
                institution: cfg.unitNoun,
                sections: [
                  { heading: 'Identificação', records: [{ title: TYPE_LABELS[selected.type] || 'Ocorrência', tags: [{ label: ss.label, color: ss.color }], fields }] },
                  { heading: 'Descrição e seguimento', records: [{ title: 'Detalhe da ocorrência', fields: detail }] },
                  { heading: 'Assinaturas', records: [{ title: 'Validação', fields: [{ label: 'Responsável', value: '' }, { label: 'Diretor Técnico', value: '' }, { label: 'Data', value: '' }] }] },
                ],
                footerNote: 'Relatório de ocorrência · Phlox',
              })
            }}
              style={{ padding: '8px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir relatório
            </button>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: 4, background: ss.color }} />
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--t-destaque)' }}>{TYPE_ICONS[selected.type]}</span>
                    <h2 style={{ fontSize: 'var(--t-destaque)', color: 'var(--ink)', fontWeight: 'var(--peso-corpo)' as any, margin: 0 }}>{TYPE_LABELS[selected.type]}</h2>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)' }}>
                    {selected.patient_name} · {selected.date} {selected.time && `às ${selected.time}`}
                    {selected.location && ` · ${selected.location}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: ss.color, background: ss.bg, border: `1px solid ${ss.border}`, padding: '3px 10px', borderRadius: 'var(--r)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ss.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 'var(--r)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</span>
                </div>
              </div>

              <Row label="Descrição" value={selected.description} />
              {selected.injuries && <Row label="Lesões" value={selected.injuries} highlight />}
              {selected.witnesses && <Row label="Testemunhas" value={selected.witnesses} />}
              {selected.action_taken && <Row label="Ação imediata" value={selected.action_taken} />}
              {selected.reported_to && <Row label="Comunicado a" value={selected.reported_to} />}
              {selected.outcome && <Row label="Resultado" value={selected.outcome} />}
              {selected.root_cause && <Row label="Causa raiz" value={selected.root_cause} />}
              {selected.follow_up_required && <Row label="Seguimento" value={selected.follow_up_notes || 'Necessário'} highlight />}
              {selected.created_by && <Row label="Registado por" value={selected.created_by} />}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', alignSelf: 'center', marginRight: 4 }}>Alterar estado:</span>
              {Object.entries(STATUS_STYLE).map(([k, v]) => (
                <button key={k} onClick={() => updateStatus(selected.id, k)}
                  style={{ padding: '6px 14px', background: selected.status === k ? v.bg : 'white', color: selected.status === k ? v.color : 'var(--ink-4)', border: `1.5px solid ${selected.status === k ? v.color : 'var(--border)'}`, borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', fontWeight: selected.status === k ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.1s' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
      </>
    )
  })() : null


  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
            Ocorrências
          </span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${personLower} ou descrição…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 240 }} />

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            aria-label="Tipo" style={{ ...CAIXA, width: 170 }}>
            <option value="all">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
            aria-label="Gravidade" style={{ ...CAIXA, width: 150 }}>
            <option value="all">Toda a gravidade</option>
            {Object.entries(SEV_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            aria-label="Estado" style={{ ...CAIXA, width: 150 }}>
            <option value="all">Todos os estados</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {stats.open > 0 && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                {stats.open} EM ABERTO
              </span>
            )}
            {stats.critical > 0 && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>
                {stats.critical} GRAVE{stats.critical > 1 ? 'S' : ''}
              </span>
            )}
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {stats.thisMonth} este mês · {stats.total} ao todo
            </span>
          </span>

          <div style={{ marginLeft: 'auto' }}>
            <Botao feitio="principal"
              onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, created_by: (user as any)?.name || '' }); setShowForm(true); setSaveError('') }}>
              + NOVA OCORRÊNCIA
            </Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          {Object.entries(SEV_STYLE).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 'var(--r-sm)', border: `1px solid ${v.border}`, background: v.cheio ? v.bg : 'transparent' }} />
              {v.label}
            </span>
          ))}
          <span style={{ ...MONO }}>Cada linha é um registo legal: fica com a data, a hora e quem o escreveu.</span>
        </BarraDeEstado>
      }
    >
      {error && <Aviso tom="mau">{error}</Aviso>}

      {/* ── O QUE NINGUÉM CONSEGUE VER SOZINHO ──────────────────────────
          Cada ocorrência foi escrita num dia diferente, por uma pessoa
          diferente, e nenhuma delas sabe das outras. Três quedas em dois
          meses não são três quedas: é alguém que precisa de uma avaliação
          de marcha. */}
      {padroes.length > 0 && (
        <Aviso tom="atencao" titulo="A repetir-se">
          {padroes.map(r => <div key={`${r.patientId}-${r.tipo}`} style={{ marginTop: 2 }}>{r.frase}</div>)}
        </Aviso>
      )}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(420px, 1fr) minmax(360px, 520px)' : '1fr',
      }}>
        {/* ── A LISTA ────────────────────────────────────────────────── */}
        {(largo || !selected) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 74 }}>Data</span>
                <span style={{ ...ROTULO, flex: 1 }}>Sobre quem · o quê</span>
                <span style={{ ...ROTULO, width: 52 }}>Tipo</span>
                <span style={{ ...ROTULO, width: 78 }}>Gravidade</span>
                <span style={{ ...ROTULO, width: 82 }}>Estado</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{filtered.length} de {incidents.length}</span>}
          >
            {loading ? (
              <ACarregar oQue="A carregar as ocorrências…" />
            ) : filtered.length === 0 ? (
              <Vazio
                titulo={incidents.length === 0 ? 'Sem ocorrências registadas.' : 'Nenhuma corresponde aos filtros.'}
                oQueFazer={incidents.length === 0
                  ? 'Quedas, erros de medicação, cortes de água, visitas de fiscalização — tudo o que explica, três meses depois, porque é que naquele dia a rotina foi outra.'
                  : 'Experimente alargar os filtros.'} />
            ) : filtered.map(inc => {
              const ss = SEV_STYLE[inc.severity] || SEV_STYLE.minor
              const st = STATUS_STYLE[inc.status] || STATUS_STYLE.open
              return (
                <LinhaTabela key={inc.id}
                  aoTocar={() => setSelected(inc)}
                  ativa={selected?.id === inc.id}
                  filete={inc.status === 'open' ? ss.border : undefined}
                  antes={{
                    largura: 74,
                    conteudo: (
                      <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                        {inc.date.slice(8, 10)}/{inc.date.slice(5, 7)}{inc.time ? ` ${inc.time.slice(0, 5)}` : ''}
                      </span>
                    ),
                  }}
                  principal={inc.patient_name || 'A casa'}
                  secundaria={inc.description}
                  celulas={[
                    { rotulo: 'Tipo', valor: (TYPE_LABELS[inc.type] || inc.type).slice(0, 4).toUpperCase(), largura: 52 },
                    {
                      rotulo: 'Gravidade', largura: 78,
                      valor: (
                        <span style={{
                          padding: '2px 5px', borderRadius: 'var(--r-sm)', color: ss.color,
                          border: `1px solid ${ss.border}`, background: ss.bg,
                          fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any,
                        }}>{ss.label.toUpperCase()}</span>
                      ),
                    },
                    {
                      rotulo: 'Estado', valor: st.label.toUpperCase(), largura: 82,
                      cor: st.color, forte: true,
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {/* ── O DETALHE ──────────────────────────────────────────────── */}
        {selected ? (
          <Painel
            cabeca={
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Botao onClick={() => setSelected(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                  {selected.date}{selected.time ? ` · ${selected.time}` : ''}
                </span>
              </div>
            }
          >
            <div style={{ padding: '0 16px 16px' }}>{detalheDaOcorrencia}</div>
          </Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo="Escolha uma ocorrência."
              oQueFazer="Abre aqui ao lado, sem sair da lista — para se poderem ver duas seguidas da mesma pessoa." />
          </Painel>
        ) : null}
      </div>
    </Mesa>

        {notify && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}
            onClick={e => { if (e.target === e.currentTarget && !notify.sending) setNotify(null) }}>
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 440, padding: '22px 22px 24px' }}>
              {notify.done ? (
                <div style={{ textAlign: 'center', padding: '18px 0' }}>
                  <div style={{ fontSize: 'var(--t-numero)', color: 'var(--green)', marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Família avisada</div>
                  {notify.textNote && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 6 }}>{notify.textNote}</div>}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 4 }}>Comunicar à família</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginBottom: 14 }}>Ocorrência grave com <b>{notify.patientName}</b>. Reveja a mensagem antes de enviar.</div>
                  <textarea value={notify.body} onChange={e => setNotify(n => n ? { ...n, body: e.target.value } : n)} rows={5}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '11px 13px', fontSize: 'var(--t-dado)', lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginTop: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={notify.alsoText} onChange={e => setNotify(n => n ? { ...n, alsoText: e.target.checked } : n)} /> Enviar também por SMS/WhatsApp
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => setNotify(null)} disabled={notify.sending} style={{ flex: 1, padding: '11px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-4)', cursor: 'pointer' }}>Não enviar</button>
                    <button onClick={sendNotify} disabled={notify.sending || !notify.body.trim()} style={{ flex: 2, padding: '11px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: notify.sending ? 'wait' : 'pointer' }}>{notify.sending ? 'A enviar…' : 'Enviar à família'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* New incident modal */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'auto', padding: '24px 24px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, margin: 0 }}>{editingId ? 'Editar Ocorrência' : 'Nova Ocorrência'}</h2>
                <button aria-label="Fechar" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setQuickNote(''); setStructureErr('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-destaque)', color: 'var(--ink-4)', lineHeight: 1 }}>×</button>              </div>

              {saveError && <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', padding: '9px 13px', fontSize: 'var(--t-dado)', color: 'var(--red)', marginBottom: 14 }}>{saveError}</div>}

              {!editingId && (
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-2)', marginBottom: 8 }}>✨ Registo rápido — escreve o que aconteceu, a IA propõe o resto</div>
                  <textarea value={quickNote} onChange={e => setQuickNote(e.target.value)} rows={2} placeholder={`Ex: A ${personLower} caiu na casa de banho, não se magoou mas ficou assustada...`}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 11px', fontSize: 'var(--t-dado)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', background: 'white' }} />
                  {structureErr && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginTop: 6 }}>{structureErr}</div>}
                  <button onClick={structureQuickNote} disabled={structuring || !quickNote.trim()}
                    style={{ marginTop: 8, padding: '7px 14px', background: structuring || !quickNote.trim() ? 'var(--border)' : 'var(--ink-2)', color: structuring || !quickNote.trim() ? 'var(--ink-5)' : 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: structuring || !quickNote.trim() ? 'not-allowed' : 'pointer' }}>
                    {structuring ? 'A estruturar…' : 'Estruturar com IA →'}
                  </button>
                  <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-3)', marginTop: 6 }}>Preenche o formulário abaixo — revê e ajusta antes de guardar.</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* O TIPO vem primeiro, e não a pessoa. É ele que decide se
                    há pessoa — perguntar «quem?» antes de saber «o quê?»
                    obrigava a escolher alguém para registar um corte de água. */}
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Tipo de ocorrência *</Label>
                  <select value={form.type} onChange={e => f('type', e.target.value)} style={selectStyle}>
                    {POR_GRUPO.map(g => (
                      <optgroup key={g.id} label={g.label}>
                        {g.tipos.map(t => <option key={t.id} value={t.id}><Icon name={t.icone} size={15} />  {t.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {POR_TIPO.get(form.type)?.ajuda && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 4, lineHeight: 1.45 }}>
                      {POR_TIPO.get(form.type)!.ajuda}
                    </div>
                  )}
                </div>

                {/* A pessoa só aparece quando o tipo a aceita. Um seletor
                    desativado continuava a dizer que falta ali qualquer coisa. */}
                {aceitaPessoa(form.type) && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <Label>{person}{exigePessoa(form.type) ? ' *' : ''}</Label>
                    <select value={form.patient_id} onChange={e => f('patient_id', e.target.value)} style={selectStyle}>
                      <option value="">
                        {exigePessoa(form.type)
                          ? `Selecionar ${personLower}...`
                          : `Ninguém em particular — é da casa`}
                      </option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name}{cfg.hasBeds && p.room_number ? ` — ${cfg.roomLabel[0]}${p.room_number}` : ''}</option>)}
                    </select>
                  </div>
                )}

                {eDaCasa(form.type) && (
                  <div style={{ gridColumn: '1/-1', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5 }}>
                    Esta ocorrência é da casa — não é preciso escolher ninguém.
                  </div>
                )}

                <div>
                  <Label>Gravidade *</Label>
                  <select value={form.severity} onChange={e => f('severity', e.target.value)} style={selectStyle}>
                    {Object.entries(SEV_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Data *</Label>
                  <input type="date" value={form.date} onChange={e => f('date', e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <Label>Hora</Label>
                  <input type="time" value={form.time} onChange={e => f('time', e.target.value)} style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Local</Label>
                  <input value={form.location} onChange={e => f('location', e.target.value)} placeholder={`Ex: ${cfg.roomLabel}, Corredor, Casa de banho...`} style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Descrição detalhada *</Label>
                  <textarea value={form.description} onChange={e => f('description', e.target.value)} placeholder="Descreve o que aconteceu..." rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </div>

                {/* A pergunta que ninguém tem tempo de fazer: isto pode ser da
                    medicação? Fica aqui, debaixo da descrição, porque é aqui
                    que a dúvida nasce — e fica como BOTÃO, porque uma caixa
                    que aparece sozinha a meio de alguém escrever rouba a
                    atenção ao que interessa, que é registar a ocorrência. */}
                {aceitaPessoa(form.type) && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <PodeSerDaMedicacao
                      patientId={form.patient_id || null}
                      descricao={form.description}
                      auth={async () => {
                        const { data: sd } = await supabase.auth.getSession()
                        return {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${sd?.session?.access_token || ''}`,
                        }
                      }} />
                  </div>
                )}

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Lesões / Danos</Label>
                  <input value={form.injuries} onChange={e => f('injuries', e.target.value)} placeholder="Descreve lesões ou danos observados..." style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Ação imediata tomada</Label>
                  <textarea value={form.action_taken} onChange={e => f('action_taken', e.target.value)} placeholder="O que foi feito imediatamente após o incidente..." rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div>
                  <Label>Testemunhas</Label>
                  <input value={form.witnesses} onChange={e => f('witnesses', e.target.value)} placeholder="Nomes..." style={inputStyle} />
                </div>

                <div>
                  <Label>Comunicado a</Label>
                  <input value={form.reported_to} onChange={e => f('reported_to', e.target.value)} placeholder="Médico, família, direção..." style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Resultado / desfecho</Label>
                  <input value={form.outcome} onChange={e => f('outcome', e.target.value)} placeholder="Ex: Sem lesões, vigilância 24h, ida ao hospital..." style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Causa raiz (investigação)</Label>
                  <textarea value={form.root_cause} onChange={e => f('root_cause', e.target.value)} placeholder="Análise da causa: porque aconteceu? (piso, calçado, medicação, supervisão...)" rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Registado por</Label>
                  <input value={form.created_by} onChange={e => f('created_by', e.target.value)} placeholder="Nome do profissional..." style={inputStyle} />
                </div>

                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="followup" checked={form.follow_up_required} onChange={e => f('follow_up_required', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--red)', cursor: 'pointer' }} />
                  <label htmlFor="followup" style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Requer acompanhamento posterior
                  </label>
                </div>

                {/* ── QUEM E ATÉ QUANDO ────────────────────────────────────
                    Isto era só uma caixa de texto. Um seguimento sem dono não é
                    um seguimento — é uma intenção: passa a semana, ninguém faz
                    nada, e quando alguém pergunta o que foi feito a seguir à
                    queda, a resposta é uma caixa vazia. */}
                {form.follow_up_required && (
                  <>
                    <div>
                      <Label>Quem trata</Label>
                      <input value={form.responsavel} onChange={e => f('responsavel', e.target.value)}
                        placeholder="Nome de quem fica responsável" style={inputStyle} />
                    </div>
                    <div>
                      <Label>Até quando</Label>
                      <input type="date" value={form.prazo} onChange={e => f('prazo', e.target.value)}
                        style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <Label>O que é preciso fazer</Label>
                      <textarea value={form.follow_up_notes} onChange={e => f('follow_up_notes', e.target.value)} placeholder="Ex.: avaliar a marcha e rever o calçado." rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    {!form.responsavel.trim() && (
                      <div style={{ gridColumn: '1/-1', fontSize: 'var(--t-meta)', color: 'var(--amber)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', padding: '9px 12px', lineHeight: 1.5 }}>
                        Sem um nome, isto fica à espera de toda a gente — que é o mesmo que ficar à espera de ninguém.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setQuickNote(''); setStructureErr('') }}
                  style={{ padding: '10px 20px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
                  Cancelar
                </button>
                <button onClick={save} disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? 'var(--bg-3)' : 'var(--red)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {saving ? 'A guardar...' : editingId ? 'Guardar alterações' : 'Registar ocorrência'}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>{children}</div>
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 110, paddingTop: 2 }}>{label}</div>
      <div style={{ fontSize: 'var(--t-dado)', color: highlight ? 'var(--red)' : 'var(--ink-2)', lineHeight: 1.6, flex: 1, fontWeight: highlight ? 600 : 400 }}>{value}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px',
  fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
  background: 'white', color: 'var(--ink)',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
}
