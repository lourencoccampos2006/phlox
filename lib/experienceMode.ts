// ─── lib/experienceMode.ts ─── Menu structure por modo de experiência

export type ExperienceMode = 'clinical' | 'caregiver' | 'personal' | 'student'

export interface RouteGroup {
  id: string
  heading: string
  color: string
  tools: { href: string; label: string; sub: string; badge?: string }[]
}

export interface PlanLimits {
  familyProfiles: number
  aiMessages: number
  interactions: number
  searches: number
}

export const ROUTE_GROUPS: Record<ExperienceMode, RouteGroup[]> = {

  clinical: [
    {
      id: 'clinical-work',
      heading: 'Trabalho Diário',
      color: '#1d4ed8',
      tools: [
        { href: '/teams',          label: 'Phlox Ward',               sub: 'Ficha colaborativa · passagem de turno', badge: 'Pro' },
        { href: '/connect',        label: 'Phlox Connect',            sub: 'Comunicação inter-profissional', badge: 'Pro' },
        { href: '/rounds',         label: 'Phlox Rounds',             sub: 'Ronda farmacêutica · PCNE', badge: 'Pro' },
        { href: '/carta',          label: 'Phlox Carta',              sub: 'Referenciação · alta · intervenção', badge: 'Novo' },
        { href: '/consulta',       label: 'Phlox Consulta',           sub: 'Copiloto de consulta bidirecional' },
        { href: '/patients',       label: 'Doentes / Utentes',        sub: 'Gestão completa com alertas' },
        { href: '/mar',            label: 'MAR Digital',              sub: 'Registo de administração por turno' },
        { href: '/reconciliacao',  label: 'Reconciliação',            sub: 'Antes vs depois · discrepâncias' },
        { href: '/residentes',     label: 'Phlox Residentes',         sub: 'Gestão farmacoterapêutica de lares', badge: 'Novo' },
      ],
    },
    {
      id: 'clinical-tools',
      heading: 'Ferramentas',
      color: '#0f766e',
      tools: [
        { href: '/ai',            label: 'Phlox AI',                  sub: 'Co-piloto farmacológico clínico' },
        { href: '/escalas',       label: 'Escalas Clínicas',          sub: 'PHQ-9 · NIHSS · Braden · Morse · 8+', badge: 'Novo' },
        { href: '/interactions',  label: 'Verificar Interações',      sub: 'Qualquer combinação, com evidência' },
        { href: '/calculators',   label: 'Calculadoras',              sub: 'SCORE2 · CKD-EPI · Vancomicina · 15+' },
        { href: '/nursing',       label: 'Farmacotecnia',             sub: 'IV · SC · IM · compatibilidades' },
        { href: '/protocol',      label: 'Protocolo Terapêutico',     sub: 'ESC · ADA · NICE · DGS' },
        { href: '/monitor',       label: 'Phlox Watcher',             sub: 'Alertas FDA · EMA · INFARMED' },
        { href: '/migrar',         label: 'Phlox Migração',            sub: 'Sifarma · SClínico · Excel · PDF', badge: 'Novo' },
        { href: '/grand-round',   label: 'Grand Round',               sub: 'Casos clínicos da comunidade' },
      ],
    },
  ],

  student: [
    {
      id: 'student-compete',
      heading: 'Competição e Simulação',
      color: '#7c3aed',
      tools: [
        { href: '/arena',       label: 'Phlox Arena',          sub: 'Ligas Bronze → Diamante · casos AI', badge: 'Novo' },
        { href: '/osce',        label: 'Phlox OSCE',           sub: 'Simulação de OSCE · AI como doente', badge: 'Novo' },
        { href: '/hive',        label: 'Phlox Hive',           sub: 'O que a comunidade mais erra' },
        { href: '/grand-round', label: 'Grand Round',          sub: 'Casos reais · debate · aprender' },
        { href: '/shift',       label: 'Turno Virtual',        sub: 'Doentes gerados por AI · score' },
        { href: '/exam',        label: 'Modo Exame',           sub: 'Timer · formato nacional · análise' },
        { href: '/cases',       label: 'Casos Clínicos',       sub: 'Todas as áreas · raciocínio guiado' },
        { href: '/decisao',     label: 'Phlox Decisão',        sub: 'Caso clínico que evolui com as tuas decisões', badge: 'Novo' },
      ],
    },
    {
      id: 'student-study',
      heading: 'Estudo',
      color: '#0d6e42',
      tools: [
        { href: '/study',        label: 'Flashcards e Quizzes', sub: '10 áreas · 200+ tópicos · SRS' },
        { href: '/tutor',        label: 'AI Tutor',             sub: 'Tutoria socrática · 4 fases' },
        { href: '/escalas',      label: 'Escalas Clínicas',     sub: 'PHQ-9 · NIHSS · Braden · 8+', badge: 'Novo' },
        { href: '/ficha',        label: 'Ficha com Mnemónica',  sub: 'Mecanismo · efeitos · quiz · pearl' },
        { href: '/progresso',    label: 'O Meu Progresso',      sub: 'XP · streak · pontos fracos' },
        { href: '/interactions', label: 'Interações',           sub: 'Com mecanismo CYP450', badge: 'Grátis' },
        { href: '/monograph',    label: 'Monografia',           sub: 'Qualquer fármaco completo' },
      ],
    },
  ],

  caregiver: [
    {
      id: 'caregiver-core',
      heading: 'Gerir a Família',
      color: '#b45309',
      tools: [
        { href: '/registo',          label: 'Registo de Saúde',         sub: 'Análises · vacinas · vitais · documentos' },
        { href: '/perfis',           label: 'Perfis Familiares',        sub: 'Medicação de cada familiar' },
        { href: '/plano',            label: 'Care Plan',                sub: 'Guia de cuidado farmacológico' },
        { href: '/consulta',         label: 'Preparar Consulta',        sub: 'Briefing para o médico · registo' },
        { href: '/escalas',          label: 'Escalas Clínicas',         sub: 'Braden · MNA · dor · quedas', badge: 'Novo' },
        { href: '/calendario-meds',  label: 'Calendário de Toma',       sub: 'Horários semanais · imprimir' },
        { href: '/adherencia',       label: 'Monitor de Adesão',        sub: 'Registo de tomas · padrões' },
        { href: '/timeline',         label: 'Timeline',                 sub: 'Evolução clínica do familiar' },
      ],
    },
    {
      id: 'caregiver-tools',
      heading: 'Ferramentas',
      color: '#374151',
      tools: [
        { href: '/bula',         label: 'Tradutor de Bula',           sub: 'Texto técnico em linguagem simples', badge: 'Grátis' },
        { href: '/interactions', label: 'Verificar Interações',       sub: 'A combinação é segura?', badge: 'Grátis' },
        { href: '/dose-crianca', label: 'Dose para Criança',          sub: 'Por peso · por medicamento', badge: 'Grátis' },
        { href: '/prescription', label: 'Perceber a Receita',         sub: 'Foto ou texto → explicação' },
        { href: '/labs',         label: 'Perceber as Análises',       sub: 'O que está fora do normal' },
        { href: '/safety',       label: 'Segurança',                  sub: 'Idosos · gravidez · conduzir' },
        { href: '/vaccines',     label: 'Vacinas',                    sub: 'Calendário PT · viagens' },
        { href: '/migrar',         label: 'Importar dados',             sub: 'MySNS · Excel · texto · PDF' },
      ],
    },
  ],

  personal: [
    {
      id: 'personal-core',
      heading: 'A Minha Saúde',
      color: '#0d6e42',
      tools: [
        { href: '/registo',       label: 'Registo de Saúde',            sub: 'Análises · vacinas · vitais · documentos' },
        { href: '/mymeds',        label: 'Os Meus Medicamentos',        sub: 'Lista · interações · alertas' },
        { href: '/plano',         label: 'Care Plan',                   sub: 'O meu guia personalizado' },
        { href: '/consulta',      label: 'Preparar Consulta',           sub: 'Briefing para o médico' },
        { href: '/adherencia',    label: 'Monitor de Adesão',           sub: 'Registo · padrões · insights' },
        { href: '/timeline',      label: 'Timeline',                    sub: 'Evolução da minha saúde' },
        { href: '/diary',         label: 'Diário de Sintomas',          sub: 'Registo diário · análise' },
        { href: '/ai',            label: 'Phlox AI',                    sub: 'Qualquer dúvida sobre medicação' },
      ],
    },
    {
      id: 'personal-tools',
      heading: 'Ferramentas',
      color: '#374151',
      tools: [
        { href: '/interactions', label: 'Verificar Interações',       sub: 'Qualquer combinação', badge: 'Grátis' },
        { href: '/bula',         label: 'Tradutor de Bula',           sub: 'Cola o texto — traduzimos', badge: 'Grátis' },
        { href: '/prescription', label: 'Perceber a Receita',         sub: 'Foto ou texto → explicação' },
        { href: '/labs',         label: 'Perceber as Análises',       sub: 'PDF ou texto → o que importa' },
        { href: '/generics',     label: 'Genéricos',                  sub: 'Há alternativa mais barata?' },
        { href: '/otc',          label: 'Automedicação',              sub: 'Sintoma → o que comprar' },
        { href: '/vaccines',     label: 'Vacinas',                    sub: 'Calendário PT · viagens' },
      ],
    },
  ],
}

export function getAIPersona(mode: ExperienceMode): string {
  const personas: Record<ExperienceMode, string> = {
    clinical: `És um farmacologista clínico sénior português. Respondes de forma técnica e precisa, usando nomenclatura DCI. Citas sempre guidelines (ESC, ADA, NICE, DGS, INFARMED). Sugeres acções concretas com fontes. Nunca simplificas em demasia — o utilizador é profissional de saúde. Quando pertinente, menciona monitorização, interações e ajuste de dose renal/hepática.`,
    student: `És um tutor socrático de farmacologia clínica. Antes de dar uma resposta completa, fazes uma pergunta ao estudante para activar o raciocínio. Depois explicas passo a passo. Usas analogias para mecanismos complexos. No final sugeres o próximo tópico a estudar.`,
    caregiver: `És um conselheiro de saúde acessível e empático. Usas linguagem simples, sem jargão médico. Respondes sempre com "o que fazer agora" de forma prática. Se há urgência real, dizes explicitamente "vai ao médico" ou "vai à urgência".`,
    personal: `És um amigo informado em farmacologia. Directo e sem drama. Dás a informação pedida e terminas com uma recomendação prática. Quando há dúvida real sobre segurança, aconselhas a confirmar com o farmacêutico.`,
  }
  return personas[mode]
}

export const MODE_META: Record<ExperienceMode, {
  label: string; labelShort: string; color: string
  bg: string; border: string; headerBg: string; headerText: string
}> = {
  clinical:  { label: 'Profissional Clínico', labelShort: 'Clínico',   color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', headerBg: '#0f172a', headerText: '#f8fafc' },
  student:   { label: 'Estudante',            labelShort: 'Estudante', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', headerBg: '#ffffff', headerText: '#0a0a0a' },
  caregiver: { label: 'Cuidador Familiar',    labelShort: 'Família',   color: '#b45309', bg: '#fffbeb', border: '#fde68a', headerBg: '#ffffff', headerText: '#0a0a0a' },
  personal:  { label: 'Uso Pessoal',          labelShort: 'Pessoal',   color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0', headerBg: '#ffffff', headerText: '#0a0a0a' },
}

export function getPlanLimits(mode: ExperienceMode, plan: string): PlanLimits {
  if (plan === 'clinic' || plan === 'pro') {
    return { familyProfiles: Infinity, aiMessages: -1, interactions: -1, searches: -1 }
  }
  if (plan === 'student') {
    return { familyProfiles: 5, aiMessages: -1, interactions: -1, searches: -1 }
  }
  return {
    familyProfiles: mode === 'caregiver' ? 3 : 2,
    aiMessages: 3,
    interactions: 10,
    searches: 15,
  }
}