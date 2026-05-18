'use client'

// Client-side reminder fallback.
// When the user has the app open, this checks if any reminder is due
// and triggers a push notification directly via the service worker.
// This works independently of the server cron — no external scheduler needed
// for users who regularly open the app.

export async function checkAndFireDueReminders(
  meds: { id: string; name: string; dose: string | null; reminder_times: string[] | null }[],
  todayLogs: { med_id: string; status: string }[]
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = now.toISOString().split('T')[0]

  const takenIds = new Set(todayLogs.filter(l => l.status === 'taken').map(l => l.med_id))

  for (const med of meds) {
    if (!med.reminder_times?.length) continue
    if (takenIds.has(med.id)) continue

    const isDue = med.reminder_times.some(t => {
      const [h, m] = t.split(':').map(Number)
      const targetMin = h * 60 + m
      return Math.abs(targetMin - nowMin) <= 5 // within 5 minutes
    })

    if (!isDue) continue

    // Fire notification via service worker registration
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(`Phlox — ${med.name}${med.dose ? ' ' + med.dose : ''}`, {
      body: `Hora de tomar o ${med.name}. Toca para confirmar.`,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: `reminder-${med.id}-${today}`,
      data: { url: `/mymeds?confirm=${med.id}&date=${today}`, med_id: med.id },
      actions: [
        { action: 'confirm', title: '✓ Tomei' },
        { action: 'snooze',  title: '⏱ 30 min' },
      ],
    } as NotificationOptions)
  }
}

// Register a periodic check (runs while app is open)
let _reminderInterval: ReturnType<typeof setInterval> | null = null

export function startClientReminderLoop(
  getMeds: () => { id: string; name: string; dose: string | null; reminder_times: string[] | null }[],
  getLogs: () => { med_id: string; status: string }[]
) {
  if (_reminderInterval) return
  // Check every 5 minutes
  _reminderInterval = setInterval(() => {
    checkAndFireDueReminders(getMeds(), getLogs()).catch(() => {})
  }, 5 * 60 * 1000)
}

export function stopClientReminderLoop() {
  if (_reminderInterval) {
    clearInterval(_reminderInterval)
    _reminderInterval = null
  }
}
