// Fully synthesized audio (no asset files): SFX + a gentle generative soundtrack.
import { state } from '../state.js';

class Audio {
  constructor() {
    this.ctx = null;
    this.musicTimer = 0;
    this.step = 0;
    this.isNight = false;
    this.divine = false;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
    // simple feedback delay for a spacious feel
    this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = 0.32;
    const fb = this.ctx.createGain(); fb.gain.value = 0.32;
    const wet = this.ctx.createGain(); wet.gain.value = 0.35;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(wet); wet.connect(this.master);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = state.data.settings.sfx;
    this.musicBus.gain.value = state.data.settings.music * 0.55;
  }

  tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.2, attack = 0.005, slide = 0, delay = 0, bus, echo = false }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, filter = 1200, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t);
  }

  // ── SFX library ──
  click() { this.tone({ freq: 880, type: 'triangle', dur: 0.06, vol: 0.12 }); }
  error() { this.tone({ freq: 220, type: 'square', dur: 0.12, vol: 0.08 }); this.tone({ freq: 160, type: 'square', dur: 0.16, vol: 0.08, delay: 0.09 }); }
  purchase() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.14, delay: i * 0.06, echo: true })); }
  coin(pitch = 1) { this.tone({ freq: 988 * pitch, type: 'square', dur: 0.08, vol: 0.07 }); this.tone({ freq: 1319 * pitch, type: 'square', dur: 0.22, vol: 0.07, delay: 0.07 }); }
  pickup(huge) {
    this.tone({ freq: huge ? 330 : 440, type: 'triangle', dur: 0.25, vol: 0.18, slide: 2 });
    if (huge) [659, 880, 1175].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.4, vol: 0.1, delay: 0.1 + i * 0.07, echo: true }));
  }
  deposit(huge) {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.12, vol: 0.06, delay: i * 0.05 }));
    this.noise({ dur: 0.3, vol: 0.05, filter: 6000, delay: 0.05 });
    if (huge) [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.1, delay: 0.25 + i * 0.08, echo: true }));
  }
  alert() { this.tone({ freq: 1200, type: 'square', dur: 0.09, vol: 0.08 }); this.tone({ freq: 1500, type: 'square', dur: 0.12, vol: 0.08, delay: 0.1 }); }
  busted() {
    this.tone({ freq: 600, type: 'sawtooth', dur: 0.7, vol: 0.13, slide: 0.25 });
    this.tone({ freq: 300, type: 'square', dur: 0.5, vol: 0.08, slide: 0.4, delay: 0.1 });
    this.noise({ dur: 0.4, vol: 0.12, filter: 900 });
  }
  jump() { this.tone({ freq: 300, type: 'sine', dur: 0.15, vol: 0.06, slide: 1.8 }); }
  laserHum() { this.tone({ freq: 90, type: 'sawtooth', dur: 0.2, vol: 0.02 }); }
  shake(i) { this.tone({ freq: 200 + i * 40, type: 'triangle', dur: 0.07, vol: 0.12 }); this.noise({ dur: 0.05, vol: 0.05, filter: 2000 }); }
  reveal(rarityOrder) {
    const base = [523, 659, 784, 1046, 1318, 1568];
    base.slice(0, 3 + Math.min(3, rarityOrder)).forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.6, vol: 0.12, delay: i * 0.07, echo: true }));
    if (rarityOrder >= 5) {
      [1046, 1318, 1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 1.6, vol: 0.08, delay: 0.4 + i * 0.12, echo: true }));
      this.noise({ dur: 1.2, vol: 0.06, filter: 8000, delay: 0.3 });
    }
  }
  night() { [196, 247, 294].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 2.5, vol: 0.09, attack: 0.8, delay: i * 0.15, echo: true })); }
  day() { [392, 494, 587, 784].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.8, vol: 0.08, delay: i * 0.1, echo: true })); }
  divineEvent() {
    [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 1.8, vol: 0.09, delay: i * 0.11, echo: true }));
    [130.8, 196].forEach((f) => this.tone({ freq: f, type: 'sawtooth', dur: 3, vol: 0.04, attack: 1 }));
  }
  levelUp() { [659, 784, 988, 1318].forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.12, vol: 0.05, delay: i * 0.04 })); }

  // ── generative music: soft pad chords + pentatonic pluck ──
  update(dt) {
    if (!this.ctx || state.data.settings.music <= 0) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const bpm = this.isNight ? 84 : 104;
    const beat = 60 / bpm / 2;
    this.musicTimer += beat;
    const dayProg = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    const nightProg = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 233.1, 293.7], [164.8, 207.7, 246.9]];
    const prog = this.isNight ? nightProg : dayProg;
    const chord = prog[Math.floor(this.step / 16) % 4];
    const bus = this.musicBus;
    if (this.step % 16 === 0) chord.forEach((f) => this.tone({ freq: f / 2, type: 'sine', dur: beat * 16, vol: 0.05, attack: 0.6, bus }));
    if (this.step % 4 === 0) this.tone({ freq: chord[0] / 4, type: 'triangle', dur: beat * 2, vol: 0.08, bus });
    const pent = this.divine ? [1, 1.25, 1.5, 1.875, 2, 2.5] : [1, 1.125, 1.25, 1.5, 1.667, 2];
    if (Math.random() < (this.isNight ? 0.35 : 0.55)) {
      const f = chord[0] * pent[Math.floor(Math.random() * pent.length)] * (Math.random() < 0.3 ? 2 : 1);
      this.tone({ freq: f, type: this.isNight ? 'sine' : 'triangle', dur: beat * 1.6, vol: 0.035, bus, echo: true });
    }
    this.step++;
  }
}

export const audio = new Audio();
