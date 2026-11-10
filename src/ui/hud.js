import * as THREE from 'three';
import { state } from '../state.js';
import { formatNum, PETS, RARITY, TRAILS, VAULTS, WORLD, CYCLE, walkSpeedFor } from '../config.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();

export class HUD {
  constructor(preview) {
    this.preview = preview;
    this.el = {
      cycle: $('cycle'), cycleIcon: $('cycle-icon'), cycleLabel: $('cycle-label'), cycleTime: $('cycle-time'), cycleFill: $('cycle-fill'), divineTag: $('divine-tag'),
      cash: $('stat-cash'), speed: $('stat-speed'), speedRate: $('stat-speed-rate'), walk: $('stat-walk'), mult: $('stat-mult'),
      equip: $('equip-bar'), prompt: $('prompt'), carry: $('carry-banner'), toasts: $('toasts'), floaters: $('floaters'),
      banner: $('event-banner'), busted: $('busted'), vignette: $('vignette'), fps: $('fps'), minimap: $('minimap'), hint: $('help-hint'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.floaters = [];
    this.last = {};
    this.fpsAcc = 0; this.fpsN = 0;
    this.speedRate = 0;
    state.on((w) => { if (w === 'pets' || w === 'trail' || w === 'reset') this.renderEquip(); });
    this.renderEquip();
    setTimeout(() => { this.el.hint.style.opacity = '0'; }, 25000);
  }

  renderEquip() {
    const d = state.data;
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const uid = d.equipped[i];
      const p = uid && d.pets.find((x) => x.uid === uid);
      if (p) {
        const def = PETS[p.species], r = RARITY[def.rarity];
        slots.push(`<div class="eq-slot filled ${def.rarity === 'divine' ? 'divine' : ''}" style="--rc:${r.color}" data-open="pets" title="${def.name} (${r.name})"><img src="${this.preview.thumb(p.species)}" alt=""><div class="tag" style="color:${r.color}">x${r.power}</div></div>`);
      } else slots.push(`<div class="eq-slot" data-open="pets" title="Empty pet slot">🐾</div>`);
    }
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
    this.setText('walk', walkSpeedFor(d.speed).toFixed(1));
    this.setText('mult', 'x' + formatNum(state.trainingMultiplier()));

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
    if (c) ck = `${c.huge ? '🌟 HUGE ' : '🥚 '}${c.vault.def.name.replace(/^(The )/, '')} Egg — $${formatNum(game.vaults.value(c) * game.payoutBonus())} • Run to the Deposit pad!${chased ? ' 🚨' : ''}`;
    if (ck !== this.last.carry) {
      this.last.carry = ck;
      this.el.carry.textContent = ck;
      this.el.carry.className = c ? (chased ? 'chased' : c.huge ? 'huge' : '') : 'hidden';
    }
    this.el.vignette.className = chased ? 'chased' : '';

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

  setText(k, v, bumpClass) {
    if (this.last[k] === v) return;
    this.last[k] = v;
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
    const who = reason === 'laser' ? 'Zapped by a laser!' : 'A guard caught you!';
    b.querySelector('small').textContent = `${who} ${hadEgg ? 'The egg went back to its nest.' : 'Back to base you go.'}`;
    b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden');
    clearTimeout(this.bustT);
    this.bustT = setTimeout(() => b.classList.add('hidden'), 1400);
  }

  drawMinimap(game) {
    const g = this.mm;
    const W = 200, R = 100;
    const P = game.player.pos;
    const scale = 0.9; // px per world unit
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
    const night = game.daynight.nightFactor;
    g.fillStyle = night > 0.5 ? '#1a3a2a' : '#3f9a4a';
    g.fillRect(0, 0, W, W);
    g.translate(R, R);
    // rotate so camera-forward is up
    g.rotate(game.camYaw);
    g.translate(-P.x * scale, -P.z * scale);
    const box = (x, z, w, h, col) => { g.fillStyle = col; g.fillRect((x - w / 2) * scale, (z - h / 2) * scale, w * scale, h * scale); };
    // paths & plaza
    g.fillStyle = '#d9c9a3';
    g.beginPath(); g.arc(0, 0, 30 * scale, 0, Math.PI * 2); g.fill();
    box(-78, 0, 76, 74, '#34405c');
    box(52, -2, 14, 30, '#ff8fb8');
    g.fillStyle = '#7a5cff'; g.beginPath(); g.arc(50 * scale, 30 * scale, 6 * scale, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2fa6e8'; g.beginPath(); g.arc(64 * scale, 72 * scale, 16 * scale, 0, Math.PI * 2); g.fill();
    for (const v of VAULTS) {
      box(v.x, v.z, v.size, v.size, '#' + v.wall.toString(16).padStart(6, '0'));
      box(v.x, v.z, v.size - 2, v.size - 2, '#' + v.floor.toString(16).padStart(6, '0'));
    }
    // treadmills
    for (const t of game.treadmills.list) box(t.x, t.z, 6.4, 3.2, t.owned ? '#' + t.def.accent.toString(16).padStart(6, '0') : '#555c70');
    // deposit
    g.fillStyle = '#3dff7a'; g.beginPath(); g.arc(WORLD.deposit.x * scale, WORLD.deposit.z * scale, 5, 0, Math.PI * 2); g.fill();
    if (game.daynight.divine) { g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(WORLD.altar.x * scale, WORLD.altar.z * scale, 6 + Math.sin(performance.now() / 150) * 2, 0, Math.PI * 2); g.fill(); }
    // huge eggs
    for (const e of game.vaults.eggs) {
      if (e.state !== 'nest' || !e.huge) continue;
      g.fillStyle = '#ffe14a';
      g.beginPath(); g.arc((e.vault.cx + e.nx) * scale, (e.vault.cz + e.nz) * scale, 3.5, 0, Math.PI * 2); g.fill();
    }
    // guards
    for (const gd of game.vaults.guards) {
      g.fillStyle = gd.state === 'chase' ? '#ff2a3a' : '#ff9aa4';
      g.beginPath(); g.arc(gd.pos.x * scale, gd.pos.z * scale, 3, 0, Math.PI * 2); g.fill();
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
