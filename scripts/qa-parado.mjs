// scripts/qa-parado.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Uma página PARADA pede alguma coisa ao Supabase?
//
// ── PORQUE E QUE ISTO E MEDIDO A PARTE ──────────────────────────────────────
// O `qa-volume-supabase.mjs` mede o custo de ABRIR. Isto mede o custo de
// DEIXAR ABERTO, que é diferente e pior: um separador esquecido numa sala de
// equipa fica aberto oito horas, e um pedido a cada dois minutos são 240
// chamadas de uma página que ninguém está a olhar.
//
// ── PORQUE E QUE PRECISA DE ASSENTAR PRIMEIRO ───────────────────────────────
// A primeira vez que medi isto dei-lhe cinco segundos de espera e contei dois
// pedidos — o que extrapolado dava 1440 por hora e parecia uma fuga grave.
// Não era: eram os dois últimos pedidos do carregamento da própria página, que
// ainda não tinha acabado de abrir.
//
// Por isso agora espera-se que a página ASSENTE (dez segundos sem nada), e só
// depois se começa a contar. Uma medição que não distingue o arranque do
// repouso não mede nada.
//
//   node scripts/qa-parado.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const PARADO = Number(process.env.PARADO || 90)

const ROTAS = ['/painel', '/o-dia', '/estatisticas', '/calendario-do-ano',
  '/painel-dono', '/inscricoes', '/ronda-guiada', '/mar', '/patients']

// Um separador ESCONDIDO — o caso que mais interessa, porque é o que fica
// aberto oito horas num posto de equipa sem ninguém a olhar. O Playwright dá
// sempre páginas visíveis, por isso mente-se ao `document.hidden`, que é
// exatamente o que o código lê.
const ESCONDIDO = process.argv.includes('--escondido')

const b = await chromium.launch()
const maus = []
try {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } })
  const p = await ctx.newPage()
  if (ESCONDIDO) {
    await p.addInitScript(() => {
      Object.defineProperty(document, 'hidden', { get: () => true })
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' })
    })
  }
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
  await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
  await p.click('button[type="submit"]')
  await p.waitForTimeout(6000)

  let contar = false
  const porTabela = new Map()
  p.on('request', r => {
    if (!contar || !/\/rest\/v1\/|\/api\//.test(r.url())) return
    const k = r.url().replace(/\?.*/, '').split('/').slice(-1)[0]
    porTabela.set(k, (porTabela.get(k) || 0) + 1)
  })

  console.log(`Cada página: abrir, esperar que assente, e depois contar ${PARADO}s parada.\n`)
  for (const rota of ROTAS) {
    await p.goto(BASE + rota, { waitUntil: 'domcontentloaded' })

    // Assentar: espera até dez segundos SEM nenhum pedido novo.
    let ultimo = Date.now()
    const marcar = () => { ultimo = Date.now() }
    p.on('request', marcar)
    const limite = Date.now() + 40000
    while (Date.now() - ultimo < 10000 && Date.now() < limite) {
      await p.waitForTimeout(500)
    }
    p.off('request', marcar)

    porTabela.clear()
    contar = true
    await p.waitForTimeout(PARADO * 1000)
    contar = false

    const total = [...porTabela.values()].reduce((s, x) => s + x, 0)
    const porHora = Math.round((total / PARADO) * 3600)
    const detalhe = [...porTabela.entries()].sort((a, z) => z[1] - a[1])
      .map(([k, n]) => `${k}×${n}`).join(' ')
    console.log(`${total === 0 ? '  ' : '✗ '}${rota.padEnd(22)} ${total} em ${PARADO}s`
      + (total ? `  →  ${porHora}/hora  ${detalhe}` : ''))
    if (total > 0) maus.push({ rota, total, porHora, detalhe })
  }
  await ctx.close()
} finally {
  await b.close()
}

if (!maus.length) {
  console.log('\n✓ Nenhuma página pede nada ao Supabase quando está parada.')
  process.exit(0)
}
console.log(`\n✗ ${maus.length} página(s) continuam a pedir com ninguém a olhar:`)
for (const m of maus) console.log(`  ${m.rota} — ${m.porHora} por hora (${m.detalhe})`)
console.log('\nUm separador esquecido numa sala de equipa fica aberto oito horas.')
process.exit(1)
