#!/usr/bin/env node
// scripts/check-vocab.mjs
// Guarda contra regressões de vocabulário: procura termos de lar hardcoded em
// JSX de ferramentas PARTILHADAS entre instituições (agenda, incidents, etc.).
// Estas devem ler de institutionConfig, não assumir "residente"/"quarto"/"lar".
//
// Uso:  node scripts/check-vocab.mjs        → lista offensores, exit 1 se houver
//       (intencionalmente fora do build do Next; corre à parte ou em CI)
//
// NÃO é exaustivo nem perfeito — é uma rede de segurança. Ferramentas que são
// EXCLUSIVAS do lar (care-plans, gestão do lar, protocolos clínicos) estão na
// allowlist porque aí "residente" é o termo de domínio correto.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'app')

// Ferramentas partilhadas entre 2+ tipos de instituição — têm de usar config.
const SHARED_TOOLS = [
  'agenda', 'incidents', 'assessments', 'turno', 'feridas', 'family',
  'documentos', 'hidratacao', 'care-log', 'mar', 'patients', 'activities',
  'stock', 'vendas', 'balcao', 'reconciliacao', 'counseling', 'rounds',
  'quality', 'prescription-queue', 'schedule',
]

// Padrões de vocabulário hardcoded que NÃO deviam aparecer em JSX/strings.
// Apanhamos DUAS formas: (a) dentro de aspas/template strings; (b) como texto
// de JSX entre tags (>...residentes...<) — esta segunda escapava antes e deixou
// passar coisas como ">Total residentes</div>".
const BAD = [
  /['"`][^'"`]*\bresidentes?\b[^'"`]*['"`]/i,
  /['"`][^'"`]*\bevento do lar\b[^'"`]*['"`]/i,
  /['"`][^'"`]*\bdo lar\b[^'"`]*['"`]/i,
  />[^<>{]*\bresidentes?\b[^<>]*</i,
  />[^<>{]*\bevento do lar\b[^<>]*</i,
]

// Exceções aceitáveis (domínio clínico / comentários) — ignoramos linhas que
// sejam claramente comentário (no início OU inline depois de código).
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line) || /\/\/.*\bResidente\b/.test(line)
// Linhas que JÁ escolhem o termo de lar só quando É lar (guarda condicional) são
// legítimas — o "lar"/"residente" aí só aparece para nursing_home.
const isGuarded = (line) => /isNursingHome\s*\?|institution\s*===\s*'nursing_home'|isNH\s*\?/.test(line)

let offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) checkFile(p)
  }
}

function toolOf(path) {
  const rel = path.split(/app[\\/]/)[1] || ''
  return rel.split(/[\\/]/)[0]
}

function checkFile(path) {
  const tool = toolOf(path)
  if (!SHARED_TOOLS.includes(tool)) return
  const lines = readFileSync(path, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (isComment(line) || isGuarded(line)) return
    if (BAD.some(re => re.test(line))) {
      offenders.push(`${path}:${i + 1}: ${line.trim().slice(0, 100)}`)
    }
  })
}

walk(ROOT)

if (offenders.length) {
  console.error(`\n✗ Vocabulário de lar hardcoded em ${offenders.length} sítio(s) de ferramentas partilhadas.`)
  console.error('  Usa institutionConfig (cfg.personNoun / cfg.noPersonEventLabel / cfg.roomLabel) em vez de "residente"/"lar"/"quarto".\n')
  offenders.forEach(o => console.error('  ' + o))
  console.error('')
  process.exit(1)
} else {
  console.log('✓ Sem vocabulário de lar hardcoded nas ferramentas partilhadas.')
}
