// lib/estatisticas.ts
// ─────────────────────────────────────────────────────────────────────────────
// As contas da página de estatísticas.
//
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Quero também uma página de estatísticas super completa, quero que tenha IA
//  para organizar.»
//
// ── A LINHA QUE NÃO SE ATRAVESSA ────────────────────────────────────────────
// Os números saem daqui. A IA organiza-os: diz quais interessam agora, por que
// ordem ler, e o que mudou. NUNCA calcula, nunca estima, nunca acrescenta um
// número que não esteja nesta lista.
//
// A rota que fala com a IA verifica isso depois: todo o número que ela escreva
// tem de aparecer nos factos que lhe foram dados, senão o item é descartado.
// Um painel de estatísticas com um número inventado é pior do que não existir
// — leva a decidir com confiança sobre uma coisa que não aconteceu.
//
// ── PORQUE É QUE ISTO NÃO É O PAINEL ADMINISTRATIVO ────────────────────────
// O painel responde «como está a casa hoje». Isto responde «o que mudou nos
// últimos doze meses» — é o que se leva a uma reunião de direção, ao relatório
// anual e à Segurança Social. São perguntas diferentes e os dois números certos
// não se substituem.
//
// ── CADA INDICADOR EXPLICA-SE ───────────────────────────────────────────────
// Todos têm `comoSeCalcula`. Um número que ninguém consegue explicar é um
// número em que ninguém confia — e a primeira vez que alguém o confronta com a
// realidade e não consegue reproduzir a conta, deixa de acreditar no painel
// inteiro.
// ─────────────────────────────────────────────────────────────────────────────

export type Secao = 'movimento' | 'perfil' | 'cuidado' | 'registos' | 'ocorrencias' | 'equipa' | 'dinheiro' | 'familias'

export const SECOES: { id: Secao; rotulo: string; porque: string }[] = [
  { id: 'movimento', rotulo: 'Movimento', porque: 'Quem entrou, quem saiu, quanto tempo fica.' },
  { id: 'perfil', rotulo: 'Quem cá está', porque: 'Idades, dependência e tempo de casa.' },
  { id: 'cuidado', rotulo: 'Cuidado', porque: 'Medicação e o que foi feito.' },
  { id: 'registos', rotulo: 'Registos', porque: 'Quanto do dia a dia fica escrito.' },
  { id: 'ocorrencias', rotulo: 'Ocorrências', porque: 'O que correu mal, e o que se fez depois.' },
  { id: 'equipa', rotulo: 'Equipa', porque: 'Quem registou o quê, e com que carga.' },
  { id: 'dinheiro', rotulo: 'Dinheiro', porque: 'Mensalidades, cobrança e resultado.' },
  { id: 'familias', rotulo: 'Famílias', porque: 'Visitas e conversas com quem espera em casa.' },
]

/** Se subir, é bom, é mau, ou não quer dizer nada? */
export type Sentido = 'subir_bom' | 'subir_mau' | 'neutro'

export type Indicador = {
  id: string
  secao: Secao
  titulo: string
  /** O número, já formatado para se ler. */
  valor: string
  /** O número em cru, para a IA poder comparar e para se ordenar. */
  numero: number | null
  unidade?: string
  /** Doze meses, do mais antigo para o mais recente. `null` = sem dados. */
  serie: (number | null)[]
  sentido: Sentido
  /** Como é que este número se obtém. Sem isto, ninguém confia nele. */
  comoSeCalcula: string
  /** Quando não há registos, o que falta para o haver. */
  vazio?: string
}

/* ── Meses ────────────────────────────────────────────────────────────────── */

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export type Mes = { iso: string; rotulo: string }

/** Os últimos `n` meses, do mais antigo para o mais recente. `iso` = 'AAAA-MM'. */
export function ultimosMeses(n: number, hoje = new Date()): Mes[] {
  const fora: Mes[] = []
  for (let i = n - 1; i >= 0; i--) {
    // Dia 1 de propósito: somar meses a partir do dia 31 salta fevereiro.
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    fora.push({ iso, rotulo: `${MES_CURTO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
  }
  return fora
}

/** Conta linhas por mês, alinhado com `meses`. Um mês sem linhas conta zero. */
export function porMes(
  linhas: any[], campo: string, meses: Mes[], filtro?: (l: any) => boolean,
): number[] {
  const conta = new Map<string, number>()
  for (const l of linhas) {
    if (filtro && !filtro(l)) continue
    const iso = String(l?.[campo] || '').slice(0, 7)
    if (!iso) continue
    conta.set(iso, (conta.get(iso) || 0) + 1)
  }
  return meses.map(m => conta.get(m.iso) || 0)
}

/** Soma um valor por mês (para dinheiro). */
export function somaPorMes(
  linhas: any[], campoData: string, valor: (l: any) => number, meses: Mes[],
): number[] {
  const soma = new Map<string, number>()
  for (const l of linhas) {
    const iso = String(l?.[campoData] || '').slice(0, 7)
    if (!iso) continue
    soma.set(iso, (soma.get(iso) || 0) + (valor(l) || 0))
  }
  return meses.map(m => Math.round(soma.get(m.iso) || 0))
}

/* ── Comparações ──────────────────────────────────────────────────────────── */

export type Comparacao = {
  /** O último mês com dados. */
  agora: number | null
  /** O mês anterior a esse. */
  antes: number | null
  /** Diferença em pontos percentuais do valor anterior. `null` = não dá. */
  variacao: number | null
  /** A média dos meses anteriores, sem contar o último. */
  media: number | null
}

/**
 * Compara o último mês com o anterior e com a média.
 *
 * O mês CORRENTE é excluído de propósito: está a meio, e comparar seis dias de
 * setembro com trinta de agosto dá sempre uma queda que não existe. Foi o
 * primeiro erro que este ficheiro teve.
 */
export function comparar(serie: (number | null)[], mesCorrenteIncompleto = true): Comparacao {
  const uteis = mesCorrenteIncompleto ? serie.slice(0, -1) : serie
  const comValor = uteis.map((v, i) => ({ v, i })).filter(x => x.v !== null) as { v: number; i: number }[]
  if (!comValor.length) return { agora: null, antes: null, variacao: null, media: null }

  const agora = comValor[comValor.length - 1].v
  const antes = comValor.length > 1 ? comValor[comValor.length - 2].v : null
  const anteriores = comValor.slice(0, -1).map(x => x.v)
  const media = anteriores.length
    ? Math.round((anteriores.reduce((s, x) => s + x, 0) / anteriores.length) * 10) / 10
    : null
  const variacao = antes !== null && antes !== 0
    ? Math.round(((agora - antes) / antes) * 100)
    : null
  return { agora, antes, variacao, media }
}

/** A variação em palavras: «+18% desde agosto». `null` quando não há o que dizer. */
export function variacaoEmPalavras(c: Comparacao, meses: Mes[]): string | null {
  if (c.variacao === null || c.agora === null) return null
  if (c.variacao === 0) return 'igual ao mês anterior'
  // O mês a que se compara é o penúltimo com valor, e o rótulo tem de ser o
  // dele — dizer «desde agosto» quando se comparou com julho é pior do que
  // não dizer nada.
  const rotulo = meses[meses.length - 3]?.rotulo || 'o mês anterior'
  return `${c.variacao > 0 ? '+' : ''}${c.variacao}% desde ${rotulo}`
}

/* ── Distribuições ────────────────────────────────────────────────────────── */

export type Faixa = { rotulo: string; valor: number }

/** Reparte uma lista por faixas de um número. Os que não têm valor não contam. */
export function distribuir<T>(
  itens: T[], valorDe: (x: T) => number | null,
  faixas: { rotulo: string; de: number; ate?: number }[],
): { faixas: Faixa[]; contados: number; total: number } {
  const valores = itens.map(valorDe).filter((v): v is number => v !== null)
  return {
    faixas: faixas.map(f => ({
      rotulo: f.rotulo,
      valor: valores.filter(v => v >= f.de && (f.ate === undefined || v <= f.ate)).length,
    })),
    contados: valores.length,
    total: itens.length,
  }
}

/** Reparte por um valor de texto. Devolve por ordem decrescente. */
export function contarPor<T>(itens: T[], chave: (x: T) => string | null): Faixa[] {
  const conta = new Map<string, number>()
  for (const x of itens) {
    const k = chave(x)
    if (!k) continue
    conta.set(k, (conta.get(k) || 0) + 1)
  }
  return [...conta.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor)
}

/* ── Utilitários ──────────────────────────────────────────────────────────── */

export const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null)

export const media = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null

/** A mediana. Resiste a um valor extremo, ao contrário da média. */
export function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : Math.round(((o[m - 1] + o[m]) / 2) * 10) / 10
}

/** Anos completos a partir de 'AAAA-MM-DD'. */
export function anosDesde(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const h = new Date()
  let a = h.getFullYear() - d.getFullYear()
  const m = h.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}

/** Meses completos desde uma data. */
export function mesesDesde(iso?: string | null): number | null {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const h = new Date()
  let m = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth())
  if (h.getDate() < d.getDate()) m--
  return m >= 0 ? m : null
}

const euros = (n: number) => `${n.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} €`

/* ═══════════════════════════════════════════════════════════════════════════
   OS INDICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

export type Dados = {
  utentes: any[]
  arquivados: any[]
  membros: any[]
  tomas: any[]        // mar_records, 12 meses
  registos: any[]     // care_records, 12 meses
  ocorrencias: any[]  // incidents, 12 meses
  atividades: any[]   // activities, 12 meses
  avaliacoes: any[]   // assessments, 12 meses
  mensalidades: any[] // billing_entries, 12 meses
  financas: any[]     // finance_entries, 12 meses
  visitas: any[]      // visit_requests, 12 meses
  mensagens: any[]    // family_thread_messages, 12 meses
  capacidade: number | null
}

const DADA = (t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken'

export function indicadores(d: Dados, meses: Mes[]): Indicador[] {
  const fora: Indicador[] = []
  const total = d.utentes.length
  const add = (i: Indicador) => { fora.push(i) }
  const semNada = (serie: (number | null)[]) => serie.every(v => !v)

  /* ── MOVIMENTO ────────────────────────────────────────────────────────── */
  {
    const entradas = porMes(d.utentes.concat(d.arquivados), 'admission_date', meses)
    add({
      id: 'entradas', secao: 'movimento', titulo: 'Entradas',
      numero: entradas.reduce((s, x) => s + x, 0),
      valor: String(entradas.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: entradas, sentido: 'neutro',
      comoSeCalcula: 'Pessoas com data de entrada em cada mês, incluindo quem já saiu.',
      vazio: semNada(entradas) ? 'Ninguém tem data de entrada preenchida na ficha.' : undefined,
    })

    const saidas = porMes(d.arquivados, 'discharge_date', meses)
    add({
      id: 'saidas', secao: 'movimento', titulo: 'Saídas',
      numero: saidas.reduce((s, x) => s + x, 0),
      valor: String(saidas.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: saidas, sentido: 'neutro',
      comoSeCalcula: 'Pessoas arquivadas com data de saída em cada mês.',
      vazio: semNada(saidas) ? 'Ninguém saiu com data de saída registada.' : undefined,
    })

    const ocupacao = d.capacidade ? pct(total, d.capacidade) : null
    add({
      id: 'lotacao', secao: 'movimento', titulo: 'Lotação',
      numero: ocupacao, valor: ocupacao === null ? '—' : `${ocupacao}%`,
      unidade: d.capacidade ? `${total} de ${d.capacidade}` : undefined,
      serie: [], sentido: 'neutro',
      comoSeCalcula: 'Pessoas ativas a dividir pela capacidade definida em Definições.',
      vazio: ocupacao === null ? 'A capacidade da casa não está definida em Definições.' : undefined,
    })

    // Quanto tempo fica quem já saiu. A mediana e não a média: uma pessoa que
    // esteve dez anos puxa a média toda para cima e esconde o que é normal.
    const permanencias = d.arquivados
      .map(p => {
        if (!p.admission_date || !p.discharge_date) return null
        const a = new Date(String(p.admission_date).slice(0, 10))
        const b = new Date(String(p.discharge_date).slice(0, 10))
        const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
        return m >= 0 ? m : null
      })
      .filter((x): x is number => x !== null)
    const med = mediana(permanencias)
    add({
      id: 'permanencia', secao: 'movimento', titulo: 'Tempo de permanência',
      numero: med, valor: med === null ? '—' : `${med}`,
      unidade: 'meses (mediana)', serie: [], sentido: 'neutro',
      comoSeCalcula: 'Mediana dos meses entre a entrada e a saída, de quem já saiu. Mediana e não média: uma permanência muito longa distorce a média.',
      vazio: med === null ? 'Ainda não saiu ninguém com as duas datas registadas.' : undefined,
    })
  }

  /* ── PERFIL ───────────────────────────────────────────────────────────── */
  {
    const idades = d.utentes.map(p => anosDesde(p.date_of_birth)).filter((x): x is number => x !== null)
    const m = media(idades)
    add({
      id: 'idade_media', secao: 'perfil', titulo: 'Idade média',
      numero: m, valor: m === null ? '—' : `${m}`, unidade: 'anos',
      serie: [], sentido: 'neutro',
      comoSeCalcula: idades.length === total
        ? 'Média das idades de todas as pessoas ativas.'
        : `Média das idades das ${idades.length} pessoas (de ${total}) que têm data de nascimento na ficha.`,
      vazio: m === null ? 'Ninguém tem data de nascimento na ficha.' : undefined,
    })

    const tempos = d.utentes.map(p => mesesDesde(p.admission_date)).filter((x): x is number => x !== null)
    const medT = mediana(tempos)
    add({
      id: 'tempo_de_casa', secao: 'perfil', titulo: 'Tempo de casa',
      numero: medT, valor: medT === null ? '—' : `${medT}`, unidade: 'meses (mediana)',
      serie: [], sentido: 'neutro',
      comoSeCalcula: 'Mediana dos meses desde a entrada, de quem está cá agora.',
      vazio: medT === null ? 'Ninguém tem data de entrada na ficha.' : undefined,
    })

    const mulheres = d.utentes.filter(p => p.sex === 'F').length
    const p = pct(mulheres, d.utentes.filter(x => x.sex).length)
    add({
      id: 'proporcao_mulheres', secao: 'perfil', titulo: 'Mulheres',
      numero: p, valor: p === null ? '—' : `${p}%`,
      unidade: `${mulheres} de ${d.utentes.filter(x => x.sex).length}`,
      serie: [], sentido: 'neutro',
      comoSeCalcula: 'Pessoas com sexo feminino, entre as que têm o campo preenchido.',
      vazio: p === null ? 'Ninguém tem o sexo preenchido na ficha.' : undefined,
    })
  }

  /* ── CUIDADO ──────────────────────────────────────────────────────────── */
  {
    const dadas = porMes(d.tomas, 'date', meses, DADA)
    const marcadas = porMes(d.tomas, 'date', meses)
    const adesao = marcadas.map((n, i) => (n > 0 ? Math.round((dadas[i] / n) * 100) : null))
    const c = comparar(adesao)
    add({
      id: 'adesao', secao: 'cuidado', titulo: 'Adesão à medicação',
      numero: c.agora, valor: c.agora === null ? '—' : `${c.agora}%`,
      unidade: 'do que foi marcado', serie: adesao, sentido: 'subir_bom',
      comoSeCalcula: 'Doses marcadas como dadas a dividir por todas as marcações do mês. Não mede o que nunca foi marcado.',
      vazio: adesao.every(v => v === null) ? 'Ainda não há marcações de medicação.' : undefined,
    })

    const totalDadas = dadas.reduce((s, x) => s + x, 0)
    add({
      id: 'doses', secao: 'cuidado', titulo: 'Doses dadas',
      numero: totalDadas, valor: String(totalDadas), unidade: 'em 12 meses',
      serie: dadas, sentido: 'neutro',
      comoSeCalcula: 'Marcações com estado «dada», por mês.',
      vazio: semNada(dadas) ? 'Ainda não foi marcada nenhuma dose.' : undefined,
    })

    const ativs = porMes(d.atividades, 'date', meses, (a: any) => a.status !== 'cancelled')
    add({
      id: 'atividades', secao: 'cuidado', titulo: 'Atividades',
      numero: ativs.reduce((s, x) => s + x, 0), valor: String(ativs.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: ativs, sentido: 'subir_bom',
      comoSeCalcula: 'Atividades por mês, sem contar as canceladas.',
      vazio: semNada(ativs) ? 'Ainda não há atividades marcadas.' : undefined,
    })

    const avals = porMes(d.avaliacoes, 'date', meses)
    add({
      id: 'avaliacoes', secao: 'cuidado', titulo: 'Avaliações',
      numero: avals.reduce((s, x) => s + x, 0), valor: String(avals.reduce((s, x) => s + x, 0)),
      unidade: 'escalas aplicadas', serie: avals, sentido: 'subir_bom',
      comoSeCalcula: 'Escalas (Barthel, MNA e outras) aplicadas por mês.',
      vazio: semNada(avals) ? 'Ainda não foi aplicada nenhuma escala.' : undefined,
    })
  }

  /* ── REGISTOS ─────────────────────────────────────────────────────────── */
  {
    const regs = porMes(d.registos, 'date', meses)
    add({
      id: 'registos', secao: 'registos', titulo: 'Registos do dia',
      numero: regs.reduce((s, x) => s + x, 0), valor: String(regs.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: regs, sentido: 'subir_bom',
      comoSeCalcula: 'Registos do dia por mês, um por pessoa e turno.',
      vazio: semNada(regs) ? 'Ainda não há registos do dia.' : undefined,
    })

    // A cobertura é o número que importa mais do que o total: mil registos
    // sobre as mesmas cinco pessoas não são cobertura nenhuma.
    const cobertura = meses.map(m => {
      const doMes = d.registos.filter(r => String(r.date || '').startsWith(m.iso))
      if (!doMes.length || !total) return null
      return pct(new Set(doMes.map(r => r.patient_id)).size, total)
    })
    const cc = comparar(cobertura)
    add({
      id: 'cobertura', secao: 'registos', titulo: 'Pessoas com registo',
      numero: cc.agora, valor: cc.agora === null ? '—' : `${cc.agora}%`,
      unidade: 'das pessoas, no mês', serie: cobertura, sentido: 'subir_bom',
      comoSeCalcula: 'Pessoas diferentes com pelo menos um registo no mês, a dividir pelas pessoas ativas. Mil registos sobre cinco pessoas não são cobertura.',
      vazio: cobertura.every(v => v === null) ? 'Ainda não há registos do dia.' : undefined,
    })
  }

  /* ── OCORRÊNCIAS ──────────────────────────────────────────────────────── */
  {
    const ocs = porMes(d.ocorrencias, 'date', meses)
    const c = comparar(ocs)
    add({
      id: 'ocorrencias', secao: 'ocorrencias', titulo: 'Ocorrências',
      numero: ocs.reduce((s, x) => s + x, 0), valor: String(ocs.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: ocs, sentido: 'subir_mau',
      comoSeCalcula: 'Ocorrências registadas por mês, de qualquer tipo.',
      vazio: semNada(ocs) ? 'Nenhuma ocorrência registada. Pode ser bom sinal — ou sinal de que não se registam.' : undefined,
    })

    const quedas = porMes(d.ocorrencias, 'date', meses, (o: any) => /queda|fall/i.test(o.type || ''))
    add({
      id: 'quedas', secao: 'ocorrencias', titulo: 'Quedas',
      numero: quedas.reduce((s, x) => s + x, 0), valor: String(quedas.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: quedas, sentido: 'subir_mau',
      comoSeCalcula: 'Ocorrências cujo tipo menciona queda.',
      vazio: semNada(quedas) ? 'Nenhuma queda registada.' : undefined,
    })

    const fechadas = d.ocorrencias.filter((o: any) => o.status === 'closed').length
    const pf = pct(fechadas, d.ocorrencias.length)
    add({
      id: 'ocorrencias_fechadas', secao: 'ocorrencias', titulo: 'Ocorrências fechadas',
      numero: pf, valor: pf === null ? '—' : `${pf}%`,
      unidade: `${fechadas} de ${d.ocorrencias.length}`, serie: [], sentido: 'subir_bom',
      comoSeCalcula: 'Ocorrências com estado «fechada», sobre o total dos 12 meses.',
      vazio: pf === null ? 'Nenhuma ocorrência registada.' : undefined,
    })
  }

  /* ── EQUIPA ───────────────────────────────────────────────────────────── */
  {
    const marcacoes = [...d.registos, ...d.tomas.filter(DADA)]
    const porQuem = contarPor(marcacoes, (x: any) => x.recorded_by_id || null)
    add({
      id: 'quem_marca', secao: 'equipa', titulo: 'Quem marca',
      numero: porQuem.length, valor: `${porQuem.length}`,
      unidade: `de ${d.membros.length} com acesso`, serie: [], sentido: 'subir_bom',
      comoSeCalcula: 'Pessoas diferentes que marcaram pelo menos um registo ou uma dose em 12 meses.',
      vazio: !porQuem.length ? 'Ninguém marcou nada em 12 meses.' : undefined,
    })

    // Se metade das marcações são de uma pessoa, a casa depende dela.
    const totalMarc = marcacoes.length
    const maior = porQuem[0]?.valor || 0
    const conc = pct(maior, totalMarc)
    add({
      id: 'concentracao', secao: 'equipa', titulo: 'Maior peso numa pessoa',
      numero: conc, valor: conc === null ? '—' : `${conc}%`,
      unidade: 'das marcações', serie: [], sentido: 'subir_mau',
      comoSeCalcula: 'Marcações de quem registou mais, sobre o total. Um valor alto quer dizer que a casa depende muito de uma pessoa.',
      vazio: conc === null ? 'Ninguém marcou nada em 12 meses.' : undefined,
    })
  }

  /* ── DINHEIRO ─────────────────────────────────────────────────────────── */
  {
    const devidoPorMes = somaPorMes(d.mensalidades, 'month',
      (m: any) => (+m.fee || 0) + (+m.extras || 0) - (+m.discount || 0) - (+m.subsidy || 0), meses)
    const totalDevido = devidoPorMes.reduce((s, x) => s + x, 0)
    add({
      id: 'mensalidades', secao: 'dinheiro', titulo: 'Mensalidades',
      numero: totalDevido, valor: euros(totalDevido), unidade: 'em 12 meses',
      serie: devidoPorMes, sentido: 'neutro',
      comoSeCalcula: 'Mensalidade mais extras, menos descontos e comparticipações, somada por mês.',
      vazio: semNada(devidoPorMes) ? 'Ainda não há mensalidades lançadas.' : undefined,
    })

    const pagas = d.mensalidades.filter((m: any) => m.paid)
    const cob = pct(pagas.length, d.mensalidades.length)
    add({
      id: 'cobranca', secao: 'dinheiro', titulo: 'Cobrança',
      numero: cob, valor: cob === null ? '—' : `${cob}%`,
      unidade: `${pagas.length} de ${d.mensalidades.length} pagas`, serie: [], sentido: 'subir_bom',
      comoSeCalcula: 'Mensalidades marcadas como pagas, sobre todas as lançadas nos 12 meses.',
      vazio: cob === null ? 'Ainda não há mensalidades lançadas.' : undefined,
    })

    const receitas = somaPorMes(d.financas.filter((f: any) => f.kind === 'income'), 'date',
      (f: any) => +f.amount || 0, meses)
    const despesas = somaPorMes(d.financas.filter((f: any) => f.kind === 'expense'), 'date',
      (f: any) => +f.amount || 0, meses)
    const resultado = receitas.map((r, i) => r - despesas[i])
    const somaRes = resultado.reduce((s, x) => s + x, 0)
    add({
      id: 'resultado', secao: 'dinheiro', titulo: 'Resultado',
      numero: somaRes, valor: euros(somaRes), unidade: 'em 12 meses',
      serie: resultado, sentido: 'subir_bom',
      comoSeCalcula: 'Receitas menos despesas lançadas, por mês.',
      vazio: !receitas.some(Boolean) && !despesas.some(Boolean)
        ? 'Ainda não há receitas nem despesas lançadas.' : undefined,
    })
  }

  /* ── FAMÍLIAS ─────────────────────────────────────────────────────────── */
  {
    const vis = porMes(d.visitas, 'requested_date', meses,
      (v: any) => v.status !== 'declined' && v.status !== 'cancelled')
    add({
      id: 'visitas', secao: 'familias', titulo: 'Visitas',
      numero: vis.reduce((s, x) => s + x, 0), valor: String(vis.reduce((s, x) => s + x, 0)),
      unidade: 'em 12 meses', serie: vis, sentido: 'subir_bom',
      comoSeCalcula: 'Visitas marcadas por mês, sem contar as recusadas nem as canceladas.',
      vazio: semNada(vis) ? 'Ainda não há visitas marcadas.' : undefined,
    })

    const msgs = porMes(d.mensagens, 'created_at', meses)
    add({
      id: 'mensagens_familia', secao: 'familias', titulo: 'Conversas com famílias',
      numero: msgs.reduce((s, x) => s + x, 0), valor: String(msgs.reduce((s, x) => s + x, 0)),
      unidade: 'mensagens em 12 meses', serie: msgs, sentido: 'subir_bom',
      comoSeCalcula: 'Mensagens trocadas no canal da família, por mês, nos dois sentidos.',
      vazio: semNada(msgs) ? 'Ainda não há conversas com famílias.' : undefined,
    })
  }

  return fora
}

/**
 * Os factos que se mandam à IA.
 *
 * Só números e rótulos, já calculados. Nenhum nome de pessoa, nenhum
 * diagnóstico, nenhuma linha de registo — a IA não precisa deles para
 * organizar, e mandá-los era mandar dados clínicos para fora sem motivo.
 */
export function factosParaIA(is: Indicador[], meses: Mes[]): string[] {
  return is
    .filter(i => !i.vazio && i.numero !== null)
    .map(i => {
      const c = comparar(i.serie)
      const variou = variacaoEmPalavras(c, meses)
      const partes = [
        `${i.titulo}: ${i.valor}${i.unidade ? ` (${i.unidade})` : ''}`,
        variou ? `variação: ${variou}` : null,
        c.media !== null ? `média dos meses anteriores: ${c.media}` : null,
        `se subir é ${i.sentido === 'subir_bom' ? 'bom' : i.sentido === 'subir_mau' ? 'mau' : 'indiferente'}`,
      ].filter(Boolean)
      return partes.join(' · ')
    })
}

/**
 * Todos os números que aparecem nos factos, para se poder verificar depois se
 * a IA inventou algum.
 *
 * É esta lista que impede uma frase como «as quedas subiram 30%» quando a
 * subida foi de 12%. Um painel de estatísticas com um número inventado é pior
 * do que não existir.
 */
export function numerosPermitidos(factos: string[]): Set<string> {
  const fora = new Set<string>()
  for (const f of factos) {
    for (const m of f.matchAll(/-?\d+(?:[.,]\d+)?/g)) {
      fora.add(m[0].replace(',', '.'))
    }
  }
  return fora
}

/** Os números de um texto que não constam dos factos dados. */
export function numerosInventados(texto: string, permitidos: Set<string>): string[] {
  const fora: string[] = []
  for (const m of String(texto || '').matchAll(/-?\d+(?:[.,]\d+)?/g)) {
    const n = m[0].replace(',', '.')
    // Os anos e os números de um a doze passam: são meses, contagens pequenas
    // e datas que aparecem em qualquer frase sem serem uma estatística.
    if (/^(19|20)\d\d$/.test(n)) continue
    if (Math.abs(+n) <= 12) continue
    if (!permitidos.has(n) && !fora.includes(n)) fora.push(n)
  }
  return fora
}
