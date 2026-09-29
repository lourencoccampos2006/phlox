// lib/ronda.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que é preciso saber antes de entrar, e o que fica por fazer lá dentro.
//
// ── O QUE O FERNANDO DISSE ──────────────────────────────────────────────────
// «A ronda coordenada tem de ser melhorada, não pode aparecer apenas a
//  marcação da medicação e se está estável ou não, é necessário muito mais
//  coisas.»
//
// ── O QUE A RONDA MOSTRAVA ──────────────────────────────────────────────────
// A medicação do turno, as tarefas da lista, e três botões: estável, vigiar,
// alerta. Nada mais. Quem faz a ronda entrava no quarto sem saber que aquela
// pessoa é alérgica a penicilina, que caiu na semana passada, que come
// passado, que na ronda das 14h estava a queixar-se, ou que pediu na segunda
// para falar com a filha e ninguém tratou disso.
//
// Tudo isso já estava guardado. Nenhum desses dados foi criado agora: as
// alergias estão em `patients` desde sempre, as feridas em `wounds`, os
// pedidos em `resident_requests`, o registo do dia em `care_records`, a ronda
// anterior em `round_assignments`. O que faltava era ir buscá-los.
//
// ── A REGRA DE DESENHO: ISTO LÊ-SE DE PÉ ────────────────────────────────────
// Uma ronda faz-se em movimento, com o telemóvel numa mão. Um painel com
// trinta linhas não se lê — fecha-se. Por isso os avisos têm NÍVEL, e só os
// críticos ficam sempre à vista; o resto agrupa-se.
//
// E nenhum aviso é inventado a partir de uma inferência: cada um aponta a um
// campo que alguém preencheu. Um aviso que a equipa não consegue explicar é
// um aviso em que deixa de acreditar, e a partir daí ignora todos.
// ─────────────────────────────────────────────────────────────────────────────

import { rotuloDe } from './inscricao'

export type Nivel = 'critico' | 'atencao' | 'nota'

export type Aviso = {
  id: string
  texto: string
  nivel: Nivel
  /** De onde saiu. Sem isto ninguém consegue corrigir um aviso errado. */
  origem: string
}

export const CORES: Record<Nivel, { cor: string; fundo: string }> = {
  critico: { cor: '#dc2626', fundo: '#fef2f2' },
  atencao: { cor: '#d97706', fundo: '#fffbeb' },
  nota:    { cor: '#475569', fundo: '#f8fafc' },
}

const ORDEM: Record<Nivel, number> = { critico: 0, atencao: 1, nota: 2 }

export type PessoaDaRonda = {
  allergies?: string | null
  conditions?: string | null
  diet?: string | null
  mobility?: string | null
  cognitive_status?: string | null
  fall_risk?: string | number | null
  pressure_risk?: string | number | null
}

export type Contexto = {
  /** Feridas por fechar. */
  feridas?: { id: string; location?: string | null; dressing?: string | null }[]
  /** Ocorrências abertas sobre esta pessoa. */
  ocorrencias?: { id: string; type?: string | null; date?: string | null }[]
  /** Pedidos do utente por resolver. */
  pedidos?: { id: string; content?: string | null; kind?: string | null }[]
  /** O que a ronda anterior deixou dito. */
  anterior?: { outcome?: string | null; note?: string | null; attended_name?: string | null } | null
}

/** Um risco guardado como texto ou como número — vale quando está alto. */
function risco(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined || v === '') return false
  if (typeof v === 'number') return v >= 3
  const s = String(v).toLowerCase()
  if (/^\d+$/.test(s)) return +s >= 3
  return /alto|elevad|high|sim|true/.test(s)
}

/**
 * O que se tem de saber antes de falar com a pessoa.
 *
 * Devolve por ordem de nível: primeiro o que não pode passar despercebido.
 */
export function avisosDe(p: PessoaDaRonda, c: Contexto = {}): Aviso[] {
  const avisos: Aviso[] = []

  // ── Crítico: o que muda o que se faz nos próximos cinco minutos ──────────
  if (p.allergies?.trim()) {
    avisos.push({
      id: 'alergias', nivel: 'critico', origem: 'Ficha — alergias',
      texto: `Alergias: ${p.allergies.trim()}`,
    })
  }
  // Uma dieta que não é a geral é um risco de engasgamento, não um pormenor
  // de cozinha: quem leva um copo de água a quem bebe espessado faz mal.
  if (p.diet && p.diet !== 'geral') {
    avisos.push({
      id: 'dieta', nivel: 'critico', origem: 'Ficha — dieta',
      texto: `Dieta: ${rotuloDe('dieta', p.diet).toLowerCase()}`,
    })
  }

  // ── Atenção ──────────────────────────────────────────────────────────────
  if (risco(p.fall_risk)) {
    avisos.push({ id: 'quedas', nivel: 'atencao', origem: 'Ficha — risco de queda',
      texto: 'Risco de queda elevado' })
  }
  if (risco(p.pressure_risk)) {
    avisos.push({ id: 'ulceras', nivel: 'atencao', origem: 'Ficha — risco de úlcera',
      texto: 'Risco de úlcera de pressão — posicionar' })
  }
  for (const f of c.feridas || []) {
    avisos.push({
      id: `ferida-${f.id}`, nivel: 'atencao', origem: 'Feridas',
      texto: `Ferida por fechar${f.location ? ` — ${f.location}` : ''}${f.dressing ? ` · penso: ${f.dressing}` : ''}`,
    })
  }
  for (const o of c.ocorrencias || []) {
    avisos.push({
      id: `ocor-${o.id}`, nivel: 'atencao', origem: 'Ocorrências',
      texto: `Ocorrência por fechar: ${o.type || 'sem tipo'}${o.date ? ` (${o.date})` : ''}`,
    })
  }

  // ── Nota: contexto, não urgência ─────────────────────────────────────────
  if (p.mobility && p.mobility !== 'autonomo') {
    avisos.push({ id: 'mobilidade', nivel: 'nota', origem: 'Ficha — mobilidade',
      texto: rotuloDe('mobilidade', p.mobility) })
  }
  if (p.cognitive_status && p.cognitive_status !== 'orientado') {
    avisos.push({ id: 'cognitivo', nivel: 'nota', origem: 'Ficha — orientação',
      texto: rotuloDe('estado_cognitivo', p.cognitive_status) })
  }
  for (const pe of c.pedidos || []) {
    avisos.push({
      id: `pedido-${pe.id}`, nivel: 'nota', origem: 'Pedidos do utente',
      texto: `Pediu: ${(pe.content || pe.kind || 'algo').slice(0, 90)}`,
    })
  }

  return avisos.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel])
}

/**
 * O que a ronda anterior deixou dito, numa frase.
 *
 * Isto é o que mais falta faz e o que era mais fácil de não fazer. Às 22h,
 * saber que às 14h alguém escreveu «queixou-se do joelho» muda a ronda. Sem
 * isto, cada turno começa do zero e a queixa perde-se entre pessoas.
 */
export function oQueFicouDaAnterior(a: Contexto['anterior']): string | null {
  if (!a) return null
  const estado = a.outcome === 'alerta' ? 'ficou em alerta'
    : a.outcome === 'vigiar' ? 'ficou a vigiar'
    : a.outcome === 'estavel' ? 'ficou estável'
    : null
  const quem = a.attended_name?.split(' ')[0]
  const partes = [
    estado && (quem ? `${estado} com ${quem}` : estado),
    a.note?.trim() && `«${a.note.trim()}»`,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

/** Uma ronda anterior em alerta é ela própria um aviso. */
export function avisoDaAnterior(a: Contexto['anterior']): Aviso | null {
  if (!a || (a.outcome !== 'alerta' && a.outcome !== 'vigiar')) return null
  const frase = oQueFicouDaAnterior(a)
  return frase ? {
    id: 'anterior', nivel: a.outcome === 'alerta' ? 'critico' : 'atencao',
    origem: 'Ronda anterior', texto: `Na ronda anterior ${frase}`,
  } : null
}

// ── O que há para fazer ──────────────────────────────────────────────────────

export type Tarefa = {
  id: string
  tipo: 'medicacao' | 'cuidado' | 'plano'
  titulo: string
  detalhe?: string
  feita: boolean
}

export type Progresso = { feitas: number; total: number; porFazer: number }

export function progressoDe(tarefas: Tarefa[]): Progresso {
  const feitas = tarefas.filter(t => t.feita).length
  return { feitas, total: tarefas.length, porFazer: tarefas.length - feitas }
}

/**
 * O que é que ainda falta a esta pessoa, numa frase.
 *
 * Aparece no cartão ANTES de se abrir, para quem faz a ronda saber onde é que
 * vale a pena parar mais tempo.
 */
export function oQueFalta(tarefas: Tarefa[]): string {
  const p = progressoDe(tarefas)
  if (!p.total) return 'Nada marcado para agora.'
  if (!p.porFazer) return 'Está tudo feito.'
  const porTipo: Record<string, number> = {}
  for (const t of tarefas) if (!t.feita) porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1
  const nomes: Record<string, [string, string]> = {
    medicacao: ['medicamento', 'medicamentos'],
    cuidado: ['cuidado', 'cuidados'],
    plano: ['ação do plano', 'ações do plano'],
  }
  const partes = Object.entries(porTipo).map(([tipo, n]) => {
    const [um, muitos] = nomes[tipo] || ['coisa', 'coisas']
    return `${n} ${n === 1 ? um : muitos}`
  })
  return `Falta ${partes.join(' e ')}.`
}

// ── Os sinais vitais ─────────────────────────────────────────────────────────

export type Vitais = {
  bp_sys?: number | null; bp_dia?: number | null
  hr?: number | null; temp?: number | null
  spo2?: number | null; glucose?: number | null
}

export const CAMPOS_VITAIS: {
  id: keyof Vitais; rotulo: string; unidade: string
  min: number; max: number; passo?: number
}[] = [
  { id: 'bp_sys',  rotulo: 'TA sistólica',  unidade: 'mmHg', min: 50, max: 260 },
  { id: 'bp_dia',  rotulo: 'TA diastólica', unidade: 'mmHg', min: 30, max: 160 },
  { id: 'hr',      rotulo: 'Pulso',         unidade: 'bpm',  min: 25, max: 220 },
  { id: 'temp',    rotulo: 'Temperatura',   unidade: '°C',   min: 32, max: 43, passo: 0.1 },
  { id: 'spo2',    rotulo: 'SpO₂',          unidade: '%',    min: 50, max: 100 },
  { id: 'glucose', rotulo: 'Glicemia',      unidade: 'mg/dL', min: 20, max: 600 },
]

/**
 * Um valor fora do esperado.
 *
 * Isto NÃO é um diagnóstico e não decide nada: só assinala, ao lado da caixa,
 * que o número que acabou de ser escrito costuma merecer um segundo olhar. A
 * maior parte das vezes serve para apanhar um engano de dedo — 1200 em vez de
 * 120 — que de outra forma ficava guardado como se fosse verdade.
 */
export function foraDoEsperado(campo: keyof Vitais, valor: number): string | null {
  if (!Number.isFinite(valor)) return null
  switch (campo) {
    case 'bp_sys':  return valor >= 180 ? 'tensão alta' : valor < 90 ? 'tensão baixa' : null
    case 'bp_dia':  return valor >= 110 ? 'tensão alta' : valor < 50 ? 'tensão baixa' : null
    case 'hr':      return valor >= 120 ? 'pulso rápido' : valor < 45 ? 'pulso lento' : null
    case 'temp':    return valor >= 38 ? 'febre' : valor < 35 ? 'hipotermia' : null
    case 'spo2':    return valor < 92 ? 'oxigénio baixo' : null
    case 'glucose': return valor >= 250 ? 'açúcar alto' : valor < 70 ? 'açúcar baixo' : null
    default:        return null
  }
}

/** Só o que foi mesmo escrito. Um campo vazio não vai como zero. */
export function vitaisPreenchidos(v: Record<string, string>): Vitais {
  const out: Vitais = {}
  for (const c of CAMPOS_VITAIS) {
    const cru = (v[c.id] ?? '').trim()
    if (!cru) continue
    const n = Number(cru.replace(',', '.'))
    // Fora do intervalo possível é engano de quem escreveu, e guardar um
    // engano é pior do que não guardar nada — fica lá como se fosse verdade.
    if (Number.isFinite(n) && n >= c.min && n <= c.max) out[c.id] = n
  }
  return out
}

/** Os vitais em palavras, para o resumo: «TA 120/80 · 36,8 °C». */
export function vitaisEmPalavras(v: Vitais | null | undefined): string {
  if (!v) return ''
  const p: string[] = []
  if (v.bp_sys && v.bp_dia) p.push(`TA ${v.bp_sys}/${v.bp_dia}`)
  else if (v.bp_sys) p.push(`TA sist. ${v.bp_sys}`)
  if (v.hr) p.push(`${v.hr} bpm`)
  if (v.temp) p.push(`${String(v.temp).replace('.', ',')} °C`)
  if (v.spo2) p.push(`SpO₂ ${v.spo2}%`)
  if (v.glucose) p.push(`glicemia ${v.glucose}`)
  return p.join(' · ')
}

/** Há alguma coisa preenchida? (Um objeto vazio não se grava.) */
export const temVitais = (v: Vitais) => Object.keys(v).length > 0
