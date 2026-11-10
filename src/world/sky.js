import * as THREE from 'three';

/** Stylized gradient sky with sun, moon, procedural twinkling stars and a divine aurora. */
export class Sky {
  constructor(scene) {
    this.uniforms = {
      topColor: { value: new THREE.Color(0x3b8cff) },
      horizonColor: { value: new THREE.Color(0xbfe6ff) },
      bottomColor: { value: new THREE.Color(0xdff3ff) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      sunColor: { value: new THREE.Color(0xfff2c0) },
      stars: { value: 0 },
      divine: { value: 0 },
      time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 topColor, horizonColor, bottomColor, sunDir, moonDir, sunColor;
        uniform float stars, divine, time;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
                             : mix(horizonColor, bottomColor, clamp(-h * 4.0, 0.0, 1.0));
          // sun
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12) * smoothstep(-0.1, 0.05, sunDir.y);
          // moon (crisp disk + halo)
          float md = max(dot(d, moonDir), 0.0);
          float moonVis = smoothstep(-0.05, 0.1, moonDir.y);
          col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 2.4 + pow(md, 60.0) * 0.25) * moonVis;
          // stars
          if (stars > 0.01 && h > 0.0) {
            vec3 cell = floor(d * 260.0);
            float s = hash(cell);
            float tw = 0.6 + 0.4 * sin(time * 2.0 + s * 80.0);
            float star = step(0.9965, s) * tw * smoothstep(0.0, 0.25, h);
            col += vec3(0.9, 0.95, 1.0) * star * stars * 1.6;
          }
          // divine aurora ribbons
          if (divine > 0.01 && h > 0.05) {
            float a = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              float band = sin(d.x * (3.0 + fi) + time * (0.25 + fi * 0.1) + fi * 2.0) * 0.12 + 0.35 + fi * 0.12;
              a += smoothstep(0.09, 0.0, abs(h - band)) * (0.6 + 0.4 * sin(d.z * 8.0 + time + fi));
            }
            vec3 aur = mix(vec3(1.0, 0.82, 0.3), vec3(0.75, 0.35, 1.0), 0.5 + 0.5 * sin(d.x * 4.0 + time * 0.4));
            col += aur * a * divine * 0.9;
            col = mix(col, col * vec3(1.15, 1.0, 1.25), divine * 0.4);
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.userData.noAO = true;
    scene.add(this.mesh);
  }

  follow(camera) { this.mesh.position.copy(camera.position); }
}
