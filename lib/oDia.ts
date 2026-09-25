// lib/oDia.ts
// ─────────────────────────────────────────────────────────────────────────────
// O Dia — o trabalho de hoje, de cinco sítios, numa lista só.
//
// ── O PROBLEMA QUE ISTO RESOLVE ────────────────────────────────────────────
// Para saber o que há para fazer esta manhã, alguém tinha de abrir o /mar, o
// /activities, o /apoio-servicos, o /refeicoes e — desde o sprint157 — a ficha
// de cada pessoa para ver o Plano. Cinco páginas, cinco listas, e nenhuma
// delas sabe da existência das outras.
//
// Na prática ninguém abre cinco páginas. Abre uma, e o resto do dia acontece
// de memória — que funciona até ao dia em que falta a pessoa que tem a memória.
//
// ── AS DUAS VISTAS, E PORQUE SÃO AS DUAS PRECISAS ──────────────────────────
// Por PESSOA: «o que é que há para fazer com a Dona Maria». É como se faz uma
// ronda — vai-se ter com alguém e trata-se de tudo de uma vez.
//
// Por TAREFA: «quem é que falta levar ao banho». É como se faz um turno —
// escolhe-se um trabalho e faz-se a toda a gente que precisa dele.
//
// As duas são reais e nenhuma serve para a outra. Um programa que só tenha uma
// obriga metade da equipa a trabalhar ao contrário do que sabe.
//
// ── NÃO HÁ AQUI UMA SEGUNDA VERDADE ────────────────────────────────────────
// Marcar no Dia escreve nas MESMAS tabelas de sempre: `mar_records`,
// `activity_participations`, `support_services`, `dietary_reinforcements`. Quem
// marcar uma toma aqui e abrir o /mar a seguir vê lá a marca, porque é a mesma
// linha. Só as ações do Plano tinham de estrear tabela (`plano_execucoes`,
// sprint158), por não terem nenhuma.
//
// Uma vista que guardasse as coisas à parte seria uma segunda verdade sobre o
// mesmo dia, e ao fim de uma semana ninguém sabia qual valia.
//
// ── O QUE FICA DE FORA, DE PROPÓSITO ───────────────────────────────────────
// • A PREPARAÇÃO DO PASTILHEIRO é um trabalho SEMANAL, não diário: o
//   pastilheiro de quinta prepara-se na segunda. Mostrá-lo como tarefa de hoje
//   seria mentir sobre quando é que se faz. Continua em /preparacao-medicacao,
//   e o contador da semana já o chama.
// • A EMENTA não é uma tarefa por pessoa — é o menu da casa. Fica no
//   /refeicoes. O que entra aqui são os REFORÇOS alimentares, que esses sim são
//   por pessoa e por turno.
// ─────────────────────────────────────────────────────────────────────────────

import { ehParaHoje, type Acao, type Objetivo } from './plano'

export type Fonte = 'plano' | 'medicacao' | 'atividade' | 'apoio' | 'reforco'

export interface Tarefa {
  /** Estável entre recargas: é o que permite marcar sem esperar pelo servidor. */
  chave: string
  fonte: Fonte
  patientId: string
  nome: string
  /** O que se faz. É por ISTO que a vista «por tarefa» agrupa, por isso tem de
   *  ser a mesma frase para a mesma coisa em pessoas diferentes. */
  oQue: string
  detalhe?: string | null
  /** `manha` | `tarde` | `noite`, ou null para qualquer altura. */
  turno: string | null
  /** Área de permissões: quem não a vê não recebe esta tarefa. */
  area: string
  feito: boolean
  /** Já foi assinalado como não prestado hoje, e porquê. */
  naoPrestado?: { motivo: string; nota: string | null } | null
  /** O que a marcação precisa de saber para escrever na tabela certa. */
  ref: Record<string, any>
}

export const ROTULO_DA_FONTE: Record<Fonte, string> = {
  plano: 'Plano',
  medicacao: 'Medicação',
  atividade: 'Atividades',
  apoio: 'Apoio',
  reforco: 'Reforço alimentar',
}

// ─────────────────────────────────────────────────────────────────────────────
// CADA FONTE, TRADUZIDA PARA A MESMA FORMA
// ─────────────────────────────────────────────────────────────────────────────

interface Pessoa { id: string; name: string }

/** As ações do Plano Individual que tocam hoje. */
export function tarefasDoPlano(
  pessoas: Pessoa[],
  objetivos: (Objetivo & { patient_id: string })[],
  acoes: Acao[],
  execucoes: { acao_id: string; turno: string | null }[],
  dia: Date,
): Tarefa[] {
  const objPorId = new Map(objetivos.map(o => [o.id, o]))
  const feitas = new Set(execucoes.map(e => `${e.acao_id}|${e.turno ?? '-'}`))

  return acoes.flatMap(a => {
    if (!ehParaHoje(a, dia)) return []
    const o = objPorId.get(a.objetivo_id)
    if (!o) return []
    const pessoa = pessoas.find(p => p.id === o.patient_id)
    if (!pessoa) return []

    return [{
      chave: `plano:${a.id}`,
      fonte: 'plano' as const,
      patientId: o.patient_id,
      nome: pessoa.name,
      oQue: a.o_que,
      detalhe: a.quem || null,
      turno: a.turno,
      area: o.area,
      feito: feitas.has(`${a.id}|${a.turno ?? '-'}`),
      ref: { acao_id: a.id, turno: a.turno },
    }]
  })
}

/** As tomas devidas neste turno. */
export function tarefasDaMedicacao(
  pessoas: Pessoa[],
  meds: { id: string; patient_id: string; name: string; dose: string | null; shifts: string[] | null; take_location?: string | null; sos?: boolean | null }[],
  registos: { med_id: string; patient_id: string; status: string }[],
  turno: string,
): Tarefa[] {
  const registado = new Map(registos.map(r => [`${r.patient_id}|${r.med_id}`, r.status]))

  return meds.flatMap(m => {
    // Um SOS não é uma dose agendada: dá-se quando é preciso e mais nenhuma
    // vez. Como um SOS tem `shifts` vazio, e vazio quer dizer «todos os
    // turnos», sem esta linha ele aparecia como dose por dar em cada turno de
    // cada dia — para sempre. Enchia a lista de trabalho com coisas que não
    // são para fazer, e uma lista assim ensina-se a ignorar.
    if (m.sos) return []
    // `shifts` vazio significa «todos os turnos» — é a compatibilidade com os
    // medicamentos criados antes de haver turnos, e o /mar lê-o da mesma forma.
    const devido = !m.shifts || m.shifts.length === 0 || m.shifts.includes(turno)
    if (!devido) return []
    // A medicação que a pessoa toma em casa não é trabalho da casa.
    if (m.take_location === 'casa') return []
    const pessoa = pessoas.find(p => p.id === m.patient_id)
    if (!pessoa) return []

    const estado = registado.get(`${m.patient_id}|${m.id}`)
    return [{
      chave: `med:${m.id}:${turno}`,
      fonte: 'medicacao' as const,
      patientId: m.patient_id,
      nome: pessoa.name,
      oQue: m.name,
      detalhe: m.dose || null,
      turno,
      area: 'medicacao',
      feito: estado === 'administered',
      naoPrestado: estado === 'refused' ? { motivo: 'recusou', nota: null }
        : estado === 'held' ? { motivo: 'clinico', nota: null }
        : null,
      ref: { med_id: m.id, turno },
    }]
  })
}

/**
 * As atividades de hoje, uma linha por pessoa INSCRITA.
 *
 * ── PORQUE É QUE NÃO É TODA A GENTE ────────────────────────────────────────
 * A primeira versão desta função fazia uma linha por cada pessoa da casa vezes
 * cada atividade do dia. Numa casa de trinta pessoas com três atividades, isso
 * são NOVENTA tarefas — e a esmagadora maioria delas é mentira, porque uma
 * atividade não é para toda a gente.
 *
 * Uma lista com noventa linhas não é uma lista: é um muro. E o pior é que o
 * muro é feito de coisas falsas, o que ensina a equipa a não confiar nesta
 * página logo no primeiro dia.
 *
 * Por isso só entram as pessoas que já têm inscrição na atividade. Uma
 * atividade em que ainda ninguém foi inscrito não produz tarefas nenhumas aqui
 * — e é o /activities que a chama, com o contador dele.
 */
export function tarefasDasAtividades(
  pessoas: Pessoa[],
  atividades: { id: string; title: string; start_time: string | null; status: string }[],
  participacoes: { activity_id: string; patient_id: string; attended: boolean; motivo: string | null }[],
): Tarefa[] {
  // Só as que ainda não foram dadas por terminadas ou canceladas: uma atividade
  // fechada não é trabalho por fazer.
  const abertas = new Map(
    atividades.filter(a => a.status === 'planned' || a.status === 'ongoing').map(a => [a.id, a]))

  return participacoes.flatMap(part => {
    const a = abertas.get(part.activity_id)
    if (!a) return []
    const pessoa = pessoas.find(p => p.id === part.patient_id)
    if (!pessoa) return []

    return [{
      chave: `ativ:${a.id}:${pessoa.id}`,
      fonte: 'atividade' as const,
      patientId: pessoa.id,
      nome: pessoa.name,
      oQue: a.title,
      detalhe: a.start_time || null,
      turno: horaParaTurno(a.start_time),
      area: 'atividades',
      feito: part.attended === true,
      naoPrestado: part.attended === false && part.motivo
        ? { motivo: part.motivo, nota: null }
        : null,
      ref: { activity_id: a.id },
    }]
  })
}

/** Os serviços de apoio pedidos ou a decorrer. */
export function tarefasDoApoio(
  pessoas: Pessoa[],
  servicos: { id: string; patient_id: string | null; kind: string; status: string; notes: string | null }[],
): Tarefa[] {
  return servicos.flatMap(s => {
    if (!s.patient_id) return []
    if (s.status === 'concluido') return []
    const pessoa = pessoas.find(p => p.id === s.patient_id)
    if (!pessoa) return []
    return [{
      chave: `apoio:${s.id}`,
      fonte: 'apoio' as const,
      patientId: s.patient_id,
      nome: pessoa.name,
      oQue: s.kind,
      detalhe: s.notes || null,
      turno: null,
      area: 'registos',
      feito: false,
      ref: { servico_id: s.id },
    }]
  })
}

/** Os reforços alimentares deste turno. */
export function tarefasDosReforcos(
  pessoas: Pessoa[],
  reforcos: { id: string; patient_id: string; shift: string; given: boolean; notes: string | null }[],
  turno: string,
): Tarefa[] {
  return reforcos.flatMap(r => {
    if (r.shift !== turno) return []
    const pessoa = pessoas.find(p => p.id === r.patient_id)
    if (!pessoa) return []
    return [{
      chave: `reforco:${r.id}`,
      fonte: 'reforco' as const,
      patientId: r.patient_id,
      nome: pessoa.name,
      oQue: 'Reforço alimentar',
      detalhe: r.notes || null,
      turno,
      area: 'registos',
      feito: r.given,
      ref: { reforco_id: r.id },
    }]
  })
}

/** «10:30» → o turno em que isso cai. */
function horaParaTurno(hora: string | null | undefined): string | null {
  if (!hora) return null
  const h = Number(String(hora).slice(0, 2))
  if (Number.isNaN(h)) return null
  if (h < 8) return 'noite'
  if (h < 14) return 'manha'
  if (h < 21) return 'tarde'
  return 'noite'
}

// ─────────────────────────────────────────────────────────────────────────────
// AS DUAS VISTAS
// ─────────────────────────────────────────────────────────────────────────────

export interface Grupo {
  chave: string
  titulo: string
  /** A linha por baixo do título: quantas faltam, ou quem é a pessoa. */
  subtitulo?: string
  tarefas: Tarefa[]
  porFazer: number
}

/**
 * Agrupado por pessoa — a forma de fazer uma ronda.
 *
 * Quem já tem tudo feito fica no fim, não desaparece: ver que uma pessoa está
 * tratada é informação, e uma lista que encolhe à medida que se trabalha não
 * deixa ninguém confirmar nada no fim do turno.
 */
export function porPessoa(tarefas: Tarefa[]): Grupo[] {
  const mapa = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    const lista = mapa.get(t.patientId)
    if (lista) lista.push(t); else mapa.set(t.patientId, [t])
  }

  return [...mapa.entries()]
    .map(([id, lista]) => {
      const porFazer = lista.filter(t => !t.feito && !t.naoPrestado).length
      return {
        chave: id,
        titulo: lista[0].nome,
        subtitulo: porFazer === 0
          ? 'tudo tratado'
          : porFazer === 1 ? '1 por fazer' : `${porFazer} por fazer`,
        tarefas: ordenar(lista),
        porFazer,
      }
    })
    .sort((a, b) => (b.porFazer - a.porFazer) || a.titulo.localeCompare(b.titulo, 'pt'))
}

/**
 * Agrupado pelo trabalho — a forma de fazer um turno.
 *
 * Duas coisas com o mesmo nome em pessoas diferentes são o mesmo grupo: é isso
 * que transforma «dar banho» em UMA passagem pela casa em vez de vinte idas e
 * vindas à lista.
 */
export function porTarefa(tarefas: Tarefa[]): Grupo[] {
  const mapa = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    const chave = `${t.fonte}|${t.oQue.trim().toLowerCase()}`
    const lista = mapa.get(chave)
    if (lista) lista.push(t); else mapa.set(chave, [t])
  }

  return [...mapa.entries()]
    .map(([chave, lista]) => {
      const porFazer = lista.filter(t => !t.feito && !t.naoPrestado).length
      return {
        chave,
        titulo: lista[0].oQue,
        subtitulo: `${ROTULO_DA_FONTE[lista[0].fonte]} · ${
          porFazer === 0 ? 'tudo tratado'
            : porFazer === 1 ? '1 pessoa' : `${porFazer} pessoas`}`,
        tarefas: [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
        porFazer,
      }
    })
    .sort((a, b) => (b.porFazer - a.porFazer) || a.titulo.localeCompare(b.titulo, 'pt'))
}

/** Dentro de uma pessoa: primeiro o que falta, e a medicação à frente. */
function ordenar(lista: Tarefa[]): Tarefa[] {
  const peso: Record<Fonte, number> = { medicacao: 0, plano: 1, reforco: 2, atividade: 3, apoio: 4 }
  return [...lista].sort((a, b) => {
    const aFeita = a.feito || !!a.naoPrestado
    const bFeita = b.feito || !!b.naoPrestado
    if (aFeita !== bFeita) return aFeita ? 1 : -1
    return peso[a.fonte] - peso[b.fonte] || a.oQue.localeCompare(b.oQue, 'pt')
  })
}

/** O resumo de uma linha, para o topo da página. */
export function resumo(tarefas: Tarefa[]): string {
  const total = tarefas.length
  if (total === 0) return 'Nada marcado para agora.'
  const porFazer = tarefas.filter(t => !t.feito && !t.naoPrestado).length
  if (porFazer === 0) return `${total} ${total === 1 ? 'coisa tratada' : 'coisas tratadas'}. Está tudo.`
  const pessoas = new Set(tarefas.filter(t => !t.feito && !t.naoPrestado).map(t => t.patientId)).size
  return `${porFazer} ${porFazer === 1 ? 'coisa por fazer' : 'coisas por fazer'}, com ${
    pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`}.`
}
