// scripts/qa-processo-individual.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O processo individual aparece, e diz a verdade?
//
// ── PORQUE É QUE ISTO NÃO SE VERIFICA A OLHO ───────────────────────────────
// Um balanço de conformidade errado é pior do que não existir: uma casa que
// confie nele e chegue à inspeção com um processo incompleto foi enganada
// por nós. E ele falha silenciosamente das duas maneiras — a dizer que está
// tudo bem quando falta, e a dizer que falta quando já lá está.
//
// Por isso o que se mede aqui não é «apareceu alguma coisa no ecrã»: é se a
// CONTA bate certo com a própria lista. Se o cabeçalho diz «4 de 12», então
// tem de haver 4 vistos na lista aberta — e nem um a mais.
//
//   node scripts/qa-processo-individual.mjs
//   BASE=http://localhost:3311 node scripts/qa-processo-individual.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const OUT = 'tmp-qa-processo'
mkdirSync(OUT, { recursive: true })

const falhas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', e => erros.push(String(e.message || e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 })

  // ── Encontrar alguém ──────────────────────────────────────────────────────
  // `PID=<uuid>` aponta a um utente concreto. Serve para o caso POSITIVO: a
  // ficha que a lista apanha primeiro pode estar completamente vazia, e um
  // balanço de «0 de 10» não distingue uma verificação certa de uma que
  // responde sempre que não. Com um utente que TEM coisas, distingue.
  let href = process.env.PID ? `/patients/${process.env.PID}` : null
  if (!href) {
    await page.goto(`${BASE}/patients`, { waitUntil: 'domcontentloaded' })
    const link = page.locator('a[href^="/patients/"]').first()
    await link.waitFor({ timeout: 30000 })
    href = await link.getAttribute('href')
  }
  diz(!!href, `abri a ficha de alguém: ${href}`)

  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })

  // ── O separador dos documentos ───────────────────────────────────────────
  const aba = page.getByRole('button', { name: /Documentos/i }).first()
  await aba.waitFor({ timeout: 30000 })
  await aba.click()

  // Espera pelo CONTEÚDO — e por `waitForSelector`, que sobrevive a uma
  // navegação a meio. O `waitForFunction` rebenta com «Execution context was
  // destroyed» e o `.catch()` fazia o teste medir uma página em branco.
  await page.waitForSelector('text=Processo individual', { timeout: 20000 })
    .catch(() => {})

  const existe = await page.locator('text=Processo individual').count()
  diz(existe > 0, `secção «Processo individual» no ecrã: ${existe}`)

  if (existe) {
    // ── A conta bate certo? ────────────────────────────────────────────────
    const cabecalho = await page.locator('text=/^\\d+ de \\d+$/').first().textContent()
    const [, feitos, total] = /(\d+) de (\d+)/.exec(cabecalho) || []
    diz(!!feitos, `cabeçalho: «${cabecalho}»`)

    await page.getByRole('button', { name: 'Ver o processo todo' }).click()
    await page.waitForTimeout(500)

    // Conta os vistos EXIGIDOS: a percentagem é só sobre esses, por isso é com
    // esses que a conta tem de bater. Um elemento opcional cumprido não entra
    // no numerador — e se entrasse, o número passava dos 100%.
    const linhas = await page.$$eval('section div[style*="border-top"], section div', () => [])
    const vistos = await page.evaluate(() => {
      // Cada elemento é uma linha com um círculo à esquerda. O círculo cheio
      // tem o visto lá dentro; o vazio não tem texto nenhum.
      const secoes = [...document.querySelectorAll('section')]
      const alvo = secoes.find(s => s.textContent.includes('Processo individual'))
      if (!alvo) return null
      const linhas = [...alvo.querySelectorAll('div')].filter(d => {
        const c = d.firstElementChild
        return c && c.tagName === 'SPAN' && c.getAttribute('aria-hidden') === 'true'
          && d.querySelectorAll('div').length >= 2
      })
      let cumpridos = 0, opcionaisCumpridos = 0, n = 0
      for (const l of linhas) {
        const opcional = l.textContent.includes('opcional')
        const ok = l.firstElementChild.textContent.trim() === '✓'
        n++
        if (ok && opcional) opcionaisCumpridos++
        else if (ok) cumpridos++
      }
      return { n, cumpridos, opcionaisCumpridos }
    })

    if (!vistos) {
      diz(false, 'não consegui ler as linhas da lista')
    } else {
      console.log(`  linhas lidas: ${vistos.n} · exigidos cumpridos: ${vistos.cumpridos} · opcionais cumpridos: ${vistos.opcionaisCumpridos}`)
      diz(vistos.n > 0, `a lista tem ${vistos.n} elemento(s)`)
      diz(vistos.cumpridos === Number(feitos),
        vistos.cumpridos === Number(feitos)
          ? `a conta bate: ${feitos} vistos em elementos exigidos`
          : `A CONTA NÃO BATE: o cabeçalho diz ${feitos}, a lista tem ${vistos.cumpridos} vistos exigidos`)
      diz(vistos.n >= Number(total),
        `${vistos.n} linhas para ${total} exigidos (os opcionais são a diferença)`)
    }

    await page.screenshot({ path: `${OUT}/processo.png` })
  }

  // ── Telemóvel ────────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
  await page.screenshot({ path: `${OUT}/telemovel.png` })

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally {
  await browser.close()
}

console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ O processo individual conta o que diz que conta.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
