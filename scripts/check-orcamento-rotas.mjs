// scripts/check-orcamento-rotas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Uma rota lenta com o tecto de tempo curto.
//
// ── PORQUE E QUE ISTO EXISTE ───────────────────────────────────────────────
// O `vercel.json` da 60s a tudo o que esta em `app/api/**`. Chega para a
// maioria, mas nao para as rotas que LEEM UMA IMAGEM ou um PDF: e a operacao
// mais lenta da app, e a escada de IA pode ter de tentar mais do que um modelo.
//
// O `maxDuration` e um corte seco. Passado o tecto, a Vercel mata a funcao e
// quem esta do outro lado recebe um 504 -- sem mensagem, sem explicacao, sem
// nada que diga o que fazer a seguir. Uma pessoa que fotografou um relatorio e
// esperou um minuto merece melhor do que isso.
//
// Havia 101 rotas de IA sem tecto proprio. A 2026-09-18 subiu-se o tecto geral
// para 60s e deu-se 120s as 15 que precisavam mesmo.
//
//   node scripts/check-orcamento-rotas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'

const TECTO_GERAL = (() => {
  try {
    const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
    return v?.functions?.['app/api/**']?.maxDuration ?? 15
  } catch { return 15 }
})()

// O minimo para uma rota que le uma imagem ou gera uma resposta longa. Vem do
// pior caso real da escada: dois Claude a 60s de espera mais os Gemini.
const MINIMO_LENTAS = 120

function rotas(dir, fora = []) {
  if (!fs.existsSync(dir)) return fora
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) rotas(p, fora)
    else if (e.name === 'route.ts') fora.push(p)
  }
  return fora
}

const achados = []
let lentas = 0

for (const f of rotas('app/api')) {
  const s = fs.readFileSync(f, 'utf8')

  const temVisao = /callGeminiVision/.test(s)
  const tokens = [...s.matchAll(/maxTokens:\s*(\d+)/g)].map(m => +m[1])
  const respostaLonga = tokens.some(t => t >= 4000)
  if (!temVisao && !respostaLonga) continue
  lentas++

  const m = s.match(/export const maxDuration\s*=\s*(\d+)/)
  const tecto = m ? +m[1] : TECTO_GERAL
  if (tecto >= MINIMO_LENTAS) continue

  achados.push({
    f: f.replace(/\\/g, '/'),
    tecto,
    declarado: !!m,
    porque: temVisao ? 'lê imagens/PDFs' : `escreve até ${Math.max(...tokens)} tokens`,
  })
}

console.log(`Tecto geral de app/api/** no vercel.json: ${TECTO_GERAL}s`)
console.log(`Rotas lentas (visão ou resposta longa): ${lentas}\n`)

if (!achados.length) {
  console.log(`✓ Todas as rotas lentas têm pelo menos ${MINIMO_LENTAS}s.`)
  process.exit(0)
}

for (const a of achados) {
  console.log(`✗ ${a.f}`)
  console.log(`    ${a.porque}, mas só tem ${a.tecto}s${a.declarado ? '' : ' (herdados do tecto geral)'}.`)
  console.log(`    → export const maxDuration = ${MINIMO_LENTAS}\n`)
}
console.log(`✗ ${achados.length} rota(s) lenta(s) que a Vercel pode matar a meio.`)
process.exit(1)
