import * as THREE from 'three';
import { WORLD } from '../config.js';
import { mat, mesh, neonMat, textTexture, signPlane } from '../util.js';

export class Hub {
  constructor({ scene, colliders, daynight }) {
    this.scene = scene;
    this.daynight = daynight;
    const g = this.group = new THREE.Group();
    scene.add(g);
    this.time = 0;

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
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 260, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pillar.position.set(A.x, 130, A.z); pillar.userData.noAO = true; pillar.visible = false;
    g.add(pillar);
    this.pillar = pillar;
    this.divineLight = new THREE.PointLight(0xffd98a, 0, 40, 1.5);
    this.divineLight.position.set(A.x, 9.5, A.z + 1);
    g.add(this.divineLight);
    this.divineActive = false;

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
    this.pillar.visible = on;
  }

  update(dt, t, particles, nightFactor) {
    this.time = t;
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
