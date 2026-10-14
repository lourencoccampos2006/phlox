#!/usr/bin/env node
// scripts/check-capacidades.mjs
// ─────────────────────────────────────────────────────────────────────────────
// AS PERMISSÕES DO TYPESCRIPT E AS DA BASE DE DADOS SÃO AS MESMAS?
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Porque uma vez não foram, durante oito dias, e ninguém deu por isso.
//
// A 6 de outubro a área `qualidade` ganhou `editar` em `lib/permissoes.ts`. A
// função `default_capabilities()` do SQL — uma cópia à mão das mesmas regras —
// ficou como estava. A partir daí a aplicação mostrava o botão de criar um
// inquérito e a base de dados devolvia
//
//     403  new row violates row-level security policy "inqueritos_area_criar"
//
// a TODA A GENTE, incluindo ao dono da casa. A página engolia o erro numa
// frase genérica e o diagnóstico foi, três vezes seguidas, «falta correr uma
// migração» — que estava errado e não resolvia nada.
//
// Este guarda compara as duas. Com os dois lados escritos à mão, uma divergência
// é uma questão de tempo; com o SQL gerado e comparado, é um guarda vermelho.
//
// ── O QUE COMPARA ──────────────────────────────────────────────────────────
//  1. O ficheiro gerado (supabase/sprint184_*) contra o que o
//     `lib/permissoes.ts` produziria HOJE — apanha quem mude o TypeScript e
//     não gere a migração.
//  2. Com `--base-de-dados`, o que a função devolve MESMO no Supabase —
//     apanha a migração escrita e não corrida, que é o outro lado do mesmo
//     problema.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs \
//        scripts/check-capacidades.mjs [--base-de-dados]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs'
import { PAPEIS, permissoesDe } from '../lib/permissoes.ts'
import { corpoDaFuncao } from './gerar-capacidades.mjs'

const FICHEIRO = 'supabase/sprint184_capacidades_geradas.sql'
let falhas = 0

/* ── 1. O ficheiro gerado está em dia? ────────────────────────────────────── */
if (!existsSync(FICHEIRO)) {
  console.error(`✗ Falta ${FICHEIRO}.`)
  console.error('  Gera-o: node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-capacidades.mjs --ficheiro')
  process.exit(1)
}

const noRepo = readFileSync(FICHEIRO, 'utf8')
const deveSer = corpoDaFuncao()

// Comparar o CORPO, não o ficheiro inteiro: o cabeçalho é prosa e pode mudar
// sem que as regras mudem.
const normalizar = s => s.replace(/\r\n/g, '\n').trim()
if (!normalizar(noRepo).includes(normalizar(deveSer))) {
  falhas++
  console.error(`\n✗ ${FICHEIRO} não corresponde ao lib/permissoes.ts.`)
  console.error('  Alguém mudou as permissões e não gerou a migração outra vez.')
  console.error('  Corrige com:')
  console.error('    node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/gerar-capacidades.mjs --ficheiro\n')

  // Dizer QUAL papel e QUAL capacidade, que é o que poupa meia hora.
  for (const p of PAPEIS) {
    const esperado = [...permissoesDe(p.id, null)].sort()
    const m = new RegExp(`when '${p.id}' then array\\[([^\\]]*)\\]`).exec(noRepo)
    const atual = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort() : []
    const aMais = atual.filter(c => !esperado.includes(c))
    const aMenos = esperado.filter(c => !atual.includes(c))
    if (aMais.length || aMenos.length) {
      console.error(`  ${p.id}:`)
      if (aMenos.length) console.error(`    falta no SQL:  ${aMenos.join(', ')}`)
      if (aMais.length) console.error(`    a mais no SQL: ${aMais.join(', ')}`)
    }
  }
}

/* ── 2. E a base de dados, tem a função nova? ─────────────────────────────── */
if (process.argv.includes('--base-de-dados')) {
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL
  const K = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!U || !K) {
    console.error('✗ Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  /* Chama-se a função por RPC. Se ela não estiver exposta, o PostgREST
     responde 404 — e isso NÃO é «as permissões estão certas», é «não sei».
     Dizer uma coisa pela outra era repetir o erro que este guarda existe para
     apanhar. */
  for (const p of PAPEIS) {
    const r = await fetch(`${U}/rest/v1/rpc/default_capabilities`, {
      method: 'POST',
      headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: p.id }),
    })
    if (!r.ok) {
      console.error(`\n✗ Não consegui perguntar à base de dados (${r.status}).`)
      console.error('  Sem resposta, não se sabe se bate certo — não se assume que sim.')
      falhas++
      break
    }
    const naBase = (await r.json() || []).sort()
    const esperado = [...permissoesDe(p.id, null)].sort()
    const aMenos = esperado.filter(c => !naBase.includes(c))
    const aMais = naBase.filter(c => !esperado.includes(c))
    if (aMenos.length || aMais.length) {
      falhas++
      console.error(`\n✗ Na base de dados, o papel '${p.id}' não bate certo:`)
      if (aMenos.length) console.error(`    em falta: ${aMenos.join(', ')}`)
      if (aMais.length) console.error(`    a mais:   ${aMais.join(', ')}`)
      console.error(`  Falta correr ${FICHEIRO} no Supabase.`)
    }
  }
}

if (falhas) process.exit(1)
console.log(`✓ As capacidades de ${PAPEIS.length} papéis são as mesmas no código e no SQL`
  + (process.argv.includes('--base-de-dados') ? ' e na base de dados.' : '.'))
