// scripts/teste-dependencias.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O perfil de dependência é a peça que transforma um número numa decisão de
// cuidado. Se ela se enganar, o plano fica errado de forma plausível — que é
// a pior maneira de estar errado.
//
// Estas asserções estão escritas como frases sobre uma pessoa, e não como
// comparações de números: é assim que se percebe, ao relê-las daqui a um ano,
// se continuam a dizer o que deviam.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-dependencias.mjs
// ─────────────────────────────────────────────────────────────────────────────
import {
  perfilDeDependencia, ondePrecisaDeAjuda, perfilEmUmaLinha,
  sugestoesDasAvaliacoes, estadoDasEscalas,
} from '../lib/dependencias.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

// Uma pessoa real: come sozinha, não toma banho sozinha, precisa de ajuda a
// vestir-se, precisa de grande ajuda para se levantar, e não sobe escadas.
const DONA_MARIA = {
  feeding: 10,   // independente
  bathing: 0,    // dependente (o banho vale 5 no maximo)
  grooming: 5,   // independente (a higiene tambem vale 5)
  dressing: 5,   // ajuda (o vestir vale 10)
  bowels: 10,
  bladder: 5,    // ajuda
  toilet: 5,     // ajuda
  transfer: 5,   // ajuda (a transferencia vale 15)
  mobility: 10,  // ajuda (andar vale 15)
  stairs: 0,     // dependente
}

console.log('\nO PERFIL SAI DAS RESPOSTAS, NAO DA PONTUACAO')
{
  const perfil = perfilDeDependencia(DONA_MARIA)
  const de = id => perfil.find(x => x.id === id)?.nivel

  ok('comer: faz sozinha', de('feeding') === 'independente', de('feeding'))
  // O item que quase me enganou: 5 no banho e o MAXIMO, logo independente;
  // 5 na transferencia e «grande ajuda». Comparar pontuacoes entre itens
  // daria os dois iguais.
  ok('higiene com 5 em 5: faz sozinha', de('grooming') === 'independente', de('grooming'))
  ok('transferencia com 5 em 15: precisa de ajuda', de('transfer') === 'ajuda', de('transfer'))
  ok('banho com 0: depende de outra pessoa', de('bathing') === 'dependente', de('bathing'))
  ok('vestir com 5 em 10: precisa de ajuda', de('dressing') === 'ajuda', de('dressing'))
}

console.log('\nO QUE NAO FOI RESPONDIDO NAO E DEPENDENCIA')
{
  // Uma avaliacao a meio nao pode inventar necessidades: por «dependente» num
  // item que ninguem avaliou poria no plano um cuidado que ninguem viu.
  const perfil = perfilDeDependencia({ feeding: 10, bathing: 0 })
  ok('so os itens respondidos entram', perfil.length === 2, `${perfil.length} itens`)
  ok('nada foi inventado', !perfil.some(d => d.id === 'transfer'))
}

console.log('\nSEM AVALIACAO NENHUMA, NAO HA PERFIL')
{
  ok('null devolve vazio', perfilDeDependencia(null).length === 0)
  ok('objeto vazio devolve vazio', perfilDeDependencia({}).length === 0)
  ok('sem perfil nao ha frase', perfilEmUmaLinha([]) === '')
}

console.log('\nSO O QUE PRECISA DE ALGUEM')
{
  const perfil = perfilDeDependencia(DONA_MARIA)
  const ajuda = ondePrecisaDeAjuda(perfil)
  ok('tira o que ela faz sozinha', ajuda.every(d => d.nivel !== 'independente'))
  ok('sobra o que importa', ajuda.length === 7, `${ajuda.length} de ${perfil.length}`)
}

console.log('\nAS SUGESTOES SAEM DAS AVALIACOES')
{
  const s = sugestoesDasAvaliacoes({
    barthel: { score: 50, answers: DONA_MARIA, date: '2026-09-01' },
    braden: { score: 11, date: '2026-09-01' },   // risco alto
    morse: { score: 60, date: '2026-09-01' },    // risco elevado
    mna: { score: 6, date: '2026-09-01' },       // desnutricao
  })
  const tem = t => s.some(x => x.oQue.toLowerCase().includes(t) || x.servico === t)

  ok('o banho dependente pede o servico Banho', s.some(x => x.servico === 'Banho'))
  ok('o Braden baixo pede posicionamento', s.some(x => x.servico === 'Posicionamento'))
  ok('o Morse alto sugere a etiqueta de risco de queda',
    s.some(x => x.etiqueta === 'Risco de queda'))
  ok('o MNA baixo fala de nutricao', s.some(x => x.origem === 'MNA'))
  // Sem isto, uma sugestao e «porque o programa disse» — e quem a recebe nao
  // pode discordar com conhecimento de causa.
  ok('todas dizem de onde vieram', s.every(x => x.origem && x.porque))
  ok('as urgentes vem primeiro', s[0].gravidade === 'urgente', s[0].gravidade)
}

console.log('\nSEM AVALIACOES, NAO HA SUGESTOES INVENTADAS')
{
  const s = sugestoesDasAvaliacoes({})
  ok('nada entra, nada sai', s.length === 0, `${s.length} sugestoes`)
}

console.log('\nUMA ESCALA BOA NAO GERA RUIDO')
{
  const s = sugestoesDasAvaliacoes({
    barthel: { score: 100, answers: { feeding: 10, bathing: 5, grooming: 5, dressing: 10, bowels: 10, bladder: 10, toilet: 10, transfer: 15, mobility: 15, stairs: 10 }, date: '2026-09-01' },
    braden: { score: 22, date: '2026-09-01' },
    morse: { score: 0, date: '2026-09-01' },
    mna: { score: 14, date: '2026-09-01' },
  })
  ok('pessoa autonoma nao gera sugestoes', s.length === 0, `${s.length} sugestoes`)
}

console.log('\nA FRESCURA DAS ESCALAS')
{
  const hoje = new Date('2026-09-26T12:00:00')
  const e = estadoDasEscalas({ barthel: '2026-09-01', braden: '2025-01-01' }, hoje)
  const de = id => e.find(x => x.escala === id)

  ok('uma feita ha 25 dias nao chama', de('barthel').chama === false)
  ok('um Braden de ha mais de um ano chama', de('morse').chama === true)
  ok('uma que nunca foi feita chama', de('mmse').chama === true && de('mmse').data === null)
  ok('as que chamam vem primeiro', e[0].chama === true)
  // Um centro de dia nao tem equipa clinica a tempo inteiro. Nada aqui pode
  // soar a divida.
  ok('nenhuma frase diz «atraso»', e.every(x => !/atras/i.test(x.frase)))
}

console.log(falhas ? `\n✗ ${falhas} falha(s).` : '\n✓ O perfil de dependencia diz o que deve dizer.')
process.exit(falhas ? 1 : 0)
