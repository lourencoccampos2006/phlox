// scripts/teste-o-dia-horas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A aritmética das horas do /o-dia (sprint170).
//
// ── PORQUE É QUE ISTO PRECISA DE TESTES ─────────────────────────────────────
// Nada aqui dá erro quando está errado. Uma lista mal ordenada é uma lista
// bonita: as horas estão todas lá, cada uma com as suas tarefas, e só quem
// souber a que horas as coisas acontecem é que repara que está ao contrário.
//
// E há três maneiras silenciosas de a ordenação sair errada, todas clássicas:
//   • `null` tratado como zero, e tudo o que não tem hora sobe ao topo;
//   • horas comparadas como TEXTO, e '9:00' fica depois de '10:00';
//   • uma hora inválida a virar `NaN`, que faz o `sort` devolver a lista
//     praticamente intacta — e parece que a ordenação simplesmente não corre.
//
// Foi por não haver horas nenhumas na base de dados de desenvolvimento que
// isto passou a ser um teste em vez de uma verificação no browser: o
// `qa-o-dia-horas.mjs` só consegue medir a ordem quando ALGUÉM tiver marcado
// horas. Este mede-a sempre.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-o-dia-horas.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { horaValida, minutosDe, porHora, porPessoa, tarefasDaMedicacao } from '../lib/oDia.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

/** Uma tarefa de mentira, só com o que estas funções leem. */
const tarefa = (chave, hora, nome = 'Ana', fonte = 'servico', feito = false) => ({
  chave, fonte, patientId: 'p1', nome, oQue: chave,
  turno: 'manha', hora, area: 'registos', feito, ref: {},
})

// ── horaValida ───────────────────────────────────────────────────────────────
console.log('\nhoraValida — o que é mesmo uma hora')
{
  ok('«08:00» passa', horaValida('08:00') === '08:00')
  ok('«9:00» ganha o zero', horaValida('9:00') === '09:00',
    'as tabelas antigas guardam a hora em texto livre')
  ok('«09:00:00» perde os segundos', horaValida('09:00:00') === '09:00',
    'activities.start_time vem assim do Postgres')
  ok('null é null', horaValida(null) === null)
  ok('vazio é null', horaValida('') === null)
  ok('«manhã» é null', horaValida('manhã') === null)
  ok('«25:00» é null', horaValida('25:00') === null, 'não existe, e não se arredonda')
  ok('«08:75» é null', horaValida('08:75') === null)
  ok('«23:59» passa', horaValida('23:59') === '23:59')
  ok('«00:00» passa', horaValida('00:00') === '00:00', 'meia-noite não é «sem hora»')
}

// ── minutosDe ────────────────────────────────────────────────────────────────
console.log('\nminutosDe — para ordenar, e mais nada')
{
  ok('00:00 → 0', minutosDe('00:00') === 0)
  ok('08:30 → 510', minutosDe('08:30') === 510)
  ok('23:59 → 1439', minutosDe('23:59') === 1439)
  ok('sem hora → null, e NÃO zero', minutosDe(null) === null,
    'zero punha tudo o que não tem hora à frente da primeira toma do dia')
  ok('lixo → null', minutosDe('logo à tarde') === null)
}

// ── porHora ──────────────────────────────────────────────────────────────────
console.log('\nporHora — a linha do tempo')
{
  const g = porHora([
    tarefa('c', '10:00'), tarefa('a', '08:00'), tarefa('d', null), tarefa('b', '09:30'),
  ])
  ok('um grupo por hora, mais o dos sem hora', g.length === 4, g.map(x => x.titulo).join(' '))
  ok('as horas sobem',
    g.slice(0, 3).map(x => x.titulo).join(' ') === '08:00 09:30 10:00',
    g.map(x => x.titulo).join(' → '))
  ok('«a qualquer hora» vai para o FIM', g[3].titulo === 'A qualquer hora')
  ok('e não tem hora nenhuma', g[3].hora === null)
}
{
  // O erro clássico: comparar horas como texto. '9:00' > '10:00' em texto.
  const g = porHora([tarefa('tarde', '10:00'), tarefa('cedo', '09:00')])
  ok('09:00 vem antes de 10:00', g[0].titulo === '09:00',
    'comparadas como texto sairia ao contrário')
}
{
  const g = porHora([
    tarefa('x', '08:00', 'Ana'), tarefa('y', '08:00', 'Zulmira'), tarefa('w', '08:00', 'Bruno'),
  ])
  ok('mesma hora = um grupo só', g.length === 1)
  ok('e lá dentro por pessoa',
    g[0].tarefas.map(t => t.nome).join(' ') === 'Ana Bruno Zulmira',
    g[0].tarefas.map(t => t.nome).join(' '))
}
{
  // A diferença deliberada em relação às outras duas vistas.
  const g = porHora([
    tarefa('feito', '08:00', 'Ana', 'servico', true),
    tarefa('porFazer', '09:00'),
  ])
  ok('uma hora já tratada NÃO desce para o fim', g[0].titulo === '08:00',
    'senão a lista muda de ordem à medida que se trabalha e perde-se o sítio')
  ok('e diz que está tratada', g[0].subtitulo === 'tudo tratado')
}
{
  ok('lista vazia dá zero grupos', porHora([]).length === 0)
  const g = porHora([tarefa('só', null)])
  ok('só coisas sem hora dá um grupo só', g.length === 1 && g[0].hora === null)
}

// ── porPessoa ────────────────────────────────────────────────────────────────
console.log('\nporPessoa — dentro de cada pessoa, o relógio manda')
{
  const g = porPessoa([
    tarefa('tarde', '16:00'), tarefa('semHora', null), tarefa('cedo', '08:00'),
  ])
  ok('cedo, tarde, e sem hora no fim',
    g[0].tarefas.map(t => t.chave).join(' ') === 'cedo tarde semHora',
    g[0].tarefas.map(t => t.chave).join(' '))
}
{
  // A hora passou à frente do tipo de tarefa — mas só entre horas diferentes.
  const med = { ...tarefa('dose', '22:00'), fonte: 'medicacao' }
  const banho = tarefa('banho', '10:00')
  const g = porPessoa([med, banho])
  ok('a dose das 22:00 NÃO salta à frente do banho das 10:00',
    g[0].tarefas[0].chave === 'banho',
    'antes do sprint170 a medicação vinha sempre primeiro')
}
{
  const a = { ...tarefa('dose', '08:00'), fonte: 'medicacao' }
  const b = tarefa('banho', '08:00')
  const g = porPessoa([b, a])
  ok('à MESMA hora, a dose vem primeiro', g[0].tarefas[0].chave === 'dose',
    'entre duas coisas às oito, a que não espera é a medicação')
}
{
  const g = porPessoa([
    { ...tarefa('jaFeito', '07:00'), feito: true },
    tarefa('porFazer', '19:00'),
  ])
  ok('o que falta vem sempre antes do que está feito',
    g[0].tarefas[0].chave === 'porFazer',
    'mesmo sendo mais tarde no dia')
}

// ── tarefasDaMedicacao ───────────────────────────────────────────────────────
console.log('\ntarefasDaMedicacao — a hora por turno')
{
  const pessoas = [{ id: 'p1', name: 'Ana' }]
  const med = {
    id: 'm1', patient_id: 'p1', name: 'Brifen', dose: '20mg',
    shifts: ['manha', 'noite'], horas: { manha: '08:00', noite: '22:00' },
  }
  const manha = tarefasDaMedicacao(pessoas, [med], [], 'manha')
  const noite = tarefasDaMedicacao(pessoas, [med], [], 'noite')
  ok('de manhã, às 08:00', manha[0].hora === '08:00')
  ok('à noite, às 22:00', noite[0].hora === '22:00',
    'o mesmo medicamento, horas diferentes — é por isto que não é uma lista paralela')

  const semHoras = tarefasDaMedicacao(pessoas, [{ ...med, horas: {} }], [], 'manha')
  ok('sem horas marcadas, a toma fica sem hora', semHoras[0].hora === null,
    'e vai para «a qualquer hora», que é a verdade')

  const soManha = tarefasDaMedicacao(pessoas, [{ ...med, horas: { manha: '08:00' } }], [], 'noite')
  ok('um turno com hora e outro sem convivem', soManha[0].hora === null)

  const nulo = tarefasDaMedicacao(pessoas, [{ ...med, horas: null }], [], 'manha')
  ok('`horas` a null não rebenta', nulo.length === 1 && nulo[0].hora === null,
    'as linhas criadas antes do sprint170 vêm assim')

  const mau = tarefasDaMedicacao(pessoas, [{ ...med, horas: { manha: 'de manhã' } }], [], 'manha')
  ok('uma hora que não é hora fica a null', mau[0].hora === null,
    'em vez de ir para o fundo da lista como NaN')
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ As horas ordenam-se pelo relógio, e o que não tem hora fica no fim.')
process.exit(falhas ? 1 : 0)
