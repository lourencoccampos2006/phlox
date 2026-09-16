// scripts/check-camadas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Um modal que fica por baixo da barra de navegação não parece partido — parece
// só um botão que não dá para carregar.
//
// A barra inferior (components/BottomNav.tsx) está a z-index 120. Seis modais
// espalhados pela aplicação estavam a 60 ou 70. No computador ninguém reparava,
// porque a barra não aparece; no telemóvel a barra ficava POR CIMA e, no
// /vault, tapava exatamente o botão "Guardar".
//
// Este guarda procura invólucros de modal (`position: 'fixed', inset: 0`) com
// um z-index abaixo da barra.
//
//   node scripts/check-camadas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const BARRA = 120

// Onde a barra inferior não existe, um z-index baixo não faz mal: o modo
// clínico tem navegação própria. (O /inicio esteve isento enquanto estava a
// ser refeito — deixou de estar a 2026-09-16, e foi logo apanhado.)
const ISENTOS = ['components/InstitutionShell.tsx']

const ficheiros = []
;(function varrer(dir) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '.claude'].includes(n)) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) varrer(p)
    else if (extname(n) === '.tsx') ficheiros.push(p)
  }
})('.')

let maus = 0, vistos = 0
for (const f of ficheiros) {
  const rel = f.replace(/\\/g, '/').replace(/^\.\//, '')
  if (ISENTOS.some(i => rel.endsWith(i))) continue
  const texto = readFileSync(f, 'utf8')
  const linhas = texto.split('\n')
  linhas.forEach((linha, i) => {
    if (!/position:\s*'fixed',\s*inset:\s*0/.test(linha)) return
    const m = linha.match(/zIndex:\s*(\d+)/)
    if (!m) return                 // sem z-index explícito: usa o estiloFundoModal ou herda
    vistos++
    const z = Number(m[1])
    if (z < BARRA) {
      maus++
      console.log(`✗ ${rel}:${i + 1}`)
      console.log(`    modal a z-index ${z}, por baixo da barra inferior (${BARRA}) — no telemóvel a barra tapa-lhe o fundo`)
      console.log(`    usar \`estiloFundoModal\` de lib/camadas.ts`)
    }
  })
}

console.log(maus
  ? `\n✗ ${maus} modal(is) por baixo da barra, em ${vistos} verificados.`
  : `✓ Os ${vistos} modais com z-index explícito ficam todos acima da barra inferior.`)
process.exit(maus ? 1 : 0)
