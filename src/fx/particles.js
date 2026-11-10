import * as THREE from 'three';

const _c = new THREE.Color();

/**
 * One big additive-blended point cloud shared by every effect in the game.
 * Ring-buffer allocation: when full, the oldest particle is recycled.
 */
export class Particles {
  constructor(scene, max = 9000) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.col2 = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.colOut = new Float32Array(max * 3);
    this.twinkle = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.colOut, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('size', this.aSize);
    g.setAttribute('alpha', this.aAlpha);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */`
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p) * 2.0;
          if (d > 1.0) discard;
          float core = exp(-d * d * 4.0);
          float glow = (1.0 - d) * 0.6;
          gl_FragColor = vec4(vColor * (core + glow) * vAlpha, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  setViewport(height, fov) {
    this.material.uniforms.uScale.value = (height * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);
  }

  /**
   * o: { x,y,z, vx,vy,vz, color, color2, size, sizeEnd, life, gravity, drag, intensity, twinkle }
   */
  emit(o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    const k = o.intensity ?? 1.5;
    _c.set(o.color ?? 0xffffff);
    this.col[i3] = _c.r * k; this.col[i3 + 1] = _c.g * k; this.col[i3 + 2] = _c.b * k;
    _c.set(o.color2 ?? o.color ?? 0xffffff);
    this.col2[i3] = _c.r * k; this.col2[i3 + 1] = _c.g * k; this.col2[i3 + 2] = _c.b * k;
    this.size0[i] = o.size ?? 0.4;
    this.size1[i] = o.sizeEnd ?? 0;
    this.life[i] = this.maxLife[i] = o.life ?? 1;
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.twinkle[i] = o.twinkle ? 1 : 0;
  }

  burst(x, y, z, n, opts = {}) {
    const colors = opts.colors || [opts.color ?? 0xffffff];
    for (let j = 0; j < n; j++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1) * (opts.hemi ? 0.5 : 1);
      const sp = (opts.speed ?? 6) * (0.4 + Math.random() * 0.6);
      this.emit({
        x, y, z,
        vx: Math.sin(ph) * Math.cos(th) * sp,
        vy: Math.cos(ph) * sp * (opts.up ?? 1) + (opts.lift ?? 0),
        vz: Math.sin(ph) * Math.sin(th) * sp,
        color: colors[j % colors.length],
        color2: opts.color2,
        size: (opts.size ?? 0.5) * (0.6 + Math.random() * 0.8),
        sizeEnd: opts.sizeEnd ?? 0,
        life: (opts.life ?? 1) * (0.6 + Math.random() * 0.6),
        gravity: opts.gravity ?? -6,
        drag: opts.drag ?? 1.5,
        intensity: opts.intensity ?? 2,
        twinkle: opts.twinkle,
      });
    }
  }

  update(dt, time) {
    const { pos, vel, col, col2, colOut, size, size0, size1, alpha, life, maxLife, grav, drag, twinkle } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      life[i] -= dt;
      const i3 = i * 3;
      const d = Math.max(0, 1 - drag[i] * dt);
      vel[i3] *= d; vel[i3 + 1] = vel[i3 + 1] * d + grav[i] * dt; vel[i3 + 2] *= d;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      const t = 1 - Math.max(0, life[i]) / maxLife[i]; // 0 → 1
      size[i] = size0[i] + (size1[i] - size0[i]) * t;
      let a = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      if (twinkle[i]) a *= 0.55 + 0.45 * Math.sin(time * 25 + i);
      alpha[i] = Math.max(0, a);
      colOut[i3] = col[i3] + (col2[i3] - col[i3]) * t;
      colOut[i3 + 1] = col[i3 + 1] + (col2[i3 + 1] - col[i3 + 1]) * t;
      colOut[i3 + 2] = col[i3 + 2] + (col2[i3 + 2] - col[i3 + 2]) * t;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

/** Soft radial-gradient sprite texture shared by glow halos. */
let glowTex = null;
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function makeGlowSprite(color, scale = 2, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  s.userData.noAO = true;
  return s;
}
