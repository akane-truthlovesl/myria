// ─────────────────────────────────────────────────────────────────────────────
//  Bloom — seventy-five seconds of rain, and the garden it leaves behind.
//  Light falls into the dish in figures — a line, a wave, an arc, a ring, a
//  spiral, a cross, a flower — each a little constellation on its own thread.
//  Every star scores. Take every star of a figure before any of them fades and
//  the figure is drawn: it rings out, it is etched into the dish for good, and
//  the multiplier climbs a step (×8 at most). The chain is what holds the steps
//  up: let it fall quiet, or let the dish cut it — a blade wakes, then a gear,
//  then both faster — and the multiplier drops back to ×1. The last seconds
//  are a downpour. At the end, the picture is the garden you drew.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { SURF } from '../sim/materials.js';
import { TAU, rng, hashStr } from '../core/util.js';
import { PAL } from '../world/odyssey.js';
import { TRICKS } from './odyssey.js';
import { shoalOf, fireflyCloud } from '../world/plankton.js';
import { PROF } from '../render/ink.js';
import { garden } from '../ui/exposure.js';

const LEN = 75, POUR = 12, GOLD = [1.0, 0.82, 0.40];
// figures drawn in one unbroken chain for ×2, ×3 … ×8: the first steps come quickly, the last ones are earned (and a cut at the top costs the most)
const STEPS = [1, 2, 3, 5, 7, 10, 14];
export const MEDALS = [[6000, 'Dew'], [15000, 'Pearl'], [30000, 'Bloom'], [55000, 'Prism']];
// the figures the rain knows: what each is called, how it is written in a line of text, and its colour (on its thread, and in the garden)
export const FIGS = {
  line: { name: 'a line', glyph: '╱', col: [1.0, 0.88, 0.66] },
  wave: { name: 'a wave', glyph: '∿', col: [0.48, 0.96, 0.86] },
  arc: { name: 'an arc', glyph: '◠', col: [0.56, 0.8, 1.0] },
  ring: { name: 'a ring', glyph: '◉', col: [1.0, 0.56, 0.76] },
  spiral: { name: 'a spiral', glyph: '@', col: [0.78, 0.62, 1.0] },
  cross: { name: 'a cross', glyph: '✚', col: [1.0, 0.68, 0.4] },
  flower: { name: 'a flower', glyph: '✿', col: [0.7, 1.0, 0.5] },
};
const KINDS = Object.keys(FIGS);

export class Bloom {
  constructor(app, o = {}) {
    this.app = app; this.t = LEN; this.el = 0; this.score = 0; this.bestChain = 0; this.over = false; this.rain = 1.0; this.daily = o.daily || null; this.R = rng(this.daily ? hashStr('rain:' + this.daily) : ((Math.random() * 1e9) | 0) ^ 0x9e3779b9); this.calls = 0; this.seq = []; this.phase = 0; this.eaten = 0; this.startMass = Math.min(60, Math.max(40, o.mass || 40)); this.pausable = true;
    this.figs = []; this.drawnList = []; this.tally = {}; this.lvl = 0; this.bestMult = 1; this.cuts = 0; this.quiet = 0; this.tearT = -9; this.pour = false; this.said = {}; this.tickS = 0;
  }
  enter() {
    const app = this.app;
    app.travel((aspect) => {
      const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.30 }); const m = Math.min(W, H);
      for (const [u, v] of [[0.26, 0.28], [0.74, 0.28], [0.26, 0.72], [0.74, 0.72]]) geo.push({ op: 'add', t: 'circle', x: W * u, y: H * v, r: m * 0.062, mat: SURF.GLASS });
      // (cap: the creature blooms to a nimble size and no further — a giant's feelers would sweep the whole dish, and a giant cannot slip past a blade)
      return { name: 'Bloom', seed: 77, W, H, geo, ents: [], spawn: { x: W * 0.5, y: H * 0.62, n: this.startMass }, pal: { ...PAL.glass, deep: [0.040, 0.020, 0.090], mid: [0.150, 0.075, 0.300], pool: [0.220, 0.100, 0.330], wall: [0.170, 0.105, 0.340], rim: [0.86, 0.74, 1.0], accent: [1.0, 0.8, 0.45] }, cap: 100, decor: 0.5 };
    }, null, {
      onDark: () => app.applyBudget(),
      onLoad: (W) => { W.massCosts = false; W.chainGap = 2.4; },          // (a little longer for a streak to breathe than elsewhere: the rain, not the player, decides when the next figure falls)
      onReveal: () => { app.hud.showTitle(this.daily ? this.daily : '', this.daily ? 'Today\'s rain' : 'Bloom', 'take every star of a figure', 2.8); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('bloom'); },
    });
  }
  restart() { this.app.setMode(new Bloom(this.app, { daily: this.daily })); }
  pauseSub() { return `${this.daily ? 'Today\'s rain' : 'Bloom'} · ${this.score}`; }
  mult() { let k = 1; for (const q of STEPS) if (this.lvl >= q) k++; return k; }
  // how far the chain is toward the next step: [drawn, needed] since the last one (null at ×8)
  toNext() { const mu = this.mult(); if (mu > STEPS.length) return null; const a = STEPS[mu - 2] || 0; return [this.lvl - a, STEPS[mu - 1] - a]; }
  dbg() { const W = this.app.world; return { score: this.score, t: +this.t.toFixed(1), chain: W.chain, best: this.bestChain, mult: this.mult(), lvl: this.lvl, figs: this.figs.filter(F => !F.done && !F.failed).length, drawn: this.drawnList.length, cuts: this.cuts, quiet: this.quiet, phase: this.phase, pour: this.pour, live: W.pickups.length, eaten: this.eaten, mass: W.player ? W.player.mass : 0 }; }

  // ── figures of light ────────────────────────────────────────────────────
  _ok(W, x, y) { return x > 60 && y > 60 && x < W.spec.W - 60 && y < W.spec.H - 60 && W.phys.solidAt(x, y) > 22; }
  // pts: [[x, y, gold]] in the order the figure is drawn; segs: its thread, as pairs of indices. Stars that would fall on glass are left out (and their threads with them).
  _put(W, kind, pts, segs, o = {}) {
    const col = FIGS[kind].col, step = o.step ?? 0.055, ttl = o.ttl ?? 8.5; const stars = []; let k = 0;
    for (const [x, y, gold] of pts) {
      if (!this._ok(W, x, y)) { stars.push(null); continue; }
      stars.push(W.spawn({ type: 'mote', x, y, free: true, value: gold ? 4 : 1, gold: !!gold, col: gold ? GOLD : col, delay: 0.05 + k * step, ttl: ttl + k * step })); k++;
    }
    if (k < 4) return k;
    const F = { kind, col, pts: pts.map(p => [p[0], p[1]]), stars, segs: segs.filter(([i, j]) => stars[i] && stars[j]), n: k, left: k, done: false, failed: false, endT: 0 };
    for (const m of stars) if (m) m.fig = F;
    this.figs.push(F); return k;
  }
  figure(W) {
    const R = this.R, sw = W.spec.W, sh = W.spec.H; const P = W.player.focus; const fx = P && P.alive ? P.B.cx : sw / 2, fy = P && P.alive ? P.B.cy : sh / 2;
    const hard = Math.min(1, this.el / 55); const kind = R.pick(['line', 'line', 'wave', 'arc', 'ring', 'spiral', 'cross', 'flower']); const n = ++this.calls;
    // (every draw is taken whatever happens, and visits are counted in figures, not seconds: the day's rain is the same sequence for everyone, however fast they eat)
    const v = R(), v2 = R();
    // now and then the rain brings visitors: a school that crosses the dish (it scatters — worth the chase), or fireflies (only a lit one can be taken: eat to their beat)
    if (n > 5 && v < 0.15) { const vk = n < 12 || v2 < 0.5 ? 'school' : 'fireflies'; this.visit(W, vk); if (this.seq.length < 64) this.seq.push(vk); return; }
    // figures begin within reach of where you are, and lead away: the rain invites, it never ambushes… at first. Later it falls where it likes, and the chain must be carried there
    const a0 = R.range(0, TAU); const near = R() < 0.55 - 0.25 * hard && !this.daily;            // (the day's rain never leans toward wherever you happen to be)
    const sx = near ? fx + Math.cos(a0) * R.range(70, 150) : R.range(sw * 0.2, sw * 0.8), sy = near ? fy + Math.sin(a0) * R.range(70, 150) : R.range(sh * 0.2, sh * 0.8);
    const cx = R.range(sw * 0.24, sw * 0.76), cy = R.range(sh * 0.27, sh * 0.73); const pts = [], segs = []; const run = (a, b) => { for (let k = a; k < b; k++) segs.push([k, k + 1]); };
    if (kind === 'line') { const a = a0 + R.range(-0.9, 0.9), L = R.range(230, 380), n = 9; for (let k = 0; k < n; k++) pts.push([sx + Math.cos(a) * L * k / (n - 1), sy + Math.sin(a) * L * k / (n - 1), k === n - 1]); run(0, n - 1); }
    else if (kind === 'wave') { const a = a0 + R.range(-0.7, 0.7), L = R.range(260, 400), n = 11, amp = R.range(26, 46); for (let k = 0; k < n; k++) { const u = k / (n - 1), w = Math.sin(u * TAU * 1.25) * amp; pts.push([sx + Math.cos(a) * L * u - Math.sin(a) * w, sy + Math.sin(a) * L * u + Math.cos(a) * w, k === n - 1]); } run(0, n - 1); }
    else if (kind === 'arc') { const r = R.range(90, 150), n = 10, b0 = R.range(0, TAU), sp = R.range(2.2, 3.6) * R.sign(); for (let k = 0; k < n; k++) { const b = b0 + sp * k / (n - 1); pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, k === n - 1]); } run(0, n - 1); }
    else if (kind === 'ring') { const r = R.range(60, 84), n = 12, b0 = R.range(0, TAU); for (let k = 0; k < n; k++) { const b = b0 + k / n * TAU; pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, false]); } pts.push([cx, cy, true]); run(0, n - 1); segs.push([n - 1, 0]); for (const k of [0, 3, 6, 9]) segs.push([n, k]); }
    else if (kind === 'spiral') { const n = 13, dir = R.sign(), qx = R.range(sw * 0.32, sw * 0.68), qy = R.range(sh * 0.32, sh * 0.68); for (let k = 0; k < n; k++) { const u = k / (n - 1), b = a0 + dir * u * 7.2, r = 120 * (1 - u * 0.86); pts.push([qx + Math.cos(b) * r, qy + Math.sin(b) * r, k === n - 1]); } run(0, n - 1); }
    else if (kind === 'cross') { const a = R.range(0, TAU); for (let q = 0; q < 2; q++) for (let k = -3; k <= 3; k++) { if (q && !k) continue; const b = a + q * Math.PI / 2; pts.push([cx + Math.cos(b) * k * 30, cy + Math.sin(b) * k * 30, !q && !k]); } run(0, 6); segs.push([7, 8], [8, 9], [9, 3], [3, 10], [10, 11], [11, 12]); }
    else { const qx = sx + Math.cos(a0) * 60, qy = sy + Math.sin(a0) * 60, b0 = R.range(0, TAU); pts.push([qx, qy, true]); for (let k = 1; k <= 7; k++) { const b = b0 + k * 2.4, r = 20 + k * 6.5; pts.push([qx + Math.cos(b) * r, qy + Math.sin(b) * r, false]); segs.push([0, k]); } }
    const put = this._put(W, kind, pts, segs, { ttl: 10 - 3 * hard }); if (this.seq.length < 64) this.seq.push(`${kind}@${Math.round(pts[0][0])},${Math.round(pts[0][1])}`);      // (the rain as it fell: the day's rain must read the same for everyone)
    if (put < 4) this.rain = 0.2;       // the figure fell on glass: try again at once
  }
  visit(W, kind) {
    const R = this.R, sw = W.spec.W, sh = W.spec.H, n = this.visits = (this.visits || 0) + 1;
    if (kind === 'school') {
      const wide = sw >= sh, s = R.sign(), c0 = R.range(0.3, 0.7), amp = R.range(0.08, 0.16), path = [];
      for (let k = 0; k <= 8; k++) { const u = 0.1 + 0.8 * (s > 0 ? k / 8 : 1 - k / 8), v = c0 + amp * Math.sin(k / 8 * TAU); path.push(wide ? { x: sw * u, y: sh * v } : { x: sw * v, y: sh * u }); }
      for (const d of shoalOf('bloom' + n, path[0].x, path[0].y, 6, { path })) if (this._ok(W, d.x, d.y)) W.spawn({ ...d, ttl: 15 });
    } else {
      const cx = R.range(sw * 0.3, sw * 0.7), cy = R.range(sh * 0.3, sh * 0.7);
      for (const d of fireflyCloud(cx, cy, 7, 72, { period: 1.6, value: 2 })) if (this._ok(W, d.x, d.y)) W.spawn({ ...d, ttl: 13 });
    }
  }
  // a figure drawn whole: it rings out, the multiplier climbs, and the figure is etched into the dish for good
  _drawn(W, F) {
    F.done = true; F.endT = W.time; const was = this.mult(); this.lvl++; const mu = this.mult(), up = mu > was; this.bestMult = Math.max(this.bestMult, mu);
    const bonus = F.n * 10 * mu * (this.pour ? 2 : 1); this.score += bonus; this.tally[F.kind] = (this.tally[F.kind] || 0) + 1;
    const idx = [], pts = []; F.stars.forEach((m, k) => { if (m) { idx[k] = pts.length; pts.push(F.pts[k]); } });
    const G = { kind: F.kind, col: F.col, pts, segs: F.segs.map(([i, j]) => [idx[i], idx[j]]) }; this.drawnList.push(G); this._etch(W, G);
    let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length; cy /= pts.length; let rr = 0; for (const [x, y] of pts) rr = Math.max(rr, Math.hypot(x - cx, y - cy));
    W.fx.ring(cx, cy, F.col, rr + 40, 0.8, { a: 0.85, w: 2.6 });
    for (const [i, j] of G.segs) { const a = pts[i], b = pts[j]; for (let q = 0; q < 3; q++) { const u = Math.random(); W.fx.add({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 12, col: F.col, life: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 1.6, a: 0.9, drag: 2 }); } }
    const P = W.player.focus; if (P && P.alive) P.crown.joy();
    if (this.app.sound.drawn) this.app.sound.drawn(mu, (cx / W.spec.W) * 1.4 - 0.7, up); if (this.app.haptics) this.app.haptics.tick();
    this.app.hud.toast(`${up ? `×${mu} &nbsp;` : ''}${FIGS[F.kind].name} <small>+${bonus}${this.pour ? ' · twice' : ''}</small>`, FIGS[F.kind].glyph, 'cool');
  }
  // the garden: a drawn figure painted into the plate itself, faint, for the rest of the rain (and laid again if the plate is ever developed anew)
  _etch(W, G) {
    const R = this.app.R, c = G.col; let cx = 0, cy = 0; for (const [x, y] of G.pts) { cx += x; cy += y; } cx /= G.pts.length; cy /= G.pts.length; let rr = 0; for (const [x, y] of G.pts) rr = Math.max(rr, Math.hypot(x - cx, y - cy));
    const d = { x: cx, y: cy, bx: cx, by: cy, bakeR: rr + 18, baked: false, bake(ink) {
      this.baked = true;
      for (const [i, j] of G.segs) { const a = G.pts[i], b = G.pts[j]; ink.beam(a[0], a[1], b[0], b[1], 2.6, c[0], c[1], c[2], 0.08, PROF.glow); ink.beam(a[0], a[1], b[0], b[1], 0.8, c[0], c[1], c[2], 0.2, PROF.dust); }
      for (const [x, y] of G.pts) ink.light(x, y, 5, PROF.core, c[0], c[1], c[2], 0.3);
    } };
    W.etches.push(d); if (R && R.room && R.room.decals) R.room.decals.push(d); W.settle(d);
  }
  // the chain is torn — by silence, or by the dish (a blade's cut, a gear's teeth) — and the multiplier falls back to ×1
  _lose(W, why, x, y) {
    const lost = this.mult(), n = W.chain; this.lvl = 0;
    if (why === 'quiet') { this.quiet++; if (lost >= 3) { this.app.sound.torn && this.app.sound.torn(0.4); this.app.hud.toast(`the chain fell quiet <small>×${lost} → ×1</small>`, '◇'); } return; }
    W.chain = 0; W.chainT = -9; W.flow *= 0.3; this.cuts++;
    if (lost < 2 && n < 8) return;              // nothing much was riding on it: no fuss
    this.app.sound.torn && this.app.sound.torn(1); W.shake = Math.min(1, W.shake + 0.3); if (this.app.haptics) this.app.haptics.hurt();
    W.fx.ring(x, y, [1, 0.35, 0.3], 110, 0.55, { a: 0.8, w: 2.4 }); W.fx.burst(x, y, 10 + lost * 2, [1, 0.82, 0.5], 230, { life: 0.9, size: 2.4 });
    const first = !this.said[why]; this.said[why] = true;
    this.app.hud.toast(first ? `${why === 'gear' ? 'the gear tore' : 'the blade cut'} the chain <small>×${lost} → ×1</small>` : `cut <small>×${lost} → ×1</small>`, '✕');
  }

  // ── the dish wakes ──
  _warn(W, x, y, r) { for (let k = 0; k < 3; k++) W.fx.add({ x, y, type: 2, size: r * (1.4 - 0.2 * k), grow: -r * 0.5, life: 1.3 + k * 0.15, col: [1, 0.35, 0.3], a: 0.7, w: 2.4, drag: 0 }); W.sound && W.sound.hurt(0.4); }
  _wake(W) {
    const sw = W.spec.W, sh = W.spec.H, cx = sw / 2, cy = sh / 2; const m = Math.min(sw, sh); const hud = this.app.hud;
    if (this.phase === 0 && this.el > 18) { this.phase = 1; this._warn(W, cx, cy, 80); this.pending = { at: this.el + 1.5, d: { type: 'blade', x: cx, y: cy, len: m * 0.30, spin: 1.15 } }; hud.toast('a blade wakes <small>it cuts the chain</small>', '✺'); }
    else if (this.phase === 1 && this.el > 38) { this.phase = 2; const gx = cx + m * 0.30, gy = cy; this._warn(W, gx, gy, 50); this.pending = { at: this.el + 1.5, d: { type: 'grinder', x: gx, y: gy, r: 24, spin: 3, orbit: { x: cx, y: cy, r: m * 0.30, ry: m * 0.30, w: 0.42 } } }; hud.toast('a gear wakes <small>its teeth tear the chain</small>', '✺'); }
    else if (this.phase === 2 && this.el > 56) { this.phase = 3; for (const e of W.ents) { if (e.d.type === 'blade') e.spin *= 1.5; if (e.d.type === 'grinder' && e.orbit) e.orbit.w *= 1.5; } W.shake = 0.5; hud.toast('the dish is wide awake', '✺'); W.sound && W.sound.boom(); }
    else if (this.phase === 3 && this.t <= POUR) { this.phase = 4; this.pour = true; this.rain = 0.1; W.shake = 0.35; hud.toast('the downpour <small>every figure counts twice</small>', '❋', 'cool'); W.sound && W.sound.bloom(); }
    const Pd = this.pending; if (Pd && this.el >= Pd.at) { const F = W.player.focus; if (F && F.alive && Math.hypot(F.B.cx - Pd.d.x, F.B.cy - Pd.d.y) < 110) Pd.at = this.el + 0.3; else { W.spawn(Pd.d); W.fx.ring(Pd.d.x, Pd.d.y, [1, 0.4, 0.3], 120, 0.6); this.pending = null; } }
  }

  // ── world listener ────────────────────────────────────────────────────
  update(dt, W) {
    if (this.over) return; this.el += dt; this.t -= dt;
    const hard = Math.min(1, this.el / 55);
    this.rain -= dt; const live = W.pickups.length;
    if (this.rain <= 0 && live < 40) { this.rain = (live < 5 ? 0.45 : 2.5 - 0.7 * hard) * (this.pour ? 0.5 : 1); this.figure(W); }
    this._wake(W);
    // a blade need not part the gel to cut the chain: the moment its edge touches you, the thread is cut (the feelers may reach across it unharmed)
    if (W.phys.events.cuts > 0 && W.time - this.tearT > 0.8) { const F = W.player.focus, e = W.ents.find(q => q.d.type === 'blade' && !q.dead); if (F && F.alive && e) { this.tearT = W.time; const S = e.S, ux = Math.cos(S.angle), uy = Math.sin(S.angle), k = Math.max(-e.len / 2, Math.min(e.len / 2, (F.B.cx - S.x) * ux + (F.B.cy - S.y) * uy)); this._lose(W, 'blade', S.x + ux * k, S.y + uy * k); } }
    if (this.lvl && !W.chain) this._lose(W, 'quiet');
    // a figure with a star that faded can no longer be drawn: its thread snaps (the stars still left are still worth taking)
    for (const F of this.figs) if (!F.done && !F.failed && F.stars.some(m => m && m.dead && !m.took)) { F.failed = true; F.endT = W.time; }
    this.figs = this.figs.filter(F => !(F.done || F.failed) || W.time - F.endT < 0.8);
    for (const O of W.player.orgs) if (O !== W.player.focus && W.player.focus) { O.rallyTo = W.player.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }      // cut pieces hurry home by themselves: this is a game of rhythm, not of herding
    const s = Math.ceil(this.t); if (s <= 5 && s >= 1 && s !== this.tickS) { this.tickS = s; this.app.sound.tick && this.app.sound.tick(); }
    if (this.t <= 0) this.end();
  }
  mote(m, O, chain) {
    const W = this.app.world;
    if (chain === 1 && this.lvl) this._lose(W, 'quiet');           // (a chain that went quiet between two steps of the clock)
    const pts = (m.d.gold ? 50 : m.kind === 'shoal' ? 30 : m.kind === 'firefly' ? 25 : 10) * this.mult(); this.score += pts; this.eaten++;
    if (chain > this.bestChain) this.bestChain = chain;
    if (m.d.gold) W.fx.ring(m.x, m.y, GOLD, 60, 0.5, { a: 0.8 });
    const F = m.fig; if (F) { m.took = true; F.left--; if (!F.left && !F.failed && !F.done) this._drawn(W, F); }
  }
  // the dish cuts: a blade's edge, a gear's teeth (a moment's grace after each, so one brush is one cut)
  split(parent, child, cut) { if (!cut || this.over) return; const W = this.app.world; if (W.time - this.tearT < 0.8) return; this.tearT = W.time; const B = child && child.cx !== undefined ? child : parent; this._lose(W, 'blade', B ? B.cx : W.spec.W / 2, B ? B.cy : W.spec.H / 2); }
  hurt(B) { if (this.over || !B) return; const W = this.app.world; if (W.time - this.tearT < 0.8) return; this.tearT = W.time; this._lose(W, 'gear', B.cx, B.cy); }
  chainEnd() {}
  tier() {}                    // (the body's size is not this game's story — and its names, Pearl and Bloom, are this game's medals)
  post(dt, W) { if (!this.over && !W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 30); W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 120, 0.9); this.app.sound.bloom(); } }
  // each figure hangs on a thread: faint where nothing is taken yet, bright where it is; a figure about to lose a star flickers, a drawn one flares, a broken one goes out
  overlay(ov) {
    const W = this.app.world; if (!W || this.over) return; const t = W.time;
    for (const F of this.figs) {
      const S = F.stars;
      if (F.done || F.failed) {
        const k = Math.max(0, 1 - (t - F.endT) / 0.8); if (!k) continue; const col = F.done ? F.col : [1, 0.4, 0.34];
        for (const [i, j] of F.segs) ov.line(F.pts[i][0], F.pts[i][1], F.pts[j][0], F.pts[j][1], F.done ? 1 + 2.4 * k : 1, col, (F.done ? 0.9 : 0.4) * k);
        if (F.done) for (let i = 0; i < S.length; i++) if (S[i]) ov.glow(F.pts[i][0], F.pts[i][1], 9 + 10 * (1 - k), F.col, 0.6 * k);
        continue;
      }
      let warn = 1; for (const m of S) if (m && !m.took && m.ttl && m.ttl - m.age < 1.6) { warn = 0.45 + 0.55 * Math.abs(Math.sin(t * 9)); break; }
      for (const [i, j] of F.segs) {
        const a = S[i], b = S[j]; if (a.spawnT < 0 || b.spawnT < 0) continue; const lit = (a.took ? 1 : 0) + (b.took ? 1 : 0);
        ov.line(F.pts[i][0], F.pts[i][1], F.pts[j][0], F.pts[j][1], [1, 1.3, 1.8][lit], F.col, [0.16, 0.3, 0.62][lit] * (lit === 2 ? 1 : warn));          // (the thread keeps the figure's own shape, even while its light is being drawn in)
      }
    }
    // the fuse: while a multiplier rides on the chain and nothing has been taken for a moment, a ring round the creature burns down to the moment it falls quiet
    const P = W.player.focus, idle = t - W.chainT;
    if (P && P.alive && this.lvl && W.chain && idle > 0.45) {
      const left = Math.max(0, 1 - idle / W.chainGap), fade = Math.min(1, (idle - 0.45) / 0.3), low = left < 0.4, B = P.B;
      const col = low ? [1, 0.42 + 0.4 * left, 0.32] : [1, 0.86, 0.56], a = (low ? 0.4 + 0.4 * Math.abs(Math.sin(t * 11)) : 0.42) * fade;
      ov.ring(B.cx, B.cy, B.r + 22, 2.2, col, a, -Math.PI / 2, -Math.PI / 2 + TAU * left); ov.glow(B.cx + Math.cos(-Math.PI / 2 + TAU * left) * (B.r + 22), B.cy + Math.sin(-Math.PI / 2 + TAU * left) * (B.r + 22), 7, col, 0.8 * fade);
    }
  }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' && app.state !== 'in' || this.over) return;
    const mu = this.mult(); const tl = Math.max(0, Math.ceil(this.t));
    const nx = this.toNext(), pips = nx ? `<small class="pips">${'◆'.repeat(nx[0])}${'◇'.repeat(nx[1] - nx[0])}</small>` : '';
    app.hud.setTop({ light: this.score, total: 0, extra: `<b class="mu${mu > 1 ? ' hot' : ''}">×${mu}</b>${pips} &nbsp; ${W.chain >= 2 ? `♪ ${W.chain} &nbsp; ` : ''}<span class="${tl <= 10 ? 'warn' : ''}">${tl}s</span>` });
  }
  end() {
    this.over = true; const app = this.app, save = app.save, W = app.world; const prev = save.get('bloomBest', 0); const best = this.score > prev; if (best) save.set('bloomBest', this.score);
    if (this.bestChain > save.get('bloomChain', 0)) save.set('bloomChain', this.bestChain);
    const nf = this.drawnList.length; if (nf > save.get('bloomFigs', 0)) save.set('bloomFigs', nf);
    // the day's rain keeps the day's best (it counts as a Bloom too)
    const day = this.daily, dayWas = day && save.get('rainDay', '') === day ? save.get('rainBest', 0) : 0, dayBest = !!day && this.score > dayWas;
    if (day) { save.set('rainDay', day); if (dayBest) { save.set('rainBest', this.score); save.set('rainFigs', nf); } }
    let medal = ''; for (const [s, n] of MEDALS) if (this.score >= s) medal = n; const next = MEDALS.find(([s]) => this.score < s);
    app.sound.portal(); app.hud.setTop(null);
    const F = W.player.focus; if (F && F.alive) { F.crown.joy(); W.fx.ring(F.B.cx, F.B.cy, GOLD, 300, 1.2); W.fx.burst(F.B.cx, F.B.cy, 40, GOLD, 320, { life: 1.2, size: 3 }); }
    // the garden, as a picture: one for the card (it grows again there), one kept still for the album
    const zoom = app.hud.k || 1, pic = garden(app.R, W.spec, this.drawnList, { zoom, maxW: 430, maxH: typeof innerHeight !== 'undefined' && innerHeight > innerWidth ? 300 : 250 }), still = garden(app.R, W.spec, this.drawnList, { zoom: 1, maxW: 400, maxH: 300 });
    const kinds = KINDS.filter(k => this.tally[k]), glyphs = kinds.map(k => `<span style="color:rgb(${FIGS[k].col.map(v => Math.round(v * 255)).join(',')})">${FIGS[k].glyph}${this.tally[k] > 1 ? `<sub>${this.tally[k]}</sub>` : ''}</span>`).join(' ');
    const line = KINDS.map(k => FIGS[k].glyph.repeat(this.tally[k] || 0)).join('');
    if (medal && app.moment) app.moment(medal, `Bloom · ${this.score} · ${nf} figure${nf === 1 ? '' : 's'} drawn`, 'bloom:' + medal, still);
    // every figure the rain knows, drawn in one shower
    let found = ''; if (kinds.length === KINDS.length && save.trick('Garden')) { app.sound.trick(); const T = TRICKS.find(q => q[0] === 'Garden'); found = `<div class="d-trick">✦ Garden <span>${T ? T[1] : ''}</span></div>`; if (app.moment) app.moment('Garden', T ? T[1] : '', 'trick:Garden', still); }
    app.hud.panel(medal ? `${medal}` : 'The rain passes', `${day ? 'today\'s rain · ' : ''}${nf} figure${nf === 1 ? '' : 's'} drawn · longest chain ${this.bestChain} · best ×${this.bestMult}`, [
      { label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Bloom(app, { daily: day })); } },
      { label: 'Copy result', fn: (b) => { app.copyText(`MYRIA · Bloom${day ? ' · ' + day : ''}\n✦ ${this.score}${medal ? ' · ' + medal : ''}\n${line || '·'}\n${nf} figures · chain ${this.bestChain} · ×${this.bestMult}`); b.textContent = 'Copied ✓'; } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div class="b-garden"></div>${kinds.length ? `<div class="b-glyphs">${glyphs}</div>` : ''}<div style="font-size:52px;font-weight:200;letter-spacing:.08em;margin:6px 0 2px">${this.score}</div><div class="sub">${day ? (dayBest ? (dayWas ? 'a new best today' : 'today\'s first rain') : 'today\'s best ' + dayWas) : best ? 'a new brightest bloom' : 'best ' + prev}${next ? ` &nbsp;·&nbsp; ${next[1]} at ${next[0]}` : ''}</div>${found}
       <div class="medals">${MEDALS.map(([s, n]) => `<span class="${this.score >= s ? 'on' : ''}"><i></i>${n}</span>`).join('')}</div>`);
    const slot = app.hud.veil.querySelector('.b-garden'); if (slot && pic) { slot.appendChild(pic); if (pic.develop) pic.develop(); }
  }
}
