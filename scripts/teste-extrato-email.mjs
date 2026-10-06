// scripts/teste-extrato-email.mjs
// ─────────────────────────────────────────────────────────────────────────────
// O email do extrato de conta.
//
// ── O QUE ISTO VERIFICA, E PORQUÊ ──────────────────────────────────────────
// 1. QUE O TEXTO DA CASA NÃO PARTE O EMAIL. As descrições são escritas à mão
//    por quem lança o movimento. Um apóstrofo em «Ben-u-ron p'ra dor» ou um
//    sinal de menor numa nota partem o HTML — e o que chega à família é meio
//    email, ou nenhum.
//
//    É a mesma regra que já existe no resto do produto: tudo o que venha da
//    base de dados passa por `escapeHtml` antes de entrar em HTML de email.
//
// 2. QUE O ASSUNTO NÃO LEVA DINHEIRO. Aparece no ecrã de bloqueio do
//    telemóvel, e quanto uma família deve não é para ser lido por quem estiver
//    ao lado na fila do supermercado.
//
// 3. QUE OS NÚMEROS QUE SE VÊEM SÃO OS QUE FORAM DADOS. Um email de dinheiro
//    com um número a mais ou a menos não se desfaz depois de enviado.
//
//   node --experimental-strip-types --loader ./scripts/loader-ts.mjs scripts/teste-extrato-email.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { extratoEmail } from '../lib/email.ts'

let falhas = 0
const ok = (t, cond, extra = '') => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${t}${extra ? `  — ${extra}` : ''}`)
  if (!cond) falhas++
}

const base = {
  nomeUtente: 'Maria Silva',
  mesPorExtenso: 'outubro de 2026',
  nomeCasa: 'Lar do Sol',
  saldoAnterior: '50,00 €',
  linhas: [
    { data: null, descricao: 'Mensalidade', debito: '800,00 €', credito: null },
    { data: null, descricao: 'Comparticipação', debito: null, credito: '300,00 €' },
    { data: '03/10', descricao: 'Farmácia — Ben-u-ron', debito: '12,40 €', credito: null },
    { data: '08/10', descricao: 'Pagamento — Transferência', debito: null, credito: '400,00 €' },
  ],
  totalDebitos: '812,40 €',
  totalCreditos: '700,00 €',
  saldoFinal: '162,40 €',
  saldoEmPalavras: 'Fica a dever 162,40 €',
}

// ── O escape ────────────────────────────────────────────────────────────────
console.log('\no texto da casa não pode partir o email')
{
  const perigoso = {
    ...base,
    nomeUtente: 'Maria <b>Silva</b> & Costa',
    nomeCasa: "Lar d'Oliveira & Filhos",
    linhas: [
      { data: '01/10', descricao: '<script>alert(1)</script>', debito: '10,00 €', credito: null },
      { data: '02/10', descricao: "Farmácia — Ben-u-ron p'ra dor", debito: '5,00 €', credito: null },
      { data: '03/10', descricao: 'Material < 5 unidades & extras', debito: '3,00 €', credito: null },
    ],
  }
  const { html, subject } = extratoEmail(perigoso)

  ok('o <script> não entra como etiqueta',
    !/<script>/i.test(html), 'entrava e o email virava um vetor')
  ok('mas o texto dele continua lá, escapado',
    html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  ok('o apóstrofo passa a entidade', html.includes('p&#39;ra dor'))
  ok('o & do nome da casa também', html.includes('d&#39;Oliveira &amp; Filhos'))
  ok('o < do material também', html.includes('Material &lt; 5 unidades &amp; extras'))
  ok('o <b> do nome do utente não vira negrito',
    !html.includes('Maria <b>Silva</b>') && html.includes('Maria &lt;b&gt;Silva&lt;/b&gt;'))
  // O ASSUNTO não é HTML: vai como a pessoa se chama. Escapá-lo fazia um
  // apelido como D'Almeida chegar à caixa de entrada como «D&#39;Almeida».
  ok('o assunto NÃO vai escapado — não é HTML',
    subject.includes('Maria <b>Silva</b> & Costa') && !subject.includes('&lt;'), subject)

  // O HTML tem de continuar fechado: tantas aberturas de <table> como fechos.
  const abre = (html.match(/<table/g) || []).length
  const fecha = (html.match(/<\/table>/g) || []).length
  ok('as tabelas ficam todas fechadas', abre === fecha, `${abre} abre, ${fecha} fecha`)
}

// ── O assunto ───────────────────────────────────────────────────────────────
console.log('\no assunto não leva dinheiro')
{
  const { subject } = extratoEmail(base)
  ok('não traz o saldo', !subject.includes('162,40'), subject)
  ok('nem a palavra «dever»', !/dever/i.test(subject))
  ok('mas diz de quem e de quando', subject.includes('Maria Silva') && subject.includes('outubro de 2026'),
    subject)
}

// ── A injeção de cabeçalhos ─────────────────────────────────────────────────
// É DISTO que um assunto precisa de proteção, e não de escape de HTML: uma
// mudança de linha no meio pode fazer o servidor de email ler o resto como um
// cabeçalho novo — um `Bcc:` para onde ninguém quer.
{
  const { subject } = extratoEmail({
    ...base,
    nomeUtente: 'Maria' + String.fromCharCode(13, 10) + 'Bcc: ladrao@exemplo.com',
  })
  ok('uma mudança de linha no nome não passa para o assunto',
    !/[\r\n]/.test(subject), JSON.stringify(subject))
  ok('e o texto sobra numa linha só', subject.includes('Maria Bcc: ladrao@exemplo.com'),
    'não se apaga — fica visível, que é como se percebe que alguém tentou')
}

// ── Os números ──────────────────────────────────────────────────────────────
console.log('\ncada número aparece, e nenhum é inventado')
{
  const { html } = extratoEmail(base)
  for (const n of ['800,00 €', '300,00 €', '12,40 €', '400,00 €', '812,40 €', '700,00 €', '162,40 €', '50,00 €']) {
    ok(`«${n}» está no email`, html.includes(n))
  }
  ok('a frase do saldo também', html.includes('Fica a dever 162,40 €'))
  ok('e o nome da casa aparece', html.includes('Lar do Sol'))
}
{
  // Sem saldo anterior não se desenha a linha: um «Saldo anterior 0,00 €» é
  // uma linha que ocupa espaço e não diz nada.
  const { html } = extratoEmail({ ...base, saldoAnterior: null })
  ok('sem saldo anterior, não há linha de saldo anterior',
    !html.includes('Saldo anterior'))
}
{
  const { html } = extratoEmail({ ...base, nomeCasa: null })
  ok('sem nome de casa, o email sai na mesma', html.length > 500)
  ok('e não diz «null» em lado nenhum', !/\bnull\b/.test(html))
}
{
  // Um extrato só com uma linha tem de sair inteiro.
  const { html } = extratoEmail({
    ...base, saldoAnterior: null,
    linhas: [{ data: '15/10', descricao: 'Cabeleireiro', debito: '8,00 €', credito: null }],
    totalDebitos: '8,00 €', totalCreditos: '0,00 €',
    saldoFinal: '8,00 €', saldoEmPalavras: 'Fica a dever 8,00 €',
  })
  ok('um extrato de uma linha sai inteiro',
    html.includes('Cabeleireiro') && html.includes('Fica a dever 8,00 €'))
}

console.log(falhas
  ? `\n✗ ${falhas} falha(s).`
  : '\n✓ O que a casa escreve não parte o email, e o assunto não diz quanto se deve.')
process.exit(falhas ? 1 : 0)
