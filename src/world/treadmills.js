import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREADMILLS, formatNum } from '../config.js';
import { state } from '../state.js';
import { mat, mesh, neonMat, textTexture } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';

const LEN = 6.4, WID = 3.2, BELT_Y = 0.46;
export const TREADMILL_AREA = { x: -78, z: 0 };

// Tier bands (design escalates per band):
//  A  T1-4   natural   — themed skirts, bolts, motor hood + flywheel, analog console, bronze emblem
//  B  T5-8   metal     — + LED strips, floor underglow, chrome emblem
//  C  T9-12  gem       — + neon speed arch, gem studs on the skirts
//  D  T13-15 elemental — + arch, glowing skirt stripes (plus their elemental extras)
//  E  T16-20 neon/sci  — + rear thrusters with flames, rising energy rings, orbiting bits
const band = (def) => (def.tier <= 4 ? 0 : def.tier <= 8 ? 1 : def.tier <= 12 ? 2 : def.tier <= 15 ? 3 : 4);

const HOOD_X = LEN / 2 - 0.05;           // motor hood centre (sits inside the console blocker footprint)
const HOOD_TOP = 0.78;
const FLY_Z = WID / 2 + 0.2;
const FLY_Y = 0.56;
const _m4 = new THREE.Matrix4();
const BAR_N = 7;
const REAR_X = -LEN / 2;

// ── shared resources (built lazily once, reused by all 20 treadmills) ──────────
let S = null;
function shared() {
  if (S) return S;
  S = {};
  const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

  // side skirts (both sides in one geometry)
  S.skirt = mergeGeometries([box(LEN - 0.1, 0.27, 0.06, 0, 0.27, WID / 2 + 0.03), box(LEN - 0.1, 0.27, 0.06, 0, 0.27, -WID / 2 - 0.03)]);
  // LED strips just under the skirts
  S.led = mergeGeometries([box(LEN - 0.4, 0.045, 0.04, 0, 0.16, WID / 2 + 0.075), box(LEN - 0.4, 0.045, 0.04, 0, 0.16, -WID / 2 - 0.075)]);
  // motor hood + trim cap
  S.hood = new THREE.BoxGeometry(0.75, HOOD_TOP - 0.19, WID + 0.1).translate(HOOD_X, (HOOD_TOP + 0.19) / 2, 0);
  S.hoodTrim = mergeGeometries([
    box(0.8, 0.06, WID + 0.16, HOOD_X, HOOD_TOP + 0.01, 0),
    box(0.06, 0.1, WID + 0.16, HOOD_X - 0.39, HOOD_TOP - 0.06, 0),
  ]);
  // vent grille on the hood top: glowing plate with slats over it
  S.ventPlate = box(0.5, 0.02, 1.7, HOOD_X, HOOD_TOP + 0.045, 0);
  const slats = [];
  for (let k = 0; k < 5; k++) slats.push(box(0.045, 0.05, 1.76, HOOD_X - 0.2 + k * 0.1, HOOD_TOP + 0.07, 0));
  S.ventSlats = mergeGeometries(slats);
  // rear bumper / reflector
  S.rearBar = box(0.05, 0.1, WID - 0.5, REAR_X - 0.02, 0.33, 0);
  // flywheel (rim + spokes + hub) on both sides, spinning about the z axis through the origin
  const wheel = (sz) => {
    const parts = [new THREE.TorusGeometry(0.3, 0.055, 6, 22)];
    for (let k = 0; k < 3; k++) parts.push(new THREE.BoxGeometry(0.56, 0.06, 0.05).rotateZ((k * Math.PI) / 3));
    parts.push(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10).rotateX(Math.PI / 2).translate(0, 0, -Math.sign(sz) * 0.09));
    return mergeGeometries(parts.map((p) => p.toNonIndexed())).translate(0, 0, sz);
  };
  S.flywheel = mergeGeometries([wheel(FLY_Z), wheel(-FLY_Z)]);
  // bolts along the hood sides (decor)
  const bolts = [];
  for (const sz of [-1, 1]) for (const [bx, by] of [[-0.25, 0.3], [0.25, 0.3], [-0.25, 0.68], [0.25, 0.68]])
    bolts.push(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 6).rotateX(Math.PI / 2).translate(HOOD_X + bx, by, sz * (WID / 2 + 0.07)).toNonIndexed());
  S.bolts = mergeGeometries(bolts);
  // gem studs along the skirts
  const studs = [];
  for (const sz of [-1, 1]) for (let k = 0; k < 5; k++)
    studs.push(new THREE.OctahedronGeometry(0.1, 0).scale(1, 1, 0.5).translate(-2.4 + k * 1.2, 0.27, sz * (WID / 2 + 0.07)));
  S.studs = mergeGeometries(studs);
  // speed arch at the rear (entry) end — posts sit outside the belt
  const ax = REAR_X + 0.35, ar = WID / 2 + 0.14, postH = 1.45;
  S.arch = mergeGeometries([
    new THREE.CylinderGeometry(0.075, 0.075, postH, 8).translate(ax, 0.19 + postH / 2, ar).toNonIndexed(),
    new THREE.CylinderGeometry(0.075, 0.075, postH, 8).translate(ax, 0.19 + postH / 2, -ar).toNonIndexed(),
    new THREE.TorusGeometry(ar, 0.075, 8, 36, Math.PI).rotateY(Math.PI / 2).translate(ax, 0.19 + postH, 0).toNonIndexed(),
  ]);
  S.archFeet = mergeGeometries([box(0.34, 0.16, 0.34, ax, 0.27, ar), box(0.34, 0.16, 0.34, ax, 0.27, -ar)]);
  // chevron sign on top of the arch
  S.archBadge = new THREE.PlaneGeometry(0.9, 0.45);
  // thrusters at the rear corners, pointing -x (outside the belt width)
  const tz = WID / 2 + 0.38, tx = REAR_X - 0.05, ty = 0.5;
  const nozzle = (sz) => mergeGeometries([
    new THREE.CylinderGeometry(0.3, 0.2, 0.7, 12, 1, true).rotateZ(Math.PI / 2).translate(tx, ty, sz).toNonIndexed(),
    new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12).rotateZ(Math.PI / 2).translate(tx + 0.3, ty, sz).toNonIndexed(),
    box(0.5, 0.31, 0.18, tx + 0.15, 0.34, sz).toNonIndexed(),
  ]);
  S.nozzles = mergeGeometries([nozzle(tz), nozzle(-tz)]);
  S.nozzleRings = mergeGeometries([
    new THREE.TorusGeometry(0.21, 0.04, 6, 16).rotateY(Math.PI / 2).translate(tx - 0.36, ty, tz),
    new THREE.TorusGeometry(0.21, 0.04, 6, 16).rotateY(Math.PI / 2).translate(tx - 0.36, ty, -tz),
  ]);
  S.flame = new THREE.ConeGeometry(0.19, 1, 12, 1, true).translate(0, 0.5, 0).rotateZ(Math.PI / 2); // base at origin, tip at -x
  S.thrust = { x: tx - 0.38, y: ty, z: tz };
  // energy ring (horizontal ellipse around the belt)
  S.ring = new THREE.TorusGeometry(1, 0.022, 5, 56).rotateX(Math.PI / 2).scale(LEN / 2 + 0.2, 1, WID / 2 + 0.25);
  // underglow pad (additive soft rectangle on the floor around the deck)
  S.underglow = new THREE.PlaneGeometry(LEN + 1.9, WID + 1.9).rotateX(-Math.PI / 2);
  // console: screen, dial, needle, bars
  S.screen = new THREE.PlaneGeometry(2.7, 0.56);
  S.screenFrame = new THREE.PlaneGeometry(2.86, 0.68);
  S.dial = new THREE.CircleGeometry(0.22, 28);
  S.needle = new THREE.BoxGeometry(0.026, 0.19, 0.01).translate(0, 0.085, 0);
  S.bar = new THREE.BoxGeometry(0.11, 0.42, 0.02).translate(0, 0.21, 0);
  // emblem: hex coin body + two faces (one material group each)
  const body = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 6).toNonIndexed();
  const faceF = new THREE.PlaneGeometry(0.56, 0.56).translate(0, 0, 0.047).toNonIndexed();
  const faceB = new THREE.PlaneGeometry(0.56, 0.56).rotateY(Math.PI).translate(0, 0, -0.047).toNonIndexed();
  S.emblem = mergeGeometries([body, faceF, faceB], true);
  const bits = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    bits.push(new THREE.OctahedronGeometry(0.09, 0).translate(Math.cos(a) * 0.68, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.68));
  }
  S.bits = mergeGeometries(bits);

  // textures
  S.glowTex = rectGlowTexture();
  S.dialTex = dialTexture();
  S.stripeMask = skirtCanvas(null, true);
  S.chevTex = chevronBadgeTexture();
  // generic materials
  S.darkMetal = mat(0x14161c, { metalness: 0.85, roughness: 0.3 });
  S.glass = mat(0x05070d, { metalness: 0.5, roughness: 0.15 });
  S.bolt = mat(0xb8bec6, { metalness: 0.9, roughness: 0.35 });
  S.dialMat = new THREE.MeshBasicMaterial({ map: S.dialTex, toneMapped: true });
  return S;
}

function rectGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  // soft rounded-rect halo: bright right at the deck outline, fading outward
  const hw = 0.38, hh = 0.32; // deck half extents in uv (0..0.5 space)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = Math.abs((x + 0.5) / 128 - 0.5), v = Math.abs((y + 0.5) / 128 - 0.5);
    const dx = Math.max(0, u - hw), dy = Math.max(0, v - hh);
    const d = Math.hypot(dx, dy) / 0.12;
    const inside = u < hw && v < hh ? 0.55 : 1;
    const a = Math.max(0, 1 - d) ** 2 * inside;
    const i = (y * 128 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0f1a'; g.beginPath(); g.arc(64, 64, 63, 0, Math.PI * 2); g.fill();
  g.lineWidth = 5; g.strokeStyle = '#9aa7c0'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke();
  // ticks from -120° to +120° (green → yellow → red)
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 - 2.1 + (k / 12) * 4.2;
    const col = k < 7 ? '#5dff9a' : k < 10 ? '#ffd23d' : '#ff4a5a';
    g.strokeStyle = col; g.lineWidth = k % 3 === 0 ? 6 : 3;
    const r0 = k % 3 === 0 ? 38 : 44;
    g.beginPath(); g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); g.stroke();
  }
  g.fillStyle = '#e8eefc'; g.font = 'bold 18px "Arial Black", sans-serif'; g.textAlign = 'center';
  g.fillText('MPH', 64, 98);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function chevronBadgeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let k = 0; k < 3; k++) {
    const x0 = 22 + k * 30;
    g.beginPath(); g.moveTo(x0, 8); g.lineTo(x0 + 20, 32); g.lineTo(x0, 56); g.lineTo(x0 + 12, 56); g.lineTo(x0 + 32, 32); g.lineTo(x0 + 12, 8); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Skirt panel texture: themed base, tier-coloured racing stripe, bolts. mask=true → emissive mask (stripe only). */
function skirtCanvas(def, mask = false) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  if (mask) {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#fff'; g.fillRect(0, 27, 256, 4); g.fillRect(0, 35, 256, 2);
  } else {
    const fr = new THREE.Color(def.frame), acc = new THREE.Color(def.accent);
    const dark = fr.clone().multiplyScalar(0.62);
    g.fillStyle = '#' + dark.getHexString(); g.fillRect(0, 0, 256, 64);
    g.globalAlpha = 0.22;
    switch (def.rail) {
      case 'wood':
        g.strokeStyle = '#000'; g.lineWidth = 1.5;
        for (let k = 0; k < 9; k++) { g.beginPath(); const y = 4 + k * 7; g.moveTo(0, y); g.bezierCurveTo(80, y + 3, 170, y - 3, 256, y); g.stroke(); }
        g.fillStyle = '#000'; for (const x of [64, 192]) g.fillRect(x, 0, 2, 64);
        break;
      case 'stone':
        g.strokeStyle = '#000'; g.lineWidth = 3;
        for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) g.strokeRect(k * 56 + (r ? 28 : 0) - 28, r * 32 + 1, 56, 30);
        break;
      case 'bamboo':
        g.fillStyle = '#000'; for (let k = 0; k < 4; k++) g.fillRect(k * 64 + 30, 0, 4, 64);
        g.fillStyle = '#fff'; for (let k = 0; k < 4; k++) g.fillRect(k * 64 + 34, 0, 2, 64);
        break;
      case 'metal':
        g.fillStyle = '#fff'; for (let k = 0; k < 30; k++) g.fillRect(0, Math.random() * 64, 256, 1);
        break;
      default: // sci-fi panel lines
        g.strokeStyle = '#fff'; g.lineWidth = 1;
        for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 10, 12); g.lineTo(k * 32 + 10, 52); g.lineTo(k * 32, 64); g.stroke(); }
    }
    g.globalAlpha = 1;
    // racing stripe (main + pin line)
    g.fillStyle = '#' + acc.getHexString(); g.fillRect(0, 27, 256, 4); g.fillRect(0, 35, 256, 2);
    // bolts
    for (let k = 0; k < 8; k++) for (const y of [10, 54]) {
      const x = 16 + k * 32;
      g.fillStyle = '#20232a'; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9d0da'; g.beginPath(); g.arc(x - 0.6, y - 0.6, 3, 0, Math.PI * 2); g.fill();
    }
    // top/bottom edge highlight
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, 256, 2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 61, 256, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

function emblemTexture(def) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const acc = '#' + new THREE.Color(def.accent).getHexString();
  const fr = '#' + new THREE.Color(def.frame).multiplyScalar(0.55).getHexString();
  g.fillStyle = fr; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.strokeStyle = acc; g.beginPath(); g.arc(64, 64, 55, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${def.tier >= 10 ? 52 : 62}px "Lilita One", "Arial Black", sans-serif`;
  g.lineWidth = 8; g.strokeStyle = '#000a'; g.lineJoin = 'round';
  g.strokeText(String(def.tier), 64, 68);
  g.fillStyle = '#fff'; g.fillText(String(def.tier), 64, 68);
  // small stars on top for prestige
  const stars = Math.min(5, Math.floor((def.tier - 1) / 4) + 1);
  g.fillStyle = acc;
  for (let k = 0; k < stars; k++) { const x = 64 + (k - (stars - 1) / 2) * 13; g.beginPath(); g.arc(x, 24, 3.5, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beltTexture(def) {
  const W = 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const base = new THREE.Color(def.belt), acc = new THREE.Color(def.accent);
  const accHex = '#' + acc.getHexString();
  const glowy = def.glow > 1;
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, W, H);
  // rubber grain
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 300; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 1);
  if (def.cosmic) {
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, 'rgba(169,139,255,0.45)'); grd.addColorStop(0.5, 'rgba(255,92,240,0.3)'); grd.addColorStop(1, 'rgba(169,139,255,0.45)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }
  // cross slats
  g.fillStyle = glowy ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 16; i++) g.fillRect(i * 16, 0, 2, H);
  // edge lane lines
  g.fillStyle = glowy ? accHex : 'rgba(255,255,255,0.28)';
  g.fillRect(0, 10, W, 6); g.fillRect(0, H - 16, W, 6);
  // big chevrons pointing +u (the running direction, toward the console)
  g.fillStyle = glowy ? accHex : def.glow > 0 ? `rgba(${acc.r * 255 | 0},${acc.g * 255 | 0},${acc.b * 255 | 0},0.55)` : 'rgba(255,240,210,0.2)';
  const chev = (x0) => {
    g.beginPath();
    g.moveTo(x0, 52); g.lineTo(x0 + 56, H / 2); g.lineTo(x0, H - 52);
    g.lineTo(x0 + 26, H - 52); g.lineTo(x0 + 82, H / 2); g.lineTo(x0 + 26, 52);
    g.closePath(); g.fill();
  };
  chev(40); chev(168);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.anisotropy = 4;
  return t;
}

function makeSignTexture(def, owned) {
  const lines = owned
    ? [`T${def.tier} • ${def.name}`, `+${formatNum(def.speedPerSec)} ⚡ Speed /s`]
    : [`🔒 T${def.tier} • ${def.name}`, `$${formatNum(def.cost)}  —  +${formatNum(def.speedPerSec)} ⚡/s`];
  const acc = '#' + new THREE.Color(def.accent).getHexString();
  return textTexture(lines, { w: 640, h: 180, bg: owned ? 'rgba(14,20,40,0.82)' : 'rgba(60,14,24,0.85)', border: owned ? acc : '#ff5a6e', size: 56, stroke: '#000a' });
}

function setBar(bars, k, s) {
  _m4.makeScale(1, s, 1).setPosition(-0.55 + k * 0.2, -0.22, 0.01);
  bars.setMatrixAt(k, _m4);
}
function setBars(bars, s) {
  for (let k = 0; k < BAR_N; k++) setBar(bars, k, s);
  bars.instanceMatrix.needsUpdate = true;
}

/** remember a material's base emissive colour so it can be scaled (daynight owns emissiveIntensity). */
function pulsable(m) { m.userData.e0 = m.emissive.clone(); return m; }
function pulse(m, k) { m.emissive.copy(m.userData.e0).multiplyScalar(k); }

export class Treadmills {
  constructor({ scene, colliders, daynight }) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.daynight = daynight;
    this.time = 0;

    // training floor: rubber mat with lanes
    const floor = mesh(new THREE.BoxGeometry(76, 0.1, 74), mat(0x34405c, { roughness: 0.95 }), { x: TREADMILL_AREA.x, y: 0.05, z: 0, cast: false });
    this.group.add(floor);
    colliders.box(TREADMILL_AREA.x, 0, 76, 74, 0.1);
    const edge = mesh(new THREE.BoxGeometry(77, 0.14, 75), mat(0xe0a92a), { x: TREADMILL_AREA.x, y: 0.0, z: 0, cast: false });
    this.group.add(edge);
    // stripe lines between rows
    for (const z of [-18, 0, 18]) this.group.add(mesh(new THREE.PlaneGeometry(70, 0.3), mat(0x5d6d94), { x: TREADMILL_AREA.x, y: 0.11, z, rx: -Math.PI / 2, cast: false }));

    TREADMILLS.forEach((def, i) => {
      const row = Math.floor(i / 5), col = i % 5;
      const x = -54 - col * 12;
      const z = 27 - row * 18;
      const n0 = this.daynight.neon.length;
      this.list.push(this.build(def, x, z, colliders));
      // the glassy/neon top tiers bloom to white at night: keep their glow in check
      if (def.tier >= 13) for (const e of this.daynight.neon.slice(n0)) e.base *= 0.55;
    });
    this.refresh();
    state.on((w) => { if (w === 'treadmills' || w === 'reset') this.refresh(); });
  }

  build(def, x, z, colliders) {
    const R = shared();
    const B = band(def);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.group.add(g);
    const glowA = def.glow > 0;
    const metal = def.metal ?? 0;
    const frameMat = mat(def.frame, { metalness: metal, roughness: metal > 0.5 ? 0.3 : 0.8, flatShading: def.rail === 'stone' });
    const accMat = glowA ? neonMat(def.accent, Math.min(def.glow, 2.4)) : mat(def.accent, { metalness: metal * 0.8, roughness: 0.5 });
    if (glowA) this.daynight.registerNeon(accMat, true);
    const fx = { rev: 0 };

    // base pad
    const pad = mesh(new THREE.BoxGeometry(LEN + 2, 0.14, WID + 2), mat(0x232b40, { roughness: 0.9 }), { y: 0.12, cast: false });
    g.add(pad);
    const padTrim = mesh(new THREE.BoxGeometry(LEN + 2.3, 0.1, WID + 2.3), glowA ? accMat : mat(def.accent), { y: 0.09, cast: false });
    g.add(padTrim);

    // deck & side rails
    g.add(mesh(new THREE.BoxGeometry(LEN, 0.3, WID), frameMat, { y: 0.27 }));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(LEN, 0.18, 0.28), accMat, { y: 0.48, z: s * (WID / 2 - 0.1) }));
    // rear roller (the front one hides under the motor hood)
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, WID - 0.4, 12), frameMat, { x: -(LEN / 2 - 0.25), y: 0.38, rx: Math.PI / 2 }));

    // themed side skirts with racing stripe + bolts
    const skirtMat = new THREE.MeshStandardMaterial({ map: skirtCanvas(def), metalness: metal * 0.7, roughness: metal > 0.5 ? 0.35 : 0.8 });
    if (B >= 3) {
      skirtMat.emissive.set(def.accent); skirtMat.emissiveMap = R.stripeMask; skirtMat.emissiveIntensity = Math.min(1.6, def.glow * 0.55);
      this.daynight.registerNeon(skirtMat, true);
    }
    g.add(mesh(R.skirt, skirtMat, { cast: false }));
    const rearBarMat = glowA ? accMat : mat(0xff6a3a, { roughness: 0.3, metalness: 0.2 });
    g.add(mesh(R.rearBar, rearBarMat, { cast: false }));

    // belt
    const tex = beltTexture(def);
    const beltGlow = def.glow > 1;
    const beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0,
      emissive: beltGlow ? def.accent : 0x000000, emissiveMap: beltGlow ? tex : null, emissiveIntensity: beltGlow ? Math.min(1.5, def.glow * 0.4) : 0 });
    if (beltGlow) { this.daynight.registerNeon(beltMat, true); pulsable(beltMat); fx.beltMat = beltMat; }
    const belt = mesh(new THREE.BoxGeometry(LEN - 0.5, 0.06, WID - 0.5), beltMat, { y: BELT_Y - 0.03 });
    g.add(belt);

    // motor hood with vent grille, bolts and twin flywheels
    const hoodMat = B >= 4 ? R.darkMetal : frameMat;
    g.add(mesh(R.hood, hoodMat));
    g.add(mesh(R.hoodTrim, B >= 1 ? mat(0xd8dee6, { metalness: 1, roughness: 0.25 }) : accMat, { cast: false }));
    const ventMat = pulsable(neonMat(glowA ? def.accent : 0xff8a2a, glowA ? 1.3 : 0.6));
    this.daynight.registerNeon(ventMat, true);
    fx.ventMat = ventMat;
    g.add(mesh(R.ventPlate, ventMat, { cast: false }));
    g.add(mesh(R.ventSlats, B >= 1 ? R.darkMetal : frameMat, { cast: false }));
    g.add(mesh(R.bolts, R.bolt, { cast: false }));
    const flyMat = B === 0 ? mat(def.accent, { roughness: 0.6 }) : glowA && B >= 2 ? accMat : mat(0xcfd6de, { metalness: 1, roughness: 0.2 });
    const fly = mesh(R.flywheel, flyMat, { x: HOOD_X, y: FLY_Y, cast: false });
    g.add(fly);
    fx.fly = fly;

    // LED strips + floor underglow (metal tiers and up; natural tiers only glow while running)
    if (B >= 1) {
      const ledMat = pulsable(neonMat(def.accent, 0.9));
      this.daynight.registerNeon(ledMat, true);
      fx.ledMat = ledMat;
      g.add(mesh(R.led, ledMat, { cast: false }));
    }
    const ugMat = new THREE.MeshBasicMaterial({ map: R.glowTex, color: def.accent, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const ug = mesh(R.underglow, ugMat, { y: 0.2, cast: false, receive: false });
    ug.userData.noAO = true;
    ug.renderOrder = 2;
    g.add(ug);
    fx.ugMat = ugMat;
    fx.ugBase = B === 0 ? 0 : 0.16 + B * 0.04;

    // console end (+x)
    const cx = LEN / 2 - 0.15;
    const railH = 1.35;
    const addPost = (pz) => {
      switch (def.rail) {
        case 'wood':
          g.add(mesh(new THREE.BoxGeometry(0.28, 2.0, 0.28), frameMat, { x: cx, y: 1.3, z: pz }));
          g.add(mesh(new THREE.BoxGeometry(2.8, 0.18, 0.2), mat(def.accent), { x: cx - 1.3, y: railH, z: pz }));
          g.add(mesh(new THREE.BoxGeometry(0.2, railH - 0.4, 0.2), frameMat, { x: cx - 2.6, y: (railH + 0.4) / 2, z: pz }));
          break;
        case 'stone':
          g.add(mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), frameMat, { x: cx, y: 1.35, z: pz }));
          g.add(mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), mat(def.accent, { flatShading: true }), { x: cx, y: 2.5, z: pz }));
          break;
        case 'bamboo':
          for (const [px, h] of [[cx, 2.1], [cx - 2.6, railH]]) {
            g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, h, 8), frameMat, { x: px, y: h / 2 + 0.4, z: pz }));
            for (let k = 0.6; k < h; k += 0.55) g.add(mesh(new THREE.TorusGeometry(0.14, 0.035, 4, 10), mat(0x6f9a3a), { x: px, y: k + 0.4, z: pz, rx: Math.PI / 2 }));
          }
          g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.7, 8), frameMat, { x: cx - 1.3, y: railH + 0.4, z: pz, rz: Math.PI / 2 }));
          break;
        case 'crystal': {
          const crys = new THREE.MeshStandardMaterial({ color: def.frame, emissive: def.accent, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
          this.daynight.registerNeon(crys, true);
          g.add(mesh(new THREE.OctahedronGeometry(0.5, 0), crys, { x: cx, y: 1.5, z: pz, s: [0.7, 2.4, 0.7] }));
          g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 8), accMat, { x: cx - 1.3, y: railH, z: pz, rz: Math.PI / 2 }));
          break;
        }
        case 'neon':
          g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.1, 10), mat(0x111118, { metalness: 0.8, roughness: 0.3 }), { x: cx, y: 1.35, z: pz }));
          g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.7, 10), accMat, { x: cx - 1.3, y: railH, z: pz, rz: Math.PI / 2 }));
          g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), accMat, { x: cx - 2.65, y: railH - 0.45, z: pz }));
          break;
        case 'holo': {
          const holoMat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
          const panel = mesh(new THREE.PlaneGeometry(2.8, 0.9), holoMat, { x: cx - 1.3, y: railH - 0.1, z: pz, cast: false, receive: false });
          panel.userData.noAO = true;
          g.add(panel);
          g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), accMat, { x: cx - 1.3, y: railH + 0.35, z: pz, rz: Math.PI / 2 }));
          break;
        }
        case 'laser': {
          // floating emitters joined by laser beams
          const node = mesh(new THREE.OctahedronGeometry(0.18, 0), accMat, { x: cx, y: railH, z: pz });
          const node2 = node.clone(); node2.position.x = cx - 2.7;
          g.add(node, node2);
          const beamMat = neonMat(def.accent, 2.6);
          this.daynight.registerNeon(beamMat, true);
          g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6), beamMat, { x: cx - 1.35, y: railH, z: pz, rz: Math.PI / 2, cast: false }));
          g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, railH - 0.5, 6), beamMat, { x: cx, y: (railH + 0.5) / 2, z: pz, cast: false }));
          break;
        }
        default: // metal tubes
          g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.1, 12), frameMat, { x: cx, y: 1.35, z: pz }));
          g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 12), accMat, { x: cx - 1.3, y: railH, z: pz, rz: Math.PI / 2 }));
          g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), accMat, { x: cx - 2.65, y: railH, z: pz }));
      }
    };
    addPost(-WID / 2 + 0.15);
    addPost(WID / 2 - 0.15);

    // console head with a live dashboard (speed dial + level bars) facing the runner
    const consoleY = def.rail === 'stone' ? 2.6 : 2.25;
    const head = new THREE.Group();
    head.position.set(cx, consoleY, 0);
    const consoleMat = def.rail === 'holo' || def.rail === 'laser' ? R.darkMetal : frameMat;
    head.add(mesh(new THREE.BoxGeometry(0.5, 0.7, WID - 0.2), consoleMat, { rz: -0.35 }));
    const face = new THREE.Group();
    face.position.set(-0.3, -0.02, 0);
    face.rotation.set(0, -Math.PI / 2, 0);   // face the runner (-x)
    face.rotateX(-0.35);                      // tilt up to match the console
    head.add(face);
    const frameTrim = mesh(R.screenFrame, glowA ? accMat : mat(def.accent, { metalness: metal, roughness: 0.4 }), { z: -0.004, cast: false });
    face.add(frameTrim);
    face.add(mesh(R.screen, R.glass, { cast: false }));
    face.add(mesh(R.dial, R.dialMat, { x: -1.0, z: 0.006, cast: false }));
    const needleMat = neonMat(0xff3b4e, 1.6);
    this.daynight.registerNeon(needleMat, true);
    const needle = mesh(R.needle, needleMat, { x: -1.0, z: 0.012, cast: false });
    face.add(needle);
    fx.needle = needle;
    const barMat = pulsable(neonMat(glowA ? def.accent : 0x7dd3ff, 1.3));
    this.daynight.registerNeon(barMat, true);
    fx.barMat = barMat;
    const bars = new THREE.InstancedMesh(R.bar, barMat, BAR_N);
    bars.frustumCulled = false;
    face.add(bars);
    fx.bars = bars;
    setBars(bars, 0.06);
    g.add(head);

    // floating tier emblem (hex coin) above the console
    const emTex = emblemTexture(def);
    const coinMat = B === 0 ? new THREE.MeshStandardMaterial({ color: 0xc0803a, metalness: 0.8, roughness: 0.35 })
      : B === 1 ? new THREE.MeshStandardMaterial({ color: 0xe6ebf2, metalness: 1, roughness: 0.2 })
        : new THREE.MeshStandardMaterial({ color: def.frame, emissive: def.accent, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25 });
    if (B >= 2) { this.daynight.registerNeon(coinMat, true); pulsable(coinMat); }
    const faceMat = new THREE.MeshStandardMaterial({ map: emTex, transparent: true, alphaTest: 0.4, roughness: 0.4, metalness: 0.2,
      emissive: 0xffffff, emissiveMap: emTex, emissiveIntensity: 0.35 });
    this.daynight.registerNeon(faceMat, true);
    const emblem = new THREE.Group();
    emblem.position.set(cx + 0.05, consoleY + 1.0, 0);
    const coin = new THREE.Mesh(R.emblem, [coinMat, faceMat, faceMat]);
    emblem.add(coin);
    g.add(emblem);
    fx.emblem = emblem; fx.emblemY = emblem.position.y;
    fx.coinMat = coinMat; fx.faceMat = faceMat;
    fx.coinCol = coinMat.color.clone();

    // ── band extras ──
    if (B === 2) {
      const studMat = new THREE.MeshStandardMaterial({ color: def.gems ?? def.accent, emissive: def.gems ?? def.accent, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.1, flatShading: true });
      this.daynight.registerNeon(studMat, true);
      g.add(mesh(R.studs, studMat, { cast: false }));
    }
    if (B >= 2) {
      // neon speed arch over the entry end
      const archMat = neonMat(def.accent, Math.min(1.6, def.glow));
      this.daynight.registerNeon(archMat, true);
      g.add(mesh(R.arch, archMat, { cast: false }));
      g.add(mesh(R.archFeet, R.darkMetal, { cast: false }));
      const badgeMat = pulsable(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: def.accent, emissiveMap: R.chevTex, emissiveIntensity: 1.6,
        map: R.chevTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
      badgeMat.alphaMap = R.chevTex;
      this.daynight.registerNeon(badgeMat, true);
      const badge = mesh(R.archBadge, badgeMat, { x: REAR_X + 0.35, y: 0.19 + 1.45 + WID / 2 + 0.14 - 0.45, ry: -Math.PI / 2, rz: Math.PI / 2, cast: false });
      g.add(badge);
      fx.badgeMat = badgeMat;
    }
    if (B >= 4) {
      // rear thrusters with flickering flames
      g.add(mesh(R.nozzles, R.darkMetal));
      g.add(mesh(R.nozzleRings, accMat, { cast: false }));
      const flameMat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      fx.flames = [];
      for (const s of [-1, 1]) {
        const f = mesh(R.flame, flameMat, { x: R.thrust.x, y: R.thrust.y, z: s * R.thrust.z, cast: false, receive: false });
        f.userData.noAO = true;
        g.add(f);
        fx.flames.push(f);
      }
      fx.flameMat = flameMat;
      // rising energy rings around the belt
      fx.rings = []; fx.ringPh = Math.random();
      for (let k = 0; k < 3; k++) {
        const rm = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        const r = mesh(R.ring, rm, { cast: false, receive: false });
        r.userData.noAO = true;
        g.add(r);
        fx.rings.push(r);
      }
      // orbiting bits around the emblem
      const bitMat = neonMat(def.accent, 1.8);
      this.daynight.registerNeon(bitMat, true);
      const bits = mesh(R.bits, bitMat, { cast: false });
      emblem.add(bits);
      fx.bits = bits;
    }

    // ── tier-specific extras (kept from the original designs) ──
    const anim = [];
    if (def.gems) {
      const gemMat = new THREE.MeshStandardMaterial({ color: def.gems, emissive: def.gems, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.1, flatShading: true });
      this.daynight.registerNeon(gemMat, true);
      for (const s of [-1, 1]) {
        const gem = mesh(new THREE.OctahedronGeometry(0.28, 0), gemMat, { x: cx, y: consoleY + 0.65, z: s * 1.2 });
        g.add(gem);
        anim.push((t) => { gem.rotation.y = t * 1.5; gem.position.y = consoleY + 0.65 + Math.sin(t * 2 + s) * 0.08; });
      }
    }
    if (def.crystals || def.ice) {
      const cm = new THREE.MeshStandardMaterial({ color: def.ice ? 0xe8fbff : 0xbff0ff, emissive: def.accent, emissiveIntensity: 0.5, roughness: 0.05, transparent: true, opacity: 0.85, flatShading: true });
      this.daynight.registerNeon(cm, true);
      const cones = [];
      for (const [px, pz] of [[-LEN / 2 - 0.6, -WID / 2 - 0.75], [-LEN / 2 - 0.6, WID / 2 + 0.75], [LEN / 2 + 0.6, -WID / 2 - 0.6], [LEN / 2 + 0.6, WID / 2 + 0.6]]) {
        for (let k = 0; k < 3; k++) {
          const h = 0.8 + Math.random() * 1.2;
          const cg = new THREE.ConeGeometry(0.22, h, 5).rotateX((Math.random() - 0.5) * 0.5).rotateZ((Math.random() - 0.5) * 0.5)
            .translate(px + (Math.random() - 0.5) * 0.6, h / 2 + 0.1, pz + (Math.random() - 0.5) * 0.6);
          cones.push(cg.toNonIndexed());
        }
      }
      g.add(mesh(mergeGeometries(cones), cm));
    }
    if (def.lava) {
      const lavaMat = neonMat(0xff4a00, 2.2);
      this.daynight.registerNeon(lavaMat, true);
      const cracks = [];
      for (let k = 0; k < 6; k++) cracks.push(new THREE.BoxGeometry(0.6 + Math.random(), 0.05, 0.08).translate((Math.random() - 0.5) * (LEN - 1), 0.43, (Math.random() < 0.5 ? -1 : 1) * (WID / 2 + 0.065)));
      g.add(mesh(mergeGeometries(cracks), lavaMat, { cast: false }));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.DodecahedronGeometry(0.6, 0), mat(0x2a1210, { flatShading: true }), { x: -LEN / 2 - 0.5, y: 0.4, z: s * (WID / 2 + 0.5) }));
        g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), lavaMat, { x: -LEN / 2 - 0.5, y: 0.85, z: s * (WID / 2 + 0.5), cast: false }));
      }
    }
    if (def.holo) {
      const ringMat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < 3; k++) {
        const ring = mesh(new THREE.TorusGeometry(1.0 + k * 0.25, 0.03, 6, 40), ringMat, { x: 0, y: 3.6 + k * 0.35, cast: false, receive: false });
        ring.userData.noAO = true;
        g.add(ring);
        anim.push((t) => { ring.rotation.x = Math.PI / 2 + Math.sin(t + k) * 0.3; ring.rotation.z = t * (0.6 + k * 0.3); });
      }
    }
    if (def.laser) {
      // scanning laser sheet across the belt
      const scan = mesh(new THREE.PlaneGeometry(WID - 0.4, 1.8), new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }), { y: 1.4, cast: false, receive: false, ry: Math.PI / 2 });
      scan.userData.noAO = true;
      g.add(scan);
      anim.push((t) => { scan.position.x = Math.sin(t * 2.2) * (LEN / 2 - 0.4); });
      const pyMat = neonMat(def.accent, 2.2);
      this.daynight.registerNeon(pyMat, true);
      const px = -LEN / 2 - 0.75, pz = WID / 2 + 0.75;
      g.add(mesh(mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.25, 3.2, 0.25).translate(px, 1.6, s * pz))), R.darkMetal));
      g.add(mesh(mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.08, 2.8, 0.27).translate(px, 1.6, s * pz))), pyMat, { cast: false }));
    }
    if (def.cosmic) {
      const planets = [0xa98bff, 0xff5cf0, 0x6cf2ff, 0xffd166];
      planets.forEach((c, k) => {
        const pm = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4, roughness: 0.3 });
        this.daynight.registerNeon(pm, true);
        const p = mesh(new THREE.SphereGeometry(0.22 + k * 0.05, 16, 12), pm, { cast: false });
        g.add(p);
        const r = 3.4 + k * 0.4, sp = 0.6 + k * 0.25;
        anim.push((t) => { p.position.set(Math.cos(t * sp + k * 1.6) * r, 2.4 + Math.sin(t * sp * 1.3 + k) * 0.8, Math.sin(t * sp + k * 1.6) * r * 0.6); });
      });
      const halo = makeGlowSprite(def.accent, 6, 0.3);
      halo.position.set(0, 2.4, 0);
      g.add(halo);
    }
    if (def.glow >= 2.5) {
      const glow = makeGlowSprite(def.accent, 9, 0.14);
      glow.position.y = 1.2;
      g.add(glow);
    }
    for (const a of anim) a(0);

    // walkable pad + deck + console blocker
    colliders.box(x, z, LEN + 2, WID + 2, 0.19);
    colliders.box(x, z, LEN, WID, BELT_Y);
    colliders.box(x + LEN / 2 - 0.1, z, 0.6, WID, 2.6, { noWalk: true });

    // floating sign + lock icon
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSignTexture(def, false), transparent: true, depthWrite: false }));
    sign.scale.set(5.2, 1.46, 1);
    sign.position.set(0, 4.3, 0);
    sign.userData.noAO = true;
    g.add(sign);

    return { def, tier: def.tier, group: g, x, z, tex, beltMat, sign, anim, owned: null, speed: 0.15, fx, band: B };
  }

  refresh() {
    for (const t of this.list) {
      const owned = !!state.data.treadmills[t.tier - 1];
      if (owned === t.owned) continue;
      t.owned = owned;
      t.sign.material.map?.dispose();
      t.sign.material.map = makeSignTexture(t.def, owned);
      t.sign.material.needsUpdate = true;
      t.beltMat.color.setScalar(owned ? 1 : 0.45);
      // locked: tarnished emblem, dark dashboard/vents/LEDs, no flames
      const fx = t.fx;
      fx.coinMat.color.copy(fx.coinCol).multiplyScalar(owned ? 1 : 0.3);
      fx.faceMat.color.setScalar(owned ? 1 : 0.35);
      fx.faceMat.emissive.setScalar(owned ? 1 : 0);
      if (fx.coinMat.userData.e0) pulse(fx.coinMat, owned ? 1 : 0.15);
      if (fx.flames) for (const f of fx.flames) f.visible = owned;
      this.applyRev(t, 0, 0);
    }
  }

  /** Drive all the "rev" visuals from a 0..1 intensity. */
  applyRev(tm, a, t) {
    const fx = tm.fx;
    const own = tm.owned ? 1 : 0;
    const lit = own ? 1 + a * 1.1 : 0.15;
    pulse(fx.ventMat, own ? 0.8 + a * 0.9 + a * 0.25 * Math.sin(t * 18) : 0.1);
    pulse(fx.barMat, own ? 1 : 0.15);
    if (fx.ledMat) pulse(fx.ledMat, lit);
    if (fx.beltMat) pulse(fx.beltMat, own ? 1 + a * 0.35 : 0.3);
    if (fx.badgeMat) pulse(fx.badgeMat, own ? 0.9 + a * 0.5 * (0.5 + 0.5 * Math.sin(t * 10)) : 0.2);
    fx.ugMat.opacity = own ? fx.ugBase + a * 0.32 : fx.ugBase * 0.2;
    fx.ugMat.visible = fx.ugMat.opacity > 0.005;
  }

  /** Treadmill whose belt the point is standing on (feet height y). */
  findAt(x, z, y) {
    for (const t of this.list) {
      if (Math.abs(x - t.x) < LEN / 2 - 0.3 && Math.abs(z - t.z) < WID / 2 - 0.2 && y < BELT_Y + 0.3 && y > BELT_Y - 0.2) return t;
    }
    return null;
  }

  nearest(x, z, maxD) {
    let best = null, bd = maxD;
    for (const t of this.list) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  update(dt, t, activeTier, particles) {
    for (const tm of this.list) {
      const active = tm.tier === activeTier;
      const target = active ? 1.6 : (tm.owned ? 0.15 : 0);
      tm.speed += (target - tm.speed) * Math.min(1, dt * 3);
      tm.tex.offset.x += tm.speed * dt; // belt surface runs toward the rear (-x), under the runner
      const so = active ? 0.18 : 1;
      tm.sign.material.opacity += (so - tm.sign.material.opacity) * Math.min(1, dt * 6);
      if (tm.near === false) continue; // far away: skip the cosmetic animation
      const fx = tm.fx;
      const a = Math.min(1, Math.max(0, (tm.speed - 0.15) / 1.45)); // rev level 0..1
      for (const an of tm.anim) an(t);
      if (tm.owned) {
        fx.lockedBars = false;
        this.applyRev(tm, a, t);
        fx.fly.rotation.z += dt * (1.2 + a * 20);
        fx.needle.rotation.z = 2.0 - a * 3.7 + a * 0.06 * Math.sin(t * 43);
        for (let k = 0; k < BAR_N; k++) {
          const idle = 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.6 + k * 0.9));
          const rev = 0.45 + 0.55 * Math.abs(Math.sin(t * (7 + k * 1.3) + k * 2.1));
          setBar(fx.bars, k, idle + (rev - idle) * a);
        }
        fx.bars.instanceMatrix.needsUpdate = true;
        fx.emblem.rotation.y += dt * (0.9 + a * 7);
        fx.emblem.position.y = fx.emblemY + Math.sin(t * 2 + tm.tier) * 0.08 + a * 0.15;
      } else {
        fx.needle.rotation.z = 2.0;
        if (fx.lockedBars !== true) { setBars(fx.bars, 0.06); fx.lockedBars = true; }
        fx.emblem.rotation.y += dt * 0.3;
      }
      if (fx.bits) fx.bits.rotation.y -= dt * (1.4 + a * 5);
      if (fx.flames && tm.owned) {
        const fl = 0.45 + a * 1.25;
        for (let k = 0; k < fx.flames.length; k++) {
          const f = fx.flames[k];
          const j = 0.85 + (0.12 + a * 0.25) * Math.sin(t * (31 + k * 7) + k) + 0.08 * Math.sin(t * 53 + k * 3);
          f.scale.set(fl * j, 0.8 + a * 0.45, 0.8 + a * 0.45);
        }
        fx.flameMat.opacity = 0.32 + a * 0.3;
      }
      if (fx.rings) {
        fx.ringPh = (fx.ringPh + dt * (0.12 + a * 0.75)) % 1;
        const amp = tm.owned ? 0.12 + a * 0.33 : 0;
        for (let k = 0; k < 3; k++) {
          const p = (fx.ringPh + k / 3) % 1;
          const r = fx.rings[k];
          r.position.y = 0.55 + p * 2.6;
          r.scale.setScalar(1 - p * 0.18);
          r.material.opacity = amp * Math.sin(p * Math.PI);
          r.visible = amp > 0;
        }
      }

      const d = tm.def;
      if (active) {
        // speed streaks shooting backward off the belt
        if (Math.random() < dt * 34 * a) particles.emit({ x: tm.x - 0.6 + Math.random() * 1.6, y: BELT_Y + 0.04 + Math.random() * 0.2, z: tm.z + (Math.random() - 0.5) * (WID - 0.9), vx: -10 - Math.random() * 6, vy: 0.3, color: d.glow > 0 ? d.accent : 0xfff1d0, size: 0.16, sizeEnd: 0.02, life: 0.38, intensity: d.glow > 1 ? 1.4 : 1.1 });
        // flywheel sparks (metal tiers and up)
        if (tm.band >= 1 && Math.random() < dt * 10 * a) {
          const s = Math.random() < 0.5 ? -1 : 1;
          particles.emit({ x: tm.x + HOOD_X - 0.1, y: FLY_Y - 0.2, z: tm.z + s * (FLY_Z + 0.05), vx: -1.5 - Math.random() * 2, vy: 1.5 + Math.random() * 2, vz: s * (0.5 + Math.random()), color: 0xffd28a, color2: d.accent, size: 0.1, life: 0.5, gravity: -9, intensity: 1.5 });
        }
        // thruster exhaust
        if (fx.flames && Math.random() < dt * 22 * a) {
          const s = Math.random() < 0.5 ? -1 : 1;
          particles.emit({ x: tm.x + shared().thrust.x - 0.4, y: 0.5 + (Math.random() - 0.5) * 0.15, z: tm.z + s * shared().thrust.z, vx: -6 - Math.random() * 4, vy: 0.4 + Math.random(), vz: (Math.random() - 0.5), color: d.accent, color2: 0xffffff, size: 0.26, sizeEnd: 0.05, life: 0.45, drag: 1.5, intensity: 1.3 });
        }
      }
      // ambient emitters for elemental tiers
      if (d.lava && Math.random() < dt * 10) particles.emit({ x: tm.x - LEN / 2 - 0.5, y: 0.9, z: tm.z + (Math.random() < 0.5 ? -1 : 1) * (WID / 2 + 0.5), vx: (Math.random() - 0.5), vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5), color: 0xffb020, color2: 0xff2a00, size: 0.25, life: 1.2, gravity: -1, intensity: 2.5 });
      if (d.ice && Math.random() < dt * 8) particles.emit({ x: tm.x + (Math.random() - 0.5) * LEN, y: 2.5 + Math.random(), z: tm.z + (Math.random() - 0.5) * WID * 1.4, vx: 0, vy: -0.8, vz: 0, color: 0xe8fbff, size: 0.18, life: 2.5, intensity: 1.2, twinkle: true });
      if (d.cosmic && Math.random() < dt * 14) particles.emit({ x: tm.x + (Math.random() - 0.5) * 8, y: 1 + Math.random() * 3.5, z: tm.z + (Math.random() - 0.5) * 6, vy: 0.2, color: Math.random() < 0.5 ? 0xffffff : 0xa98bff, size: 0.18, life: 1.5, intensity: 2.2, twinkle: true });
      if (d.holo && Math.random() < dt * 6) particles.emit({ x: tm.x + (Math.random() - 0.5) * LEN, y: 0.6, z: tm.z + (Math.random() - 0.5) * WID, vy: 1.5, color: d.accent, size: 0.15, life: 1.4, intensity: 1.8 });
    }
  }

  static get BELT_Y() { return BELT_Y; }
}
