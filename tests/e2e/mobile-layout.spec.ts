import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { irPara } from './helpers/nav'

// Guarda de regressão para o bug de layout mobile de 2026-07-27: ferramentas
// construídas desktop-first renderizavam SEM padding lateral (coladas às
// margens) no telemóvel. Este teste corre só no projeto "mobile"
// (playwright.config.ts) e falha se alguma página tiver overflow horizontal
// OU conteúdo colado à margem esquerda do ecrã.
test.describe('layout mobile — sem overflow horizontal, sem conteúdo colado à margem', () => {
  test.skip(({ isMobile }) => !isMobile, 'só corre no projeto mobile')

  const ROUTES = ['/painel', '/care-log', '/mar', '/family', '/patients', '/activities', '/incidents']

  for (const route of ROUTES) {
    test(`${route} sem overflow horizontal`, async ({ page }) => {
      await loginAs(page, 'clinical', 'day_care')
      await irPara(page, route)
      await page.waitForTimeout(600)
      const overflow = await page.evaluate(() => {
        const de = document.documentElement
        return de.scrollWidth - de.clientWidth
      })
      expect(overflow).toBeLessThanOrEqual(2)
    })
  }

  test('/care-log: conteúdo principal tem padding lateral (não está colado à margem)', async ({ page }) => {
    await loginAs(page, 'clinical', 'day_care')
    await irPara(page, '/care-log')
    // O container é full-width por desenho (boundingClientRect.left = 0 é
    // normal) — o que importa é o padding-left COMPUTADO, que dá o respiro
    // real ao conteúdo lá dentro.
    const paddingLeft = await page.evaluate(() => {
      const el = document.querySelector('.carelog-tool')
      if (!el) return null
      return parseFloat(getComputedStyle(el).paddingLeft)
    })
    expect(paddingLeft).not.toBeNull()
    expect(paddingLeft as number).toBeGreaterThan(6) // algum respiro, não 0px
  })
})
