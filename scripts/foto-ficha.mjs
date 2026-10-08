import { chromium } from 'playwright'
import path from 'node:path'
const BASE = 'http://localhost:3311'
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const p = await ctx.newPage()
  const erros = []
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 200)) })
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type=email]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt').catch(() => {})
  await p.fill('input[type=password]', process.env.QA_PASSWORD || 'QaPhlox2026!').catch(() => {})
  await p.click('button[type=submit]').catch(() => {})
  await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 40000 }).catch(() => {})
  await p.goto(BASE + '/patients', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => !document.querySelector('.skeleton'), { timeout: 40000 }).catch(() => {})
  await p.waitForTimeout(1500)
  // A lista pode nao ter links <a>: a /patients usa LinhaTabela com aoTocar.
  let href = await p.evaluate(() => document.querySelector('a[href^="/patients/"]')?.getAttribute('href') || null)
  if (!href) {
    const clicou = await p.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(x.textContent?.trim() || ''))
      if (b) { b.click(); return true } return false
    })
    if (clicou) { await p.waitForTimeout(2500); href = new URL(p.url()).pathname }
  }
  if (!href) { console.log('sem utentes na conta de QA'); process.exit(0) }
  await p.goto(BASE + href, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => !document.querySelector('.skeleton'), { timeout: 40000 }).catch(() => {})
  await p.waitForTimeout(2000)
  await p.screenshot({ path: path.join(process.cwd(), '.fotos', 'ficha-utente.png') })
  const d = await p.evaluate(() => ({ chars: document.body.innerText.length, rola: document.documentElement.scrollWidth > window.innerWidth + 2 }))
  console.log(`${href} · ${d.chars} car${d.rola ? ' · ROLA DE LADO' : ''}${erros.length ? ` · ${erros.length} erro(s): ${erros[0]}` : ''}`)
} finally { await browser.close() }
