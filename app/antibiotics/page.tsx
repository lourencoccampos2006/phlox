'use client'

import { useState } from 'react'

const INFECTION_SITES = [
  'Pneumonia adquirida na comunidade (PAC)',
  'Pneumonia associada a cuidados de saúde (HCAP)',
  'Pneumonia nosocomial / VAP',
  'Infeção urinária não complicada (cistite)',
  'Pielonefrite / IU complicada',
  'Infeção intra-abdominal (peritonite, abcesso)',
  'Infeção da pele e tecidos moles (SSTI)',
  'Celulite / erisipela',
  'Fasciite necrotizante',
  'Bacteriemia / septicemia',
  'Endocardite infeciosa',
  'Meningite bacteriana',
  'Encefalite',
  'Osteomielite',
  'Artrite séptica',
  'Infeção de prótese / dispositivo',
  'Abcesso dentário / infeção oral',
  'Sinusite bacteriana aguda',
  'Otite média aguda',
  'Amigdalite / faringite bacteriana',
  'Infeção por C. difficile',
  'Candidemia / candidíase invasiva',
  'Outro (especificar no contexto)',
]

const SEVERITY = [
  { value: 'ligeira', label: 'Ligeira — ambulatório' },
  { value: 'moderada', label: 'Moderada — internamento' },
  { value: 'grave', label: 'Grave — UCI/cuidados intensivos' },
  { value: 'sepsis_shock', label: 'Choque séptico' },
]

const MRSA_RISKS = [
  'Internamento hospitalar recente (< 90 dias)',
  'Residente em lar / estrutura de cuidados',
  'Diálise crónica',
  'Colonização prévia conhecida por MRSA',
  'Ferida crónica / úlcera de pressão',
  'Cateter venoso central',
  'Antibioterapia prévia (< 3 meses)',
  'Profissional de saúde',
]

const ESBL_RISKS = [
  'Internamento hospitalar recente (< 90 dias)',
  'Antibioterapia prévia com cefalosporinas/fluoroquinolonas',
  'ITU recorrente / infeção prévia por ESBL',
  'Viagem recente a zonas endémicas',
  'Cateterismo urinário',
  'Imunossupressão / corticoterapia',
  'DM com complicações',
]

interface AntibioticResult {
  site: string
  likely_pathogens: string[]
  empirical_first_line: { regimen: string; rationale: string; allergies_note: string }
  empirical_second_line: { regimen: string; rationale: string }
  mrsa_coverage: { needed: boolean; risk_factors: string[]; add_on: string; dose: string }
  esbl_pseudomonas_coverage: { needed: boolean; risk_factors: string[]; regimen: string }
  iv_to_oral: { eligible_criteria: string[]; oral_regimen: string }
  duration: { standard: string; extended: string; stop_criteria: string[] }
  renal_adjustment: { drug: string; gfr_below: number; adjustment: string }[]
  monitoring: string[]
  de_escalation: string
  stewardship_notes: string
}

export default function AntibioticsPage() {
  const [site, setSite] = useState('')
  const [severity, setSeverity] = useState('moderada')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [creatinine, setCreatinine] = useState('')
  const [allergies, setAllergies] = useState('')
  const [mrsaRisks, setMrsaRisks] = useState<string[]>([])
  const [esblRisks, setEsblRisks] = useState<string[]>([])
  const [priorAntibiotics, setPriorAntibiotics] = useState('')
  const [cultureResult, setCultureResult] = useState('')
  const [context, setContext] = useState('')

  const [result, setResult] = useState<AntibioticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const toggleMrsa = (r: string) => setMrsaRisks(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])
  const toggleEsbl = (r: string) => setEsblRisks(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])

  const submit = async () => {
    if (!site) { setError('Seleciona o local de infeção.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/antibiotics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          severity,
          age: age || undefined,
          weight: weight || undefined,
          creatinine: creatinine || undefined,
          allergies: allergies || undefined,
          risk_mrsa: mrsaRisks.length ? mrsaRisks.join(', ') : undefined,
          risk_esbl: esblRisks.length ? esblRisks.join(', ') : undefined,
          prior_antibiotics: priorAntibiotics || undefined,
          culture_result: cultureResult || undefined,
          context: context || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro ao gerar recomendação.') }
    setLoading(false)
  }

  const copyReport = () => {
    if (!result) return
    const lines = [
      `ORIENTAÇÃO DE ANTIBIOTERAPIA — ${result.site.toUpperCase()}`,
      `Gravidade: ${severity}`,
      '',
      '== AGENTES PROVÁVEIS ==',
      result.likely_pathogens.join(', '),
      '',
      '== ANTIBIOTERAPIA EMPÍRICA — 1.ª LINHA ==',
      result.empirical_first_line.regimen,
      `Racional: ${result.empirical_first_line.rationale}`,
      result.empirical_first_line.allergies_note ? `Alergia penicilina: ${result.empirical_first_line.allergies_note}` : '',
      '',
      '== ANTIBIOTERAPIA EMPÍRICA — 2.ª LINHA ==',
      result.empirical_second_line.regimen,
      `Quando usar: ${result.empirical_second_line.rationale}`,
      '',
      result.mrsa_coverage.needed ? [
        '== COBERTURA MRSA ==',
        `Adicionar: ${result.mrsa_coverage.add_on} ${result.mrsa_coverage.dose}`,
        `Fatores de risco: ${result.mrsa_coverage.risk_factors.join(', ')}`,
        '',
      ].join('\n') : '',
      result.esbl_pseudomonas_coverage.needed ? [
        '== COBERTURA ESBL/PSEUDOMONAS ==',
        result.esbl_pseudomonas_coverage.regimen,
        '',
      ].join('\n') : '',
      '== STEP-DOWN IV→ORAL ==',
      result.iv_to_oral.eligible_criteria.join(' | '),
      `Oral: ${result.iv_to_oral.oral_regimen}`,
      '',
      '== DURAÇÃO ==',
      `Standard: ${result.duration.standard}`,
      `Prolongar se: ${result.duration.extended}`,
      `Critérios de paragem: ${result.duration.stop_criteria.join('; ')}`,
      '',
      result.renal_adjustment.length ? [
        '== AJUSTE RENAL ==',
        ...result.renal_adjustment.map(r => `${r.drug} (TFG < ${r.gfr_below}): ${r.adjustment}`),
        '',
      ].join('\n') : '',
      '== MONITORIZAÇÃO ==',
      result.monitoring.join(' | '),
      '',
      '== DE-ESCALONAMENTO ==',
      result.de_escalation,
      '',
      '== STEWARDSHIP ==',
      result.stewardship_notes,
      '',
      `Gerado via Phlox — ${new Date().toLocaleDateString('pt-PT')}`,
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines as string).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const sevColor = severity === 'sepsis_shock' ? '#991b1b' : severity === 'grave' ? '#c2410c' : severity === 'moderada' ? '#0369a1' : '#065f46'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Farmácia Clínica · Antibioterapia</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', marginBottom: 6 }}>Antibioterapia Empírica</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 560 }}>
            Orientação de antibioterapia baseada em ESCMID/EUCAST 2024, IDSA, DGS PPCIRA. Inclui ajuste renal, step-down IV→oral, cobertura MRSA/ESBL e stewardship.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1.4fr' : '1fr', gap: 16, alignItems: 'start' }}>

          {/* Input panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Site + Severity */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Local de infeção e gravidade</div>

              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Local de infeção *</label>
              <select value={site} onChange={e => setSite(e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 14, fontFamily: 'var(--font-sans)', background: 'white' }}>
                <option value="">— Selecionar —</option>
                {INFECTION_SITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Gravidade clínica</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {SEVERITY.map(s => (
                  <button key={s.value} onClick={() => setSeverity(s.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: `2px solid ${severity === s.value ? sevColor : 'var(--border)'}`, background: severity === s.value ? sevColor : 'var(--bg-2)', color: severity === s.value ? 'white' : 'var(--ink-3)', fontSize: 11, cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Demographics */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Dados do doente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Idade (anos)', val: age, set: setAge, placeholder: 'ex: 68' },
                  { label: 'Peso (kg)', val: weight, set: setWeight, placeholder: 'ex: 72' },
                  { label: 'Creatinina (mg/dL)', val: creatinine, set: setCreatinine, placeholder: 'ex: 1.8' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Alergias</label>
              <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="ex: Penicilina (anafilaxia), Sulfonamidas"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>

            {/* MRSA risks */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Fatores de risco MRSA</div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 12 }}>Selecionar os que se aplicam</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MRSA_RISKS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={mrsaRisks.includes(r)} onChange={() => toggleMrsa(r)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#991b1b' }} />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {/* ESBL risks */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Fatores de risco ESBL / Pseudomonas</div>
              <div style={{ fontSize: 11, color: 'var(--ink-5)', marginBottom: 12 }}>Selecionar os que se aplicam</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ESBL_RISKS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={esblRisks.includes(r)} onChange={() => toggleEsbl(r)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#0369a1' }} />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {/* Additional context */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Contexto clínico adicional</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Antibióticos prévios</label>
                  <input value={priorAntibiotics} onChange={e => setPriorAntibiotics(e.target.value)} placeholder="ex: Amoxicilina 500mg × 5 dias (há 2 semanas)"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Resultado de cultura / antibiograma</label>
                  <textarea value={cultureResult} onChange={e => setCultureResult(e.target.value)} placeholder="ex: Urina — E. coli > 100.000 UFC/mL. Sensível a ciprofloxacina, fosfomicina. Resistente a ampicilina."
                    rows={3} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Contexto adicional</label>
                  <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="ex: Pós-operatório de cirurgia abdominal, imunodeprimido, neoplasia hematológica..."
                    rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}

            <button onClick={submit} disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? '#9ca3af' : '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    A gerar orientação...
                  </span>
                : 'Gerar orientação de antibioterapia'}
            </button>
          </div>

          {/* Results panel */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Header card */}
              <div style={{ background: '#0f172a', borderRadius: 14, padding: 20, color: 'white' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Orientação de Antibioterapia</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{result.site}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {result.likely_pathogens.map((p, i) => (
                    <span key={i} style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>{p}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyReport}
                    style={{ padding: '8px 14px', background: copied ? '#065f46' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, color: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    {copied ? '✓ Copiado' : '⎘ Copiar relatório'}
                  </button>
                  <button onClick={() => window.print()}
                    style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, color: 'white', fontSize: 12, cursor: 'pointer' }}>
                    Imprimir
                  </button>
                </div>
              </div>

              {/* Empirical 1st line */}
              <div style={{ background: 'white', border: '2px solid #6ee7b7', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: '2px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>1.ª Linha</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Antibioterapia Empírica</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 8, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{result.empirical_first_line.regimen}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, lineHeight: 1.5 }}>{result.empirical_first_line.rationale}</div>
                {result.empirical_first_line.allergies_note && (
                  <div style={{ padding: '8px 10px', background: '#fef9c3', borderRadius: 6, fontSize: 11, color: '#854d0e', lineHeight: 1.5 }}>
                    <strong>Alergia à penicilina:</strong> {result.empirical_first_line.allergies_note}
                  </div>
                )}
              </div>

              {/* Empirical 2nd line */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>2.ª Linha</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Alternativa</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{result.empirical_second_line.regimen}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{result.empirical_second_line.rationale}</div>
              </div>

              {/* MRSA coverage */}
              {result.mrsa_coverage.needed && (
                <div style={{ background: '#fff7ed', border: '2px solid #fdba74', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 8 }}>⚠ Cobertura MRSA recomendada</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#9a3412', fontWeight: 700, marginBottom: 6 }}>
                    Adicionar: {result.mrsa_coverage.add_on} {result.mrsa_coverage.dose}
                  </div>
                  <div style={{ fontSize: 11, color: '#c2410c' }}>
                    Fatores de risco: {result.mrsa_coverage.risk_factors.join(' · ')}
                  </div>
                </div>
              )}

              {/* ESBL coverage */}
              {result.esbl_pseudomonas_coverage.needed && (
                <div style={{ background: '#faf5ff', border: '2px solid #c4b5fd', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', marginBottom: 8 }}>⚠ Cobertura ESBL/Pseudomonas recomendada</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#5b21b6', fontWeight: 700, marginBottom: 6 }}>{result.esbl_pseudomonas_coverage.regimen}</div>
                  <div style={{ fontSize: 11, color: '#7c3aed' }}>
                    Fatores de risco: {result.esbl_pseudomonas_coverage.risk_factors.join(' · ')}
                  </div>
                </div>
              )}

              {/* IV to Oral */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Step-down IV → Oral</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Critérios de elegibilidade</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.iv_to_oral.eligible_criteria.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ink-2)', alignItems: 'flex-start' }}>
                        <span style={{ color: '#059669', flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#065f46', fontWeight: 600 }}>
                  Oral: {result.iv_to_oral.oral_regimen}
                </div>
              </div>

              {/* Duration */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Duração de tratamento</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Standard</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{result.duration.standard}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Prolongar se</div>
                    <div style={{ fontSize: 12, color: '#9a3412', lineHeight: 1.4 }}>{result.duration.extended}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Critérios para parar</div>
                  {result.duration.stop_criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ink-2)', alignItems: 'flex-start', marginBottom: 3 }}>
                      <span style={{ color: '#dc2626', flexShrink: 0 }}>◼</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Renal adjustment */}
              {result.renal_adjustment.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Ajuste de dose renal</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.renal_adjustment.map((r, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0369a1' }}>{r.drug}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', padding: '2px 6px', background: '#ede9fe', borderRadius: 4 }}>TFG {'<'} {r.gfr_below} mL/min</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#0c4a6e', marginTop: 4, lineHeight: 1.4 }}>{r.adjustment}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monitoring */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Monitorização</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.monitoring.map((m, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{m}</span>
                  ))}
                </div>
              </div>

              {/* De-escalation + stewardship */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>De-escalonamento após culturas</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>{result.de_escalation}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Stewardship</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.stewardship_notes}</div>
              </div>

              {/* Disclaimer */}
              <div style={{ padding: '12px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#854d0e', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                ⚠ Orientação de suporte à decisão clínica. Sempre adaptar ao antibiograma local, ao perfil do doente e às guidelines institucionais. Não substitui avaliação médica ou farmacêutica presencial. Revisão 48-72h mandatória.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
