// scripts/auditoria-design.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Quantos sistemas de design é que esta aplicação tem ao mesmo tempo?
//
// ── PORQUE É QUE ISTO SE MEDE EM VEZ DE SE OLHAR ───────────────────────────
// «O layout não está bom» é verdade e não é acionável. Olhar para as páginas
// dá uma lista de opiniões; contar dá uma lista de sítios.
//
// O que se conta aqui é a DISPERSÃO: quantos valores diferentes a aplicação
// usa para a mesma decisão. Um produto com um sistema tem três ou quatro
// tamanhos de letra; um produto sem sistema tem trinta, e nenhum deles está
// errado sozinho — é o conjunto que não se lê.
//
//   node scripts/auditoria-design.mjs
//   node scripts/auditoria-design.mjs --detalhe fontSize
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const DETALHE = process.argv.includes('--detalhe')
  ? process.argv[process.argv.indexOf('--detalhe') + 1] : null

/* ── Os ficheiros de ecrã ─────────────────────────────────────────────────── */
const ficheiros = []
;(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) andar(p)
    else if (/\.tsx$/.test(e.name)) ficheiros.push(p)
  }
})('app')
;(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) andar(p)
    else if (/\.tsx$/.test(e.name)) ficheiros.push(p)
  }
})('components')

const texto = new Map(ficheiros.map(f => [f, fs.readFileSync(f, 'utf8')]))
const tudo = [...texto.values()].join('\n')

/* ── Contar ───────────────────────────────────────────────────────────────── */
function contar(nome, expressao, normalizar = v => v) {
  const valores = new Map()
  for (const [f, s] of texto) {
    for (const m of s.matchAll(expressao)) {
      const v = normalizar(m[1])
      if (v == null) continue
      if (!valores.has(v)) valores.set(v, new Set())
      valores.get(v).add(f)
    }
  }
  return { nome, valores }
}

const medidas = [
  contar('tamanhos de letra', /fontSize:\s*([0-9.]+|'[^']+')/g),
  contar('pesos de letra', /fontWeight:\s*([0-9]+|'[^']+')/g),
  contar('raios de canto', /borderRadius:\s*('[^']+'|[0-9]+)/g),
  contar('cores escritas à mão (hex)', /(#[0-9a-fA-F]{3,8})\b/g, v => v.toLowerCase()),
  contar('variáveis de cor do tema', /var\((--[a-z0-9-]+)\)/g,
    v => (/(ink|bg|surface|border|badge|accent)/.test(v) ? v : null)),
  contar('sombras', /boxShadow:\s*('[^']+'|`[^`]+`)/g),
  contar('alturas mínimas de botão', /minHeight:\s*([0-9]+)/g),
  contar('famílias de letra', /fontFamily:\s*('[^']+'|`[^`]+`)/g),
]

console.log('╔═══════════════════════════════════════════════════════════════════')
console.log(`║  ${ficheiros.length} ficheiros de ecrã (.tsx)`)
console.log('╚═══════════════════════════════════════════════════════════════════\n')

for (const m of medidas) {
  const ordenado = [...m.valores].sort((a, b) => b[1].size - a[1].size)
  console.log(`${String(m.valores.size).padStart(4)} valores diferentes — ${m.nome}`)
  const top = ordenado.slice(0, 6).map(([v, fs_]) => `${v}×${fs_.size}`).join('  ')
  console.log(`      mais usados: ${top}`)
  if (DETALHE && m.nome.includes(DETALHE)) {
    console.log('      TODOS:')
    for (const [v, fs_] of ordenado) console.log(`        ${String(v).padEnd(26)} ${fs_.size} ficheiro(s)`)
  }
  console.log()
}

/* ── Quanto é que está preso ao ficheiro em que foi escrito ───────────────── */
const comEstiloInline = ficheiros.filter(f => /style=\{\{/.test(texto.get(f))).length
const linhasDeEstilo = (tudo.match(/style=\{\{/g) || []).length
const classesCss = (tudo.match(/className="/g) || []).length

console.log('── Onde vive o estilo ──────────────────────────────────────────────')
console.log(`  ${linhasDeEstilo} objetos \`style={{…}}\` escritos à mão`)
console.log(`  ${classesCss} usos de \`className\``)
console.log(`  ${comEstiloInline} de ${ficheiros.length} ficheiros têm estilo inline`)
console.log()

/* ── As peças repetidas ───────────────────────────────────────────────────── */
// Quantas vezes é que cada ficheiro reinventa o mesmo objeto?
const padroes = [
  ['cabeçalho de secção (MONO)', /const MONO\s*:/g],
  ['cartão com borda + raio', /border:\s*'1(?:\.5)?px solid var\(--border\)'/g],
  ['botão primário à mão', /background:\s*cor\b[\s\S]{0,80}?color:\s*'#fff'/g],
  ['grelha auto-fit', /repeat\(auto-fit,\s*minmax\(/g],
  ['estado vazio em texto solto', /Ainda não h|ainda não há|Nada marcado|Sem registos/g],
]
console.log('── O mesmo objeto, escrito outra vez ───────────────────────────────')
for (const [nome, re] of padroes) {
  const n = (tudo.match(re) || []).length
  const ficheirosComEle = ficheiros.filter(f => re.test(texto.get(f))).length
  console.log(`  ${String(n).padStart(4)} ocorrências em ${ficheirosComEle} ficheiros — ${nome}`)
}
console.log()

/* ── Componentes partilhados que existem ──────────────────────────────────── */
const partilhados = fs.readdirSync('components')
  .filter(f => f.endsWith('.tsx'))
/* ══════════════════════════════════════════════════════════════════════════
   O TECTO — o que torna isto um teste e não um relatório
   ══════════════════════════════════════════════════════════════════════════
   Um relatório lê-se uma vez. Isto tem de ser uma GUARDA: um ficheiro já
   migrado para `components/ui/` não pode voltar a escrever um tamanho de
   letra, uma cor ou uma altura à mão — senão, ao fim de três semanas, o
   sistema novo tem as mesmas 97 medidas que o antigo, e ninguém deu por isso.

   A lista cresce sozinha: a regra aplica-se a quem importa as peças. Não há
   nenhum ficheiro de exceções para alguém acrescentar uma linha a meio de uma
   tarde com pressa.
   ══════════════════════════════════════════════════════════════════════════ */
const CRU = [
  ['tamanho de letra', /fontSize:\s*[0-9.]+/g],
  ['cor em hex', /#[0-9a-fA-F]{3,8}\b/g],
  ['raio', /borderRadius:\s*[0-9.]+/g],
  ['altura de alvo', /minHeight:\s*[0-9.]+/g],
  ['peso de letra', /fontWeight:\s*[0-9]+/g],
]

/* Dois idiomas do CSS que sao estrutura, nao medida, e por isso nao contam:
   o `minHeight: 0` que autoriza um filho de flex a encolher abaixo do seu
   conteudo (sem ele um painel com rolar interno estica a mesa toda), e o
   `borderRadius: 999`, que e «redondo ate ao fim» e nao um raio escolhido. */
/* E um terceiro, achado na /family: `minHeight: 460` na caixa do fio de
   conversa. A regra chama-se «altura de alvo» e existe para apanhar botoes
   escritos a mao — um alvo de toque anda entre os 24 e os 64 pixeis. 460 e a
   altura de uma CAIXA, e nenhum token de alvo lhe serve. Acima de 64 isto
   deixa de ser a regra certa para a medida certa, e passar a escrever
   `var(--alvo)` ali seria obedecer a guarda e partir a pagina. */
const IDIOMAS = [
  /^minHeight:\s*0$/,
  /^borderRadius:\s*9{3,}$/,
  /* …e tambem ABAIXO de 24: o `minHeight: 4` da /sintomas e a altura
     minima de uma BARRINHA de grafico, para uma leitura de zero ainda
     se ver. Nenhum token de alvo lhe serve, e por a `var(--alvo)` ali
     era obedecer a guarda e partir o grafico. */
  /^minHeight:\s*([0-9]|1[0-9]|2[0-3])$/,
  /^minHeight:\s*(6[5-9]|[7-9][0-9]|[1-9][0-9]{2,})$/,
]

/* Um comentario a explicar por que motivo uma cor saiu nao e a cor a entrar
   outra vez. Sem isto, escrever a licao no codigo fa-la contar como falta. */
function semComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:/])\/\/[^\n]*/g, '$1')
}

/* O QUE VAI PARA PAPEL NAO E A MESA.
   Uma folha de impressao e HTML para uma janela nova: nao herda a folha de
   estilos do site, nao tem `var(--...)` nenhum, e e Arial e Georgia porque e
   o que uma impressora tem. Exigir-lhe os tokens da mesa nao faz sentido.

   So conta como papel um literal que seja MESMO um documento — tem `<style>`
   ou abre em `<html`/`<!doctype`. Sem essa condicao, isto era uma porta das
   traseiras para escrever cores a mao dentro de qualquer `template string`. */
function semPapel(t) {
  return t.replace(/`[^`]*`/g, m =>
    /<style|<html|<!doctype/i.test(m) ? '``' : m)
}

const migrados = ficheiros.filter(f => /from '@\/components\/ui\//.test(texto.get(f)))
const faltas = []
for (const f of migrados) {
  // As próprias peças definem o sistema — nelas os valores são a definição.
  if (f.includes(path.join('components', 'ui'))) continue
  const s = semPapel(semComentarios(texto.get(f)))
  for (const [nome, re] of CRU) {
    const achados = (s.match(re) || [])
      .map(x => x.replace(/\s+/g, ' ').trim())
      .filter(x => !IDIOMAS.some(i => i.test(x)))
    if (achados.length) faltas.push({ f, nome, n: achados.length, exemplos: [...new Set(achados)].slice(0, 4) })
  }
}

console.log('── O tecto (ficheiros já migrados para components/ui) ──────────────')
if (!migrados.length) {
  console.log('  Ainda nenhum ficheiro usa as peças. A regra passa a valer assim que o primeiro usar.')
} else if (!faltas.length) {
  console.log(`  ✓ ${migrados.length} ficheiro(s) migrado(s), nenhum com valores escritos à mão.`)
} else {
  console.log(`  ✗ ${faltas.length} sítio(s) a escrever valores à mão num ficheiro já migrado:\n`)
  for (const x of faltas) {
    console.log(`    ${x.f}`)
    console.log(`      ${x.n} × ${x.nome} — ${x.exemplos.join(', ')}`)
  }
  console.log('\n  Ou a peça faz o que é preciso, ou muda-se a peça. Não se escreve o número.')
}
console.log()

console.log('── O que já é partilhado ───────────────────────────────────────────')
console.log(`  ${partilhados.length} componentes em components/`)
const usados = partilhados.map(f => {
  const nome = f.replace('.tsx', '')
  const n = ficheiros.filter(x => new RegExp(`from '@/components/${nome}'`).test(texto.get(x))).length
  return [nome, n]
}).sort((a, b) => b[1] - a[1])
console.log(`  os mais reutilizados: ${usados.slice(0, 8).map(([n, c]) => `${n}(${c})`).join('  ')}`)
console.log(`  nunca importados por ninguém: ${usados.filter(([, c]) => c === 0).length}`)

// Sai a vermelho só pelo tecto. Os números de cima são o retrato do que falta
// fazer — se fizessem a guarda falhar, ela ficava vermelha durante um mês
// inteiro e deixava de ser lida ao terceiro dia.
process.exit(faltas.length ? 1 : 0)
