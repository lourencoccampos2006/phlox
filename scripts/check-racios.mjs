#!/usr/bin/env node
// scripts/check-racios.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A CONTA DOS RÁCIOS DÁ O QUE DEVE DAR?
//
// ── PORQUE É QUE ISTO É UMA GUARDA E NÃO UM TESTE QUE CORRI UMA VEZ ────────
// Porque é a única coisa no Phlox cujo resultado errado pode levar uma casa a
// trabalhar com menos gente do que a lei exige. Um rácio que diz «conforme» a
// um lar que tem uma ajudante para vinte utentes não é um defeito de ecrã.
//
// A casa de QA é um CENTRO DE DIA, e por isso o caminho do lar — que é
// precisamente o que tem mínimos legais — não se vê a abrir a aplicação. Esta
// guarda exercita-o.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/check-racios.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { lerRacios, emPalavras, FUNCOES } from '../lib/racios.ts'

const falhas = []
const eq = (o, q, oque) => {
  const a = JSON.stringify(o), b = JSON.stringify(q)
  if (a !== b) falhas.push(`${oque}\n      esperado: ${b}\n      obtido:   ${a}`)
}

const de = (papel, n) => Array.from({ length: n }, () => ({ role: papel }))

// ── 1. O arredondamento é PARA CIMA ─────────────────────────────────────────
// Nove utentes a 1:8 pedem dois ajudantes, não 1,125. Arredondar para baixo
// era dar por cumprido um quadro que não está.
{
  const r = lerRacios(de('auxiliar', 1), 9, 'nursing_home')
  const aux = r.racios.find(x => x.papel === 'auxiliar')
  eq(aux.pede, 2, '9 utentes a 1:8 pedem 2 ajudantes')
  eq(aux.cumpre, false, 'com 1 ajudante para 9 utentes, não cumpre')
  eq(aux.faltam, 1, 'falta 1 ajudante')
}

// ── 2. Oito utentes exatos pedem UM ─────────────────────────────────────────
{
  const aux = lerRacios(de('auxiliar', 1), 8, 'nursing_home').racios.find(x => x.papel === 'auxiliar')
  eq([aux.pede, aux.cumpre], [1, true], '8 utentes a 1:8 pedem 1, e 1 cumpre')
}

// ── 3. O DONO conta como direção ────────────────────────────────────────────
// Numa casa pequena é a mesma pessoa. Não a contar dizia a uma casa que tem
// diretor técnico que lhe falta um.
{
  const r = lerRacios([{ role: 'dono' }], 10, 'nursing_home')
  const dir = r.racios.find(x => x.papel === 'direcao')
  eq([dir.tem, dir.cumpre], [1, true], 'o dono conta como direção técnica')
  eq(r.foraDeRacio, 0, 'o dono não aparece como «fora de rácio»')
}

// ── 4. O VOCABULÁRIO ANTIGO conta ───────────────────────────────────────────
// `caregiver`, `nurse` e `admin` estão gravados na base de dados desde maio.
// A contar as cadeias em cru, essas pessoas desapareciam da conta.
{
  const r = lerRacios(
    [{ role: 'caregiver' }, { role: 'caregiver' }, { role: 'nurse' }, { role: 'admin' }],
    16, 'nursing_home')
  eq(r.racios.find(x => x.papel === 'auxiliar').tem, 2, '`caregiver` conta como ajudante')
  eq(r.racios.find(x => x.papel === 'enfermagem').tem, 1, '`nurse` conta como enfermagem')
  eq(r.racios.find(x => x.papel === 'direcao').tem, 1, '`admin` conta como direção')
  eq(r.foraDeRacio, 0, 'nenhum deles fica fora de rácio')
}

// ── 5. Quem está INATIVO não conta ──────────────────────────────────────────
{
  const r = lerRacios(
    [{ role: 'auxiliar', active: true }, { role: 'auxiliar', active: false }], 8, 'nursing_home')
  eq(r.racios.find(x => x.papel === 'auxiliar').tem, 1, 'quem saiu da casa não entra no rácio')
}

// ── 6. Um papel desconhecido não desaparece em silêncio ─────────────────────
// Entra em «fora de rácio», que é o número que a página mostra para a pessoa
// perceber que a conta não cobre toda a equipa.
{
  const r = lerRacios([{ role: 'administrativo' }, { role: 'coisa-que-nao-existe' }, { role: null }], 8, 'nursing_home')
  eq(r.foraDeRacio, 3, 'administrativo + papel desconhecido + sem papel = 3 fora de rácio')
}

// ── 7. O CENTRO DE DIA NÃO LEVA OS MÍNIMOS DO LAR ───────────────────────────
// A regra que mais importa aqui. A Portaria n.º 67/2012 é dos lares; aplicá-la
// a um centro de dia dava-lhe pendências que não lhe dizem respeito, ou
// pior, dava-lhe por conforme um quadro regulado por outro diploma.
{
  const r = lerRacios(de('auxiliar', 1), 40, 'day_care')
  eq(r.comMinimos, false, 'o centro de dia não tem mínimos nesta tabela')
  eq(r.emFalta.length, 0, 'sem mínimos, não há nada «em falta»')
  for (const x of r.racios) {
    eq([x.pede, x.cumpre, x.umPorCada], [null, null, null],
      `o centro de dia não recebe mínimo para «${x.naPortaria}»`)
  }
  eq(r.racios.find(x => x.papel === 'auxiliar').tem, 1, 'mas a contagem da casa aparece')
}

// ── 8. A CASA VAZIA não pede nada ───────────────────────────────────────────
// Uma casa que acabou de abrir, sem utentes, não deve abrir a página com
// quatro pendências vermelhas.
{
  const r = lerRacios([], 0, 'nursing_home')
  eq(r.racios.filter(x => x.pede > 0).length, 0, 'sem utentes, nenhuma função é exigida')
  eq(r.emFalta.length, 0, 'sem utentes, nada em falta')
}

// ── 9. A FRASE tem vírgula decimal ──────────────────────────────────────────
// «1 para cada 2.7» é um ponto decimal no meio de uma frase em português.
{
  const r = lerRacios(de('enfermagem', 3), 8, 'nursing_home')
  const enf = r.racios.find(x => x.papel === 'enfermagem')
  eq(emPalavras(enf, 8), '1 para cada 2,7', 'a frase usa vírgula decimal')
  eq(emPalavras({ ...enf, tem: 0 }, 8), 'Ninguém nesta função', 'zero diz-se por palavras')
  eq(emPalavras({ ...enf, tem: 4 }, 8), '1 para cada 2', 'um número inteiro não leva decimais')
  // Mais gente do que utentes: «1 para cada 0,7» não se diz.
  eq(emPalavras({ ...enf, tem: 3 }, 2), '3 para 2', 'com mais equipa do que utentes, inverte-se')
}

// ── 10. Todas as funções citam um artigo ────────────────────────────────────
// Um mínimo legal sem fonte não se mostra a ninguém.
for (const f of FUNCOES) {
  if (!/^Portaria n\.º 67\/2012, art\. 12\.º/.test(f.artigo)) {
    falhas.push(`a função «${f.naPortaria}» não cita o artigo: «${f.artigo}»`)
  }
  if (f.porCada === null && !f.fixo) {
    falhas.push(`a função «${f.naPortaria}» não diz nem rácio nem número fixo`)
  }
}

if (falhas.length) {
  console.error(`\n✗ ${falhas.length} falha(s) na conta dos rácios:\n`)
  falhas.forEach(f => console.error(`  • ${f}`))
  console.error('')
  process.exit(1)
}
console.log('✓ check-racios: a conta do quadro de pessoal dá o que deve dar.')
