// scripts/qa-mapa-sino.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Duas coisas que só se provam a olhar: o mapa não pode ter carimbo nenhum, e
// o sino tem de voltar a existir no header.
//
//   node scripts/qa-mapa-sino.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3100'
const DEST = process.env.DEST || '.'

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await ctx.newPage()

  // Que azulejos é que o mapa foi mesmo buscar, e a quem.
  const azulejos = []
  p.on('response', r => {
    const u = r.url()
    if (/tile|basemap/.test(u) && /\.png/.test(u)) azulejos.push(`${r.status()} ${new URL(u).host}`)
  })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(4500)

  // ── O sino ────────────────────────────────────────────────────────────────
  const sino = await p.evaluate(() =>
    !!document.querySelector('header svg path[d*="M18 8A6 6 0"]') ||
    !!Array.from(document.querySelectorAll('svg path')).some(x => (x.getAttribute('d') || '').includes('M18 8A6 6 0')))
  console.log('sino no header:', sino ? 'SIM' : 'NAO')

  // ── O mapa ────────────────────────────────────────────────────────────────
  await p.goto(BASE + '/apoio-servicos', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(6000)

  const temMapa = await p.evaluate(() => !!document.querySelector('.leaflet-container'))
  console.log('mapa Leaflet presente:', temMapa ? 'SIM' : 'nao (sem coordenadas nesta conta)')

  const hosts = [...new Set(azulejos)]
  console.log('azulejos carregados:', hosts.length ? hosts.join(', ') : 'nenhum')
  console.log('algum da CARTO?', hosts.some(h => /carto/.test(h)) ? 'SIM (MAU)' : 'nao (bom)')

  const filtro = await p.evaluate(() => {
    const el = document.querySelector('.leaflet-tile-pane')
    return el ? getComputedStyle(el).filter : null
  })
  console.log('filtro no painel dos azulejos:', filtro || '(sem mapa)')

  const el = await p.$('.leaflet-container')
  if (el) { await el.screenshot({ path: `${DEST}/mapa.png` }); console.log('captura -> mapa.png') }
} finally { await b.close() }
