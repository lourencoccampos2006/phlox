import { request } from '@playwright/test'

/**
 * Aquecer o servidor antes do primeiro teste.
 *
 * ── PORQUÊ ────────────────────────────────────────────────────────────────
 * No CI a sequência é: `npm start`, esperar que a porta responda, correr os
 * testes. A porta responde muito antes de o servidor estar realmente pronto —
 * o primeiro pedido a cada rota ainda carrega módulos, abre a ligação ao
 * Supabase e monta a árvore de componentes pela primeira vez.
 *
 * O resultado era uma falha só no PRIMEIRO teste da corrida, sem nada de errado
 * com a aplicação. À segunda vez passava. Um CI que falha de vez em quando sem
 * razão é pior do que um CI que não existe: deixa-se de olhar para ele, e
 * quando falhar a sério ninguém repara.
 *
 * Este ficheiro paga esse primeiro pedido uma vez, fora dos testes, e falha em
 * silêncio se alguma rota não responder — o que interessa aqui é aquecer, não
 * verificar. Quem verifica são os testes.
 */
const ROTAS = ['/', '/login', '/painel', '/inicio', '/care-log', '/mar', '/family']

export default async function aquecer() {
  const base = process.env.PHLOX_BASE_URL || 'http://localhost:3000'
  const ctx = await request.newContext({ baseURL: base })
  const inicio = Date.now()

  await Promise.all(
    ROTAS.map((r) => ctx.get(r, { timeout: 45_000 }).catch(() => null))
  )

  await ctx.dispose()
  console.log(`  servidor aquecido em ${((Date.now() - inicio) / 1000).toFixed(1)}s (${ROTAS.length} rotas)`)
}
