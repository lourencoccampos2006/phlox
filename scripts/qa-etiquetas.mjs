import { chromium } from 'playwright'
const BASE = 'http://localhost:3311'
const b = await chromium.launch()
try {
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage()
  const erros = []
  p.on('pageerror', e => erros.push('CRASH ' + String(e).split('\n')[0].slice(0, 140)))
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 170)) })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', 'QaPhlox2026!')
  await p.click('button[type="submit"]'); await p.waitForTimeout(6000)

  await p.goto(BASE + '/patients', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => (document.body?.innerText || '').trim().length > 400, null, { timeout: 25000 }).catch(() => {})
  await p.waitForTimeout(3000)

  // Abrir a ficha da primeira pessoa
  const ficha = p.locator('a[href^="/patients/"]').first()
  const href = await ficha.getAttribute('href')
  console.log('ficha:', href)
  await p.goto(BASE + href, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => (document.body?.innerText || '').trim().length > 400, null, { timeout: 25000 }).catch(() => {})
  await p.waitForTimeout(5000)

  const t = await p.locator('body').innerText()
  console.log('a ficha fala de etiquetas:', /etiqueta/i.test(t))
  const botoes = await p.locator('button').allInnerTexts()
  console.log('botões com "etiqueta":', botoes.filter(x => /etiqueta/i.test(x)).slice(0, 5))

  // Tentar abrir o selector
  const por = p.locator('button').filter({ hasText: /etiqueta/i }).first()
  if (await por.count()) {
    await por.click(); await p.waitForTimeout(1500)
    const depois = await p.locator('body').innerText()
    console.log('abriu o catálogo:', /Risco de queda|Disfagia|Diabetes/i.test(depois))
    // Clicar numa etiqueta do catálogo
    const et = p.locator('button').filter({ hasText: /Risco de queda/ }).first()
    if (await et.count()) {
      await et.click(); await p.waitForTimeout(2500)
      const fim = await p.locator('body').innerText()
      console.log('erro visível depois de clicar:', /não foi possível|erro|PHX-/i.test(fim))
      const m = fim.match(/[^\n]*(?:não foi possível|PHX-)[^\n]*/i)
      if (m) console.log('  →', m[0].slice(0, 120))
    } else {
      const todos = await p.locator('button').allInnerTexts()
      console.log('botões visíveis:', todos.filter(x=>x.trim()).slice(0,14))
    }
  } else {
    console.log('NÃO HÁ botão de etiquetas na ficha')
    console.log(t.slice(0, 400).replace(/\n{2,}/g, '\n'))
  }
  console.log('erros:', erros.length ? erros.slice(0, 3) : 'nenhum')
} finally { await b.close() }
