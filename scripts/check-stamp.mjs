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

const criada = t => new RegExp(`create table (?:if not exists )?${esc(t)}\\s*\\(`).test(sql)

const temColuna = t => {
  const cria = sql.match(new RegExp(`create table (?:if not exists )?${esc(t)}\\s*\\(([\\s\\S]*?)\\n\\);`))
  if (cria && cria[1].includes('recorded_by_id')) return true
  if (new RegExp(`alter table (?:if exists )?${esc(t)} add column if not exists recorded_by_id`).test(sql)) return true
  // uma constraint sobre a coluna prova que ela existe
  if (new RegExp(`alter table ${esc(t)} add constraint ${esc(t)}_recorded_by_id_fkey`).test(sql)) return true
  return false
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
