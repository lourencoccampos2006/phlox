// lib/equipaRh.ts
// ─────────────────────────────────────────────────────────────────────────────
// A formação e as ausências de cada funcionário.
//
// ── AS DUAS PERGUNTAS QUE ISTO RESPONDE ────────────────────────────────────
// Da pesquisa ao Ankira (módulo de Recursos Humanos) e do que a ASAE verifica
// antes de olhar para o plano HACCP — a formação dos colaboradores.
//
// 1. «Quem tem formação por renovar?» O suporte básico de vida renova-se, a
//    higiene alimentar renova-se. Um certificado caducado é a primeira coisa
//    que uma inspeção pede e a última de que alguém se lembra.
//
// 2. «Quando é que ela volta?» O `team_members.status` diz `vacation`, e mais
//    nada — nem desde quando, nem até quando. E tem de ser desligado à mão:
//    quem volta de férias e ninguém mexe no campo fica de férias para sempre.
//
// ── UMA AUSÊNCIA RESOLVE-SE SOZINHA ────────────────────────────────────────
// É a diferença entre um estado e um intervalo. Com início e fim, no dia a
// seguir ao fim a pessoa está cá outra vez sem ninguém ter de fazer nada — e a
// escala da semana que vem conta com ela.
// ─────────────────────────────────────────────────────────────────────────────

import { ptDate } from './ptTime'
// A aritmética de intervalos vive em `lib/periodo`, partilhada com as
// ausências dos UTENTES. Duas implementações do mesmo «está fora neste dia?»
// acabam por discordar num limite — e o erro é invisível: põe alguém na
// escala no dia em que está de férias.
import { dentroDoPeriodo, diasNoIntervalo, diasEntre } from './periodo'

export type TipoAusencia = 'ferias' | 'baixa' | 'falta' | 'licenca' | 'formacao' | 'outro'

export interface Formacao {
  id: string
  team_member_id: string
  tema: string
  data: string
  horas: number | null
  formador: string | null
  entidade: string | null
  /** Null = não caduca. Uma licenciatura não caduca; o suporte de vida sim. */
  valida_ate: string | null
  notas: string | null
}

export interface Ausencia {
  id: string
  team_member_id: string
  tipo: TipoAusencia
  inicio: string
  /** Null = ainda sem data de regresso. */
  fim: string | null
  motivo: string | null
  notas: string | null
}

export const TIPOS_AUSENCIA: { id: TipoAusencia; label: string; cor: string }[] = [
  { id: 'ferias',   label: 'Férias',   cor: '#5a6d7c' },
  { id: 'baixa',    label: 'Baixa',    cor: '#a1544c' },
  { id: 'falta',    label: 'Falta',    cor: '#7a5f70' },
  { id: 'licenca',  label: 'Licença',  cor: '#6b6a80' },
  { id: 'formacao', label: 'Formação', cor: '#5f7161' },
  { id: 'outro',    label: 'Outro',    cor: '#7c6f5a' },
]

export const ROTULO_AUSENCIA: Record<TipoAusencia, string> =
  Object.fromEntries(TIPOS_AUSENCIA.map(t => [t.id, t.label])) as Record<TipoAusencia, string>

/** Dias até uma data. Negativo quando já passou. */
export const diasAte = (data: string, hoje = ptDate()): number => diasEntre(hoje, data)

// ─────────────────────────────────────────────────────────────────────────────
// FORMAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoFormacao = 'valida' | 'a_caducar' | 'caducada' | 'sem_validade'

/**
 * Em que estado está este certificado?
 *
 * `sem_validade` NÃO é «válida para sempre» escrito de outra maneira: é
 * «ninguém disse quando caduca». A diferença importa — tratar as duas como a
 * mesma coisa daria por conforme um certificado cuja validade nunca foi
 * preenchida, que é precisamente o que uma inspeção apanha.
 *
 * @param aviso  Com quantos dias de antecedência é que uma formação passa a
 *               «a caducar». 60 por omissão: tempo de marcar e de a fazer.
 */
export function estadoDaFormacao(f: Pick<Formacao, 'valida_ate'>, hoje = ptDate(), aviso = 60): EstadoFormacao {
  if (!f.valida_ate) return 'sem_validade'
  const d = diasAte(f.valida_ate, hoje)
  if (d < 0) return 'caducada'
  if (d <= aviso) return 'a_caducar'
  return 'valida'
}

export interface FormacaoEmRisco {
  formacao: Formacao
  estado: Exclude<EstadoFormacao, 'valida' | 'sem_validade'>
  dias: number
}

/**
 * O que está caducado ou prestes a caducar, pior primeiro.
 *
 * ── SÓ A MAIS RECENTE DE CADA TEMA CONTA ───────────────────────────────────
 * Quem fez o suporte básico de vida em 2023 e outra vez em 2026 tem duas
 * linhas, e a de 2023 está caducada. Contá-la como um risco diria que a pessoa
 * está em falta quando está em dia — e uma lista com falsos alarmes deixa de
 * ser lida ao fim de uma semana.
 */
export function formacoesEmRisco(
  formacoes: Formacao[], hoje = ptDate(), aviso = 60,
): FormacaoEmRisco[] {
  // A mais recente por pessoa + tema. O tema compara-se sem maiúsculas nem
  // espaços a mais: «Suporte Básico de Vida» e «suporte básico de vida» são a
  // mesma formação escrita por duas pessoas diferentes.
  const maisRecente = new Map<string, Formacao>()
  for (const f of formacoes) {
    const chave = `${f.team_member_id}|${f.tema.trim().toLowerCase()}`
    const atual = maisRecente.get(chave)
    if (!atual || f.data > atual.data) maisRecente.set(chave, f)
  }

  return [...maisRecente.values()]
    .map(formacao => ({ formacao, estado: estadoDaFormacao(formacao, hoje, aviso), dias: formacao.valida_ate ? diasAte(formacao.valida_ate, hoje) : 0 }))
    .filter((x): x is FormacaoEmRisco => x.estado === 'caducada' || x.estado === 'a_caducar')
    .sort((a, b) => a.dias - b.dias)
}

// ─────────────────────────────────────────────────────────────────────────────
// AUSÊNCIAS
// ─────────────────────────────────────────────────────────────────────────────

/** Esta pessoa está fora neste dia? */
export const estaFora = (a: Ausencia, dia = ptDate()): boolean => dentroDoPeriodo(a, dia)

/** Quem está fora num dia, com a razão. */
export function ausenciasNoDia(ausencias: Ausencia[], dia = ptDate()): Ausencia[] {
  return ausencias.filter(a => estaFora(a, dia))
}

/** «De férias até 12/08» / «De baixa, sem data de regresso». */
export function ausenciaEmPalavras(a: Ausencia): string {
  const rotulo = ROTULO_AUSENCIA[a.tipo] || 'Ausente'
  const de = a.tipo === 'ferias' ? 'De férias' : a.tipo === 'baixa' ? 'De baixa' : rotulo
  if (!a.fim) return `${de}, sem data de regresso`
  return `${de} até ${a.fim.split('-').reverse().join('/')}`
}

/**
 * Quantos dias de ausência num intervalo.
 *
 * Conta dias de calendário, e diz-se aqui porque não é óbvio: não desconta
 * fins de semana nem feriados. Para contar dias ÚTEIS seria preciso saber a
 * escala de cada pessoa — e uma auxiliar que trabalha ao domingo tem um
 * calendário diferente do de quem está no escritório. Um número que parece
 * exacto e não é vale menos do que um que se sabe aproximado.
 */
export const diasDeAusencia = (a: Ausencia, de: string, ate: string): number =>
  diasNoIntervalo(a, de, ate)

/** O resumo de uma linha, para o topo da ficha. */
export function resumoDoFuncionario(
  formacoes: Formacao[], ausencias: Ausencia[], hoje = ptDate(),
): string {
  const risco = formacoesEmRisco(formacoes, hoje)
  const fora = ausenciasNoDia(ausencias, hoje)

  const partes: string[] = []
  if (fora.length) partes.push(ausenciaEmPalavras(fora[0]).toLowerCase())
  const caducadas = risco.filter(r => r.estado === 'caducada').length
  const aCaducar = risco.filter(r => r.estado === 'a_caducar').length
  if (caducadas) partes.push(`${caducadas} ${caducadas === 1 ? 'formação caducada' : 'formações caducadas'}`)
  if (aCaducar) partes.push(`${aCaducar} a caducar`)

  if (!partes.length) {
    return formacoes.length
      ? `${formacoes.length} ${formacoes.length === 1 ? 'formação registada' : 'formações registadas'}, tudo em dia.`
      : 'Sem formação registada.'
  }
  // Primeira letra maiúscula, sem inventar pontuação a meio.
  const frase = partes.join(' · ')
  return frase.charAt(0).toUpperCase() + frase.slice(1) + '.'
}
