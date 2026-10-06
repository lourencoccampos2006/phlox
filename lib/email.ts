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

/** Um link relativo dentro de um email não vai a lado nenhum: o cliente de
 *  correio não tem um "sítio atual" a partir do qual o resolver — o botão
 *  simplesmente não faz nada, ou abre `about:blank`.
 *
 *  Cinco modelos (resumo do dia à família, famílias à espera, o que merece
 *  atenção, stock, convite de equipa) tinham CTAs relativos, e era por isso que
 *  alguns nunca chegaram a ser ligados a nada. Resolve-se AQUI, uma vez, em vez
 *  de em cada modelo — senão volta a acontecer no próximo que se escrever. */
const BASE_EMAIL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://phloxclinical.com').replace(/\/+$/, '')

export function urlAbsoluto(url: string): string {
  if (!url) return BASE_EMAIL
  if (/^https?:\/\//i.test(url) || url.startsWith('mailto:')) return url
  return `${BASE_EMAIL}${url.startsWith('/') ? '' : '/'}${url}`
}

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
          <a href="${urlAbsoluto(cta.url)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:6px">${escapeHtml(cta.label)}</a>
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

/**
 * Texto seguro para o ASSUNTO de um email.
 *
 * ── PORQUE É QUE NÃO É O `escapeHtml` ──────────────────────────────────────
 * Um assunto não é HTML. Passá-lo por `escapeHtml` faz um lar chamado «São
 * José & Filhos» chegar à caixa de entrada como «São José &amp; Filhos», e um
 * apelido como D'Almeida como «D&#39;Almeida». Parece avariado, e para quem
 * recebe é o Phlox que parece avariado.
 *
 * ── E O ESCAPE NÃO PROTEGIA DO QUE IMPORTA ─────────────────────────────────
 * O risco de um assunto é a injeção de cabeçalhos: uma mudança de linha no
 * meio pode fazer o servidor ler o resto como um cabeçalho novo — um `Bcc:`,
 * por exemplo. O `escapeHtml` não toca em `\n`, e esta função é precisamente
 * isso que tira.
 */
function paraAssunto(s: string): string {
  return String(s ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
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

/** Resumo de vigilância do cuidador — só quando há algo novo a precisar de atenção. */
export function caregiverWatchEmail(items: { who: string; title: string; detail: string }[]): { subject: string; html: string } {
  const rows = items.slice(0, 8).map(it =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #f4f4f5">
       <div style="font-size:14px;font-weight:700;color:#18181b">${escapeHtml(it.who)} — ${escapeHtml(it.title)}</div>
       <div style="font-size:13px;color:#52525b;margin-top:2px">${escapeHtml(it.detail)}</div>
     </td></tr>`).join('')
  const n = items.length
  return {
    subject: n === 1
      ? `Phlox — ${escapeHtml(items[0].who)} precisa de atenção`
      : `Phlox — ${n} coisas a precisar de atenção na sua família`,
    html: emailLayout({
      preheader: 'O Phlox detetou algo a precisar da sua atenção.',
      heading: n === 1 ? `${escapeHtml(items[0].who)} precisa de atenção.` : 'A sua família precisa de atenção.',
      body: `<p style="margin:0 0 14px">O Phlox acompanhou os seus familiares e encontrou ${n === 1 ? 'um ponto' : `${n} pontos`} a precisar da sua atenção:</p>
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
             <p style="margin:14px 0 0;font-size:13px;color:#71717a">O Phlox organiza e avisa, mas não substitui o médico. Em emergência, ligue 112.</p>`,
      cta: { label: 'Ver a minha família', url: 'https://phloxclinical.com/familia' },
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

/* ── Emails acrescentados a 2026-09-08 ──────────────────────────────────────
 * O produto tinha quatro emails. Um lar que nos confia o cuidado de trinta
 * pessoas espera saber das coisas por email — não só ao abrir a aplicação.
 * Todos usam o mesmo emailLayout, todos são best-effort (nunca fazem falhar a
 * operação que os originou) e nenhum leva dados clínicos no assunto.
 */

/** A instituição foi criada e esta pessoa é a dona. É o primeiro contacto. */
export function institutionCreatedEmail(nomeCasa: string, tipo: string): { subject: string; html: string } {
  const tipoLabel = tipo === 'day_care' ? 'centro de dia' : 'lar'
  return {
    subject: `O Phlox do ${paraAssunto(nomeCasa)} está pronto`,
    html: emailLayout({
      heading: `Bem-vindo ao Phlox, ${escapeHtml(nomeCasa)}`,
      body: `
        <p>Criámos o Phlox do vosso ${escapeHtml(tipoLabel)}. A partir de agora, entra com este email e
        encontra a casa já montada — o vocabulário, as ferramentas e os relatórios são os
        de um ${escapeHtml(tipoLabel)}, não de um hospital.</p>
        <p><strong>Por onde começar:</strong></p>
        <ol>
          <li>Acrescentar as pessoas que frequentam a casa (dá para importar de uma folha de cálculo).</li>
          <li>Convidar a equipa, em <em>Equipa &rsaquo; Contas e acessos</em>.</li>
          <li>Marcar as presenças de hoje no painel — é o primeiro gesto do dia.</li>
        </ol>
        <p>Não é preciso configurar regras nem alertas: o Phlox começa a avisar sozinho
        mal haja registos para ler.</p>
        <p>Qualquer dúvida, responda a este email. Falamos consigo.</p>`,
      cta: { label: 'Entrar no Phlox', url: '/painel' },
    }),
  }
}

/** Alguém foi convidado para a equipa de uma casa. */
export function teamInviteEmail(nomeCasa: string, quemConvidou: string): { subject: string; html: string } {
  return {
    subject: `${paraAssunto(quemConvidou)} convidou-o para a equipa do ${paraAssunto(nomeCasa)}`,
    html: emailLayout({
      heading: `Faz parte da equipa do ${escapeHtml(nomeCasa)}`,
      body: `
        <p>${escapeHtml(quemConvidou)} deu-lhe acesso ao Phlox do ${escapeHtml(nomeCasa)}.</p>
        <p>Entra com este email e vê o dia da casa: quem chegou, a medicação por dar,
        o que ficou registado e o que merece atenção.</p>`,
      // URL ABSOLUTO. Estava '/painel' — um caminho relativo dentro de um email
      // não vai a lado nenhum, e era por isso que este modelo nunca chegou a
      // ser usado em sítio nenhum. Todos os outros daqui já usavam absoluto.
      cta: { label: 'Entrar', url: 'https://phloxclinical.com/painel' },
    }),
  }
}

/** Resumo do dia para a família (centro de dia). Sem dados clínicos no assunto. */
export function familyDailyEmail(primeiroNome: string, linhas: string[]): { subject: string; html: string } {
  return {
    subject: `Como correu o dia — ${paraAssunto(primeiroNome)}`,
    html: emailLayout({
      heading: `O dia de ${escapeHtml(primeiroNome)}`,
      body: `<p>${linhas.map(escapeHtml).join('</p><p>')}</p>
        <p style="color:#6b7280;font-size:13px">Escrito a partir do que a equipa registou hoje.</p>`,
      cta: { label: 'Ver o diário completo', url: '/familia' },
    }),
  }
}

/**
 * O extrato de conta do mês, para a família.
 *
 * ── PORQUE É QUE ISTO É UMA TABELA E NÃO UM PARÁGRAFO ──────────────────────
 * Porque quem o recebe quer CONFERIR. Um parágrafo a dizer «este mês ficaram
 * 540 €» obriga a telefonar para saber de quê — e era exactamente isso que o
 * Phlox fazia antes, com um número de extras sem itemização nenhuma.
 *
 * ── E É UMA TABELA DE EMAIL, NÃO UMA DE PÁGINA ─────────────────────────────
 * `role="presentation"`, larguras em atributos, estilos em linha e nada de
 * flexbox: o Outlook ignora quase tudo o resto, e um extrato que chegue
 * desalinhado a metade das famílias é pior do que não chegar.
 *
 * ── TUDO O QUE VEM DA BASE DE DADOS PASSA POR `escapeHtml` ─────────────────
 * As descrições são escritas à mão por quem lança («Farmácia — Ben-u-ron»).
 * Sem escape, um apóstrofo parte o HTML e um `<` parte o email todo.
 */
export function extratoEmail(opts: {
  nomeUtente: string
  mesPorExtenso: string
  nomeCasa?: string | null
  saldoAnterior: string | null
  linhas: { data: string | null; descricao: string; debito: string | null; credito: string | null }[]
  totalDebitos: string
  totalCreditos: string
  saldoFinal: string
  saldoEmPalavras: string
}): { subject: string; html: string } {
  const {
    nomeUtente, mesPorExtenso: mes, nomeCasa, saldoAnterior,
    linhas, totalDebitos, totalCreditos, saldoFinal, saldoEmPalavras: frase,
  } = opts

  const celula = 'padding:8px 10px;border-bottom:1px solid #e4e4e7;font-size:14px;color:#3f3f46'
  const numero = `${celula};text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums`

  const corpoDaTabela = linhas.map(l => `
    <tr>
      <td style="${celula};white-space:nowrap;color:#71717a;font-size:12px">${escapeHtml(l.data || '')}</td>
      <td style="${celula}">${escapeHtml(l.descricao)}</td>
      <td style="${numero}">${l.debito ? escapeHtml(l.debito) : ''}</td>
      <td style="${numero};color:#15803d">${l.credito ? escapeHtml(l.credito) : ''}</td>
    </tr>`).join('')

  const linhaAnterior = saldoAnterior ? `
    <tr>
      <td style="${celula}"></td>
      <td style="${celula};color:#71717a">Saldo anterior</td>
      <td style="${numero};color:#71717a">${escapeHtml(saldoAnterior)}</td>
      <td style="${numero}"></td>
    </tr>` : ''

  const body = `
    <p style="margin:0 0 14px">Segue o extrato da conta de <strong>${escapeHtml(nomeUtente)}</strong> em ${escapeHtml(mes)}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
      <tr>
        <th align="left" style="${celula};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;font-weight:700">Data</th>
        <th align="left" style="${celula};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;font-weight:700">Descrição</th>
        <th align="right" style="${celula};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;font-weight:700">Débito</th>
        <th align="right" style="${celula};font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#a1a1aa;font-weight:700">Crédito</th>
      </tr>
      ${linhaAnterior}
      ${corpoDaTabela}
      <tr>
        <td style="${celula};border-bottom:none"></td>
        <td style="${celula};border-bottom:none;font-weight:700;color:#18181b">Totais</td>
        <td style="${numero};border-bottom:none;font-weight:700;color:#18181b">${escapeHtml(totalDebitos)}</td>
        <td style="${numero};border-bottom:none;font-weight:700;color:#15803d">${escapeHtml(totalCreditos)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px">
      <tr>
        <td style="padding:12px 14px;font-size:15px;font-weight:700;color:#18181b">${escapeHtml(frase)}</td>
        <td align="right" style="padding:12px 14px;font-size:17px;font-weight:700;color:#18181b;white-space:nowrap">${escapeHtml(saldoFinal)}</td>
      </tr>
    </table>

    <p style="margin:16px 0 0;color:#6b7280;font-size:13px">
      Se alguma linha não lhe parecer certa, responda a este email${nomeCasa ? ` ou fale com ${escapeHtml(nomeCasa)}` : ''}.
    </p>`

  return {
    // O assunto não leva valores. Aparece no ecrã de bloqueio do telemóvel, e
    // quanto uma família deve não é para ser lido por quem estiver ao lado.
    subject: `Extrato de ${paraAssunto(mes)} — ${paraAssunto(nomeUtente)}`,
    html: emailLayout({
      preheader: `A conta de ${nomeUtente} em ${mes}.`,
      heading: `Extrato de ${mes}`,
      body,
      cta: { label: 'Ver no Phlox', url: '/familia' },
      footnote: nomeCasa ? `Enviado por ${nomeCasa}.` : undefined,
    }),
  }
}

/** Uma família escreveu e ninguém respondeu. */
export function familyWaitingEmail(quantas: number): { subject: string; html: string } {
  return {
    subject: quantas === 1 ? 'Uma família está à espera de resposta' : `${quantas} famílias à espera de resposta`,
    html: emailLayout({
      heading: 'Há famílias à espera',
      body: `<p>${quantas === 1 ? 'Uma família escreveu' : `${quantas} famílias escreveram`} e a última
        mensagem da conversa ainda é delas. Não demora nada a responder — e para quem está do outro
        lado faz muita diferença.</p>`,
      cta: { label: 'Ver as conversas', url: '/family' },
    }),
  }
}

/** O que merece atenção hoje, para quem gere a casa. */
export function attentionDigestEmail(nomeCasa: string, itens: { quem: string; porque: string }[]): { subject: string; html: string } {
  return {
    subject: `${itens.length} ${itens.length === 1 ? 'pessoa merece' : 'pessoas merecem'} atenção hoje — ${paraAssunto(nomeCasa)}`,
    html: emailLayout({
      heading: 'O que merece atenção hoje',
      body: `<ul>${itens.slice(0, 10).map(i =>
        `<li><strong>${escapeHtml(i.quem)}</strong> — ${escapeHtml(i.porque)}</li>`).join('')}</ul>
        <p style="color:#6b7280;font-size:13px">Sai do que a equipa registou. Não é um
        diagnóstico — a avaliação é sempre de quem cuida.</p>`,
      cta: { label: 'Abrir o que merece atenção', url: '/radar' },
    }),
  }
}

/** Stock abaixo do mínimo. */
export function stockLowEmail(itens: { nome: string; quantidade: string }[]): { subject: string; html: string } {
  return {
    subject: `${itens.length} ${itens.length === 1 ? 'artigo' : 'artigos'} a precisar de encomenda`,
    html: emailLayout({
      heading: 'Stock a acabar',
      body: `<ul>${itens.slice(0, 15).map(i => `<li><strong>${escapeHtml(i.nome)}</strong> — ${escapeHtml(i.quantidade)}</li>`).join('')}</ul>`,
      cta: { label: 'Ver o stock', url: '/stock' },
    }),
  }
}
