// scripts/qa-inscricao.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QA real da inscrição (sprint165) e do calendário do ano (sprint166).
//
// Viewport REAL, nunca `fullPage`: uma captura de página inteira estica o
// ecrã e esconde exactamente os defeitos de telemóvel que interessam.
//
//   node scripts/qa-inscricao.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const OUT = process.env.QA_OUT || '.'

const limpo = t => t.slice(0, 900).replace(/\n{3,}/g, '\n\n')

const browser = await chromium.launch()
try {
  for (const [nome, viewport] of [
    ['desktop', { width: 1280, height: 860 }],
    ['telemovel', { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport })
    const p = await ctx.newPage()
    const erros = []
    p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)) })
    p.on('pageerror', e => erros.push('PAGEERROR ' + String(e).slice(0, 160)))

    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', EMAIL)
    await p.fill('input[type="password"]', PASS)
    await p.click('button[type="submit"]')
    await p.waitForTimeout(6000)

    const horizontal = () => p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

    // ── /inscricoes ────────────────────────────────────────────────────────
    await p.goto(BASE + '/inscricoes', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(7000)
    console.log(`\n═══ ${nome} · /inscricoes ═══`)
    console.log(limpo(await p.locator('body').innerText()))
    console.log('scroll horizontal:', await horizontal() ? 'SIM — mau' : 'não')
    await p.screenshot({ path: `${OUT}/insc-${nome}.png` })

    // ── /calendario-do-ano ─────────────────────────────────────────────────
    await p.goto(BASE + '/calendario-do-ano', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(9000)
    console.log(`\n═══ ${nome} · /calendario-do-ano ═══`)
    console.log(limpo(await p.locator('body').innerText()))
    console.log('scroll horizontal:', await horizontal() ? 'SIM — mau' : 'não')
    // Os 12 meses têm mesmo de lá estar.
    const meses = await p.locator('section h2').allInnerTexts()
    console.log('meses desenhados:', meses.length, '·', meses.join(' ').slice(0, 120))
    await p.screenshot({ path: `${OUT}/ano-${nome}.png` })

    // ── /patients, o formulário novo ───────────────────────────────────────
    await p.goto(BASE + '/patients', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(7000)
    const botao = p.locator('button', { hasText: /Adicionar|Novo/ }).first()
    if (await botao.count()) {
      await botao.click()
      await p.waitForTimeout(1500)
      const campos = await p.locator('label').allInnerTexts()
      console.log(`\n═══ ${nome} · Novo utente — ${campos.length} etiquetas ═══`)
      console.log(campos.join(' | '))
      console.log('caixas de data:', await p.locator('input[type="date"]').count(),
        '· ainda pede "Idade":', campos.some(c => /^idade/i.test(c.trim())))
      console.log('scroll horizontal:', await horizontal() ? 'SIM — mau' : 'não')
      await p.screenshot({ path: `${OUT}/form-${nome}.png` })
    } else {
      console.log(`\n${nome}: não encontrei o botão de adicionar.`)
    }

    console.log('erros de consola:', erros.length ? erros.slice(0, 4) : 'nenhum')
    await ctx.close()
  }
} finally {
  await browser.close()
}
