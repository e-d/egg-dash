import * as THREE from 'three';
import { state } from '../state.js';
import { formatNum, PETS, RARITY, TRAILS, ZONES, LANE, WORLD, CYCLE, PLOT_COUNT, DCOIN_REWARD, SHOP_ITEMS, walkSpeedFor } from '../config.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export class HUD {
  constructor(preview) {
    this.preview = preview;
    this.el = {
      cycle: $('cycle'), cycleIcon: $('cycle-icon'), cycleLabel: $('cycle-label'), cycleTime: $('cycle-time'), cycleFill: $('cycle-fill'), divineTag: $('divine-tag'),
      cash: $('stat-cash'), speed: $('stat-speed'), speedRate: $('stat-speed-rate'), walk: $('stat-walk'), income: $('stat-income'),
      equip: $('equip-bar'), prompt: $('prompt'), carry: $('carry-banner'), toasts: $('toasts'), floaters: $('floaters'),
      banner: $('event-banner'), busted: $('busted'), vignette: $('vignette'), fps: $('fps'), minimap: $('minimap'), hint: $('help-hint'),
      laneBar: $('lane-bar'), laneTrack: $('lane-track'), laneDot: $('lane-dot'), laneLabel: $('lane-label'),
      dcoins: $('stat-dcoins'), dtimer: $('stat-dtimer'), boosts: $('boosts'), slowBtn: $('slow-btn'),
    };
    this.walkStat = this.el.walk.parentElement;
    this.mm = this.el.minimap.getContext('2d');
    this.floaters = [];
    this.last = {};
    this.fpsAcc = 0; this.fpsN = 0;
    this.speedRate = 0;
    state.on((w) => { if (w === 'plots' || w === 'trail' || w === 'reset') this.renderEquip(); });
    this.renderEquip();
    // lane progress bar: one coloured segment per zone
    const span = LANE.start - LANE.end;
    this.el.laneTrack.innerHTML = ZONES.map((z) => {
      const left = ((LANE.start - z.z0) / span) * 100, w = ((z.z0 - z.z1) / span) * 100;
      return `<div class="seg" style="left:${left}%;width:${w}%;background:#${z.trim.toString(16).padStart(6, '0')}" title="${z.name}"></div>`;
    }).join('');
    setTimeout(() => { this.el.hint.style.opacity = '0'; }, 25000);
  }

  renderEquip() {
    const d = state.data;
    const slots = [];
    // best earners on the base, then the trail
    const pets = d.plots.filter((p) => p && p.hatchLeft <= 0).sort((a, b) => state.plotIncome(b) - state.plotIncome(a)).slice(0, 3);
    for (let i = 0; i < 3; i++) {
      const p = pets[i];
      if (p) {
        const def = PETS[p.species], r = RARITY[def.rarity];
        slots.push(`<div class="eq-slot filled ${def.rarity === 'divine' ? 'divine' : ''}" style="--rc:${r.color}" data-open="pets" title="${p.huge ? 'HUGE ' : ''}${def.name} (${r.name})"><img src="${this.preview.thumb(p.species)}" alt=""><div class="tag" style="color:#7dffa6">$${formatNum(state.plotIncome(p))}/s</div></div>`);
      } else slots.push(`<div class="eq-slot" data-open="pets" title="Empty">🐾</div>`);
    }
    const used = d.plots.filter(Boolean).length;
    slots.push(`<div class="eq-slot trail filled" data-open="pets" style="--rc:#7dffa6"><div class="txt-outline">🏠 Base<br>${used}/${PLOT_COUNT}</div></div>`);
    const trail = TRAILS.find((t) => t.id === d.trail);
    const grad = trail.colors.length ? `linear-gradient(135deg, ${trail.colors.map((c) => '#' + c.toString(16).padStart(6, '0')).join(',')})` : 'rgba(255,255,255,.07)';
    slots.push('<div class="eq-sep"></div>');
    slots.push(`<div class="eq-slot trail filled" data-open="trails" style="--rc:#fff;background:${grad}"><div class="txt-outline">${trail.name}<br>x${trail.mult}</div></div>`);
    this.el.equip.innerHTML = slots.join('');
  }

  update(dt, game) {
    const d = state.data;
    const dn = game.daynight;
    // cycle
    const cd = Math.max(0, Math.ceil(dn.countdown));
    const mm = Math.floor(cd / 60), ss = String(cd % 60).padStart(2, '0');
    this.setText('cycleTime', `${mm}:${ss}`);
    this.setText('cycleLabel', dn.isNight ? (dn.divine ? 'DIVINE NIGHT • DAWN IN' : 'DAWN IN') : 'NIGHT IN');
    this.setText('cycleIcon', dn.isNight ? (dn.divine ? '🌟' : '🌙') : (dn.countdown < CYCLE.dusk ? '🌇' : '☀️'));
    const frac = dn.isNight ? (dn.time - CYCLE.nightStart) / (CYCLE.length - CYCLE.nightStart) : dn.time / CYCLE.nightStart;
    this.el.cycleFill.style.width = (frac * 100).toFixed(1) + '%';
    const cls = dn.isNight ? (dn.divine ? 'pill night divine' : 'pill night') : 'pill';
    if (this.el.cycle.className !== cls) this.el.cycle.className = cls;
    this.el.divineTag.classList.toggle('hidden', !dn.divine);

    // stats
    this.setText('cash', '$' + formatNum(d.cash), 'cash');
    this.setText('speed', formatNum(d.speed));
    this.setText('speedRate', game.player.training ? `+${formatNum(game.trainRate)}/s` : '');
    const walk = game.currentWalk();
    this.setText('walk', game.slowMode ? `${walk} 🐢` : walk < 100 ? walk.toFixed(1) : Math.round(walk).toString());
    this.walkStat.classList.toggle('slow', game.slowMode);
    this.el.slowBtn.classList.toggle('on', game.slowMode);
    this.setText('slowState', game.slowMode ? 'ON' : 'OFF');
    this.setText('income', '$' + formatNum(state.incomePerSec()) + '/s');
    this.setText('dcoins', formatNum(d.dcoins), 'dcoins');
    const left = Math.max(0, Math.ceil(DCOIN_REWARD.every - d.dcoinTimer));
    this.setText('dtimer', `+${DCOIN_REWARD.amount} in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.renderBoosts(d);

    // prompt
    const pr = game.prompt;
    const key = pr ? pr.text + (pr.cls || '') : '';
    if (key !== this.last.prompt) {
      this.last.prompt = key;
      if (pr) { this.el.prompt.innerHTML = pr.text; this.el.prompt.className = pr.cls || ''; }
      else this.el.prompt.className = 'hidden';
    }

    // carry banner
    const c = game.player.carrying;
    const chased = game.chasedBy > 0;
    let ck = '';
    if (c) {
      const full = state.freePlot() < 0;
      const what = c.divine ? `✦ ${c.zone.def.name} DIVINE Egg` : `${c.huge ? '🌟 HUGE ' : '🥚 '}${c.zone.def.name} Egg`;
      ck = `${what} • ${full ? 'Base full! Swap it with a pet on any pad' : 'Run it home to an empty pad!'}${chased ? ' 🚨' : ''}`;
    }
    if (ck !== this.last.carry) {
      this.last.carry = ck;
      this.el.carry.textContent = ck;
      this.el.carry.className = c ? (chased ? 'chased' : c.huge ? 'huge' : '') : 'hidden';
    }
    this.el.vignette.className = chased ? 'chased' : '';

    // lane progress
    const P = game.player.pos;
    const inLane = P.z < LANE.start + 4;
    this.el.laneBar.classList.toggle('hidden', !inLane);
    if (inLane) {
      const k = Math.min(1, Math.max(0, (LANE.start - P.z) / (LANE.start - LANE.end)));
      this.el.laneDot.style.left = `calc(10px + ${k.toFixed(4)} * (100% - 20px))`;
      const zn = game.lane.zoneAt(P.z, 0);
      const dist = Math.round(LANE.start - P.z);
      this.setText('laneLabel', zn ? `${zn.def.emoji} Land ${zn.index + 1}: ${zn.def.name} • ${dist}m from base • Guardians run ${zn.def.guardSpeed}` : `${dist}m from base`);
    }

    // floaters
    this.updateFloaters(dt, game.renderer.camera);

    // fps
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.el.fps.textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps • ${game.renderer.level}`;
      this.fpsAcc = 0; this.fpsN = 0;
    }
    this.el.fps.classList.toggle('hidden', !d.settings.showFps);

    this.drawMinimap(game);
  }

  renderBoosts(d) {
    const parts = Object.entries(d.boosts).map(([b, secs]) => {
      const it = SHOP_ITEMS.find((i) => i.boost === b);
      const s = Math.ceil(secs);
      return it ? `<div class="boost-chip"><span class="bi">${it.icon}</span>${it.name}<small>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</small></div>` : '';
    });
    const html = parts.join('');
    if (html !== this.last.boosts) { this.last.boosts = html; this.el.boosts.innerHTML = html; }
  }

  setText(k, v, bumpClass) {
    if (this.last[k] === v) return;
    this.last[k] = v;
    if (k === 'slowState') { this.el.slowBtn.querySelector('.slow-state').textContent = v; return; }
    this.el[k].textContent = v;
    if (bumpClass) {
      const s = this.el[k].parentElement;
      s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
    }
  }

  toast(html, cls = '', life = 3) {
    const t = document.createElement('div');
    t.className = 'toast ' + cls;
    t.style.setProperty('--life', life + 's');
    t.innerHTML = html;
    this.el.toasts.appendChild(t);
    setTimeout(() => t.remove(), (life + 0.5) * 1000);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }

  floater(text, worldPos, cls = '', life = 1.4) {
    if (this.floaters.length > 40) return;
    const e = document.createElement('div');
    e.className = 'floater ' + cls;
    e.textContent = text;
    this.el.floaters.appendChild(e);
    this.floaters.push({ e, p: worldPos.clone(), t: 0, life, dx: (Math.random() - 0.5) * 40 });
  }

  updateFloaters(dt, camera) {
    const w = window.innerWidth, h = window.innerHeight;
    this.floaters = this.floaters.filter((f) => {
      f.t += dt;
      if (f.t > f.life) { f.e.remove(); return false; }
      _v.copy(f.p); _v.y += f.t * 1.6;
      _v.project(camera);
      if (_v.z > 1) { f.e.style.opacity = 0; return true; }
      const x = (_v.x * 0.5 + 0.5) * w + f.dx * f.t, y = (-_v.y * 0.5 + 0.5) * h;
      const k = f.t / f.life;
      const s = k < 0.15 ? 0.6 + k / 0.15 * 0.5 : 1.1 - (k - 0.15) * 0.15;
      f.e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
      f.e.style.left = '0'; f.e.style.top = '0';
      f.e.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      return true;
    });
  }

  banner(html, cls, ms = 3600) {
    const b = this.el.banner;
    b.className = 'hidden';
    void b.offsetWidth;
    b.innerHTML = html;
    b.className = cls;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => { b.className = 'hidden'; }, ms);
  }

  busted(reason, hadEgg) {
    const b = this.el.busted;
    b.querySelector('small').textContent = `A Guardian caught you! ${hadEgg ? 'The egg went back to its pedestal. Train more Speed to outrun them!' : 'Back to base you go.'}`;
    b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden');
    clearTimeout(this.bustT);
    this.bustT = setTimeout(() => b.classList.add('hidden'), 1400);
  }

  drawMinimap(game) {
    const g = this.mm;
    const W = 200, R = 100;
    const P = game.player.pos;
    // zoom out as you get faster so the map always shows what's coming
    const scale = Math.max(0.12, 0.9 * Math.min(1, 24 / game.currentWalk())); // px per world unit
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    const night = game.daynight.nightFactor;
    g.fillStyle = night > 0.5 ? '#1a3a2a' : '#3f9a4a';
    g.fillRect(0, 0, W, W);
    g.translate(R, R);
    g.rotate(game.camYaw);
    g.translate(-P.x * scale, -P.z * scale);
    const box = (x, z, w, h, col) => { g.fillStyle = col; g.fillRect((x - w / 2) * scale, (z - h / 2) * scale, w * scale, h * scale); };
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    g.fillStyle = '#d9c9a3';
    g.beginPath(); g.arc(0, 0, 30 * scale, 0, Math.PI * 2); g.fill();
    box(-78, 0, 76, 74, '#34405c');
    g.fillStyle = '#7a5cff'; g.beginPath(); g.arc(50 * scale, 30 * scale, 6 * scale, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2fa6e8'; g.beginPath(); g.arc(64 * scale, 72 * scale, 16 * scale, 0, Math.PI * 2); g.fill();
    // the lane
    box(0, (LANE.start + LANE.end) / 2, LANE.halfW * 2 + 2, LANE.start - LANE.end, '#bfb39a');
    for (const z of ZONES) box(0, (z.z0 + z.z1) / 2, LANE.halfW * 2, z.z0 - z.z1, hex(z.floor));
    for (const t of game.treadmills.list) box(t.x, t.z, 6.4, 3.2, t.owned ? hex(t.def.accent) : '#555c70');
    // base pads
    state.data.plots.forEach((p, i) => {
      const pad = game.base.pads[i];
      g.fillStyle = !p ? '#3dff7a' : p.hatchLeft > 0 ? '#ffd23f' : RARITY[PETS[p.species].rarity].color;
      g.beginPath(); g.arc(pad.x * scale, pad.z * scale, Math.max(2, 2.2 * scale), 0, Math.PI * 2); g.fill();
    });
    // special eggs
    for (const e of game.lane.eggs) {
      if (e.state !== 'nest' || !(e.huge || e.divine)) continue;
      g.fillStyle = e.divine ? hex(e.zone.def.trim) : '#ffe14a';
      g.beginPath(); g.arc(e.x * scale, e.z * scale, e.divine ? 4.5 : 3.5, 0, Math.PI * 2); g.fill();
    }
    for (const gd of game.lane.guards) {
      const awake = gd.state === 'chase' || gd.state === 'waking';
      g.fillStyle = awake ? '#ff2a3a' : gd.state === 'sleep' ? 'rgba(200,190,255,.55)' : '#ff9aa4';
      g.beginPath(); g.arc(gd.pos.x * scale, gd.pos.z * scale, awake ? 4 : 2.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // player arrow (center)
    g.save();
    g.translate(R, R);
    g.rotate(game.camYaw - game.player.yaw + Math.PI);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // N marker
    g.save();
    g.translate(R, R);
    g.rotate(game.camYaw);
    g.fillStyle = '#fff'; g.font = '900 14px Lilita One, sans-serif'; g.textAlign = 'center';
    g.fillText('N', 0, -R + 16);
    g.restore();
  }
}
