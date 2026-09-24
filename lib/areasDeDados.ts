// lib/areasDeDados.ts
// ─────────────────────────────────────────────────────────────────────────────
// Que área de permissões protege cada tabela, e cada página.
//
// ── PORQUE É QUE ISTO EXISTE EM SEPARADO ────────────────────────────────────
// `lib/permissoes.ts` diz QUE áreas existem e quem tem o quê. Este ficheiro diz
// ONDE essas áreas se aplicam: a que tabela da base de dados e a que endereço
// do site. São duas perguntas diferentes e mudam em alturas diferentes — o
// catálogo é estável, este mapa cresce sempre que nasce uma ferramenta.
//
// É daqui que sai a RLS (ver scripts/gerar-sql-rls.mjs) e é daqui que o menu
// sabe o que esconder.
//
// ── A REGRA QUE NÃO SE QUEBRA: NA DÚVIDA, NÃO SE ADIVINHA ──────────────────
// Uma tabela mapeada para a área errada faz uma de duas coisas, ambas más:
// abre dados a quem não devia vê-los, ou fecha uma ferramenta a quem precisa
// dela para trabalhar. Por isso uma tabela que não esteja nesta lista **não
// recebe política de área nenhuma** — fica com o que já tinha (o âmbito por
// organização, que continua a impedir que uma casa veja os dados de outra).
//
// Falhar por não proteger o suficiente é mau; falhar por trancar a porta a
// quem lá trabalha, a meio de um turno, é pior — e não se desfaz a tempo.
// ─────────────────────────────────────────────────────────────────────────────

/** tabela → área. Só as que têm `org_id` e que eu sei mesmo o que são. */
export const AREA_DA_TABELA: Record<string, string> = {
  // ── Utentes ──────────────────────────────────────────────────────────────
  patients: 'utentes',
  resident_contacts: 'utentes',
  patient_channels: 'utentes',
  care_plans: 'utentes',
  // O Plano Individual (PIC/PII) — sprint157. A área base é `utentes`: ver o
  // plano faz parte de conhecer a pessoa. Cada OBJETIVO tem ainda a sua
  // própria área (um objetivo de medicação é da enfermagem), e essa é aplicada
  // por políticas próprias, escritas no sprint157 — o gerador só sabe fazer
  // uma área por tabela.
  planos: 'utentes',
  plano_objetivos: 'utentes',
  plano_acoes: 'utentes',
  plano_avaliacoes: 'utentes',
  // O que se fez de uma acao do plano (sprint158). Area `registos`, e nao
  // `utentes`: quem marca isto e quem esta a trabalhar o turno, e e a mesma
  // gente que escreve os registos do dia.
  plano_execucoes: 'registos',

  // ── Medicação ────────────────────────────────────────────────────────────
  patient_meds: 'medicacao',
  mar_records: 'medicacao',
  medication_prep_logs: 'medicacao',
  patient_vigilance: 'medicacao',

  // ── Registos do dia ──────────────────────────────────────────────────────
  care_records: 'registos',
  // O que NÃO foi feito, e porquê (sprint154). Vive na mesma área do que foi
  // feito, de propósito: quem escreve o registo do dia é quem escreve isto.
  cuidados_nao_prestados: 'registos',
  attendance: 'registos',
  vitals: 'registos',
  hydration_logs: 'registos',
  meal_plan_entries: 'registos',
  meal_dishes: 'registos',
  dietary_reinforcements: 'registos',
  rounds: 'registos',
  round_assignments: 'registos',
  care_checklists: 'registos',
  care_checklist_logs: 'registos',
  health_checkins: 'registos',
  adl_reviews: 'registos',
  handovers: 'registos',
  // Serviços de apoio: roupa, transporte, acompanhamento. Fazem parte do dia.
  support_services: 'registos',
  support_recurring_services: 'registos',
  support_transport_routes: 'registos',
  support_transport_schedules: 'registos',
  support_transport_logs: 'registos',
  resident_requests: 'registos',

  // ── Ocorrências ──────────────────────────────────────────────────────────
  incidents: 'ocorrencias',
  safety_events: 'ocorrencias',

  // ── Avaliações e acompanhamento ──────────────────────────────────────────
  assessments: 'avaliacoes',
  psychosocial_notes: 'avaliacoes',

  // ── Feridas ──────────────────────────────────────────────────────────────
  wounds: 'feridas',

  // ── Atividades ───────────────────────────────────────────────────────────
  activities: 'atividades',
  activity_participations: 'atividades',
  recurring_activities: 'atividades',

  // ── Famílias ─────────────────────────────────────────────────────────────
  family_messages: 'familias',
  family_thread_messages: 'familias',
  visit_requests: 'familias',

  // ── Equipa ───────────────────────────────────────────────────────────────
  team_members: 'equipa',
  team_messages: 'equipa',
  team_reads: 'equipa',
  team_spaces: 'equipa',
  team_tasks: 'equipa',
  shift_assignments: 'equipa',
  shift_checkins: 'equipa',
  shift_vacancies: 'equipa',

  // ── Stock ────────────────────────────────────────────────────────────────
  stock_items: 'stock',
  stock_consumption: 'stock',
  purchase_orders: 'stock',
  goods_receipts: 'stock',
  suppliers: 'stock',

  // ── Documentos ───────────────────────────────────────────────────────────
  documents: 'documentos',
  consents: 'documentos',

  // ── Qualidade ────────────────────────────────────────────────────────────
  kpi_snapshots: 'qualidade',
  compliance_items: 'qualidade',

  // ── Financeiro ───────────────────────────────────────────────────────────
  // A área mais sensível de todas numa casa: é aqui que está quanto cada
  // família paga e o que a casa fatura.
  billing_entries: 'financeiro',
  finance_entries: 'financeiro',
  sales: 'financeiro',

  // ── Registo de atividade ─────────────────────────────────────────────────
  // Privado da instituição, por decisão de produto. Nenhuma rota /api/admin
  // lhe pode tocar.
  activity_log: 'registo_atividade',

  // ── Definições da casa ───────────────────────────────────────────────────
  institution_settings: 'definicoes',
  beds: 'definicoes',
  wards: 'definicoes',
}

/**
 * Tabelas com `org_id` que NÃO recebem política de área, e porquê.
 *
 * Estar nesta lista não é esquecimento: é uma decisão registada. Continuam
 * protegidas pelo âmbito da organização (uma casa nunca vê os dados de outra);
 * o que não têm é restrição POR ÁREA lá dentro.
 */
export const SEM_AREA: Record<string, string> = {
  org_members: 'A própria tabela de quem pertence à casa. Protegê-la por área criaria uma dependência circular: para saber se posso ler as permissões, teria de ler as permissões.',
  org_invites: 'Mesma razão do org_members.',
  profiles: 'É de pessoas, não de casas. Tem o seu próprio âmbito.',
  marcadores_leitura: 'É de cada pessoa, não da casa: a hora a que EU abri cada ferramenta. A política que lá está (só o próprio) é mais apertada do que qualquer área, e uma área por cima só podia abri-la.',

  // Restos da altura em que o Phlox servia farmácias, clínicas e hospitais.
  // Não são usados por nenhuma página do produto atual. Uma área errada aqui
  // não abre nada (não há lá dados) mas podia partir uma migração futura.
  episodes: 'Sem uso na aplicação. Ver o sprint152.',
  prescriptions: 'Restos da versão clínica; sem uso no produto atual.',
  prescription_queue: 'Restos da versão de farmácia.',
  pharma_interventions: 'Restos da versão de farmácia.',
  loyalty_members: 'Restos da versão de farmácia.',
  loyalty_programs: 'Restos da versão de farmácia.',
  loyalty_rewards: 'Restos da versão de farmácia.',
  loyalty_transactions: 'Restos da versão de farmácia.',
  crm_contacts: 'Restos da versão de clínica.',
  crm_activities: 'Restos da versão de clínica.',
  telemed_sessions: 'Restos da versão de clínica.',
  surgeries: 'Restos da versão de hospital.',
  waiting_room: 'Restos da versão de clínica.',
  triage_assessments: 'Restos da versão de clínica.',
  encounters: 'Restos da versão de clínica.',
  appointments: 'Partilhado entre modos; a agenda pessoal também o usa.',
  lab_integrations: 'Integração técnica, sem interface própria.',
  fhir_inbound_log: 'Registo técnico de integração.',
  automations: 'Sem interface no produto atual.',
  automation_runs: 'Sem interface no produto atual.',
  agent_tasks: 'Sem interface no produto atual.',
  ai_queries: 'Registo técnico de uso de IA.',
}

/**
 * endereço → área. Decide o que aparece no menu e o que uma página pede.
 *
 * O prefixo mais LONGO ganha, para `/equipa?tab=mural` e `/painel-dono` não
 * se atrapalharem.
 */
export const AREA_DA_ROTA: Record<string, string> = {
  '/patients': 'utentes',
  '/residentes': 'utentes',
  '/mar': 'medicacao',
  '/preparacao-medicacao': 'medicacao',
  '/interactions': 'medicacao',
  '/reconciliacao': 'medicacao',
  '/vigia': 'medicacao',
  '/vigia-ruturas': 'stock',
  '/care-log': 'registos',
  '/o-dia': 'registos',
  '/refeicoes': 'registos',
  '/ronda-guiada': 'registos',
  '/apoio-servicos': 'registos',
  '/hidratacao': 'registos',
  '/incidents': 'ocorrencias',
  '/assessments': 'avaliacoes',
  '/autonomia': 'avaliacoes',
  '/apoio-psicossocial': 'avaliacoes',
  '/tendencias': 'avaliacoes',
  '/feridas': 'feridas',
  '/activities': 'atividades',
  '/family': 'familias',
  '/equipa': 'equipa',
  '/carga': 'equipa',
  '/guardiao': 'equipa',
  '/stock': 'stock',
  '/documentos': 'documentos',
  '/radar': 'qualidade',
  '/conformidade': 'qualidade',
  '/faturacao': 'financeiro',
  '/painel-dono': 'financeiro',
  '/historico': 'registo_atividade',
}

/** A área que protege este endereço, ou null quando não há nenhuma. */
export function areaDaRota(caminho: string): string | null {
  const limpo = (caminho || '').split('?')[0]
  let melhor: string | null = null
  for (const [prefixo, area] of Object.entries(AREA_DA_ROTA)) {
    if (limpo === prefixo || limpo.startsWith(prefixo + '/')) {
      if (!melhor || prefixo.length > melhor.length) melhor = prefixo
    }
  }
  return melhor ? AREA_DA_ROTA[melhor] : null
}

/** As tabelas de uma área. */
export function tabelasDaArea(area: string): string[] {
  return Object.entries(AREA_DA_TABELA).filter(([, a]) => a === area).map(([t]) => t)
}
