import * as THREE from 'three';
import { WORLD, PETS, RARITY, eggDef, eggName, petIncome, formatNum } from '../config.js';
import { state } from '../state.js';
import { mat, mesh, neonMat, textTexture, signPlane, eggGeometry, eggMaterial, roundRect } from '../util.js';
import { buildPet, animatePet } from '../entities/pets.js';
import { makeGlowSprite } from '../fx/particles.js';

const PAD_H = 0.35;
const EGG_GEO = eggGeometry(0.42, 1.08, 24);

/**
 * Your base: a row of pads in the plaza. Drop a stolen egg on an empty pad, it incubates,
 * hatches into a pet, and the pet earns cash every second.
 */
export class Base {
  constructor({ scene, colliders, daynight }) {
    this.scene = scene;
    this.daynight = daynight;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.eggMats = new Map();
    this.onHatch = null;
    const R = WORLD.plotRadius;
    const padMat = mat(0x2b3a55, { metalness: 0.4, roughness: 0.45 });
    const topMat = mat(0x3a4d70, { metalness: 0.2, roughness: 0.5 });

    this.pads = WORLD.plots.map((p, i) => {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      this.group.add(g);
      g.add(mesh(new THREE.CylinderGeometry(R, R + 0.25, PAD_H, 36), padMat, { y: PAD_H / 2 }));
      g.add(mesh(new THREE.CircleGeometry(R - 0.3, 36), topMat, { y: PAD_H + 0.01, rx: -Math.PI / 2, cast: false }));
      const ringMat = neonMat(0x3dff7a, 1.4);
      daynight.registerNeon(ringMat, true);
      g.add(mesh(new THREE.TorusGeometry(R - 0.1, 0.09, 6, 48), ringMat, { y: PAD_H + 0.02, rx: Math.PI / 2, cast: false }));
      colliders.circle(p.x, p.z, R + 0.2, PAD_H);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: textTexture(String(i + 1), { w: 128, h: 128, size: 96, color: '#ffffff' }), transparent: true, depthWrite: false, opacity: 0.35 }));
      num.rotation.x = -Math.PI / 2; num.position.set(0, PAD_H + 0.03, R - 0.75); num.userData.noAO = true;
      g.add(num);
      // label sprite (redrawn in place when its text changes)
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 176;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      label.scale.set(3.4, 1.17, 1); label.position.y = 3.6; label.userData.noAO = true;
      g.add(label);
      const glow = makeGlowSprite(0xffffff, 3.5, 0); glow.position.y = 1; g.add(glow);
      return { i, x: p.x, z: p.z, group: g, ringMat, label, canvas, tex, glow, key: null, labelKey: null, model: null, phase: Math.random() * 10 };
    });

    // base sign behind the back row, facing the lane
    const signTex = textTexture(['YOUR BASE', 'drop eggs on an empty pad to hatch them'], { w: 1024, h: 256, bg: '#2a8f4a', border: '#c8ffd8', size: 108 });
    const sign = signPlane(signTex, 14, 3.5, true);
    sign.material.emissiveIntensity = 0.3;
    daynight.registerNeon(sign.material, true);
    sign.position.set(0, 5.6, 26.4);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
    const back = sign.clone(); back.rotation.y = 0; back.position.z = 26.6; this.group.add(back);
    for (const sx of [-6.6, 6.6]) {
      this.group.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 7.4, 8), mat(0x6b4a2a), { x: sx, y: 3.7, z: 26.5 }));
      colliders.circle(sx, 26.5, 0.35, 8);
    }
    colliders.camBox(0, 26.5, 14.5, 1, 3.8, 7.4);
    this.sync();
  }

  eggMat(id) {
    if (!this.eggMats.has(id)) this.eggMats.set(id, eggMaterial(eggDef(id)));
    return this.eggMats.get(id);
  }

  /** Rebuild any pad whose contents changed (placed, hatched or sold). */
  sync() {
    state.data.plots.forEach((p, i) => {
      const pad = this.pads[i];
      const key = p ? `${p.egg}:${p.species}:${p.huge}:${p.hatchLeft > 0 ? 'egg' : 'pet'}` : '';
      if (key === pad.key) return;
      pad.key = key;
      if (pad.model) { pad.group.remove(pad.model); pad.model = null; }
      pad.glow.material.opacity = 0;
      if (!p) { pad.ringMat.emissive.setHex(0x3dff7a); pad.ringMat.color.setHex(0x3dff7a); return; }
      if (p.hatchLeft > 0) {
        const egg = new THREE.Mesh(EGG_GEO, this.eggMat(p.egg));
        egg.castShadow = true;
        const g = new THREE.Group(); g.add(egg);
        g.scale.setScalar(p.huge ? 2.0 : 1.2);
        g.position.y = PAD_H;
        pad.model = g;
        pad.ringMat.emissive.setHex(0xffd23f); pad.ringMat.color.setHex(0xffd23f);
      } else {
        const pet = buildPet(p.species);
        pet.scale.setScalar(p.huge ? 2.0 : 1.25);
        pet.position.y = PAD_H;
        pet.rotation.y = Math.PI; // face the lane / spawn
        pad.model = pet;
        const rc = new THREE.Color(RARITY[PETS[p.species].rarity].color);
        pad.ringMat.emissive.copy(rc); pad.ringMat.color.copy(rc);
        pad.glow.material.color.copy(rc);
        pad.glow.material.opacity = PETS[p.species].rarity === 'divine' ? 0.5 : p.huge ? 0.35 : 0;
      }
      pad.group.add(pad.model);
    });
  }

  drawLabel(pad, p) {
    let lines, key;
    if (!p) { lines = [['Empty pad', '#c8ffd8'], ['bring an egg here', '#ffffff']]; }
    else if (p.hatchLeft > 0) {
      const d = eggDef(p.egg);
      const secs = Math.ceil(p.hatchLeft);
      lines = [[`${p.huge ? 'HUGE ' : ''}${eggName(p.egg)}`, d.divine ? '#ffe9a0' : '#ffffff'], [`Hatching… ${secs}s`, '#ffd23f']];
    } else {
      const def = PETS[p.species], r = RARITY[def.rarity];
      lines = [[`${p.huge ? 'HUGE ' : ''}${def.name}`, r.color], [`$${formatNum(petIncome(p.species, p.huge))}/s`, '#7dffa6']];
    }
    key = lines.map((l) => l[0]).join('|');
    if (key === pad.labelKey) return;
    pad.labelKey = key;
    const c = pad.canvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(15,12,35,0.78)';
    roundRect(g, 8, 8, c.width - 16, c.height - 16, 30); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    lines.forEach(([text, color], k) => {
      g.font = `${k === 0 ? 58 : 52}px "Lilita One", Arial Black, sans-serif`;
      g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(text, 256, 56 + k * 66, 480);
      g.fillStyle = color; g.fillText(text, 256, 56 + k * 66, 480);
    });
    pad.tex.needsUpdate = true;
  }

  update(dt, t, particles, focus, carrying = false) {
    const plots = state.data.plots;
    let changed = false;
    plots.forEach((p, i) => {
      const pad = this.pads[i];
      if (p && p.hatchLeft > 0) {
        p.hatchLeft = Math.max(0, p.hatchLeft - dt);
        if (p.hatchLeft === 0) {
          changed = true;
          state.data.hatched++;
          particles.burst(pad.x, 1.5, pad.z, p.huge ? 140 : 70, { colors: [0xffffff, 0xffe14a, new THREE.Color(RARITY[PETS[p.species].rarity].color).getHex()], speed: p.huge ? 10 : 7, life: 1.2, size: 0.45, gravity: -8 });
          if (this.onHatch) this.onHatch(i, p);
        }
      }
    });
    if (changed) { this.sync(); state.emit('plots'); state.save(); }

    const near = Math.abs(focus.z) < 120 && Math.abs(focus.x) < 120;
    plots.forEach((p, i) => {
      const pad = this.pads[i];
      pad.label.visible = !!p || carrying; // empty-pad hints only while you're bringing an egg home
      if (near && pad.label.visible) this.drawLabel(pad, p);
      if (!pad.model || !p) return;
      if (p.hatchLeft > 0) {
        // wobble harder as hatching gets close
        const k = 1 - p.hatchLeft / p.hatchTotal;
        const w = 0.04 + k * k * 0.25;
        pad.model.rotation.z = Math.sin(t * (4 + k * 14) + i) * w;
        pad.model.position.y = PAD_H + Math.max(0, Math.sin(t * 6 + i)) * k * 0.15;
        if (k > 0.75 && Math.random() < dt * 6) particles.emit({ x: pad.x + (Math.random() - 0.5), y: 1.5 + Math.random(), z: pad.z + (Math.random() - 0.5), vy: 1.2, color: 0xfff3a0, size: 0.25, life: 0.8, intensity: 2.5, twinkle: true });
        return;
      }
      const ud = pad.model.userData;
      pad.phase += dt;
      const fly = ud.flyer || ud.divine;
      pad.model.position.y = PAD_H + (fly ? 1.0 + Math.sin(pad.phase * 2) * 0.25 : Math.abs(Math.sin(pad.phase * 2.4)) * 0.18);
      pad.model.rotation.y = Math.PI + Math.sin(pad.phase * 0.6 + i) * 0.5;
      if (ud.tail) ud.tail.rotation.y = Math.sin(t * 8 + i) * 0.5;
      if (ud.wings) for (const w of ud.wings) w.g.rotation.z = w.s * (fly ? Math.sin(t * 12 + i) * 0.6 : Math.sin(t * 4 + i) * 0.15);
      if (ud.halo) ud.halo.rotation.z = t;
      if (near) animatePet(pad.model, t, dt);
      if (ud.divine && near && Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2;
        particles.emit({ x: pad.x + Math.cos(a) * 0.8, y: 1.2 + Math.random() * 1.6, z: pad.z + Math.sin(a) * 0.8, vx: Math.cos(a) * 0.3, vy: 1.4, vz: Math.sin(a) * 0.3,
          color: Math.random() < 0.5 ? 0xffd66b : 0xb48cff, color2: 0xffffff, size: 0.26, life: 1.2, intensity: 2.2, twinkle: true });
      }
    });
  }

  /** Index of the pad under (x,z), or -1. */
  padAt(x, z, extra = 0.3) {
    const R = WORLD.plotRadius + extra;
    for (const pad of this.pads) if ((x - pad.x) ** 2 + (z - pad.z) ** 2 < R * R) return pad.i;
    return -1;
  }

  nearestFree(x, z) {
    let best = null, bd = Infinity;
    state.data.plots.forEach((p, i) => {
      if (p) return;
      const pad = this.pads[i], d = (x - pad.x) ** 2 + (z - pad.z) ** 2;
      if (d < bd) { bd = d; best = pad; }
    });
    return best;
  }
}
