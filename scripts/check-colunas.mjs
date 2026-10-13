// scripts/check-colunas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Toda a coluna que o código nomeia existe mesmo na base de dados?
//
// ── PORQUE E QUE ISTO EXISTE ────────────────────────────────────────────────
// O PostgREST recusa a consulta INTEIRA quando uma unica coluna do `select`
// nao existe. Nao devolve as outras: devolve `data: null` e um erro que quase
// todo o codigo ignora — e `data: null` e indistinguivel de «nao ha linhas».
//
// Resultado: a fonte desaparece do ecra, sem erro visivel, e ninguem da por
// isso. Num calendario faltam as consultas. Num painel falta uma secao. Numa
// ronda faltam os avisos todos.
//
// Em 2026-09-27, numa sessao, isto aconteceu TRES vezes:
//   • `appointments.specialty`  — a coluna chama-se `speciality`, a inglesa
//   • `documents.title`         — chama-se `name`
//   • `plano_acoes.patient_id`  — nao existe; o plano pende dos objetivos
//
// As tres foram apanhadas a mao, uma a uma, porque me lembrei de conferir.
// Esta guarda passa a conferi-las todas.
//
// ── COMO ────────────────────────────────────────────────────────────────────
// O esquema real vem do proprio PostgREST (`GET /rest/v1/` devolve um OpenAPI
// com todas as tabelas e colunas). O codigo e lido com uma expressao que apanha
// `from('x')...select('a, b, c')`, incluindo os selects embutidos `foo(bar)`.
//
// ── O QUE ELA NAO APANHA, E PORQUE ESTA BEM ────────────────────────────────
// Selects montados em variaveis, colunas em template strings, e `select('*')`.
// Sao poucos e o `*` e seguro por definicao. Vale mais uma guarda que apanha
// 90% e nunca grita em falso do que uma que tenta apanhar tudo e e ignorada.
//
//   node scripts/check-colunas.mjs
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

/* ── O esquema real ───────────────────────────────────────────────────────── */
const spec = await fetch(`${U}/rest/v1/`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  .then(r => r.json())
const defs = spec.definitions || spec.components?.schemas || {}
const COLUNAS = new Map(
  Object.entries(defs).map(([t, d]) => [t, new Set(Object.keys(d.properties || {}))]),
)
if (!COLUNAS.size) { console.error('Não consegui ler o esquema do PostgREST.'); process.exit(1) }

/* ── O que as migrações POR CORRER vão acrescentar ────────────────────────── */
// Sem isto, a guarda fica permanentemente vermelha em cima de código que está
// certo e só espera um SQL — e uma guarda sempre vermelha passa a ser ignorada,
// que é a única maneira de uma guarda deixar de servir para nada.
//
// Lê-se o SQL de `supabase/` à procura de `add column if not exists X` e de
// `create table X (...)`. O que estiver nessas listas e não no esquema real é
// reportado à parte, como aviso, e não faz a guarda falhar.
// ── O PREFIXO `public.` ─────────────────────────────────────────────────────
// As duas expressoes acima aceitam `public.tabela` tambem. Sem isso, uma
// migracao escrita `alter table public.org_members add column ...` — que e
// como as mais recentes se escrevem — era INVISIVEL para esta guarda: ela
// capturava `public` como nome da tabela, nao encontrava o `add column` a
// seguir, e dava a coluna por inexistente. Apanhei-o a acrescentar o
// `perfil_acesso_id` no sprint181.
const POR_CORRER = new Map()   // tabela -> Set de colunas prometidas
const TABELAS_NOVAS = new Set()
for (const f of fs.readdirSync('supabase').filter(x => x.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join('supabase', f), 'utf8')
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
    const t = m[1].toLowerCase()
    if (!POR_CORRER.has(t)) POR_CORRER.set(t, new Set())
    POR_CORRER.get(t).add(m[2].toLowerCase())
  }
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\n\)/gi)) {
    const t = m[1].toLowerCase()
    TABELAS_NOVAS.add(t)
    if (!POR_CORRER.has(t)) POR_CORRER.set(t, new Set())
    for (const c of m[2].matchAll(/^\s{2,}"?([a-z_][a-z0-9_]*)"?\s+[a-z]/gim)) {
      POR_CORRER.get(t).add(c[1].toLowerCase())
    }
  }
}
// ── Os ciclos EM MASSA, que não nomeiam tabela nenhuma ─────────────────────
// Duas migrações por correr acrescentam a mesma coluna a MUITAS tabelas de uma
// vez, por `execute format('alter table public.%I add column …')` sobre uma
// consulta ao `information_schema`. Nenhuma expressão regular vê isso, e por
// isso a guarda acusava doze colunas que estão certas e só esperam o SQL.
//
// Doze acusações falsas é o número a partir do qual se deixa de ler a lista —
// e foi quase o que aconteceu.
//
//   sprint169 → `recorded_by_id` em TODAS as tabelas que tenham `org_id`
//   sprint170 → `responsavel_id` + `responsavel` numa lista de nomes que ESTÁ
//               escrita no ficheiro, e que por isso se consegue ler
const TODO_O_SQL = fs.readdirSync('supabase').filter(x => x.endsWith('.sql'))
  .map(f => fs.readFileSync(path.join('supabase', f), 'utf8')).join('\n')

/** `recorded_by_id` chega a tudo o que tem `org_id`. */
const RECORDED_EM_MASSA = /add column if not exists recorded_by_id/.test(TODO_O_SQL)
  && /execute format/.test(TODO_O_SQL)
  && /column_name = 'org_id'/.test(TODO_O_SQL)

// Um ciclo sobre uma LISTA DE NOMES escrita no ficheiro:
//
//     foreach t in array array['a', 'b', 'c']
//     loop
//       execute format('alter table public.%I add column if not exists x …', t);
//     end loop;
//
// Aqui os nomes estão lá e leem-se. Cada tabela da lista fica a dever cada
// coluna que o corpo do ciclo acrescenta.
for (const f of fs.readdirSync('supabase').filter(x => x.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join('supabase', f), 'utf8')
  for (const ciclo of sql.matchAll(
    /foreach\s+\w+\s+in\s+array\s+array\s*\[([\s\S]*?)\]([\s\S]*?)end\s+loop/gi)) {
    const nomes = [...ciclo[1].matchAll(/'([a-z_][a-z0-9_]*)'/g)].map(m => m[1])
    const colunas = [...ciclo[2].matchAll(/add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)/gi)]
      .map(m => m[1].toLowerCase())
    if (!nomes.length || !colunas.length) continue
    for (const t of nomes) {
      if (!POR_CORRER.has(t)) POR_CORRER.set(t, new Set())
      for (const c of colunas) POR_CORRER.get(t).add(c)
    }
  }
}

const temOrgIdReal = (t) => COLUNAS.get(t)?.has('org_id') ?? false

const prometida = (t, c) => {
  const col = c.toLowerCase()
  if (POR_CORRER.get(t)?.has(col)) return true
  // O único ciclo que não nomeia ninguém: o do sprint169.
  if (col === 'recorded_by_id' && RECORDED_EM_MASSA && temOrgIdReal(t)) return true
  return false
}

/* ── Os ficheiros ─────────────────────────────────────────────────────────── */
const ficheiros = []
;(function andar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) andar(p)
    else if (/\.(ts|tsx)$/.test(e.name)) ficheiros.push(p)
  }
})('.')

/* ── Encontrar os selects ─────────────────────────────────────────────────── */
// `from('tabela')` seguido, no MESMO encadeamento, de `select('...')`.
const PADRAO = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)([\s\S]{0,250}?)\.select\(\s*(['"])([^'"]*)\3/g
/* ── E os FILTROS ──────────────────────────────────────────────────────────
   `from('appointments')…eq('profile_id', x)`.

   Isto nasceu de um achado: a `lib/caregiverSentinel.ts` filtrava a
   `appointments` por `profile_id`, que essa tabela nao tem — tem `user_id` e
   `patient_id`. O PostgREST responde 400 ao pedido INTEIRO, e a chamada
   estava dentro de um `tol()` que engole o erro. Resultado: um 400 em todas
   as visitas a /familia, durante meses, sem ninguem dar por isso.

   Um filtro numa coluna que nao existe e PIOR do que um select mau: o select
   devolve vazio e alguem estranha; o filtro rebenta o pedido todo, e o padrao
   `tol`/`safe` que esta aplicacao usa por toda a parte transforma isso em
   silencio. */
const FILTROS = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)([\s\S]{0,400}?)\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|overlaps|order)\(\s*(['"])([a-z_][a-z0-9_.]*)\4/g

/**
 * Há uma fronteira de instrução entre o `from()` e o `select()`?
 *
 * Isto não é enfeite. A primeira versão desta guarda aceitava 400 caracteres
 * de qualquer coisa entre os dois, e isso fazia casar o `from()` de uma
 * instrução com o `select()` da instrução SEGUINTE. Deu 22 falsos positivos
 * de uma vez — um `update({...})` numa tabela e, quatro linhas abaixo, um
 * `select()` noutra.
 *
 * Uma guarda que grita em falso é uma guarda que se passa a ignorar, e a
 * partir daí não serve para nada.
 */
const outraInstrucao = (meio) =>
  /;|\bawait\b|\bconst\b|\blet\b|\breturn\b|\bfunction\b|=>|\.from\(/.test(meio)

/** As colunas de um select, incluindo as que vêm dentro de `tabela(col, col)`. */
function colunasDe(texto) {
  const fora = []
  // Os embutidos tratam-se à parte: `patients(id, name)` refere-se a OUTRA
  // tabela, e conferi-los aqui dava falsos positivos.
  const semEmbutidos = texto.replace(/[a-z_][a-z0-9_]*\s*(?:!\w+)?\s*\([^)]*\)/gi, '')
  for (let bruto of semEmbutidos.split(',')) {
    let c = bruto.trim()
    if (!c || c === '*') continue
    // `alias:coluna` → a coluna é a da direita.
    if (c.includes(':')) c = c.split(':').pop().trim()
    // `coluna->>campo` (jsonb) → a coluna é a da esquerda.
    c = c.split('->')[0].trim()
    c = c.replace(/::[a-z]+$/i, '').trim()
    if (!/^[a-z_][a-z0-9_]*$/i.test(c)) continue
    fora.push(c)
  }
  return fora
}

/* ── E as ESCRITAS ────────────────────────────────────────────────────────── */
// `insert({ a: 1, b: 2 })` e `update({ ... })`. Uma escrita numa coluna que
// não existe é PIOR do que uma leitura: a leitura devolve vazio e alguém
// estranha; a escrita falha com 400 e — em todo o sítio que não lê o `error` —
// o ecrã diz que guardou.
//
// Só se conferem as chaves ESCRITAS À LETRA. Um `...scope.stamp(x)` ou um
// `...paraColunas(f)` não se resolvem sem correr o código, e adivinhá-los
// dava falsos positivos.
// Só se apanha até ao `{` que abre o objeto; o resto lê-se a contar chaves.
//
// A primeira versão tentava apanhar o objeto inteiro com uma expressão lazy
// (`\{([\s\S]{0,1200}?)\}`), e isso parava no PRIMEIRO `}` seguido de `)` —
// que num objeto com outro objeto lá dentro é o do objeto de dentro. Capturava
// um pedaço a cavalo entre os dois e acusava as chaves do jsonb como se fossem
// colunas: cinco falsos positivos no importador de análises, onde `value` e
// `unit` vivem dentro da coluna `values`.
const ESCRITA = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)((?:[^;{}]|\n){0,120}?)\.(insert|update|upsert)\(\s*(?:scope\.stamp\(\s*)?\{/g

/** O objeto que começa em `abre` (o índice do `{`), a contar chaves. */
function objetoEm(src, abre) {
  let n = 0
  for (let i = abre; i < src.length && i < abre + 4000; i++) {
    if (src[i] === '{') n++
    else if (src[i] === '}') { n--; if (!n) return src.slice(abre + 1, i) }
  }
  return null
}

/**
 * As chaves de PRIMEIRO NÍVEL de um objeto — as que são colunas.
 *
 * As de dentro de um objeto aninhado são campos de um jsonb, não colunas, e
 * acusá-las era exatamente o falso positivo de cima.
 */
function chavesDe(corpo) {
  if (corpo === null) return []
  // Esvaziar o que está aninhado (objetos, arrays, chamadas) de dentro para
  // fora, até só sobrar o primeiro nível.
  let plano = corpo
  for (let i = 0; i < 8; i++) {
    const antes = plano
    plano = plano.replace(/\{[^{}]*\}/g, '0').replace(/\[[^[\]]*\]/g, '0')
      .replace(/\(([^()]*)\)/g, '0')
    if (plano === antes) break
  }
  const fora = []
  for (const m of plano.matchAll(/(?:^|,)\s*([a-z_][a-z0-9_]*)\s*:/gi)) fora.push(m[1])
  return fora
}

const achados = []
/**
 * O codigo sem os comentarios.
 *
 * A nota que explica por que motivo uma coluna errada saiu do codigo contem,
 * quase sempre, a LINHA ERRADA como exemplo. Sem isto, a guarda le o exemplo
 * e acusa-o — e quem documentou o erro e punido por o ter documentado.
 * Aconteceu-me no minuto a seguir a acrescentar a verificacao dos filtros: o
 * comentario que escrevi a explicar o `appointments.profile_id` foi o
 * primeiro «achado».
 *
 * Substitui-se por espacos do mesmo tamanho para os numeros de linha nao
 * saltarem.
 */
function semComentarios(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:/])\/\/[^\n]*/g, (c, p) => p + ' '.repeat(c.length - p.length))
}

let conferidos = 0, selects = 0, escritas = 0, filtros = 0

for (const f of ficheiros) {
  const src = semComentarios(fs.readFileSync(f, 'utf8'))

  for (const m of src.matchAll(ESCRITA)) {
    const [inteiro, tabela, meio, verbo] = m
    if (!COLUNAS.has(tabela) || outraInstrucao(meio)) continue
    const corpo = objetoEm(src, m.index + inteiro.length - 1)
    if (corpo === null) continue
    escritas++
    const doEsquema = COLUNAS.get(tabela)
    const linha = src.slice(0, m.index).split('\n').length

    // `scope.stamp()` não é só o objeto que lá está escrito: acrescenta
    // `user_id`, `org_id` e `recorded_by_id` por baixo do pano.
    //
    // Essa última não existia em ONZE tabelas novas, e o PostgREST recusa a
    // escrita INTEIRA por causa dela. É assim que «as etiquetas não
    // funcionam» — e a inscrição, e o calendário, e os modelos.
    //
    // Esta guarda deixou passar isso porque só olhava para as chaves escritas
    // à letra. Uma guarda que não conhece o que o código acrescenta sozinho
    // não está a olhar para o que vai mesmo na escrita.
    const doStamp = /scope\.stamp\(/.test(inteiro)
      ? ['user_id', 'org_id', 'recorded_by_id'] : []

    for (const c of new Set([...chavesDe(corpo), ...doStamp])) {
      conferidos++
      if (!doEsquema.has(c)) {
        const parecidas = [...doEsquema].filter(x =>
          x.includes(c) || c.includes(x)
          || (x.length > 4 && c.length > 4 && x.slice(0, 4) === c.slice(0, 4)))
        achados.push({ f, linha, tabela, coluna: c, verbo, parecidas: parecidas.slice(0, 3), espera: prometida(tabela, c) })
      }
    }
  }

  for (const m of src.matchAll(FILTROS)) {
    const [, tabela, meio, verbo, , coluna] = m
    if (!COLUNAS.has(tabela)) continue
    if (outraInstrucao(meio)) continue
    // `tabela.coluna` refere-se a uma tabela embutida — nao se confere aqui.
    if (coluna.includes('.')) continue
    filtros++
    conferidos++
    const doEsquema = COLUNAS.get(tabela)
    if (!doEsquema.has(coluna)) {
      const linha = src.slice(0, m.index).split(String.fromCharCode(10)).length
      const parecidas = [...doEsquema].filter(x =>
        x.includes(coluna) || coluna.includes(x)
        || (x.length > 4 && coluna.length > 4 && x.slice(0, 4) === coluna.slice(0, 4)))
      achados.push({ f, linha, tabela, coluna, verbo: '.' + verbo + '()', parecidas: parecidas.slice(0, 3), espera: prometida(tabela, coluna) })
    }
  }

  for (const m of src.matchAll(PADRAO)) {
    const [inteiro, tabela, meio, , lista] = m
    if (!COLUNAS.has(tabela)) continue          // tabela de uma migração por correr
    if (lista.trim() === '*' || !lista.trim()) continue
    if (outraInstrucao(meio)) continue          // o select é de outra consulta
    selects++
    const doEsquema = COLUNAS.get(tabela)
    const linha = src.slice(0, m.index).split('\n').length
    for (const c of colunasDe(lista)) {
      conferidos++
      if (!doEsquema.has(c)) {
        // Talvez exista com outro nome parecido — dizê-lo poupa a procura.
        const parecidas = [...doEsquema].filter(x =>
          x.includes(c) || c.includes(x)
          || (x.length > 4 && c.length > 4 && x.slice(0, 4) === c.slice(0, 4)))
        achados.push({ f, linha, tabela, coluna: c, verbo: 'select', parecidas: parecidas.slice(0, 3), espera: prometida(tabela, c) })
      }
    }
  }
}

console.log(`${selects} leitura(s), ${escritas} escrita(s) e ${filtros} filtro(s) com colunas nomeadas — ${conferidos} coluna(s) conferidas em ${ficheiros.length} ficheiro(s).`)
console.log(`${COLUNAS.size} tabelas no esquema real.\n`)

const aEsperar = achados.filter(a => a.espera)
const erros = achados.filter(a => !a.espera)

if (aEsperar.length) {
  console.log(`${aEsperar.length} coluna(s) que uma migração ESCRITA acrescenta — código certo, SQL por correr:\n`)
  for (const a of aEsperar) {
    console.log(`  · ${a.tabela}.${a.coluna}  (${a.verbo})  ${a.f.replace(/\\/g, '/')}:${a.linha}`)
  }
  console.log('')
}

if (!erros.length) {
  console.log('✓ Toda a coluna que o código nomeia existe na base de dados,')
  console.log('  ou é acrescentada por uma migração que já está escrita.')
  process.exit(0)
}

console.log('Colunas nomeadas que não existem em sítio nenhum — nem no esquema, nem numa migração:\n')
for (const a of erros) {
  console.log(`✗ ${a.f.replace(/\\/g, '/')}:${a.linha}`)
  console.log(`    ${a.tabela}.${a.coluna} não existe  (${a.verbo})`)
  if (a.parecidas.length) console.log(`    talvez: ${a.parecidas.join(', ')}`)
}
console.log(`\n${erros.length} coluna(s) inexistentes.`)
console.log('Numa LEITURA, o PostgREST recusa a consulta inteira e devolve `data: null`,')
console.log('que é indistinguível de «não há linhas»: a fonte desaparece do ecrã.')
console.log('Numa ESCRITA é pior — falha com 400 e, onde ninguém lê o `error`, o ecrã')
console.log('diz que guardou.')
process.exit(1)
