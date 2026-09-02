// scripts/qa-perf-dup.mjs — duas perguntas concretas:
//   1) as consultas ao Supabase repetem-se? quais e quantas vezes?
//   2) quanto tempo demora isto numa ligação de telemóvel a sério?

import { chromium, devices } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3100'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const ROTA = process.env.ROTA || '/painel'

const navegador = await chromium.launch()
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  // ── 1. Repetições ────────────────────────────────────────────────────────
  const contagem = new Map()
  page.on('request', r => {
    const u = r.url()
    if (!/supabase\.co\/rest/.test(u)) return
    const chave = decodeURIComponent(u.split('/rest/v1/')[1] || '').split('&')[0].slice(0, 55)
    contagem.set(chave, (contagem.get(chave) || 0) + 1)
  })
  await page.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
  await page.waitForTimeout(1500)

  const linhas = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  const total = linhas.reduce((s, [, n]) => s + n, 0)
  const repetidas = linhas.filter(([, n]) => n > 1)
  console.log(`\n${ROTA} — ${total} chamadas ao Supabase, ${linhas.length} consultas distintas`)
  console.log(`${repetidas.reduce((s, [, n]) => s + n - 1, 0)} são repetições do mesmo pedido\n`)
  linhas.forEach(([q, n]) => console.log(`  ${String(n).padStart(2)}×  ${q}`))
  await ctx.close()

  // ── 2. A mesma página num telemóvel com rede de telemóvel ────────────────
  const movel = await navegador.newContext({ ...devices['Pixel 7'] })
  const p2 = await movel.newPage()
  const cdp = await movel.newCDPSession(p2)
  await cdp.send('Network.enable')
  // 4G realista: ~1,6 Mbps a descarregar, 150 ms de latência.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8, latency: 150,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }) // telemóvel médio

  await p2.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p2.fill('input[type="email"]', EMAIL)
  await p2.fill('input[type="password"]', PASS)
  await p2.click('button[type="submit"]')
  await p2.waitForURL(/\/inicio|\/painel/, { timeout: 60_000 }).catch(() => {})

  const c2 = await movel.newCDPSession(p2); await c2.send('Network.clearBrowserCache'); await c2.detach()
  const t0 = Date.now()
  await p2.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
  const dcl = Date.now() - t0
  await p2.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {})
  const quieto = Date.now() - t0
  const lcp = await p2.evaluate(() => new Promise(res => {
    let v = 0
    new PerformanceObserver(l => { for (const e of l.getEntries()) v = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    setTimeout(() => res(Math.round(v)), 600)
  }))
  console.log(`\nTelemóvel médio em 4G (1,6 Mbps · 150 ms · CPU 4× mais lento), cache fria:`)
  console.log(`  HTML pronto: ${dcl} ms · maior elemento pintado: ${lcp} ms · tudo carregado: ${quieto} ms`)
  await movel.close()
} finally {
  await navegador.close()
}
