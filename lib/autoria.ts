// autoria.ts — quem responde pelo conteúdo de saúde do Phlox.
//
// ── PORQUE É QUE ISTO EXISTE ──────────────────────────────────────────────
// O blog dá doses de paracetamol para crianças e fala da interação entre
// ibuprofeno e varfarina. Isso é a categoria que a Google classifica como YMYL
// ("Your Money or Your Life") e é a mais escrutinada que existe. As instruções
// que a Google dá aos seus avaliadores de qualidade dizem, sem rodeios, que
// conteúdo médico sem competência demonstrável deve receber a nota mais baixa.
//
// Até agora o schema dos artigos dizia:
//     author: { "@type": "Organization", name: "Phlox Clinical" }
// Uma organização não é uma competência. Não havia pessoa, credencial, revisor,
// fontes, nem data de revisão visível.
//
// ── O QUE ESTE FICHEIRO NÃO FAZ ───────────────────────────────────────────
// Não inventa um revisor clínico. Pôr aqui "Dra. Fulana, Médica de Família"
// sem que essa pessoa exista e tenha mesmo lido os artigos seria inventar
// credenciais médicas — e é exatamente o género de coisa que, além de desonesta,
// dá cabo do site quando alguém verifica.
//
// Por isso `revisorClinico` está a null, e enquanto estiver a null a página não
// promete revisão nenhuma. O bloco visível diz a verdade sobre o que é.
//
// ── O QUE FALTA, E É A COISA MAIS VALIOSA DA LISTA DE SEO ────────────────
// Arranjar UM profissional de saúde real — médico, farmacêutico ou enfermeiro
// com cédula — que leia os artigos e aceite ser nomeado como revisor. Preencher
// abaixo com o nome, a profissão e o número de cédula.
//
// Isto vale mais, para o posicionamento no Google em pesquisas de saúde, do que
// todo o resto do trabalho técnico de SEO junto. É a diferença entre "um site
// qualquer" e "um site com alguém que responde pelo que lá está".

export interface Pessoa {
  nome: string
  papel: string
  /** Cédula profissional, quando aplicável. Só preencher se for verdade. */
  cedula?: string
  /** Página que prove quem é. O Google segue-a. */
  url?: string
}

/** Quem edita e publica. É verdade e pode ficar assim. */
export const EDITOR: Pessoa = {
  nome: 'Fernando Campos',
  papel: 'Editor responsável, Phlox',
  url: 'https://phloxclinical.com/about',
}

/**
 * Quem verifica clinicamente o que é publicado.
 *
 * A NULL DE PROPÓSITO. Preencher só quando existir mesmo uma pessoa com cédula
 * que tenha lido os artigos e aceite ser nomeada. Enquanto for null, nem o
 * schema nem a página afirmam que houve revisão clínica.
 */
export const REVISOR_CLINICO: Pessoa | null = null

/** Fontes reais usadas no conteúdo de medicamentos. */
export interface Fonte {
  nome: string
  descricao: string
  url: string
}

export const FONTES: Record<string, Fonte> = {
  infarmed: {
    nome: 'INFARMED',
    descricao: 'Autoridade Nacional do Medicamento e Produtos de Saúde',
    url: 'https://www.infarmed.pt',
  },
  dgs: {
    nome: 'Direção-Geral da Saúde',
    descricao: 'Normas e orientações clínicas portuguesas',
    url: 'https://www.dgs.pt',
  },
  ema: {
    nome: 'Agência Europeia de Medicamentos',
    descricao: 'Resumos das características dos medicamentos',
    url: 'https://www.ema.europa.eu',
  },
  rxnorm: {
    nome: 'RxNorm / NIH',
    descricao: 'Base de dados de interações medicamentosas dos Institutos Nacionais de Saúde dos EUA',
    url: 'https://www.nlm.nih.gov/research/umls/rxnorm',
  },
  openfda: {
    nome: 'OpenFDA',
    descricao: 'Dados abertos da agência do medicamento norte-americana',
    url: 'https://open.fda.gov',
  },
}

/** Atalho para o caso comum: um artigo sobre medicamentos. */
export const FONTES_MEDICAMENTOS = [
  FONTES.infarmed,
  FONTES.ema,
  FONTES.rxnorm,
]
