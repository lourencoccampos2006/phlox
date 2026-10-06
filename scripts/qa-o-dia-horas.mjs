// scripts/qa-o-dia-horas.mjs
// ─────────────────────────────────────────────────────────────────────────────
// A linha do tempo do /o-dia funciona mesmo?
//
// ── O QUE ISTO MEDE, E PORQUE ──────────────────────────────────────────────
// «No /o-dia as coisas aparecem de forma estranha, não há horas, não há ordem,
// apenas tarefas.»
//
// Cada uma das três queixas tem aqui uma pergunta que se responde com um
// número, e não com uma opinião minha a olhar para um screenshot:
//
//   1. HÁ TAREFAS?          Conta as linhas. Zero é a avaria antiga (a corrida
//                           das permissões) e tem de ficar fechada.
//   2. HÁ HORAS?            Conta os cabeçalhos de hora no formato `HH:MM`.
//   3. HÁ ORDEM?            Lê as horas pela ordem em que aparecem no ecrã e
//                           confirma que sobem. Uma lista «por hora» com as
//                           horas desordenadas é pior do que não ter horas.
//   4. A LINHA DE «AGORA»   Aparece, e está entre a última hora que já passou
//      ESTÁ NO SÍTIO?       e a primeira que ainda não chegou.
//
// ── PORQUE É QUE AS TRÊS VISTAS SÃO TODAS ABERTAS ──────────────────────────
// A vista nova é a que arranca. Se ela rebentar as outras duas, ninguém dá por
// isso até um turno inteiro ficar sem conseguir trabalhar — as outras duas é
// que são as que a equipa já usa.
//
// Não usa `fullPage`: um screenshot de página inteira estica o viewport e
// esconde exactamente os defeitos de telemóvel que interessam.
//
//   node scripts/qa-o-dia-horas.mjs
//   BASE=http://localhost:3311 node scripts/qa-o-dia-horas.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt'
const PASS = process.env.QA_PASSWORD || 'QaPhlox2026!'
const OUT = 'tmp-qa-o-dia-horas'
mkdirSync(OUT, { recursive: true })

const falhas = []
const notas = []
const diz = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) falhas.push(msg) }

/** `HH:MM` → minutos. Devolve null ao que não for uma hora. */
const min = h => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(h).trim())
  return m ? +m[1] * 60 + +m[2] : null
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-PT' })
  const page = await ctx.newPage()

  const errosDaConsola = []
  page.on('pageerror', e => errosDaConsola.push(String(e.message || e)))

  // ── Entrar ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 })

  await page.goto(`${BASE}/o-dia`, { waitUntil: 'domcontentloaded' })

  // Espera pelo CONTEÚDO, e não por um número de segundos: um `waitForTimeout`
  // passa num computador rápido e falha no do Fernando, ou ao contrário — e aí
  // o resultado do teste diz mais sobre a máquina do que sobre o código.
  //
  // Esperar que o texto «A carregar…» DESAPAREÇA não serve, e a primeira
  // versão disto caiu nessa: antes de o React hidratar não há texto nenhum na
  // página, a condição dá-se por cumprida no primeiro instante e conta zero
  // tarefas. Dizia que a vista estava partida quando o que estava errado era
  // o teste — e quase me fez ir corrigir código que não tinha nada.
  //
  // Espera-se por um FIM: ou há tarefas, ou a página diz que não há nada.
  //
  // E espera-se com `waitForSelector`, e não com `waitForFunction`. A segunda
  // rebenta com «Execution context was destroyed» quando a página navega a
  // meio — o que acontece aqui, porque o arranque da aplicação ainda mexe no
  // endereço. O `.catch()` engolia esse erro e o teste contava zero tarefas,
  // acusando a página de um defeito que era meu. A primeira sobrevive a
  // navegações porque volta a tentar do outro lado.
  await page.waitForSelector(
    'button[aria-label^="Marcar"], button[aria-label^="Desmarcar"]',
    { timeout: 30000 },
  ).catch(async () => {
    const vazio = await page.locator('text=/Nada marcado para|Nada seu neste turno|Ainda não consigo montar/')
      .count().catch(() => 0)
    if (!vazio) notas.push('a página não chegou a mostrar nem tarefas nem «não há nada» em 30s')
  })

  // ── 1. Há tarefas? ────────────────────────────────────────────────────────
  // Os botões de marcar são o que há de mais parecido com «uma tarefa» no ecrã:
  // há exactamente um por linha.
  const tarefas = await page.locator('button[aria-label^="Marcar"], button[aria-label^="Desmarcar"]').count()
  diz(tarefas > 0, `linhas de tarefa no ecrã: ${tarefas}`)

  // ── 2 e 3. Há horas, e por ordem? ────────────────────────────────────────
  // Os cabeçalhos de hora são mono, 17px. Em vez de depender do estilo, lê-se
  // o texto de cada bloco e fica-se com o que TEM a forma de uma hora.
  const cabecalhos = await page.$$eval('section > div > span:first-child',
    els => els.map(e => e.textContent.trim()))
  const horas = cabecalhos.filter(h => /^\d{2}:\d{2}$/.test(h))

  if (horas.length === 0) {
    notas.push(`não há nenhuma hora marcada nos dados (${cabecalhos.length} cabeçalho(s) sem hora). `
      + 'Isso é legítimo — a hora é opcional — mas quer dizer que a ordem não foi testada. '
      + 'Marque a hora de uma toma em /patients/[id] e volte a correr.')
    console.log('· sem horas nos dados: a ordenação não pôde ser medida')
  } else {
    diz(true, `cabeçalhos de hora: ${horas.join(', ')}`)
    const mins = horas.map(min)
    const ordenadas = mins.every((v, i) => i === 0 || v >= mins[i - 1])
    diz(ordenadas, ordenadas
      ? 'as horas sobem pela ordem em que aparecem'
      : `as horas estão DESORDENADAS: ${horas.join(' → ')}`)

    // ── 4. A linha de «agora» ──────────────────────────────────────────────
    const marca = await page.locator('[aria-label^="Agora são"]').count()
    diz(marca === 1, `linha de «agora» no ecrã: ${marca} (esperado 1)`)

    if (marca === 1) {
      // Onde é que ela está, em relação às horas? Lê-se a ordem VISUAL (por
      // posição no ecrã), que é a única que o olho vê.
      const y = el => el.boundingBox().then(b => (b ? b.y : Infinity))
      const yAgora = await y(page.locator('[aria-label^="Agora são"]').first())
      const agora = await page.locator('[aria-label^="Agora são"]').first()
        .getAttribute('aria-label').then(s => min(s.replace(/\D*(\d{2}:\d{2}).*/, '$1')))

      let certo = true
      let porque = ''
      for (let i = 0; i < horas.length; i++) {
        const yh = await y(page.locator('section > div > span:first-child').nth(cabecalhos.indexOf(horas[i])))
        const antesDaLinha = yh < yAgora
        const jaPassou = mins[i] <= agora
        if (antesDaLinha !== jaPassou) {
          certo = false
          porque = `${horas[i]} está ${antesDaLinha ? 'acima' : 'abaixo'} da linha, `
            + `mas ${jaPassou ? 'já passou' : 'ainda não chegou'} (agora ${Math.floor(agora / 60)}:${String(agora % 60).padStart(2, '0')})`
          break
        }
      }
      diz(certo, certo ? 'a linha de «agora» está entre a hora certa' : porque)
    }
  }

  await page.screenshot({ path: `${OUT}/1-por-hora.png` })

  // ── 5. As outras duas vistas continuam a abrir ───────────────────────────
  for (const rotulo of ['Por utente', 'Por residente', 'Por pessoa', 'Por tarefa']) {
    const b = page.getByRole('button', { name: rotulo, exact: true })
    if (await b.count() === 0) continue
    await b.first().click()
    await page.waitForTimeout(400)
    const n = await page.locator('button[aria-label^="Marcar"], button[aria-label^="Desmarcar"]').count()
    diz(n > 0, `vista «${rotulo}»: ${n} linha(s)`)
    await page.screenshot({ path: `${OUT}/vista-${rotulo.replace(/\s/g, '-').toLowerCase()}.png` })
  }

  // ── 6. Telemóvel: nada transborda ────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Por hora', exact: true }).click().catch(() => {})
  await page.waitForTimeout(500)
  const transborda = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)
  diz(transborda <= 1, `transbordo horizontal a 390px: ${transborda}px (tem de ser 0)`)
  await page.screenshot({ path: `${OUT}/2-telemovel.png` })

  // ── 7. Nada rebentou ─────────────────────────────────────────────────────
  diz(errosDaConsola.length === 0,
    errosDaConsola.length ? `erros de JavaScript: ${errosDaConsola.join(' | ')}` : 'sem erros de JavaScript')

} finally {
  await browser.close()
}

console.log('')
for (const n of notas) console.log(`· ${n}`)
console.log(falhas.length ? `\n✗ ${falhas.length} falha(s).` : '\n✓ A linha do tempo está de pé.')
console.log(`Imagens em ${OUT}/`)
process.exit(falhas.length ? 1 : 0)
