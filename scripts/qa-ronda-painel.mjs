// scripts/qa-ronda-painel.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O painel da ronda, contra a base de dados real — sem escrever nada.
//
// Pede o painel de uma pessoa a sério à rota `/api/rounds` e corre os avisos
// sobre a resposta que ela devolve. Prova a cadeia inteira (rota → colunas →
// `avisosDe`) sem atender ninguém, que seria escrever no registo do dia de
// alguém só para testar.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/qa-ronda-painel.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import { avisosDe, avisoDaAnterior } from '../lib/ronda.ts'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = process.env.QA_BASE || 'http://localhost:3311'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

// Sessão da conta de QA.
const sessao = await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt',
    password: process.env.QA_PASSWORD || 'QaPhlox2026!',
  }),
}).then(r => r.json())
if (!sessao.access_token) { console.error('sem sessão:', sessao); process.exit(1) }

// Quem tem alguma coisa para avisar.
const pessoas = await fetch(
  `${U}/rest/v1/patients?select=id,name,allergies&active=eq.true&allergies=not.is.null`,
  { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
).then(r => r.json())

if (!pessoas.length) {
  console.log('Ninguém com alergias registadas — nada para verificar aqui.')
  process.exit(0)
}
const alvo = pessoas[0]
console.log(`\nPAINEL REAL DE: ${alvo.name}\n`)

const painel = await fetch(`${BASE}/api/rounds`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.access_token}` },
  body: JSON.stringify({ action: 'panel', patient_id: alvo.id }),
}).then(r => r.json())

console.log('A ROTA DEVOLVE O QUE FALTAVA')
{
  ok('não devolveu erro', !painel.error, painel.error || '')
  for (const campo of ['meds', 'mar', 'tasks', 'taskLogs', 'feridas', 'ocorrencias',
    'pedidos', 'registos', 'sos', 'tomasSos', 'acoesPlano']) {
    ok(`${campo} vem como lista`, Array.isArray(painel[campo]), typeof painel[campo])
  }
  ok('a ficha da pessoa vem', !!painel.pessoa && painel.pessoa.id === alvo.id)
  // O bug que isto apanha: `select` com uma coluna que não existe faz o
  // PostgREST recusar a consulta INTEIRA e devolver null — a ficha voltava
  // vazia e o painel ficava sem um único aviso, sem erro nenhum.
  ok('e traz as alergias', !!painel.pessoa?.allergies, painel.pessoa?.allergies || 'VAZIO')
  ok('a medicação do turno não traz SOS',
    (painel.meds || []).every(m => m.sos !== true),
    'SOS é «quando for preciso» — na lista do turno parecia por dar')
}

console.log('\nOS AVISOS SAEM DO QUE A ROTA TROUXE')
{
  const avisos = avisosDe(painel.pessoa || {}, {
    feridas: painel.feridas, ocorrencias: painel.ocorrencias, pedidos: painel.pedidos,
  })
  const daRonda = avisoDaAnterior(painel.anterior)
  const todos = daRonda ? [daRonda, ...avisos] : avisos

  console.log('  ' + (todos.length
    ? todos.map(a => `[${a.nivel}] ${a.texto}`).join('\n  ')
    : '(nenhum)'))

  ok('a alergia vira aviso crítico',
    todos.some(a => a.nivel === 'critico' && /alergia/i.test(a.texto)))
  ok('todo o aviso diz de onde veio', todos.every(a => a.origem))
  ok('os críticos vêm primeiro',
    todos.every((a, i) => i === 0 || !(a.nivel === 'critico' && todos[i - 1].nivel !== 'critico')))
}

console.log(falhas ? `\n✗ ${falhas} falha(s).` : '\n✓ O painel traz o que a ronda precisa, contra dados reais.')
process.exit(falhas ? 1 : 0)
