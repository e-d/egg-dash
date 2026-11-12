import './styles.css';
import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { Particles } from './fx/particles.js';
import { Sky } from './world/sky.js';
import { DayNight } from './world/daynight.js';
import { Colliders } from './world/colliders.js';
import { buildWorld } from './world/world.js';
import { Treadmills } from './world/treadmills.js';
import { Lane } from './world/lane.js';
import { Base } from './world/base.js';
import { Hub } from './world/hub.js';
import { Player } from './entities/player.js';
import { TrailEmitter } from './entities/trails.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Preview } from './ui/preview.js';
import { state } from './state.js';
import { Events, damp } from './util.js';
import { TREADMILLS, TRAILS, PETS, RARITY, WORLD, HUGE_HATCH_MULT, SHOP_ITEMS, DCOIN_REWARD, SLOW_MODE_SPEED, walkSpeedFor, petIncome, formatNum, eggDef, eggName } from './config.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

function pickWeighted(pool) {
  const entries = Object.entries(pool);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[entries.length - 1][0];
}

class Game {
  constructor() {
    this.events = new Events();
    this.renderer = new Renderer(document.getElementById('app'));
    this.scene = this.renderer.scene;
    this.input = new Input(this.renderer.renderer.domElement);
    this.colliders = new Colliders();
    this.particles = new Particles(this.scene);
    this.sky = new Sky(this.scene);
    this.daynight = new DayNight({ scene: this.scene, sky: this.sky, renderer: this.renderer, events: this.events });
    this.world = buildWorld({ scene: this.scene, colliders: this.colliders, daynight: this.daynight });
    this.hub = new Hub({ scene: this.scene, colliders: this.colliders, daynight: this.daynight });
    this.treadmills = new Treadmills({ scene: this.scene, colliders: this.colliders, daynight: this.daynight });
    this.lane = new Lane({ scene: this.scene, colliders: this.colliders, daynight: this.daynight, events: this.events });
    this.base = new Base({ scene: this.scene, colliders: this.colliders, daynight: this.daynight });
    this.base.onHatch = (i, p) => this.onHatch(i, p);
    this.player = new Player(this.scene, this.colliders);
    this.trail = new TrailEmitter(this.particles);
    this.preview = new Preview(document.getElementById('hatch-canvas'));
    this.hud = new HUD(this.preview);
    this.menus = new Menus(this, this.preview);

    // player point light so you stay readable at night
    this.playerLight = new THREE.PointLight(0xbfd4ff, 0, 16, 1.5);
    this.scene.add(this.playerLight);
    this.daynight.registerNightLight(this.playerLight);
    this.daynight.nightLights[this.daynight.nightLights.length - 1].base = 9;

    // camera rig
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.camDist = 15;
    this.camTarget = new THREE.Vector3();
    this.shake = 0;

    this.timer = new THREE.Timer();
    this.time = 0;
    this.started = false;
    this.trainRate = 0;
    this.trainFloat = 0;
    this.trainAccum = 0;
    this.incomeFloat = 0;
    this.sellConfirm = null;
    this.chasedBy = 0;
    this.caughtTimer = 0;
    this.prompt = null;
    this.saveTimer = 0;
    this.tutorialStep = 0;
    this.tutorialTimer = 3;
    this.slowMode = false;

    this.renderer.onResize.push((qualityChanged) => {
      if (qualityChanged) this.daynight.setShadowSize(this.renderer.shadowSize);
      this.particles.setViewport(window.innerHeight * this.renderer.renderer.getPixelRatio(), this.renderer.camera.fov);
    });
    this.renderer.setQuality(state.data.settings.quality || 'auto');

    this.bindEvents();
    this.bindTouch();
    window.addEventListener('beforeunload', () => state.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) state.save(); });
  }

  bindEvents() {
    const E = this.events;
    E.on('night', () => {
      audio.isNight = true;
      audio.night();
      this.hud.banner('NIGHT FALLS<small>The Guardians sleep extra soundly…</small>', 'night');
    });
    E.on('day', () => {
      audio.isNight = false;
      audio.day();
      this.hud.banner('SUNRISE<small>A new day of heists begins</small>', 'day', 3000);
    });
    E.on('divineSpawn', (egg) => {
      if (this.started && Math.abs(egg.z - this.player.pos.z) < 220) this.hud.toast(`✦ The <b>${egg.zone.def.name} Divine Egg</b> is back on its golden pedestal!`, 'gold', 4);
    });
    E.on('caught', (info) => this.onCaught(info));
    E.on('spotted', () => { if (!this.player.caught) audio.alert(); });
    E.on('hugeSpawn', (egg) => {
      if (this.started) this.hud.toast(`🌟 A <b>HUGE</b> egg spawned in <b>${egg.zone.def.name}</b>!`, 'gold', 4);
    });
  }

  bindTouch() {
    const j = document.getElementById('touch-jump'), a = document.getElementById('touch-act');
    j.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.touchJump = true; });
    a.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.pressed.add('e'); });
    document.getElementById('slow-btn').addEventListener('click', () => this.toggleSlowMode());
  }

  start() {
    this.started = true;
    audio.init();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('ui').classList.remove('prestart');
    this.camYaw = 0;
    if (!state.data.tutorialDone) this.tutorialStep = 1;
    else this.hud.toast(`Welcome back! 💰 $${formatNum(state.data.cash)} • ⚡ ${formatNum(state.data.speed)}`, 'good', 4);
  }

  // ── economy actions ──
  buyTreadmill(tier) {
    const t = TREADMILLS[tier - 1];
    const d = state.data;
    if (d.treadmills[tier - 1]) return;
    if (tier > 1 && !d.treadmills[tier - 2]) { audio.error(); this.hud.toast(`Buy the Tier ${tier - 1} treadmill first`, 'bad'); return; }
    if (!state.spend(t.cost)) { audio.error(); this.hud.toast(`Need $${formatNum(t.cost - d.cash)} more`, 'bad'); return; }
    d.treadmills[tier - 1] = true;
    state.save(); state.emit('treadmills');
    audio.purchase();
    this.hud.toast(`🏃 Unlocked <b>T${tier} ${t.name}</b> treadmill! (+${formatNum(t.speedPerSec)} ⚡/s)`, 'good');
    const tm = this.treadmills.list[tier - 1];
    this.particles.burst(tm.x, 2, tm.z, 80, { colors: [t.accent, 0xffffff, 0xffe14a], speed: 9, life: 1.2, size: 0.5, gravity: -9 });
  }

  teleportToTreadmill(tier) {
    const tm = this.treadmills.list[tier - 1];
    this.dropIfCarrying();
    this.player.pos.set(tm.x - 5.2, 0.2, tm.z);
    this.player.vel.set(0, 0, 0);
    this.player.yaw = Math.PI / 2;
    this.camYaw = -Math.PI / 2;
    this.particles.burst(this.player.pos.x, 1.2, this.player.pos.z, 40, { colors: [0x7fd8ff, 0xffffff], speed: 5, life: 0.8 });
  }

  dropIfCarrying() {
    if (!this.player.carrying) return;
    const egg = this.player.carrying;
    this.player.carrying = null;
    this.returnEgg(egg);
  }

  /** Put an egg back on its pedestal. */
  returnEgg(egg) {
    this.lane.placeInNest(egg);
    egg.pop = 0;
  }

  buyTrail(id) {
    const t = TRAILS.find((x) => x.id === id);
    if (state.data.trails.includes(id)) return;
    if (t.dcoins ? !state.spendDcoins(t.dcoins) : !state.spend(t.cost)) { audio.error(); this.hud.toast(t.dcoins ? `Need 🪙 ${formatNum(t.dcoins - state.data.dcoins)} more D Coins` : 'Not enough cash', 'bad'); return; }
    state.data.trails.push(id);
    state.data.trail = id;
    state.save(); state.emit('trail');
    audio.purchase();
    this.hud.toast(`✨ Equipped <b>${t.name}</b> — training x${t.mult}!`, 'good');
    this.particles.burst(this.player.pos.x, 1.5, this.player.pos.z, 90, { colors: t.colors, speed: 8, life: 1.2 });
  }

  // ── D Coin shop ──
  buyShopItem(id) {
    const item = SHOP_ITEMS.find((x) => x.id === id);
    if (!item) return;
    const d = state.data;
    const fail = (msg) => { audio.error(); this.hud.toast(msg, 'bad', 3); };
    if (d.dcoins < item.price) return fail(`Need 🪙 ${formatNum(item.price - d.dcoins)} more D Coins. You earn 10 every 3 minutes, or try a code!`);
    // check the purchase can actually be used before charging
    let pad = -1;
    if (item.kind === 'egg') { pad = state.freePlot(); if (pad < 0) return fail('Your base is full! Sell a pet to free a pad first.'); }
    if (item.kind === 'perk' && state.perk(item.perk)) return fail('You already own this upgrade.');
    if (item.kind === 'trail' && d.trails.includes(item.trail)) return fail('You already own this trail.');
    if (item.kind === 'hatch' && !d.plots.some((p) => p && p.hatchLeft > 0)) return fail('No eggs are incubating right now.');
    if (!state.spendDcoins(item.price)) return fail('Not enough D Coins');

    const P = this.player.pos;
    let msg = '';
    switch (item.kind) {
      case 'egg': {
        const def = eggDef(item.egg);
        const species = pickWeighted(def.pool);
        state.placeEgg(pad, { egg: def.id, species, huge: false, hatchLeft: def.hatch, hatchTotal: def.hatch });
        this.base.sync();
        const bp = this.base.pads[pad];
        this.particles.burst(bp.x, 1.5, bp.z, 140, { colors: [0xfff2b0, item.color, 0xffffff], speed: 10, life: 1.4, size: 0.5, gravity: -6, twinkle: true });
        msg = `✦ <b>${def.name} Divine Egg</b> placed on pad ${pad + 1}! Hatches in ${def.hatch}s.`;
        break;
      }
      case 'boost':
        state.addBoost(item.boost, item.secs);
        if (item.boost === 'luck') this.lane.rerollAll();
        msg = `${item.icon} <b>${item.name}</b> active! (${Math.round(state.boostLeft(item.boost) / 60)} min left)`;
        break;
      case 'perk':
        state.addPerk(item.perk);
        msg = `${item.icon} <b>${item.name}</b> unlocked forever!`;
        break;
      case 'hatch':
        for (const p of d.plots) if (p && p.hatchLeft > 0) p.hatchLeft = Math.min(p.hatchLeft, 0.3);
        msg = `${item.icon} <b>Hatch-o-Matic!</b> Your eggs are hatching!`;
        break;
      case 'speed':
        state.addSpeed(item.amount);
        this.hud.floater(`+${formatNum(item.amount)} ⚡`, new THREE.Vector3(P.x, P.y + 3, P.z), 'speed big', 2);
        msg = `${item.icon} <b>+${formatNum(item.amount)} Speed!</b>`;
        break;
      case 'cash': {
        const v = Math.max(item.min, Math.round(state.incomePerSec() * item.secs));
        state.addCash(v);
        this.hud.floater(`+$${formatNum(v)}`, new THREE.Vector3(P.x, P.y + 3, P.z), 'cash big', 2);
        msg = `${item.icon} <b>+$${formatNum(v)}</b> cash!`;
        break;
      }
      case 'trail': {
        const t = TRAILS.find((x) => x.id === item.trail);
        d.trails.push(t.id); d.trail = t.id;
        state.emit('trail');
        msg = `🌈 Equipped <b>${t.name}</b>, training ×${t.mult}!`;
        break;
      }
    }
    state.save();
    audio.purchase();
    this.particles.burst(P.x, P.y + 1.5, P.z, 60, { colors: [0xffd23f, 0xfff3a8, 0xffffff], speed: 7, life: 1, twinkle: true });
    this.hud.toast(msg, 'gold', 4);
  }

  redeemCode(text) {
    const r = state.redeemCode(text);
    if (!r.ok) { audio.error(); this.hud.toast(r.msg, 'bad', 3.5); return r; }
    audio.divineEvent();
    const P = this.player.pos;
    this.particles.burst(P.x, P.y + 1.5, P.z, 160, { colors: [0xffd23f, 0xfff3a8, 0x7dffa6, 0xffffff], speed: 11, life: 1.6, size: 0.5, gravity: -6, twinkle: true });
    this.hud.toast(`🎉 ${r.msg} <b>+🪙 ${r.amount.toLocaleString('en-US')} D Coins</b>`, 'gold', 5);
    return r;
  }

  /** SLOW MODE: walk at exactly 10 studs/s; switching it off restores your normal speed. */
  toggleSlowMode() {
    this.slowMode = !this.slowMode;
    audio.click();
    document.body.classList.toggle('slow-mode', this.slowMode);
    this.hud.toast(this.slowMode ? `🐢 <b>SLOW MODE ON</b>: you walk at exactly ${SLOW_MODE_SPEED} studs/s` : `🐇 <b>SLOW MODE OFF</b>: back to ${walkSpeedFor(state.data.speed).toFixed(1)} studs/s`, this.slowMode ? '' : 'good', 2.5);
  }

  currentWalk() { return this.slowMode ? SLOW_MODE_SPEED : walkSpeedFor(state.data.speed); }

  /** Time rewards (10 D Coins every 3 minutes played) and boost timers. */
  updateRewards(dt) {
    if (!this.started) return;
    const d = state.data;
    d.dcoinTimer += dt;
    if (d.dcoinTimer >= DCOIN_REWARD.every) {
      d.dcoinTimer -= DCOIN_REWARD.every;
      state.addDcoins(DCOIN_REWARD.amount);
      audio.purchase();
      const P = this.player.pos;
      this.hud.floater(`+${DCOIN_REWARD.amount} 🪙`, new THREE.Vector3(P.x, P.y + 3, P.z), 'dcoin big', 2);
      this.hud.toast(`⏰ Time reward! <b>+${DCOIN_REWARD.amount} D Coins</b> for playing 3 minutes. Spend them in the 🛒 SHOP!`, 'gold', 4);
    }
    const ended = state.tickBoosts(dt);
    if (ended) {
      const names = ended.map((b) => SHOP_ITEMS.find((i) => i.boost === b)).filter(Boolean).map((i) => `${i.icon} ${i.name}`);
      if (names.length) this.hud.toast(`${names.join(', ')} wore off.`, '', 3);
    }
  }

  onReset() {
    this.dropIfCarrying();
    this.player.respawn();
    this.base.sync();
    this.treadmills.refresh();
    this.hud.renderEquip();
    this.hud.toast('Progress reset. Fresh start!', 'bad');
  }

  // ── heist ──
  steal(egg) {
    egg.state = 'carried';
    egg.group.rotation.set(0, 0, 0);
    egg.group.scale.setScalar(egg.huge ? 1.5 : 0.85);
    this.player.carrying = egg;
    this.player.training = null;
    this.sellConfirm = null;
    audio.pickup(egg.huge || egg.divine);
    const color = egg.divine ? egg.zone.def.trim : egg.zone.def.color;
    this.particles.burst(egg.x, 1.2, egg.z, egg.huge || egg.divine ? 60 : 24, { colors: [color, 0xffffff], speed: 5, life: 0.8 });
    this.lane.wake(egg);
    const sleepy = state.boost('sleep') ? ' (Sleepy Dust: it\'s groggy!)' : '';
    if (egg.divine) this.hud.toast(`✦ You grabbed the <b>${egg.zone.def.name} DIVINE EGG</b>! Its Guardian is waking up${sleepy}. RUN!`, 'gold', 4);
    else if (egg.huge) this.hud.toast(`🌟 You grabbed a <b>HUGE EGG</b>! The Guardian woke up${sleepy}. Get it home!`, 'gold');
    else this.hud.toast(`🚨 The ${egg.zone.def.name} Guardian woke up${sleepy}! Run home!`, 'bad', 2.5);
  }

  /** Drop the carried egg on a base pad: it starts incubating there. */
  placeEgg(index) {
    const egg = this.player.carrying;
    if (!egg) return;
    this.player.carrying = null;
    const src = egg.def;
    const species = pickWeighted(src.pool);
    const total = Math.round(src.hatch * (egg.huge ? HUGE_HATCH_MULT : 1));
    state.data.eggsStolen++;
    if (egg.huge) state.data.hugeStolen++;
    if (egg.divine) state.data.divineStolen++;
    state.placeEgg(index, { egg: src.id, species, huge: egg.huge, hatchLeft: total, hatchTotal: total });
    this.lane.consume(egg);
    this.base.sync();
    audio.deposit(egg.huge || egg.divine);
    const pad = this.base.pads[index];
    this.particles.burst(pad.x, 1.5, pad.z, egg.huge ? 120 : 50, { colors: [0x7dffa6, 0xffe14a, 0xffffff, egg.divine ? egg.zone.def.trim : egg.zone.def.color], speed: egg.huge ? 11 : 7, life: 1.2, size: 0.45, gravity: -10 });
    this.hud.toast(`🥚 Egg placed on pad ${index + 1}! It hatches in <b>${total}s</b>.`, egg.huge || egg.divine ? 'gold' : 'good', 3);
    if (this.tutorialStep === 3) this.advanceTutorial();
  }

  /** Base full: sell the pet on this pad and drop the egg in its place. */
  swapEgg(index) {
    const old = state.data.plots[index];
    if (!old || old.hatchLeft > 0) return;
    const value = state.sellPlot(index);
    this.hud.toast(`💸 Sold ${PETS[old.species].name} for <b>$${formatNum(value)}</b>`, 'good', 2.5);
    this.placeEgg(index);
  }

  sellPet(index) {
    const p = state.data.plots[index];
    if (!p || p.hatchLeft > 0) return;
    const value = state.sellPlot(index);
    this.base.sync();
    audio.purchase();
    const pad = this.base.pads[index];
    this.hud.floater(`+$${formatNum(value)}`, new THREE.Vector3(pad.x, 3, pad.z), 'cash big', 1.8);
    this.hud.toast(`💸 Sold ${p.huge ? 'HUGE ' : ''}${PETS[p.species].name} for <b>$${formatNum(value)}</b>`, 'good', 2.5);
  }

  onHatch(index, p) {
    const def = PETS[p.species], rar = RARITY[def.rarity];
    const inc = petIncome(p.species, p.huge);
    const name = `${p.huge ? 'HUGE ' : ''}${def.name}`;
    if (def.rarity === 'divine') {
      audio.divineEvent();
      this.hud.toast(`✦ Pad ${index + 1} hatched a <b style="color:${rar.color}">DIVINE ${name}</b>! <b>$${formatNum(inc)}/s</b>`, 'gold', 6);
      const pad = this.base.pads[index];
      this.particles.burst(pad.x, 2, pad.z, 200, { colors: [0xfff2b0, def.aura ?? 0xd9b8ff, 0xffffff], speed: 12, life: 2, size: 0.6, gravity: -3, twinkle: true });
    } else {
      audio.levelUp();
      this.hud.toast(`🐣 Pad ${index + 1} hatched a <b style="color:${rar.color}">${rar.name} ${name}</b>! <b>$${formatNum(inc)}/s</b>`, rar.order >= 4 || p.huge ? 'gold' : 'good', 4);
    }
  }

  onCaught(info) {
    const pl = this.player;
    if (pl.caught) return;
    pl.caught = true;
    this.caughtTimer = 1.3;
    state.data.timesCaught++;
    audio.busted();
    this.hud.busted(info.reason, !!pl.carrying);
    this.shake = 0.8;
    this.input.enabled = false;
    this.particles.burst(pl.pos.x, 1.2, pl.pos.z, 50, { colors: [0xff3040, 0xffffff], speed: 7, life: 0.8 });
    if (pl.carrying) {
      const egg = pl.carrying;
      pl.carrying = null;
      this.returnEgg(egg);
    }
  }

  // ── tutorial ──
  advanceTutorial() {
    this.tutorialStep++;
    this.tutorialTimer = 1.5;
  }

  runTutorial(dt) {
    if (!this.tutorialStep || state.data.tutorialDone) return;
    this.tutorialTimer -= dt;
    if (this.tutorialTimer > 0) return;
    const steps = {
      1: ['👋 Welcome to <b>EGG DASH</b>! Head <b>west</b> to the <b>Training Grounds</b> and stand still on the wooden treadmill to train Speed.', 9],
      2: ['⚡ Every bit of Speed makes you faster. Now head <b>north</b> into the <b>Egg Lane</b>. The Guardians are asleep… press <b>E</b> on a Forest egg to steal it!', 9],
      3: ['🚨 You woke up its Guardian! Run back to <b>your base</b> in the plaza and step onto an empty pad.', 9],
      4: ['🐣 Your egg will hatch into a pet that earns cash every second. Every land has a golden <b>✦ DIVINE egg</b> at its far end. Earn 🪙 D Coins to spend in the <b>🛒 SHOP</b>!', 11],
    };
    const s = steps[this.tutorialStep];
    if (!s) { state.data.tutorialDone = true; state.save(); return; }
    if (!this.shownTut) this.shownTut = {};
    if (!this.shownTut[this.tutorialStep]) {
      this.shownTut[this.tutorialStep] = true;
      this.hud.toast(s[0], 'good', s[1]);
      if (this.tutorialStep === 4) { state.data.tutorialDone = true; state.save(); }
    }
    this.tutorialTimer = 1e9;
  }

  // ── per-frame ──
  updateInteractions(dt) {
    const pl = this.player;
    const P = pl.pos;
    this.prompt = null;
    if (pl.caught || !this.started) return;
    const E = this.input.hit('e') || this.input.hit('enter');
    const kbd = (k) => `<kbd>${k}</kbd>`;
    const padIdx = this.base.padAt(P.x, P.z);
    const plot = padIdx >= 0 ? state.data.plots[padIdx] : null;

    // carrying: drop on an empty pad (automatic) or swap with a pet when the base is full
    if (pl.carrying) {
      if (padIdx < 0) return;
      if (!plot) { this.placeEgg(padIdx); return; }
      if (plot.hatchLeft > 0) { this.prompt = { text: 'This pad is incubating, so find an empty one', cls: 'bad' }; return; }
      const free = state.freePlot() >= 0;
      this.prompt = { text: `${kbd('E')} Swap: sell ${PETS[plot.species].name} ($${formatNum(state.sellValue(plot))}) for this egg${free ? ' (empty pads available!)' : ''}`, cls: free ? '' : 'good' };
      if (E) this.swapEgg(padIdx);
      return;
    }

    // eggs in the lane
    const egg = this.lane.nearestEgg(P.x, P.z);
    if (egg) {
      const label = egg.divine ? `<span style="color:#ffe9a0">✦ ${egg.zone.def.name} DIVINE</span> ` : '';
      const huge = egg.huge ? '<span style="color:#ffe14a">HUGE</span> ' : '';
      this.prompt = { text: `${kbd('E')} Steal ${huge}${label}${egg.divine ? '' : egg.zone.def.name + ' '}Egg • wakes its Guardian!`, cls: egg.huge || egg.divine ? 'good' : '' };
      if (E) this.steal(egg);
      return;
    }

    // base pads: inspect / sell (press twice to confirm)
    if (padIdx >= 0) {
      if (this.sellConfirm && (this.sellConfirm.i !== padIdx || this.time > this.sellConfirm.until)) this.sellConfirm = null;
      if (!plot) { this.prompt = { text: `Pad ${padIdx + 1} is empty. Steal an egg from the Egg Lane (or buy a Divine Egg in the 🛒 SHOP)`, cls: '' }; return; }
      const def = PETS[plot.species];
      if (plot.hatchLeft > 0) { this.prompt = { text: `🥚 ${eggName(plot.egg)} hatching in ${Math.ceil(plot.hatchLeft)}s…`, cls: '' }; return; }
      const name = `${plot.huge ? 'HUGE ' : ''}${def.name}`;
      const val = formatNum(state.sellValue(plot));
      if (this.sellConfirm) {
        this.prompt = { text: `${kbd('E')} Press again to SELL ${name} for $${val}`, cls: 'bad' };
        if (E) { this.sellConfirm = null; this.sellPet(padIdx); }
      } else {
        this.prompt = { text: `<span style="color:${RARITY[def.rarity].color}">${name}</span> • $${formatNum(petIncome(plot.species, plot.huge))}/s • ${kbd('E')} Sell`, cls: '' };
        if (E) { this.sellConfirm = { i: padIdx, until: this.time + 2.5 }; audio.click(); }
      }
      return;
    }
    this.sellConfirm = null;

    // trail shop
    if (Math.hypot(P.x - WORLD.trailShop.x, P.z - WORLD.trailShop.z) < 9) {
      this.prompt = { text: `${kbd('E')} Browse Trails`, cls: '' };
      if (E) { audio.click(); this.menus.open('trails'); }
      return;
    }
    // treadmills
    const tm = this.treadmills.nearest(P.x, P.z, 4.2);
    if (tm && !tm.owned) {
      const prevOk = tm.tier === 1 || state.data.treadmills[tm.tier - 2];
      if (!prevOk) this.prompt = { text: `🔒 T${tm.tier} ${tm.def.name} — buy Tier ${tm.tier - 1} first`, cls: 'bad' };
      else {
        const afford = state.data.cash >= tm.def.cost;
        this.prompt = { text: `${kbd('E')} Buy T${tm.tier} ${tm.def.name} — $${formatNum(tm.def.cost)}`, cls: afford ? 'good' : 'bad' };
        if (E) this.buyTreadmill(tm.tier);
      }
      return;
    }
    if (pl.training) this.prompt = { text: `Training on T${pl.training.tier} • move to leave`, cls: 'good' };
    else if (tm && tm.owned && this.treadmills.findAt(P.x, P.z, P.y)) this.prompt = { text: 'Stand still to start training', cls: '' };
  }

  updateTraining(dt, steering) {
    const pl = this.player;
    this.trainRate = 0;
    if (pl.caught || pl.carrying || !this.started) { pl.training = null; return; }
    if (pl.training) {
      const tm = pl.training;
      const mult = state.trainingMultiplier();
      const gain = tm.def.speedPerSec * mult; // treadmills give Speed only, never cash
      this.trainRate = gain;
      state.addSpeed(gain * dt);
      this.trainAccum += gain * dt;
      this.trainFloat -= dt;
      if (this.trainFloat <= 0) {
        this.trainFloat = 0.7;
        const p = pl.pos;
        this.hud.floater(`+${formatNum(this.trainAccum)} ⚡`, new THREE.Vector3(p.x, p.y + 2.6, p.z), 'speed', 1.2);
        this.trainAccum = 0;
      }
      // sweat sparkles in the trail color
      if (Math.random() < dt * 8) this.particles.emit({ x: pl.pos.x - 0.8, y: pl.pos.y + 0.3, z: pl.pos.z + (Math.random() - 0.5) * 1.5, vx: -3, vy: 1, color: tm.def.accent, size: 0.25, life: 0.6, intensity: 2 });
      if (this.tutorialStep === 1 && state.data.speed > 8) this.advanceTutorial();
      return;
    }
    const tm = this.treadmills.findAt(pl.pos.x, pl.pos.z, pl.pos.y);
    if (tm && tm.owned && pl.grounded && !steering && pl.horizSpeed < 2) {
      pl.trainIdle += dt;
      if (pl.trainIdle > 0.2) { pl.training = tm; pl.trainIdle = 0; audio.levelUp(); }
    } else pl.trainIdle = Math.min(pl.trainIdle, 0);
    if (!tm) pl.trainIdle = 0;
  }

  updateCamera(dt) {
    const cam = this.renderer.camera;
    const inp = this.input;
    if (this.started) {
      this.camYaw -= inp.orbitDX * 0.006;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + inp.orbitDY * 0.004, 0.08, 1.25);
      this.camDist = THREE.MathUtils.clamp(this.camDist + inp.zoomDelta * 1.4, 5, 34);
      if (inp.down('arrowleft', 'q')) this.camYaw += dt * 2.2;
      if (inp.down('arrowright')) this.camYaw -= dt * 2.2;
    } else {
      this.camYaw += dt * 0.08; // title screen orbit
    }
    const P = this.player.pos;
    const tx = P.x, ty = P.y + 2.0, tz = P.z;
    const follow = 14 + this.player.horizSpeed * 1.5; // stay glued to the player at high speed
    this.camTarget.x = damp(this.camTarget.x, tx, follow, dt);
    this.camTarget.y = damp(this.camTarget.y, ty, 8, dt);
    this.camTarget.z = damp(this.camTarget.z, tz, follow, dt);
    const T = this.camTarget;
    const dist = this.started ? this.camDist : 30;
    const pitch = this.started ? this.camPitch : 0.38;
    const dx = Math.sin(this.camYaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(this.camYaw) * Math.cos(pitch);
    // pull in if a tall wall is between camera and player
    let d = dist;
    for (let k = 1; k <= 12; k++) {
      const s = (dist * k) / 12;
      const x = T.x + dx * s, y = T.y + dy * s, z = T.z + dz * s;
      if (this.pointInWall(x, y, z)) { d = Math.max(2.5, (dist * (k - 1)) / 12); break; }
    }
    this.camActualDist = damp(this.camActualDist ?? d, d, d < (this.camActualDist ?? d) ? 20 : 4, dt);
    const ad = this.camActualDist;
    cam.position.set(T.x + dx * ad, Math.max(0.6, T.y + dy * ad), T.z + dz * ad);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.5);
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }
    cam.lookAt(T.x, T.y + 0.4, T.z);
  }

  pointInWall(x, y, z) {
    for (const b of this.colliders.boxes) {
      if (b.ghost || b.h < 2.5 || y > b.h) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    for (const c of this.colliders.circles) {
      if (!c.camR || y < c.camY0 || y > c.camY1) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.camR * c.camR) return true;
    }
    for (const b of this.colliders.camBoxes) {
      if (y < b.minY || y > b.maxY) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  /** Hatched pets on your pads pay out continuously. */
  updateIncome(dt) {
    if (!this.started) return;
    const inc = state.incomePerSec();
    if (inc > 0) state.addCash(inc * dt);
    this.incomeFloat -= dt;
    if (this.incomeFloat > 0) return;
    this.incomeFloat = 2.5;
    // floating "+$" over each earning pet while you're near the base
    if (Math.hypot(this.player.pos.x, this.player.pos.z - 17) > 60) return;
    state.data.plots.forEach((p, i) => {
      const v = state.plotIncome(p);
      if (!v) return;
      const pad = this.base.pads[i];
      this.hud.floater(`+$${formatNum(v * 2.5)}`, new THREE.Vector3(pad.x, 3.2, pad.z), 'cash', 1.4);
    });
  }

  debugKeys() {
    if (!DEBUG) return;
    const i = this.input;
    if (i.hit('n')) this.daynight.skipToDusk();
    if (i.hit('b')) this.daynight.skipToDawn();
    if (i.hit('v')) this.lane.respawnDivines();
    if (i.hit('c')) state.addDcoins(1000);
    if (i.hit('t')) state.data.dcoinTimer = DCOIN_REWARD.every - 2;
    if (i.hit('m')) state.addCash(1e6);
    if (i.hit('k')) state.addSpeed(25000);
    if (i.hit('h')) for (const e of this.lane.eggs) if (e.state === 'nest' && !e.divine) this.lane.roll(e, { forceHuge: true });
    if (i.hit('j')) for (const p of state.data.plots) if (p && p.hatchLeft > 0) p.hatchLeft = Math.min(p.hatchLeft, 0.5);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    this.timer.update();
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 1 / 20);
    this.time += dt;
    const t = this.time;
    this.renderer.trackPerformance(rawDt);

    const pl = this.player;

    // caught sequence
    if (pl.caught) {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) {
        pl.caught = false;
        pl.respawn();
        this.input.enabled = !this.menus.isOpen;
        this.particles.burst(pl.pos.x, 1, pl.pos.z, 40, { colors: [0x7fd8ff, 0xffffff], speed: 5, life: 0.8 });
      }
    }

    if (this.started && this.input.pressed.has('escape')) this.menus.close();

    // player
    let steering = false;
    if (pl.carrying) { const f = this.base.nearestFree(pl.pos.x, pl.pos.z); pl.arrowTarget = f ? { x: f.x, z: f.z } : { x: WORLD.hub.x, z: WORLD.hub.z + 17 }; }
    if (this.started && !pl.caught) steering = pl.update(dt, this.input, this.camYaw, this.currentWalk(), t, !this.slowMode && !state.perk('carry'));
    else pl.avatar.animate(dt, { speed: 0 });
    pl.safe = Math.hypot(pl.pos.x - WORLD.hub.x, pl.pos.z - WORLD.hub.z) < WORLD.hub.safeRadius;
    if (pl.carrying) {
      const egg = pl.carrying;
      egg.group.position.set(pl.pos.x, pl.pos.y + 2.25 + Math.sin(t * 8) * 0.03, pl.pos.z);
      egg.group.rotation.y = pl.yaw;
      if ((egg.huge || egg.divine) && Math.random() < dt * 25) this.particles.emit({ x: pl.pos.x + (Math.random() - 0.5) * 1.5, y: pl.pos.y + 2.4 + Math.random() * 1.5, z: pl.pos.z + (Math.random() - 0.5) * 1.5, vy: 1, color: Math.random() < 0.5 ? 0xffffff : egg.divine ? egg.zone.def.trim : egg.zone.def.color, size: 0.3, life: 1, intensity: 3, twinkle: true });
    }
    if (pl.jumped) { pl.jumped = false; audio.jump(); }
    // footstep dust when sprinting & a puff on landing
    if (this.started && pl.grounded && pl.horizSpeed > 9 && Math.random() < dt * Math.min(40, pl.horizSpeed * 0.9)) {
      this.particles.emit({ x: pl.pos.x + (Math.random() - 0.5) * 0.6, y: pl.pos.y + 0.15, z: pl.pos.z + (Math.random() - 0.5) * 0.6, vx: -pl.vel.x * 0.08, vy: 0.8, vz: -pl.vel.z * 0.08, color: 0xd9c9a3, size: 0.45, sizeEnd: 0.9, life: 0.6, intensity: 0.35, drag: 2 });
    }
    if (pl.grounded && !this.wasGrounded && this.started) this.particles.burst(pl.pos.x, pl.pos.y + 0.1, pl.pos.z, 10, { color: 0xd9c9a3, speed: 3, life: 0.5, size: 0.5, sizeEnd: 0.8, gravity: 0, intensity: 0.35, hemi: true, up: 0.3 });
    this.wasGrounded = pl.grounded;

    this.updateTraining(dt, steering);
    this.updateInteractions(dt);
    this.debugKeys();

    // world systems
    this.daynight.update(dt, pl.pos, t);
    this.lane.update(dt, t, { pos: pl.pos, carrying: pl.carrying, caught: pl.caught || !this.started, safe: pl.safe }, this.particles);
    this.chasedBy = this.lane.guards.filter((g) => g.state === 'chase' || g.state === 'waking').length;
    this.base.update(dt, t, this.particles, pl.pos, !!pl.carrying);
    this.updateIncome(dt);
    this.updateRewards(dt);
    for (const tm of this.treadmills.list) tm.near = Math.abs(tm.x - pl.pos.x) < 45 && Math.abs(tm.z - pl.pos.z) < 45;
    this.treadmills.update(dt, t, pl.training?.tier, this.particles);
    this.hub.update(dt, t, this.particles, this.daynight.nightFactor);
    this.world.update(dt, t, this.particles, this.daynight.nightFactor, pl.pos);
    this.trail.update(dt, t, pl);
    this.particles.update(dt, t);
    this.playerLight.position.set(pl.pos.x, pl.pos.y + 4, pl.pos.z);

    this.updateCamera(dt);
    this.sky.follow(this.renderer.camera);
    if (this.started) { this.hud.update(dt, this); this.menus.update(dt); this.runTutorial(dt); }
    this.preview.update(dt);
    audio.update(dt);

    this.saveTimer += dt;
    if (this.saveTimer > 8) { this.saveTimer = 0; state.save(); }

    // tutorial progress: reaching the coop
    if (this.tutorialStep === 2 && pl.carrying) this.advanceTutorial();

    this.renderer.render();
    this.input.endFrame();
  }
}

// ── boot ──
async function boot() {
  const loading = document.getElementById('loading');
  const play = document.getElementById('play-btn');
  play.disabled = true;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Lilita One"'), document.fonts.load('700 20px "Fredoka"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fonts optional */ }
  const game = new Game();
  window.game = game; // handy for debugging in the console
  if (DEBUG) window.state = state;
  game.preview.prewarm();
  game.hud.renderEquip();
  game.loop();
  loading.textContent = DEBUG ? 'Debug: N night • B dawn • V respawn Divines • M +$1M • K +25K speed • C +1K D Coins • T time reward • H huge eggs • J finish hatching' : 'Ready!';
  play.disabled = false;
  const go = () => { if (!game.started) game.start(); };
  play.addEventListener('click', go);
  window.addEventListener('keydown', (e) => { if (!game.started && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } });
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').textContent = 'Failed to start: ' + e.message + ' (WebGL required)';
});
