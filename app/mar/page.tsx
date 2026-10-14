'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Vazio, Aviso,
  Codigo, Bandeira, Segmentos, Botao, Seletor, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError, MSG } from '@/lib/clientError'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig, shiftsFor, currentShiftFor } from '@/lib/institutionConfig'
import { printDoc, type PrintRecord } from '@/lib/print'
import ClinicalGate from '@/components/ClinicalGate'
import Icon from '@/components/Icon'
import Link from 'next/link'
import { clinicalFindingsFor, SEVERITY_META, type Finding } from '@/lib/medPrepIntel'
import { registar, ACOES } from '@/lib/registo'

/* ONDE SE TOMA NAO E UM ESTADO (2026-10-07)
   Estes tres selos diziam onde cada medicamento e tomado — a ponte casa↔centro
   de um centro de dia. «Em casa» vinha a ambar e «no centro» a turquesa.

   Duas coisas erradas numa so peca. O ambar, no resto da aplicacao, quer dizer
   «a precisar de atencao»: num centro onde metade da medicacao e tomada em
   casa, isso enchia a folha de avisos falsos. E a turquesa nao existe no
   codigo de cores — era uma quinta cor que ninguem sabia ler.

   Onde se toma e um FACTO da prescricao. Fica em mono, neutro, como todos os
   outros factos: o que se le e a palavra, nao a cor. */
function LocBadge({ loc }: { loc?: string | null }) {
  const texto = loc === 'casa' ? 'CASA' : loc === 'ambos' ? 'CASA+CENTRO' : 'CENTRO'
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)',
      fontWeight: 'var(--peso-forte)' as any, letterSpacing: '.06em',
      color: 'var(--ink-4)', border: '1px solid var(--border-2)',
      borderRadius: 'var(--r-sm)', padding: '1px 5px', whiteSpace: 'nowrap',
    }}>{texto}</span>
  )
}

interface Patient {
  id: string; name: string; age: number | null; room_number: string | null
  conditions: string | null; allergies: string | null; egfr?: number | null; last_review?: string | null
}
interface PatientMed { id: string; name: string; dose: string | null; frequency: string | null; indication: string | null; shifts?: string[] | null; take_location?: 'centro' | 'casa' | 'ambos' | null; started_at?: string | null; sos?: boolean | null; sos_para?: string | null; sos_max_dia?: number | null; sos_intervalo_horas?: number | null }
type Shift = 'manha' | 'tarde' | 'noite'
type AdminStatus = 'administered' | 'refused' | 'held' | null
interface AdminRecord {
  id?: string; patient_id: string; med_id: string; shift: Shift; date: string
  status: AdminStatus; notes: string; recorded_by: string; recorded_at: string
}

// -- OS TURNOS DEIXARAM DE TER COR PROPRIA (2026-10-07) ---------------------
// Eram tres cores: ambar de manha, azul a tarde, roxo a noite. Com o ambar a
// querer dizer «a precisar de atencao», metade dos ecras de uma casa ficavam
// com um aviso falso das sete as duas da tarde, todos os dias.
const SHIFTS: Record<Shift, { label: string; time: string; color: string; light: string; border: string }> = {
  manha: { label: 'Manhã',  time: '07–14h', color: 'var(--ink-3)', light: 'var(--bg-2)', border: 'var(--border)' },
  tarde: { label: 'Tarde',  time: '14–21h', color: 'var(--ink-3)', light: 'var(--bg-2)', border: 'var(--border)' },
  noite: { label: 'Noite',  time: '21–07h', color: 'var(--ink-3)', light: 'var(--bg-2)', border: 'var(--border)' },
}
const STATUS_CFG = {
  administered: { label: 'Administrado', short: '✓', color: 'var(--green)', bg: 'var(--badge-green-bg)', border: 'var(--badge-green-border)' },
  refused:      { label: 'Recusado',     short: '✗', color: 'var(--red)', bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)' },
  held:         { label: 'Suspenso',     short: '⏸', color: 'var(--amber)', bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)' },
}

const ANTICOAG = ['varfarina','acenocumarol','warfarin','rivaroxabano','apixabano','dabigatrano','heparina','enoxaparina']
const NSAID    = ['ibuprofeno','diclofenac','naproxeno','meloxicam','piroxicam','indometacina','celecoxib']
const SSRI     = ['fluoxetina','sertralina','paroxetina','citalopram','escitalopram','fluvoxamina']
const MAOI     = ['fenelzina','tranilcipromina','moclobemida','rasagilina','selegilina']
const DIGOXIN  = ['digoxina']
const AMIO     = ['amiodarona']

function allergyWarning(allergies: string | null, med: string): string | null {
  if (!allergies) return null
  const tokens = allergies.toLowerCase().split(/[,;/\s]+/).filter(t => t.length >= 4)
  const hit = tokens.find(t => med.toLowerCase().includes(t) || t.includes(med.toLowerCase().split(' ')[0]))
  return hit ? `Alergia documentada "${hit}" — confirmar antes de administrar` : null
}
function interactionWarnings(med: string, others: string[]): string[] {
  const n = med.toLowerCase(); const o = others.map(x => x.toLowerCase())
  const has = (terms: string[]) => o.some(x => terms.some(t => x.includes(t)))
  const is = (terms: string[]) => terms.some(t => n.includes(t))
  const w: string[] = []
  if (is(NSAID) && has(ANTICOAG))    w.push('AINE + anticoagulante — risco de hemorragia grave')
  if (is(ANTICOAG) && has(NSAID))    w.push('Anticoagulante + AINE — risco de hemorragia grave')
  if (is(SSRI) && has(MAOI))         w.push('ISRS + IMAO — risco de síndrome serotoninérgica')
  if (is(MAOI) && has(SSRI))         w.push('IMAO + ISRS — risco de síndrome serotoninérgica')
  if (is(DIGOXIN) && has(AMIO))      w.push('Digoxina + amiodarona — risco de toxicidade')
  if (is(AMIO) && has(DIGOXIN))      w.push('Amiodarona + digoxina — risco de toxicidade')
  return w
}

// Med é devido neste turno? (shifts vazio/null = todos os turnos, compat. retro)
//
// Um SOS nunca é devido: dá-se quando é preciso. E como um SOS tem `shifts`
// vazio — e vazio quer dizer «todos os turnos» — ele aparecia aqui como dose
// por dar em CADA turno de CADA dia, para sempre. A grelha de medicação ficava
// com linhas que nunca se podem marcar, e quem trabalha aprende a ignorá-las.
//
// As tomas SOS registam-se à parte, com a hora e o motivo (lib/sos.ts).
function dueInShift(med: { shifts?: string[] | null; sos?: boolean | null }, shift: Shift): boolean {
  if (med.sos) return false
  return !med.shifts || med.shifts.length === 0 || med.shifts.includes(shift)
}

function getToday() { return new Date().toISOString().split('T')[0] }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

/* ══════════════════════════════════════════════════════════════════════════
   O REGISTO DE UMA TOMA
   ══════════════════════════════════════════════════════════════════════════
   ── O QUE ESTAVA MAL ──────────────────────────────────────────────────────
   Eram três botões com o nome por extenso — «Administrado», «Recusado»,
   «Suspenso» — e, numa coluna estreita, empilhavam-se. Cada linha de
   medicação passava a ter três andares, e catorze medicamentos enchiam dois
   ecrãs com palavras que já estão na legenda do fundo.

   ── O QUE FAZ AGORA ───────────────────────────────────────────────────────
   Três quadrados de 30px lado a lado: ✓ ✗ ⏸. Os símbolos são os mesmos que a
   barra de estado explica, e cada um tem o nome por extenso no `title` para
   quem passar o rato ou usar um leitor de ecrã.

   Depois de registado, encolhe para UM símbolo com a hora e o nome de quem
   registou — que é a informação que interessa a seguir, e não os botões.
   ══════════════════════════════════════════════════════════════════════════ */
function AdminCell({ record, isSaving, onChange }: { record: AdminRecord | null; isSaving: boolean; onChange: (s: AdminStatus, notes: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [notas, setNotas] = useState(record?.notes || '')

  const quadrado = (st: NonNullable<AdminStatus>, escolhido: boolean) => {
    const c = STATUS_CFG[st]
    return (
      <button key={st} type="button" title={c.label}
        aria-label={c.label} aria-pressed={escolhido}
        onClick={() => onChange(escolhido ? null : st, notas)}
        style={{
          width: 30, height: 30, flexShrink: 0, padding: 0,
          borderRadius: 'var(--r-sm)', cursor: 'pointer',
          border: escolhido ? 'none' : `1px solid var(--border-2)`,
          background: escolhido ? c.color : 'transparent',
          color: escolhido ? 'var(--sobre-acento)' : 'var(--ink-5)',
          fontSize: 'var(--t-corpo)', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{c.short}</button>
    )
  }

  // Já registado: um símbolo, a hora, quem foi.
  if (record?.status) {
    const c = STATUS_CFG[record.status]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: isSaving ? 0.5 : 1 }}>
        <button type="button" onClick={() => setAberto(true)} title="Alterar este registo"
          style={{
            width: 30, height: 30, flexShrink: 0, padding: 0, borderRadius: 'var(--r-sm)',
            border: 'none', background: c.color, color: 'var(--sobre-acento)',
            fontSize: 'var(--t-corpo)', lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{c.short}</button>
        <span style={{ minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', letterSpacing: '.05em',
            color: c.color, fontWeight: 'var(--peso-corpo)' as any, display: 'block',
          }}>
            {record.status === 'administered' ? 'DADO' : record.status === 'refused' ? 'RECUSOU' : 'SUSPENSO'}
          </span>
          {record.recorded_at && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtTime(record.recorded_at)}{record.recorded_by ? ` ${record.recorded_by.split(' ')[0]}` : ''}
            </span>
          )}
        </span>
        {(record as any).source === 'home' && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any,
            color: 'var(--amber)', border: '1px solid var(--badge-amber-border)',
            background: 'var(--badge-amber-bg)', borderRadius: 'var(--r-sm)', padding: '1px 4px',
          }}>CASA</span>
        )}

        {aberto && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(16,20,24,0.45)', padding: 20,
          }} onClick={() => setAberto(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: 18,
              width: '100%', maxWidth: 340, border: '1px solid var(--border-2)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', letterSpacing: '.12em',
                textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 'var(--peso-forte)' as any, marginBottom: 10,
              }}>Alterar o registo</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(Object.keys(STATUS_CFG) as NonNullable<AdminStatus>[]).map(st => (
                  <button key={st} type="button" onClick={() => { onChange(st, notas); setAberto(false) }}
                    style={{
                      flex: 1, minHeight: 'var(--alvo)', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      border: `1px solid ${st === record.status ? STATUS_CFG[st].color : 'var(--border-2)'}`,
                      background: st === record.status ? STATUS_CFG[st].color : 'transparent',
                      color: st === record.status ? 'var(--sobre-acento)' : 'var(--ink-3)',
                      fontFamily: 'inherit', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any,
                    }}>{STATUS_CFG[st].short} {STATUS_CFG[st].label}</button>
                ))}
              </div>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                placeholder="Observação (opcional)"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                  border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)',
                  fontSize: 'var(--t-dado)', fontFamily: 'inherit', resize: 'vertical',
                }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button type="button" onClick={() => { onChange(record.status, notas); setAberto(false) }}
                  style={{
                    flex: 1, minHeight: 'var(--alvo)', border: 'none', borderRadius: 'var(--r-sm)',
                    background: 'var(--green)', color: 'var(--sobre-acento)',
                    fontFamily: 'inherit', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer',
                  }}>Guardar a nota</button>
                <button type="button" onClick={() => { onChange(null, ''); setAberto(false) }}
                  style={{
                    minHeight: 'var(--alvo)', padding: '0 12px', borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border-2)', background: 'transparent',
                    color: 'var(--ink-4)', fontFamily: 'inherit', fontSize: 'var(--t-dado)', cursor: 'pointer',
                  }}>Limpar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Por registar: os três quadrados.
  return (
    <div style={{ display: 'flex', gap: 5, opacity: isSaving ? 0.5 : 1 }}>
      {(Object.keys(STATUS_CFG) as NonNullable<AdminStatus>[]).map(st => quadrado(st, false))}
    </div>
  )
}

export default function MARPage() {
  const { user, supabase } = useAuth()
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('medicacao', 'editar')
  const toast = useToast()
  const cfg = institutionConfig(institution)
  const isDayCare = institution === 'day_care'   // ponte casa↔centro só faz sentido aqui
  const isPro = ['pro', 'clinic'].includes(user?.plan || '')

  const [patients, setPatients]               = useState<Patient[]>([])
  const [loadErr, setLoadErr]                 = useState('')
  const [selectedId, setSelectedId]           = useState('')
  const [meds, setMeds]                       = useState<PatientMed[]>([])
  const [date, setDate]                       = useState(getToday())
  // Sem turnos (centro de dia): o período vem do relógio e não há seletor.
  const [shift, setShift]                     = useState<Shift>(currentShiftFor(institution))
  const [records, setRecords]                 = useState<AdminRecord[]>([])
  const [saving, setSaving]                   = useState<string | null>(null)
  const [pendingWarn, setPendingWarn]         = useState<{ medId: string; status: AdminStatus; notes: string; messages: string[] } | null>(null)
  const [omissions, setOmissions]             = useState<{ name: string; id: string; missing: number }[]>([])
  const [allMedsMap, setAllMedsMap]           = useState<Record<string, PatientMed[]>>({})
  const [allDayRecs, setAllDayRecs]           = useState<{ patient_id: string; med_id: string; shift: Shift; status: string }[]>([])
  const [showOmitDetail, setShowOmitDetail]   = useState(false)
  const [liveTick, setLiveTick]               = useState(0)

  // O useClinicPrefs arranca em 'nursing_home' e só lê o tipo real do localStorage
  // depois do 1º render — por isso o `shift` inicial podia ser 'noite' (lar) e ficar
  // preso mesmo depois de se saber que é um centro de dia. Re-sincroniza o turno
  // com a instituição, mas só enquanto o utilizador não escolheu um à mão.
  const [shiftTouched, setShiftTouched] = useState(false)
  const pickShift = (s: Shift) => { setShiftTouched(true); setShift(s) }
  useEffect(() => {
    if (!shiftTouched) setShift(currentShiftFor(institution))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institution])

  // Live updates: refresh MAR records when changed elsewhere or on return to app
  useLiveData({ supabase, table: 'mar_records', userId: user?.id, filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, enabled: !!user && isPro, onChange: () => setLiveTick(t => t + 1) })

  const selectedPatient = patients.find(p => p.id === selectedId) ?? null

  // Co-piloto de unidoses (Módulo 1, 2026-08-16): a par do aviso pontual de
  // interações/alergia já existente (allergyWarning/interactionWarnings, só
  // 6 pares fixos), cruza TODA a medicação ativa com o motor de regras real
  // (lib/decisionEngine, 26 regras — STOPP/START, carga anticolinérgica,
  // polifarmácia, etc.), a mesma fonte já usada em /stopp-start e /vigia.
  const regimenFindings: Finding[] = selectedPatient && meds.length
    ? clinicalFindingsFor(selectedPatient, meds.map(m => ({ name: m.name, started_at: m.started_at })))
    : []

  // printMARSheet via ref para o atalho de teclado usar sempre a versão fresca
  // (o handler é registado uma vez com deps []).
  const printRef = useRef<() => void>(() => {})

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Atalhos de turno só onde há turnos (o centro de dia não tem "noite").
      if (cfg.hasShifts && e.key === '1') pickShift('manha')
      else if (cfg.hasShifts && e.key === '2') pickShift('tarde')
      else if (cfg.hasShifts && e.key === '3') pickShift('noite')
      else if (e.key === 'p' || e.key === 'P') printRef.current()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [cfg.hasShifts])

  useEffect(() => {
    if (!user || !isPro) return
    scope.filter(supabase.from('patients').select('id, name, age, room_number, conditions, allergies, egfr, last_review')).order('name')
      .then(({ data, error }: any) => { setLoadErr(error ? `Não foi possível carregar os ${cfg.personNounPlural.toLowerCase()}. Verifica a ligação e recarrega.` : ''); setPatients(data || []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPro, supabase, scope.orgId, scope.userId])

  useEffect(() => {
    if (!selectedId) { setMeds([]); return }
    // select('*') para incluir take_location sem rebentar se a coluna ainda não
    // tiver sido migrada (sprint86) na base de dados em produção.
    supabase.from('patient_meds').select('*')
      .eq('patient_id', selectedId).eq('active', true)
      .then(({ data }: any) => setMeds(data || []))
  }, [selectedId, supabase])

  // Carrega os registos do DIA inteiro (todos os turnos) — assim as tomas dadas
  // EM CASA (que podem cair noutro turno) também aparecem e contam.
  const [dayRecords, setDayRecords] = useState<AdminRecord[]>([])
  useEffect(() => {
    if (!selectedId || !date) { setDayRecords([]); return }
    supabase.from('mar_records').select('*')
      .eq('patient_id', selectedId).eq('date', date)
      .then(({ data }) => {
        const all = (data || []) as AdminRecord[]
        setDayRecords(all)
        setRecords(all.filter(r => r.shift === shift))   // a grelha mostra o turno ativo
      })
  }, [selectedId, date, shift, supabase, liveTick])

  // Compute omissions across all patients
  useEffect(() => {
    if (!user || !isPro || !patients.length) return
    const ids = patients.map(p => p.id)
    Promise.all([
      // `*` e nao a lista de colunas: o PostgREST recusa o SELECT INTEIRO quando
      // uma coluna nao existe, e devolve `data: null` sem levantar excecao. Com
      // a lista escrita a mao, esta pagina ficava em branco entre o momento em
      // que o codigo sobe e o momento em que a migracao do SOS corre. Com `*`,
      // a coluna aparece quando existir e nada parte entretanto.
      supabase.from('patient_meds').select('*').eq('active', true).in('patient_id', ids),
      supabase.from('mar_records').select('patient_id, med_id, shift, status').eq('date', date).in('patient_id', ids),
    ]).then(([{ data: allMeds }, { data: dayRecs }]) => {
      const medsArr: any[] = allMeds || []
      const recsArr = dayRecs || []
      const medsMap: Record<string, PatientMed[]> = {}
      medsArr.forEach((m: any) => { if (!medsMap[m.patient_id]) medsMap[m.patient_id] = []; medsMap[m.patient_id].push(m) })
      setAllMedsMap(medsMap)
      setAllDayRecs(recsArr)
      const omit = patients.map(p => {
        const dueMeds = (medsMap[p.id] || []).filter(m => dueInShift(m, shift))
        const doneIds = new Set(recsArr.filter((r: any) => r.patient_id === p.id && r.shift === shift).map((r: any) => r.med_id))
        const missing = dueMeds.filter(m => !doneIds.has(m.id)).length
        return { name: p.name, id: p.id, missing }
      }).filter(o => o.missing > 0).sort((a, b) => b.missing - a.missing)
      setOmissions(omit)
    })
  }, [patients, date, shift, user, isPro, supabase, liveTick])

  const getRecord = (medId: string) => records.find(r => r.med_id === medId && r.shift === shift) ?? null

  // ── Folha de MAR profissional (A4) — documento de auditoria ──────────────────
  // Um registo por pessoa, com cada medicação devida no turno e o seu estado.
  // Doses por administrar aparecem destacadas (é o que a Segurança Social verifica).
  const STATUS_PT: Record<string, string> = { administered: 'Administrado', refused: 'Recusado', held: 'Suspenso' }
  function printMARSheet() {
    const sl = SHIFTS[shift]
    let totalDue = 0, totalDone = 0, totalMissing = 0
    const records: PrintRecord[] = patients.map(p => {
      const due = (allMedsMap[p.id] || []).filter(m => dueInShift(m, shift))
      const recByMed: Record<string, string> = {}
      allDayRecs.filter(r => r.patient_id === p.id && r.shift === shift).forEach(r => { recByMed[r.med_id] = r.status })
      totalDue += due.length
      const bullets = due.map(m => {
        const st = recByMed[m.id]
        if (st) { totalDone++; return `${m.name}${m.dose ? ` ${m.dose}` : ''} — ${STATUS_PT[st] || st}` }
        totalMissing++; return `${m.name}${m.dose ? ` ${m.dose}` : ''} — ☐ POR ADMINISTRAR`
      })
      const missing = due.filter(m => !recByMed[m.id]).length
      return {
        title: p.name,
        meta: [cfg.hasBeds && p.room_number ? `${cfg.roomLabel} ${p.room_number}` : '', p.age ? `${p.age} anos` : ''].filter(Boolean).join(' · '),
        tags: missing > 0 ? [{ label: `${missing} por dar`, color: 'var(--red)' }] : [{ label: 'Completo', color: 'var(--green)' }],
        bullets: bullets.length ? bullets : ['Sem medicação para este turno.'],
      }
    }).filter(r => r.bullets[0] !== 'Sem medicação para este turno.')

    printDoc({
      docTitle: 'Registo de Administração de Medicação (MAR)',
      docSubtitle: `Turno ${sl.label} (${sl.time}) · ${new Date(date + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      meta: [
        { label: cfg.personNounPlural, value: String(records.length) },
        { label: 'Doses devidas', value: String(totalDue) },
        { label: 'Administradas', value: String(totalDone) },
        { label: 'Por administrar', value: String(totalMissing) },
      ],
      sections: [{ heading: `${cfg.personNounPlural} — turno ${sl.label}`, records }],
      footerNote: 'Documento gerado pelo Phlox Clinical · Confidencial · Assinatura do responsável: __________________',
    })
  }
  printRef.current = printMARSheet

  // BUG/PEDIDO 2026-08-07: o seletor de data no MAR nunca teve restrição — QUALQUER
  // funcionário podia mudar para um dia passado e registar/alterar tomas em
  // silêncio, sem qualquer marca de que foi um registo retroativo. Para uma folha
  // de MAR (documento legal de administração de medicação) isto é um risco real.
  // Agora: só HOJE pode registar normalmente; um dia diferente só grava se for
  // owner/admin (scope.isManager) — exceção deliberada, não a regra — e fica
  // sempre assinalado na nota, para ficar rastreável no registo.
  const isToday = date === getToday()
  const doAdmin = async (medId: string, status: AdminStatus, notes: string) => {
    if (!user || !selectedId) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não pode registar medicação.'); return }
    if (!isToday && !scope.isManager) {
      toast.error('Só para outro dia com um administrador', 'Só consegues registar tomas de hoje. Para lançar uma toma de outro dia, pede a um administrador da equipa.')
      return
    }
    setSaving(medId)
    // Confirma no servidor ANTES de mostrar como dada (mais seguro para
    // medicação do que otimista). try/catch garante que uma quebra de rede a
    // meio não deixa o botão preso e mostra sempre uma mensagem calma.
    try {
      const existing = getRecord(medId)
      const finalNotes = (!isToday && scope.isManager)
        ? `[Registo retroativo — lançado a ${getToday()} por ${(user as any).name || user.email || 'admin'}]${notes ? ' ' + notes : ''}`
        : notes
      const base = scope.stamp({ patient_id: selectedId, user_id: user.id, med_id: medId, shift, date, status, notes: finalNotes, recorded_by: (user as any).name || user.email || '', recorded_at: new Date().toISOString() })
      if (!status && existing) {
        const { error } = await supabase.from('mar_records').delete().eq('id', (existing as any).id)
        if (error) { toast.error('Não foi possível remover', reportError('mar-delete', error, 'Tenta de novo.')); return }
        setRecords(p => p.filter(r => !(r.med_id === medId && r.shift === shift)))
      } else if (existing) {
        const { data, error } = await supabase.from('mar_records').update({ status, notes: finalNotes, recorded_at: base.recorded_at }).eq('id', (existing as any).id).select().single()
        if (error) { toast.error('Não foi possível guardar', reportError('mar-update', error, 'Tenta de novo.')); return }
        if (data) setRecords(p => p.map(r => r.med_id === medId && r.shift === shift ? data : r))
      } else if (status) {
        const { data, error } = await supabase.from('mar_records').insert(base).select().single()
        if (error) { toast.error('Não foi possível registar a toma', reportError('mar-insert', error, 'Tenta de novo.')); return }
        if (data) setRecords(p => [...p, data])
      }

      // ── O livro de registos ────────────────────────────────────────────
      // Ver lib/registo.ts: as excecoes uma a uma, o turno em resumo. Isto
      // faltava por completo — a medicacao era o unico trabalho do dia que
      // nao deixava rasto nenhum em /historico.
      const nomeUtente = selectedPatient?.name || 'o utente'
      const nomeMed = meds.find(m => m.id === medId)?.name || 'o medicamento'
      const ctxLivro = { supabase, scope, user: user as any }
      const alvo = { subjectId: selectedId, subjectName: nomeUtente, entityId: selectedId }

      if (status === 'refused') registar(ctxLivro, { ...ACOES.medicacaoRecusada(nomeUtente, nomeMed, notes || null), ...alvo })
      else if (status === 'held') registar(ctxLivro, { ...ACOES.medicacaoSuspensa(nomeUtente, nomeMed, notes || null), ...alvo })
      else if (!status && existing) registar(ctxLivro, { ...ACOES.medicacaoRetirada(nomeUtente, nomeMed), ...alvo })
      else if (status === 'administered') {
        // Uma so entrada, no momento em que o turno fica fechado — nao uma por
        // dose. Calcula-se sobre o estado NOVO, porque o `records` do closure
        // ainda e o de antes desta gravacao.
        const doTurno = meds.filter(m => dueInShift(m, shift))
        const decididos = new Map<string, string>()
        records.filter(r => r.shift === shift && r.status).forEach(r => decididos.set(r.med_id, r.status as string))
        decididos.set(medId, 'administered')
        const faltam = doTurno.filter(m => !decididos.has(m.id))
        if (doTurno.length && !faltam.length) {
          const dadas = doTurno.filter(m => decididos.get(m.id) === 'administered').length
          registar(ctxLivro, { ...ACOES.medicacaoTurno(nomeUtente, SHIFTS[shift].label, dadas, doTurno.length), ...alvo })
        }
      }
    } catch (e) {
      toast.error('Não foi possível guardar', reportError('mar-admin', e, 'Verifica a ligação e tenta de novo.'))
    } finally {
      setSaving(null)
    }
  }

  const handleAdmin = async (medId: string, status: AdminStatus, notes: string) => {
    if (status === 'administered' && !getRecord(medId) && selectedPatient) {
      const med = meds.find(m => m.id === medId)
      if (med) {
        const otherAdministered = records.filter(r => r.shift === shift && r.status === 'administered' && r.med_id !== medId).map(r => meds.find(m => m.id === r.med_id)?.name || '').filter(Boolean)
        const messages = [...(allergyWarning(selectedPatient.allergies, med.name) ? [allergyWarning(selectedPatient.allergies, med.name)!] : []), ...interactionWarnings(med.name, otherAdministered)]
        if (messages.length) { setPendingWarn({ medId, status, notes, messages }); return }
      }
    }
    await doAdmin(medId, status, notes)
  }

  const shiftMeds = meds.filter(m => dueInShift(m, shift))
  const otherShiftMeds = meds.filter(m => !dueInShift(m, shift))

  const administerAllPending = async () => {
    const pending = shiftMeds.filter(m => !getRecord(m.id))
    if (!pending.length || !user || !selectedId) return
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não pode registar medicação.'); return }
    const now = new Date().toISOString()
    const inserts = pending.map(m => scope.stamp({ patient_id: selectedId, user_id: user.id, med_id: m.id, shift, date, status: 'administered', notes: '', recorded_by: (user as any).name || user.email || '', recorded_at: now }))
    try {
      const { data, error } = await supabase.from('mar_records').insert(inserts).select()
      if (error) { toast.error('Não foi possível registar tudo', reportError('mar-admin-all', error, 'Tenta de novo.')); return }
      if (data) setRecords(p => [...p, ...data])

      // Marcou tudo de uma vez: o turno fica fechado aqui. Ver lib/registo.ts.
      const decididos = new Map<string, string>()
      records.filter(r => r.shift === shift && r.status).forEach(r => decididos.set(r.med_id, r.status as string))
      pending.forEach(m => decididos.set(m.id, 'administered'))
      const dadas = shiftMeds.filter(m => decididos.get(m.id) === 'administered').length
      registar({ supabase, scope, user: user as any }, {
        ...ACOES.medicacaoTurno(selectedPatient?.name || 'o utente', SHIFTS[shift].label, dadas, shiftMeds.length),
        subjectId: selectedId, subjectName: selectedPatient?.name || null, entityId: selectedId,
      })
    } catch (e) {
      toast.error('Não foi possível registar tudo', reportError('mar-admin-all', e, 'Verifica a ligação e tenta de novo.'))
    }
  }

  const shiftMedIds  = new Set(shiftMeds.map(m => m.id))
  const administered = records.filter(r => r.shift === shift && r.status === 'administered' && shiftMedIds.has(r.med_id)).length
  const totalMeds    = shiftMeds.length
  const pendingCount = totalMeds - records.filter(r => r.shift === shift && r.status && shiftMedIds.has(r.med_id)).length
  const sl           = SHIFTS[shift]

  if (!isPro) {
    return <ClinicalGate icone="pill" accent="var(--ink-2)"
      title="Registo de Administração de Medicação"
      description="Regista cada administração e sinaliza omissões, recusas e alertas de segurança automaticamente." />
  }

  /* ══════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════
     O que estava aqui era um FORMULÁRIO: escolhe-se uma pessoa numa caixa de
     seleção, e só depois é que o ecrã mostra alguma coisa. Até lá, metade da
     janela era um estado vazio com um ícone ao meio.

     Numa ronda de medicação isso é ao contrário do que se faz. Quem a dá não
     escolhe UMA pessoa: percorre a casa inteira e quer ver, de uma vez, quem
     já tomou, quem falta, e quem tem alergias — e só depois abre a pessoa.

     Por isso agora são duas colunas: a casa à esquerda, a pessoa à direita. A
     caixa de seleção desapareceu, e com ela o ecrã vazio.
     ══════════════════════════════════════════════════════════════════════ */

  // Quantas doses deste turno cada pessoa tem, e quantas estão decididas.
  const largo = useLargo()

  const linhasDaCasa = patients.map(p => {
    const seus = (allMedsMap[p.id] || []).filter(m => dueInShift(m, shift))
    const decididas = new Set(
      allDayRecs.filter(r => r.patient_id === p.id && r.shift === shift && r.status).map(r => r.med_id),
    )
    const dadas = (allMedsMap[p.id] || []).filter(m => decididas.has(m.id)).length
    return {
      p, total: seus.length, dadas: Math.min(dadas, seus.length),
      falta: Math.max(0, seus.length - decididas.size),
    }
  })
  const totalDaCasa = linhasDaCasa.reduce((n, l) => n + l.total, 0)
  const dadasDaCasa = linhasDaCasa.reduce((n, l) => n + l.dadas, 0)
  const emFaltaDaCasa = linhasDaCasa.reduce((n, l) => n + l.falta, 0)

  return (
    <>
    <Mesa
      barra={
        <BarraDeTrabalho>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any }}>
              Medicação
            </span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              aria-label="Dia" style={{ ...CAIXA, width: 150 }} />
          </div>

          {cfg.hasShifts
            ? <Seletor opcoes={shiftsFor(institution).map(s => ({ id: s, rotulo: SHIFTS[s].label }))}
                ativa={shift} aoMudar={pickShift} />
            : <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {SHIFTS[shift].label} · {SHIFTS[shift].time}
              </span>}

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: dadasDaCasa === totalDaCasa && totalDaCasa > 0 ? 'var(--green)' : 'var(--ink-2)' }}>
              {dadasDaCasa}/{totalDaCasa}
            </span>
            <Segmentos feitos={dadasDaCasa} total={Math.max(totalDaCasa, 1)} />
          </span>

          {emFaltaDaCasa > 0 && (
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>
              {emFaltaDaCasa} POR DAR
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Botao onClick={printMARSheet} titulo="Folha de todas as tomas deste turno (A4, para auditoria)">
              FOLHA DE MAR
            </Botao>
            <Link href="/passagem" style={{ textDecoration: 'none' }}>
              <Botao>PASSAGEM →</Botao>
            </Link>
          </div>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Codigo texto="✓" cor="var(--green)" /> dado
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Codigo texto="✗" cor="var(--red)" /> recusado
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Codigo texto="⏸" cor="var(--amber)" /> suspenso
          </span>
          <span style={{ ...MONO, color: 'var(--red)' }}>ALERG = alergia registada na ficha</span>
          {isDayCare && <span style={{ ...MONO }}>CASA = a família dá em casa</span>}
          <span style={{ marginLeft: 'auto', ...MONO }}>
            Cada registo fica assinado com o nome e a hora de quem o fez.
          </span>
        </BarraDeEstado>
      }
    >
      {!isToday && (
        <Aviso tom={scope.isManager ? 'neutro' : 'mau'}>
          {scope.isManager
            ? `A ver ${new Date(date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} — como administrador, o que registares aqui fica assinalado como retroativo.`
            : `A ver ${new Date(date + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long' })} — só podes consultar. Para lançar uma toma deste dia, pede a um administrador da equipa.`}
        </Aviso>
      )}
      {loadErr && <Aviso tom="mau" titulo="Não consegui carregar">{loadErr}</Aviso>}

      <div style={{
        display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'stretch',
        gridTemplateColumns: largo ? 'minmax(340px, 400px) 1fr' : '1fr',
      }}>
        {/* ── A CASA ─────────────────────────────────────────────────── */}
        {(largo || !selectedId) && (
          <Painel cabeca={
            <Cabecalho>
              <span style={{ ...ROTULO, width: 30 }}>Qt</span>
              <span style={{ ...ROTULO, flex: 1 }}>{cfg.personNounPlural} · {patients.length}</span>
              <span style={{ ...ROTULO }}>Doses</span>
            </Cabecalho>
          }>
            {patients.length === 0 ? (
              <Vazio titulo={`Ainda não há ${cfg.personNounPlural.toLowerCase()} nesta casa.`}
                oQueFazer="Assim que houver fichas criadas, a medicação do turno aparece aqui." />
            ) : linhasDaCasa.map(({ p, total, dadas, falta }) => {
              const on = p.id === selectedId
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${on ? 'var(--green)' : falta > 0 ? 'var(--red)' : 'transparent'}`,
                  background: on ? 'var(--green-light)' : 'transparent', fontFamily: 'inherit',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, width: 30, flexShrink: 0, color: p.room_number ? 'var(--ink-3)' : 'var(--ink-5)' }}>
                      {p.room_number || '—'}
                    </span>
                    <span style={{
                      fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, flex: 1, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: total > 0 && falta === 0 ? 'var(--ink-4)' : 'var(--ink)',
                    }}>{p.name}</span>
                    <span style={{
                      ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, flexShrink: 0,
                      color: total === 0 ? 'var(--ink-5)' : falta === 0 ? 'var(--green)' : 'var(--red)',
                    }}>{total === 0 ? '—' : falta === 0 ? '✓' : `${dadas}/${total}`}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, paddingLeft: 40 }}>
                    {p.age != null && <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{p.age}a</span>}
                    {p.allergies && <Bandeira texto={`ALERG ${p.allergies}`} tom="mau" />}
                    {total > 0 && <Segmentos feitos={dadas} total={total} />}
                  </div>
                </button>
              )
            })}
          </Painel>
        )}

        {/* ── A PESSOA ───────────────────────────────────────────────── */}
        {selectedPatient && (
          <Painel
            cabeca={<>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {!largo && <Botao onClick={() => setSelectedId('')}>← {cfg.personNounPlural.toUpperCase()}</Botao>}
                  <span style={{ ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)' }}>
                    {selectedPatient.room_number ? `QT ${selectedPatient.room_number}` : 'SEM QUARTO'}
                  </span>
                  <span style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-corpo)' as any, letterSpacing: '-0.01em' }}>{selectedPatient.name}</span>
                  <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                    {selectedPatient.age != null ? `${selectedPatient.age} anos` : 'idade por registar'}
                  </span>
                  {pendingCount > 0 && (
                    <span style={{ marginLeft: 'auto' }}>
                      <Botao feitio="principal" onClick={administerAllPending}>
                        ✓ DAR AS {pendingCount} QUE FALTAM
                      </Botao>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {selectedPatient.allergies
                    ? <Bandeira texto={`ALERGIAS: ${selectedPatient.allergies}`} tom="mau" />
                    : <Bandeira texto="ALERGIAS POR REGISTAR" tom="atencao" />}
                  {selectedPatient.conditions && <Bandeira texto={selectedPatient.conditions} />}
                </div>
              </div>

              {/* O que o motor de regras encontrou em TODA a medicação ativa. */}
              {regimenFindings.filter(f => f.severity === 'critical' || f.severity === 'major').map(f => (
                <div key={f.id} style={{
                  padding: '8px 16px', borderBottom: '1px solid var(--border)',
                  background: f.severity === 'critical' ? 'var(--badge-red-bg)' : 'var(--badge-amber-bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <Codigo texto={f.severity === 'critical' ? 'CRÍTICO' : 'MAIOR'}
                      cor={f.severity === 'critical' ? 'var(--red)' : 'var(--amber)'} />
                    <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any }}>{f.title}</span>
                    <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>{f.detail}</span>
                  </div>
                  {f.action && (
                    <div style={{ ...MONO, fontSize: 'var(--t-meta)', marginTop: 3, color: f.severity === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                      → {f.action}
                    </div>
                  )}
                </div>
              ))}

              <Cabecalho>
                <span style={{ ...ROTULO, width: 110 }}>Estado</span>
                <span style={{ ...ROTULO, flex: 1 }}>Medicamento</span>
                <span style={{ ...ROTULO, width: 80 }}>Dose</span>
                <span style={{ ...ROTULO, width: 110 }}>Frequência</span>
              </Cabecalho>
            </>}
            rodape={<>
              <span style={MONO}>{administered}/{totalMeds} DADAS</span>
              {pendingCount > 0 && <span style={{ ...MONO, color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any }}>{pendingCount} POR DAR</span>}
              {otherShiftMeds.length > 0 && (
                <span style={MONO}>{otherShiftMeds.length} noutros turnos</span>
              )}
            </>}
          >
            {(() => {
              const emCasa = dayRecords.filter(r => (r as any).source === 'home')
              if (!emCasa.length) return null
              return (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--badge-amber-bg)', fontSize: 'var(--t-dado)', color: 'var(--amber)' }}>
                  <strong>{emCasa.length}</strong> {emCasa.length === 1 ? 'toma dada em casa' : 'tomas dadas em casa'} hoje pela família
                  {emCasa.some((h: any) => h.home_by) ? ` (${[...new Set(emCasa.map((h: any) => h.home_by).filter(Boolean))].join(', ')})` : ''}.
                </div>
              )
            })()}

            {meds.length === 0 ? (
              <Vazio titulo={`Sem medicamentos ativos para ${selectedPatient.name}.`}
                oQueFazer={<Link href={`/patients/${selectedId}`} style={{ color: 'var(--green)' }}>Abrir a ficha para os acrescentar →</Link>} />
            ) : shiftMeds.length === 0 ? (
              <Vazio titulo={`Nada prescrito para o turno da ${SHIFTS[shift].label.toLowerCase()}.`}
                oQueFazer={otherShiftMeds.length > 0
                  ? `Esta pessoa tem ${otherShiftMeds.length} ${otherShiftMeds.length === 1 ? 'medicamento' : 'medicamentos'} noutros turnos.`
                  : undefined} />
            ) : shiftMeds.map(med => {
              const rec = getRecord(med.id)
              const aGravar = saving === med.id
              const dado = rec?.status === 'administered'
              return (
                <div key={med.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                  borderBottom: '1px solid var(--border)', opacity: aGravar ? 0.5 : 1,
                  background: rec?.status === 'refused' ? 'var(--badge-red-bg)' : 'transparent',
                }}>
                  <div style={{ width: 110, flexShrink: 0 }}>
                    <AdminCell record={rec} isSaving={aGravar} onChange={(s, n) => handleAdmin(med.id, s, n)} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any,
                      color: dado ? 'var(--ink-4)' : 'var(--ink)',
                      textDecoration: dado ? 'line-through' : undefined,
                    }}>{med.name}</span>
                    {isDayCare && med.take_location === 'casa' && (
                      <span style={{ marginLeft: 8 }}><Bandeira texto="CASA" tom="atencao" /></span>
                    )}
                    {med.indication && (
                      <span style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginLeft: 8 }}>{med.indication}</span>
                    )}
                    {rec?.notes && (
                      <div style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 2 }}>{rec.notes}</div>
                    )}
                  </div>
                  <span style={{ ...MONO, fontSize: 'var(--t-dado)', width: 80, flexShrink: 0, color: 'var(--ink-3)' }}>{med.dose || '—'}</span>
                  <span style={{ fontSize: 'var(--t-meta)', width: 110, flexShrink: 0, color: 'var(--ink-4)' }}>{med.frequency || '—'}</span>
                </div>
              )
            })}
          </Painel>
        )}

        {largo && !selectedPatient && (
          <Painel>
            <Vazio titulo={`Escolha alguém à esquerda.`}
              oQueFazer="A coluna mostra quem já tem o turno tratado e quem ainda tem doses por dar." />
          </Painel>
        )}
      </div>
    </Mesa>
      {/* Safety modal */}
    {pendingWarn && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <div style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--badge-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="alert" size={20} color="var(--red)" /></div>
            <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--red)' }}>Alerta de segurança</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {pendingWarn.messages.map((msg, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)', lineHeight: 1.5, fontWeight: 'var(--peso-corpo)' as any }}>
                {msg}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 20 }}>
            Confirma que verificaste esta situação com o clínico responsável antes de administrar.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={async () => { const pw = pendingWarn; setPendingWarn(null); await doAdmin(pw.medId, pw.status, pw.notes) }}
              style={{ flex: 1, padding: 11, background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>
              Confirmar mesmo assim
            </button>
            <button onClick={() => setPendingWarn(null)}
              style={{ padding: '11px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--t-dado)' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  )
}
