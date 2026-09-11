// scripts/qa-transportes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Abre as páginas mexidas nesta ronda num browser a sério e apanha erros de
// consola, erros de rede e transbordo horizontal no telemóvel.
//
// Viewport REAL, nunca fullPage — fullPage esconde exatamente os bugs de
// layout que interessa apanhar.
//
//   node scripts/qa-transportes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3100'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'

const ROTAS = ['/apoio-servicos', '/settings?tab=notifications', '/mar', '/historico', '/patients']

const RUIDO = [
  /favicon/i, /adsbygoogle/i, /Download the React DevTools/i,
  /net::ERR_INTERNET_DISCONNECTED/i, /googletagmanager/i,
  /Edge Runtime is deprecated/i, /nominatim|photon|cartocdn|osrm/i,
]
const ruido = t => RUIDO.some(r => r.test(String(t)))

const browser = await chromium.launch()
try {
  let problemas = 0

  for (const largura of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 780 : 900 } })
    const p = await ctx.newPage()

    const erros = []
    p.on('console', m => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()) })
    p.on('pageerror', e => { if (!ruido(e.message)) erros.push('CRASH: ' + e.message) })
    p.on('response', r => { if (r.status() >= 400 && !ruido(r.url())) erros.push(`${r.status()} ${r.url().slice(0, 130)}`) })

    // entrar
    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', EMAIL)
    await p.fill('input[type="password"]', PASS)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(4000)

    console.log(`\n══ ${largura}px ══`)
    for (const rota of ROTAS) {
      erros.length = 0
      try {
        await p.goto(BASE + rota, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await p.waitForTimeout(3000)
      } catch (e) {
        console.log(`  FALHA ${rota} — não abriu: ${e.message.slice(0, 70)}`); problemas++; continue
      }

      // transbordo horizontal: no telemóvel é o que estraga tudo
      const transborda = await p.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)

      // os separadores novos existem?
      const separadores = rota.startsWith('/apoio-servicos')
        ? await p.evaluate(() => ['Casa', 'Consultas', 'Passeios', 'Pontuais', 'Roupa', 'Outros']
            .filter(t => document.body.innerText.includes(t)).length)
        : null

      const mau = erros.length || transborda
      if (mau) problemas++
      console.log(
        `  ${mau ? 'PROBLEMA' : 'ok      '} ${rota}` +
        (transborda ? ' · TRANSBORDA na horizontal' : '') +
        (separadores != null ? ` · ${separadores}/6 separadores` : '') +
        (erros.length ? `\n           ${erros.slice(0, 3).join('\n           ')}` : ''))
    }
    await ctx.close()
  }

  console.log(problemas ? `\n${problemas} problema(s).\n` : '\nSem problemas.\n')
  process.exitCode = problemas ? 1 : 0
} finally {
  await browser.close()
}
