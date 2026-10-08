'use client'

// app/carga/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ONDE A ESCALA PODE APERTAR — refeito de raiz na linguagem da mesa.
//
// O problema que a página resolve: a escala sabe QUEM está em cada turno, e o
// score clínico sabe quão exigentes são os utentes — mas os dois nunca se
// falaram. «Lacuna» na escala era só turno vazio; um turno com uma pessoa para
// vinte residentes muito dependentes contava como coberto.
//
// O que isto NÃO faz, de propósito: não inventa um rácio legal. Os rácios de
// pessoal em ERPI são matéria regulada (Portaria) e variam com a valência e o
// grau de dependência — o Phlox não os vai fingir. Compara cada turno com o
// HÁBITO DA PRÓPRIA CASA (mediana das últimas semanas).
//
// ── O QUE ESTAVA ERRADO NA FORMA ───────────────────────────────────────────
//  1. A SEMANA ERA UMA LISTA DE EXCEPÇÕES. Mostravam-se só os turnos abaixo do
//     habitual, um cartão cada. Quem olha quer ver A SEMANA — para decidir de
//     onde tirar alguém é preciso ver os turnos que estão BEM, e esses não
//     apareciam em sítio nenhum.
//
//     Passa a uma GRELHA de 7 dias × 3 turnos. Vinte e um números num ecrã,
//     alinhados, com o habitual ao lado. É a vista que permite dizer «tire-se
//     uma pessoa da terça de manhã, que tem três e o habitual é dois».
//
//  2. TRÊS INDICADORES GRANDES NO TOPO (pessoas, carga somada, exigentes) em
//     cartões de 28px. «Carga clínica somada: 412» não é accionável: ninguém
//     sabe se 412 é muito. Ficam na barra, pequenos, ao lado do que importa.
//
//  3. A ADVERTÊNCIA ERA UMA CAIXA DE TRÊS LINHAS no topo. Vai para a barra de
//     estado, sempre visível, sem empurrar o trabalho para baixo.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { riskScore as calcRiskScore, riskLevel } from '@/lib/riskScore'
import { ptDate } from '@/lib/ptTime'
import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

type Shift = 'manha' | 'tarde' | 'noite'
const SHIFTS: Shift[] = ['manha', 'tarde', 'noite']

// -- OS TURNOS DEIXARAM DE TER COR PROPRIA (2026-10-07) ---------------------
// Eram tres cores: ambar de manha, azul a tarde, roxo a noite. O que os matou
// foi uma coisa concreta: o ambar passou a querer dizer «a precisar de
// atencao». Com a manha pintada de ambar, metade dos ecras de uma casa
// ficavam com um aviso falso das sete as duas da tarde -- todos os dias.
const ROTULO_TURNO: Record<Shift, string> = {
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite',
}
const HORAS_TURNO: Record<Shift, string> = {
  manha: '07–14h', tarde: '14–21h', noite: '21–07h',
}
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// BUG CORRIGIDO 2026-08-21: usava-se `d.setHours(0,0,0,0)` + `toISOString()`,
// que devolve a data em UTC. Em Portugal no verão (WEST, UTC+1) a meia-noite
// local é 23:00 do dia ANTERIOR em UTC — ou seja, entre as 00:00 e a 01:00 a
// janela inteira dos "próximos 7 dias" andava um dia para trás: mostrava
// ontem (passado, inútil) e perdia o 7.º dia. Confirmado ao vivo.
const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

interface PatientRow {
  id: string; name: string; age: number | null; sex: string | null
  weight: number | null; creatinine: number | null
  conditions: string | null; room_number: string | null
}

export default function CargaPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const largo = useLargo()

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
    if (p.error) { setErr('Não foi possível carregar. Verifique a ligação.'); setLoading(false); return }

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

  // Mediana histórica de pessoal por turno (as últimas 4 semanas) — o «normal»
  // desta casa. Só conta turnos que tiveram gente: um turno nunca preenchido
  // no passado não é um padrão, é ausência de dados.
  const historicMedian = useMemo(() => {
    const byKey: Record<string, Set<string>> = {}
    histAssignments.forEach(a => { (byKey[`${a.date}|${a.shift}`] ||= new Set()).add(a.team_member_id) })
    const out: Record<Shift, number | null> = { manha: null, tarde: null, noite: null }
    SHIFTS.forEach(sk => {
      const counts = Object.entries(byKey)
        .filter(([k]) => k.endsWith(`|${sk}`))
        .map(([, v]) => v.size)
        .filter(n => n > 0)
        .sort((a, b) => a - b)
      out[sk] = counts.length ? counts[Math.floor(counts.length / 2)] : null
    })
    return out
  }, [histAssignments])

  // Datas de calendário de Portugal (strings), não objetos Date — evita o
  // salto de fuso e é exactamente o formato que shift_assignments.date guarda.
  const days = useMemo(() => {
    const t = ptDate()
    return Array.from({ length: 7 }, (_, i) => addDays(t, i))
  }, [])

  const porTurno = useMemo(() => {
    const m: Record<string, Set<string>> = {}
    assignments.forEach(a => { (m[`${a.date}|${a.shift}`] ||= new Set()).add(a.team_member_id) })
    return m
  }, [assignments])

  const staffOn = useCallback(
    (date: string, shift: Shift) => porTurno[`${date}|${shift}`]?.size || 0,
    [porTurno])

  /* Os turnos que esta casa AVALIA. Um centro de dia não tem noite; e um turno
     que esta casa nunca preencheu no passado não tem base de comparação —
     sem esta regra, quem ainda não usa a escala abria a página e via uma
     parede de alertas vermelhos sem significado nenhum. */
  const turnosAvaliados = useMemo(
    () => SHIFTS.filter(sk => (cfg.hasShifts || sk !== 'noite') && historicMedian[sk] != null),
    [cfg.hasShifts, historicMedian])

  const turnosMostrados = useMemo(
    () => SHIFTS.filter(sk => cfg.hasShifts || sk !== 'noite'),
    [cfg.hasShifts])

  const pressured = useMemo(() => {
    const out: { date: string; shift: Shift; staff: number; median: number }[] = []
    days.forEach(ds => {
      turnosAvaliados.forEach(sk => {
        const med = historicMedian[sk]!
        const staff = staffOn(ds, sk)
        if (staff < med) out.push({ date: ds, shift: sk, staff, median: med })
      })
    })
    return out
  }, [days, turnosAvaliados, historicMedian, staffOn])

  // Nenhum turno com histórico = a escala ainda não é usada. Dizer isso é mais
  // útil (e honesto) do que fingir uma análise.
  const hasSchedulingHistory = turnosAvaliados.length > 0

  const heavy = scored.filter(x => riskLevel(x.score) === 'critical' || riskLevel(x.score) === 'high')

  /* A COR DE UMA CÉLULA DA GRELHA
     Três estados, e o cinzento de «não se avalia»:
       vermelho   ninguém escalado
       âmbar      abaixo do habitual desta casa
       verde      no habitual ou acima
       cinzento   esta casa nunca preencheu este turno — sem base */
  function celula(date: string, shift: Shift) {
    const med = historicMedian[shift]
    const staff = staffOn(date, shift)
    if (med == null) return { staff, med, cor: 'var(--ink-5)' as string, sinal: '·' }
    if (staff === 0) return { staff, med, cor: 'var(--red)', sinal: '0' }
    if (staff < med) return { staff, med, cor: 'var(--amber)', sinal: String(staff) }
    return { staff, med, cor: 'var(--green)', sinal: String(staff) }
  }

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Pessoal e carga</span>

          <span style={{ display: 'inline-flex', gap: 14, alignItems: 'center' }}>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              {patients.length} {(patients.length === 1 ? cfg.personNoun : cfg.personNounPlural)?.toUpperCase() || 'PESSOAS'}
            </span>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
              CARGA SOMADA {totalLoad}
            </span>
            {heavy.length > 0 && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
                {heavy.length} DE CUIDADO EXIGENTE
              </span>
            )}
            {hasSchedulingHistory && (
              <span style={{
                ...MONO, fontSize: 'var(--t-meta)',
                color: pressured.length ? 'var(--amber)' : 'var(--green)',
                fontWeight: 'var(--peso-forte)' as any,
              }}>
                {pressured.length === 0
                  ? 'NENHUM TURNO ABAIXO DO HABITUAL'
                  : `${pressured.length} TURNO${pressured.length === 1 ? '' : 'S'} ABAIXO DO HABITUAL`}
              </span>
            )}
          </span>

          <div style={{ marginLeft: 'auto' }}>
            <Link href="/equipa?tab=escalas" style={{ textDecoration: 'none' }}>
              <Botao feitio="principal">ABRIR A ESCALA →</Botao>
            </Link>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>No habitual desta casa, ou acima</span>
          <span style={{ ...MONO, color: 'var(--amber)' }}>Abaixo do habitual</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Ninguém escalado</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>· = esta casa nunca preencheu este turno</span>
          {/* Não cabe numa linha de legenda, e a barra de estado é uma linha.
              A frase curta fica, o texto inteiro vai no `title` — e está por
              extenso no aviso de quando a escala ainda não tem histórico, que
              é o momento em que alguém o lê. */}
          <span title="Apoio à decisão de escala, não uma norma legal. Os rácios de pessoal em ERPI são matéria regulada e variam com a valência e o grau de dependência — confirme sempre com a legislação aplicável."
            style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
            APOIO À DECISÃO — NÃO É NORMA LEGAL
          </span>
        </BarraDeEstado>
      }
    >
      {err && <Aviso tom="mau">{err}</Aviso>}

      {loading ? (
        <Painel><ACarregar oQue="A cruzar a escala com o peso do cuidado…" /></Painel>
      ) : patients.length === 0 ? (
        <Painel>
          <Vazio titulo={`Ainda não há ${(cfg.personNounPlural || 'utentes').toLowerCase()} nesta casa.`}
            oQueFazer="Esta leitura cruza quem está escalado com o peso real de cuidado de quem cá está. Sem fichas não há peso para medir."
            acao={<Link href="/patients" style={{ textDecoration: 'none' }}>
              <Botao feitio="principal">ADICIONAR {(cfg.personNoun || 'pessoa').toUpperCase()} →</Botao>
            </Link>} />
        </Painel>
      ) : (
        <div style={{
          display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
          gridTemplateColumns: largo ? 'minmax(420px, 1fr) minmax(320px, 420px)' : '1fr',
        }}>
          {/* ══ A SEMANA, INTEIRA ══════════════════════════════════════════════
              Era uma lista só das excepções. Para decidir de onde tirar alguém
              é preciso ver os turnos que estão BEM — e esses não apareciam. */}
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 76 }}>Dia</span>
                {turnosMostrados.map(sk => (
                  <span key={sk} style={{ ...ROTULO, flex: 1, textAlign: 'center' }}>
                    {ROTULO_TURNO[sk]}
                    <span style={{ color: 'var(--ink-5)' }}> {HORAS_TURNO[sk]}</span>
                  </span>
                ))}
              </Cabecalho>
            }
            rodape={
              hasSchedulingHistory ? (
                <>
                  <span style={MONO}>
                    O habitual desta casa:{' '}
                    {turnosAvaliados.map(sk => `${ROTULO_TURNO[sk].toLowerCase()} ${historicMedian[sk]}`).join(' · ')}
                  </span>
                  <span style={{ ...MONO, color: 'var(--ink-5)', marginLeft: 'auto' }}>
                    mediana das últimas 4 semanas
                  </span>
                </>
              ) : (
                <span style={MONO}>Sem semanas de escala registadas — nada a comparar</span>
              )
            }
          >
            {!hasSchedulingHistory && (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-2)' }}>
                <Aviso tom="neutro" titulo="A escala ainda não está preenchida">
                  Esta leitura compara cada turno com o hábito desta casa. Assim que houver
                  algumas semanas de escala registada, passa a assinalar os turnos que ficam
                  abaixo do habitual. Os números em baixo são o que já está marcado.
                </Aviso>
              </div>
            )}

            {days.map((ds, i) => {
              const d = new Date(ds + 'T12:00:00')
              const hoje = i === 0
              const fds = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={ds} style={{
                  display: 'flex', alignItems: 'stretch', gap: 10,
                  padding: '0 12px', borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${hoje ? 'var(--green)' : 'transparent'}`,
                  background: fds ? 'var(--bg-2)' : 'transparent',
                }}>
                  <span style={{
                    width: 76, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', padding: '8px 0',
                  }}>
                    <span style={{
                      ...MONO, fontSize: 'var(--t-dado)',
                      fontWeight: hoje ? 'var(--peso-forte)' as any : 'var(--peso-corpo)' as any,
                      color: hoje ? 'var(--green)' : 'var(--ink-2)',
                    }}>{WD[d.getDay()]} {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}</span>
                    {(hoje || fds) && (
                      <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                        {hoje ? 'HOJE' : 'FIM DE SEMANA'}
                      </span>
                    )}
                  </span>

                  {turnosMostrados.map(sk => {
                    const c = celula(ds, sk)
                    return (
                      <span key={sk} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 6, padding: '8px 0',
                      }}>
                        <span style={{
                          ...MONO, fontSize: 'var(--t-destaque)', lineHeight: 1,
                          fontWeight: 'var(--peso-forte)' as any, color: c.cor,
                        }}>{c.sinal}</span>
                        {c.med != null && (
                          <span style={{ ...MONO, fontSize: 'var(--t-micro)', color: 'var(--ink-5)' }}>
                            /{c.med}
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </Painel>

          {/* ══ QUEM EXIGE MAIS CUIDADO ════════════════════════════════════════ */}
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, width: 36, textAlign: 'right' }}>Nº</span>
                <span style={{ ...ROTULO, flex: 1 }}>Quem exige mais cuidado</span>
                <span style={{ ...ROTULO, width: 44, textAlign: 'right' }}>{cfg.roomLabel}</span>
              </Cabecalho>
            }
            rodape={
              <span style={MONO}>
                Pelo score clínico — idade, condições, função renal, nº de fármacos
              </span>
            }
          >
            {heavy.length === 0 ? (
              <Vazio titulo="Ninguém no patamar de cuidado exigente."
                oQueFazer="O score sai da idade, das condições registadas, da função renal e do número de fármacos. Se faltam dados nas fichas, o score sai mais baixo do que a realidade." />
            ) : scored.slice(0, 40).map(({ p, score }) => {
              const nivel = riskLevel(score)
              const cor = nivel === 'critical' ? 'var(--red)'
                : nivel === 'high' ? 'var(--amber)'
                : nivel === 'moderate' ? 'var(--ink-3)' : 'var(--ink-5)'
              return (
                <LinhaTabela key={p.id} href={`/patients/${p.id}`}
                  filete={nivel === 'critical' ? 'var(--red)' : undefined}
                  antes={{
                    largura: 36,
                    conteudo: (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: cor,
                      }}>{score}</span>
                    ),
                  }}
                  principal={p.name}
                  celulas={[
                    {
                      rotulo: cfg.roomLabel, valor: p.room_number || '—', largura: 44, direita: true,
                      cor: p.room_number ? 'var(--ink-4)' : 'var(--ink-5)',
                    },
                  ]} />
              )
            })}
          </Painel>
        </div>
      )}
    </Mesa>
  )
}
