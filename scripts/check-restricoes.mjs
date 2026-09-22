// scripts/check-restricoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os valores que o codigo escreve cabem no `check` da coluna?
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// A 2026-09-17 descobriu-se que o botao "Guardar no cofre" do Explicar NUNCA
// funcionou. A coluna `health_vault.category` tem
//
//     check (category in ('exam','prescription','imaging','vaccine','report','letter','other'))
//
// e o codigo escrevia 'analises', 'receitas', 'relatorios', 'outros'. Todos os
// inserts batiam no `check` e devolviam 400. O mesmo codigo servia o guardar
// automatico dos planos pagos -- esse tambem nunca guardou nada.
//
// Nao foi um descuido de escrita: foi nao haver nada a comparar as duas listas.
// Uma restricao e uma promessa escrita num .sql que ninguem volta a ler, e um
// literal escrito num .tsx seis meses depois nao sabe dela. E o erro e
// silencioso, porque o codigo que le `error` e raro.
//
// ── PORQUE E QUE ISTO E CONSCIENTE DA TABELA ───────────────────────────────
// A primeira versao juntava as restricoes por NOME de coluna. Nomes como
// `type`, `kind`, `category` e `level` existem em dezenas de tabelas, e o
// resultado foram 40 falsos positivos numa lista de sugestoes de atividades
// que nunca chega a ir a base de dados. Um verificador confiante em excesso e
// pior do que nenhum: neste projeto ja me levou a querer "corrigir" codigo
// saudavel. Por isso so se acusa o que se consegue ligar A TABELA CERTA.
//
//   node scripts/check-restricoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

// ── 1. tabela -> coluna -> valores permitidos ─────────────────────────────
const porTabela = new Map()

function guardar(tabela, coluna, valores) {
  if (!valores.length) return
  if (!porTabela.has(tabela)) porTabela.set(tabela, new Map())
  const cols = porTabela.get(tabela)
  // Varias migracoes podem redefinir a mesma coluna (um `alter ... drop
  // constraint` seguido de outro `check`). Fica a lista MAIS LARGA: acusar de
  // menos e melhor do que acusar a mais.
  const antes = cols.get(coluna)
  if (!antes || valores.length > antes.size) cols.set(coluna, new Set(valores))
}

for (const f of fs.readdirSync('supabase').filter(x => x.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join('supabase', f), 'utf8')

  // (a) dentro de um `create table`
  for (const t of sql.matchAll(/create table (?:if not exists )?([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/gi)) {
    const tabela = t[1]
    for (const c of t[2].matchAll(/check\s*\(\s*([a-z_]+)\s+in\s*\(([^)]*)\)\s*\)/gi)) {
      guardar(tabela, c[1], [...c[2].matchAll(/'([^']*)'/g)].map(v => v[1]))
    }
  }

  // (b) num `alter table ... add constraint ... check (...)`
  for (const a of sql.matchAll(/alter table (?:if exists )?([a-z_0-9]+)[\s\S]{0,200}?check\s*\(\s*([a-z_]+)\s+in\s*\(([^)]*)\)\s*\)/gi)) {
    guardar(a[1], a[2], [...a[3].matchAll(/'([^']*)'/g)].map(v => v[1]))
  }
}

// ── 2. o que o codigo escreve, e em que tabela ────────────────────────────
function ficheiros(dir, fora = []) {
  if (!fs.existsSync(dir)) return fora
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) ficheiros(p, fora) }
    else if (/\.(ts|tsx)$/.test(e.name)) fora.push(p)
  }
  return fora
}

// `.from('tabela')` ... `insert|update|upsert({ ... })`. O tempered token
// (`(?!\.from\()`) impede que o .from() de uma consulta emparelhe com a
// escrita da consulta SEGUINTE -- foi o bug que o check-colunas ja teve.
const ESCRITA = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)((?:(?!\.from\()[\s\S]){0,400}?)\.(insert|update|upsert)\(\s*\{([\s\S]{0,1200}?)\}/g

function linhaDe(fonte, idx) { return fonte.slice(0, idx).split(/\r?\n/).length }

const achados = []
let escritasVistas = 0

for (const f of [...ficheiros('app'), ...ficheiros('lib'), ...ficheiros('components')]) {
  const fonte = fs.readFileSync(f, 'utf8')
  ESCRITA.lastIndex = 0
  let m
  while ((m = ESCRITA.exec(fonte))) {
    const [, tabela, , , objeto] = m
    const cols = porTabela.get(tabela)
    if (!cols) continue
    escritasVistas++
    for (const [coluna, permitidos] of cols) {
      // (a) o valor escrito a letra: `category: 'exam'`
      const reLiteral = new RegExp(`(^|[{,\\s])${coluna}\\s*:\\s*'([^']+)'`, 'g')
      let v
      while ((v = reLiteral.exec(objeto))) {
        if (permitidos.has(v[2])) continue
        achados.push({
          f: f.replace(/\\/g, '/'), n: linhaDe(fonte, m.index), tabela, coluna, valor: v[2],
          permitidos: [...permitidos].join(', '), via: 'literal',
        })
      }

      // (b) o valor numa VARIAVEL: `category: categoria`.
      //     Era esta a forma do bug do cofre -- um
      //     `const categoria = kind === 'analise' ? 'analises' : ...`
      //     quatro linhas acima. Sem seguir a variavel, esta guarda nao
      //     apanharia o proprio erro que a motivou.
      const reVar = new RegExp(`(^|[{,\\s])${coluna}\\s*:\\s*([A-Za-z_$][\\w$]*)\\s*[,}]`, 'g')
      let x
      while ((x = reVar.exec(objeto))) {
        const nome = x[2]
        if (nome === 'null' || nome === 'undefined') continue
        const decl = new RegExp(`\\b(?:const|let|var)\\s+${nome}\\s*(?::[^=]{0,60})?=\\s*([^\\n;]{0,300})`).exec(fonte)
        if (!decl) continue
        const init = decl[1]
        // So se percebe uma atribuicao feita de literais (um valor directo ou
        // um ternario deles). Se houver uma chamada de funcao no meio, o valor
        // vem de outro sitio e nao se adivinha -- cala-se, que e o correcto.
        if (/[A-Za-z_$][\w$]*\s*\(/.test(init)) continue
        const literais = [...init.matchAll(/'([^']*)'/g)].map(l => l[1]).filter(Boolean)
        for (const lit of literais) {
          if (permitidos.has(lit)) continue
          achados.push({
            f: f.replace(/\\/g, '/'), n: linhaDe(fonte, decl.index), tabela, coluna, valor: lit,
            permitidos: [...permitidos].join(', '), via: `variável \`${nome}\``,
          })
        }
      }
    }
  }
}

const totalCols = [...porTabela.values()].reduce((s, c) => s + c.size, 0)
console.log(`${totalCols} coluna(s) com lista fechada de valores, em ${porTabela.size} tabela(s).`)
console.log(`${escritasVistas} escrita(s) para essas tabelas encontradas no codigo.\n`)

if (!achados.length) {
  console.log('✓ Todos os valores literais escritos cabem nas restricoes da coluna.')
  process.exit(0)
}

for (const a of achados) {
  console.log(`✗ ${a.f}:${a.n}`)
  console.log(`    ${a.tabela}.${a.coluna} = '${a.valor}' (${a.via}) — a base de dados recusa a linha INTEIRA (400).`)
  console.log(`    aceita: ${a.permitidos}\n`)
}
console.log(`✗ ${achados.length} escrita(s) que a base de dados nao aceita.`)
process.exit(1)
