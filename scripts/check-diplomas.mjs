#!/usr/bin/env node
// scripts/check-diplomas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// CADA LEI ESTÁ ATRIBUÍDA À RESPOSTA SOCIAL CERTA?
//
// ── O ERRO QUE ISTO EXISTE PARA APANHAR ─────────────────────────────────────
// A checklist de conformidade citava «Portaria n.º 67/2012, art. X» em TODOS
// os doze itens do centro de dia. Essa portaria define, no artigo 1.º, as
// condições das ESTRUTURAS RESIDENCIAIS. Não se aplica a um centro de dia.
//
// Um diretor técnico que leve aquela referência a uma visita cita a lei errada,
// e a ferramenta que lha deu parece saber do que fala. Numa ferramenta de
// conformidade, uma referência errada é pior do que nenhuma: a ausência manda
// a pessoa confirmar, a referência errada convence-a a não confirmar.
//
// No mesmo dia escrevi, no painel dos rácios, que o diploma do centro de dia
// era o «Despacho Normativo n.º 62/99». Também errado, e a sair no ecrã: esse
// é do SERVIÇO DE APOIO DOMICILIÁRIO e foi revogado pela Portaria n.º 38/2013.
// Mandei um centro de dia consultar o diploma, revogado, de outra resposta.
//
// Os dois enganos são a mesma coisa: uma lei colada à resposta social errada.
// Escrevem-se com a mesma facilidade com que se leem, e nenhum teste de código
// os apanha — a aplicação funciona perfeitamente a citar a lei errada.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/check-diplomas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { checklistFor, SAD } from '../lib/complianceChecklists.ts'
import { MINIMOS_CONHECIDOS, SEM_MINIMOS, FUNCOES } from '../lib/racios.ts'

/* ── A QUEM PERTENCE CADA DIPLOMA ──────────────────────────────────────────
   Verificado a 22/10/2026 contra o Diário da República e o portal da
   Segurança Social. `so` é a resposta social onde a citação é legítima;
   `nunca` são aquelas onde é sempre um erro.

   O Despacho Normativo n.º 62/99 não tem `so` nenhum: está revogado, e por
   isso não é referência certa para ninguém. */
const DIPLOMAS = [
  {
    procura: /Portaria n\.º 67\/2012/,
    nome: 'Portaria n.º 67/2012',
    so: ['nursing_home'],
    porque: 'define as condições das ESTRUTURAS RESIDENCIAIS (art. 1.º). Não se aplica a centro de dia nem a apoio domiciliário.',
  },
  {
    procura: /Portaria n\.º 38\/2013/,
    nome: 'Portaria n.º 38/2013',
    so: ['sad'],
    porque: 'é a do SERVIÇO DE APOIO DOMICILIÁRIO.',
  },
  {
    procura: /Despacho Normativo n\.º 62\/99/,
    nome: 'Despacho Normativo n.º 62/99',
    so: [],
    porque: 'era do apoio domiciliário e foi REVOGADO pela Portaria n.º 38/2013. Não é referência certa para ninguém.',
  },
]

const RESPOSTAS = { nursing_home: 'lar (ERPI)', day_care: 'centro de dia', sad: 'apoio domiciliário' }
const falhas = []

/* ── 1. A checklist de cada resposta social ────────────────────────────── */
for (const tipo of ['nursing_home', 'day_care']) {
  for (const grupo of checklistFor(tipo)) {
    for (const item of grupo.items) {
      const texto = `${item.ref || ''} ${item.detail || ''}`
      for (const d of DIPLOMAS) {
        if (!d.procura.test(texto)) continue
        if (d.so.includes(tipo)) continue
        /* Uma nota de grupo pode NOMEAR o diploma errado para dizer que não se
           aplica — é o caso do «a Portaria n.º 67/2012 é das estruturas
           residenciais». Isso é o contrário de um erro. O que se procura é a
           citação como FONTE de uma obrigação, e essa vive no `ref`. */
        falhas.push(
          `[${RESPOSTAS[tipo]}] o item «${item.key}» cita ${d.nome}\n`
          + `      ref: «${item.ref}»\n`
          + `      ${d.nome} ${d.porque}`)
      }
    }
  }
}

/* ── 2. O grupo do SAD ─────────────────────────────────────────────────── */
for (const item of SAD.items) {
  const texto = `${item.ref || ''} ${item.detail || ''}`
  for (const d of DIPLOMAS) {
    if (!d.procura.test(texto) || d.so.includes('sad')) continue
    falhas.push(
      `[apoio domiciliário] o item «${item.key}» cita ${d.nome}\n`
      + `      ref: «${item.ref}»\n      ${d.nome} ${d.porque}`)
  }
}

/* ── 3. Os rácios ──────────────────────────────────────────────────────── */
for (const [tipo, m] of Object.entries(MINIMOS_CONHECIDOS)) {
  if (!m) continue
  for (const d of DIPLOMAS) {
    if (d.procura.test(m.diploma) && !d.so.includes(tipo)) {
      falhas.push(
        `[${RESPOSTAS[tipo] || tipo}] os mínimos de pessoal citam ${d.nome}\n`
        + `      «${m.diploma}»\n      ${d.nome} ${d.porque}`)
    }
  }
}

/* O texto que se mostra a uma casa SEM mínimos é o que lhe diz onde procurar.
   Foi exactamente aqui que mandei um centro de dia a um diploma revogado de
   outra resposta social. */
for (const [tipo, texto] of Object.entries(SEM_MINIMOS)) {
  for (const d of DIPLOMAS) {
    if (!d.procura.test(texto)) continue
    /* Dizer «a Portaria n.º 67/2012 NÃO se aplica aqui» é legítimo e é o que
       lá está. O que não pode é mandar procurar num diploma revogado. */
    if (d.so.length === 0) {
      falhas.push(
        `[${RESPOSTAS[tipo] || tipo}] o texto dos mínimos nomeia ${d.nome}, que ${d.porque}\n`
        + `      «${texto.slice(0, 120)}…»`)
    }
  }
}

/* ── 4. As funções do rácio citam a portaria das ERPI, e só ela ─────────── */
for (const f of FUNCOES) {
  if (!/^Portaria n\.º 67\/2012/.test(f.artigo)) {
    falhas.push(`a função «${f.naPortaria}» cita «${f.artigo}» — os rácios de FUNCOES são os da ERPI.`)
  }
}

if (falhas.length) {
  console.error(`\n✗ ${falhas.length} lei(s) atribuída(s) à resposta social errada:\n`)
  falhas.forEach(f => console.error(`  • ${f}\n`))
  process.exit(1)
}
console.log(`✓ check-diplomas: ${DIPLOMAS.length} diplomas, cada um só onde se aplica.`)
