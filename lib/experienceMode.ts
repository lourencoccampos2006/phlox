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

  // ─── CLÍNICO ─────────────────────────────────────────────────────────────────
  clinical: [
    {
      id: 'clinical-daily',
      heading: 'Fluxo de Trabalho',
      color: '#1d4ed8',
      tools: [
        { href: '/turno',         label: 'Turno',                    sub: 'Todos os doentes, doses e alertas num só ecrã', badge: 'Novo' },
        { href: '/rounds',        label: 'Ronda Farmacêutica',       sub: 'Intervenções PCNE · pendentes · métricas' },
        { href: '/mar',           label: 'Administração (MAR)',       sub: 'Registo de tomas por turno · alertas de omissão' },
        { href: '/patients',      label: 'Doentes & Utentes',        sub: 'Fichas, medicação, alertas e notas clínicas' },
        { href: '/residentes',    label: 'Lares & Residentes',       sub: 'Gestão farmacoterapêutica de lares' },
        { href: '/reconciliacao', label: 'Reconciliação',            sub: 'Antes vs depois da admissão · discrepâncias' },
      ],
    },
    {
      id: 'clinical-decision',
      heading: 'Decisão Clínica',
      color: '#0f766e',
      tools: [
        { href: '/oracle',        label: 'Oracle — Consulta AI',     sub: 'Avaliação SOAP · PCNE v9.1 · plano de intervenção', badge: 'Novo' },
        { href: '/optimizer',     label: 'Otimizar Prescrição',      sub: 'Genéricos · STOPP/START · monitorização · doses', badge: 'Novo' },
        { href: '/interactions',  label: 'Interações',               sub: 'Qualquer combinação, com evidência e mecanismo' },
        { href: '/food-drug',     label: 'Fármaco-Alimento',         sub: 'Toranja · álcool · vitamina K · tiramina', badge: 'Novo' },
        { href: '/adr-report',    label: 'Notificação de RAM',       sub: 'Causalidade WHO-UMC · MedDRA · INFARMED', badge: 'Novo' },
        { href: '/escalas',       label: 'Escalas Clínicas',         sub: 'PHQ-9 · NIHSS · Braden · Morse · 8+ escalas' },
      ],
    },
    {
      id: 'clinical-tools',
      heading: 'Ferramentas',
      color: '#7c3aed',
      tools: [
        { href: '/iv-calc',       label: 'Calculadora IV',            sub: 'Volume · infusão · reconstituição · referência', badge: 'Novo' },
        { href: '/calculators',   label: 'Calculadoras',              sub: 'SCORE2 · CKD-EPI · Vancomicina · 15+' },
        { href: '/nursing',       label: 'Farmacotecnia',             sub: 'IV · SC · IM · compatibilidades de misturas' },
        { href: '/protocol',      label: 'Protocolos',                sub: 'Guias ESC · ADA · NICE · DGS' },
        { href: '/monitor',       label: 'Alertas Automáticos',       sub: 'Monitorização contínua · recalls · EMA · INFARMED' },
        { href: '/integracoes',   label: 'Integrações & Importação',  sub: 'SClínico · Sifarma · Apple Saúde · CSV', badge: 'Novo' },
      ],
    },
    {
      id: 'clinical-ai',
      heading: 'Assistente & IA',
      color: '#0d6e42',
      tools: [
        { href: '/ai',            label: 'Phlox AI',                  sub: 'Co-piloto farmacológico com referências clínicas' },
        { href: '/carta',         label: 'Carta de Alta',             sub: 'Gerador de carta de alta farmacoterapêutica' },
        { href: '/med-review',    label: 'Revisão de Medicação',      sub: 'Análise completa do esquema terapêutico' },
        { href: '/schedule',      label: 'Horário de Medicação',      sub: 'Horário ideal para cada doente com AI', badge: 'Novo' },
        { href: '/link',          label: 'Phlox Link',                sub: 'Partilhar dados clínicos com equipa ou doente', badge: 'Novo' },
        { href: '/migrar',        label: 'Migrar Dados',              sub: 'Sifarma · SClínico · Excel · PDF' },
      ],
    },
  ],

  // ─── ESTUDANTE ───────────────────────────────────────────────────────────────
  student: [
    {
      id: 'student-compete',
      heading: 'Praticar & Competir',
      color: '#7c3aed',
      tools: [
        { href: '/arena',         label: 'Arena',                    sub: 'Ligas Bronze → Diamante · casos com AI' },
        { href: '/simulador',     label: 'Simulador Clínico',        sub: 'Caso · Turno · Evolutivo — 3 modos de jogo', badge: 'Novo' },
        { href: '/osce',          label: 'Simulação OSCE',           sub: 'AI como doente · feedback imediato · OSCE real' },
        { href: '/exam',          label: 'Modo Exame',               sub: 'Timer · formato nacional · análise de erros' },
        { href: '/grand-round',   label: 'Grand Round',              sub: 'Casos reais · debate · aprender com outros' },
        { href: '/cases',         label: 'Casos Clínicos',           sub: 'Arquivo de casos resolvidos por área' },
      ],
    },
    {
      id: 'student-study',
      heading: 'Estudar',
      color: '#0d6e42',
      tools: [
        { href: '/study',         label: 'Flashcards & Quizzes',     sub: '200+ tópicos · 10 áreas · repetição espaçada' },
        { href: '/tutor',         label: 'AI Tutor',                 sub: 'Tutoria socrática · explica passo a passo' },
        { href: '/ficha',         label: 'Ficha de Fármaco',         sub: 'Mecanismo · efeitos · mnemónica · quiz' },
        { href: '/interactions',  label: 'Interações com Mecanismo', sub: 'CYP450 · PD · PK · evidência clínica' },
        { href: '/escalas',       label: 'Escalas Clínicas',         sub: 'PHQ-9 · NIHSS · Braden · Morse · 8+', badge: 'Novo' },
        { href: '/progresso',     label: 'O Meu Progresso',          sub: 'XP · streak · pontos fracos · evolução' },
      ],
    },
    {
      id: 'student-clinic',
      heading: 'Ferramentas Clínicas',
      color: '#1d4ed8',
      tools: [
        { href: '/oracle',        label: 'Oracle — Consulta AI',     sub: 'SOAP · raciocínio farmacológico · estudo de caso' },
        { href: '/adr-report',    label: 'Reportar RAM',             sub: 'Pratica notificação WHO-UMC · MedDRA · INFARMED', badge: 'Novo' },
        { href: '/optimizer',     label: 'STOPP/START',              sub: 'Critérios de desprescrição · Beers 2023' },
        { href: '/calculators',   label: 'Calculadoras',             sub: 'SCORE2 · CKD-EPI · Vancomicina · 15+' },
        { href: '/escalas',       label: 'Escalas Validadas',        sub: 'PHQ-9 · NIHSS · Braden · MNA · Morse' },
        { href: '/schedule',      label: 'Horário de Medicação',     sub: 'Gera e justifica o horário farmacológico ideal', badge: 'Novo' },
      ],
    },
  ],

  // ─── CUIDADOR FAMILIAR ────────────────────────────────────────────────────────
  caregiver: [
    {
      id: 'caregiver-family',
      heading: 'Gerir a Família',
      color: '#b45309',
      tools: [
        { href: '/perfis',             label: 'Perfis Familiares',       sub: 'Medicação, alergias e saúde de cada familiar' },
        { href: '/mymeds',             label: 'Medicamentos',            sub: 'Lista completa · lembretes · verificação' },
        { href: '/calendario-meds',    label: 'A que horas devo tomar?', sub: 'Horários semanais · IA · imprimir · partilhar', badge: 'Novo' },
        { href: '/adherencia',         label: 'Adesão à Medicação',      sub: 'Quem tomou o quê · padrões · falhas' },
        { href: '/consult-prep',       label: 'Preparar Consulta',       sub: 'As perguntas certas para o médico · imprimir' },
      ],
    },
    {
      id: 'caregiver-safety',
      heading: 'Verificar Segurança',
      color: '#991b1b',
      tools: [
        { href: '/interactions',  label: 'Os medicamentos são seguros juntos?', sub: 'Verificar qualquer combinação', badge: 'Grátis' },
        { href: '/food-drug',     label: 'Pode comer com a medicação?',         sub: 'Álcool · toranja · laticínios · café', badge: 'Novo' },
        { href: '/dose-crianca',  label: 'Dose Certa para Criança',             sub: 'Por peso e por medicamento', badge: 'Grátis' },
        { href: '/oracle',        label: 'Perguntar ao Farmacêutico AI',        sub: 'Consulta com resposta personalizada', badge: 'Novo' },
        { href: '/escalas',       label: 'Avaliar o Estado do Familiar',        sub: 'Braden · MNA · dor · risco de quedas', badge: 'Novo' },
        { href: '/adr-report',    label: 'Notificar Reação Adversa',            sub: 'O familiar teve uma reação? Regista aqui', badge: 'Novo' },
      ],
    },
    {
      id: 'caregiver-docs',
      heading: 'Documentos & Conexões',
      color: '#374151',
      tools: [
        { href: '/passport',      label: 'Passaporte de Saúde',    sub: 'Documento completo · imprimir · QR de emergência', badge: 'Novo' },
        { href: '/vitals',        label: 'Sinais Vitais',          sub: 'Registar TA · FC · SpO₂ · peso · glicemia', badge: 'Novo' },
        { href: '/objetivos',     label: 'Objetivos de Saúde',     sub: 'Definir metas · acompanhar progresso', badge: 'Novo' },
        { href: '/relatorio',     label: 'Relatório Semanal',      sub: 'IA analisa a semana e dá recomendações', badge: 'Novo' },
        { href: '/link',          label: 'Phlox Link',             sub: 'Partilhar dados com médico ou farmacêutico', badge: 'Novo' },
        { href: '/bula',          label: 'Perceber a Bula',        sub: 'Texto técnico em linguagem simples', badge: 'Grátis' },
      ],
    },
    {
      id: 'caregiver-health',
      heading: 'Saúde & Registos',
      color: '#0d6e42',
      tools: [
        { href: '/labs',          label: 'Perceber as Análises',   sub: 'O que está fora do normal e o que fazer' },
        { href: '/prescription',  label: 'Perceber a Receita',     sub: 'Foto ou texto → explicação clara' },
        { href: '/vaccines',      label: 'Vacinas em Dia?',        sub: 'Calendário PT · viagens · recomendações' },
        { href: '/timeline',      label: 'Histórico de Saúde',     sub: 'Evolução clínica ao longo do tempo' },
        { href: '/ai',            label: 'Phlox AI',               sub: 'Chatbot de saúde para qualquer dúvida' },
      ],
    },
  ],

  // ─── PESSOAL ─────────────────────────────────────────────────────────────────
  personal: [
    {
      id: 'personal-meds',
      heading: 'A Minha Medicação',
      color: '#0d6e42',
      tools: [
        { href: '/mymeds',        label: 'Os Meus Medicamentos',   sub: 'Lista · lembretes · verificação automática' },
        { href: '/calendario-meds', label: 'A que horas devo tomar?', sub: 'A AI cria o horário perfeito para a tua medicação', badge: 'Novo' },
        { href: '/adherencia',    label: 'Adesão à Medicação',     sub: 'Registo · padrões · insights pessoais' },
        { href: '/diary',         label: 'Diário de Saúde',        sub: 'Sintomas diários · bem-estar · notas' },
      ],
    },
    {
      id: 'personal-safety',
      heading: 'Verificar & Perguntar',
      color: '#dc2626',
      tools: [
        { href: '/oracle',        label: 'Perguntar ao Farmacêutico AI', sub: 'Consulta com resposta estruturada e plano', badge: 'Novo' },
        { href: '/interactions',  label: 'Esta combinação é segura?',    sub: 'Verificar qualquer par de medicamentos', badge: 'Grátis' },
        { href: '/food-drug',     label: 'Posso comer isto?',            sub: 'Toranja · álcool · laticínios · café', badge: 'Novo' },
        { href: '/optimizer',     label: 'Otimizar a Minha Medicação',   sub: 'Genéricos mais baratos · segurança · poupança', badge: 'Novo' },
      ],
    },
    {
      id: 'personal-health',
      heading: 'Saúde & Medições',
      color: '#1d4ed8',
      tools: [
        { href: '/vitals',        label: 'Sinais Vitais',          sub: 'TA · FC · SpO₂ · peso · tendências', badge: 'Novo' },
        { href: '/objetivos',     label: 'Objetivos de Saúde',     sub: 'Definir metas · acompanhar progresso', badge: 'Novo' },
        { href: '/integracoes',   label: 'Importar do Apple Watch', sub: 'Apple Saúde · Garmin · Fitbit · automático', badge: 'Novo' },
        { href: '/labs',          label: 'Perceber as Análises',   sub: 'PDF ou texto → o que importa e o que fazer' },
      ],
    },
    {
      id: 'personal-docs',
      heading: 'Documentos & Partilha',
      color: '#374151',
      tools: [
        { href: '/passport',      label: 'Passaporte de Saúde',   sub: 'Documento completo · imprimir · QR · bilingue', badge: 'Novo' },
        { href: '/link',          label: 'Phlox Link',            sub: 'Partilhar dados com médico ou familiar', badge: 'Novo' },
        { href: '/relatorio',     label: 'Relatório Semanal',     sub: 'IA analisa a tua semana e dá recomendações', badge: 'Novo' },
        { href: '/bula',          label: 'Perceber a Bula',       sub: 'Texto técnico em linguagem simples', badge: 'Grátis' },
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
  clinical:  { label: 'Profissional de Saúde', labelShort: 'Clínico',   color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', headerBg: '#0f172a', headerText: '#f8fafc' },
  student:   { label: 'Estudante',             labelShort: 'Estudante', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', headerBg: '#ffffff', headerText: '#0a0a0a' },
  caregiver: { label: 'Cuidador Familiar',     labelShort: 'Família',   color: '#b45309', bg: '#fffbeb', border: '#fde68a', headerBg: '#ffffff', headerText: '#0a0a0a' },
  personal:  { label: 'Uso Pessoal',           labelShort: 'Pessoal',   color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0', headerBg: '#ffffff', headerText: '#0a0a0a' },
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
