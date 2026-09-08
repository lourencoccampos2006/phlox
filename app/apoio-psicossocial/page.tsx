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

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import Icon from '@/components/Icon'
import { loadTrends } from '@/lib/sentinel'
import { psychosocialErosion, type ResidentTrend, type ErosionResult } from '@/lib/trendSignals'
import { SEVERITY_STYLE } from '@/lib/residentSignals'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { registar } from '@/lib/registo'
import { iniciais, corDaPessoa } from '@/lib/presenca'

interface Patient { id: string; name: string; room_number: string | null }
interface Note {
  id: string; patient_id: string; date: string; note: string
  referred_to: string | null; referral_status: string | null; referral_date: string | null
  created_at: string
}

const REFERRAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sugerido:  { label: 'Sugerido',  color: '#64748b', bg: '#f8fafc' },
  agendado:  { label: 'Agendado',  color: '#b45309', bg: '#fffbeb' },
  em_curso:  { label: 'Em curso',  color: '#1d4ed8', bg: '#eff6ff' },
  concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
}
const REFERRAL_OPTIONS = ['Psicologia', 'Psiquiatria', 'Assistente Social (externo)', 'Terapia Ocupacional', 'Outro especialista']

export default function ApoioPsicossocialPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
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
    if (!scope.canEdit) { alert('A sua conta é só de leitura.'); return }
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
  const [search, setSearch] = useState('')
  const [openFor, setOpenFor] = useState<string | null>(null)

  const [newNote, setNewNote] = useState('')
  const [newReferTo, setNewReferTo] = useState('')
  const [newReferStatus, setNewReferStatus] = useState('')
  const [newReferDate, setNewReferDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
    const [pats, nts, cr, fam, vis] = await Promise.all([
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
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
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
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Apoio psico-social</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0' }}>Notas de acompanhamento e encaminhamento a especialistas — só visível à equipa.</p>
          {!loading && (erodingCount > 0 || moodFlags.size > 0 || calados.length > 0) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {erodingCount > 0 && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px' }}>
                  {erodingCount} a cair face ao próprio hábito
                </span>
              )}
              {calados.length > 0 && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 20, padding: '4px 12px' }}>
                  {calados.length} sem ninguém falar {calados.length === 1 ? 'consigo' : 'com elas'} há {SILENCIO_DIAS}+ dias
                </span>
              )}
              {moodFlags.size > 0 && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6d28d9', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, padding: '4px 12px' }}>
                  {moodFlags.size} com humor persistentemente baixo
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
          style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', maxWidth: 280 }} />

        {/* ── A quem ir falar hoje ─────────────────────────────────────────
            Esta página era um sítio para escrever notas. A pergunta que ela
            devia responder é outra: com quem é que ninguém fala há mais tempo?
            Aqui ficam os três primeiros, com um toque para dizer que se falou —
            se registar um contacto der trabalho, ninguém regista, e o número
            de dias deixa de querer dizer alguma coisa. */}
        {!loading && flaggedFirst.length > 0 && (() => {
          const fila = flaggedFirst.filter(p => emSilencio(p.id)).slice(0, 3)
          if (!fila.length) return (
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Ninguém está há mais de {SILENCIO_DIAS} dias sem contacto. A lista abaixo continua ordenada por quem
              precisa de mais atenção.
            </div>
          )
          return (
            <div style={{ background: 'white', border: '1px solid var(--border-2)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>
                A quem ir falar hoje
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fila.map(p => {
                  const d = diasSem(p.id)
                  const porque = [
                    erosionBy[p.id] ? 'está a cair face ao próprio hábito' : '',
                    moodFlags.has(p.id) ? 'humor em baixa há dias' : '',
                    d === null ? 'nunca foi contactado' : `${d} dias sem contacto`,
                  ].filter(Boolean)
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      border: '1px solid var(--bg-3)', borderRadius: 10, padding: '11px 13px',
                    }}>
                      <span style={{
                        flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: corDaPessoa(p.id), color: 'white', fontSize: 12, fontWeight: 700,
                      }}>{iniciais(p.name)}</span>
                      <span style={{ minWidth: 0, flex: '1 1 180px' }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 2, lineHeight: 1.4 }}>
                          {porque.join(' · ')}
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                        <button onClick={() => registarContacto(p.id, p.name)} disabled={aRegistar === p.id}
                          style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--ink)', color: 'white', fontSize: 12.5, fontWeight: 600, cursor: aRegistar === p.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                          {aRegistar === p.id ? '…' : 'Falei com ele/ela'}
                        </button>
                        <button onClick={() => openNoteEditor(p.id)}
                          style={{ minHeight: 38, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          + Nota
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}</div>
        ) : flaggedFirst.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>{cfg.emptyPeopleMsg}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {flaggedFirst.map(p => {
              const pNotes = notesFor(p.id)
              const flagged = moodFlags.has(p.id)
              const erosion = erosionBy[p.id]
              const isOpen = openFor === p.id
              const borderColor = erosion
                ? (erosion.level === 'critical' ? '#fca5a5' : '#fde68a')
                : (flagged ? '#c4b5fd' : 'var(--border)')
              return (
                <div key={p.id} style={{ background: 'white', border: `1px solid ${borderColor}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                      {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                      {pNotes.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--ink-4)', marginLeft: 10 }}>{pNotes.length} nota{pNotes.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {/* Há quanto tempo ninguém fala com esta pessoa. É este
                        número que decide a ordem da lista — a página deixou de
                        ser "onde se escrevem notas" e passou a ser "a quem ir
                        falar". */}
                    {(() => {
                      const d = diasSem(p.id)
                      if (d !== null && d < SILENCIO_DIAS) return null
                      return (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                          color: d === null ? '#b45309' : 'var(--ink-3)',
                          background: d === null ? '#fffbeb' : 'var(--bg-2)',
                          border: `1px solid ${d === null ? '#fde68a' : 'var(--border-2)'}`,
                          borderRadius: 20, padding: '3px 10px', marginLeft: 'auto', marginRight: 8, whiteSpace: 'nowrap',
                        }}>{d === null ? 'nunca contactado' : `${d} dias sem contacto`}</span>
                      )
                    })()}
                    <button onClick={() => isOpen ? setOpenFor(null) : openNoteEditor(p.id)} style={{ padding: '6px 12px', background: isOpen ? 'var(--bg-3)' : 'var(--ink)', color: isOpen ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {isOpen ? 'Fechar' : '+ Nota'}
                    </button>
                  </div>

                  {/* Erosão: está A CAIR face ao próprio hábito (2-3 semanas) */}
                  {erosion && (
                    <div style={{ marginTop: 8, padding: '9px 12px', background: erosion.level === 'critical' ? '#fef2f2' : '#fffbeb', border: `1px solid ${erosion.level === 'critical' ? '#fca5a5' : '#fde68a'}`, borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: erosion.flags.length ? 6 : 0 }}>
                        <Icon name="chart" size={13} color={erosion.level === 'critical' ? '#b91c1c' : '#b45309'} />
                        <span style={{ fontSize: 12, fontWeight: 800, color: erosion.level === 'critical' ? '#b91c1c' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Erosão psico-social{erosion.declining.length >= 2 ? ` · ${erosion.declining.length} áreas a cair` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {erosion.flags.map((f, i) => (
                          <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                            <strong style={{ color: SEVERITY_STYLE[f.severity].color }}>{f.title}</strong> — {f.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Limiar estático: está SEMPRE em baixo (não precisa de estar a cair) */}
                  {flagged && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 11px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8 }}>
                      <Icon name="alert" size={13} color="#7c3aed" />
                      <span style={{ fontSize: 12, color: '#6d28d9', fontWeight: 600 }}>Humor em baixo persistente nos últimos 14 dias — pode valer a pena um acompanhamento.</span>
                    </div>
                  )}

                  {pNotes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {pNotes.slice(0, 5).map(n => (
                        <div key={n.id} style={{ borderTop: '1px solid var(--bg-3)', paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{new Date(n.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</div>
                            {n.referral_status && (
                              <button onClick={() => advanceReferral(n)} disabled={n.referral_status === 'concluido'} style={{ fontSize: 10.5, fontWeight: 700, color: REFERRAL_STATUS[n.referral_status].color, background: REFERRAL_STATUS[n.referral_status].bg, border: `1px solid ${REFERRAL_STATUS[n.referral_status].color}33`, borderRadius: 6, padding: '2px 8px', cursor: n.referral_status === 'concluido' ? 'default' : 'pointer' }}>
                                {n.referred_to} · {REFERRAL_STATUS[n.referral_status].label}{n.referral_status !== 'concluido' ? ' →' : ''}
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 3 }}>{n.note}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOpen && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea autoFocus value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder="Nota de acompanhamento…"
                        style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <select value={newReferTo} onChange={e => setNewReferTo(e.target.value)} style={{ flex: '1 1 200px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                          <option value="">Sem encaminhamento</option>
                          {REFERRAL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {newReferTo && (
                          <>
                            <select value={newReferStatus} onChange={e => setNewReferStatus(e.target.value)} style={{ flex: '1 1 130px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', background: 'white' }}>
                              {Object.entries(REFERRAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input type="date" value={newReferDate} onChange={e => setNewReferDate(e.target.value)} style={{ flex: '1 1 140px', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
                          </>
                        )}
                      </div>
                      <button onClick={saveNote} disabled={saving || !newNote.trim()} style={{ alignSelf: 'flex-start', padding: '8px 16px', background: saving || !newNote.trim() ? 'var(--bg-3)' : 'var(--ink)', color: saving || !newNote.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: saving || !newNote.trim() ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'A guardar…' : 'Guardar nota'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
