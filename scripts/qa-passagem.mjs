// scripts/qa-passagem.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A passagem de turno está de pé?
//
// ── O QUE SE PODE MEDIR AGORA, E O QUE NÃO ─────────────────────────────────
// O sprint171 ainda não correu. Isso quer dizer que a `passagem_leituras` não
// existe e que a `handovers` ainda não tem `autor_nome` nem `fechada_em` — ou
// seja, GRAVAR não vai funcionar, e isso não é um defeito desta página.
//
// O que JÁ se pode medir, e é a maior parte do valor:
//   1. A página abre, sem rebentar e sem mostrar código do Postgres a ninguém.
//   2. A metade CALCULADA funciona — as ocorrências, as recusas de medicação e
//      o que ficou por fazer entram sozinhas, lidas de tabelas que já existem.
//   3. Está no menu da casa.
//   4. Não transborda ao largo de um telemóvel.
//
// Depois do sprint171, correr com `COMPLETO=1`: aí também se escreve, fecha-se
// a passagem e confirma-se que o recibo de leitura aparece.
//
//   node scripts/qa-passagem.mjs
//   BASE=http://localhost:3311 node scripts/qa-passagem.mjs
//   BASE=... COMPLETO=1 node scripts/qa-passagem.mjs     (depois do sprint171)
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const COMPLETO = !!process.env.COMPLETO
const OUT = 'tmp-qa-passagem'
mkdirSync(OUT, { recursive: true })

const falhas = []
const notas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, locale: 'pt-PT' })
  const page = await ctx.newPage()

  const erros = []
  page.on('pageerror', e => erros.push(String(e.message || e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 })

  // ── 1. Está alcançável? ──────────────────────────────────────────────────
  // NÃO se mede aqui, e é deliberado.
  //
  // Num lar a passagem está na barra lateral; num centro de dia está numa pasta
  // do painel, e as pastas só põem as ligações no DOM depois de abertas. Um
  // teste que conte `a[href="/passagem"]` dá zero num centro de dia e parece
  // uma avaria — quando é uma decisão de produto (eles não trabalham por
  // turnos).
  //
  // Quem garante que a ferramenta é alcançável no seu modo são as guardas
  // estáticas, que leem o blueprint em vez de adivinhar pelo ecrã:
  //     node scripts/check-nav.mjs
  //     node scripts/check-escondidas.mjs
  // Duplicá-lo aqui era ter duas respostas para a mesma pergunta, e a pior das
  // duas a falhar primeiro.

  // ── 2. Abre? ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/passagem`, { waitUntil: 'domcontentloaded' })

  // Espera por um FIM: ou a página montou, ou disse que não consegue. Nunca
  // por um número de segundos — ver a nota em scripts/qa-o-dia-horas.mjs.
  //
  // ── E COMPARA SEM OLHAR A MAIÚSCULAS ───────────────────────────────────
  // «Para o turno da manhã» está escrito assim no código, mas o cabeçalho tem
  // `text-transform: uppercase` — e o `innerText` devolve o que se VÊ, que é
  // «PARA O TURNO DA MANHÃ». Uma comparação sensível a maiúsculas nunca casa.
  //
  // Esta foi a TERCEIRA vez que me enganei nisto, e das três o teste disse que
  // a página estava partida quando não estava — uma delas quase me fez ir
  // corrigir código que não tinha defeito nenhum. Daqui para a frente, todo o
  // texto que venha do ecrã passa por aqui em minúsculas.
  const noEcra = () => page.evaluate(() => document.body.innerText.toLowerCase())

  // E espera-se por um estado FINAL, nao pelo cabecalho. «Para o turno da
  // manha» e um titulo de seccao: aparece no primeiro render, antes de a
  // montagem do turno ter chegado. Esperar por ele era esperar por nada — e o
  // teste lia a pagina a meio e contava zero entradas.
  //
  // Os estados finais sao tres: montou e ha coisas, montou e nao ha nada, ou
  // falta configurar.
  await page.waitForFunction(() => {
    const t = document.body.innerText.toLowerCase()
    return t.includes('entra sozinho')
      || t.includes('nada registado neste turno')
      || t.includes('ainda não está montada')
  }, { timeout: 40000 }).catch(() => {})

  const texto = await noEcra()
  const montou = texto.includes('para o turno da')
  const porMontar = texto.includes('ainda não está montada')

  diz(montou || porMontar, montou
    ? 'a página montou'
    : porMontar ? 'a página diz, em português, que falta configurar' : 'a página não chegou a dizer nada')

  // ── 3. Nenhum erro técnico à vista ───────────────────────────────────────
  // A regra de sempre: ninguém vê código do Postgres. Um «relation does not
  // exist» no ecrã é uma casa a telefonar a dizer que o Phlox avariou.
  const tecnico = /relation .* does not exist|pgrst\d|column .* does not exist|\bundefined\b|\[object object\]/.exec(texto)
  diz(!tecnico, tecnico ? `TEXTO TÉCNICO NO ECRÃ: «${tecnico[0]}»` : 'nenhum texto técnico à vista')

  if (montou) {
    // ── 4. A metade calculada ──────────────────────────────────────────────
    const temCalculado = texto.includes('entra sozinho') || texto.includes('nada registado neste turno')
    diz(temCalculado, temCalculado
      ? 'a secção do que entra sozinho está lá'
      : 'não encontrei a secção do que entra sozinho')

    // Conta as entradas calculadas. Zero é legítimo (turno sem nada), mas
    // diz-se, para não passar por sucesso o que é só um turno vazio.
    // Conta-se DEPOIS de a propria linha existir no DOM. Sem esta espera o
    // numero oscilava entre 0 e 12 na mesma pagina: a contagem apanhava a
    // janela de um re-render e dizia que nao havia nada.
    const linhas = page.locator('a[href="/incidents"], a[href="/mar"], a[href="/o-dia"]')
      .filter({ hasText: /·/ })
    await linhas.first().waitFor({ timeout: 8000 }).catch(() => {})
    const entradas = await linhas.count()
    if (entradas === 0) {
      notas.push('o turno não tem nada registado, por isso a montagem automática não foi exercitada. '
        + 'Regista uma ocorrência em /incidents e volta a correr.')
    } else {
      diz(true, `entradas montadas sozinhas: ${entradas}`)
    }

    // ── 5. A caixa de escrita ──────────────────────────────────────────────
    const caixas = await page.locator('textarea').count()
    diz(caixas > 0, `caixas de texto para escrever a passagem: ${caixas}`)

    const botao = await page.getByRole('button', { name: /Entregar ao turno seguinte/ }).count()
    diz(botao > 0, `botão de entregar: ${botao}`)

    if (COMPLETO) {
      // ── 6. Escrever e entregar (só depois do sprint171) ──────────────────
      await page.locator('textarea').first().fill('Nota de teste da QA.')
      await page.getByRole('button', { name: /Entregar ao turno seguinte/ }).click()
      await page.waitForTimeout(2500)
      const depois = await noEcra()
      diz(depois.includes('entregue'), depois.includes('entregue')
        ? 'a passagem foi entregue'
        : 'a passagem NÃO ficou entregue depois de carregar no botão')
    } else {
      notas.push('a gravação não foi testada: o sprint171 ainda não correu. '
        + 'Depois de o correr: COMPLETO=1 node scripts/qa-passagem.mjs')
    }
  }

  await page.screenshot({ path: `${OUT}/passagem.png` })

  // ── 7. Telemóvel ─────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px`)
  await page.screenshot({ path: `${OUT}/telemovel.png` })

  diz(erros.length === 0, erros.length ? `erros de JavaScript: ${erros.join(' | ')}` : 'sem erros de JavaScript')
} finally {
  await browser.close()
}

console.log('')
for (const n of notas) console.log(`· ${n}`)
console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ A passagem de turno está de pé.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
