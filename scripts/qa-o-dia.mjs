// scripts/qa-o-dia.mjs — mede os tres sintomas que o Fernando descreveu, num
// browser a serio, em vez de eu ficar a adivinhar qual deles ja esta curado.
//
//   1. «esta sempre a carregar, parece glitchada»
//      → conta PEDIDOS AO SUPABASE em 6 segundos com a pagina parada. Uma
//        pagina saudavel faz meia duzia e pára. Um ciclo de render faz centenas.
//
//   2. «as ferramentas do menu lateral nao abrem»
//      → clica mesmo num item do menu e confirma que o endereco muda.
//
//   3. «ao dar scroll para baixo aparece imenso espaco branco»
//      → compara a altura do documento com a altura do conteudo que la esta
//        dentro. A diferenca E o espaco vazio, em pixeis.
//
// Nao usa fullPage: um screenshot de pagina inteira estica o viewport e esconde
// exatamente os defeitos que interessam. Tira a altura real do ecra.
//
//   node scripts/qa-o-dia.mjs
//   ROTA=/patients node scripts/qa-o-dia.mjs

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const ROTA = process.env.ROTA || '/o-dia'
const OUT = 'tmp-qa-o-dia'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]

/**
 * O espaco vazio no fim da pagina, em pixeis.
 *
 * ── PORQUE E QUE A PRIMEIRA VERSAO DISTO NAO SERVIA ────────────────────────
 * Media o ponto mais baixo de QUALQUER elemento com area. Sendo que o
 * involucro da aplicacao tem `minHeight: 100vh` e a barra lateral tem
 * `height: calc(100vh - 58px)`, havia sempre uma caixa a chegar ao fundo — e a
 * conta dava zero em todas as paginas, incluindo nas que tem mesmo um buraco.
 * Um teste que nunca falha nao e um teste.
 *
 * Agora mede o que se VE: o ponto mais baixo de um elemento com texto proprio,
 * ou de uma imagem, botao ou campo. E compara-o com o fundo do documento.
 */
const medirVazio = () => {
  const doc = document.documentElement
  let fundo = 0
  const contaComoConteudo = (el) => {
    const t = el.tagName
    if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'HR'].includes(t)) return true
    // Texto proprio: um no de texto direto e nao herdado dos filhos.
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length) return true
    }
    return false
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!contaComoConteudo(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const abs = r.bottom + window.scrollY
    if (abs > fundo) fundo = abs
  }
  // A coluna onde o conteudo da pagina vive. Numa pagina institucional e o
  // <main>; fora dela e o proprio body.
  const main = document.querySelector('main')
  let fundoMain = 0
  if (main) {
    for (const el of main.querySelectorAll('*')) {
      if (!contaComoConteudo(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const abs = r.bottom + window.scrollY
      if (abs > fundoMain) fundoMain = abs
    }
  }
  return {
    alturaDoc: doc.scrollHeight,
    fundoDoConteudo: Math.round(fundo),
    vazio: Math.round(doc.scrollHeight - fundo),
    fundoDaColuna: Math.round(fundoMain),
    vazioNaColuna: main ? Math.round(doc.scrollHeight - fundoMain) : 0,
    alturaEcra: window.innerHeight,
  }
}

const navegador = await chromium.launch()
let falhou = false
try {
  for (const [nome, viewport] of VIEWPORTS) {
    const ctx = await navegador.newContext({ viewport })
    const page = await ctx.newPage()

    const errosConsola = []
    page.on('console', m => { if (m.type() === 'error') errosConsola.push(m.text().slice(0, 160)) })
    page.on('pageerror', e => errosConsola.push('pageerror: ' + String(e.message).slice(0, 160)))

    let pedidos = 0
    const porRota = new Map()
    page.on('request', r => {
      const u = r.url()
      if (!/supabase\.co\/rest|\/api\//.test(u)) return
      pedidos++
      const chave = u.replace(/\?.*/, '').split('/').slice(-1)[0]
      porRota.set(chave, (porRota.get(chave) || 0) + 1)
    })

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/inicio|\/painel/, { timeout: 30_000 }).catch(() => {})

    await page.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(4000)

    // ── 1. A pagina assenta? ──────────────────────────────────────────────
    pedidos = 0; porRota.clear()
    await page.waitForTimeout(6000)
    const top3 = [...porRota.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, n]) => `${k} x${n}`).join(', ')

    const emCiclo = pedidos > 30
    console.log(`\n[${nome}] ${ROTA}`)
    console.log(`  pedidos em 6s com a pagina parada: ${pedidos}${top3 ? `   (${top3})` : ''}`)
    console.log(`  ${emCiclo ? '✗ CICLO DE RENDER — a pagina nunca assenta' : '✓ a pagina assenta'}`)
    if (emCiclo) falhou = true

    // Continua «a carregar»?
    const aindaACarregar = await page.evaluate(() =>
      /A carregar|A juntar o que/i.test(document.body.innerText))
    console.log(`  ${aindaACarregar ? '✗ ainda diz "a carregar" ao fim de 10s' : '✓ ja mostra conteudo'}`)
    if (aindaACarregar) falhou = true

    // ── 2. O menu lateral abre as ferramentas? ────────────────────────────
    if (nome === 'desktop') {
      const antes = page.url()
      const link = page.locator('aside a[href="/patients"]').first()
      if (await link.count()) {
        await link.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
        const mudou = page.url() !== antes
        console.log(`  ${mudou ? '✓ o menu lateral abre' : '✗ MENU LATERAL NAO ABRE (cliquei e o endereco nao mudou)'}`)
        if (!mudou) falhou = true
        await page.goto(BASE + ROTA, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(3000)
      } else {
        console.log('  ! nao encontrei o menu lateral para testar')
      }
    }

    // ── 3. Espaco branco no fim ───────────────────────────────────────────
    await page.mouse.wheel(0, 4000)   // mouse.wheel, nunca scrollTo — ver memoria
    await page.waitForTimeout(800)
    const m = await page.evaluate(medirVazio)
    const demais = m.vazio > m.alturaEcra * 0.4 || m.vazioNaColuna > m.alturaEcra * 0.6
    console.log(`  documento ${m.alturaDoc}px · conteudo acaba aos ${m.fundoDoConteudo}px (${m.vazio}px vazios)` +
      (m.fundoDaColuna ? ` · coluna acaba aos ${m.fundoDaColuna}px (${m.vazioNaColuna}px vazios)` : ''))
    console.log(`  ${demais ? '✗ ESPACO BRANCO A MAIS' : '✓ sem espaco branco de mais'}`)
    if (demais) falhou = true

    if (errosConsola.length) {
      console.log(`  ! ${errosConsola.length} erro(s) na consola:`)
      for (const e of [...new Set(errosConsola)].slice(0, 4)) console.log(`      ${e}`)
    }

    await page.screenshot({ path: `${OUT}/${nome}-topo.png` })
    await page.mouse.wheel(0, 2000)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${nome}-fundo.png` })
    await ctx.close()
  }
} finally {
  await navegador.close()
}

console.log(falhou ? '\n✗ ha problemas por resolver.' : '\n✓ os tres sintomas estao curados.')
process.exit(falhou ? 1 : 0)
