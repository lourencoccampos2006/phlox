// scripts/teste-permissoes-finas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os DETALHES — o que se esconde dentro de uma ferramenta (sprint164).
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES PRÓPRIOS ───────────────────────────
// Estas permissões são ao contrário das outras, e é aí que mora o perigo. As
// normais são concessões: quem não a tem, não pode. Os detalhes são
// RESTRIÇÕES: quem não tem nada dito, VÊ.
//
// Se eu me enganasse no sentido, cada detalhe novo que acrescentasse ao
// catálogo escondia um pedaço a toda a gente que já usa o produto, de um dia
// para o outro, sem ninguém pedir e sem ninguém perceber porquê. A equipa de
// um lar abriria a ficha e faltava-lhe a medicação.
//
// As asserções estão escritas como frases sobre pessoas, para se perceber
// daqui a um ano se continuam a dizer o que devem.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-permissoes-finas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  DETALHES, DETALHES_POR_AREA, negar, podeDetalhe, detalhesTirados,
  permissoesDe, pode, AREAS, TODAS,
} from '../lib/permissoes.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nFALHA ABERTO: QUEM NAO TEM NADA DITO, VE')
{
  const auxiliar = permissoesDe('auxiliar')
  ok('uma auxiliar comum ve a parte do dinheiro da ficha',
    podeDetalhe(auxiliar, 'utentes.financeiro'))
  ok('e ve a medicacao SOS', podeDetalhe(auxiliar, 'medicacao.sos'))
  ok('uma lista vazia ve tudo', DETALHES.every(d => podeDetalhe([], d.id)))
  // Se isto falhar, cada detalhe novo esconde um pedaco a toda a gente.
  ok('nenhum detalhe esta no molde de nenhum papel',
    !TODAS.some(k => k.startsWith('nao:')))
}

console.log('\nSO DEIXA DE VER QUANDO ALGUEM LHE TIRA')
{
  const ana = [...permissoesDe('auxiliar'), negar('utentes.financeiro')]
  ok('a Ana deixou de ver a parte do dinheiro',
    podeDetalhe(ana, 'utentes.financeiro') === false)
  ok('continua a ver tudo o resto',
    DETALHES.filter(d => d.id !== 'utentes.financeiro').every(d => podeDetalhe(ana, d.id)))
  ok('e continua a poder abrir a ficha', pode(ana, 'utentes', 'ver'))
}

console.log('\nDUAS PESSOAS, A MESMA FERRAMENTA, COISAS DIFERENTES')
{
  // O pedido do Fernando, dito em codigo.
  const ana = [...permissoesDe('auxiliar'), negar('utentes.financeiro')]
  const rita = [...permissoesDe('auxiliar'), negar('utentes.historia')]

  ok('as duas abrem a ficha', pode(ana, 'utentes', 'ver') && pode(rita, 'utentes', 'ver'))
  ok('a Ana nao ve o dinheiro, a Rita ve',
    !podeDetalhe(ana, 'utentes.financeiro') && podeDetalhe(rita, 'utentes.financeiro'))
  ok('a Rita nao ve a historia de vida, a Ana ve',
    !podeDetalhe(rita, 'utentes.historia') && podeDetalhe(ana, 'utentes.historia'))
}

console.log('\nO CATALOGO ESTA COERENTE')
{
  const areas = new Set(AREAS.map(a => a.id))
  ok('todos os detalhes pertencem a uma area que existe',
    DETALHES.every(d => areas.has(d.area)),
    DETALHES.filter(d => !areas.has(d.area)).map(d => d.id).join(', '))
  ok('o id de cada detalhe comeca pela sua area',
    DETALHES.every(d => d.id.startsWith(d.area + '.')))
  ok('nao ha ids repetidos',
    new Set(DETALHES.map(d => d.id)).size === DETALHES.length)
  ok('todos explicam o que a pessoa deixa de ver',
    DETALHES.every(d => d.descricao && d.descricao.length > 15))
  ok('o agrupamento por area bate certo',
    Object.values(DETALHES_POR_AREA).flat().length === DETALHES.length)
}

console.log('\nOS TIPOS DE OCORRENCIA QUE SE PODEM ESCONDER EXISTEM MESMO')
{
  // Um detalhe `ocorrencias.reclamacao` que nao correspondesse a um tipo real
  // seria um interruptor que nao liga a nada — e ninguem daria por isso.
  const { TIPOS } = await import('../lib/ocorrencias.ts')
  const tipos = new Set(TIPOS.map(t => t.id))
  const dosTipos = DETALHES.filter(d => d.area === 'ocorrencias')
  ok('cada um corresponde a um tipo real',
    dosTipos.every(d => tipos.has(d.id.split('.')[1])),
    dosTipos.filter(d => !tipos.has(d.id.split('.')[1])).map(d => d.id).join(', '))
}

console.log('\nO RESUMO DIZ O QUE FOI TIRADO')
{
  const joao = [...permissoesDe('animacao'),
    negar('ocorrencias.reclamacao'), negar('utentes.financeiro')]
  const tirados = detalhesTirados(joao)
  ok('conta os dois', tirados.length === 2, `${tirados.length}`)
  ok('e so os dois', tirados.every(d => ['ocorrencias.reclamacao', 'utentes.financeiro'].includes(d.id)))
  ok('sem nada tirado, a lista e vazia', detalhesTirados(permissoesDe('auxiliar')).length === 0)
}

console.log(falhas ? `\n✗ ${falhas} falha(s).` : '\n✓ Os detalhes escondem o que devem, e so a quem devem.')
process.exit(falhas ? 1 : 0)
