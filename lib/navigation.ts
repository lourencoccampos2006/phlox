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
      { href: '/scan',         icon: '📷', label: 'Phlox Scan',          desc: 'Foto a receita, caixa, análise ou bula → a IA percebe' },
      { href: '/medicamento',  icon: '💡', label: 'O que é este medicamento?', desc: 'Escreve o nome → para que serve e cuidados' },
      { href: '/mymeds',       icon: '💊', label: 'Os meus medicamentos', desc: 'Lista, lembretes e adesão' },
      { href: '/interactions', icon: '🔍', label: 'Verificar interações',  desc: 'Qualquer combinação' },
      { href: '/food-drug',    icon: '🥗', label: 'Alimentos a evitar',   desc: 'O que não misturar' },
      { href: '/calendario-meds', icon: '⏰', label: 'A que horas devo tomar?', desc: 'Horário ideal de toma · IA', badge: 'Novo' },
      { href: '/optimizer',    icon: '⚡', label: 'Otimizar prescrição',  desc: 'Genéricos, STOPP/START', badge: 'Novo' },
    ],
  },
  {
    id: 'health', label: 'Saúde', color: '#e11d48',
    tools: [
      { href: '/saude-agora', icon: '🚨', label: 'Saúde agora',          desc: 'Devo ir ao médico? Primeiros socorros · 112' },
      { href: '/saude360',  icon: '🌐', label: 'Saúde 360°',           desc: 'Adesão + análises + agenda num só ecrã', badge: 'Premium' },
      { href: '/vault',     icon: '🔒', label: 'Cofre de saúde',       desc: 'Documentos com partilha por código', badge: 'Premium' },
      { href: '/vitals',    icon: '❤️', label: 'Sinais vitais',        desc: 'Tensão, pulso, peso' },
      { href: '/passport',  icon: '🆘', label: 'Passaporte de saúde',  desc: 'QR code de emergência' },
      { href: '/labs',      icon: '🧪', label: 'Perceber análises',    desc: 'O que cada valor significa' },
      { href: '/objetivos', icon: '🎯', label: 'Objetivos',            desc: 'Metas e acompanhamento' },
      { href: '/relatorio', icon: '📊', label: 'Relatório semanal',    desc: 'IA analisa a tua semana' },
      { href: '/ai',        icon: '🤖', label: 'Phlox AI',             desc: 'Qualquer dúvida de saúde' },
    ],
  },
  {
    id: 'caregiver', label: 'Cuidador', color: '#b45309',
    tools: [
      { href: '/familia360', icon: '👨‍👩‍👧', label: 'Família 360°',     desc: 'Inbox · Reconciliação · Zarit · Auditor', badge: 'Premium' },
      { href: '/familia',    icon: '🏠',   label: 'Família',            desc: 'Dashboard dos familiares' },
      { href: '/perfis',     icon: '👤',   label: 'Perfis',             desc: 'Gerir perfis familiares' },
      { href: '/dose-crianca', icon: '🧒', label: 'Dose pediátrica',    desc: 'Por peso e por medicamento' },
    ],
  },
  {
    id: 'clinical', label: 'Clínico', color: '#2563eb',
    tools: [
      // CURADORIA 2026-06-01: Reduzido de 26 para 14. Removidas /calculators,
      // /counseling, /electrolytes, /nota-clinica, /handover (ainda incompletas
      // ou duplicadas com calculos / oracle). O utilizador pode reativar em
      // /settings/tools.
      { href: '/cockpit',            icon: '🎛️', label: 'Cockpit Operacional', desc: 'Dashboard do turno · Alertas · KPIs' },
      { href: '/turno',              icon: '🏥', label: 'Turno',               desc: 'Gestão de doentes e doses' },
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
      { href: '/study360',  icon: '🎓', label: 'Estudo 360°',      desc: 'SRS, plano AI, Pomodoro, métricas', badge: 'Premium' },
      { href: '/biblioteca', icon: '📚', label: 'Biblioteca',       desc: 'PDFs e slides → resumo + perguntas', badge: 'Premium' },
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
    { href: '/exam',          icon: '📝', label: 'Modo exame',          desc: 'Simulação real com timer' },
    { href: '/decisao',       icon: '⚡', label: 'Phlox Decisão',       desc: 'Caso evolutivo com consequências' },
    // Mantemos /explica e /mnemonicas como atalhos para quem só quer um
    { href: '/explica',       icon: '✨', label: 'Explica-me (só)',     desc: 'Atalho direto à explicação' },
    { href: '/mnemonicas',    icon: '🧠', label: 'Mnemónicas (só)',     desc: 'Atalho direto à mnemónica' },
  ],
  clinical: [
    { href: '/calculos',      icon: '🧮', label: 'Calculadoras',        desc: 'CrCl, IBW, eGFR, PK' },
    { href: '/calculators',   icon: '🔢', label: 'Outras calculadoras', desc: 'CURB-65, MEWS, VTE' },
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
    { href: '/mymeds',       icon: '💊', label: 'Medicação',   desc: 'Lista e lembretes de hoje' },
    { href: '/interactions', icon: '🔍', label: 'Verificar',   desc: 'São seguros juntos?' },
    { href: '/vitals',       icon: '❤️', label: 'Saúde',       desc: 'Tensão, pulso, peso' },
    { href: '/ai',           icon: '🤖', label: 'Perguntar',   desc: 'Dúvida de saúde' },
    { href: '/passport',     icon: '🆘', label: 'Passaporte',  desc: 'QR de emergência' },
    { href: '/scan',         icon: '📄', label: 'Bula',        desc: 'Em linguagem simples' },
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
    { href: '/cockpit',            icon: '🎛️', label: 'Cockpit',       desc: 'Dashboard do turno e alertas' },
    { href: '/turno',              icon: '🏥', label: 'Turno',         desc: 'Doentes e alertas' },
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
