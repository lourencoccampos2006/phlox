// ─── Phlox tool registry ─────────────────────────────────────────────────────
// Catálogo organizado de ferramentas por modo. Sustenta a visibilidade adaptativa:
// o onboarding define o modo → mostramos SÓ os "default" desse modo; o utilizador
// adiciona extras nas Definições. Nomes em forma de necessidade (pessoal/cuidador).
//
// 2026-06-01: estendido para incluir o modo CLÍNICO com granularidade por
// tipo de instituição (uma ferramenta pode ser default em farmácia mas não em
// hospital, e vice-versa).

export type ToolMode = 'personal' | 'caregiver' | 'student' | 'clinical'
export type InstType = 'hospital' | 'pharmacy_hospital' | 'pharmacy_community' | 'nursing_home' | 'clinic' | 'health_center'
export type ToolPlan = 'free' | 'free_limited' | 'student' | 'pro'

export interface Tool {
  id: string            // = href
  label: string         // need-phrased
  desc: string
  category: string
  modes: ToolMode[]
  default?: ToolMode[]  // modos onde aparece por defeito
  /** Tipos de instituição em que esta ferramenta clínica fica ON por defeito.
   *  Só aplicável a ferramentas com mode='clinical'. */
  default_inst?: InstType[]
  plan: ToolPlan
}

export const TOOL_CATEGORIES: Record<string, { label: string; color: string }> = {
  meds:        { label: 'Medicação',           color: '#0d9488' },
  health:      { label: 'A minha saúde',       color: '#e11d48' },
  understand:  { label: 'Perceber',            color: '#2563eb' },
  family:      { label: 'Família',             color: '#b45309' },
  study:       { label: 'Estudar & treinar',   color: '#7c3aed' },
  // ── Clínico ────────────────────────────────────────────────────────────
  clinical_daily:    { label: 'Fluxo de trabalho',     color: '#1d4ed8' },
  clinical_decision: { label: 'Decisão clínica',       color: '#0f766e' },
  clinical_tools:    { label: 'Ferramentas pro',       color: '#7c3aed' },
  clinical_ops:      { label: 'Operações & equipa',    color: '#b45309' },
  clinical_quality:  { label: 'Qualidade & farmacovigilância', color: '#dc2626' },
  clinical_legal:    { label: 'Legal & documentos',    color: '#475569' },
}

// Defaults por instituição usados quando criamos a lista de "extras a ligar".
// Espelham o que cada NAV_BY_INST (em ClinicalLayout) já mostra hoje, para
// não mudar a experiência ao utilizador atual.
const NH:  InstType[] = ['nursing_home']
const PHC: InstType[] = ['pharmacy_community']
const PHH: InstType[] = ['pharmacy_hospital']
const HOS: InstType[] = ['hospital']
const CLN: InstType[] = ['clinic']
const HC:  InstType[] = ['health_center']
const ALL_INST: InstType[] = ['hospital', 'pharmacy_hospital', 'pharmacy_community', 'nursing_home', 'clinic', 'health_center']

export const TOOLS: Tool[] = [
  // ══ PESSOAL / CUIDADOR / ESTUDANTE ════════════════════════════════════════
  // ── Medicação ──
  { id: '/scan',         label: 'Phlox Scan — foto de qualquer coisa', desc: 'Receita, caixa, análise ou relatório: a IA percebe', category: 'meds', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/mymeds',       label: 'Os meus medicamentos',          desc: 'Lista, lembretes e adesão',        category: 'meds',       modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/interactions', label: 'Os meus medicamentos dão-se bem?', desc: 'Verificar interações',          category: 'meds',       modes: ['personal', 'caregiver', 'student'], default: ['personal', 'caregiver'], plan: 'free_limited' },
  { id: '/food-drug',    label: 'O que não posso misturar?',     desc: 'Alimentos e álcool a evitar',      category: 'meds',       modes: ['personal', 'caregiver'], plan: 'free' },

  // ── A minha saúde ──
  { id: '/vitals',       label: 'Acompanhar tensão, peso e açúcar', desc: 'Registo e tendências',          category: 'health',     modes: ['personal', 'caregiver'], default: ['personal'], plan: 'free' },
  { id: '/sintomas',     label: 'Como me sinto hoje?',           desc: 'Diário de sintomas e bem-estar',   category: 'health',     modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/relatorio',    label: 'Como correu a minha semana?',   desc: 'Relatório semanal por IA',         category: 'health',     modes: ['personal', 'caregiver'], plan: 'student' },
  { id: '/saude-agora',  label: 'Devo ir ao médico ou ajudar já?', desc: 'Triagem + primeiros socorros num só', category: 'health', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/medico-bolso', label: 'O Phlox olha pela minha saúde',   desc: 'Deteta sozinho o que merece atenção', category: 'health', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/risco',        label: 'O meu perfil de risco',         desc: 'SCORE2 + STOPP + carga anticolinérgica', category: 'health', modes: ['personal', 'caregiver'], plan: 'student' },
  { id: '/preventivo',   label: 'Estou em dia com a minha saúde?', desc: 'Rastreios e vacinas em falta (normas DGS)', category: 'health', modes: ['personal', 'caregiver'], plan: 'free' },
  { id: '/timeline',     label: 'A minha história de saúde',      desc: 'Medicação, análises e sintomas numa linha do tempo', category: 'health', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/vault',        label: 'Cofre de documentos clínicos',  desc: 'Análises, receitas, partilha por código', category: 'health', modes: ['personal', 'caregiver'], default: ['personal'], plan: 'free' },
  { id: '/saude360',     label: 'Vista 360° da minha saúde',     desc: 'Adesão + análises + agenda',       category: 'health',     modes: ['personal'], plan: 'student' },
  { id: '/health-pass',  label: 'Mostrar a minha saúde (QR)',    desc: 'QR para o médico/farmácia ver tudo', category: 'health',   modes: ['personal', 'caregiver'], plan: 'free' },

  // ── Perceber ──
  { id: '/ai',           label: 'Tirar uma dúvida de saúde',     desc: 'Assistente Phlox',                 category: 'understand', modes: ['personal', 'caregiver', 'student'], default: ['personal'], plan: 'free_limited' },
  { id: '/medicamento',  label: 'O que é este medicamento?',     desc: 'Foto da caixa → explicação simples', category: 'understand', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/receita',      label: 'Decifrar a receita médica',     desc: 'Foto da receita → tomas explicadas', category: 'understand', modes: ['personal', 'caregiver'], default: ['caregiver'], plan: 'free_limited' },
  { id: '/bula',         label: 'Perceber uma bula',             desc: 'Texto técnico em linguagem simples', category: 'understand', modes: ['personal', 'caregiver'], plan: 'free' },
  { id: '/labs',         label: 'Perceber as minhas análises',   desc: 'O que cada valor significa',       category: 'understand', modes: ['personal', 'caregiver'], plan: 'free_limited' },

  // ── Família (cuidador) ──
  { id: '/familia',      label: 'Gerir os perfis da família',    desc: 'Um perfil por familiar',           category: 'family',     modes: ['caregiver'], default: ['caregiver'], plan: 'free' },
  { id: '/familia360',   label: 'Família 360°',                  desc: 'Inbox + reconciliação + Zarit',    category: 'family',     modes: ['caregiver'], default: ['caregiver'], plan: 'student' },

  // ── Estudar & treinar ── (consolidado: máx ~14 ferramentas no modo estudante)
  { id: '/arena',        label: 'Competir na Arena',             desc: 'Ligas Bronze → Diamante',          category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/study',        label: 'Estudar com flashcards',        desc: '200+ tópicos, repetição espaçada', category: 'study',      modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/tutor',        label: 'AI Tutor',                      desc: 'Explica conceitos · mnemónicas · passo a passo', category: 'study', modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/simulador',    label: 'Simulador clínico',             desc: 'Casos clínicos com IA',            category: 'study',      modes: ['student'], plan: 'student' },
  { id: '/osce',         label: 'Treinar OSCE',                  desc: 'IA como doente, feedback real',    category: 'study',      modes: ['student'], plan: 'student' },
  { id: '/anatomia-3d',  label: 'Explorar em 3D',                desc: 'Atlas 3D real · pesquisa + AR',     category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/study360',     label: 'Estudo 360°',                   desc: 'Revisão espaçada · progresso · Pomodoro', category: 'study',   modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/aprender',     label: 'Hub Aprender',                  desc: 'Acesso central a todas as ferramentas de estudo', category: 'study', modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/study/notas',  label: 'Notas que te fazem rever',      desc: 'Flashcards automáticos · resumos · foto/voz', category: 'study', modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/study/documentos', label: 'Os meus documentos',        desc: 'Carrega sebentas/slides → pergunta e gera estudo', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/study/ecg',    label: 'Biblioteca de ECGs',            desc: '38 ECGs · avaliação IA',           category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/study/lab',    label: 'Lab interpreter',               desc: '60+ valores ref · interpretação IA', category: 'study',     modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/study/procedimentos', label: 'Procedimentos clínicos', desc: 'Guias passo-a-passo com checklist', category: 'study',     modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/modo-exame',   label: 'Modo Exame',                    desc: 'Plano até ao exame + gerar perguntas prováveis', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/study/professor', label: 'Modo Professor',             desc: 'Ensina o Phlox e descobre as tuas lacunas', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/estagio',      label: 'Estágio (completo)',            desc: 'Doentes, diário, casos, IA, relatórios', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },

  // ══ CLÍNICO ═══════════════════════════════════════════════════════════════
  // Fluxo de trabalho — base, vista por todos por defeito
  { id: '/cockpit',      label: 'Cockpit operacional',           desc: 'Dashboard do turno · alertas · KPIs', category: 'clinical_daily', modes: ['clinical'], default: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/patients',     label: 'Doentes / utentes',             desc: 'Fichas, medicação, alertas',       category: 'clinical_daily', modes: ['clinical'], default: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/mar',          label: 'Administração (MAR)',           desc: 'Registo por turno · alertas',      category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'hospital', 'pharmacy_hospital'], plan: 'pro' },
  { id: '/rounds',       label: 'Ronda farmacêutica',            desc: 'PCNE · intervenções',              category: 'clinical_daily', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital', 'nursing_home', 'clinic'], plan: 'pro' },
  { id: '/vigia',        label: 'Vigia Clínico do Lar',          desc: 'Vigilância farmacológica IA · todos os residentes', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/turno',        label: 'Turno',                         desc: 'Visão do turno actual',            category: 'clinical_daily', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital', 'nursing_home'], plan: 'pro' },
  { id: '/residentes',   label: 'Lares & residentes',            desc: 'Gestão farmacoterapêutica de lares', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/reconciliacao', label: 'Reconciliação de alta',         desc: 'Foto da nota de alta → o que mudou, omissões e conflitos', category: 'clinical_daily', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital', 'clinic', 'nursing_home'], plan: 'pro' },

  // NH específicas
  { id: '/care-log',     label: 'Registos diários (lar)',        desc: 'Sinais vitais, alimentação, humor', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/assessments',  label: 'Avaliações (Braden, MNA, ...)', desc: 'Escalas clínicas',                 category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'hospital'], plan: 'pro' },
  { id: '/care-plans',   label: 'Planos de cuidados',            desc: 'Individuais · PDF',                category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/incidents',    label: 'Ocorrências',                   desc: 'Quedas, erros med, comportamento', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'hospital'], plan: 'pro' },
  { id: '/activities',   label: 'Atividades',                    desc: 'Ginástica, arteterapia · participação', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/family',       label: 'Famílias (lar)',                desc: 'Mensagens, visitas, contactos',    category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/handover',     label: 'Passagem de turno',             desc: 'Relatório IA do turno',            category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'hospital'], plan: 'pro' },

  // Decisão clínica
  { id: '/oracle',       label: 'Oracle — AI consulta',          desc: 'SOAP · nota clínica · PCNE v9.1 · plano', category: 'clinical_decision', modes: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/food-drug',    label: 'Fármaco-alimento',              desc: 'Toranja · álcool · vitK · tiramina', category: 'clinical_decision', modes: ['clinical'], default_inst: ['pharmacy_community', 'pharmacy_hospital'], plan: 'pro' },
  { id: '/stopp-start',  label: 'STOPP / START',                 desc: 'v3 2023 + Beers',                  category: 'clinical_decision', modes: ['clinical'], default_inst: ['nursing_home', 'hospital'], plan: 'pro' },
  { id: '/antibiotics',  label: 'Antibioterapia + stewardship',  desc: 'MRSA/ESBL · empírica',             category: 'clinical_decision', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital'], plan: 'pro' },
  { id: '/protocol',     label: 'Protocolos',                    desc: 'ESC · ADA · NICE · DGS',           category: 'clinical_decision', modes: ['clinical'], default_inst: ['hospital'], plan: 'pro' },

  // Ferramentas pro — calculadoras consolidadas num único hub (/calculos)
  { id: '/calculos',     label: 'Calculadoras clínicas',         desc: 'Escalas, eGFR/CrCl, IV, PK, eletrólitos, doses urgência e pediátricas', category: 'clinical_tools', modes: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/tpn',          label: 'Nutrição parentérica',          desc: 'ASPEN 2022 · cálculo · rótulo',    category: 'clinical_tools', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital'], plan: 'pro' },
  // (calculators, pk-dosing, iv-calc, iv-compatibility, electrolytes, emergency-doses,
  //  dose-crianca, escalas → agora dentro do hub /calculos. Páginas mantidas, fora do menu.)

  // Operações & equipa
  { id: '/sala-espera',  label: 'Sala de espera',                desc: 'Doentes a chamar · tempo de espera', category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community', 'clinic', 'health_center'], plan: 'pro' },
  { id: '/tarefas-equipa', label: 'Tarefas da equipa',           desc: 'Atribuir · acompanhar',            category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community', 'clinic'], plan: 'pro' },
  { id: '/stock',        label: 'Stock & validades',             desc: 'Existências · ruturas · prazos',   category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community', 'pharmacy_hospital', 'nursing_home', 'hospital', 'clinic'], plan: 'pro' },
  { id: '/schedule',     label: 'Escalas / equipa',              desc: 'Turnos · vagas · competências',    category: 'clinical_ops', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_community'], plan: 'pro' },
  { id: '/team',         label: 'Equipa & tarefas',              desc: 'Membros, papéis, turnos, tarefas', category: 'clinical_ops', modes: ['clinical'], default_inst: ['hospital', 'nursing_home'], plan: 'pro' },
  { id: '/agenda',       label: 'Agenda',                        desc: 'Marcações · lembretes',            category: 'clinical_ops', modes: ['clinical'], default_inst: ['clinic', 'health_center', 'pharmacy_community'], plan: 'pro' },
  { id: '/vendas',       label: 'POS (vendas)',                  desc: 'Caixa · QR Code AT · SAF-T',       category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community'], plan: 'pro' },
  { id: '/faturacao',    label: 'Faturação',                     desc: 'Emissão e exportação',             category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community', 'clinic'], plan: 'pro' },
  { id: '/balcao',       label: 'Modo balcão',                   desc: 'Atender e entregar o aconselhamento no telemóvel do utente (QR)', category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community'], plan: 'pro' },
  { id: '/atendimentos', label: 'Atendimentos farmacêuticos',    desc: 'Aconselhamento registado',         category: 'clinical_ops', modes: ['clinical'], default_inst: ['pharmacy_community'], plan: 'pro' },
  { id: '/feridas',      label: 'Feridas',                       desc: 'Foto · evolução · IA',             category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'hospital'], plan: 'pro' },
  { id: '/hidratacao',   label: 'Hidratação',                    desc: 'Registo e alertas',                category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },

  // Qualidade & farmacovigilância
  { id: '/quality',      label: 'Central de qualidade',          desc: 'KPIs · segurança · alertas/recalls · intervenções', category: 'clinical_quality', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital', 'nursing_home'], plan: 'pro' },
  { id: '/adr-report',   label: 'Notificação RAM',               desc: 'WHO-UMC · MedDRA · INFARMED',      category: 'clinical_quality', modes: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/prescription-queue', label: 'Fila de validação',       desc: 'Revisão clínica · audit trail',    category: 'clinical_quality', modes: ['clinical'], default_inst: ['pharmacy_community', 'pharmacy_hospital'], plan: 'pro' },
  { id: '/drug-intelligence', label: 'Drug intelligence',        desc: 'Formulário · DDD · ruturas · custos', category: 'clinical_quality', modes: ['clinical'], default_inst: ['pharmacy_community', 'pharmacy_hospital', 'hospital'], plan: 'pro' },
  { id: '/rastreios',    label: 'Rastreios',                     desc: 'Diabetes, HTA, colesterol',        category: 'clinical_quality', modes: ['clinical'], default_inst: ['pharmacy_community', 'health_center'], plan: 'pro' },
  { id: '/auditoria',    label: 'Auditoria',                     desc: 'Trilhos · revisões',               category: 'clinical_quality', modes: ['clinical'], default_inst: ['hospital', 'pharmacy_hospital'], plan: 'pro' },

  // Legal & documentos
  { id: '/documentos',   label: 'Documentos & conformidade',     desc: 'Arquivo · consentimentos · RGPD/normas', category: 'clinical_legal', modes: ['clinical'], default_inst: ['nursing_home', 'hospital', 'clinic', 'pharmacy_community'], plan: 'pro' },
  { id: '/carta',        label: 'Carta de alta',                 desc: 'Geração farmacoterapêutica',       category: 'clinical_legal', modes: ['clinical'], default_inst: ['hospital'], plan: 'pro' },
  { id: '/connect',      label: 'Phlox Connect',                 desc: 'Partilhar dados com equipa',       category: 'clinical_legal', modes: ['clinical'], default_inst: ALL_INST, plan: 'pro' },

  // Suprimidos por agora (referências antigas no nav `EXTRA_TOOLS`): mantemos
  // apenas no settings se o utilizador quiser activar manualmente.
  { id: '/counseling',   label: 'Aconselhamento ao doente',      desc: 'Folha de informação',              category: 'clinical_decision', modes: ['clinical'], default_inst: ['pharmacy_community'], plan: 'pro' },
  { id: '/med-review',   label: 'Revisão e otimização de medicação', desc: 'Análise do esquema · genéricos · STOPP/START', category: 'clinical_decision', modes: ['clinical'], default_inst: ['pharmacy_community', 'pharmacy_hospital', 'hospital', 'clinic', 'nursing_home'], plan: 'pro' },
  { id: '/migrar',       label: 'Migrar dados',                  desc: 'SClínico · Sifarma · Excel · PDF', category: 'clinical_legal', modes: ['clinical'], plan: 'pro' },
]

export function toolsForMode(mode: ToolMode): Tool[] {
  return TOOLS.filter(t => t.modes.includes(mode))
}
export function defaultToolIds(mode: ToolMode): string[] {
  return TOOLS.filter(t => (t.default || []).includes(mode)).map(t => t.id)
}
/** Defaults para o modo clínico em função da instituição actual. */
export function defaultClinicalToolIds(inst: InstType): string[] {
  return TOOLS
    .filter(t => t.modes.includes('clinical') && (t.default_inst || []).includes(inst))
    .map(t => t.id)
}

export const PLAN_BADGE: Record<ToolPlan, { label: string; color: string; bg: string } | null> = {
  free: null,
  free_limited: { label: 'Grátis · limitado', color: '#0d9488', bg: '#ccfbf1' },
  student: { label: 'Plus', color: '#7c3aed', bg: '#ede9fe' },
  pro: { label: 'Pro', color: '#1d4ed8', bg: '#dbeafe' },
}
