// scripts/teste-dossier.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O que o Phlox sabe sobre uma pessoa.
//
// O que se esta a proteger: que ler um documento novo nao apague o que ja se
// sabia, que o dossier nao cresca para sempre, e que o que a propria pessoa
// disse nao se perca no meio dos papeis.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-dossier.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  dossierVazio, normalizarDossier, juntarFactos, guardarResposta, dispensarPergunta,
  dossierTemAlgo, contarDossier, resumirParaIA,
} from '../lib/dossier.ts'

let passou = 0, falhou = 0
function verificar(nome, condicao, extra) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}`); if (extra !== undefined) console.log('        ', JSON.stringify(extra)) }
}
function seccao(t) { console.log(`\n${t}`) }

// ── Ler sem confiar ────────────────────────────────────────────────────────
seccao('Ler o que esta guardado sem confiar em nada')
{
  verificar('um dossier novo esta vazio', !dossierTemAlgo(dossierVazio()))
  verificar('null nao rebenta', contarDossier(null) === 0)
  verificar('lixo no jsonb nao rebenta',
    contarDossier(normalizarDossier({ condicoes: 'isto nao e uma lista' })) === 0)
  verificar('um dossier a meio le-se na mesma',
    normalizarDossier({ condicoes: [{ nome: 'asma' }] }).condicoes.length === 1)
}

// ── Nao apagar o que ja se sabia ───────────────────────────────────────────
seccao('Um documento novo nao apaga o que ja se sabia')
{
  let d = juntarFactos(dossierVazio(), {
    condicoes: [{ nome: 'Hipertensão', desde: '2019' }, { nome: 'Diabetes tipo 2', desde: '2021' }],
    medicamentos: [{ nome: 'Losartan', detalhe: '50 mg' }],
  }, { fonte: 'Relatorio de 2021' })

  verificar('a primeira leitura guarda tudo',
    d.condicoes.length === 2 && d.medicamentos.length === 1, d)

  // Um relatorio que so fala da tensao NAO e prova de que a diabetes acabou.
  d = juntarFactos(d, { condicoes: [{ nome: 'HIPERTENSÃO', desde: '2020' }] }, { fonte: 'Consulta 2026' })
  verificar('um documento que so fala de uma condicao nao apaga as outras',
    d.condicoes.length === 2 && d.condicoes.some(c => /diabetes/i.test(c.nome)), d.condicoes)

  verificar('o mesmo nome com outra caixa ou acentos nao duplica',
    d.condicoes.filter(c => /hipertens/i.test(c.nome)).length === 1, d.condicoes)

  verificar('a data de inicio mais antiga e a que fica',
    d.condicoes.find(c => /hipertens/i.test(c.nome)).desde === '2019', d.condicoes)

  // ── A REGRA, e porque e esta ─────────────────────────────────────────────
  // So se juntam nomes IGUAIS (a menos de acentos e caixa). "Hipertensao" e
  // "hipertensao arterial" ficam como duas linhas -- redundancia feia, mas
  // inofensiva. Juntar por semelhanca seria pior: "Diabetes tipo 1" e
  // "Diabetes tipo 2" passariam a ser a mesma coisa, e isso ja e um erro
  // clinico. Na duvida, separado.
  //
  // Quem evita a redundancia na pratica e o proprio dossier: ele vai no pedido
  // a IA, que reutiliza os nomes que ja la estao.
  let sep = juntarFactos(dossierVazio(), { condicoes: [{ nome: 'Diabetes tipo 1' }] }, {})
  sep = juntarFactos(sep, { condicoes: [{ nome: 'Diabetes tipo 2' }] }, {})
  verificar('condicoes parecidas mas diferentes NAO se juntam',
    sep.condicoes.length === 2, sep.condicoes)
}

// ── Mudar de estado ────────────────────────────────────────────────────────
seccao('As coisas mudam de estado')
{
  let d = juntarFactos(dossierVazio(), {
    condicoes: [{ nome: 'Gripe', desde: '2026-11-10' }],
    medicamentos: [{ nome: 'Paracetamol', detalhe: '1 g' }],
  }, { fonte: 'Urgencia novembro' })

  d = juntarFactos(d, {
    condicoes: [{ nome: 'Gripe', estado: 'resolvido' }],
    medicamentos: [{ nome: 'Paracetamol', estado: 'parado' }],
  }, { fonte: 'Consulta dezembro' })

  verificar('uma condicao resolvida fica marcada, nao apagada',
    d.condicoes.length === 1 && d.condicoes[0].estado === 'resolvido', d.condicoes)
  verificar('um medicamento parado fica marcado',
    d.medicamentos[0].estado === 'parado', d.medicamentos)

  // O que esta ativo vem primeiro: e o que importa para ler o proximo papel.
  d = juntarFactos(d, { condicoes: [{ nome: 'Asma' }] }, { fonte: 'x' })
  verificar('o que esta ativo vem antes do que ja passou',
    d.condicoes[0].nome === 'Asma', d.condicoes.map(c => c.nome))

  // A dose muda.
  let m = juntarFactos(dossierVazio(), { medicamentos: [{ nome: 'Losartan', detalhe: '50 mg' }] }, {})
  m = juntarFactos(m, { medicamentos: [{ nome: 'Losartan', detalhe: '100 mg' }] }, {})
  verificar('uma dose nova substitui a antiga',
    m.medicamentos.length === 1 && m.medicamentos[0].detalhe === '100 mg', m.medicamentos)
}

// ── Os valores ─────────────────────────────────────────────────────────────
seccao('Os valores contam uma historia')
{
  let d = juntarFactos(dossierVazio(), {
    valores: [{ nome: 'Colesterol total', valor: '232', unidade: 'mg/dL', estado: 'alto' }],
  }, { data: '2026-06-01' })

  verificar('um valor sem data herda a data do documento',
    d.valores[0].quando === '2026-06-01', d.valores)

  // Reler o MESMO documento nao pode fabricar evolucao.
  d = juntarFactos(d, {
    valores: [{ nome: 'Colesterol total', valor: '232', unidade: 'mg/dL' }],
  }, { data: '2026-06-01' })
  verificar('reler o mesmo documento nao duplica o valor', d.valores.length === 1, d.valores)

  // Uma medicao nova do mesmo analito e evolucao, e guarda-se.
  d = juntarFactos(d, {
    valores: [{ nome: 'Colesterol total', valor: '198', unidade: 'mg/dL', estado: 'normal' }],
  }, { data: '2026-12-01' })
  verificar('uma medicao nova acrescenta-se a serie', d.valores.length === 2, d.valores)
  verificar('o mais recente vem primeiro', d.valores[0].valor === '198', d.valores)

  // Nao cresce para sempre.
  let longa = dossierVazio()
  for (let i = 1; i <= 20; i++) {
    longa = juntarFactos(longa, { valores: [{ nome: 'Glicemia', valor: String(80 + i) }] }, { data: `2026-01-${String(i).padStart(2, '0')}` })
  }
  verificar('uma serie longa e podada aos mais recentes',
    longa.valores.length === 8, longa.valores.length)
  verificar('e o que fica sao mesmo os mais recentes',
    longa.valores[0].valor === '100', longa.valores.map(v => v.valor))

  verificar('um valor sem nome ou sem valor nao entra',
    juntarFactos(dossierVazio(), { valores: [{ nome: '', valor: '5' }, { nome: 'x', valor: '' }] }, {}).valores.length === 0)
}

// ── As perguntas e as respostas ────────────────────────────────────────────
seccao('As perguntas, e o que a pessoa responde')
{
  let d = juntarFactos(dossierVazio(), { condicoes: [{ nome: 'Gripe' }] }, {
    fonte: 'Relatorio novembro',
    perguntas: [
      { pergunta: 'Já está melhor da gripe?', porque: 'para saber se ainda conta', tipo: 'sim_nao' },
      { pergunta: 'Ainda toma o xarope?', tipo: 'sim_nao' },
    ],
  })
  verificar('as perguntas ficam pendentes', d.perguntasPendentes.length === 2, d.perguntasPendentes)

  d = guardarResposta(d, 'Já está melhor da gripe?', 'Sim, passou em duas semanas', '2026-12-01')
  verificar('a resposta guarda-se', d.respostas.length === 1, d.respostas)
  verificar('a pergunta respondida sai das pendentes',
    d.perguntasPendentes.length === 1 && !d.perguntasPendentes.some(p => /melhor da gripe/.test(p.pergunta)), d.perguntasPendentes)

  // Nao se volta a perguntar o que ja foi respondido.
  d = juntarFactos(d, {}, {
    perguntas: [
      { pergunta: 'Ja esta melhor da gripe?' },   // mesma pergunta, sem acentos
      { pergunta: 'Mediu a tensão esta semana?' },
    ],
  })
  verificar('nao se volta a perguntar o que a pessoa ja respondeu',
    !d.perguntasPendentes.some(p => /gripe/i.test(p.pergunta)), d.perguntasPendentes)
  verificar('mas as perguntas novas entram',
    d.perguntasPendentes.some(p => /tensão/i.test(p.pergunta)), d.perguntasPendentes)

  d = dispensarPergunta(d, 'Mediu a tensão esta semana?')
  verificar('uma pergunta dispensada desaparece', d.perguntasPendentes.length === 0, d.perguntasPendentes)

  const antes = d.respostas.length
  d = guardarResposta(d, 'Já está melhor da gripe?', 'Afinal voltou', '2026-12-20')
  verificar('responder outra vez atualiza, nao duplica',
    d.respostas.length === antes && d.respostas.find(r => /gripe/i.test(r.pergunta)).resposta === 'Afinal voltou', d.respostas)

  verificar('resposta vazia nao se guarda',
    guardarResposta(d, 'Alguma coisa?', '   ').respostas.length === d.respostas.length)
}

// ── O que vai para a IA ────────────────────────────────────────────────────
seccao('O dossier escrito para a IA')
{
  let d = juntarFactos(dossierVazio(), {
    condicoes: [{ nome: 'Hipertensão', desde: '2019' }, { nome: 'Gripe', estado: 'resolvido' }],
    medicamentos: [{ nome: 'Losartan', detalhe: '50 mg' }],
    valores: [{ nome: 'Colesterol', valor: '232', unidade: 'mg/dL', estado: 'alto' }],
    acontecimentos: [{ quando: '2026-11-14', o_que: 'Ida à urgência por gripe' }],
  }, { fonte: 'Relatorio', data: '2026-11-14' })
  d = guardarResposta(d, 'Já está melhor da gripe?', 'Sim', '2026-12-01')

  const t = resumirParaIA(d, 'Maria Costa', { documentos: 3 })

  verificar('diz de quem e', t.includes('Maria Costa'), t.slice(0, 80))
  verificar('diz quantos documentos ja leu', t.includes('3 documentos lidos'))
  verificar('leva as condicoes', t.includes('Hipertensão'))
  verificar('marca o que ja esta resolvido', t.includes('[resolvido]'))
  verificar('leva a medicacao com a dose', t.includes('Losartan') && t.includes('50 mg'))
  verificar('leva os valores com o estado', t.includes('232') && t.includes('alto'))
  verificar('leva a cronologia', t.includes('urgência'))
  verificar('destaca o que a PESSOA disse, acima dos papeis',
    t.includes('A PRÓPRIA PESSOA DISSE') && t.includes('Sim'), t)

  verificar('um dossier vazio nao produz texto nenhum', resumirParaIA(dossierVazio(), 'X') === '')
  verificar('null tambem nao', resumirParaIA(null, 'X') === '')

  // Um dossier enorme nao pode estourar o pedido.
  let enorme = dossierVazio()
  for (let i = 0; i < 60; i++) {
    enorme = juntarFactos(enorme, {
      condicoes: [{ nome: `Condicao numero ${i} com um nome comprido para ocupar espaco` }],
      acontecimentos: [{ quando: `2026-01-01`, o_que: `Aconteceu a coisa numero ${i}, com bastante texto a descreve-la` }],
    }, { fonte: 'x' })
  }
  const grande = resumirParaIA(enorme, 'Alguem')
  verificar('o resumo tem um tecto', grande.length <= 3300, grande.length)
  verificar('e o tecto corta no fim, nao no principio', grande.startsWith('O QUE JÁ SE SABE'))
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
