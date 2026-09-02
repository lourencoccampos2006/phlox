// scripts/qa-presencas.mjs — marca uma presença a partir do painel e confirma
// que ficou mesmo gravada (e não só pintada no ecrã).
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:3001'
const ROTA = process.env.ROTA || '/painel-preview'
const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const erros = []
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)) })
  p.on('dialog', d => { erros.push('ALERTA: ' + d.message()); d.dismiss() })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', 'QaPhlox2026!')
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  await p.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)

  const cartao = p.locator('.pn-cel', { hasText: 'PRESENÇAS DE HOJE' }).first()
  console.log('cartão de presenças presente:', await cartao.count() > 0)
  console.log('cabeçalho:', (await cartao.locator('span').first().textContent().catch(() => '—')))
  await p.screenshot({ path: 'tmp-qa-painel/presencas-antes.png' })

  const btn = cartao.getByRole('button', { name: 'Presente' }).first()
  if (await btn.count()) {
    await btn.click()
    await p.waitForTimeout(2500)
    console.log('depois de marcar:', (await cartao.textContent() || '').replace(/\s+/g, ' ').slice(0, 170))
    await p.screenshot({ path: 'tmp-qa-painel/presencas-depois.png' })
    // recarrega: só conta se sobreviver a um refresh
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000)
    const dep = p.locator('.pn-cel', { hasText: 'PRESENÇAS DE HOJE' }).first()
    console.log('depois de recarregar:', (await dep.textContent() || '').replace(/\s+/g, ' ').slice(0, 170))
  } else {
    console.log('sem botão "Presente" — já estava tudo marcado?')
    console.log((await cartao.textContent() || '').replace(/\s+/g, ' ').slice(0, 200))
  }

  // mobile
  const m = await b.newContext({ viewport: { width: 390, height: 844 } })
  const pm = await m.newPage()
  await pm.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await pm.fill('input[type="email"]', 'qa1781881827891@phloxqa.pt')
  await pm.fill('input[type="password"]', 'QaPhlox2026!')
  await pm.click('button[type="submit"]')
  await pm.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})
  await pm.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' }); await pm.waitForTimeout(4000)
  const tr = await pm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log('mobile: transbordo lateral =', tr, 'px')
  await pm.screenshot({ path: 'tmp-qa-painel/presencas-mobile.png' })
  await m.close()

  console.log(erros.length ? 'PROBLEMAS:\n - ' + [...new Set(erros)].join('\n - ') : 'sem erros de consola')
} finally { await b.close() }
