// scripts/teste-calendario.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A aritmética do calendário do ano (sprint166).
//
// ── PORQUE E QUE ISTO PRECISA DE TESTES ─────────────────────────────────────
// Nada aqui dá erro quando está errado. Um feriado no dia a seguir ao certo,
// um aniversário que desaparece de três em quatro anos, fevereiro com 28 dias
// num ano bissexto — tudo isto desenha um calendário bonito e falso, que uma
// casa usa para montar escalas com meses de antecedência.
//
// As datas de Páscoa aqui em baixo não saíram de nenhuma conta minha: são as
// datas reais, escritas à mão, para a conta ter contra o que falhar.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-calendario.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  ehBissexto, diasDoMes, diasDoAno, pascoa, feriados, noAno, idadeQueFaz,
  grelhaDoMes, porDia, porExtenso, contarPorOrigem, ORIGENS, corDe,
} from '../lib/calendario.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nBISSEXTOS: A REGRA TODA, NAO SO O «DIVISIVEL POR 4»')
{
  ok('2024 foi bissexto', ehBissexto(2024))
  ok('2025 não', !ehBissexto(2025))
  ok('2026 não', !ehBissexto(2026))
  ok('2028 é', ehBissexto(2028))
  // As duas que a versão curta erra.
  ok('1900 NÃO foi bissexto (÷100 e não ÷400)', !ehBissexto(1900),
    'é a década em que nasceu quem hoje tem 100 anos')
  ok('2000 FOI (÷400)', ehBissexto(2000))
  ok('2100 não vai ser', !ehBissexto(2100))
  ok('1936 foi', ehBissexto(1936))
}

console.log('\nOS MESES TEM OS DIAS QUE TEM')
{
  ok('fevereiro de 2024 tem 29', diasDoMes(2024, 1) === 29, `${diasDoMes(2024, 1)}`)
  ok('fevereiro de 2026 tem 28', diasDoMes(2026, 1) === 28, `${diasDoMes(2026, 1)}`)
  ok('fevereiro de 1900 tem 28', diasDoMes(1900, 1) === 28)
  ok('fevereiro de 2000 tem 29', diasDoMes(2000, 1) === 29)
  ok('janeiro tem 31', diasDoMes(2026, 0) === 31)
  ok('abril tem 30', diasDoMes(2026, 3) === 30)
  ok('dezembro tem 31', diasDoMes(2026, 11) === 31)
  ok('um ano bissexto tem 366 dias', diasDoAno(2024) === 366)
  ok('e um normal 365', diasDoAno(2026) === 365)
  // A soma tem de bater certo, senão há um mês com o número errado.
  const soma = a => Array.from({ length: 12 }, (_, m) => diasDoMes(a, m)).reduce((x, y) => x + y)
  ok('os 12 meses de 2026 somam 365', soma(2026) === 365, `${soma(2026)}`)
  ok('os 12 meses de 2024 somam 366', soma(2024) === 366, `${soma(2024)}`)
}

console.log('\nA PASCOA, CONTRA AS DATAS REAIS')
{
  // Escritas à mão a partir das datas verdadeiras. Se a conta mudar, isto grita.
  const reais = {
    2020: [3, 12], 2021: [3, 4], 2022: [3, 17], 2023: [3, 9], 2024: [2, 31],
    2025: [3, 20], 2026: [3, 5], 2027: [2, 28], 2028: [3, 16], 2029: [3, 1],
    2030: [3, 21], 2035: [2, 25], 2038: [3, 25], 1900: [3, 15], 2000: [3, 23],
  }
  for (const [ano, [mes, dia]] of Object.entries(reais)) {
    const p = pascoa(+ano)
    ok(`Páscoa de ${ano}`, p.mes === mes && p.dia === dia,
      `deu ${p.dia}/${p.mes + 1}, devia ser ${dia}/${mes + 1}`)
  }
  // Os limites: a Páscoa nunca sai deste intervalo.
  let cedo = '12-31', tarde = '01-01'
  for (let a = 1900; a <= 2200; a++) {
    const p = pascoa(a)
    const s = `${String(p.mes + 1).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
    if (s < cedo) cedo = s
    if (s > tarde) tarde = s
  }
  ok('em 300 anos nunca é antes de 22 de março', cedo >= '03-22', cedo)
  ok('nem depois de 25 de abril', tarde <= '04-25', tarde)
  ok('e é sempre a um domingo', (() => {
    for (let a = 1900; a <= 2200; a++) {
      const p = pascoa(a)
      if (new Date(a, p.mes, p.dia).getDay() !== 0) return false
    }
    return true
  })())
}

console.log('\nOS FERIADOS PORTUGUESES')
{
  const f2026 = feriados(2026)
  const em = d => f2026.find(x => x.data === d)
  ok('são 14 (10 fixos + 4 ligados à Páscoa)', f2026.length === 14, `${f2026.length}`)
  ok('1 de janeiro é Ano Novo', em('2026-01-01')?.titulo === 'Ano Novo')
  ok('25 de abril lá está', em('2026-04-25')?.titulo === 'Dia da Liberdade')
  ok('25 de dezembro é Natal', em('2026-12-25')?.titulo === 'Natal')
  // 2026: Páscoa a 5 de abril.
  ok('Sexta-feira Santa a 3 de abril de 2026', em('2026-04-03')?.titulo === 'Sexta-feira Santa',
    JSON.stringify(f2026.filter(x => x.titulo.includes('Santa')).map(x => x.data)))
  ok('Domingo de Páscoa a 5 de abril', em('2026-04-05')?.titulo === 'Domingo de Páscoa')
  ok('Corpo de Deus a 4 de junho', em('2026-06-04')?.titulo === 'Corpo de Deus',
    JSON.stringify(f2026.filter(x => x.titulo.includes('Corpo')).map(x => x.data)))
  ok('o Carnaval vem assinalado e explicado',
    f2026.some(x => x.titulo === 'Carnaval' && x.detalhe?.includes('Tolerância')))
  ok('vêm por ordem de data',
    f2026.every((x, i) => i === 0 || f2026[i - 1].data <= x.data))
  ok('todos caem no ano pedido', f2026.every(x => x.data.startsWith('2026-')))
  ok('todos têm origem de feriado', f2026.every(x => x.origem === 'feriado'))
  // Num ano em que a Páscoa é a 31 de março, Corpo de Deus salta para maio.
  const f2024 = feriados(2024)
  ok('em 2024 o Corpo de Deus é a 30 de maio',
    f2024.some(x => x.titulo === 'Corpo de Deus' && x.data === '2024-05-30'),
    JSON.stringify(f2024.filter(x => x.titulo.includes('Corpo')).map(x => x.data)))
  ok('e a Sexta-feira Santa a 29 de março',
    f2024.some(x => x.titulo === 'Sexta-feira Santa' && x.data === '2024-03-29'))
  ok('nenhum ano entre 2020 e 2060 perde feriados', (() => {
    for (let a = 2020; a <= 2060; a++) if (feriados(a).length !== 14) return false
    return true
  })())
}

console.log('\n29 DE FEVEREIRO: O ANIVERSARIO QUE NAO EXISTE')
{
  // O pedido dele, dito em teste.
  const b = noAno('1936-02-29', 2024)
  ok('num ano bissexto fica no dia certo', b.data === '2024-02-29' && !b.movida, JSON.stringify(b))

  const n = noAno('1936-02-29', 2026)
  ok('num ano normal NÃO desaparece', n !== null,
    'senão a pessoa passava o aniversário sem ninguém se lembrar')
  ok('vai para 28 de fevereiro', n.data === '2026-02-28', n.data)
  ok('e diz que foi movida, para se poder explicar', n.movida === '2026-02-29',
    'sem isto a pessoa parecia ter nascido a 28')

  ok('1 de março continua a ser 1 de março', noAno('1950-03-01', 2026).data === '2026-03-01',
    'não se empurra nada para cima do 29')
  ok('28 de fevereiro de quem nasceu a 28 não leva aviso',
    noAno('1950-02-28', 2026).movida === undefined)
}

console.log('\nAS OUTRAS DATAS QUE SE REPETEM')
{
  ok('um aniversário normal cai no mesmo dia', noAno('1940-07-15', 2026).data === '2026-07-15')
  ok('31 de dezembro', noAno('1940-12-31', 2026).data === '2026-12-31')
  ok('uma data com hora atrás é aceite', noAno('1940-07-15T10:00:00Z', 2026).data === '2026-07-15')
  ok('31 de abril não existe e não se inventa', noAno('1940-04-31', 2026) === null)
  ok('lixo devolve nada', noAno('não é data', 2026) === null && noAno('', 2026) === null)
  ok('null não rebenta', noAno(null, 2026) === null)
}

console.log('\nQUE IDADE FAZ')
{
  ok('quem nasceu em 1940 faz 86 em 2026', idadeQueFaz('1940-03-02', 2026) === 86)
  ok('quem nasceu a 29/02/1936 faz 90 em 2026', idadeQueFaz('1936-02-29', 2026) === 90)
  ok('um ano no futuro não dá idade', idadeQueFaz('2030-01-01', 2026) === null)
  ok('sem data, nada', idadeQueFaz('', 2026) === null)
}

console.log('\nA GRELHA DO MES')
{
  // A semana começa à segunda, como em Portugal.
  const jan = grelhaDoMes(2026, 0)   // 1 de janeiro de 2026 é uma quinta-feira
  ok('janeiro de 2026 começa na 4.ª casa (quinta)',
    jan[0].findIndex(d => d === 1) === 3, `${jan[0].findIndex(d => d === 1)}`)
  ok('todas as semanas têm 7 casas', jan.every(s => s.length === 7))
  ok('os dias estão todos lá e uma só vez', (() => {
    const dias = jan.flat().filter(d => d !== null)
    return dias.length === 31 && dias.every((d, i) => d === i + 1)
  })())

  const fev24 = grelhaDoMes(2024, 1)
  ok('fevereiro de 2024 mostra o dia 29', fev24.flat().includes(29))
  ok('fevereiro de 2026 não mostra o 29', !grelhaDoMes(2026, 1).flat().includes(29))

  ok('todos os meses de 30 anos dão semanas certas', (() => {
    for (let a = 2000; a <= 2030; a++) for (let m = 0; m < 12; m++) {
      const g = grelhaDoMes(a, m)
      if (g.some(s => s.length !== 7)) return false
      if (g.flat().filter(d => d !== null).length !== diasDoMes(a, m)) return false
    }
    return true
  })())
  // Uma semana inteira vazia no fim é uma linha a mais no ecrã, todos os meses.
  ok('nunca sobra uma semana toda vazia', (() => {
    for (let a = 2000; a <= 2030; a++) for (let m = 0; m < 12; m++) {
      if (grelhaDoMes(a, m).some(s => s.every(d => d === null))) return false
    }
    return true
  })())
}

console.log('\nAGRUPAR E ESCREVER')
{
  const marcas = [
    { id: 'a', data: '2026-03-12', titulo: 'Tarde', origem: 'atividade', hora: '15:00' },
    { id: 'b', data: '2026-03-12', titulo: 'Manhã', origem: 'visita', hora: '10:30' },
    { id: 'c', data: '2026-03-12', titulo: 'Sem hora', origem: 'aniversario' },
    { id: 'd', data: '2026-04-01', titulo: 'Outro dia', origem: 'manual' },
  ]
  const m = porDia(marcas)
  ok('agrupa por dia', m.get('2026-03-12').length === 3 && m.get('2026-04-01').length === 1)
  ok('dentro do dia, por hora', m.get('2026-03-12').map(x => x.id).join('') === 'bac',
    m.get('2026-03-12').map(x => x.id).join(''))
  ok('o que não tem hora fica no fim',
    m.get('2026-03-12')[2].id === 'c', 'um aniversário não tem hora e não deve fingir que tem')
  ok('um dia sem nada não existe no mapa', m.get('2026-05-05') === undefined)
  ok('lista vazia não rebenta', porDia([]).size === 0)

  ok('a data lê-se em português', porExtenso('2026-03-12') === '12 de março', porExtenso('2026-03-12'))
  ok('com ano quando é preciso', porExtenso('2026-03-12', true) === '12 de março de 2026')
  ok('1 de janeiro sem zero à frente', porExtenso('2026-01-01') === '1 de janeiro')
  ok('lixo devolve-se como veio', porExtenso('xpto') === 'xpto')

  const c = contarPorOrigem(marcas)
  ok('conta por origem', c.atividade === 1 && c.visita === 1 && c.aniversario === 1 && c.manual === 1)
}

console.log('\nO CATALOGO DAS ORIGENS')
{
  ok('cada origem tem cor própria',
    new Set(ORIGENS.map(o => o.cor)).size === ORIGENS.length)
  ok('só uma é de marcar à mão',
    ORIGENS.filter(o => !o.auto).length === 1 && !ORIGENS.find(o => o.id === 'manual').auto)
  ok('uma origem desconhecida tem cor de reserva', corDe('marciana') === '#94a3b8')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ O ano bate certo, bissexto ou não, e a Páscoa cai onde cai mesmo.')
process.exit(falhas ? 1 : 0)
