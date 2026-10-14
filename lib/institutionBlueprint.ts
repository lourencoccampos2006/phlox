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
/**
 * O verde do Phlox, em hexadecimal.
 *
 * A fonte normal da cor e o token `--green` do globals.css. Isto existe para
 * os sitios onde um token NAO SERVE, e sao dois, ambos reais:
 *  - um `<input type="color">`, que so aceita um hexadecimal literal;
 *  - o HTML de um email ou de uma folha de impressao, que correm fora da
 *    folha de estilos do site e por isso nao conhecem variavel nenhuma.
 *
 * Escrito uma vez aqui, para a cor nao ter duas versoes no dia em que mudar.
 */
export const VERDE_DA_CASA = 'var(--green-3)'

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
  people: (label: string, hint: string): ToolEntry => ({ href: '/patients', label, hint, icon: 'users' }),
  // O Dia junta num ecrã o que estava em cinco: a medicação, as atividades, os
  // pedidos de apoio, os reforços alimentares e as ações do plano de cada
  // pessoa. As cinco continuam a existir — esta não as substitui, dá-lhes uma
  // porta comum. Fica à frente de todas porque é por onde um turno começa.
  oDia:    { href: '/o-dia', label: 'O dia', hint: 'O que há para fazer agora — por pessoa ou por tarefa', icon: 'clock' },
  // A peca que faz a informacao atravessar a porta quando a equipa muda. Fica
  // ao lado d'O Dia porque e o outro extremo do mesmo turno: um diz o que ha
  // para fazer, o outro diz o que ficou por dizer.
  // O trabalho que a casa faz sobre SI PROPRIA — limpar, lavar, medir as arcas.
  // Tudo o resto no Phlox pendura-se numa pessoa; isto nao se pendura em
  // ninguem, e e metade do dia de trabalho de um lar. (Da pesquisa ao Ankira:
  // era o unico dos doze modulos deles sem nada do nosso lado.)
  casa: { href: '/casa', label: 'Serviços gerais', hint: 'Limpeza, lavandaria e as temperaturas que a ASAE pede', icon: 'package' },
  passagem: { href: '/passagem', label: 'Passagem de turno', hint: 'O que o turno que sai deixa ao que entra — monta-se sozinha', icon: 'refresh' },
  meds:    { href: '/mar', label: 'Medicação a dar', hint: 'Marca o que foi tomado, por pessoa e horário', icon: 'pill' },
  activities: { href: '/activities', label: 'Atividades', hint: 'Plano do dia e quem participou', icon: 'target' },
  family:  { href: '/family', label: 'Famílias', hint: 'Mostra às famílias como correu o dia', icon: 'family' },
  incidents: { href: '/incidents', label: 'Ocorrências', hint: 'Regista quedas, recusas e outros eventos', icon: 'alert' },
  careLog: { href: '/care-log', label: 'Registo do dia', hint: 'Refeições, humor, hidratação, atividades — por pessoa', icon: 'note' },
  assessments: { href: '/assessments', label: 'Avaliações', hint: 'Escalas (Barthel, MNA…) e seguimento', icon: 'calculator' },
  team:    { href: '/equipa?tab=escalas', label: 'Escalas', hint: 'Quem está e turnos', icon: 'calendar' },
  staff:   { href: '/painel-dono', label: 'Painel administrativo', hint: 'A casa inteira: quem cá está, o cuidado, a equipa, o dinheiro e o que a inspeção pede', icon: 'building' },
  radar:   { href: '/radar', label: 'O que merece atenção', hint: 'O que a equipa registou que saiu do padrão + pedidos dos utentes', icon: 'clipboard' },
  historico: { href: '/historico', label: 'Registos', hint: 'Quem fez o quê, sobre quem e quando — enche-se sozinho', icon: 'book' },
  documents: { href: '/documentos', label: 'Documentos', hint: 'Cofre de documentos da instituição', icon: 'note' },
  quality: { href: '/painel-dono?tab=qualidade', label: 'Qualidade', hint: 'Indicadores e conformidade do serviço', icon: 'chart' },
  // A Segurança Social pede que a satisfação dos utentes e das famílias seja
  // medida uma vez por ano, analisada, e que daí saiam ações de melhoria. As
  // respostas são anónimas por construção — ver o cabeçalho do sprint178.
  inqueritos: { href: '/inqueritos', label: 'Inquéritos de satisfação', hint: 'A utentes, famílias e equipa — em papel ou no ecrã, sempre anónimos', icon: 'inbox' },
  meds_check: { href: '/interactions', label: 'Interações', hint: 'Verifica se a medicação se dá bem', icon: 'search' },
  calc:    { href: '/calculos', label: 'Calculadoras', hint: 'Doses, escalas e fórmulas clínicas', icon: 'calculator' },
  reconcile: { href: '/reconciliacao', label: 'Conferir medicação', hint: 'Compara a medicação de casa com a do centro', icon: 'refresh' },
  stock:   { href: '/stock', label: 'Stock e validades', hint: 'Existências, lotes e prazos', icon: 'package' },
  // Ficaram de fora do blueprint até 2026-09-16 — existiam, eram mantidas, e
  // não apareciam em lado nenhum do lado institucional. Ver scripts/check-escondidas.mjs.
  ruturas: { href: '/vigia-ruturas', label: 'Ruturas de medicamentos', hint: 'Cruza a medicação da casa com a lista do INFARMED', icon: 'alert' },
  migrar:  { href: '/migrar', label: 'Trazer dados de outro sistema', hint: 'Importa utentes e medicação de uma folha de cálculo', icon: 'inbox' },
  // Inscrição não é admissão: entre uma e outra passam meses. Isto é onde
  // ficam as pessoas nesse intervalo, e por que ordem entram (sprint165).
  inscricoes: { href: '/inscricoes', label: 'Inscrições e lista de espera', hint: 'Quem está à espera de vaga, por ordem dos critérios do regulamento', icon: 'clipboard' },
  // O ano inteiro num ecrã. Enche-se do que já está registado — aniversários,
  // atividades, visitas, consultas, prazos, validades — mais os feriados
  // portugueses, que se movem com a Páscoa (sprint166).
  anoTodo: { href: '/calendario-do-ano', label: 'Calendário do ano', hint: 'Doze meses de uma vez: aniversários, atividades, visitas, prazos e feriados', icon: 'calendar' },
  // Doze meses em números, com a IA a dizer o que merece atenção. O painel
  // administrativo responde «como está hoje»; isto responde «o que mudou».
  estatisticas: { href: '/estatisticas', label: 'Estatísticas', hint: 'Doze meses da casa em números — para a reunião, o relatório e a inspeção', icon: 'chart' },
  appts:   { href: '/agenda', label: 'Agenda', hint: 'Marcações e consultas', icon: 'calendar' },
  screenings: { href: '/rastreios', label: 'Rastreios', hint: 'Plano de rastreios e vacinas', icon: 'flask' },
  wounds:  { href: '/feridas', label: 'Feridas', hint: 'Acompanhamento de feridas e pensos', icon: 'bandage' },
  billing: { href: '/faturacao', label: 'Faturação', hint: 'Mensalidades, comparticipações e recibos', icon: 'euro' },
  vigia:   { href: '/vigia', label: 'Vigia clínico', hint: 'Varre todos os utentes e prioriza por risco farmacológico', icon: 'shield' },
  mural:   { href: '/equipa?tab=mural', label: 'Mural da equipa', hint: 'Recados, avisos e comunicados entre a equipa', icon: 'megaphone' },
  ronda:   { href: '/ronda-guiada', label: 'Ronda coordenada', hint: 'Ronda a vários, sem repetir utentes, tudo registado', icon: 'route' },
  trends:  { href: '/tendencias', label: 'Tendências', hint: 'Humor, alimentação e adesão ao longo de 2-3 semanas, por pessoa', icon: 'chart' },
  refeicoes: { href: '/refeicoes', label: 'Refeições', hint: 'O que cada pessoa comeu, por refeição — toque rápido', icon: 'meal' },
  apoio:    { href: '/apoio-servicos', label: 'Serviços de apoio', hint: 'Roupa, transporte e outros pedidos', icon: 'shirt' },
  /* O SAD não é um terceiro tipo de instituição — é um serviço que um lar
     ou um centro de dia TAMBÉM presta, e na prática a mesma IPSS tem as
     três valências com a mesma equipa. Por isso entra nas duas listas e
     não cria um `institution` novo. Ver supabase/sprint183. */
  domicilio:{ href: '/apoio-domiciliario', label: 'Apoio domiciliário', hint: 'A volta do dia, casa a casa', icon: 'home' },
  // Novos 2026-08-11 — auditoria contra a lista de serviços de um centro de dia real.
  prep:     { href: '/preparacao-medicacao', label: 'Preparação da medicação', hint: 'Grelha semanal de quem preparou o pastilheiro, por pessoa', icon: 'layers' },
  psicossocial: { href: '/apoio-psicossocial', label: 'Apoio psico-social', hint: 'Notas de acompanhamento e encaminhamento a especialistas', icon: 'users' },
  guardiao: { href: '/guardiao', label: 'Modo Guardião', hint: 'Turnos com pouca gente: só quem precisa de atenção, por ordem de urgência', icon: 'clock' },
  carga:    { href: '/carga', label: 'Pessoal e carga', hint: 'Onde a escala pode apertar: turnos sem gente ou abaixo do habitual desta casa', icon: 'scale' },
  autonomia: { href: '/autonomia', label: 'Autonomia', hint: 'Três perguntas rápidas, de vez em quando — nota quem está a precisar de mais ajuda', icon: 'route' },
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
    // ── O ACENTO DAS RESPOSTAS SOCIAIS E O VERDE DA CASA (2026-10-07) ──────
    // Era turquesa aqui e cor de telha no lar. Nao e uma questao de gosto: o
    // `var(--amber)` do lar e EXATAMENTE o ambar que o sistema usa para dizer «a
    // precisar de atencao». Num lar, a cor da marca e a cor do aviso eram a
    // mesma — e com isso o codigo de tres estados deixava de querer dizer
    // alguma coisa.
    //
    // O verde `var(--green-3)` e a cor do Phlox, nao colide com nenhum estado, e e a
    // que o desenho aprovado usa. A farmacia, a clinica e o centro de saude
    // ficam com as deles: sao produtos diferentes.
    accent: 'var(--green-3)', accentSoft: 'var(--bg-3)',
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
      T.oDia,
      T.people('Utentes', 'As pessoas que frequentam o centro'),
      T.meds, T.careLog, T.incidents, T.family, T.radar, T.mural,
    ],
    // "Gestão & qualidade" (T.staff) já leva a /painel-dono, cuja aba "Qualidade"
    // era antes um item de menu à parte (T.quality) para o mesmo destino — fundidos
    // num só, para não duplicar entradas que vão ter ao mesmo sítio.
    extraTools: [ T.carga, T.autonomia, T.refeicoes, T.ronda, T.passagem, T.activities, T.assessments, T.trends, T.wounds, T.stock, T.casa, T.inqueritos, T.ruturas, T.staff, T.team, T.apoio, T.domicilio, T.prep, T.psicossocial, T.documents, T.historico, T.inscricoes, T.anoTodo, T.estatisticas, T.meds_check, T.calc, T.migrar ],
    // As mesmas ferramentas, arrumadas por assunto. Um centro de dia serve
    // pessoas que dormem em casa: o peso está no dia — refeições, atividades,
    // companhia — e não na enfermagem. A ordem das pastas segue isso.
    toolFolders: [
      { id: 'dia', label: 'O dia', hint: 'O que acontece entre a chegada e a saída',
        tools: [T.refeicoes, T.ronda, T.passagem, T.activities, T.anoTodo, T.prep, T.apoio, T.domicilio] },
      { id: 'pessoas', label: 'Pessoas e famílias', hint: 'Acompanhamento de quem cá anda e de quem os espera em casa',
        tools: [T.psicossocial, T.autonomia, T.trends, T.assessments] },
      { id: 'clinico', label: 'Apoio clínico', hint: 'Para quando é preciso ir ao detalhe da medicação',
        tools: [T.meds_check, T.wounds, T.calc] },
      { id: 'equipa', label: 'Equipa', hint: 'Quem está, quando, e com que carga',
        tools: [T.team, T.carga] },
      { id: 'casa', label: 'A casa', hint: 'Gestão, stock e o que a inspeção pede',
        /* O T.billing não estava em lista nenhuma: a /faturacao existia, o
           contador de mensalidades em atraso existia, e não havia caminho
           nenhum para lá chegar a partir do painel. Foi o check-contadores
           que deu por isso — um número que aponta para uma ferramenta que
           ninguém vê nunca aparece. */
        tools: [T.staff, T.billing, T.estatisticas, T.inqueritos, T.inscricoes, T.stock, T.casa, T.ruturas, T.documents, T.historico, T.migrar] },
    ],
  },

  // ── LAR / ERPI — cuidado 24h. Tom acolhedor mas com mais peso clínico.
  nursing_home: {
    productName: 'O seu Lar',
    tagline: 'Cuidar dos residentes e dar paz às famílias, com tudo registado.',
    tone: 'warm',
    // Ver a nota no `day_care`: este `var(--amber)` era o mesmo valor do ambar de
    // «a precisar de atencao».
    accent: 'var(--green-3)', accentSoft: 'var(--bg-3)',
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
      T.oDia, T.passagem,
      T.people('Residentes', 'As pessoas que vivem no lar'),
      T.meds, T.careLog, T.incidents, T.radar, T.assessments, T.wounds, T.family, T.mural,
    ],
    // Guardião só no lar: um centro de dia não tem turno da noite nem serviço
    // ao fim de semana, por isso a ferramenta não se aplica lá.
    extraTools: [ T.guardiao, T.carga, T.autonomia, T.refeicoes, T.ronda, T.activities, T.trends, T.vigia, T.stock, T.casa, T.inqueritos, T.ruturas, T.staff, T.team, T.apoio, T.domicilio, T.prep, T.psicossocial, T.documents, T.historico, T.inscricoes, T.anoTodo, T.estatisticas, T.meds_check, T.calc, T.migrar ],
    // Num lar o peso desloca-se: há enfermagem, há noite, e há um corpo
    // clínico que num centro de dia não existe. A pasta clínica vem à frente.
    toolFolders: [
      { id: 'clinico', label: 'Clínico', hint: 'Medicação, risco e o que precisa de olho de profissional',
        tools: [T.vigia, T.meds_check, T.trends, T.autonomia, T.calc] },
      { id: 'dia', label: 'O dia e a noite', hint: 'Da manhã ao turno da noite',
        tools: [T.refeicoes, T.ronda, T.guardiao, T.activities, T.anoTodo, T.prep, T.apoio, T.domicilio] },
      { id: 'pessoas', label: 'Pessoas e famílias', hint: 'Acompanhamento de quem cá vive',
        tools: [T.psicossocial] },
      { id: 'equipa', label: 'Equipa', hint: 'Quem está, quando, e com que carga',
        tools: [T.team, T.carga] },
      { id: 'casa', label: 'A casa', hint: 'Gestão, stock e o que a inspeção pede',
        /* O T.billing: ver a nota no centro de dia, acima. */
        tools: [T.staff, T.billing, T.estatisticas, T.inqueritos, T.inscricoes, T.stock, T.casa, T.ruturas, T.documents, T.historico, T.migrar] },
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
  /* Havia aqui mais três planos: `pharmacy_community`, `clinic` e
     `health_center`. Saíram a 2026-10-12 — o produto serve lares e centros de
     dia, e cada um dos três trazia um plano de ecrã, um conjunto de
     ferramentas e um vocabulário que ninguém usava mas que era preciso manter
     a par do resto a cada mudança. */

}

export function blueprintFor(institution: InstitutionType): InstitutionBlueprint {
  return BLUEPRINTS[institution] || BLUEPRINTS.day_care
}
