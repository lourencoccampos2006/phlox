// lib/appleHealthParser.ts
// Parser do export do Apple Health. O utilizador faz "Export All Health Data" na
// app Saúde → recebe um .zip com um export.xml. Este parser extrai os Records de
// vitais (peso, TA, FC, SpO2, glicemia, temp) com regex (XML completo seria pesado).
// Retorna registos prontos para inserir em `vitals`.

export interface ParsedVital {
  recorded_at: string                  // ISO
  hr?: number                          // bpm
  bp_sys?: number; bp_dia?: number     // mmHg
  spo2?: number                        // %
  weight?: number                      // kg
  glucose?: number                     // mg/dL
  temp?: number                        // °C
  notes?: string
}

// Mapas dos identificadores Apple Health → coluna interna
const TYPE_MAP: Record<string, keyof ParsedVital> = {
  HKQuantityTypeIdentifierHeartRate: 'hr',
  HKQuantityTypeIdentifierBloodPressureSystolic: 'bp_sys',
  HKQuantityTypeIdentifierBloodPressureDiastolic: 'bp_dia',
  HKQuantityTypeIdentifierOxygenSaturation: 'spo2',
  HKQuantityTypeIdentifierBodyMass: 'weight',
  HKQuantityTypeIdentifierBloodGlucose: 'glucose',
  HKQuantityTypeIdentifierBodyTemperature: 'temp',
}

// Converte unidades quando necessário
function convertValue(field: keyof ParsedVital, value: number, unit?: string): number {
  if (field === 'spo2' && value <= 1) return Math.round(value * 100 * 10) / 10  // 0.98 → 98.0
  if (field === 'temp' && unit?.toLowerCase().includes('f')) return Math.round((value - 32) * 5 / 9 * 10) / 10
  if (field === 'weight' && unit?.toLowerCase().includes('lb')) return Math.round(value * 0.453592 * 10) / 10
  if (field === 'glucose' && unit?.toLowerCase().includes('mmol')) return Math.round(value * 18 * 10) / 10
  return Math.round(value * 10) / 10
}

const RECORD_RE = /<Record\s([^>]+?)\/?>/g
const ATTR_RE = (name: string) => new RegExp(`${name}="([^"]*)"`)

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(ATTR_RE(name)); return m ? m[1] : null
}

// Bucket por timestamp arredondado ao MINUTO — agrupa medidas simultâneas
// (ex: TA sistólica e diastólica que vêm em records separados ao mesmo segundo)
function bucketKey(iso: string): string { return iso.slice(0, 16) }

export interface ParseSummary {
  total_records_read: number
  vitals_count: number
  byType: Record<string, number>
}

export function parseAppleHealthXml(xml: string): { vitals: ParsedVital[]; summary: ParseSummary } {
  const buckets: Map<string, ParsedVital> = new Map()
  const byType: Record<string, number> = {}
  let total = 0

  // Iterar Records sem fazer parse XML completo (mais leve)
  let m: RegExpExecArray | null
  while ((m = RECORD_RE.exec(xml))) {
    total++
    const tag = m[1]
    const type = getAttr(tag, 'type')
    if (!type || !TYPE_MAP[type]) continue
    const field = TYPE_MAP[type]

    const valueStr = getAttr(tag, 'value'); if (!valueStr) continue
    const value = Number(valueStr); if (isNaN(value)) continue
    const unit = getAttr(tag, 'unit') || undefined
    const start = getAttr(tag, 'startDate'); if (!start) continue

    const iso = new Date(start.replace(' ', 'T')).toISOString()
    const key = bucketKey(iso)
    const entry = buckets.get(key) || { recorded_at: iso }
    ;(entry as any)[field] = convertValue(field, value, unit)
    buckets.set(key, entry)
    byType[type] = (byType[type] || 0) + 1
  }

  // Mantém só buckets com pelo menos uma medida útil
  const vitals = Array.from(buckets.values()).filter(v =>
    v.hr != null || v.bp_sys != null || v.bp_dia != null || v.spo2 != null ||
    v.weight != null || v.glucose != null || v.temp != null
  )

  return { vitals, summary: { total_records_read: total, vitals_count: vitals.length, byType } }
}
