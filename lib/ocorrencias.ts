// lib/ocorrencias.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que faz uma ocorrência valer alguma coisa depois de escrita.
//
// ── O QUE ESTAVA EM FALTA ──────────────────────────────────────────────────
// O registo em si estava bem feito: tipo, gravidade, descrição, o que se fez.
// O que faltava era tudo o que vem A SEGUIR.
//
// Havia `follow_up_required` (um sim/não) e `follow_up_notes` (texto livre).
// Nada disso diz QUEM trata e ATÉ QUANDO. Um seguimento sem dono não é um
// seguimento — é uma intenção. Passa uma semana, ninguém fez nada, e quando
// alguém pergunta o que foi feito a seguir à queda de dia 3, a resposta é uma
// caixa de texto vazia.
//
// E faltava a pergunta que só se responde olhando para o conjunto: **isto já
// aconteceu antes a esta pessoa?**. Três quedas em dois meses não são três
// quedas: é uma pessoa que precisa de uma avaliação de marcha, e ninguém o vê
// porque cada queda foi registada num dia diferente por uma pessoa diferente.
//
// ── O TOM ──────────────────────────────────────────────────────────────────
// Um prazo passado diz «passou do prazo», não «EM ATRASO» a vermelho com um
// ponto de exclamação. Quem lê isto não é o culpado — é quem está a tentar
// resolver. Ver os Registos do Fernando sobre o tom num centro de dia.
// ─────────────────────────────────────────────────────────────────────────────

export interface Ocorrencia {
  id: string
  patient_id: string | null
  patient_name?: string
  date: string
  time?: string | null
  type: string
  severity: string
  status: 'open' | 'under_review' | 'closed'
  description: string
  follow_up_required?: boolean
  follow_up_notes?: string | null
  responsavel?: string | null
  responsavel_id?: string | null
  prazo?: string | null
  fechado_em?: string | null
  fechado_por?: string | null
  fotos?: string[] | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// OS TIPOS
// ─────────────────────────────────────────────────────────────────────────────
// Os sete de origem eram de enfermaria. Faltavam os que acontecem mesmo num
// centro de dia — e «Outro» a apanhar metade das ocorrências é o mesmo que não
// ter tipos nenhuns: não se consegue contar nada, e é por tipo que se percebe
// onde a casa tem um problema a repetir-se.

/**
 * De quem é esta ocorrência?
 *
 * ── PORQUE É QUE ISTO NÃO É UM INTERRUPTOR NO FORMULÁRIO ───────────────────
 * Seria mais simples ter uma caixa «isto é sobre alguém?». Mas então uma queda
 * podia ser gravada sem dizer de quem — e uma queda sem pessoa não é uma
 * ocorrência, é uma nota inútil.
 *
 * É o TIPO que manda. Quem escolhe «Queda» deixa de ter uma decisão para
 * tomar, e quem escolhe «Água» não tem de explicar que um cano não é de
 * ninguém.
 */
export type QuemEnvolve =
  /** Sem pessoa não faz sentido: uma queda é sempre de alguém. */
  | 'exige'
  /** Pode ser das duas: uma reclamação, um equipamento que magoou alguém. */
  | 'opcional'
  /** É da casa: um corte de água não é de ninguém em particular. */
  | 'nao'

export interface TipoOcorrencia {
  id: string
  label: string
  icone: string
  /** O que cabe aqui, para quem está a escolher com pressa. */
  ajuda: string
  /** Avisar a família por omissão? Uma queda sim; uma falta de pessoal não. */
  avisarFamilia: boolean
  /** Exige, aceita ou recusa um utente. Por omissão `exige` — os tipos que já
   *  existiam eram todos de uma pessoa, e o silêncio tem de os manter assim. */
  pessoa?: QuemEnvolve
}

export const TIPOS: TipoOcorrencia[] = [
  { id: 'fall', label: 'Queda', icone: '🫸', avisarFamilia: true,
    ajuda: 'Caiu, ou foi encontrada no chão.' },
  { id: 'medication_error', label: 'Erro de medicação', icone: '💊', avisarFamilia: true,
    ajuda: 'Dose trocada, em falta, ou dada a quem não era.' },
  { id: 'choking', label: 'Engasgamento', icone: '🫁', avisarFamilia: true,
    ajuda: 'Engasgou-se a comer ou a beber.' },
  { id: 'erro_alimentar', label: 'Erro alimentar', icone: '🍽️', avisarFamilia: true,
    ajuda: 'Dieta trocada, textura errada, ou algo a que é alérgica.' },
  { id: 'fuga', label: 'Saiu sem ninguém ver', icone: '🚪', avisarFamilia: true,
    ajuda: 'Saiu da casa sem que a equipa desse por isso.' },
  { id: 'agressao', label: 'Agressão ou conflito', icone: '💢', avisarFamilia: true, pessoa: 'opcional',
    ajuda: 'Entre utentes, ou com alguém da equipa.' },
  { id: 'behavioral', label: 'Alteração de comportamento', icone: '🧠', avisarFamilia: false,
    ajuda: 'Agitação, confusão, recusa persistente.' },
  { id: 'pressure_ulcer', label: 'Úlcera de pressão', icone: '🩹', avisarFamilia: true,
    ajuda: 'Ferida por pressão, nova ou agravada.' },
  { id: 'infection', label: 'Infeção', icone: '🦠', avisarFamilia: true,
    ajuda: 'Suspeita ou confirmação, incluindo surtos.' },
  { id: 'transporte', label: 'Transporte', icone: '🚐', avisarFamilia: true, pessoa: 'opcional',
    ajuda: 'A carrinha, a chegada, a saída — atraso, engano, acidente.' },
  { id: 'material', label: 'Equipamento', icone: '🔧', avisarFamilia: false, pessoa: 'opcional',
    ajuda: 'Cadeira, cama, elevador ou outro material que falhou ou magoou.' },
  { id: 'reclamacao', label: 'Reclamação', icone: '📣', avisarFamilia: false, pessoa: 'opcional',
    ajuda: 'De uma família ou de um utente. Fica escrita, sempre.' },
  { id: 'ausencia_equipa', label: 'Falta de pessoal', icone: '👥', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Faltou quem devia estar, e isso afetou o cuidado.' },
  // ── A CASA ────────────────────────────────────────────────────────────────
  // Nada disto existia, e o formulário exigia um utente — por isso um cano
  // rebentado, uma falha de energia ou uma visita da ASAE não tinham onde ser
  // registados.
  //
  // São estas que explicam, três meses depois, porque é que naquele dia a
  // rotina foi outra: o banho que não houve, o almoço que atrasou, a medicação
  // que ficou para a tarde.
  { id: 'agua', label: 'Água', icone: '🚰', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Corte, rotura, inundação, ou falta de água quente.' },
  { id: 'energia', label: 'Energia', icone: '⚡', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Falha de eletricidade ou de gás. Diga quanto tempo durou.' },
  { id: 'incendio', label: 'Incêndio ou alarme', icone: '🔥', avisarFamilia: true, pessoa: 'nao',
    ajuda: 'Fogo, fumo, ou o alarme a disparar — mesmo que seja falso.' },
  { id: 'seguranca', label: 'Segurança', icone: '🔒', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Intrusão, furto, ou uma porta que ficou aberta.' },
  { id: 'pragas', label: 'Pragas', icone: '🐜', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Insetos ou roedores. A ASAE pergunta pelo controlo de pragas.' },
  { id: 'inspecao', label: 'Visita de fiscalização', icone: '📋', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Segurança Social, ASAE, bombeiros. Escreva o que foi visto e o que foi pedido.' },
  { id: 'obras', label: 'Obras ou avaria', icone: '🔨', avisarFamilia: false, pessoa: 'nao',
    ajuda: 'Avaria ou obra que mudou a rotina da casa.' },

  { id: 'other', label: 'Outro', icone: '⚠️', avisarFamilia: false, pessoa: 'opcional',
    ajuda: 'O que não cabe em mais nenhum. Escreva bem o que aconteceu.' },
]

export const POR_TIPO = new Map(TIPOS.map(t => [t.id, t]))
export const rotuloTipo = (id: string) => POR_TIPO.get(id)?.label || id
export const iconeTipo = (id: string) => POR_TIPO.get(id)?.icone || '⚠️'

/** Por omissão, um tipo é de uma pessoa: os que já existiam eram todos. */
const deQuem = (id: string | null | undefined): QuemEnvolve =>
  POR_TIPO.get(String(id))?.pessoa || 'exige'

/** Esta ocorrência não faz sentido sem dizer de quem é? */
export const exigePessoa = (tipo: string | null | undefined): boolean => deQuem(tipo) === 'exige'

/** Esta ocorrência aceita um utente? */
export const aceitaPessoa = (tipo: string | null | undefined): boolean => deQuem(tipo) !== 'nao'

/** É do edifício e do serviço, e não de alguém? */
export const eDaCasa = (tipo: string | null | undefined): boolean => deQuem(tipo) === 'nao'

/** Os tipos arrumados em dois grupos, para o formulário. */
export const POR_GRUPO: { id: 'pessoa' | 'casa'; label: string; tipos: TipoOcorrencia[] }[] = [
  { id: 'pessoa', label: 'Com uma pessoa', tipos: TIPOS.filter(t => deQuem(t.id) !== 'nao') },
  { id: 'casa', label: 'Na casa', tipos: TIPOS.filter(t => deQuem(t.id) === 'nao') },
]

/**
 * O que impede esta ocorrência de ser gravada. `null` = pode ir.
 *
 * Vive aqui e não no formulário: a mesma regra faz falta em qualquer sítio que
 * venha a registar ocorrências, e uma segunda cópia acabaria por discordar.
 */
export function problemaNaOcorrencia(
  tipo: string, patientId: string | null | undefined, comoSeChama = 'um utente',
): string | null {
  const t = POR_TIPO.get(tipo)
  if (!t) return 'Escolha o tipo de ocorrência.'
  if (deQuem(tipo) === 'exige' && !patientId) {
    return `Uma ocorrência do tipo «${t.label}» é sempre de alguém — escolha ${comoSeChama}.`
  }
  return null
}

/**
 * Sobre quem é, numa lista.
 *
 * Uma ocorrência da casa dizia «—», que se lê como «falta aqui o nome». «A
 * casa» diz o que é.
 */
export const sobreQuem = (tipo: string, nome: string | null | undefined): string =>
  nome || (eDaCasa(tipo) ? 'A casa' : '—')

// ─────────────────────────────────────────────────────────────────────────────
// O SEGUIMENTO
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoPrazo = 'sem_prazo' | 'a_tempo' | 'hoje' | 'passou'

export interface Seguimento {
  estado: EstadoPrazo
  dias: number | null
  /** A frase que aparece no cartão. */
  frase: string
  /** Merece aparecer no topo da lista? */
  chama: boolean
}

function diasAte(dataISO: string, hoje = new Date()): number {
  const a = new Date(dataISO + 'T00:00:00')
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

/**
 * Como está o seguimento desta ocorrência.
 *
 * Uma ocorrência fechada não tem seguimento nenhum a fazer, e dizer-lhe que o
 * prazo passou seria acusar alguém de não fazer o que já fez.
 */
export function seguimento(o: Ocorrencia, hoje = new Date()): Seguimento {
  if (o.status === 'closed') {
    return { estado: 'a_tempo', dias: null, chama: false, frase: '' }
  }
  if (!o.prazo) {
    const semDono = !o.responsavel && !o.responsavel_id
    return {
      estado: 'sem_prazo', dias: null, chama: semDono,
      frase: semDono ? 'Sem responsável nem prazo.' : 'Sem prazo definido.',
    }
  }

  const dias = diasAte(o.prazo, hoje)
  const quem = o.responsavel ? ` — ${o.responsavel}` : ''

  if (dias < 0) {
    const passaram = -dias
    return {
      estado: 'passou', dias, chama: true,
      frase: `Passou do prazo há ${passaram} ${passaram === 1 ? 'dia' : 'dias'}${quem}.`,
    }
  }
  if (dias === 0) return { estado: 'hoje', dias, chama: true, frase: `Para hoje${quem}.` }
  if (dias <= 3) return { estado: 'a_tempo', dias, chama: true, frase: `Faltam ${dias} dias${quem}.` }
  return {
    estado: 'a_tempo', dias, chama: false,
    frase: `Até ${new Date(o.prazo + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}${quem}.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A REPETIÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export interface Repeticao {
  patientId: string
  nome: string
  tipo: string
  vezes: number
  desde: string
  frase: string
}

/**
 * O mesmo, à mesma pessoa, outra vez.
 *
 * É a única coisa nesta página que ninguém consegue ver sozinho: cada
 * ocorrência foi escrita num dia diferente, provavelmente por uma pessoa
 * diferente, e nenhuma delas sabe das outras.
 *
 * Duas do mesmo tipo em noventa dias já chega para levantar a cabeça. Três é
 * um padrão, e a frase muda para o dizer.
 */
export function repeticoes(ocorrencias: Ocorrencia[], dias = 90, hoje = new Date()): Repeticao[] {
  const limite = new Date(hoje.getTime() - dias * 86400000).toISOString().slice(0, 10)
  const grupos = new Map<string, Ocorrencia[]>()

  for (const o of ocorrencias) {
    if (!o.patient_id) continue
    if (o.date < limite) continue
    const chave = `${o.patient_id}|${o.type}`
    const lista = grupos.get(chave)
    if (lista) lista.push(o); else grupos.set(chave, [o])
  }

  const fora: Repeticao[] = []
  for (const [chave, lista] of grupos) {
    if (lista.length < 2) continue
    const [patientId, tipo] = chave.split('|')
    const ordenadas = [...lista].sort((a, b) => a.date.localeCompare(b.date))
    const nome = ordenadas[0].patient_name || 'Esta pessoa'
    const n = ordenadas.length
    const desde = ordenadas[0].date

    fora.push({
      patientId, nome, tipo, vezes: n, desde,
      frase: n >= 3
        ? `${nome}: ${n.toString()} ocorrências de «${rotuloTipo(tipo).toLowerCase()}» em ${dias} dias. Isto já é um padrão — vale a pena olhar para a causa e não só para cada episódio.`
        : `${nome}: segunda ocorrência de «${rotuloTipo(tipo).toLowerCase()}» desde ${new Date(desde + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}.`,
    })
  }

  return fora.sort((a, b) => b.vezes - a.vezes)
}

/** As que precisam de alguém agora, primeiro. */
export function ordenarPorAtencao(ocorrencias: Ocorrencia[], hoje = new Date()): Ocorrencia[] {
  const peso = (o: Ocorrencia) => {
    if (o.status === 'closed') return 3
    const s = seguimento(o, hoje)
    if (s.estado === 'passou') return 0
    if (s.estado === 'hoje' || s.chama) return 1
    return 2
  }
  return [...ocorrencias].sort((a, b) =>
    peso(a) - peso(b) || b.date.localeCompare(a.date))
}
