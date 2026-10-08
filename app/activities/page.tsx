'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import { printDoc } from '@/lib/print'
import { reportError, isSetupError, MSG } from '@/lib/clientError'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import RegistarNaoPrestado from '@/components/institution/NaoPrestado'
import { rotuloMotivo } from '@/lib/naoPrestado'

// Fundido no "Registo do dia" (/care-log) como aba "Atividades" (AtividadesTool
// reutilizado). A rota /activities redireciona p/ não partir links antigos.
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Grupo, Campo, Folha, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function AtividadesRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/care-log?tab=atividades') }, [r])
  return null
}

interface Activity {
  id: string
  title: string
  type: string
  date: string
  start_time: string
  end_time?: string
  location?: string
  responsible?: string
  description?: string
  max_participants?: number
  status: 'planned' | 'ongoing' | 'done' | 'cancelled'
  recurring_id?: string | null
  created_at: string
}

// Atividade recorrente ("todas as quartas às 10h ginástica") — gera ocorrências
// reais em `activities` (ver ensureRecurringOccurrences), em vez da equipa ter
// de recriar a atividade à mão todas as semanas.
interface RecurringActivity {
  id: string
  title: string
  type: string
  weekday: number   // 0=domingo … 6=sábado (Date.getDay())
  start_time: string
  end_time?: string
  location?: string
  responsible?: string
  description?: string
  max_participants?: number
  active: boolean
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Modelos rápidos — biblioteca de atividades típicas de centro de dia/lar, para
// não escrever o mesmo título à mão todos os dias. Toque preenche o formulário.
const ACTIVITY_TEMPLATES: { title: string; type: string; location: string }[] = [
  { title: 'Ginástica da manhã',        type: 'gym',       location: 'Sala de convívio' },
  { title: 'Fisioterapia de grupo',     type: 'therapy',   location: 'Sala de fisioterapia' },
  { title: 'Jogos de mesa',             type: 'games',     location: 'Sala de convívio' },
  { title: 'Bingo',                     type: 'games',     location: 'Sala de convívio' },
  { title: 'Exercícios de memória',     type: 'games',     location: 'Sala de convívio' },
  { title: 'Musicoterapia',             type: 'music',     location: 'Sala de convívio' },
  { title: 'Karaoke',                   type: 'music',     location: 'Sala de convívio' },
  { title: 'Pintura e desenho',         type: 'art',       location: 'Sala de atividades' },
  { title: 'Trabalhos manuais',         type: 'art',       location: 'Sala de atividades' },
  { title: 'Leitura de jornal',         type: 'reading',   location: 'Sala de convívio' },
  { title: 'Hora do chá',               type: 'social',    location: 'Sala de convívio' },
  { title: 'Passeio no jardim',         type: 'outing',    location: 'Jardim' },
  { title: 'Missa / momento religioso', type: 'religious', location: 'Capela' },
  { title: 'Visita de familiares',      type: 'visit',     location: 'Sala de visitas' },
]

interface Participation {
  id: string
  activity_id: string
  patient_id: string
  patient_name?: string
  attended: boolean
  notes?: string
  /** Porque e que nao participou. So faz sentido com `attended = false`.
   *  Sem isto, «Ausente» tanto podia ser «nao veio» como «veio e nao quis» —
   *  e para quem cuida essas duas coisas nao tem nada a ver uma com a outra. */
  motivo?: string | null
}

interface Patient {
  id: string
  name: string
  room_number?: string
}

// ── OS TIPOS DEIXARAM DE TER EMOJI E DE TER COR (2026-10-07) ──────────────
// Eram onze emoji e onze cores. Duas coisas de uma vez:
//
//   • o emoji e o sinal numero um de «software de brincar», e ao lado de uma
//     palavra que ja diz a mesma coisa («Ginastica») nao acrescenta nada;
//   • onze cores sao um sexto sistema de cor a competir com os tres estados.
//     Com onze cores, a cor de uma atividade nao se aprende — decora-se.
//
// No lugar, um codigo de tres letras, neutro, como o MED e o CUI do /o-dia.
// Serve para as listas densas, onde o nome por extenso nao cabe; onde cabe,
// aparece o nome e mais nada.
const TYPES = [
  { id: 'gym',       label: 'Ginástica',     codigo: 'GIN' },
  { id: 'games',     label: 'Jogos',         codigo: 'JOG' },
  { id: 'music',     label: 'Musicoterapia', codigo: 'MUS' },
  { id: 'art',       label: 'Arteterapia',   codigo: 'ART' },
  { id: 'visit',     label: 'Visitas',       codigo: 'VIS' },
  { id: 'outing',    label: 'Saída',         codigo: 'SAI' },
  { id: 'religious', label: 'Religioso',     codigo: 'REL' },
  { id: 'therapy',   label: 'Fisioterapia',  codigo: 'FIS' },
  { id: 'social',    label: 'Convívio',      codigo: 'CON' },
  { id: 'reading',   label: 'Leitura',       codigo: 'LEI' },
  { id: 'other',     label: 'Outro',         codigo: 'OUT' },
]

/* O codigo de um tipo. Era uma peca propria com o seu tamanho e a sua borda;
   passa a `Codigo`, que e a mesma peca que o /o-dia e as ocorrencias usam —
   para um selo de tres letras ter o mesmo aspeto em toda a aplicacao. */

const STATUS_CFG = {
  planned:   { label: 'Agendada',   bg: 'var(--bg-2)', color: 'var(--ink-4)', border: 'var(--border)' },
  ongoing:   { label: 'Em curso',   bg: 'var(--badge-green-bg)', color: 'var(--green)', border: 'var(--badge-green-border)' },
  done:      { label: 'Concluída',  bg: 'var(--bg-2)', color: 'var(--ink-2)', border: 'var(--border)' },
  cancelled: { label: 'Cancelada',  bg: 'var(--badge-red-bg)', color: 'var(--red)', border: 'var(--badge-red-border)' },
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function typeFor(id: string) {
  return TYPES.find(t => t.id === id) || TYPES[TYPES.length - 1]
}

export function AtividadesTool() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('atividades', 'editar')
  const cfg = institutionConfig(institution)
  const largo = useLargo()
  const [view, setView]         = useState<'today' | 'week' | 'all'>('today')
  const [activities, setActivities] = useState<Activity[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  // Um registo que nao gravou tem de se ver que nao gravou.
  const [erroRegisto, setErroRegisto] = useState('')
  const [selected, setSelected] = useState<Activity | null>(null)
  const [participations, setParticipations] = useState<Participation[]>([])
  /* QUANTOS FORAM A CADA ATIVIDADE (2026-10-07)
     As participacoes so se liam da atividade ABERTA — por isso a lista nao
     podia mostrar quantos participaram, e era preciso abrir uma a uma para
     saber. Num centro de dia a participacao E o trabalho.

     Uma leitura so, de todas as presencas, a contar por atividade. Le apenas
     `activity_id`, o que a torna barata mesmo com um ano de historico. */
  const [presencasPorAtividade, setPresencasPorAtividade] = useState<Map<string, number>>(new Map())
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [filterType, setFilterType] = useState('')
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [notifySent, setNotifySent] = useState<string | null>(null)
  const [notifyMsg, setNotifyMsg] = useState('')
  // Avisar as famílias ao criar a atividade: ligado por defeito (é o que se quer
  // no dia-a-dia), mas VISÍVEL e desligável — para planear o mês que vem, ou
  // corrigir uma atividade, sem mandar mensagem a toda a gente.
  const [notifyOnCreate, setNotifyOnCreate] = useState(true)

  const [form, setForm] = useState({
    title: '', type: 'gym', date: todayStr(), start_time: '10:00', end_time: '',
    location: 'Sala de convívio', responsible: '', description: '', max_participants: '',
  })

  // Atividades recorrentes — modelos + as ocorrências já garantidas.
  const [recurring, setRecurring] = useState<RecurringActivity[]>([])
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [savingRecurring, setSavingRecurring] = useState(false)
  const [recurringForm, setRecurringForm] = useState({
    title: '', type: 'gym', weekday: 3, start_time: '10:00', end_time: '',
    location: 'Sala de convívio', responsible: '', description: '', max_participants: '',
  })

  // Garante que as próximas ocorrências de cada modelo ATIVO existem como
  // atividades reais (próximos 21 dias — ~3 semanas sempre visíveis à frente).
  // Idempotente: liga-se por recurring_id+date, nunca duplica.
  const ensureRecurringOccurrences = useCallback(async (tpls: RecurringActivity[]) => {
    const active = tpls.filter(t => t.active)
    if (!user || active.length === 0) return false
    const horizon = 21
    const base = new Date(); base.setHours(0, 0, 0, 0)
    const wanted: { tpl: RecurringActivity; date: string }[] = []
    for (const tpl of active) {
      for (let i = 0; i < horizon; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i)
        if (d.getDay() === tpl.weekday) wanted.push({ tpl, date: d.toISOString().slice(0, 10) })
      }
    }
    if (wanted.length === 0) return false
    const { data: existing } = await supabase.from('activities').select('recurring_id,date').in('recurring_id', active.map(t => t.id))
    const existingSet = new Set((existing || []).map((e: any) => `${e.recurring_id}:${e.date}`))
    const toInsert = wanted.filter(w => !existingSet.has(`${w.tpl.id}:${w.date}`)).map(w => scope.stamp({
      user_id: user.id, title: w.tpl.title, type: w.tpl.type, date: w.date,
      start_time: w.tpl.start_time, end_time: w.tpl.end_time || null,
      location: w.tpl.location || null, responsible: w.tpl.responsible || null,
      description: w.tpl.description || null, max_participants: w.tpl.max_participants || null,
      status: 'planned', recurring_id: w.tpl.id,
    }))
    if (toInsert.length === 0) return false
    const { error } = await supabase.from('activities').insert(toInsert)
    return !error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: acts }, { data: pats }, recRes] = await Promise.all([
      scope.filter(supabase.from('activities').select('*')).order('date', { ascending: false }).order('start_time', { ascending: true }),
      scope.filter(supabase.from('patients').select('*')).order('name'),
      // Degrada em silêncio se a migração (sprint108) ainda não tiver corrido.
      scope.filter(supabase.from('recurring_activities').select('*')).order('weekday').then((r: any) => r, () => ({ data: [] })),
    ])
    const recs: RecurringActivity[] = recRes.data || []
    setRecurring(recs)
    const generated = await ensureRecurringOccurrences(recs)
    if (generated) {
      const { data: acts2 } = await scope.filter(supabase.from('activities').select('*')).order('date', { ascending: false }).order('start_time', { ascending: true })
      setActivities(acts2 || [])
    } else {
      setActivities(acts || [])
    }
    setPatients(pats || [])

    // Quantos foram a cada atividade. Sem `scope.filter`: a tabela das
    // participacoes nao tem `org_id` (herda pelo join a atividade), e
    // acrescentar-lhe um filtro por uma coluna que nao existe faz a consulta
    // rebentar em contas com organizacao. A RLS ja protege.
    const { data: presencas, error: erroPresencas } = await supabase
      .from('activity_participations').select('activity_id').eq('attended', true)
    if (erroPresencas) reportError('activities-presencas', erroPresencas)
    const contagem = new Map<string, number>()
    ;((presencas || []) as { activity_id: string }[]).forEach(p => {
      contagem.set(p.activity_id, (contagem.get(p.activity_id) || 0) + 1)
    })
    setPresencasPorAtividade(contagem)

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, ensureRecurringOccurrences])

  useEffect(() => { load() }, [load])

  async function saveRecurring() {
    if (!recurringForm.title.trim() || !user) return
    if (!podeEditar) { alert('A sua conta é só de leitura.'); return }
    setSavingRecurring(true)
    const { error } = await supabase.from('recurring_activities').insert(scope.stamp({
      user_id: user.id, title: recurringForm.title.trim(), type: recurringForm.type, weekday: recurringForm.weekday,
      start_time: recurringForm.start_time, end_time: recurringForm.end_time || null,
      location: recurringForm.location || null, responsible: recurringForm.responsible || null,
      description: recurringForm.description || null,
      max_participants: recurringForm.max_participants ? parseInt(recurringForm.max_participants) : null,
      active: true,
    }))
    setSavingRecurring(false)
    if (error) { alert(reportError('activities-recurring-save', error, MSG.save)); return }
    setRecurringForm({ title: '', type: 'gym', weekday: 3, start_time: '10:00', end_time: '', location: 'Sala de convívio', responsible: '', description: '', max_participants: '' })
    load()
  }

  async function toggleRecurringActive(r: RecurringActivity) {
    await supabase.from('recurring_activities').update({ active: !r.active }).eq('id', r.id)
    setRecurring(prev => prev.map(x => x.id === r.id ? { ...x, active: !x.active } : x))
  }

  async function deleteRecurring(r: RecurringActivity) {
    if (!confirm(`Apagar o modelo recorrente "${r.title}"? As atividades já agendadas mantêm-se; deixam só de se repetir.`)) return
    await supabase.from('recurring_activities').delete().eq('id', r.id)
    setRecurring(prev => prev.filter(x => x.id !== r.id))
  }

  async function loadParticipation(actId: string) {
    const { data, error: erroLeitura1 } = await supabase
      .from('activity_participations').select('*').eq('activity_id', actId)
    if (erroLeitura1) reportError('activities-read', erroLeitura1)
    setParticipations(data || [])
  }

  async function selectActivity(act: Activity) {
    setSelected(act)
    await loadParticipation(act.id)
  }

  async function saveActivity() {
    if (!form.title.trim() || !user) return
    if (!podeEditar) { alert('A sua conta é só de leitura.'); return }
    setSaving(true)
    const title = form.title.trim()
    const { error } = await supabase.from('activities').insert(scope.stamp({
      user_id: user.id, title, type: form.type,
      date: form.date, start_time: form.start_time,
      end_time: form.end_time || null, location: form.location || null,
      responsible: form.responsible || null, description: form.description || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      status: 'planned',
    }))
    if (!error && notifyOnCreate) {
      // Avisa as famílias de todos os utentes ativos assim que a atividade é
      // registada. Vai para o fio family_thread_messages → /family e /familia.
      const ids = patients.map(p => p.id)
      const n = await sendActivityMessages(title, ids, 'planned')
      if (n > 0) { setNotifyMsg(`Atividade criada — ${n} ${n === 1 ? 'família avisada' : 'famílias avisadas'}.`); setTimeout(() => setNotifyMsg(''), 5000) }
    } else if (!error) {
      setNotifyMsg('Atividade criada. As famílias não foram avisadas.')
      setTimeout(() => setNotifyMsg(''), 5000)
    }
    setSaving(false)
    if (error) { alert('Não foi possível guardar a atividade: ' + error.message); return }
    setShowModal(false)
    setForm({ title: '', type: 'gym', date: todayStr(), start_time: '10:00', end_time: '', location: 'Sala de convívio', responsible: '', description: '', max_participants: '' })
    load()
  }

  async function toggleStatus(act: Activity, status: Activity['status']) {
    await supabase.from('activities').update({ status }).eq('id', act.id)
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, status } : a))
    if (selected?.id === act.id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  // Marcar presenca. Quando alguem passa a NAO participar, pergunta-se porque:
  // e a diferenca entre um registo que diz «faltaram 4» e um que diz o que se
  // passou com cada uma das quatro pessoas.
  //
  // A pergunta e feita DEPOIS de gravar, nao antes. Quem esta a marcar
  // presencas esta a correr uma lista; travar a lista com um formulario por
  // cada ausencia faria com que ninguem marcasse presencas.
  const [aPerguntarMotivo, setAPerguntarMotivo] = useState<{ id: string; nome: string } | null>(null)

  async function toggleParticipation(patientId: string, attended: boolean) {
    if (!selected) return
    const existing = participations.find(p => p.patient_id === patientId)
    // Voltar a marcar presente apaga o motivo: ja nao ha ausencia nenhuma para
    // explicar, e um motivo orfao ficaria a contradizer a presenca.
    const motivo = attended ? null : (existing?.motivo ?? null)
    if (existing) {
      const { error } = await supabase.from('activity_participations').update({ attended, motivo }).eq('id', existing.id)
      if (error) {
        // A presenca de hoje e a prova de que alguem esteve na casa. Se nao
        // gravou, tem de se ver que nao gravou — e o ecra nao pode ficar a
        // mostrar o estado novo como se tivesse ficado.
        setErroRegisto(reportError('activity-part-update', error,
          isSetupError(error) ? MSG.unavailable : 'A presença não ficou registada. Tente de novo.'))
        return
      }
      setErroRegisto('')
      setParticipations(prev => prev.map(p => p.patient_id === patientId ? { ...p, attended, motivo } : p))
      if (!attended) perguntarPorque(patientId)
    } else {
      const { data, error } = await supabase.from('activity_participations').insert(scope.stamp({
        activity_id: selected.id, patient_id: patientId, attended,
        user_id: user.id,
      })).select().single()
      if (error || !data) {
        // Nao se finge que ficou marcado. A presenca de hoje e a prova de que
        // alguem esteve na casa -- se nao gravou, tem de se ver que nao gravou.
        setErroRegisto(reportError('activity-part-insert', error,
          isSetupError(error) ? MSG.unavailable : 'A presença não ficou registada. Tente de novo.'))
        return
      }
      setErroRegisto('')
      setParticipations(prev => [...prev, data])
      if (!attended) perguntarPorque(patientId)
    }
  }

  function perguntarPorque(patientId: string) {
    const nome = patients.find(p => p.id === patientId)?.name || ''
    setAPerguntarMotivo({ id: patientId, nome })
  }

  async function markAllPresent() {
    if (!selected) return
    const existingIds = new Set(participations.map(p => p.patient_id))
    const toInsert = patients.filter(p => !existingIds.has(p.id)).map(p => scope.stamp({ activity_id: selected.id, patient_id: p.id, attended: true, user_id: user.id }))
    const toUpdate = participations.filter(p => !p.attended)
    // `motivo: null` junto com o `attended: true`: marcar toda a gente presente
    // tem de apagar os motivos de ausencia que ja la estivessem, senao fica um
    // «Recusou» colado a uma pessoa que esta marcada como presente.
    if (toUpdate.length) {
      const { error } = await supabase.from('activity_participations').update({ attended: true, motivo: null }).in('id', toUpdate.map(p => p.id))
      if (error) {
        setErroRegisto(reportError('activity-all-update', error,
          isSetupError(error) ? MSG.unavailable : 'Não foi possível marcar todos. Tente de novo.'))
        return
      }
    }
    let inserted: Participation[] = []
    if (toInsert.length) {
      const { data, error } = await supabase.from('activity_participations').insert(toInsert).select()
      if (error) {
        setErroRegisto(reportError('activity-all-insert', error,
          isSetupError(error) ? MSG.unavailable : 'Não foi possível marcar todos. Tente de novo.'))
        return
      }
      inserted = data || []
    }
    setErroRegisto('')
    setParticipations(prev => [...prev.map(p => ({ ...p, attended: true, motivo: null })), ...inserted])
  }

  // Envia um recado às famílias dos utentes indicados, no FIO que as famílias
  // realmente veem (family_thread_messages — /family e /familia). Antes escrevia
  // em family_messages e a família não via nada. Devolve quantas foram enviadas.
  const firstName = (pid: string) => (patients.find(p => p.id === pid)?.name || cfg.personNoun).split(' ')[0]
  async function sendActivityMessages(title: string, patientIds: string[], verb: 'planned' | 'participated'): Promise<number> {
    if (!user || patientIds.length === 0) return 0
    const rows = patientIds.map(pid => scope.stamp({
      user_id: user.id, patient_id: pid, author_side: 'staff',
      author_name: user.name || 'Equipa', kind: 'update',
      content: verb === 'participated'
        ? `O/A ${firstName(pid)} participou hoje na atividade "${title}". Foi um bom momento! 🌿`
        : `Hoje temos a atividade "${title}" com o/a ${firstName(pid)}. Depois contamos como correu! 🌿`,
      read_by_family: false, read_by_staff: true,
    }))
    const { error } = await supabase.from('family_thread_messages').insert(rows)
    return error ? 0 : rows.length
  }

  // Botão manual: avisar as famílias de quem participou (fio /family + /familia).
  async function notifyFamilies() {
    if (!selected || !user) return
    const present = participations.filter(p => p.attended).map(p => p.patient_id)
    if (present.length === 0) { alert('Marca primeiro quem participou.'); return }
    if (!podeEditar) { alert('A sua conta é só de leitura.'); return }
    if (!confirm(`Enviar recado às famílias de ${present.length} ${cfg.personNounPlural.toLowerCase()} que participaram em "${selected.title}"?`)) return
    setNotifyBusy(true)
    const n = await sendActivityMessages(selected.title, present, 'participated')
    setNotifyBusy(false)
    if (n === 0) { alert('Não foi possível enviar.'); return }
    setNotifySent(selected.id)
    setTimeout(() => setNotifySent(null), 4000)
  }

  async function deleteActivity(act: Activity) {
    if (!confirm(`Apagar a atividade "${act.title}"? Esta ação não pode ser revertida.`)) return
    await supabase.from('activity_participations').delete().eq('activity_id', act.id)
    await supabase.from('activities').delete().eq('id', act.id)
    setActivities(prev => prev.filter(a => a.id !== act.id))
    if (selected?.id === act.id) setSelected(null)
  }

  const [printingReport, setPrintingReport] = useState(false)
  async function printMonthlyReport() {
    setPrintingReport(true)
    try {
      const m = today.slice(0, 7)
      const monthActs = activities.filter(a => a.date.slice(0, 7) === m && a.status !== 'cancelled')
      const ids = monthActs.map(a => a.id)
      let parts: Participation[] = []
      if (ids.length) {
        const { data, error } = await supabase.from('activity_participations').select('*').in('activity_id', ids)
        // Um relatorio mensal com zero presencas, impresso e entregue, e uma
        // afirmacao sobre o mes que ninguem verificou. Se a leitura falhou, nao
        // se imprime.
        if (error) {
          setErroRegisto(reportError('activities-report-parts', error,
            'Não consegui ler as presenças do mês. O relatório não foi criado — tente de novo.'))
          setPrintingReport(false)
          return
        }
        parts = data || []
      }
      const attendedParts = parts.filter(p => p.attended)
      // por tipo
      const byType: Record<string, { count: number; attend: number }> = {}
      monthActs.forEach(a => {
        byType[a.type] ||= { count: 0, attend: 0 }
        byType[a.type].count++
        byType[a.type].attend += attendedParts.filter(p => p.activity_id === a.id).length
      })
      // por residente
      const byPatient: Record<string, number> = {}
      attendedParts.forEach(p => { byPatient[p.patient_id] = (byPatient[p.patient_id] || 0) + 1 })
      const lowPart = patients.filter(p => (byPatient[p.id] || 0) <= 1)

      const monthLabel = new Date(today + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      printDoc({
        docTitle: 'Relatório Mensal de Animação Sociocultural',
        docSubtitle: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        institution: cfg.unitNoun,
        meta: [
          { label: 'atividades', value: String(monthActs.length) },
          { label: 'participações', value: String(attendedParts.length) },
          { label: 'média/atividade', value: monthActs.length ? (attendedParts.length / monthActs.length).toFixed(1) : '0' },
        ],
        sections: [
          {
            heading: 'Atividades por tipo',
            records: Object.entries(byType).sort((a, b) => b[1].count - a[1].count).map(([type, v]) => ({
              title: `${typeFor(type).label} — ${v.count} sessõ${v.count !== 1 ? 'es' : 'e'}`,
              fields: [{ label: 'Participações', value: String(v.attend) }, { label: 'Média', value: (v.attend / v.count).toFixed(1) }],
            })),
          },
          {
            heading: 'Registo de sessões',
            records: monthActs.sort((a, b) => a.date.localeCompare(b.date)).map(a => ({
              title: `${new Date(a.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })} — ${a.title}`,
              tags: [{ label: typeFor(a.type).label, color: 'var(--ink-3)' }],
              fields: [
                { label: 'Hora', value: a.start_time + (a.end_time ? `–${a.end_time}` : '') },
                { label: 'Presenças', value: String(attendedParts.filter(p => p.activity_id === a.id).length) },
                ...(a.responsible ? [{ label: 'Dinamizador', value: a.responsible }] : []),
              ],
            })),
          },
          ...(lowPart.length ? [{
            heading: `${cfg.personNounPlural} com baixa participação (≤1 atividade)`,
            records: [{ title: `${lowPart.length} ${cfg.personNoun.toLowerCase()}(s)`, bullets: lowPart.map(p => `${p.name}${cfg.hasBeds && p.room_number ? ` · ${cfg.roomLabel[0]}${p.room_number}` : ''} — ${byPatient[p.id] || 0} participaçõe(s)`) }],
          }] : []),
          { heading: 'Validação', records: [{ title: 'Responsável pela animação', fields: [{ label: 'Nome', value: '' }, { label: 'Assinatura', value: '' }, { label: 'Data', value: '' }] }] },
        ],
        footerNote: 'Relatório de animação sociocultural · Phlox',
      })
    } finally { setPrintingReport(false) }
  }

  const today = todayStr()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    const day = d.getDay()
    const mon = new Date(d)
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + i)
    return mon.toISOString().slice(0, 10)
  })

  const filtered = activities.filter(a => {
    if (filterType && a.type !== filterType) return false
    if (view === 'today') return a.date === today
    if (view === 'week') return weekDates.includes(a.date)
    return true
  })

  // Stats
  const totalThisMonth = activities.filter(a => a.date.slice(0, 7) === today.slice(0, 7)).length
  const doneThisMonth  = activities.filter(a => a.date.slice(0, 7) === today.slice(0, 7) && a.status === 'done').length
  const todayCount     = activities.filter(a => a.date === today).length

  const attendedCount  = participations.filter(p => p.attended).length

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Eram quatro cartões de estatística, onze botões de filtro por tipo, três
     separadores de vista, e só então a lista — em cartões de 70px com um
     emoji por cada coisa (🕐 hora, 📍 local, 👤 responsável).

     Passa a uma tabela com as horas em coluna, e ganha a coluna que faltava:
     QUANTOS PARTICIPARAM. Num centro de dia a participação é o trabalho, e
     para a saber era preciso abrir cada atividade uma a uma.

     Os onze filtros por tipo passam a uma lista pendente — e só com os tipos
     que esta casa usou, não os onze de catálogo.
     ══════════════════════════════════════════════════════════════════════════ */
  const tiposUsados = TYPES.filter(t => activities.some(a => a.type === t.id))

  /* Quantos participaram em cada atividade. O painel da direita só sabe da
     que está aberta; a lista precisa de todas, e vem da mesma leitura. */
  const presentesPorAtividade = presencasPorAtividade

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Atividades</span>

          <Seletor
            opcoes={[
              { id: 'today', rotulo: 'Hoje' },
              { id: 'week', rotulo: 'Esta semana' },
              { id: 'all', rotulo: 'Todas' },
            ]}
            ativa={view} aoMudar={v => setView(v as 'today' | 'week' | 'all')} />

          {tiposUsados.length > 1 && (
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              aria-label="Tipo de atividade" style={{ ...CAIXA, width: 160 }}>
              <option value="">Todos os tipos</option>
              {tiposUsados.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          )}

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {todayCount} HOJE
              </span>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {doneThisMonth} DE {totalThisMonth} FEITAS ESTE MÊS
              </span>
              {recurring.filter(r => r.active).length > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                  {recurring.filter(r => r.active).length} RECORRENTE{recurring.filter(r => r.active).length === 1 ? '' : 'S'}
                </span>
              )}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Botao onClick={printMonthlyReport} esperando={printingReport}>RELATÓRIO MENSAL</Botao>
            <Botao onClick={() => setShowRecurringModal(true)}
              titulo="Atividades que se repetem todas as semanas, sem recriar à mão">
              RECORRENTES
            </Botao>
            <Botao feitio="principal" onClick={() => setShowModal(true)}>+ NOVA ATIVIDADE</Botao>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>EM CURSO = a acontecer agora</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>CANCELADA</span>
          <span style={MONO}>A coluna «Foram» é quem participou, não quem estava inscrito</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Quem faltou leva o motivo, e o motivo vai também para «o que não foi feito»
          </span>
        </BarraDeEstado>
      }
    >
      {notifyMsg && <Aviso tom="bom">{notifyMsg}</Aviso>}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(380px, 1fr) minmax(340px, 460px)' : '1fr',
      }}>
        {(largo || !selected) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 54 }}>Hora</span>
                <span style={{ ...ROTULO, flex: 1 }}>O que é · onde</span>
                <span style={{ ...ROTULO, width: 48 }}>Tipo</span>
                <span style={{ ...ROTULO, width: 52, textAlign: 'right' }}>Foram</span>
                <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Dia</span>
                <span style={{ ...ROTULO, width: 80 }}>Estado</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{filtered.length} de {activities.length}</span>}
          >
            {loading ? (
              <ACarregar oQue="A carregar as atividades…" />
            ) : filtered.length === 0 ? (
              <Vazio
                titulo={`Sem atividades ${view === 'today' ? 'hoje' : view === 'week' ? 'esta semana' : 'registadas'}.`}
                oQueFazer="Um dia sem atividades registadas é um dia que não fica em lado nenhum — e é delas que sai o relatório mensal. As que se repetem todas as semanas podem ficar em «Recorrentes» e aparecem sozinhas."
                acao={<Botao feitio="principal" onClick={() => setShowModal(true)}>+ NOVA ATIVIDADE</Botao>} />
            ) : filtered.map(act => {
              const t = typeFor(act.type)
              const st = STATUS_CFG[act.status]
              const foram = presentesPorAtividade.get(act.id) ?? null
              const d = new Date(act.date + 'T12:00:00')
              return (
                <LinhaTabela key={act.id}
                  aoTocar={() => selectActivity(act)}
                  ativa={selected?.id === act.id}
                  filete={act.status === 'ongoing' ? 'var(--green)' : act.status === 'cancelled' ? 'var(--red)' : undefined}
                  antes={{
                    largura: 54,
                    conteudo: (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-dado)',
                        fontWeight: (act.status === 'ongoing' ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                        color: act.status === 'ongoing' ? 'var(--green)' : 'var(--ink-3)',
                      }}>{act.start_time?.slice(0, 5) || '—'}</span>
                    ),
                  }}
                  principal={
                    <>
                      {act.title}
                      {act.recurring_id && (
                        <span title="Repete-se todas as semanas" style={{
                          ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)',
                        }}> · SEMANAL</span>
                      )}
                    </>
                  }
                  secundaria={[
                    act.end_time ? `até ${act.end_time.slice(0, 5)}` : '',
                    act.location,
                    act.responsible,
                  ].filter(Boolean).join(' · ') || undefined}
                  celulas={[
                    { rotulo: 'Tipo', valor: t.codigo, largura: 48 },
                    {
                      rotulo: 'Foram', valor: foram ?? '—', largura: 52, direita: true,
                      forte: !!foram, cor: foram ? 'var(--green)' : 'var(--ink-5)',
                    },
                    {
                      rotulo: 'Dia', largura: 56, direita: true, soLargo: view !== 'today',
                      valor: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
                    },
                    { rotulo: 'Estado', valor: st.label.toUpperCase(), largura: 80, cor: st.color, forte: act.status !== 'planned' },
                  ]} />
              )
            })}
          </Painel>
        )}

        {/* ── O DETALHE: QUEM FOI, E QUEM NÃO FOI E PORQUÊ ─────────────────── */}
        {selected ? (() => {
          const t = typeFor(selected.type)
          return (
            <Painel
              cabeca={
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Botao onClick={() => setSelected(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontSize: 'var(--t-destaque)',
                      fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                    }}>{selected.title}</span>
                    <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                      {t.label.toUpperCase()} · {new Date(selected.date + 'T12:00:00')
                        .toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
                      {' · '}{selected.start_time?.slice(0, 5)}
                      {selected.end_time ? `–${selected.end_time.slice(0, 5)}` : ''}
                      {selected.location ? ` · ${selected.location.toUpperCase()}` : ''}
                    </span>
                  </span>
                  <Botao feitio="calmo" onClick={() => deleteActivity(selected)}>APAGAR</Botao>
                </div>
              }
              rodape={
                <>
                  <span style={{ ...MONO, color: attendedCount ? 'var(--green)' : 'var(--ink-4)' }}>
                    {attendedCount} de {patients.length} {cfg.personNounPlural.toLowerCase()}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {patients.length > 0 && <Botao onClick={markAllPresent}>MARCAR TODOS</Botao>}
                    {attendedCount > 0 && (
                      <Botao onClick={notifyFamilies} esperando={notifyBusy}
                        titulo="Avisar as famílias de quem participou">
                        {notifySent === selected?.id ? 'AVISADAS ✓' : 'AVISAR AS FAMÍLIAS'}
                      </Botao>
                    )}
                  </span>
                </>
              }
            >
              <div style={{ padding: '0 14px' }}>
                {selected.description && (
                  <Grupo titulo="O que é">
                    <p style={{
                      fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.55,
                      margin: '4px 0 0', whiteSpace: 'pre-wrap',
                    }}>{selected.description}</p>
                  </Grupo>
                )}
                {selected.responsible && (
                  <Grupo titulo="Quem conduz">
                    <span style={{ fontSize: 'var(--t-dado)' }}>{selected.responsible}</span>
                  </Grupo>
                )}

                <Grupo titulo="Em que ponto está">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {(Object.keys(STATUS_CFG) as Activity['status'][]).map(st => {
                      const on = selected.status === st
                      const c = STATUS_CFG[st]
                      return (
                        <button key={st} type="button" onClick={() => toggleStatus(selected, st)}
                          className="mesa-botao" style={{
                            ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                            textTransform: 'uppercase', padding: '0 11px',
                            borderRadius: 'var(--r-md)', cursor: 'pointer',
                            border: `1px solid ${on ? c.color : 'var(--border-2)'}`,
                            background: on ? c.color : 'transparent',
                            color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                            fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                          }}>{c.label}</button>
                      )
                    })}
                  </div>
                </Grupo>
              </div>

              {/* Um registo que nao gravou tem de se ver que nao gravou. */}
              {erroRegisto && <div style={{ padding: '0 14px' }}><Aviso tom="mau">{erroRegisto}</Aviso></div>}

              <div style={{ padding: '10px 0 0' }}>
                <div style={{
                  padding: '5px 14px', background: 'var(--bg-2)',
                  borderTop: '1px solid var(--border-2)', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={ROTULO}>Quem participou</span>
                </div>

                {patients.length === 0 ? (
                  <Vazio titulo={`Ainda não há ${cfg.personNounPlural.toLowerCase()} registados.`} />
                ) : patients.map(p => {
                  const part = participations.find(pp => pp.patient_id === p.id)
                  const attended = part?.attended ?? false
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 14px', borderBottom: '1px solid var(--border)',
                      borderLeft: `3px solid ${attended ? 'var(--green)' : 'transparent'}`,
                    }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 'var(--t-dado)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {p.name}
                          {p.room_number && (
                            <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                              {' '}· {p.room_number}
                            </span>
                          )}
                        </span>
                        {/* O motivo por baixo do nome. Um «Ausente» seco não
                            diz nada a quem lê o registo na semana seguinte. */}
                        {!attended && part?.motivo && (
                          <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 1 }}>
                            {rotuloMotivo(part.motivo)}
                          </span>
                        )}
                      </span>

                      {!attended && (
                        <Botao feitio="calmo" onClick={() => perguntarPorque(p.id)}>
                          {part?.motivo ? 'MUDAR O MOTIVO' : 'PORQUÊ?'}
                        </Botao>
                      )}
                      <button type="button" onClick={() => toggleParticipation(p.id, !attended)}
                        className="mesa-botao" style={{
                          ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                          padding: '0 11px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                          border: `1px solid ${attended ? 'var(--green)' : 'var(--border-2)'}`,
                          background: attended ? 'var(--green)' : 'transparent',
                          color: attended ? 'var(--sobre-acento)' : 'var(--ink-4)',
                          fontWeight: (attended ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                          flexShrink: 0,
                        }}>{attended ? 'FOI' : 'NÃO FOI'}</button>
                    </div>
                  )
                })}
              </div>
            </Painel>
          )
        })() : largo ? (
          <Painel>
            <Vazio titulo="Escolha uma atividade."
              oQueFazer="Abre aqui ao lado para marcar quem participou — com a lista do dia sempre à vista." />
          </Painel>
        ) : null}
      </div>
    </Mesa>

      {/* Porque e que esta pessoa nao participou.
          Grava em dois sitios de proposito: o `motivo` fica na participacao
          (e o que se le aqui, ao lado do nome) e uma linha fica em
          `cuidados_nao_prestados`, que e a tabela onde se pergunta «o que e
          que esta pessoa tem recusado ultimamente», atravessando as areas
          todas. Sem a segunda, a recusa ficava presa dentro das atividades. */}
      {aPerguntarMotivo && selected && (
        <RegistarNaoPrestado
          patientId={aPerguntarMotivo.id}
          nome={aPerguntarMotivo.nome}
          area="atividades"
          oQue={selected.title}
          origem="activities"
          origemId={selected.id}
          aoFechar={() => setAPerguntarMotivo(null)}
          aoGravar={async (_frase, motivo) => {
            const part = participations.find(pp => pp.patient_id === aPerguntarMotivo.id)
            if (!part) return
            const { error } = await supabase.from('activity_participations').update({ motivo }).eq('id', part.id)
            if (error) {
              // A linha em `cuidados_nao_prestados` ja ficou gravada (e o que
              // importa para o historico). Isto aqui e so a etiqueta ao lado do
              // nome; se falhar, diz-se, mas nao se perde o registo.
              setErroRegisto(reportError('activity-motivo', error,
                'O motivo ficou no registo, mas não apareceu aqui ao lado. Recarregue a página.'))
              return
            }
            setParticipations(prev => prev.map(pp => pp.id === part.id ? { ...pp, motivo } : pp))
          }}
        />
      )}

      {/* ── NOVA ATIVIDADE ─────────────────────────────────────────────── */}
      {showModal && (
        <Folha titulo="Nova atividade" aoFechar={() => setShowModal(false)}>
          {/* Modelos rápidos — um toque preenche título, tipo e local, e
              evita escrever «Ginástica das 10h» à mão todos os dias. */}
          <Campo rotulo="Começar de um modelo">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ACTIVITY_TEMPLATES.map(tpl => {
                const on = form.title === tpl.title
                return (
                  <button key={tpl.title} type="button" className="mesa-botao"
                    onClick={() => setForm(p => ({ ...p, title: tpl.title, type: tpl.type, location: tpl.location }))}
                    style={{
                      ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.04em',
                      padding: '0 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                      background: on ? 'var(--green)' : 'transparent',
                      color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                      fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                    }}>{tpl.title}</button>
                )
              })}
            </div>
          </Campo>

          <Campo rotulo="O que é" para="at-titulo" obrigatorio>
            <input id="at-titulo" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Ginástica de manhã" style={{ ...CAIXA, width: '100%' }} />
          </Campo>

          {/* Os onze tipos eram onze botões — três filas de alvos de 12px no
              telemóvel. Uma lista pendente é um alvo só. */}
          <Campo rotulo="Tipo" para="at-tipo">
            <select id="at-tipo" value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...CAIXA, width: '100%' }}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Campo>

          <Campo rotulo="Quando" obrigatorio>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
              <input aria-label="Data" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={CAIXA} />
              <input aria-label="Hora de início" type="time" value={form.start_time}
                onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={CAIXA} />
              <input aria-label="Hora de fim" type="time" value={form.end_time}
                onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={CAIXA} />
            </div>
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Campo rotulo="Onde" para="at-local">
              <input id="at-local" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Sala de convívio" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
            <Campo rotulo="Quem conduz" para="at-resp">
              <input id="at-resp" value={form.responsible}
                onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))}
                placeholder="Nome de quem orienta" style={{ ...CAIXA, width: '100%' }} />
            </Campo>
          </div>

          <Campo rotulo="Notas" para="at-desc">
            <textarea id="at-desc" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="O que é preciso preparar, quem convidar…"
              style={{ ...CAIXA_TEXTO, width: '100%' }} />
          </Campo>

          {/* Avisar as famílias — ligado por omissão, mas visível e desligável.
              Era uma caixa verde de 60px por cima do botão de gravar; fica uma
              linha, que é o que uma opção com um valor por omissão merece. */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
            marginTop: 14, padding: '8px 0', borderTop: '1px solid var(--border)',
          }}>
            <input type="checkbox" checked={notifyOnCreate}
              onChange={e => setNotifyOnCreate(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--green)', flexShrink: 0 }} />
            <span>
              <span style={{ display: 'block', fontSize: 'var(--t-dado)', color: 'var(--ink)' }}>
                Avisar as famílias
              </span>
              <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.45 }}>
                Manda um recado às famílias. Desligue para planear sem avisar ainda.
              </span>
            </span>
          </label>

          <div style={{ marginTop: 14 }}>
            <Botao feitio="principal" onClick={saveActivity} esperando={saving}
              disabled={!form.title.trim()}>
              CRIAR A ATIVIDADE
            </Botao>
          </div>
        </Folha>
      )}

      {/* Atividades recorrentes — modelos que geram ocorrências semana a semana
          (ver ensureRecurringOccurrences), sem recriar a atividade à mão. */}
      {/* ── AS QUE SE REPETEM ──────────────────────────────────────────── */}
      {showRecurringModal && (
        <Folha titulo="Atividades que se repetem" aoFechar={() => setShowRecurringModal(false)}>
          <p style={{
            margin: '10px 0 0', fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.55,
          }}>
            Ficam agendadas sempre no mesmo dia da semana. As próximas três semanas
            aparecem sozinhas na lista, marcadas com «semanal» — não é preciso
            recriar nada à mão.
          </p>

          {recurring.length > 0 && (
            <Grupo titulo={`Já definidas · ${recurring.length}`}>
              {recurring.map(r => {
                const t = typeFor(r.type)
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                    opacity: r.active ? 1 : 0.55,
                  }}>
                    <span style={{ flexShrink: 0 }}><Codigo texto={t.codigo} apagado={!r.active} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: 'var(--t-dado)',
                        fontWeight: 'var(--peso-corpo)' as any,
                        color: r.active ? 'var(--ink)' : 'var(--ink-5)',
                      }}>{r.title}</span>
                      <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                        {WEEKDAYS[r.weekday].toUpperCase()} · {r.start_time?.slice(0, 5)}
                        {r.end_time ? `–${r.end_time.slice(0, 5)}` : ''}
                        {r.location ? ` · ${r.location}` : ''}
                      </span>
                    </span>
                    <Botao onClick={() => toggleRecurringActive(r)}>
                      {r.active ? 'PAUSAR' : 'RETOMAR'}
                    </Botao>
                    <Botao feitio="calmo" onClick={() => deleteRecurring(r)}>APAGAR</Botao>
                  </div>
                )
              })}
            </Grupo>
          )}

          <Grupo titulo="Acrescentar uma">
            <Campo rotulo="Começar de um modelo">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ACTIVITY_TEMPLATES.map(tpl => {
                  const on = recurringForm.title === tpl.title
                  return (
                    <button key={tpl.title} type="button" className="mesa-botao"
                      onClick={() => setRecurringForm(p => ({ ...p, title: tpl.title, type: tpl.type, location: tpl.location }))}
                      style={{
                        ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.04em',
                        padding: '0 10px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                        background: on ? 'var(--green)' : 'transparent',
                        color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                        fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                      }}>{tpl.title}</button>
                  )
                })}
              </div>
            </Campo>

            <Campo rotulo="O que é" para="rec-titulo" obrigatorio>
              <input id="rec-titulo" value={recurringForm.title}
                onChange={e => setRecurringForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Ginástica de manhã" style={{ ...CAIXA, width: '100%' }} />
            </Campo>

            <Campo rotulo="Tipo" para="rec-tipo">
              <select id="rec-tipo" value={recurringForm.type}
                onChange={e => setRecurringForm(p => ({ ...p, type: e.target.value }))}
                style={{ ...CAIXA, width: '100%' }}>
                {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Campo>

            {/* Sete alvos curtos numa fila é mesmo a forma de escolher um dia
                da semana — mas com a altura de alvo do sistema, não 7px. */}
            <Campo rotulo="Em que dia">
              <div role="radiogroup" aria-label="Dia da semana" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {WEEKDAYS_SHORT.map((w, i) => {
                  const on = recurringForm.weekday === i
                  return (
                    <button key={w} type="button" role="radio" aria-checked={on}
                      className="mesa-botao"
                      onClick={() => setRecurringForm(p => ({ ...p, weekday: i }))}
                      style={{
                        ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                        textTransform: 'uppercase', padding: '0 11px',
                        borderRadius: 'var(--r-md)', cursor: 'pointer',
                        border: `1px solid ${on ? 'var(--green)' : 'var(--border-2)'}`,
                        background: on ? 'var(--green)' : 'transparent',
                        color: on ? 'var(--sobre-acento)' : 'var(--ink-4)',
                        fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                      }}>{w}</button>
                  )
                })}
              </div>
            </Campo>

            <Campo rotulo="A que horas" obrigatorio>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input aria-label="Hora de início" type="time" value={recurringForm.start_time}
                  onChange={e => setRecurringForm(p => ({ ...p, start_time: e.target.value }))} style={CAIXA} />
                <input aria-label="Hora de fim" type="time" value={recurringForm.end_time}
                  onChange={e => setRecurringForm(p => ({ ...p, end_time: e.target.value }))} style={CAIXA} />
              </div>
            </Campo>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Campo rotulo="Onde" para="rec-local">
                <input id="rec-local" value={recurringForm.location}
                  onChange={e => setRecurringForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="Sala de convívio" style={{ ...CAIXA, width: '100%' }} />
              </Campo>
              <Campo rotulo="Quem conduz" para="rec-resp">
                <input id="rec-resp" value={recurringForm.responsible}
                  onChange={e => setRecurringForm(p => ({ ...p, responsible: e.target.value }))}
                  placeholder="Nome de quem orienta" style={{ ...CAIXA, width: '100%' }} />
              </Campo>
            </div>

            <div style={{ marginTop: 14 }}>
              <Botao feitio="principal" onClick={saveRecurring} esperando={savingRecurring}
                disabled={!recurringForm.title.trim()}>
                TODAS AS {WEEKDAYS[recurringForm.weekday].toUpperCase()}S
              </Botao>
            </div>
          </Grupo>
        </Folha>
      )}
    </>
  )
}
