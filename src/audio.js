// @ts-check
/** Musique adaptative et bruitages générés avec la Web Audio API. */
import { CFG } from './save.js';
import { R, rnd } from './util.js';

/* =========================================================
   AUDIO : moteur de synthèse, effets et musique générative
   ========================================================= */
/** @type {any} Nœuds Web Audio créés au premier geste du joueur. */
export const AU = {
  ac: null, master: null, mus: null, sfx: null, noise: null, delay: null, last: {},
  intensity: 0, target: 0, zone: 0, step: 0, nextT: 0, bar: 0, on: false,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext; if (!AC) return;
    try { this.ac = new AC(); } catch (e) { return; }
    const ac = this.ac;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ac.createGain(); this.master.gain.value = .9; this.master.connect(comp); comp.connect(ac.destination);
    this.mus = ac.createGain(); this.mus.connect(this.master);
    this.sfx = ac.createGain(); this.sfx.connect(this.master);
    this.delay = ac.createDelay(1); this.delay.delayTime.value = .32;
    const fb = ac.createGain(); fb.gain.value = .38; const dl = ac.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.mus);
    const len = ac.sampleRate * 1.5, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = R.f() * 2 - 1;
    this.noise = buf;
    this.vol();
    this.nextT = ac.currentTime + .1; this.on = true;
    setInterval(() => this.schedule(), 25);
  },
  vol() {
    if (!this.ac) return;
    this.mus.gain.setTargetAtTime(CFG.mus / 100 * .55, this.ac.currentTime, .1);
    this.sfx.gain.setTargetAtTime(CFG.sfx / 100 * .8, this.ac.currentTime, .05);
  },
  ok(name, gap = .03) {
    if (!this.ac || this.ac.state !== 'running') return false;
    const t = this.ac.currentTime; if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t; return true;
  },
  tone(type, f0, f1, dur, vol, dest, t0, att = .005) {
    const ac = this.ac, t = t0 || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + .05);
    return o;
  },
  nz(dur, vol, ft, f0, f1, dest, t0, q = 1) {
    const ac = this.ac, t = t0 || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rnd(.9, 1.1);
    const f = ac.createBiquadFilter(); f.type = ft; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, rnd(0, .5)); s.stop(t + dur + .05);
  },
  play(n, p = 1) {
    if (!this.ok(n, n === 'pickup' ? .025 : .035)) return;
    switch (n) {
      case 'slash': this.nz(.13, .35, 'bandpass', 3800 * p, 700, null, 0, 2.5); this.tone('sine', 520 * p, 180, .09, .12); break;
      case 'slash3': this.nz(.2, .45, 'bandpass', 2600, 400, null, 0, 2); this.tone('sawtooth', 300, 60, .18, .14); break;
      case 'hit': this.tone('square', 240 * p, 70, .08, .12); this.nz(.05, .3, 'highpass', 2500, 2500); break;
      case 'crit': this.tone('square', 900, 200, .1, .1); this.tone('sine', 1400, 1400, .12, .08); break;
      case 'kill': this.nz(.28, .35, 'lowpass', 3000, 150); this.tone('sine', 420 * p, 50, .25, .22); this.tone('triangle', 1200 * p, 600, .08, .06); break;
      case 'shot': this.tone('triangle', 700, 1500, .09, .12); this.tone('sine', 1500, 900, .06, .05); break;
      case 'reflect': this.tone('square', 1300, 2600, .07, .07); this.tone('sine', 2000, 3000, .1, .07); break;
      case 'dash': this.nz(.2, .35, 'bandpass', 600, 4000, null, 0, 1.4); break;
      case 'hurt': this.tone('sawtooth', 320, 70, .3, .25); this.nz(.2, .4, 'lowpass', 1800, 200); break;
      case 'eshot': this.tone('sine', 560, 300, .12, .05); break;
      case 'pickup': this.tone('sine', 1100 * p, 1700 * p, .06, .05); break;
      case 'heal': [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f, .25, .08, null, this.ac.currentTime + i * .06)); break;
      case 'up': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, .35, .09, this.delay, this.ac.currentTime + i * .055)); break;
      case 'nova': this.tone('sine', 140, 28, 1, .5); this.nz(.9, .5, 'lowpass', 5000, 80); this.tone('sawtooth', 70, 35, .8, .15); break;
      case 'boom': this.tone('sine', 110, 30, .45, .4); this.nz(.45, .45, 'lowpass', 2500, 100); break;
      case 'spawn': this.tone('sine', 200, 800, .3, .04); break;
      case 'portal': [392, 523, 659, 784].forEach((f, i) => this.tone('sine', f, f * 1.01, .6, .06, this.delay, this.ac.currentTime + i * .08)); break;
      case 'clear': [440, 554, 659, 880].forEach((f, i) => this.tone('triangle', f, f, .5, .1, this.delay, this.ac.currentTime + i * .09)); break;
      case 'roar': [55, 58, 82].forEach(f => this.tone('sawtooth', f, f * .7, 1.6, .18, null, 0, .2)); this.nz(1.5, .3, 'bandpass', 300, 120, null, 0, 3); break;
      case 'laser': this.tone('sawtooth', 90, 90, .6, .08); this.tone('square', 180, 175, .6, .03); break;
      case 'warn': this.tone('square', 880, 880, .07, .05); break;
      case 'buy': this.tone('square', 990, 1480, .08, .07); this.tone('sine', 1480, 1480, .2, .06, null, this.ac.currentTime + .08); break;
      case 'ui': this.tone('sine', 900, 1200, .04, .04); break;
      case 'shield': this.tone('triangle', 1800, 600, .25, .12); break;
      case 'zap': this.nz(.12, .25, 'highpass', 3000, 6000); this.tone('square', 1800, 300, .08, .05); break;
      case 'beat': this.tone('sine', 70, 40, .15, .3); this.tone('sine', 65, 38, .15, .22, null, this.ac.currentTime + .16); break;
    }
  },
  /* Musique : un séquenceur au double-croche, quatre couches */
  PROG: [
    [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],       // La mineur : Jardins de Verre
    [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],       // Ré mineur : Forges Pourpres
    [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],       // Mi mineur : Cœur du Néant
    [[54, 57, 61], [50, 54, 57], [52, 56, 59], [49, 53, 56]]        // Fa# mineur : l'Archonte
  ],
  LEAD: [0, -1, 2, -1, 4, -1, 2, 1, 0, -1, 5, -1, 4, 2, 1, -1],
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  schedule() {
    if (!this.ac || this.ac.state !== 'running') return;
    const ac = this.ac;
    if (this.nextT < ac.currentTime - .2) this.nextT = ac.currentTime + .05;
    while (this.nextT < ac.currentTime + .15) {
      this.note(this.step, this.nextT);
      const bpm = this.zone === 3 ? 138 : 112 + this.zone * 6;
      this.nextT += 60 / bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) { this.bar++; this.intensity = this.target; }
    }
  },
  note(s, t) {
    const I = this.intensity, z = this.zone, prog = this.PROG[z], ch = prog[this.bar % 4];
    const root = ch[0] - 24, M = this.mus, f = this.mtof;
    if (s === 0) {
      ch.forEach(m => {
        const o = this.ac.createOscillator(), o2 = this.ac.createOscillator(), g = this.ac.createGain(), fl = this.ac.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f(m); o2.frequency.value = f(m) * 1.006;
        fl.type = 'lowpass'; fl.frequency.value = I === 0 ? 700 : 1100; fl.Q.value = 2;
        const len = 60 / (this.zone === 3 ? 138 : 112 + z * 6) * 4;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .3); g.gain.setValueAtTime(.035, t + len - .3); g.gain.linearRampToValueAtTime(0, t + len);
        o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(M); o.start(t); o2.start(t); o.stop(t + len + .1); o2.stop(t + len + .1);
      });
    }
    // arpège cristallin
    if (s % 2 === 0 || I >= 1) {
      const n = ch[(s >> (I >= 1 ? 0 : 1)) % 3] + 12 + (s % 8 >= 6 ? 12 : 0);
      this.tone('triangle', f(n), f(n), .14, I === 0 ? .03 : .028, this.delay, t);
    }
    if (I >= 1) {
      // basse
      const bp = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1];
      if (bp[s]) {
        const o = this.ac.createOscillator(), g = this.ac.createGain(), fl = this.ac.createBiquadFilter();
        o.type = 'square'; o.frequency.value = f(root + (s === 3 || s === 11 ? 12 : 0));
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(160, t + .14);
        g.gain.setValueAtTime(.11, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
        o.connect(fl); fl.connect(g); g.connect(M); o.start(t); o.stop(t + .2);
      }
      // batterie
      const kick = I >= 2 ? (s % 4 === 0 || s === 10) : (s === 0 || s === 8 || s === 6 && this.bar % 2);
      if (kick) this.tone('sine', 150, 40, .22, .5, M, t, .002);
      if (s === 4 || s === 12) { this.nz(.16, .22, 'bandpass', 1800, 900, M, t, .8); this.tone('triangle', 220, 160, .08, .08, M, t); }
      if (s % 2 === 1 || (I >= 2)) this.nz(.035, s % 4 === 2 ? .09 : .05, 'highpass', 8000, 8000, M, t);
    }
    if (I >= 2) {
      const l = this.LEAD[s];
      if (l >= 0) { const sc = [0, 2, 3, 5, 7, 8, 10]; const m = ch[0] + 12 + sc[l % 7]; this.tone('sawtooth', f(m), f(m), .18, .03, this.delay, t, .01); }
    }
  }
};
