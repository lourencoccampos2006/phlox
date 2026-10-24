// lib/racios.ts
// ═══════════════════════════════════════════════════════════════════════════
// OS RÁCIOS DE PESSOAL — contados, não declarados
// ═══════════════════════════════════════════════════════════════════════════
//
// ── O QUE A CHECKLIST PEDIA ────────────────────────────────────────────────
// «Cumprimento dos rácios mínimos de cuidadores e enfermagem» — e uma caixa
// para marcar como conforme. Ou seja: a aplicação sabe quantas pessoas
// trabalham na casa e quantos utentes lá vivem, e pedia à direção técnica que
// fizesse a conta de cabeça e lhe dissesse o resultado.
//
// É o artigo 12.º da Portaria n.º 67/2012, é a primeira coisa que uma visita
// confere, e é uma divisão.
//
// ── A REGRA QUE ISTO SEGUE, E QUE É DELIBERADA ─────────────────────────────
// O que se mostra em grande é O QUE A CASA TEM — «seis ajudantes para vinte e
// quatro utentes, um para cada quatro». Esse número sai dos dados dela e é
// sempre verdadeiro.
//
// O mínimo legal mostra-se AO LADO, citado e atribuído, e com um aviso de que
// a casa o deve confrontar com o texto em vigor. Não é falsa modéstia: um
// rácio legal mal transcrito dentro de uma ferramenta de conformidade pode
// levar uma casa a trabalhar com menos gente do que devia, e isso é um dano
// que não se desfaz com um aviso em letra pequena.
//
// Por isso: a conta é nossa e é exata; a norma é citada e é para confirmar.
//
// ── E O QUE ISTO NÃO FAZ ───────────────────────────────────────────────────
// Não conta horas nem contratos. Uma pessoa a meio tempo conta aqui como uma
// pessoa, e o quadro de pessoal da portaria conta em equivalentes a tempo
// inteiro. Está dito no ecrã: isto é um primeiro crivo, não a declaração.

import { normalizarPapel, type PapelId } from './permissoes'

export type PapelDaCasa = PapelId

/** O que o art. 12.º chama a cada função, e como o Phlox lhe chama. */
export const FUNCOES: {
  papel: PapelDaCasa
  naPortaria: string
  /** Um por cada quantos utentes? `null` = não é por rácio. */
  porCada: number | null
  /** Quando não é por rácio: quantos são precisos, e a partir de quando. */
  fixo?: { quantos: number; apartirDe?: number }
  artigo: string
  /** O que o número não diz por si. Aparece na linha, junto ao artigo. */
  nota?: string
}[] = [
  {
    papel: 'direcao', naPortaria: 'Diretor técnico', porCada: null,
    /* `apartirDe: 1` e não um exigido sempre: uma casa acabada de criar, ainda
       sem utentes nenhuns, abria esta página com uma pendência vermelha a
       dizer-lhe que lhe faltava o diretor técnico. Sem utentes não há rácio
       nenhum para calcular — e a primeira coisa que alguém vê ao criar a casa
       não deve ser uma acusação. */
    fixo: { quantos: 1, apartirDe: 1 },
    artigo: 'Portaria n.º 67/2012, art. 12.º/1-a',
  },
  {
    papel: 'enfermagem', naPortaria: 'Enfermeiro', porCada: 40,
    artigo: 'Portaria n.º 67/2012, art. 12.º/1-c',
  },
  {
    papel: 'animacao', naPortaria: 'Animador sociocultural ou educador social', porCada: 40,
    artigo: 'Portaria n.º 67/2012, art. 12.º/1-b',
  },
  {
    papel: 'auxiliar', naPortaria: 'Ajudante de ação direta', porCada: 8,
    artigo: 'Portaria n.º 67/2012, art. 12.º/1-d',
    /* O 1:8 é o rácio DE DIA; à noite a portaria baixa para 1:20. Conta-se
       pelo de dia, que é o exigente — mas dizê-lo é o que evita que alguém
       leia este número como «chega para as 24 horas». */
    nota: 'o 1:8 é de dia; à noite a portaria admite 1 por cada 20',
  },
]

export interface Racio {
  papel: PapelDaCasa
  naPortaria: string
  artigo: string
  nota?: string
  /** Quantas pessoas a casa tem nesta função. Sai dos dados; está sempre certo. */
  tem: number
  /**
   * Quantas a norma pede para este número de utentes — ou `null` quando não
   * temos norma para este tipo de casa. Ver `MINIMOS_CONHECIDOS`.
   */
  pede: number | null
  /** Um por cada quantos, na norma. */
  umPorCada: number | null
  /** `null` quando não há mínimo com que comparar. */
  cumpre: boolean | null
  /** Se não cumpre, quantas faltam. */
  faltam: number
}

export interface LeituraDeRacios {
  utentes: number
  racios: Racio[]
  /** As funções em falta. Vazio = está tudo, ou não há com que comparar. */
  emFalta: Racio[]
  /** Pessoas da equipa cujo papel não entra em rácio nenhum. */
  foraDeRacio: number
  /** Há mínimos legais para este tipo de casa? Ver `MINIMOS_CONHECIDOS`. */
  comMinimos: boolean
}

/**
 * ── PORQUE É QUE O CENTRO DE DIA NÃO LEVA MÍNIMOS ──────────────────────────
 * A Portaria n.º 67/2012 é dos ESTABELECIMENTOS RESIDENCIAIS (ERPI) — di-lo o
 * artigo 1.º. Aplicar o rácio do lar a um centro de dia era o erro mais fácil
 * de cometer aqui, e o mais caro: dizia a um centro de dia com dois utentes por
 * ajudante que lhe faltava pessoal, ou pior, dava-lhe por conforme um quadro
 * regulado por outra coisa.
 *
 * ── E A OUTRA COISA NÃO É UMA PORTARIA ─────────────────────────────────────
 * Escrevi aqui, a 21/10/2026, que o centro de dia tinha diploma próprio: o
 * «Despacho Normativo n.º 62/99». Estava errado, e saía no ecrã.
 *
 * O Despacho Normativo n.º 62/99 é do SERVIÇO DE APOIO DOMICILIÁRIO, e já nem
 * está em vigor — foi substituído pela Portaria n.º 38/2013, que é a do SAD.
 * Mandei um centro de dia consultar o diploma do apoio domiciliário, revogado.
 *
 * O centro de dia não tem portaria de condições de funcionamento como a ERPI
 * tem. O que há é o Guião Técnico do Centro de Dia (DGAS, 1996), que é um
 * documento técnico e não lei, o regime de licenciamento (DL n.º 64/2007, na
 * redação do DL n.º 33/2014) e — onde estão mesmo os números que obrigam uma
 * casa concreta — o ACORDO DE COOPERAÇÃO com a Segurança Social, no modelo da
 * Portaria n.º 196-A/2015.
 *
 * Por isso o que se diz a um centro de dia não é «vai ver o diploma X»: é que
 * o número que o obriga está no acordo dele. Isso é verdadeiro e é útil.
 */
export const MINIMOS_CONHECIDOS: Record<string, { diploma: string } | null> = {
  // A Portaria n.º 67/2012 já foi alterada duas vezes (Portaria n.º 349/2023,
  // estruturas de pequena dimensão; Portaria n.º 322-B/2024). Daí «na redação
  // atual» — quem for confrontar os números tem de ir ao texto consolidado.
  nursing_home: { diploma: 'Portaria n.º 67/2012, art. 12.º (na redação atual)' },
  day_care: null,
}

/** O que dizer a uma casa para a qual não temos os mínimos. */
export const SEM_MINIMOS: Record<string, string> = {
  day_care:
    'O centro de dia não tem portaria de rácios como os lares têm — a Portaria '
    + 'n.º 67/2012 é das estruturas residenciais (art. 1.º) e não se aplica aqui. '
    + 'Os números que obrigam este centro estão no seu acordo de cooperação com a '
    + 'Segurança Social (modelo da Portaria n.º 196-A/2015); como orientação técnica '
    + 'há o Guião Técnico do Centro de Dia (DGAS, 1996), que não é lei. Os números '
    + 'deste quadro são os da casa.',
}

/**
 * A leitura, a partir dos papéis que a casa já atribuiu.
 *
 * Usa o `org_members.role` e não o `team_members.role`: o primeiro é o que
 * decide os ACESSOS de cada pessoa e por isso está sempre em dia — ninguém
 * deixa um colega sem conseguir trabalhar. O segundo é um campo de ficha que
 * se preenche uma vez e se esquece, e ainda traz os papéis de farmácia de
 * quando o produto servia outro mercado (`pharmacist`, `doctor`).
 *
 * Um rácio calculado sobre um campo esquecido é pior do que nenhum.
 */
export function lerRacios(
  membros: { role: string | null; active?: boolean | null }[],
  utentesAtivos: number,
  tipoDeCasa: string,
): LeituraDeRacios {
  const comMinimos = !!MINIMOS_CONHECIDOS[tipoDeCasa]
  const ativos = membros.filter(m => m.active !== false)
  const porPapel = new Map<string, number>()
  let semPapel = 0
  for (const m of ativos) {
    /* `normalizarPapel` e nao `m.role`: a casa que existe desde maio tem gente
       gravada com o vocabulario antigo (`caregiver`, `admin`, `nurse`), e a
       contar as cadeias em cru essas pessoas desapareciam da conta — o rácio
       dava em falta uma auxiliar que está lá a trabalhar. */
    const p = normalizarPapel(m.role)
    if (!p) { semPapel++; continue }
    porPapel.set(p, (porPapel.get(p) || 0) + 1)
  }

  /* O dono conta como direção. Numa casa pequena é a mesma pessoa, e não a
     contar dava «falta o diretor técnico» a uma casa que tem um. */
  const contar = (papel: PapelDaCasa) =>
    (porPapel.get(papel) || 0) + (papel === 'direcao' ? (porPapel.get('dono') || 0) : 0)

  const racios: Racio[] = FUNCOES.map(f => {
    const tem = contar(f.papel)
    const pede = !comMinimos ? null : (f.porCada
      // `Math.ceil`: 9 utentes com um rácio de 1:8 pedem DOIS, não 1,125.
      ? Math.max(utentesAtivos > 0 ? 1 : 0, Math.ceil(utentesAtivos / f.porCada))
      : (f.fixo && (!f.fixo.apartirDe || utentesAtivos >= f.fixo.apartirDe) ? f.fixo.quantos : 0))
    return {
      papel: f.papel, naPortaria: f.naPortaria, artigo: f.artigo, nota: f.nota,
      tem, pede, umPorCada: comMinimos ? f.porCada : null,
      cumpre: pede === null ? null : tem >= pede,
      faltam: pede === null ? 0 : Math.max(0, pede - tem),
    }
  })

  const emRacio = new Set<string>([...FUNCOES.map(f => f.papel), 'dono'])
  const foraDeRacio =
    ativos.filter(m => { const p = normalizarPapel(m.role); return p ? !emRacio.has(p) : false }).length
    + semPapel

  return {
    utentes: utentesAtivos,
    racios,
    emFalta: racios.filter(r => r.cumpre === false),
    foraDeRacio,
    comMinimos,
  }
}

/** «1 para cada 4» — a frase que se diz numa visita. */
export function emPalavras(r: Racio, utentes: number): string {
  if (r.tem === 0) return 'Ninguém nesta função'
  const porPessoa = utentes / r.tem
  if (porPessoa < 1) return `${r.tem} para ${utentes}`
  /* `toLocaleString('pt-PT')` e não `toFixed`: o `toFixed` escrevia «1 para
     cada 2.7», com ponto decimal, no meio de uma frase em português. */
  return `1 para cada ${porPessoa.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}`
}

/**
 * O aviso que acompanha sempre os mínimos legais.
 *
 * Fica aqui, e não num comentário de componente, porque é a mesma frase na
 * página e no documento impresso — e uma frase destas a divergir entre os dois
 * é exactamente o tipo de coisa que destrói a confiança no resto.
 */
export const AVISO_DOS_MINIMOS =
  'Os mínimos ao lado são a Portaria n.º 67/2012 como a lemos, e a casa deve '
  + 'confrontá-los com o texto em vigor: agravam-se com o grau de dependência dos '
  + 'utentes, e há funções (cozinha, serviços domésticos, manutenção) que esta conta '
  + 'não cobre.'

/**
 * O que a contagem conta — e o que não verifica.
 *
 * Duas frases que custam duas linhas de ecrã e evitam dois enganos sérios:
 * ler «4 enfermeiros» como quatro a tempo inteiro, e ler o papel que a casa deu
 * a alguém no Phlox como prova de que essa pessoa tem a cédula.
 */
export const AVISO_DA_CONTAGEM =
  'A contagem sai dos papéis que a casa atribuiu na equipa, e conta PESSOAS: quem '
  + 'trabalha a meio tempo conta aqui como um e no quadro de pessoal conta como meio. '
  + 'E é o papel, não a qualificação — quem está como Enfermagem no Phlox tem os '
  + 'acessos de enfermagem, o que não é o mesmo que ter cédula profissional.'
