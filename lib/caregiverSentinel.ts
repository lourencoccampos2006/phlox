// lib/caregiverSentinel.ts
// ─────────────────────────────────────────────────────────────────────────────
// O Sentinel do cuidador — a leitura LONGITUDINAL que faltava a quem cuida em
// casa.
//
// ── O QUE JÁ HAVIA, E PORQUE NÃO CHEGAVA ───────────────────────────────────
// `lib/caregiverWatch.ts` lê o INSTANTE: a medicação atual contra as 26 regras
// clínicas, a última tensão, os sintomas recentes. É bom e continua a valer.
// Mas o que faz alguém perceber que a mãe está a piorar não é uma leitura — é
// a forma como as leituras mudam ao longo de semanas. Do lado institucional o
// Sentinel faz isso há meses (`lib/sentinel.ts`); do lado do cuidador não
// fazia nada disso.
//
// ── AS TRÊS COISAS QUE ESTE FICHEIRO ACRESCENTA ────────────────────────────
// 1. ADESÃO REAL — doses marcadas contra doses devidas, em 14 e 30 dias. É o
//    equivalente do MAR de um lar. Não é "esqueceu-se ontem": é "nas últimas
//    duas semanas tomou 6 de cada 10".
// 2. SILÊNCIO — há quanto tempo ninguém registou NADA sobre esta pessoa. Num
//    lar há sempre alguém a registar; em casa, o silêncio é o sinal mais
//    honesto de que o acompanhamento parou — e é quase sempre o que precede
//    uma ida às urgências.
// 3. EROSÃO — a pessoa está a piorar face ao SEU PRÓPRIO hábito, não a uma
//    média de ninguém. Adesão que era boa e caiu, sintomas que eram raros e
//    passaram a semanais, peso a descer devagar.
//
// ── AS REGRAS DA CASA, QUE SE MANTÊM ───────────────────────────────────────
// • Nada é inventado. Sem dados suficientes, o sinal simplesmente não existe —
//   e a interface diz o que falta, em vez de mostrar uma percentagem sobre
//   nada.
// • Não diagnostica. Organiza o que foi registado e diz o que merece uma
//   conversa. A avaliação é de um profissional.
// • O tom é de quem ajuda, não de quem cobra. Quem cuida de um pai já se sente
//   suficientemente culpado sem uma aplicação a dizer-lhe que está atrasado.
// ─────────────────────────────────────────────────────────────────────────────

import type { WatchSignal } from './caregiverWatch'

export interface DoseRegistada { med_id: string; date: string; status: string }
export interface MedDoCuidado { id: string; name: string; pills_per_day?: number | null; active?: boolean | null; created_at?: string | null }
export interface VitalRegistado { recorded_at: string; weight?: number | null }
export interface SintomaRegistado { at?: string | null; created_at?: string | null; pain?: number | null }

export interface EntradaCuidador {
  meds: MedDoCuidado[]
  doses: DoseRegistada[]          // últimos ~35 dias
  vitals: VitalRegistado[]        // últimos ~180 dias
  sintomas: SintomaRegistado[]    // últimos ~60 dias
  /** datas em que houve QUALQUER registo (dose, vital, sintoma, consulta) */
  diasComRegisto: string[]
}

const DADA = new Set(['taken', 'given', 'administered'])
const dia = (iso: string) => String(iso || '').slice(0, 10)
const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

/** Doses devidas por dia, pelo horário de cada medicamento ativo. */
function dosesPorDia(meds: MedDoCuidado[]): number {
  return meds
    .filter(m => m.active !== false)
    .reduce((s, m) => s + (Number(m.pills_per_day) > 0 ? Number(m.pills_per_day) : 1), 0)
}

/** Adesão numa janela: dadas sobre devidas. `null` quando não há denominador. */
export function adesaoEm(entrada: EntradaCuidador, dias: number, hoje: string): { pct: number; dadas: number; devidas: number } | null {
  const porDia = dosesPorDia(entrada.meds)
  if (porDia <= 0) return null
  const desde = new Date(hoje + 'T12:00:00'); desde.setDate(desde.getDate() - (dias - 1))
  const desdeStr = dia(desde.toISOString())
  // Um medicamento começado a meio da janela não conta os dias anteriores.
  const devidas = entrada.meds
    .filter(m => m.active !== false)
    .reduce((s, m) => {
      const inicio = m.created_at ? dia(m.created_at) : desdeStr
      const de = inicio > desdeStr ? inicio : desdeStr
      const n = Math.max(0, diasEntre(de, hoje) + 1)
      return s + n * (Number(m.pills_per_day) > 0 ? Number(m.pills_per_day) : 1)
    }, 0)
  if (devidas <= 0) return null
  const dadas = entrada.doses.filter(d => DADA.has(d.status) && dia(d.date) >= desdeStr).length
  return { pct: Math.round((Math.min(dadas, devidas) / devidas) * 100), dadas, devidas }
}

/**
 * Os sinais longitudinais. Devolve no mesmo formato do caregiverWatch, para a
 * interface poder juntar as duas listas sem saber de onde veio cada uma.
 */
export function sinaisLongitudinais(entrada: EntradaCuidador, nome: string, perfilId: string, hoje: string): WatchSignal[] {
  const sinais: WatchSignal[] = []
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'esta pessoa'

  // ── 1. Adesão ────────────────────────────────────────────────────────────
  const a14 = adesaoEm(entrada, 14, hoje)
  const a30 = adesaoEm(entrada, 30, hoje)
  if (a14 && a14.devidas >= 10) {
    if (a14.pct < 60) {
      sinais.push({
        kind: 'adesao_baixa', severity: 'major',
        title: `Metade da medicação não está a ser marcada`,
        detail: `Nas últimas duas semanas ficaram registadas ${a14.dadas} de ${a14.devidas} doses (${a14.pct}%). Pode ser que esteja a tomar sem marcar — ou pode ser que não esteja a tomar.`,
        action: 'Confirmar com quem toma, e usar os lembretes se ajudar.',
        cta: { label: 'Ver a medicação', href: `/mymeds?profile=${perfilId}` },
      })
    } else if (a14.pct < 85) {
      sinais.push({
        kind: 'adesao_media', severity: 'moderate',
        title: `${a14.pct}% das doses marcadas`,
        detail: `${a14.dadas} de ${a14.devidas} nas últimas duas semanas.`,
        cta: { label: 'Ver a medicação', href: `/mymeds?profile=${perfilId}` },
      })
    }
    // Caiu face ao próprio hábito — mais importante do que o valor absoluto.
    if (a30 && a30.pct - a14.pct >= 20 && a14.pct < 85) {
      sinais.push({
        kind: 'adesao_a_cair', severity: 'major',
        title: 'A medicação está a ser marcada menos vezes',
        detail: `Nos últimos 30 dias foram ${a30.pct}%; nas últimas duas semanas, ${a14.pct}%. Alguma coisa mudou em casa.`,
        action: 'Vale a pena perceber o que mudou nas últimas semanas.',
      })
    }
  }

  // ── 2. Silêncio ──────────────────────────────────────────────────────────
  // Só faz sentido para quem JÁ acompanhava: uma pessoa que nunca registou
  // nada não está em silêncio, está por começar — e não se cobra isso.
  const dias = [...new Set(entrada.diasComRegisto.map(dia))].sort()
  if (dias.length >= 3) {
    const ultimo = dias[dias.length - 1]
    const sem = diasEntre(ultimo, hoje)
    // Com que frequência esta pessoa costumava ser acompanhada.
    const intervalos: number[] = []
    for (let i = 1; i < dias.length; i++) intervalos.push(diasEntre(dias[i - 1], dias[i]))
    const habitual = intervalos.length
      ? intervalos.slice().sort((x, y) => x - y)[Math.floor(intervalos.length / 2)]
      : 7
    const limiar = Math.max(7, habitual * 3)
    if (sem >= limiar) {
      sinais.push({
        kind: 'silencio', severity: sem >= limiar * 2 ? 'major' : 'moderate',
        title: `Há ${sem} dias sem nada registado`,
        detail: `O último registo sobre ${primeiro} foi a ${new Date(ultimo + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}. Antes disso, era mais ou menos de ${habitual} em ${habitual} dias.`,
        action: 'Nem sempre é sinal de nada — mas costuma ser quando a rotina se perde.',
        cta: { label: 'Registar como está hoje', href: `/timeline?profile=${perfilId}` },
      })
    }
  }

  // ── 3. Erosão ────────────────────────────────────────────────────────────
  // Sintomas que eram raros e passaram a frequentes.
  const agoraSintomas = entrada.sintomas.filter(s => {
    const d = dia(s.at || s.created_at || '')
    return d && diasEntre(d, hoje) <= 14
  }).length
  const antesSintomas = entrada.sintomas.filter(s => {
    const d = dia(s.at || s.created_at || '')
    const n = d ? diasEntre(d, hoje) : 999
    return n > 14 && n <= 42
  }).length
  // Compara 14 dias contra a MÉDIA de 14 dias das 4 semanas anteriores.
  const antesPor14 = antesSintomas / 2
  if (agoraSintomas >= 3 && agoraSintomas >= antesPor14 * 2 + 1) {
    sinais.push({
      kind: 'sintomas_a_subir', severity: 'major',
      title: 'Mais queixas do que era habitual',
      detail: `${agoraSintomas} nas últimas duas semanas, contra cerca de ${antesPor14.toFixed(0)} no mesmo tempo antes disso.`,
      action: 'Uma subida assim costuma valer uma consulta.',
      cta: { label: 'Ver o registo', href: `/timeline?profile=${perfilId}` },
    })
  }

  // Peso a descer devagar — o sinal que ninguém vê porque é lento.
  const pesos = entrada.vitals
    .filter(v => typeof v.weight === 'number' && v.weight! > 0 && v.recorded_at)
    .map(v => ({ d: dia(v.recorded_at), kg: Number(v.weight) }))
    .sort((x, y) => x.d.localeCompare(y.d))
  if (pesos.length >= 3) {
    const ultimo = pesos[pesos.length - 1]
    // A referência mais antiga dentro de 90 dias.
    const ref = pesos.find(p => diasEntre(p.d, ultimo.d) <= 90 && diasEntre(p.d, ultimo.d) >= 21)
    if (ref && ref.kg > 0) {
      const perda = ((ref.kg - ultimo.kg) / ref.kg) * 100
      if (perda >= 5) {
        sinais.push({
          kind: 'peso_a_descer', severity: perda >= 10 ? 'critical' : 'major',
          title: `Perdeu ${perda.toFixed(0)}% do peso`,
          detail: `De ${ref.kg} kg a ${new Date(ref.d + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} para ${ultimo.kg} kg agora.`,
          action: 'Uma perda destas sem explicação merece ser vista por um médico.',
          cta: { label: 'Ver o peso', href: `/vitals?profile=${perfilId}` },
        })
      }
    }
  }

  return sinais
}

/** Carrega o que o Sentinel do cuidador precisa, para uma pessoa. */
export async function carregarEntradaCuidador(
  supabase: any, perfilId: string, hoje: string,
): Promise<EntradaCuidador> {
  const desde = (n: number) => {
    const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const tol = async (q: any) => { try { const r = await q; return r?.error ? { data: [] } : r } catch { return { data: [] } } }

  const [meds, doses, vitals, sintomas, consultas] = await Promise.all([
    // Sem `shifts` (não existe nesta tabela) — as tomas por dia saem de
    // pills_per_day. Ver scripts/check-colunas.mjs.
    tol(supabase.from('family_profile_meds').select('id,name,pills_per_day,active,created_at').eq('profile_id', perfilId)),
    tol(supabase.from('med_logs').select('med_id,date,status').gte('date', desde(35))),
    tol(supabase.from('vitals').select('recorded_at,weight').eq('profile_id', perfilId).gte('recorded_at', desde(180))),
    // `pain` (0-10), não `severity` — essa coluna não existe em symptom_logs e
    // fazia o select falhar inteiro. Ver scripts/check-colunas.mjs.
    tol(supabase.from('symptom_logs').select('at,created_at,pain').eq('profile_id', perfilId).gte('created_at', desde(60) + 'T00:00:00')),
    tol(supabase.from('appointments').select('date').eq('profile_id', perfilId).gte('date', desde(60))),
  ])

  const listaMeds = ((meds as any).data || []) as MedDoCuidado[]
  const idsMeds = new Set(listaMeds.map(m => m.id))
  // med_logs é partilhado com o modo pessoal — filtrar pelos medicamentos
  // desta pessoa, senão contavam-se as tomas de outra.
  const listaDoses = (((doses as any).data || []) as DoseRegistada[]).filter(d => idsMeds.has(d.med_id))

  const diasComRegisto = [
    ...listaDoses.map(d => dia(d.date)),
    ...(((vitals as any).data || []) as any[]).map(v => dia(v.recorded_at)),
    ...(((sintomas as any).data || []) as any[]).map(s => dia(s.at || s.created_at || '')),
    ...(((consultas as any).data || []) as any[]).map(c => dia(c.date)),
  ].filter(Boolean)

  return {
    meds: listaMeds,
    doses: listaDoses,
    vitals: ((vitals as any).data || []) as VitalRegistado[],
    sintomas: ((sintomas as any).data || []) as SintomaRegistado[],
    diasComRegisto,
  }
}
