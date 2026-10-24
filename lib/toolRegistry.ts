// ─── Phlox tool registry ─────────────────────────────────────────────────────
// Catálogo organizado de ferramentas por modo. Sustenta a visibilidade adaptativa:
// o onboarding define o modo → mostramos SÓ os "default" desse modo; o utilizador
// adiciona extras nas Definições. Nomes em forma de necessidade (pessoal/cuidador).
//
// 2026-06-01: estendido para incluir o modo CLÍNICO com granularidade por
// tipo de instituição (uma ferramenta pode ser default em farmácia mas não em
// hospital, e vice-versa).

export type ToolMode = 'personal' | 'caregiver' | 'student' | 'clinical'
export type InstType = 'nursing_home' | 'day_care'
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
  meds:        { label: 'Medicação',           color: 'var(--green-3)' },
  health:      { label: 'A minha saúde',       color: 'var(--red)' },
  understand:  { label: 'Perceber',            color: 'var(--blue)' },
  family:      { label: 'Família',             color: 'var(--amber)' },
  study:       { label: 'Estudar & treinar',   color: 'var(--roxo)' },
  // ── Clínico ────────────────────────────────────────────────────────────
  clinical_daily:    { label: 'Fluxo de trabalho',     color: 'var(--blue)' },
  clinical_decision: { label: 'Decisão clínica',       color: 'var(--green-3)' },
  clinical_tools:    { label: 'Ferramentas pro',       color: 'var(--roxo)' },
  clinical_ops:      { label: 'Operações & equipa',    color: 'var(--amber)' },
  clinical_quality:  { label: 'Qualidade & farmacovigilância', color: 'var(--red)' },
  clinical_legal:    { label: 'Legal & documentos',    color: 'var(--blue)' },
}

// Defaults por instituição usados quando criamos a lista de "extras a ligar".
// Espelham o que cada NAV_BY_INST (em ClinicalLayout) já mostra hoje, para
// não mudar a experiência ao utilizador atual.
const NH:  InstType[] = ['nursing_home']
const DC:  InstType[] = ['day_care']
const ALL_INST: InstType[] = ['nursing_home', 'day_care']
/* `PHC`, `CLN` e `HC` eram farmácia, clínica e centro de saúde. Saíram com os
   tipos. As ferramentas que os listavam passam a listar `ALL_INST`: ou servem
   uma casa, ou não servem ninguém. */
const PHC = ALL_INST, CLN = ALL_INST, HC = ALL_INST

export const TOOLS: Tool[] = [
  // ══ PESSOAL / CUIDADOR / ESTUDANTE ════════════════════════════════════════
  // ── Medicação ──
  // ── 7 ESSENCIAIS (default pessoal/cuidador). O resto fica acessível em /tudo. ──
  { id: '/mymeds',       label: 'Os meus comprimidos',           desc: 'A lista, os horários e os lembretes', category: 'meds',    modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/scan',         label: 'Explicar um exame ou receita',  desc: 'Tire uma foto. Dizemos-lhe o que lá está, em português simples — exames, análises, receitas, relatórios e caixas', category: 'meds', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/medicamento',  label: 'O que é este medicamento?',     desc: 'Escreva o nome e veja para que serve, se precisa de receita e cuidados', category: 'meds', modes: ['personal', 'caregiver', 'student'], plan: 'free' },

  // ── A minha saúde ──
  { id: '/sintomas',     label: 'Como me sinto hoje',            desc: 'Diário de sintomas e recuperação', category: 'health',     modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/vitals',       label: 'Tensão, peso e açúcar',         desc: 'Registar e ver como evolui',       category: 'health',     modes: ['personal', 'caregiver'], default: ['personal'], plan: 'free' },
  { id: '/timeline',     label: 'A minha história de saúde',      desc: 'Medicação, análises, documentos e sintomas, ao longo do tempo', category: 'health', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  // ── Secundárias (acessíveis em /tudo, fora do destaque) ──
  { id: '/vault',        label: 'Os meus documentos de saúde',   desc: 'Exames, análises e receitas guardados, lidos a fundo pela IA e partilháveis por código', category: 'health', modes: ['personal', 'caregiver'], plan: 'pro' },
  { id: '/vigia-ruturas', label: 'Vigia de ruturas',              desc: 'Cruza a tua medicação com a lista oficial de ruturas do INFARMED', category: 'health', modes: ['clinical'], plan: 'pro' },
  // Existia (Phlox Reach) mas só aparecia na command palette clínica — invisível
  // para quem mais fecha o ciclo (pessoal/cuidador). Sem "default": acessível em
  // /tudo, não empurrado para a Hub (convidar não deve ser a 1ª coisa que se vê).
  { id: '/partilhado-comigo', label: 'Partilhado comigo',        desc: 'Perfis de família que outra pessoa te deu acesso a ver', category: 'health', modes: ['personal', 'caregiver'], plan: 'free' },

  // ── Perceber ──
  { id: '/ai',           label: 'Tirar uma dúvida de saúde',     desc: 'Pergunte em português simples',    category: 'understand', modes: ['personal', 'caregiver', 'student'], default: ['personal'], plan: 'free_limited' },

  // ── Família (cuidador) ──
  { id: '/familia',      label: 'A minha família',               desc: 'A saúde de cada pessoa num só sítio', category: 'family',  modes: ['caregiver'], default: ['caregiver'], plan: 'free' },

  // ── Estudar & treinar ── (consolidado: máx ~14 ferramentas no modo estudante)
  { id: '/arena',        label: 'Competir na Arena',             desc: 'Ligas Bronze → Diamante',          category: 'study',      modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/study',        label: 'Estudar com flashcards',        desc: '200+ tópicos, repetição espaçada', category: 'study',      modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/tutor',        label: 'AI Tutor',                      desc: 'Explica conceitos · mnemónicas · passo a passo', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/osce',         label: 'Treinar OSCE',                  desc: 'IA como doente, feedback real',    category: 'study',      modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/anatomia-3d',  label: 'Explorar em 3D',                desc: 'Atlas 3D real · pesquisa + AR',     category: 'study',      modes: ['student'], default: ['student'], plan: 'student' },
  { id: '/estagio',      label: 'Estágio (completo)',            desc: 'Doentes, diário, casos, IA, relatórios', category: 'study', modes: ['student'], default: ['student'], plan: 'student' },

  // ══ CLÍNICO ═══════════════════════════════════════════════════════════════
  // Fluxo de trabalho — base, vista por todos por defeito
  { id: '/patients',     label: 'Doentes / utentes',             desc: 'Fichas, medicação, alertas',       category: 'clinical_daily', modes: ['clinical'], default: ['clinical'], default_inst: ALL_INST, plan: 'pro' },
  { id: '/radar',        label: 'O que merece atenção',          desc: 'Reúne o que a equipa registou e destaca o que saiu do padrão', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/guardiao',     label: 'Modo Guardião',                 desc: 'Turnos com pouca gente: só quem precisa de atenção, por ordem de urgência', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },
  { id: '/autonomia',    label: 'Autonomia',                     desc: 'Três perguntas rápidas, de vez em quando — nota quem está a precisar de mais ajuda', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/carga',        label: 'Pessoal e carga',               desc: 'Onde a escala pode apertar: turnos sem gente ou abaixo do habitual desta casa', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/tendencias',   label: 'Tendências',                    desc: 'Humor, alimentação, adesão e ocorrências ao longo de 2-3 semanas, por pessoa', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/mar',          label: 'Administração (MAR)',           desc: 'Registo por turno · alertas',      category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },

  { id: '/equipa?tab=mural', label: 'Mural da equipa',           desc: 'Mensagens e avisos entre a equipa (com push)', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/ronda-guiada', label: 'Ronda coordenada',              desc: 'Ronda a vários, sem repetir, com transferência automática', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },

  // Cuidado diário (lar + centro de dia) — sem vocabulário fixo de "lar".
  { id: '/care-log',     label: 'Registo do dia',                desc: 'Sinais vitais, alimentação, humor', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/refeicoes',    label: 'Refeições',                     desc: 'O que cada pessoa comeu, por refeição — toque rápido', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/assessments',  label: 'Avaliações (Braden, MNA, ...)', desc: 'Escalas clínicas',                 category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/incidents',    label: 'Ocorrências',                   desc: 'Quedas, erros med, comportamento', category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/family',       label: 'Famílias',                      desc: 'Mensagens, visitas, contactos',    category: 'clinical_daily', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },

  // Decisão clínica

  // Ferramentas pro — calculadoras consolidadas num único hub (/calculos)
  // (calculators, pk-dosing, iv-calc, iv-compatibility, electrolytes, emergency-doses,
  //  dose-crianca, escalas → agora dentro do hub /calculos. Páginas mantidas, fora do menu.)

  // Operações & equipa
  { id: '/stock',        label: 'Stock & consumíveis',           desc: 'Consumo a 1 toque · ruturas · encomendas', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/equipa?tab=escalas', label: 'Equipa & escalas',        desc: 'Membros, turnos, competências e tarefas', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  // A aba "cobertura" deixou de existir — as vagas de turno vivem dentro das
  // Escalas (components/team/EscalasEquipa.tsx). O /equipa ainda redireciona o
  // link antigo em silêncio, mas o catálogo não deve anunciar um endereço morto.
  { id: '/equipa?tab=escalas', label: 'Cobertura de turnos',  desc: 'Publica vagas quando falta alguém; a equipa vê e cobre', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/apoio-servicos', label: 'Serviços de apoio',          desc: 'Roupa, transporte e outros pedidos — quem publica, quem trata', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/preparacao-medicacao', label: 'Preparação da medicação', desc: 'Grelha semanal de quem preparou o pastilheiro, por pessoa', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/apoio-psicossocial', label: 'Apoio psico-social',     desc: 'Notas de acompanhamento e encaminhamento a especialistas — só equipa', category: 'clinical_ops', modes: ['clinical'], default_inst: ['nursing_home', 'day_care'], plan: 'pro' },
  { id: '/faturacao',    label: 'Faturação',                     desc: 'Emissão e exportação',             category: 'clinical_ops', modes: ['clinical'], default_inst: [], plan: 'pro' },

  // Qualidade & farmacovigilância

  // Legal & documentos
  { id: '/documentos',   label: 'Documentos & conformidade',     desc: 'Arquivo · consentimentos · RGPD/normas', category: 'clinical_legal', modes: ['clinical'], default_inst: ['nursing_home'], plan: 'pro' },

  // Suprimidos por agora (referências antigas no nav `EXTRA_TOOLS`): mantemos
  // apenas no settings se o utilizador quiser activar manualmente.
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
  free_limited: { label: 'Grátis · limitado', color: 'var(--green-3)', bg: 'var(--green-light)' },
  student: { label: 'Plus', color: 'var(--roxo)', bg: 'var(--roxo-claro)' },
  pro: { label: 'Pro', color: 'var(--blue)', bg: 'var(--blue-light)' },
}
