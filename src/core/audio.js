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

// ── the score ────────────────────────────────────────────────────────────────
// Every place has a key, a pulse and a slow progression. A chord is a pad voicing (semitones above root − 12) and the
// five tones a melody may use over it (within the octave above root, ascending). note() always draws from the chord
// sounding *now*, so a streak of light is an arpeggio of the harmony under it, and a firefly's flash is in tune with it.
const ch = (pad, mel) => ({ pad, mel });
const PENT = [0, 2, 4, 7, 9];
const DEEP = [ch([0, 7, 14, 15], [0, 2, 3, 7, 10]), ch([-4, 7, 12, 15], [0, 3, 7, 8, 10]), ch([-2, 7, 10, 15], [0, 3, 5, 7, 10]), ch([7, 12, 14, 19], [0, 2, 5, 7, 10])];
export const THEMES = {
  // the Atrium: home — a slow lydian sway in D (I · II/I · vi · IV)
  atrium: { root: 50, bpm: 58, bars: 2, arp: 'chime', base: 0.07, prog: [ch([0, 7, 14, 16], PENT), ch([0, 9, 14, 18], [2, 4, 6, 9, 11]), ch([-3, 4, 12, 19], PENT), ch([5, 9, 12, 16], [0, 2, 5, 7, 9])] },
  // Dew: first light on wet glass — E, bright, unhurried (Imaj7 · vi7 · IVmaj7♯11 · V6sus)
  dew: { root: 52, bpm: 66, bars: 2, arp: 'chime', base: 0.08, prog: [ch([0, 7, 11, 16], [0, 2, 4, 7, 11]), ch([-3, 7, 12, 16], PENT), ch([5, 12, 16, 21], [0, 5, 7, 9, 11]), ch([7, 12, 14, 16], PENT)] },
  // the Glassworks: clockwork in a crystal — B dorian, a steady tick of plucked glass
  glass: { root: 47, bpm: 84, bars: 2, arp: 'clock', base: 0.1, prog: [ch([0, 7, 10, 14], [0, 2, 3, 7, 10]), ch([0, 9, 12, 17], [0, 2, 5, 7, 9]), ch([8, 12, 15, 19], [0, 3, 7, 8, 10]), ch([10, 15, 19, 24], [0, 3, 5, 7, 10])] },
  // Chemistry: things fizz and turn into other things — F lydian, and one chromatic step sideways (A♭)
  chem: { root: 53, bpm: 76, bars: 2, arp: 'bubble', base: 0.09, prog: [ch([0, 7, 11, 16], [0, 2, 4, 6, 7]), ch([0, 9, 14, 18], [2, 4, 6, 9, 11]), ch([3, 10, 14, 19], [2, 3, 5, 7, 10]), ch([7, 14, 16, 21], [2, 4, 7, 9, 11])] },
  // the Abyss: slow dark water — C minor, wide and sparse (i · ♭VI · ♭III/♭VII · Vsus)
  abyss: { root: 48, bpm: 54, bars: 2, arp: 'deep', base: 0.05, prog: DEEP },
  // the Heart: the same water, with a heartbeat under it
  heart: { root: 48, bpm: 62, bars: 2, arp: 'deep', base: 0.06, pulse: 'heart', prog: DEEP },
  // a warden: its stratum's key turned minor, a chord a bar, the bass on every beat
  warden: { root: 50, bpm: 96, bars: 1, arp: 'clock', base: 0.12, pulse: 'beat', prog: [ch([0, 7, 14, 15], [0, 2, 3, 7, 10]), ch([8, 12, 15, 19], [0, 3, 7, 8, 10]), ch([10, 14, 17, 22], [0, 2, 5, 7, 10]), ch([7, 12, 14, 17], [0, 2, 5, 7, 10])] },
  // Bloom: keep the chain alive — E, quick, a chord a bar (I · V/7 · vi · IV)
  bloom: { root: 52, bpm: 104, bars: 1, arp: 'pop', base: 0.14, prog: [ch([0, 7, 11, 16], PENT), ch([-1, 7, 14, 19], [2, 4, 7, 9, 11]), ch([-3, 7, 12, 16], PENT), ch([5, 12, 19, 21], [0, 2, 5, 7, 9])] },
  // Duet: two of you — A, playful
  duet: { root: 45, bpm: 92, bars: 1, arp: 'pop', base: 0.12, prog: [ch([12, 19, 26, 28], PENT), ch([9, 19, 24, 28], PENT), ch([17, 24, 28, 33], [0, 2, 5, 7, 9]), ch([19, 24, 26, 31], PENT)] },
  // the Kneading Pool: nothing to win — a lullaby in F
  pool: { root: 53, bpm: 50, bars: 2, arp: 'chime', base: 0.05, prog: [ch([0, 7, 14, 16], PENT), ch([-3, 7, 12, 16], PENT), ch([5, 9, 12, 16], [0, 2, 5, 7, 9]), ch([7, 12, 14, 21], PENT)] },
  // the end of the Odyssey: G, warm, everything resolved
  epilogue: { root: 55, bpm: 60, bars: 2, arp: 'chime', base: 0.1, prog: [ch([0, 7, 11, 14], PENT), ch([-3, 4, 7, 11], [0, 4, 7, 9, 11]), ch([5, 11, 16, 21], PENT), ch([7, 12, 14, 21], PENT)] },
};
const LEGACY = { deep: 'atrium', bright: 'bloom', tense: 'warden' };
// where the glass may fall in two bars of eighths, for the styles that keep time (others breathe freely)
const MASK = { clock: [1.5, 0.3, 1, 0.3, 1.2, 0.3, 1, 0.8, 1.5, 0.3, 1, 0.3, 1.2, 0.8, 0.3, 1], pop: [1.6, 0.2, 0.3, 1.2, 0.2, 0.3, 1.2, 0.3, 1.6, 0.2, 0.3, 1.2, 0.2, 1, 0.3, 0.2] };

export class Sound {
  constructor() {
    this.ctx = null; this.ready = false; this.muted = false; this.vol = 0.8;
    this.root = 50; this.scale = SCALES.dawn; this.chain = 0; this.chainT = 0;
    this.cont = {}; this.ambNodes = [];
    this.lastPlay = {};
    // the score: theme, scheduler, the chord's melody tones; what it listens to (activity, speed, danger, the open pore)
    this.th = null; this.thId = ''; this.sc = null; this.mel = null; this.bed = null; this.pad = null; this._bus = null; this.want = null;
    this.act = 0; this.spd = 0; this.dng = 0; this.bcn = null;
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
    if (this.want) this.ambience(...this.want);      // a place asked for its music before the first touch woke the ear
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

  // (while the score schedules, _bus is its bed: those notes fade with their theme and fall silent with it)
  _out(g, wet = 0.4) { const B = this._bus || this; g.connect(B.dry); if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(B.verbIn); } }
  _pan(g, pan) { if (!pan || !this.ctx.createStereoPanner) return g; const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); return p; }
  _rate(name, ms) { const t = performance.now(); if (this.lastPlay[name] && t - this.lastPlay[name] < ms) return false; this.lastPlay[name] = t; return true; }

  note(deg, oct = 0) { return this._noteIn(this.mel || this.scale, deg, oct); }
  _noteIn(s, deg, oct) { const o = Math.floor(deg / s.length); const i = ((deg % s.length) + s.length) % s.length; return this.root + 12 * (oct + o) + s[i]; }

  // ── voices ────────────────────────────────────────────────────────────
  bell(midi, vel = 0.5, dur = 1.6, bright = 1, wet = 0.55, pan = 0, at = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = Math.max(ctx.currentTime, at);
    const f = mtof(midi);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6 * bright, t); mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.32, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    this._out(this._pan(g, pan), wet);
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }

  pluck(midi, vel = 0.5, dur = 0.5, wet = 0.3, at = 0, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = Math.max(ctx.currentTime, at);
    const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = mtof(midi);
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(mtof(midi) * 8, t); fl.frequency.exponentialRampToValueAtTime(mtof(midi) * 1.2, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); this._out(this._pan(g, pan), wet);
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

  blip(f0, f1, vel, dur, type = 'sine', wet = 0.3, at = 0, pan = 0) {
    if (!this.ready) return;
    const ctx = this.ctx, t = Math.max(ctx.currentTime, at);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this._out(this._pan(g, pan), wet); o.start(t); o.stop(t + dur + 0.05);
  }

  // ── game events ───────────────────────────────────────────────────────
  // every mote is the next note of a rising line; the game keeps the streak (in its own time), the sound just sings it
  mote(pan = 0, chain = 0) {
    if (!chain) { const now = performance.now(); if (now - this.chainT > 1400) this.chain = 0; this.chainT = now; chain = ++this.chain; } else this.chain = chain;
    this.act = Math.min(1, this.act + 0.14);      // (the score's glass sings faster while light is being eaten)
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
  portal() { if (!this.cadence()) [0, 4, 7, 11, 14].forEach((d, i) => setTimeout(() => this.bell(this.note(d, 1), 0.35, 4, 0.8, 0.9), i * 90)); this.blip(55, 220, 0.25, 2.5, 'sine', 0.8); }
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
  // living light (world/plankton.js)
  skitter() { if (!this._rate('skitter', 110)) return; this.blip(1700 + Math.random() * 300, 2900, 0.06, 0.07, 'sine', 0.35); setTimeout(() => this.blip(2300, 3600, 0.045, 0.05, 'sine', 0.35), 42); }
  firefly(pan = 0) { this.ffk = ((this.ffk || 0) + 1) % 5; this.bell(this.note([4, 6, 4, 7, 9][this.ffk], 2), 0.13, 2.6, 0.32, 0.92, pan); }
  podPop(pan = 0) { if (!this._rate('podPop', 90)) return; this.noiseHit(1100, 1.4, 0.2, 0.13, 0.3, 0.45, 'lowpass'); this.blip(250, 640, 0.13, 0.12, 'sine', 0.3); [0, 2, 4].forEach((d, i) => setTimeout(() => this.bell(this.note(d + 7, 1), 0.11, 1.3, 0.8, 0.7, pan), 50 + i * 55)); }
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
    this.spd = speed; if (!this.ready) return; const c = this.cont, t = this.ctx.currentTime;
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
  setDanger(x) { this.dng = x; if (!this.ready) return; this.cont.dg.gain.setTargetAtTime(Math.max(0, Math.min(1, x)) * 0.16, this.ctx.currentTime, 0.2); }

  // ── the score ─────────────────────────────────────────────────────────
  // ambience(theme[, root]): the music of a place (THEMES). Asked for again, the same music keeps playing — a stratum
  // is one piece across all its chambers — and a new one crossfades in over the old.
  ambience(kind = 'atrium', root) {
    const name = THEMES[kind] ? kind : LEGACY[kind] || 'atrium', th = THEMES[name], r = root ?? th.root, id = name + ':' + r;
    if (!this.ready) { this.want = [name, r]; return; }
    this.want = null;
    if (this.thId === id && this.bed) { this.sc.hold = 0; return; }
    const ctx = this.ctx, t = ctx.currentTime;
    for (const n of this.ambNodes) { try { n.g.gain.setTargetAtTime(0, t, 1.2); n.o.forEach(o => o.stop(t + 5)); } catch (_) { /* ignore */ } }
    this.ambNodes = []; clearInterval(this.chimeTimer);
    this.th = { ...th, root: r, name }; this.thId = id; this.root = r;
    // the pad: four voices, two detuned oscillators each, that glide from voicing to voicing
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.075, t, 2.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 420; lfo.connect(lg); lg.connect(lp.frequency);
    const os = [lfo], P0 = th.prog[0]; this.pad = [];
    P0.pad.forEach((iv, k) => {
      const v = [];
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = k === 0 ? 'sine' : 'triangle';
        o.frequency.value = mtof(r - 12 + iv); o.detune.value = det + (Math.random() - 0.5) * 4;
        const og = ctx.createGain(); og.gain.value = k === 0 ? 0.5 : 0.22;
        o.connect(og); og.connect(lp); o.start(); os.push(o); v.push(o);
      }
      this.pad.push(v);
    });
    // underwater swell
    const ns = ctx.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 260;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    ns.connect(nf); nf.connect(ng); ng.connect(lp); ns.start(); os.push(ns);
    lp.connect(g); this._out(g, 0.7);
    lfo.start(); this.padLP = lp;
    // the bed every scheduled note is played into: when this theme goes, its last notes fade with it
    const bd = ctx.createGain(), bw = ctx.createGain(); bd.connect(this.dry); bw.connect(this.verbIn); this.bed = { dry: bd, verbIn: bw };
    this.ambNodes.push({ g, o: os }, { g: bd, o: [] }, { g: bw, o: [] });
    this.sc = { n: 0, t: t + 0.6, w: 5, hold: 0, q: [], last: t, call: this.bcn ? 1 : 0, calls: 0, called: -1e9 }; this.mel = P0.mel;
  }
  keyOf(name) { return (THEMES[name] || THEMES.atrium).root; }
  // the way out, as the score hears it: where the nearest open pore is from the creature (d = 0: none)
  beacon(dx, dy, d) { if (d > 0) { if (!this.bcn && this.sc) { this.sc.call = 1; this.sc.calls = 0; } this.bcn = [dx, dy, d]; } else this.bcn = null; }
  // called by every simulation step while a world runs: keeps the score scheduled a little ahead of the ear
  conduct() {
    const sc = this.sc; if (!this.ready || !this.th || !sc) return;
    const now = this.ctx.currentTime, dt = Math.min(0.5, Math.max(0, now - sc.last)); sc.last = now;
    this.act *= Math.exp(-dt / 3.5);
    while (sc.q.length && sc.q[0][0] <= now) this.mel = sc.q.shift()[1];
    if (sc.t < now - 0.3) sc.t = now + 0.05;      // away a while (paused, a hidden tab): pick the thread up again, never cram
    const e8 = 30 / this.th.bpm; this._bus = this.bed;
    try { while (sc.t < now + 0.2) { this._eighth(sc.n, sc.t, e8); sc.n++; sc.t += e8; } } finally { this._bus = null; }
  }
  _chord(n) { const th = this.th; return th.prog[Math.floor(n / (8 * th.bars)) % th.prog.length]; }
  _eighth(n, t, e8) {
    const th = this.th, sc = this.sc, C = this._chord(n), bar = n % 8 === 0, change = n % (8 * th.bars) === 0, bm = this._bassNote(C);
    if (change) { this._padTo(C, t); sc.q.push([t, C.mel]); }
    // the bass breathes once a bar — twice, like a heart, in the Heart or when something near can hurt you; a warden's walks every beat
    const heart = th.pulse === 'heart' || this.dng > 0.45;
    if (bar) { if (heart) { this._bass(bm, 0.1, t); this._bass(bm, 0.065, t + 0.2); } else this._bass(bm, change ? 0.09 : 0.06, t); }
    else if (th.pulse === 'beat' && n % 2 === 0) this._bass(bm, 0.04, t);
    if (t < sc.hold) return;
    // the glass: tones of the chord, as many as the creature is alive (moving, eating); stillness thins it to a few chimes
    const live = Math.min(1, this.act + Math.min(1, this.spd / 700) * 0.6), mk = MASK[th.arp];
    let p = (th.base + 0.5 * live) * (mk ? mk[n % 16] : bar ? 1.6 : n % 2 ? 0.55 : 1); if (this.dng > 0.45) p *= 0.5;
    if (Math.random() < Math.min(0.95, p)) {
      sc.w += [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0] + (live > 0.6 && Math.random() < 0.3 ? 1 : 0);
      if (sc.w < 2) sc.w = 4 - sc.w; if (sc.w > 10) sc.w = 20 - sc.w;
      this._glass(th.arp, this._noteIn(C.mel, sc.w, th.arp === 'deep' ? 0 : 1), 0.05 + 0.05 * live, t + (n % 2 && !mk ? e8 * 0.07 : 0), Math.random() * 1.2 - 0.6);
    }
    // an open pore calls — from its own side of the room, louder as you near; a fourth note answers when you are almost there.
    // It does not nag: after three calls it calls half as often and more softly, and it keeps quiet while light is being eaten
    const b = this.bcn, tired = sc.calls >= 3;
    if (b && ((sc.call && bar) || n % (tired ? 32 : 16) === 12) && t - sc.called > 6 * e8 && (sc.call || this.act < 0.35)) {
      sc.call = 0; sc.called = t; sc.calls++; const near = 1 - Math.min(1, b[2] / 1100), pan = Math.max(-0.9, Math.min(0.9, b[0] / 450)), v = (0.05 + 0.15 * near) * (tired ? 0.65 : 1);
      [4, 7, 8].forEach((d, k) => this.bell(this._noteIn(this._chord(n + k).mel, d, 1), v * (k === 2 ? 1.15 : 1), 1.9, 0.95, 0.7, pan, t + k * e8));
      if (b[2] < 260) this.bell(this._noteIn(this._chord(n + 3).mel, 10, 1), v * 0.9, 2.6, 0.7, 0.8, pan, t + 3 * e8);
    }
  }
  _glass(style, m, v, t, pan) {
    if (style === 'clock') { this.pluck(m, v * 1.5, 0.42, 0.45, t, pan); if (Math.random() < 0.25) this.bell(m + 12, v * 0.5, 1.4, 0.6, 0.8, pan, t); }
    else if (style === 'bubble') { const f = mtof(m); this.blip(f * 0.9, f * 1.05, v * 0.9, 0.11, 'sine', 0.5, t, pan); this.bell(m, v * 0.6, 1.2, 0.35, 0.85, pan, t + 0.03); }
    else if (style === 'deep') this.bell(m, v * 1.3, 4.2, 0.22, 0.95, pan, t);
    else if (style === 'pop') { this.pluck(m, v * 1.4, 0.3, 0.3, t, pan); this.bell(m + 12, v * 0.45, 1.1, 0.7, 0.6, pan, t); }
    else this.bell(m, v, 2.6, 0.45, 0.9, pan, t);
  }
  _padTo(C, t) { const r = this.th.root; this.pad.forEach((v, k) => { const f = mtof(r - 12 + C.pad[k]); for (const o of v) o.frequency.setTargetAtTime(f, t, 0.12); }); }
  _bassNote(C) { let m = this.th.root - 12 + C.pad[0]; while (m < 36) m += 12; while (m > 47) m -= 12; return m; }
  _bass(m, vel, t) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(m); o2.type = 'sine'; o2.frequency.value = mtof(m) * 2; g2.gain.value = 0.3;      // (the octave lets a small speaker hear it)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); o2.connect(g2); g2.connect(g); this._out(g, 0.2); o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
  }
  // left alone a while, the creature hums along: two falling notes of the chord, on the next beat. Returns how long until it sounds (−1: not now)
  hum() {
    const sc = this.sc; if (!this.ready || !this.th || !sc || this.dng > 0.2 || this.muted || !this._rate('hum', 2600)) return -1;
    const e8 = 30 / this.th.bpm, odd = sc.n % 2, n = sc.n + odd, t = sc.t + odd * e8, C = this._chord(n), k = 1 + ((Math.random() * 3) | 0);
    this._bus = this.bed; try { this._hum(this._noteIn(C.mel, k + 1, 1), 0.055, 1.5 * e8 + 0.3, t); this._hum(this._noteIn(this._chord(n + 2).mel, k, 1), 0.045, 3 * e8 + 0.4, t + 2 * e8); } finally { this._bus = null; }
    return Math.max(0, t - this.ctx.currentTime);
  }
  _hum(m, vel, dur, t) {      // a closed-mouth voice: a soft triangle under a low formant, with a slow vibrato
    const ctx = this.ctx, o = ctx.createOscillator(), v = ctx.createOscillator(), vg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(), f0 = mtof(m);
    o.type = 'triangle'; o.frequency.value = f0; v.frequency.value = 5.2; vg.gain.value = f0 * 0.006; v.connect(vg); vg.connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 2.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.16); g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.22);
    o.connect(f); f.connect(g); this._out(g, 0.5); o.start(t); v.start(t); o.stop(t + dur + 0.8); v.stop(t + dur + 0.8);
  }
  // a chamber done: the harmony comes home — the pad settles on the tonic under a rising arpeggio of it, then a breath
  // of rest before the music begins a new phrase
  cadence() {
    const sc = this.sc; if (!this.ready || !this.th || !sc) return false;
    const t = this.ctx.currentTime + 0.02, P = this.th.prog[0];
    this._bus = this.bed; try { this._padTo(P, t); this._bass(this._bassNote(P), 0.12, t); } finally { this._bus = null; }
    sc.q.length = 0; this.mel = P.mel;
    [0, 2, 4, 5, 7, 9, 10].forEach((d, i) => this.bell(this._noteIn(P.mel, d, 1), 0.3 - i * 0.022, 3.2, 0.8, 0.85, (i - 3) * 0.16, t + 0.06 + i * 0.085));
    sc.n = 0; sc.t = t + 3.4; sc.hold = 0;
    return true;
  }
}

export const sound = new Sound();
