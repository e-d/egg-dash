import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat } from '../util.js';

function faceTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0, 0, 128, 128);
  if (kind === 'guard') {
    // stern eyebrows + eyes
    g.fillStyle = '#1b1b1b';
    g.fillRect(30, 44, 26, 7); g.fillRect(72, 44, 26, 7);
    g.beginPath(); g.ellipse(43, 62, 7, 9, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(85, 62, 7, 9, 0, 0, 7); g.fill();
    g.fillRect(48, 92, 32, 6);
  } else {
    g.fillStyle = '#1b1b1b';
    g.beginPath(); g.ellipse(44, 58, 8, 12, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(84, 58, 8, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(47, 53, 3.5, 0, 7); g.fill();
    g.beginPath(); g.arc(87, 53, 3.5, 0, 7); g.fill();
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 78, 18, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,120,140,0.45)';
    g.beginPath(); g.ellipse(30, 80, 9, 5, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(98, 80, 9, 5, 0, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const geoCache = {};
function rbox(w, h, d, r = 0.08) {
  const k = `${w}_${h}_${d}_${r}`;
  return geoCache[k] || (geoCache[k] = new RoundedBoxGeometry(w, h, d, 3, r));
}

export class Avatar {
  /**
   * colors: { skin, shirt, pants, shoes, hat? }
   */
  constructor({ skin = 0xffd3a8, shirt = 0x2f7dff, pants = 0x24324a, shoes = 0xffffff, hat = null, kind = 'player', scale = 0.78 } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();          // bobbing body
    this.root.add(this.body);
    this.root.scale.setScalar(scale);

    const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const mSkin = mat(skin, { roughness: 0.6 });
    const mShirt = mat(shirt, { roughness: 0.65 });
    const mPants = mat(pants, { roughness: 0.7 });
    const mShoes = mat(shoes, { roughness: 0.5 });

    // legs
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    for (const [leg, x] of [[this.legL, -0.26], [this.legR, 0.26]]) {
      leg.position.set(x, 0.92, 0);
      const l = cast(new THREE.Mesh(rbox(0.46, 0.8, 0.5, 0.1), mPants)); l.position.y = -0.4;
      const s = cast(new THREE.Mesh(rbox(0.5, 0.2, 0.62, 0.08), mShoes)); s.position.set(0, -0.82, 0.05);
      leg.add(l, s);
      this.body.add(leg);
    }
    // torso
    const torso = cast(new THREE.Mesh(rbox(1.04, 1.0, 0.56, 0.14), mShirt));
    torso.position.y = 1.42;
    this.body.add(torso);
    this.torso = torso;
    // arms
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    for (const [arm, x] of [[this.armL, -0.74], [this.armR, 0.74]]) {
      arm.position.set(x, 1.82, 0);
      const sleeve = cast(new THREE.Mesh(rbox(0.42, 0.45, 0.46, 0.1), mShirt)); sleeve.position.y = -0.2;
      const hand = cast(new THREE.Mesh(rbox(0.38, 0.55, 0.42, 0.12), mSkin)); hand.position.y = -0.64;
      arm.add(sleeve, hand);
      this.body.add(arm);
    }
    // head
    this.head = new THREE.Group();
    this.head.position.y = 2.32;
    const headMesh = cast(new THREE.Mesh(rbox(0.82, 0.8, 0.8, 0.22), mSkin));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshStandardMaterial({ map: faceTexture(kind), transparent: true, roughness: 0.8 }));
    face.position.z = 0.405;
    this.head.add(headMesh, face);
    if (kind === 'guard') {
      const cap = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.26, 20), mat(hat ?? 0x1c2340)));
      cap.position.y = 0.42;
      const brim = cast(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.4), mat(hat ?? 0x1c2340)));
      brim.position.set(0, 0.32, 0.4);
      const badge = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.3 }));
      badge.position.set(0, 0.45, 0.475);
      this.head.add(cap, brim, badge);
      // torso badge
      const b2 = badge.clone(); b2.position.set(-0.25, 1.62, 0.29); this.body.add(b2);
    } else if (hat === 'cap') {
      const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xff3b5c)));
      cap.position.y = 0.2;
      const brim = cast(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.45), mat(0xff3b5c)));
      brim.position.set(0, 0.24, 0.5);
      this.head.add(cap, brim);
    }
    this.body.add(this.head);

    this.phase = 0;
    this.carryBlend = 0;
    this.airBlend = 0;
  }

  /**
   * speed: horizontal speed (u/s); grounded: bool; carrying: bool; running: force run anim (treadmill)
   */
  animate(dt, { speed = 0, grounded = true, carrying = false, running = 0, alert = false } = {}) {
    const moving = Math.max(running, Math.min(1, speed / 6));
    const cadence = 4 + Math.min(14, (running > 0 ? running * 14 : speed * 0.55));
    this.phase += dt * cadence;
    const swing = Math.sin(this.phase) * 0.9 * moving;
    this.airBlend += ((grounded ? 0 : 1) - this.airBlend) * Math.min(1, dt * 10);
    this.carryBlend += ((carrying ? 1 : 0) - this.carryBlend) * Math.min(1, dt * 8);

    const air = this.airBlend;
    this.legL.rotation.x = swing * (1 - air) + 0.5 * air;
    this.legR.rotation.x = -swing * (1 - air) - 0.3 * air;
    const armSwing = -swing * 0.9;
    const carryA = -Math.PI * 0.92;
    this.armL.rotation.x = (armSwing * (1 - air) - 2.4 * air * 0.4) * (1 - this.carryBlend) + carryA * this.carryBlend;
    this.armR.rotation.x = (-armSwing * (1 - air) - 2.4 * air * 0.4) * (1 - this.carryBlend) + carryA * this.carryBlend;
    this.armL.rotation.z = -0.08 - air * 0.5 * (1 - this.carryBlend) + this.carryBlend * 0.25;
    this.armR.rotation.z = 0.08 + air * 0.5 * (1 - this.carryBlend) - this.carryBlend * 0.25;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.12 * moving * (1 - air) + (1 - moving) * Math.sin(this.phase * 0.5) * 0.02;
    this.body.rotation.x = moving * 0.12 * (1 - this.carryBlend);
    this.head.rotation.y = alert ? Math.sin(this.phase * 2) * 0.1 : 0;
  }
}
