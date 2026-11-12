import * as THREE from 'three';
import { ZONES, LANE, DIVINE_EGGS, HUGE_EGG_CHANCE, HUGE_LUCKY_CHANCE, WORLD } from '../config.js';
import { mat, mesh, neonMat, textTexture, signPlane, eggGeometry, eggMaterial, mulberry32, angleDamp, roundRect } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';
import { createGuardian } from '../entities/guardians.js';
import { state } from '../state.js';

const EGG_GEO = eggGeometry(0.42, 1.08, 24);
const PED_R = 1.4, PED_H = 0.6, EGG_X = 11.5;
const DIV_R = 2.0, DIV_H = 0.9;
const WALL_H = 3.4;
const WAKE_TIME = 0.55;      // seconds a Guardian takes to wake up after its egg is grabbed
const SLEEPY_DUST = 3;       // extra wake-up seconds with the Sleepy Dust boost

function iconTexture(ch, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 110px "Lilita One", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#000'; g.strokeText(ch, 64, 70);
  g.fillStyle = color; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_ALERT = iconTexture('!', '#ff3b3b');
const hexStr = (c) => '#' + new THREE.Color(c).getHexString();

/** Collects many copies of one mesh and builds a single InstancedMesh (one draw call). */
class Batch {
  constructor(geo, material, { cast = true } = {}) { this.geo = geo; this.mat = material; this.cast = cast; this.m = []; }
  add(x, y, z, { s = 1, sx = s, sy = s, sz = s, rx = 0, ry = 0, rz = 0 } = {}) {
    Batch.d.position.set(x, y, z); Batch.d.rotation.set(rx, ry, rz); Batch.d.scale.set(sx, sy, sz);
    Batch.d.updateMatrix(); this.m.push(Batch.d.matrix.clone());
    return this;
  }
  build(parent) {
    if (!this.m.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.m.length);
    this.m.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.castShadow = this.cast; im.receiveShadow = true;
    im.computeBoundingSphere();
    parent.add(im);
    return im;
  }
}
Batch.d = new THREE.Object3D();

/**
 * The Egg Lane: one long walled runway heading north from the plaza, through 10 themed lands.
 * Eggs sit on pedestals in two lines; each land also has one permanent Divine egg at its far end.
 * Guardians sleep until you grab an egg they protect — then they wake up and chase you.
 */
export class Lane {
  constructor({ scene, colliders, daynight, events }) {
    this.scene = scene;
    this.colliders = colliders;
    this.daynight = daynight;
    this.events = events;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.zones = [];
    this.eggs = [];
    this.guards = [];
    this.anims = [];
    this.rnd = mulberry32(99);

    this.buildShell();
    ZONES.forEach((def, i) => this.zones.push(this.buildZone(def, i)));
  }

  neon(color, intensity, flicker = true) {
    const m = neonMat(color, intensity);
    this.daynight.registerNeon(m, flicker);
    return m;
  }

  // ── walls, connectors, entrance and the far portal ──
  buildShell() {
    const g = this.group, C = this.colliders;
    const W = LANE.halfW;
    const stone = mat(0xd9c9a3, { roughness: 0.95 });
    const wallStone = mat(0xbfb39a, { roughness: 0.9 });
    const cap = mat(0xe8dcc0);
    let prev = LANE.start + 2;
    const gaps = [];
    for (const z of ZONES) { gaps.push([prev, z.z0]); prev = z.z1; }
    gaps.push([prev, LANE.end]);
    for (const [a, b] of gaps) {
      const len = a - b, mid = (a + b) / 2;
      g.add(mesh(new THREE.BoxGeometry(W * 2, 0.1, len), stone, { y: 0.05, z: mid, cast: false }));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.BoxGeometry(1, WALL_H, len), wallStone, { x: s * (W + 0.5), y: WALL_H / 2, z: mid }));
        g.add(mesh(new THREE.BoxGeometry(1.2, 0.25, len), cap, { x: s * (W + 0.5), y: WALL_H + 0.1, z: mid, cast: false }));
        C.box(s * (W + 0.5), mid, 1, len, WALL_H + 0.6, { noWalk: true });
      }
    }
    // end wall + portal
    C.box(0, LANE.end - 0.5, W * 2 + 2, 1, WALL_H + 0.6, { noWalk: true });
    g.add(mesh(new THREE.BoxGeometry(W * 2 + 2, WALL_H, 1), wallStone, { y: WALL_H / 2, z: LANE.end - 0.5 }));
    const portal = mesh(new THREE.TorusGeometry(9, 0.6, 12, 64), this.neon(0x9dff3a, 2.6), { y: 11, z: LANE.end - 1, cast: false });
    g.add(portal);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.6, 48), new THREE.MeshBasicMaterial({ color: 0x3aff8a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.set(0, 11, LANE.end - 1.1); disc.userData.noAO = true;
    g.add(disc);
    this.portal = { ring: portal, disc };

    // entrance arch from the plaza
    const z = LANE.start;
    const archMat = mat(0xff4d7e);
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(1.6, 14, 1.6), archMat, { x: s * (W + 0.5), y: 7, z }));
      C.circle(s * (W + 0.5), z, 1.0, 15, { noWalk: true });
    }
    g.add(mesh(new THREE.BoxGeometry(W * 2 + 3, 1.2, 1.8), archMat, { y: 14, z }));
    const tex = textTexture(['EGG LANE', '10 lands • the further you go, the better the eggs'], { w: 1024, h: 256, bg: '#e8364f', border: '#ffe066', size: 104 });
    const sign = signPlane(tex, 16, 4, true);
    sign.material.emissiveIntensity = 0.35;
    this.daynight.registerNeon(sign.material, true);
    sign.position.set(0, 17, z + 0.95);
    g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = z - 0.95; g.add(back);
    C.camBox(0, z, W * 2 + 4, 2.2, 13.2, 19.2);
  }

  buildZone(def, index) {
    const g = this.group, C = this.colliders;
    const W = LANE.halfW;
    const zone = { def, index, eggs: [], guards: [], pedestals: [], z0: def.z0, z1: def.z1, len: def.z0 - def.z1, mid: (def.z0 + def.z1) / 2 };
    const theme = def.id;
    const { len, mid } = zone;
    const dark = !!def.dark;

    // floor (+ a themed path down the middle)
    const floorOpts = {
      forest: { roughness: 1 }, desert: { roughness: 1 }, farm: { roughness: 0.95 }, ice: { roughness: 0.12, metalness: 0.15 },
      fire: { roughness: 0.9, flatShading: true }, ocean: { roughness: 0.35, metalness: 0.2 }, dino: { roughness: 1 },
    }[theme];
    const floorMat = dark ? new THREE.MeshStandardMaterial({ color: def.floor, roughness: 0.35, metalness: 0.6 }) : mat(def.floor, floorOpts);
    g.add(mesh(new THREE.BoxGeometry(W * 2, 0.1, len), floorMat, { y: 0.05, z: mid, cast: false }));
    const pathCol = { forest: 0x8a6a3a, desert: 0xd9b26e, farm: 0xb89a5a, ice: 0xeaf8ff, ocean: 0xe8d6a0, dino: 0x6a5030 }[theme];
    if (pathCol) g.add(mesh(new THREE.BoxGeometry(7, 0.02, len - 2), mat(pathCol, { roughness: theme === 'ice' ? 0.1 : 1 }), { y: 0.105, z: mid, cast: false }));
    if (dark) {
      const edges = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(W * 2, len, 8, Math.round(len / 4))), new THREE.LineBasicMaterial({ color: def.trim, transparent: true, opacity: 0.35 }));
      edges.rotation.x = -Math.PI / 2; edges.position.set(0, 0.11, mid);
      g.add(edges);
    }
    // glowing centre stripe pointing the way home
    const stripeMat = this.neon(def.trim, dark ? 1.2 : 0.8, false);
    const stripes = new Batch(new THREE.BoxGeometry(0.5, 0.04, 3), stripeMat, { cast: false });
    for (let z = def.z0 - 3; z > def.z1 + 2; z -= 6) stripes.add(0, 0.13, z);
    stripes.build(g);

    // themed walls
    const wallOpts = {
      forest: { roughness: 0.95 }, desert: { roughness: 0.9, flatShading: true }, ice: { roughness: 0.3 }, fire: { flatShading: true },
      ocean: { roughness: 0.7, flatShading: true }, dino: { roughness: 1, flatShading: true },
    }[theme] || { roughness: 0.8 };
    const wallMat = mat(def.wall, wallOpts);
    const glowTrim = dark || theme === 'fire' || theme === 'ice' || theme === 'ocean';
    const trimMat = glowTrim ? this.neon(def.trim, dark ? 2.2 : 1.3) : mat(def.trim, { roughness: 0.7 });
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(1, WALL_H, len), wallMat, { x: s * (W + 0.5), y: WALL_H / 2, z: mid }));
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.22, len), trimMat, { x: s * (W + 0.5), y: WALL_H + 0.1, z: mid, cast: false }));
      C.box(s * (W + 0.5), mid, 1, len, WALL_H + 0.6, { noWalk: true });
    }

    // land gate arch with sign (facing the player coming from home)
    const archCol = { forest: 0x6b4a2b, desert: 0xd9b26e, farm: 0x8b5a2b, ice: 0xbfe9ff, ocean: 0xff7a5a, dino: 0x8a7a62 }[theme];
    const archMat = archCol ? mat(archCol, { flatShading: theme === 'dino' || theme === 'desert' }) : wallMat;
    const orbMat = { farm: mat(0xc0392b), forest: mat(0x5fdc4a), desert: mat(0xffcf4a, { metalness: 0.6, roughness: 0.3 }), dino: mat(0xffa53a) }[theme] || trimMat;
    const az = def.z0 + 1;
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(1.8, 13, 1.8), archMat, { x: s * (W + 0.3), y: 6.5, z: az }));
      g.add(mesh(new THREE.SphereGeometry(0.75, 14, 10), orbMat, { x: s * (W + 0.3), y: 13.7, z: az, cast: false }));
      C.circle(s * (W + 0.3), az, 1.1, 14, { noWalk: true });
    }
    g.add(mesh(new THREE.BoxGeometry(W * 2 + 3, 1, 1.6), archMat, { y: 12.6, z: az }));
    const tex = textTexture([`${def.emoji} ${def.name.toUpperCase()}`, `Land ${index + 1} • ${def.guards} Guardian${def.guards > 1 ? 's' : ''} • outrun them at 👟${def.needWalk}+`],
      { w: 1024, h: 256, bg: 'rgba(15,12,30,0.92)', border: hexStr(def.trim), size: 92 });
    const sign = signPlane(tex, 12, 3, true);
    sign.material.emissiveIntensity = 0.5;
    this.daynight.registerNeon(sign.material, true);
    sign.position.set(0, 15.4, az + 0.85);
    g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = az - 0.85; g.add(back);
    C.camBox(0, az, W * 2 + 4, 2, 12, 17);

    this.decorate(zone, trimMat);

    // pedestals + eggs in two lines
    zone.eggMat = eggMaterial(def);
    const platCol = { forest: 0x7a5a3a, desert: 0xe0c080, farm: 0xc89b5a, ice: 0xe8f6ff, fire: 0x3a1c18, ocean: 0xffd0c0, dino: 0x9a8a72 }[theme];
    const platMat = dark ? mat(0x241c48, { metalness: 0.6, roughness: 0.3 }) : mat(platCol, { roughness: 0.6, flatShading: theme === 'fire' || theme === 'dino' });
    const ringMat = this.neon(def.color, 1.4);
    const nestMat = mat({ ice: 0xdff4ff, ocean: 0xf2d6b0, future: 0x3a4250, alien: 0x4a2a6a, cosmic: 0x3a2a6a }[theme] ?? 0x8a5a2b, { flatShading: true, roughness: 1 });
    const pedGeo = new THREE.CylinderGeometry(PED_R, PED_R + 0.25, PED_H, 24);
    const ringGeo = new THREE.TorusGeometry(PED_R + 0.02, 0.07, 6, 32);
    const nestGeo = new THREE.TorusGeometry(0.62, 0.22, 6, 12);
    const top = def.z0 - 8, bottom = def.z1 + 17;
    for (let k = 0; k < def.eggs; k++) {
      const side = k % 2 ? 1 : -1;
      const z = top - (k * (top - bottom)) / Math.max(1, def.eggs - 1);
      const x = side * EGG_X;
      g.add(mesh(pedGeo, platMat, { x, y: PED_H / 2, z }));
      g.add(mesh(ringGeo, ringMat, { x, y: PED_H, z, rx: Math.PI / 2, cast: false }));
      g.add(mesh(nestGeo, nestMat, { x, y: PED_H + 0.1, z, rx: Math.PI / 2 }));
      C.circle(x, z, PED_R, PED_H);
      zone.pedestals.push({ x, z, r: PED_R });
      const egg = this.makeEgg(zone, k, x, z, PED_H);
      zone.eggs.push(egg);
      this.eggs.push(egg);
    }

    // the land's permanent Divine egg, on a golden pedestal at the far end
    zone.divineDef = DIVINE_EGGS[index];
    zone.divineMat = eggMaterial(zone.divineDef);
    {
      const dz = def.z1 + 7;
      const gold = mat(0xffd23f, { metalness: 0.7, roughness: 0.28, emissive: 0x6a4a00, emissiveIntensity: 0.3 });
      g.add(mesh(new THREE.CylinderGeometry(DIV_R + 0.4, DIV_R + 0.7, 0.3, 32), mat(0xfff3d0, { roughness: 0.4 }), { y: 0.15, z: dz }));
      g.add(mesh(new THREE.CylinderGeometry(DIV_R, DIV_R + 0.2, DIV_H, 32), gold, { y: DIV_H / 2, z: dz }));
      g.add(mesh(new THREE.TorusGeometry(DIV_R + 0.05, 0.1, 8, 40), this.neon(def.trim, 1.8), { y: DIV_H, z: dz, rx: Math.PI / 2, cast: false }));
      g.add(mesh(new THREE.TorusGeometry(0.75, 0.25, 8, 16), gold, { y: DIV_H + 0.1, z: dz, rx: Math.PI / 2 }));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(0.22, 0.32, 4.2, 6), gold, { x: s * 3.6, y: 2.1, z: dz }));
        const gem = mesh(new THREE.OctahedronGeometry(0.45, 0), this.neon(def.trim, 1.6), { x: s * 3.6, y: 4.8, z: dz, cast: false });
        g.add(gem);
        this.anims.push((t) => { gem.rotation.y = t * 1.4; gem.position.y = 4.8 + Math.sin(t * 2 + s) * 0.15; });
        C.circle(s * 3.6, dz, 0.4, 4.4, { noWalk: true });
      }
      C.circle(0, dz, DIV_R, DIV_H);
      zone.pedestals.push({ x: 0, z: dz, r: DIV_R });
      const egg = this.makeEgg(zone, def.eggs, 0, dz, DIV_H, true);
      zone.eggs.push(egg);
      this.eggs.push(egg);
      // respawn countdown sign
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ltex = new THREE.CanvasTexture(canvas); ltex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, transparent: true, depthWrite: false }));
      label.scale.set(5, 1.25, 1); label.position.set(0, 3.4, dz); label.visible = false; label.userData.noAO = true;
      g.add(label);
      egg.label = { sprite: label, canvas, tex: ltex, key: '' };
    }

    // Guardians: each sleeps at a post in the middle of its slice of the land and protects the eggs there
    for (let k = 0; k < def.guards; k++) {
      const s0 = def.z0 - (len * k) / def.guards, s1 = def.z0 - (len * (k + 1)) / def.guards;
      const post = { x: (k % 2 ? 1 : -1) * 5.5, z: (s0 + s1) / 2 };
      const guard = this.makeGuard(zone, post, k);
      for (const e of zone.eggs) if ((e.z <= s0 && e.z > s1) || (e.divine && k === def.guards - 1)) { e.guardian = guard; guard.eggs.push(e); }
      zone.guards.push(guard);
      this.guards.push(guard);
    }
    for (const e of zone.eggs) if (!e.guardian) { e.guardian = zone.guards[zone.guards.length - 1]; e.guardian.eggs.push(e); }
    return zone;
  }

  // ── land scenery (outside the walls) ──
  decorate(zone, trimMat) {
    const g = this.group, def = zone.def, r = this.rnd, W = LANE.halfW;
    const z0 = zone.z0, z1 = zone.z1;
    const out = (s, a = 3, b = 10) => s * (W + a + r() * (b - a));
    const each = (step, fn, start = 4) => { for (let z = z0 - start; z > z1; z -= step) for (const s of [-1, 1]) fn(s, z + (r() - 0.5) * step * 0.5); };

    switch (def.id) {
      case 'forest': {
        const trunk = new Batch(new THREE.CylinderGeometry(0.35, 0.5, 3, 7), mat(0x6b4a2b, { roughness: 1 }));
        const pine = new Batch(new THREE.ConeGeometry(2.4, 4.2, 8), mat(0x2f7a3a, { flatShading: true }));
        const pine2 = new Batch(new THREE.ConeGeometry(1.8, 3.4, 8), mat(0x3f9a46, { flatShading: true }));
        const bush = new Batch(new THREE.IcosahedronGeometry(1.1, 0), mat(0x4a9a3a, { flatShading: true }));
        const stem = new Batch(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8), mat(0xfff3e0));
        const capB = new Batch(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8342a));
        each(9, (s, z) => {
          const x = out(s, 3.5, 14), k = 0.8 + r() * 0.7;
          trunk.add(x, 1.5 * k, z, { s: k }); pine.add(x, (3 + 1.6) * k, z, { s: k }); pine2.add(x, (3 + 3.6) * k, z, { s: k });
          if (r() < 0.7) bush.add(s * (W + 2.2), 0.6, z + 3, { s: 0.6 + r() * 0.5 });
          if (r() < 0.6) { const mx = s * (W + 2 + r() * 2), mz = z - 3; stem.add(mx, 0.35, mz); capB.add(mx, 0.65, mz); }
        });
        [trunk, pine, pine2, bush, stem, capB].forEach((b) => b.build(g));
        break;
      }
      case 'desert': {
        const cactus = mat(0x3f9a46, { flatShading: true });
        const body = new Batch(new THREE.CylinderGeometry(0.5, 0.55, 4, 8), cactus);
        const arm = new Batch(new THREE.CylinderGeometry(0.32, 0.32, 1.6, 8), cactus);
        const armOut = new Batch(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 8), cactus);
        const rock = new Batch(new THREE.DodecahedronGeometry(1, 0), mat(0xc28a4a, { flatShading: true }));
        const pyr = new Batch(new THREE.ConeGeometry(9, 9, 4), mat(0xe0b870, { flatShading: true }));
        each(11, (s, z) => {
          const x = out(s, 3, 10);
          body.add(x, 2, z); arm.add(x + 0.95, 2.6, z, { }); armOut.add(x + 0.55, 2.0, z, { rz: Math.PI / 2 });
          arm.add(x - 0.95, 3.0, z); armOut.add(x - 0.55, 2.4, z, { rz: Math.PI / 2 });
          if (r() < 0.6) rock.add(s * (W + 2.5), 0.4, z + 4, { s: 0.5 + r() * 0.8, ry: r() * 6 });
        });
        for (let z = z0 - 20; z > z1; z -= 34) for (const s of [-1, 1]) pyr.add(s * (W + 26 + r() * 10), 4.5, z, { ry: Math.PI / 4 });
        [body, arm, armOut, rock, pyr].forEach((b) => b.build(g));
        break;
      }
      case 'farm': {
        const barnM = mat(0xc0392b), roofM = mat(0x5a3a2a, { flatShading: true });
        for (const s of [-1, 1]) {
          const barn = new THREE.Group();
          barn.add(mesh(new THREE.BoxGeometry(6, 4, 7), barnM, { y: 2 }));
          barn.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 7.6, 3, 1), roofM, { y: 5.8, rx: -Math.PI / 2 }));
          barn.add(mesh(new THREE.BoxGeometry(0.1, 2.8, 2.2), mat(0xf6efe0), { x: -s * 3.02, y: 1.4, cast: false }));
          barn.position.set(s * (W + 7), 0, zone.mid);
          g.add(barn);
        }
        const hay = new Batch(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 12), mat(0xe8c35a, { roughness: 1 }));
        const post = new Batch(new THREE.BoxGeometry(0.25, 1.4, 0.25), mat(0xf6efe0));
        const rail = new Batch(new THREE.BoxGeometry(0.12, 0.18, 4), mat(0xf6efe0));
        const corn = new Batch(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 5), mat(0x7ab84a));
        const cob = new Batch(new THREE.CapsuleGeometry(0.14, 0.35, 3, 6), mat(0xffd23f));
        for (let z = z0 - 4; z > z1; z -= 14) for (const s of [-1, 1]) hay.add(s * (W + 2.6), 0.9, z + r() * 4, { rz: Math.PI / 2 });
        for (let z = z0 - 2; z > z1; z -= 4) for (const s of [-1, 1]) {
          post.add(s * (W + 1.6), 0.7, z); rail.add(s * (W + 1.6), 0.95, z - 2); rail.add(s * (W + 1.6), 0.5, z - 2);
        }
        for (let z = z0 - 3; z > z1; z -= 2.2) for (const s of [-1, 1]) for (let c = 0; c < 3; c++) {
          if (Math.abs(z - zone.mid) < 6) continue;
          const x = s * (W + 13 + c * 1.6);
          corn.add(x, 1.1, z); cob.add(x + 0.15, 1.4, z, { rz: 0.3 });
        }
        [hay, post, rail, corn, cob].forEach((b) => b.build(g));
        break;
      }
      case 'ice': {
        const cm = new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: 0x3fd8ff, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
        this.daynight.registerNeon(cm, true);
        const spike = new Batch(new THREE.OctahedronGeometry(0.9, 0), cm);
        const snowM = mat(0xffffff, { roughness: 0.9 });
        const ball = new Batch(new THREE.SphereGeometry(1, 14, 10), snowM);
        const nose = new Batch(new THREE.ConeGeometry(0.1, 0.5, 6), mat(0xff8a1a));
        const pine = new Batch(new THREE.ConeGeometry(2, 5, 8), mat(0xeaf6ff, { flatShading: true }));
        each(8.4, (s, z) => { const hh = 3 + r() * 6; spike.add(out(s, 4, 10), hh / 2, z, { sx: 1, sy: hh / 1.6, sz: 1, rz: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.6 }); });
        each(26, (s, z) => {
          const x = s * (W + 3.5);
          ball.add(x, 0.8, z, { s: 0.85 }); ball.add(x, 2.0, z, { s: 0.6 }); ball.add(x, 2.9, z, { s: 0.42 });
          nose.add(x - s * 0.45, 2.95, z, { rz: s * Math.PI / 2 });
        }, 12);
        each(15, (s, z) => pine.add(out(s, 12, 20), 2.5, z, { s: 0.8 + r() * 0.6 }));
        [spike, ball, nose, pine].forEach((b) => b.build(g));
        break;
      }
      case 'fire': {
        const lavaMat = this.neon(0xff4a00, 2.4);
        for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(5, 0.06, zone.len - 6), lavaMat, { x: s * (W + 4.5), y: 0.14, z: zone.mid, cast: false }));
        const rock = new Batch(new THREE.DodecahedronGeometry(1, 0), mat(0x2a1412, { flatShading: true }));
        each(11, (s, z) => rock.add(s * (W + 9 + r() * 4), 0.8, z, { s: 1.4 + r() * 1.6, ry: r() * 6 }));
        rock.build(g);
        for (let z = z0 - 25; z > z1; z -= 40) for (const s of [-1, 1]) {
          const vx = s * (W + 30 + r() * 10);
          g.add(mesh(new THREE.ConeGeometry(12, 14, 9, 1, true), mat(0x3a1c18, { flatShading: true, side: THREE.DoubleSide }), { x: vx, y: 7, z, cast: false }));
          g.add(mesh(new THREE.CircleGeometry(3.2, 12), lavaMat, { x: vx, y: 13.2, z, rx: -Math.PI / 2, cast: false }));
        }
        break;
      }
      case 'ocean': {
        const corals = [0xff5ca8, 0xffa53a, 0xb05ae0, 0x5af0ff].map((c) => mat(c, { roughness: 0.7, flatShading: true }));
        const branchB = corals.map((m) => new Batch(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6), m));
        const tipB = corals.map((m) => new Batch(new THREE.SphereGeometry(0.35, 8, 6), m));
        const weed = new Batch(new THREE.BoxGeometry(0.25, 1, 0.06), mat(0x2fa86a, { side: THREE.DoubleSide }));
        const shell = new Batch(new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffe0d0, { roughness: 0.4 }));
        each(7, (s, z) => {
          const x = out(s, 2.6, 9), c = Math.floor(r() * 4);
          for (let b = 0; b < 3; b++) {
            const a = (b - 1) * 0.5, h = 1.6 + r();
            branchB[c].add(x + Math.sin(a) * 0.6, h / 2 + 0.2, z, { sy: h / 2.2, rz: a });
            tipB[c].add(x + Math.sin(a) * (0.6 + h * 0.5), h + 0.2, z);
          }
          const wx = out(s, 2, 12), h = 3 + r() * 4;
          weed.add(wx, h / 2, z + 2, { sy: h, ry: r() * 3 });
          if (r() < 0.5) shell.add(s * (W + 2), 0.1, z - 2, { s: 0.6 + r() * 0.6 });
        });
        [...branchB, ...tipB, weed, shell].forEach((b) => b.build(g));
        // a sunken treasure chest on each side
        for (const s of [-1, 1]) {
          const chest = new THREE.Group();
          chest.add(mesh(new THREE.BoxGeometry(2.4, 1.3, 1.6), mat(0x7a4a22)));
          chest.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 12, 1, false, 0, Math.PI), mat(0x8a5a2b), { y: 0.65, rz: Math.PI / 2, ry: Math.PI / 2 }));
          chest.add(mesh(new THREE.BoxGeometry(2.5, 0.2, 1.7), mat(0xffd23f, { metalness: 0.7, roughness: 0.3 }), { y: 0.3 }));
          chest.add(makeGlowSprite(0xffd23f, 3, 0.3));
          chest.position.set(s * (W + 6), 0.65, zone.mid + s * 10); chest.rotation.y = s * 0.4;
          g.add(chest);
        }
        break;
      }
      case 'dino': {
        const fernM = mat(0x3f8a2a, { flatShading: true, side: THREE.DoubleSide });
        const frond = new Batch(new THREE.ConeGeometry(0.6, 3.2, 4), fernM);
        const trunk = new Batch(new THREE.CylinderGeometry(0.4, 0.55, 6, 7), mat(0x7a5a3a, { roughness: 1, flatShading: true }));
        const leaf = new Batch(new THREE.ConeGeometry(0.8, 4.5, 4), mat(0x4aa83a, { flatShading: true }));
        const bone = new Batch(new THREE.TorusGeometry(2.4, 0.22, 6, 14, Math.PI), mat(0xf2e6d0, { roughness: 0.6 }));
        const spine = new Batch(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), mat(0xf2e6d0, { roughness: 0.6 }));
        const eggB = new Batch(eggGeometry(0.42, 1.08, 12), mat(0xe8e0c8, { roughness: 0.6 }));
        each(9, (s, z) => {
          const fx = s * (W + 2.6);
          for (let k = 0; k < 5; k++) frond.add(fx, 1.2, z, { rz: Math.cos(k * 1.26) * 0.9, rx: Math.sin(k * 1.26) * 0.9 });
          const tx = out(s, 7, 15);
          trunk.add(tx, 3, z + 3);
          for (let k = 0; k < 6; k++) leaf.add(tx + Math.cos(k * 1.05) * 1.8, 6.2, z + 3 + Math.sin(k * 1.05) * 1.8, { rz: Math.cos(k * 1.05) * 1.6, rx: -Math.sin(k * 1.05) * 1.6 });
        });
        for (let z = z0 - 30, n = 0; z > z1 + 10; z -= 46, n++) {
          const s = n % 2 ? 1 : -1, x = s * (W + 9);
          spine.add(x, 3.6, z, { rx: Math.PI / 2 });
          for (let k = -3; k <= 3; k++) bone.add(x, 1.2, z + k * 1.2, { ry: Math.PI / 2, s: 1 - Math.abs(k) * 0.1 });
          for (let k = 0; k < 4; k++) eggB.add(-x + Math.cos(k * 1.6) * 0.8, 0, z + Math.sin(k * 1.6) * 0.8, { s: 1.4 });
        }
        [frond, trunk, leaf, bone, spine, eggB].forEach((b) => b.build(g));
        // a distant smoking volcano
        const vx = -(W + 60), vz = zone.mid;
        g.add(mesh(new THREE.ConeGeometry(26, 34, 10, 1, true), mat(0x5a4636, { flatShading: true, side: THREE.DoubleSide }), { x: vx, y: 17, z: vz, cast: false }));
        g.add(mesh(new THREE.CircleGeometry(5, 12), this.neon(0xff5a14, 2), { x: vx, y: 33.5, z: vz, rx: -Math.PI / 2, cast: false }));
        this.volcano = { x: vx, y: 34, z: vz };
        break;
      }
      case 'cosmic': {
        const planetCols = [0xa98bff, 0xff5cf0, 0x5cc8ff, 0xffd36a];
        this.planets = this.planets || [];
        for (let z = z0 - 10; z > z1; z -= 26) {
          for (const s of [-1, 1]) {
            const c = planetCols[Math.floor(r() * planetCols.length)];
            const pm = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.4 });
            this.daynight.registerNeon(pm, true);
            const p = mesh(new THREE.SphereGeometry(1.2 + r() * 1.8, 20, 14), pm, { x: s * (W + 8 + r() * 8), y: 7 + r() * 8, z: z + r() * 10, cast: false });
            if (r() < 0.5) p.add(mesh(new THREE.TorusGeometry(2.8, 0.12, 6, 32), trimMat, { rx: 1.2, cast: false }));
            g.add(p);
            this.planets.push({ mesh: p, y0: p.position.y, ph: r() * 6 });
          }
        }
        const crystal = new Batch(new THREE.OctahedronGeometry(0.7, 0), this.neon(0xd0b8ff, 1.2));
        each(10, (s, z) => crystal.add(s * (W + 2.5 + r() * 3), 0.9, z, { sy: 1.6 + r() * 1.5, rz: (r() - 0.5) * 0.5 }));
        crystal.build(g);
        break;
      }
      case 'future': {
        const cols = [0xff3dcf, 0x18f0ff, 0xb45cff];
        const post = new Batch(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), mat(0x111122, { metalness: 0.8, roughness: 0.2 }));
        const rings = cols.map((c) => new Batch(new THREE.TorusGeometry(0.6, 0.08, 6, 16), this.neon(c, 2.6), { cast: false }));
        let k = 0;
        for (let z = z0 - 6; z > z1; z -= 17) for (const s of [-1, 1]) {
          const x = s * (W + 4);
          post.add(x, 4, z);
          for (const y of [2.5, 5, 7.5]) rings[k++ % 3].add(x, y, z, { rx: Math.PI / 2 });
        }
        // skyline with glowing window strips
        const tower = new Batch(new THREE.BoxGeometry(1, 1, 1), mat(0x141a2a, { metalness: 0.7, roughness: 0.25 }));
        const strip = cols.map((c) => new Batch(new THREE.BoxGeometry(1, 1, 1), this.neon(c, 1.6), { cast: false }));
        for (let z = z0 - 8; z > z1; z -= 13) for (const s of [-1, 1]) {
          const w = 5 + r() * 5, h = 14 + r() * 30, x = s * (W + 14 + r() * 14);
          tower.add(x, h / 2, z, { sx: w, sy: h, sz: w });
          const sc = strip[Math.floor(r() * 3)];
          for (let y = 3; y < h - 1; y += 3.2) sc.add(x - s * (w / 2 + 0.02), y, z, { sx: 0.05, sy: 0.35, sz: w * 0.8 });
        }
        [post, ...rings, tower, ...strip].forEach((b) => b.build(g));
        // hover-cars zipping past above the walls
        this.cars = this.cars || [];
        const carMat = mat(0xe8f0ff, { metalness: 0.8, roughness: 0.2 });
        for (let c = 0; c < 6; c++) {
          const car = new THREE.Group();
          car.add(mesh(new THREE.CapsuleGeometry(0.7, 2.2, 4, 10), carMat, { rx: Math.PI / 2, cast: false }));
          car.add(mesh(new THREE.BoxGeometry(1.2, 0.1, 2.6), this.neon(cols[c % 3], 2.4), { y: -0.6, cast: false }));
          g.add(car);
          this.cars.push({ car, x: (c % 2 ? 1 : -1) * (W + 8 + (c % 3) * 4), y: 12 + (c % 3) * 4, z0, z1, ph: r(), sp: 0.04 + r() * 0.05, dir: c % 2 ? 1 : -1 });
        }
        break;
      }
      case 'alien': {
        const stalkM = mat(0x5a2a7a, { roughness: 0.6 });
        const bulbCols = [0x9dff3a, 0xff5cf0, 0x3affc8];
        const stalk = new Batch(new THREE.CylinderGeometry(0.15, 0.3, 1, 6), stalkM);
        const bulbs = bulbCols.map((c) => new Batch(new THREE.SphereGeometry(0.6, 12, 10), this.neon(c, 1.5), { cast: false }));
        const capM = new Batch(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3affc8, { emissive: 0x1a6a5a, emissiveIntensity: 0.5, roughness: 0.4 }));
        const crater = new Batch(new THREE.TorusGeometry(2.4, 0.5, 6, 18), mat(0x3a2a4a, { flatShading: true, roughness: 1 }));
        each(7, (s, z) => {
          const x = out(s, 2.6, 12), h = 2 + r() * 5;
          stalk.add(x, h / 2, z, { sy: h, rz: (r() - 0.5) * 0.3 });
          bulbs[Math.floor(r() * 3)].add(x, h + 0.3, z, { s: 0.7 + r() * 0.6 });
          if (r() < 0.35) { const mx = out(s, 3, 8); stalk.add(mx, 0.6, z + 3, { sy: 1.2, sx: 1.6, sz: 1.6 }); capM.add(mx, 1.1, z + 3, { s: 0.7 + r() * 0.4 }); }
          if (r() < 0.25) crater.add(out(s, 10, 22), 0.1, z, { rx: Math.PI / 2, s: 0.8 + r() });
        });
        [stalk, ...bulbs, capM, crater].forEach((b) => b.build(g));
        // hovering UFOs with a tractor beam
        this.ufos = this.ufos || [];
        for (let k = 0; k < 4; k++) {
          const u = new THREE.Group();
          u.add(mesh(new THREE.CylinderGeometry(3.2, 1.2, 0.8, 24), mat(0xc6ced6, { metalness: 0.85, roughness: 0.2 }), { cast: false }));
          u.add(mesh(new THREE.SphereGeometry(1.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9dff3a, emissive: 0x3a8a1a, emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), { y: 0.3, cast: false }));
          u.add(mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 24), this.neon(bulbCols[k % 3], 2.2), { y: -0.2, rx: Math.PI / 2, cast: false }));
          const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9dff3a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          beam.position.y = -7.2; beam.userData.noAO = true;
          u.add(beam);
          const s = k % 2 ? 1 : -1;
          u.position.set(s * (W + 14 + r() * 8), 15, z0 - 20 - k * (zone.len - 40) / 3);
          g.add(u);
          this.ufos.push({ u, y0: 15, x0: u.position.x, ph: r() * 6 });
        }
        break;
      }
    }
  }

  makeEgg(zone, slot, x, z, baseY, divine = false) {
    const group = new THREE.Group();
    const m = new THREE.Mesh(EGG_GEO, divine ? zone.divineMat : zone.eggMat);
    m.castShadow = true;
    group.add(m);
    const color = divine ? zone.def.trim : zone.def.color;
    const halo = makeGlowSprite(color, 4.2, 0);
    halo.position.y = 0.6;
    group.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: divine ? 0xffd23f : 0xffe066, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.noAO = true;
    group.add(ring);
    // tall light beam so HUGE / Divine eggs can be spotted from far down the lane
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 8.6; beam.userData.noAO = true;
    group.add(beam);
    this.group.add(group);
    const egg = { zone, slot, group, mesh: m, halo, ring, beam, x, z, baseY, huge: false, divine, state: 'nest', timer: 0, hugeMat: null, wob: Math.random() * 10, guardian: null, def: divine ? zone.divineDef : zone.def };
    this.roll(egg);
    this.placeInNest(egg);
    return egg;
  }

  /** Re-roll a regular egg's HUGE status (Divine eggs are never HUGE). */
  roll(egg, { forceHuge = false } = {}) {
    const color = egg.divine ? egg.zone.def.trim : egg.zone.def.color;
    egg.huge = !egg.divine && (forceHuge || Math.random() < (state.boost('luck') ? HUGE_LUCKY_CHANCE : HUGE_EGG_CHANCE));
    if (egg.divine) egg.mesh.material = egg.zone.divineMat;
    else if (egg.huge) {
      if (!egg.hugeMat) { egg.hugeMat = egg.zone.eggMat.clone(); egg.hugeMat.emissive = new THREE.Color(color); }
      egg.mesh.material = egg.hugeMat;
    } else egg.mesh.material = egg.zone.eggMat;
    egg.halo.material.color.setHex(color);
    egg.beam.material.color.setHex(egg.divine ? 0xffe9a0 : color);
    egg.baseScale = egg.huge ? 2.1 : egg.divine ? 1.45 : 1;
    egg.group.scale.setScalar(egg.baseScale);
    const glow = egg.huge || egg.divine;
    egg.halo.material.opacity = glow ? 0.55 : 0;
    egg.ring.material.opacity = glow ? 0.7 : 0;
    egg.beam.visible = glow;
    egg.beam.material.opacity = glow ? 0.22 : 0;
  }

  /** Lucky Clover bought: give every waiting regular egg a fresh roll at the better odds. */
  rerollAll() {
    for (const e of this.eggs) if (e.state === 'nest' && !e.divine && !e.huge) { this.roll(e); if (e.huge) { e.pop = 0; this.events.emit('hugeSpawn', e); } }
  }

  placeInNest(egg) {
    if (egg.group.parent !== this.group) this.group.add(egg.group);
    egg.group.position.set(egg.x, egg.baseY + 0.12, egg.z);
    egg.group.rotation.set(0, 0, 0);
    egg.group.scale.setScalar(egg.baseScale);
    egg.group.visible = true;
    egg.state = 'nest';
    if (egg.label) egg.label.sprite.visible = false;
  }

  /** Called when an egg is delivered home: hide it and start its respawn timer. */
  consume(egg) {
    egg.state = 'respawning';
    egg.timer = egg.divine ? egg.def.respawn * (state.perk('compass') ? 0.5 : 1) : egg.zone.def.respawn;
    egg.group.visible = false;
    this.group.add(egg.group);
  }

  /** Debug: bring every Divine egg back right now. */
  respawnDivines() { for (const e of this.eggs) if (e.divine && e.state === 'respawning') e.timer = 0.01; }

  makeGuard(zone, post, k) {
    const av = createGuardian(zone.def.id, k);
    this.scene.add(av.root);
    av.root.position.set(post.x, 0.1, post.z);

    // red danger ring under an awake Guardian
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14; ring.userData.noAO = true; ring.renderOrder = 2;
    this.scene.add(ring);

    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_ALERT, transparent: true, depthWrite: false }));
    icon.scale.set(1.3, 1.3, 1);
    icon.position.y = 3.6;
    icon.visible = false;
    icon.userData.noAO = true;
    av.root.add(icon);

    return { zone, av, post, eggs: [], state: 'sleep', yaw: 0, ring, ringMat, icon, pos: av.root.position, wakeT: 0, speed: 0, k };
  }

  /** Nearest stealable egg near the player. */
  nearestEgg(x, z, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const e of this.eggs) {
      if (e.state !== 'nest') continue;
      const d = Math.hypot(x - e.x, z - e.z);
      if (d < bd + (e.huge || e.divine ? 0.8 : 0)) { bd = d; best = e; }
    }
    return best;
  }

  /** Land the point is inside (including a little apron at each end), or null. */
  zoneAt(z, pad = 4) {
    for (const zn of this.zones) if (z <= zn.z0 + pad && z >= zn.z1 - pad) return zn;
    return null;
  }

  /** Grabbing an egg wakes the Guardian protecting it (and only that one). */
  wake(egg) {
    const gd = egg.guardian;
    if (!gd || gd.state === 'chase' || gd.state === 'waking') return gd;
    gd.state = 'waking';
    gd.wakeT = WAKE_TIME + (state.boost('sleep') ? SLEEPY_DUST : 0);
    this.events.emit('spotted', gd);
    return gd;
  }

  resetGuards() {
    for (const gd of this.guards) {
      gd.state = 'sleep';
      gd.icon.visible = false;
      gd.pos.set(gd.post.x, 0.1, gd.post.z);
    }
  }

  /** player: { pos, carrying (egg|null), caught, safe } */
  update(dt, t, player, particles) {
    const P = player.pos;
    const playerZone = this.zoneAt(P.z);

    for (const e of this.eggs) {
      if (e.state === 'respawning') {
        e.timer -= dt;
        if (e.label && Math.abs(e.z - P.z) < 160) this.drawDivineLabel(e);
        if (e.timer <= 0) {
          this.roll(e);
          this.placeInNest(e);
          e.group.scale.setScalar(0.01);
          e.pop = 0;
          const c = e.divine ? e.zone.def.trim : e.zone.def.color;
          particles.burst(e.x, e.baseY + 0.8, e.z, e.huge || e.divine ? 60 : 16, { colors: [c, 0xffffff, e.divine ? 0xffd23f : c], speed: e.huge || e.divine ? 7 : 4, life: 0.9, size: 0.35 });
          if (e.huge) this.events.emit('hugeSpawn', e);
          if (e.divine) this.events.emit('divineSpawn', e);
        }
        continue;
      }
      if (e.state !== 'nest') continue;
      if (Math.abs(e.z - P.z) > 260) continue; // far away: skip idle animation
      if (e.pop !== undefined && e.pop < 1) { e.pop = Math.min(1, e.pop + dt * 3); const s = e.baseScale * (1 + Math.sin(e.pop * Math.PI) * 0.3) * e.pop; e.group.scale.setScalar(Math.max(0.01, s)); }
      e.wob += dt;
      e.group.rotation.z = Math.sin(e.wob * 2.3) * 0.05;
      if (e.divine) e.group.rotation.y = t * 0.8;
      if (e.huge || e.divine) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + e.slot);
        if (e.hugeMat && e.huge) e.hugeMat.emissiveIntensity = 0.35 + pulse * 0.9;
        e.halo.material.opacity = e.divine ? 0.25 + pulse * 0.2 : 0.35 + pulse * 0.35;
        e.ring.rotation.z = t;
        e.beam.material.opacity = e.divine ? 0.08 + pulse * 0.08 : 0.14 + pulse * 0.14;
        if (Math.random() < dt * (e.divine ? 26 : 18)) {
          const a = Math.random() * Math.PI * 2;
          const c = e.divine ? (Math.random() < 0.5 ? 0xffe9a0 : e.zone.def.trim) : (Math.random() < 0.5 ? 0xffffff : e.zone.def.color);
          particles.emit({ x: e.x + Math.cos(a) * 1.3, y: e.baseY + 0.3 + Math.random() * 2.4, z: e.z + Math.sin(a) * 1.3, vy: 1.2, vx: -Math.cos(a) * 0.4, vz: -Math.sin(a) * 0.4,
            color: c, size: 0.3, life: 1.2, intensity: 3, twinkle: true });
        }
      }
    }

    if (playerZone) this.ambient(playerZone.def.id, dt, P, particles);
    if (this.planets) for (const p of this.planets) { p.mesh.position.y = p.y0 + Math.sin(t * 0.6 + p.ph) * 0.8; p.mesh.rotation.y = t * 0.3 + p.ph; }
    if (this.cars) for (const c of this.cars) {
      const k = ((t * c.sp + c.ph) % 1 + 1) % 1, z = c.dir > 0 ? c.z0 - k * (c.z0 - c.z1) : c.z1 + k * (c.z0 - c.z1);
      c.car.position.set(c.x, c.y + Math.sin(t * 2 + c.ph * 9) * 0.3, z);
    }
    if (this.ufos) for (const u of this.ufos) { u.u.position.y = u.y0 + Math.sin(t * 0.9 + u.ph) * 1.2; u.u.position.x = u.x0 + Math.sin(t * 0.4 + u.ph) * 3; u.u.rotation.y = t * 0.8; }
    for (const a of this.anims) a(t);
    this.portal.ring.rotation.z = t * 0.5;
    this.portal.disc.material.opacity = 0.25 + Math.sin(t * 2) * 0.07;

    for (const gd of this.guards) this.updateGuard(gd, dt, t, player);
  }

  drawDivineLabel(e) {
    const secs = Math.max(0, Math.ceil(e.timer));
    const text = `✦ Divine returns in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const L = e.label;
    L.sprite.visible = true;
    if (L.key === text) return;
    L.key = text;
    const c = L.canvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(20,12,40,0.8)'; roundRect(g, 6, 6, c.width - 12, c.height - 12, 28); g.fill();
    g.font = '52px "Lilita One", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.strokeStyle = '#000'; g.strokeText(text, 256, 66, 480);
    g.fillStyle = '#ffe9a0'; g.fillText(text, 256, 66, 480);
    L.tex.needsUpdate = true;
  }

  /** Little land-flavoured particles around the player. */
  ambient(id, dt, P, particles) {
    const W = LANE.halfW, rx = () => (Math.random() * 2 - 1) * (W + 6), rz = () => P.z - 30 + Math.random() * 60;
    const roll = (rate) => Math.random() < dt * rate;
    switch (id) {
      case 'forest':
        if (roll(10)) particles.emit({ x: rx(), y: 0.8 + Math.random() * 3, z: rz(), vx: (Math.random() - 0.5) * 0.6, vy: 0.3, vz: (Math.random() - 0.5) * 0.6, color: 0xd8ff6a, size: 0.22, life: 2.4, intensity: 2.5, twinkle: true });
        if (roll(5)) particles.emit({ x: rx(), y: 7, z: rz(), vx: 0.8, vy: -1.2, color: 0x6fd04a, color2: 0xd9a03a, size: 0.3, life: 4, intensity: 0.5 });
        break;
      case 'desert':
        if (roll(14)) particles.emit({ x: -W - 4, y: 0.3 + Math.random() * 1.5, z: rz(), vx: 9 + Math.random() * 4, vy: 0.2, color: 0xf2d9a0, size: 0.45, sizeEnd: 0.9, life: 3, intensity: 0.35, drag: 0.2 });
        break;
      case 'ice':
        if (roll(30)) particles.emit({ x: rx(), y: 10 + Math.random() * 4, z: rz(), vx: 0.4, vy: -1.6, color: 0xffffff, size: 0.2, life: 6, intensity: 1.2, twinkle: true });
        break;
      case 'fire':
        if (roll(14)) {
          const s = Math.random() < 0.5 ? -1 : 1;
          particles.emit({ x: s * (W + 3 + Math.random() * 3), y: 0.3, z: rz(), vx: (Math.random() - 0.5), vy: 3 + Math.random() * 2, vz: (Math.random() - 0.5), color: 0xffc040, color2: 0xff2000, size: 0.3, life: 1.6, gravity: -0.5, intensity: 3 });
        }
        break;
      case 'ocean':
        if (roll(16)) particles.emit({ x: rx(), y: 0.2, z: rz(), vx: (Math.random() - 0.5) * 0.3, vy: 1.6 + Math.random(), color: 0xcff8ff, size: 0.26, life: 3, intensity: 1.2, gravity: -0.3 });
        break;
      case 'dino':
        if (this.volcano && roll(8)) particles.emit({ x: this.volcano.x + (Math.random() - 0.5) * 4, y: this.volcano.y, z: this.volcano.z + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 2, vy: 6 + Math.random() * 4, color: 0xffa040, color2: 0x5a3a2a, size: 1.2, sizeEnd: 3, life: 3, gravity: 1, intensity: 1.5 });
        if (roll(5)) particles.emit({ x: rx(), y: 6, z: rz(), vx: 0.5, vy: -1, color: 0x4aa83a, size: 0.35, life: 4, intensity: 0.4 });
        break;
      case 'cosmic':
        if (roll(20)) particles.emit({ x: (Math.random() * 2 - 1) * 30, y: 4 + Math.random() * 14, z: rz(), vy: 0.2, color: Math.random() < 0.5 ? 0xffffff : 0xa98bff, size: 0.25, life: 2.5, intensity: 3, twinkle: true });
        break;
      case 'future':
        if (roll(14)) particles.emit({ x: rx(), y: 0.2, z: rz(), vy: 3 + Math.random() * 3, color: Math.random() < 0.5 ? 0x18f0ff : 0xff3dcf, size: 0.16, life: 1.2, intensity: 3 });
        break;
      case 'alien':
        if (roll(14)) particles.emit({ x: rx(), y: 0.3, z: rz(), vx: (Math.random() - 0.5) * 0.4, vy: 0.8 + Math.random(), color: 0x9dff3a, color2: 0xff5cf0, size: 0.3, life: 3, intensity: 2.2, twinkle: true });
        break;
    }
  }

  updateGuard(gd, dt, t, player) {
    const P = player.pos;
    const def = gd.zone.def, pos = gd.pos;
    const theirs = player.carrying && player.carrying.guardian === gd && !player.safe && !player.caught;
    const runSpeed = def.guardSpeed * (state.boost('goo') ? 0.75 : 1);

    // asleep and far away: nothing to do
    if (gd.state === 'sleep' && Math.abs(pos.z - P.z) > 320) { gd.av.root.visible = false; return; }
    gd.av.root.visible = true;

    let tx = null, tz = null, spd = 0, chasing = false;
    if (gd.state === 'waking') {
      gd.wakeT -= dt;
      gd.yaw = angleDamp(gd.yaw, Math.atan2(P.x - pos.x, P.z - pos.z), 8, dt);
      if (!theirs) gd.state = 'return';
      else if (gd.wakeT <= 0) gd.state = 'chase';
    }
    if (gd.state === 'chase') {
      if (!theirs) gd.state = 'return';
      else { spd = runSpeed; tx = P.x; tz = P.z; chasing = true; }
    }
    if (gd.state === 'return') {
      if (theirs) { gd.state = 'chase'; spd = runSpeed; tx = P.x; tz = P.z; chasing = true; }
      else if (Math.hypot(gd.post.x - pos.x, gd.post.z - pos.z) < 0.6) { gd.state = 'sleep'; }
      else { tx = gd.post.x; tz = gd.post.z; spd = Math.min(30, Math.max(7, def.guardSpeed * 0.5)); }
    }

    // movement (sub-stepped so fast Guardians never tunnel past the player)
    if (tx !== null && spd > 0) {
      const remaining = spd * dt;
      const steps = Math.max(1, Math.ceil(remaining / 0.6));
      const stepLen = remaining / steps;
      for (let s = 0; s < steps; s++) {
        const dx = tx - pos.x, dz = tz - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) break;
        const st = Math.min(d, stepLen);
        pos.x += (dx / d) * st; pos.z += (dz / d) * st;
        this.confine(pos, gd.zone);
        if (chasing && Math.hypot(P.x - pos.x, P.z - pos.z) < 1.3 && Math.abs(P.y - pos.y) < 1.8) {
          this.events.emit('caught', { reason: 'guard', guard: gd });
          break;
        }
      }
      const dx = tx - pos.x, dz = tz - pos.z;
      if (Math.hypot(dx, dz) > 0.05) gd.yaw = angleDamp(gd.yaw, Math.atan2(dx, dz), 10, dt);
      gd.speed = spd;
    } else gd.speed = 0;
    if (gd.state === 'sleep') gd.yaw = angleDamp(gd.yaw, 0, 3, dt); // face home while dozing
    pos.y = 0.1;

    const awake = gd.state === 'chase' || gd.state === 'waking';
    gd.av.root.rotation.y = gd.yaw;
    gd.av.animate(dt, { speed: gd.speed, grounded: true, alert: awake, sleeping: gd.state === 'sleep' });
    gd.ring.position.set(pos.x, 0.14, pos.z);
    gd.ringMat.opacity = awake ? 0.45 + Math.sin(t * 10) * 0.15 : 0;
    gd.ring.visible = awake;
    gd.icon.visible = awake;
    gd.icon.position.y = 3.6 + Math.sin(t * 8) * 0.1 + (gd.state === 'waking' ? 0.3 : 0);
  }

  /** Keep Guardians inside the lane walls, off the egg pedestals and out of the safe plaza. */
  confine(pos, zone) {
    const lim = LANE.halfW - 0.6;
    if (pos.z < LANE.start + 1) pos.x = Math.max(-lim, Math.min(lim, pos.x));
    const hub = WORLD.hub;
    const dh = Math.hypot(pos.x - hub.x, pos.z - hub.z);
    if (dh < hub.safeRadius) { const k = hub.safeRadius / Math.max(dh, 0.01); pos.x = hub.x + (pos.x - hub.x) * k; pos.z = hub.z + (pos.z - hub.z) * k; }
    for (const p of zone.pedestals) {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = p.r + 0.45;
      if (d < min && d > 1e-4) { pos.x = p.x + (dx / d) * min; pos.z = p.z + (dz / d) * min; }
    }
  }
}

export const LANE_CONST = { PED_H };
