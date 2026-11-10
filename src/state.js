import { TREADMILLS, TRAILS, PETS, RARITY, PLAYER } from './config.js';

const SAVE_KEY = 'eggdash-save-v1';

function defaults() {
  return {
    version: 1,
    cash: 0,
    speed: 0,
    totalEarned: 0,
    eggsStolen: 0,
    hugeStolen: 0,
    timesCaught: 0,
    hatched: 0,
    treadmills: TREADMILLS.map((t) => t.cost === 0),
    trails: ['none'],
    trail: 'none',
    pets: [],        // { uid, species }
    equipped: [],    // uids
    nextUid: 1,
    settings: { quality: 'auto', music: 0.5, sfx: 0.8, showFps: false },
    tutorialDone: false,
  };
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
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const d = defaults();
      // shallow merge with validation so old/corrupt saves never break the game
      for (const k of Object.keys(d)) {
        if (parsed[k] !== undefined && typeof parsed[k] === typeof d[k]) d[k] = parsed[k];
      }
      d.settings = { ...defaults().settings, ...(parsed.settings || {}) };
      if (!Array.isArray(d.treadmills) || d.treadmills.length !== TREADMILLS.length) d.treadmills = defaults().treadmills;
      d.treadmills[0] = true;
      d.pets = (d.pets || []).filter((p) => p && PETS[p.species]);
      d.equipped = (d.equipped || []).filter((uid) => d.pets.some((p) => p.uid === uid)).slice(0, PLAYER.maxEquippedPets);
      d.trails = d.trails.filter((t) => TRAILS.some((x) => x.id === t));
      if (!d.trails.includes('none')) d.trails.unshift('none');
      if (!d.trails.includes(d.trail)) d.trail = 'none';
      if (!isFinite(d.cash) || d.cash < 0) d.cash = 0;
      if (!isFinite(d.speed) || d.speed < 0) d.speed = 0;
      this.data = d;
    } catch (e) {
      console.warn('Save load failed, starting fresh', e);
    }
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

  // ── multipliers ──
  petMultiplier() {
    let m = 1;
    for (const uid of this.data.equipped) {
      const p = this.data.pets.find((x) => x.uid === uid);
      if (p) m += RARITY[PETS[p.species].rarity].power - 1;
    }
    return m;
  }
  trailMultiplier() { return (TRAILS.find((t) => t.id === this.data.trail) || TRAILS[0]).mult; }
  trainingMultiplier() { return this.petMultiplier() * this.trailMultiplier(); }

  // ── pets ──
  addPet(species) {
    const pet = { uid: this.data.nextUid++, species };
    this.data.pets.push(pet);
    this.data.hatched++;
    // auto-equip if there is a free slot or it beats the weakest equipped pet
    const power = (p) => RARITY[PETS[p.species].rarity].power;
    if (this.data.equipped.length < PLAYER.maxEquippedPets) this.data.equipped.push(pet.uid);
    else {
      const eq = this.data.equipped.map((u) => this.data.pets.find((p) => p.uid === u));
      eq.sort((a, b) => power(a) - power(b));
      if (power(pet) > power(eq[0])) {
        this.data.equipped = this.data.equipped.filter((u) => u !== eq[0].uid);
        this.data.equipped.push(pet.uid);
      }
    }
    this.emit('pets'); this.save();
    return pet;
  }
  toggleEquip(uid) {
    const eq = this.data.equipped;
    if (eq.includes(uid)) this.data.equipped = eq.filter((u) => u !== uid);
    else if (eq.length < PLAYER.maxEquippedPets) eq.push(uid);
    else return false;
    this.emit('pets'); this.save(); return true;
  }
  equipBest() {
    const power = (p) => RARITY[PETS[p.species].rarity].power;
    const sorted = [...this.data.pets].sort((a, b) => power(b) - power(a));
    this.data.equipped = sorted.slice(0, PLAYER.maxEquippedPets).map((p) => p.uid);
    this.emit('pets'); this.save();
  }
  deletePet(uid) {
    this.data.pets = this.data.pets.filter((p) => p.uid !== uid);
    this.data.equipped = this.data.equipped.filter((u) => u !== uid);
    this.emit('pets'); this.save();
  }
}

export const state = new GameState();
