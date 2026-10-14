// lib/apoioDomiciliario.ts
// ═══════════════════════════════════════════════════════════════════════════
// O SERVIÇO DE APOIO DOMICILIÁRIO — os serviços, os dias, e a volta de hoje
// ═══════════════════════════════════════════════════════════════════════════
//
// ── PORQUE É QUE A LISTA DE SERVIÇOS NÃO É NOSSA ───────────────────────────
// É a da Portaria n.º 38/2013, que define as condições de funcionamento do
// SAD. Uma casa que preencha a Carta Social, que seja inspecionada, ou que
// peça acordo de cooperação, responde por estes nomes e não por outros. Se
// deixássemos cada casa inventar os seus, nenhuma contagem valia nada e
// nenhum relatório batia com o que a tutela pede.
//
// `enfermagem` está fora da Portaria como serviço base do SAD — algumas casas
// prestam-no em protocolo e precisam de o registar. Fica identificado como tal
// e não se mistura com os seis.
//
// ── A VOLTA DE HOJE ────────────────────────────────────────────────────────
// Um plano diz «segunda, quarta e sexta, às nove». Hoje é quarta: esta pessoa
// entra na volta. É tudo o que `voltaDoDia` faz — e é tudo o que faz falta,
// porque a ordem de uma volta é a hora prevista e mais nada. Quem quiser a
// ordem geográfica tem o mapa dos transportes, que já existe e já a calcula.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ServicoSAD =
  | 'higiene_pessoal' | 'higiene_habitacional' | 'refeicao' | 'roupa'
  | 'acompanhamento' | 'teleassistencia' | 'enfermagem' | 'outro'

export const SERVICOS: {
  id: ServicoSAD
  rotulo: string
  /** Três letras, como o MED e o CUI do /o-dia. Para as listas densas. */
  codigo: string
  /** O que é, em palavras de quem vai lá. */
  oQue: string
  /** Está na Portaria 38/2013 como serviço do SAD? */
  naPortaria: boolean
}[] = [
  { id: 'higiene_pessoal', rotulo: 'Higiene pessoal', codigo: 'HIG', naPortaria: true,
    oQue: 'Banho, vestir, cuidados de imagem.' },
  { id: 'higiene_habitacional', rotulo: 'Higiene da casa', codigo: 'CAS', naPortaria: true,
    oQue: 'Limpeza do espaço onde a pessoa vive.' },
  { id: 'refeicao', rotulo: 'Refeições', codigo: 'REF', naPortaria: true,
    oQue: 'Entrega, preparação ou apoio a comer.' },
  { id: 'roupa', rotulo: 'Tratamento de roupa', codigo: 'ROU', naPortaria: true,
    oQue: 'Recolha, lavagem e entrega.' },
  { id: 'acompanhamento', rotulo: 'Acompanhamento ao exterior', codigo: 'EXT', naPortaria: true,
    oQue: 'Consultas, farmácia, serviços, passeio.' },
  { id: 'teleassistencia', rotulo: 'Teleassistência', codigo: 'TEL', naPortaria: true,
    oQue: 'O botão de emergência e quem responde.' },
  { id: 'enfermagem', rotulo: 'Cuidados de enfermagem', codigo: 'ENF', naPortaria: false,
    oQue: 'Em protocolo, quando a casa o presta.' },
  { id: 'outro', rotulo: 'Outro apoio', codigo: 'OUT', naPortaria: false,
    oQue: 'O que não cabe nos de cima — diz-se nas notas.' },
]

export const servicoPorId = (id: string) => SERVICOS.find(s => s.id === id)
export const rotuloDoServico = (id: string) => servicoPorId(id)?.rotulo || 'Apoio'
export const codigoDoServico = (id: string) => servicoPorId(id)?.codigo || '—'

/** 1 = segunda … 7 = domingo, como o resto da aplicação. */
export const DIAS = [
  { n: 1, curto: 'S', rotulo: 'Segunda' },
  { n: 2, curto: 'T', rotulo: 'Terça' },
  { n: 3, curto: 'Q', rotulo: 'Quarta' },
  { n: 4, curto: 'Q', rotulo: 'Quinta' },
  { n: 5, curto: 'S', rotulo: 'Sexta' },
  { n: 6, curto: 'S', rotulo: 'Sábado' },
  { n: 7, curto: 'D', rotulo: 'Domingo' },
]

/**
 * O dia da semana de uma data 'AAAA-MM-DD', de 1 (segunda) a 7 (domingo).
 *
 * Construído com `new Date(a, m-1, d)` e não `new Date(iso)`: a segunda forma
 * lê a cadeia como UTC, e em Portugal no verão isso dá o dia ANTERIOR a partir
 * da meia-noite — o erro de fuso horário que já pôs a página das refeições um
 * dia atrasada (ver lib/ptTime).
 */
export function diaDaSemana(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return 0
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return ((d.getDay() + 6) % 7) + 1
}

/** Os dias em palavras: «Seg · Qua · Sex», ou «Todos os dias». */
export function diasEmPalavras(dias: number[] | null | undefined): string {
  const d = [...new Set((dias || []).filter(n => n >= 1 && n <= 7))].sort()
  if (!d.length) return 'Sem dias marcados'
  if (d.length === 7) return 'Todos os dias'
  if (d.length === 5 && d.every(n => n <= 5)) return 'Dias de semana'
  if (d.length === 2 && d[0] === 6 && d[1] === 7) return 'Fins de semana'
  const nomes = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  return d.map(n => nomes[n]).join(' · ')
}

export interface PlanoSAD {
  id: string
  patient_id: string
  ativo: boolean
  desde: string | null
  ate: string | null
  dias: number[] | null
  hora_prevista: string | null
  como_entrar: string | null
  notas: string | null
  atualizado_em?: string | null
}

export interface ServicoDoPlano {
  id: string
  plano_id: string
  servico: ServicoSAD
  dias: number[] | null
  notas: string | null
}

export interface VisitaSAD {
  id: string
  patient_id: string
  data: string
  chegou_as: string | null
  saiu_as: string | null
  quem: string | null
  feitos: string[] | null
  sem_resposta: boolean
  nao_feito: string | null
  notas: string | null
}

export interface ParadaDaVolta {
  plano: PlanoSAD
  nome: string
  morada: string | null
  telefone: string | null
  /** Os serviços que ESTE dia prevê — não todos os do plano. */
  servicosDeHoje: ServicoDoPlano[]
  /** As visitas já registadas hoje a esta pessoa. Pode haver mais do que uma. */
  visitas: VisitaSAD[]
}

/**
 * A volta de um dia.
 *
 * Um serviço sem dias próprios herda os do plano — é o caso normal: quem
 * marca «higiene pessoal» num plano de segunda, quarta e sexta quer higiene
 * nesses três dias, e obrigá-lo a repetir os dias em cada serviço era pedir a
 * mesma coisa duas vezes para o mesmo resultado.
 *
 * Um plano `ativo: false`, ou fora do seu intervalo de datas, não entra. Um
 * plano sem dias nenhuns também não: é um plano por acabar, e pô-lo na volta
 * de todos os dias punha a equipa a ir a uma casa que ninguém combinou.
 */
export function voltaDoDia(
  dia: string,
  planos: PlanoSAD[],
  servicos: ServicoDoPlano[],
  pessoas: Map<string, { name: string; address?: string | null; telefone?: string | null }>,
  visitas: VisitaSAD[],
): ParadaDaVolta[] {
  const n = diaDaSemana(dia)
  const porPlano = new Map<string, ServicoDoPlano[]>()
  for (const s of servicos) {
    const lista = porPlano.get(s.plano_id)
    if (lista) lista.push(s); else porPlano.set(s.plano_id, [s])
  }

  const paradas: ParadaDaVolta[] = []
  for (const p of planos) {
    if (!p.ativo) continue
    if (p.desde && dia < p.desde) continue
    if (p.ate && dia > p.ate) continue
    const diasDoPlano = (p.dias || []).filter(x => x >= 1 && x <= 7)
    if (!diasDoPlano.length || !diasDoPlano.includes(n)) continue

    const todos = porPlano.get(p.id) || []
    const servicosDeHoje = todos.filter(s => {
      const d = (s.dias || []).filter(x => x >= 1 && x <= 7)
      return d.length ? d.includes(n) : true
    })

    const quem = pessoas.get(p.patient_id)
    paradas.push({
      plano: p,
      nome: quem?.name || 'Sem nome',
      morada: quem?.address || null,
      telefone: quem?.telefone || null,
      servicosDeHoje,
      visitas: visitas.filter(v => v.patient_id === p.patient_id),
    })
  }

  /* A ordem é a hora prevista. Quem não tem hora vai para o fim — e não para o
     princípio, que é o que um `localeCompare` de `null` daria: sem a sentinela
     '99:99', as casas sem hora combinada abriam a volta. */
  return paradas.sort((a, b) =>
    (a.plano.hora_prevista || '99:99').localeCompare(b.plano.hora_prevista || '99:99')
    || a.nome.localeCompare(b.nome, 'pt'))
}

/** Está feita? Uma visita sem resposta também fecha a parada — foi-se lá. */
export function estadoDaParada(p: ParadaDaVolta): 'feita' | 'sem-resposta' | 'por-fazer' {
  if (!p.visitas.length) return 'por-fazer'
  if (p.visitas.every(v => v.sem_resposta)) return 'sem-resposta'
  return 'feita'
}

/** Erro de tabela em falta — o sinal de que o sprint183 ainda não correu. */
export function semTabelaSAD(erro: any): boolean {
  const m = String(erro?.message || erro || '')
  return /sad_(planos|servicos|visitas)/i.test(m)
    && /does not exist|schema cache/i.test(m)
}

/** Lê tudo o que a página precisa de um dia. Devolve o erro em vez de o engolir. */
export async function lerSAD(supabase: SupabaseClient, filtro: (q: any) => any, dia: string) {
  const [pl, sv, vi] = await Promise.all([
    filtro(supabase.from('sad_planos').select('*')),
    filtro(supabase.from('sad_servicos').select('*')),
    filtro(supabase.from('sad_visitas').select('*').eq('data', dia)),
  ])
  /* O erro sobe. Uma lista vazia porque a leitura falhou é indistinguível de
     uma casa que não faz apoio domiciliário — e a diferença entre «ninguém
     recebe apoio» e «não sei quem recebe» é a diferença entre um dia normal e
     um dia em que ninguém foi a casa de ninguém. */
  const erro = (pl as any).error || (sv as any).error || (vi as any).error
  return {
    planos: ((pl as any).data || []) as PlanoSAD[],
    servicos: ((sv as any).data || []) as ServicoDoPlano[],
    visitas: ((vi as any).data || []) as VisitaSAD[],
    erro,
  }
}
