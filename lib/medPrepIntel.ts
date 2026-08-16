// lib/medPrepIntel.ts
// Co-piloto de unidoses (Módulo 1, 2026-08-16) — cruza a medicação ativa de
// cada utente com o motor de regras clínicas já existente (lib/decisionEngine),
// para /preparacao-medicacao e /mar deixarem de ser um checklist puro e
// passarem a mostrar alertas acionáveis no momento de preparar/administrar.
// Não inventa um motor novo — reusa runRules() (26 regras, incl. carga
// anticolinérgica R6 e IBP R15) tal e qual já é usado em /stopp-start,
// /polypharmacy, /vigia e /med-review.
//
// Uma regra não existia em lado nenhum: cruzar carga anticolinérgica + IBP
// prolongado + falta de revisão médica recente — o exemplo concreto que o
// Fernando pediu ("2 anticolinérgicos + IBP >8 semanas sem revisão"). Fica
// aqui (não em decisionEngine.ts) porque depende de started_at por fármaco e
// de patients.last_review — dados que ClinicalCase não carrega, para não
// alterar a forma partilhada por todos os outros consumidores do motor.
import { runRules, riskScore, RX, SEVERITY_META, type ClinicalCase, type Finding } from '@/lib/decisionEngine'

export { riskScore, SEVERITY_META, type Finding }

export interface PatientClinicalRow {
  age?: number | null
  egfr?: number | null
  conditions?: string | null
  allergies?: string | null
  last_review?: string | null
}
export interface MedRow { name: string; started_at?: string | null }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// patients.conditions/allergies são texto livre ("HTA, DM2, ..."), não array —
// ClinicalCase espera string[]. Mesmo separador usado noutros sítios do site.
function splitFree(s?: string | null): string[] {
  return (s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
}

export function buildClinicalCase(patient: PatientClinicalRow, medNames: string[]): ClinicalCase {
  return {
    age: patient.age ?? undefined,
    egfr: patient.egfr ?? undefined,
    conditions: splitFree(patient.conditions),
    allergies: splitFree(patient.allergies),
    meds: medNames,
  }
}

export function weeksSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.floor(ms / WEEK_MS)
}

// Carga anticolinérgica (≥2) + IBP presente há ≥8 semanas + sem revisão
// clínica registada nas últimas 8 semanas (patients.last_review, atualizado
// por /rounds a cada avaliação). Todos os três precisam de ser verdade — não
// é um alerta genérico de IBP, é especificamente a combinação de risco.
export function ppiAnticholinergicOverdueFinding(meds: MedRow[], lastReviewAt?: string | null): Finding | null {
  const anticholinergics = meds.filter(m => RX.anticholinergic.test(m.name.toLowerCase()))
  const ppis = meds.filter(m => RX.ppi.test(m.name.toLowerCase()))
  if (anticholinergics.length < 2 || ppis.length === 0) return null

  const ppiWeeks = Math.max(...ppis.map(p => weeksSince(p.started_at) ?? 0))
  if (ppiWeeks < 8) return null

  const reviewWeeks = weeksSince(lastReviewAt)
  if (reviewWeeks !== null && reviewWeeks < 8) return null // revisto recentemente — não repetir

  return {
    id: 'PREP1', severity: 'major',
    title: 'IBP prolongado + carga anticolinérgica — sugerir reavaliação',
    detail: `${anticholinergics.length} fármacos anticolinérgicos e IBP há ${ppiWeeks} semanas${reviewWeeks === null ? ', sem revisão clínica registada' : `, última revisão há ${reviewWeeks} semanas`}.`,
    reference: 'STOPP v3 · ACB score',
    action: 'Sugerir reavaliação médica da indicação do IBP e da carga anticolinérgica global.',
    involves: [...anticholinergics.map(m => m.name), ...ppis.map(m => m.name)],
  }
}

/** Todos os achados clínicos para esta pessoa: motor geral (26 regras) + a regra combinada acima. */
export function clinicalFindingsFor(patient: PatientClinicalRow, meds: MedRow[]): Finding[] {
  const general = runRules(buildClinicalCase(patient, meds.map(m => m.name)))
  const combined = ppiAnticholinergicOverdueFinding(meds, patient.last_review)
  const all = combined ? [...general, combined] : general
  const order: Finding['severity'][] = ['critical', 'major', 'moderate', 'minor', 'info']
  return all.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
}
