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
import { Vaults } from './world/vaults.js';
import { Hub } from './world/hub.js';
import { Player } from './entities/player.js';
import { PetFollowers } from './entities/pets.js';
import { TrailEmitter } from './entities/trails.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Preview } from './ui/preview.js';
import { state } from './state.js';
import { Events, damp } from './util.js';
import { TREADMILLS, TRAILS, EGGS, DIVINE_EGG, PETS, RARITY, WORLD, NIGHT_PAYOUT_BONUS, walkSpeedFor, formatNum } from './config.js';

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
    this.vaults = new Vaults({ scene: this.scene, colliders: this.colliders, daynight: this.daynight, events: this.events });
    this.player = new Player(this.scene, this.colliders);
    this.pets = new PetFollowers(this.scene);
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
    this.trainCash = 0;
    this.chasedBy = 0;
    this.caughtTimer = 0;
    this.prompt = null;
    this.hatching = false;
    this.saveTimer = 0;
    this.tutorialStep = 0;
    this.tutorialTimer = 3;

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
    E.on('night', ({ divine }) => {
      audio.isNight = true;
      if (divine) {
        audio.divine = true;
        this.hub.setDivine(true);
        audio.divineEvent();
        this.hud.banner('✦ DIVINE EVENT ✦<small>A Divine Egg has descended on the altar! Hatch it before dawn!</small>', 'divine', 6000);
        this.hud.toast('🌟 <b>DIVINE EVENT!</b> Head to the glowing altar in the plaza.', 'gold', 6);
      } else {
        audio.night();
        this.hud.banner('NIGHT FALLS<small>Eggs pay 1.5× • guards see less in the dark</small>', 'night');
      }
    });
    E.on('day', ({ endedDivine }) => {
      audio.isNight = false; audio.divine = false;
      this.hub.setDivine(false);
      audio.day();
      this.hud.banner('SUNRISE<small>' + (endedDivine ? 'The Divine Egg fades away…' : 'A new day of heists begins') + '</small>', 'day', 3000);
    });
    E.on('caught', (info) => this.onCaught(info));
    E.on('spotted', () => { if (!this.player.caught) audio.alert(); });
    E.on('hugeSpawn', (egg) => {
      if (this.started) this.hud.toast(`🌟 A <b>HUGE</b> egg spawned in the <b>${egg.vault.def.name}</b>!`, 'gold', 4);
    });
  }

  bindTouch() {
    const j = document.getElementById('touch-jump'), a = document.getElementById('touch-act');
    j.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.touchJump = true; });
    a.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.pressed.add('e'); });
  }

  start() {
    this.started = true;
    audio.init();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('ui').classList.remove('prestart');
    this.camYaw = 0;
    this.pets.sync();
    if (!state.data.tutorialDone) this.tutorialStep = 1;
    else this.hud.toast(`Welcome back! 💰 $${formatNum(state.data.cash)} • ⚡ ${formatNum(state.data.speed)}`, 'good', 4);
  }

  // ── economy actions ──
  payoutBonus() { return state.petMultiplier() * (this.daynight.isNight ? NIGHT_PAYOUT_BONUS : 1); }

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
    this.vaults.placeInNest(egg);
  }

  buyTrail(id) {
    const t = TRAILS.find((x) => x.id === id);
    if (state.data.trails.includes(id)) return;
    if (!state.spend(t.cost)) { audio.error(); return; }
    state.data.trails.push(id);
    state.data.trail = id;
    state.save(); state.emit('trail');
    audio.purchase();
    this.hud.toast(`✨ Equipped <b>${t.name}</b> — training x${t.mult}!`, 'good');
    this.particles.burst(this.player.pos.x, 1.5, this.player.pos.z, 90, { colors: t.colors, speed: 8, life: 1.2 });
  }

  hatch(eggId, n = 1, free = false) {
    if (this.hatching) return;
    const egg = eggId === 'divine' ? DIVINE_EGG : EGGS.find((e) => e.id === eggId);
    if (!egg) return;
    if (egg.id === 'divine' && !this.daynight.divine) { audio.error(); this.hud.toast('The Divine Egg only appears during a DIVINE night!', 'bad'); return; }
    if (!free && !state.spend(egg.cost * n)) { audio.error(); this.hud.toast(`Need $${formatNum(egg.cost * n - state.data.cash)} more for ${egg.name}`, 'bad'); return; }
    const results = [];
    for (let i = 0; i < n; i++) {
      let species;
      if (egg.id === 'divine') species = Math.random() < egg.divineOdds ? pickWeighted(egg.pool) : pickWeighted(egg.fallback);
      else species = pickWeighted(egg.pool);
      state.addPet(species);
      results.push({ species, egg });
    }
    this.menus.close();
    this.hatching = true;
    this.input.enabled = false;
    this.preview.playHatch(results, () => {
      this.hatching = false;
      this.input.enabled = true;
      this.pets.sync();
      for (const r of results) {
        const def = PETS[r.species], rar = RARITY[def.rarity];
        if (def.rarity === 'divine') {
          this.hud.toast(`✦ You hatched a <b style="color:${rar.color}">DIVINE ${def.name}</b>! x${rar.power} boost!`, 'gold', 6);
          this.particles.burst(this.player.pos.x, 2, this.player.pos.z, 200, { colors: [0xfff2b0, 0xd9b8ff, 0xffffff], speed: 12, life: 2, size: 0.6, gravity: -3, twinkle: true });
        } else if (rar.order >= 4) this.hud.toast(`🎉 <b style="color:${rar.color}">${rar.name}</b> ${def.name}!`, 'gold', 4);
      }
    });
  }

  onReset() {
    this.dropIfCarrying();
    this.player.respawn();
    this.pets.sync();
    this.treadmills.refresh();
    this.hud.renderEquip();
    this.hud.toast('Progress reset. Fresh start!', 'bad');
  }

  // ── heist ──
  steal(egg) {
    egg.state = 'carried';
    this.scene.add(egg.group);
    egg.group.rotation.set(0, 0, 0);
    egg.group.scale.setScalar(egg.huge ? 1.5 : 0.85);
    this.player.carrying = egg;
    this.player.training = null;
    audio.pickup(egg.huge);
    const wx = egg.vault.cx + egg.nx, wz = egg.vault.cz + egg.nz;
    this.particles.burst(wx, 1.2, wz, egg.huge ? 60 : 24, { colors: [egg.vault.def.color, 0xffffff], speed: 5, life: 0.8 });
    if (egg.huge) this.hud.toast('🌟 You grabbed a <b>HUGE EGG</b>! It\'s heavy — get it home!', 'gold');
  }

  deposit() {
    const egg = this.player.carrying;
    this.player.carrying = null;
    const value = Math.round(this.vaults.value(egg) * this.payoutBonus());
    state.addCash(value);
    state.data.eggsStolen++;
    if (egg.huge) state.data.hugeStolen++;
    state.save();
    egg.state = 'respawning';
    egg.timer = egg.vault.def.respawn;
    egg.group.visible = false;
    egg.vault.group.add(egg.group);
    audio.deposit(egg.huge);
    const p = this.player.pos;
    this.hud.floater(`+$${formatNum(value)}`, new THREE.Vector3(p.x, p.y + 3, p.z), 'cash big', 2);
    this.particles.burst(p.x, 1.5, p.z, egg.huge ? 160 : 60, { colors: [0x7dffa6, 0xffe14a, 0xffffff, egg.vault.def.color], speed: egg.huge ? 13 : 8, life: 1.4, size: 0.5, gravity: -10 });
    if (egg.huge) {
      this.hud.toast(`🌟 HUGE EGG delivered! <b>+$${formatNum(value)}</b> and a FREE ${EGGS.find((e) => e.id === egg.vault.def.hatchEgg).name} hatch!`, 'gold', 5);
      setTimeout(() => this.hatch(egg.vault.def.hatchEgg, 1, true), 900);
    }
    if (this.tutorialStep === 3) this.advanceTutorial();
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
      this.vaults.placeInNest(egg);
      egg.pop = 0;
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
      1: ['👋 Welcome to <b>EGG DASH</b>! Head <b>west</b> (left) to the <b>Training Grounds</b> and stand still on the wooden treadmill to train Speed.', 9],
      2: ['⚡ Speed makes you run faster. Now head <b>north</b> to the <b>Farm Coop</b> and press <b>E</b> on an egg to steal it!', 9],
      3: ['🥚 Bring the egg back to the green <b>Deposit pad</b> in the plaza. Avoid the guard\'s vision cone!', 9],
      4: ['💰 Nice heist! Spend cash on better <b>treadmills</b>, <b>trails</b> and <b>pet eggs</b>. Night falls every 3 minutes — watch for the DIVINE event!', 10],
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
    if (pl.caught || this.hatching || !this.started) return;
    const E = this.input.hit('e') || this.input.hit('enter');
    const kbd = (k) => `<kbd>${k}</kbd>`;

    // deposit
    if (pl.carrying && Math.hypot(P.x - WORLD.deposit.x, P.z - WORLD.deposit.z) < WORLD.deposit.radius + 0.4) { this.deposit(); return; }
    if (pl.carrying) return;

    // eggs
    const egg = this.vaults.nearestEgg(P.x, P.z);
    if (egg) {
      const v = Math.round(this.vaults.value(egg) * this.payoutBonus());
      this.prompt = { text: `${kbd('E')} Steal ${egg.huge ? '<span style="color:#ffe14a">HUGE</span> ' : ''}Egg — $${formatNum(v)}`, cls: egg.huge ? 'good' : '' };
      if (E) this.steal(egg);
      return;
    }
    // divine altar
    if (this.daynight.divine && Math.hypot(P.x - WORLD.altar.x, P.z - WORLD.altar.z) < 6.5) {
      this.prompt = { text: `${kbd('E')} Hatch <span style="color:#ffe9a0">✦ Divine Egg ✦</span> — $${formatNum(DIVINE_EGG.cost)} (${Math.round(DIVINE_EGG.divineOdds * 100)}% DIVINE)`, cls: 'good' };
      if (E) this.hatch('divine', 1);
      return;
    }
    // hatchery pedestals
    for (const ped of this.hub.pedestals) {
      if (Math.hypot(P.x - ped.x, P.z - ped.z) < 3.4) {
        const afford = state.data.cash >= ped.egg.cost;
        this.prompt = { text: `${kbd('E')} Hatch ${ped.egg.name} — $${formatNum(ped.egg.cost)}`, cls: afford ? '' : 'bad' };
        if (E) this.hatch(ped.egg.id, 1);
        return;
      }
    }
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
      const gain = tm.def.speedPerSec * mult;
      const cash = tm.def.cashPerSec * state.petMultiplier();
      this.trainRate = gain;
      state.addSpeed(gain * dt);
      state.addCash(cash * dt);
      this.trainAccum += gain * dt;
      this.trainCash += cash * dt;
      this.trainFloat -= dt;
      if (this.trainFloat <= 0) {
        this.trainFloat = 0.7;
        const p = pl.pos;
        this.hud.floater(`+${formatNum(this.trainAccum)} ⚡`, new THREE.Vector3(p.x, p.y + 2.6, p.z), 'speed', 1.2);
        if (this.trainCash >= 1) this.hud.floater(`+$${formatNum(this.trainCash)}`, new THREE.Vector3(p.x, p.y + 2.0, p.z + 0.5), 'cash', 1.2);
        this.trainAccum = 0; this.trainCash = 0;
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
    this.camTarget.x = damp(this.camTarget.x, tx, 14, dt);
    this.camTarget.y = damp(this.camTarget.y, ty, 8, dt);
    this.camTarget.z = damp(this.camTarget.z, tz, 14, dt);
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
    for (const b of this.colliders.camBoxes) {
      if (y < b.minY || y > b.maxY) continue;
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    }
    return false;
  }

  debugKeys() {
    if (!DEBUG) return;
    const i = this.input;
    if (i.hit('n')) this.daynight.skipToDusk();
    if (i.hit('b')) this.daynight.skipToDawn();
    if (i.hit('v')) { this.daynight.forceDivineNext = true; this.daynight.skipToDusk(); }
    if (i.hit('m')) state.addCash(1e6);
    if (i.hit('k')) state.addSpeed(5000);
    if (i.hit('h')) for (const e of this.vaults.eggs) if (e.state === 'nest') this.vaults.roll(e, true);
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
    this.pets.sync();

    // caught sequence
    if (pl.caught) {
      this.caughtTimer -= dt;
      if (this.caughtTimer <= 0) {
        pl.caught = false;
        pl.respawn();
        this.input.enabled = !this.menus.isOpen && !this.hatching;
        this.particles.burst(pl.pos.x, 1, pl.pos.z, 40, { colors: [0x7fd8ff, 0xffffff], speed: 5, life: 0.8 });
      }
    }

    if (this.started && this.input.pressed.has('escape')) this.menus.close();
    if (this.hatching && (this.input.keys.has('e') || this.input.keys.has(' ') || this.input.keys.has('enter'))) this.preview.skip();

    // player
    let steering = false;
    if (this.started && !pl.caught) steering = pl.update(dt, this.input, this.camYaw, walkSpeedFor(state.data.speed), t);
    else pl.avatar.animate(dt, { speed: 0 });
    pl.safe = Math.hypot(pl.pos.x - WORLD.hub.x, pl.pos.z - WORLD.hub.z) < WORLD.hub.safeRadius && !pl.carrying;
    if (pl.carrying) {
      const egg = pl.carrying;
      egg.group.position.set(pl.pos.x, pl.pos.y + 2.25 + Math.sin(t * 8) * 0.03, pl.pos.z);
      egg.group.rotation.y = pl.yaw;
      if (egg.huge && Math.random() < dt * 25) this.particles.emit({ x: pl.pos.x + (Math.random() - 0.5) * 1.5, y: pl.pos.y + 2.4 + Math.random() * 1.5, z: pl.pos.z + (Math.random() - 0.5) * 1.5, vy: 1, color: Math.random() < 0.5 ? 0xffffff : egg.vault.def.color, size: 0.3, life: 1, intensity: 3, twinkle: true });
    }
    if (pl.jumped) { pl.jumped = false; audio.jump(); }

    this.updateTraining(dt, steering);
    this.updateInteractions(dt);
    this.debugKeys();

    // world systems
    this.daynight.update(dt, pl.pos, t);
    this.vaults.update(dt, t, { pos: pl.pos, carrying: pl.carrying, caught: pl.caught || !this.started, safe: pl.safe }, this.particles, this.daynight.nightFactor);
    this.chasedBy = this.vaults.guards.filter((g) => g.state === 'chase').length;
    for (const tm of this.treadmills.list) tm.near = Math.abs(tm.x - pl.pos.x) < 45 && Math.abs(tm.z - pl.pos.z) < 45;
    this.treadmills.update(dt, t, pl.training?.tier, this.particles);
    this.hub.update(dt, t, this.particles, this.daynight.nightFactor);
    this.world.update(dt, t, this.particles, this.daynight.nightFactor, pl.pos);
    this.pets.update(dt, t, pl, this.particles);
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
  game.preview.prewarm();
  game.hud.renderEquip();
  game.loop();
  loading.textContent = DEBUG ? 'Debug mode: N night • B dawn • V divine • M +$1M • K +5K speed • H huge eggs' : 'Ready!';
  play.disabled = false;
  const go = () => { if (!game.started) game.start(); };
  play.addEventListener('click', go);
  window.addEventListener('keydown', (e) => { if (!game.started && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } });
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').textContent = 'Failed to start: ' + e.message + ' (WebGL required)';
});
