// lib/dependencias.ts
// ─────────────────────────────────────────────────────────────────────────────
// O perfil de dependência: o que esta pessoa consegue fazer sozinha, e em quê
// precisa de ajuda.
//
// ── PORQUE É QUE ISTO FALTAVA, E PORQUE É QUE ERA GRAVE ────────────────────
// As escalas já existiam, bem feitas, dentro do /assessments: Barthel, Braden,
// Morse, MMSE, MNA, com os itens certos em português. Alguém fazia a avaliação
// e o produto guardava **um número**.
//
// «Barthel 35» não diz a ninguém o que fazer. Quem lê isso e vai dar banho à
// pessoa não sabe se ela se senta sozinha. A informação que interessa estava
// nas RESPOSTAS — «banho: 0», «transferência: 5» — e ficava enterrada num
// jsonb que nada voltava a ler.
//
// Isto desenterra-a. E é a diferença entre um plano escrito de intuição e um
// plano que sai da avaliação, que foi o que o Fernando pediu quando disse
// «medical grade mesmo, com avaliações, dependências».
//
// ── A CORRENTE COMPLETA ────────────────────────────────────────────────────
//   avaliação  →  perfil de dependência  →  o que isso implica  →  plano
//
// A última seta é a que interessa: uma pessoa dependente no banho precisa do
// serviço «banho» com ajuda; uma com Braden ≤ 12 precisa de posicionamento de
// três em três horas. O produto passa a poder SUGERIR isso, em vez de esperar
// que alguém se lembre.
//
// ── O QUE ISTO NÃO FAZ ──────────────────────────────────────────────────────
// Não decide. Sugere, e quem trata escolhe. Um plano preenchido por um
// programa é um plano que ninguém leu — e a assinatura que lá está por baixo é
// de uma pessoa, não de uma escala.
// ─────────────────────────────────────────────────────────────────────────────

export type Nivel = 'independente' | 'ajuda' | 'dependente'

export interface Dependencia {
  /** O id do item na escala — `bathing`, `transfer`… */
  id: string
  /** Em palavras de quem cuida. */
  atividade: string
  nivel: Nivel
  /** A frase que aparece na ficha. */
  frase: string
}

export const ROTULO_DO_NIVEL: Record<Nivel, string> = {
  independente: 'Faz sozinha',
  ajuda: 'Precisa de ajuda',
  dependente: 'Depende de outra pessoa',
}

export const COR_DO_NIVEL: Record<Nivel, { fundo: string; borda: string; texto: string }> = {
  independente: { fundo: 'var(--green-light)', borda: 'var(--green-mid)', texto: 'var(--green-3)' },
  ajuda:        { fundo: 'var(--amber-light)', borda: 'var(--badge-amber-border)', texto: 'var(--badge-amber-fg)' },
  dependente:   { fundo: 'var(--red-light)', borda: 'var(--badge-red-border)', texto: 'var(--red)' },
}

/**
 * Os dez itens do Barthel, e o que cada pontuação quer dizer em termos de
 * dependência.
 *
 * O máximo de cada item é diferente (o banho vale 5, a transferência vale 15),
 * por isso não se pode comparar pontuações entre itens — compara-se cada uma
 * com o máximo DELA. Foi aqui que quase me enganei: um 5 na transferência é
 * «grande ajuda», e um 5 no banho é «independente».
 */
const ITENS_BARTHEL: { id: string; atividade: string; max: number; parcial?: number[] }[] = [
  { id: 'feeding',  atividade: 'Comer',              max: 10, parcial: [5] },
  { id: 'bathing',  atividade: 'Banho',              max: 5 },
  { id: 'grooming', atividade: 'Higiene pessoal',    max: 5 },
  { id: 'dressing', atividade: 'Vestir-se',          max: 10, parcial: [5] },
  { id: 'bowels',   atividade: 'Continência intestinal', max: 10, parcial: [5] },
  { id: 'bladder',  atividade: 'Continência urinária',   max: 10, parcial: [5] },
  { id: 'toilet',   atividade: 'Ir à casa de banho', max: 10, parcial: [5] },
  { id: 'transfer', atividade: 'Levantar-se e sentar-se', max: 15, parcial: [5, 10] },
  { id: 'mobility', atividade: 'Andar',              max: 15, parcial: [5, 10] },
  { id: 'stairs',   atividade: 'Escadas',            max: 10, parcial: [5] },
]

function nivelDe(pontos: number, item: { max: number; parcial?: number[] }): Nivel {
  if (pontos >= item.max) return 'independente'
  if (pontos <= 0) return 'dependente'
  if (item.parcial?.includes(pontos)) return 'ajuda'
  return 'ajuda'
}

/**
 * O perfil de dependência a partir das respostas de um Barthel.
 *
 * `respostas` é o `assessments.answers` — o jsonb que ficava guardado e que
 * ninguém voltava a ler.
 */
export function perfilDeDependencia(respostas: Record<string, number> | null | undefined): Dependencia[] {
  if (!respostas || typeof respostas !== 'object') return []

  return ITENS_BARTHEL.flatMap(item => {
    const p = respostas[item.id]
    // Um item que não foi respondido não é «dependente»: é desconhecido, e
    // inventar um nível seria pôr no plano uma necessidade que ninguém viu.
    if (typeof p !== 'number') return []
    const nivel = nivelDe(p, item)
    return [{
      id: item.id,
      atividade: item.atividade,
      nivel,
      frase: `${item.atividade}: ${ROTULO_DO_NIVEL[nivel].toLowerCase()}`,
    }]
  })
}

/** Só o que precisa de alguém — é o que interessa a quem monta um turno. */
export function ondePrecisaDeAjuda(perfil: Dependencia[]): Dependencia[] {
  return perfil.filter(d => d.nivel !== 'independente')
}

/** Uma frase para o topo da ficha. */
export function perfilEmUmaLinha(perfil: Dependencia[]): string {
  if (!perfil.length) return ''
  const dep = perfil.filter(d => d.nivel === 'dependente')
  const aju = perfil.filter(d => d.nivel === 'ajuda')
  if (!dep.length && !aju.length) return 'Faz tudo sozinha.'
  const partes: string[] = []
  if (dep.length) partes.push(`depende noutra pessoa em ${dep.length} ${dep.length === 1 ? 'coisa' : 'coisas'}`)
  if (aju.length) partes.push(`precisa de ajuda em ${aju.length}`)
  return partes.join(', ') + '.'
}

// ─────────────────────────────────────────────────────────────────────────────
// O QUE AS AVALIAÇÕES IMPLICAM
// ─────────────────────────────────────────────────────────────────────────────

export interface Sugestao {
  /** De onde veio: `barthel`, `braden`, `morse`, `mna`. */
  origem: string
  /** O que está a acontecer. */
  porque: string
  /** O que se propõe fazer. */
  oQue: string
  /** O nome EXACTO de um serviço do catálogo, quando há um que sirva.
   *  É o que permite acrescentá-lo com um toque. */
  servico?: string
  /** Uma etiqueta que faz sentido pôr. */
  etiqueta?: string
  /** Um objetivo para o plano. */
  objetivo?: { area: string; titulo: string; porque: string }
  gravidade: 'informa' | 'atencao' | 'urgente'
}

/** O que o Barthel pede, item a item. */
const SERVICO_DO_ITEM: Record<string, { servico: string; quando: string }> = {
  bathing:  { servico: 'Banho', quando: 'precisa de ajuda no banho' },
  grooming: { servico: 'Higiene pessoal', quando: 'precisa de ajuda na higiene' },
  dressing: { servico: 'Vestir e despir', quando: 'precisa de ajuda a vestir-se' },
  feeding:  { servico: 'Apoio à refeição', quando: 'precisa de ajuda a comer' },
  toilet:   { servico: 'Higiene íntima', quando: 'precisa de ajuda na casa de banho' },
  transfer: { servico: 'Transferência', quando: 'precisa de ajuda para se levantar' },
  mobility: { servico: 'Marcha acompanhada', quando: 'precisa de ajuda para andar' },
}

export interface Avaliacoes {
  barthel?: { score: number; answers: Record<string, number> | null; date: string } | null
  braden?: { score: number; date: string } | null
  morse?: { score: number; date: string } | null
  mna?: { score: number; date: string } | null
}

/**
 * O que estas avaliações implicam, em coisas que se podem fazer hoje.
 *
 * Cada sugestão diz de onde veio. Isso não é detalhe: quem recebe uma
 * sugestão tem de poder discordar com conhecimento de causa, e «porque o
 * programa disse» não é motivo nenhum.
 */
export function sugestoesDasAvaliacoes(av: Avaliacoes): Sugestao[] {
  const fora: Sugestao[] = []

  // ── Barthel: cada dependência pede um cuidado ──────────────────────────
  if (av.barthel?.answers) {
    for (const d of ondePrecisaDeAjuda(perfilDeDependencia(av.barthel.answers))) {
      const s = SERVICO_DO_ITEM[d.id]
      if (!s) continue
      fora.push({
        origem: 'Barthel',
        porque: `Na avaliação, ${s.quando}.`,
        oQue: `Acrescentar «${s.servico}» aos cuidados de rotina.`,
        servico: s.servico,
        gravidade: d.nivel === 'dependente' ? 'atencao' : 'informa',
      })
    }

    if (av.barthel.score <= 20) {
      fora.push({
        origem: 'Barthel',
        porque: `Pontuação ${av.barthel.score} em 100 — dependência total.`,
        oQue: 'Rever se o plano cobre todas as necessidades básicas.',
        etiqueta: 'Acamado',
        gravidade: 'atencao',
      })
    }
  }

  // ── Braden: risco de úlcera ────────────────────────────────────────────
  if (av.braden && av.braden.score <= 14) {
    const alto = av.braden.score <= 12
    fora.push({
      origem: 'Braden',
      porque: `Pontuação ${av.braden.score} em 23 — risco ${alto ? 'alto' : 'moderado'} de úlcera de pressão.`,
      oQue: alto
        ? 'Posicionamento de 2 em 2 horas e vigilância diária da pele.'
        : 'Posicionamento regular e vigilância da pele.',
      servico: 'Posicionamento',
      objetivo: {
        area: 'feridas',
        titulo: 'Evitar úlceras de pressão',
        porque: `A escala de Braden deu ${av.braden.score}, que é risco ${alto ? 'alto' : 'moderado'}.`,
      },
      gravidade: alto ? 'urgente' : 'atencao',
    })
  }

  // ── Morse: risco de queda ──────────────────────────────────────────────
  if (av.morse && av.morse.score >= 25) {
    const alto = av.morse.score > 50
    fora.push({
      origem: 'Morse',
      porque: `Pontuação ${av.morse.score} — risco ${alto ? 'elevado' : 'moderado'} de queda.`,
      oQue: alto
        ? 'Acompanhar nas deslocações e rever calçado, iluminação e obstáculos.'
        : 'Rever calçado e obstáculos; atenção nas deslocações.',
      servico: 'Marcha acompanhada',
      etiqueta: 'Risco de queda',
      objetivo: {
        area: 'registos',
        titulo: 'Reduzir o risco de queda',
        porque: `A escala de Morse deu ${av.morse.score}.`,
      },
      gravidade: alto ? 'urgente' : 'atencao',
    })
  }

  // ── MNA: nutrição ──────────────────────────────────────────────────────
  if (av.mna && av.mna.score < 12) {
    const desnutrida = av.mna.score < 8
    fora.push({
      origem: 'MNA',
      porque: `Pontuação ${av.mna.score} em 14 — ${desnutrida ? 'desnutrição' : 'risco de desnutrição'}.`,
      oQue: desnutrida
        ? 'Reforço alimentar, pesagem semanal e falar com quem acompanha.'
        : 'Vigiar a ingestão e pesar com regularidade.',
      servico: 'Pesagem',
      etiqueta: desnutrida ? 'Apoio à alimentação' : undefined,
      objetivo: {
        area: 'registos',
        titulo: desnutrida ? 'Recuperar o estado nutricional' : 'Evitar a perda de peso',
        porque: `O MNA deu ${av.mna.score} em 14.`,
      },
      gravidade: desnutrida ? 'urgente' : 'atencao',
    })
  }

  const peso = { urgente: 0, atencao: 1, informa: 2 }
  return fora.sort((a, b) => peso[a.gravidade] - peso[b.gravidade])
}

// ─────────────────────────────────────────────────────────────────────────────
// A FRESCURA DAS AVALIAÇÕES
// ─────────────────────────────────────────────────────────────────────────────

export interface EstadoDaEscala {
  escala: string
  label: string
  /** null quando nunca foi feita. */
  data: string | null
  dias: number | null
  /** Está a precisar de ser repetida? */
  chama: boolean
  frase: string
}

/** De quantos em quantos meses cada escala deve ser repetida. */
const CADA: Record<string, number> = { barthel: 6, braden: 3, morse: 3, mna: 6, mmse: 12 }
const NOMES: Record<string, string> = {
  barthel: 'Barthel — autonomia',
  braden: 'Braden — risco de úlcera',
  morse: 'Morse — risco de queda',
  mna: 'MNA — nutrição',
  mmse: 'MMSE — cognição',
}

/**
 * Que avaliações estão em falta ou já com idade.
 *
 * ── O TOM ──────────────────────────────────────────────────────────────────
 * «Nunca foi feita» e «foi há oito meses» são factos, não acusações. Nada aqui
 * diz «em atraso»: um centro de dia não tem equipa clínica a tempo inteiro, e
 * a lista de escalas é uma ajuda, não uma dívida.
 */
export function estadoDasEscalas(
  ultimas: Record<string, string | undefined>, hoje = new Date(),
): EstadoDaEscala[] {
  return Object.keys(CADA).map(escala => {
    const data = ultimas[escala] || null
    if (!data) {
      return {
        escala, label: NOMES[escala], data: null, dias: null, chama: true,
        frase: 'Nunca foi feita.',
      }
    }
    const dias = Math.round((hoje.getTime() - new Date(data + 'T00:00:00').getTime()) / 86400000)
    const limite = CADA[escala] * 30
    if (dias > limite) {
      const meses = Math.round(dias / 30)
      return {
        escala, label: NOMES[escala], data, dias, chama: true,
        frase: `A última foi há ${meses} ${meses === 1 ? 'mês' : 'meses'}. Costuma repetir-se de ${CADA[escala]} em ${CADA[escala]}.`,
      }
    }
    return {
      escala, label: NOMES[escala], data, dias, chama: false,
      frase: `Feita a ${new Date(data + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}.`,
    }
  }).sort((a, b) => Number(b.chama) - Number(a.chama))
}
