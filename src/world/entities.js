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
import { initKind, stepKind, drawKind, bakeKind, takenKind, Pod } from './plankton.js';

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
    this.kind = d.kind || null; this.living = false; if (this.kind) initKind(this, W, d);          // living light (plankton.js): drift · shy · shoal · firefly · seed
  }
  update(dt) {
    this.t += dt;
    if (this.spawnT < 0.35) this.spawnT += dt;
    if (this.ttl && this.spawnT > 0 && !this.held) { this.age += dt; if (this.age > this.ttl) { this.dead = true; this.W.fx.ring(this.x, this.y, this.col, 14, 0.3, { a: 0.4 }); this.W.emit('moteGone', this); return; } }
    // A feeler that claimed or carried this light belonged to a body; if that body is gone (eaten, fused into a sibling) the feeler went with it, and a claim
    // nobody is making must not keep every other feeler — and the autopilot — away from the light for ever (found as an unwinnable "every light" sprint).
    { const r = this.held || this.claim; if (r && r.beat !== undefined && this.W.time - r.beat > 0.6) { this.held = null; this.claim = null; } }
    if (this.held) { if (this.baked) this.W.release(this); return; }
    if (this.living) { stepKind(this, dt); this.x = this.hx; this.y = this.hy; return; }
    if (this.baked) return;                           // at home, painted into the plate: costs nothing until something wants it
    if (this.free) { const dr = Math.max(0, 1 - 2.2 * dt); this.vx *= dr; this.vy *= dr; this.hx += this.vx * dt; this.hy += this.vy * dt; }
    this.x = this.hx; this.y = this.hy;
  }
  absorb(O, ray) {
    if (this.dead) return; this.dead = true;
    const W = this.W; W.release(this);
    W.feed(O.B, (this.value + (O.colony === W.player ? W.moteBonus || 0 : 0)) * (O.colony === W.player && W.ember ? 2 : 1), this.x, this.y, this.col);
    if (this.living) takenKind(this);
    if (this.d.pity) { if (O.colony === W.player) { W.sound && W.sound.heal(); } return; }                    // wept light feeds, but is not the room's light: it counts for nothing
    if (W.masks) { W.emit('eaten', this, O); return; }                // (Masks: whoever eats, it looks and sounds the same — the mode keeps the count)
    if (O.colony === W.player || O.colony && O.colony.ally) { if (!this.d.gift) W.stats.motes++; const chain = W.chainUp(this, O); W.sound && W.sound.mote((this.x / W.spec.W) * 1.6 - 0.8, chain); W.host.haptics && W.host.haptics.tick(); W.emit('mote', this, O, chain); }
    else W.emit('moteLost', this, O);
  }
  // a mote at rest is static light → painted once into the backdrop, lifted out again the moment a feeler takes it
  bake(ink) {
    // (a light already eaten or already in a feeler's grip must never be painted: the plate can finish developing a moment *after* the first lights are taken,
    //  and lifting a neighbour re-bakes everything around it — either way a dead light would be left on the floor as a ghost nobody can pick up)
    if (this.free || this.dead || this.held || this.spawnT < 0) return; const c = this.col, r = this.r;
    this.baked = true; this.bx = this.hx; this.by = this.hy; this.bakeR = r * 4.4;
    if (this.living) { bakeKind(this, ink); return; }
    ink.light(this.hx, this.hy, r * 4.2, PROF.halo, c[0], c[1], c[2], 0.20);
    ink.light(this.hx, this.hy, r * 1.5, PROF.glow, c[0], c[1], c[2], 1.15);
    ink.light(this.hx, this.hy, r * 0.62, PROF.core, 1, 1, 0.95, 1.0);
    ink.glint(this.hx, this.hy, r * 3.0, c[0], c[1], c[2], 0.7);
  }
  under(ink) {
    if (this.baked || this.spawnT < 0) return;
    const k = Math.min(1, this.spawnT / 0.35); let s = k * (2 - k);
    if (this.ttl) { const left = this.ttl - this.age; if (left < 1.6) s *= 0.55 + 0.45 * Math.abs(Math.sin(left * 9)) * Math.min(1, left / 0.4 + 0.3); }      // about to fade: it flickers
    if (this.living) { drawKind(this, ink, s); return; }
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
    super(W, d); this.r = d.r ?? 42; this.open = 0; this.taken = false; this.need = d.need ?? 0; this.col = d.col || COL.cyan; this.curious = true; this._pads = (W.spec.ents || []).some(e => e.type === 'pad');
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
    // the way onward calls all of you: siblings left about the room come home as you settle toward it (never off a pad they are holding)
    if (d < this.r * 3.2 && pl.orgs.length > 1 && !this._pads) this.W.callHome = 0.5;
    // (in a room with a down an open pore also lifts what settles toward it — an updraft into the light — or a door floating above a ledge could never be reached at rest)
    if (d < this.r * 2.4 && calm) { const k = (1 - d / (this.r * 2.4)) * 420, P = this.W.phys; F.cradle = { ax: (this.x - F.B.cx) / (d + 1) * k - (P.gx || 0), ay: (this.y - F.B.cy) / (d + 1) * k - (P.gy || 0), damp: 1.5 }; }
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
    const key = this.d.key, locked = p >= 1 && o < 0.5;                 // enough light, but something else still sleeps
    if (p > 0.01 && o < 0.98) ov.ring(this.x, this.y, this.r, 2.4, c, (locked ? 0.3 : 0.75) * (1 - o), -Math.PI / 2, -Math.PI / 2 + TAU * p);
    // what else it is waiting for: one pip for each lantern, pole or pad it is keyed to — lit as they wake
    if (Array.isArray(key) && o < 0.98) key.forEach((id, k) => { if (typeof id !== 'string') return; const a = -Math.PI / 2 + (k - (key.length - 1) / 2) * 0.46, on = this.W.check(id); ov.glow(this.x + Math.cos(a) * (this.r + 16), this.y + Math.sin(a) * (this.r + 16), on ? 10 : 6.5, on ? COL.gold : c, (on ? 1 : 0.5 + 0.25 * beat) * (1 - o)); });
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
  constructor(W, d) { super(W, d); this.r = d.r ?? 46; this.need = d.need ?? 24; this.fill = 0; this.active = false; this.latch = !!d.latch; this.col = d.col || COL.cyan; this.count = 0; this.curious = true; this.groups = d.groups || [0]; }      // (groups: whose weight counts — yours, or in a dive together either of you)
  get on() { return this.active; }
  post(dt) {
    const W = this.W, P = W.phys; let n = 0; const r2 = this.r * this.r;
    const G = this.groups; P.forEachNear(this.x, this.y, this.r, (i, dx, dy) => { if (dx * dx + dy * dy < r2 && G.includes(P.bodies[P.body[i]].group)) n++; });
    this.count = n; const f = Math.min(1, n / this.need);
    this.fill += (f - this.fill) * Math.min(1, dt * 8);
    const was = this.active; this.active = this.latch ? this.active || n >= this.need : n >= this.need;
    if (this.active !== was) { W.sound && W.sound.plate(this.active); W.fx.ring(this.x, this.y, this.active ? COL.green : this.col, this.r * 1.9, 0.5); W.emit('pad', this); }
    // precision cradle: any body idling near a pad is drawn onto it and settles — holding a switch is never a fight
    for (const C of W.colonies) if (this.groups.includes(C.group)) for (const O of C.orgs) {
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
    super(W, d); this.len = d.len ?? 160; this.ang = d.a ?? 0; this.speed = d.speed ?? 330; this.down = 0; this.wob = 0; this.tough = !!d.tough;      // tough: no dart is enough — only a body in flight goes through
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: this.tough ? 5 : 4, surf: SURF.BOUNCE, rest: 0.9, angle: this.ang, tough: this.tough });
    W.phys.shapes.push(this.S); this.nx = -Math.sin(this.ang); this.ny = Math.cos(this.ang); this.col = d.col || [0.6, 0.95, 1];
  }
  update(dt) {
    this.t += dt; const W = this.W; this.wob = Math.max(0, this.wob - dt * 3);
    if (this.down > 0) { this.down -= dt; if (this.down <= 0) { let clear = true; if (W.playerBodyAt(this.x, this.y, this.len * 0.5 + 10)) clear = false; if (clear) { this.S.active = true; W.fx.ring(this.x, this.y, this.col, this.len * 0.5, 0.4, { a: 0.4 }); } else this.down = 0.2; } return; }
    if (!W.player) return;
    for (const O of W.player.orgs) {
      if (!O.alive) continue; const B = O.B; const rx = B.cx - this.x, ry = B.cy - this.y;
      const along = rx * Math.cos(this.ang) + ry * Math.sin(this.ang), off = rx * this.nx + ry * this.ny;
      if (Math.abs(along) > this.len / 2 + B.r * 0.5 || Math.abs(off) > B.r + (this.tough ? 30 : 16)) continue;
      const vn = -(B.vx * this.nx + B.vy * this.ny) * Math.sign(off || 1);         // speed toward the film
      if (this.tough ? (O.flightT > 0 || O.flew > 0) && vn > 140 : vn > this.speed) { this.pop(O); if (this.tough) { O.flightT = Math.max(O.flightT, 0.3); O.flightKeep = 0; if (O.banked > 0) W.emit('bank', this, O); } break; } else if (vn > 60) this.wob = Math.max(this.wob, Math.min(1, vn / this.speed));
    }
  }
  pop(O) {
    const W = this.W; this.S.active = false; this.down = this.tough ? Infinity : 1.6;      // a soap film heals; torn lace stays torn — the way back is open
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (let k = -4; k <= 4; k++) W.fx.burst(this.x + ca * k * this.len / 9, this.y + sa * k * this.len / 9, 3, this.col, 150, { type: 1, size: 2.6, life: 0.6 });
    W.fx.ring(O.B.cx, O.B.cy, this.col, 90, 0.5); W.sound && W.sound.pop(1); W.sound && W.sound.bounce(0.8); W.shake = Math.min(1, W.shake + 0.25);
    W.hitStop = 0.06; W.emit('film', this, O);
  }
  over(ov) {
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2;
    if (!this.S.active) {
      if (!this.tough) return;
      // what is left of the lace: two frayed ends curling at the posts
      const g = [1, 0.85, 0.6]; for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) { const x0 = this.x + ca * h * sg, y0 = this.y + sa * h * sg, L = h * (0.16 + 0.07 * k), sw = Math.sin(this.t * (1.3 + 0.4 * k) + k * 2 + sg) * 7 + (k - 1) * 6; ov.line(x0, y0, x0 - ca * L * sg + this.nx * sw, y0 - sa * L * sg + this.ny * sw, 1.1, k === 1 ? this.col : g, 0.42); }
      return;
    }
    const sh = 0.55 + 0.25 * Math.sin(this.t * 3) + 0.5 * this.wob;
    ov.line(this.x - ca * h, this.y - sa * h, this.x + ca * h, this.y + sa * h, 2.2 + 2 * this.wob, this.col, sh);
    if (this.tough) {      // a doubled skin, laced: thicker than any dart
      const o = 5, g = [1, 0.85, 0.6]; for (const sg of [-1, 1]) ov.line(this.x - ca * h + this.nx * o * sg, this.y - sa * h + this.ny * o * sg, this.x + ca * h + this.nx * o * sg, this.y + sa * h + this.ny * o * sg, 1.8, g, sh * 0.9);
      const n = Math.max(3, Math.round(this.len / 13)); for (let k = 0; k <= n; k++) { const u = (k / n * 2 - 1) * h, z = (k & 1 ? 1 : -1) * o, u2 = u + h * 2 / n; if (k < n) ov.line(this.x + ca * u + this.nx * z, this.y + sa * u + this.ny * z, this.x + ca * u2 - this.nx * z, this.y + sa * u2 - this.ny * z, 1, g, sh * 0.5); }
    }
    // iridescence sliding along the film
    const u = (this.t * 0.35) % 1; ov.glow(this.x + ca * (u * 2 - 1) * h, this.y + sa * (u * 2 - 1) * h, 14, [1, 0.8, 0.95], 0.35);
    ov.glow(this.x + ca * ((u + 0.5) % 1 * 2 - 1) * h, this.y + sa * ((u + 0.5) % 1 * 2 - 1) * h, 12, [0.7, 1, 0.9], 0.3);
  }
}

// ── Bumper: a taut elastic band between two posts. It gives back far more than it gets: touch its bright face and you fly,
//    whole, along the arrows etched beside it. ──
export class Bumper extends Entity {
  constructor(W, d) {
    // to: the point its throw is focused on
    super(W, d); this.len = d.len ?? 130; this.to = d.to || null; this.ang = this.to ? Math.atan2(this.to.y - d.y, this.to.x - d.x) - Math.PI / 2 : d.a ?? 0; this.kick = d.kick ?? 580; this.fly = d.fly ?? 0.9; this.wob = 0; this.mirror = !!d.mirror; this.col = d.col || (this.mirror ? [0.78, 0.95, 1.0] : [0.74, 1.0, 0.36]); this.t = 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: 6, surf: SURF.BOUNCE, rest: 0.9, angle: this.ang, tough: true }); W.phys.shapes.push(this.S);
    this.nx = -Math.sin(this.ang); this.ny = Math.cos(this.ang); this.cd = new Map(); this.curious = true;
  }
  update(dt) {
    this.t += dt; this.wob = Math.max(0, this.wob - dt * 2.2); const W = this.W, ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (const C of W.colonies) for (const O of C.orgs) {
      if (!O.alive || O.dormant || (this.cd.get(O) || 0) > W.time) continue; const B = O.B; const rx = B.cx - this.x, ry = B.cy - this.y;
      const along = rx * ca + ry * sa, off = rx * this.nx + ry * this.ny;
      if (off < 0 || Math.abs(along) > this.len / 2 + 8 || off > B.r * 0.85 + 12) continue;            // only its bright face launches
      const vn = -(B.vx * this.nx + B.vy * this.ny); if (vn < 10 && !(B.contact > 2 && Math.hypot(O.intent.x, O.intent.y) > 0.2 && O.intent.x * this.nx + O.intent.y * this.ny < -0.1)) continue;
      // the band is a shallow dish: wherever you touch it, it throws you at its focus
      const fx = this.to ? this.to.x : this.x + this.nx * 420, fy = this.to ? this.to.y : this.y + this.ny * 420; let dx = fx - B.cx, dy = fy - B.cy; const dl = Math.hypot(dx, dy) + 1e-3; dx /= dl; dy /= dl; let kick = this.kick;
      if (this.mirror) {
        // a flat, taut band aims nothing: it answers a strike with its mirror image (angle in = angle out), and a mere lean with a plain shove
        const k = Math.min(1, Math.max(0, (vn - 70) / 170)), mx = B.vx + 2 * vn * this.nx, my = B.vy + 2 * vn * this.ny, ml = Math.hypot(mx, my) + 1e-3;
        dx = this.nx * (1 - k) + mx / ml * k; dy = this.ny * (1 - k) + my / ml * k; const l2 = Math.hypot(dx, dy) + 1e-3; dx /= l2; dy /= l2; kick *= 0.62 + 0.38 * k; this.struck = k;
      }
      O.launch(dx * kick, dy * kick, this.fly); O.flightKeep = 0; O.flightSteer = this.to ? 0.25 : this.mirror ? 0.5 : 1; O.banked = this.mirror && this.struck > 0.5 ? 1.2 : 0; this.cd.set(O, W.time + 0.5); this.wob = 1;
      W.fx.ring(B.cx, B.cy, this.col, 110, 0.45); for (let k = -3; k <= 3; k++) W.fx.sparks(this.x + ca * k * this.len / 7, this.y + sa * k * this.len / 7, 1, dx, dy, this.col, 260, { spread: 0.6, life: 0.4 });
      if (C === W.player) { W.sound && W.sound.bounce(1); W.sound && W.sound.whoosh(); W.host.haptics && W.host.haptics.thump && W.host.haptics.thump(0.8); W.hitStop = 0.035; W.emit('bumper', this, O); }
    }
  }
  bake(ink) {         // posts, and the way it throws
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2, c = this.col;
    for (const sg of [-1, 1]) { ink.ring(this.x + ca * h * sg, this.y + sa * h * sg, 5, 3.4, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.9, 2); ink.ring(this.x + ca * h * sg, this.y + sa * h * sg, 10, 0.6, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, 0.5, 0); }
    if (this.mirror) {
      // the law of this band, etched beside it: a ray comes in, the same ray leaves
      const bx = this.x + this.nx * 10, by = this.y + this.ny * 10, R = 64, n0 = Math.hypot(0.72, 0.69);
      const head = (hx, hy, ux, uy) => { ink.beam(hx, hy, hx - ux * 9 - uy * 5, hy - uy * 9 + ux * 5, 1.3, c[0], c[1], c[2], 0.36); ink.beam(hx, hy, hx - ux * 9 + uy * 5, hy - uy * 9 - ux * 5, 1.3, c[0], c[1], c[2], 0.36); };
      for (const sg of [-1, 1]) {
        const ux = (this.nx * 0.72 + ca * 0.69 * sg) / n0, uy = (this.ny * 0.72 + sa * 0.69 * sg) / n0;
        for (let q = 0; q < 5; q++) { const u0 = (q / 5 + 0.05) * R, u1 = u0 + 0.11 * R; ink.beam(bx + ux * u0, by + uy * u0, bx + ux * u1, by + uy * u1, 1.3, c[0], c[1], c[2], 0.30); }
        if (sg < 0) head(bx + ux * R * 0.42, by + uy * R * 0.42, -ux, -uy); else head(bx + ux * R, by + uy * R, ux, uy);
      }
      return;
    }
    for (let k = 1; k <= 3; k++) { const d = 30 + k * 24, w = 14 - k * 2.5, px = this.x + this.nx * d, py = this.y + this.ny * d; const a = 0.30 - k * 0.06;
      ink.beam(px - ca * w - this.nx * w * 0.7, py - sa * w - this.ny * w * 0.7, px, py, 1.4, c[0], c[1], c[2], a); ink.beam(px + ca * w - this.nx * w * 0.7, py + sa * w - this.ny * w * 0.7, px, py, 1.4, c[0], c[1], c[2], a); }
  }
  // the band is a drawn sling: it sags away from its bright face at rest, and snaps through when it throws
  _bow() { return (this.mirror ? 0 : 10) * (1 - this.wob) - (this.mirror ? 7 : 13) * Math.sin(this.t * 34) * this.wob; }
  _arc(fn, lift = 0, k = 1) {
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2 * k, bow = this._bow() * k; let px = 0, py = 0;
    for (let q = 0; q <= 8; q++) { const u = q / 4 - 1, off = lift - bow * (1 - u * u); const x = this.x + ca * h * u + this.nx * off, y = this.y + sa * h * u + this.ny * off; if (q) fn(px, py, x, y); px = x; py = y; }
  }
  under(ink) { const c = this.col, k = 0.5 + 0.5 * this.wob; this._arc((ax, ay, bx, by) => ink.beam(ax, ay, bx, by, 3, c[0], c[1], c[2], k)); }
  over(ov) {
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2, c = this.col;
    this._arc((ax, ay, bx, by) => ov.line(ax, ay, bx, by, 3.4 + 2 * this.wob, c, 0.95));
    this._arc((ax, ay, bx, by) => ov.line(ax, ay, bx, by, 1.2, c, 0.35), -5);                       // its dull back
    for (const sg of [-1, 1]) ov.glow(this.x + ca * h * sg, this.y + sa * h * sg, 12, c, 0.7);
    // ripples leaving its bright face, again and again: this way
    if (this.mirror) { const u = (this.t * 0.45) % 1 * 2 - 1; ov.glow(this.x + ca * h * u + this.nx * 3, this.y + sa * h * u + this.ny * 3, 16, [1, 1, 1], 0.5 * (1 - u * u)); return; }
    for (let r = 0; r < 2; r++) { const u = (this.t * 0.8 + r * 0.5) % 1; this._arc((ax, ay, bx, by) => ov.line(ax, ay, bx, by, 1.6, c, 0.5 * (1 - u) * (1 - u)), 12 + u * 64, 1 - 0.45 * u); }
  }
}

// ── Valve: a one-way semi-permeable skin. Whatever moves with its cilia passes as if it were not there; nothing comes back. ──
export class Valve extends Entity {
  // a: the capsule's angle (the way through is its normal) · small: semi-permeable — any piece of you below ~46 % of the whole of you (and never less than `small`
  // grains) passes either way as if nothing were there · sieve: no way through at all for anything bigger (a mesh, no cilia)
  constructor(W, d) {
    super(W, d); this.len = d.len ?? 120; this.ang = d.a ?? 0; this.sieve = !!d.sieve; this.small = d.small ?? (this.sieve ? 30 : 0); this.col = d.col || (this.sieve ? [0.72, 0.95, 1.0] : [1.0, 0.62, 0.86]); this.t = 0; this.stir = 0; this.bonk = 0; this.side = new WeakMap();
    this.nx = -Math.sin(this.ang); this.ny = Math.cos(this.ang);      // the way through
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: 5, surf: SURF.MEMBRANE, angle: this.ang, oneWay: true, passX: this.nx, passY: this.ny, small: this.small, sieve: this.sieve }); W.phys.shapes.push(this.S);
  }
  update(dt) {
    this.t += dt; this.stir = Math.max(0, this.stir - dt * 2.5); this.bonk = Math.max(0, this.bonk - dt * 2.2); const pl = this.W.player; if (!pl) return;
    if (this.small) this.S.small = Math.max(this.small, Math.floor(pl.mass * 0.46));          // "small" means: a part of you, never the whole of you
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (const O of pl.orgs) {
      if (!O.alive) continue; const B = O.B, rx = B.cx - this.x, ry = B.cy - this.y; if (Math.abs(rx * ca + ry * sa) > this.len / 2 || Math.abs(rx * this.nx + ry * this.ny) > B.r + 8) { this.side.delete(O); continue; }
      const through = this.small && B.count <= this.S.small, off = rx * this.nx + ry * this.ny, vn = B.vx * this.nx + B.vy * this.ny;
      if (through) { const sd = off > 0 ? 1 : -1, was = this.side.get(O); this.side.set(O, sd); if (was && was !== sd) this.W.emit('seeped', this, O); } else this.side.delete(O);
      if (through || !this.sieve && off < 0) { if (this.stir < 0.3) this.W.sound && this.W.sound.squish(0.3); this.stir = 1; }
      else if (Math.abs(off) < B.r + 4 && (this.sieve ? vn * off < -20 : vn < -20) && this.bonk < 0.2) { this.bonk = 1; this.W.sound && this.W.sound.bounce(0.35); if (this.small) this.W.emit('sieved', this, O); }       // too much of you: the mesh holds, and says so
    }
  }
  bake(ink) {
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2, c = this.col; for (const sg of [-1, 1]) ink.ring(this.x + ca * h * sg, this.y + sa * h * sg, 4, 3, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.9, 2);
    if (!this.small) return;
    // its law, etched on both sides: a bead goes through and back; a whole body does not
    for (const sg of [-1, 1]) {
      const ux = this.nx * sg, uy = this.ny * sg, bx = this.x + ca * h * 0.52, by = this.y + sa * h * 0.52;
      ink.ring(bx + ux * 30, by + uy * 30, 4.5, 1.3, c[0], c[1], c[2], 0.42, 0); for (let q = 0; q < 3; q++) ink.beam(bx + ux * (9 + q * 6), by + uy * (9 + q * 6), bx + ux * (12 + q * 6), by + uy * (12 + q * 6), 1.3, c[0], c[1], c[2], 0.34);
      const gx = this.x - ca * h * 0.5 + ux * 36, gy = this.y - sa * h * 0.5 + uy * 36; if (this.sieve || sg < 0) { ink.ring(gx, gy, 19, 1.2, c[0], c[1], c[2], 0.26, 3); ink.beam(gx - ux * 27 - ca * 9, gy - uy * 27 - sa * 9, gx - ux * 27 + ca * 9, gy - uy * 27 + sa * 9, 2, c[0], c[1], c[2], 0.36); }
    }
  }
  over(ov) {
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang), h = this.len / 2, c = this.col; const n = Math.max(4, Math.round(this.len / 11));
    const hot = this.bonk > 0 ? [1, 0.55 + 0.4 * (1 - this.bonk), 0.45 + 0.5 * (1 - this.bonk)] : c;
    if (this.small) {
      // a mesh: a row of open pores (they wink as something small slips through, and flush when something too big leans on them)
      const m = Math.max(5, Math.round(this.len / 15)); for (let k = 0; k < m; k++) { const u = ((k + 0.5) / m * 2 - 1) * h, w = Math.sin(this.t * 2.1 + k * 0.9); ov.ring(this.x + ca * u, this.y + sa * u, 4.2 + 0.5 * w + 2.2 * this.stir, 1.3, hot, 0.62 + 0.3 * this.bonk); }
      for (const sg of [-1, 1]) ov.line(this.x - ca * h + this.nx * 4 * sg, this.y - sa * h + this.ny * 4 * sg, this.x + ca * h + this.nx * 4 * sg, this.y + sa * h + this.ny * 4 * sg, 0.9, hot, 0.3 + 0.4 * this.bonk);
    } else ov.line(this.x - ca * h, this.y - sa * h, this.x + ca * h, this.y + sa * h, 1.6, c, 0.55);
    // cilia: a row of soft hairs all leaning the way through, with a wave running along them (a pure sieve has none: it has no way through)
    if (!this.sieve) for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) / n * 2 - 1) * h, bx = this.x + ca * u, by = this.y + sa * u; const w = Math.sin(this.t * 3.2 - k * 0.7), L = 11 + 2.5 * w + 6 * this.stir, lean = 0.28 * w;
      ov.line(bx + this.nx * 5, by + this.ny * 5, bx + this.nx * 5 + (this.nx + ca * lean) * L, by + this.ny * 5 + (this.ny + sa * lean) * L, 1.5, [1.0, 0.62, 0.86], 0.8);
    }
    for (const sg of [-1, 1]) ov.glow(this.x + ca * h * sg, this.y + sa * h * sg, 9, c, 0.5);
  }
}

// ── Echo: the path of an earlier run through this chamber, replayed as a pale bead of light to race. It touches nothing. ──
export function packEcho(pts) { let s = ''; const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; for (const [u, v] of pts) { const a = Math.max(0, Math.min(4095, Math.round(u * 4095))), b = Math.max(0, Math.min(4095, Math.round(v * 4095))); s += A[a >> 6] + A[a & 63] + A[b >> 6] + A[b & 63]; } return s; }
export function unpackEcho(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; const out = []; for (let i = 0; i + 3 < s.length; i += 4) { const a = A.indexOf(s[i]) * 64 + A.indexOf(s[i + 1]), b = A.indexOf(s[i + 2]) * 64 + A.indexOf(s[i + 3]); if (a < 0 || b < 0) return null; out.push([a / 4095, b / 4095]); } return out; }
export class Echo extends Entity {
  constructor(W, d) {
    super(W, d); const sp = W.spec, land = sp.W >= sp.H; this.pts = (d.pts || []).map(([u, v]) => (land ? [u * sp.W, v * sp.H] : [v * sp.W, u * sp.H]));       // stored along/across, so it survives a turned window
    this.step = d.step || 0.1; this.col = d.col || [0.8, 0.95, 1]; this.T = d.time || this.pts.length * this.step; this.r = d.r || 15; this.home = false; this.t = 0;
    this.x = this.pts.length ? this.pts[0][0] : 0; this.y = this.pts.length ? this.pts[0][1] : 0; this.rival = !!d.rival;
  }
  at(t) { const n = this.pts.length; if (!n) return [0, 0]; const f = Math.max(0, Math.min(n - 1, t / this.step)), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i; return [this.pts[i][0] + (this.pts[j][0] - this.pts[i][0]) * k, this.pts[i][1] + (this.pts[j][1] - this.pts[i][1]) * k]; }
  update(dt) {
    const W = this.W; this.t += dt; const rt = W.roomTime || 0; const p = this.at(rt); this.x = p[0]; this.y = p[1];
    if (!this.home && this.pts.length && rt >= this.T) { this.home = true; W.fx.ring(this.x, this.y, this.col, 70, 0.6, { a: 0.5 }); W.sound && W.sound.tick && W.sound.tick(); W.emit('echoHome', this); }
  }
  over(ov) {
    if (this.home || !this.pts.length) return; const rt = this.W.roomTime || 0, c = this.col; const b = 1 + 0.08 * Math.sin(this.t * 5);
    for (let k = 1; k <= 6; k++) { const q = this.at(rt - k * 0.09); ov.glow(q[0], q[1], this.r * (0.8 - k * 0.09), c, 0.14 * (1 - k / 7)); }          // where it has just been
    ov.glow(this.x, this.y, this.r * 1.9 * b, c, 0.22); ov.ring(this.x, this.y, this.r * b, 1.6, c, 0.55); ov.glow(this.x, this.y, this.r * 0.5, [1, 1, 1], 0.5);
    for (let k = 0; k < 5; k++) { const a = this.t * 0.7 + k * 1.2566, l = this.r * (1.5 + 0.25 * Math.sin(this.t * 3 + k)); ov.line(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, this.x + Math.cos(a) * l, this.y + Math.sin(a) * l, 1.2, c, 0.4); }
  }
}

// ── Geyser: a white hole. On a slow beat it draws breath, then throws whatever stands on it outward — and a little light with it. ──
export class Geyser extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 24; this.reach = d.reach ?? 104; this.period = d.period ?? 5.2; this.kick = d.kick ?? 500; this.gifts = d.gifts ?? 12; this.col = d.col || [0.85, 0.95, 1];
    this.t = d.phase ?? Math.random() * this.period; this.blast = 0; this.warn = false; this.curious = true;
  }
  get u() { return (this.t % this.period) / this.period; }
  get w() { const lead = 1.1 / this.period; return this.u > 1 - lead ? (this.u - (1 - lead)) / lead : 0; }      // 0…1 across the drawn breath
  update(dt) {
    const W = this.W; const u0 = this.u; this.t += dt; this.blast = Math.max(0, this.blast - dt * 2.4); this.warn = this.w > 0;
    if (this.warn && W.player) { const F = W.player.focus; if (F && Math.hypot(F.B.cx - this.x, F.B.cy - this.y) < this.reach + F.B.r) W.tug = Math.max(W.tug || 0, 0.5 * this.w); }
    if (this.u < u0) this.erupt();
  }
  erupt() {
    const W = this.W; this.blast = 1; let hit = false;
    for (const C of W.colonies) for (const O of C.orgs) {
      if (!O.alive || O.dormant) continue; const dx = O.B.cx - this.x, dy = O.B.cy - this.y, d = Math.hypot(dx, dy); if (d > this.reach + O.B.r * 0.5) continue;
      const a = d < 6 ? Math.random() * TAU : Math.atan2(dy, dx), k = this.kick * (1 - 0.35 * Math.min(1, d / this.reach)); O.launch(Math.cos(a) * k, Math.sin(a) * k, 0.55); if (C === W.player) hit = true;
    }
    W.fx.ring(this.x, this.y, this.col, this.reach * 1.5, 0.55, { w: 3 }); W.fx.burst(this.x, this.y, 22, this.col, 320, { life: 0.7, size: 2.6, type: 1 });
    // …and it gives: a few lights come up with the water (they fade if nobody comes for them)
    const n = Math.min(this.gifts, 3); this.gifts -= n;
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, sp = 150 + Math.random() * 110; W.spawn({ type: 'mote', x: this.x + Math.cos(a) * 10, y: this.y + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, free: true, value: 2, gift: true, ttl: 9, col: this.col }); }
    if (W.sound) { W.sound.whoosh(); if (hit) W.sound.bounce(1); }
    if (hit) { W.shake = Math.min(1, W.shake + 0.35); W.host.haptics && W.host.haptics.thump && W.host.haptics.thump(0.8); W.emit('geyser', this); }
  }
  bake(ink) { const c = this.col; ink.ring(this.x, this.y, this.r, 2.2, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 0.8, 3); ink.ring(this.x, this.y, this.reach, 0.7, c[0] * 0.35, c[1] * 0.35, c[2] * 0.35, 0.5, 0); ink.light(this.x, this.y, this.r * 2.4, PROF.halo, c[0], c[1], c[2], 0.16); }
  over(ov) {
    const c = this.col, w = this.w;
    // between beats a slow shimmer leaves the mouth; before a beat a ring closes in on it; then everything leaves at once
    for (let k = 0; k < 3; k++) { const q = (this.t * 0.35 + k / 3) % 1; ov.ring(this.x, this.y, this.r + q * (this.reach - this.r), 1.2, c, 0.22 * (1 - q)); }
    if (w > 0) { ov.ring(this.x, this.y, this.reach * (1 - 0.72 * w), 2.2, c, 0.25 + 0.6 * w); ov.glow(this.x, this.y, this.r * (1 + w), c, 0.35 + 0.5 * w); }
    if (this.blast > 0) ov.glow(this.x, this.y, this.reach * (1.2 - 0.4 * this.blast), [1, 1, 1], 0.5 * this.blast);
    ov.glow(this.x, this.y, this.r * 0.8, c, 0.5);
  }
}

// ── Mimic: something curled up, wearing a ring of light. Its lights all blink together, there is a knot of thorns at its heart, and no
//    feeler ever reaches for it. Wander in and it bites; strike it at speed — a dart, a flight — and it bursts into what it pretended to be. ──
export class Mimic extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 26; this.n = d.n ?? 5; this.col = d.col || [1.0, 0.86, 0.6]; this.state = 0; this.cool = 0; this.snap = 0; this.t = Math.random() * 9; this.hazard = { x: this.x, y: this.y, r: this.r + 12 }; }
  update(dt) {
    const W = this.W; this.t += dt; this.snap = Math.max(0, this.snap - dt * 3);
    if (this.state === 1) { this.cool -= dt; if (this.cool <= 0) { this.state = 0; this.hazard = { x: this.x, y: this.y, r: this.r + 12 }; } return; }
    const pl = W.player; if (!pl) return;
    for (const O of pl.orgs) {
      if (!O.alive) continue; const B = O.B, dx = B.cx - this.x, dy = B.cy - this.y, d = Math.hypot(dx, dy) + 1e-3; if (d > this.r + B.r * 0.8 + 6) continue;
      if (O.dartT > 0 || O.flightT > 0 || Math.hypot(B.vx, B.vy) > 380) this.burst(O); else this.spring(O, dx / d, dy / d);
      return;
    }
  }
  spring(O, nx, ny) {
    const W = this.W, P = W.phys, B = O.B; this.state = 1; this.cool = 7; this.snap = 1; this.hazard = null;
    const near = []; for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.body[i] === B.id) near.push([Math.hypot(P.x[i] - this.x, P.y[i] - this.y), i]); } near.sort((a, b) => a[0] - b[0]);
    if (B.count > 10 && !W.ember) { const n = Math.min(7, Math.max(2, Math.round(B.count * 0.08))); for (let k = 0; k < n && k < near.length; k++) W.shed(near[k][1], this.x, this.y, [1, 0.4, 0.5]); }
    O.launch(nx * 380, ny * 380, 0.3); O.hurtT = 0.5; O.crown.startle(1);
    W.fx.ring(this.x, this.y, [1, 0.4, 0.5], this.r * 3, 0.4); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; W.fx.sparks(this.x, this.y, 2, Math.cos(a), Math.sin(a), [1, 0.45, 0.55], 260, { spread: 0.3, life: 0.35 }); }
    W.sound && W.sound.cut && W.sound.cut(); W.shake = Math.min(1, W.shake + 0.4); W.host.haptics && W.host.haptics.snap && W.host.haptics.snap(); W.emit('mimic', this, O);
  }
  burst(O) {
    const W = this.W; this.dead = true; this.hazard = null;
    for (let k = 0; k < this.n; k++) { const a = k / this.n * TAU + this.t; W.spawn({ type: 'mote', x: this.x + Math.cos(a) * this.r * 0.6, y: this.y + Math.sin(a) * this.r * 0.6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, free: true, value: 3, gift: true, col: [1, 0.9, 0.6] }); }
    W.fx.ring(this.x, this.y, [1, 0.9, 0.6], this.r * 3.4, 0.5); W.fx.burst(this.x, this.y, 18, [1, 0.9, 0.6], 240, { life: 0.6, size: 2.6 });
    W.sound && W.sound.pop && W.sound.pop(1); W.sound && W.sound.star && W.sound.star(1); W.hitStop = 0.08; W.emit('unmask', this, O);
  }
  under(ink) {
    if (this.dead) return; const c = this.col;
    if (this.state === 1) {      // sprung: a star of thorns, slowly curling back up
      const k = Math.min(1, this.cool / 7); for (let q = 0; q < 9; q++) { const a = q / 9 * TAU + 0.3, L = this.r * (0.45 + 0.9 * k + 0.7 * this.snap); ink.beam(this.x, this.y, this.x + Math.cos(a) * L, this.y + Math.sin(a) * L, 1.6, 1, 0.3, 0.42, 0.75); }
      ink.light(this.x, this.y, this.r * 0.7, PROF.glow, 1, 0.3, 0.42, 0.8); return;
    }
    const blink = 0.66 + 0.34 * Math.pow(Math.max(0, Math.sin(this.t * 2.7)), 6), sway = Math.sin(this.t * 0.4) * 0.2;
    for (let q = 0; q < this.n; q++) { const a = q / this.n * TAU + sway, x = this.x + Math.cos(a) * this.r, y = this.y + Math.sin(a) * this.r, r = 6.8;
      ink.light(x, y, r * 3.0, PROF.halo, c[0], c[1], c[2], 0.20 * blink); ink.light(x, y, r * 1.5, PROF.glow, c[0], c[1], c[2], 1.2 * blink); ink.light(x, y, r * 0.62, PROF.core, 1, 1, 0.95, blink); ink.glint(x, y, r * 3.0, c[0], c[1], c[2], 0.7 * blink); }
    for (let q = 0; q < 5; q++) { const a = q / 5 * TAU - sway * 2, L = 7 + 1.5 * Math.sin(this.t * 1.3 + q); ink.beam(this.x, this.y, this.x + Math.cos(a) * L, this.y + Math.sin(a) * L, 1.1, 0.75, 0.22, 0.34, 0.55); }      // the knot of thorns at its heart
  }
}

// ── Sponge: a desiccant. Its pores pulse inward — thirsty: whatever leans on it is drunk a grain at a time, and it swells and takes the
//    drinker's colour. Sated, it glistens and drinks no more. Strike it (a dart, a flight) and it is wrung out: everything it holds bursts free. ──
export class Sponge extends Entity {
  constructor(W, d) {
    super(W, d); this.r0 = d.r ?? 30; this.cap = d.cap ?? 36; this.held = 0; this.hue = [0.9, 0.8, 0.6]; this.sip = 0; this.wring = 0; this.t = Math.random() * 9;
    this.S = makeShape({ type: 0, x: d.x, y: d.y, r: this.r0, surf: SURF.STONE }); W.phys.shapes.push(this.S); this.hazard = { x: this.x, y: this.y, r: this.r0 + 6 };
  }
  get r() { return this.r0 * (1 + 0.32 * this.held / this.cap); }
  update(dt) {
    const W = this.W, P = W.phys; this.t += dt; this.sip -= dt; this.wring = Math.max(0, this.wring - dt * 3);
    const r = this.r; if (Math.abs(this.S.r - r) > 0.3) { this.S.r = r; moveShape(this.S, this.x, this.y, 0, dt); }
    const full = this.held >= this.cap; this.hazard = full ? null : (this.hazard || { x: this.x, y: this.y, r: 0 }); if (this.hazard) this.hazard.r = r + 6;
    // struck hard: wrung out
    if (this.held > 0) for (const C of W.colonies) for (const O of C.orgs) { if (!O.alive) continue; const B = O.B, d = Math.hypot(B.cx - this.x, B.cy - this.y); if (d < r + B.r + 6 && (O.dartT > 0.05 || O.flightT > 0 || O.hardT > 0) && Math.hypot(B.vx, B.vy) > 200) { this.squeeze(O); return; } }
    if (full || this.sip > 0) return;
    // drink: the nearest grain of whatever touches it
    let best = -1, bd = 1e9; P.forEachNear(this.x, this.y, r + 9, (i) => { const B = P.bodies[P.body[i]]; if (!B || B.group < 0 || B.count <= 8) return; const d = Math.hypot(P.x[i] - this.x, P.y[i] - this.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    const B = P.bodies[P.body[best]], C = W.colonyOf(B); if (C === W.player && W.ember) return;
    const col = (B.tint || MATS[B.mat]).emit; for (let k = 0; k < 3; k++) this.hue[k] += (col[k] - this.hue[k]) * 0.12;
    W.fx.sparks(P.x[best], P.y[best], 2, this.x - P.x[best], this.y - P.y[best], col, 90, { spread: 0.6, life: 0.35 });
    P.kill(best); this.held++; this.sip = 0.11; if (C) { C.lost++; if (C === W.player) { W.stats.lost++; if (B.ctrl) B.ctrl.hurtT = 0.3; if (W.sound && this.held % 3 === 0) W.sound.squish(0.25); W.host.haptics && W.host.haptics.tick && W.host.haptics.tick(); } }
    if (this.held >= this.cap) { W.fx.ring(this.x, this.y, this.hue, this.r * 2.2, 0.6); W.sound && W.sound.heal && W.sound.heal(); }
  }
  squeeze(O) {
    const W = this.W, P = W.phys, n = this.held; this.held = 0; this.wring = 1; this.sip = 2.6; const a0 = Math.atan2(O.B.cy - this.y, O.B.cx - this.x);       // (wrung, it takes a few breaths before it thirsts again)
    for (let k = 0; k < n; k++) { const D = P.allocBody(-1, 'dew', MAT.DEW); if (!D) break; const a = a0 + (Math.random() - 0.5) * 2.6, rr = this.r0 + 8 + Math.random() * 10, sp = 120 + Math.random() * 150; const i = P.spawn(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, Math.cos(a) * sp, Math.sin(a) * sp, MAT.DEW, D.id); if (i >= 0) { P.life[i] = 14; P.glow[i] = 1.5; } }
    W.fx.ring(this.x, this.y, this.hue, this.r0 * 3.4, 0.5, { w: 3 }); W.fx.burst(this.x, this.y, 16, this.hue, 220, { life: 0.6, size: 2.4, type: 1 });
    W.sound && W.sound.splat && W.sound.splat(0.9); W.shake = Math.min(1, W.shake + 0.25); W.hitStop = 0.05; W.emit('wrung', this, O, n);
  }
  under(ink) {
    const c = this.hue, r = this.r, k = this.held / this.cap, wet = 0.25 + 0.75 * k;
    ink.light(this.x, this.y, r * 1.5, PROF.halo, c[0], c[1], c[2], 0.10 + 0.25 * k);
    ink.ring(this.x, this.y, r - 2, 3.2, 0.42 + c[0] * 0.4 * wet, 0.40 + c[1] * 0.4 * wet, 0.36 + c[2] * 0.4 * wet, 0.9, 2);
    // pores: thirsty ones pulse inward; a sated sponge's pores are full and still
    for (let q = 0; q < 11; q++) { const a = q * 2.399, d = r * 0.82 * Math.sqrt((q + 0.5) / 11), pulse = k >= 1 ? 1 : 0.55 + 0.45 * Math.sin(this.t * 3.4 - d * 0.22); const pr = (2.2 + 1.2 * (q % 3)) * (0.7 + 0.5 * k) * (1 + 0.4 * this.wring);
      ink.light(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, pr * 2.2, PROF.glow, c[0] * wet + 0.12, c[1] * wet + 0.12, c[2] * wet + 0.12, 0.55 * pulse); }
  }
  over(ov) { const k = this.held / this.cap; if (k >= 1) { const g = 0.35 + 0.25 * Math.sin(this.t * 2); ov.ring(this.x, this.y, this.r + 4, 1.4, this.hue, g); } else { const u = (this.t * 0.6) % 1; ov.ring(this.x, this.y, this.r + 16 * (1 - u), 1.1, [0.9, 0.85, 0.75], 0.28 * u); } }      // thirsty: a faint ring drawn inward, again and again
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
    this.hazard = { x: d.x, y: d.y, r: this.r + 12, moving: !!this.orbit };
  }
  // an orbit runs on its own clock, so gears that share a track keep their spacing
  update(dt) { this.t += dt; this.ot = (this.ot || 0) + dt; let x = this.x, y = this.y; if (this.orbit) { const o = this.orbit; const a = this.ot * (o.w ?? 0.6) + (o.p ?? 0); x = o.x + Math.cos(a) * o.r; y = o.y + Math.sin(a) * (o.ry ?? o.r); } moveShape(this.S, x, y, this.S.angle + this.spin * dt, dt); this.hazard.x = x; this.hazard.y = y; }
  post(dt) {
    const W = this.W, P = W.phys; this.acc += dt; if (this.acc < 0.07) return; this.acc = 0; let shed = 0, who = null;
    // light that drifts into the teeth is ground to sparks (and no longer asked of you)
    for (const p of W.pickups) if (p.living && !p.dead && !p.held && p.free && p.spawnT > 0 && Math.hypot(p.x - this.S.x, p.y - this.S.y) < this.r + 4) { p.dead = true; W.fx.sparks(p.x, p.y, 6, p.x - this.S.x, p.y - this.S.y, p.col, 180, { life: 0.4 }); W.sound && W.sound.grind && W.sound.grind(); W.emit('moteLost', p, null); }
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
    this.pow = Math.min(2.4, Math.hypot(this.vx, this.vy) / 220); this.str = []; const n = Math.max(6, Math.round(this.w * this.h / 5200 * Math.max(1, this.pow))); for (let k = 0; k < n; k++) this.str.push({ u: Math.random(), v: Math.random(), s: 0.6 + 0.8 * Math.random() });
  }
  bake(ink) { const c = this.col, sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp; const n = 5; for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5; const ox = -uy * t * (Math.abs(ux) > 0.5 ? this.h : this.w) * 0.8, oy = ux * t * (Math.abs(ux) > 0.5 ? this.h : this.w) * 0.8; const L = (Math.abs(ux) > 0.5 ? this.w : this.h) * 0.46; ink.beam(this.x + ox - ux * L, this.y + oy - uy * L, this.x + ox + ux * L, this.y + oy + uy * L, 7, c[0], c[1], c[2], 0.045); } }
  over(ov) {
    const sp = Math.hypot(this.vx, this.vy) || 1, ux = this.vx / sp, uy = this.vy / sp; const horiz = Math.abs(ux) > 0.5; const L = horiz ? this.w : this.h, Wd = horiz ? this.h : this.w;
    for (const s of this.str) { const u = (s.u + this.t * sp / L * 0.55 * s.s) % 1; const a = Math.sin(u * Math.PI); const px = this.x + ux * (u - 0.5) * L - uy * (s.v - 0.5) * Wd * 0.8, py = this.y + uy * (u - 0.5) * L + ux * (s.v - 0.5) * Wd * 0.8; const q = 16 * s.s * Math.max(1, this.pow * 0.8); ov.line(px - ux * q, py - uy * q, px + ux * q, py + uy * q, this.pow > 1.6 ? 1.8 : 1.3, this.col, Math.min(0.8, 0.42 * Math.max(1, this.pow * 0.7)) * a); }
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
    // light that drifts into the dark is gone (and no longer asked of you)
    for (const p of W.pickups) if (p.isMote && !p.dead && !p.held && p.free && p.spawnT > 0 && Math.hypot(p.x - this.x, p.y - this.y) < this.r + 4) { p.dead = true; W.fx.ring(this.x, this.y, p.col, this.r * 2, 0.4, { a: 0.6 }); W.emit('moteLost', p, null); }
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

// ── Core: one of two electromagnets circling a common centre. It draws iron in, flickers, and throws it —
//    whole, and where the iron was already leaning (else to its twin). Iron that coats it long enough wakes it;
//    when both are awake the pair falls together and the machine pays out. ──
export class Core extends Entity {
  constructor(W, d) {
    super(W, d); this.cx = d.cx; this.cy = d.cy; this.orb0 = this.orb = d.orb ?? 130; this.w = d.w ?? 0.4; this.a = d.a ?? 0; this.r = d.r ?? 22;
    this.reach = d.reach ?? 190; this.power = d.power ?? 620; this.period = d.period ?? 6; this.phase = d.phase ?? 0; this.throwV = d.throwV ?? 460;
    this.need = d.need ?? 5; this.charge = 0; this.lit = false; this.pol = 0; this.fuse = 0; this.paid = false; this.t = 0; this.coat = 0; this.warn = 0; this.curious = true;
    this.flare = 0; this.aim = [0, 0]; this.aimK = 0;
    this.x = this.cx + Math.cos(this.a) * this.orb; this.y = this.cy + Math.sin(this.a) * this.orb;
    this.S = makeShape({ type: 0, x: this.x, y: this.y, r: this.r, surf: SURF.METAL }); W.phys.shapes.push(this.S);
    W.phys.zones.push(this.Z = { x0: 0, y0: 0, x1: 0, y1: 0, magnet: 0, ax: this.x, ay: this.y, weight: (px, py) => { const dd = Math.hypot(px - this.x, py - this.y); return dd > this.reach ? 0 : Math.min(1, (this.reach - dd) / 50); } });
    this.light = { x: this.x, y: this.y, r: 120, col: [0.6, 0.72, 1], i: 0.3 }; this._zone();
  }
  get on() { return this.lit; }
  get twin() { return this._tw || (this._tw = this.W.ents.find(e => e !== this && e.d.type === 'core')); }
  // the field's focus leans out of the pole toward the coming throw, so the iron gathers on that side and leaves whole
  _zone() { const Z = this.Z, R = this.reach, l = this.aimK * (this.r + 30); Z.x0 = this.x - R; Z.x1 = this.x + R; Z.y0 = this.y - R; Z.y1 = this.y + R; Z.ax = this.x + this.aim[0] * l; Z.ay = this.y + this.aim[1] * l; this.light.x = this.x; this.light.y = this.y; }
  // the iron it holds, and where a throw would send it: where the body is already leaning, else to the twin
  _held(fn) { const P = this.W.phys; for (const B of P.bodies) { if (!B.alive || B.count < 3 || B.mat !== MAT.FERRO) continue; if (Math.hypot(B.cx - this.x, B.cy - this.y) < this.r + B.r * 0.9 + 14) fn(B); } }
  _dir(B, out) {
    const W = this.W, tw = this.twin; let dx = 0, dy = 0;
    const O = W.player && W.player.orgs.find(o => o.alive && o.B === B);
    if (O && Math.hypot(O.intent.x, O.intent.y) > 0.3) { dx = O.intent.x; dy = O.intent.y; }
    else if (tw) { dx = tw.x - this.x; dy = tw.y - this.y; } else { dx = this.cx - this.x; dy = this.cy - this.y; }
    const d = Math.hypot(dx, dy) + 1e-6; out[0] = dx / d; out[1] = dy / d; return out;
  }
  update(dt) {
    const W = this.W, P = W.phys; this.t += dt; const tw = this.twin; const both = this.lit && (!tw || tw.lit);
    if (both) this.fuse = Math.min(1, this.fuse + dt / 2.6);
    const f = this.fuse * this.fuse * (3 - 2 * this.fuse);
    const hurry = (this.lit ? 1 : 0) + (tw && tw.lit ? 1 : 0) === 1 ? 1.4 : 1;                 // one awake: the machine quickens
    this.haste = (this.haste || 1) + (hurry - (this.haste || 1)) * Math.min(1, dt * 1.5);
    this.orb = this.orb0 + (this.r + 5 - this.orb0) * f; this.a += this.w * this.haste * (1 + 3.2 * f) * dt;
    this.x = this.cx + Math.cos(this.a) * this.orb; this.y = this.cy + Math.sin(this.a) * this.orb; moveShape(this.S, this.x, this.y, this.a * 2, dt); this._zone();
    const u = (this.t / this.period + this.phase) % 1; const draw = !both && u < 0.56;
    this.warn = draw && u > 0.56 - 1.1 / this.period ? 1 : 0;                       // the last moments of every draw: it flickers, and shows where it will throw
    this.pol += ((draw ? 1 : 0) - this.pol) * Math.min(1, dt * (draw ? 7 : 30)); this.Z.magnet = this.power * this.pol; this.flare = Math.max(0, this.flare - dt * 2.4);
    let ak = 0; if (this.warn) this._held((B) => { if (B.group === 0 && B.count > ak) { ak = B.count; this._dir(B, this.aim); } });
    if (ak) { const left = (0.56 - u) * this.period; W.tug = Math.max(W.tug || 0, 1 - Math.max(0, left) / 1.1); if (W.host.haptics && W.host.haptics.tension) W.host.haptics.tension(1 - Math.max(0, left) / 1.1, dt); } this.aimK += ((ak ? 1 : 0) - this.aimK) * Math.min(1, dt * (ak ? 5 : 9));
    // the throw: every particle of a held body gets the same push — it leaves whole
    if (!draw && this._drew && !both) {
      let any = false; const D = [0, 0];
      this._held((B) => { this._dir(B, D); const v = this.throwV; for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.body[i] !== B.id) continue; P.vx[i] = P.vx[i] * 0.25 + D[0] * v; P.vy[i] = P.vy[i] * 0.25 + D[1] * v; } any = any || B.group === 0; });
      this.flare = 1; if (any) { W.fx.ring(this.x, this.y, COL.gold, 150, 0.4); W.sound && W.sound.bounce(1); W.sound && W.sound.whoosh(); W.host.haptics && W.host.haptics.tick(); W.emit('thrown', this); }
    }
    this._drew = draw;
    // the pair has fallen together: the machine pays out, once
    if (this.fuse >= 1 && !this.paid) {
      this.paid = true; if (tw) tw.paid = true; const n = this.d.gift ?? 16;
      for (let k = 0; k < n; k++) { const a = k / n * TAU + 0.2, v = 240 + 130 * (k % 3); W.spawn({ type: 'mote', x: this.cx + Math.cos(a) * 30, y: this.cy + Math.sin(a) * 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v, free: true, gift: true, ttl: 14, value: 2, col: k % 4 === 0 ? COL.gold : [0.75, 0.85, 1] }); }
      W.fx.ring(this.cx, this.cy, COL.gold, 330, 1.2); W.fx.ring(this.cx, this.cy, COL.white, 190, 0.7); W.fx.burst(this.cx, this.cy, 40, COL.gold, 380, { size: 3.2, life: 1.2, drag: 1.6 });
      W.flash = 0.7; W.hitStop = 0.12; W.sound && W.sound.bloom(); W.emit('cores', this);
    }
  }
  post(dt) {
    if (this.lit) return; const W = this.W, P = W.phys; let n = 0; const rr = this.r + 20, r2 = rr * rr;
    P.forEachNear(this.x, this.y, rr, (i, dx, dy) => { if (dx * dx + dy * dy < r2 && P.mat[i] === MAT.FERRO && P.bodies[P.body[i]].group === 0) n++; });
    this.coat = n; if (n >= 8) this.charge = Math.min(this.need, this.charge + dt); else this.charge = Math.max(0, this.charge - dt * 0.1);
    if (this.charge >= this.need) { this.lit = true; W.sound && W.sound.bloom(); W.fx.ring(this.x, this.y, COL.gold, 170, 1.0); W.fx.burst(this.x, this.y, 22, COL.gold, 240, { size: 3.2, life: 1.0, drag: 1.8 }); W.hitStop = 0.06; W.emit('lantern', this); }
  }
  bake(ink) {        // the track it runs on is etched in the plate
    if (this.d.track === false) return; const R = this.orb0;
    ink.ring(this.cx, this.cy, R, 0.7, 0.4, 0.5, 0.8, 0.5, 0); ink.ring(this.cx, this.cy, R + this.r + 7, 0.4, 0.3, 0.38, 0.6, 0.4, 0); ink.ring(this.cx, this.cy, R - this.r - 7, 0.4, 0.3, 0.38, 0.6, 0.4, 0);
    for (let k = 0; k < 36; k++) { const a = k / 36 * TAU, l = k % 3 ? 4 : 8; ink.beam(this.cx + Math.cos(a) * (R - l), this.cy + Math.sin(a) * (R - l), this.cx + Math.cos(a) * (R + l), this.cy + Math.sin(a) * (R + l), 1, 0.4, 0.5, 0.8, 0.10); }
  }
  under(ink, R) {
    R.solid(spriteFor(this, R, this.S, {}), this.x, this.y, this.S.angle);
    const c = this.lit ? COL.gold : [0.55, 0.72, 1]; ink.light(this.x, this.y, this.r * 0.5, PROF.glow, c[0], c[1], c[2], 0.5 + 0.5 * Math.max(this.pol, this.flare)); if (this.lit) ink.light(this.x, this.y, this.r * 0.22, PROF.core, 1, 1, 0.9, 1);
  }
  over(ov) {
    const p = this.pol, cold = [0.55, 0.72, 1], hot = [1.0, 0.62, 0.3]; const done = this.lit;
    if (p > 0.03) for (let q = 0; q < 3; q++) { const u = 1 - ((this.t * 0.75 + q / 3) % 1); ov.ring(this.x, this.y, this.r + 4 + u * (this.reach * 0.8 - this.r), 1.4, cold, 0.42 * p * u); }
    if (this.flare > 0.02) { const u = 1 - this.flare; for (let q = 0; q < 2; q++) ov.ring(this.x, this.y, this.r + 6 + (u + q * 0.18) * this.reach * 0.75, 2.4, hot, 0.8 * this.flare); }
    const fl = this.warn ? 0.5 + 0.5 * Math.sin(this.t * 34) : 0;
    ov.glow(this.x, this.y, this.r * 2.3, this.flare > 0.1 || fl > 0.5 ? hot : done ? COL.gold : cold, done ? 0.75 : 0.25 + 0.45 * p + 0.3 * fl + 0.5 * this.flare);
    // where the throw will go: a line of light leaning out of the pole
    if (this.aimK > 0.03) { const ax = this.aim[0], ay = this.aim[1]; for (let k = 1; k <= 5; k++) { const d = this.r + 26 + k * 24; ov.glow(this.x + ax * d, this.y + ay * d, 7 - k * 0.7, hot, this.aimK * (0.75 - k * 0.11) * (0.6 + 0.4 * fl)); } }
    if (done) { ov.ring(this.x, this.y, this.r + 7, 3, COL.gold, 0.9); ov.glow(this.x, this.y, this.r * 5, COL.gold, 0.14 + 0.2 * this.fuse, 1); }
    else if (this.charge > 0.02) ov.ring(this.x, this.y, this.r + 7, 3, COL.gold, 0.9, -Math.PI / 2, -Math.PI / 2 + TAU * this.charge / this.need);
    else ov.ring(this.x, this.y, this.r + 7, 1, cold, 0.25);
  }
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

// ── Louvres: a ring of glass blades, each turning on its own centre. Flat along the ring they are a wall; turned across it,
//    every gap between two of them is a doorway (narrowing inward: the gel squeezes through). They breathe on a clock — open
//    for a share of each breath, shut for the rest — and where a score is playing the clock keeps the music's pulse (found, not
//    imposed). A beat before they move, the blades flash. The Iris, warden of the Abyss, is two of these round a heart of light. ──
const smoothstep = (x) => x * x * (3 - 2 * x);
export class Louvres extends Entity {
  constructor(W, d) {
    super(W, d); this.n = d.n ?? 8; this.R = d.R ?? 110; this.w = d.w ?? 7; this.col = d.col || [1, 0.62, 0.5];
    this.period = d.period ?? 5; this.at = d.at ?? 0; this.openFor = d.openFor ?? 0.4; this.ease = d.ease ?? 0.08; this.spin = d.spin ?? 0; this.ang = d.a ?? 0;
    this.phase = d.phase0 ?? 0.6; this.open = 0; this.warn = 0;
    this.hl = this.R * Math.sin(Math.PI / this.n) + this.w * 0.6;          // flat, neighbours just overlap: a closed ring
    this.blades = [];
    for (let k = 0; k < this.n; k++) { const S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.hl, r: this.w, surf: d.surf ?? SURF.GLASS }); S._k = k; W.phys.shapes.push(S); this.blades.push(S); }
    this.open = this.openness(this.phase); this._place(1 / 60);
  }
  // 0 → shut (blades along the ring) · 1 → open (blades across it)
  openness(p) { const q = ((p - this.at) % 1 + 1) % 1, o = this.openFor, e = this.ease; return q < e ? smoothstep(q / e) : q < o ? 1 : q < o + e ? 1 - smoothstep((q - o) / e) : 0; }
  _place(dt) { const tw = this.open * Math.PI / 2; for (const S of this.blades) { const a = this.ang + S._k / this.n * TAU; moveShape(S, this.x + Math.cos(a) * this.R, this.y + Math.sin(a) * this.R, a + Math.PI / 2 + tw, dt); } }
  update(dt) {
    const W = this.W; this.t += dt;
    const pu = W.sound && W.sound.pulse ? W.sound.pulse(this.period) : null;
    this.phase += dt / (pu ? pu[1] : this.period); if (pu) { let e = pu[0] - this.phase; e -= Math.round(e); this.phase += e * Math.min(1, dt * 0.8); }
    this.phase -= Math.floor(this.phase);
    // the blades press, they do not chop: a ring closing on a body slows to a fifth and leans on it — the gel is pushed to one
    // side or the other — then catches up at its own pace (never a snap). The body sings under it like anything wound up
    const was = this.open, want = this.openness(this.phase), rate = 1 / (this.ease * this.period); let k = 1;
    if (want < was && W.player) for (const O of W.player.orgs) { if (!O.alive) continue; const B = O.B; if (Math.abs(Math.hypot(B.cx - this.x, B.cy - this.y) - this.R) < B.r * 0.9 + this.w) { k = 0.2; W.tug = Math.max(W.tug || 0, 0.55); break; } }
    this.open = was + Math.max(-rate * k * dt, Math.min(rate * dt, want - was)); this.ang += this.spin * dt;
    const q = ((this.phase - this.at) % 1 + 1) % 1, lead = 0.1;
    this.warn = q > 1 - lead || (q > this.openFor - lead && q < this.openFor) ? 1 : Math.max(0, this.warn - dt * 3);
    if ((was < 0.5) !== (this.open < 0.5)) { W.sound && W.sound.louvre && W.sound.louvre(this.open >= 0.5); W.emit('louvres', this, this.open >= 0.5); }
    this._place(dt);
  }
  get shut() { return this.open < 0.5; }
  // the time until the next opening (s) — for anyone (the bot) who wants to be at the door when it opens
  untilOpen() { const q = ((this.phase - this.at) % 1 + 1) % 1; return q < this.openFor ? 0 : (1 - q) * this.period; }
  bake(ink) { const c = this.col; ink.ring(this.x, this.y, this.R, 0.5, c[0] * 0.45, c[1] * 0.45, c[2] * 0.45, 0.3, 0); }
  under(ink, R) { for (const S of this.blades) { if (!S._sp || S._sp.z !== R.view.z) S._sp = solidSprite(S, R.view.z, {}); R.solid(S._sp, S.x, S.y, S.angle); } }
  over(ov) {
    const c = this.col, w = this.warn;
    for (const S of this.blades) { ov.glow(S.x, S.y, 10 + 8 * w, c, 0.22 + 0.5 * w); if (this.open > 0.6) ov.glow(S.x, S.y, this.hl * 0.9, c, 0.06 * this.open, 1); }
  }
}

// ── Residue: the stain a dive left where it ended. It is tacky (whatever is in it is held back), and the moment a living body
//    steps in it, what the stain remembers gets up: a pale revenant of the body that fell here (core/haunt.js). ──
export class Residue extends Entity {
  constructor(W, d) {
    super(W, d); this.r = d.r ?? 62; this.n = d.n ?? 60; this.tint = d.tint || null; this.col = d.col || [0.9, 0.8, 0.85]; this.woke = false; this.fade = 1; this.t = Math.random() * 9; this.curious = true;
    W.phys.zones.push(this.Z = { x0: this.x - this.r, y0: this.y - this.r, x1: this.x + this.r, y1: this.y + this.r, flow: true, flowK: 5, fvx: 0, fvy: 0, weight: (px, py) => { const q = Math.hypot(px - this.x, py - this.y); return q < this.r ? Math.min(1, (this.r - q) / 22) : 0; } });
  }
  update(dt) {
    this.t += dt; const W = this.W; if (this.woke) { this.fade = Math.max(0, this.fade - dt * 0.5); this.Z.flowK = 5 * this.fade; return; }
    const pl = W.player; if (!pl) return;
    for (const O of pl.orgs) if (O.alive && Math.hypot(O.B.cx - this.x, O.B.cy - this.y) < this.r * 0.8 + O.B.r) { this.wake(); break; }
  }
  wake() {
    if (this.woke) return; this.woke = true; const W = this.W, c = this.col;
    // it is the body it was — but it rises as your equal, never as your doom: an ambush you can answer (outgrow it and swallow it, or cleave it)
    const n = Math.round(Math.max(30, Math.min(this.n, (W.player ? W.player.mass : 60) * 1.05)));
    const C = W.addRival('revenant', this.x, this.y, n, { tint: this.tint }); C.haunt = this.d.haunt || null; this.revenant = C; for (const O of C.orgs) { O.hurtT = 0.9; O.crown.startle(1); if (O.brain) O.brain.dartT = 1.6; }
    W.fx.ring(this.x, this.y, c, this.r * 3.2, 0.9, { w: 3 }); W.fx.ring(this.x, this.y, [1, 1, 1], this.r * 1.8, 0.5); W.fx.burst(this.x, this.y, 26, c, 240, { life: 0.9, size: 2.6 });
    W.shake = Math.min(1, W.shake + 0.4); W.sound && W.sound.haunt && W.sound.haunt(); W.host.haptics && W.host.haptics.thump && W.host.haptics.thump(0.6); W.emit('haunt', this, C);
  }
  bake(ink) { const c = this.col; ink.disc(this.x, this.y, this.r * 0.92, 0.02, 0.015, 0.03, 0.34); ink.ring(this.x, this.y, this.r, 1.4, c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, 0.5, 5); ink.ring(this.x, this.y, this.r * 0.6, 0.8, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 0.4, 4); }
  over(ov) {
    const c = this.col, f = this.fade; if (f <= 0) return;
    // threads of the old body still turning slowly in the stain, and a pulse like a breath being held
    for (let k = 0; k < 5; k++) { const a = this.t * (0.16 + 0.03 * k) * (k & 1 ? -1 : 1) + k * 1.3, r = this.r * (0.34 + 0.12 * k); ov.ring(this.x, this.y, r, 1.2, c, 0.34 * f, a, a + 1.1 + 0.2 * k); }
    ov.glow(this.x, this.y, this.r * (0.5 + 0.08 * Math.sin(this.t * 1.1)), c, 0.16 * f);
  }
}

// ── Bubble: a soap bubble of air. It drifts, wobbles, joins its neighbours, bursts on anything sharp — and whatever gel touches it swallows it
//    and swells with the air (Organism.air), until it lets the breath go again. ──
const BN = [0, 0];
export class Bubble extends Entity {
  constructor(W, d) { super(W, d); this.r = d.r ?? 20; this.vx = d.vx || 0; this.vy = d.vy || 0; this.t = Math.random() * 9; this.life = d.life ?? 46; this.seed = Math.random(); this.born = 0; this.safe = d.safe ?? 0; }
  update(dt) {
    this.t += dt; this.life -= dt; this.born = Math.min(1, this.born + dt * 4); this.safe -= dt; const W = this.W, P = W.phys;
    // buoyant against whatever "down" the pool has, a little restless, and slowed by the water
    const g = Math.hypot(P.gx, P.gy); this.vx += (-P.gx * 0.12 + Math.sin(this.t * 1.3 + this.seed * 40) * 9) * dt; this.vy += (-P.gy * 0.12 - (g > 20 ? 0 : 7) + Math.cos(this.t * 1.1 + this.seed * 17) * 6) * dt;
    const dr = Math.exp(-dt * 0.9); this.vx *= dr; this.vy *= dr; this.x += this.vx * dt; this.y += this.vy * dt;
    const d = P.sampleSDF(this.x, this.y); if (d < this.r) { const n = P.sdfNormal(this.x, this.y, BN); this.x += n[0] * (this.r - d); this.y += n[1] * (this.r - d); const vn = this.vx * n[0] + this.vy * n[1]; if (vn < 0) { this.vx -= 1.6 * vn * n[0]; this.vy -= 1.6 * vn * n[1]; } }
    // anything hard or sharp that moves through it ends it
    for (const S of P.shapes) { if (!S.active || S.oneWay) continue; if (this.x < S.bx0 - this.r || this.x > S.bx1 + this.r || this.y < S.by0 - this.r || this.y > S.by1 + this.r) continue; if (P.solidAt(this.x, this.y) < this.r * 0.55) { this.burst(); return; } break; }
    // two bubbles that touch become one (areas add)
    for (const e of W.ents) { if (e === this || e.dead || !(e instanceof Bubble)) continue; const dd = Math.hypot(e.x - this.x, e.y - this.y); if (dd < (this.r + e.r) * 0.8 && this.r >= e.r && this.r < 64) { const a = this.r * this.r, b = e.r * e.r; this.x = (this.x * a + e.x * b) / (a + b); this.y = (this.y * a + e.y * b) / (a + b); this.vx = (this.vx * a + e.vx * b) / (a + b); this.vy = (this.vy * a + e.vy * b) / (a + b); this.r = Math.min(64, Math.sqrt(a + b)); this.life = Math.max(this.life, e.life); e.dead = true; W.sound && W.sound.pop(0.3); this.born = 0.6; } }
    // gel swallows air: the body that touches it swells
    if (this.safe <= 0) for (const C of W.colonies) for (const O of C.orgs) { if (!O.alive) continue; const B = O.B; if (Math.hypot(B.cx - this.x, B.cy - this.y) < B.r * 0.85 + this.r * 0.35) { O.air = Math.min(1.5, (O.air || 0) + 0.25 + this.r / 44); O.gulp = 1; this.dead = true; W.fx.ring(this.x, this.y, [0.85, 0.95, 1], this.r * 1.6, 0.35, { a: 0.5 }); W.sound && W.sound.gulp && W.sound.gulp(); W.emit('air', this, O); return; } }
    if (this.life <= 0) this.burst();
  }
  burst() { if (this.dead) return; this.dead = true; const W = this.W; W.fx.ring(this.x, this.y, [0.9, 0.97, 1], this.r * 1.5, 0.3, { a: 0.6 }); W.fx.burst(this.x, this.y, 7, [0.85, 0.95, 1], 120, { type: 1, size: 1.8, life: 0.4 }); W.sound && W.sound.pop(0.5 + this.r / 60); }
  over(ov) {
    const r = this.r * (0.5 + 0.5 * this.born) * (1 + 0.035 * Math.sin(this.t * 5 + this.seed * 9)), x = this.x, y = this.y, sp = this.t * 0.5 + this.seed * 6;
    ov.ring(x, y, r, 1.3, [0.86, 0.95, 1], 0.55);
    // iridescence: three thin arcs of colour sliding round the skin
    ov.ring(x, y, r - 1.6, 1.6, [1, 0.62, 0.86], 0.5, sp, sp + 1.5); ov.ring(x, y, r - 1.6, 1.6, [0.5, 1, 0.9], 0.45, sp + 2.1, sp + 3.4); ov.ring(x, y, r - 1.6, 1.6, [1, 0.9, 0.5], 0.4, sp + 4.2, sp + 5.3);
    ov.glow(x - r * 0.38, y - r * 0.42, r * 0.34, [1, 1, 1], 0.5); ov.glow(x + r * 0.3, y + r * 0.36, r * 0.2, [0.8, 0.9, 1], 0.25);
  }
}

// ── Rod: a wall drawn by hand on the Workshop's bench — wet glass, not yet set into the plate (that happens when the chamber is played).
//    Capsules end to end along the stroke (a single point is a round stone), drawn by the browser's own rasteriser: drawing one costs no re-developing. ──
export class Rod extends Entity {
  constructor(W, d) {
    super(W, d); this.surf = d.surf ?? SURF.STONE; this.r = d.r ?? 13; this.S = []; const pts = d.pts && d.pts.length ? d.pts : [[d.x, d.y]];
    if (pts.length === 1) this.S.push(makeShape({ type: 0, x: pts[0][0], y: pts[0][1], r: this.r, surf: this.surf }));
    else for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; this.S.push(makeShape({ type: 1, x: (ax + bx) / 2, y: (ay + by) / 2, hl: Math.max(0.5, Math.hypot(bx - ax, by - ay) / 2), r: this.r, angle: Math.atan2(by - ay, bx - ax), surf: this.surf })); }
    for (const S of this.S) W.phys.shapes.push(S); this.x = pts[0][0]; this.y = pts[0][1];
  }
  under(ink, R) { for (const S of this.S) { if (!S._sp || S._sp.z !== R.view.z) S._sp = solidSprite(S, R.view.z, {}); R.solid(S._sp, S.x, S.y, S.angle); } }
}

export const ENT = { rod: Rod, louvres: Louvres, pod: Pod, residue: Residue, bubble: Bubble, bumper: Bumper, valve: Valve, echo: Echo, geyser: Geyser, mimic: Mimic, sponge: Sponge, core: Core, rotor: Rotor, spinner: Spinner, mote: Mote, pore: Pore, pad: Pad, gate: Gate, film: Film, blade: Blade, grinder: Grinder, pool: Pool, current: Current, well: Well, crusher: Crusher, lantern: Lantern, watcher: Watcher, frost: Frost, vent: Vent, iceplug: IcePlug, magnet: Magnet };

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
export function moteRing(cx, cy, r, n, value = 2, extra = {}) { const out = []; for (let k = 0; k < n; k++) { const a = (extra.arc ? k / Math.max(1, n - 1) * extra.arc : k / n * TAU) + (extra.a0 || 0); out.push({ type: 'mote', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, value, ...extra }); } return out; }
