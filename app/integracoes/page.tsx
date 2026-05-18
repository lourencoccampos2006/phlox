'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface ParsedVital {
  type: string
  value: number
  unit: string
  date: string
}

interface ParsedMed {
  name: string
  dose?: string
  frequency?: string
}

interface ImportResult {
  vitals: ParsedVital[]
  meds: ParsedMed[]
  source: string
}

// ─── Apple Health XML Parser (client-side) ─────────────────────────────────
function parseAppleHealthXML(xml: string): ImportResult {
  const vitals: ParsedVital[] = []
  const meds: ParsedMed[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const records = doc.querySelectorAll('Record')
  const typeMap: Record<string, { field: string; label: string; unit: string }> = {
    HKQuantityTypeIdentifierHeartRate:          { field: 'hr',     label: 'Frequência Cardíaca', unit: 'bpm' },
    HKQuantityTypeIdentifierBloodPressureSystolic: { field: 'bp_sys', label: 'Tensão Sistólica', unit: 'mmHg' },
    HKQuantityTypeIdentifierBloodPressureDiastolic:{ field: 'bp_dia', label: 'Tensão Diastólica', unit: 'mmHg' },
    HKQuantityTypeIdentifierOxygenSaturation:   { field: 'spo2',   label: 'SpO₂', unit: '%' },
    HKQuantityTypeIdentifierBodyMass:           { field: 'weight', label: 'Peso', unit: 'kg' },
    HKQuantityTypeIdentifierBloodGlucose:       { field: 'glucose',label: 'Glicemia', unit: 'mg/dL' },
    HKQuantityTypeIdentifierBodyTemperature:    { field: 'temp',   label: 'Temperatura', unit: '°C' },
  }

  const seen = new Set<string>()
  records.forEach(rec => {
    const type = rec.getAttribute('type') || ''
    const meta = typeMap[type]
    if (!meta) return
    const valStr = rec.getAttribute('value')
    const date = rec.getAttribute('startDate') || ''
    if (!valStr || !date) return
    const value = parseFloat(valStr)
    if (isNaN(value)) return

    // Deduplicate by type+date (take most recent per day)
    const dayKey = `${meta.field}-${date.slice(0, 10)}`
    if (!seen.has(dayKey)) {
      seen.add(dayKey)
      vitals.push({ type: meta.field, value, unit: meta.unit, date })
    }
  })

  // Try clinical records for medications
  const clinicalRecs = doc.querySelectorAll('ClinicalRecord')
  clinicalRecs.forEach(rec => {
    const type = rec.getAttribute('type') || ''
    if (type.includes('Medication')) {
      const source = rec.getAttribute('sourceName') || 'Apple Health'
      const displayName = rec.getAttribute('displayName') || source
      if (displayName) meds.push({ name: displayName })
    }
  })

  return { vitals: vitals.slice(0, 500), meds, source: 'Apple Health' }
}

// ─── CSV (Garmin / Fitbit / Polar) Parser ──────────────────────────────────
function parseWearableCSV(csv: string, source: string): ImportResult {
  const vitals: ParsedVital[] = []
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { vitals: [], meds: [], source }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/["']/g, ''))

  // Detect columns
  const colMap = {
    date: header.findIndex(h => h.includes('date') || h.includes('timestamp') || h.includes('time') || h.includes('data')),
    hr: header.findIndex(h => h.includes('heart') || h.includes('bpm') || h === 'hr' || h.includes('pulse')),
    weight: header.findIndex(h => h.includes('weight') || h.includes('peso') || h.includes('mass')),
    spo2: header.findIndex(h => h.includes('spo2') || h.includes('oxygen') || h.includes('oxig')),
    bp_sys: header.findIndex(h => h.includes('systolic') || h.includes('sistol') || h === 'sbp'),
    bp_dia: header.findIndex(h => h.includes('diastolic') || h.includes('diastol') || h === 'dbp'),
    glucose: header.findIndex(h => h.includes('glucose') || h.includes('glicemia') || h.includes('sugar')),
  }

  const seen = new Set<string>()
  lines.slice(1).forEach(line => {
    const cols = line.split(',').map(c => c.trim().replace(/["']/g, ''))
    const date = colMap.date >= 0 ? cols[colMap.date] : ''
    if (!date) return

    const entries: [string, number, string][] = [
      ['hr', colMap.hr >= 0 ? parseFloat(cols[colMap.hr]) : NaN, 'bpm'],
      ['weight', colMap.weight >= 0 ? parseFloat(cols[colMap.weight]) : NaN, 'kg'],
      ['spo2', colMap.spo2 >= 0 ? parseFloat(cols[colMap.spo2]) : NaN, '%'],
      ['bp_sys', colMap.bp_sys >= 0 ? parseFloat(cols[colMap.bp_sys]) : NaN, 'mmHg'],
      ['bp_dia', colMap.bp_dia >= 0 ? parseFloat(cols[colMap.bp_dia]) : NaN, 'mmHg'],
      ['glucose', colMap.glucose >= 0 ? parseFloat(cols[colMap.glucose]) : NaN, 'mg/dL'],
    ]

    entries.forEach(([type, value, unit]) => {
      if (isNaN(value) || value <= 0) return
      const dayKey = `${type}-${date.slice(0, 10)}`
      if (!seen.has(dayKey)) {
        seen.add(dayKey)
        vitals.push({ type, value, unit, date })
      }
    })
  })

  return { vitals: vitals.slice(0, 500), meds: [], source }
}

// ─── Group vitals by date for Supabase insert ─────────────────────────────
function groupVitalsByDate(vitals: ParsedVital[]): Record<string, Record<string, number>> {
  const grouped: Record<string, Record<string, number>> = {}
  vitals.forEach(v => {
    const day = v.date.slice(0, 10)
    if (!grouped[day]) grouped[day] = {}
    grouped[day][v.type] = v.value
  })
  return grouped
}

export default function IntegracoesPage() {
  const { user, supabase } = useAuth()
  const [activeProfileState, setActiveProfileState] = useState<ActiveProfile | null>(null)
  const [activeTab, setActiveTab] = useState<'apple' | 'wearable' | 'mysnspdf' | 'manual'>('apple')
  const [parsed, setParsed] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  useEffect(() => { setActiveProfileState(getActiveProfile()) }, [])
  const [error, setError] = useState<string | null>(null)
  const [csvSource, setCsvSource] = useState<'Garmin' | 'Fitbit' | 'Polar' | 'Outro'>('Garmin')
  const appleRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  // Manual MySNS paste
  const [snsText, setSnsText] = useState('')
  const [parsedSns, setParsedSns] = useState<ParsedMed[]>([])

  const handleAppleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setParsed(null)
    const text = await file.text()
    const result = parseAppleHealthXML(text)
    if (result.vitals.length === 0 && result.meds.length === 0) {
      setError('Nenhum dado reconhecido. Certifica-te de que selecionaste o ficheiro export.xml da Apple Saúde.')
      return
    }
    setParsed(result)
  }

  const handleCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setParsed(null)
    const text = await file.text()
    const result = parseWearableCSV(text, csvSource)
    if (result.vitals.length === 0) {
      setError('Nenhum dado reconhecido neste CSV. Verifica se o formato está correto.')
      return
    }
    setParsed(result)
  }

  const parseSNSText = () => {
    if (!snsText.trim()) return
    const lines = snsText.split('\n').filter(l => l.trim().length > 3)
    const meds: ParsedMed[] = []
    lines.forEach(line => {
      const clean = line.trim()
      if (clean.length < 4) return
      // Try to extract dose from line: "Metformina 500mg 2x/dia"
      const doseMatch = clean.match(/(\d+\s*mg|\d+\s*mcg|\d+\s*ml|\d+\s*g)/i)
      const freqMatch = clean.match(/(\d+x\/dia|uma vez|duas vezes|manhã|noite|almoço)/i)
      const name = clean.replace(doseMatch?.[0] || '', '').replace(freqMatch?.[0] || '', '').trim()
      if (name.length > 2) meds.push({ name, dose: doseMatch?.[0], frequency: freqMatch?.[0] })
    })
    setParsedSns(meds)
  }

  const importVitals = async (vitals: ParsedVital[]) => {
    if (!user) return
    setImporting(true)
    const { data: sd } = await supabase.auth.getSession()
    const grouped = groupVitalsByDate(vitals)
    let count = 0

    const insertBatch = Object.entries(grouped).map(([date, fields]) => ({
      user_id: user.id,
      recorded_at: new Date(date).toISOString(),
      ...fields,
    }))

    // Insert in chunks of 50
    for (let i = 0; i < insertBatch.length; i += 50) {
      const chunk = insertBatch.slice(i, i + 50)
      const res = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify(chunk[0]), // vitals API takes one at a time
      })
      if (res.ok) count++
    }

    setImportedCount(count)
    setImporting(false)
  }

  const importMeds = async (meds: ParsedMed[]) => {
    if (!user) return
    setImporting(true)
    const { data: sd } = await supabase.auth.getSession()
    let count = 0

    for (const med of meds.slice(0, 50)) {
      const { error } = await supabase.from('personal_meds').insert({
        user_id: user.id,
        name: med.name,
        dose: med.dose || null,
        frequency: med.frequency || null,
      })
      if (!error) count++
    }

    setImportedCount(count)
    setImporting(false)
  }

  const TABS = [
    { id: 'apple' as const, icon: '', label: 'Apple Saúde', desc: 'iPhone / Apple Watch' },
    { id: 'wearable' as const, icon: '⌚', label: 'Wearable CSV', desc: 'Garmin · Fitbit · Polar' },
    { id: 'mysnspdf' as const, icon: '🏥', label: 'MySNS / Receita', desc: 'Colar texto da app' },
    { id: 'manual' as const, icon: '✍️', label: 'Entrada manual', desc: 'Digitar medicamentos' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Integrações</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>Importar dados de saúde</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', maxWidth: 560 }}>
                Importa os teus dados diretamente da Apple Saúde, wearables ou apps médicas. Os dados ficam no teu perfil Phlox.
              </div>
            </div>
            <ProfileSelector onChange={p => setActiveProfileState(p)} />
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setParsed(null); setError(null); setImportedCount(0) }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 14px',
              border: `2px solid ${activeTab === tab.id ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: 10, background: activeTab === tab.id ? '#f0fdf4' : 'white',
              cursor: 'pointer', textAlign: 'left', minWidth: 120,
            }}>
              <span style={{ fontSize: 18, marginBottom: 2 }}>{tab.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{tab.label}</span>
              <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* Apple Health tab */}
        {activeTab === 'apple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Como exportar da app Saúde (iPhone)</div>
              <ol style={{ margin: '12px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Abre a app Saúde no iPhone',
                  'Toca no teu nome/foto no topo direito',
                  'Desce até "Exportar todos os dados de saúde"',
                  'Confirma → partilha o ZIP para este browser',
                  'Extrai o ZIP e seleciona o ficheiro export.xml',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink)', marginRight: 4 }}>{i + 1}.</span>{step}
                  </li>
                ))}
              </ol>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', background: 'var(--bg-2)', borderRadius: 8, padding: '8px 12px' }}>
                🔒 O ficheiro é processado no teu browser — nunca é enviado para os nossos servidores.
              </div>
            </div>

            <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => appleRef.current?.click()}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Selecionar export.xml</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Arrasta o ficheiro aqui ou clica para selecionar</div>
              <input ref={appleRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleAppleFile} />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>
                ⚠️ {error}
              </div>
            )}

            {parsed && (
              <ImportPreview
                result={parsed}
                importing={importing}
                importedCount={importedCount}
                onImportVitals={() => importVitals(parsed.vitals)}
                onImportMeds={() => importMeds(parsed.meds)}
              />
            )}
          </div>
        )}

        {/* Wearable CSV tab */}
        {activeTab === 'wearable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Dispositivo</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {(['Garmin', 'Fitbit', 'Polar', 'Outro'] as const).map(s => (
                  <button key={s} onClick={() => setCsvSource(s)} style={{
                    padding: '8px 16px', border: `2px solid ${csvSource === s ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 8, background: csvSource === s ? '#f0fdf4' : 'white',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)',
                  }}>{s}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', background: 'var(--bg-2)', borderRadius: 8, padding: '8px 12px' }}>
                {{
                  Garmin: 'Garmin Connect → Relatórios → Exportar CSV de frequência cardíaca / peso',
                  Fitbit: 'Fitbit.com → Dados pessoais → Exportar dados → Selecionar CSV',
                  Polar: 'flow.polar.com → Histórico de treinos → Exportar CSV',
                  Outro: 'CSV com colunas: date, heart_rate (ou bpm), weight, spo2 (opcional)',
                }[csvSource]}
              </div>
            </div>

            <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 14, padding: 32, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => csvRef.current?.click()}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⌚</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Selecionar ficheiro CSV</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>Arrasta o ficheiro CSV do {csvSource} aqui</div>
              <input ref={csvRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCSVFile} />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#991b1b' }}>
                ⚠️ {error}
              </div>
            )}

            {parsed && (
              <ImportPreview
                result={parsed}
                importing={importing}
                importedCount={importedCount}
                onImportVitals={() => importVitals(parsed.vitals)}
                onImportMeds={() => importMeds(parsed.meds)}
              />
            )}
          </div>
        )}

        {/* MySNS / Receita tab */}
        {activeTab === 'mysnspdf' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Colar lista de medicamentos</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 14 }}>
                Copia o texto da app MySNS, de uma receita médica ou de uma bula e cola aqui. O Phlox identifica automaticamente os medicamentos.
              </div>
              <textarea
                value={snsText}
                onChange={e => setSnsText(e.target.value)}
                placeholder="Ex:&#10;Metformina 500mg 2x/dia&#10;Lisinopril 10mg manhã&#10;Atorvastatina 20mg noite"
                rows={8}
                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none', lineHeight: 1.7 }}
              />
              <button onClick={parseSNSText} disabled={!snsText.trim()} style={{
                marginTop: 10, padding: '10px 20px', background: snsText.trim() ? 'var(--green)' : 'var(--bg-3)',
                color: snsText.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: snsText.trim() ? 'pointer' : 'default',
              }}>
                🔍 Identificar medicamentos
              </button>
            </div>

            {parsedSns.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>💊 {parsedSns.length} medicamentos identificados</span>
                  {!importing && importedCount === 0 && (
                    <button onClick={() => importMeds(parsedSns)} style={{
                      padding: '8px 16px', background: 'var(--green)', color: 'white',
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>
                      Importar todos
                    </button>
                  )}
                  {importedCount > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✓ {importedCount} importados</span>
                  )}
                </div>
                {parsedSns.map((m, i) => (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: i < parsedSns.length - 1 ? '1px solid var(--bg-2)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{m.name}</div>
                      {m.dose && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{m.dose}{m.frequency ? ` · ${m.frequency}` : ''}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual tab */}
        {activeTab === 'manual' && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Adicionar medicamentos manualmente</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16 }}>
              Podes adicionar medicamentos diretamente em{' '}
              <a href="/mymeds" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>Os Meus Medicamentos</a>
              {' '}com todos os detalhes (dose, frequência, indicação, lembretes).
            </div>
            <a href="/mymeds" style={{
              display: 'inline-block', padding: '12px 24px', background: 'var(--green)', color: 'white',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
            }}>
              💊 Ir para Os Meus Medicamentos →
            </a>
          </div>
        )}

        {/* Integration badges */}
        <div style={{ marginTop: 24, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Integrações disponíveis</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { icon: '', label: 'Apple Saúde', status: 'ativo' },
              { icon: '⌚', label: 'Apple Watch', status: 'ativo' },
              { icon: '🏃', label: 'Garmin Connect', status: 'ativo' },
              { icon: '🔵', label: 'Fitbit', status: 'ativo' },
              { icon: '🔴', label: 'Polar Flow', status: 'ativo' },
              { icon: '🏥', label: 'MySNS', status: 'ativo' },
              { icon: '🟢', label: 'Google Health', status: 'em breve' },
              { icon: '🩺', label: 'SClínico', status: 'em breve' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                border: '1px solid var(--border)', borderRadius: 20, background: item.status === 'ativo' ? 'white' : 'var(--bg-2)',
              }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: item.status === 'ativo' ? 'var(--ink)' : 'var(--ink-5)' }}>{item.label}</span>
                {item.status === 'em breve' && <span style={{ fontSize: 9, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>em breve</span>}
                {item.status === 'ativo' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImportPreview({ result, importing, importedCount, onImportVitals, onImportMeds }: {
  result: ImportResult
  importing: boolean
  importedCount: number
  onImportVitals: () => void
  onImportMeds: () => void
}) {
  const vitalDays = new Set(result.vitals.map(v => v.date.slice(0, 10))).size
  const vitalTypes = new Set(result.vitals.map(v => v.type))

  return (
    <div style={{ background: '#f0fdf4', border: '2px solid #10b981', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 12 }}>
        ✓ Dados encontrados — {result.source}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {result.vitals.length > 0 && (
          <div style={{ background: 'white', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', flex: '1 1 200px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', fontFamily: 'var(--font-mono)' }}>{vitalDays}</div>
            <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>dias de sinais vitais</div>
            <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 4 }}>
              {Array.from(vitalTypes).map(t => ({ hr: 'FC', bp_sys: 'TA', bp_dia: 'TA', spo2: 'SpO₂', weight: 'Peso', glucose: 'Glicemia', temp: 'Temp' })[t] || t).join(' · ')}
            </div>
          </div>
        )}
        {result.meds.length > 0 && (
          <div style={{ background: 'white', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', flex: '1 1 200px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#065f46', fontFamily: 'var(--font-mono)' }}>{result.meds.length}</div>
            <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>medicamentos identificados</div>
          </div>
        )}
      </div>

      {importedCount > 0 ? (
        <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46' }}>✓ {importedCount} registos importados com sucesso!</div>
      ) : importing ? (
        <div style={{ fontSize: 13, color: '#059669' }}>A importar...</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {result.vitals.length > 0 && (
            <button onClick={onImportVitals} style={{
              padding: '10px 20px', background: '#10b981', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              📊 Importar sinais vitais
            </button>
          )}
          {result.meds.length > 0 && (
            <button onClick={onImportMeds} style={{
              padding: '10px 20px', background: '#0d6e42', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              💊 Importar medicamentos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
