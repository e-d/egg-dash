import { TREADMILLS, TRAILS, PETS, RARITY, PLOT_COUNT, ZONES, DIVINE_EGG, SELL_SECONDS, petIncome } from './config.js';

const SAVE_KEY = 'eggdash-save-v2';
const OLD_SAVE_KEY = 'eggdash-save-v1';
const EGG_IDS = new Set([...ZONES.map((z) => z.id), DIVINE_EGG.id]);

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
  };
}

const num = (v, min = 0) => (typeof v === 'number' && isFinite(v) && v >= min ? v : min);

function validPlot(p) {
  if (!p || typeof p !== 'object' || !PETS[p.species] || !EGG_IDS.has(p.egg)) return null;
  const hatchTotal = Math.max(1, num(p.hatchTotal, 1));
  return { egg: p.egg, species: p.species, huge: p.huge === true, hatchTotal, hatchLeft: Math.min(hatchTotal, num(p.hatchLeft)) };
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
    for (const k of ['cash', 'speed', 'totalEarned', 'eggsStolen', 'hugeStolen', 'divineStolen', 'timesCaught', 'hatched']) d[k] = num(d[k]);
    d.version = 2;
    return d;
  }

  /** v1 saves (shop-bought pets that followed you) → v2: keep progress, move the best pets onto base plots. */
  migrateV1(old) {
    const d = this.sanitize({ ...old, plots: [] });
    const pets = Array.isArray(old?.pets) ? old.pets.filter((p) => p && PETS[p.species]) : [];
    pets.sort((a, b) => PETS[b.species].income - PETS[a.species].income);
    pets.slice(0, PLOT_COUNT).forEach((p, i) => {
      const egg = RARITY[PETS[p.species].rarity].order === 5 ? 'divine' : 'coop';
      d.plots[i] = { egg, species: p.species, huge: false, hatchLeft: 0, hatchTotal: 1 };
    });
    return d;
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ }
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
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

  // ── multipliers ── (only trails boost training now)
  trailMultiplier() { return (TRAILS.find((t) => t.id === this.data.trail) || TRAILS[0]).mult; }
  trainingMultiplier() { return this.trailMultiplier(); }

  // ── base plots ──
  plotIncome(p) { return p && p.hatchLeft <= 0 ? petIncome(p.species, p.huge) : 0; }
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
