// lib/notify.ts
// Envio real de SMS/WhatsApp à família — Twilio, via REST simples (um fetch
// com Basic Auth, sem SDK) para não trazer uma dependência nova só para isto.
// 2026-08-11 (pedido do Fernando, depois de ver a estimativa de custo real).
//
// Configuração em falta = no-op no servidor com erro claro devolvido à UI —
// MESMO padrão de SUPABASE_SERVICE_ROLE_KEY (lib/familyPortal.ts) e do VAPID
// (lib/pushActivation.ts): opcional, nunca parte o resto do que já funciona
// sem isto. Ver INSTRUÇÕES DE CONFIGURAÇÃO no fundo deste ficheiro.
//
// IMPORTANTE sobre WhatsApp especificamente: o WhatsApp Business só deixa uma
// empresa COMEÇAR uma conversa (a família nunca escreveu primeiro) com uma
// "template message" pré-aprovada pela Meta — texto livre só funciona depois
// de a família responder, dentro de uma janela de 24h. Isto pode demorar 1-2
// dias a aprovar a primeira vez. Por isso: SMS funciona logo no dia 1 sem
// aprovação nenhuma; WhatsApp é o passo seguinte, não o primeiro.

const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM   // ex: 'whatsapp:+351210000000'
const SMS_FROM = process.env.TWILIO_SMS_FROM             // ex: '+351210000000'

export const HAS_TWILIO = !!(SID && TOKEN)
export const HAS_WHATSAPP = !!(SID && TOKEN && WHATSAPP_FROM)
export const HAS_SMS = !!(SID && TOKEN && SMS_FROM)

export type NotifyResult = { ok: true; sid: string } | { ok: false; error: string }

// Normaliza para E.164. Números portugueses (9 dígitos, começam por 9/2/3)
// assumem-se +351 se não vier já com indicativo — cobre o caso comum sem
// obrigar quem regista o contacto a escrever o "+351" à mão.
export function toE164(raw: string): string | null {
  const digits = (raw || '').replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  if (/^9\d{8}$/.test(digits) || /^2\d{8}$/.test(digits) || /^3\d{8}$/.test(digits)) return `+351${digits}`
  if (digits.length >= 8) return `+${digits}`
  return null
}

async function send(to: string, from: string, body: string): Promise<NotifyResult> {
  if (!SID || !TOKEN) return { ok: false, error: 'not_configured' }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: j?.message || `Twilio respondeu ${res.status}` }
    return { ok: true, sid: j.sid }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro de rede a contactar o Twilio.' }
  }
}

export async function sendWhatsApp(toRaw: string, body: string): Promise<NotifyResult> {
  if (!HAS_WHATSAPP) return { ok: false, error: 'not_configured' }
  const to = toE164(toRaw)
  if (!to) return { ok: false, error: 'Número de telefone inválido.' }
  return send(`whatsapp:${to}`, WHATSAPP_FROM!, body)
}

export async function sendSMS(toRaw: string, body: string): Promise<NotifyResult> {
  if (!HAS_SMS) return { ok: false, error: 'not_configured' }
  const to = toE164(toRaw)
  if (!to) return { ok: false, error: 'Número de telefone inválido.' }
  return send(to, SMS_FROM!, body)
}

/*
─── INSTRUÇÕES DE CONFIGURAÇÃO (Fernando) ──────────────────────────────────

1. Criar conta em https://www.twilio.com/try-twilio (grátis para começar,
   depois é pré-pago — carregas saldo, gastas por mensagem, sem mensalidade).

2. Comprar um número de telefone Twilio (~1-2 USD/mês) — Console → Phone
   Numbers → Buy a number. Serve para SMS já no dia 1.

3. Ativar o WhatsApp Sandbox/Sender — Console → Messaging → Try it out →
   Send a WhatsApp message. Para produção a sério (não sandbox), tens de
   verificar o teu negócio na Meta Business Suite e pedir aprovação de pelo
   menos 1 "template message" (ex: "Aviso do {{1}}: {{2}}") — isto demora
   1-2 dias úteis a aprovar da primeira vez. Até lá, usa SMS.

4. Copiar do Console (Account → API keys & tokens):
   - Account SID  → variável TWILIO_ACCOUNT_SID
   - Auth Token   → variável TWILIO_AUTH_TOKEN
   - O número que compraste → variável TWILIO_SMS_FROM (formato +351...)
   - O número do WhatsApp Sender (quando aprovado) → TWILIO_WHATSAPP_FROM
     (formato 'whatsapp:+351...')

5. Adicionar estas 4 variáveis no Vercel: Project → Settings → Environment
   Variables → cola cada uma, aplica a Production. Volta a fazer deploy
   (ou espera pelo próximo deploy automático) para as variáveis ficarem
   ativas — o código já está pronto, só precisa delas para ligar.

Nada disto tem de ser feito de uma vez — SMS sozinho (passos 1, 2, 4 sem
TWILIO_WHATSAPP_FROM) já dá alertas reais à família amanhã. O WhatsApp
soma-se depois, sem tocar em código nenhum outra vez.
*/
