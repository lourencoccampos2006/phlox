'use client'

// /ronda-guiada — Ronda coordenada (lar / centro de dia).
// Vários funcionários fazem a ronda ao mesmo tempo: os utentes dividem-se por
// eles (cada um a UM só). Ao atender, o utente passa para quem o atendeu
// (transferência automática) e fica registado. Otimizado e mobile-first.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, currentShiftFor } from '@/lib/institutionConfig'
import { reportError } from '@/lib/clientError'
import { perfisDe } from '@/lib/perfisVisiveis'
import {
  avisosDe, avisoDaAnterior, oQueFicouDaAnterior, oQueFalta,
  vitaisPreenchidos, vitaisEmPalavras, foraDoEsperado, temVitais,
  CAMPOS_VITAIS, CORES as CORES_AVISO, type Aviso,
} from '@/lib/ronda'
import { registoEmCampos } from '@/lib/registoEmPalavras'
import { ehParaHoje } from '@/lib/plano'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso as Caixa, CAIXA, MONO, ROTULO,
} from '@/components/ui/mesa'

const ACCENT = 'var(--green)'
interface Assignment { id: string; patient_id: string; assigned_to: string; assigned_name: string; status: 'pending' | 'done' | 'skipped'; attended_by?: string | null; attended_name?: string | null; outcome?: string | null }
interface Member { user_id: string; name: string }
interface Patient { id: string; name: string }

const OUTCOMES = [
  { id: 'estavel', label: 'Estável', color: 'var(--green)', bg: 'var(--badge-green-bg)' },
  { id: 'vigiar', label: 'Vigiar', color: 'var(--amber)', bg: 'var(--badge-amber-bg)' },
  { id: 'alerta', label: 'Alerta', color: 'var(--red)', bg: 'var(--badge-red-bg)' },
]

export default function RondaCoordenadaPage() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [round, setRound] = useState<any>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [patients, setPatients] = useState<Record<string, Patient>>({})
  const [members, setMembers] = useState<Member[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [outcome, setOutcome] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [swipe, setSwipe] = useState(0)
  // O painel deixou de ser quatro listas e passou a ser tudo o que se precisa
  // de saber sobre a pessoa. `Record<string, any>` porque o que vem do
  // servidor sao linhas da base de dados, cada uma com a sua forma.
  const [panel, setPanel] = useState<Record<string, any> | null>(null)
  const [vitais, setVitais] = useState<Record<string, string>>({})
  const [aMedir, setAMedir] = useState(false)
  const [todosOsAvisos, setTodosOsAvisos] = useState(false)
  const [medBusy, setMedBusy] = useState<string>('')
  const [taskBusy, setTaskBusy] = useState<string>('')
  const [showEndSummary, setShowEndSummary] = useState(false)
  const touchStart = useRef<number | null>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const loadedOnce = useRef(false)
  const load = useCallback(async () => {
    if (!user) return
    if (!loadedOnce.current) setLoading(true)
    try {
      const r = await fetch('/api/rounds', { headers: await auth() }).then(r => r.json())
      if (r.needsSetup) { setNeedsSetup(true); setLoading(false); return }
      setRound(r.round || null); setAssignments(r.assignments || [])
      if (r.round) {
        const ids = (r.assignments || []).map((a: Assignment) => a.patient_id)
        if (ids.length) {
          const { data, error: erroLeitura } = await supabase.from('patients').select('id, name').in('id', ids)
          if (erroLeitura) reportError('ronda-patients', erroLeitura)
          const m: Record<string, Patient> = {}; (data || []).forEach((p: Patient) => { m[p.id] = p }); setPatients(m)
        }
      }
    } catch { setErr('Não foi possível carregar.') }
    setLoading(false); loadedOnce.current = true
  }, [user, auth, supabase])

  useEffect(() => { load() }, [load])

  // membros da equipa (para escolher com quem se faz a ronda)
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('active_org_id, org_id').eq('id', user.id).maybeSingle()
        const orgId = prof?.active_org_id || prof?.org_id
        if (!orgId) { setMembers([{ user_id: user.id, name: user.name || 'Eu' }]); setChosen(new Set([user.id])); return }
        const { data: mem } = await supabase.from('org_members').select('user_id').eq('org_id', orgId).eq('active', true)
        const ids = (mem || []).map((m: any) => m.user_id)
        // Por `perfisDe`, que lê a vista `perfis_visiveis` e não a tabela: para
        // escolher quem faz a ronda só é preciso o nome, e a `profiles`
        // devolvia o perfil inteiro — email, NIF, Stripe — a qualquer colega
        // (sprint168).
        const profs = await perfisDe(supabase, ids, 'id, name')
        const list = (profs || []).map((p: any) => ({ user_id: p.id, name: p.name || 'Colega' }))
        setMembers(list.length ? list : [{ user_id: user.id, name: user.name || 'Eu' }])
        setChosen(new Set([user.id]))
      } catch { setMembers([{ user_id: user.id, name: user.name || 'Eu' }]); setChosen(new Set([user.id])) }
    })()
  }, [user, supabase])

  // Tempo real: quando um colega atende, o utente sai da minha lista sem recarregar.
  useEffect(() => {
    if (!user || !round) return
    const ch = supabase.channel('round_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_assignments', filter: `round_id=eq.${round.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, round, supabase, load])

  async function startRound() {
    setBusy(true); setErr('')
    const participants = members.filter(m => chosen.has(m.user_id)).map(m => ({ id: m.user_id, name: m.name }))
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'start', participants }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    load()
  }
  async function attend(a: Assignment) {
    setBusy(true)
    // Os vitais so vao se estiverem mesmo preenchidos e dentro do possivel.
    // `vitaisPreenchidos` recusa 1200 de tensao: um engano de dedo gravado
    // fica na ficha para sempre e ninguem sabe de onde veio.
    const medidos = vitaisPreenchidos(vitais)
    const r = await fetch('/api/rounds', {
      method: 'POST', headers: await auth(),
      body: JSON.stringify({
        action: 'attend', assignment_id: a.id, outcome, note: note.trim() || null,
        vitals: temVitais(medidos) ? medidos : null,
      }),
    }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    setOutcome(null); setNote(''); setVitais({}); setAMedir(false); load()
  }
  async function confirmEndRound() {
    if (!round) return
    await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'end', id: round.id }) })
    setShowEndSummary(false); setRound(null); setAssignments([]); load()
  }

  // A MINHA fila: atribuídas a mim e ainda por fazer. (A pesquisa deixa atender
  // um utente de outro colega — ao atender, transfere-se para mim.)
  const mine = assignments.filter(a => a.assigned_to === user?.id && a.status === 'pending')
  const searchHits = search.trim()
    ? assignments.filter(a => a.status === 'pending' && (patients[a.patient_id]?.name || '').toLowerCase().includes(search.trim().toLowerCase()))
    : []
  const doneCount = assignments.filter(a => a.status === 'done').length
  const current = mine[0]
  const curName = current ? (patients[current.patient_id]?.name || cfg.personNoun) : ''

  // Carrega a medicação do utente atual (para dar medicação na ronda → /mar).
  const curPatientId = current?.patient_id
  useEffect(() => {
    if (!curPatientId) { setPanel(null); return }
    // Limpar ao mudar de pessoa. Sem isto, a tensao que se escreveu para a
    // Dona Maria ficava na caixa quando o cartao passava para o senhor
    // seguinte — e era gravada como dele.
    setVitais({}); setAMedir(false); setTodosOsAvisos(false)
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'panel', patient_id: curPatientId }) }).then(r => r.json())
        // Cada campo com o seu `|| []`: uma fonte que o servidor nao conseguiu
        // ler volta vazia, e o resto do painel aparece na mesma.
        const vazio = { meds: [], mar: [], tasks: [], taskLogs: [], feridas: [], ocorrencias: [], pedidos: [], registos: [], sos: [], tomasSos: [], acoesPlano: [], pessoa: null, anterior: null }
        if (!cancel) setPanel(r.error ? vazio : { ...vazio, ...r })
      } catch { if (!cancel) setPanel({ meds: [], mar: [], tasks: [], taskLogs: [], feridas: [], ocorrencias: [], pedidos: [], registos: [], sos: [], tomasSos: [], acoesPlano: [], pessoa: null, anterior: null }) }
    })()
    return () => { cancel = true }
  }, [curPatientId, auth])

  // Turno atual segundo a instituição (o centro de dia nunca tem "noite").
  // Enviamos SEMPRE o turno ao servidor para não haver duas verdades.
  const shiftNow = currentShiftFor(institution)

  // ── O que se sabe desta pessoa ────────────────────────────────────────────
  // Tudo isto sai do que ja estava guardado. Nenhum aviso e inferido: cada um
  // aponta a um campo que alguem preencheu, e o `title` diz qual — um aviso
  // que a equipa nao consegue explicar e um aviso em que deixa de acreditar.
  const avisos: Aviso[] = useMemo(() => {
    if (!panel?.pessoa) return []
    const base = avisosDe(panel.pessoa, {
      feridas: panel.feridas, ocorrencias: panel.ocorrencias, pedidos: panel.pedidos,
    })
    const daRonda = avisoDaAnterior(panel.anterior)
    return daRonda ? [daRonda, ...base] : base
  }, [panel])

  // Os criticos sempre; o resto atras de um toque. Um painel que grita com
  // toda a gente deixa de ser lido, e ai o que importa passa tambem.
  const avisosAMostrar = todosOsAvisos ? avisos
    : avisos.filter(a => a.nivel === 'critico').length ? avisos.filter(a => a.nivel === 'critico')
    : avisos.slice(0, 2)

  const daAnterior = oQueFicouDaAnterior(panel?.anterior)

  // O registo de hoje, de qualquer turno: a ronda da noite quer ver o que a
  // da manha escreveu. Junta-se tudo o que tiver sido preenchido.
  const camposDeHoje = useMemo(() => {
    const regs: any[] = panel?.registos || []
    if (!regs.length) return []
    const juntos = regs.reduce((acc: any, r: any) => ({
      ...acc,
      nutrition: { ...(acc.nutrition || {}), ...(r.nutrition || {}) },
      mood: { ...(acc.mood || {}), ...(r.mood || {}) },
      continence: { ...(acc.continence || {}), ...(r.continence || {}) },
      skin: { ...(acc.skin || {}), ...(r.skin || {}) },
      vitals: { ...(acc.vitals || {}), ...(r.vitals || {}) },
    }), {})
    const campos = registoEmCampos(juntos)
    const v = vitaisEmPalavras(juntos.vitals)
    return v ? [{ rotulo: 'Sinais vitais', valor: v }, ...campos] : campos
  }, [panel])

  // As acoes do plano que sao para HOJE. `ehParaHoje` e o mesmo motor de
  // cadencias que /o-dia usa — se aqui decidisse por conta propria, a mesma
  // acao aparecia num sitio e nao no outro.
  const acoesDeHoje = useMemo(
    () => (panel?.acoesPlano || []).filter((a: any) => {
      try { return ehParaHoje(a) } catch { return true }
    }),
    [panel],
  )
  // Uma acao ja feita hoje nao se mostra por fazer — senao a ronda da tarde
  // pedia outra vez o que a da manha ja fez.
  const acaoFeita = (id: string) =>
    (panel?.execucoesPlano || []).some((e: any) => e.acao_id === id)


  // Quantas vezes o SOS ja foi dado hoje, por medicamento.
  const sosHoje = (medId: string) =>
    (panel?.tomasSos || []).filter((t: any) => t.med_id === medId).length
  const medGiven = (medId: string) => (panel?.mar || []).some((m: any) => m.med_id === medId && (m.status === 'administered' || m.status === 'given' || m.status === 'taken'))
  async function giveMed(medId: string) {
    if (!current) return
    setMedBusy(medId)
    const given = medGiven(medId)
    // otimista
    setPanel(p => p ? { ...p, mar: given ? p.mar.filter((m: any) => m.med_id !== medId) : [...p.mar, { med_id: medId, status: 'administered', shift: shiftNow }] } : p)
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'give_med', patient_id: current.patient_id, med_id: medId, shift: shiftNow }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    if (r.error) setPanel(p => p ? { ...p, mar: given ? [...p.mar, { med_id: medId, status: 'administered' }] : p.mar.filter((m: any) => m.med_id !== medId) } : p)
    setMedBusy('')
  }

  const taskDone = (checklistId: string) => !!(panel?.taskLogs || []).find((l: any) => l.checklist_id === checklistId)?.done
  async function toggleTask(checklistId: string) {
    if (!current) return
    setTaskBusy(checklistId)
    const wasDone = taskDone(checklistId)
    setPanel(p => p ? { ...p, taskLogs: wasDone ? p.taskLogs.filter((l: any) => l.checklist_id !== checklistId) : [...p.taskLogs, { checklist_id: checklistId, done: true }] } : p)
    const r = await fetch('/api/rounds', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'toggle_task', checklist_id: checklistId, patient_id: current.patient_id }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    if (r.error) setPanel(p => p ? { ...p, taskLogs: wasDone ? [...p.taskLogs, { checklist_id: checklistId, done: true }] : p.taskLogs.filter((l: any) => l.checklist_id !== checklistId) } : p)
    setTaskBusy('')
  }

  // «Falta 2 medicamentos e 1 cuidado.» Uma linha, por baixo do nome, para
  // quem faz a ronda saber ao chegar se ali ha muito ou pouco para fazer.
  //
  // Fica AQUI e nao la em cima ao pe dos outros derivados: `medGiven` e
  // `taskDone` sao `const`, e chamar-lhes antes da linha em que sao
  // declaradas rebenta a pagina inteira em execucao. O `tsc` passa; o browser
  // e que mostra.
  const resumoDoQueFalta = useMemo(() => {
    if (!panel) return ''
    return oQueFalta([
      ...(panel.meds || []).map((m: any) => ({ id: m.id, tipo: 'medicacao' as const, titulo: m.name, feita: medGiven(m.id) })),
      ...(panel.tasks || []).map((t: any) => ({ id: t.id, tipo: 'cuidado' as const, titulo: t.title, feita: taskDone(t.id) })),
      ...acoesDeHoje.map((a: any) => ({ id: a.id, tipo: 'plano' as const, titulo: a.o_que, feita: acaoFeita(a.id) })),
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, acoesDeHoje])

  function onTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientX }
  function onTouchMove(e: React.TouchEvent) { if (touchStart.current != null) setSwipe(e.touches[0].clientX - touchStart.current) }
  function onTouchEnd() { const dx = swipe; touchStart.current = null; setSwipe(0); if (dx > 90 && current) attend(current) }

  /* A MOLDURA DA RONDA — refeita (2026-10-07).
     Tinha 80px de cabeçalho: uma migalha em mono e um título em serifa de
     30px, por cima de uma barra lateral que já diz onde se está. Numa página
     que se usa de pé, a parte de cima do ecrã é a que mais importa.

     Ao contrário do resto da aplicação, a ronda NÃO fica densa: é uma pessoa
     de cada vez, com alvos grandes. Ver a nota do /guardiao — o que se aplica
     é a linguagem, não a densidade. */
  const shell = (children: React.ReactNode) => (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Ronda</span>
          {round && (
            <>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {doneCount} DE {assignments.length} FEITOS
              </span>
              <span style={{
                ...MONO, fontSize: 'var(--t-meta)',
                color: mine.length ? 'var(--amber)' : 'var(--green)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>{mine.length} NA MINHA FILA</span>
              <div style={{ marginLeft: 'auto' }}>
                <Botao feitio="calmo" onClick={() => setShowEndSummary(true)}>TERMINAR A RONDA</Botao>
              </div>
            </>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Quem atender fica com o registo</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Os avisos vêm das fichas, das feridas e da ronda anterior — nenhum é escrito aqui
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Caixa tom="mau">{err}</Caixa>}
      {children}
    </Mesa>
  )

  if (loading) return shell(<Painel><ACarregar oQue="A preparar a ronda…" /></Painel>)
  if (needsSetup) {
    console.error('[phlox:ronda-guiada] rounds tables not set up')
    return shell(
      <Painel>
        <Vazio titulo="As rondas coordenadas ainda não estão disponíveis nesta conta."
          oQueFazer="Fale connosco e ativamos. Entretanto, a ronda pode fazer-se pelo «O dia» e pelo registo do dia." />
      </Painel>
    )
  }

  if (!round) return shell(
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 20 }}>
      <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 6 }}>Quem faz a ronda?</div>
      <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: '0 0 14px' }}>Os {cfg.personNounPlural.toLowerCase()} dividem-se pelos escolhidos — cada um aparece a um só. Quem atender fica com o registo.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {members.map(m => {
          const on = chosen.has(m.user_id)
          return (
            <button key={m.user_id} onClick={() => setChosen(prev => { const n = new Set(prev); n.has(m.user_id) ? n.delete(m.user_id) : n.add(m.user_id); return n })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 'var(--r-lg)', border: `1.5px solid ${on ? ACCENT : 'var(--border)'}`, background: on ? 'var(--badge-green-bg)' : 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ width: 20, height: 20, borderRadius: 'var(--r)', border: `2px solid ${on ? ACCENT : 'var(--border-2)'}`, background: on ? ACCENT : 'white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any }}>{on ? '✓' : ''}</span>
              <span style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{m.name}{m.user_id === user?.id ? ' (eu)' : ''}</span>
            </button>
          )
        })}
      </div>
      <button onClick={startRound} disabled={busy || chosen.size === 0} style={{ width: '100%', padding: 13, background: chosen.size ? ACCENT : 'var(--border)', color: chosen.size ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: chosen.size ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{busy ? 'A preparar…' : `Começar ronda (${chosen.size})`}</button>
    </div>
  )

  const total = assignments.length
  return shell(
    <>
      {/* O contador subiu para a barra de trabalho, onde fica sempre à vista
          em vez de desaparecer ao rolar. Aqui fica só a forma. */}
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden', marginBottom: 14 }}><div style={{ height: '100%', width: `${total ? Math.round((doneCount / total) * 100) : 0}%`, background: ACCENT, borderRadius: 'var(--r-sm)', transition: 'width 0.3s' }} /></div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Atender outro utente (pesquisar)…" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 13px', fontSize: 'var(--t-corpo)', outline: 'none', background: 'white' }} />
        {searchHits.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            {searchHits.slice(0, 6).map(a => {
              const mineAlready = a.assigned_to === user?.id
              return (
                <button key={a.id} onClick={() => { setSearch(''); attend(a) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 13px', border: 'none', borderBottom: '1px solid var(--bg-3)', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ flex: 1, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)' }}>{patients[a.patient_id]?.name || 'Utente'}</span>
                  <span style={{ fontSize: 'var(--t-meta)', color: mineAlready ? 'var(--green)' : 'var(--amber)', fontWeight: 'var(--peso-forte)' as any }}>{mineAlready ? 'minha' : `de ${a.assigned_name?.split(' ')[0] || 'colega'} → atender`}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {mine.length === 0 ? (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 34, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--t-numero)', marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>A tua fila está feita</div>
          <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', marginTop: 4 }}>{total - doneCount > 0 ? `Faltam ${total - doneCount} com colegas — podes pesquisar para ajudar.` : 'Ronda completa!'}</div>
        </div>
      ) : (
        <>
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', transform: swipe ? `translateX(${swipe}px)` : undefined, transition: swipe ? 'none' : 'transform 0.25s', touchAction: 'pan-y' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bg-3)', background: 'var(--bg-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{curName}</div>
                  {resumoDoQueFalta && (
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>{resumoDoQueFalta}</div>
                  )}
                </div>
                <Link href={`/patients/${current.patient_id}`} style={{ fontSize: 'var(--t-meta)', color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none' }}>Ficha →</Link>
                <Link href={`/care-log?patient=${current.patient_id}`} style={{ fontSize: 'var(--t-meta)', color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none' }}>Registo do dia →</Link>
              </div>
            </div>

            {/* ── O QUE E PRECISO SABER ANTES DE FALAR COM A PESSOA ──────
                Isto e a mudanca que o Fernando pediu. Quem fazia a ronda
                entrava no quarto sem saber que aquela pessoa e alergica a
                penicilina, que bebe espessado, que tem uma ferida por fechar
                ou que na ronda das 14h ficou em alerta.

                Tudo isto ja estava guardado. Nenhum destes dados foi criado
                agora — o que faltava era ir busca-los. */}
            {avisos.length > 0 && (
              <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {avisosAMostrar.map(av => {
                    const c = CORES_AVISO[av.nivel]
                    return (
                      <div key={av.id} title={av.origem} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9,
                        padding: '8px 11px', borderRadius: 'var(--r-lg)',
                        background: c.fundo, border: `1px solid ${c.cor}33`,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: 'var(--r-sm)', background: c.cor,
                          marginTop: 6, flexShrink: 0,
                        }} />
                        <span style={{ flex: 1, fontSize: 'var(--t-dado)', fontWeight: av.nivel === 'critico' ? 700 : 600, color: c.cor, lineHeight: 1.45 }}>
                          {av.texto}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {/* Um painel com trinta linhas nao se le — fecha-se. So os
                    criticos ficam sempre a vista; o resto pede um toque. */}
                {avisos.length > avisosAMostrar.length && (
                  <button onClick={() => setTodosOsAvisos(true)} style={{
                    marginTop: 7, background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
                  }}>
                    mais {avisos.length - avisosAMostrar.length} — ver tudo
                  </button>
                )}
                {todosOsAvisos && avisos.length > 2 && (
                  <button onClick={() => setTodosOsAvisos(false)} style={{
                    marginTop: 7, background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--t-meta)', color: 'var(--ink-5)',
                  }}>mostrar menos</button>
                )}
              </div>
            )}

            {/* ── O QUE FICOU DA RONDA ANTERIOR ──────────────────────────
                A coisa que mais falta fazia e que era mais facil nao fazer.
                As 22h, saber que as 14h alguem escreveu «queixou-se do
                joelho» muda a ronda. Sem isto cada turno comeca do zero e a
                queixa perde-se entre pessoas. */}
            {daAnterior && (
              <div style={{ padding: '11px 20px', borderBottom: '1px solid var(--bg-3)', background: 'var(--bg-2)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Da ronda anterior</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.5 }}>{daAnterior}</div>
              </div>
            )}

            {/* ── JA REGISTADO HOJE ──────────────────────────────────────
                Passa por `registoEmPalavras`, que e o mesmo sitio que a ficha
                e o resumo a familia usam. Sem ele isto saia «[object
                Object]», que era o bug que ele reportou. */}
            {camposDeHoje.length > 0 && (
              <div style={{ padding: '11px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Já registado hoje</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                  {camposDeHoje.map(c => (
                    <span key={c.rotulo} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                      <span style={{ color: 'var(--ink-5)' }}>{c.rotulo}:</span> {c.valor}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medicação — dar a partir da ronda (escreve no /mar). */}
            {panel && panel.meds.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Medicação deste turno</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panel.meds.map((m: any) => {
                    const given = medGiven(m.id); const busyM = medBusy === m.id
                    return (
                      <button key={m.id} onClick={() => giveMed(m.id)} disabled={busyM}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', padding: '9px 11px', borderRadius: 'var(--r-lg)', cursor: busyM ? 'wait' : 'pointer',
                          border: `1.5px solid ${given ? 'var(--badge-green-border)' : 'var(--border)'}`, background: given ? 'var(--badge-green-bg)' : 'white', fontFamily: 'inherit' }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
                          border: `2px solid ${given ? 'var(--green)' : 'var(--border-2)'}`, background: given ? 'var(--green)' : 'white', color: 'white' }}>{given ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}><Icon name="pill" size={14} color="var(--green)" /> {m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
                          <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: given ? 'var(--green)' : 'var(--ink-5)' }}>{busyM ? 'A guardar…' : given ? 'Dada — toque para desmarcar' : (m.frequency || 'Toque para dar')}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Cuidados de hoje — fusão 2026-08-07 da aba "Cuidados" do /care-log:
                tarefas recorrentes (banho, higiene, mobilização) direto na ronda,
                sem ter de abrir outra ferramenta para riscar o que já se fez. */}
            {panel && panel.tasks.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Cuidados de hoje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panel.tasks.map((t: any) => {
                    const done = taskDone(t.id); const busyT = taskBusy === t.id
                    return (
                      <button key={t.id} onClick={() => toggleTask(t.id)} disabled={busyT}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%', padding: '9px 11px', borderRadius: 'var(--r-lg)', cursor: busyT ? 'wait' : 'pointer',
                          border: `1.5px solid ${done ? 'var(--badge-green-border)' : 'var(--border)'}`, background: done ? 'var(--badge-green-bg)' : 'white', fontFamily: 'inherit' }}>
                        <span style={{ width: 20, height: 20, borderRadius: 'var(--r)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
                          border: `2px solid ${done ? 'var(--green)' : 'var(--border-2)'}`, background: done ? 'var(--green)' : 'white', color: 'white' }}>{done ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>{t.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── SOS ────────────────────────────────────────────────────
                Nao e medicacao do turno: e «quando for preciso». Estava
                misturada com a do turno, o que a fazia parecer por dar.
                Aqui aparece a parte, com o motivo e quantas ja levou hoje —
                porque a pergunta na ronda e sempre «ja lhe deram alguma?». */}
            {panel && panel.sos.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Se for preciso (SOS)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {panel.sos.map((m: any) => {
                    const dadas = sosHoje(m.id)
                    const tecto = m.sos_max_dia || null
                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 11px', borderRadius: 'var(--r-lg)',
                        border: '1.5px solid var(--border)', background: 'var(--bg-2)',
                      }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>
                            {m.name}{m.dose ? ` · ${m.dose}` : ''}
                          </span>
                          {m.sos_para && (
                            <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                              para {m.sos_para}
                            </span>
                          )}
                        </span>
                        {/* O numero nunca bloqueia nada: diz. Quem decide dar
                            uma dose a mais e quem esta ali, e um ecra que
                            recusa fa-los dar na mesma e nao registar. */}
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', lineHeight: 1.1,
                          color: tecto && dadas >= tecto ? 'var(--amber)' : 'var(--ink-5)',
                        }}>
                          {dadas > 0 ? `${dadas} hoje` : 'nenhuma hoje'}{tecto ? ` · máx ${tecto}` : ''}
                        </span>
                        <Link href={`/patients/${current.patient_id}?aba=hoje`} style={{
                          fontSize: 'var(--t-meta)', color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}>Dar →</Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── O PLANO DE HOJE ────────────────────────────────────────
                As acoes do plano individual que caem hoje. `ehParaHoje` e o
                mesmo motor de cadencias que /o-dia usa: se a ronda decidisse
                por conta propria, a mesma acao aparecia num sitio e nao no
                outro, e a equipa deixava de confiar nos dois. */}
            {acoesDeHoje.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Do plano, para hoje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {acoesDeHoje.map((a: any) => {
                    const feita = acaoFeita(a.id)
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        fontSize: 'var(--t-dado)', color: feita ? 'var(--ink-5)' : 'var(--ink-3)',
                        textDecoration: feita ? 'line-through' : 'none',
                      }}>
                        <span style={{
                          width: 15, height: 15, borderRadius: 'var(--r)', flexShrink: 0,
                          display: 'grid', placeItems: 'center', fontSize: 'var(--t-micro)', color: 'white',
                          border: `1.5px solid ${feita ? 'var(--green)' : 'var(--border-2)'}`,
                          background: feita ? 'var(--green)' : 'white',
                        }}>{feita ? '✓' : ''}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>{a.o_que}</span>
                        {a.quem && (
                          <span style={{ fontSize: 'var(--t-meta)', color: 'var(--border-2)' }}>{a.quem}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <Link href={`/patients/${current.patient_id}?aba=plano`} style={{
                  display: 'inline-block', marginTop: 8, fontSize: 'var(--t-meta)',
                  color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none',
                }}>Abrir o plano →</Link>
              </div>
            )}

            {/* ── SINAIS VITAIS ──────────────────────────────────────────
                Fechado por omissao: a maior parte das rondas nao mede nada, e
                seis caixas sempre abertas fazem o painel parecer um
                formulario. Abre-se com um toque. */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-3)' }}>
              {!aMedir ? (
                <button onClick={() => setAMedir(true)} style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: ACCENT,
                }}>+ Medir sinais vitais</button>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Sinais vitais</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
                    {CAMPOS_VITAIS.map(c => {
                      const cru = vitais[c.id] || ''
                      const n = Number(cru.replace(',', '.'))
                      const aviso = cru && Number.isFinite(n) ? foraDoEsperado(c.id, n) : null
                      const impossivel = !!cru && (!Number.isFinite(n) || n < c.min || n > c.max)
                      return (
                        <div key={c.id}>
                          <label style={{ display: 'block', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', marginBottom: 3 }}>
                            {c.rotulo}
                          </label>
                          <input value={cru} inputMode="decimal"
                            onChange={e => setVitais(v => ({ ...v, [c.id]: e.target.value }))}
                            placeholder={c.unidade}
                            style={{
                              width: '100%', boxSizing: 'border-box', padding: '8px 9px',
                              borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-mono)',
                              border: `1.5px solid ${impossivel ? 'var(--red)' : aviso ? 'var(--amber)' : 'var(--border)'}`,
                              background: impossivel ? 'var(--badge-red-bg)' : 'white',
                            }} />
                          {/* Um valor impossivel avisa ANTES de se gravar. Um
                              engano de dedo (1200 em vez de 120) gravado fica
                              na ficha para sempre e ninguem sabe de onde veio. */}
                          {impossivel ? (
                            <span style={{ display: 'block', fontSize: 'var(--t-micro)', color: 'var(--red)', marginTop: 2 }}>
                              fora do possível — não vai ser guardado
                            </span>
                          ) : aviso ? (
                            <span style={{ display: 'block', fontSize: 'var(--t-micro)', color: 'var(--amber)', marginTop: 2 }}>
                              {aviso}
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Como está</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                {OUTCOMES.map(o => (
                  <button key={o.id} onClick={() => setOutcome(outcome === o.id ? null : o.id)} style={{ padding: '13px 8px', borderRadius: 'var(--r-xl)', cursor: 'pointer', fontFamily: 'inherit', border: `2px solid ${outcome === o.id ? o.color : 'var(--border)'}`, background: outcome === o.id ? o.bg : 'white', color: outcome === o.id ? o.color : 'var(--ink-3)', fontSize: 'var(--t-corpo)', fontWeight: outcome === o.id ? 700 : 600 }}>{o.label}</button>
                ))}
              </div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Nota rápida (opcional)…" style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '11px 13px', fontSize: 'var(--t-corpo)', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => { setOutcome(null); setNote('') }} style={{ flex: 1, padding: 14, background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-4)' }}>Limpar</button>
            <button onClick={() => current && attend(current)} disabled={busy} style={{ flex: 2, padding: 14, background: ACCENT, color: 'white', border: 'none', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{busy ? 'A guardar…' : 'Registar e seguinte →'}</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>Arraste o cartão → para registar</div>
        </>
      )}

      {/* Resumo de turno ao terminar — antes só um confirm() sem contexto. */}
      {showEndSummary && (() => {
        const byOutcome: Record<string, number> = {}
        assignments.filter(a => a.status === 'done').forEach(a => { const o = (a as any).outcome || 'sem_estado'; byOutcome[o] = (byOutcome[o] || 0) + 1 })
        const alertCount = byOutcome['alerta'] || 0
        const pending = total - doneCount
        return (
          <div onClick={e => { if (e.target === e.currentTarget) setShowEndSummary(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,24,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 24, width: '100%', maxWidth: 420 }}>
              <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 4 }}>Resumo do turno</div>
              <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: '0 0 16px' }}>Confirma antes de terminar a ronda.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-dado)' }}><span style={{ color: 'var(--ink-4)' }}>Atendidos</span><b>{doneCount}/{total}</b></div>
                {OUTCOMES.map(o => byOutcome[o.id] ? (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-dado)' }}><span style={{ color: o.color, fontWeight: 'var(--peso-forte)' as any }}>{o.label}</span><b>{byOutcome[o.id]}</b></div>
                ) : null)}
                {pending > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-dado)' }}><span style={{ color: 'var(--amber)' }}>Por atender</span><b>{pending}</b></div>}
              </div>
              {alertCount > 0 && (
                <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-lg)', padding: '10px 13px', fontSize: 'var(--t-meta)', color: 'var(--red)', marginBottom: 16 }}>
                  {alertCount} {alertCount === 1 ? 'utente marcado' : 'utentes marcados'} como "Alerta" — confirma que o turno seguinte sabe.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowEndSummary(false)} style={{ flex: 1, padding: 12, background: 'white', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink-4)' }}>Continuar ronda</button>
                <button onClick={confirmEndRound} style={{ flex: 1, padding: 12, background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'inherit' }}>Terminar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
