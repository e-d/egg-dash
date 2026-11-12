import * as THREE from 'three';
import { Avatar, rbox } from './avatar.js';
import { mulberry32 } from '../util.js';

/*
 * Themed land Guardians. Each is a regular `Avatar` (same root/body/head/animate API)
 * dressed for its land. Geometries, materials and textures are cached per theme so
 * 25 guardians only cost a handful of GPU resources.
 */

// ---------------------------------------------------------------- caches
const GEO = new Map();
const geo = (key, fn) => GEO.get(key) || (GEO.set(key, fn()), GEO.get(key));
const MAT = new Map();
const matc = (key, fn) => MAT.get(key) || (MAT.set(key, fn()), MAT.get(key));
const TEX = new Map();
const texc = (key, fn) => TEX.get(key) || (TEX.set(key, fn()), TEX.get(key));
const FACES = new Map();

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }); }
function glowMat(color, intensity, base = 0x111111) {
  return new THREE.MeshStandardMaterial({ color: base, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const hex = (c) => '#' + new THREE.Color(c).getHexString();

/** Slight per-guardian variation of a base colour. */
function tint(color, k, amt = 1) {
  const c = new THREE.Color(color);
  const v = [[0, 0, 0], [0.015, 0.02, -0.05], [-0.02, -0.04, 0.05], [0.03, 0.05, -0.02]][k % 4];
  c.offsetHSL(v[0] * amt, v[1] * amt, v[2] * amt);
  return c.getHex();
}

// ---------------------------------------------------------------- textures
const barkTex = () => texc('bark', () => canvasTex(64, 64, (g) => {
  g.fillStyle = '#7a5130'; g.fillRect(0, 0, 64, 64);
  const r = mulberry32(7);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = r() < 0.5 ? '#5a3a20' : '#8f6540';
    const x = r() * 64, w = 1.5 + r() * 3;
    g.fillRect(x, 0, w, 64);
  }
  g.fillStyle = '#4a2e18';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(r() * 64, r() * 64, 3, 5, 0, 0, 7); g.fill(); }
}));

const bandageTex = () => texc('bandage', () => canvasTex(64, 64, (g) => {
  g.fillStyle = '#e9dfc4'; g.fillRect(0, 0, 64, 64);
  const r = mulberry32(3);
  for (let y = 0; y < 64; y += 9) {
    g.strokeStyle = '#a8977a'; g.lineWidth = 2;
    g.beginPath(); const o = (r() - 0.5) * 6; g.moveTo(0, y + o); g.lineTo(64, y + 4 - o); g.stroke();
    g.fillStyle = 'rgba(160,140,100,0.25)'; g.fillRect(0, y + 2, 64, 3);
  }
  g.fillStyle = 'rgba(120,100,70,0.35)';
  for (let i = 0; i < 6; i++) g.fillRect(r() * 64, r() * 64, 6, 2);
}));

const nemesTex = () => texc('nemes', () => canvasTex(64, 64, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2346b8' : '#f3c13a'; g.fillRect(0, i * 8, 64, 8); }
}));

const plaidTex = () => texc('plaid', () => canvasTex(64, 64, (g) => {
  g.fillStyle = '#c83a2c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(40,10,10,0.45)';
  for (let i = 0; i < 64; i += 16) { g.fillRect(i, 0, 6, 64); g.fillRect(0, i, 64, 6); }
  g.fillStyle = 'rgba(255,230,200,0.25)';
  for (let i = 8; i < 64; i += 16) { g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2); }
}));

function crackDraw(g, glowOnly) {
  const r = mulberry32(11);
  if (!glowOnly) {
    g.fillStyle = '#3a2b26'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? '#2a1f1b' : '#4a3a33'; g.fillRect(r() * 64, r() * 64, 3, 3); }
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); }
  const r2 = mulberry32(5);
  g.strokeStyle = glowOnly ? '#ffffff' : '#ff8a2a'; g.lineWidth = 2.2; g.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    g.beginPath(); let x = r2() * 64, y = r2() * 64; g.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (r2() - 0.5) * 30; y += (r2() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
}
const rockTex = () => texc('rock', () => canvasTex(64, 64, (g) => crackDraw(g, false)));
const rockGlowTex = () => texc('rockGlow', () => canvasTex(64, 64, (g) => crackDraw(g, true)));

function starDraw(g, glowOnly) {
  g.fillStyle = glowOnly ? '#000' : '#3d1878'; g.fillRect(0, 0, 64, 64);
  if (!glowOnly) {
    const grd = g.createLinearGradient(0, 0, 64, 64);
    grd.addColorStop(0, 'rgba(90,40,170,0.6)'); grd.addColorStop(1, 'rgba(20,10,60,0.6)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }
  const r = mulberry32(21);
  for (let i = 0; i < 16; i++) {
    const x = r() * 64, y = r() * 64, s = r() < 0.2 ? 2.2 : 1.1;
    g.fillStyle = r() < 0.3 ? '#ffe9a8' : '#ffffff';
    g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
  }
}
const starTex = () => texc('star', () => canvasTex(64, 64, (g) => starDraw(g, false)));
const starGlowTex = () => texc('starGlow', () => canvasTex(64, 64, (g) => starDraw(g, true)));

// ---------------------------------------------------------------- faces
/*
 * spec: { shape: round|beady|slit|almond|visor|hollow, eye, glow?, glowI?, patch?, band?, mouth, eyeY?, brow? }
 * states: normal | angry | tired | sleep
 */
function drawFace(g, spec, state, glowOnly) {
  const eyeY = spec.eyeY ?? 60;
  const glow = spec.glow && state !== 'sleep';
  const eyeCol = glowOnly ? '#fff' : (glow ? (state === 'angry' && spec.angryGlow ? spec.angryGlow : spec.glow) : spec.eye || '#1b1b1b');
  const dimCol = spec.sleepEye || (spec.glow ? '#3a3a4a' : spec.eye || '#1b1b1b');
  const browCol = spec.brow || '#1b1b1b';
  const ex = spec.eyeX ?? 22; // half distance between eyes

  if (!glowOnly) {
    if (spec.patch) { g.fillStyle = spec.patch; g.beginPath(); g.ellipse(64, 70, 54, 50, 0, 0, 7); g.fill(); }
    if (spec.jaw) { g.fillStyle = spec.jaw; g.beginPath(); g.ellipse(64, 112, 60, 34, 0, 0, 7); g.fill(); }
    if (spec.band) { g.fillStyle = spec.band; g.fillRect(4, eyeY - 14, 120, 28); }
    if (spec.shape === 'visor') {
      g.fillStyle = '#0d1219'; roundRect(g, 6, eyeY - 20, 116, 40, 14); g.fill();
      g.strokeStyle = '#5b6672'; g.lineWidth = 3; g.stroke();
    }
  }
  g.lineCap = 'round';
  const L = 64 - ex, R = 64 + ex;

  if (state === 'sleep') {
    if (glowOnly) return;
    g.strokeStyle = dimCol; g.lineWidth = spec.shape === 'almond' ? 6 : 5;
    if (spec.shape === 'visor') {
      g.beginPath(); g.moveTo(L - 12, eyeY); g.lineTo(L + 12, eyeY); g.moveTo(R - 12, eyeY); g.lineTo(R + 12, eyeY); g.stroke();
    } else {
      const w = spec.shape === 'almond' ? 15 : 10;
      for (const x of [L, R]) { g.beginPath(); g.arc(x, eyeY - 2, w, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    }
  } else {
    g.fillStyle = eyeCol;
    for (const [x, side] of [[L, -1], [R, 1]]) {
      g.save();
      if (state === 'tired') { // half-closed: clip the top of the eye
        g.beginPath(); g.rect(0, eyeY - 1, 128, 60); g.clip();
      }
      g.beginPath();
      switch (spec.shape) {
        case 'beady': g.arc(x, eyeY, 6, 0, 7); break;
        case 'slit': g.ellipse(x, eyeY, 11, 5, 0, 0, 7); break;
        case 'almond': g.ellipse(x, eyeY, 15, 24, side * -0.55, 0, 7); break;
        case 'visor': roundRect(g, x - 15, eyeY - 8, 30, 16, 7); break;
        case 'hollow': g.ellipse(x, eyeY, 8, 8, 0, 0, 7); break;
        default: g.ellipse(x, eyeY, 7, 9, 0, 0, 7);
      }
      g.fill();
      if (!glowOnly && !glow && (spec.shape === 'almond' || spec.shape === 'round')) {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x + (spec.shape === 'almond' ? 3 * -side : 2), eyeY - (spec.shape === 'almond' ? 8 : 3), spec.shape === 'almond' ? 4 : 2.5, 0, 7); g.fill();
        g.fillStyle = eyeCol;
      }
      g.restore();
    }
    if (state === 'tired' && !glowOnly) {
      g.strokeStyle = browCol; g.lineWidth = 4;
      g.beginPath(); g.moveTo(L - 12, eyeY - 2); g.lineTo(L + 12, eyeY - 2); g.moveTo(R - 12, eyeY - 2); g.lineTo(R + 12, eyeY - 2); g.stroke();
    }
    if (state === 'angry') { // slanted brows cut into the eyes
      const by = eyeY - (spec.shape === 'almond' ? 20 : 12);
      g.save();
      if (glowOnly) g.globalCompositeOperation = 'destination-out';
      g.strokeStyle = glowOnly ? '#000' : browCol; g.lineWidth = 8;
      g.beginPath(); g.moveTo(L - 14, by - 6); g.lineTo(L + 13, by + 5); g.moveTo(R + 14, by - 6); g.lineTo(R - 13, by + 5); g.stroke();
      g.restore();
    }
  }

  // mouth
  const my = spec.mouthY ?? 96;
  const mouth = spec.mouth || 'line';
  if (glowOnly) {
    if (spec.mouthGlow && state !== 'sleep') {
      g.strokeStyle = '#fff'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(40, my); for (let i = 1; i <= 6; i++) g.lineTo(40 + i * 8, my + (i % 2 ? -5 : 4) - (state === 'angry' ? 0 : 0)); g.stroke();
    }
    return;
  }
  const mc = spec.mouthCol || '#1b1b1b';
  if (state === 'sleep') {
    if (mouth === 'none') return;
    g.fillStyle = mc; g.beginPath(); g.ellipse(64, my, 5, 6, 0, 0, 7); g.fill();
    return;
  }
  g.strokeStyle = mc; g.fillStyle = mc; g.lineWidth = 6;
  switch (mouth) {
    case 'none': break;
    case 'jag':
      g.strokeStyle = spec.mouthGlow ? spec.glow : mc; g.lineWidth = 5;
      g.beginPath(); g.moveTo(40, my); for (let i = 1; i <= 6; i++) g.lineTo(40 + i * 8, my + (i % 2 ? -5 : 4)); g.stroke();
      break;
    case 'teeth': {
      const h = state === 'angry' ? 20 : 12;
      g.fillStyle = '#2a0f14'; roundRect(g, 30, my - h / 2, 68, h, 6); g.fill();
      g.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(32 + i * 11, my - h / 2); g.lineTo(43 + i * 11, my - h / 2); g.lineTo(37.5 + i * 11, my - h / 2 + 8); g.fill(); }
      if (state === 'angry') for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(37 + i * 11, my + h / 2); g.lineTo(48 + i * 11, my + h / 2); g.lineTo(42.5 + i * 11, my + h / 2 - 7); g.fill(); }
      break;
    }
    case 'fangs':
      g.beginPath(); state === 'angry' ? g.arc(64, my + 14, 20, 1.2 * Math.PI, 1.8 * Math.PI) : (g.moveTo(44, my), g.lineTo(84, my)); g.stroke();
      g.fillStyle = '#fff';
      for (const x of [50, 78]) { g.beginPath(); g.moveTo(x - 5, my + (state === 'angry' ? -4 : 2)); g.lineTo(x + 5, my + (state === 'angry' ? -4 : 2)); g.lineTo(x, my + 12); g.fill(); }
      break;
    case 'stache':
      g.fillStyle = '#5a3a1e';
      g.beginPath(); g.ellipse(52, my - 10, 15, 7, 0.25, 0, 7); g.fill();
      g.beginPath(); g.ellipse(76, my - 10, 15, 7, -0.25, 0, 7); g.fill();
      g.strokeStyle = mc; g.lineWidth = 5;
      g.beginPath(); state === 'angry' ? g.arc(64, my + 12, 12, 1.2 * Math.PI, 1.8 * Math.PI) : (g.moveTo(56, my + 4), g.lineTo(72, my + 4)); g.stroke();
      break;
    case 'small':
      g.lineWidth = 4; g.beginPath();
      state === 'angry' ? g.arc(64, my + 8, 9, 1.2 * Math.PI, 1.8 * Math.PI) : (g.moveTo(58, my), g.lineTo(70, my));
      g.stroke();
      break;
    default:
      g.beginPath();
      if (state === 'angry') g.arc(64, my + 16, 20, 1.2 * Math.PI, 1.8 * Math.PI);
      else if (state === 'tired') { g.moveTo(48, my); g.quadraticCurveTo(56, my - 5, 64, my); g.quadraticCurveTo(72, my + 5, 80, my); }
      else { g.moveTo(48, my); g.lineTo(80, my); }
      g.stroke();
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function facesFor(theme, spec) {
  if (FACES.has(theme)) return FACES.get(theme);
  const out = {};
  for (const st of ['normal', 'angry', 'tired', 'sleep']) {
    const map = canvasTex(128, 128, (g) => drawFace(g, spec, st, false));
    const o = { map, transparent: true, roughness: 0.8, depthWrite: true };
    if (spec.glow) {
      o.emissive = 0xffffff;
      o.emissiveMap = st === 'sleep' ? null : canvasTex(128, 128, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); drawFace(g, spec, st, true); });
      o.emissiveIntensity = st === 'sleep' ? 0 : (spec.glowI ?? 1.5) * (st === 'tired' ? 0.6 : 1);
      // the emissive map is white where features glow; colour comes from the albedo via emissive=white × map
    }
    const m = new THREE.MeshStandardMaterial(o);
    if (spec.glow && st !== 'sleep') m.emissive = new THREE.Color(st === 'angry' && spec.angryGlow ? spec.angryGlow : spec.glow);
    out[st] = m;
  }
  FACES.set(theme, out);
  return out;
}

// ---------------------------------------------------------------- helpers
function add(parent, g, m, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s, cast = true } = {}) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (s !== undefined) (typeof s === 'number' ? o.scale.setScalar(s) : o.scale.set(s[0], s[1], s[2]));
  o.castShadow = cast; o.receiveShadow = true;
  parent.add(o);
  return o;
}
const cyl = (rt, rb, h, seg = 10) => geo(`cyl${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const cone = (r, h, seg = 8) => geo(`cone${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const box = (w, h, d) => geo(`box${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const ico = (r, d = 0) => geo(`ico${r}_${d}`, () => new THREE.IcosahedronGeometry(r, d));
const sph = (r, ws = 12, hs = 8) => geo(`sph${r}_${ws}`, () => new THREE.SphereGeometry(r, ws, hs));

/** Item held in the right hand; returns a group already parented to the arm. */
function handItem(av, rx = 0.25) {
  const g = new THREE.Group();
  g.position.set(0, -0.72, 0.05);
  g.rotation.x = rx;
  av.armR.add(g);
  return g;
}

/** Fin shape (shark dorsal / tail), extruded thinly. */
function finGeo(key, w, h) {
  return geo(key, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.quadraticCurveTo(-w * 0.1, h * 0.55, w * 0.25, h); s.quadraticCurveTo(w * 0.2, h * 0.4, w / 2, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -0.045);
    return g;
  });
}

// ---------------------------------------------------------------- themes
const THEMES = {
  forest: {
    scale: 0.9,
    face: { shape: 'hollow', glow: '#c8ff5a', glowI: 1.3, mouth: 'jag', mouthCol: '#2a170a', patch: '#4a2f18', brow: '#2a170a' },
    colors: (k) => {
      const bark = matc('forest_bark' + k, () => std(tint(0xffffff, k, 0.6), { map: barkTex(), roughness: 0.95 }));
      return { skin: bark, shirt: bark, pants: bark, shoes: matc('forest_root', () => std(0x3e2814, { roughness: 0.95 })) };
    },
    build(av, k) {
      const leaf = matc('forest_leaf' + k, () => std(tint(0x3f9a3a, k), { flatShading: true, roughness: 0.85 }));
      const leaf2 = matc('forest_leaf2' + k, () => std(tint(0x2c7a2e, k), { flatShading: true, roughness: 0.85 }));
      const moss = matc('forest_moss', () => std(0x6db33f, { flatShading: true, roughness: 1 }));
      // leafy canopy head
      add(av.head, ico(0.62), leaf, { y: 0.62, s: [1.15, 0.85, 1.05] });
      add(av.head, ico(0.42), leaf2, { x: -0.42, y: 0.42, z: -0.08 });
      add(av.head, ico(0.4), leaf2, { x: 0.44, y: 0.5, z: 0.06 });
      add(av.head, ico(0.3), leaf, { y: 0.95, z: -0.15 });
      // mossy shoulders
      for (const arm of [av.armL, av.armR]) add(arm, ico(0.32), moss, { y: 0.02, s: [1, 0.55, 1] });
      add(av.body, box(0.6, 0.18, 0.6), moss, { y: 1.95, s: [1, 1, 0.95] });
      // twig sprouting from shoulder
      const wood = matc('forest_wood', () => std(0x5a3a1e, { roughness: 0.9 }));
      add(av.armL, cyl(0.04, 0.06, 0.5, 5), wood, { x: -0.08, y: 0.35, rz: 0.4 });
      // wooden club
      const club = handItem(av, 1.0);
      add(club, cyl(0.2, 0.09, 1.3, 7), wood, { y: 0.45 });
      add(club, ico(0.16), moss, { y: 0.95, z: 0.12, s: [1, 0.6, 1] });
    },
  },

  desert: {
    scale: 0.86,
    face: { shape: 'slit', glow: '#ffcf3a', glowI: 1.6, band: '#2b1d12', mouth: 'none', eyeY: 58 },
    colors: (k) => {
      const bandage = matc('desert_band' + k, () => std(tint(0xffffff, k, 0.5), { map: bandageTex(), roughness: 0.95 }));
      return { skin: bandage, shirt: bandage, pants: bandage, shoes: matc('desert_shoe', () => std(0xb8a27c, { roughness: 0.95 })) };
    },
    build(av) {
      const nemes = matc('desert_nemes', () => std(0xffffff, { map: nemesTex(), roughness: 0.5, metalness: 0.2 }));
      const gold = matc('desert_gold', () => std(0xf2c23a, { metalness: 0.8, roughness: 0.3 }));
      const blue = matc('desert_lapis', () => std(0x2346b8, { roughness: 0.4, metalness: 0.2 }));
      // pharaoh headdress (nemes)
      add(av.head, rbox(0.96, 0.32, 0.9, 0.1), nemes, { y: 0.3 });
      add(av.head, box(0.98, 0.95, 0.16), nemes, { y: -0.12, z: -0.44 });
      add(av.head, box(0.22, 0.85, 0.2), nemes, { x: -0.46, y: -0.3, z: 0.18, rz: 0.08 });
      add(av.head, box(0.22, 0.85, 0.2), nemes, { x: 0.46, y: -0.3, z: 0.18, rz: -0.08 });
      add(av.head, cone(0.07, 0.24, 6), gold, { y: 0.5, z: 0.45 }); // uraeus
      // collar
      add(av.body, cyl(0.6, 0.62, 0.12, 16), gold, { y: 1.88, s: [1, 1, 0.6] });
      add(av.body, box(0.64, 0.1, 0.05), blue, { y: 1.76, z: 0.29 });
      add(av.body, box(1.06, 0.12, 0.58), gold, { y: 0.98 }); // belt
      // staff with ankh head
      const st = handItem(av, 0.15);
      add(st, cyl(0.05, 0.05, 2.5, 8), gold, { y: 0.35 });
      add(st, geo('ankh', () => new THREE.TorusGeometry(0.14, 0.045, 6, 12)), blue, { y: 1.75 });
      add(st, box(0.42, 0.08, 0.08), blue, { y: 1.58 });
    },
  },

  farm: {
    scale: 0.86,
    face: { shape: 'round', mouth: 'stache', eyeY: 56, mouthY: 94 },
    colors: (k) => ({
      skin: [0xffd3a8, 0xc68642, 0x8d5524, 0xf1c27d][k % 4],
      shirt: matc('farm_plaid' + k, () => std(tint(0xffffff, k, 0.6), { map: plaidTex(), roughness: 0.85 })),
      pants: 0x3b6fb6, shoes: 0x5a3a1e,
    }),
    build(av) {
      const denim = matc('farm_denim', () => std(0x3b6fb6, { roughness: 0.85 }));
      const straw = matc('farm_straw', () => std(0xe8c463, { roughness: 0.9 }));
      const band = matc('farm_band', () => std(0xc83a2c));
      const brass = matc('farm_brass', () => std(0xe2b544, { metalness: 0.7, roughness: 0.35 }));
      const wood = matc('farm_wood', () => std(0x9a6a3a, { roughness: 0.85 }));
      const steel = matc('farm_steel', () => std(0x9aa4ae, { metalness: 0.8, roughness: 0.35 }));
      // overalls
      add(av.body, box(1.07, 0.34, 0.6), denim, { y: 1.08 });
      add(av.body, box(0.66, 0.52, 0.05), denim, { y: 1.45, z: 0.28 });
      for (const x of [-0.27, 0.27]) {
        add(av.body, box(0.13, 0.42, 0.05), denim, { x, y: 1.72, z: 0.28 });
        add(av.body, cyl(0.045, 0.045, 0.03, 8), brass, { x, y: 1.62, z: 0.31, rx: Math.PI / 2 });
      }
      // straw hat
      add(av.head, cyl(0.9, 0.9, 0.06, 18), straw, { y: 0.42 });
      add(av.head, cyl(0.42, 0.48, 0.34, 14), straw, { y: 0.6 });
      add(av.head, cyl(0.49, 0.49, 0.09, 14), band, { y: 0.48 });
      // pitchfork
      const pf = handItem(av, 0.15);
      add(pf, cyl(0.05, 0.05, 2.4, 6), wood, { y: 0.4 });
      add(pf, box(0.46, 0.06, 0.06), steel, { y: 1.62 });
      for (const x of [-0.2, 0, 0.2]) add(pf, cone(0.035, 0.5, 5), steel, { x, y: 1.9 });
    },
  },

  ice: {
    scale: 0.98,
    face: { shape: 'beady', mouth: 'fangs', patch: '#a9d4f5', eyeY: 56, brow: '#3a5a7a', mouthCol: '#22334a' },
    colors: (k) => {
      const fur = matc('ice_fur' + k, () => std(tint(0xc9d6e4, k, 0.5), { roughness: 1 }));
      return { skin: fur, shirt: fur, pants: fur, shoes: matc('ice_feet', () => std(0x9fc4e2, { roughness: 0.8 })) };
    },
    build(av, k) {
      const fur = matc('ice_fur' + k, () => std(tint(0xc9d6e4, k, 0.5), { roughness: 1 }));
      const ice = matc('ice_horn', () => std(0xbff0ff, { roughness: 0.15, metalness: 0.1, emissive: 0x3aa8ff, emissiveIntensity: 0.25 }));
      av.torso.scale.set(1.15, 1.05, 1.2);
      av.torso.userData.baseScale = av.torso.scale.clone();
      for (const arm of [av.armL, av.armR]) arm.scale.setScalar(1.15);
      av.armL.position.x = -0.82; av.armR.position.x = 0.82;
      av.headMesh.scale.set(1.08, 1.05, 1.05);
      av.face.position.z = 0.405 * 1.05 + 0.004;
      av.face.scale.set(1.05, 1.05, 1);
      // icicle horns
      add(av.head, cone(0.13, 0.62, 6), ice, { x: -0.36, y: 0.6, rz: 0.55 });
      add(av.head, cone(0.13, 0.62, 6), ice, { x: 0.36, y: 0.6, rz: -0.55 });
      // shaggy fur tufts
      add(av.head, ico(0.28), fur, { y: 0.42, z: 0.05, s: [1.3, 0.6, 1.1] });
      for (const arm of [av.armL, av.armR]) add(arm, ico(0.32), fur, { y: 0.05, s: [1.1, 0.8, 1.1] });
      add(av.body, ico(0.36), fur, { y: 0.98, z: 0.12, s: [1.6, 0.6, 1.1] });
      // icicles dripping off the forearms
      for (const arm of [av.armL, av.armR]) add(arm, cone(0.06, 0.3, 5), ice, { y: -0.98, z: 0.1, rx: Math.PI });
    },
  },

  fire: {
    scale: 0.95,
    face: { shape: 'slit', glow: '#ffb02e', angryGlow: '#ff5a1a', glowI: 1.8, mouth: 'jag', mouthGlow: true, eyeX: 21, brow: '#1b120f' },
    colors: () => {
      const rock = matc('fire_rock', () => std(0xffffff, { map: rockTex(), emissive: 0xff5a00, emissiveMap: rockGlowTex(), emissiveIntensity: 1.3, roughness: 0.95 }));
      return { skin: rock, shirt: rock, pants: rock, shoes: matc('fire_dark', () => std(0x231a17, { roughness: 1 })) };
    },
    build(av) {
      const rock = matc('fire_rock', () => null);
      const dark = matc('fire_dark', () => std(0x231a17, { roughness: 1 }));
      const flameO = matc('fire_flameO', () => glowMat(0xff5a00, 1.6, 0xff6a00));
      const flameY = matc('fire_flameY', () => glowMat(0xffb020, 1.4, 0xffc23a));
      for (const h of av.parts.hands) h.scale.set(1.3, 1.1, 1.3);
      av.headMesh.scale.set(1.04, 0.95, 1);
      // boulder shoulders
      for (const arm of [av.armL, av.armR]) add(arm, geo('dodeca', () => new THREE.DodecahedronGeometry(0.34, 0)), dark, { y: 0.06, s: [1, 0.8, 1] });
      add(av.body, geo('dodeca', () => new THREE.DodecahedronGeometry(0.34, 0)), rock, { y: 1.95, z: -0.2, s: [1.5, 0.6, 0.9] });
      // flame crest
      const crest = new THREE.Group();
      crest.position.y = 0.38;
      av.head.add(crest);
      const f1 = add(crest, cone(0.24, 0.8, 7), flameO, { y: 0.38, cast: false });
      const f2 = add(crest, cone(0.17, 0.55, 7), flameO, { x: -0.25, y: 0.26, z: -0.05, rz: 0.35, cast: false });
      const f3 = add(crest, cone(0.17, 0.55, 7), flameO, { x: 0.25, y: 0.26, z: -0.05, rz: -0.35, cast: false });
      const f4 = add(crest, cone(0.13, 0.45, 7), flameY, { y: 0.24, z: 0.12, cast: false });
      const flames = [f1, f2, f3, f4];
      const base = flames.map((f) => f.scale.y);
      av.onAnimate((dt, { t, sleep, alert }) => {
        const size = 1 - sleep * 0.6 + alert * 0.15;
        flames.forEach((f, i) => {
          f.scale.set(size, size * (base[i] + Math.sin(t * (11 + i * 3) + i) * 0.14), size);
        });
      });
    },
  },

  ocean: {
    scale: 0.88,
    face: { shape: 'beady', mouth: 'teeth', jaw: '#dfe9ef', eyeY: 50, eyeX: 26, mouthY: 92, brow: '#2a3a48' },
    colors: (k) => {
      const shark = matc('ocean_shark' + k, () => std(tint(0x6a8aa4, k), { roughness: 0.5 }));
      return { skin: shark, shirt: shark, pants: 0x1f3a63, shoes: 0x16263f };
    },
    build(av, k) {
      const shark = matc('ocean_shark' + k, () => std(tint(0x6a8aa4, k), { roughness: 0.5 }));
      const belly = matc('ocean_belly', () => std(0xd2dfe8, { roughness: 0.6 }));
      const gold = matc('ocean_gold', () => std(0xf2c23a, { metalness: 0.8, roughness: 0.3 }));
      const navy = matc('ocean_navy', () => std(0x1f3a63, { roughness: 0.7 }));
      // white belly + navy sash
      add(av.body, rbox(0.66, 0.74, 0.06, 0.03), belly, { y: 1.4, z: 0.27 });
      add(av.body, box(1.07, 0.16, 0.6), navy, { y: 1.0 });
      add(av.body, cyl(0.08, 0.08, 0.04, 10), gold, { y: 1.0, z: 0.31, rx: Math.PI / 2 });
      // dorsal fin on the head, smaller one on the back
      add(av.head, finGeo('dorsal', 0.6, 0.62), shark, { y: 0.36, z: -0.05, ry: Math.PI / 2 });
      add(av.body, finGeo('dorsal2', 0.42, 0.42), shark, { y: 1.55, z: -0.28, ry: Math.PI / 2, rx: -1.2 });
      // side fins on the arms
      // trident
      const tr = handItem(av, 0.15);
      add(tr, cyl(0.05, 0.05, 2.5, 8), gold, { y: 0.35 });
      add(tr, box(0.5, 0.07, 0.07), gold, { y: 1.62 });
      add(tr, cone(0.06, 0.38, 6), gold, { y: 1.95 });
      add(tr, cone(0.05, 0.3, 6), gold, { x: -0.22, y: 1.8 });
      add(tr, cone(0.05, 0.3, 6), gold, { x: 0.22, y: 1.8 });
    },
  },

  dino: {
    scale: 1.0,
    face: { shape: 'round', mouth: 'none', eyeY: 30, eyeX: 24, brow: '#173d16' },
    colors: (k) => {
      const green = matc('dino_green' + k, () => std(tint(0x4caf50, k), { roughness: 0.7 }));
      return { skin: green, shirt: green, pants: green, shoes: matc('dino_claw', () => std(0x2f6b31, { roughness: 0.7 })) };
    },
    build(av, k) {
      const green = matc('dino_green' + k, () => std(tint(0x4caf50, k), { roughness: 0.7 }));
      const belly = matc('dino_belly', () => std(0xe3e48a, { roughness: 0.75 }));
      const spike = matc('dino_spike', () => std(0xff8a3d, { roughness: 0.6 }));
      const tooth = matc('dino_tooth', () => std(0xfdfbf0, { roughness: 0.5 }));
      const mouth = matc('dino_mouth', () => std(0x7a1f2a, { roughness: 0.8 }));
      // tiny T-rex arms
      for (const arm of [av.armL, av.armR]) { arm.scale.setScalar(0.62); arm.position.y = 1.7; }
      av.armL.position.x = -0.6; av.armR.position.x = 0.6;
      add(av.body, rbox(0.7, 0.8, 0.06, 0.03), belly, { y: 1.35, z: 0.27 });
      // snout + chomping jaw
      add(av.head, rbox(0.74, 0.34, 0.56, 0.1), green, { y: -0.06, z: 0.54 });
      add(av.head, box(0.62, 0.05, 0.4), mouth, { y: -0.24, z: 0.56 });
      for (const x of [-0.27, -0.09, 0.09, 0.27]) add(av.head, cone(0.045, 0.14, 4), tooth, { x, y: -0.28, z: 0.76, rx: Math.PI });
      const jaw = new THREE.Group();
      jaw.position.set(0, -0.27, 0.32);
      av.head.add(jaw);
      add(jaw, rbox(0.66, 0.14, 0.48, 0.05), green, { y: -0.04, z: 0.22 });
      // back spikes
      for (const [y, z, s] of [[0.42, -0.05, 1], [0.3, -0.36, 0.9]]) add(av.head, cone(0.12, 0.32, 4), spike, { y, z, rx: -0.5, s });
      for (const [y, s] of [[1.75, 1], [1.4, 1.1], [1.05, 0.9]]) add(av.body, cone(0.13, 0.36, 4), spike, { y, z: -0.32, rx: -1.25, s });
      // tail
      const tail = new THREE.Group();
      tail.position.set(0, 1.0, -0.25);
      av.body.add(tail);
      add(tail, cone(0.32, 1.4, 8), green, { z: -0.62, rx: -Math.PI / 2 + 0.25 });
      av.onAnimate((dt, { t, sleep, alert, moving }) => {
        jaw.rotation.x = (0.15 + alert * (0.35 + Math.max(0, Math.sin(t * 12)) * 0.3)) * (1 - sleep) + sleep * 0.05;
        tail.rotation.y = Math.sin(t * (2 + moving * 8)) * (0.25 + moving * 0.2) * (1 - sleep * 0.8);
        tail.rotation.x = sleep * 0.35;
      });
    },
  },

  cosmic: {
    scale: 0.88,
    face: { shape: 'slit', glow: '#f0b8ff', glowI: 2.0, mouth: 'none', eyeY: 58, eyeX: 20, brow: '#0a0414' },
    colors: () => {
      const robe = matc('cosmic_robe', () => std(0xffffff, { map: starTex(), emissive: 0xffffff, emissiveMap: starGlowTex(), emissiveIntensity: 0.7, roughness: 0.7 }));
      return { skin: matc('cosmic_void', () => std(0x140a26, { roughness: 0.9 })), shirt: robe, pants: robe, shoes: 0x1a0b2e };
    },
    build(av, k) {
      const robe = matc('cosmic_robe', () => null);
      const voidM = matc('cosmic_void', () => null);
      const star = matc('cosmic_star', () => glowMat(0xfff0a8, 1.1, 0x6a5a30));
      const orb = matc('cosmic_orb' + (k % 2), () => glowMat(k % 2 ? 0x7cf2ff : 0xd36bff, 1.2, 0x221133));
      const gold = matc('cosmic_gold', () => std(0xd9b04a, { metalness: 0.8, roughness: 0.35 }));
      // robe skirt over the legs (legs hidden: the wizard glides)
      for (const m of [...av.parts.legs, ...av.parts.shoes]) m.visible = false;
      add(av.body, cyl(0.6, 0.86, 1.0, 14), robe, { y: 0.55 });
      // hood framing the void face + pointy wizard hat
      add(av.head, box(1.0, 0.92, 0.12), robe, { y: 0.0, z: -0.46 });
      add(av.head, box(0.1, 0.92, 0.88), robe, { x: -0.48 });
      add(av.head, box(0.1, 0.92, 0.88), robe, { x: 0.48 });
      add(av.head, cyl(0.82, 0.82, 0.06, 18), robe, { y: 0.44 });
      add(av.head, cone(0.52, 1.15, 12), robe, { y: 1.0, z: -0.05, rx: -0.18 });
      add(av.head, ico(0.1), star, { y: 1.55, z: -0.2, cast: false });
      // staff with glowing orb
      const st = handItem(av, 0.15);
      add(st, cyl(0.045, 0.06, 2.4, 6), gold, { y: 0.35 });
      add(st, ico(0.2, 1), orb, { y: 1.68, cast: false });
      // orbiting stars
      const ring = new THREE.Group();
      ring.position.y = 2.5;
      av.body.add(ring);
      const stars = [0, 1, 2].map((i) => add(ring, geo('octa', () => new THREE.OctahedronGeometry(0.12, 0)), star, { cast: false }));
      const off = k * 1.3;
      av.onAnimate((dt, { t, sleep, alert }) => {
        const sp = (1.4 + alert * 2) * (1 - sleep * 0.75);
        stars.forEach((s, i) => {
          const a = t * sp + off + (i * Math.PI * 2) / 3;
          s.position.set(Math.cos(a) * 0.95, Math.sin(a * 2 + i) * 0.18 - sleep * 0.5, Math.sin(a) * 0.95);
          s.rotation.y = t * 3;
        });
      });
    },
  },

  future: {
    scale: 0.88,
    face: { shape: 'visor', glow: '#4ff3ff', angryGlow: '#ff3838', glowI: 1.8, mouth: 'none', eyeY: 54, sleepEye: '#2a6a78' },
    colors: () => {
      const chrome = matc('future_chrome', () => std(0xc9d3de, { metalness: 0.85, roughness: 0.25 }));
      return { skin: chrome, shirt: chrome, pants: matc('future_joint', () => std(0x3a414c, { metalness: 0.6, roughness: 0.4 })), shoes: 0x22272e };
    },
    build(av, k) {
      const chrome = matc('future_chrome', () => null);
      const dark = matc('future_joint', () => null);
      const cyan = matc('future_cyan', () => glowMat(0x4ff3ff, 1.4, 0x0b2a30));
      // antenna with blinking bulb (bulb material per guardian so each blinks independently)
      add(av.head, cyl(0.025, 0.025, 0.5, 6), dark, { y: 0.62 });
      const bulbM = glowMat(0xff3838, 1.2, 0x330808);
      add(av.head, sph(0.09), bulbM, { y: 0.9, cast: false });
      // ear bolts
      add(av.head, cyl(0.12, 0.12, 0.1, 10), dark, { x: -0.44, rz: Math.PI / 2 });
      add(av.head, cyl(0.12, 0.12, 0.1, 10), dark, { x: 0.44, rz: Math.PI / 2 });
      // chest panel + light strip
      add(av.body, rbox(0.6, 0.42, 0.06, 0.03), dark, { y: 1.5, z: 0.27 });
      add(av.body, box(0.4, 0.07, 0.03), cyan, { y: 1.55, z: 0.31, cast: false });
      add(av.body, box(0.24, 0.07, 0.03), cyan, { y: 1.42, z: 0.31, cast: false });
      // shoulder pads + jetpack
      for (const arm of [av.armL, av.armR]) add(arm, rbox(0.5, 0.18, 0.54, 0.06), dark, { y: 0.06 });
      add(av.body, rbox(0.64, 0.66, 0.24, 0.06), dark, { y: 1.45, z: -0.38 });
      for (const x of [-0.18, 0.18]) add(av.body, cyl(0.1, 0.13, 0.22, 10), chrome, { x, y: 1.04, z: -0.38 });
      const off = k * 0.7;
      av.onAnimate((dt, { t, sleep, alert }) => {
        const on = sleep > 0.5 ? 0.15 : (Math.sin((t + off) * (alert > 0.5 ? 16 : 4)) > 0 ? 1.4 : 0.25);
        bulbM.emissiveIntensity = on;
      });
    },
  },

  alien: {
    scale: 0.84,
    face: { shape: 'almond', mouth: 'small', eyeY: 56, eyeX: 25, mouthY: 100, brow: '#1b3a14', sleepEye: '#1b1b1b' },
    colors: (k) => {
      const skin = matc('alien_skin' + k, () => std(k % 2 ? tint(0xb7c3cc, k) : tint(0x8ee86a, k), { roughness: 0.55 }));
      return { skin, shirt: matc('alien_suit', () => std(0x6d4fe0, { roughness: 0.45, metalness: 0.3 })), pants: matc('alien_suit', () => null), shoes: matc('alien_silver', () => std(0xb4bcc6, { metalness: 0.7, roughness: 0.35 })) };
    },
    build(av, k) {
      const skin = matc('alien_skin' + k, () => null);
      const silver = matc('alien_silver', () => null);
      const tip = matc('alien_tip', () => glowMat(0x7dff6a, 1.1, 0x123312));
      // big head
      av.headMesh.scale.set(1.4, 1.22, 1.2);
      av.face.scale.set(1.35, 1.22, 1);
      av.face.position.z = 0.405 * 1.2 + 0.002;
      av.head.position.y += 0.12;
      // antennae
      for (const sx of [-1, 1]) {
        add(av.head, cyl(0.025, 0.03, 0.55, 5), skin, { x: 0.28 * sx, y: 0.7, rz: -0.35 * sx });
        add(av.head, sph(0.09), tip, { x: 0.38 * sx, y: 0.97, cast: false });
      }
      // collar ring
      add(av.body, cyl(0.5, 0.56, 0.1, 16), silver, { y: 1.95 });
      // ray gun
      const gun = handItem(av, Math.PI / 2);
      add(gun, box(0.12, 0.12, 0.3), silver, { y: 0.0, z: 0.05, rx: -Math.PI / 2 });
      add(gun, cyl(0.07, 0.11, 0.5, 10), silver, { y: 0.32 });
      add(gun, cyl(0.12, 0.12, 0.06, 10), tip, { y: 0.6, cast: false });
    },
  },
};

export const GUARDIAN_THEMES = Object.keys(THEMES);

/**
 * Create a themed Guardian for a land.
 * @param {string} landId one of GUARDIAN_THEMES ('forest', 'desert', ... 'alien'); unknown ids fall back to 'forest'
 * @param {number} k guardian index within the land (0–3), used for small colour variations
 * @returns {Avatar}
 */
export function createGuardian(landId, k = 0) {
  const theme = THEMES[landId] ? landId : 'forest';
  const T = THEMES[theme];
  const c = T.colors(k);
  const av = new Avatar({ kind: 'guardian', ...c, scale: T.scale, faces: facesFor(theme, T.face) });
  av.theme = theme;
  T.build(av, k);
  // keep Zzz above tall headgear
  av.zBaseY = { forest: 0.5, farm: 0.25, cosmic: 0.8, ice: 0.3, fire: 0.5, alien: 0.4 }[theme] || 0;
  return av;
}
