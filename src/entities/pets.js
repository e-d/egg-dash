import * as THREE from 'three';
import { PETS, RARITY } from '../config.js';
import { makeGlowSprite } from '../fx/particles.js';

const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
const WHITE = new THREE.Color(0xffffff);
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

/** Pet surface material. `look` carries the per-pet metal / glow flags. */
function m(color, divine, extra = {}, look = null) {
  const metal = look?.metal;
  const glow = look?.glow;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: metal ? 0.26 : 0.5,
    metalness: metal ? 0.65 : divine ? 0.25 : 0,
    emissive: glow != null ? glow : divine ? color : 0x000000,
    emissiveIntensity: glow != null ? (look.glowK ?? 0.2) : divine ? 0.12 : 0,
    ...extra,
  });
}

/** Unlit-ish glowing accent (small parts only — keeps bloom in check). */
function glowMat(color, k = 1.6, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: mix(color, 0x000000, 0.4), emissive: color, emissiveIntensity: k, roughness: 0.35, ...extra });
}

function part(geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const p = new THREE.Mesh(geo, material);
  p.position.set(x, y, z); p.scale.set(sx, sy, sz);
  p.castShadow = true;
  return p;
}

/** 5-point star, flat, centred. */
function starGeo(r = 0.09) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? sh.lineTo(x, y) : sh.moveTo(x, y);
  }
  return new THREE.ShapeGeometry(sh);
}

/** Leaf: pointed oval, flat in its local XY plane. */
function leafGeo(len = 0.3, w = 0.13) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(w, len * 0.45, 0, len);
  sh.quadraticCurveTo(-w, len * 0.45, 0, 0);
  return new THREE.ShapeGeometry(sh, 6);
}

// Body ellipsoids (centre / radii) — used to stick features onto the body surface.
const BODY = {
  round: { c: [0, 0.5, 0], r: [0.5, 0.46, 0.525] },
  tall:  { c: [0, 0.62, 0], r: [0.475, 0.6, 0.45] },
  long:  { c: [0, 0.55, -0.1], r: [0.456, 0.408, 0.624] },
  swim:  { c: [0, 0.62, -0.1], r: [0.42, 0.4, 0.72] },
};
/** Point on the body ellipsoid in direction (theta around Y from +Z, phi from the top), plus its outward normal. */
function onBody(b, theta, phi, lift = 0) {
  const n = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
  const p = new THREE.Vector3(b.c[0] + n.x * b.r[0], b.c[1] + n.y * b.r[1], b.c[2] + n.z * b.r[2]);
  const nn = new THREE.Vector3(n.x / b.r[0], n.y / b.r[1], n.z / b.r[2]).normalize();
  p.addScaledVector(nn, lift);
  return { p, n: nn };
}
/** Point on the body's spine: psi = 0 is the top, positive leans towards the tail (-Z). */
function onSpine(b, psi, lift = 0) {
  const n = new THREE.Vector3(0, Math.cos(psi), -Math.sin(psi));
  const p = new THREE.Vector3(b.c[0], b.c[1] + n.y * b.r[1], b.c[2] + n.z * b.r[2]);
  const nn = new THREE.Vector3(0, n.y / b.r[1], n.z / b.r[2]).normalize();
  p.addScaledVector(nn, lift);
  return { p, n: nn };
}
const UP = new THREE.Vector3(0, 1, 0);
function alignTo(obj, n) { obj.quaternion.setFromUnitVectors(UP, n); return obj; }

/** Build a cute procedural pet. Origin at feet, facing +Z, ~1.3 units tall. */
export function buildPet(species) {
  const def = PETS[species];
  const divine = def.rarity === 'divine';
  const A = def.aura ?? 0xffd66b;                 // divine land accent
  const g = new THREE.Group();
  const body = new THREE.Group();                 // animated sub-group
  g.add(body);
  const look = { metal: def.metal, glow: def.glow ?? null, glowK: def.metal ? 0.14 : 0.2 };
  const main = m(def.main, divine, {}, look);
  const belly = m(def.belly, divine, {}, def.glow != null ? { ...look, glowK: 0.3 } : def.metal && divine ? { metal: true, glow: A, glowK: 0.3 } : look);
  const accent = (c, extra = {}) => m(c, divine, extra, def.metal ? { metal: true } : null);
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.2 });
  const swim = !!def.fins;                         // dolphins / sharks / narwhals: streamlined, no legs
  const noLegs = swim || !!def.tentacles || def.tail === 'fish';
  const flyer = def.wings === 'bat' || def.wings === 'feather' || def.wings === 'bug' || swim;
  const potted = def.flower && def.spikes;         // cactus buddy lives in a pot
  const extras = { stars: null, tentacles: [], antennae: [], spin: [] };

  // ── body ─────────────────────────────────────────────
  let headY = 1.0, headZ = 0.22, headR = 0.4;
  let B = BODY[def.body] || BODY.round;
  if (swim) {
    B = BODY.swim;
    body.add(part(S(0.5, 24, 16), main, 0, 0.62, -0.1, 0.84, 0.8, 1.44));
    body.add(part(S(0.36), belly, 0, 0.5, 0.05, 0.95, 0.75, 1.35));
    headY = 0.72; headZ = 0.5; headR = 0.36;
  } else if (def.body === 'tall') {
    body.add(part(S(0.5), main, 0, 0.62, 0, 0.95, 1.2, 0.9));
    body.add(part(S(0.38), belly, 0, 0.55, 0.2, 1, 1.25, 0.7));
    if (potted) {
      const pot = new THREE.MeshStandardMaterial({ color: 0xc8643a, roughness: 0.8 });
      body.add(part(new THREE.CylinderGeometry(0.42, 0.32, 0.36, 18), pot, 0, 0.16, 0));
      body.add(part(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 18), pot, 0, 0.36, 0));
    } else if (!noLegs) {
      for (const x of [-0.18, 0.18]) body.add(part(S(0.13, 10, 8), def.beak ? accent(def.beak) : main, x, 0.06, 0.12, 1.1, 0.5, 1.5));
    }
    headY = 1.35; headZ = 0.05; headR = 0.36;
  } else if (def.body === 'long') {
    body.add(part(S(0.48), main, 0, 0.55, -0.1, 0.95, 0.85, 1.3));
    body.add(part(S(0.34), belly, 0, 0.48, 0.15, 1, 0.85, 1.1));
    { const neck = part(new THREE.CylinderGeometry(0.2, 0.28, 0.6, 12), main, 0, 0.95, 0.35); neck.rotation.x = 0.5; body.add(neck); }
    if (!noLegs) for (const [x, z] of [[-0.28, 0.3], [0.28, 0.3], [-0.28, -0.45], [0.28, -0.45]]) body.add(part(S(0.15, 10, 8), main, x, 0.12, z, 1, 0.8, 1.3));
    headY = 1.25; headZ = 0.55; headR = 0.36;
  } else { // round
    body.add(part(S(0.5), main, 0, 0.5, 0, 1, 0.92, 1.05));
    body.add(part(S(0.36), belly, 0, 0.45, 0.24, 1, 0.9, 0.7));
    if (!noLegs && !def.claws) for (const [x, z] of [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]]) body.add(part(S(0.14, 10, 8), main, x, 0.1, z, 1, 0.8, 1.2));
  }

  // crab / scorpion: thin splayed legs instead of stumpy feet
  if (def.claws && !def.jaw && !noLegs) {
    const lm = accent(def.claws);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const leg = part(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 6), lm, s * 0.42, 0.18, 0.15 - k * 0.2);
      leg.rotation.z = s * 1.0; leg.rotation.y = s * (k - 1) * 0.35;
      body.add(leg);
    }
  }

  // ── head ─────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, headY, headZ);
  body.add(head);
  head.add(part(S(headR), main, 0, 0, 0, 1, 0.95, 1));
  // eyes
  const eyeX = headR * 0.42, eyeY = headR * 0.15, eyeZ = headR * 0.86;
  const pupil = def.glow != null && def.metal ? glowMat(def.glow, 1.4) : dark;
  if (def.visor) {
    const vm = glowMat(def.visor, 1.1, { side: THREE.DoubleSide });
    const band = part(new THREE.CylinderGeometry(headR * 1.04, headR * 1.04, headR * 0.34, 28, 1, true, -1.25, 2.5), vm, 0, eyeY, 0);
    head.add(band);
    // two brighter "eye" slits on the visor
    const em = glowMat(0xffffff, 1.2);
    for (const s of [-1, 1]) head.add(part(new THREE.BoxGeometry(0.12, 0.035, 0.03), em, s * eyeX, eyeY, headR * 1.03));
  } else {
    const eyes = def.eyes3 ? [[-1, 0], [1, 0], [0, 1]] : [[-1, 0], [1, 0]];
    for (const [s, top] of eyes) {
      const ex = top ? 0 : s * eyeX * (def.eyes3 ? 1.15 : 1);
      const ey = top ? eyeY + headR * 0.5 : eyeY;
      const ez = top ? eyeZ * 0.82 : eyeZ;
      if (def.bigEyes) {
        const k = def.eyes3 ? 0.85 : 1;
        head.add(part(S(0.13 * k, 14, 10), white, ex * 1.1, ey, ez * 0.92, 1, 1, 0.5));
        head.add(part(S(0.075 * k, 12, 8), pupil, ex * 1.1, ey, ez * 0.92 + 0.06 * k));
      } else if (def.eyes3) {
        head.add(part(S(0.09, 12, 8), white, ex, ey, ez - 0.01, 1, 1, 0.55));
        head.add(part(S(0.05, 10, 8), pupil, ex, ey, ez + 0.04, 1, 1.2, 0.6));
      } else {
        head.add(part(S(0.07, 12, 8), pupil, ex, ey, ez, 1, 1.25, 0.6));
        head.add(part(S(0.022, 6, 4), white, ex + 0.02, ey + 0.035, ez + 0.04));
      }
    }
  }
  // blush
  if (!def.metal) {
    const blush = new THREE.MeshStandardMaterial({ color: 0xff8fa8, roughness: 0.8, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) head.add(part(S(0.06, 8, 6), blush, s * headR * 0.62, -headR * 0.15, headR * 0.72, 1, 0.6, 0.4));
  }
  if (def.patches) for (const s of [-1, 1]) head.add(part(S(0.1, 10, 8), m(def.patches, divine), s * eyeX, eyeY, eyeZ - 0.03, 1, 1.3, 0.5));

  // ears
  const earMat = def.earColor ? m(def.earColor, divine) : main;
  for (const s of [-1, 1]) {
    let e;
    switch (def.ears) {
      case 'pointy': e = part(new THREE.ConeGeometry(0.13, 0.32, 8), earMat, s * headR * 0.55, headR * 0.85, 0); e.rotation.z = -s * 0.3; break;
      case 'floppy': e = part(S(0.14, 10, 8), earMat, s * headR * 0.9, headR * 0.2, 0, 0.6, 1.4, 0.9); e.rotation.z = s * 0.4; break;
      case 'long': e = part(S(0.11, 10, 8), earMat, s * headR * 0.38, headR * 1.35, -0.02, 0.8, 2.8, 0.6); e.rotation.z = -s * 0.15; break;
      case 'round': e = part(S(0.14, 12, 8), earMat, s * headR * 0.7, headR * 0.8, 0, 1, 1, 0.5); break;
      case 'tufts': e = part(new THREE.ConeGeometry(0.09, 0.28, 6), earMat, s * headR * 0.6, headR * 0.9, 0); e.rotation.z = -s * 0.5; break;
      case 'big': { // fennec: huge triangle ears with pink insides
        e = new THREE.Group();
        e.position.set(s * headR * 0.62, headR * 0.95, -0.04);
        e.rotation.z = -s * 0.42;
        e.add(part(new THREE.ConeGeometry(0.22, 0.62, 12), earMat, 0, 0.26, 0, 1, 1, 0.38));
        e.add(part(new THREE.ConeGeometry(0.15, 0.48, 12), m(0xffb6c8, divine), 0, 0.22, 0.05, 1, 1, 0.2));
        break;
      }
      default: e = null;
    }
    if (e) head.add(e);
  }
  if (def.snout === 'pig') {
    { const sn = part(new THREE.CylinderGeometry(0.13, 0.14, 0.1, 16), belly, 0, -0.06, headR * 0.98); sn.rotation.x = Math.PI / 2; head.add(sn); }
    for (const s of [-1, 1]) head.add(part(S(0.025, 6, 4), dark, s * 0.045, -0.06, headR * 1.04));
  } else if (def.snout && !def.jaw) {
    head.add(part(S(0.15, 12, 8), belly, 0, -0.1, headR * 0.85, 1.1, 0.8, 0.9));
    head.add(part(S(0.05, 8, 6), dark, 0, -0.02, headR * 1.08));
  }
  if (def.jaw) { // long toothy snout (dino / shark)
    const jz = headR * 0.75;
    head.add(part(S(0.2, 16, 10), main, 0, -0.04, jz + 0.12, 1.0, 0.55, 1.35));
    const lower = part(S(0.18, 14, 8), belly, 0, -0.2, jz + 0.06, 0.95, 0.36, 1.25);
    lower.rotation.x = 0.22;
    head.add(lower);
    const tooth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const tg = new THREE.ConeGeometry(0.028, 0.08, 5);
    for (let k = 0; k < 5; k++) for (const s of [-1, 1]) {
      const a = (k / 4) * 0.9;
      const t = part(tg, tooth, s * (0.15 - k * 0.022) * Math.cos(a * 0.4), -0.12, jz - 0.02 + k * 0.075);
      t.rotation.x = Math.PI;
      head.add(t);
    }
    for (const s of [-1, 1]) head.add(part(S(0.022, 6, 4), dark, s * 0.06, 0.04, jz + 0.36));
  }
  if (def.beak) {
    const bk = part(new THREE.ConeGeometry(0.08, 0.22, 8), def.glow != null && def.metal ? glowMat(def.beak, 1.2) : m(def.beak, divine), 0, -0.05, headR * 1.0);
    bk.rotation.x = Math.PI / 2;
    head.add(bk);
  }
  if (def.whiskers) {
    const wm = new THREE.MeshBasicMaterial({ color: def.main < 0x404040 ? 0xdddddd : 0x333333 });
    for (const s of [-1, 1]) for (const k of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.012), wm);
      w.position.set(s * 0.22, -0.08 + k * 0.03, headR * 0.82); w.rotation.z = s * k * 0.15;
      head.add(w);
    }
  }
  if (def.horns) for (const s of [-1, 1]) { const h = part(new THREE.ConeGeometry(0.06, 0.32, 8), accent(def.horns), s * 0.16, headR * 0.9, -0.08); h.rotation.x = -0.5; h.rotation.z = -s * 0.25; head.add(h); }
  if (def.horn) {
    const hm = new THREE.MeshStandardMaterial({ color: def.horn, emissive: def.horn, emissiveIntensity: divine ? 1.2 : 0.5, metalness: 0.5, roughness: 0.2 });
    if (swim) { // narwhal tusk points forward
      const h = part(new THREE.ConeGeometry(0.06, 0.8, 10), hm, 0, 0.06, headR + 0.32); h.rotation.x = Math.PI / 2 - 0.15; head.add(h);
    } else if (def.horns) { // triceratops nose horn
      const h = part(new THREE.ConeGeometry(0.06, 0.24, 10), hm, 0, 0.02, headR * 1.1); h.rotation.x = 0.9; head.add(h);
      // bony frill
      const fr = part(new THREE.CylinderGeometry(headR * 1.25, headR * 1.25, 0.06, 20, 1, false, -Math.PI / 2 - 1.2, 2.4 + Math.PI - 0.6), accent(def.belly), 0, headR * 0.25, -headR * 0.35);
      fr.rotation.x = -1.2; head.add(fr);
    } else {
      const h = part(new THREE.ConeGeometry(0.07, 0.5, 10), hm, 0, headR * 1.05, headR * 0.35); h.rotation.x = 0.35; head.add(h);
    }
  }
  if (def.antlers) {
    const am = m(def.antlers, divine, divine ? { emissive: def.antlers, emissiveIntensity: 0.35 } : {});
    for (const s of [-1, 1]) {
      const a = part(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), am, s * 0.18, headR * 1.05, -0.05); a.rotation.z = -s * 0.35; head.add(a);
      const b = part(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), am, s * 0.3, headR * 1.25, 0.02); b.rotation.z = s * 0.6; head.add(b);
      const c = part(new THREE.CylinderGeometry(0.022, 0.028, 0.2, 6), am, s * 0.34, headR * 1.55, -0.08); c.rotation.z = -s * 0.25; head.add(c);
    }
  }
  if (def.mane) {
    const cols = divine ? [0xfff4b0, 0xd8ccff, 0xa9f5ff, 0xffd6f5] : [0xff7ab8, 0xffd23f, 0x7ad8ff, 0xb98cff];
    for (let k = 0; k < 5; k++) head.add(part(S(0.1, 8, 6), m(cols[k % 4], divine, { emissive: cols[k % 4], emissiveIntensity: divine ? 0.7 : 0.25 }), 0, headR * 0.8 - k * 0.12, -headR * 0.6 - k * 0.05));
  }
  if (def.antennae) {
    const am = accent(def.antennae);
    const bob = glowMat(def.antennae, 1.3);
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(s * headR * 0.35, headR * 0.82, 0);
      a.rotation.z = -s * 0.35;
      const stalk = part(new THREE.CylinderGeometry(0.02, 0.026, 0.36, 6), am, 0, 0.18, 0);
      a.add(stalk);
      a.add(part(S(0.065, 12, 8), bob, 0, 0.38, 0));
      head.add(a);
      extras.antennae.push({ g: a, s, rz: a.rotation.z });
    }
  }
  if (def.leaves) {
    const lm = m(def.leaves, divine, { side: THREE.DoubleSide, ...(divine ? { emissive: def.leaves, emissiveIntensity: 0.25 } : {}) });
    const lg = leafGeo(0.32, 0.14);
    const crown = new THREE.Group();
    crown.position.y = headR * 0.78;
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const l = new THREE.Mesh(lg, lm);
      l.castShadow = true;
      const piv = new THREE.Group();
      piv.rotation.y = a;
      l.position.set(0, 0, headR * 0.35);
      l.rotation.x = 0.6; // lean outward
      piv.add(l);
      crown.add(piv);
    }
    head.add(crown);
    if (def.body !== 'tall') for (const s of [-1, 1]) { // a couple of sprigs on the back
      const l = new THREE.Mesh(lg, lm);
      const { p, n: nn } = onBody(B, s * 2.4, 0.5, -0.02);
      l.position.copy(p); alignTo(l, nn); l.rotateZ(s * 0.4); l.scale.setScalar(0.9);
      body.add(l);
    }
  }
  if (def.flower) {
    const fl = new THREE.Group();
    fl.position.set(headR * 0.3, headR * 0.92, 0.05);
    fl.rotation.z = -0.35;
    const pm = m(def.flower, divine);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      fl.add(part(S(0.08, 10, 6), pm, Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.09, 1, 0.4, 1));
    }
    fl.add(part(S(0.055, 10, 6), m(0xffe14a, divine), 0, 0.06, 0));
    head.add(fl);
  }
  if (def.crown) {
    const cm = new THREE.MeshStandardMaterial({ color: def.crown, metalness: 0.85, roughness: 0.22, emissive: def.crown, emissiveIntensity: 0.25 });
    const cr = new THREE.Group();
    cr.position.y = headR * 0.82;
    cr.add(part(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 20, 1, true), cm, 0, 0.05, 0));
    cr.children[0].material = cm.clone(); cr.children[0].material.side = THREE.DoubleSide;
    const gemCols = [0xff3b6b, 0x3bc8ff, 0x5aff8a];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      cr.add(part(new THREE.ConeGeometry(0.045, 0.14, 6), cm, Math.sin(a) * 0.19, 0.16, Math.cos(a) * 0.19));
      cr.add(part(S(0.022, 6, 4), m(0xffffff, false), Math.sin(a) * 0.19, 0.24, Math.cos(a) * 0.19));
    }
    cr.add(part(new THREE.OctahedronGeometry(0.045), glowMat(gemCols[(def.crown >> 3) % 3], 0.8), 0, 0.06, 0.205));
    head.add(cr);
  }
  if (def.flame) {
    const fm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: divine ? 0xffe9a0 : 0xffa020, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
    for (let k = 0; k < 3; k++) { const fl = part(new THREE.ConeGeometry(0.06, 0.3, 6), fm, (k - 1) * 0.1, headR * 1.05, -0.05 - Math.abs(k - 1) * 0.05); fl.rotation.x = -0.3; head.add(fl); }
  }

  // ── body features ────────────────────────────────────
  if (def.spots) for (let k = 0; k < 5; k++) body.add(part(S(0.05, 6, 4), white, (k - 2) * 0.12, B.c[1] + B.r[1] - 0.04, -0.1 + (k % 2) * 0.15));
  if (def.cowSpots) {
    const cm = m(def.cowSpots, divine);
    const spots = [[1.2, 0.9, 0.16], [-1.6, 1.1, 0.2], [2.6, 0.6, 0.14], [-2.4, 0.5, 0.17], [0.3, 1.4, 0.12], [3.1, 1.2, 0.15]];
    for (const [th, ph, r] of spots) {
      const { p, n } = onBody(B, th, ph, -0.03);
      const sp = alignTo(part(S(r, 12, 8), cm, p.x, p.y, p.z, 1.2, 0.3, 1), n);
      body.add(sp);
    }
    head.add(part(S(0.12, 10, 8), cm, headR * 0.45, headR * 0.45, headR * 0.5, 1, 1, 0.5));
  }
  if (def.hump) {
    body.add(part(S(0.3, 16, 10), main, 0, B.c[1] + B.r[1] + 0.1, -0.3, 0.85, 1.15, 1.0));
    body.add(part(S(0.12, 10, 8), belly, 0, B.c[1] + B.r[1] + 0.42, -0.3, 1, 0.5, 1)); // sandy tuft
  }
  if (def.shell) {
    const sm = new THREE.MeshStandardMaterial({ color: def.shell, metalness: def.metal || divine ? 0.7 : 0.15, roughness: 0.25,
      emissive: def.shell, emissiveIntensity: divine ? 0.15 : 0.05 });
    // two domed wing-cases with a seam down the middle (beetle carapace)
    for (const s of [-1, 1]) {
      const half = part(new THREE.SphereGeometry(0.5, 20, 12, s > 0 ? 0 : Math.PI, Math.PI, 0, Math.PI / 2), sm,
        s * 0.015, B.c[1] - 0.02, B.c[2] - 0.06, B.r[0] * 2.16, B.r[1] * 2.1, B.r[2] * 2.06);
      body.add(half);
    }
    body.add(part(new THREE.BoxGeometry(0.03, 0.03, 0.9), dark, 0, B.c[1] + B.r[1] * 1.04, B.c[2] - 0.12));
  }
  if (def.spikes) {
    const plates = def.body === 'long' || def.jaw;
    if (plates) { // stego plates / dragon ridge along the spine
      const pm = accent(def.spikes, def.glow != null || divine ? { emissive: def.spikes, emissiveIntensity: 0.35 } : {});
      const n = def.body === 'long' ? 6 : 5;
      const big = species === 'stego' ? 1.6 : 1.1;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const psi = def.body === 'long' ? -0.35 + t * 1.6 : 0.3 + t * 1.25; // neck/shoulders → tail
        const { p, n: nn } = onSpine(B, psi, -0.03);
        const size = big * (0.7 + Math.sin(t * Math.PI) * 0.5);
        const pl = alignTo(part(new THREE.ConeGeometry(0.14, 0.32, 4), pm, p.x, p.y, p.z, 0.28 * size, size, size), nn);
        pl.position.addScaledVector(nn, 0.1 * size);
        body.add(pl);
      }
    } else if (potted) { // cactus needles all over
      const nm = new THREE.MeshStandardMaterial({ color: def.spikes, roughness: 0.5 });
      const ng = new THREE.ConeGeometry(0.02, 0.12, 4);
      for (let k = 0; k < 26; k++) {
        const th = k * 2.399, ph = 0.35 + (k / 26) * 1.9;
        const { p, n } = onBody(B, th, ph, 0.03);
        body.add(alignTo(part(ng, nm, p.x, p.y, p.z), n));
      }
      for (const s of [-1, 1]) { // cactus arms
        const arm = new THREE.Group();
        arm.position.set(s * 0.42, 0.65 + (s > 0 ? 0.08 : -0.02), 0);
        arm.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), main, s * 0.1, 0, 0, 1, 1, 1).rotateZ(Math.PI / 2));
        arm.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10), main, s * 0.2, 0.15, 0));
        arm.add(part(S(0.1, 10, 6), main, s * 0.2, 0.3, 0));
        body.add(arm);
      }
    } else { // ice shards / crystals on the shoulders and back
      const im = new THREE.MeshStandardMaterial({ color: def.spikes, emissive: def.spikes, emissiveIntensity: divine ? 0.45 : 0.2, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.92 });
      const shards = [[Math.PI, 0.45, 1.2], [Math.PI - 0.6, 0.7, 0.9], [Math.PI + 0.6, 0.7, 0.9], [Math.PI, 0.95, 1], [Math.PI - 1.1, 0.5, 0.8], [Math.PI + 1.1, 0.5, 0.8], [Math.PI, 1.35, 0.7]];
      for (const [th, ph, sc] of shards) {
        const { p, n } = onBody(B, th, ph, -0.02);
        const c = alignTo(part(new THREE.ConeGeometry(0.08, 0.36, 5), im, p.x, p.y, p.z, sc, sc, sc), n);
        c.position.addScaledVector(n, 0.12 * sc);
        body.add(c);
      }
    }
  }
  if (def.fins) {
    const fm = accent(def.fins, { side: THREE.DoubleSide });
    // dorsal fin: tall swept triangle on the back
    const sh = new THREE.Shape();
    sh.moveTo(0.22, 0); sh.quadraticCurveTo(0.05, 0.12, -0.12, 0.42); sh.quadraticCurveTo(-0.12, 0.2, -0.26, 0); sh.lineTo(0.22, 0);
    const dorsal = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }), fm);
    dorsal.rotation.y = -Math.PI / 2; dorsal.position.set(-0.025, B.c[1] + B.r[1] - 0.06, -0.15);
    dorsal.scale.setScalar(species === 'shark' ? 1.25 : 1);
    dorsal.castShadow = true;
    body.add(dorsal);
    for (const s of [-1, 1]) { // pectoral fins
      const pf = part(S(0.2, 12, 8), fm, s * 0.4, 0.4, 0.15, 1.1, 0.18, 0.6);
      pf.rotation.z = s * -0.5; pf.rotation.y = s * 0.5;
      body.add(pf);
    }
  }
  if (def.claws) {
    const cm = accent(def.claws);
    if (def.jaw) { // dino arms with little claws
      for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.24, def.body === 'tall' ? 0.88 : 0.7, def.body === 'tall' ? 0.44 : 0.5);
        arm.add(part(S(0.08, 8, 6), main, 0, -0.06, 0.05, 0.8, 1.4, 0.8));
        for (let k = -1; k <= 1; k++) { const c = part(new THREE.ConeGeometry(0.022, 0.1, 5), cm, k * 0.03, -0.17, 0.08); c.rotation.x = 2.6; arm.add(c); }
        body.add(arm);
      }
    } else { // crab / scorpion pincers held up in front
      for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.36, 0.42, 0.32);
        arm.rotation.y = -s * 0.35;
        const fore = part(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), cm, 0, 0.06, 0.12); fore.rotation.x = 1.0; arm.add(fore);
        const palm = part(S(0.15, 14, 10), cm, 0, 0.18, 0.32, 0.9, 0.85, 1.2); arm.add(palm);
        const up = part(new THREE.ConeGeometry(0.07, 0.24, 8), cm, 0, 0.28, 0.48); up.rotation.x = 1.25; arm.add(up);
        const lo = part(new THREE.ConeGeometry(0.06, 0.2, 8), cm, 0, 0.12, 0.47); lo.rotation.x = 1.9; arm.add(lo);
        body.add(arm);
      }
    }
  }
  if (def.tentacles) {
    const tm = m(def.tentacles, divine, {}, look);
    const tipM = def.belly != null ? belly : tm;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.PI / n;
      const root = new THREE.Group();
      root.position.set(Math.sin(a) * 0.26, 0.24, Math.cos(a) * 0.26);
      root.rotation.y = a;
      body.add(root);
      const joints = [];
      let parent = root;
      const segs = 4;
      for (let j = 0; j < segs; j++) {
        const jg = new THREE.Group();
        if (j) jg.position.z = 0.15 - j * 0.015;
        const r = 0.1 - j * 0.018;
        jg.add(part(S(r, 10, 8), j === segs - 1 ? tipM : tm, 0, 0, 0.07, 0.9, 0.9, 1.5));
        parent.add(jg);
        joints.push(jg);
        parent = jg;
      }
      extras.tentacles.push({ joints, phase: k * 0.9, base: [0.9, -0.15, -0.55, -0.7] });
      joints.forEach((jg, j) => { jg.rotation.x = [0.9, -0.15, -0.55, -0.7][j]; });
    }
    if (species === 'saucersquid') { // flying-saucer rim
      const rm = new THREE.MeshStandardMaterial({ color: 0xb8c4d0, metalness: 0.8, roughness: 0.25 });
      body.add(part(new THREE.CylinderGeometry(0.72, 0.6, 0.1, 28), rm, 0, 0.42, 0));
      const lm = glowMat(def.main, 1.6);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; body.add(part(S(0.04, 6, 4), lm, Math.sin(a) * 0.69, 0.42, Math.cos(a) * 0.69)); }
    }
  }
  if (def.metal && def.body !== 'long') { // robot chest light + bolts
    body.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 14), glowMat(def.visor ?? def.glow ?? def.belly, 1.3), 0, B.c[1], B.c[2] + B.r[2] * 0.98).rotateX(Math.PI / 2));
    const bolt = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.2 });
    for (const s of [-1, 1]) head.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), bolt, s * headR * 0.98, 0, 0).rotateZ(Math.PI / 2));
  }

  // ── tail ─────────────────────────────────────────────
  const tail = new THREE.Group();
  tail.position.set(0, swim ? 0.62 : def.body === 'tall' ? 0.4 : 0.55, swim ? -0.8 : def.body === 'long' ? -0.7 : -0.45);
  body.add(tail);
  switch (def.tail) {
    case 'stub': tail.add(part(S(0.1, 8, 6), main, 0, 0.05, 0)); break;
    case 'puff': tail.add(part(S(0.16, 10, 8), belly, 0, 0, 0)); break;
    case 'long': { const t = part(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 8), main, 0, 0.25, -0.12); t.rotation.x = -0.5; tail.add(t); break; }
    case 'bushy': { tail.add(part(S(0.2, 12, 8), main, 0, 0.18, -0.15, 0.9, 0.9, 1.6)); tail.add(part(S(0.12, 10, 8), belly, 0, 0.26, -0.42)); break; }
    case 'curl': tail.add(part(new THREE.TorusGeometry(0.08, 0.03, 6, 12, Math.PI * 1.6), main, 0, 0.05, -0.02)); break;
    case 'fish': { // horizontal fluke
      const stalk = part(new THREE.ConeGeometry(0.16, 0.42, 10), main, 0, 0, -0.12); stalk.rotation.x = -Math.PI / 2; tail.add(stalk);
      for (const s of [-1, 1]) {
        const lobe = part(S(0.17, 12, 8), def.fins ? accent(def.fins) : main, s * 0.16, 0.0, -0.36, 1.3, 0.22, 0.65);
        lobe.rotation.y = s * 0.55;
        tail.add(lobe);
      }
      break;
    }
    case 'spike': {
      if (def.claws && !def.jaw) { // scorpion: segmented tail arcing over the back, stinger on top
        const n = 8, R = 0.36, cy = 0.3;
        let last;
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k / (n - 1)) * Math.PI * 1.2;
          last = [Math.sin(a) * R + cy, -Math.cos(a) * R - 0.05];
          tail.add(part(S(0.12 - k * 0.006, 10, 8), main, 0, last[0], last[1]));
        }
        tail.add(part(S(0.1, 10, 8), accent(def.belly), 0, last[0] + 0.02, last[1] + 0.1));
        const st = part(new THREE.ConeGeometry(0.06, 0.26, 8), accent(def.horns ?? def.belly), 0, last[0] - 0.06, last[1] + 0.2); st.rotation.x = 2.3; tail.add(st);
      } else {
        const t = part(new THREE.ConeGeometry(0.16, 0.7, 8), main, 0, 0.05, -0.3); t.rotation.x = -Math.PI / 2 - 0.3; tail.add(t);
        tail.add(part(new THREE.ConeGeometry(0.09, 0.2, 4), accent(def.spikes ?? def.horns ?? def.belly), 0, 0.2, -0.55));
      }
      break;
    }
  }

  // ── wings ────────────────────────────────────────────
  const wings = [];
  let wingType = def.wings;
  if (divine && !wingType && !def.tentacles && !def.fins && !def.jaw) wingType = def.metal ? 'bug' : 'feather';
  if (wingType) {
    const type = wingType;
    let wm;
    if (type === 'bug') {
      wm = new THREE.MeshStandardMaterial({ color: divine ? mix(0xffffff, A, 0.5) : 0xe8f4ff, emissive: divine ? A : 0x000000, emissiveIntensity: divine ? 0.5 : 0,
        transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
    } else if (divine && type === 'bat') {
      wm = new THREE.MeshStandardMaterial({ color: mix(def.main, A, 0.45), emissive: A, emissiveIntensity: 0.35, roughness: 0.35, side: THREE.DoubleSide });
    } else if (divine) {
      wm = new THREE.MeshStandardMaterial({ color: mix(0xffffff, A, 0.4), emissive: A, emissiveIntensity: 0.45, roughness: 0.3, side: THREE.DoubleSide });
    } else {
      wm = m(type === 'bat' ? def.main : def.belly, false, { side: THREE.DoubleSide }, look);
    }
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.42, swim ? 0.62 : def.body === 'tall' ? 0.85 : 0.75, -0.05);
      if (type === 'small' || type === 'flipper') {
        w.add(part(S(0.18, 10, 8), type === 'flipper' && !divine ? main : wm, s * 0.06, -0.08, 0, 0.35, 1, 0.8));
      } else if (type === 'bat') {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(s * 0.9, 0.35); shape.lineTo(s * 0.75, -0.05); shape.lineTo(s * 0.55, 0.05); shape.lineTo(s * 0.4, -0.15); shape.lineTo(0, -0.15);
        const wmesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), wm);
        wmesh.rotation.x = -0.3; wmesh.castShadow = true;
        w.add(wmesh);
      } else if (type === 'bug') {
        w.position.set(s * 0.12, B.c[1] + B.r[1] * 0.7, B.c[2] - 0.05);
        for (const [len, ang] of [[0.75, 0.55], [0.55, 0.95]]) { // two translucent veined wings per side
          const wmesh = part(S(0.5, 16, 8), wm, s * len * 0.42, 0.05, -0.12, len * 0.8, 0.03, 0.34);
          wmesh.rotation.y = s * -ang * 0.5; wmesh.rotation.z = s * 0.75;
          wmesh.castShadow = false;
          w.add(wmesh);
        }
        if (!def.shell) { // beetle wing-case if the pet has no carapace of its own
          const ec = part(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), accent(def.main), s * 0.18, -0.12, -0.05, 0.42, 0.4, 0.95);
          ec.rotation.z = s * 0.25;
          w.add(ec);
        }
      } else { // feather
        const big = divine ? 1.18 : 1;
        for (let k = 0; k < 4; k++) {
          const f = part(S(0.14 * big, 8, 6), wm, s * (0.18 + k * 0.14) * big, 0.12 - k * 0.04, -k * 0.03, 1.6, 0.35, 0.6);
          f.rotation.z = s * (0.35 - k * 0.12);
          w.add(f);
        }
      }
      body.add(w);
      wings.push({ g: w, s, type });
    }
  }

  // ── orbiting stars / divine sparkles ─────────────────
  if (def.stars != null || divine) {
    const grp = new THREE.Group();
    grp.position.y = 0.75;
    const cols = def.stars != null ? (divine ? [def.stars, A] : [def.stars]) : [A, 0xffffff];
    const n = def.stars != null ? 6 : 5;
    const sg = starGeo(def.stars != null ? 0.1 : 0.075);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const st = new THREE.Mesh(sg, glowMat(cols[k % cols.length], def.stars != null ? 1.8 : 1.5, { side: THREE.DoubleSide, depthWrite: false }));
      st.position.set(Math.cos(a) * 0.85, Math.sin(a * 2) * 0.25, Math.sin(a) * 0.85);
      st.userData.phase = a;
      grp.add(st);
    }
    body.add(grp);
    extras.stars = grp;
  }

  // ── divine adornments ────────────────────────────────
  let halo = null, aura = null;
  if (divine) {
    halo = new THREE.Group();
    const hm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: mix(A, 0xffffff, 0.25), emissiveIntensity: 2.0 });
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 36), hm));
    const gm = glowMat(0xffffff, 1.2);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; halo.add(part(new THREE.OctahedronGeometry(0.05), gm, Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0)); }
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, headR + (def.antlers ? 0.62 : def.crown || def.leaves || def.antennae ? 0.48 : 0.3), 0);
    head.add(halo);
    aura = makeGlowSprite(A, 2.8, 0.3);
    aura.position.y = 0.8;
    g.add(aura);
  } else if (def.rarity === 'legendary') {
    aura = makeGlowSprite(new THREE.Color(RARITY.legendary.color).getHex(), 2.4, 0.25);
    aura.position.y = 0.8;
    g.add(aura);
  }

  g.userData = { species, def, body, head, tail, wings, halo, aura, flyer, divine,
    stars: extras.stars, tentacles: extras.tentacles, antennae: extras.antennae };
  return g;
}

/**
 * Animate the extra parts buildPet adds (orbiting stars/sparkles, tentacle wiggle, antenna bob).
 * Wings / tail / halo are still animated by the caller.
 */
export function animatePet(pet, t, dt = 0) {
  const ud = pet.userData;
  if (!ud) return;
  if (ud.stars) {
    ud.stars.rotation.y = t * 1.1;
    for (const st of ud.stars.children) {
      const ph = st.userData.phase;
      st.rotation.y = -ud.stars.rotation.y; // keep the star faces roughly toward the viewer
      st.rotation.z = t * 2 + ph;
      st.position.y = Math.sin(t * 1.6 + ph * 2) * 0.25;
      st.scale.setScalar(0.75 + 0.35 * (0.5 + 0.5 * Math.sin(t * 5 + ph * 3)));
    }
  }
  if (ud.tentacles) for (const te of ud.tentacles) {
    te.joints.forEach((j, k) => { j.rotation.x = te.base[k] + Math.sin(t * 3 + te.phase - k * 0.7) * (0.12 + k * 0.06); });
  }
  if (ud.antennae) for (const a of ud.antennae) {
    a.g.rotation.z = a.rz + Math.sin(t * 4 + a.s) * 0.15;
    a.g.rotation.x = Math.sin(t * 3.2 + a.s * 0.5) * 0.12;
  }
}
