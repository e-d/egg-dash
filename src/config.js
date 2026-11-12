// ─────────────────────────────────────────────────────────────
//  EGG DASH — game balance & content definitions
//  Everything tunable lives here.
// ─────────────────────────────────────────────────────────────

export const CYCLE = {
  length: 180,      // seconds: one full day → night → day loop (night every 3 minutes)
  nightStart: 120,  // seconds into the cycle when night falls
  dusk: 14,         // seconds of sunset blend before nightStart
  dawn: 10,         // seconds of sunrise blend at the end of the cycle
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
export const HUGE_LUCKY_CHANCE = 1 / 3;       // with the Lucky Clover boost (Divine eggs are never HUGE)
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
  // D Coin exclusives (bought in the SHOP)
  { id: 'comet',     name: 'Golden Comet',  mult: 12,   dcoins: 400, colors: [0xfff6c0, 0xffd23f, 0xff9a1a], size: 0.6, rate: 130, rise: 0.8, swirl: 2, sparkle: true },
  { id: 'divine',    name: 'Divine Aura',   mult: 20,   dcoins: 700, colors: [0xffffff, 0xfff3a8, 0xd9b8ff, 0x9ff3ff], size: 0.75, rate: 160, rise: 1.8, swirl: 6, sparkle: true },
];

// ── Pets ─────────────────────────────────────────────────────────
export const RARITY = {
  common:    { name: 'Common',    color: '#b8c4d0', order: 0 },
  uncommon:  { name: 'Uncommon',  color: '#5fe36b', order: 1 },
  rare:      { name: 'Rare',      color: '#3fa2ff', order: 2 },
  epic:      { name: 'Epic',      color: '#c25cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffb52e', order: 4 },
  divine:    { name: 'DIVINE',    color: '#fff3a8', order: 5 },
};

// Pet look flags (consumed by entities/pets.js):
//   body: 'round' | 'tall' | 'long'
//   ears: 'pointy' | 'floppy' | 'long' | 'round' | 'tufts' | 'big' | 'none'
//   tail: 'stub' | 'puff' | 'long' | 'bushy' | 'curl' | 'spike' | 'fish'
//   wings: 'small' | 'flipper' | 'bat' | 'feather' | 'bug'
//   snout: true | 'pig' ; beak: color ; jaw: true (long toothy dino snout)
//   colors: horns, horn (unicorn), antlers, earColor, patches, cowSpots, leaves (leaf crown), spikes (row along the back),
//           fins (dorsal + side fins), claws (pincers), antennae, shell (back shell), tentacles (replace legs),
//           visor (glowing band over eyes), crown, stars (orbiting sparkles), flower, glow (emissive tint)
//   bools:  hump, metal (shiny metallic), eyes3 (three eyes), bigEyes, whiskers, spots, mane, flame
//   aura:   Divine accent colour (halo, wings, glow) so each land's Divines look different
//   land:   which land's eggs it hatches from (filled in below)
export const PETS = {
  // ── 1. Forest ──
  squirrel:  { name: 'Squirrel',     rarity: 'common',    income: 3,     body: 'round', main: 0xb5651d, belly: 0xf3d6b0, ears: 'tufts', tail: 'bushy' },
  bunny:     { name: 'Bunny',        rarity: 'uncommon',  income: 5,     body: 'round', main: 0xf4f4f8, belly: 0xffd1dc, ears: 'long', tail: 'puff' },
  fox:       { name: 'Fox',          rarity: 'rare',      income: 8,     body: 'round', main: 0xff6a1a, belly: 0xffffff, ears: 'pointy', tail: 'bushy', snout: true },
  owl:       { name: 'Owl',          rarity: 'epic',      income: 13,    body: 'tall',  main: 0x8b5e3c, belly: 0xe8cfa8, ears: 'tufts', beak: 0xffb000, wings: 'small', bigEyes: true },
  d_treant:  { name: 'Ancient Treant', rarity: 'divine',  income: 25000, body: 'round', main: 0x6b4a2b, belly: 0x9a7a4a, ears: 'none', leaves: 0x5fdc4a, antlers: 0x8a5a2b, aura: 0x7dff6a, tail: 'stub' },
  d_stag:    { name: 'Sylvan Stag',  rarity: 'divine',    income: 35000, body: 'round', main: 0xe8fff0, belly: 0xffffff, ears: 'pointy', antlers: 0x6dff9a, leaves: 0x9dff6a, spots: true, aura: 0x9dff6a, tail: 'puff' },

  // ── 2. Desert ──
  camel:     { name: 'Camel',        rarity: 'common',    income: 10,    body: 'round', main: 0xd9a85a, belly: 0xf2d9a8, ears: 'round', hump: true, tail: 'stub', snout: true },
  scorpion:  { name: 'Scorpion',     rarity: 'uncommon',  income: 17,    body: 'round', main: 0x8a4a1a, belly: 0xc27a3a, ears: 'none', claws: 0x8a4a1a, tail: 'spike', horns: 0x3a1a0a },
  fennec:    { name: 'Fennec Fox',   rarity: 'rare',      income: 28,    body: 'round', main: 0xf2c48a, belly: 0xffffff, ears: 'big', tail: 'bushy', snout: true },
  cactus:    { name: 'Cactus Buddy', rarity: 'epic',      income: 45,    body: 'tall',  main: 0x4aa84a, belly: 0x7ad87a, ears: 'none', spikes: 0xfff3c4, flower: 0xff5ca8 },
  d_pharaoh: { name: 'Pharaoh Cat',  rarity: 'divine',    income: 45000, body: 'round', main: 0x2a2a3a, belly: 0xffd76a, ears: 'pointy', tail: 'long', whiskers: true, crown: 0xffd23f, aura: 0xffd23f },
  d_scarab:  { name: 'Sun Scarab',   rarity: 'divine',    income: 60000, body: 'round', main: 0x1a6a8a, belly: 0xffd23f, ears: 'none', antennae: 0xffd23f, shell: 0x22c0a0, wings: 'bug', metal: true, aura: 0xffb020 },

  // ── 3. Farm ──
  chick:     { name: 'Chick',        rarity: 'common',    income: 30,    body: 'round', main: 0xffe14a, belly: 0xfff5b0, ears: 'none', beak: 0xff8a00, wings: 'small' },
  doggy:     { name: 'Doggy',        rarity: 'common',    income: 40,    body: 'round', main: 0xd9a066, belly: 0xf6e3c6, ears: 'floppy', tail: 'stub', snout: true },
  kitty:     { name: 'Kitty',        rarity: 'uncommon',  income: 50,    body: 'round', main: 0xff9f43, belly: 0xffffff, ears: 'pointy', tail: 'long', whiskers: true },
  piggy:     { name: 'Piggy',        rarity: 'rare',      income: 85,    body: 'round', main: 0xffa6c1, belly: 0xffc9d8, ears: 'floppy', snout: 'pig', tail: 'curl' },
  cow:       { name: 'Cow',          rarity: 'epic',      income: 135,   body: 'round', main: 0xffffff, belly: 0xffc9d8, ears: 'floppy', horns: 0xf2e6d0, snout: true, cowSpots: 0x222222, tail: 'long' },
  d_goose:   { name: 'Golden Goose', rarity: 'divine',    income: 80000, body: 'tall',  main: 0xffd23f, belly: 0xfff3c4, ears: 'none', beak: 0xff8a00, wings: 'feather', crown: 0xffffff, aura: 0xffd23f },
  d_holycow: { name: 'Holy Cow',     rarity: 'divine',    income: 110000, body: 'round', main: 0xfff8e8, belly: 0xffe0f0, ears: 'floppy', horns: 0xffffff, snout: true, cowSpots: 0xffc23a, tail: 'long', aura: 0xfff3a8 },

  // ── 4. Ice ──
  penguin:   { name: 'Penguin',      rarity: 'common',    income: 80,    body: 'tall',  main: 0x1e2433, belly: 0xffffff, ears: 'none', beak: 0xffa31a, wings: 'flipper' },
  seal:      { name: 'Seal',         rarity: 'uncommon',  income: 135,   body: 'round', main: 0xbfcad6, belly: 0xeef3f8, ears: 'none', whiskers: true, wings: 'flipper', tail: 'fish', snout: true },
  polar:     { name: 'Polar Bear',   rarity: 'rare',      income: 225,   body: 'round', main: 0xf2f6ff, belly: 0xffffff, ears: 'round', snout: true },
  arcticfox: { name: 'Arctic Fox',   rarity: 'epic',      income: 360,   body: 'round', main: 0xf4faff, belly: 0xffffff, ears: 'pointy', tail: 'bushy', snout: true, glow: 0x9ff3ff },
  d_aurora:  { name: 'Aurora Penguin', rarity: 'divine',  income: 150000, body: 'tall', main: 0x2a3a7a, belly: 0xe8fbff, ears: 'none', beak: 0xffd23f, wings: 'flipper', crown: 0x9ff3ff, glow: 0x7fe0ff, aura: 0x7fe0ff },
  d_yeti:    { name: 'Glacier Yeti', rarity: 'divine',    income: 200000, body: 'tall', main: 0xeaf6ff, belly: 0x9fd8ff, ears: 'none', horns: 0x7fe0ff, spikes: 0xbff0ff, snout: true, aura: 0x7fe0ff },

  // ── 5. Fire ──
  salamander:{ name: 'Salamander',   rarity: 'uncommon',  income: 200,   body: 'long',  main: 0xff4a1a, belly: 0xffb43a, ears: 'none', tail: 'spike', spots: true },
  magmapup:  { name: 'Magma Pup',    rarity: 'rare',      income: 340,   body: 'round', main: 0x3a1a14, belly: 0xff6a1a, ears: 'floppy', snout: true, flame: true, tail: 'stub', glow: 0xff4a00 },
  dragon:    { name: 'Dragon',       rarity: 'epic',      income: 560,   body: 'long',  main: 0xd8261a, belly: 0xffb43a, ears: 'none', horns: 0xfff2c4, wings: 'bat', tail: 'spike' },
  phoenix:   { name: 'Phoenix',      rarity: 'legendary', income: 900,   body: 'tall',  main: 0xff4d1a, belly: 0xffd23f, ears: 'none', beak: 0xffe14a, wings: 'feather', flame: true },
  d_inferno: { name: 'Inferno Phoenix', rarity: 'divine', income: 270000, body: 'tall', main: 0xff3a0a, belly: 0xffd23f, ears: 'none', beak: 0xffe14a, wings: 'feather', flame: true, crown: 0xffb43a, aura: 0xff6a1a },
  d_magmadragon: { name: 'Magma Dragon', rarity: 'divine', income: 360000, body: 'long', main: 0x2a0e0a, belly: 0xff6a1a, ears: 'none', horns: 0xffb43a, wings: 'bat', tail: 'spike', spikes: 0xff5a14, glow: 0xff4a00, aura: 0xff4a00 },

  // ── 6. Ocean ──
  crab:      { name: 'Crab',         rarity: 'uncommon',  income: 450,   body: 'round', main: 0xff5a3a, belly: 0xffb09a, ears: 'none', claws: 0xff5a3a, antennae: 0xff5a3a },
  dolphin:   { name: 'Dolphin',      rarity: 'rare',      income: 765,   body: 'long',  main: 0x5aa8e0, belly: 0xe8f4ff, ears: 'none', fins: 0x5aa8e0, snout: true, tail: 'fish' },
  octopus:   { name: 'Octopus',      rarity: 'epic',      income: 1260,  body: 'round', main: 0xb05ae0, belly: 0xe0a8ff, ears: 'none', tentacles: 0xb05ae0, bigEyes: true },
  shark:     { name: 'Shark',        rarity: 'legendary', income: 2000,  body: 'long',  main: 0x7a8ea8, belly: 0xffffff, ears: 'none', fins: 0x7a8ea8, jaw: true, tail: 'fish' },
  d_narwhal: { name: 'Pearl Narwhal', rarity: 'divine',   income: 480000, body: 'long', main: 0xe8f8ff, belly: 0xffffff, ears: 'none', horn: 0xfff3c4, fins: 0xbff0ff, tail: 'fish', aura: 0x5ff8ff },
  d_kraken:  { name: 'Kraken King',  rarity: 'divine',    income: 650000, body: 'round', main: 0x1a3a8a, belly: 0x5ad8ff, ears: 'none', tentacles: 0x1a3a8a, crown: 0xffd23f, bigEyes: true, aura: 0x3fc8f0 },

  // ── 7. Dino Land ──
  trike:     { name: 'Triceratops',  rarity: 'rare',      income: 1000,  body: 'long',  main: 0x6aa84a, belly: 0xd8e8a8, ears: 'none', horns: 0xfff3d0, horn: 0xfff3d0, tail: 'spike', snout: true },
  stego:     { name: 'Stegosaurus',  rarity: 'epic',      income: 1700,  body: 'long',  main: 0x5a8a3a, belly: 0xc8d88a, ears: 'none', spikes: 0xff8a3a, tail: 'spike' },
  raptor:    { name: 'Raptor',       rarity: 'epic',      income: 2800,  body: 'tall',  main: 0x3a8a6a, belly: 0xd8f0c8, ears: 'none', jaw: true, claws: 0xf2e6d0, tail: 'long', spots: true },
  trex:      { name: 'T-Rex',        rarity: 'legendary', income: 4500,  body: 'tall',  main: 0x4a7a2a, belly: 0xc8d88a, ears: 'none', jaw: true, tail: 'spike' },
  d_primal:  { name: 'Primal T-Rex', rarity: 'divine',    income: 850000, body: 'tall', main: 0x8a1a1a, belly: 0xffb43a, ears: 'none', jaw: true, spikes: 0xffd23f, tail: 'spike', aura: 0xffa53a },
  d_ptera:   { name: 'Amber Pterodactyl', rarity: 'divine', income: 1100000, body: 'long', main: 0xff9a2a, belly: 0xffe0a0, ears: 'none', wings: 'bat', beak: 0xffd23f, horns: 0xffe0a0, aura: 0xffc040 },

  // ── 8. Cosmic Rift ──
  starkitty: { name: 'Star Kitty',   rarity: 'rare',      income: 2200,  body: 'round', main: 0x6a4aff, belly: 0xd8ccff, ears: 'pointy', tail: 'long', whiskers: true, stars: 0xffffff },
  nebjelly:  { name: 'Nebula Jelly', rarity: 'epic',      income: 3700,  body: 'round', main: 0xff7ae0, belly: 0xffd0f5, ears: 'none', tentacles: 0xff7ae0, glow: 0xff5cf0 },
  cometfox:  { name: 'Comet Fox',    rarity: 'epic',      income: 6200,  body: 'round', main: 0x5cc8ff, belly: 0xffffff, ears: 'pointy', tail: 'bushy', snout: true, flame: true, glow: 0x5cc8ff },
  unicorn:   { name: 'Unicorn',      rarity: 'legendary', income: 10000, body: 'round', main: 0xfff5ff, belly: 0xffe0f7, ears: 'pointy', horn: 0xffd23f, mane: true },
  d_galaxyunicorn: { name: 'Galaxy Unicorn', rarity: 'divine', income: 1500000, body: 'round', main: 0x2a1a5a, belly: 0xa98bff, ears: 'pointy', horn: 0xfff4b0, mane: true, stars: 0xffffff, aura: 0xa98bff },
  d_voiddragon: { name: 'Void Dragon', rarity: 'divine',  income: 2000000, body: 'long', main: 0x14082a, belly: 0xff5cf0, ears: 'none', horns: 0xa98bff, wings: 'bat', tail: 'spike', stars: 0xff5cf0, aura: 0xff5cf0 },

  // ── 9. To the Future ──
  robopup:   { name: 'Robo Pup',     rarity: 'epic',      income: 4800,  body: 'round', main: 0xc6ced6, belly: 0x6fb7ff, ears: 'pointy', metal: true, visor: 0x18f0ff, antennae: 0x18f0ff, tail: 'stub' },
  droneowl:  { name: 'Drone Owl',    rarity: 'epic',      income: 8200,  body: 'tall',  main: 0x5d6670, belly: 0x9aa4ad, ears: 'tufts', metal: true, bigEyes: true, beak: 0x18f0ff, wings: 'small', glow: 0x18f0ff },
  mechacat:  { name: 'Mecha Cat',    rarity: 'legendary', income: 13400, body: 'round', main: 0x1a1a2a, belly: 0xff3dcf, ears: 'pointy', metal: true, tail: 'long', visor: 0xff3dcf },
  cyberdragon: { name: 'Cyber Dragon', rarity: 'legendary', income: 21600, body: 'long', main: 0x0b1424, belly: 0x18f0ff, ears: 'none', metal: true, horns: 0x18f0ff, wings: 'bat', tail: 'spike', glow: 0x18f0ff },
  d_quantumcat: { name: 'Quantum Mech-Cat', rarity: 'divine', income: 2600000, body: 'round', main: 0xe8f0ff, belly: 0x66ffe0, ears: 'pointy', metal: true, visor: 0x66ffe0, antennae: 0x66ffe0, tail: 'long', aura: 0x66ffe0 },
  d_chronodragon: { name: 'Chrono Dragon', rarity: 'divine', income: 3300000, body: 'long', main: 0x2a2a3a, belly: 0xffd23f, ears: 'none', metal: true, horns: 0xffd23f, wings: 'bat', tail: 'spike', visor: 0xffd23f, aura: 0x18f0ff },

  // ── 10. Alien Planet ──
  blob:      { name: 'Blobby',       rarity: 'epic',      income: 10000, body: 'round', main: 0x9dff3a, belly: 0xd8ff9a, ears: 'none', eyes3: true, antennae: 0xff5cf0 },
  zorp:      { name: 'Zorp',         rarity: 'epic',      income: 17000, body: 'tall',  main: 0x6a1aa0, belly: 0xd08aff, ears: 'none', eyes3: true, antennae: 0x9dff3a, tail: 'long' },
  saucersquid: { name: 'Saucer Squid', rarity: 'legendary', income: 28000, body: 'round', main: 0x3affc8, belly: 0xbfffe8, ears: 'none', tentacles: 0x3affc8, eyes3: true },
  xenodragon:{ name: 'Xeno Dragon',  rarity: 'legendary', income: 45000, body: 'long',  main: 0x2a0a3a, belly: 0x9dff3a, ears: 'none', horns: 0x9dff3a, wings: 'bat', spikes: 0x9dff3a, eyes3: true, tail: 'spike' },
  d_overlord:{ name: 'Xeno Overlord', rarity: 'divine',   income: 4000000, body: 'tall', main: 0x9dff3a, belly: 0xe8ffd0, ears: 'none', eyes3: true, bigEyes: true, antennae: 0xff5cf0, crown: 0xffd23f, aura: 0x9dff3a },
  d_stareater: { name: 'Star-Eater Squid', rarity: 'divine', income: 5000000, body: 'round', main: 0x2a0a4a, belly: 0xff5cf0, ears: 'none', tentacles: 0x2a0a4a, eyes3: true, stars: 0xffffff, crown: 0x9dff3a, aura: 0xff5cf0 },
};

// ── The 10 lands of the Egg Lane ─────────────────────────────────
// One long runway heading north (negative z). Every land further out has better eggs and faster Guardians.
// `needWalk` is the walk speed that lets you outrun the Guardians while carrying an egg.
// Every land also has one permanent DIVINE egg on a golden pedestal at its far end.
const LAND_DEFS = [
  { id: 'forest', name: 'Forest',        emoji: '🌲', len: 50,  eggs: 6, guards: 1, guardSpeed: 9,   needWalk: 12,  hatch: 8,   respawn: 6,
    color: 0x6fd04a, spot: 0x2e6b2a, pattern: 'leaves',  floor: 0x5f8f3a, wall: 0x5a3a22, trim: 0x9dff6a, divColor: 0xc8ffb0,
    pool: { squirrel: 45, bunny: 30, fox: 18, owl: 7 }, divinePool: { d_treant: 65, d_stag: 35 } },
  { id: 'desert', name: 'Desert',        emoji: '🏜️', len: 56,  eggs: 6, guards: 1, guardSpeed: 16,  needWalk: 20,  hatch: 14,  respawn: 7,
    color: 0xf2c46b, spot: 0xc26a2a, pattern: 'zigzag',  floor: 0xe6c88a, wall: 0xc9a066, trim: 0xffcf4a, divColor: 0xfff0b0,
    pool: { camel: 45, scorpion: 30, fennec: 18, cactus: 7 }, divinePool: { d_pharaoh: 65, d_scarab: 35 } },
  { id: 'farm',   name: 'Farm',          emoji: '🚜', len: 64,  eggs: 6, guards: 2, guardSpeed: 24,  needWalk: 30,  hatch: 22,  respawn: 8,
    color: 0xf6efe0, spot: 0xc79a5b, pattern: 'spots',   floor: 0xd9c48a, wall: 0x9a6a3a, trim: 0xe8d6b0, divColor: 0xfff6d0,
    pool: { chick: 30, doggy: 25, kitty: 22, piggy: 15, cow: 8 }, divinePool: { d_goose: 65, d_holycow: 35 } },
  { id: 'ice',    name: 'Ice',           emoji: '❄️', len: 74,  eggs: 7, guards: 2, guardSpeed: 35,  needWalk: 44,  hatch: 32,  respawn: 9,
    color: 0xbff0ff, spot: 0x3f9ae0, pattern: 'crystals', floor: 0xd6eeff, wall: 0xeaf6ff, trim: 0x7fe0ff, divColor: 0xe8fbff,
    pool: { penguin: 45, seal: 30, polar: 18, arcticfox: 7 }, divinePool: { d_aurora: 65, d_yeti: 35 } },
  { id: 'fire',   name: 'Fire',          emoji: '🔥', len: 86,  eggs: 7, guards: 2, guardSpeed: 50,  needWalk: 62,  hatch: 45,  respawn: 10,
    color: 0xff6a3d, spot: 0x7a1200, pattern: 'flames',  floor: 0x4a2218, wall: 0x2a1412, trim: 0xff5a14, divColor: 0xffc48a,
    pool: { salamander: 45, magmapup: 30, dragon: 18, phoenix: 7 }, divinePool: { d_inferno: 65, d_magmadragon: 35 } },
  { id: 'ocean',  name: 'Ocean',         emoji: '🌊', len: 100, eggs: 8, guards: 3, guardSpeed: 68,  needWalk: 85,  hatch: 60,  respawn: 11,
    color: 0x3fc8f0, spot: 0x0a5a9a, pattern: 'waves',   floor: 0x2f8fb8, wall: 0xff8a70, trim: 0x5ff8ff, divColor: 0xd0fbff,
    pool: { crab: 45, dolphin: 30, octopus: 18, shark: 7 }, divinePool: { d_narwhal: 65, d_kraken: 35 } },
  { id: 'dino',   name: 'Dino Land',     emoji: '🦖', len: 116, eggs: 8, guards: 3, guardSpeed: 92,  needWalk: 115, hatch: 75,  respawn: 12,
    color: 0x9ad04a, spot: 0x4a6a1a, pattern: 'scales',  floor: 0x8a6a3a, wall: 0x6a5a48, trim: 0xffa53a, divColor: 0xffe0a0,
    pool: { trike: 45, stego: 30, raptor: 18, trex: 7 }, divinePool: { d_primal: 65, d_ptera: 35 } },
  { id: 'cosmic', name: 'Cosmic Rift',   emoji: '🌌', len: 134, eggs: 8, guards: 3, guardSpeed: 124, needWalk: 155, hatch: 90,  respawn: 13, dark: true,
    color: 0xa98bff, spot: 0x2b1a6a, pattern: 'stars',   floor: 0x120c2a, wall: 0x0c0820, trim: 0xa98bff, divColor: 0xe8dcff,
    pool: { starkitty: 45, nebjelly: 30, cometfox: 18, unicorn: 7 }, divinePool: { d_galaxyunicorn: 65, d_voiddragon: 35 } },
  { id: 'future', name: 'To the Future', emoji: '🤖', len: 154, eggs: 8, guards: 4, guardSpeed: 164, needWalk: 205, hatch: 110, respawn: 14, dark: true,
    color: 0x5af0ff, spot: 0x0a2a4a, pattern: 'circuit', floor: 0x161c2c, wall: 0x101828, trim: 0x18f0ff, divColor: 0xd0fff8,
    pool: { robopup: 45, droneowl: 30, mechacat: 18, cyberdragon: 7 }, divinePool: { d_quantumcat: 65, d_chronodragon: 35 } },
  { id: 'alien',  name: 'Alien Planet',  emoji: '👽', len: 176, eggs: 8, guards: 4, guardSpeed: 216, needWalk: 270, hatch: 130, respawn: 15, dark: true,
    color: 0x9dff3a, spot: 0x6a1aa0, pattern: 'alien',   floor: 0x22142e, wall: 0x2e1440, trim: 0x9dff3a, divColor: 0xe0ffc0,
    pool: { blob: 45, zorp: 30, saucersquid: 18, xenodragon: 7 }, divinePool: { d_overlord: 65, d_stareater: 35 } },
];

const LANE_START = -30, ZONE_GAP = 14;
export const ZONES = [];
{
  let z = LANE_START - 6;
  LAND_DEFS.forEach((d, i) => {
    ZONES.push({ ...d, index: i, z0: z, z1: z - d.len, divineHatch: 60 + i * 10, divineRespawn: 90 + i * 10 });
    z -= d.len + ZONE_GAP;
  });
}
export const LANE = { halfW: 16, start: LANE_START, end: ZONES[ZONES.length - 1].z1 - ZONE_GAP };

// Each land's permanent Divine egg: themed colours, always hatches one of that land's Divine pets.
export const DIVINE_EGGS = ZONES.map((z) => ({
  id: 'divine_' + z.id, land: z.id, divine: true, name: `${z.name} Divine`,
  color: z.divColor, spot: 0xffc83a, glow: z.trim, pattern: z.pattern,
  hatch: z.divineHatch, respawn: z.divineRespawn, pool: z.divinePool,
}));

// tag every pet with the land it comes from
for (const z of ZONES) for (const s of [...Object.keys(z.pool), ...Object.keys(z.divinePool)]) PETS[s].land = z.id;

export function eggDef(id) { return ZONES.find((z) => z.id === id) || DIVINE_EGGS.find((d) => d.id === id); }
export function eggName(id) { const d = eggDef(id); return d ? `${d.name} Egg` : 'Egg'; }
export function divineEggFor(landId) { return DIVINE_EGGS.find((d) => d.land === landId); }
export function petIncome(species, huge) { return (PETS[species]?.income || 0) * (huge ? HUGE_INCOME_MULT : 1); }

// ── D Coins, shop, codes ─────────────────────────────────────────
export const DCOIN_REWARD = { every: 180, amount: 10 }; // 10 D Coins for every 3 minutes played
export const SLOW_MODE_SPEED = 10;                     // studs per second while SLOW MODE is on

// Codes are compared case-insensitively and ignoring spaces. Each can be redeemed once per player.
export const CODES = {
  DILL67: { label: 'DILL67', dcoins: 999999 },
  FREEDCOINS: { label: 'FREE D COINS', dcoins: 500 },
};
export function normalizeCode(s) { return String(s || '').toUpperCase().replace(/\s+/g, ''); }

// kind: 'egg' (Divine egg onto a free base pad) | 'boost' (timed, stacks duration) | 'perk' (permanent, once)
//       | 'speed' (instant Speed) | 'cash' (instant cash = N seconds of pet income) | 'hatch' (finish incubating eggs) | 'trail'
export const SHOP_SECTIONS = [
  { id: 'eggs',   title: '✦ Divine Eggs', blurb: 'Hatches straight onto a free base pad. The further the land, the stronger the pet!' },
  { id: 'boosts', title: '⚡ Boosts',      blurb: 'Timed power-ups. Buying again adds more time.' },
  { id: 'perks',  title: '💎 Upgrades',    blurb: 'Permanent upgrades, yours forever.' },
  { id: 'packs',  title: '🎁 Instant Packs', blurb: 'Instant rewards, use any time.' },
  { id: 'trails', title: '🌈 Exclusive Trails', blurb: 'Only sold for D Coins. Equip from the Trails menu.' },
];

export const SHOP_ITEMS = [
  ...DIVINE_EGGS.map((d, i) => {
    const z = ZONES[i];
    const lo = Math.min(...Object.keys(d.pool).map((s) => PETS[s].income)), hi = Math.max(...Object.keys(d.pool).map((s) => PETS[s].income));
    return { id: 'egg_' + z.id, section: 'eggs', kind: 'egg', egg: d.id, name: `${z.emoji} ${z.name} Divine Egg`, price: 250 + i * 50,
      desc: `Hatches ${/^[AEIOU]/.test(z.name) ? 'an' : 'a'} ${z.name} Divine pet worth $${formatNum(lo)}–$${formatNum(hi)}/s`, color: z.trim };
  }),
  { id: 'b_train2',  section: 'boosts', kind: 'boost', boost: 'train2',  secs: 600, icon: '👟', name: 'Turbo Sneakers', price: 200, desc: '2× treadmill Speed for 10 min' },
  { id: 'b_cash2',   section: 'boosts', kind: 'boost', boost: 'cash2',   secs: 600, icon: '🧲', name: 'Money Magnet',   price: 300, desc: '2× pet cash for 10 min' },
  { id: 'b_sleep',   section: 'boosts', kind: 'boost', boost: 'sleep',   secs: 600, icon: '😴', name: 'Sleepy Dust',    price: 350, desc: 'Guardians take 3s longer to wake up for 10 min' },
  { id: 'b_luck',    section: 'boosts', kind: 'boost', boost: 'luck',    secs: 600, icon: '🍀', name: 'Lucky Clover',   price: 400, desc: 'HUGE eggs go from 1 in 10 to 1 in 3 for 10 min' },
  { id: 'b_goo',     section: 'boosts', kind: 'boost', boost: 'goo',     secs: 300, icon: '🫧', name: 'Sticky Goo',     price: 450, desc: 'Guardians run 25% slower for 5 min' },
  { id: 'b_cash3',   section: 'boosts', kind: 'boost', boost: 'cash3',   secs: 600, icon: '💰', name: 'Diamond Vault',  price: 600, desc: '3× pet cash for 10 min (stacks with Money Magnet!)' },
  { id: 'p_carry',   section: 'perks',  kind: 'perk',  perk: 'carry',     icon: '🎒', name: 'Feather Backpack', price: 450, desc: 'Carrying eggs never slows you down' },
  { id: 'p_train',   section: 'perks',  kind: 'perk',  perk: 'train',     icon: '🛢️', name: 'Pro Treadmill Oil', price: 500, desc: '+50% treadmill Speed forever' },
  { id: 'p_income',  section: 'perks',  kind: 'perk',  perk: 'income',    icon: '🥣', name: 'Golden Food Bowl', price: 650, desc: '+50% pet income forever' },
  { id: 'p_compass', section: 'perks',  kind: 'perk',  perk: 'compass',   icon: '🧭', name: 'Divine Compass',   price: 700, desc: 'Divine eggs respawn twice as fast' },
  { id: 'k_hatch',   section: 'packs',  kind: 'hatch',                    icon: '⏩', name: 'Hatch-o-Matic',    price: 250, desc: 'Every incubating egg hatches right now' },
  { id: 'k_speed',   section: 'packs',  kind: 'speed', amount: 25000,     icon: '⚡', name: 'Speed Crate',      price: 300, desc: '+25K Speed instantly' },
  { id: 'k_cash',    section: 'packs',  kind: 'cash',  secs: 900, min: 10000, icon: '💵', name: 'Cash Bag',     price: 350, desc: '15 minutes of pet income right now (at least $10K)' },
  { id: 'k_speed2',  section: 'packs',  kind: 'speed', amount: 150000,    icon: '🌩️', name: 'Mega Speed Crate', price: 550, desc: '+150K Speed instantly' },
  { id: 't_comet',   section: 'trails', kind: 'trail', trail: 'comet',    name: 'Golden Comet', price: 400, desc: 'Training ×12' },
  { id: 't_divine',  section: 'trails', kind: 'trail', trail: 'divine',   name: 'Divine Aura',  price: 700, desc: 'Training ×20, the best trail in the game' },
];

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
  if (u > 0 && n >= 999.5 && u < units.length - 1) { n /= 1000; u++; } // 999,999 → 1M, not 1000K
  const s = u === 0 ? (n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString())
                    : (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  return (neg ? '-' : '') + s + units[u];
}
