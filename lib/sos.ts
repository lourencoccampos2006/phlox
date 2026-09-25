// lib/sos.ts
// ─────────────────────────────────────────────────────────────────────────────
// Medicação SOS: a que se dá quando é preciso.
//
// ── A PERGUNTA QUE ISTO RESPONDE ────────────────────────────────────────────
// «Posso dar agora?»
//
// Quem a faz está de pé ao lado de alguém com dores, às três da tarde, e o que
// precisa de saber é se já se deu hoje e há quanto tempo. Hoje essa resposta
// está na cabeça de quem esteve no turno anterior — e quando essa pessoa já foi
// embora, a resposta é um encolher de ombros.
//
// ── O QUE ISTO NÃO FAZ ──────────────────────────────────────────────────────
// Não decide. Devolve o que sabe e diz-o em português; quem decide é quem está
// lá. Um programa que dissesse «não pode» a alguém que está a olhar para uma
// pessoa com dores estaria a exceder-se — e a primeira coisa que essa pessoa
// faria era dar o comprimido e não registar nada, que é o pior de todos os
// resultados.
//
// Por isso não há aqui nenhum `bloqueado: true`. Há avisos, e há sempre forma
// de continuar. O que fica registado é a verdade do que aconteceu.
// ─────────────────────────────────────────────────────────────────────────────

export interface MedSOS {
  id: string
  patient_id: string
  name: string
  dose: string | null
  /** O que trata, em palavras de quem cuida: «dores de cabeça», «agitação». */
  sos_para?: string | null
  /** Quantas vezes, no máximo, por dia. Null = não está escrito. */
  sos_max_dia?: number | null
  /** Quantas horas entre tomas. Null = não está escrito. */
  sos_intervalo_horas?: number | null
}

export interface TomaSOS {
  id: string
  med_id: string
  patient_id: string
  dada_em: string
  motivo: string
  resultado: string | null
  dada_por: string | null
}

export type Gravidade = 'livre' | 'atencao' | 'limite'

export interface Situacao {
  gravidade: Gravidade
  /** A frase que aparece por cima do botão. */
  frase: string
  /** Quantas já se deram hoje. */
  hoje: number
  /** Há quantos minutos foi a última, ou null se não houve nenhuma hoje. */
  desdeAUltima: number | null
}

/** Só as tomas do dia de calendário que estamos a ver. */
export function tomasDeHoje(tomas: TomaSOS[], medId: string, agora = new Date()): TomaSOS[] {
  const dia = agora.toDateString()
  return tomas.filter(t => t.med_id === medId && new Date(t.dada_em).toDateString() === dia)
}

function emPalavrasODecorrido(minutos: number): string {
  if (minutos < 60) return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h < 24) {
    if (m === 0) return `há ${h} ${h === 1 ? 'hora' : 'horas'}`
    return `há ${h}h${String(m).padStart(2, '0')}`
  }
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

/**
 * Como está este SOS, agora.
 *
 * As três gravidades:
 *   `livre`    — não há nada a assinalar.
 *   `atencao`  — já se deu hoje, mas dentro do que está escrito.
 *   `limite`   — passou o máximo do dia, ou ainda não passou o intervalo.
 *
 * `limite` não impede nada. Diz o que se sabe, com a hora, para quem está lá
 * poder decidir com a informação toda — e, se decidir dar, para ficar escrito
 * que foi uma decisão e não um descuido.
 */
export function situacao(med: MedSOS, tomas: TomaSOS[], agora = new Date()): Situacao {
  const doDia = tomasDeHoje(tomas, med.id, agora)
    .sort((a, b) => +new Date(b.dada_em) - +new Date(a.dada_em))

  const hoje = doDia.length
  const ultima = doDia[0]
  const desdeAUltima = ultima
    ? Math.max(0, Math.round((agora.getTime() - new Date(ultima.dada_em).getTime()) / 60000))
    : null

  if (hoje === 0) {
    return { gravidade: 'livre', hoje: 0, desdeAUltima: null, frase: 'Ainda não foi dado hoje.' }
  }

  const quando = emPalavrasODecorrido(desdeAUltima as number)
  const contagem = hoje === 1 ? 'Foi dado uma vez hoje' : `Foi dado ${hoje} vezes hoje`

  // Passou do máximo do dia?
  if (med.sos_max_dia && hoje >= med.sos_max_dia) {
    return {
      gravidade: 'limite', hoje, desdeAUltima,
      frase: `${contagem}, a última ${quando}. O máximo escrito é ${med.sos_max_dia} por dia.`,
    }
  }

  // Ainda não passou o intervalo?
  if (med.sos_intervalo_horas && desdeAUltima !== null && desdeAUltima < med.sos_intervalo_horas * 60) {
    const faltam = med.sos_intervalo_horas * 60 - desdeAUltima
    const emPalavras = faltam < 60
      ? `${faltam} ${faltam === 1 ? 'minuto' : 'minutos'}`
      : `${Math.round(faltam / 60 * 10) / 10} horas`.replace('.', ',')
    return {
      gravidade: 'limite', hoje, desdeAUltima,
      frase: `${contagem}, a última ${quando}. Entre tomas devem passar ${med.sos_intervalo_horas} horas — faltam ${emPalavras}.`,
    }
  }

  return {
    gravidade: 'atencao', hoje, desdeAUltima,
    frase: `${contagem}, a última ${quando}.`
      + (med.sos_max_dia ? ` O máximo escrito é ${med.sos_max_dia} por dia.` : ''),
  }
}

/**
 * Quantas vezes este SOS foi preciso nos últimos dias.
 *
 * É o número que interessa a quem acompanha: um SOS para a agitação dado uma
 * vez por mês é um SOS; dado todos os dias, já não é «quando for preciso» — é
 * medicação de horário que ninguém reviu, e a pessoa que a toma merece que
 * alguém faça essa conta por ela.
 */
export function precisaDeRevisao(
  med: MedSOS, tomas: TomaSOS[], dias = 14, agora = new Date(),
): { vezes: number; frase: string } | null {
  const limite = agora.getTime() - dias * 86400000
  const vezes = tomas.filter(t => t.med_id === med.id && +new Date(t.dada_em) >= limite).length
  if (vezes < dias * 0.5) return null      // menos de uma vez a cada dois dias

  return {
    vezes,
    frase: `${med.name} foi preciso ${vezes} vezes em ${dias} dias. `
      + 'Um SOS que se dá quase todos os dias já não é «quando for preciso» — '
      + 'vale a pena falar com quem acompanha.',
  }
}

/** Motivos que se repetem, para não obrigar a escrever sempre o mesmo. */
export const MOTIVOS_COMUNS = [
  'Dores', 'Dores de cabeça', 'Febre', 'Agitação', 'Ansiedade',
  'Falta de ar', 'Náuseas', 'Insónia', 'Obstipação',
]

/** Como correu, depois. Escolhe-se de uma lista para se poder contar. */
export const RESULTADOS = [
  { id: 'melhorou', label: 'Melhorou' },
  { id: 'melhorou_pouco', label: 'Melhorou um pouco' },
  { id: 'sem_efeito', label: 'Sem efeito' },
  { id: 'piorou', label: 'Piorou' },
]

export function rotuloResultado(id: string | null | undefined): string | null {
  return RESULTADOS.find(r => r.id === id)?.label || null
}
