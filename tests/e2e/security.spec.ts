import { test, expect } from '@playwright/test'

// Testes leves de fumo para os padrões de segurança auditados em 2026-07-27.
// Não substituem uma auditoria de código — são um sinal rápido de que as
// proteções continuam de pé (não foram removidas sem querer num refactor).
test.describe('segurança — smoke tests', () => {
  test('rota de cron rejeita pedido sem segredo', async ({ request }) => {
    const res = await request.get('/api/health-check')
    expect(res.status()).toBe(401)
  })

  test('rota de cron rejeita segredo errado', async ({ request }) => {
    const res = await request.get('/api/health-check', { headers: { 'x-cron-secret': 'segredo-errado-de-propósito' } })
    expect(res.status()).toBe(401)
  })

  test('rota institucional exige autenticação', async ({ request }) => {
    const res = await request.get('/api/org/dashboard')
    // 401 em produção (sem token). Em dev local, se SUPABASE_SERVICE_ROLE_KEY
    // não estiver definida, a rota responde 503 antes mesmo de chegar ao
    // check de auth — é o comportamento local esperado, não uma fuga (nenhum
    // dado é devolvido em nenhum dos dois casos).
    expect([401, 503]).toContain(res.status())
  })

  test('portal família rejeita código curto/inválido', async ({ request }) => {
    const res = await request.get('/api/family-portal?code=AB')
    expect([400, 404]).toContain(res.status())
    const body = await res.json().catch(() => ({}))
    // nunca deve conter detalhe técnico (regra durável — ver lib/clientError.ts)
    const text = JSON.stringify(body)
    expect(/supabase|PGRST|42P01|42703|column .*does not|relation .*does not/i.test(text)).toBe(false)
  })
})
