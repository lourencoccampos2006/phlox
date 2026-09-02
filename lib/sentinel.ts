// lib/sentinel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Carregamento do Sentinel — FONTE ÚNICA dos dados de atenção por utente.
//
// Extraído de app/radar/page.tsx (Fase 3, 2026-08-16) quando o Modo Guardião
// (/guardiao) passou a precisar exatamente dos mesmos dados. Construir uma
// segunda página com a sua própria cópia das ~15 queries seria repetir o
// problema que a Fase 2 acabou de resolver (motores paralelos a divergir com
// o tempo) — por isso as duas páginas chamam esta função.
//
// Junta as duas leituras que já existiam separadas:
//   • "hoje"      → lib/careSignals (summariseResident) — o que saiu do padrão
//   • "2-3 semanas" → lib/trendSignals (buildResidentTrend) — quebra gradual
//
// Não é um dispositivo médico: organiza o que a equipa registou, não prevê
// nem diagnostica. A avaliação é sempre do profissional (ver CARE_DISCLAIMER).
// ─────────────────────────────────────────────────────────────────────────────

import { summariseResident, rankByAttention, type CareResult } from './careSignals'
import {
  buildResidentTrend, TREND_WINDOW_DAYS, INCIDENT_WINDOW_DAYS, ASSESSMENT_WINDOW_DAYS,
  type ResidentTrend,
} from './trendSignals'
import type { Severity } from './residentSignals'
import { adlTrend, type AdlReview } from './adl'

/** Só o que precisamos de useOrgScope() — evita arrastar um hook 'use client' para aqui. */
export interface SentinelScope { filter: <T>(query: T) => T }

export interface SentinelResult {
  results: CareResult[]
  /** só utentes COM sinais de tendência (os outros nem entram no mapa) */
  trends: Record<string, ResidentTrend>
  error?: string
}

export const SEV_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 }
export const worseLevel = (a: Severity, b: Severity): Severity => SEV_ORDER[a] <= SEV_ORDER[b] ? a : b

/** Nível combinado (hoje + tendência) de um utente. */
export function combinedLevel(r: CareResult, t?: ResidentTrend): Severity {
  return t ? worseLevel(r.level, t.level) : r.level
}
/** Pontuação combinada (hoje + tendência). */
export function combinedScore(r: CareResult, t?: ResidentTrend): number {
  return r.score + (t?.score || 0)
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysAgoStr = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// Tolerante a tabelas/colunas em falta: uma migração por aplicar não deve
// deixar a página em branco — degrada para "sem dados dessa fonte".
const safeQ = async (q: any) => { try { const r = await q; return r.error ? { data: [] } : r } catch { return { data: [] } } }

export interface TrendPatient { id: string; name: string; room_number?: string | null }

/**
 * Tendências (2-3 semanas) de TODOS os utentes dados — devolve o ResidentTrend
 * completo por utente, com ou sem flags (quem consome decide o que filtrar).
 *
 * Separado de loadSentinel (Fase 3, 2026-08-16) porque o /apoio-psicossocial
 * precisa SÓ disto: carregar as ~15 queries do Sentinel completo lá seria
 * desperdício, e copiar este bloco para lá seria recriar a duplicação que a
 * Fase 2 resolveu. O loadSentinel chama esta mesma função.
 */
export async function loadTrends(supabase: any, scope: SentinelScope, patients: TrendPatient[]): Promise<Record<string, ResidentTrend>> {
  const sinceTrend = daysAgoStr(TREND_WINDOW_DAYS - 1)
  const sinceIncTrend = daysAgoStr(INCIDENT_WINDOW_DAYS - 1)
  const sinceAssessTrend = daysAgoStr(ASSESSMENT_WINDOW_DAYS - 1)

  // Consumo de incontinência por utente (Módulo 11) — só existe depois de
  // sprint133 (patient_id em stock_consumption); safeQ degrada a vazio até lá.
  const sinceTrendTs = new Date(Date.now() - (TREND_WINDOW_DAYS - 1) * 86400000).toISOString()

  const [careTrend, marTrend, incTrend, assessTrend, actTrend, consumption, adlRows] = await Promise.all([
    safeQ(scope.filter(supabase.from('care_records').select('patient_id,date,mood,nutrition')).gte('date', sinceTrend)),
    safeQ(scope.filter(supabase.from('mar_records').select('patient_id,date,status')).gte('date', sinceTrend)),
    safeQ(scope.filter(supabase.from('incidents').select('patient_id,date,severity')).gte('date', sinceIncTrend)),
    safeQ(scope.filter(supabase.from('assessments').select('patient_id,scale,date,score')).gte('date', sinceAssessTrend)),
    safeQ(scope.filter(supabase.from('activities').select('id,date')).gte('date', sinceTrend)),
    safeQ(scope.filter(supabase.from('stock_consumption').select('patient_id,qty,created_at,stock_items!inner(category)'))
      .eq('stock_items.category', 'incontinencia').not('patient_id', 'is', null).gte('created_at', sinceTrendTs)),
    // Autonomia (Módulo 15) — janela de meses (lib/adl compara 30d vs 90d
    // anteriores), por isso não usa sinceTrend. Só existe após sprint134.
    safeQ(scope.filter(supabase.from('adl_reviews').select('patient_id,date,higiene,alimentacao,mobilidade'))
      .gte('date', daysAgoStr(130))),
  ])

  const by = <T,>(rows: T[], key: (r: T) => string): Record<string, T[]> => {
    const m: Record<string, T[]> = {}; rows.forEach(r => { (m[key(r)] ||= []).push(r) }); return m
  }
  const careTrendBy = by(careTrend.data || [], (r: any) => r.patient_id)
  const marTrendBy = by(marTrend.data || [], (r: any) => r.patient_id)
  const incTrendBy = by(incTrend.data || [], (r: any) => r.patient_id)
  const assessTrendBy = by(assessTrend.data || [], (r: any) => r.patient_id)

  // activity_participations não tem date própria (vive em activities) — join
  // em dois passos, como em /tendencias.
  const actDateById: Record<string, string> = {}
  ;(actTrend.data || []).forEach((a: any) => { actDateById[a.id] = a.date })
  const actIds = (actTrend.data || []).map((a: any) => a.id)
  const partsRes = actIds.length
    ? await safeQ(supabase.from('activity_participations').select('patient_id,activity_id,attended').in('activity_id', actIds).eq('attended', true))
    : { data: [] }
  const activityTrendBy: Record<string, { patient_id: string; date: string }[]> = {}
  ;(partsRes.data || []).forEach((r: any) => {
    const date = actDateById[r.activity_id]
    if (!date) return
    ;(activityTrendBy[r.patient_id] ||= []).push({ patient_id: r.patient_id, date })
  })

  // Dias em que HOUVE atividades — deixa o motor distinguir "não foi" (0) de
  // "não há dados" (ver comentário em buildResidentTrend).
  const activityDays: string[] = [...new Set<string>((actTrend.data || []).map((a: any) => String(a.date)))]

  // stock_consumption guarda timestamp (created_at); o motor compara por dia.
  const incontinenceBy: Record<string, { date: string; qty: number }[]> = {}
  ;((consumption.data || []) as any[]).forEach(r => {
    if (!r.patient_id) return
    ;(incontinenceBy[r.patient_id] ||= []).push({ date: String(r.created_at).slice(0, 10), qty: Number(r.qty) || 0 })
  })

  const adlBy: Record<string, AdlReview[]> = {}
  ;((adlRows.data || []) as any[]).forEach(r => {
    ;(adlBy[r.patient_id] ||= []).push({ date: r.date, higiene: r.higiene, alimentacao: r.alimentacao, mobilidade: r.mobilidade })
  })

  const out: Record<string, ResidentTrend> = {}
  patients.forEach(pt => {
    out[pt.id] = buildResidentTrend({
      patient: pt,
      care: careTrendBy[pt.id] || [],
      mar: marTrendBy[pt.id] || [],
      incidents: incTrendBy[pt.id] || [],
      assessments: assessTrendBy[pt.id] || [],
      activities: activityTrendBy[pt.id] || [],
      activityDays,
      incontinence: incontinenceBy[pt.id] || [],
      adlFlag: adlTrend(adlBy[pt.id] || []).flag,
    })
  })
  return out
}

export async function loadSentinel(supabase: any, scope: SentinelScope): Promise<SentinelResult> {
  const d = todayStr()
  const since365 = daysAgoStr(365)
  const since1 = new Date(); since1.setHours(0, 0, 0, 0)
  const safe = safeQ

  // Semana corrente da grelha de preparação (/preparacao-medicacao arranca a
  // semana ao domingo — mesma convenção, senão as duas páginas discordam).
  const inicioSemana = (() => { const x = new Date(); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x.toISOString().slice(0,10) })()
  const diaSemana = new Date().getDay()

  const [p, careToday, careHist, mar, meds, inc, wounds, assess, hyd, reqs,
         presencas, prep, transportes, transporteLogs, detalhe7] = await Promise.all([
    scope.filter(supabase.from('patients').select('id,name,age,conditions,allergies,room_number')).eq('active', true).order('name'),
    safe(scope.filter(supabase.from('care_records').select('patient_id,date,shift,mood,nutrition,notes')).eq('date', d)),
    safe(scope.filter(supabase.from('care_records').select('patient_id,date,vitals')).gte('date', since365)),
    safe(scope.filter(supabase.from('mar_records').select('patient_id,date,shift,status')).eq('date', d)),
    // BUG CORRIGIDO 2026-08-21: faltava .eq('active', true). Medicação já
    // SUSPENSA contava para a polimedicação ("≥10 fármacos") e para as tomas
    // esperadas hoje — alguém com 4 fármacos atuais e 8 parados aparecia como
    // polimedicação crítica. Falso positivo herdado do /radar original; agora
    // corrigido de uma vez para as 4 páginas que usam o Sentinel.
    safe(scope.filter(supabase.from('patient_meds').select('patient_id,name,shifts')).eq('active', true)),
    safe(scope.filter(supabase.from('incidents').select('patient_id,type,severity,status')).neq('status', 'closed')),
    safe(scope.filter(supabase.from('wounds').select('patient_id,status,stage'))),
    // BUG CORRIGIDO 2026-08-21: buscava-se 30 dias, mas a regra que consome
    // isto (residentSignals) pergunta "a última Barthel tem mais de 90 dias?".
    // Uma avaliação feita há 45 dias não vinha na consulta → o motor via
    // `!barthel` e dizia "Nunca avaliado — fazer avaliação funcional" a quem
    // JÁ tinha sido avaliado há 6 semanas. Janela alargada a 120 dias para a
    // regra poder mesmo distinguir "não existe" de "está desatualizada".
    safe(scope.filter(supabase.from('assessments').select('patient_id,scale,date')).gte('date', daysAgoStr(120))),
    safe(scope.filter(supabase.from('hydration_logs').select('patient_id,at,fluid_ml')).gte('at', since1.toISOString())),
    safe(scope.filter(supabase.from('resident_requests').select('patient_id,kind,content,status,created_at')).neq('status', 'resolvido')),

    // ── As três fontes que ninguém lia (2026-09-02) ───────────────────────
    // Presenças, preparação do pastilheiro e transportes recorrentes eram
    // escritas e nunca mais consultadas. Agora entram no mesmo motor que
    // decide a quem ir ver primeiro. safeQ como o resto: sem a tabela, o
    // sinal simplesmente não existe.
    safe(scope.filter(supabase.from('attendance').select('patient_id,date,status')).gte('date', daysAgoStr(14)).order('date')),
    safe(scope.filter(supabase.from('medication_prep_logs').select('patient_id,packed')).eq('week_start', inicioSemana).eq('packed', true)),
    safe(scope.filter(supabase.from('support_transport_schedules').select('id,patient_id,label,time,weekdays,active')).eq('active', true)),
    safe(scope.filter(supabase.from('support_transport_logs').select('schedule_id,done')).eq('date', d)),

    // Apetite, continência e pele dos últimos dias. O careHist só traz vitais
    // (365 dias) — estes campos precisam de uma janela curta e de outras
    // colunas, e alargar o histórico inteiro seria puxar um ano de jsonb por
    // causa de uma regra de três dias.
    safe(scope.filter(supabase.from('care_records').select('patient_id,date,nutrition,continence,skin')).gte('date', daysAgoStr(7)).order('date')),
  ])
  if (p.error) return { results: [], trends: {}, error: 'Não foi possível carregar. Verifica a ligação.' }

  const patients = p.data || []
  const by = <T,>(rows: T[], key: (r: T) => string): Record<string, T[]> => {
    const m: Record<string, T[]> = {}; rows.forEach(r => { (m[key(r)] ||= []).push(r) }); return m
  }
  const medsBy = by(meds.data || [], (r: any) => r.patient_id)
  const careTodayBy = by(careToday.data || [], (r: any) => r.patient_id)
  const careHistBy = by(careHist.data || [], (r: any) => r.patient_id)
  const marBy = by(mar.data || [], (r: any) => r.patient_id)
  const incBy = by(inc.data || [], (r: any) => r.patient_id)
  const woundsBy = by(wounds.data || [], (r: any) => r.patient_id)
  const assessBy = by(assess.data || [], (r: any) => r.patient_id)
  const hydBy = by(hyd.data || [], (r: any) => r.patient_id)
  const reqsBy = by(reqs.data || [], (r: any) => r.patient_id)
  const presencasBy = by(presencas.data || [], (r: any) => r.patient_id)

  const detalheBy: Record<string, { date: string; appetite?: string | null; urinary?: string | null; bowel?: string | null; skin?: string | null }[]> = {}
  ;((detalhe7.data || []) as any[]).forEach(r => {
    ;(detalheBy[r.patient_id] ||= []).push({
      date: r.date,
      appetite: r.nutrition?.appetite ?? null,
      urinary: r.continence?.urinary ?? null,
      bowel: r.continence?.bowel ?? null,
      skin: r.skin?.integrity ?? null,
    })
  })
  const comFeridaAberta = new Set(((wounds.data || []) as any[]).filter(w => w.status !== 'healed' && w.status !== 'closed').map(w => w.patient_id))

  // Preparação: só avisa quem tem medicação com horário E não tem uma única
  // marca esta semana — e só se a CASA usar mesmo a ferramenta. Sem esta
  // segunda guarda, uma casa que nunca abriu a página levava um aviso por
  // pessoa por causa de algo que não conhece.
  const preparados = new Set(((prep.data || []) as any[]).map(r => r.patient_id))
  const casaUsaPreparacao = preparados.size > 0
  const comHorario = new Set(((meds.data || []) as any[]).filter(m => Array.isArray(m.shifts) && m.shifts.length).map((m: any) => m.patient_id))

  // Transporte: só os de hoje, e só passada mais de uma hora da hora combinada
  // (antes disso não está atrasado, está a acontecer).
  const feitos = new Set(((transporteLogs.data || []) as any[]).filter(l => l.done).map(l => l.schedule_id))
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const transportesBy: Record<string, { label: string; time: string | null; done: boolean }[]> = {}
  ;((transportes.data || []) as any[]).forEach(t => {
    if (Array.isArray(t.weekdays) && t.weekdays.length && !t.weekdays.includes(diaSemana)) return
    if (!t.patient_id) return
    if (t.time) {
      const [hh, mm] = String(t.time).split(':').map(Number)
      if (agoraMin < (hh * 60 + (mm || 0)) + 60) return
    }
    ;(transportesBy[t.patient_id] ||= []).push({ label: t.label, time: t.time, done: feitos.has(t.id) })
  })

  // Peso a partir do jsonb vitals dos care_records.
  const weightsBy: Record<string, { patient_id: string; date: string; weight: number }[]> = {}
  ;(careHist.data || []).forEach((r: any) => {
    const w = r.vitals && (r.vitals.weight ?? r.vitals.peso)
    if (w != null && !isNaN(Number(w))) (weightsBy[r.patient_id] ||= []).push({ patient_id: r.patient_id, date: r.date, weight: Number(w) })
  })

  const results = rankByAttention(patients.map((pt: any) => summariseResident({
    patient: pt,
    meds: (medsBy[pt.id] || []).map((m: any) => m.name),
    careToday: careTodayBy[pt.id] || [],
    careHistory: careHistBy[pt.id] || [],
    mar: marBy[pt.id] || [],
    marExpectedToday: (medsBy[pt.id] || []).length || undefined,
    incidents: incBy[pt.id] || [],
    wounds: woundsBy[pt.id] || [],
    assessments: assessBy[pt.id] || [],
    weights: weightsBy[pt.id] || [],
    hydrationToday: hydBy[pt.id] || [],
    residentRequests: reqsBy[pt.id] || [],
    attendanceRecent: presencasBy[pt.id] || [],
    prepPendingThisWeek: casaUsaPreparacao && comHorario.has(pt.id) && !preparados.has(pt.id),
    transportsToday: transportesBy[pt.id] || [],
    dailyDetail: detalheBy[pt.id] || [],
    hasOpenWound: comFeridaAberta.has(pt.id),
  })))

  // Tendência (2-3 semanas) — mesma função que o /apoio-psicossocial usa.
  // Aqui só interessam os utentes COM sinais (os outros não vão à lista).
  const allTrends = await loadTrends(supabase, scope, patients)
  const trends: Record<string, ResidentTrend> = {}
  Object.entries(allTrends).forEach(([pid, t]) => { if (t.flags.length) trends[pid] = t })

  return { results, trends }
}

/** Tabelas a subscrever no realtime para manter o Sentinel fresco. */
export const SENTINEL_LIVE_TABLES = [
  'patients', 'care_records', 'mar_records', 'incidents', 'wounds', 'assessments',
  'patient_meds', 'hydration_logs', 'resident_requests', 'activities', 'activity_participations',
  'attendance', 'medication_prep_logs', 'support_transport_logs',
]
