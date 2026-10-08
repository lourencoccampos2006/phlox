'use client'

// /preparacao-medicacao — NOVO 2026-08-11. Auditoria direta contra o serviço
// "preparação em unidoses" de um centro de dia real: /mar já regista a TOMA
// (dar o medicamento) com grau de auditoria alto, mas o ato físico de
// preparar o pastilheiro/blister da semana nunca tinha registo nenhum em
// lado nenhum — nem tabela, nem página. Esta ferramenta gera a grelha de
// preparação a partir dos dados que JÁ EXISTEM (patient_meds.shifts, a
// mesma fonte que /mar usa) — não pede para reintroduzir nada.
//
// Uma coluna por turno (só os turnos que alguém dessa pessoa realmente usa —
// esconder colunas vazias), uma linha por dia da semana, um toque marca
// "preparado". supabase/sprint130_diabetic_prep_psychosocial.sql
// (medication_prep_logs) — por aplicar.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import ListaDePicking from '@/components/institution/ListaDePicking'
import { blueprintFor } from '@/lib/institutionBlueprint'
import Icon from '@/components/Icon'
import { clinicalFindingsFor, SEVERITY_META, type Finding } from '@/lib/medPrepIntel'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import { registar, ACOES } from '@/lib/registo'

interface Patient {
  id: string; name: string; room_number: string | null
  age: number | null; egfr: number | null; conditions: string | null; allergies: string | null; last_review: string | null
}
interface Med { id: string; patient_id: string; name: string; dose: string | null; shifts: string[] | null; active: boolean; started_at: string | null }
interface PrepLog { id: string; patient_id: string; weekday: number; shift: string; packed: boolean }

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SHIFTS = ['manha', 'tarde', 'noite'] as const
const SHIFT_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10) }

import {
  LinhaTabela, Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Vazio, ACarregar, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function PreparacaoMedicacaoPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('medicacao', 'editar')
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const toast = useToast()

  const [weekStart, setWeekStart] = useState(() => fmtDate(startOfWeek(new Date())))
  const [patients, setPatients] = useState<Patient[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [logs, setLogs] = useState<PrepLog[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const largo = useLargo()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [stock, setStock] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [pats, mds, lgs, stk] = await Promise.all([
      scope.filter(supabase.from('patients').select('id,name,room_number,age,egfr,conditions,allergies,last_review')).eq('active', true).order('name'),
      scope.filter(supabase.from('patient_meds').select('id,patient_id,name,dose,shifts,started_at')).eq('active', true),
      scope.filter(supabase.from('medication_prep_logs').select('id,patient_id,weekday,shift,packed')).eq('week_start', weekStart),
      // Para a lista de picking saber o que há. Tolerante: sem stock, a lista
      // sai à mesma, só sem a coluna de existências.
      scope.filter(supabase.from('stock_items').select('name,quantity,unit,min_quantity')).eq('category', 'medicamento')
        .then((r: any) => r, () => ({ data: [] })),
    ])
    if (lgs.error && /does not exist|schema cache/i.test(lgs.error.message)) { setNeedsSetup(true); setLoading(false); return }
    setNeedsSetup(false)
    setPatients(pats.data || [])
    setMeds(mds.data || [])
    setLogs(lgs.data || [])
    setStock((stk as any)?.data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId, weekStart])

  useEffect(() => { load() }, [load])

  function medsFor(patientId: string) { return meds.filter(m => m.patient_id === patientId) }
  // Turnos realmente usados por esta pessoa — esconder colunas vazias (ninguém
  // toma nada de noite? a coluna "Noite" nem aparece, menos para preparar de vez).
  function shiftsFor(patientId: string): string[] {
    const ms = medsFor(patientId)
    if (ms.some(m => !m.shifts || m.shifts.length === 0)) return [...SHIFTS] // sem turno definido = todos
    const used = new Set<string>()
    ms.forEach(m => (m.shifts || []).forEach(s => used.add(s)))
    return SHIFTS.filter(s => used.has(s))
  }
  function logFor(patientId: string, weekday: number, shift: string) { return logs.find(l => l.patient_id === patientId && l.weekday === weekday && l.shift === shift) }
  // Co-piloto clínico (Módulo 1): cruza a medicação ativa com o motor de
  // regras (lib/decisionEngine, via lib/medPrepIntel) — nunca um checklist
  // sem mais nada por trás. Só os achados major/critical aparecem por
  // omissão (ver renderização); o resto fica disponível ao expandir.
  function findingsFor(patient: Patient): Finding[] {
    return clinicalFindingsFor(patient, medsFor(patient.id).map(m => ({ name: m.name, started_at: m.started_at })))
  }

  async function toggle(patientId: string, weekday: number, shift: string) {
    if (!podeEditar) { toast.error('Só leitura', MSG.readonly); return }
    const existing = logFor(patientId, weekday, shift)
    const nextPacked = !existing?.packed
    // NÃO usa scope.stamp aqui, de propósito. O stamp acrescenta sempre
    // `recorded_by_id` quando a conta pertence a uma organização — e esta
    // tabela não tem essa coluna (tem `packed_by_id`, que diz o mesmo e é a
    // certa). O PostgREST rejeita o pedido inteiro por causa da coluna que não
    // existe, e a marcação falhava com "Não foi possível marcar" para TODAS as
    // contas institucionais, enquanto funcionava em contas individuais — que é
    // exatamente onde isto tinha sido testado. Mesmo bug do sprint124.
    const { data, error } = await supabase.from('medication_prep_logs').upsert({
      ...(scope.orgId ? { org_id: scope.orgId } : {}),
      user_id: user.id, patient_id: patientId, week_start: weekStart, weekday, shift,
      packed: nextPacked, packed_by_id: nextPacked ? user.id : null, packed_at: nextPacked ? new Date().toISOString() : null,
    }, { onConflict: 'patient_id,week_start,weekday,shift' }).select().single()
    if (error) { toast.error('Não foi possível marcar', reportError('prep-toggle', error, MSG.save)); return }
    const quem = patients.find(x => x.id === patientId)
    const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    registar({ supabase, scope, user }, {
      ...(nextPacked
        ? ACOES.pastilheiroPreparado(quem?.name || 'utente', DIAS[weekday] || String(weekday), SHIFT_LABEL[shift] || shift)
        : ACOES.pastilheiroDesfeito(quem?.name || 'utente', DIAS[weekday] || String(weekday), SHIFT_LABEL[shift] || shift)),
      subjectId: patientId, subjectName: quem?.name || null, entityId: patientId,
      meta: { semana: weekStart, dia: weekday, turno: shift },
    })
    setLogs(prev => { const rest = prev.filter(l => !(l.patient_id === patientId && l.weekday === weekday && l.shift === shift)); return data ? [...rest, data] : rest })
  }

  function weekLabel() {
    const d0 = new Date(weekStart + 'T12:00:00')
    const d6 = new Date(d0); d6.setDate(d6.getDate() + 6)
    return `${d0.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} – ${d6.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`
  }
  function shiftWeek(delta: number) {
    const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + delta * 7)
    setWeekStart(fmtDate(d))
  }

  const filtered = patients.filter(p => (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())) && medsFor(p.id).length > 0)

  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ maxWidth: 620 }}>
          <AvisoDeSetup codigo="PHX-K7" oQue="A preparação da medicação ainda não está disponível nesta conta." />
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Era um acordeão: cada pessoa abria uma grelha de sete dias por N turnos
     dentro da própria linha. Com trinta pessoas, abrir a terceira empurrava a
     quarta trezentos pixéis para baixo.

     Passa a mestre/detalhe: a lista à esquerda com o que falta preparar em
     coluna, a grelha da semana à direita.
     ══════════════════════════════════════════════════════════════════════════ */
  const aberta = filtered.find(p => p.id === open) || null

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Preparação</span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Botao onClick={() => shiftWeek(-1)} titulo="Semana anterior">‹</Botao>
            <span style={{
              ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
              color: 'var(--ink-2)', minWidth: 130, textAlign: 'center',
            }}>{weekLabel()}</span>
            <Botao onClick={() => shiftWeek(1)} titulo="Semana seguinte">›</Botao>
          </span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Procurar ${cfg.personNoun.toLowerCase()}…`} aria-label="Procurar"
            style={{ ...CAIXA, width: 230 }} />

          {!loading && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
              A GRELHA DIZ QUEM PREPAROU O QUÊ, DIA A DIA
            </span>
          )}
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--green)' }}>Semana preparada</span>
          <span style={{ ...MONO, color: 'var(--red)' }}>Com alerta — ver antes de preparar</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Cada marca fica com a data e com quem a fez
          </span>
        </BarraDeEstado>
      }
    >
      {/* O que é preciso ter em cima da mesa ANTES de começar a preparar.
          A grelha diz o que já se fez; isto diz o que falta ir buscar. */}
      {!loading && (
        <ListaDePicking meds={meds} stock={stock} dias={7} cor="var(--green)" />
      )}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo && aberta ? 'minmax(320px, 440px) minmax(380px, 1fr)' : '1fr',
      }}>
        {(largo || !aberta) && (
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural}</span>
                <span style={{ ...ROTULO, width: 48, textAlign: 'right' }}>Meds</span>
                <span style={{ ...ROTULO, width: 78, textAlign: 'right' }}>Semana</span>
              </Cabecalho>
            }
            rodape={<span style={MONO}>{filtered.length} com medicação ativa</span>}
          >
            {loading ? (
              <ACarregar oQue="A juntar a semana…" />
            ) : filtered.length === 0 ? (
              <Vazio titulo="Ninguém com medicação ativa para preparar."
                oQueFazer="Esta grelha faz-se da medicação ativa de cada pessoa. Assim que houver prescrições, aparecem aqui com um alvo por dia e por turno." />
            ) : filtered.map(p => {
              const ms = medsFor(p.id)
              const shifts = shiftsFor(p.id)
              const findings = findingsFor(p)
              const notable = findings.filter(f => f.severity === 'critical' || f.severity === 'major')
              const packedCount = WEEKDAY_LABELS.reduce(
                (n, _, wd) => n + shifts.filter(sh => logFor(p.id, wd, sh)?.packed).length, 0)
              const totalCount = WEEKDAY_LABELS.length * shifts.length
              const feita = packedCount === totalCount && totalCount > 0
              return (
                <LinhaTabela key={p.id}
                  aoTocar={() => setOpen(open === p.id ? null : p.id)}
                  ativa={open === p.id}
                  filete={notable.length ? 'var(--red)' : undefined}
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
                  secundaria={notable.length
                    ? `${notable.length} alerta${notable.length === 1 ? '' : 's'} a ver antes de preparar`
                    : undefined}
                  celulas={[
                    { rotulo: 'Meds', valor: ms.length, largura: 48, direita: true },
                    {
                      rotulo: 'Semana', valor: `${packedCount}/${totalCount}`, largura: 78,
                      direita: true, forte: true,
                      cor: feita ? 'var(--green)' : packedCount ? 'var(--amber)' : 'var(--ink-5)',
                    },
                  ]} />
              )
            })}
          </Painel>
        )}

        {/* ══ A SEMANA DE QUEM ESTÁ ESCOLHIDO ═══════════════════════════════ */}
        {aberta ? (() => {
          const p = aberta
          const ms = medsFor(p.id)
          const shifts = shiftsFor(p.id)
          const findings = findingsFor(p)
          return (
            <Painel
              cabeca={
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Botao onClick={() => setOpen(null)}>← {largo ? 'FECHAR' : 'LISTA'}</Botao>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block', fontSize: 'var(--t-destaque)',
                      fontWeight: 'var(--peso-corpo)' as any,
                    }}>{p.name}</span>
                    <span style={{ ...MONO, display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                      {weekLabel().toUpperCase()} · {ms.length} MEDICAMENTO{ms.length === 1 ? '' : 'S'}
                    </span>
                  </span>
                </div>
              }
            >
              <div style={{ padding: '0 14px 14px' }}>
                {/* Os achados clínicos. Vêm ANTES da grelha, de propósito:
                    quem vai preparar tem de os ver antes de pôr no pastilheiro. */}
                {findings.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ ...ROTULO, marginBottom: 6 }}>Ver antes de preparar</div>
                    {findings.map(f => {
                      const meta = SEVERITY_META[f.severity]
                      return (
                        <div key={f.id} style={{
                          padding: '8px 0 8px 11px', borderBottom: '1px solid var(--border)',
                          borderLeft: `3px solid ${meta.color}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.06em',
                              fontWeight: 'var(--peso-forte)' as any, color: meta.color,
                              textTransform: 'uppercase',
                            }}>{meta.label}</span>
                            <span style={{
                              fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any,
                              color: 'var(--ink)',
                            }}>{f.title}</span>
                          </div>
                          <div style={{
                            fontSize: 'var(--t-meta)', color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 2,
                          }}>{f.detail}</div>
                          {f.action && (
                            <div style={{
                              fontSize: 'var(--t-meta)', color: meta.color,
                              fontWeight: 'var(--peso-corpo)' as any, marginTop: 3,
                            }}>→ {f.action}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ ...ROTULO, margin: '14px 0 6px' }}>O que leva</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {ms.map(m => (
                    <Codigo key={m.id} texto={`${m.name}${m.dose ? ` ${m.dose}` : ''}`} />
                  ))}
                </div>

                <div style={{ ...ROTULO, margin: '16px 0 6px' }}>A semana</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    borderCollapse: 'collapse', width: '100%',
                    minWidth: shifts.length * 80 + 90,
                  }}>
                    <thead>
                      <tr>
                        <th style={{ ...ROTULO, textAlign: 'left', padding: '5px 8px' }}>Dia</th>
                        {shifts.map(sh => (
                          <th key={sh} style={{ ...ROTULO, padding: '5px 8px' }}>{SHIFT_LABEL[sh]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WEEKDAY_LABELS.map((label, wd) => (
                        <tr key={wd}>
                          <td style={{
                            padding: '4px 8px', fontSize: 'var(--t-dado)',
                            color: 'var(--ink-3)', borderTop: '1px solid var(--border)',
                          }}>
                            <span className="prep-weekday-full">{label}</span>
                            <span className="prep-weekday-short">{WEEKDAY_SHORT[wd]}</span>
                          </td>
                          {shifts.map(sh => {
                            const packed = !!logFor(p.id, wd, sh)?.packed
                            return (
                              <td key={sh} style={{
                                padding: '4px 8px', textAlign: 'center',
                                borderTop: '1px solid var(--border)',
                              }}>
                                <button onClick={() => toggle(p.id, wd, sh)}
                                  aria-label={`${label} · ${SHIFT_LABEL[sh]}`}
                                  aria-pressed={packed}
                                  className="mesa-botao"
                                  style={{
                                    width: 30, padding: 0, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                                    border: `1px solid ${packed ? 'var(--green)' : 'var(--border-2)'}`,
                                    background: packed ? 'var(--green)' : 'transparent',
                                    color: packed ? 'var(--sobre-acento)' : 'var(--ink-5)',
                                    fontSize: 'var(--t-dado)',
                                    fontWeight: 'var(--peso-forte)' as any,
                                  }}>{packed ? '✓' : ''}</button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Painel>
          )
        })() : largo ? (
          <Painel>
            <Vazio titulo={`Escolha um ${cfg.personNoun.toLowerCase()}.`}
              oQueFazer="A semana abre aqui ao lado, com um alvo por dia e por turno — e com os alertas da medicação em cima, para se verem antes de pôr seja o que for no pastilheiro." />
          </Painel>
        ) : null}
      </div>

      <style>{`
        .prep-weekday-short { display: none }
        @media (max-width: 480px) {
          .prep-weekday-full { display: none }
          .prep-weekday-short { display: inline }
        }
      `}</style>
    </Mesa>
  )
}
