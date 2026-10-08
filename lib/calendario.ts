// lib/calendario.ts
// ─────────────────────────────────────────────────────────────────────────────
// O ano inteiro, e a aritmética que o faz bater certo.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Uma página com um calendário de um ano inteiro, onde ficavam marcadas
//  automaticamente todas as coisas com data, visitas, atividades, aniversários
//  de utentes, e muitas outras coisas, e também dá para adicionar manualmente
//  coisas, não esquecendo sempre de verificar se o ano em que estamos é
//  bissexto ou não para as coisas baterem certo.»
//
// ── PORQUE É QUE OS ANOS BISSEXTOS SÃO MESMO UM PROBLEMA AQUI ──────────────
// Não é por causa da grelha — essa o `new Date` acerta sozinho. É por causa
// dos ANIVERSÁRIOS, que são datas que se repetem todos os anos.
//
// Quem nasceu a 29 de fevereiro não faz anos em três anos de cada quatro. Um
// calendário ingénuo faz uma de duas coisas, ambas más: ou não mostra nada (e
// a pessoa passa o aniversário sem ninguém se lembrar, num sítio onde às
// vezes ninguém mais se lembra), ou atira para 1 de março sem dizer nada.
//
// Aqui vai para 28 de fevereiro e diz que foi movido. 28 de fevereiro é o
// último dia do mês, e é isso que o artigo 279.º do Código Civil manda para
// os prazos que caem num dia que não existe. É também o que as pessoas fazem
// entre si.
//
// ── E A PÁSCOA ──────────────────────────────────────────────────────────────
// Metade dos feriados portugueses dependem dela, e a Páscoa move-se entre 22
// de março e 25 de abril. Numa casa onde é preciso saber com meses de
// antecedência quem está de serviço, um feriado que aparece no dia errado não
// é um pormenor.
//
// O algoritmo é o Gregoriano anónimo (Meeus/Jones/Butcher). Não o inventei e
// não o simplifiquei: está testado contra as datas reais em
// scripts/teste-calendario.mjs.
// ─────────────────────────────────────────────────────────────────────────────

export type Origem =
  | 'aniversario' | 'entrada' | 'atividade' | 'visita' | 'consulta'
  | 'prazo' | 'validade' | 'documento' | 'inscricao' | 'feriado' | 'manual'

export type Marca = {
  id: string
  /** 'AAAA-MM-DD'. Sempre no ano que se está a ver. */
  data: string
  titulo: string
  origem: Origem
  /** De quem é isto, quando é de alguém. */
  quem?: string
  quemId?: string
  hora?: string
  detalhe?: string
  /**
   * A data verdadeira não existe neste ano (29 de fevereiro fora de um
   * bissexto) e foi assinalada noutro dia. A interface TEM de o dizer.
   */
  movida?: string
}

export const ORIGENS: { id: Origem; rotulo: string; cor: string; auto: boolean }[] = [
  { id: 'aniversario', rotulo: 'Aniversários',        cor: 'var(--red)', auto: true },
  { id: 'entrada',     rotulo: 'Anos de casa',        cor: 'var(--roxo)', auto: true },
  { id: 'atividade',   rotulo: 'Atividades',          cor: 'var(--green-3)', auto: true },
  { id: 'visita',      rotulo: 'Visitas',             cor: 'var(--blue)', auto: true },
  { id: 'consulta',    rotulo: 'Consultas',           cor: 'var(--green)', auto: true },
  { id: 'prazo',       rotulo: 'Prazos por fechar',   cor: 'var(--red)', auto: true },
  { id: 'validade',    rotulo: 'Validades de stock',  cor: 'var(--amber)', auto: true },
  { id: 'documento',   rotulo: 'Documentos a caducar',cor: 'var(--amber)', auto: true },
  { id: 'inscricao',   rotulo: 'Entradas previstas',  cor: 'var(--green)', auto: true },
  { id: 'feriado',     rotulo: 'Feriados',            cor: 'var(--badge-blue-border)', auto: true },
  { id: 'manual',      rotulo: 'Marcado à mão',       cor: 'var(--badge-blue-fg)', auto: false },
]

export const corDe = (o: Origem) => ORIGENS.find(x => x.id === o)?.cor || 'var(--badge-blue-border)'
export const rotuloDe = (o: Origem) => ORIGENS.find(x => x.id === o)?.rotulo || 'Outro'

// ── A aritmética ─────────────────────────────────────────────────────────────

/**
 * A regra completa, e não «divisível por 4».
 *
 * 1900 não foi bissexto e 2000 foi. A versão curta acerta entre 1901 e 2099 —
 * e falha em 1900, que é precisamente a década em que nasceu boa parte de quem
 * vive num lar hoje.
 */
export function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
}

/** Quantos dias tem um mês. `mes` é 0–11, como no `Date`. */
export function diasDoMes(ano: number, mes: number): number {
  // O dia 0 do mês seguinte é o último deste. Evita a lista de 12 números
  // onde alguém mais cedo ou mais tarde escreve 28 em fevereiro.
  return new Date(ano, mes + 1, 0).getDate()
}

export const diasDoAno = (ano: number) => (ehBissexto(ano) ? 366 : 365)

/** Domingo de Páscoa. Algoritmo Gregoriano anónimo. `mes` é 0–11. */
export function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const total = h + l - 7 * m + 114
  return { mes: Math.floor(total / 31) - 1, dia: (total % 31) + 1 }
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

/** Um dia deslocado, em dias, a partir de outro. */
function mais(ano: number, mes: number, dia: number, dias: number): string {
  const d = new Date(ano, mes, dia + dias)
  return iso(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Os feriados nacionais portugueses de um ano.
 *
 * O Carnaval não é feriado obrigatório — é tolerância de ponto, decidida ano a
 * ano pelo Governo. Vai marcado à mesma porque, numa casa que abre todos os
 * dias, o que interessa saber é quem falta, e nesse dia falta gente.
 */
export function feriados(ano: number): Marca[] {
  const p = pascoa(ano)
  const fixos: [number, number, string][] = [
    [0, 1, 'Ano Novo'],
    [3, 25, 'Dia da Liberdade'],
    [4, 1, 'Dia do Trabalhador'],
    [5, 10, 'Dia de Portugal'],
    [7, 15, 'Assunção de Nossa Senhora'],
    [9, 5, 'Implantação da República'],
    [10, 1, 'Todos os Santos'],
    [11, 1, 'Restauração da Independência'],
    [11, 8, 'Imaculada Conceição'],
    [11, 25, 'Natal'],
  ]
  const moveis: [number, string, string | undefined][] = [
    [-47, 'Carnaval', 'Tolerância de ponto, decidida ano a ano.'],
    [-2, 'Sexta-feira Santa', undefined],
    [0, 'Domingo de Páscoa', undefined],
    [60, 'Corpo de Deus', undefined],
  ]
  return [
    ...fixos.map(([mes, dia, titulo]) => ({
      id: `feriado-${mes}-${dia}`, data: iso(ano, mes, dia), titulo, origem: 'feriado' as const,
    })),
    ...moveis.map(([desvio, titulo, detalhe]) => ({
      id: `feriado-pascoa${desvio}`, data: mais(ano, p.mes, p.dia, desvio),
      titulo, origem: 'feriado' as const, detalhe,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Onde é que uma data que se repete todos os anos cai NESTE ano.
 *
 * É aqui que mora o 29 de fevereiro. Devolve também a data verdadeira quando
 * teve de a mover, para a interface o poder dizer em vez de mentir por omissão.
 */
export function noAno(original: string, ano: number): { data: string; movida?: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(original || '')
  if (!m) return null
  const mes = +m[2] - 1, dia = +m[3]
  if (mes < 0 || mes > 11 || dia < 1) return null

  if (mes === 1 && dia === 29 && !ehBissexto(ano)) {
    // 28 de fevereiro: é o último dia do mês, que é o que o Código Civil manda
    // para um prazo que termina num dia que o mês não tem. Guarda-se a data
    // verdadeira para se poder escrever «faz anos a 29; este ano assinala-se
    // hoje» — em vez de a pessoa parecer ter nascido a 28.
    return { data: iso(ano, 1, 28), movida: `${ano}-02-29` }
  }
  // Qualquer outro dia a mais (31 de abril, por exemplo) é um engano de quem
  // escreveu, não uma data a mover.
  if (dia > diasDoMes(ano, mes)) return null
  return { data: iso(ano, mes, dia) }
}

/** Que idade faz nesse ano. `null` quando a data não serve. */
export function idadeQueFaz(nascimento: string, ano: number): number | null {
  const m = /^(\d{4})/.exec(nascimento || '')
  if (!m) return null
  const anos = ano - +m[1]
  return anos > 0 && anos < 130 ? anos : null
}

// ── A grelha ─────────────────────────────────────────────────────────────────

/** 0 = domingo no `Date`; aqui a semana começa à segunda, como em Portugal. */
export const DIAS_CURTOS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/**
 * Os dias de um mês por semanas, com as casas vazias do princípio e do fim.
 * `null` = casa vazia.
 */
export function grelhaDoMes(ano: number, mes: number): (number | null)[][] {
  const total = diasDoMes(ano, mes)
  // getDay(): 0=domingo. Queremos 0=segunda.
  const comecaEm = (new Date(ano, mes, 1).getDay() + 6) % 7
  const casas: (number | null)[] = [
    ...Array(comecaEm).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]
  while (casas.length % 7) casas.push(null)
  const semanas: (number | null)[][] = []
  for (let i = 0; i < casas.length; i += 7) semanas.push(casas.slice(i, i + 7))
  return semanas
}

/** As marcas agrupadas por dia, para a grelha não procurar em cada casa. */
export function porDia(marcas: Marca[]): Map<string, Marca[]> {
  const m = new Map<string, Marca[]>()
  for (const x of marcas) {
    const lista = m.get(x.data)
    if (lista) lista.push(x)
    else m.set(x.data, [x])
  }
  // Dentro de um dia, primeiro o que tem hora, por ordem de hora.
  for (const lista of m.values()) {
    lista.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'))
  }
  return m
}

/** Uma data 'AAAA-MM-DD' em português: «12 de março». */
export function porExtenso(data: string, comAno = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) return data
  const mes = MESES[+m[2] - 1]?.toLowerCase() || ''
  return `${+m[3]} de ${mes}${comAno ? ` de ${m[1]}` : ''}`
}

/** Quantas marcas de cada origem, para as legendas e os filtros. */
export function contarPorOrigem(marcas: Marca[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const m of marcas) c[m.origem] = (c[m.origem] || 0) + 1
  return c
}
