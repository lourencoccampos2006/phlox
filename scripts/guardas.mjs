#!/usr/bin/env node
// scripts/guardas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// TODAS AS GUARDAS, NUM COMANDO
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Porque são vinte e duas, e corriam só quando eu me lembrava de cada uma.
//
// A 20 de outubro o `check-stamp` teria apanhado, no instante em que a
// migração foi escrita, que as três tabelas do apoio domiciliário não tinham
// `recorded_by_id` — o que fazia o módulo inteiro não gravar nada. Em vez
// disso só apareceu seis dias depois, quando fui testar à mão contra a base de
// dados a sério.
//
// Uma guarda que depende de alguém se lembrar dela não é uma rede: é uma
// sugestão.
//
//   npm run guardas          todas as que não precisam de chaves
//   npm run guardas -- --tudo   inclui as que falam com o Supabase
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const TUDO = process.argv.includes('--tudo')

/* As que leem só o repositório. Correm em qualquer sítio, incluindo CI sem
   segredos — e são a maioria. */
const SECAS = [
  'check-camadas', 'check-erros-ignorados', 'check-escondidas',
  'check-hooks-estaveis', 'check-jsx-assercoes', 'check-leitura-anonima',
  'check-migracoes', 'check-modelos', 'check-orcamento-rotas', 'check-orfas',
  'check-papeis', 'check-restricoes', 'check-scroll', 'check-stamp',
  'check-vocab', 'check-nav', 'auditoria-design', 'check-dispositivo-medico',
]

/* As que PERGUNTAM À BASE DE DADOS. Precisam da chave de serviço, e é isso que
   as torna as mais valiosas: comparam o que o código diz com o que lá está. */
const MOLHADAS = [
  'check-colunas', 'check-sql', 'check-perfis', 'estado-das-migracoes',
]

/* As que precisam do loader DE TS e da chave: leem o `lib/` e confrontam-no
   com o esquema real. */
const MOLHADAS_COM_TS = [
  ['check-direito-acesso', []],
]

/* As que importam do `lib/` e por isso precisam do carregador de TypeScript,
   mas NAO falam com a base de dados. Esta lista existe porque o `check-racios`
   nao cabia em nenhuma das outras: precisa do loader (le o `lib/racios.ts`) e
   nao precisa de chave nenhuma. Estava em `COM_TS`, que so corre com `--tudo`
   — ou seja, a guarda que verifica os racios minimos da lei ficava de fora da
   passagem normal, que e a que eu corro a cada mudanca. */
const SECAS_COM_TS = [
  ['check-ropa', []],
  ['check-racios', []],
  ['check-diplomas', []],
]

/* As que precisam do carregador de TypeScript E da chave. */
const COM_TS = [
  ['check-capacidades', ['--base-de-dados']],
  ['check-contadores', []],
]

const temChave = existsSync('.env.local')

function correr(nome, args = [], ts = false) {
  const cmd = ts
    ? ['--experimental-strip-types', '--loader', './scripts/loader-ts.mjs', `scripts/${nome}.mjs`, ...args]
    : [`scripts/${nome}.mjs`, ...args]
  const r = spawnSync('node', cmd, { encoding: 'utf8' })
  const saida = (r.stdout || '') + (r.stderr || '')
  return { nome, ok: r.status === 0, saida }
}

const falhadas = []
let corridas = 0

for (const n of SECAS) {
  const r = correr(n)
  corridas++
  if (!r.ok) falhadas.push(r)
  process.stdout.write(r.ok ? '.' : 'X')
}

for (const [n, args] of SECAS_COM_TS) {
  const r = correr(n, args, true)
  corridas++
  if (!r.ok) falhadas.push(r)
  process.stdout.write(r.ok ? '.' : 'X')
}

if (TUDO) {
  if (!temChave) {
    console.log('\n\n  (sem .env.local — as guardas que falam com o Supabase ficam de fora)')
  } else {
    for (const n of MOLHADAS) {
      const r = correr(n)
      corridas++
      if (!r.ok) falhadas.push(r)
      process.stdout.write(r.ok ? '.' : 'X')
    }
    for (const [n, args] of [...COM_TS, ...MOLHADAS_COM_TS]) {
      const r = correr(n, args, true)
      corridas++
      if (!r.ok) falhadas.push(r)
      process.stdout.write(r.ok ? '.' : 'X')
    }
  }
}

console.log(`\n\n${corridas} guarda(s) corridas.`)

if (!falhadas.length) {
  console.log('✓ Todas verdes.')
  if (!TUDO) console.log('  (as que falam com o Supabase ficaram de fora — `npm run guardas -- --tudo`)')
  process.exit(0)
}

/* O relatório mostra a saída INTEIRA de quem falhou, e não um resumo: o que
   uma guarda escreve quando falha é precisamente a informação de que se
   precisa, e resumi-la obriga a voltar a correr a guarda à mão. */
console.log(`\n✗ ${falhadas.length} falhou(falharam):\n`)
for (const f of falhadas) {
  console.log(`${'─'.repeat(70)}\n${f.nome}\n${'─'.repeat(70)}`)
  console.log(f.saida.trim())
  console.log('')
}
process.exit(1)
