'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useToast } from '@/components/Toast'
import { reportError } from '@/lib/clientError'
import { printDoc } from '@/lib/print'
import FusionTabs from '@/components/FusionTabs'
import { CarePlansTool } from '../care-plans/page'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { type ScaleType, SCALES, BETTER_WHEN_HIGHER, barthelLevel, bradenLevel, morseLevel, mmseLevel, mnaLevel, trendInfo } from '@/lib/assessmentScales'

// /assessments = "Avaliações e planos": escalas (Barthel, MNA…) + planos de
// cuidados. BUG CORRIGIDO 2026-08-07: "Revisão de medicação", "Decision
// Engine" e "Polimedicação" foram ELIMINADAS destas abas (eram peso morto
// aqui — pertencem ao lado clínico/Pro individual, não ao dia-a-dia de um lar/
// centro de dia; continuam a existir como ferramentas próprias fora daqui,
// ex. /med-review via ⌘K). Também: exclusivo de lares — um centro de dia só
// vê "Escalas" (não tem planos de cuidados formais no mesmo sentido).
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Cabecalho, Codigo,
  Botao, Seletor, Vazio, ACarregar, Campo, CAIXA, CAIXA_TEXTO,
  MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

export default function AssessmentsPage() {
  const { institution } = useClinicPrefs()
  const isDayCare = institution === 'day_care'
  return <FusionTabs
    eyebrow="Avaliações" title="Avaliações e planos de cuidados"
    subtitle={isDayCare ? 'Escalas validadas.' : 'Escalas validadas e planos de cuidados.'}
    tabs={isDayCare ? [
      { id: 'escalas', label: 'Escalas', icon: 'scale', render: () => <AssessmentsTool /> },
    ] : [
      { id: 'escalas', label: 'Escalas', icon: 'scale', render: () => <AssessmentsTool /> },
      { id: 'planos', label: 'Planos de cuidados', icon: 'clipboard', render: () => <CarePlansTool /> },
    ]} />
}

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
// ── Component ─────────────────────────────────────────────────────────────────
function AssessmentsTool() {
  const { user, supabase } = useAuth()
  const scope = useOrgScope()
  // O que se pode fazer NESTA área. Era `scope.canEdit`, um binário:
  // ou se editava tudo na casa, ou nada. Ver lib/permissoes.
  const podeEditar = scope.pode('avaliacoes', 'editar')
  const toast = useToast()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const person = cfg.personNoun
  const personLower = person.toLowerCase()
  const largo = useLargo()
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
      scope.filter(supabase.from('patients').select('id, name, age')).order('name'),
      scope.filter(supabase.from('assessments').select('*')).order('created_at', { ascending: false }).limit(100),
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
    if (!podeEditar) { toast.error('Só leitura', 'A sua conta não pode registar avaliações.'); return }
    setSaving(true)
    const payload = scope.stamp({
      patient_id: patientId,
      scale: tab,
      date,
      score: totalScore,
      answers: scores,
      notes: notes || null,
      evaluated_by: evaluatedBy || null,
    })
    try {
      const { error } = await supabase.from('assessments').insert(payload)
      if (error) { toast.error('Não foi possível guardar a avaliação', reportError('assessments-save', error, 'Tenta de novo.')); return }
      setScores({})
      setNotes('')
      load()
    } catch (e) {
      toast.error('Não foi possível guardar a avaliação', reportError('assessments-save', e, 'Verifica a ligação e tenta de novo.'))
    } finally {
      setSaving(false)
    }
  }

  function printHistory() {
    const recs = [...patientRecords].sort((a, b) => (b.date + b.created_at).localeCompare(a.date + a.created_at))
    if (!recs.length) return
    const pat = patients.find(p => p.id === patientId)
    const levelOf = (s: number) => (tab === 'barthel' ? barthelLevel(s) : tab === 'braden' ? bradenLevel(s) : tab === 'morse' ? morseLevel(s) : tab === 'mmse' ? mmseLevel(s) : mnaLevel(s)).label
    printDoc({
      docTitle: `${SCALES[tab].label} — ${pat?.name || person}`,
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
            tags: [{ label: levelOf(r.score), color: 'var(--ink-3)' }],
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


  const level = getLevel()

  /* ══════════════════════════════════════════════════════════════════════════
     O ECRÃ — refeito de raiz na linguagem da mesa (2026-10-07)
     ══════════════════════════════════════════════════════════════════════════
     Tinha um cabeçalho PRETO de 160px — uma faixa `background: var(--ink)`
     com migalha de pão, título, subtítulo, três indicadores em caixas
     translúcidas e os separadores das escalas. Um bloco preto que não existe
     em mais lado nenhum da aplicação, e 160px antes do primeiro item.

     E cada item da escala era um cartão com um círculo numerado de 24px e as
     opções em caixas com fundo de cor. O Barthel tem dez itens com quatro
     opções cada: quarenta caixas e dez cartões, uns dois mil pixéis de rolar
     para preencher uma escala.

     Passa a duas colunas: a escala à esquerda, o histórico da pessoa à
     direita — que é a comparação que dá sentido ao número de hoje.
     ══════════════════════════════════════════════════════════════════════════ */
  const items = tab === 'barthel' ? BARTHEL_ITEMS
    : tab === 'braden' ? BRADEN_ITEMS
    : tab === 'morse' ? MORSE_ITEMS
    : tab === 'mmse' ? MMSE_ITEMS
    : MNA_SCREENING
  const porResponder = items.filter(it => scores[it.id] === undefined).length
  const historico = patientId ? patientRecords : allTabRecords

  return (
    <Mesa
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any,
          }}>Avaliações</span>

          <Seletor
            opcoes={(Object.keys(SCALES) as ScaleType[]).map(k => ({ id: k, rotulo: SCALES[k].label }))}
            ativa={tab} aoMudar={k => setTab(k as ScaleType)} />

          <select value={patientId} onChange={e => setPatientId(e.target.value)}
            aria-label={person} style={{ ...CAIXA, width: 220 }}>
            <option value="">{`Escolher ${personLower}…`}</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age}a)` : ''}</option>
            ))}
          </select>

          {!loading && (
            <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                {records.filter(r => r.date === new Date().toISOString().slice(0, 10)).length} HOJE
              </span>
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>
                {new Set(records.map(r => r.patient_id)).size} {cfg.personNounPlural.toUpperCase()} AVALIADOS
              </span>
            </span>
          )}

          {/* O número em construção vive aqui: é o que muda a cada toque, e
              tem de estar visível sem rolar até ao fim da escala. */}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              ...MONO, fontSize: 'var(--t-numero)', lineHeight: 1,
              fontWeight: 'var(--peso-forte)' as any, color: level.color,
            }}>{totalScore}</span>
            <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)' }}>/{scale.max}</span>
            <span style={{
              ...MONO, fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
              letterSpacing: '.06em', textTransform: 'uppercase', color: level.color,
            }}>{level.label}</span>
            {liveTrend && (
              <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: liveTrend.color }}>
                {liveTrend.arrow} {liveTrend.label}
              </span>
            )}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>{scale.desc} · máximo {scale.max} pontos</span>
          {liveTrend && lastRecord && (
            <span style={{ ...MONO, color: liveTrend.color }}>
              {liveTrend.arrow} {liveTrend.label} face a {lastRecord.date}
            </span>
          )}
          <span style={{ ...MONO, color: 'var(--ink-5)' }}>
            Escalas validadas — Barthel, Braden, Morse, MMSE e MNA. A leitura é sempre do profissional.
          </span>
        </BarraDeEstado>
      }
    >
      {loading ? (
        <Painel><ACarregar oQue="A carregar as avaliações…" /></Painel>
      ) : (
        <div style={{
          display: 'grid', gap: 10, flex: 1, minHeight: 0, alignItems: 'start',
          gridTemplateColumns: largo ? 'minmax(420px, 1fr) minmax(300px, 380px)' : '1fr',
        }}>
          {/* ══ A ESCALA ═══════════════════════════════════════════════════ */}
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>{scale.label}</span>
                <span style={{
                  ...MONO, fontSize: 'var(--t-meta)',
                  color: porResponder ? 'var(--amber)' : 'var(--green)',
                  fontWeight: 'var(--peso-forte)' as any,
                }}>
                  {porResponder ? `${porResponder} POR RESPONDER` : 'TUDO RESPONDIDO'}
                </span>
              </Cabecalho>
            }
            rodape={
              <>
                <span style={MONO}>
                  {items.length - porResponder} de {items.length} · {totalScore} pontos
                </span>
                <span style={{ marginLeft: 'auto' }}>
                  <Botao feitio="principal" onClick={save} esperando={saving}
                    disabled={!patientId || !podeEditar}>
                    {patientId ? `GUARDAR — ${totalScore} PTS` : `ESCOLHA UM ${person.toUpperCase()}`}
                  </Botao>
                </span>
              </>
            }
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10 }}>
                <Campo rotulo="Data" para="av-data">
                  <input id="av-data" type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ ...CAIXA, width: '100%' }} />
                </Campo>
                <Campo rotulo="Avaliado por" para="av-quem">
                  <input id="av-quem" value={evaluatedBy} onChange={e => setEvaluatedBy(e.target.value)}
                    placeholder="Nome de quem avaliou" style={{ ...CAIXA, width: '100%' }} />
                </Campo>
              </div>
            </div>

            {items.map((item, idx) => {
              const isMMSE = tab === 'mmse'
              const current = scores[item.id]
              const iItem = item as any
              const respondido = current !== undefined
              return (
                <div key={item.id} style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  borderLeft: `3px solid ${respondido ? 'var(--green)' : 'var(--amber)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', width: 20, flexShrink: 0 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)',
                    }}>{item.label}</span>
                    {respondido && (
                      <span style={{
                        ...MONO, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any,
                        color: 'var(--ink-2)',
                      }}>{current} pts</span>
                    )}
                  </div>

                  {isMMSE && iItem.desc && (
                    <div style={{
                      fontSize: 'var(--t-meta)', color: 'var(--ink-4)',
                      margin: '0 0 7px 28px', lineHeight: 1.5,
                    }}>{iItem.desc}</div>
                  )}

                  <div style={{ marginLeft: 28 }}>
                    {isMMSE ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <input
                          type="number" min={0} max={iItem.max} value={current ?? ''}
                          aria-label={`${item.label}, de 0 a ${iItem.max} pontos`}
                          onChange={e => setScores(sc => ({
                            ...sc,
                            [item.id]: Math.min(iItem.max, Math.max(0, parseInt(e.target.value) || 0)),
                          }))}
                          placeholder="0"
                          style={{
                            ...CAIXA, width: 72, textAlign: 'center',
                            ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                          }} />
                        <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>
                          de {iItem.max} pontos
                        </span>
                      </span>
                    ) : (
                      /* Um `<input type="radio">` a sério e visível. Estava
                         escondido com `display: none` por trás de um círculo
                         desenhado à mão — o que tirava o foco do teclado e
                         deixava quem navega sem rato sem saber onde está. */
                      <div role="radiogroup" aria-label={item.label}>
                        {iItem.options.map((opt: { v: number; l: string }) => {
                          const on = current === opt.v
                          const id = `${tab}-${item.id}-${opt.v}`
                          return (
                            <label key={opt.v} htmlFor={id} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                              padding: '5px 8px', borderRadius: 'var(--r-sm)',
                              background: on ? 'var(--green-light)' : 'transparent',
                            }}>
                              <input id={id} type="radio" name={`${tab}-${item.id}`}
                                value={opt.v} checked={on}
                                onChange={() => setScores(sc => ({ ...sc, [item.id]: opt.v }))}
                                style={{ marginTop: 2, accentColor: 'var(--green)', flexShrink: 0 }} />
                              <span style={{
                                fontSize: 'var(--t-dado)', lineHeight: 1.45,
                                color: on ? 'var(--ink)' : 'var(--ink-3)',
                              }}>
                                <span style={{
                                  ...MONO, fontWeight: 'var(--peso-forte)' as any,
                                  color: on ? 'var(--green)' : 'var(--ink-4)', marginRight: 5,
                                }}>{opt.v}</span>
                                {opt.l}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <div style={{ padding: '10px 14px' }}>
              <Campo rotulo="Observações" para="av-notas">
                <textarea id="av-notas" value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="O que o número não diz."
                  style={{ ...CAIXA_TEXTO, width: '100%' }} />
              </Campo>
            </div>
          </Painel>

          {/* ══ O HISTÓRICO ════════════════════════════════════════════════
              É a comparação que dá sentido ao número de hoje: 65 no Barthel
              não quer dizer nada; 65 depois de 80 há três meses quer. */}
          <Painel
            cabeca={
              <Cabecalho>
                <span style={{ ...ROTULO, flex: 1 }}>
                  {patientId ? 'Histórico desta pessoa' : `Últimas · ${scale.label}`}
                </span>
                {patientId && patientRecords.length > 0 && (
                  <Botao onClick={printHistory}>IMPRIMIR</Botao>
                )}
              </Cabecalho>
            }
            rodape={<span style={MONO}>{historico.length} avaliação{historico.length === 1 ? '' : 'ões'}</span>}
          >
            {historico.length === 0 ? (
              <Vazio titulo={`Sem avaliações${patientId ? ' desta pessoa' : ''}.`}
                oQueFazer="Uma escala sozinha diz pouco. É a segunda, três meses depois, que mostra se alguém está a perder autonomia — e é por isso que vale a pena repetir." />
            ) : historico.map(r => {
              const lvl = tab === 'barthel' ? barthelLevel(r.score)
                : tab === 'braden' ? bradenLevel(r.score)
                : tab === 'morse' ? morseLevel(r.score)
                : tab === 'mmse' ? mmseLevel(r.score)
                : mnaLevel(r.score)
              const rTrend = trendInfo(tab, r.score, prevScoreOf(r))
              return (
                <div key={r.id} style={{
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                      ...MONO, fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any,
                      color: 'var(--ink)',
                    }}>{r.score}</span>
                    {rTrend && (
                      <span style={{ ...MONO, fontSize: 'var(--t-meta)', color: rTrend.color }}>
                        {rTrend.arrow} {rTrend.delta > 0 ? '+' : ''}{rTrend.delta}
                      </span>
                    )}
                    <span style={{
                      ...MONO, fontSize: 'var(--t-meta)', letterSpacing: '.06em',
                      textTransform: 'uppercase', fontWeight: 'var(--peso-forte)' as any,
                      color: lvl.color, marginLeft: 'auto',
                    }}>{lvl.label}</span>
                  </div>
                  <div style={{ ...MONO, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>
                    {r.date}{r.evaluated_by ? ` · ${r.evaluated_by}` : ''}
                    {!patientId && r.patient_name ? ` · ${r.patient_name}` : ''}
                  </div>
                  {r.notes && (
                    <div style={{
                      fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 3, lineHeight: 1.5,
                    }}>{r.notes}</div>
                  )}
                </div>
              )
            })}
          </Painel>
        </div>
      )}
    </Mesa>
  )
}
