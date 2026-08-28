import type { Page } from '@playwright/test'

/**
 * Navegar para uma rota da app.
 *
 * ── PORQUE É QUE ISTO NÃO USA `networkidle` ───────────────────────────────
 * Usava, e partia o CI todos os dias.
 *
 * O `networkidle` do Playwright só dá a navegação por terminada quando passam
 * 500ms sem um único pedido de rede. Páginas como o /inicio nunca chegam lá:
 * têm subscrições em tempo real do Supabase e sondagens que mantêm a rede a
 * mexer para sempre. O `goto` esperava os 30 segundos todos e o teste morria
 * por tempo esgotado — sem que a página tivesse problema nenhum.
 *
 * Era enganador de uma forma particularmente má: o /painel em modo clínico
 * passava em 5 segundos, e o /painel em modo pessoal esgotava o tempo. Parecia
 * um problema de permissões entre modos. Não era — o modo pessoal redireciona
 * para /inicio, e era o /inicio que nunca assentava.
 *
 * `domcontentloaded` mais uma pausa curta dá o mesmo que se queria (a página
 * montada e estável) sem depender de a rede alguma vez parar. É a mesma
 * correção que os agentes de QA levaram em scripts/qa-agents/run.mjs.
 *
 * Para o que vier a seguir, o `expect` do Playwright já espera sozinho pelos
 * elementos — não é preciso garantir aqui que os dados chegaram.
 */
export async function irPara(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // 'load' inclui imagens e folhas de estilo. Se falhar, seguimos na mesma:
  // o que interessa é o React estar montado, e isso já aconteceu.
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForTimeout(1200)
}
