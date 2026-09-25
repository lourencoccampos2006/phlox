// lib/stockUtente.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que cada pessoa tem cá — fraldas, medicação, cremes.
//
// ── A PERGUNTA QUE ISTO RESPONDE ────────────────────────────────────────────
// «A D. Maria ainda tem fraldas para o fim de semana?»
//
// O `stock_items` que já existia é o armazém da CASA: serve para saber quantas
// caixas de luvas há. Não serve para esta pergunta, que se faz cem vezes por
// semana e cuja resposta anda na cabeça de quem tratou dela de manhã.
//
// ── A BAIXA AUTOMÁTICA NÃO ESTÁ AQUI ───────────────────────────────────────
// Está num GATILHO da base de dados (`stock_aplicar_toma`, sprint160). Isso é
// deliberado e vale a pena perceber porquê antes de alguém procurar o código
// aqui e não o encontrar.
//
// Marcar uma toma acontece em quatro sítios — /mar, /o-dia, portal da família,
// tomas SOS. Se a baixa vivesse na aplicação, teria de estar escrita nos
// quatro, e bastava alguém acrescentar um quinto para o stock começar a mentir
// devagar. No gatilho está escrita uma vez e não há como a contornar.
//
// O que está aqui é a leitura: quanto falta, para quantos dias chega, e a que
// ritmo se gasta.
//
// ── PORQUE É QUE «PARA QUANTOS DIAS CHEGA» É O NÚMERO QUE IMPORTA ──────────
// «Restam 8 fraldas» não diz nada a ninguém: depende de quantas se usam por
// dia. «Chega até sexta» é uma frase sobre a qual se age — telefona-se à
// família hoje, e não na sexta de manhã com a pessoa molhada.
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtigoDoUtente {
  id: string
  patient_id: string
  nome: string
  categoria: string
  unidade: string | null
  quantidade: number
  minimo: number | null
  med_id: string | null
  por_toma: number
  notas: string | null
}

export interface Movimento {
  id: string
  stock_id: string
  delta: number
  motivo: string
  origem: string | null
  created_at: string
  nota: string | null
  feito_por: string | null
}

export const CATEGORIAS: Record<string, { label: string; icone: string; cor: string }> = {
  medicamento:   { label: 'Medicamento',    icone: '💊', cor: '#2563eb' },
  incontinencia: { label: 'Fraldas/Pensos', icone: '🩹', cor: '#db2777' },
  consumivel:    { label: 'Consumível',     icone: '🧴', cor: '#0d9488' },
  epi:           { label: 'EPI',            icone: '🧤', cor: '#7c3aed' },
  limpeza:       { label: 'Limpeza',        icone: '🧹', cor: '#0891b2' },
  geral:         { label: 'Geral',          icone: '📦', cor: '#64748b' },
}

export const MOTIVOS: Record<string, string> = {
  toma: 'Toma',
  uso: 'Usado',
  entrada: 'Entrou',
  acerto: 'Acerto de contagem',
  perda: 'Perdido ou estragado',
  devolucao: 'Devolvido',
}

export type Aviso = 'ok' | 'a_acabar' | 'acabou'

export interface Situacao {
  aviso: Aviso
  /** Quantos por dia se gastaram, em média, na janela olhada. Null sem dados. */
  porDia: number | null
  /** Quantos dias ainda dá. Null quando não há consumo para calcular. */
  diasQueFaltam: number | null
  /** A frase que aparece no cartão. */
  frase: string
}

/**
 * O ritmo a que este artigo se gasta.
 *
 * Só conta as SAÍDAS: uma entrada de cem fraldas não quer dizer que se gastem
 * cem por dia. E divide pelos dias em que houve movimento, não pela janela
 * toda — um artigo que só começou a ser usado anteontem não deve parecer que
 * dura um mês só porque a janela tem trinta dias.
 */
export function ritmoPorDia(movs: Movimento[], stockId: string, dias = 14, agora = new Date()): number | null {
  const limite = agora.getTime() - dias * 86400000
  const saidas = movs.filter(m => m.stock_id === stockId && m.delta < 0 && +new Date(m.created_at) >= limite)
  if (!saidas.length) return null

  const gasto = saidas.reduce((s, m) => s + Math.abs(m.delta), 0)
  const primeiro = Math.min(...saidas.map(m => +new Date(m.created_at)))
  // Pelo menos um dia, para não dividir por zero e não inventar um ritmo
  // enorme a partir de duas saídas na mesma manhã.
  const janela = Math.max(1, Math.ceil((agora.getTime() - primeiro) / 86400000))
  return gasto / janela
}

function diaDaSemana(d: Date): string {
  return ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
          'quinta-feira', 'sexta-feira', 'sábado'][d.getDay()]
}

/** Como está este artigo, em palavras sobre as quais se pode agir. */
export function situacao(art: ArtigoDoUtente, movs: Movimento[], agora = new Date()): Situacao {
  const porDia = ritmoPorDia(movs, art.id, 14, agora)
  const diasQueFaltam = porDia && porDia > 0 ? Math.floor(art.quantidade / porDia) : null

  const unidade = art.unidade || (art.quantidade === 1 ? 'unidade' : 'unidades')
  const quanto = `${Number(art.quantidade.toFixed(2))} ${unidade}`

  if (art.quantidade <= 0) {
    return { aviso: 'acabou', porDia, diasQueFaltam: 0, frase: 'Acabou.' }
  }

  // «Chega até sexta» vale mais do que «restam 8»: é uma frase sobre a qual se
  // age hoje, em vez de na manhã em que já não há.
  if (diasQueFaltam !== null && diasQueFaltam <= 7) {
    const fim = new Date(agora)
    fim.setDate(fim.getDate() + diasQueFaltam)
    const quando = diasQueFaltam === 0 ? 'acaba hoje'
      : diasQueFaltam === 1 ? 'chega até amanhã'
      : `chega até ${diaDaSemana(fim)}`
    return { aviso: 'a_acabar', porDia, diasQueFaltam, frase: `${quanto} — ${quando}.` }
  }

  const abaixoDoMinimo = art.minimo != null && art.minimo > 0 && art.quantidade <= art.minimo
  if (abaixoDoMinimo) {
    return {
      aviso: 'a_acabar', porDia, diasQueFaltam,
      frase: `${quanto} — abaixo do mínimo (${Number(art.minimo)}).`,
    }
  }

  if (diasQueFaltam !== null) {
    return { aviso: 'ok', porDia, diasQueFaltam, frase: `${quanto} — cerca de ${diasQueFaltam} dias.` }
  }
  return { aviso: 'ok', porDia, diasQueFaltam: null, frase: quanto }
}

/** Os que precisam de alguém, primeiro os que já acabaram. */
export function precisamDeAtencao(
  artigos: ArtigoDoUtente[], movs: Movimento[], agora = new Date(),
): { artigo: ArtigoDoUtente; situacao: Situacao }[] {
  return artigos
    .map(a => ({ artigo: a, situacao: situacao(a, movs, agora) }))
    .filter(x => x.situacao.aviso !== 'ok')
    .sort((a, b) => {
      if (a.situacao.aviso !== b.situacao.aviso) return a.situacao.aviso === 'acabou' ? -1 : 1
      return (a.situacao.diasQueFaltam ?? 999) - (b.situacao.diasQueFaltam ?? 999)
    })
}

/** Uma linha do histórico, em português. */
export function movimentoEmPalavras(m: Movimento, unidade?: string | null): string {
  const n = Math.abs(m.delta)
  const u = unidade || (n === 1 ? 'unidade' : 'unidades')
  const verbo = m.delta < 0 ? 'saíram' : 'entraram'
  const base = `${verbo} ${Number(n.toFixed(2))} ${u} · ${MOTIVOS[m.motivo] || m.motivo}`
  // Um movimento vindo de uma toma tem de se distinguir de um feito à mão:
  // senão, quem lê o histórico não sabe o que foi a equipa e o que foi o
  // programa.
  return m.origem === 'mar_records' || m.origem === 'tomas_sos'
    ? `${base} (automático)`
    : base
}
