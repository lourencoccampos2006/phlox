import * as THREE from 'three';
import { buildSpinningLogotype, buildPhloxLogotype } from './phlox-logotype.js';

/* ------------------------------------------------------------------ *
 * <phlox-logo> — logótipo Phlox em 3D, pronto a colar no site.
 *
 *   <phlox-logo color="#16181d" speed="0.42"></phlox-logo>
 *
 * Fundo transparente (herda o que estiver por baixo). Floresce uma vez
 * ao entrar em ecrã e depois roda continuamente; a palavra lê-se sempre
 * "phlox", nunca espelhada. Pára fora do ecrã e respeita
 * prefers-reduced-motion. Arrastável com rato/dedo.
 *
 * Atributos (todos opcionais):
 *   color        cor das letras            (default #16181d)
 *   font         lora | cormorant          (default lora)
 *   speed        rad/s da rotação          (default 0.42)
 *   punch        0–1, rosa nas pétalas     (default 0.24)
 *   flower-scale tamanho do "o"            (default 0.94)
 *   env          light | dark              (default light)
 *   static       sem rotação nem florescer (pose final)
 * ------------------------------------------------------------------ */

function studioEnv(renderer, scene, mode) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  if (mode === 'dark') {
    g.addColorStop(0, '#e9edf2'); g.addColorStop(0.45, '#767c85');
    g.addColorStop(0.53, '#2a2e34'); g.addColorStop(1, '#101216');
  } else {
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#e2e5ea');
    g.addColorStop(0.53, '#b9bec6'); g.addColorStop(1, '#8f959d');
  }
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const box = (cx, cy, w, h, a) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h));
    rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); x.fill();
  };
  box(150, 62, 110, 58, 1); box(390, 92, 72, 44, 0.7); box(260, 26, 160, 32, 0.45);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  scene.environmentIntensity = 1;
  pmrem.dispose(); tex.dispose();
}

function lights(scene, mode) {
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(2.2, 3.4, 3.0);
  const rim = new THREE.DirectionalLight(0xffe6f0, mode === 'dark' ? 0.9 : 0.7);
  rim.position.set(-2.6, 1.2, -2.2);
  scene.add(key, rim, new THREE.HemisphereLight(
    0xffffff, mode === 'dark' ? 0x2a2e34 : 0xd8dce2, mode === 'dark' ? 0.5 : 0.7));
}

class PhloxLogo extends HTMLElement {
  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host { display: block; width: 260px; aspect-ratio: 260 / 108; }
      canvas { width: 100%; height: 100%; display: block; cursor: grab; }
      canvas:active { cursor: grabbing; }
    </style><canvas></canvas>`;
    this._canvas = shadow.querySelector('canvas');
    this._boot().catch((e) => console.error('[phlox-logo]', e));
  }

  disconnectedCallback() {
    this._stop = true;
    if (this._io) this._io.disconnect();
    if (this._renderer) this._renderer.dispose();
  }

  async _boot() {
    const canvas = this._canvas;
    const mode = this.getAttribute('env') === 'dark' ? 'dark' : 'light';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer = renderer;
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 5);
    studioEnv(renderer, scene, mode);
    lights(scene, mode);

    const opts = {
      font: this.getAttribute('font') || 'lora',
      letterColor: new THREE.Color(this.getAttribute('color') || '#16181d').getHex(),
      punch: parseFloat(this.getAttribute('punch') ?? '0.24'),
      flowerScale: parseFloat(this.getAttribute('flower-scale') ?? '0.94'),
      speed: parseFloat(this.getAttribute('speed') ?? '0.42'),
    };
    const built = await buildSpinningLogotype(opts);
    scene.add(built.object);
    this.dispatchEvent(new CustomEvent('ready'));

    const fit = () => {
      const w = canvas.clientWidth || 260, h = canvas.clientHeight || 108;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      camera.position.set(0, built.height * 0.04, Math.max(
        (built.width * 0.56) / (t * camera.aspect), (built.height * 0.60) / t));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(this);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const frozen = () => this.hasAttribute('static') || reduce.matches;
    let visible = true, drag = null, manual = 0;
    this._io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.05 });
    this._io.observe(this);

    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (drag === null) return;
      manual += (e.clientX - drag) * 0.01; drag = e.clientX;
    });
    const up = () => { drag = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    const t0 = performance.now();
    const frame = (now) => {
      if (this._stop) return;
      if (visible) {
        // o florescer corre uma única vez (satura ~1,9 s); depois fica
        // só a rotação contínua e a respiração da flor
        if (frozen()) built.update(6, manual - 6 * built.speed);
        else built.update((now - t0) / 1000, manual);
        renderer.render(scene, camera);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

if (!customElements.get('phlox-logo')) customElements.define('phlox-logo', PhloxLogo);

export { PhloxLogo, buildPhloxLogotype, buildSpinningLogotype };
