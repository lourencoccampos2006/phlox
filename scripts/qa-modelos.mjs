// scripts/qa-modelos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QA real dos modelos de documentos (item 16).
//
// Abre /documentos, confirma as duas vistas, e — quando a migração já estiver
// corrida — escreve um modelo, preenche-o para alguém e confere que o que
// falta aparece ANTES do botão de emitir.
//
// Viewport REAL, nunca `fullPage`. E nunca se clica em imprimir.
//
//   node scripts/qa-modelos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const OUT = process.env.QA_OUT || '.'

const browser = await chromium.launch()
try {
  for (const [nome, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
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

    await p.goto(BASE + '/documentos', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(8000)

    console.log(`\n═══ ${nome} · /documentos ═══`)
    const t = await p.locator('body').innerText()
    console.log('tem as duas vistas:', t.includes('Modelos') && t.includes('Guardados'))
    const porInstalar = t.includes('PHX-X6')
    console.log('migração por correr (PHX-X6):', porInstalar)
    console.log('sem texto técnico à vista:',
      !/relation|does not exist|schema cache|PGRST/i.test(t))

    if (!porInstalar) {
      // Escrever um modelo e preenchê-lo.
      const novo = p.locator('button', { hasText: /^Novo modelo$/ }).first()
      if (await novo.count()) {
        await novo.click(); await p.waitForTimeout(1200)
        await p.locator('input[placeholder*="Ficha de inscrição"]').first().fill('QA — teste de modelo')
        const corpo = p.locator('textarea').first()
        await corpo.fill('Eu, {{nome}}, NIF {{nif}}, em {{casa.cidade}} a {{hoje}}. E {{errado_de_proposito}}.')
        await p.waitForTimeout(600)
        const aviso = await p.locator('body').innerText()
        console.log('avisa do campo que não existe:', aviso.includes('não existem') || aviso.includes('não existe'))
        await p.screenshot({ path: `${OUT}/modelos-${nome}-editor.png` })
        await p.locator('button', { hasText: /^Cancelar$/ }).first().click()
        await p.waitForTimeout(600)
      }

      const preencher = p.locator('button', { hasText: /Preencher para/ }).first()
      if (await preencher.count()) {
        await preencher.click(); await p.waitForTimeout(1200)
        const sel = p.locator('select').first()
        const opcoes = await sel.locator('option').count()
        if (opcoes > 1) {
          await sel.selectOption({ index: 1 })
          await p.waitForTimeout(1200)
          const v = await p.locator('body').innerText()
          console.log('mostra o documento preenchido:', v.includes('Como vai sair'))
          console.log('diz o que falta na ficha:', /não tem est/i.test(v))
          console.log('nunca mostra "undefined":', !v.includes('undefined'))
          await p.screenshot({ path: `${OUT}/modelos-${nome}-preencher.png` })
        }
      }
    } else {
      await p.screenshot({ path: `${OUT}/modelos-${nome}.png` })
    }

    console.log('scroll horizontal:', await p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) ? 'SIM — mau' : 'não')
    console.log('erros de consola:', erros.length ? erros.slice(0, 3) : 'nenhum')
    await ctx.close()
  }
} finally {
  await browser.close()
}
