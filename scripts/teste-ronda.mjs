// scripts/teste-ronda.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os avisos e os sinais vitais da ronda (sprint167).
//
// ── PORQUE E QUE ISTO PRECISA DE TESTES ─────────────────────────────────────
// Um aviso a menos e alguém leva um copo de água a quem bebe espessado. Um
// aviso a mais em toda a gente e a equipa deixa de os ler — e a partir daí o
// que falta é o que importa.
//
// Os vitais são outro caso: um engano de dedo (1200 em vez de 120) gravado
// como se fosse verdade fica na ficha para sempre e ninguém sabe de onde veio.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-ronda.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  avisosDe, avisoDaAnterior, oQueFicouDaAnterior, progressoDe, oQueFalta,
  vitaisPreenchidos, vitaisEmPalavras, foraDoEsperado, temVitais,
  CAMPOS_VITAIS, CORES,
} from '../lib/ronda.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nQUEM NAO TEM NADA NAO LEVA AVISOS')
{
  // Isto é o que impede a página de gritar com toda a gente. Um painel que
  // avisa sempre deixa de ser lido, e aí o aviso que importa passa também.
  ok('uma pessoa sem nada registado não gera avisos', avisosDe({}).length === 0)
  ok('dieta geral não é aviso', avisosDe({ diet: 'geral' }).length === 0)
  ok('quem anda sozinho não é aviso', avisosDe({ mobility: 'autonomo' }).length === 0)
  ok('quem está orientado não é aviso', avisosDe({ cognitive_status: 'orientado' }).length === 0)
  ok('campos vazios não contam', avisosDe({ allergies: '   ', diet: '' }).length === 0)
}

console.log('\nO QUE NAO PODE PASSAR DESPERCEBIDO')
{
  const a = avisosDe({ allergies: 'Penicilina' })
  ok('as alergias são críticas', a[0].nivel === 'critico' && a[0].texto.includes('Penicilina'))

  // O que motivou pôr isto em crítico: quem leva um copo de água a quem bebe
  // espessado faz mal, e a dieta estava enterrada na ficha.
  const d = avisosDe({ diet: 'espessada' })
  ok('a dieta espessada é crítica', d[0].nivel === 'critico', d[0].nivel)
  ok('e diz-se por extenso, não pelo código',
    d[0].texto === 'Dieta: líquidos espessados', d[0].texto)

  ok('todo o aviso diz de onde veio', avisosDe({ allergies: 'X', diet: 'mole' })
    .every(x => x.origem && x.origem.length > 3),
    'um aviso que ninguém consegue explicar é um aviso em que se deixa de acreditar')
}

console.log('\nOS RISCOS, ESCRITOS DE QUATRO MANEIRAS DIFERENTES')
{
  // A coluna aceita texto e números, e as instalações antigas têm de tudo.
  const tem = v => avisosDe({ fall_risk: v }).some(a => a.id === 'quedas')
  ok('"alto" conta', tem('alto'))
  ok('"Elevado" conta', tem('Elevado'))
  ok('"high" conta', tem('high'))
  ok('"sim" conta', tem('sim'))
  ok('o número 4 conta', tem(4))
  ok('o texto "4" também', tem('4'))
  ok('"baixo" não conta', !tem('baixo'))
  ok('o número 1 não conta', !tem(1))
  ok('vazio não conta', !tem('') && !tem(null) && !tem(undefined))
}

console.log('\nO QUE VEM DE OUTRAS TABELAS')
{
  const a = avisosDe({}, {
    feridas: [{ id: 'f1', location: 'sacro', dressing: 'hidrocolóide' }],
    ocorrencias: [{ id: 'o1', type: 'queda', date: '2026-09-20' }],
    pedidos: [{ id: 'p1', content: 'falar com a filha' }],
  })
  ok('uma ferida por fechar avisa', a.some(x => x.id === 'ferida-f1' && x.nivel === 'atencao'))
  ok('e diz onde e com quê', a.find(x => x.id === 'ferida-f1').texto.includes('sacro')
    && a.find(x => x.id === 'ferida-f1').texto.includes('hidrocolóide'))
  ok('uma ocorrência aberta avisa', a.some(x => x.id === 'ocor-o1' && x.nivel === 'atencao'))
  ok('um pedido por resolver aparece como nota',
    a.some(x => x.id === 'pedido-p1' && x.nivel === 'nota'),
    'não é urgente, mas é a coisa que a pessoa pediu e ninguém fez')
  ok('nenhuma destas rebenta quando a lista não vem',
    avisosDe({}, { feridas: undefined, ocorrencias: undefined }).length === 0)
}

console.log('\nOS CRITICOS VEM PRIMEIRO')
{
  const a = avisosDe(
    { mobility: 'cadeira', allergies: 'Ibuprofeno', fall_risk: 'alto' },
    { pedidos: [{ id: 'p', content: 'x' }] },
  )
  ok('primeiro o crítico', a[0].nivel === 'critico', a.map(x => x.nivel).join(','))
  ok('depois a atenção', a[1].nivel === 'atencao')
  ok('e as notas no fim', a[a.length - 1].nivel === 'nota')
  ok('cada nível tem a sua cor', Object.keys(CORES).length === 3
    && new Set(Object.values(CORES).map(c => c.cor)).size === 3)
  ok('nenhum id se repete', new Set(a.map(x => x.id)).size === a.length)
}

console.log('\nO QUE A RONDA ANTERIOR DEIXOU DITO')
{
  // A coisa que mais falta fazia. As 22h, saber que as 14h alguem escreveu
  // «queixou-se do joelho» muda a ronda; sem isto cada turno comeca do zero.
  const f = oQueFicouDaAnterior({ outcome: 'alerta', note: 'queixou-se do joelho', attended_name: 'Ana Silva' })
  ok('diz o estado, quem foi e o que escreveu',
    f.includes('alerta') && f.includes('Ana') && f.includes('joelho'), f)
  ok('só o primeiro nome de quem foi', f.includes('Ana') && !f.includes('Silva'))
  ok('só com nota, sem estado, diz a nota',
    oQueFicouDaAnterior({ note: 'dormiu bem' }).includes('dormiu bem'))
  ok('só com estado, diz o estado',
    oQueFicouDaAnterior({ outcome: 'estavel' }) === 'ficou estável',
    oQueFicouDaAnterior({ outcome: 'estavel' }))
  ok('sem ronda anterior, nada', oQueFicouDaAnterior(null) === null)
  ok('uma ronda anterior vazia não inventa frase',
    oQueFicouDaAnterior({ outcome: null, note: '  ' }) === null)

  ok('«alerta» na anterior vira aviso crítico',
    avisoDaAnterior({ outcome: 'alerta', note: 'x' })?.nivel === 'critico')
  ok('«vigiar» vira atenção',
    avisoDaAnterior({ outcome: 'vigiar', note: 'x' })?.nivel === 'atencao')
  ok('«estável» NÃO vira aviso',
    avisoDaAnterior({ outcome: 'estavel', note: 'x' }) === null,
    'senão toda a gente levava aviso e ninguém os leria')
  ok('sem anterior, sem aviso', avisoDaAnterior(null) === null)
}

console.log('\nO QUE FALTA A ESTA PESSOA')
{
  const t = (tipo, feita) => ({ id: Math.random() + '', tipo, titulo: 'x', feita })
  ok('nada marcado diz-se assim', oQueFalta([]) === 'Nada marcado para agora.')
  ok('tudo feito diz-se assim',
    oQueFalta([t('medicacao', true), t('cuidado', true)]) === 'Está tudo feito.')
  ok('um medicamento no singular',
    oQueFalta([t('medicacao', false)]) === 'Falta 1 medicamento.',
    oQueFalta([t('medicacao', false)]))
  ok('dois no plural',
    oQueFalta([t('medicacao', false), t('medicacao', false)]) === 'Falta 2 medicamentos.')
  ok('junta os tipos', (() => {
    const f = oQueFalta([t('medicacao', false), t('cuidado', false), t('cuidado', false)])
    return f.includes('1 medicamento') && f.includes('2 cuidados') && f.includes(' e ')
  })(), oQueFalta([t('medicacao', false), t('cuidado', false), t('cuidado', false)]))
  ok('as ações do plano têm nome próprio',
    oQueFalta([t('plano', false)]).includes('ação do plano'))
  ok('o que está feito não conta',
    oQueFalta([t('medicacao', true), t('cuidado', false)]) === 'Falta 1 cuidado.')

  const p = progressoDe([t('medicacao', true), t('cuidado', false), t('plano', false)])
  ok('o progresso conta certo', p.feitas === 1 && p.total === 3 && p.porFazer === 2)
  ok('uma lista vazia não divide por zero', progressoDe([]).total === 0)
}

console.log('\nOS SINAIS VITAIS: SO O QUE FOI MESMO ESCRITO')
{
  const v = vitaisPreenchidos({ bp_sys: '120', bp_dia: '80', hr: '', temp: '36,8' })
  ok('o que se escreveu vai', v.bp_sys === 120 && v.bp_dia === 80)
  ok('a vírgula portuguesa é aceite', v.temp === 36.8, `${v.temp}`)
  ok('um campo vazio NÃO vai como zero', !('hr' in v),
    'um zero gravado lê-se depois como uma medição feita')
  ok('nada escrito não dá objeto nenhum', !temVitais(vitaisPreenchidos({})))
  ok('com alguma coisa, dá', temVitais(v))
}

console.log('\nO ENGANO DE DEDO NAO PODE FICAR GRAVADO')
{
  // 1200 em vez de 120. Uma vez gravado, fica na ficha para sempre e ninguém
  // sabe de onde veio.
  ok('1200 de tensão é recusado', !('bp_sys' in vitaisPreenchidos({ bp_sys: '1200' })))
  ok('368 de temperatura é recusado', !('temp' in vitaisPreenchidos({ temp: '368' })))
  ok('uma SpO2 de 150% é recusada', !('spo2' in vitaisPreenchidos({ spo2: '150' })))
  ok('um pulso de 0 é recusado', !('hr' in vitaisPreenchidos({ hr: '0' })))
  ok('texto é recusado', !('hr' in vitaisPreenchidos({ hr: 'oitenta' })))
  ok('mas os valores possíveis passam todos', (() => {
    const v = vitaisPreenchidos({ bp_sys: '90', bp_dia: '50', hr: '45', temp: '35', spo2: '92', glucose: '70' })
    return Object.keys(v).length === 6
  })())
  ok('os extremos de cada campo cabem', CAMPOS_VITAIS.every(c => {
    const v = vitaisPreenchidos({ [c.id]: String(c.min) })
    const w = vitaisPreenchidos({ [c.id]: String(c.max) })
    return c.id in v && c.id in w
  }))
}

console.log('\nO QUE MERECE UM SEGUNDO OLHAR')
{
  ok('180 de sistólica assinala', foraDoEsperado('bp_sys', 180) === 'tensão alta')
  ok('120 não assinala nada', foraDoEsperado('bp_sys', 120) === null)
  ok('38 graus é febre', foraDoEsperado('temp', 38) === 'febre')
  ok('36,8 não', foraDoEsperado('temp', 36.8) === null)
  ok('SpO2 de 91 assinala', foraDoEsperado('spo2', 91) === 'oxigénio baixo')
  ok('SpO2 de 92 não', foraDoEsperado('spo2', 92) === null)
  ok('glicemia de 60 assinala baixa', foraDoEsperado('glucose', 60) === 'açúcar baixo')
  ok('um campo desconhecido não rebenta', foraDoEsperado('xpto', 5) === null)
  ok('NaN não assinala nada', foraDoEsperado('hr', NaN) === null)
}

console.log('\nOS VITAIS EM PALAVRAS')
{
  ok('TA junta-se', vitaisEmPalavras({ bp_sys: 120, bp_dia: 80 }) === 'TA 120/80')
  ok('só a sistólica também se diz',
    vitaisEmPalavras({ bp_sys: 120 }) === 'TA sist. 120')
  ok('a temperatura leva vírgula',
    vitaisEmPalavras({ temp: 36.8 }) === '36,8 °C', vitaisEmPalavras({ temp: 36.8 }))
  ok('tudo junto separa-se por pontos', (() => {
    const s = vitaisEmPalavras({ bp_sys: 130, bp_dia: 85, hr: 72, spo2: 97 })
    return s === 'TA 130/85 · 72 bpm · SpO₂ 97%'
  })(), vitaisEmPalavras({ bp_sys: 130, bp_dia: 85, hr: 72, spo2: 97 }))
  ok('vazio não dá texto', vitaisEmPalavras({}) === '' && vitaisEmPalavras(null) === '')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ A ronda diz o que é preciso saber, e só a quem tem alguma coisa a dizer.')
process.exit(falhas ? 1 : 0)
