// lib/webPush.ts
// ─────────────────────────────────────────────────────────────────────────────
// O envio de notificações push. Uma função, e um resultado que diz a verdade.
//
// A versão anterior fazia a criptografia do Web Push à mão (ECDH + HKDF +
// AES-GCM, ~170 linhas) e devolvia um booleano. Foram esses dois factos que
// mantiveram o Phlox sem notificações nenhumas, durante meses, sem uma única
// mensagem de erro em lado nenhum:
//
//   1. O booleano `false` queria dizer tudo ao mesmo tempo — chave em falta,
//      erro de rede, exceção, subscrição morta. E os nove sítios que o
//      chamavam liam esse `false` como "esta subscrição expirou" e faziam
//      DELETE da linha. Bastava uma variável de ambiente mal posta para a
//      primeira passagem do cron limpar a tabela inteira. A pessoa reativava
//      no telemóvel, e quinze minutos depois era apagada outra vez.
//
//   2. O lib/notifyTeam.ts passava a subscrição na forma { endpoint, keys: {...} }
//      e isto esperava { endpoint, p256dh, auth }. Com `as any` pelo meio,
//      ninguém reparou: a chave saía `undefined`, a criptografia rebentava, e
//      caía no mesmo `false` que apagava a subscrição.
//
// Agora: a biblioteca `web-push`, que é a implementação de referência do
// protocolo, e um resultado que distingue "morreu" de "falhou". Só o 410 e o
// 404 — que é o que a norma define — autorizam apagar uma subscrição.
//
// As chaves: são DUAS (um par), mas o projeto tinha três nomes para elas. O
// cliente precisa da pública com prefixo NEXT_PUBLIC_ para a poder ler no
// browser; o servidor lia VAPID_PUBLIC_KEY, um nome que mais nada no código
// usava. Aqui aceitam-se os dois, porque são a mesma chave e a diferença só
// existia para nos enganar.
//
// Para gerar um par novo: `node scripts/gerar-chaves-vapid.mjs`
// ─────────────────────────────────────────────────────────────────────────────
import webpush from 'web-push'

/** Aceita as duas formas que andam pelo código: a plana (como vem da tabela
 *  push_subscriptions) e a aninhada (como o browser a devolve em toJSON). */
export interface AlvoPush {
  endpoint: string
  p256dh?: string | null
  auth?: string | null
  keys?: { p256dh?: string | null; auth?: string | null } | null
}

export interface ConteudoPush {
  title: string
  body: string
  url?: string
  tag?: string
}

export interface ResultadoPush {
  ok: boolean
  /** true SÓ quando o serviço de push diz que esta subscrição já não existe
   *  (410 Gone ou 404). É a ÚNICA razão legítima para apagar a linha. */
  expirada: boolean
  /** Em português, para ir direto para o registo do servidor. */
  motivo?: string
  estado?: number
}

/** As chaves que o envio precisa mesmo, com os nomes todos aceites.
 *  Exportada para o diagnóstico e para o /api/health-check poderem verificar
 *  EXATAMENTE o que o envio usa — e não um nome parecido. */
export function chavesPush(): { publica: string; privada: string; email: string; falta: string[] } {
  const publica = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const privada = process.env.VAPID_PRIVATE_KEY || ''
  const email = process.env.VAPID_EMAIL || 'suporte@phloxclinical.com'
  const falta: string[] = []
  if (!publica) falta.push('VAPID_PUBLIC_KEY (ou NEXT_PUBLIC_VAPID_PUBLIC_KEY)')
  if (!privada) falta.push('VAPID_PRIVATE_KEY')
  return { publica, privada, email, falta }
}

/** A pública que o browser precisa de usar ao subscrever. Tem de ser a MESMA
 *  com que o servidor assina — se forem de pares diferentes, o serviço de push
 *  responde 403 e nada chega, que é dos enganos mais difíceis de ver. */
export function chavePublicaDoCliente(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || ''
}

let configurado = false
function configurar(): { ok: true } | { ok: false; motivo: string } {
  const { publica, privada, email, falta } = chavesPush()
  if (falta.length) return { ok: false, motivo: `Faltam as chaves VAPID no servidor: ${falta.join(', ')}.` }
  if (!configurado) {
    // O `mailto:` é exigido pela norma VAPID — é o contacto que o serviço de
    // push usa se houver problema com os nossos envios.
    webpush.setVapidDetails(email.startsWith('mailto:') ? email : `mailto:${email}`, publica, privada)
    configurado = true
  }
  return { ok: true }
}

/** Uma notificação, para um dispositivo.
 *
 *  Nunca lança. O chamador decide o que fazer com o resultado — e só deve
 *  apagar a subscrição quando `expirada` for true. */
export async function enviarPush(alvo: AlvoPush, conteudo: ConteudoPush): Promise<ResultadoPush> {
  const cfg = configurar()
  if (!cfg.ok) {
    console.error('[phlox:push]', cfg.motivo)
    return { ok: false, expirada: false, motivo: cfg.motivo }
  }

  const p256dh = alvo.p256dh || alvo.keys?.p256dh || ''
  const auth = alvo.auth || alvo.keys?.auth || ''
  if (!alvo.endpoint || !p256dh || !auth) {
    // Isto é uma linha inútil na tabela, não um dispositivo que desapareceu.
    // Vale a pena limpá-la, mas por uma razão diferente — daí `expirada`.
    const motivo = 'Subscrição incompleta (falta endpoint, p256dh ou auth).'
    console.error('[phlox:push]', motivo, alvo.endpoint?.slice(0, 40))
    return { ok: false, expirada: true, motivo }
  }

  try {
    const res = await webpush.sendNotification(
      { endpoint: alvo.endpoint, keys: { p256dh, auth } },
      JSON.stringify(conteudo),
      { TTL: 86400 },
    )
    return { ok: true, expirada: false, estado: res.statusCode }
  } catch (e: any) {
    const estado: number | undefined = e?.statusCode
    // 410 Gone / 404: o dispositivo desinstalou, limpou os dados ou revogou a
    // permissão. É o único caso em que a linha deve desaparecer.
    if (estado === 410 || estado === 404) {
      return { ok: false, expirada: true, estado, motivo: 'A subscrição já não existe neste dispositivo.' }
    }
    const motivo =
      estado === 403 ? 'O serviço de push recusou a assinatura (403). A chave pública com que o dispositivo subscreveu não é do mesmo par que a privada do servidor — se as chaves foram trocadas, é preciso reativar as notificações nos dispositivos.'
      : estado === 401 ? 'O serviço de push recusou a autenticação (401). Verificar VAPID_PRIVATE_KEY e VAPID_EMAIL.'
      : estado === 413 ? 'A notificação é grande demais para o serviço de push.'
      : estado === 429 ? 'O serviço de push está a limitar os nossos envios (429).'
      : `Falha no envio${estado ? ` (${estado})` : ''}: ${e?.message || e}`
    console.error('[phlox:push]', motivo)
    return { ok: false, expirada: false, estado, motivo }
  }
}

/** Gera um par VAPID novo. Só para o script de arranque e para o /admin —
 *  trocar as chaves invalida TODAS as subscrições existentes. */
export function gerarParVapid(): { publica: string; privada: string } {
  const k = webpush.generateVAPIDKeys()
  return { publica: k.publicKey, privada: k.privateKey }
}
