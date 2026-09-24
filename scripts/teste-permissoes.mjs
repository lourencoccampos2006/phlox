// scripts/teste-permissoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Quem ve o que, e quem pode mexer.
//
// Um erro aqui nao e uma pagina feia: e uma auxiliar a ver as mensalidades das
// familias, ou uma administrativa a abrir a medicacao de toda a gente. E o
// contrario tambem custa -- uma enfermeira que nao consegue registar uma toma
// as tres da manha e um produto que nao serve.
//
// Por isso os testes de baixo sao afirmacoes sobre a CASA, nao sobre o codigo:
// "a auxiliar nao apaga nada", "o convidado nao ve contas".
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-permissoes.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  AREAS, GRUPOS, POR_AREA, TODAS, PAPEIS, POR_PAPEL, PAPEIS_ATRIBUIVEIS,
  chave, permissoesDe, pode, veArea, emPalavras, resumoCurto,
  PAPEL_ANTIGO_PARA_NOVO,
} from '../lib/permissoes.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── O catalogo esta coerente consigo proprio ───────────────────────────────
seccao('O catalogo')
{
  verificar('ha areas', AREAS.length >= 10, AREAS.length)
  verificar('nenhuma area repetida',
    new Set(AREAS.map(a => a.id)).size === AREAS.length)
  verificar('todas as areas tem grupo conhecido',
    AREAS.every(a => GRUPOS[a.grupo]), AREAS.filter(a => !GRUPOS[a.grupo]).map(a => a.id))
  verificar('todas as areas tem pelo menos um nivel',
    AREAS.every(a => a.niveis.length > 0))
  verificar('todas as areas tem label e descricao',
    AREAS.every(a => a.label && a.descricao))
  verificar('nenhum nivel invalido',
    AREAS.every(a => a.niveis.every(n => ['ver', 'editar', 'eliminar'].includes(n))))

  // Quem edita tem de poder ver. Uma permissao de editar sem a de ver seria
  // uma pessoa a escrever as cegas -- MENOS nas areas de acao (configurar a
  // casa, dar acessos), que nao se consultam, fazem-se. Essas declaram-no.
  const conteudo = AREAS.filter(a => !a.acao)
  verificar('nenhuma area de conteudo permite editar sem permitir ver',
    conteudo.filter(a => a.niveis.includes('editar')).every(a => a.niveis.includes('ver')),
    conteudo.filter(a => a.niveis.includes('editar') && !a.niveis.includes('ver')).map(a => a.id))
  verificar('as areas de acao so tem editar, e dizem-no',
    AREAS.filter(a => a.acao).every(a => a.niveis.length === 1 && a.niveis[0] === 'editar'),
    AREAS.filter(a => a.acao).map(a => ({ id: a.id, niveis: a.niveis })))

  verificar('TODAS cobre o catalogo inteiro',
    TODAS.length === AREAS.reduce((n, a) => n + a.niveis.length, 0), TODAS.length)
}

// ── Os papeis ──────────────────────────────────────────────────────────────
seccao('Os papeis')
{
  verificar('ha papeis', PAPEIS.length >= 5)
  verificar('o dono nao e atribuivel', POR_PAPEL.get('dono').atribuivel === false)
  verificar('todos os outros sao atribuiveis',
    PAPEIS_ATRIBUIVEIS.length === PAPEIS.length - 1, PAPEIS_ATRIBUIVEIS.map(p => p.id))
  verificar('todos tem descricao', PAPEIS.every(p => p.label && p.descricao))

  // Nenhuma permissao inventada: uma chave fora do catalogo nunca seria
  // concedida por ninguem, e ficaria a mentir no ecra.
  const validas = new Set(TODAS)
  for (const p of PAPEIS) {
    const foraDoCatalogo = p.omissao.filter(x => !validas.has(x))
    verificar(`${p.id}: nenhuma permissao fora do catalogo`, foraDoCatalogo.length === 0, foraDoCatalogo)
  }

  // Quem edita ve. Se um papel tivesse `editar` sem `ver`, a pessoa abria um
  // ecra vazio com um botao de guardar.
  for (const p of PAPEIS) {
    const editaSemVer = AREAS
      .filter(a => p.omissao.includes(chave(a.id, 'editar')) && a.niveis.includes('ver'))
      .filter(a => !p.omissao.includes(chave(a.id, 'ver')))
      .map(a => a.id)
    verificar(`${p.id}: nao edita nada sem poder ver`, editaSemVer.length === 0, editaSemVer)
  }

  // E quem apaga, edita.
  for (const p of PAPEIS) {
    const apagaSemEditar = AREAS
      .filter(a => p.omissao.includes(chave(a.id, 'eliminar')))
      .filter(a => a.niveis.includes('editar') && !p.omissao.includes(chave(a.id, 'editar')))
      .map(a => a.id)
    verificar(`${p.id}: nao apaga nada sem poder editar`, apagaSemEditar.length === 0, apagaSemEditar)
  }
}

// ── As regras da casa ──────────────────────────────────────────────────────
seccao('As regras da casa')
{
  const P = (papel) => permissoesDe(papel)

  // O DONO
  verificar('o dono tem tudo', P('dono').length === TODAS.length)
  verificar('e continua a ter tudo mesmo com uma sobreposicao a tirar-lhe coisas',
    permissoesDe('dono', ['utentes.ver']).length === TODAS.length,
    permissoesDe('dono', ['utentes.ver']).length)

  // A DIRECAO TECNICA
  verificar('a direcao tecnica pode dar acessos, por omissao',
    pode(P('direcao'), 'permissoes', 'editar'))
  verificar('e o dono pode tirar-lhe esse direito',
    !pode(permissoesDe('direcao', P('direcao').filter(x => x !== 'permissoes.editar')), 'permissoes', 'editar'))

  // A ENFERMAGEM
  verificar('a enfermagem regista medicacao', pode(P('enfermagem'), 'medicacao', 'editar'))
  verificar('a enfermagem trata feridas', pode(P('enfermagem'), 'feridas', 'editar'))
  verificar('a enfermagem NAO ve o financeiro', !pode(P('enfermagem'), 'financeiro', 'ver'))
  verificar('a enfermagem NAO da acessos', !pode(P('enfermagem'), 'permissoes', 'editar'))
  verificar('a enfermagem NAO mexe nas definicoes da casa', !pode(P('enfermagem'), 'definicoes', 'editar'))

  // A AUXILIAR
  verificar('a auxiliar regista tomas', pode(P('auxiliar'), 'medicacao', 'editar'))
  verificar('a auxiliar regista o dia', pode(P('auxiliar'), 'registos', 'editar'))
  verificar('a auxiliar abre uma ocorrencia', pode(P('auxiliar'), 'ocorrencias', 'editar'))
  verificar('a auxiliar NAO apaga NADA',
    !AREAS.some(a => pode(P('auxiliar'), a.id, 'eliminar')),
    AREAS.filter(a => pode(P('auxiliar'), a.id, 'eliminar')).map(a => a.id))
  verificar('a auxiliar NAO ve o financeiro', !pode(P('auxiliar'), 'financeiro', 'ver'))
  verificar('a auxiliar NAO edita a ficha do utente', !pode(P('auxiliar'), 'utentes', 'editar'))

  // A ANIMACAO
  verificar('a animacao trata das atividades', pode(P('animacao'), 'atividades', 'editar'))
  verificar('a animacao fala com as familias', pode(P('animacao'), 'familias', 'editar'))
  verificar('a animacao NAO mexe em medicacao', !pode(P('animacao'), 'medicacao', 'ver'))
  verificar('a animacao NAO ve feridas', !pode(P('animacao'), 'feridas', 'ver'))

  // A ADMINISTRATIVA
  verificar('a administrativa trata do financeiro', pode(P('administrativo'), 'financeiro', 'editar'))
  verificar('a administrativa trata dos documentos', pode(P('administrativo'), 'documentos', 'editar'))
  verificar('a administrativa NAO abre a medicacao', !pode(P('administrativo'), 'medicacao', 'ver'))
  verificar('a administrativa NAO ve as feridas', !pode(P('administrativo'), 'feridas', 'ver'))
  verificar('a administrativa NAO ve as avaliacoes', !pode(P('administrativo'), 'avaliacoes', 'ver'))

  // O CONVIDADO
  verificar('o convidado ve os utentes', pode(P('convidado'), 'utentes', 'ver'))
  verificar('o convidado NAO edita NADA',
    !AREAS.some(a => pode(P('convidado'), a.id, 'editar')),
    AREAS.filter(a => pode(P('convidado'), a.id, 'editar')).map(a => a.id))
  verificar('o convidado NAO ve contas', !pode(P('convidado'), 'financeiro', 'ver'))
  verificar('o convidado NAO ve o registo de atividade', !pode(P('convidado'), 'registo_atividade', 'ver'))
}

// ── A sobreposicao por pessoa ──────────────────────────────────────────────
seccao('Afinar uma pessoa por cima do papel')
{
  const afinada = ['utentes.ver', 'medicacao.ver']
  verificar('a sobreposicao substitui o molde',
    permissoesDe('auxiliar', afinada).length === 2, permissoesDe('auxiliar', afinada))
  verificar('uma sobreposicao vazia cai no molde',
    permissoesDe('auxiliar', []).length === POR_PAPEL.get('auxiliar').omissao.length)
  verificar('null tambem cai no molde',
    permissoesDe('auxiliar', null).length === POR_PAPEL.get('auxiliar').omissao.length)
  verificar('um papel desconhecido nao da nada',
    permissoesDe('inventado').length === 0)
  verificar('nem sem papel nenhum', permissoesDe(null).length === 0 && permissoesDe(undefined).length === 0)
}

// ── O menu ─────────────────────────────────────────────────────────────────
seccao('O que aparece no menu')
{
  verificar('ve a area se tiver qualquer nivel dela',
    veArea(['stock.ver'], 'stock') && veArea(['stock.editar'], 'stock'))
  verificar('nao ve a area sem nenhum nivel', !veArea(['utentes.ver'], 'stock'))
  verificar('a administrativa nao ve a medicacao no menu',
    !veArea(permissoesDe('administrativo'), 'medicacao'))
  verificar('a enfermagem nao ve o financeiro no menu',
    !veArea(permissoesDe('enfermagem'), 'financeiro'))

  // Falhar ABERTO na navegacao e deliberado: esconder uma ferramenta nova por
  // esquecimento e pior do que mostra-la, porque quem protege os dados e o
  // servidor e nao o menu.
  verificar('uma area desconhecida nao desaparece do menu por esquecimento',
    veArea([], 'ferramenta-que-ainda-nao-existe'))
}

// ── A frase ────────────────────────────────────────────────────────────────
seccao('A frase que se le primeiro')
{
  const aux = emPalavras('auxiliar')
  verificar('diz o que a pessoa FAZ', /Trabalha em/.test(aux), aux)
  verificar('e diz o que NAO ve — que e o que interessa a quem configura',
    /Não vê/.test(aux), aux)
  verificar('diz que a auxiliar nao apaga', /Não apaga registos/.test(aux), aux)
  verificar('o dono tem frase propria', /dona da casa/.test(emPalavras('dono')))
  verificar('a direcao diz que pode dar acessos',
    /dar acessos/.test(emPalavras('direcao')), emPalavras('direcao'))
  verificar('quem nao tem nada ouve isso',
    /não tem acesso a nada/i.test(emPalavras('inventado')))

  verificar('o resumo curto diz o papel', resumoCurto('enfermagem') === 'Enfermagem')
  verificar('e avisa quando foi afinado',
    resumoCurto('auxiliar', ['utentes.ver']) === 'Auxiliar (afinado)',
    resumoCurto('auxiliar', ['utentes.ver']))
  verificar('o dono nunca aparece como afinado',
    resumoCurto('dono', ['utentes.ver']) === 'Dono')
}

// ── A migracao dos papeis antigos ──────────────────────────────────────────
seccao('Ninguem perde acesso na mudanca')
{
  const ANTIGOS = ['owner', 'admin', 'clinician', 'pharmacist', 'nurse', 'assistant',
                   'accountant', 'viewer', 'student', 'caregiver', 'self']
  const semMapa = ANTIGOS.filter(a => !PAPEL_ANTIGO_PARA_NOVO[a])
  verificar('os onze papeis antigos tem todos destino', semMapa.length === 0, semMapa)

  const destinosInvalidos = Object.values(PAPEL_ANTIGO_PARA_NOVO).filter(d => !POR_PAPEL.has(d))
  verificar('e todos os destinos existem', destinosInvalidos.length === 0, destinosInvalidos)

  verificar('owner continua dono', PAPEL_ANTIGO_PARA_NOVO.owner === 'dono')
  verificar('admin passa a direcao tecnica', PAPEL_ANTIGO_PARA_NOVO.admin === 'direcao')
  verificar('quem registava medicacao continua a registar',
    ['clinician', 'nurse', 'pharmacist'].every(a =>
      pode(permissoesDe(PAPEL_ANTIGO_PARA_NOVO[a]), 'medicacao', 'editar')))
  verificar('quem so via continua so a ver',
    ['viewer', 'student'].every(a =>
      !AREAS.some(x => pode(permissoesDe(PAPEL_ANTIGO_PARA_NOVO[a]), x.id, 'editar'))))
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
