import { test, expect } from '@playwright/test'
import { loginAs, dismissCookieBanner } from './helpers/auth'

// ── Guarda de regressão para o bug de 2026-07-27 ────────────────────────────
// `html { overflow-x: clip }` desligou o scroll REAL (roda do rato) em TODO o
// site durante meses, sem que nenhum teste apanhasse — porque toda a QA
// anterior usava `window.scrollTo()` programático, que contorna o bug (atua
// direto no scrollingElement, ignorando a propagação natural que estava
// partida). Por isso este teste usa `page.mouse.wheel()`, NUNCA scrollTo(),
// em cada página. Se algum dia voltar a aparecer `overflow-x` (ou qualquer
// outra propriedade que desligue a propagação) no <html>, isto falha.

async function realWheelScrolls(page: import('@playwright/test').Page): Promise<{ needed: boolean; moved: boolean }> {
  const dims = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, clientH: window.innerHeight }))
  if (dims.scrollH <= dims.clientH + 10) return { needed: false, moved: true } // página curta, nada a scrollar
  const before = await page.evaluate(() => window.scrollY)
  await page.mouse.move(640, 450)
  // Várias "ticks" de roda (não uma só) — `scroll-behavior: smooth` faz o
  // scroll animar, uma única tick pequena pode não ter assentado a tempo.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(120)
  }
  const after = await page.evaluate(() => window.scrollY)
  return { needed: true, moved: after > before }
}

test.describe('scroll real (roda do rato) — nunca scrollTo()', () => {
  test('homepage pública dá scroll', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await dismissCookieBanner(page)
    const r = await realWheelScrolls(page)
    expect(r.moved).toBe(true)
  })

  test('/login dá scroll', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    const r = await realWheelScrolls(page)
    expect(r.moved).toBe(true)
  })

  test('/inicio (modo pessoal) dá scroll', async ({ page }) => {
    await loginAs(page, 'personal')
    await page.goto('/inicio', { waitUntil: 'networkidle' })
    await dismissCookieBanner(page)
    const r = await realWheelScrolls(page)
    expect(r.moved).toBe(true)
  })

  test('/painel (modo clínico, centro de dia) dá scroll', async ({ page }) => {
    await loginAs(page, 'clinical', 'day_care')
    await page.goto('/painel', { waitUntil: 'networkidle' })
    await dismissCookieBanner(page)
    const r = await realWheelScrolls(page)
    expect(r.moved).toBe(true)
  })

  test('/care-log (formulário longo) dá scroll', async ({ page }) => {
    await loginAs(page, 'clinical', 'day_care')
    await page.goto('/care-log', { waitUntil: 'networkidle' })
    await dismissCookieBanner(page)
    const r = await realWheelScrolls(page)
    expect(r.moved).toBe(true)
  })
})
