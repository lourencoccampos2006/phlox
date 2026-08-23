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

const ACCENT = '#0d9488'
interface Patient { id: string; name: string; room_number: string | null }
interface Review extends AdlReview { id: string; patient_id: string }

export default function AutonomiaPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
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
    if (!scope.canEdit) { toast.error('Só leitura', MSG.readonly); return }
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
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Para ativar o acompanhamento de autonomia, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint134_adl_reviews.sql</code> no Supabase.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '20px 20px 16px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Autonomia</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0', maxWidth: 640, lineHeight: 1.55 }}>
            De vez em quando, três perguntas rápidas sobre como cada {cfg.personNoun.toLowerCase()} se está a desenrascar. Não é para fazer todos os dias — uma vez por semana chega para se perceber se alguém está a precisar de mais ajuda do que precisava.
          </p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Procurar ${cfg.personNoun.toLowerCase()}...`}
          style={{ border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', maxWidth: 280 }} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}</div>
        ) : ordered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 30, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13.5 }}>{cfg.emptyPeopleMsg}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ordered.map(p => {
              const isOpen = openFor === p.id
              const last = lastReview(p.id)
              const days = daysSince(p.id)
              const t = adlTrend(byPatient[p.id] || [])
              const lastScore = last ? adlScore(last) : null
              // Últimas 5 revisões, da mais antiga para a mais recente.
              const history = (byPatient[p.id] || [])
                .slice(0, 5)
                .map(r => ({ date: r.date, score: adlScore(r) }))
                .filter((h): h is { date: string; score: number } => h.score !== null)
                .reverse()
              return (
                <div key={p.id} style={{ background: 'white', border: `1px solid ${t.flag ? (t.flag.severity === 'critical' ? '#fca5a5' : '#fde68a') : 'var(--border)'}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</span>
                      {p.room_number && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span>}
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
                        {lastScore != null
                          ? <>{adlLabel(lastScore)} · <span style={{ fontFamily: 'var(--font-mono)' }}>{lastScore.toFixed(0)}/{ADL_MAX}</span>{days != null && <> · há {days === 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`}</>}</>
                          : 'Ainda sem revisão'}
                      </div>
                      {/* Trajetória — o número de hoje não diz nada sozinho; o
                          que conta numa conversa com a família ("ele já precisa
                          de mais do que conseguimos dar aqui") é o CAMINHO. */}
                      {history.length >= 2 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                          {history.map((h, i) => (
                            <span key={h.date} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {i > 0 && <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>›</span>}
                              <span title={new Date(h.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: h.score >= 7 ? '#15803d' : h.score >= 4 ? '#b45309' : '#b91c1c', background: h.score >= 7 ? '#f0fdf4' : h.score >= 4 ? '#fffbeb' : '#fef2f2', borderRadius: 5, padding: '1px 6px' }}>
                                {h.score.toFixed(0)}
                              </span>
                            </span>
                          ))}
                          <span style={{ fontSize: 10.5, color: 'var(--ink-5)', marginLeft: 2 }}>últimas revisões</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => isOpen ? setOpenFor(null) : openEditor(p.id)}
                      style={{ padding: '7px 14px', background: isOpen ? 'var(--bg-3)' : ACCENT, color: isOpen ? 'var(--ink-3)' : 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      {isOpen ? 'Fechar' : last ? 'Rever' : 'Registar'}
                    </button>
                  </div>

                  {t.flag && (
                    <div style={{ marginTop: 9, padding: '9px 12px', background: t.flag.severity === 'critical' ? '#fef2f2' : '#fffbeb', border: `1px solid ${t.flag.severity === 'critical' ? '#fca5a5' : '#fde68a'}`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.flag.severity === 'critical' ? '#b91c1c' : '#b45309' }}>{t.flag.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 2 }}>{t.flag.detail}</div>
                    </div>
                  )}

                  {isOpen && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {last && <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>Já vem preenchido com a última vez — muda só o que estiver diferente.</div>}
                      {ADL_TASKS.map(task => (
                        <div key={task.key}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>{task.question}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ADL_LEVELS.map(lv => {
                              const on = draft[task.key] === lv.value
                              return (
                                <button key={lv.value} onClick={() => setDraft(d => ({ ...d, [task.key]: on ? null : lv.value }))}
                                  title={lv.hint}
                                  style={{ padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, border: `1.5px solid ${on ? lv.color : 'var(--border)'}`, background: on ? lv.bg : 'white', color: on ? lv.color : 'var(--ink-3)' }}>
                                  {lv.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: saving ? 'var(--bg-3)' : ACCENT, color: saving ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                          {saving ? 'A guardar…' : 'Guardar'}
                        </button>
                        <Link href={`/patients/${p.id}`} style={{ padding: '9px 16px', background: 'white', color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Abrir ficha</Link>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5, marginTop: 4 }}>
          ⓘ Isto não substitui uma avaliação formal (Barthel, Katz). Serve para notar mais cedo que alguém está a precisar de mais ajuda — a avaliação e a decisão são sempre do profissional.
        </div>
      </div>
    </div>
  )
}
