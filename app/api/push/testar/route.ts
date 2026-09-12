// app/api/push/testar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// "As notificações não chegam." Esta rota responde PORQUÊ.
//
// O envio de uma notificação atravessa cinco coisas que podem estar mal, e até
// aqui nenhuma delas dizia nada: o browser tinha de dar permissão, o service
// worker tinha de estar registado, a subscrição tinha de estar gravada, o
// servidor tinha de ter o par de chaves VAPID certo, e o serviço de push
// (Google, Mozilla, Apple) tinha de aceitar a assinatura. Falhava qualquer uma
// e o resultado era exatamente o mesmo: silêncio.
//
// Isto percorre a cadeia toda e devolve o que encontrou em cada etapa, em
// português. Envia uma notificação a sério — não simula.
//
// Não apaga nada. Mesmo que uma subscrição esteja morta, é o cron que limpa;
// um diagnóstico que muda o que está a diagnosticar não é um diagnóstico.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarPush, chavesPush, chavePublicaDoCliente } from '@/lib/webPush'

export const runtime = 'nodejs'
export const maxDuration = 30

interface Etapa {
  etapa: string
  ok: boolean
  detalhe: string
  /** O que fazer a seguir, quando não está bem. */
  accao?: string
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return NextResponse.json({ error: 'Servidor mal configurado.' }, { status: 503 })

  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: u, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !u?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const userId = u.user.id

  const etapas: Etapa[] = []

  // ── 1. As chaves do servidor ───────────────────────────────────────────────
  const { publica, privada, falta } = chavesPush()
  const publicaCliente = chavePublicaDoCliente()

  etapas.push(falta.length
    ? {
        etapa: 'Chaves do servidor',
        ok: false,
        detalhe: `Faltam: ${falta.join(', ')}.`,
        accao: 'Gerar um par com `node scripts/gerar-chaves-vapid.mjs` e pôr as três variáveis na Vercel (Settings → Environment Variables). Depois é preciso um deploy novo — as variáveis só entram em funções publicadas depois de as guardar.',
      }
    : { etapa: 'Chaves do servidor', ok: true, detalhe: 'O par VAPID está presente.' })

  // O engano mais difícil de ver: duas chaves públicas diferentes. O browser
  // subscreve com uma, o servidor assina com a outra, e o serviço de push
  // responde 403 sem explicar. Vale a pena dizê-lo antes de tentar enviar.
  const coincidem = !!publica && !!publicaCliente && publica === publicaCliente
  etapas.push(!publica || !publicaCliente
    ? {
        etapa: 'Chave pública do browser',
        ok: false,
        detalhe: !publicaCliente
          ? 'A NEXT_PUBLIC_VAPID_PUBLIC_KEY não está definida — o browser não consegue sequer subscrever.'
          : 'A chave pública do servidor não está definida.',
        accao: 'Definir NEXT_PUBLIC_VAPID_PUBLIC_KEY com a MESMA chave pública do par.',
      }
    : coincidem
      ? { etapa: 'Chave pública do browser', ok: true, detalhe: 'É a mesma que o servidor usa para assinar.' }
      : {
          etapa: 'Chave pública do browser',
          ok: false,
          detalhe: 'A chave que o browser usa para subscrever NÃO é a mesma com que o servidor assina. São de pares diferentes.',
          accao: 'Pôr a mesma chave pública nas duas variáveis (NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PUBLIC_KEY) e reativar as notificações em cada dispositivo — as subscrições antigas ficaram presas à chave errada.',
        })

  // ── 2. As subscrições desta conta ──────────────────────────────────────────
  const { data: subs, error: subsErr } = await sb
    .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId)

  if (subsErr) {
    etapas.push({
      etapa: 'Dispositivos registados', ok: false,
      detalhe: `Não foi possível ler a tabela: ${subsErr.message}`,
      accao: 'Verificar a tabela push_subscriptions e as suas políticas de acesso.',
    })
    return NextResponse.json({ etapas, enviadas: 0 })
  }

  const lista = subs || []
  etapas.push(lista.length
    ? { etapa: 'Dispositivos registados', ok: true, detalhe: `${lista.length} ${lista.length === 1 ? 'dispositivo' : 'dispositivos'} nesta conta.` }
    : {
        etapa: 'Dispositivos registados', ok: false,
        detalhe: 'Nenhum. Esta conta não tem nenhum dispositivo a receber notificações.',
        accao: 'Carregar em "Ativar notificações" neste dispositivo. Num iPhone ou iPad é preciso primeiro adicionar o Phlox ao ecrã principal e abrir a partir daí — o Safari numa aba normal não recebe notificações, é uma limitação da Apple.',
      })

  // ── 3. O envio a sério ─────────────────────────────────────────────────────
  let enviadas = 0
  const dispositivos: { onde: string; ok: boolean; motivo?: string; estado?: number }[] = []

  for (const s of lista) {
    const r = await enviarPush(s as any, {
      title: 'Phlox — teste',
      body: 'Se estás a ler isto, as notificações funcionam neste dispositivo.',
      url: '/settings',
      tag: `teste-${Date.now()}`,
    })
    if (r.ok) enviadas++
    dispositivos.push({ onde: servicoDe(s.endpoint), ok: r.ok, motivo: r.motivo, estado: r.estado })
  }

  if (lista.length) {
    etapas.push(enviadas === lista.length
      ? { etapa: 'Envio', ok: true, detalhe: `Aceite por ${enviadas} de ${lista.length}. Deve aparecer em segundos.` }
      : enviadas > 0
        ? { etapa: 'Envio', ok: true, detalhe: `Aceite por ${enviadas} de ${lista.length}. Os outros estão em baixo com o motivo.` }
        : {
            etapa: 'Envio', ok: false,
            detalhe: dispositivos[0]?.motivo || 'Nenhum envio foi aceite.',
            accao: 'O motivo exato de cada dispositivo está na lista em baixo.',
          })
  }

  // ── 4. O relógio que dispara os avisos automáticos ─────────────────
  // Este teste passa POR CIMA do cron: envia diretamente. Se o relógio não
  // estiver a correr, o teste funciona e nenhum aviso automático chega — que
  // é exatamente a situação de "o teste dá, a medicação não".
  //
  // O cron marca cada passagem em push_notifications_sent (tag
  // 'cron:ultima-passagem'). É isso que se lê aqui.
  const { data: batimento } = await sb
    .from('push_notifications_sent').select('sent_at').eq('tag', 'cron:ultima-passagem').maybeSingle()

  const minutosDesde = batimento?.sent_at
    ? Math.round((Date.now() - new Date(batimento.sent_at).getTime()) / 60000)
    : null

  etapas.push(
    minutosDesde == null
      ? {
          etapa: 'O relógio automático', ok: false,
          detalhe: 'Nunca correu. É por isto que os lembretes de medicação não chegam, mesmo com o teste a funcionar — o teste envia à mão, o relógio é que envia sozinho.',
          accao: 'O relógio é o GitHub Actions. Confirmar que o segredo CRON_SECRET existe em GitHub → Settings → Secrets and variables → Actions com o MESMO valor da Vercel, e ver em GitHub → Actions → "Push Notifications Cron" se as últimas execuções estão verdes. A 401 significa segredos diferentes.',
        }
      : minutosDesde > 45
        ? {
            etapa: 'O relógio automático', ok: false,
            detalhe: `A última passagem foi há ${minutosDesde > 1440 ? `${Math.round(minutosDesde / 1440)} dia(s)` : `${minutosDesde} minutos`}. Devia ser de 15 em 15 minutos.`,
            accao: 'Ver em GitHub → Actions → "Push Notifications Cron" o que aconteceu nas últimas execuções. O GitHub também desliga workflows agendados em repositórios parados há 60 dias.',
          }
        : {
            etapa: 'O relógio automático', ok: true,
            detalhe: `A correr. Última passagem há ${minutosDesde} ${minutosDesde === 1 ? 'minuto' : 'minutos'}.`,
          })

  // ── 5. Os lembretes de medicação desta conta ─────────────────────
  // A outra causa possível: o relógio corre, mas não há nada para enviar.
  // Só saem lembretes de medicamentos com HORA definida — um medicamento sem
  // hora é uma lista, não um alarme, e o Phlox não inventa horas.
  const { data: meus } = await sb
    .from('personal_meds').select('id, name, reminder_times').eq('user_id', userId)

  const todos = meus || []
  const comHora = todos.filter((m: any) => Array.isArray(m.reminder_times) && m.reminder_times.length)

  if (todos.length) {
    etapas.push(comHora.length
      ? {
          etapa: 'Lembretes de medicação', ok: true,
          detalhe: `${comHora.length} de ${todos.length} ${todos.length === 1 ? 'medicamento tem' : 'medicamentos têm'} hora definida: `
            + comHora.slice(0, 3).map((m: any) => `${m.name} (${m.reminder_times.join(', ')})`).join('; ')
            + (comHora.length > 3 ? `… e mais ${comHora.length - 3}` : ''),
        }
      : {
          etapa: 'Lembretes de medicação', ok: false,
          detalhe: `Nenhum dos ${todos.length} medicamentos desta conta tem hora definida — por isso não há nada para o relógio enviar.`,
          accao: 'Em /mymeds, abrir cada medicamento e definir a hora da toma. Só os que têm hora é que dão lembrete.',
        })
  }

  return NextResponse.json({ etapas, dispositivos, enviadas, total: lista.length })
}

/** Só para o relatório ficar legível: de que serviço é este endpoint. */
function servicoDe(endpoint: string): string {
  if (endpoint.includes('fcm.googleapis') || endpoint.includes('android.googleapis')) return 'Chrome / Android'
  if (endpoint.includes('mozilla')) return 'Firefox'
  if (endpoint.includes('push.apple')) return 'Safari / iPhone'
  if (endpoint.includes('windows.com') || endpoint.includes('notify.windows')) return 'Edge / Windows'
  return 'Outro navegador'
}
