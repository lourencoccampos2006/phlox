// Central navigation data — single source of truth for all tool links

export type NavTool = {
  href: string
  icon: string
  label: string
  desc: string
  badge?: string
  /**
   * Lista de modos em que esta ferramenta deve aparecer no nav.
   * Se ausente, mostra-se em todos os modos (compatibilidade).
   * Ferramentas pessoais NÃO devem aparecer em modo clínico, e vice-versa.
   */
  modes?: ('personal' | 'caregiver' | 'student' | 'clinical')[]
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
      { href: '/scan',         icon: '📷', label: 'Tirar foto a uma receita', desc: 'O Phlox lê a receita, caixa, análise ou bula' },
      { href: '/medicamento',  icon: '💡', label: 'O que é este medicamento?', desc: 'Escreva o nome → para que serve e cuidados' },
      { href: '/mymeds',       icon: '💊', label: 'Os meus comprimidos', desc: 'Lista, horários e lembretes' },
      { href: '/interactions', icon: '🔍', label: 'Dão-se bem juntos?',  desc: 'Ver se é seguro tomá-los ao mesmo tempo' },
      { href: '/food-drug',    icon: '🥗', label: 'O que não posso misturar?', desc: 'Alimentos e bebidas a evitar' },
      { href: '/calendario-meds', icon: '⏰', label: 'A que horas devo tomar?', desc: 'O melhor horário de cada toma', badge: 'Novo' },
      { href: '/optimizer',    icon: '⚡', label: 'Simplificar a medicação', desc: 'Genéricos e revisão (STOPP/START)', badge: 'Novo' },
    ],
  },
  {
    id: 'health', label: 'Saúde', color: '#e11d48',
    tools: [
      { href: '/saude-agora', icon: '🚨', label: 'Não me sinto bem',     desc: 'Médico, urgências ou em casa? · 112' },
      { href: '/saude360',  icon: '🌐', label: 'A minha saúde num só ecrã', desc: 'Medicação, análises e agenda juntas', badge: 'Premium' },
      { href: '/vault',     icon: '🔒', label: 'Os meus documentos',   desc: 'Análises e receitas, com partilha por código', badge: 'Premium' },
      { href: '/vitals',    icon: '❤️', label: 'Tensão, peso e açúcar', desc: 'Registar e ver como evolui' },
      { href: '/passport',  icon: '🆘', label: 'Cartão de emergência',  desc: 'Código QR para uma emergência' },
      { href: '/labs',      icon: '🧪', label: 'Perceber as minhas análises', desc: 'O que cada valor quer dizer' },
      { href: '/objetivos', icon: '🎯', label: 'Os meus objetivos',     desc: 'Metas e acompanhamento' },
      { href: '/relatorio', icon: '📊', label: 'Resumo da minha semana', desc: 'Como correu a sua semana de saúde' },
      { href: '/ai',        icon: '🤖', label: 'Tirar uma dúvida',      desc: 'Pergunte em português simples' },
    ],
  },
  {
    id: 'caregiver', label: 'Cuidador', color: '#b45309',
    tools: [
      { href: '/familia360', icon: '👨‍👩‍👧', label: 'Cuidar da família, sem falhas', desc: 'Mensagens, reconciliação e apoio ao cuidador', badge: 'Premium' },
      { href: '/familia',    icon: '🏠',   label: 'A minha família',    desc: 'A saúde de cada pessoa num só sítio' },
      { href: '/perfis',     icon: '👤',   label: 'Gerir perfis',       desc: 'Adicionar e editar familiares' },
      { href: '/dose-crianca', icon: '🧒', label: 'Dose para crianças', desc: 'Por peso e por medicamento' },
    ],
  },
  {
    id: 'clinical', label: 'Clínico', color: '#2563eb',
    tools: [
      // CURADORIA 2026-06-01: Reduzido de 26 para 14. Removidas /calculators,
      // /counseling, /electrolytes, /nota-clinica, /handover (ainda incompletas
      // ou duplicadas com calculos / oracle). O utilizador pode reativar em
      // /settings/tools.
      { href: '/painel',             icon: '🎛️', label: 'Painel',              desc: 'O painel da instituição, ao vivo' },
      { href: '/radar',              icon: '📋', label: 'O que merece atenção', desc: 'O que a equipa registou que saiu do padrão' },
      { href: '/turno',              icon: '🏥', label: 'Turno',               desc: 'Gestão de utentes e doses' },
      { href: '/rounds',             icon: '📋', label: 'Ronda Farmacêutica',  desc: 'PCNE e intervenções' },
      { href: '/mar',                icon: '📝', label: 'MAR',                 desc: 'Registo de administração' },
      { href: '/patients',           icon: '👥', label: 'Doentes',             desc: 'Fichas e medicação' },
      { href: '/oracle',             icon: '🤖', label: 'Oracle AI',           desc: 'SOAP e intervenção PCNE' },
      { href: '/reconciliacao',      icon: '🔄', label: 'Reconciliação',       desc: 'Admissão vs. atual' },
      { href: '/calculos',           icon: '🧮', label: 'Calculadoras',        desc: 'CrCl, IBW, eGFR, PK, Child-Pugh' },
      { href: '/pk-dosing',          icon: '🔬', label: 'Console PK',          desc: 'Vancomicina AUC · Aminoglicosídeos', badge: 'Pro' },
      { href: '/antibiotics',        icon: '💉', label: 'Antibioterapia',      desc: 'Empírica · MRSA/ESBL', badge: 'Pro' },
      { href: '/stopp-start',        icon: '🛑', label: 'STOPP/START',         desc: 'v3 2023 + Beers', badge: 'Pro' },
      { href: '/tpn',                icon: '🧪', label: 'Nutrição Parentérica',desc: 'ASPEN 2022 · Rótulo PDF', badge: 'Pro' },
      { href: '/prescription-queue', icon: '📬', label: 'Fila de Validação',   desc: 'Revisão clínica · Audit trail', badge: 'Pro' },
      { href: '/adr-report',         icon: '⚠️', label: 'Notificação RAM',     desc: 'WHO-UMC e INFARMED' },
      { href: '/quality',            icon: '📊', label: 'Qualidade',           desc: 'KPIs · Segurança · Intervenções' },
      { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intelligence',   desc: 'Formulário · DDD · Ruturas · Custos' },
      { href: '/team',               icon: '👥', label: 'Equipa',              desc: 'Turnos · Competências' },
    ],
  },
  {
    id: 'student', label: 'Estudante', color: '#7c3aed',
    tools: [
      { href: '/study360',  icon: '🎓', label: 'Estudar',          desc: 'Sessão diária: revisão espaçada, plano, Pomodoro e progresso', badge: 'Premium' },
      { href: '/biblioteca', icon: '📚', label: 'As minhas sebentas', desc: 'Carregar PDFs e slides → resumo e perguntas', badge: 'Premium' },
      { href: '/arena',     icon: '🏆', label: 'Arena',            desc: 'Ligas Bronze → Diamante' },
      { href: '/simulador', icon: '🎮', label: 'Casos clínicos',   desc: 'Pratique decisões num caso real' },
      { href: '/osce',      icon: '🎯', label: 'Treinar OSCE',     desc: 'Exame prático com doente simulado' },
      { href: '/study',     icon: '🃏', label: 'Flashcards',       desc: '200+ tópicos com repetição espaçada' },
      { href: '/tutor',     icon: '🤖', label: 'Tutor passo a passo', desc: 'Explica e faz-te pensar' },
      { href: '/progresso', icon: '📈', label: 'O meu progresso',  desc: 'XP e dias seguidos' },
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
    { href: '/painel',             label: 'Painel' },
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

// ── Mode isolation ────────────────────────────────────────────────────────────
// Quem é clínico NÃO vê ferramentas pessoais. Quem é pessoal NÃO vê o cockpit.
// O mapa abaixo decide que categorias aparecem em cada modo. Ferramentas
// individuais podem usar o campo `modes` para override.
type Mode = 'personal' | 'caregiver' | 'student' | 'clinical'

const CATEGORY_MODES: Record<string, Mode[]> = {
  medication: ['personal', 'caregiver'],
  health:     ['personal', 'caregiver'],
  caregiver:  ['caregiver'],
  clinical:   ['clinical'],
  student:    ['student'],
}

export function getNavForMode(mode: Mode): NavCategory[] {
  return NAV_CATEGORIES
    .filter(cat => {
      const allowed = CATEGORY_MODES[cat.id]
      return allowed ? allowed.includes(mode) : true
    })
    .map(cat => ({
      ...cat,
      tools: cat.tools.filter(t => !t.modes || t.modes.includes(mode)),
    }))
    .filter(cat => cat.tools.length > 0)
}

/** Lista plana usada por search e command palette. */
export function getAllToolsForMode(mode: Mode): (NavTool & { categoryLabel: string; categoryColor: string })[] {
  return getNavForMode(mode).flatMap(cat =>
    cat.tools.map(t => ({ ...t, categoryLabel: cat.label, categoryColor: cat.color }))
  )
}

/**
 * Ferramentas que existem na app mas não estão promovidas no Hub. O utilizador
 * pode ativá-las em /settings/tools. Ficam por modo, com etiqueta clara.
 * 2026-06-01: adicionada por feedback explícito do utilizador — "há ferramentas
 * que não são acessíveis de lado nenhum".
 */
export const EXTRA_TOOLS_BY_MODE: Record<Mode, NavTool[]> = {
  personal: [
    { href: '/sintomas',         icon: '📓', label: 'Diário de saúde',     desc: 'Sintomas diários · bem-estar · notas' },
    { href: '/objetivos',     icon: '🎯', label: 'Objetivos de saúde',  desc: 'Metas e acompanhamento' },
    { href: '/preparar-consulta', icon: '📋', label: 'Preparar consulta', desc: 'Perguntas certas para o médico' },
    { href: '/sintomas',      icon: '🩹', label: 'Diário de sintomas',  desc: 'Regista episódios com gatilhos' },
    { href: '/cartao-emergencia', icon: '🆘', label: 'Cartão de emergência', desc: 'Cartão visual estilo Wallet' },
    { href: '/dose-crianca',  icon: '🧒', label: 'Dose pediátrica',     desc: 'Por peso e medicamento' },
    { href: '/timeline',      icon: '📈', label: 'Histórico clínico',   desc: 'Evolução ao longo do tempo' },
  ],
  caregiver: [
    { href: '/preparar-consulta', icon: '📋', label: 'Preparar consulta', desc: 'Perguntas para o médico do familiar' },
    { href: '/sintomas',         icon: '📓', label: 'Diário',              desc: 'Registo diário do familiar' },
    { href: '/sintomas',      icon: '🩹', label: 'Diário de sintomas',  desc: 'Episódios com gatilhos' },
    { href: '/dose-crianca',  icon: '🧒', label: 'Dose pediátrica',     desc: 'Para crianças por peso' },
    { href: '/timeline',      icon: '📈', label: 'Histórico',           desc: 'Evolução clínica' },
  ],
  student: [
    { href: '/estudar-conceito', icon: '🎓', label: 'Estudar um conceito', desc: 'Explica + mnemónica + plano · num só sítio' },
    { href: '/exam',          icon: '📝', label: 'Simulação de exame',  desc: 'Exame cronometrado, formato real' },
    { href: '/modo-exame',    icon: '🗂️', label: 'Plano de exame',      desc: 'Plano de estudo até à data do exame' },
    // Mantemos /explica e /mnemonicas como atalhos para quem só quer um
    { href: '/explica',       icon: '✨', label: 'Explica-me (só)',     desc: 'Atalho direto à explicação' },
    { href: '/mnemonicas',    icon: '🧠', label: 'Mnemónicas (só)',     desc: 'Atalho direto à mnemónica' },
  ],
  clinical: [
    { href: '/calculos',      icon: '🧮', label: 'Calculadoras',        desc: 'CrCl, eGFR, doses, escalas (CHA₂DS₂, qSOFA…)' },
    { href: '/pk-dosing',     icon: '🔬', label: 'Console PK',          desc: 'Vancomicina AUC, aminoglicosídeos' },
    { href: '/antibiotics',   icon: '💉', label: 'Antibioterapia',      desc: 'Empírica + stewardship' },
    { href: '/stopp-start',   icon: '🛑', label: 'STOPP/START',         desc: 'v3 + Beers' },
    { href: '/tpn',           icon: '🧪', label: 'Nutrição parentérica',desc: 'ASPEN 2022' },
    { href: '/prescription-queue', icon: '📬', label: 'Fila de validação', desc: 'Revisão clínica' },
    { href: '/adr-report',    icon: '⚠️', label: 'Notificar RAM',       desc: 'WHO-UMC + INFARMED' },
    { href: '/drug-intelligence', icon: '🧬', label: 'Drug Intelligence', desc: 'Formulário, DDD, ruturas' },
    { href: '/counseling',    icon: '🗒', label: 'Aconselhamento',      desc: 'Folha informativa ao doente' },
    { href: '/iv-compatibility', icon: '🧪', label: 'Compatibilidade IV', desc: 'Y-site, mistura, seringa' },
    { href: '/electrolytes',  icon: '⚡', label: 'Eletrólitos',         desc: 'Protocolos K, Na, Mg, Ca' },
    { href: '/emergency-doses', icon: '🚨', label: 'Doses de urgência', desc: 'Por peso e tempo' },
    { href: '/nota-clinica',  icon: '🗒', label: 'Nota clínica SOAP',   desc: 'Estruturada com IA' },
    { href: '/handover',      icon: '🔁', label: 'Passa-turno',         desc: 'Relatório IA' },
    { href: '/drug-info',     icon: '💊', label: 'Info de fármaco',     desc: 'Monografia' },
    { href: '/protocol',      icon: '📑', label: 'Protocolos',          desc: 'ESC, ADA, NICE, DGS' },
    { href: '/med-review',    icon: '🔍', label: 'Revisão de medicação', desc: 'Análise completa' },
    { href: '/carta',         icon: '✉', label: 'Carta de alta',       desc: 'Farmacoterapêutica' },
  ],
}

export const MODE_QUICK_ACTIONS: Record<string, NavTool[]> = {
  personal: [
    { href: '/mymeds',       icon: '💊', label: 'Comprimidos', desc: 'A lista e os lembretes de hoje' },
    { href: '/interactions', icon: '🔍', label: 'Verificar',   desc: 'Dão-se bem juntos?' },
    { href: '/vitals',       icon: '❤️', label: 'Saúde',       desc: 'Tensão, peso e açúcar' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar',   desc: 'Tirar uma dúvida' },
    { href: '/passport',     icon: '🆘', label: 'Emergência',  desc: 'Cartão QR' },
    { href: '/scan',         icon: '📷', label: 'Foto',        desc: 'Foto a uma receita ou caixa' },
  ],
  caregiver: [
    { href: '/familia',      icon: '👨‍👩‍👧', label: 'Dashboard',  desc: 'Resumo de todos os familiares', badge: 'Novo' },
    { href: '/perfis',       icon: '👤',   label: 'Perfis',     desc: 'Gerir perfis familiares' },
    { href: '/mymeds',       icon: '💊',   label: 'Medicação',  desc: 'Lista e lembretes' },
    { href: '/interactions', icon: '🔍',   label: 'Verificar',  desc: 'São seguros juntos?' },
    { href: '/calendario-meds', icon: '⏰',   label: 'Horário de toma', desc: 'A que horas devo tomar cada medicamento' },
    { href: '/ai',           icon: '🤖',   label: 'Perguntar',  desc: 'Dúvida de saúde' },
  ],
  clinical: [
    { href: '/painel',             icon: '🎛️', label: 'Painel',        desc: 'O painel da instituição, ao vivo' },
    { href: '/turno',              icon: '🏥', label: 'Turno',         desc: 'Utentes e alertas' },
    { href: '/rounds',             icon: '📋', label: 'Ronda',         desc: 'PCNE e intervenções' },
    { href: '/mar',                icon: '📝', label: 'MAR',           desc: 'Registo de administração' },
    { href: '/prescription-queue', icon: '📬', label: 'Validação',     desc: 'Fila de revisão farmacêutica' },
    { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intel',    desc: 'Formulário · DDD · Ruturas · Custos' },
    { href: '/quality',            icon: '📊', label: 'Qualidade',     desc: 'KPIs · Segurança · Intervenções' },
    { href: '/team',               icon: '👥', label: 'Equipa',        desc: 'Turnos · Vagas · Competências' },
    { href: '/calculos',           icon: '🧮', label: 'Calculadoras',  desc: 'CrCl, IBW, eGFR, PK, Child-Pugh' },
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
