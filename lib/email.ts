// lib/email.ts
// Envio de emails transacionais via Resend (REST API, sem dependências).
//
// Configuração (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY = re_xxx               (obrigatório)
//   EMAIL_FROM      = noreply@phloxclinical.com   (opcional, default abaixo)
//   EMAIL_REPLY_TO  = suporte@phloxclinical.com   (opcional)
//
// O domínio phloxclinical.com tem de estar verificado no Resend (DNS SPF+DKIM).

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const FROM = process.env.EMAIL_FROM || 'Phlox Clinical <noreply@phloxclinical.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'suporte@phloxclinical.com'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  /** texto simples opcional (fallback para clientes sem HTML) */
  text?: string
  replyTo?: string
  from?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

/**
 * Envia um email. Best-effort: nunca lança — devolve { ok:false, error }.
 * Se RESEND_API_KEY não existir, devolve erro claro sem rebentar o request pai.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { ok: false, error: 'RESEND_API_KEY não está definida (Vercel → Environment Variables).' }
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from || FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        reply_to: input.replyTo || REPLY_TO,
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: j?.message || j?.error?.message || `Resend ${res.status}` }
    }
    return { ok: true, id: j?.id }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) }
  }
}

// ─── Template base ──────────────────────────────────────────────────────────
// Editorial, sóbrio, sem gradientes nem ruído. Branco, tipografia, uma cor.
const ACCENT = '#0d6e42'

export function emailLayout(opts: {
  preheader?: string
  heading: string
  body: string       // HTML interior (parágrafos, etc.)
  cta?: { label: string; url: string }
  footnote?: string
}): string {
  const { preheader = '', heading, body, cta, footnote } = opts
  return `<!doctype html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">
        <tr><td style="padding:28px 32px 0">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${ACCENT}">Phlox Clinical</div>
        </td></tr>
        <tr><td style="padding:18px 32px 0">
          <h1 style="margin:0;font-size:22px;line-height:1.25;font-weight:700;color:#18181b">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#3f3f46">
          ${body}
        </td></tr>
        ${cta ? `<tr><td style="padding:24px 32px 0">
          <a href="${cta.url}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:6px">${escapeHtml(cta.label)}</a>
        </td></tr>` : ''}
        <tr><td style="padding:28px 32px 28px">
          <div style="border-top:1px solid #e4e4e7;margin-bottom:14px"></div>
          <div style="font-size:12px;line-height:1.6;color:#a1a1aa">
            ${footnote ? escapeHtml(footnote) + '<br><br>' : ''}
            Recebeste este email porque tens conta no Phlox Clinical.<br>
            Dúvidas? Responde a este email ou escreve para suporte@phloxclinical.com
          </div>
        </td></tr>
      </table>
      <div style="max-width:520px;font-size:11px;color:#a1a1aa;padding:14px 8px;text-align:center">
        Phlox Clinical · Portugal
      </div>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// ─── Emails prontos ───────────────────────────────────────────────────────────

/** Boas-vindas após criar conta. */
export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Bem-vindo ao Phlox Clinical',
    html: emailLayout({
      preheader: 'A tua conta está pronta.',
      heading: `Olá${name ? ', ' + name : ''}.`,
      body: `<p style="margin:0 0 12px">A tua conta Phlox está pronta. Tens acesso às ferramentas essenciais — verificar interações, perceber bulas e análises, e muito mais.</p>
             <p style="margin:0">Quando precisares de mais, o plano Plus desbloqueia todas as ferramentas de estudo e remove os anúncios.</p>`,
      cta: { label: 'Abrir o Phlox', url: 'https://phloxclinical.com/dashboard' },
    }),
  }
}

/** Confirmação de upgrade de plano. */
export function planUpgradedEmail(planName: string): { subject: string; html: string } {
  return {
    subject: `O teu plano ${planName} está ativo`,
    html: emailLayout({
      heading: `Plano ${planName} ativo.`,
      body: `<p style="margin:0 0 12px">O pagamento foi confirmado e o teu plano <strong>${escapeHtml(planName)}</strong> já está ativo. Os anúncios desapareceram e tens os limites e ferramentas do teu plano.</p>
             <p style="margin:0">Podes gerir ou cancelar a subscrição a qualquer momento nas Definições.</p>`,
      cta: { label: 'Ver as Definições', url: 'https://phloxclinical.com/settings' },
      footnote: 'Guarda este email como comprovativo da alteração de plano.',
    }),
  }
}

/** Aviso de pagamento falhado. */
export function paymentFailedEmail(): { subject: string; html: string } {
  return {
    subject: 'Não conseguimos processar o teu pagamento',
    html: emailLayout({
      heading: 'Pagamento não processado.',
      body: `<p style="margin:0 0 12px">Tentámos renovar a tua subscrição mas o pagamento não foi aceite. O teu acesso mantém-se por agora, mas precisas de atualizar o método de pagamento para não perderes o plano.</p>`,
      cta: { label: 'Atualizar pagamento', url: 'https://phloxclinical.com/settings' },
    }),
  }
}
