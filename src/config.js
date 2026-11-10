// ─────────────────────────────────────────────────────────────
//  EGG DASH — game balance & content definitions
//  Everything tunable lives here.
// ─────────────────────────────────────────────────────────────

export const CYCLE = {
  length: 180,      // seconds: one full day → night → day loop (night every 3 minutes)
  nightStart: 120,  // seconds into the cycle when night falls
  dusk: 14,         // seconds of sunset blend before nightStart
  dawn: 10,         // seconds of sunrise blend at the end of the cycle
  divineChance: 1 / 30,
};

export const PLAYER = {
  baseWalk: 10,
  maxWalk: 62,
  jumpVelocity: 10.5,
  gravity: 30,
  radius: 0.55,
  carryPenalty: 0.86,
  hugeCarryPenalty: 0.72,
  maxEquippedPets: 3,
};

/** Walk speed derived from the Speed stat (smooth, diminishing returns). */
export function walkSpeedFor(speedStat) {
  return Math.min(PLAYER.maxWalk, PLAYER.baseWalk + 5.6 * Math.log(1 + speedStat / 20));
}

export const NIGHT_PAYOUT_BONUS = 1.5;
export const HUGE_EGG_CHANCE = 1 / 10;
export const HUGE_EGG_MULT = 10;

// ── Treadmills: 20 tiers, each with a unique look ───────────────
// style keys are consumed by world/treadmills.js
const TM_STYLES = [
  { name: 'Wooden Plank',   frame: 0x8b5a2b, belt: 0x3b2a1a, accent: 0xc28a4a, rail: 'wood',  glow: 0 },
  { name: 'Rustic Barn',    frame: 0xa63d2a, belt: 0x2e2420, accent: 0xf2e6d0, rail: 'wood',  glow: 0 },
  { name: 'Cobblestone',    frame: 0x8a8f96, belt: 0x34373b, accent: 0xb9bec4, rail: 'stone', glow: 0 },
  { name: 'Bamboo Breeze',  frame: 0x9bc45a, belt: 0x2f3a22, accent: 0xdcef9e, rail: 'bamboo',glow: 0 },
  { name: 'Iron Works',     frame: 0x5d6670, belt: 0x22262b, accent: 0x9aa4ad, rail: 'metal', glow: 0, metal: 0.8 },
  { name: 'Polished Steel', frame: 0xc6ced6, belt: 0x1f2328, accent: 0x6fb7ff, rail: 'metal', glow: 0.4, metal: 0.95 },
  { name: 'Copper Coil',    frame: 0xc26b3a, belt: 0x2a1c16, accent: 0xffb27a, rail: 'metal', glow: 0.5, metal: 0.9 },
  { name: 'Golden Stride',  frame: 0xf2c230, belt: 0x2d2412, accent: 0xfff1a6, rail: 'metal', glow: 0.7, metal: 1.0, gems: 0xffffff },
  { name: 'Ruby Rush',      frame: 0x8f1028, belt: 0x1e0a10, accent: 0xff3355, rail: 'metal', glow: 1.2, metal: 0.6, gems: 0xff2244 },
  { name: 'Sapphire Surge', frame: 0x14307a, belt: 0x0a1020, accent: 0x3d7bff, rail: 'metal', glow: 1.3, metal: 0.6, gems: 0x3d7bff },
  { name: 'Emerald Engine', frame: 0x0d5c3a, belt: 0x07160f, accent: 0x2dff9a, rail: 'metal', glow: 1.4, metal: 0.6, gems: 0x2dff9a },
  { name: 'Amethyst Arc',   frame: 0x4a1d7a, belt: 0x120a1c, accent: 0xb45cff, rail: 'metal', glow: 1.5, metal: 0.6, gems: 0xb45cff },
  { name: 'Crystal Core',   frame: 0xbfe9ff, belt: 0x0e1a24, accent: 0x9ff3ff, rail: 'crystal', glow: 1.8, metal: 0.2, crystals: true },
  { name: 'Magma Treader',  frame: 0x2a1412, belt: 0x120706, accent: 0xff5a14, rail: 'metal', glow: 2.2, metal: 0.3, lava: true },
  { name: 'Frostbite',      frame: 0xdff6ff, belt: 0x10202c, accent: 0x7fe0ff, rail: 'crystal', glow: 1.8, metal: 0.1, ice: true },
  { name: 'Neon Bloom',     frame: 0x1a1024, belt: 0x07040a, accent: 0xff3dcf, rail: 'neon',  glow: 2.6, metal: 0.5 },
  { name: 'Neon Pulse',     frame: 0x0b1424, belt: 0x03060a, accent: 0x18f0ff, rail: 'neon',  glow: 2.8, metal: 0.5 },
  { name: 'Hologram',       frame: 0x0c1a2a, belt: 0x02050a, accent: 0x66ffe0, rail: 'holo',  glow: 3.0, metal: 0.4, holo: true },
  { name: 'Cyber Laser',    frame: 0x0a0a12, belt: 0x020205, accent: 0xff1744, rail: 'laser', glow: 3.4, metal: 0.7, laser: true },
  { name: 'Quantum Cosmos', frame: 0x05030f, belt: 0x000000, accent: 0xa98bff, rail: 'laser', glow: 3.8, metal: 0.8, cosmic: true },
];

export const TREADMILLS = TM_STYLES.map((s, i) => ({
  tier: i + 1,
  ...s,
  // smooth, affordable price curve
  cost: i === 0 ? 0 : niceRound(60 * Math.pow(1.86, i - 1)),
  speedPerSec: +(1 * Math.pow(1.62, i)).toFixed(1),
  cashPerSec: +(0.6 * Math.pow(1.72, i)).toFixed(1),
}));

// ── Trails: functional training multipliers ─────────────────────
export const TRAILS = [
  { id: 'none',      name: 'No Trail',      mult: 1,    cost: 0,          colors: [] },
  { id: 'sparkle',   name: 'Sparkle Dust',  mult: 1.25, cost: 250,        colors: [0xffffff, 0xfff3a0], size: 0.35, rate: 40, rise: 0.6, sparkle: true },
  { id: 'flame',     name: 'Blazing Flame', mult: 1.5,  cost: 1500,       colors: [0xffe14a, 0xff6a00, 0xff1e00], size: 0.55, rate: 70, rise: 2.2 },
  { id: 'ocean',     name: 'Ocean Wave',    mult: 2,    cost: 8000,       colors: [0x7ff6ff, 0x1aa3ff, 0x0b3cff], size: 0.5, rate: 70, rise: 0.4, swirl: 2 },
  { id: 'toxic',     name: 'Toxic Ooze',    mult: 2.5,  cost: 40000,      colors: [0xc6ff3d, 0x39ff14, 0x0b8a00], size: 0.55, rate: 75, rise: -0.6, drip: true },
  { id: 'rainbow',   name: 'Rainbow Road',  mult: 3.5,  cost: 200000,     colors: [0xff3b3b, 0xffa53b, 0xfff23b, 0x3bff6a, 0x3bc8ff, 0x9b3bff], size: 0.5, rate: 90, rise: 0.2, rainbow: true },
  { id: 'galaxy',    name: 'Galaxy Drift',  mult: 5,    cost: 1000000,    colors: [0xffffff, 0xb07cff, 0x4b2bff, 0xff5cf0], size: 0.45, rate: 100, rise: 0.3, swirl: 3, sparkle: true },
  { id: 'plasma',    name: 'Plasma Storm',  mult: 7,    cost: 5000000,    colors: [0xffffff, 0x6cf2ff, 0xff4df5], size: 0.6, rate: 120, rise: 1.0, zap: true },
  { id: 'void',      name: 'Void Rift',     mult: 10,   cost: 25000000,   colors: [0x9b5cff, 0x3a0b7a, 0xff2bd6], size: 0.7, rate: 110, rise: -0.2, swirl: 4, dark: true },
  { id: 'celestial', name: 'Celestial Halo',mult: 15,   cost: 100000000,  colors: [0xffffff, 0xffe9a3, 0xffc63d, 0xa9f5ff], size: 0.65, rate: 140, rise: 1.4, swirl: 5, sparkle: true },
];

// ── Pets ─────────────────────────────────────────────────────────
export const RARITY = {
  common:    { name: 'Common',    color: '#b8c4d0', power: 1.15, order: 0 },
  uncommon:  { name: 'Uncommon',  color: '#5fe36b', power: 1.3,  order: 1 },
  rare:      { name: 'Rare',      color: '#3fa2ff', power: 1.6,  order: 2 },
  epic:      { name: 'Epic',      color: '#c25cff', power: 2.2,  order: 3 },
  legendary: { name: 'Legendary', color: '#ffb52e', power: 3.5,  order: 4 },
  divine:    { name: 'DIVINE',    color: '#fff3a8', power: 12,   order: 5 },
};

// body: 'round' | 'tall' | 'long' ; ears: 'pointy'|'floppy'|'long'|'round'|'none'|'tufts'
export const PETS = {
  doggy:    { name: 'Doggy',    rarity: 'common',    body: 'round', main: 0xd9a066, belly: 0xf6e3c6, ears: 'floppy', tail: 'stub', snout: true },
  kitty:    { name: 'Kitty',    rarity: 'common',    body: 'round', main: 0xff9f43, belly: 0xffffff, ears: 'pointy', tail: 'long', whiskers: true },
  chick:    { name: 'Chick',    rarity: 'common',    body: 'round', main: 0xffe14a, belly: 0xfff5b0, ears: 'none', beak: 0xff8a00, wings: 'small' },
  bunny:    { name: 'Bunny',    rarity: 'uncommon',  body: 'round', main: 0xf4f4f8, belly: 0xffd1dc, ears: 'long', tail: 'puff' },
  piggy:    { name: 'Piggy',    rarity: 'uncommon',  body: 'round', main: 0xffa6c1, belly: 0xffc9d8, ears: 'floppy', snout: 'pig', tail: 'curl' },
  mouse:    { name: 'Mousey',   rarity: 'uncommon',  body: 'round', main: 0xa7a9b4, belly: 0xffd6e0, ears: 'round', tail: 'long' },
  fox:      { name: 'Fox',      rarity: 'rare',      body: 'round', main: 0xff6a1a, belly: 0xffffff, ears: 'pointy', tail: 'bushy', snout: true },
  penguin:  { name: 'Penguin',  rarity: 'rare',      body: 'tall',  main: 0x1e2433, belly: 0xffffff, ears: 'none', beak: 0xffa31a, wings: 'flipper' },
  panda:    { name: 'Panda',    rarity: 'rare',      body: 'round', main: 0xffffff, belly: 0xffffff, ears: 'round', earColor: 0x1b1b1f, patches: 0x1b1b1f },
  owl:      { name: 'Owl',      rarity: 'epic',      body: 'tall',  main: 0x8b5e3c, belly: 0xe8cfa8, ears: 'tufts', beak: 0xffb000, wings: 'small', bigEyes: true },
  polar:    { name: 'Polar Bear',rarity: 'epic',     body: 'round', main: 0xf2f6ff, belly: 0xffffff, ears: 'round', snout: true },
  deer:     { name: 'Deer',     rarity: 'epic',      body: 'round', main: 0xb5753f, belly: 0xf3dcc0, ears: 'pointy', antlers: 0xe8d5b0, spots: true },
  dragon:   { name: 'Dragon',   rarity: 'legendary', body: 'long',  main: 0x2fd06a, belly: 0xfff08a, ears: 'none', horns: 0xfff2c4, wings: 'bat', tail: 'spike' },
  unicorn:  { name: 'Unicorn',  rarity: 'legendary', body: 'round', main: 0xfff5ff, belly: 0xffe0f7, ears: 'pointy', horn: 0xffd23f, mane: true },
  phoenix:  { name: 'Phoenix',  rarity: 'legendary', body: 'tall',  main: 0xff4d1a, belly: 0xffd23f, ears: 'none', beak: 0xffe14a, wings: 'feather', flame: true },
  // ── DIVINE (night-only event) ──
  d_dragon: { name: 'Divine Dragon',     rarity: 'divine', body: 'long',  main: 0xffc94a, belly: 0xfff3c4, ears: 'none', horns: 0xffffff, wings: 'bat', tail: 'spike' },
  d_unicorn:{ name: 'Celestial Unicorn', rarity: 'divine', body: 'round', main: 0xd9c8ff, belly: 0xffffff, ears: 'pointy', horn: 0xfff4b0, mane: true },
  d_phoenix:{ name: 'Seraph Phoenix',    rarity: 'divine', body: 'tall',  main: 0xffe08a, belly: 0xffffff, ears: 'none', beak: 0xffd23f, wings: 'feather', flame: true },
  d_kitty:  { name: 'Astral Kitty',      rarity: 'divine', body: 'round', main: 0xa98bff, belly: 0xf3eeff, ears: 'pointy', tail: 'long', whiskers: true },
};

// ── Hatchable eggs (Hatchery) ───────────────────────────────────
export const EGGS = [
  { id: 'basic',   name: 'Basic Egg',   cost: 150,     color: 0xf4efe1, spot: 0xd8c9a3, pool: { doggy: 40, kitty: 30, chick: 20, bunny: 8, piggy: 2 } },
  { id: 'spotted', name: 'Spotted Egg', cost: 2000,    color: 0x9fe3a0, spot: 0x3d9c4a, pool: { bunny: 35, piggy: 30, mouse: 20, fox: 12, penguin: 3 } },
  { id: 'jungle',  name: 'Jungle Egg',  cost: 25000,   color: 0x5bc6ff, spot: 0x1665b8, pool: { fox: 34, penguin: 30, panda: 22, owl: 11, dragon: 3 } },
  { id: 'crystal', name: 'Crystal Egg', cost: 300000,  color: 0xd6a8ff, spot: 0x7d36d6, pool: { panda: 30, owl: 28, polar: 20, deer: 16, unicorn: 6 } },
  { id: 'mythic',  name: 'Mythic Egg',  cost: 3000000, color: 0xffcf4a, spot: 0xff6a00, pool: { polar: 30, deer: 30, dragon: 20, unicorn: 12, phoenix: 8 } },
];

export const DIVINE_EGG = {
  id: 'divine', name: 'Divine Egg', cost: 5000, color: 0xfff6d0, spot: 0xffcf3a,
  divineOdds: 0.3, // otherwise a random Legendary
  pool: { d_dragon: 25, d_unicorn: 25, d_phoenix: 25, d_kitty: 25 },
  fallback: { dragon: 34, unicorn: 33, phoenix: 33 },
};

// ── Vaults (egg heist locations) ────────────────────────────────
export const VAULTS = [
  { id: 'coop',    name: 'Farm Coop',      x: -72, z: -58,  size: 28, color: 0xf6efe0, spot: 0xc79a5b, wall: 0xb5651d, floor: 0xd9c48a,
    value: 30,     guards: 1, guardSpeed: 7.5,  vision: 13, slots: 4, sweepers: 0, sweepSpeed: 0,   gate: false, respawn: 7,  hatchEgg: 'basic' },
  { id: 'crystal', name: 'Crystal Cavern', x: -30, z: -96,  size: 30, color: 0x9ff3ff, spot: 0x3fb6e0, wall: 0x5a6fa8, floor: 0x9fb4d9,
    value: 220,    guards: 2, guardSpeed: 12,   vision: 15, slots: 4, sweepers: 1, sweepSpeed: 0.8, gate: false, respawn: 9,  hatchEgg: 'spotted' },
  { id: 'gold',    name: 'Golden Vault',   x: 30,  z: -96,  size: 30, color: 0xffd34a, spot: 0xff9a00, wall: 0xd9a92c, floor: 0xe8c96a,
    value: 1600,   guards: 2, guardSpeed: 17,   vision: 16, slots: 5, sweepers: 1, sweepSpeed: 1.2, gate: true,  respawn: 10, hatchEgg: 'jungle' },
  { id: 'lava',    name: 'Lava Fortress',  x: 72,  z: -58,  size: 32, color: 0xff6a3d, spot: 0x7a1200, wall: 0x3a1c18, floor: 0x5a2a20,
    value: 13000,  guards: 3, guardSpeed: 23,   vision: 17, slots: 5, sweepers: 2, sweepSpeed: 1.4, gate: true,  respawn: 12, hatchEgg: 'crystal' },
  { id: 'neon',    name: 'Neon Citadel',   x: 0,   z: -138, size: 34, color: 0xff3dcf, spot: 0x18f0ff, wall: 0x14102a, floor: 0x1c1838,
    value: 110000, guards: 4, guardSpeed: 31,   vision: 18, slots: 6, sweepers: 2, sweepSpeed: 1.9, gate: true,  respawn: 14, hatchEgg: 'mythic' },
];

export const WORLD = {
  half: 160,                 // playable half-extent
  hub: { x: 0, z: 0, safeRadius: 26 },
  deposit: { x: 0, z: 14, radius: 4.2 },
  spawn: { x: 0, z: 22 },
  altar: { x: 0, z: -4 },
  hatchery: { x: 52, z: -2 },
  trailShop: { x: 50, z: 30 },
};

export function niceRound(v) {
  if (v < 100) return Math.round(v / 5) * 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}

export function formatNum(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = 0;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  const s = u === 0 ? (n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString())
                    : (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
  return (neg ? '-' : '') + s + units[u];
}
