// ─────────────────────────────────────────────────────────────────────────────
//  The living world. Every object announces its physical personality before
//  contact, and answers touch with crisp, legible feedback.
// ─────────────────────────────────────────────────────────────────────────────
import { makeShape, moveShape, updateShapeBounds, H, PR, SPACING } from '../engine/physics.js';
import { SURF, MAT, MATS } from '../engine/materials.js';
import { sound } from '../audio/audio.js';
import { haptics } from '../engine/haptics.js';

const TAU = Math.PI * 2;
const C = {
  mote: [1.0, 0.86, 0.55], cyan: [0.45, 0.95, 1.0], heal: [1.0, 0.55, 0.35], gold: [1.0, 0.8, 0.4],
  danger: [1.0, 0.3, 0.2], violet: [0.7, 0.5, 1.0], green: [0.5, 1.0, 0.65], white: [1, 1, 1],
};
export { C as COLORS };

export class Entity {
  constructor(G, d) { this.G = G; this.d = d; this.x = d.x || 0; this.y = d.y || 0; this.dead = false; this.t = Math.random() * 10; this.id = d.id; }
  update(dt) { this.t += dt; }
  post(dt) {}
  draw(R) {}
  get on() { return true; }
}

// ── Mote: a dew of light. Drifts toward nearby bodies; becomes mass. ───────
export class Mote extends Entity {
  constructor(G, d) {
    super(G, d); this.value = d.value ?? 3; this.r = 9 + this.value * 0.8; this.hx = this.x; this.hy = this.y;
    this.vx = 0; this.vy = 0; this.seed = Math.random(); this.free = d.free || false; this.pull = 0.6;
    this.col = d.col || C.mote;
  }
  update(dt) {
    this.t += dt;
    // gentle magnetism toward the nearest friendly body (lush, never fiddly)
    const T = this.G.nearestPlayerBody(this.x, this.y, 110);
    if (T) {
      const dx = T.cx - this.x, dy = T.cy - this.y, d = Math.hypot(dx, dy) + 1;
      const s = Math.max(0, 1 - (d - T.r) / 110) * 520;
      this.vx += dx / d * s * dt; this.vy += dy / d * s * dt;
    } else if (!this.free) {
      this.vx += (this.hx - this.x) * 4 * dt; this.vy += (this.hy - this.y) * 4 * dt;
    }
    const dr = Math.max(0, 1 - 3.5 * dt); this.vx *= dr; this.vy *= dr;
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
  post() {
    const G = this.G; let hit = null;
    G.phys.forEachNear(this.x, this.y, this.r + 4, (i) => { if (!hit) { const B = G.phys.bodies[G.phys.body[i]]; if (G.isPlayerBody(B)) hit = B; } });
    if (hit) this.eat(hit);
  }
  eat(B) {
    const G = this.G; this.dead = true;
    G.feed(B, this.value, this.x, this.y, this.col);
    const n = sound.mote((this.x - G.cam.x) / 600); haptics.tick();
    G.onMote && G.onMote(this, B, n);
  }
  draw(R) {
    const bob = Math.sin(this.t * 2.3 + this.seed * 6) * 2.2;
    R.ents.push(this.x, this.y + bob, this.r * 1.9, 0, this.col[0], this.col[1], this.col[2], 1, this.seed, 0, 0, 0);
  }
}

// ── Prism: rare faceted crystal hidden in risky corners ────────────────────
export class Prism extends Entity {
  constructor(G, d) { super(G, d); this.r = 16; this.got = false; this.idx = d.idx ?? 0; }
  post() {
    if (this.got) return;
    const G = this.G; let hit = null;
    G.phys.forEachNear(this.x, this.y, this.r + 6, (i) => { if (!hit) { const B = G.phys.bodies[G.phys.body[i]]; if (G.isPlayerBody(B)) hit = B; } });
    if (hit) {
      this.got = true; this.dead = true;
      sound.prism();
      G.fx.ring(this.x, this.y, [0.8, 0.9, 1.0], 90, 0.9);
      for (let k = 0; k < 14; k++) G.fx.glint(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, [0.6 + Math.random() * 0.4, 0.8, 1.0], 14 + Math.random() * 10, 0.4 + Math.random() * 0.6);
      G.feed(hit, 6, this.x, this.y, [0.8, 0.95, 1.0]);
      G.onPrism && G.onPrism(this);
    }
  }
  draw(R) {
    const bob = Math.sin(this.t * 1.7) * 3;
    R.ents.push(this.x, this.y + bob, this.r * 2.2, 1, 0.8, 0.9, 1.0, 1, this.idx, 0, 0, 0);
    R.light(this.x, this.y, 60, 120, 0.7, 0.85, 1.0, -0.6);
  }
}

// ── Lantern: dormant glass anemone; your touch blooms it (checkpoint) ─────
export class Lantern extends Entity {
  constructor(G, d) { super(G, d); this.r = d.r ?? 26; this.bloom = d.lit ? 1 : 0; this.lit = !!d.lit; this.col = d.col || [1.0, 0.75, 0.45]; }
  update(dt) { this.t += dt; const tgt = this.lit ? 1 : 0; this.bloom += (tgt - this.bloom) * Math.min(1, dt * 1.6); }
  post() {
    if (this.lit) return;
    const B = this.G.playerBodyNear(this.x, this.y, this.r + 10);
    if (B) {
      this.lit = true;
      sound.bloom();
      this.G.fx.ring(this.x, this.y, this.col, 160, 1.2);
      this.G.fx.burst(this.x, this.y, 26, this.col, 260, { size: 5, life: 1.1, drag: 1.8 });
      this.G.setCheckpoint(this.x, this.y - 10, this);
      this.G.onLantern && this.G.onLantern(this);
    }
  }
  draw(R) {
    R.ents.push(this.x, this.y, this.r * 1.8, 5, this.col[0], this.col[1], this.col[2], 1, this.bloom, 0, 0, 0);
    if (this.bloom > 0.02) R.light(this.x, this.y - 10, 70, 300 + 200 * this.bloom, this.col[0], this.col[1], this.col[2], -(0.35 + 1.1 * this.bloom));
  }
}

// ── Exit iris ──────────────────────────────────────────────────────────────
export class Exit extends Entity {
  constructor(G, d) { super(G, d); this.r = d.r ?? 46; this.open = 0; this.need = d.need || null; this.taken = false; this.pulse = 0; }
  get ready() { return !this.need || this.G.check(this.need); }
  update(dt) {
    this.t += dt;
    const was = this.open > 0.5;
    // multi-key irises show partial awakening (each lantern lit brightens them)
    let target = this.ready ? 1 : 0;
    if (!this.ready && Array.isArray(this.need)) target = 0.14 * this.need.filter(k => this.G.check(k)).length;
    this.open += (target - this.open) * Math.min(1, dt * 2);
    if (!was && this.open > 0.5) { sound.open(); this.G.fx.ring(this.x, this.y, C.cyan, 120, 1.0); }
  }
  post() {
    if (this.taken || this.open < 0.8) return;
    const F = this.G.colony && this.G.colony.focus;
    if (F && F.alive && Math.hypot(F.B.cx - this.x, F.B.cy - this.y) < this.r + F.B.r * 0.4) { this.taken = true; this.G.complete(this); }
  }
  draw(R) {
    const o = this.open;
    if (this.d.heart) {
      // the Heart: a vast slow iris around the stone shell; dormant until three lanterns sing
      const beat = 0.5 + 0.5 * Math.sin(this.t * (1.2 + o * 1.6));
      const c = [1.0, 0.55 + 0.25 * o, 0.6 + 0.2 * o];
      R.ents.push(this.x, this.y, this.r * 1.45, 2, c[0], c[1], c[2], 0.25 + 0.6 * o, 0.7, 0.012 + 0.02 * beat * o, 24, 3);
      R.ents.push(this.x, this.y, this.r * 1.12, 2, c[0], c[1], c[2], 0.15 + 0.5 * o, 0.62, 0.01, 40, -4);
      R.light(this.x, this.y, 120, 520, c[0], c[1], c[2], -(0.3 + 1.6 * o * (0.6 + 0.4 * beat)));
      return;
    }
    const col = [0.45 + 0.4 * o, 0.8 + 0.15 * o, 1.0];
    R.ents.push(this.x, this.y, this.r * 1.6, 2, col[0], col[1], col[2], 0.35 + 0.65 * o, 0.6, 0.035 + 0.02 * o, 18, 6);
    if (o > 0.05) R.ents.push(this.x, this.y, this.r * 1.1, 2, col[0], col[1], col[2], o * 0.8, 0.45, 0.02, 30, -9);
    R.light(this.x, this.y, 80, 260, col[0], col[1], col[2], -(0.3 + 0.9 * o));
    if (o > 0.6 && Math.random() < 0.3) this.G.fx.add({ x: this.x + (Math.random() - 0.5) * this.r * 2, y: this.y + (Math.random() - 0.5) * this.r * 2, vx: 0, vy: 0, life: 0.8, size: 3, type: 0, r: col[0], g: col[1], b: col[2], a: 0.8, grow: -2 });
  }
}

// ── Pressure plate: shows how much of the needed mass rests on it ─────────
export class Plate extends Entity {
  constructor(G, d) {
    super(G, d); this.w = d.w ?? 90; this.need = d.need ?? 40; this.count = 0; this.fill = 0; this.active = false; this.latch = !!d.latch; this.any = !!d.any;
    this.col = d.col || C.cyan;
  }
  get on() { return this.active; }
  post(dt) {
    const G = this.G, P = G.phys;
    let n = 0;
    const x0 = this.x - this.w / 2, x1 = this.x + this.w / 2, y0 = this.y - 26, y1 = this.y + 8;
    P.forEachNear(this.x, this.y - 8, this.w / 2 + 20, (i) => {
      const px = P.x[i], py = P.y[i];
      if (px < x0 || px > x1 || py < y0 || py > y1) return;
      const B = P.bodies[P.body[i]];
      if (this.any || G.isPlayerBody(B)) n++;
    });
    this.count = n;
    const f = Math.min(1, n / this.need);
    this.fill += (f - this.fill) * Math.min(1, dt * 8);
    const was = this.active;
    if (this.latch) this.active = this.active || n >= this.need; else this.active = n >= this.need;
    if (this.active !== was) { sound.plate(this.active); G.fx.ring(this.x, this.y - 6, this.col, 70, 0.5); G.onPlate && G.onPlate(this); }
    // precision cradle: a gentle well that makes settling effortless
    const F = G.colony && G.colony.focus;
    if (F && F.alive && !this.active) {
      const dx = this.x - F.B.cx, dy = (this.y - 20) - F.B.cy; const d = Math.hypot(dx, dy);
      if (d < 120 && Math.abs(F.intent.x) + Math.abs(F.intent.y) < 0.25) F.cradle = { ax: dx * 6, ay: 0, damp: 3 };
    }
  }
  draw(R) {
    const c = this.active ? [0.6, 1.0, 0.85] : this.col;
    R.ents.push(this.x, this.y - 4, this.w / 2 + 4, 4, c[0], c[1], c[2], 1, this.fill, 0, 0, 0);
    R.light(this.x, this.y - 10, 30, 90, c[0], c[1], c[2], -(0.15 + 0.6 * this.fill));
  }
}

// ── Gate: a sliding glass/metal door bound to a condition ─────────────────
export class Gate extends Entity {
  constructor(G, d) {
    super(G, d);
    this.need = d.need; this.ox = d.x; this.oy = d.y; this.dx = d.dx ?? 0; this.dy = d.dy ?? -(d.h ?? 120);
    this.S = makeShape({ type: 2, x: d.x, y: d.y, hw: (d.w ?? 30) / 2, hh: (d.h ?? 120) / 2, r: 8, surf: d.surf ?? SURF.METAL });
    G.phys.shapes.push(this.S);
    this.k = 0; this.inv = !!d.invert; this.latch = !!d.latch; this.latched = false;
  }
  get on() { return this.k > 0.5; }
  update(dt) {
    this.t += dt;
    let open = this.latched || this.G.check(this.need);
    if (this.latch && open && !this.latched) { this.latched = true; this.G.fx.ring(this.x, this.y, [0.6, 1, 0.85], 120, 0.8); this.G.onGate && this.G.onGate(this); }
    if (this.inv) open = !open;
    const prev = this.k;
    this.k += ((open ? 1 : 0) - this.k) * Math.min(1, dt * 3.2);
    if ((prev < 0.5) !== (this.k < 0.5)) sound.open();
    const e = this.k * this.k * (3 - 2 * this.k);
    moveShape(this.S, this.ox + this.dx * e, this.oy + this.dy * e, 0, dt);
  }
}

// ── Blade: a severing edge (spinning or sweeping) ─────────────────────────
export class Blade extends Entity {
  constructor(G, d) {
    super(G, d);
    this.len = d.len ?? 120; this.spin = d.spin ?? 0; this.sweep = d.sweep || null; this.period = d.period ?? 3; this.phase = d.phase ?? 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: this.len / 2, r: 2.5, surf: SURF.BLADE, cut: true, angle: d.angle ?? 0 });
    this.S.vis = 1;
    G.phys.shapes.push(this.S);
    this.a = d.angle ?? 0;
  }
  update(dt) {
    this.t += dt;
    let x = this.x, y = this.y;
    if (this.sweep) { const s = Math.sin((this.t + this.phase) * TAU / this.period); x += this.sweep[0] * s; y += this.sweep[1] * s; }
    this.a += this.spin * dt;
    moveShape(this.S, x, y, this.a, dt);
  }
  post() { if (this.G.phys.events.cuts > 0) sound.cut(); }
  draw(R) {
    const S = this.S, ca = Math.cos(S.angle), sa = Math.sin(S.angle);
    const n = Math.ceil(this.len / 10);
    for (let k = 0; k <= n; k++) {
      const u = (k / n - 0.5) * this.len;
      R.fx.push(S.x + ca * u, S.y + sa * u, 7, 0, 1.0, 0.45, 0.4, 0.55, 0, 0, 0, 0);
    }
    R.light(S.x, S.y, 30, 140, 1.0, 0.35, 0.3, -0.5);
  }
}

// ── Grinder: abrasive gear — shaves mass into sparks you can chase back ───
export class Grinder extends Entity {
  constructor(G, d) {
    super(G, d);
    this.r = d.r ?? 50; this.spin = d.spin ?? 2.5;
    this.S = makeShape({ type: 0, x: d.x, y: d.y, r: this.r + 4, surf: SURF.GRIT, grip: 0.5 });
    this.S.vis = 4; this.S.teeth = d.teeth ?? 12; this.S.toothH = 8;
    G.phys.shapes.push(this.S);
    this.acc = 0;
  }
  update(dt) { this.t += dt; moveShape(this.S, this.x, this.y, this.S.angle + this.spin * dt, dt); }
  post(dt) {
    const G = this.G, P = G.phys;
    this.acc += dt;
    if (this.acc < 0.07) return; this.acc = 0;
    let shed = 0;
    P.forEachNear(this.x, this.y, this.r + 14, (i) => {
      if (shed >= 2) return;
      const B = P.bodies[P.body[i]];
      if (!G.isPlayerBody(B) || B.count < 8) return;
      if (P.mat[i] === MAT.BASTION && Math.random() < 0.8) return;
      if (Math.random() < 0.5) return;
      G.shed(i, this.x, this.y, [1.0, 0.6, 0.3]);
      shed++;
    });
    if (shed) { sound.grind(); G.onHurt && G.onHurt(shed); }
  }
  draw(R) { R.light(this.x, this.y, 40, 160, 1.0, 0.5, 0.2, -0.25); }
}

// ── Crusher: rhythmic piston — survive by flowing into the gaps ──────────
export class Crusher extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w ?? 120; this.h = d.h ?? 160; this.travel = d.travel ?? 140; this.period = d.period ?? 2.4; this.phase = d.phase ?? 0;
    this.S = makeShape({ type: 2, x: d.x, y: d.y, hw: this.w / 2, hh: this.h / 2, r: 10, surf: SURF.METAL });
    G.phys.shapes.push(this.S); this.dir = d.dir ?? [0, 1];
  }
  update(dt) {
    this.t += dt;
    const p = ((this.t / this.period + this.phase) % 1);
    // rest retracted → slam → hold → slow lift
    let k;
    if (p < 0.45) k = 0;
    else if (p < 0.55) { const u = (p - 0.45) / 0.1; k = u * u; }
    else if (p < 0.7) k = 1;
    else { const u = (p - 0.7) / 0.3; k = 1 - u * u * (3 - 2 * u); }
    moveShape(this.S, this.x + this.dir[0] * this.travel * k, this.y + this.dir[1] * this.travel * k, 0, dt);
    if (this._last !== undefined && this._last < 0.95 && k >= 0.999) { sound.boom(); this.G.shakeAt(this.S.x, this.S.y, 0.45); this.G.fx.burst(this.S.x + this.dir[0] * this.h / 2, this.S.y + this.dir[1] * this.h / 2, 8, [0.8, 0.9, 1], 160, { size: 2.5, life: 0.5, type: 1 }); }
    this._last = k;
  }
  draw(R) {
    const p = ((this.t / this.period + this.phase) % 1);
    // warning glow before the slam (diegetic timing)
    const warn = p > 0.3 && p < 0.45 ? (p - 0.3) / 0.15 : 0;
    if (warn > 0) R.light(this.S.x, this.S.y + this.dir[1] * this.h * 0.5, 30, 160, 1.0, 0.5, 0.3, -warn * 0.8);
  }
}

// ── Pools: healing warmth, catalysts (morph), rinse ─────────────────────────
export class Pool extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w ?? 160; this.h = d.h ?? 60; this.kind = d.kind ?? 'heal'; this.mat = d.mat ?? MAT.LUMEN; this.cap = d.cap ?? 0; this.rate = d.rate ?? 22;
    this.acc = 0;
    const m = MATS[this.mat];
    this.col = d.col || (this.kind === 'heal' ? [1.0, 0.6, 0.38] : this.kind === 'rinse' ? [0.6, 0.85, 1.0] : m.emit.map(v => Math.min(1, v * 1.1)));
  }
  post(dt) {
    const G = this.G;
    const x0 = this.x - this.w / 2, x1 = this.x + this.w / 2, y0 = this.y - this.h / 2, y1 = this.y + this.h / 2;
    for (const B of G.playerBodies()) {
      if (B.cx < x0 - B.r * 0.3 || B.cx > x1 + B.r * 0.3 || B.cy < y0 - B.r * 0.5 || B.cy > y1 + B.r * 0.2) continue;
      if (this.kind === 'heal') {
        const cap = this.cap || G.massCap;
        const total = G.colony ? G.colony.mass : B.count;
        if (total < cap) {
          this.acc += dt * this.rate;
          while (this.acc >= 1 && total < cap) {
            this.acc -= 1;
            const a = Math.random() * TAU, rr = 40 + Math.random() * 50;
            G.feed(B, 1, B.cx + Math.cos(a) * (B.r + rr), B.cy + Math.sin(a) * (B.r + rr), this.col, true);
          }
          if (Math.random() < dt * 8) sound.heal();
        }
      } else {
        const target = this.kind === 'rinse' ? MAT.LUMEN : this.mat;
        if (B.mat !== target) G.morph(B, target, this.col);
      }
    }
  }
  draw(R) {
    R.ents.push(this.x, this.y, Math.max(this.w, this.h) / 2, 11, this.col[0], this.col[1], this.col[2], 0.9, 0, 0, this.w / 2, this.h / 2);
    R.light(this.x, this.y - this.h * 0.3, 50, this.w * 1.2, this.col[0], this.col[1], this.col[2], -0.7);
    if (Math.random() < 0.25) this.G.fx.add({ x: this.x + (Math.random() - 0.5) * this.w, y: this.y + this.h * 0.3, vx: 0, vy: -30 - Math.random() * 30, life: 1.4, size: 2 + Math.random() * 3, type: 1, r: this.col[0], g: this.col[1], b: this.col[2], a: 0.6, drag: 0.5 });
  }
}

// ── Singularity: a black hole that stretches and tests ─────────────────────
export class Singularity extends Entity {
  constructor(G, d) {
    super(G, d);
    this.r = d.r ?? 22; this.strength = d.strength ?? 60000; this.reach = d.reach ?? 520;
    this.Z = { x0: this.x - this.reach, x1: this.x + this.reach, y0: this.y - this.reach, y1: this.y + this.reach, attract: true, ax: this.x, ay: this.y, strength: this.strength, soft: 50, swirl: d.swirl ?? 0,
      weight: (px, py) => { const dd = Math.hypot(px - this.x, py - this.y); return dd > this.reach ? 0 : 1 - dd / this.reach; } };
    G.phys.zones.push(this.Z);
    this.eaten = 0;
  }
  post(dt) {
    const G = this.G, P = G.phys;
    P.forEachNear(this.x, this.y, this.r, (i) => {
      const B = P.bodies[P.body[i]];
      if (G.isPlayerBody(B)) { G.onHurt && G.onHurt(1); }
      G.fx.add({ x: P.x[i], y: P.y[i], vx: 0, vy: 0, life: 0.4, size: 6, type: 0, r: 1, g: 0.7, b: 0.5, a: 1, grow: -10 });
      P.kill(i); this.eaten++;
    });
  }
  draw(R) {
    R.ents.push(this.x, this.y, this.r * 3.2, 7, 1.0, 0.6, 0.35, 1, 0, 0, 0, 0);
    // pull streams
    if (Math.random() < 0.6) {
      const a = Math.random() * TAU, rr = this.reach * (0.5 + Math.random() * 0.5);
      this.G.fx.add({ x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr, vx: -Math.cos(a) * 60 - Math.sin(a) * 40, vy: -Math.sin(a) * 60 + Math.cos(a) * 40, life: 2.2, size: 2.5, type: 0, r: 1, g: 0.65, b: 0.4, a: 0.45, drag: -0.6, attract: this });
    }
  }
}

// ── Geyser: a white-hole updraft ───────────────────────────────────────────
export class Geyser extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w ?? 70; this.h = d.h ?? 420; this.power = d.power ?? 900;
    this.Z = { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h, y1: this.y, flow: true, fvx: 0, fvy: -this.power, flowK: 4.5,
      weight: (px, py) => 1 - Math.min(1, Math.abs(px - this.x) / (this.w / 2)) * 0.6 };
    G.phys.zones.push(this.Z);
  }
  draw(R) {
    if (Math.random() < 0.9) this.G.fx.add({ x: this.x + (Math.random() - 0.5) * this.w * 0.7, y: this.y, vx: (Math.random() - 0.5) * 20, vy: -this.power * (0.4 + Math.random() * 0.3), life: this.h / this.power * 2.2, size: 2 + Math.random() * 3, type: 1, r: 0.6, g: 0.95, b: 1.0, a: 0.5, drag: 0.3 });
    R.light(this.x, this.y - 40, 40, 200, 0.5, 0.9, 1.0, -0.35);
  }
}

// ── Current: flowing water (visible streaks reveal direction) ─────────────
export class Current extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w; this.h = d.h; this.vx = d.vx ?? 200; this.vy = d.vy ?? 0; this.k = d.k ?? 3;
    this.Z = { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h / 2, y1: this.y + this.h / 2, flow: true, fvx: this.vx, fvy: this.vy, flowK: this.k };
    G.phys.zones.push(this.Z);
  }
  draw(R) {
    if (Math.random() < this.w * this.h / 90000) {
      this.G.fx.add({ x: this.x + (Math.random() - 0.5) * this.w, y: this.y + (Math.random() - 0.5) * this.h, vx: this.vx, vy: this.vy, life: 1.0, size: 4, type: 2, stretch: 2.5, r: 0.5, g: 0.8, b: 1.0, a: 0.35, drag: 0 });
    }
  }
}

// ── Zone: gravity pockets (zero-G, inverted), swim water, heat/cold ────────
export class Zone extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w; this.h = d.h; this.kind = d.kind;
    const Z = { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y - this.h / 2, y1: this.y + this.h / 2 };
    if (d.kind === 'zerog') Object.assign(Z, { gravity: true, gx: 0, gy: 0, drag: 0.4 });
    if (d.kind === 'invert') Object.assign(Z, { gravity: true, gx: 0, gy: -(G.level?.gravity?.[1] ?? 600) });
    if (d.kind === 'water') Object.assign(Z, { buoy: 0.92, drag: 1.2, swim: 1 });
    if (d.kind === 'cold') Object.assign(Z, { heat: -1, heatRate: 1.5 });
    if (d.kind === 'hot') Object.assign(Z, { heat: 1, heatRate: 1.5 });
    if (d.kind === 'gravity') Object.assign(Z, { gravity: true, gx: d.gx ?? 0, gy: d.gy ?? 600 });
    this.Z = Z; G.phys.zones.push(Z);
    this.col = d.kind === 'zerog' ? [0.6, 0.7, 1.0] : d.kind === 'invert' ? [0.9, 0.6, 1.0] : d.kind === 'water' ? [0.3, 0.7, 0.9] : d.kind === 'cold' ? [0.6, 0.85, 1.0] : [1.0, 0.5, 0.2];
  }
  draw(R) {
    const k = this.kind;
    if (k === 'water') R.ents.push(this.x, this.y, Math.max(this.w, this.h) / 2, 12, 0.35, 0.75, 1.0, 1, 0, 0, this.w / 2, this.h / 2);
    if (Math.random() < this.w * this.h / 120000) {
      const vy = k === 'invert' ? -40 : k === 'zerog' ? (Math.random() - 0.5) * 20 : k === 'water' ? -25 : 0;
      this.G.fx.add({ x: this.x + (Math.random() - 0.5) * this.w, y: this.y + (Math.random() - 0.5) * this.h, vx: (Math.random() - 0.5) * 15, vy, life: 2.5, size: k === 'water' ? 3 : 2, type: k === 'water' ? 1 : 0, r: this.col[0], g: this.col[1], b: this.col[2], a: 0.35, drag: 0 });
    }
  }
}

// ── Magnet: EM node that ferro-gel answers with spikes and pull ───────────
export class Magnet extends Entity {
  constructor(G, d) {
    super(G, d); this.power = d.power ?? 1; this.reach = d.reach ?? 300; this.pulse = d.pulse || 0;
    this.Z = { x0: this.x - this.reach, x1: this.x + this.reach, y0: this.y - this.reach, y1: this.y + this.reach, magnet: this.power, ax: this.x, ay: this.y };
    G.phys.zones.push(this.Z);
  }
  update(dt) { this.t += dt; if (this.pulse) this.Z.magnet = this.power * (Math.sin(this.t * TAU / this.pulse) > 0 ? 1 : 0); }
  draw(R) {
    const on = this.Z.magnet > 0;
    R.ents.push(this.x, this.y, 30, 8, 0.6, 0.7, 1.0, on ? 1 : 0.35, 0, 0, 0, 0);
    if (on) R.light(this.x, this.y, 40, 180, 0.5, 0.6, 1.0, -0.5);
  }
}

// ── Membrane: one-way semi-permeable skin ──────────────────────────────────
export class Membrane extends Entity {
  constructor(G, d) {
    super(G, d);
    const len = d.len ?? 120, ang = d.angle ?? 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: len / 2, r: 4, angle: ang, surf: SURF.MEMBRANE, oneWay: true, passX: d.passX ?? 0, passY: d.passY ?? -1 });
    G.phys.shapes.push(this.S); this.len = len; this.ang = ang;
  }
  draw(R) {
    const S = this.S, ca = Math.cos(S.angle), sa = Math.sin(S.angle); const n = Math.ceil(this.len / 12);
    for (let k = 0; k <= n; k++) { const u = (k / n - 0.5) * this.len; const w = Math.sin(this.t * 3 + k) * 2;
      R.fx.push(S.x + ca * u - sa * w, S.y + sa * u + ca * w, 6, 0, 0.5, 1.0, 0.75, 0.35, 0, 0, 0, 0); }
    // tiny chevrons showing the way through
    const px = this.S.passX, py = this.S.passY;
    for (let k = -1; k <= 1; k++) { const u = k * this.len * 0.3; const ph = (this.t * 0.8 + k * 0.3) % 1;
      R.fx.push(S.x + ca * u + px * (ph * 30 - 15), S.y + sa * u + py * (ph * 30 - 15), 4, 0, 0.5, 1.0, 0.75, 0.5 * Math.sin(ph * Math.PI), 0, 0, 0, 0); }
  }
}

// ── Bumper: hyper-elastic membrane pad (trampoline) ────────────────────────
export class Bumper extends Entity {
  constructor(G, d) {
    super(G, d);
    const len = d.len ?? 120, ang = d.angle ?? 0;
    this.S = makeShape({ type: 1, x: d.x, y: d.y, hl: len / 2, r: 6, angle: ang, surf: SURF.BOUNCE, rest: d.rest ?? 1.35 });
    G.phys.shapes.push(this.S); this.len = len; this.wob = 0;
  }
  update(dt) { this.t += dt; this.wob *= Math.max(0, 1 - dt * 4); }
  post() { if (this.G.phys.events.bounce.length) { this.wob = 1; } }
  draw(R) {
    const S = this.S, ca = Math.cos(S.angle), sa = Math.sin(S.angle); const n = Math.ceil(this.len / 8);
    for (let k = 0; k <= n; k++) { const u = (k / n - 0.5) * this.len; const w = Math.sin(k / n * Math.PI) * Math.sin(this.t * 30) * 5 * this.wob;
      R.fx.push(S.x + ca * u - sa * w, S.y + sa * u + ca * w, 7, 0, 0.3, 0.95, 1.0, 0.7, 0, 0, 0, 0); }
    R.light(S.x, S.y, 20, 120, 0.3, 0.9, 1.0, -0.35);
  }
}

// ── Hint: wordless whisper (ghost gesture), appears only when you stall ───
export class Hint extends Entity {
  constructor(G, d) { super(G, d); this.r = d.r ?? 260; this.after = d.after ?? 5; this.kind = d.kind; this.idle = 0; this.done = false; this.shown = 0; this.until = d.until; }
  update(dt) {
    this.t += dt;
    const G = this.G; const F = G.colony && G.colony.focus;
    if (this.done || !F) { this.shown = Math.max(0, this.shown - dt * 2); return; }
    if (this.until && G.check(this.until)) { this.done = true; return; }
    const near = Math.hypot(F.B.cx - this.x, F.B.cy - this.y) < this.r;
    if (near) this.idle += dt; else this.idle = Math.max(0, this.idle - dt * 2);
    const want = near && this.idle > this.after ? 1 : 0;
    this.shown += (want - this.shown) * Math.min(1, dt * 3);
  }
  draw() { if (this.shown > 0.02) this.G.hud.hint(this, this.shown); }
}

// ── Reservoir: a living body of foreign fluid (oil rivers, ferro pools…) ──
//    keeps its volume, recycles what drifts away, never fuses with you.
export class Reservoir extends Entity {
  constructor(G, d) {
    super(G, d);
    this.w = d.w; this.h = d.h; this.mat = d.mat ?? MAT.OIL; this.n = d.n ?? 220; this.group = d.group ?? 9;
    this.src = d.src || [this.x - this.w / 2 + 30, this.y];            // where recycled fluid re-enters
    this.bounds = d.bounds || [this.x - this.w / 2 - 60, this.y - this.h / 2 - 200, this.x + this.w / 2 + 60, this.y + this.h / 2 + 200];
    this.tint = d.tint || null;
    const P = G.phys;
    const B = P.allocBody(this.group, 'fluid', this.mat); B.layer = 1; B.tint = this.tint; this.B = B;
    let k = 0; const sp = SPACING;
    for (let yy = this.y - this.h / 2 + sp; yy < this.y + this.h / 2 && k < this.n; yy += sp * 0.9) for (let xx = this.x - this.w / 2 + sp; xx < this.x + this.w / 2 && k < this.n; xx += sp) { P.spawn(xx + (Math.random() - 0.5), yy, d.vx || 0, 0, this.mat, B.id); k++; }
    B.count = k; B.alive = true; B.cx = this.x; B.cy = this.y; B.r = 30;
    this.acc = 0;
  }
  post(dt) {
    this.acc += dt; if (this.acc < 0.2) return; this.acc = 0;
    const P = this.G.phys; const [bx0, by0, bx1, by1] = this.bounds;
    for (let i = 0; i < P.hi; i++) {
      if (!P.alive[i] || P.mat[i] !== this.mat) continue;
      const B = P.bodies[P.body[i]]; if (B.group !== this.group) continue;
      if (P.x[i] < bx0 || P.x[i] > bx1 || P.y[i] < by0 || P.y[i] > by1) {
        const nx = this.src[0] + (Math.random() - 0.5) * 30, ny = this.src[1] + (Math.random() - 0.5) * 30;
        P.x[i] = nx; P.y[i] = ny; P.ox[i] = nx; P.oy[i] = ny; P.vx[i] = 0; P.vy[i] = 0; P.rr[i] = 0.2;
      }
    }
  }
}

// ── Sentinel: a watching eye that sweeps a beam; only the veiled pass unseen ─
export class Sentinel extends Entity {
  constructor(G, d) {
    super(G, d);
    this.a0 = d.a0 ?? 0.3; this.a1 = d.a1 ?? 1.3; this.period = d.period ?? 5; this.range = d.range ?? 700; this.fov = d.fov ?? 0.2; this.phase = d.phase ?? 0;
    this.ang = this.a0; this.alert = 0; this.lens = new Float32Array(7); this.cool = 0; this.seen = false;
  }
  update(dt) {
    this.t += dt;
    if (this.cool > 0) { this.cool -= dt; }
    const u = 0.5 - 0.5 * Math.cos((this.t / this.period + this.phase) * Math.PI * 2);
    // when suspicious the gaze slows and lingers
    this.ang = this.a0 + (this.a1 - this.a0) * u;
    const P = this.G.phys, out = {};
    for (let k = 0; k < 7; k++) {
      const a = this.ang + (k / 6 - 0.5) * 2 * this.fov * 0.86;
      this.lens[k] = P.raycast(this.x, this.y, Math.cos(a), Math.sin(a), this.range, out) ? out.t : this.range;
    }
  }
  post(dt) {
    const G = this.G, P = G.phys; let spotted = false, ghost = false, who = null;
    for (const B of G.playerBodies()) {
      // sample a handful of particles: line of sight per sample
      const n = B.len, stepK = Math.max(1, Math.floor(n / 10));
      for (let k = 0; k < n; k += stepK) {
        const i = P.bodyIdx[B.start + k];
        const dx = P.x[i] - this.x, dy = P.y[i] - this.y, d = Math.hypot(dx, dy);
        if (d > this.range) continue;
        let da = Math.atan2(dy, dx) - this.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > this.fov) continue;
        if (P.raycast(this.x, this.y, dx / d, dy / d, d - 6, {})) continue;   // a wall shields it
        if ((B.veil || 0) > 0.7) { ghost = true; break; }
        spotted = true; who = B; break;
      }
      if (spotted) break;
    }
    if (ghost && !spotted && !this.ghosted) { this.ghosted = true; G.onGhost && G.onGhost(this); }
    if (!ghost) this.ghosted = false;
    this.seen = spotted;
    this.alert = Math.max(0, Math.min(1.2, this.alert + (spotted ? dt * 2.6 : -dt * 0.8)));
    if (this.alert >= 1 && who && this.cool <= 0) this.scorch(who);
  }
  scorch(B) {
    const G = this.G, P = G.phys; this.cool = 1.6; this.alert = 0.4;
    const dx = B.cx - this.x, dy = B.cy - this.y, d = Math.hypot(dx, dy) + 1;
    for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; P.vx[i] += dx / d * 520; P.vy[i] += dy / d * 520 - 120; }
    let n = 0; for (let k = 0; k < B.len && n < 6; k += 7) { const i = P.bodyIdx[B.start + k]; if (P.body[i] === B.id) { G.shed(i, this.x, this.y, [1, 0.35, 0.25], 2.5); n++; } }
    G.R.post.flash = [1, 0.3, 0.2, 0.25]; G.R.danger[3] = 1; sound.hurt(1); sound.boom(); haptics.hurt();
    G.fx.ring(B.cx, B.cy, [1, 0.4, 0.3], 160, 0.6);
    G.onHurt && G.onHurt(n); G.onScorch && G.onScorch(this);
  }
  draw(R) {
    const a = this.alert, calm = [0.65, 0.85, 1.0], warn = [1.0, 0.7, 0.3], hot = [1.0, 0.25, 0.2];
    const c = a < 0.5 ? calm.map((v, i) => v + (warn[i] - v) * a * 2) : warn.map((v, i) => v + (hot[i] - v) * Math.min(1, (a - 0.5) * 2));
    for (let k = 0; k < 7; k++) {
      const ang = this.ang + (k / 6 - 0.5) * 2 * this.fov * 0.86, L = this.lens[k];
      R.ents.push(this.x + Math.cos(ang) * L / 2, this.y + Math.sin(ang) * L / 2, L / 2 + 20, 13, c[0], c[1], c[2], 1, ang, this.fov / 7 * 1.25, L, 1 + a * 1.5);
    }
    R.ents.push(this.x, this.y, 26, 14, c[0], c[1], c[2], 1, this.ang, a, 0, 0);
    R.light(this.x + Math.cos(this.ang) * 60, this.y + Math.sin(this.ang) * 60, 50, 260, c[0], c[1], c[2], -(0.5 + a));
  }
}

export const ENTITY_TYPES = { mote: Mote, prism: Prism, lantern: Lantern, exit: Exit, plate: Plate, gate: Gate, blade: Blade, grinder: Grinder, crusher: Crusher, pool: Pool, singularity: Singularity, geyser: Geyser, current: Current, zone: Zone, magnet: Magnet, membrane: Membrane, bumper: Bumper, hint: Hint, reservoir: Reservoir, sentinel: Sentinel };

// helpers to lay motes along paths
export function moteTrail(pts, n, value = 3) {
  const out = [];
  // polyline length
  let L = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); L += l; }
  for (let k = 0; k < n; k++) {
    let d = n === 1 ? 0 : k / (n - 1) * L; let i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? d / seg[i] : 0;
    out.push({ type: 'mote', x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, value });
  }
  return out;
}
