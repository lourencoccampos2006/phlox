#!/usr/bin/env node
// scripts/check-links.mjs
// Rede de segurança contra LINKS MORTOS: uma rota que é só um redirect (ex.:
// /turno→/ronda-guiada, /aprender→/study) não deve ser destino de um link de
// navegação/menu/cartão — isso cria redirect-chains e piora a UX. Este guard:
//   1. deteta automaticamente as páginas que são SÓ redirect (app/<rota>/page.tsx
//      curtas que só chamam r.replace(...) ou redirect(...)).
//   2. falha se alguma FONTE de navegação linkar diretamente para elas.
// Fontes verificadas: toolRegistry, navigation, institutionBlueprint, Header,
// ClientLayout(sidebar), painel-dono(hub), inicio(hubs), BottomNav.
//
// Uso: node scripts/check-links.mjs  → lista links mortos, exit 1 se houver.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8') } catch { return '' } }

// ── 1. Descobrir rotas redirect-only (+ para onde cada uma aponta) ───────────
const APP = join(ROOT, 'app')
const redirectRoutes = new Set()
const redirectTargets = new Map() // rota → [destinos possíveis] (útil p/ detetar cadeias)
function scanApp(dir, base = '') {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) {
      // ignora grupos de rotas dinâmicas complicadas; segue normal
      scanApp(p, base + '/' + name)
    } else if (name === 'page.tsx') {
      const src = readFileSync(p, 'utf8')
      const lines = src.split('\n').length
      const isRedirect = /r\.replace\(|router\.replace\(|redirect\(/.test(src)
      // só redirect se é uma página curta e não tem outra UI substancial
      const hasUI = /return\s*\(/.test(src) && lines > 22
      if (isRedirect && lines <= 22 && !hasUI) {
        const route = base.replace(/\/\([^)]+\)/g, '') || '/'
        if (route.startsWith('/')) {
          redirectRoutes.add(route)
          // apanha TODOS os literais '/x' no ficheiro como destinos possíveis —
          // cobre tanto redirects simples como condicionais (?ternário).
          const dests = [...src.matchAll(/['"`](\/[a-z0-9-]+)['"`]/g)].map(m => m[1]).filter(d => d !== route)
          redirectTargets.set(route, dests)
        }
      }
    }
  }
}
try { scanApp(APP) } catch { /* sem app dir */ }

if (redirectRoutes.size === 0) {
  console.log('✓ check-links: sem rotas redirect-only detetadas (nada a verificar).')
  process.exit(0)
}

// ── 1b. Cadeias de redirect: uma rota redirect-only cujo(s) destino(s) é(são)
// ELE PRÓPRIO(S) redirect-only. Isto é o que causou o loop /turno↔/handover —
// cada um isolado parecia bem, só a combinação criava o ciclo infinito.
const chains = []
for (const [route, dests] of redirectTargets) {
  for (const dest of dests) {
    if (redirectRoutes.has(dest)) chains.push(`${route} → ${dest}${redirectTargets.get(dest)?.includes(route) ? ' → ' + route + ' (CICLO INFINITO)' : ''}`)
  }
}
if (chains.length) {
  console.error(`\n✗ ${chains.length} cadeia(s) de redirect detetada(s) (rota redirect-only a apontar para OUTRA redirect-only):\n`)
  ;[...new Set(chains)].sort().forEach(c => console.error('  ' + c))
  console.error('\n  Aponta cada rota diretamente para o destino REAL (não para outro redirect).\n')
  process.exit(1)
}

// ── 2. Fontes de navegação a verificar ───────────────────────────────────────
const NAV_SOURCES = [
  'lib/toolRegistry.ts',
  'lib/navigation.ts',
  'lib/institutionBlueprint.ts',
  'lib/institutionHub.ts',
  'components/Header.tsx',
  'components/ClientLayout.tsx',
  'components/BottomNav.tsx',
  'app/painel-dono/page.tsx',
  'app/inicio/page.tsx',
  'app/onboarding/page.tsx',
  'app/comecar-instituicao/page.tsx',
]

const offenders = []
for (const file of NAV_SOURCES) {
  const src = read(file)
  if (!src) continue
  for (const route of redirectRoutes) {
    // procura href:'/x' ou href="/x" ou id:'/x' — mas NÃO como prefixo (ex.
    // /study não deve casar com /study360). Exige fim exato: ' " ? ) ou fim.
    const re = new RegExp(`(href|id)\\s*[:=]\\s*['"\`]${route.replace(/[/]/g, '\\/')}(['"\`?])`, 'g')
    if (re.test(src)) offenders.push(`${file} → ${route}`)
  }
}

if (offenders.length) {
  console.error(`\n✗ ${offenders.length} link(s) de navegação para rotas REDIRECT-ONLY (dead links):\n`)
  ;[...new Set(offenders)].sort().forEach(o => console.error('  ' + o))
  console.error('\n  Aponta o link para o destino REAL da rota (evita redirect-chain).')
  console.error('  Rotas redirect-only detetadas: ' + [...redirectRoutes].sort().join(', ') + '\n')
  process.exit(1)
} else {
  console.log(`✓ Nenhum link de navegação aponta para rotas redirect-only (${redirectRoutes.size} detetadas).`)
}
