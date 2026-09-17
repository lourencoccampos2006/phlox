// scripts/teste-sujeitos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// De quem e o documento.
//
// O que esta mesmo em jogo: juntar duas pessoas na mesma memoria e um erro que
// nao se desfaz -- os conselhos dados sobre uma passam a sair informados pelos
// exames da outra. Por isso a regra e ser conservador: na duvida, separado.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-sujeitos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  pedacosDoNome, chaveDoNome, compararNomes, escolherSujeito, nomeCurto, juntarGrafia,
} from '../lib/sujeitos.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── Limpar o nome ──────────────────────────────────────────────────────────
seccao('Limpar o nome tal como vem no papel')
{
  verificar('tira acentos e maiusculas',
    chaveDoNome('JOÃO SILVA') === 'joao silva', chaveDoNome('JOÃO SILVA'))
  verificar('tira as particulas (de, da, dos...)',
    chaveDoNome('Maria de Sousa dos Santos') === 'maria sousa santos', chaveDoNome('Maria de Sousa dos Santos'))
  verificar('tira tratamentos colados ao nome',
    chaveDoNome('Dr. António Costa') === 'antonio costa', chaveDoNome('Dr. António Costa'))
  verificar('tira a etiqueta "Utente:" que vem nos relatorios',
    chaveDoNome('Utente: Ana Pereira') === 'ana pereira', chaveDoNome('Utente: Ana Pereira'))
  verificar('espacos a mais nao contam',
    chaveDoNome('  Ana   Pereira  ') === 'ana pereira')
  verificar('numeros e simbolos do cabecalho caem',
    chaveDoNome('Ana Pereira (n.º 4821)') === 'ana pereira', chaveDoNome('Ana Pereira (n.º 4821)'))
  verificar('as iniciais mantem-se distinguiveis',
    pedacosDoNome('M. S. Costa').join('|') === 'm.|s.|costa', pedacosDoNome('M. S. Costa'))
  verificar('nome vazio nao rebenta', chaveDoNome('') === '' && chaveDoNome(null) === '')
}

// ── A mesma pessoa ─────────────────────────────────────────────────────────
seccao('E a mesma pessoa?')
{
  const c = (a, b) => compararNomes(a, b).confianca

  verificar('o mesmo nome, escrito ao contrario em maiusculas',
    c('Maria Silva Costa', 'MARIA SILVA COSTA') === 'certa')
  verificar('com e sem particula e a mesma pessoa',
    c('Maria da Silva Costa', 'Maria Silva Costa') === 'certa')
  verificar('iniciais no meio: certeza',
    c('M. S. Costa', 'Maria Silva Costa') === 'certa', compararNomes('M. S. Costa', 'Maria Silva Costa'))
  verificar('iniciais sem ponto tambem',
    c('Maria S Costa', 'Maria Silva Costa') === 'certa', compararNomes('Maria S Costa', 'Maria Silva Costa'))

  verificar('nome do meio em falta: provavel, nao certo',
    c('Maria Costa', 'Maria Silva Costa') === 'provavel', compararNomes('Maria Costa', 'Maria Silva Costa'))
  verificar('nome do meio diferente: provavel (casou, mudou)',
    c('Maria Silva Costa', 'Maria Pereira Costa') === 'provavel')

  // ── O que NAO se pode juntar ──────────────────────────────────────────────
  verificar('irmaos com o mesmo meio e apelido nao sao a mesma pessoa',
    c('Ana Maria Costa', 'Joao Maria Costa') === 'nenhuma', compararNomes('Ana Maria Costa', 'Joao Maria Costa'))
  verificar('so o primeiro nome nunca chega',
    c('Maria', 'Maria Silva Costa') === 'nenhuma', compararNomes('Maria', 'Maria Silva Costa'))
  verificar('so o apelido nunca chega',
    c('Costa', 'Maria Silva Costa') === 'nenhuma')
  verificar('pai e filho (mesmo nome, apelido diferente) ficam separados',
    c('Jose Manuel Sousa', 'Jose Manuel Ferreira') === 'nenhuma')
  verificar('nomes sem nada a ver',
    c('Ana Pereira', 'Rui Marques') === 'nenhuma')
  verificar('nome vazio nao junta nada',
    c('', 'Maria Silva Costa') === 'nenhuma')
}

// ── Escolher entre os conhecidos ───────────────────────────────────────────
seccao('A quem pertence, entre os que ja conhecemos')
{
  const conhecidos = [
    { id: 's1', nome: 'Maria Silva Costa', relacao: 'perfil' },
    { id: 's2', nome: 'Rui Marques Lopes', relacao: 'outro' },
  ]

  const e1 = escolherSujeito('MARIA SILVA COSTA', conhecidos)
  verificar('encontra o certo', e1.sujeito?.id === 's1' && e1.confianca === 'certa', e1)

  const e2 = escolherSujeito('Maria Costa', conhecidos)
  verificar('provavel continua a apontar, mas diz que e provavel',
    e2.sujeito?.id === 's1' && e2.confianca === 'provavel', e2)

  const e3 = escolherSujeito('Alberto Nunes', conhecidos)
  verificar('nome novo nao se agarra a ninguem',
    e3.sujeito === null && e3.confianca === 'nenhuma', e3)

  const e4 = escolherSujeito('', conhecidos)
  verificar('documento sem nome nao se agarra a ninguem',
    e4.sujeito === null && !e4.ambiguo, e4)

  // Dois parecidos: e melhor perguntar do que adivinhar.
  const irmas = [
    { id: 'a', nome: 'Ana Costa Ferreira' },
    { id: 'b', nome: 'Ana Sousa Ferreira' },
  ]
  const e5 = escolherSujeito('Ana Ferreira', irmas)
  verificar('duas pessoas parecidas: nao se escolhe, marca-se como ambiguo',
    e5.sujeito === null && e5.ambiguo === true, e5)

  // As grafias ja vistas contam.
  const comGrafias = [{ id: 's1', nome: 'Maria Silva Costa', grafias: ['M. S. Costa'] }]
  const e6 = escolherSujeito('M. S. Costa', comGrafias)
  verificar('uma grafia ja vista reconhece-se sem perguntar outra vez',
    e6.sujeito?.id === 's1' && e6.confianca === 'certa', e6)

  verificar('sem ninguem conhecido, nao ha escolha',
    escolherSujeito('Maria Costa', []).sujeito === null)
}

// ── Mostrar ────────────────────────────────────────────────────────────────
seccao('Como se mostra o nome')
{
  verificar('nome comprido encurta para primeiro + ultimo',
    nomeCurto('Maria Silva Costa Pereira') === 'Maria Pereira', nomeCurto('Maria Silva Costa Pereira'))
  verificar('nome de dois fica igual', nomeCurto('Ana Pereira') === 'Ana Pereira')
  verificar('nome de um fica igual', nomeCurto('Ana') === 'Ana')
  verificar('particulas nao entram no nome curto',
    nomeCurto('Maria de Sousa dos Santos') === 'Maria Santos', nomeCurto('Maria de Sousa dos Santos'))
  verificar('vazio e vazio', nomeCurto('') === '' && nomeCurto(null) === '')
}

seccao('As grafias que se vao vendo')
{
  const g1 = juntarGrafia([], 'Maria Silva Costa')
  verificar('a primeira grafia guarda-se', g1.length === 1)

  const g2 = juntarGrafia(g1, 'MARIA DA SILVA COSTA')
  verificar('a mesma grafia com outra pontuacao nao se repete', g2.length === 1, g2)

  const g3 = juntarGrafia(g2, 'M. S. Costa')
  verificar('uma grafia nova guarda-se', g3.length === 2, g3)

  let muitas = []
  const letras = 'abcdefghijklmnopqrst'
  for (const l of letras) muitas = juntarGrafia(muitas, `Nome${l} Apelido${l}`)
  verificar('a lista de grafias nao cresce para sempre', muitas.length === 8, muitas.length)

  verificar('grafia vazia nao entra', juntarGrafia(['Ana Pereira'], '').length === 1)
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
