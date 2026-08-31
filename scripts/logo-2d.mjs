#!/usr/bin/env node
// logo-2d.mjs — gera os PNG 2D a partir da MESMA geometria do logótipo 3D.
//
// Assim os ícones nunca "quase batem certo" com o 3D: são a mesma coisa,
// fotografada. Corre quando a geometria mudar:
//
//   node scripts/logo-2d.mjs            → escreve em qa-out/logo2d/ para veres
//   node scripts/logo-2d.mjs --instalar → escreve nos sítios finais do projeto
//
// Fundo transparente. As versões com o verde da marca (para os ícones de app,
// onde um PNG transparente fica mau em muitos lançadores) são compostas aqui.

import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

const INSTALAR = process.argv.includes('--instalar')
const RAIZ = 'lib/phlox-logo'
const DEST = INSTALAR ? null : 'qa-out/logo2d'
if (DEST) mkdirSync(DEST, { recursive: true })

const TIPOS = { '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' }

const PAGINA = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style>
<script type="importmap">{"imports":{
  "three":"https://unpkg.com/three@0.185.0/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.185.0/examples/jsm/"
}}</script>
<script type="module">
import * as THREE from 'three';
import { buildPhloxMark, materials, blossom } from '/phlox-mark.js';
import { buildPhloxLogotype } from '/phlox-logotype.js';

function ambiente(renderer, scene) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0,'#ffffff'); g.addColorStop(0.45,'#e2e5ea');
  g.addColorStop(0.53,'#b9bec6'); g.addColorStop(1,'#8f959d');
  x.fillStyle = g; x.fillRect(0,0,512,256);
  const box = (cx,cy,w,h,a) => { const rg = x.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h));
    rg.addColorStop(0,\`rgba(255,255,255,\${a})\`); rg.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.ellipse(cx,cy,w,h,0,0,Math.PI*2); x.fill(); };
  box(150,62,110,58,1); box(390,92,72,44,0.7); box(260,26,160,32,0.45);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.PMREMGenerator(renderer);
  scene.environment = p.fromEquirectangular(tex).texture;
  scene.environmentIntensity = 1; p.dispose(); tex.dispose();
}

window.renderizar = async (qual, largura, altura, florEscura) => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setClearAlpha(0);
  renderer.setSize(largura, altura, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  ambiente(renderer, scene);
  scene.add(new THREE.DirectionalLight(0xffffff,1.9).translateX(2.2).translateY(3.4).translateZ(3.0));
  const key = new THREE.DirectionalLight(0xffffff,1.9); key.position.set(2.2,3.4,3.0);
  const rim = new THREE.DirectionalLight(0xffe6f0,0.7); rim.position.set(-2.6,1.2,-2.2);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff,0xd8dce2,0.7));

  let obj;
  if (qual === 'marca') {
    const m = buildPhloxMark(); m.update(6); obj = m.object;
  } else if (qual === 'flor') {
    const mats = materials();
    const b = blossom(mats, 26, 0.0296);
    b.group.rotation.x = -Math.PI/2;
    if (b.update) b.update(6);
    obj = new THREE.Group(); obj.add(b.group);
  } else {
    const l = await buildPhloxLogotype({ font:'lora', letterColor:0x16181d, punch:0.24, flowerScale:0.94 });
    if (l.update) l.update(6);
    obj = l.object;
    // ── VARIANTE PARA FUNDOS CLAROS ────────────────────────────────────
    // A flor é rosa muito pálido e desaparece em branco. Escurecê-la depois,
    // no PNG, não funciona: as pétalas mais claras têm o mesmo croma que os
    // brilhos das letras (medido: letras nunca passam de croma 12, e há
    // pétalas abaixo disso), por isso nenhuma regra por píxel as separa.
    //
    // Aqui é trivial: o material da pétala tem vertexColors com color base
    // branca, e a cor base MULTIPLICA as cores dos vértices. Baixá-la escurece
    // a flor toda por igual, mantendo sombreado e relevo — e sem tocar nas
    // letras, que são outro material.
    if (florEscura) {
      obj.traverse((n) => {
        const m = n.material;
        if (!m) return;
        for (const mm of (Array.isArray(m) ? m : [m])) {
          if (mm?.name === 'petala') mm.color.setRGB(0.52, 0.36, 0.42);
          if (mm?.name === 'garganta') mm.color.multiplyScalar(0.72);
          if (mm?.name === 'estame') mm.color.multiplyScalar(0.80);
        }
      });
    }
  }
  scene.add(obj);

  // enquadrar: caixa envolvente → câmara que a preenche com folga
  const caixa = new THREE.Box3().setFromObject(obj);
  const tam = caixa.getSize(new THREE.Vector3());
  const centro = caixa.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(24, largura/altura, 0.001, 100);
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov)/2);
  const folga = 1.10;
  const dist = Math.max((tam.x*folga*0.5)/(t*cam.aspect), (tam.y*folga*0.5)/t) + tam.z;
  cam.position.set(centro.x, centro.y, centro.z + dist);
  cam.lookAt(centro);
  cam.updateProjectionMatrix();

  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/png');
  canvas.remove(); renderer.dispose();
  return url;
};
// Compõe a flor sobre o verde da marca. Um PNG transparente fica mau em muitos
// lançadores de Android e no ecrã inicial do iOS — os ícones de app levam fundo.
window.compor = (florDataUrl, lado) => new Promise((resolve) => {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, lado, lado);
  g.addColorStop(0, '#128a52');   // verde mais claro no canto superior esquerdo
  g.addColorStop(1, '#0b5c37');   // --green-2 no inferior direito
  x.fillStyle = g; x.fillRect(0, 0, lado, lado);
  const img = new Image();
  img.onload = () => {
    const d = lado * 0.78;                     // a flor ocupa 78% do quadrado
    x.drawImage(img, (lado - d) / 2, (lado - d) / 2, d, d);
    resolve(c.toDataURL('image/png'));
  };
  img.src = florDataUrl;
});
// Reduz mantendo a transparência — para a marca pequena do cabeçalho, onde um
// PNG de 1024px seriam 238KB para desenhar 28 pixéis.
window.reduzir = (dataUrl, lado) => new Promise((resolve) => {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const x = c.getContext('2d');
  const img = new Image();
  img.onload = () => { x.drawImage(img, 0, 0, lado, lado); resolve(c.toDataURL('image/png')); };
  img.src = dataUrl;
});
window.__pronto = true;
</script>`

const servidor = createServer((req, res) => {
  const caminho = req.url.split('?')[0]
  if (caminho === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(PAGINA)
  const ficheiro = join(RAIZ, caminho)
  if (!existsSync(ficheiro)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TIPOS[extname(ficheiro)] || 'application/octet-stream' })
  res.end(readFileSync(ficheiro))
}).listen(0)

const porta = servidor.address().port
const navegador = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })

function guardar(destino, dataUrl) {
  writeFileSync(destino, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('  ✓', destino)
}

try {
  const page = await navegador.newPage({ viewport: { width: 1200, height: 1200 } })
  await page.goto(`http://localhost:${porta}/`)
  await page.waitForFunction(() => window.__pronto, { timeout: 30_000 })
  await page.waitForTimeout(1200)   // deixar as fontes/PMREM assentar

  const render = async (qual, w, h, escura) => {
    const url = await page.evaluate(([q, a, b, e]) => window.renderizar(q, a, b, e), [qual, w, h, escura])
    if (!url || url.length < 5000) throw new Error(`render de "${qual}" saiu vazio`)
    return url
  }

  const flor = await render('flor', 1024, 1024)
  const logotipo = await render('logotipo', 1560, 648)
  const logotipoEscuro = await render('logotipo', 1560, 648, true)

  if (!INSTALAR) {
    guardar(join(DEST, 'marca.png'), await render('marca', 1024, 1024))
    guardar(join(DEST, 'flor.png'), flor)
    guardar(join(DEST, 'logotipo.png'), logotipo)
    // pré-visualização de como fica o ícone de app
    guardar(join(DEST, 'icone-192.png'), await page.evaluate((f) => window.compor(f, 192), flor))
  } else {
    // Ícones de app: flor sobre o verde da marca
    const icone = (lado) => page.evaluate(([f, l]) => window.compor(f, l), [flor, lado])
    mkdirSync('public/icons', { recursive: true })
    guardar('public/icons/icon-512.png', await icone(512))
    guardar('public/icons/icon-192.png', await icone(192))
    guardar('public/icons/icon-72.png', await icone(72))
    guardar('public/icons/apple-touch-icon.png', await icone(180))

    // Ícone do separador do browser (Next gera as tags a partir de app/icon.png).
    // 192 e não 512: isto é pedido em todas as páginas — 48KB em vez de 278KB.
    guardar('app/icon.png', await icone(192))

    // A flor sozinha, transparente — para usar dentro do produto sobre qualquer fundo
    guardar('public/flor.png', flor)
    // Versão pequena para a marca do cabeçalho (28px) e afins
    guardar('public/flor-64.png', await page.evaluate(([f, l]) => window.reduzir(f, l), [flor, 64]))
    // O logótipo completo, transparente — og-image, e-mail, apresentações
    guardar('public/logotipo.png', logotipo)
    guardar('public/logotipo-escuro.png', logotipoEscuro)

    // favicon.ico com PNG embutido (formato Vista+), sem dependências
    const png32 = Buffer.from((await icone(32)).split(',')[1], 'base64')
    const cab = Buffer.alloc(6); cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(1, 4)
    const dir = Buffer.alloc(16)
    dir[0] = 32; dir[1] = 32; dir[2] = 0; dir[3] = 0
    dir.writeUInt16LE(1, 4); dir.writeUInt16LE(32, 6)
    dir.writeUInt32LE(png32.length, 8); dir.writeUInt32LE(22, 12)
    writeFileSync('app/favicon.ico', Buffer.concat([cab, dir, png32]))
    console.log('  ✓ app/favicon.ico')
  }
} finally {
  await navegador.close()
  servidor.close()
}

console.log('\nVê as imagens antes de instalar. Depois: node scripts/logo-2d.mjs --instalar')
