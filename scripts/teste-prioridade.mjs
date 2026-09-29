// scripts/teste-prioridade.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A calculadora dos critérios de entrada (sprint165).
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES A SÉRIO ────────────────────────────
// Esta conta ordena pessoas numa lista de espera para um lar. Uma troca de
// sinal, uma faixa etária mal apanhada ou um zero silencioso numa pergunta
// sem resposta não dão erro nenhum: dão uma lista plausível, na ordem errada,
// que uma direção usa numa reunião a acreditar nela.
//
// É o tipo de bug que ninguém descobre, porque não há nada com que comparar.
//
// As asserções estão escritas como frases sobre pessoas.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-prioridade.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  pontuar, ordenar, idadeDe, mesesDeEspera, perguntas, porExtenso, estadoDe, ESTADOS,
} from '../lib/prioridade.ts'
import {
  SECCOES, seccoesPara, fichaVazia, paraColunas, paraFicha, completude, oQueFalta, rotuloDe,
} from '../lib/inscricao.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

// Os critérios semeados no sprint165, em miniatura.
const CRITERIOS = [
  { id: 'dep', nome: 'Grau de dependência', peso: 3, ordem: 1, opcoes: [
    { valor: 'autonomo', rotulo: 'Autónomo', pontos: 0 },
    { valor: 'parcial',  rotulo: 'Parcial',  pontos: 2 },
    { valor: 'total',    rotulo: 'Total',    pontos: 4 },
  ] },
  { id: 'fam', nome: 'Retaguarda familiar', peso: 3, ordem: 2, opcoes: [
    { valor: 'presente', rotulo: 'Presente', pontos: 0 },
    { valor: 'sozinho',  rotulo: 'Sozinho',  pontos: 4 },
  ] },
  { id: 'idade', nome: 'Idade', peso: 1, ordem: 8, automatico: 'idade', opcoes: [
    { valor: 'ate64',  rotulo: 'Até 64',  de: 0,  pontos: 0 },
    { valor: '65a74',  rotulo: '65 a 74', de: 65, pontos: 1 },
    { valor: '75a84',  rotulo: '75 a 84', de: 75, pontos: 2 },
    { valor: '85mais', rotulo: '85+',     de: 85, pontos: 3 },
  ] },
  { id: 'espera', nome: 'Tempo de espera', peso: 1, ordem: 9, automatico: 'espera', opcoes: [
    { valor: 'm0',  rotulo: '<6 meses', de: 0,  pontos: 0 },
    { valor: 'm6',  rotulo: '6-12',     de: 6,  pontos: 1 },
    { valor: 'm24', rotulo: '2-3 anos', de: 24, pontos: 3 },
  ] },
]
// Máximo: 4×3 + 4×3 + 3×1 + 3×1 = 12 + 12 + 3 + 3 = 30

const haMeses = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString() }
const nasceuHa = n => { const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

console.log('\nA CONTA BATE CERTO')
{
  const p = pontuar({
    respostas: { dep: 'total', fam: 'sozinho' },
    data_nascimento: nasceuHa(88), criada_em: haMeses(30),
  }, CRITERIOS)
  ok('o máximo é a soma dos melhores de cada critério', p.maximo === 30, `${p.maximo}`)
  ok('4×3 + 4×3 + 3×1 + 3×1 = 30', p.total === 30, `${p.total}`)
  ok('e isso são 100%', p.percentagem === 100, `${p.percentagem}%`)
  ok('nada ficou por responder', p.porResponder === 0)
  ok('e portanto não é provisória', p.provisoria === false)
}
{
  const p = pontuar({
    respostas: { dep: 'autonomo', fam: 'presente' },
    data_nascimento: nasceuHa(60), criada_em: haMeses(1),
  }, CRITERIOS)
  ok('quem não pontua em nada fica a zero', p.total === 0, `${p.total}`)
  ok('mas o máximo é o mesmo', p.maximo === 30)
  ok('e a ficha está completa à mesma', p.provisoria === false)
}

console.log('\nUMA PERGUNTA SEM RESPOSTA NAO PODE PASSAR EM SILENCIO')
{
  // O bug que isto existe para apanhar: contar zero e seguir. A pessoa descia
  // na lista por causa de um campo em branco e parecia um juízo sobre ela.
  const p = pontuar({
    respostas: { dep: 'total' },
    data_nascimento: nasceuHa(88), criada_em: haMeses(1),
  }, CRITERIOS)
  ok('conta a que falta', p.porResponder === 1, `${p.porResponder}`)
  ok('e diz que o número é provisório', p.provisoria === true)
  ok('a que falta vale zero', p.total === 12 + 3, `${p.total}`)
  ok('mas continua a contar para o máximo', p.maximo === 30,
    'senão 15/18 parecia melhor do que 15/30, e era a mesma ficha por acabar')
  ok('a linha sabe dizer que está por responder',
    p.linhas.find(l => l.criterio.id === 'fam').estado === 'por_responder')
}
{
  // Alguém editou o critério depois de a ficha estar preenchida.
  const p = pontuar({ respostas: { dep: 'grande', fam: 'presente' }, criada_em: haMeses(1) }, CRITERIOS)
  const l = p.linhas.find(x => x.criterio.id === 'dep')
  ok('uma resposta que já não existe não vale pontos', l.subtotal === 0)
  ok('e é apontada como antiga, não como em falta', l.estado === 'resposta_antiga')
  ok('e o resumo conta-a', p.desatualizadas === 1 && p.provisoria === true)
}
{
  const p = pontuar({ respostas: {}, criada_em: haMeses(1) }, CRITERIOS)
  ok('sem data de nascimento, a idade fica por responder',
    p.linhas.find(l => l.criterio.id === 'idade').estado === 'por_responder',
    'não se inventa uma idade a partir de nada')
}

console.log('\nAS FAIXAS AUTOMATICAS APANHAM AS PONTAS')
{
  const idadeDeQuem = anos => pontuar(
    { respostas: {}, data_nascimento: nasceuHa(anos), criada_em: haMeses(0) }, CRITERIOS,
  ).linhas.find(l => l.criterio.id === 'idade')

  ok('64 anos cai na faixa mais baixa', idadeDeQuem(64).opcao.valor === 'ate64')
  ok('exatamente 65 sobe de faixa', idadeDeQuem(65).opcao.valor === '65a74', idadeDeQuem(65).opcao.valor)
  ok('74 ainda é a mesma', idadeDeQuem(74).opcao.valor === '65a74')
  ok('exatamente 75 sobe', idadeDeQuem(75).opcao.valor === '75a84')
  ok('exatamente 85 chega à última', idadeDeQuem(85).opcao.valor === '85mais')
  ok('102 continua na última e não rebenta', idadeDeQuem(102).opcao.valor === '85mais')
  ok('30 anos não dá pontos mas dá faixa', idadeDeQuem(30).pontos === 0 && idadeDeQuem(30).opcao !== null)
}
{
  const esperaDe = meses => pontuar(
    { respostas: {}, criada_em: haMeses(meses) }, CRITERIOS,
  ).linhas.find(l => l.criterio.id === 'espera')
  ok('inscrito hoje está na faixa mais baixa', esperaDe(0).opcao.valor === 'm0')
  ok('5 meses ainda', esperaDe(5).opcao.valor === 'm0')
  ok('6 meses sobe', esperaDe(6).opcao.valor === 'm6')
  ok('23 meses continua em m6 (não há faixa 12)', esperaDe(23).opcao.valor === 'm6')
  ok('24 meses chega a m24', esperaDe(24).opcao.valor === 'm24')
  ok('o tempo de espera nunca fica por responder',
    esperaDe(0).estado === 'automatico', 'a data da inscrição existe sempre')
}

console.log('\nAS DUAS CONTAS DE CALENDARIO')
{
  ok('idade de quem nasceu há 80 anos e um dia', idadeDe(nasceuHa(80)) === 80)
  ok('quem faz anos amanhã ainda não os fez', (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 80); d.setDate(d.getDate() + 1)
    return idadeDe(d.toISOString().slice(0, 10)) === 79
  })())
  ok('quem faz anos hoje já os fez', (() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 80)
    return idadeDe(d.toISOString().slice(0, 10)) === 80
  })())
  // 29 de fevereiro: quem nasceu em ano bissexto faz anos em anos que não têm
  // o dia 29. Isto só pode dar um número, e tem de ser um número plausível.
  {
    const i = idadeDe('1936-02-29')
    ok('quem nasceu a 29 de fevereiro tem uma idade plausível',
      i !== null && i >= 88 && i <= 91, `${i}`)
  }
  ok('sem data, não há idade', idadeDe(null) === null && idadeDe('') === null)
  ok('uma data no futuro não dá idade negativa', idadeDe('2099-01-01') === null)
  ok('lixo não rebenta', idadeDe('não é uma data') === null)
  ok('espera nunca é negativa', mesesDeEspera(new Date(Date.now() + 8.64e7).toISOString()) === 0)
  ok('sem data de inscrição, zero meses', mesesDeEspera(null) === 0)
}

console.log('\nA ORDEM DA LISTA')
{
  const lista = [
    { nome: 'Maria', respostas: { dep: 'autonomo', fam: 'presente' }, data_nascimento: nasceuHa(70), criada_em: haMeses(40) },
    { nome: 'José',  respostas: { dep: 'total', fam: 'sozinho' },     data_nascimento: nasceuHa(90), criada_em: haMeses(1) },
    { nome: 'Ana',   respostas: { dep: 'parcial', fam: 'sozinho' },   data_nascimento: nasceuHa(80), criada_em: haMeses(7) },
  ]
  const o = ordenar(lista, CRITERIOS)
  ok('o mais dependente e mais sozinho vem à frente', o[0].candidatura.nome === 'José', o[0].candidatura.nome)
  ok('a Ana fica no meio', o[1].candidatura.nome === 'Ana')
  ok('o lugar começa em 1', o[0].lugar === 1 && o[2].lugar === 3)
  ok('cada um traz a sua conta', o.every(x => x.pontuacao.total >= 0 && x.pontuacao.maximo === 30))
}
{
  // O desempate. Sem ele a ordem dependia da ordem que a base devolveu — e
  // mudava entre duas leituras, o que numa reunião é indefensável.
  const a = { nome: 'Antiga', respostas: { dep: 'parcial', fam: 'presente' }, data_nascimento: nasceuHa(70), criada_em: haMeses(20) }
  const b = { nome: 'Nova',   respostas: { dep: 'parcial', fam: 'presente' }, data_nascimento: nasceuHa(70), criada_em: haMeses(7) }
  const o1 = ordenar([b, a], CRITERIOS)
  const o2 = ordenar([a, b], CRITERIOS)
  ok('empatados, ganha quem se inscreveu primeiro', o1[0].candidatura.nome === 'Antiga', o1[0].candidatura.nome)
  ok('e dá o mesmo qualquer que seja a ordem de entrada',
    o1.map(x => x.candidatura.nome).join() === o2.map(x => x.candidatura.nome).join())
}
{
  ok('uma lista vazia não rebenta', ordenar([], CRITERIOS).length === 0)
  ok('sem critérios nenhuns, ninguém pontua e não se divide por zero', (() => {
    const o = ordenar([{ nome: 'A', criada_em: haMeses(1) }], [])
    return o[0].pontuacao.percentagem === 0 && o[0].pontuacao.maximo === 0
  })())
  ok('um critério desligado não conta para nada', (() => {
    const p = pontuar({ respostas: { dep: 'total' }, criada_em: haMeses(1) },
      [{ ...CRITERIOS[0], ativo: false }])
    return p.maximo === 0 && p.total === 0
  })())
  ok('peso zero neutraliza um critério sem o apagar', (() => {
    const p = pontuar({ respostas: { dep: 'total' }, criada_em: haMeses(1) },
      [{ ...CRITERIOS[0], peso: 0 }])
    return p.total === 0 && p.maximo === 0
  })())
}

console.log('\nO CATALOGO E OS ESTADOS')
{
  ok('só as perguntas de responder aparecem para responder',
    perguntas(CRITERIOS).length === 2 && perguntas(CRITERIOS).every(c => !c.automatico))
  const p = pontuar({ respostas: { dep: 'total', fam: 'sozinho' }, data_nascimento: nasceuHa(88), criada_em: haMeses(30) }, CRITERIOS)
  const frase = porExtenso(p)
  ok('a conta diz-se em português', frase.includes('30 de 30') && frase.includes('dependência'), frase.slice(0, 60))
  ok('e quando falta alguma coisa, diz-se também',
    porExtenso(pontuar({ respostas: { dep: 'total' }, criada_em: haMeses(1) }, CRITERIOS)).includes('Faltam'))
  ok('quem não pontua em nada tem uma frase e não um vazio',
    porExtenso(pontuar({ respostas: {}, criada_em: haMeses(1) }, [CRITERIOS[0]])).length > 10)
  ok('só «em espera» conta para a lista',
    ESTADOS.filter(e => e.conta).length === 1 && estadoDe('em_espera').conta)
  ok('um estado desconhecido não rebenta', estadoDe('marciano').rotulo.length > 0)
}

console.log('\nA FICHA DE INSCRICAO')
{
  ok('a data de nascimento está lá', SECCOES.some(s => s.campos.some(c => c.id === 'data_nascimento')))
  // O pedido dele, dito em teste: «nem a sua data de nascimento é preciso».
  ok('e a IDADE escrita à mão desapareceu',
    !SECCOES.some(s => s.campos.some(c => c.id === 'idade' || c.utente === 'age')),
    'a idade sai da data, por gatilho, no sprint165')
  ok('nenhum campo se repete',
    (() => { const ids = SECCOES.flatMap(s => s.campos.map(c => c.id)); return new Set(ids).size === ids.length })())
  ok('todo o campo vai parar a alguma coluna',
    SECCOES.every(s => s.campos.every(c => c.utente || c.candidatura)))
  ok('as escolhas todas têm opções',
    SECCOES.every(s => s.campos.every(c => c.tipo !== 'escolha' || (c.opcoes && c.opcoes.length))))
  ok('o sexo mantém M/F, como já está gravado', (() => {
    const c = SECCOES.flatMap(s => s.campos).find(x => x.id === 'sexo')
    return c.opcoes.map(o => o.valor).sort().join() === 'F,M'
  })())
  ok('a ficha do utente é maior do que as 12 perguntas de antes',
    seccoesPara('utente').flatMap(s => s.campos).length > 12,
    `${seccoesPara('utente').flatMap(s => s.campos).length} campos`)
  ok('a inscrição pergunta coisas que a ficha do utente não tem',
    seccoesPara('candidatura').flatMap(s => s.campos).some(c => !c.utente))
}
{
  const ficha = fichaVazia('utente')
  ficha.nome = '  Maria Silva  '
  ficha.data_nascimento = '1938-04-02'
  ficha.peso = '61.5'
  const cols = paraColunas(ficha, 'utente')
  ok('o nome vai limpo de espaços', cols.name === 'Maria Silva', JSON.stringify(cols.name))
  ok('a data vai para date_of_birth', cols.date_of_birth === '1938-04-02')
  ok('o peso vai como número', cols.weight === 61.5 && typeof cols.weight === 'number')
  ok('um campo vazio vai como null e não como texto vazio',
    cols.address === null && !Object.values(cols).includes(''),
    'senão passa nos testes de «tem valor» e enche os documentos de linhas em branco')
  ok('um número vazio também é null', cols.height === null)
  ok('a idade NÃO é escrita', !('age' in cols), 'é o gatilho que a põe')

  // Num INSERT os vazios não vão. Não é só tamanho: uma coluna que ainda não
  // exista na base de dados (migração por correr) faz o PostgREST recusar o
  // pedido inteiro. Uma ficha que não lhe toque continua a gravar.
  const magro = paraColunas(ficha, 'utente', { omitirVazios: true })
  ok('no insert, os campos por preencher não vão', !('address' in magro))
  ok('mas o que foi preenchido vai todo',
    magro.name === 'Maria Silva' && magro.date_of_birth === '1938-04-02' && magro.weight === 61.5)
  ok('e no update vão, senão apagar um campo não o apagava',
    'address' in cols && cols.address === null)
}
{
  const linha = { name: 'João', date_of_birth: '1940-01-01', sex: 'M', mobility: 'cadeira', address: null }
  const f = paraFicha(linha, 'utente')
  ok('o que está na base volta ao formulário', f.nome === 'João' && f.data_nascimento === '1940-01-01')
  ok('um null volta como texto vazio e não como "null"', f.morada === '')
  ok('ida e volta não perde nada',
    paraColunas(paraFicha(linha, 'utente'), 'utente').mobility === 'cadeira')
  ok('a completude conta o que está preenchido',
    completude(linha, 'utente') > 0 && completude(linha, 'utente') < 100,
    `${completude(linha, 'utente')}%`)
  ok('uma ficha vazia é 0%', completude({}, 'utente') === 0)
  ok('o que falta diz-se por palavras',
    oQueFalta(linha, 'utente').includes('morada'), oQueFalta(linha, 'utente').slice(0, 3).join(', '))
  ok('um valor guardado mostra-se por extenso',
    rotuloDe('mobilidade', 'cadeira') === 'Cadeira de rodas', rotuloDe('mobilidade', 'cadeira'))
  ok('um valor desconhecido mostra-se como está, não em branco',
    rotuloDe('mobilidade', 'trotinete') === 'trotinete')
  ok('sem valor, nada', rotuloDe('mobilidade', null) === '')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ A lista ordena-se pelo que está no regulamento, e diz sempre porquê.')
process.exit(falhas ? 1 : 0)
