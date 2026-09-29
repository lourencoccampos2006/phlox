// scripts/teste-modelos.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Os modelos de documentos e o leitor de .docx (sprint167).
//
// ── PORQUE E QUE ISTO PRECISA DE TESTES A SERIO ─────────────────────────────
// O que sai daqui vai impresso, assinado, e entregue a Seguranca Social. Um
// campo trocado num contrato nao da erro: da um contrato errado assinado por
// duas pessoas de boa fe.
//
// O leitor de .docx e testado contra um .docx VERDADEIRO, construido aqui
// (zip + deflate) e lido de volta. Testar o leitor contra uma string sua nao
// prova nada: o que quebra num leitor de ZIP escrito a mao sao os bytes do
// cabecalho, nao a expressao regular do XML.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-modelos.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  campos, marcasDe, marcasDesconhecidas, preencher, estaPronto,
  dataPorExtenso, dataCurta, categoriaDe, CATEGORIAS, CAMPOS_DA_CASA,
} from '../lib/modelos.ts'
import { lerDocx, lerModelo, textoDoXml, DocxIlegivel } from '../lib/lerDocx.ts'
import { fichaVazia } from '../lib/inscricao.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

const CASA = { nome: 'Casa de Repouso Exemplo', morada: 'Rua Central, 10', nif: '500123456', telefone: '210000000' }
const HOJE = '2026-09-27'

console.log('\nOS CAMPOS SAEM DA FICHA, E NAO DE UMA SEGUNDA LISTA')
{
  const ids = campos().map(c => c.id)
  // O bug que isto apanha: duas listas de campos que se desencontram, e um
  // modelo a pedir um campo que a ficha nao guarda.
  ok('o nome esta la', ids.includes('nome'))
  ok('a data de nascimento esta la', ids.includes('data_nascimento'))
  ok('o NIF esta la', ids.includes('nif'))
  ok('a morada esta la', ids.includes('morada'))
  ok('o diagnostico esta la', ids.includes('diagnosticos'))
  ok('nenhum campo se repete', new Set(ids).size === ids.length)
  ok('a casa tem os seus', CAMPOS_DA_CASA.every(c => ids.includes(c.id)))
  ok('a idade e a data de hoje sao calculadas',
    campos().filter(c => c.fonte === 'calculado').length >= 3)
  ok('todo o campo tem rotulo', campos().every(c => c.rotulo && c.rotulo.length > 2))
  // Um `{{nome}}` que na ficha se chame outra coisa e um espaco em branco num
  // contrato. Todos os campos da pessoa TEM de existir na ficha.
  const daFicha = new Set(Object.keys(fichaVazia('candidatura')))
  const daPessoa = campos().filter(c => c.fonte === 'pessoa').map(c => c.id)
  ok('todo o campo de pessoa existe numa das fichas',
    daPessoa.every(id => daFicha.has(id) || Object.keys(fichaVazia('utente')).includes(id)),
    daPessoa.filter(id => !daFicha.has(id) && !Object.keys(fichaVazia('utente')).includes(id)).join(', '))
}

console.log('\nLER AS MARCAS DE UM MODELO')
{
  const corpo = 'Eu, {{nome}}, NIF {{nif}}, morador em {{morada}}, declaro… {{nome}} outra vez.'
  ok('encontra as tres', marcasDe(corpo).join(',') === 'nome,nif,morada', marcasDe(corpo).join(','))
  ok('nao repete', marcasDe(corpo).length === 3)
  ok('aceita espacos dentro das chavetas',
    marcasDe('{{ nome }} e {{  nif  }}').join(',') === 'nome,nif')
  ok('um corpo sem marcas da lista vazia', marcasDe('texto simples').length === 0)
  ok('null nao rebenta', marcasDe(null).length === 0 && marcasDe(undefined).length === 0)
  ok('chavetas soltas nao contam como marca', marcasDe('{isto} e {{ nao-vale }}').length === 0)

  ok('apanha uma marca que nao existe',
    marcasDesconhecidas('{{nome}} e {{xpto}}').join(',') === 'xpto')
  ok('e nao acusa as que existem', marcasDesconhecidas('{{nome}} {{nif}} {{hoje}}').length === 0)
}

console.log('\nPREENCHER COM OS DADOS DE UMA PESSOA')
{
  const ficha = {
    ...fichaVazia('utente'),
    nome: 'Maria Silva', nif: '123456789', morada: 'Rua das Flores, 3',
    data_nascimento: '1938-04-02', mobilidade: 'cadeira', dieta: 'espessada',
  }
  const p = preencher(
    'Eu, {{nome}}, NIF {{nif}}, nascida a {{data_nascimento}} ({{idade}} anos), '
    + 'residente em {{morada}}, admitida em {{casa.nome}} a {{hoje}}.',
    ficha, CASA, HOJE,
  )
  ok('o nome entra', p.texto.includes('Maria Silva'))
  ok('o NIF entra', p.texto.includes('123456789'))
  ok('a data sai em portugues e nao em ISO',
    p.texto.includes('02/04/1938') && !p.texto.includes('1938-04-02'),
    'um documento com «1938-04-02» parece uma base de dados a sair pela impressora')
  ok('a idade e calculada', p.texto.includes('88 anos'), p.texto.match(/\d+ anos/)?.[0])
  ok('o nome da casa entra', p.texto.includes('Casa de Repouso Exemplo'))
  ok('a data de hoje sai por extenso', p.texto.includes('27 de setembro de 2026'))
  ok('nada em falta', p.emFalta.length === 0, p.emFalta.map(x => x.id).join(','))
  ok('esta pronto a imprimir', estaPronto(p))

  // As escolhas saem por extenso. Um contrato que diga «mobilidade: cadeira»
  // esta a mostrar o codigo interno a quem o assina.
  const q = preencher('Mobilidade: {{mobilidade}}. Dieta: {{dieta}}.', ficha, CASA, HOJE)
  ok('as escolhas saem por extenso',
    q.texto.includes('Cadeira de rodas') && q.texto.includes('Líquidos espessados'),
    q.texto)
}

console.log('\nUM CAMPO EM FALTA TEM DE SE VER')
{
  // O bug grave que isto existe para impedir: sair um contrato com o NIF em
  // branco, alguem assinar, e so se descobrir quando o devolvem.
  const ficha = { ...fichaVazia('utente'), nome: 'João Pedro' }
  const p = preencher('Eu, {{nome}}, NIF {{nif}}, morador em {{morada}}.', ficha, CASA, HOJE)
  ok('o que ha entra', p.texto.includes('João Pedro'))
  ok('o que falta fica a vista com um tracejado',
    p.texto.includes('__________'), p.texto)
  ok('e nao fica um espaco em branco', !/NIF ,/.test(p.texto))
  ok('a lista do que falta tem os dois', p.emFalta.length === 2,
    p.emFalta.map(x => x.id).join(','))
  ok('cada um com o nome que a pessoa reconhece',
    p.emFalta.every(x => x.rotulo.length > 3 && x.rotulo !== x.id),
    JSON.stringify(p.emFalta))
  ok('NAO esta pronto a imprimir', !estaPronto(p))
  ok('um campo em falta nao entra duas vezes na lista',
    preencher('{{nif}} {{nif}}', ficha, CASA, HOJE).emFalta.length === 1)
}

console.log('\nUMA MARCA ERRADA NAO SE APAGA EM SILENCIO')
{
  const p = preencher('Nome: {{nome}}. Erro: {{nome_completo}}.',
    { ...fichaVazia('utente'), nome: 'Ana' }, CASA, HOJE)
  ok('fica no texto tal como foi escrita', p.texto.includes('{{nome_completo}}'),
    'apaga-la escondia o engano e o documento saia com uma frase a meio')
  ok('e e apontada', p.desconhecidas.join(',') === 'nome_completo')
  ok('e o documento nao esta pronto', !estaPronto(p))
}

console.log('\nOS CAMPOS DA CASA EM FALTA')
{
  const p = preencher('{{casa.nome}}, NIF {{casa.nif}}',
    fichaVazia('utente'), { nome: 'Lar X' }, HOJE)
  ok('o que a casa tem entra', p.texto.includes('Lar X'))
  ok('o que a casa nao tem aparece em falta',
    p.emFalta.some(x => x.id === 'casa.nif'))
}

console.log('\nAS DATAS')
{
  ok('por extenso', dataPorExtenso('2026-01-01') === '1 de janeiro de 2026')
  ok('marco com cedilha', dataPorExtenso('2026-03-15').includes('março'))
  ok('curta', dataCurta('2026-12-31') === '31/12/2026')
  ok('lixo devolve-se como veio', dataPorExtenso('xpto') === 'xpto' && dataCurta('') === '')
}

console.log('\nAS CATEGORIAS')
{
  ok('cinco categorias', CATEGORIAS.length === 5)
  ok('a inscricao e uma delas', CATEGORIAS.some(c => c.id === 'inscricao'))
  ok('uma desconhecida cai em Outros', categoriaDe('marciana') === 'Outros')
  ok('sem categoria tambem', categoriaDe(null) === 'Outros')
}

/* ═══════════════════════════════════════════════════════════════════════════
   O LEITOR DE .DOCX, CONTRA UM .DOCX VERDADEIRO
   ═══════════════════════════════════════════════════════════════════════════ */

/** Comprime com deflate cru, como um .docx faz. */
async function deflate(texto) {
  const f = new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(f).arrayBuffer())
}

/** Constroi um ZIP minimo com uma entrada. E o formato, byte a byte. */
async function zipDeUmFicheiro(nome, conteudo, comprimir = true) {
  const nomeBytes = new TextEncoder().encode(nome)
  const cruBytes = new TextEncoder().encode(conteudo)
  const dados = comprimir ? await deflate(conteudo) : cruBytes
  const metodo = comprimir ? 8 : 0

  const p16 = n => [n & 0xff, (n >> 8) & 0xff]
  const p32 = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

  const local = [
    0x50, 0x4b, 0x03, 0x04, ...p16(20), ...p16(0), ...p16(metodo),
    ...p16(0), ...p16(0), ...p32(0),
    ...p32(dados.length), ...p32(cruBytes.length),
    ...p16(nomeBytes.length), ...p16(0),
    ...nomeBytes,
  ]
  const central = [
    0x50, 0x4b, 0x01, 0x02, ...p16(20), ...p16(20), ...p16(0), ...p16(metodo),
    ...p16(0), ...p16(0), ...p32(0),
    ...p32(dados.length), ...p32(cruBytes.length),
    ...p16(nomeBytes.length), ...p16(0), ...p16(0),
    ...p16(0), ...p16(0), ...p32(0), ...p32(0),
    ...nomeBytes,
  ]
  const eocd = [
    0x50, 0x4b, 0x05, 0x06, ...p16(0), ...p16(0), ...p16(1), ...p16(1),
    ...p32(central.length), ...p32(local.length + dados.length), ...p16(0),
  ]
  const fora = new Uint8Array(local.length + dados.length + central.length + eocd.length)
  let i = 0
  fora.set(local, i); i += local.length
  fora.set(dados, i); i += dados.length
  fora.set(central, i); i += central.length
  fora.set(eocd, i)
  return new Blob([fora])
}

const XML = (p) => '<?xml version="1.0"?><w:document><w:body>'
  + p.map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')
  + '</w:body></w:document>'

console.log('\nO XML DO WORD EM TEXTO')
{
  ok('cada paragrafo e uma linha',
    textoDoXml(XML(['Primeira', 'Segunda'])) === 'Primeira\nSegunda',
    JSON.stringify(textoDoXml(XML(['Primeira', 'Segunda']))))
  ok('as palavras de paragrafos diferentes nao se colam',
    !textoDoXml(XML(['Uma', 'Outra'])).includes('UmaOutra'),
    'foi o primeiro erro: tirar as etiquetas antes de marcar as quebras')
  ok('uma quebra de linha conta', textoDoXml('<w:p>a<w:br/>b</w:p>') === 'a\nb')
  ok('as entidades voltam a ser caracteres',
    textoDoXml('<w:t>M&#38;#38;A &#38;lt;3</w:t>').length > 0)
  ok('o & escapado nao vira duas vezes',
    textoDoXml('<w:t>&amp;lt;</w:t>') === '&lt;',
    'se o &amp; fosse trocado primeiro, isto virava «<»')
  ok('uma marca de modelo sobrevive intacta',
    textoDoXml(XML(['Eu, {{nome}}, declaro'])).includes('{{nome}}'))
  ok('tres linhas vazias viram uma', !/\n\n\n/.test(textoDoXml(XML(['a', '', '', '', 'b']))))
}

console.log('\nLER UM .DOCX CONSTRUIDO AQUI')
{
  const texto = ['DECLARAÇÃO', 'Eu, {{nome}}, portador do NIF {{nif}}, declaro.', 'Data: {{hoje}}']
  const docx = await zipDeUmFicheiro('word/document.xml', XML(texto))
  const lido = await lerDocx(docx)
  ok('le o texto todo', lido.includes('DECLARAÇÃO') && lido.includes('{{nif}}'), JSON.stringify(lido.slice(0, 60)))
  ok('os acentos sobrevivem', lido.includes('DECLARAÇÃO'))
  ok('as tres linhas ficam tres', lido.split('\n').filter(Boolean).length === 3,
    `${lido.split('\n').filter(Boolean).length}`)
  ok('e as marcas sobrevivem para o motor as ler',
    marcasDe(lido).join(',') === 'nome,nif,hoje', marcasDe(lido).join(','))

  // Guardado sem comprimir: o outro metodo que um .docx pode usar.
  const semComprimir = await zipDeUmFicheiro('word/document.xml', XML(['Sem comprimir']), false)
  ok('tambem le uma entrada guardada sem compressao',
    (await lerDocx(semComprimir)).includes('Sem comprimir'))
}

console.log('\nQUANDO NAO DA, DIZ PORQUE — E NAO DEVOLVE MEIO TEXTO')
{
  const falha = async (f) => { try { await f(); return null } catch (e) { return e } }

  let e = await falha(() => lerDocx(new Blob([new Uint8Array(5)])))
  ok('um ficheiro minusculo rebenta', e instanceof DocxIlegivel, String(e))

  e = await falha(() => lerDocx(new Blob([new TextEncoder().encode('isto nao e um zip, nem por engano, nem com muitos bytes a mais para passar o tamanho minimo')])))
  ok('um ficheiro que nao e ZIP rebenta', e instanceof DocxIlegivel, String(e?.message))
  ok('e diz que parece um .doc antigo', /\.doc/.test(e?.message || ''), e?.message)

  // Um ZIP valido mas sem o document.xml la dentro.
  const semTexto = await zipDeUmFicheiro('outro/ficheiro.xml', '<a/>')
  e = await falha(() => lerDocx(semTexto))
  ok('um zip sem o texto do Word rebenta', e instanceof DocxIlegivel, String(e?.message))

  ok('nenhuma destas mensagens e tecnica', [
    'O ficheiro está vazio.',
    'Isto parece um .doc antigo. Guarde-o como .docx ou .txt.',
    'Não encontrei o texto dentro do ficheiro.',
  ].every(m => !/zip|xml|deflate|eocd|byte/i.test(m)))
}

console.log('\nOS FORMATOS QUE SE ACEITAM')
{
  const falha = async (f) => { try { await f(); return null } catch (e) { return e.message } }
  const comoFicheiro = (nome, texto) =>
    Object.assign(new Blob([texto]), { name: nome, text: async () => texto })

  ok('um .txt le-se tal e qual',
    (await lerModelo(comoFicheiro('m.txt', '  Olá {{nome}}  '))) === 'Olá {{nome}}')
  ok('um .md tambem', (await lerModelo(comoFicheiro('m.md', '# Título'))) === '# Título')
  ok('um .doc antigo e recusado com explicacao',
    /\.docx|\.txt/.test(await falha(() => lerModelo(comoFicheiro('m.doc', 'x')))))
  ok('um PDF e recusado com explicacao',
    /PDF|cole/i.test(await falha(() => lerModelo(comoFicheiro('m.pdf', 'x')))))
  ok('outra coisa qualquer diz o que se aceita',
    /docx/.test(await falha(() => lerModelo(comoFicheiro('m.xlsx', 'x')))))
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ O modelo preenche-se com a pessoa certa, e o que falta diz-se antes de imprimir.')
process.exit(falhas ? 1 : 0)
