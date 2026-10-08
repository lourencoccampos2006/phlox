import fs from 'node:fs'
// Os tamanhos da mesa, arredondados ao token mais proximo.
const T = [[10,'--t-micro'],[10.5,'--t-micro'],[11,'--t-micro'],[11.5,'--t-meta'],
  [12,'--t-meta'],[12.5,'--t-meta'],[13,'--t-dado'],[13.5,'--t-dado'],[14,'--t-corpo'],
  [14.5,'--t-corpo'],[15,'--t-corpo'],[16,'--t-destaque'],[17,'--t-destaque'],
  [18,'--t-destaque'],[19,'--t-destaque'],[20,'--t-destaque'],[30,'--t-numero']]
const P = [[400,'--peso-normal'],[500,'--peso-corpo'],[600,'--peso-corpo'],
  [700,'--peso-forte'],[800,'--peso-forte']]
let total = 0
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8')
  let n = 0
  s = s.replace(/fontSize:\s*([0-9.]+)(?![.\w])/g, (t, v) => {
    const hit = T.find(([x]) => x === Number(v)); if (!hit) return t
    n++; return `fontSize: 'var(${hit[1]})'`
  })
  s = s.replace(/fontWeight:\s*([0-9]+)(?![.\w])/g, (t, v) => {
    const hit = P.find(([x]) => x === Number(v)); if (!hit) return t
    n++; return `fontWeight: 'var(${hit[1]})' as any`
  })
  if (n) { fs.writeFileSync(f, s); console.log(`  ${String(n).padStart(3)}  ${f}`); total += n }
}
console.log(`${total} valores crus trocados por tokens.`)
