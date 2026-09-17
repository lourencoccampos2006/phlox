// lib/sujeitos.ts
// ─────────────────────────────────────────────────────────────────────────────
// De quem é este documento?
//
// ── O PROBLEMA ─────────────────────────────────────────────────────────────
// Alguém pede para explicar um relatório que não é seu. É o uso normal da
// ferramenta, não a exceção: encontra-se uma pessoa com um papel na mão que
// não percebe, fotografa-se, explica-se. Não se vai criar um perfil para uma
// pessoa que se vê uma vez.
//
// Mas se tudo cair no mesmo saco, a memória fica inútil — pior do que inútil,
// fica errada. As análises de um vizinho passam a informar os conselhos dados
// sobre o próprio, e daí sai disparate com ar de rigor.
//
// ── A SOLUÇÃO ──────────────────────────────────────────────────────────────
// Documentos oficiais de saúde trazem quase sempre o nome. A IA lê-o, e aqui
// decide-se a que "sujeito" pertence: o próprio, um perfil que a pessoa já
// acompanha, alguém de quem já se leram documentos antes, ou uma pessoa nova.
// Cada sujeito tem a SUA memória. Os documentos de passagem ficam guardados
// mas não contaminam ninguém.
//
// ── PORQUE É QUE ISTO É DETERMINÍSTICO ─────────────────────────────────────
// A IA lê o nome; quem decide se "Maria S. Costa" e "Maria Silva Costa" são a
// mesma pessoa é este ficheiro. Deixar essa decisão ao modelo seria deixá-la
// mudar de opinião entre chamadas — e uma memória que junta e separa pessoas
// ao acaso é o pior resultado possível. Aqui é sempre a mesma resposta, e dá
// para testar (scripts/teste-sujeitos.mjs).
// ─────────────────────────────────────────────────────────────────────────────

/** Partículas que não distinguem ninguém. "Maria de Sousa" e "Maria Sousa"
 *  são a mesma pessoa em qualquer registo português. */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di', 'van', 'von', 'la', 'le'])

/** Títulos e tratamentos que aparecem colados ao nome nos documentos. */
const TRATAMENTOS = new Set([
  'sr', 'sra', 'srª', 'senhor', 'senhora', 'dr', 'dra', 'drª', 'doutor', 'doutora',
  'prof', 'professor', 'professora', 'enf', 'enfermeiro', 'enfermeira',
  'exmo', 'exma', 'utente', 'doente', 'paciente', 'nome',
])

/** Sem acentos, sem maiúsculas, sem pontuação. */
export function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Os pedaços que interessam de um nome, já limpos.
 *
 *  Tira tratamentos, partículas e tudo o que não seja letra. O que sobra são
 *  os nomes próprios e apelidos — que é o que se compara. */
export function pedacosDoNome(nome: string): string[] {
  return semAcentos(String(nome || ''))
    .toLowerCase()
    // O numero de utente vem quase sempre entre parentesis a seguir ao nome.
    // Sem isto, "Ana Pereira (n.o 4821)" e "Ana Pereira" davam duas fichas.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z\s.]/g, ' ')          // o ponto fica: distingue "m." de "m"
    .split(/\s+/)
    .map(p => p.replace(/\.+$/, match => (match ? '.' : '')))   // "maria.." → "maria."
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !TRATAMENTOS.has(p.replace(/\./g, '')))
    .filter(p => !PARTICULAS.has(p))
    .filter(p => p !== '.')
}

/** A chave de um nome: o que se usa para o `unique` na base de dados.
 *  "Dr. João  da   SILVA " e "joao silva" dão a mesma chave. */
export function chaveDoNome(nome: string): string {
  return pedacosDoNome(nome).map(p => p.replace(/\./g, '')).join(' ')
}

/** Um pedaço é uma inicial ("m." ou "m") do outro? */
function ehInicialDe(curto: string, longo: string): boolean {
  const c = curto.replace(/\./g, '')
  return c.length === 1 && longo.startsWith(c)
}

function pedacosIguais(a: string, b: string): boolean {
  if (a === b) return true
  const na = a.replace(/\./g, ''), nb = b.replace(/\./g, '')
  if (na === nb) return true
  return ehInicialDe(a, nb) || ehInicialDe(b, na)
}

export type ConfiancaNome = 'certa' | 'provavel' | 'nenhuma'

export interface ComparacaoNome {
  confianca: ConfiancaNome
  porque: string
}

/** São a mesma pessoa?
 *
 *  Três respostas, não duas. O "provável" existe porque é honesto: "Maria
 *  Costa" num papel e "Maria Silva Costa" noutro são quase de certeza a mesma
 *  pessoa, mas quase não é certeza — e nesse caso pergunta-se, em vez de
 *  juntar duas pessoas em silêncio. */
export function compararNomes(a: string, b: string): ComparacaoNome {
  const pa = pedacosDoNome(a)
  const pb = pedacosDoNome(b)
  if (!pa.length || !pb.length) return { confianca: 'nenhuma', porque: 'falta o nome' }

  if (chaveDoNome(a) === chaveDoNome(b)) return { confianca: 'certa', porque: 'o nome é o mesmo' }

  // Um nome só ("Maria") nunca chega para decidir. Há muitas Marias, e juntar
  // documentos de duas pessoas diferentes é o erro que não se desfaz.
  if (pa.length < 2 || pb.length < 2) return { confianca: 'nenhuma', porque: 'só há um nome, não chega' }

  const primeiroIgual = pedacosIguais(pa[0], pb[0])
  const ultimoIgual = pedacosIguais(pa[pa.length - 1], pb[pb.length - 1])

  // Primeiro nome e último apelido iguais é o padrão do dia a dia: as pessoas
  // escrevem-se por extenso num sítio e abreviadas noutro, mas as pontas ficam.
  if (primeiroIgual && ultimoIgual) {
    const curto = pa.length <= pb.length ? pa : pb
    const longo = pa.length <= pb.length ? pb : pa

    // O nome curto cabe todo dentro do longo, pela mesma ordem?
    let i = 0
    for (const p of longo) { if (i < curto.length && pedacosIguais(curto[i], p)) i++ }
    const cabeTodo = i === curto.length

    // Iniciais a sério ("M. S. Costa") contam como certeza quando tudo encaixa.
    // O `meio.length > 0` não é detalhe: sem ele, "Maria Costa" (que não tem
    // meio nenhum) passava por abreviatura de "Maria Silva Costa" e as duas
    // eram dadas como a MESMA pessoa com certeza. Faltar o meio não é abreviar
    // o meio — é não saber o meio, e isso é "provável".
    const meio = curto.slice(1, -1)
    const soIniciais = meio.length > 0 && meio.every(p => p.replace(/\./g, '').length === 1)

    if (cabeTodo && (curto.length === longo.length || soIniciais)) {
      return { confianca: 'certa', porque: 'o nome é o mesmo, escrito de forma abreviada' }
    }
    if (cabeTodo) return { confianca: 'provavel', porque: 'o primeiro nome e o apelido coincidem' }
    return { confianca: 'provavel', porque: 'o primeiro nome e o apelido coincidem, o meio não' }
  }

  // Duas pontas diferentes com o meio igual não chega: "Ana Maria Costa" e
  // "João Maria Costa" são irmãos, não a mesma pessoa.
  return { confianca: 'nenhuma', porque: 'os nomes não coincidem' }
}

export interface SujeitoConhecido {
  id: string
  nome: string
  grafias?: string[] | null
  relacao?: string | null
}

export interface EscolhaDeSujeito {
  sujeito: SujeitoConhecido | null
  confianca: ConfiancaNome
  porque: string
  /** Mais do que um candidato provável: aí não se escolhe, pergunta-se. */
  ambiguo: boolean
}

/** A quem pertence este nome, dentro dos que já conhecemos.
 *
 *  Compara também com as grafias já vistas de cada sujeito: uma pessoa cujo
 *  nome apareceu uma vez por extenso e outra abreviado passa a ser reconhecida
 *  pelas duas formas, sem voltar a perguntar. */
export function escolherSujeito(nome: string, conhecidos: SujeitoConhecido[]): EscolhaDeSujeito {
  if (!String(nome || '').trim()) {
    return { sujeito: null, confianca: 'nenhuma', porque: 'o documento não traz nome', ambiguo: false }
  }

  const certos: { s: SujeitoConhecido; porque: string }[] = []
  const provaveis: { s: SujeitoConhecido; porque: string }[] = []

  for (const s of conhecidos) {
    const formas = [s.nome, ...(s.grafias || [])].filter(Boolean)
    let melhor: ComparacaoNome = { confianca: 'nenhuma', porque: '' }
    for (const forma of formas) {
      const c = compararNomes(nome, forma)
      if (c.confianca === 'certa') { melhor = c; break }
      if (c.confianca === 'provavel' && melhor.confianca === 'nenhuma') melhor = c
    }
    if (melhor.confianca === 'certa') certos.push({ s, porque: melhor.porque })
    else if (melhor.confianca === 'provavel') provaveis.push({ s, porque: melhor.porque })
  }

  // Dois "certos" quer dizer que já há duas fichas da mesma pessoa. Fica-se
  // pela primeira — juntá-las é trabalho para quem as vê, não para aqui.
  if (certos.length) return { sujeito: certos[0].s, confianca: 'certa', porque: certos[0].porque, ambiguo: certos.length > 1 }

  if (provaveis.length === 1) {
    return { sujeito: provaveis[0].s, confianca: 'provavel', porque: provaveis[0].porque, ambiguo: false }
  }
  if (provaveis.length > 1) {
    // Vários parecidos: não se adivinha. Guarda-se à parte e pergunta-se.
    return { sujeito: null, confianca: 'nenhuma', porque: 'há mais do que uma pessoa parecida', ambiguo: true }
  }
  return { sujeito: null, confianca: 'nenhuma', porque: 'é a primeira vez que aparece este nome', ambiguo: false }
}

/** Como se mostra um nome na interface: "Maria Silva Costa" → "Maria Costa".
 *  Curto o suficiente para caber numa linha e longo o suficiente para se
 *  perceber de quem se fala. */
export function nomeCurto(nome: string): string {
  const cru = String(nome || '').trim().replace(/\s+/g, ' ')
  if (!cru) return ''
  const partes = cru.split(' ').filter(p => !PARTICULAS.has(semAcentos(p).toLowerCase()))
  if (partes.length <= 2) return partes.join(' ')
  return `${partes[0]} ${partes[partes.length - 1]}`
}

/** Junta uma grafia nova às já vistas, sem repetir e sem crescer para sempre. */
export function juntarGrafia(grafias: string[] | null | undefined, nova: string): string[] {
  const lista = (grafias || []).filter(Boolean)
  const chave = chaveDoNome(nova)
  if (!chave) return lista
  if (lista.some(g => chaveDoNome(g) === chave)) return lista
  return [...lista, String(nova).trim()].slice(-8)
}
