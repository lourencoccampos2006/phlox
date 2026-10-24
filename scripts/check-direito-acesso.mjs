#!/usr/bin/env node
// scripts/check-direito-acesso.mjs
// ─────────────────────────────────────────────────────────────────────────────
// TODA A TABELA QUE GUARDA ALGO DE UMA PESSOA ESTÁ CLASSIFICADA?
//
// ── PORQUE É QUE ISTO EXISTE ────────────────────────────────────────────────
// Porque uma resposta incompleta a um direito de acesso não se vê de nenhum
// dos dois lados. A família recebe um documento com setenta blocos, lê-o, e
// não tem como saber que faltam três. A casa entrega-o convencida de que
// entregou tudo. É um incumprimento silencioso do art. 15.º — e o tipo de
// defeito que só aparece quando a CNPD pergunta.
//
// A `/api/dados-do-utente` NÃO tem lista de tabelas: pergunta ao esquema quais
// têm `patient_id`. Isso resolve metade — nenhuma tabela nova é esquecida.
// A outra metade é esta guarda: uma tabela nova com `patient_id` tem de estar
// numa atividade do registo do art. 30.º (`lib/ropa.ts`), senão sai no
// documento debaixo de «ainda não classificado», que é honesto mas pobre.
//
// E confere o contrário: uma exclusão (`FORA`) ou uma marca de terceiros
// (`PODE_NOMEAR_TERCEIROS`) de uma tabela que já não existe é lixo que faz
// perder tempo a quem ler as listas a sério.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/check-direito-acesso.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import {
  FORA, PODE_NOMEAR_TERCEIROS, SOBRE_A_CONTA, NUNCA_SAI,
} from '../lib/direitoDeAcesso.ts'
import { ATIVIDADES } from '../lib/ropa.ts'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!U || !K) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1) }

const spec = await fetch(`${U}/rest/v1/`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  .then(r => r.json())
const defs = spec.definitions || spec.components?.schemas || {}

const TODAS = new Set(Object.keys(defs))

/* ── «NÃO EXISTE» NÃO É O MESMO QUE «AINDA NÃO EXISTE» ─────────────────────
   Uma tabela que o código já cita e que só existe numa migração por aplicar
   não está morta: está à espera de quem corre o SQL. Tratá-las igual punha
   esta guarda vermelha a cada tabela nova, desde o dia em que se escreve a
   migração até ao dia em que alguém a corre — e uma guarda que está sempre
   vermelha deixa de ser lida. Estas viram aviso, com o nome do ficheiro. */
const POR_APLICAR = new Map()
for (const f of fs.readdirSync('supabase').filter(n => n.endsWith('.sql'))) {
  const sql = fs.readFileSync(`supabase/${f}`, 'utf8')
  for (const m of sql.matchAll(/create table if not exists (?:public\.)?([a-z_0-9]+)/gi)) {
    if (!TODAS.has(m[1])) POR_APLICAR.set(m[1], f)
  }
}
const avisos = []
const deVerdadeMorta = t => {
  if (TODAS.has(t)) return false
  if (POR_APLICAR.has(t)) { avisos.push(`${t} — criada em ${POR_APLICAR.get(t)}, por aplicar`); return false }
  return true
}
const COM_UTENTE = Object.entries(defs)
  .filter(([, d]) => Object.keys(d?.properties || {}).includes('patient_id'))
  .map(([t]) => t)
  .sort()

const falhas = []

/* ── 1. Toda a tabela com `patient_id` está numa atividade, ou excluída ──── */
const emAtividades = new Set(ATIVIDADES.flatMap(a => a.tabelas))
const orfas = COM_UTENTE.filter(t => !emAtividades.has(t) && !(t in FORA))
if (orfas.length) {
  falhas.push(
    `${orfas.length} tabela(s) guardam dados de um utente e não estão em atividade nenhuma\n`
    + `      do registo de tratamentos, nem na lista de exclusões:\n\n`
    + orfas.map(t => `        ${t}`).join('\n')
    + `\n\n      Saem no documento do art. 15.º debaixo de «ainda não classificado».`
    + `\n      Ou entram numa atividade de lib/ropa.ts, ou entram em FORA com a razão.`)
}

/* ── 2. Nenhuma exclusão aponta para uma tabela que já não existe ────────── */
const foraMortas = Object.keys(FORA).filter(t => !TODAS.has(t))
if (foraMortas.length) {
  falhas.push(
    `${foraMortas.length} exclusão(ões) em FORA apontam para tabelas que já não existem:\n`
    + foraMortas.map(t => `        ${t}`).join('\n'))
}

/* ── 3. Nem exclui o que nem sequer tem `patient_id` ─────────────────────── */
const comUtente = new Set(COM_UTENTE)
const foraSemUtente = Object.keys(FORA).filter(t => TODAS.has(t) && !comUtente.has(t))
if (foraSemUtente.length) {
  falhas.push(
    `${foraSemUtente.length} exclusão(ões) em FORA são de tabelas SEM \`patient_id\` —\n`
    + `      nunca entrariam no documento, e a linha só faz perder tempo a quem leia:\n`
    + foraSemUtente.map(t => `        ${t}`).join('\n'))
}

/* ── 4. As marcas de terceiros apontam para tabelas reais ────────────────── */
const terceirosMortas = [...PODE_NOMEAR_TERCEIROS].filter(deVerdadeMorta)
if (terceirosMortas.length) {
  falhas.push(
    `${terceirosMortas.length} marca(s) de «pode nomear terceiros» apontam para tabelas\n`
    + `      que já não existem:\n`
    + terceirosMortas.map(t => `        ${t}`).join('\n'))
}

/* ── 5. Uma tabela não pode estar excluída E marcada ─────────────────────── */
const ambas = [...PODE_NOMEAR_TERCEIROS].filter(t => t in FORA)
if (ambas.length) {
  falhas.push(
    `${ambas.length} tabela(s) estão ao mesmo tempo em FORA e em PODE_NOMEAR_TERCEIROS.\n`
    + `      A marca nunca se aplica, porque a tabela não entra:\n`
    + ambas.map(t => `        ${t}`).join('\n'))
}

/* ── 6. Toda a exclusão traz uma razão a sério ───────────────────────────── */
for (const [t, razao] of Object.entries(FORA)) {
  if (!razao || razao.trim().length < 25) {
    falhas.push(`a exclusão de \`${t}\` não traz razão suficiente: «${razao}»`)
  }
}

/* ── 7. A lista branca do art. 20.º aponta para tabelas reais ───────────── */
// Estas sao as UNICAS que saem para quem trabalha numa casa. Uma entrada que
// nao exista no esquema e uma promessa que nunca se cumpre — e ninguem da por
// isso, porque o que falta num ficheiro de exportacao nao faz barulho.
const COM_USER = new Set(
  Object.entries(defs)
    .filter(([, d]) => Object.keys(d?.properties || {}).includes('user_id'))
    .map(([t]) => t))

for (const t of Object.keys(SOBRE_A_CONTA)) {
  if (!TODAS.has(t)) {
    falhas.push(`SOBRE_A_CONTA nomeia \`${t}\`, que nao existe no esquema.`)
    continue
  }
  // O `profiles` e a excecao conhecida: a coluna da pessoa la chama-se `id`.
  if (t !== 'profiles' && !COM_USER.has(t)) {
    falhas.push(
      `SOBRE_A_CONTA nomeia \`${t}\`, que nao tem \`user_id\` — a consulta
`
      + `      \`.eq('user_id', ...)\` falha e a tabela sai sempre vazia, sem erro visivel.`)
  }
  if (t in NUNCA_SAI) {
    falhas.push(
      `\`${t}\` esta em SOBRE_A_CONTA E em NUNCA_SAI. O NUNCA_SAI ganha, por isso
`
      + `      a linha em SOBRE_A_CONTA promete uma coisa que nunca e entregue.`)
  }
  if (!SOBRE_A_CONTA[t] || SOBRE_A_CONTA[t].trim().length < 15) {
    falhas.push(`a entrada de \`${t}\` em SOBRE_A_CONTA nao diz o que e: «${SOBRE_A_CONTA[t]}»`)
  }
}

/* ── 8. O NUNCA_SAI aponta para tabelas reais, e traz razao ─────────────── */
for (const [t, razao] of Object.entries(NUNCA_SAI)) {
  if (!TODAS.has(t)) falhas.push(`NUNCA_SAI nomeia \`${t}\`, que nao existe no esquema.`)
  if (!razao || razao.trim().length < 15) {
    falhas.push(`a exclusao de \`${t}\` em NUNCA_SAI nao traz razao: «${razao}»`)
  }
}

if (falhas.length) {
  console.error(`\n✗ ${falhas.length} problema(s) no direito de acesso (art. 15.º):\n`)
  falhas.forEach(f => console.error(`  • ${f}\n`))
  process.exit(1)
}
console.log(
  `✓ check-direito-acesso: ${COM_UTENTE.length} tabelas guardam dados de utentes — `
  + `${COM_UTENTE.length - Object.keys(FORA).length} entram no documento do art. 15.º, `
  + `${Object.keys(FORA).length} excluídas com razão. `
  + `Art. 20.º numa casa: ${Object.keys(SOBRE_A_CONTA).length} tabelas sobre a conta.`)
if (avisos.length) {
  console.log(`  ⚠ ${avisos.length} tabela(s) citadas que ainda não existem na base de dados:`)
  avisos.forEach(a => console.log(`    ${a}`))
}
