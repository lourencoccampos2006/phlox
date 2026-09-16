// scripts/check-orfas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Páginas que existem e que ninguém apresenta.
//
// Uma ferramenta que não está no /inicio, nem no /painel, nem no catálogo, nem
// na paleta, e para a qual nenhum link aponta, é código que se mantém, que se
// testa e que se parte — sem nunca ser usado. E é pior do que não existir:
// aparece nas buscas internas, envelhece em silêncio, e um dia alguém descobre
// que escreve numa tabela que já não existe (foi o caso do /nota-clinica).
//
// Isto lista as candidatas. NÃO decide — as rotas públicas, as de autenticação
// e as que se alcançam por redirecionamento são legítimas e ficam de fora por
// lista explícita.
//
//   node scripts/check-orfas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

// ── 1. Que páginas existem ──────────────────────────────────────────────────
const paginas = []
;(function varrer(dir) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '.claude', 'api'].includes(n)) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) varrer(p)
    else if (n === 'page.tsx' || n === 'page.ts') {
      const rota = '/' + relative('app', dir).replace(/\\/g, '/')
      paginas.push(rota === '/.' ? '/' : rota)
    }
  }
})('app')

// ── 2. Onde é que uma rota pode ser apresentada ─────────────────────────────
const fontes = []
;(function varrer(dir) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '.claude'].includes(n)) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) varrer(p)
    else if (['.ts', '.tsx', '.mjs'].includes(extname(n))) fontes.push(p)
  }
})('.')

const referidas = new Set()
for (const f of fontes) {
  const texto = readFileSync(f, 'utf8')
  const dela = '/' + relative('app', f).replace(/\\/g, '/').replace(/\/page\.tsx?$/, '')
  // href="/x", href={'/x'}, id: '/x', path: '/x', push('/x'), redirect('/x')…
  for (const m of texto.matchAll(/['"`](\/[a-z0-9][a-z0-9\-\/]*)['"`]/g)) {
    const r = m[1].replace(/\/$/, '')
    if (r && r !== dela) referidas.add(r)
  }
}

// ── 3. As que não contam como órfãs ─────────────────────────────────────────
const LEGITIMAS = [
  '/', '/login', '/onboarding', '/auth/callback', '/logout',
  '/pricing', '/blog', '/about', '/terms', '/privacy', '/contacto', '/contact',
  '/trust', '/security', '/status', '/changelog', '/api-docs', '/subprocessadores',
  '/demo', '/comecar', '/convite', '/hp', '/v', '/share', '/sso',
]
/** Um stub de redirecionamento — mantido de proposito para nao partir links
 *  antigos. Reconhece-se por ser curto e nao fazer mais nada senao redirecionar. */
function ehRedirecionamento(r) {
  try {
    const t = readFileSync(join('app', r.slice(1), 'page.tsx'), 'utf8')
    return t.split('\n').length <= 30 && /redirect\(|\.replace\(['"`]\//.test(t)
  } catch { return false }
}

/** Uma porta para partilha social: existe so para hospedar o opengraph-image
 *  ao lado, e redireciona para o artigo. */
function ehPortaDePartilha(r) {
  try { statSync(join('app', r.slice(1), 'opengraph-image.tsx')); return true } catch { return false }
}

const ehLegitima = (r) =>
  LEGITIMAS.some(l => r === l || r.startsWith(l + '/')) ||
  r.includes('[')                       // rota dinâmica: alcança-se por id
  || /^\/(blog|artigos|guias|doencas|medicamentos)\//.test(r)   // conteúdo SEO
  || /^\/checkout\//.test(r)            // retorno do Stripe (URL montado em template)
  || ehRedirecionamento(r)
  || ehPortaDePartilha(r)

// ── 4. O veredicto ──────────────────────────────────────────────────────────
const orfas = paginas.filter(r => !ehLegitima(r) && !referidas.has(r)).sort()

if (!orfas.length) {
  console.log(`✓ Nenhuma página órfã (${paginas.length} páginas verificadas).`)
  process.exit(0)
}

console.log(`${orfas.length} página(s) sem ninguém a apontar para elas, de ${paginas.length}:\n`)
for (const r of orfas) {
  const f = join('app', r.slice(1), 'page.tsx')
  let linhas = '?'
  try { linhas = String(readFileSync(f, 'utf8').split('\n').length) } catch { /* .ts */ }
  console.log(`  ${r.padEnd(30)} ${linhas.padStart(5)} linhas`)
}
console.log(`\nIsto é uma LISTA DE CANDIDATAS, não uma sentença: confirmar uma a uma`)
console.log(`antes de apagar (pode haver ligação por variável ou por redirecionamento).`)
process.exit(0)
