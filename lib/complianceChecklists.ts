// lib/complianceChecklists.ts
// Checklists de conformidade/legal POR TIPO DE INSTITUIÇÃO (Portugal).
// Itens orientadores (RGPD, registos obrigatórios, segurança, licenciamento).
// NÃO substitui aconselhamento jurídico — é uma ferramenta de organização e auditoria interna.

import type { InstitutionType } from './useClinicPrefs'

export type ComplianceItem = { key: string; title: string; detail: string; ref?: string }
export type ComplianceGroup = { group: string; items: ComplianceItem[] }

// Itens transversais a (quase) todas as instituições de saúde.
const COMMON: ComplianceGroup[] = [
  { group: 'Proteção de dados (RGPD)', items: [
    { key: 'rgpd_registo_atividades', title: 'Registo de atividades de tratamento', detail: 'Documento que descreve que dados de saúde são tratados, finalidade e prazos de conservação.', ref: 'RGPD art. 30.º' },
    { key: 'rgpd_consentimento', title: 'Consentimento informado documentado', detail: 'Modelo de consentimento para tratamento de dados clínicos, assinado e arquivado.', ref: 'RGPD art. 6.º/9.º' },
    { key: 'rgpd_encarregado', title: 'Encarregado de Proteção de Dados (DPO)', detail: 'DPO designado e contacto divulgado (obrigatório quando há tratamento em larga escala de dados de saúde).', ref: 'RGPD art. 37.º' },
    { key: 'rgpd_violacao', title: 'Procedimento de violação de dados', detail: 'Processo para notificar a CNPD em 72h em caso de quebra de segurança.', ref: 'RGPD art. 33.º' },
  ]},
  { group: 'Segurança e qualidade', items: [
    { key: 'seg_incidentes', title: 'Registo de incidentes', detail: 'Todos os incidentes/quase-incidentes registados e analisados.', ref: 'Gestão de risco' },
    { key: 'seg_emergencia', title: 'Plano de emergência interno', detail: 'Procedimentos de evacuação e contactos de emergência afixados e conhecidos pela equipa.' },
    { key: 'seg_formacao', title: 'Formação da equipa atualizada', detail: 'Registo de formações obrigatórias (suporte de vida, controlo de infeção, RGPD).' },
  ]},
]

const EXTRA: Record<InstitutionType, ComplianceGroup[]> = {
  pharmacy_community: [
    { group: 'Farmácia comunitária', items: [
      { key: 'farm_dt', title: 'Diretor técnico presente', detail: 'Direção técnica assegurada e identificada ao público.', ref: 'INFARMED' },
      { key: 'farm_psicotropicos', title: 'Registo de psicotrópicos e estupefacientes', detail: 'Livro/registo de movimentos atualizado e conferido.', ref: 'DL 15/93' },
      { key: 'farm_temperatura', title: 'Controlo de temperatura do frigorífico', detail: 'Registo diário da temperatura de conservação de medicamentos.' },
      { key: 'farm_prazos', title: 'Verificação de prazos de validade', detail: 'Rotina periódica de remoção de produtos fora de validade.' },
    ]},
  ],
  health_center: [
    { group: 'Centro de saúde / USF', items: [
      { key: 'cs_vacinas_cadeia', title: 'Cadeia de frio das vacinas', detail: 'Registo de temperatura dos frigoríficos de vacinas e plano de contingência.' },
      { key: 'cs_residuos', title: 'Gestão de resíduos hospitalares', detail: 'Separação e recolha de resíduos dos grupos III/IV conforme legislação.', ref: 'DL 102-D/2020' },
      { key: 'cs_consentimento_menores', title: 'Consentimento de menores', detail: 'Procedimento para consentimento de representantes legais.' },
    ]},
  ],
  clinic: [
    { group: 'Clínica / consultório', items: [
      { key: 'cli_ers', title: 'Licenciamento ERS', detail: 'Registo na Entidade Reguladora da Saúde válido e afixado.', ref: 'ERS' },
      { key: 'cli_seguro', title: 'Seguro de responsabilidade civil', detail: 'Apólice válida para a atividade clínica.' },
      { key: 'cli_residuos', title: 'Gestão de resíduos clínicos', detail: 'Contrato de recolha de resíduos de grupo III/IV.' },
      { key: 'cli_recibos', title: 'Recibos e faturação', detail: 'Emissão de fatura-recibo conforme obrigações fiscais.' },
    ]},
  ],
  hospital: [
    { group: 'Hospital / serviço', items: [
      { key: 'hosp_consentimento_cirurgico', title: 'Consentimento cirúrgico/procedimentos', detail: 'Consentimento informado específico por procedimento invasivo.' },
      { key: 'hosp_infecao', title: 'Comissão de controlo de infeção', detail: 'Protocolos PPCIRA implementados e auditados.', ref: 'DGS PPCIRA' },
      { key: 'hosp_farmacovigilancia', title: 'Farmacovigilância', detail: 'Notificação de reações adversas ao INFARMED.' },
    ]},
  ],
  pharmacy_hospital: [
    { group: 'Farmácia hospitalar', items: [
      { key: 'fh_rastreabilidade', title: 'Rastreabilidade do medicamento', detail: 'Registo de lote e validade desde a receção à administração.' },
      { key: 'fh_citostaticos', title: 'Preparação de citostáticos', detail: 'Câmara de fluxo e procedimentos de manipulação segura.' },
      { key: 'fh_psicotropicos', title: 'Controlo de psicotrópicos', detail: 'Registo e conferência de estupefacientes.', ref: 'DL 15/93' },
    ]},
  ],
  nursing_home: [
    { group: 'Lar / ERPI', items: [
      { key: 'erpi_licenca', title: 'Licença de funcionamento ERPI', detail: 'Acordo/licença da Segurança Social válida.', ref: 'Segurança Social' },
      { key: 'erpi_racio', title: 'Rácio de pessoal por residente', detail: 'Cumprimento dos rácios mínimos de cuidadores e enfermagem.' },
      { key: 'erpi_contrato', title: 'Contrato de prestação de cuidados', detail: 'Contrato assinado com residente/representante, com plano individual.' },
      { key: 'erpi_dietas', title: 'Plano de ementas validado', detail: 'Ementas adequadas a dietas e alergias, validadas por nutrição.' },
      { key: 'erpi_pic', title: 'Plano Individual de Cuidados (PIC)', detail: 'PIC elaborado e revisto periodicamente para cada residente.' },
    ]},
  ],
  day_care: [
    { group: 'Centro de Dia', items: [
      { key: 'cd_licenca', title: 'Licença/acordo de Centro de Dia', detail: 'Licenciamento da resposta social "Centro de Dia" válido junto da Segurança Social.', ref: 'Segurança Social · Portaria 67/2012' },
      { key: 'cd_contrato', title: 'Contrato de prestação de serviços', detail: 'Contrato assinado com o utente/representante, com plano de atividades e horário de frequência.' },
      { key: 'cd_presencas', title: 'Registo diário de presenças', detail: 'Folha de presenças por utente (entrada/saída) — base da comparticipação e da segurança.' },
      { key: 'cd_pic', title: 'Plano Individual (PI)', detail: 'Plano individual com objetivos, atividades e necessidades de apoio, revisto periodicamente.' },
      { key: 'cd_medicacao', title: 'Procedimento de medicação do dia', detail: 'Protocolo claro de quais tomas são dadas no centro vs. em casa, com autorização escrita da família/médico.' },
      { key: 'cd_transporte', title: 'Transporte (se aplicável)', detail: 'Condições de segurança e seguro do transporte de utentes, quando o centro o assegura.' },
      { key: 'cd_ementas', title: 'Ementas e dietas (almoço)', detail: 'Ementa do almoço/lanche adequada a dietas e alergias de cada utente.' },
    ]},
  ],
}

export function checklistFor(institution: InstitutionType): ComplianceGroup[] {
  return [...(EXTRA[institution] || []), ...COMMON]
}
