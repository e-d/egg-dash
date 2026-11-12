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
const hex = (c) => '#' + new THREE.Color(c).getHexString();

/** Draw `fn` three times so shapes crossing the left/right seam wrap seamlessly around the egg. */
function wrapped(g, seed, fn) {
  for (const ox of [-256, 0, 256]) {
    g.save(); g.translate(ox, 0);
    fn(mulberry32(seed));
    g.restore();
  }
}

function star(g, x, y, r, points = 5, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

const EGG_PATTERNS = {
  spots(g, rnd) {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 256, y = 14 + rnd() * 100, r = 4 + rnd() * 10;
      g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2); g.fill();
    }
  },
  stripes(g) {
    for (let i = 0; i < 3; i++) {
      const y = 35 + i * 28;
      g.beginPath();
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 256 * Math.PI * 6) * 6);
      g.lineWidth = 9; g.strokeStyle = g.fillStyle; g.stroke();
    }
  },
  leaves(g, rnd, c) {
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * 256 + rnd() * 10, y = 22 + rnd() * 84, len = 16 + rnd() * 10, a = rnd() * Math.PI * 2;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = i % 3 ? c.spot : c.spot2;
      g.beginPath(); g.moveTo(-len, 0);
      g.quadraticCurveTo(0, -len * 0.55, len, 0); g.quadraticCurveTo(0, len * 0.55, -len, 0); g.fill();
      g.strokeStyle = c.light; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-len * 0.85, 0); g.lineTo(len * 0.85, 0); g.stroke();
      g.restore();
    }
  },
  zigzag(g, rnd, c) {
    const rows = [[34, 10, 7], [64, 14, 10], [94, 10, 7]];
    rows.forEach(([y, amp, w], r) => {
      g.beginPath();
      for (let x = 0, k = 0; x <= 256; x += 16, k++) g.lineTo(x, y + (k % 2 ? amp : -amp));
      g.lineWidth = w; g.lineJoin = 'miter'; g.strokeStyle = r === 1 ? c.spot : c.spot2; g.stroke();
    });
    g.fillStyle = c.spot;
    for (let x = 8; x < 256; x += 16) for (const y of [49, 79]) { g.beginPath(); g.arc(x, y, 2.8, 0, Math.PI * 2); g.fill(); }
  },
  crystals(g, rnd, c) {
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * 256 + rnd() * 8, top = i % 2 === 0;
      const h = 26 + rnd() * 26, w = 7 + rnd() * 6;
      const y0 = top ? 6 : 122, dir = top ? 1 : -1;
      g.fillStyle = c.spot;
      g.beginPath(); g.moveTo(x - w, y0); g.lineTo(x - w * 0.8, y0 + dir * h * 0.7); g.lineTo(x, y0 + dir * h); g.lineTo(x + w * 0.8, y0 + dir * h * 0.7); g.lineTo(x + w, y0); g.closePath(); g.fill();
      g.fillStyle = c.light;
      g.beginPath(); g.moveTo(x - w * 0.3, y0); g.lineTo(x - w * 0.2, y0 + dir * h * 0.65); g.lineTo(x, y0 + dir * h * 0.92); g.lineTo(x, y0); g.closePath(); g.fill();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) star(g, rnd() * 256, 40 + rnd() * 48, 2.5 + rnd() * 3, 4, 0.3);
  },
  flames(g, rnd, c) {
    const flame = (x, base, h, w, col) => {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x - w, base);
      g.bezierCurveTo(x - w, base - h * 0.5, x - w * 0.2, base - h * 0.6, x, base - h);
      g.bezierCurveTo(x + w * 0.4, base - h * 0.55, x + w, base - h * 0.45, x + w, base);
      g.closePath(); g.fill();
    };
    for (let i = 0; i < 11; i++) {
      const x = (i / 11) * 256 + rnd() * 8, h = 46 + rnd() * 40, w = 13 + rnd() * 5;
      flame(x, 128, h, w, c.spot);
      flame(x + 1, 128, h * 0.62, w * 0.6, c.hot);
      flame(x + 1, 128, h * 0.3, w * 0.3, c.hot2);
    }
    g.fillStyle = c.hot;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(rnd() * 256, 10 + rnd() * 34, 1.5 + rnd() * 2, 0, Math.PI * 2); g.fill(); }
  },
  waves(g, rnd, c) {
    for (let r = 0; r < 4; r++) {
      const y = 28 + r * 24, ph = r * 1.3;
      g.beginPath();
      for (let x = 0; x <= 256; x += 4) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 8 + ph) * 6);
      g.lineTo(256, y + 14); g.lineTo(0, y + 14); g.closePath();
      g.fillStyle = r % 2 ? c.spot : c.spot2; g.fill();
      g.beginPath();
      for (let x = 0; x <= 256; x += 4) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 8 + ph) * 6);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5; g.stroke();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(rnd() * 256, 8 + rnd() * 16, 1.5 + rnd() * 2.5, 0, Math.PI * 2); g.fill(); }
  },
  scales(g, rnd, c) {
    const r = 11;
    for (let row = 0, y = 4; y < 128 + r; row++, y += r * 0.95) {
      for (let x = (row % 2) * r; x < 256 + r; x += r * 2) {
        g.fillStyle = (row + Math.floor(x / r)) % 3 === 0 ? c.spot2 : c.spot;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI); g.closePath(); g.fill();
        g.strokeStyle = c.light; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, r - 1, 0.15, Math.PI - 0.15); g.stroke();
      }
    }
  },
  stars(g, rnd, c) {
    for (let i = 0; i < 6; i++) { // nebula clouds
      const x = (i / 6) * 256 + rnd() * 30, y = 20 + rnd() * 88, r = 22 + rnd() * 20;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, c.spotA); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = c.spot;
    for (let i = 0; i < 9; i++) star(g, (i / 9) * 256 + rnd() * 20, 18 + rnd() * 92, 6 + rnd() * 5);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) star(g, rnd() * 256, 18 + rnd() * 92, 4 + rnd() * 3);
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd() * 256, 10 + rnd() * 108, 0.8 + rnd() * 1.2, 0, Math.PI * 2); g.fill(); }
  },
  circuit(g, rnd, c) {
    g.strokeStyle = c.spot; g.fillStyle = c.spot; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      let x = Math.round(rnd() * 16) * 16, y = 16 + Math.round(rnd() * 6) * 16;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        if (k % 2 === 0) x += (rnd() < 0.5 ? -1 : 1) * (16 + Math.round(rnd() * 2) * 16);
        else { const d = (rnd() < 0.5 ? -1 : 1) * 16; x += d; y = Math.min(112, Math.max(16, y + d)); }
        g.lineTo(x, y);
      }
      g.stroke();
      g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.light; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); g.fillStyle = c.spot;
    }
    for (let i = 0; i < 4; i++) { // chips
      const x = rnd() * 230, y = 30 + rnd() * 60;
      g.fillRect(x, y, 22, 14);
      for (let k = 0; k < 4; k++) { g.fillRect(x + 2 + k * 5.5, y - 4, 2, 4); g.fillRect(x + 2 + k * 5.5, y + 14, 2, 4); }
    }
  },
  alien(g, rnd, c) {
    // slime drips from the top
    g.fillStyle = c.spot;
    g.fillRect(0, 0, 256, 10);
    for (let x = 0; x < 256; x += 18) {
      const h = 10 + rnd() * 22;
      g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 8 + h); g.arc(x + 5, 8 + h, 5, Math.PI, 0, true); g.lineTo(x + 10, 8); g.fill();
    }
    // eye-like cells
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * 256 + rnd() * 14, y = 48 + rnd() * 62, r = 7 + rnd() * 7;
      g.fillStyle = c.spot; g.beginPath(); g.ellipse(x, y, r * 1.2, r, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.light; g.beginPath(); g.ellipse(x, y, r * 0.65, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.spot; g.beginPath(); g.ellipse(x, y, r * 0.18, r * 0.45, 0, 0, Math.PI * 2); g.fill();
    }
  },
};

/** Gold ornate band + sparkles for Divine eggs. */
function divineOrnament(g, rnd) {
  const gold = '#ffd23f', goldDk = '#b8860b', goldLt = '#fff3b0';
  const y = 58, h = 16;
  g.fillStyle = goldDk; g.fillRect(0, y - 2, 256, h + 4);
  g.fillStyle = gold; g.fillRect(0, y, 256, h);
  g.fillStyle = goldLt; g.fillRect(0, y + 2, 256, 2);
  // scalloped trim above and below
  g.fillStyle = gold;
  for (let x = 0; x < 256; x += 16) {
    g.beginPath(); g.arc(x + 8, y - 2, 6, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(x + 8, y + h + 2, 6, 0, Math.PI); g.fill();
  }
  // gems along the band
  const gems = ['#ff3b6b', '#3bc8ff', '#ffffff', '#5aff8a'];
  for (let i = 0; i < 8; i++) {
    const x = 16 + i * 32, cy = y + h / 2;
    g.fillStyle = goldDk; g.beginPath(); g.moveTo(x, cy - 8); g.lineTo(x + 8, cy); g.lineTo(x, cy + 8); g.lineTo(x - 8, cy); g.closePath(); g.fill();
    g.fillStyle = gems[i % 4]; g.beginPath(); g.moveTo(x, cy - 6); g.lineTo(x + 6, cy); g.lineTo(x, cy + 6); g.lineTo(x - 6, cy); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x - 2, cy - 3, 2, 2);
  }
  // thin crown ring near the top
  g.fillStyle = gold; g.fillRect(0, 18, 256, 4);
  for (let x = 0; x < 256; x += 12) { g.beginPath(); g.arc(x + 6, 24, 2.2, 0, Math.PI * 2); g.fill(); }
  // sparkles
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) star(g, rnd() * 256, 28 + rnd() * 80, 3 + rnd() * 3.5, 4, 0.25);
}

/**
 * Egg shell texture (256x128, wraps horizontally around a lathe egg).
 * pattern: spots | stripes | leaves | zigzag | crystals | flames | waves | scales | stars | circuit | alien
 * divine: adds a gold ornate band, gems and sparkles over the land pattern.
 */
export function eggTexture(base, spot, pattern = 'spots', divine = false) {
  const key = `${base}_${spot}_${pattern}_${divine ? 1 : 0}`;
  if (eggTexCache.has(key)) return eggTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const B = new THREE.Color(base), Sp = new THREE.Color(spot);
  g.fillStyle = hex(base); g.fillRect(0, 0, 256, 128);
  if (pattern === 'stars' || pattern === 'circuit') { // subtle vertical gradient for the techy / cosmic eggs
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, hex(B.clone().lerp(new THREE.Color(0xffffff), 0.25)));
    gr.addColorStop(1, hex(B.clone().lerp(Sp, 0.3)));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  }
  const cols = {
    spot: hex(spot),
    spot2: hex(Sp.clone().lerp(B, 0.35)),
    spotA: `rgba(${Math.round(Sp.r * 255)},${Math.round(Sp.g * 255)},${Math.round(Sp.b * 255)},0.55)`,
    light: hex(B.clone().lerp(new THREE.Color(0xffffff), 0.5)),
    hot: '#ffb020', hot2: '#fff2a0',
  };
  const fn = EGG_PATTERNS[pattern] || EGG_PATTERNS.spots;
  const seed = (base ^ (spot * 31)) + pattern.length * 977;
  wrapped(g, seed, (rnd) => { g.fillStyle = cols.spot; g.strokeStyle = cols.spot; fn(g, rnd, cols); });
  if (divine) wrapped(g, seed + 7, (rnd) => divineOrnament(g, rnd));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  eggTexCache.set(key, t);
  return t;
}

const eggMatCache = new Map();
/**
 * Cached shell material for an egg definition from config:
 * a ZONES entry ({id, color, spot, pattern, dark?}) or a DIVINE_EGGS entry ({id, divine, color, spot, glow, pattern}).
 * Callers may .clone() it (e.g. for HUGE eggs).
 */
export function eggMaterial(def) {
  if (eggMatCache.has(def.id)) return eggMatCache.get(def.id);
  let m;
  if (def.divine) {
    // land pattern drawn in a deepened version of the land's glow colour, under the gold band
    const patCol = new THREE.Color(def.glow ?? def.spot).lerp(new THREE.Color(0x000000), 0.38).getHex();
    m = new THREE.MeshStandardMaterial({ map: eggTexture(def.color, patCol, def.pattern, true), roughness: 0.22, metalness: 0.45,
      emissive: def.glow ?? 0xffe08a, emissiveIntensity: 0.45 });
    m.emissiveMap = m.map; // glow follows the shell art so the pattern + gold band stay readable
  } else {
    m = new THREE.MeshStandardMaterial({ map: eggTexture(def.color, def.spot, def.pattern), roughness: 0.35, metalness: 0.05,
      emissive: def.color, emissiveIntensity: def.dark ? 0.4 : 0.12 });
    m.emissiveMap = m.map;
  }
  eggMatCache.set(def.id, m);
  return m;
}
