import { ptDate } from '@/lib/ptTime'

/**
 * As contas do painel, separadas da apresentação.
 *
 * Vivem aqui por duas razões. A primeira é que o painel ficava ilegível com
 * trezentas linhas de `useMemo` pelo meio do JSX. A segunda, e a que interessa:
 * ter as contas num sítio só torna verificável a regra que manda nesta página —
 * nenhum número sai daqui sem um registo por trás.
 *
 * Onde não há dados, as funções devolvem `null` ou listas vazias. Não estimam,
 * não extrapolam de uma amostra pequena, e não devolvem zero a fingir que
 * mediram. Um `null` obriga quem apresenta a decidir o que dizer; um zero
 * mentiroso passa despercebido e vai parar a um ecrã.
 */

/** Uma série de N dias, do mais antigo para o mais recente. */
export type Serie = { data: string; valor: number }[]

/** As últimas N datas (hoje incluído), em hora de Portugal. */
export function ultimosDias(n: number): string[] {
  const hoje = new Date(ptDate() + 'T12:00:00')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

/** Conta linhas por dia e devolve a série alinhada com `dias`. */
export function serieDiaria(linhas: { date?: string }[], dias: string[], filtro?: (l: any) => boolean): Serie {
  const conta: Record<string, number> = {}
  dias.forEach(d => { conta[d] = 0 })
  linhas.forEach(l => {
    if (!l.date || !(l.date in conta)) return
    if (filtro && !filtro(l)) return
    conta[l.date]++
  })
  return dias.map(d => ({ data: d, valor: conta[d] }))
}

/**
 * A curva do dia: quantas tarefas estavam feitas a cada hora.
 *
 * Devolve `null` quando não há um único registo com hora — desenhar uma linha
 * reta no zero e chamar-lhe "ritmo do dia" seria dizer que se mediu quando não
 * se mediu.
 */
export function curvaDoDia(
  registosComHora: { recorded_at?: string | null; created_at?: string | null }[],
  ateHora: number,
): { hora: number; feitas: number }[] | null {
  const horas = registosComHora
    .map(r => r.recorded_at || r.created_at)
    .filter(Boolean)
    .map(t => new Date(t as string).getHours())
  if (!horas.length) return null

  const pontos: { hora: number; feitas: number }[] = []
  for (let h = 7; h <= Math.max(7, Math.min(20, ateHora)); h++) {
    pontos.push({ hora: h, feitas: horas.filter(x => x <= h).length })
  }
  return pontos
}

/**
 * Percentagem de conclusão do dia — só quando há denominador a sério.
 * `devidas === 0` devolve null: sem nada a fazer, "0%" e "100%" são ambos
 * mentira, e o que há a dizer é que não havia nada.
 */
export function percentagemDia(feitas: number, devidas: number): number | null {
  if (!devidas) return null
  return Math.round((feitas / devidas) * 100)
}

/**
 * Média das mesmas horas nos dias anteriores, para servir de comparação.
 * Precisa de pelo menos 3 dias com registos — abaixo disso a "média da casa" é
 * o ruído de dois dias, e apresentá-la como padrão da casa engana.
 */
export function mediaDaCasa(porDia: Record<string, number>, excluir: string): number | null {
  const valores = Object.entries(porDia).filter(([d, v]) => d !== excluir && v > 0).map(([, v]) => v)
  if (valores.length < 3) return null
  return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length)
}
