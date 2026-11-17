// ─────────────────────────────────────────────────────────────────────────────
//  Bloom — seventy-five seconds of rain.
//  Light falls into the dish in drawn figures (lines, arcs, spirals, clusters);
//  every mote scores, and an unbroken chain multiplies it (×8 at most). The dish
//  wakes as the clock runs: a blade, then a gear, then both
//  faster. Nothing here is lost for good — only the chain can break.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { SURF } from '../sim/materials.js';
import { TAU, rng } from '../core/util.js';
import { PAL } from '../world/odyssey.js';

const LEN = 75, GOLD = [1.0, 0.82, 0.40], BLUE = [0.6, 0.95, 1.0];
export const MEDALS = [[5000, 'Dew'], [10000, 'Pearl'], [18000, 'Bloom'], [30000, 'Prism']];

export class Bloom {
  constructor(app, o = {}) { this.app = app; this.t = LEN; this.el = 0; this.score = 0; this.bestChain = 0; this.over = false; this.rain = 1.0; this.R = rng(((Math.random() * 1e9) | 0) ^ 0x9e3779b9); this.phase = 0; this.eaten = 0; this.startMass = Math.min(60, Math.max(40, o.mass || 40)); this.pausable = true; }
  enter() {
    const app = this.app;
    app.travel((aspect) => {
      const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.30 }); const m = Math.min(W, H);
      for (const [u, v] of [[0.26, 0.28], [0.74, 0.28], [0.26, 0.72], [0.74, 0.72]]) geo.push({ op: 'add', t: 'circle', x: W * u, y: H * v, r: m * 0.062, mat: SURF.GLASS });
      return { name: 'Bloom', seed: 77, W, H, geo, ents: [], spawn: { x: W * 0.5, y: H * 0.62, n: this.startMass }, pal: { ...PAL.glass, deep: [0.040, 0.020, 0.090], mid: [0.150, 0.075, 0.300], pool: [0.220, 0.100, 0.330], wall: [0.170, 0.105, 0.340], rim: [0.86, 0.74, 1.0], accent: [1.0, 0.8, 0.45] }, cap: 230, decor: 0.5 };
    }, null, {
      onDark: () => app.applyBudget(),
      onLoad: (W) => { W.massCosts = false; },
      onReveal: () => { app.hud.showTitle('', 'Bloom', 'keep the chain alive', 2.6); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('bloom'); },
    });
  }
  restart() { this.app.setMode(new Bloom(this.app)); }
  pauseSub() { return `Bloom · ${this.score}`; }
  mult() { return 1 + Math.min(7, this.app.world.chain >> 3); }

  // ── figures of light ────────────────────────────────────────────────────
  _ok(W, x, y) { return x > 60 && y > 60 && x < W.spec.W - 60 && y < W.spec.H - 60 && W.phys.solidAt(x, y) > 22; }
  _put(W, pts, o = {}) {
    let k = 0; const ttl = o.ttl ?? 8.5;
    for (const [x, y, gold] of pts) { if (!this._ok(W, x, y)) continue; W.spawn({ type: 'mote', x, y, free: true, value: gold ? 4 : 1, gold: !!gold, col: gold ? GOLD : o.col, delay: 0.05 + k * (o.step ?? 0.055), ttl: ttl + k * (o.step ?? 0.055) }); k++; }
    return k;
  }
  figure(W) {
    const R = this.R, sw = W.spec.W, sh = W.spec.H; const F = W.player.focus; const fx = F && F.alive ? F.B.cx : sw / 2, fy = F && F.alive ? F.B.cy : sh / 2;
    const hard = Math.min(1, this.el / 55); const kind = R.pick(['line', 'line', 'arc', 'ring', 'spiral', 'cluster', 'wave', 'cross']);
    // figures begin within reach of where you are, and lead away: the rain invites, it never ambushes
    const a0 = R.range(0, TAU); const near = R() < 0.55 - 0.25 * hard;           // …at first. Later it falls where it likes, and the chain must be carried there
    const sx = near ? fx + Math.cos(a0) * R.range(70, 150) : R.range(sw * 0.2, sw * 0.8), sy = near ? fy + Math.sin(a0) * R.range(70, 150) : R.range(sh * 0.2, sh * 0.8); const pts = [];
    if (kind === 'line') { const a = a0 + R.range(-0.9, 0.9), L = R.range(230, 380), n = 9; for (let k = 0; k < n; k++) pts.push([sx + Math.cos(a) * L * k / (n - 1), sy + Math.sin(a) * L * k / (n - 1), k === n - 1]); }
    else if (kind === 'wave') { const a = a0 + R.range(-0.7, 0.7), L = R.range(260, 400), n = 11, amp = R.range(26, 46); for (let k = 0; k < n; k++) { const u = k / (n - 1), w = Math.sin(u * TAU * 1.25) * amp; pts.push([sx + Math.cos(a) * L * u - Math.sin(a) * w, sy + Math.sin(a) * L * u + Math.cos(a) * w, k === n - 1]); } }
    else if (kind === 'arc') { const cx = R.range(sw * 0.3, sw * 0.7), cy = R.range(sh * 0.3, sh * 0.7), r = R.range(90, 150), n = 10, b0 = R.range(0, TAU), sp = R.range(2.2, 3.6) * R.sign(); for (let k = 0; k < n; k++) { const b = b0 + sp * k / (n - 1); pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, k === n - 1]); } }
    else if (kind === 'ring') { const cx = R.range(sw * 0.3, sw * 0.7), cy = R.range(sh * 0.3, sh * 0.7), r = R.range(58, 84), n = 10; for (let k = 0; k < n; k++) { const b = k / n * TAU; pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, false]); } pts.push([cx, cy, true]); }
    else if (kind === 'spiral') { const cx = R.range(sw * 0.32, sw * 0.68), cy = R.range(sh * 0.32, sh * 0.68), n = 13, dir = R.sign(); for (let k = 0; k < n; k++) { const u = k / (n - 1), b = a0 + dir * u * 7.2, r = 120 * (1 - u * 0.86); pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, k === n - 1]); } }
    else if (kind === 'cross') { const cx = R.range(sw * 0.3, sw * 0.7), cy = R.range(sh * 0.3, sh * 0.7), a = R.range(0, TAU); for (let q = 0; q < 2; q++) for (let k = -3; k <= 3; k++) { if (q && !k) continue; const b = a + q * Math.PI / 2; pts.push([cx + Math.cos(b) * k * 30, cy + Math.sin(b) * k * 30, !q && !k]); } }
    else { const cx = sx + Math.cos(a0) * 90, cy = sy + Math.sin(a0) * 90; for (let k = 0; k < 7; k++) { const b = k * 2.4, r = 16 + k * 7; pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r, k === 0]); } }
    const put = this._put(W, pts, { ttl: 9 - 2.5 * hard, col: kind === 'arc' || kind === 'spiral' ? BLUE : undefined });
    if (put < 4) this.rain = 0.2;       // the figure fell on glass: try again at once
  }
  // ── the dish wakes ──
  _warn(W, x, y, r) { for (let k = 0; k < 3; k++) W.fx.add({ x, y, type: 2, size: r * (1.4 - 0.2 * k), grow: -r * 0.5, life: 1.3 + k * 0.15, col: [1, 0.35, 0.3], a: 0.7, w: 2.4, drag: 0 }); W.sound && W.sound.hurt(0.4); }
  _wake(W) {
    const sw = W.spec.W, sh = W.spec.H, cx = sw / 2, cy = sh / 2; const m = Math.min(sw, sh);
    if (this.phase === 0 && this.el > 18) { this.phase = 1; this._warn(W, cx, cy, 80); this.pending = { at: this.el + 1.5, d: { type: 'blade', x: cx, y: cy, len: m * 0.30, spin: 1.15 } }; this.app.hud.toast('the dish stirs', '✺', 'cool'); }
    else if (this.phase === 1 && this.el > 38) { this.phase = 2; const gx = cx + m * 0.30, gy = cy; this._warn(W, gx, gy, 50); this.pending = { at: this.el + 1.5, d: { type: 'grinder', x: gx, y: gy, r: 24, spin: 3, orbit: { x: cx, y: cy, r: m * 0.30, ry: m * 0.30, w: 0.42 } } }; }
    else if (this.phase === 2 && this.el > 56) { this.phase = 3; for (const e of W.ents) { if (e.d.type === 'blade') e.spin *= 1.5; if (e.d.type === 'grinder' && e.orbit) e.orbit.w *= 1.5; } W.shake = 0.5; this.app.hud.toast('the dish is wide awake', '✺'); W.sound && W.sound.boom(); }
    const P = this.pending; if (P && this.el >= P.at) { const F = W.player.focus; if (F && F.alive && Math.hypot(F.B.cx - P.d.x, F.B.cy - P.d.y) < 110) P.at = this.el + 0.3; else { W.spawn(P.d); W.fx.ring(P.d.x, P.d.y, [1, 0.4, 0.3], 120, 0.6); this.pending = null; } }
  }

  // ── world listener ────────────────────────────────────────────────────
  update(dt, W) {
    if (this.over) return; this.el += dt; this.t -= dt;
    const hard = Math.min(1, this.el / 55);
    this.rain -= dt; const live = W.pickups.length;
    if (this.rain <= 0 && live < 34) { this.rain = (live < 5 ? 0.45 : 2.5 - 0.7 * hard); this.figure(W); }
    this._wake(W);
    for (const O of W.player.orgs) if (O !== W.player.focus && W.player.focus) { O.rallyTo = W.player.focus.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }      // cut pieces hurry home by themselves: this is a game of rhythm, not of herding
    if (this.t <= 0) this.end();
  }
  mote(m, O, chain) {
    const mult = 1 + Math.min(7, (chain - 1) >> 3); const pts = (m.d.gold ? 50 : 10) * mult; this.score += pts; this.eaten++;
    if (chain > this.bestChain) this.bestChain = chain;
    if (chain % 8 === 0 && chain <= 56) this.app.hud.toast(`×${1 + Math.min(7, chain >> 3)}`, '♪', 'cool');
    if (m.d.gold) this.app.world.fx.ring(m.x, m.y, GOLD, 60, 0.5, { a: 0.8 });
  }
  chainEnd(n) { if (n >= 16) this.app.hud.toast(`chain of ${n}`, '◇', 'cool'); }
  tier(name) { this.app.hud.toast(name, '✺'); }
  post(dt, W) { if (!this.over && !W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 30); W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 120, 0.9); this.app.sound.bloom(); } }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' && app.state !== 'in' || this.over) return;
    const mu = this.mult(); const tl = Math.max(0, Math.ceil(this.t));
    app.hud.setTop({ light: this.score, total: 0, extra: `<b class="mu${mu > 1 ? ' hot' : ''}">×${mu}</b> &nbsp; ${W.chain >= 2 ? `♪ ${W.chain} &nbsp; ` : ''}<span class="${tl <= 10 ? 'warn' : ''}">${tl}s</span>` });
  }
  end() {
    this.over = true; const app = this.app, save = app.save; const prev = save.get('bloomBest', 0); const best = this.score > prev; if (best) save.set('bloomBest', this.score);
    if (this.bestChain > save.get('bloomChain', 0)) save.set('bloomChain', this.bestChain);
    let medal = ''; for (const [s, n] of MEDALS) if (this.score >= s) medal = n; const next = MEDALS.find(([s]) => this.score < s);
    app.sound.portal(); app.hud.setTop(null);
    const W = app.world; const F = W.player.focus; if (F && F.alive) { F.crown.joy(); W.fx.ring(F.B.cx, F.B.cy, GOLD, 300, 1.2); W.fx.burst(F.B.cx, F.B.cy, 40, GOLD, 320, { life: 1.2, size: 3 }); }
    app.hud.panel(medal ? `${medal}` : 'The rain passes', `${this.eaten} motes · longest chain ${this.bestChain}`, [
      { label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Bloom(app)); } },
      { label: 'Copy result', fn: (b) => { app.copyText(`MYRIA · Bloom\n✦ ${this.score} · ${this.eaten} motes · chain ${this.bestChain}${medal ? ' · ' + medal : ''}`); b.textContent = 'Copied ✓'; } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div style="font-size:52px;font-weight:200;letter-spacing:.08em;margin:6px 0 2px">${this.score}</div><div class="sub">${best ? 'a new brightest bloom' : 'best ' + prev}${next ? ` &nbsp;·&nbsp; ${next[1]} at ${next[0]}` : ''}</div>
       <div class="medals">${MEDALS.map(([s, n]) => `<span class="${this.score >= s ? 'on' : ''}"><i></i>${n}</span>`).join('')}</div>`);
  }
}
