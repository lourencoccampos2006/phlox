'use client'

// /autonomia — Capacidade funcional contínua (Módulo 15, 2026-08-20).
//
// Pensado depois do Fernando corrigir o plano: "num centro de dia o FOCO não é
// fazer registos e coisas profissionais todos os dias; nem sequer todos têm
// profissionais a tempo inteiro."
//
// Consequências no desenho desta página:
//  • NÃO vive dentro do registo do dia. É uma página à parte, opcional. Quem
//    não a usar não parte nada — só não tem este sinal, e a página diz isso.
//  • NÃO impõe ritmo. Sem "em atraso", sem vermelhos por não ter registado.
//    Mostra há quanto tempo foi a última revisão e ordena por aí — quem há
//    mais tempo não é revisto aparece primeiro. É uma sugestão, não uma dívida.
//  • Linguagem do dia a dia ("Sozinho", "Fizemos nós"), nunca escala clínica.
//  • Vem prefixado com a última revisão: num dia normal não se toca em nada,
//    é só confirmar.
//
// A leitura de declínio está em lib/adl.ts (janela por tempo, adapta-se a
// registo diário, semanal ou quinzenal).

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import { ADL_TASKS, ADL_LEVELS, ADL_MAX, adlScore, adlLabel, adlTrend, type AdlReview, type AdlTask } from '@/lib/adl'
import { ptDate } from '@/lib/ptTime'
import AvisoDeSetup from '@/components/AvisoDeSetup'

const ACCENT = 'var(--green)'
interface Patient { id: string; name: string; room_number: string | null }
interface Review extends AdlReview { id: string; patient_id: string }

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho,
  Botao, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function AutonomiaPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('avaliacoes', 'editar')
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const largo = useLargo()
  const [search, setSearch] = useState('')
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<AdlTask, number | null>>({ higiene: null, alimentacao: null, mobilidade: null })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 130 * 86400000).toISOString().slice(0, 10)
    const [pats, revs] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number')).eq('active', true).order('name'),
      scope.filter(supabase.from('adl_reviews').select('id,patient_id,date,higiene,alimentacao,mobilidade')).gte('date', since).order('date', { ascending: false }),
    ])
    if (revs.error && /does not exist|schema cache/i.test(revs.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients((pats.data || []) as Patient[])
    setReviews((revs.data || []) as Review[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  const byPatient = useMemo(() => {
    const m: Record<string, Review[]> = {}
    reviews.forEach(r => { (m[r.patient_id] ||= []).push(r) })
    return m
  }, [reviews])

  function lastReview(pid: string): Review | null { return byPatient[pid]?.[0] || null }
  function daysSince(pid: string): number | null {
    const l = lastReview(pid)
    if (!l) return null
    return Math.round((Date.now() - new Date(l.date + 'T00:00:00').getTime()) / 86400000)
  }

  function openEditor(pid: string) {
    const l = lastReview(pid)
    // Prefill com a última revisão — num dia normal é só confirmar.
    setDraft({ higiene: l?.higiene ?? null, alimentacao: l?.alimentacao ?? null, mobilidade: l?.mobilidade ?? null })
    setOpenFor(pid)
  }

  async function save() {
    if (!openFor) return
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    if (ADL_TASKS.every(t => draft[t.key] == null)) { toast.error('Nada para guardar', 'Responde a pelo menos uma das perguntas.'); return }
    setSaving(true)
    // ptDate (data de calendário de Portugal), NÃO toISOString: no verão, entre
    // as 00:00 e a 01:00, o UTC ainda é o dia anterior — e como a tabela tem
    // unique(patient_id, date), uma revisão feita à meia-noite e meia iria
    // SOBREPOR a revisão do dia anterior em vez de criar uma nova. Perda de
    // dados silenciosa. (Confirmado ao vivo: 06:32 local = 2026-08-21, mas
    // meia-noite local dava 2026-08-20.)
    const today = ptDate()
    const { data, error } = await supabase.from('adl_reviews').upsert(scope.stamp({
      user_id: user.id, patient_id: openFor, date: today,
      higiene: draft.higiene, alimentacao: draft.alimentacao, mobilidade: draft.mobilidade,
      recorded_by_id: user.id,
    }), { onConflict: 'patient_id,date' }).select().single()
    setSaving(false)
    if (error) { toast.error('Não foi possível guardar', reportError('adl-save', error, MSG.save)); return }
    if (data) setReviews(prev => [data as Review, ...prev.filter(r => !(r.patient_id === openFor && r.date === today))])
    setOpenFor(null)
  }

  const filtered = patients.filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
  // Quem há mais tempo não é revisto aparece primeiro — sugestão, não dívida.
  const ordered = [...filtered].sort((a, b) => {
    const da = daysSince(a.id), db = daysSince(b.id)
    if (da === null && db === null) return a.name.localeCompare(b.name)
    if (da === null) return -1
    if (db === null) return 1
    return db - da
  })

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <AvisoDeSetup codigo="PHX-M4" oQue="As revisões de autonomia ainda não estão disponíveis nesta conta." />
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Cada pessoa era um cartão que crescia para 400px ao abrir — cinco
     perguntas com quatro botões cada, vinte alvos dentro de um cartão no meio
     de uma lista. Passa a mestre/detalhe: a lista com a trajectória à
     esquerda, as perguntas à direita.

     O que a página já fazia bem fica: mostrar a TRAJECTÓRIA e não só o número
     de hoje. «7 › 6 › 6 › 4» é o que se leva a uma conversa com a família;
     um «4» sozinho não é.
     ══════════════════════════════════════════════════════════════════════════ */
  const escolhida = ordered.find(p => p.id === openFor) || null
  const comSinal = ordered.filter(p => adlTrend(byPatient[p.id] || []).flag).length

  /** A trajectória de uma pessoa: as últimas cinco revisões, em mono. */
  function trajetoria(id: string) {
    return (byPatient[id] || [])
      .slice(0, 5)
      .map(r => ({ date: r.date, score: adlScore(r) }))
      .filter((h): h is { date: string; score: number } => h.score !== null)
      .reverse()
  }

  const corDoScore = (n: number) => n >= 7 ? 'var(--green)' : n >= 4 ? 'var(--amber)' : 'var(--red)'

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Autonomia</span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${cfg.personNoun.toLowerCase()}…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 240 }} />

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              {comSinal > 0 && (
                <span style={{
                  ...MONO, fontSize: 'var(--t-meta)', color: 'var(--amber)',
                  fontWeight: 'var(--peso-forte)' as any,
                }}>{comSinal} A PRECISAR DE MAIS AJUDA</span>
              )}
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                UMA VEZ POR SEMANA CHEGA
              </span>
            </span>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>7 ou mais — desenrasca-se</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>4 a 6 — precisa de ajuda</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Menos de 4 — depende</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Não substitui uma avaliação formal (Barthel, Katz) — serve para notar mais
            cedo que alguém está a precisar de mais ajuda
          </span>
        </BarraDeEstado>
      }
    >
      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(380px, 1fr) minmax(340px, 460px)' : '1fr',
      }}>
        {(largo || !escolhida) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural}</span>
                <span style={{ ...ROTULO, width: 150 }}>Últimas revisões</span>
                <span style={{ ...ROTULO, width: 60, textAlign: 'right' }}>Hoje</span>
                <span style={{ ...ROTULO, width: 56, textAlign: 'right' }}>Há</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{ordered.length} {cfg.personNounPlural.toLowerCase()}</span>}
          >
            {loading ? (
              <ACarregar oQue="A carregar…" />
            ) : ordered.length === 0 ? (
              <Vazio titulo={cfg.emptyPeopleMsg} />
            ) : ordered.map(p => {
              const last = lastReview(p.id)
              const days = daysSince(p.id)
              const t = adlTrend(byPatient[p.id] || [])
              const lastScore = last ? adlScore(last) : null
              const hist = trajetoria(p.id)
              return (
                <LinhaTabela key={p.id}
                  aoTocar={() => openFor === p.id ? setOpenFor(null) : openEditor(p.id)}
                  ativa={openFor === p.id}
                  filete={t.flag ? (t.flag.severity === 'critical' ? 'var(--red)' : 'var(--amber)') : undefined}
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
                  secundaria={
                    t.flag ? t.flag.title
                      : lastScore != null ? adlLabel(lastScore)
                      : 'Ainda sem revisão'
                  }
                  celulas={[
                    {
                      rotulo: 'Últimas revisões', largura: 150,
                      valor: hist.length >= 2 ? (
                        /* A trajectória. Cada número tinha fundo de cor — cinco
                           rectângulos por pessoa, numa lista de trinta, são
                           cento e cinquenta manchas. A cor fica no número. */
                        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>
                          {hist.map((h, i) => (
                            <span key={h.date} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>
                              {i > 0 && <span style={{ color: 'var(--ink-5)' }}>›</span>}
                              <span title={new Date(h.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                                style={{
                                  fontWeight: (i === hist.length - 1 ? 'var(--peso-forte)' : 'var(--peso-normal)') as any,
                                  color: corDoScore(h.score),
                                }}>{h.score.toFixed(0)}</span>
                            </span>
                          ))}
                        </span>
                      ) : '—',
                    },
                    {
                      rotulo: 'Hoje', largura: 60, direita: true, forte: true,
                      valor: lastScore != null ? `${lastScore.toFixed(0)}/${ADL_MAX}` : '—',
                      cor: lastScore != null ? corDoScore(lastScore) : 'var(--ink-5)',
                    },
                    {
                      rotulo: 'Há', largura: 56, direita: true,
                      valor: days == null ? '—' : days === 0 ? 'hoje' : `${days}d`,
                      cor: days != null && days > 14 ? 'var(--amber)' : 'var(--ink-4)',
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {/* ══ AS CINCO PERGUNTAS ═══════════════════════════════════════════ */}
        {escolhida ? (
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
                  }}>{escolhida.name}</span>
                  <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                    {lastReview(escolhida.id) ? 'JÁ VEM PREENCHIDO COM A ÚLTIMA VEZ' : 'PRIMEIRA REVISÃO'}
                  </span>
                </span>
              </div>
            }
            rodape={
              <>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Link href={`/patients/${escolhida.id}`} style={{ textDecoration: 'none' }}>
                    <Botao>ABRIR A FICHA</Botao>
                  </Link>
                  <Botao feitio="principal" onClick={save} esperando={saving}>GUARDAR</Botao>
                </span>
              </>
            }
          >
            <div style={{ padding: '0 14px 14px' }}>
              {(() => {
                const t = adlTrend(byPatient[escolhida.id] || [])
                return t.flag ? (
                  <div style={{ marginTop: 12 }}>
                    <Aviso tom={t.flag.severity === 'critical' ? 'mau' : 'atencao'} titulo={t.flag.title}>
                      {t.flag.detail}
                    </Aviso>
                  </div>
                ) : null
              })()}

              {lastReview(escolhida.id) && (
                <p style={{
                  margin: '12px 0 0', fontSize: 'var(--t-meta)',
                  color: 'var(--ink-5)', lineHeight: 1.55,
                }}>
                  Vem preenchido com a última vez. Mude só o que estiver diferente —
                  é isso que torna a trajectória legível.
                </p>
              )}

              {ADL_TASKS.map(task => (
                <div key={task.key} style={{ marginTop: 14 }}>
                  <div style={{
                    fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any,
                    color: 'var(--ink-2)', marginBottom: 6,
                  }}>{task.question}</div>
                  <div role="radiogroup" aria-label={task.question}
                    style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ADL_LEVELS.map(lv => {
                      const on = draft[task.key] === lv.value
                      return (
                        <button key={lv.value} type="button" role="radio" aria-checked={on}
                          className="mesa-botao" title={lv.hint}
                          onClick={() => setDraft(d => ({ ...d, [task.key]: on ? null : lv.value }))}
                          style={{
                            ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.04em',
                            padding: '0 11px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                            border: `1px solid ${on ? lv.color : 'var(--border-2)'}`,
                            background: on ? lv.color : 'transparent',
                            color: on ? 'var(--sobre-acento)' : 'var(--ink-3)',
                            fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                          }}>{lv.label}</button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Painel>
        ) : largo ? (
          <Painel>
            <Vazio titulo={`Escolha um ${cfg.personNoun.toLowerCase()}.`}
              oQueFazer="São três perguntas rápidas sobre como a pessoa se está a desenrascar. Não é para fazer todos os dias — uma vez por semana chega para se perceber se alguém está a precisar de mais ajuda do que precisava." />
          </Painel>
        ) : null}
      </div>
    </Mesa>
  )
}
