// scripts/check-modelos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os modelos de IA que o codigo pede ainda existem?
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// A 2026-09-17 o /scan e o /vault estavam partidos e duas das quatro escadas
// de fallback eram decorativas: o `gemini-2.0-flash` e o `gemini-2.0-flash-lite`
// tinham sido DESLIGADOS pela Google e respondiam 404. Ninguem reparou porque
// uma escada de fallback so se nota quando o degrau de cima falha -- e nessa
// altura ja e tarde.
//
// Isto e o tipo de coisa que apodrece em silencio: o codigo nao muda, o mundo
// muda. Corre isto de vez em quando, e sempre que a IA comecar a portar-se mal.
//
//   node scripts/check-modelos.mjs
//
// Precisa da GEMINI_API_KEY (le o .env.local sozinho). Sem chave, diz que nao
// pode verificar em vez de fingir que esta tudo bem.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'

// .env.local a mao -- este projeto nao usa dotenv.
try {
  for (const linha of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* sem .env.local, usa o ambiente */ }

const fonte = fs.readFileSync('lib/ai.ts', 'utf8')

// Os nomes de modelo tal como o codigo os pede.
const pedidos = new Set()
for (const m of fonte.matchAll(/'(gemini-[a-z0-9.\-]+)'/g)) pedidos.add(m[1])
const claude = new Set()
for (const m of fonte.matchAll(/'(claude-[a-z0-9.\-]+)'/g)) claude.add(m[1])

console.log(`Modelos Gemini pedidos pelo codigo: ${pedidos.size}`)
console.log(`Modelos Claude pedidos pelo codigo: ${[...claude].join(', ')}\n`)

const chave = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
if (!chave) {
  console.log('! Sem GEMINI_API_KEY -- nao da para verificar. Isto NAO quer dizer que esteja tudo bem.')
  process.exit(0)
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${chave}&pageSize=400`)
if (!res.ok) {
  console.log(`! A API do Gemini respondeu ${res.status} -- nao da para verificar agora.`)
  process.exit(0)
}
const dados = await res.json()
const vivos = new Set(
  (dados.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', '')),
)

let mortos = 0
for (const nome of [...pedidos].sort()) {
  if (vivos.has(nome)) console.log(`  ok   ${nome}`)
  else { mortos++; console.log(`  MORTO ${nome} -- ja nao existe na API`) }
}

// A chave da Anthropic tem saldo? Um 400 de "credit balance" faz cair o degrau
// de qualidade de todas as ferramentas clinicas sem dar erro visivel a ninguem.
if (process.env.ANTHROPIC_API_KEY) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: [...claude][0] || 'claude-haiku-4-5-20251001', max_tokens: 4, messages: [{ role: 'user', content: 'oi' }] }),
  }).catch(() => null)
  if (r && r.ok) console.log('\n  ok   Anthropic responde (chave valida, com saldo)')
  else {
    const d = r ? await r.json().catch(() => ({})) : {}
    const msg = d?.error?.message || 'sem resposta'
    console.log(`\n  ATENCAO Anthropic: ${msg}`)
    if (/credit|balance|quota/i.test(msg)) {
      console.log('          -> O degrau de QUALIDADE de todas as ferramentas clinicas esta desligado.')
      console.log('             Tudo continua a funcionar pelo Gemini, mas com o segundo melhor modelo.')
    }
  }
}

console.log(mortos ? `\n✗ ${mortos} modelo(s) que o codigo pede ja nao existem.` : '\n✓ Todos os modelos Gemini pedidos existem.')
process.exit(mortos ? 1 : 0)
