#!/usr/bin/env node
// scripts/check-ropa.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O REGISTO DE ATIVIDADES DE TRATAMENTO ESTÁ COMPLETO?
//
// ── PORQUE É QUE ISTO EXISTE ───────────────────────────────────────────────
// Um registo do art. 30.º não fica errado por alguém o estragar: fica errado
// por ninguém lhe tocar. Nasce uma ferramenta, nasce uma tabela, e o documento
// continua a dizer que se trata menos do que se trata — em silêncio, e com a
// aparência de estar em dia.
//
// Numa fiscalização, um registo incompleto é pior do que nenhum: prova que a
// entidade sabia da obrigação e cumpriu-a mal.
//
// Esta guarda cruza as tabelas que o `lib/areasDeDados` conhece com as que
// alguma atividade do `lib/ropa` reclama. O que sobrar ou entra numa atividade
// existente, ou obriga a escrever uma nova.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/check-ropa.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { ATIVIDADES, tabelasSemAtividade } from '../lib/ropa.ts'
import { PRAZOS } from '../lib/rgpd.ts'

let maus = 0

// ── 1. Toda a tabela conhecida está nalguma atividade? ───────────────────────
const orfas = tabelasSemAtividade()
if (orfas.length) {
  maus++
  console.error(`\n✗ ${orfas.length} tabela(s) que o Phlox protege e que nenhuma atividade do registo reclama:\n`)
  orfas.forEach(t => console.error('  ' + t))
  console.error('\n  Acrescenta-as a uma atividade em lib/ropa.ts, ou escreve a atividade que falta.')
  console.error('  Uma tabela fora do registo é tratamento de dados não declarado.\n')
}

// ── 2. Todo o prazo citado existe? ───────────────────────────────────────────
const ids = new Set(PRAZOS.map(p => p.id))
const semPrazo = ATIVIDADES.filter(a => !ids.has(a.prazo))
if (semPrazo.length) {
  maus++
  console.error(`\n✗ ${semPrazo.length} atividade(s) a citar um prazo que não existe em lib/rgpd:\n`)
  semPrazo.forEach(a => console.error(`  ${a.nome} → «${a.prazo}»`))
  console.error('')
}

// ── 3. Dados do art. 9.º sem base do art. 9.º ────────────────────────────────
// O erro que custa mais caro: declarar que se tratam dados de saúde e não dizer
// com que fundamento do artigo 9.º. O artigo 6.º sozinho NÃO basta para
// categorias especiais — são dois crivos, não um.
const semBase = ATIVIDADES.filter(a => a.especiais && a.baseEspecial === 'nenhuma')
if (semBase.length) {
  maus++
  console.error(`\n✗ ${semBase.length} atividade(s) com dados de categoria especial e sem base do art. 9.º:\n`)
  semBase.forEach(a => console.error('  ' + a.nome))
  console.error('')
}

// ── 4. E o contrário: base do art. 9.º sem dados especiais ───────────────────
const baseAMais = ATIVIDADES.filter(a => !a.especiais && a.baseEspecial !== 'nenhuma')
if (baseAMais.length) {
  maus++
  console.error(`\n✗ ${baseAMais.length} atividade(s) a invocar o art. 9.º sem terem dados especiais:\n`)
  baseAMais.forEach(a => console.error('  ' + a.nome))
  console.error('  Invocar uma base que não se precisa parece zelo e é o contrário: sugere que\n  há dados que não se declararam.\n')
}

if (maus) process.exit(1)
console.log(`✓ ${ATIVIDADES.length} atividades de tratamento, todas com base legal e prazo, e nenhuma tabela de fora.`)
