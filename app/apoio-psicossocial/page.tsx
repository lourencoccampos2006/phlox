'use client'

// /apoio-psicossocial — NOVO 2026-08-11. Auditoria direta contra o serviço
// "orienta o cliente e/ou o seu responsável através do apoio psico-social e
// encaminha para profissionais especializados os casos mais complexos" de um
// centro de dia real: não existia NADA disto no Phlox — sem tabela, sem
// página. supabase/sprint130_diabetic_prep_psychosocial.sql
// (psychosocial_notes) — por aplicar.
//
// DECISÃO DO FERNANDO 2026-08-11: só a equipa vê isto. Nunca em
// app/api/family-portal/route.ts, nunca em /perfil, nunca em /familia — dados
// sensíveis, a abrir com calma mais tarde se fizer sentido.
//
// Sinal automático (não é IA, é aritmética simples sobre care_records.mood.level,
// já registado em cada turno): destaca quem teve humor baixo persistente nos
// últimos 14 dias — uma SUGESTÃO de rever, nunca uma nota criada sozinha.
//
// ÍNDICE DE EROSÃO (Módulo 5, 2026-08-16): ao limiar estático acima juntou-se
// deteção de QUEDA DE PADRÃO (lib/trendSignals psychosocialErosion) — humor,
// apetite e participação em atividades comparados com o próprio hábito da
// pessoa (baseline 14 dias vs. últimos 7). Os dois apanham coisas diferentes
// e por isso coexistem: o limiar apanha quem está sempre em baixo; a erosão
// apanha quem ESTÁ A CAIR mas ainda não chegou lá (ex.: ia a todas as
// atividades, passou a ir a uma) — esse era invisível até agora.

// ── DE «FALEI COM ELE» A UM PROCESSO (2026-10-14) ──────────────────────────
// «No apoio-psicossocial não pode só ser um botão de "falei com ele", tem de
//  ter notas sobre a pessoa. (…) O trabalho da psicóloga no centro de dia e
//  lares deve de ser facilitado com o Phlox, para ter uma ferramenta super
//  complexa onde consiga meter notas, documentos, análises, pesquisas, etc, e
//  tudo super organizado.» (Fernando)
//
// O que havia eram notas de acompanhamento e encaminhamentos: serve para
// registar que se falou com alguém, não para ACOMPANHAR alguém. O processo —
// a avaliação inicial, a rede de apoio, a história, o plano, as sessões com
// data e duração, e as escalas aplicadas com as respostas guardadas — está em
// components/institution/ProcessoPsicossocial e em supabase/sprint186.
//
// A lista continua a ser esta página, porque a pergunta de quem abre isto
// continua a ser a mesma: com quem é que eu tenho de falar hoje.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'
import { loadTrends } from '@/lib/sentinel'
import { ptDate } from '@/lib/ptTime'
import { psychosocialErosion, type ResidentTrend, type ErosionResult } from '@/lib/trendSignals'
import { SEVERITY_STYLE } from '@/lib/residentSignals'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import ProcessoPsicossocial from '@/components/institution/ProcessoPsicossocial'
import { quemEstaSozinho, type SinalDeIsolamento } from '@/lib/psicossocial'
import { registar } from '@/lib/registo'
import { iniciais, corDaPessoa } from '@/lib/presenca'

interface Patient { id: string; name: string; room_number: string | null }
interface Note {
  id: string; patient_id: string; date: string; note: string
  referred_to: string | null; referral_status: string | null; referral_date: string | null
  created_at: string
}

const REFERRAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sugerido:  { label: 'Sugerido',  color: 'var(--ink-4)', bg: 'var(--bg-2)' },
  agendado:  { label: 'Agendado',  color: 'var(--amber)', bg: 'var(--badge-amber-bg)' },
  em_curso:  { label: 'Em curso',  color: 'var(--ink-2)', bg: 'var(--bg-2)' },
  concluido: { label: 'Concluído', color: 'var(--green)', bg: 'var(--badge-green-bg)' },
}
const REFERRAL_OPTIONS = ['Psicologia', 'Psiquiatria', 'Assistente Social (externo)', 'Terapia Ocupacional', 'Outro especialista']

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Aviso, Campo, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function ApoioPsicossocialPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('avaliacoes', 'editar')
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [moodFlags, setMoodFlags] = useState<Set<string>>(new Set())
  const [trends, setTrends] = useState<Record<string, ResidentTrend>>({})
  const [ultimoContacto, setUltimoContacto] = useState<Record<string, string>>({})
  const [aRegistar, setARegistar] = useState('')

  /** "Falei com esta pessoa hoje" — um toque. Grava uma nota curta e o relógio
   *  do silêncio volta a zero. Sem isto, a única forma de dizer que se falou
   *  com alguém era escrever uma nota inteira, e por isso ninguém dizia. */
  async function registarContacto(pid: string, nome: string) {
    if (!podeEditar) { alert('A sua conta é só de leitura.'); return }
    setARegistar(pid)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('psychosocial_notes').insert(scope.stamp({
      // A coluna chama-se `note` (não `content`), e não existe `kind` nesta
      // tabela — ver sprint130. Era isto que fazia o botão dar erro.
      user_id: user.id, patient_id: pid, date: hoje,
      note: 'Contacto de acompanhamento — conversa registada sem nota detalhada.',
    }))
    setARegistar('')
    if (error) { alert('Não foi possível registar agora.'); return }
    setUltimoContacto(u => ({ ...u, [pid]: hoje }))
    registar({ supabase, scope, user }, {
      action: 'psicossocial.contacto', entity: 'patient',
      summary: `Falou com ${nome} (acompanhamento psico-social).`,
      subjectId: pid, subjectName: nome, entityId: pid,
    })
    load()
  }
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const largo = useLargo()
  const [soSilencio, setSoSilencio] = useState(false)
  const [search, setSearch] = useState('')
  const [openFor, setOpenFor] = useState<string | null>(null)
  /* Quem a casa deixou de ver. Calculado, nunca perguntado — ver a nota em
     lib/psicossocial: ninguém diz que está sozinho. */
  const [sozinhos, setSozinhos] = useState<SinalDeIsolamento[]>([])
  const [verSozinhos, setVerSozinhos] = useState(false)

  const [newNote, setNewNote] = useState('')
  const [newReferTo, setNewReferTo] = useState('')
  const [newReferStatus, setNewReferStatus] = useState('')
  const [newReferDate, setNewReferDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    /* `ptDate()` e nao `toISOString`: a hora de Portugal e a que conta num
       calculo de «ha quantos dias». Com o `toISOString`, entre a meia-noite e
       a uma da manha o dia saia o anterior e toda a gente parecia um dia mais
       isolada. */
    const hojePt = ptDate()
    const [pats, nts, cr, fam, vis, ativ] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('psychosocial_notes').select('*')).order('date', { ascending: false }),
      scope.filter(supabase.from('care_records').select('patient_id,mood')).gte('date', since14),
      // ── Isolamento: há quanto tempo ninguém contacta esta pessoa ────────
      // O que faltava aqui não era mais um sítio para escrever uma nota — era
      // saber A QUEM ir falar. Duas fontes reais: a última conversa com a
      // família no fio, e a última visita marcada. Tolerantes as duas.
      scope.filter(supabase.from('family_thread_messages').select('patient_id,created_at'))
        .order('created_at', { ascending: false }).limit(600)
        .then((r: any) => r, () => ({ data: [] })),
      scope.filter(supabase.from('visit_requests').select('patient_id,requested_date,status'))
        .then((r: any) => r, () => ({ data: [] })),

      /* ── QUEM NÃO SAI DO QUARTO ──────────────────────────────────────────
         «Se calhar a parte que os idosos mais sofrem é com problemas derivados
          de isolamento, tristeza.» (Fernando)

         Faltava a terceira fonte. As visitas e as mensagens dizem quem vem de
         FORA; as atividades dizem se a pessoa sai do quarto — e há quem não
         tenha ninguém e participe em tudo, e quem tenha a família toda e não
         saia da cama. São isolamentos diferentes e tratam-se de maneira
         diferente.

         Duas leituras porque a `activity_participations` não tem data: a data
         está na atividade. Primeiro as atividades do último mês, depois quem
         esteve nelas. */
      scope.filter(supabase.from('activities').select('id'))
        .gte('date', since30).lte('date', hojePt)
        .then((r: any) => r, () => ({ data: [] })),
    ])
    if (nts.error && /does not exist|schema cache/i.test(nts.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setNotes((nts.data || []) as Note[])

    // Último sinal de contacto por pessoa: a nota mais recente da equipa, a
    // última mensagem no fio da família, ou a última visita. O que for mais
    // recente dos três é o que conta.
    const ultimo: Record<string, string> = {}
    const marcar = (pid: string, quando?: string | null) => {
      if (!pid || !quando) return
      const d = String(quando).slice(0, 10)
      if (!ultimo[pid] || d > ultimo[pid]) ultimo[pid] = d
    }
    ;((nts.data || []) as any[]).forEach(n => marcar(n.patient_id, n.date))
    ;(((fam as any)?.data || []) as any[]).forEach(m => marcar(m.patient_id, m.created_at))
    ;(((vis as any)?.data || []) as any[]).forEach(v => { if (v.status !== 'cancelled') marcar(v.patient_id, v.requested_date) })
    setUltimoContacto(ultimo)

    // Humor baixo persistente: pelo menos 4 registos nos últimos 14 dias, média <= 2 (de 5).
    const byPatient: Record<string, number[]> = {}
    ;((cr.data || []) as any[]).forEach(r => {
      const lvl = r.mood?.level
      if (typeof lvl === 'number') (byPatient[r.patient_id] ||= []).push(lvl)
    })
    const flags = new Set<string>()
    Object.entries(byPatient).forEach(([pid, levels]) => {
      if (levels.length >= 4 && levels.reduce((a, b) => a + b, 0) / levels.length <= 2) flags.add(pid)
    })
    setMoodFlags(flags)

    /* ── QUEM ESTÁ SOZINHO ─────────────────────────────────────────────────
       A segunda leitura das atividades: quem esteve nas do último mês. Só se
       pede se houver atividades — numa casa que não as registe, a consulta
       com uma lista vazia de ids devolveria a tabela inteira. */
    const idsAtiv = (((ativ as any)?.data || []) as any[]).map(a => a.id).filter(Boolean)
    let participacoes: { patient_id: string }[] = []
    if (idsAtiv.length) {
      const r: any = await scope.filter(
        supabase.from('activity_participations').select('patient_id'))
        .in('activity_id', idsAtiv).eq('attended', true)
        .then((x: any) => x, () => ({ data: [] }))
      participacoes = (r?.data || []) as { patient_id: string }[]
    }
    setSozinhos(quemEstaSozinho(
      ((pats.data || []) as Patient[]).map(x => ({ id: x.id, name: x.name })),
      (((vis as any)?.data || []) as any[]),
      (((fam as any)?.data || []) as any[]),
      participacoes,
      hojePt,
    ))

    // Índice de erosão — mesma fonte de tendência que o /radar e o /tendencias
    // usam (lib/sentinel loadTrends), aqui lido só na parte psico-social.
    setTrends(await loadTrends(supabase, scope, (pats.data || []) as Patient[]))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  const erosionBy = useMemo(() => {
    const out: Record<string, ErosionResult> = {}
    Object.entries(trends).forEach(([pid, t]) => {
      const e = psychosocialErosion(t)
      if (e.flags.length) out[pid] = e
    })
    return out
  }, [trends])

  function notesFor(patientId: string) { return notes.filter(n => n.patient_id === patientId) }
  function openNoteEditor(patientId: string) { setOpenFor(patientId); setNewNote(''); setNewReferTo(''); setNewReferStatus(''); setNewReferDate('') }

  async function saveNote() {
    if (!openFor || !newNote.trim()) return
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    setSaving(true)
    const { data, error } = await supabase.from('psychosocial_notes').insert(scope.stamp({
      user_id: user.id, patient_id: openFor, note: newNote.trim().slice(0, 2000),
      referred_to: newReferTo || null, referral_status: newReferTo ? (newReferStatus || 'sugerido') : null,
      referral_date: newReferDate || null, recorded_by_id: user.id,
    })).select().single()
    setSaving(false)
    if (error) { toast.error('Não foi possível guardar', reportError('psicossocial-note-create', error, MSG.save)); return }
    if (data) setNotes(prev => [data, ...prev])
    setOpenFor(null)
  }

  async function advanceReferral(n: Note) {
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    const order = ['sugerido', 'agendado', 'em_curso', 'concluido']
    const idx = order.indexOf(n.referral_status || 'sugerido')
    if (idx === order.length - 1) return
    const next = order[idx + 1]
    const { error } = await supabase.from('psychosocial_notes').update({ referral_status: next }).eq('id', n.id)
    if (error) { toast.error('Não atualizado', reportError('psicossocial-referral-advance', error, MSG.save)); return }
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, referral_status: next } : x))
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  // Quem está a cair primeiro, depois quem está persistentemente em baixo.
  const SEV_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2, good: 3 }
  const rank = (id: string) => {
    const e = erosionBy[id]
    if (e) return SEV_RANK[e.level] ?? 3
    return moodFlags.has(id) ? 2.5 : 9
  }

  // ── Dias desde o último contacto ─────────────────────────────────────────
  // Nunca contactado devolve null (não zero, nem um número gigante inventado):
  // "nunca" e "há muito tempo" são coisas diferentes e a página di-lo.
  const HOJE = new Date().toISOString().slice(0, 10)
  const diasSem = (id: string): number | null => {
    const d = ultimoContacto[id]
    if (!d) return null
    return Math.max(0, Math.round((new Date(HOJE + 'T12:00:00').getTime() - new Date(d + 'T12:00:00').getTime()) / 86400000))
  }
  // Silêncio a partir de duas semanas. Não é uma dívida — é uma sugestão de
  // por onde começar (ver a nota sobre um centro de dia não ser um ambiente
  // clínico diário: nada aqui diz "em atraso").
  const SILENCIO_DIAS = 14
  const emSilencio = (id: string) => { const d = diasSem(id); return d === null || d >= SILENCIO_DIAS }

  // A ordem passa a ser: quem está a cair primeiro; a seguir quem está em
  // silêncio há mais tempo; e dentro disso, o mais esquecido à frente.
  const flaggedFirst = [...filtered].sort((a, b) => {
    const ra = rank(a.id), rb = rank(b.id)
    if (ra !== rb) return ra - rb
    const sa = emSilencio(a.id) ? 0 : 1, sb = emSilencio(b.id) ? 0 : 1
    if (sa !== sb) return sa - sb
    const da = diasSem(a.id), db = diasSem(b.id)
    if (da === null && db !== null) return -1
    if (db === null && da !== null) return 1
    if (da !== null && db !== null && da !== db) return db - da
    return a.name.localeCompare(b.name)
  })
  const calados = filtered.filter(p => emSilencio(p.id))
  const erodingCount = Object.keys(erosionBy).length

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <AvisoDeSetup codigo="PHX-K7" oQue="O apoio psico-social ainda não está disponível nesta conta." />
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     A MESMA PESSOA APARECIA DUAS VEZES: uma no bloco «A quem ir falar hoje»,
     outra na lista por baixo. Quem registasse o contacto em cima ficava a ver
     a linha de baixo ainda a dizer «12 dias sem contacto» — o que faz duvidar
     de que o toque tenha gravado.

     Passa a uma lista só, ordenada por quem precisa mais, com um filtro «em
     silêncio» que destaca os mesmos sem os repetir. As notas saem de dentro
     da linha e vão para o painel da direita.

     O que a página já faz bem fica: deixou de ser «onde se escrevem notas» e
     passou a ser «a quem ir falar» — e o «Falei com ele/ela» continua a ser
     um toque, porque se registar um contacto der trabalho ninguém regista.
     ══════════════════════════════════════════════════════════════════════════ */
  const emSilencioAgora = flaggedFirst.filter(p => emSilencio(p.id))
  const lista = soSilencio ? emSilencioAgora : flaggedFirst
  const aberta = flaggedFirst.find(p => p.id === openFor) || null

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Apoio psico-social</span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${cfg.personNoun.toLowerCase()}…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 230 }} />

          {!loading && emSilencioAgora.length > 0 && (
            <Seletor
              opcoes={[
                { id: 'todos', rotulo: `Todos ${flaggedFirst.length}` },
                { id: 'silencio', rotulo: `Em silêncio ${emSilencioAgora.length}` },
              ]}
              ativa={soSilencio ? 'silencio' : 'todos'}
              aoMudar={v => setSoSilencio(v === 'silencio')} />
          )}

          {/* ── QUEM A CASA DEIXOU DE VER ────────────────────────────────
              O primeiro de todos os contadores, e com o seu próprio botão: é
              a pergunta que o Fernando pôs («a parte que os idosos mais sofrem
              é com problemas derivados de isolamento»), e a lista responde-lhe
              com nomes em vez de com um número. */}
          {!loading && sozinhos.length > 0 && (
            <Botao feitio={verSozinhos ? 'principal' : 'contorno'}
              onClick={() => setVerSozinhos(v => !v)}
              titulo="Quem não recebe visitas, não recebe mensagens, ou não sai do quarto">
              {verSozinhos ? 'FECHAR' : `${sozinhos.length} MAIS SOZINHOS`}
            </Botao>
          )}

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              {erodingCount > 0 && (
                <span style={{
                  ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)',
                  fontWeight: 'var(--peso-forte)' as any,
                }}>{erodingCount} A CAIR FACE AO PRÓPRIO HÁBITO</span>
              )}
              {moodFlags.size > 0 && (
                <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                  {moodFlags.size} COM HUMOR EM BAIXA
                </span>
              )}
            </span>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>A ordem sai de há quanto tempo ninguém fala com cada pessoa</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>
            {SILENCIO_DIAS}+ dias sem contacto
          </span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Notas de acompanhamento e encaminhamento — só visíveis à equipa
          </span>
        </BarraDeEstado>
      }
    >
      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(380px, 1fr) minmax(340px, 480px)' : '1fr',
      }}>
        {(largo || !aberta) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural} · por quem precisa mais</span>
                <span style={{ ...ROTULO, width: 48, textAlign: 'right' }}>Notas</span>
                <span style={{ ...ROTULO, width: 96, textAlign: 'right' }}>Sem contacto</span>
                <span style={{ ...ROTULO, width: 140 }}> </span>
              </Cabecalho>
            }
            rodape={
              emSilencioAgora.length === 0 ? (
                <span style={{ ...MONO, color: 'var(--green)' }}>
                  Ninguém está há mais de {SILENCIO_DIAS} dias sem contacto
                </span>
              ) : (
                <span style={MONO}>{lista.length} de {flaggedFirst.length}</span>
              )
            }
          >
            {loading ? (
              <ACarregar oQue="A ver com quem ninguém fala há mais tempo…" />
            ) : lista.length === 0 ? (
              <Vazio titulo={flaggedFirst.length === 0 ? cfg.emptyPeopleMsg : 'Ninguém em silêncio.'}
                oQueFazer={flaggedFirst.length === 0 ? undefined
                  : `Ninguém está há mais de ${SILENCIO_DIAS} dias sem que alguém tenha falado consigo.`} />
            ) : lista.map(p => {
              const pNotes = notesFor(p.id)
              const flagged = moodFlags.has(p.id)
              const erosion = erosionBy[p.id]
              const d = diasSem(p.id)
              const calado = d === null || d >= SILENCIO_DIAS
              const porque = [
                erosion ? 'está a cair face ao próprio hábito' : '',
                flagged ? 'humor em baixa há dias' : '',
              ].filter(Boolean).join(' · ')
              return (
                <LinhaTabela key={p.id}
                  aoTocar={() => setOpenFor(openFor === p.id ? null : p.id)}
                  ativa={openFor === p.id}
                  filete={erosion
                    ? (erosion.level === 'critical' ? 'var(--red)' : 'var(--amber)')
                    : calado ? 'var(--amber)' : undefined}
                  principal={
                    <>
                      {p.name}
                      {p.room_number && (
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                          {' '}· {p.room_number}
                        </span>
                      )}
                    </>
                  }
                  secundaria={porque || undefined}
                  celulas={[
                    {
                      rotulo: 'Notas', valor: pNotes.length || '—', largura: 48, direita: true,
                      cor: pNotes.length ? 'var(--ink-4)' : 'var(--ink-5)',
                    },
                    {
                      rotulo: 'Sem contacto', largura: 96, direita: true, forte: calado,
                      valor: d === null ? 'nunca' : `${d}d`,
                      cor: d === null ? 'var(--amber)' : calado ? 'var(--amber)' : 'var(--ink-4)',
                    },
                  ]}
                  fim={
                    /* Um toque. Se registar um contacto der trabalho, ninguém
                       regista — e o número de dias deixa de querer dizer nada.

                       DEIXOU DE SER O BOTÃO VERDE (2026-10-14). «Não pode só
                       ser um botão de falei com ele» — e enquanto ele era a
                       única coisa com cor em cada linha, era isso que a página
                       dizia que se vinha aqui fazer. O que se vem aqui fazer é
                       abrir o processo da pessoa; marcar o contacto é o atalho
                       para quando não há mais nada a registar. */
                    <Botao
                      onClick={() => registarContacto(p.id, p.name)}
                      esperando={aRegistar === p.id}>
                      FALEI COM ELE
                    </Botao>
                  } />
              )
            })}
          </Painel>
        )}

        {/* ══ QUEM A CASA DEIXOU DE VER ════════════════════════════════════
            Não é um diagnóstico e não se parece com um: é uma lista de quem
            ver, por ordem. As RAZÕES é que se mostram — o peso que as ordena
            fica escondido de propósito, porque um número ao lado de um nome
            convida a ser tratado como uma medida, e não é. */}
        {verSozinhos && (
          <div style={{ marginBottom: 'var(--space-7)' }}>
            <Painel cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>Quem a casa deixou de ver</span>
                <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                  {sozinhos.length} DE {patients.length}
                </span>
              </Cabecalho>
            }>
              <div style={{ padding: 'var(--space-6) var(--space-7)' }}>
                <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
                  Isto sai de quem aparece — visitas, mensagens das famílias e
                  participação nas atividades — e não de perguntar. Ninguém diz
                  que está sozinho: quem foi criado a não se queixar responde
                  «não, não senhora». <strong>Não é um diagnóstico</strong>, é uma
                  lista de quem ver.
                </p>
              </div>
              {sozinhos.map(x => (
                <button key={x.patientId} type="button"
                  onClick={() => { setOpenFor(x.patientId); setVerSozinhos(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: 'none', fontFamily: 'inherit',
                    border: 'none', borderTop: '1px solid var(--bg-2)',
                    padding: 'var(--space-6) var(--space-7)',
                  }}>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-corpo)', color: 'var(--ink)',
                    fontWeight: 'var(--peso-corpo)' as any,
                  }}>{x.nome}</span>
                  <span style={{
                    display: 'block', fontSize: 'var(--t-dado)', color: 'var(--ink-3)',
                    marginTop: 2, lineHeight: 1.5,
                  }}>{x.razoes.join(' · ')}</span>
                </button>
              ))}
            </Painel>
          </div>
        )}

        {/* ══ O QUE SE SABE DESTA PESSOA ═══════════════════════════════════ */}
        {aberta ? (() => {
          const p = aberta
          const pNotes = notesFor(p.id)
          const erosion = erosionBy[p.id]
          const flagged = moodFlags.has(p.id)
          return (
            <Painel
              cabeca={
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Botao onClick={() => setOpenFor(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontSize: 'var(--t-destaque)',
                      fontWeight: 'var(--peso-corpo)' as any,
                    }}>{p.name}</span>
                    <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                      {(() => { const d = diasSem(p.id); return d === null ? 'NUNCA CONTACTADO' : `${d} DIAS SEM CONTACTO` })()}
                      {' · '}{pNotes.length} NOTA{pNotes.length === 1 ? '' : 'S'}
                    </span>
                  </span>
                </div>
              }
            >
              <div style={{ padding: '0 14px 14px' }}>
                {/* Erosão: está A CAIR face ao próprio hábito (2 a 3 semanas). */}
                {erosion && (
                  <div style={{ marginTop: 12 }}>
                    <Aviso tom={erosion.level === 'critical' ? 'mau' : 'atencao'}
                      titulo={`Erosão psico-social${erosion.declining.length >= 2 ? ` · ${erosion.declining.length} áreas a cair` : ''}`}>
                      {erosion.flags.map((f, i) => (
                        <div key={i} style={{ marginTop: i ? 4 : 0, lineHeight: 1.55 }}>
                          <strong style={{ color: SEVERITY_STYLE[f.severity].color }}>{f.title}</strong> — {f.detail}
                        </div>
                      ))}
                    </Aviso>
                  </div>
                )}

                {/* Limiar estático: está SEMPRE em baixo, sem precisar de cair. */}
                {flagged && (
                  <p style={{
                    margin: '12px 0 0', fontSize: 'var(--t-dado)',
                    color: 'var(--ink-3)', lineHeight: 1.6,
                  }}>
                    Humor em baixo persistente nos últimos 14 dias — pode valer a pena
                    um acompanhamento.
                  </p>
                )}

                {/* ── O PROCESSO ─────────────────────────────────────────────
                    Entra antes das notas de propósito: o que se lê antes de
                    escrever a nota de hoje é quem a pessoa é e o que ficou
                    combinado da última vez. As notas de acompanhamento que já
                    existiam ficam por baixo, intactas — são o registo de
                    contacto rápido, e continuam a servir para isso. */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
                  <ProcessoPsicossocial pid={p.id} nome={p.name} podeEditar={podeEditar} />
                </div>

                {/* ── A NOTA NOVA ────────────────────────────────────────── */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-2)' }}>
                  <Campo rotulo="Nota de acompanhamento" para="ps-nota">
                    <textarea id="ps-nota" value={newNote} onChange={e => setNewNote(e.target.value)}
                      rows={3} placeholder="O que se falou, o que se notou, o que fica combinado."
                      style={{ ...CAIXA_TEXTO, width: '100%' }} />
                  </Campo>

                  <Campo rotulo="Encaminhar para" para="ps-refer">
                    <select id="ps-refer" value={newReferTo}
                      onChange={e => setNewReferTo(e.target.value)} style={{ ...CAIXA, width: '100%' }}>
                      <option value="">Sem encaminhamento</option>
                      {REFERRAL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Campo>

                  {newReferTo && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Campo rotulo="Em que ponto está" para="ps-estado">
                        <select id="ps-estado" value={newReferStatus}
                          onChange={e => setNewReferStatus(e.target.value)} style={{ ...CAIXA, width: '100%' }}>
                          {Object.entries(REFERRAL_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo rotulo="Quando" para="ps-data">
                        <input id="ps-data" type="date" value={newReferDate}
                          onChange={e => setNewReferDate(e.target.value)} style={{ ...CAIXA, width: '100%' }} />
                      </Campo>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Botao feitio="principal" onClick={saveNote} esperando={saving}
                      disabled={!newNote.trim()}>
                      GUARDAR A NOTA
                    </Botao>
                  </div>
                </div>

                {/* ── O QUE JÁ ESTÁ ESCRITO ──────────────────────────────── */}
                {pNotes.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ ...ROTULO, marginBottom: 4 }}>O que já ficou escrito</div>
                    {pNotes.map(n => (
                      <div key={n.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          gap: 8, alignItems: 'center', flexWrap: 'wrap',
                        }}>
                          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                            {new Date(n.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {n.referral_status && (
                            <button onClick={() => advanceReferral(n)}
                              disabled={n.referral_status === 'concluido'}
                              className="mesa-botao"
                              style={{
                                ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.06em',
                                padding: '0 9px', borderRadius: 'var(--r-sm)',
                                border: `1px solid ${REFERRAL_STATUS[n.referral_status].color}`,
                                background: 'transparent',
                                color: REFERRAL_STATUS[n.referral_status].color,
                                fontWeight: 'var(--peso-forte)' as any,
                                cursor: n.referral_status === 'concluido' ? 'default' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}>
                              {n.referred_to} · {REFERRAL_STATUS[n.referral_status].label}
                              {n.referral_status !== 'concluido' ? ' →' : ''}
                            </button>
                          )}
                        </div>
                        <div style={{
                          fontSize: 'var(--t-dado)', color: 'var(--ink-2)',
                          lineHeight: 1.6, marginTop: 3, whiteSpace: 'pre-wrap',
                        }}>{n.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Painel>
          )
        })() : largo ? (
          <Painel>
            <Vazio titulo={`Escolha um ${cfg.personNoun.toLowerCase()}.`}
              oQueFazer="As notas de acompanhamento e os encaminhamentos abrem aqui ao lado. E o «falei com ele» na lista é um toque — é isso que mantém o número de dias verdadeiro." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
  )
}
