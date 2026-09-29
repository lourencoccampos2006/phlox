// scripts/teste-estatisticas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// As contas das estatísticas, e a guarda que impede a IA de inventar (item 17).
//
// ── PORQUE E QUE ISTO PRECISA DE TESTES ─────────────────────────────────────
// Estes números vão a uma reunião de direção, a um relatório anual e à
// Segurança Social. Uma comparação mal feita não da erro: da uma descida de
// 40% que nunca aconteceu, e alguem toma uma decisao com ela.
//
// E ha aqui uma coisa que nenhum outro ficheiro deste projeto tem: uma IA a
// escrever sobre numeros. `numerosInventados` e a guarda que a impede de
// passar um numero que nao lhe foi dado — e essa guarda tem de estar certa,
// porque e a unica.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-estatisticas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  ultimosMeses, porMes, somaPorMes, comparar, variacaoEmPalavras,
  distribuir, contarPor, pct, media, mediana, anosDesde, mesesDesde,
  indicadores, factosParaIA, numerosPermitidos, numerosInventados, SECOES,
} from '../lib/estatisticas.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nOS DOZE MESES')
{
  const m = ultimosMeses(12, new Date(2026, 8, 27))   // setembro de 2026
  ok('são doze', m.length === 12)
  ok('o último é o mês corrente', m[11].iso === '2026-09', m[11].iso)
  ok('o primeiro é doze meses antes', m[0].iso === '2025-10', m[0].iso)
  ok('vêm do mais antigo para o mais recente',
    m.every((x, i) => i === 0 || m[i - 1].iso < x.iso))
  ok('os rótulos são curtos', m[11].rotulo === 'set 26', m[11].rotulo)
  // O bug classico: somar meses a partir do dia 31 salta fevereiro.
  const deTrinta = ultimosMeses(6, new Date(2026, 2, 31))  // 31 de março
  ok('a partir de 31 de março não salta fevereiro',
    deTrinta.map(x => x.iso).join(',') === '2025-10,2025-11,2025-12,2026-01,2026-02,2026-03',
    deTrinta.map(x => x.iso).join(','))
}

console.log('\nCONTAR POR MES')
{
  const meses = ultimosMeses(3, new Date(2026, 8, 15))  // jul, ago, set de 2026
  const linhas = [
    { date: '2026-07-03' }, { date: '2026-07-20' },
    { date: '2026-09-01' },
    { date: '2025-01-01' },            // fora do intervalo
    { date: null }, {},                 // sem data
  ]
  ok('conta por mês', porMes(linhas, 'date', meses).join(',') === '2,0,1',
    porMes(linhas, 'date', meses).join(','))
  ok('um mês sem linhas conta zero', porMes([], 'date', meses).join(',') === '0,0,0')
  ok('as de fora do intervalo não entram', porMes(linhas, 'date', meses).reduce((s, x) => s + x) === 3)
  ok('o filtro aplica-se',
    porMes(linhas, 'date', meses, l => l.date === '2026-07-03').join(',') === '1,0,0')
  ok('um instante com hora também conta',
    porMes([{ at: '2026-09-15T10:00:00Z' }], 'at', meses).join(',') === '0,0,1')

  const dinheiro = [
    { month: '2026-07-01', v: 100 }, { month: '2026-07-01', v: 50 },
    { month: '2026-09-01', v: 300 },
  ]
  ok('soma por mês', somaPorMes(dinheiro, 'month', x => x.v, meses).join(',') === '150,0,300',
    somaPorMes(dinheiro, 'month', x => x.v, meses).join(','))
}

console.log('\nA COMPARACAO EXCLUI O MES CORRENTE')
{
  // O primeiro erro deste ficheiro: comparar seis dias de setembro com trinta
  // de agosto da sempre uma queda que nao existe.
  const c = comparar([10, 20, 3])   // 3 = mes corrente, a meio
  ok('compara agosto com julho, e ignora setembro', c.agora === 20 && c.antes === 10,
    JSON.stringify(c))
  ok('a variação é sobre o mês anterior', c.variacao === 100, `${c.variacao}`)
  ok('a média não inclui o último nem o corrente', c.media === 10, `${c.media}`)

  const d = comparar([10, 20, 3], false)
  ok('quando se diz que o mês está completo, conta', d.agora === 3, `${d.agora}`)

  ok('uma série vazia não rebenta', comparar([]).agora === null)
  ok('um só mês não tem com que comparar', (() => {
    const x = comparar([5, 9])
    return x.agora === 5 && x.antes === null && x.variacao === null
  })())
  ok('nulos no meio não estragam a conta', (() => {
    const x = comparar([null, 10, null, 20, 3])
    return x.agora === 20 && x.antes === 10
  })())
  ok('não se divide por zero', comparar([0, 5, 1]).variacao === null,
    'de zero para cinco a variação percentual não existe')
  ok('uma descida dá negativo', comparar([100, 50, 1]).variacao === -50)
}

console.log('\nA VARIACAO EM PALAVRAS APONTA AO MES CERTO')
{
  const meses = ultimosMeses(3, new Date(2026, 8, 15))  // jul, ago, set
  const c = comparar([10, 20, 3])
  // Comparou agosto (indice 1) com julho (indice 0) -> «desde jul 26».
  ok('nomeia o mês com que comparou',
    variacaoEmPalavras(c, meses) === '+100% desde jul 26',
    variacaoEmPalavras(c, meses))
  ok('igual diz-se igual',
    variacaoEmPalavras(comparar([10, 10, 1]), meses) === 'igual ao mês anterior')
  ok('sem variação não se diz nada',
    variacaoEmPalavras(comparar([]), meses) === null)
}

console.log('\nDISTRIBUIR E CONTAR')
{
  const gente = [{ i: 60 }, { i: 70 }, { i: 80 }, { i: 90 }, { i: null }]
  const d = distribuir(gente, x => x.i, [
    { rotulo: 'ate 64', de: 0, ate: 64 },
    { rotulo: '65-84', de: 65, ate: 84 },
    { rotulo: '85+', de: 85 },
  ])
  ok('reparte por faixas', d.faixas.map(f => f.valor).join(',') === '1,2,1',
    d.faixas.map(f => f.valor).join(','))
  ok('diz sobre quantos contou', d.contados === 4 && d.total === 5,
    'uma média sobre metade das pessoas parece um facto e é meia verdade')
  ok('as faixas não se sobrepõem',
    d.faixas.reduce((s, f) => s + f.valor, 0) === d.contados)

  const tipos = contarPor([{ t: 'queda' }, { t: 'queda' }, { t: 'recusa' }, { t: null }], x => x.t)
  ok('conta por texto', tipos[0].rotulo === 'queda' && tipos[0].valor === 2)
  ok('por ordem decrescente', tipos.every((x, i) => i === 0 || tipos[i - 1].valor >= x.valor))
  ok('os sem valor não entram', tipos.length === 2)
}

console.log('\nAS CONTAS SIMPLES')
{
  ok('percentagem', pct(1, 4) === 25)
  ok('não se divide por zero', pct(5, 0) === null)
  ok('média', media([1, 2, 3]) === 2)
  ok('média de nada é nada', media([]) === null)
  // A mediana resiste ao valor extremo; a media nao.
  ok('a mediana ignora o extremo', mediana([1, 2, 3, 100]) === 2.5,
    `mediana ${mediana([1, 2, 3, 100])} vs média ${media([1, 2, 3, 100])}`)
  ok('mediana de um só', mediana([7]) === 7)
  ok('mediana de nada', mediana([]) === null)

  const anos = anosDesde('1940-01-01')
  ok('anos desde uma data', anos !== null && anos >= 85 && anos <= 87, `${anos}`)
  ok('uma data no futuro não dá negativo', anosDesde('2099-01-01') === null)
  ok('lixo não rebenta', anosDesde('xpto') === null && anosDesde(null) === null)
  ok('meses desde uma data', mesesDesde('2026-01-15') !== null)
  ok('meses de uma data futura é null', mesesDesde('2099-01-01') === null)
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS INDICADORES
   ═══════════════════════════════════════════════════════════════════════════ */

const MESES = ultimosMeses(12)
const mesDe = (n) => {
  const m = MESES[MESES.length - 1 - n]
  return `${m.iso}-15`
}

const VAZIO = {
  utentes: [], arquivados: [], membros: [], tomas: [], registos: [],
  ocorrencias: [], atividades: [], avaliacoes: [], mensalidades: [],
  financas: [], visitas: [], mensagens: [], capacidade: null,
}

console.log('\nUMA CASA SEM REGISTOS NAO INVENTA NUMEROS')
{
  const is = indicadores(VAZIO, MESES)
  ok('desenha todos os indicadores', is.length >= 18, `${is.length}`)
  ok('todos dizem o que falta, em vez de mostrar zero como se fosse um facto',
    is.every(i => i.vazio || i.numero === 0),
    is.filter(i => !i.vazio && i.numero !== 0).map(i => i.id).join(', '))
  ok('nenhum indicador tem número inventado',
    is.every(i => i.numero === null || Number.isFinite(i.numero)))
  ok('cada indicador explica-se',
    is.every(i => i.comoSeCalcula && i.comoSeCalcula.length > 25),
    is.filter(i => !i.comoSeCalcula || i.comoSeCalcula.length <= 25).map(i => i.id).join(', '))
  ok('todos pertencem a uma secção que existe',
    is.every(i => SECOES.some(s => s.id === i.secao)))
  ok('nenhum id se repete', new Set(is.map(i => i.id)).size === is.length)
  ok('todas as secções têm pelo menos um indicador',
    SECOES.every(s => is.some(i => i.secao === s.id)),
    SECOES.filter(s => !is.some(i => i.secao === s.id)).map(s => s.id).join(', '))
}

console.log('\nCOM DADOS, AS CONTAS BATEM')
{
  const d = {
    ...VAZIO,
    capacidade: 20,
    utentes: [
      { id: 'a', sex: 'F', date_of_birth: '1940-01-01', admission_date: mesDe(10) },
      { id: 'b', sex: 'F', date_of_birth: '1935-01-01', admission_date: mesDe(4) },
      { id: 'c', sex: 'M', date_of_birth: null, admission_date: null },
    ],
    arquivados: [
      { id: 'z', admission_date: '2024-01-15', discharge_date: '2025-01-15' },
    ],
    membros: [{ user_id: 'u1' }, { user_id: 'u2' }],
    tomas: [
      { date: mesDe(1), status: 'administered', recorded_by_id: 'u1' },
      { date: mesDe(1), status: 'administered', recorded_by_id: 'u1' },
      { date: mesDe(1), status: 'missed', recorded_by_id: 'u1' },
      { date: mesDe(2), status: 'administered', recorded_by_id: 'u2' },
    ],
    registos: [
      { date: mesDe(1), patient_id: 'a', recorded_by_id: 'u1' },
      { date: mesDe(1), patient_id: 'b', recorded_by_id: 'u1' },
    ],
    ocorrencias: [
      { date: mesDe(1), type: 'queda', status: 'closed' },
      { date: mesDe(1), type: 'recusa', status: 'open' },
    ],
    mensalidades: [
      { month: `${MESES[MESES.length - 2].iso}-01`, fee: 800, paid: true },
      { month: `${MESES[MESES.length - 2].iso}-01`, fee: 700, paid: false },
    ],
  }
  const is = indicadores(d, MESES)
  const de = (id) => is.find(i => i.id === id)

  ok('a lotação é 3 de 20', de('lotacao').valor === '15%', de('lotacao').valor)
  ok('a adesão do mês passado é 2 de 3', de('adesao').valor === '67%', de('adesao').valor)
  ok('as doses dadas são 3', de('doses').numero === 3, `${de('doses').numero}`)
  ok('a cobertura é 2 de 3 pessoas', de('cobertura').valor === '67%', de('cobertura').valor)
  ok('há 2 ocorrências e 1 queda',
    de('ocorrencias').numero === 2 && de('quedas').numero === 1)
  ok('metade das ocorrências está fechada', de('ocorrencias_fechadas').valor === '50%')
  ok('a idade média é sobre as 2 que têm data',
    de('idade_media').comoSeCalcula.includes('2 pessoas (de 3)'),
    de('idade_media').comoSeCalcula)
  ok('a permanência de quem saiu é 12 meses', de('permanencia').valor === '12',
    de('permanencia').valor)
  ok('as mulheres são 2 de 3', de('proporcao_mulheres').valor === '67%',
    de('proporcao_mulheres').valor)
  ok('as mensalidades somam 1500', de('mensalidades').numero === 1500,
    `${de('mensalidades').numero}`)
  ok('a cobrança é 1 de 2', de('cobranca').valor === '50%', de('cobranca').valor)
  ok('duas pessoas marcaram', de('quem_marca').valor === '2', de('quem_marca').valor)
  // u1 fez 2 registos + 2 doses = 4, de 5 marcacoes no total (2 registos + 3
  // doses dadas). 4/5 = 80%. Escrevi 83% a primeira vez, de cabeca.
  ok('a concentração numa pessoa é 80%', de('concentracao').valor === '80%',
    de('concentracao').valor)
  ok('as entradas contam quem saiu também', de('entradas').numero === 2,
    `${de('entradas').numero}`)
}

/* ═══════════════════════════════════════════════════════════════════════════
   A GUARDA CONTRA A IA INVENTAR
   ═══════════════════════════════════════════════════════════════════════════ */

console.log('\nOS FACTOS QUE VAO PARA A IA')
{
  const d = {
    ...VAZIO, capacidade: 20,
    utentes: [{ id: 'a', sex: 'F', date_of_birth: '1940-01-01', admission_date: mesDe(6) }],
    ocorrencias: [{ date: mesDe(1), type: 'queda', status: 'open' }],
  }
  const factos = factosParaIA(indicadores(d, MESES), MESES)
  ok('só vão factos com números', factos.length > 0)
  ok('cada facto tem o título e o valor', factos.every(f => f.includes(':')))
  ok('e diz se subir é bom ou mau', factos.every(f => /se subir e |se subir é /.test(f)),
    factos[0])
  // O que NAO pode ir: nomes, diagnosticos, linhas de registo.
  ok('nenhum nome de pessoa vai nos factos',
    !factos.some(f => /Maria|João|Ana|Silva/.test(f)))
  ok('os indicadores vazios não vão',
    !factos.some(f => f.includes('—')), factos.filter(f => f.includes('—')).join(' | '))
}

console.log('\nUM NUMERO QUE A IA NAO RECEBEU E APANHADO')
{
  const factos = [
    'Quedas: 14 (em 12 meses) · variação: +17% desde ago 26 · se subir é mau',
    'Adesão à medicação: 92% (do que foi marcado) · média dos meses anteriores: 88',
  ]
  const permitidos = numerosPermitidos(factos)
  ok('os números dos factos são reconhecidos',
    permitidos.has('14') && permitidos.has('17') && permitidos.has('92') && permitidos.has('88'))

  ok('uma frase fiel passa',
    numerosInventados('As quedas subiram 17% e a adesão está nos 92%.', permitidos).length === 0)

  // O bug que isto existe para apanhar.
  ok('«subiram 30%» é apanhado',
    numerosInventados('As quedas subiram 30%.', permitidos).join(',') === '30',
    numerosInventados('As quedas subiram 30%.', permitidos).join(','))
  ok('um total inventado é apanhado',
    numerosInventados('Houve 250 registos este mês.', permitidos).join(',') === '250')

  ok('os anos passam', numerosInventados('Em 2026 e em 2025.', permitidos).length === 0,
    'um ano numa frase não é uma estatística')
  ok('os números pequenos passam',
    numerosInventados('Há 3 coisas a melhorar, nos últimos 12 meses.', permitidos).length === 0,
    'contagens de um a doze aparecem em qualquer frase')
  ok('mas 13 já não passa se não foi dado',
    numerosInventados('13 pessoas.', permitidos).join(',') === '13')
  ok('a vírgula portuguesa é tratada como o ponto',
    numerosInventados('A média foi de 88,0.', new Set(['88.0'])).length === 0)
  ok('um negativo inventado é apanhado',
    numerosInventados('O resultado foi de -400 euros.', permitidos).join(',') === '-400')
  ok('não repete o mesmo número duas vezes',
    numerosInventados('30 e 30 outra vez.', permitidos).length === 1)
  ok('texto vazio não rebenta',
    numerosInventados('', permitidos).length === 0 && numerosInventados(null, permitidos).length === 0)
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ As contas batem, e um número que a IA não recebeu não passa.')
process.exit(falhas ? 1 : 0)
