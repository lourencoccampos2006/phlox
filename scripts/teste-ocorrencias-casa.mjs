// scripts/teste-ocorrencias-casa.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Quem é que uma ocorrência exige, aceita ou recusa.
//
// ── PORQUE E QUE ISTO PRECISA DE TESTES ────────────────────────────────────
// A regra erra para os dois lados, e as duas são más:
//
//   • DE MENOS: uma queda gravada sem dizer de quem. Não é uma ocorrência —
//     é uma nota inútil, e perde-se a única coisa que a tornava útil.
//   • DE MAIS: um corte de água que obriga a escolher um utente. Era o que
//     acontecia antes, e o resultado era não se registar de todo.
//
// E há um erro mais calado que esses: mudar o tipo de «Queda» para «Água» com
// um utente já escolhido, e gravar a falta de água na ficha dessa pessoa.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-ocorrencias-casa.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  TIPOS, POR_TIPO, rotuloTipo, exigePessoa, aceitaPessoa, eDaCasa,
  problemaNaOcorrencia, sobreQuem, POR_GRUPO,
} from '../lib/ocorrencias.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

// ── O catálogo ───────────────────────────────────────────────────────────────
console.log('\no catálogo')
{
  ok('os sete tipos da casa estão lá',
    ['agua', 'energia', 'incendio', 'seguranca', 'pragas', 'inspecao', 'obras']
      .every(id => POR_TIPO.has(id)))
  ok('e os de origem não desapareceram',
    ['fall', 'medication_error', 'choking', 'other'].every(id => POR_TIPO.has(id)),
    'uma ocorrência antiga tem de continuar a ter nome')
  ok('cada tipo tem ícone e ajuda', TIPOS.every(t => t.icone && t.ajuda))
  ok('nenhum id repetido', new Set(TIPOS.map(t => t.id)).size === TIPOS.length)
  ok('«Outro» é o último', TIPOS[TIPOS.length - 1].id === 'other',
    'é onde os olhos param quando nada serve')
}

// ── De quem é ────────────────────────────────────────────────────────────────
console.log('\nquem é que cada tipo exige')
{
  ok('uma queda EXIGE pessoa', exigePessoa('fall'))
  ok('um erro de medicação também', exigePessoa('medication_error'))
  ok('um engasgamento também', exigePessoa('choking'))

  ok('um corte de água NÃO aceita pessoa', !aceitaPessoa('agua'))
  ok('uma falha de energia também não', !aceitaPessoa('energia'))
  ok('uma visita de fiscalização também não', !aceitaPessoa('inspecao'))
  ok('falta de pessoal também não', !aceitaPessoa('ausencia_equipa'))

  ok('uma reclamação aceita mas não exige',
    aceitaPessoa('reclamacao') && !exigePessoa('reclamacao'))
  ok('um equipamento idem', aceitaPessoa('material') && !exigePessoa('material'))
  ok('transporte idem', aceitaPessoa('transporte') && !exigePessoa('transporte'))
}
{
  // O silêncio tem de manter o comportamento antigo: os tipos que já existiam
  // eram TODOS de uma pessoa, e nenhum deles declara `pessoa`.
  ok('um tipo sem `pessoa` declarado exige pessoa',
    exigePessoa('pressure_ulcer') && exigePessoa('infection') && exigePessoa('fuga'),
    'por omissão, uma ocorrência é de alguém — era assim antes')
  ok('um tipo desconhecido também exige', exigePessoa('tipo_que_nao_existe'),
    'falhar fechado: mais vale pedir a pessoa a mais do que gravar sem ela')
}

// ── A validação ──────────────────────────────────────────────────────────────
console.log('\nproblemaNaOcorrencia')
{
  ok('queda sem pessoa é recusada',
    !!problemaNaOcorrencia('fall', null), problemaNaOcorrencia('fall', null) || '')
  ok('e a frase diz qual é o tipo',
    /queda/i.test(problemaNaOcorrencia('fall', null) || ''),
    problemaNaOcorrencia('fall', null) || '')
  ok('queda COM pessoa passa', problemaNaOcorrencia('fall', 'p1') === null)

  ok('água sem pessoa passa', problemaNaOcorrencia('agua', null) === null,
    'era isto que o formulário não deixava fazer')
  ok('água COM pessoa também passa (limpa-se ao gravar)',
    problemaNaOcorrencia('agua', 'p1') === null)

  ok('reclamação sem pessoa passa', problemaNaOcorrencia('reclamacao', null) === null)
  ok('um tipo que não existe é recusado',
    !!problemaNaOcorrencia('inventado', 'p1'))
  ok('e a frase usa o nome que a casa dá às pessoas',
    /residente/i.test(problemaNaOcorrencia('fall', null, 'um residente') || ''),
    problemaNaOcorrencia('fall', null, 'um residente') || '')
}

// ── O que se lê na lista ─────────────────────────────────────────────────────
console.log('\nsobreQuem')
{
  ok('com nome, o nome', sobreQuem('fall', 'Dona Maria') === 'Dona Maria')
  ok('sem nome numa ocorrência da casa, «A casa»',
    sobreQuem('agua', null) === 'A casa',
    '«—» lia-se como «falta aqui o nome»')
  ok('sem nome numa de pessoa, continua o travessão',
    sobreQuem('fall', null) === '—',
    'aí falta mesmo — e tem de se ver que falta')
  ok('vazio conta como sem nome', sobreQuem('agua', '') === 'A casa')
}

// ── Os grupos do formulário ──────────────────────────────────────────────────
console.log('\nPOR_GRUPO — os dois grupos do seletor')
{
  ok('são dois', POR_GRUPO.length === 2)
  const pessoa = POR_GRUPO.find(g => g.id === 'pessoa')
  const casa = POR_GRUPO.find(g => g.id === 'casa')
  ok('a queda está no grupo das pessoas', pessoa.tipos.some(t => t.id === 'fall'))
  ok('a água está no grupo da casa', casa.tipos.some(t => t.id === 'agua'))
  ok('nenhum tipo fica de fora',
    pessoa.tipos.length + casa.tipos.length === TIPOS.length,
    `${pessoa.tipos.length} + ${casa.tipos.length} de ${TIPOS.length}`)
  ok('e nenhum aparece nos dois',
    !pessoa.tipos.some(t => casa.tipos.some(c => c.id === t.id)))
}

// ── Os rótulos ───────────────────────────────────────────────────────────────
console.log('\nrotuloTipo — substitui as duas cópias que havia')
{
  ok('água tem nome', rotuloTipo('agua') === 'Água')
  ok('queda tem nome', rotuloTipo('fall') === 'Queda')
  // As duas cópias que existiam (avisos.ts e passagemDeTurno.ts) só conheciam
  // sete tipos, e os outros saíam como «Ocorrência» — sem dizer o quê.
  ok('todos os tipos têm nome próprio',
    TIPOS.every(t => rotuloTipo(t.id) !== t.id && rotuloTipo(t.id) !== 'Ocorrência'),
    'os mapas antigos devolviam «Ocorrência» a metade deles')
  ok('um id desconhecido devolve o próprio id', rotuloTipo('xpto') === 'xpto')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ Uma queda exige pessoa, um cano rebentado não, e cada tipo tem nome.')
process.exit(falhas ? 1 : 0)
