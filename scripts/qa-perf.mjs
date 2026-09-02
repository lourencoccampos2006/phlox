// scripts/qa-perf.mjs — mede a lentidão onde ela se sente: no browser.
//
// Por rota: bytes transferidos (e quanto é JavaScript), número de pedidos, TTFB,
// quando o conteúdo aparece, e — o que mais interessa numa app assim — quantas
// chamadas ao Supabase a página dispara e se elas vão em paralelo ou em fila.
//
// Uma cadeia de pedidos em fila (A espera por B espera por C) é lentidão que não
// se resolve a cortar bundle: resolve-se a deixar de esperar.

import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3001'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const ROTAS = (process.env.ROTAS || '/inicio,/painel,/patients,/equipa,/mar,/').split(',')

const navegador = await chromium.launch()
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

  console.log(`base=${BASE}\n`)
  console.log('rota            bytes    js     req  sb  ttfb  dcl   quieto  cadeia  ult-sb')
  console.log('─'.repeat(84))

  for (const rota of ROTAS) {
    // Cache fria: é a primeira visita de alguém que nunca abriu o site. Sem
    // isto todas as rotas depois da primeira aparecem leves porque reaproveitam
    // os chunks já descarregados — o número bonito que esconde o problema.
    if (process.env.FRIA) await ctx.clearCookies({ name: 'nada' }).catch(() => {}) 
    if (process.env.FRIA) { const cdp = await ctx.newCDPSession(page); await cdp.send('Network.clearBrowserCache'); await cdp.detach() }
    const t0 = Date.now()
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' })
    const dcl = Date.now() - t0
    // "Quieto" = quando a rede para de trabalhar. É o momento em que a página
    // realmente acabou de carregar, do ponto de vista de quem está a olhar.
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
    const quieto = Date.now() - t0
    await page.waitForTimeout(400)

    // A Resource Timing API do próprio browser: transferSize conta o que veio
    // mesmo pela rede (já comprimido), que é o que o content-length esconde.
    const m = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0]
      const rs = performance.getEntriesByType('resource')
      const sb = rs
        .filter(r => /supabase\.co\/(rest|auth|realtime)/.test(r.name))
        .map(r => ({ u: r.name.replace(/^.*supabase\.co/, '').slice(0, 70), inicio: r.startTime, fim: r.responseEnd }))
        .sort((a, b) => a.inicio - b.inicio)
      // Profundidade da cadeia: quantas chamadas ao Supabase só arrancaram
      // DEPOIS de outra ter acabado. 1 = tudo em paralelo. 4 = quatro esperas.
      let cadeia = 0, fim = -1
      for (const c of sb) { if (c.inicio >= fim - 5) { cadeia++; fim = c.fim } else if (c.fim > fim) fim = c.fim }
      const soma = f => rs.filter(f).reduce((s, r) => s + (r.transferSize || 0), 0)
      const ehJs = r => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name)
      return {
        nJs: rs.filter(ehJs).length,
        nCss: rs.filter(r => /\.css(\?|$)/.test(r.name)).length,
        nFonte: rs.filter(r => /\.(woff2?|ttf|otf)(\?|$)/.test(r.name)).length,
        nImg: rs.filter(r => /\.(png|jpe?g|svg|webp|gif)(\?|$)/.test(r.name)).length,
        nApi: rs.filter(r => /\/api\//.test(r.name)).length,
        maiores: rs.filter(ehJs).sort((a, b) => (b.transferSize||0)-(a.transferSize||0)).slice(0,40)
          .map(r => `${Math.round((r.transferSize||0)/1024)}K ${r.name.split('/').pop()}`),
        nav: n ? Math.round(n.responseStart - n.requestStart) : 0,
        bytes: soma(() => true) + (n?.transferSize || 0),
        js: soma(r => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name)),
        req: rs.length,
        sbN: sb.length, cadeia, sb,
        ultimaSb: sb.length ? Math.round(Math.max(...sb.map(c => c.fim))) : 0,
      }
    })
    const { nav, bytes, js, req, sbN, cadeia, sb, ultimaSb } = m

    console.log(
      rota.padEnd(14) +
      `${(bytes / 1024).toFixed(0).padStart(6)}K` +
      `${(js / 1024).toFixed(0).padStart(6)}K` +
      `${String(req).padStart(6)}` +
      `${String(sbN).padStart(4)}` +
      `${String(nav).padStart(6)}` +
      `${String(dcl).padStart(6)}` +
      `${String(quieto).padStart(8)}` +
      `${String(cadeia).padStart(6)}` +
      `${String(ultimaSb).padStart(8)}`
    )
    console.log(`               ${m.nJs} js · ${m.nCss} css · ${m.nFonte} fontes · ${m.nImg} img · ${m.nApi} api · ${sbN} supabase`)
    if (process.env.DETALHE) {
      if (process.env.SOJS) { m.maiores.forEach(x => console.log('   js  ' + x)); continue }
      console.log('               maiores js: ' + m.maiores.slice(0,5).join(' | '))
      sb.forEach(c => console.log(`      ${String(Math.round(c.inicio)).padStart(6)}→${String(Math.round(c.fim)).padStart(6)}ms  ${c.u}`))
    }
  }

  console.log('\nbytes/js = transferido · req = pedidos · sb = chamadas ao Supabase')
  console.log('ttfb = servidor a responder · dcl = HTML pronto · quieto = rede parada (ms)')
  console.log('cadeia = esperas em fila nas chamadas ao Supabase (1 = paralelo) · ult-sb = quando')
  console.log('a última chamada de dados acabou — é aí que a página fica mesmo pronta')
} finally {
  await navegador.close()
}
