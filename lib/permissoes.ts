// lib/permissoes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quem vê o quê, e quem pode mexer. A fonte única.
//
// ── PORQUE É QUE ISTO FOI REFEITO ───────────────────────────────────────────
// Havia duas coisas, nenhuma a servir:
//
//   • um `capability_catalog` (sprint50) com 35 chaves — `pos.use`,
//     `loyalty.write`, `suppliers.read` — desenhado para a altura em que o
//     Phlox servia farmácias e clínicas. Um só ficheiro da aplicação o
//     importava. Estava adormecido.
//   • `scope.canEdit`, um BINÁRIO (`role !== 'viewer'`), usado em 24 sítios.
//     Ou se vê tudo e se edita tudo, ou só se lê.
//
// Numa casa real isso não chega. Uma auxiliar regista cuidados e não vê as
// mensalidades. Uma administrativa trata do financeiro e não abre a medicação.
// Quem gere precisa de dar acesso a uma pessoa nova sem chamar o dono. Foi o
// que os diretores do centro de dia destacaram como decisivo.
//
// ── COMO ESTÁ ORGANIZADO ────────────────────────────────────────────────────
// Uma permissão é `area.nivel` — por exemplo `medicacao.editar`.
//
//   ÁREAS   correspondem ao que uma pessoa reconhece no menu, não a tabelas.
//           Dezasseis. Menos do que isso não separa o financeiro do clínico;
//           muito mais e ninguém as configura.
//
//   NÍVEIS  ver · editar · eliminar. Três, e não dois, porque apagar um
//           registo de cuidados não é editar: é fazer desaparecer a prova de
//           que alguém foi cuidado. Numa casa com inspeção, a diferença conta.
//
// ── A REGRA QUE NÃO SE QUEBRA ───────────────────────────────────────────────
// Isto é o que a INTERFACE mostra e esconde. Nunca é a única defesa.
// Cada rota e cada política de RLS verifica outra vez do lado do servidor —
// esconder um botão não impede ninguém de chamar a API. Ver `has_capability`
// no SQL (sprint50) e a verificação nas rotas.
// ─────────────────────────────────────────────────────────────────────────────

export type Nivel = 'ver' | 'editar' | 'eliminar'

export interface AreaPermissao {
  id: string
  /** Como se chama no menu, à pessoa que a configura. */
  label: string
  /** O que está lá dentro, em concreto. Sem isto, ninguém sabe o que marca. */
  descricao: string
  /** Que níveis fazem sentido nesta área. Nem todas têm os três. */
  niveis: Nivel[]
  /** Áreas de AÇÃO não se consultam, fazem-se: configurar a casa, dar acessos.
   *  Não têm `ver` porque "ver as definições sem as mudar" não é nada — e sem
   *  esta marca, um verificador razoável ("quem edita tem de poder ver")
   *  acusaria estas duas para sempre. */
  acao?: true
  /** Para agrupar no ecrã. */
  grupo: 'cuidado' | 'pessoas' | 'casa' | 'gestao'
}

/** As áreas, pela ordem em que aparecem a quem configura. */
export const AREAS: AreaPermissao[] = [
  // ── O cuidado ────────────────────────────────────────────────────────────
  { id: 'utentes', grupo: 'cuidado', label: 'Utentes',
    descricao: 'As fichas das pessoas: dados, contactos, história de vida.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'medicacao', grupo: 'cuidado', label: 'Medicação',
    descricao: 'A medicação de cada pessoa, as tomas do turno e a preparação do pastilheiro.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'registos', grupo: 'cuidado', label: 'Registos do dia',
    descricao: 'Presenças, refeições, cuidados prestados e rondas.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'ocorrencias', grupo: 'cuidado', label: 'Ocorrências',
    descricao: 'Quedas, recusas e outros eventos, com o seu seguimento.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'avaliacoes', grupo: 'cuidado', label: 'Avaliações',
    descricao: 'Escalas (Barthel, Braden, Morse…) e a autonomia ao longo do tempo.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'feridas', grupo: 'cuidado', label: 'Feridas',
    descricao: 'Acompanhamento de feridas e pensos, com fotografia.',
    niveis: ['ver', 'editar', 'eliminar'] },

  // ── As pessoas ───────────────────────────────────────────────────────────
  { id: 'atividades', grupo: 'pessoas', label: 'Atividades',
    descricao: 'O plano de atividades e quem participou.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'familias', grupo: 'pessoas', label: 'Famílias',
    descricao: 'O fio de conversa com as famílias e o que elas veem.',
    niveis: ['ver', 'editar'] },
  { id: 'equipa', grupo: 'pessoas', label: 'Equipa',
    descricao: 'Escalas, turnos, mural de recados e carga de trabalho.',
    // Com `eliminar` porque um turno atribuído por engano tem de poder sair
    // da escala — deixá-lo lá obriga a casa a trabalhar à volta do erro.
    niveis: ['ver', 'editar', 'eliminar'] },

  // ── A casa ───────────────────────────────────────────────────────────────
  { id: 'stock', grupo: 'casa', label: 'Stock e validades',
    descricao: 'Existências, lotes, prazos e ruturas.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'documentos', grupo: 'casa', label: 'Documentos',
    descricao: 'O cofre de documentos da instituição.',
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'qualidade', grupo: 'casa', label: 'Qualidade',
    descricao: 'Indicadores do serviço e o que merece atenção.',
    niveis: ['ver'] },

  // ── A gestão ─────────────────────────────────────────────────────────────
  { id: 'financeiro', grupo: 'gestao', label: 'Financeiro',
    descricao: 'Mensalidades, comparticipações, recibos e o negócio da casa.',
    // Com `eliminar` porque um lançamento errado tem de poder ser apagado.
    // Continua a ser um nível à parte: editar uma mensalidade e fazê-la
    // desaparecer não são a mesma decisão.
    niveis: ['ver', 'editar', 'eliminar'] },
  { id: 'registo_atividade', grupo: 'gestao', label: 'Registo de atividade',
    descricao: 'Quem fez o quê, sobre quem e quando. Enche-se sozinho e é privado da instituição.',
    niveis: ['ver'] },
  { id: 'definicoes', grupo: 'gestao', label: 'Definições da casa',
    descricao: 'Nome, tipo de resposta social e configuração da instituição.',
    niveis: ['editar'], acao: true },
  { id: 'permissoes', grupo: 'gestao', label: 'Dar e tirar acessos',
    descricao: 'Criar contas da equipa e decidir o que cada pessoa vê e faz.',
    niveis: ['editar'], acao: true },
]

export const GRUPOS: Record<AreaPermissao['grupo'], { label: string; nota: string }> = {
  cuidado: { label: 'O cuidado', nota: 'O que se faz e regista sobre cada pessoa' },
  pessoas: { label: 'Pessoas e equipa', nota: 'Atividades, famílias e quem trabalha na casa' },
  casa:    { label: 'A casa', nota: 'Material, documentos e qualidade do serviço' },
  gestao:  { label: 'Gestão', nota: 'Dinheiro, auditoria e quem manda' },
}

export const POR_AREA = new Map(AREAS.map(a => [a.id, a]))

/** Uma permissão, no formato que vai para a base de dados. */
export function chave(area: string, nivel: Nivel): string {
  return `${area}.${nivel}`
}

/** Todas as permissões possíveis. É o que o Dono tem, sempre. */
export const TODAS: string[] = AREAS.flatMap(a => a.niveis.map(n => chave(a.id, n)))

// ─────────────────────────────────────────────────────────────────────────────
// OS PAPÉIS
//
// Substituem os onze antigos (owner, admin, clinician, pharmacist, nurse,
// assistant, accountant, viewer, student, caregiver, self), que falavam de
// farmácias e estudantes a um diretor de centro de dia.
//
// Um papel é um MOLDE, não uma jaula: dá um ponto de partida sensato, e cada
// pessoa pode ser afinada por cima. É como o Ankira faz e é o que evita as
// duas falhas habituais — ou toda a gente fica administradora, ou ninguém
// consegue trabalhar.
// ─────────────────────────────────────────────────────────────────────────────

export type PapelId = 'dono' | 'direcao' | 'enfermagem' | 'auxiliar' | 'animacao' | 'administrativo' | 'convidado'

export interface Papel {
  id: PapelId
  label: string
  descricao: string
  /** As permissões de omissão. O Dono é um caso à parte: tem tudo, sempre. */
  omissao: string[]
  /** Pode ser dado a alguém? O Dono não se atribui — herda-se ao criar a casa. */
  atribuivel: boolean
}

function niveis(area: string, ate: Nivel): string[] {
  const a = POR_AREA.get(area)
  if (!a) return []
  const ordem: Nivel[] = ['ver', 'editar', 'eliminar']
  const teto = ordem.indexOf(ate)
  return a.niveis.filter(n => ordem.indexOf(n) <= teto).map(n => chave(area, n))
}

/** Só ver, em todas as áreas indicadas. */
function so(...areas: string[]): string[] {
  return areas.flatMap(a => niveis(a, 'ver'))
}

export const PAPEIS: Papel[] = [
  {
    id: 'dono', label: 'Dono', atribuivel: false,
    descricao: 'Quem criou a casa. Vê e faz tudo, e é o único que não pode ser limitado.',
    omissao: TODAS,
  },
  {
    id: 'direcao', label: 'Direção Técnica', atribuivel: true,
    descricao: 'Gere a casa no dia a dia. Por omissão pode dar acessos à equipa — o Dono pode tirar-lhe esse direito.',
    // Tudo, incluindo dar acessos. Numa casa onde o dono não aparece todos os
    // dias, a direção técnica tem de poder admitir uma auxiliar nova sem
    // esperar por ninguém. O Dono tira `permissoes.editar` se não quiser.
    omissao: TODAS,
  },
  {
    id: 'enfermagem', label: 'Enfermagem', atribuivel: true,
    descricao: 'Responsável clínica: medicação, feridas, avaliações. Não vê o financeiro.',
    omissao: [
      ...niveis('utentes', 'editar'),
      ...niveis('medicacao', 'eliminar'),
      ...niveis('registos', 'editar'),
      ...niveis('ocorrencias', 'editar'),
      ...niveis('avaliacoes', 'eliminar'),
      ...niveis('feridas', 'eliminar'),
      ...niveis('familias', 'editar'),
      ...niveis('stock', 'editar'),
      ...so('atividades', 'equipa', 'documentos', 'qualidade', 'registo_atividade'),
    ],
  },
  {
    id: 'auxiliar', label: 'Auxiliar', atribuivel: true,
    descricao: 'Quem está com as pessoas. Regista o que faz; não apaga nada nem vê contas.',
    omissao: [
      // Não apaga NADA, de propósito: um registo de cuidados apagado é a prova
      // de que alguém foi cuidado a desaparecer.
      ...so('utentes'),
      ...niveis('medicacao', 'editar'),
      ...niveis('registos', 'editar'),
      ...niveis('ocorrencias', 'editar'),
      ...niveis('atividades', 'editar'),
      ...so('avaliacoes', 'feridas', 'familias', 'equipa', 'stock'),
    ],
  },
  {
    id: 'animacao', label: 'Animação', atribuivel: true,
    descricao: 'Atividades e convívio. Não mexe em medicação nem em registos clínicos.',
    omissao: [
      ...so('utentes'),
      ...niveis('atividades', 'eliminar'),
      ...niveis('familias', 'editar'),
      ...so('registos', 'equipa'),
    ],
  },
  {
    id: 'administrativo', label: 'Administrativo', atribuivel: true,
    descricao: 'Mensalidades, documentos e stock. Não abre a parte clínica.',
    omissao: [
      ...niveis('utentes', 'editar'),
      ...niveis('financeiro', 'editar'),
      ...niveis('documentos', 'eliminar'),
      ...niveis('stock', 'editar'),
      ...so('equipa', 'qualidade'),
    ],
  },
  {
    id: 'convidado', label: 'Convidado', atribuivel: true,
    descricao: 'Vê, não mexe. Para quem passa pela casa: um médico externo, uma auditoria.',
    omissao: [
      // Sem financeiro e sem registo de atividade: um convidado não precisa de
      // saber quanto cada família paga nem quem registou o quê.
      ...so('utentes', 'medicacao', 'registos', 'ocorrencias', 'avaliacoes',
            'feridas', 'atividades', 'familias', 'equipa', 'stock',
            'documentos', 'qualidade'),
    ],
  },
]

export const POR_PAPEL = new Map(PAPEIS.map(p => [p.id, p]))

/** Os papéis que se podem atribuir a alguém, na ordem do ecrã. */
export const PAPEIS_ATRIBUIVEIS = PAPEIS.filter(p => p.atribuivel)

// ─────────────────────────────────────────────────────────────────────────────
// AS VERIFICAÇÕES
// ─────────────────────────────────────────────────────────────────────────────

/** As permissões efetivas: a sobreposição da pessoa, se existir, senão as do
 *  papel. O Dono tem tudo, sempre, mesmo que alguém lhe escreva outra coisa
 *  na coluna — é a única garantia de que ninguém fica fechado fora da sua
 *  própria casa. */
export function permissoesDe(papel: string | null | undefined, sobreposicao?: string[] | null): string[] {
  if (papel === 'dono') return TODAS
  if (Array.isArray(sobreposicao) && sobreposicao.length) return sobreposicao
  return POR_PAPEL.get(papel as PapelId)?.omissao || []
}

export function pode(permissoes: string[], area: string, nivel: Nivel): boolean {
  return permissoes.includes(chave(area, nivel))
}

/** Vê alguma coisa desta área? É isto que decide se o menu aparece. */
export function veArea(permissoes: string[], area: string): boolean {
  const a = POR_AREA.get(area)
  if (!a) return true   // área desconhecida não esconde nada: falhar aberto na
                        // NAVEGAÇÃO é melhor do que esconder uma ferramenta nova
                        // por esquecimento. Quem protege os dados é o servidor.
  return a.niveis.some(n => permissoes.includes(chave(area, n)))
}

// ─────────────────────────────────────────────────────────────────────────────
// A FRASE
//
// O Ankira mostra uma matriz de duzentas caixas. Tem a potência toda e não se
// lê. Aqui a matriz existe, mas atrás de um "Afinar": o que se vê primeiro é
// uma frase que um diretor técnico percebe em dois segundos.
// ─────────────────────────────────────────────────────────────────────────────

function juntar(partes: string[]): string {
  if (!partes.length) return ''
  if (partes.length === 1) return partes[0]
  return partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1]
}

/** O que esta pessoa faz, em português corrido. */
export function emPalavras(papel: string | null | undefined, sobreposicao?: string[] | null): string {
  if (papel === 'dono') return 'Vê e faz tudo. É a dona da casa.'
  const p = permissoesDe(papel, sobreposicao)
  if (!p.length) return 'Ainda não tem acesso a nada.'

  const edita = AREAS.filter(a => p.includes(chave(a.id, 'editar'))).map(a => a.label.toLowerCase())
  const soVe = AREAS.filter(a => p.includes(chave(a.id, 'ver')) && !p.includes(chave(a.id, 'editar')))
    .map(a => a.label.toLowerCase())
  const naoVe = AREAS.filter(a => a.niveis.includes('ver') && !p.includes(chave(a.id, 'ver')))
    .map(a => a.label.toLowerCase())
  const apaga = AREAS.filter(a => p.includes(chave(a.id, 'eliminar'))).length

  const frases: string[] = []
  if (edita.length) frases.push(`Trabalha em ${juntar(edita)}.`)
  if (soVe.length) frases.push(`Vê ${juntar(soVe)}, sem mexer.`)
  // O que NÃO vê é a parte que importa a quem está a configurar — é para isso
  // que se abre este ecrã.
  if (naoVe.length) frases.push(`Não vê ${juntar(naoVe)}.`)
  if (!apaga) frases.push('Não apaga registos.')
  if (p.includes('permissoes.editar')) frases.push('Pode dar acessos à equipa.')

  return frases.join(' ')
}

/** Uma etiqueta curta para a lista da equipa. */
export function resumoCurto(papel: string | null | undefined, sobreposicao?: string[] | null): string {
  const p = permissoesDe(papel, sobreposicao)
  const molde = POR_PAPEL.get(papel as PapelId)
  if (!molde) return 'Sem papel'
  const igualAoMolde = papel === 'dono'
    || (p.length === molde.omissao.length && p.every(x => molde.omissao.includes(x)))
  return igualAoMolde ? molde.label : `${molde.label} (afinado)`
}

// ─────────────────────────────────────────────────────────────────────────────
// A MIGRAÇÃO DOS PAPÉIS ANTIGOS
//
// Ninguém pode perder acesso por causa desta mudança. O mapa é generoso de
// propósito: em caso de dúvida, o papel novo é o que dá MAIS, não menos —
// tirar acesso a quem o tinha parte o trabalho de uma casa a meio da manhã.
// ─────────────────────────────────────────────────────────────────────────────

export const PAPEL_ANTIGO_PARA_NOVO: Record<string, PapelId> = {
  owner: 'dono',
  admin: 'direcao',
  clinician: 'enfermagem',
  nurse: 'enfermagem',
  pharmacist: 'enfermagem',   // a farmácia saiu do produto; quem lá estivesse
                              // mexia em medicação, e é o que fica.
  assistant: 'auxiliar',
  caregiver: 'auxiliar',
  accountant: 'administrativo',
  student: 'convidado',
  viewer: 'convidado',
  self: 'convidado',
}

/**
 * Traduz o que veio de fora para um papel que existe mesmo, ou `null`.
 *
 * ── PORQUE É QUE ISTO TEM DE EXISTIR ────────────────────────────────────────
 * Havia listas de papéis escritas à mão espalhadas pelas rotas, do género
 *
 *     ['admin','nurse','assistant','clinician','viewer'].includes(body.role)
 *       ? body.role : 'assistant'
 *
 * e isso tem um defeito que só aparece DEPOIS da migração: assim que a
 * interface passa a mandar `direcao`, a lista não o reconhece, e o `: 'assistant'`
 * silencioso transforma toda a gente em auxiliar. Sem erro nenhum. A pessoa a
 * quem se deu Direção Técnica entra e não pode fazer nada, e quem a convidou
 * jura que escolheu bem.
 *
 * Aceita os dois vocabulários de propósito, e vai continuar a aceitar: há
 * convites por abrir na base de dados com os nomes antigos, e um separador que
 * ficou aberto de ontem manda o que tinha. Traduzir é barato; recusar é que
 * custa caro a quem está a trabalhar.
 *
 * Devolve `null` quando não reconhece — quem chama decide o que fazer com
 * isso, em vez de receber um papel escolhido por omissão que ninguém pediu.
 */
export function normalizarPapel(valor: unknown): PapelId | null {
  if (typeof valor !== 'string') return null
  const v = valor.trim().toLowerCase()
  if (PAPEIS.some(p => p.id === v)) return v as PapelId
  return PAPEL_ANTIGO_PARA_NOVO[v] ?? null
}

/**
 * O papel para a grelha de turnos (`team_members.role`), que é outro
 * vocabulário: descreve a FUNÇÃO na escala, não o acesso aos dados.
 *
 * São listas diferentes porque são perguntas diferentes — «o que é que esta
 * pessoa faz na casa» e «o que é que esta pessoa pode abrir». Mantê-las
 * separadas é o que permite ter uma enfermeira sem acesso ao financeiro sem
 * que isso mude nada na escala.
 */
export const PAPEL_NA_ESCALA: Record<PapelId, string> = {
  dono: 'coordinator',
  direcao: 'coordinator',
  enfermagem: 'nurse',
  auxiliar: 'caregiver',
  animacao: 'other',
  administrativo: 'other',
  convidado: 'other',
}

/**
 * A cópia grosseira do papel que vive em `profiles.org_role`
 * (owner/admin/member). Existe por compatibilidade com código antigo; a
 * verdade está em `org_members.role`.
 */
export function orgRoleAntigo(papel: PapelId): 'owner' | 'admin' | 'member' {
  if (papel === 'dono') return 'owner'
  if (papel === 'direcao') return 'admin'
  return 'member'
}
