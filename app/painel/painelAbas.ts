// app/painel/painelAbas.ts
// ─────────────────────────────────────────────────────────────────────────────
// Os cinco separadores do painel, montados a partir de registos reais.
//
// ── A REGRA QUE MANDA AQUI ────────────────────────────────────────────────
// Nenhum número sai deste ficheiro sem uma linha de base de dados por trás.
// Onde não há dados, o bloco devolve `vazio` com uma frase que diz o que falta
// — não estima, não extrapola de dois dias, não devolve zero a fingir que
// mediu. Um gráfico bem desenhado sobre dados inventados é a pior coisa que
// este produto pode fazer: é num painel destes que alguém decide sobre pessoas.
//
// A única conta que não é uma contagem direta é a adesão à medicação, e está
// assinalada onde aparece: as doses PREVISTAS saem do horário atual de cada
// medicamento (patient_meds.shifts) multiplicado pelos dias decorridos. É uma
// aproximação — não sabe se um fármaco só foi acrescentado a meio do mês — e
// por isso a nota do número di-lo. A alternativa (dadas ÷ registos existentes)
// dá sempre ~100%, porque uma dose falhada nunca cria linha nenhuma.
// ─────────────────────────────────────────────────────────────────────────────

import type { Kpi, DadosLinha, DadosBarras, DadosRosca, DadosTabela, DadosLista } from './painelPecas'
import { ultimosDias } from '@/lib/painelDados'
import { ptDate } from '@/lib/ptTime'

export type AbaId = 'hoje' | 'cuidados' | 'pessoas' | 'equipa' | 'gestao'

export const ABAS: { id: AbaId; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'cuidados', label: 'Cuidados' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'equipa', label: 'Equipa' },
  { id: 'gestao', label: 'Gestão' },
]

export type Aba = {
  eyebrow: string
  headline: string
  acoes: { label: string; href: string; primaria?: boolean }[]
  kpis: Kpi[]
  linha: DadosLinha
  barras: DadosBarras
  rosca: DadosRosca
  tabela: DadosTabela
  lista: DadosLista
}

/* ── Dados em bruto, tal como saem das consultas ──────────────────────────── */

export type Base = {
  utentes: any[]; registos: any[]; tomas: any[]; meds: any[]
  presencas: any[]; atividades: any[]; ocorrencias: any[]; familia: any[]
  hist: { tomas: any[]; registos: any[]; presencas: any[] }
}
export type CruCuidados = { mar30: any[]; care30: any[]; feridas: any[]; avaliacoes: any[]; inc90: any[] }
export type CruPessoas = { msgs: any[]; visitas: any[] }
export type CruEquipa = { membros: any[]; escala: any[]; recados: any[]; care7: any[] }
export type CruGestao = { org: any | null; mensalidades: any[]; financas: any[]; entradas: any[]; avalMes: any[] }

/* ── Utilitários de conta ─────────────────────────────────────────────────── */

const DADA = (t: any) => t.status === 'administered' || t.status === 'given' || t.status === 'taken'
const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null)
/** "1 toma" / "3 tomas" — a concordância feita uma vez, em vez de espalhada. */
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`
/** Como se chamam as pessoas desta casa: "Residente"/"Residentes". */
export type Nomes = { um: string; muitos: string }
const eur = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} mil` : String(Math.round(v)))

/** Doses previstas por dia pelo horário de cada medicamento ativo. */
const dosesPorDia = (meds: any[]) =>
  meds.reduce((s, m) => s + (Array.isArray(m.shifts) && m.shifts.length ? m.shifts.length : 1), 0)

/** As últimas N chaves 'YYYY-MM', da mais antiga para a mais recente. */
function ultimosMeses(n: number): string[] {
  const hoje = new Date(ptDate() + 'T12:00:00')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (n - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const rotuloDia = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MES_CURTO[d.getMonth()]}`
}
const rotuloMes = (ym: string) => MES_CURTO[Number(ym.slice(5, 7)) - 1] || ym

/** Seis rótulos espaçados por igual, para o eixo do gráfico de linha. */
function seisRotulos(chaves: string[], formata: (k: string) => string): string[] {
  if (chaves.length <= 6) return chaves.map(formata)
  const passo = (chaves.length - 1) / 5
  return Array.from({ length: 6 }, (_, i) => formata(chaves[Math.round(i * passo)]))
}

/** Série diária de contagens, alinhada com `dias`. */
function porDia(linhas: any[], dias: string[], campo = 'date', filtro?: (l: any) => boolean): number[] {
  const conta: Record<string, number> = {}
  dias.forEach(d => { conta[d] = 0 })
  linhas.forEach(l => {
    const d = String(l?.[campo] || '').slice(0, 10)
    if (!(d in conta)) return
    if (filtro && !filtro(l)) return
    conta[d]++
  })
  return dias.map(d => conta[d])
}

/** O índice da barra mais alta — a que leva a cor da casa quando as barras são
 *  categorias e não uma linha do tempo. */
const maiorIndice = (itens: { valor: number }[]) =>
  itens.reduce((melhor, it, i) => (it.valor > itens[melhor].valor ? i : melhor), 0)

/** Contagens por dia da semana (Seg→Dom), a partir de um campo de data. */
function porDiaSemana(linhas: any[], campo = 'date', filtro?: (l: any) => boolean) {
  const balde = [0, 0, 0, 0, 0, 0, 0] // índice 0 = Segunda
  linhas.forEach(l => {
    const bruto = String(l?.[campo] || '')
    if (!bruto) return
    if (filtro && !filtro(l)) return
    const d = new Date(bruto.length === 10 ? bruto + 'T12:00:00' : bruto)
    if (isNaN(d.getTime())) return
    balde[(d.getDay() + 6) % 7]++
  })
  return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((rotulo, i) => ({ rotulo, valor: balde[i], teto: Math.max(1, ...balde) }))
}

/** Curva acumulada por hora (7h→`ate`): quantas linhas estavam feitas a cada hora. */
function curvaHoras(linhas: any[], ate: number, campo = 'recorded_at'): { horas: number[]; valores: number[] } {
  const fim = Math.max(8, Math.min(21, ate))
  const horas: number[] = []
  for (let h = 7; h <= fim; h++) horas.push(h)
  const marcas = linhas
    .map(l => l?.[campo] || l?.created_at)
    .filter(Boolean)
    .map(t => new Date(t as string).getHours())
    .filter(h => !isNaN(h))
  return { horas, valores: horas.map(h => marcas.filter(x => x <= h).length) }
}

/* ── Separador: Hoje ─────────────────────────────────────────────────────── */

export function abaHoje(b: Base, casa: string, nomePessoa: string, saudacao: string, nomes: Nomes): Aba {
  const total = b.utentes.length
  const devidas = dosesPorDia(b.meds)
  const dadas = b.tomas.filter(DADA).length
  const comRegisto = new Set(b.registos.map(r => r.patient_id)).size
  const presentes = b.presencas.filter(a => a.status === 'present').length
  const porChegar = b.presencas.filter(a => a.status === 'expected' || a.status === 'pending').length
  const ausentes = b.presencas.filter(a => a.status === 'absent').length

  const ultimaPorUtente = new Map<string, string>()
  b.familia.forEach(m => { if (!ultimaPorUtente.has(m.patient_id)) ultimaPorUtente.set(m.patient_id, m.author_side) })
  const familiasEspera = [...ultimaPorUtente.values()].filter(s => s === 'family').length

  const faltamTomas = Math.max(0, devidas - dadas)
  const faltamRegistos = Math.max(0, total - comRegisto)
  const dias = ultimosDias(7)

  // A frase de topo. Concorda com o que falta mesmo; sem nada em falta, di-lo.
  const nada = faltamTomas === 0 && faltamRegistos === 0
  const verbo = (faltamTomas > 0 && faltamRegistos > 0) || faltamTomas > 1 || faltamRegistos > 1 ? 'Faltam' : 'Falta'
  const pedacos: string[] = []
  if (faltamTomas > 0) pedacos.push(plural(faltamTomas, 'toma', 'tomas'))
  if (faltamRegistos > 0) pedacos.push(`${plural(faltamRegistos, 'registo', 'registos')} do dia`)
  const headline = nada
    ? `Está tudo em dia${nomePessoa ? `, ${nomePessoa}` : ''}.`
    : `${saudacao}${nomePessoa ? `, ${nomePessoa}` : ''}. ${verbo} ${pedacos.join(' e ')}.`

  // O ritmo do dia e o da casa, ambos de registos com hora.
  const agora = new Date().getHours()
  const hoje = curvaHoras(b.tomas.filter(DADA), agora)
  const diasAnteriores = dias.slice(0, -1)
  const curvaCasa = hoje.horas.map(h => {
    const porDiaAnterior = diasAnteriores.map(d => {
      const doDia = b.hist.tomas.filter((t: any) => String(t.date).slice(0, 10) === d && DADA(t))
      return doDia.filter((t: any) => t.recorded_at && new Date(t.recorded_at).getHours() <= h).length
    }).filter(v => v > 0)
    return porDiaAnterior.length ? porDiaAnterior.reduce((s, v) => s + v, 0) / porDiaAnterior.length : 0
  })
  const temCasa = curvaCasa.some(v => v > 0)
  const semHoras = hoje.valores.every(v => v === 0)

  // Tomas por horário, dos `recorded_at` reais.
  const balde: Record<string, number> = { '08h': 0, '10h': 0, '12h': 0, '14h': 0, '16h': 0, '18h': 0 }
  b.tomas.forEach(t => {
    if (!t.recorded_at || !DADA(t)) return
    const h = new Date(t.recorded_at).getHours()
    const k = h < 9 ? '08h' : h < 11 ? '10h' : h < 13 ? '12h' : h < 15 ? '14h' : h < 17 ? '16h' : '18h'
    balde[k]++
  })
  const maxBalde = Math.max(1, ...Object.values(balde))
  // A barra destacada é a faixa horária onde estamos agora, não a última do dia.
  const faixaAgora = Math.max(0, Object.keys(balde).indexOf(
    agora < 9 ? '08h' : agora < 11 ? '10h' : agora < 13 ? '12h' : agora < 15 ? '14h' : agora < 17 ? '16h' : '18h'))

  // Por fazer, por utente.
  const medsPorUtente = new Map<string, any[]>()
  b.meds.forEach(m => { const a = medsPorUtente.get(m.patient_id) || []; a.push(m); medsPorUtente.set(m.patient_id, a) })
  const dadasPorUtente = new Map<string, number>()
  b.tomas.filter(DADA).forEach(t => dadasPorUtente.set(t.patient_id, (dadasPorUtente.get(t.patient_id) || 0) + 1))
  const comOcorrencia = new Set(b.ocorrencias.map(o => o.patient_id))
  const jaRegistado = new Set(b.registos.map(r => r.patient_id))

  const pendencias = b.utentes.map(u => {
    const seus = medsPorUtente.get(u.id) || []
    const suasDevidas = dosesPorDia(seus)
    const suasDadas = Math.min(suasDevidas, dadasPorUtente.get(u.id) || 0)
    const faltam = suasDevidas - suasDadas
    const semRegisto = !jaRegistado.has(u.id)
    const partes: string[] = []
    if (faltam > 0) partes.push(seus.slice(0, 2).map(m => m.name).filter(Boolean).join(' · ') || `${faltam} tomas`)
    if (semRegisto) partes.push('registo do dia por fazer')
    return {
      id: u.id, href: `/patients/${u.id}`, a: u.name as string, b: partes.join(' · '),
      barra: suasDevidas ? Math.round((suasDadas / suasDevidas) * 100) : semRegisto ? 0 : 100,
      c: suasDevidas ? `${suasDadas}/${suasDevidas}` : '—',
      etiqueta: comOcorrencia.has(u.id) ? 'ocorrência' : faltam > 0 ? 'vigiar' : '',
      destaque: comOcorrencia.has(u.id) || faltam > 1,
      _falta: faltam,
    }
  }).filter(p => p.b)
    .sort((x, y) => (Number(y.destaque) - Number(x.destaque)) || (y._falta - x._falta))
    .slice(0, 6)

  return {
    eyebrow: `Painel · ${casa} · ${plural(total, nomes.um.toLowerCase(), nomes.muitos.toLowerCase())}`,
    headline,
    acoes: [{ label: 'Dar medicação', href: '/mar' }, { label: 'Abrir ronda', href: '/ronda-guiada', primaria: true }],
    kpis: [
      { etiqueta: 'Presentes', valor: presentes, de: `/${total}`, serie: porDia(b.hist.presencas, dias, 'date', (a: any) => a.status === 'present'),
        nota: porChegar ? `${porChegar} por chegar` : b.presencas.length ? 'Chegadas todas marcadas' : 'Presenças por marcar' },
      { etiqueta: 'Tomas dadas', valor: dadas, de: `/${devidas}`, serie: porDia(b.hist.tomas, dias, 'date', DADA),
        nota: faltamTomas ? `${faltamTomas} por dar` : devidas ? 'Nada em falta' : 'Sem medicação prescrita' },
      { etiqueta: 'Registos do dia', valor: comRegisto, de: `/${total}`, serie: porDia(b.hist.registos, dias),
        nota: faltamRegistos ? `${faltamRegistos} por fazer` : 'Todos feitos' },
      { etiqueta: 'A vigiar', valor: b.ocorrencias.length, serie: [], alerta: b.ocorrencias.length > 0,
        nota: b.ocorrencias.length ? 'Ocorrências em aberto' : 'Sem ocorrências em aberto' },
      { etiqueta: 'Famílias', valor: familiasEspera, serie: [], alerta: familiasEspera > 0,
        nota: familiasEspera ? 'À espera de resposta' : 'Sem mensagens por responder' },
    ],
    linha: {
      titulo: 'Ritmo do dia · tomas dadas',
      valor: devidas ? `${pct(dadas, devidas)}%` : `${dadas}`,
      delta: devidas ? `${faltamTomas} por dar` : null, deltaBom: faltamTomas === 0,
      a: hoje.valores, b: temCasa ? curvaCasa : null,
      etiquetas: seisRotulos(hoje.horas.map(String), h => `${String(h).padStart(2, '0')}h`),
      legendaA: 'hoje', legendaB: temCasa ? 'média da casa' : null,
      vazio: semHoras ? 'Ainda não há tomas com hora registada hoje. A curva desenha-se à medida que a equipa marca.' : undefined,
    },
    barras: {
      titulo: 'Tomas por horário',
      itens: Object.entries(balde).map(([rotulo, valor]) => ({ rotulo, valor, teto: maxBalde })),
      destaque: faixaAgora,
      rodape: dadas ? 'As horas saem do momento em que a equipa marcou cada toma.' : '',
      vazio: dadas ? undefined : 'Sem tomas registadas hoje. O gráfico enche-se à medida que a equipa marca.',
    },
    rosca: {
      titulo: 'Presenças', grande: String(presentes), unidade: `de ${total}`,
      a: presentes, b: porChegar, total: Math.max(1, total),
      legenda: [
        { rotulo: 'Presentes', valor: String(presentes), cor: 'var(--accent)' },
        { rotulo: 'Por chegar', valor: String(porChegar), cor: '#8e939c' },
        { rotulo: 'Ausentes', valor: String(ausentes), cor: 'var(--bg-3)' },
      ],
      vazio: b.presencas.length ? undefined : 'Ainda ninguém marcou presenças hoje.',
    },
    tabela: {
      titulo: 'Por fazer', rodape: pendencias.length ? 'ocorrências primeiro' : '',
      cols: 'minmax(0,1.3fr) minmax(0,1.4fr) minmax(0,1fr) 96px',
      cabecalho: ['Utente', 'O que falta', 'Progresso', 'Estado'],
      linhas: pendencias.map(({ _falta, ...r }) => r),
      vazio: pendencias.length ? undefined : 'Nada por fazer: todas as tomas dadas e todos os registos do dia feitos.',
    },
    lista: {
      titulo: 'A seguir', contagem: b.atividades.length ? `${b.atividades.length} marcadas` : '',
      itens: b.atividades.slice(0, 4).map((a: any) => ({
        id: a.id, icone: 'target',
        titulo: `${a.title}${a.start_time ? ` às ${String(a.start_time).slice(0, 5)}` : ''}`,
        sub: a.type ? String(a.type) : 'Atividade do dia',
        cta: 'Abrir', href: '/activities',
      })),
      vazio: b.atividades.length ? undefined : 'Sem atividades marcadas para hoje.',
    },
  }
}

/* ── Separador: Cuidados ─────────────────────────────────────────────────── */

export function abaCuidados(b: Base, c: CruCuidados | null, casa: string): Aba {
  const total = b.utentes.length
  const dias = ultimosDias(30)
  const emFalta = (t: string) => ({ vazio: t })

  if (!c) return esqueleto('Cuidados', casa, total, 'A carregar os últimos 30 dias…')

  const dadas30 = c.mar30.filter(DADA).length
  const porDiaDoses = dosesPorDia(b.meds)
  const previstas30 = porDiaDoses * dias.length
  const adesao = pct(Math.min(dadas30, previstas30), previstas30)

  // Refeições de hoje: 0–100 por refeição, em care_records.nutrition.
  const refeicaoMedia = (r: any): number | null => {
    const n = r?.nutrition || {}
    const vals = [n.breakfast, n.lunch, n.dinner].filter((v: any) => typeof v === 'number')
    return vals.length ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : null
  }
  const comRefeicao = b.registos.map(refeicaoMedia).filter((v): v is number => v != null)
  const comeuTudo = comRefeicao.filter(v => v >= 75).length
  const comeuMetade = comRefeicao.filter(v => v >= 25 && v < 75).length
  const comeuPouco = comRefeicao.filter(v => v < 25).length
  const refPct = pct(comeuTudo, comRefeicao.length)

  const comLiquidos = b.registos.filter((r: any) => Number(r?.nutrition?.fluid_ml) > 0).length
  const hidratacao = pct(comLiquidos, total)

  const feridasAtivas = c.feridas.filter((w: any) => w.status !== 'healed').length

  // Adesão dia a dia: doses dadas por dia contra as previstas pelo horário.
  const serieDadas = porDia(c.mar30, dias, 'date', DADA)
  const serieAdesao = serieDadas.map(v => (porDiaDoses ? Math.min(100, Math.round((v / porDiaDoses) * 100)) : 0))
  const mediaSerie = serieAdesao.filter(v => v > 0)
  const media = mediaSerie.length >= 3 ? Math.round(mediaSerie.reduce((s, v) => s + v, 0) / mediaSerie.length) : null

  // Utentes a vigiar: quem tem ocorrência recente, ferida aberta ou avaliação vencida.
  const nomePorId = new Map(b.utentes.map(u => [u.id, u.name as string]))
  const sinal = new Map<string, string[]>()
  c.inc90.forEach((i: any) => {
    const a = sinal.get(i.patient_id) || []; a.push(`${i.type || 'ocorrência'}${i.date ? ` a ${rotuloDia(String(i.date).slice(0, 10))}` : ''}`); sinal.set(i.patient_id, a)
  })
  c.feridas.filter((w: any) => w.status !== 'healed').forEach((w: any) => {
    const a = sinal.get(w.patient_id) || []; a.push(`ferida ${w.stage ? `grau ${w.stage}` : 'em curso'}`); sinal.set(w.patient_id, a)
  })
  const vigiar = [...sinal.entries()]
    .filter(([id]) => nomePorId.has(id))
    .map(([id, sinais]) => ({
      id, href: `/patients/${id}`, a: nomePorId.get(id) || '—', b: sinais.slice(0, 2).join(' · '),
      barra: null, c: String(sinais.length), etiqueta: sinais.length > 1 ? 'vigiar' : '',
      destaque: sinais.length > 1,
    }))
    .sort((x, y) => Number(y.c) - Number(x.c))
    .slice(0, 6)

  // Avaliações vencidas: mais de 180 dias desde a última do mesmo tipo.
  const ESCALAS: Record<string, string> = { barthel: 'Barthel', mna: 'MNA', braden: 'Braden', morse: 'Morse', mmse: 'MMSE' }
  const ultima = new Map<string, string>()
  c.avaliacoes.forEach((a: any) => {
    const k = `${a.patient_id}|${a.scale}`
    if (!ultima.has(k) || String(a.date) > (ultima.get(k) as string)) ultima.set(k, String(a.date))
  })
  const limite = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  const vencidas = [...ultima.entries()]
    .filter(([k, d]) => d < limite && nomePorId.has(k.split('|')[0]))
    .map(([k, d]) => {
      const [pid, escala] = k.split('|')
      return {
        id: k, icone: 'clipboard',
        titulo: `${ESCALAS[escala] || escala} · ${nomePorId.get(pid)}`,
        sub: `Última a ${rotuloDia(d)}.`, cta: 'Avaliar', href: `/patients/${pid}`,
      }
    })
    .slice(0, 4)

  const semanaOcorrencias = porDiaSemana(c.inc90, 'date')

  return {
    eyebrow: `Cuidados · ${casa} · últimos 30 dias`,
    headline: adesao != null
      ? `A adesão à medicação está em ${adesao}%${c.inc90.length ? ` e há ${plural(c.inc90.length, 'ocorrência registada', 'ocorrências registadas')} em 90 dias` : ', sem ocorrências em 90 dias'}.`
      : 'Ainda não há medicação prescrita para medir adesão.',
    acoes: [{ label: 'Ocorrências', href: '/incidents' }, { label: 'Nova avaliação', href: '/assessments', primaria: true }],
    kpis: [
      { etiqueta: 'Adesão', valor: adesao != null ? adesao : '—', de: adesao != null ? '%' : undefined,
        serie: serieAdesao.slice(-10), nota: adesao != null ? 'sobre o horário atual' : 'sem medicação prescrita' },
      { etiqueta: 'Refeições', valor: refPct != null ? refPct : '—', de: refPct != null ? '%' : undefined,
        serie: [], nota: comRefeicao.length ? `${comRefeicao.length} de ${total} com registo hoje` : 'sem registo de refeições hoje' },
      { etiqueta: 'Hidratação', valor: hidratacao != null ? hidratacao : '—', de: hidratacao != null ? '%' : undefined,
        serie: [], nota: comLiquidos ? `${comLiquidos} com líquidos registados` : 'sem líquidos registados hoje' },
      { etiqueta: 'Ocorrências', valor: c.inc90.length, de: '/90d', serie: [], alerta: b.ocorrencias.length > 0,
        nota: b.ocorrencias.length ? `${b.ocorrencias.length} ainda em aberto` : 'nenhuma em aberto' },
      { etiqueta: 'Feridas ativas', valor: feridasAtivas, serie: [], alerta: feridasAtivas > 0,
        nota: feridasAtivas ? 'em acompanhamento' : 'nenhuma em acompanhamento' },
    ],
    linha: {
      titulo: 'Adesão à medicação · 30 dias',
      valor: adesao != null ? `${adesao}%` : '—',
      delta: media != null ? `média ${media}%` : null, deltaBom: adesao != null && media != null && adesao >= media,
      a: serieAdesao, b: null,
      etiquetas: seisRotulos(dias, rotuloDia),
      legendaA: 'doses dadas sobre as previstas', legendaB: null,
      ...(porDiaDoses === 0 ? emFalta('Sem medicação ativa prescrita — não há denominador para medir adesão.')
        : dadas30 === 0 ? emFalta('Ainda não há tomas marcadas nos últimos 30 dias.') : {}),
    },
    barras: {
      titulo: 'Ocorrências por dia da semana',
      itens: semanaOcorrencias.map(s => ({ ...s, teto: Math.max(1, ...semanaOcorrencias.map(x => x.valor)) })),
      destaque: maiorIndice(semanaOcorrencias),
      rodape: 'Noventa dias de ocorrências, agrupadas pelo dia em que aconteceram.',
      vazio: c.inc90.length ? undefined : 'Sem ocorrências registadas nos últimos 90 dias.',
    },
    rosca: {
      titulo: 'Refeições de hoje',
      grande: refPct != null ? String(refPct) : '—', unidade: refPct != null ? '% comeu tudo' : 'sem registo',
      a: comeuTudo, b: comeuMetade, total: Math.max(1, total),
      legenda: [
        { rotulo: 'Comeu tudo', valor: String(comeuTudo), cor: 'var(--accent)' },
        { rotulo: 'Comeu metade', valor: String(comeuMetade), cor: '#8e939c' },
        { rotulo: 'Comeu pouco', valor: String(comeuPouco), cor: 'var(--bg-4)' },
        { rotulo: 'Sem registo', valor: String(Math.max(0, total - comRefeicao.length)), cor: 'var(--bg-3)' },
      ],
      vazio: comRefeicao.length ? undefined : 'Ainda não há refeições registadas hoje.',
    },
    tabela: {
      titulo: 'Utentes a vigiar', rodape: 'ocorrências e feridas dos últimos 90 dias',
      cols: 'minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,1fr) 96px',
      cabecalho: ['Utente', 'Sinal registado', 'Sinais', 'Estado'],
      linhas: vigiar,
      vazio: vigiar.length ? undefined : 'Nenhum utente com ocorrências ou feridas registadas nos últimos 90 dias.',
    },
    lista: {
      titulo: 'Avaliações vencidas', contagem: vencidas.length ? `${vencidas.length} vencidas` : '',
      itens: vencidas,
      vazio: vencidas.length ? undefined
        : c.avaliacoes.length ? 'Nenhuma avaliação com mais de seis meses.'
          : 'Ainda não há avaliações registadas — a primeira de cada escala é a que abre o histórico.',
    },
  }
}

/* ── Separador: Pessoas ──────────────────────────────────────────────────── */

export function abaPessoas(b: Base, p: CruPessoas | null, casa: string, nomes: Nomes): Aba {
  const total = b.utentes.length
  if (!p) return esqueleto('Pessoas', casa, total, 'A carregar as conversas dos últimos 30 dias…')

  const dias = ultimosDias(30)
  const hoje = ptDate()
  const daFamilia = p.msgs.filter((m: any) => m.author_side === 'family')
  const daEquipa = p.msgs.filter((m: any) => m.author_side !== 'family')
  const hojeFamilia = daFamilia.filter((m: any) => String(m.created_at).slice(0, 10) === hoje).length
  const diariosHoje = new Set(daEquipa.filter((m: any) => String(m.created_at).slice(0, 10) === hoje).map((m: any) => m.patient_id)).size
  const comContacto = new Set(p.msgs.map((m: any) => m.patient_id)).size

  // Tempo de resposta: de cada mensagem da família até à resposta seguinte da
  // equipa, na mesma conversa. Só conta as que já foram respondidas.
  const porUtente = new Map<string, any[]>()
  p.msgs.forEach((m: any) => { const a = porUtente.get(m.patient_id) || []; a.push(m); porUtente.set(m.patient_id, a) })
  const esperas: number[] = []
  const aguardar: { id: string; patient_id: string; desde: string }[] = []
  porUtente.forEach((msgs, pid) => {
    const ordenadas = [...msgs].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
    ordenadas.forEach((m, i) => {
      if (m.author_side !== 'family') return
      const resposta = ordenadas.slice(i + 1).find(x => x.author_side !== 'family')
      if (resposta) esperas.push((new Date(resposta.created_at).getTime() - new Date(m.created_at).getTime()) / 3600000)
      else if (!aguardar.some(a => a.patient_id === pid)) aguardar.push({ id: m.id, patient_id: pid, desde: m.created_at })
    })
  })
  const respostaMedia = esperas.length >= 3 ? Math.round((esperas.reduce((s, v) => s + v, 0) / esperas.length) * 10) / 10 : null

  const nomePorId = new Map(b.utentes.map(u => [u.id, u.name as string]))
  const desdeTexto = (iso: string) => {
    const h = (Date.now() - new Date(iso).getTime()) / 3600000
    return h < 1 ? 'há minutos' : h < 24 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`
  }
  const espera = aguardar
    .filter(a => nomePorId.has(a.patient_id))
    .sort((x, y) => String(x.desde).localeCompare(String(y.desde)))
    .slice(0, 6)
    .map(a => {
      const horas = (Date.now() - new Date(a.desde).getTime()) / 3600000
      return {
        id: a.id, href: '/family', a: `Família de ${nomePorId.get(a.patient_id)}`,
        b: 'Última mensagem da conversa é da família', barra: null,
        c: desdeTexto(a.desde), etiqueta: horas > 4 ? 'a responder' : '', destaque: horas > 4,
      }
    })

  // Nota sobre o que NÃO está aqui: o desenho original tinha "aniversários dos
  // próximos sete dias". A tabela `patients` guarda `age`, um número, e não uma
  // data de nascimento — com uma idade não há forma de saber quando é o dia.
  // Um cartão de aniversários com datas adivinhadas seria a pior espécie de
  // erro deste produto: alguém festejaria no dia errado. Fica de fora até haver
  // a coluna; no lugar ficam duas coisas que a base de dados sabe mesmo.
  const visitas = p.visitas.slice(0, 2).map((v: any) => ({
    id: `v-${v.id}`, icone: 'calendar', titulo: 'Pedido de visita por responder',
    sub: `${v.requested_date ? rotuloDia(String(v.requested_date).slice(0, 10)) : 'sem data'}${v.requested_time ? ` às ${String(v.requested_time).slice(0, 5)}` : ''}.`,
    cta: 'Ver', href: '/family',
  }))
  const semFamilia = b.utentes
    .filter(u => !porUtente.has(u.id))
    .slice(0, 3)
    .map(u => ({
      id: `sf-${u.id}`, icone: 'family', titulo: `${u.name} sem família ligada`,
      sub: 'Ninguém do lado da família abriu conversa nesta ficha.',
      cta: 'Ligar', href: `/patients/${u.id}`,
    }))

  const semana = porDiaSemana(daFamilia, 'created_at')
  const serieMsgs = porDia(daFamilia, dias, 'created_at')

  return {
    eyebrow: `Pessoas · ${casa} · ${plural(total, nomes.um.toLowerCase(), nomes.muitos.toLowerCase())}`,
    headline: espera.length
      ? `${espera.length === 1 ? 'Uma família espera' : `${espera.length} famílias esperam`} resposta.`
      : comContacto ? 'Nenhuma família à espera de resposta.' : 'Ainda não há conversas com famílias.',
    acoes: [{ label: nomes.muitos, href: '/patients' }, { label: 'Abrir famílias', href: '/family', primaria: true }],
    kpis: [
      { etiqueta: nomes.muitos, valor: total, serie: [], nota: `${comContacto} com família ligada` },
      { etiqueta: 'Mensagens hoje', valor: hojeFamilia, serie: serieMsgs.slice(-10), nota: espera.length ? `${espera.length} sem resposta` : 'nenhuma por responder' },
      { etiqueta: 'Tempo de resposta', valor: respostaMedia != null ? String(respostaMedia).replace('.', ',') : '—', de: respostaMedia != null ? 'h' : undefined,
        serie: [], nota: respostaMedia != null ? `média de ${esperas.length} respostas` : 'ainda sem respostas suficientes' },
      { etiqueta: 'Diários enviados', valor: diariosHoje, de: `/${total}`, serie: [], nota: diariosHoje ? 'hoje' : 'nenhum enviado hoje' },
      { etiqueta: 'Conversas', valor: comContacto, de: `/${total}`, serie: [], nota: comContacto < total ? `${total - comContacto} sem família ligada` : 'todas ligadas' },
    ],
    linha: {
      titulo: 'Mensagens de família · 30 dias',
      valor: `${daFamilia.length}`, delta: hojeFamilia ? `${hojeFamilia} hoje` : null, deltaBom: true,
      a: serieMsgs, b: null, etiquetas: seisRotulos(dias, rotuloDia),
      legendaA: 'recebidas', legendaB: null,
      vazio: daFamilia.length ? undefined : 'Ainda não há mensagens de famílias nos últimos 30 dias.',
    },
    barras: {
      titulo: 'Mensagens por dia da semana',
      itens: semana.map(s => ({ ...s, teto: Math.max(1, ...semana.map(x => x.valor)) })),
      destaque: maiorIndice(semana),
      rodape: 'Trinta dias de mensagens, pelo dia em que chegaram.',
      vazio: daFamilia.length ? undefined : 'Sem mensagens para agrupar.',
    },
    rosca: {
      titulo: 'Diário do dia enviado',
      grande: String(diariosHoje), unidade: `de ${total}`,
      a: diariosHoje, b: 0, total: Math.max(1, total),
      legenda: [
        { rotulo: 'Enviado', valor: String(diariosHoje), cor: 'var(--accent)' },
        { rotulo: 'Por enviar', valor: String(Math.max(0, total - diariosHoje)), cor: 'var(--bg-3)' },
      ],
      vazio: total ? undefined : 'Sem utentes ativos.',
    },
    tabela: {
      titulo: 'Famílias à espera', rodape: espera.length ? 'da mais antiga para a mais recente' : '',
      cols: 'minmax(0,1.2fr) minmax(0,1.7fr) minmax(0,0.8fr) 96px',
      cabecalho: ['Contacto', 'Estado da conversa', 'Espera', 'Ação'],
      linhas: espera,
      vazio: espera.length ? undefined : 'Nenhuma conversa fica à espera: a última mensagem de cada uma é da equipa.',
    },
    lista: {
      titulo: 'Por tratar', contagem: visitas.length + semFamilia.length ? `${visitas.length + semFamilia.length} em aberto` : '',
      itens: [...visitas, ...semFamilia].slice(0, 4),
      vazio: visitas.length + semFamilia.length ? undefined
        : 'Nada por tratar: sem pedidos de visita pendentes e todas as fichas com família ligada.',
    },
  }
}

/* ── Separador: Equipa ───────────────────────────────────────────────────── */

const TURNOS: { id: string; label: string }[] = [
  { id: 'manha', label: 'Manhã' }, { id: 'tarde', label: 'Tarde' }, { id: 'noite', label: 'Noite' },
]

export function abaEquipa(b: Base, e: CruEquipa | null, casa: string): Aba {
  const total = b.utentes.length
  if (!e) return esqueleto('Equipa', casa, total, 'A carregar a escala…')

  const hoje = ptDate()
  const h = new Date().getHours()
  const turnoAgora = h < 8 ? 'noite' : h < 14 ? 'manha' : h < 21 ? 'tarde' : 'noite'
  const ativos = e.membros.filter((m: any) => m.status !== 'inactive').length

  const nomeMembro = new Map(e.membros.map((m: any) => [m.id, m.name as string]))
  const noTurno = e.escala.filter((a: any) => String(a.date).slice(0, 10) === hoje && a.shift === turnoAgora)
  const racio = noTurno.length ? Math.round(total / noTurno.length) : null

  // Próximos sete dias: cada dia tem três turnos; conta os que ninguém cobre.
  const proximos = ultimosDias(1).concat(Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() + i + 1); return d.toISOString().slice(0, 10)
  }))
  const cobertos: { dia: string; turno: string; quem: string[] }[] = []
  proximos.forEach(dia => TURNOS.forEach(t => {
    const quem = e.escala.filter((a: any) => String(a.date).slice(0, 10) === dia && a.shift === t.id)
      .map((a: any) => nomeMembro.get(a.team_member_id)).filter(Boolean) as string[]
    cobertos.push({ dia, turno: t.label, quem })
  }))
  const vazios = cobertos.filter(c => !c.quem.length).length
  const temEscala = e.escala.length > 0

  // Registos por turno, últimos sete dias.
  const porTurno = TURNOS.map(t => ({
    rotulo: t.label,
    valor: e.care7.filter((r: any) => r.shift === t.id).length,
    teto: 1,
  }))
  const tetoTurno = Math.max(1, ...porTurno.map(x => x.valor))

  // Carga por dia: utentes por pessoa escalada, nos últimos 14 dias.
  const dias14 = ultimosDias(14)
  const cargaSerie = dias14.map(d => {
    const pessoas = new Set(e.escala.filter((a: any) => String(a.date).slice(0, 10) === d).map((a: any) => a.team_member_id)).size
    return pessoas ? Math.round((total / pessoas) * 10) / 10 : 0
  })
  const comCarga = cargaSerie.filter(v => v > 0)
  const cargaMedia = comCarga.length >= 3 ? Math.round((comCarga.reduce((s, v) => s + v, 0) / comCarga.length) * 10) / 10 : null

  const registosHoje = e.care7.filter((r: any) => String(r.date).slice(0, 10) === hoje).length
  const porPessoa = noTurno.length ? Math.round(registosHoje / noTurno.length) : null

  const escalaTabela = cobertos.slice(0, 6).map((c, i) => ({
    id: `${c.dia}-${c.turno}-${i}`, href: '/equipa?tab=escalas',
    a: `${c.dia === hoje ? 'Hoje' : rotuloDia(c.dia)} · ${c.turno}`,
    b: c.quem.length ? c.quem.join(', ') : 'Ninguém escalado',
    barra: c.quem.length ? Math.min(100, c.quem.length * 33) : 0,
    c: c.quem.length ? `1:${Math.round(total / c.quem.length)}` : '—',
    etiqueta: c.quem.length ? '' : 'por cobrir', destaque: !c.quem.length,
  }))

  const recados = e.recados.slice(0, 4).map((m: any) => ({
    id: m.id, icone: m.priority === 'urgente' ? 'alert' : 'megaphone',
    titulo: String(m.body || '').slice(0, 60) + (String(m.body || '').length > 60 ? '…' : ''),
    sub: `${m.author_name || 'Equipa'} · ${desdeCurto(m.created_at)}`,
    cta: 'Ler', href: '/equipa?tab=mural',
  }))

  return {
    eyebrow: `Equipa · ${casa} · ${plural(ativos, 'pessoa', 'pessoas')}`,
    headline: vazios
      ? `${plural(vazios, 'turno', 'turnos')} sem ninguém escalado nos próximos sete dias.`
      : temEscala ? 'Os próximos sete dias estão todos cobertos.' : 'A escala dos próximos dias ainda está por preencher.',
    acoes: [{ label: 'Mural', href: '/equipa?tab=mural' }, { label: 'Abrir escala', href: '/equipa?tab=escalas', primaria: true }],
    kpis: [
      { etiqueta: 'No turno', valor: noTurno.length, serie: [], nota: temEscala ? `turno da ${turnoAgora === 'manha' ? 'manhã' : turnoAgora}` : 'sem escala marcada' },
      { etiqueta: 'Rácio', valor: racio != null ? `1:${racio}` : '—', serie: [], nota: racio != null ? 'utentes por pessoa' : 'sem ninguém escalado agora' },
      { etiqueta: 'Registos hoje', valor: registosHoje, serie: [], nota: porPessoa != null ? `${porPessoa} por pessoa no turno` : 'sem escala para comparar' },
      { etiqueta: 'Turnos por cobrir', valor: vazios, serie: [], alerta: vazios > 0, nota: 'nos próximos sete dias' },
      { etiqueta: 'Equipa', valor: ativos, serie: [], nota: e.membros.length > ativos ? `${e.membros.length - ativos} inativos` : 'todos ativos' },
    ],
    linha: {
      titulo: 'Utentes por pessoa escalada · 14 dias',
      valor: racio != null ? `1:${racio}` : '—',
      delta: cargaMedia != null ? `média ${cargaMedia}`.replace('.', ',') : null,
      deltaBom: racio != null && cargaMedia != null && racio <= cargaMedia,
      a: cargaSerie, b: null, etiquetas: seisRotulos(dias14, rotuloDia),
      legendaA: 'utentes por pessoa', legendaB: null,
      vazio: comCarga.length ? undefined : 'Ainda não há escalas registadas para medir carga.',
    },
    barras: {
      titulo: 'Registos por turno · 7 dias',
      itens: porTurno.map(t => ({ ...t, teto: tetoTurno })),
      destaque: maiorIndice(porTurno),
      rodape: 'Registos do dia feitos em cada turno na última semana.',
      vazio: e.care7.length ? undefined : 'Sem registos do dia na última semana.',
    },
    rosca: {
      titulo: 'Cobertura · próximos 7 dias',
      grande: String(cobertos.length - vazios), unidade: `de ${cobertos.length} turnos`,
      a: cobertos.length - vazios, b: 0, total: Math.max(1, cobertos.length),
      legenda: [
        { rotulo: 'Cobertos', valor: String(cobertos.length - vazios), cor: 'var(--accent)' },
        { rotulo: 'Por cobrir', valor: String(vazios), cor: 'var(--bg-3)' },
      ],
      vazio: temEscala ? undefined : 'Sem escala marcada para os próximos dias.',
    },
    tabela: {
      titulo: 'Escala dos próximos dias', rodape: 'manhã, tarde e noite',
      cols: 'minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) 96px',
      cabecalho: ['Turno', 'Equipa', 'Carga', 'Estado'],
      linhas: escalaTabela,
      vazio: temEscala ? undefined : 'A escala dos próximos dias ainda não foi preenchida.',
    },
    lista: {
      titulo: 'Mural da equipa', contagem: e.recados.length ? `${e.recados.length} recentes` : '',
      itens: recados,
      vazio: e.recados.length ? undefined : 'Sem recados no mural.',
    },
  }
}

function desdeCurto(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000
  return h < 1 ? 'há minutos' : h < 24 ? `há ${Math.round(h)} h` : `há ${Math.round(h / 24)} d`
}

/* ── Separador: Gestão ───────────────────────────────────────────────────── */

export function abaGestao(b: Base, g: CruGestao | null, casa: string, nomes: Nomes): Aba {
  const total = b.utentes.length
  if (!g) return esqueleto('Gestão', casa, total, 'A carregar as contas do mês…')

  const lotacao: number | null = g.org?.capacity ? Number(g.org.capacity) : null
  const ocupacao = lotacao ? pct(total, lotacao) : null
  const meses = ultimosMeses(12)
  const mesAtual = meses[meses.length - 1]

  const liquido = (m: any) => Number(m.fee || 0) + Number(m.extras || 0) - Number(m.subsidy || 0) - Number(m.discount || 0)
  const doMes = g.mensalidades.filter((m: any) => String(m.month).slice(0, 7) === mesAtual)
  const recebido = doMes.filter((m: any) => m.paid).reduce((s: number, m: any) => s + liquido(m), 0)
  const emAtraso = doMes.filter((m: any) => !m.paid)
  const valorAtraso = emAtraso.reduce((s: number, m: any) => s + liquido(m), 0)
  const despesas = g.financas.filter((f: any) => f.kind === 'expense').reduce((s: number, f: any) => s + Number(f.amount || 0), 0)

  const receitaPorMes = meses.slice(-5).map(ym => ({
    rotulo: rotuloMes(ym),
    valor: Math.round(g.mensalidades.filter((m: any) => String(m.month).slice(0, 7) === ym && m.paid).reduce((s: number, m: any) => s + liquido(m), 0)),
    teto: 1,
  }))
  const tetoReceita = Math.max(1, ...receitaPorMes.map(r => r.valor))
  const temMensalidades = g.mensalidades.length > 0

  // Utentes ao longo de 12 meses: acumulado das datas de entrada.
  const serieUtentes = meses.map(ym => g.entradas.filter((p: any) => String(p.created_at).slice(0, 7) <= ym).length)
  const temEntradas = g.entradas.length > 0

  const novosMes = g.entradas.filter((p: any) => String(p.created_at).slice(0, 7) === mesAtual).length
  const registosMes = new Set(b.registos.map((r: any) => r.patient_id)).size

  // Indicadores: contagens reais, cada uma com a sua fonte.
  const dosesDia = dosesPorDia(b.meds)
  const dadasHoje = b.tomas.filter(DADA).length
  const indicadores = [
    { id: 'i1', a: 'Adesão à medicação', b: 'Registos do MAR', barra: dosesDia ? Math.round((dadasHoje / dosesDia) * 100) : null,
      c: dosesDia ? `${dadasHoje}/${dosesDia}` : '—', etiqueta: dosesDia ? '' : 'sem base', destaque: !dosesDia },
    { id: 'i2', a: 'Registos do dia', b: 'Registo do dia', barra: total ? Math.round((registosMes / total) * 100) : null,
      c: `${registosMes}/${total}`, etiqueta: registosMes < total ? 'incompleto' : '', destaque: registosMes < total },
    { id: 'i3', a: 'Ocorrências em aberto', b: 'Livro de ocorrências', barra: null,
      c: String(b.ocorrencias.length), etiqueta: b.ocorrencias.length ? 'a fechar' : '', destaque: b.ocorrencias.length > 0 },
    { id: 'i4', a: 'Avaliações este mês', b: 'Escalas', barra: null,
      c: String(g.avalMes.length), etiqueta: g.avalMes.length ? '' : 'nenhuma', destaque: !g.avalMes.length },
    { id: 'i5', a: 'Mensalidades por receber', b: 'Faturação', barra: doMes.length ? Math.round(((doMes.length - emAtraso.length) / doMes.length) * 100) : null,
      c: doMes.length ? `${doMes.length - emAtraso.length}/${doMes.length}` : '—',
      etiqueta: emAtraso.length ? 'em atraso' : '', destaque: emAtraso.length > 0 },
    { id: 'i6', a: 'Ocupação', b: 'Lotação da casa', barra: ocupacao,
      c: ocupacao != null ? `${ocupacao}%` : '—', etiqueta: lotacao ? '' : 'lotação por definir', destaque: !lotacao },
  ]

  const decidir: any[] = []
  if (emAtraso.length) decidir.push({
    id: 'd1', icone: 'euro', titulo: `${emAtraso.length} ${emAtraso.length === 1 ? 'mensalidade' : 'mensalidades'} por receber`,
    sub: `${eur(valorAtraso)} € deste mês por regularizar.`, cta: 'Faturação', href: '/faturacao',
  })
  if (b.ocorrencias.length) decidir.push({
    id: 'd2', icone: 'alert', titulo: `${b.ocorrencias.length} ${b.ocorrencias.length === 1 ? 'ocorrência' : 'ocorrências'} em aberto`,
    sub: 'Fechar cada uma com a ação tomada é o que a inspeção pede.', cta: 'Abrir', href: '/incidents',
  })
  if (!lotacao) decidir.push({
    id: 'd3', icone: 'building', titulo: 'Lotação por definir',
    sub: 'Sem lotação não se pode dizer quantos lugares faltam preencher.', cta: 'Definir', href: '/painel-dono',
  })
  if (!g.avalMes.length) decidir.push({
    id: 'd4', icone: 'clipboard', titulo: 'Nenhuma avaliação este mês',
    sub: 'As escalas são o registo que sustenta o plano individual.', cta: 'Avaliar', href: '/assessments',
  })

  return {
    eyebrow: `Gestão · ${casa} · ${rotuloMes(mesAtual)} de ${mesAtual.slice(0, 4)}`,
    headline: ocupacao != null
      ? `${total} de ${lotacao} lugares ocupados${emAtraso.length ? ` e ${plural(emAtraso.length, 'mensalidade', 'mensalidades')} por receber` : ''}.`
      : `${plural(total, nomes.um.toLowerCase(), nomes.muitos.toLowerCase())} ${total === 1 ? 'ativo' : 'ativos'}. A lotação da casa ainda não está definida.`,
    acoes: [{ label: 'Documentos', href: '/documentos' }, { label: 'Abrir gestão', href: '/painel-dono', primaria: true }],
    kpis: [
      { etiqueta: 'Ocupação', valor: ocupacao != null ? ocupacao : '—', de: ocupacao != null ? '%' : undefined,
        serie: serieUtentes.slice(-10), nota: lotacao ? `${total} de ${lotacao} lugares` : 'lotação por definir' },
      { etiqueta: 'Recebido no mês', valor: temMensalidades ? eur(recebido) : '—', de: temMensalidades ? '€' : undefined,
        serie: receitaPorMes.map(r => r.valor), nota: temMensalidades ? `${doMes.filter((m: any) => m.paid).length} mensalidades pagas` : 'sem faturação registada' },
      { etiqueta: 'Por receber', valor: temMensalidades ? eur(valorAtraso) : '—', de: temMensalidades ? '€' : undefined,
        serie: [], alerta: valorAtraso > 0, nota: emAtraso.length ? `${emAtraso.length} deste mês` : 'nada em atraso' },
      { etiqueta: 'Despesas', valor: g.financas.length ? eur(despesas) : '—', de: g.financas.length ? '€' : undefined,
        serie: [], nota: g.financas.length ? 'lançadas este mês' : 'sem despesas lançadas' },
      { etiqueta: 'Entradas', valor: novosMes, serie: [], nota: 'este mês' },
    ],
    linha: {
      titulo: `${nomes.muitos} · 12 meses`,
      valor: String(total), delta: novosMes ? `+${novosMes} este mês` : null, deltaBom: novosMes > 0,
      a: serieUtentes, b: lotacao ? meses.map(() => lotacao) : null,
      etiquetas: seisRotulos(meses, rotuloMes),
      legendaA: nomes.muitos.toLowerCase(), legendaB: lotacao ? 'lotação' : null,
      vazio: temEntradas ? undefined : 'Ainda não há datas de entrada registadas para desenhar a evolução.',
    },
    barras: {
      titulo: 'Recebido por mês · €',
      itens: receitaPorMes.map(r => ({ ...r, teto: tetoReceita, texto: eur(r.valor) })),
      rodape: 'Mensalidades marcadas como pagas, líquidas de comparticipação e desconto.',
      vazio: temMensalidades ? undefined : 'Sem mensalidades registadas — a faturação alimenta este gráfico.',
    },
    rosca: {
      titulo: 'Lugares',
      grande: String(total), unidade: lotacao ? `de ${lotacao}` : 'sem lotação',
      a: total, b: 0, total: Math.max(1, lotacao || total),
      legenda: [
        { rotulo: 'Ocupados', valor: String(total), cor: 'var(--accent)' },
        { rotulo: 'Livres', valor: lotacao ? String(Math.max(0, lotacao - total)) : '—', cor: 'var(--bg-3)' },
      ],
      vazio: lotacao ? undefined : 'Define a lotação da casa para ver quantos lugares faltam.',
    },
    tabela: {
      titulo: 'Indicadores', rodape: 'cada um com a sua fonte',
      cols: 'minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,1fr) 96px',
      cabecalho: ['Indicador', 'Fonte', 'Valor', 'Estado'],
      linhas: indicadores,
    },
    lista: {
      titulo: 'A decidir', contagem: decidir.length ? `${decidir.length} pontos` : '',
      itens: decidir.slice(0, 4),
      vazio: decidir.length ? undefined : 'Nada por decidir: contas em dia, ocorrências fechadas e lotação definida.',
    },
  }
}

/* ── Esqueleto: a moldura enquanto o separador ainda carrega ──────────────── */

function esqueleto(nome: string, casa: string, total: number, mensagem: string): Aba {
  const vazio = { vazio: mensagem }
  return {
    eyebrow: `${nome} · ${casa}`,
    headline: mensagem,
    acoes: [],
    kpis: [],
    linha: { titulo: nome, valor: '—', delta: null, deltaBom: true, a: [], b: null, etiquetas: [], legendaA: '', legendaB: null, ...vazio },
    barras: { titulo: nome, itens: [], rodape: '', ...vazio },
    rosca: { titulo: nome, grande: '—', unidade: '', a: 0, b: 0, total: 1, legenda: [], ...vazio },
    tabela: { titulo: nome, rodape: '', cols: '1fr', cabecalho: [], linhas: [], ...vazio },
    lista: { titulo: nome, contagem: '', itens: [], ...vazio },
  }
}
