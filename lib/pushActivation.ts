// lib/pushActivation.ts
// Ativação de notificações push — extraído de app/settings/page.tsx (2026-07-17,
// suggestion nº2 da auditoria) para poder ser chamado de um nudge fora das
// Definições (ex: PushNudge.tsx em /familia), sem duplicar a dança de
// permissão+service-worker+subscrição+registo no servidor.

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

export async function activatePush(supabase: any): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!('Notification' in window)) return { ok: false, error: 'Este navegador não suporta notificações.' }
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return { ok: false, error: 'Sem permissão para notificações. Ativa-a nas definições do navegador.' }
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return { ok: false, error: 'As notificações push ainda não estão ativadas no servidor.' }
    const reg = await navigator.serviceWorker.register('/sw.js')
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
    if (!res.ok) return { ok: false, error: 'Não foi possível registar as notificações no servidor.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Não foi possível ativar as notificações neste dispositivo.' }
  }
}

export function pushSupportedAndNotGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  return Notification.permission === 'default'
}
