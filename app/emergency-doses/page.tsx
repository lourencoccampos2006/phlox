'use client'

import { useState, useRef } from 'react'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// ─── Drug database ─────────────────────────────────────────────────────────────
interface Drug {
  name: string
  dose?: string // e.g. "0.1 mg/kg" or "1 mg fixed"
  doseMin?: number; doseMax?: number // mg/kg range
  doseFixed?: number // fixed dose mg
  unit: string // "mg" | "mcg" | "mL" | "mmol"
  concentration?: string // "1mg/mL", "10mg/mL", etc.
  route: string
  note?: string
  warning?: string
  maxDose?: number // max mg
  category: string
  color: string
  perKg: boolean // true = weight-based
}

const DRUGS: Drug[] = [
  // ─── CARDIAC ARREST ──────────────────────────────────────────────────────────
  { category: 'Paragem Cardiorrespiratória', color: 'var(--red)', perKg: false,
    name: 'Adrenalina (Epinefrina)', doseFixed: 1, unit: 'mg',
    concentration: '1mg/10mL (1:10.000)', route: 'IV/IO',
    note: 'Repetir a cada 3-5 min. Primeira dose em PCR: 1mg IV bolus.',
    warning: 'Não misturar com bicarbonato na mesma via.' },
  { category: 'Paragem Cardiorrespiratória', color: 'var(--red)', perKg: false,
    name: 'Amiodarona (FV/TV sem pulso)', doseFixed: 300, unit: 'mg',
    concentration: '50mg/mL — diluir em 20mL SG5%', route: 'IV bolus',
    note: '1ª dose: 300mg. 2ª dose (se necessário): 150mg.',
    warning: 'Pode causar hipotensão e bradicardia.' },
  { category: 'Paragem Cardiorrespiratória', color: 'var(--red)', perKg: true,
    name: 'Bicarbonato 8.4%', doseMin: 1, doseMax: 1, unit: 'mL/kg',
    concentration: '1mEq/mL', route: 'IV lento',
    note: 'Usar apenas em acidose metabólica grave documentada ou hipercaliemia.' },
  { category: 'Paragem Cardiorrespiratória', color: 'var(--red)', perKg: false,
    name: 'Atropina (assistolia/BAV)', doseFixed: 1, unit: 'mg',
    concentration: '0.5mg/mL ou 1mg/mL', route: 'IV bolus',
    note: 'Dose máxima 3mg. Repetir cada 3-5min. Para assistolia: 1mg.' },

  // ─── ARRITMIAS ────────────────────────────────────────────────────────────────
  { category: 'Arritmias', color: 'var(--roxo)', perKg: false,
    name: 'Adenosina (TSVP)', doseFixed: 6, unit: 'mg',
    concentration: '3mg/mL', route: 'IV rápido (bolus + flush)',
    note: '1ª dose: 6mg. Se ineficaz após 1-2 min: 12mg. Pode repetir 12mg.',
    warning: 'Injetar na antecubital. Flush imediato com 20mL SF.' },
  { category: 'Arritmias', color: 'var(--roxo)', perKg: true,
    name: 'Lidocaína IV', doseMin: 1, doseMax: 1.5, maxDose: 100, unit: 'mg',
    concentration: '20mg/mL', route: 'IV bolus lento',
    note: 'Alternativa à amiodarona em FV/TV. Manutenção: 1-4 mg/min.' },
  { category: 'Arritmias', color: 'var(--roxo)', perKg: false,
    name: 'Verapamil IV', doseFixed: 5, unit: 'mg',
    concentration: '2.5mg/mL', route: 'IV lento (2-3 min)',
    note: '5mg. Se ineficaz após 10-15min: 10mg. NUNCA com betabloqueador IV.',
    warning: 'Contraindicado em WPW, disfunção sistólica grave, betabloqueador IV.' },
  { category: 'Arritmias', color: 'var(--roxo)', perKg: false,
    name: 'Metoprolol IV', doseFixed: 5, unit: 'mg',
    concentration: '1mg/mL', route: 'IV lento (1-2 min)',
    note: '5mg. Pode repetir x3 com intervalo de 5 min. Max: 15mg.' },
  { category: 'Arritmias', color: 'var(--roxo)', perKg: false,
    name: 'MgSO4 (Torsades)', doseFixed: 2000, unit: 'mg',
    concentration: '500mg/mL — diluir 2g em 100mL SG5%', route: 'IV 15 min',
    note: '2g IV em 15min. Repetir se necessário. Também para eclâmpsia e status asthmaticus.' },

  // ─── RSI ─────────────────────────────────────────────────────────────────────
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Ketamina (indutor RSI)', doseMin: 1.5, doseMax: 2, maxDose: 200, unit: 'mg',
    concentration: '50mg/mL ou 10mg/mL', route: 'IV bolus',
    note: 'Indicado em broncoespasmo, choque, trauma. Efeito em 45-60s. Duração: 10-15min.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Etomidato (indutor RSI)', doseMin: 0.3, doseMax: 0.3, maxDose: 40, unit: 'mg',
    concentration: '2mg/mL', route: 'IV bolus',
    note: 'Indicado em doente hemodinamicamente instável. Efeito em 30-60s. Duração: 3-5min.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Propofol (indutor RSI)', doseMin: 1.5, doseMax: 2, maxDose: 200, unit: 'mg',
    concentration: '10mg/mL', route: 'IV bolus lento',
    note: 'Evitar em hipotensão. Reduzir dose em idosos (0.5-1mg/kg).',
    warning: 'Hipotensão frequente. Ter preparado vasopressor.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Rocurônio (bloqueador NM)', doseMin: 0.9, doseMax: 1.2, maxDose: 200, unit: 'mg',
    concentration: '10mg/mL', route: 'IV rápido',
    note: 'RSI standard: 1.2mg/kg. Revertível com sugamadex (16mg/kg).' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Succinilcolina (bloqueador NM)', doseMin: 1, doseMax: 1.5, maxDose: 200, unit: 'mg',
    concentration: '50mg/mL', route: 'IV rápido',
    note: 'Início em 45-60s. Duração 8-10min. Contraindicada em hipercaliemia, queimados > 72h, esmagamento.',
    warning: 'Contraindicada em hipercaliemia, pseudocolinesterase déficit, história de HM.' },
  { category: 'Entubação de Sequência Rápida (RSI)', color: 'var(--ink-2)', perKg: true,
    name: 'Sugamadex (reversão rocurônio)', doseMin: 16, doseMax: 16, maxDose: 200, unit: 'mg',
    concentration: '200mg/2mL', route: 'IV bolus',
    note: 'Reversão imediata: 16mg/kg. Reversão moderada: 4mg/kg. Reversão ligeira: 2mg/kg.' },

  // ─── SEDAÇÃO / ANALGESIA ──────────────────────────────────────────────────────
  { category: 'Sedação e Analgesia', color: 'var(--amber)', perKg: true,
    name: 'Midazolam IV', doseMin: 0.05, doseMax: 0.1, maxDose: 10, unit: 'mg',
    concentration: '5mg/mL ou 1mg/mL', route: 'IV lento',
    note: 'Titulação em bolus de 1mg. Reduzir dose em idosos, ICC, doença hepática.' },
  { category: 'Sedação e Analgesia', color: 'var(--amber)', perKg: true,
    name: 'Fentanil IV', doseMin: 1, doseMax: 2, maxDose: 200, unit: 'mcg',
    concentration: '50mcg/mL', route: 'IV lento (1-2 min)',
    note: 'Analgesia em bolus. Para procedimento: 1-2mcg/kg. Titulação: 25-50mcg.' },
  { category: 'Sedação e Analgesia', color: 'var(--amber)', perKg: true,
    name: 'Morfina IV', doseMin: 0.05, doseMax: 0.1, maxDose: 15, unit: 'mg',
    concentration: '10mg/mL — diluir', route: 'IV lento (5 min)',
    note: 'Titulação em bolus de 2-4mg. Monitorizar SpO2 e FR. Ter naloxona disponível.' },
  { category: 'Sedação e Analgesia', color: 'var(--amber)', perKg: true,
    name: 'Ketamina IM (procedimento)', doseMin: 4, doseMax: 6, maxDose: 500, unit: 'mg',
    concentration: '50mg/mL', route: 'IM',
    note: 'Para procedimentos em pediatria e adultos. Ter midazolam disponível para delírio de emergência.' },

  // ─── VASOPRESSORES ────────────────────────────────────────────────────────────
  { category: 'Vasopressores e Inotrópicos', color: 'var(--ink)', perKg: false,
    name: 'Noradrenalina (Norepinefrina)', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '4mg/50mL (80mcg/mL)', route: 'IV via central',
    note: 'Início: 0.01-0.1 mcg/kg/min. Titular para PAM ≥ 65mmHg. Vasopressor 1ª linha em choque sético.' },
  { category: 'Vasopressores e Inotrópicos', color: 'var(--ink)', perKg: false,
    name: 'Dopamina', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '200mg/50mL', route: 'IV via central',
    note: 'Inotrópico: 5-10mcg/kg/min. Vasopressor: 10-20mcg/kg/min. Menor preferência que noradrenalina.' },
  { category: 'Vasopressores e Inotrópicos', color: 'var(--ink)', perKg: false,
    name: 'Dobutamina', doseFixed: 0, unit: 'mcg/kg/min',
    concentration: '250mg/50mL', route: 'IV via central',
    note: 'Inotrópico: 2.5-10mcg/kg/min. Indicado em IC com hipoperfusão e PAM adequada.' },

  // ─── ANTÍDOTOS ────────────────────────────────────────────────────────────────
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: true,
    name: 'Naloxona (reversão opioides)', doseMin: 0.01, doseMax: 0.02, maxDose: 2, unit: 'mg',
    concentration: '0.4mg/mL', route: 'IV/IM/SC/IN',
    note: 'Titulação em doses de 0.1-0.4mg IV cada 2-3min até resposta. Em intoxicação grave: 2mg bolus.',
    warning: 'Precaução em dependentes: pode precipitar abstinência aguda.' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: false,
    name: 'Flumazenil (reversão BZD)', doseFixed: 0.2, unit: 'mg',
    concentration: '0.1mg/mL', route: 'IV lento (30 seg)',
    note: '0.2mg. Se sem resposta após 1min: 0.1mg. Max 1mg total.',
    warning: 'Contraindicado em dependência de BZD (risco de status epilepticus).' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: true,
    name: 'N-Acetilcisteína (paracetamol)', doseMin: 150, doseMax: 150, maxDose: 15000, unit: 'mg',
    concentration: '200mg/mL — diluir em 200mL SG5%', route: 'IV em 60 min',
    note: 'Dose de carga: 150mg/kg em 1h. 2ª fase: 50mg/kg em 4h. 3ª fase: 100mg/kg em 16h.' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: false,
    name: 'Glucagom (hipoglicemia grave)', doseFixed: 1, unit: 'mg',
    concentration: '1mg/mL reconstituído', route: 'IM/SC/IV',
    note: '1mg IM/SC. Alternativa: Dextrose 50% 25g IV. Para bloqueador beta e bloqueador Ca grave: 3-5mg.' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: false,
    name: 'Vitamina K IV (reversão AVK)', doseFixed: 10, unit: 'mg',
    concentration: '10mg/mL', route: 'IV lento (≥ 30 min)',
    note: 'Reversão urgente: 10mg IV + CCP (Octaplex). Reversão não urgente: 1-5mg IV.',
    warning: 'Risco de anafilaxia. Infusão lenta. Ter adrenalina disponível.' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: false,
    name: 'Atropina (organofosforados)', doseFixed: 2, unit: 'mg',
    concentration: '0.5mg/mL ou 1mg/mL', route: 'IV a cada 5-10 min',
    note: 'Dose inicial: 2-4mg IV. Repetir cada 5-10min até secar secreções. Doses de 10-20mg+ em casos graves.' },
  { category: 'Antídotos e Emergências Específicas', color: 'var(--green)', perKg: false,
    name: 'Gluconato de Ca 10% (hipocalcemia / hipercaliemia)', doseFixed: 1000, unit: 'mg',
    concentration: '100mg/mL (10mL/amp)', route: 'IV lento (10-20 min)',
    note: '10-20mL. Para hipercaliemia: 10mL IV em 5min (protege miocárdio). Para hipocalcemia: 10mL em 10min.' },

  // ─── NEUROLÓGICA ──────────────────────────────────────────────────────────────
  { category: 'Emergência Neurológica', color: 'var(--roxo)', perKg: true,
    name: 'Manitol 20% (HIC)', doseMin: 0.5, doseMax: 1, maxDose: 100, unit: 'g/kg',
    concentration: '200mg/mL', route: 'IV em 20-30 min',
    note: 'Calcular volume = (dose em g/kg × peso) / 0.2. Ex: 1g/kg em 80kg = 400mL de 20%.',
    warning: 'Monitorizar osmolalidade (máx 320 mOsm/L) e eletrólitos.' },
  { category: 'Emergência Neurológica', color: 'var(--roxo)', perKg: true,
    name: 'Valproato IV (status epilepticus)', doseMin: 20, doseMax: 40, maxDose: 3000, unit: 'mg',
    concentration: '100mg/mL', route: 'IV em 10 min',
    note: 'Loading: 20-40mg/kg IV em 10min. Manutenção: 1-2mg/kg/h.' },
  { category: 'Emergência Neurológica', color: 'var(--roxo)', perKg: true,
    name: 'Levetiracetam IV (status epilepticus)', doseMin: 30, doseMax: 60, maxDose: 4500, unit: 'mg',
    concentration: '100mg/mL — diluir em 100mL SF', route: 'IV em 15 min',
    note: 'Loading: 30-60mg/kg IV. Máx 4.5g. Perfil de segurança favorável, sem interações relevantes.' },
  { category: 'Emergência Neurológica', color: 'var(--roxo)', perKg: true,
    name: 'Fenitoína IV (status epilepticus)', doseMin: 15, doseMax: 20, maxDose: 1500, unit: 'mg',
    concentration: '50mg/mL — diluir em SF', route: 'IV ≤ 50mg/min',
    note: 'Loading: 15-20mg/kg, máx 50mg/min. Monitorizar ECG. Contraindicado: bradicardia, BAV.',
    warning: 'Hipotensão e arritmias se infusão rápida. Máximo 50mg/min.' },

  // ─── METABÓLICA ───────────────────────────────────────────────────────────────
  { category: 'Emergência Metabólica', color: 'var(--green-3)', perKg: false,
    name: 'Dextrose 50% (hipoglicemia)', doseFixed: 25, unit: 'g',
    concentration: '500mg/mL — 50mL IV', route: 'IV bolus lento',
    note: '25g = 50mL de D50%. Repetir se glicemia < 3.9 mmol/L após 15min. Via central preferível.' },
  { category: 'Emergência Metabólica', color: 'var(--green-3)', perKg: false,
    name: 'Insulina Regular IV (CAD/HHNS)', doseFixed: 0, unit: 'UI/h',
    concentration: '1 UI/mL (100UI em 100mL SF)', route: 'IV perfusão',
    note: 'CAD: 0.1 UI/kg/h. Hipercaliemia: 10 UI regular + 50g dextrose. Monitorizar K+.' },
  { category: 'Emergência Metabólica', color: 'var(--green-3)', perKg: false,
    name: 'MgSO4 (eclâmpsia)', doseFixed: 4000, unit: 'mg',
    concentration: 'Diluir 4g em 100mL SG5%', route: 'IV em 20 min',
    note: '4g loading em 20min, depois 1-2g/h manutenção. Monitorizar reflexo patelar e FR.' },
]

const CATEGORIES = Array.from(new Set(DRUGS.map(d => d.category)))

function calcDose(drug: Drug, weight: number): { value: string; volume: string } {
  if (!drug.perKg) {
    const v = drug.doseFixed!
    return { value: `${v} ${drug.unit}`, volume: '' }
  }
  const lo = drug.doseMin! * weight
  const hi = drug.doseMax! * weight
  const maxed = drug.maxDose ? ` (max ${drug.maxDose}${drug.unit})` : ''
  if (lo === hi) {
    const actual = drug.maxDose ? Math.min(lo, drug.maxDose) : lo
    return { value: `${actual.toFixed(1)} ${drug.unit}${maxed}`, volume: '' }
  }
  const actualLo = drug.maxDose ? Math.min(lo, drug.maxDose) : lo
  const actualHi = drug.maxDose ? Math.min(hi, drug.maxDose) : hi
  return { value: `${actualLo.toFixed(1)} – ${actualHi.toFixed(1)} ${drug.unit}${maxed}`, volume: '' }
}

export default function EmergencyDosesPage() {
  const largo = useLargo()
  const [weight, setWeight] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0])
  const [search, setSearch] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const w = parseFloat(weight)
  const hasWeight = !isNaN(w) && w > 0

  const filtered = DRUGS.filter(d =>
    d.category === activeCategory &&
    (!search || d.name.toLowerCase().includes(search.toLowerCase()))
  )

  /* REFEITA 2026-10-08 — e deixou de ser escura.

     Era um `#0f172a` com verde-néon e cartões de canto redondo: o fundo
     preto com um toque de cor fluorescente, que é o aspecto que um gerador
     de interfaces produz por omissão. Havia um argumento a favor do escuro
     — uma sala de reanimação, de noite — e foi um argumento desses que me
     fez MANTER os alvos grandes do /guardião. Mas aqui não estava escrito
     em lado nenhum, e quem usa esta página vê-a ao lado de sessenta páginas
     claras: trocar de fundo a meio de um turno custa à vista mais do que
     ganha. Se a razão existir, o que se faz é um modo escuro para tudo, não
     uma página preta no meio de sessenta brancas.

     O PESO sobe para a barra: é o número de que todas as doses dependem, e
     estava num canto a desaparecer ao rolar. */
  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any,
          }}>Emergência</span>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            border: `1px solid ${hasWeight ? 'var(--green)' : 'var(--amber)'}`,
            borderRadius: 'var(--r-sm)', padding: '0 10px', minHeight: 'var(--alvo)',
            background: hasWeight ? 'var(--green-light)' : 'var(--amber-light)',
          }}>
            <label htmlFor="doses-peso" style={ROTULO}>Peso</label>
            <input id="doses-peso" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="--" type="number" style={{
                width: 52, background: 'transparent', border: 'none', outline: 'none',
                ...MONO, fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any,
                color: hasWeight ? 'var(--green)' : 'var(--amber)', textAlign: 'center',
              }} />
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>kg</span>
          </span>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Procurar fármaco…" style={{ ...CAIXA, width: largo ? 210 : '100%' }} />

          <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
            {(search ? DRUGS.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : filtered).length} FÁRMACOS
          </span>

          <span style={{ marginLeft: largo ? 'auto' : undefined }}>
            <Botao onClick={() => window.print()}>IMPRIMIR</Botao>
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={{ ...MONO, color: 'var(--red)' }}>Aviso que impede a administração</span>
          <span style={{ ...MONO, color: 'var(--green)' }}>Dose já calculada para este peso</span>
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Apoio à decisão — confirmar sempre dose, indicação e contraindicações. ACLS, ERC 2021, NICE e RCM.
          </span>
        </BarraDeEstado>
      }
    >
        {/* OITO CATEGORIAS, OITO CORES — e nenhuma delas dizia nada.
            «Vasopressores» não é um estado; é um nome, e o nome está escrito
            no separador. A cor fica reservada para o que é mesmo estado: o
            vermelho de um aviso que impede a administração. */}
        {!search && (
          <div style={{ marginBottom: 12 }}>
            <Seletor
              opcoes={CATEGORIES.map(cat => ({ id: cat, rotulo: cat.split('(')[0].trim() }))}
              ativa={activeCategory} aoMudar={setActiveCategory} />
          </div>
        )}

        {/* Not weight warning */}
        {!hasWeight && (
          <Aviso tom="atencao">
            Sem o peso, estas são as doses de referência. Escreva o peso em cima e cada uma passa a
            vir já calculada para esta pessoa.
          </Aviso>
        )}

        {/* Drug cards */}
        <div ref={printRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(search ? DRUGS.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : filtered).map((drug, i) => {
            const calc = hasWeight ? calcDose(drug, w) : null
            return (
              /* Era um cartão escuro com um filete da cor da categoria. O
                 filete fica — mas diz outra coisa: vermelho quando o fármaco
                 tem um aviso que impede a administração, neutro quando não. */
              <div key={i} style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${drug.warning ? 'var(--red)' : 'var(--border-2)'}`,
                borderRadius: 'var(--r-sm)', padding: '9px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 3 }}>{drug.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--r-sm)' }}>{drug.route}</span>
                      {drug.concentration && <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>{drug.concentration}</span>}
                    </div>
                    {drug.note && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', lineHeight: 1.5 }}>{drug.note}</div>}
                    {drug.warning && (
                      <div style={{ marginTop: 6, fontSize: 'var(--t-meta)', color: 'var(--red)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0 }}>⚠</span>{drug.warning}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {calc ? (
                      <div>
                        <div style={{ fontSize: drug.perKg ? 20 : 22, fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{calc.value}</div>
                        {drug.perKg && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>para {w}kg</div>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>
                        {drug.perKg ? `${drug.doseMin}–${drug.doseMax} ${drug.unit}/kg` : `${drug.doseFixed} ${drug.unit}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* O aviso legal desceu para a barra de estado: estava aqui em
            baixo, a 10px, onde só o lê quem já rolou a página toda. */}

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </Mesa>
  )
}
