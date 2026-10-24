// lib/direitoDeAcesso.ts
// ═══════════════════════════════════════════════════════════════════════════
// «QUERO TUDO O QUE VOCÊS TÊM SOBRE A MINHA MÃE» — ART. 15.º DO RGPD
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O PEDIDO QUE UMA CASA RECEBE MESMO ─────────────────────────────────────
// Uma filha escreve a pedir tudo o que a casa tem sobre a mãe. A casa tem um
// mês para responder (art. 12.º/3) e a resposta tem de ser completa: não é
// «aqui está a ficha», é tudo — medicação, registos, ocorrências, avaliações,
// notas da psicóloga, serviços, conta corrente.
//
// Sem ferramenta, alguém abre doze ecrãs, imprime o que lembra, e esquece-se
// de três. O que se esquece não aparece em lado nenhum a dizer que falta.
//
// ── O QUE JÁ EXISTIA, E PORQUE NÃO SERVIA ──────────────────────────────────
// A `/api/export-me` exporta os dados de UMA CONTA (`user_id`). Num lar isso
// é a conta de quem lá trabalha — o utente não tem conta nenhuma. E a lista
// de tabelas dela está escrita à mão: trinta e cinco nomes, vários da era da
// farmácia (`pcne_interventions`, `sale_items`), e nenhuma das dezenas que
// nasceram depois.
//
// Uma lista de tabelas escrita à mão é a mesma classe de defeito que pôs os
// inquéritos oito dias partidos: duas cópias da mesma verdade, uma delas a
// envelhecer em silêncio. Num direito de acesso, envelhecer em silêncio
// significa entregar uma resposta incompleta a quem tinha direito a tudo —
// e ninguém dá por isso, dos dois lados.
//
// ── A REGRA ESTRUTURAL ─────────────────────────────────────────────────────
// A lista de tabelas NÃO se escreve aqui. Pergunta-se à base de dados quais
// têm `patient_id`, e são essas. Este ficheiro diz apenas duas coisas que a
// base de dados não sabe dizer:
//
//   • o que fica de FORA, e por que razão (`FORA`);
//   • o que pode nomear TERCEIROS e por isso precisa de revisão antes de sair
//     pela porta (`PODE_NOMEAR_TERCEIROS`).
//
// A `scripts/check-direito-acesso.mjs` confronta as duas listas com o
// esquema real. Uma tabela nova com `patient_id` que ninguém classificou faz
// a guarda ficar vermelha — é a única forma de isto não envelhecer.

import { ATIVIDADES, type Atividade } from './ropa'
import { PRAZOS, BASES_GERAIS, BASES_ESPECIAIS } from './rgpd'

/* ══════════════════════════════════════════════════════════════════════════
   O QUE FICA DE FORA, E PORQUÊ
   ══════════════════════════════════════════════════════════════════════════
   Estas têm `patient_id` e mesmo assim não entram. Cada uma leva a razão
   escrita: uma exclusão sem razão é indistinguível de um esquecimento, e
   daqui a um ano ninguém sabe qual das duas foi. */
export const FORA: Record<string, string> = {
  // Vistas, não tabelas: o que está nelas já vem das tabelas de origem, e
  // repeti-lo faz o documento parecer ter o dobro dos dados que tem.
  current_open_episode: 'Vista da base de dados — o conteúdo vem de `episodes`, que já entra.',
  org_audit_feed: 'Vista do registo de acessos — entra pela `audit_events`.',
  unified_waitlist: 'Vista da lista de espera — o conteúdo vem de `candidaturas`.',

  // Da era da farmácia. Ficaram no esquema, não têm uso no produto, e num
  // documento entregue a uma família seriam linhas vazias com nomes clínicos
  // a sugerir que há mais do que há.
  pcne_interventions: 'Da versão de farmácia do produto, fora de uso em lares e centros de dia.',
  sales: 'Da versão de farmácia do produto. O que a casa cobra está na conta corrente do utente.',
  prescriptions: 'Da versão de farmácia do produto. A medicação do utente está na `patient_meds`.',
  surgeries: 'Da versão de clínica do produto, fora de uso em lares e centros de dia.',
  telemed_sessions: 'Da versão de clínica do produto, fora de uso em lares e centros de dia.',
  triage_assessments: 'Da versão de clínica do produto, fora de uso em lares e centros de dia.',
  internship_procedures: 'Registo de formação de estagiários — é sobre o estagiário, não sobre o utente.',
  case_presentations: 'Material de ensino, anonimizado na origem.',
  crm_contacts: 'Da versão comercial do produto, fora de uso em lares e centros de dia.',
  waiting_room: 'Sala de espera da versão de clínica do produto, fora de uso em lares e centros de dia.',
  episodes: 'Episódios de ambulatório/internamento/urgência, da versão de clínica do produto.',
  encounters: 'Atendimentos da versão de clínica e do modo pessoal — não é o registo de uma casa.',
  patient_channels: 'Só liga a ficha a um canal de mensagens — as mensagens entram pelas suas tabelas.',
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE PODE NOMEAR OUTRAS PESSOAS — ART. 15.º/4
   ══════════════════════════════════════════════════════════════════════════
   «O direito de obter uma cópia não prejudica os direitos e liberdades de
   terceiros.»

   Um registo de turno escrito por uma auxiliar pode nomeá-la. Uma ocorrência
   pode descrever outro residente. Uma nota da psicóloga pode falar de um
   filho. Nada disto se tira do documento — a pessoa tem direito aos dados que
   são DELA, e cortá-los por precaução esvaziava o direito.

   O que se faz é MARCAR: o documento diz, no bloco, que ali pode haver
   terceiros e que a casa deve passar os olhos antes de entregar. A decisão de
   ocultar é de quem responde, não de quem programa — e quem responde precisa
   de saber onde olhar. */
export const PODE_NOMEAR_TERCEIROS = new Set<string>([
  'care_records', 'incidents', 'psychosocial_notes', 'psi_sessoes', 'psi_processo',
  'family_messages', 'family_thread_messages', 'team_messages', 'resident_requests',
  'handovers', 'cuidados_nao_prestados', 'resident_contacts',
  'family_institution_links', 'appointments', 'documents',
  // Cada alteração guarda o nome de quem a fez na casa.
  'medicacao_alteracoes',
])

/**
 * Colunas que nunca saem no documento do art. 15.º, mesmo sendo desta pessoa.
 *
 * O `token` da partilha com a farmácia É o acesso ao mapa: posto num documento
 * entregue à família, qualquer pessoa que o lesse passava a conseguir abrir a
 * medicação. O que o art. 15.º/1-c pede — a quem foi mostrado e quando — fica:
 * o nome da farmácia e as datas.
 */
export const REDIGIR: Record<string, string[]> = {
  partilhas_farmacia: ['token'],
}

/**
 * O aviso, em duas versões — porque aparece em dois sítios e a mesma frase não
 * serve nos dois.
 *
 * No documento impresso cada bloco leva o seu, e aí «este bloco» é exato. Na
 * página há um aviso só, por cima da lista toda, e aí «este bloco» não se
 * refere a nada — era o que estava escrito, com a frase repetida quatro vezes
 * no mesmo ecrã. Um aviso repetido quatro vezes deixa de ser lido à primeira.
 */
export const AVISO_DE_TERCEIROS =
  'Este bloco pode nomear outras pessoas — quem escreveu o registo, outro '
  + 'residente, um familiar. O direito de acesso não prejudica os direitos de '
  + 'terceiros (art. 15.º/4): passe os olhos antes de entregar.'

export const AVISO_DE_TERCEIROS_GERAL =
  'Alguns destes blocos podem nomear outras pessoas — quem escreveu o registo, '
  + 'outro residente, um familiar. O direito de acesso não prejudica os direitos '
  + 'de terceiros (art. 15.º/4), por isso os blocos assinalados em baixo pedem '
  + 'uma leitura antes de a resposta sair.'

/* ══════════════════════════════════════════════════════════════════════════
   E QUANDO QUEM PEDE É QUEM LÁ TRABALHA — ART. 20.º
   ══════════════════════════════════════════════════════════════════════════
   A `/api/export-me` responde ao direito de portabilidade de uma CONTA. Para
   uma conta pessoal isso é simples: tudo o que tem `user_id` é dela.

   Numa casa não é. O `user_id` de um registo é quem o ESCREVEU, e uma auxiliar
   que registe o turno de trinta residentes durante um ano tem o seu `user_id`
   em milhares de linhas sobre outras pessoas. Até 21/10/2026 a rota
   entregava-lhas — ficheiro fora da casa, com nomes, diagnósticos e alergias,
   debaixo da etiqueta «os meus dados pessoais».

   A resposta certa não é filtrar melhor: é reconhecer de quem são os dados.
   Nos dados institucionais a RESPONSÁVEL é a casa e o Phlox é subcontratante
   (art. 28.º — ver `PAPEIS` em `lib/rgpd.ts`). Um subcontratante não entrega
   os dados do responsável a um funcionário dele a pedido deste. O que a pessoa
   fez na casa consta dos registos da casa, e pede-se à casa.

   Por isso, para quem pertence a uma casa, o que sai por aqui é a CONTA: quem
   é, como entra, o que pertence. Tudo o resto fica.

   ── PORQUE É UMA LISTA BRANCA, DEPOIS DE EU DIZER MAL DAS LISTAS À MÃO ─────
   Porque os dois erros não custam o mesmo. Uma tabela nova que falte a esta
   lista sai de menos no ficheiro de alguém — corrige-se. Uma tabela nova que
   falte a uma lista de exclusões sai de MAIS: são dados de residentes a sair
   da casa, e isso não se corrige depois.

   Quando os dois lados do engano não pesam igual, a omissão tem de cair para
   o lado seguro. Aqui, o que não está classificado não sai. */
export const SOBRE_A_CONTA: Record<string, string> = {
  profiles: 'Quem é: nome, email, e as definições da conta.',
  org_members: 'A que casa pertence, com que função e que acessos.',
  marcadores_leitura: 'O que esta conta marcou como lido.',
  search_history: 'O que esta conta procurou.',
  study_progress_sync: 'O progresso de estudo desta conta.',
  copilot_memory: 'O que o copiloto guardou desta conta.',
  invites: 'Os convites que esta conta enviou ou recebeu.',
}

/**
 * O que não sai NUNCA, nem para uma conta pessoal.
 *
 * O `push_subscriptions` guarda o endereço para onde se empurra um aviso a um
 * aparelho — quem o tiver consegue mandar avisos para o telemóvel dessa pessoa.
 * Exportá-lo é escrevê-lo num ficheiro na pasta de transferências de alguém, e
 * um segredo numa pasta de transferências deixa de ser um segredo. O mesmo
 * para as chaves de API.
 */
export const NUNCA_SAI: Record<string, string> = {
  api_keys: 'São chaves — exportá-las é perdê-las.',
  push_subscriptions: 'O endereço de empurrar avisos para um aparelho é um segredo.',
  webhook_endpoints: 'Trazem segredos de assinatura.',
  current_open_episode: 'Vista: o conteúdo vem das tabelas de origem, em duplicado.',
  org_audit_feed: 'Vista: o conteúdo vem das tabelas de origem, em duplicado.',
  unified_waitlist: 'Vista: o conteúdo vem das tabelas de origem, em duplicado.',
}

/** O que se diz a quem trabalha numa casa, no próprio ficheiro. */
export const PORQUE_FICA_NA_CASA =
  'Esta conta pertence a uma instituição. Sai daqui o que diz respeito à CONTA. '
  + 'O que esta pessoa registou sobre utentes não sai: são dados dos utentes, e '
  + 'nesses dados a responsável é a instituição — o Phlox trata-os por conta dela '
  + '(art. 28.º do RGPD) e não os entrega a um terceiro a pedido deste. O registo '
  + 'da atividade profissional de quem lá trabalha pede-se à própria instituição. '
  + 'Um utente, ou quem o representa, obtém os seus dados na ficha dele, em '
  + 'Documentos → «Tudo o que a casa tem sobre…», que responde ao art. 15.º.'

export interface Bloco {
  /** A atividade de tratamento a que pertence, do registo do art. 30.º. */
  atividade: Atividade
  /** As tabelas desta atividade que guardam algo desta pessoa. */
  tabelas: string[]
  /** Alguma delas pode nomear terceiros? */
  revejaTerceiros: boolean
}

/**
 * Agrupar as tabelas pela atividade de tratamento a que pertencem.
 *
 * Porque é que não se listam as tabelas por ordem alfabética: porque
 * «appointments, assessments, attendance» não é uma resposta a ninguém. O
 * art. 15.º/1-a pede a FINALIDADE de cada tratamento, e a finalidade é o que
 * agrupa. Um bloco chamado «Medicação: preparar, dar e registar» com o que
 * lá está por baixo responde à pergunta; uma lista de nomes de tabelas não.
 *
 * @param tabelasComDados  As que têm mesmo linhas desta pessoa.
 */
export function blocos(tabelasComDados: string[]): Bloco[] {
  const tem = new Set(tabelasComDados)
  return ATIVIDADES
    .map(atividade => {
      const tabelas = atividade.tabelas.filter(t => tem.has(t))
      return {
        atividade, tabelas,
        revejaTerceiros: tabelas.some(t => PODE_NOMEAR_TERCEIROS.has(t)),
      }
    })
    .filter(b => b.tabelas.length > 0)
}

/**
 * As tabelas que têm dados desta pessoa mas não pertencem a atividade nenhuma.
 *
 * Não se escondem. Um documento que diz «e mais isto, que ainda não está
 * classificado» é honesto; um que as deixa cair de fora está incompleto sem o
 * dizer. A guarda existe para esta lista estar sempre vazia — mas enquanto
 * não estiver, o documento di-lo.
 */
export function semAtividade(tabelasComDados: string[]): string[] {
  const classificadas = new Set(ATIVIDADES.flatMap(a => a.tabelas))
  return tabelasComDados.filter(t => !classificadas.has(t)).sort()
}

/* ══════════════════════════════════════════════════════════════════════════
   O QUE O ART. 15.º OBRIGA A DIZER, ALÉM DOS DADOS
   ══════════════════════════════════════════════════════════════════════════
   O artigo tem duas metades e quase toda a gente só cumpre uma. A primeira é
   a cópia dos dados. A segunda é esta lista — e uma resposta que entrega mil
   linhas de registos sem dizer durante quanto tempo os guarda, a quem os
   comunica e como se reclama, não cumpriu o artigo. */
export const O_QUE_SE_TEM_DE_DIZER: { titulo: string; texto: string; artigo: string }[] = [
  {
    titulo: 'Para que servem estes dados',
    artigo: 'art. 15.º/1-a',
    texto: 'Cada bloco deste documento começa pela finalidade do tratamento a que pertence.',
  },
  {
    titulo: 'Que categorias de dados são',
    artigo: 'art. 15.º/1-b',
    texto: 'Vêm indicadas em cada bloco, incluindo as categorias especiais (dados de saúde).',
  },
  {
    titulo: 'A quem foram ou podem ser comunicados',
    artigo: 'art. 15.º/1-c',
    texto: 'Os destinatários vêm indicados em cada bloco. Fora deles, estes dados não saem da casa.',
  },
  {
    titulo: 'Durante quanto tempo ficam guardados',
    artigo: 'art. 15.º/1-d',
    texto: 'O prazo de cada bloco vem indicado, com a razão: nem todos vêm da lei, e isso está dito.',
  },
  {
    titulo: 'Os direitos que assistem ao titular',
    artigo: 'art. 15.º/1-e, art. 16.º a 21.º',
    texto:
      'Retificação do que estiver errado, apagamento, limitação do tratamento e oposição. '
      + 'Alguns destes direitos cedem perante obrigações legais da casa: a Portaria n.º 67/2012 '
      + 'obriga a manter processo individual, registo de medicação e registo de ocorrências, '
      + 'e esses não se apagam a pedido enquanto o prazo correr.',
  },
  {
    titulo: 'O direito de reclamar',
    artigo: 'art. 15.º/1-f, art. 77.º',
    texto: 'Junto da Comissão Nacional de Proteção de Dados (CNPD), em www.cnpd.pt.',
  },
  {
    titulo: 'De onde vieram os dados',
    artigo: 'art. 15.º/1-g',
    texto:
      'Da própria pessoa e de quem a representa, no processo de admissão e no dia a dia; '
      + 'e do que a equipa da casa regista ao cuidar dela.',
  },
  {
    titulo: 'Se há decisões automatizadas',
    artigo: 'art. 15.º/1-h, art. 22.º',
    texto:
      'Não há. Nada no Phlox decide sozinho sobre uma pessoa: o que a aplicação calcula — '
      + 'avisos, sinais, prioridades — é sugestão a um profissional, que decide.',
  },
]

/**
 * O prazo de conservação de um bloco, pronto a escrever.
 *
 * Devolve `desde` e `fundamento` e não só o número de anos porque um prazo sem
 * ponto de partida não é um prazo — «10 anos» a contar de quê? — e porque o
 * art. 15.º/1-d pede o prazo OU os critérios usados para o fixar. O `naLei`
 * diz qual dos dois é: quando é falso, aquilo é uma escolha defensável da
 * casa e tem de o dizer, em vez de se fazer passar por lei.
 */
export function prazoDe(atividade: Atividade) {
  const p = PRAZOS.find(x => x.id === atividade.prazo)
  if (!p) return null
  return {
    oQue: p.oQue, quanto: p.quanto, desde: p.desde,
    fundamento: p.fundamento, naLei: p.naLei,
  }
}

/** As bases legais de um bloco, por extenso. */
export function basesDe(atividade: Atividade): string[] {
  const out: string[] = []
  const g = BASES_GERAIS[atividade.base]
  if (g) out.push(`${g.nome} (${g.artigo})`)
  if (atividade.especiais) {
    const e = BASES_ESPECIAIS[atividade.baseEspecial]
    if (e) out.push(`${e.nome} (${e.artigo})`)
  }
  return out
}

/**
 * O prazo da resposta, em dias, e a data-limite.
 *
 * Art. 12.º/3: «sem demora injustificada e em qualquer caso no prazo de um
 * mês a contar da data de receção do pedido.» Prorrogável por dois meses, com
 * justificação dada ao titular dentro do primeiro mês.
 */
export const PRAZO_DE_RESPOSTA = {
  dias: 30,
  artigo: 'art. 12.º/3',
  frase:
    'A casa tem um mês a contar da receção do pedido para responder, prorrogável por '
    + 'mais dois meses em casos complexos — e a prorrogação tem de ser comunicada ao '
    + 'titular DENTRO do primeiro mês, com a razão.',
}
