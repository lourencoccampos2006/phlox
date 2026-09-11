'use client'

// /apoio-servicos — RECONSTRUÍDO 2026-08-07 (auditoria: a versão anterior era
// só um quadro de pedidos avulsos, "inútil" nas palavras do Fernando — não
// ajudava a organizar TRANSPORTES que se repetem toda a semana).
//
// Agora tem duas partes:
//  1) Transportes recorrentes (principal) — por utente, um horário fixo que se
//     repete ("fisioterapia toda terça e quinta"), com checkbox de feito hoje.
//     Mesmo padrão de weekdays de app/care-log/CuidadosTool.tsx. Isto é
//     DIFERENTE do transporte já coberto em /agenda: lá é por MARCAÇÃO datada
//     (uma vez); aqui é um plano que se repete sozinho, sem reintroduzir cada
//     semana.
//  2) Roupa & outros (secundário) — o quadro pedido→em curso→concluído que já
//     existia (support_services), mantido tal como estava, só sem "transporte"
//     como opção (isso agora vive na parte 1).
//
// Tabelas novas: support_transport_schedules + support_transport_logs
// (supabase/sprint126_support_transport_schedules.sql — por aplicar).

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'

import MapaLeaflet, { type RotaCalculada } from '@/components/institution/MapaLeaflet'
import { montarRota, folhaDoMotorista, horariosDoCircuito, type Paragem } from '@/lib/rotaTransporte'
import { useOrgName } from '@/lib/useOrgName'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { registar, ACOES } from '@/lib/registo'

interface Patient { id: string; name: string; room_number?: string | null; address?: string | null; photo_url?: string | null; lat?: number | null; lon?: number | null }
type TipoTransporte = 'circuito' | 'consulta' | 'passeio' | 'pontual'
interface Schedule {
  id: string; patient_id: string; label: string; weekdays: number[] | null
  time: string | null; notes: string | null
  kind: TipoTransporte; route_id: string | null; destino: string | null; data: string | null
}
interface Circuito {
  id: string; nome: string; direcao: 'recolha' | 'entrega'
  hora_partida: string; minutos_paragem: number; weekdays: number[] | null; active: boolean
}
interface ScheduleLog { id: string; schedule_id: string; date: string; done: boolean }
interface Service {
  id: string; patient_id: string | null; kind: 'roupa' | 'outro'
  date: string; status: 'pedido' | 'em_curso' | 'concluido'; notes: string | null
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ── Os separadores ──────────────────────────────────────────────────────────
// A página tinha tudo empilhado numa coluna só e obrigava a percorrer meia
// dúzia de ecrãs para chegar aos serviços. Cada assunto passa a ter o seu
// separador: abre-se o que se quer, e o resto não está lá a ocupar espaço.
type Aba = TipoTransporte | 'roupa' | 'servicos'
const ABAS: { id: Aba; label: string; icon: string; sub: string }[] = [
  { id: 'circuito', label: 'Casa ↔ Centro', icon: 'route',   sub: 'O circuito diário. Uma hora de partida, as chegadas saem calculadas.' },
  { id: 'consulta', label: 'Consultas',     icon: 'clock',   sub: 'Individual, com hora marcada que tem de ser respeitada.' },
  { id: 'passeio',  label: 'Passeios',      icon: 'users',   sub: 'Grupo, ida e volta. Quem vai é uma lista, não um horário fixo.' },
  { id: 'pontual',  label: 'Pontuais',      icon: 'package', sub: 'Farmácia, compras, levar a casa da família. Uma vez, sem repetição.' },
  { id: 'roupa',    label: 'Roupa',         icon: 'shirt',   sub: 'Tratamento de roupa que se repete.' },
  { id: 'servicos', label: 'Outros',        icon: 'clipboard', sub: 'Fim de semana, noite e pedidos avulsos.' },
]
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
  const ACCENT = blueprintFor(institution).accent

  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()

  const [aba, setAba] = useState<Aba>('circuito')
  const [patients, setPatients] = useState<Patient[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [circuitos, setCircuitos] = useState<Circuito[]>([])
  const [circuitoId, setCircuitoId] = useState<string | null>(null)
  const [logs, setLogs] = useState<ScheduleLog[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [faltaSprint143, setFaltaSprint143] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newDays, setNewDays] = useState<number[] | null>(null)
  const [newDestino, setNewDestino] = useState('')
  const [newData, setNewData] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Roupa & outros — secundário, tal como estava.
  const [services, setServices] = useState<Service[]>([])
  const [showNewSvc, setShowNewSvc] = useState(false)
  const [newSvcKind, setNewSvcKind] = useState<Service['kind']>('roupa')
  const [newSvcPatient, setNewSvcPatient] = useState('')
  const [newSvcNotes, setNewSvcNotes] = useState('')
  const [svcSaving, setSvcSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [pats, sch, lgs, svcs, rts] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number,address,photo_url,lat,lon')).eq('active', true).order('name'),
      scope.filter(supabase.from('support_transport_schedules').select('*')).eq('active', true),
      scope.filter(supabase.from('support_transport_logs').select('id,schedule_id,date,done')).eq('date', today),
      scope.filter(supabase.from('support_services').select('*')).in('kind', ['roupa', 'outro']).neq('status', 'concluido').order('created_at', { ascending: false }),
      scope.filter(supabase.from('support_transport_routes').select('*')).eq('active', true).order('hora_partida'),
    ])
    // As duas tabelas do par, não só a primeira: uma migração aplicada pela
    // metade deixava a outra a falhar em silêncio a cada visita (foi o caso
    // do par support_recurring_* aqui em baixo).
    const emFalta = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')
    if (emFalta(sch.error) || emFalta(lgs.error)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setSchedules(sch.data || [])
    setLogs(lgs.data || [])
    setServices(svcs.data || [])
    // A tabela dos circuitos e a coluna `kind` vêm do sprint143. Enquanto não
    // for aplicado, a página funciona na mesma — trata tudo como circuito, que
    // era o unico tipo que existia — e o separador diz o que falta.
    setCircuitos((rts as any)?.data || [])
    setFaltaSprint143(emFalta((rts as any)?.error) || !!(sch.data || []).some((x: any) => x.kind === undefined))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function todaysFor(patientId: string) {
    return schedules.filter(s => s.patient_id === patientId && (!s.weekdays || s.weekdays.includes(todayWeekday)))
  }

  // ── A rota do dia ────────────────────────────────────────────────────────
  // O mesmo dado, lido de outra maneira: em vez de uma lista de checkboxes por
  // pessoa, a sequência real do carro. Ver lib/rotaTransporte para a razão de
  // ser um diagrama de linha e não um mapa.
  const nomeCasa = useOrgName()
  const [casaGeo, setCasaGeo] = useState<{ lat: number; lon: number; nome: string } | null>(null)
  const [aGeocodificar, setAGeocodificar] = useState(false)
  const [calculada, setCalculada] = useState<RotaCalculada | null>(null)
  const [aCalcular, setACalcular] = useState(false)
  const [semMoradaCasa, setSemMoradaCasa] = useState(false)
  const [aConverterCasa, setAConverterCasa] = useState(false)

  /** Reconverte a morada da instituição. Necessário para as que foram
   *  gravadas antes de a conversão automática existir. */
  const converterCasa = useCallback(async () => {
    if (!scope.orgId) return
    setAConverterCasa(true)
    try {
      const { data: org } = await supabase.from('organizations').select('name,address').eq('id', scope.orgId).maybeSingle()
      const morada = (org as any)?.address?.trim()
      if (!morada) { alert('A instituição ainda não tem morada. Define-a em Equipa → Definições.'); setAConverterCasa(false); return }
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ org: scope.orgId }),
      })
      const d = await r.json()
      if (d?.casa?.lat != null) {
        setCasaGeo({ lat: d.casa.lat, lon: d.casa.lon, nome: (org as any)?.name || 'A casa' })
        setSemMoradaCasa(false); setCalculada(null)
      } else {
        alert('Não foi possível localizar essa morada. Tenta acrescentar o código postal e a localidade.')
      }
    } catch { alert('Não foi possível converter agora.') }
    setAConverterCasa(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, scope.orgId])

  // A casa é a origem e o fim do percurso no mapa. Sem coordenadas dela, o
  // mapa desenha só as paragens — não se inventa um ponto de partida.
  useEffect(() => {
    if (!scope.orgId || !supabase) return
    supabase.from('organizations').select('name,lat,lon').eq('id', scope.orgId).maybeSingle()
      .then(({ data }: any) => {
        if (data?.lat != null && data?.lon != null) setCasaGeo({ lat: data.lat, lon: data.lon, nome: data.name || 'A casa' })
        else setSemMoradaCasa(true)
      }, () => {})
  }, [supabase, scope.orgId])

  // Converter moradas em coordenadas — uma vez por morada, e só de quem
  // aparece na rota de hoje. O Nominatim aceita um pedido por segundo, por
  // isso isto corre em segundo plano e a página não espera por ele.
  const converterMoradas = useCallback(async (ids: string[]) => {
    if (!ids.length || aGeocodificar) return
    setAGeocodificar(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ ids }),
      })
      if (r.ok) load()
    } catch { /* sem coordenadas o mapa degrada, não rebenta */ }
    setAGeocodificar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, aGeocodificar])

  /** Tempos reais de estrada e, se `otimizar`, a ordem que faz menos quilómetros. */
  const calcularRota = useCallback(async (otimizar: boolean) => {
    const pontos = rotaRef.current.paragens
      .filter(p => p.lat != null && p.lon != null)
      .map(p => ({ id: p.scheduleId, lat: p.lat as number, lon: p.lon as number }))
    if (pontos.length < 1) return
    setACalcular(true)
    try {
      const r = await fetch('/api/rota-otimizada', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casa: casaGeo ? { lat: casaGeo.lat, lon: casaGeo.lon } : null, paragens: pontos, otimizar }),
      })
      const d = await r.json()
      if (r.ok) setCalculada(d)
    } catch { /* sem rota calculada o mapa continua a desenhar-se */ }
    setACalcular(false)
  }, [casaGeo])

  // Só os horários do tipo que está a ser visto. Antes a rota misturava tudo:
  // o circuito diário e a consulta de quinta-feira apareciam na mesma linha,
  // como se o carro fosse fazer as duas coisas seguidas.
  const doTipo = useMemo(
    () => schedules.filter(x => (x.kind || 'circuito') === (aba === 'roupa' || aba === 'servicos' ? 'circuito' : aba)),
    [schedules, aba])

  const circuitoAtivo = useMemo(
    () => circuitos.find(c => c.id === circuitoId) || circuitos[0] || null,
    [circuitos, circuitoId])

  // No separador do circuito, só quem pertence AO circuito escolhido (ou a
  // nenhum, que é o caso de tudo o que existia antes do sprint143).
  const doCircuito = useMemo(() => {
    if (aba !== 'circuito') return doTipo
    if (!circuitoAtivo) return doTipo
    return doTipo.filter(x => !x.route_id || x.route_id === circuitoAtivo.id)
  }, [doTipo, aba, circuitoAtivo])

  const rota = useMemo(
    () => montarRota(doCircuito, patients, new Set(logs.filter(l => l.done).map(l => l.schedule_id)), todayWeekday),
    [doCircuito, patients, logs, todayWeekday])
  const rotaRef = useRef(rota); rotaRef.current = rota

  // Tempos assim que houver coordenadas. A ordem ótima é sempre a pedido —
  // trocar a ordem por baixo de quem já leu a lista seria confuso.
  useEffect(() => {
    const n = rota.paragens.filter(p => p.lat != null).length
    if (n >= 1 && !calculada && !aCalcular) calcularRota(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota.paragens.filter(p => p.lat != null).length, casaGeo])

  // Com a ordem ótima calculada, a lista e o mapa passam a segui-la.
  const rotaFinal = useMemo(() => {
    if (!calculada?.otimizada || !calculada.ordem?.length) return rota
    const pos = new Map(calculada.ordem.map((id, i) => [id, i]))
    return { ...rota, paragens: [...rota.paragens].sort((a, b) =>
      (pos.get(a.scheduleId) ?? 999) - (pos.get(b.scheduleId) ?? 999)) }
  }, [rota, calculada])

  // Quem está na rota de hoje, tem morada, e ainda não foi convertido.
  useEffect(() => {
    const porConverter = rota.paragens
      .filter(p => p.lat == null && p.morada)
      .map(p => p.patientId)
      .filter(id => { const q = patients.find(x => x.id === id); return q && (q as any).lat == null })
    if (porConverter.length) converterMoradas([...new Set(porConverter)].slice(0, 12))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota.paragens.length])
  function logFor(scheduleId: string) { return logs.find(l => l.schedule_id === scheduleId) }
  function nameOf(patientId: string | null) { return patients.find(p => p.id === patientId)?.name || null }

  async function toggle(s: Schedule) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(s.id)
    const nextDone = !existing?.done
    const { data, error } = await supabase.from('support_transport_logs').upsert(scope.stamp({
      user_id: user.id, schedule_id: s.id, patient_id: s.patient_id, date: today,
      done: nextDone, done_by_id: nextDone ? user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }), { onConflict: 'schedule_id,date' }).select().single()
    if (error) { toast.error('Não foi possível atualizar', reportError('support-transport-toggle', error, MSG.save)); return }
    setLogs(p => { const rest = p.filter(l => l.schedule_id !== s.id); return data ? [...rest, data] : rest })
    const quem = patients.find(x => x.id === s.patient_id)
    registar({ supabase, scope, user }, {
      ...(nextDone ? ACOES.transporteFeito(quem?.name || 'utente', s.label) : ACOES.transporteAberto(quem?.name || 'utente', s.label)),
      subjectId: s.patient_id, subjectName: quem?.name || null, entityId: s.id,
    })
  }

  function openNew(patientId: string) { setNewFor(patientId); setNewLabel(''); setNewTime(''); setNewDays(null); setErr('') }

  async function createSchedule(kind: TipoTransporte = 'circuito') {
    if (!newFor || !newLabel.trim()) return
    setSaving(true); setErr('')
    // O circuito NAO leva hora por pessoa, de proposito: o motorista sai a uma
    // hora so e a chegada a cada porta e calculada (ver lib/rotaTransporte,
    // horariosDoCircuito). Pedir a hora de cada um era pedir para adivinhar o
    // transito. Ja a consulta leva — la ha um medico a espera.
    const linha: any = {
      user_id: user.id, patient_id: newFor, label: newLabel.trim().slice(0, 120),
      weekdays: kind === 'pontual' ? null : newDays, active: true, kind,
      time: kind === 'circuito' ? null : (newTime || null),
      destino: kind === 'circuito' ? null : (newDestino.trim().slice(0, 160) || null),
      data: kind === 'pontual' ? (newData || today) : null,
      route_id: kind === 'circuito' ? (circuitoAtivo?.id || null) : null,
    }
    if (faltaSprint143) { delete linha.kind; delete linha.destino; delete linha.data; delete linha.route_id }
    const { error } = await supabase.from('support_transport_schedules').insert(scope.stamp(linha))
    if (error) { setErr(reportError('support-transport-create', error, MSG.save)); setSaving(false); return }
    setSaving(false); setNewFor(null); setNewLabel(''); setNewTime(''); setNewDestino(''); setNewData('')
    load()
  }

  async function removeSchedule(id: string) {
    if (!confirm('Deixar de repetir este transporte?')) return
    const { error } = await supabase.from('support_transport_schedules').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('support-transport-remove', error, MSG.save)); return }
    load()
  }

  // ── Os circuitos ──────────────────────────────────────────────────────────
  async function criarCircuito(direcao: 'recolha' | 'entrega') {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const { data, error } = await supabase.from('support_transport_routes').insert(scope.stamp({
      user_id: user.id,
      nome: direcao === 'recolha' ? 'Recolha da manhã' : 'Entrega da tarde',
      direcao, hora_partida: direcao === 'recolha' ? '08:00' : '17:00',
      minutos_paragem: 3, weekdays: [1, 2, 3, 4, 5], active: true,
    })).select().single()
    if (error) { toast.error('Não foi possível criar o circuito', reportError('circuito-criar', error, MSG.save)); return }
    if (data) { setCircuitos(c => [...c, data]); setCircuitoId(data.id) }
  }

  async function guardarCircuito(id: string, patch: Partial<Circuito>) {
    setCircuitos(c => c.map(x => x.id === id ? { ...x, ...patch } as Circuito : x))
    const { error } = await supabase.from('support_transport_routes').update(patch).eq('id', id)
    if (error) { toast.error('Não foi possível guardar', reportError('circuito-guardar', error, MSG.save)); load() }
  }

  // ── As horas de chegada, calculadas ───────────────────────────────────────
  // É isto que substitui a hora escrita à mão em cada pessoa: a partir da hora
  // a que o carro sai e dos tempos de estrada reais que o /api/rota-otimizada
  // devolveu, sai a hora a que se chega a cada porta.
  const circuitoComHoras = useMemo(() => {
    if (aba !== 'circuito' || !circuitoAtivo) return null
    const comGeo = rotaFinal.paragens.filter(x => x.lat != null && x.lon != null)
    if (!comGeo.length) return null
    return horariosDoCircuito(
      rotaFinal.paragens,
      circuitoAtivo.hora_partida,
      calculada?.pernas || [],
      circuitoAtivo.minutos_paragem || 3,
    )
  }, [aba, circuitoAtivo, rotaFinal, calculada])

  /** A rota que vai para o mapa e para a folha: com as horas calculadas quando
   *  é um circuito, com as horas escritas quando é outra coisa. */
  const rotaParaMostrar = useMemo(() => {
    if (!circuitoComHoras) return rotaFinal
    return {
      ...rotaFinal,
      paragens: circuitoComHoras.paragens.map(x => ({ ...x, hora: x.horaEstimada })) as Paragem[],
      primeira: circuitoComHoras.partida,
      ultima: circuitoComHoras.regresso,
      duracaoMin: circuitoComHoras.minutosTotal,
    }
  }, [rotaFinal, circuitoComHoras])

  function toggleDay(d: number) {
    setNewDays(prev => { const base = prev || []; return base.includes(d) ? base.filter(x => x !== d) : [...base, d].sort() })
  }

  async function createService() {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    setSvcSaving(true)
    const { error } = await supabase.from('support_services').insert(scope.stamp({
      user_id: user.id, patient_id: newSvcPatient || null, kind: newSvcKind, status: 'pedido',
      notes: newSvcNotes.trim() ? newSvcNotes.trim().slice(0, 500) : null, requested_by_id: user.id,
    }))
    if (error) { toast.error('Não foi possível publicar', reportError('support-services-create', error, MSG.save)); setSvcSaving(false); return }
    setSvcSaving(false); setShowNewSvc(false); setNewSvcPatient(''); setNewSvcNotes(''); setNewSvcKind('roupa')
    load()
  }
  async function advanceService(s: Service) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const next: Service['status'] = s.status === 'pedido' ? 'em_curso' : 'concluido'
    const patch: any = { status: next }
    if (next === 'concluido') { patch.completed_by_id = user.id; patch.completed_at = new Date().toISOString() }
    const { error } = await supabase.from('support_services').update(patch).eq('id', s.id)
    if (error) { toast.error('Não atualizado', reportError('support-services-advance', error, MSG.save)); return }
    load()
  }
  async function removeService(id: string) {
    const { error } = await supabase.from('support_services').delete().eq('id', id)
    if (error) { toast.error('Não eliminado', reportError('support-services-delete', error, MSG.save)); return }
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const svcColumns: Service['status'][] = ['pedido', 'em_curso']
  const abaMeta = ABAS.find(a => a.id === aba)!

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <AvisoDeSetup codigo="PHX-H5" oQue="Os transportes recorrentes ainda não estão disponíveis nesta conta." />
        </div>
      </div>
    )
  }

  // ── O quadro por pessoa ────────────────────────────────────────────────────
  // Serve as consultas, os passeios e os pedidos pontuais: são a mesma forma
  // (uma pessoa, uma ou mais deslocações), só mudam os campos que fazem
  // sentido. O circuito NÃO passa por aqui — lá ninguém escreve horas.
  //
  // É uma função e não um componente de propósito: um componente definido
  // dentro da página seria remontado a cada tecla e o cursor saltava do campo.
  function quadroPorPessoa(kind: TipoTransporte) {
    const doKind = (pid: string) => schedules.filter(x =>
      x.patient_id === pid && (x.kind || 'circuito') === kind &&
      (kind === 'pontual' ? true : (!x.weekdays || x.weekdays.includes(todayWeekday))))

    const comAlgo = filtered.filter(p => doKind(p.id).length > 0)
    const lista = newFor ? filtered : (comAlgo.length ? comAlgo : filtered.slice(0, 8))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comAlgo.length === 0 && !newFor && (
          <div style={{
            background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 12,
            padding: '16px 18px', fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6,
          }}>
            Ainda não há nada marcado. Escolhe a pessoa em baixo e carrega em <strong style={{ color: 'var(--ink-3)' }}>+ Marcar</strong>.
          </div>
        )}

        {lista.map(p => {
          const seus = doKind(p.id)
          const isNew = newFor === p.id
          return (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                  {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                </div>
                <button onClick={() => isNew ? setNewFor(null) : openNew(p.id)} style={{
                  padding: '6px 12px', background: isNew ? 'var(--bg-3)' : 'var(--ink)', color: isNew ? 'var(--ink-3)' : 'white',
                  border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>{isNew ? 'Fechar' : '+ Marcar'}</button>
              </div>

              {seus.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {seus.map(sc => {
                    const done = !!logFor(sc.id)?.done
                    return (
                      <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                        <input type="checkbox" checked={done} onChange={() => toggle(sc)} style={{ width: 17, height: 17, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
                          {sc.label}
                          {sc.time ? <strong style={{ marginLeft: 7, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{String(sc.time).slice(0, 5)}</strong> : null}
                          {sc.destino ? <span style={{ color: 'var(--ink-4)', marginLeft: 7 }}>→ {sc.destino}</span> : null}
                        </span>
                        {!sc.weekdays && kind !== 'pontual' && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>diário</span>}
                        <button onClick={() => removeSchedule(sc.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15, flexShrink: 0 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {isNew && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder={kind === 'consulta' ? 'Ex: Consulta de oftalmologia' : kind === 'passeio' ? 'Ex: Passeio ao mercado' : 'Ex: Ida à farmácia'}
                    style={campo} />
                  <input value={newDestino} onChange={e => setNewDestino(e.target.value)}
                    placeholder={kind === 'consulta' ? 'Onde (hospital, centro de saúde…)' : 'Onde'}
                    style={campo} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={rotulo}>{kind === 'consulta' ? 'Hora da consulta' : 'Hora'}</div>
                      <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ ...campo, width: 130 }} />
                    </div>
                    {kind === 'pontual' && (
                      <div>
                        <div style={rotulo}>Dia</div>
                        <input type="date" value={newData || today} onChange={e => setNewData(e.target.value)} style={{ ...campo, width: 160 }} />
                      </div>
                    )}
                  </div>

                  {kind !== 'pontual' && (
                    <div>
                      <div style={rotulo}>Repete-se</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => setNewDays(null)} style={pilula(newDays === null)}>Todos os dias</button>
                        {WEEKDAY_LABELS.map((label, d) => (
                          <button key={d} onClick={() => toggleDay(d)} style={pilula(!!newDays?.includes(d))}>{label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
                  <button onClick={() => createSchedule(kind)} disabled={saving || !newLabel.trim()} style={{
                    alignSelf: 'flex-start', padding: '8px 16px',
                    background: saving || !newLabel.trim() ? 'var(--bg-3)' : 'var(--ink)',
                    color: saving || !newLabel.trim() ? 'var(--ink-4)' : 'white',
                    border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
                    cursor: saving || !newLabel.trim() ? 'not-allowed' : 'pointer',
                  }}>{saving ? 'A guardar…' : 'Marcar'}</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 0' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Serviços de apoio</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0', maxWidth: '62ch', lineHeight: 1.55 }}>{abaMeta.sub}</p>

          {/* ── Os separadores ──────────────────────────────────────────────
              Percorre na horizontal no telemóvel, em vez de empurrar a página
              para baixo, que era o que obrigava a rolar meia dúzia de ecrãs
              para chegar aos serviços. */}
          <div style={{ display: 'flex', gap: 2, marginTop: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {ABAS.map(a => {
              const on = aba === a.id
              return (
                <button key={a.id} onClick={() => { setAba(a.id); setNewFor(null) }} style={{
                  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                  padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500,
                  color: on ? 'var(--ink)' : 'var(--ink-4)',
                  borderBottom: `2px solid ${on ? ACCENT : 'transparent'}`,
                }}>
                  <Icon name={a.icon} size={14} color={on ? ACCENT : 'var(--ink-5)'} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {faltaSprint143 && aba !== 'roupa' && aba !== 'servicos' && (
          <AvisoDeSetup codigo="PHX-T3" oQue="Os vários tipos de transporte ainda não estão disponíveis nesta conta — por agora tudo funciona como circuito diário." />
        )}

        {/* ══ CASA ↔ CENTRO ═══════════════════════════════════════════════ */}
        {aba === 'circuito' && (
          <>
            {/* A hora de partida. A ÚNICA hora que alguém escreve. */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
              {circuitos.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {circuitos.map(c => (
                    <button key={c.id} onClick={() => setCircuitoId(c.id)} style={pilula(circuitoAtivo?.id === c.id)}>{c.nome}</button>
                  ))}
                </div>
              )}

              {!circuitoAtivo ? (
                <div>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: '56ch' }}>
                    Ainda não há circuito. Cria um e diz só a que horas a carrinha sai —
                    a hora a que chega a cada porta é calculada a partir da rota, com os tempos
                    de estrada reais. Ninguém tem de adivinhar horas pessoa a pessoa.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap' }}>
                    <button onClick={() => criarCircuito('recolha')} disabled={faltaSprint143} style={botaoSolido(ACCENT, faltaSprint143)}>Criar a recolha da manhã</button>
                    <button onClick={() => criarCircuito('entrega')} disabled={faltaSprint143} style={botaoVazio(faltaSprint143)}>Criar a entrega da tarde</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <div style={rotulo}>A carrinha sai às</div>
                    <input type="time" value={circuitoAtivo.hora_partida}
                      onChange={e => guardarCircuito(circuitoAtivo.id, { hora_partida: e.target.value })}
                      disabled={!scope.canEdit}
                      style={{ ...campo, width: 118, fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <div>
                    <div style={rotulo}>A cada porta</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input type="number" min={1} max={15} value={circuitoAtivo.minutos_paragem}
                        onChange={e => guardarCircuito(circuitoAtivo.id, { minutos_paragem: Math.max(1, Math.min(15, Number(e.target.value) || 3)) })}
                        disabled={!scope.canEdit} style={{ ...campo, width: 68 }} />
                      <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>minutos</span>
                    </div>
                  </div>
                  {circuitoComHoras && (
                    <div style={{ flex: '1 1 190px' }}>
                      <div style={rotulo}>De volta por volta das</div>
                      <div style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ACCENT }}>
                        {circuitoComHoras.regresso}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.45 }}>
                        {circuitoComHoras.minutosTotal} min no total
                        {circuitoComHoras.aproximado ? ' · estimativa, ainda sem tempos de estrada reais' : ' · com os tempos de estrada reais'}
                      </div>
                    </div>
                  )}
                  {circuitos.length === 1 && scope.canEdit && (
                    <button onClick={() => criarCircuito(circuitoAtivo.direcao === 'recolha' ? 'entrega' : 'recolha')} style={botaoVazio(false)}>
                      + {circuitoAtivo.direcao === 'recolha' ? 'entrega da tarde' : 'recolha da manhã'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* O mapa e a sequência */}
            {!loading && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px 16px' }}>
                {semMoradaCasa && (
                  <div style={{ marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, flex: '1 1 240px' }}>
                      A instituição ainda não tem coordenadas — sem elas a rota não começa nem acaba na casa.
                      {' '}<a href="/equipa?tab=definicoes" style={{ color: 'var(--ink)', fontWeight: 600 }}>Confirma a morada</a>, ou converte-a agora.
                    </span>
                    <button onClick={converterCasa} disabled={aConverterCasa} style={botaoVazio(aConverterCasa)}>
                      {aConverterCasa ? 'a converter…' : 'Converter a morada da casa'}
                    </button>
                  </div>
                )}

                <MapaLeaflet
                  rota={rotaParaMostrar}
                  casa={casaGeo}
                  cor={ACCENT}
                  marcar={(id: string) => { const sc = schedules.find(x => x.id === id); if (sc) toggle(sc) }}
                  podeEditar={scope.canEdit}
                  calculada={calculada}
                  aCalcular={aCalcular}
                  otimizar={() => calcularRota(true)}
                />

                {rotaParaMostrar.paragens.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={rotulo}>A sequência do carro</div>
                      <button onClick={() => folhaDoMotorista(nomeCasa || 'Transportes', today, rotaParaMostrar)} style={botaoVazio(false)}>
                        Folha do motorista
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {rotaParaMostrar.paragens.map((pg, i) => {
                        const done = pg.feito
                        return (
                          <div key={pg.scheduleId} style={{
                            display: 'flex', alignItems: 'center', gap: 11,
                            background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 9, padding: '9px 12px',
                          }}>
                            <input type="checkbox" checked={done} onChange={() => { const sc = schedules.find(x => x.id === pg.scheduleId); if (sc) toggle(sc) }} style={{ width: 17, height: 17, flexShrink: 0 }} />
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700,
                              color: done ? '#16a34a' : ACCENT, minWidth: 46,
                            }}>{pg.hora || `${i + 1}.`}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', opacity: done ? 0.6 : 1, textDecoration: done ? 'line-through' : 'none' }}>
                              {pg.nome}
                              {pg.morada ? <span style={{ color: 'var(--ink-4)', fontSize: 12.5 }}> · {pg.morada}</span> : null}
                            </span>
                            <button onClick={() => removeSchedule(pg.scheduleId)} aria-label="Tirar do circuito" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15, flexShrink: 0 }}>×</button>
                          </div>
                        )
                      })}
                    </div>
                    {circuitoComHoras && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 10, lineHeight: 1.55, maxWidth: '62ch' }}>
                        As horas são calculadas a partir da hora de partida e do tempo de estrada entre
                        cada porta. São uma estimativa boa, não uma promessa — o trânsito é do trânsito.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quem anda no circuito */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={rotulo}>Quem anda neste circuito</div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`} style={{ ...campo, width: 210 }} />
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 10 }} />)}</div>
              ) : filtered.length === 0 ? (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>{cfg.emptyPeopleMsg}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map(pp => {
                    const seus = doCircuito.filter(x => x.patient_id === pp.id)
                    const isNew = newFor === pp.id
                    const semMorada = !pp.address
                    return (
                      <div key={pp.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{pp.name}</span>
                            {semMorada && <span style={{ fontSize: 11, color: '#b45309', marginLeft: 8 }}>sem morada na ficha</span>}
                          </div>
                          <button onClick={() => isNew ? setNewFor(null) : openNew(pp.id)} style={{
                            padding: '6px 12px', background: isNew ? 'var(--bg-3)' : 'var(--ink)', color: isNew ? 'var(--ink-3)' : 'white',
                            border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                          }}>{isNew ? 'Fechar' : seus.length ? '+ Outro' : '+ Pôr no circuito'}</button>
                        </div>

                        {seus.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                            {seus.map(sc => (
                              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                                <Icon name="route" size={14} color="var(--ink-4)" />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)' }}>{sc.label}</span>
                                {!sc.weekdays && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>diário</span>}
                                <button onClick={() => removeSchedule(sc.id)} aria-label="Tirar do circuito" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {isNew && (
                          <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: Recolha ao domicílio" style={campo} />
                            <div>
                              <div style={rotulo}>Em que dias</div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <button onClick={() => setNewDays(null)} style={pilula(newDays === null)}>Todos os dias</button>
                                {WEEKDAY_LABELS.map((label, d) => (
                                  <button key={d} onClick={() => toggleDay(d)} style={pilula(!!newDays?.includes(d))}>{label}</button>
                                ))}
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.5, maxWidth: '54ch' }}>
                              Sem hora, de propósito: neste circuito o carro sai às {circuitoAtivo?.hora_partida || '08:00'} e
                              a hora de chegada a cada porta sai da rota.
                            </div>
                            {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
                            <button onClick={() => createSchedule('circuito')} disabled={saving || !newLabel.trim()} style={{
                              alignSelf: 'flex-start', padding: '8px 16px',
                              background: saving || !newLabel.trim() ? 'var(--bg-3)' : 'var(--ink)',
                              color: saving || !newLabel.trim() ? 'var(--ink-4)' : 'white',
                              border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
                              cursor: saving || !newLabel.trim() ? 'not-allowed' : 'pointer',
                            }}>{saving ? 'A guardar…' : 'Pôr no circuito'}</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ CONSULTAS · PASSEIOS · PONTUAIS ═════════════════════════════ */}
        {(aba === 'consulta' || aba === 'passeio' || aba === 'pontual') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={rotulo}>{aba === 'pontual' ? 'Pedidos' : 'Hoje'}</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`} style={{ ...campo, width: 210 }} />
            </div>
            {loading
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 10 }} />)}</div>
              : quadroPorPessoa(aba)}
          </>
        )}

        {/* ══ ROUPA ═══════════════════════════════════════════════════════ */}
        {aba === 'roupa' && (
          <RecurringServiceBoard title="Roupa recorrente" kinds={[{ id: 'roupa', label: 'Roupa' }]} icon="shirt" patients={patients} search={search} />
        )}

        {/* ══ OUTROS SERVIÇOS ═════════════════════════════════════════════ */}
        {aba === 'servicos' && (
          <>
            <RecurringServiceBoard title="Fim de semana / noite" kinds={[
              { id: 'higiene_fds', label: 'Higiene · fim de semana' },
              { id: 'alimentacao_fds', label: 'Alimentação · fim de semana' },
              { id: 'reforco_noite', label: 'Reforço alimentar · noite (2ª-6ª)' },
            ]} icon="clock" patients={patients} search={search} />

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={rotulo}>Pedidos avulsos</div>
                <button onClick={() => setShowNewSvc(v => !v)} style={botaoVazio(false)}>{showNewSvc ? 'Cancelar' : '+ Novo pedido'}</button>
              </div>

              {showNewSvc && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setNewSvcKind('roupa')} style={pilula(newSvcKind === 'roupa')}>Tratamento de roupa</button>
                    <button onClick={() => setNewSvcKind('outro')} style={pilula(newSvcKind === 'outro')}>Outro</button>
                  </div>
                  <select value={newSvcPatient} onChange={e => setNewSvcPatient(e.target.value)} style={campo}>
                    <option value="">Sem {cfg.personNoun.toLowerCase()} associado</option>
                    {patients.map(pp => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
                  </select>
                  <input value={newSvcNotes} onChange={e => setNewSvcNotes(e.target.value)} placeholder="Detalhe (opcional)" style={campo} />
                  <button onClick={createService} disabled={svcSaving} style={botaoSolido(ACCENT, svcSaving)}>
                    {svcSaving ? 'A publicar…' : 'Publicar pedido'}
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {svcColumns.map(colStatus => {
                  const items = services.filter(sv => sv.status === colStatus)
                  return (
                    <div key={colStatus}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: STATUS_META[colStatus].color, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
                        {STATUS_META[colStatus].label} ({items.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {items.length === 0 && <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', color: 'var(--ink-5)', fontSize: 12 }}>Nada aqui.</div>}
                        {items.map(sv => (
                          <div key={sv.id} style={{ background: STATUS_META[sv.status].bg, border: `1px solid ${STATUS_META[sv.status].color}33`, borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                                <Icon name={sv.kind === 'roupa' ? 'shirt' : 'package'} size={14} color="var(--ink)" /> {sv.kind === 'roupa' ? 'Tratamento de roupa' : 'Outro'}
                              </div>
                              <button onClick={() => removeService(sv.id)} aria-label="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15, padding: 0 }}>×</button>
                            </div>
                            {nameOf(sv.patient_id) && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{nameOf(sv.patient_id)}</div>}
                            {sv.notes && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{sv.notes}</div>}
                            <button onClick={() => advanceService(sv)} style={{ marginTop: 8, padding: '5px 11px', background: 'white', border: `1px solid ${STATUS_META[sv.status].color}`, color: STATUS_META[sv.status].color, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              {sv.status === 'pedido' ? 'Assumir →' : 'Concluir ✓'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Alguns estilos repetidos, num sítio só ──────────────────────────────────
const campo: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 11px',
  fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none',
  boxSizing: 'border-box', minWidth: 0, maxWidth: '100%',
}
const rotulo: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
}
const pilula = (on: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', border: `1.5px solid ${on ? 'var(--ink)' : 'var(--border)'}`,
  background: on ? 'var(--ink)' : 'white', color: on ? 'white' : 'var(--ink-4)',
})
const botaoSolido = (cor: string, ocupado: boolean): React.CSSProperties => ({
  alignSelf: 'flex-start', padding: '9px 16px', background: ocupado ? 'var(--bg-3)' : cor,
  color: ocupado ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8,
  fontSize: 12.5, fontWeight: 700, cursor: ocupado ? 'wait' : 'pointer', fontFamily: 'inherit',
})
const botaoVazio = (ocupado: boolean): React.CSSProperties => ({
  minHeight: 34, padding: '0 13px', borderRadius: 8, border: '1px solid var(--border-2)',
  background: 'var(--bg)', color: 'var(--ink-3)', fontSize: 12, fontWeight: 600,
  cursor: ocupado ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
})

// ─── Quadro de serviço recorrente genérico ──────────────────────────────────
// Novo 2026-08-11 — mesma forma que "Transportes recorrentes" acima (uma
// coisa que se repete em certos dias, um toque marca feito), mas sobre a
// tabela nova support_recurring_services/logs (sprint131) e parametrizável
// por "kind" — serve tanto para roupa recorrente como para os serviços de
// fim de semana/noite, sem duplicar a lógica três vezes.
interface RecPatient { id: string; name: string; room_number?: string | null }
interface RecSchedule { id: string; patient_id: string; kind: string; label: string | null; weekdays: number[] | null; time: string | null }
interface RecLog { id: string; schedule_id: string; date: string; done: boolean }

function RecurringServiceBoard({ title, kinds, icon, patients, search }: {
  title: string; kinds: { id: string; label: string }[]; icon: string; patients: RecPatient[]; search: string
}) {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()
  const kindIds = kinds.map(k => k.id)

  const [schedules, setSchedules] = useState<RecSchedule[]>([])
  const [logs, setLogs] = useState<RecLog[]>([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newFor, setNewFor] = useState<string | null>(null)
  const [newKind, setNewKind] = useState(kindIds[0])
  const [newLabel, setNewLabel] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newDays, setNewDays] = useState<number[] | null>(kindIds[0] === 'roupa' ? null : [0, 6])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Em série e não em paralelo de propósito: se a primeira tabela não existe,
    // a segunda também não vale a pena — disparar as duas ao mesmo tempo só
    // garante um 400 extra na consola a cada carregamento, ruído que esconde os
    // erros a sério de quem anda a procurar problemas.
    //
    // E as DUAS têm de ser verificadas: a migração pode ter sido aplicada só
    // pela metade (foi o que aconteceu — support_recurring_services existia e
    // support_recurring_logs não), e a guarda que só olhava para a primeira
    // deixava a segunda falhar em silêncio a cada visita.
    const emFalta = (e: any) => !!e && /does not exist|schema cache/i.test(e.message || '')
    const sch = await scope.filter(supabase.from('support_recurring_services').select('id,patient_id,kind,label,weekdays,time')).in('kind', kindIds).eq('active', true)
    if (emFalta(sch.error)) { setNeedsSetup(true); setLoading(false); return }
    // SEM scope.filter aqui, de propósito: esta tabela não tem coluna
    // `org_id` (o acesso herda-se pelo join ao serviço — ver sprint131), e o
    // scope.filter acrescentava `org_id = …` a uma coluna que não existe. O
    // PostgREST devolvia "column does not exist", o código lia isso como
    // migração em falta e a página mostrava o código PHX-L2 com o sprint131
    // já aplicado. A RLS já garante que só voltam as linhas desta casa.
    const lgs = await supabase.from('support_recurring_logs').select('id,schedule_id,date,done').eq('date', today)
    if (emFalta(lgs.error)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setSchedules(sch.data || [])
    setLogs(lgs.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  function todaysFor(patientId: string) { return schedules.filter(s => s.patient_id === patientId && (!s.weekdays || s.weekdays.includes(todayWeekday))) }
  function logFor(scheduleId: string) { return logs.find(l => l.schedule_id === scheduleId) }
  function kindLabel(kind: string) { return kinds.find(k => k.id === kind)?.label || kind }

  async function toggle(s: RecSchedule) {
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(s.id)
    const nextDone = !existing?.done
    const { data, error } = await supabase.from('support_recurring_logs').upsert({
      schedule_id: s.id, patient_id: s.patient_id, date: today,
      done: nextDone, done_by_id: nextDone ? user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }, { onConflict: 'schedule_id,date' }).select().single()
    if (error) { toast.error('Não foi possível atualizar', reportError('recurring-service-toggle', error, MSG.save)); return }
    setLogs(p => { const rest = p.filter(l => l.schedule_id !== s.id); return data ? [...rest, data] : rest })
  }

  function openNew(patientId: string) { setNewFor(patientId); setNewKind(kindIds[0]); setNewLabel(''); setNewTime(''); setNewDays(kindIds[0] === 'roupa' ? null : [0, 6]) }
  function toggleDay(d: number) { setNewDays(prev => { const base = prev || []; return base.includes(d) ? base.filter(x => x !== d) : [...base, d].sort() }) }

  async function createSchedule() {
    if (!newFor) return
    setSaving(true)
    const { error } = await supabase.from('support_recurring_services').insert(scope.stamp({
      user_id: user.id, patient_id: newFor, kind: newKind, label: newLabel.trim().slice(0, 120) || null,
      weekdays: newDays, time: newTime || null, active: true, recorded_by_id: user.id,
    }))
    setSaving(false)
    if (error) { toast.error('Não foi possível criar', reportError('recurring-service-create', error, MSG.save)); return }
    setNewFor(null); load()
  }
  async function removeSchedule(id: string) {
    if (!confirm('Deixar de repetir este serviço?')) return
    const { error } = await supabase.from('support_recurring_services').update({ active: false }).eq('id', id)
    if (error) { toast.error('Não foi possível remover', reportError('recurring-service-remove', error, MSG.save)); return }
    load()
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const anyScheduled = schedules.length > 0

  if (needsSetup) {
    return (
      <AvisoDeSetup codigo="PHX-L2" oQue="Esta parte dos serviços recorrentes ainda não está disponível nesta conta." />
    )
  }

  if (loading) return <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      {!anyScheduled && !newFor ? (
        <div style={{ background: 'white', border: '1px dashed var(--border)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Nada agendado ainda. Escolha {kinds.length === 1 ? 'a pessoa' : 'a pessoa e o tipo'} abaixo.
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => {
          const todays = todaysFor(p.id)
          const isNew = newFor === p.id
          return (
            <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                <button onClick={() => isNew ? setNewFor(null) : openNew(p.id)} style={{ padding: '6px 12px', background: isNew ? 'var(--bg-3)' : 'var(--ink)', color: isNew ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {isNew ? 'Fechar' : '+ Adicionar'}
                </button>
              </div>
              {todays.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {todays.map(s => {
                    const done = !!logFor(s.id)?.done
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: done ? '#f0fdf4' : 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>
                        <input type="checkbox" checked={done} onChange={() => toggle(s)} style={{ width: 17, height: 17 }} />
                        <Icon name={icon} size={14} color={done ? '#16a34a' : 'var(--ink-4)'} />
                        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
                          {kindLabel(s.kind)}{s.label ? ` · ${s.label}` : ''}{s.time ? ` · ${s.time}` : ''}
                        </span>
                        <button onClick={() => removeSchedule(s.id)} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 15 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}
              {isNew && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kinds.length > 1 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {kinds.map(k => (
                        <button key={k.id} onClick={() => setNewKind(k.id)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newKind === k.id ? 'var(--ink)' : 'var(--border)'}`, background: newKind === k.id ? 'var(--ink)' : 'white', color: newKind === k.id ? 'white' : 'var(--ink-4)' }}>{k.label}</button>
                      ))}
                    </div>
                  )}
                  <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nota (opcional)"
                    style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} placeholder="Hora (opcional)"
                    style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', width: 130 }} />
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Quando</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => setNewDays(null)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays === null ? 'var(--ink)' : 'var(--border)'}`, background: newDays === null ? 'var(--ink)' : 'white', color: newDays === null ? 'white' : 'var(--ink-4)' }}>Todos os dias</button>
                      {WEEKDAY_LABELS.map((label, d) => (
                        <button key={d} onClick={() => toggleDay(d)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${newDays?.includes(d) ? 'var(--ink)' : 'var(--border)'}`, background: newDays?.includes(d) ? 'var(--ink)' : 'white', color: newDays?.includes(d) ? 'white' : 'var(--ink-4)' }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={createSchedule} disabled={saving} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving ? 'var(--bg-3)' : 'var(--ink)', color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'A criar…' : 'Criar'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
