import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarPush } from '@/lib/webPush'
import { avisosDaInstituicao, avisosPessoais } from '@/lib/avisos'
import { querReceber } from '@/lib/notificacoes'
import { ptHHMM, ptDate, instanteEmPortugal } from '@/lib/ptTime'
import { clienteDeServico, confirmarLigacao } from '@/lib/servico'

// Called every 15 minutes by GitHub Actions (.github/workflows/push-cron.yml)
// or an external scheduler. NOT by Vercel Cron: the Hobby plan allows two cron
// jobs, once a day each. See .github/CRON_SETUP.md.
// Vercel sends: Authorization: Bearer <CRON_SECRET>
// Manual/Cloudflare: x-cron-secret header or ?secret= query param
export async function GET(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  // Só cabeçalhos — nunca query string (URLs ficam em logs de servidor,
  // proxies e histórico do browser). Ver app/api/cron/ingest-shortages.
  const secret = bearerToken || req.headers.get('x-cron-secret')
  // !CRON_SECRET primeiro: sem isto, se a env var nunca tivesse sido definida no
  // deploy, um pedido SEM nenhum cabeçalho (secret undefined) passava a
  // verificação (undefined !== undefined é falso) e corria sem autenticação
  // nenhuma, com a service-role key, sobre os dados de medicação/push de TODOS
  // os utilizadores. As outras 3 rotas de cron já tinham este guard.
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A chave de serviço, verificada. Sem isto o cron corria sem conseguir ler
  // nem escrever nada e respondia 200 — o GitHub Actions verde de 15 em 15
  // minutos e nem uma notificação enviada. Ver lib/servico.ts.
  const servico = clienteDeServico()
  if (!servico.ok) {
    console.error('[phlox:cron]', servico.motivo)
    return NextResponse.json({ error: servico.motivo, comoResolver: servico.comoResolver }, { status: servico.estado })
  }
  const supabase = servico.sb

  const ligacao = await confirmarLigacao(supabase)
  if (!ligacao.ok) {
    console.error('[phlox:cron]', ligacao.motivo)
    return NextResponse.json({ error: ligacao.motivo, comoResolver: ligacao.comoResolver }, { status: 503 })
  }

  // CRÍTICO: o servidor (Vercel) corre em UTC. Os horários de toma que o utilizador
  // escolhe estão em hora de PORTUGAL. Comparar UTC com hora local falhava por 1h
  // no verão → as notificações nunca batiam certo. ptHHMM/ptDate dão a hora/data de
  // Lisboa (tratam verão/inverno).
  const nowHHMM = ptHHMM()
  const today = ptDate()

  // ── Modo de simulação ──────────────────────────────────────────────────────
  // `?simular=1` faz o percurso todo — lê tudo, decide tudo — mas não envia
  // nada nem marca nada como enviado. Serve para perguntar "o que é que ias
  // fazer agora?" sem gastar os avisos: um aviso marcado como enviado sem ter
  // sido enviado desaparece para sempre, e isso é pior do que não perguntar.
  const simular = req.nextUrl.searchParams.get('simular') === '1'

  let sent = 0
  let errors = 0
  // Quantos dispositivos seriam tocados. Em simulação é o número que interessa
  // — o `sent` fica a zero de propósito, porque não se enviou nada.
  let alvos = 0
  // Só contagens — nunca nomes de casas nem o conteúdo dos avisos. Isto é
  // informação de operação, não o livro de registos de ninguém.
  let avisosTotal = 0, avisosNovos = 0

  // ── As preferências de cada pessoa ─────────────────────────────────────────
  // Carregadas uma vez, à medida que são precisas. A coluna vem do sprint145;
  // enquanto ele não for aplicado, isto degrada para "toda a gente recebe tudo"
  // em vez de rebentar — e é por isso que a leitura é separada e tolerante.
  // (Foi uma coluna inexistente num select que manteve o /mymeds calado durante
  // semanas: um select que pede uma coluna que não existe é recusado INTEIRO.)
  const prefsPorUtilizador = new Map<string, Record<string, boolean>>()
  let prefsDisponiveis = true

  async function carregarPrefs(ids: string[]) {
    const faltam = [...new Set(ids)].filter(id => id && !prefsPorUtilizador.has(id))
    if (!faltam.length || !prefsDisponiveis) return
    const { data, error } = await supabase
      .from('profiles').select('id, notification_prefs').in('id', faltam)
    if (error) {
      prefsDisponiveis = false
      console.error('[phlox:cron] sem preferências de notificação (sprint145 por aplicar?):', error.message)
      return
    }
    ;(data || []).forEach((p: any) => prefsPorUtilizador.set(p.id, p.notification_prefs || {}))
    faltam.forEach(id => { if (!prefsPorUtilizador.has(id)) prefsPorUtilizador.set(id, {}) })
  }

  const quer = (userId: string, tipo: string) =>
    !prefsDisponiveis || querReceber(prefsPorUtilizador.get(userId), tipo)

  // ── O batimento ────────────────────────────────────────────────────────────
  // "As notificações de medicação não chegam" tem duas causas possíveis muito
  // diferentes: ou o relógio não está a chamar o Phlox (segredo do GitHub
  // errado), ou está e não há nada para enviar. Sem esta marca não havia
  // maneira de distinguir as duas — e a primeira é de longe a mais comum.
  // O /api/push/testar lê isto e diz há quanto tempo foi a última passagem.
  let batimento = simular ? 'não gravado (simulação)' : 'gravado'
  if (!simular) {
    const { error } = await supabase.from('push_notifications_sent')
      .upsert({ tag: 'cron:ultima-passagem', sent_at: new Date().toISOString() }, { onConflict: 'tag' })
    if (error) {
      // Antes isto era engolido. Se a marca não grava, o diagnóstico diz
      // "nunca correu" enquanto o cron corre — que foi precisamente o
      // enredo que nos custou dias.
      batimento = `FALHOU: ${error.message}`
      console.error('[phlox:cron] não consegui gravar o batimento:', error.message)
    }
  }

  // ─── 1. Medication reminders ─────────────────────────────────────────────────
  // Find all personal_meds with a reminder_time that matches ±10min of now
  // NOTA (2026-09-14): esta lista já pediu uma coluna `shifts` que NÃO EXISTE
  // em personal_meds. O PostgREST recusa o select inteiro nesse caso, devolve
  // `data: null`, e como aqui só se destruturava `{ data }` o erro ia para o
  // lixo. Resultado: `dueReminders` sempre vazio, zero lembretes de medicação
  // enviados desde sempre — com o cron a correr e a responder 200.
  // Por isso o erro é agora lido e vai no relatório.
  const { data: medsWithReminders, error: erroMeds } = await supabase
    .from('personal_meds')
    .select('id, user_id, name, dose, reminder_times, units_left, units_per_dose, low_notified_at')
    .not('reminder_times', 'is', null)
  if (erroMeds) console.error('[phlox:cron] não consegui ler os medicamentos pessoais:', erroMeds.message)

  // Guarda-se QUAL das horas disparou, nao so que alguma disparou: e essa hora
  // que identifica o lembrete. Usar a hora atual como chave falhava num caso
  // real — um lembrete as 08:55 cai na passagem das 08:45 e na das 09:00, que
  // sao horas diferentes, e saía duas vezes.
  const dueReminders = (medsWithReminders || [])
    .map((med: any) => {
      // A hora que passou há mais tempo dentro da janela: se duas horas do
      // mesmo medicamento ficaram por avisar (porque o relógio faltou), avisa-se
      // primeiro a mais antiga, e a outra sai na passagem seguinte.
      const candidatas = ((med.reminder_times || []) as string[])
        .map(t => ({ t, atraso: minutosDesde(t, nowHHMM) }))
        .filter(x => x.atraso >= -A_HORAS_MIN && x.atraso <= ATRASO_MAXIMO_MIN)
        .sort((a, b) => b.atraso - a.atraso)
      return { med, hora: candidatas[0]?.t || null, atraso: candidatas[0]?.atraso ?? 0 }
    })
    .filter((x: any) => x.hora)

  if (dueReminders.length > 0) {
    // Check which ones already have a log today at this hour (avoid duplicate pushes)
    const dueIds = dueReminders.map((x: any) => x.med.id)
    // A hora vem de ptHHMM (Portugal) mas o `logged_at` está gravado em UTC.
    // Comparar as duas diretamente olhava para a hora errada no verão — uma
    // toma marcada às 9h não contava, e a notificação repetia-se. Converte-se
    // a janela para UTC antes de comparar.
    const inicioUTC = instanteEmPortugal(today, `${nowHHMM.slice(0, 2)}:00`)
    const fimUTC = new Date(inicioUTC.getTime() + 3599_000)

    const { data: todayLogs } = await supabase
      .from('med_logs')
      .select('med_id')
      .in('med_id', dueIds)
      .eq('date', today)
      .gte('logged_at', inicioUTC.toISOString())
      .lt('logged_at', fimUTC.toISOString())

    const alreadyLogged = new Set((todayLogs || []).map((l: any) => l.med_id))

    // O cron passa de 15 em 15 minutos e a janela e de +/-10: uma hora como
    // 09:07 cai em DUAS passagens (09:00 e 09:15). O `tag` do service worker
    // esconde a segunda (substitui a notificacao em vez de a empilhar), mas
    // continuava a ser um envio a mais. Marca-se o que ja saiu.
    const etiquetasHoje = dueReminders.map((x: any) => `toma:${x.med.id}:${today}:${x.hora}`)
    const { data: jaAvisados } = await supabase
      .from('push_notifications_sent').select('tag').in('tag', etiquetasHoje)
    const jaSaiu = new Set((jaAvisados || []).map((x: any) => x.tag))

    await carregarPrefs(dueReminders.map((x: any) => x.med.user_id))

    for (const { med, hora, atraso } of dueReminders) {
      if (alreadyLogged.has(med.id)) continue
      if (!quer(med.user_id, 'toma')) continue
      const etiqueta = `toma:${med.id}:${today}:${hora}`
      if (jaSaiu.has(etiqueta)) continue

      // ── A caixa está a acabar? ────────────────────────────────────────
      // O Phlox já sabe quantas doses são precisas por dia; com as unidades
      // que restam, sabe quantos dias faltam. Avisar com uma semana de folga
      // é a diferença entre passar na farmácia a caminho de casa e dar por si
      // ao domingo à noite com a caixa vazia. Um aviso por medicamento e por
      // semana — não é um alarme, é um recado.
      const restam = Number((med as any).units_left)
      const porDose = Number((med as any).units_per_dose) || 1
      if (!isNaN(restam) && restam > 0 && porDose > 0) {
        // Quantas tomas por dia: são as horas de lembrete. (Era `med.shifts`,
        // uma coluna que nunca existiu nesta tabela.)
        const dosesPorDia = Array.isArray(med.reminder_times) && med.reminder_times.length ? med.reminder_times.length : 1
        const diasQueFaltam = Math.floor(restam / (porDose * dosesPorDia))
        const jaAvisado = (med as any).low_notified_at
        const avisadoHaPouco = jaAvisado && (Date.now() - new Date(jaAvisado + 'T12:00:00').getTime()) < 7 * 86400000
        if (diasQueFaltam <= 7 && !avisadoHaPouco && quer(med.user_id, 'caixa')) {
          const { data: subsBaixo } = await supabase
            .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', med.user_id)
          for (const sub of subsBaixo || []) {
            await enviarPush(sub, {
              title: `${med.name} está a acabar`,
              body: diasQueFaltam <= 0
                ? 'Já não há unidades suficientes para a próxima toma.'
                : `Chega para mais ${diasQueFaltam} ${diasQueFaltam === 1 ? 'dia' : 'dias'}. Vale a pena passar na farmácia.`,
              url: '/mymeds',
              tag: `low-${med.id}`,
            }).catch(() => {})
          }
          await supabase.from('personal_meds')
            .update({ low_notified_at: new Date().toISOString().slice(0, 10) })
            .eq('id', med.id)
        }
      }

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', med.user_id)

      alvos += (subs || []).length
      let aceite = 0
      for (const sub of simular ? [] : (subs || [])) {
        const atrasado = atraso > A_HORAS_MIN
        const r = await enviarPush(sub, {
          title: `Phlox — ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          // Honestidade: se o aviso vem atrasado, diz-se. Fingir que são horas
          // quando já passaram duas é pior do que não avisar.
          body: atrasado
            ? `A toma das ${hora} ainda não ficou registada. Toca para confirmar.`
            : `Hora de tomar o ${med.name}. Toca para confirmar.`,
          url: `/mymeds?confirm=${med.id}&date=${today}`,
          tag: `reminder-${med.id}`,
        })
        if (r.ok) { sent++; aceite++ }
        else {
          errors++
          // Só o 410/404 diz que o dispositivo desapareceu. Qualquer outra
          // falha é NOSSA (chave em falta, rede, 403) — apagar aqui era o que
          // limpava a tabela inteira à primeira passagem do cron.
          if (r.expirada) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          } else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo)
        }
      }

      // A marca só se escreve quando ALGUMA coisa saiu mesmo. Antes escrevia-se
      // sempre: se a pessoa ainda não tinha dispositivo, ou se o envio falhava,
      // o lembrete ficava marcado como dado e nunca mais era tentado nesse dia.
      // Marcar como enviado o que não saiu é a maneira mais silenciosa de
      // perder um aviso.
      if (!simular && aceite > 0) {
        await supabase.from('push_notifications_sent')
          .insert({ tag: etiqueta, sent_at: new Date().toISOString() })
          .then((r: any) => r, () => null)
      }
    }
  }

  // ─── 1b. Lembretes de medicação de FAMILIARES (cuidador) ─────────────────────
  // Os medicamentos de quem o cuidador acompanha vivem em family_profile_meds.
  // O cuidador (user_id) recebe o push no SEU dispositivo, identificando a pessoa.
  const { data: famMeds } = await supabase
    .from('family_profile_meds')
    .select('id, user_id, profile_id, name, dose, reminder_times')
    .not('reminder_times', 'is', null)

  const dueFam = (famMeds || []).filter((med: any) =>
    (med.reminder_times || []).some((t: string) => {
      const a = minutosDesde(t, nowHHMM)
      return a >= -A_HORAS_MIN && a <= ATRASO_MAXIMO_MIN
    }))

  if (dueFam.length > 0) {
    // nome de cada familiar para a mensagem
    const profIds = [...new Set(dueFam.map((m: any) => m.profile_id))]
    const { data: profs } = await supabase.from('family_profiles').select('id, name').in('id', profIds)
    const nameOf: Record<string, string> = {}
    ;(profs || []).forEach((p: any) => { nameOf[p.id] = p.name })

    for (const med of dueFam) {
      const who = (nameOf[med.profile_id] || 'familiar').split(' ')[0]
      const { data: subs } = await supabase
        .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', med.user_id)
      for (const sub of subs || []) {
        const r = await enviarPush(sub, {
          title: `Phlox — ${who}: ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          body: `Hora de dar o ${med.name} a ${who}.`,
          url: '/familia',
          tag: `fam-reminder-${med.id}`,
        })
        if (r.ok) sent++
        else { errors++; if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
      }
    }
  }

  // ─── 1c. Atividade em perfis partilhados (viewer de "Partilhado comigo") ─────
  // sprint115: o convite de visualização (sprint112) só avisava quem vê se
  // abrisse a app. Aqui avisamos quando há medicação/vitais/sintomas NOVOS
  // desde o último aviso (ou desde o resgate do código, à primeira vez) — nunca
  // sobre o histórico inteiro do perfil.
  const { data: activeShares } = await supabase
    .from('family_profile_shares')
    .select('id, profile_id, viewer_user_id, redeemed_at, last_activity_notified_at')
    .not('viewer_user_id', 'is', null)
    .is('revoked_at', null)

  for (const share of activeShares || []) {
    const since = share.last_activity_notified_at || share.redeemed_at
    if (!since) continue
    const [{ count: medCount }, { data: latestVital }, { data: latestSymptom }] = await Promise.all([
      supabase.from('family_profile_meds').select('id', { count: 'exact', head: true }).eq('profile_id', share.profile_id).gt('created_at', since),
      supabase.from('vitals').select('recorded_at').eq('profile_id', share.profile_id).gt('recorded_at', since).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('symptom_logs').select('at').eq('profile_id', share.profile_id).gt('at', since).order('at', { ascending: false }).limit(1).maybeSingle().then((r: any) => r, () => ({ data: null })),
    ])
    if ((medCount || 0) === 0 && !latestVital && !latestSymptom) continue

    const { data: prof } = await supabase.from('family_profiles').select('name').eq('id', share.profile_id).maybeSingle()
    const who = (prof?.name || 'Familiar').split(' ')[0]
    const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', share.viewer_user_id)
    for (const sub of subs || []) {
      const r = await enviarPush(sub, {
        title: `Phlox — ${who}`,
        body: `Há novidades na saúde de ${who} que partilharam consigo.`,
        url: '/partilhado-comigo',
        tag: `share-activity-${share.id}-${nowHHMM}`,
      })
      if (r.ok) sent++
      else { errors++; if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); else console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
    }
    await supabase.from('family_profile_shares').update({ last_activity_notified_at: new Date().toISOString() }).eq('id', share.id)
  }

  // ─── 1d. Os avisos pessoais que não são a hora de uma toma ───────────────
  // O resumo do fim do dia e a consulta de amanhã. A secção 1 trata da hora
  // exata de cada medicamento; estes são de janela, e vêm do mesmo motor que
  // alimenta o sino (lib/avisos, avisosPessoais) para os dois nunca
  // discordarem.
  //
  // Só se percorre quem TEM dispositivo — é o conjunto certo e é pequeno.
  // Percorrer todas as contas para descobrir que ninguém tem push seria caro e
  // inútil.
  {
    const { data: comDispositivo } = await supabase
      .from('push_subscriptions').select('user_id')
    const utilizadores = [...new Set((comDispositivo || []).map((s: any) => s.user_id))] as string[]
    await carregarPrefs(utilizadores)

    for (const uid of utilizadores) {
      let meus: Awaited<ReturnType<typeof avisosPessoais>> = []
      try { meus = await avisosPessoais(supabase, uid, { agora: nowHHMM, hoje: today }) } catch { continue }

      const aEmpurrar = meus.filter(a => a.empurrar && quer(uid, a.tipo))
      if (!aEmpurrar.length) continue

      const etiquetas = aEmpurrar.map(a => `${uid}:${a.id}`)
      const { data: jaSaiu } = await supabase
        .from('push_notifications_sent').select('tag').in('tag', etiquetas)
      const enviados = new Set((jaSaiu || []).map((x: any) => x.tag))
      const novos = aEmpurrar.filter(a => !enviados.has(`${uid}:${a.id}`))
      if (!novos.length) continue

      const { data: subs } = await supabase
        .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', uid)
      if (!subs?.length) continue

      const principal = novos[0]
      alvos += subs.length
      let aceite = 0
      for (const sub of simular ? [] : subs) {
        const r = await enviarPush(sub, {
          title: novos.length === 1 ? principal.titulo : `${novos.length} coisas para hoje`,
          body: novos.length === 1 ? principal.corpo : novos.slice(0, 3).map(a => a.titulo).join(' · '),
          url: novos.length === 1 ? principal.href : '/inicio',
          tag: `pessoal-${uid}-${today}`,
        })
        if (r.ok) { sent++; aceite++ }
        else if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        else { errors++; console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
      }

      if (!simular && aceite > 0) {
        await supabase.from('push_notifications_sent')
          .insert(novos.map(a => ({ tag: `${uid}:${a.id}`, sent_at: new Date().toISOString() })))
          .then((r: any) => r, () => null)
      }
    }
  }

  // ─── 2. As instituições ──────────────────────────────────────────────────
  // REFEITO 2026-09-12. O que estava aqui tinha três defeitos que, juntos,
  // faziam com que uma instituição nunca recebesse notificação nenhuma:
  //
  //   • procurava os utentes por `user_id` dos coordenadores em vez de
  //     `org_id` da casa — via só os utentes criados por aquelas contas;
  //   • filtrava os profiles por `plan = 'clinic'`, que só o DONO tem: um
  //     funcionário convidado fica com `plan: 'free'` e ganha acesso por
  //     pertença (lib/planGate). A lista de coordenadores vinha vazia;
  //   • contava todos os medicamentos ativos em vez de só os do turno, e
  //     gravava a marca de "já enviado" com uma etiqueta partilhada entre
  //     organizações — a primeira casa a ser processada calava as outras.
  //
  // Agora o cálculo é o mesmo do sino (lib/avisos.ts) e a marca é por casa.
  const { data: casas, error: erroCasas } = await supabase.from('organizations').select('id, name, kind')
  if (erroCasas) console.error('[phlox:cron] não consegui listar as instituições:', erroCasas.message)

  for (const casa of casas || []) {
    let avisos: Awaited<ReturnType<typeof avisosDaInstituicao>> = []
    try {
      avisos = await avisosDaInstituicao(supabase, casa.id, {
        agora: nowHHMM, hoje: today, tipoInstituicao: casa.kind,
      })
    } catch { continue }   // uma casa com problemas não pode calar as outras

    const aEmpurrar = avisos.filter(a => a.empurrar)
    avisosTotal += aEmpurrar.length
    if (!aEmpurrar.length) continue

    // O que já foi empurrado não se repete. A etiqueta leva o id da casa: sem
    // isso, a primeira organização do dia consumia a etiqueta de todas.
    const etiquetas = aEmpurrar.map(a => `${casa.id}:${a.id}`)
    const { data: jaEnviados } = await supabase
      .from('push_notifications_sent').select('tag').in('tag', etiquetas)
    const enviados = new Set((jaEnviados || []).map((x: any) => x.tag))
    const novos = aEmpurrar.filter(a => !enviados.has(`${casa.id}:${a.id}`))
    avisosNovos += novos.length
    if (!novos.length) continue

    // ── Quem recebe ────────────────────────────────────────────────────────
    // Quem gere a casa recebe tudo. Quem está no turno recebe o trabalho do
    // turno — a rutura de stock e o recado da família não são para interromper
    // uma auxiliar a meio de um banho.
    const DO_TURNO = new Set(['doses', 'medicacao', 'incidente', 'presenca'])
    const { data: membros } = await supabase
      .from('org_members').select('user_id, role')
      .eq('org_id', casa.id).eq('active', true).neq('role', 'viewer')
    if (!membros?.length) continue

    await carregarPrefs(membros.map((m: any) => m.user_id))

    for (const membro of membros) {
      const gere = ['owner', 'admin'].includes(membro.role)
      const seus = (gere ? novos : novos.filter(a => DO_TURNO.has(a.tipo)))
        // Cada pessoa recebe o que escolheu receber. Ver lib/notificacoes.
        .filter(a => quer(membro.user_id, a.tipo))
      if (!seus.length) continue

      const { data: subs } = await supabase
        .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', membro.user_id)
      if (!subs?.length) continue

      // Uma notificação por passagem, não uma por aviso. Oito notificações
      // seguidas não são oito avisos — são uma pessoa a desligar o Phlox.
      const principal = seus[0]
      const titulo = seus.length === 1
        ? principal.titulo
        : `${seus.length} coisas precisam de atenção`
      const corpo = seus.length === 1
        ? principal.corpo
        : seus.slice(0, 3).map(a => a.titulo).join(' · ')

      alvos += subs.length
      for (const sub of simular ? [] : subs) {
        const r = await enviarPush(sub, {
          title: titulo,
          body: corpo,
          url: seus.length === 1 ? principal.href : '/painel',
          tag: `casa-${casa.id}-${nowHHMM}`,
        })
        if (r.ok) sent++
        else if (r.expirada) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        else { errors++; console.error('[phlox:push] envio falhou, subscrição mantida:', r.motivo) }
      }
    }

    // Marca tudo o que foi processado, mesmo que ninguém tivesse subscrição:
    // o aviso já foi considerado e não deve voltar a tocar amanhã.
    if (!simular) {
      await supabase.from('push_notifications_sent')
        .insert(novos.map(a => ({ tag: `${casa.id}:${a.id}`, sent_at: new Date().toISOString() })))
        .then((r: any) => r, () => null)
    }
  }

  // O workflow do GitHub imprime esta resposta no registo. Ela tem de chegar
  // para perceber o que se passou sem abrir a Vercel: quantos lembretes havia
  // para dar, quantas casas foram vistas, quantos avisos saíram.
  const relatorio = {
    ok: true,
    simulacao: simular || undefined,
    hora: nowHHMM,
    batimento,
    medicamentosComHora: (medsWithReminders || []).length,
    erroMedicamentos: erroMeds?.message,
    tomasNaHora: dueReminders.length,
    casasVistas: (casas || []).length,
    avisosParaEmpurrar: avisosTotal,
    avisosPorEnviar: avisosNovos,
    dispositivosAlvo: alvos,
    enviadas: sent,
    falhas: errors,
  }
  console.log('[phlox:cron]', JSON.stringify(relatorio))
  return NextResponse.json(relatorio)
}

/** Há quantos minutos a hora do lembrete passou. Negativo = ainda não chegou. */
function minutosDesde(alvo: string, agora: string): number {
  const [ah, am] = alvo.split(':').map(Number)
  const [ch, cm] = agora.split(':').map(Number)
  return (ch * 60 + cm) - (ah * 60 + am)
}

/** Quanto tempo depois da hora ainda vale a pena avisar.
 *
 *  ── PORQUE É QUE ISTO NÃO É ±10 MINUTOS ───────────────────────────────────
 *  Era. E era essa a razão pela qual os lembretes de medicação nunca chegavam.
 *
 *  O relógio é o GitHub Actions, agendado de 15 em 15 minutos. Só que o GitHub
 *  ATRASA e DESCARTA execuções agendadas quando os runners estão com carga —
 *  está documentado, e no Phlox via-se bem: a 12 e 13 de setembro de 2026 o
 *  workflow correu OITO vezes em vinte horas, em vez de oitenta. Todas verdes.
 *  Com passagens de duas em duas horas, uma janela de ±10 minutos quase nunca
 *  apanha nada, e o lembrete das nove simplesmente nunca sai.
 *
 *  Agora o lembrete sai à mesma quando a passagem chega tarde, e diz que vem
 *  atrasado em vez de fingir que são horas. Passadas três horas cala-se: um
 *  aviso para tomar o comprimido das nove às duas da tarde já não é ajuda
 *  nenhuma, e fica no sino (ver lib/avisos, avisosPessoais). */
const ATRASO_MAXIMO_MIN = 180
const A_HORAS_MIN = 10
