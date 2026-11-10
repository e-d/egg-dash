import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** GTAO that ignores glowing / transparent FX (flagged with userData.noAO). */
class FxAwareGTAOPass extends GTAOPass {
  _overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      if (o.visible && (o.isPoints || o.isLine || o.isSprite || o.userData.noAO)) {
        o.visible = false;
        cache.push(o);
      }
    });
  }
}

export const QUALITY = {
  low:    { pixelRatio: 1,    shadows: 1024, ao: false, bloom: true,  smaa: false },
  medium: { pixelRatio: 1.25, shadows: 2048, ao: false, bloom: true,  smaa: true },
  high:   { pixelRatio: 2,    shadows: 2048, ao: true,  bloom: true,  smaa: true },
};

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2200);

    // soft image-based fill so metals & gems read well
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.gtao = new FxAwareGTAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.5, scale: 1.0, samples: 12 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.composer.addPass(this.gtao);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.42, 1.0);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);

    this.onResize = [];
    window.addEventListener('resize', () => this.resize());

    // adaptive quality bookkeeping
    this.fpsSamples = [];
    this.autoMode = true;
    this.autoDecided = false;
    this.autoTimer = 0;
    this.setQuality('high');
  }

  setQuality(level, auto = false) {
    if (level === 'auto') { this.autoMode = true; this.autoDecided = false; this.autoTimer = 0; this.fpsSamples = []; level = 'high'; }
    else if (!auto) this.autoMode = false;
    this.level = level;
    const q = QUALITY[level];
    this.q = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.gtao.enabled = q.ao;
    this.bloom.enabled = q.bloom;
    this.smaa.enabled = q.smaa;
    this.shadowSize = q.shadows;
    for (const fn of this.onResize) fn(true);
    this.resize();
  }

  /** Call every frame with real dt; downgrades once if the machine struggles. */
  trackPerformance(dt) {
    if (!this.autoMode || this.autoDecided) return;
    this.autoTimer += dt;
    if (this.autoTimer < 2) return;           // ignore shader-compile warmup
    this.fpsSamples.push(dt);
    if (this.autoTimer > 7) {
      const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
      const fps = 1 / avg;
      if (fps < 32 && this.level === 'high') { this.setQuality('medium', true); this.autoTimer = 1.5; this.fpsSamples = []; return; }
      if (fps < 32 && this.level === 'medium') this.setQuality('low', true);
      this.autoDecided = true;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    for (const fn of this.onResize) fn(false);
  }

  render() { this.composer.render(); }
}
