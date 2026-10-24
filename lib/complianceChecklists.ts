// lib/complianceChecklists.ts
// ═══════════════════════════════════════════════════════════════════════════
// O QUE UMA FISCALIZAÇÃO PEDE, POR ARTIGO
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE MUDOU (2026-10-21) ───────────────────────────────────────────────
// Eram quinze itens, alguns sem referência legal e um deles ERRADO: dizia
// «consentimento informado documentado — RGPD art. 6.º/9.º» como obrigação de
// uma casa. Não é: a base do tratamento de dados de saúde num lar é o art.
// 9.º/2-h, e apresentá-la como consentimento promete a quem lá vive um direito
// de recusa que não existe e que a casa não pode honrar. Ver a nota longa em
// `lib/rgpd.ts`.
//
// Agora a lista segue a Portaria n.º 67/2012 (ERPI) e a Portaria n.º 38/2013
// (apoio domiciliário) artigo a artigo, e cada item diz ONDE no Phlox se
// resolve — porque uma checklist que só diz «tenha isto» é uma lista de
// trabalhos de casa, e uma que diz «isto faz-se aqui» é uma ferramenta.
//
// ── A REGRA DAS REFERÊNCIAS ────────────────────────────────────────────────
// Só se cita o que se sabe citar. Um item sem `ref` é um item sem base legal
// encontrada — e fica assim, honestamente, em vez de levar uma referência
// inventada que ninguém confere até ao dia em que alguém confere.

import type { InstitutionType } from './useClinicPrefs'

/* ── A FONTE DO CENTRO DE DIA NÃO É A PORTARIA DOS LARES ──────────────────
   Até 22/10/2026 cada item deste grupo citava «Portaria n.º 67/2012, art. X».
   Essa portaria define, no artigo 1.º, as condições das ESTRUTURAS
   RESIDENCIAIS. Não se aplica a um centro de dia, e os artigos dela não se
   transpõem — um diretor técnico que leve aquela referência a uma visita cita
   a lei errada.

   E não há uma portaria do centro de dia para pôr no lugar. O que há:
     • DL n.º 64/2007, na redação do DL n.º 33/2014 — o licenciamento;
     • Portaria n.º 196-A/2015 — o modelo do acordo de cooperação, que é onde
       estão os números que obrigam uma casa concreta;
     • Guião Técnico do Centro de Dia (DGAS, 1996) — orientação técnica, não lei.

   Por isso a referência diz a verdade: a fonte é o acordo da casa, com o guião
   por trás. Inventar números de artigo para parecer mais preciso era repetir o
   mesmo erro com outra roupa. */
const FONTE_CD = 'Acordo de cooperação (Portaria n.º 196-A/2015) · Guião Técnico do Centro de Dia (DGAS, 1996)'

const NOTA_CD =
  'O centro de dia não tem portaria de condições de funcionamento como a ERPI tem '
  + '— a Portaria n.º 67/2012 é das estruturas residenciais (art. 1.º). O que obriga '
  + 'esta casa está no acordo de cooperação dela com a Segurança Social; confirme os '
  + 'números aí.'


export interface ComplianceItem {
  key: string
  title: string
  detail: string
  /** O artigo concreto. Omitido quando é boa prática e não obrigação. */
  ref?: string
  /**
   * A referência QUANDO ELA MUDA CONFORME A RESPOSTA SOCIAL.
   *
   * O grupo «Segurança e qualidade» é partilhado pelo lar e pelo centro de dia:
   * a obrigação é a mesma (ter registo de ocorrências, ter seguro) mas a lei
   * que a impõe não é. Dois itens dele citavam «Portaria n.º 67/2012» também
   * ao centro de dia, e essa portaria é das estruturas residenciais (art. 1.º).
   *
   * A alternativa era duplicar o item, uma versão por resposta. Não serve: a
   * chave é o que fica gravado na `compliance_items`, e duas chaves para a
   * mesma obrigação partem o histórico de quem já a marcou.
   */
  refPor?: Partial<Record<InstitutionType, string>>
  /** Onde no Phlox se trata disto. Uma checklist que não leva lá é uma lista. */
  onde?: string
}

export interface ComplianceGroup {
  group: string
  /** O que este grupo responde, para quem está a preparar uma visita. */
  nota?: string
  items: ComplianceItem[]
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTEÇÃO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════
const RGPD: ComplianceGroup = {
  group: 'Proteção de dados (RGPD)',
  nota: 'O que a CNPD pede numa fiscalização, pela ordem por que costuma pedir.',
  items: [
    {
      key: 'rgpd_registo_atividades',
      title: 'Registo das atividades de tratamento',
      detail: 'Documento que descreve que dados se tratam, com que finalidade, com que base legal, a quem se comunicam e durante quanto tempo se guardam. É a primeira coisa que a CNPD pede.',
      ref: 'RGPD art. 30.º',
      onde: 'Gerado nesta página — falta acrescentar o que a casa trata fora do Phlox.',
    },
    {
      key: 'rgpd_base_legal',
      title: 'Base legal correta para os dados de saúde',
      detail: 'O tratamento dos dados de saúde dos utentes assenta no art. 9.º/2-h (prestação de cuidados de saúde ou de ação social) conjugado com o art. 6.º/1-b e 6.º/1-c — e NÃO em consentimento. O consentimento teria de ser livre e retirável, e nenhuma das duas coisas é verdade aqui: a casa é obrigada por lei a manter os registos mesmo que lhos peçam para apagar.',
      ref: 'RGPD art. 6.º/1-b, 6.º/1-c e 9.º/2-h',
      onde: 'Já assente assim na política de privacidade e no registo de atividades.',
    },
    {
      key: 'rgpd_contrato_subcontratante',
      title: 'Contrato com os subcontratantes',
      detail: 'Contrato escrito com cada entidade que trata dados por conta da casa — incluindo o fornecedor do software — com o conteúdo mínimo do art. 28.º/3.',
      ref: 'RGPD art. 28.º/3',
      onde: 'O contrato com o Phlox está em /trust/dpa.',
    },
    {
      key: 'rgpd_informacao_titulares',
      title: 'Informação aos utentes e às famílias',
      detail: 'Aviso de privacidade entregue na admissão, em linguagem clara, dizendo que dados se tratam, porquê, por quanto tempo, e como se exercem os direitos. Não basta estar afixado: tem de ser entregue e ficar prova disso.',
      ref: 'RGPD art. 13.º e 12.º/1',
    },
    {
      key: 'rgpd_direitos',
      title: 'Procedimento de resposta aos direitos',
      detail: 'Processo escrito para responder a pedidos de acesso, retificação, apagamento, limitação, portabilidade e oposição, no prazo de um mês. Inclui saber quando o apagamento NÃO se aplica — o processo individual é de conservação obrigatória.',
      ref: 'RGPD art. 12.º/3 e 15.º a 22.º',
      onde: 'O pedido de ACESSO responde-se na ficha da pessoa → Documentos → «Tudo o que a casa tem sobre…»: junta os dados e as finalidades, prazos e destinatários que o art. 15.º também obriga a dar. O procedimento escrito (quem recebe o pedido, como se confirma a identidade, quem responde) continua a ser da casa.',
    },
    {
      key: 'rgpd_encarregado',
      title: 'Encarregado de Proteção de Dados (DPO)',
      detail: 'Obrigatório quando há tratamento em larga escala de dados de saúde. Designado, com contacto divulgado aos titulares e comunicado à CNPD.',
      ref: 'RGPD art. 37.º/1-c e 37.º/7',
    },
    {
      key: 'rgpd_avaliacao_impacto',
      title: 'Avaliação de impacto sobre a proteção de dados',
      detail: 'Obrigatória para tratamento em larga escala de dados de saúde de pessoas vulneráveis. A lista da CNPD de tratamentos sujeitos a avaliação inclui-o expressamente.',
      ref: 'RGPD art. 35.º · Regulamento CNPD n.º 1/2018',
    },
    {
      key: 'rgpd_violacao',
      title: 'Procedimento de violação de dados',
      detail: 'Processo para notificar a CNPD em 72 horas e, quando o risco for elevado, comunicar aos próprios titulares. Inclui um registo interno de todas as violações, mesmo das que não se notificam.',
      ref: 'RGPD art. 33.º e 34.º',
    },
    {
      key: 'rgpd_prazos',
      title: 'Prazos de conservação definidos e aplicados',
      detail: 'Prazo por categoria de dados, escrito, e um procedimento de eliminação quando o prazo acaba. «Guardar para sempre» viola o princípio da limitação da conservação tanto quanto apagar cedo de mais.',
      ref: 'RGPD art. 5.º/1-e',
      onde: 'Os prazos estão no registo de atividades desta página.',
    },
    {
      key: 'rgpd_sigilo',
      title: 'Dever de sigilo da equipa',
      detail: 'Declaração de confidencialidade assinada por quem acede a dados de saúde, e acessos atribuídos pelo mínimo necessário à função.',
      ref: 'RGPD art. 9.º/3 e art. 32.º/4',
      onde: 'Os acessos por área definem-se em Equipa → Conta e acesso.',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// SEGURANÇA E QUALIDADE
// ═══════════════════════════════════════════════════════════════════════════
const SEGURANCA: ComplianceGroup = {
  group: 'Segurança e qualidade',
  items: [
    {
      key: 'seg_incidentes',
      title: 'Registo de ocorrências',
      detail: 'Todas as ocorrências e quase-ocorrências registadas, com seguimento e com o que se mudou para não repetir.',
      refPor: {
        nursing_home: 'Portaria n.º 67/2012, art. 7.º/2-f',
        day_care: FONTE_CD,
      },
      onde: 'Ocorrências.',
    },
    {
      key: 'seg_emergencia',
      title: 'Plano de emergência interno',
      detail: 'Procedimentos de evacuação, plantas afixadas, contactos de emergência, e simulacro realizado e registado.',
      ref: 'Decreto-Lei n.º 220/2008 (SCIE)',
    },
    {
      key: 'seg_formacao',
      title: 'Formação da equipa atualizada',
      detail: 'Registo de formações obrigatórias, com validade: suporte básico de vida, controlo de infeção, higiene e segurança alimentar, RGPD. Só a formação mais recente de cada pessoa e tema conta.',
      ref: 'Código do Trabalho, art. 131.º',
      onde: 'Equipa → Formação.',
    },
    {
      key: 'seg_haccp',
      title: 'Plano HACCP e controlo de temperaturas',
      detail: 'Sistema de segurança alimentar implementado, com registo de temperaturas de confeção, conservação e transporte.',
      ref: 'Regulamento (CE) n.º 852/2004',
      onde: 'Refeições → temperaturas.',
    },
    {
      key: 'seg_seguro',
      title: 'Seguro de responsabilidade civil',
      detail: 'Apólice válida e com cobertura adequada ao número de utentes, incluindo o transporte quando a casa o assegura.',
      refPor: {
        nursing_home: 'Portaria n.º 67/2012, art. 5.º/2-d',
        day_care: FONTE_CD,
      },
    },
    {
      key: 'seg_reclamacoes',
      title: 'Livro de Reclamações Eletrónico',
      detail: 'Disponível em formato físico e eletrónico, com o letreiro obrigatório afixado em local visível e o endereço da plataforma divulgado.',
      ref: 'Decreto-Lei n.º 156/2005, com a redação do DL n.º 74/2017',
    },
    {
      key: 'seg_satisfacao',
      title: 'Avaliação da satisfação',
      detail: 'Inquéritos a utentes, famílias e equipa, com resultados analisados e um plano de melhoria que deles decorra.',
      ref: 'Acordo de cooperação · Manual da Qualidade ISS',
      onde: 'Inquéritos.',
    },
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// O QUE A SEGURANÇA SOCIAL PEDE A CADA RESPOSTA SOCIAL
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE ISTO É TÃO LONGO ──────────────────────────────────────────
// Porque a Portaria n.º 67/2012 é longa. Cada item abaixo corresponde a uma
// alínea que uma visita de fiscalização confere — e a diferença entre ter a
// lista e não a ter é a diferença entre preparar uma visita em três dias ou
// em três semanas.

const ERPI: ComplianceGroup[] = [
  {
    group: 'Licenciamento e organização',
    nota: 'O que a Segurança Social confere primeiro, antes de olhar para qualquer processo. '
      + 'A Portaria n.º 67/2012 já foi alterada duas vezes (Portaria n.º 349/2023, que acrescentou '
      + 'regras para estruturas de pequena dimensão, e Portaria n.º 322-B/2024): confronte os artigos '
      + 'com o texto consolidado.',
    items: [
      { key: 'erpi_licenca', title: 'Licença de funcionamento', detail: 'Licença ou acordo de cooperação válido para a resposta social ERPI, com a capacidade licenciada afixada.', ref: 'Decreto-Lei n.º 64/2007, alterado pelo DL n.º 33/2014' },
      { key: 'erpi_regulamento', title: 'Regulamento interno', detail: 'Aprovado, afixado em local visível, e ENTREGUE a cada residente ou representante na admissão — com prova de entrega.', ref: 'Portaria n.º 67/2012, art. 9.º' },
      { key: 'erpi_racio', title: 'Quadro de pessoal e rácios', detail: 'Diretor técnico a tempo inteiro, enfermagem, e ajudantes de ação direta nos rácios mínimos: 1 por cada 8 residentes de dia e 1 por cada 20 à noite. Rácios agravados conforme o grau de dependência.', ref: 'Portaria n.º 67/2012, art. 12.º', onde: 'Contado em Equipa → Quadro de pessoal, a partir dos papéis da equipa e do número de utentes.' },
      { key: 'erpi_mapa_pessoal', title: 'Mapa de pessoal afixado', detail: 'Mapa com o nome e a categoria de quem está em cada turno, afixado e atualizado.', ref: 'Portaria n.º 67/2012, art. 12.º', onde: 'Equipa → Escalas.' },
      { key: 'erpi_plano_atividades', title: 'Plano anual de atividades', detail: 'Plano de atividades socioculturais e de animação, com relatório de execução no fim do ano.', ref: 'Portaria n.º 67/2012, art. 8.º/1-g', onde: 'Atividades + Calendário do ano.' },
    ],
  },
  {
    group: 'Processo individual de cada residente',
    nota: 'O artigo 7.º lista o que o processo TEM de conter. É aqui que uma visita demora mais tempo.',
    items: [
      { key: 'erpi_proc_identificacao', title: 'Identificação e contactos', detail: 'Dados de identificação, contactos do representante legal e de quem avisar em caso de necessidade.', ref: 'Portaria n.º 67/2012, art. 7.º/2-a', onde: 'Ficha do utente.' },
      { key: 'erpi_contrato', title: 'Contrato de prestação de serviços', detail: 'Contrato escrito e assinado com o residente ou representante, com os serviços incluídos e a mensalidade.', ref: 'Portaria n.º 67/2012, art. 7.º/2-b e art. 10.º' },
      { key: 'erpi_avaliacao', title: 'Ficha de avaliação diagnóstica', detail: 'Avaliação inicial da situação social, familiar, de saúde e de autonomia, feita à entrada.', ref: 'Portaria n.º 67/2012, art. 7.º/2-c', onde: 'Avaliações + O essencial.' },
      { key: 'erpi_pdi', title: 'Plano Individual de Cuidados (PDI)', detail: 'Elaborado com a pessoa ou com quem a representa, com objetivos e ações, e REVISTO pelo menos uma vez por ano — a data da revisão tem de constar.', ref: 'Portaria n.º 67/2012, art. 7.º/2-d e art. 8.º/1-e', onde: 'Ficha do utente → Plano.' },
      { key: 'erpi_registo_medicacao', title: 'Registo de administração de medicação', detail: 'Registo de cada toma, com hora e identificação de quem administrou, e prescrição médica arquivada.', ref: 'Portaria n.º 67/2012, art. 7.º/2-e', onde: 'Medicação a dar.' },
      { key: 'erpi_registo_ocorrencias', title: 'Registo de ocorrências no processo', detail: 'Quedas, episódios de agitação, idas ao hospital — tudo o que saia do normal, no processo da pessoa.', ref: 'Portaria n.º 67/2012, art. 7.º/2-f', onde: 'Ocorrências.' },
      { key: 'erpi_entradas_saidas', title: 'Registo de entradas e saídas', detail: 'Registo das saídas do estabelecimento e das visitas recebidas.', ref: 'Portaria n.º 67/2012, art. 8.º/1-c', onde: 'Presenças + Ausências do utente.' },
      { key: 'erpi_bens', title: 'Inventário de bens do residente', detail: 'Relação dos bens que a pessoa traz consigo, assinada à entrada e atualizada.', ref: 'Portaria n.º 67/2012, art. 8.º/1-d', onde: 'Ficha do utente → Bens.' },
    ],
  },
  {
    group: 'Cuidados e vida diária',
    items: [
      { key: 'erpi_ementas', title: 'Ementas validadas por nutrição', detail: 'Ementa semanal afixada, adequada às dietas e alergias, validada por profissional de nutrição.', ref: 'Portaria n.º 67/2012, art. 8.º/1-f', onde: 'Refeições.' },
      { key: 'erpi_higiene', title: 'Plano de higiene e conforto', detail: 'Procedimentos escritos de higiene pessoal, banho, posicionamentos e cuidados à pele.', ref: 'Portaria n.º 67/2012, art. 8.º/1-a', onde: 'Cuidados de rotina + O essencial.' },
      { key: 'erpi_saude', title: 'Acompanhamento de saúde', detail: 'Articulação com o médico assistente e com os cuidados de saúde primários, com registo das consultas.', ref: 'Portaria n.º 67/2012, art. 8.º/1-b', onde: 'Agenda.' },
      { key: 'erpi_acolhimento', title: 'Programa de acolhimento inicial', detail: 'Procedimento escrito para as primeiras semanas de quem chega — o período de maior risco de queda e de confusão.', ref: 'Manual da Qualidade ISS — ERPI' },
    ],
  },
]

const CENTRO_DIA: ComplianceGroup[] = [
  {
    group: 'Licenciamento e organização',
    nota: NOTA_CD,
    items: [
      { key: 'cd_licenca', title: 'Licença ou acordo de Centro de Dia', detail: 'Licenciamento válido da resposta social, com a capacidade afixada.', ref: 'Decreto-Lei n.º 64/2007, alterado pelo DL n.º 33/2014' },
      { key: 'cd_regulamento', title: 'Regulamento interno', detail: 'Aprovado, afixado, e entregue a cada utente ou representante na admissão.', ref: FONTE_CD },
      { key: 'cd_racio', title: 'Quadro de pessoal', detail: 'Diretor técnico e ajudantes de ação direta nos rácios da resposta, com o mapa de pessoal afixado.', ref: FONTE_CD, onde: 'Equipa → rácios.' },
      { key: 'cd_plano_atividades', title: 'Plano anual de atividades', detail: 'Plano de animação sociocultural, com relatório de execução.', ref: FONTE_CD, onde: 'Atividades.' },
    ],
  },
  {
    group: 'Processo individual de cada utente',
    items: [
      { key: 'cd_proc_identificacao', title: 'Identificação e contactos', detail: 'Dados de identificação e contactos de quem avisar.', ref: FONTE_CD, onde: 'Ficha do utente.' },
      { key: 'cd_contrato', title: 'Contrato de prestação de serviços', detail: 'Contrato assinado, com os serviços incluídos, o horário de frequência e a comparticipação.', ref: FONTE_CD },
      { key: 'cd_avaliacao', title: 'Ficha de avaliação diagnóstica', detail: 'Avaliação inicial da situação social, familiar e de autonomia.', ref: FONTE_CD, onde: 'Avaliações.' },
      { key: 'cd_pic', title: 'Plano Individual (PI)', detail: 'Objetivos, atividades e apoios de que a pessoa precisa, revisto pelo menos uma vez por ano.', ref: FONTE_CD, onde: 'Ficha do utente → Plano.' },
      { key: 'cd_presencas', title: 'Registo diário de presenças', detail: 'Folha de presenças com entrada e saída por utente — base da comparticipação e da segurança.', ref: FONTE_CD, onde: 'Presenças.' },
      { key: 'cd_medicacao', title: 'Medicação dada no centro', detail: 'Autorização escrita e prescrição para cada medicamento administrado no centro, e registo de cada toma. O que a família dá em casa fica claramente separado.', ref: FONTE_CD, onde: 'Medicação a dar (onde se toma).' },
    ],
  },
  {
    group: 'Serviços',
    items: [
      { key: 'cd_ementas', title: 'Ementas e dietas', detail: 'Ementa do almoço e lanche adequada às dietas e alergias, afixada e validada.', ref: FONTE_CD, onde: 'Refeições.' },
      { key: 'cd_transporte', title: 'Transporte', detail: 'Condições de segurança, seguro adequado e registo dos circuitos, quando o centro assegura o transporte.', ref: FONTE_CD, onde: 'Serviços de apoio → circuitos.' },
      { key: 'cd_higiene', title: 'Higiene e conforto', detail: 'Apoio em cuidados de higiene pessoal, quando contratado.', ref: FONTE_CD, onde: 'Cuidados de rotina.' },
    ],
  },
]

/** O apoio domiciliário tem portaria própria. Só aparece se a casa o prestar. */
export const SAD: ComplianceGroup = {
  group: 'Serviço de apoio domiciliário',
  nota: 'A Portaria n.º 38/2013 é a do SAD — não é a mesma do lar nem a do centro de dia.',
  items: [
    { key: 'sad_licenca', title: 'Licença ou acordo de SAD', detail: 'Licenciamento válido da resposta social de apoio domiciliário.', ref: 'Portaria n.º 38/2013, art. 3.º' },
    { key: 'sad_contrato', title: 'Contrato com os serviços contratados', detail: 'Contrato que identifica quais dos serviços da portaria são prestados a cada pessoa e com que frequência.', ref: 'Portaria n.º 38/2013, art. 8.º' },
    { key: 'sad_plano', title: 'Plano individual com os serviços e os dias', detail: 'Que serviços, em que dias, a que horas — e revisto quando a situação muda.', ref: 'Portaria n.º 38/2013, art. 9.º', onde: 'Apoio domiciliário → Quem recebe.' },
    { key: 'sad_registo_visitas', title: 'Registo de cada visita', detail: 'Registo do que foi feito em cada deslocação, com hora e identificação de quem foi — incluindo as visitas em que não estava ninguém.', ref: 'Portaria n.º 38/2013, art. 9.º', onde: 'Apoio domiciliário → A volta.' },
    { key: 'sad_servicos', title: 'Serviços mínimos assegurados', detail: 'Higiene pessoal e habitacional, alimentação, tratamento de roupa e acompanhamento ao exterior, conforme contratado.', ref: 'Portaria n.º 38/2013, art. 4.º', onde: 'Apoio domiciliário → serviços do plano.' },
  ],
}

export function checklistFor(institution: InstitutionType): ComplianceGroup[] {
  const base = institution === 'nursing_home' ? ERPI : CENTRO_DIA
  /* O `refPor` resolve-se AQUI e não em cada ecrã: a página, o documento
     impresso e as guardas têm de ler a mesma referência, e um item que mostre
     uma lei na página e outra no papel vale menos do que não mostrar nenhuma. */
  const resolver = (g: ComplianceGroup): ComplianceGroup => ({
    ...g,
    items: g.items.map(i => (i.refPor ? { ...i, ref: i.refPor[institution] ?? i.ref } : i)),
  })
  return [RGPD, SEGURANCA, ...base].map(resolver)
}

/** Todos os itens, para contar e para procurar. */
export function todosOsItens(institution: InstitutionType, temSAD = false): ComplianceItem[] {
  const gs = checklistFor(institution)
  return [...gs, ...(temSAD ? [SAD] : [])].flatMap(g => g.items)
}
