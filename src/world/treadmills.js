import * as THREE from 'three';
import { TREADMILLS, formatNum } from '../config.js';
import { state } from '../state.js';
import { mat, mesh, neonMat, textTexture } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';

const LEN = 6.4, WID = 3.2, BELT_Y = 0.46;
export const TREADMILL_AREA = { x: -78, z: 0 };

function beltTexture(def) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const base = new THREE.Color(def.belt), acc = new THREE.Color(def.accent);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 256, 64);
  if (def.cosmic) {
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * 256, Math.random() * 64, 1.5, 1.5); }
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(169,139,255,0.5)'); grd.addColorStop(0.5, 'rgba(255,92,240,0.35)'); grd.addColorStop(1, 'rgba(169,139,255,0.5)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 64);
  }
  const stripeCol = def.glow > 1 ? '#' + acc.getHexString() : 'rgba(255,255,255,0.13)';
  g.fillStyle = stripeCol;
  const n = def.glow > 1 ? 8 : 16;
  for (let i = 0; i < n; i++) g.fillRect(i * (256 / n), 0, def.glow > 1 ? 5 : 3, 64);
  if (def.glow > 1) { g.fillRect(0, 2, 256, 3); g.fillRect(0, 59, 256, 3); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

function makeSignTexture(def, owned) {
  const lines = owned
    ? [`T${def.tier} • ${def.name}`, `+${formatNum(def.speedPerSec)} ⚡/s   +$${formatNum(def.cashPerSec)}/s`]
    : [`🔒 T${def.tier} • ${def.name}`, `$${formatNum(def.cost)}  —  +${formatNum(def.speedPerSec)} ⚡/s`];
  const acc = '#' + new THREE.Color(def.accent).getHexString();
  return textTexture(lines, { w: 640, h: 180, bg: owned ? 'rgba(14,20,40,0.82)' : 'rgba(60,14,24,0.85)', border: owned ? acc : '#ff5a6e', size: 56, stroke: '#000a' });
}

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
      this.list.push(this.build(def, x, z, colliders));
    });
    this.refresh();
    state.on((w) => { if (w === 'treadmills' || w === 'reset') this.refresh(); });
  }

  build(def, x, z, colliders) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.group.add(g);
    const glowA = def.glow > 0;
    const metal = def.metal ?? 0;
    const frameMat = mat(def.frame, { metalness: metal, roughness: metal > 0.5 ? 0.3 : 0.8, flatShading: def.rail === 'stone' });
    const accMat = glowA ? neonMat(def.accent, def.glow) : mat(def.accent, { metalness: metal * 0.8, roughness: 0.5 });
    if (glowA) this.daynight.registerNeon(accMat, true);

    // base pad
    const pad = mesh(new THREE.BoxGeometry(LEN + 2, 0.14, WID + 2), mat(0x232b40, { roughness: 0.9 }), { y: 0.12, cast: false });
    g.add(pad);
    const padTrim = mesh(new THREE.BoxGeometry(LEN + 2.3, 0.1, WID + 2.3), glowA ? accMat : mat(def.accent), { y: 0.09, cast: false });
    g.add(padTrim);

    // deck & side rails
    g.add(mesh(new THREE.BoxGeometry(LEN, 0.3, WID), frameMat, { y: 0.27 }));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(LEN, 0.18, 0.28), accMat, { y: 0.48, z: s * (WID / 2 - 0.1) }));
    // rollers
    for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, WID - 0.4, 12), frameMat, { x: s * (LEN / 2 - 0.25), y: 0.38, rx: Math.PI / 2 }));

    // belt
    const tex = beltTexture(def);
    const beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0,
      emissive: def.glow > 1 ? def.accent : 0x000000, emissiveMap: def.glow > 1 ? tex : null, emissiveIntensity: def.glow > 1 ? def.glow * 0.5 : 0 });
    if (def.glow > 1) this.daynight.registerNeon(beltMat, true);
    const belt = mesh(new THREE.BoxGeometry(LEN - 0.5, 0.06, WID - 0.5), beltMat, { y: BELT_Y - 0.03 });
    g.add(belt);

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
          const holoMat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
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
          const beam = mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.7, 6), neonMat(def.accent, def.glow * 1.4), { x: cx - 1.35, y: railH, z: pz, rz: Math.PI / 2, cast: false });
          g.add(beam);
          const beam2 = mesh(new THREE.CylinderGeometry(0.03, 0.03, railH - 0.5, 6), neonMat(def.accent, def.glow * 1.4), { x: cx, y: (railH + 0.5) / 2, z: pz, cast: false });
          g.add(beam2);
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

    // console head
    const consoleY = def.rail === 'stone' ? 2.6 : 2.25;
    const head = new THREE.Group();
    head.position.set(cx, consoleY, 0);
    const consoleMat = def.rail === 'holo' || def.rail === 'laser' ? mat(0x0b0b14, { metalness: 0.8, roughness: 0.25 }) : frameMat;
    head.add(mesh(new THREE.BoxGeometry(0.5, 0.7, WID - 0.2), consoleMat, { rz: -0.35 }));
    const screenMat = neonMat(def.glow > 0 ? def.accent : 0x7dd3ff, 1.4);
    this.daynight.registerNeon(screenMat, true);
    const screen = mesh(new THREE.PlaneGeometry(1.6, 0.42), screenMat, { x: -0.3, y: -0.02, cast: false });
    screen.rotation.set(0, -Math.PI / 2, 0);   // face the runner (-x)
    screen.rotateX(-0.35);                      // tilt up to match the console
    head.add(screen);
    g.add(head);

    // ── tier-specific extras ──
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
      for (const [px, pz] of [[-LEN / 2 - 0.6, -WID / 2 - 0.6], [-LEN / 2 - 0.6, WID / 2 + 0.6], [LEN / 2 + 0.6, -WID / 2 - 0.6], [LEN / 2 + 0.6, WID / 2 + 0.6]]) {
        for (let k = 0; k < 3; k++) {
          const h = 0.8 + Math.random() * 1.2;
          g.add(mesh(new THREE.ConeGeometry(0.22, h, 5), cm, { x: px + (Math.random() - 0.5) * 0.6, y: h / 2 + 0.1, z: pz + (Math.random() - 0.5) * 0.6, rz: (Math.random() - 0.5) * 0.5, rx: (Math.random() - 0.5) * 0.5 }));
        }
      }
    }
    if (def.lava) {
      const lavaMat = neonMat(0xff4a00, 2.4);
      this.daynight.registerNeon(lavaMat, true);
      for (let k = 0; k < 6; k++) g.add(mesh(new THREE.BoxGeometry(0.6 + Math.random(), 0.05, 0.08), lavaMat, { x: (Math.random() - 0.5) * (LEN - 1), y: 0.43, z: (Math.random() < 0.5 ? -1 : 1) * (WID / 2 + 0.01), ry: 0, cast: false }));
      for (const s of [-1, 1]) {
        const rock = mesh(new THREE.DodecahedronGeometry(0.6, 0), mat(0x2a1210, { flatShading: true }), { x: -LEN / 2 - 0.5, y: 0.4, z: s * (WID / 2 + 0.5) });
        g.add(rock);
        g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), lavaMat, { x: -LEN / 2 - 0.5, y: 0.85, z: s * (WID / 2 + 0.5), cast: false }));
      }
    }
    if (def.holo) {
      const ringMat = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < 3; k++) {
        const ring = mesh(new THREE.TorusGeometry(1.0 + k * 0.25, 0.03, 6, 40), ringMat, { x: 0, y: 3.6 + k * 0.35, cast: false, receive: false });
        ring.userData.noAO = true;
        g.add(ring);
        anim.push((t) => { ring.rotation.x = Math.PI / 2 + Math.sin(t + k) * 0.3; ring.rotation.z = t * (0.6 + k * 0.3); });
      }
    }
    if (def.laser) {
      // scanning laser sheet across the belt
      const scan = mesh(new THREE.PlaneGeometry(WID - 0.4, 1.8), new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }), { y: 1.4, cast: false, receive: false, ry: Math.PI / 2 });
      scan.userData.noAO = true;
      g.add(scan);
      anim.push((t) => { scan.position.x = Math.sin(t * 2.2) * (LEN / 2 - 0.4); });
      for (const s of [-1, 1]) {
        const pylon = mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), mat(0x0b0b12, { metalness: 0.9, roughness: 0.2 }), { x: -LEN / 2 - 0.4, y: 1.6, z: s * (WID / 2 + 0.4) });
        g.add(pylon);
        g.add(mesh(new THREE.BoxGeometry(0.08, 2.8, 0.27), neonMat(def.accent, def.glow), { x: -LEN / 2 - 0.4, y: 1.6, z: s * (WID / 2 + 0.4), cast: false }));
      }
    }
    if (def.cosmic) {
      const planets = [0xa98bff, 0xff5cf0, 0x6cf2ff, 0xffd166];
      planets.forEach((c, k) => {
        const pm = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.3 });
        this.daynight.registerNeon(pm, true);
        const p = mesh(new THREE.SphereGeometry(0.22 + k * 0.05, 16, 12), pm, { cast: false });
        g.add(p);
        const r = 3.4 + k * 0.4, sp = 0.6 + k * 0.25;
        anim.push((t) => { p.position.set(Math.cos(t * sp + k * 1.6) * r, 2.4 + Math.sin(t * sp * 1.3 + k) * 0.8, Math.sin(t * sp + k * 1.6) * r * 0.6); });
      });
      const halo = makeGlowSprite(def.accent, 6, 0.35);
      halo.position.set(0, 2.4, 0);
      g.add(halo);
    }
    if (def.glow >= 2.5) {
      const glow = makeGlowSprite(def.accent, 9, 0.18);
      glow.position.y = 1.2;
      g.add(glow);
    }

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

    return { def, tier: def.tier, group: g, x, z, tex, beltMat, sign, anim, owned: null, speed: 0.15 };
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
    }
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
      const target = tm.tier === activeTier ? 1.6 : (tm.owned ? 0.15 : 0);
      tm.speed += (target - tm.speed) * Math.min(1, dt * 3);
      tm.tex.offset.x -= tm.speed * dt;
      const so = tm.tier === activeTier ? 0.18 : 1;
      tm.sign.material.opacity += (so - tm.sign.material.opacity) * Math.min(1, dt * 6);
      for (const a of tm.anim) a(t);
      // ambient emitters for elemental tiers (only when near camera-ish handled by caller distance)
      if (!tm.near) continue;
      const d = tm.def;
      if (d.lava && Math.random() < dt * 10) particles.emit({ x: tm.x - LEN / 2 - 0.5, y: 0.9, z: tm.z + (Math.random() < 0.5 ? -1 : 1) * (WID / 2 + 0.5), vx: (Math.random() - 0.5), vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5), color: 0xffb020, color2: 0xff2a00, size: 0.25, life: 1.2, gravity: -1, intensity: 3 });
      if (d.ice && Math.random() < dt * 8) particles.emit({ x: tm.x + (Math.random() - 0.5) * LEN, y: 2.5 + Math.random(), z: tm.z + (Math.random() - 0.5) * WID * 1.4, vx: 0, vy: -0.8, vz: 0, color: 0xe8fbff, size: 0.18, life: 2.5, intensity: 1.2, twinkle: true });
      if (d.cosmic && Math.random() < dt * 14) particles.emit({ x: tm.x + (Math.random() - 0.5) * 8, y: 1 + Math.random() * 3.5, z: tm.z + (Math.random() - 0.5) * 6, vy: 0.2, color: Math.random() < 0.5 ? 0xffffff : 0xa98bff, size: 0.18, life: 1.5, intensity: 2.5, twinkle: true });
      if (d.holo && Math.random() < dt * 6) particles.emit({ x: tm.x + (Math.random() - 0.5) * LEN, y: 0.6, z: tm.z + (Math.random() - 0.5) * WID, vy: 1.5, color: d.accent, size: 0.15, life: 1.4, intensity: 2 });
    }
  }

  static get BELT_Y() { return BELT_Y; }
}
