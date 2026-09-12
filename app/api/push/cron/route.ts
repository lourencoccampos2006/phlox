import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarPush } from '@/lib/webPush'
import { avisosDaInstituicao } from '@/lib/avisos'
import { ptHHMM, ptDate, instanteEmPortugal } from '@/lib/ptTime'

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // CRÍTICO: o servidor (Vercel) corre em UTC. Os horários de toma que o utilizador
  // escolhe estão em hora de PORTUGAL. Comparar UTC com hora local falhava por 1h
  // no verão → as notificações nunca batiam certo. ptHHMM/ptDate dão a hora/data de
  // Lisboa (tratam verão/inverno).
  const nowHHMM = ptHHMM()
  const today = ptDate()

  let sent = 0
  let errors = 0

  // ── O batimento ────────────────────────────────────────────────────────────
  // "As notificações de medicação não chegam" tem duas causas possíveis muito
  // diferentes: ou o relógio não está a chamar o Phlox (segredo do GitHub
  // errado), ou está e não há nada para enviar. Sem esta marca não havia
  // maneira de distinguir as duas — e a primeira é de longe a mais comum.
  // O /api/push/testar lê isto e diz há quanto tempo foi a última passagem.
  await supabase.from('push_notifications_sent')
    .upsert({ tag: 'cron:ultima-passagem', sent_at: new Date().toISOString() }, { onConflict: 'tag' })
    .then((r: any) => r, () => null)

  // ─── 1. Medication reminders ─────────────────────────────────────────────────
  // Find all personal_meds with a reminder_time that matches ±10min of now
  const { data: medsWithReminders } = await supabase
    .from('personal_meds')
    .select('id, user_id, name, dose, reminder_times, shifts, units_left, units_per_dose, low_notified_at')
    .not('reminder_times', 'is', null)

  // Guarda-se QUAL das horas disparou, nao so que alguma disparou: e essa hora
  // que identifica o lembrete. Usar a hora atual como chave falhava num caso
  // real — um lembrete as 08:55 cai na passagem das 08:45 e na das 09:00, que
  // sao horas diferentes, e saía duas vezes.
  const dueReminders = (medsWithReminders || [])
    .map((med: any) => ({
      med,
      hora: ((med.reminder_times || []) as string[]).find(t => isWithin10Min(t, nowHHMM)) || null,
    }))
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

    for (const { med, hora } of dueReminders) {
      if (alreadyLogged.has(med.id)) continue
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
        const dosesPorDia = Array.isArray((med as any).shifts) && (med as any).shifts.length ? (med as any).shifts.length : 1
        const diasQueFaltam = Math.floor(restam / (porDose * dosesPorDia))
        const jaAvisado = (med as any).low_notified_at
        const avisadoHaPouco = jaAvisado && (Date.now() - new Date(jaAvisado + 'T12:00:00').getTime()) < 7 * 86400000
        if (diasQueFaltam <= 7 && !avisadoHaPouco) {
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

      for (const sub of subs || []) {
        const r = await enviarPush(sub, {
          title: `Phlox — ${med.name}${med.dose ? ' ' + med.dose : ''}`,
          body: `Hora de tomar o ${med.name}. Toca para confirmar.`,
          url: `/mymeds?confirm=${med.id}&date=${today}`,
          tag: `reminder-${med.id}`,
        })
        if (r.ok) sent++
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

      await supabase.from('push_notifications_sent')
        .insert({ tag: etiqueta, sent_at: new Date().toISOString() })
        .then((r: any) => r, () => null)
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
    (med.reminder_times || []).some((t: string) => isWithin10Min(t, nowHHMM)))

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
  const { data: casas } = await supabase.from('organizations').select('id, name, kind')

  for (const casa of casas || []) {
    let avisos: Awaited<ReturnType<typeof avisosDaInstituicao>> = []
    try {
      avisos = await avisosDaInstituicao(supabase, casa.id, {
        agora: nowHHMM, hoje: today, tipoInstituicao: casa.kind,
      })
    } catch { continue }   // uma casa com problemas não pode calar as outras

    const aEmpurrar = avisos.filter(a => a.empurrar)
    if (!aEmpurrar.length) continue

    // O que já foi empurrado não se repete. A etiqueta leva o id da casa: sem
    // isso, a primeira organização do dia consumia a etiqueta de todas.
    const etiquetas = aEmpurrar.map(a => `${casa.id}:${a.id}`)
    const { data: jaEnviados } = await supabase
      .from('push_notifications_sent').select('tag').in('tag', etiquetas)
    const enviados = new Set((jaEnviados || []).map((x: any) => x.tag))
    const novos = aEmpurrar.filter(a => !enviados.has(`${casa.id}:${a.id}`))
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

    for (const membro of membros) {
      const gere = ['owner', 'admin'].includes(membro.role)
      const seus = gere ? novos : novos.filter(a => DO_TURNO.has(a.tipo))
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

      for (const sub of subs) {
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
    await supabase.from('push_notifications_sent')
      .insert(novos.map(a => ({ tag: `${casa.id}:${a.id}`, sent_at: new Date().toISOString() })))
      .then((r: any) => r, () => null)
  }

  return NextResponse.json({ ok: true, sent, errors, time: nowHHMM })
}

function isWithin10Min(target: string, current: string): boolean {
  const [th, tm] = target.split(':').map(Number)
  const [ch, cm] = current.split(':').map(Number)
  const diff = Math.abs((th * 60 + tm) - (ch * 60 + cm))
  return diff <= 10
}
