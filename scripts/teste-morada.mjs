// scripts/teste-morada.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O caso que importa: "Rua das Flores 1234" não tem código postal nenhum.
// O 1234 é a porta. O /api/geocode antigo lia-o como código postal e mandava a
// carrinha para outra zona do país.
//
//   node --experimental-strip-types scripts/teste-morada.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { separarMorada, zonaDaMoradaPartida } from '../lib/morada.ts'

let passou = 0, falhou = 0
function caso(entrada, esperado) {
  const r = separarMorada(entrada)
  const erros = Object.entries(esperado).filter(([k, v]) => r[k] !== v)
  if (!erros.length) { passou++; console.log(`  ok   ${entrada || '(vazio)'}`) }
  else {
    falhou++
    console.log(`  FALHA ${entrada}`)
    erros.forEach(([k, v]) => console.log(`        ${k}: esperava "${v}", veio "${r[k]}"`))
  }
}

console.log('\nCom codigo postal')
caso('Rua das Flores, 12, 2745-123 Queluz', { rua: 'Rua das Flores, 12', codigoPostal: '2745-123', localidade: 'Queluz' })
caso('Av. da Liberdade 100, 1250-096 Lisboa', { rua: 'Av. da Liberdade 100', codigoPostal: '1250-096', localidade: 'Lisboa' })
caso('Largo do Chiado 2 1200-108 Lisboa', { rua: 'Largo do Chiado 2', codigoPostal: '1200-108', localidade: 'Lisboa' })
caso('R. do Sol 5, 2710 - 444 Sintra', { rua: 'R. do Sol 5', codigoPostal: '2710-444', localidade: 'Sintra' })
caso('Rua A, 4000-001 Porto, Porto', { codigoPostal: '4000-001', localidade: 'Porto' })

console.log('\nO bug: quatro digitos que NAO sao codigo postal')
caso('Rua das Flores 1234', { rua: 'Rua das Flores 1234', codigoPostal: '', localidade: '' })
caso('Rua das Flores, 1234', { rua: 'Rua das Flores, 1234', codigoPostal: '', localidade: '' })
caso('Avenida Central, nº 1987, Braga', { rua: 'Avenida Central, nº 1987', codigoPostal: '', localidade: 'Braga' })

console.log('\nSem codigo postal — rua + localidade tem de chegar')
caso('Rua das Flores 12, Queluz', { rua: 'Rua das Flores 12', codigoPostal: '', localidade: 'Queluz' })
caso('Travessa da Fonte, Sintra', { rua: 'Travessa da Fonte', localidade: 'Sintra' })
caso('Queluz', { rua: '', localidade: 'Queluz' })
caso('Rua do Norte', { rua: 'Rua do Norte', localidade: '' })

console.log('\nBordos')
caso('', { rua: '', codigoPostal: '', localidade: '', bruto: '' })
caso('   ', { bruto: '' })
caso('Rua   das    Flores,   12 ,  2745-123   Queluz ', { rua: 'Rua das Flores, 12', codigoPostal: '2745-123', localidade: 'Queluz' })

console.log('\nZonas (agrupamento na folha do motorista)')
const zona = t => zonaDaMoradaPartida(separarMorada(t))
function casoZona(entrada, esperado) {
  const r = zona(entrada)
  if (r === esperado) { passou++; console.log(`  ok   ${entrada} -> ${r}`) }
  else { falhou++; console.log(`  FALHA ${entrada}\n        esperava "${esperado}", veio "${r}"`) }
}
casoZona('Rua X, 2745-123 Queluz', '2745 · Queluz')
casoZona('Rua das Flores 1234', 'Rua das Flores 1234')   // nao inventa a zona "1234"
casoZona('Rua Y, Sintra', 'Sintra')
casoZona('', 'Sem morada registada')

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
