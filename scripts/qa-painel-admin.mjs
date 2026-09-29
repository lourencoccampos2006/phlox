// scripts/qa-painel-admin.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QA real do painel administrativo (item 9).
//
// Abre as cinco vistas, confere que cada uma desenha números e que nenhuma
// deixa o ecrã a rolar de lado. Viewport REAL, nunca `fullPage`.
//
//   node scripts/qa-painel-admin.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const OUT = process.env.QA_OUT || '.'
const ABAS = ['A casa', 'Cuidado', 'Equipa', 'Dinheiro', 'Conformidade']

const browser = await chromium.launch()
try {
  for (const [nome, viewport] of [
    ['desktop', { width: 1366, height: 900 }],
    ['telemovel', { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport })
    const p = await ctx.newPage()
    const erros = []
    p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 150)) })
    p.on('pageerror', e => erros.push('PAGEERROR ' + String(e).slice(0, 150)))

    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
    await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
    await p.click('button[type="submit"]')
    await p.waitForTimeout(6000)

    await p.goto(BASE + '/painel-dono', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(9000)

    console.log(`\n═══ ${nome} · /painel-dono ═══`)
    // Sem distinguir maiúsculas: o título tem `text-transform: uppercase`,
    // por isso o `innerText` devolve-o todo em maiúsculas.
    const topo = (await p.locator('body').innerText()).toLowerCase()
    console.log('chama-se «Painel administrativo»:', topo.includes('painel administrativo'))
    console.log('já não diz «Painel do dono»:', !topo.includes('painel do dono'))

    const horizontal = () => p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

    for (const aba of ABAS) {
      const b = p.locator('button', { hasText: new RegExp(`^${aba}$`) }).first()
      if (!await b.count()) { console.log(`  ${aba}: separador não encontrado`); continue }
      await b.click()
      await p.waitForTimeout(4500)
      const t = await p.locator('body').innerText()
      // Os títulos dos cartões que cada vista desenha.
      const cartoes = await p.locator('.pn-cel').count()
      console.log(`  ${aba.padEnd(14)} cartões: ${cartoes} · scroll lateral: ${await horizontal() ? 'SIM — mau' : 'não'}`
        + (t.includes('A carregar') ? ' · ainda a carregar' : ''))
      await p.screenshot({ path: `${OUT}/admin-${nome}-${aba.toLowerCase().replace(/\s/g, '')}.png` })
    }

    console.log('erros de consola:', erros.length ? erros.slice(0, 4) : 'nenhum')
    await ctx.close()
  }
} finally {
  await browser.close()
}
