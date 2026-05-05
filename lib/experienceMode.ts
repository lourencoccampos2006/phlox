// ─── NOVO: lib/experienceMode.ts ───
// Helper central para gerir modos de experiência.
// Usado no Header, Dashboard, AI, Pricing e Onboarding.

export type ExperienceMode = 'clinical' | 'caregiver' | 'personal' | 'student'

export interface RouteGroup {
  id: string
  heading: string
  color: string
  tools: { href: string; label: string; sub: string; badge?: string }[]
}

export interface PlanLimits {
  familyProfiles: number
  aiMessages: number     // por dia, -1 = ilimitado
  interactions: number   // por dia, -1 = ilimitado
  searches: number       // por dia, -1 = ilimitado
}

// ─── Rotas visíveis por modo ──────────────────────────────────────────────────

export const ROUTE_GROUPS: Record<ExperienceMode, RouteGroup[]> = {
  clinical: [
    {
      id: 'clinical-core',
      heading: 'Clínica Diária',
      color: '#1d4ed8',
      tools: [
        { href: '/patients',     label: 'Doentes / Utentes',        sub: 'Gestão completa com alertas' },
        { href: '/ai',           label: 'Phlox AI Clínico',         sub: 'Co-piloto farmacológico IA' },
        { href: '/mar',          label: 'Registo de Administração', sub: 'MAR por turno · lares e clínicas', badge: 'Pro' },
        { href: '/importar',     label: 'Importar Medicamentos',    sub: 'Sifarma · SClínico · lista', badge: 'Pro' },
        { href: '/briefing',     label: 'Briefing de Consulta',     sub: 'Preparação em 15 segundos' },
        { href: '/med-review',   label: 'Revisão de Medicação',     sub: 'Análise clínica + PDF' },
      ],
    },
    {
      id: 'clinical-tools',
      heading: 'Ferramentas Clínicas',
      color: '#0f766e',
      tools: [
        { href: '/interactions',  label: 'Verificar Interações',    sub: 'Qualquer combinação, em segundos' },
        { href: '/protocol',      label: 'Protocolo Terapêutico',   sub: 'ESC · ADA · NICE · DGS' },
        { href: '/strategy',      label: 'Estratégias',             sub: 'Alternativas com evidência A/B/C' },
        { href: '/calculators',   label: 'Calculadoras',            sub: 'SCORE2 · CKD-EPI · Cockcroft' },
        { href: '/doses',         label: 'Posologia',               sub: 'Por indicação e guideline' },
        { href: '/quickcheck',    label: 'Análise Rápida',          sub: 'Lista completa → risco em segundos' },
      ],
    },
    {
      id: 'clinical-ref',
      heading: 'Referência',
      color: '#374151',
      tools: [
        { href: '/nursing',       label: 'IV · SC · IM',            sub: 'Compatibilidades e farmacotecnia' },
        { href: '/compatibility', label: 'Compatibilidade IV',      sub: "Trissel's e King Guide" },
        { href: '/dilutions',     label: 'Diluições IV',            sub: 'Velocidades e estabilidade' },
        { href: '/monograph',     label: 'Monografia',              sub: 'Qualquer fármaco, completo' },
        { href: '/drugs',         label: 'Base de Dados',           sub: '10.000+ medicamentos em PT' },
      ],
    },
  ],

  student: [
    {
      id: 'student-study',
      heading: 'Estudo',
      color: '#7c3aed',
      tools: [
        { href: '/study',    label: 'Flashcards e Quizzes',  sub: 'Farmacologia · Clínica · Emergência' },
        { href: '/exam',     label: 'Modo Exame',            sub: 'Timer + análise de erros' },
        { href: '/cases',    label: 'Casos Clínicos',        sub: 'Raciocínio guiado · todos os níveis' },
        { href: '/shift',    label: 'Turno Virtual',         sub: '3 doentes · score · feedback IA' },
        { href: '/compare',  label: 'Comparar Fármacos',     sub: 'A vs B — linha a linha' },
        { href: '/disease',  label: 'Fármacos por Doença',   sub: '1ª e 2ª linha com doses' },
      ],
    },
    {
      id: 'student-tools',
      heading: 'Ferramentas',
      color: '#0d6e42',
      tools: [
        { href: '/ai',           label: 'Phlox AI Tutor',          sub: 'Aprende com perguntas socráticas' },
        { href: '/interactions', label: 'Verificar Interações',    sub: 'Com explicação do mecanismo', badge: 'Grátis' },
        { href: '/monograph',    label: 'Monografia',              sub: 'Qualquer fármaco com mnemónica' },
        { href: '/calculators',  label: 'Calculadoras Clínicas',   sub: 'Para resolver os casos' },
        { href: '/protocol',     label: 'Protocolo Terapêutico',   sub: 'Guidelines para os exames' },
        { href: '/drugs',        label: 'Base de Dados',           sub: '10.000+ fármacos' },
      ],
    },
  ],

  caregiver: [
    {
      id: 'caregiver-core',
      heading: 'Os Meus Perfis',
      color: '#b45309',
      tools: [
        { href: '/perfis',       label: 'Perfis Familiares',        sub: 'Medicação de cada familiar' },
        { href: '/ai',           label: 'Phlox AI',                 sub: 'Pergunta sobre qualquer familiar' },
        { href: '/interactions', label: 'Verificar Interações',     sub: 'Brufen + Xarelto — analisamos', badge: 'Grátis' },
        { href: '/bula',         label: 'Tradutor de Bula',         sub: 'Linguagem simples para qualquer bula', badge: 'Grátis' },
        { href: '/dose-crianca', label: 'Dose para Criança',        sub: 'Dose certa por peso', badge: 'Grátis' },
      ],
    },
    {
      id: 'caregiver-tools',
      heading: 'Ferramentas',
      color: '#0d6e42',
      tools: [
        { href: '/prescription', label: 'Perceber a Receita',       sub: 'Foto ou texto → explicação simples' },
        { href: '/labs',         label: 'Perceber as Análises',     sub: 'O que está fora do normal' },
        { href: '/vaccines',     label: 'Vacinas em Dia?',          sub: 'Calendário PT · viagens' },
        { href: '/otc',          label: 'Automedicação',            sub: 'Sintoma → o que comprar' },
        { href: '/consult-prep', label: 'Preparar Consulta',        sub: 'Perguntas certas para o médico' },
        { href: '/safety',       label: 'Segurança',                sub: 'Idosos · gravidez · conduzir' },
      ],
    },
  ],

  personal: [
    {
      id: 'personal-core',
      heading: 'A Minha Saúde',
      color: '#0d6e42',
      tools: [
        { href: '/mymeds',       label: 'Os Meus Medicamentos',    sub: 'Lista pessoal com interações' },
        { href: '/ai',           label: 'Phlox AI',                sub: 'A tua dúvida sobre medicamentos' },
        { href: '/interactions', label: 'Verificar Interações',    sub: 'Qualquer combinação', badge: 'Grátis' },
        { href: '/bula',         label: 'Tradutor de Bula',        sub: 'Cola o texto — traduzimos', badge: 'Grátis' },
        { href: '/prescription', label: 'Perceber a Receita',      sub: 'Foto ou texto → explicação' },
        { href: '/labs',         label: 'Perceber as Análises',    sub: 'PDF ou texto → o que importa' },
      ],
    },
    {
      id: 'personal-tools',
      heading: 'Mais Ferramentas',
      color: '#374151',
      tools: [
        { href: '/otc',          label: 'Automedicação',           sub: 'Sintoma → o que comprar' },
        { href: '/generics',     label: 'Genéricos',               sub: 'Há alternativa mais barata?' },
        { href: '/vaccines',     label: 'Vacinas',                 sub: 'Calendário PT · viagens' },
        { href: '/diary',        label: 'Diário de Sintomas',      sub: 'Tracker + análise farmacológica' },
        { href: '/consult-prep', label: 'Preparar Consulta',       sub: 'Perguntas certas para o médico' },
        { href: '/safety',       label: 'Segurança',               sub: 'Conduzir · gravidez · álcool' },
      ],
    },
  ],
}

// ─── Persona da AI por modo ───────────────────────────────────────────────────

export function getAIPersona(mode: ExperienceMode): string {
  const personas: Record<ExperienceMode, string> = {
    clinical: `És um farmacologista clínico sénior português. Respondes de forma técnica e precisa, usando nomenclatura DCI. Citas sempre guidelines (ESC, ADA, NICE, DGS, INFARMED). Sugeres acções concretas com fontes. Nunca simplificas em demasia — o utilizador é profissional de saúde. Quando pertinente, menciona monitorização, interações e ajuste de dose renal/hepática.`,
    student: `És um tutor socrático de farmacologia clínica. Antes de dar uma resposta completa, fazes sempre uma pergunta ao estudante para activar o raciocínio: "O que sabes sobre o mecanismo deste fármaco?" ou "Qual seria a tua primeira escolha e porquê?". Depois explicas passo a passo. Usas analogias para mecanismos complexos. No final suges sempre o próximo tópico a estudar. O teu objectivo é que o estudante compreenda, não apenas memorize.`,
    caregiver: `És um conselheiro de saúde de confiança, acessível e empático. Usas linguagem simples, sem jargão médico. Quando há termos técnicos, explicas-os entre parênteses. Respondes sempre com "o que fazer agora" de forma prática e clara. Se há urgência real, dizes explicitamente "vai ao médico" ou "vai à urgência". O utilizador cuida de um familiar e precisa de respostas claras, não de incerteza.`,
    personal: `És um amigo informado em farmacologia. Directo e sem drama. Dás a informação que é pedida e terminas sempre com uma recomendação prática. Quando há dúvida real sobre segurança, aconselhas a confirmar com o farmacêutico ou médico. Não usas jargão desnecessário mas também não condescendes.`,
  }
  return personas[mode]
}

// ─── Cores e labels por modo ──────────────────────────────────────────────────

export const MODE_META: Record<ExperienceMode, {
  label: string
  labelShort: string
  color: string
  bg: string
  border: string
  headerBg: string
  headerText: string
}> = {
  clinical: {
    label: 'Profissional Clínico',
    labelShort: 'Clínico',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    headerBg: '#0f172a',
    headerText: '#f8fafc',
  },
  student: {
    label: 'Estudante',
    labelShort: 'Estudante',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    headerBg: '#ffffff',
    headerText: '#0a0a0a',
  },
  caregiver: {
    label: 'Cuidador Familiar',
    labelShort: 'Família',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    headerBg: '#ffffff',
    headerText: '#0a0a0a',
  },
  personal: {
    label: 'Uso Pessoal',
    labelShort: 'Pessoal',
    color: '#0d6e42',
    bg: '#f0fdf5',
    border: '#bbf7d0',
    headerBg: '#ffffff',
    headerText: '#0a0a0a',
  },
}

// ─── Limites de plano por modo ────────────────────────────────────────────────

export function getPlanLimits(mode: ExperienceMode, plan: string): PlanLimits {
  if (plan === 'clinic' || plan === 'pro') {
    return { familyProfiles: Infinity, aiMessages: -1, interactions: -1, searches: -1 }
  }
  if (plan === 'student') {
    return { familyProfiles: 5, aiMessages: -1, interactions: -1, searches: -1 }
  }
  // free
  return {
    familyProfiles: mode === 'caregiver' ? 3 : 2,
    aiMessages: 3,
    interactions: 10,
    searches: 15,
  }
}