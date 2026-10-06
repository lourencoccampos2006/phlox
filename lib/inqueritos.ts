// lib/inqueritos.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os inquéritos de satisfação — a utentes, a famílias e à equipa.
//
// ── PORQUE É QUE ISTO NÃO É OPCIONAL ───────────────────────────────────────
// O Modelo de Avaliação da Qualidade das Respostas Sociais, da Segurança
// Social, pede a toda a casa com acordo que meça a satisfação dos clientes e
// dos significativos, pelo menos uma vez por ano, que ANALISE o resultado e
// que defina ações de melhoria a partir dele.
//
// Não é uma sondagem de marketing: é um dos critérios por que a casa é
// avaliada. O MySenior tem isto desde 2020. O Phlox não tinha nada — e o que
// as casas fazem hoje são folhas fotocopiadas, uma caixa de cartão, e uma
// pessoa a somar à mão em dezembro.
//
// ── A REGRA QUE MANDA EM TUDO: ANÓNIMO OU NÃO SERVE ────────────────────────
// Uma pessoa que depende da casa para comer, para se lavar e para se deitar
// não escreve «a auxiliar da noite trata-me mal» com o nome dela ao lado.
//
// Se a resposta puder ser seguida até quem a deu, o inquérito deixa de medir
// satisfação e passa a medir medo. E o número que sai é bonito, que é o pior
// que podia acontecer: a casa fica convencida de que está tudo bem.
//
// Por isso a tabela das respostas NÃO TEM nada que ligue a uma pessoa. Nem
// `patient_id`, nem `user_id`, nem `recorded_by_id`. Nem sequer «qual dos
// convites foi usado». O sistema sabe quantos responderam; nunca quem.
//
// E há uma segunda metade disto que é tão importante como a primeira: **quem
// responde tem de ACREDITAR que é anónimo**. Uma garantia que não está
// escrita na folha não muda uma única resposta. Por isso a promessa aparece
// ao respondente, em português simples, antes da primeira pergunta.
//
// ── A SEGUNDA REGRA: UMA MÉDIA DE TRÊS RESPOSTAS NÃO É A OPINIÃO DA CASA ───
// Todo o número que sai daqui viaja com o `n` ao lado. Um 4,7 de três
// respostas e um 4,7 de quarenta não são a mesma frase, e um relatório que os
// escreve da mesma maneira é um relatório que não se consegue defender.
//
// ── A TERCEIRA: NÃO SE INVENTA UM ÍNDICE ───────────────────────────────────
// A tentação é compor um «índice de satisfação global» com a média de tudo.
// Não há aqui nenhum. O número global é a resposta à pergunta «no geral, como
// se sente nesta casa» — uma pergunta que as pessoas responderam mesmo. Um
// índice composto parece mais científico e é só mais difícil de explicar a
// quem o lê.
//
// ── E O PAPEL NÃO É UM PLANO B ─────────────────────────────────────────────
// Uma pessoa de noventa anos com demência não preenche um formulário no
// telemóvel. Quem responde é ela, com alguém sentado ao lado a ler as
// perguntas, ou a família ao balcão durante uma visita. O papel é o canal
// PRINCIPAL, e quem passa as respostas para o programa escreve as respostas —
// nunca de quem são.
// ─────────────────────────────────────────────────────────────────────────────

import type { PrintDoc, PrintRecord } from './print'

/* ══════════════════════════════════════════════════════════════════════════
   O QUESTIONÁRIO
   ══════════════════════════════════════════════════════════════════════════ */

export type Publico = 'utentes' | 'familias' | 'equipa'

export const ROTULO_DO_PUBLICO: Record<Publico, string> = {
  utentes: 'Utentes',
  familias: 'Famílias',
  equipa: 'Equipa',
}

export interface Pergunta {
  /**
   * Estável para sempre.
   *
   * As respostas gravadas guardam este id. Mudar o id de uma pergunta faz as
   * respostas do ano passado deixarem de ter pergunta — e a comparação entre
   * anos, que é a única coisa que torna o segundo inquérito útil, desaparece.
   */
  id: string
  texto: string
  dimensao: string
  /** Uma pergunta aberta não tem escala: o que lá está escrito é o que vale. */
  aberta?: boolean
  /**
   * A pergunta do «no geral». Há uma e uma só por questionário, e é dela que
   * sai o número global — ver a nota sobre não inventar índices.
   */
  global?: boolean
}

export interface Dimensao {
  id: string
  nome: string
  /** O que esta dimensão serve para descobrir, para quem está a montar a folha. */
  porque: string
}

/**
 * A escala.
 *
 * ── PORQUE É QUE NÃO É «CONCORDO / DISCORDO» ───────────────────────────────
 * Porque as perguntas são coisas («a comida», «a limpeza do quarto») e não
 * afirmações. Uma escala de concordância obriga a transformar cada pergunta
 * numa frase do género «estou satisfeito com a comida servida nesta
 * instituição», que é mais comprida, mais formal e mais difícil de responder a
 * alguém que ouve mal e lê devagar.
 *
 * ── E PORQUE É QUE SÃO CINCO E NÃO QUATRO ──────────────────────────────────
 * Há quem tire o meio de propósito, para obrigar a tomar partido. Com pessoas
 * muito dependentes isso não produz uma opinião mais clara: produz uma
 * resposta ao acaso, ou nenhuma. «Razoável» é uma resposta verdadeira e tem de
 * caber.
 */
export const ESCALA: { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: 'Mau' },
  { valor: 2, rotulo: 'Fraco' },
  { valor: 3, rotulo: 'Razoável' },
  { valor: 4, rotulo: 'Bom' },
  { valor: 5, rotulo: 'Muito bom' },
]

/**
 * «Não sei / Não se aplica» — e é obrigatório que exista.
 *
 * Sem esta hipótese, quem não sabe escolhe o meio. E «Razoável» é uma opinião
 * verdadeira de alguém que pensou no assunto: misturada com a de quem não faz
 * ideia, deixa de querer dizer nada. Guarda-se `null` e conta-se à parte.
 */
export const NAO_SEI = { valor: null, rotulo: 'Não sei / Não se aplica' }

export const DIMENSOES: Dimensao[] = [
  { id: 'instalacoes', nome: 'Instalações e conforto', porque: 'O espaço onde a pessoa passa o dia todo.' },
  { id: 'alimentacao', nome: 'Alimentação', porque: 'A queixa número um em quase todas as casas, e a mais fácil de resolver.' },
  { id: 'cuidados', nome: 'Cuidados e higiene', porque: 'O trabalho da casa, visto por quem o recebe.' },
  { id: 'saude', nome: 'Saúde', porque: 'A atenção quando alguém se sente mal.' },
  { id: 'atividades', nome: 'Atividades e convívio', porque: 'O que separa viver de estar guardado.' },
  { id: 'equipa', nome: 'Relação com a equipa', porque: 'Como se fala com as pessoas, e não só o que se lhes faz.' },
  { id: 'informacao', nome: 'Informação', porque: 'A família que não sabe nada desconfia de tudo.' },
  { id: 'respeito', nome: 'Respeito e privacidade', porque: 'O critério que uma inspeção pergunta e que ninguém mede.' },
  { id: 'trabalho', nome: 'Condições de trabalho', porque: 'Só para a equipa.' },
  { id: 'global', nome: 'No geral', porque: 'Uma pergunta, respondida por pessoas. Não é um índice composto.' },
]

export const POR_DIMENSAO = new Map(DIMENSOES.map(d => [d.id, d]))

/* ── Os três questionários ─────────────────────────────────────────────────
   As perguntas são curtas e concretas de propósito. «Grau de adequação das
   instalações às necessidades do cliente» é a linguagem do modelo da
   Segurança Social, e não é a linguagem de ninguém que o vá responder. */

const UTENTES: Pergunta[] = [
  { id: 'u_quarto', dimensao: 'instalacoes', texto: 'O seu quarto ou a sua sala' },
  { id: 'u_limpeza', dimensao: 'instalacoes', texto: 'A limpeza da casa' },
  { id: 'u_temperatura', dimensao: 'instalacoes', texto: 'A temperatura — frio e calor' },
  { id: 'u_comida', dimensao: 'alimentacao', texto: 'A comida' },
  { id: 'u_variedade', dimensao: 'alimentacao', texto: 'A variedade das refeições' },
  { id: 'u_horarios', dimensao: 'alimentacao', texto: 'As horas das refeições' },
  { id: 'u_higiene', dimensao: 'cuidados', texto: 'A ajuda no banho e na higiene' },
  { id: 'u_espera', dimensao: 'cuidados', texto: 'O tempo que espera quando chama' },
  { id: 'u_roupa', dimensao: 'cuidados', texto: 'O tratamento da sua roupa' },
  { id: 'u_saude', dimensao: 'saude', texto: 'A atenção quando se sente mal' },
  { id: 'u_medicacao', dimensao: 'saude', texto: 'A maneira como lhe dão a medicação' },
  { id: 'u_atividades', dimensao: 'atividades', texto: 'As atividades que há para fazer' },
  { id: 'u_convivio', dimensao: 'atividades', texto: 'O convívio com as outras pessoas' },
  { id: 'u_trato', dimensao: 'equipa', texto: 'A maneira como lhe falam' },
  { id: 'u_disponibilidade', dimensao: 'equipa', texto: 'A disponibilidade de quem cá trabalha' },
  { id: 'u_privacidade', dimensao: 'respeito', texto: 'O respeito pela sua privacidade' },
  { id: 'u_escolha', dimensao: 'respeito', texto: 'A liberdade de escolher as suas coisas' },
  { id: 'u_global', dimensao: 'global', texto: 'No geral, como se sente nesta casa', global: true },
  { id: 'u_melhor', dimensao: 'global', texto: 'O que corre melhor?', aberta: true },
  { id: 'u_mudar', dimensao: 'global', texto: 'O que mudaria?', aberta: true },
]

const FAMILIAS: Pergunta[] = [
  { id: 'f_informacao', dimensao: 'informacao', texto: 'O que lhe contam sobre o seu familiar' },
  { id: 'f_contacto', dimensao: 'informacao', texto: 'A facilidade de falar com a equipa' },
  { id: 'f_avisos', dimensao: 'informacao', texto: 'Serem avisados quando acontece alguma coisa' },
  { id: 'f_aspeto', dimensao: 'cuidados', texto: 'O aspeto e a higiene do seu familiar' },
  { id: 'f_roupa', dimensao: 'cuidados', texto: 'O tratamento da roupa dele' },
  { id: 'f_alimentacao', dimensao: 'alimentacao', texto: 'A alimentação' },
  { id: 'f_saude', dimensao: 'saude', texto: 'A atenção à saúde dele' },
  { id: 'f_limpeza', dimensao: 'instalacoes', texto: 'A limpeza e o conforto da casa' },
  { id: 'f_atividades', dimensao: 'atividades', texto: 'As atividades em que ele participa' },
  { id: 'f_visitas', dimensao: 'equipa', texto: 'O acolhimento quando vem visitar' },
  { id: 'f_trato', dimensao: 'equipa', texto: 'A maneira como tratam o seu familiar' },
  { id: 'f_privacidade', dimensao: 'respeito', texto: 'O respeito pela dignidade dele' },
  { id: 'f_global', dimensao: 'global', texto: 'No geral, está satisfeito com esta casa', global: true },
  { id: 'f_melhor', dimensao: 'global', texto: 'O que corre melhor?', aberta: true },
  { id: 'f_mudar', dimensao: 'global', texto: 'O que mudaria?', aberta: true },
]

const EQUIPA: Pergunta[] = [
  { id: 'e_condicoes', dimensao: 'trabalho', texto: 'As condições em que trabalha' },
  { id: 'e_horarios', dimensao: 'trabalho', texto: 'Os horários e as escalas' },
  { id: 'e_material', dimensao: 'trabalho', texto: 'O material e os equipamentos que tem' },
  { id: 'e_pessoas', dimensao: 'trabalho', texto: 'O número de pessoas por turno' },
  { id: 'e_formacao', dimensao: 'trabalho', texto: 'A formação que recebe' },
  { id: 'e_chefia', dimensao: 'equipa', texto: 'A relação com quem o coordena' },
  { id: 'e_colegas', dimensao: 'equipa', texto: 'A relação com os colegas' },
  { id: 'e_informacao', dimensao: 'informacao', texto: 'A informação que lhe chega sobre os utentes' },
  { id: 'e_passagem', dimensao: 'informacao', texto: 'A passagem de turno' },
  { id: 'e_respeito', dimensao: 'respeito', texto: 'Sentir-se respeitado no trabalho' },
  { id: 'e_global', dimensao: 'global', texto: 'No geral, como se sente a trabalhar aqui', global: true },
  { id: 'e_melhor', dimensao: 'global', texto: 'O que corre melhor?', aberta: true },
  { id: 'e_mudar', dimensao: 'global', texto: 'O que mudaria?', aberta: true },
]

export const MODELO: Record<Publico, Pergunta[]> = {
  utentes: UTENTES, familias: FAMILIAS, equipa: EQUIPA,
}

/**
 * O questionário de um inquérito.
 *
 * ── PORQUE É QUE AS PERGUNTAS FICAM GRAVADAS DENTRO DO INQUÉRITO ───────────
 * O inquérito guarda uma CÓPIA das perguntas (`perguntas jsonb`), e não uma
 * referência ao modelo. Se o modelo mudar no ano que vem — e vai mudar, porque
 * a casa quer acrescentar uma pergunta —, o inquérito do ano passado continua
 * a querer dizer o que queria dizer. Sem isto, uma resposta de 2026 passava a
 * ser lida com a pergunta de 2027, e ninguém dava por isso.
 */
export const perguntasDe = (publico: Publico): Pergunta[] =>
  (MODELO[publico] || []).map(p => ({ ...p }))

/* ══════════════════════════════════════════════════════════════════════════
   A ANÁLISE
   ══════════════════════════════════════════════════════════════════════════ */

export interface Resposta {
  /** `{ "u_comida": 4, "u_espera": null, "u_mudar": "mais passeios" }` */
  respostas: Record<string, number | string | null>
  como?: 'portal' | 'papel' | 'equipa'
  respondido_em?: string
}

export interface ResultadoDaPergunta {
  pergunta: Pergunta
  /** A média das respostas que foram dadas. `null` quando ninguém respondeu. */
  media: number | null
  /** Quantas pessoas responderam a ESTA pergunta (sem contar «não sei»). */
  n: number
  /** Quantas disseram «não sei / não se aplica». */
  naoSei: number
  /** Quantas em cada degrau da escala, para a barra. */
  distribuicao: Record<number, number>
}

export interface ResultadoDaDimensao {
  dimensao: Dimensao
  media: number | null
  /** O número de RESPOSTAS somadas, e não o de pessoas. Ver a nota em baixo. */
  n: number
  perguntas: ResultadoDaPergunta[]
}

export interface Analise {
  /** Quantos responderam, de quantos foram convidados. */
  respostas: number
  convidados: number
  /** `null` quando ninguém escreveu quantos foram convidados. */
  taxa: number | null
  porPergunta: ResultadoDaPergunta[]
  porDimensao: ResultadoDaDimensao[]
  /** A resposta à pergunta do «no geral». NUNCA um índice composto. */
  global: ResultadoDaPergunta | null
  /** O que as pessoas escreveram, por pergunta aberta. Sempre na íntegra. */
  abertas: { pergunta: Pergunta; textos: string[] }[]
}

const arredondar = (v: number) => Math.round(v * 100) / 100

/** Só os números da escala contam. `null`, texto e lixo ficam de fora. */
function valorDaEscala(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return ESCALA.some(e => e.valor === v) ? v : null
}

export function analisar(
  perguntas: Pergunta[], respostas: Resposta[], convidados = 0,
): Analise {
  const porPergunta: ResultadoDaPergunta[] = perguntas
    .filter(p => !p.aberta)
    .map(p => {
      const distribuicao: Record<number, number> = {}
      for (const e of ESCALA) distribuicao[e.valor] = 0
      let soma = 0, n = 0, naoSei = 0

      for (const r of respostas) {
        if (!(p.id in (r.respostas || {}))) continue
        const bruto = r.respostas[p.id]
        const v = valorDaEscala(bruto)
        if (v == null) {
          // «Não sei» é uma resposta e conta-se; uma pergunta deixada em branco
          // não é nada e não conta para lado nenhum.
          if (bruto === null) naoSei++
          continue
        }
        distribuicao[v]++
        soma += v
        n++
      }
      return { pergunta: p, media: n ? arredondar(soma / n) : null, n, naoSei, distribuicao }
    })

  const porId = new Map(porPergunta.map(r => [r.pergunta.id, r]))

  // ── A média de uma dimensão ────────────────────────────────────────────
  // É a média de TODAS as respostas dadas às perguntas dela, e não a média das
  // médias. As duas quase não diferem — cada pessoa responde a quase tudo —,
  // mas esta diz-se numa frase que se defende à frente de um inspetor: «média
  // de 142 respostas». A média das médias não tem `n` nenhum que se escreva.
  const porDimensao: ResultadoDaDimensao[] = DIMENSOES
    .map(d => {
      const minhas = porPergunta.filter(r => r.pergunta.dimensao === d.id)
      let soma = 0, n = 0
      for (const r of minhas) {
        // Soma-se pela distribuição e não por `media × n`: a média já vem
        // arredondada às centésimas, e multiplicá-la outra vez acrescenta um
        // erro que não precisa de existir.
        for (const e of ESCALA) {
          const quantas = r.distribuicao[e.valor] || 0
          soma += e.valor * quantas
          n += quantas
        }
      }
      return { dimensao: d, media: n ? arredondar(soma / n) : null, n, perguntas: minhas }
    })
    .filter(d => d.perguntas.length > 0)

  const perguntaGlobal = perguntas.find(p => p.global)
  const global = perguntaGlobal ? (porId.get(perguntaGlobal.id) || null) : null

  const abertas = perguntas.filter(p => p.aberta).map(p => ({
    pergunta: p,
    textos: respostas
      .map(r => r.respostas?.[p.id])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map(v => v.trim()),
  }))

  return {
    respostas: respostas.length,
    convidados,
    taxa: convidados > 0 ? Math.round((respostas.length / convidados) * 100) : null,
    porPergunta, porDimensao, global, abertas,
  }
}

/**
 * As perguntas com pior resultado — as que o plano de melhoria vai agarrar.
 *
 * ── PORQUE É QUE HÁ UM MÍNIMO DE RESPOSTAS ─────────────────────────────────
 * Uma pergunta com duas respostas pode ficar em primeiro lugar da lista do que
 * está pior sem que isso queira dizer nada. Pôr essa pergunta à frente de uma
 * que teve trinta respostas e 3,2 manda a casa trabalhar no sítio errado.
 *
 * O mínimo não esconde nada: as perguntas com poucas respostas continuam todas
 * na análise, com o `n` à frente. O que o mínimo decide é apenas o que se
 * propõe como prioridade.
 */
export function piores(a: Analise, quantas = 5, minimoDeRespostas = 5): ResultadoDaPergunta[] {
  return a.porPergunta
    .filter(r => r.media != null && r.n >= minimoDeRespostas && !r.pergunta.global)
    .sort((x, y) => (x.media! - y.media!) || (y.n - x.n))
    .slice(0, quantas)
}

/** O mesmo pelo outro lado — o que a casa faz bem e não deve estragar. */
export function melhores(a: Analise, quantas = 3, minimoDeRespostas = 5): ResultadoDaPergunta[] {
  return a.porPergunta
    .filter(r => r.media != null && r.n >= minimoDeRespostas && !r.pergunta.global)
    .sort((x, y) => (y.media! - x.media!) || (y.n - x.n))
    .slice(0, quantas)
}

/**
 * O que se pode dizer deste número, em voz alta.
 *
 * Sem isto, um 4,6 de quatro respostas vai parar a um relatório entregue à
 * Segurança Social com o mesmo ar de um 4,6 de quarenta.
 */
export function comQuantas(n: number, convidados = 0): string {
  if (n === 0) return 'Ninguém respondeu a esta pergunta.'
  const base = `${n} ${n === 1 ? 'resposta' : 'respostas'}`
  if (convidados > 0) {
    const pct = Math.round((n / convidados) * 100)
    return `${base} de ${convidados} ${convidados === 1 ? 'convidado' : 'convidados'} (${pct}%)`
  }
  return base
}

/**
 * Dá para confiar neste inquérito?
 *
 * Devolve a frase que fica no topo do relatório. Não esconde nada e não recusa
 * nada — diz o que o número aguenta.
 */
export function confianca(a: Analise): { nivel: 'poucas' | 'alguma' | 'boa'; frase: string } {
  if (a.respostas < 5) {
    return {
      nivel: 'poucas',
      frase: `Só ${a.respostas} ${a.respostas === 1 ? 'pessoa respondeu' : 'pessoas responderam'}. `
        + 'Os números que se seguem são a opinião dessas pessoas, e não a da casa. '
        + 'O que vale aqui são as frases que escreveram.',
    }
  }
  if (a.taxa != null && a.taxa < 30) {
    return {
      nivel: 'alguma',
      frase: `Responderam ${a.respostas} de ${a.convidados} (${a.taxa}%). `
        + 'Quem está muito descontente e quem está muito satisfeito respondem mais do que os '
        + 'outros, por isso uma taxa baixa puxa os números para os extremos.',
    }
  }
  return {
    nivel: 'boa',
    frase: a.taxa != null
      ? `Responderam ${a.respostas} de ${a.convidados} (${a.taxa}%).`
      : `${a.respostas} respostas.`,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPARAR COM O ANO PASSADO
   ══════════════════════════════════════════════════════════════════════════ */

export interface Variacao {
  pergunta: Pergunta
  antes: number
  agora: number
  diferenca: number
  nAntes: number
  nAgora: number
}

/**
 * O que subiu e o que desceu de um inquérito para o outro.
 *
 * ── SÓ AS PERGUNTAS QUE EXISTEM NOS DOIS ───────────────────────────────────
 * Uma pergunta acrescentada este ano não desceu nem subiu: não havia. E uma
 * que foi tirada não pode continuar a aparecer na comparação com o valor
 * antigo, como se ainda estivesse a ser medida.
 *
 * ── E SÓ ACIMA DO MÍNIMO DOS DOIS LADOS ────────────────────────────────────
 * Uma pergunta que teve duas respostas num dos anos produz uma «descida de
 * 1,4 pontos» que é ruído e que vai parar à primeira linha do relatório.
 */
export function comparar(
  antes: Analise, agora: Analise, minimoDeRespostas = 5,
): Variacao[] {
  const mapaAntes = new Map(antes.porPergunta.map(r => [r.pergunta.id, r]))
  const out: Variacao[] = []
  for (const r of agora.porPergunta) {
    const a = mapaAntes.get(r.pergunta.id)
    if (!a || a.media == null || r.media == null) continue
    if (a.n < minimoDeRespostas || r.n < minimoDeRespostas) continue
    out.push({
      pergunta: r.pergunta, antes: a.media, agora: r.media,
      diferenca: arredondar(r.media - a.media), nAntes: a.n, nAgora: r.n,
    })
  }
  return out.sort((x, y) => x.diferenca - y.diferenca)
}

/* ══════════════════════════════════════════════════════════════════════════
   O ESTADO DE UM INQUÉRITO
   ══════════════════════════════════════════════════════════════════════════ */

export interface Inquerito {
  id: string
  titulo: string
  publico: Publico
  ano: number
  perguntas: Pergunta[]
  aberto_em: string
  fechado_em?: string | null
  convidados?: number | null
  codigo?: string | null
}

export const estaAberto = (i: Inquerito): boolean => !i.fechado_em

/**
 * O que falta para este inquérito valer alguma coisa.
 *
 * Um inquérito aberto há oito meses, com duas respostas e sem ninguém
 * convidado, não é um inquérito: é uma pasta esquecida. Isto diz-lhe isso.
 */
export function oQueFalta(i: Inquerito, respostas: number, hoje: string): string[] {
  const falta: string[] = []
  if (!i.convidados) {
    falta.push('Falta escrever quantas pessoas foram convidadas — sem isso não há taxa de resposta, '
      + 'e a taxa de resposta é a primeira coisa que uma inspeção pergunta.')
  }
  if (respostas === 0) falta.push('Ainda não há nenhuma resposta.')
  if (estaAberto(i)) {
    const dias = diasEntre(i.aberto_em, hoje)
    if (dias > 60) {
      falta.push(`Está aberto há ${dias} dias. Um inquérito que não fecha nunca chega a ter relatório.`)
    }
  }
  return falta
}

function diasEntre(de: string, ate: string): number {
  const a = new Date(de.slice(0, 10) + 'T00:00:00')
  const b = new Date(ate.slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/* ══════════════════════════════════════════════════════════════════════════
   O PAPEL
   ══════════════════════════════════════════════════════════════════════════
   ── PORQUE É QUE ISTO VIVE AQUI E NÃO NA PÁGINA ───────────────────────────
   Porque o papel é o canal principal, e não um extra. Metade das respostas de
   um lar vêm numa folha, com alguém sentado ao lado a ler as perguntas em voz
   alta. Se a folha sair mal — sem a promessa de anonimato, sem a escala, com
   uma pergunta a faltar — o inquérito não acontece.

   Dentro de um componente isso só se verificaria com um browser aberto e um
   clique num botão de imprimir, que é precisamente o que não se faz em QA
   automático. Aqui são dados, e os dados testam-se.
   ══════════════════════════════════════════════════════════════════════════ */


const virgula = (v: number) => v.toFixed(2).replace('.', ',')

/** A promessa, por palavras de quem a tem de acreditar. */
export const PROMESSA =
  'Não escreva o seu nome. Ninguém nesta casa vai saber que foi o senhor ou a senhora '
  + 'que respondeu — o programa não guarda quem respondeu o quê, e por isso não há maneira '
  + 'de o descobrir depois.'

/** A folha em branco, para distribuir. */
export function folhaParaImprimir(i: Inquerito, unidade: string): PrintDoc {
  const escala = ESCALA.map(e => `☐ ${e.rotulo}`).join('    ') + `    ☐ ${NAO_SEI.rotulo}`
  const registos: PrintRecord[] = (i.perguntas || []).map((p, n) => ({
    title: `${n + 1}.  ${p.texto}`,
    // Uma pergunta aberta não leva escala: leva linhas para escrever.
    body: p.aberta
      ? '\n____________________________________________\n\n____________________________________________\n'
      : escala,
  }))

  return {
    docTitle: i.titulo,
    docSubtitle: `Inquérito de satisfação · ${ROTULO_DO_PUBLICO[i.publico]} · ${i.ano}`,
    institution: unidade,
    sections: [
      {
        heading: 'Antes de começar',
        records: [{
          title: 'Esta folha é anónima',
          body: `${PROMESSA}\n\nResponda com sinceridade. É assim que isto serve para alguma coisa.`
            + '\n\nSe não souber, ou se a pergunta não lhe disser respeito, marque «Não sei».',
        }],
      },
      { heading: 'Perguntas', records: registos },
    ],
    footerNote: 'Depois de preenchida, deixe a folha na caixa. Não precisa de a dobrar '
      + 'nem de a entregar a ninguém.',
  }
}

/** O relatório, para a reunião e para a inspeção. */
export function relatorioParaImprimir(i: Inquerito, a: Analise, unidade: string): PrintDoc {
  const c = confianca(a)
  const ps = piores(a, 5)
  const ms = melhores(a, 3)

  const porDimensao: PrintRecord[] = a.porDimensao
    .filter(d => d.media != null)
    .map(d => ({
      title: d.dimensao.nome,
      meta: comQuantas(d.n),
      fields: d.perguntas.filter(p => p.media != null).map(p => ({
        label: p.pergunta.texto,
        // O `n` ao lado de CADA média. É a regra toda deste ficheiro, e é na
        // folha impressa que ela mais importa: é esta que fica na pasta.
        value: `${virgula(p.media!)} · ${comQuantas(p.n)}`
          + (p.naoSei ? ` · ${p.naoSei} «não sei»` : ''),
      })),
    }))

  return {
    docTitle: `Relatório — ${i.titulo}`,
    docSubtitle: `${ROTULO_DO_PUBLICO[i.publico]} · ${i.ano}`
      + (i.fechado_em ? ` · fechado a ${i.fechado_em.slice(0, 10).split('-').reverse().join('/')}` : ' · ainda aberto'),
    institution: unidade,
    meta: [
      { label: 'respostas', value: String(a.respostas) },
      { label: 'convidados', value: a.convidados ? String(a.convidados) : '—' },
      { label: 'taxa de resposta', value: a.taxa == null ? '—' : `${a.taxa}%` },
      { label: 'no geral', value: a.global?.media == null ? '—' : virgula(a.global.media) },
    ],
    sections: [
      {
        heading: 'O que estes números aguentam',
        records: [{
          title: c.nivel === 'boa' ? 'Leitura' : 'Atenção à leitura',
          body: `${c.frase}\n\nAs respostas são anónimas por construção: a base de dados não guarda `
            + 'quem respondeu o quê, e por isso não é possível — a ninguém — associar uma resposta a uma pessoa.',
        }],
      },
      ...(ps.length ? [{
        heading: 'Onde agir primeiro',
        note: 'As perguntas com pior resultado, entre as que tiveram respostas suficientes '
          + 'para se poder dizer alguma coisa.',
        records: [{
          title: 'Prioridades',
          bullets: ps.map(p => `${p.pergunta.texto} — ${virgula(p.media!)} (${comQuantas(p.n)})`),
        }],
      }] : []),
      ...(ms.length ? [{
        heading: 'O que a casa faz bem',
        records: [{ title: 'A manter', bullets: ms.map(p => `${p.pergunta.texto} — ${virgula(p.media!)}`) }],
      }] : []),
      {
        heading: 'Resultados por dimensão',
        records: porDimensao.length ? porDimensao : [{ title: 'Sem respostas' }],
      },
      ...a.abertas.filter(x => x.textos.length).map(x => ({
        heading: x.pergunta.texto,
        note: 'Transcrito tal como foi escrito. É daqui que saem as ações concretas.',
        records: x.textos.map(t => ({ title: '—', body: t })),
      })),
      {
        heading: 'Ações de melhoria',
        note: 'A preencher pela direção técnica, a partir das prioridades acima.',
        records: [
          { title: 'Decidido em reunião de', fields: [{ label: 'Data', value: '' }, { label: 'Presentes', value: '' }] },
          {
            title: 'Ações',
            body: '\n1. ______________________________________________\n\n'
              + '2. ______________________________________________\n\n'
              + '3. ______________________________________________\n',
          },
        ],
      },
    ],
    footerNote: 'Relatório de satisfação. Os números dizem de quantas respostas saíram; '
      + 'as frases transcritas são a parte que produz ações.',
  }
}
