import { state } from '../state.js';
import { TREADMILLS, TRAILS, PETS, RARITY, EGGS, DIVINE_EGG, formatNum, PLAYER, walkSpeedFor } from '../config.js';
import { audio } from '../engine/audio.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

const HEADS = {
  treadmills: { title: '🏃 Treadmills', c1: '#4f8bff', c2: '#2a56d6' },
  trails: { title: '✨ Trails', c1: '#c35cff', c2: '#7a2bd6' },
  pets: { title: '🐾 Pets', c1: '#ff8a3d', c2: '#e0521a' },
  eggs: { title: '🥚 Eggs', c1: '#ff4d8a', c2: '#d01f5c' },
  settings: { title: '⚙️ Settings', c1: '#5d6b86', c2: '#3a4560' },
};

export class Menus {
  constructor(game, preview) {
    this.game = game;
    this.preview = preview;
    this.root = document.getElementById('modal-root');
    this.current = null;
    this.deleteMode = false;
    this.confirmReset = false;
    document.querySelectorAll('.side-btn').forEach((b) => b.addEventListener('click', () => { audio.click(); this.toggle(b.dataset.menu); }));
    document.getElementById('equip-bar').addEventListener('click', (e) => {
      const s = e.target.closest('[data-open]');
      if (s) { audio.click(); this.open(s.dataset.open); }
    });
    // cash/speed tick constantly while training: refresh softly (diffed + throttled) so clicks never get eaten
    state.on((w) => {
      if (!this.current) return;
      if (w === 'cash' || w === 'speed') this.soft = true;
      else this.renderSoon();
    });
    this.pointerDown = false;
    this.softTimer = 0;
    this.root.addEventListener('pointerdown', () => { this.pointerDown = true; });
    window.addEventListener('pointerup', () => { this.pointerDown = false; });
  }

  update(dt) {
    if (!this.current) return;
    this.softTimer -= dt;
    if (!this.soft || this.softTimer > 0 || this.pointerDown) return;
    this.soft = false;
    this.softTimer = 0.35;
    const sub = this.root.querySelector('.modal-head .sub');
    if (sub) sub.textContent = `💰 $${formatNum(state.data.cash)}`;
    if (this[this.current]() !== this.lastBody) this.render(false);
  }

  get isOpen() { return !!this.current; }

  toggle(name) { if (this.current === name) this.close(); else this.open(name); }

  open(name) {
    this.current = name;
    this.deleteMode = false;
    this.confirmReset = false;
    this.render(true);
    this.game.input.enabled = false;
  }

  close() {
    this.current = null;
    this.root.innerHTML = '';
    this.game.input.enabled = true;
  }

  renderSoon() {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = null; if (this.current) this.render(false); });
  }

  render(fresh) {
    const h = HEADS[this.current];
    const body = this[this.current]();
    this.lastBody = body;
    const scroll = this.root.querySelector('.modal-body')?.scrollTop || 0;
    this.root.innerHTML = `
      <div class="modal-backdrop" data-act="backdrop">
        <div class="modal" style="--c1:${h.c1};--c2:${h.c2}">
          <div class="modal-head"><h2>${h.title}</h2><div class="sub">💰 $${formatNum(state.data.cash)}</div><button class="close-btn" data-act="close">✕</button></div>
          <div class="modal-body">${body}</div>
        </div>
      </div>`;
    if (!fresh) this.root.querySelector('.modal-body').scrollTop = scroll;
    if (fresh) this.root.querySelector('.modal').style.animation = '';
    else this.root.querySelector('.modal').style.animation = 'none';
    this.root.querySelector('.modal-backdrop').addEventListener('click', (e) => this.onClick(e));
    this.root.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', (e) => this.onRange(e)));
  }

  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'backdrop' && e.target !== t) return;
    const arg = t.dataset.arg;
    const g = this.game;
    switch (act) {
      case 'backdrop': case 'close': audio.click(); this.close(); return;
      case 'buy-tm': g.buyTreadmill(+arg); break;
      case 'go-tm': audio.click(); g.teleportToTreadmill(+arg); this.close(); return;
      case 'buy-trail': g.buyTrail(arg); break;
      case 'equip-trail': audio.click(); state.data.trail = arg; state.save(); state.emit('trail'); break;
      case 'pet':
        if (this.deleteMode) {
          if (state.data.pets.length <= 1) { audio.error(); return; }
          state.deletePet(+arg); audio.click();
        } else if (!state.toggleEquip(+arg)) { audio.error(); g.hud.toast(`Max ${PLAYER.maxEquippedPets} pets equipped — unequip one first`, 'bad'); }
        else audio.click();
        break;
      case 'equip-best': state.equipBest(); audio.purchase(); break;
      case 'delete-mode': this.deleteMode = !this.deleteMode; audio.click(); this.render(false); break;
      case 'hatch': g.hatch(arg, +t.dataset.n || 1); break;
      case 'quality': state.data.settings.quality = arg; state.save(); g.renderer.setQuality(arg); audio.click(); this.render(false); break;
      case 'fps': state.data.settings.showFps = !state.data.settings.showFps; state.save(); audio.click(); this.render(false); break;
      case 'reset':
        if (!this.confirmReset) { this.confirmReset = true; audio.error(); this.render(false); return; }
        state.reset(); g.onReset(); this.close(); return;
    }
  }

  onRange(e) {
    const k = e.target.dataset.setting;
    state.data.settings[k] = +e.target.value;
    state.save();
    audio.applyVolumes();
  }

  // ── panels ──
  treadmills() {
    const d = state.data;
    const mult = state.trainingMultiplier();
    const cards = TREADMILLS.map((t) => {
      const owned = d.treadmills[t.tier - 1];
      const prevOwned = t.tier === 1 || d.treadmills[t.tier - 2];
      const afford = d.cash >= t.cost;
      const bg = `linear-gradient(135deg, ${hex(t.frame)}, ${hex(t.accent)} 70%, ${hex(t.belt)})`;
      let btns;
      if (owned) btns = `<button class="btn blue" data-act="go-tm" data-arg="${t.tier}">Go train ➜</button>`;
      else if (!prevOwned) btns = `<button class="btn gray" disabled>🔒 Buy Tier ${t.tier - 1} first</button>`;
      else btns = `<button class="btn ${afford ? '' : 'gray'}" data-act="buy-tm" data-arg="${t.tier}" ${afford ? '' : 'disabled'}>Buy $${formatNum(t.cost)}</button>
                   <button class="btn blue" data-act="go-tm" data-arg="${t.tier}" title="Teleport">📍</button>`;
      return `<div class="card ${owned ? 'owned' : 'locked'}">
        <div class="swatch" style="background:${bg};${t.glow > 1 ? `box-shadow: inset 0 0 20px ${hex(t.accent)}` : ''}"><span class="tier">T${t.tier}</span></div>
        <h3>${t.name}</h3>
        <div class="meta">⚡ <b>+${formatNum(t.speedPerSec)}</b>/s <span style="opacity:.7">(→ ${formatNum(t.speedPerSec * mult)} with boosts)</span></div>
        <div class="meta">💰 <b>+$${formatNum(t.cashPerSec)}</b>/s while training</div>
        <div class="row">${btns}</div>
      </div>`;
    }).join('');
    return `<div class="toolbar"><span class="chip">⚡ Speed ${formatNum(d.speed)}</span><span class="chip">👟 Walk ${walkSpeedFor(d.speed).toFixed(1)}</span><span class="chip">✖️ Training x${formatNum(mult)}</span>
      <span class="spacer"></span><span class="chip">Stand still on a treadmill to train</span></div><div class="grid">${cards}</div>`;
  }

  trails() {
    const d = state.data;
    const cards = TRAILS.map((t) => {
      const owned = d.trails.includes(t.id);
      const eq = d.trail === t.id;
      const afford = d.cash >= t.cost;
      const bg = t.colors.length ? `linear-gradient(135deg, ${t.colors.map(hex).join(',')})` : 'rgba(255,255,255,.05)';
      const btn = eq ? `<button class="btn gold" disabled>Equipped</button>`
        : owned ? `<button class="btn blue" data-act="equip-trail" data-arg="${t.id}">Equip</button>`
        : `<button class="btn ${afford ? '' : 'gray'}" data-act="buy-trail" data-arg="${t.id}" ${afford ? '' : 'disabled'}>Buy $${formatNum(t.cost)}</button>`;
      return `<div class="card ${eq ? 'equipped' : owned ? 'owned' : ''}">
        <div class="swatch" style="background:${bg};${t.colors.length ? `box-shadow: inset 0 0 24px rgba(255,255,255,.4)` : ''}"><span class="tier">x${t.mult}</span></div>
        <h3>${t.name}</h3>
        <div class="meta">Training speed <b>x${t.mult}</b></div>
        <div class="row">${btn}</div>
      </div>`;
    }).join('');
    return `<div class="toolbar"><span class="chip">Trails multiply all treadmill gains</span></div><div class="grid">${cards}</div>`;
  }

  pets() {
    const d = state.data;
    if (!d.pets.length) return `<div style="text-align:center;padding:30px;font-weight:700">No pets yet! Visit the <b>Hatchery</b> or open the 🥚 Eggs menu to hatch one.<br><br><button class="btn pink" data-act="hatch" data-arg="basic">Hatch Basic Egg — $${formatNum(EGGS[0].cost)}</button></div>`;
    const power = (p) => RARITY[PETS[p.species].rarity].power;
    const sorted = [...d.pets].sort((a, b) => (d.equipped.includes(b.uid) - d.equipped.includes(a.uid)) || power(b) - power(a) || b.uid - a.uid);
    const cards = sorted.map((p) => {
      const def = PETS[p.species], r = RARITY[def.rarity];
      const eq = d.equipped.includes(p.uid);
      return `<div class="card pet-card ${eq ? 'equipped' : ''} ${def.rarity === 'divine' ? 'divine' : ''} ${this.deleteMode ? 'delete-mode' : ''}" data-act="pet" data-arg="${p.uid}" style="border-color:${eq ? '' : r.color + '66'}">
        ${eq ? '<div class="eq-badge">EQUIPPED</div>' : ''}
        <img src="${this.preview.thumb(p.species)}" alt="">
        <div class="rar" style="color:${r.color}">${r.name}</div>
        <h3 style="font-size:15px">${def.name}</h3>
        <div class="meta">x${r.power} boost</div>
      </div>`;
    }).join('');
    return `<div class="toolbar">
        <span class="chip">Equipped ${d.equipped.length}/${PLAYER.maxEquippedPets}</span>
        <span class="chip">Pet boost x${state.petMultiplier().toFixed(2)} (speed & cash)</span>
        <span class="spacer"></span>
        <button class="btn gold" data-act="equip-best">⭐ Equip Best</button>
        <button class="btn ${this.deleteMode ? 'red' : 'gray'}" data-act="delete-mode">${this.deleteMode ? 'Done deleting' : '🗑 Delete'}</button>
      </div>
      ${this.deleteMode ? '<div class="chip" style="margin-bottom:10px;background:rgba(255,80,100,.25)">Click a pet to delete it permanently</div>' : ''}
      <div class="grid pets-grid">${cards}</div>`;
  }

  eggs() {
    const d = state.data;
    const list = [...EGGS];
    const divine = this.game.daynight.divine;
    const cards = (divine ? [DIVINE_EGG, ...list] : list).map((e) => {
      const isDiv = e.id === 'divine';
      const total = Object.values(e.pool).reduce((a, b) => a + b, 0);
      let odds;
      if (isDiv) {
        odds = `<span style="color:${RARITY.divine.color}">✦ Any DIVINE pet</span><span>${Math.round(e.divineOdds * 100)}%</span><span style="color:${RARITY.legendary.color}">Legendary pet</span><span>${Math.round((1 - e.divineOdds) * 100)}%</span>`;
      } else odds = Object.entries(e.pool).map(([s, w]) => `<span style="color:${RARITY[PETS[s].rarity].color}">${PETS[s].name}</span><span>${(w / total * 100).toFixed(w / total < 0.1 ? 1 : 0)}%</span>`).join('');
      const afford = d.cash >= e.cost, afford3 = d.cash >= e.cost * 3;
      return `<div class="card egg-card ${isDiv ? 'equipped' : ''}" style="${isDiv ? 'background:linear-gradient(160deg, rgba(255,230,140,.25), rgba(170,120,255,.25))' : ''}">
        <div class="egg-art"><img src="${this.preview.eggThumb(e)}" alt=""></div>
        <h3 style="text-align:center">${e.name}${isDiv ? ' <span style="font-size:12px">(tonight only!)</span>' : ''}</h3>
        <div class="odds">${odds}</div>
        <div class="row">
          <button class="btn ${afford ? 'pink' : 'gray'}" data-act="hatch" data-arg="${e.id}" data-n="1" ${afford ? '' : 'disabled'}>Hatch $${formatNum(e.cost)}</button>
          <button class="btn ${afford3 ? 'pink' : 'gray'}" data-act="hatch" data-arg="${e.id}" data-n="3" ${afford3 ? '' : 'disabled'}>x3</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="toolbar"><span class="chip">${divine ? '🌟 A DIVINE EGG is available tonight — also hatch it at the altar!' : '🌙 Divine Eggs can only appear during a rare DIVINE night (1/30 nights)'}</span></div><div class="grid">${cards}</div>`;
  }

  settings() {
    const s = state.data.settings, d = state.data;
    const q = (k, label) => `<button class="${s.quality === k ? 'on' : ''}" data-act="quality" data-arg="${k}">${label}</button>`;
    return `<div class="settings-list">
      <div class="setting">Graphics quality <div class="seg">${q('auto', 'Auto')}${q('low', 'Low')}${q('medium', 'Medium')}${q('high', 'High (AO)')}${q('ultra', 'Ultra')}</div></div>
      <div class="setting">Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-setting="music"></div>
      <div class="setting">Sound effects <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-setting="sfx"></div>
      <div class="setting">Show FPS <div class="seg"><button class="${s.showFps ? 'on' : ''}" data-act="fps">${s.showFps ? 'On' : 'Off'}</button></div></div>
      <div class="stats-table">
        <span>Total cash earned</span><span>$${formatNum(d.totalEarned)}</span>
        <span>Eggs stolen</span><span>${formatNum(d.eggsStolen)}</span>
        <span>HUGE eggs stolen</span><span>${formatNum(d.hugeStolen)}</span>
        <span>Times busted</span><span>${formatNum(d.timesCaught)}</span>
        <span>Pets hatched</span><span>${formatNum(d.hatched)}</span>
        <span>Divine pets owned</span><span>${d.pets.filter((p) => PETS[p.species].rarity === 'divine').length}</span>
      </div>
      <div class="setting">Progress is saved automatically in this browser.
        <button class="btn red" style="flex:0 0 auto" data-act="reset">${this.confirmReset ? 'Click again to confirm' : 'Reset progress'}</button></div>
    </div>`;
  }
}
