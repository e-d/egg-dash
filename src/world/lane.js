import * as THREE from 'three';
import { ZONES, LANE, DIVINE_EGG, HUGE_EGG_CHANCE, HUGE_DIVINE_CHANCE, WORLD } from '../config.js';
import { mat, mesh, neonMat, textTexture, signPlane, eggGeometry, eggTexture, mulberry32, angleDamp } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';
import { Avatar } from '../entities/avatar.js';

const EGG_GEO = eggGeometry(0.42, 1.08, 24);
const PED_R = 1.4, PED_H = 0.6, EGG_X = 11.5;
const WALL_H = 3.4;
const GUARD_SHIRTS = { coop: 0x3b6bd6, crystal: 0x2a3a6a, gold: 0x1c2340, lava: 0x5a1a1a, neon: 0x16162a, cosmic: 0x2a1650 };

function iconTexture(ch, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 110px "Lilita One", Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#000'; g.strokeText(ch, 64, 70);
  g.fillStyle = color; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_ALERT = iconTexture('!', '#ff3b3b');
const TEX_SEARCH = iconTexture('?', '#ffd23f');
const hexStr = (c) => '#' + new THREE.Color(c).getHexString();

/**
 * The Egg Lane: one long walled runway heading north from the plaza.
 * Eggs sit on pedestals in two lines; every zone further out has better eggs and faster guards.
 * No lasers: if you're fast enough you can carry an egg all the way home.
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
    this.rnd = mulberry32(99);
    this.divineActive = false;
    this.divineMat = new THREE.MeshStandardMaterial({ map: eggTexture(DIVINE_EGG.color, DIVINE_EGG.spot, 'stripes'), emissive: 0xffe08a, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.25 });

    this.buildShell();
    ZONES.forEach((def, i) => this.zones.push(this.buildZone(def, i)));
  }

  // ── walls, connectors, entrance and the far portal ──
  buildShell() {
    const g = this.group, C = this.colliders;
    const W = LANE.halfW;
    const stone = mat(0xd9c9a3, { roughness: 0.95 });
    const wallStone = mat(0xbfb39a, { roughness: 0.9 });
    const cap = mat(0xe8dcc0);
    // connector floors + plain walls between zones
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
    const portalMat = neonMat(0xa98bff, 3);
    this.daynight.registerNeon(portalMat, true);
    const portal = mesh(new THREE.TorusGeometry(9, 0.6, 12, 64), portalMat, { y: 11, z: LANE.end - 1, cast: false });
    g.add(portal);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(8.6, 48), new THREE.MeshBasicMaterial({ color: 0x5a2bff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
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
    const tex = textTexture(['EGG LANE', 'the further you go, the better the eggs'], { w: 1024, h: 256, bg: '#e8364f', border: '#ffe066', size: 112 });
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
    const dark = theme === 'neon' || theme === 'cosmic';

    // floor
    const floorMat = dark ? new THREE.MeshStandardMaterial({ color: def.floor, roughness: 0.35, metalness: 0.6 }) : mat(def.floor, { roughness: 0.95 });
    g.add(mesh(new THREE.BoxGeometry(W * 2, 0.1, len), floorMat, { y: 0.05, z: mid, cast: false }));
    if (dark) {
      const edges = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(W * 2, len, 8, Math.round(len / 4))), new THREE.LineBasicMaterial({ color: def.trim, transparent: true, opacity: 0.35 }));
      edges.rotation.x = -Math.PI / 2; edges.position.set(0, 0.11, mid);
      g.add(edges);
    }
    // glowing centre stripe pointing the way home
    const stripeMat = neonMat(def.trim, 1.2);
    this.daynight.registerNeon(stripeMat);
    for (let z = def.z0 - 3; z > def.z1 + 2; z -= 6) g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 3), stripeMat, { y: 0.12, z, cast: false }));

    // themed walls
    const wallMat = mat(def.wall, { roughness: theme === 'gold' ? 0.35 : 0.8, metalness: theme === 'gold' ? 0.45 : 0, flatShading: theme === 'lava' || theme === 'crystal' });
    const trimMat = theme === 'coop' ? mat(def.trim) : neonMat(def.trim, dark ? 2.4 : 1.4);
    if (trimMat.emissive && theme !== 'coop') this.daynight.registerNeon(trimMat, theme !== 'gold');
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(1, WALL_H, len), wallMat, { x: s * (W + 0.5), y: WALL_H / 2, z: mid }));
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.22, len), trimMat, { x: s * (W + 0.5), y: WALL_H + 0.1, z: mid, cast: false }));
      C.box(s * (W + 0.5), mid, 1, len, WALL_H + 0.6, { noWalk: true });
    }

    // zone gate arch with sign (facing the player coming from home)
    const archMat = theme === 'coop' ? mat(0x8b5a2b) : wallMat;
    const az = def.z0 + 1;
    for (const s of [-1, 1]) {
      g.add(mesh(new THREE.BoxGeometry(1.8, 13, 1.8), archMat, { x: s * (W + 0.3), y: 6.5, z: az }));
      const orb = mesh(new THREE.SphereGeometry(0.7, 14, 10), theme === 'coop' ? mat(0xc0392b) : trimMat, { x: s * (W + 0.3), y: 13.6, z: az, cast: false });
      g.add(orb);
      C.circle(s * (W + 0.3), az, 1.1, 14, { noWalk: true });
    }
    g.add(mesh(new THREE.BoxGeometry(W * 2 + 3, 1, 1.6), archMat, { y: 12.6, z: az }));
    const tex = textTexture([def.name.toUpperCase(), `${def.guards} guard${def.guards > 1 ? 's' : ''} • outrun them at 👟${def.needWalk}+`], { w: 1024, h: 256, bg: 'rgba(15,12,30,0.92)', border: hexStr(def.color), size: 96 });
    const sign = signPlane(tex, 12, 3, true);
    sign.material.emissiveIntensity = 0.5;
    this.daynight.registerNeon(sign.material, true);
    sign.position.set(0, 15.4, az + 0.85);
    g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = az - 0.85; g.add(back);
    C.camBox(0, az, W * 2 + 4, 2, 12, 17);

    this.decorate(zone, wallMat, trimMat);

    // pedestals + eggs in two lines
    zone.eggMat = new THREE.MeshStandardMaterial({ map: eggTexture(def.color, def.spot, index % 2 ? 'stripes' : 'spots'), roughness: 0.35,
      metalness: theme === 'gold' ? 0.55 : 0.05, emissive: def.color, emissiveIntensity: dark ? 0.5 : 0.06 });
    const platMat = dark ? mat(0x241c48, { metalness: 0.6, roughness: 0.3 }) : mat(theme === 'coop' ? 0xc89b5a : 0xe9e4f2, { roughness: 0.6, metalness: theme === 'gold' ? 0.6 : 0 });
    const ringMat = neonMat(def.color, 1.6);
    this.daynight.registerNeon(ringMat, true);
    const nestMat = mat(0x8a5a2b, { flatShading: true, roughness: 1 });
    const margin = 10;
    for (let k = 0; k < def.eggs; k++) {
      const side = k % 2 ? 1 : -1;
      const z = def.z0 - margin - (k * (len - margin * 2)) / Math.max(1, def.eggs - 1);
      const x = side * EGG_X;
      g.add(mesh(new THREE.CylinderGeometry(PED_R, PED_R + 0.25, PED_H, 24), platMat, { x, y: PED_H / 2, z }));
      g.add(mesh(new THREE.TorusGeometry(PED_R + 0.02, 0.07, 6, 32), ringMat, { x, y: PED_H, z, rx: Math.PI / 2, cast: false }));
      g.add(mesh(new THREE.TorusGeometry(0.62, 0.22, 6, 12), nestMat, { x, y: PED_H + 0.1, z, rx: Math.PI / 2 }));
      C.circle(x, z, PED_R, PED_H);
      zone.pedestals.push({ x, z });
      const egg = this.makeEgg(zone, k, x, z);
      zone.eggs.push(egg);
      this.eggs.push(egg);
    }

    // guards: each patrols its own slice of the zone in a zig-zag loop
    for (let k = 0; k < def.guards; k++) {
      const s0 = def.z0 - (len * k) / def.guards - 4, s1 = def.z0 - (len * (k + 1)) / def.guards + 4;
      let route = [[-8, s0], [8, s0], [8, (s0 + s1) / 2], [-8, (s0 + s1) / 2], [-8, s1], [8, s1]];
      route = route.concat(route.slice(1, -1).reverse());
      if (k % 2) route = route.map(([x, z]) => [-x, z]);
      const guard = this.makeGuard(zone, route.map(([x, z]) => ({ x, z })), k);
      zone.guards.push(guard);
      this.guards.push(guard);
    }
    return zone;
  }

  decorate(zone, wallMat, trimMat) {
    const g = this.group, def = zone.def, r = this.rnd, W = LANE.halfW;
    const out = (s) => s * (W + 4 + r() * 6);
    const step = 14;
    if (def.id === 'coop') {
      const hay = mat(0xe8c35a, { roughness: 1 });
      const barnM = mat(0xc0392b), roofM = mat(0x5a3a2a, { flatShading: true });
      for (const s of [-1, 1]) {
        const barn = new THREE.Group();
        barn.add(mesh(new THREE.BoxGeometry(6, 4, 7), barnM, { y: 2 }));
        // triangular prism roof running along the barn (apex up)
        const roof = mesh(new THREE.CylinderGeometry(3.6, 3.6, 7.6, 3, 1), roofM, { y: 5.8, rx: -Math.PI / 2 });
        barn.add(roof);
        barn.add(mesh(new THREE.BoxGeometry(0.1, 2.8, 2.2), mat(0xf6efe0), { x: -s * 3.02, y: 1.4, cast: false }));
        barn.position.set(s * (W + 7), 0, zone.mid);
        g.add(barn);
      }
      for (let z = zone.z0 - 4; z > zone.z1; z -= step) {
        for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 12), hay, { x: s * (W + 2.6), y: 0.9, z: z + r() * 4, rz: Math.PI / 2 }));
      }
    } else if (def.id === 'crystal') {
      const cm = new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: 0x3fd8ff, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
      this.daynight.registerNeon(cm, true);
      for (let z = zone.z0 - 3; z > zone.z1; z -= step * 0.6) {
        for (const s of [-1, 1]) {
          const hh = 3 + r() * 6;
          g.add(mesh(new THREE.OctahedronGeometry(0.9, 0), cm, { x: out(s), y: hh / 2, z: z + r() * 4, s: [1, hh / 1.6, 1], rz: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.6 }));
        }
      }
    } else if (def.id === 'gold') {
      const gold = mat(0xffcc33, { metalness: 0.55, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.25 });
      const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 16);
      for (let z = zone.z0 - 5; z > zone.z1; z -= step) {
        for (const s of [-1, 1]) {
          const x = out(s), n = 3 + Math.floor(r() * 8);
          for (let k = 0; k < n; k++) g.add(mesh(coinGeo, gold, { x: x + (r() - 0.5) * 0.3, y: 0.15 + k * 0.25, z: z + (r() - 0.5) * 0.3 }));
          g.add(mesh(new THREE.BoxGeometry(1.6, 0.6, 0.8), gold, { x: x + s * 1.8, y: 0.3, z: z + 2 }));
        }
      }
    } else if (def.id === 'lava') {
      const lavaMat = neonMat(0xff4a00, 2.6);
      this.daynight.registerNeon(lavaMat, true);
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.BoxGeometry(5, 0.06, zone.len - 6), lavaMat, { x: s * (W + 4.5), y: 0.14, z: zone.mid, cast: false }));
      }
      const rock = mat(0x2a1412, { flatShading: true });
      for (let z = zone.z0 - 5; z > zone.z1; z -= step * 0.8) {
        for (const s of [-1, 1]) g.add(mesh(new THREE.DodecahedronGeometry(1.4 + r() * 1.6, 0), rock, { x: s * (W + 9 + r() * 4), y: 0.8, z: z + r() * 5 }));
      }
    } else if (def.id === 'neon') {
      const cols = [0xff3dcf, 0x18f0ff, 0xb45cff];
      const post = mat(0x111122, { metalness: 0.8, roughness: 0.2 });
      const rings = cols.map((c) => { const m = neonMat(c, 3); this.daynight.registerNeon(m, true); return m; });
      let k = 0;
      for (let z = zone.z0 - 6; z > zone.z1; z -= step * 1.2) {
        for (const s of [-1, 1]) {
          const x = s * (W + 4);
          g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), post, { x, y: 4, z }));
          for (const y of [2.5, 5, 7.5]) g.add(mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 16), rings[k++ % 3], { x, y, z, rx: Math.PI / 2, cast: false }));
        }
      }
    } else if (def.id === 'cosmic') {
      const planetCols = [0xa98bff, 0xff5cf0, 0x5cc8ff, 0xffd36a];
      this.planets = [];
      for (let z = zone.z0 - 10; z > zone.z1; z -= step * 2) {
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
    }
  }

  makeEgg(zone, slot, x, z) {
    const group = new THREE.Group();
    const m = new THREE.Mesh(EGG_GEO, zone.eggMat);
    m.castShadow = true;
    group.add(m);
    const halo = makeGlowSprite(zone.def.color, 4.2, 0);
    halo.position.y = 0.6;
    group.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.noAO = true;
    group.add(ring);
    // tall light beam so HUGE / Divine eggs can be spotted from far down the lane
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 16, 12, 1, true), new THREE.MeshBasicMaterial({ color: zone.def.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 8.6; beam.userData.noAO = true;
    group.add(beam);
    this.group.add(group);
    const egg = { zone, slot, group, mesh: m, halo, ring, beam, x, z, huge: false, divine: false, state: 'nest', timer: 0, hugeMat: null, wob: Math.random() * 10 };
    this.roll(egg);
    this.placeInNest(egg);
    return egg;
  }

  /** Re-roll an egg's type. Divine eggs have their own (much rarer) HUGE chance. */
  roll(egg, { forceHuge = false, divine = false } = {}) {
    egg.divine = divine;
    egg.huge = forceHuge || Math.random() < (divine ? HUGE_DIVINE_CHANCE : HUGE_EGG_CHANCE);
    const color = divine ? 0xffe08a : egg.zone.def.color;
    if (divine) egg.mesh.material = this.divineMat;
    else if (egg.huge) {
      if (!egg.hugeMat) { egg.hugeMat = egg.zone.eggMat.clone(); egg.hugeMat.emissive = new THREE.Color(color); }
      egg.mesh.material = egg.hugeMat;
    } else egg.mesh.material = egg.zone.eggMat;
    egg.halo.material.color.setHex(color);
    egg.beam.material.color.setHex(color);
    egg.baseScale = (egg.huge ? 2.1 : 1) * (divine ? 1.25 : 1);
    egg.group.scale.setScalar(egg.baseScale);
    const glow = egg.huge || divine;
    egg.halo.material.opacity = glow ? 0.55 : 0;
    egg.ring.material.opacity = glow ? 0.7 : 0;
    egg.beam.visible = glow;
    egg.beam.material.opacity = glow ? 0.22 : 0;
  }

  placeInNest(egg) {
    if (egg.group.parent !== this.group) this.group.add(egg.group);
    egg.group.position.set(egg.x, PED_H + 0.12, egg.z);
    egg.group.rotation.set(0, 0, 0);
    egg.group.scale.setScalar(egg.baseScale);
    egg.group.visible = true;
    egg.state = 'nest';
  }

  /** Called when an egg is delivered home: hide it and start its respawn timer. */
  consume(egg) {
    egg.state = 'respawning';
    egg.timer = egg.zone.def.respawn;
    egg.group.visible = false;
    this.group.add(egg.group);
  }

  makeGuard(zone, route, k) {
    const def = zone.def;
    const av = new Avatar({ kind: 'guard', shirt: GUARD_SHIRTS[def.id], pants: 0x1a1d26, shoes: 0x111111, skin: [0xffd3a8, 0xc68642, 0x8d5524, 0xf1c27d][k % 4], scale: 0.86 });
    this.scene.add(av.root);
    av.root.position.set(route[0].x, 0, route[0].z);

    const half = THREE.MathUtils.degToRad(36);
    const vis = def.vision;
    const sectorMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const sector = new THREE.Mesh(new THREE.CircleGeometry(vis, 24, -Math.PI / 2 - half, half * 2), sectorMat);
    sector.rotation.x = -Math.PI / 2;
    sector.position.y = 0.14;
    sector.userData.noAO = true;
    sector.renderOrder = 2;
    const sectorPivot = new THREE.Group();
    sectorPivot.add(sector);
    this.scene.add(sectorPivot);

    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(half) * vis * 0.6, vis * 0.6, 24, 1, true), coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 1.9, vis * 0.3 + 0.5);
    cone.userData.noAO = true;
    cone.scale.setScalar(1 / 0.86);
    av.root.add(cone);
    av.body.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), mat(0x222222), { x: 0.74, y: 1.15, z: 0.35, rx: Math.PI / 2 }));

    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_ALERT, transparent: true, depthWrite: false }));
    icon.scale.set(1.3, 1.3, 1);
    icon.position.y = 3.6;
    icon.visible = false;
    icon.userData.noAO = true;
    av.root.add(icon);

    return {
      zone, av, route, wp: 1 % route.length, state: 'patrol', yaw: Math.PI, sector, sectorPivot, sectorMat, cone, coneMat, icon,
      pos: av.root.position, lostTimer: 0, pause: 0, speed: 0, vision: vis, halfFov: half, alertCooldown: 0, k,
    };
  }

  /** Nearest stealable egg near the player. */
  nearestEgg(x, z, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const e of this.eggs) {
      if (e.state !== 'nest') continue;
      const d = Math.hypot(x - e.x, z - e.z);
      if (d < bd + (e.huge ? 0.8 : 0)) { bd = d; best = e; }
    }
    return best;
  }

  /** Zone the point is inside (including a little apron at each end), or null. */
  zoneAt(z, pad = 4) {
    for (const zn of this.zones) if (z <= zn.z0 + pad && z >= zn.z1 - pad) return zn;
    return null;
  }

  /** Stealing sets off that zone's alarm: every guard there gives chase. */
  alarm(zone) {
    for (const gd of zone.guards) {
      gd.state = 'chase'; gd.lostTimer = 0;
    }
    this.events.emit('spotted', zone.guards[0]);
  }

  /** DIVINE night: one Divine egg appears in every zone; unclaimed ones fade at dawn. */
  setDivine(on, particles) {
    this.divineActive = on;
    for (const zn of this.zones) {
      if (on) {
        const pick = zn.eggs.find((e) => e.state === 'nest' && !e.huge) || zn.eggs.find((e) => e.state !== 'carried');
        if (!pick) continue;
        this.roll(pick, { divine: true });
        this.placeInNest(pick);
        pick.pop = 0;
        if (particles) particles.burst(pick.x, 2, pick.z, 60, { colors: [0xfff2b0, 0xd9b8ff, 0xffffff], speed: 8, life: 1.4, twinkle: true });
        if (pick.huge) this.events.emit('hugeSpawn', pick);
      } else {
        for (const e of zn.eggs) if (e.divine && e.state === 'nest') { this.roll(e); this.placeInNest(e); }
      }
    }
  }

  resetGuards() {
    for (const gd of this.guards) {
      gd.state = 'patrol';
      gd.icon.visible = false;
      gd.pos.set(gd.route[0].x, 0, gd.route[0].z);
      gd.wp = 1 % gd.route.length;
    }
  }

  /** player: { pos, carrying (egg|null), caught, safe } */
  update(dt, t, player, particles, nightFactor) {
    const P = player.pos;
    const playerZone = this.zoneAt(P.z);

    for (const e of this.eggs) {
      if (e.state === 'respawning') {
        e.timer -= dt;
        if (e.timer <= 0) {
          this.roll(e);
          this.placeInNest(e);
          e.group.scale.setScalar(0.01);
          e.pop = 0;
          particles.burst(e.x, PED_H + 0.8, e.z, e.huge ? 50 : 16, { colors: [e.zone.def.color, 0xffffff], speed: e.huge ? 7 : 4, life: 0.8, size: 0.35 });
          if (e.huge) this.events.emit('hugeSpawn', e);
        }
        continue;
      }
      if (e.state !== 'nest') continue;
      if (Math.abs(e.z - P.z) > 260) continue; // far away: skip idle animation
      if (e.pop !== undefined && e.pop < 1) { e.pop = Math.min(1, e.pop + dt * 3); const s = e.baseScale * (1 + Math.sin(e.pop * Math.PI) * 0.3) * e.pop; e.group.scale.setScalar(Math.max(0.01, s)); }
      e.wob += dt;
      e.group.rotation.z = Math.sin(e.wob * 2.3) * 0.05;
      if (e.huge || e.divine) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + e.slot);
        const m = e.divine ? this.divineMat : e.hugeMat;
        if (m) m.emissiveIntensity = (e.divine ? 0.45 : 0.35) + pulse * (e.divine ? 0.4 : 0.9);
        e.halo.material.opacity = 0.35 + pulse * 0.35;
        e.ring.rotation.z = t;
        e.beam.material.opacity = e.divine ? 0.07 + pulse * 0.07 : 0.14 + pulse * 0.14;
        if (e.divine) e.halo.material.opacity = 0.2 + pulse * 0.15;
        if (Math.random() < dt * 22) {
          const a = Math.random() * Math.PI * 2;
          const c = e.divine ? (Math.random() < 0.5 ? 0xffe9a0 : 0xd0a8ff) : (Math.random() < 0.5 ? 0xffffff : e.zone.def.color);
          particles.emit({ x: e.x + Math.cos(a) * 1.2, y: PED_H + 0.3 + Math.random() * 2.2, z: e.z + Math.sin(a) * 1.2, vy: 1.2, vx: -Math.cos(a) * 0.4, vz: -Math.sin(a) * 0.4,
            color: c, size: 0.3, life: 1.2, intensity: 3, twinkle: true });
        }
      }
    }

    // ambient FX near the player
    if (playerZone) {
      const zid = playerZone.def.id;
      if (zid === 'lava' && Math.random() < dt * 14) {
        const s = Math.random() < 0.5 ? -1 : 1;
        particles.emit({ x: s * (LANE.halfW + 3 + Math.random() * 3), y: 0.3, z: P.z - 30 + Math.random() * 60, vx: (Math.random() - 0.5), vy: 3 + Math.random() * 2, vz: (Math.random() - 0.5),
          color: 0xffc040, color2: 0xff2000, size: 0.3, life: 1.6, gravity: -0.5, intensity: 3 });
      } else if (zid === 'cosmic' && Math.random() < dt * 20) {
        particles.emit({ x: (Math.random() * 2 - 1) * 30, y: 4 + Math.random() * 14, z: P.z - 40 + Math.random() * 80, vy: 0.2,
          color: Math.random() < 0.5 ? 0xffffff : 0xa98bff, size: 0.25, life: 2.5, intensity: 3, twinkle: true });
      }
    }
    if (this.planets) for (const p of this.planets) { p.mesh.position.y = p.y0 + Math.sin(t * 0.6 + p.ph) * 0.8; p.mesh.rotation.y = t * 0.3 + p.ph; }
    this.portal.ring.rotation.z = t * 0.5;
    this.portal.disc.material.opacity = 0.28 + Math.sin(t * 2) * 0.08;

    for (const gd of this.guards) this.updateGuard(gd, dt, t, player, playerZone, nightFactor);
  }

  updateGuard(gd, dt, t, player, playerZone, nightFactor) {
    const P = player.pos;
    const zone = gd.zone, def = zone.def;
    const pos = gd.pos;
    const holdingOurs = player.carrying && player.carrying.zone === zone;
    const relevant = !player.caught && !player.safe && (playerZone === zone || holdingOurs);
    const range = gd.vision * (1 - nightFactor * 0.2);
    gd.alertCooldown -= dt;

    // far, idle guards are frozen to save work
    if (gd.state === 'patrol' && Math.abs(pos.z - P.z) > 320) { gd.sectorPivot.visible = false; return; }
    gd.sectorPivot.visible = true;

    let canSee = false;
    const dxp = P.x - pos.x, dzp = P.z - pos.z;
    const distP = Math.hypot(dxp, dzp);
    if (relevant && distP < range) {
      const ang = Math.atan2(dxp, dzp);
      const da = Math.abs(((ang - gd.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (da < gd.halfFov || distP < 2.4) canSee = true;
    }

    let tx = null, tz = null, spd = 0, chasing = false;
    if (gd.state === 'patrol' || gd.state === 'return') {
      if (canSee) {
        gd.state = 'chase'; gd.lostTimer = 0;
        if (gd.alertCooldown <= 0) { this.events.emit('spotted', gd); gd.alertCooldown = 3; }
      } else {
        const w = gd.route[gd.wp];
        tx = w.x; tz = w.z;
        spd = gd.state === 'return' ? Math.max(8, def.guardSpeed * 0.6) : Math.min(7, 3 + def.guardSpeed * 0.05);
        if (gd.pause > 0) { gd.pause -= dt; spd = 0; gd.yaw += Math.sin(t * 1.5 + gd.k) * dt * 1.2; }
        else if (Math.hypot(w.x - pos.x, w.z - pos.z) < 1) {
          gd.wp = (gd.wp + 1) % gd.route.length;
          if (gd.state === 'patrol') gd.pause = 0.3 + Math.random() * 0.6;
          gd.state = 'patrol';
        }
      }
    }
    if (gd.state === 'chase') {
      if (!relevant) gd.state = 'return';
      else {
        if (canSee) gd.lostTimer = 0; else gd.lostTimer += dt;
        // a guard whose egg you hold never gives up; otherwise they lose interest
        if (!holdingOurs && gd.lostTimer > 2.5) gd.state = 'return';
        else { spd = def.guardSpeed; tx = P.x; tz = P.z; chasing = true; }
      }
    }

    // movement (sub-stepped so fast guards never tunnel past the player)
    if (tx !== null && spd > 0) {
      let remaining = spd * dt;
      const steps = Math.max(1, Math.ceil(remaining / 0.6));
      const stepLen = remaining / steps;
      for (let s = 0; s < steps; s++) {
        const dx = tx - pos.x, dz = tz - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) break;
        const st = Math.min(d, stepLen);
        pos.x += (dx / d) * st; pos.z += (dz / d) * st;
        this.confine(pos, zone);
        if (chasing && Math.hypot(P.x - pos.x, P.z - pos.z) < 1.3 && Math.abs(P.y - pos.y) < 1.8) {
          this.events.emit('caught', { reason: 'guard', guard: gd });
          break;
        }
      }
      const dx = tx - pos.x, dz = tz - pos.z;
      if (Math.hypot(dx, dz) > 0.05) gd.yaw = angleDamp(gd.yaw, Math.atan2(dx, dz), 10, dt);
      gd.speed = spd;
    } else gd.speed = 0;
    pos.y = 0.1;

    gd.av.root.rotation.y = gd.yaw;
    gd.av.animate(dt, { speed: gd.speed, grounded: true, alert: gd.state === 'chase' });

    gd.sectorPivot.position.set(pos.x, pos.y, pos.z);
    gd.sectorPivot.rotation.y = gd.yaw;
    const isChase = gd.state === 'chase';
    gd.sectorMat.color.setHex(isChase ? 0xff3030 : 0xfff2a0);
    gd.sectorMat.opacity = (isChase ? 0.22 : 0.1 + nightFactor * 0.08) * (relevant || isChase ? 1.4 : 1);
    gd.coneMat.opacity = nightFactor * (isChase ? 0.12 : 0.07);
    gd.coneMat.color.setHex(isChase ? 0xff6060 : 0xfff6c8);
    gd.icon.visible = isChase || gd.state === 'return';
    gd.icon.material.map = isChase ? TEX_ALERT : TEX_SEARCH;
    gd.icon.position.y = 3.6 + Math.sin(t * 8) * 0.1;
  }

  /** Keep guards inside the lane walls, off the egg pedestals and out of the safe plaza. */
  confine(pos, zone) {
    const lim = LANE.halfW - 0.6;
    if (pos.z < LANE.start + 1) pos.x = Math.max(-lim, Math.min(lim, pos.x));
    const hub = WORLD.hub;
    const dh = Math.hypot(pos.x - hub.x, pos.z - hub.z);
    if (dh < hub.safeRadius) { const k = hub.safeRadius / Math.max(dh, 0.01); pos.x = hub.x + (pos.x - hub.x) * k; pos.z = hub.z + (pos.z - hub.z) * k; }
    for (const p of zone.pedestals) {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = PED_R + 0.45;
      if (d < min && d > 1e-4) { pos.x = p.x + (dx / d) * min; pos.z = p.z + (dz / d) * min; }
    }
  }
}

export const LANE_CONST = { PED_H };
