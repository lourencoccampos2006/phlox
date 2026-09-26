// scripts/qa-volume-supabase.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Quantos pedidos e que a aplicacao faz ao Supabase, e a quem.
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// No plano gratuito do Supabase ha um tecto de ingestao de registos (logs), e
// CADA pedido a API escreve uma linha. Nao e o tamanho dos dados que conta — e
// o NUMERO de chamadas. Uma pagina que faz 40 consultas por abertura gasta
// vinte vezes mais registo do que uma que faz duas, mesmo que traga menos
// dados.
//
// Por isso esta guarda nao mede segundos nem kilobytes: conta chamadas. E
// separa-as em tres perguntas diferentes:
//
//   • quantas para ABRIR cada pagina (custo por navegacao)
//   • quantas com a pagina PARADA (custo por minuto de alguem a trabalhar)
//   • quais as tabelas mais chamadas (onde vale a pena mexer)
//
// O terceiro numero e o que interessa: uma reducao de 16 chamadas para 1 numa
// rota chamada a cada dois minutos poupa mais do que optimizar dez paginas.
//
//   node scripts/qa-volume-supabase.mjs
//   PARADO=120 node scripts/qa-volume-supabase.mjs    (dois minutos parado)
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3311'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const PARADO = Number(process.env.PARADO || 60)

const ROTAS = ['/painel', '/o-dia', '/patients', '/mar', '/care-log', '/equipa?tab=mural']

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()

  let ligado = false
  const porTabela = new Map()
  const porTipo = new Map()
  let total = 0

  p.on('request', r => {
    if (!ligado) return
    const u = r.url()
    if (!/supabase\.co/.test(u)) return
    total++
    const tipo = /\/rest\/v1\//.test(u) ? 'rest'
      : /\/auth\/v1\//.test(u) ? 'auth'
      : /\/realtime\/v1\//.test(u) ? 'realtime'
      : /\/storage\/v1\//.test(u) ? 'storage' : 'outro'
    porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1)
    if (tipo === 'rest') {
      const t = u.split('/rest/v1/')[1]?.split('?')[0] || '?'
      porTabela.set(t, (porTabela.get(t) || 0) + 1)
    }
  })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', EMAIL)
  await p.fill('input[type="password"]', PASS)
  await p.click('button[type="submit"]')
  await p.waitForURL(/inicio|painel/, { timeout: 30_000 }).catch(() => {})
  await p.waitForTimeout(4000)

  // ── 1. Custo de abrir cada pagina ───────────────────────────────────────
  console.log('AO ABRIR CADA PAGINA')
  ligado = true
  for (const rota of ROTAS) {
    const antes = total
    await p.goto(BASE + rota, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(5000)
    console.log(`  ${String(total - antes).padStart(4)}  ${rota}`)
  }

  // ── 2. Custo de estar la parado ─────────────────────────────────────────
  const antesParado = total
  const snapshotTabela = new Map(porTabela)
  await p.waitForTimeout(PARADO * 1000)
  const emRepouso = total - antesParado
  console.log(`\nCOM A PAGINA PARADA (${PARADO}s): ${emRepouso} pedidos` +
    `  →  ${Math.round(emRepouso / PARADO * 3600)} por hora, por separador aberto`)
  if (emRepouso) {
    const delta = [...porTabela.entries()]
      .map(([t, n]) => [t, n - (snapshotTabela.get(t) || 0)])
      .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6)
    for (const [t, n] of delta) console.log(`     ${String(n).padStart(3)} ${t}`)
  }

  // ── 3. Onde vale a pena mexer ───────────────────────────────────────────
  console.log('\nTOTAL POR TIPO')
  for (const [t, n] of [...porTipo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t}`)
  }
  console.log('\nTABELAS MAIS CHAMADAS')
  for (const [t, n] of [...porTabela.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`  ${String(n).padStart(4)}  ${t}`)
  }
  console.log(`\n${total} pedidos ao Supabase no total desta sessao.`)
  await ctx.close()
} finally { await b.close() }
