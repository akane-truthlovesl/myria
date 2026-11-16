// ─────────────────────────────────────────────────────────────────────────────
//  World — one chamber of the slide, alive: matter, will, things and rules.
//  DOM-free: the same class runs in the browser and in headless playtests.
// ─────────────────────────────────────────────────────────────────────────────
import { Physics, H } from '../sim/physics.js';
import { buildSDF } from '../sim/sdf.js';
import { MAT, MATS } from '../sim/materials.js';
import { Colony } from '../life/colony.js';
import { FX } from './fx.js';
import { ENT } from './entities.js';
import { PROF } from '../render/ink.js';
import { rng, TAU } from '../core/util.js';
import { Brain, SPECIES } from '../life/brains.js';
import { growDecor } from './decor.js';

const MAXP = 4096, MAXB = 512;
let SHARED = null;      // one solver for the whole session (typed arrays are reused between rooms)

export class World {
  constructor(host = {}) {
    this.host = host;                       // { sound, haptics } — both optional
    this.phys = SHARED || (SHARED = new Physics(MAXP, MAXB));
    this.fx = new FX();
    this.ents = []; this.pickups = []; this.colonies = []; this.player = null;
    this.listener = null; this.time = 0; this.roomTime = 0;
    this.massCap = 420; this.speedScale = 1; this.dartSpeed = 600; this.massCosts = true;
    this.spec = null; this.shake = 0; this.flash = 0; this.hitStop = 0;
    this.phys.onSplit = (p, c) => this._onSplit(p, c);
    this.phys.onMerge = (k, g, n) => this._onMerge(k, g, n);
  }
  get sound() { return this.host.sound; }
  emit(name, ...a) { const L = this.listener; if (L && L[name]) L[name](...a); }

  // ── room lifecycle ────────────────────────────────────────────────────
  load(spec, carry = {}) {
    const P = this.phys;
    P.clear(); this.fx.clear();
    this.ents = []; this.pickups = []; this.colonies = []; this.player = null; this._nextGroup = 0;
    this.spec = spec; this.rand = rng(spec.seed || 1);
    const m = 40;
    P.setBounds(-m, -m, spec.W + m, spec.H + m);
    this._rel = [];
    this.sdf = buildSDF({ x0: -m, y0: -m, x1: spec.W + m, y1: spec.H + m, res: spec.res || 4, base: spec.base || 'solid', baseMat: spec.baseMat, ops: spec.geo, relief: spec.relief, reliefFreq: spec.reliefFreq });
    P.sdf = this.sdf;
    P.gx = spec.gravity ? spec.gravity[0] : 0; P.gy = spec.gravity ? spec.gravity[1] : 0;
    P.drag = spec.drag ?? 1.5;                 // the medium: a thin film between two glass plates
    this.massCap = spec.cap || 420; this.dewReach = 200; this.moteBonus = 0; this.speedScale = 1; this.massCosts = true; this.dartSpeed = 600;
    this.lights = (spec.lights || []).slice(); this.wells = (spec.wells || []).slice();
    for (const d of spec.ents || []) this.spawn(d);
    // the player's colony
    const sp = spec.spawn || { x: spec.W / 2, y: spec.H / 2 };
    this.player = this.addColony(0, sp.x, sp.y, carry.mass || sp.n || 40, { tint: carry.tint || (this.host.skin ? this.host.skin() : null), mat: carry.mat ?? MAT.LUMEN, crown: carry.crown || 'sun', morph: carry.morph || null });
    for (const r of spec.rivals || []) this.addRival(r.kind, r.x, r.y, r.n);
    this.time = 0; this.roomTime = 0; this.done = false; this.eatT = 0; this.ember = false; this.tierMax = this.player ? this.player.mass : 0;
    this.chain = 0; this.chainT = -9; this.flow = 0; this.hitStop = 0;
    this.stats = { motes: 0, motesTotal: this.pickups.filter(p => p.isMote).length, lost: 0, darts: 0, splits: 0, fuses: 0, tricks: [] };
    return this;
  }
  // what the backdrop painter needs
  roomView() { const s = this.spec; if (!this._decor || this._decorFor !== s) { this._decor = growDecor(this, s.pal); this._decorFor = s; } return { W: s.W, H: s.H, sdf: this.sdf, seed: s.seed, pal: s.pal, lights: this.lights, wells: this.wells, decals: [ETCH(this), ...this._decor, ...this.ents.filter(e => e.bake)] }; }

  spawn(d) {
    const T = ENT[d.type]; if (!T) { console.warn('unknown entity', d.type); return null; }
    const e = new T(this, d); this.ents.push(e); if (e.pickup) this.pickups.push(e);
    if (e.light) this.lights.push(e.light);
    return e;
  }
  entity(id) { return this.ents.find(e => e.id === id); }
  release(e) { if (e.baked) (this._rel || (this._rel = [])).push(e); }
  addColony(group, x, y, n, opts = {}) { const C = new Colony(this, group, opts); C.spawn(x, y, n, opts.mat ?? MAT.LUMEN); this.colonies.push(C); return C; }
  // another organism of the slide (group ids ≥ 1), with a species brain
  addRival(kind, x, y, n) {
    const sp = SPECIES[kind]; const g = this._nextGroup = (this._nextGroup || 0) + 1;
    const C = new Colony(this, g, { tint: sp.tint, mat: sp.mat, crown: sp.crown, isPlayer: false, org: { speedMul: sp.speed } });
    C.kind = kind; C.species = sp; const O = C.spawn(x, y, n, sp.mat); if (O) O.brain = new Brain(kind);
    this.colonies.push(C); return C;
  }
  colonyOf(B) { if (!B) return null; for (const C of this.colonies) if (C.group === B.group) return C; return null; }
  isPlayerBody(B) { return !!B && B.alive && B.group === 0; }

  // conditions: an entity id, a list (all), {any:[…]}, {not:…}, {mass:n}, {fn}
  check(c) {
    if (!c) return true;
    if (typeof c === 'string') { const e = this.entity(c); return e ? !!e.on : false; }
    if (Array.isArray(c)) return c.every(k => this.check(k));
    if (c.any) return c.any.some(k => this.check(k));
    if (c.not) return !this.check(c.not);
    if (c.mass) return !!this.player && this.player.mass >= c.mass;
    if (c.fn) return c.fn(this);
    return true;
  }
  // something took mass from a body: crisp, legible, never silent
  hurt(B, n, x, y, gone = false) {
    if (!B) return; const C = this.colonyOf(B);
    if (B.ctrl) { B.ctrl.hurtT = 0.5; B.ctrl.excite = 1; B.ctrl.crown.startle(1); }
    if (C === this.player) { this.sound && this.sound.hurt(Math.min(1, n / 4)); this.host.haptics && this.host.haptics.hurt(); this.shake = Math.min(1, this.shake + 0.12); this.emit('hurt', B, n, gone); }
  }

  // ── queries ───────────────────────────────────────────────────────────
  gravityAt(x, y) {
    const P = this.phys; let gx = P.gx, gy = P.gy;
    for (const Z of P.zones) { if (!Z.gravity || x < Z.x0 || x > Z.x1 || y < Z.y0 || y > Z.y1) continue; const w = Z.weight ? Z.weight(x, y) : 1; gx += (Z.gx - gx) * w; gy += (Z.gy - gy) * w; }
    G2[0] = gx; G2[1] = gy; return G2;
  }
  findCuriosity(O) {
    const B = O.B; let best = null, bd = 220 + B.r;
    for (const e of this.ents) { if (e.dead || !e.curious) continue; const d = Math.hypot(e.x - B.cx, e.y - B.cy); if (d < bd && d > B.r * 0.8) { bd = d; best = e; } }
    return best;
  }
  veilNear(x, y) { for (const e of this.ents) if (e.watch && Math.hypot(e.x - x, e.y - y) < e.range + 220) return true; return false; }
  hazards() { const out = this._hz || (this._hz = []); out.length = 0; for (const e of this.ents) if (e.hazard && !e.dead) out.push(e.hazard); return out; }
  nearestPlayer(x, y, range = 1e9) { let best = null, bd = range; if (this.player) for (const O of this.player.orgs) { if (!O.alive) continue; const d = Math.hypot(O.B.cx - x, O.B.cy - y) - O.B.r; if (d < bd) { bd = d; best = O; } } return best; }
  bodyAt(x, y, r) { let hit = null; const P = this.phys; P.forEachNear(x, y, r, (i) => { if (!hit) hit = P.bodies[P.body[i]]; }); return hit; }
  playerBodyAt(x, y, r) { let hit = null; const P = this.phys; P.forEachNear(x, y, r, (i) => { if (!hit) { const B = P.bodies[P.body[i]]; if (B.group === 0) hit = B; } }); return hit; }

  // ── matter bookkeeping ────────────────────────────────────────────────
  // light becomes body: n particles bloom at (x,y) and are drawn into B
  feed(B, n, x, y, col = [1, 0.85, 0.55], quiet = false) {
    const P = this.phys; const C = this.colonyOf(B);
    let total = C ? C.mass : B.count, added = 0;
    for (let k = 0; k < n; k++) {
      if (total >= this.massCap) { B.energy = Math.min(1.5, (B.energy || 0) + 0.15); continue; }
      const a = Math.random() * TAU, r = Math.random() * 4;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const dx = B.cx - px, dy = B.cy - py, d = Math.hypot(dx, dy) + 1;
      const i = P.spawn(px, py, dx / d * 150 + B.vx, dy / d * 150 + B.vy, B.mat, B.id);
      if (i >= 0) { P.glow[i] = 0.9; P.rr[i] = 0.25; total++; added++; }
    }
    B.energy = Math.min(1.2, (B.energy || 0) + 0.06 * n);
    if (C === this.player && added) { const m = total; for (const t of TIERS) if (m >= t[0] && m - added < t[0] && (this.tierMax || 0) < t[0]) { this.tierMax = t[0]; B.ctrl && B.ctrl.crown.joy(); this.fx.ring(B.cx, B.cy, [1, 0.9, 0.7], B.r * 3.4, 0.9); this.sound && this.sound.trick(); this.emit('tier', t[1], m); } }
    if (B.ctrl) { B.ctrl.gulp = 1; B.ctrl.excite = Math.min(1, B.ctrl.excite + 0.12); }
    if (!quiet) { this.fx.ring(x, y, col, 26, 0.35, { a: 0.7 }); this.fx.sparks(x, y, 3, B.cx - x, B.cy - y, col, 160, { life: 0.3, size: 2 }); }
    return added;
  }
  // a particle is torn from its body and becomes free dew that may be gathered again
  shed(i, fx, fy, col = [1, 0.6, 0.3], life = 4.5) {
    const P = this.phys; const src = P.bodies[P.body[i]];
    const D = P.allocBody(-1, 'dew', P.mat[i]);
    if (!D) { P.kill(i); return; }
    D.tint = src.tint; D.fuseT = 0.6; D.home = null;
    P.transfer(i, D.id);
    const dx = P.x[i] - fx, dy = P.y[i] - fy, d = Math.hypot(dx, dy) + 1;
    P.vx[i] += dx / d * 240 + (Math.random() - 0.5) * 120; P.vy[i] += dy / d * 240 + (Math.random() - 0.5) * 120;
    P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
    P.life[i] = life; P.glow[i] = 1.4;
    this.fx.sparks(P.x[i], P.y[i], 2, dx / d, dy / d, col, 260);
    const C = this.colonyOf(src); if (C) { C.lost++; if (C === this.player) this.stats.lost++; }
  }
  morph(B, mat, morph = null) {
    const P = this.phys; const C = this.colonyOf(B); const bodies = C ? C.orgs.map(o => o.B) : [B];
    for (const b of bodies) {
      if (!b.alive) continue; b.mat = mat;
      for (let k = 0; k < b.len; k++) { const i = P.bodyIdx[b.start + k]; if (P.body[i] === b.id) { P.mat[i] = mat; P.glow[i] = 1.8; } }
      if (b.ctrl) b.ctrl.morph = morph;
    }
    if (C) { C.mat = mat; C.morph = morph; }
    // a catalyst bath shows as what it is (silver is silver whatever hue you wear); rinsed back to lumen, your own hue returns
    if (C && C === this.player) { const t = mat === MAT.LUMEN && this.host.skin ? this.host.skin() : null; C.tint = t; for (const b of bodies) if (b.alive) b.tint = t; }
    this.fx.ring(B.cx, B.cy, MATS[mat].emit, B.r * 2.6, 0.7);
    this.sound && this.sound.morph();
    this.emit('morph', B, mat);
  }

  // ── flow: light taken in quick succession becomes a streak. A streak makes the crown bloom —
  //    longer, brighter feelers that fetch from further, a faint pull on nearby motes, a little more speed —
  //    and every eighth mote of an unbroken chain pays a bonus. Greed with rhythm is rewarded; nothing is punished. ──
  chainUp(m, O) {
    if (this.time - this.chainT > CHAIN_GAP) this.chain = 0;
    this.chainT = this.time; const c = ++this.chain;
    this.flow = Math.min(1, this.flow + 0.085 + 0.004 * c);
    if (c > (this.stats.bestChain || 0)) this.stats.bestChain = c;
    if (c % 8 === 0 && O && O.alive) {
      const bonus = 1 + Math.min(3, c >> 3);
      this.feed(O.B, bonus, O.B.cx, O.B.cy, [1, 0.95, 0.8], true); this.stats.bonus = (this.stats.bonus || 0) + bonus;
      O.crown.joy(); this.fx.ring(O.B.cx, O.B.cy, [1, 0.92, 0.7], O.B.r * 2.6 + 30, 0.6, { a: 0.7, w: 2.6 });
      this.fx.burst(O.B.cx, O.B.cy, 8 + bonus * 2, [1, 0.9, 0.6], 190, { life: 0.7, size: 2.4 });
    }
    return c;
  }
  _flow(dt) {
    const idle = this.time - this.chainT;
    if (idle > CHAIN_GAP && this.chain) { const was = this.chain; this.chain = 0; if (was >= 8) this.emit('chainEnd', was); }
    this.flow = Math.max(0, this.flow - dt * (idle > 1.1 ? 0.42 : 0.06));
    const pl = this.player; const f = this.flow; if (!pl) return;
    for (const O of pl.orgs) O.reachK = 1 + 0.5 * f;
    const F = pl.focus; if (!F || !F.alive || f < 0.2) return;
    // the bloom's pull: nearby motes lift off the plate and drift in
    const B = F.B; const reach = B.r + 34 + 76 * f, r2 = reach * reach; const P = this.phys;
    for (const p of this.pickups) {
      if (!p.isMote || p.dead || p.held || p.owner != null && p.owner !== B.group) continue;
      const dx = B.cx - p.x, dy = B.cy - p.y; const d2 = dx * dx + dy * dy; if (d2 > r2) continue;
      if (P.blocked(p.x, p.y, B.cx, B.cy, 1)) continue;                               // never through glass
      if (p.baked) { this.release(p); continue; }
      const d = Math.sqrt(d2) + 1; const a = 420 * f * (1 - d / reach) * dt; p.free = true; p.vx += dx / d * a; p.vy += dy / d * a;
    }
    // light spills from the feeler tips while the streak holds
    if (f > 0.45 && Math.random() < dt * 22 * f) { const rs = F.crown.rays; const r = rs[(Math.random() * rs.length) | 0]; if (r && r.len > 8) this.fx.add({ x: r.x[6], y: r.y[6], vx: (Math.random() - 0.5) * 30 - B.vx * 0.1, vy: (Math.random() - 0.5) * 30 - B.vy * 0.1, col: [1, 0.9, 0.65], life: 0.5 + Math.random() * 0.3, size: 1.6 + Math.random() * 1.4, a: 0.8, drag: 1.5 }); }
  }
  // the continuous voice of the body: a silk whisper when gliding against things, a hum that climbs as it is
  // stretched or coiled, a low pulse when something near can hurt it
  _voice() {
    const s = this.sound; if (!s || !s.ready) return; const F = this.player && this.player.focus;
    if (!F || !F.alive) { s.setGlide(0, 0); s.setTension(0); s.setDanger(0); return; }
    const B = F.B; const sp = Math.hypot(B.vx, B.vy); const contact = Math.min(1, B.contact / Math.max(4, B.count * 0.08));
    s.setGlide(sp, contact);
    const stretch = Math.max(0, Math.min(1, (F.spread - 1.22) / 0.9));
    s.setTension(Math.max(stretch * 0.8, F.coil || 0, F.puff * 0.5, this.tug || 0)); this.tug = 0;      // tug: a machine winding up on you (a pole about to throw) sings in the same voice
    let danger = this.ember ? 0.7 : 0; if (F.hurtT > 0) danger = Math.max(danger, 0.8);
    for (const h of this.hazards()) { const d = Math.hypot(h.x - B.cx, h.y - B.cy) - (h.r || 40) - B.r; if (d < 90) danger = Math.max(danger, 0.75 * (1 - Math.max(0, d) / 90)); }
    s.setDanger(danger);
  }

  // ── physics callbacks ────────────────────────────────────────────────
  _onSplit(parent, child) {
    const C = this.colonyOf(parent);
    if (C && parent.kind !== 'dew' && parent.kind !== 'spent') {
      if (child.count < 5) { child.group = -1; child.kind = 'dew'; child.home = C; return; }      // a crumb, not a sibling: it becomes homing dew — and remembers whose it was
      child.home = null;
      const NO = C.onSplit(parent, child);
      if (C.kind && NO && !NO.brain && SPECIES[C.kind]) { NO.brain = new Brain(C.kind); if (parent.ctrl) NO.speedMul = parent.ctrl.speedMul; }        // a neighbour cut in two is two neighbours, each with its own mind
      if (C === this.player) { this.stats.splits++; const cut = this.phys.events.cuts > 0; this.sound && (cut ? this.sound.cut() : this.sound.snap(0.5)); this.emit('split', parent, child, cut); }
    }
  }
  _onMerge(keep, gone, n) {
    // crumbs that find each other before they find you are not lost property: once they make a real drop it is a sibling again
    if (keep.group === -1 && keep.kind === 'dew') {
      const Hm = keep.home || gone.home; keep.home = Hm || null;
      if (Hm && keep.count >= 6 && this.colonies.includes(Hm) && Hm.orgs.some(o => o.alive)) {
        keep.kind = 'fragment'; keep.home = null; const O = Hm.adopt(keep); O.phi = Hm.focus ? Hm.focus.phi : 0; if (Hm.kind && !O.brain && SPECIES[Hm.kind]) O.brain = new Brain(Hm.kind);
        if (Hm.focus && Hm.focus.alive && Hm.focus.B.count < 12 && keep.count > Hm.focus.B.count * 1.6) Hm.setFocus(O);          // the will stays with the larger share
        else if (Hm.isPlayer && !O.brain) { O.stray = true; O.strayT = 0.4; }
      }
      return;
    }
    const C = this.colonyOf(keep);
    if (C) {
      C.onMerge(keep, gone);
      if ((gone.kind === 'dew' || gone.kind === 'spent') && n > 0) { this.sound && this.sound.pop(0.5); this.fx.ring(gone.cx, gone.cy, [1, 0.85, 0.7], 16, 0.3, { a: 0.6 }); }
      if (gone.kind === 'fragment' || gone.kind === 'player') {
        if (C === this.player) { this.stats.fuses++; this.sound && this.sound.fuse(Math.min(1, n / 120)); this.host.haptics && this.host.haptics.fuse(); this.emit('fuse', keep, gone, n); }
        this.fx.ring(keep.cx, keep.cy, [1, 0.8, 0.6], keep.r * 2, 0.5);
        if (keep.ctrl) keep.ctrl.crown.joy();
      }
    }
    const GC = gone.ctrl && gone.ctrl.colony; if (GC && GC !== C) GC.onMerge(keep, gone);
  }
  // the breath let go: a ring of displaced water shoves everything that is not you
  pop(O, power) {
    const P = this.phys, B = O.B; const R = 150 + B.r * 2;
    for (let i = 0; i < P.hi; i++) { if (!P.alive[i]) continue; const b = P.body[i]; if (b === B.id || P.bodies[b].group === B.group) continue; const dx = P.x[i] - B.cx, dy = P.y[i] - B.cy, d = Math.sqrt(dx * dx + dy * dy) + 1; if (d > R) continue; const f = 520 * power * (1 - d / R); P.vx[i] += dx / d * f; P.vy[i] += dy / d * f; }
    for (const C of this.colonies) for (const Q of C.orgs) { if (Q === O || !Q.alive) continue; if (Math.hypot(Q.B.cx - B.cx, Q.B.cy - B.cy) < R) { Q.crown.startle(1); Q.excite = 1; if (Q.brain) { Q.brain.dartT = Math.max(Q.brain.dartT, 1.6); Q.brain.coil = 0; Q.coil = 0; } } }
    this.fx.ring(B.cx, B.cy, [0.85, 0.95, 1], R, 0.55, { a: 0.8, w: 3 }); this.fx.burst(B.cx, B.cy, 16, [0.9, 0.97, 1], 260, { type: 1, size: 3, life: 0.7 });
    this.shake = Math.min(1, this.shake + 0.3); this.sound && (this.sound.pop(1), this.sound.bounce(1)); this.emit('pop', O);
  }
  onImpact(O, jolt, nx, ny) {
    const v = Math.min(1, jolt / 900);
    if (O.colony === this.player) { this.sound && this.sound.splat(v); this.shake = Math.min(1, this.shake + v * 0.3); if (O.focused && this.host.haptics) this.host.haptics.thump(v); }
    if (jolt > 420) this.fx.burst(O.B.cx - nx * O.B.r, O.B.cy - ny * O.B.r, Math.floor(3 + v * 7), [0.9, 0.96, 1], 130 * v, { size: 2.2, life: 0.45, type: 1 });
  }
  onPeel(O) { this.sound && this.sound.snap(0.3); }
  onDart(O, dx, dy, cost) {
    if (O.colony === this.player) { this.stats.darts++; if (this.sound) { if (O.morph && O.morph.jet) this.sound.fizz(); else this.sound.dart(1); } this.host.haptics && this.host.haptics.dart(); }
    this.fx.ring(O.B.cx - dx * O.B.r * 0.8, O.B.cy - dy * O.B.r * 0.8, [0.95, 0.85, 0.75], 36, 0.3, { a: 0.5 });
    this.fx.sparks(O.B.cx - dx * O.B.r, O.B.cy - dy * O.B.r, 6, -dx, -dy, [1, 0.9, 0.85], 200, { life: 0.4, size: 2 });
    this.emit('dart', O, dx, dy, cost);
  }
  onBud(O, NB) { const C = O.colony; if (C) { const S = C.adopt(NB); S.phi = O.phi; S.budT = 1.2; if (C === this.player) this.stats.splits++; } this.sound && this.sound.bud(); this.emit('bud', O, NB); }
  onFocus(C, O) { if (O && O.B && C === this.player) { this.fx.ring(O.B.cx, O.B.cy, [1, 0.95, 0.85], O.B.r * 2.2, 0.45); this.sound && this.sound.ui(); } }
  onGrab(O, item) { if (O.colony === this.player && this.sound) this.sound.pop(0.25); }

  // ── one simulation tick ───────────────────────────────────────────────
  // ctl: { intent:{x,y}, aim:{x,y}|null, rally:bool, darts:[{x,y,power}], buds:[{x,y,frac}], cycle:±1, focusAt:{x,y} }
  step(dt, ctl = NOCTL) {
    const P = this.phys;
    this.time += dt; this.roomTime += dt;
    const pl = this.player;
    if (pl) {
      const F = pl.focus;
      if (F && F.alive) {
        if (ctl.darts) for (const d of ctl.darts) F.dart(d.x, d.y, d.power ?? 1);
        if (ctl.buds) for (const b of ctl.buds) F.bud(b.x, b.y, b.frac ?? 0.38);
      }
      for (const O of pl.orgs) O.swell = !!ctl.swell && O === F;
      if (ctl.cycle) pl.cycle(ctl.cycle);
      if (ctl.focusAt) this.pickFocus(ctl.focusAt.x, ctl.focusAt.y);
    }
    if (this.listener && this.listener.update) this.listener.update(dt, this);
    for (const e of this.ents) if (!e.dead) e.update(dt);
    if (pl) {      // the unbreakable floor
      const m = pl.mass; const was = this.ember;
      if (m > 0 && m <= 10) this.ember = true; else if (m >= 26 || m === 0) this.ember = false;
      if (this.ember !== was) { for (const O of pl.orgs) { O.emberK = this.ember ? 1 : 0; } if (this.ember) { const F2 = pl.focus; if (F2) { this.fx.ring(F2.B.cx, F2.B.cy, [1, 0.95, 0.8], 150, 0.8); this.fx.burst(F2.B.cx, F2.B.cy, 18, [1, 0.9, 0.6], 240, { life: 0.8 }); } this.sound && this.sound.bloom(); this.emit('ember', true); } else if (m > 0) this.emit('ember', false); }
      if (this.ember) for (const O of pl.orgs) { O.emberK = 1; O.B.energy = 1.2; }
      // the floor is unbreakable in practice, not just on paper: if an ember has nothing left to drink, the slide
      // itself weeps a little light near it — a clutch way back, never a dead end
      // …and the same mercy, more slowly, for a body worn well below its beginnings while something bigger still hunts the room
      let lean = false; if (!this.ember && m > 0 && m < 0.6 * (this.spec.spawn.n || 40)) for (const C of this.colonies) { if (C === pl || C.ally || C.kind !== 'hunter') continue; for (const O of C.orgs) if (O.alive && O.B.count > m) { lean = true; break; } if (lean) break; }
      if ((this.ember || lean) && pl.focus && pl.focus.alive) {
        this.pityT = (this.pityT || 0) + dt;
        if (this.pityT > (this.ember ? 2.2 : 3.2)) {
          this.pityT = 0; const B = pl.focus.B; let near = 0; for (const p of this.pickups) if (p.isMote && !p.dead && Math.hypot(p.x - B.cx, p.y - B.cy) < 260) near++;
          if (near < 2) for (let k = 0; k < 12; k++) { const a = Math.random() * TAU, d = 70 + Math.random() * 70; const x = B.cx + Math.cos(a) * d, y = B.cy + Math.sin(a) * d; if (x < 50 || y < 50 || x > this.spec.W - 50 || y > this.spec.H - 50 || P.solidAt(x, y) < 24 || P.blocked(B.cx, B.cy, x, y, 2)) continue; this.spawn({ type: 'mote', x, y, free: true, value: 2, col: [1, 0.9, 0.7], pity: true }); this.fx.ring(x, y, [1, 0.9, 0.7], 30, 0.5, { a: 0.6 }); break; }
        }
      } else this.pityT = 0;
    }
    if (this.callHome > 0) this.callHome -= dt;
    for (const C of this.colonies) C.update(dt, C === pl ? ctl.intent : null, C === pl ? ctl.aim : null, C === pl ? !!ctl.rally || this.callHome > 0 : false);
    this._dewHoming(dt);
    P.step(dt);
    this._chemistry(dt); this._lances(dt); this._spores(dt);
    for (const C of this.colonies) C.post(dt);
    for (const e of this.ents) if (!e.dead) e.post(dt);
    if (this.ents.some(e => e.dead)) { this.ents = this.ents.filter(e => !e.dead); this.pickups = this.pickups.filter(e => !e.dead); }
    this.colonies = this.colonies.filter(C => C === pl || C.orgs.length > 0);
    this._flow(dt); this._voice();
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 3); this.flash = Math.max(0, this.flash - dt * 2);
    if (this.listener && this.listener.post) this.listener.post(dt, this);
  }

  // ── collision choreography between different organisms ──
  // same phase: the larger membrane siphons the smaller one (mass crosses over, carrying its pigment as a swirl);
  // thorns shed whatever touches them; oil never mixes — it only slips and bounces.
  _chemistry(dt) {
    const P = this.phys; const n = P.ncontacts; if (!n || this.peace) return;
    this.eatT += dt; if (this.eatT < 0.05) return; this.eatT = 0;
    const A = P.contactA, Bc = P.contactB, body = P.body, bodies = P.bodies, mat = P.mat;
    let moved = 0;
    for (let k = 0; k < n && moved < 10; k += 1 + ((Math.random() * 3) | 0)) {
      let i = A[k], j = Bc[k]; if (!P.alive[i] || !P.alive[j]) continue;
      let Bi = bodies[body[i]], Bj = bodies[body[j]]; if (!Bi || !Bj || Bi === Bj || Bi.group < 0 || Bj.group < 0 || Bi.group === Bj.group) continue;
      const Ci = this.colonyOf(Bi), Cj = this.colonyOf(Bj); if (!Ci || !Cj) continue;
      if (!Ci.isPlayer && !Cj.isPlayer) continue;
      if (Ci.ally && Cj.ally) { this._transfuse(i, j, Bi, Bj); continue; }
      const ti = mat[i] === MAT.THORN, tj = mat[j] === MAT.THORN;
      if (ti !== tj) { const victim = ti ? j : i, VB = ti ? Bj : Bi, TB = ti ? Bi : Bj; if (VB.count > 8 && mat[victim] !== MAT.BASTION) { this.shed(victim, TB.cx, TB.cy, [1, 0.35, 0.45]); this.hurt(VB, 1, TB.cx, TB.cy); moved++; } continue; }
      if (MATS[mat[i]].phase !== MATS[mat[j]].phase) continue;
      if (Bj.count > Bi.count) { const t = i; i = j; j = t; const tb = Bi; Bi = Bj; Bj = tb; }
      if (Bi.count < Bj.count * 1.12) continue;                 // an even match: a tug-of-war nobody wins
      if (Bi.ctrl && Bi.ctrl.veil > 0.5) continue;
      const eatenC = this.colonyOf(Bj); if (eatenC === this.player && (this.ember || moved >= 1)) continue;       // an ember cannot be drunk; and you are never drained faster than you can flee
      if (eatenC !== this.player && moved >= 3) break;
      // particle j crosses the membrane into the larger body
      const eater = this.colonyOf(Bi), eaten = this.colonyOf(Bj);
      // a full body cannot hold more: past the room's cap what it drinks burns off as light (the hunt still counts — the dish just stays legible)
      // a ripe decoy is not food: every grain of it lodges in the belly that drinks it, and counts down
      const lodge = eaten === this.player && eater !== this.player && mat[j] === MAT.SPORE && Bj.ctrl && Bj.ctrl.ripe;
      const full = eater === this.player && this.player.mass >= Math.max(420, this.massCap);      // (a chamber's own cap limits what light can give — The Hunt keeps you lean so that only prey makes you grow — never what a hunt can)
      if (full) { if (Math.random() < 0.5) this.fx.sparks(P.x[j], P.y[j], 1, Bi.cx - P.x[j], Bi.cy - P.y[j], (eaten && eaten.tint || MATS[Bj.mat]).emit, 120, { spread: 2.4, life: 0.5 }); P.kill(j); }
      else if (lodge) { P.transfer(j, Bi.id); P.glow[j] = 2.4; Bi.spores++; }
      else { P.transfer(j, Bi.id); mat[j] = Bi.mat; P.mix[j] = 1; P.glow[j] = 1.2; }
      moved++;
      if (Bi.ctrl) { Bi.ctrl.gulp = 1; }
      if (Bj.ctrl) { Bj.ctrl.hurtT = 0.4; Bj.ctrl.excite = 1; }
      if (eaten === this.player && !lodge) { this.stats.lost++; if (Math.random() < 0.3) this.hurt(Bj, 1, Bi.cx, Bi.cy); }        // (a decoy taken is a gift, not a wound)
      if (eater === this.player) { this.stats.eaten = (this.stats.eaten || 0) + 1; if (Math.random() < 0.25 && this.sound) this.sound.gulp(); }
      if (Bj.count <= 6 && eaten !== this.player) {               // the last of it: swallowed whole
        for (let q = 0; q < Bj.len; q++) { const p2 = P.bodyIdx[Bj.start + q]; if (P.alive[p2] && body[p2] === Bj.id) { if (full) P.kill(p2); else if (lodge) { P.transfer(p2, Bi.id); P.glow[p2] = 2.4; Bi.spores++; } else { P.transfer(p2, Bi.id); mat[p2] = Bi.mat; P.mix[p2] = 1; P.glow[p2] = 1.2; } } }
        this.fx.ring(Bj.cx, Bj.cy, (eaten.tint || MATS[Bj.mat]).emit, 90, 0.6); if (eater === this.player) { this.sound && this.sound.swallow(); this.hitStop = 0.07; this.emit('devour', eaten, Bi); }
      }
    }
    // swallowed pigment slowly becomes your own colour
    const mix = P.mix; for (let i = 0; i < P.hi; i++) if (mix[i] > 0) mix[i] = Math.max(0, mix[i] - 0.012);
  }

  // allies touching: mass flows from the fuller body to the emptier one until they are even (emergency transfusion)
  _transfuse(i, j, Bi, Bj) {
    const P = this.phys; if (Math.abs(Bi.count - Bj.count) < 8 || Math.random() < 0.5) return;
    const from = Bi.count > Bj.count ? i : j, To = Bi.count > Bj.count ? Bj : Bi; P.transfer(from, To.id); P.mat[from] = To.mat; P.mix[from] = 1; P.glow[from] = 1.2;
    if (To.ctrl) To.ctrl.gulp = 1; if (this.sound && Math.random() < 0.2) this.sound.heal();
  }
  // the Trojan: spores lodged in a belly light a short fuse — then the belly is everywhere at once
  _spores(dt) {
    for (const C of this.colonies) { if (C.isPlayer) continue; for (const O of C.orgs) {
      if (!O.alive) continue; const B = O.B;
      if (!(O.boomT > 0)) { if (B.spores >= 5) { O.boomT = O.boom0 = 1.0; O.crown.startle(1); this.emit('swallowed', O, C); } continue; }
      O.boomT -= dt; const k = 1 - O.boomT / O.boom0; O.excite = 1; O.hurtT = 0.3; O.intent.x *= 0.5; O.intent.y *= 0.5;      // it stops, puzzled, glowing from the inside
      if ((O.boomP = (O.boomP || 0) - dt) <= 0) { O.boomP = 0.26 - 0.2 * k; this.fx.ring(B.cx, B.cy, [0.75, 1, 0.5], B.r * (1.5 - 0.6 * k), 0.3, { r0: B.r * 1.6, a: 0.5 }); this.sound && this.sound.fuseTick(k); const P = this.phys; for (let q = 0; q < B.len; q++) { const p = P.bodyIdx[B.start + q]; if (P.body[p] === B.id && Math.random() < 0.3) P.glow[p] = 1 + k; } }
      if (O.boomT <= 0) this.detonate(O, C);
    } }
  }
  detonate(O, D) {
    const P = this.phys, T = O.B; const K = T.count >= 150 ? 6 : T.count >= 90 ? 5 : T.count >= 50 ? 4 : 3; const a0 = Math.random() * TAU; const cx = T.cx, cy = T.cy, R = T.r;
    const NB = [T]; for (let s = 1; s < K; s++) { const b = P.allocBody(T.group, 'ai', T.mat); if (b) NB.push(b); } const n = NB.map(() => 0); const idx = [];
    for (let q = 0; q < T.len; q++) { const p = P.bodyIdx[T.start + q]; if (P.alive[p] && P.body[p] === T.id) idx.push(p); }
    const sect = (p) => Math.floor((((Math.atan2(P.y[p] - cy, P.x[p] - cx) - a0) % TAU + TAU) % TAU) / TAU * NB.length) % NB.length;
    for (const p of idx) {
      const dx = P.x[p] - cx, dy = P.y[p] - cy, d = Math.hypot(dx, dy) + 1; for (let k = 0; k < 6; k++) P.sj[p * 6 + k] = -1;
      if (P.mat[p] === MAT.SPORE || d < R * 0.42 || Math.random() < 0.1) { if (P.mat[p] === MAT.SPORE) P.mat[p] = MAT.DEW; this.shed(p, cx, cy, [0.75, 1, 0.5], 12); continue; }      // its heart comes out as a rain of dew
      const s = sect(p), am = a0 + (s + 0.5) / NB.length * TAU; P.body[p] = NB[s].id; n[s]++;
      P.vx[p] = dx / d * 150 + Math.cos(am) * 190; P.vy[p] = dy / d * 150 + Math.sin(am) * 190; P.ox[p] = P.x[p] - P.vx[p] / 120; P.oy[p] = P.y[p] - P.vy[p] / 120; P.glow[p] = 1.6;
    }
    for (let s = 0; s < NB.length; s++) {
      const b = NB[s], am = a0 + (s + 0.5) / NB.length * TAU;
      if (n[s] < 6) { for (const p of idx) if (P.alive[p] && P.body[p] === b.id && P.bodies[P.body[p]] === b) this.shed(p, cx, cy, [0.75, 1, 0.5], 12); if (s) { P.freeBody(b); } continue; }
      b.fuseT = 600; b.spores = 0; if (!s) continue;                // what a trap has scattered never knits back together
      b.tint = T.tint; b.count = n[s]; b.cx = cx + Math.cos(am) * R * 0.6; b.cy = cy + Math.sin(am) * R * 0.6; b.r = R * 0.5;
      const S = D.adopt(b); S.brain = new Brain(D.kind); S.speedMul = O.speedMul; S.hurtT = 1; S.cleftT = this.time + 1.5; S.crown.startle(1);
    }
    O.boomT = 0; O.cleftT = this.time + 1.5; O.hurtT = 1; P.forceComponents = true;
    this.fx.ring(cx, cy, [0.8, 1, 0.55], R * 4.2, 0.7, { w: 4 }); this.fx.ring(cx, cy, [1, 1, 0.9], R * 2.6, 0.45); this.fx.burst(cx, cy, 46, [0.8, 1, 0.5], 420, { life: 0.9, size: 3 });
    this.shake = 1; this.flash = 0.8; this.hitStop = 0.16; this.sound && this.sound.detonate(); this.host.haptics && this.host.haptics.snap && this.host.haptics.snap();
    // the blast shoves whatever stands near (nothing of yours is harmed by your own trap)
    for (const C of this.colonies) for (const Q of C.orgs) { if (!Q.alive || Q.B === T || NB.includes(Q.B)) continue; const dx = Q.B.cx - cx, dy = Q.B.cy - cy, d = Math.hypot(dx, dy) + 1; if (d < R * 3) Q.launch(dx / d * 330, dy / d * 330, 0.35); }
    this.emit('trojan', O, D);
  }
  // the lance: a coiled dart that meets a bigger neighbour parts it cleanly in two — giants become meals
  _lances(dt) {
    const P = this.phys;
    for (const C of this.colonies) { if (!C.isPlayer) continue; for (const O of C.orgs) {
      if (!O.alive || !(O.lance > 0)) continue; O.lance -= dt; const B = O.B;
      for (const D of this.colonies) { if (D === C || D.ally && C.ally || !D.kind || D.kind === 'oil') continue; for (const Q of D.orgs) {
        if (!Q.alive || Q.B.count < 18 || Q.cleftT > this.time) continue; const T = Q.B; const dx = T.cx - B.cx, dy = T.cy - B.cy; if (dx * dx + dy * dy > (T.r + B.r * 0.7) * (T.r + B.r * 0.7)) continue;
        // split along the lance direction through the target's heart
        const lx = O.lanceX, ly = O.lanceY; const NB = P.allocBody(T.group, 'ai', T.mat); if (!NB) continue; let n = 0, m = 0;
        for (let q = 0; q < T.len; q++) { const p = P.bodyIdx[T.start + q]; if (!P.alive[p] || P.body[p] !== T.id) continue; const side = (P.x[p] - T.cx) * -ly + (P.y[p] - T.cy) * lx; const s = side > 0 ? 1 : -1; if (side > 0) { P.body[p] = NB.id; n++; } else m++; P.vx[p] += -ly * s * 170 + lx * 60; P.vy[p] += lx * s * 170 + ly * 60; P.ox[p] = P.x[p] - P.vx[p] / 120; P.oy[p] = P.y[p] - P.vy[p] / 120; P.glow[p] = 1.3; for (let k = 0; k < 6; k++) P.sj[p * 6 + k] = -1; }
        if (n < 6 || m < 6) { for (let q = 0; q < P.hi; q++) if (P.body[q] === NB.id) P.body[q] = T.id; P.freeBody(NB); continue; }
        NB.tint = T.tint; NB.fuseT = 3.2; T.fuseT = 3.2; NB.count = n; NB.cx = T.cx - ly * T.r * 0.5; NB.cy = T.cy + lx * T.r * 0.5; NB.r = T.r * 0.7;
        const S = D.adopt(NB); S.brain = new Brain(D.kind); S.speedMul = Q.speedMul; S.cleftT = Q.cleftT = this.time + 1.2; S.hurtT = Q.hurtT = 0.6; S.crown.startle(1); Q.crown.startle(1);
        O.lance = 0; this.shake = Math.min(1, this.shake + 0.5);
        for (let k = -5; k <= 5; k++) this.fx.sparks(T.cx + lx * k * T.r * 0.22, T.cy + ly * k * T.r * 0.22, 2, -ly, lx, [1, 0.95, 0.85], 240, { spread: 3.2, life: 0.45 });
        this.fx.ring(T.cx, T.cy, [1, 0.9, 0.8], T.r * 2.6, 0.5); this.sound && this.sound.cut(); this.host.haptics && this.host.haptics.snap();
        this.hitStop = 0.11; this.flash = 0.6;
        this.emit('cleave', O, D);
      } }
    } }
  }

  // free dew drifts toward the nearest living body that can drink it (spent jets must be fetched deliberately)
  _dewHoming(dt) {
    const P = this.phys;
    for (const D of P.bodies) {
      if (!D.alive || D.group !== -1 || D.kind === 'spent') continue;
      let best = null, bd = 1e9;
      for (const C of this.colonies) for (const O of C.orgs) { if (!O.alive || O.dormant) continue; const T = O.B; const d = Math.hypot(T.cx - D.cx, T.cy - D.cy) - T.r; if (d < bd) { bd = d; best = T; } }
      const reach = (this.dewReach || 200) * (this.ember ? 2.5 : 1);
      if (!best || bd > reach) { D.ax = -D.vx * 1.5; D.ay = -D.vy * 1.5; continue; }
      const dx = best.cx - D.cx, dy = best.cy - D.cy, d = Math.hypot(dx, dy) + 1; const s = (1 - bd / reach) * 900;
      D.ax = dx / d * s - D.vx * 1.5; D.ay = dy / d * s - D.vy * 1.5;
    }
  }

  // tap → focus a droplet (generous hit areas, whatever its size); tapping the focused one tickles it
  pickFocus(wx, wy) {
    const C = this.player; if (!C) return false;
    let best = null, bd = 1e9;
    for (const O of C.orgs) { if (!O.alive) continue; const d = Math.hypot(O.B.cx - wx, O.B.cy - wy) - O.B.r; if (d < 30 && d < bd) { bd = d; best = O; } }
    if (best && best !== C.focus) { C.setFocus(best); return true; }
    if (best) { best.poke(wx, wy); this.sound && this.sound.tickle(); this.emit('tickle', best); return true; }
    return false;
  }

  // ── drawing ───────────────────────────────────────────────────────────
  render(R) {
    const P = this.phys;
    R.beginClusters();
    // free matter first (so living bodies refract it), then rivals, then the player on top
    for (const B of P.bodies) {
      if (!B.alive || B.count <= 0 || B.ctrl && B.ctrl.serial === B.serial) continue;
      R.addBody(P, B, { key: 'f' + B.mat + (B.tint ? B.tint.id : ''), look: R.lookFor(B.mat, B.tint), order: 0, glowBoost: 1, coarse: true });
    }
    for (const C of this.colonies) {
      for (const O of C.orgs) {
        if (!O.alive) continue; const B = O.B;
        const beat = 0.5 + 0.5 * Math.sin(this.time * (O.focused ? 2.5 : 1.4) + O.id);
        const fl = C === this.player ? this.flow : 0;
        const hs = (O.focused ? 1.0 : 0.6) * (0.85 + 0.25 * beat) + 0.35 * Math.min(1, B.energy || 0) + 0.35 * O.gulp + 0.45 * fl;
        const cl = R.addBody(P, B, { key: 'c' + C.group, look: R.lookFor(B.mat, B.tint), order: C === this.player ? 20 + (O.focused ? 1 : 0) : 10, veil: O.veil, glowBoost: 1 + 0.35 * (B.energy || 0) + 0.2 * fl, coarse: !C.isPlayer,
          heart: O.dormant ? null : [B.cx - O.facing.x * B.r * 0.08, B.cy - O.facing.y * B.r * 0.08, B.r * 0.34 + 5, hs * 0.85] });
        if (cl) { O.crown.draw(R, cl); if (O.heat < -0.05) { cl.hasMix = true; cl.frost = Math.max(cl.frost || 0, -O.heat); } if (O.heat > 0.05) cl.glowBoost += 0.6 * O.heat; }
      }
    }
    R.frame(this, this.time);
  }
  // called by the renderer, in order
  under(R) { if (this._rel && this._rel.length) { for (const e of this._rel) R.unbake(e); this._rel.length = 0; } const ink = R.ink; for (const e of this.ents) if (!e.dead && e.under) e.under(ink, R); }
  inner(R) {
    const ink = R.ink, P = this.phys;
    // inner life: specks and micro-bubbles riding the internal flow (a text-free read of the body's motion)
    for (const C of this.colonies) for (const O of C.orgs) {
      if (!O.alive || O.veil > 0.6) continue; const B = O.B; const em = (B.tint || MATS[B.mat]).emit;
      const idx = P.bodyIdx, surf = P.surf, a = 1 - O.veil;
      for (let k = 0; k < B.len; k++) {
        const i = idx[B.start + k]; const h = (Math.imul(i, 2654435761) >>> 0) % 97;
        if (h > 12 || surf[i] > 0.55) continue;
        const wob = Math.sin(this.time * 1.7 + i) * 1.2;
        if (h < 5) ink.speck(P.x[i] + wob, P.y[i] - wob * 0.6, 1, 0.96, 0.86, (0.55 + 0.3 * P.glow[i]) * a, 1.15);
        else if (h < 10) ink.speck(P.x[i] - wob, P.y[i] + wob, 0.55 + 0.45 * em[0], 0.55 + 0.45 * em[1], 0.55 + 0.45 * em[2], 0.5 * a, 0.9);
        else ink.ring(P.x[i] + wob, P.y[i], 1.9 + (h & 1) * 0.8, 0.28, 1, 0.98, 0.92, 0.42 * a);
      }
    }
    // a held breath shows: an iridescent bubble inside the dome
    for (const C of this.colonies) for (const O of C.orgs) { if (!O.alive || O.puff < 0.08) continue; const B = O.B, p = O.puff; const rr = B.r * (0.55 + 0.5 * p); ink.ring(B.cx, B.cy, rr, 0.9, 0.85, 0.95, 1, 0.5 * p, 3); ink.ring(B.cx - rr * 0.3, B.cy - rr * 0.34, rr * 0.3, 0.7, 1, 1, 1, 0.55 * p, 0, 3.5, 5.4); ink.light(B.cx, B.cy, rr * 1.1, PROF.dust, 0.6, 0.85, 1, 0.10 * p); }
    for (const e of this.ents) if (!e.dead && e.inner) e.inner(ink, R);
  }
  overlay(R) {
    const ov = R.ov; ov.solids(R._solids); ov.begin();
    // the creature lights its world: a broad soft wash far beyond the gel's own halo
    for (const C of this.colonies) for (const O of C.orgs) {
      if (!O.alive || O.dormant) continue; const B = O.B; const em = (B.tint || MATS[B.mat]).emit; const g = MATS[B.mat].halo * (1 - O.veil);
      if (g > 0.05) ov.glow(B.cx, B.cy, B.r * 2.1 + 46, em, (0.085 + 0.05 * (B.energy || 0)) * g * 2, 1);
    }
    for (const e of this.ents) if (!e.dead && e.over) e.over(ov, R);
    this.fx.draw(ov);
    if (this.listener && this.listener.overlay) this.listener.overlay(ov, R);
    if (this.host.overlay) this.host.overlay(ov, R);
    ov.end();
  }
}
const G2 = [0, 0];
// what a lab would engrave on the slide: a scale bar, tick marks, and the chamber's number as a row of dots
const ETCH = (W) => ({ x: 0, y: 0, bakeR: 0, bake(ink) {
  const s = W.spec; const P = W.phys; let x = 78, y = s.H - 74; for (let k = 0; k < 40 && P.sampleSDF(x, y) < 26; k++) { x += 9; y -= 9; }
  const c = [0.55, 0.85, 1]; ink.beam(x, y, x + 96, y, 0.9, c[0], c[1], c[2], 0.22, PROF.dust); for (let k = 0; k <= 4; k++) ink.beam(x + k * 24, y - (k % 4 === 0 ? 7 : 4), x + k * 24, y, 0.8, c[0], c[1], c[2], 0.2, PROF.dust);
  const n = Math.min(20, s.no || 0); for (let k = 0; k < n; k++) ink.light(x + 4 + (k % 10) * 9.6, y + 12 + Math.floor(k / 10) * 9, 2.4, PROF.core, c[0], c[1], c[2], k % 5 === 4 ? 0.5 : 0.28);
} });
const TIERS = [[60, 'Drop'], [100, 'Pearl'], [150, 'Bloom'], [210, 'Tide'], [280, 'Leviathan']];
const NOCTL = { intent: null, aim: null, rally: false };
const CHAIN_GAP = 1.7;       // seconds a streak survives without a new mote
export { PROF, H };
