// lib/inscricao.ts
// ─────────────────────────────────────────────────────────────────────────────
// A ficha de inscrição, definida UMA vez.
//
// ── PORQUE É QUE ISTO É UMA LISTA DE DADOS E NÃO DOIS FORMULÁRIOS ──────────
// A mesma ficha é preenchida em dois momentos: quando alguém se inscreve na
// lista de espera, e quando alguém entra directamente. Escritos à mão, os dois
// formulários começam iguais e afastam-se: acrescenta-se a naturalidade a um e
// esquece-se o outro, e passado um ano metade das pessoas tem morada e a outra
// metade não, consoante a porta por onde entraram.
//
// Aqui há uma lista. Os dois formulários leem-na. Um campo novo aparece nos
// dois, ou em nenhum.
//
// ── O QUE ESTAVA MAL ANTES ─────────────────────────────────────────────────
// A tabela `patients` tem 50 colunas e o formulário usava 12. Perguntava a
// IDADE — um número escrito à mão, que a partir do dia seguinte está errado —
// e não a data de nascimento. Quem entrou com 78 ficava com 78 para sempre, e
// não havia como saber quando era o aniversário de ninguém.
//
// A idade passou a sair da data (gatilho no sprint165). Este ficheiro não a
// pergunta.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoCampo = 'texto' | 'data' | 'tel' | 'numero' | 'escolha' | 'longo'

export type Campo = {
  id: string
  rotulo: string
  tipo: TipoCampo
  /** Datas que não podem estar no futuro (nascimento, sim; entrada, não). */
  naoFuturo?: boolean
  opcoes?: { valor: string; rotulo: string }[]
  /** Aparece por baixo do campo. Só onde a pergunta não se explica sozinha. */
  dica?: string
  obrigatorio?: boolean
  /** Quantas colunas ocupa numa grelha de 6. */
  largura?: 2 | 3 | 6
  /** A coluna em `patients`. Ausente = este campo não existe na ficha do utente. */
  utente?: string
  /** A coluna em `candidaturas`. Ausente = não se pergunta na inscrição. */
  candidatura?: string
}

export type Seccao = {
  id: string
  titulo: string
  /** Porque é que esta secção existe. Aparece em cinzento por baixo do título. */
  porque?: string
  campos: Campo[]
  /** Fechada por omissão: o essencial fica à vista, o resto pede um clique. */
  recolhida?: boolean
}

// ── As listas fechadas ───────────────────────────────────────────────────────
// `sex` já tem 'M' e 'F' gravados na base de dados. Mudar para 'masculino'
// deixava de fora quem já lá está — e ninguém daria por isso, porque um sexo
// que não corresponde a nenhuma opção aparece em branco, não aparece errado.

export const SEXOS = [
  { valor: 'F', rotulo: 'Feminino' },
  { valor: 'M', rotulo: 'Masculino' },
]

export const ESTADOS_CIVIS = [
  { valor: 'solteiro',  rotulo: 'Solteiro(a)' },
  { valor: 'casado',    rotulo: 'Casado(a)' },
  { valor: 'uniao',     rotulo: 'União de facto' },
  { valor: 'separado',  rotulo: 'Separado(a) ou divorciado(a)' },
  { valor: 'viuvo',     rotulo: 'Viúvo(a)' },
]

export const ESCOLARIDADES = [
  { valor: 'nenhuma',    rotulo: 'Não sabe ler nem escrever' },
  { valor: 'le_escreve', rotulo: 'Sabe ler e escrever, sem estudos' },
  { valor: 'basico1',    rotulo: '1.º ciclo (4.ª classe)' },
  { valor: 'basico2',    rotulo: '2.º ciclo (6.º ano)' },
  { valor: 'basico3',    rotulo: '3.º ciclo (9.º ano)' },
  { valor: 'secundario', rotulo: 'Secundário (12.º ano)' },
  { valor: 'superior',   rotulo: 'Ensino superior' },
]

export const MOBILIDADES = [
  { valor: 'autonomo',  rotulo: 'Anda sozinho(a)' },
  { valor: 'bengala',   rotulo: 'Anda com bengala ou canadiana' },
  { valor: 'andarilho', rotulo: 'Anda com andarilho' },
  { valor: 'apoio',     rotulo: 'Precisa de uma pessoa para andar' },
  { valor: 'cadeira',   rotulo: 'Cadeira de rodas' },
  { valor: 'acamado',   rotulo: 'Acamado(a)' },
]

export const ESTADOS_COGNITIVOS = [
  { valor: 'orientado',  rotulo: 'Orientado(a)' },
  { valor: 'ligeira',    rotulo: 'Esquecimentos, desorientação ligeira' },
  { valor: 'moderada',   rotulo: 'Desorientação moderada' },
  { valor: 'avancada',   rotulo: 'Demência avançada' },
]

export const DIETAS = [
  { valor: 'geral',      rotulo: 'Geral' },
  { valor: 'mole',       rotulo: 'Mole' },
  { valor: 'passada',    rotulo: 'Passada' },
  { valor: 'espessada',  rotulo: 'Líquidos espessados' },
  { valor: 'diabetica',  rotulo: 'Diabética' },
  { valor: 'hipossalina',rotulo: 'Hipossalina (sem sal)' },
  { valor: 'outra',      rotulo: 'Outra — ver observações' },
]

export const ACORDOS = [
  { valor: 'acordo',     rotulo: 'Acordo com a Segurança Social' },
  { valor: 'particular', rotulo: 'Particular' },
  { valor: 'misto',      rotulo: 'Misto' },
]

// ── A ficha ──────────────────────────────────────────────────────────────────

export const SECCOES: Seccao[] = [
  {
    id: 'identificacao',
    titulo: 'Quem é',
    campos: [
      { id: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true, largura: 6,
        utente: 'name', candidatura: 'nome' },
      { id: 'data_nascimento', rotulo: 'Data de nascimento', tipo: 'data', largura: 2, naoFuturo: true,
        dica: 'A idade passa a sair daqui, e deixa de envelhecer mal.',
        utente: 'date_of_birth', candidatura: 'data_nascimento' },
      { id: 'sexo', rotulo: 'Sexo', tipo: 'escolha', opcoes: SEXOS, largura: 2,
        utente: 'sex', candidatura: 'sexo' },
      { id: 'estado_civil', rotulo: 'Estado civil', tipo: 'escolha', opcoes: ESTADOS_CIVIS, largura: 2,
        utente: 'estado_civil', candidatura: 'estado_civil' },
      { id: 'nif', rotulo: 'NIF', tipo: 'texto', largura: 2,
        utente: 'nif', candidatura: 'nif' },
      { id: 'sns', rotulo: 'N.º de utente de saúde', tipo: 'texto', largura: 2,
        utente: 'sns_number', candidatura: 'sns' },
      { id: 'naturalidade', rotulo: 'Naturalidade', tipo: 'texto', largura: 2,
        utente: 'naturalidade', candidatura: 'naturalidade' },
    ],
  },
  {
    id: 'onde',
    titulo: 'Onde vive',
    campos: [
      { id: 'morada', rotulo: 'Morada', tipo: 'texto', largura: 6,
        utente: 'address', candidatura: 'morada' },
      { id: 'freguesia', rotulo: 'Freguesia', tipo: 'texto', largura: 2,
        dica: 'Conta para o critério da área de residência.',
        candidatura: 'freguesia' },
      { id: 'concelho', rotulo: 'Concelho', tipo: 'texto', largura: 2,
        candidatura: 'concelho' },
      { id: 'telefone', rotulo: 'Telefone', tipo: 'tel', largura: 2,
        utente: 'telefone', candidatura: 'telefone' },
    ],
  },
  {
    id: 'contacto',
    titulo: 'Quem tratar em caso de necessidade',
    porque: 'À uma da manhã ninguém tem tempo de procurar. Tem de estar aqui.',
    campos: [
      { id: 'contacto_nome', rotulo: 'Nome', tipo: 'texto', largura: 2,
        utente: 'emergency_contact', candidatura: 'contacto_nome' },
      { id: 'contacto_relacao', rotulo: 'Parentesco', tipo: 'texto', largura: 2,
        dica: 'Filha, sobrinho, vizinha…',
        utente: 'contacto_relacao', candidatura: 'contacto_relacao' },
      { id: 'contacto_telefone', rotulo: 'Telefone', tipo: 'tel', largura: 2,
        utente: 'emergency_phone', candidatura: 'contacto_telefone' },
    ],
  },
  {
    id: 'saude',
    titulo: 'Saúde',
    campos: [
      { id: 'diagnosticos', rotulo: 'Diagnósticos', tipo: 'texto', largura: 6,
        dica: 'Separados por vírgulas.',
        utente: 'conditions', candidatura: 'diagnosticos' },
      { id: 'alergias', rotulo: 'Alergias', tipo: 'texto', largura: 3,
        utente: 'allergies', candidatura: 'alergias' },
      { id: 'medico', rotulo: 'Médico de família', tipo: 'texto', largura: 3,
        utente: 'doctor', candidatura: 'medico' },
      { id: 'medicacao', rotulo: 'Medicação que faz', tipo: 'longo', largura: 6,
        dica: 'Só para não se perder na inscrição. A prescrição a sério faz-se depois.',
        candidatura: 'medicacao' },
    ],
  },
  {
    id: 'dia_a_dia',
    titulo: 'O dia a dia',
    porque: 'É daqui que saem os primeiros serviços de cuidado e o plano.',
    campos: [
      { id: 'mobilidade', rotulo: 'Como se desloca', tipo: 'escolha', opcoes: MOBILIDADES, largura: 3,
        utente: 'mobility', candidatura: 'mobilidade' },
      { id: 'estado_cognitivo', rotulo: 'Orientação', tipo: 'escolha', opcoes: ESTADOS_COGNITIVOS, largura: 3,
        utente: 'cognitive_status', candidatura: 'estado_cognitivo' },
      { id: 'dieta', rotulo: 'Dieta', tipo: 'escolha', opcoes: DIETAS, largura: 3,
        utente: 'diet', candidatura: 'dieta' },
      { id: 'profissao', rotulo: 'Profissão que teve', tipo: 'texto', largura: 3,
        dica: 'Não é burocracia: é por onde se começa uma conversa com alguém que não nos conhece.',
        utente: 'profissao', candidatura: 'profissao' },
      { id: 'escolaridade', rotulo: 'Escolaridade', tipo: 'escolha', opcoes: ESCOLARIDADES, largura: 6,
        dica: 'Muda a forma de explicar as coisas, e diz se faz sentido dar-lhe algo para ler.',
        utente: 'escolaridade', candidatura: 'escolaridade' },
    ],
  },
  {
    id: 'casa',
    titulo: 'Na casa',
    porque: 'Só para quem já entrou. Na inscrição ainda não há lugar atribuído.',
    campos: [
      // O rótulo deste muda com o tipo de instituição — num lar é «Quarto»,
      // num centro de dia é «Sala». Quem desenha o formulário passa o rótulo
      // certo vindo de `cfg.roomLabel`; o que está aqui é só o de reserva.
      { id: 'sala', rotulo: 'Sala ou lugar', tipo: 'texto', largura: 3, utente: 'room_number' },
      { id: 'admissao', rotulo: 'Data de entrada', tipo: 'data', largura: 3, utente: 'admission_date' },
      { id: 'notas', rotulo: 'Observações', tipo: 'longo', largura: 6, utente: 'notes' },
    ],
  },
  {
    id: 'medidas',
    titulo: 'Medidas',
    porque: 'Para as doses e para os cálculos. Podem ficar em branco e preencher-se depois.',
    recolhida: true,
    campos: [
      { id: 'peso', rotulo: 'Peso (kg)', tipo: 'numero', largura: 2, utente: 'weight' },
      { id: 'altura', rotulo: 'Altura (cm)', tipo: 'numero', largura: 2, utente: 'height' },
      { id: 'creatinina', rotulo: 'Creatinina (mg/dL)', tipo: 'numero', largura: 2, utente: 'creatinine' },
    ],
  },
]

/** Os campos que fazem sentido em cada sítio, secção a secção. */
export function seccoesPara(onde: 'utente' | 'candidatura'): Seccao[] {
  return SECCOES
    .map(s => ({ ...s, campos: s.campos.filter(c => c[onde]) }))
    .filter(s => s.campos.length > 0)
}

/** O estado inicial de um formulário: todos os campos vazios. */
export function fichaVazia(onde: 'utente' | 'candidatura'): Record<string, string> {
  const f: Record<string, string> = {}
  for (const s of seccoesPara(onde)) for (const c of s.campos) f[c.id] = ''
  return f
}

/**
 * Do formulário para as colunas da tabela.
 *
 * Um campo vazio vai como `null` e não como `''`. A diferença aparece meses
 * depois: `''` passa nos testes de «tem valor» espalhados pelo código e faz
 * aparecer linhas em branco nos documentos e nos emails.
 *
 * ── `omitirVazios` ────────────────────────────────────────────────────────
 * Num INSERT, um campo por preencher não precisa de ir: a coluna já nasce
 * nula. Omiti-lo tem uma vantagem que não é só de tamanho — se uma coluna
 * ainda não existir na base de dados (a migração por correr), uma ficha que
 * não lhe toque continua a gravar. Sem isto, o formulário inteiro deixava de
 * funcionar até alguém correr o SQL.
 *
 * Num UPDATE tem de ser o contrário: quem apaga o conteúdo de um campo quer
 * que ele fique vazio, e um campo omitido fica com o valor antigo.
 */
export function paraColunas(
  ficha: Record<string, string>, onde: 'utente' | 'candidatura',
  { omitirVazios = false }: { omitirVazios?: boolean } = {},
): Record<string, any> {
  const out: Record<string, any> = {}
  for (const s of seccoesPara(onde)) {
    for (const c of s.campos) {
      const coluna = c[onde] as string
      const cru = (ficha[c.id] ?? '').trim()
      if (!cru && omitirVazios) continue
      if (c.tipo === 'numero') out[coluna] = cru ? Number(cru) : null
      else out[coluna] = cru || null
    }
  }
  return out
}

/** Das colunas para o formulário, para se poder editar o que já lá está. */
export function paraFicha(
  linha: Record<string, any>, onde: 'utente' | 'candidatura',
): Record<string, string> {
  const f = fichaVazia(onde)
  for (const s of seccoesPara(onde)) {
    for (const c of s.campos) {
      const v = linha[c[onde] as string]
      f[c.id] = v === null || v === undefined ? '' : String(v)
    }
  }
  return f
}

/**
 * O que falta para a ficha estar completa.
 *
 * Devolve frases, não códigos, porque isto aparece tal e qual na ficha da
 * pessoa — e «falta a data de nascimento» resolve-se; «campo obrigatório em
 * falta: date_of_birth» não.
 */
export function oQueFalta(linha: Record<string, any>, onde: 'utente' | 'candidatura'): string[] {
  const falta: string[] = []
  for (const s of seccoesPara(onde)) {
    for (const c of s.campos) {
      const v = linha[c[onde] as string]
      if (v === null || v === undefined || v === '') falta.push(c.rotulo.toLowerCase())
    }
  }
  return falta
}

/** Quanto da ficha está preenchido, 0–100. */
export function completude(linha: Record<string, any>, onde: 'utente' | 'candidatura'): number {
  let total = 0, cheios = 0
  for (const s of seccoesPara(onde)) {
    for (const c of s.campos) {
      total++
      const v = linha[c[onde] as string]
      if (v !== null && v !== undefined && v !== '') cheios++
    }
  }
  return total ? Math.round((cheios / total) * 100) : 0
}

/** O rótulo de um valor guardado, para se mostrar «Anda com bengala» e não «bengala». */
export function rotuloDe(campoId: string, valor?: string | null): string {
  if (!valor) return ''
  for (const s of SECCOES) {
    const c = s.campos.find(x => x.id === campoId)
    if (c?.opcoes) return c.opcoes.find(o => o.valor === valor)?.rotulo || valor
  }
  return valor
}
