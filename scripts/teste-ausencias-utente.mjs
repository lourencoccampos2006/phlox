// scripts/teste-ausencias-utente.mjs
// ─────────────────────────────────────────────────────────────────────────────
// As ausências dos utentes, e a aritmética de períodos que as suporta.
//
// ── O QUE AQUI PODE CORRER MAL ─────────────────────────────────────────────
// 1. OS LIMITES. «Está fora no primeiro dia?» e «no último?» são as duas
//    perguntas que uma versão escrita à pressa responde mal — e o erro é
//    invisível: o /o-dia deixa de pedir o banho de alguém que está cá, ou
//    continua a pedir a medicação de quem foi para o hospital esta manhã.
//
// 2. A SOBREPOSIÇÃO. Alguém regista uma consulta no meio de um internamento, e
//    os dias contam duas vezes. Num mês de trinta dias dava trinta e cinco de
//    ausência — e, com um acordo que desconte por dia fora, a faturação
//    descontava a mais.
//
// Por isso quase tudo aqui é sobre limites e sobreposições.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-ausencias-utente.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  estaFora, foraNoDia, ausenciaAtual, emPalavras, diasFora, diasForaNoMes,
  resumoDeQuemEstaFora,
} from '../lib/ausenciasDoUtente.ts'
import { dentroDoPeriodo, diasNoIntervalo, diasEntre, emPortugues } from '../lib/periodo.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

const a = (o = {}) => ({
  id: Math.random().toString(36).slice(2), patient_id: 'p1',
  tipo: 'hospital', inicio: '2026-10-05', fim: '2026-10-10',
  motivo: null, onde: null, notas: null, ...o,
})

// ── A aritmética partilhada ──────────────────────────────────────────────────
console.log('\nlib/periodo — a base partilhada com as ausências da equipa')
{
  ok('o mesmo dia é 0', diasEntre('2026-10-05', '2026-10-05') === 0)
  ok('um dia é 1', diasEntre('2026-10-05', '2026-10-06') === 1)
  ok('para trás é negativo', diasEntre('2026-10-06', '2026-10-05') === -1)
  // Em Portugal a hora de verão acaba no último domingo de outubro (dia 25 em
  // 2026). Essa noite tem 25 horas.
  ok('a noite da mudança da hora não come um dia',
    diasEntre('2026-10-24', '2026-10-26') === 2, `${diasEntre('2026-10-24', '2026-10-26')}`)
  ok('e a de março também não',
    diasEntre('2026-03-28', '2026-03-30') === 2, `${diasEntre('2026-03-28', '2026-03-30')}`)
  ok('atravessa o ano', diasEntre('2026-12-31', '2027-01-01') === 1)
  ok('fevereiro de um ano bissexto', diasEntre('2028-02-28', '2028-03-01') === 2,
    `${diasEntre('2028-02-28', '2028-03-01')} — 2028 é bissexto`)

  ok('data inválida não rebenta', diasEntre('isto-não-é-data', '2026-10-05') === 0)
  ok('e em português sai ao contrário', emPortugues('2026-10-05') === '05/10/2026')
  ok('null em português é vazio', emPortugues(null) === '')
}

// ── Os limites ───────────────────────────────────────────────────────────────
console.log('\nestaFora — os dois extremos contam')
{
  const au = a({ inicio: '2026-10-05', fim: '2026-10-10' })
  ok('véspera: está cá', !estaFora(au, '2026-10-04'))
  ok('PRIMEIRO dia: está fora', estaFora(au, '2026-10-05'))
  ok('ÚLTIMO dia: está fora', estaFora(au, '2026-10-10'))
  ok('dia seguinte: está cá', !estaFora(au, '2026-10-11'),
    'e volta sozinho, sem ninguém desligar nada')
}
{
  const au = a({ inicio: '2026-10-05', fim: null })
  ok('sem data de regresso continua fora', estaFora(au, '2027-06-01'),
    'um internamento sem alta não acaba por si')
  ok('mas na véspera estava cá', !estaFora(au, '2026-10-04'))
  ok('e diz-se «desde», não «até»', emPalavras(au) === 'No hospital desde 05/10/2026',
    emPalavras(au))
}
{
  const au = a({ inicio: '2026-10-05', fim: '2026-10-05' })
  ok('uma ausência de um dia é um dia', estaFora(au, '2026-10-05') && !estaFora(au, '2026-10-06'))
}

// ── Quem está fora ───────────────────────────────────────────────────────────
console.log('\nforaNoDia — o conjunto que o /o-dia usa para filtrar')
{
  const todas = [
    a({ patient_id: 'p1', inicio: '2026-10-01', fim: '2026-10-20' }),
    a({ patient_id: 'p2', inicio: '2026-11-01', fim: '2026-11-05' }),
    a({ patient_id: 'p3', inicio: '2026-09-01', fim: '2026-09-30' }),
  ]
  const s = foraNoDia(todas, '2026-10-10')
  ok('só quem está fora nesse dia', s.size === 1 && s.has('p1'), [...s].join(','))
  ok('a de novembro ainda não começou', !s.has('p2'))
  ok('a de setembro já acabou', !s.has('p3'))

  ok('num dia sem ninguém fora o conjunto é vazio',
    foraNoDia(todas, '2026-10-25').size === 0)

  // Duas ausências da mesma pessoa não a põem duas vezes.
  const duas = [
    a({ patient_id: 'p1', inicio: '2026-10-01', fim: '2026-10-20' }),
    a({ patient_id: 'p1', inicio: '2026-10-05', fim: '2026-10-06', tipo: 'consulta' }),
  ]
  ok('a mesma pessoa só entra uma vez', foraNoDia(duas, '2026-10-05').size === 1)
}
{
  const todas = [a({ patient_id: 'p1' }), a({ patient_id: 'p2', inicio: '2027-01-01' })]
  const at = ausenciaAtual(todas, 'p1', '2026-10-07')
  ok('a ausência em curso de uma pessoa', !!at && at.patient_id === 'p1')
  ok('quem não está fora não tem ausência atual',
    ausenciaAtual(todas, 'p2', '2026-10-07') === null)
}

// ── A SOBREPOSIÇÃO ───────────────────────────────────────────────────────────
console.log('\ndiasForaNoMes — dias sobrepostos contam UMA vez')
{
  const au = [
    a({ patient_id: 'p1', inicio: '2026-10-01', fim: '2026-10-10' }),   // 10 dias
    a({ patient_id: 'p1', inicio: '2026-10-05', fim: '2026-10-06', tipo: 'consulta' }), // dentro
  ]
  ok('uma consulta no meio de um internamento não acrescenta dias',
    diasForaNoMes(au, 'p1', '2026-10') === 10,
    `${diasForaNoMes(au, 'p1', '2026-10')} — somar os dois dava 12`)
}
{
  const au = [
    a({ patient_id: 'p1', inicio: '2026-10-01', fim: '2026-10-05' }),   // 5
    a({ patient_id: 'p1', inicio: '2026-10-20', fim: '2026-10-22' }),   // 3
  ]
  ok('ausências separadas somam', diasForaNoMes(au, 'p1', '2026-10') === 8,
    `${diasForaNoMes(au, 'p1', '2026-10')}`)
}
{
  // Uma ausência que atravessa o fim do mês só conta a parte que lá cai.
  const au = [a({ patient_id: 'p1', inicio: '2026-09-28', fim: '2026-10-03' })]
  ok('só a parte de outubro', diasForaNoMes(au, 'p1', '2026-10') === 3,
    `${diasForaNoMes(au, 'p1', '2026-10')} — dias 1, 2 e 3`)
  ok('e a parte de setembro conta em setembro',
    diasForaNoMes(au, 'p1', '2026-09') === 3, '28, 29 e 30')
}
{
  // Sem data de fim, conta até ao fim do mês — e não mais.
  const au = [a({ patient_id: 'p1', inicio: '2026-10-29', fim: null })]
  ok('sem regresso, conta até ao fim do mês', diasForaNoMes(au, 'p1', '2026-10') === 3,
    `${diasForaNoMes(au, 'p1', '2026-10')} — 29, 30 e 31`)
  ok('e o mês seguinte conta inteiro', diasForaNoMes(au, 'p1', '2026-11') === 30,
    `${diasForaNoMes(au, 'p1', '2026-11')} — novembro tem 30 dias`)
}
{
  const au = [a({ patient_id: 'p1', inicio: '2028-02-01', fim: null })]
  ok('fevereiro bissexto tem 29', diasForaNoMes(au, 'p1', '2028-02') === 29,
    `${diasForaNoMes(au, 'p1', '2028-02')}`)
  ok('e não bissexto tem 28',
    diasForaNoMes([a({ patient_id: 'p1', inicio: '2026-02-01', fim: null })], 'p1', '2026-02') === 28)
}
{
  ok('uma pessoa sem ausências dá zero', diasForaNoMes([], 'p1', '2026-10') === 0)
  ok('e as de OUTRA pessoa não contam',
    diasForaNoMes([a({ patient_id: 'p2' })], 'p1', '2026-10') === 0)
}

// ── diasFora num intervalo ───────────────────────────────────────────────────
console.log('\ndiasFora — contagem inclusiva')
{
  ok('cinco dias são cinco',
    diasFora(a({ inicio: '2026-10-05', fim: '2026-10-09' }), '2026-10-01', '2026-10-31') === 5)
  ok('fora do intervalo é zero',
    diasFora(a({ inicio: '2026-12-01', fim: '2026-12-05' }), '2026-10-01', '2026-10-31') === 0)
}

// ── O que se diz no ecrã ─────────────────────────────────────────────────────
console.log('\nresumoDeQuemEstaFora')
{
  const nomes = new Map([['p1', 'Dona Maria'], ['p2', 'Sr. António'], ['p3', 'Dona Rosa']])
  ok('sem ninguém fora não há linha',
    resumoDeQuemEstaFora([], nomes, '2026-10-07') === null,
    'uma caixa a dizer «ninguém está fora» é ruído em todos os dias normais')

  const uma = resumoDeQuemEstaFora([a({ patient_id: 'p1' })], nomes, '2026-10-07')
  ok('uma pessoa é nomeada', /Dona Maria/.test(uma || ''), uma || '')
  ok('e diz porquê', /hospital/i.test(uma || ''), uma || '')

  const tres = resumoDeQuemEstaFora(
    [a({ patient_id: 'p1' }), a({ patient_id: 'p2' }), a({ patient_id: 'p3' })],
    nomes, '2026-10-07')
  ok('três pessoas dão a contagem e os nomes',
    /3 pessoas/.test(tres || '') && /Dona Rosa/.test(tres || ''), tres || '')

  const semNome = resumoDeQuemEstaFora([a({ patient_id: 'px' })], new Map(), '2026-10-07')
  ok('sem nome não diz «undefined»', !/undefined/.test(semNome || ''), semNome || '')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ Os limites contam, os dias sobrepostos contam uma vez, e quem volta volta sozinho.')
process.exit(falhas ? 1 : 0)
