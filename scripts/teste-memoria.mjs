// scripts/teste-memoria.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A memória de documentos.
//
// O que se está mesmo a testar: que o MESMO documento dá a MESMA resposta. Era
// a queixa concreta — pedir a análise de um relatório e, ao voltar a pô-lo lá,
// receber outro texto. Um modelo de linguagem faz isso por natureza; a solução
// não é baixar a temperatura (continuaria a variar), é reconhecer o documento.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-memoria.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  impressaoDigital, lerPreferencias, leituraAnterior, guardarLeitura, explicarMemoria,
} from '../lib/memoriaDocumentos.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── Uma base de dados de mentira ───────────────────────────────────────────
function baseFalsa({ perfil = {}, erroPerfil = null, memoria = [] } = {}) {
  const guardados = [...memoria]
  return {
    _guardados: guardados,
    from(tabela) {
      const estado = { tabela, filtros: {} }
      const api = {
        select() { return api },
        eq(col, val) { estado.filtros[col] = val; return api },
        async maybeSingle() {
          if (tabela === 'profiles') {
            if (erroPerfil) return { data: null, error: erroPerfil }
            return { data: perfil, error: null }
          }
          const achado = guardados.find(g =>
            g.user_id === estado.filtros.user_id && g.hash === estado.filtros.hash)
          return { data: achado || null, error: null }
        },
        async upsert(linha) {
          const i = guardados.findIndex(g => g.user_id === linha.user_id && g.hash === linha.hash)
          if (i >= 0) guardados[i] = { ...guardados[i], ...linha }
          else guardados.push({ ...linha, criado_em: new Date().toISOString() })
          return { error: null }
        },
      }
      return api
    },
  }
}

// ── A impressão digital ────────────────────────────────────────────────────
seccao('A impressao digital')
{
  const a = await impressaoDigital('o mesmo relatorio')
  const b = await impressaoDigital('o mesmo relatorio')
  const c = await impressaoDigital('outro relatorio')

  verificar('o mesmo conteudo da sempre o mesmo hash', a === b && a.length === 64, { a, b })
  verificar('conteudo diferente da hash diferente', a !== c, { a, c })
  verificar('um espaco a mais ja e outro documento', a !== await impressaoDigital('o mesmo relatorio '))
  verificar('conteudo vazio nao rebenta', typeof (await impressaoDigital('')) === 'string')

  // Isto é o que torna a cache utilizável: um PDF de 4 MB em base64 tem de
  // passar pelo mesmo caminho sem estourar nada.
  const grande = 'A'.repeat(4 * 1024 * 1024)
  const g1 = await impressaoDigital(grande)
  verificar('um documento grande tambem tem impressao digital', g1.length === 64)
}

// ── As preferências ────────────────────────────────────────────────────────
seccao('As preferencias')
{
  const ligada = await lerPreferencias(
    baseFalsa({ perfil: { memoria_documentos: true, guardar_no_cofre: true } }), 'u1', 'pro')
  verificar('pro com tudo ligado tem memoria e cofre', ligada.memoria && ligada.guardarNoCofre && ligada.temCofre, ligada)

  const free = await lerPreferencias(
    baseFalsa({ perfil: { memoria_documentos: true, guardar_no_cofre: true } }), 'u1', 'free')
  verificar('free nunca guarda no cofre, mesmo com a coluna a true',
    free.memoria && !free.guardarNoCofre && !free.temCofre, free)

  const desligada = await lerPreferencias(
    baseFalsa({ perfil: { memoria_documentos: false, guardar_no_cofre: false } }), 'u1', 'pro')
  verificar('desligada e mesmo desligada', !desligada.memoria, desligada)

  // Enquanto o sprint146 não for aplicado, a coluna não existe e o PostgREST
  // recusa o select inteiro. Rebentar aqui deixaria o Explicar sem funcionar.
  const semColuna = await lerPreferencias(
    baseFalsa({ erroPerfil: { message: 'column profiles.memoria_documentos does not exist' } }), 'u1', 'pro')
  verificar('sem a coluna, a omissao e memoria ligada e cofre desligado',
    semColuna.memoria && !semColuna.guardarNoCofre, semColuna)
}

// ── A cache, que é o ponto ─────────────────────────────────────────────────
seccao('O mesmo documento da a mesma resposta')
{
  const sb = baseFalsa()
  const hash = await impressaoDigital('Relatorio de TAC, 3 paginas')
  const primeira = { kind: 'relatorio', title: 'TAC ao torax', emDuasLinhas: 'Nada de novo.' }

  verificar('a primeira vez nao ha nada guardado', (await leituraAnterior(sb, 'u1', hash)) === null)

  await guardarLeitura(sb, { userId: 'u1', hash, analise: primeira, origem: 'scan' })
  const segunda = await leituraAnterior(sb, 'u1', hash)

  verificar('a segunda vez devolve a leitura de antes',
    segunda && segunda.title === 'TAC ao torax' && segunda.emDuasLinhas === 'Nada de novo.', segunda)
  verificar('vem marcada como memoria (para se poder dizer a pessoa)', segunda?._daMemoria === true)
  verificar('traz a data da primeira leitura', typeof segunda?._lidoEm === 'string')

  // A parte que torna isto um cofre pessoal e não uma cache partilhada.
  verificar('a leitura de uma pessoa nao aparece a outra',
    (await leituraAnterior(sb, 'u2', hash)) === null)

  // Ler o mesmo papel dez vezes não pode encher a memória de dez cópias.
  for (let i = 0; i < 5; i++) {
    await guardarLeitura(sb, { userId: 'u1', hash, analise: primeira, origem: 'scan' })
  }
  verificar('ler o mesmo documento varias vezes nao duplica', sb._guardados.length === 1, sb._guardados.length)

  // Sem hash não há memória — e não pode haver uma linha com hash vazio a
  // agrupar documentos diferentes debaixo da mesma leitura.
  await guardarLeitura(sb, { userId: 'u1', hash: '', analise: primeira })
  verificar('sem impressao digital nao se guarda nada', sb._guardados.length === 1, sb._guardados.length)
  verificar('sem impressao digital nao se le nada', (await leituraAnterior(sb, 'u1', '')) === null)

  // Uma análise vazia também não: guardar `null` faria a segunda leitura
  // devolver um ecrã em branco em vez de voltar a perguntar à IA.
  const outro = await impressaoDigital('outro papel')
  await guardarLeitura(sb, { userId: 'u1', hash: outro, analise: null })
  verificar('uma analise vazia nao se guarda', sb._guardados.length === 1, sb._guardados.length)
}

// ── O que se guarda, e o que se diz ────────────────────────────────────────
seccao('O que fica guardado')
{
  const sb = baseFalsa()
  const hash = await impressaoDigital('Analises ao sangue')
  await guardarLeitura(sb, {
    userId: 'u1', hash, origem: 'vault', perfilId: 'perfil-mae', noCofre: true,
    analise: { kind: 'analise', title: 'Hemograma', emDuasLinhas: 'Tudo dentro dos valores.' },
  })
  const linha = sb._guardados[0]
  verificar('guarda o tipo, o titulo e o resumo (para listar sem abrir)',
    linha.tipo === 'analise' && linha.titulo === 'Hemograma' && linha.resumo === 'Tudo dentro dos valores.', linha)
  verificar('guarda de quem e o documento quando e de outra pessoa', linha.profile_id === 'perfil-mae')
  verificar('guarda se tambem foi para o cofre visivel', linha.no_cofre === true)
  verificar('guarda de onde veio', linha.origem === 'vault')
}

seccao('O que se diz a pessoa')
{
  const hoje = explicarMemoria(new Date().toISOString())
  const ontem = explicarMemoria(new Date(Date.now() - 86400000).toISOString())
  const antes = explicarMemoria(new Date(Date.now() - 12 * 86400000).toISOString())

  verificar('diz "hoje"', hoje.includes('hoje'), hoje)
  verificar('diz "ontem"', ontem.includes('ontem'), ontem)
  verificar('diz ha quantos dias', antes.includes('12 dias'), antes)
  verificar('explica PORQUE e igual, nao so que ja tinha lido',
    hoje.includes('para a resposta nao mudar') || hoje.includes('para a resposta não mudar'), hoje)
  verificar('sem data, diz alguma coisa na mesma', explicarMemoria().length > 10)
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
