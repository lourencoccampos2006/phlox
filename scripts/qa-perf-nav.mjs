// scripts/qa-perf-nav.mjs — o tempo que interessa a quem usa: clicar num link e
// ver a página nova. Entre o clique e o conteúdo, o Next mantém a página
// ANTERIOR no ecrã; sem loading.tsx não há sinal nenhum de que algo avança, e é
// isso que se sente como "está lento" mesmo quando os números não são maus.

import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:3100'

const SALTOS = [
  ['/painel', '/patients', 'Utentes'],
  ['/patients', '/mar', 'MAR'],
  ['/mar', '/equipa', 'Equipa'],
  ['/equipa', '/painel', 'Painel'],
]

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  console.log('\nnavegação dentro da app — clique real num link:')
  for (const [de, para] of SALTOS) {
    await p.goto(BASE + de, { waitUntil: 'domcontentloaded' })
    await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    const link = p.locator(`a[href="${para}"], a[href^="${para}?"]`).first()
    if (!await link.count()) { console.log(`  ${de} → ${para}: sem link visível nesta página`); continue }

    const t0 = Date.now()
    await link.click({ force: true })
    await p.waitForFunction(u => location.pathname === u, para, { timeout: 20_000 }).catch(() => {})
    const url = Date.now() - t0
    // Conteúdo pronto = já há um h1 com texto e a rede assentou.
    await p.waitForFunction(() => {
      const h = document.querySelector('h1')
      return !!h && (h.textContent || '').trim().length > 3
    }, null, { timeout: 20_000 }).catch(() => {})
    const h1 = Date.now() - t0
    await p.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    console.log(`  ${de.padEnd(11)} → ${para.padEnd(11)}  url ${String(url).padStart(4)}ms · título ${String(h1).padStart(5)}ms · dados ${String(Date.now() - t0).padStart(5)}ms`)
  }
} finally { await b.close() }
