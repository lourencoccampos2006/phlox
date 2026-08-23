#!/usr/bin/env node
// check-scroll.mjs — impede a reincidência do bug de scroll das páginas.
//
// HISTÓRIA: o scroll da homepage partiu-se pelo menos duas vezes, sempre pela
// mesma razão e sempre sem dar sinal nos testes automáticos.
//
// MECANISMO: num elemento normal, `overflow-x: hidden` FORÇA o `overflow-y` a
// computar `auto`. Um invólucro de página com essa regra passa a ser um
// contentor de scroll próprio. Se a caixa dele ficar uns pixels mais curta que
// o conteúdo (basta isso), a roda do rato scrolla ESSES pixels dentro da div,
// chega ao fim, e o `overscroll-behavior-y: none` do body impede o scroll de
// passar para a janela. A página mexe um bocadinho e congela.
//
// PORQUE NÃO É APANHADO: `window.scrollTo()` atua direto no scrollingElement e
// continua a funcionar na perfeição — só o scroll REAL (roda/dedo) é que falha.
// Qualquer QA que use scrollTo() dá verde.
//
// A CORREÇÃO: `overflow-x: clip`. Corta na horizontal exatamente igual, mas NÃO
// cria contentor de scroll e deixa o `overflow-y` em `visible`.
//
// EXCEÇÃO IMPORTANTE: no <html> nunca usar `clip` nem `hidden` — no elemento
// raiz isso desliga a propagação do overflow para o viewport e parte o scroll
// do site inteiro (ver o comentário longo em app/globals.css).

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOTS = ['app', 'components']
const BAD = [
  { re: /overflow-x:\s*hidden/i, what: "overflow-x: hidden" },
  { re: /overflowX:\s*['"]hidden['"]/i, what: "overflowX: 'hidden'" },
]
// Ficheiros onde a regra é legítima (contentores pequenos, carrosséis, tabelas).
const ALLOW_FILE = /globals\.css$/

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (e === 'node_modules' || e === '.next') continue
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|css)$/.test(p)) out.push(p)
  }
  return out
}

const hits = []
for (const root of ROOTS) {
  let files = []
  try { files = walk(root) } catch { continue }
  for (const f of files) {
    if (ALLOW_FILE.test(f)) continue
    const src = readFileSync(f, 'utf8')
    src.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
      for (const b of BAD) {
        if (!b.re.test(line)) continue
        // Só interessa em invólucros de PÁGINA (raiz da página), não em cartões,
        // carrosséis ou tabelas — esses querem mesmo cortar e são pequenos.
        const isPageWrapper = /page\.tsx$/.test(f) && /(\.lp\s*\{|background|minHeight|min-height)/.test(line)
        if (isPageWrapper) hits.push({ f, line: i + 1, what: b.what, text: line.trim().slice(0, 110) })
      }
    })
  }
}

if (hits.length === 0) {
  console.log('✓ Nenhum invólucro de página com overflow-x:hidden (que parte o scroll).')
  process.exit(0)
}
console.error('✗ Invólucro(s) de página com overflow-x:hidden — isto PARTE o scroll da página.\n')
hits.forEach(h => {
  console.error(`  ${h.f}:${h.line}`)
  console.error(`    ${h.text}`)
  console.error(`    → troca "${h.what}" por overflow-x: clip\n`)
})
console.error('Porquê: overflow-x:hidden força overflow-y:auto, o invólucro vira contentor')
console.error('de scroll, e o overscroll-behavior do body impede o scroll de chegar à janela.')
console.error('Nota: window.scrollTo() continua a funcionar — só o scroll real falha.')
process.exit(1)
