// scripts/teste-servico.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A regressão que custou semanas: um cron que não consegue falhar.
//
// `createClient(URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` — o `!` é uma
// promessa ao compilador, não uma verificação. Sem a variável, o supabase-js
// constrói o cliente na mesma, cada consulta volta com erro, o código corre
// até ao fim sem fazer nada e responde 200. GitHub Actions verde, zero
// notificações, nenhuma pista.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-servico.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { clienteDeServico, confirmarLigacao } from '../lib/servico.ts'

let passou = 0, falhou = 0
const verificar = (n, c, o) => {
  if (c) { passou++; console.log(`  ok   ${n}`) }
  else { falhou++; console.log(`  FALHA ${n}\n        obtido: ${JSON.stringify(o)}`) }
}

const guardar = { ...process.env }
const repor = () => { for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, guardar) }

console.log('\nSem a chave de servico')
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = clienteDeServico()
  verificar('recusa em vez de construir um cliente morto', r.ok === false, r)
  verificar('diz o nome exato da variavel', /SUPABASE_SERVICE_ROLE_KEY/.test(r.motivo || ''), r.motivo)
  verificar('responde 503, para o workflow ficar vermelho', r.estado === 503, r.estado)
  verificar('diz onde a por', /Vercel/.test(r.comoResolver || ''), r.comoResolver)
}
repor()

console.log('\nSem o endereco')
{
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-qualquer'
  const r = clienteDeServico()
  verificar('tambem recusa', r.ok === false, r)
  verificar('diz qual falta', /NEXT_PUBLIC_SUPABASE_URL/.test(r.motivo || ''), r.motivo)
}
repor()

console.log('\nCom as duas')
{
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-qualquer'
  const r = clienteDeServico()
  verificar('devolve um cliente', r.ok === true && !!r.sb, r.ok)
}
repor()

console.log('\nChave presente mas recusada (o caso silencioso)')
{
  const fingir = (resposta) => ({
    from: () => {
      const alvo = resposta
      const p = new Proxy(alvo, {
        get(t, k) {
          if (k === 'then') return (res, rej) => Promise.resolve(alvo).then(res, rej)
          if (k in t) return t[k]
          return () => p
        },
      })
      return p
    },
  })

  const mau = await confirmarLigacao(fingir({ error: { message: 'Invalid API key' } }))
  verificar('deteta a chave invalida', mau.ok === false, mau)
  verificar('repete a mensagem da base de dados', /Invalid API key/.test(mau.motivo || ''), mau.motivo)

  const bom = await confirmarLigacao(fingir({ error: null, data: [] }))
  verificar('chave boa passa', bom.ok === true, bom)

  const arde = await confirmarLigacao({ from: () => { throw new Error('projeto em pausa') } })
  verificar('projeto em pausa nao rebenta a rota', arde.ok === false, arde)
  verificar('e explica-o', /pausa/.test(arde.comoResolver || ''), arde.comoResolver)
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
