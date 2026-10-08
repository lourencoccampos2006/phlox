// scripts/fotos-mesa.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Fotografar as páginas já refeitas na linguagem da mesa.
//
// ── DUAS REGRAS QUE JA FORAM APRENDIDAS A MAL ──────────────────────────────
//  1. NUNCA `fullPage`. Uma foto de página inteira esticada esconde exactamente
//     o defeito que se procura: o que fica fora do ecrã. O Fernando apanhou
//     isto com um «QA 17/18 OK» que acompanhava um telemóvel desformatado.
//     Fotografa-se o VIEWPORT, que é o que a pessoa vê.
//  2. ESPERAR QUE A PAGINA ASSENTE, nunca ler num instante escolhido por mim.
//     Ver scripts/qa-esperar.mjs e as seis vezes que me enganei.
//
//   node scripts/fotos-mesa.mjs                  desktop 1366 + telemovel 390
//   node scripts/fotos-mesa.mjs /radar /carga    so estas
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { assentar } from './qa-esperar.mjs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const ONDE = process.env.FOTOS_DIR || path.join(process.cwd(), '.fotos')

/** As páginas já refeitas, pela ordem por que a equipa lhes chega. */
const FEITAS = [
  '/painel', '/o-dia', '/passagem', '/patients', '/mar', '/care-log',
  '/care-log?tab=feridas', '/care-log?tab=atividades',
  '/incidents', '/radar', '/carga', '/equipa', '/historico', '/inqueritos',
  '/casa', '/stock', '/agenda', '/documentos', '/assessments',
  '/documentos?tab=auditoria', '/conformidade', '/consentimentos', '/inscricoes', '/estatisticas', '/painel-dono', '/assessments?tab=planos', '/faturacao', '/guardiao', '/autonomia', '/vigia', '/tendencias',
  '/preparacao-medicacao', '/apoio-psicossocial', '/refeicoes', '/ronda-guiada',
  '/care-plans', '/activities', '/feridas', '/apoio-servicos', '/family', '/migrar', '/interactions', '/calendario-do-ano', '/census',
]

const pedidas = process.argv.slice(2).filter(a => a.startsWith('/'))
const paginas = pedidas.length ? pedidas : FEITAS

fs.mkdirSync(ONDE, { recursive: true })

const browser = await chromium.launch()
try {
  for (const [nome, viewport] of [
    ['computador', { width: 1366, height: 900 }],
    ['telemovel', { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 })
    const p = await ctx.newPage()

    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
    await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
    await p.click('button[type="submit"]')
    await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {})
    await assentar(p, { timeout: 20000 })

    console.log(`\n════════ ${nome} ${viewport.width}×${viewport.height} ════════`)
    for (const rota of paginas) {
      const erros = []
      const onErr = e => erros.push(String(e).split('\n')[0].slice(0, 140))
      p.on('pageerror', onErr)
      try {
        await p.goto(BASE + rota, { waitUntil: 'domcontentloaded', timeout: 45000 })

        // `assentar` sozinho nao chega: um esqueleto de carregamento e uma
        // ANIMACAO CSS, que nao mexe no DOM — o observador da-o por assente e
        // fotografa-se um ecra cinzento. Ja aconteceu com a /patients.
        // Espera-se primeiro pela moldura da casa (a barra de navegacao
        // institucional), e so depois se deixa o DOM assentar.
        await p.waitForSelector('nav a[href="/painel"], nav a[href="/o-dia"]', { timeout: 30000 }).catch(() => {})
        await p.waitForFunction(() => !document.querySelector('.skeleton'), null, { timeout: 25000 }).catch(() => {})
        // E pelo fim de qualquer «A carregar…»/«A juntar…». O `assentar` ve o
        // DOM quieto, mas uma pagina a espera de uma consulta TAMBEM esta
        // quieta — e fotografa-se o texto de carregamento. Aconteceu com o
        // /painel, que faz cinco leituras antes de desenhar o primeiro numero.
        await p.waitForFunction(
          // Escrever a lista de verbos a mao garante que um dia falta um:
          // faltou «montar», e a /o-dia foi fotografada a dizer «A montar o
          // dia…». Qualquer «A <verbo>…» com reticencias e um texto de espera.
          () => !/A [a-zçãõáéí]+(?:ar|er|ir)…/.test(document.body.innerText || ''),
          null, { timeout: 30000 }).catch(() => {})
        await assentar(p, { timeout: 20000 })

        // Rolagem horizontal do corpo: a 390px é SEMPRE defeito.
        const rolaDeLado = await p.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)

        const ficheiro = path.join(ONDE, `${rota.slice(1).replace(/[/?=]+/g, '-')}-${nome}.png`)
        await p.screenshot({ path: ficheiro })   // VIEWPORT, nunca fullPage
        console.log(
          `  ${rolaDeLado ? '✗ rola de lado' : '✓'}  ${rota.padEnd(14)} ${ficheiro}` +
          (erros.length ? `\n      rebentou: ${erros[0]}` : ''))
      } catch (e) {
        console.log(`  ✗ ${rota} — ${String(e).split('\n')[0].slice(0, 120)}`)
      } finally {
        p.off('pageerror', onErr)
      }
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(`\nAs fotos estão em ${ONDE}`)
