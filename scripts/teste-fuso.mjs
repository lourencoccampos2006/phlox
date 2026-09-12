// scripts/teste-fuso.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O cron compara horas escolhidas pela pessoa (sempre de Portugal) com colunas
// timestamptz (sempre UTC). Fazia-o com `${dia}T${hora}:00Z`, o que no verão
// olhava para a hora seguinte.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-fuso.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { instanteEmPortugal } from '../lib/ptTime.ts'

let passou = 0, falhou = 0
function caso(dia, hora, esperado) {
  const r = instanteEmPortugal(dia, hora).toISOString()
  if (r === esperado) { passou++; console.log(`  ok   ${dia} ${hora} PT -> ${r}`) }
  else { falhou++; console.log(`  FALHA ${dia} ${hora} PT\n        esperava ${esperado}\n        veio     ${r}`) }
}

console.log('\nVerao (WEST, UTC+1)')
caso('2026-09-12', '09:00', '2026-09-12T08:00:00.000Z')
caso('2026-07-01', '00:00', '2026-06-30T23:00:00.000Z')   // meia-noite em PT ainda e ontem em UTC
caso('2026-06-15', '23:00', '2026-06-15T22:00:00.000Z')

console.log('\nInverno (WET, UTC+0)')
caso('2026-01-12', '09:00', '2026-01-12T09:00:00.000Z')
caso('2026-12-25', '00:00', '2026-12-25T00:00:00.000Z')

console.log('\nNos dias da mudanca')
caso('2026-03-29', '12:00', '2026-03-29T11:00:00.000Z')   // ja de verao
caso('2026-10-25', '12:00', '2026-10-25T12:00:00.000Z')   // ja de inverno

console.log('\nBordos')
{
  const mau = instanteEmPortugal('lixo', '09:00')
  const ok = isNaN(mau.getTime())
  if (ok) { passou++; console.log('  ok   data invalida devolve data invalida') }
  else { falhou++; console.log('  FALHA data invalida devia dar NaN, veio ' + mau.toISOString()) }
}
caso('2026-09-12', '09:00:00', '2026-09-12T08:00:00.000Z')  // aceita HH:MM:SS

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
