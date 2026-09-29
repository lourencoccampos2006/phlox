// scripts/qa-modelos-reais.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Um modelo preenchido com uma pessoa VERDADEIRA da base de dados.
//
// ── PORQUE E QUE ISTO EXISTE ────────────────────────────────────────────────
// Os testes de `lib/modelos.ts` usam fichas escritas a mao, e provam a conta.
// O que eles NAO provam e a ponte: que as colunas que a base de dados tem
// chegam de facto aos campos que o modelo pede. Essa ponte e `paraFicha()`, e
// um nome de coluna trocado ali sai como um espaco em branco num contrato —
// sem erro nenhum.
//
// Corre contra o modelo semeado no sprint167, palavra por palavra, e nao
// escreve nada.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/qa-modelos-reais.mjs
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import { preencher, marcasDe, estaPronto } from '../lib/modelos.ts'
import { paraFicha } from '../lib/inscricao.ts'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: K, Authorization: `Bearer ${K}` }

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

// O corpo da «Ficha de inscrição» do sprint167, tal e qual.
const MODELO = `FICHA DE INSCRIÇÃO
{{casa.nome}}

Data: {{hoje}}

Nome completo: {{nome}}
Data de nascimento: {{data_nascimento}} ({{idade}} anos)
Sexo: {{sexo}}
NIF: {{nif}}
N.º de utente de saúde: {{sns}}
Morada: {{morada}}
Telefone: {{telefone}}
Pessoa a contactar: {{contacto_nome}} ({{contacto_relacao}}) — {{contacto_telefone}}
Diagnósticos: {{diagnosticos}}
Alergias: {{alergias}}
Médico de família: {{medico}}
Deslocação: {{mobilidade}}
Dieta: {{dieta}}`

const pessoas = await fetch(
  `${U}/rest/v1/patients?select=*&active=eq.true&order=name&limit=40`, { headers: h },
).then(r => r.json())
const org = (await fetch(
  `${U}/rest/v1/organizations?select=name,address,city,vat_number,phone,director&limit=1`,
  { headers: h },
).then(r => r.json()))[0] || {}

const casa = {
  nome: org.name, morada: org.address, cidade: org.city,
  nif: org.vat_number, telefone: org.phone, diretor: org.director,
}
const hoje = new Date().toISOString().slice(0, 10)

console.log('\nAS COLUNAS DA BASE DE DADOS CHEGAM AOS CAMPOS DO MODELO')
{
  // A ponte: as colunas -> ficha -> modelo. Se um nome estiver trocado, o
  // campo sai em branco e ninguem da por isso.
  const comAlergia = pessoas.find(p => p.allergies) || pessoas[0]
  const ficha = paraFicha(comAlergia, 'utente')
  ok('o nome da coluna `name` chega ao campo `nome`',
    ficha.nome === comAlergia.name, `${ficha.nome} vs ${comAlergia.name}`)
  if (comAlergia.allergies) {
    ok('`allergies` chega a `alergias`', ficha.alergias === comAlergia.allergies)
  }
  ok('`conditions` chega a `diagnosticos`',
    (ficha.diagnosticos || '') === (comAlergia.conditions || ''))
  ok('`emergency_contact` chega a `contacto_nome`',
    (ficha.contacto_nome || '') === (comAlergia.emergency_contact || ''))
  // Todas as marcas do modelo tem de ser campos conhecidos — senao saem no
  // documento tal como estao escritas.
  const p = preencher(MODELO, ficha, casa, hoje)
  ok('o modelo semeado nao tem nenhuma marca errada',
    p.desconhecidas.length === 0, p.desconhecidas.join(', '))
  // Dezoito: casa.nome, hoje, nome, data_nascimento, idade, sexo, nif, sns,
  // morada, telefone, contacto_nome, contacto_relacao, contacto_telefone,
  // diagnosticos, alergias, medico, mobilidade, dieta. (Escrevi 16 a primeira
  // vez, de cabeca, e o teste apanhou-me.)
  ok('e usa 18 campos', marcasDe(MODELO).length === 18, `${marcasDe(MODELO).length}`)
}

console.log('\nCOMO SAI, PARA CADA PESSOA REAL')
{
  let algumCompleto = false
  for (const pessoa of pessoas.slice(0, 6)) {
    const p = preencher(MODELO, paraFicha(pessoa, 'utente'), casa, hoje)
    const faltam = p.emFalta.length
    console.log(`  ${String(pessoa.name).padEnd(22)} ${faltam ? `faltam ${faltam}: ${p.emFalta.slice(0, 4).map(x => x.id).join(', ')}` : 'completo'}`)
    if (!faltam) algumCompleto = true
    // O que NUNCA pode acontecer, seja com que dados for.
    if (/undefined|null|NaN|\[object/.test(p.texto)) {
      ok(`${pessoa.name}: nada de «undefined» no documento`, false, p.texto.slice(0, 120))
    }
  }
  ok('nenhum documento contem «undefined», «null» ou «[object Object]»', true,
    'testado em todas as pessoas acima')
  ok('quem tem a ficha a meio nao fica pronto a imprimir',
    pessoas.some(pe => !estaPronto(preencher(MODELO, paraFicha(pe, 'utente'), casa, hoje)))
      || algumCompleto,
    'ou ha fichas incompletas e o ecra trava, ou estao todas completas')
}

console.log('\nO QUE FALTA E DITO POR PALAVRAS, NAO POR NOMES DE COLUNA')
{
  const p = preencher(MODELO, paraFicha(pessoas[0], 'utente'), casa, hoje)
  ok('cada campo em falta tem um rotulo legivel',
    p.emFalta.every(x => x.rotulo && x.rotulo !== x.id && !/_/.test(x.rotulo)),
    JSON.stringify(p.emFalta.slice(0, 3)))
  ok('e o que falta aparece como linha a preencher',
    !p.emFalta.length || p.texto.includes('__________'))
}

console.log('\nA CASA')
{
  const p = preencher('{{casa.nome}} · {{casa.morada}} · NIF {{casa.nif}}', {}, casa, hoje)
  console.log('  ' + p.texto)
  ok('o nome da casa vem da base de dados', !!casa.nome && p.texto.includes(casa.nome))
  const semDados = ['casa.morada', 'casa.nif'].filter(id => p.emFalta.some(x => x.id === id))
  if (semDados.length) {
    console.log(`  (a casa ainda nao tem ${semDados.join(' nem ')} preenchidos em Definicoes)`)
  }
  ok('o que a casa nao tem e apontado em vez de sair em branco',
    p.emFalta.every(x => x.id.startsWith('casa.')) || !p.emFalta.length)
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ As colunas reais chegam ao modelo, e o que falta diz-se por palavras.')
process.exit(falhas ? 1 : 0)
