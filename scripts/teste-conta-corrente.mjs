// scripts/teste-conta-corrente.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A aritmética da conta-corrente de cada utente.
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES A SÉRIO ────────────────────────────
// Isto é dinheiro que se cobra a famílias. Um erro aqui é uma fatura errada
// enviada por email, e quem a recebe não tem como conferir — foi exactamente
// por não conseguir conferir que o Phlox precisou disto.
//
// ── E JÁ ERREI UMA VEZ, ANTES DE ENTREGAR ──────────────────────────────────
// A primeira versão somava os débitos DUAS vezes: uma vez pelos movimentos e
// outra pelo espelho `billing_entries.extras`, que o gatilho do sprint174
// mantém igual à soma deles. Num mês com 40 € de farmácia, cobrava 80.
//
// Por isso o teste mais importante deste ficheiro é o da dupla contagem, e
// está logo a seguir aos básicos.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-conta-corrente.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  extratoDoMes, saldoDe, saldoEmPalavras, somar, euro,
  mesAnterior, mesPorExtenso,
} from '../lib/contaCorrente.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

/** Uma mensalidade de mentira. */
const mens = (month, o = {}) =>
  ({ patient_id: 'p', month, fee: 0, subsidy: 0, extras: 0, discount: 0, paid: false, ...o })
/** Um movimento de mentira. */
const mov = (mes, sentido, valor, o = {}) =>
  ({ id: Math.random().toString(36).slice(2), patient_id: 'p', data: `${mes}-15`, mes, sentido, tipo: sentido === 'debito' ? 'farmacia' : 'pagamento', descricao: 'x', valor, ...o })

// ── Aritmética de cêntimos ───────────────────────────────────────────────────
console.log('\nsomar e euro — sem erro de vírgula flutuante')
{
  ok('0.1 + 0.2 dá 0.3 exacto', somar([0.1, 0.2]) === 0.3,
    `${somar([0.1, 0.2])} — a soma ingénua dá 0.30000000000000004`)
  ok('cem vezes 0.07', somar(Array(100).fill(0.07)) === 7, `${somar(Array(100).fill(0.07))}`)
  ok('subtrair também', somar([10, -9.99]) === 0.01, `${somar([10, -9.99])}`)
  ok('o euro leva duas casas', euro(5) === '5,00 €', euro(5))
  ok('e milhares à portuguesa', /^1.?234,50 €$/.test(euro(1234.5)), euro(1234.5))
  ok('zero é 0,00 €', euro(0) === '0,00 €')
}

// ── A DUPLA CONTAGEM ─────────────────────────────────────────────────────────
console.log('\nA DUPLA CONTAGEM — o erro que quase entreguei')
{
  // O gatilho do sprint174 põe `extras` igual à soma dos débitos do mês.
  // Portanto este é o estado REAL da base de dados depois de lançar 40 €.
  const m = [mens('2026-10', { fee: 500, extras: 40 })]
  const v = [mov('2026-10', 'debito', 25), mov('2026-10', 'debito', 15)]

  const e = extratoDoMes('2026-10', m, v)
  ok('o extrato cobra 540, não 580',
    e.totalDebitos === 540, `${e.totalDebitos}`)
  ok('e o saldo final é 540', e.saldoFinal === 540, `${e.saldoFinal}`)
  ok('as linhas de débito são 3 (mensalidade + 2 movimentos)',
    e.linhas.filter(l => l.debito).length === 3)
  ok('e `extras` NÃO aparece como linha',
    !e.linhas.some(l => /extras/i.test(l.descricao)),
    'apareceria e cobrava os 40 outra vez')

  ok('o saldo de hoje também cobra 540 uma vez só',
    saldoDe(m, v) === 540, `${saldoDe(m, v)}`)
}
{
  // O mesmo, mas com o mês JÁ PASSADO: é aqui que o saldo anterior se faz.
  const m = [mens('2026-09', { fee: 500, extras: 40 }), mens('2026-10', { fee: 500 })]
  const v = [mov('2026-09', 'debito', 40)]
  const e = extratoDoMes('2026-10', m, v)
  ok('o saldo que vem de setembro é 540, não 580',
    e.saldoAnterior === 540, `${e.saldoAnterior}`)
}

// ── O extrato de um mês ──────────────────────────────────────────────────────
console.log('\nextratoDoMes — cada número na sua linha')
{
  const m = [mens('2026-10', { fee: 800, subsidy: 300, discount: 50, extras: 12.4 })]
  const v = [
    mov('2026-10', 'debito', 12.4, { tipo: 'farmacia', descricao: 'Paracetamol', data: '2026-10-03' }),
    mov('2026-10', 'credito', 400, { tipo: 'pagamento', descricao: 'Transferência', data: '2026-10-08' }),
  ]
  const e = extratoDoMes('2026-10', m, v)

  ok('mensalidade, comparticipação e desconto em linhas separadas',
    e.linhas.filter(l => l.origem === 'acordo').length === 3,
    'juntos num «a pagar», a família não consegue conferir nada')
  ok('débitos: 800 + 12,40', e.totalDebitos === 812.4, `${e.totalDebitos}`)
  ok('créditos: 300 + 50 + 400', e.totalCreditos === 750, `${e.totalCreditos}`)
  ok('saldo final 62,40', e.saldoFinal === 62.4, `${e.saldoFinal}`)
  ok('a farmácia aparece com o tipo por extenso',
    e.linhas.some(l => /Farmácia — Paracetamol/.test(l.descricao)))
  ok('os movimentos vêm por data',
    e.linhas.filter(l => l.data).map(l => l.data).join(',') === '2026-10-03,2026-10-08')
}
{
  const e = extratoDoMes('2026-10', [], [])
  ok('mês sem nada dá extrato vazio e zeros',
    e.linhas.length === 0 && e.saldoFinal === 0 && e.saldoAnterior === 0)
}
{
  // Uma mensalidade a zero não deve desenhar linhas a 0,00 €.
  const e = extratoDoMes('2026-10', [mens('2026-10')], [])
  ok('uma mensalidade a zeros não gera linhas', e.linhas.length === 0,
    'linhas a 0,00 € enchem o papel e não dizem nada')
}

// ── O saldo arrasta-se ───────────────────────────────────────────────────────
console.log('\no saldo arrasta-se de mês para mês')
{
  const m = [
    mens('2026-08', { fee: 500 }),
    mens('2026-09', { fee: 500 }),
    mens('2026-10', { fee: 500 }),
  ]
  const v = [
    mov('2026-08', 'credito', 500),   // agosto pago por inteiro
    mov('2026-09', 'credito', 450),   // setembro pago a menos 50
  ]
  const e = extratoDoMes('2026-10', m, v)
  ok('quem pagou 50 a menos em setembro começa outubro a dever 50',
    e.saldoAnterior === 50, `${e.saldoAnterior}`)
  ok('e o mês fecha em 550', e.saldoFinal === 550, `${e.saldoFinal}`)
}
{
  // Um mês marcado como PAGO está liquidado e não arrasta nada.
  const m = [mens('2026-09', { fee: 500, paid: true }), mens('2026-10', { fee: 500 })]
  const e = extratoDoMes('2026-10', m, [])
  ok('um mês marcado como pago não arrasta dívida', e.saldoAnterior === 0,
    `${e.saldoAnterior} — era o que o «pago» sempre quis dizer no Phlox`)
}
{
  // E um pagamento lançado NUM mês já marcado como pago não cria crédito.
  const m = [mens('2026-09', { fee: 500, paid: true }), mens('2026-10', { fee: 500 })]
  const v = [mov('2026-09', 'credito', 500)]
  const e = extratoDoMes('2026-10', m, v)
  ok('e o pagamento desse mês não vira saldo a favor', e.saldoAnterior === 0,
    `${e.saldoAnterior} — senão o «pago» e o movimento somavam-se e davam −500`)
}
{
  // Adiantamento: fica a favor.
  const m = [mens('2026-10', { fee: 500 })]
  const v = [mov('2026-10', 'credito', 600, { tipo: 'adiantamento' })]
  const e = extratoDoMes('2026-10', m, v)
  ok('quem adianta fica com saldo a favor', e.saldoFinal === -100, `${e.saldoFinal}`)
  ok('e lê-se como tal', saldoEmPalavras(e.saldoFinal) === 'Tem 100,00 € a favor',
    saldoEmPalavras(e.saldoFinal))
}

// ── Palavras ─────────────────────────────────────────────────────────────────
console.log('\npalavras e datas')
{
  ok('zero é «está em dia»', saldoEmPalavras(0) === 'Está em dia')
  ok('dívida', saldoEmPalavras(42.5) === 'Fica a dever 42,50 €', saldoEmPalavras(42.5))
  ok('um cêntimo ainda é dívida', saldoEmPalavras(0.01).startsWith('Fica a dever'))
  ok('meio cêntimo arredonda para «em dia»', saldoEmPalavras(0.004) === 'Está em dia',
    'não se cobra meio cêntimo a ninguém')

  ok('o mês anterior de janeiro é dezembro do ano passado',
    mesAnterior('2026-01') === '2025-12')
  ok('e de outubro é setembro', mesAnterior('2026-10') === '2026-09')
  ok('por extenso', mesPorExtenso('2026-10') === 'outubro de 2026', mesPorExtenso('2026-10'))
  ok('março leva cedilha', mesPorExtenso('2026-03') === 'março de 2026')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ Cada número entra na conta uma vez, e o saldo arrasta-se como deve.')
process.exit(falhas ? 1 : 0)
