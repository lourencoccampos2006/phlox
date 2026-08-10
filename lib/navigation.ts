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
    ],
  },
  {
    id: 'health', label: 'Saúde', color: '#e11d48',
    tools: [
      { href: '/sintomas',  icon: '🌡', label: 'Como me sinto hoje',    desc: 'Diário de sintomas e recuperação' },
      { href: '/vault',     icon: '🔒', label: 'Os meus documentos',   desc: 'Análises e receitas, com partilha por código', badge: 'Premium' },
      { href: '/vitals',    icon: '❤️', label: 'Tensão, peso e açúcar', desc: 'Registar e ver como evolui' },
      { href: '/adherencia', icon: '📈', label: 'Adesão à medicação', desc: 'Padrões reais ao longo das semanas — que dias e horas falham mais' },
      { href: '/timeline',  icon: '🗓', label: 'A minha história de saúde', desc: 'Medicação, análises, documentos e sintomas, ao longo do tempo' },
      { href: '/passport',  icon: '🆘', label: 'Passaporte de saúde',  desc: 'Cartão de emergência e partilha por QR com o médico' },
      { href: '/labs',      icon: '🧪', label: 'Perceber as minhas análises', desc: 'O que cada valor quer dizer' },
      { href: '/ai',        icon: '🤖', label: 'Tirar uma dúvida',      desc: 'Pergunte em português simples' },
      { href: '/reach',     icon: '🎁', label: 'Convidar amigos',       desc: 'Ambos ganham quando alguém se junta com o seu código' },
      { href: '/partilhado-comigo', icon: '🔗', label: 'Partilhado comigo', desc: 'Perfis de família que outra pessoa te deu acesso a ver' },
      // CURADORIA 2026-07-21: eram 6 entradas Pro soltas aqui (rastreio visual,
      // vigia de ruturas, painel da condição, plano de recuperação, revisão da
      // medicação, exportar registo) — uma parede de itens parecidos, sem
      // hierarquia. Consolidadas num hub só (/saude-avancada, ver check-nav.mjs
      // KNOWN para os 6 hrefs originais, continuam alcançáveis a partir de lá).
      // /health-import saiu da lista (continua acessível por link direto e
      // pelos atalhos fixos em lib/pinnedTools.ts), só não polui esta lista.
      { href: '/saude-avancada', icon: '🔬', label: 'Saúde avançada', desc: 'Painel da condição, revisão da medicação, plano de peso, rastreio visual, vigia de ruturas, plano de recuperação, exportar registo', badge: 'Pro' },
    ],
  },
  {
    id: 'caregiver', label: 'Cuidador', color: '#b45309',
    tools: [
      { href: '/familia',    icon: '🏠',   label: 'A minha família',    desc: 'A saúde de cada pessoa num só sítio, perfis para adicionar e editar' },
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
      { href: '/mar',                icon: '📝', label: 'MAR',                 desc: 'Registo de administração' },
      { href: '/patients',           icon: '👥', label: 'Doentes',             desc: 'Fichas e medicação' },
      { href: '/calculos',           icon: '🧮', label: 'Calculadoras',        desc: 'CrCl, IBW, eGFR, PK, Child-Pugh' },
      { href: '/pk-dosing',          icon: '🔬', label: 'Console PK',          desc: 'Vancomicina AUC · Aminoglicosídeos', badge: 'Pro' },
      { href: '/antibiotics',        icon: '💉', label: 'Antibioterapia',      desc: 'Empírica · MRSA/ESBL', badge: 'Pro' },
      { href: '/stopp-start',        icon: '🛑', label: 'STOPP/START',         desc: 'v3 2023 + Beers', badge: 'Pro' },
      { href: '/tpn',                icon: '🧪', label: 'Nutrição Parentérica',desc: 'ASPEN 2022 · Rótulo PDF', badge: 'Pro' },
      { href: '/adr-report',         icon: '⚠️', label: 'Notificação RAM',     desc: 'WHO-UMC e INFARMED' },
      { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intelligence',   desc: 'Formulário · DDD · Ruturas · Custos' },
      { href: '/equipa',                 icon: '👥', label: 'Equipa',              desc: 'Turnos · Competências' },
    ],
  },
  {
    id: 'student', label: 'Estudante', color: '#7c3aed',
    tools: [
      { href: '/biblioteca', icon: '📚', label: 'As minhas sebentas', desc: 'Carregar PDFs e slides → resumo e perguntas', badge: 'Premium' },
      { href: '/arena',     icon: '🏆', label: 'Arena',            desc: 'Ligas Bronze → Diamante' },
      { href: '/simulador', icon: '🎮', label: 'Casos clínicos',   desc: 'Pratique decisões num caso real' },
      { href: '/osce',      icon: '🎯', label: 'Treinar OSCE',     desc: 'Exame prático com doente simulado' },
      { href: '/estagio',   icon: '🩺', label: 'Estágio',          desc: 'Doentes, diário, casos e relatórios do estágio' },
      { href: '/study',     icon: '🃏', label: 'Flashcards',       desc: '200+ tópicos com repetição espaçada' },
      { href: '/anatomia-3d', icon: '🫀', label: 'Explorar em 3D', desc: 'Atlas 3D real · pesquisa + AR', badge: 'Premium' },
      { href: '/tutor',     icon: '🤖', label: 'Tutor passo a passo', desc: 'Explica e faz-te pensar' },
      // CURADORIA 2026-07-22: "Turno Virtual" — reconstruída em 2026-05-31
      // (APIs /api/shift/generate e /api/shift/evaluate já reais) mas nunca
      // chegou a ser ligada a nenhum menu. Auditoria de ferramentas apanhou-a órfã.
      { href: '/shift',     icon: '🏥', label: 'Turno virtual',     desc: 'Simula um turno completo, decisão a decisão' },
      // Pesquisa competitiva 2026-07-27: comunidade completa (casos reais,
      // votos, diagnóstico revelado) com tabelas próprias, nunca ligada a
      // nenhum menu — zero pessoas a vê-la. Conteúdo ainda escasso (1 caso
      // seed) — considerar semear mais casos antes de promover a um lugar
      // mais visível.
      { href: '/grand-round', icon: '🩻', label: 'Grand Round',    desc: 'Casos reais anónimos — a comunidade debate, o autor revela' },
      // Pesquisa competitiva 2026-07-28: mnemónicas visuais geradas por IA
      // (Picmonic reporta +331% de retenção) — nunca tinha sido construída a sério.
      { href: '/mnemonicas', icon: '🧠', label: 'Mnemónicas visuais', desc: 'Uma imagem mental memorável por conceito, com baralho pessoal' },
      // sprint78 (exam_goals + IA) existia todo no backend mas /modo-exame era
      // só um redirect morto para /study — ninguém conseguia lá chegar.
      { href: '/modo-exame', icon: '⏳', label: 'Modo Exame',     desc: 'Contagem decrescente até ao exame, com sprint final' },
    ],
  },
]

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
    { href: '/familia',      icon: '👨‍👩‍👧', label: 'Família',  desc: 'Resumo e perfis de todos os familiares', badge: 'Novo' },
    { href: '/mymeds',       icon: '💊',   label: 'Medicação',  desc: 'Lista e lembretes' },
    { href: '/interactions', icon: '🔍',   label: 'Verificar',  desc: 'São seguros juntos?' },
    { href: '/ai',           icon: '🤖',   label: 'Perguntar',  desc: 'Dúvida de saúde' },
  ],
  clinical: [
    { href: '/painel',             icon: '🎛️', label: 'Painel',        desc: 'O painel da instituição, ao vivo' },
    { href: '/mar',                icon: '📝', label: 'MAR',           desc: 'Registo de administração' },
    { href: '/drug-intelligence',  icon: '🧬', label: 'Drug Intel',    desc: 'Formulário · DDD · Ruturas · Custos' },
    { href: '/equipa',                 icon: '👥', label: 'Equipa',        desc: 'Turnos · Vagas · Competências' },
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
  ],
}
