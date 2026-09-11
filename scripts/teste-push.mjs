// scripts/teste-push.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Prova que o bug que manteve o Phlox sem notificações está mesmo morto.
//
// O bug: sendPushNotification devolvia `false` para tudo — chave em falta, erro
// de rede, 500 do servidor, subscrição morta — e os nove sítios que a chamavam
// liam esse `false` como "expirou" e faziam DELETE da linha. Uma variável de
// ambiente mal posta apagava a tabela inteira à primeira passagem do cron.
//
// A regra certa, que é a da norma: só o 410 (Gone) e o 404 autorizam apagar.
//
// Corre com:  node --experimental-strip-types scripts/teste-push.mjs
// ─────────────────────────────────────────────────────────────────────────────
import https from 'node:https'
import { Readable, Writable } from 'node:stream'
import crypto from 'node:crypto'
import webpush from 'web-push'

let passou = 0, falhou = 0
function verificar(nome, condicao, obtido) {
  if (condicao) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome}\n        obtido: ${JSON.stringify(obtido)}`) }
}

// ── Um serviço de push falso ────────────────────────────────────────────────
// O web-push fala sempre HTTPS (node_modules/web-push/src/web-push-lib.js:369
// chama https.request). Montar um servidor TLS só para isto obrigava a gerar um
// certificado; em vez disso trocamos o https.request pelo nosso, que é o que
// esta biblioteca vai mesmo usar. O teste fica sem rede e sem ficheiros.
let estadoASimular = 201
const pedidosFeitos = []

const requestOriginal = https.request
https.request = function (opcoes, callback) {
  pedidosFeitos.push(opcoes)
  const resposta = new Readable({ read() {} })
  resposta.statusCode = estadoASimular
  resposta.headers = {}
  const pedido = new Writable({ write(_c, _e, cb) { cb() } })
  pedido.setTimeout = () => pedido
  process.nextTick(() => {
    callback(resposta)
    resposta.push(estadoASimular === 201 ? null : `simulado ${estadoASimular}`)
    if (estadoASimular !== 201) resposta.push(null)
  })
  return pedido
}

const endpoint = 'https://fcm.googleapis.com/fcm/send/abc'

// ── Uma subscrição válida de verdade (chaves reais, não texto inventado) ────
const par = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const p256dh = par.publicKey.export({ type: 'spki', format: 'der' }).subarray(-65).toString('base64url')
const auth = crypto.randomBytes(16).toString('base64url')
const subscricao = { endpoint, p256dh, auth }

const chaves = webpush.generateVAPIDKeys()

async function carregar() {
  // O módulo lê as variáveis de ambiente quando envia, por isso reimporta-se
  // com uma query diferente para forçar um estado limpo entre cenários.
  const m = await import(`../lib/webPush.ts?v=${Math.random()}`)
  return m
}

console.log('\nCenários sem chaves no servidor')
delete process.env.VAPID_PUBLIC_KEY
delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
delete process.env.VAPID_PRIVATE_KEY
{
  const { enviarPush } = await carregar()
  const r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('sem chaves → não envia', r.ok === false, r)
  verificar('sem chaves → NÃO marca como expirada (era isto que apagava tudo)', r.expirada === false, r)
  verificar('sem chaves → diz o que falta', /VAPID_PRIVATE_KEY/.test(r.motivo || ''), r)
}

console.log('\nCenários com chaves')
process.env.VAPID_PUBLIC_KEY = chaves.publicKey
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = chaves.publicKey
process.env.VAPID_PRIVATE_KEY = chaves.privateKey
process.env.VAPID_EMAIL = 'suporte@phloxclinical.com'

{
  const { enviarPush, chavesPush, chavePublicaDoCliente } = await carregar()

  verificar('chavesPush() não acusa falta', chavesPush().falta.length === 0, chavesPush().falta)
  verificar('as duas públicas coincidem', chavePublicaDoCliente() === chavesPush().publica, null)

  estadoASimular = 201
  let r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('201 → enviada', r.ok === true && r.expirada === false, r)

  estadoASimular = 410
  r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('410 Gone → expirada, pode apagar', r.ok === false && r.expirada === true, r)

  estadoASimular = 404
  r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('404 → expirada, pode apagar', r.ok === false && r.expirada === true, r)

  estadoASimular = 500
  r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('500 → falha NOSSA, a subscrição fica', r.ok === false && r.expirada === false, r)

  estadoASimular = 429
  r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('429 → limitação, a subscrição fica', r.ok === false && r.expirada === false, r)

  estadoASimular = 403
  r = await enviarPush(subscricao, { title: 't', body: 'b' })
  verificar('403 → a subscrição fica', r.ok === false && r.expirada === false, r)
  verificar('403 → explica que as chaves não são do mesmo par', /par/.test(r.motivo || ''), r)

  // As duas formas de subscrição que andam pelo código (a plana, da tabela, e a
  // aninhada, que o lib/notifyTeam.ts passava e que rebentava em silêncio).
  estadoASimular = 201
  r = await enviarPush({ endpoint, keys: { p256dh, auth } }, { title: 't', body: 'b' })
  verificar('aceita a forma aninhada { keys: {...} } (o bug do notifyTeam)', r.ok === true, r)

  r = await enviarPush({ endpoint, p256dh: '', auth: '' }, { title: 't', body: 'b' })
  verificar('subscrição sem chaves → linha inútil, pode apagar', r.ok === false && r.expirada === true, r)
}

https.request = requestOriginal
console.log(`\n${passou} passaram, ${falhou} falharam\n`)
process.exit(falhou ? 1 : 0)
