// scripts/check-sql.mjs
// ─────────────────────────────────────────────────────────────────────────────
// As migrações por correr vão mesmo correr?
//
// ── PORQUE E QUE ISTO EXISTE ────────────────────────────────────────────────
// Em 2026-09-29 o Fernando correu quatro migracoes seguidas e as quatro
// rebentaram. Tres delas pelo MESMO erro, escrito por mim quatro vezes:
//
//     for o in select id, user_id from organizations loop
//
// `organizations` nao tem `user_id`. Tem `owner_id`. E o pior: a guarda
// `check-colunas.mjs` ate me tinha mostrado isso nesse mesmo dia — mas ela so
// le TypeScript. Os ficheiros .sql nunca foram olhados por ninguem antes de
// irem para as maos dele.
//
// Uma migracao errada nao e como um bug numa pagina. O editor do Supabase
// corre o ficheiro inteiro numa transacao: um erro a meio e NADA e aplicado, e
// quem esta do outro lado fica a olhar para uma mensagem do Postgres sem saber
// se perdeu alguma coisa.
//
// ── COMO ────────────────────────────────────────────────────────────────────
// Parte do esquema REAL (o OpenAPI do PostgREST) e vai aplicando, por ordem de
// numero, o que cada migracao cria e altera. Antes de aplicar cada uma,
// verifica as referencias dela contra o esquema acumulado ate ali.
//
// Isso apanha as duas coisas que aconteceram:
//   • uma coluna que nao existe  (`organizations.user_id`)
//   • uma tabela usada antes de a migracao que a cria ter corrido
//     (`etiquetas_do_utente` no sprint164, que vem do 163)
//
// ── O QUE ELA NAO VERIFICA, E PORQUE ESTA BEM ──────────────────────────────
// SQL montado dentro de `execute format(...)`, colunas em `where` complexos e
// funcoes de plpgsql. Nao tento ser um parser de SQL: tento apanhar os padroes
// que estas migracoes usam de facto, sem NUNCA gritar em falso. O numero de
// linhas que saltei aparece no fim, para se saber o tamanho do que nao vi.
//
//   node scripts/check-sql.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1) }

/* ── O esquema que existe agora ───────────────────────────────────────────── */
const spec = await fetch(`${U}/rest/v1/`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  .then(r => r.json())
const defs = spec.definitions || spec.components?.schemas || {}
const ESQUEMA = new Map(
  Object.entries(defs).map(([t, d]) => [t, new Set(Object.keys(d.properties || {}))]),
)
if (!ESQUEMA.size) { console.error('Não consegui ler o esquema do PostgREST.'); process.exit(1) }

/* ── As migrações, por ordem de número ────────────────────────────────────── */
const numero = f => { const m = /sprint(\d+)/.exec(f); return m ? +m[1] : 0 }
const ficheiros = fs.readdirSync('supabase')
  .filter(f => f.endsWith('.sql'))
  .sort((a, b) => numero(a) - numero(b))

/**
 * A ordem POR QUE ELAS VÃO CORRER, escrita à mão.
 *
 * Não é a ordem dos números. A `153` gera a RLS por área a partir das tabelas
 * que existem, e por isso tem de ser a ÚLTIMA — depois de todas as outras
 * terem criado as suas. Ordenar por número punha-a em primeiro e ela não via
 * metade das tabelas que tem de proteger.
 *
 * Isto quase me escapou: a primeira versão desta guarda filtrava por
 * `numero >= 162` e deixava a 153 de fora sem dizer nada. A migração que corre
 * no fim era a única que ninguém verificava.
 */
const ORDEM = (process.env.ORDEM||'162,163,164,165,166,167,168,153').split(',').map(Number)
const pendentes = ORDEM
  .map(n => ficheiros.find(f => numero(f) === n))
  .filter(Boolean)

const emFalta = ORDEM.filter(n => !ficheiros.some(f => numero(f) === n))
if (emFalta.length) {
  console.error(`Não encontrei os ficheiros das migrações ${emFalta.join(', ')}.`)
  process.exit(1)
}

/* ── Limpar o SQL para o poder ler ────────────────────────────────────────── */
/** Tira comentários e o conteúdo dos literais, mantendo o comprimento em linhas. */
function limpar(sql) {
  return sql
    .replace(/--[^\n]*/g, '')                      // comentários de linha
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    // Os blocos com NOME (`$m$ … $m$`, `$f$ … $f$`) saem: o `$m$` é texto de
    // um documento e o `$f$` é SQL montado dentro de `format()`, que não sei
    // resolver sem correr o código.
    //
    // Os `$$ … $$` FICAM. É lá dentro que vive o plpgsql — e foi lá dentro
    // que estavam os quatro `select id, user_id from organizations` que
    // rebentaram. A primeira versão disto apagava-os e conferia 16 colunas em
    // vez de duzentas: uma guarda que não olha para onde estão os erros.
    .replace(/\$([a-z]+)\$[\s\S]*?\$\1\$/gi, m => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:[^']|'')*'/g, m => m.replace(/[^\n]/g, ' '))   // literais
}

const linhaDe = (sql, i) => sql.slice(0, i).split('\n').length

/* ── O que cada migração ACRESCENTA ao esquema ────────────────────────────── */
/**
 * O que a migração cria, COM A POSIÇÃO onde o cria.
 *
 * A posição importa: uma migração cria uma tabela e indexa-a três linhas
 * abaixo — isso é normal e não é erro. Erro é usar uma tabela que ainda não
 * foi criada por ninguém, nem aqui acima nem numa migração anterior.
 *
 * A primeira versão aplicava tudo só no FIM de cada ficheiro, e por isso
 * acusava todos os índices de todas as tabelas novas. Trinta falsos positivos.
 */
function criacoes(sql) {
  const fora = []
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\n\s*\)\s*;/gi)) {
    const cols = new Set()
    for (const c of m[2].matchAll(/^\s{2,}"?([a-z_][a-z0-9_]*)"?\s+[a-z]/gim)) cols.add(c[1].toLowerCase())
    fora.push({ i: m.index, tabela: m[1].toLowerCase(), cols, substitui: true })
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
    fora.push({ i: m.index, tabela: m[1].toLowerCase(), cols: new Set([m[2].toLowerCase()]), substitui: false })
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+"?([a-z_][a-z0-9_]*)"?\s+as\s+select\s([\s\S]*?)\sfrom\s/gi)) {
    const cols = new Set()
    for (let c of m[2].split(',')) {
      c = c.trim().split(/\s+as\s+/i).pop().trim()
      const nome = c.includes('.') ? c.split('.').pop() : c
      if (/^[a-z_][a-z0-9_]*$/i.test(nome)) cols.add(nome.toLowerCase())
    }
    fora.push({ i: m.index, tabela: m[1].toLowerCase(), cols, substitui: true })
  }
  return fora.sort((a, b) => a.i - b.i)
}

/** Junta uma criação ao esquema. */
function aplicarUma(c, esquema) {
  if (c.substitui) esquema.set(c.tabela, new Set(c.cols))
  else {
    if (!esquema.has(c.tabela)) esquema.set(c.tabela, new Set())
    for (const x of c.cols) esquema.get(c.tabela).add(x)
  }
}

/* ── As referências a verificar ───────────────────────────────────────────── */
function referencias(sql) {
  const fora = []
  const add = (tabela, colunas, i, o) =>
    fora.push({ tabela: tabela.toLowerCase(), colunas, i, o })

  // select a, b from tabela   (sem join, sem subconsulta na lista)
  for (const m of sql.matchAll(/\bselect\s+((?!\*)[a-z_][a-z0-9_,\s]*?)\s+from\s+"?([a-z_][a-z0-9_]*)"?(?!\s*\()/gi)) {
    const lista = m[1].trim()
    if (/\b(select|case|distinct|count|sum|max|min)\b/i.test(lista)) continue
    // `revoke select on X from anon` e `grant select on X to y` não são
    // consultas — o `anon` não é uma tabela.
    if (/\b(revoke|grant)\b/i.test(sql.slice(Math.max(0, m.index - 40), m.index))) continue
    add(m[2], lista.split(',').map(x => x.trim()).filter(Boolean), m.index, 'select')
  }
  // insert into tabela (a, b, c)
  for (const m of sql.matchAll(/insert\s+into\s+"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)/gi)) {
    add(m[1], m[2].split(',').map(x => x.trim().replace(/"/g, '')).filter(Boolean), m.index, 'insert')
  }
  // update tabela set col = ...
  for (const m of sql.matchAll(/update\s+"?([a-z_][a-z0-9_]*)"?\s+set\s+([a-z_][a-z0-9_]*)\s*=/gi)) {
    add(m[1], [m[2]], m.index, 'update')
  }
  // create index ... on tabela (cols)
  for (const m of sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[a-z_][a-z0-9_]*\s+on\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^)]*)\)/gi)) {
    const cols = m[2].split(',')
      .map(x => x.trim().replace(/\s+(asc|desc)$/i, '').replace(/"/g, ''))
      // `lower(nome)` e `coalesce(turno,'-')` — a coluna está lá dentro.
      .map(x => { const f = /^[a-z_]+\(\s*([a-z_][a-z0-9_]*)/i.exec(x); return f ? f[1] : x })
      .filter(x => /^[a-z_][a-z0-9_]*$/i.test(x))
    add(m[1], cols, m.index, 'index')
  }
  // references tabela(coluna)
  for (const m of sql.matchAll(/references\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(\s*"?([a-z_][a-z0-9_]*)"?\s*\)/gi)) {
    if (m[1].toLowerCase() === 'users') continue     // auth.users, fora do esquema público
    add(m[1], [m[2]], m.index, 'references')
  }
  return fora
}

/* ── A sintaxe fecha? ─────────────────────────────────────────────────────── */
/**
 * Delimitadores por fechar.
 *
 * Um `$$` a mais, um parêntese a menos ou um `begin` sem `end` faz o Postgres
 * recusar o ficheiro INTEIRO, muitas vezes com uma mensagem que aponta para
 * uma linha muito à frente do sítio onde o erro está — e quem o corre fica a
 * olhar para SQL que parece bem.
 *
 * Isto conta sobre o ficheiro cru (com os literais ainda lá), mas ignora
 * comentários: um `(` dentro de uma frase em português não conta.
 */
function sintaxe(bruto) {
  const problemas = []
  const semComentarios = bruto.replace(/--[^\n]*/g, '')

  // Os blocos com nome e os `$$` têm de vir aos pares.
  const marcas = [...semComentarios.matchAll(/\$([a-z]*)\$/gi)].map(m => m[1].toLowerCase())
  const porTipo = {}
  for (const m of marcas) porTipo[m] = (porTipo[m] || 0) + 1
  for (const [nome, n] of Object.entries(porTipo)) {
    if (n % 2) problemas.push(`o delimitador $${nome}$ aparece ${n} vezes — é ímpar, falta fechar um`)
  }

  // Os parênteses, fora dos literais e dos blocos com corpo.
  const sql = limpar(bruto)
  let abertos = 0
  for (const c of sql) {
    if (c === '(') abertos++
    else if (c === ')') abertos--
    if (abertos < 0) { problemas.push('fecha-se um parêntese que nunca foi aberto'); break }
  }
  if (abertos > 0) problemas.push(`${abertos} parêntese(s) por fechar`)

  // `do $$ ... end $$;` — tantos `begin` como `end`.
  const begins = (sql.match(/\bbegin\b/gi) || []).length
  const ends = (sql.match(/\bend\b/gi) || []).length
  if (begins > ends) problemas.push(`${begins} «begin» para ${ends} «end»`)

  return problemas
}

/* ── A verificação ────────────────────────────────────────────────────────── */
const esquema = new Map([...ESQUEMA].map(([t, c]) => [t, new Set(c)]))
// `auth.users` e as tabelas do sistema não estão no OpenAPI mas existem.
const FORA_DO_ESQUEMA = new Set(['users', 'objects', 'buckets', 'pg_policies',
  'information_schema', 'pg_catalog', 'organizations_backup'])

const achados = []
let conferidas = 0

console.log(`Esquema real: ${ESQUEMA.size} tabelas.`)
console.log(`Migrações a simular, por ordem: ${pendentes.map(numero).join(' → ')}\n`)

for (const f of pendentes) {
  const bruto = fs.readFileSync(path.join('supabase', f), 'utf8')
  const sql = limpar(bruto)
  const daMigracao = []

  for (const x of sintaxe(bruto)) {
    daMigracao.push({ linha: 0, tabela: '', coluna: null, o: 'sintaxe', porque: x })
  }

  const porCriar = criacoes(sql)
  let jaCriadas = 0

  for (const r of referencias(sql).sort((a, b) => a.i - b.i)) {
    // Tudo o que esta migração cria ACIMA desta referência já conta.
    while (jaCriadas < porCriar.length && porCriar[jaCriadas].i < r.i) {
      aplicarUma(porCriar[jaCriadas++], esquema)
    }
    if (FORA_DO_ESQUEMA.has(r.tabela)) continue

    if (!esquema.has(r.tabela)) {
      // Uma tabela que nenhuma migração anterior criou. É o erro de ordem.
      daMigracao.push({
        linha: linhaDe(bruto, r.i), tabela: r.tabela, coluna: null, o: r.o,
        porque: 'a tabela não existe, e nenhuma migração anterior a cria',
      })
      continue
    }
    const cols = esquema.get(r.tabela)
    for (const c of r.colunas) {
      const nome = c.replace(/"/g, '').toLowerCase()
      if (!/^[a-z_][a-z0-9_]*$/.test(nome)) continue
      conferidas++
      if (!cols.has(nome)) {
        const parecidas = [...cols].filter(x =>
          x.includes(nome) || nome.includes(x)
          || (x.length > 3 && nome.length > 3 && x.slice(0, 4) === nome.slice(0, 4)))
        daMigracao.push({
          linha: linhaDe(bruto, r.i), tabela: r.tabela, coluna: nome, o: r.o,
          porque: 'a coluna não existe', parecidas: parecidas.slice(0, 3),
        })
      }
    }
  }

  // O que ficou por aplicar (criações depois da última referência).
  while (jaCriadas < porCriar.length) aplicarUma(porCriar[jaCriadas++], esquema)

  const marca = daMigracao.length ? '✗' : '✓'
  console.log(`${marca} ${f}${daMigracao.length ? `  — ${daMigracao.length} problema(s)` : ''}`)
  for (const d of daMigracao) {
    console.log(d.o === 'sintaxe'
      ? `    sintaxe: ${d.porque}`
      : `    linha ${d.linha} (${d.o}): ${d.tabela}${d.coluna ? '.' + d.coluna : ''} — ${d.porque}`)
    if (d.parecidas?.length) console.log(`      talvez: ${d.parecidas.join(', ')}`)
  }
  achados.push(...daMigracao.map(d => ({ ...d, f })))
}

console.log(`\n${conferidas} referência(s) a colunas conferidas.`)
if (!achados.length) {
  console.log('✓ Todas as migrações por correr referem tabelas e colunas que existirão quando lá chegarem.')
  process.exit(0)
}
console.log(`\n✗ ${achados.length} problema(s) em ${new Set(achados.map(a => a.f)).size} ficheiro(s).`)
console.log('O editor do Supabase corre cada ficheiro numa transação: um erro a meio')
console.log('e NADA é aplicado.')
process.exit(1)
