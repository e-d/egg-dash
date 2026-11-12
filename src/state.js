import { TREADMILLS, TRAILS, PETS, RARITY, PLOT_COUNT, ZONES, DIVINE_EGGS, SELL_SECONDS, CODES, petIncome, normalizeCode, divineEggFor } from './config.js';

const SAVE_KEY = 'eggdash-save-v2';
const OLD_SAVE_KEY = 'eggdash-save-v1';
const EGG_IDS = new Set([...ZONES.map((z) => z.id), ...DIVINE_EGGS.map((d) => d.id)]);
const BOOST_IDS = ['train2', 'cash2', 'cash3', 'luck', 'sleep', 'goo'];
const PERK_IDS = ['carry', 'train', 'income', 'compass'];

// saves from before the 10 lands: map retired pets / zones onto their new themed homes
const SPECIES_MIGRATE = { mouse: 'squirrel', panda: 'polar', deer: 'arcticfox', d_dragon: 'd_magmadragon', d_unicorn: 'd_galaxyunicorn', d_phoenix: 'd_inferno', d_kitty: 'd_pharaoh' };
const EGG_MIGRATE = { coop: 'farm', crystal: 'ice', gold: 'desert', lava: 'fire', neon: 'future' };

function defaults() {
  return {
    version: 2,
    cash: 0,
    speed: 0,
    totalEarned: 0,
    eggsStolen: 0,
    hugeStolen: 0,
    divineStolen: 0,
    timesCaught: 0,
    hatched: 0,
    treadmills: TREADMILLS.map((t) => t.cost === 0),
    trails: ['none'],
    trail: 'none',
    // base plots: null | { egg, species, huge, hatchLeft, hatchTotal }
    // hatchLeft > 0 means the egg is still incubating; 0 means a hatched pet earning cash
    plots: Array(PLOT_COUNT).fill(null),
    settings: { quality: 'auto', music: 0.5, sfx: 0.8, showFps: false },
    tutorialDone: false,
    // D Coins: earned over time (10 every 3 min played) or from codes, spent in the SHOP
    dcoins: 0,
    dcoinTimer: 0,          // seconds played toward the next time reward
    redeemedCodes: [],      // canonical code ids already used by this player
    boosts: {},             // boost id -> seconds left
    perks: {},              // perk id -> true
    shopBought: 0,
  };
}

const num = (v, min = 0) => (typeof v === 'number' && isFinite(v) && v >= min ? v : min);

function validPlot(p) {
  if (!p || typeof p !== 'object') return null;
  const species = SPECIES_MIGRATE[p.species] || p.species;
  if (!PETS[species]) return null;
  const divine = PETS[species].rarity === 'divine';
  let egg = EGG_MIGRATE[p.egg] || p.egg;
  if (egg === 'divine' || (divine && !String(egg).startsWith('divine_'))) egg = divineEggFor(PETS[species].land).id;
  if (!EGG_IDS.has(egg)) egg = PETS[species].land;
  const hatchTotal = Math.max(1, num(p.hatchTotal, 1));
  return { egg, species, huge: p.huge === true && !divine, hatchTotal, hatchLeft: Math.min(hatchTotal, num(p.hatchLeft)) };
}

/** Central mutable game state with change listeners. */
class GameState {
  constructor() {
    this.data = defaults();
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = this.sanitize(JSON.parse(raw));
      else {
        const old = localStorage.getItem(OLD_SAVE_KEY);
        if (old) { this.data = this.migrateV1(JSON.parse(old)); this.save(); }
      }
    } catch (e) {
      console.warn('Save load failed, starting fresh', e);
      this.data = defaults();
    }
  }

  /** Copy only known keys of the right type, so old/corrupt/tampered saves never break the game. */
  sanitize(parsed) {
    const d = defaults();
    if (!parsed || typeof parsed !== 'object') return d;
    for (const k of Object.keys(d)) {
      if (parsed[k] !== undefined && typeof parsed[k] === typeof d[k] && Array.isArray(parsed[k]) === Array.isArray(d[k])) d[k] = parsed[k];
    }
    d.settings = { ...defaults().settings, ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}) };
    if (d.treadmills.length !== TREADMILLS.length) d.treadmills = defaults().treadmills;
    d.treadmills = d.treadmills.map((v) => v === true);
    d.treadmills[0] = true;
    d.trails = d.trails.filter((t) => TRAILS.some((x) => x.id === t));
    if (!d.trails.includes('none')) d.trails.unshift('none');
    if (!d.trails.includes(d.trail)) d.trail = 'none';
    const plots = Array(PLOT_COUNT).fill(null);
    for (let i = 0; i < PLOT_COUNT; i++) plots[i] = validPlot(d.plots[i]);
    d.plots = plots;
    for (const k of ['cash', 'speed', 'totalEarned', 'eggsStolen', 'hugeStolen', 'divineStolen', 'timesCaught', 'hatched', 'dcoins', 'dcoinTimer', 'shopBought']) d[k] = num(d[k]);
    d.dcoins = Math.floor(d.dcoins);
    d.redeemedCodes = d.redeemedCodes.filter((c) => typeof c === 'string' && CODES[c]);
    const boosts = {}, perks = {};
    for (const b of BOOST_IDS) if (num(d.boosts?.[b]) > 0) boosts[b] = num(d.boosts[b]);
    for (const k of PERK_IDS) if (d.perks?.[k] === true) perks[k] = true;
    d.boosts = boosts; d.perks = perks;
    d.version = 3;
    return d;
  }

  /** v1 saves (shop-bought pets that followed you) → v2: keep progress, move the best pets onto base plots. */
  migrateV1(old) {
    const d = this.sanitize({ ...old, plots: [] });
    const pets = Array.isArray(old?.pets) ? old.pets.filter((p) => p && PETS[SPECIES_MIGRATE[p.species] || p.species]) : [];
    for (const p of pets) p.species = SPECIES_MIGRATE[p.species] || p.species;
    pets.sort((a, b) => PETS[b.species].income - PETS[a.species].income);
    pets.slice(0, PLOT_COUNT).forEach((p, i) => {
      d.plots[i] = validPlot({ egg: RARITY[PETS[p.species].rarity].order === 5 ? 'divine' : 'coop', species: p.species, huge: false, hatchLeft: 0, hatchTotal: 1 });
    });
    return d;
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }

  /** Reset progress. Settings, D Coins and used codes are kept, so codes can never be redeemed twice. */
  reset() {
    const { settings, dcoins, redeemedCodes } = this.data;
    this.data = defaults();
    Object.assign(this.data, { settings, dcoins, redeemedCodes });
    this.save();
    this.emit('reset');
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what) { for (const fn of this.listeners) fn(what); }

  // ── economy ──
  addCash(n) { this.data.cash += n; if (n > 0) this.data.totalEarned += n; this.emit('cash'); }
  canAfford(n) { return this.data.cash >= n; }
  spend(n) {
    if (this.data.cash < n) return false;
    this.data.cash -= n; this.emit('cash'); this.save(); return true;
  }
  addSpeed(n) { this.data.speed += n; this.emit('speed'); }

  // ── D Coins ──
  addDcoins(n) { this.data.dcoins = Math.floor(this.data.dcoins + n); this.emit('dcoins'); this.save(); }
  spendDcoins(n) {
    if (this.data.dcoins < n) return false;
    this.data.dcoins -= n; this.data.shopBought++; this.emit('dcoins'); this.save(); return true;
  }
  /** Returns { ok, msg, amount }. Each code works once per player, no matter how it's typed. */
  redeemCode(input) {
    const id = normalizeCode(input);
    if (!id) return { ok: false, msg: 'Type a code first!' };
    const code = CODES[id];
    if (!code) return { ok: false, msg: `"${String(input).trim().slice(0, 24)}" isn't a valid code.` };
    if (this.data.redeemedCodes.includes(id)) return { ok: false, msg: `You already redeemed ${code.label}. Each code works once!` };
    this.data.redeemedCodes.push(id);
    this.addDcoins(code.dcoins);
    return { ok: true, amount: code.dcoins, msg: `Redeemed ${code.label}!` };
  }

  // ── boosts & perks ──
  boostLeft(id) { return this.data.boosts[id] || 0; }
  boost(id) { return this.boostLeft(id) > 0; }
  addBoost(id, secs) { this.data.boosts[id] = this.boostLeft(id) + secs; this.emit('boosts'); this.save(); }
  tickBoosts(dt) {
    let ended = null;
    for (const [id, left] of Object.entries(this.data.boosts)) {
      const v = left - dt;
      if (v <= 0) { delete this.data.boosts[id]; ended = ended || []; ended.push(id); } else this.data.boosts[id] = v;
    }
    if (ended) this.emit('boosts');
    return ended;
  }
  perk(id) { return this.data.perks[id] === true; }
  addPerk(id) { this.data.perks[id] = true; this.emit('perks'); this.save(); }

  // ── multipliers ──
  trailMultiplier() { return (TRAILS.find((t) => t.id === this.data.trail) || TRAILS[0]).mult; }
  trainingMultiplier() { return this.trailMultiplier() * (this.boost('train2') ? 2 : 1) * (this.perk('train') ? 1.5 : 1); }
  incomeMultiplier() { return (this.boost('cash2') ? 2 : 1) * (this.boost('cash3') ? 3 : 1) * (this.perk('income') ? 1.5 : 1); }

  // ── base plots ──
  plotIncome(p) { return p && p.hatchLeft <= 0 ? petIncome(p.species, p.huge) * this.incomeMultiplier() : 0; }
  incomePerSec() { return this.data.plots.reduce((a, p) => a + this.plotIncome(p), 0); }
  sellValue(p) { return Math.round(petIncome(p.species, p.huge) * SELL_SECONDS); }
  freePlot() { return this.data.plots.findIndex((p) => !p); }

  placeEgg(index, egg) {
    this.data.plots[index] = egg;
    this.emit('plots'); this.save();
  }
  sellPlot(index) {
    const p = this.data.plots[index];
    if (!p) return 0;
    const value = p.hatchLeft > 0 ? 0 : this.sellValue(p);
    this.data.plots[index] = null;
    if (value) this.addCash(value);
    this.emit('plots'); this.save();
    return value;
  }
}

export const state = new GameState();
