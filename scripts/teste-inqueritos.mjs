// scripts/teste-inqueritos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os números de um inquérito de satisfação dizem o que parecem dizer?
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES ────────────────────────────────────
// Porque um inquérito é entregue à Segurança Social e discutido numa reunião.
// Um número errado aqui não dá erro nenhum: passa a ser a opinião oficial da
// casa sobre si própria, e serve de base ao plano de melhoria do ano seguinte.
//
// Três maneiras de o número sair errado, todas caladas:
//
//   1. «NÃO SEI» CONTADO COMO MEIO. Quem não faz ideia da medicação do pai
//      responde «não sei». Somado como 3, puxa tudo para o centro e esconde
//      tanto o que está bom como o que está mau.
//   2. UMA MÉDIA SEM O `n` AO LADO. Um 4,7 de três respostas e um 4,7 de
//      quarenta são frases diferentes. Escritas da mesma maneira, a primeira
//      vira a verdade da casa.
//   3. UM ÍNDICE INVENTADO. Compor um «índice global» com a média de tudo dá
//      um número que não corresponde a pergunta nenhuma — e que ninguém
//      consegue explicar a quem o lê.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-inqueritos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  MODELO, DIMENSOES, POR_DIMENSAO, ESCALA, NAO_SEI, PROMESSA, perguntasDe,
  analisar, piores, melhores, comQuantas, confianca, comparar,
  estaAberto, oQueFalta, folhaParaImprimir, relatorioParaImprimir,
} from '../lib/inqueritos.ts'
import { buildPrintHTML } from '../lib/print.ts'

/**
 * Só o que se vê no papel.
 *
 * ── PORQUE É QUE ISTO FEZ FALTA ────────────────────────────────────────────
 * A primeira versão do teste «não há sítio nenhum para o nome» procurava a
 * palavra «assinatura» no HTML inteiro — e encontrou-a. Não numa linha do
 * formulário: num COMENTÁRIO DE CSS dentro do `<style>` do lib/print.ts.
 *
 * O teste acusou a folha de ter um campo que ela não tem. Um teste que grita
 * em falso gasta-se à primeira, e ensina a ignorar o que ele volte a dizer.
 */
const visivel = (html) => html
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

/* ══════════════════════════════════════════════════════════════════════════
   1. OS QUESTIONÁRIOS
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\nos três questionários')
{
  for (const publico of ['utentes', 'familias', 'equipa']) {
    const ps = MODELO[publico]
    ok(`«${publico}» tem perguntas`, ps.length >= 10, `${ps.length}`)
    ok(`  ids únicos`, new Set(ps.map(p => p.id)).size === ps.length)
    ok(`  todas as dimensões existem`,
      ps.every(p => POR_DIMENSAO.has(p.dimensao)),
      ps.filter(p => !POR_DIMENSAO.has(p.dimensao)).map(p => p.dimensao).join(', '))
    ok(`  uma e uma só pergunta «no geral»`,
      ps.filter(p => p.global).length === 1)
    ok(`  a do «no geral» não é aberta`,
      !ps.find(p => p.global).aberta,
      'é dela que sai o número global — tem de ter escala')
    ok(`  as abertas estão no fim`,
      ps.findIndex(p => p.aberta) === ps.length - ps.filter(p => p.aberta).length,
      'quem desiste a meio desiste depois das que se respondem num toque')
    ok(`  nenhuma pergunta vazia`, ps.every(p => p.texto.trim().length > 3))
  }
}
{
  // Os ids não podem colidir entre questionários: as respostas de todos vivem
  // na mesma tabela, e um `u_comida` de utentes a bater num de famílias
  // misturava dois inquéritos diferentes.
  const todos = ['utentes', 'familias', 'equipa'].flatMap(p => MODELO[p].map(q => q.id))
  ok('nenhum id se repete entre os três questionários',
    new Set(todos).size === todos.length)
}
{
  const a = perguntasDe('utentes')
  a[0].texto = 'ESTRAGADO'
  ok('`perguntasDe` devolve uma cópia',
    MODELO.utentes[0].texto !== 'ESTRAGADO',
    'o inquérito guarda a cópia dele; mexer nela não pode mexer no modelo')
}

/* ══════════════════════════════════════════════════════════════════════════
   2. AS CONTAS
   ══════════════════════════════════════════════════════════════════════════ */
const P = [
  { id: 'q1', dimensao: 'alimentacao', texto: 'A comida' },
  { id: 'q2', dimensao: 'alimentacao', texto: 'A variedade' },
  { id: 'q3', dimensao: 'cuidados', texto: 'A higiene' },
  { id: 'g', dimensao: 'global', texto: 'No geral', global: true },
  { id: 'txt', dimensao: 'global', texto: 'O que mudaria?', aberta: true },
]

console.log('\nanalisar — a média')
{
  const a = analisar(P, [
    { respostas: { q1: 4, q2: 2, q3: 5, g: 4, txt: 'mais fruta' } },
    { respostas: { q1: 2, q2: 2, q3: 5, g: 3, txt: '' } },
    { respostas: { q1: 3, q2: 4, q3: 4, g: 4 } },
  ])
  const q1 = a.porPergunta.find(r => r.pergunta.id === 'q1')
  ok('a média é a média', q1.media === 3, String(q1.media))
  ok('e traz o `n`', q1.n === 3)
  ok('a distribuição conta cada degrau',
    q1.distribuicao[4] === 1 && q1.distribuicao[2] === 1 && q1.distribuicao[3] === 1
      && q1.distribuicao[1] === 0 && q1.distribuicao[5] === 0,
    JSON.stringify(q1.distribuicao))
  ok('as perguntas abertas não entram nas médias',
    !a.porPergunta.some(r => r.pergunta.aberta))
  ok('e vêm na íntegra, sem as vazias',
    a.abertas[0].textos.length === 1 && a.abertas[0].textos[0] === 'mais fruta',
    JSON.stringify(a.abertas[0].textos))
  ok('são 3 respostas', a.respostas === 3)
}

console.log('\n«não sei» NÃO é o meio da escala')
{
  const a = analisar(P, [
    { respostas: { q1: 5 } },
    { respostas: { q1: 5 } },
    { respostas: { q1: null } },
    { respostas: { q1: null } },
  ])
  const q1 = a.porPergunta.find(r => r.pergunta.id === 'q1')
  ok('a média é 5 e não 4', q1.media === 5, String(q1.media))
  ok('e os «não sei» contam-se à parte', q1.naoSei === 2)
  ok('o `n` é só de quem respondeu de facto', q1.n === 2)
}

console.log('\nem branco não é «não sei»')
{
  const a = analisar(P, [
    { respostas: { q1: 4 } },
    { respostas: { q2: 3 } },   // nem respondeu nem disse «não sei» a q1
  ])
  const q1 = a.porPergunta.find(r => r.pergunta.id === 'q1')
  ok('quem não chegou à pergunta não conta como «não sei»',
    q1.n === 1 && q1.naoSei === 0,
    `n=${q1.n} naoSei=${q1.naoSei}`)
}

console.log('\nlixo nas respostas')
{
  const a = analisar(P, [
    { respostas: { q1: 9 } },        // fora da escala
    { respostas: { q1: 'quatro' } }, // texto numa pergunta de escala
    { respostas: { q1: 4 } },
  ])
  const q1 = a.porPergunta.find(r => r.pergunta.id === 'q1')
  ok('um valor fora da escala não entra', q1.n === 1 && q1.media === 4,
    `n=${q1.n} media=${q1.media}`)
  ok('nem conta como «não sei»', q1.naoSei === 0,
    'só o `null` é «não sei»; o resto é lixo e ignora-se')
}

console.log('\na média de uma dimensão')
{
  const a = analisar(P, [
    { respostas: { q1: 5, q2: 1 } },
    { respostas: { q1: 5, q2: 1 } },
  ])
  const d = a.porDimensao.find(x => x.dimensao.id === 'alimentacao')
  ok('é a média de todas as respostas da dimensão', d.media === 3, String(d.media))
  ok('e o `n` é o número de RESPOSTAS, não de pessoas', d.n === 4,
    `${d.n} — duas pessoas, duas perguntas cada`)
  ok('uma dimensão sem respostas nenhumas tem média nula',
    a.porDimensao.find(x => x.dimensao.id === 'cuidados').media === null)
  ok('só aparecem as dimensões que o questionário usa',
    a.porDimensao.every(x => P.some(p => p.dimensao === x.dimensao.id)),
    a.porDimensao.map(x => x.dimensao.id).join(', '))
}

console.log('\no número global NÃO é um índice composto')
{
  const a = analisar(P, [
    { respostas: { q1: 1, q2: 1, q3: 1, g: 5 } },
    { respostas: { q1: 1, q2: 1, q3: 1, g: 5 } },
  ])
  ok('o global é a resposta à pergunta do «no geral»', a.global.media === 5,
    String(a.global.media))
  ok('e não a média de tudo', a.global.media !== 2,
    'as pessoas podem queixar-se de tudo e ainda assim gostar da casa — e isso é um facto, não um erro')
  ok('traz o `n` dele', a.global.n === 2)
}
{
  const semGlobal = analisar(
    [{ id: 'x', dimensao: 'alimentacao', texto: 'A comida' }],
    [{ respostas: { x: 4 } }])
  ok('um questionário sem pergunta global não inventa um número',
    semGlobal.global === null)
}

console.log('\na taxa de resposta')
{
  const a = analisar(P, [{ respostas: { q1: 4 } }, { respostas: { q1: 4 } }], 8)
  ok('2 em 8 são 25%', a.taxa === 25, String(a.taxa))
  ok('sem convidados escritos, não há taxa',
    analisar(P, [{ respostas: { q1: 4 } }]).taxa === null,
    'melhor não ter número nenhum do que inventar o denominador')
}

/* ══════════════════════════════════════════════════════════════════════════
   3. O QUE ESTÁ PIOR
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\npiores — e o mínimo de respostas')
{
  const muitas = n => Array.from({ length: n }, () => ({ respostas: { q1: 4, q3: 3 } }))
  const a = analisar(P, [
    ...muitas(10),
    // q2 teve DUAS respostas, ambas no mínimo da escala.
    { respostas: { q2: 1 } }, { respostas: { q2: 1 } },
  ])
  const ps = piores(a, 5, 5)
  ok('a pergunta com 2 respostas não encabeça a lista',
    !ps.some(r => r.pergunta.id === 'q2'),
    'mandava a casa trabalhar no sítio errado')
  ok('mas continua na análise, com o `n` à frente',
    a.porPergunta.find(r => r.pergunta.id === 'q2').n === 2,
    'o mínimo decide a prioridade, não esconde o número')
  ok('a pior das que têm respostas suficientes vem primeiro',
    ps[0].pergunta.id === 'q3', ps.map(r => r.pergunta.id).join(', '))
  ok('a pergunta do «no geral» não entra nas prioridades',
    !ps.some(r => r.pergunta.global),
    '«o geral está mau» não é uma ação de melhoria')
}
{
  const muitas = n => Array.from({ length: n }, () => ({ respostas: { q1: 5, q3: 2 } }))
  const a = analisar(P, muitas(8))
  ok('melhores devolve o outro lado', melhores(a, 1, 5)[0].pergunta.id === 'q1')
}
{
  ok('sem respostas nenhumas, não há prioridades nem elogios',
    piores(analisar(P, []), 5, 5).length === 0
      && melhores(analisar(P, []), 3, 5).length === 0)
}

/* ══════════════════════════════════════════════════════════════════════════
   4. O QUE SE DIZ DO NÚMERO
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\ncomQuantas — o `n` viaja sempre com a média')
{
  ok('sem respostas, diz-se', /ningu[ée]m/i.test(comQuantas(0)), comQuantas(0))
  ok('uma resposta no singular', comQuantas(1) === '1 resposta')
  ok('com convidados, a percentagem', comQuantas(3, 12) === '3 respostas de 12 convidados (25%)',
    comQuantas(3, 12))
}

console.log('\nconfianca — o aviso no topo do relatório')
{
  const poucas = confianca(analisar(P, [{ respostas: { q1: 5 } }], 30))
  ok('com menos de 5 respostas, avisa', poucas.nivel === 'poucas', poucas.frase)
  ok('e manda ler as frases em vez dos números',
    /frases/.test(poucas.frase), poucas.frase)

  const seis = Array.from({ length: 6 }, () => ({ respostas: { q1: 4 } }))
  const baixa = confianca(analisar(P, seis, 100))
  ok('com taxa baixa, explica o enviesamento', baixa.nivel === 'alguma', baixa.frase)
  ok('e diz PORQUÊ', /extremos|respondem mais/.test(baixa.frase), baixa.frase)

  const boa = confianca(analisar(P, seis, 10))
  ok('com taxa razoável, só diz os números', boa.nivel === 'boa', boa.frase)
  ok('e mesmo assim diz quantos de quantos',
    /6 de 10/.test(boa.frase), boa.frase)
}

/* ══════════════════════════════════════════════════════════════════════════
   5. COMPARAR COM O ANO PASSADO
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\ncomparar')
{
  const seis = v => Array.from({ length: 6 }, () => ({ respostas: v }))
  const antes = analisar(P, seis({ q1: 4, q2: 3, q3: 5 }))
  const agora = analisar(P, seis({ q1: 2, q2: 3, q3: 5 }))
  const v = comparar(antes, agora, 5)
  ok('a que desceu vem primeiro', v[0].pergunta.id === 'q1', v.map(x => x.pergunta.id).join(', '))
  ok('com a diferença certa', v[0].diferenca === -2, String(v[0].diferenca))
  ok('e com o `n` dos dois anos', v[0].nAntes === 6 && v[0].nAgora === 6)
}
{
  const seis = v => Array.from({ length: 6 }, () => ({ respostas: v }))
  const antes = analisar(
    [{ id: 'velha', dimensao: 'alimentacao', texto: 'Já não se pergunta' }],
    seis({ velha: 2 }))
  const agora = analisar(
    [{ id: 'nova', dimensao: 'alimentacao', texto: 'Pergunta nova' }],
    seis({ nova: 5 }))
  ok('uma pergunta que só existe num dos anos fica de fora',
    comparar(antes, agora, 5).length === 0,
    'não subiu nem desceu: não havia')
}
{
  const antes = analisar(P, [{ respostas: { q1: 1 } }, { respostas: { q1: 1 } }])
  const agora = analisar(P, Array.from({ length: 9 }, () => ({ respostas: { q1: 5 } })))
  ok('uma pergunta com poucas respostas de um dos lados não entra',
    comparar(antes, agora, 5).length === 0,
    'uma «subida de 4 pontos» feita de duas respostas é ruído')
}

/* ══════════════════════════════════════════════════════════════════════════
   6. O ESTADO DO INQUÉRITO
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\noQueFalta')
{
  const base = {
    id: 'i1', titulo: 'Famílias 2026', publico: 'familias', ano: 2026,
    perguntas: perguntasDe('familias'), aberto_em: '2026-09-01',
  }
  const f = oQueFalta(base, 0, '2026-10-05')
  ok('sem convidados escritos, avisa', f.some(x => /convidadas/.test(x)), f.join(' | '))
  ok('e diz porque é que isso importa',
    f.some(x => /taxa de resposta/.test(x)))
  ok('sem respostas, avisa', f.some(x => /nenhuma resposta/.test(x)))

  const velho = oQueFalta({ ...base, convidados: 20, aberto_em: '2026-01-01' }, 12, '2026-10-05')
  ok('aberto há demasiado tempo, avisa', velho.some(x => /aberto h[áa] \d+ dias/.test(x)),
    velho.join(' | '))
  ok('e diz quantos dias', /277 dias/.test(velho.join(' ')), velho.join(' | '))

  const fechado = oQueFalta(
    { ...base, convidados: 20, fechado_em: '2026-10-01' }, 12, '2026-10-05')
  ok('fechado e com respostas, não falta nada', fechado.length === 0, fechado.join(' | '))
  ok('e deixa de estar aberto',
    !estaAberto({ ...base, fechado_em: '2026-10-01' }) && estaAberto(base))
}

/* ══════════════════════════════════════════════════════════════════════════
   7. A ESCALA
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\na escala')
{
  ok('tem cinco degraus', ESCALA.length === 5)
  ok('de 1 a 5', ESCALA[0].valor === 1 && ESCALA[4].valor === 5)
  ok('e um deles é o meio', ESCALA.some(e => e.valor === 3),
    '«Razoável» é uma resposta verdadeira e tem de caber')
  ok('cada dimensão explica-se', DIMENSOES.every(d => d.porque.length > 10))
}

/* ══════════════════════════════════════════════════════════════════════════
   8. O PAPEL
   ══════════════════════════════════════════════════════════════════════════
   O canal principal deste módulo. Não se verifica a clicar em «Imprimir» num
   browser — isso abre o diálogo do sistema e tranca a passagem. Verifica-se
   aqui, no HTML que o `printDoc` ia receber. */
console.log('\nfolhaParaImprimir — a folha em branco')
{
  const i = {
    id: 'i1', titulo: 'Famílias 2026', publico: 'familias', ano: 2026,
    perguntas: perguntasDe('familias'), aberto_em: '2026-10-01', convidados: 30,
  }
  const doc = folhaParaImprimir(i, 'Lar / ERPI')
  const html = buildPrintHTML(doc)

  ok('a promessa de anonimato vem ANTES da primeira pergunta',
    html.indexOf('anónima') < html.indexOf(MODELO.familias[0].texto),
    'quem não acredita que é anónimo responde outra coisa')
  ok('e está escrita por palavras, não por fórmula',
    html.includes('Ninguém nesta casa vai saber'),
    PROMESSA.slice(0, 40))

  const perguntas = MODELO.familias
  const faltam = perguntas.filter(p => !html.includes(p.texto.replace(/&/g, '&amp;')))
  ok('todas as perguntas estão na folha', faltam.length === 0,
    faltam.map(p => p.id).join(', '))

  for (const e of ESCALA) {
    ok(`  a escala tem «${e.rotulo}»`, html.includes(`☐ ${e.rotulo}`))
  }
  ok('e tem o «não sei»', html.includes(`☐ ${NAO_SEI.rotulo}`),
    'sem ele, quem não sabe escolhe o meio')

  const abertas = perguntas.filter(p => p.aberta)
  ok('as perguntas abertas levam linhas em vez de escala',
    abertas.length > 0 && html.includes('____'),
    `${abertas.length} abertas`)
  ok('as perguntas estão numeradas', html.includes('1.') && html.includes(`${perguntas.length}.`))
  // `visivel()` e nao `html`: ver a nota em cima.
  ok('e não há lá sítio nenhum para o nome',
    !/nome do respondente|assinatura|nome:/i.test(visivel(html)),
    'uma linha para o nome desfaz o módulo inteiro')
  ok('o título da casa aparece', html.includes('Lar / ERPI'))
}

console.log('\nrelatorioParaImprimir — o que fica na pasta')
{
  const i = {
    id: 'i1', titulo: 'Famílias 2026', publico: 'familias', ano: 2026,
    perguntas: perguntasDe('familias'), aberto_em: '2026-01-10',
    fechado_em: '2026-02-20', convidados: 30,
  }
  const oito = Array.from({ length: 8 }, () => ({
    respostas: {
      f_informacao: 2, f_contacto: 5, f_aspeto: 4, f_global: 4,
      f_mudar: 'mais notícias durante a semana',
    },
  }))
  const a = analisar(i.perguntas, oito, 30)
  const html = buildPrintHTML(relatorioParaImprimir(i, a, 'Lar / ERPI'))

  ok('o cabeçalho diz quantos de quantos', html.includes('8') && html.includes('30'))
  ok('e a taxa de resposta', html.includes('27%'), '8 de 30')
  ok('cada média leva o `n` ao lado',
    /2,00 · 8 respostas/.test(html), 'é a regra toda deste módulo')
  ok('a pior pergunta é nomeada',
    html.includes('O que lhe contam sobre o seu familiar'))
  ok('o que foi escrito aparece na íntegra',
    html.includes('mais notícias durante a semana'),
    'é daqui que saem as ações, não dos números')
  ok('e há onde escrever as ações de melhoria',
    html.includes('Ações de melhoria'),
    'a Segurança Social pede a análise E as ações')
  ok('o relatório diz que as respostas são anónimas por construção',
    /an[óo]nimas por constru[çc][ãa]o/.test(html))
  ok('diz que o inquérito foi fechado', html.includes('20/02/2026'))
}
{
  // O caso que mais interessa: poucas respostas.
  const i = {
    id: 'i2', titulo: 'Utentes 2026', publico: 'utentes', ano: 2026,
    perguntas: perguntasDe('utentes'), aberto_em: '2026-10-01', convidados: 28,
  }
  const a = analisar(i.perguntas, [{ respostas: { u_comida: 5, u_global: 5 } }], 28)
  const html = buildPrintHTML(relatorioParaImprimir(i, a, 'Lar / ERPI'))
  ok('com uma resposta, o relatório avisa logo no topo',
    /Aten[çc][ãa]o [àa] leitura/.test(html), 'e não escreve «4,7» como se fosse a casa')
  ok('e não propõe prioridades nenhumas',
    !html.includes('Onde agir primeiro'),
    'uma prioridade tirada de uma resposta manda trabalhar no sítio errado')
}

/* ══════════════════════════════════════════════════════════════════════════
   9. O QUE SE ESCREVE NÃO PARTE O DOCUMENTO
   ══════════════════════════════════════════════════════════════════════════ */
console.log('\no que as pessoas escrevem é texto, não HTML')
{
  const i = {
    id: 'i3', titulo: 'São José & Filhos — 2026', publico: 'familias', ano: 2026,
    perguntas: perguntasDe('familias'), aberto_em: '2026-10-01', convidados: 10,
  }
  const seis = Array.from({ length: 6 }, () => ({
    respostas: { f_global: 3, f_mudar: '<script>alert(1)</script> & o "horário" das visitas' },
  }))
  const html = buildPrintHTML(relatorioParaImprimir(i, analisar(i.perguntas, seis, 10), 'Lar'))
  ok('uma etiqueta escrita por alguém sai escapada',
    !html.includes('<script>alert(1)</script>'),
    'o texto de um inquérito vem de fora e vai para dentro de um documento')
  ok('mas o que a pessoa escreveu continua legível',
    html.includes('&lt;script&gt;') && html.includes('hor') ,
    'escapar não é apagar')
  ok('e o «&» do nome da casa não vira «&amp;» à vista',
    html.includes('S&atilde;o Jos&eacute;') === false && html.includes('&amp;'),
    'o & tem de ser escapado no HTML, e lê-se «&» no papel')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ «Não sei» não é o meio, o `n` viaja com a média, e a folha não tem onde pôr o nome.')
process.exit(falhas ? 1 : 0)
