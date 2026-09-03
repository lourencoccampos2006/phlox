// scripts/qa-varredura.mjs — passa por todas as rotas alcançáveis e regista
// tudo o que corre mal: crashes, erros de consola, respostas 4xx/5xx do
// Supabase e das APIs, e páginas que ficam em branco.

import { chromium } from 'playwright'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE || 'http://localhost:3001'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'

// Todas as rotas estáticas de app/ (sem [param], sem api, sem grupos).
function rotas(dir = 'app', prefixo = '') {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (!statSync(p).isDirectory()) continue
    if (e.startsWith('[') || e === 'api' || e.startsWith('(') || e.startsWith('_')) continue
    const r = prefixo + '/' + e
    try { statSync(join(p, 'page.tsx')); out.push(r) } catch {}
    out.push(...rotas(p, r))
  }
  return out
}

const IGNORAR = /^\/(blog|partilhar|c|v|auth|checkout|convite)\b/
const TODAS = ['/', ...rotas().filter(r => !IGNORAR.test(r))].sort()
const ALVO = process.env.ROTAS ? process.env.ROTAS.split(',') : TODAS

console.log(`${ALVO.length} rotas a varrer em ${BASE}\n`)

const navegador = await chromium.launch()
const problemas = []
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  let atual = []
  page.on('console', m => { if (m.type() === 'error') atual.push(['consola', m.text().slice(0, 150)]) })
  page.on('pageerror', e => atual.push(['CRASH', String(e.message).slice(0, 150)]))
  page.on('response', r => {
    const s = r.status(), u = r.url()
    if (s < 400) return
    if (/supabase\.co\/rest/.test(u)) atual.push([`http ${s}`, 'supabase ' + decodeURIComponent(u.split('/rest/v1/')[1] || '').split('&')[0].slice(0, 70)])
    else if (u.startsWith(BASE)) atual.push([`http ${s}`, u.replace(BASE, '')])
  })

  for (const r of ALVO) {
    atual = []
    let status = 0
    try {
      const resp = await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 25_000 })
      status = resp?.status() || 0
      await page.waitForTimeout(1800)
    } catch (e) { atual.push(['navegação', String(e).slice(0, 100)]) }

    const texto = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim()).catch(() => '')
    if (texto.length < 25) atual.push(['vazio', `só ${texto.length} caracteres de texto`])

    const unicos = [...new Map(atual.map(x => [x[0] + x[1], x])).values()]
    if (status >= 400) unicos.unshift([`http ${status}`, 'a própria página'])
    if (unicos.length) {
      problemas.push([r, unicos])
      console.log(`✗ ${r}`)
      unicos.slice(0, 4).forEach(([t, d]) => console.log(`    ${t.padEnd(9)} ${d}`))
    }
  }
} finally { await navegador.close() }

console.log(`\n${'═'.repeat(60)}`)
console.log(problemas.length ? `${problemas.length} rotas com problemas (de ${ALVO.length})` : `Nenhum problema em ${ALVO.length} rotas.`)
const porTipo = {}
problemas.forEach(([, ps]) => ps.forEach(([t, d]) => { const k = `${t} · ${d.slice(0, 60)}`; porTipo[k] = (porTipo[k] || 0) + 1 }))
console.log('\nmais frequentes:')
Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}×  ${k}`))
