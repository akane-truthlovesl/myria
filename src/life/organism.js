// ─────────────────────────────────────────────────────────────────────────────
//  Organism — the will inside a body of light.
//
//  Turns intent (a direction and a throttle) into local actuation: a leading
//  pseudopod, a trailing viscoelastic mass, a crown of feelers that reach for
//  what the creature wants. Every force it applies traces back to an intent or
//  to a visible force of the world.
// ─────────────────────────────────────────────────────────────────────────────
import { H } from '../sim/physics.js';
import { M } from '../sim/materials.js';
import { Crown, RAY } from './rays.js';
import { clamp } from '../core/util.js';

let ORG_ID = 1;
export const CRUISE = 255;          // world units / s at full throttle (mass 130)
const ACCEL = 7.0, BRAKE = 6.5, AMAX = 2600;
const E = (k, d) => +(globalThis.process && globalThis.process.env && globalThis.process.env[k] || d);
const DART0 = E('DART0', 0.80), DART1 = E('DART1', 0.42);
const LEAD = E('LEAD', 3.3), TRAIL = E('TRAIL', 0.75), TONE_GO = E('TONE_GO', 0.8);       // pseudopod reach, tail lag, how much the pearl relaxes when it moves

export class Organism {
  constructor(world, body, opts = {}) {
    this.id = ORG_ID++;
    this.W = world; this.B = body; body.ctrl = this; this.serial = body.serial;
    this.colony = opts.colony || null;
    this.brain = opts.brain || null;
    this.focused = false;
    this.intent = { x: 0, y: 0 };
    this.aim = null;                 // world point the player is pointing at (rays look there)
    this.crownKind = opts.crown || 'sun';
    this.crown = new Crown(this);
    this.phi = Math.random() * 6.28;  // crown orientation (follows the body's spin)
    this.speedMul = opts.speedMul ?? 1;
    this.baseTonus = opts.tonus ?? 30;
    this.morph = opts.morph || null;  // {speed, tonus, dart}
    this.dartCD = 0; this.dartT = 0; this.peelT = 0;
    this.excite = 0; this.squeeze = 0; this.soft = 0; this.spread = 1;
    this.veil = 0; this.stealth = false; this.stillT = 0;
    this.facing = { x: 1, y: 0 };
    this.prevV = { x: 0, y: 0 }; this.impactCD = 0;
    this.breathT = Math.random() * 10; this.idleT = 0; this.idleNext = 2;
    this.forageT = 0; this.dormant = false; this.dead = false;
    this.hurtT = 0; this.joyT = 0; this.gulp = 0;
    this.seek = null; this.rallyTo = null; this.cradle = null;
    this.swell = false; this.puff = 0; this.canSwell = this.crownKind === 'sun';     // a held breath: bluff volume, then pop
    this.heat = 0;                                                                   // −1 frozen … 0 … +1 ember-warm
    body.waveA = 20; body.waveW = 1.5;
  }

  get alive() { return this.B.serial === this.serial && this.B.alive && this.B.count > 0; }
  get mass() { return this.B.count; }
  get speed() { const m = this.morph; return (m ? m.speed : 1) * CRUISE * this.speedMul * (1 + 0.55 * (this.emberK || 0)) * (1 + 0.12 * (this.colony && this.colony === this.W.player ? this.W.flow || 0 : 0)) * Math.pow(Math.max(16, this.B.count) / 130, -0.13) * (this.W.speedScale || 1); }

  // ── before physics: write the body's drive ─────────────────────────────
  update(dt) {
    const W = this.W, B = this.B;
    if (!this.alive) return;
    this.breathT += dt;
    this.dartCD = Math.max(0, this.dartCD - dt); this.dartT = Math.max(0, this.dartT - dt);
    this.peelT = Math.max(0, this.peelT - dt); this.impactCD = Math.max(0, this.impactCD - dt);
    this.hurtT = Math.max(0, this.hurtT - dt); this.joyT = Math.max(0, this.joyT - dt);
    this.gulp = Math.max(0, this.gulp - dt * 2.5);
    if (B.energy) B.energy *= Math.exp(-dt * 0.9);
    if (this.dormant) { B.ax = 0; B.ay = 0; B.lead = 0; B.tonus = 6; B.adhMul = 1; B.damp = 1.5; B.waveA = 5; B.waveW = 0.9; return; }
    if (this.brain) this.brain.think(this, dt);
    // ── swell: hold a breath (silhouette doubles, mass does not), release it as a shove ──
    const want = this.swell && this.canSwell && this.dartT <= 0 ? 1 : 0; const was = this.puff;
    this.puff += (want - this.puff) * Math.min(1, dt * (want ? 5 : 14));
    if (!want && was > 0.55 && !this.popped) { this.popped = true; W.pop && W.pop(this, was); } if (want) this.popped = false;
    B.inflate = this.puff;
    // ── temperature: frost stiffens and slows, warmth quickens; both fade back to the water's own ──
    this.heat += (0 - this.heat) * Math.min(1, dt * 0.05); const cold = this.heat < 0 ? -this.heat : 0, warm = this.heat > 0 ? this.heat : 0;
    let ix = this.intent.x, iy = this.intent.y;
    if (cold > 0.92) { ix = 0; iy = 0; }                                  // frozen through: only a dart cracks the shell
    let im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; im = 1; }
    if (im > 0.12) { this.facing.x = ix / im; this.facing.y = iy / im; }
    const n = B.count;
    const touching = B.contact >= 2 || B.contact / Math.max(1, n) > 0.012;
    const canCling = M.cling[B.mat] > 0;
    const cling = canCling && B.clingContact >= 2 && this.peelT <= 0 && this.dartT <= 0.05;
    const cnx = cling ? B.ccx : B.cnx, cny = cling ? B.ccy : B.cny;
    // impacts → excitement, crown startle, a wet thud
    const jolt = Math.hypot(B.vx - this.prevV.x, B.vy - this.prevV.y);
    if (jolt > 230 && this.impactCD <= 0 && touching) { this.excite = Math.min(1, this.excite + jolt / 800); this.impactCD = 0.18; this.crown.startle(Math.min(1, jolt / 600)); W.onImpact && W.onImpact(this, jolt, cnx, cny); }
    this.prevV.x = B.vx; this.prevV.y = B.vy;
    this.excite = Math.max(0, this.excite - dt * 0.7);
    this.spread = Math.max(B.maxx - B.minx, B.maxy - B.miny) / Math.max(8, 2 * B.r + 2 * H);
    // ── locomotion: steer the body's velocity toward the wanted one ──
    const speed = this.speed * (1 - 0.78 * cold + 0.22 * warm) * (1 - 0.45 * this.puff);
    const g = W.gravityAt ? W.gravityAt(B.cx, B.cy) : ZERO;
    const heavy = Math.hypot(g[0], g[1]) > 60;
    let ax, ay, lead = 0, damp = 0, adhMul = 1;
    if (im > 0.03) { ax = (ix * speed - B.vx) * ACCEL; ay = (iy * speed - B.vy) * ACCEL; lead = LEAD * im; }
    else if (this.budT > 0) { this.budT -= dt; ax = 0; ay = 0; }             // a thrown sibling coasts to where it was thrown
    else { ax = -B.vx * BRAKE; ay = -B.vy * BRAKE; damp = 1.3; }           // no ice-parking: resting is a decision the body keeps
    if (heavy && !touching) { ax *= 0.45; ay *= 0.2; }                   // under real gravity you steer a fall, you do not fly
    if (touching && im > 0.03) {
      const away = ix * cnx + iy * cny;                                  // + = pulling away from the surface
      if (cling && away > 0.55 && im > 0.5) { this.peelT = 0.3; W.onPeel && W.onPeel(this); }
      else if (cling && away < -0.2) { adhMul = 1.9; }                   // lean in → local suction, the gel wets the wall
    } else if (touching && cling) adhMul = 1.5;
    const am = Math.hypot(ax, ay); if (am > AMAX) { ax *= AMAX / am; ay *= AMAX / am; }
    if (this.rallyTo) { const T = this.rallyTo; const dx = T.cx - B.cx, dy = T.cy - B.cy, d = Math.hypot(dx, dy) + 1; const s = Math.min(1, d / 110); ax += dx / d * 1250 * s - B.vx * 2.6; ay += dy / d * 1250 * s - B.vy * 2.6; this.rallyTo = null; }
    if (this.seek) { const S = this.seek; const dx = S.x - B.cx, dy = S.y - B.cy, d = Math.hypot(dx, dy) + 1; const s = Math.min(1, d / 70); ax += dx / d * (S.k || 900) * s - B.vx * 2.4; ay += dy / d * (S.k || 900) * s - B.vy * 2.4; }
    if (this.cradle) { ax += this.cradle.ax; ay += this.cradle.ay; damp = Math.max(damp, this.cradle.damp); this.cradle = null; }
    B.ax = ax; B.ay = ay; B.lead = lead; B.trail = TRAIL * Math.min(1, lead / LEAD);
    B.lx = im > 0.03 ? ix / im : this.facing.x; B.ly = im > 0.03 ? iy / im : this.facing.y;
    B.adhMul = this.peelT > 0 || this.dartT > 0 ? 0.05 : adhMul;
    B.damp = damp; B.gs = 1;
    // ── tonus: a gathered pearl at rest, supple when reaching or squeezing ──
    const squeezing = this.spread > 1.25 ? Math.min(1, (this.spread - 1.25) / 0.8) : 0;
    this.squeeze += (squeezing - this.squeeze) * Math.min(1, dt * 6);
    let tonus = this.baseTonus * (1 - TONE_GO * im) * (1 - 0.7 * this.squeeze) * (1 + 0.4 * this.excite) * (this.morph ? this.morph.tonus : 1);
    if (this.dartT > 0) tonus *= 0.35;
    tonus *= 1 + 0.07 * Math.sin(this.breathT * 1.25) + 0.25 * this.gulp + 0.9 * (this.coil || 0);      // coiling for a lance: the pearl tightens
    B.tonus = tonus; B.tonusReach = 1.15;
    // phase-softening: pushing hard against something that will not yield → the gel lets go and flows through
    const along = im > 0.05 ? (B.vx * ix + B.vy * iy) / im : 0;
    const blocked = im > 0.55 && touching && along < speed * 0.3 ? 1 : 0;
    this.soft += ((blocked || this.squeeze > 0.35 ? 1 : 0) - this.soft) * Math.min(1, dt * (blocked ? 3 : 1.5));
    B.stiff = (1 - 0.42 * this.soft) * (1 + 1.3 * cold); if (this.soft > 0.5) B.tonus *= 0.6;
    B.visc = 1 + 4 * cold; B.tonus *= (1 - 0.8 * this.puff) * (1 + 0.8 * cold);
    // breathing: area-conserving surface waves whose size and pace tell the mood
    B.waveA = (15 + 38 * this.excite + (this.focused ? 6 : 0)) * (1 - 0.92 * this.veil);
    B.waveW = 1.35 + 3.4 * this.excite;
    // ── chameleon veil: hold still against a surface where watchers roam ──
    const still = im < 0.05 && touching && Math.hypot(B.vx, B.vy) < 45 && this.dartT <= 0;
    this.stillT = still ? this.stillT + dt : 0;
    const veilOK = this.canVeil || (W.veilNear && W.veilNear(B.cx, B.cy));
    const wantVeil = veilOK && this.stillT > 0.5 ? 1 : 0;
    this.veil += (wantVeil - this.veil) * Math.min(1, dt * (wantVeil ? 2.4 : 7));
    if (this.veil > 0.02) { B.tonus *= 1 - 0.85 * this.veil; B.adhMul *= 1 + 2 * this.veil; B.ax -= cnx * 520 * this.veil; B.ay -= cny * 520 * this.veil; }
    this.stealth = this.veil > 0.7;
    B.veil = this.veil;
  }

  // ── after physics: crown, foraging, little private gestures ────────────
  post(dt) {
    if (!this.alive) return;
    const W = this.W, B = this.B;
    this.phi += clamp(B.spin || 0, -6, 6) * dt;
    const im = Math.hypot(this.intent.x, this.intent.y);
    const crown = this.crown;
    if (!this.dormant && crown.kind === 'sun') {
      // forage: free feelers go after nearby light on their own — reach is visible, never a hidden magnet
      this.forageT -= dt;
      if (this.forageT <= 0 && W.pickups) {
        this.forageT = 0.06;
        const reach = crown.maxReach(B.r) + B.r;
        for (const it of W.pickups) {
          if (it.dead || it.owner != null && it.owner !== B.group) continue;
          const dx = it.x - B.cx, dy = it.y - B.cy; const d2 = dx * dx + dy * dy;
          if (d2 > reach * reach) continue;
          if (d2 < (B.r * 0.92 + it.r) * (B.r * 0.92 + it.r)) { if (!it.held || it.held && crown.rays.includes(it.held)) it.absorb(this, null); continue; }   // body contact: straight in
          if (it.held || it.claim && it.claim.item === it && it.claim.mode === RAY.REACH) continue;
          if (it.shy > W.time) continue;
          if (W.phys.blocked(B.cx, B.cy, it.x, it.y, 1)) { it.shy = W.time + 0.3; continue; }      // glass is glass: no reaching through it
          const r = crown.reach(it.x, it.y, it, 1.0);
          if (r) it.claim = r; else it.shy = W.time + 0.25;
        }
      }
      // the lead feelers look where the player points
      if (this.focused && this.aim && im > 0.05 && this.dartT <= 0) {
        this.lookT = (this.lookT || 0) - dt;
        if (this.lookT <= 0) { this.lookT = 0.25; const dx = this.aim.x - B.cx, dy = this.aim.y - B.cy, d = Math.hypot(dx, dy) + 1; const rr = Math.min(d, B.r + crown.maxReach(B.r) * 0.75); crown.reach(B.cx + dx / d * rr, B.cy + dy / d * rr, null, 0.3, RAY.SNIFF); }
      }
      // idle personality
      this.idleT = im > 0.06 || this.dartT > 0 ? 0 : this.idleT + dt;
      if (this.idleT > 2.2 && !this.stealth) {
        this.idleNext -= dt;
        if (this.idleNext <= 0) { this.idleNext = 2.2 + Math.random() * 3.5; this.idleGesture(); }
      }
    }
    crown.update(dt);
  }

  idleGesture() {
    const W = this.W, B = this.B, crown = this.crown; const r = Math.random();
    if (r < 0.4) {            // sniff toward something interesting: the finger, a wonder, a wall
      const t = (this.focused && this.aim) || (W.findCuriosity && W.findCuriosity(this));
      const a = Math.random() * 6.28; const d = B.r + crown.maxReach(B.r) * 0.7;
      let x = B.cx + Math.cos(a) * d, y = B.cy + Math.sin(a) * d;
      if (t) { const dx = t.x - B.cx, dy = t.y - B.cy, l = Math.hypot(dx, dy) + 1; const rr = Math.min(l, d); x = B.cx + dx / l * rr; y = B.cy + dy / l * rr; }
      crown.reach(x, y, null, 0.9 + Math.random() * 0.6, RAY.SNIFF);
    } else if (r < 0.62) { this.excite = Math.min(1, this.excite + 0.5); crown.startle(0.35); }   // a happy shiver
    else if (r < 0.82) crown.joy();                                                               // a shimmer round the crown
    else if (W.fx) W.fx.bubble(B.cx + (Math.random() - 0.5) * B.r * 0.5, B.cy, 3 + Math.random() * 2.5);  // a private bubble
  }

  onGrab(item) { this.W.onGrab && this.W.onGrab(this, item); }

  // a fingertip poke: dent where you touched, a ripple, a giggle
  poke(wx, wy) {
    const P = this.W.phys, B = this.B;
    for (let k = 0; k < B.len; k++) {
      const i = P.bodyIdx[B.start + k];
      const dx = P.x[i] - wx, dy = P.y[i] - wy, d = Math.hypot(dx, dy) + 1;
      if (d < 60) { const f = (1 - d / 60) * 240; P.vx[i] += dx / d * f; P.vy[i] += dy / d * f; P.glow[i] = Math.max(P.glow[i], 0.8 * (1 - d / 60)); }
    }
    this.excite = Math.min(1, this.excite + 0.7); this.idleT = 0; this.crown.startle(0.8);
  }

  // ── verbs ────────────────────────────────────────────────────────────
  // dart: the whole body contracts and lances forward; a little mass is spent as a jet you can fetch back
  dart(dx, dy, power = 1) {
    const W = this.W, P = W.phys, B = this.B;
    if (this.dartCD > 0 || B.count < 6 || this.dormant || this.puff > 0.4) return false;
    if (this.heat < -0.5) { this.heat += 0.45; W.fx && W.fx.burst(B.cx, B.cy, 12, [0.75, 0.95, 1], 200, { life: 0.5, size: 2.2, type: 1 }); }       // a dart cracks the ice
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const lance = power >= 1.25;                    // a coiled dart is a lance: it costs more and cleaves what it meets
    const cost = W.dartCost ? W.dartCost(this) : Math.max(1, Math.round(B.count * (lance ? 0.05 : 0.025)));
    const sp = (W.dartSpeed || 600) * Math.min(1.25, 0.85 + 0.25 * power) * (this.morph ? this.morph.dart : 1);
    const jet = [];
    for (let k = 0; k < B.len; k++) {
      const i = P.bodyIdx[B.start + k];
      const s = ((P.x[i] - B.cx) * dx + (P.y[i] - B.cy) * dy) / (B.r + 4);
      const vd = P.vx[i] * dx + P.vy[i] * dy; const keep = vd < 0 ? vd : 0;        // cancel backwards motion
      const add = sp * (DART0 + DART1 * s);                                  // the head outruns the tail: for a moment the body is a lance
      P.vx[i] += dx * (add - keep); P.vy[i] += dy * (add - keep);
      const lat = P.vx[i] * -dy + P.vy[i] * dx; P.vx[i] -= -dy * lat * 0.5; P.vy[i] -= dx * lat * 0.5;
      P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
      jet.push([s, i]);
    }
    if (cost > 0 && W.massCosts !== false) {
      jet.sort((a, b) => a[0] - b[0]);
      const J = P.allocBody(-1, 'spent', B.mat);
      if (J) {
        J.fuseT = 0.45; J.tint = B.tint;
        for (let k = 0; k < Math.min(cost, jet.length - 4); k++) {
          const i = jet[k][1]; P.body[i] = J.id;
          P.vx[i] = -dx * (180 + Math.random() * 160) + (Math.random() - 0.5) * 120 + B.vx * 0.2;
          P.vy[i] = -dy * (180 + Math.random() * 160) + (Math.random() - 0.5) * 120 + B.vy * 0.2;
          P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
          P.life[i] = 2.2 + Math.random() * 0.6; P.glow[i] = 1.5;
        }
      }
    }
    this.dartCD = 0.34; this.dartT = 0.3; this.peelT = 0.2; this.lance = lance ? 0.34 : 0; this.lanceX = dx; this.lanceY = dy;
    this.excite = Math.min(1, this.excite + 0.5);
    W.onDart && W.onDart(this, dx, dy, cost);
    return true;
  }

  // bud: eject a sibling droplet toward (tx,ty)
  bud(tx, ty, frac = 0.4) {
    const W = this.W, P = W.phys, B = this.B;
    const n = B.count; const k = Math.max(4, Math.round(n * frac));
    if (n - k < 4 || this.dormant) return null;
    let dx = tx - B.cx, dy = ty - B.cy; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const bx = B.cx + dx * B.r * 1.4, by = B.cy + dy * B.r * 1.4;
    const arr = [];
    for (let q = 0; q < B.len; q++) { const i = P.bodyIdx[B.start + q]; const ex = P.x[i] - bx, ey = P.y[i] - by; arr.push([ex * ex + ey * ey, i]); }
    arr.sort((a, b) => a[0] - b[0]);
    const NB = P.allocBody(B.group, 'fragment', B.mat);
    if (!NB) return null;
    NB.fuseT = 1.1; B.fuseT = Math.max(B.fuseT, 1.1); NB.tint = B.tint;
    const sp = Math.max(220, Math.min(660, m * ((P.drag || 1.5) + 0.25)));      // thrown just hard enough to arrive
    for (let q = 0; q < k; q++) {
      const i = arr[q][1]; P.body[i] = NB.id;
      P.vx[i] = B.vx * 0.3 + dx * sp; P.vy[i] = B.vy * 0.3 + dy * sp;
      P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120; P.glow[i] = 1.2;
    }
    for (let q = k; q < arr.length; q++) { const i = arr[q][1]; P.vx[i] -= dx * 90; P.vy[i] -= dy * 90; }
    P.forceComponents = true; NB.count = k;
    W.onBud && W.onBud(this, NB, dx, dy);
    return NB;
  }
}
const ZERO = [0, 0];
