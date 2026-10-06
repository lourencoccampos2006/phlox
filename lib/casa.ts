// lib/casa.ts
// ─────────────────────────────────────────────────────────────────────────────
// O trabalho que a casa faz sobre si própria.
//
// ── A LACUNA QUE ISTO FECHA ────────────────────────────────────────────────
// Da pesquisa ao Ankira (2026-10-01). A aplicação base deles tem doze módulos,
// e o Phlox tinha alguma coisa para onze. O que faltava inteiro é o que eles
// chamam «Serviços»: «gestão de serviços gerais, como a higiene dos espaços e
// lavandaria».
//
// Tudo o que o Phlox sabia pendurava-se numa pessoa — a medicação dela, o banho
// dela, o plano dela. Limpar o refeitório não se pendura em ninguém, e por isso
// não tinha onde viver. Mas é metade do dia de trabalho de uma casa.
//
// ── E EM PORTUGAL TEM INSPEÇÃO PRÓPRIA ─────────────────────────────────────
// Um lar tem dois inspetores: a Segurança Social pela resposta social, e a
// ASAE pela cozinha — porque uma casa que serve refeições é um estabelecimento
// alimentar. A ASAE, antes de olhar para o plano HACCP, verifica os
// pré-requisitos: plano de higienização REGISTADO e registos de temperatura
// dos equipamentos de frio.
//
// E o registo de higienização tem conteúdo obrigatório: data, produto usado, e
// QUEM limpou. Daí `produto` e `feito_por` serem campos e não uma nota solta.
//
// ── DUAS COISAS COM NATUREZAS DIFERENTES ───────────────────────────────────
// Uma TAREFA marca-se como feita, e usa o mesmo motor de cadência dos cuidados
// de rotina (lib/plano.ts) — «às terças e sextas» não pode ter duas
// implementações nesta aplicação.
//
// Uma TEMPERATURA é um número que se lê, e que pode estar fora do intervalo.
// Uma arca a −12 °C não é «feita» nem «por fazer»: é um problema. Por isso tem
// um caminho próprio, e a única pergunta que importa é se está dentro.
// ─────────────────────────────────────────────────────────────────────────────

import { ehParaHoje, type Acao } from './plano'
import { ptDate } from './ptTime'

export type CategoriaDaCasa = 'limpeza' | 'lavandaria' | 'cozinha' | 'manutencao' | 'outro'
export type TipoEquipamento = 'frigorifico' | 'arca' | 'camara' | 'quente' | 'outro'

export interface TarefaDaCasa {
  id: string
  nome: string
  categoria: CategoriaDaCasa
  zona: string | null
  produto: string | null
  cadencia: string
  dias: number[] | null
  turno: string | null
  hora: string | null
  /** A âncora da cadência: «uma vez por mês» a contar de quando. */
  desde: string
  minutos: number | null
  responsavel_id?: string | null
  responsavel?: string | null
  ativo: boolean
  ordem: number
}

export interface ExecucaoDaCasa {
  tarefa_id: string
  data: string
  turno: string | null
  feito_por: string | null
}

export interface Equipamento {
  id: string
  nome: string
  tipo: TipoEquipamento
  zona: string | null
  temp_min: number | null
  temp_max: number | null
  leituras_por_dia: number
  ativo: boolean
  ordem: number
}

export interface Leitura {
  id: string
  equipamento_id: string
  data: string
  hora: string | null
  valor: number
  acao: string | null
  medido_por: string | null
  nota: string | null
}

export const CATEGORIAS: Record<CategoriaDaCasa, { label: string; cor: string; icone: string }> = {
  limpeza:    { label: 'Limpeza',    cor: '#5f7161', icone: '🧹' },
  lavandaria: { label: 'Lavandaria', cor: '#5a6d7c', icone: '🧺' },
  cozinha:    { label: 'Cozinha',    cor: '#7c6f5a', icone: '🍲' },
  manutencao: { label: 'Manutenção', cor: '#6b6a80', icone: '🔧' },
  outro:      { label: 'Outro',      cor: '#7a5f70', icone: '•' },
}

export const ORDEM_DAS_CATEGORIAS: CategoriaDaCasa[] =
  ['limpeza', 'cozinha', 'lavandaria', 'manutencao', 'outro']

export const TIPOS_EQUIPAMENTO: Record<TipoEquipamento, string> = {
  frigorifico: 'Frigorífico',
  arca: 'Arca congeladora',
  camara: 'Câmara',
  quente: 'Equipamento de quente',
  outro: 'Outro',
}

// ─────────────────────────────────────────────────────────────────────────────
// AS TAREFAS DE HOJE
// ─────────────────────────────────────────────────────────────────────────────

export interface TarefaDeHoje {
  tarefa: TarefaDaCasa
  feito: boolean
  feitoPor: string | null
}

/**
 * O que há para fazer hoje, e o que já ficou feito.
 *
 * A cadência vem de `lib/plano.ts` — a MESMA que decide se o banho da Dona
 * Maria é hoje. Uma segunda implementação de «às terças e sextas» acabaria por
 * discordar da primeira, e aí nenhuma das duas valia nada.
 */
export function tarefasDeHoje(
  tarefas: TarefaDaCasa[],
  execucoes: ExecucaoDaCasa[],
  dia: Date = new Date(),
  turno?: string,
): TarefaDeHoje[] {
  const feitas = new Map<string, string | null>()
  for (const e of execucoes) feitas.set(e.tarefa_id, e.feito_por)

  return tarefas
    .filter(t => t.ativo)
    // `ehParaHoje` espera a forma de uma ação do plano, e é a mesma pergunta.
    // `desde` vai a sério e não a zero: é a âncora de «uma vez por semana» e
    // de «uma vez por mês», e sem ela a limpeza mensal dos filtros do exaustor
    // aparecia todos os dias ou nunca.
    .filter(t => ehParaHoje({
      cadencia: t.cadencia as Acao['cadencia'],
      dias: t.dias, desde: t.desde, ativa: t.ativo,
    }, dia))
    .filter(t => !turno || !t.turno || t.turno === turno)
    .map(t => ({
      tarefa: t,
      feito: feitas.has(t.id),
      feitoPor: feitas.get(t.id) ?? null,
    }))
    .sort((a, b) => {
      // O que falta primeiro; dentro disso, pela hora e depois pela ordem do
      // plano. Quem está a limpar percorre a casa, não a lista.
      if (a.feito !== b.feito) return a.feito ? 1 : -1
      const ha = a.tarefa.hora, hb = b.tarefa.hora
      if (ha && hb && ha !== hb) return ha < hb ? -1 : 1
      if (ha && !hb) return -1
      if (!ha && hb) return 1
      return a.tarefa.ordem - b.tarefa.ordem
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// AS TEMPERATURAS
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoLeitura = 'dentro' | 'fora' | 'sem_limite'

/**
 * Esta leitura está dentro do que devia?
 *
 * `sem_limite` não é «está bem»: é «ninguém disse qual é o limite». Tratá-lo
 * como bom era dar por conforme uma arca cujo intervalo nunca foi configurado
 * — exactamente o tipo de silêncio que uma inspeção apanha.
 */
export function estadoDaLeitura(valor: number, e: Pick<Equipamento, 'temp_min' | 'temp_max'>): EstadoLeitura {
  const min = e.temp_min, max = e.temp_max
  if (min === null && max === null) return 'sem_limite'
  if (min !== null && valor < min) return 'fora'
  if (max !== null && valor > max) return 'fora'
  return 'dentro'
}

/** `2 a 8 °C`, ou o que houver. */
export function intervaloEmPalavras(e: Pick<Equipamento, 'temp_min' | 'temp_max'>): string {
  const { temp_min: min, temp_max: max } = e
  if (min !== null && max !== null) return `${min} a ${max} °C`
  if (max !== null) return `até ${max} °C`
  if (min !== null) return `a partir de ${min} °C`
  return 'sem intervalo definido'
}

export interface EstadoDoEquipamento {
  equipamento: Equipamento
  leiturasHoje: Leitura[]
  /** Quantas ainda faltam hoje. Nunca negativo. */
  emFalta: number
  /** Alguma leitura de hoje está fora do intervalo? */
  foraDoIntervalo: Leitura[]
  ultima: Leitura | null
}

export function estadoDosEquipamentos(
  equipamentos: Equipamento[],
  leituras: Leitura[],
  hoje = ptDate(),
): EstadoDoEquipamento[] {
  return equipamentos
    .filter(e => e.ativo)
    .map(e => {
      const minhas = leituras
        .filter(l => l.equipamento_id === e.id && l.data === hoje)
        .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')))
      return {
        equipamento: e,
        leiturasHoje: minhas,
        emFalta: Math.max(0, (e.leituras_por_dia || 1) - minhas.length),
        foraDoIntervalo: minhas.filter(l => estadoDaLeitura(Number(l.valor), e) === 'fora'),
        ultima: minhas.length ? minhas[minhas.length - 1] : null,
      }
    })
    .sort((a, b) => {
      // O que está fora do intervalo vem primeiro, sempre. É a única coisa
      // desta página que é um problema, e não um por fazer.
      const pa = a.foraDoIntervalo.length ? 0 : a.emFalta ? 1 : 2
      const pb = b.foraDoIntervalo.length ? 0 : b.emFalta ? 1 : 2
      return pa - pb || a.equipamento.ordem - b.equipamento.ordem
    })
}

/** A linha de resumo do dia da casa. */
export function resumoDaCasa(tarefas: TarefaDeHoje[], equipamentos: EstadoDoEquipamento[]): string {
  const porFazer = tarefas.filter(t => !t.feito).length
  const fora = equipamentos.reduce((n, e) => n + e.foraDoIntervalo.length, 0)
  const leiturasEmFalta = equipamentos.reduce((n, e) => n + e.emFalta, 0)

  if (fora) {
    return `${fora} ${fora === 1 ? 'leitura fora do intervalo' : 'leituras fora do intervalo'}. Veja isso primeiro.`
  }
  const partes: string[] = []
  if (porFazer) partes.push(`${porFazer} ${porFazer === 1 ? 'tarefa' : 'tarefas'} por fazer`)
  if (leiturasEmFalta) partes.push(`${leiturasEmFalta} ${leiturasEmFalta === 1 ? 'temperatura' : 'temperaturas'} por medir`)
  if (!partes.length) return 'A casa está tratada por hoje.'
  return partes.join(' e ') + '.'
}
