import { test, expect } from '@playwright/test'
import { loginAs, setMode } from './helpers/auth'
import { irPara } from './helpers/nav'

// Guião do dia do centro de dia, ponta-a-ponta — é literalmente o que a
// equipa faz ao vivo num demo. Se isto passar, o caminho de ouro funciona.
const TECH_LEAK = /supabase|PGRST|relation .*does not|column .*does not|42P01|42703|sprint\d|\.sql\b|service.?role|SUPABASE_/i

test.describe('fluxo clínico — centro de dia', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'clinical', 'day_care')
  })

  test('cockpit mostra a barra "O dia de hoje" sem erros', async ({ page }) => {
    const errs: string[] = []
    page.on('pageerror', (e) => errs.push(e.message))
    await irPara(page, '/painel')
    await expect(page.getByText('O DIA DE HOJE')).toBeVisible()
    expect(errs).toHaveLength(0)
  })

  test('registar um sinal vital grava e PERSISTE após reload', async ({ page }) => {
    const marker = String(100 + Math.floor(Math.random() * 20)) // valor distintivo por corrida
    await irPara(page, '/care-log')
    await page.locator('select').first().selectOption({ index: 1 })
    await page.waitForTimeout(500)
    // Fixa o turno explicitamente (Manhã) em vez de confiar no turno
    // auto-detetado pela hora real — evita que o teste mude de turno a meio
    // se correr perto de uma fronteira de turno, o que faria o registo
    // gravado (turno A) não bater certo com o registo relido (turno B).
    await page.locator('button', { hasText: /^Manhã$/ }).first().click()
    const sysField = page.locator('input[placeholder="120"]').first()
    await sysField.fill(marker)
    await page.locator('input[placeholder="80"]').first().fill('79') // diastólica — entrada clínica real tem sempre as duas
    await expect(sysField).toHaveValue(marker) // confirma que o preenchimento pegou antes de gravar
    await page.locator('button', { hasText: /Guardar registo/i }).first().click()
    await expect(page.getByText(/Registo guardado/i)).toBeVisible({ timeout: 5000 })

    // reload completo — prova que gravou na base de dados, não só em memória.
    // innerText (não textContent!) — textContent inclui o texto bruto de
    // <script> (payload de hidratação do Next.js), dando falsos negativos.
    // innerText reflete só o que fica visível/renderizado, como um utilizador vê.
    await irPara(page, '/care-log')
    await page.locator('select').first().selectOption({ index: 1 })
    await page.waitForTimeout(1500)
    const rendered = await page.locator('body').innerText()
    expect(rendered).toContain(`TA ${marker}/`)
  })

  test('medicação a dar mostra ação de administração', async ({ page }) => {
    await irPara(page, '/mar')
    await page.locator('select').first().selectOption({ index: 1 })
    await page.waitForTimeout(800)
    const body = await page.textContent('body')
    expect(/Administrado|Administrar|Todos em falta/i.test(body || '')).toBe(true)
  })

  test('famílias está operável e sem fuga técnica', async ({ page }) => {
    await irPara(page, '/family')
    const body = (await page.textContent('body')) || ''
    expect(/Nova Mensagem|Foto do dia|Conversa/i.test(body)).toBe(true)
    expect(TECH_LEAK.test(body)).toBe(false)
  })

  test('/painel é inacessível em modo pessoal (não vaza entre modos)', async ({ page }) => {
    // beforeEach já iniciou sessão — só mudamos o modo, sem voltar a /login
    // (a app redireciona quem já tem sessão para fora do formulário de login).
    await setMode(page, 'personal')
    await irPara(page, '/painel')
    await expect(page).toHaveURL(/\/inicio/)
  })
})
