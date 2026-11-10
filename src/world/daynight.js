import * as THREE from 'three';
import { CYCLE } from '../config.js';

const C = (h) => new THREE.Color(h);
// keyframes of the look: day, sunset, night, divine-night
const LOOKS = {
  day:    { top: C(0x2f86ff), horizon: C(0xbfe8ff), bottom: C(0xe6f6ff), fog: C(0xc4e6ff), sun: C(0xfff1d6), sunI: 2.5, hemiSky: C(0xcfe9ff), hemiGround: C(0x6f9a4a), hemiI: 0.95, env: 0.32, exposure: 0.92, bloom: 0.32 },
  sunset: { top: C(0x4a3a8f), horizon: C(0xff9a5a), bottom: C(0xffc58f), fog: C(0xf2a77a), sun: C(0xff9a4a), sunI: 1.7, hemiSky: C(0xffb98a), hemiGround: C(0x5a4a5a), hemiI: 0.75, env: 0.25, exposure: 0.98, bloom: 0.55 },
  night:  { top: C(0x030716), horizon: C(0x16224a), bottom: C(0x0a1028), fog: C(0x0e1634), sun: C(0x7f9fff), sunI: 0.42, hemiSky: C(0x24346e), hemiGround: C(0x0c0c18), hemiI: 0.32, env: 0.07, exposure: 1.05, bloom: 0.95 },
  divine: { top: C(0x140430), horizon: C(0x5a2478), bottom: C(0x1e0a32), fog: C(0x2a1442), sun: C(0xffd98a), sunI: 0.65, hemiSky: C(0x8a5aff), hemiGround: C(0x2a1440), hemiI: 0.55, env: 0.12, exposure: 1.1, bloom: 1.15 },
};

function lerpLook(a, b, t, out = {}) {
  for (const k of Object.keys(a)) {
    if (a[k] instanceof THREE.Color) { out[k] = out[k] || new THREE.Color(); out[k].copy(a[k]).lerp(b[k], t); }
    else out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
const smooth = (t) => t * t * (3 - 2 * t);

export class DayNight {
  constructor({ scene, sky, renderer, events }) {
    this.scene = scene;
    this.sky = sky;
    this.renderer = renderer;
    this.events = events;
    this.time = 4;              // seconds into cycle (start in bright morning)
    this.isNight = false;
    this.divine = false;
    this.divineBlend = 0;
    this.nightFactor = 0;       // 0 day → 1 full night (smooth)
    this.neon = [];             // { mat, base, always }
    this.nightLights = [];      // { light, base }
    this.forceDivineNext = false;
    this._look = {};

    scene.fog = new THREE.Fog(0xc4e6ff, 90, 460);

    this.hemi = new THREE.HemisphereLight(0xcfe9ff, 0x6f9a4a, 1.1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 3);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -70; cam.right = 70; cam.top = 70; cam.bottom = -70; cam.near = 1; cam.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.setShadowSize(2048);
    scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3();
  }

  setShadowSize(n) {
    this.sun.shadow.mapSize.set(n, n);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  registerNeon(mat, always = false) {
    this.neon.push({ mat, base: mat.emissiveIntensity, always });
  }
  registerNightLight(light) { this.nightLights.push({ light, base: light.intensity }); light.intensity = 0; }

  /** seconds until the next phase change */
  get countdown() {
    return this.isNight ? CYCLE.length - this.time : CYCLE.nightStart - this.time;
  }

  skipToDusk() { this.time = CYCLE.nightStart - 3; }
  skipToDawn() { this.time = CYCLE.length - 3; }

  update(dt, focus, elapsed) {
    this.time += dt;
    if (this.time >= CYCLE.length) this.time -= CYCLE.length;
    const t = this.time;

    const nowNight = t >= CYCLE.nightStart;
    if (nowNight !== this.isNight) {
      this.isNight = nowNight;
      if (nowNight) {
        const roll = Math.random() < CYCLE.divineChance || this.forceDivineNext;
        this.forceDivineNext = false;
        this.divine = roll;
        this.events.emit('night', { divine: roll });
      } else {
        const was = this.divine;
        this.divine = false;
        this.events.emit('day', { endedDivine: was });
      }
    }

    // nightFactor with dusk / dawn transitions
    let nf;
    if (t < CYCLE.nightStart - CYCLE.dusk) nf = 0;
    else if (t < CYCLE.nightStart) nf = (t - (CYCLE.nightStart - CYCLE.dusk)) / CYCLE.dusk;
    else if (t < CYCLE.length - CYCLE.dawn) nf = 1;
    else nf = 1 - (t - (CYCLE.length - CYCLE.dawn)) / CYCLE.dawn;
    // short morning glow after dawn
    const morning = t < 8 ? 1 - t / 8 : 0;
    this.nightFactor = smooth(THREE.MathUtils.clamp(nf, 0, 1));
    this.divineBlend += ((this.divine ? 1 : 0) - this.divineBlend) * Math.min(1, dt * 0.8);

    // blend day → sunset → night, then mix divine on top
    const L = this._look;
    const nfv = this.nightFactor;
    if (nfv < 0.5) lerpLook(LOOKS.day, LOOKS.sunset, smooth(nfv * 2), L);
    else lerpLook(LOOKS.sunset, LOOKS.night, smooth((nfv - 0.5) * 2), L);
    if (morning > 0 && nfv === 0) lerpLook(L, LOOKS.sunset, morning * 0.45, L);
    if (this.divineBlend > 0.001) lerpLook(L, LOOKS.divine, this.divineBlend * nfv, L);

    // sun / moon orbit: day portion spans the sun arc, night portion the moon arc
    let ang;
    if (t < CYCLE.nightStart) ang = (t / CYCLE.nightStart) * Math.PI;              // 0..π sun across the sky
    else ang = Math.PI + ((t - CYCLE.nightStart) / (CYCLE.length - CYCLE.nightStart)) * Math.PI;
    const elev = Math.sin(ang);
    // the shadow-casting light is the sun by day and the moon by night, so keep it above the horizon
    const sunDir = this.sunDir.set(Math.cos(ang) * 0.8, Math.max(0.35, Math.abs(elev)), 0.45).normalize();
    // during night the "sun" light is actually moonlight from the opposite side
    const skySun = new THREE.Vector3(Math.cos(ang) * 0.8, elev, 0.45).normalize();
    this.sky.uniforms.sunDir.value.copy(skySun);
    this.sky.uniforms.moonDir.value.copy(skySun).multiplyScalar(-1);
    this.sky.uniforms.topColor.value.copy(L.top);
    this.sky.uniforms.horizonColor.value.copy(L.horizon);
    this.sky.uniforms.bottomColor.value.copy(L.bottom);
    this.sky.uniforms.sunColor.value.copy(L.sun);
    this.sky.uniforms.stars.value = nfv;
    this.sky.uniforms.divine.value = this.divineBlend * nfv;
    this.sky.uniforms.time.value = elapsed;

    this.scene.fog.color.copy(L.fog);
    this.scene.fog.near = 90 - nfv * 30;
    this.scene.fog.far = 460 - nfv * 160;

    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.scene.environmentIntensity = L.env;
    this.renderer.renderer.toneMappingExposure = L.exposure;
    this.renderer.bloom.strength = L.bloom;

    // shadow camera follows focus, snapped to texels to avoid shimmer
    const size = 140 / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / size) * size, fz = Math.round(focus.z / size) * size;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + sunDir.x * 150, sunDir.y * 150, fz + sunDir.z * 150);

    for (const n of this.neon) n.mat.emissiveIntensity = n.always ? n.base * (0.7 + nfv * 0.6) : n.base * (0.08 + nfv * 0.92);
    for (const l of this.nightLights) l.light.intensity = l.base * nfv;
  }
}
