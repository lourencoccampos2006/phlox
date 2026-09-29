// scripts/qa-ronda.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QA real da ronda coordenada (sprint167).
//
// Arranca uma ronda, abre o primeiro cartão e confere que o painel traz mais
// do que a medicação e os três botões de estado — que era a queixa.
//
// Viewport REAL, nunca `fullPage`.
//
//   node scripts/qa-ronda.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const OUT = process.env.QA_OUT || '.'

const browser = await chromium.launch()
try {
  for (const [nome, viewport] of [
    ['telemovel', { width: 390, height: 844 }],
    ['desktop', { width: 1280, height: 900 }],
  ]) {
    const ctx = await browser.newContext({ viewport })
    const p = await ctx.newPage()
    const erros = []
    p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 150)) })
    p.on('pageerror', e => erros.push('PAGEERROR ' + String(e).slice(0, 150)))

    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', EMAIL)
    await p.fill('input[type="password"]', PASS)
    await p.click('button[type="submit"]')
    await p.waitForTimeout(6000)

    await p.goto(BASE + '/ronda-guiada', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(6000)

    // Arrancar a ronda, se ainda não houver uma.
    //
    // Quem abre a página JÁ VEM escolhido como participante — o primeiro
    // feitio deste guião clicava no próprio nome e desmarcava-o, e depois
    // culpava a página por dizer «(0)». Não se clica em ninguém; espera-se
    // que o botão fique disponível.
    const arrancar = p.locator('button', { hasText: /Começar ronda/i }).first()
    if (await arrancar.count()) {
      try {
        await arrancar.click({ timeout: 25000 })
        await p.waitForTimeout(9000)
      } catch {
        console.log('a ronda não arrancou:', (await arrancar.innerText()).trim())
      }
    }

    const texto = await p.locator('body').innerText()
    console.log(`\n═══ ${nome} · /ronda-guiada ═══`)
    console.log(texto.slice(0, 1400).replace(/\n{3,}/g, '\n\n'))

    // As secções que a queixa dizia faltarem.
    const seccoes = [
      'Medicação deste turno', 'Se for preciso', 'Do plano, para hoje',
      'Cuidados de hoje', 'Já registado hoje', 'Da ronda anterior',
      'Medir sinais vitais', 'Como está',
    ]
    console.log('\nsecções presentes:',
      seccoes.filter(t => texto.includes(t)).join(' | ') || 'nenhuma')

    // Abrir os vitais e escrever um valor impossível.
    const medir = p.locator('button', { hasText: /Medir sinais vitais/ }).first()
    if (await medir.count()) {
      await medir.click(); await p.waitForTimeout(600)
      const caixas = p.locator('input[inputmode="decimal"]')
      console.log('caixas de vitais:', await caixas.count())
      await caixas.first().fill('1200')
      await p.waitForTimeout(400)
      const depois = await p.locator('body').innerText()
      console.log('avisa que 1200 de tensão não vai ser guardado:',
        depois.includes('fora do possível'))
      await caixas.first().fill('185')
      await p.waitForTimeout(400)
      console.log('assinala 185 como tensão alta:',
        (await p.locator('body').innerText()).includes('tensão alta'))
      await caixas.first().fill('')
    }

    console.log('scroll horizontal:', await p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) ? 'SIM — mau' : 'não')
    await p.screenshot({ path: `${OUT}/ronda-${nome}.png` })
    console.log('erros de consola:', erros.length ? erros.slice(0, 4) : 'nenhum')
    await ctx.close()
  }
} finally {
  await browser.close()
}
