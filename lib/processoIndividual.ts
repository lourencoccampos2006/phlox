// lib/processoIndividual.ts
// ─────────────────────────────────────────────────────────────────────────────
// O processo individual do utente — o que a lei portuguesa exige que lá esteja.
//
// ── DE ONDE ISTO VEIO ──────────────────────────────────────────────────────
// Da pesquisa aos programas que as casas portuguesas já usam. Todos eles —
// Ankira, MySenior, Sioslife — vendem a mesma coisa em primeiro lugar, e não é
// uma funcionalidade: é uma PASTA. «Toda a informação administrativa, social e
// clínica do utente num único local.»
//
// A razão é simples e não é informática. A Portaria n.º 67/2012, no artigo
// 9.º, diz o que tem de estar no processo individual de cada pessoa, e uma
// inspeção da Segurança Social pede a pasta de alguém e confere. Uma casa que
// não a tenha completa não tem um problema de organização — tem um problema
// com o acordo de cooperação.
//
// ── O QUE O PHLOX TINHA, E PORQUE NÃO CHEGAVA ──────────────────────────────
// Havia o /conformidade, com uma lista para a CASA: temos licença, temos
// plano de emergência, temos rácios. Isso responde a «a casa está legal?».
//
// Não responde à pergunta que a inspeção faz de facto, que é sobre UMA pessoa:
// «mostre-me o processo da Dona Maria». Essa resposta estava espalhada por seis
// separadores da ficha, e ninguém a conseguia dar sem os abrir todos.
//
// ── PORQUE É QUE ISTO NÃO É UMA LISTA DE CAIXAS PARA PICAR ─────────────────
// A tentação era uma checklist com quinze quadrados por marcar à mão. Seria
// inútil ao fim de um mês: as caixas ficam picadas, os documentos caducam, e
// a lista passa a dizer que está tudo bem porque alguém, uma vez, disse que
// estava.
//
// Cada linha daqui é uma PERGUNTA À BASE DE DADOS. «Tem contrato» quer dizer
// que existe mesmo um documento da categoria `contrato` na ficha. Ninguém
// pica nada, e no dia em que o documento for apagado a linha volta a ficar
// por cumprir sozinha.
//
// ── E NÃO DIZ QUE A CASA ESTÁ ILEGAL ───────────────────────────────────────
// Isto é uma ferramenta de organização, não um parecer jurídico. Há elementos
// que uma casa guarda em papel, no arquivo, e que nunca vão entrar aqui — e
// uma casa assim não está em falta com ninguém. Por isso o texto diz o que
// FALTA NO PHLOX, e nunca o que falta à casa.
// ─────────────────────────────────────────────────────────────────────────────

import type { InstitutionType } from './useClinicPrefs'

/** Como se prova que este elemento existe. */
export type Prova =
  /** Há um documento desta categoria na ficha. */
  | { tipo: 'documento'; categoria: string }
  /** A ficha tem esta coluna preenchida. */
  | { tipo: 'campo'; colunas: string[] }
  /** Há um plano individual ativo. */
  | { tipo: 'plano' }
  /** Há pelo menos uma avaliação feita. */
  | { tipo: 'avaliacao' }

export interface Elemento {
  id: string
  titulo: string
  /** O que é, em linguagem de quem trabalha na casa. */
  detalhe: string
  /** O artigo, para quem estiver a preparar uma inspeção. */
  base?: string
  prova: Prova
  /** Onde se resolve, dentro da ficha da pessoa. */
  onde: 'documentos' | 'ficha' | 'plano' | 'avaliacoes'
  /** Falso para o que é bom ter mas a lei não exige. */
  exigido: boolean
}

export interface GrupoDoProcesso {
  grupo: string
  elementos: Elemento[]
}

// ── O que a Portaria pede a toda a gente ────────────────────────────────────
// Artigo 9.º: «o estabelecimento organiza um processo individual do utente do
// qual consta, designadamente…». O que está aqui é a parte que um programa
// pode mesmo verificar — a identificação, o contrato, o plano, a saúde.
const COMUM: GrupoDoProcesso[] = [
  {
    grupo: 'Identificação',
    elementos: [
      {
        id: 'identificacao', titulo: 'Documento de identificação',
        detalhe: 'Cartão de cidadão ou equivalente, digitalizado na ficha.',
        base: 'Portaria 67/2012, art. 9.º', prova: { tipo: 'documento', categoria: 'identificacao' },
        onde: 'documentos', exigido: true,
      },
      {
        id: 'nascimento', titulo: 'Data de nascimento',
        detalhe: 'É daqui que sai a idade — que não se escreve à mão em lado nenhum.',
        prova: { tipo: 'campo', colunas: ['date_of_birth', 'birth_date'] },
        onde: 'ficha', exigido: true,
      },
      {
        id: 'fiscais', titulo: 'NIF e número de utente',
        detalhe: 'Necessários para a comparticipação e para qualquer contacto com o SNS.',
        prova: { tipo: 'campo', colunas: ['nif', 'sns_number'] },
        onde: 'ficha', exigido: true,
      },
      {
        id: 'morada', titulo: 'Morada',
        detalhe: 'A morada de residência, ou a da família de referência.',
        prova: { tipo: 'campo', colunas: ['address'] },
        onde: 'ficha', exigido: true,
      },
    ],
  },
  {
    grupo: 'Quem avisar',
    elementos: [
      {
        id: 'contacto', titulo: 'Contacto de emergência',
        detalhe: 'Nome e telefone de quem se liga primeiro. Sem isto, uma queda às três da manhã não tem a quem telefonar.',
        base: 'Portaria 67/2012, art. 9.º', prova: { tipo: 'campo', colunas: ['emergency_phone', 'emergency_contact'] },
        onde: 'ficha', exigido: true,
      },
      {
        id: 'medico', titulo: 'Médico assistente',
        detalhe: 'Quem acompanha esta pessoa fora da casa.',
        base: 'Portaria 67/2012, art. 9.º', prova: { tipo: 'campo', colunas: ['doctor'] },
        onde: 'ficha', exigido: true,
      },
    ],
  },
  {
    grupo: 'Acordo com a casa',
    elementos: [
      {
        id: 'contrato', titulo: 'Contrato de prestação de serviços',
        detalhe: 'Assinado com a pessoa ou com quem a representa.',
        base: 'Portaria 67/2012, art. 9.º', prova: { tipo: 'documento', categoria: 'contrato' },
        onde: 'documentos', exigido: true,
      },
      {
        id: 'consentimento', titulo: 'Consentimento informado',
        detalhe: 'Tratamento de dados de saúde, imagem, e partilha com a família.',
        base: 'RGPD art. 9.º', prova: { tipo: 'documento', categoria: 'consentimento' },
        onde: 'documentos', exigido: true,
      },
      {
        id: 'ss', titulo: 'Documentos da Segurança Social',
        detalhe: 'Comprovativo de rendimentos ou declaração de pensão — é o que fixa a comparticipação.',
        prova: { tipo: 'documento', categoria: 'seguranca_social' },
        onde: 'documentos', exigido: false,
      },
    ],
  },
  {
    grupo: 'Cuidado',
    elementos: [
      {
        id: 'plano', titulo: 'Plano individual',
        detalhe: 'Com objetivos e ações, e uma data para rever. É o documento central do processo.',
        base: 'Portaria 67/2012, art. 9.º', prova: { tipo: 'plano' },
        onde: 'plano', exigido: true,
      },
      {
        id: 'avaliacao', titulo: 'Avaliação inicial',
        detalhe: 'Barthel, Morse, Braden — o ponto de partida contra o qual tudo o resto se compara.',
        prova: { tipo: 'avaliacao' }, onde: 'avaliacoes', exigido: true,
      },
      {
        id: 'saude', titulo: 'Informação clínica',
        detalhe: 'Relatório médico, lista de medicação do exterior, ou boletim de vacinas.',
        prova: { tipo: 'documento', categoria: 'saude' },
        onde: 'documentos', exigido: false,
      },
    ],
  },
]

// Um lar tem a pessoa a viver lá, e por isso tem duas coisas que um centro de
// dia não tem: uma data de entrada e um quarto. Cobrá-las a um centro de dia
// seria pedir o que ele nunca vai ter.
const SO_LAR: GrupoDoProcesso = {
  grupo: 'Alojamento',
  elementos: [
    {
      id: 'admissao', titulo: 'Data de admissão',
      detalhe: 'Quando entrou. Conta para a antiguidade e para qualquer cálculo de comparticipação.',
      prova: { tipo: 'campo', colunas: ['admission_date'] }, onde: 'ficha', exigido: true,
    },
    {
      id: 'quarto', titulo: 'Quarto',
      detalhe: 'Onde dorme. Numa emergência é a diferença entre ir direito e procurar.',
      prova: { tipo: 'campo', colunas: ['room_number'] }, onde: 'ficha', exigido: false,
    },
  ],
}

/**
 * O que tem de estar no processo desta pessoa.
 *
 * Só lares e centros de dia. As outras instituições são de outra lei e não se
 * lhes cobra uma portaria que não é delas — devolver a lista na mesma seria
 * inventar obrigações a uma farmácia.
 */
export function processoPara(institution: InstitutionType): GrupoDoProcesso[] {
  if (institution === 'nursing_home') return [...COMUM, SO_LAR]
  if (institution === 'day_care') return COMUM
  return []
}

export interface Dados {
  /** As categorias dos documentos que esta pessoa tem. */
  categorias: Set<string>
  /** A linha da ficha. */
  ficha: Record<string, any> | null
  temPlano: boolean
  temAvaliacao: boolean
}

/** Este elemento está lá? */
export function cumprido(e: Elemento, d: Dados): boolean {
  switch (e.prova.tipo) {
    case 'documento':
      return d.categorias.has(e.prova.categoria)
    case 'campo':
      // Basta UMA das colunas. São alternativas, e não uma lista de exigências:
      // a data de nascimento vive em `date_of_birth` nas fichas novas e em
      // `birth_date` nas antigas, e é a mesma data.
      return e.prova.colunas.some(c => {
        const v = d.ficha?.[c]
        return v !== null && v !== undefined && String(v).trim() !== ''
      })
    case 'plano': return d.temPlano
    case 'avaliacao': return d.temAvaliacao
  }
}

export interface Balanco {
  /** Quantos dos EXIGIDOS estão lá. */
  feitos: number
  total: number
  pct: number
  /** Os que faltam, exigidos primeiro. */
  faltam: Elemento[]
}

/**
 * Quanto do processo está montado.
 *
 * ── SÓ CONTA O QUE É EXIGIDO ───────────────────────────────────────────────
 * A percentagem é sobre os elementos obrigatórios, e não sobre todos. Uma casa
 * que tenha tudo o que a lei pede tem de conseguir chegar aos 100% — se os
 * «bons de ter» contassem, nunca chegaria, e uma barra que nunca enche deixa
 * de ser lida ao fim de duas semanas.
 *
 * Os opcionais continuam a aparecer na lista do que falta, no fim, marcados
 * como opcionais.
 */
export function balanco(grupos: GrupoDoProcesso[], d: Dados): Balanco {
  const todos = grupos.flatMap(g => g.elementos)
  const exigidos = todos.filter(e => e.exigido)
  const feitos = exigidos.filter(e => cumprido(e, d)).length

  return {
    feitos,
    total: exigidos.length,
    pct: exigidos.length ? Math.round((feitos / exigidos.length) * 100) : 100,
    faltam: todos
      .filter(e => !cumprido(e, d))
      .sort((a, b) => Number(b.exigido) - Number(a.exigido)),
  }
}
