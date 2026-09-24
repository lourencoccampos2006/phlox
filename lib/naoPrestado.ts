// lib/naoPrestado.ts
// ─────────────────────────────────────────────────────────────────────────────
// O cuidado que não foi prestado, e porquê.
//
// ── PORQUE É QUE ISTO TEM DE EXISTIR ────────────────────────────────────────
// O Phlox sabia registar o que foi feito. Não sabia registar o que NÃO foi —
// e num lar ou centro de dia isso é metade da verdade do dia.
//
// A medicação já tinha os seus estados (`administered`, `refused`, `held`).
// Fora dela, não havia sítio nenhum: um banho recusado, um almoço que a pessoa
// não quis, uma ginástica em que não participou. O `attended` das atividades
// é um booleano — não distingue «não veio» de «veio e recusou», que para quem
// cuida são coisas completamente diferentes.
//
// ── O QUE ISTO MUDA, EM TRÊS SÍTIOS ─────────────────────────────────────────
// 1. **A inspeção.** Um registo que só tem o que correu bem não é um registo,
//    é uma brochura. Um cuidado recusado, escrito com o motivo e a hora, é a
//    prova de que a equipa esteve lá e tentou.
// 2. **O que merece atenção.** Três banhos recusados numa semana não são três
//    contrariedades: são um sinal. Sem este registo, o Sentinel não o vê.
// 3. **A família.** O relato honesto do dia inclui «hoje não quis almoçar».
//    Esconder isso é o género de silêncio que destrói a confiança de uma
//    família num centro.
//
// ── PORQUE É QUE É UMA TABELA À PARTE ───────────────────────────────────────
// Podia ser um campo em cada tabela de registo. Não é, por duas razões: a
// pergunta que se faz é «o que é que esta pessoa tem recusado ultimamente?»,
// que atravessa áreas — e uma tabela responde-lhe numa consulta; e acrescentar
// um campo a seis tabelas é seis migrações e seis sítios para esquecer.
// ─────────────────────────────────────────────────────────────────────────────

export type MotivoId = 'recusou' | 'ausente' | 'adiado' | 'clinico' | 'sem_condicoes' | 'outro'

export interface Motivo {
  id: MotivoId
  label: string
  /** O que se percebe ao ler isto no registo, dali a um mês. */
  ajuda: string
  /** Conta como sinal a vigiar? Uma ausência não é — a pessoa não estava cá. */
  sinal: boolean
}

export const MOTIVOS: Motivo[] = [
  { id: 'recusou', label: 'Recusou', sinal: true,
    ajuda: 'A pessoa estava cá e não quis. É o motivo que mais diz sobre como ela está.' },
  { id: 'ausente', label: 'Não estava', sinal: false,
    ajuda: 'Faltou, saiu mais cedo, estava numa consulta. Não é um sinal — é uma ausência.' },
  { id: 'clinico', label: 'Por indicação clínica', sinal: false,
    ajuda: 'Suspenso por decisão de quem acompanha. Deve dizer-se por quem, na nota.' },
  { id: 'sem_condicoes', label: 'Não houve condições', sinal: true,
    ajuda: 'Faltou gente, faltou material, o autocarro não veio. É sobre a casa, não sobre a pessoa.' },
  { id: 'adiado', label: 'Ficou para depois', sinal: false,
    ajuda: 'Vai ser feito, noutra hora ou noutro turno.' },
  { id: 'outro', label: 'Outro motivo', sinal: true,
    ajuda: 'Escreva o que aconteceu. Um motivo sem explicação não serve a ninguém.' },
]

export const POR_MOTIVO = new Map(MOTIVOS.map(m => [m.id, m]))

export function rotuloMotivo(id: string | null | undefined): string {
  return POR_MOTIVO.get(id as MotivoId)?.label || 'Sem motivo indicado'
}

/** Conta para «o que merece atenção»? */
export function ehSinal(id: string | null | undefined): boolean {
  return POR_MOTIVO.get(id as MotivoId)?.sinal ?? false
}

export interface NaoPrestado {
  id?: string
  patient_id: string
  data: string
  turno?: string | null
  /** A área de permissões a que o cuidado pertence — `registos`, `atividades`,
   *  `medicacao`. É o que decide quem o pode ver. */
  area: string
  /** O que não foi feito, em palavras de quem cuida: «banho», «almoço»,
   *  «ginástica da manhã». */
  o_que: string
  motivo: MotivoId
  nota?: string | null
}

/** A frase que aparece no registo e no resumo à família.
 *
 *  Escrita para ser lida por quem não estava lá: diz o que não aconteceu e
 *  porquê, sem julgar ninguém. */
export function emPalavras(r: Pick<NaoPrestado, 'o_que' | 'motivo' | 'nota'>, nome?: string): string {
  const quem = nome ? nome : 'A pessoa'
  const oQue = (r.o_que || 'o cuidado').toLowerCase()
  const base = {
    recusou: `${quem} não quis ${oQue}.`,
    ausente: `${oQue.charAt(0).toUpperCase() + oQue.slice(1)}: não estava presente.`,
    clinico: `${oQue.charAt(0).toUpperCase() + oQue.slice(1)}: suspenso por indicação clínica.`,
    sem_condicoes: `${oQue.charAt(0).toUpperCase() + oQue.slice(1)}: não houve condições para fazer.`,
    adiado: `${oQue.charAt(0).toUpperCase() + oQue.slice(1)}: ficou para depois.`,
    outro: `${oQue.charAt(0).toUpperCase() + oQue.slice(1)}: não foi feito.`,
  }[r.motivo] || `${oQue}: não foi feito.`

  return r.nota?.trim() ? `${base} ${r.nota.trim()}` : base
}

/**
 * Quantas recusas seguidas da mesma coisa. É o número que transforma um
 * episódio num padrão.
 *
 * Só conta os motivos que são sinal: uma pessoa que faltou três vezes não
 * está a recusar nada.
 */
export function repeticoes(
  registos: Pick<NaoPrestado, 'o_que' | 'motivo' | 'data'>[],
  dias = 14,
): { o_que: string; vezes: number; desde: string }[] {
  const limite = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const porCoisa = new Map<string, { vezes: number; desde: string }>()

  for (const r of registos) {
    if (!ehSinal(r.motivo)) continue
    if (r.data < limite) continue
    const chave = (r.o_que || '').trim().toLowerCase()
    if (!chave) continue
    const atual = porCoisa.get(chave)
    if (!atual) porCoisa.set(chave, { vezes: 1, desde: r.data })
    else porCoisa.set(chave, { vezes: atual.vezes + 1, desde: r.data < atual.desde ? r.data : atual.desde })
  }

  return [...porCoisa.entries()]
    .filter(([, v]) => v.vezes >= 2)
    .map(([o_que, v]) => ({ o_que, ...v }))
    .sort((a, b) => b.vezes - a.vezes)
}
