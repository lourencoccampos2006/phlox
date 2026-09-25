// scripts/qa-rls-listas.mjs — depois do sprint153, confirma que as listas TÊM
// dados.
//
// A RLS por area falha FECHADO de proposito: uma tabela mapeada para a area
// errada nao abre dados a ninguem — cala a ferramenta. Isso e o lado certo do
// erro, mas so se alguem der por ele. Este guiao da por ele.
//
//   node scripts/qa-rls-listas.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3311'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'

// Rota → uma frase que SO aparece quando a lista esta vazia.
const PAGINAS = [
  ['/patients', /Sem utentes|Sem residentes|ainda não há/i],
  ['/mar', /Sem medicação|sem medicamentos/i],
  ['/o-dia', /Nada marcado para/i],
  ['/incidents', /Sem ocorrências/i],
  ['/equipa?tab=mural', null],
  ['/stock', /Sem artigos|sem existências/i],
  ['/documentos', null],
  ['/painel', null],
  ['/care-log', null],
  ['/activities', null],
]

const b = await chromium.launch()
let mau = 0
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  const erros = []
  p.on('console', m => { if (m.type() === 'error') erros.push([p.url(), m.text().slice(0, 140)]) })

  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type="email"]', EMAIL)
  await p.fill('input[type="password"]', PASS)
  await p.click('button[type="submit"]')
  await p.waitForURL(/inicio|painel/, { timeout: 30_000 }).catch(() => {})

  for (const [rota, vazio] of PAGINAS) {
    erros.length = 0
    await p.goto(BASE + rota, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(3500)

    const texto = await p.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)
    const pareceVazia = vazio ? vazio.test(texto) : false
    // Erros de permissao que a RLS devolve: 401/403, ou o PostgREST a recusar.
    const negados = erros.filter(([, t]) => /40[13]|permission denied|violates row-level/i.test(t))

    const estado = negados.length ? '✗ ACESSO NEGADO' : pareceVazia ? '! lista vazia' : '✓'
    console.log(`${estado}  ${rota.padEnd(22)} ${texto.trim().split('\n')[0].slice(0, 46)}`)
    if (negados.length) { mau++; for (const [, t] of negados.slice(0, 2)) console.log(`        ${t}`) }
  }
  await ctx.close()
} finally { await b.close() }

console.log(mau ? `\n✗ ${mau} pagina(s) com acesso negado pela RLS.` : '\n✓ Nenhuma pagina foi fechada pela RLS.')
process.exit(mau ? 1 : 0)
