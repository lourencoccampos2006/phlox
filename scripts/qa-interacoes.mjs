// scripts/qa-interacoes.mjs — carrega nos botões a sério. Abrir uma página não
// prova nada: os erros que interessam aparecem ao clicar.
// NUNCA clica em imprimir (abre diálogos do sistema).

import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:3100'
const b = await chromium.launch()
const falhas = []
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  let erros = []
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 130)) })
  p.on('pageerror', e => erros.push('CRASH: ' + String(e.message).slice(0, 130)))
  p.on('dialog', async d => { erros.push('ALERTA: ' + d.message().slice(0, 90)); await d.dismiss() })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', 'QaPhlox2026!')
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  async function passo(nome, fn) {
    erros = []
    try { await fn() } catch (e) { erros.push('EXCEÇÃO: ' + String(e).slice(0, 110)) }
    await p.waitForTimeout(500)
    const u = [...new Set(erros)]
    if (u.length) { falhas.push([nome, u]); console.log(`✗ ${nome}`); u.slice(0,3).forEach(x => console.log(`    ${x}`)) }
    else console.log(`ok ${nome}`)
  }

  // ── /painel: os cinco separadores + abrir uma pasta ─────────────────────
  for (const aba of ['hoje','cuidados','pessoas','equipa','gestao']) {
    await passo(`painel · separador ${aba}`, async () => {
      await p.goto(`${BASE}/painel?aba=${aba}`, { waitUntil: 'domcontentloaded' })
      await p.waitForTimeout(2600)
    })
  }
  await passo('painel · abrir e fechar uma pasta', async () => {
    await p.goto(BASE + '/painel', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2600)
    const btn = p.locator('.pn-cel button').first()
    if (await btn.count()) { await btn.click(); await p.waitForTimeout(700)
      const fechar = p.getByRole('button', { name: 'Fechar' }).first()
      if (await fechar.count()) await fechar.click() }
  })

  // ── /care-log: o atalho novo ────────────────────────────────────────────
  await passo('care-log · escolher pessoa e ver o atalho', async () => {
    await p.goto(BASE + '/care-log', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2600)
    const sel = p.locator('select').first()
    const ops = await sel.locator('option').count()
    if (ops > 1) { await sel.selectOption({ index: 1 }); await p.waitForTimeout(1600) }
    const t = (await p.locator('body').innerText()).replace(/\s+/g,' ')
    if (!t.includes('Está tudo como da última vez') && !t.includes('Contexto do registo')) throw new Error('formulário não apareceu')
  })
  await passo('care-log · "Mudou alguma coisa" abre o formulário cheio', async () => {
    const b2 = p.getByRole('button', { name: 'Mudou alguma coisa' })
    if (await b2.count()) { await b2.click(); await p.waitForTimeout(900) }
  })

  // ── Formulários principais: abrir sem rebentar ──────────────────────────
  const abrir = [
    ['/patients', 'Novo|Adicionar'],
    ['/incidents', 'Registar|Nova|Nov'],
    ['/activities', 'Nova|Criar|Agendar'],
    ['/stock', 'Adicionar|Novo'],
    ['/assessments', 'Nova|Avaliar'],
    ['/feridas', 'Nova|Registar'],
    ['/apoio-servicos', 'Novo|Adicionar|transporte'],
    ['/preparacao-medicacao', 'Semana|.'],
    ['/agenda', 'Nova|Marcar|Adicionar'],
    ['/equipa', 'Convidar|Adicionar|Criar'],
  ]
  for (const [rota, padrao] of abrir) {
    await passo(`${rota} · abrir formulário`, async () => {
      await p.goto(BASE + rota, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2400)
      const btn = p.getByRole('button', { name: new RegExp(padrao, 'i') }).first()
      if (await btn.count()) { await btn.click(); await p.waitForTimeout(1100) }
    })
  }

  // ── Navegação pela barra lateral ────────────────────────────────────────
  await passo('sidebar · percorrer os links institucionais', async () => {
    await p.goto(BASE + '/painel', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200)
    const links = await p.locator('nav a[href^="/"], aside a[href^="/"]').evaluateAll(a => [...new Set(a.map(x => x.getAttribute('href')))].slice(0, 12))
    for (const h of links) {
      const r = await p.goto(BASE + h, { waitUntil: 'domcontentloaded' }).catch(() => null)
      if (r && r.status() >= 400) erros.push(`${h} → HTTP ${r.status()}`)
      await p.waitForTimeout(900)
    }
  })
} finally { await b.close() }
console.log(`\n${falhas.length ? falhas.length + ' passos com problemas' : 'Todos os passos sem erros.'}`)
