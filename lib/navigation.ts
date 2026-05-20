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
      { href: '/cockpit',            icon: '🎛️', label: 'Cockpit Operacional', desc: 'Dashboard do turno · Alertas · KPIs', badge: 'Novo' },
      { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intelligence',   desc: 'Formulário · DDD · Ruturas · Custos', badge: 'Novo' },
      { href: '/quality',            icon: '📊', label: 'Central de Qualidade', desc: 'KPIs · Segurança · Intervenções', badge: 'Novo' },
      { href: '/team',               icon: '👥', label: 'Gestão de Equipa',    desc: 'Turnos · Vagas · Competências · Formação', badge: 'Novo' },
      { href: '/turno',         icon: '🏥', label: 'Turno',           desc: 'Gestão de doentes e doses' },
      { href: '/rounds',        icon: '📋', label: 'Ronda',           desc: 'PCNE e intervenções' },
      { href: '/mar',           icon: '📝', label: 'MAR',             desc: 'Registo de administração' },
      { href: '/patients',      icon: '👥', label: 'Doentes',         desc: 'Fichas e medicação' },
      { href: '/oracle',        icon: '🤖', label: 'Oracle AI',       desc: 'SOAP e intervenção' },
      { href: '/nota-clinica',  icon: '🗒️', label: 'Nota Clínica',   desc: 'SOAP estruturado com IA', badge: 'Novo' },
      { href: '/drug-info',     icon: '💊', label: 'Info Fármaco',    desc: 'Monografia completa', badge: 'Novo' },
      { href: '/handover',      icon: '🔁', label: 'Passagem Turno',  desc: 'Relatório de turno IA', badge: 'Novo' },
      { href: '/calculators',   icon: '🔢', label: 'Calculadoras',    desc: 'CURB-65, MEWS, VTE, CKD…' },
      { href: '/reconciliacao',      icon: '🔄', label: 'Reconciliação',      desc: 'Admissão vs. atual' },
      { href: '/adr-report',         icon: '⚠️', label: 'Notificação RAM',    desc: 'WHO-UMC e INFARMED' },
      { href: '/antibiotics',        icon: '💉', label: 'Antibioterapia',     desc: 'Empírica · MRSA/ESBL · stewardship', badge: 'Pro' },
      { href: '/stopp-start',        icon: '🛑', label: 'STOPP/START',        desc: 'v3 2023 + Beers', badge: 'Pro' },
      { href: '/polypharmacy',       icon: '⚕️', label: 'Polimedicação',      desc: 'Auditoria · cascatas · carga ACB', badge: 'Pro' },
      { href: '/counseling',         icon: '📋', label: 'Aconselhamento',     desc: 'Folha de informação ao doente', badge: 'Pro' },
      { href: '/iv-compatibility',   icon: '🧪', label: 'Comp. IV',          desc: 'Y-site · mistura · seringa', badge: 'Pro' },
      { href: '/emergency-doses',    icon: '🚨', label: 'Urgência',          desc: 'Doses de emergência por peso', badge: 'Pro' },
      { href: '/electrolytes',       icon: '⚡', label: 'Eletrólitos',        desc: 'Protocolos K, Na, Mg, Ca', badge: 'Pro' },
      { href: '/pk-dosing',          icon: '🔬', label: 'Console PK',         desc: 'Vancomicina AUC · Aminoglicosídeos · Fenitoína', badge: 'Pro' },
      { href: '/tpn',                icon: '🧪', label: 'Nutrição Parentérica', desc: 'ASPEN 2022 · Cálculo completo · Rótulo PDF', badge: 'Pro' },
      { href: '/prescription-queue', icon: '📬', label: 'Fila de Validação',  desc: 'Revisão clínica · Intervenção · Audit trail', badge: 'Pro' },
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
    { href: '/mymeds',       label: 'Medicação' },
    { href: '/vitals',       label: 'Saúde' },
    { href: '/interactions', label: 'Verificar' },
    { href: '/ai',           label: 'IA' },
  ],
  caregiver: [
    { href: '/familia',  label: 'Família' },
    { href: '/mymeds',   label: 'Medicação' },
    { href: '/verificar', label: 'Verificar' },
    { href: '/passport', label: 'Emergência' },
  ],
  clinical: [
    { href: '/cockpit',            label: 'Cockpit' },
    { href: '/turno',              label: 'Turno' },
    { href: '/rounds',             label: 'Ronda' },
    { href: '/mar',                label: 'MAR' },
    { href: '/oracle',             label: 'Oracle' },
  ],
  student: [
    { href: '/arena',     label: 'Arena' },
    { href: '/study',     label: 'Estudar' },
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
    { href: '/cockpit',            icon: '🎛️', label: 'Cockpit',       desc: 'Dashboard do turno e alertas' },
    { href: '/turno',              icon: '🏥', label: 'Turno',         desc: 'Doentes e alertas' },
    { href: '/rounds',             icon: '📋', label: 'Ronda',         desc: 'PCNE e intervenções' },
    { href: '/mar',                icon: '📝', label: 'MAR',           desc: 'Registo de administração' },
    { href: '/prescription-queue', icon: '📬', label: 'Validação',     desc: 'Fila de revisão farmacêutica' },
    { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intel',    desc: 'Formulário · DDD · Ruturas · Custos' },
    { href: '/quality',            icon: '📊', label: 'Qualidade',     desc: 'KPIs · Segurança · Intervenções' },
    { href: '/team',               icon: '👥', label: 'Equipa',        desc: 'Turnos · Vagas · Competências' },
    { href: '/pk-dosing',          icon: '🔬', label: 'Console PK',    desc: 'Vancomicina AUC · Aminoglicosídeos' },
    { href: '/tpn',                icon: '🧪', label: 'NP',            desc: 'Nutrição parentérica ASPEN 2022' },
    { href: '/antibiotics',        icon: '💉', label: 'Antibióticos',  desc: 'Empírica · MRSA/ESBL · stewardship' },
    { href: '/emergency-doses',    icon: '🚨', label: 'Urgência',      desc: 'Doses de emergência por peso' },
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
