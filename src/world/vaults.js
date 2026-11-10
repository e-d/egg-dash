import * as THREE from 'three';
import { VAULTS, HUGE_EGG_CHANCE, HUGE_EGG_MULT, WORLD } from '../config.js';
import { mat, mesh, neonMat, textTexture, signPlane, eggGeometry, eggTexture, mulberry32, angleDamp } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';
import { Avatar } from '../entities/avatar.js';

const EGG_GEO = eggGeometry(0.42, 1.08, 24);
const PLATFORM_R = 4.3, PLATFORM_H = 0.5, NEST_R = 2.6;
const BEAM_Y = 0.55;
const GUARD_SHIRTS = { coop: 0x3b6bd6, crystal: 0x2a3a6a, gold: 0x1c2340, lava: 0x5a1a1a, neon: 0x16162a };

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

export class Vaults {
  constructor({ scene, colliders, daynight, events }) {
    this.scene = scene;
    this.colliders = colliders;
    this.daynight = daynight;
    this.events = events;
    this.vaults = [];
    this.eggs = [];
    this.guards = [];
    this.lasers = [];
    this.rnd = mulberry32(99);
    VAULTS.forEach((def, i) => this.vaults.push(this.buildVault(def, i)));
  }

  buildVault(def, index) {
    const g = new THREE.Group();
    g.position.set(def.x, 0, def.z);
    this.scene.add(g);
    const S = def.size, h = S / 2;
    const C = this.colliders;
    const theme = def.id;
    const accent = def.spot;
    const vault = { def, index, group: g, eggs: [], guards: [], lasers: [], gate: null, cx: def.x, cz: def.z, half: h };

    // floor
    const floorMat = theme === 'neon' ? new THREE.MeshStandardMaterial({ color: def.floor, roughness: 0.35, metalness: 0.6 }) : mat(def.floor, { roughness: 0.95 });
    g.add(mesh(new THREE.BoxGeometry(S, 0.1, S), floorMat, { y: 0.05, cast: false }));
    if (theme === 'neon') {
      const grid = new THREE.GridHelper(S, 17, 0xff3dcf, 0x18f0ff);
      grid.position.y = 0.11; grid.material.transparent = true; grid.material.opacity = 0.5;
      g.add(grid);
    }

    // walls with a south entrance gap
    const wallH = theme === 'coop' ? 3.1 : 3.8;
    const T = 1;
    const gap = 7;
    const wallMat = mat(def.wall, { roughness: theme === 'gold' ? 0.35 : 0.8, metalness: theme === 'gold' ? 0.45 : 0, flatShading: theme === 'lava' || theme === 'crystal' });
    const trimMat = ['crystal', 'lava', 'neon', 'gold'].includes(theme) ? neonMat(theme === 'gold' ? 0xffd34a : accent, theme === 'neon' ? 2.6 : 1.6) : mat(0xe8d6b0);
    if (trimMat.emissive) this.daynight.registerNeon(trimMat, theme !== 'gold');
    const wall = (x, z, w, d) => {
      g.add(mesh(new THREE.BoxGeometry(w, wallH, d), wallMat, { x, y: wallH / 2, z }));
      g.add(mesh(new THREE.BoxGeometry(w + 0.1, 0.22, d + 0.1), trimMat, { x, y: wallH + 0.05, z, cast: false }));
      if (theme === 'neon') g.add(mesh(new THREE.BoxGeometry(w + 0.04, 0.1, d + 0.04), neonMat(0x18f0ff, 2.2), { x, y: wallH * 0.45, z, cast: false }));
      C.box(def.x + x, def.z + z, w, d, wallH + 0.6, { noWalk: true });
    };
    wall(0, -h, S, T);
    wall(-h, 0, T, S);
    wall(h, 0, T, S);
    const segW = (S - gap) / 2;
    wall(-(gap / 2 + segW / 2), h, segW, T);
    wall(gap / 2 + segW / 2, h, segW, T);
    if (theme === 'coop') {
      // plank lines on the fence
      for (let k = -h + 1; k < h; k += 1.2) {
        g.add(mesh(new THREE.BoxGeometry(0.08, wallH - 0.2, 0.05), mat(0x7a4512), { x: k, y: wallH / 2, z: -h + 0.52, cast: false }));
      }
    }

    // corner towers
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tx = sx * h, tz = sz * h;
      g.add(mesh(new THREE.CylinderGeometry(1.1, 1.3, wallH + 1.6, 8), wallMat, { x: tx, y: (wallH + 1.6) / 2, z: tz }));
      const cap = theme === 'coop'
        ? mesh(new THREE.ConeGeometry(1.5, 1.6, 8), mat(0xc0392b, { flatShading: true }), { x: tx, y: wallH + 2.4, z: tz })
        : mesh(new THREE.SphereGeometry(0.55, 12, 8), trimMat.emissive ? trimMat : neonMat(0xffe7a3, 2), { x: tx, y: wallH + 2.0, z: tz, cast: false });
      g.add(cap);
      C.circle(def.x + tx, def.z + tz, 1.3, wallH + 3, { noWalk: true });
    }

    // entrance arch with name sign
    const archMat = theme === 'coop' ? mat(0x8b5a2b) : wallMat;
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(1.2, wallH + 2.4, 1.4), archMat, { x: sx * (gap / 2 + 0.6), y: (wallH + 2.4) / 2, z: h }));
    g.add(mesh(new THREE.BoxGeometry(gap + 2.6, 1.0, 1.5), archMat, { x: 0, y: wallH + 2.4, z: h }));
    const acc = '#' + new THREE.Color(accent).getHexString();
    const signTex = textTexture([def.name.toUpperCase(), `$${shortNum(def.value)} eggs • ${def.guards} guard${def.guards > 1 ? 's' : ''}`], { w: 1024, h: 256, bg: 'rgba(15,12,30,0.9)', border: acc, size: 96 });
    const signM = signPlane(signTex, 9, 2.25, true);
    signM.material.emissiveIntensity = 0.5;
    this.daynight.registerNeon(signM.material, true);
    signM.position.set(0, wallH + 4.0, h + 0.8);
    g.add(signM);
    const signBack = signM.clone(); signBack.rotation.y = Math.PI; signBack.position.z = h - 0.8;
    g.add(signBack);

    // center platform
    const platMat = theme === 'neon' ? mat(0x241c48, { metalness: 0.6, roughness: 0.3 }) : mat(theme === 'coop' ? 0xc89b5a : 0xe9e4f2, { roughness: 0.6, metalness: theme === 'gold' ? 0.6 : 0 });
    g.add(mesh(new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R + 0.3, PLATFORM_H, 32), platMat, { y: PLATFORM_H / 2 }));
    const ringMat = neonMat(accent, 1.8);
    this.daynight.registerNeon(ringMat, true);
    g.add(mesh(new THREE.TorusGeometry(PLATFORM_R + 0.05, 0.08, 6, 48), ringMat, { y: PLATFORM_H, rx: Math.PI / 2, cast: false }));
    C.circle(def.x, def.z, PLATFORM_R, PLATFORM_H);

    // theme decorations
    this.decorate(g, def, theme, S, wallH, C);

    // nests + eggs
    const shellTex = eggTexture(def.color, def.spot, index % 2 ? 'stripes' : 'spots');
    vault.eggMat = new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.35, metalness: theme === 'gold' ? 0.55 : 0.05,
      emissive: def.color, emissiveIntensity: theme === 'neon' ? 0.5 : 0.06 });
    const nestMat = mat(0x8a5a2b, { flatShading: true, roughness: 1 });
    const nestGeo = new THREE.TorusGeometry(0.62, 0.24, 6, 12);
    for (let s = 0; s < def.slots; s++) {
      const a = (s / def.slots) * Math.PI * 2 + Math.PI / 2;
      const nx = Math.cos(a) * NEST_R, nz = Math.sin(a) * NEST_R;
      const nest = mesh(nestGeo, nestMat, { x: nx, y: PLATFORM_H + 0.12, z: nz, rx: Math.PI / 2 });
      g.add(nest);
      g.add(mesh(new THREE.CircleGeometry(0.55, 12), mat(0xd9b46a), { x: nx, y: PLATFORM_H + 0.02, z: nz, rx: -Math.PI / 2, cast: false }));
      const egg = this.makeEgg(vault, s, nx, nz);
      vault.eggs.push(egg);
      this.eggs.push(egg);
    }

    // guards
    const inset = 3.6;
    const routes = [
      [[-h + inset, -h + inset], [h - inset, -h + inset], [h - inset, h - inset - 1], [-h + inset, h - inset - 1]],
      [[h - inset, h - inset - 1], [h - inset, -h + inset], [-h + inset, -h + inset], [-h + inset, h - inset - 1]],
      [[-h - 4.5, h + 5], [-h - 4.5, -h - 4.5], [h + 4.5, -h - 4.5], [h + 4.5, h + 5]],
      [[-gap / 2 - 3, h - 3.2], [gap / 2 + 3, h - 3.2]],
    ];
    for (let k = 0; k < def.guards; k++) {
      const guard = this.makeGuard(vault, routes[k % routes.length].map(([x, z]) => ({ x: def.x + x, z: def.z + z })), k);
      vault.guards.push(guard);
      this.guards.push(guard);
    }

    // sweeping lasers
    for (let k = 0; k < def.sweepers; k++) {
      const r0 = PLATFORM_R + 0.5, r1 = h - 1.6;
      const pivot = new THREE.Group();
      pivot.position.set(0, BEAM_Y, 0);
      g.add(pivot);
      const beamMat = neonMat(0xff1f3d, 4);
      const beam = mesh(new THREE.CylinderGeometry(0.07, 0.07, r1 - r0, 8), beamMat, { x: (r0 + r1) / 2, rz: Math.PI / 2, cast: false });
      pivot.add(beam);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, r1 - r0, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.x = (r0 + r1) / 2; glow.rotation.z = Math.PI / 2; glow.userData.noAO = true;
      pivot.add(glow);
      const tip = mesh(new THREE.SphereGeometry(0.2, 10, 8), neonMat(0xff4060, 3), { x: r1, cast: false });
      pivot.add(tip);
      const emitter = mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.5, 10), mat(0x222233, { metalness: 0.8, roughness: 0.3 }), { x: r0 - 0.1, y: -0.3 });
      pivot.add(emitter);
      const laser = { type: 'sweep', vault, pivot, r0, r1, angle: k * Math.PI, speed: def.sweepSpeed * (k % 2 ? -1.15 : 1) };
      vault.lasers.push(laser);
      this.lasers.push(laser);
    }

    // entrance laser gate
    if (def.gate) {
      const gate = new THREE.Group();
      gate.position.set(0, 0, h);
      g.add(gate);
      const bars = [];
      const barMat = neonMat(0xff1f3d, 4);
      for (let b = 0; b < 6; b++) {
        const bx = -gap / 2 + 0.6 + b * ((gap - 1.2) / 5);
        const bar = mesh(new THREE.CylinderGeometry(0.05, 0.05, wallH + 1.6, 6), barMat, { x: bx, y: (wallH + 1.6) / 2, cast: false });
        gate.add(bar); bars.push(bar);
      }
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(gap - 1, wallH + 1.6), new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      sheet.position.y = (wallH + 1.6) / 2; sheet.userData.noAO = true;
      gate.add(sheet);
      const period = 6 - index * 0.4;
      vault.gate = { type: 'gate', vault, group: gate, bars, sheet, on: true, period, onTime: period * 0.48, phase: this.rnd() * period, z: def.z + h, x: def.x, halfW: gap / 2 };
      this.lasers.push(vault.gate);
    }

    // huge-egg ground ring markers etc are per egg; the "home" for guards to return to
    vault.entrance = { x: def.x, z: def.z + h };
    return vault;
  }

  decorate(g, def, theme, S, wallH, C) {
    const h = S / 2;
    const r = this.rnd;
    if (theme === 'coop') {
      // barn at the back + hay bales
      const barn = new THREE.Group();
      barn.add(mesh(new THREE.BoxGeometry(7, 4, 4), mat(0xc0392b), { y: 2 }));
      const roof = mesh(new THREE.CylinderGeometry(2.9, 2.9, 7.4, 3, 1), mat(0x5a3a2a, { flatShading: true }), { y: 4.6, rz: Math.PI / 2 });
      roof.rotation.set(0, 0, Math.PI / 2); roof.rotateX(Math.PI / 6);
      barn.add(roof);
      barn.add(mesh(new THREE.BoxGeometry(2, 2.8, 0.1), mat(0xf6efe0), { y: 1.4, z: 2.02, cast: false }));
      // barn sits just behind the back fence so it never blocks the guard's patrol loop
      barn.position.set(-h + 7, 0, -h - 3);
      g.add(barn);
      C.box(def.x - h + 7, def.z - h - 3, 7, 4, 6, { noWalk: true });
      const bales = [[-7.5, -7], [-5.2, -7.8], [-7.9, -4.7], [7.4, -7.2], [7.7, -4.8]];
      for (let k = 0; k < bales.length; k++) {
        const [x, z] = bales[k];
        g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 12), mat(0xe8c35a, { roughness: 1 }), { x, y: 0.9, z, rz: Math.PI / 2 }));
        C.circle(def.x + x, def.z + z, 0.95, 1.8);
      }
    } else if (theme === 'crystal') {
      const cm = new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: 0x3fd8ff, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.9 });
      this.daynight.registerNeon(cm, true);
      for (let k = 0; k < 14; k++) {
        const side = k % 4;
        const t = (r() * 2 - 1) * (h - 3);
        const x = side === 0 ? -h + 1.6 : side === 1 ? h - 1.6 : t;
        const z = side === 2 ? -h + 1.6 : side === 3 ? -h + 1.6 + r() * 3 : t;
        const hh = 1.5 + r() * 2.5;
        g.add(mesh(new THREE.OctahedronGeometry(0.6, 0), cm, { x, y: hh / 2, z, s: [0.8, hh, 0.8], rz: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.6 }));
      }
    } else if (theme === 'gold') {
      const gold = mat(0xffcc33, { metalness: 0.55, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.25 });
      for (let k = 0; k < 8; k++) {
        const x = (k % 2 ? -1 : 1) * (h - 2.4 - r() * 2), z = -h + 3 + (k >> 1) * 4.5;
        for (let s = 0; s < 4; s++) g.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 16), gold, { x: x + (r() - 0.5) * 0.3, y: 0.15 + s * 0.18, z: z + (r() - 0.5) * 0.3 }));
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.4, 0.5), gold, { x: x + 1.1 * (k % 2 ? 1 : -1), y: 0.3, z }));
      }
    } else if (theme === 'lava') {
      const lavaMat = neonMat(0xff4a00, 2.6);
      this.daynight.registerNeon(lavaMat, true);
      for (const [x, z, w, d] of [[-h + 2.2, 0, 2.2, S - 8], [h - 2.2, 0, 2.2, S - 8], [0, -h + 2.2, S - 8, 2.2]]) {
        g.add(mesh(new THREE.BoxGeometry(w, 0.06, d), lavaMat, { x, y: 0.12, z, cast: false }));
        g.add(mesh(new THREE.BoxGeometry(w + 0.6, 0.25, d + 0.6), mat(0x1a0c0a, { flatShading: true }), { x, y: 0.08, z, cast: false }));
      }
      for (let k = 0; k < 6; k++) {
        const x = (r() * 2 - 1) * (h - 6), z = (r() * 2 - 1) * (h - 6);
        if (Math.hypot(x, z) < PLATFORM_R + 6) continue;
        g.add(mesh(new THREE.DodecahedronGeometry(0.9 + r(), 0), mat(0x2a1412, { flatShading: true }), { x, y: 0.5, z }));
        C.circle(def.x + x, def.z + z, 1.3, 1.6);
      }
    } else if (theme === 'neon') {
      const cols = [0xff3dcf, 0x18f0ff, 0xb45cff];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * (h - 4.5), z = Math.sin(a) * (h - 4.5);
        if (z > h - 8 && Math.abs(x) < 6) continue;
        g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 8), mat(0x111122, { metalness: 0.8, roughness: 0.2 }), { x, y: 2.5, z }));
        const nm = neonMat(cols[k % 3], 3);
        this.daynight.registerNeon(nm, true);
        g.add(mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16), nm, { x, y: 1.5, z, rx: Math.PI / 2, cast: false }));
        g.add(mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16), nm, { x, y: 3.5, z, rx: Math.PI / 2, cast: false }));
        C.circle(def.x + x, def.z + z, 0.5, 6);
      }
    }
  }

  makeEgg(vault, slot, nx, nz) {
    const group = new THREE.Group();
    const m = new THREE.Mesh(EGG_GEO, vault.eggMat);
    m.castShadow = true;
    group.add(m);
    const halo = makeGlowSprite(vault.def.color, 4.2, 0);
    halo.position.y = 0.6;
    group.add(halo);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.noAO = true;
    group.add(ring);
    vault.group.add(group);
    const egg = { vault, slot, group, mesh: m, halo, ring, nx, nz, huge: false, state: 'nest', timer: 0, hugeMat: null, wob: Math.random() * 10 };
    this.roll(egg);
    this.placeInNest(egg);
    return egg;
  }

  roll(egg, forceHuge = false) {
    egg.huge = forceHuge || Math.random() < HUGE_EGG_CHANCE;
    if (egg.huge) {
      if (!egg.hugeMat) {
        egg.hugeMat = egg.vault.eggMat.clone();
        egg.hugeMat.emissive = new THREE.Color(egg.vault.def.color);
      }
      egg.mesh.material = egg.hugeMat;
    } else egg.mesh.material = egg.vault.eggMat;
    egg.group.scale.setScalar(egg.huge ? 2.1 : 1);
    egg.halo.material.opacity = egg.huge ? 0.55 : 0;
    egg.ring.material.opacity = egg.huge ? 0.7 : 0;
  }

  placeInNest(egg) {
    if (egg.group.parent !== egg.vault.group) egg.vault.group.add(egg.group);
    egg.group.position.set(egg.nx, PLATFORM_H + 0.12, egg.nz);
    egg.group.rotation.set(0, 0, 0);
    egg.group.visible = true;
    egg.state = 'nest';
  }

  value(egg) { return egg.vault.def.value * (egg.huge ? HUGE_EGG_MULT : 1); }

  makeGuard(vault, route, k) {
    const av = new Avatar({ kind: 'guard', shirt: GUARD_SHIRTS[vault.def.id], pants: 0x1a1d26, shoes: 0x111111, skin: [0xffd3a8, 0xc68642, 0x8d5524, 0xf1c27d][k % 4], scale: 0.86 });
    this.scene.add(av.root);
    const start = route[0];
    av.root.position.set(start.x, 0, start.z);

    // vision: ground sector + flashlight cone
    const half = THREE.MathUtils.degToRad(34);
    const vis = vault.def.vision;
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
    av.root.add(cone);
    cone.scale.setScalar(1 / 0.86);
    const torch = mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), mat(0x222222), { x: 0.74, y: 1.15, z: 0.35, rx: Math.PI / 2 });
    av.body.add(torch);

    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_ALERT, transparent: true, depthWrite: false }));
    icon.scale.set(1.3, 1.3, 1);
    icon.position.y = 3.6;
    icon.visible = false;
    icon.userData.noAO = true;
    av.root.add(icon);

    return {
      vault, av, route, wp: 1 % route.length, state: 'patrol', yaw: 0, sector, sectorPivot, sectorMat, cone, coneMat, icon,
      pos: av.root.position, lostTimer: 0, pause: 0, speed: 0, vision: vis, halfFov: half, alertCooldown: 0, k,
    };
  }

  /** Nearest stealable egg near the player. */
  nearestEgg(x, z, maxD = 2.6) {
    let best = null, bd = maxD;
    for (const e of this.eggs) {
      if (e.state !== 'nest') continue;
      const ex = e.vault.cx + e.nx, ez = e.vault.cz + e.nz;
      const d = Math.hypot(x - ex, z - ez);
      if (d < bd + (e.huge ? 0.8 : 0)) { bd = d; best = e; }
    }
    return best;
  }

  vaultAt(x, z, pad = 0) {
    for (const v of this.vaults) if (Math.abs(x - v.cx) < v.half + pad && Math.abs(z - v.cz) < v.half + pad) return v;
    return null;
  }

  resetGuards() {
    for (const gd of this.guards) {
      gd.state = 'patrol';
      gd.icon.visible = false;
      gd.pos.set(gd.route[0].x, 0, gd.route[0].z);
      gd.wp = 1 % gd.route.length;
    }
  }

  /**
   * player: { pos, carrying (egg|null), caught, safe }
   */
  update(dt, t, player, particles, nightFactor) {
    const P = player.pos;
    const playerInVault = this.vaultAt(P.x, P.z, 0.8);

    // eggs idle / huge glow
    for (const e of this.eggs) {
      if (e.state === 'respawning') {
        e.timer -= dt;
        if (e.timer <= 0) {
          this.roll(e);
          this.placeInNest(e);
          e.group.scale.setScalar(0.01);
          e.pop = 0;
          const wx = e.vault.cx + e.nx, wz = e.vault.cz + e.nz;
          particles.burst(wx, PLATFORM_H + 0.8, wz, e.huge ? 50 : 16, { colors: [e.vault.def.color, 0xffffff], speed: e.huge ? 7 : 4, life: 0.8, size: 0.35 });
          if (e.huge) this.events.emit('hugeSpawn', e);
        }
        continue;
      }
      if (e.state !== 'nest') continue;
      const target = e.huge ? 2.1 : 1;
      if (e.pop !== undefined && e.pop < 1) { e.pop = Math.min(1, e.pop + dt * 3); const s = target * (1 + Math.sin(e.pop * Math.PI) * 0.3) * e.pop; e.group.scale.setScalar(Math.max(0.01, s)); }
      e.wob += dt;
      e.group.rotation.z = Math.sin(e.wob * 2.3) * 0.05;
      if (e.huge && e.hugeMat) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4 + e.slot);
        e.hugeMat.emissiveIntensity = 0.35 + pulse * 0.9;
        e.halo.material.opacity = 0.35 + pulse * 0.35;
        e.ring.rotation.z = t;
        if (Math.random() < dt * 22) {
          const wx = e.vault.cx + e.nx, wz = e.vault.cz + e.nz;
          const a = Math.random() * Math.PI * 2;
          particles.emit({ x: wx + Math.cos(a) * 1.2, y: PLATFORM_H + 0.3 + Math.random() * 2.2, z: wz + Math.sin(a) * 1.2, vy: 1.2, vx: -Math.cos(a) * 0.4, vz: -Math.sin(a) * 0.4,
            color: Math.random() < 0.5 ? 0xffffff : e.vault.def.color, size: 0.3, life: 1.2, intensity: 3, twinkle: true });
        }
      }
    }

    // lava embers & neon sparks
    for (const v of this.vaults) {
      if (v.def.id === 'lava' && Math.random() < dt * 12) {
        particles.emit({ x: v.cx + (Math.random() * 2 - 1) * (v.half - 2), y: 0.3, z: v.cz + (Math.random() * 2 - 1) * (v.half - 2), vx: (Math.random() - 0.5), vy: 2.5 + Math.random() * 2, vz: (Math.random() - 0.5),
          color: 0xffc040, color2: 0xff2000, size: 0.25, life: 1.6, gravity: -0.5, intensity: 3 });
      }
    }

    // lasers
    for (const L of this.lasers) {
      if (L.type === 'sweep') {
        L.angle += L.speed * dt;
        L.pivot.rotation.y = -L.angle;
        if (player.caught || player.safe) continue;
        const v = L.vault;
        const dx = P.x - v.cx, dz = P.z - v.cz;
        const r = Math.hypot(dx, dz);
        if (r < L.r0 - 0.5 || r > L.r1 + 0.5) continue;
        if (P.y > BEAM_Y + 0.22) continue;  // jumped over
        const pa = Math.atan2(dz, dx);
        let da = Math.abs(((pa - L.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (da * r < 0.55) this.events.emit('caught', { reason: 'laser' });
      } else {
        L.phase = (L.phase + dt) % L.period;
        const onNow = L.phase < L.onTime;
        const warn = !onNow && L.phase > L.period - 0.7;
        L.on = onNow;
        const vis = onNow || (warn && Math.sin(t * 40) > 0);
        for (const b of L.bars) b.visible = vis;
        L.sheet.visible = onNow;
        if (onNow && !player.caught && Math.abs(P.z - L.z) < 0.55 && Math.abs(P.x - L.x) < L.halfW) this.events.emit('caught', { reason: 'laser' });
      }
    }

    // guards
    for (const gd of this.guards) this.updateGuard(gd, dt, t, player, playerInVault, nightFactor);
  }

  updateGuard(gd, dt, t, player, playerInVault, nightFactor) {
    const P = player.pos;
    const v = gd.vault;
    const def = v.def;
    const pos = gd.pos;
    const dxp = P.x - pos.x, dzp = P.z - pos.z;
    const distP = Math.hypot(dxp, dzp);
    const relevant = !player.caught && !player.safe && (playerInVault === v || (player.carrying && player.carrying.vault === v));
    const range = gd.vision * (1 - nightFactor * 0.2);
    gd.alertCooldown -= dt;

    let canSee = false;
    if (relevant && distP < range) {
      const ang = Math.atan2(dxp, dzp);
      let da = Math.abs(((ang - gd.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if ((da < gd.halfFov || distP < 2.2) && !this.colliders.segmentBlocked(pos.x, pos.z, P.x, P.z, 2)) canSee = true;
    }

    let tx = null, tz = null, spd = 0;
    if (gd.state === 'patrol' || gd.state === 'return') {
      if (canSee) {
        gd.state = 'chase'; gd.lostTimer = 0;
        if (gd.alertCooldown <= 0) { this.events.emit('spotted', gd); gd.alertCooldown = 3; }
      } else {
        const w = gd.route[gd.wp];
        tx = w.x; tz = w.z;
        spd = Math.min(5.5, def.guardSpeed * 0.42);
        if (gd.pause > 0) { gd.pause -= dt; spd = 0; gd.yaw += Math.sin(t * 1.5 + gd.k) * dt * 1.2; }
        else if (Math.hypot(w.x - pos.x, w.z - pos.z) < 0.8) { gd.wp = (gd.wp + 1) % gd.route.length; gd.pause = 0.6 + Math.random() * 0.8; gd.state = 'patrol'; }
      }
    }
    if (gd.state === 'chase') {
      if (!relevant) { gd.state = 'return'; }
      else {
        if (canSee) gd.lostTimer = 0; else gd.lostTimer += dt;
        const leash = Math.hypot(P.x - v.cx, P.z - v.cz) > v.half + 46;
        if (leash || gd.lostTimer > (player.carrying ? 5 : 2.5)) gd.state = 'return';
        else {
          spd = def.guardSpeed;
          tx = P.x; tz = P.z;
          // route through the entrance when walls are in the way
          const gIn = Math.abs(pos.x - v.cx) < v.half && Math.abs(pos.z - v.cz) < v.half;
          const pIn = Math.abs(P.x - v.cx) < v.half && Math.abs(P.z - v.cz) < v.half;
          if (gIn !== pIn && this.colliders.segmentBlocked(pos.x, pos.z, P.x, P.z, 2)) {
            const ex = v.entrance.x, ez = v.entrance.z + (gIn ? -1.5 : 2.5);
            if (Math.hypot(ex - pos.x, ez - pos.z) > 1.2) { tx = ex; tz = ez; }
            else { tx = ex; tz = v.entrance.z + (gIn ? 3 : -3); }
          } else if (!pIn && !gIn && this.colliders.segmentBlocked(pos.x, pos.z, P.x, P.z, 2)) {
            // both outside but wall between: go around via the entrance side
            const ex = v.entrance.x + Math.sign(pos.x - v.cx || 1) * (v.half + 3), ez = v.entrance.z + 3;
            tx = ex; tz = ez;
          }
          if (distP < 1.25 && Math.abs(P.y - pos.y) < 1.6) this.events.emit('caught', { reason: 'guard', guard: gd });
        }
      }
    }
    if (gd.state === 'return' && tx === null) {
      const w = gd.route[gd.wp];
      tx = w.x; tz = w.z; spd = Math.min(7, def.guardSpeed * 0.5);
      if (Math.hypot(w.x - pos.x, w.z - pos.z) < 1) gd.state = 'patrol';
    }

    // movement
    if (tx !== null && spd > 0) {
      const dx = tx - pos.x, dz = tz - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, spd * dt);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        gd.yaw = angleDamp(gd.yaw, Math.atan2(dx, dz), 10, dt);
      }
      gd.speed = spd;
    } else gd.speed = 0;
    this.colliders.resolve(pos, 0.45, 0.65);
    pos.y = this.colliders.groundAt(pos.x, pos.z, pos.y, 0.45);

    gd.av.root.rotation.y = gd.yaw;
    gd.av.animate(dt, { speed: gd.speed, grounded: true, alert: gd.state === 'chase' });

    // visuals
    gd.sectorPivot.position.set(pos.x, pos.y, pos.z);
    gd.sectorPivot.rotation.y = gd.yaw;
    const chasing = gd.state === 'chase';
    gd.sectorMat.color.setHex(chasing ? 0xff3030 : 0xfff2a0);
    gd.sectorMat.opacity = (chasing ? 0.22 : 0.1 + nightFactor * 0.08) * (relevant || chasing ? 1.4 : 1);
    gd.coneMat.opacity = nightFactor * (chasing ? 0.12 : 0.07);
    gd.coneMat.color.setHex(chasing ? 0xff6060 : 0xfff6c8);
    gd.icon.visible = chasing || gd.state === 'return';
    gd.icon.material.map = chasing ? TEX_ALERT : TEX_SEARCH;
    gd.icon.position.y = 3.6 + Math.sin(t * 8) * 0.1;
  }
}

function shortNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K';
  return String(n);
}

export const VAULT_CONST = { PLATFORM_H, BEAM_Y };
export { WORLD };
