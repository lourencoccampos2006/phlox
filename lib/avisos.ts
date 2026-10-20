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
import { rotuloTipo, sobreQuem } from './ocorrencias'
import { formacoesEmRisco, type Formacao } from './equipaRh'

export type TipoAviso =
  | 'incidente' | 'familia' | 'medicacao' | 'mural'
  | 'doses' | 'stock' | 'presenca' | 'preparacao'
  | 'validades' | 'avaliacoes'
  | 'toma' | 'caixa' | 'resumo_dia' | 'consulta'
  /** «Ficou consigo»: uma coisa concreta atribuída a esta pessoa. */
  | 'atribuicao'
  /** O turno anterior deixou uma passagem, e ninguém a leu. */
  | 'passagem'
  /** Uma ronda foi começada e ficou a meio. */
  | 'ronda'
  /** Alguém da equipa tem formação caducada ou prestes a caducar. */
  | 'formacao'
  /** «Tem seis coisas suas esta manhã»: o resumo, e o único que interrompe. */
  | 'meu_turno'
  /** Amanhã há uma consulta, um transporte ou uma atividade marcada. */
  | 'vespera'

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

const ROTULO_DE_TURNO: Record<string, string> = {
  manha: 'manhã', tarde: 'tarde', noite: 'noite',
}

/** O dia anterior, em texto. Sem fusos: é só aritmética de calendário.
 *  O `T12:00:00` não é um detalhe — às 00:00 o `toISOString` devolve o dia
 *  anterior em qualquer fuso a oeste de Greenwich, e Portugal é um deles no
 *  inverno. Ao meio-dia há doze horas de folga de cada lado. */
const ontemDe = (dia: string): string => {
  const d = new Date(dia + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** E o dia seguinte, pela mesma aritmética. */
const amanhaDe = (dia: string): string => {
  const d = new Date(dia + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}


// ─────────────────────────────────────────────────────────────────────────────
// A CASA
// ─────────────────────────────────────────────────────────────────────────────

export async function avisosDaInstituicao(
  sb: any,
  orgId: string,
  opts: {
    agora?: string; hoje?: string
    /** Não me mostres os recados que fui eu que escrevi. */
    excluirAutor?: string | null
    /** Quem está a perguntar. Sem isto não há avisos de atribuição — eles são
     *  de uma pessoa, não da casa. */
    euId?: string | null
    tipoInstituicao?: string | null
  } = {},
): Promise<Aviso[]> {
  const agora = opts.agora ?? ptHHMM()
  const hoje = opts.hoje ?? ptDate()
  const desde48h = new Date(Date.now() - 48 * 3600000).toISOString()
  const turno = turnoAgora(agora)

  const [utentes, ocorrencias, mensagensFamilia, tomas, mural, stock, presencas, meds,
         preparacoes, avaliacoes, passagens, leiturasPassagem, rondas, atribuicoesRonda,
         formacoes, membrosDaEquipa,
         consultasAmanha, transportesAmanha, atividadesAmanha] = await Promise.all([
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
    tol(() => sb.from('stock_items').select('id, name, quantity, min_quantity, unit, expiry_date').eq('org_id', orgId)),
    tol(() => sb.from('attendance').select('patient_id, status').eq('org_id', orgId).eq('date', hoje)),
    tol(() => sb.from('patient_meds').select('id, patient_id, name, shifts').eq('org_id', orgId).eq('active', true)),
    tol(() => sb.from('medication_prep_logs').select('patient_id, week_start, weekday, packed').eq('org_id', orgId)),
    tol(() => sb.from('assessments').select('patient_id, date').eq('org_id', orgId)),
    // A passagem do turno ANTERIOR (a deste ainda se está a escrever) e quem
    // já a leu. As duas juntas respondem a «alguém leu isto?».
    tol(() => sb.from('handovers').select('id, date, shift, autor_nome, completed')
      .eq('org_id', orgId).eq('completed', true)
      .gte('date', ontemDe(hoje)).order('date', { ascending: false }).limit(4)),
    tol(() => sb.from('passagem_leituras').select('passagem_id, user_id').eq('org_id', orgId)),
    // As rondas de hoje, e o que ficou por atender em cada uma.
    tol(() => sb.from('rounds').select('id, shift, status').eq('org_id', orgId).eq('date', hoje)),
    tol(() => sb.from('round_assignments').select('round_id, status, patient_id').eq('org_id', orgId)),
    // Só as que TÊM validade: as outras não podem caducar, e trazê-las era
    // pedir a tabela inteira para a filtrar em memória.
    tol(() => sb.from('formacoes_da_equipa')
      .select('id, team_member_id, tema, data, valida_ate')
      .eq('org_id', orgId).not('valida_ate', 'is', null)),
    tol(() => sb.from('team_members').select('id, name').eq('org_id', orgId)),

    /* ── O QUE HÁ AMANHÃ ────────────────────────────────────────────────────
       «Tem de dar notificações com alguma antecedência para relembrar.»

       Uma consulta marcada para amanhã às 14h não serve de nada se ninguém se
       lembrar dela hoje: há transporte a combinar, há quem tenha de ir, e às
       vezes há jejum. O aviso sai na VÉSPERA, à tarde — ver a nota lá em
       baixo sobre a hora.

       `select('*')` nos transportes: a `kind` e a `data` são colunas
       acrescentadas depois da tabela nascer, e nomear uma que não exista faz
       o PostgREST recusar a consulta inteira. */
    tol(() => sb.from('appointments')
      .select('id, patient_id, title, date, time, location, type, status')
      .eq('org_id', orgId).eq('date', amanhaDe(hoje))),
    tol(() => sb.from('support_transport_schedules')
      .select('*').eq('org_id', orgId).eq('active', true).eq('data', amanhaDe(hoje))),
    tol(() => sb.from('activities')
      .select('id, title, date, start_time, location, status')
      .eq('org_id', orgId).eq('date', amanhaDe(hoje))),
  ])

  const nome = new Map<string, string>(utentes.map((p: any) => [p.id, p.name]))
  const quem = (id: string) => nome.get(id) || 'Utente'
  const avisos: Aviso[] = []

  // ── 1. Ocorrências com seguimento por fazer ───────────────────────────────
  ocorrencias.forEach((i: any) => avisos.push({
    id: `inc-${i.id}`, tipo: 'incidente',
    // Sem utente é da casa. «Ocorrência · Utente» num aviso mandava alguém
    // procurar uma pessoa que não existe.
    titulo: `${rotuloTipo(i.type)} · ${sobreQuem(i.type, i.patient_id ? quem(i.patient_id) : null)}`,
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

  // ── 8. Validades a expirar ────────────────────────────────────────────────
  // Um medicamento fora do prazo é um medicamento que não se pode dar, e
  // descobre-se sempre à hora de o dar. Trinta dias chegam para repor.
  const aExpirar = stock.filter((i: any) => {
    if (!i.expiry_date) return false
    const dias = Math.round((new Date(i.expiry_date + 'T12:00:00').getTime() - new Date(hoje + 'T12:00:00').getTime()) / 86400000)
    return dias <= 30
  })
  if (aExpirar.length) {
    const jaFora = aExpirar.filter((i: any) => i.expiry_date < hoje).length
    avisos.push({
      id: `validades-${orgId}-${hoje}`, tipo: 'validades',
      titulo: jaFora
        ? `${jaFora} ${jaFora === 1 ? 'artigo fora' : 'artigos fora'} do prazo`
        : `${aExpirar.length} ${aExpirar.length === 1 ? 'artigo a expirar' : 'artigos a expirar'}`,
      corpo: aExpirar.slice(0, 3).map((i: any) => `${i.name} (${i.expiry_date})`).join(', ')
        + (aExpirar.length > 3 ? ` e mais ${aExpirar.length - 3}` : ''),
      href: '/stock', quando: `${hoje}T09:00:00`,
      urgencia: jaFora ? 'alta' : 'normal',
      empurrar: hhmmParaMin(agora) >= 9 * 60 && hhmmParaMin(agora) < 14 * 60,
    })
  }

  // ── 9. Pastilheiro de amanhã ──────────────────────────────────────────────
  // Só se a casa USA o pastilheiro. Uma casa que prepara a medicação de outra
  // maneira não tem de levar com isto todas as tardes — não se impõe ritmo a
  // quem não pediu. É a mesma regra das presenças.
  if (preparacoes.length > 0 && hhmmParaMin(agora) >= 17 * 60 && hhmmParaMin(agora) < 20 * 60) {
    const amanha = new Date(hoje + 'T12:00:00')
    amanha.setDate(amanha.getDate() + 1)
    const diaSemana = amanha.getDay()
    const domingo = new Date(amanha)
    domingo.setDate(domingo.getDate() - diaSemana)
    const semana = `${domingo.getFullYear()}-${String(domingo.getMonth() + 1).padStart(2, '0')}-${String(domingo.getDate()).padStart(2, '0')}`

    const prontos = new Set(
      preparacoes
        .filter((r: any) => r.week_start === semana && r.weekday === diaSemana && r.packed)
        .map((r: any) => r.patient_id))
    const porPreparar = utentes.filter((p: any) => !prontos.has(p.id))

    if (porPreparar.length) {
      avisos.push({
        id: `preparacao-${orgId}-${hoje}`, tipo: 'preparacao',
        titulo: `Pastilheiro de amanhã: ${porPreparar.length} por preparar`,
        corpo: `${porPreparar.slice(0, 3).map((p: any) => p.name).join(', ')}${porPreparar.length > 3 ? ` e mais ${porPreparar.length - 3}` : ''}.`,
        href: '/preparacao-medicacao', quando: new Date().toISOString(),
        urgencia: 'normal', empurrar: true,
      })
    }
  }

  // ── 10. Avaliações desatualizadas ─────────────────────────────────────────
  // Uma vez por semana, à segunda. É um lembrete de fundo, não uma urgência —
  // e vem desligado por omissão (ver lib/notificacoes). Também só aparece a
  // casas que JÁ fazem avaliações.
  const segunda = new Date(hoje + 'T12:00:00').getDay() === 1
  if (avaliacoes.length > 0 && segunda && hhmmParaMin(agora) >= 9 * 60 && hhmmParaMin(agora) < 14 * 60) {
    const maisRecente = new Map<string, string>()
    avaliacoes.forEach((a: any) => {
      const d = String(a.date || '').slice(0, 10)
      if (!d) return
      const atual = maisRecente.get(a.patient_id)
      if (!atual || d > atual) maisRecente.set(a.patient_id, d)
    })
    const limite = new Date(hoje + 'T12:00:00')
    limite.setDate(limite.getDate() - 90)
    const limiteISO = limite.toISOString().slice(0, 10)

    const desatualizados = utentes.filter((p: any) => {
      const d = maisRecente.get(p.id)
      return !d || d < limiteISO
    })
    if (desatualizados.length) {
      avisos.push({
        id: `avaliacoes-${orgId}-${hoje}`, tipo: 'avaliacoes',
        titulo: `${desatualizados.length} ${desatualizados.length === 1 ? 'pessoa sem avaliação' : 'pessoas sem avaliação'} há mais de 90 dias`,
        corpo: `${desatualizados.slice(0, 3).map((p: any) => p.name).join(', ')}${desatualizados.length > 3 ? ` e mais ${desatualizados.length - 3}` : ''}.`,
        href: '/patients', quando: new Date().toISOString(),
        urgencia: 'normal', empurrar: true,
      })
    }
  }

  // ── 11. Uma passagem de turno por ler ─────────────────────────────────────
  // «Carers access handovers at the start of their shift, marking them as
  // read» — é o recibo de leitura que faz a passagem valer alguma coisa. Uma
  // passagem que ninguém confirma ter lido é um papel em cima da mesa.
  //
  // Só a MAIS RECENTE, e só se ninguém a leu. Uma por dia era ruído; uma por
  // cada pessoa que ainda não leu era pior, porque o sino é da casa e não de
  // uma pessoa.
  const passagemPorLer = passagens.find((p: any) =>
    !leiturasPassagem.some((l: any) => l.passagem_id === p.id))
  if (passagemPorLer) {
    avisos.push({
      id: `passagem-${passagemPorLer.id}`, tipo: 'passagem',
      titulo: `Passagem da ${ROTULO_DE_TURNO[passagemPorLer.shift] || 'turno'} por ler`,
      corpo: passagemPorLer.autor_nome
        ? `Deixada por ${passagemPorLer.autor_nome}. Ninguém marcou que a leu.`
        : 'Ninguém marcou que a leu.',
      href: '/passagem', quando: `${passagemPorLer.date}T12:00:00`,
      urgencia: 'alta', empurrar: true,
    })
  }

  // ── 12. Uma ronda deixada a meio ──────────────────────────────────────────
  // «If a round is missed, you'll see an alert within the Care Office.»
  //
  // ── E SÓ AVISA DE UMA RONDA QUE ALGUÉM COMEÇOU ──────────────────────────
  // Não há aqui nenhum aviso de «hoje não fez ronda». Uma casa que não use
  // rondas — e um centro de dia normalmente não usa — não pode ser chamada à
  // atenção por não fazer uma coisa que nunca prometeu fazer. É a mesma regra
  // das presenças: só se fala quando a casa JÁ começou e ficou a meio.
  for (const r of rondas.filter((x: any) => x.status === 'active')) {
    const porAtender = atribuicoesRonda.filter(
      (a: any) => a.round_id === r.id && a.status === 'pending').length
    if (!porAtender) continue
    // Só depois de o turno ter acabado. A meio do turno uma ronda aberta com
    // pessoas por atender é exactamente o que se espera de uma ronda a
    // decorrer — avisar aí seria avisar do normal.
    const janela = FIM_DE_TURNO[r.shift]
    if (!janela || !dentroDe(agora, janela)) continue
    avisos.push({
      id: `ronda-${r.id}-${hoje}`, tipo: 'ronda',
      titulo: `Ronda da ${ROTULO_DE_TURNO[r.shift] || 'turno'} ficou a meio`,
      corpo: `${porAtender} ${porAtender === 1 ? 'pessoa por atender' : 'pessoas por atender'}.`,
      href: '/ronda-guiada', quando: `${hoje}T12:00:00`,
      urgencia: 'alta', empurrar: true,
    })
  }

  // ── 13. Formação da equipa a caducar ──────────────────────────────────────
  // «A ASAE verifica a formação dos colaboradores» — e é a primeira coisa que
  // pede, antes sequer de olhar para o plano HACCP.
  //
  // ── UM AVISO POR CASA, E NÃO UM POR PESSOA ────────────────────────────────
  // Cinco auxiliares com o suporte básico de vida a caducar no mesmo mês dão
  // cinco avisos iguais, e o sino fica com cinco linhas que dizem a mesma
  // coisa. Uma linha com o total manda a pessoa ao sítio certo, que é onde
  // estão os nomes.
  //
  // E a conta é a de `lib/equipaRh`, a mesma que a ficha de cada funcionário
  // usa: quem renovou NÃO aparece, mesmo tendo a antiga caducada. Uma segunda
  // implementação disto acabaria por acusar gente que está em dia — e uma
  // lista com falsos alarmes deixa de ser lida.
  {
    const emRisco = formacoesEmRisco(formacoes as unknown as Formacao[], hoje)
    if (emRisco.length) {
      const nomes = new Map<string, string>(membrosDaEquipa.map((m: any) => [m.id, m.name]))
      const caducadas = emRisco.filter(r => r.estado === 'caducada')
      const quem = emRisco.slice(0, 3)
        .map(r => `${nomes.get(r.formacao.team_member_id) || 'Colega'} (${r.formacao.tema})`)
        .join(', ')

      avisos.push({
        id: `formacao-${orgId}-${hoje.slice(0, 7)}`, tipo: 'formacao',
        titulo: caducadas.length
          ? `${caducadas.length} ${caducadas.length === 1 ? 'formação caducada' : 'formações caducadas'} na equipa`
          : `${emRisco.length} ${emRisco.length === 1 ? 'formação a caducar' : 'formações a caducar'}`,
        corpo: `${quem}${emRisco.length > 3 ? ` e mais ${emRisco.length - 3}` : ''}.`,
        href: '/equipa?tab=escalas',
        quando: new Date().toISOString(),
        // Caducada é diferente de a caducar: a primeira já é uma falha numa
        // inspeção, a segunda ainda dá para marcar.
        urgencia: caducadas.length ? 'alta' : 'normal',
        empurrar: true,
      })
    }
  }

  // ── 14. O que ficou consigo ───────────────────────────────────────────────
  // Só para quem está a perguntar. Um aviso de atribuição não é da casa: é de
  // uma pessoa, e mostrá-lo a toda a gente transformava-o em ruído para nove
  // e informação para um.
  if (opts.euId) {
    const minhas = await atribuicoesDaCasa(sb, orgId, {
      hoje, agora, euId: opts.euId, nomes: nome, tipoInstituicao: opts.tipoInstituicao,
    })
    avisos.push(...(minhas.get(opts.euId) || []))
  }

  /* ── O QUE HÁ AMANHÃ ─────────────────────────────────────────────────────
     «O calendário tem de dar notificações com alguma antecedência para
      relembrar.» (Fernando)

     ── PORQUE É QUE SAI À TARDE, E NÃO DE MANHÃ ──────────────────────────
     Um aviso de manhã sobre amanhã chega trinta horas antes: ouve-se, segue-se
     o dia, e esquece-se na mesma. À tarde, quem o recebe ainda está no
     trabalho e ainda tem com quem falar — dá para combinar o transporte,
     avisar a família, pôr na passagem de turno.

     Entre as 16h e as 21h: antes das 16 ainda é o meio do dia de hoje; depois
     das 21 já não há a quem dizer nada.

     ── E PORQUE É QUE NÃO SE GRAVA NADA ─────────────────────────────────
     O aviso É a marcação, vista de outro ângulo. Desmarca-se a consulta e o
     aviso desaparece no mesmo instante; muda-se a hora e o aviso muda com ela.
     Uma tabela de lembretes teria de ser limpa por quem desmarca — e nunca é. */
  const horaAgora = hhmmParaMin(agora)
  if (horaAgora >= 16 * 60 && horaAgora < 21 * 60) {
    const amanha = amanhaDe(hoje)

    consultasAmanha.forEach((c: any) => {
      if (c.status === 'cancelled') return
      const h = String(c.time || '').slice(0, 5)
      avisos.push({
        id: `vespera-consulta-${c.id}`, tipo: 'vespera',
        titulo: `Amanhã: ${String(c.title || 'consulta').slice(0, 54)}`,
        corpo: [
          c.patient_id ? quem(c.patient_id) : null,
          h ? `às ${h}` : null,
          c.location,
        ].filter(Boolean).join(' · ') || 'Está marcada para amanhã.',
        href: '/agenda', quando: `${amanha}T${h || '09:00'}:00`,
        urgencia: 'normal', empurrar: true,
      })
    })

    transportesAmanha.forEach((t: any) => {
      const h = String(t.time || '').slice(0, 5)
      const o = t.label || t.destino || 'Transporte'
      avisos.push({
        id: `vespera-transporte-${t.id}`, tipo: 'vespera',
        titulo: `Amanhã: ${String(o).slice(0, 54)}`,
        corpo: [
          t.patient_id ? quem(t.patient_id) : null,
          h ? `às ${h}` : null,
          t.destino && t.destino !== o ? t.destino : null,
        ].filter(Boolean).join(' · ') || 'Há transporte marcado para amanhã.',
        href: '/apoio-servicos', quando: `${amanha}T${h || '09:00'}:00`,
        urgencia: 'normal', empurrar: true,
      })
    })

    /* As atividades não interrompem ninguém (`empurrar: false`).
       Numa casa há uma ou duas por dia, todos os dias — uma notificação por
       cada uma, todas as tardes, é o caminho mais curto para a equipa desligar
       as notificações. No sino ficam; na mão de ninguém vibram. */
    atividadesAmanha.forEach((a: any) => {
      if (a.status === 'cancelled') return
      const h = String(a.start_time || '').slice(0, 5)
      avisos.push({
        id: `vespera-atividade-${a.id}`, tipo: 'vespera',
        titulo: `Amanhã: ${String(a.title || 'atividade').slice(0, 54)}`,
        corpo: [h ? `às ${h}` : null, a.location].filter(Boolean).join(' · ')
          || 'Está no plano de atividades.',
        href: '/activities', quando: `${amanha}T${h || '10:00'}:00`,
        urgencia: 'normal', empurrar: false,
      })
    })
  }

  avisos.sort((a, b) =>
    a.urgencia === b.urgencia
      ? String(b.quando).localeCompare(String(a.quando))
      : a.urgencia === 'alta' ? -1 : 1)

  return avisos
}

// ─────────────────────────────────────────────────────────────────────────────
// O QUE FICOU CONSIGO
// ─────────────────────────────────────────────────────────────────────────────
// ── O QUE O FERNANDO PEDIU ──────────────────────────────────────────────────
// «Ao atribuir podia haver um canal de avisos pessoais, automáticos, enviados
// pelo Phlox automaticamente, a dizer a tarefa e com um "link" para a ver
// completa.»
//
// ── PORQUE É QUE O AVISO NÃO SE GRAVA AO ATRIBUIR ───────────────────────────
// O caminho óbvio era: alguém atribui, e o código escreve uma linha numa
// tabela de avisos. É o que quase toda a gente faz, e cria quatro problemas
// que depois se arrastam para sempre.
//
// Um: quem tira o responsável fica com o aviso lá. A tarefa já não é sua e o
// sino continua a dizer que é — e ninguém volta a acreditar no sino.
// Dois: a tarefa é feita e o aviso fica. Era preciso lembrar-se de o apagar em
// cada um dos sítios que marcam coisas como feitas.
// Três: a escrita pode falhar. A atribuição fica gravada e o aviso não, e a
// pessoa nunca soube — em silêncio, que é a pior maneira de não saber.
// Quatro: uma tabela de avisos cresce para sempre e é preciso limpá-la.
//
// Calculado, nada disto existe. O aviso É a atribuição, vista de outro ângulo:
// tira-se o responsável e o aviso desaparece no mesmo instante; marca-se a
// coisa como feita e desaparece também; não há nada que possa falhar à parte,
// nem nada para limpar.
//
// ── UMA CHAMADA POR CASA, NÃO UMA POR PESSOA ────────────────────────────────
// Devolve um mapa de `userId` → avisos, e não a lista de uma pessoa. O sino
// pede o de uma pessoa (e aí as consultas já vão filtradas), mas o cron das
// notificações percorre a casa inteira — e pedir pessoa a pessoa seriam quatro
// consultas vezes quinze membros, de quinze em quinze minutos, para sempre.
// No plano gratuito do Supabase o tecto é o NÚMERO de chamadas.

/** Como se chama, no aviso, o sítio de onde a coisa vem. */
const ROTULO_ATRIBUICAO: Record<string, string> = {
  servico: 'Cuidado', plano: 'Plano', apoio: 'Apoio', atividade: 'Atividade',
}

const rotuloTurno = (t: string | null): string =>
  t === 'manha' ? 'de manhã' : t === 'tarde' ? 'à tarde' : t === 'noite' ? 'à noite' : 'hoje'

export async function atribuicoesDaCasa(
  sb: any,
  orgId: string,
  opts: {
    hoje?: string; agora?: string
    /** Só as desta pessoa — e aí as consultas vão filtradas à partida. */
    euId?: string | null
    /** Os nomes dos utentes, se quem chama já os tiver. Poupa uma consulta. */
    nomes?: Map<string, string>
    tipoInstituicao?: string | null
  } = {},
): Promise<Map<string, Aviso[]>> {
  const hoje = opts.hoje ?? ptDate()
  const agora = opts.agora ?? ptHHMM()
  const turno = turnoAgora(agora)

  /** Da casa, e — quando é para uma pessoa só — só as dela. */
  const meu = (q: any) => {
    const comOrg = q.eq('org_id', orgId)
    return opts.euId ? comOrg.eq('responsavel_id', opts.euId) : comOrg.not('responsavel_id', 'is', null)
  }

  const [servicos, acoes, apoios, atividades, nomesCarregados] = await Promise.all([
    tol(() => meu(sb.from('servicos_do_utente')
      .select('id, patient_id, servico_id, turno, hora, responsavel_id')).eq('ativo', true)),
    tol(() => meu(sb.from('plano_acoes')
      .select('id, o_que, turno, hora, responsavel_id')).eq('ativa', true)),
    tol(() => meu(sb.from('support_services')
      .select('id, patient_id, kind, status, responsavel_id')).eq('date', hoje).neq('status', 'concluido')),
    tol(() => meu(sb.from('activities')
      .select('id, title, start_time, status, responsavel_id')).eq('date', hoje).in('status', ['planned', 'ongoing'])),
    opts.nomes
      ? Promise.resolve([] as any[])
      : tol(() => sb.from('patients').select('id, name').eq('org_id', orgId).eq('active', true)),
  ])

  const nomes = opts.nomes
    ?? new Map<string, string>(nomesCarregados.map((p: any) => [p.id, p.name]))
  const quemE = (id: string | null) => (id && nomes.get(id)) || 'Utente'

  // O nome do serviço vem do catálogo. Sem isto o aviso dizia «Cuidado ·
  // Dona Maria» — que não diz QUAL, e por isso não chega para decidir se vale
  // a pena ir lá agora.
  const idsServico = [...new Set(servicos.map((s: any) => s.servico_id).filter(Boolean))]
  const catalogo = idsServico.length
    ? await tol(() => sb.from('catalogo_servicos').select('id, nome').in('id', idsServico))
    : []
  const nomeServico = new Map<string, string>(catalogo.map((c: any) => [c.id, c.nome]))

  const porPessoa = new Map<string, Aviso[]>()
  const juntar = (userId: string | null, a: Aviso) => {
    if (!userId) return
    const l = porPessoa.get(userId)
    if (l) l.push(a); else porPessoa.set(userId, [a])
  }

  /** Um aviso por coisa. Nenhum deles interrompe — ver o resumo, lá em baixo. */
  const linha = (id: string, fonte: string, titulo: string, corpo: string, href: string): Aviso => ({
    id, tipo: 'atribuicao',
    titulo, corpo: `${ROTULO_ATRIBUICAO[fonte] || 'Tarefa'} · ${corpo}`,
    href, quando: `${hoje}T${agora}:00`, urgencia: 'normal', empurrar: false,
  })

  servicos.forEach((s: any) => juntar(s.responsavel_id, linha(
    `atr-servico-${s.id}-${hoje}`, 'servico',
    `${nomeServico.get(s.servico_id) || 'Cuidado'} · ${quemE(s.patient_id)}`,
    s.hora ? `às ${s.hora}` : rotuloTurno(s.turno),
    // O link «para a ver completa» é a ficha da pessoa: é lá que está como se
    // faz com ELA — «prefere de manhã», «precisa de ajuda de dois» — que é
    // exactamente o que falta a quem vai fazer aquilo pela primeira vez.
    `/patients/${s.patient_id}`,
  )))

  acoes.forEach((a: any) => juntar(a.responsavel_id, linha(
    `atr-plano-${a.id}-${hoje}`, 'plano',
    a.o_que || 'Ação do plano',
    a.hora ? `às ${a.hora}` : rotuloTurno(a.turno),
    '/o-dia',
  )))

  apoios.forEach((s: any) => juntar(s.responsavel_id, linha(
    `atr-apoio-${s.id}-${hoje}`, 'apoio',
    `${s.kind || 'Apoio'} · ${quemE(s.patient_id)}`,
    'pedido por tratar', '/apoio-servicos',
  )))

  atividades.forEach((a: any) => juntar(a.responsavel_id, linha(
    `atr-ativ-${a.id}-${hoje}`, 'atividade',
    a.title || 'Atividade',
    a.start_time ? `às ${String(a.start_time).slice(0, 5)}` : 'hoje',
    '/activities',
  )))

  // ── O resumo, e é este o único que toca ───────────────────────────────────
  // Quem tem quinze coisas suas não pode receber quinze notificações: são
  // quinze razões para desligar o Phlox. Recebe uma, que diz quantas são.
  //
  // O id leva o TURNO, e não a hora: o cron guarda o que já empurrou por id, e
  // assim isto sai uma vez de manhã e uma vez à tarde — e não de quinze em
  // quinze minutos, que é de quanto em quanto tempo o cron corre.
  for (const [userId, lista] of porPessoa) {
    lista.push({
      id: `meu-${orgId}-${userId}-${hoje}-${turno}`, tipo: 'meu_turno',
      titulo: lista.length === 1 ? 'Tem uma coisa sua' : `Tem ${lista.length} coisas suas`,
      corpo: lista.slice(0, 3).map(a => a.titulo).join(' · '),
      href: '/o-dia', quando: `${hoje}T${agora}:00`,
      urgencia: 'normal', empurrar: true,
    })
  }

  return porPessoa
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

  const amanhaD = new Date(hoje + 'T12:00:00')
  amanhaD.setDate(amanhaD.getDate() + 1)
  const amanha = amanhaD.toISOString().slice(0, 10)

  const [meds, tomasHoje, agenda] = await Promise.all([
    // Sem `shifts`: essa coluna não existe em personal_meds e fazia o select
    // inteiro ser recusado — o `tol` devolvia lista vazia e o sino do modo
    // pessoal ficava sempre vazio, calado, sem erro nenhum.
    tol(() => sb.from('personal_meds')
      .select('id, name, dose, reminder_times, units_left, units_per_dose')
      .eq('user_id', userId)),
    tol(() => sb.from('med_logs').select('med_id, status').eq('user_id', userId).eq('date', hoje)),
    // A agenda pessoal (cal_events). As `appointments` são dos utentes de uma
    // casa, não da própria pessoa — tabelas diferentes, propósitos diferentes.
    tol(() => sb.from('cal_events').select('id, title, starts_at, kind, location')
      .eq('user_id', userId)
      .gte('starts_at', `${amanha}T00:00:00`)
      .lte('starts_at', `${amanha}T23:59:59`)),
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

  // ── O que ficou por marcar hoje ───────────────────────────────────────────
  // Ao fim do dia, uma só linha em vez de um lembrete por medicamento. Quem
  // teve o dia cheio não precisa de cinco notificações às dez da noite; precisa
  // de saber que ficaram duas por confirmar.
  if (hhmmParaMin(agora) >= 20 * 60 && hhmmParaMin(agora) < 23 * 60) {
    const porConfirmar = meds.filter((m: any) => {
      const horas: string[] = Array.isArray(m.reminder_times) ? m.reminder_times : []
      return horas.some(h => hhmmParaMin(h) <= minAgora) && !jaTomados.has(m.id)
    })
    if (porConfirmar.length) {
      avisos.push({
        id: `resumo-${userId}-${hoje}`, tipo: 'resumo_dia',
        titulo: porConfirmar.length === 1
          ? 'Ficou uma toma por confirmar'
          : `Ficaram ${porConfirmar.length} tomas por confirmar`,
        corpo: porConfirmar.slice(0, 3).map((m: any) => m.name).join(', ')
          + (porConfirmar.length > 3 ? ` e mais ${porConfirmar.length - 3}` : '')
          + '. Se tomaste, marca — se não tomaste, também é bom ficar registado.',
        href: '/mymeds', quando: `${hoje}T21:00:00`, urgencia: 'normal', empurrar: true,
      })
    }
  }

  // ── Consulta amanhã ───────────────────────────────────────────────────────
  // Na véspera, à tarde. Não de manhã: de manhã ainda faltam trinta horas e
  // esquece-se na mesma.
  if (agenda.length && hhmmParaMin(agora) >= 17 * 60 && hhmmParaMin(agora) < 21 * 60) {
    agenda.forEach((e: any) => {
      const hora = String(e.starts_at || '').slice(11, 16)
      avisos.push({
        id: `consulta-${e.id}`, tipo: 'consulta',
        titulo: `Amanhã: ${String(e.title || 'marcação').slice(0, 60)}`,
        corpo: [hora && `às ${hora}`, e.location].filter(Boolean).join(' · ') || 'Está na tua agenda.',
        href: '/agenda', quando: String(e.starts_at), urgencia: 'normal', empurrar: true,
      })
    })
  }

  avisos.sort((a, b) =>
    a.urgencia === b.urgencia
      ? String(b.quando).localeCompare(String(a.quando))
      : a.urgencia === 'alta' ? -1 : 1)

  return avisos
}
