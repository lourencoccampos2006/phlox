// scripts/qa-mobile.mjs — transbordo lateral e elementos cortados, em viewport
// REAL de telemóvel (390×844). Nunca fullPage: uma captura de página inteira
// estica o viewport e esconde exatamente estes defeitos.

import { chromium } from 'playwright'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.BASE || 'http://localhost:3100'
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
const ALVO = process.env.ROTAS ? process.env.ROTAS.split(',') : ['/', ...rotas().filter(r => !IGNORAR.test(r))].sort()

const b = await chromium.launch()
const maus = []
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
  await p.click('button[type="submit"]')
  await p.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  console.log(`${ALVO.length} rotas a 390px\n`)
  for (const r of ALVO) {
    try {
      await p.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await p.waitForTimeout(1500)
    } catch { continue }
    const m = await p.evaluate(() => {
      const de = document.documentElement
      const transbordo = de.scrollWidth - de.clientWidth
      // Quem é que passa da margem direita — o culpado, não só o sintoma.
      const culpados = []
      if (transbordo > 1) {
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const b = el.getBoundingClientRect()
          if (b.width === 0 || b.right <= de.clientWidth + 1) continue
          const t = el.tagName.toLowerCase()
          const cls = (typeof el.className === 'string' ? el.className : '').slice(0, 28)
          culpados.push(`${t}${cls ? '.' + cls : ''} → ${Math.round(b.right)}px (larg ${Math.round(b.width)})`)
          if (culpados.length >= 3) break
        }
      }
      // Alvos de toque pequenos demais para um dedo.
      const pequenos = Array.from(document.querySelectorAll('button, a[href]')).filter(el => {
        const b = el.getBoundingClientRect()
        return b.width > 0 && b.height > 0 && b.height < 30 && (el.textContent || '').trim().length > 0
      }).length
      return { transbordo, culpados, pequenos }
    })
    if (m.transbordo > 1) {
      maus.push([r, m])
      console.log(`✗ ${r.padEnd(28)} transborda ${m.transbordo}px`)
      m.culpados.forEach(c => console.log(`      ${c}`))
    }
  }
} finally { await b.close() }
console.log(`\n${maus.length ? maus.length + ' rotas transbordam' : 'Nenhuma rota transborda a 390px.'} (de ${ALVO.length})`)
