// lib/ropa.ts
// ═══════════════════════════════════════════════════════════════════════════
// O REGISTO DE ATIVIDADES DE TRATAMENTO (art. 30.º) — gerado, não escrito
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE É, E PORQUE É QUE TODA A GENTE O TEM EM BRANCO ───────────────────
// O artigo 30.º obriga qualquer entidade que trate dados de saúde a manter um
// registo escrito do que trata, para quê, com que fundamento, a quem o
// comunica e durante quanto tempo o guarda. É a PRIMEIRA coisa que a CNPD pede
// numa fiscalização, e a maior parte das casas tem um ficheiro Word que alguém
// copiou de um modelo em 2018 e nunca mais abriu.
//
// A razão por que fica em branco é simples: ninguém sabe responder. Quem
// escreve o documento é a direção técnica, e quem sabe que dados o software
// guarda é o software.
//
// ── A IDEIA ────────────────────────────────────────────────────────────────
// O Phlox sabe. Sabe que tabelas existem, que área as protege, que colunas
// têm, e quem lá escreve. A checklist de conformidade dizia «tenha um registo
// de atividades de tratamento» e deixava a casa a olhar para o teto; isto
// GERA-O, com os nomes reais das tabelas por baixo de cada atividade.
//
// ── O QUE ISTO NÃO FAZ, E TEM DE SE DIZER ──────────────────────────────────
// Não substitui a decisão da casa. Uma casa pode tratar dados FORA do Phlox —
// o livro de reclamações em papel, as câmaras de videovigilância, os currículos
// que chegam por email — e nada disso aparece aqui, porque o Phlox não os vê.
//
// Por isso o documento gerado diz, em letra visível, que cobre o tratamento
// FEITO ATRAVÉS DO PHLOX e que a casa tem de acrescentar o resto. Um registo
// que se apresenta como completo e não é, é pior do que não haver nenhum: dá
// uma falsa segurança numa inspeção.

import { PRAZOS, BASES_GERAIS, BASES_ESPECIAIS, type BaseGeral, type BaseEspecial } from './rgpd'
import { AREA_DA_TABELA } from './areasDeDados'

export interface Atividade {
  id: string
  /** O nome pelo qual a direção técnica a reconhece. */
  nome: string
  /** Para que serve. Art. 30.º/1-b. */
  finalidade: string
  /** De quem são os dados. Art. 30.º/1-c. */
  titulares: string[]
  /** Que categorias de dados. Art. 30.º/1-c. */
  categorias: string[]
  /** Há dados do art. 9.º aqui? */
  especiais: boolean
  base: BaseGeral
  baseEspecial: BaseEspecial
  /** A que prazo de `lib/rgpd` obedece. */
  prazo: string
  /** A quem se comunicam, além dos subcontratantes. Art. 30.º/1-d. */
  destinatarios: string[]
  /** As tabelas reais. É isto que torna o documento verificável. */
  tabelas: string[]
  /** Só existe se a casa usar esta resposta social. */
  so?: 'sad' | 'centro_dia' | 'lar'
}

export const ATIVIDADES: Atividade[] = [
  {
    id: 'processo',
    nome: 'Processo individual do utente',
    finalidade:
      'Identificar a pessoa, saber quem a representa e quem avisar, e reunir num só '
      + 'sítio o que é preciso para cuidar dela — conforme exige a Portaria n.º 67/2012.',
    titulares: ['Utentes', 'Representantes legais', 'Familiares de contacto'],
    categorias: [
      'Identificação (nome, data de nascimento, n.º de utente)',
      'Contactos (morada, telefone)',
      'Saúde (diagnósticos, alergias, condições)',
      'Dados do representante e dos contactos de emergência',
    ],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'processo_individual',
    destinatarios: ['Segurança Social, quando solicitado no âmbito de fiscalização ou de acordo de cooperação'],
    tabelas: ['patients', 'resident_contacts', 'etiquetas_do_utente', 'documents', 'etiquetas', 'bens_do_utente', 'vacinas_do_utente', 'ausencias_do_utente', 'patient_channels', 'modelos_documentos', 'documentos_emitidos', 'conta_do_utente', 'beds', 'wards'],
  },
  {
    id: 'medicacao',
    nome: 'Medicação: prescrição e administração',
    finalidade:
      'Registar o que cada pessoa toma, a que horas, e o que foi efetivamente dado, '
      + 'recusado ou suspenso — para que o turno seguinte saiba e para que haja prova.',
    titulares: ['Utentes'],
    categorias: [
      'Saúde (medicamentos, doses, vias, indicações)',
      'Registo de administração com hora e autor',
    ],
    especiais: true,
    base: 'obrigacao_legal',
    baseEspecial: 'cuidados_saude',
    prazo: 'registos_clinicos',
    destinatarios: [
      'Médico assistente, quando a casa o envolve',
      'Farmácia que prepara a medicação, quando a casa lhe partilha o mapa terapêutico do utente',
    ],
    tabelas: ['patient_meds', 'mar_records', 'medication_prep_logs', 'tomas_sos', 'medicacao_alteracoes', 'partilhas_farmacia'],
  },
  {
    id: 'cuidados',
    nome: 'Registos de cuidados do dia',
    finalidade:
      'Registar presenças, alimentação, humor, continência, pele, sinais vitais e '
      + 'cuidados prestados, para acompanhar a pessoa e para provar o que foi feito; '
      + 'e marcar as consultas e exames fora da casa, para que a pessoa lá chegue.',
    titulares: ['Utentes'],
    categorias: [
      'Saúde', 'Hábitos e rotina diária', 'Presença e horários',
      'Consultas e exames marcados (data, especialidade, onde)',
    ],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'registos_clinicos',
    destinatarios: [],
    tabelas: ['care_records', 'attendance', 'rounds', 'round_assignments', 'wounds', 'vitals', 'hydration_logs', 'health_checkins', 'care_checklists', 'care_checklist_logs', 'cuidados_nao_prestados', 'dietary_reinforcements', 'handovers', 'passagem_leituras', 'patient_vigilance', 'servicos_do_utente', 'servicos_execucoes', 'catalogo_servicos', 'appointments'],
  },
  {
    id: 'avaliacoes',
    nome: 'Avaliações, escalas e planos individuais',
    finalidade:
      'Avaliar autonomia, risco de queda, risco de úlcera, estado nutricional e '
      + 'cognitivo, e manter o plano individual que a Portaria n.º 67/2012 exige.',
    titulares: ['Utentes'],
    categorias: ['Saúde', 'Avaliação funcional e cognitiva', 'Objetivos e plano de intervenção'],
    especiais: true,
    base: 'obrigacao_legal',
    baseEspecial: 'cuidados_saude',
    prazo: 'processo_individual',
    destinatarios: ['Segurança Social, no âmbito de fiscalização'],
    tabelas: ['assessments', 'care_plans', 'adl_reviews', 'planos', 'plano_objetivos', 'plano_acoes', 'plano_execucoes', 'plano_avaliacoes'],
  },
  {
    id: 'psicossocial',
    nome: 'Acompanhamento psicossocial',
    finalidade:
      'Acompanhar o bem-estar emocional e a rede de apoio, aplicar escalas de rastreio '
      + 'e registar as sessões — incluindo notas reservadas a quem acompanha.',
    titulares: ['Utentes'],
    categorias: [
      'Saúde (estado emocional, rastreios)',
      'Vida privada e familiar (rede de apoio, história de vida)',
    ],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'processo_individual',
    destinatarios: ['Profissionais externos de psicologia ou psiquiatria, quando há encaminhamento'],
    tabelas: ['psychosocial_notes', 'psi_processo', 'psi_sessoes', 'psi_instrumentos'],
  },
  {
    id: 'ocorrencias',
    nome: 'Ocorrências, quedas e segurança',
    finalidade:
      'Registar o que correu mal, o seguimento que teve e o que se mudou para não '
      + 'voltar a acontecer. É também a prova em caso de reclamação ou de litígio.',
    titulares: ['Utentes', 'Equipa envolvida'],
    categorias: ['Saúde', 'Descrição do acontecimento', 'Identificação de quem registou'],
    especiais: true,
    base: 'obrigacao_legal',
    baseEspecial: 'cuidados_saude',
    prazo: 'ocorrencias',
    destinatarios: ['Segurança Social', 'Seguradora', 'Autoridades, quando a lei o exigir'],
    tabelas: ['incidents', 'safety_events'],
  },
  {
    id: 'familias',
    nome: 'Comunicação com as famílias',
    finalidade:
      'Dar notícias do dia, responder a perguntas e marcar visitas — e deixar '
      + 'registado o que foi dito a quem.',
    titulares: ['Familiares', 'Representantes legais', 'Utentes (indiretamente)'],
    categorias: ['Identificação e contactos', 'Conteúdo das mensagens', 'Saúde, quando a mensagem a refere'],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'processo_individual',
    destinatarios: [],
    tabelas: ['family_thread_messages', 'visit_requests', 'family_profile_shares', 'family_messages', 'resident_requests', 'family_institution_links'],
  },
  {
    id: 'equipa',
    nome: 'Gestão da equipa',
    finalidade:
      'Saber quem trabalha na casa, com que função e com que acessos; organizar '
      + 'escalas e turnos; e manter o registo de formação que a ASAE e a Segurança '
      + 'Social pedem.',
    titulares: ['Trabalhadores', 'Voluntários', 'Prestadores de serviços'],
    categorias: ['Identificação e contactos', 'Função e acessos', 'Formação e certificados', 'Horários e ausências'],
    especiais: false,
    base: 'contrato',
    baseEspecial: 'nenhuma',
    prazo: 'equipa',
    destinatarios: ['ACT e Segurança Social, no âmbito de fiscalização'],
    tabelas: ['org_members', 'team_members', 'shifts', 'formacoes_da_equipa', 'team_messages', 'ausencias_da_equipa', 'shift_assignments', 'shift_checkins', 'shift_vacancies', 'team_reads', 'team_spaces', 'team_tasks'],
  },
  {
    id: 'financeiro',
    nome: 'Mensalidades, comparticipações e faturação',
    finalidade:
      'Calcular e cobrar a mensalidade, registar comparticipações e emitir o '
      + 'extrato de conta de cada utente.',
    titulares: ['Utentes', 'Quem assume o pagamento'],
    categorias: ['Identificação', 'Dados fiscais', 'Movimentos de conta e pagamentos'],
    especiais: false,
    base: 'obrigacao_legal',
    baseEspecial: 'nenhuma',
    prazo: 'faturacao',
    destinatarios: ['Autoridade Tributária', 'Contabilidade', 'Segurança Social (comparticipações)'],
    tabelas: ['conta_corrente', 'movimentos_conta', 'billing_entries', 'finance_entries', 'sales'],
  },
  {
    id: 'admissoes',
    nome: 'Candidaturas, lista de espera e admissões',
    finalidade:
      'Receber pedidos de vaga, aplicar os critérios de prioridade do regulamento '
      + 'interno e decidir admissões de forma documentada.',
    titulares: ['Candidatos', 'Quem apresenta a candidatura'],
    categorias: ['Identificação e contactos', 'Situação social e familiar', 'Saúde, quando declarada na candidatura'],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'candidaturas',
    destinatarios: ['Segurança Social, quando a candidatura é encaminhada'],
    tabelas: ['candidaturas', 'criterios_entrada'],
  },
  {
    id: 'domiciliario',
    nome: 'Serviço de apoio domiciliário',
    finalidade:
      'Organizar a volta diária, saber que serviços cada pessoa recebe e em que dias, '
      + 'e registar cada visita — incluindo as em que não estava ninguém em casa.',
    titulares: ['Utentes de apoio domiciliário'],
    categorias: [
      'Identificação e morada',
      'Saúde e grau de dependência',
      'Acesso à habitação (quem abre, onde está a chave)',
    ],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'processo_individual',
    destinatarios: ['Segurança Social, no âmbito do acordo de cooperação'],
    tabelas: ['sad_planos', 'sad_servicos', 'sad_visitas', 'support_transport_schedules', 'support_transport_routes', 'support_transport_logs', 'support_services', 'support_recurring_services', 'support_recurring_logs'],
    so: 'sad',
  },
  {
    id: 'atividades',
    nome: 'Plano de atividades e animação',
    finalidade:
      'Planear as atividades da casa e registar quem participou em cada uma. A '
      + 'participação é parte do plano individual e entra no relatório de atividades '
      + 'que o acordo de cooperação exige.',
    titulares: ['Utentes'],
    categorias: ['Identificação', 'Participação e presença', 'Motivo de não participação'],
    especiais: false,
    base: 'contrato',
    baseEspecial: 'nenhuma',
    prazo: 'registos_clinicos',
    destinatarios: ['Segurança Social, no relatório de atividades'],
    tabelas: ['activities', 'recurring_activities', 'activity_participations', 'calendario_marcas'],
  },
  {
    id: 'refeicoes',
    nome: 'Refeições, ementas e dietas',
    finalidade:
      'Planear ementas, registar as dietas e texturas de cada pessoa e controlar a '
      + 'temperatura dos alimentos — exigências do plano HACCP e da Portaria n.º 67/2012.',
    titulares: ['Utentes'],
    categorias: ['Saúde (dieta, textura, alergias alimentares)', 'Preferências alimentares'],
    especiais: true,
    base: 'obrigacao_legal',
    baseEspecial: 'cuidados_saude',
    prazo: 'registos_clinicos',
    destinatarios: ['ASAE, no âmbito de fiscalização alimentar'],
    tabelas: ['meal_dishes', 'meal_plan_entries', 'leituras_temperatura'],
  },
  {
    id: 'economato',
    nome: 'Stock, economato e fornecedores',
    finalidade:
      'Controlar existências, validades e consumos — incluindo o stock de medicação '
      + 'e de material de penso atribuído a cada pessoa.',
    titulares: ['Utentes (no stock que lhes é atribuído)', 'Contactos de fornecedores'],
    categorias: [
      'Identificação do utente associada a consumos',
      'Saúde, quando o artigo é medicação ou material clínico',
      'Contactos profissionais de fornecedores',
    ],
    especiais: true,
    base: 'contrato',
    baseEspecial: 'cuidados_saude',
    prazo: 'registos_clinicos',
    destinatarios: ['INFARMED, quando aplicável a medicamentos'],
    tabelas: ['stock_items', 'stock_movimentos', 'stock_consumption', 'stock_utente',
              'suppliers', 'purchase_orders', 'goods_receipts', 'equipamentos'],
  },
  {
    id: 'gestao_casa',
    nome: 'Gestão da casa: manutenção, conformidade e indicadores',
    finalidade:
      'Organizar as tarefas gerais do edifício, manter a checklist de conformidade e '
      + 'calcular os indicadores de atividade da casa.',
    titulares: ['Equipa'],
    categorias: ['Identificação de quem executou', 'Nenhum dado de utente identificável nos indicadores'],
    especiais: false,
    base: 'obrigacao_legal',
    baseEspecial: 'nenhuma',
    prazo: 'registo_atividade',
    destinatarios: ['Segurança Social e ASAE, no âmbito de fiscalização'],
    tabelas: ['tarefas_da_casa', 'tarefas_da_casa_execucoes', 'compliance_items',
              'kpi_snapshots', 'institution_settings'],
  },
  {
    id: 'consentimentos',
    nome: 'Consentimentos e autorizações',
    finalidade:
      'Guardar a prova de que a pessoa, ou quem a representa, autorizou o que só se '
      + 'pode fazer com autorização: fotografias, partilha de informação, saídas.',
    titulares: ['Utentes', 'Representantes legais'],
    categorias: ['Identificação', 'Objeto e data da autorização', 'Assinatura'],
    especiais: false,
    base: 'consentimento',
    baseEspecial: 'nenhuma',
    prazo: 'processo_individual',
    destinatarios: [],
    tabelas: ['consents'],
  },
  {
    id: 'registo_atividade',
    nome: 'Livro de registos da aplicação',
    finalidade:
      'Saber quem fez o quê e sobre quem. Serve para apurar responsabilidade quando '
      + 'algo corre mal e para cumprir o dever de rastreabilidade do acesso a dados '
      + 'de saúde.',
    titulares: ['Equipa', 'Utentes (como assunto do registo)'],
    categorias: ['Identificação de quem agiu', 'Ação praticada', 'Momento'],
    especiais: false,
    base: 'obrigacao_legal',
    baseEspecial: 'nenhuma',
    prazo: 'registo_atividade',
    destinatarios: [],
    tabelas: ['activity_log'],
  },
  {
    id: 'inqueritos',
    nome: 'Inquéritos de satisfação',
    finalidade:
      'Saber o que utentes, famílias e equipa acham do serviço, e comparar de ano '
      + 'para ano. A avaliação da satisfação é exigida pelo acordo de cooperação.',
    titulares: ['Utentes', 'Famílias', 'Equipa'],
    categorias: ['Nenhuma — as respostas não têm autor'],
    especiais: false,
    base: 'obrigacao_legal',
    baseEspecial: 'nenhuma',
    prazo: 'inqueritos',
    destinatarios: ['Segurança Social, no relatório de atividades'],
    tabelas: ['inqueritos', 'inqueritos_respostas'],
  },
]

/** As atividades que uma casa deste tipo realmente tem. */
export function atividadesDa(institution: string, temSAD: boolean): Atividade[] {
  return ATIVIDADES.filter(a => {
    if (a.so === 'sad') return temSAD
    if (a.so && a.so !== institution) return false
    return true
  })
}

/**
 * As tabelas que o Phlox tem e que NENHUMA atividade reclama.
 *
 * ── PORQUE É QUE ISTO ESTÁ AQUI ────────────────────────────────────────────
 * Porque é a única forma de este registo não envelhecer em silêncio. Nasce uma
 * ferramenta, nasce uma tabela, e o registo de atividades continua igual — a
 * dizer que se trata menos do que se trata. É assim que um documento destes
 * fica errado sem ninguém mexer nele.
 *
 * O `scripts/check-ropa.mjs` corre isto e falha quando sobra alguma. Uma tabela
 * nova ou entra numa atividade existente, ou obriga a escrever uma nova.
 */
export function tabelasSemAtividade(): string[] {
  const cobertas = new Set(ATIVIDADES.flatMap(a => a.tabelas))
  return Object.keys(AREA_DA_TABELA).filter(t => !cobertas.has(t)).sort()
}

/** O aviso que o documento leva sempre, e que não se tira. */
export const LIMITE_DO_REGISTO =
  'Este registo cobre o tratamento de dados feito ATRAVÉS DO PHLOX. A instituição '
  + 'trata quase de certeza dados por outras vias — videovigilância, livro de '
  + 'reclamações, currículos recebidos por email, processos em papel, registos '
  + 'biométricos de assiduidade — e esses têm de ser acrescentados a este documento '
  + 'pela própria instituição. Um registo apresentado como completo sem o ser é pior '
  + 'do que não haver nenhum.'

export { BASES_GERAIS, BASES_ESPECIAIS, PRAZOS }
