// scripts/teste-areas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O mapa entre as areas de permissao e as tabelas / paginas.
//
// E daqui que sai a RLS. Um erro aqui nao e cosmetico: ou abre dados de uma
// casa a quem nao devia ve-los, ou tranca a porta a quem la trabalha a meio de
// um turno. Por isso o mapa e testado antes de gerar uma unica politica.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-areas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { AREA_DA_TABELA, SEM_AREA, AREA_DA_ROTA, areaDaRota, tabelasDaArea } from '../lib/areasDeDados.ts'
import { AREAS, POR_AREA, permissoesDe, pode } from '../lib/permissoes.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── O mapa e coerente com o catalogo ───────────────────────────────────────
seccao('O mapa e o catalogo falam a mesma lingua')
{
  const invalidas = Object.entries(AREA_DA_TABELA).filter(([, a]) => !POR_AREA.has(a))
  verificar('nenhuma tabela aponta para uma area que nao existe', invalidas.length === 0, invalidas)

  const rotasInvalidas = Object.entries(AREA_DA_ROTA).filter(([, a]) => !POR_AREA.has(a))
  verificar('nenhuma rota aponta para uma area que nao existe', rotasInvalidas.length === 0, rotasInvalidas)

  const sobrepostas = Object.keys(AREA_DA_TABELA).filter(t => SEM_AREA[t])
  verificar('nenhuma tabela esta nas duas listas ao mesmo tempo', sobrepostas.length === 0, sobrepostas)

  // Uma decisao de nao proteger tem de vir com a razao escrita. Sem isso, daqui
  // a seis meses ninguem sabe se foi decisao ou esquecimento.
  const semRazao = Object.entries(SEM_AREA).filter(([, r]) => !r || r.length < 20)
  verificar('todas as excecoes tem a razao escrita', semRazao.length === 0, semRazao.map(x => x[0]))
}

// ── As areas sensiveis estao mesmo cobertas ────────────────────────────────
seccao('As areas que mais importam tem tabelas')
{
  for (const area of ['utentes', 'medicacao', 'registos', 'ocorrencias', 'financeiro', 'registo_atividade']) {
    const t = tabelasDaArea(area)
    verificar(`${area} protege pelo menos uma tabela`, t.length > 0, t)
  }

  verificar('o financeiro cobre as tabelas de dinheiro',
    ['billing_entries', 'finance_entries'].every(t => AREA_DA_TABELA[t] === 'financeiro'))
  verificar('o registo de atividade protege o activity_log',
    AREA_DA_TABELA.activity_log === 'registo_atividade')
  verificar('a medicacao protege o mar_records',
    AREA_DA_TABELA.mar_records === 'medicacao')
}

// ── As rotas ───────────────────────────────────────────────────────────────
seccao('Que area protege cada pagina')
{
  verificar('/patients e utentes', areaDaRota('/patients') === 'utentes')
  verificar('/patients/abc tambem', areaDaRota('/patients/abc-123') === 'utentes')
  verificar('/mar e medicacao', areaDaRota('/mar') === 'medicacao')
  verificar('/faturacao e financeiro', areaDaRota('/faturacao') === 'financeiro')
  verificar('/historico e o registo de atividade', areaDaRota('/historico') === 'registo_atividade')
  verificar('a query string nao atrapalha', areaDaRota('/equipa?tab=mural') === 'equipa')
  verificar('uma pagina sem area devolve null', areaDaRota('/inicio') === null)
  verificar('caminho vazio nao rebenta', areaDaRota('') === null && areaDaRota(null) === null)

  // O prefixo mais longo ganha: senao /vigia-ruturas cairia em /vigia.
  verificar('o prefixo mais longo ganha',
    areaDaRota('/vigia-ruturas') === 'stock' && areaDaRota('/vigia') === 'medicacao',
    { ruturas: areaDaRota('/vigia-ruturas'), vigia: areaDaRota('/vigia') })
}

// ── O que isto quer dizer, na pratica, para cada papel ─────────────────────
seccao('O que cada pessoa deixa de poder abrir')
{
  const P = (papel) => permissoesDe(papel)

  const podeAbrir = (papel, rota) => {
    const area = areaDaRota(rota)
    if (!area) return true           // pagina sem area: aberta a quem esta na casa
    const a = POR_AREA.get(area)
    return a.niveis.some(n => pode(P(papel), area, n))
  }

  verificar('a auxiliar NAO abre a faturacao', !podeAbrir('auxiliar', '/faturacao'))
  verificar('a auxiliar NAO abre o painel do dono', !podeAbrir('auxiliar', '/painel-dono'))
  verificar('a auxiliar ABRE a medicacao a dar', podeAbrir('auxiliar', '/mar'))
  verificar('a auxiliar ABRE as ocorrencias', podeAbrir('auxiliar', '/incidents'))

  verificar('a animacao NAO abre a medicacao', !podeAbrir('animacao', '/mar'))
  verificar('a animacao NAO abre as feridas', !podeAbrir('animacao', '/feridas'))
  verificar('a animacao ABRE as atividades', podeAbrir('animacao', '/activities'))

  verificar('a administrativa ABRE a faturacao', podeAbrir('administrativo', '/faturacao'))
  verificar('a administrativa NAO abre a medicacao', !podeAbrir('administrativo', '/mar'))
  verificar('a administrativa NAO abre as feridas', !podeAbrir('administrativo', '/feridas'))

  verificar('o convidado NAO abre a faturacao', !podeAbrir('convidado', '/faturacao'))
  verificar('o convidado NAO abre o historico', !podeAbrir('convidado', '/historico'))
  verificar('o convidado ABRE os utentes', podeAbrir('convidado', '/patients'))

  verificar('a direcao tecnica abre tudo o que tem area',
    Object.keys(AREA_DA_ROTA).every(r => podeAbrir('direcao', r)),
    Object.keys(AREA_DA_ROTA).filter(r => !podeAbrir('direcao', r)))
  verificar('o dono tambem',
    Object.keys(AREA_DA_ROTA).every(r => podeAbrir('dono', r)))
}

// ── Cobertura ──────────────────────────────────────────────────────────────
seccao('Cobertura')
{
  const nTab = Object.keys(AREA_DA_TABELA).length
  const nSem = Object.keys(SEM_AREA).length
  console.log(`       ${nTab} tabelas com area, ${nSem} excecoes registadas`)
  verificar('ha um numero razoavel de tabelas mapeadas', nTab >= 40, nTab)

  const areasSemTabela = AREAS.filter(a => !a.acao && !tabelasDaArea(a.id).length).map(a => a.id)
  // `equipa` tem tabelas; `permissoes` e `definicoes` sao acoes. Se sobrar
  // alguma area de conteudo sem uma unica tabela, e sinal de mapa incompleto.
  verificar('nenhuma area de conteudo ficou sem tabelas', areasSemTabela.length === 0, areasSemTabela)
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
