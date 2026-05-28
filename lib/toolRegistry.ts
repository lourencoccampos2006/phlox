// ─── Phlox tool registry ─────────────────────────────────────────────────────
// Catálogo organizado de ferramentas por modo. Sustenta a visibilidade adaptativa:
// o onboarding define o modo → mostramos SÓ os "default" desse modo; o utilizador
// adiciona extras nas Definições. Nomes em forma de necessidade (pessoal/cuidador).

export type ToolMode = 'personal' | 'caregiver' | 'student'
export type ToolPlan = 'free' | 'free_limited' | 'pro'

export interface Tool {
  id: string            // = href
  label: string         // need-phrased
  desc: string
  category: string
  modes: ToolMode[]
  default?: ToolMode[]  // modos onde aparece por defeito
  plan: ToolPlan
}

export const TOOL_CATEGORIES: Record<string, { label: string; color: string }> = {
  meds:      { label: 'Medicação', color: '#0d9488' },
  health:    { label: 'A minha saúde', color: '#e11d48' },
  understand:{ label: 'Perceber', color: '#2563eb' },
  family:    { label: 'Família', color: '#b45309' },
  study:     { label: 'Estudar & treinar', color: '#7c3aed' },
}

export const TOOLS: Tool[] = [
  // ── Medicação ──
  { id: '/mymeds',       label: 'Os meus medicamentos',          desc: 'Lista, lembretes e adesão',        category: 'meds',       modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/interactions', label: 'Os meus medicamentos dão-se bem?', desc: 'Verificar interações',          category: 'meds',       modes: ['personal', 'caregiver', 'student'], default: ['personal', 'caregiver'], plan: 'free_limited' },
  { id: '/food-drug',    label: 'O que não posso misturar?',     desc: 'Alimentos e álcool a evitar',      category: 'meds',       modes: ['personal', 'caregiver'], plan: 'free' },
  { id: '/schedule',     label: 'A que horas devo tomar?',       desc: 'Horário ideal das tomas (IA)',     category: 'meds',       modes: ['personal', 'caregiver'], plan: 'free_limited' },

  // ── A minha saúde ──
  { id: '/vitals',       label: 'Acompanhar tensão, peso e açúcar', desc: 'Registo e tendências',          category: 'health',     modes: ['personal', 'caregiver'], default: ['personal'], plan: 'free' },
  { id: '/sintomas',     label: 'Como me sinto hoje?',           desc: 'Diário de sintomas e bem-estar',   category: 'health',     modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/objetivos',    label: 'Definir objetivos de saúde',    desc: 'Metas e acompanhamento',           category: 'health',     modes: ['personal'], plan: 'free' },
  { id: '/relatorio',    label: 'Como correu a minha semana?',   desc: 'Relatório semanal por IA',         category: 'health',     modes: ['personal', 'caregiver'], plan: 'pro' },
  { id: '/passport',     label: 'Cartão de emergência',          desc: 'QR code com a minha info vital',   category: 'health',     modes: ['personal', 'caregiver'], default: ['caregiver'], plan: 'free' },

  // ── Perceber ──
  { id: '/ai',           label: 'Tirar uma dúvida de saúde',     desc: 'Assistente Phlox',                 category: 'understand', modes: ['personal', 'caregiver', 'student'], default: ['personal'], plan: 'free_limited' },
  { id: '/medicamento',  label: 'O que é este medicamento?',     desc: 'Foto da caixa → explicação simples', category: 'understand', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/receita',      label: 'Decifrar a receita médica',     desc: 'Foto da receita → tomas explicadas', category: 'understand', modes: ['personal', 'caregiver'], default: ['caregiver'], plan: 'free_limited' },
  { id: '/bula',         label: 'Perceber uma bula',             desc: 'Texto técnico em linguagem simples', category: 'understand', modes: ['personal', 'caregiver'], plan: 'free' },
  { id: '/labs',         label: 'Perceber as minhas análises',   desc: 'O que cada valor significa',       category: 'understand', modes: ['personal', 'caregiver'], plan: 'free_limited' },

  // ── A minha saúde (novas) ──
  { id: '/triagem',      label: 'Devo ir ao médico?',            desc: 'Orientação: casa, médico ou urgências', category: 'health', modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/preventivo',   label: 'Estou em dia com a saúde?',     desc: 'Vacinas e rastreios por idade',    category: 'health',     modes: ['personal', 'caregiver'], default: ['personal'], plan: 'free' },
  { id: '/socorros',     label: 'O que faço numa emergência?',   desc: 'Primeiros socorros passo a passo', category: 'health',     modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },
  { id: '/health-pass',  label: 'Mostrar a minha saúde (QR)',    desc: 'QR para o médico/farmácia ver tudo', category: 'health',   modes: ['personal', 'caregiver'], default: ['personal', 'caregiver'], plan: 'free' },

  // ── Família (cuidador) ──
  { id: '/familia',      label: 'Gerir os perfis da família',    desc: 'Um perfil por familiar',           category: 'family',     modes: ['caregiver'], default: ['caregiver'], plan: 'free' },

  // ── Estudar & treinar ──
  { id: '/arena',        label: 'Competir na Arena',             desc: 'Ligas Bronze → Diamante',          category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/study',        label: 'Estudar com flashcards',        desc: '200+ tópicos, repetição espaçada', category: 'study',      modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/tutor',        label: 'AI Tutor',                      desc: 'Explicações passo a passo',        category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/simulador',    label: 'Simulador clínico',             desc: 'Casos clínicos com IA',            category: 'study',      modes: ['student'], plan: 'pro' },
  { id: '/osce',         label: 'Treinar OSCE',                  desc: 'IA como doente, feedback real',    category: 'study',      modes: ['student'], plan: 'pro' },
  { id: '/progresso',    label: 'Ver o meu progresso',           desc: 'XP, streak e estatísticas',        category: 'study',      modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/anatomia-3d',  label: 'Explorar em 3D',                desc: 'Atlas 3D real · pesquisa + AR',     category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
  { id: '/mnemonicas',   label: 'Criar mnemónicas',              desc: 'Decora listas com truques de memória', category: 'study',   modes: ['student'], default: ['student'], plan: 'free' },
  { id: '/explica',      label: 'Explica-me um conceito',        desc: 'Em 3 níveis + analogia',           category: 'study',      modes: ['student'], default: ['student'], plan: 'free_limited' },
]

export function toolsForMode(mode: ToolMode): Tool[] {
  return TOOLS.filter(t => t.modes.includes(mode))
}
export function defaultToolIds(mode: ToolMode): string[] {
  return TOOLS.filter(t => (t.default || []).includes(mode)).map(t => t.id)
}

export const PLAN_BADGE: Record<ToolPlan, { label: string; color: string; bg: string } | null> = {
  free: null,
  free_limited: { label: 'Grátis · limitado', color: '#0d9488', bg: '#ccfbf1' },
  pro: { label: 'Pro', color: '#7c3aed', bg: '#ede9fe' },
}
