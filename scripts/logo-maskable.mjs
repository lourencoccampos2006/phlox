#!/usr/bin/env node
// logo-maskable.mjs — gera as variantes "maskable" do ícone.
//
// PORQUÊ UM FICHEIRO SÓ PARA ISTO: o Android não mostra o ícone como ele é.
// Recorta-o com uma máscara que muda de fabricante para fabricante (círculo na
// Google, squircle na Samsung, gota noutros). A especificação garante apenas
// que o CÍRCULO CENTRAL COM 80% DO LADO sobrevive — tudo o que estiver fora
// pode ser cortado.
//
// O ícone normal tem a flor a 78% do lado. A largura bate certo com os 80%,
// mas os CANTOS do quadrado da flor ficam fora do círculo, e são precisamente
// aí que estão as pontas das pétalas. Resultado: um telemóvel Android mostrava
// a flor com as pétalas cortadas.
//
// Aqui a flor fica a 55%, bem dentro da zona segura, e o verde da marca ocupa
// o resto — que é exatamente o que a máscara deve comer.
//
// Não re-renderiza o 3D: parte do public/flor.png já gerado pelo logo-2d.mjs.
// Correr:  node scripts/logo-maskable.mjs

import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { chromium } from 'playwright'

const RAIZ = process.cwd()
const FLOR = readFileSync(join(RAIZ, 'public', 'flor.png')).toString('base64')

// A flor a 55% do lado: o seu canto mais distante fica a 55%*√2/2 ≈ 39% do
// centro, logo dentro do raio seguro de 40%. Confirmado com a conta, não a olho.
const OCUPACAO = 0.55

const PAGINA = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>
window.compor = (lado) => new Promise((resolve) => {
  const c = document.createElement('canvas')
  c.width = c.height = lado
  const x = c.getContext('2d')

  // O mesmo verde do ícone normal, para os dois se parecerem um com o outro.
  const g = x.createLinearGradient(0, 0, lado, lado)
  g.addColorStop(0, '#128a52')
  g.addColorStop(1, '#0b5c37')
  x.fillStyle = g
  x.fillRect(0, 0, lado, lado)

  const img = new Image()
  img.onload = () => {
    const d = lado * ${OCUPACAO}
    x.drawImage(img, (lado - d) / 2, (lado - d) / 2, d, d)
    resolve(c.toDataURL('image/png'))
  }
  img.src = 'data:image/png;base64,${FLOR}'
})
</script></body>`

const servidor = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(PAGINA)
}).listen(0)

const porta = servidor.address().port
const navegador = await chromium.launch()

try {
  const pagina = await navegador.newPage()
  await pagina.goto(`http://localhost:${porta}/`)

  for (const lado of [512, 192]) {
    const dataUrl = await pagina.evaluate((l) => window.compor(l), lado)
    const destino = join(RAIZ, 'public', 'icons', `maskable-${lado}.png`)
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(destino, bytes)
    console.log(`  public/icons/maskable-${lado}.png  ${(bytes.length / 1024).toFixed(1)}KB`)
  }
} finally {
  await navegador.close()
  servidor.close()
}

console.log('\nFeito. Declara-os no app/manifest.ts com purpose: "maskable".')
