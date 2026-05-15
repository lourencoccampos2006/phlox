// Cloudflare Workers entry point: wraps the opennextjs-cloudflare compiled worker
// and adds a `scheduled` export so Cloudflare Cron Triggers can call /api/push/cron.

// @ts-expect-error: resolved by wrangler after opennextjs build
import openNextWorker from './.open-next/worker.js'

export default openNextWorker

export async function scheduled(event, env, ctx) {
  const url = 'https://phlox.pt/api/push/cron'
  const secret = env.CRON_SECRET || ''
  ctx.waitUntil(
    env.WORKER_SELF_REFERENCE.fetch(
      new Request(url, { headers: { 'x-cron-secret': secret } })
    )
  )
}
