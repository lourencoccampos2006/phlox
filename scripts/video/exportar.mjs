#!/usr/bin/env node
// exportar.mjs — transforma a peça animada num ficheiro de vídeo.
//
// NÃO É GRAVAR O ECRÃ. Percorre a linha de tempo instante a instante, manda o
// browser desenhar cada fotograma exato, e guarda-o. Depois o ffmpeg junta-os.
//
// A diferença prática: uma gravação de ecrã fica refém do que a máquina
// aguentar no momento — perde fotogramas, treme, e o resultado muda de vez para
// vez. Aqui cada fotograma é renderizado sem pressa e o vídeo sai idêntico
// sempre, com o número de imagens por segundo que se pedir. É assim que se
// exporta de uma ferramenta de motion design.
//
// Precisa do ffmpeg no PATH.
//
//   node scripts/video/exportar.mjs
//   node scripts/video/exportar.mjs --fps 60 --saida C:/temp/phlox.mp4

import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { tmpdir } from 'os'

const arg = (nome, omissao) => {
  const i = process.argv.indexOf(`--${nome}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : omissao
}

const FPS = Number(arg('fps', 30))
const SAIDA = resolve(arg('saida', join(process.cwd(), 'scripts', 'video', 'phlox-demo.mp4')))
const PAGINA = pathToFileURL(join(process.cwd(), 'scripts', 'video', 'phlox-demo.html')).href

// ffmpeg primeiro: mais vale falhar agora do que depois de 25 minutos a
// renderizar mil e quinhentas imagens.
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
} catch {
  console.error('Falta o ffmpeg no PATH. Instalar com:  winget install Gyan.FFmpeg')
  process.exit(1)
}

const pasta = mkdtempSync(join(tmpdir(), 'phlox-video-'))
const navegador = await chromium.launch()

try {
  const pagina = await navegador.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  })

  const problemas = []
  pagina.on('pageerror', (e) => problemas.push(e.message))

  await pagina.goto(PAGINA)
  // Esperar pelas fontes: exportar antes de elas chegarem dá um vídeo inteiro
  // com o tipo de letra de recurso, e só se dá por isso no fim.
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(1200)
  await pagina.evaluate(() => document.body.classList.add('gravar'))

  const duracao = await pagina.evaluate(() => window.DURACAO)
  const total = Math.round((duracao / 1000) * FPS)
  console.log(`${(duracao / 1000).toFixed(1)}s a ${FPS} fps = ${total} fotogramas\n`)

  for (let n = 0; n < total; n++) {
    await pagina.evaluate((ms) => window.irPara(ms), (n / FPS) * 1000)
    await pagina.screenshot({
      path: join(pasta, `f${String(n).padStart(5, '0')}.png`),
      animations: 'disabled',
    })
    if (n % 60 === 0 || n === total - 1) {
      const pct = Math.round(((n + 1) / total) * 100)
      process.stdout.write(`\r  ${String(pct).padStart(3)}%  ${n + 1}/${total}`)
    }
  }
  process.stdout.write('\n\n')

  if (problemas.length) console.warn('Avisos da página:', problemas.slice(0, 3))

  if (!existsSync(dirname(SAIDA))) mkdirSync(dirname(SAIDA), { recursive: true })

  console.log('A codificar com o ffmpeg…')
  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', join(pasta, 'f%05d.png'),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '17',              // praticamente sem perdas visíveis
    '-pix_fmt', 'yuv420p',     // sem isto, muitos leitores e o Instagram recusam
    '-movflags', '+faststart', // começa a tocar antes de descarregar tudo
    SAIDA,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  console.log(`\nPronto:  ${SAIDA}`)
} finally {
  await navegador.close()
  rmSync(pasta, { recursive: true, force: true })
}
