import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { materials, blossom, leaf } from './phlox-mark.js';

/* ------------------------------------------------------------------ *
 * Phlox Clinical — logótipo tridimensional
 * Palavra "phlox" em itálico serifado, extrudida com bisel real; o "o"
 * é substituído por uma flor de Phlox vista de frente (as mesmas
 * superfícies paramétricas da marca completa).
 * ------------------------------------------------------------------ */

/* ─── ÚNICA ALTERAÇÃO AO PACOTE ORIGINAL (2026-08-25) ────────────────────
 * O original carregava o .ttf com o TTFLoader do three.js. Isso trazia dois
 * problemas neste site:
 *   1. O TTFLoader importa o opentype.js de https://cdn.jsdelivr.net — o
 *      Turbopack não empacota módulos externos, e o build falhava.
 *   2. Mesmo que empacotasse, o browser de cada utilizador iria buscar código
 *      a um terceiro em tempo de execução. Num produto de saúde que aloja
 *      tudo na UE, isso não entra.
 *
 * A fonte passou a ser convertida uma vez para o formato JSON do three, com
 * só os 5 glifos de "phlox": 216KB → 6KB, sem CDN e sem opentype.
 * Reconverter com:  node scripts/logo-fonte-json.mjs
 *
 * (O Cormorant sai daqui por não ser usado — a serifa da marca é a Lora. Para
 * o repor, converte-o com o mesmo script e acrescenta a entrada.)
 * ─────────────────────────────────────────────────────────────────────── */
export const FONTS = {
  lora: new URL('./fonts/Lora-Italic.json', import.meta.url).href,
};

const cache = new Map();

export async function loadFont(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url)
      .then((r) => r.json())
      .then((json) => new FontLoader().parse(json)));
  }
  return cache.get(url);
}

function inkMaterial() {
  return new THREE.MeshPhysicalMaterial({
    name: 'tinta-grafite', color: 0x1b1e24, roughness: 0.32, metalness: 0.35,
    clearcoat: 0.45, clearcoatRoughness: 0.3,
  });
}

/** Logótipo: wordmark + flor no lugar do "o". */
export async function buildPhloxLogotype(opts = {}) {
  const {
    font: fontKey = 'lora',   // era 'cormorant' — ver a nota sobre as fontes acima
    size = 0.06,
    depth = 0.19,          // fração do corpo (profundidade da extrusão)
    tracking = 0.035,      // fração do corpo entre letras
    letterColor = 0x1b1e24,
    punch = 0.3,           // quanto rosa entra nas pétalas
    flowerScale = 1,
    leaves = true,
  } = opts;

  const font = await loadFont(FONTS[fontKey] || fontKey);
  const mats = materials();
  const ink = inkMaterial();
  ink.color = new THREE.Color(letterColor);

  const root = new THREE.Group();
  root.name = 'PhloxLogotipo';
  const word = new THREE.Group();
  word.name = 'palavra';
  root.add(word);

  const res = font.data.resolution;
  const adv = (ch) => (font.data.glyphs[ch] ? font.data.glyphs[ch].ha / res : 0.5) * size;
  const xHeight = (font.data.glyphs['x'] ? 1 : 1) * size * 0.47;

  const D = size * depth;
  const geoOpts = {
    font, size, depth: D, curveSegments: 14,
    bevelEnabled: true, bevelThickness: size * 0.018,
    bevelSize: size * 0.016, bevelOffset: 0, bevelSegments: 4,
  };

  const chars = ['p', 'h', 'l', 'o', 'x'];
  let x = 0;
  const glyphs = [];
  let oCenter = null, oWidth = adv('o');
  chars.forEach((ch) => {
    let a = adv(ch);
    if (ch === 'o') {
      a *= 1.46;                                       // o slot da flor é mais largo
      oWidth = a;
      oCenter = new THREE.Vector3(x + a * 0.5, xHeight * 0.52, 0);
    } else {
      const g = new TextGeometry(ch, geoOpts);
      g.computeBoundingBox();
      const m = new THREE.Mesh(g, ink);
      m.name = 'letra-' + ch;
      m.position.set(x, 0, -D / 2);
      word.add(m);
      glyphs.push(m);
    }
    x += a + size * tracking;
  });
  const totalW = x - size * tracking;

  // flor no lugar do "o" — de frente, ligeiramente inclinada
  const petalReach = 0.0158 * 1.06;                    // raio da flor a escala 1
  const target = oWidth * 0.98 * flowerScale;          // diâmetro desejado
  const fScale = target / (petalReach * 2);
  const flowerPivot = new THREE.Group();
  flowerPivot.name = 'flor-o';
  flowerPivot.position.copy(oCenter);
  const b = blossom(mats, fScale, 0.0296);   // semente escolhida: tom rosa mais saturado
  b.group.rotation.x = -Math.PI / 2;                   // virada para o observador
  b.group.rotation.z = 0;
  flowerPivot.rotation.set(0.06, 0, 0.04);
  flowerPivot.add(b.group);
  word.add(flowerPivot);

  if (leaves) {
    const sprig = new THREE.Group();
    sprig.name = 'folhas';
    const spec = [
      { L: size * 0.46, W: size * 0.092, rz: -0.15, ry: -0.35, p: [-0.30, -0.30, -0.16] },
      { L: size * 0.34, W: size * 0.070, rz: 0.44, ry: 0.55, p: [0.20, -0.34, -0.22] },
    ];
    spec.forEach((sp, i) => {
      const p = new THREE.Group();
      p.position.set(oCenter.x + size * sp.p[0], oCenter.y + size * sp.p[1], size * sp.p[2]);
      p.rotation.set(-1.42, sp.ry, sp.rz);
      p.add(leaf(mats, sp.L, sp.W, 7 + i * 3));
      p.name = 'folha-' + (i + 1);
      sprig.add(p);
    });
    word.add(sprig);
  }

  // centra o conjunto na origem (para girar sobre o próprio eixo)
  word.position.set(-totalW / 2, -xHeight / 2, 0);

  // as pétalas ganham rosa para o logótipo ler bem a tamanho pequeno
  const punchCol = new THREE.Color(0xd4568e);
  b.group.traverse((o) => {
    if (!o.isMesh || !o.name.startsWith('petala')) return;
    const attr = o.geometry.getAttribute('color');
    const c = new THREE.Color();
    for (let i = 0; i < attr.count; i++) {
      c.fromBufferAttribute(attr, i).lerp(punchCol, punch);
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  });

  const petals = b.pivots.map((p) => ({ p, rest: p.rotation.z }));

  function update(t) {
    const bl = Math.min(1, Math.max(0, (t - 0.25) / 1.6));
    const e = 1 - Math.pow(1 - bl, 3);
    petals.forEach((q, k) => {
      q.p.rotation.z = -1.35 + (q.rest + 1.35) * e;
      q.p.scale.setScalar(0.75 + 0.25 * e);
    });
    flowerPivot.rotation.z = 0.04 + Math.sin(t * 0.9) * 0.045 * e;
    flowerPivot.rotation.x = 0.06 + Math.cos(t * 0.7) * 0.035 * e;
  }
  update(0);

  return { object: root, update, width: totalW, height: size * 1.35, glyphs };
}

/* ------------------------------------------------------------------ *
 * Rotação-ilusão: duas cópias do logótipo montadas dorso-a-dorso, cada
 * uma legível do seu lado. O pivô roda 360° sem parar; a troca entre
 * cópias acontece no instante em que as letras ficam de perfil (a
 * espessura da extrusão é uma lâmina, quase invisível) — o olho lê
 * "phlox" em qualquer ângulo, nunca "xolhp".
 * ------------------------------------------------------------------ */
export async function buildSpinningLogotype(opts = {}) {
  const { speed = 0.42, tilt = 0.06 } = opts;
  const front = await buildPhloxLogotype(opts);
  const back = await buildPhloxLogotype(opts);

  const pivot = new THREE.Group();
  pivot.name = 'LogotipoRotativo';
  const gap = (opts.size ?? 0.06) * 0.035;
  front.object.position.z = -gap;
  back.object.rotation.y = Math.PI;
  back.object.position.z = gap;
  pivot.add(front.object, back.object);

  const faces = [front, back].map((side) => {
    const mats = new Set();
    side.object.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        m.transparent = true;
        m.depthWrite = true;
        mats.add(m);
      });
    });
    return { side, mats: [...mats] };
  });

  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function update(t, yaw = 0) {
    const theta = t * speed + yaw;
    pivot.rotation.y = theta;
    pivot.rotation.x = tilt + Math.sin(t * 0.5) * 0.03;
    const c = Math.cos(theta);
    faces.forEach(({ side, mats }, i) => {
      // 1 de frente para a câmara, 0 de costas; apaga-se de perfil
      const w = smooth(0.0, 0.13, i === 0 ? c : -c);
      side.object.visible = w > 0.001;
      mats.forEach((m) => { m.opacity = w; });
      if (w > 0.001) side.update(t);
    });
  }
  update(0);

  return {
    object: pivot, update, speed,
    width: front.width, height: front.height,
  };
}
