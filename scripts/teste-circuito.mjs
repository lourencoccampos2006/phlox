// scripts/teste-circuito.mjs
// ─────────────────────────────────────────────────────────────────────────────
// As horas do circuito casa-centro-casa saem da rota, não de quem organiza.
//
//   node --experimental-strip-types scripts/teste-circuito.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { horariosDoCircuito } from '../lib/rotaTransporte.ts'

let passou = 0, falhou = 0
function verificar(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  if (ok) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}\n        esperava ${JSON.stringify(esperado)}\n        veio     ${JSON.stringify(obtido)}`) }
}

const p = n => Array.from({ length: n }, (_, i) => ({
  scheduleId: `s${i}`, patientId: `p${i}`, nome: `Pessoa ${i}`, label: 'Circuito',
  hora: null, morada: null, zona: 'z', feito: false, intervalo: null, abreZona: false, lat: null, lon: null,
}))

console.log('\nTrês paragens, 8h00, 3 min a cada porta')
// casa->1 = 7min, 1->2 = 5min, 2->3 = 9min, 3->casa = 12min
{
  const c = horariosDoCircuito(p(3), '08:00', [7, 5, 9, 12], 3)
  verificar('chegada à 1ª porta (8:00 + 7)', c.paragens[0].horaEstimada, '08:07')
  verificar('chegada à 2ª (8:07 + 3 na porta + 5 de estrada)', c.paragens[1].horaEstimada, '08:15')
  verificar('chegada à 3ª (8:15 + 3 + 9)', c.paragens[2].horaEstimada, '08:27')
  verificar('regresso a casa (8:27 + 12)', c.regresso, '08:39')
  verificar('duração total em minutos', c.minutosTotal, 39)
  verificar('não é aproximado — havia tempos reais', c.aproximado, false)
}

console.log('\nSem tempos de estrada (sem coordenadas ou serviço em baixo)')
{
  const c = horariosDoCircuito(p(2), '09:00', [], 5)
  verificar('usa um valor honesto por troço', c.paragens[0].horaEstimada, '09:06')
  verificar('e a segunda a seguir', c.paragens[1].horaEstimada, '09:17')
  verificar('assume-se aproximado', c.aproximado, true)
}

console.log('\nBordos')
{
  const c = horariosDoCircuito([], '08:30', [], 3)
  verificar('sem ninguém: parte e volta', [c.partida, c.paragens.length], ['08:30', 0])

  const noite = horariosDoCircuito(p(1), '23:50', [30], 3)
  verificar('passa da meia-noite sem estoirar', noite.paragens[0].horaEstimada, '00:20')

  const sujo = horariosDoCircuito(p(1), 'lixo', [10], 3)
  verificar('hora inválida → assume 08:00', sujo.partida, '08:00')
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
