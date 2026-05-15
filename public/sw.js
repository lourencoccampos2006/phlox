// Phlox Service Worker — Push Notifications
// Handles push events and notification clicks

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch { data = { title: 'Phlox', body: e.data?.text() || '' } }

  const title = data.title || 'Phlox — Lembrete de toma'
  const options = {
    body: data.body || 'Hora de tomar a medicação.',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: data.tag || 'phlox-reminder',
    renotify: true,
    data: { url: data.url || '/mymeds' },
    actions: [
      { action: 'confirm', title: '✓ Tomei' },
      { action: 'snooze', title: '⏱ 30 min' },
    ],
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/mymeds'

  if (e.action === 'snooze') {
    // Re-schedule notification in 30 minutes (best-effort — SW can't set timers reliably)
    // The server cron will handle re-sending; just close for now
    return
  }

  // confirm action or default click — open mymeds
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
