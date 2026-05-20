// Central navigation data — single source of truth for all tool links

export type NavTool = {
  href: string
  icon: string
  label: string
  desc: string
  badge?: string
}

export type NavCategory = {
  id: string
  label: string
  color: string
  tools: NavTool[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'medication', label: 'Medicação', color: '#0d9488',
    tools: [
      { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos', desc: 'Lista, lembretes e adesão' },
      { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Qualquer combinação' },
      { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',   desc: 'O que não misturar' },
      { href: '/schedule',     icon: '⏰', label: 'Horário inteligente',  desc: 'IA cria o horário ideal', badge: 'Novo' },
      { href: '/bula',         icon: '📄', label: 'Perceber uma bula',    desc: 'Em linguagem simples' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',  desc: 'Genéricos, STOPP/START', badge: 'Novo' },
    ],
  },
  {
    id: 'health', label: 'Saúde', color: '#e11d48',
    tools: [
      { href: '/vitals',    icon: '❤️', label: 'Sinais vitais',        desc: 'Tensão, pulso, peso' },
      { href: '/passport',  icon: '🆘', label: 'Passaporte de saúde', desc: 'QR code de emergência' },
      { href: '/labs',      icon: '🧪', label: 'Perceber análises',   desc: 'O que cada valor significa' },
      { href: '/objetivos', icon: '🎯', label: 'Objetivos',           desc: 'Metas e acompanhamento' },
      { href: '/relatorio', icon: '📊', label: 'Relatório semanal',   desc: 'IA analisa a tua semana', badge: 'Novo' },
      { href: '/ai',        icon: '🤖', label: 'Phlox AI',            desc: 'Qualquer dúvida de saúde' },
    ],
  },
  {
    id: 'clinical', label: 'Clínico', color: '#2563eb',
    tools: [
      { href: '/turno',         icon: '🏥', label: 'Turno',           desc: 'Gestão de doentes e doses' },
      { href: '/rounds',        icon: '📋', label: 'Ronda',           desc: 'PCNE e intervenções' },
      { href: '/mar',           icon: '📝', label: 'MAR',             desc: 'Registo de administração' },
      { href: '/patients',      icon: '👥', label: 'Doentes',         desc: 'Fichas e medicação' },
      { href: '/oracle',        icon: '🤖', label: 'Oracle AI',       desc: 'SOAP e intervenção' },
      { href: '/calculators',   icon: '🔢', label: 'Calculadoras',    desc: 'SCORE2, CKD-EPI' },
      { href: '/reconciliacao', icon: '🔄', label: 'Reconciliação',   desc: 'Admissão vs. atual' },
      { href: '/adr-report',    icon: '⚠️', label: 'Notificação RAM', desc: 'WHO-UMC e INFARMED', badge: 'Novo' },
    ],
  },
  {
    id: 'student', label: 'Estudante', color: '#7c3aed',
    tools: [
      { href: '/arena',     icon: '🏆', label: 'Arena',            desc: 'Ligas Bronze → Diamante' },
      { href: '/simulador', icon: '🎮', label: 'Simulador clínico', desc: 'Casos com IA' },
      { href: '/osce',      icon: '🎯', label: 'OSCE',             desc: 'IA como doente' },
      { href: '/study',     icon: '🃏', label: 'Flashcards',       desc: '200+ tópicos' },
      { href: '/tutor',     icon: '🤖', label: 'AI Tutor',         desc: 'Passo a passo' },
      { href: '/progresso', icon: '📈', label: 'Progresso',        desc: 'XP, streak' },
    ],
  },
]

export const PERSONA_NAV: Record<string, Array<{ href: string; label: string }>> = {
  personal:  [
    { href: '/inicio', label: 'Início' },
    { href: '/mymeds', label: 'Medicação' },
    { href: '/vitals', label: 'Saúde' },
    { href: '/verificar', label: 'Verificar' },
    { href: '/ai', label: 'IA' },
  ],
  caregiver: [
    { href: '/inicio', label: 'Início' },
    { href: '/familia', label: 'Família' },
    { href: '/mymeds', label: 'Medicação' },
    { href: '/verificar', label: 'Verificar' },
    { href: '/passport', label: 'Emergência' },
  ],
  clinical: [
    { href: '/inicio', label: 'Início' },
    { href: '/turno', label: 'Turno' },
    { href: '/rounds', label: 'Ronda' },
    { href: '/mar', label: 'MAR' },
    { href: '/patients', label: 'Doentes' },
    { href: '/oracle', label: 'Oracle' },
  ],
  student: [
    { href: '/inicio', label: 'Início' },
    { href: '/arena', label: 'Arena' },
    { href: '/study', label: 'Estudar' },
    { href: '/simulador', label: 'Simular' },
    { href: '/progresso', label: 'Progresso' },
  ],
}

export const MODE_QUICK_ACTIONS: Record<string, NavTool[]> = {
  personal: [
    { href: '/mymeds',       icon: '💊', label: 'Medicação',   desc: 'Lista e lembretes de hoje' },
    { href: '/interactions', icon: '🔍', label: 'Verificar',   desc: 'São seguros juntos?' },
    { href: '/vitals',       icon: '❤️', label: 'Saúde',       desc: 'Tensão, pulso, peso' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar',   desc: 'Dúvida de saúde' },
    { href: '/passport',     icon: '🆘', label: 'Passaporte',  desc: 'QR de emergência' },
    { href: '/bula',         icon: '📄', label: 'Bula',        desc: 'Em linguagem simples' },
  ],
  caregiver: [
    { href: '/familia',      icon: '👨‍👩‍👧', label: 'Dashboard',  desc: 'Resumo de todos os familiares', badge: 'Novo' },
    { href: '/perfis',       icon: '👤',   label: 'Perfis',     desc: 'Gerir perfis familiares' },
    { href: '/mymeds',       icon: '💊',   label: 'Medicação',  desc: 'Lista e lembretes' },
    { href: '/interactions', icon: '🔍',   label: 'Verificar',  desc: 'São seguros juntos?' },
    { href: '/schedule',     icon: '⏰',   label: 'Horário',    desc: 'Horário ideal por perfil' },
    { href: '/ai',           icon: '🤖',   label: 'Perguntar',  desc: 'Dúvida de saúde' },
  ],
  clinical: [
    { href: '/turno',        icon: '🏥', label: 'Turno',      desc: 'Doentes e alertas' },
    { href: '/rounds',       icon: '📋', label: 'Ronda',      desc: 'PCNE e intervenções' },
    { href: '/mar',          icon: '📝', label: 'MAR',        desc: 'Registo de administração' },
    { href: '/patients',     icon: '👥', label: 'Doentes',    desc: 'Fichas e medicação' },
    { href: '/oracle',       icon: '🤖', label: 'Oracle',     desc: 'SOAP e intervenção' },
    { href: '/interactions', icon: '🔍', label: 'Interações', desc: 'Mecanismo e evidência' },
  ],
  student: [
    { href: '/arena',     icon: '🏆', label: 'Arena',     desc: 'Ligas Bronze → Diamante' },
    { href: '/simulador', icon: '🎮', label: 'Simular',   desc: 'Casos clínicos' },
    { href: '/study',     icon: '🃏', label: 'Estudar',   desc: 'Flashcards e quizzes' },
    { href: '/tutor',     icon: '🤖', label: 'Tutor AI',  desc: 'Explicações passo a passo' },
    { href: '/osce',      icon: '🎯', label: 'OSCE',      desc: 'Simulação de exame' },
    { href: '/progresso', icon: '📈', label: 'Progresso', desc: 'XP e streak' },
  ],
}
