// ─────────────────────────────────────────────────────────────────────────────
//  MYRIA sound — fully procedural. Wet, glassy, tuned.
//  Every pickup is a note; every chain of motes becomes a melody.
// ─────────────────────────────────────────────────────────────────────────────

const SCALES = {
  dawn: [0, 2, 4, 7, 9],          // major pentatonic
  dusk: [0, 3, 5, 7, 10],         // minor pentatonic
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export class Sound {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false; this.vol = 0.8;
    this.root = 50; this.scale = SCALES.dawn; this.chain = 0; this.chainT = 0;
    this.cont = {}; this.ambNodes = [];
    this.lastPlay = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    // reverb send
    this.verb = ctx.createConvolver(); this.verb.buffer = this._ir(3.2, 2.4);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.55;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);
    this.dry = ctx.createGain(); this.dry.connect(this.master);
    // shared noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nb.getChannelData(0);
    let b0 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.985 * b0 + 0.15 * w; d[i] = (w * 0.35 + b0 * 0.65); }
    this.noise = nb;
    this._continuous();
    this.ready = true;
  }

  _ir(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.01 ? t / 0.01 : 1); }
    }
    return buf;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.05); }
  setKey(root, scale = 'dawn') { this.root = root; this.scale = SCALES[scale] || SCALES.dawn; }

  _out(g, wet = 0.4) { g.connect(this.dry); if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.verbIn); } }
  _rate(name, ms) { const t = performance.now(); if (this.lastPlay[name] && t - this.lastPlay[name] < ms) return false; this.lastPlay[name] = t; return true; }

  note(deg, oct = 0) { const s = this.scale; const o = Math.floor(deg / s.length); const i = ((deg % s.length) + s.length) % s.length; return this.root + 12 * (oct + o) + s[i]; }

  // ── voices ────────────────────────────────────────────────────────────
  bell(midi, vel = 0.5, dur = 1.6, bright = 1, wet = 0.55, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = mtof(midi);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6 * bright, t); mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.32, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    let out = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    this._out(out, wet);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }

  pluck(midi, vel = 0.5, dur = 0.5, wet = 0.3) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = mtof(midi);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(mtof(midi) * 8, t); fl.frequency.exponentialRampToValueAtTime(mtof(midi) * 1.2, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); this._out(g, wet);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noiseHit(freq, q, vel, dur, wet = 0.25, sweep = 0.5, type = 'bandpass') {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); this._out(g, wet);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  blip(f0, f1, vel, dur, type = 'sine', wet = 0.3) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this._out(g, wet); o.start(t); o.stop(t + dur + 0.05);
  }

  // ── game events ───────────────────────────────────────────────────────
  // every mote is the next note of a rising line; the game keeps the streak (in its own time), the sound just sings it
  mote(pan = 0, chain = 0) {
    if (!chain) { const now = performance.now(); if (now - this.chainT > 1400) this.chain = 0; this.chainT = now; chain = ++this.chain; } else this.chain = chain;
    const deg = chain - 1;
    const m = this.note(deg % 10, 1 + Math.floor(deg / 10) % 2);
    this.bell(m, 0.42, 1.4, 0.8 + Math.min(0.6, chain * 0.02), 0.6, pan);
    if (chain % 5 === 0) this.bell(m + 12, 0.18, 2.2, 0.5, 0.8, pan);
    if (chain % 8 === 0) { const d0 = deg % 10; [0, 2, 4].forEach((d, i) => setTimeout(() => this.bell(this.note(d0 + d, 2), 0.2, 2.4, 1.0, 0.85, pan), 60 + i * 70)); this.blip(90, 180, 0.12, 0.5, 'sine', 0.5); }
    return chain;
  }
  prism() { [0, 2, 4, 7].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 2), 0.35, 2.4, 1.2, 0.8), i * 70)); }
  squish(v = 0.5) { if (!this._rate('squish', 60)) return; this.noiseHit(500 + v * 600, 2.5, 0.12 + v * 0.22, 0.16 + v * 0.1, 0.2, 0.25, 'lowpass'); this.blip(180 + v * 80, 60, 0.12 * v, 0.12, 'sine', 0.1); }
  splat(v = 0.5) { if (!this._rate('splat', 90)) return; this.noiseHit(900, 1.2, 0.18 + v * 0.3, 0.22, 0.3, 0.3); this.blip(140, 45, 0.25 * v, 0.2, 'sine', 0.2); }
  pop(v = 0.5) { if (!this._rate('pop', 30)) return; const f = 600 + Math.random() * 500; this.blip(f, f * 2.4, 0.18 * v + 0.05, 0.06, 'sine', 0.25); }
  snap(t = 0.5) { if (!this._rate('snap', 50)) return; this.pluck(this.note(4 + Math.floor(t * 4), 2), 0.35, 0.35, 0.35); this.noiseHit(3000, 3, 0.06, 0.05, 0.1); }
  fuse(size = 0.5) { if (!this._rate('fuse', 120)) return; this.blip(55 + size * 20, 42, 0.32, 0.6, 'sine', 0.5); this.bell(this.note(0, 0), 0.22, 1.8, 0.4, 0.7); }
  bud() { this.blip(320, 760, 0.16, 0.14, 'sine', 0.35); this.noiseHit(1800, 4, 0.06, 0.08, 0.2); }
  dart(p = 1) { this.noiseHit(1400, 0.7, 0.16 * p, 0.32, 0.35, 0.25); this.blip(240, 520, 0.08, 0.18, 'triangle', 0.2); }
  grind() { if (!this._rate('grind', 70)) return; this.noiseHit(2600 + Math.random() * 1500, 5, 0.5, 0.09, 0.12, 0.8); this.blip(130, 70, 0.1, 0.08, 'sawtooth', 0.1); }
  fizz() { if (!this._rate('fizz', 90)) return; this.noiseHit(5200 + Math.random() * 1800, 1.2, 0.2, 0.3, 0.35, 1.6, 'highpass'); this.blip(700, 1500, 0.07, 0.1, 'sine', 0.3); }
  tick() { if (!this._rate('tick', 80)) return; this.blip(980, 760, 0.10, 0.07, 'sine', 0.35); }
  clack(v = 0.6) { if (!this._rate('clack', 90)) return; this.noiseHit(3200, 6, 0.3 * v + 0.1, 0.09, 0.3, 0.3); this.bell(this.note(2, 2), 0.2 * v + 0.08, 0.5, 2.4, 0.4); this.blip(210, 90, 0.3 * v, 0.1, 'triangle', 0.2); }
  ripe() { if (!this._rate('ripe', 200)) return; this.blip(520, 780, 0.12, 0.12, 'triangle', 0.4); }
  fuseTick(k = 0) { if (!this._rate('fuseTick', 70)) return; this.blip(300 + k * 900, 340 + k * 1100, 0.10 + 0.12 * k, 0.07, 'square', 0.2); }
  detonate() { this.noiseHit(140, 0.8, 0.9, 0.7, 0.5, 0.2, 'lowpass'); this.noiseHit(2600, 2, 0.4, 0.35, 0.5, 0.6); this.blip(160, 38, 0.6, 0.5, 'sine', 0.4); [0, 2, 4].forEach((d, i) => setTimeout(() => this.bell(this.note(d + 4, 1), 0.22, 2.4, 0.9, 0.8), 120 + i * 90)); }
  cut() { if (!this._rate('cut', 120)) return; this.noiseHit(5200, 7, 0.34, 0.25, 0.4, 0.4); this.bell(this.note(6, 2), 0.12, 0.8, 2, 0.5); }
  bounce(v = 0.5) { if (!this._rate('bounce', 80)) return; this.blip(160, 420, 0.2 * v + 0.05, 0.22, 'sine', 0.3); }
  bloom() { [0, 4, 7, 9, 11].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 1 + (i > 2 ? 1 : 0)), 0.3, 3.2, 0.7, 0.85), i * 110)); }
  open() { [0, 2, 4].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 0), 0.22, 2.5, 0.5, 0.8), i * 160)); this.blip(70, 110, 0.18, 1.2, 'sine', 0.6); }
  portal() { [0, 4, 7, 11, 14].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 1), 0.35, 4, 0.8, 0.9), i * 90)); this.blip(55, 220, 0.25, 2.5, 'sine', 0.8); }
  plate(on) { this.pluck(this.note(on ? 4 : 0, 1), 0.3, 0.5, 0.4); }
  heal() { if (!this._rate('heal', 140)) return; this.bell(this.note(Math.floor(Math.random() * 5), 2), 0.12, 1.2, 0.4, 0.8); }
  hurt(v = 0.5) { if (!this._rate('hurt', 160)) return; this.blip(220, 110, 0.18 * v + 0.06, 0.25, 'triangle', 0.3); this.noiseHit(700, 2, 0.1 * v, 0.2, 0.2); }
  morph() { this.blip(200, 900, 0.14, 0.5, 'sine', 0.7); [0, 3, 7].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 1), 0.2, 1.6, 1.4, 0.7), i * 60)); }
  ui() { this.pluck(this.note(2, 2), 0.18, 0.2, 0.3); }
  tickle() { this.bell(this.note(4 + Math.floor(Math.random() * 3), 2), 0.25, 0.9, 1.4, 0.5); }
  star(k = 0) { this.bell(this.note([0, 2, 4][k] ?? 4, 2), 0.4, 2.2, 1.1, 0.8); }
  whoosh() { this.noiseHit(700, 0.5, 0.22, 0.9, 0.5, 3.2); }
  haunt() { if (!this._rate('haunt', 600)) return; this.blip(92, 196, 0.2, 0.9, 'sine', 0.3); this.blip(277, 139, 0.09, 1.2, 'triangle', 0.5); }      // something getting up: a low swell and a falling sigh
  gulp() { if (!this._rate('gulp', 60)) return; this.blip(300, 120, 0.12, 0.12, 'sine', 0.25); }
  trick() { [0, 4, 7, 12].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 1) , 0.22, 1.5, 1, 0.6), i * 55)); }
  swallow() { this.blip(400, 90, 0.2, 0.35, 'sine', 0.4); }
  boom() { this.blip(90, 30, 0.5, 1.2, 'sine', 0.6); this.noiseHit(300, 0.6, 0.35, 1.0, 0.6, 0.2, 'lowpass'); }

  // ── continuous layers (glide whisper, tension hum, ambience) ──────────
  _continuous() {
    const ctx = this.ctx;
    // glide: silky noise through a band-pass, amplitude by speed × contact
    const gs = ctx.createBufferSource(); gs.buffer = this.noise; gs.loop = true;
    const gf = ctx.createBiquadFilter(); gf.type = 'bandpass'; gf.Q.value = 0.9; gf.frequency.value = 900;
    const gg = ctx.createGain(); gg.gain.value = 0;
    gs.connect(gf); gf.connect(gg); this._out(gg, 0.2); gs.start();
    // tension hum: two detuned sines + harmonic
    const h1 = ctx.createOscillator(), h2 = ctx.createOscillator(), hg = ctx.createGain();
    h1.type = 'sine'; h2.type = 'triangle'; h1.frequency.value = 200; h2.frequency.value = 401; hg.gain.value = 0;
    h1.connect(hg); h2.connect(hg); this._out(hg, 0.4); h1.start(); h2.start();
    // danger heartbeat drone
    const d1 = ctx.createOscillator(), dg = ctx.createGain(); d1.type = 'sine'; d1.frequency.value = 46; dg.gain.value = 0;
    d1.connect(dg); this._out(dg, 0.1); d1.start();
    this.cont = { gf, gg, h1, h2, hg, dg, d1 };
  }
  setGlide(speed, contact) {
    if (!this.ready) return; const c = this.cont, t = this.ctx.currentTime;
    const v = Math.min(1, speed / 500);
    c.gg.gain.setTargetAtTime(v * (0.02 + 0.07 * contact), t, 0.06);
    c.gf.frequency.setTargetAtTime(500 + v * 1400 + contact * 300, t, 0.08);
  }
  setTension(x) {
    if (!this.ready) return; const c = this.cont, t = this.ctx.currentTime;
    const k = Math.max(0, Math.min(1, x));
    c.hg.gain.setTargetAtTime(k * k * 0.07, t, 0.05);
    const f = mtof(this.root + 12 + k * 14);
    c.h1.frequency.setTargetAtTime(f, t, 0.05); c.h2.frequency.setTargetAtTime(f * 2.004, t, 0.05);
  }
  setDanger(x) { if (!this.ready) return; this.cont.dg.gain.setTargetAtTime(Math.max(0, Math.min(1, x)) * 0.16, this.ctx.currentTime, 0.2); }

  ambience(kind = 'deep', root = this.root) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const n of this.ambNodes) { try { n.g.gain.setTargetAtTime(0, t, 1.2); n.o.forEach(o => o.stop(t + 5)); } catch (_) { /* ignore */ } }
    this.ambNodes = [];
    const chord = kind === 'tense' ? [0, 3, 7, 10] : kind === 'bright' ? [0, 4, 7, 11, 14] : [0, 7, 14, 16];
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.075, t, 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 500; lfo.connect(lg); lg.connect(lp.frequency);
    const os = [lfo];
    chord.forEach((iv, k) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = mtof(root - 12 + iv); o.detune.value = det + (Math.random() - 0.5) * 4;
        const og = ctx.createGain(); og.gain.value = k === 0 ? 0.5 : 0.22;
        o.connect(og); og.connect(lp); o.start(); os.push(o);
      }
    });
    // underwater swell
    const ns = ctx.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 260;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(lp); ns.start(); os.push(ns);
    lp.connect(g); this._out(g, 0.7);
    lfo.start();
    this.ambNodes.push({ g, o: os });
    // sparse glass chimes
    clearInterval(this.chimeTimer);
    this.chimeTimer = setInterval(() => { if (Math.random() < 0.35) this.bell(this.note(Math.floor(Math.random() * 7), 2), 0.05 + Math.random() * 0.05, 3.5, 0.3, 0.95, Math.random() * 1.6 - 0.8); }, 2600);
  }
}

export const sound = new Sound();
