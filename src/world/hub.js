import * as THREE from 'three';
import { WORLD, EGGS, DIVINE_EGG, formatNum } from '../config.js';
import { mat, mesh, neonMat, textTexture, signPlane, eggGeometry, eggTexture } from '../util.js';
import { makeGlowSprite } from '../fx/particles.js';

function ringText(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  g.font = '900 44px "Lilita One", Arial Black, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color;
  const chars = text.split('');
  const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => { g.save(); g.rotate(i * step); g.fillText(ch, 0, -206); g.restore(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Hub {
  constructor({ scene, colliders, daynight }) {
    this.scene = scene;
    this.daynight = daynight;
    const g = this.group = new THREE.Group();
    scene.add(g);
    this.time = 0;

    // ── deposit pad ──
    const D = WORLD.deposit;
    const pad = new THREE.Group();
    pad.position.set(D.x, 0, D.z);
    g.add(pad);
    pad.add(mesh(new THREE.CylinderGeometry(D.radius + 0.6, D.radius + 0.9, 0.3, 48), mat(0x2b3a55, { metalness: 0.4, roughness: 0.4 }), { y: 0.15 }));
    colliders.circle(D.x, D.z, D.radius + 0.7, 0.31);
    this.padMat = neonMat(0x3dff7a, 1.6);
    daynight.registerNeon(this.padMat, true);
    pad.add(mesh(new THREE.TorusGeometry(D.radius + 0.25, 0.14, 8, 64), this.padMat, { y: 0.31, rx: Math.PI / 2, cast: false }));
    const inner = new THREE.MeshStandardMaterial({ color: 0x1d6b3a, emissive: 0x23ff6a, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.2 });
    daynight.registerNeon(inner, true);
    pad.add(mesh(new THREE.CircleGeometry(D.radius, 48), inner, { y: 0.31, rx: -Math.PI / 2, cast: false }));
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(D.radius * 2.1, D.radius * 2.1), new THREE.MeshBasicMaterial({ map: ringText('★ DEPOSIT EGGS ★ DEPOSIT EGGS ', '#c8ffd8'), transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.33; ring.userData.noAO = true;
    pad.add(ring);
    this.depositRing = ring;
    // floating coin
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 1, roughness: 0.25, emissive: 0xffa800, emissiveIntensity: 0.35 });
    this.coin = new THREE.Group();
    const coinBody = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 32), coinMat, { rx: Math.PI / 2 });
    this.coin.add(coinBody);
    const dollar = signPlane(textTexture('$', { w: 128, h: 128, size: 110, color: '#fff6c8', stroke: '#b07800' }), 1.5, 1.5, true);
    dollar.position.z = 0.14; this.coin.add(dollar);
    const dollarB = dollar.clone(); dollarB.position.z = -0.14; dollarB.rotation.y = Math.PI; this.coin.add(dollarB);
    this.coin.position.set(D.x, 4.2, D.z);
    g.add(this.coin);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(D.radius, D.radius, 6, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.set(D.x, 3, D.z); beam.userData.noAO = true;
    g.add(beam);
    this.depositBeam = beam;

    // ── home base sign arch ──
    const arch = new THREE.Group();
    arch.position.set(0, 0, 46);
    for (const sx of [-1, 1]) arch.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 7, 10), mat(0xffffff), { x: sx * 6, y: 3.5 }));
    const homeTex = textTexture(['EGG DASH', 'home base'], { w: 1024, h: 256, bg: '#ff4d7e', border: '#ffe066', size: 120 });
    const homeSign = signPlane(homeTex, 12, 3, true);
    homeSign.material.emissiveIntensity = 0.3;
    daynight.registerNeon(homeSign.material, true);
    homeSign.position.y = 7.4;
    arch.add(homeSign);
    const hb = homeSign.clone(); hb.rotation.y = Math.PI; arch.add(hb);
    g.add(arch);
    colliders.circle(-6, 46, 0.6, 8); colliders.circle(6, 46, 0.6, 8);
    colliders.camBox(0, 46, 13, 1.4, 5.5, 9.4);

    // ── divine altar ──
    const A = WORLD.altar;
    const altar = new THREE.Group();
    altar.position.set(A.x, 0, A.z);
    g.add(altar);
    const stoneM = mat(0xcfc6e6, { roughness: 0.55 });
    altar.add(mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.5, 8), stoneM, { y: 0.25 }));
    altar.add(mesh(new THREE.CylinderGeometry(3.0, 3.3, 0.5, 8), stoneM, { y: 0.75 }));
    altar.add(mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), mat(0xd9ccff, { roughness: 0.4 }), { y: 1.5 }));
    this.altarRuneMat = neonMat(0xc9a0ff, 0.6);
    daynight.registerNeon(this.altarRuneMat, true);
    altar.add(mesh(new THREE.TorusGeometry(3.15, 0.07, 6, 48), this.altarRuneMat, { y: 1.01, rx: Math.PI / 2, cast: false }));
    altar.add(mesh(new THREE.TorusGeometry(4.4, 0.07, 6, 48), this.altarRuneMat, { y: 0.51, rx: Math.PI / 2, cast: false }));
    // four obelisks
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      altar.add(mesh(new THREE.CylinderGeometry(0.25, 0.45, 3.4, 4), stoneM, { x: Math.cos(a) * 3.6, y: 2.2, z: Math.sin(a) * 3.6, ry: Math.PI / 4 }));
      altar.add(mesh(new THREE.OctahedronGeometry(0.35, 0), this.altarRuneMat, { x: Math.cos(a) * 3.6, y: 4.2, z: Math.sin(a) * 3.6, cast: false }));
    }
    colliders.circle(A.x, A.z, 4.4, 0.5);
    colliders.circle(A.x, A.z, 3.2, 1.0);
    colliders.circle(A.x, A.z, 1.8, 2.1, { noWalk: true });
    // divine egg (hidden until event)
    const dEgg = new THREE.Group();
    const dMat = new THREE.MeshStandardMaterial({ map: eggTexture(DIVINE_EGG.color, DIVINE_EGG.spot, 'stripes'), emissive: 0xffe08a, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.25 });
    this.divineEggMat = dMat;
    const de = new THREE.Mesh(eggGeometry(0.42, 1.08), dMat); de.castShadow = true;
    de.scale.setScalar(2.2);
    dEgg.add(de);
    dEgg.add(makeGlowSprite(0xffe08a, 6, 0.4));
    dEgg.children[1].position.y = 1.2;
    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 48), neonMat(0xfff0b0, 4));
    haloRing.position.y = 3.2; haloRing.rotation.x = Math.PI / 2;
    dEgg.add(haloRing);
    this.divineHalo = haloRing;
    dEgg.position.set(A.x, 2.3, A.z);
    dEgg.visible = false;
    g.add(dEgg);
    this.divineEgg = dEgg;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 260, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pillar.position.set(A.x, 130, A.z); pillar.userData.noAO = true; pillar.visible = false;
    g.add(pillar);
    this.pillar = pillar;
    this.divineLight = new THREE.PointLight(0xffd98a, 0, 40, 1.5);
    this.divineLight.position.set(A.x, 9.5, A.z + 1);
    g.add(this.divineLight);
    this.divineActive = false;

    // ── HATCHERY pavilion ──
    const Hh = WORLD.hatchery;
    const hatch = new THREE.Group();
    hatch.position.set(Hh.x, 0, Hh.z);
    g.add(hatch);
    hatch.add(mesh(new THREE.BoxGeometry(14, 0.4, 30), mat(0xfff1f6, { roughness: 0.6 }), { y: 0.2 }));
    hatch.add(mesh(new THREE.BoxGeometry(14.6, 0.25, 30.6), mat(0xff8fb8), { y: 0.1, cast: false }));
    colliders.box(Hh.x, Hh.z, 14, 30, 0.4);
    const pillarM = mat(0xffffff, { roughness: 0.5 });
    for (const [px, pz] of [[-6.4, -14.4], [6.4, -14.4], [-6.4, 14.4], [6.4, 14.4], [6.4, 0], [-6.4, 0]]) {
      hatch.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 7, 12), pillarM, { x: px, y: 3.9, z: pz }));
      colliders.circle(Hh.x + px, Hh.z + pz, 0.5, 8, { noWalk: true });
    }
    // striped candy roof
    const roofCols = [0xff6fa3, 0xfff1f6];
    for (let k = 0; k < 10; k++) {
      hatch.add(mesh(new THREE.BoxGeometry(16, 0.5, 3.2), mat(roofCols[k % 2], { roughness: 0.6 }), { y: 7.6, z: -14.4 + k * 3.2, cast: true }));
    }
    hatch.add(mesh(new THREE.BoxGeometry(16.4, 0.3, 32.4), mat(0xff4d8a), { y: 7.25 }));
    colliders.camBox(Hh.x, Hh.z, 16.6, 32.6, 6.9, 8.2);
    const hatchTex = textTexture(['HATCHERY', 'press E at an egg to hatch'], { w: 1024, h: 256, bg: '#ff4d8a', border: '#fff1a8', size: 120 });
    const hs = signPlane(hatchTex, 12, 3, true);
    hs.material.emissiveIntensity = 0.35; daynight.registerNeon(hs.material, true);
    hs.position.set(-8.3, 6, 0); hs.rotation.y = -Math.PI / 2;
    hatch.add(hs);
    // egg pedestals
    this.pedestals = [];
    EGGS.forEach((e, i) => {
      const pz = -11.5 + i * 5.75;
      const ped = new THREE.Group();
      ped.position.set(0.5, 0.4, pz);
      ped.add(mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.0, 16), mat(0xffffff, { roughness: 0.4 }), { y: 0.5 }));
      const trim = neonMat(e.color, 1.2); daynight.registerNeon(trim, true);
      ped.add(mesh(new THREE.TorusGeometry(1.55, 0.08, 6, 32), trim, { y: 1.0, rx: Math.PI / 2, cast: false }));
      const em = new THREE.MeshStandardMaterial({ map: eggTexture(e.color, e.spot, i % 2 ? 'stripes' : 'spots'), roughness: 0.3, metalness: i >= 3 ? 0.4 : 0.05, emissive: e.color, emissiveIntensity: 0.12 + i * 0.06 });
      const egg = mesh(eggGeometry(0.42, 1.08), em, { y: 1.15, s: 1.8 });
      ped.add(egg);
      const glow = makeGlowSprite(e.color, 4, 0.12 + i * 0.05); glow.position.y = 2.2; ped.add(glow);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture([e.name, `$${formatNum(e.cost)}`], { w: 512, h: 160, bg: 'rgba(20,14,40,0.82)', border: '#' + new THREE.Color(e.color).getHexString(), size: 64 }), transparent: true, depthWrite: false }));
      label.scale.set(3.6, 1.12, 1); label.position.y = 4.4; label.userData.noAO = true;
      ped.add(label);
      hatch.add(ped);
      colliders.circle(Hh.x + 0.5, Hh.z + pz, 1.7, 1.4, { noWalk: true });
      this.pedestals.push({ egg: e, group: ped, eggMesh: egg, x: Hh.x + 0.5, z: Hh.z + pz });
    });

    // ── TRAIL SHOP booth ──
    const T = WORLD.trailShop;
    const shop = new THREE.Group();
    shop.position.set(T.x, 0, T.z);
    g.add(shop);
    shop.add(mesh(new THREE.CylinderGeometry(6, 6.4, 0.4, 32), mat(0x1c1630, { metalness: 0.5, roughness: 0.4 }), { y: 0.2 }));
    colliders.circle(T.x, T.z, 6, 0.4);
    const neonCols = [0xff3dcf, 0x18f0ff, 0xffe14a, 0x39ff14];
    this.shopRings = [];
    neonCols.forEach((c, k) => {
      const nm = neonMat(c, 2.4); daynight.registerNeon(nm, true);
      const r = mesh(new THREE.TorusGeometry(4.2 - k * 0.5, 0.1, 8, 64), nm, { y: 3 + k * 0.9, cast: false });
      shop.add(r);
      this.shopRings.push(r);
    });
    shop.add(mesh(new THREE.CylinderGeometry(0.6, 0.8, 7.5, 12), mat(0x241c40, { metalness: 0.8, roughness: 0.25 }), { y: 3.8 }));
    colliders.circle(T.x, T.z, 0.9, 8, { noWalk: true });
    const trailTex = textTexture(['TRAILS', 'boost training speed'], { w: 1024, h: 256, bg: '#1c1630', border: '#18f0ff', size: 120, color: '#ffffff' });
    const ts = signPlane(trailTex, 9, 2.25, true);
    ts.material.emissiveIntensity = 0.6; daynight.registerNeon(ts.material, true);
    ts.position.set(-6.8, 4.5, 0); ts.rotation.y = -Math.PI / 2;
    shop.add(ts);
    for (const sx of [-3.6, 3.6]) shop.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 8), mat(0x241c40), { x: -6.8, y: 2.75, z: sx }));
    this.shopCenter = new THREE.Vector3(T.x, 0, T.z);
  }

  setDivine(on) {
    this.divineActive = on;
    this.divineEgg.visible = on;
    this.pillar.visible = on;
  }

  update(dt, t, particles, nightFactor) {
    this.time = t;
    this.coin.rotation.y = t * 1.6;
    this.coin.position.y = 4.2 + Math.sin(t * 2) * 0.25;
    this.depositRing.rotation.z = -t * 0.3;
    this.depositBeam.material.opacity = 0.05 + 0.03 * Math.sin(t * 3);
    for (const p of this.pedestals) { p.eggMesh.rotation.y = t * 0.8; p.eggMesh.position.y = 1.15 + Math.sin(t * 2 + p.x) * 0.08; }
    this.shopRings.forEach((r, k) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.9 + k) * 0.35; r.rotation.y = t * (0.4 + k * 0.2); });
    if (Math.random() < dt * 20) {
      const a = Math.random() * Math.PI * 2;
      const c = [0xff3dcf, 0x18f0ff, 0xffe14a, 0x39ff14][Math.floor(Math.random() * 4)];
      particles.emit({ x: this.shopCenter.x + Math.cos(a) * 3.5, y: 1, z: this.shopCenter.z + Math.sin(a) * 3.5, vx: Math.cos(a + 1.6) * 2, vy: 2.5, vz: Math.sin(a + 1.6) * 2, color: c, size: 0.3, life: 1.6, intensity: 2.5, drag: 0.5 });
    }
    // altar idles; flares during divine event
    const target = this.divineActive ? 1 : 0;
    this.altarRuneMat.emissiveIntensity = 0.6 + target * 1.6 + Math.sin(t * 3) * 0.2;
    if (this.divineActive) {
      this.divineEgg.rotation.y = t * 0.7;
      this.divineEgg.position.y = 2.6 + Math.sin(t * 1.8) * 0.3;
      this.divineEggMat.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.2;
      this.divineHalo.rotation.z = t;
      this.pillar.material.opacity = 0.06 + Math.sin(t * 2) * 0.02;
      this.divineLight.intensity = 55;
      if (Math.random() < dt * 34) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3;
        particles.emit({ x: WORLD.altar.x + Math.cos(a) * r, y: 1 + Math.random(), z: WORLD.altar.z + Math.sin(a) * r, vx: -Math.cos(a) * 0.4, vy: 3 + Math.random() * 4, vz: -Math.sin(a) * 0.4,
          color: Math.random() < 0.6 ? 0xffe9a0 : 0xd0a8ff, color2: 0xffffff, size: 0.35, life: 2.2, intensity: 1.8, twinkle: true, drag: 0.2 });
      }
    } else this.divineLight.intensity = 0;
  }
}
