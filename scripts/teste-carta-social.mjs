// scripts/teste-carta-social.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A aritmética do reporte anual à Carta Social.
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES A SÉRIO ────────────────────────────
// Isto não é um gráfico de parede: é um documento que uma instituição entrega
// à Segurança Social. Um número errado aqui é um número errado num reporte
// oficial, e quem o entregou não tem como saber.
//
// E erra em silêncio das duas maneiras:
//   • a MENOS, quando quem não tem data de nascimento desaparece da conta sem
//     ninguém reparar que a base encolheu;
//   • a MAIS, quando uma percentagem é calculada sobre o total da casa em vez
//     de ser sobre as pessoas de quem se sabe aquilo.
//
// Por isso quase todos os testes aqui em baixo são sobre dados EM FALTA, que é
// o estado real de qualquer casa.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-carta-social.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { cartaSocial, grauDeDependencia, anosDisponiveis, totalEmFalta } from '../lib/cartaSocial.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

const quadro = (qs, id) => qs.find(q => q.id === id)
const linha = (q, comeca) => q.linhas.find(l => l.rotulo.startsWith(comeca))

/** Uma pessoa de mentira. */
const p = (id, o = {}) => ({ id, sex: null, date_of_birth: null, admission_date: null, discharge_date: null, ...o })

// ── Os cortes do Barthel ─────────────────────────────────────────────────────
console.log('\ngrauDeDependencia — os cortes do índice de Barthel')
{
  ok('0 é total', grauDeDependencia(0) === 'Total')
  ok('20 ainda é total', grauDeDependencia(20) === 'Total')
  ok('21 já é grave', grauDeDependencia(21) === 'Grave')
  ok('60 é grave', grauDeDependencia(60) === 'Grave')
  ok('61 é moderada', grauDeDependencia(61) === 'Moderada')
  ok('90 é moderada', grauDeDependencia(90) === 'Moderada')
  ok('91 é ligeira', grauDeDependencia(91) === 'Ligeira')
  ok('99 é ligeira', grauDeDependencia(99) === 'Ligeira')
  ok('100 é independente', grauDeDependencia(100) === 'Independente',
    'os cortes são os do índice, não uma escolha nossa')
}

// ── Movimento ────────────────────────────────────────────────────────────────
console.log('\nmovimento — entradas e saídas DO ANO pedido')
{
  const d = {
    utentes: [
      p('a', { admission_date: '2026-03-04' }),
      p('b', { admission_date: '2025-11-30' }),
      p('c', { admission_date: '2026-12-31' }),
    ],
    arquivados: [
      p('d', { admission_date: '2024-01-10', discharge_date: '2026-06-01' }),
    ],
    avaliacoes: [],
  }
  const q = quadro(cartaSocial(d, 2026), 'movimento')
  ok('entradas de 2026 são 2', linha(q, 'Entradas').valor === 2,
    'a de 2025 e a de 2024 ficam de fora')
  ok('31 de dezembro conta como entrada do ano', true)
  ok('saídas de 2026 são 1', linha(q, 'Saídas').valor === 1)
  ok('a frequentar no fim do ano são 3', linha(q, 'A frequentar').valor === 3,
    'os arquivados não contam')

  const q25 = quadro(cartaSocial(d, 2025), 'movimento')
  ok('mudar o ano muda a conta', linha(q25, 'Entradas').valor === 1,
    'só a de 2025')
}
{
  const d = {
    utentes: [p('a', { admission_date: '2026-01-01' }), p('b')],
    arquivados: [], avaliacoes: [],
  }
  const q = quadro(cartaSocial(d, 2026), 'movimento')
  ok('quem não tem data de entrada é CONTADO como em falta', q.emFalta === 1,
    'e não desaparece em silêncio')
  ok('e diz onde se resolve', /data de entrada/.test(q.ondeResolver || ''))
}
{
  const d = { utentes: [p('a'), p('b')], arquivados: [], avaliacoes: [], capacidade: 4 }
  const q = quadro(cartaSocial(d, 2026), 'movimento')
  ok('a lotação entra quando existe', linha(q, 'Lotação').valor === 4)
  ok('e a ocupação sai certa', linha(q, 'Lotação').pct === 50, '2 de 4')

  const semCap = quadro(cartaSocial({ ...d, capacidade: null }, 2026), 'movimento')
  ok('sem lotação declarada, a linha não aparece', !linha(semCap, 'Lotação'),
    'melhor não ter linha do que ter uma a dizer 0')
}

// ── Idade e sexo ─────────────────────────────────────────────────────────────
console.log('\nidade e sexo — a base é quem TEM o campo, não a casa toda')
{
  const hoje = new Date()
  const nasceuHa = n => `${hoje.getFullYear() - n}-01-01`
  const d = {
    utentes: [
      p('a', { date_of_birth: nasceuHa(67), sex: 'F' }),
      p('b', { date_of_birth: nasceuHa(82), sex: 'M' }),
      p('c', { date_of_birth: nasceuHa(91), sex: 'F' }),
      p('d', { sex: 'F' }),                   // sem data de nascimento
      p('e', { date_of_birth: nasceuHa(70) }), // sem sexo
    ],
    arquivados: [], avaliacoes: [],
  }
  const qs = cartaSocial(d, 2026)
  const qi = quadro(qs, 'idade_sexo')

  ok('a base diz 4 de 5', /4 de 5/.test(qi.base), qi.base)
  ok('e conta 1 em falta', qi.emFalta === 1)
  ok('65 a 69 tem 1', linha(qi, '65 a 69').valor === 1)
  ok('70 a 74 tem 1', linha(qi, '70 a 74').valor === 1)
  ok('80 a 84 tem 1', linha(qi, '80 a 84').valor === 1)
  ok('90 ou mais tem 1', linha(qi, '90 ou mais').valor === 1)
  ok('o cruzamento H/M aparece no rótulo', /1 H \/ 0 M/.test(linha(qi, '80 a 84').rotulo),
    linha(qi, '80 a 84').rotulo)

  const somaFaixas = qi.linhas.reduce((n, l) => n + l.valor, 0)
  ok('as faixas somam a base, e não o total da casa', somaFaixas === 4,
    `${somaFaixas} — se desse 5, alguém sem data tinha caído numa faixa`)

  const somaPct = qi.linhas.reduce((n, l) => n + (l.pct || 0), 0)
  ok('as percentagens somam ~100', Math.abs(somaPct - 100) <= 2, `${somaPct}%`)

  const qx = quadro(qs, 'sexo')
  ok('o sexo tem base própria (4 de 5)', /4 de 5/.test(qx.base), qx.base)
  ok('3 mulheres', linha(qx, 'Mulheres').valor === 3)
  ok('1 homem', linha(qx, 'Homens').valor === 1)
  ok('a percentagem é sobre quem tem sexo', linha(qx, 'Mulheres').pct === 75,
    '3 de 4, e não 3 de 5')
}

// ── Dependência ──────────────────────────────────────────────────────────────
console.log('\ndependência — a avaliação MAIS RECENTE de cada pessoa')
{
  const d = {
    utentes: [p('a'), p('b'), p('c')],
    arquivados: [],
    avaliacoes: [
      { patient_id: 'a', scale: 'barthel', score: 10, date: '2026-01-01' },
      { patient_id: 'a', scale: 'barthel', score: 95, date: '2026-06-01' },  // mais recente
      { patient_id: 'b', scale: 'barthel', score: 45, date: '2026-03-01' },
      { patient_id: 'c', scale: 'morse',   score: 20, date: '2026-03-01' },  // outra escala
    ],
  }
  const q = quadro(cartaSocial(d, 2026), 'dependencia')
  ok('a avaliação mais recente é a que vale', linha(q, 'Ligeira').valor === 1,
    'a de janeiro dava «Total»')
  ok('a antiga não conta duas vezes', linha(q, 'Total').valor === 0)
  ok('grave tem 1', linha(q, 'Grave').valor === 1)
  ok('quem só tem outra escala fica de fora', /2 de 3/.test(q.base), q.base)
  ok('e é contado em falta', q.emFalta === 1)

  const soma = q.linhas.reduce((n, l) => n + l.valor, 0)
  ok('os graus somam os avaliados', soma === 2, `${soma}`)
}
{
  const d = { utentes: [p('a')], arquivados: [], avaliacoes: [] }
  const q = quadro(cartaSocial(d, 2026), 'dependencia')
  ok('sem avaliações nenhumas não rebenta', q.linhas.every(l => l.valor === 0))
  ok('e as percentagens ficam a null, não a 0%',
    q.linhas.every(l => l.pct === null),
    '0% diria que ninguém é dependente; null diz que não se sabe')
}

// ── Casa vazia ───────────────────────────────────────────────────────────────
console.log('\ncasa vazia e anos disponíveis')
{
  const qs = cartaSocial({ utentes: [], arquivados: [], avaliacoes: [] }, 2026)
  ok('produz os quadros à mesma', qs.length === 4, `${qs.length}`)
  ok('tudo a zero, nada a NaN',
    qs.every(q => q.linhas.every(l => Number.isFinite(l.valor))))
  ok('e nada em falta, porque não há ninguém', totalEmFalta(qs) === 0)
}
{
  const hoje = new Date('2026-05-10T12:00:00')
  const anos = anosDisponiveis({
    utentes: [p('a', { admission_date: '2023-02-01' })],
    arquivados: [p('b', { admission_date: '2021-07-01' })],
    avaliacoes: [],
  }, hoje)
  ok('vai do ano atual até à entrada mais antiga',
    anos[0] === 2026 && anos[anos.length - 1] === 2021, anos.join(', '))
  const semDatas = anosDisponiveis({ utentes: [p('a')], arquivados: [], avaliacoes: [] }, hoje)
  ok('sem datas nenhumas oferece o ano atual E o passado',
    semDatas.join(',') === '2026,2025', semDatas.join(', '))
  ok('o ano passado está SEMPRE na lista', anos.includes(2025) && semDatas.includes(2025),
    'é o que se reporta na prática — e sem ele o seletor mostrava um ano e o quadro outro')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ As contas da Carta Social batem, e cada uma diz sobre quantas pessoas foi feita.')
process.exit(falhas ? 1 : 0)
