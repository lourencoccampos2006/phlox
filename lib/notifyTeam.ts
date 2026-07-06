// lib/notifyTeam.ts
// Envia uma notificação push a TODOS os membros ativos de uma organização
// (opcionalmente exceto quem despoletou). Usado pela comunicação da equipa,
// pelos avisos de stock, e por qualquer evento que a equipa deva saber já.
// Server-only: usa a service-role key (ignora RLS) para ler membros e subs.

import { createClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/webPush'

export interface TeamPushPayload { title: string; body: string; url?: string; tag?: string }

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function notifyOrgMembers(orgId: string, exceptUserId: string | null, payload: TeamPushPayload): Promise<number> {
  if (!orgId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0
  const a = admin()
  const { data: members } = await a.from('org_members').select('user_id').eq('org_id', orgId).eq('active', true)
  const ids = (members || []).map((m: any) => m.user_id).filter((id: string) => id !== exceptUserId)
  if (ids.length === 0) return 0
  const { data: subs } = await a.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', ids)
  let sent = 0
  await Promise.all((subs || []).map(async (s: any) => {
    const ok = await sendPushNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
      { title: payload.title, body: payload.body, url: payload.url || '/equipa-mural', tag: payload.tag } as any,
    )
    if (ok) sent++
  }))
  return sent
}
