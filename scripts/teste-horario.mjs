// scripts/teste-horario.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A frequência que a pessoa escreve → as horas do lembrete.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-horario.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { horasDaFrequencia, explicarHorario } from '../lib/horarioToma.ts'

let passou = 0, falhou = 0
function caso(freq, horas, confianca) {
  const r = horasDaFrequencia(freq)
  const okH = JSON.stringify(r.horas) === JSON.stringify(horas)
  const okC = !confianca || r.confianca === confianca
  if (okH && okC) { passou++; console.log(`  ok   ${JSON.stringify(freq)} -> [${r.horas.join(', ')}] (${r.origem})`) }
  else {
    falhou++
    console.log(`  FALHA ${JSON.stringify(freq)}`)
    if (!okH) console.log(`        horas: esperava [${horas.join(', ')}], veio [${r.horas.join(', ')}]`)
    if (!okC) console.log(`        confianca: esperava ${confianca}, veio ${r.confianca}`)
  }
}

console.log('\nVezes por dia')
caso('1x por dia', ['09:00'], 'alta')
caso('2x por dia', ['09:00', '21:00'], 'alta')
caso('3x/dia', ['08:00', '13:00', '20:00'], 'alta')
caso('4 vezes ao dia', ['08:00', '12:00', '16:00', '20:00'], 'alta')
caso('duas vezes por dia', ['09:00', '21:00'], 'alta')
caso('tres vezes', ['08:00', '13:00', '20:00'], 'alta')
caso('três vezes ao dia', ['08:00', '13:00', '20:00'], 'alta')
caso('10x por dia', ['06:00', '10:00', '14:00', '18:00', '22:00', '02:00'], 'alta')   // limitado a 6

console.log('\nIntervalos')
caso('de 8 em 8 horas', ['00:00', '08:00', '16:00'], 'alta')
caso('de 12 em 12 horas', ['08:00', '20:00'], 'alta')
caso('a cada 6 horas', ['02:00', '08:00', '14:00', '20:00'], 'alta')
caso('8/8h', ['00:00', '08:00', '16:00'], 'alta')

console.log('\nMomentos do dia')
caso('ao deitar', ['22:00'], 'alta')
caso('em jejum', ['08:00'], 'alta')
caso('ao pequeno-almoço', ['08:00'], 'alta')
caso('ao almoço', ['13:00'], 'alta')
caso('ao jantar', ['20:00'], 'alta')
caso('de manhã e ao jantar', ['08:00', '20:00'], 'alta')
caso('ao lanche', ['16:30'], 'alta')

console.log('\nSem lembrete — e e a resposta certa')
caso('SOS', [], 'alta')
caso('se necessario', [], 'alta')
caso('em caso de dor', [], 'alta')
caso('1x por semana', [], 'alta')
caso('mensal', [], 'alta')

console.log('\nPalpites honestos')
caso('', ['09:00'], 'baixa')
caso(null, ['09:00'], 'baixa')
caso('conforme indicado pelo medico', ['09:00'], 'baixa')
caso('diário', ['09:00'], 'media')
caso('1 comprimido ao dia', ['09:00'], 'media')  // "ao dia" e uma vez, mas nao e explicito

console.log('\nA frase que a pessoa le')
const frases = [
  ['2x por dia', /Lembrete às 09:00 e 21:00/],
  ['SOS', /Sem lembrete/],
  ['', /palpite/],
]
frases.forEach(([f, re]) => {
  const t = explicarHorario(horasDaFrequencia(f))
  if (re.test(t)) { passou++; console.log(`  ok   ${JSON.stringify(f)} -> "${t}"`) }
  else { falhou++; console.log(`  FALHA ${JSON.stringify(f)} -> "${t}"`) }
})

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
