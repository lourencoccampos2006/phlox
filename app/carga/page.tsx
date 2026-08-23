'use client'

// /carga — Carga de trabalho vs. pessoal (Módulo 19, 2026-08-16).
//
// O problema: a escala (/equipa → Escalas) sabe QUEM está em cada turno, e o
// Sentinel sabe quão exigentes são os utentes — mas os dois nunca se falaram.
// "Lacuna" na escala era só turno vazio; um turno com uma pessoa para 20
// residentes muito dependentes contava como coberto.
//
// O que isto NÃO faz, de propósito: não inventa um rácio legal. Os rácios de
// pessoal em ERPI são matéria regulada (Portaria) e variam com a valência e
// o grau de dependência — o Phlox não os vai fingir. Em vez disso compara
// cada turno com o HÁBITO DA PRÓPRIA INSTITUIÇÃO (mediana das últimas
// semanas), a mesma filosofia do motor de tendências: o desvio face ao
// próprio normal é o sinal, não um número universal inventado.
//
// A complexidade vem de lib/riskScore (idade, condições, função renal,
// polimedicação) — o score determinístico que o /patients e o /rounds já
// mostram. Foi por ser conceito distinto (fragilidade, não deteção de
// sinais) que ficou deliberadamente fora da consolidação do Sentinel na
// Fase 2 — e é exatamente o input certo aqui.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { riskScore as calcRiskScore, riskLevel } from '@/lib/riskScore'
import { ptDate } from '@/lib/ptTime'

type Shift = 'manha' | 'tarde' | 'noite'
const SHIFTS: Shift[] = ['manha', 'tarde', 'noite']
const SHIFT_META: Record<Shift, { label: string; color: string; bg: string }> = {
  manha: { label: 'Manhã', color: '#d97706', bg: '#fffbeb' },
  tarde: { label: 'Tarde', color: '#2563eb', bg: '#eff6ff' },
  noite: { label: 'Noite', color: '#6d28d9', bg: '#faf5ff' },
}
const ACCENT = '#b45309'
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// BUG CORRIGIDO 2026-08-21: usava-se `d.setHours(0,0,0,0)` + `toISOString()`,
// que devolve a data em UTC. Em Portugal no verão (WEST, UTC+1) a meia-noite
// local é 23:00 do dia ANTERIOR em UTC — ou seja, entre as 00:00 e a 01:00 a
// janela inteira dos "próximos 7 dias" andava um dia para trás: mostrava
// ontem (passado, inútil) e perdia o 7.º dia. Confirmado ao vivo.
// Agora: data de calendário de Portugal (lib/ptTime) + aritmética de dias em
// UTC puro sobre a string, que não tem fusos nem horário de verão.
const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

interface PatientRow { id: string; name: string; age: number | null; sex: string | null; weight: number | null; creatinine: number | null; conditions: string | null; room_number: string | null }

export default function CargaPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [medsCount, setMedsCount] = useState<Record<string, number>>({})
  const [assignments, setAssignments] = useState<{ date: string; shift: Shift; team_member_id: string }[]>([])
  const [histAssignments, setHistAssignments] = useState<{ date: string; shift: Shift; team_member_id: string }[]>([])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const safe = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }
    const today = ptDate()
    const in7 = addDays(today, 6)
    const back28 = addDays(today, -28)

    const [p, meds, future, past] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,age,sex,weight,creatinine,conditions,room_number')).eq('active', true).order('name'),
      safe(scope.filter(supabase.from('patient_meds').select('patient_id')).eq('active', true)),
      safe(scope.filter(supabase.from('shift_assignments').select('date,shift,team_member_id')).gte('date', today).lte('date', in7)),
      safe(scope.filter(supabase.from('shift_assignments').select('date,shift,team_member_id')).gte('date', back28).lt('date', today)),
    ])
    if (p.error) { setErr('Não foi possível carregar. Verifica a ligação.'); setLoading(false); return }

    const counts: Record<string, number> = {}
    ;((meds.data || []) as any[]).forEach(m => { counts[m.patient_id] = (counts[m.patient_id] || 0) + 1 })
    setMedsCount(counts)
    setPatients((p.data || []) as PatientRow[])
    setAssignments((future.data || []) as any[])
    setHistAssignments((past.data || []) as any[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])

  // Complexidade clínica agregada — soma dos scores determinísticos.
  const scored = useMemo(() =>
    patients.map(p => ({ p, score: calcRiskScore({ ...p, meds_count: medsCount[p.id] || 0 } as any) }))
      .sort((a, b) => b.score - a.score)
  , [patients, medsCount])
  const totalLoad = useMemo(() => scored.reduce((s, x) => s + x.score, 0), [scored])

  // Mediana histórica de pessoal por turno (as últimas 4 semanas) — o "normal"
  // desta casa. Só conta turnos que tiveram gente (um turno nunca preenchido
  // no passado não é um padrão, é ausência de dados).
  const historicMedian = useMemo(() => {
    const byKey: Record<string, Set<string>> = {}
    histAssignments.forEach(a => { (byKey[`${a.date}|${a.shift}`] ||= new Set()).add(a.team_member_id) })
    const out: Record<Shift, number | null> = { manha: null, tarde: null, noite: null }
    SHIFTS.forEach(sk => {
      const counts = Object.entries(byKey).filter(([k]) => k.endsWith(`|${sk}`)).map(([, v]) => v.size).filter(n => n > 0).sort((a, b) => a - b)
      out[sk] = counts.length ? counts[Math.floor(counts.length / 2)] : null
    })
    return out
  }, [histAssignments])

  // Datas de calendário de Portugal (strings), não objetos Date — evita o
  // salto de fuso e é exatamente o formato que shift_assignments.date guarda.
  const days = useMemo(() => {
    const t = ptDate()
    return Array.from({ length: 7 }, (_, i) => addDays(t, i))
  }, [])

  function staffOn(date: string, shift: Shift): number {
    return new Set(assignments.filter(a => a.date === date && a.shift === shift).map(a => a.team_member_id)).size
  }

  // Um turno "sob pressão" é: sem ninguém, ou com menos gente do que o
  // habitual DESTA casa para esse turno. Nunca comparado com uma norma
  // externa inventada.
  //
  // Só avaliamos turnos que esta casa COSTUMA preencher (tem mediana
  // histórica). Sem isso não há base de comparação — e sem esta regra, uma
  // instituição que ainda não usa a escala abria a página e via uma parede de
  // alertas vermelhos sem significado nenhum, que é pior do que não ter nada.
  const pressured = useMemo(() => {
    const out: { date: string; shift: Shift; staff: number; median: number }[] = []
    days.forEach(ds => {
      SHIFTS.forEach(sk => {
        // Centro de dia não tem turno da noite — não o avaliamos.
        if (!cfg.hasShifts && sk === 'noite') return
        const med = historicMedian[sk]
        if (med == null) return                  // nunca preenchido → sem base
        const staff = staffOn(ds, sk)
        if (staff < med) out.push({ date: ds, shift: sk, staff, median: med })
      })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, assignments, historicMedian, cfg.hasShifts])

  // Nenhum turno com histórico = a escala ainda não é usada. Dizer isso é
  // mais útil (e honesto) do que fingir uma análise.
  const hasSchedulingHistory = SHIFTS.some(sk => historicMedian[sk] != null)

  const heavy = scored.filter(x => riskLevel(x.score) === 'critical' || riskLevel(x.score) === 'high')

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 70px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Pessoal e carga · {cfg.unitNoun}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Onde a escala pode apertar</h1>
        <p style={{ fontSize: 14.5, color: '#475569', margin: '0 0 14px', lineHeight: 1.55 }}>
          Cruza quem está escalado com o peso real de cuidado de quem cá está. Compara cada turno com o hábito desta casa — não com um rácio inventado.
        </p>

        <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 18 }}>
          ⓘ Apoio à decisão de escala, não uma norma legal. Os rácios de pessoal são matéria regulada e variam com a valência e o grau de dependência — confirme sempre com a legislação aplicável.
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />)}</div>
        ) : err ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 18, color: '#991b1b', fontSize: 14 }}>{err}</div>
        ) : patients.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 12 }}><Icon name="users" size={36} color="#cbd5e1" /></div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#0b1120', marginBottom: 8 }}>Ainda sem {cfg.personNounPlural?.toLowerCase() || 'utentes'}</div>
            <Link href="/patients" style={{ display: 'inline-block', padding: '12px 24px', background: ACCENT, color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Adicionar {cfg.personNoun?.toLowerCase()}</Link>
          </div>
        ) : (
          <>
            {/* Carga clínica agregada */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '14px 20px', flex: '1 1 160px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: '#0b1120', lineHeight: 1 }}>{patients.length}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 5 }}>
                  {patients.length === 1
                    ? `${cfg.personNoun?.toLowerCase() || 'pessoa'} ativo`
                    : `${cfg.personNounPlural?.toLowerCase() || 'pessoas'} ativos`}
                </div>
              </div>
              <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '14px 20px', flex: '1 1 160px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{totalLoad}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 5 }}>carga clínica somada</div>
              </div>
              {heavy.length > 0 && (
                <div style={{ background: 'white', border: '1px solid #fca5a5', borderRadius: 14, padding: '14px 20px', flex: '1 1 160px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: '#b91c1c', lineHeight: 1 }}>{heavy.length}</div>
                  <div style={{ fontSize: 12.5, color: '#991b1b', marginTop: 5 }}>de cuidado exigente</div>
                </div>
              )}
            </div>

            {/* Turnos sob pressão */}
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#0b1120', margin: '0 0 4px', fontWeight: 500 }}>Próximos 7 dias</h2>
            {!hasSchedulingHistory ? (
              <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: '#0b1120', fontWeight: 600, marginBottom: 4 }}>Ainda sem escala preenchida.</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55, marginBottom: 10 }}>
                  Esta leitura compara cada turno com o hábito desta casa. Assim que houver algumas semanas de escala registada, passa a assinalar os turnos que ficam abaixo do habitual.
                </div>
                <Link href="/equipa?tab=escalas" style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>Preencher a escala →</Link>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
                {pressured.length === 0
                  ? 'Nenhum turno abaixo do habitual desta casa.'
                  : `${pressured.length} ${pressured.length === 1 ? 'turno' : 'turnos'} abaixo do habitual.`}
              </p>
            )}

            {pressured.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {pressured.map(({ date, shift, staff, median }) => {
                  const sm = SHIFT_META[shift]
                  const d = new Date(date + 'T12:00:00')
                  const empty = staff === 0
                  return (
                    <div key={`${date}|${shift}`} style={{ background: 'white', border: `1.5px solid ${empty ? '#fca5a5' : '#fde68a'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: sm.color, background: sm.bg, borderRadius: 7, padding: '5px 10px', flexShrink: 0 }}>
                        {WD[d.getDay()]} {d.getDate()}/{d.getMonth() + 1} · {sm.label}
                      </span>
                      <span style={{ flex: 1, minWidth: 140, fontSize: 13.5, color: empty ? '#b91c1c' : '#b45309', fontWeight: 600 }}>
                        {empty
                          ? 'Ninguém escalado'
                          : `${staff} ${staff === 1 ? 'pessoa' : 'pessoas'} — o habitual neste turno é ${median}`}
                      </span>
                      <Link href="/equipa?tab=escalas" style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textDecoration: 'none', flexShrink: 0 }}>Abrir escala →</Link>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quem pesa mais — contexto acionável para decidir a escala */}
            {heavy.length > 0 && (
              <>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#0b1120', margin: '0 0 4px', fontWeight: 500 }}>Quem exige mais cuidado</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>Pelo score clínico determinístico (idade, condições, função renal, número de fármacos) — o mesmo que aparece na ficha.</p>
                <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, overflow: 'hidden' }}>
                  {heavy.slice(0, 8).map(({ p, score }, i) => (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < Math.min(heavy.length, 8) - 1 ? '1px solid #f1f5f9' : 'none', textDecoration: 'none' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: riskLevel(score) === 'critical' ? '#b91c1c' : '#b45309', minWidth: 30 }}>{score}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0b1120' }}>
                        {p.name}{p.room_number ? <span style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>{cfg.roomLabel} {p.room_number}</span> : null}
                      </span>
                      <span style={{ fontSize: 16, color: '#cbd5e1' }}>›</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
