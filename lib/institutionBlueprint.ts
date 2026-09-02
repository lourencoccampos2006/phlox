// lib/institutionBlueprint.ts
// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA do que CADA tipo de instituição É como produto.
//
// Filosofia (reformulação 2026-06-12): a parte institucional não é "uma
// plataforma genérica onde escolhes 46 ferramentas". Cada tipo de instituição
// recebe O SEU produto, pensado e montado de raiz — o cockpit certo, as
// ferramentas certas (poucas e claras), o vocabulário e o tom certos. O
// utilizador NÃO monta nada; diz só que tipo é, e o produto vem inteiro. Pode
// depois ajustar (reordenar/esconder blocos) e o cockpit adapta-se ao uso real.
//
// O cockpit e a navegação LÊEM daqui e montam-se sozinhos. Adicionar/mudar um
// tipo é editar dados, não espalhar código. Isto é o que torna "talhado e
// premium" sustentável em vez de 6 cockpits copiados à mão.
// ─────────────────────────────────────────────────────────────────────────────

import type { InstitutionType } from './useClinicPrefs'

// Cada bloco do cockpit é uma peça com dados reais. O id liga a um renderer.
export type BlockId =
  | 'day_overview'      // "o dia de hoje" — resumo vivo (centro de dia / lar)
  | 'attendance'        // presenças do dia (quem veio / falta)
  | 'med_round'         // medicação a dar (a do dia, por pessoa)
  | 'people_watch'      // pessoas a vigiar (motor de risco)
  | 'activities'        // atividades do dia + participação
  | 'family_feed'       // mensagens/atualizações às famílias
  | 'incidents'         // ocorrências em aberto
  | 'tasks'             // tarefas pendentes da equipa
  | 'counter'           // balcão / fila (farmácia)
  | 'validation_queue'  // fila de validação de prescrições
  | 'sales_today'       // vendas/caixa do dia (farmácia)
  | 'appointments'      // agenda de marcações (clínica/CSP)
  | 'quick_actions'     // ações rápidas (adapta-se ao tipo)

export type BlockSize = 'hero' | 'large' | 'medium' | 'small'

export interface CockpitBlock {
  id: BlockId
  size: BlockSize
  // se true, o utilizador NÃO pode esconder este bloco (é a essência do produto)
  essential?: boolean
}

export type Tone = 'warm' | 'sober'   // acolhedor (pessoas) vs sóbrio (clínico/denso)

export interface ToolEntry {
  href: string
  label: string        // nome CLARO, diz o que faz
  hint: string         // uma linha de explicação
  icon: string
}

/** Uma pasta de ferramentas no painel. */
export interface ToolFolder {
  id: string
  label: string        // "Cuidado diário", "Gestão"…
  hint: string         // o que se vai lá fazer, numa linha
  tools: ToolEntry[]
}

export interface InstitutionBlueprint {
  // Identidade
  productName: string          // como o produto se chama PARA ESTE tipo
  tagline: string              // o que faz, numa linha
  tone: Tone
  accent: string               // cor de acento do produto
  accentSoft: string           // fundo suave do acento
  // Saudação do cockpit (a "cara" do dia)
  greetingLead: (firstName: string) => string
  // Cockpit: blocos por ordem (renderiza-se a partir disto)
  cockpit: CockpitBlock[]
  // Ferramentas: núcleo curado (sempre visível) + extras opcionais
  coreTools: ToolEntry[]
  extraTools: ToolEntry[]
  /**
   * As extraTools arrumadas por assunto, para aparecerem como pastas no
   * painel em vez de uma lista corrida no menu.
   *
   * PORQUÊ: o menu lateral tinha 24 entradas. Vinte e quatro escolhas de cada
   * vez que alguém olha para o lado não é riqueza, é paragem — e ao fim de uma
   * semana a equipa usa cinco e ignora o resto, sem saber o que ignorou.
   *
   * As oito do núcleo ficam no menu, porque são o que se usa todos os dias. As
   * restantes passam a viver em pastas no corpo do painel: continuam todas
   * acessíveis, mas deixam de competir pela atenção de quem só quer marcar uma
   * toma. Ver docs/designs/.
   */
  toolFolders?: ToolFolder[]
}

// Helpers de ferramentas (nomes CLAROS, reutilizáveis) ────────────────────────
const T = {
  people: (label: string, hint: string): ToolEntry => ({ href: '/patients', label, hint, icon: '🧑‍🤝‍🧑' }),
  meds:    { href: '/mar', label: 'Medicação a dar', hint: 'Marca o que foi tomado, por pessoa e horário', icon: '💊' },
  activities: { href: '/activities', label: 'Atividades', hint: 'Plano do dia e quem participou', icon: '🎯' },
  family:  { href: '/family', label: 'Famílias', hint: 'Mostra às famílias como correu o dia', icon: '👨‍👩‍👧' },
  incidents: { href: '/incidents', label: 'Ocorrências', hint: 'Regista quedas, recusas e outros eventos', icon: '⚠️' },
  careLog: { href: '/care-log', label: 'Registo do dia', hint: 'Refeições, humor, hidratação, atividades — por pessoa', icon: '📝' },
  assessments: { href: '/assessments', label: 'Avaliações', hint: 'Escalas (Barthel, MNA…) e seguimento', icon: '📐' },
  team:    { href: '/equipa?tab=escalas', label: 'Escalas', hint: 'Quem está e turnos', icon: '🗓️' },
  staff:   { href: '/painel-dono', label: 'Gestão & qualidade', hint: 'Só dono/admin: negócio, qualidade e registos para inspeção', icon: '🏛️' },
  radar:   { href: '/radar', label: 'O que merece atenção', hint: 'O que a equipa registou que saiu do padrão + pedidos dos utentes', icon: '📋' },
  documents: { href: '/documentos', label: 'Documentos', hint: 'Cofre de documentos da instituição', icon: '📄' },
  quality: { href: '/painel-dono?tab=qualidade', label: 'Qualidade', hint: 'Indicadores e conformidade do serviço', icon: '📊' },
  meds_check: { href: '/interactions', label: 'Interações', hint: 'Verifica se a medicação se dá bem', icon: '🔍' },
  calc:    { href: '/calculos', label: 'Calculadoras', hint: 'Doses, escalas e fórmulas clínicas', icon: '🧮' },
  reconcile: { href: '/reconciliacao', label: 'Conferir medicação', hint: 'Compara a medicação de casa com a do centro', icon: '🔄' },
  stock:   { href: '/stock', label: 'Stock e validades', hint: 'Existências, lotes e prazos', icon: '📦' },
  appts:   { href: '/agenda', label: 'Agenda', hint: 'Marcações e consultas', icon: '📅' },
  screenings: { href: '/rastreios', label: 'Rastreios', hint: 'Plano de rastreios e vacinas', icon: '🧪' },
  wounds:  { href: '/feridas', label: 'Feridas', hint: 'Acompanhamento de feridas e pensos', icon: '🩹' },
  billing: { href: '/faturacao', label: 'Faturação', hint: 'Mensalidades, comparticipações e recibos', icon: '💶' },
  vigia:   { href: '/vigia', label: 'Vigia clínico', hint: 'Varre todos os utentes e prioriza por risco farmacológico', icon: '🛡️' },
  mural:   { href: '/equipa?tab=mural', label: 'Mural da equipa', hint: 'Recados, avisos e comunicados entre a equipa', icon: '📣' },
  ronda:   { href: '/ronda-guiada', label: 'Ronda coordenada', hint: 'Ronda a vários, sem repetir utentes, tudo registado', icon: '🚶' },
  trends:  { href: '/tendencias', label: 'Tendências', hint: 'Humor, alimentação e adesão ao longo de 2-3 semanas, por pessoa', icon: '📈' },
  refeicoes: { href: '/refeicoes', label: 'Refeições', hint: 'O que cada pessoa comeu, por refeição — toque rápido', icon: '🍽️' },
  apoio:    { href: '/apoio-servicos', label: 'Serviços de apoio', hint: 'Roupa, transporte e outros pedidos', icon: '🧺' },
  // Novos 2026-08-11 — auditoria contra a lista de serviços de um centro de dia real.
  prep:     { href: '/preparacao-medicacao', label: 'Preparação da medicação', hint: 'Grelha semanal de quem preparou o pastilheiro, por pessoa', icon: '🗂️' },
  psicossocial: { href: '/apoio-psicossocial', label: 'Apoio psico-social', hint: 'Notas de acompanhamento e encaminhamento a especialistas', icon: '🫂' },
  guardiao: { href: '/guardiao', label: 'Modo Guardião', hint: 'Turnos com pouca gente: só quem precisa de atenção, por ordem de urgência', icon: '🌙' },
  carga:    { href: '/carga', label: 'Pessoal e carga', hint: 'Onde a escala pode apertar: turnos sem gente ou abaixo do habitual desta casa', icon: '⚖️' },
  autonomia: { href: '/autonomia', label: 'Autonomia', hint: 'Três perguntas rápidas, de vez em quando — nota quem está a precisar de mais ajuda', icon: '🚶' },
}

// ─────────────────────────────────────────────────────────────────────────────
// BLUEPRINTS POR TIPO
// ─────────────────────────────────────────────────────────────────────────────
export const BLUEPRINTS: Record<InstitutionType, InstitutionBlueprint> = {
  // ── CENTRO DE DIA — o primeiro cliente real. Tom acolhedor (é sobre pessoas).
  day_care: {
    productName: 'O seu Centro de Dia',
    tagline: 'O dia dos utentes, as famílias tranquilas, tudo num sítio.',
    tone: 'warm',
    accent: '#0d9488', accentSoft: '#f0fdfa',
    greetingLead: (n) => `Vamos a mais um dia${n ? `, ${n}` : ''}.`,
    cockpit: [
      { id: 'day_overview', size: 'hero', essential: true },
      { id: 'attendance',   size: 'large', essential: true },
      { id: 'med_round',    size: 'large', essential: true },
      { id: 'activities',   size: 'medium' },
      { id: 'family_feed',  size: 'medium', essential: true },
      { id: 'people_watch', size: 'medium' },
      { id: 'incidents',    size: 'small' },
      { id: 'quick_actions', size: 'small', essential: true },
    ],
    coreTools: [
      T.people('Utentes', 'As pessoas que frequentam o centro'),
      T.meds, T.careLog, T.refeicoes, T.ronda, T.family, T.radar, T.mural,
    ],
    // "Gestão & qualidade" (T.staff) já leva a /painel-dono, cuja aba "Qualidade"
    // era antes um item de menu à parte (T.quality) para o mesmo destino — fundidos
    // num só, para não duplicar entradas que vão ter ao mesmo sítio.
    extraTools: [ T.carga, T.autonomia, T.incidents, T.activities, T.assessments, T.trends, T.wounds, T.stock, T.staff, T.team, T.apoio, T.prep, T.psicossocial, T.documents, T.meds_check, T.calc ],
    // As mesmas ferramentas, arrumadas por assunto. Um centro de dia serve
    // pessoas que dormem em casa: o peso está no dia — refeições, atividades,
    // companhia — e não na enfermagem. A ordem das pastas segue isso.
    toolFolders: [
      { id: 'dia', label: 'O dia', hint: 'O que acontece entre a chegada e a saída',
        tools: [T.activities, T.prep, T.apoio, T.incidents] },
      { id: 'pessoas', label: 'Pessoas e famílias', hint: 'Acompanhamento de quem cá anda e de quem os espera em casa',
        tools: [T.psicossocial, T.autonomia, T.trends, T.assessments] },
      { id: 'clinico', label: 'Apoio clínico', hint: 'Para quando é preciso ir ao detalhe da medicação',
        tools: [T.meds_check, T.wounds, T.calc] },
      { id: 'equipa', label: 'Equipa', hint: 'Quem está, quando, e com que carga',
        tools: [T.team, T.carga] },
      { id: 'casa', label: 'A casa', hint: 'Gestão, stock e o que a inspeção pede',
        tools: [T.staff, T.stock, T.documents] },
    ],
  },

  // ── LAR / ERPI — cuidado 24h. Tom acolhedor mas com mais peso clínico.
  nursing_home: {
    productName: 'O seu Lar',
    tagline: 'Cuidar dos residentes e dar paz às famílias, com tudo registado.',
    tone: 'warm',
    accent: '#b45309', accentSoft: '#fffbeb',
    greetingLead: (n) => `Bom trabalho${n ? `, ${n}` : ''}.`,
    cockpit: [
      { id: 'day_overview', size: 'hero', essential: true },
      { id: 'people_watch', size: 'large', essential: true },
      { id: 'med_round',    size: 'large', essential: true },
      { id: 'family_feed',  size: 'medium' },
      { id: 'incidents',    size: 'medium', essential: true },
      { id: 'tasks',        size: 'small' },
      { id: 'quick_actions', size: 'small', essential: true },
    ],
    coreTools: [
      T.people('Residentes', 'As pessoas que vivem no lar'),
      T.meds, T.careLog, T.refeicoes, T.ronda, T.radar, T.assessments, T.wounds, T.family, T.mural,
    ],
    // Guardião só no lar: um centro de dia não tem turno da noite nem serviço
    // ao fim de semana, por isso a ferramenta não se aplica lá.
    extraTools: [ T.guardiao, T.carga, T.autonomia, T.incidents, T.activities, T.trends, T.vigia, T.stock, T.staff, T.team, T.apoio, T.prep, T.psicossocial, T.documents, T.meds_check, T.calc ],
    // Num lar o peso desloca-se: há enfermagem, há noite, e há um corpo
    // clínico que num centro de dia não existe. A pasta clínica vem à frente.
    toolFolders: [
      { id: 'clinico', label: 'Clínico', hint: 'Medicação, risco e o que precisa de olho de profissional',
        tools: [T.vigia, T.meds_check, T.trends, T.autonomia, T.calc] },
      { id: 'dia', label: 'O dia e a noite', hint: 'Da manhã ao turno da noite',
        tools: [T.guardiao, T.activities, T.prep, T.incidents, T.apoio] },
      { id: 'pessoas', label: 'Pessoas e famílias', hint: 'Acompanhamento de quem cá vive',
        tools: [T.psicossocial] },
      { id: 'equipa', label: 'Equipa', hint: 'Quem está, quando, e com que carga',
        tools: [T.team, T.carga] },
      { id: 'casa', label: 'A casa', hint: 'Gestão, stock e o que a inspeção pede',
        tools: [T.staff, T.stock, T.documents] },
    ],
  },

  // ── FARMÁCIA / CLÍNICA / CENTRO DE SAÚDE ────────────────────────────────
  // Estes três tipos JÁ NÃO SE PODEM ESCOLHER: o onboarding só oferece Centro
  // de Dia e Lar (decisão de posicionamento). As ferramentas exclusivas deles
  // — balcão, vendas, aconselhamento, fila de receitas, sala de espera, ronda
  // farmacêutica — foram apagadas a 2026-09-02 por não terem forma de serem
  // alcançadas. Os tipos ficam na união porque pode haver contas antigas na
  // base de dados com estes valores, e `blueprintFor` tem de devolver algo que
  // não aponte para páginas que já não existem.

  // ── FARMÁCIA COMUNITÁRIA — balcão. Tom sóbrio, ritmo rápido.
  pharmacy_community: {
    productName: 'A sua Farmácia',
    tagline: 'O balcão, o stock e o aconselhamento, sem perder ninguém.',
    tone: 'sober',
    accent: '#0e7490', accentSoft: '#ecfeff',
    greetingLead: (n) => `Bom dia${n ? `, ${n}` : ''}.`,
    cockpit: [
      { id: 'counter',     size: 'hero', essential: true },
      { id: 'sales_today', size: 'large', essential: true },
      { id: 'people_watch', size: 'medium' },
      { id: 'tasks',       size: 'small' },
      { id: 'quick_actions', size: 'small', essential: true },
    ],
    coreTools: [
      T.people('Utentes', 'Clientes com ficha e medicação'),
      T.stock, T.meds_check, T.screenings, T.appts,
    ],
    extraTools: [ T.team, T.quality, T.calc, T.reconcile, T.billing ],
  },

  // ── CLÍNICA — consultas. Tom sóbrio.
  clinic: {
    productName: 'A sua Clínica',
    tagline: 'Doentes, agenda e segurança da medicação, num fluxo limpo.',
    tone: 'sober',
    accent: '#1d4ed8', accentSoft: '#eff6ff',
    greetingLead: (n) => `Bom dia${n ? `, ${n}` : ''}.`,
    cockpit: [
      { id: 'appointments', size: 'hero', essential: true },
      { id: 'people_watch', size: 'large', essential: true },
      { id: 'tasks',        size: 'medium' },
      { id: 'incidents',    size: 'small' },
      { id: 'quick_actions', size: 'small', essential: true },
    ],
    coreTools: [
      T.people('Doentes', 'Fichas e medicação dos doentes'),
      T.appts, T.meds_check, T.reconcile, T.assessments,
    ],
    extraTools: [ T.team, T.quality, T.calc, T.screenings, T.incidents ],
  },

  // ── CENTRO DE SAÚDE / USF — utentes, CSP. Tom sóbrio.
  health_center: {
    productName: 'a sua Unidade',
    tagline: 'Utentes, rastreios e agenda, com a clínica sempre à mão.',
    tone: 'sober',
    accent: '#15803d', accentSoft: '#f0fdf4',
    greetingLead: (n) => `Bom dia${n ? `, ${n}` : ''}.`,
    cockpit: [
      { id: 'appointments', size: 'hero', essential: true },
      { id: 'people_watch', size: 'large', essential: true },
      { id: 'tasks',        size: 'medium' },
      { id: 'quick_actions', size: 'small', essential: true },
    ],
    coreTools: [
      T.people('Utentes', 'Fichas e medicação dos utentes'),
      T.appts, T.screenings, T.meds_check, T.reconcile,
    ],
    extraTools: [ T.team, T.quality, T.calc, T.documents ],
  },

}

export function blueprintFor(institution: InstitutionType): InstitutionBlueprint {
  return BLUEPRINTS[institution] || BLUEPRINTS.day_care
}
