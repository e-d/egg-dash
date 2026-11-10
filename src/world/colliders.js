/**
 * Lightweight 2.5D collision: axis-aligned boxes and circles with a top height.
 * Anything low enough relative to the mover's feet (step height) becomes walkable ground.
 */
export class Colliders {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.camBoxes = [];   // only block the camera (signs, roofs)
  }

  camBox(x, z, w, d, minY, maxY) {
    this.camBoxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY, maxY });
  }

  box(x, z, w, d, h, opts = {}) {
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, ...opts };
    this.boxes.push(b);
    return b;
  }
  circle(x, z, r, h, opts = {}) {
    const c = { x, z, r, h, ...opts };
    this.circles.push(c);
    return c;
  }

  /** Highest walkable surface under a circle at (x,z) given current feet height y. */
  groundAt(x, z, y, r, step = 0.65) {
    let g = 0;
    for (const b of this.boxes) {
      if (b.noWalk || b.h > y + step) continue;
      if (x + r * 0.5 > b.minX && x - r * 0.5 < b.maxX && z + r * 0.5 > b.minZ && z - r * 0.5 < b.maxZ) g = Math.max(g, b.h);
    }
    for (const c of this.circles) {
      if (c.noWalk || c.h > y + step) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r) ** 2) g = Math.max(g, c.h);
    }
    return g;
  }

  /** Push a circle mover out of anything it can't step onto. Mutates pos. */
  resolve(pos, r, step = 0.65) {
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.boxes) {
        if (b.h <= pos.y + step && !b.noWalk) continue;
        if (b.ghost) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-8) {
          // center inside box: push along smallest axis
          const pl = pos.x - b.minX, pr = b.maxX - pos.x, pd = pos.z - b.minZ, pu = b.maxZ - pos.z;
          const m = Math.min(pl, pr, pd, pu);
          if (m === pl) pos.x = b.minX - r; else if (m === pr) pos.x = b.maxX + r;
          else if (m === pd) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
          continue;
        }
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      }
      for (const c of this.circles) {
        if (c.h <= pos.y + step && !c.noWalk) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
  }

  /** True if a tall box blocks the segment (used for guard line-of-sight). */
  segmentBlocked(x1, z1, x2, z2, minH = 1.6) {
    for (const b of this.boxes) {
      if (b.h < minH || b.ghost) continue;
      if (segAABB(x1, z1, x2, z2, b)) return true;
    }
    return false;
  }
}

function segAABB(x1, z1, x2, z2, b) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, x1 - b.minX) && clip(dx, b.maxX - x1) && clip(-dz, z1 - b.minZ) && clip(dz, b.maxZ - z1) && t0 <= t1;
}
