// ─────────────────────────────────────────────────────────────────────────────
//  The living world. Every object announces its physical personality before
//  contact, and answers touch with crisp, legible feedback.
//
//  Entity hooks:  update(dt) before physics · post(dt) after · under(ink) drawn
//  beneath the gel (so it is refracted) · inner(ink) inside/above gel ·
//  over(ov) Canvas2D light on top · bake(ink) static decal in the backdrop.
// ─────────────────────────────────────────────────────────────────────────────
import { PROF } from '../render/ink.js';
import { TAU, clamp } from '../core/util.js';
import { makeShape, moveShape } from '../sim/physics.js';
import { SURF, MAT, MATS } from '../sim/materials.js';
import { solidSprite } from '../render/sprites.js';

export const COL = {
  mote: [1.0, 0.86, 0.56], cyan: [0.45, 0.95, 1.0], heal: [1.0, 0.55, 0.38], gold: [1.0, 0.8, 0.42],
  danger: [1.0, 0.3, 0.22], violet: [0.72, 0.52, 1.0], green: [0.5, 1.0, 0.66], white: [1, 1, 1], rose: [1.0, 0.5, 0.62],
};

export class Entity {
  constructor(W, d) { this.W = W; this.d = d; this.x = d.x || 0; this.y = d.y || 0; this.dead = false; this.t = Math.random() * 10; this.id = d.id; }
  update(dt) { this.t += dt; }
  post(dt) {}
  get on() { return true; }
}

// ── Mote: a dew of light. A feeler fetches it, or the body simply drinks it. ──
export class Mote extends Entity {
  constructor(W, d) {
    super(W, d); this.pickup = true; this.isMote = true; this.curious = true;
    this.value = d.value ?? 2; this.r = 5 + this.value * 0.9;
    this.hx = this.x; this.hy = this.y; this.vx = d.vx || 0; this.vy = d.vy || 0;
    this.seed = Math.random(); this.col = d.col || COL.mote; this.held = null; this.claim = null; this.owner = d.owner ?? null;
    this.free = !!d.free; this.spawnT = d.delay ? -d.delay : 0.0001; this.pop = 0; this.ttl = d.ttl || 0; this.age = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.spawnT < 0.35) this.spawnT += dt;
    if (this.ttl && this.spawnT > 0 && !this.held) { this.age += dt; if (this.age > this.ttl) { this.dead = true; this.W.fx.ring(this.x, this.y, this.col, 14, 0.3, { a: 0.4 }); this.W.emit('moteGone', this); return; } }
    if (this.held) { if (this.baked) this.W.release(this); return; }
    if (this.baked) return;                           // at home, painted into the plate: costs nothing until something wants it
    if (this.free) { const dr = Math.max(0, 1 - 2.2 * dt); this.vx *= dr; this.vy *= dr; this.hx += this.vx * dt; this.hy += this.vy * dt; }
    this.x = this.hx; this.y = this.hy;
  }
  absorb(O, ray) {
    if (this.dead) return; this.dead = true;
    const W = this.W; W.release(this);
    W.feed(O.B, (this.value + (O.colony === W.player ? W.moteBonus || 0 : 0)) * (O.colony === W.player && W.ember ? 2 : 1), this.x, this.y, this.col);
    if (this.d.pity) { if (O.colony === W.player) { W.sound && W.sound.heal(); } return; }                    // wept light feeds, but is not the room's light: it counts for nothing
    if (O.colony === W.player || O.colony && O.colony.ally) { W.stats.motes++; const chain = W.chainUp(this, O); W.sound && W.sound.mote((this.x / W.spec.W) * 1.6 - 0.8, chain); W.host.haptics && W.host.haptics.tick(); W.emit('mote', this, O, chain); }
    else W.emit('moteLost', this, O);
  }
  // a mote at rest is static light → painted once into the backdrop, lifted out again the moment a feeler takes it
  bake(ink) {
    if (this.free) return; const c = this.col, r = this.r;
    this.baked = true; this.bx = this.hx; this.by = this.hy; this.bakeR = r * 4.4;
    ink.light(this.hx, this.hy, r * 4.2, PROF.halo, c[0], c[1], c[2], 0.20);
    ink.light(this.hx, this.hy, r * 1.5, PROF.glow, c[0], c[1], c[2], 1.15);
    ink.light(this.hx, this.hy, r * 0.62, PROF.core, 1, 1, 0.95, 1.0);
    ink.glint(this.hx, this.hy, r * 3.0, c[0], c[1], c[2], 0.7);
  }
  under(ink) {
    if (this.baked || this.spawnT < 0) return;
    const k = Math.min(1, this.spawnT / 0.35); let s = k * (2 - k);
    if (this.ttl) { const left = this.ttl - this.age; if (left < 1.6) s *= 0.55 + 0.45 * Math.abs(Math.sin(left * 9)) * Math.min(1, left / 0.4 + 0.3); }      // about to fade: it flickers
    const c = this.col, r = this.r * s;
    ink.light(this.x, this.y, r * 3.0, PROF.halo, c[0], c[1], c[2], 0.20);
    ink.light(this.x, this.y, r * 1.5, PROF.glow, c[0], c[1], c[2], 1.25);
    ink.light(this.x, this.y, r * 0.62, PROF.core, 1, 1, 0.95, 1.0);
    ink.glint(this.x, this.y, r * 3.0, c[0], c[1], c[2], 0.8);
  }
  // twinkle: now and then one mote flares — life for the price of a single soft sprite
  over(ov) { if (!this.baked) return; const w = Math.sin(this.t * (0.9 + this.seed) + this.seed * 40); if (w > 0.93) ov.glow(this.x, this.y, this.r * 3.4, this.col, (w - 0.93) * 9); }
}

// ── Pore: the way onward. A sleeping iris in the glass that opens when the room has given enough light. ──
export class Pore extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 42; this.open = 0; this.taken = false; this.need = d.need ?? 0; this.col = d.col || COL.cyan; this.curious = true;
    this.light = { x: this.x, y: this.y, r: this.r * 3.2, col: this.col, i: 0.35 };
  }
  get ready() { return this.W.listener && this.W.listener.poreReady ? this.W.listener.poreReady(this) : this.W.stats.motes >= this.need; }
  get progress() { return this.W.listener && this.W.listener.poreProgress ? this.W.listener.poreProgress(this) : (this.need ? Math.min(1, this.W.stats.motes / this.need) : 1); }
  update(dt) {
    this.t += dt;
    const was = this.open > 0.5; const tgt = this.ready ? 1 : 0;
    this.open += (tgt - this.open) * Math.min(1, dt * 2.2);
    if (!was && this.open > 0.5) { this.W.sound && this.W.sound.open(); this.W.fx.ring(this.x, this.y, this.col, this.r * 3, 1.0); this.W.fx.burst(this.x, this.y, 18, this.col, 200, { life: 0.9, size: 2.6 }); this.W.emit('poreOpen', this); }
  }
  post(dt) {
    if (this.taken || this.open < 0.8) return;
    const pl = this.W.player; const F = pl && pl.focus;
    if (!F || !F.alive) return;
    const d = Math.hypot(F.B.cx - this.x, F.B.cy - this.y);
    // gentle goal-cradling: near the open pore the body is drawn in and settles — no ice-parking at the finish
    const calm = Math.hypot(F.intent.x, F.intent.y) < 0.4;
    if (d < this.r * 2.4 && calm) { const k = (1 - d / (this.r * 2.4)) * 420; F.cradle = { ax: (this.x - F.B.cx) / (d + 1) * k, ay: (this.y - F.B.cy) / (d + 1) * k, damp: 1.5 }; }
    // entered on purpose: come to rest on it (you can cross an open pore while chasing the last light)
    if (d < this.r * 0.6 + F.B.r * 0.25 && (calm || Math.hypot(F.B.vx, F.B.vy) < 110)) { this.dwell = (this.dwell || 0) + dt; if (this.dwell > 0.28) { this.taken = true; this.W.emit('complete', this); } } else this.dwell = 0;
  }
  bake(ink) {            // the sleeping iris is etched into the plate
    const c = this.col;
    ink.ring(this.x, this.y, this.r, 1.6, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.55, 5);
    ink.ring(this.x, this.y, this.r * 0.62, 0.7, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, 0.4, 0);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ink.beam(this.x + Math.cos(a) * this.r * 0.66, this.y + Math.sin(a) * this.r * 0.66, this.x + Math.cos(a) * this.r * 0.94, this.y + Math.sin(a) * this.r * 0.94, 1.2, c[0], c[1], c[2], 0.10); }
  }
  over(ov) {
    const o = this.open, c = this.col, p = this.progress;
    const beat = 0.5 + 0.5 * Math.sin(this.t * (1.3 + 2 * o));
    // progress: an arc of light fills the rim as the room gives up its motes
    if (p > 0.01 && o < 0.98) ov.ring(this.x, this.y, this.r, 2.4, c, 0.75 * (1 - o), -Math.PI / 2, -Math.PI / 2 + TAU * p);
    if (o > 0.02) {
      ov.glow(this.x, this.y, this.r * 2.4, c, 0.34 * o * (0.7 + 0.3 * beat), 1);
      ov.ring(this.x, this.y, this.r * (0.96 + 0.03 * beat), 3.0, c, 0.9 * o);
      ov.ring(this.x, this.y, this.r * (0.60 - 0.1 * o + 0.03 * Math.sin(this.t * 3)), 1.6, [1, 1, 1], 0.5 * o);
      ov.glow(this.x, this.y, this.r * 0.9, c, 0.45 * o);
    } else ov.glow(this.x, this.y, this.r * 0.55, c, 0.16 + 0.10 * beat);
  }
}

// sprite cache per entity, regenerated when the view zoom changes
function spriteFor(e, R, S, o) { const z = R.view.z; if (!e._sp || e._sp.z !== z) e._sp = solidSprite(S, z, o); return e._sp; }

// ── Pad: a pressure bloom etched in the plate. Enough of you resting on it wakes it. ──
export class Pad extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 46; this.need = d.need ?? 24; this.fill = 0; this.active = false; this.latch = !!d.latch; this.col = d.col || COL.cyan; this.count = 0; this.curious = true; }
  get on() { return this.active; }
  post(dt) {
    const W = this.W, P = W.phys; let n = 0; const r2 = this.r * this.r;
    P.forEachNear(this.x, this.y, this.r, (i, dx, dy) => { if (dx * dx + dy * dy < r2 && P.bodies[P.body[i]].group === 0) n++; });
    this.count = n; const f = Math.min(1, n / this.need);
    this.fill += (f - this.fill) * Math.min(1, dt * 8);
    const was = this.active; this.active = this.latch ? this.active || n >= this.need : n >= this.need;
    if (this.active !== was) { W.sound && W.sound.plate(this.active); W.fx.ring(this.x, this.y, this.active ? COL.green : this.col, this.r * 1.9, 0.5); W.emit('pad', this); }
    // precision cradle: any body idling near a pad is drawn onto it and settles — holding a switch is never a fight
    if (W.player) for (const O of W.player.orgs) {
      if (!O.alive) continue; const dx = this.x - O.B.cx, dy = this.y - O.B.cy, d = Math.hypot(dx, dy);
      if (d < this.r * 1.6 && Math.abs(O.intent.x) + Math.abs(O.intent.y) < 0.25) O.cradle = { ax: dx * 7, ay: dy * 7, damp: 3 };
    }
  }
  bake(ink) { const c = this.col; ink.ring(this.x, this.y, this.r, 1.3, c[0] * 0.45, c[1] * 0.45, c[2] * 0.45, 0.6, 4); for (let k = 0; k < 3; k++) ink.ring(this.x, this.y, this.r * (0.28 + k * 0.22), 0.5, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 0.45, 0); }
  under(ink) { const c = this.active ? COL.green : this.col; const f = this.fill; if (f > 0.02 || this.active) ink.light(this.x, this.y, this.r * 1.15, PROF.glow, c[0], c[1], c[2], 0.25 + 0.5 * f); }
  over(ov) { const c = this.active ? COL.green : this.col; const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.2); if (this.fill > 0.01) ov.ring(this.x, this.y, this.r, 2.6, c, 0.85, -Math.PI / 2, -Math.PI / 2 + TAU * this.fill); else ov.ring(this.x, this.y, this.r * (0.86 + 0.1 * pulse), 1.2, c, 0.22 + 0.18 * pulse); }
}

// ── Gate: a sliding slab bound to a condition (pads, lanterns, mass…) ─────
export class Gate extends Entity {
  constructor(W, d) {
    super(W, d); this.need = d.need; this.ox = d.x; this.oy = d.y; this.dx = d.dx ?? 0; this.dy = d.dy ?? 0; this.ang = d.a ?? 0;
    this.S = makeShape({ type: 2, x: d.x, y: d.y, hw: (d.w ?? 30) / 2, hh: (d.h ?? 120) / 2, r: Math.min(10, (d.w ?? 30) / 2 - 1), surf: d.surf ?? SURF.METAL, angle: this.ang });
    W.phys.shapes.push(this.S); this.k = 0; this.latch = !!d.latch; this.latched = false; this.inv = !!d.invert;
  }
  get on() { return this.k > 0.5; }
  update(dt) {
    this.t += dt; const W = this.W;
    let open = this.latched || W.check(this.need);
    if (this.latch && open && !this.latched) { this.latched = true; W.fx.ring(this.S.x, this.S.y, COL.green, 110, 0.8); }
    if (this.inv) open = !open;
    const prev = this.k; this.k += ((open ? 1 : 0) - this.k) * Math.min(1, dt * 3.2);
    if ((prev < 0.5) !== (this.k < 0.5)) { W.sound && W.sound.open(); W.emit('gate', this, this.k >= 0.5); }
    const e = this.k * this.k * (3 - 2 * this.k);
    moveShape(this.S, this.ox + this.dx * e, this.oy + this.dy * e, this.ang, dt);
  }
  under(ink, R) { R.solid(spriteFor(this, R, this.S, {}), this.S.x, this.S.y, this.S.angle); }
  over(ov) { if (this.k < 0.9) { const c = this.W.check(this.need) ? COL.green : COL.cyan; ov.glow(this.S.x, this.S.y, 16, c, 0.35 * (1 - this.k)); } }
}

// ── Film: a soap-film of surface tension. It turns a drifting body back — and bursts for one that means it. ──
export class Film extends Entity {
  constructor(W, d) {
    super(W, d); this.len = d.len ?? 160; this.ang = d.a ?? 0; this.speed = d.speed ?? 330; this.down = 0; this.wob = 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: 4, surf: SURF.BOUNCE, rest: 0.9, angle: this.ang });
    W.phys.shapes.push(this.S); this.nx = -Math.sin(this.ang); this.ny = Math.cos(this.ang); this.col = d.col || [0.6, 0.95, 1];
  }
  update(dt) {
    this.t += dt; const W = this.W; this.wob = Math.max(0, this.wob - dt * 3);
    if (this.down > 0) { this.down -= dt; if (this.down <= 0) { let clear = true; if (W.playerBodyAt(this.x, this.y, this.len * 0.5 + 10)) clear = false; if (clear) { this.S.active = true; W.fx.ring(this.x, this.y, this.col, this.len * 0.5, 0.4, { a: 0.4 }); } else this.down = 0.2; } return; }
    if (!W.player) return;
    for (const O of W.player.orgs) {
      if (!O.alive) continue; const B = O.B; const rx = B.cx - this.x, ry = B.cy - this.y;
      const along = rx * Math.cos(this.ang) + ry * Math.sin(this.ang), off = rx * this.nx + ry * this.ny;
      if (Math.abs(along) > this.len / 2 + B.r * 0.5 || Math.abs(off) > B.r + 16) continue;
      const vn = -(B.vx * this.nx + B.vy * this.ny) * Math.sign(off || 1);         // speed toward the film
      if (vn > this.speed) { this.pop(O); break; } else if (vn > 60) this.wob = Math.max(this.wob, Math.min(1, vn / this.speed));
    }
  }
  pop(O) {
    const W = this.W; this.S.active = false; this.down = 1.6;
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (let k = -4; k <= 4; k++) W.fx.burst(this.x + ca * k * this.len / 9, this.y + sa * k * this.len / 9, 3, this.col, 150, { type: 1, size: 2.6, life: 0.6 });
    W.fx.ring(O.B.cx, O.B.cy, this.col, 90, 0.5); W.sound && W.sound.pop(1); W.sound && W.sound.bounce(0.8); W.shake = Math.min(1, W.shake + 0.25);
    W.hitStop = 0.06; W.emit('film', this, O);
  }
  over(ov) {
    if (!this.S.active) return; const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2;
    const sh = 0.55 + 0.25 * Math.sin(this.t * 3) + 0.5 * this.wob;
    ov.line(this.x - ca * h, this.y - sa * h, this.x + ca * h, this.y + sa * h, 2.2 + 2 * this.wob, this.col, sh);
    // iridescence sliding along the film
    const u = (this.t * 0.35) % 1; ov.glow(this.x + ca * (u * 2 - 1) * h, this.y + sa * (u * 2 - 1) * h, 14, [1, 0.8, 0.95], 0.35);
    ov.glow(this.x + ca * ((u + 0.5) % 1 * 2 - 1) * h, this.y + sa * ((u + 0.5) % 1 * 2 - 1) * h, 12, [0.7, 1, 0.9], 0.3);
  }
}

// ── Blade: a severing edge (spinning or sweeping). It parts gel cleanly; the pieces live. ──
export class Blade extends Entity {
  constructor(W, d) {
    super(W, d); this.len = d.len ?? 120; this.spin = d.spin ?? 0; this.sweep = d.sweep || null; this.period = d.period ?? 3; this.phase = d.phase ?? 0; this.a = d.a ?? 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: 2.5, surf: SURF.BLADE, cut: true, angle: this.a });
    W.phys.shapes.push(this.S); this.hazard = { x: d.x, y: d.y, r: this.len * 0.5 };
  }
  update(dt) {
    this.t += dt; let x = this.x, y = this.y;
    if (this.sweep) { const s = Math.sin((this.t + this.phase) * TAU / this.period); x += this.sweep[0] * s; y += this.sweep[1] * s; }
    this.a += this.spin * dt; moveShape(this.S, x, y, this.a, dt); this.hazard.x = x; this.hazard.y = y;
  }
  bake(ink) { if (this.spin) ink.ring(this.x, this.y, this.len / 2 + 3, 0.5, 0.5, 0.16, 0.13, 0.5, 0); else if (this.sweep) ink.beam(this.x - this.sweep[0], this.y - this.sweep[1], this.x + this.sweep[0], this.y + this.sweep[1], 1.4, 0.5, 0.16, 0.13, 0.25); ink.disc(this.x, this.y, 5, 0.16, 0.18, 0.22, 1); }
  under(ink) { const S = this.S, ca = Math.cos(S.angle) * this.len / 2, sa = Math.sin(S.angle) * this.len / 2; ink.beam(S.x - ca, S.y - sa, S.x + ca, S.y + sa, 6.5, 1.0, 0.30, 0.26, 1.0); ink.beam(S.x - ca, S.y - sa, S.x + ca, S.y + sa, 1.8, 1, 0.96, 0.92, 1, PROF.core); }
  // a blade announces itself: an after-image of where it has just been, hot tips, a red breath on the plate
  over(ov) {
    const S = this.S, h = this.len / 2; const red = COL.danger;
    if (this.spin) for (let k = 1; k <= 3; k++) { const a = S.angle - this.spin * 0.055 * k; const ca = Math.cos(a) * h, sa = Math.sin(a) * h; ov.line(S.x - ca, S.y - sa, S.x + ca, S.y + sa, 2.6 - 0.5 * k, red, 0.20 - 0.05 * k); }
    const ca = Math.cos(S.angle) * h, sa = Math.sin(S.angle) * h; const fl = 0.75 + 0.25 * Math.sin(this.t * 23);
    ov.glow(S.x - ca, S.y - sa, 15, [1, 0.6, 0.45], 0.8 * fl); ov.glow(S.x + ca, S.y + sa, 15, [1, 0.6, 0.45], 0.8 * fl);
    ov.glow(S.x, S.y, this.len * 0.55, red, 0.13);
  }
}

// ── Grinder: an abrasive gear. It shaves mass into sparks you can chase back. ──
export class Grinder extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 46; this.spin = d.spin ?? 2.4; this.acc = 0; this.orbit = d.orbit || null;
    this.S = makeShape({ type: 0, x: d.x, y: d.y, r: this.r + 3, surf: SURF.GRIT, grip: 0.5, porous: true }); W.phys.shapes.push(this.S);      // porous: a feeler may dare to reach between the teeth
    this.hazard = { x: d.x, y: d.y, r: this.r + 12 };
  }
  update(dt) { this.t += dt; let x = this.x, y = this.y; if (this.orbit) { const o = this.orbit; const a = this.t * (o.w ?? 0.6) + (o.p ?? 0); x = o.x + Math.cos(a) * o.r; y = o.y + Math.sin(a) * (o.ry ?? o.r); } moveShape(this.S, x, y, this.S.angle + this.spin * dt, dt); this.hazard.x = x; this.hazard.y = y; }
  post(dt) {
    const W = this.W, P = W.phys; this.acc += dt; if (this.acc < 0.07) return; this.acc = 0; let shed = 0, who = null;
    P.forEachNear(this.S.x, this.S.y, this.r + 13, (i) => {
      if (shed >= 2) return; const B = P.bodies[P.body[i]];
      if (B.group < 0 || B.count < 8 || P.mat[i] === MAT.BASTION && Math.random() < 0.85 || Math.random() < 0.5) return;
      who = B; W.shed(i, this.S.x, this.S.y, [1.0, 0.6, 0.3]); shed++;
    });
    if (shed) { W.sound && W.sound.grind(); W.hurt(who, shed, this.S.x, this.S.y); }
  }
  under(ink, R) { R.solid(spriteFor(this, R, { ...this.S, r: this.r - 5 }, { teeth: 11, toothH: 8, surf: SURF.GRIT, hub: this.r * 0.22 }), this.S.x, this.S.y, this.S.angle); }
  over(ov) { ov.glow(this.S.x, this.S.y, this.r * 1.7, [1, 0.5, 0.2], 0.13 + 0.04 * Math.sin(this.t * 9)); }
}

// ── Pool: a warm spring (heals in a lush rush), a catalyst bath (changes what you are), or a rinse ──
export class Pool extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 60; this.kind = d.kind ?? 'heal'; this.mat = d.mat ?? MAT.LUMEN; this.cap = d.cap ?? 0; this.rate = d.rate ?? 26; this.acc = 0; this.given = 0; this.max = d.max ?? 60;
    const m = MATS[this.mat]; this.col = d.col || (this.kind === 'heal' ? COL.heal : this.kind === 'rinse' ? [0.6, 0.85, 1.0] : m.emit.map(v => Math.min(1, v * 1.1)));
    this.light = { x: this.x, y: this.y, r: this.r * 2.4, col: this.col, i: 0.55 }; this.curious = true; this.morph = d.morph || null; this.used = 0;
  }
  post(dt) {
    const W = this.W; if (!W.player) return; this.used = Math.max(0, this.used - dt);
    for (const O of W.player.orgs) {
      if (!O.alive) continue; const B = O.B; const d = Math.hypot(B.cx - this.x, B.cy - this.y); if (d > this.r + B.r * 0.3) continue;
      if (this.kind === 'heal') {
        if (this.given >= this.max || (this.cap && W.player.mass >= this.cap)) continue;
        this.acc += dt * this.rate; while (this.acc >= 1) { this.acc -= 1; const a = Math.random() * TAU; W.feed(B, 1, B.cx + Math.cos(a) * B.r * 0.9, B.cy + Math.sin(a) * B.r * 0.9, this.col, true); this.given++; W.sound && W.sound.heal(); }
        this.used = 0.3; O.joyT = 0.5;
      } else if (B.mat !== this.mat) { W.morph(B, this.mat, this.morph); this.used = 1; W.emit('pool', this, O); }
    }
  }
  bake(ink) { const c = this.col; ink.light(this.x, this.y, this.r * 1.5, PROF.halo, c[0], c[1], c[2], 0.22); ink.ring(this.x, this.y, this.r, 1.4, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 0.7, 6); }
  under(ink) { const c = this.col; const spent = this.kind === 'heal' ? 1 - Math.min(1, this.given / this.max) : 1; ink.light(this.x, this.y, this.r * (0.95 + 0.05 * Math.sin(this.t * 2)), PROF.glow, c[0], c[1], c[2], (0.38 + 0.5 * this.used) * (0.25 + 0.75 * spent)); }
  over(ov) { const c = this.col; const spent = this.kind === 'heal' ? 1 - Math.min(1, this.given / this.max) : 1; for (let k = 0; k < 2; k++) { const u = (this.t * 0.4 + k * 0.5) % 1; ov.ring(this.x, this.y, this.r * (0.2 + 0.8 * u), 1.4, c, 0.4 * (1 - u) * spent); } }
}

// ── Current: a river in the film. You see it before you feel it. ──────────
export class Current extends Entity {
  constructor(W, d) {
    super(W, d); this.w = d.w ?? 200; this.h = d.h ?? 120; this.vx = d.vx ?? 160; this.vy = d.vy ?? 0; this.k = d.k ?? 3.2; this.col = d.col || [0.55, 0.9, 1];
    const hw = this.w / 2, hh = this.h / 2; const feather = d.feather ?? 26;
    W.phys.zones.push(this.Z = { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh, flow: true, flowK: this.k, fvx: this.vx, fvy: this.vy,
      weight: (px, py) => Math.min(1, Math.min(px - (this.x - hw), this.x + hw - px, py - (this.y - hh), this.y + hh - py) / feather) });
    this.str = []; const n = Math.max(6, Math.round(this.w * this.h / 5200)); for (let k = 0; k < n; k++) this.str.push({ u: Math.random(), v: Math.random(), s: 0.6 + 0.8 * Math.random() });
  }
  bake(ink) { const c = this.col, sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp; const n = 5; for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5; const ox = -uy * t * (Math.abs(ux) > 0.5 ? this.h : this.w) * 0.8, oy = ux * t * (Math.abs(ux) > 0.5 ? this.h : this.w) * 0.8; const L = (Math.abs(ux) > 0.5 ? this.w : this.h) * 0.46; ink.beam(this.x + ox - ux * L, this.y + oy - uy * L, this.x + ox + ux * L, this.y + oy + uy * L, 7, c[0], c[1], c[2], 0.045); } }
  over(ov) {
    const sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp; const horiz = Math.abs(ux) > 0.5; const L = horiz ? this.w : this.h, Wd = horiz ? this.h : this.w;
    for (const s of this.str) { const u = (s.u + this.t * sp / L * 0.55 * s.s) % 1; const a = Math.sin(u * Math.PI); const px = this.x + ux * (u - 0.5) * L - uy * (s.v - 0.5) * Wd * 0.8, py = this.y + uy * (u - 0.5) * L + ux * (s.v - 0.5) * Wd * 0.8; ov.line(px - ux * 16 * s.s, py - uy * 16 * s.s, px + ux * 16 * s.s, py + uy * 16 * s.s, 1.3, this.col, 0.42 * a); }
  }
}

// ── Well: a hungry dark. The grid bends toward it, light spirals in, and what crosses the rim is gone. ──
export class Well extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 22; this.reach = d.reach ?? 260; this.strength = d.strength ?? 120000; this.swirl = d.swirl ?? 42000; this.acc = 0;
    W.phys.zones.push({ x0: this.x - this.reach, y0: this.y - this.reach, x1: this.x + this.reach, y1: this.y + this.reach, attract: true, ax: this.x, ay: this.y, strength: this.strength, swirl: this.swirl, soft: 34,
      weight: (px, py) => { const dd = Math.hypot(px - this.x, py - this.y); return dd > this.reach ? 0 : Math.min(1, (this.reach - dd) / 60); } });
    W.wells.push({ x: this.x, y: this.y, r: this.reach * 0.45, s: -0.5, swirl: 1.1 }); this.hazard = { x: this.x, y: this.y, r: this.r * 3.2 };
  }
  post(dt) {
    const W = this.W, P = W.phys; this.acc += dt; if (this.acc < 0.05) return; this.acc = 0; let who = null, n = 0;
    P.forEachNear(this.x, this.y, this.r + 4, (i) => { const B = P.bodies[P.body[i]]; if (B.group === 0) { who = B; n++; } P.kill(i); });
    if (n) { W.stats.lost += n; W.fx.sparks(this.x, this.y, Math.min(6, n), 0, -1, [0.8, 0.6, 1], 120, { spread: 6.3, life: 0.4 }); W.hurt(who, n, this.x, this.y, true); }
  }
  under(ink) { ink.disc(this.x, this.y, this.r * 1.05, 0, 0, 0, 1); }
  over(ov) { const c = [0.75, 0.6, 1]; for (let k = 0; k < 3; k++) { const u = 1 - ((this.t * 0.33 + k / 3) % 1); ov.ring(this.x, this.y, this.r * (1.15 + u * 3.2), 1.3, c, 0.36 * (1 - u), this.t * 2 + k * 2.1, this.t * 2 + k * 2.1 + 4.4); } ov.ring(this.x, this.y, this.r * 1.12, 2.2, [1, 0.85, 0.7], 0.75); ov.glow(this.x, this.y, this.r * 3.4, c, 0.14, 1); }
}

// ── Crusher: a rhythmic piston. It warns, slams, holds, lifts — flow through on the off-beat. ──
export class Crusher extends Entity {
  constructor(W, d) {
    super(W, d); this.w = d.w ?? 110; this.h = d.h ?? 150; this.travel = d.travel ?? 130; this.period = d.period ?? 2.6; this.phase = d.phase ?? 0; this.dir = d.dir ?? [0, 1];
    this.S = makeShape({ type: 2, x: d.x, y: d.y, hw: this.w / 2, hh: this.h / 2, r: 12, surf: SURF.METAL }); W.phys.shapes.push(this.S); this.warn = 0;
  }
  update(dt) {
    this.t += dt; const p = (this.t / this.period + this.phase) % 1; let k;
    if (p < 0.45) k = 0; else if (p < 0.55) { const u = (p - 0.45) / 0.1; k = u * u; } else if (p < 0.7) k = 1; else { const u = (p - 0.7) / 0.3; k = 1 - u * u * (3 - 2 * u); }
    this.warn = p > 0.28 && p < 0.45 ? (p - 0.28) / 0.17 : 0;
    moveShape(this.S, this.x + this.dir[0] * this.travel * k, this.y + this.dir[1] * this.travel * k, 0, dt);
    if (this._last !== undefined && this._last < 0.95 && k >= 0.999) { const W = this.W; W.sound && W.sound.boom(); W.shake = Math.min(1, W.shake + 0.4); W.fx.burst(this.S.x + this.dir[0] * this.w / 2, this.S.y + this.dir[1] * this.h / 2, 8, [0.8, 0.9, 1], 160, { size: 2.5, life: 0.5, type: 1 }); }
    this._last = k;
  }
  under(ink, R) { R.solid(spriteFor(this, R, this.S, {}), this.S.x, this.S.y, 0); }
  over(ov) { if (this.warn > 0) ov.glow(this.S.x + this.dir[0] * this.w * 0.5, this.S.y + this.dir[1] * this.h * 0.5, 60, [1, 0.5, 0.3], this.warn * 0.5); }
}

// ── Lantern: a sleeping glass anemone your touch blooms (a second kind of key, and a checkpoint of light) ──
export class Lantern extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 22; this.lit = !!d.lit; this.bloom = this.lit ? 1 : 0; this.col = d.col || [1.0, 0.76, 0.46]; this.curious = true; }
  get on() { return this.lit; }
  update(dt) { this.t += dt; this.bloom += ((this.lit ? 1 : 0) - this.bloom) * Math.min(1, dt * 1.8); }
  post() { if (this.lit) return; const W = this.W; if (W.playerBodyAt(this.x, this.y, this.r + 8)) { this.lit = true; W.sound && W.sound.bloom(); W.fx.ring(this.x, this.y, this.col, 150, 1.1); W.fx.burst(this.x, this.y, 22, this.col, 240, { size: 3.4, life: 1.0, drag: 1.8 }); W.emit('lantern', this); } }
  bake(ink) { const c = this.col; ink.ring(this.x, this.y, this.r, 1.2, c[0] * 0.35, c[1] * 0.35, c[2] * 0.35, 0.7, 3); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; ink.beam(this.x, this.y, this.x + Math.cos(a) * this.r * 0.9, this.y + Math.sin(a) * this.r * 0.9, 1.6, c[0], c[1], c[2], 0.07); } }
  under(ink) { const b = this.bloom, c = this.col; if (b < 0.02) { ink.light(this.x, this.y, this.r * 0.5, PROF.glow, c[0], c[1], c[2], 0.12 + 0.06 * Math.sin(this.t * 2)); return; } for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + Math.sin(this.t * 1.1 + k) * 0.12; ink.beam(this.x, this.y, this.x + Math.cos(a) * this.r * (0.9 + 0.5 * b), this.y + Math.sin(a) * this.r * (0.9 + 0.5 * b), 3.4, c[0], c[1], c[2], 0.5 * b); } ink.light(this.x, this.y, this.r * 1.0, PROF.glow, c[0], c[1], c[2], 1.1 * b); ink.light(this.x, this.y, this.r * 0.4, PROF.core, 1, 1, 0.95, b); }
  over(ov) { if (this.bloom > 0.02) ov.glow(this.x, this.y, this.r * 5, this.col, 0.16 * this.bloom, 1); }
}

// ── Watcher: a sweeping gaze. It burns what it sees move — but a body resting against a wall exhales
//    into a near-invisible veil, and anything behind stone is simply not there. ──
export class Watcher extends Entity {
  constructor(W, d) { super(W, d); this.watch = true; this.range = d.range ?? 270; this.half = d.half ?? 0.30; this.a0 = d.a ?? Math.PI / 2; this.sweep = d.sweep ?? 0.9; this.speed = d.speed ?? 0.6; this.ang = this.a0; this.alert = 0; this.acc = 0; this.seen = null; }
  update(dt) { this.t += dt; this.ang = this.a0 + Math.sin(this.t * this.speed + (this.d.phase || 0)) * this.sweep; }
  post(dt) {
    const W = this.W, P = W.phys; let seen = null;
    if (W.player) for (const O of W.player.orgs) {
      if (!O.alive || O.stealth) continue; const B = O.B; const dx = B.cx - this.x, dy = B.cy - this.y, d = Math.hypot(dx, dy) + 1; if (d > this.range + B.r) continue;
      let da = Math.atan2(dy, dx) - this.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (Math.abs(da) > this.half + Math.atan2(B.r * 0.7, d)) continue;
      if (P.raycast(this.x, this.y, dx / d, dy / d, Math.max(0, d - B.r))) continue;          // stone hides you
      seen = O; break;
    }
    this.seen = seen; this.alert = clamp(this.alert + (seen ? dt * 3.0 : -dt * 1.2), 0, 1);
    if (seen && this.alert >= 1) { this.acc += dt; if (this.acc > 0.06) { this.acc = 0; const B = seen.B; if (B.count > 8) { const i = P.bodyIdx[B.start + ((Math.random() * B.len) | 0)]; if (P.alive[i] && P.body[i] === B.id) { W.shed(i, this.x, this.y, [1, 0.45, 0.3], 5); W.hurt(B, 1, this.x, this.y); } } } }
  }
  bake(ink) { ink.ring(this.x, this.y, 13, 1.4, 0.3, 0.5, 0.6, 0.8, 3); ink.disc(this.x, this.y, 9, 0.03, 0.05, 0.07, 1); }
  over(ov) {
    const hot = this.alert, c = [0.45 + 0.55 * hot, 0.9 - 0.55 * hot, 1 - 0.7 * hot]; const a0 = this.ang - this.half, a1 = this.ang + this.half, R = this.range;
    ov.line(this.x, this.y, this.x + Math.cos(a0) * R, this.y + Math.sin(a0) * R, 1.2, c, 0.30 + 0.4 * hot); ov.line(this.x, this.y, this.x + Math.cos(a1) * R, this.y + Math.sin(a1) * R, 1.2, c, 0.30 + 0.4 * hot);
    ov.ring(this.x, this.y, R, 1.2, c, 0.22 + 0.4 * hot, a0, a1); ov.ring(this.x, this.y, R * 0.55, 0.8, c, 0.12 + 0.3 * hot, a0, a1);
    ov.glow(this.x + Math.cos(this.ang) * 5, this.y + Math.sin(this.ang) * 5, 9 + 6 * hot, c, 0.9); if (this.seen) ov.line(this.x, this.y, this.seen.B.cx, this.seen.B.cy, 1 + 2.5 * hot, c, 0.35 + 0.5 * hot);
  }
}

// ── Frost: a field of cold. Gel inside stiffens and slows; frozen through, only a dart cracks it. ──
export class Frost extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 130; this.rate = d.rate ?? 0.5; }
  post(dt) { for (const C of this.W.colonies) for (const O of C.orgs) { if (!O.alive) continue; const dd = Math.hypot(O.B.cx - this.x, O.B.cy - this.y); if (dd < this.r) O.heat = Math.max(-1, O.heat - this.rate * dt * (0.5 + 0.5 * (1 - dd / this.r))); } }
  bake(ink) { ink.light(this.x, this.y, this.r * 1.25, PROF.halo, 0.5, 0.78, 1, 0.20); ink.ring(this.x, this.y, this.r, 0.8, 0.55, 0.85, 1, 0.5, 9); for (let k = 0; k < 28; k++) { const a = k * 2.399, rr = this.r * Math.sqrt((k + 0.5) / 28); const x = this.x + Math.cos(a) * rr, y = this.y + Math.sin(a) * rr; ink.glint(x, y, 5 + (k % 3) * 2, 0.7, 0.92, 1, 0.5); } }
  over(ov) { for (let k = 0; k < 4; k++) { const u = (this.t * 0.11 + k * 0.25) % 1; const a = k * 1.9 + this.t * 0.2; ov.glow(this.x + Math.cos(a) * this.r * 0.75 * u, this.y + Math.sin(a) * this.r * 0.75 * u + u * 14, 7, [0.8, 0.95, 1], 0.5 * Math.sin(u * Math.PI)); } }
}
// ── Vent: a thermal spring. It fills you with warmth: quicker, brighter, proof against frost for a while. ──
export class Vent extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 46; this.col = [1, 0.5, 0.2]; this.light = { x: this.x, y: this.y, r: this.r * 2.6, col: this.col, i: 0.6 }; this.curious = true; }
  post(dt) { for (const C of this.W.colonies) for (const O of C.orgs) { if (!O.alive) continue; if (Math.hypot(O.B.cx - this.x, O.B.cy - this.y) < this.r + O.B.r * 0.3) { if (O.heat < 0.95 && C === this.W.player && Math.random() < dt * 6) this.W.sound && this.W.sound.heal(); O.heat = Math.min(1, O.heat + 2.4 * dt); } } }
  bake(ink) { const c = this.col; ink.light(this.x, this.y, this.r * 1.6, PROF.halo, c[0], c[1], c[2], 0.3); ink.ring(this.x, this.y, this.r, 1.5, c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0.8, 7); ink.light(this.x, this.y, this.r * 0.5, PROF.glow, 1, 0.7, 0.3, 0.7); }
  over(ov) { for (let k = 0; k < 3; k++) { const u = (this.t * 0.5 + k / 3) % 1; ov.ring(this.x, this.y, this.r * (0.25 + 0.75 * u), 1.6, this.col, 0.5 * (1 - u)); } }
}
// ── IcePlug: a frozen door. Only a body carrying warmth melts it. ─────────
export class IcePlug extends Entity {
  constructor(W, d) { super(W, d); this.hp = 1; this.S = makeShape({ type: 2, x: d.x, y: d.y, hw: (d.w ?? 40) / 2, hh: (d.h ?? 120) / 2, r: 10, surf: SURF.ICE }); W.phys.shapes.push(this.S); }
  get on() { return this.hp <= 0; }
  post(dt) {
    if (this.hp <= 0) return; const W = this.W, S = this.S; let melt = false;
    for (const C of W.colonies) for (const O of C.orgs) { if (!O.alive || O.heat < 0.2) continue; const B = O.B; if (Math.abs(B.cx - S.x) < S.hw + B.r + 8 && Math.abs(B.cy - S.y) < S.hh + B.r + 8) { melt = true; O.heat -= dt * 0.45; } }
    if (melt) { this.hp -= dt * 0.8; if (Math.random() < dt * 14) W.fx.bubble(S.x + (Math.random() - 0.5) * S.hw * 2, S.y + (Math.random() - 0.5) * S.hh * 2, 3); if (this.hp <= 0) { S.active = false; W.fx.burst(S.x, S.y, 26, [0.75, 0.95, 1], 220, { type: 1, size: 3, life: 0.8 }); W.fx.ring(S.x, S.y, [0.7, 0.95, 1], 130, 0.7); W.sound && W.sound.open(); W.emit('melt', this); } }
  }
  under(ink, R) { if (this.hp > 0) R.solid(spriteFor(this, R, this.S, { surf: SURF.GLASS, tint: [0.7, 0.95, 1.2] }), this.S.x, this.S.y, 0, 0.35 + 0.65 * this.hp); }
  over(ov) { if (this.hp > 0) ov.glow(this.S.x, this.S.y, Math.max(this.S.hw, this.S.hh) * 1.4, [0.6, 0.9, 1], 0.16 + 0.3 * (1 - this.hp)); }
}
// ── Magnet: a pulsing pole. Ferrofluid leaps to it in a crown of spikes; nothing else notices. ──
export class Magnet extends Entity {
  constructor(W, d) {
    super(W, d); this.reach = d.reach ?? 230; this.power = d.power ?? 950; this.period = d.period ?? 0; this.phase = d.phase ?? 0; this.onK = 1; this.col = [0.6, 0.72, 1];
    W.phys.zones.push(this.Z = { x0: this.x - this.reach, y0: this.y - this.reach, x1: this.x + this.reach, y1: this.y + this.reach, magnet: this.power, ax: this.x, ay: this.y, weight: (px, py) => { const dd = Math.hypot(px - this.x, py - this.y); return dd > this.reach ? 0 : Math.min(1, (this.reach - dd) / 50) * this.onK; } });
    this.S = makeShape({ type: 0, x: d.x, y: d.y, r: d.r ?? 15, surf: SURF.METAL }); W.phys.shapes.push(this.S);
  }
  update(dt) { this.t += dt; const on = !this.period || ((this.t / this.period + this.phase) % 1) < 0.62; this.onK += ((on ? 1 : 0) - this.onK) * Math.min(1, dt * 7); }
  bake(ink, R) { ink.blit(spriteFor(this, R, this.S, {}), this.x, this.y, 0); for (let k = 1; k <= 3; k++) ink.ring(this.x, this.y, this.reach * k / 3.4, 0.4, 0.35, 0.45, 0.7, 0.5, 0); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ink.beam(this.x + Math.cos(a) * 24, this.y + Math.sin(a) * 24, this.x + Math.cos(a) * this.reach * 0.86, this.y + Math.sin(a) * this.reach * 0.86, 1, 0.4, 0.5, 0.8, 0.07); } }
  over(ov) { const k = this.onK; if (k > 0.03) { for (let q = 0; q < 2; q++) { const u = 1 - ((this.t * 0.7 + q * 0.5) % 1); ov.ring(this.x, this.y, 20 + u * this.reach * 0.8, 1.3, this.col, 0.4 * k * u); } ov.glow(this.x, this.y, 34, this.col, 0.7 * k); } else ov.glow(this.x, this.y, 16, this.col, 0.15); }
}

// ── Rotor: a ring of glass with a doorway, turning. The doorway is the only way through — and it will not wait. ──
export class Rotor extends Entity {
  constructor(W, d) {
    super(W, d); this.spin = d.spin ?? 0.4; this.pulse = d.pulse || 0; this.R = d.R ?? 120; this.th = d.r ?? 9;
    this.S = makeShape({ type: 3, x: d.x, y: d.y, R: this.R, r: this.th, gap: d.gap ?? 0.3, surf: d.surf ?? SURF.GLASS, angle: d.a ?? 0 });
    W.phys.shapes.push(this.S); this.col = d.col || COL.cyan;
  }
  update(dt) { this.t += dt; const k = this.pulse ? 0.6 + 0.4 * Math.sin(this.t * this.pulse) : 1; moveShape(this.S, this.x, this.y, this.S.angle + this.spin * k * dt, dt); }
  bake(ink) { ink.ring(this.x, this.y, this.R, this.th + 5, 0, 0, 0, 0, 0); const c = this.col; ink.ring(this.x, this.y, this.R + this.th + 4, 0.4, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.35, 0); ink.ring(this.x, this.y, this.R - this.th - 4, 0.4, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.35, 0); }
  under(ink, R) { R.solid(spriteFor(this, R, this.S, {}), this.x, this.y, this.S.angle); }
  // the doorway announces itself: two jamb-lights and a breath of light between them
  over(ov) {
    const S = this.S, g = S.gap; const b = 0.6 + 0.4 * Math.sin(this.t * 3);
    for (const sg of [-1, 1]) { const a = S.angle + sg * g; ov.glow(this.x + Math.cos(a) * this.R, this.y + Math.sin(a) * this.R, this.th * 1.9, this.col, 0.75 * b); }
    ov.glow(this.x + Math.cos(S.angle) * this.R, this.y + Math.sin(S.angle) * this.R, this.R * Math.sin(g) * 1.3, this.col, 0.16, 1);
  }
}

// ── Spinner: arms of glass turning about a hub — a centrifuge. Each arm may be whole or broken by a doorway. ──
export class Spinner extends Entity {
  constructor(W, d) {
    super(W, d); this.spin = d.spin ?? 0.45; this.pulse = d.pulse || 0; this.ang = d.a ?? 0; this.w = d.w ?? 9; this.arms = []; this.col = d.col || COL.cyan;
    const n = d.n ?? 3, r0 = d.r0 ?? 34, r1 = d.r1 ?? 180;
    for (let k = 0; k < n; k++) {
      const segs = d.door ? [[r0, d.door[k % d.door.length] - 30], [d.door[k % d.door.length] + 30, r1]] : [[r0, r1]];
      for (const [a, b] of segs) { if (b - a < 12) continue; const S = makeShape({ type: 1, x: d.x, y: d.y, hl: (b - a) / 2, r: this.w, surf: d.surf ?? SURF.GLASS }); S._mid = (a + b) / 2; S._k = k; W.phys.shapes.push(S); this.arms.push(S); }
    }
    this.n = n; this.hub = makeShape({ type: 0, x: d.x, y: d.y, r: d.hub ?? 26, surf: d.surf ?? SURF.GLASS }); W.phys.shapes.push(this.hub); this._place(1 / 60);
  }
  _place(dt) { for (const S of this.arms) { const a = this.ang + S._k / this.n * TAU; moveShape(S, this.x + Math.cos(a) * S._mid, this.y + Math.sin(a) * S._mid, a, dt); } }
  update(dt) { this.t += dt; const k = this.pulse ? 0.62 + 0.38 * Math.sin(this.t * this.pulse) : 1; this.omega = this.spin * k; this.ang += this.omega * dt; this._place(dt); }
  under(ink, R) { for (const S of this.arms) { if (!S._sp || S._sp.z !== R.view.z) S._sp = solidSprite(S, R.view.z, {}); R.solid(S._sp, S.x, S.y, S.angle); } R.solid(spriteFor(this, R, this.hub, {}), this.x, this.y, this.ang); }
  over(ov) { ov.glow(this.x, this.y, 46, this.col, 0.35 + 0.15 * Math.sin(this.t * 2)); for (const S of this.arms) { const a = S.angle; const e = S._mid + S.hl; ov.glow(this.x + Math.cos(a) * e, this.y + Math.sin(a) * e, 12, this.col, 0.5); } }
}

export const ENT = { rotor: Rotor, spinner: Spinner, mote: Mote, pore: Pore, pad: Pad, gate: Gate, film: Film, blade: Blade, grinder: Grinder, pool: Pool, current: Current, well: Well, crusher: Crusher, lantern: Lantern, watcher: Watcher, frost: Frost, vent: Vent, iceplug: IcePlug, magnet: Magnet };

// helpers for room builders
export function moteTrail(pts, n, value = 2, extra = {}) {
  const out = []; let total = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  for (let k = 0; k < n; k++) {
    let d = n === 1 ? total / 2 : total * k / (n - 1), i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? d / seg[i] : 0;
    out.push({ type: 'mote', x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, value, ...extra });
  }
  return out;
}
export function moteRing(cx, cy, r, n, value = 2, extra = {}) { const out = []; for (let k = 0; k < n; k++) { const a = k / n * TAU + (extra.a0 || 0); out.push({ type: 'mote', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, value, ...extra }); } return out; }
