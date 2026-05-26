'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

type ScaleType = 'barthel' | 'braden' | 'morse' | 'mmse' | 'mna'

interface Patient { id: string; name: string; age?: number; room?: string }
interface AssessmentRecord {
  id: string; patient_id: string; patient_name?: string
  scale: ScaleType; date: string; score: number; answers: Record<string, number>
  notes?: string; evaluated_by?: string; created_at: string
}

// ── Barthel Index ──────────────────────────────────────────────────────────────
const BARTHEL_ITEMS = [
  { id: 'feeding',   label: 'Alimentação',              max: 10, options: [{ v: 0, l: 'Dependente' }, { v: 5, l: 'Necessita ajuda (cortar, etc.)' }, { v: 10, l: 'Independente' }] },
  { id: 'bathing',   label: 'Banho',                    max: 5,  options: [{ v: 0, l: 'Dependente' }, { v: 5, l: 'Independente' }] },
  { id: 'grooming',  label: 'Higiene pessoal',          max: 5,  options: [{ v: 0, l: 'Necessita ajuda' }, { v: 5, l: 'Independente (face, cabelo, dentes, barba)' }] },
  { id: 'dressing',  label: 'Vestir',                   max: 10, options: [{ v: 0, l: 'Dependente' }, { v: 5, l: 'Necessita ajuda (≥50% feito pelo próprio)' }, { v: 10, l: 'Independente' }] },
  { id: 'bowels',    label: 'Intestinos',               max: 10, options: [{ v: 0, l: 'Incontinente ou necessita de enema' }, { v: 5, l: 'Acidente ocasional (<1×/semana)' }, { v: 10, l: 'Continente' }] },
  { id: 'bladder',   label: 'Bexiga',                   max: 10, options: [{ v: 0, l: 'Incontinente ou algaliado' }, { v: 5, l: 'Acidente ocasional (<1×/dia)' }, { v: 10, l: 'Continente (>7 dias)' }] },
  { id: 'toilet',    label: 'Uso da sanita',            max: 10, options: [{ v: 0, l: 'Dependente' }, { v: 5, l: 'Ajuda parcial' }, { v: 10, l: 'Independente' }] },
  { id: 'transfer',  label: 'Transferência (cama-cad.)',max: 15, options: [{ v: 0, l: 'Impossível — sem equilíbrio sentado' }, { v: 5, l: 'Grande ajuda (1-2 pessoas)' }, { v: 10, l: 'Pequena ajuda (física ou verbal)' }, { v: 15, l: 'Independente' }] },
  { id: 'mobility',  label: 'Deambulação',              max: 15, options: [{ v: 0, l: 'Imóvel' }, { v: 5, l: 'Cadeira de rodas — independente' }, { v: 10, l: 'Anda com ajuda de 1 pessoa' }, { v: 15, l: 'Independente (pode usar bengala)' }] },
  { id: 'stairs',    label: 'Subir escadas',            max: 10, options: [{ v: 0, l: 'Dependente' }, { v: 5, l: 'Necessita ajuda (verbal, física, ajuda técnica)' }, { v: 10, l: 'Independente (com ou sem ajuda técnica)' }] },
]
function barthelLevel(score: number) {
  if (score <= 20) return { label: 'Dependência Total',   color: '#dc2626', bg: '#fee2e2' }
  if (score <= 60) return { label: 'Dependência Grave',   color: '#d97706', bg: '#fef3c7' }
  if (score <= 90) return { label: 'Dependência Moderada',color: '#ca8a04', bg: '#fefce8' }
  if (score <= 99) return { label: 'Dependência Ligeira', color: '#0284c7', bg: '#e0f2fe' }
  return                   { label: 'Independente',        color: '#16a34a', bg: '#dcfce7' }
}

// ── Braden Scale ───────────────────────────────────────────────────────────────
const BRADEN_ITEMS = [
  { id: 'sensory',   label: 'Perceção sensorial', options: [
    { v: 1, l: 'Completamente limitada — sem resposta a estímulos dolorosos' },
    { v: 2, l: 'Muito limitada — responde apenas a estímulos dolorosos' },
    { v: 3, l: 'Ligeiramente limitada — responde a instruções verbais' },
    { v: 4, l: 'Sem limitação' },
  ]},
  { id: 'moisture',  label: 'Humidade da pele', options: [
    { v: 1, l: 'Constantemente húmida — pele sempre molhada' },
    { v: 2, l: 'Muito húmida — troca de roupa muito frequente' },
    { v: 3, l: 'Ocasionalmente húmida — troca 1×/dia' },
    { v: 4, l: 'Raramente húmida' },
  ]},
  { id: 'activity',  label: 'Actividade', options: [
    { v: 1, l: 'Acamado — confinado à cama' },
    { v: 2, l: 'Sentado — capacidade de marcha muito limitada' },
    { v: 3, l: 'Anda ocasionalmente — curtas distâncias com ajuda' },
    { v: 4, l: 'Anda frequentemente — fora do quarto pelo menos 2× ao dia' },
  ]},
  { id: 'mobility',  label: 'Mobilidade', options: [
    { v: 1, l: 'Completamente imóvel — não faz nenhum movimento' },
    { v: 2, l: 'Muito limitada — move ligeiramente corpo/extremidades' },
    { v: 3, l: 'Ligeiramente limitada — faz mudanças frequentes mas ligeiras' },
    { v: 4, l: 'Sem limitação' },
  ]},
  { id: 'nutrition', label: 'Nutrição', options: [
    { v: 1, l: 'Muito pobre — nunca come refeição completa; ≤2 porções proteicas' },
    { v: 2, l: 'Provavelmente inadequada — raramente come ½ refeição' },
    { v: 3, l: 'Adequada — come >½ das refeições; 4 porções proteicas' },
    { v: 4, l: 'Excelente — come a maior parte das refeições; ≥4 porções proteicas' },
  ]},
  { id: 'friction',  label: 'Fricção e forças de deslizamento', options: [
    { v: 1, l: 'Problema — requer ajuda máxima; desliza sobre o lençol' },
    { v: 2, l: 'Problema potencial — move-se com alguma dificuldade' },
    { v: 3, l: 'Sem problema — move-se de forma independente' },
  ]},
]
function bradenLevel(score: number) {
  if (score <= 9)  return { label: 'Risco Muito Alto',color: '#7f1d1d', bg: '#fee2e2' }
  if (score <= 12) return { label: 'Risco Alto',      color: '#dc2626', bg: '#fee2e2' }
  if (score <= 14) return { label: 'Risco Moderado',  color: '#d97706', bg: '#fef3c7' }
  if (score <= 18) return { label: 'Risco Ligeiro',   color: '#ca8a04', bg: '#fefce8' }
  return                   { label: 'Sem Risco',       color: '#16a34a', bg: '#dcfce7' }
}

// ── Morse Falls Scale ──────────────────────────────────────────────────────────
const MORSE_ITEMS = [
  { id: 'history',   label: 'Historial de quedas (últimos 3 meses)', options: [{ v: 0, l: 'Não' }, { v: 25, l: 'Sim' }] },
  { id: 'diagnosis', label: 'Diagnóstico secundário', options: [{ v: 0, l: 'Não' }, { v: 15, l: 'Sim' }] },
  { id: 'aid',       label: 'Ajuda na deambulação', options: [
    { v: 0,  l: 'Nenhuma / repouso no leito / cadeira de rodas / enfermeiro' },
    { v: 15, l: 'Bengala / andarilho / canadiana' },
    { v: 30, l: 'Apoia-se no mobiliário' },
  ]},
  { id: 'iv',        label: 'Terapia intravenosa / heparina', options: [{ v: 0, l: 'Não' }, { v: 20, l: 'Sim' }] },
  { id: 'gait',      label: 'Marcha', options: [
    { v: 0,  l: 'Normal / repouso no leito / imóvel' },
    { v: 10, l: 'Fraca' },
    { v: 20, l: 'Deficiente / desequilíbrio' },
  ]},
  { id: 'mental',    label: 'Estado mental', options: [
    { v: 0,  l: 'Consciente das suas capacidades' },
    { v: 15, l: 'Sobrestima capacidades / esquece limitações' },
  ]},
]
function morseLevel(score: number) {
  if (score <= 24) return { label: 'Baixo Risco',  color: '#16a34a', bg: '#dcfce7' }
  if (score <= 50) return { label: 'Risco Moderado',color: '#d97706', bg: '#fef3c7' }
  return                   { label: 'Risco Elevado', color: '#dc2626', bg: '#fee2e2' }
}

// ── MMSE ───────────────────────────────────────────────────────────────────────
const MMSE_ITEMS = [
  { id: 'time_orient',  label: 'Orientação temporal',          max: 5,  desc: 'Ano, estação, mês, data, dia da semana' },
  { id: 'place_orient', label: 'Orientação espacial',          max: 5,  desc: 'País, distrito/cidade, localidade, local, andar' },
  { id: 'retention',    label: 'Retenção (memória imediata)',  max: 3,  desc: 'Repetição de 3 palavras (Pera, Gato, Bola)' },
  { id: 'attention',    label: 'Atenção e cálculo',            max: 5,  desc: 'Subtrair 7 a partir de 100 (5 vezes) — ou soletrar MUNDO ao contrário' },
  { id: 'recall',       label: 'Evocação',                    max: 3,  desc: 'Repetir as 3 palavras anteriores' },
  { id: 'language',     label: 'Linguagem (nomeação)',        max: 2,  desc: 'Nomear relógio e lápis' },
  { id: 'repetition',   label: 'Linguagem (repetição)',       max: 1,  desc: 'Repetir "O rato roeu a rolha da garrafa do rei"' },
  { id: 'comprehension',label: 'Linguagem (compreensão)',     max: 3,  desc: 'Seguir 3 instruções: "Pegue no papel com a mão direita, dobre ao meio, coloque no chão"' },
  { id: 'reading',      label: 'Leitura',                     max: 1,  desc: 'Ler e executar "Feche os olhos"' },
  { id: 'writing',      label: 'Escrita',                     max: 1,  desc: 'Escrever uma frase (sujeito + verbo)' },
  { id: 'visuospatial', label: 'Capacidade visuo-construtiva',max: 1,  desc: 'Copiar dois pentágonos interligados' },
]
function mmseLevel(score: number) {
  if (score >= 27) return { label: 'Normal',           color: '#16a34a', bg: '#dcfce7' }
  if (score >= 22) return { label: 'Défice Ligeiro',   color: '#ca8a04', bg: '#fefce8' }
  if (score >= 10) return { label: 'Défice Moderado',  color: '#d97706', bg: '#fef3c7' }
  return                   { label: 'Défice Grave',     color: '#dc2626', bg: '#fee2e2' }
}

// ── MNA ────────────────────────────────────────────────────────────────────────
const MNA_SCREENING = [
  { id: 'intake',    label: 'A — Declínio da ingestão alimentar (últimos 3 meses)', options: [
    { v: 0, l: 'Declínio grave' }, { v: 1, l: 'Declínio moderado' }, { v: 2, l: 'Sem declínio' }] },
  { id: 'weight',    label: 'B — Perda de peso (últimos 3 meses)', options: [
    { v: 0, l: 'Perda > 3 kg' }, { v: 1, l: 'Não sabe' }, { v: 2, l: 'Perda 1-3 kg' }, { v: 3, l: 'Sem perda' }] },
  { id: 'mobility',  label: 'C — Mobilidade', options: [
    { v: 0, l: 'Acamado ou cadeira de rodas' }, { v: 1, l: 'Levanta-se mas não sai' }, { v: 2, l: 'Sai à rua' }] },
  { id: 'stress',    label: 'D — Doença aguda ou stress psicológico (últimos 3 meses)', options: [
    { v: 0, l: 'Sim' }, { v: 2, l: 'Não' }] },
  { id: 'neuro',     label: 'E — Problemas neuropsicológicos', options: [
    { v: 0, l: 'Demência ou depressão grave' }, { v: 1, l: 'Demência ligeira' }, { v: 2, l: 'Sem problemas' }] },
  { id: 'bmi',       label: 'F — IMC (kg/m²)', options: [
    { v: 0, l: 'IMC < 19' }, { v: 1, l: 'IMC 19-21' }, { v: 2, l: 'IMC 21-23' }, { v: 3, l: 'IMC ≥ 23' }] },
]
function mnaLevel(score: number) {
  if (score >= 12) return { label: 'Normal', color: '#16a34a', bg: '#dcfce7', sub: 'Estado nutricional normal' }
  if (score >= 8)  return { label: 'Em Risco', color: '#d97706', bg: '#fef3c7', sub: 'Risco de desnutrição' }
  return                   { label: 'Desnutrição', color: '#dc2626', bg: '#fee2e2', sub: 'Desnutrição confirmada' }
}

// ── Scale configs ──────────────────────────────────────────────────────────────
const SCALES: Record<ScaleType, { label: string; max: number; desc: string; color: string }> = {
  barthel:  { label: 'Índice de Barthel',    max: 100, desc: 'Avaliação das actividades de vida diária (AVD)', color: '#1d4ed8' },
  braden:   { label: 'Escala de Braden',     max: 23,  desc: 'Risco de desenvolvimento de úlceras de pressão',  color: '#7c3aed' },
  morse:    { label: 'Escala de Morse',      max: 125, desc: 'Risco de queda',                                   color: '#d97706' },
  mmse:     { label: 'MMSE',                 max: 30,  desc: 'Mini Mental State Examination — avaliação cognitiva', color: '#0891b2' },
  mna:      { label: 'MNA — Triagem',        max: 14,  desc: 'Mini Nutritional Assessment — estado nutricional', color: '#16a34a' },
}

// Direção clínica: para Morse (quedas) maior pontuação = pior; nas restantes maior = melhor.
const BETTER_WHEN_HIGHER: Record<ScaleType, boolean> = { barthel: true, braden: true, morse: false, mmse: true, mna: true }

// Tendência entre pontuação atual e a anterior, interpretada clinicamente.
function trendInfo(scale: ScaleType, current: number, prev: number | null) {
  if (prev == null) return null
  const delta = current - prev
  if (delta === 0) return { arrow: '→', label: 'sem alteração', color: '#64748b', delta }
  const improved = BETTER_WHEN_HIGHER[scale] ? delta > 0 : delta < 0
  return {
    arrow: delta > 0 ? '▲' : '▼',
    label: `${improved ? 'melhorou' : 'agravou'} ${Math.abs(delta)} pts`,
    color: improved ? '#16a34a' : '#dc2626',
    delta,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AssessmentsPage() {
  const { user, supabase } = useAuth()
  const [tab, setTab] = useState<ScaleType>('barthel')
  const [patients, setPatients] = useState<Patient[]>([])
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [evaluatedBy, setEvaluatedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})

  async function load() {
    if (!user) return
    setLoading(true)
    const [p, r] = await Promise.all([
      supabase.from('patients').select('id, name, age').eq('user_id', user.id).order('name'),
      supabase.from('assessments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ])
    if (p.data) setPatients(p.data)
    if (r.data) setRecords(r.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [user])

  // Reset scores when tab changes
  useEffect(() => { setScores({}) }, [tab])

  const totalScore = useMemo(() => {
    const items = tab === 'barthel' ? BARTHEL_ITEMS : tab === 'braden' ? BRADEN_ITEMS : tab === 'morse' ? MORSE_ITEMS : tab === 'mmse' ? MMSE_ITEMS : MNA_SCREENING
    return items.reduce((sum, item) => {
      const key = item.id
      return sum + (scores[key] ?? (tab === 'mmse' ? 0 : (item as any).options?.[0]?.v ?? 0))
    }, 0)
  }, [scores, tab])

  const scale = SCALES[tab]

  function getLevel() {
    if (tab === 'barthel') return barthelLevel(totalScore)
    if (tab === 'braden')  return bradenLevel(totalScore)
    if (tab === 'morse')   return morseLevel(totalScore)
    if (tab === 'mmse')    return mmseLevel(totalScore)
    return mnaLevel(totalScore)
  }

  async function save() {
    if (!user || !patientId) return
    setSaving(true)
    const pat = patients.find(p => p.id === patientId)
    const payload = {
      user_id: user.id,
      patient_id: patientId,
      scale: tab,
      date,
      score: totalScore,
      answers: scores,
      notes: notes || null,
      evaluated_by: evaluatedBy || null,
    }
    await supabase.from('assessments').insert(payload)
    setSaving(false)
    setScores({})
    setNotes('')
    load()
  }

  function printHistory() {
    const recs = [...patientRecords].sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at))
    if (!recs.length) return
    const pat = patients.find(p => p.id === patientId)
    const levelOf = (s: number) => (tab === 'barthel' ? barthelLevel(s) : tab === 'braden' ? bradenLevel(s) : tab === 'morse' ? morseLevel(s) : tab === 'mmse' ? mmseLevel(s) : mnaLevel(s)).label
    printDoc({
      docTitle: `${SCALES[tab].label} — ${pat?.name || 'Residente'}`,
      docSubtitle: SCALES[tab].desc,
      author: evaluatedBy || undefined,
      meta: [
        { label: 'avaliações', value: String(recs.length) },
        { label: 'última', value: recs[0].date },
        { label: 'resultado', value: `${recs[0].score}/${SCALES[tab].max} · ${levelOf(recs[0].score)}` },
      ],
      sections: [{
        heading: 'Histórico de avaliações',
        records: recs.map(r => {
          const t = trendInfo(tab, r.score, prevScoreOf(r))
          return {
            title: `${r.date} — ${r.score}/${SCALES[tab].max} pts`,
            tags: [{ label: levelOf(r.score), color: '#334155' }],
            fields: [
              { label: 'Avaliado por', value: r.evaluated_by || '—' },
              ...(t ? [{ label: 'Tendência', value: `${t.arrow} ${t.label}` }] : []),
            ],
            body: r.notes || undefined,
          }
        }),
      }],
      footerNote: `Avaliações clínicas · ${SCALES[tab].label} · Phlox`,
    })
  }

  const patientRecords = records.filter(r => r.patient_id === patientId && r.scale === tab)
  const allTabRecords = records.filter(r => r.scale === tab)

  // Tendência: pontuação atual (em edição) vs. última registada para este residente+escala
  const lastRecord = patientId ? [...patientRecords].sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at))[0] : null
  const liveTrend = patientId && lastRecord ? trendInfo(tab, totalScore, lastRecord.score) : null
  // Histórico ordenado por data asc → para calcular tendência de cada registo vs o anterior
  const sortedAsc = [...(patientId ? patientRecords : allTabRecords)].sort((a, b) => (a.date + a.created_at).localeCompare(b.date + b.created_at))
  const prevScoreOf = (rec: AssessmentRecord): number | null => {
    if (!patientId) return null
    const samePt = sortedAsc.filter(x => x.patient_id === rec.patient_id)
    const idx = samePt.findIndex(x => x.id === rec.id)
    return idx > 0 ? samePt[idx - 1].score : null
  }

  const inputStyle: React.CSSProperties = { padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }

  const level = getLevel()

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)' }}>

      {/* Page header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '20px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Link href="/cockpit" style={{ color: '#475569', textDecoration: 'none' }}>Cockpit</Link>
            <span>›</span><span style={{ color: '#94a3b8' }}>Avaliações</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Avaliações Clínicas</h1>
              <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 13 }}>Escalas validadas · Barthel · Braden · Morse · MMSE · MNA</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Avaliações hoje', value: records.filter(r => r.date === new Date().toISOString().slice(0,10)).length },
                { label: 'Total registadas', value: records.length },
                { label: 'Residentes', value: new Set(records.map(r => r.patient_id)).size },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scale tabs */}
          <div style={{ display: 'flex', gap: 2, marginTop: 18, borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' }}>
            {(Object.keys(SCALES) as ScaleType[]).map(k => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
                background: tab === k ? '#fff' : 'transparent',
                color: tab === k ? '#1d4ed8' : '#64748b',
                fontWeight: tab === k ? 700 : 400, fontSize: 13,
                whiteSpace: 'nowrap', minHeight: 38, fontFamily: 'inherit',
              }}>
                {SCALES[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>A carregar…</div>
        ) : (
          <div className="assess-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

            {/* LEFT: Assessment form */}
            <div>
              {/* Scale info */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{scale.label}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{scale.desc} · Máx. {scale.max} pontos</div>
                  </div>
                  {/* Live score display */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: level.color, lineHeight: 1 }}>{totalScore}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: level.color, background: level.bg, padding: '3px 10px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                      {level.label}
                    </div>
                    {liveTrend && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: liveTrend.color, marginTop: 5 }}>
                        {liveTrend.arrow} {liveTrend.label} <span style={{ color: '#94a3b8', fontWeight: 500 }}>vs. {lastRecord!.date}</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: 12, background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (totalScore / scale.max) * 100)}%`, background: level.color, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Patient + date controls */}
              <div className="assess-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Residente</label>
                  <select style={inputStyle} value={patientId} onChange={e => setPatientId(e.target.value)}>
                    <option value="">Seleccionar residente…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Avaliado por</label>
                  <input style={inputStyle} value={evaluatedBy} onChange={e => setEvaluatedBy(e.target.value)} placeholder="Nome do avaliador" />
                </div>
              </div>

              {/* Scale items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(tab === 'barthel' ? BARTHEL_ITEMS : tab === 'braden' ? BRADEN_ITEMS : tab === 'morse' ? MORSE_ITEMS : tab === 'mmse' ? MMSE_ITEMS : MNA_SCREENING).map((item, idx) => {
                  const isMMSE = tab === 'mmse'
                  const current = scores[item.id]
                  const iItem = item as any
                  return (
                    <div key={item.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', transition: 'border-color 0.1s', borderLeft: current !== undefined ? `3px solid ${scale.color}` : '3px solid transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0, marginTop: 1 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: isMMSE ? 4 : 8 }}>{item.label}</div>
                          {isMMSE && iItem.desc && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>{iItem.desc}</div>}

                          {isMMSE ? (
                            // MMSE: numeric input 0–max
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="number" min={0} max={iItem.max} value={current ?? ''}
                                onChange={e => setScores(s => ({ ...s, [item.id]: Math.min(iItem.max, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                style={{ width: 80, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                                placeholder="0"
                              />
                              <span style={{ fontSize: 13, color: '#64748b' }}>de {iItem.max} pontos</span>
                            </div>
                          ) : (
                            // Other scales: radio buttons
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {iItem.options.map((opt: { v: number; l: string }) => {
                                const selected = current === opt.v
                                return (
                                  <label key={opt.v} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 7, background: selected ? `${scale.color}12` : '#f8fafc', border: `1px solid ${selected ? scale.color + '40' : '#f1f5f9'}`, transition: 'all 0.1s' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? scale.color : '#d1d5db'}`, background: selected ? scale.color : '#fff', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                    </div>
                                    <input type="radio" name={`${tab}-${item.id}`} value={opt.v} checked={selected}
                                      onChange={() => setScores(s => ({ ...s, [item.id]: opt.v }))}
                                      style={{ display: 'none' }} />
                                    <span style={{ fontSize: 13, color: selected ? '#0f172a' : '#374151', fontWeight: selected ? 600 : 400, lineHeight: 1.4 }}>
                                      <span style={{ fontWeight: 700, color: scale.color, marginRight: 4 }}>{opt.v} pts —</span>
                                      {opt.l}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Notes + Save */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' } as React.CSSProperties} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas clínicas sobre esta avaliação…" />
                </div>
                <button
                  onClick={save}
                  disabled={saving || !patientId}
                  style={{ padding: '13px 24px', background: saving ? '#94a3b8' : (!patientId ? '#e2e8f0' : '#1d4ed8'), color: (!patientId || saving) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, cursor: (!patientId || saving) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? 'A guardar…' : `Guardar avaliação — ${scale.label} · ${totalScore} pts`}
                </button>
              </div>
            </div>

            {/* RIGHT: History */}
            <div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', position: 'sticky', top: 76 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Histórico</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {patientId && patientRecords.length > 0 && (
                      <button onClick={printHistory} style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>Imprimir</button>
                    )}
                    <div style={{ fontSize: 12, color: '#64748b' }}>{patientId ? patientRecords.length : allTabRecords.length} aval.</div>
                  </div>
                </div>
                <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                  {(patientId ? patientRecords : allTabRecords).length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 13 }}>Sem avaliações{patientId ? ' para este residente' : ''}.</div>
                    </div>
                  ) : (patientId ? patientRecords : allTabRecords).map(r => {
                    const lvl = tab === 'barthel' ? barthelLevel(r.score) : tab === 'braden' ? bradenLevel(r.score) : tab === 'morse' ? morseLevel(r.score) : tab === 'mmse' ? mmseLevel(r.score) : mnaLevel(r.score)
                    const rTrend = trendInfo(tab, r.score, prevScoreOf(r))
                    return (
                      <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                            {r.score} pts
                            {rTrend && <span style={{ fontSize: 11, fontWeight: 700, color: rTrend.color }}>{rTrend.arrow} {rTrend.delta > 0 ? '+' : ''}{rTrend.delta}</span>}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: lvl.color, background: lvl.bg, padding: '1px 8px', borderRadius: 10 }}>{lvl.label}</div>
                        </div>
                        {!patientId && r.patient_name && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{r.patient_name}</div>}
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.date} {r.evaluated_by ? `· ${r.evaluated_by}` : ''}</div>
                        {r.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{r.notes}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <style>{`
        @media(max-width:768px){
          .assess-layout{grid-template-columns:1fr!important}
          .assess-controls{grid-template-columns:1fr!important}
        }
        input[type=number]:focus,input[type=date]:focus,input[type=text]:focus,textarea:focus,select:focus{
          border-color:#1d4ed8!important;outline:none;box-shadow:0 0 0 3px #1d4ed818
        }
      `}</style>
    </div>
  )
}
