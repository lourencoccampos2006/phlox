#!/usr/bin/env node
// logo-flor-escura.mjs — a variante da flor para fundos claros.
//
// PORQUÊ: a flor renderizada do logótipo 3D é rosa muito pálido, porque foi
// desenhada para viver sobre o verde da marca. Sobre branco desaparece —
// experimentar public/flor.png num fundo branco mostra isso em dois segundos.
//
// COMO: não é escurecer tudo por igual, que achataria a flor num borrão. O que
// interessa preservar é a FORMA, e a forma está nas diferenças de luminosidade
// entre as pétalas — que no original vivem todas espremidas entre 0.82 e 1.0.
// Aqui essa gama estreita é reesticada para 0.30–0.72, mantendo as diferenças
// relativas intactas. A flor fica escura o suficiente para se ler em branco e
// continua a ter volume.
//
// A cor também roda um pouco para o vinho, senão o rosa escurecido lê-se como
// cinzento sujo.
//
// Correr:  node scripts/logo-flor-escura.mjs

import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { chromium } from 'playwright'

const RAIZ = process.cwd()
const FLOR = readFileSync(join(RAIZ, 'public', 'flor.png')).toString('base64')

const PAGINA = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>
window.escurecer = (lado) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = c.height = lado
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0, lado, lado)

    const dados = x.getImageData(0, 0, lado, lado)
    const p = dados.data

    // 1ª passagem: onde é que a luminosidade da flor vive mesmo?
    // Fazer a conta em vez de assumir — o intervalo real do ficheiro é o que
    // determina se o reesticamento resulta ou achata tudo.
    let min = 1, max = 0
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 24) continue                       // fundo transparente
      const l = (0.2126 * p[i] + 0.7152 * p[i+1] + 0.0722 * p[i+2]) / 255
      if (l < min) min = l
      if (l > max) max = l
    }
    const gama = Math.max(max - min, 0.001)

    // 2ª passagem: reesticar para a gama escura, com um desvio para o vinho.
    const DESTINO_MIN = 0.30, DESTINO_MAX = 0.72
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 24) continue
      const l = (0.2126 * p[i] + 0.7152 * p[i+1] + 0.0722 * p[i+2]) / 255
      const t = (l - min) / gama                         // 0..1 dentro da flor
      const alvo = DESTINO_MIN + t * (DESTINO_MAX - DESTINO_MIN)
      const f = alvo / Math.max(l, 0.001)
      p[i]     = Math.min(255, p[i]     * f * 1.06)      // vermelho a mais
      p[i + 1] = Math.min(255, p[i + 1] * f * 0.88)      // verde a menos
      p[i + 2] = Math.min(255, p[i + 2] * f * 0.96)
    }

    x.putImageData(dados, 0, 0)
    resolve({ url: c.toDataURL('image/png'), min: +min.toFixed(3), max: +max.toFixed(3) })
  }
  img.src = 'data:image/png;base64,${FLOR}'
})
</script></body>`

const servidor = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(PAGINA)
}).listen(0)

const navegador = await chromium.launch()

try {
  const pagina = await navegador.newPage()
  await pagina.goto(`http://localhost:${servidor.address().port}/`)

  for (const [lado, nome] of [[1024, 'flor-escura.png'], [64, 'flor-escura-64.png']]) {
    const r = await pagina.evaluate((l) => window.escurecer(l), lado)
    const bytes = Buffer.from(r.url.split(',')[1], 'base64')
    writeFileSync(join(RAIZ, 'public', nome), bytes)
    console.log(`  public/${nome}  ${(bytes.length / 1024).toFixed(1)}KB   (original: ${r.min}–${r.max})`)
  }
} finally {
  await navegador.close()
  servidor.close()
}
