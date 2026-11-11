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
  baseWalk: 12,
  speedPerWalk: 500, // every 500 Speed = +1 stud/s (linear: double the Speed, double the bonus)
  maxWalk: 400,      // physics safety cap (reached at ~194K Speed)
  jumpVelocity: 10.5,
  gravity: 30,
  radius: 0.55,
  carryPenalty: 0.86,
  hugeCarryPenalty: 0.72,
};

/** Walk speed derived from the Speed stat: linear, so 100K Speed gives twice the bonus of 50K. */
export function walkSpeedFor(speedStat) {
  return Math.min(PLAYER.maxWalk, PLAYER.baseWalk + Math.max(0, speedStat) / PLAYER.speedPerWalk);
}
/** Speed stat needed to reach a given walk speed. */
export function speedForWalk(walk) {
  return Math.max(0, (walk - PLAYER.baseWalk) * PLAYER.speedPerWalk);
}

export const HUGE_EGG_CHANCE = 1 / 10;        // regular eggs
export const HUGE_DIVINE_CHANCE = 1 / 50;     // Divine eggs
export const HUGE_INCOME_MULT = 5;            // a HUGE pet earns 5x
export const HUGE_HATCH_MULT = 1.5;           // ...and takes 1.5x longer to hatch
export const SELL_SECONDS = 30;               // selling a pet pays 30 seconds of its income
export const PLOT_COUNT = 12;

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
  speedPerSec: Math.round(5 * Math.pow(1.45, i)), // Speed only: treadmills never pay cash
}));

// ── Trails: functional training multipliers ─────────────────────
export const TRAILS = [
  { id: 'none',      name: 'No Trail',      mult: 1,    cost: 0,          colors: [] },
  { id: 'sparkle',   name: 'Sparkle Dust',  mult: 1.25, cost: 100,        colors: [0xffffff, 0xfff3a0], size: 0.35, rate: 40, rise: 0.6, sparkle: true },
  { id: 'flame',     name: 'Blazing Flame', mult: 1.5,  cost: 600,       colors: [0xffe14a, 0xff6a00, 0xff1e00], size: 0.55, rate: 70, rise: 2.2 },
  { id: 'ocean',     name: 'Ocean Wave',    mult: 2,    cost: 3000,       colors: [0x7ff6ff, 0x1aa3ff, 0x0b3cff], size: 0.5, rate: 70, rise: 0.4, swirl: 2 },
  { id: 'toxic',     name: 'Toxic Ooze',    mult: 2.5,  cost: 15000,      colors: [0xc6ff3d, 0x39ff14, 0x0b8a00], size: 0.55, rate: 75, rise: -0.6, drip: true },
  { id: 'rainbow',   name: 'Rainbow Road',  mult: 3.5,  cost: 75000,     colors: [0xff3b3b, 0xffa53b, 0xfff23b, 0x3bff6a, 0x3bc8ff, 0x9b3bff], size: 0.5, rate: 90, rise: 0.2, rainbow: true },
  { id: 'galaxy',    name: 'Galaxy Drift',  mult: 5,    cost: 300000,    colors: [0xffffff, 0xb07cff, 0x4b2bff, 0xff5cf0], size: 0.45, rate: 100, rise: 0.3, swirl: 3, sparkle: true },
  { id: 'plasma',    name: 'Plasma Storm',  mult: 7,    cost: 1200000,    colors: [0xffffff, 0x6cf2ff, 0xff4df5], size: 0.6, rate: 120, rise: 1.0, zap: true },
  { id: 'void',      name: 'Void Rift',     mult: 10,   cost: 5000000,   colors: [0x9b5cff, 0x3a0b7a, 0xff2bd6], size: 0.7, rate: 110, rise: -0.2, swirl: 4, dark: true },
  { id: 'celestial', name: 'Celestial Halo',mult: 15,   cost: 20000000,  colors: [0xffffff, 0xffe9a3, 0xffc63d, 0xa9f5ff], size: 0.65, rate: 140, rise: 1.4, swirl: 5, sparkle: true },
];

// ── Pets ─────────────────────────────────────────────────────────
export const RARITY = {
  common:    { name: 'Common',    color: '#b8c4d0', order: 0 },
  uncommon:  { name: 'Uncommon',  color: '#5fe36b', power: 1.3,  order: 1 },
  rare:      { name: 'Rare',      color: '#3fa2ff', power: 1.6,  order: 2 },
  epic:      { name: 'Epic',      color: '#c25cff', power: 2.2,  order: 3 },
  legendary: { name: 'Legendary', color: '#ffb52e', power: 3.5,  order: 4 },
  divine:    { name: 'DIVINE',    color: '#fff3a8', power: 12,   order: 5 },
};

// body: 'round' | 'tall' | 'long' ; ears: 'pointy'|'floppy'|'long'|'round'|'none'|'tufts'
export const PETS = {
  doggy:    { name: 'Doggy',    rarity: 'common', income: 5,    body: 'round', main: 0xd9a066, belly: 0xf6e3c6, ears: 'floppy', tail: 'stub', snout: true },
  kitty:    { name: 'Kitty',    rarity: 'common', income: 3,    body: 'round', main: 0xff9f43, belly: 0xffffff, ears: 'pointy', tail: 'long', whiskers: true },
  chick:    { name: 'Chick',    rarity: 'common', income: 2,    body: 'round', main: 0xffe14a, belly: 0xfff5b0, ears: 'none', beak: 0xff8a00, wings: 'small' },
  bunny:    { name: 'Bunny',    rarity: 'uncommon', income: 10,  body: 'round', main: 0xf4f4f8, belly: 0xffd1dc, ears: 'long', tail: 'puff' },
  piggy:    { name: 'Piggy',    rarity: 'uncommon', income: 15,  body: 'round', main: 0xffa6c1, belly: 0xffc9d8, ears: 'floppy', snout: 'pig', tail: 'curl' },
  mouse:    { name: 'Mousey',   rarity: 'uncommon', income: 20,  body: 'round', main: 0xa7a9b4, belly: 0xffd6e0, ears: 'round', tail: 'long' },
  fox:      { name: 'Fox',      rarity: 'rare', income: 40,      body: 'round', main: 0xff6a1a, belly: 0xffffff, ears: 'pointy', tail: 'bushy', snout: true },
  penguin:  { name: 'Penguin',  rarity: 'rare', income: 60,      body: 'tall',  main: 0x1e2433, belly: 0xffffff, ears: 'none', beak: 0xffa31a, wings: 'flipper' },
  panda:    { name: 'Panda',    rarity: 'rare', income: 80,      body: 'round', main: 0xffffff, belly: 0xffffff, ears: 'round', earColor: 0x1b1b1f, patches: 0x1b1b1f },
  owl:      { name: 'Owl',      rarity: 'epic', income: 150,      body: 'tall',  main: 0x8b5e3c, belly: 0xe8cfa8, ears: 'tufts', beak: 0xffb000, wings: 'small', bigEyes: true },
  polar:    { name: 'Polar Bear',rarity: 'epic', income: 220,     body: 'round', main: 0xf2f6ff, belly: 0xffffff, ears: 'round', snout: true },
  deer:     { name: 'Deer',     rarity: 'epic', income: 300,      body: 'round', main: 0xb5753f, belly: 0xf3dcc0, ears: 'pointy', antlers: 0xe8d5b0, spots: true },
  dragon:   { name: 'Dragon',   rarity: 'legendary', income: 700, body: 'long',  main: 0x2fd06a, belly: 0xfff08a, ears: 'none', horns: 0xfff2c4, wings: 'bat', tail: 'spike' },
  unicorn:  { name: 'Unicorn',  rarity: 'legendary', income: 1000, body: 'round', main: 0xfff5ff, belly: 0xffe0f7, ears: 'pointy', horn: 0xffd23f, mane: true },
  phoenix:  { name: 'Phoenix',  rarity: 'legendary', income: 1500, body: 'tall',  main: 0xff4d1a, belly: 0xffd23f, ears: 'none', beak: 0xffe14a, wings: 'feather', flame: true },
  // ── DIVINE (night-only event) ──
  d_dragon: { name: 'Divine Dragon',     rarity: 'divine', income: 10000, body: 'long',  main: 0xffc94a, belly: 0xfff3c4, ears: 'none', horns: 0xffffff, wings: 'bat', tail: 'spike' },
  d_unicorn:{ name: 'Celestial Unicorn', rarity: 'divine', income: 7500, body: 'round', main: 0xd9c8ff, belly: 0xffffff, ears: 'pointy', horn: 0xfff4b0, mane: true },
  d_phoenix:{ name: 'Seraph Phoenix',    rarity: 'divine', income: 15000, body: 'tall',  main: 0xffe08a, belly: 0xffffff, ears: 'none', beak: 0xffd23f, wings: 'feather', flame: true },
  d_kitty:  { name: 'Astral Kitty',      rarity: 'divine', income: 5000, body: 'round', main: 0xa98bff, belly: 0xf3eeff, ears: 'pointy', tail: 'long', whiskers: true },
};

// ── Egg Lane: one long runway, zones get richer (and guards faster) the further you go ──
// z runs north (negative). `needWalk` is the walk speed that lets you outrun the guards with an egg.
export const LANE = { halfW: 16, start: -30, end: -1100 };

export const ZONES = [
  { id: 'coop',    name: 'Farm Coop',      z0: -36,  z1: -86,   color: 0xf6efe0, spot: 0xc79a5b, wall: 0x9a6a3a, floor: 0xd9c48a, trim: 0xe8d6b0,
    guards: 1, guardSpeed: 9,   vision: 13, eggs: 6, respawn: 6,  hatch: 8,   needWalk: 12,
    pool: { chick: 34, kitty: 33, doggy: 28, bunny: 5 } },
  { id: 'crystal', name: 'Crystal Cavern', z0: -98,  z1: -168,  color: 0x9ff3ff, spot: 0x3fb6e0, wall: 0x5a6fa8, floor: 0x9fb4d9, trim: 0x3fd8ff,
    guards: 2, guardSpeed: 18,  vision: 15, eggs: 6, respawn: 8,  hatch: 15,  needWalk: 22,
    pool: { bunny: 38, piggy: 30, mouse: 24, fox: 8 } },
  { id: 'gold',    name: 'Golden Vault',   z0: -182, z1: -282,  color: 0xffd34a, spot: 0xff9a00, wall: 0xd9a92c, floor: 0xe8c96a, trim: 0xffd34a,
    guards: 2, guardSpeed: 32,  vision: 18, eggs: 6, respawn: 10, hatch: 25,  needWalk: 40,
    pool: { fox: 36, penguin: 30, panda: 24, owl: 10 } },
  { id: 'lava',    name: 'Lava Fortress',  z0: -298, z1: -448,  color: 0xff6a3d, spot: 0x7a1200, wall: 0x3a1c18, floor: 0x5a2a20, trim: 0xff5a14,
    guards: 3, guardSpeed: 55,  vision: 22, eggs: 8, respawn: 12, hatch: 40,  needWalk: 68,
    pool: { owl: 36, polar: 30, deer: 26, dragon: 8 } },
  { id: 'neon',    name: 'Neon Citadel',   z0: -466, z1: -706,  color: 0xff3dcf, spot: 0x18f0ff, wall: 0x14102a, floor: 0x1c1838, trim: 0x18f0ff,
    guards: 3, guardSpeed: 95,  vision: 28, eggs: 8, respawn: 14, hatch: 60,  needWalk: 115,
    pool: { deer: 34, dragon: 32, unicorn: 24, phoenix: 10 } },
  { id: 'cosmic',  name: 'Cosmic Rift',    z0: -726, z1: -1086, color: 0xa98bff, spot: 0x2b1a6a, wall: 0x0c0820, floor: 0x120c2a, trim: 0xa98bff,
    guards: 4, guardSpeed: 160, vision: 34, eggs: 8, respawn: 16, hatch: 90,  needWalk: 195,
    pool: { dragon: 40, unicorn: 34, phoenix: 26 } },
];

// Divine eggs only appear during a DIVINE night (1 egg per zone) and always hatch a Divine pet.
export const DIVINE_EGG = {
  id: 'divine', name: 'Divine Egg', color: 0xfff6d0, spot: 0xffcf3a, hatch: 120,
  pool: { d_kitty: 30, d_unicorn: 30, d_dragon: 25, d_phoenix: 15 },
};

export function eggDef(id) { return id === 'divine' ? DIVINE_EGG : ZONES.find((z) => z.id === id); }
export function petIncome(species, huge) { return (PETS[species]?.income || 0) * (huge ? HUGE_INCOME_MULT : 1); }

export const WORLD = {
  half: 160,                 // playable half-extent of the main island
  hub: { x: 0, z: 0, safeRadius: 27 },
  spawn: { x: 0, z: 7 },
  altar: { x: 0, z: -4 },
  trailShop: { x: 50, z: 30 },
  // your base: 12 plots in two rows on the south side of the plaza
  plots: Array.from({ length: 12 }, (_, i) => ({ x: -15 + (i % 6) * 6, z: i < 6 ? 13 : 21 })),
  plotRadius: 2.2,
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
