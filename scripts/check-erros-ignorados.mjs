// scripts/check-erros-ignorados.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Uma operacao no Supabase cujo erro nao e lido.
//
// ── PORQUE E QUE ISTO E A FAMILIA DE ERROS MAIS CARA DESTE PROJETO ─────────
// O cliente do Supabase nao lanca excecoes: devolve `{ data, error }`. Quem
// escreve `const { data } = await …` (ou so `await sb.from(…).insert(…)`)
// atira o erro ao chao. E o PostgREST recusa a operacao INTEIRA quando uma
// coluna nao existe -- num select devolve `data: null`, que e indistinguivel
// de "nao ha registos".
//
// A avaria nao aparece como avaria:
//   • numa LEITURA, aparece como uma lista vazia;
//   • numa ESCRITA, aparece como sucesso -- o formulario limpa-se e a pessoa
//     conclui que gravou.
//
// Ja custou, neste projeto: `personal_meds.shifts` calou TODAS as notificacoes
// de medicacao durante semanas; `family_thread_messages.body` fez com que o
// aviso "familia a espera" nunca existisse; o verificador de interacoes dizia
// "nao encontrei interacoes" a quem toma oito medicamentos; e o "Guardar no
// cofre" recusava todos os inserts sem ninguem saber.
//
// ── PORQUE E QUE ISTO E UM ROQUETE, E NAO UMA LISTA DE 400 ERROS ───────────
// Ha centenas de sitios com esta forma, acumulados ao longo do projeto. Duas
// coisas mudaram a 2026-09-18:
//
//   1. **A invisibilidade acabou.** O cliente do browser passa por
//      lib/supabaseVigiado, que escreve na consola TODAS as respostas de erro
//      do Supabase, com a tabela e a mensagem real -- inclusive as dos sitios
//      que descartam o `error`. Era a invisibilidade que fazia estas avarias
//      durar semanas, e essa parte esta resolvida de uma vez.
//
//   2. **A mentira na interface foi corrigida onde tem consequencia**: o
//      cofre, as sessoes ativas, a medicacao de um residente, um recado a uma
//      familia, um contacto de emergencia, as presencas de uma atividade.
//
// O que falta e mecanico e enorme. Uma guarda que exija tudo hoje fica
// vermelha para sempre, e uma guarda sempre vermelha nao e lida. Por isso
// guarda-se uma BASE: o numero por ficheiro no dia em que isto foi escrito. O
// numero pode descer, nunca subir. Codigo novo com esta forma e recusado; o
// antigo vai saindo a medida que se mexe nos ficheiros.
//
//   node scripts/check-erros-ignorados.mjs           verifica
//   node scripts/check-erros-ignorados.mjs --gravar  aperta a base ao estado atual
//
// ── A EXCECAO LEGITIMA ─────────────────────────────────────────────────────
// `supabase.auth.getSession()` nao e uma consulta. O erro ali significa "nao
// ha sessao", que e o que o codigo ja trata com `data?.session?...`. Obrigar a
// le-lo seria ruido em 25 sitios.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'scripts/erros-ignorados-base.json'
const gravar = process.argv.includes('--gravar')

const CLIENTES = '(?:supabase|sb|sb0|db|admin|a)'
// Leitura cujo erro nao vem: `const { data } = await sb…` / `const { data: x } = …`
const LEITURA = new RegExp(`const\\s*\\{\\s*data(?:\\s*:\\s*[A-Za-z_$][\\w$]*)?\\s*\\}\\s*=\\s*await\\s+${CLIENTES}\\b([^\\n]{0,90})`, 'g')
// Escrita sem nada destruturado: `await sb.from('x').insert(…)`
const ESCRITA = new RegExp(`^\\s*await\\s+${CLIENTES}\\.from\\(`)

function ficheiros(dir, fora = []) {
  if (!fs.existsSync(dir)) return fora
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) ficheiros(p, fora) }
    else if (/\.(ts|tsx)$/.test(e.name)) fora.push(p)
  }
  return fora
}

const agora = {}
const detalhe = {}

for (const f of [...ficheiros('app'), ...ficheiros('lib'), ...ficheiros('components')]) {
  const chave = f.replace(/\\/g, '/')
  const linhas = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  let n = 0
  const ondes = []

  linhas.forEach((linha, i) => {
    if (/^\s*(\/\/|\*)/.test(linha)) return

    LEITURA.lastIndex = 0
    let m
    while ((m = LEITURA.exec(linha))) {
      if (/\.auth\.(getSession|getUser|refreshSession)/.test(m[1])) continue
      n++; ondes.push({ n: i + 1, tipo: 'leitura', linha: linha.trim().slice(0, 100) })
    }

    if (ESCRITA.test(linha) && /\.(insert|update|upsert|delete)\(/.test(linha)) {
      n++; ondes.push({ n: i + 1, tipo: 'escrita', linha: linha.trim().slice(0, 100) })
    }
  })

  if (n) { agora[chave] = n; detalhe[chave] = ondes }
}

const totalAgora = Object.values(agora).reduce((a, b) => a + b, 0)

if (gravar) {
  fs.writeFileSync(BASE, JSON.stringify(agora, null, 2) + '\n')
  console.log(`Base gravada: ${Object.keys(agora).length} ficheiros, ${totalAgora} ocorrências.`)
  process.exit(0)
}

let base = {}
try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')) } catch {
  console.log(`! Não há base em ${BASE}. Corre com --gravar para a criar.`)
  process.exit(0)
}

const totalBase = Object.values(base).reduce((a, b) => a + b, 0)
const piorou = []
const melhorou = []

for (const [f, n] of Object.entries(agora)) {
  const b = base[f] ?? 0
  if (n > b) piorou.push({ f, n, b })
}
for (const [f, b] of Object.entries(base)) {
  const n = agora[f] ?? 0
  if (n < b) melhorou.push({ f, n, b })
}

console.log(`Erros de Supabase descartados: ${totalAgora} (base: ${totalBase})`)
console.log('Todos passam por lib/supabaseVigiado, por isso nenhum é invisível.\n')

if (melhorou.length) {
  for (const m of melhorou) console.log(`  ↓ ${m.f}: ${m.b} → ${m.n}`)
  console.log(`\n  ${melhorou.length} ficheiro(s) melhoraram. Corre com --gravar para apertar a base.\n`)
}

if (!piorou.length) {
  console.log('✓ Nenhum sítio novo a descartar erros do Supabase.')
  process.exit(0)
}

console.log('Sítios NOVOS a descartar o erro:\n')
for (const p of piorou) {
  console.log(`✗ ${p.f}: ${p.b} → ${p.n}`)
  for (const o of detalhe[p.f].slice(0, 6)) {
    console.log(`    ${o.n}: [${o.tipo}] ${o.linha}`)
  }
  console.log(`    → const { data, error } = … e decide o que fazer com o error.`)
  console.log(`      Numa escrita isto é mais grave: sem ler o error, o ecrã diz que guardou.\n`)
}
process.exit(1)
