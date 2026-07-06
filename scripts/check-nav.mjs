#!/usr/bin/env node
// scripts/check-nav.mjs
// Rede de segurança de ACESSIBILIDADE: garante que toda a ferramenta declarada
// no toolRegistry (a lista canónica de ferramentas por modo) é ALCANÇÁVEL no seu
// modo — através do catálogo /tudo (lib/navigation.ts NAV_CATEGORIES), da sidebar
// clínica (lib/institutionBlueprint.ts) ou de um redirect conhecido.
//
// Sem isto, ferramentas "desaparecem" (existem mas ninguém lá chega) — foi o que
// aconteceu com 7 tools do estudante e com /faturacao+/vigia no clínico.
//
// Uso: node scripts/check-nav.mjs   → lista inacessíveis, exit 1 se houver.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

// ── 1. Ferramentas do registry, por modo ──────────────────────────────────────
const reg = read('lib/toolRegistry.ts')
// captura blocos { id: '/x', ... modes: [...] ... }
const toolRe = /id:\s*'(\/[a-z0-9-]+)'[^}]*?modes:\s*\[([^\]]*)\]/g
const registry = [] // { href, modes: [] }
let m
while ((m = toolRe.exec(reg))) {
  const href = m[1]
  const modes = [...m[2].matchAll(/'(personal|caregiver|student|clinical)'/g)].map(x => x[1])
  registry.push({ href, modes })
}

// ── 2. Superfícies de acesso ───────────────────────────────────────────────────
const nav = read('lib/navigation.ts')
const navHrefs = new Set([...nav.matchAll(/href:\s*'(\/[a-z0-9-]+)'/g)].map(x => x[1]))

const bp = read('lib/institutionBlueprint.ts')
const bpHrefs = new Set([...bp.matchAll(/href:\s*'(\/[a-z0-9-]+)'/g)].map(x => x[1]))

// Redirects/entradas conhecidas (alcançáveis por outro caminho legítimo).
const KNOWN = new Set([
  '/ai',       // acessível via barra/atalho e cartões do inicio em vários modos
  '/cockpit',  // redirect → /painel (mantido p/ links antigos)
  '/migrar',   // alcançável no onboarding /comecar-instituicao (import único)
  '/connect',  // alcançável via /settings (comunicação inter-profissional)
  '/equipa',   // alcançável a partir do /painel-dono (sub-secção de gestão da equipa)
])

// getNavForMode filtra por categoria×modo; para o guard basta saber se o href
// aparece em NAV_CATEGORIES (o /tudo mostra-o no(s) modo(s) da sua categoria).
function reachable(href, mode) {
  if (KNOWN.has(href)) return true
  if (navHrefs.has(href)) return true          // catálogo /tudo
  if (mode === 'clinical' && bpHrefs.has(href)) return true // sidebar clínica
  return false
}

const offenders = []
for (const t of registry) {
  for (const mode of t.modes) {
    if (!reachable(t.href, mode)) offenders.push(`${t.href}  (modo ${mode})`)
  }
}

if (offenders.length) {
  console.error(`\n✗ ${offenders.length} ferramenta(s) do registry INACESSÍVEIS no seu modo:`)
  console.error('  (não estão no catálogo /tudo nem na sidebar clínica nem na allowlist)\n')
  ;[...new Set(offenders)].sort().forEach(o => console.error('  ' + o))
  console.error('\n  Adiciona-as a lib/navigation.ts (NAV_CATEGORIES) na categoria certa,')
  console.error('  ou ao institutionBlueprint (se clínicas), para ficarem alcançáveis.\n')
  process.exit(1)
} else {
  console.log('✓ Todas as ferramentas do registry são alcançáveis no seu modo.')
}
