// scripts/check-jsx-assercoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A armadilha que deitou o /scan abaixo a 2026-09-17.
//
// ── O QUE ACONTECEU ────────────────────────────────────────────────────────
// Havia um componente `<Bloco quando={...}>` que devolve null quando `quando` e
// falso, e usava-se assim:
//
//     <Bloco quando={!!res.ligacoes?.length}>
//       {res.ligacoes!.map(...)}
//     </Bloco>
//
// Parece seguro. Nao e. Em JSX os FILHOS sao avaliados ANTES de o componente
// correr -- `jsx(Bloco, { quando: false, children: res.ligacoes.map(...) })`.
// O `.map()` corre na mesma. Se o campo vier em falta, e um TypeError, e um
// TypeError no render leva a PAGINA INTEIRA para o error boundary: "Algo
// correu mal. Ocorreu um erro inesperado."
//
// O `!` do TypeScript nao ajuda -- so desliga o aviso do compilador, nao gera
// nenhuma verificacao. E foi exatamente isso que mascarou o problema: sete
// sitios com `!` a dizer "confia em mim" sobre campos que a IA nem sempre
// devolve, e leituras antigas ja guardadas que nunca teriam os campos novos.
//
// Escreve-se `(x || []).map(...)` e a armadilha desaparece.
//
//   node scripts/check-jsx-assercoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const RAIZES = ['app', 'components']
const PADRAO = /([A-Za-z_$][\w$]*(?:\.[\w$]+)*)!\.(map|slice|filter|forEach|join|reduce|some|every)\(/g

function ficheiros(dir, fora = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') ficheiros(p, fora) }
    else if (e.name.endsWith('.tsx')) fora.push(p)
  }
  return fora
}

const achados = []
for (const raiz of RAIZES) {
  if (!fs.existsSync(raiz)) continue
  for (const f of ficheiros(raiz)) {
    const linhas = fs.readFileSync(f, 'utf8').split(/\r?\n/)
    linhas.forEach((linha, i) => {
      PADRAO.lastIndex = 0
      let m
      while ((m = PADRAO.exec(linha))) {
        achados.push({ f: f.replace(/\\/g, '/'), n: i + 1, expr: `${m[1]}!.${m[2]}()`, linha: linha.trim().slice(0, 110) })
      }
    })
  }
}

if (!achados.length) {
  console.log('✓ Nenhuma asserção `!` sobre listas em JSX. Os filhos de um componente\n  condicional nunca rebentam por um campo em falta.')
  process.exit(0)
}

console.log('Asserções `!` sobre listas dentro de JSX:\n')
for (const a of achados) {
  console.log(`✗ ${a.f}:${a.n}`)
  console.log(`    ${a.expr} — os filhos de um componente são avaliados mesmo quando ele não os mostra.`)
  console.log(`    ${a.linha}`)
  console.log(`    → escreve (${a.expr.replace(/!\..*/, '')} || []).${a.expr.match(/!\.(\w+)/)[1]}(…)\n`)
}
console.log(`✗ ${achados.length} sítio(s) onde um campo em falta leva a página inteira abaixo.`)
process.exit(1)
