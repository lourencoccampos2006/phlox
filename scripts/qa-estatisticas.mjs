// scripts/qa-estatisticas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// QA real da página de estatísticas (item 17).
//
// Confere que os números aparecem, que cada um se explica, e que a IA é um
// extra por cima deles — se ela falhar, a página tem de continuar completa.
//
// Viewport REAL, nunca `fullPage`. E não se clica em imprimir.
//
//   node scripts/qa-estatisticas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const OUT = process.env.QA_OUT || '.'

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

    await p.goto(BASE + '/estatisticas', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(10000)

    console.log(`\n═══ ${nome} · /estatisticas ═══`)
    const t = await p.locator('body').innerText()

    // As oito secções têm de estar todas lá.
    const secoes = ['Movimento', 'Quem cá está', 'Cuidado', 'Registos',
      'Ocorrências', 'Equipa', 'Dinheiro', 'Famílias']
    console.log('secções presentes:', secoes.filter(s => t.includes(s)).length, 'de 8')
    console.log('em falta:', secoes.filter(s => !t.includes(s)).join(', ') || 'nenhuma')

    const explicacoes = await p.locator('button', { hasText: 'como se calcula' }).count()
    console.log('indicadores que se explicam:', explicacoes)

    // O que NUNCA pode aparecer.
    console.log('nada de "undefined"/"NaN":', !/undefined|NaN/.test(t))
    console.log('sem texto técnico:', !/relation|does not exist|schema cache|PGRST/i.test(t))

    // Abrir uma explicação.
    if (explicacoes) {
      await p.locator('button', { hasText: 'como se calcula' }).first().click()
      await p.waitForTimeout(500)
      const depois = await p.locator('body').innerText()
      console.log('a explicação abre:', depois.length > t.length)
    }

    // A IA. Pode falhar (sem saldo, sem chave) — e se falhar, a página tem de
    // continuar completa. É isso que se verifica.
    const botao = p.locator('button', { hasText: /Organizar com IA/ }).first()
    if (await botao.count() && await botao.isEnabled()) {
      await botao.click()
      await p.waitForTimeout(22000)
      // Sem distinguir maiúsculas: o título tem `text-transform: uppercase` e
      // o `innerText` devolve-o em maiúsculas. Ja me enganei nisto hoje.
      const v = await p.locator('body').innerText()
      console.log('a IA respondeu alguma coisa:', /o que merece aten/i.test(v))
      console.log('os números continuam lá depois da IA:',
        secoes.filter(s => v.includes(s)).length === 8)
      console.log('diz que a IA não calcula:', v.includes('só ordena e explica'))
    } else {
      console.log('o botão da IA está desligado (sem números suficientes)')
    }

    console.log('scroll horizontal:', await p.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) ? 'SIM — mau' : 'não')
    await p.screenshot({ path: `${OUT}/estat-${nome}.png` })
    console.log('erros de consola:', erros.length ? erros.slice(0, 3) : 'nenhum')
    await ctx.close()
  }
} finally {
  await browser.close()
}
