// scripts/check-colunas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Pedir uma coluna que não existe não dá erro nenhum — dá silêncio.
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// O /api/push/cron pedia `shifts` a `personal_meds`. Essa coluna nunca existiu
// nessa tabela. O PostgREST, perante uma coluna desconhecida, recusa o SELECT
// INTEIRO e devolve `{ data: null, error }`. E como o código fazia só
//
//     const { data } = await supabase.from('personal_meds').select(...)
//
// o erro ia para o lixo, `data` ficava null, e a lista de lembretes ficava
// vazia. Resultado: zero notificações de medicação desde sempre, com o cron a
// correr de 5 em 5 minutos e a responder 200.
//
// Já tinha acontecido antes: `content`/`kind` em /apoio-psicossocial,
// `recorded_by_id` em medication_prep_logs, `org_id` em support_recurring_logs.
// É uma família de bugs, e uma família de bugs merece um guarda.
//
// Corre com a chave de serviço (lê o .env.local):
//   node scripts/check-colunas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SB || !CHAVE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(2)
}

// ── 1. As colunas que existem mesmo ─────────────────────────────────────────
// O PostgREST publica a estrutura em OpenAPI na raiz do /rest/v1/.
const spec = await fetch(`${URL_SB}/rest/v1/`, {
  headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` },
}).then(r => r.json())

const reais = new Map()
for (const [tabela, def] of Object.entries(spec.definitions || {})) {
  reais.set(tabela, new Set(Object.keys(def.properties || {})))
}
if (!reais.size) { console.error('Não consegui ler a estrutura da base de dados.'); process.exit(2) }

// ── 2. As colunas que o código pede ─────────────────────────────────────────
const ficheiros = []
;(function varrer(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n === '.git' || n === '.claude') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) varrer(p)
    else if (['.ts', '.tsx'].includes(extname(n))) ficheiros.push(p)
  }
})('.')

// .from('tabela')  ...  .select('a, b, c')
// O `[\s\S]{0,200}?` deixa passar os encadeamentos e as quebras de linha que
// há pelo meio; para de procurar antes de chegar ao `from` seguinte.
const PADRAO = /\.from\(\s*['"`]([a-z_0-9]+)['"`]\s*\)[\s\S]{0,200}?\.select\(\s*['"`]([^'"`]*)['"`]/g

let problemas = 0, verificados = 0
const desconhecidas = new Set()

for (const f of ficheiros) {
  const texto = readFileSync(f, 'utf8')
  for (const m of texto.matchAll(PADRAO)) {
    const [, tabela, lista] = m
    // `*`, contagens e recursos encaixados ficam de fora: o que se quer apanhar
    // é o nome de coluna escrito à mão que não existe.
    if (!lista || lista.includes('*') || lista.includes('(') || lista.includes(':')) continue
    const cols = reais.get(tabela)
    if (!cols) { desconhecidas.add(tabela); continue }

    const linha = texto.slice(0, m.index).split('\n').length
    for (const bruto of lista.split(',')) {
      const col = bruto.trim()
      if (!col) continue
      verificados++
      if (!cols.has(col)) {
        problemas++
        console.log(`✗ ${f.replace(/\\/g, '/')}:${linha}`)
        console.log(`    ${tabela}.${col} NÃO EXISTE — este select falha inteiro e devolve data:null`)
      }
    }
  }
}

if (desconhecidas.size) {
  console.log(`\n(${desconhecidas.size} tabela(s) fora da API: ${[...desconhecidas].slice(0, 8).join(', ')})`)
}

console.log(problemas
  ? `\n✗ ${problemas} coluna(s) inexistente(s) em ${verificados} verificadas.`
  : `✓ As ${verificados} colunas pedidas ao Supabase existem todas.`)
process.exit(problemas ? 1 : 0)
