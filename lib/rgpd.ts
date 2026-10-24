// lib/rgpd.ts
// ═══════════════════════════════════════════════════════════════════════════
// AS BASES LEGAIS, OS PRAZOS E QUEM É RESPONSÁVEL POR QUÊ
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE ISTO NASCEU EM SEPARADO DO lib/legal.ts ───────────────────
// O `lib/legal.ts` diz QUEM somos e com QUE fornecedores trabalhamos — é
// estável e é institucional. Isto diz COM QUE FUNDAMENTO tratamos cada coisa e
// DURANTE QUANTO TEMPO — e isso muda com a lei, não com a empresa.
//
// Mais importante: isto é lido em três sítios que TÊM de concordar — a política
// de privacidade, o registo de atividades de tratamento (art. 30.º) e a
// checklist de conformidade. Dois textos legais a dizerem coisas diferentes
// sobre a mesma base legal é pior do que não ter nenhum: é a prova escrita de
// que ninguém pensou no assunto.
//
// ═══════════════════════════════════════════════════════════════════════════
// O ERRO QUE ISTO VEM CORRIGIR: O CONSENTIMENTO
// ═══════════════════════════════════════════════════════════════════════════
//
// A política dizia que os dados de saúde eram tratados «com base no seu
// consentimento explícito (art. 9.º/2-a)». Está errado, e é o erro mais comum
// do setor social português.
//
// O consentimento, no RGPD, tem de ser LIVRE e RETIRÁVEL a qualquer momento
// (art. 7.º/3). Ora:
//
//   · Uma pessoa que vive num lar não dá consentimento livre ao registo dos
//     seus cuidados — a alternativa é não ser cuidada. O considerando 43 diz
//     expressamente que não há consentimento livre quando há desequilíbrio
//     entre as partes.
//
//   · E se o retirasse, a casa teria de PARAR de registar. Não pode: a
//     Portaria n.º 67/2012 obriga-a a manter processo individual, registo de
//     medicação e registo de ocorrências. Uma base legal que a lei proíbe de
//     respeitar não é uma base legal.
//
// A base certa para a prestação de cuidados é o **art. 9.º/2-h** — tratamento
// necessário para efeitos de prestação de cuidados de saúde ou de ação social —
// conjugado com o art. 6.º/1-b (contrato) e 6.º/1-c (obrigação legal).
//
// O consentimento continua a existir, mas só onde é mesmo livre: a fotografia
// que vai para o mural, o vídeo da festa, a partilha com a família. Aí a pessoa
// pode dizer que não sem perder nada — e é por isso que ali é consentimento a
// sério. Ver `lib/consentTemplates.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════

/** As bases do art. 6.º que a aplicação usa. */
export type BaseGeral = 'contrato' | 'obrigacao_legal' | 'interesse_vital' | 'consentimento' | 'interesse_legitimo'

/** As bases do art. 9.º (categorias especiais) que a aplicação usa. */
export type BaseEspecial = 'cuidados_saude' | 'consentimento_explicito' | 'interesse_vital_9' | 'nenhuma'

export const BASES_GERAIS: Record<BaseGeral, { artigo: string; nome: string; quando: string }> = {
  contrato: {
    artigo: 'art. 6.º/1-b',
    nome: 'Execução de contrato',
    quando: 'O contrato de prestação de serviços assinado com a pessoa ou com quem a representa.',
  },
  obrigacao_legal: {
    artigo: 'art. 6.º/1-c',
    nome: 'Obrigação legal',
    quando: 'O que a Portaria n.º 67/2012, a Portaria n.º 38/2013 e a legislação fiscal obrigam a registar e a conservar.',
  },
  interesse_vital: {
    artigo: 'art. 6.º/1-d',
    nome: 'Interesse vital',
    quando: 'Situações em que está em causa a vida ou a integridade física de alguém que não pode consentir.',
  },
  consentimento: {
    artigo: 'art. 6.º/1-a',
    nome: 'Consentimento',
    quando: 'Só onde a recusa não tem custo: imagem, partilha voluntária com a família, comunicações não essenciais.',
  },
  interesse_legitimo: {
    artigo: 'art. 6.º/1-f',
    nome: 'Interesse legítimo',
    quando: 'Segurança da aplicação e prevenção de abuso. Nunca para dados de saúde.',
  },
}

export const BASES_ESPECIAIS: Record<BaseEspecial, { artigo: string; nome: string; quando: string }> = {
  cuidados_saude: {
    artigo: 'art. 9.º/2-h',
    nome: 'Prestação de cuidados de saúde ou de ação social',
    quando: 'A base de quase tudo o que uma casa regista. Sujeita ao dever de sigilo do art. 9.º/3.',
  },
  consentimento_explicito: {
    artigo: 'art. 9.º/2-a',
    nome: 'Consentimento explícito',
    quando: 'Só onde a recusa não tem custo — ver a nota sobre o consentimento no topo deste ficheiro.',
  },
  interesse_vital_9: {
    artigo: 'art. 9.º/2-c',
    nome: 'Interesse vital',
    quando: 'Emergência em que a pessoa está incapaz de consentir.',
  },
  nenhuma: {
    artigo: '—',
    nome: 'Não há dados de categoria especial',
    quando: 'Dados de conta, de utilização e de faturação.',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// OS PRAZOS DE CONSERVAÇÃO
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE «30 DIAS» ESTAVA ERRADO ───────────────────────────────────
// A política dizia que ao apagar a conta os dados saem em 30 dias. Para uma
// conta pessoal está certo. Para uma CASA está errado e é perigoso: o processo
// individual de um residente não se apaga quando alguém fecha uma conta — a
// Portaria n.º 67/2012 obriga a conservá-lo, e um processo apagado é
// exactamente o que uma inspeção procura.
//
// O princípio do art. 5.º/1-e é a limitação da conservação: guarda-se o tempo
// NECESSÁRIO, nem mais nem menos. «Para sempre» viola-o tanto quanto «30 dias».
//
// ── UMA NOTA DE HONESTIDADE ────────────────────────────────────────────────
// Os prazos abaixo são os que a prática do setor segue e os que a lei fixa onde
// a fixa. Onde a lei NÃO fixa um prazo, está escrito que é uma escolha da casa
// e não uma imposição — porque inventar um prazo e apresentá-lo como legal é
// pior do que admitir que é uma decisão.

export interface Prazo {
  id: string
  oQue: string
  quanto: string
  /** A contar de quê. Um prazo sem ponto de partida não é um prazo. */
  desde: string
  fundamento: string
  /** A lei fixa-o, ou é uma escolha defensável da casa? */
  naLei: boolean
}

export const PRAZOS: Prazo[] = [
  {
    id: 'processo_individual',
    oQue: 'Processo individual do utente (identificação, avaliação, plano, contrato)',
    quanto: '10 anos',
    desde: 'da data de saída ou do óbito',
    fundamento: 'Portaria n.º 67/2012, art. 7.º · prática do setor social e prazo de prescrição civil (art. 309.º do Código Civil)',
    naLei: false,
  },
  {
    id: 'registos_clinicos',
    oQue: 'Registos de saúde: medicação administrada, sinais vitais, feridas, ocorrências',
    quanto: '5 anos',
    desde: 'do último registo',
    fundamento: 'Prazo mínimo de conservação de informação de saúde (Lei n.º 12/2005 e prática do SNS)',
    naLei: true,
  },
  {
    id: 'ocorrencias',
    oQue: 'Ocorrências e acidentes com seguimento',
    quanto: '10 anos',
    desde: 'da ocorrência',
    fundamento: 'Prazo de prescrição da responsabilidade civil',
    naLei: false,
  },
  {
    id: 'faturacao',
    oQue: 'Faturação, mensalidades e comparticipações',
    quanto: '10 anos',
    desde: 'do fim do exercício',
    fundamento: 'Código do IVA, art. 52.º · Código Comercial, art. 40.º',
    naLei: true,
  },
  {
    id: 'equipa',
    oQue: 'Contratos, formação e registos da equipa',
    quanto: '5 anos após o fim do vínculo',
    desde: 'do fim do contrato',
    fundamento: 'Código do Trabalho, art. 127.º/1-k · obrigações perante a ACT',
    naLei: true,
  },
  {
    id: 'candidaturas',
    oQue: 'Candidaturas e lista de espera de quem não chegou a entrar',
    quanto: '2 anos',
    desde: 'da última atualização da candidatura',
    fundamento: 'Princípio da limitação da conservação (art. 5.º/1-e). Depois disso a vaga já não se espera.',
    naLei: false,
  },
  {
    id: 'inqueritos',
    oQue: 'Respostas a inquéritos de satisfação',
    quanto: 'Sem prazo — são anónimas',
    desde: '—',
    fundamento: 'Anónimas por construção: não têm user_id nem autor. Deixaram de ser dados pessoais (considerando 26).',
    naLei: false,
  },
  {
    id: 'registo_atividade',
    oQue: 'Livro de registos (quem fez o quê, sobre quem)',
    quanto: '3 anos',
    desde: 'do registo',
    fundamento: 'Necessário para apurar responsabilidade; além disso deixa de servir e passa a ser vigilância da equipa.',
    naLei: false,
  },
  {
    id: 'conta_pessoal',
    oQue: 'Conta pessoal do Phlox (fora de instituição)',
    quanto: '30 dias após o pedido de apagamento',
    desde: 'do pedido',
    fundamento: 'Art. 17.º. Não há obrigação legal de conservar nada numa conta pessoal.',
    naLei: false,
  },
]

export const prazoPorId = (id: string) => PRAZOS.find(p => p.id === id)

// ═══════════════════════════════════════════════════════════════════════════
// QUEM É RESPONSÁVEL POR QUÊ — e porque é que isto é a coisa mais importante
// ═══════════════════════════════════════════════════════════════════════════
//
// A política antiga tinha uma secção chamada «Quem é o responsável pelo
// tratamento» e respondia sempre a mesma coisa: o Phlox. Isso é verdade para
// uma conta pessoal e é FALSO para uma casa.
//
// Quando um lar usa o Phlox, quem decide que dados dos residentes se tratam e
// para quê é o LAR — e quem decide as finalidades é, por definição do art.
// 4.º/7, o responsável pelo tratamento. O Phlox trata esses dados por conta do
// lar: é subcontratante (art. 4.º/8), e a relação rege-se pelo art. 28.º.
//
// Isto não é uma subtileza de advogado. Decide:
//   · a quem a família escreve quando quer aceder aos dados (ao lar, não a nós);
//   · quem notifica a CNPD em caso de violação (o lar, em 72h; nós notificamo-lo
//     a ele «sem demora injustificada», art. 33.º/2);
//   · quem responde perante uma inspeção (o lar);
//   · e que nós não podemos usar os dados dos residentes para mais nada —
//     nem para melhorar o produto — sem instruções escritas dele.

export const PAPEIS = {
  institucional: {
    responsavel: 'A instituição (o lar, o centro de dia ou o serviço de apoio domiciliário)',
    subcontratante: 'Phlox Clinical',
    artigo: 'art. 28.º',
    explicacao:
      'A casa decide que dados se tratam e para quê; o Phlox trata-os por conta dela e só '
      + 'segundo as suas instruções. Os pedidos de acesso das famílias são dirigidos à casa.',
  },
  pessoal: {
    responsavel: 'Phlox Clinical',
    subcontratante: '—',
    explicacao:
      'Numa conta pessoal é a própria pessoa que regista os seus dados e é o Phlox que '
      + 'decide as finalidades do serviço que lhe presta.',
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
// DECISÕES AUTOMATIZADAS (art. 22.º)
// ═══════════════════════════════════════════════════════════════════════════
// Uma pergunta que a política não respondia e que a CNPD faz sempre, sobretudo
// a quem tem «IA» no produto.
//
// A resposta honesta é «não há» — e é preciso explicar porquê, porque o Phlox
// FAZ cálculos sobre pessoas: a lista de quem está isolado, o risco de queda, o
// índice de erosão psicossocial.
//
// O art. 22.º proíbe decisões tomadas EXCLUSIVAMENTE por meios automatizados
// que produzam efeitos jurídicos ou afetem significativamente a pessoa. Nada
// aqui decide nada: tudo o que se calcula é uma LISTA DE QUEM VER, apresentada
// a alguém que decide. Nenhum cálculo muda sozinho um plano, uma medicação, uma
// admissão ou uma saída.
export const DECISOES_AUTOMATIZADAS = {
  existem: false,
  frase:
    'Não tomamos decisões exclusivamente automatizadas com efeitos jurídicos ou '
    + 'significativos sobre as pessoas (art. 22.º). O Phlox calcula sinais — quem não '
    + 'recebe visitas há muito tempo, quem tem o humor em baixa, que medicação está por '
    + 'dar — e apresenta-os a quem decide. Nenhum destes cálculos altera por si um plano '
    + 'de cuidados, uma medicação, uma admissão ou uma saída.',
}

// ═══════════════════════════════════════════════════════════════════════════
// AVALIAÇÃO DE IMPACTO (art. 35.º)
// ═══════════════════════════════════════════════════════════════════════════
// Obrigatória quando há tratamento em larga escala de dados de categorias
// especiais. Uma casa com trinta residentes não é «larga escala» no sentido do
// considerando 91 — mas o PHLOX, somando todas as casas que o usarem, é.
//
// Dizer «não é preciso» seria a resposta confortável e errada.
export const AVALIACAO_DE_IMPACTO = {
  necessaria: true,
  porque:
    'O Phlox trata dados de saúde de pessoas vulneráveis, de forma sistemática, em '
    + 'várias instituições. Mesmo que cada casa isoladamente não atinja a «larga escala» '
    + 'do considerando 91, a plataforma no seu conjunto atinge — e a lista da CNPD de '
    + 'tratamentos sujeitos a avaliação de impacto inclui expressamente os dados de saúde '
    + 'de titulares vulneráveis.',
  estado: 'por fazer' as 'por fazer' | 'em curso' | 'feita',
}
