import { TRAILS } from '../config.js';
import { state } from '../state.js';

/** Emits the equipped trail's particles behind the player. */
export class TrailEmitter {
  constructor(particles) {
    this.p = particles;
    this.acc = 0;
    this.hue = 0;
  }

  update(dt, t, player) {
    const def = TRAILS.find((x) => x.id === state.data.trail);
    if (!def || def.id === 'none') return;
    const moving = player.horizSpeed > 1 || player.training;
    const rate = def.rate * (moving ? 1 : 0.12);
    this.acc += rate * dt;
    const yaw = player.yaw;
    const bx = -Math.sin(yaw), bz = -Math.cos(yaw);
    while (this.acc >= 1) {
      this.acc -= 1;
      const k = Math.random();
      let color = def.colors[Math.floor(Math.random() * def.colors.length)];
      if (def.rainbow) { this.hue = (this.hue + 0.013) % 1; color = hsl(this.hue); }
      const spread = 0.45;
      let x = player.pos.x + bx * 0.5 + (Math.random() - 0.5) * spread;
      let z = player.pos.z + bz * 0.5 + (Math.random() - 0.5) * spread;
      let y = player.pos.y + 0.25 + Math.random() * 1.2;
      let vx = bx * (player.training ? 4 : 0.6), vz = bz * (player.training ? 4 : 0.6), vy = def.rise * (0.5 + k);
      if (def.swirl) {
        const a = t * def.swirl * 2 + k * Math.PI * 2;
        x += Math.cos(a) * 0.5; z += Math.sin(a) * 0.5;
        vx += Math.cos(a + 1.57) * 0.8; vz += Math.sin(a + 1.57) * 0.8;
      }
      if (def.zap && Math.random() < 0.15) { vx += (Math.random() - 0.5) * 8; vy += (Math.random() - 0.5) * 6; vz += (Math.random() - 0.5) * 8; }
      this.p.emit({
        x, y, z, vx, vy, vz,
        color, color2: def.colors[def.colors.length - 1],
        size: def.size * (0.7 + Math.random() * 0.6), sizeEnd: def.drip ? def.size * 0.4 : 0,
        life: 0.6 + Math.random() * 0.6,
        gravity: def.drip ? -8 : 0, drag: 1.2,
        intensity: def.dark ? 1.4 : 2.4,
        twinkle: def.sparkle,
      });
    }
  }
}

function hsl(h) {
  const f = (n) => { const k = (n + h * 12) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}
