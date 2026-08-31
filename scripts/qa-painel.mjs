// scripts/qa-painel.mjs — vê o /painel a sério, num browser, nos cinco separadores.
//
// Não usa fullPage: um screenshot de página inteira estica o viewport e esconde
// exatamente os defeitos que interessam (transbordo lateral, cartões cortados,
// grelhas que não colapsam). Tira à altura real do ecrã, como quem lá está.

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const ROTA = process.env.ROTA || '/painel'
const OUT = 'tmp-qa-painel'
mkdirSync(OUT, { recursive: true })

const ABAS = ['hoje', 'cuidados', 'pessoas', 'equipa', 'gestao']
const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]

const navegador = await chromium.launch()
try {
  for (const [nome, viewport] of VIEWPORTS) {
    const ctx = await navegador.newContext({ viewport })
    const page = await ctx.newPage()
    const problemas = []
    page.on('console', m => { if (m.type() === 'error') problemas.push(`console: ${m.text().slice(0, 200)}`) })
    page.on('pageerror', e => problemas.push(`pageerror: ${String(e.message).slice(0, 200)}`))

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

    console.log(`[${nome}] login -> ${page.url().replace(BASE, '')}`)

    for (const aba of ABAS) {
      const url = aba === 'hoje' ? ROTA : `${ROTA}?aba=${aba}`
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(3500)

      const info = await page.evaluate(() => ({
        titulo: document.querySelector('h1')?.textContent?.trim().slice(0, 90) || null,
        eyebrow: document.querySelector('h1')?.previousElementSibling?.textContent?.trim().slice(0, 70) || null,
        transbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        kpis: document.querySelectorAll('.pn-kpis > div').length,
        cartoes: document.querySelectorAll('.pn-cel').length,
        svgs: document.querySelectorAll('.pn-cel svg').length,
        linhasTabela: document.querySelectorAll('.pn-tab').length,
        pastas: document.querySelectorAll('.pn-cel button').length,
        texto: (document.body.innerText || '').slice(0, 0),
      }))
      await page.screenshot({ path: `${OUT}/${nome}-${aba}.png` })
      console.log(`  ${aba.padEnd(9)} h1="${info.titulo}" kpis=${info.kpis} cartoes=${info.cartoes} svg=${info.svgs} tab=${info.linhasTabela} transbordo=${info.transbordo}px`)
    }

    // Abrir uma pasta e confirmar que expande no sítio (e não em cada cartão).
    await page.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const botoesPasta = page.locator('.pn-cel button')
    const nBotoes = await botoesPasta.count()
    if (nBotoes) {
      await botoesPasta.first().click()
      await page.waitForTimeout(600)
      const ferramentas = await page.locator('.pn-ferr').count()
      const fechar = await page.getByText('Fechar', { exact: true }).count()
      console.log(`  pastas: ${nBotoes} botões → abriu com ${ferramentas} ferramentas, botão Fechar=${fechar}`)
      await page.screenshot({ path: `${OUT}/${nome}-pasta-aberta.png` })
    } else {
      console.log('  pastas: nenhum botão de pasta encontrado')
    }

    if (problemas.length) console.log(`  ⚠ ${problemas.length} problemas:\n   - ${[...new Set(problemas)].slice(0, 6).join('\n   - ')}`)
    else console.log('  sem erros de consola')
    await ctx.close()
  }
} finally {
  await navegador.close()
}
