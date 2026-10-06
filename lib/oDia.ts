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
import { servicosDeHoje, type ServicoDoUtente, type ServicoDoCatalogo, type ExecucaoServico } from './servicos'

export type Fonte = 'servico' | 'plano' | 'medicacao' | 'atividade' | 'apoio' | 'reforco'

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
  /**
   * `HH:MM`, ou null para «a qualquer hora do turno».
   *
   * Null é uma resposta legítima e não um dado em falta: a esmagadora maioria
   * do que se faz numa casa faz-se durante a manhã, e não às 09:40. Inventar
   * uma hora para tudo ficar ordenado seria inventar informação clínica — e
   * num centro de dia, onde metade das coisas acontecem quando calha, era
   * mentira a dobrar. Quem não tem hora aparece depois de quem tem.
   */
  hora: string | null
  /** Área de permissões: quem não a vê não recebe esta tarefa. */
  area: string
  /** Quem ficou com isto. Null = é de quem estiver de turno. */
  responsavelId?: string | null
  responsavel?: string | null
  feito: boolean
  /** Já foi assinalado como não prestado hoje, e porquê. */
  naoPrestado?: { motivo: string; nota: string | null } | null
  /** O que a marcação precisa de saber para escrever na tabela certa. */
  ref: Record<string, any>
}

export const ROTULO_DA_FONTE: Record<Fonte, string> = {
  servico: 'Cuidado',
  plano: 'Plano',
  medicacao: 'Medicação',
  atividade: 'Atividades',
  apoio: 'Apoio',
  reforco: 'Reforço alimentar',
}

/**
 * A cor de cada origem.
 *
 * ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
 * Um turno tem trinta a setenta linhas, e antes disto eram todas iguais: para
 * saber se uma linha era uma toma ou um banho havia que LER a segunda linha,
 * em cinza, a onze e meio. Trinta vezes.
 *
 * Com uma barra de cor à esquerda, a estrutura do turno vê-se sem ler nada —
 * onde estão as doses, onde está o cuidado, onde está o que veio do plano.
 *
 * ── SÃO CORES SURDAS, E DE PROPÓSITO ───────────────────────────────────────
 * Nenhuma delas é vermelha nem berrante. Estas cores dizem «isto é de que
 * tipo», não «isto é grave» — e se gritassem, a primeira coisa urgente a
 * aparecer no ecrã não se distinguia do resto. O vermelho fica livre para
 * quando for mesmo preciso.
 */
export const COR_DA_FONTE: Record<Fonte, string> = {
  medicacao: '#5a6d7c',   // azul-ardósia — a que não espera
  servico:   '#5f7161',   // verde-sálvia — o corpo do dia
  plano:     '#6b6a80',   // lilás-gasto — o que vem do plano individual
  atividade: '#7c6f5a',   // areia — a vida da casa
  apoio:     '#7a5f70',   // ameixa — o que foi pedido
  reforco:   '#80625f',   // terracota — a alimentação
}

// ─────────────────────────────────────────────────────────────────────────────
// CADA FONTE, TRADUZIDA PARA A MESMA FORMA
// ─────────────────────────────────────────────────────────────────────────────

interface Pessoa { id: string; name: string }

/**
 * Os cuidados de rotina que tocam hoje — o banho, o levante, a ajuda à
 * refeição (sprint162).
 *
 * É a fonte que faltava, e é a maior de todas: o dia de uma casa é feito
 * sobretudo disto. Sem ela, «O Dia» só sabia mostrar medicação — que foi
 * exatamente o que o Fernando viu ao abrir a página.
 */
export function tarefasDosServicos(
  pessoas: Pessoa[],
  atribuicoes: ServicoDoUtente[],
  catalogo: ServicoDoCatalogo[],
  execucoes: ExecucaoServico[],
  dia: Date,
): Tarefa[] {
  const porPessoa = new Map<string, ServicoDoUtente[]>()
  for (const a of atribuicoes) {
    const l = porPessoa.get(a.patient_id)
    if (l) l.push(a); else porPessoa.set(a.patient_id, [a])
  }

  return [...porPessoa.entries()].flatMap(([pid, lista]) => {
    const pessoa = pessoas.find(p => p.id === pid)
    if (!pessoa) return []
    return servicosDeHoje(lista, catalogo, execucoes, dia).map(s => ({
      chave: `servico:${s.atribuicao.id}`,
      fonte: 'servico' as const,
      patientId: pid,
      nome: pessoa.name,
      oQue: s.servico.nome,
      detalhe: [s.atribuicao.quem, s.atribuicao.notas].filter(Boolean).join(' · ') || null,
      turno: s.atribuicao.turno,
      hora: horaValida((s.atribuicao as any).hora),
      responsavelId: (s.atribuicao as any).responsavel_id ?? null,
      responsavel: (s.atribuicao as any).responsavel ?? null,
      // A área vem do SERVIÇO e não da pessoa: um tratamento de feridas é de
      // quem trata feridas, mesmo que o banho da mesma pessoa seja de todos.
      area: s.servico.area,
      feito: s.feito,
      ref: { servico_utente_id: s.atribuicao.id, turno: s.atribuicao.turno },
    }))
  })
}

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
      hora: horaValida((a as any).hora),
      responsavelId: (a as any).responsavel_id ?? null,
      responsavel: (a as any).responsavel ?? null,
      area: o.area,
      feito: feitas.has(`${a.id}|${a.turno ?? '-'}`),
      ref: { acao_id: a.id, turno: a.turno },
    }]
  })
}

/** As tomas devidas neste turno. */
export function tarefasDaMedicacao(
  pessoas: Pessoa[],
  meds: {
    id: string; patient_id: string; name: string; dose: string | null
    shifts: string[] | null; take_location?: string | null; sos?: boolean | null
    /** `{"manha":"08:00","noite":"22:00"}` — ver a nota em baixo. */
    horas?: Record<string, string> | null
  }[],
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
      // A hora é POR TURNO e não uma lista paralela a `shifts`: o brifen é de
      // manhã e à noite, e são horas diferentes. Duas listas à mesma ordem
      // partem-se assim que alguém tira um turno do meio — todas as horas a
      // seguir passam a estar na linha errada e ninguém repara, porque
      // continua a haver uma hora em cada sítio. Com a chave, não há ordem
      // para se perder.
      hora: horaValida(m.horas?.[turno]),
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
  atividades: {
    id: string; title: string; start_time: string | null; status: string
    responsavel_id?: string | null; responsavel?: string | null; responsible?: string | null
  }[],
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
      // A hora saiu do detalhe: agora é o que ordena a linha, e repeti-la ao
      // lado do nome era dizer duas vezes a mesma coisa.
      detalhe: a.responsible || null,
      turno: horaParaTurno(a.start_time),
      hora: horaValida(a.start_time),
      responsavelId: a.responsavel_id ?? null,
      responsavel: a.responsavel ?? a.responsible ?? null,
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
  servicos: {
    id: string; patient_id: string | null; kind: string; status: string; notes: string | null
    responsavel_id?: string | null; responsavel?: string | null
  }[],
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
      // Um pedido de apoio não tem hora: é um pedido, trata-se quando dá.
      hora: null,
      responsavelId: s.responsavel_id ?? null,
      responsavel: s.responsavel ?? null,
      area: 'registos',
      feito: false,
      ref: { servico_id: s.id },
    }]
  })
}

/** Os reforços alimentares deste turno. */
export function tarefasDosReforcos(
  pessoas: Pessoa[],
  reforcos: { id: string; patient_id: string; shift: string; given: boolean; notes: string | null; hora?: string | null }[],
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
      hora: horaValida(r.hora),
      area: 'registos',
      feito: r.given,
      ref: { reforco_id: r.id },
    }]
  })
}

/**
 * Uma hora a sério, ou null.
 *
 * Aceita o que as várias tabelas guardam de facto — `'9:00'`, `'09:00'`,
 * `'09:00:00'` — e devolve sempre `HH:MM`. Tudo o resto é null, e não uma
 * tentativa de adivinhar: uma hora mal lida ordena a lista pela ordem errada
 * e fá-lo em silêncio, que é a pior maneira de estar errado.
 */
export function horaValida(v: string | null | undefined): string | null {
  if (!v) return null
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(String(v))
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** `HH:MM` → minutos desde a meia-noite. Para ordenar, e mais nada. */
export function minutosDe(hora: string | null | undefined): number | null {
  const h = horaValida(hora)
  if (!h) return null
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
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
  /** Só na vista por hora: `HH:MM`, ou null para o grupo «a qualquer hora». */
  hora?: string | null
}

/**
 * Agrupado pelo RELÓGIO — a forma de perceber o que é para agora.
 *
 * ── PORQUE É QUE ESTA É A VISTA PRINCIPAL ──────────────────────────────────
 * «No /o-dia as coisas aparecem de forma estranha, não há horas, não há ordem,
 * apenas tarefas.»
 *
 * As outras duas vistas respondem a «o que falta à Dona Maria» e «a quem falta
 * o banho». Nenhuma responde à pergunta que se faz mais vezes num turno: o que
 * é para fazer A SEGUIR. Sem o relógio, a lista é um monte — e um monte
 * ordena-se pela ordem por que se lê, que é a ordem errada.
 *
 * ── O QUE NÃO TEM HORA NÃO É EMPURRADO PARA UMA HORA FALSA ─────────────────
 * A tentação é dar a cada coisa sem hora a hora de início do turno, para tudo
 * ficar na linha. Isso ordena, mas mente: passavam a estar todas às 07:00 e a
 * página dizia que às sete há vinte coisas para fazer.
 *
 * Ficam num grupo próprio no fim, que é a verdade: fazem-se durante o turno.
 *
 * ── E A ORDEM NÃO MUDA COM O TRABALHO ──────────────────────────────────────
 * Ao contrário das outras duas vistas, os grupos já tratados NÃO descem para o
 * fim. Uma linha do tempo em que as horas mudam de sítio à medida que se
 * trabalha deixa de ser uma linha do tempo — e quem estava a meio da lista
 * perde o sítio onde ia.
 */
export function porHora(tarefas: Tarefa[]): Grupo[] {
  const mapa = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    const chave = t.hora || '—'
    const lista = mapa.get(chave)
    if (lista) lista.push(t); else mapa.set(chave, [t])
  }

  return [...mapa.entries()]
    .map(([hora, lista]) => {
      const porFazer = lista.filter(t => !t.feito && !t.naoPrestado).length
      const semHora = hora === '—'
      return {
        chave: `hora:${hora}`,
        titulo: semHora ? 'A qualquer hora' : hora,
        subtitulo: porFazer === 0
          ? 'tudo tratado'
          : `${porFazer} por fazer`,
        // Dentro da mesma hora não há mais relógio que decida: ordena-se por
        // pessoa, para quem estiver a percorrer o corredor não andar de um
        // lado para o outro.
        tarefas: [...lista].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt') || a.oQue.localeCompare(b.oQue, 'pt')),
        porFazer,
        hora: semHora ? null : hora,
      }
    })
    .sort((a, b) => {
      // O grupo sem hora vai para o fim, sempre.
      if (!a.hora) return 1
      if (!b.hora) return -1
      return (minutosDe(a.hora) ?? 0) - (minutosDe(b.hora) ?? 0)
    })
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

/**
 * Dentro de uma pessoa: primeiro o que falta, depois pelo relógio.
 *
 * A hora passou à frente do tipo de tarefa. Antes disto a medicação vinha
 * sempre primeiro, o que estava certo enquanto não havia horas — era o único
 * critério que significava alguma coisa. Agora que há, uma toma das 22:00
 * aparecer acima de um banho das 10:00 é pôr a lista ao contrário do dia.
 *
 * O peso do tipo continua a decidir os empates, e aí a medicação continua à
 * frente: entre duas coisas à mesma hora, a dose é a que não espera.
 */
function ordenar(lista: Tarefa[]): Tarefa[] {
  const peso: Record<Fonte, number> = { medicacao: 0, servico: 1, plano: 2, reforco: 3, atividade: 4, apoio: 5 }
  return [...lista].sort((a, b) => {
    const aFeita = a.feito || !!a.naoPrestado
    const bFeita = b.feito || !!b.naoPrestado
    if (aFeita !== bFeita) return aFeita ? 1 : -1
    // Quem não tem hora vai para depois de quem tem — não para o princípio,
    // que é onde `null` cairia se isto fosse uma subtração simples.
    const ha = minutosDe(a.hora), hb = minutosDe(b.hora)
    if (ha !== hb) {
      if (ha === null) return 1
      if (hb === null) return -1
      return ha - hb
    }
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
