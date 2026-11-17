// ─────────────────────────────────────────────────────────────────────────────
//  Vigil — the dish is dying, and you are the last light in it.
//  Your light burns down a grain at a time (a little faster with every omen
//  seen, and faster the brighter you burn), so it has to be fed — and while an
//  omen rages, light falls only where the omen is worst. Each is announced
//  before it lands: the water leaves (the pools shrink, and the light falls in
//  one of them at a time), the frost comes in from the rim (the one warm spring
//  wanders, and the light lies out in the cold; frozen through, only a dart
//  cracks you free), the lid cracks and glass rains (a red seam shows each
//  shard's path a breath before it falls, and the glass leaves light in its
//  wake), the ground heaves (the way is shown first; every jolt shakes light
//  loose at the rim it throws you toward, where the gears grind), the water
//  turns (light spirals into a dark heart, richer the nearer it gets), the light
//  goes out (only your own glow lights the dish, and eyes in the dark burn
//  whatever moves). A lull of light follows each. After the first six they come
//  in pairs. At ten grains you are an ember, and an ember that eats nothing for
//  eight seconds goes out. The score is how long your light lasts; the story is
//  every omen you saw through.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { TAU, rng } from '../core/util.js';
import { PAL } from '../world/odyssey.js';
import { TRICKS } from './odyssey.js';
import { exposure } from '../ui/exposure.js';

const CALM = 7, WARN = 2.8, STORM = 18, LULL = 6, EMBER = 8;
export const VIGIL_MEDALS = [[90, 'Spark'], [180, 'Lantern'], [270, 'Beacon'], [360, 'Sun']];          // seconds the light lasted
export const OMENS = {
  drought: { name: 'The Drought', tell: 'the water is leaving — follow the light from pool to pool', col: [1, 0.74, 0.4], glyph: '◌' },
  frost: { name: 'The Frost', tell: 'the cold comes in from the rim — the one warm spring wanders', col: [0.62, 0.9, 1], glyph: '❄' },
  glass: { name: 'Glass Rain', tell: 'the lid is cracking — keep off the red seams', col: [1, 0.42, 0.36], glyph: '╲' },
  quake: { name: 'The Quake', tell: 'the ground heaves the way the arrows point — lean against it', col: [0.95, 0.8, 0.56], glyph: '≋' },
  maelstrom: { name: 'The Maelstrom', tell: 'the water turns — the nearer the dark, the richer the light', col: [0.74, 0.62, 1], glyph: '@' },
  eclipse: { name: 'The Eclipse', tell: 'the light is going out — be still against the rim when the eyes look', col: [0.82, 0.86, 1], glyph: '●' },
};
const IDS = Object.keys(OMENS);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Vigil {
  constructor(app, o = {}) {
    this.app = app; this.t = 0; this.phase = 'calm'; this.pt = 0; this.over = false; this.R = rng(((Math.random() * 1e9) | 0) ^ 0x5bd1e995); this.pausable = true;
    this.round = 0; this.queue = []; this.active = []; this.story = []; this.emberT = 0; this.lightT = 1; this.dark = 0; this.rec = []; this.recC = []; this.recT = 0; this.eaten = 0;
    this.burn = 0; this.burnt = 0; this.seenN = 0; this.hint = {};
  }
  enter() {
    const app = this.app;
    app.travel((aspect) => {
      const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.30 });
      return { name: 'Vigil', seed: 91, W, H, geo, ents: [], spawn: { x: W * 0.5, y: H * 0.5, n: 60 }, pal: { ...PAL.glass, deep: [0.030, 0.018, 0.030], mid: [0.110, 0.060, 0.085], pool: [0.170, 0.090, 0.110], wall: [0.200, 0.110, 0.120], rim: [1.0, 0.74, 0.58], accent: [1.0, 0.62, 0.42] }, cap: 120, decor: 0.6 };
    }, null, {
      onDark: () => app.applyBudget(),
      onLoad: (W) => { W.noMercy = true; this.g0 = [W.phys.gx, W.phys.gy]; for (let k = 0; k < 14; k++) this._light(W, true); },
      onReveal: () => { app.hud.showTitle('', 'Vigil', 'the dish is dying — keep your light', 3.2); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('abyss'); },
    });
  }
  exit() { const W = this.app.world; if (W && W.phys && this.g0) { W.phys.gx = this.g0[0]; W.phys.gy = this.g0[1]; } }
  restart() { this.app.setMode(new Vigil(this.app)); }
  pauseSub() { return `Vigil · ${mmss(this.t)}`; }
  dbg() { const W = this.app.world, m = W.player ? W.player.mass : 0; return { t: +this.t.toFixed(1), phase: this.phase, round: this.round, active: this.active.map(s => s.id), mass: m, burn: +this.burnRate(m).toFixed(2), burnt: this.burnt, ember: !!W.ember, emberT: +this.emberT.toFixed(1), story: this.story.length, seen: this.seenN, over: this.over, motes: W.pickups.filter(p => p.isMote && !p.dead).length, ents: W.ents.filter(e => !e.isMote).map(e => e.d.type).join(',') }; }
  // how fast the light burns down, in grains a second: a little faster with every omen seen through, and faster the brighter it is
  burnRate(m) { return 0.35 + 0.07 * this.seenN + 0.012 * m; }

  // ── places ──
  _rim(W, a, inset = 30) { const cx = W.spec.W / 2, cy = W.spec.H / 2; let x = cx, y = cy; for (let d = 0; d < 2000; d += 8) { const nx = cx + Math.cos(a) * d, ny = cy + Math.sin(a) * d; if (W.phys.solidAt(nx, ny) < inset) break; x = nx; y = ny; } return { x, y }; }
  _inside(W, x, y, m = 40) { return x > 40 && y > 40 && x < W.spec.W - 40 && y < W.spec.H - 40 && W.phys.solidAt(x, y) > m; }
  _spot(W, ok = () => true, tries = 40) { const R = this.R, sw = W.spec.W, sh = W.spec.H; for (let k = 0; k < tries; k++) { const x = R.range(sw * 0.1, sw * 0.9), y = R.range(sh * 0.1, sh * 0.9); if (this._inside(W, x, y, 46) && ok(x, y)) return { x, y }; } return null; }
  // n places at least `gap` apart (fewer if the dish will not hold them)
  _places(W, n, gap) { const out = []; for (let k = 0; k < 200 && out.length < n; k++) { const p = this._spot(W, (x, y) => out.every(q => Math.hypot(q.x - x, q.y - y) > gap), 1); if (p) out.push(p); } return out; }
  // a place inside circle c, between f0 and f1 of its radius out from the middle, that is open water
  _within(W, c, f0, f1) { const R = this.R; for (let q = 0; q < 12; q++) { const a = R.range(0, TAU), d = c.r * R.range(f0, f1), x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d; if (this._inside(W, x, y, 34)) return { x, y }; } return null; }
  // light: a grain of life. While an omen rages it falls where that omen is worst
  _light(W, any = false, at = null) {
    let p = at;
    if (!p && !any && this.phase === 'storm') { const ps = this.active.filter(s => s.place); if (ps.length) p = ps[(this.R() * ps.length) | 0].place(W); }
    if (!p) p = this._spot(W, (x, y) => any || this.active.every(s => !s.okLight || s.okLight(x, y)));
    if (!p) return null;
    return W.spawn({ type: 'mote', x: p.x, y: p.y, free: true, value: 2, col: [1, 0.86, 0.62], delay: 0.05 });
  }
  // something took a grain: it flies off as a droplet you could still catch, and the body flinches (the world's own crisp hurt)
  _sear(W, B, col) { const P = W.phys; if (!B || B.count < 3) return; for (let k = 0; k < 4; k++) { const i = P.bodyIdx[B.start + ((Math.random() * B.len) | 0)]; if (P.alive[i] && P.body[i] === B.id) { W.shed(i, B.cx, B.cy, col, 3); W.hurt(B, 1, B.cx, B.cy); return; } } }
  // the light burning down: a grain goes up as a spark, quietly (it is not a wound, only the dark winning by a grain)
  _burnGrain(W, B) {
    const P = W.phys; if (!B || B.count < 4) return;
    for (let k = 0; k < 6; k++) {
      const i = P.bodyIdx[B.start + ((Math.random() * B.len) | 0)]; if (!P.alive[i] || P.body[i] !== B.id) continue;
      const x = P.x[i], y = P.y[i]; P.kill(i); this.burnt++;
      W.fx.add({ x, y: Math.min(y, B.cy - B.r * 0.3), vx: (Math.random() - 0.5) * 26, vy: -48 - Math.random() * 30, col: [1, 0.72, 0.38], life: 1.6 + Math.random() * 0.7, size: 3.4, a: 0.9, drag: 0.35 });
      return;
    }
  }

  // ── the omens ───────────────────────────────────────────────────────────
  _begin(W, id, k) {
    const s = { id, k, t: 0, u: 0 }, sw = W.spec.W, sh = W.spec.H, mn = Math.min(sw, sh), cx = sw / 2, cy = sh / 2, R = this.R;
    if (id === 'drought') {
      s.pools = this._places(W, 3, mn * 0.4).map(p => ({ ...p, r: mn * 0.19 })); s.r0 = mn * 0.19; s.r1 = mn * Math.max(0.06, 0.085 - 0.01 * (k - 1));
      s.live = 0; s.nextLive = s.pools.length > 1 ? 1 : 0; s.swap = 3.6;
      s.okLight = (x, y) => { const p = s.pools[s.live]; return !!p && Math.hypot(x - p.x, y - p.y) < p.r * 0.7; };
      s.place = () => s.pools[s.live] ? this._within(W, s.pools[s.live], 0, 0.7) : null;
      // the floor cracks as it dries
      s.cracks = []; for (let q = 0; q < 46; q++) { const p = this._spot(W, () => true, 4); if (!p) continue; const seg = []; let x = p.x, y = p.y, a = R.range(0, TAU); for (let j = 0; j < 3; j++) { const l = R.range(10, 22), nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l; seg.push([x, y, nx, ny]); x = nx; y = ny; a += R.range(-1.1, 1.1); } s.cracks.push({ x: p.x, y: p.y, seg }); }
    } else if (id === 'frost') {
      const n = 4, a0 = R.range(0, TAU); s.fields = []; for (let q = 0; q < n; q++) { const p = this._rim(W, a0 + q * TAU / n, 24); s.fields.push({ ...p, r: 30 }); }
      s.R1 = mn * (0.42 + 0.05 * (k - 1)); s.spring = this._spring(W, s, null); s.move = 6.5; s.next = null;
      s.place = () => { const f = s.fields[(R() * s.fields.length) | 0]; return f && f.r > 70 ? this._within(W, f, 0.3, 0.85) : null; };      // the light lies out in the cold
    } else if (id === 'glass') { s.next = 0.5; s.shards = []; }
    else if (id === 'quake') {
      const ex = this._rim(W, 0, 24), ey = this._rim(W, Math.PI / 2, 24); const rx = Math.abs(ex.x - cx) - 64, ry = Math.abs(ey.y - cy) - 64; s.gears = [];
      const n = 2 + Math.min(2, k); for (let q = 0; q < n; q++) { const ph = q / n; const e = W.spawn({ type: 'grinder', x: cx + rx, y: cy, r: 24, spin: 3, orbit: { x: cx, y: cy, r: rx, ry, w: 0.24 * (q % 2 ? -1 : 1), p: ph * TAU } }); if (e) s.gears.push(e); }
      s.next = 1.8; s.jolt = 0; s.dir = null;
      s.place = () => { const p = this._rim(W, R.range(0, TAU), 70 + R() * 60); return this._inside(W, p.x, p.y, 40) ? p : null; };      // what the heaving shakes loose lies at the rim
    } else if (id === 'maelstrom') {
      const nz = W.phys.zones.length; s.e = W.spawn({ type: 'well', x: cx, y: cy, r: 20, reach: mn * 0.62, strength: 30000, swirl: 60000, bite: 1 }); s.z = W.phys.zones[nz] || null;
      s.place = () => { const a = R.range(0, TAU), d = mn * R.range(0.34, 0.5), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; return this._inside(W, x, y, 40) ? { x, y } : null; };
    } else if (id === 'eclipse') {
      s.eyes = []; const n = 2 + Math.min(2, k - 1), a0 = R.range(0, TAU);
      for (let q = 0; q < n; q++) { const p = this._rim(W, a0 + q * TAU / n, 26); const e = W.spawn({ type: 'watcher', x: p.x, y: p.y, range: mn * 0.86, half: 0.26, a: Math.atan2(cy - p.y, cx - p.x), sweep: 0.85, speed: 0.45 + 0.1 * q, phase: q * 1.7, burn: Math.max(0.14, 0.24 - 0.03 * (k - 1)) }); if (e) s.eyes.push(e); }
    }
    return s;
  }
  // where the warm spring wells up: open water near the middle, out of the cold, and not where it just was
  _spring(W, s, old) {
    const cx = W.spec.W / 2, cy = W.spec.H / 2, mn = Math.min(W.spec.W, W.spec.H);
    const ok = (strict) => (x, y) => Math.hypot(x - cx, y - cy) < mn * (strict ? 0.3 : 0.4) && (!old || Math.hypot(x - old.x, y - old.y) > mn * (strict ? 0.24 : 0.14)) && (!strict || s.fields.every(f => Math.hypot(x - f.x, y - f.y) > f.r + 60));
    const p = this._spot(W, ok(true), 40) || this._spot(W, ok(false), 40) || { x: cx, y: cy }; return { x: p.x, y: p.y, r: 46 };
  }
  _step(W, s, dt) {
    s.t += dt; s.u = Math.min(1, s.t / STORM); const k = s.k, P = W.phys, pl = W.player, sw = W.spec.W, sh = W.spec.H, cx = sw / 2, cy = sh / 2;
    if (s.id === 'drought') {
      const r = s.r0 + (s.r1 - s.r0) * Math.min(1, s.u * 1.3); for (const p of s.pools) p.r = r;
      // the light moves on from pool to pool (the next one glimmers first) and a little falls in it at once
      s.swap -= dt;
      if (s.swap <= 0 && s.pools.length > 1) {
        s.live = s.nextLive; do { s.nextLive = (this.R() * s.pools.length) | 0; } while (s.nextLive === s.live); s.swap = Math.max(2.6, 4.2 - 0.4 * (k - 1));
        const p = s.pools[s.live], at = this._within(W, p, 0, 0.6); if (at) this._light(W, true, at);
        this.app.sound.chime(4); W.fx.ring(p.x, p.y, [1, 0.86, 0.55], p.r * 1.2, 0.6, { a: 0.6 });
      }
      for (const O of pl.orgs) {
        if (!O.alive) continue; const B = O.B; if (s.pools.some(p => Math.hypot(B.cx - p.x, B.cy - p.y) < p.r + B.r * 0.25)) { O.dry = 0; continue; }
        O.dry = (O.dry || 0) + dt; if (O.dry > 0.5 / (0.8 + 0.2 * k)) { O.dry = 0; this._sear(W, B, [1, 0.82, 0.55]); }
        if (Math.random() < dt * 14) W.fx.add({ x: B.cx + (Math.random() - 0.5) * B.r * 1.4, y: B.cy - B.r * 0.4, vx: (Math.random() - 0.5) * 16, vy: -40 - Math.random() * 30, col: [1, 0.9, 0.8], life: 0.9, size: 2 + Math.random() * 2, a: 0.35, drag: 0.6 });      // it steams
      }
    } else if (s.id === 'frost') {
      const r = 30 + (s.R1 - 30) * Math.min(1, s.u * 1.35); for (const f of s.fields) f.r = r; const rate = 0.5 + 0.15 * k;
      // the spring wanders: where it will well up next shows first, and the old one dies away
      s.move -= dt; if (s.move < 1.6 && !s.next) s.next = this._spring(W, s, s.spring);
      if (s.move <= 0) { if (s.next) { s.spring = s.next; this.app.sound.ripe(); W.fx.ring(s.spring.x, s.spring.y, [1, 0.6, 0.3], s.spring.r * 2, 0.6, { a: 0.7 }); } s.next = null; s.move = Math.max(4.2, 6.5 - 0.5 * (k - 1)); }
      const sp = s.spring;
      for (const O of pl.orgs) {
        if (!O.alive) continue; const B = O.B; let cold = 0;
        for (const f of s.fields) { const d = Math.hypot(B.cx - f.x, B.cy - f.y); if (d < f.r) cold = Math.max(cold, 0.5 + 0.5 * (1 - d / f.r)); }
        if (cold) O.heat = Math.max(-1, O.heat - rate * dt * cold);
        if (Math.hypot(B.cx - sp.x, B.cy - sp.y) < sp.r + B.r * 0.3) { if (O.heat < 0.9 && Math.random() < dt * 5) this.app.sound.heal(); O.heat = Math.min(1, O.heat + 2.4 * dt); }
        if (O.heat < -0.92) {      // frostbite: frozen through, it starts to flake
          O.bite = (O.bite || 0) + dt; if (O.bite > 0.75) { O.bite = 0; this._sear(W, B, [0.7, 0.92, 1]); }
          if (O === pl.focus && !this.hint.ice) { this.hint.ice = true; this.app.hud.toast('frozen through — a dart cracks the ice', '❄', 'cool'); }
        } else O.bite = 0;
      }
    } else if (s.id === 'glass') {
      s.next -= dt; if (s.next <= 0 && s.u < 0.96) { s.next = Math.max(0.8, 1.8 - 0.22 * (k - 1)) * (0.75 + 0.5 * this.R()); s.shards.push(this._shard(W, k)); }
      for (const q of s.shards) {
        q.t += dt; if (!q.e && q.t >= q.warn) { q.e = W.spawn({ type: 'blade', x: q.ax, y: q.ay, len: 150, spin: 0, a: Math.atan2(q.dy, q.dx) }); this.app.sound.whoosh(); }
        if (q.e && !q.done) {
          q.p += q.v * dt; q.e.x = q.ax + q.dx * q.p; q.e.y = q.ay + q.dy * q.p;
          while (q.drops.length && q.p - 95 > q.drops[0]) { const d = q.drops.shift(); const m = this._light(W, true, { x: q.ax + q.dx * d, y: q.ay + q.dy * d }); if (m) { m.vx = q.dx * 70; m.vy = q.dy * 70; } }      // the glass leaves light in its wake
          if (q.p > q.L) { q.e.dead = true; q.e.S.active = false; q.done = true; }
        }
      }
      s.shards = s.shards.filter(q => !q.done);
    } else if (s.id === 'quake') {
      s.next -= dt;
      if (!s.dir && s.next < 0.9) { const a = this.R.range(0, TAU); s.dir = [Math.cos(a), Math.sin(a)]; this.app.sound.haunt(); }      // the way it will heave is shown first
      if (s.next <= 0 && s.u < 0.97) {
        s.next = Math.max(1.5, 2.7 - 0.3 * (k - 1)); s.jolt = 0.45; const g = 1250 + 250 * k; s.g = [s.dir[0] * g, s.dir[1] * g];
        const a = Math.atan2(s.dir[1], s.dir[0]); for (const q of [-0.5, 0.5]) { const p = this._rim(W, a + q * 0.5, 80); if (this._inside(W, p.x, p.y, 40)) this._light(W, true, p); }      // it shakes light loose at the rim it throws you toward
        s.dir = null; W.shake = 0.9; this.app.sound.boom(); if (this.app.haptics) this.app.haptics.thump(1);
      }
      if (s.jolt > 0) { s.jolt -= dt; P.gx = s.g[0]; P.gy = s.g[1]; if (s.jolt <= 0) { P.gx = this.g0[0]; P.gy = this.g0[1]; } }
    } else if (s.id === 'maelstrom') {
      if (s.z) { const f = Math.min(1, s.u * 1.4); s.z.strength = 26000 + (40000 + 22000 * (k - 1)) * f; s.z.swirl = 55000 + 40000 * f; }
      // light near the dark heart is drawn in, round and round — and the nearer the end it gets, the richer it is
      const reach = Math.min(sw, sh) * 0.62;
      for (const p of W.pickups) { if (!p.isMote || p.dead || p.held || p.spawnT < 0) continue; const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) + 1; if (d > reach) continue; p.free = true; if (p.baked) W.release(p); const near = 1 - d / reach; p.value = Math.max(p.value, 2 + Math.floor(3 * near * near)); const f = near * (60 + 40 * k) * dt; p.vx += (dx / d * 0.35 - dy / d) * f; p.vy += (dy / d * 0.35 + dx / d) * f; }
    }
    // (the eclipse needs no step of its own: its eyes burn by themselves, and the dark is drawn)
  }
  _end(W, s) {
    if (s.id === 'quake') { for (const e of s.gears) { e.dead = true; e.S.active = false; } W.phys.gx = this.g0[0]; W.phys.gy = this.g0[1]; }
    else if (s.id === 'glass') { for (const q of s.shards) if (q.e) { q.e.dead = true; q.e.S.active = false; } }
    else if (s.id === 'maelstrom') { if (s.e) s.e.dead = true; if (s.z) { const i = W.phys.zones.indexOf(s.z); if (i >= 0) W.phys.zones.splice(i, 1); } const j = W.wells.findIndex(w => w.x === W.spec.W / 2 && w.y === W.spec.H / 2); if (j >= 0) W.wells.splice(j, 1); }
    else if (s.id === 'eclipse') { for (const e of s.eyes) e.dead = true; }
    else if (s.id === 'frost') for (const O of W.player.orgs) { O.bite = 0; if (O.alive && O.heat < -0.3) { O.heat = -0.3; W.fx.burst(O.B.cx, O.B.cy, 14, [0.75, 0.95, 1], 220, { life: 0.6, size: 2.2, type: 1 }); } }      // the cold lets go: whatever was frozen thaws
  }
  // a shard of the lid: a red seam across the dish first, then the glass itself, edge-on, along it — and a little light where it has been
  _shard(W, k) {
    const R = this.R, sw = W.spec.W, sh = W.spec.H, a = R.range(0, TAU), dx = Math.cos(a), dy = Math.sin(a);
    const qx = R.range(sw * 0.25, sw * 0.75), qy = R.range(sh * 0.25, sh * 0.75); const F = W.player.focus, aim = F && F.alive && R() < (this.round <= 1 ? 0.25 : 0.4);
    const tx = aim ? F.B.cx : qx, ty = aim ? F.B.cy : qy;      // (some are aimed where you are: none of them where you will be)
    const L = Math.hypot(sw, sh), ax = tx - dx * L * 0.5, ay = ty - dy * L * 0.5;
    const open = []; for (let i = 1; i < 30; i++) { const p = L * i / 30; if (this._inside(W, ax + dx * p, ay + dy * p, 50)) open.push(p); }
    const drops = []; for (let q = 0; q < 1 && open.length; q++) drops.push(open.splice((R() * open.length) | 0, 1)[0]); drops.sort((u, v) => u - v);
    return { t: 0, warn: Math.max(0.7, 1.1 - 0.1 * (k - 1)), ax, ay, dx, dy, L, p: 0, v: 560 + 60 * k, e: null, done: false, drops };
  }

  // ── the clock of the end ──────────────────────────────────────────────
  _next() {
    const R = this.R;
    if (!this.queue.length) {
      this.round++; const ids = IDS.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
      if (this.round === 1) { const gentle = ['drought', 'frost', 'glass']; const i = ids.findIndex(id => gentle.includes(id)); ids.unshift(ids.splice(i, 1)[0]); this.queue = ids.map(id => [id]); }        // (a first vigil opens on one of the gentler omens: it should see what it is up against before the dark, the heave or the maelstrom)
      else { this.queue = []; for (let i = 0; i + 1 < ids.length; i += 2) this.queue.push([ids[i], ids[i + 1]]); }
    }
    return this.queue.shift();
  }
  update(dt, W) {
    if (this.over) return; const pl = W.player; this.t += dt; this.pt += dt;
    if (this.phase === 'calm' && this.pt >= CALM) this._warn(W);
    else if (this.phase === 'warn' && this.pt >= WARN) { this.phase = 'storm'; this.pt = 0; const k = this.round; this.active = this.cur.map(id => this._begin(W, id, k)); W.shake = Math.max(W.shake, 0.4); }
    else if (this.phase === 'storm') { for (const s of this.active) this._step(W, s, dt); if (this.pt >= STORM) this._weather(W); }
    else if (this.phase === 'lull' && this.pt >= LULL) this._warn(W);
    // the dark comes and goes with the eclipse
    const want = this.phase === 'storm' && this.active.some(s => s.id === 'eclipse') ? 1 : 0; this.dark += (want - this.dark) * Math.min(1, dt * (want ? 0.9 : 1.6));
    // light keeps falling — in a storm only where the omen is worst, and more thinly as the end goes on
    this.lightT -= dt; if (this.lightT <= 0) { this.lightT = this.phase === 'storm' ? 1.15 + 0.12 * this.round : 1.7; if (W.pickups.filter(p => p.isMote && !p.dead).length < 26) this._light(W); }
    // pieces cut away hurry home (a vigil is about weather, not herding)
    for (const O of pl.orgs) if (O !== pl.focus && pl.focus) { O.rallyTo = pl.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.1); }
    // the light burns down (not an ember's: an ember has its own clock)
    const F = pl.focus;
    if (F && F.alive && !W.ember && this.t > 3) {
      this.burn += dt * this.burnRate(pl.mass); while (this.burn >= 1) { this.burn -= 1; this._burnGrain(W, F.B); }
      if (!this.hint.burn && this.burnt >= 2) { this.hint.burn = true; this.app.hud.toast('your light burns down — keep it fed', '✧'); }
    }
    // an ember that eats nothing for eight seconds goes out
    if (W.ember) { this.emberT += dt; if (!this.hint.ember) { this.hint.ember = true; this.app.hud.toast('an ember — eat within eight seconds, or the light goes out', '✺'); } } else this.emberT = 0;
    if (this.rec.length < 4000 && (this.recT += dt) >= 0.1) { this.recT -= 0.1; if (F && F.alive) { const sp = W.spec, land = sp.W >= sp.H; this.rec.push(land ? [F.B.cx / sp.W, F.B.cy / sp.H] : [F.B.cy / sp.H, F.B.cx / sp.W]); this.recC.push(this._hue()); } }
    if (pl.mass <= 0 || !pl.orgs.some(o => o.alive) || this.emberT > EMBER) this.end();
  }
  // the colour the way is drawn in on the picture at the end: candlelight between omens, the omen's own colour while it rages
  _hue() { if (this.phase !== 'storm' || !this.cur) return [1, 0.8, 0.55]; const c = [0, 0, 0]; for (const id of this.cur) for (let j = 0; j < 3; j++) c[j] += OMENS[id].col[j] / this.cur.length; return c; }
  _warn(W) {
    const ids = this._next(); this.cur = ids; this.phase = 'warn'; this.pt = 0; const n = this.story.length + 1, hud = this.app.hud;
    this.story.push({ ids, at: this.t, ok: null });
    hud.showTitle(ids.length > 1 ? `omens ${n}` : `omen ${n}`, ids.map(id => OMENS[id].name).join(' + '), ids.map(id => OMENS[id].tell).join(' · '), WARN + 0.4);
    this.app.sound.haunt(); W.shake = Math.max(W.shake, 0.25);
  }
  _weather(W) {
    for (const s of this.active) this._end(W, s); const st = this.story[this.story.length - 1]; if (st) { st.ok = true; this.seenN += st.ids.length; }
    this.active = []; this.phase = 'lull'; this.pt = 0; this.app.sound.bloom();
    this.app.hud.toast(`${st ? st.ids.map(id => OMENS[id].name).join(' + ') : 'the omen'} passes <small>${mmss(this.t)}</small>`, '✓', 'cool');
    // a lull of light: a ring of it round you (a thinner ring as the end goes on), and the dish breathes
    const F = W.player.focus, sw = W.spec.W, sh = W.spec.H; const fx = F && F.alive ? F.B.cx : sw / 2, fy = F && F.alive ? F.B.cy : sh / 2, n = Math.max(6, 14 - 2 * this.round);
    for (let q = 0; q < n; q++) { const a = q / n * TAU, d = 110 + (q % 2) * 70, x = fx + Math.cos(a) * d, y = fy + Math.sin(a) * d; if (this._inside(W, x, y, 40)) this._light(W, true, { x, y }); }
    // all six seen through in a single vigil
    if (this.story.filter(q => q.ok).reduce((a, q) => a + q.ids.length, 0) >= IDS.length && new Set(this.story.filter(q => q.ok).flatMap(q => q.ids)).size === IDS.length && this.app.save.trick('Lighthouse')) { this.app.hud.toast('Lighthouse', '✦'); this.app.sound.trick(); const T = TRICKS.find(q => q[0] === 'Lighthouse'); if (this.app.moment) this.app.moment('Lighthouse', T ? T[1] : '', 'trick:Lighthouse'); }
  }

  // ── world listener ──
  mote(m) { this.eaten++; this.emberT = 0; }
  split(parent, child, cut) { if (!cut || this.over) return; const W = this.app.world; this._sear(W, parent, [1, 0.5, 0.4]); this._sear(W, parent, [1, 0.5, 0.4]); }       // glass takes a little with every cut
  tier() {}
  chainEnd() {}

  // ── what the omens look like ──
  overlay(ov, R) {
    const W = this.app.world; if (!W || !W.player) return; const t = W.time, F = W.player.focus;
    if (this.dark > 0.02 && F && F.alive) this._darkness(W, ov, R, F);
    const warnU = this.phase === 'warn' ? this.pt / WARN : 1;
    for (const s of (this.phase === 'storm' ? this.active : [])) {
      if (s.id === 'drought') {
        const ca = 0.26 * Math.min(1, s.u * 2.2);
        if (ca > 0.02) for (const c of s.cracks) { if (s.pools.some(p => Math.hypot(c.x - p.x, c.y - p.y) < p.r + 10) || F && F.alive && Math.hypot(c.x - F.B.cx, c.y - F.B.cy) < F.B.r * 0.9) continue; for (const g of c.seg) ov.line(g[0], g[1], g[2], g[3], 1.1, [1, 0.8, 0.55], ca); }
        s.pools.forEach((p, i) => {
          const live = i === s.live, next = i === s.nextLive && s.swap < 1.3;
          ov.glow(p.x, p.y, p.r * 1.1, [0.2, 0.5, 1], 0.18, 1); ov.ring(p.x, p.y, p.r + 5, 5, [0.25, 0.55, 1], 0.12); ov.ring(p.x, p.y, p.r, 1.6, live ? [1, 0.84, 0.5] : [0.4, 0.75, 1], live ? 0.75 : 0.4);      // (the pool the light falls in has a golden waterline)
          for (let q = 0; q < 3; q++) { const u = (t * 0.35 + q / 3) % 1; ov.ring(p.x, p.y, p.r * (0.2 + 0.75 * u), 1, [0.5, 0.82, 1], 0.28 * (1 - u)); }
          if (live) { ov.glow(p.x, p.y, p.r * 0.9, [1, 0.8, 0.45], 0.16 + 0.05 * Math.sin(t * 3), 1); for (let q = 0; q < 5; q++) { const a = t * 0.7 + q * 1.257, rr = p.r * (0.3 + 0.4 * ((q * 0.37 + t * 0.2) % 1)); ov.glow(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 4, [1, 0.9, 0.6], 0.5 + 0.3 * Math.sin(t * 5 + q)); } }
          if (next) { const w = 0.5 + 0.5 * Math.sin(t * 16); ov.ring(p.x, p.y, p.r * 0.86, 1.6, [1, 0.86, 0.55], 0.2 + 0.4 * w); }
        });
      } else if (s.id === 'frost') {
        for (const f of s.fields) {
          ov.glow(f.x, f.y, f.r * 1.05, [0.6, 0.85, 1], 0.14, 1); ov.ring(f.x, f.y, f.r, 1.2, [0.92, 0.98, 1], 0.4);
          // a rim of ice crystals: a jagged edge, points of rime reaching in
          const nT = Math.max(14, Math.min(72, Math.round(f.r / 7))), sc = Math.min(1, f.r / 120); let px = 0, py = 0;
          for (let q = 0; q <= nT; q++) { const a = q / nT * TAU + f.x * 0.003, rr = f.r - (q % 2 ? (q % 4 === 1 ? 13 : 7) * sc : 0), x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr; if (q) ov.line(px, py, x, y, 1.2, [0.9, 0.97, 1], 0.5); px = x; py = y; }
          for (let q = 0; q < 9; q++) { const a = q * 2.399 + f.x * 0.01, rr = f.r * Math.sqrt((q + 0.5) / 9); ov.glow(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 5, [0.85, 0.97, 1], 0.4 + 0.3 * Math.sin(t * 2 + q)); }
        }
        const sp = s.spring, fade = s.next ? Math.max(0.2, s.move / 1.6) : 1; ov.glow(sp.x, sp.y, sp.r * 2, [1, 0.55, 0.25], 0.22 * fade, 1); for (let q = 0; q < 3; q++) { const u = (t * 0.5 + q / 3) % 1; ov.ring(sp.x, sp.y, sp.r * (0.25 + 0.75 * u), 1.6, [1, 0.6, 0.3], 0.55 * (1 - u) * fade); }
        if (s.next) { const u = 1 - Math.max(0, s.move) / 1.6, nx = s.next; ov.glow(nx.x, nx.y, nx.r * 1.6, [1, 0.55, 0.25], 0.16 * u, 1); ov.ring(nx.x, nx.y, nx.r * (1.6 - 0.8 * u), 1.6, [1, 0.62, 0.32], 0.2 + 0.5 * u); }
      } else if (s.id === 'glass') for (const q of s.shards) {
        const n = 24;
        if (!q.e) { const u = q.t / q.warn, a = 0.25 + 0.55 * u * (0.6 + 0.4 * Math.abs(Math.sin(t * 18))); for (let i = 0; i < n; i += 2) { const p0 = q.L * i / n, p1 = q.L * (i + 1) / n; ov.line(q.ax + q.dx * p0, q.ay + q.dy * p0, q.ax + q.dx * p1, q.ay + q.dy * p1, 1.4 + u, [1, 0.35, 0.3], a); } }
        else {
          // the seam still shows ahead of the glass, and the glass draws a streak behind it
          const head = q.p + 85; for (let i = 0; i < n; i += 2) { const p0 = Math.max(head, q.L * i / n), p1 = q.L * (i + 1) / n; if (p1 > p0) ov.line(q.ax + q.dx * p0, q.ay + q.dy * p0, q.ax + q.dx * p1, q.ay + q.dy * p1, 1.2, [1, 0.35, 0.3], 0.3); }
          const tx = q.e.x - q.dx * 75, ty = q.e.y - q.dy * 75; for (let j = 0; j < 3; j++) ov.line(tx - q.dx * j * 40, ty - q.dy * j * 40, tx - q.dx * (j + 1) * 40, ty - q.dy * (j + 1) * 40, 3 - 0.7 * j, [1, 0.55, 0.45], 0.28 - 0.08 * j);
        }
      } else if (s.id === 'quake' && s.dir) {
        const u = 1 - s.next / 0.9, cx = W.spec.W / 2, cy = W.spec.H / 2, [dx, dy] = s.dir, px = -dy, py = dx;
        for (let q = -2; q <= 2; q++) for (let j = 0; j < 3; j++) { const ox = cx + px * q * 120 + dx * (j * 34 + u * 40 - 40), oy = cy + py * q * 120 + dy * (j * 34 + u * 40 - 40), w = 16; ov.line(ox - dx * 12 + px * w, oy - dy * 12 + py * w, ox, oy, 2, [1, 0.82, 0.55], 0.25 + 0.5 * u); ov.line(ox - dx * 12 - px * w, oy - dy * 12 - py * w, ox, oy, 2, [1, 0.82, 0.55], 0.25 + 0.5 * u); }
      } else if (s.id === 'maelstrom') {
        const cx = W.spec.W / 2, cy = W.spec.H / 2, r = Math.min(W.spec.W, W.spec.H) * 0.62; for (let q = 0; q < 5; q++) { const u = 1 - ((t * 0.25 + q / 5) % 1); ov.ring(cx, cy, r * (0.15 + 0.85 * u), 1.2, [0.7, 0.6, 1], 0.22 * (1 - u) + 0.04, t * 1.4 + q, t * 1.4 + q + 2.6); }
        { const lip = 130, d = F && F.alive ? Math.hypot(F.B.cx - cx, F.B.cy - cy) - F.B.r : 1e9, near = Math.max(0, Math.min(1, 1 - (d - lip) / 160)); ov.ring(cx, cy, lip, 1.4 + 1.4 * near, [1, 0.45 - 0.2 * near, 0.6 - 0.3 * near], 0.18 + 0.5 * near * (0.7 + 0.3 * Math.sin(t * 12)), t * -2, t * -2 + 5.6); }      // the lip: inside it the dark has you
        for (const p of W.pickups) if (p.isMote && !p.dead && p.value > 2 && p.spawnT > 0) { const v = p.value - 2; ov.glow(p.x, p.y, 8 + 5 * v, [0.88, 0.78, 1], 0.14 + 0.1 * v + 0.06 * Math.sin(t * 9 + p.seed * 9)); }      // the richest light, nearest the dark
      }
    }
    // the omen as it is announced: its colour breathes at the rim of the dish
    if (this.phase === 'warn' && this.cur) { const c = OMENS[this.cur[0]].col, cx = W.spec.W / 2, cy = W.spec.H / 2, r = Math.min(W.spec.W, W.spec.H) * 0.48; ov.ring(cx, cy, r * (1.25 - 0.2 * warnU), 3, c, 0.3 * Math.sin(warnU * Math.PI)); }
    // an ember burning down: a ring round it that empties toward the moment it goes out
    if (F && F.alive && this.emberT > 0) { const left = 1 - this.emberT / EMBER, B = F.B, col = [1, 0.4 + 0.4 * left, 0.25]; ov.ring(B.cx, B.cy, B.r + 20, 2.4, col, 0.5 + 0.4 * Math.abs(Math.sin(t * (6 + 8 * (1 - left)))), -Math.PI / 2, -Math.PI / 2 + TAU * left); }
  }
  // the eclipse: the plate goes dark except round your own glow; what burns in the dark (eyes, blades, gears, the well) and every grain of light still glints through
  _darkness(W, ov, R, F) {
    const c = R.ctx, fb = R.fb, v = R.view; if (!c || typeof document === 'undefined') return;
    const x = (F.B.cx - v.ox) * v.z, y = (F.B.cy - v.oy) * v.z, r0 = (F.B.r + 50) * v.z, r1 = (F.B.r + 230) * v.z;
    c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, this.dark);
    const g = c.createRadialGradient(x, y, r0, x, y, r1); g.addColorStop(0, 'rgba(3,2,9,0)'); g.addColorStop(1, 'rgba(3,2,9,0.94)'); c.fillStyle = g; c.fillRect(0, 0, fb.w, fb.h); c.restore();
    fb.mark(0, 0, fb.w, fb.h); ov.begin();
    for (const e of W.ents) if (!e.dead && e.over && (e.watch || e.d.type === 'blade' || e.d.type === 'grinder' || e.d.type === 'well')) e.over(ov, R);
    for (const p of W.pickups) if (p.isMote && !p.dead && p.spawnT > 0) { const w = 0.5 + 0.5 * Math.sin(W.time * 3 + p.seed * 20); ov.glow(p.x, p.y, 7 + 3 * w, p.col, (0.25 + 0.3 * w) * this.dark); }
  }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' && app.state !== 'in' || this.over || !W.player) return;
    const st = this.phase === 'storm' ? Math.max(0, Math.ceil(STORM - this.pt)) : 0, names = this.phase === 'storm' && this.cur ? this.cur.map(id => `<b style="color:rgb(${OMENS[id].col.map(q => Math.round(q * 255)).join(',')})">${OMENS[id].glyph}</b>`).join('') : '';
    app.hud.setTop({ light: W.player.mass, total: 0, extra: `<span class="${W.ember ? 'warn' : ''}">${mmss(this.t)}</span>${names ? ` &nbsp; ${names} ${st}s` : this.phase === 'lull' ? ' &nbsp; <small>lull</small>' : ''}` });
  }
  end() {
    if (this.over) return; this.over = true; const app = this.app, save = app.save, W = app.world, secs = Math.floor(this.t);
    const st = this.story[this.story.length - 1]; if (st && st.ok === null) st.ok = false; const lost = st && st.ok === false ? st : null;
    for (const s of this.active) this._end(W, s); this.active = []; this.dark = 0;
    const weathered = this.story.filter(q => q.ok).length, prev = save.get('vigilBest', 0), best = secs > prev; if (best) save.set('vigilBest', secs); if (weathered > save.get('vigilOmens', 0)) save.set('vigilOmens', weathered);
    let medal = ''; for (const [s, n] of VIGIL_MEDALS) if (secs >= s) medal = n; const next = VIGIL_MEDALS.find(([s]) => secs < s);
    app.hud.setTop(null); app.sound.portal();
    const short = typeof innerHeight === 'number' && innerHeight < 800, pic = exposure(app.R, W.spec, this.rec, { zoom: app.hud.k || 1, cols: this.recC, maxH: short ? 150 : 220 });
    if (medal && app.moment) app.moment(medal, `Vigil · ${mmss(secs)} · ${weathered} omen${weathered === 1 ? '' : 's'} seen through`, 'vigil:' + medal, pic);
    const name = (q) => q.ids.map(id => OMENS[id].name).join(' + '), glyph = (q) => q.ids.map(id => OMENS[id].glyph).join('');
    // the story: the last few omens in full, anything earlier as a line of glyphs (a long vigil should not push "Again" off the card)
    const told = this.story.filter(q => q.ok !== null), keep = short ? 4 : 6, early = told.length > keep + 2 ? told.slice(0, told.length - keep) : [];
    const rows = told.slice(early.length).map(q => `<div><i>${mmss(q.at)}</i><b style="color:${q.ok ? 'inherit' : '#ff9b85'}">${glyph(q)}</b><span>${name(q)}${q.ok ? '' : ' — went out'}</span></div>`).join('');
    const line = this.story.filter(q => q.ok !== null).map(q => glyph(q) + (q.ok ? '✓' : '✗')).join(' ');
    app.hud.panel(medal || 'The light went out', `${mmss(secs)} · ${weathered} omen${weathered === 1 ? '' : 's'} seen through${lost ? ` · out in ${name(lost)}` : ''}`, [
      { label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Vigil(app)); } },
      { label: 'Copy result', fn: (b) => { app.copyText(`MYRIA · Vigil\n⏱ ${mmss(secs)}${medal ? ' · ' + medal : ''}\n${line}`); b.textContent = 'Copied ✓'; } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div class="b-garden"></div><div style="font-size:48px;font-weight:200;letter-spacing:.08em;margin:6px 0 2px">${mmss(secs)}</div><div class="sub">${best ? 'your longest vigil' : 'longest ' + mmss(prev)}${next ? ` &nbsp;·&nbsp; ${next[1]} at ${mmss(next[0])}` : ''}</div>
       ${early.length ? `<div class="v-early">${early.map(glyph).join(' ')}</div>` : ''}${rows ? `<div class="v-story">${rows}</div>` : ''}<div class="medals">${VIGIL_MEDALS.map(([s, n]) => `<span class="${secs >= s ? 'on' : ''}"><i></i>${n}</span>`).join('')}</div>`);
    const slot = app.hud.veil.querySelector('.b-garden'); if (slot && pic) { slot.appendChild(pic); if (pic.develop) pic.develop(); }
  }
}
