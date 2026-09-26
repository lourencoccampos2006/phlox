// scripts/teste-juncao.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Prova que juntar pedidos idênticos em voo não engana quem os pediu.
//
// ── O RISCO QUE ISTO VIGIA ─────────────────────────────────────────────────
// O corpo de uma `Response` só se lê UMA vez. Ao partilhar a resposta de um
// pedido por vários leitores, o segundo leria um corpo já gasto e ficava com
// uma lista vazia — que é exatamente o género de avaria silenciosa que este
// projeto passa a vida a caçar. O `comVigilancia` devolve uma CÓPIA a cada
// leitor; este teste confirma que devolve mesmo.
//
// ── PORQUE É QUE NÃO USA UM BROWSER ────────────────────────────────────────
// Porque não precisa. `comVigilancia` é uma função que recebe um `fetch` e
// devolve outro: dá-se-lhe um falso que conta chamadas, e vê-se o que sai.
// Um teste que corre em 300 milissegundos e não depende de sessões nem de
// rede é um teste que se corre sempre.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-juncao.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { comVigilancia } from '../lib/supabaseVigiado.ts'

const URL_LEITURA = 'https://exemplo.supabase.co/rest/v1/patients?select=id,name'
const CORPO = JSON.stringify([{ id: 'a', name: 'Dona Maria' }, { id: 'b', name: 'Sr. João' }])

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

/** Um fetch falso que conta e demora um bocado, como a rede. */
function falso(atraso = 30) {
  const estado = { chamadas: 0 }
  const fn = async () => {
    estado.chamadas++
    await new Promise(r => setTimeout(r, atraso))
    return new Response(CORPO, { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { fn, estado }
}

console.log('\nLEITURAS IGUAIS AO MESMO TEMPO')
{
  const { fn, estado } = falso()
  const f = comVigilancia(fn)
  const cab = { Authorization: 'Bearer abc123' }
  const rs = await Promise.all(Array.from({ length: 5 }, () => f(URL_LEITURA, { headers: cab })))
  const corpos = await Promise.all(rs.map(r => r.text()))

  ok('so um pedido foi a rede', estado.chamadas === 1, `foram ${estado.chamadas}`)
  ok('os cinco receberam o corpo', corpos.every(c => c === CORPO),
    `${corpos.filter(c => c === CORPO).length} de 5 corretos`)
}

console.log('\nDEPOIS DE RESPONDER, VOLTA A PERGUNTAR')
{
  const { fn, estado } = falso(5)
  const f = comVigilancia(fn)
  await f(URL_LEITURA).then(r => r.text())
  await new Promise(r => setTimeout(r, 30))
  await f(URL_LEITURA).then(r => r.text())
  // Não é uma cache: assim que o pedido responde, o seguinte vai à rede outra
  // vez. Ninguém pode ver dados mais velhos do que o tempo que a rede demorou.
  ok('nao guarda a resposta', estado.chamadas === 2, `foram ${estado.chamadas}`)
}

console.log('\nESCRITAS NUNCA SE JUNTAM')
{
  const { fn, estado } = falso()
  const f = comVigilancia(fn)
  await Promise.all([
    f(URL_LEITURA, { method: 'POST', body: '{}' }),
    f(URL_LEITURA, { method: 'POST', body: '{}' }),
  ])
  // Dois inserts iguais podem ser duas coisas que aconteceram mesmo. Juntá-los
  // perderia uma — e num registo de cuidados isso é perder um facto.
  ok('dois POST iguais foram os dois', estado.chamadas === 2, `foram ${estado.chamadas}`)
}

console.log('\nSESSOES DIFERENTES NAO SE MISTURAM')
{
  const { fn, estado } = falso()
  const f = comVigilancia(fn)
  await Promise.all([
    f(URL_LEITURA, { headers: { Authorization: 'Bearer aaa' } }),
    f(URL_LEITURA, { headers: { Authorization: 'Bearer bbb' } }),
  ])
  // A RLS responde de forma diferente a cada pessoa. Partilhar a resposta entre
  // duas sessoes seria mostrar os dados de uma casa a quem e de outra.
  ok('dois tokens diferentes = dois pedidos', estado.chamadas === 2, `foram ${estado.chamadas}`)
}

console.log('\nO QUE NAO E DO SUPABASE PASSA INTACTO')
{
  const { fn, estado } = falso()
  const f = comVigilancia(fn)
  await Promise.all([f('https://outro.sitio/api/x'), f('https://outro.sitio/api/x')])
  ok('nao mexe em pedidos de fora', estado.chamadas === 2, `foram ${estado.chamadas}`)
}

console.log(falhas ? `\n✗ ${falhas} falha(s).` : '\n✓ A juncao poupa pedidos sem perder respostas.')
process.exit(falhas ? 1 : 0)
