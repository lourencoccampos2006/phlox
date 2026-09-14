// lib/avisos.ts
// ─────────────────────────────────────────────────────────────────────────────
// O que merece atenção agora — numa instituição, ou na saúde de uma pessoa.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Havia duas ideias diferentes de "aviso" no Phlox, e nenhuma delas chegava a
// ninguém:
//
//   • O sino (/api/notifications) calculava quatro tipos de aviso, bem
//     delimitados por org_id, e mostrava-os a quem abrisse a aplicação.
//   • O cron das notificações (/api/push/cron) calculava OUTRA coisa — só
//     omissões de medicação — e calculava-a mal: procurava os utentes por
//     `user_id` dos coordenadores em vez de `org_id` da casa (por isso via
//     quase ninguém), e filtrava os profiles por `plan = 'clinic'`, que só o
//     dono tem: um funcionário convidado fica com `plan: 'free'` e ganha
//     acesso por PERTENÇA (ver lib/planGate). Resultado: a lista de
//     coordenadores vinha praticamente vazia e a instituição nunca recebia
//     notificação nenhuma.
//
// Agora é um sítio só. O sino e o push leem daqui, e por isso dizem sempre a
// mesma coisa — se está no sino, é porque foi (ou vai ser) empurrado; se
// chegou uma notificação, está no sino.
//
// ── AS REGRAS ──────────────────────────────────────────────────────────────
// 1. Nada é inventado. Cada aviso aponta para um registo que existe e leva a
//    pessoa ao sítio onde ele está.
// 2. Nem tudo o que se mostra se empurra. Um sino pode ter dez linhas; uma
//    notificação interrompe alguém. Só `empurrar: true` interrompe.
// 3. Não impor ritmo. Um centro de dia não é um hospital: nada aqui diz "em
//    atraso" nem cobra registos a uma casa que simplesmente não usa aquela
//    ferramenta. O aviso de presenças, por exemplo, só aparece quando a casa
//    JÁ marcou presenças hoje — ou seja, quando ficou mesmo a meio.
// 4. O `id` é estável: o mesmo aviso dá sempre o mesmo id, para o cron saber
//    o que já empurrou e não repetir.
// ─────────────────────────────────────────────────────────────────────────────
import { ptDate, ptHHMM } from './ptTime'

export type TipoAviso =
  | 'incidente' | 'familia' | 'medicacao' | 'mural'
  | 'doses' | 'stock' | 'presenca' | 'preparacao'
  | 'toma' | 'caixa'

export interface Aviso {
  /** estável — o mesmo aviso dá sempre o mesmo id */
  id: string
  tipo: TipoAviso
  titulo: string
  corpo: string
  href: string
  quando: string
  urgencia: 'alta' | 'normal'
  /** true = vale a pena interromper alguém com uma notificação */
  empurrar: boolean
}

/** Uma consulta que nunca deita a página abaixo: tabela em falta, RLS a
 *  recusar, o que for — devolve vazio e segue. Um aviso a menos é uma pena;
 *  um sino que rebenta é um problema.
 *
 *  Recebe uma FUNÇÃO, não a consulta já feita: se receber a consulta, ela é
 *  construída antes de entrar aqui e um erro nessa construção passa ao lado do
 *  try. Foi o que um teste apanhou. */
async function tol<T = any>(fazer: () => any): Promise<T[]> {
  try { const r = await fazer(); return (r?.error ? [] : (r?.data || [])) as T[] } catch { return [] }
}

const hhmmParaMin = (s: string): number => {
  const [h, m] = String(s).split(':').map(Number)
  return isNaN(h) ? 0 : h * 60 + (m || 0)
}

/** Em que turno estamos, em hora de Portugal. */
export function turnoAgora(agora = ptHHMM()): 'manha' | 'tarde' | 'noite' {
  const m = hhmmParaMin(agora)
  if (m >= 7 * 60 && m < 14 * 60) return 'manha'
  if (m >= 14 * 60 && m < 21 * 60) return 'tarde'
  return 'noite'
}

/** Do fim do turno em diante.
 *
 *  Começou por ser uma janela de 40 minutos — o fim de cada turno, quando ainda
 *  dá para corrigir. Estava errado por uma razão de fora do código: o relógio é
 *  o GitHub Actions, e o GitHub atrasa e descarta execuções agendadas quando os
 *  runners estão com carga. A 12 e 13 de setembro de 2026 o workflow do Phlox
 *  correu oito vezes em vinte horas, em vez de oitenta — todas verdes. Uma
 *  janela de 40 minutos quase nunca era apanhada.
 *
 *  Alargada, e não faz mal nenhum: cada aviso tem um id estável e é marcado
 *  como enviado, por isso sai UMA vez mesmo que a janela dure horas. O limite
 *  de cima existe só para não avisar de manhã ao fim da tarde. */
const FIM_DE_TURNO: Record<string, [string, string]> = {
  manha: ['13:30', '17:00'],
  tarde: ['20:30', '23:30'],
  noite: ['06:30', '09:00'],
}
const dentroDe = (agora: string, [a, b]: [string, string]) => {
  const n = hhmmParaMin(agora)
  return n >= hhmmParaMin(a) && n <= hhmmParaMin(b)
}

const TIPOS_OCORRENCIA: Record<string, string> = {
  fall: 'Queda', medication_error: 'Erro de medicação', pressure_ulcer: 'Úlcera de pressão',
  behavioral: 'Incidente comportamental', choking: 'Engasgamento', infection: 'Infeção',
  other: 'Ocorrência',
}

// ─────────────────────────────────────────────────────────────────────────────
// A CASA
// ─────────────────────────────────────────────────────────────────────────────

export async function avisosDaInstituicao(
  sb: any,
  orgId: string,
  opts: { agora?: string; hoje?: string; excluirAutor?: string | null; tipoInstituicao?: string | null } = {},
): Promise<Aviso[]> {
  const agora = opts.agora ?? ptHHMM()
  const hoje = opts.hoje ?? ptDate()
  const desde48h = new Date(Date.now() - 48 * 3600000).toISOString()
  const turno = turnoAgora(agora)

  const [utentes, ocorrencias, mensagensFamilia, tomas, mural, stock, presencas, meds] = await Promise.all([
    tol(() => sb.from('patients').select('id, name').eq('org_id', orgId).eq('active', true)),
    tol(() => sb.from('incidents').select('id, date, type, patient_id')
      .eq('org_id', orgId).eq('follow_up_required', true)
      .order('date', { ascending: false }).limit(10)),
    // `content`, não `body`: o nome errado fazia o PostgREST recusar o select
    // inteiro, e o aviso "família à espera" nunca chegou a existir. Apanhado
    // por scripts/check-colunas.mjs.
    tol(() => sb.from('family_thread_messages').select('id, patient_id, content, created_at, author_side')
      .eq('org_id', orgId).gte('created_at', desde48h)
      .order('created_at', { ascending: false }).limit(60)),
    tol(() => sb.from('mar_records').select('id, patient_id, status, med_id, shift, date')
      .eq('org_id', orgId).eq('date', hoje)),
    tol(() => sb.from('team_messages').select('id, channel, body, author_name, author_id, priority, created_at')
      .eq('org_id', orgId).in('priority', ['importante', 'urgente']).eq('resolved', false)
      .gte('created_at', desde48h).order('created_at', { ascending: false }).limit(10)),
    tol(() => sb.from('stock_items').select('id, name, quantity, min_quantity, unit').eq('org_id', orgId)),
    tol(() => sb.from('attendance').select('patient_id, status').eq('org_id', orgId).eq('date', hoje)),
    tol(() => sb.from('patient_meds').select('id, patient_id, name, shifts').eq('org_id', orgId).eq('active', true)),
  ])

  const nome = new Map<string, string>(utentes.map((p: any) => [p.id, p.name]))
  const quem = (id: string) => nome.get(id) || 'Utente'
  const avisos: Aviso[] = []

  // ── 1. Ocorrências com seguimento por fazer ───────────────────────────────
  ocorrencias.forEach((i: any) => avisos.push({
    id: `inc-${i.id}`, tipo: 'incidente',
    titulo: `${TIPOS_OCORRENCIA[i.type] || 'Ocorrência'} · ${quem(i.patient_id)}`,
    corpo: 'Seguimento por fazer.',
    href: '/incidents', quando: i.date, urgencia: 'alta', empurrar: true,
  }))

  // ── 2. Famílias à espera ──────────────────────────────────────────────────
  // Só as que ficaram MESMO sem resposta: se alguém da equipa já escreveu
  // depois, aquilo está tratado e não vale a pena tocar a ninguém.
  const ultimaRespostaDaCasa = new Map<string, string>()
  mensagensFamilia.forEach((m: any) => {
    if (m.author_side === 'family') return
    const atual = ultimaRespostaDaCasa.get(m.patient_id)
    if (!atual || String(m.created_at) > atual) ultimaRespostaDaCasa.set(m.patient_id, String(m.created_at))
  })
  const jaVistos = new Set<string>()
  mensagensFamilia
    .filter((m: any) => m.author_side === 'family')
    .forEach((m: any) => {
      const resposta = ultimaRespostaDaCasa.get(m.patient_id)
      if (resposta && resposta > String(m.created_at)) return    // já respondida
      if (jaVistos.has(m.patient_id)) return                     // uma por família
      jaVistos.add(m.patient_id)
      avisos.push({
        id: `fam-${m.id}`, tipo: 'familia',
        titulo: `Família de ${quem(m.patient_id)} à espera`,
        corpo: String(m.content || '').slice(0, 90),
        href: '/family', quando: m.created_at, urgencia: 'normal', empurrar: true,
      })
    })

  // ── 3. Tomas recusadas ou suspensas hoje ──────────────────────────────────
  tomas.filter((d: any) => d.status === 'refused' || d.status === 'held').forEach((d: any) => avisos.push({
    id: `mar-${d.id}`, tipo: 'medicacao',
    titulo: `${quem(d.patient_id)} · toma ${d.status === 'refused' ? 'recusada' : 'suspensa'}`,
    corpo: 'Confirmar na passagem de turno.',
    href: '/mar', quando: `${d.date}T12:00:00`, urgencia: 'alta', empurrar: true,
  }))

  // ── 4. Mural por resolver ─────────────────────────────────────────────────
  mural
    .filter((m: any) => !opts.excluirAutor || m.author_id !== opts.excluirAutor)
    .forEach((m: any) => avisos.push({
      id: `mural-${m.id}`, tipo: 'mural',
      titulo: `${m.channel} · ${m.author_name}`,
      corpo: String(m.body || '').slice(0, 90),
      href: '/equipa?tab=mural', quando: m.created_at,
      urgencia: m.priority === 'urgente' ? 'alta' : 'normal',
      // Só o urgente interrompe. "Importante" fica no sino — é para ler quando
      // se abrir a aplicação, não para tocar no telemóvel de quem está a jantar.
      empurrar: m.priority === 'urgente',
    }))

  // ── 5. Doses do turno por registar, perto do fim do turno ─────────────────
  // Refeito: a versão anterior procurava os utentes por `user_id` dos
  // coordenadores (perdia quase toda a casa) e contava TODOS os medicamentos
  // ativos em vez de só os do turno (inflava o número).
  // Percorre-se TODOS os turnos com a janela aberta, não só aquele em que
  // estamos. Às 14h o turno muda para a tarde; se olhássemos só para o turno
  // atual, as doses da manhã que ficaram por registar deixavam de ser vistas
  // às 14h01 — e é precisamente depois das 14h que uma passagem atrasada do
  // relógio costuma chegar.
  for (const [qualTurno, janela] of Object.entries(FIM_DE_TURNO)) {
    if (!dentroDe(agora, janela as [string, string])) continue

    const decididas = new Set(
      tomas.filter((r: any) => r.shift === qualTurno && r.status).map((r: any) => `${r.patient_id}|${r.med_id}`))
    const doTurno = meds.filter((m: any) =>
      !Array.isArray(m.shifts) || !m.shifts.length || m.shifts.includes(qualTurno))
    const porRegistar = doTurno.filter((m: any) => !decididas.has(`${m.patient_id}|${m.id}`))
    if (!porRegistar.length) continue

    const pessoas = [...new Set(porRegistar.map((m: any) => quem(m.patient_id)))]
    const rotulo = qualTurno === 'manha' ? 'manhã' : qualTurno === 'tarde' ? 'tarde' : 'noite'
    const jaPassou = hhmmParaMin(agora) > hhmmParaMin((janela as string[])[0]) + 60
    avisos.push({
      id: `doses-${orgId}-${hoje}-${qualTurno}`, tipo: 'doses',
      titulo: `${porRegistar.length} ${porRegistar.length === 1 ? 'dose' : 'doses'} por registar`,
      corpo: `${jaPassou ? `O turno da ${rotulo} acabou` : `Turno da ${rotulo} está a acabar`}. ${pessoas.slice(0, 3).join(', ')}${pessoas.length > 3 ? ` e mais ${pessoas.length - 3}` : ''}.`,
      href: '/mar', quando: new Date().toISOString(), urgencia: 'alta', empurrar: true,
    })
  }

  // ── 6. Stock abaixo do mínimo ─────────────────────────────────────────────
  const emBaixo = stock.filter((i: any) =>
    Number(i.min_quantity) > 0 && Number(i.quantity) <= Number(i.min_quantity))
  if (emBaixo.length) {
    avisos.push({
      id: `stock-${orgId}-${hoje}`, tipo: 'stock',
      titulo: `${emBaixo.length} ${emBaixo.length === 1 ? 'artigo' : 'artigos'} abaixo do mínimo`,
      corpo: emBaixo.slice(0, 3).map((i: any) => `${i.name} (${i.quantity} ${i.unit || 'un'})`).join(', ')
        + (emBaixo.length > 3 ? ` e mais ${emBaixo.length - 3}` : ''),
      href: '/stock', quando: `${hoje}T09:00:00`, urgencia: 'normal',
      // Uma vez por dia, de manhã. Não é uma emergência; é uma ida à farmácia.
      // A janela vai até ao início da tarde porque o relógio pode chegar tarde
      // (ver a nota em FIM_DE_TURNO); o id estável garante que só sai uma vez.
      empurrar: hhmmParaMin(agora) >= 9 * 60 && hhmmParaMin(agora) < 14 * 60,
    })
  }

  // ── 7. Presenças a meio ───────────────────────────────────────────────────
  // SÓ num centro de dia, e SÓ quando a casa já marcou algumas hoje. Uma casa
  // que não usa presenças nunca é incomodada com isto — não se impõe ritmo a
  // quem não pediu. Ver a nota sobre centros de dia na memória do projeto.
  if (opts.tipoInstituicao === 'day_care' && presencas.length > 0) {
    const marcados = new Set(presencas.map((a: any) => a.patient_id))
    const porMarcar = utentes.filter((p: any) => !marcados.has(p.id))
    if (porMarcar.length && hhmmParaMin(agora) >= 10 * 60 && hhmmParaMin(agora) < 15 * 60) {
      avisos.push({
        id: `presenca-${orgId}-${hoje}`, tipo: 'presenca',
        titulo: `${porMarcar.length} sem marca de presença`,
        corpo: `${porMarcar.slice(0, 3).map((p: any) => p.name).join(', ')}${porMarcar.length > 3 ? ` e mais ${porMarcar.length - 3}` : ''}. Chegaram?`,
        href: '/painel', quando: new Date().toISOString(), urgencia: 'normal', empurrar: true,
      })
    }
  }

  avisos.sort((a, b) =>
    a.urgencia === b.urgencia
      ? String(b.quando).localeCompare(String(a.quando))
      : a.urgencia === 'alta' ? -1 : 1)

  return avisos
}

// ─────────────────────────────────────────────────────────────────────────────
// UMA PESSOA (modo pessoal e cuidador)
// ─────────────────────────────────────────────────────────────────────────────
// O sino no header não tinha nada para mostrar fora de uma instituição — daí
// parecer avariado e ter saído. Isto dá-lhe conteúdo: o que falta tomar hoje e
// o que está a acabar.

export async function avisosPessoais(
  sb: any,
  userId: string,
  opts: { agora?: string; hoje?: string } = {},
): Promise<Aviso[]> {
  const agora = opts.agora ?? ptHHMM()
  const hoje = opts.hoje ?? ptDate()
  const minAgora = hhmmParaMin(agora)

  const [meds, tomasHoje] = await Promise.all([
    // Sem `shifts`: essa coluna não existe em personal_meds e fazia o select
    // inteiro ser recusado — o `tol` devolvia lista vazia e o sino do modo
    // pessoal ficava sempre vazio, calado, sem erro nenhum.
    tol(() => sb.from('personal_meds')
      .select('id, name, dose, reminder_times, units_left, units_per_dose')
      .eq('user_id', userId)),
    tol(() => sb.from('med_logs').select('med_id, status').eq('user_id', userId).eq('date', hoje)),
  ])

  const jaTomados = new Set(tomasHoje.filter((l: any) => l.status === 'taken').map((l: any) => l.med_id))
  const avisos: Aviso[] = []

  meds.forEach((m: any) => {
    // ── A hora já passou e ainda não ficou marcado ────────────────────────
    const horas: string[] = Array.isArray(m.reminder_times) ? m.reminder_times : []
    const passadas = horas.filter(h => hhmmParaMin(h) <= minAgora)
    if (passadas.length && !jaTomados.has(m.id)) {
      const ultima = passadas[passadas.length - 1]
      avisos.push({
        id: `toma-${m.id}-${hoje}-${ultima}`, tipo: 'toma',
        titulo: `${m.name}${m.dose ? ` ${m.dose}` : ''}`,
        corpo: `Estava marcado para as ${ultima} e ainda não ficou registado.`,
        href: `/mymeds?confirm=${m.id}&date=${hoje}`,
        quando: `${hoje}T${ultima}:00`, urgencia: 'normal', empurrar: false,
      })
    }

    // ── A caixa está a acabar ─────────────────────────────────────────────
    const restam = Number(m.units_left)
    const porDose = Number(m.units_per_dose) || 1
    if (!isNaN(restam) && restam > 0 && porDose > 0) {
      const porDia = horas.length || 1
      const dias = Math.floor(restam / (porDose * porDia))
      if (dias <= 7) {
        avisos.push({
          id: `caixa-${m.id}-${hoje}`, tipo: 'caixa',
          titulo: `${m.name} está a acabar`,
          corpo: dias <= 0
            ? 'Já não há unidades suficientes para a próxima toma.'
            : `Chega para mais ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
          href: '/mymeds', quando: `${hoje}T09:00:00`,
          urgencia: dias <= 1 ? 'alta' : 'normal', empurrar: false,
        })
      }
    }
  })

  avisos.sort((a, b) =>
    a.urgencia === b.urgencia
      ? String(b.quando).localeCompare(String(a.quando))
      : a.urgencia === 'alta' ? -1 : 1)

  return avisos
}
