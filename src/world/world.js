import * as THREE from 'three';
import { WORLD, LANE } from '../config.js';
import { mulberry32, mat, mesh, neonMat, textTexture, signPlane } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';

const rnd = mulberry32(1337);

/** Is (x,z) inside a gameplay zone where decoration must not spawn? */
function blocked(x, z, pad = 0) {
  if (Math.hypot(x - WORLD.hub.x, z - WORLD.hub.z) < 34 + pad) return true;
  if (x < -38 + pad && x > -118 - pad && z > -38 - pad && z < 38 + pad) return true;              // training grounds
  if (x > 38 - pad && x < 62 + pad && z > 18 - pad && z < 42 + pad) return true;                  // trail shop
  if (Math.abs(x) < LANE.halfW + 6 + pad && z < -20) return true;                                 // the Egg Lane
  // main paths
  if (Math.abs(x) < 9 + pad && z > 0 && z < 74) return true;                                      // south path + home arch
  if (Math.abs(z) < 5 + pad && Math.abs(x) < 120) return true;
  if (Math.hypot(x - 64, z - 72) < 22 + pad) return true;                                        // pond
  return false;
}

export function buildWorld({ scene, colliders, daynight }) {
  const group = new THREE.Group();
  scene.add(group);
  const H = WORLD.half;

  // ── terrain: flat play area that rises into low-poly hills beyond the boundary ──
  // the terrain also runs north as a long valley around the Egg Lane
  const zNorth = LANE.end - 330, zSouth = 450;
  const sizeX = 900, sizeZ = zSouth - zNorth;
  const tg = new THREE.PlaneGeometry(sizeX, sizeZ, 120, Math.round(sizeZ / 7.5));
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, (zSouth + zNorth) / 2);
  const pos = tg.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(0x6cc24a), cB = new THREE.Color(0x8fd65a), cC = new THREE.Color(0x4ea83a), cHill = new THREE.Color(0x5aa046), cRock = new THREE.Color(0x8a8f7a), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const edge = edgeDist(x, z, H);
    const n = noise(x, z);
    let y = 0;
    if (edge > 0) y = Math.pow(edge, 1.25) * 0.35 * (1 + 0.4 * n) + n * 2;
    pos.setY(i, y);
    const v = 0.5 + 0.5 * Math.sin(x * 0.08 + Math.cos(z * 0.06) * 2) * Math.cos(z * 0.09);
    tmp.copy(cA).lerp(cB, v).lerp(cC, Math.max(0, n) * 0.3);
    if (edge > 0) tmp.lerp(cHill, Math.min(1, edge / 20)).lerp(cRock, Math.min(1, Math.max(0, (y - 25) / 30)));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // boundary walls (invisible)
  const gapW = LANE.halfW + 1, segW = H + 4 - gapW;
  colliders.box(-(gapW + segW / 2), -H - 2, segW, 4, 50, { noWalk: true, ghost: true });
  colliders.box(gapW + segW / 2, -H - 2, segW, 4, 50, { noWalk: true, ghost: true });
  colliders.box(0, H + 2, H * 2 + 8, 4, 50, { noWalk: true, ghost: true });
  colliders.box(-H - 2, 0, 4, H * 2 + 8, 50, { noWalk: true, ghost: true });
  colliders.box(H + 2, 0, 4, H * 2 + 8, 50, { noWalk: true, ghost: true });

  // ── paths & plaza ──
  const stone = mat(0xe4d7bd, { roughness: 0.9 });
  const stoneDark = mat(0xcbb994, { roughness: 0.9 });
  const plaza = mesh(new THREE.CylinderGeometry(30, 30, 0.12, 64), stone, { y: 0.06, cast: false });
  group.add(plaza);
  colliders.circle(0, 0, 30, 0.12);
  const plazaRing = mesh(new THREE.TorusGeometry(30, 0.5, 6, 64), stoneDark, { y: 0.1, rx: Math.PI / 2, cast: false });
  group.add(plazaRing);
  // tile pattern ring
  const inner = mesh(new THREE.RingGeometry(18, 19.2, 64), mat(0xd2c19c), { y: 0.125, rx: -Math.PI / 2, cast: false });
  group.add(inner);

  const pathMat = mat(0xd9c9a3, { roughness: 0.95 });
  const addPath = (ax, az, bx, bz, w = 7) => {
    const len = Math.hypot(bx - ax, bz - az);
    const p = mesh(new THREE.PlaneGeometry(w, len), pathMat, { x: (ax + bx) / 2, y: 0.04, z: (az + bz) / 2, rx: -Math.PI / 2, cast: false });
    // local Y (length axis) is spun in-plane first, then the plane is laid flat
    p.rotation.set(-Math.PI / 2, 0, Math.atan2(bx - ax, bz - az));
    group.add(p);
  };
  addPath(-28, 0, -42, 0, 8);
  addPath(28, 0, 40, 0, 8);
  addPath(0, 28, 0, 70, 6);

  // ── trees (instanced, two foliage tones) ──
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const leafGeo2 = new THREE.ConeGeometry(2.2, 4.4, 7);
  const treeSpots = [];
  let attempts = 0;
  while (treeSpots.length < 190 && attempts < 6000) {
    attempts++;
    const x = (rnd() * 2 - 1) * (H - 4), z = (rnd() * 2 - 1) * (H - 4);
    if (blocked(x, z, 3)) continue;
    if (treeSpots.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 36)) continue;
    treeSpots.push({ x, z, s: 0.8 + rnd() * 0.7, pine: rnd() < 0.35, r: rnd() });
  }
  // ring of trees just outside the boundary to hide the edge
  for (let i = 0; i < 120; i++) {
    const side = i % 4, t = rnd() * 2 - 1;
    const o = H + 4 + rnd() * 18;
    const x = side < 2 ? t * (H + 10) : (side === 2 ? -o : o);
    const z = side < 2 ? (side === 0 ? -o : o) : t * (H + 10);
    if (z < -H && Math.abs(x) < LANE.halfW + 14) continue;
    treeSpots.push({ x, z, s: 1 + rnd() * 0.9, pine: rnd() < 0.6, r: rnd(), outer: true });
  }
  // forest on the valley slopes along the lane
  for (let z = -H - 6; z > LANE.end - 40; z -= 7) {
    for (const s of [-1, 1]) {
      if (rnd() < 0.25) continue;
      const x = s * (LANE.halfW + 16 + rnd() * 70);
      treeSpots.push({ x, z: z + rnd() * 5, s: 1 + rnd() * 0.9, pine: rnd() < 0.55, r: rnd(), outer: true });
    }
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x8a5a33), treeSpots.length);
  const round = treeSpots.filter((t) => !t.pine), pine = treeSpots.filter((t) => t.pine);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }), round.length * 2);
  const pines = new THREE.InstancedMesh(leafGeo2, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 }), pine.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), eul = new THREE.Euler();
  const leafCols = [0x3fae49, 0x56c25a, 0x2f9a45, 0x7ccf4f, 0xf0a63a];
  treeSpots.forEach((t, i) => {
    const y0 = t.outer ? terrainHeight(t.x, t.z, H) : 0;
    m4.compose(p3.set(t.x, y0, t.z), q.identity(), sc.setScalar(t.s));
    trunks.setMatrixAt(i, m4);
    if (!t.outer) colliders.circle(t.x, t.z, 0.6 * t.s, 12, { camR: 2.1 * t.s, camY0: 1.6 * t.s, camY1: 7 * t.s });
  });
  const col = new THREE.Color();
  round.forEach((t, i) => {
    const y0 = t.outer ? terrainHeight(t.x, t.z, H) : 0;
    q.setFromEuler(eul.set(t.r * 3, t.r * 7, 0));
    m4.compose(p3.set(t.x, y0 + 3.6 * t.s, t.z), q, sc.setScalar(t.s * 1.05));
    leaves.setMatrixAt(i * 2, m4);
    m4.compose(p3.set(t.x + 0.6 * t.s, y0 + 4.9 * t.s, t.z - 0.3 * t.s), q, sc.setScalar(t.s * 0.7));
    leaves.setMatrixAt(i * 2 + 1, m4);
    col.set(leafCols[Math.floor(t.r * (t.r > 0.93 ? 5 : 4))]);
    leaves.setColorAt(i * 2, col); leaves.setColorAt(i * 2 + 1, col.offsetHSL(0, 0, 0.05));
  });
  pine.forEach((t, i) => {
    const y0 = t.outer ? terrainHeight(t.x, t.z, H) : 0;
    m4.compose(p3.set(t.x, y0 + 3.8 * t.s, t.z), q.identity(), sc.setScalar(t.s));
    pines.setMatrixAt(i * 2, m4);
    m4.compose(p3.set(t.x, y0 + 5.9 * t.s, t.z), q.identity(), sc.setScalar(t.s * 0.7));
    pines.setMatrixAt(i * 2 + 1, m4);
    col.set(0x2c8a4a).offsetHSL(0, 0, (t.r - 0.5) * 0.08);
    pines.setColorAt(i * 2, col); pines.setColorAt(i * 2 + 1, col);
  });
  for (const im of [trunks, leaves, pines]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // ── rocks & bushes & flowers ──
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const bushGeo = new THREE.IcosahedronGeometry(1, 0);
  const rocks = [], bushes = [], flowers = [];
  for (let i = 0; i < 900 && (rocks.length < 60 || bushes.length < 110 || flowers.length < 260); i++) {
    const x = (rnd() * 2 - 1) * (H - 3), z = (rnd() * 2 - 1) * (H - 3);
    if (blocked(x, z, 0)) continue;
    const r = rnd();
    if (r < 0.15 && rocks.length < 60) rocks.push({ x, z, s: 0.6 + rnd() * 1.6, r: rnd() });
    else if (r < 0.45 && bushes.length < 110) bushes.push({ x, z, s: 0.7 + rnd() * 0.8, r: rnd() });
    else if (flowers.length < 260) flowers.push({ x, z, r: rnd() });
  }
  const rockIM = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, flatShading: true, roughness: 0.9 }), rocks.length);
  rocks.forEach((r, i) => {
    q.setFromEuler(eul.set(r.r * 5, r.r * 9, r.r * 3));
    m4.compose(p3.set(r.x, r.s * 0.35, r.z), q, sc.set(r.s * 1.3, r.s * 0.9, r.s * 1.1));
    rockIM.setMatrixAt(i, m4);
    colliders.circle(r.x, r.z, r.s * 1.1, r.s * 1.2);
  });
  const bushIM = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.85 }), bushes.length);
  bushes.forEach((b, i) => {
    m4.compose(p3.set(b.x, b.s * 0.5, b.z), q.setFromEuler(eul.set(0, b.r * 6, 0)), sc.set(b.s * 1.3, b.s, b.s * 1.2));
    bushIM.setMatrixAt(i, m4);
    bushIM.setColorAt(i, col.set(0x3fa64a).offsetHSL((b.r - 0.5) * 0.05, 0, (b.r - 0.5) * 0.1));
  });
  const flowerGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const flowerIM = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), flowers.length);
  const fcols = [0xff5c8a, 0xffe14a, 0xffffff, 0xb07cff, 0xff8a3d];
  flowers.forEach((f, i) => {
    m4.compose(p3.set(f.x, 0.25, f.z), q.identity(), sc.setScalar(1));
    flowerIM.setMatrixAt(i, m4);
    flowerIM.setColorAt(i, col.set(fcols[Math.floor(f.r * fcols.length)]));
  });
  for (const im of [rockIM, bushIM]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }
  flowerIM.receiveShadow = true;
  group.add(flowerIM);

  // ── pond ──
  const pond = mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshStandardMaterial({ color: 0x2fa6e8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.92 }), { x: 64, y: 0.08, z: 72, rx: -Math.PI / 2, cast: false });
  group.add(pond);
  const pondRim = mesh(new THREE.TorusGeometry(16, 0.9, 6, 40), mat(0xb9b2a0, { flatShading: true }), { x: 64, y: 0.15, z: 72, rx: Math.PI / 2 });
  group.add(pondRim);
  colliders.circle(64, 72, 16.5, 0.6, { noWalk: true });
  // lily pads
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, r = 4 + rnd() * 9;
    group.add(mesh(new THREE.CircleGeometry(0.9, 10, 0.3, Math.PI * 1.8), mat(0x4fbf4a), { x: 64 + Math.cos(a) * r, y: 0.12, z: 72 + Math.sin(a) * r, rx: -Math.PI / 2, rz: rnd() * 6, cast: false }));
  }

  // ── lamp posts along paths (neon at night) ──
  const postMat = mat(0x2a2f3a, { metalness: 0.6, roughness: 0.4 });
  const bulbMat = neonMat(0xffe7a3, 2.4);
  daynight.registerNeon(bulbMat);
  const lampSpots = [];
  for (let a = 0; a < 8; a++) {
    const ang = a / 8 * Math.PI * 2 + 0.39, x = Math.cos(ang) * 31.5, z = Math.sin(ang) * 31.5;
    if (z < 0 && Math.abs(x) < LANE.halfW + 2) continue; // keep the lane mouth clear
    lampSpots.push([x, z]);
  }
  lampSpots.push([-40, 7], [-40, -7], [38, 7], [38, -7], [5, 38], [-5, 38]);
  const postGeo = new THREE.CylinderGeometry(0.16, 0.22, 5, 8);
  const bulbGeo = new THREE.SphereGeometry(0.42, 12, 8);
  for (const [x, z] of lampSpots) {
    group.add(mesh(postGeo, postMat, { x, y: 2.5, z }));
    group.add(mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.3, 8), postMat, { x, y: 5.05, z }));
    const b = mesh(bulbGeo, bulbMat, { x, y: 5.4, z, cast: false });
    group.add(b);
    colliders.circle(x, z, 0.3, 6);
  }

  // a handful of real point lights at key locations (cheap but atmospheric)
  const lightSpots = [[0, 10, 17, 0x7dffb0], [-20, 9, -20, 0xffd59a], [20, 9, -20, 0xffd59a], [-70, 10, 0, 0x8ad8ff], [0, 9, -60, 0xffd59a]];
  for (const [x, y, z, c] of lightSpots) {
    const L = new THREE.PointLight(c, 90, 46, 1.6);
    L.position.set(x, y, z);
    scene.add(L);
    daynight.registerNightLight(L);
  }

  // ── area signs ──
  const sign = (text, sub, x, z, ry, color, accent) => {
    const g = new THREE.Group();
    const tex = textTexture([text, sub].filter(Boolean), { w: 1024, h: 256, bg: color, border: accent, size: 110, stroke: '#00000088' });
    const panel = signPlane(tex, 12, 3, true);
    panel.material.emissiveIntensity = 0.35;
    daynight.registerNeon(panel.material, true);
    panel.position.y = 6.2;
    g.add(panel);
    const back = panel.clone(); back.rotation.y = Math.PI; g.add(back);
    for (const sx of [-5, 5]) g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 7.6, 8), mat(0x6b4a2a), { x: sx, y: 3.8 }));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    const along = Math.abs(Math.cos(ry)) > 0.5;
    colliders.camBox(x, z, along ? 12.5 : 1.2, along ? 1.2 : 12.5, 4.4, 8);
    colliders.circle(x + Math.cos(ry) * 5, z - Math.sin(ry) * 5, 0.4, 8);
    colliders.circle(x - Math.cos(ry) * 5, z + Math.sin(ry) * 5, 0.4, 8);
  };
  sign('TRAINING GROUNDS', '20 tiers • stand still to train', -40, 16, Math.PI / 2, '#2f6bff', '#9fd0ff');

  // ── clouds ──
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0x223355, emissiveIntensity: 0.15 });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 44; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j++) {
      const s = 4 + rnd() * 5;
      const p = mesh(cloudGeo, cloudMat, { x: (j - n / 2) * 4.5 + rnd() * 2, y: rnd() * 2, z: rnd() * 4 - 2, s: [s * 1.2, s * 0.8, s], cast: false, receive: false });
      c.add(p);
    }
    c.position.set((rnd() * 2 - 1) * 420, 70 + rnd() * 50, 420 - rnd() * (420 - LANE.end + 200));
    c.userData.speed = 1.5 + rnd() * 2.5;
    clouds.add(c);
  }
  group.add(clouds);

  // ── fireflies / ambient motes spawner info ──
  const update = (dt, t, particles, nightFactor, focus) => {
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 460) c.position.x = -460;
    }
    // fireflies at night near the player
    if (nightFactor > 0.5 && Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30;
      particles.emit({ x: focus.x + Math.cos(a) * r, y: 0.5 + Math.random() * 3, z: focus.z + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 0.6, vy: 0.2, vz: (Math.random() - 0.5) * 0.6, color: 0xd7ff6a, size: 0.25, sizeEnd: 0.2, life: 3, intensity: 3, twinkle: true });
    }
    // butterflies of pollen in daytime
    if (nightFactor < 0.3 && Math.random() < dt * 4) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 25;
      particles.emit({ x: focus.x + Math.cos(a) * r, y: 0.3 + Math.random() * 2, z: focus.z + Math.sin(a) * r,
        vx: (Math.random() - 0.5), vy: 0.3, vz: (Math.random() - 0.5), color: 0xffffff, size: 0.12, life: 2.5, intensity: 0.8 });
    }
  };

  return { group, update, blocked };
}

function noise(x, z) {
  return Math.sin(x * 0.05) * Math.cos(z * 0.045) + Math.sin(x * 0.11 + z * 0.07) * 0.5;
}
/** How far (x,z) is outside the flat play area: the main island plus the lane valley. */
function edgeDist(x, z, H) {
  const island = Math.max(Math.abs(x), Math.abs(z)) - (H + 8);
  const vz0 = -H, vz1 = LANE.end - 20;
  const valley = Math.max(Math.abs(x) - (LANE.halfW + 12), z - vz0, vz1 - z);
  return Math.min(island, valley);
}
function terrainHeight(x, z, H) {
  const edge = edgeDist(x, z, H);
  const n = noise(x, z);
  return edge > 0 ? Math.pow(edge, 1.25) * 0.35 * (1 + 0.4 * n) + n * 2 - 0.5 : 0;
}

/** Floating glow helper re-exported for other modules. */
export { makeGlowSprite };
