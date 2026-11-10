import * as THREE from 'three';

/** Deterministic PRNG so the world layout is identical every load. */
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
/** Cached toon-ish standard material. */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
  delete m.unique;
  if (!opts.unique) matCache.set(key, m);
  return m;
}

export function neonMat(color, intensity = 2) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

export function mesh(geo, material, { x = 0, y = 0, z = 0, cast = true, receive = true, rx = 0, ry = 0, rz = 0, s } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s !== undefined) (typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(s[0], s[1], s[2]));
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

/** Canvas-text texture for signs. */
export function textTexture(lines, { w = 512, h = 128, bg = null, color = '#fff', stroke = '#000', font = 'Lilita One', size = 72, border = null, radius = 24 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    roundRect(g, 4, 4, w - 8, h - 8, radius); g.fill();
    if (border) { g.lineWidth = 8; g.strokeStyle = border; g.stroke(); }
  }
  const arr = Array.isArray(lines) ? lines : [lines];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  arr.forEach((ln, i) => {
    const sz = i === 0 ? size : size * 0.55;
    g.font = `${sz}px "${font}", "Arial Black", sans-serif`;
    const y = h / 2 + (i - (arr.length - 1) / 2) * size * 0.85 + (arr.length > 1 && i === 0 ? -6 : 0);
    if (stroke) { g.lineWidth = sz / 6; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(ln, w / 2, y); }
    g.fillStyle = color; g.fillText(ln, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** A flat billboard-free sign plane (double-sided). */
export function signPlane(tex, width, height, emissive = false) {
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.FrontSide, roughness: 0.6,
    emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive ? 1.2 : 0 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(width, height), m);
  return p;
}

export function damp(a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); }
export function angleDamp(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** Tiny event bus. */
export class Events {
  constructor() { this.map = new Map(); }
  on(n, fn) { if (!this.map.has(n)) this.map.set(n, new Set()); this.map.get(n).add(fn); }
  emit(n, data) { const s = this.map.get(n); if (s) for (const fn of s) fn(data); }
}

/** Egg profile for LatheGeometry. */
export function eggGeometry(radius = 0.5, height = 1.3, seg = 24) {
  const pts = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI;
    const y = -Math.cos(th) * height * 0.5;
    const r = Math.sin(th) * radius * (1 + 0.14 * Math.cos(th));
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.translate(0, height * 0.5, 0);
  return g;
}

const eggTexCache = new Map();
/** Spotted / striped egg shell texture. */
export function eggTexture(base, spot, pattern = 'spots') {
  const key = base + '_' + spot + pattern;
  if (eggTexCache.has(key)) return eggTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + new THREE.Color(base).getHexString(); g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#' + new THREE.Color(spot).getHexString();
  const rnd = mulberry32(base ^ spot);
  if (pattern === 'stripes') {
    for (let i = 0; i < 3; i++) {
      const y = 35 + i * 28;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 256 * Math.PI * 6) * 6);
      g.lineWidth = 9; g.strokeStyle = g.fillStyle; g.stroke();
    }
  } else {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 256, y = 14 + rnd() * 100, r = 4 + rnd() * 10;
      g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill();
      if (x < 20) { g.beginPath(); g.ellipse(x + 256, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  eggTexCache.set(key, t);
  return t;
}
