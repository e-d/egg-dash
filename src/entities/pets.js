import * as THREE from 'three';
import { PETS, RARITY } from '../config.js';
import { makeGlowSprite } from '../fx/particles.js';

const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

function m(color, divine, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.5, metalness: divine ? 0.25 : 0,
    emissive: divine ? color : 0x000000, emissiveIntensity: divine ? 0.12 : 0, ...extra,
  });
}

function part(geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const p = new THREE.Mesh(geo, material);
  p.position.set(x, y, z); p.scale.set(sx, sy, sz);
  p.castShadow = true;
  return p;
}

/** Build a cute procedural pet. Origin at feet, facing +Z, ~1.3 units tall. */
export function buildPet(species) {
  const def = PETS[species];
  const divine = def.rarity === 'divine';
  const g = new THREE.Group();
  const body = new THREE.Group();   // animated sub-group
  g.add(body);
  const main = m(def.main, divine), belly = m(def.belly, divine);
  const dark = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.3 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.2 });
  const flyer = def.wings === 'bat' || def.wings === 'feather';

  let headY = 1.0, headZ = 0.22, headR = 0.4;
  if (def.body === 'round') {
    body.add(part(S(0.5), main, 0, 0.5, 0, 1, 0.92, 1.05));
    body.add(part(S(0.36), belly, 0, 0.45, 0.24, 1, 0.9, 0.7));
    for (const [x, z] of [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]]) body.add(part(S(0.14, 10, 8), main, x, 0.1, z, 1, 0.8, 1.2));
  } else if (def.body === 'tall') {
    body.add(part(S(0.5), main, 0, 0.62, 0, 0.95, 1.2, 0.9));
    body.add(part(S(0.38), belly, 0, 0.55, 0.2, 1, 1.25, 0.7));
    for (const x of [-0.18, 0.18]) body.add(part(S(0.13, 10, 8), def.beak ? m(def.beak, divine) : main, x, 0.06, 0.12, 1.1, 0.5, 1.5));
    headY = 1.35; headZ = 0.05; headR = 0.36;
  } else { // long (dragon)
    body.add(part(S(0.48), main, 0, 0.55, -0.1, 0.95, 0.85, 1.3));
    body.add(part(S(0.34), belly, 0, 0.48, 0.15, 1, 0.85, 1.1));
    { const neck = part(new THREE.CylinderGeometry(0.2, 0.28, 0.6, 12), main, 0, 0.95, 0.35); neck.rotation.x = 0.5; body.add(neck); }
    for (const [x, z] of [[-0.28, 0.3], [0.28, 0.3], [-0.28, -0.45], [0.28, -0.45]]) body.add(part(S(0.15, 10, 8), main, x, 0.12, z, 1, 0.8, 1.3));
    headY = 1.25; headZ = 0.55; headR = 0.36;
  }

  const head = new THREE.Group();
  head.position.set(0, headY, headZ);
  body.add(head);
  head.add(part(S(headR), main, 0, 0, 0, 1, 0.95, 1));
  // eyes
  const eyeX = headR * 0.42, eyeY = headR * 0.15, eyeZ = headR * 0.86;
  if (def.bigEyes) {
    for (const s of [-1, 1]) {
      head.add(part(S(0.13, 14, 10), white, s * eyeX * 1.1, eyeY, eyeZ * 0.92, 1, 1, 0.5));
      head.add(part(S(0.075, 12, 8), dark, s * eyeX * 1.1, eyeY, eyeZ * 0.92 + 0.06));
    }
  } else {
    for (const s of [-1, 1]) {
      head.add(part(S(0.07, 12, 8), dark, s * eyeX, eyeY, eyeZ, 1, 1.25, 0.6));
      head.add(part(S(0.022, 6, 4), white, s * eyeX + 0.02, eyeY + 0.035, eyeZ + 0.04));
    }
  }
  // blush
  const blush = new THREE.MeshStandardMaterial({ color: 0xff8fa8, roughness: 0.8, transparent: true, opacity: 0.7 });
  for (const s of [-1, 1]) head.add(part(S(0.06, 8, 6), blush, s * headR * 0.62, -headR * 0.15, headR * 0.72, 1, 0.6, 0.4));
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
      default: e = null;
    }
    if (e) head.add(e);
  }
  if (def.snout === 'pig') {
    { const sn = part(new THREE.CylinderGeometry(0.13, 0.14, 0.1, 16), belly, 0, -0.06, headR * 0.98); sn.rotation.x = Math.PI / 2; head.add(sn); }
    for (const s of [-1, 1]) head.add(part(S(0.025, 6, 4), dark, s * 0.045, -0.06, headR * 1.04));
  } else if (def.snout) {
    head.add(part(S(0.15, 12, 8), belly, 0, -0.1, headR * 0.85, 1.1, 0.8, 0.9));
    head.add(part(S(0.05, 8, 6), dark, 0, -0.02, headR * 1.08));
  }
  if (def.beak) {
    const bk = part(new THREE.ConeGeometry(0.08, 0.22, 8), m(def.beak, divine), 0, -0.05, headR * 1.0);
    bk.rotation.x = Math.PI / 2;
    head.add(bk);
  }
  if (def.whiskers) {
    const wm = new THREE.MeshBasicMaterial({ color: 0x333333 });
    for (const s of [-1, 1]) for (const k of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.012), wm);
      w.position.set(s * 0.22, -0.08 + k * 0.03, headR * 0.82); w.rotation.z = s * k * 0.15;
      head.add(w);
    }
  }
  if (def.horns) for (const s of [-1, 1]) { const h = part(new THREE.ConeGeometry(0.06, 0.32, 8), m(def.horns, divine), s * 0.16, headR * 0.9, -0.08); h.rotation.x = -0.5; head.add(h); }
  if (def.horn) {
    const hm = new THREE.MeshStandardMaterial({ color: def.horn, emissive: def.horn, emissiveIntensity: divine ? 1.4 : 0.5, metalness: 0.5, roughness: 0.2 });
    const h = part(new THREE.ConeGeometry(0.07, 0.5, 10), hm, 0, headR * 1.05, headR * 0.35); h.rotation.x = 0.35; head.add(h);
  }
  if (def.antlers) {
    const am = m(def.antlers, divine);
    for (const s of [-1, 1]) {
      const a = part(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6), am, s * 0.18, headR * 1.05, -0.05); a.rotation.z = -s * 0.35; head.add(a);
      const b = part(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), am, s * 0.3, headR * 1.25, 0.02); b.rotation.z = s * 0.6; head.add(b);
    }
  }
  if (def.mane) {
    const cols = divine ? [0xfff4b0, 0xd8ccff, 0xa9f5ff, 0xffd6f5] : [0xff7ab8, 0xffd23f, 0x7ad8ff, 0xb98cff];
    for (let k = 0; k < 5; k++) head.add(part(S(0.1, 8, 6), m(cols[k % 4], divine, { emissive: cols[k % 4], emissiveIntensity: divine ? 0.8 : 0.25 }), 0, headR * 0.8 - k * 0.12, -headR * 0.6 - k * 0.05));
  }
  if (def.spots) for (let k = 0; k < 5; k++) body.add(part(S(0.05, 6, 4), white, (k - 2) * 0.12, 0.92, -0.1 + (k % 2) * 0.15));

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, def.body === 'tall' ? 0.4 : 0.55, def.body === 'long' ? -0.7 : -0.45);
  body.add(tail);
  switch (def.tail) {
    case 'stub': tail.add(part(S(0.1, 8, 6), main, 0, 0.05, 0)); break;
    case 'puff': tail.add(part(S(0.16, 10, 8), belly, 0, 0, 0)); break;
    case 'long': { const t = part(new THREE.CylinderGeometry(0.05, 0.07, 0.6, 8), main, 0, 0.25, -0.12); t.rotation.x = -0.5; tail.add(t); break; }
    case 'bushy': { tail.add(part(S(0.2, 12, 8), main, 0, 0.18, -0.15, 0.9, 0.9, 1.6)); tail.add(part(S(0.12, 10, 8), belly, 0, 0.26, -0.42)); break; }
    case 'curl': tail.add(part(new THREE.TorusGeometry(0.08, 0.03, 6, 12, Math.PI * 1.6), main, 0, 0.05, -0.02)); break;
    case 'spike': { const t = part(new THREE.ConeGeometry(0.16, 0.7, 8), main, 0, 0.05, -0.3); t.rotation.x = -Math.PI / 2 - 0.3; tail.add(t);
      tail.add(part(new THREE.ConeGeometry(0.09, 0.2, 4), m(def.horns ?? def.belly, divine), 0, 0.2, -0.55)); break; }
  }

  // wings
  const wings = [];
  if (def.wings || divine) {
    const type = def.wings || 'feather';
    const wm = divine ? new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffc94a, emissiveIntensity: 0.55, roughness: 0.3, side: THREE.DoubleSide })
                      : m(type === 'bat' ? def.main : def.belly, false, { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.42, def.body === 'tall' ? 0.85 : 0.75, -0.05);
      if (type === 'small' || type === 'flipper') w.add(part(S(0.18, 10, 8), wm, s * 0.06, -0.08, 0, 0.35, 1, 0.8));
      else if (type === 'bat') {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(s * 0.9, 0.35); shape.lineTo(s * 0.75, -0.05); shape.lineTo(s * 0.55, 0.05); shape.lineTo(s * 0.4, -0.15); shape.lineTo(0, -0.15);
        const wmesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), wm);
        wmesh.rotation.x = -0.3; wmesh.castShadow = true;
        w.add(wmesh);
      } else { // feather
        for (let k = 0; k < 4; k++) {
          const f = part(S(0.14, 8, 6), wm, s * (0.18 + k * 0.14), 0.12 - k * 0.04, -k * 0.03, 1.6, 0.35, 0.6);
          f.rotation.z = s * (0.35 - k * 0.12);
          w.add(f);
        }
      }
      body.add(w);
      wings.push({ g: w, s, type });
    }
  }
  if (def.flame) {
    const fm = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: divine ? 0xffe9a0 : 0xffa020, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 });
    for (let k = 0; k < 3; k++) { const fl = part(new THREE.ConeGeometry(0.06, 0.3, 6), fm, (k - 1) * 0.1, headR * 1.05, -0.05 - Math.abs(k - 1) * 0.05); fl.rotation.x = -0.3; head.add(fl); }
  }

  // divine adornments
  let halo = null, aura = null;
  if (divine) {
    halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd66b, emissiveIntensity: 2.4 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, headR + 0.35, 0);
    head.add(halo);
    aura = makeGlowSprite(0xffe9a0, 2.6, 0.28);
    aura.position.y = 0.8;
    g.add(aura);
  } else if (def.rarity === 'legendary') {
    aura = makeGlowSprite(new THREE.Color(RARITY.legendary.color).getHex(), 2.4, 0.25);
    aura.position.y = 0.8;
    g.add(aura);
  }

  g.userData = { species, def, body, head, tail, wings, halo, aura, flyer, divine };
  return g;
}
