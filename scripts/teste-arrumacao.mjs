// scripts/teste-arrumacao.mjs
// ─────────────────────────────────────────────────────────────────────────────
// De quem e o documento, e onde e que ele fica guardado.
//
// ── O QUE ESTA EM JOGO ─────────────────────────────────────────────────────
// Alguem analisa o relatorio de outra pessoa -- e o uso normal da ferramenta, e
// e bom que aconteca. O documento fica na memoria de QUEM O MANDOU, porque e a
// conta dele. Mas dentro dessa memoria tem de ficar numa gaveta propria: se os
// exames de um terceiro entrarem no que o Phlox sabe sobre o utilizador, tudo o
// que ele disser a partir daí sai contaminado -- e com ar de rigor.
//
// E o contrario tambem: a gaveta de cada pessoa tem de ser reencontrada da
// proxima vez, senao a "memoria" e uma pilha de gavetas com um documento cada.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-arrumacao.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  resolverSujeito, atualizarDossier, responderPergunta, contextoParaIA, explicarArrumacao,
} from '../lib/memoriaDocumentos.ts'
import { dossierVazio } from '../lib/dossier.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── Uma base de dados de mentira ───────────────────────────────────────────
function baseFalsa() {
  const linhas = []
  let n = 0
  const api = {
    _linhas: linhas,
    from() {
      const est = { filtros: {} }
      const q = {
        select() { return q },
        update(patch) { est.patch = patch; return q },
        eq(col, val) {
          est.filtros[col] = val
          if (est.patch) {
            const alvo = linhas.find(l => l.id === val)
            if (alvo) Object.assign(alvo, est.patch)
            est.patch = null
          }
          return q
        },
        order() { return q },
        limit() { return q },
        async upsert(linha) {
          const ja = linhas.find(l => l.user_id === linha.user_id && l.nome_chave === linha.nome_chave)
          if (ja) { Object.assign(ja, linha); return { data: ja, error: null, select: () => q } }
          const nova = { id: `s${++n}`, documentos: 0, dossier: {}, ...linha }
          linhas.push(nova)
          return { data: nova, error: null }
        },
        async maybeSingle() { return { data: null, error: null } },
        then(res) { res({ data: null, error: null }); return Promise.resolve({ data: null, error: null }) },
      }
      // `.upsert(...).select().maybeSingle()`
      const upsertOriginal = q.upsert
      q.upsert = (linha) => {
        const p = upsertOriginal(linha)
        return { select: () => ({ maybeSingle: async () => await p }) }
      }
      return q
    },
  }
  return api
}

const SEM_IDENTIDADE = { proprio: '', perfis: [] }

// ── O caso central: um documento de alguem de fora ─────────────────────────
seccao('Um documento de alguem que nao usa o Phlox')
{
  const sb = baseFalsa()
  const identidades = { proprio: 'Rui Marques Lopes', perfis: [{ id: 'p1', nome: 'Alberto Marques Lopes' }] }

  // O utilizador ja tem memoria propria.
  const meus = await resolverSujeito(sb, 'u1', {
    nomeNoDocumento: 'Rui Marques Lopes', sujeitos: [], identidades,
  })
  verificar('o documento do proprio vai para a gaveta do proprio',
    meus.sujeito?.relacao === 'proprio', meus)

  let todos = sb._linhas.map(l => ({ ...l, grafias: l.grafias || [], dossier: l.dossier || {} }))

  // Agora um papel de outra pessoa qualquer.
  const outro = await resolverSujeito(sb, 'u1', {
    nomeNoDocumento: 'Teresa Nogueira Pinto', sujeitos: todos, identidades,
  })
  verificar('um nome desconhecido ganha gaveta propria',
    outro.sujeito && outro.sujeito.relacao === 'outro', outro)
  verificar('e NAO e a gaveta do proprio',
    outro.sujeito?.id !== meus.sujeito?.id, { outro: outro.sujeito?.id, meu: meus.sujeito?.id })
  verificar('avisa que e a primeira vez que esta pessoa aparece', outro.confirmar === true, outro)
  verificar('e diz isso por palavras',
    /Primeiro documento/i.test(explicarArrumacao(outro)), explicarArrumacao(outro))

  // O que se aprende sobre um nao pode aparecer no outro. E o ponto todo.
  todos = sb._linhas.map(l => ({ ...l, grafias: l.grafias || [], dossier: l.dossier || {}, documentos: l.documentos || 0 }))
  const gavetaOutro = todos.find(t => t.id === outro.sujeito.id)
  await atualizarDossier(sb, { ...gavetaOutro, dossier: dossierVazio() }, {
    factos: { condicoes: [{ nome: 'Insuficiencia cardiaca' }] }, fonte: 'Relatorio',
  })
  const gavetaMinha = sb._linhas.find(l => l.id === meus.sujeito.id)
  verificar('o que se aprendeu do outro NAO entra na memoria do proprio',
    !JSON.stringify(gavetaMinha.dossier || {}).includes('Insuficiencia'), gavetaMinha.dossier)
}

// ── Reencontrar a mesma pessoa ─────────────────────────────────────────────
seccao('A mesma pessoa, da proxima vez')
{
  const sb = baseFalsa()
  const identidades = SEM_IDENTIDADE

  const um = await resolverSujeito(sb, 'u1', { nomeNoDocumento: 'Teresa Nogueira Pinto', sujeitos: [], identidades })
  const todos = sb._linhas.map(l => ({ ...l, grafias: l.grafias || [], dossier: l.dossier || {} }))

  const dois = await resolverSujeito(sb, 'u1', { nomeNoDocumento: 'TERESA NOGUEIRA PINTO', sujeitos: todos, identidades })
  verificar('o mesmo nome volta para a mesma gaveta', dois.sujeito?.id === um.sujeito?.id, dois)
  verificar('e desta vez nao ha nada a confirmar', dois.confirmar === false, dois)
  verificar('nao se criou uma gaveta nova', sb._linhas.length === 1, sb._linhas.length)

  const abreviado = await resolverSujeito(sb, 'u1', { nomeNoDocumento: 'T. N. Pinto', sujeitos: todos, identidades })
  verificar('o nome abreviado tambem a reencontra', abreviado.sujeito?.id === um.sujeito?.id, abreviado)

  // Um nome so parecido nao entra em silencio.
  const parecido = await resolverSujeito(sb, 'u1', { nomeNoDocumento: 'Teresa Pinto', sujeitos: todos, identidades })
  verificar('um nome so parecido aponta, mas pede confirmacao',
    parecido.sujeito?.id === um.sujeito?.id && parecido.confianca === 'provavel' && parecido.confirmar, parecido)
}

// ── Os perfis que ja se acompanham ─────────────────────────────────────────
seccao('Os perfis que a pessoa ja acompanha')
{
  const sb = baseFalsa()
  const identidades = { proprio: 'Rui Marques Lopes', perfis: [{ id: 'p1', nome: 'Alberto Marques Lopes' }] }

  const r = await resolverSujeito(sb, 'u1', { nomeNoDocumento: 'Alberto Marques Lopes', sujeitos: [], identidades })
  verificar('um documento de um perfil acompanhado liga-se a esse perfil',
    r.sujeito?.relacao === 'perfil' && r.sujeito?.profile_id === 'p1', r.sujeito)
  verificar('e nao precisa de confirmacao', r.confirmar === false, r)
}

// ── Papeis sem nome ────────────────────────────────────────────────────────
seccao('Um papel sem nome (uma caixa de comprimidos)')
{
  const sb = baseFalsa()
  const identidades = { proprio: 'Rui Marques Lopes', perfis: [{ id: 'p1', nome: 'Alberto Marques Lopes' }] }

  const meu = await resolverSujeito(sb, 'u1', { nomeNoDocumento: '', sujeitos: [], identidades, perfilAtivoId: 'self' })
  verificar('sem nome, vai para o perfil ativo', meu.sujeito?.relacao === 'proprio', meu)
  verificar('mas diz-se que foi assim e porque', meu.confirmar === true && /nao traz nome|não traz nome/.test(meu.porque), meu)

  const todos = sb._linhas.map(l => ({ ...l, grafias: l.grafias || [], dossier: l.dossier || {} }))
  const dele = await resolverSujeito(sb, 'u1', { nomeNoDocumento: '', sujeitos: todos, identidades, perfilAtivoId: 'p1' })
  verificar('com outro perfil ativo, vai para esse',
    dele.sujeito?.profile_id === 'p1', dele.sujeito)

  // Sem nome no papel e sem nome na conta nao ha gaveta possivel.
  const sb2 = baseFalsa()
  const orfao = await resolverSujeito(sb2, 'u1', { nomeNoDocumento: '', sujeitos: [], identidades: SEM_IDENTIDADE })
  verificar('sem nome nenhum, fica sem dono em vez de ir para o sitio errado',
    orfao.sujeito === null, orfao)
  verificar('e nao se inventou nenhuma gaveta', sb2._linhas.length === 0, sb2._linhas.length)
}

// ── O que vai para a IA ────────────────────────────────────────────────────
seccao('O contexto que vai com o documento')
{
  const gavetas = [
    { id: 's1', nome: 'Rui Marques Lopes', relacao: 'proprio', profile_id: null, documentos: 4, grafias: [],
      dossier: { condicoes: [{ nome: 'Hipertensão', desde: '2019' }], medicamentos: [], valores: [], acontecimentos: [], respostas: [], perguntasPendentes: [] } },
    { id: 's2', nome: 'Teresa Nogueira Pinto', relacao: 'outro', profile_id: null, documentos: 1, grafias: [],
      dossier: { condicoes: [{ nome: 'Insuficiência cardíaca' }], medicamentos: [], valores: [], acontecimentos: [], respostas: [], perguntasPendentes: [] } },
  ]

  const t = contextoParaIA(gavetas)
  verificar('o indice diz que ha mais do que uma pessoa',
    t.includes('Rui Marques Lopes') && t.includes('Teresa Nogueira Pinto'), t.slice(0, 200))
  verificar('e diz quem e o proprio utilizador', t.includes('o próprio utilizador'))
  verificar('e quem e de fora', t.includes('outra pessoa'))
  verificar('leva o dossier de cada um, separado',
    t.includes('SOBRE Rui Marques Lopes') && t.includes('SOBRE Teresa Nogueira Pinto'), t)
  verificar('sem gavetas nenhumas, nao se manda contexto nenhum', contextoParaIA([]) === '')

  // O contexto nao pode crescer sem limite: o documento e que tem de caber.
  const muitas = []
  for (let i = 0; i < 40; i++) {
    muitas.push({
      id: `x${i}`, nome: `Pessoa Numero${i} Apelido${i}`, relacao: 'outro', profile_id: null, documentos: 3, grafias: [],
      dossier: { condicoes: [{ nome: `Uma condicao com nome comprido numero ${i}` }], medicamentos: [], valores: [], acontecimentos: [], respostas: [], perguntasPendentes: [] },
    })
  }
  verificar('o contexto tem tecto', contextoParaIA(muitas).length <= 6100, contextoParaIA(muitas).length)
}

// ── A resposta da pessoa ───────────────────────────────────────────────────
seccao('Quando a pessoa responde a uma pergunta')
{
  const sb = baseFalsa()
  sb._linhas.push({ id: 's1', user_id: 'u1', nome: 'Teresa Nogueira Pinto', nome_chave: 'teresa nogueira pinto', dossier: {} })
  const sujeito = { id: 's1', nome: 'Teresa Nogueira Pinto', nome_chave: 'teresa nogueira pinto', grafias: [], relacao: 'outro', profile_id: null, dossier: dossierVazio(), documentos: 1, ultimo_em: null }

  const d = await responderPergunta(sb, sujeito, 'Já está melhor da gripe?', 'Sim, passou')
  verificar('a resposta fica no dossier da pessoa certa',
    d.respostas.length === 1 && d.respostas[0].resposta === 'Sim, passou', d.respostas)
  verificar('e ficou mesmo gravada', JSON.stringify(sb._linhas[0].dossier).includes('passou'), sb._linhas[0].dossier)
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
