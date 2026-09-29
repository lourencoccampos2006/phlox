// app/api/rounds/route.ts
// Rondas coordenadas (multi-funcionário) — ver sprint107.
//   GET ?id=            → estado de uma ronda (participantes + atribuições)
//   GET                 → ronda ATIVA de hoje da org (ou null)
//   POST {action:'start', participants, shift}
//                       → cria ronda, divide os utentes ativos pelos participantes
//   POST {action:'attend', assignment_id, outcome, note}
//                       → o funcionário atual atende: TRANSFERE para si + regista
//                         (care_records) e marca done. Auto-transfer se era de outro.
//   POST {action:'end', id}  → fecha a ronda
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
async function ctx(db: any) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: prof } = await db.from('profiles').select('active_org_id, org_id, name').eq('id', user.id).maybeSingle()
  return { user, orgId: prof?.active_org_id || prof?.org_id || null, name: prof?.name || 'Equipa' }
}
const setupErr = (m: string) => /rounds|round_assignments/.test(m) && /does not exist|relation/.test(m)

export async function GET(req: NextRequest) {
  const db = sb(req); const c = await ctx(db)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const id = req.nextUrl.searchParams.get('id')
  const scopeCol = c.orgId ? 'org_id' : 'user_id'
  const scopeVal = c.orgId || c.user.id
  let round
  if (id) {
    const r = await db.from('rounds').select('*').eq('id', id).maybeSingle()
    if (r.error && setupErr(r.error.message)) return NextResponse.json({ needsSetup: true })
    round = r.data
  } else {
    const today = new Date().toISOString().slice(0, 10)
    const r = await db.from('rounds').select('*').eq(scopeCol, scopeVal).eq('status', 'active').eq('date', today).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (r.error && setupErr(r.error.message)) return NextResponse.json({ needsSetup: true })
    round = r.data
  }
  if (!round) return NextResponse.json({ round: null })
  const { data: assignments } = await db.from('round_assignments').select('*').eq('round_id', round.id)
  return NextResponse.json({ round, assignments: assignments || [], me: c.user.id })
}

// Dados de UM utente para a ronda: medicação ativa + tomas de hoje (para dar
// medicação a partir da ronda, atualizando o /mar) + tarefas de cuidado
// recorrentes de hoje (fusão 2026-08-07 das abas "Saúde & Apoio"/"Cuidados"
// do /care-log para dentro da ronda — ver care_checklists/care_checklist_logs,
// mesmas tabelas que essas abas já usavam). Endpoint separado (POST).
/**
 * Tudo o que a ronda precisa de saber sobre uma pessoa.
 *
 * -- O QUE MUDOU (sprint167) -----------------------------------------------
 * Isto devolvia quatro coisas: a medicacao, o que ja tinha sido dado, as
 * tarefas da lista e o que ja estava riscado. Quem fazia a ronda entrava no
 * quarto sem saber que aquela pessoa e alergica a penicilina, que come
 * passado, que tem uma ferida por fechar, ou que na ronda das 14h ficou em
 * alerta.
 *
 * Nada disto foi criado agora. As alergias e a dieta estao em `patients`
 * desde sempre, as feridas em `wounds`, os pedidos em `resident_requests`, o
 * registo do dia em `care_records`, a ronda anterior em `round_assignments`.
 * O que faltava era ir busca-los.
 *
 * -- PORQUE E QUE CADA CONSULTA VAI EM SEPARADO ----------------------------
 * Algumas destas tabelas ainda nao existem em todas as instalacoes (o SOS e
 * as acoes do plano sao de migracoes recentes). Uma delas a falhar nao pode
 * levar o painel inteiro atras -- quem esta a fazer a ronda ficava sem a
 * medicacao por causa de uma tabela de pedidos que nao existe.
 *
 * `Promise.allSettled` e um `?? null` em cada uma: o que nao veio, nao veio,
 * e o resto aparece.
 */
async function patientPanel(db: any, patientId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()

  const r = await Promise.allSettled([
    // `not sos is true` e nao `eq('sos', false)`: as linhas antigas tem `sos`
    // a null, e `eq(false)` deixava-as todas de fora. O SOS sai daqui porque
    // e «quando for preciso» — na lista do turno parecia medicacao por dar.
    db.from('patient_meds').select('id, name, dose, frequency, shifts')
      .eq('patient_id', patientId).eq('active', true).not('sos', 'is', true),
    db.from('mar_records').select('med_id, status, shift').eq('patient_id', patientId).eq('date', today),
    db.from('care_checklists').select('id, title, weekdays').eq('patient_id', patientId).eq('active', true),
    db.from('care_checklist_logs').select('id, checklist_id, done').eq('patient_id', patientId).eq('date', today),

    // -- O que e preciso saber ANTES de entrar ----------------------------
    // `select('*')` de proposito: `mobility`, `diet` e `cognitive_status` sao
    // colunas que so agora comecaram a ser preenchidas, e nomear uma coluna
    // que nao exista faz o PostgREST recusar a consulta INTEIRA -- a ficha
    // voltava vazia e o painel ficava sem um unico aviso, sem erro nenhum.
    db.from('patients').select('*').eq('id', patientId).maybeSingle(),
    db.from('wounds').select('id, location, dressing, status').eq('patient_id', patientId).neq('status', 'healed'),
    db.from('incidents').select('id, type, date, status').eq('patient_id', patientId).neq('status', 'closed'),
    db.from('resident_requests').select('id, kind, content, status').eq('patient_id', patientId).eq('status', 'open'),

    // -- O registo do dia, que e onde os vitais tambem vivem --------------
    db.from('care_records').select('*').eq('patient_id', patientId).eq('date', today),

    // -- A ronda anterior desta pessoa ------------------------------------
    db.from('round_assignments')
      .select('outcome, note, attended_name, updated_at')
      .eq('patient_id', patientId).eq('status', 'done')
      .order('updated_at', { ascending: false }).limit(1),

    // -- O SOS e as acoes do plano ----------------------------------------
    db.from('patient_meds').select('*').eq('patient_id', patientId).eq('sos', true).eq('active', true),
    db.from('tomas_sos').select('*').eq('patient_id', patientId).gte('dada_em', today),
    // O plano NAO pende do utente diretamente: patients <- planos <-
    // plano_objetivos <- plano_acoes. Escrevi primeiro
    // `.eq('patient_id', ...)` em `plano_acoes` e a coluna nem existe la — o
    // PostgREST recusava, o `allSettled` engolia, e o plano nunca aparecia na
    // ronda sem nada a assinalar. E por isso que vai em tres passos, a
    // seguir, e nao aqui.
  ])

  const d = (i: number) => {
    const x = r[i]
    return x.status === 'fulfilled' && !(x.value as any)?.error ? ((x.value as any).data ?? null) : null
  }

  const tasks = (d(2) || []).filter((c: any) => !c.weekdays || c.weekdays.includes(todayWeekday))

  // ── As acoes do plano, pela cadeia ────────────────────────────────────
  // A mesma que lib/carregarODia.ts percorre, para a ronda e o /o-dia nao
  // discordarem sobre o que ha para fazer hoje a mesma pessoa. As execucoes
  // de hoje vem juntas: uma acao ja feita nao se mostra por fazer.
  const acoesPlano = await (async () => {
    try {
      const { data: planos, error: ePlanos } = await db.from('planos').select('id')
        .eq('patient_id', patientId).eq('estado', 'ativo')
      if (ePlanos || !planos?.length) return { acoes: [], execucoes: [] }
      const { data: objs, error: eObjs } = await db.from('plano_objetivos').select('id')
        .in('plano_id', planos.map((x: any) => x.id)).eq('estado', 'aberto')
      if (eObjs || !objs?.length) return { acoes: [], execucoes: [] }
      const ids = objs.map((o: any) => o.id)
      const [acs, exs] = await Promise.all([
        db.from('plano_acoes').select('*').in('objetivo_id', ids).eq('ativa', true),
        db.from('plano_execucoes').select('acao_id, turno').eq('data', today),
      ])
      return { acoes: acs.data || [], execucoes: exs.data || [] }
    } catch { return { acoes: [], execucoes: [] } }
  })()

  return {
    meds: d(0) || [], mar: d(1) || [], tasks, taskLogs: d(3) || [],
    pessoa: d(4) || null,
    feridas: d(5) || [],
    ocorrencias: d(6) || [],
    pedidos: d(7) || [],
    // O registo de hoje, seja de que turno for: a ronda da noite quer ver o
    // que a da manha escreveu.
    registos: d(8) || [],
    anterior: (d(9) || [])[0] || null,
    sos: d(10) || [],
    tomasSos: d(11) || [],
    acoesPlano: acoesPlano.acoes,
    execucoesPlano: acoesPlano.execucoes,
  }
}

export async function POST(req: NextRequest) {
  const db = sb(req); const c = await ctx(db)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const body = await req.json().catch(() => ({}))
  const stamp = (row: any) => (c.orgId ? { ...row, org_id: c.orgId } : row)

  // Painel de um utente (medicação + tomas de hoje) para a ronda.
  if (body.action === 'panel') {
    const pid = String(body.patient_id || '')
    if (!pid) return NextResponse.json({ error: 'utente em falta' }, { status: 400 })
    return NextResponse.json(await patientPanel(db, pid))
  }

  // Dar medicação a partir da ronda → escreve em mar_records (igual ao /mar).
  // É isto que faz "dar medicação na ronda atualizar o /mar" (pedido do Fernando).
  if (body.action === 'give_med') {
    const pid = String(body.patient_id || ''); const medId = String(body.med_id || '')
    if (!pid || !medId) return NextResponse.json({ error: 'dados em falta' }, { status: 400 })
    const today = new Date().toISOString().slice(0, 10)
    // O cliente envia o turno segundo a instituição. Rede de segurança: nunca
    // gravar "noite" num centro de dia (o /mar só mostra manhã/tarde e a toma
    // ficaria invisível). Ver lib/institutionConfig (shiftsFor/currentShiftFor).
    const shift = await (async () => {
      const raw = body.shift || (() => { const h = new Date().getHours(); return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite' })()
      if (raw !== 'noite' || !c.orgId) return raw
      const { data: org } = await db.from('organizations').select('kind').eq('id', c.orgId).maybeSingle()
      return org?.kind === 'day_care' ? 'tarde' : 'noite'
    })()
    // evita duplicar a mesma toma (med+turno+dia)
    const { data: exist } = await db.from('mar_records').select('id').eq('patient_id', pid).eq('med_id', medId).eq('date', today).eq('shift', shift).maybeSingle()
    if (exist) { await db.from('mar_records').delete().eq('id', exist.id); return NextResponse.json({ ok: true, toggled: 'off' }) }
    const { error } = await db.from('mar_records').insert(stamp({
      user_id: c.user.id, patient_id: pid, med_id: medId, date: today, shift,
      status: 'administered', recorded_by: c.name, recorded_at: new Date().toISOString(),
    }))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, toggled: 'on' })
  }

  // Marcar/desmarcar uma tarefa de cuidado recorrente (fusão da aba "Cuidados").
  if (body.action === 'toggle_task') {
    const checklistId = String(body.checklist_id || ''); const pid = String(body.patient_id || '')
    if (!checklistId || !pid) return NextResponse.json({ error: 'dados em falta' }, { status: 400 })
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await db.from('care_checklist_logs').select('id, done').eq('checklist_id', checklistId).eq('date', today).maybeSingle()
    const nextDone = !existing?.done
    const { data, error } = await db.from('care_checklist_logs').upsert(stamp({
      user_id: c.user.id, checklist_id: checklistId, patient_id: pid, date: today,
      done: nextDone, done_by_id: nextDone ? c.user.id : null, done_at: nextDone ? new Date().toISOString() : null,
    }), { onConflict: 'checklist_id,date' }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, log: data })
  }

  if (body.action === 'start') {
    const participants: { id: string; name: string }[] = Array.isArray(body.participants) && body.participants.length ? body.participants : [{ id: c.user.id, name: c.name }]
    const shift = body.shift || null
    const today = new Date().toISOString().slice(0, 10)
    // utentes ativos da org (ou do próprio)
    const patQ = db.from('patients').select('id, name').eq('active', true)
    const { data: patients, error: pErr } = c.orgId ? await patQ.eq('org_id', c.orgId) : await patQ.eq('user_id', c.user.id)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })
    const ins = await db.from('rounds').insert(stamp({ user_id: c.user.id, date: today, shift, participants, status: 'active', created_by: c.user.id })).select().single()
    if (ins.error) { console.error('[phlox:rounds-post]', ins.error.message); return NextResponse.json({ error: setupErr(ins.error.message) ? 'Esta parte ainda não está disponível nesta conta.' : 'Não foi possível guardar agora. Tenta de novo.' }, { status: 400 }) }
    const round = ins.data
    // divide os utentes pelos participantes (round-robin) → cada um a UM só
    const rows = (patients || []).map((p: any, i: number) => {
      const who = participants[i % participants.length]
      return stamp({ round_id: round.id, patient_id: p.id, assigned_to: who.id, assigned_name: who.name, status: 'pending' })
    })
    if (rows.length) await db.from('round_assignments').insert(rows)
    return NextResponse.json({ ok: true, roundId: round.id })
  }

  if (body.action === 'attend') {
    const aid = String(body.assignment_id || '')
    if (!aid) return NextResponse.json({ error: 'atribuição em falta' }, { status: 400 })
    const { data: a } = await db.from('round_assignments').select('*, rounds(shift)').eq('id', aid).maybeSingle()
    if (!a) return NextResponse.json({ error: 'atribuição não encontrada' }, { status: 404 })
    // TRANSFERÊNCIA automática: quem atende passa a ser o attended_by (mesmo que
    // estivesse atribuído a outro). Fica registado quem o tinha e quem o fez.
    const upd = await db.from('round_assignments').update({
      status: 'done', attended_by: c.user.id, attended_name: c.name,
      assigned_to: c.user.id, assigned_name: c.name,   // reassigna para não voltar a aparecer a ninguém
      outcome: body.outcome || null, note: body.note || null, updated_at: new Date().toISOString(),
    }).eq('id', aid).select().single()
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    // ── O registo do dia ────────────────────────────────────────────────
    // Isto escrevia `mood` e `notes` por cima do que la estivesse. Se a
    // auxiliar tinha registado de manha «comeu bem, bem-disposto», a ronda da
    // tarde apagava-lhe o registo inteiro e deixava so `{behavior:'estavel'}`.
    // Ninguem dava por isso, porque o que desaparece nao se ve.
    //
    // Agora le-se primeiro e junta-se. Uma leitura a mais por pessoa atendida
    // e um preco pequeno por nao apagar o trabalho de um colega.
    const today = new Date().toISOString().slice(0, 10)
    const shift = (a as any).rounds?.shift || null

    let q = db.from('care_records').select('mood, notes, vitals')
      .eq('patient_id', a.patient_id).eq('date', today)
    // `.eq(col, null)` nao encontra nada no PostgREST; para nulos e `.is`.
    q = shift === null ? q.is('shift', null) : q.eq('shift', shift)
    const { data: jaLa, error: eLeitura } = await q.maybeSingle()

    // Se nao se conseguiu ler o que la estava, NAO se escreve. Escrever as
    // cegas era voltar ao bug que isto veio corrigir: apagar por cima o
    // registo que um colega fez de manha. A ronda em si fica registada na
    // `round_assignments`, que e o que importa — so o resumo do dia e que
    // fica por atualizar, e isso ve-se; um registo apagado nao.

    const mood = { ...(jaLa?.mood || {}), ...(body.outcome ? { behavior: body.outcome } : {}) }

    // So os vitais que vierem mesmo preenchidos, juntos aos que ja la estavam:
    // uma ronda pode medir a temperatura sem apagar a tensao da ronda anterior.
    const vitaisNovos = body.vitals && typeof body.vitals === 'object' ? body.vitals : null
    const vitals = vitaisNovos && Object.keys(vitaisNovos).length
      ? { ...(jaLa?.vitals || {}), ...vitaisNovos }
      : (jaLa?.vitals ?? null)

    // A nota acrescenta-se. Se ja la estiver a mesma (atender duas vezes na
    // mesma ronda), nao se repete.
    const notaNova = String(body.note || '').trim()
    const notasAntes = String(jaLa?.notes || '').trim()
    const notes = !notaNova ? (notasAntes || null)
      : notasAntes.includes(notaNova) ? notasAntes
      : [notasAntes, notaNova].filter(Boolean).join(' · ')

    if (!eLeitura) {
      await db.from('care_records').upsert(stamp({
        patient_id: a.patient_id, date: today, shift,
        mood: Object.keys(mood).length ? mood : null,
        vitals, notes,
      }), { onConflict: 'patient_id,date,shift' }).then(() => {}, () => {})
    }
    return NextResponse.json({ ok: true, transferred: a.assigned_to !== c.user.id })
  }

  if (body.action === 'end') {
    const id = String(body.id || '')
    await db.from('rounds').update({ status: 'done', ended_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}
