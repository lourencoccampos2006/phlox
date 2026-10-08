// Fotos do lado estudante/pessoal — as paginas que a varredura de cor mais
// tocou e que o fotos-mesa.mjs nao cobre (so cobre as institucionais).
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
const BASE = 'http://localhost:3311'
const ONDE = path.join(process.cwd(), '.fotos-estudante')
const PAGINAS = ['/scan','/grand-round','/integracoes','/timeline','/relatorio',
  '/med-review','/vault','/passport','/connect','/tpn','/modo-exame','/registo',
  '/antibiotics','/admin','/residentes','/reconciliacao','/estagio','/emergency-doses',
  '/decisao','/mymeds','/study','/osce','/arena','/labs','/ai','/shift','/vitals',
  '/pk-dosing','/tutor','/biblioteca','/mnemonicas','/protocolos','/calculos',
  '/anatomia-3d','/inicio','/settings','/familia','/sintomas','/calendario','/perfil']
fs.mkdirSync(ONDE, { recursive: true })
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const p = await ctx.newPage()
  const erros = []
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 160)) })
  await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await p.fill('input[type=email]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt').catch(() => {})
  await p.fill('input[type=password]', process.env.QA_PASS || process.env.QA_PASSWORD || 'QaPhlox2026!').catch(() => {})
  await p.click('button[type=submit]').catch(() => {})
  await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {})
  for (const rota of PAGINAS) {
    erros.length = 0
    try { await p.goto(BASE + rota, { waitUntil: 'domcontentloaded', timeout: 90000 }) }
    catch { console.log(`⏱  ${rota.padEnd(20)} não respondeu em 90s (primeira compilação?)`); continue }
    await p.waitForFunction(() => !document.querySelector('.skeleton'), { timeout: 40000 }).catch(() => {})
    await p.waitForTimeout(1400)
    const nome = rota.slice(1).replace(/\//g, '-')
    await p.screenshot({ path: path.join(ONDE, nome + '.png') })
    // o que importa: a pagina tem conteudo? ha texto preto sobre preto?
    const diag = await p.evaluate(() => {
      const t = document.body.innerText.trim()
      const rolaDeLado = document.documentElement.scrollWidth > window.innerWidth + 2
      // uma var() que nao resolve sai como string vazia -> o browser usa o herdado
      // SÓ o texto que o próprio elemento escreve. A primeira versão disto
      // usava `e.textContent`, que inclui o dos filhos — e acusava todos os
      // contentores que têm fundo e cor definidos mas cujo texto vem de
      // dentro, com a cor dele. Três falsos positivos em três páginas.
      const temTextoProprio = e => [...e.childNodes]
        .some(n => n.nodeType === 3 && n.textContent.trim())
      const maus = [...document.querySelectorAll('*')].filter(e => {
        const s = getComputedStyle(e)
        return s.color === s.backgroundColor && temTextoProprio(e)
      }).map(e => `<${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}> "${e.textContent.trim().slice(0, 40)}" ${getComputedStyle(e).color}`)
      return { chars: t.length, rolaDeLado, quebradas: maus.length, maus: maus.slice(0, 3) }
    })
    const mau = diag.chars < 80 || diag.rolaDeLado || diag.quebradas > 0 || erros.length
    console.log(`${mau ? '✗' : '✓'}  ${rota.padEnd(20)} ${diag.chars} car${diag.rolaDeLado ? ' · ROLA DE LADO' : ''}${diag.quebradas ? ` · ${diag.quebradas} TEXTO=FUNDO` : ''}${erros.length ? ` · ${erros.length} erro(s): ${erros[0]}` : ''}`)
    if (diag.quebradas) diag.maus.forEach(m => console.log('       ' + m))
  }
} finally { await browser.close() }
