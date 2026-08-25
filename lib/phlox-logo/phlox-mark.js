import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Phlox Clinical — marca tridimensional
 * Florescência de Phlox paniculata construída por superfícies
 * paramétricas (pétalas, sépalas, botões, folhas), caule por varrimento
 * ao longo de curva, e medalhão maquinado (perfil de revolução com
 * chanfros e raios reais + placa da marca extrudida com bisel).
 * ------------------------------------------------------------------ */

const V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* ---------- materiais (paleta curada, partilhada) ---------- */
export function materials() {
  const petala = new THREE.MeshPhysicalMaterial({
    name: 'petala', color: 0xffffff, vertexColors: true,
    roughness: 0.62, metalness: 0.0, sheen: 0.6,
    sheenRoughness: 0.62, sheenColor: new THREE.Color(0xffdbe9),
    clearcoat: 0.08, clearcoatRoughness: 0.75,
  });
  const folhagem = new THREE.MeshPhysicalMaterial({
    name: 'folhagem', color: 0xffffff, vertexColors: true,
    roughness: 0.55, metalness: 0.0, sheen: 0.18,
    sheenColor: new THREE.Color(0xb8cfa2), clearcoat: 0.12, clearcoatRoughness: 0.6,
  });
  const garganta = new THREE.MeshStandardMaterial({
    name: 'garganta', color: 0xd7dec2, roughness: 0.5, metalness: 0.0,
  });
  const estame = new THREE.MeshStandardMaterial({
    name: 'estame', color: 0xf2e3b4, roughness: 0.44, metalness: 0.0,
  });
  const aco = new THREE.MeshStandardMaterial({
    name: 'aco-escovado', color: 0x8b9299, roughness: 0.22, metalness: 0.9,
  });
  const verde = new THREE.MeshStandardMaterial({
    name: 'verde-phlox', color: 0x0d6e42, roughness: 0.36, metalness: 0.1,
  });
  const marfim = new THREE.MeshStandardMaterial({
    name: 'marfim', color: 0xf6f7f5, roughness: 0.22, metalness: 0.0,
  });
  return { petala, folhagem, garganta, estame, aco, verde, marfim };
}

/* ---------- construtores de geometria paramétrica ---------- */

function sampleGrid(fn, NU, NV) {
  const P = [], N = [];
  const e = 6e-4;
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const rowP = [], rowN = [];
    for (let j = 0; j <= NV; j++) {
      const v = -1 + (2 * j) / NV;
      const p = fn(u, v);
      const du = fn(clamp(u + e, 0, 1), v).sub(fn(clamp(u - e, 0, 1), v));
      const dv = fn(u, clamp(v + e, -1, 1)).sub(fn(u, clamp(v - e, -1, 1)));
      const n = du.cross(dv);
      if (n.lengthSq() < 1e-14) n.set(0, 1, 0); else n.normalize();
      rowP.push(p); rowN.push(n);
    }
    P.push(rowP); N.push(rowN);
  }
  // repara normais degeneradas (ponta / eixo) usando a linha anterior
  for (let i = 0; i <= NU; i++)
    for (let j = 0; j <= NV; j++)
      if (N[i][j].y === 1 && N[i][j].x === 0 && N[i][j].z === 0 && i > 0) N[i][j].copy(N[i - 1][j]);
  return { P, N };
}

/** Sólido de casca dupla: superfície frontal + traseira + costura de bordo. */
function solidSurface(fnIn, NU, NV, thickness, colorFn, name, material) {
  // v invertido: garante que a normal da folha frontal aponta para fora
  const fn = (u, v) => fnIn(u, -v);
  const { P, N } = sampleGrid(fn, NU, NV);
  const pos = [], nor = [], col = [], uvs = [], idx = [];
  const h = thickness / 2;
  const stride = NV + 1;
  const A = (NU + 1) * stride;
  for (let side = 0; side < 2; side++) {
    const s = side === 0 ? 1 : -1;
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const p = P[i][j], n = N[i][j];
      pos.push(p.x + n.x * h * s, p.y + n.y * h * s, p.z + n.z * h * s);
      nor.push(n.x * s, n.y * s, n.z * s);
      uvs.push(i / NU, j / NV);
      if (colorFn) { const c = colorFn(i / NU, -1 + (2 * j) / NV, side); col.push(c.r, c.g, c.b); }
    }
  }
  const f = (i, j) => i * stride + j, b = (i, j) => A + i * stride + j;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    idx.push(f(i, j), f(i + 1, j), f(i, j + 1), f(i + 1, j), f(i + 1, j + 1), f(i, j + 1));
    idx.push(b(i, j), b(i, j + 1), b(i + 1, j), b(i + 1, j), b(i, j + 1), b(i + 1, j + 1));
  }
  for (let i = 0; i < NU; i++) {
    idx.push(f(i, 0), b(i, 0), f(i + 1, 0), f(i + 1, 0), b(i, 0), b(i + 1, 0));
    idx.push(f(i, NV), f(i + 1, NV), b(i, NV), b(i, NV), f(i + 1, NV), b(i + 1, NV));
  }
  for (let j = 0; j < NV; j++) {
    idx.push(f(0, j), f(0, j + 1), b(0, j), b(0, j), f(0, j + 1), b(0, j + 1));
    idx.push(f(NU, j), b(NU, j), f(NU, j + 1), f(NU, j + 1), b(NU, j), b(NU, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  return m;
}

/** Casca fechada de folha única (botões, sépalas fundidas). */
function shellSurface(fn, NU, NV, colorFn, name, material, flip) {
  const { P, N } = sampleGrid(fn, NU, NV);
  const pos = [], nor = [], col = [], uvs = [], idx = [];
  const stride = NV + 1, s = flip ? -1 : 1;
  for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
    const p = P[i][j], n = N[i][j];
    pos.push(p.x, p.y, p.z); nor.push(n.x * s, n.y * s, n.z * s); uvs.push(i / NU, j / NV);
    if (colorFn) { const c = colorFn(i / NU, -1 + (2 * j) / NV); col.push(c.r, c.g, c.b); }
  }
  const f = (i, j) => i * stride + j;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    if (flip) idx.push(f(i, j), f(i, j + 1), f(i + 1, j), f(i + 1, j), f(i, j + 1), f(i + 1, j + 1));
    else idx.push(f(i, j), f(i + 1, j), f(i, j + 1), f(i + 1, j), f(i + 1, j + 1), f(i, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  return m;
}

/** Varrimento circular com raio variável ao longo de uma curva. */
function sweptTube(curve, radiusFn, NU, NV, material, name) {
  const frames = curve.computeFrenetFrames(NU, false);
  const pos = [], nor = [], uvs = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const c = curve.getPointAt(u);
    const N = frames.normals[Math.min(i, NU - 1)], B = frames.binormals[Math.min(i, NU - 1)];
    const r = radiusFn(u);
    for (let j = 0; j <= NV; j++) {
      const a = (j / NV) * Math.PI * 2;
      const dir = new V3().addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r);
      nor.push(dir.x, dir.y, dir.z);
      uvs.push(u, j / NV);
    }
  }
  const stride = NV + 1;
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * stride + j, b = (i + 1) * stride + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  return m;
}

/* ---------- pétala ---------- */

function petalColor(u, v, side, hue) {
  const body = new THREE.Color(0xf6dfeb);
  const blush = new THREE.Color(0xdb8ab4);
  const eye = new THREE.Color(0xc8497f);
  const deep = new THREE.Color(0xbe4a7d);
  const throat = new THREE.Color(0xf0ecc8);
  const c = body.clone();
  c.lerp(blush, 0.42 + 0.30 * Math.pow(u, 1.4) + 0.16 * Math.abs(v));
  const vein = Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * 3.0), 3);
  c.lerp(deep, 0.14 * vein * Math.pow(u, 0.6));
  const e = 1 - sstep(0.10, 0.40, u);
  c.lerp(eye, e * 0.55);
  c.lerp(deep, Math.pow(1 - sstep(0.03, 0.22, u), 2) * 0.5);
  c.lerp(throat, 0.55 * (1 - sstep(0.0, 0.075, u)));
  if (side === 1) c.lerp(new THREE.Color(0xf7e8ef), 0.55);
  if (hue) {
    if (hue > 0) c.lerp(new THREE.Color(0xc45c8c), hue * 0.32);
    else c.lerp(new THREE.Color(0xfdf3f7), -hue * 0.38);
  }
  return c;
}

function petalSurface(L, W, seed) {
  const wob = (k) => Math.sin(seed * 12.9898 + k * 4.13) * 0.5 + 0.5;
  const twistAmt = mix(0.04, 0.11, wob(1));
  const recurve = mix(0.08, 0.17, wob(2));
  const ripple = mix(0.004, 0.011, wob(3));
  return (u, v) => {
    const base = 0.17 + 0.83 * Math.pow(u, 0.44);
    const cap = u > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.18, 2))) : 1;
    const scallop = 1 - 0.05 * Math.cos(v * Math.PI * 2) * u;
    const w = W * base * cap * scallop;
    const x = L * u;
    let y = -recurve * L * Math.pow(u, 2.0) + 0.06 * L * Math.sin(u * Math.PI * 0.9);
    const cupK = 0.20 * (1 - u) - 0.07 * Math.pow(u, 1.5);
    y += cupK * W * v * v;
    y += ripple * L * Math.sin(v * Math.PI * 2.6) * Math.pow(u, 2.2);
    const tw = twistAmt * u;
    const z = w * v * Math.cos(tw);
    y += w * v * Math.sin(tw) * 0.7;
    return new V3(x, y, z);
  };
}

/* ---------- flor aberta ---------- */

export function blossom(mats, scale, seed) {
  const hue = Math.sin(seed * 53.1) * 0.9;
  const tint = (u, v, side) => petalColor(u, v, side, hue);
  const g = new THREE.Group();
  g.name = 'flor';
  const L = 0.0158 * scale, W = 0.0094 * scale;
  const pivots = [];
  for (let k = 0; k < 5; k++) {
    const s = seed + k * 0.37;
    const jitter = (Math.sin(s * 91.7) * 0.5 + 0.5);
    const pivot = new THREE.Group();
    pivot.name = 'petala-pivo';
    pivot.rotation.y = (k / 5) * Math.PI * 2 + (jitter - 0.5) * 0.14;
    pivot.rotation.z = -0.15 - (jitter - 0.5) * 0.09;
    const sc = 1 + (jitter - 0.5) * 0.10;
    const mesh = solidSurface(petalSurface(L * sc, W * sc, s), 30, 16, 0.00024 * scale,
      tint, 'petala-' + (k + 1), mats.petala);
    mesh.position.x = 0.0026 * scale;
    pivot.add(mesh);
    g.add(pivot);
    pivots.push(pivot);
  }
  // tubo da corola (garganta) — perfil de revolução
  const prof = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const r = (0.0011 + 0.0019 * Math.pow(t, 3.0)) * scale;
    prof.push(new THREE.Vector2(r, -0.0105 * scale + 0.0105 * scale * t));
  }
  const tube = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mats.garganta);
  tube.name = 'tubo-corola';
  g.add(tube);

  // estames + pistilo dentro da garganta
  const st = new THREE.Group(); st.name = 'estames';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.4;
    const curve = new THREE.CatmullRomCurve3([
      new V3(0, -0.006 * scale, 0),
      new V3(Math.cos(a) * 0.0006 * scale, -0.0015 * scale, Math.sin(a) * 0.0006 * scale),
      new V3(Math.cos(a) * 0.0015 * scale, 0.0013 * scale, Math.sin(a) * 0.0015 * scale),
    ]);
    const fil = sweptTube(curve, () => 0.00016 * scale, 10, 6, mats.estame, 'filamento-' + (k + 1));
    st.add(fil);
    const anth = new THREE.Mesh(new THREE.SphereGeometry(0.00030 * scale, 10, 8), mats.estame);
    anth.name = 'antera-' + (k + 1);
    anth.scale.set(1, 1.6, 0.85);
    anth.position.set(Math.cos(a) * 0.0016 * scale, 0.0016 * scale, Math.sin(a) * 0.0016 * scale);
    anth.rotation.y = -a;
    st.add(anth);
  }
  const pist = sweptTube(new THREE.CatmullRomCurve3([
    new V3(0, -0.007 * scale, 0), new V3(0.0002 * scale, 0.0005 * scale, 0),
    new V3(0.0004 * scale, 0.0034 * scale, 0)]),
    (u) => 0.00019 * scale * (1 - 0.3 * u), 12, 6, mats.estame, 'pistilo');
  st.add(pist);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.00034 * scale, 10, 7), mats.estame);
    lobe.name = 'estigma-' + (k + 1);
    lobe.position.set(0.0004 * scale + Math.cos(a) * 0.0004 * scale, 0.0036 * scale, Math.sin(a) * 0.0004 * scale);
    st.add(lobe);
  }
  g.add(st);
  return { group: g, pivots };
}

/* ---------- botão + cálice ---------- */

export function bud(mats, scale, seed) {
  const g = new THREE.Group(); g.name = 'botao';
  const H = 0.0150 * scale, R = 0.0027 * scale;
  const twist = 1.9 + (Math.sin(seed * 31.7) * 0.5 + 0.5) * 1.6;
  const surf = (u, v) => {
    const th = v * Math.PI;
    const prof = Math.sin(Math.pow(u, 0.72) * Math.PI * 0.99);
    const flute = 1 + 0.26 * Math.cos(5 * (th + twist * u)) * (0.35 + 0.65 * sstep(0.1, 0.8, u));
    const r = R * (0.16 + 1.05 * prof) * flute;
    return new V3(r * Math.cos(th), H * u * (1 + 0.06 * Math.cos(5 * (th + twist * u))), r * Math.sin(th));
  };
  const col = (u) => {
    const tip = new THREE.Color(0xcf7fa8), mid = new THREE.Color(0xefdde7), low = new THREE.Color(0x4f7541);
    const c = low.clone().lerp(mid, sstep(0.10, 0.55, u));
    c.lerp(tip, sstep(0.45, 1.0, u) * 0.9);
    return c;
  };
  g.add(shellSurface(surf, 30, 44, col, 'corola-fechada', mats.petala));
  g.add(calyx(mats, scale * 0.9, seed));
  return g;
}

function calyx(mats, scale, seed) {
  const g = new THREE.Group(); g.name = 'calice';
  const L = 0.0062 * scale, W = 0.0013 * scale;
  for (let k = 0; k < 5; k++) {
    const p = new THREE.Group();
    p.rotation.y = (k / 5) * Math.PI * 2 + seed;
    p.rotation.z = -1.32;
    const fn = (u, v) => {
      const w = W * (0.9 - 0.85 * Math.pow(u, 1.6));
      return new V3(L * u, -0.10 * L * Math.pow(u, 2) + 0.35 * W * v * v, w * v);
    };
    const s = solidSurface(fn, 12, 8, 0.00026 * scale, () => new THREE.Color(0x2e5a30), 'sepala-' + (k + 1), mats.folhagem);
    p.add(s); g.add(p);
  }
  return g;
}

/* ---------- folha ---------- */

function leafColor(u, v, side) {
  const dark = new THREE.Color(0x123a20), light = new THREE.Color(0x2a5e30), rib = new THREE.Color(0x5f8a4a);
  const c = dark.clone().lerp(light, 0.40 * Math.abs(v) + 0.22 * u);
  c.lerp(rib, Math.pow(1 - Math.min(1, Math.abs(v) * 7), 3) * 0.5);
  if (side === 1) c.lerp(new THREE.Color(0x6d8f5f), 0.55);
  return c;
}

export function leaf(mats, L, W, seed) {
  const wob = (k) => Math.sin(seed * 17.3 + k * 3.7) * 0.5 + 0.5;
  const droop = mix(0.26, 0.42, wob(1));
  const fn = (u, v) => {
    const base = Math.pow(Math.sin(Math.pow(u, 0.72) * Math.PI * 0.98), 0.62);
    const w = W * base * (1 - 0.25 * Math.pow(u, 3));
    const x = L * u;
    let y = -droop * L * Math.pow(u, 2.1);
    y += 0.42 * W * v * v;                                    // canal em V
    y -= 0.5 * W * Math.pow(1 - Math.min(1, Math.abs(v) * 6), 2) * (1 - u) * 0.6; // nervura central
    y += 0.008 * L * Math.sin(v * Math.PI * 2.2) * Math.pow(u, 2);
    y += 0.0022 * L * Math.sin(u * 30 + v * 5.5);             // nervuras secundárias
    return new V3(x, y, w * v);
  };
  return solidSurface(fn, 30, 16, 0.00042, leafColor, 'folha', mats.folhagem);
}

/* ---------- medalhão maquinado ---------- */

function arc(pts, cx, cy, r, a0, a1, n) {
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
}

function medallion(mats) {
  const g = new THREE.Group(); g.name = 'base';
  const R = 0.064, H = 0.0155, p = [];
  p.push(new THREE.Vector2(0, 0));
  p.push(new THREE.Vector2(R - 0.0035, 0));
  arc(p, R - 0.0035, 0.0035, 0.0035, -Math.PI / 2, 0, 8);       // chanfro inferior
  p.push(new THREE.Vector2(R, H - 0.004));
  arc(p, R - 0.004, H - 0.004, 0.004, 0, Math.PI / 2, 10);      // raio superior
  for (let i = 0; i <= 26; i++) {
    const rr = (R - 0.008) - ((R - 0.008) - 0.0345) * (i / 26);
    p.push(new THREE.Vector2(rr, H - 0.00006 * (1 + Math.sin(i * 2.1))));
  }
  p.push(new THREE.Vector2(0.0335, H));
  p.push(new THREE.Vector2(0.0315, H - 0.0022));                 // ranhura maquinada
  p.push(new THREE.Vector2(0.0275, H - 0.0022));
  p.push(new THREE.Vector2(0.0255, H));
  p.push(new THREE.Vector2(0.0165, H));
  arc(p, 0.0165, H + 0.0026, 0.0026, -Math.PI / 2, 0, 8);        // raio do maciço
  p.push(new THREE.Vector2(0.0191, H + 0.0072));
  p.push(new THREE.Vector2(0.0125, H + 0.0072));
  p.push(new THREE.Vector2(0.0125, H + 0.0058));
  p.push(new THREE.Vector2(0.0042, H + 0.0058));                 // encaixe do caule
  p.push(new THREE.Vector2(0.0042, H + 0.0026));
  p.push(new THREE.Vector2(0, H + 0.0026));
  const disc = new THREE.Mesh(new THREE.LatheGeometry(p, 160), mats.aco);
  disc.name = 'medalhao';
  g.add(disc);
  g.add(brandPlate(mats, H));
  return g;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

function crossShapes(span, arm, r) {
  return [roundedRect(arm, span, r), roundedRect(span, arm, r)];
}

function brandPlate(mats, H) {
  const g = new THREE.Group(); g.name = 'placa-marca';
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.031, 0.031, 0.008), {
    depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0005,
    bevelSegments: 3, curveSegments: 24,
  }), mats.verde);
  plate.name = 'placa-verde';
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, H + 0.0022, 0.0395);
  g.add(plate);
  const cross = new THREE.Mesh(new THREE.ExtrudeGeometry(crossShapes(0.0186, 0.0058, 0.0007), {
    depth: 0.0013, bevelEnabled: true, bevelThickness: 0.00026, bevelSize: 0.0003,
    bevelSegments: 2, curveSegments: 10,
  }), mats.marfim);
  cross.name = 'cruz';
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, H + 0.0035, 0.0395);
  g.add(cross);
  return g;
}

/* ---------- planta completa ---------- */

function plant(mats) {
  const g = new THREE.Group(); g.name = 'planta';
  const stemCurve = new THREE.CatmullRomCurve3([
    new V3(0, 0, 0), new V3(0.0045, 0.040, -0.003), new V3(0.0015, 0.082, 0.0045),
    new V3(-0.0045, 0.118, 0.001), new V3(-0.002, 0.142, -0.002),
  ]);
  g.add(sweptTube(stemCurve, (u) => 0.0040 * (1 - 0.40 * u) + 0.00022 * Math.sin(u * 26), 72, 20, mats.folhagem, 'caule'));

  // folhas opostas, 4 nós decrescentes
  const nodes = [0.22, 0.44, 0.63, 0.80];
  const leafSizes = [[0.058, 0.0118], [0.050, 0.0102], [0.039, 0.0082], [0.027, 0.0058]];
  nodes.forEach((t, ni) => {
    const at = stemCurve.getPointAt(t);
    for (let s = 0; s < 2; s++) {
      const p = new THREE.Group();
      p.position.copy(at);
      p.rotation.y = ni * 1.05 + s * Math.PI;
      p.rotation.z = 0.56 - ni * 0.10;
      const [L, W] = leafSizes[ni];
      const lf = leaf(mats, L, W, ni * 3 + s);
      p.add(lf);
      p.name = 'folha-no-' + (ni + 1);
      g.add(p);
    }
  });

  // panícula: 3 flores abertas + 3 botões em pedicelos curtos
  const top = stemCurve.getPointAt(1);
  const panicle = new THREE.Group();
  panicle.name = 'panicula';
  panicle.position.copy(top);
  g.add(panicle);

  const heads = [];
  const spec = [
    { kind: 'flor', a: 0.0, r: 0.000, h: 0.0345, s: 0.98, tilt: 0.03 },
    { kind: 'flor', a: 0.55, r: 0.0185, h: 0.0300, s: 0.92, tilt: 0.34 },
    { kind: 'flor', a: 2.70, r: 0.0200, h: 0.0285, s: 0.88, tilt: 0.40 },
    { kind: 'flor', a: 4.55, r: 0.0190, h: 0.0310, s: 0.90, tilt: 0.32 },
    { kind: 'flor', a: 1.55, r: 0.0330, h: 0.0185, s: 0.82, tilt: 0.80 },
    { kind: 'flor', a: 3.65, r: 0.0345, h: 0.0165, s: 0.84, tilt: 0.86 },
    { kind: 'flor', a: 5.55, r: 0.0320, h: 0.0200, s: 0.78, tilt: 0.74 },
    { kind: 'flor', a: 2.15, r: 0.0265, h: 0.0245, s: 0.74, tilt: 0.56 },
    { kind: 'botao', a: 4.95, r: 0.0235, h: 0.0235, s: 0.72, tilt: 0.34 },
    { kind: 'botao', a: 0.20, r: 0.0315, h: 0.0145, s: 0.62, tilt: 0.78 },
    { kind: 'botao', a: 3.10, r: 0.0255, h: 0.0135, s: 0.56, tilt: 0.95 },
    { kind: 'botao', a: 6.05, r: 0.0165, h: 0.0345, s: 0.52, tilt: 0.22 },
    { kind: 'botao', a: 1.05, r: 0.0345, h: 0.0105, s: 0.46, tilt: 1.10 },
  ];
  spec.forEach((sp, i) => {
    const end = new V3(Math.cos(sp.a) * sp.r, sp.h, Math.sin(sp.a) * sp.r);
    if (sp.r > 0.0001 || sp.h > 0.02) {
      const ped = new THREE.CatmullRomCurve3([
        new V3(0, 0, 0),
        new V3(end.x * 0.35, sp.h * 0.55, end.z * 0.35),
        new V3(end.x * 0.8, sp.h * 0.88, end.z * 0.8),
        end.clone(),
      ]);
      panicle.add(sweptTube(ped, (u) => 0.0016 * (1 - 0.40 * u), 20, 10, mats.folhagem, 'pedicelo-' + (i + 1)));
    }
    const holder = new THREE.Group();
    holder.name = (sp.kind === 'flor' ? 'flor-' : 'botao-') + (i + 1);
    holder.position.copy(end);
    holder.rotation.z = sp.tilt;
    holder.rotation.y = sp.a + 0.4;
    panicle.add(holder);
    if (sp.kind === 'flor') {
      const b = blossom(mats, sp.s, i * 1.7 + 0.3);
      holder.add(b.group);
      heads.push({ holder, pivots: b.pivots, phase: i * 0.55, delay: i * 0.28 });
    } else {
      holder.add(bud(mats, sp.s, i * 2.3));
      heads.push({ holder, pivots: [], phase: i * 0.8, delay: 0 });
    }
  });
  return { group: g, heads };
}

/* ---------- montagem ---------- */

function noShadow(root, names) {
  root.traverse((o) => {
    if (o.isMesh && names.some((n) => o.name.startsWith(n))) o.castShadow = false;
  });
}

export function buildPhloxMark() {
  const mats = materials();
  const root = new THREE.Group();
  root.name = 'PhloxMark';
  root.add(medallion(mats));
  const pl = plant(mats);
  pl.group.position.y = 0.0155 + 0.0072;
  root.add(pl.group);

  noShadow(root, ['filamento', 'antera', 'pistilo', 'estigma', 'tubo-corola']);

  const rest = pl.heads.map(h => ({
    h, rx: h.holder.rotation.x, rz: h.holder.rotation.z,
    pz: h.pivots.map(p => p.rotation.z),
  }));

  function update(t) {
    // desabrochar (0→1, escalonado por flor)
    rest.forEach((r) => {
      const b = clamp((t - 0.4 - r.h.delay) / 3.0, 0, 1);
      const e = 1 - Math.pow(1 - b, 3);
      r.h.pivots.forEach((p, k) => {
        p.rotation.z = mix(-1.42, r.pz[k], e);
        p.scale.setScalar(mix(0.72, 1, e));
      });
      // respiração + aceno
      const br = Math.sin(t * 0.9 + r.h.phase) * 0.035 * e;
      r.h.holder.rotation.z = r.rz + br;
      r.h.holder.rotation.x = r.rx + Math.cos(t * 0.72 + r.h.phase * 1.3) * 0.045 * e;
    });
    // balanço do conjunto
    pl.group.rotation.z = Math.sin(t * 0.52) * 0.017 + Math.sin(t * 0.19) * 0.008;
    pl.group.rotation.x = Math.cos(t * 0.41 + 1.1) * 0.014;
  }

  return { object: root, update };
}
