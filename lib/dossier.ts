// lib/dossier.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que o Phlox sabe sobre uma pessoa.
//
// ── A DIFERENÇA ENTRE GUARDAR E SABER ──────────────────────────────────────
// Guardar documentos não é memória. Uma pilha de análises em PDF é exatamente
// tão útil como a gaveta onde já estão hoje. Memória é o que sobra depois de
// os ler: que condições existem, o que se toma, como é que os valores se
// mexeram, o que aconteceu e quando.
//
// É isso que este ficheiro mantém — um dossier por pessoa (ver lib/sujeitos),
// destilado dos documentos, que volta a entrar no pedido seguinte. Sem isto, a
// décima análise é lida com a mesma ignorância da primeira.
//
// ── PORQUE É QUE A JUNÇÃO É DETERMINÍSTICA ─────────────────────────────────
// A IA lê o documento e diz o que aprendeu. Quem decide como é que isso se
// junta ao que já lá estava é este ficheiro, com regras fixas. Se fosse o
// modelo a reescrever o dossier todo de cada vez, cada leitura era uma
// oportunidade de perder ou inventar uma condição — e ao fim de dez leituras
// o dossier era ficção. Aqui, o que entra nunca apaga o que já lá está por
// acidente: só muda de estado quando o documento o disser.
//
// ── E O TAMANHO ────────────────────────────────────────────────────────────
// Um dossier que cresce para sempre acaba maior do que o que cabe num pedido à
// IA, e nesse dia começa a ser cortado ao calhas — pelo fim, que é a parte
// recente e mais importante. Por isso há limites em todo o lado, e são sempre
// a favor do que é recente.
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemDossier {
  nome: string
  /** Dose, contexto, o que for preciso para a linha fazer sentido sozinha. */
  detalhe?: string
  /** Quando começou, tal como aparecia no documento. */
  desde?: string
  estado?: 'ativo' | 'resolvido' | 'parado'
  /** O documento de onde veio, para se poder dizer porque é que sabemos isto. */
  fonte?: string
}

export interface ValorDossier {
  nome: string
  valor: string
  unidade?: string
  estado?: string          // normal | baixo | alto
  quando?: string
}

export interface Acontecimento {
  quando: string
  o_que: string
  fonte?: string
}

export interface RespostaGuardada {
  pergunta: string
  resposta: string
  quando: string
}

export interface PerguntaPendente {
  pergunta: string
  /** Porque é que vale a pena perguntar isto — mostra-se à pessoa. */
  porque?: string
  tipo?: 'sim_nao' | 'escolha' | 'aberta'
  opcoes?: string[]
}

export interface Dossier {
  condicoes: ItemDossier[]
  medicamentos: ItemDossier[]
  valores: ValorDossier[]
  acontecimentos: Acontecimento[]
  respostas: RespostaGuardada[]
  perguntasPendentes: PerguntaPendente[]
}

/** Factos que uma leitura trouxe. É o que a IA devolve em `factosNovos`. */
export interface FactosNovos {
  condicoes?: ItemDossier[]
  medicamentos?: ItemDossier[]
  valores?: ValorDossier[]
  acontecimentos?: Acontecimento[]
}

// Limites. A favor do recente, sempre.
const MAX_CONDICOES = 40
const MAX_MEDICAMENTOS = 40
const MAX_VALORES_POR_NOME = 8
const MAX_VALORES = 150
const MAX_ACONTECIMENTOS = 80
const MAX_RESPOSTAS = 60
const MAX_PENDENTES = 6

export function dossierVazio(): Dossier {
  return { condicoes: [], medicamentos: [], valores: [], acontecimentos: [], respostas: [], perguntasPendentes: [] }
}

function lista<T>(x: any): T[] { return Array.isArray(x) ? x.filter(Boolean) : [] }
function texto(x: any, max = 200): string { return String(x ?? '').trim().slice(0, max) }

/** Lê um dossier vindo da base de dados sem confiar em nada. O `jsonb` pode
 *  ter sido escrito por uma versão anterior, ou estar a meio. */
export function normalizarDossier(cru: any): Dossier {
  const d = cru && typeof cru === 'object' ? cru : {}
  return {
    condicoes: lista<ItemDossier>(d.condicoes),
    medicamentos: lista<ItemDossier>(d.medicamentos),
    valores: lista<ValorDossier>(d.valores),
    acontecimentos: lista<Acontecimento>(d.acontecimentos),
    respostas: lista<RespostaGuardada>(d.respostas),
    perguntasPendentes: lista<PerguntaPendente>(d.perguntasPendentes),
  }
}

function chave(s: string): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Uma data comparável a partir do que vier escrito no documento.
 *  Aceita "2026-11-14", "14/11/2026" e devolve 0 quando não percebe — o que
 *  põe o item no fim da ordenação, que é onde deve ficar o que não tem data. */
function quando(valor?: string): number {
  const s = String(valor || '').trim()
  if (!s) return 0
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
  const pt = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/)
  if (pt) return Date.UTC(+pt[3], +pt[2] - 1, +pt[1])
  const ano = s.match(/\b(19|20)\d{2}\b/)
  if (ano) return Date.UTC(+ano[0], 0, 1)
  return 0
}

function juntarItens(atuais: ItemDossier[], novos: ItemDossier[], fonte: string, limite: number): ItemDossier[] {
  const porChave = new Map<string, ItemDossier>()
  for (const it of atuais) { if (it?.nome) porChave.set(chave(it.nome), { ...it }) }

  for (const novo of novos) {
    const nome = texto(novo?.nome, 120)
    if (!nome) continue
    const k = chave(nome)
    const antes = porChave.get(k)
    if (!antes) {
      porChave.set(k, {
        nome,
        detalhe: texto(novo.detalhe) || undefined,
        desde: texto(novo.desde, 40) || undefined,
        estado: novo.estado || 'ativo',
        fonte: fonte || undefined,
      })
      continue
    }
    // Já se conhecia. Atualiza-se o que o documento novo diz, sem apagar o que
    // ele não menciona — um relatório que fala da tensão não é prova de que a
    // diabetes acabou.
    porChave.set(k, {
      ...antes,
      detalhe: texto(novo.detalhe) || antes.detalhe,
      // A data mais antiga é a que interessa: é quando aquilo começou.
      desde: antes.desde && (!novo.desde || quando(antes.desde) <= quando(novo.desde))
        ? antes.desde : (texto(novo.desde, 40) || antes.desde),
      estado: novo.estado || antes.estado,
      fonte: fonte || antes.fonte,
    })
  }

  // O que está ativo vem primeiro: é o que importa para ler o documento seguinte.
  const todos = [...porChave.values()]
  const ativos = todos.filter(i => i.estado !== 'resolvido' && i.estado !== 'parado')
  const passados = todos.filter(i => i.estado === 'resolvido' || i.estado === 'parado')
  return [...ativos, ...passados].slice(0, limite)
}

function juntarValores(atuais: ValorDossier[], novos: ValorDossier[], dataDoDoc: string): ValorDossier[] {
  const todos = [...atuais]
  for (const v of novos) {
    const nome = texto(v?.nome, 90)
    const valor = texto(v?.valor, 40)
    if (!nome || !valor) continue
    const q = texto(v.quando, 40) || dataDoDoc
    // O mesmo valor, do mesmo dia, não se guarda duas vezes: relê-se o mesmo
    // documento e a série ficava com duplicados a fingir de evolução.
    if (todos.some(x => chave(x.nome) === chave(nome) && x.valor === valor && (x.quando || '') === q)) continue
    todos.push({ nome, valor, unidade: texto(v.unidade, 20) || undefined, estado: texto(v.estado, 20) || undefined, quando: q || undefined })
  }

  // Por nome, guardam-se os mais recentes. Uma série de colesterol com oito
  // pontos conta a história; com oitenta só ocupa espaço.
  const porNome = new Map<string, ValorDossier[]>()
  for (const v of todos) {
    const k = chave(v.nome)
    if (!porNome.has(k)) porNome.set(k, [])
    porNome.get(k)!.push(v)
  }
  const podados: ValorDossier[] = []
  for (const serie of porNome.values()) {
    serie.sort((a, b) => quando(b.quando) - quando(a.quando))
    podados.push(...serie.slice(0, MAX_VALORES_POR_NOME))
  }
  podados.sort((a, b) => quando(b.quando) - quando(a.quando))
  return podados.slice(0, MAX_VALORES)
}

function juntarAcontecimentos(atuais: Acontecimento[], novos: Acontecimento[], fonte: string): Acontecimento[] {
  const todos = [...atuais]
  for (const a of novos) {
    const o_que = texto(a?.o_que, 200)
    if (!o_que) continue
    const qd = texto(a.quando, 40)
    if (todos.some(x => (x.quando || '') === qd && chave(x.o_que).slice(0, 40) === chave(o_que).slice(0, 40))) continue
    todos.push({ quando: qd, o_que, fonte: fonte || undefined })
  }
  todos.sort((a, b) => quando(b.quando) - quando(a.quando))
  return todos.slice(0, MAX_ACONTECIMENTOS)
}

export interface ContextoDaLeitura {
  /** O título do documento, para se saber de onde veio cada facto. */
  fonte?: string
  /** A data do documento, quando se sabe. Serve de data aos valores sem data. */
  data?: string
  /** As perguntas que a IA sugeriu desta vez. */
  perguntas?: PerguntaPendente[]
}

/** Junta ao dossier o que uma leitura trouxe. Nunca apaga; só acrescenta e
 *  atualiza o que o documento novo menciona. */
export function juntarFactos(atual: Dossier, factos: FactosNovos | null | undefined, ctx: ContextoDaLeitura = {}): Dossier {
  const d = normalizarDossier(atual)
  const f = factos || {}
  const fonte = texto(ctx.fonte, 120)
  const data = texto(ctx.data, 40)

  const seguinte: Dossier = {
    condicoes: juntarItens(d.condicoes, lista<ItemDossier>(f.condicoes), fonte, MAX_CONDICOES),
    medicamentos: juntarItens(d.medicamentos, lista<ItemDossier>(f.medicamentos), fonte, MAX_MEDICAMENTOS),
    valores: juntarValores(d.valores, lista<ValorDossier>(f.valores), data),
    acontecimentos: juntarAcontecimentos(d.acontecimentos, lista<Acontecimento>(f.acontecimentos), fonte),
    respostas: d.respostas,
    perguntasPendentes: d.perguntasPendentes,
  }

  if (ctx.perguntas) {
    // As perguntas novas substituem as pendentes, menos as que já foram
    // respondidas — voltar a perguntar o que a pessoa já disse é a maneira mais
    // rápida de a convencer de que isto não a ouve.
    const jaRespondidas = new Set(d.respostas.map(r => chave(r.pergunta)))
    seguinte.perguntasPendentes = lista<PerguntaPendente>(ctx.perguntas)
      .map(p => ({
        pergunta: texto(p?.pergunta, 200),
        porque: texto(p?.porque, 200) || undefined,
        tipo: p?.tipo || 'aberta',
        opcoes: Array.isArray(p?.opcoes) ? p.opcoes.map(o => texto(o, 60)).filter(Boolean).slice(0, 5) : undefined,
      }))
      .filter(p => p.pergunta && !jaRespondidas.has(chave(p.pergunta)))
      .slice(0, MAX_PENDENTES)
  }

  return seguinte
}

/** A pessoa respondeu a uma pergunta. Vale mais do que um documento: foi ela
 *  que o disse. */
export function guardarResposta(atual: Dossier, pergunta: string, resposta: string, quandoISO?: string): Dossier {
  const d = normalizarDossier(atual)
  const p = texto(pergunta, 200)
  const r = texto(resposta, 500)
  if (!p || !r) return d

  const k = chave(p)
  const respostas = [...d.respostas.filter(x => chave(x.pergunta) !== k), {
    pergunta: p, resposta: r, quando: quandoISO || new Date().toISOString().slice(0, 10),
  }].slice(-MAX_RESPOSTAS)

  return { ...d, respostas, perguntasPendentes: d.perguntasPendentes.filter(x => chave(x.pergunta) !== k) }
}

/** A pessoa dispensou a pergunta. Não se insiste. */
export function dispensarPergunta(atual: Dossier, pergunta: string): Dossier {
  const d = normalizarDossier(atual)
  const k = chave(pergunta)
  return { ...d, perguntasPendentes: d.perguntasPendentes.filter(x => chave(x.pergunta) !== k) }
}

export function dossierTemAlgo(d: Dossier | null | undefined): boolean {
  if (!d) return false
  const n = normalizarDossier(d)
  return !!(n.condicoes.length || n.medicamentos.length || n.valores.length || n.acontecimentos.length || n.respostas.length)
}

/** Quantas coisas se sabem — para dizer à pessoa, sem a obrigar a ler tudo. */
export function contarDossier(d: Dossier | null | undefined): number {
  const n = normalizarDossier(d)
  return n.condicoes.length + n.medicamentos.length + n.valores.length + n.acontecimentos.length + n.respostas.length
}

const LIMITE_RESUMO = 3200

/** O dossier escrito para entrar num pedido à IA.
 *
 *  Texto, não JSON: um modelo lê melhor uma lista em português do que um
 *  objeto, e ocupa menos. A ordem é a da utilidade — o que está ativo primeiro,
 *  os valores mais recentes primeiro, e no fim o que a própria pessoa disse,
 *  que vale mais do que qualquer papel. */
export function resumirParaIA(d: Dossier | null | undefined, nome: string, opts: { documentos?: number } = {}): string {
  const n = normalizarDossier(d)
  if (!dossierTemAlgo(n)) return ''

  const linhas: string[] = []
  const quantos = opts.documentos ? ` (${opts.documentos} ${opts.documentos === 1 ? 'documento lido' : 'documentos lidos'})` : ''
  linhas.push(`O QUE JÁ SE SABE SOBRE ${nome || 'esta pessoa'}${quantos}:`)

  const item = (i: ItemDossier) => [
    i.nome,
    i.detalhe ? ` ${i.detalhe}` : '',
    i.desde ? ` (desde ${i.desde})` : '',
    i.estado === 'resolvido' ? ' [resolvido]' : i.estado === 'parado' ? ' [já não toma]' : '',
  ].join('')

  if (n.condicoes.length) linhas.push(`Condições: ${n.condicoes.slice(0, 20).map(item).join('; ')}`)
  if (n.medicamentos.length) linhas.push(`Medicação: ${n.medicamentos.slice(0, 20).map(item).join('; ')}`)

  if (n.valores.length) {
    const v = n.valores.slice(0, 30)
      .map(x => `${x.nome} ${x.valor}${x.unidade ? ' ' + x.unidade : ''}${x.estado && x.estado !== 'normal' ? ` (${x.estado})` : ''}${x.quando ? ` em ${x.quando}` : ''}`)
    linhas.push(`Valores já vistos, do mais recente: ${v.join('; ')}`)
  }

  if (n.acontecimentos.length) {
    linhas.push(`O que foi acontecendo: ${n.acontecimentos.slice(0, 15).map(a => `${a.quando ? a.quando + ' — ' : ''}${a.o_que}`).join('; ')}`)
  }

  if (n.respostas.length) {
    // No fim e destacado: isto foi a pessoa que disse, e é mais fiável e mais
    // atual do que um relatório de há três meses.
    linhas.push(`A PRÓPRIA PESSOA DISSE (vale mais do que os documentos): ${n.respostas.slice(-12).map(r => `"${r.pergunta}" → "${r.resposta}" (${r.quando})`).join('; ')}`)
  }

  if (n.perguntasPendentes.length) {
    linhas.push(`Ficou por perguntar da última vez: ${n.perguntasPendentes.map(p => p.pergunta).join('; ')}`)
  }

  const texto = linhas.join('\n')
  return texto.length > LIMITE_RESUMO ? texto.slice(0, LIMITE_RESUMO) + '…' : texto
}
