// lib/prioridade.ts
// ─────────────────────────────────────────────────────────────────────────────
// A calculadora dos critérios de prioridade de entrada.
//
// ── O QUE ELA FAZ, E O QUE NUNCA FAZ ────────────────────────────────────────
// Ordena a lista de espera e mostra a conta por extenso. Não admite ninguém,
// não recomenda ninguém, e não devolve nada que se pareça com uma decisão.
// A lei portuguesa obriga a que os critérios estejam escritos no regulamento
// interno; obriga também a que quem decide seja a direção. Uma tabela
// ordenada é um apoio à reunião, não um substituto dela.
//
// ── PORQUE É QUE OS PESOS VÊM DA BASE DE DADOS ──────────────────────────────
// Porque são de cada casa. Duas IPSS na mesma rua dão pesos diferentes à
// retaguarda familiar, e ambas estão certas — está no regulamento de cada
// uma. Se eu escrevesse os pesos aqui, a primeira direção que comparasse esta
// ordem com o seu próprio regulamento deixava de confiar no número, e com
// razão.
//
// ── A PARTE DIFÍCIL: O QUE VALE UMA PERGUNTA SEM RESPOSTA ──────────────────
// A tentação é contar zero e seguir. É o pior que se podia fazer: uma ficha
// preenchida a meio passava a parecer uma pessoa de baixa prioridade, ficava
// no fundo da lista, e ninguém na reunião perceberia porquê — pareceria um
// juízo sobre a pessoa quando era só um campo em branco.
//
// Por isso uma resposta em falta conta zero MAS é contada à parte, e quem lê
// vê «provisória — faltam 3 respostas» em cima do número. O mesmo para uma
// resposta que deixou de existir porque alguém editou o critério: vale zero,
// e diz-se que vale zero por isso.
// ─────────────────────────────────────────────────────────────────────────────

export type Opcao = {
  valor: string
  rotulo: string
  pontos: number
  /** Só nos critérios automáticos: valor mínimo a partir do qual esta faixa se aplica. */
  de?: number
}

export type Criterio = {
  id: string
  nome: string
  descricao?: string | null
  peso: number
  opcoes: Opcao[]
  /** null → alguém responde. 'idade' e 'espera' saem sozinhos dos dados. */
  automatico?: 'idade' | 'espera' | null
  ordem?: number
  ativo?: boolean
}

/** O que a calculadora precisa de saber de uma candidatura. */
export type ParaPontuar = {
  respostas?: Record<string, string> | null
  data_nascimento?: string | null
  criada_em?: string | null
}

/** Uma linha da conta, para se poder mostrar o porquê ao lado do quanto. */
export type Linha = {
  criterio: Criterio
  /** A opção escolhida (ou a faixa calculada). `null` = não há resposta. */
  opcao: Opcao | null
  pontos: number
  peso: number
  subtotal: number
  /** O máximo que este critério podia dar, para se ver o que ficou por dar. */
  maximo: number
  estado: 'respondido' | 'automatico' | 'por_responder' | 'resposta_antiga'
}

export type Pontuacao = {
  total: number
  maximo: number
  /** 0–100. Zero quando o máximo é zero (todos os pesos a 0). */
  percentagem: number
  linhas: Linha[]
  porResponder: number
  /** Respostas guardadas que já não correspondem a nenhuma opção do critério. */
  desatualizadas: number
  /** Enquanto for verdade, o número em cima tem de aparecer como provisório. */
  provisoria: boolean
}

// ── Os dois valores que a casa não pergunta a ninguém ────────────────────────

/** Anos completos. `null` quando não há data, ou quando a data está no futuro. */
export function idadeDe(nascimento?: string | null): number | null {
  if (!nascimento) return null
  const d = new Date(nascimento + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const hoje = new Date()
  if (d > hoje) return null
  let anos = hoje.getFullYear() - d.getFullYear()
  // Ainda não fez anos este ano.
  const m = hoje.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--
  return anos
}

/** Meses completos desde que a inscrição foi feita. */
export function mesesDeEspera(desde?: string | null): number {
  if (!desde) return 0
  const d = new Date(desde)
  if (Number.isNaN(d.getTime())) return 0
  const hoje = new Date()
  let meses = (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth())
  if (hoje.getDate() < d.getDate()) meses--
  return Math.max(0, meses)
}

/**
 * A faixa em que um número cai, nas opções de um critério automático.
 *
 * As opções vêm ordenadas por `de` crescente e escolhe-se a última que o
 * número alcança. Se alguém as reordenar na interface, isto continua a dar o
 * mesmo — por isso é que ordena aqui em vez de confiar na ordem que veio.
 */
function faixaDe(valor: number, opcoes: Opcao[]): Opcao | null {
  const comLimite = opcoes
    .filter(o => typeof o.de === 'number')
    .sort((a, b) => (a.de as number) - (b.de as number))
  if (!comLimite.length) return null
  let escolhida: Opcao | null = null
  for (const o of comLimite) if (valor >= (o.de as number)) escolhida = o
  // Abaixo da faixa mais baixa vale a mais baixa — não zero por omissão.
  return escolhida || comLimite[0]
}

/** O máximo que um critério pode dar, seja qual for a resposta. */
function maximoDe(c: Criterio): number {
  const maior = c.opcoes.reduce((m, o) => Math.max(m, Number(o.pontos) || 0), 0)
  return maior * (Number(c.peso) || 0)
}

// ── A conta ──────────────────────────────────────────────────────────────────

export function pontuar(cand: ParaPontuar, criterios: Criterio[]): Pontuacao {
  const ativos = criterios
    .filter(c => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  const respostas = cand.respostas || {}
  const linhas: Linha[] = []
  let total = 0, maximo = 0, porResponder = 0, desatualizadas = 0

  for (const c of ativos) {
    const peso = Number(c.peso) || 0
    const max = maximoDe(c)
    let opcao: Opcao | null = null
    let estado: Linha['estado'] = 'por_responder'

    if (c.automatico === 'idade') {
      const anos = idadeDe(cand.data_nascimento)
      // Sem data de nascimento não se inventa uma idade. Fica por responder,
      // e aparece na lista do que falta — que é o empurrão para a ir buscar.
      if (anos !== null) { opcao = faixaDe(anos, c.opcoes); estado = 'automatico' }
    } else if (c.automatico === 'espera') {
      opcao = faixaDe(mesesDeEspera(cand.criada_em), c.opcoes)
      estado = 'automatico'
    } else {
      const escolhido = respostas[c.id]
      if (escolhido) {
        const achada = c.opcoes.find(o => o.valor === escolhido)
        if (achada) { opcao = achada; estado = 'respondido' }
        // A resposta existe mas a opção já não. Alguém editou o critério
        // depois de a ficha ter sido preenchida. Vale zero, e diz-se porquê —
        // em vez de a pessoa descer na lista sem explicação nenhuma.
        else { estado = 'resposta_antiga'; desatualizadas++ }
      }
    }

    if (estado === 'por_responder') porResponder++

    const pontos = Number(opcao?.pontos) || 0
    const subtotal = pontos * peso
    total += subtotal
    maximo += max
    linhas.push({ criterio: c, opcao, pontos, peso, subtotal, maximo: max, estado })
  }

  return {
    total, maximo,
    percentagem: maximo > 0 ? Math.round((total / maximo) * 100) : 0,
    linhas, porResponder, desatualizadas,
    provisoria: porResponder > 0 || desatualizadas > 0,
  }
}

/** As perguntas que alguém tem mesmo de responder (as automáticas não contam). */
export function perguntas(criterios: Criterio[]): Criterio[] {
  return criterios
    .filter(c => c.ativo !== false && !c.automatico)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/**
 * A lista de espera por ordem.
 *
 * Empate desfaz-se por antiguidade da inscrição, e não por acaso: é o que
 * está escrito em praticamente todos os regulamentos, e é a única regra que
 * ninguém pode acusar de ter sido escolhida para favorecer alguém.
 */
export function ordenar<T extends ParaPontuar & { criada_em?: string | null }>(
  candidaturas: T[], criterios: Criterio[],
): { candidatura: T; pontuacao: Pontuacao; lugar: number }[] {
  return candidaturas
    .map(c => ({ candidatura: c, pontuacao: pontuar(c, criterios) }))
    .sort((a, b) => {
      if (b.pontuacao.total !== a.pontuacao.total) return b.pontuacao.total - a.pontuacao.total
      const da = a.candidatura.criada_em || '', db = b.candidatura.criada_em || ''
      return da < db ? -1 : da > db ? 1 : 0
    })
    .map((x, i) => ({ ...x, lugar: i + 1 }))
}

/**
 * A conta em português, para pôr num documento ou explicar a uma família.
 *
 * Isto existe porque a pergunta que a direção mais ouve é «porque é que ele
 * está à frente da minha mãe?», e a resposta não pode ser um número.
 */
export function porExtenso(p: Pontuacao): string {
  const ditas = p.linhas
    .filter(l => l.subtotal > 0)
    .sort((a, b) => b.subtotal - a.subtotal)
    .map(l => `${l.criterio.nome.toLowerCase()}: ${l.opcao?.rotulo.toLowerCase()} (${l.pontos}×${l.peso}=${l.subtotal})`)
  if (!ditas.length) return 'Nenhum critério pontuou.'
  const falta = p.porResponder ? ` Faltam ${p.porResponder} resposta${p.porResponder > 1 ? 's' : ''}.` : ''
  return `${p.total} de ${p.maximo} pontos — ${ditas.join('; ')}.${falta}`
}

// ── Os estados de uma candidatura ────────────────────────────────────────────

export const ESTADOS = [
  { id: 'em_espera', rotulo: 'Em espera',  cor: '#2563eb', conta: true },
  { id: 'admitido',  rotulo: 'Admitido',   cor: '#16a34a', conta: false },
  { id: 'suspenso',  rotulo: 'Suspensa',   cor: '#d97706', conta: false },
  { id: 'desistiu',  rotulo: 'Desistiu',   cor: '#64748b', conta: false },
  { id: 'recusado',  rotulo: 'Não aceite', cor: '#64748b', conta: false },
] as const

export type Estado = typeof ESTADOS[number]['id']

export const estadoDe = (id?: string | null) =>
  ESTADOS.find(e => e.id === id) || ESTADOS[0]

export const VALENCIAS = [
  { id: 'lar',                rotulo: 'Estrutura residencial (lar)' },
  { id: 'centro_dia',         rotulo: 'Centro de dia' },
  { id: 'apoio_domiciliario', rotulo: 'Apoio domiciliário' },
  { id: 'outra',              rotulo: 'Outra' },
] as const
