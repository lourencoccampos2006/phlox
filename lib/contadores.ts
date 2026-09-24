// lib/contadores.ts
// ─────────────────────────────────────────────────────────────────────────────
// O número ao lado de cada ferramenta.
//
// ── O QUE FOI PEDIDO, E O QUE ISSO IMPLICA ──────────────────────────────────
// «Devia aparecer um símbolo de notificação e o número em cada ferramenta, por
// pessoa.» Tem de ser POR PESSOA: o que existia era
// `family_thread_messages.read_by_staff`, um campo por mensagem a dizer que
// «alguém da equipa já viu». Se a colega da manhã abriu, a da tarde deixava de
// ver o aviso — e o recado era para as duas.
//
// ── A DECISÃO QUE FAZ ISTO PRESTAR ──────────────────────────────────────────
// Um número que conta trabalho normal não é um aviso, é ruído. O registo do dia
// ganha quarenta linhas por dia: um «40» permanente ensina a equipa a ignorar
// os números todos, e no dia em que aparecer um que importa, ninguém olha.
//
// Por isso cada ferramenta conta uma de duas coisas, escolhida à mão:
//
//   • `novidades` — coisas que OUTROS fizeram e que eu ainda não vi. Precisa
//     de um marcador por pessoa (tabela `marcadores_leitura`): o número é
//     «quantas entraram depois da última vez que eu abri isto».
//
//   • `porFazer` — coisas em aberto à espera de alguém. Não precisa de
//     marcador nenhum: o número é o mesmo para toda a gente e só desaparece
//     quando o trabalho for feito. Abrir a página não o apaga — e ainda bem.
//
// Uma ferramenta em que nenhuma das duas seja verdade fica SEM número. Está
// escrito ao fundo do ficheiro quais são e porquê. Um zero inventado é pior
// que nada: faz a pessoa confiar num sinal que não existe.
//
// ── PORQUE É QUE NÃO SE GUARDA O NÚMERO ─────────────────────────────────────
// Um contador guardado tem de ser acertado em cada escrita, cada apagar, cada
// correção — e no dia em que falha um sítio fica um «3» eterno numa ferramenta
// vazia. Guarda-se a HORA da última abertura e conta-se na altura.
//
// ── PERMISSÕES ──────────────────────────────────────────────────────────────
// Cada contador declara a sua área. Quem não a vê não recebe o número — nem
// sequer se faz a pergunta à base de dados. Uma auxiliar não pode ficar a saber
// que há sete mensalidades por receber.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'

export type TipoContador = 'novidades' | 'porFazer' | 'calculado'

export interface Contador {
  /** A chave do marcador. NÃO é a rota: as rotas mudam, e ninguém deve perder
   *  o que já leu só porque a página mudou de endereço. */
  id: string
  /** A ferramenta a que o número se cola. Tem de bater certo com o `href` de
   *  lib/institutionBlueprint.ts — scripts/check-contadores.mjs confirma isso. */
  href: string
  /** Área de permissões. Quem não a vê não recebe este número. */
  area: string
  tipo: TipoContador
  /** A tabela a contar. Vazio quando `tipo === 'calculado'` (a conta vive em
   *  app/api/contadores). */
  tabela?: string
  /** A coluna de data usada para «desde que eu vi». Só para `novidades`. */
  coluna?: string
  /** Filtros PostgREST fixos, ex. `{ status: 'in.(open,under_review)' }`. */
  filtros?: Record<string, string>
  /** Filtros que dependem do dia de hoje — avaliados a cada pedido. */
  filtrosDeHoje?: () => Record<string, string>
  /** Usa marcador de leitura por pessoa, mesmo sendo `calculado`. É o que
   *  permite a um contador com conta própria ainda assim saber «desde quando». */
  comMarcador?: boolean
  /** O que o número quer dizer, em português, para quem passa o rato por cima
   *  e para quem usa leitor de ecrã. */
  frase: (n: number) => string
}

const hoje = () => ptDate()
const daquiA = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return ptDate(d)
}
const mesAtual = () => ptDate().slice(0, 7)

export const CONTADORES: Contador[] = [
  // ── Coisas que outros escreveram e eu ainda não vi ────────────────────────
  {
    // Calculado, e não declarativo, por três razões que não cabem num filtro:
    // os recados que escrevi não são novidade para mim; os recados dirigidos a
    // outra pessoa não me dizem respeito; e os já resolvidos não voltam a
    // chamar ninguém. A conta está em app/api/contadores.
    id: 'mural', href: '/equipa?tab=mural', area: 'equipa', tipo: 'calculado',
    comMarcador: true,
    frase: n => n === 1 ? '1 recado novo no mural' : `${n} recados novos no mural`,
  },
  {
    id: 'familias', href: '/family', area: 'familias',
    tipo: 'novidades', tabela: 'family_thread_messages', coluna: 'created_at',
    // Só o que as FAMÍLIAS escreveram. O que a equipa escreve às famílias não
    // é novidade para a equipa.
    filtros: { author_side: 'eq.family' },
    frase: n => n === 1 ? '1 mensagem de família por ler' : `${n} mensagens de famílias por ler`,
  },
  {
    id: 'documentos', href: '/documentos', area: 'documentos',
    tipo: 'porFazer', tabela: 'documents',
    // O que precisa de alguém não é um documento novo — é um que está a
    // caducar. Trinta dias é o aviso que ainda dá tempo de tratar.
    filtrosDeHoje: () => ({ expiry_date: `lte.${daquiA(30)}` }),
    frase: n => n === 1 ? '1 documento a caducar' : `${n} documentos a caducar`,
  },

  // ── Trabalho em aberto ────────────────────────────────────────────────────
  {
    id: 'ocorrencias', href: '/incidents', area: 'ocorrencias',
    tipo: 'porFazer', tabela: 'incidents',
    filtros: { status: 'in.(open,under_review)' },
    frase: n => n === 1 ? '1 ocorrência por fechar' : `${n} ocorrências por fechar`,
  },
  {
    id: 'atividades', href: '/activities', area: 'atividades',
    tipo: 'porFazer', tabela: 'activities',
    filtros: { status: 'eq.planned' },
    filtrosDeHoje: () => ({ date: `lte.${hoje()}` }),
    frase: n => n === 1 ? '1 atividade de hoje por marcar' : `${n} atividades de hoje por marcar`,
  },
  {
    id: 'feridas', href: '/feridas', area: 'feridas',
    tipo: 'porFazer', tabela: 'wounds',
    filtros: { status: 'in.(active,healing,unstageable)' },
    frase: n => n === 1 ? '1 ferida em acompanhamento' : `${n} feridas em acompanhamento`,
  },
  {
    id: 'apoio', href: '/apoio-servicos', area: 'registos',
    tipo: 'porFazer', tabela: 'support_services',
    filtros: { status: 'in.(pedido,em_curso)' },
    frase: n => n === 1 ? '1 pedido de apoio em aberto' : `${n} pedidos de apoio em aberto`,
  },
  {
    id: 'faturacao', href: '/faturacao', area: 'financeiro',
    tipo: 'porFazer', tabela: 'billing_entries',
    filtros: { paid: 'eq.false' },
    // Só o que já devia estar pago. A mensalidade do mês que vem não é dívida.
    filtrosDeHoje: () => ({ month: `lte.${mesAtual()}` }),
    frase: n => n === 1 ? '1 mensalidade por receber' : `${n} mensalidades por receber`,
  },
  {
    id: 'equipa', href: '/equipa?tab=escalas', area: 'equipa',
    tipo: 'porFazer', tabela: 'org_invites',
    filtros: { accepted_at: 'is.null', revoked: 'eq.false' },
    filtrosDeHoje: () => ({ expires_at: `gt.${new Date().toISOString()}` }),
    frase: n => n === 1 ? '1 convite por aceitar' : `${n} convites por aceitar`,
  },

  // ── As que precisam de conta, não de filtro ───────────────────────────────
  // Estas seis não se exprimem num filtro do PostgREST: comparam duas colunas,
  // ou cruzam duas tabelas. A conta está em app/api/contadores, identificada
  // por este `id`.
  {
    id: 'medicacao', href: '/mar', area: 'medicacao', tipo: 'calculado',
    // O número mais importante da casa: tomas devidas NESTE turno menos as que
    // já foram registadas.
    frase: n => n === 1 ? '1 toma por registar neste turno' : `${n} tomas por registar neste turno`,
  },
  {
    id: 'registos', href: '/care-log', area: 'registos', tipo: 'calculado',
    // Quem está cá hoje e ainda não tem uma linha escrita.
    frase: n => n === 1 ? '1 pessoa sem registo hoje' : `${n} pessoas sem registo hoje`,
  },
  {
    id: 'stock', href: '/stock', area: 'stock', tipo: 'calculado',
    // `quantity <= min_quantity` compara duas colunas — o PostgREST não o sabe
    // fazer, por isso a conta é feita no servidor.
    frase: n => n === 1 ? '1 artigo abaixo do mínimo' : `${n} artigos abaixo do mínimo`,
  },
  {
    id: 'preparacao', href: '/preparacao-medicacao', area: 'medicacao', tipo: 'calculado',
    // Pastilheiros desta semana ainda por preparar.
    frase: n => n === 1 ? '1 pessoa com o pastilheiro por preparar' : `${n} pessoas com o pastilheiro por preparar`,
  },
  {
    id: 'avaliacoes', href: '/assessments', area: 'avaliacoes', tipo: 'calculado',
    // Quem não é avaliado há mais de seis meses. É o que a inspeção pergunta.
    frase: n => n === 1 ? '1 pessoa sem avaliação há mais de 6 meses' : `${n} pessoas sem avaliação há mais de 6 meses`,
  },
  {
    id: 'planos', href: '/patients', area: 'utentes', tipo: 'calculado',
    // Planos individuais cuja data de revisão já passou, ou está a chegar.
    //
    // É o número que a inspeção produz quando aparece sem avisar, e é o único
    // no produto todo que ninguém se lembra de ir ver por iniciativa própria:
    // um plano não deixa de funcionar por não ser revisto, só deixa de ser
    // verdade devagar.
    frase: n => n === 1 ? '1 plano a precisar de revisão' : `${n} planos a precisar de revisão`,
  },
  {
    id: 'refeicoes', href: '/refeicoes', area: 'registos', tipo: 'calculado',
    // A ementa de hoje: ou está posta, ou não está.
    frase: () => 'A ementa de hoje ainda não está posta',
  },
]

export const POR_ID = new Map(CONTADORES.map(c => [c.id, c]))
export const POR_HREF = new Map(CONTADORES.map(c => [c.href, c]))

/** O número desta ferramenta, dado o mapa que a API devolveu. */
export function contadorDe(
  href: string,
  numeros: Record<string, number>,
): { n: number; frase: string } | null {
  const c = POR_HREF.get(href)
  if (!c) return null
  const n = numeros[c.id] || 0
  if (n <= 0) return null
  return { n, frase: c.frase(n) }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEM NÚMERO, DE PROPÓSITO
// ─────────────────────────────────────────────────────────────────────────────
// Estas ferramentas não têm contador porque não há nada verdadeiro para contar.
// Está aqui escrito para não voltar a ser uma dúvida — e para que quem
// perguntar «e o /radar?» encontre a resposta em vez de a adivinhar.
//
//   /radar, /guardiao, /vigia   Já SÃO listas do que merece atenção. Um número
//                               por cima de uma lista de avisos é o mesmo aviso
//                               duas vezes.
//   /patients, /historico       Nunca estão «por fazer». Abrem-se quando se
//                               precisa.
//   /tendencias, /autonomia,    Olham para trás. Não há nada à espera.
//   /carga
//   /interactions, /calculos,   Ferramentas de consulta: só respondem quando
//   /migrar, /vigia-ruturas     alguém pergunta.
//   /ronda-guiada               A ronda é um ato, não uma caixa de entrada.
//   /apoio-psicossocial         O acompanhamento não tem prazo, e pôr-lhe um
//                               número seria inventar urgência onde não há.
//   /painel-dono                Um painel não se avisa a si próprio.
// ─────────────────────────────────────────────────────────────────────────────
