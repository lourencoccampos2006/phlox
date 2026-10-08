'use client'

import { useState } from 'react'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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

  const sevColor = severity === 'sepsis_shock' ? 'var(--red)' : severity === 'grave' ? 'var(--amber)' : severity === 'moderada' ? 'var(--green-3)' : 'var(--green)'

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Antibioterapia empírica</span>
        </BarraDeTrabalho>
      }
      rodape={
        /* Era uma banda escura com o título em serifa branca, e por baixo um
           parágrafo de quarenta e oito palavras a listar as guidelines. Isso
           é PROCEDÊNCIA — diz de onde vem o que se lê — e procedência vive na
           barra de estado, não por cima do trabalho. */
        <BarraDeEstado>
          <span style={MONO}>ESCMID/EUCAST 2024 · IDSA · DGS PPCIRA</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Com ajuste renal, passagem de endovenoso a oral, cobertura MRSA/ESBL
          </span>
        </BarraDeEstado>
      }
    >
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1.4fr' : '1fr', gap: 16, alignItems: 'start' }}>

          {/* Input panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Site + Severity */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 14 }}>Local de infeção e gravidade</div>

              <label style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Local de infeção *</label>
              <select value={site} onChange={e => setSite(e.target.value)}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', marginBottom: 14, fontFamily: 'var(--font-sans)', background: 'white' }}>
                <option value="">— Selecionar —</option>
                {INFECTION_SITES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Gravidade clínica</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {SEVERITY.map(s => (
                  <button key={s.value} onClick={() => setSeverity(s.value)}
                    style={{ padding: '8px 10px', borderRadius: 'var(--r-md)', border: `2px solid ${severity === s.value ? sevColor : 'var(--border)'}`, background: severity === s.value ? sevColor : 'var(--bg-2)', color: severity === s.value ? 'white' : 'var(--ink-3)', fontSize: 'var(--t-meta)', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Demographics */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 14 }}>Dados do doente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Idade (anos)', val: age, set: setAge, placeholder: 'ex: 68' },
                  { label: 'Peso (kg)', val: weight, set: setWeight, placeholder: 'ex: 72' },
                  { label: 'Creatinina (mg/dL)', val: creatinine, set: setCreatinine, placeholder: 'ex: 1.8' },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
              <label style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Alergias</label>
              <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="ex: Penicilina (anafilaxia), Sulfonamidas"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-meta)', boxSizing: 'border-box' }} />
            </div>

            {/* MRSA risks */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 4 }}>Fatores de risco MRSA</div>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginBottom: 12 }}>Selecionar os que se aplicam</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MRSA_RISKS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--t-meta)', color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={mrsaRisks.includes(r)} onChange={() => toggleMrsa(r)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--red)' }} />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {/* ESBL risks */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 4 }}>Fatores de risco ESBL / Pseudomonas</div>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginBottom: 12 }}>Selecionar os que se aplicam</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ESBL_RISKS.map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--t-meta)', color: 'var(--ink-2)' }}>
                    <input type="checkbox" checked={esblRisks.includes(r)} onChange={() => toggleEsbl(r)}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--green-3)' }} />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            {/* Additional context */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 20 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 14 }}>Contexto clínico adicional</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Antibióticos prévios</label>
                  <input value={priorAntibiotics} onChange={e => setPriorAntibiotics(e.target.value)} placeholder="ex: Amoxicilina 500mg × 5 dias (há 2 semanas)"
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-meta)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Resultado de cultura / antibiograma</label>
                  <textarea value={cultureResult} onChange={e => setCultureResult(e.target.value)} placeholder="ex: Urina — E. coli > 100.000 UFC/mL. Sensível a ciprofloxacina, fosfomicina. Resistente a ampicilina."
                    rows={3} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-meta)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Contexto adicional</label>
                  <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="ex: Pós-operatório de cirurgia abdominal, imunodeprimido, neoplasia hematológica..."
                    rows={2} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 10px', fontSize: 'var(--t-meta)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }} />
                </div>
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{error}</div>}

            <button onClick={submit} disabled={loading}
              style={{ width: '100%', padding: '14px', background: loading ? 'var(--ink-5)' : 'var(--ink)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: loading ? 'default' : 'pointer' }}>
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
              <div style={{ background: 'var(--ink)', borderRadius: 'var(--r-xl)', padding: 20, color: 'white' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Orientação de Antibioterapia</div>
                <div style={{ fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, marginBottom: 4 }}>{result.site}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {result.likely_pathogens.map((p, i) => (
                    <span key={i} style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>{p}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyReport}
                    style={{ padding: '8px 14px', background: copied ? 'var(--green)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-md)', color: 'white', fontSize: 'var(--t-meta)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                    {copied ? '✓ Copiado' : '⎘ Copiar relatório'}
                  </button>
                  <button onClick={() => window.print()}
                    style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-md)', color: 'white', fontSize: 'var(--t-meta)', cursor: 'pointer' }}>
                    Imprimir
                  </button>
                </div>
              </div>

              {/* Empirical 1st line */}
              <div style={{ background: 'white', border: '2px solid var(--green-mid)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: '2px 8px', background: 'var(--badge-green-bg)', color: 'var(--green)', borderRadius: 'var(--r)', fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase' }}>1.ª Linha</span>
                  <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Antibioterapia Empírica</span>
                </div>
                <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--green)', marginBottom: 8, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{result.empirical_first_line.regimen}</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', marginBottom: 6, lineHeight: 1.5 }}>{result.empirical_first_line.rationale}</div>
                {result.empirical_first_line.allergies_note && (
                  <div style={{ padding: '8px 10px', background: 'var(--amber-light)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', color: 'var(--badge-amber-fg)', lineHeight: 1.5 }}>
                    <strong>Alergia à penicilina:</strong> {result.empirical_first_line.allergies_note}
                  </div>
                )}
              </div>

              {/* Empirical 2nd line */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: '2px 8px', background: 'var(--bg-3)', color: 'var(--ink-3)', borderRadius: 'var(--r)', fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, textTransform: 'uppercase' }}>2.ª Linha</span>
                  <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>Alternativa</span>
                </div>
                <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{result.empirical_second_line.regimen}</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', lineHeight: 1.5 }}>{result.empirical_second_line.rationale}</div>
              </div>

              {/* MRSA coverage */}
              {result.mrsa_coverage.needed && (
                <div style={{ background: 'var(--amber-light)', border: '2px solid var(--badge-amber-border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--amber)', marginBottom: 8 }}>⚠ Cobertura MRSA recomendada</div>
                  <div style={{ fontSize: 'var(--t-dado)', fontFamily: 'var(--font-mono)', color: 'var(--badge-red-fg)', fontWeight: 'var(--peso-forte)' as any, marginBottom: 6 }}>
                    Adicionar: {result.mrsa_coverage.add_on} {result.mrsa_coverage.dose}
                  </div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)' }}>
                    Fatores de risco: {result.mrsa_coverage.risk_factors.join(' · ')}
                  </div>
                </div>
              )}

              {/* ESBL coverage */}
              {result.esbl_pseudomonas_coverage.needed && (
                <div style={{ background: 'var(--roxo-claro)', border: '2px solid var(--roxo-meio)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--roxo)', marginBottom: 8 }}>⚠ Cobertura ESBL/Pseudomonas recomendada</div>
                  <div style={{ fontSize: 'var(--t-dado)', fontFamily: 'var(--font-mono)', color: 'var(--roxo-escuro)', fontWeight: 'var(--peso-forte)' as any, marginBottom: 6 }}>{result.esbl_pseudomonas_coverage.regimen}</div>
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--roxo)' }}>
                    Fatores de risco: {result.esbl_pseudomonas_coverage.risk_factors.join(' · ')}
                  </div>
                </div>
              )}

              {/* IV to Oral */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 10 }}>Step-down IV → Oral</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Critérios de elegibilidade</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {result.iv_to_oral.eligible_criteria.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--t-meta)', color: 'var(--ink-2)', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--badge-green-bg)', borderRadius: 'var(--r)', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 'var(--peso-corpo)' as any }}>
                  Oral: {result.iv_to_oral.oral_regimen}
                </div>
              </div>

              {/* Duration */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 12 }}>Duração de tratamento</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Standard</div>
                    <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{result.duration.standard}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'var(--amber-light)', borderRadius: 'var(--r-md)', border: '1px solid var(--badge-amber-border)' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Prolongar se</div>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--badge-red-fg)', lineHeight: 1.4 }}>{result.duration.extended}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Critérios para parar</div>
                  {result.duration.stop_criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--t-meta)', color: 'var(--ink-2)', alignItems: 'flex-start', marginBottom: 3 }}>
                      <span style={{ color: 'var(--red)', flexShrink: 0 }}>◼</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Renal adjustment */}
              {result.renal_adjustment.length > 0 && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                  <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 10 }}>Ajuste de dose renal</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.renal_adjustment.map((r, i) => (
                      <div key={i} style={{ padding: '8px 10px', background: 'var(--green-light)', borderRadius: 'var(--r)', border: '1px solid var(--green-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                          <span style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-mono)', color: 'var(--green-3)' }}>{r.drug}</span>
                          <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--roxo)', padding: '2px 6px', background: 'var(--roxo-claro)', borderRadius: 'var(--r)' }}>TFG {'<'} {r.gfr_below} mL/min</span>
                        </div>
                        <div style={{ fontSize: 'var(--t-meta)', color: 'var(--green-3)', marginTop: 4, lineHeight: 1.4 }}>{r.adjustment}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monitoring */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 10 }}>Monitorização</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.monitoring.map((m, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', fontSize: 'var(--t-meta)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{m}</span>
                  ))}
                </div>
              </div>

              {/* De-escalation + stewardship */}
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 18 }}>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>De-escalonamento após culturas</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>{result.de_escalation}</div>
                <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Stewardship</div>
                <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.stewardship_notes}</div>
              </div>

              {/* Disclaimer */}
              <div style={{ padding: '12px 16px', background: 'var(--amber-light)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', color: 'var(--badge-amber-fg)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                ⚠ Orientação de suporte à decisão clínica. Sempre adaptar ao antibiograma local, ao perfil do doente e às guidelines institucionais. Não substitui avaliação médica ou farmacêutica presencial. Revisão 48-72h mandatória.
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Mesa>
  )
}
