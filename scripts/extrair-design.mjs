// Desempacota um design exportado do Claude Design e guarda o que ele produz:
// o HTML renderizado, o CSS todo, e uma imagem. O ficheiro exportado traz o
// conteúdo comprimido em gzip+base64 e só o desempacota com JavaScript, por
// isso não há como o ler sem o abrir num browser.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
import { writeFileSync } from 'fs'
import { join } from 'path'

const [ficheiro, etiqueta, larguraArg] = process.argv.slice(2)
const SAIDA = 'C:/Users/Fernando/AppData/Local/Temp/claude/c--Users-Fernando-phlox/28e84895-7416-407a-b6bb-71a95e1b293f/scratchpad'
const largura = Number(larguraArg || 1440)

const navegador = await chromium.launch()
try {
  const pagina = await navegador.newPage({ viewport: { width: largura, height: 1000 } })
  const problemas = []
  pagina.on('pageerror', e => problemas.push(e.message))

  await pagina.goto(pathToFileURL(ficheiro).href, { waitUntil: 'domcontentloaded' })
  // esperar que o desempacotador acabe e o conteúdo real apareça
  await pagina.waitForFunction(
    () => !document.getElementById('__bundler_loading') ||
          getComputedStyle(document.getElementById('__bundler_loading')).display === 'none',
    { timeout: 30_000 }
  ).catch(() => {})
  await pagina.waitForTimeout(3500)

  const r = await pagina.evaluate(() => {
    const css = [...document.styleSheets].map(s => {
      try { return [...s.cssRules].map(x => x.cssText).join('\n') } catch { return '' }
    }).join('\n\n')
    return {
      html: document.documentElement.outerHTML,
      css,
      altura: document.documentElement.scrollHeight,
      texto: (document.body.innerText || '').slice(0, 4000),
    }
  })

  writeFileSync(join(SAIDA, `${etiqueta}.html`), r.html)
  writeFileSync(join(SAIDA, `${etiqueta}.css`), r.css)
  writeFileSync(join(SAIDA, `${etiqueta}.txt`), r.texto)
  await pagina.setViewportSize({ width: largura, height: Math.min(r.altura, 4000) })
  await pagina.waitForTimeout(600)
  await pagina.screenshot({ path: join(SAIDA, `${etiqueta}.png`) })

  console.log(`${etiqueta}: html ${(r.html.length/1024).toFixed(0)}KB · css ${(r.css.length/1024).toFixed(0)}KB · altura ${r.altura}px`)
  if (problemas.length) console.log('  avisos:', problemas.slice(0, 2))
} finally { await navegador.close() }
