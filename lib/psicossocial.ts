// lib/psicossocial.ts
// ═══════════════════════════════════════════════════════════════════════════
// O TRABALHO DA PSICÓLOGA: os instrumentos, as sessões, e quem está sozinho
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO ───────────────────────────────────────────────────────────────
// «Se calhar a parte que os idosos mais sofrem é com problemas derivados de
//  isolamento, tristeza, etc. O trabalho da psicóloga no centro de dia e lares
//  deve de ser facilitado com o Phlox.» (Fernando)
//
// ── PORQUE É QUE O ISOLAMENTO É CALCULADO E NÃO PERGUNTADO ─────────────────
// Porque ninguém diz que está sozinho. Perguntar «sente-se sozinho?» a uma
// pessoa de 86 anos que foi criada a não se queixar devolve «não, não senhora»
// em nove casos de cada dez.
//
// O que não mente é quem aparece. A casa já regista as visitas, as mensagens
// das famílias e a participação nas atividades — e dessas três sai uma
// resposta mais honesta do que a pergunta.
//
// Isto NÃO é um diagnóstico e não se parece com um. É uma LISTA DE QUEM VER:
// a psicóloga olha, reconhece metade dos nomes, e fica a saber os outros dois
// que lhe tinham passado ao lado. É para isso e para mais nada.

import { ptDate } from './ptTime'

// ═══════════════════════════════════════════════════════════════════════════
// AS SESSÕES
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeSessao =
  | 'individual' | 'grupo' | 'familia' | 'observacao' | 'telefone' | 'informal'

export const TIPOS_DE_SESSAO: {
  id: TipoDeSessao; rotulo: string; oQue: string; codigo: string
}[] = [
  { id: 'individual', rotulo: 'Individual', codigo: 'IND',
    oQue: 'A sós com a pessoa, com hora marcada.' },
  { id: 'grupo', rotulo: 'Grupo', codigo: 'GRP',
    oQue: 'Sessão de grupo — regista-se em cada participante.' },
  { id: 'familia', rotulo: 'Com a família', codigo: 'FAM',
    oQue: 'Com os filhos, o cônjuge ou quem decide.' },
  { id: 'observacao', rotulo: 'Observação', codigo: 'OBS',
    oQue: 'Ver sem intervir: à mesa, na sala, numa atividade.' },
  { id: 'telefone', rotulo: 'Telefone', codigo: 'TEL',
    oQue: 'Contacto telefónico, com a pessoa ou com a família.' },
  /* A conversa de corredor CONTA. É onde muita coisa aparece primeiro, e sem
     um sítio para a pôr ou se perde ou é registada como sessão individual —
     que depois dá um relatório com trinta sessões de cinquenta minutos que
     nunca aconteceram. */
  { id: 'informal', rotulo: 'Conversa informal', codigo: 'INF',
    oQue: 'De passagem, sem marcação. Conta, e não é uma sessão.' },
]

export const tipoDeSessao = (id: string) =>
  TIPOS_DE_SESSAO.find(t => t.id === id) || TIPOS_DE_SESSAO[0]

/** Como a pessoa estava. Cinco valores, um toque cada. */
export const HUMOR: { valor: number; rotulo: string; cor: string }[] = [
  { valor: 1, rotulo: 'Muito em baixo', cor: 'var(--red)' },
  { valor: 2, rotulo: 'Em baixo', cor: 'var(--amber)' },
  { valor: 3, rotulo: 'Como habitualmente', cor: 'var(--ink-3)' },
  { valor: 4, rotulo: 'Bem', cor: 'var(--green)' },
  { valor: 5, rotulo: 'Muito bem', cor: 'var(--green)' },
]

// ═══════════════════════════════════════════════════════════════════════════
// OS INSTRUMENTOS
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE ESTES SÃO, E O QUE NÃO SÃO ───────────────────────────────────────
// São instrumentos de RASTREIO, publicados e validados, que se aplicam em
// cinco minutos e dizem se vale a pena olhar melhor. Nenhum deles diagnostica
// nada, e a interface diz isso em cada resultado.
//
// Estão aqui porque a alternativa é o que acontece hoje em muitas casas: a
// escala é aplicada numa folha fotocopiada, o total é escrito à mão num
// dossier, e no ano seguinte ninguém encontra a primeira para comparar.

export interface ItemDeInstrumento {
  id: string
  texto: string
  /**
   * Qual das duas respostas conta um ponto.
   *
   * Na GDS-15 metade dos itens pontuam ao SIM e metade ao NÃO — é assim de
   * propósito, para quem responde não poder dizer «sim» a tudo sem pensar.
   * Inverter um item por engano é o erro clássico desta escala, e é por isso
   * que isto é um campo e não uma convenção.
   */
  pontuaAo: 'sim' | 'nao'
}

export interface Instrumento {
  id: string
  nome: string
  sigla: string
  /** O que mede, numa frase. */
  oQue: string
  /** De onde vem. Uma escala sem proveniência não se usa num processo. */
  fonte: string
  itens: ItemDeInstrumento[]
  max: number
  /** Os pontos de corte, do melhor para o pior. */
  cortes: { ate: number; rotulo: string; cor: string; oQueFazer: string }[]
  /** O que NUNCA se pode concluir disto. Vai no ecrã, sempre. */
  limite: string
}

/**
 * GDS-15 — Escala de Depressão Geriátrica, forma curta.
 *
 * ── PORQUE É QUE É ESTA ────────────────────────────────────────────────────
 * É a mais usada em lares portugueses, está validada para português (Apóstolo
 * e col.), é de uso livre, e responde-se com sim/não — o que importa muito
 * com pessoas que se cansam depressa ou têm dificuldade com escalas de 1 a 5.
 *
 * As perguntas referem-se à ÚLTIMA SEMANA. Quem a aplica tem de o dizer em voz
 * alta, e por isso está escrito no ecrã.
 */
export const GDS15: Instrumento = {
  id: 'gds15',
  nome: 'Escala de Depressão Geriátrica (forma curta)',
  sigla: 'GDS-15',
  oQue: 'Rastreio de sintomas depressivos em pessoas idosas.',
  fonte: 'Yesavage & Sheikh (1986), versão portuguesa de Apóstolo e col. Uso livre.',
  max: 15,
  limite:
    'É um rastreio, não um diagnóstico. Uma pontuação alta quer dizer «vale a '
    + 'pena olhar com atenção», e nada mais — há luto, dor crónica e efeitos de '
    + 'medicação que a fazem subir sem haver depressão. Quem diagnostica é quem '
    + 'tem competência para o fazer.',
  itens: [
    { id: 'g1',  texto: 'Está satisfeito(a) com a sua vida?', pontuaAo: 'nao' },
    { id: 'g2',  texto: 'Abandonou muitas das suas atividades e interesses?', pontuaAo: 'sim' },
    { id: 'g3',  texto: 'Sente que a sua vida está vazia?', pontuaAo: 'sim' },
    { id: 'g4',  texto: 'Aborrece-se com frequência?', pontuaAo: 'sim' },
    { id: 'g5',  texto: 'Está bem-disposto(a) a maior parte do tempo?', pontuaAo: 'nao' },
    { id: 'g6',  texto: 'Tem medo que lhe vá acontecer alguma coisa má?', pontuaAo: 'sim' },
    { id: 'g7',  texto: 'Sente-se feliz a maior parte do tempo?', pontuaAo: 'nao' },
    { id: 'g8',  texto: 'Sente-se frequentemente desamparado(a)?', pontuaAo: 'sim' },
    { id: 'g9',  texto: 'Prefere ficar em casa a sair e fazer coisas novas?', pontuaAo: 'sim' },
    { id: 'g10', texto: 'Sente que tem mais problemas de memória do que a maioria das pessoas?', pontuaAo: 'sim' },
    { id: 'g11', texto: 'Acha que é maravilhoso estar vivo(a)?', pontuaAo: 'nao' },
    { id: 'g12', texto: 'Sente-se inútil nas condições em que está?', pontuaAo: 'sim' },
    { id: 'g13', texto: 'Sente-se cheio(a) de energia?', pontuaAo: 'nao' },
    { id: 'g14', texto: 'Sente que a sua situação é desesperada?', pontuaAo: 'sim' },
    { id: 'g15', texto: 'Acha que a maioria das pessoas está melhor do que si?', pontuaAo: 'sim' },
  ],
  cortes: [
    { ate: 4, rotulo: 'Sem indicação de depressão', cor: 'var(--green)',
      oQueFazer: 'Nada a assinalar neste rastreio. Repetir daqui a seis meses ou se algo mudar.' },
    { ate: 9, rotulo: 'Sintomas depressivos ligeiros a moderados', cor: 'var(--amber)',
      oQueFazer: 'Vale a pena acompanhar de perto e perceber o que mudou. Falar com quem prescreve se persistir.' },
    { ate: 15, rotulo: 'Sintomas depressivos marcados', cor: 'var(--red)',
      oQueFazer: 'Encaminhar. Falar com o médico assistente e com a família, e registar o que ficou combinado.' },
  ],
}

/**
 * Escala de Solidão — versão curta de três itens.
 *
 * ── PORQUE É QUE ISTO MERECE UMA ESCALA PRÓPRIA ────────────────────────────
 * Porque solidão e depressão não são a mesma coisa, e a GDS não as separa. Há
 * quem esteja sozinho e não deprimido, e há quem esteja rodeado de gente e
 * profundamente só. A intervenção é diferente nos dois casos: a um leva-se a
 * uma atividade de grupo, ao outro não.
 *
 * Três perguntas porque é o que uma pessoa cansada responde sem desistir.
 */
export const SOLIDAO: Instrumento = {
  id: 'solidao3',
  nome: 'Escala de solidão — três itens',
  sigla: 'Solidão',
  oQue: 'Distingue estar só de sentir-se só.',
  fonte: 'Hughes e col. (2004), adaptação da UCLA Loneliness Scale. Uso livre.',
  max: 3,
  limite:
    'Mede o que a pessoa SENTE, não com quantas pessoas fala. Alguém com visitas '
    + 'todas as semanas pode pontuar alto, e isso não é um erro da escala — é a '
    + 'informação.',
  itens: [
    { id: 's1', texto: 'Sente falta de ter companhia?', pontuaAo: 'sim' },
    { id: 's2', texto: 'Sente-se posto(a) de parte?', pontuaAo: 'sim' },
    { id: 's3', texto: 'Sente-se isolado(a) dos outros?', pontuaAo: 'sim' },
  ],
  cortes: [
    { ate: 0, rotulo: 'Não refere solidão', cor: 'var(--green)',
      oQueFazer: 'Nada a assinalar.' },
    { ate: 1, rotulo: 'Alguma solidão', cor: 'var(--amber)',
      oQueFazer: 'Vale a pena perceber em que momentos — muitas vezes é ao fim do dia ou ao fim de semana.' },
    { ate: 3, rotulo: 'Solidão marcada', cor: 'var(--red)',
      oQueFazer: 'Trabalhar a rede de apoio: quem pode vir, quem pode telefonar, que grupo faz sentido.' },
  ],
}

export const INSTRUMENTOS: Instrumento[] = [GDS15, SOLIDAO]
export const instrumentoPorId = (id: string) => INSTRUMENTOS.find(i => i.id === id)

/** A pontuação de um conjunto de respostas. `null` onde não respondeu. */
export function pontuar(
  inst: Instrumento, respostas: Record<string, boolean | null | undefined>,
): { pontos: number; respondidas: number; completo: boolean } {
  let pontos = 0
  let respondidas = 0
  for (const item of inst.itens) {
    const r = respostas[item.id]
    if (r === null || r === undefined) continue
    respondidas++
    const conta = item.pontuaAo === 'sim' ? r === true : r === false
    if (conta) pontos++
  }
  return { pontos, respondidas, completo: respondidas === inst.itens.length }
}

/** O corte em que uma pontuação cai. */
export function interpretar(inst: Instrumento, pontos: number) {
  return inst.cortes.find(c => pontos <= c.ate) || inst.cortes[inst.cortes.length - 1]
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEM ESTÁ SOZINHO
// ═══════════════════════════════════════════════════════════════════════════

export interface SinalDeIsolamento {
  patientId: string
  nome: string
  /** 0 a 100. Não é uma pontuação clínica — é uma ordem por que olhar. */
  peso: number
  /** As razões, em palavras. Nunca um número sozinho. */
  razoes: string[]
  /** Dias desde a última visita. null = nunca houve nenhuma registada. */
  diasSemVisita: number | null
  /** Dias desde a última mensagem da família. */
  diasSemFamilia: number | null
  /** Participou em quantas atividades nos últimos 30 dias. */
  atividades: number
}

const diasEntre = (a: string, b: string): number => {
  const x = new Date(a + 'T12:00:00').getTime()
  const y = new Date(b + 'T12:00:00').getTime()
  return Math.round((y - x) / 86400000)
}

/**
 * Quem vale a pena ver, por ordem.
 *
 * ── A REGRA QUE ISTO SEGUE ─────────────────────────────────────────────────
 * Cada sinal vale pontos, e os pontos somam-se — mas o que a interface mostra
 * são as RAZÕES, não a soma. O número existe só para ordenar a lista; mostrá-lo
 * convidava a tratá-lo como uma medida, e não é.
 *
 * ── E O QUE ISTO NÃO FAZ ───────────────────────────────────────────────────
 * Não diz que alguém está deprimido, não cria notas sozinho, e não avisa a
 * família. Faz uma lista. A psicóloga é que decide.
 */
export function quemEstaSozinho(
  pessoas: { id: string; name: string }[],
  visitas: { patient_id: string; requested_date: string; status?: string | null }[],
  mensagens: { patient_id: string; created_at: string }[],
  /* Só as participações COM presença e dos últimos 30 dias — a filtragem é de
     quem chama, porque a `activity_participations` não tem data: a data está
     na atividade, e juntá-las aqui obrigava esta função a saber ler da base de
     dados. Ela não lê nada; recebe e conta. */
  participacoes: { patient_id: string }[],
  hoje = ptDate(),
): SinalDeIsolamento[] {
  const ultimaVisita = new Map<string, string>()
  for (const v of visitas) {
    if (v.status === 'declined' || v.status === 'cancelled') continue
    if (!v.requested_date || v.requested_date > hoje) continue   // as futuras não contam
    const atual = ultimaVisita.get(v.patient_id)
    if (!atual || v.requested_date > atual) ultimaVisita.set(v.patient_id, v.requested_date)
  }

  const ultimaFamilia = new Map<string, string>()
  for (const m of mensagens) {
    const d = String(m.created_at || '').slice(0, 10)
    if (!d) continue
    const atual = ultimaFamilia.get(m.patient_id)
    if (!atual || d > atual) ultimaFamilia.set(m.patient_id, d)
  }

  const quantasAtividades = new Map<string, number>()
  for (const p of participacoes) {
    quantasAtividades.set(p.patient_id, (quantasAtividades.get(p.patient_id) || 0) + 1)
  }

  const saida: SinalDeIsolamento[] = []
  for (const p of pessoas) {
    const v = ultimaVisita.get(p.id)
    const f = ultimaFamilia.get(p.id)
    const dv = v ? diasEntre(v, hoje) : null
    const df = f ? diasEntre(f, hoje) : null
    const ativ = quantasAtividades.get(p.id) || 0

    const razoes: string[] = []
    let peso = 0

    /* NUNCA uma visita registada pesa mais do que uma visita há muito tempo —
       e é um caso diferente: ou a pessoa não tem mesmo ninguém, ou a casa não
       está a registar as visitas. As duas coisas merecem ser vistas, e a
       segunda é um problema da casa e não da pessoa. */
    if (dv === null) { peso += 40; razoes.push('Sem nenhuma visita registada') }
    else if (dv >= 60) { peso += 35; razoes.push(`Sem visitas há ${dv} dias`) }
    else if (dv >= 30) { peso += 20; razoes.push(`Sem visitas há ${dv} dias`) }

    if (df === null) { peso += 15; razoes.push('A família nunca escreveu') }
    else if (df >= 45) { peso += 12; razoes.push(`A família não escreve há ${df} dias`) }

    if (ativ === 0) { peso += 25; razoes.push('Não participou em nenhuma atividade no último mês') }
    else if (ativ <= 2) { peso += 10; razoes.push(`Participou em ${ativ} ${ativ === 1 ? 'atividade' : 'atividades'} no último mês`) }

    // Sem razão nenhuma não entra na lista. Uma lista com toda a gente lá
    // dentro é uma lista que não se lê.
    if (!razoes.length) continue
    saida.push({
      patientId: p.id, nome: p.name, peso: Math.min(100, peso), razoes,
      diasSemVisita: dv, diasSemFamilia: df, atividades: ativ,
    })
  }

  return saida.sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome, 'pt'))
}

/** Erro de tabela em falta — o sinal de que o sprint186 ainda não correu. */
export function semTabelaPsi(erro: any): boolean {
  const m = String(erro?.message || erro || '')
  return /psi_(processo|sessoes|instrumentos)/i.test(m)
    && /does not exist|schema cache/i.test(m)
}
