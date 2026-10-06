// scripts/qa-esperar.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Esperar que a página ASSENTE, antes de ler seja o que for.
//
// ── PORQUE E QUE ISTO EXISTE ────────────────────────────────────────────────
// Em outubro de 2026 enganei-me SEIS vezes seguidas da mesma maneira, e das
// seis o teste acusou a aplicacao de um defeito que era meu:
//
//   • esperei que «A carregar…» DESAPARECESSE — e antes de o React hidratar
//     nao ha texto nenhum, por isso a condicao cumpre-se no primeiro instante,
//     com o ecra vazio;
//   • esperei por «Para o turno da manha», que e um cabecalho e aparece no
//     primeiro render, antes de haver dados;
//   • esperei por «Crie a sua instituicao», que e TAMBEM o estado de
//     carregamento;
//   • li aos 250 ms e vi «So o dono ou administrador», que desaparece aos 500;
//   • contei cartoes de equipa antes de a lista chegar, e conclui que a pagina
//     estava partida — escrevi isso ao Fernando, e era mentira;
//   • comparei texto com `text-transform: uppercase` sem baixar as maiusculas.
//
// A raiz e sempre a mesma: **ler num instante escolhido por mim, em vez de
// esperar que a pagina pare de mudar.**
//
// ── O QUE ISTO FAZ ──────────────────────────────────────────────────────────
// `assentar(page)` observa o DOM e so devolve quando ele estiver quieto. Nao
// depende de nenhuma frase, nao depende de nenhum seletor, e nao se engana com
// um cabecalho que aparece cedo.
//
// `textoDe(page)` devolve o texto JA em minusculas, para a comparacao nunca
// tropecar no `text-transform`.
//
//   import { assentar, textoDe, esperarPor } from './qa-esperar.mjs'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Espera que o DOM pare de mudar.
 *
 * @param quieto   Quantos ms sem mutacoes nenhumas para dar por assente.
 *                 250 chega: um `setState` do React mexe no DOM em poucos ms,
 *                 e uma consulta ao Supabase demora muito mais do que isso.
 * @param timeout  Quanto tempo no maximo. Ao fim disto devolve na mesma — uma
 *                 pagina com um relogio a tiquetaquear nunca fica quieta, e
 *                 rebentar o teste por causa disso seria pior.
 */
export async function assentar(page, { quieto = 250, timeout = 20000 } = {}) {
  const assentou = await page.evaluate(
    ({ quieto, timeout }) => new Promise(resolve => {
      let temporizador
      const fim = setTimeout(() => { obs.disconnect(); clearTimeout(temporizador); resolve(false) }, timeout)
      const pronto = () => { clearTimeout(fim); obs.disconnect(); resolve(true) }
      const reiniciar = () => { clearTimeout(temporizador); temporizador = setTimeout(pronto, quieto) }
      const obs = new MutationObserver(reiniciar)
      obs.observe(document.body, { childList: true, subtree: true, characterData: true })
      reiniciar()
    }),
    { quieto, timeout },
  ).catch(() => false)
  return assentou
}

/**
 * O texto da pagina, SEMPRE em minusculas.
 *
 * O `innerText` devolve o que se VE, e isso inclui o `text-transform:
 * uppercase` dos cabecalhos. Comparar «Para o turno da manha» contra
 * «PARA O TURNO DA MANHA» nunca casa — enganei-me nisto tres vezes.
 */
export async function textoDe(page) {
  return (await page.evaluate(() => document.body.innerText)).toLowerCase()
}

/**
 * Espera pela PRESENCA de uma de varias frases, e so depois assenta.
 *
 * As frases vao em minusculas e sao comparadas contra o texto em minusculas.
 *
 * ── NAO ACEITA CONDICOES DE AUSENCIA, E E DE PROPOSITO ─────────────────────
 * Nao ha aqui nenhuma forma de dizer «espera que X desapareca». Toda a vez que
 * precisei disso, o que eu queria mesmo era esperar por um estado FINAL — e a
 * condicao de ausencia cumpria-se com o ecra ainda vazio.
 */
export async function esperarPor(page, frases, { timeout = 40000 } = {}) {
  const lista = (Array.isArray(frases) ? frases : [frases]).map(f => f.toLowerCase())
  await page.waitForFunction(
    fs => {
      const t = document.body.innerText.toLowerCase()
      return fs.some(f => t.includes(f))
    },
    lista, { timeout },
  ).catch(() => {})
  await assentar(page)
  return textoDe(page)
}

/**
 * Entra na conta de QA e espera que a aplicacao esteja mesmo de pe.
 *
 * Devolve `true` se a sessao pegou. Sem isto, uma passagem em que o login
 * falhou mede uma pagina deslogada e culpa o codigo — ja aconteceu.
 */
export async function entrar(page, base, {
  email = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt',
  pass = process.env.QA_PASSWORD || 'QaPhlox2026!',
} = {}) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {})

  // A prova de que a sessao pegou: a barra lateral institucional so aparece a
  // quem esta autenticado e em modo clinico.
  await page.goto(`${base}/o-dia`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('a[href="/patients"]', { timeout: 30000 }).catch(() => {})
  return (await page.locator('a[href="/patients"]').count()) > 0
}
