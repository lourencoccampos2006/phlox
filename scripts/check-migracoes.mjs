// scripts/check-migracoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Uma migracao que so rebenta quando o Fernando a cola no SQL Editor.
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// O sprint152 falhou DUAS vezes, com dois erros diferentes, e as duas vezes o
// custo foi o mesmo: o Fernando colou o SQL, viu um erro em ingles, e mandou-mo
// de volta. Nenhuma das duas precisava de ter chegado la.
//
//   1ª: `capability_catalog_level_check ... is violated by some row`
//       Eu criava a restricao `level in ('ver','editar','eliminar')` ANTES de
//       apagar as 47 linhas velhas, que tinham 'read'/'write'/'admin'. Um
//       `add constraint` nao olha so para o futuro -- confere o que ja esta
//       na tabela.
//
//   2ª: a restricao antiga recusava os papeis novos, porque o `drop` usava o
//       nome por convencao em vez de descobrir o nome real.
//
// Esta guarda pega em cada `add constraint ... check (coluna in (...))` dos
// ficheiros por aplicar, vai a base de dados REAL ver o que ha naquela coluna,
// e diz quantas linhas a restricao ia recusar. E o unico teste que responde a
// pergunta certa: "isto passa com os dados que existem mesmo?".
//
// ── O QUE ELA NAO FAZ ──────────────────────────────────────────────────────
// Nao executa nada. Nao ordena as instrucoes, nao adivinha o efeito de um
// UPDATE que venha antes -- se a migracao converte as linhas primeiro, a
// guarda vai na mesma dizer "ia recusar 47 linhas", porque so ve o estado de
// agora. Por isso o relatorio diz sempre O QUE A MIGRACAO FAZ ANTES, para se
// poder decidir com a informacao toda em vez de so com o numero.
//
//   node scripts/check-migracoes.mjs
//   node scripts/check-migracoes.mjs supabase/sprint152_permissoes.sql
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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
const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` }

// Que ficheiros olhar. Sem argumento, os que ainda nao foram aplicados — que
// sao os unicos que podem rebentar.
const POR_APLICAR = ['150', '151', '152', '153', '154', '155', '156', '157', '158']
const alvos = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('supabase')
      .filter(f => f.endsWith('.sql') && POR_APLICAR.some(n => f.startsWith(`sprint${n}_`)))
      .map(f => join('supabase', f))
      .sort()

// `alter table X add constraint Y check (COLUNA in ('a', 'b', …))`
// Aceita o `if not exists` e os blocos `do $$ … $$` a volta, porque e assim
// que as migracoes deste projeto escrevem restricoes idempotentes.
const RESTRICAO = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?["`]?(\w+)["`]?\s+add\s+constraint\s+(\w+)[\s\S]{0,200}?check\s*\(\s*(\w+)\s+in\s*\(([^)]*)\)/gi

// `create unique index … on X (a, b)`: rebenta se ja houver duplicados. E a
// mesma classe de erro da restricao — o Postgres confere o que ja la esta — e
// apanhou-me a meio do sprint158, quando precisei de por uma restricao unica em
// `mar_records` para poder usar `upsert`.
const INDICE_UNICO = /create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+(?:public\.)?["`]?(\w+)["`]?\s*\(([^)]*)\)/gi

// `alter table X add column … not null` sem default: rebenta se a tabela tiver
// linhas. E um erro diferente e menos frequente, mas da o mesmo resultado.
const COLUNA_OBRIGATORIA = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?["`]?(\w+)["`]?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?["`]?(\w+)["`]?\s+([^;]*?)not\s+null([^;]*)/gi

// Uma quebra de linha nomeada: as mensagens desta guarda sao de varias linhas,
// e templates a abrir e fechar no meio do codigo leem-se pior do que isto.
const BR = '\n'

const problemas = []
const avisos = []
let verificadas = 0

/** Todos os valores distintos de uma coluna, com quantas linhas cada. */
async function valoresDe(tabela, coluna) {
  const r = await fetch(`${URL_SB}/rest/v1/${tabela}?select=${coluna}`, { headers: cab })
  if (!r.ok) return null
  const linhas = await r.json()
  if (!Array.isArray(linhas)) return null
  const conta = new Map()
  for (const l of linhas) {
    const v = l[coluna]
    conta.set(v, (conta.get(v) || 0) + 1)
  }
  return { total: linhas.length, conta }
}

for (const ficheiro of alvos) {
  let sql
  try { sql = readFileSync(ficheiro, 'utf8') } catch { console.log(`(salto ${ficheiro}: nao existe)`); continue }

  // O que a migracao FAZ a esta tabela antes de restringir. Sem isto, o
  // relatorio acusa migracoes que ja se tinham corrigido a si proprias.
  const limpa = new Set([...sql.matchAll(/delete\s+from\s+(?:public\.)?["`]?(\w+)["`]?/gi)].map(m => m[1].toLowerCase()))
  const converte = new Set([...sql.matchAll(/update\s+(?:public\.)?["`]?(\w+)["`]?\s+set\s+(\w+)/gi)].map(m => `${m[1].toLowerCase()}.${m[2].toLowerCase()}`))

  for (const m of sql.matchAll(RESTRICAO)) {
    const [, tabela, nome, coluna, listaBruta] = m
    const permitidos = new Set([...listaBruta.matchAll(/'([^']*)'/g)].map(x => x[1]))
    if (!permitidos.size) continue
    verificadas++

    const linha = sql.slice(0, m.index).split('\n').length
    const dados = await valoresDe(tabela, coluna)
    if (!dados) {
      avisos.push(`${ficheiro}:${linha}  ${tabela}.${coluna} — nao consegui ler a tabela (pode ainda nao existir).`)
      continue
    }
    if (dados.total === 0) continue   // tabela vazia: nada a violar

    const maus = [...dados.conta.entries()].filter(([v]) => v !== null && !permitidos.has(String(v)))
    if (!maus.length) continue

    const quantas = maus.reduce((s, [, n]) => s + n, 0)
    const apagaAntes = limpa.has(tabela.toLowerCase())
    const converteAntes = converte.has(`${tabela.toLowerCase()}.${coluna.toLowerCase()}`)

    const detalhe = maus.map(([v, n]) => `${v === null ? 'null' : `'${v}'`} ×${n}`).join(', ')
    const texto =
      `${ficheiro}:${linha}\n` +
      `    ${nome}: check (${coluna} in ${[...permitidos].map(p => `'${p}'`).join(', ')})\n` +
      `    ${quantas} linha(s) de ${tabela} nao cabem la: ${detalhe}`

    if (apagaAntes) {
      // `delete from` algures no ficheiro. So salva se vier ANTES da restricao.
      const ondeApaga = sql.search(new RegExp(`delete\\s+from\\s+(?:public\\.)?["\`]?${tabela}`, 'i'))
      if (ondeApaga >= 0 && ondeApaga < m.index) continue
      problemas.push(texto + `\n    → o ficheiro APAGA ${tabela}, mas DEPOIS da restricao. Troca a ordem.`)
    } else if (converteAntes) {
      const ondeConverte = sql.search(new RegExp(`update\\s+(?:public\\.)?["\`]?${tabela}\\s+set\\s+${coluna}`, 'i'))
      if (ondeConverte >= 0 && ondeConverte < m.index) continue
      problemas.push(texto + `\n    → o ficheiro CONVERTE ${tabela}.${coluna}, mas DEPOIS da restricao. Troca a ordem.`)
    } else {
      problemas.push(texto + `\n    → nada no ficheiro trata destas linhas antes. A restricao vai ser recusada.`)
    }
  }

  for (const m of sql.matchAll(INDICE_UNICO)) {
    const [, nome, tabela, colunasBrutas] = m
    // Colunas simples. Uma expressao (`coalesce(turno, '-')`) nao se consegue
    // avaliar daqui sem reimplementar o Postgres — e um guarda que adivinha e
    // um guarda que da alarmes falsos ate alguem o desligar.
    const colunas = colunasBrutas.split(',').map(c => c.trim()).filter(c => /^\w+$/.test(c))
    if (colunas.length !== colunasBrutas.split(',').length) continue
    verificadas++

    const linha = sql.slice(0, m.index).split('\n').length
    const r = await fetch(`${URL_SB}/rest/v1/${tabela}?select=${colunas.join(',')}`, { headers: cab })
    if (!r.ok) {
      avisos.push(`${ficheiro}:${linha}  ${tabela} — nao consegui ler a tabela (pode ainda nao existir).`)
      continue
    }
    const rows = await r.json()
    if (!Array.isArray(rows) || rows.length === 0) continue

    const conta = new Map()
    for (const x of rows) {
      const k = colunas.map(c => x[c]).join('')
      conta.set(k, (conta.get(k) || 0) + 1)
    }
    const repetidos = [...conta.values()].filter(n => n > 1)
    if (!repetidos.length) continue

    const linhasAMais = repetidos.reduce((s, n) => s + (n - 1), 0)
    problemas.push(
      `${ficheiro}:${linha}` + BR +
      `    ${nome}: unique (${colunas.join(', ')}) sobre ${tabela}` + BR +
      `    ${repetidos.length} combinacao(oes) ja repetida(s), ${linhasAMais} linha(s) a mais.` + BR +
      `    → o indice vai ser recusado. Limpa os duplicados antes.`)
  }

  for (const m of sql.matchAll(COLUNA_OBRIGATORIA)) {
    const [, tabela, coluna, antes, depois] = m
    if (/default/i.test(antes) || /default/i.test(depois)) continue
    const linha = sql.slice(0, m.index).split('\n').length
    const r = await fetch(`${URL_SB}/rest/v1/${tabela}?select=*&limit=1`, { headers: { ...cab, Prefer: 'count=exact' } })
    const conta = Number((r.headers.get('content-range') || '').split('/')[1] || 0)
    if (conta > 0) {
      problemas.push(
        `${ficheiro}:${linha}\n` +
        `    ${tabela}.${coluna} entra como NOT NULL sem default, e a tabela tem ${conta} linha(s).\n` +
        `    → da-lhe um default, ou preenche as linhas antes.`)
    }
  }
}

console.log(`${verificadas} restricao(oes) simuladas contra a base de dados real, em ${alvos.length} ficheiro(s).\n`)

for (const a of avisos) console.log(`! ${a}`)
if (avisos.length) console.log('')

if (!problemas.length) {
  console.log('✓ Nenhuma migracao pendente e recusada pelos dados que existem agora.')
  process.exit(0)
}
for (const p of problemas) console.log(`✗ ${p}\n`)
console.log(`✗ ${problemas.length} instrucao(oes) que iam falhar no SQL Editor.`)
process.exit(1)
