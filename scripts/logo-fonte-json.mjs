#!/usr/bin/env node
// logo-fonte-json.mjs — converte o TTF do logótipo para o formato JSON do
// three.js, com apenas os glifos que a palavra "phlox" usa.
//
// PORQUÊ: o TTFLoader do three.js importa o opentype.js de um CDN
// (cdn.jsdelivr.net). Isso (a) não empacota com o Turbopack, e (b) faria o
// browser de cada utilizador ir buscar código a um terceiro em tempo de
// execução — inaceitável num produto de saúde que aloja tudo na UE.
//
// Convertendo uma vez, o site passa a usar só o FontLoader: sem CDN, sem
// opentype, e com 5 glifos em vez da fonte inteira.
//
// Corre só quando a fonte mudar:  node scripts/logo-fonte-json.mjs

import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFileSync, writeFileSync, statSync } from 'fs'

const TTF = 'lib/phlox-logo/fonts/Lora-Italic.ttf'
const SAIDA = 'lib/phlox-logo/fonts/Lora-Italic.json'
const LETRAS = ['p', 'h', 'l', 'o', 'x']   // ver `chars` em phlox-logotype.js

const ttf = readFileSync(TTF)

const PAGINA = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{
  "three":"https://unpkg.com/three@0.185.0/build/three.module.js",
  "three/addons/loaders/TTFLoader.js":"https://unpkg.com/three@0.185.0/examples/jsm/loaders/TTFLoader.js"
}}</script>
<script type="module">
  import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
  const buf = await (await fetch('/fonte.ttf')).arrayBuffer();
  window.__fonte = new TTFLoader().parse(buf);
</script>`

const servidor = createServer((req, res) => {
  if (req.url === '/fonte.ttf') {
    res.writeHead(200, { 'content-type': 'font/ttf' }).end(ttf)
  } else {
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGINA)
  }
}).listen(0)

const porta = servidor.address().port
const navegador = await chromium.launch()

try {
  const page = await navegador.newPage()
  await page.goto(`http://localhost:${porta}/`)
  await page.waitForFunction(() => window.__fonte, { timeout: 30_000 })
  const fonte = await page.evaluate(() => window.__fonte)

  const todos = Object.keys(fonte.glyphs).length
  const subconjunto = {}
  for (const l of LETRAS) {
    if (!fonte.glyphs[l]) throw new Error(`A fonte não tem o glifo "${l}"`)
    subconjunto[l] = fonte.glyphs[l]
  }
  fonte.glyphs = subconjunto

  writeFileSync(SAIDA, JSON.stringify(fonte))
  const antes = (statSync(TTF).size / 1024).toFixed(0)
  const depois = (statSync(SAIDA).size / 1024).toFixed(1)
  console.log(`✓ ${SAIDA}`)
  console.log(`  ${LETRAS.join('')} de ${todos} glifos · ${antes}KB (TTF) → ${depois}KB (JSON)`)
} finally {
  await navegador.close()
  servidor.close()
}
