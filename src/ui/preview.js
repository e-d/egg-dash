import * as THREE from 'three';
import { buildPet } from '../entities/pets.js';
import { PETS, RARITY, ZONES, DIVINE_EGG } from '../config.js';
import { eggGeometry, eggTexture } from '../util.js';
import { audio } from '../engine/audio.js';

function raysTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  for (let i = 0; i < 18; i++) {
    g.rotate((Math.PI * 2) / 18);
    const grd = g.createLinearGradient(0, 0, 0, -256);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -256); g.lineTo(22, -256); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Small dedicated renderer for pet/egg thumbnails and the hatch cinematic.
 */
export class Preview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(512, 512, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6677aa, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xaaccff, 1.6); rim.position.set(-4, 3, -4); this.scene.add(rim);
    this.cache = new Map();
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: raysTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.rays.position.set(0, 0.8, -2);
    this.scene.add(this.rays);
    this.sparks = [];
    this.active = null;
    this.queue = [];
  }

  clearRoot() { while (this.root.children.length) this.root.remove(this.root.children[0]); }

  frameObject(height = 1.6) {
    this.camera.position.set(0, height * 0.62, height * 3.0);
    this.camera.lookAt(0, height * 0.42, 0);
  }

  thumb(species) {
    if (this.cache.has(species)) return this.cache.get(species);
    this.clearRoot();
    this.rays.material.opacity = 0;
    const pet = buildPet(species);
    pet.rotation.y = -0.5;
    this.root.add(pet);
    this.frameObject(1.7);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(species, url);
    this.clearRoot();
    return url;
  }

  eggThumb(egg) {
    const k = 'egg_' + egg.id;
    if (this.cache.has(k)) return this.cache.get(k);
    this.clearRoot();
    this.rays.material.opacity = 0;
    const m = this.makeEgg(egg);
    this.root.add(m);
    this.frameObject(1.5);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.cache.set(k, url);
    this.clearRoot();
    return url;
  }

  makeEgg(egg) {
    const i = Math.max(0, ZONES.indexOf(egg));
    const mat = new THREE.MeshStandardMaterial({ map: eggTexture(egg.color, egg.spot, egg.id === 'divine' || i % 2 ? 'stripes' : 'spots'), roughness: 0.3, metalness: egg.id === 'divine' ? 0.4 : 0.05, emissive: egg.color, emissiveIntensity: egg.id === 'divine' ? 0.5 : 0.12 });
    const m = new THREE.Mesh(eggGeometry(0.42, 1.08), mat);
    m.scale.setScalar(1.25);
    return m;
  }

  prewarm() {
    for (const s of Object.keys(PETS)) this.thumb(s);
    for (const e of [...ZONES, DIVINE_EGG]) this.eggThumb(e);
  }

  /** Queue a hatch cinematic. results: [{ species, egg }] */
  playHatch(results, onDone) {
    this.queue.push(...results.map((r) => ({ ...r })));
    this.onDone = onDone;
    if (!this.active) this.next();
  }

  next() {
    const item = this.queue.shift();
    const overlay = document.getElementById('hatch-overlay');
    const info = document.getElementById('hatch-info');
    if (!item) {
      this.active = null;
      overlay.classList.add('hidden');
      overlay.classList.remove('divine');
      this.onDone && this.onDone();
      return;
    }
    overlay.classList.remove('hidden');
    info.innerHTML = `<div class="hint">Hatching ${item.egg.name}…</div>`;
    this.clearRoot();
    const egg = this.makeEgg(item.egg);
    egg.scale.setScalar(2.0);
    this.root.add(egg);
    const pet = buildPet(item.species);
    pet.visible = false;
    this.root.add(pet);
    this.frameObject(2.2);
    const rar = RARITY[PETS[item.species].rarity];
    this.rays.material.color.set(rar.color);
    this.rays.material.opacity = 0;
    this.active = { item, egg, pet, t: 0, revealed: false, rar, nextShake: 0.2, shakeN: 0, canSkip: false };
    overlay.classList.toggle('divine', PETS[item.species].rarity === 'divine');
    overlay.onclick = () => { if (this.active?.canSkip) this.next(); else if (this.active) this.active.t = Math.max(this.active.t, 2.0); };
  }

  skip() { if (this.active?.canSkip) this.next(); }

  update(dt) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const shakeEnd = 2.2;
    if (!a.revealed) {
      const k = a.t / shakeEnd;
      const amp = 0.05 + k * k * 0.35;
      a.egg.rotation.z = Math.sin(a.t * (18 + k * 30)) * amp;
      a.egg.position.y = Math.abs(Math.sin(a.t * 9)) * 0.08 * k;
      a.egg.material.emissiveIntensity = 0.12 + k * 1.2;
      if (a.t > a.nextShake) { audio.shake(a.shakeN++); a.nextShake += Math.max(0.12, 0.4 - k * 0.3); }
      if (a.t >= shakeEnd) {
        a.revealed = true;
        a.egg.visible = false;
        a.pet.visible = true;
        a.pet.scale.setScalar(0.01);
        a.revealT = a.t;
        const order = a.rar.order;
        audio.reveal(order);
        const def = PETS[a.item.species];
        const info = document.getElementById('hatch-info');
        info.innerHTML = `<div class="rar" style="color:${a.rar.color}">${a.rar.name.toUpperCase()}</div>
          <h2>${def.name}</h2>
          <div class="boost">earns $${def.income}/s</div>
          <div class="hint">${this.queue.length ? `${this.queue.length} more… ` : ''}click / press E to continue</div>`;
        this.spawnSparks(a.rar.color, order);
      }
    } else {
      const rt = a.t - a.revealT;
      const s = Math.min(1, rt * 3);
      const bounce = 1 + Math.sin(Math.min(1, rt * 2.2) * Math.PI) * 0.25;
      a.pet.scale.setScalar(Math.max(0.01, s * bounce * 1.25));
      a.pet.rotation.y = Math.sin(rt * 1.2) * 0.6;
      a.pet.position.y = 0.1 + Math.sin(rt * 3) * 0.05;
      const ud = a.pet.userData;
      for (const w of ud.wings) w.g.rotation.z = w.s * Math.sin(rt * 12) * 0.5;
      if (ud.halo) ud.halo.rotation.z = rt;
      this.rays.material.opacity = Math.min(0.85, rt * 2) * (a.rar.order >= 3 ? 1 : 0.6);
      this.rays.rotation.z += dt * (a.rar.order >= 5 ? 1.2 : 0.4);
      if (rt > 0.8) a.canSkip = true;
      if (rt > 4.5) this.next();
    }
    for (const sp of this.sparks) {
      sp.life -= dt;
      sp.m.position.addScaledVector(sp.v, dt);
      sp.v.y -= dt * 2;
      sp.m.material.opacity = Math.max(0, sp.life);
      sp.m.visible = sp.life > 0;
    }
    this.sparks = this.sparks.filter((s) => { if (s.life <= 0) { this.scene.remove(s.m); return false; } return true; });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
  }

  spawnSparks(color, order) {
    const n = 20 + order * 18;
    const geo = new THREE.OctahedronGeometry(0.06, 0);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 ? color : 0xffffff, transparent: true, blending: THREE.AdditiveBlending }));
      m.position.set(0, 0.9, 0);
      const th = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      const v = new THREE.Vector3(Math.cos(th) * sp, 1 + Math.random() * 3, Math.sin(th) * sp * 0.4);
      this.scene.add(m);
      this.sparks.push({ m, v, life: 1 + Math.random() });
    }
  }
}
