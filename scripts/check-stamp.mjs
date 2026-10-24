#!/usr/bin/env node
// scripts/check-stamp.mjs — impede que o bug do sprint124 volte pela terceira vez.
//
// `scope.stamp()` acrescenta SEMPRE `recorded_by_id` às escritas de contas com
// organização. Se a tabela não tiver essa coluna, o PostgREST rejeita o pedido
// inteiro — e a ferramenta falha só para contas institucionais, que é
// precisamente onde ninguém testa. Aconteceu em agosto de 2026 (sprint124: três
// ferramentas de uma vez) e outra vez em setembro (medication_prep_logs, com o
// erro "Não foi possível marcar" no /preparacao-medicacao).
//
// Este teste cruza cada tabela escrita com scope.stamp() contra o esquema das
// migrações. Ou a tabela tem a coluna, ou a escrita não pode usar o stamp.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function ficheiros(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== '.next') ficheiros(p, out) }
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}

// Tabelas onde o código chama .insert(scope.stamp(…)) / .upsert(scope.stamp(…)).
const tabelas = new Map()   // tabela → sítios no código
for (const f of ['app', 'components', 'lib'].flatMap(d => ficheiros(d))) {
  const linhas = readFileSync(f, 'utf8').split('\n')
  linhas.forEach((l, i) => {
    if (!/scope\.stamp\(/.test(l)) return
    // a tabela pode estar na mesma linha ou até quatro linhas acima
    for (let j = i; j >= Math.max(0, i - 4); j--) {
      const m = linhas[j].match(/from\('([a-z_]+)'\)/)
      if (m) {
        if (!tabelas.has(m[1])) tabelas.set(m[1], new Set())
        tabelas.get(m[1]).add(`${f}:${i + 1}`)
        break
      }
    }
  })
}

const sql = readdirSync('supabase').filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join('supabase', f), 'utf8')).join('\n')

// O `(?:public\.)?` importa: `create table public.inqueritos` é SQL normal, e
// sem ele a guarda não via a tabela a ser criada — e acusava uma escrita certa
// de escrever numa tabela que não existe.
const criada = t => new RegExp(`create table (?:if not exists )?(?:public\\.)?${esc(t)}\\s*\\(`).test(sql)

const temColuna = t => {
  const cria = sql.match(new RegExp(`create table (?:if not exists )?(?:public\\.)?${esc(t)}\\s*\\(([\\s\\S]*?)\\n\\);`))
  if (cria && cria[1].includes('recorded_by_id')) return true
  /* `\s+` e não um espaço: um `alter table public.sad_planos` seguido de quebra
     de linha e `add column …` na linha a seguir é SQL normal e bem formatado,
     e a guarda não o via. Deu um falso NEGATIVO em cima de uma migração
     escrita de propósito para a satisfazer — a correção estava feita e a
     guarda continuava vermelha, que é a maneira mais rápida de ela deixar de
     ser lida. */
  if (new RegExp(`alter table (?:if exists )?(?:public\\.)?${esc(t)}\\s+add column if not exists recorded_by_id`).test(sql)) return true
  // uma constraint sobre a coluna prova que ela existe
  if (new RegExp(`alter table ${esc(t)} add constraint ${esc(t)}_recorded_by_id_fkey`).test(sql)) return true
  // ── O CICLO EM MASSA DO sprint169 ────────────────────────────────────────
  // O sprint169 não nomeia tabela nenhuma: percorre TODAS as tabelas que têm
  // `org_id` e que ainda não têm `recorded_by_id`, e acrescenta-a por
  // `execute format(...)`. Nenhuma expressão regular vê isso, e por isso a
  // guarda acusava oito escritas que estão certas e só esperam o SQL.
  //
  // Uma guarda que grita em falso durante sete sessões deixa de ser lida — e
  // foi quase o que aconteceu: o `inqueritos` apareceu no meio de oito falsos
  // positivos e podia ter passado despercebido.
  //
  // O mesmo padrão já estava reconhecido em baixo, para o `org_id` do
  // sprint91. É a mesma ideia: a prova é a REGRA, e não o nome.
  // ── MAS UM CICLO EM MASSA É UMA FOTOGRAFIA, NÃO UMA REGRA (2026-10-20) ──
  // O ciclo do sprint169 correu UMA VEZ. Não toca nas tabelas criadas depois
  // dele — e o guarda passou a aceitá-lo como prova para qualquer tabela com
  // `org_id`, incluindo as que ainda nem existiam.
  //
  // Custou o módulo inteiro do apoio domiciliário: o `sad_planos` nasceu no
  // sprint183, catorze migrações depois do ciclo, sem `recorded_by_id`, e o
  // guarda deu verde. O PostgREST recusava TODAS as escritas com
  //
  //     400 PGRST204  Could not find the 'recorded_by_id' column
  //
  // Foi a terceira vez que este bug passou, e a primeira em que passou por
  // cima de um guarda escrito para o impedir.
  //
  // A regra passa a ser: o ciclo só prova as tabelas que JÁ EXISTIAM quando
  // ele correu. Uma tabela criada numa migração mais recente declara a coluna
  // ela própria.
  if (recordedEmMassa && temOrgId(t) && !nascidaDepoisDoCiclo(t)) return true
  return false
}

/** Há uma migração que dá `recorded_by_id` a todas as tabelas com `org_id`? */
const recordedEmMassa = /add column if not exists recorded_by_id/.test(sql)
  && /execute format/.test(sql)
  && /column_name = 'org_id'/.test(sql)

/** O número da migração onde o ciclo em massa vive. */
const numeroDoCiclo = (() => {
  for (const f of readdirSync('supabase').filter(x => x.endsWith('.sql')).sort()) {
    const t = readFileSync(join('supabase', f), 'utf8')
    if (/add column if not exists recorded_by_id/.test(t)
        && /execute format/.test(t) && /column_name = 'org_id'/.test(t)) {
      const n = f.match(/sprint(\d+)/)
      if (n) return +n[1]
    }
  }
  return null
})()

/** Em que migração é que esta tabela nasceu? */
function nascidaEm(t) {
  for (const f of readdirSync('supabase').filter(x => x.endsWith('.sql'))) {
    const texto = readFileSync(join('supabase', f), 'utf8')
    if (new RegExp(`create table (?:if not exists )?(?:public\\.)?${esc(t)}\\s*\\(`).test(texto)) {
      const n = f.match(/sprint(\d+)/)
      return n ? +n[1] : 0
    }
  }
  return 0
}

const nascidaDepoisDoCiclo = t =>
  numeroDoCiclo !== null && nascidaEm(t) > numeroDoCiclo

/** Esta tabela tem `org_id` — por criação, por ALTER, ou pelo ciclo do sprint91. */
function temOrgId(t) {
  const cria = sql.match(new RegExp(`create table (?:if not exists )?(?:public\\.)?${esc(t)}\\s*\\(([\\s\\S]*?)\\n\\);`))
  if (cria && cria[1].includes('org_id')) return true
  // O mesmo `\s+` da coluna acima: a quebra de linha é formatação, não semântica.
  if (new RegExp(`alter table (?:if exists )?(?:public\\.)?${esc(t)}\\s+add column if not exists org_id`).test(sql)) return true
  return new RegExp(`'${esc(t)}'`).test(sql)
    && /add column if not exists org_id/.test(sql)
    && /execute format/.test(sql)
}

const maus = []
let verificadas = 0
for (const [t, sitios] of tabelas) {
  if (!criada(t)) continue          // tabela que não é criada por nenhuma migração deste repo
  verificadas++
  if (!temColuna(t)) maus.push([t, [...sitios]])
}

if (maus.length) {
  console.error(`✗ ${maus.length} tabela(s) escritas com scope.stamp() sem a coluna recorded_by_id.`)
  console.error('  Em contas COM organização o PostgREST rejeita a escrita inteira — a ferramenta')
  console.error('  falha só para instituições, e parece funcionar em qualquer teste individual.')
  console.error('  Ou acrescenta a coluna numa migração, ou monta a linha à mão sem o stamp.\n')
  for (const [t, sitios] of maus) console.error(`  ${t}\n    ${sitios.join('\n    ')}`)
  process.exit(1)
}
console.log(`✓ As ${verificadas} tabelas escritas com scope.stamp() têm todas recorded_by_id.`)

// ── Segunda verificação: scope.filter() em tabelas sem org_id ──────────────
// Mesma família de bug. `scope.filter()` acrescenta `org_id = …` a contas com
// organização; numa tabela que não tenha essa coluna, o PostgREST responde
// "column does not exist" — e o código costuma ler isso como "migração em
// falta" e mostra um aviso de setup com a migração já aplicada. Foi o que
// aconteceu com support_recurring_logs (código PHX-L2 a aparecer sem razão).
const filtradas = new Map()
for (const f of ['app', 'components', 'lib'].flatMap(d => ficheiros(d))) {
  const linhas = readFileSync(f, 'utf8').split('\n')
  linhas.forEach((l, i) => {
    const m = l.match(/scope\.filter\(\s*supabase\.from\('([a-z_]+)'\)/)
    if (!m) return
    if (!filtradas.has(m[1])) filtradas.set(m[1], new Set())
    filtradas.get(m[1]).add(`${f}:${i + 1}`)
  })
}
const semOrg = []
for (const [t, sitios] of filtradas) {
  if (!criada(t)) continue
  const cria = sql.match(new RegExp(`create table (?:if not exists )?${esc(t)}\\s*\\(([\\s\\S]*?)\\n\\);`))
  // O org_id pode vir de três sítios: da criação da tabela, de um ALTER
  // direto, ou do ciclo em massa do sprint91 — que faz o ALTER por `execute
  // format(...)` sobre uma lista de nomes de tabela. Sem reconhecer esse
  // terceiro caso, este teste dava 20 falsos positivos.
  const emMassa = new RegExp(`'${esc(t)}'`).test(sql)
    && /add column if not exists org_id/.test(sql)
    && /execute format/.test(sql)
  const temOrg = (cria && cria[1].includes('org_id'))
    || new RegExp(`alter table (?:if exists )?(?:public\\.)?${esc(t)} add column if not exists org_id`).test(sql)
    || emMassa
  if (!temOrg) semOrg.push([t, [...sitios]])
}
if (semOrg.length) {
  console.error(`\n✗ ${semOrg.length} tabela(s) filtradas com scope.filter() sem coluna org_id.`)
  console.error('  Em contas COM organização a consulta rebenta com "column does not exist".')
  console.error('  Filtra à mão (a RLS já protege) ou acrescenta a coluna.\n')
  for (const [t, sitios] of semOrg) console.error(`  ${t}\n    ${sitios.join('\n    ')}`)
  process.exit(1)
}
console.log(`✓ As ${filtradas.size} tabelas usadas com scope.filter() têm todas org_id.`)
