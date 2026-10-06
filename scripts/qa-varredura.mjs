// scripts/qa-varredura.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Abre TODAS as páginas institucionais e vê se alguma rebenta.
//
// ── PORQUE E QUE ISTO E A REDE MAIS LARGA QUE EXISTE ────────────────────────
// O `tsc` não apanha erros de execução. Nesta sessão, um `useMemo` que usava
// uma função declarada mais abaixo (zona morta temporal) deitou a ronda
// inteira abaixo — e o `tsc` passou. Só o browser mostrou.
//
// Um ecrã em branco é o pior defeito que existe: quem está a trabalhar não
// tem nada a que se agarrar, e não há erro nenhum a dizer-lhe porquê.
//
// ── O QUE SE MEDE ───────────────────────────────────────────────────────────
//   • páginas que rebentam (o `pageerror` do browser)
//   • páginas que mostram o ecrã de erro do Next
//   • erros de consola que não sejam de uma migração por correr
//   • scroll horizontal do corpo, que a 390px é sempre um defeito
//   • texto técnico à vista do cliente
//
//   node scripts/qa-varredura.mjs           (desktop + telemóvel)
//   node scripts/qa-varredura.mjs --rapido  (só telemóvel)
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'

const BASE = process.env.QA_BASE || 'http://localhost:3311'
const RAPIDO = process.argv.includes('--rapido')

// As páginas institucionais, pela ordem por que a equipa lhes chega.
const PAGINAS = [
  '/painel', '/o-dia', '/passagem', '/casa', '/patients', '/mar', '/care-log', '/incidents',
  '/family', '/radar', '/equipa', '/painel-dono', '/estatisticas',
  '/inscricoes', '/calendario-do-ano', '/documentos', '/ronda-guiada',
  '/activities', '/assessments', '/feridas', '/agenda', '/stock',
  '/refeicoes', '/apoio-servicos', '/tendencias', '/guardiao', '/carga',
  '/autonomia', '/preparacao-medicacao', '/apoio-psicossocial', '/historico',
  '/faturacao', '/interactions', '/calculos', '/vigia', '/migrar',
  '/inqueritos',
]

// Ruído que NÃO é defeito: tabelas de migrações que o Fernando ainda não
// correu. Filtrar isto é o que faz a varredura ser legível.
const ESPERADO = /candidaturas|criterios_entrada|calendario_marcas|modelos_documentos|documentos_emitidos|servicos_|etiquetas|stock_utente|PGRST205|Failed to load resource/i

const browser = await chromium.launch()
const problemas = []
try {
  for (const [nome, viewport] of (RAPIDO
    ? [['telemóvel', { width: 390, height: 844 }]]
    : [['desktop', { width: 1366, height: 900 }], ['telemóvel', { width: 390, height: 844 }]])) {
    const ctx = await browser.newContext({ viewport })
    const p = await ctx.newPage()

    await p.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
    await p.fill('input[type="email"]', process.env.QA_EMAIL || 'qa1781881827891@phloxqa.pt')
    await p.fill('input[type="password"]', process.env.QA_PASSWORD || 'QaPhlox2026!')
    await p.click('button[type="submit"]')
    await p.waitForTimeout(6000)

    console.log(`\n════════ ${nome} ════════`)
    for (const rota of PAGINAS) {
      const rebentou = []
      const consola = []
      const onErr = e => rebentou.push(String(e).split('\n')[0].slice(0, 160))
      const onCon = m => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)) }
      p.on('pageerror', onErr)
      p.on('console', onCon)

      try {
        await p.goto(BASE + rota, { waitUntil: 'domcontentloaded', timeout: 30000 })
        // Esperar por CONTEÚDO, e não por tempo.
        //
        // A primeira versão esperava 6,5 segundos fixos e acusou a
        // /assessments de estar vazia. A página estava bem: era o servidor de
        // desenvolvimento a compilar a rota. Uma QA que mente uma vez deixa de
        // valer, porque a partir daí ninguém sabe se o vermelho é verdadeiro.
        await p.waitForFunction(
          () => (document.body?.innerText || '').trim().length > 250,
          null, { timeout: 25000 },
        ).catch(() => {})
        await p.waitForTimeout(2500)
      } catch (e) {
        rebentou.push(`não carregou: ${String(e).split('\n')[0].slice(0, 90)}`)
      }

      const texto = await p.locator('body').innerText().catch(() => '')
      const ecraDeErro = /Algo correu mal|Erro inesperado|Application error|Unhandled Runtime/i.test(texto)
      const vazia = texto.trim().length < 40
      const lateral = await p.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1).catch(() => false)
      const tecnico = /relation ".*" does not exist|column .* does not exist|schema cache|PGRST\d|TypeError|undefined is not/i.test(texto)
      const consolaReal = consola.filter(x => !ESPERADO.test(x))

      p.off('pageerror', onErr)
      p.off('console', onCon)

      const mal = []
      if (rebentou.length) mal.push(`REBENTOU: ${rebentou[0]}`)
      if (ecraDeErro) mal.push('ecrã de erro')
      if (vazia) mal.push('página vazia')
      if (lateral) mal.push('scroll horizontal')
      if (tecnico) mal.push('texto técnico à vista')
      if (consolaReal.length) mal.push(`consola: ${consolaReal[0]}`)

      if (mal.length) {
        problemas.push({ nome, rota, mal })
        console.log(`✗ ${rota.padEnd(26)} ${mal.join(' · ')}`)
      } else {
        console.log(`  ${rota.padEnd(26)} ok`)
      }
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log(`\n${PAGINAS.length} página(s) × ${RAPIDO ? 1 : 2} tamanho(s).`)
if (!problemas.length) {
  console.log('✓ Nenhuma rebentou, nenhuma ficou vazia, nenhuma anda de lado.')
  process.exit(0)
}
console.log(`\n✗ ${problemas.length} problema(s):`)
for (const x of problemas) console.log(`  ${x.nome} ${x.rota} — ${x.mal.join(' · ')}`)
process.exit(1)
