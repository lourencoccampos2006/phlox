// Temporário: a página de conformidade e o registo de tratamentos.
import { chromium } from 'playwright'
import { assentar } from './qa-esperar.mjs'
import path from 'node:path'
const BASE = 'http://localhost:3311'
const ONDE = path.join(process.cwd(), '.fotos')

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await ctx.newPage()
  const erros = []
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 250)) })
  page.on('pageerror', e => erros.push('PAGEERROR ' + String(e).slice(0, 250)))

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'qa1781881827891@phloxqa.pt')
  await page.fill('input[type="password"]', 'QaPhlox2026!')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {})

  await page.goto(BASE + '/conformidade', { waitUntil: 'domcontentloaded' })
  await assentar(page); await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(ONDE, 'conformidade.png') })
  console.log('✓ checklist')

  await page.getByRole('tab', { name: /registo de tratamentos/i }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(ONDE, 'conformidade-registo.png') })
  console.log('✓ registo')

  // Abrir uma atividade para ver o detalhe.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /Processo individual do utente/i.test(x.textContent || ''))
    if (b) { b.scrollIntoView({ block: 'center' }); b.click() }
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(ONDE, 'conformidade-atividade.png') })
  console.log('✓ atividade aberta')

  // E a política de privacidade, sem sessão.
  const p2 = await ctx.newPage()
  await p2.goto(BASE + '/privacy', { waitUntil: 'domcontentloaded' })
  await assentar(p2); await p2.waitForTimeout(800)
  await p2.screenshot({ path: path.join(ONDE, 'privacidade.png') })
  const t = await p2.evaluate(() => document.body.innerText)
  console.log(/cookies de publicidade/i.test(t) ? '✗ ainda fala de cookies de publicidade' : '✓ sem cookies de publicidade')
  console.log(/consentimento explícito \(art\. 9\.º\/2-a\)/.test(t) && !/9\.º\/2-h/.test(t)
    ? '✗ base legal ainda é consentimento' : '✓ base legal corrigida')

  console.log(erros.length ? 'ERROS:' : 'sem erros na consola')
  ;[...new Set(erros)].forEach(e => console.log('  X ' + e))
} finally { await browser.close() }
