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
export function rbox(w, h, d, r = 0.08) {
  const k = `${w}_${h}_${d}_${r}`;
  return geoCache[k] || (geoCache[k] = new RoundedBoxGeometry(w, h, d, 3, r));
}

// ---- sleeping "Z z z" sprites (shared texture, created lazily) ----
let zTex = null;
function zTexture() {
  if (zTex) return zTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '52px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = '#1b2a5a';
  g.strokeText('Z', 32, 34);
  g.fillStyle = '#dff1ff'; g.fillText('Z', 32, 34);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

const asMat = (c, o) => (c && c.isMaterial ? c : mat(c, o));
const lerp = (a, b, t) => a + (b - a) * t;

export class Avatar {
  /**
   * colors: { skin, shirt, pants, shoes, hat? } — each colour may also be a ready-made Material.
   * kind: 'player' | 'guard' (police cap + badge) | 'guardian' (bare; themed by guardians.js)
   * faces: optional { normal, angry, tired, sleep } face materials, swapped automatically by animate().
   */
  constructor({ skin = 0xffd3a8, shirt = 0x2f7dff, pants = 0x24324a, shoes = 0xffffff, hat = null, kind = 'player', scale = 0.78, faces = null } = {}) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();          // bobbing body
    this.root.add(this.body);
    this.root.scale.setScalar(scale);
    this.kind = kind;

    const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const mSkin = asMat(skin, { roughness: 0.6 });
    const mShirt = asMat(shirt, { roughness: 0.65 });
    const mPants = asMat(pants, { roughness: 0.7 });
    const mShoes = asMat(shoes, { roughness: 0.5 });
    this.parts = { legs: [], shoes: [], sleeves: [], hands: [] };

    // legs
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    for (const [leg, x] of [[this.legL, -0.26], [this.legR, 0.26]]) {
      leg.position.set(x, 0.92, 0);
      const l = cast(new THREE.Mesh(rbox(0.46, 0.8, 0.5, 0.1), mPants)); l.position.y = -0.4;
      const s = cast(new THREE.Mesh(rbox(0.5, 0.2, 0.62, 0.08), mShoes)); s.position.set(0, -0.82, 0.05);
      leg.add(l, s);
      this.parts.legs.push(l); this.parts.shoes.push(s);
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
      this.parts.sleeves.push(sleeve); this.parts.hands.push(hand);
      this.body.add(arm);
    }
    // head
    this.head = new THREE.Group();
    this.head.position.y = 2.32;
    const headMesh = cast(new THREE.Mesh(rbox(0.82, 0.8, 0.8, 0.22), mSkin));
    this.faces = faces;
    const faceMat = faces ? faces.normal : new THREE.MeshStandardMaterial({ map: faceTexture(kind), transparent: true, roughness: 0.8 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), faceMat);
    face.position.z = 0.405;
    this.head.add(headMesh, face);
    this.headMesh = headMesh;
    this.face = face;
    this.faceState = 'normal';
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
    this.headBaseY = this.head.position.y;

    this.phase = 0;
    this.carryBlend = 0;
    this.airBlend = 0;
    // sleep / wake state (only ever non-zero for guardians that get `sleeping: true`)
    this.time = Math.random() * 10;
    this.sleepBlend = 0;
    this.wasSleeping = false;
    this.wakeT = 0;            // counts down from WAKE_TIME after waking
    this.alertBlend = 0;
    this.tiredBlend = 0;
    this.zzz = null;
    this.hooks = [];           // per-frame callbacks (themed accessories): fn(dt, info)
  }

  /** Register a per-frame callback `fn(dt, info)`; info = { t, sleep, alert, tired, wake, speed, moving }. */
  onAnimate(fn) { this.hooks.push(fn); }

  initZzz() {
    this.zzz = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.noAO = true;
      s.visible = false;
      s.renderOrder = 3;
      this.root.add(s);
      this.zzz.push(s);
    }
  }

  setFace(state) {
    if (!this.faces || this.faceState === state) return;
    this.faceState = state;
    this.face.material = this.faces[state] || this.faces.normal;
  }

  /**
   * speed: horizontal speed (u/s); grounded: bool; carrying: bool; running: force run anim (treadmill)
   * alert: chasing; sleeping: slumped asleep with floating Zs (guardians)
   */
  animate(dt, { speed = 0, grounded = true, carrying = false, running = 0, alert = false, sleeping = false } = {}) {
    this.time += dt;
    // --- sleep / wake bookkeeping ---
    if (sleeping && !this.zzz) this.initZzz();
    if (this.wasSleeping && !sleeping) this.wakeT = Avatar.WAKE_TIME;
    this.wasSleeping = sleeping;
    if (this.wakeT > 0) this.wakeT = Math.max(0, this.wakeT - dt);
    // fall asleep slowly, snap awake fast
    this.sleepBlend += ((sleeping ? 1 : 0) - this.sleepBlend) * Math.min(1, dt * (sleeping ? 2.5 : 16));
    if (!sleeping && this.sleepBlend < 0.002) this.sleepBlend = 0;
    const s = this.sleepBlend;
    const tired = !!this.faces && !sleeping && !alert && speed > 0.1 && this.wakeT === 0;
    this.alertBlend += ((alert ? 1 : 0) - this.alertBlend) * Math.min(1, dt * 8);
    this.tiredBlend += ((tired ? 1 : 0) - this.tiredBlend) * Math.min(1, dt * 4);
    const wakeP = this.wakeT > 0 ? 1 - this.wakeT / Avatar.WAKE_TIME : 1;
    const startle = this.wakeT > 0 ? Math.sin(Math.PI * wakeP) : 0;

    if (this.faces) {
      this.setFace(sleeping || s > 0.6 ? 'sleep' : (alert || this.wakeT > 0) ? 'angry' : tired ? 'tired' : 'normal');
    }

    // --- regular locomotion pose (unchanged for the player) ---
    const moving = Math.max(running, Math.min(1, speed / 6)) * (1 - s);
    const cadence = 4 + Math.min(14, (running > 0 ? running * 14 : speed * 0.55));
    this.phase += dt * cadence;
    const swing = Math.sin(this.phase) * 0.9 * moving;
    this.airBlend += ((grounded ? 0 : 1) - this.airBlend) * Math.min(1, dt * 10);
    this.carryBlend += ((carrying ? 1 : 0) - this.carryBlend) * Math.min(1, dt * 8);

    const air = this.airBlend;
    let legLx = swing * (1 - air) + 0.5 * air;
    let legRx = -swing * (1 - air) - 0.3 * air;
    const armSwing = -swing * 0.9;
    const carryA = -Math.PI * 0.92;
    let armLx = (armSwing * (1 - air) - 2.4 * air * 0.4) * (1 - this.carryBlend) + carryA * this.carryBlend;
    let armRx = (-armSwing * (1 - air) - 2.4 * air * 0.4) * (1 - this.carryBlend) + carryA * this.carryBlend;
    let armLz = -0.08 - air * 0.5 * (1 - this.carryBlend) + this.carryBlend * 0.25;
    let armRz = 0.08 + air * 0.5 * (1 - this.carryBlend) - this.carryBlend * 0.25;
    let bodyY = Math.abs(Math.sin(this.phase)) * 0.12 * moving * (1 - air) + (1 - moving) * Math.sin(this.phase * 0.5) * 0.02;
    let bodyRx = moving * 0.12 * (1 - this.carryBlend);
    let headRx = 0, headRz = 0;
    const headRy = alert ? Math.sin(this.phase * 2) * 0.1 : 0;

    // tired trudge back to post: hunched, droopy head, lazy arms
    const tb = this.tiredBlend;
    if (tb > 0) {
      bodyRx += 0.1 * tb;
      headRx += 0.22 * tb;
      armLx *= 1 - 0.5 * tb; armRx *= 1 - 0.5 * tb;
    }

    // --- sleeping pose: sitting on the floor, slumped, slow breathing ---
    if (s > 0) {
      const br = Math.sin(this.time * 1.7);
      legLx = lerp(legLx, -1.5, s); legRx = lerp(legRx, -1.5, s);
      armLx = lerp(armLx, -0.45 + br * 0.03, s); armRx = lerp(armRx, -0.45 + br * 0.03, s);
      armLz = lerp(armLz, -0.22, s); armRz = lerp(armRz, 0.22, s);
      bodyY = lerp(bodyY, -0.66 + br * 0.015, s);
      bodyRx = lerp(bodyRx, 0.14, s);
      headRx = lerp(headRx, 0.42 + br * 0.05, s);
      headRz = lerp(headRz, 0.22, s);
      const tb0 = this.torso.userData.baseScale;
      this.torso.scale.set(1 + br * 0.025 * s, 1 + br * 0.02 * s, 1 + br * 0.04 * s);
      if (tb0) this.torso.scale.multiply(tb0);
      this.breathing = true;
    } else if (this.breathing) {
      this.breathing = false;
      const tb0 = this.torso.userData.baseScale;
      if (tb0) this.torso.scale.copy(tb0); else this.torso.scale.set(1, 1, 1);
    }

    // --- startle on waking: quick hop, arms fling up ---
    if (startle > 0) {
      bodyY += startle * 0.55;
      armLx -= startle * 2.2; armRx -= startle * 2.2;
      armLz -= startle * 0.4; armRz += startle * 0.4;
      headRx -= startle * 0.25;
      legLx += startle * 0.5; legRx -= startle * 0.5;
    }

    this.legL.rotation.x = legLx; this.legR.rotation.x = legRx;
    this.legL.rotation.z = -0.12 * s; this.legR.rotation.z = 0.12 * s;
    this.armL.rotation.x = armLx; this.armR.rotation.x = armRx;
    this.armL.rotation.z = armLz; this.armR.rotation.z = armRz;
    this.body.position.y = bodyY;
    this.body.rotation.x = bodyRx;
    this.head.rotation.set(headRx, headRy, headRz);

    // --- floating Z z z ---
    if (this.zzz) {
      const show = s > 0.5 && sleeping;
      for (let i = 0; i < this.zzz.length; i++) {
        const z = this.zzz[i];
        if (!show) { z.visible = false; continue; }
        const p = ((this.time / 2.4) + i / 3) % 1;
        z.visible = true;
        z.position.set(0.35 + p * 0.5 + Math.sin(p * 6 + i) * 0.12, 2.1 + p * 1.5 + this.zBaseY, 0.25);
        z.scale.setScalar(0.3 + p * 0.45);
        z.material.opacity = Math.min(1, p * 5) * Math.min(1, (1 - p) * 3) * (s - 0.5) * 2;
      }
    }

    if (this.hooks.length) {
      const info = { t: this.time, sleep: s, alert: this.alertBlend, tired: tb, wake: startle, speed, moving };
      for (const fn of this.hooks) fn(dt, info);
    }
  }
}
Avatar.WAKE_TIME = 0.38;
Avatar.prototype.zBaseY = 0;
