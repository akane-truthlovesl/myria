// ─────────────────────────────────────────────────────────────────────────────
//  Organism — the will inside a body of light.
//  Turns intent (stick, darts, buds) into local actuation: a probing tendril,
//  a reaching pseudopod, a trailing viscoelastic mass. Every force it applies
//  traces back to an intent or a visible world force.
// ─────────────────────────────────────────────────────────────────────────────
import { H, PR, AREA_PER_P } from '../engine/physics.js';
import { M, MAT } from '../engine/materials.js';

const TAU = Math.PI * 2;
let ORG_ID = 1;

export class Feeler {
  constructor(k = 60, reach = 160) { this.tip = -1; this.tx = 0; this.ty = 0; this.s = 0; this.k = k; this.reach = reach; this.nb = []; this.target = 0; this.t = 0; this.dirx = 1; this.diry = 0; }
}

export class Organism {
  constructor(game, body, opts = {}) {
    this.id = ORG_ID++;
    this.G = game; this.B = body; body.ctrl = this; this.serial = body.serial;
    this.colony = opts.colony || null;
    this.brain = opts.brain || null;
    this.focused = false;
    this.intent = { x: 0, y: 0 };
    this.feel = [new Feeler(46, 140), new Feeler(60, 220), new Feeler(80, 200)]; // curiosity, touch-reach, lead
    body.feelers = this.feel;
    this.breathT = Math.random() * 10;
    this.dartCD = 0; this.dartT = 0;
    this.clingT = 0; this.peelT = 0; this.airT = 0;
    this.excite = 0; this.squeeze = 0;
    this.facing = { x: 1, y: 0 };
    this.curT = 1 + Math.random() * 2; this.curTarget = null;
    this.touchTarget = null;
    this.ground = 0; this.wall = 0; this.ceil = 0;
    this.speedMul = opts.speedMul ?? 1;
    this.baseTonus = opts.tonus ?? 30;
    this.spread = 1;
    this.inflate = 0;
    this.lastContact = 0;
    this.impactCD = 0;
    this.prevV = { x: 0, y: 0 };
    this.mood = 'calm';
    this.dead = false;
    this.parked = 0;
    this.trailT = 0;
    body.waveA = 26; body.waveW = 1.6;
  }

  get alive() { return this.B.serial === this.serial && this.B.alive && this.B.count > 0; }
  get mass() { return this.B.count; }

  // ── per-frame (before physics) ─────────────────────────────────────────
  update(dt) {
    const G = this.G, P = G.phys, B = this.B;
    if (!this.alive) return;
    this.breathT += dt;
    if (B.energy) B.energy *= Math.exp(-dt * 0.9);
    this.dartCD = Math.max(0, this.dartCD - dt);
    this.dartT = Math.max(0, this.dartT - dt);
    this.peelT = Math.max(0, this.peelT - dt);
    this.impactCD = Math.max(0, this.impactCD - dt);
    if (this.dormant) { B.ax = 0; B.ay = 0; B.lead = 0; B.tonus = 0; B.gs = 1; B.adhMul = 1; B.damp = 1.5; B.waveA = 8; B.waveW = 1.0; for (const F of this.feel) F.s = 0; return; }
    if (this.brain) this.brain.think(this, dt);
    const ix = this.intent.x, iy = this.intent.y;
    const im = Math.hypot(ix, iy);
    if (im > 0.15) { this.facing.x = ix / im; this.facing.y = iy / im; }
    // local gravity
    const g = G.gravityAt(B.cx, B.cy);
    const gm = Math.hypot(g[0], g[1]);
    const gdx = gm > 1 ? g[0] / gm : 0, gdy = gm > 1 ? g[1] / gm : 1;
    const zeroG = gm < 60;
    const swim = G.swimAt ? G.swimAt(B.cx, B.cy) : 0;
    // contact reading
    const n = B.count;
    const contactFrac = B.contact / Math.max(1, n);
    const clingFrac = B.clingContact / Math.max(1, n);
    const canCling = M.cling[B.mat] > 0;
    const touching = contactFrac > 0.012 || B.contact >= 2;
    let cnx = B.cnx, cny = B.cny;
    if (touching) { this.lastContact = 0; this.airDarts = 0; } else this.lastContact += dt;
    const floorness = touching ? (-(cnx * gdx + cny * gdy)) : 0;   // 1 on floor, -1 on ceiling
    this.ground = touching && floorness > 0.55 ? 1 : 0;
    // impacts → excitement & splat feedback
    const dvx = B.vx - this.prevV.x, dvy = B.vy - this.prevV.y;
    const jolt = Math.hypot(dvx, dvy);
    if (jolt > 260 && this.impactCD <= 0 && touching) {
      this.excite = Math.min(1, this.excite + jolt / 900);
      this.impactCD = 0.18;
      G.onImpact && G.onImpact(this, jolt, cnx, cny);
    }
    this.prevV.x = B.vx; this.prevV.y = B.vy;
    this.excite = Math.max(0, this.excite - dt * 0.6);
    // spread (squeezed / stretched?)
    this.spread = Math.max(B.maxx - B.minx, B.maxy - B.miny) / Math.max(8, 2 * B.r + 2 * H);
    // ── locomotion ──────────────────────────────────────────────────────
    const sizeK = Math.pow(Math.max(20, n) / 140, -0.12);
    const speed = (this.morphSpeed ?? 1) * 245 * this.speedMul * sizeK * (G.speedScale || 1);
    let ax = 0, ay = 0;
    let gs = 1, adhMul = 1, lead = 0, damp = 0;
    // cling only when a real share of what we touch can be gripped (no cheating up glass via a corner)
    const cling = canCling && B.clingContact >= 2 && B.clingContact >= B.contact * 0.35 && this.peelT <= 0 && this.dartT <= 0.05;
    if (cling) { cnx = B.ccx; cny = B.ccy; }
    if (zeroG || swim > 0.5) {
      // free swimming
      const k = 5.5;
      ax = (ix * speed - B.vx) * k; ay = (iy * speed - B.vy) * k;
      if (im < 0.05) { ax = -B.vx * 2.2; ay = -B.vy * 2.2; }
      lead = im * 1.3;
      gs = zeroG ? 1 : 0.25;
    } else if (touching && (cling || this.ground)) {
      // surface crawl: intent projected onto the surface tangent
      const away = ix * cnx + iy * cny;            // + = pulling away from the surface
      let tx = ix - cnx * away, ty = iy - cny * away;
      if (!this.ground && away > 0.6 && im > 0.5) {
        // deliberate peel-off: let go (gel strand will draw out and snap)
        this.peelT = 0.35;
        G.onPeel && G.onPeel(this);
      }
      // pressing into a clingable surface means "climb over it" (away from gravity)
      if (cling && away < -0.25) {
        const upn = -gdx * cnx - gdy * cny;
        let ux = -gdx - cnx * upn, uy = -gdy - cny * upn;
        const ul = Math.hypot(ux, uy);
        if (ul > 0.2) { ux /= ul; uy /= ul; tx += ux * (-away) * 1.1; ty += uy * (-away) * 1.1; }
      }
      { const tl = Math.hypot(tx, ty); if (tl > 1) { tx /= tl; ty /= tl; } }
      const vt = (B.vx * (1 - cnx * cnx) - B.vy * cnx * cny), vtY = (B.vy * (1 - cny * cny) - B.vx * cnx * cny);
      const k = 8;
      ax = (tx * speed - vt) * k; ay = (ty * speed - vtY) * k;
      if (im < 0.05) { ax = -vt * 10; ay = -vtY * 10; damp = 2.5; } // no ice-parking
      if (cling && !this.ground) {
        gs = 0.08; adhMul = 2.2;
        // gentle press into the surface keeps the grip honest
        ax -= cnx * 140; ay -= cny * 140;
      } else if (cling) { adhMul = 1.4; }
      lead = im * 1.5;
      this.clingT = cling ? this.clingT + dt : 0;
    } else {
      // airborne: limited lateral control, momentum preserved
      const px = -gdy, py = gdx;                     // perpendicular to gravity
      const lat = ix * px + iy * py;
      const vlat = B.vx * px + B.vy * py;
      const k = 3.2;
      const a = (lat * speed * 0.9 - vlat) * k * (im > 0.05 ? 1 : 0.25);
      ax = px * a; ay = py * a;
      lead = im * 1.0;
      this.airT += dt;
    }
    if (touching) this.airT = 0;
    // clamp accel
    const am = Math.hypot(ax, ay), amax = 2600;
    if (am > amax) { ax *= amax / am; ay *= amax / am; }
    // rally pull toward focused colony body
    if (this.rallyTo) { const R = this.rallyTo; const dx = R.cx - B.cx, dy = R.cy - B.cy; const d = Math.hypot(dx, dy) + 1;
      const s = Math.min(1, d / 120); ax += dx / d * 900 * s - B.vx * 2.5; ay += dy / d * 900 * s - B.vy * 2.5; gs = Math.min(gs, 0.3); this.rallyTo = null; }
    // seek a point (scripted moments: birth, portals)
    if (this.seek) { const S = this.seek; const dx = S.x - B.cx, dy = S.y - B.cy; const d = Math.hypot(dx, dy) + 1;
      ax += dx / d * (S.k || 900) * Math.min(1, d / 80) - B.vx * 2; ay += dy / d * (S.k || 900) * Math.min(1, d / 80) - B.vy * 2; gs = 0; }
    // extra pulls (cradles, currents handled in physics zones)
    if (this.cradle) { ax += this.cradle.ax; ay += this.cradle.ay; damp = Math.max(damp, this.cradle.damp); this.cradle = null; }
    B.ax = ax; B.ay = ay;
    B.lx = im > 0.05 ? ix / im : this.facing.x; B.ly = im > 0.05 ? iy / im : this.facing.y;
    B.lead = lead;
    B.gs = this.dartT > 0 ? Math.min(gs, 0.35) : gs;
    B.adhMul = this.peelT > 0 || this.dartT > 0 ? 0.05 : adhMul;
    B.damp = damp;
    // ── tonus: gathered pearl at rest, supple when reaching or squeezing ──
    const squeezing = this.spread > 1.25 ? Math.min(1, (this.spread - 1.25) / 0.8) : 0;
    this.squeeze += (squeezing - this.squeeze) * Math.min(1, dt * 6);
    let tonus = this.baseTonus * (1 - 0.45 * Math.min(1, im)) * (1 - 0.7 * this.squeeze) * (1 + 0.4 * this.excite);
    if (this.dartT > 0) tonus *= 0.35;
    tonus *= 1 + 0.06 * Math.sin(this.breathT * 1.3);            // slow breath
    B.tonus = tonus * (this.morphTonus ?? 1);
    B.tonusReach = 1.15;
    // phase-softening: pushing hard against something that won't yield → the gel lets go and flows
    const along = im > 0.05 ? (B.vx * ix + B.vy * iy) / im : 0;
    const blocked = im > 0.55 && touching && along < speed * 0.3 ? 1 : 0;
    this.soft = (this.soft || 0) + ((blocked || this.squeeze > 0.35 ? 1 : 0) - (this.soft || 0)) * Math.min(1, dt * (blocked ? 3 : 1.5));
    B.stiff = 1 - 0.42 * this.soft;
    if (this.soft > 0.5) B.tonus *= 0.6;
    // breathing waves reflect state
    const wa = 18 + 40 * this.excite + 10 * (this.focused ? 1 : 0);
    B.waveA = wa * (this.stealth ? 0.1 : 1);
    B.waveW = 1.4 + 3.5 * this.excite;
    // ── chameleon veil: hold still against a surface where watchers roam ──
    const still = im < 0.05 && touching && Math.hypot(B.vx, B.vy) < 45 && this.dartT <= 0 && !this.brain;
    this.stillT = still ? (this.stillT || 0) + dt : 0;
    const veilOK = G.level && (G.level.veil || (G.veilNear && G.veilNear(B.cx, B.cy)));
    const wantVeil = veilOK && this.stillT > 0.55 ? 1 : 0;
    this.veil = (this.veil || 0) + (wantVeil - (this.veil || 0)) * Math.min(1, dt * (wantVeil ? 2.4 : 7));
    B.veil = this.veil;
    if (this.veil > 0.02) {
      B.tonus *= 1 - 0.85 * this.veil;               // exhale: let the body spread thin
      B.adhMul *= 1 + 2 * this.veil;
      B.ax -= cnx * 520 * this.veil; B.ay -= cny * 520 * this.veil;   // press flat into the surface
      B.waveA *= 1 - 0.95 * this.veil;               // hold breath
    }
    this.stealth = this.veil > 0.7;
    // ── tendrils ────────────────────────────────────────────────────────
    this.updateFeelers(dt, im, ix, iy);
    this.prevIm = im;
    // ── idle personality: little private gestures when left alone ───────
    this.idleT = im > 0.08 || this.dartT > 0 ? 0 : (this.idleT || 0) + dt;
    if (this.focused && this.idleT > 3.5 && !this.stealth) {
      this.idleNext = (this.idleNext ?? 1.5) - dt;
      if (this.idleNext <= 0) { this.idleNext = 4 + Math.random() * 4; this.idleGesture(); }
    }
    if (this.yawn > 0) {
      this.yawn -= dt;
      const L = this.feel[2]; const k = Math.sin(Math.min(1, 1 - this.yawn / 1.4) * Math.PI);
      L.s = Math.max(L.s, k * 0.75); L.dirx = this.yawnDir[0]; L.diry = this.yawnDir[1];
      if (L.tip < 0 || !this.G.phys.alive[L.tip]) { L.tip = this.pickTip(L.dirx, L.diry); this.gatherNb(L); }
      L.tx = B.cx + L.dirx * (B.r * 2.1 + 20); L.ty = B.cy + L.diry * (B.r * 2.1 + 20); L.k = 46; L.reach = 140;
    }
  }

  idleGesture() {
    const G = this.G, B = this.B;
    const r = Math.random();
    const g = G.gravityAt(B.cx, B.cy); const gm = Math.hypot(g[0], g[1]) || 1;
    if (r < 0.35) { // stretch up toward the light, like a yawn
      this.yawn = 1.4; this.yawnDir = gm > 60 ? [-g[0] / gm + (Math.random() - 0.5) * 0.5, -g[1] / gm] : [Math.cos(Math.random() * 6.28), Math.sin(Math.random() * 6.28)];
      const l = Math.hypot(...this.yawnDir); this.yawnDir = [this.yawnDir[0] / l, this.yawnDir[1] / l];
    } else if (r < 0.65) { // a private bubble rises and pops
      const up = gm > 60 ? [-g[0] / gm, -g[1] / gm] : [0, -1];
      const b = G.fx.add({ x: B.cx + (Math.random() - 0.5) * B.r * 0.6, y: B.cy, vx: up[0] * 40, vy: up[1] * 40, life: 1.6, size: 4 + Math.random() * 3, type: 1, r: 1, g: 0.95, b: 0.9, a: 0.9, drag: 0.4 });
      setTimeout(() => { if (G.fx.list.includes(b)) { G.fx.burst(b.x, b.y, 5, [1, 0.95, 0.9], 60, { size: 1.6, life: 0.3, type: 0 }); b.life = 0; G.sound && G.sound.pop(0.4); } }, 1450);
    } else if (r < 0.85) { // a happy shiver
      this.excite = Math.min(1, this.excite + 0.55);
    } else { // glance around (curiosity toward a random point)
      const a = Math.random() * 6.28; this.curTarget = { x: B.cx + Math.cos(a) * (B.r + 90), y: B.cy + Math.sin(a) * (B.r + 90), pull: 0.5 };
      const C = this.feel[0]; C.dirx = Math.cos(a); C.diry = Math.sin(a); C.tip = this.pickTip(C.dirx, C.diry); this.gatherNb(C); C.hold = 1.1;
    }
  }

  // a fingertip poke: dent where you touched, a ripple, a giggle
  poke(wx, wy) {
    const P = this.G.phys, B = this.B;
    for (let k = 0; k < B.len; k++) {
      const i = P.bodyIdx[B.start + k];
      const dx = P.x[i] - wx, dy = P.y[i] - wy, d = Math.hypot(dx, dy) + 1;
      if (d < 60) { const f = (1 - d / 60) * 240; P.vx[i] += dx / d * f; P.vy[i] += dy / d * f; P.glow[i] = Math.max(P.glow[i], 0.8 * (1 - d / 60)); }
    }
    this.excite = Math.min(1, this.excite + 0.7);
    this.idleT = 0;
  }

  // choose a surface particle facing direction (dx,dy)
  pickTip(dx, dy, avoid = -1) {
    const P = this.G.phys, B = this.B;
    let best = -1, bs = -1e9;
    for (let k = 0; k < B.len; k++) {
      const i = P.bodyIdx[B.start + k];
      if (i === avoid) continue;
      const rx = P.x[i] - B.cx, ry = P.y[i] - B.cy;
      const s = rx * dx + ry * dy - Math.abs(rx * dy - ry * dx) * 0.35;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }
  gatherNb(F) {
    const P = this.G.phys; const B = this.B; F.nb.length = 0;
    if (F.tip < 0) return;
    P.forEachNear(P.x[F.tip], P.y[F.tip], H * 1.7, (j) => { if (j !== F.tip && P.body[j] === B.id && F.nb.length < 10) F.nb.push(j); });
  }

  updateFeelers(dt, im, ix, iy) {
    const P = this.G.phys, B = this.B;
    const R = B.r;
    // [2] lead tendril — "nudge to extend a tendril"
    const L = this.feel[2];
    const want = im > 0.08 && this.dartT <= 0 ? Math.min(1, im * 1.15) : 0;
    L.s += (want * 0.9 - L.s) * Math.min(1, dt * (want > L.s ? 9 : 5));
    if (L.s > 0.02) {
      const dx = im > 0.08 ? ix / im : L.dirx, dy = im > 0.08 ? iy / im : L.diry;
      const turned = dx * L.dirx + dy * L.diry < 0.8;
      L.dirx = dx; L.diry = dy;
      L.t -= dt;
      if (L.tip < 0 || !P.alive[L.tip] || P.body[L.tip] !== B.id || turned || L.t <= 0) { L.tip = this.pickTip(dx, dy); this.gatherNb(L); L.t = 0.3; }
      // gentle probes reach further than full cruising (full throw = whole-body motion)
      const reach = R * (0.55 + 0.5 * (1 - Math.abs(im - 0.45) * 1.2)) + 18;
      L.tx = B.cx + dx * (R + reach); L.ty = B.cy + dy * (R + reach);
      L.reach = 120; L.k = 50 + 30 * this.squeeze;
    }
    // [1] touch reach — the creature notices your finger
    const T = this.feel[1];
    let tw = 0;
    if (this.touchTarget && this.focused) {
      const dx = this.touchTarget.x - B.cx, dy = this.touchTarget.y - B.cy; const d = Math.hypot(dx, dy);
      if (d > R * 0.8 && d < R + 260) { tw = 0.85 * (1 - Math.max(0, d - R - 140) / 120); T.tx = this.touchTarget.x; T.ty = this.touchTarget.y; T.dirx = dx / d; T.diry = dy / d; }
    }
    T.s += (tw - T.s) * Math.min(1, dt * (tw > T.s ? 6 : 3));
    if (T.s > 0.02) {
      T.t -= dt;
      if (T.tip < 0 || !P.alive[T.tip] || P.body[T.tip] !== B.id || T.t <= 0) { T.tip = this.pickTip(T.dirx, T.diry, L.tip); this.gatherNb(T); T.t = 0.5; }
      T.k = 55; T.reach = 150;
    }
    this.touchTarget = null;
    // [0] curiosity — glances at nearby wonders when calm
    const C = this.feel[0];
    this.curT -= dt;
    if (this.curT <= 0) {
      this.curT = 1.6 + Math.random() * 2.6;
      this.curTarget = im < 0.3 && !this.stealth ? this.G.findCuriosity(this) : null;
      if (this.curTarget) { const dx = this.curTarget.x - B.cx, dy = this.curTarget.y - B.cy; const d = Math.hypot(dx, dy) || 1; C.dirx = dx / d; C.diry = dy / d; C.tip = this.pickTip(C.dirx, C.diry, L.tip); this.gatherNb(C); C.hold = 0.8 + Math.random() * 0.9; }
    }
    let cw = 0;
    if (this.curTarget && C.hold > 0) {
      C.hold -= dt;
      const ct = this.curTarget;
      if (ct.dead) this.curTarget = null;
      else { C.tx = ct.x; C.ty = ct.y; cw = ct.pull ?? 0.55; }
    }
    C.s += (cw - C.s) * Math.min(1, dt * (cw > C.s ? 4 : 2.5));
    if (C.s > 0.02) { if (C.tip < 0 || !P.alive[C.tip] || P.body[C.tip] !== B.id) { C.tip = this.pickTip(C.dirx, C.diry, L.tip); this.gatherNb(C); } C.k = 40; C.reach = 130; }
  }

  // ── verbs ────────────────────────────────────────────────────────────
  dart(dx, dy, power = 1) {
    const G = this.G, P = G.phys, B = this.B;
    if (this.dartCD > 0 || B.count < 6) return false;
    // two leaps in the air, then you must touch something (zero-G & water are free)
    const free = G.gravityAt ? Math.hypot(...G.gravityAt(B.cx, B.cy)) < 60 || (G.swimAt && G.swimAt(B.cx, B.cy)) : true;
    if (!free && this.lastContact > 0.12) { if ((this.airDarts || 0) >= 2) { G.onDartDenied && G.onDartDenied(this); return false; } this.airDarts = (this.airDarts || 0) + 1; }
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const cost = G.dartCost ? G.dartCost(this) : Math.max(1, Math.round(B.count * 0.025));
    const sp = (G.dartSpeed || 560) * Math.min(1.25, 0.85 + 0.25 * power) * (this.morphDart ?? 1);
    // lance: front-loaded impulse elongates the body along the strike
    let jet = [];
    for (let k = 0; k < B.len; k++) {
      const i = P.bodyIdx[B.start + k];
      const s = ((P.x[i] - B.cx) * dx + (P.y[i] - B.cy) * dy) / (B.r + 4);
      const vd = P.vx[i] * dx + P.vy[i] * dy;
      const keep = vd < 0 ? vd : 0;                       // cancel backwards motion
      const add = sp * (0.82 + 0.28 * s);
      P.vx[i] += dx * (add - keep); P.vy[i] += dy * (add - keep);
      // remove a share of lateral velocity for a crisp line
      const lat = P.vx[i] * -dy + P.vy[i] * dx;
      P.vx[i] -= -dy * lat * 0.5; P.vy[i] -= dx * lat * 0.5;
      P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
      jet.push([s, i]);
    }
    // mass → thrust: rearmost particles become a jet of spent light
    if (cost > 0 && G.massCosts !== false) {
      jet.sort((a, b) => a[0] - b[0]);
      const J = P.allocBody(-1, 'spent', B.mat);
      if (J) {
        J.fuseT = 0.45; J.tint = B.tint;
        for (let k = 0; k < Math.min(cost, jet.length - 4); k++) {
          const i = jet[k][1];
          P.body[i] = J.id;
          P.vx[i] = -dx * (180 + Math.random() * 160) + (Math.random() - 0.5) * 120 + B.vx * 0.2;
          P.vy[i] = -dy * (180 + Math.random() * 160) + (Math.random() - 0.5) * 120 + B.vy * 0.2;
          P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
          P.life[i] = 1.6 + Math.random() * 0.5; P.glow[i] = 1.5;
        }
      }
    }
    this.dartCD = 0.32; this.dartT = 0.28; this.peelT = 0.2;
    this.excite = Math.min(1, this.excite + 0.5);
    for (const F of this.feel) F.s *= 0.2;
    G.onDart && G.onDart(this, dx, dy, cost);
    return true;
  }

  // bud: eject a sibling droplet toward (tx,ty)
  bud(tx, ty, frac = 0.4) {
    const G = this.G, P = G.phys, B = this.B;
    const n = B.count;
    const k = Math.max(4, Math.round(n * frac));
    if (n - k < 4) return null;
    let dx = tx - B.cx, dy = ty - B.cy; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    // the k particles nearest the "bud point" just beyond the surface
    const bx = B.cx + dx * B.r * 1.4, by = B.cy + dy * B.r * 1.4;
    const arr = [];
    for (let q = 0; q < B.len; q++) { const i = P.bodyIdx[B.start + q]; const ex = P.x[i] - bx, ey = P.y[i] - by; arr.push([ex * ex + ey * ey, i]); }
    arr.sort((a, b) => a[0] - b[0]);
    const NB = P.allocBody(B.group, 'fragment', B.mat);
    if (!NB) return null;
    NB.fuseT = 1.1; B.fuseT = Math.max(B.fuseT, 1.1); NB.tint = B.tint; NB.layer = B.layer;
    const sp = Math.min(520, 260 + m * 0.6);
    for (let q = 0; q < k; q++) {
      const i = arr[q][1];
      P.body[i] = NB.id;
      P.vx[i] = B.vx * 0.3 + dx * sp; P.vy[i] = B.vy * 0.3 + dy * sp;
      P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
      P.glow[i] = 1.2;
    }
    // recoil on the parent
    for (let q = k; q < arr.length; q++) { const i = arr[q][1]; P.vx[i] -= dx * 90; P.vy[i] -= dy * 90; }
    P.forceComponents = true;
    NB.count = k;
    G.onBud && G.onBud(this, NB, dx, dy);
    return NB;
  }
}

// Absorb nearby neutral dew automatically (dew homes toward living bodies)
export function dewHoming(P, bodies, dt, targets) {
  for (const D of bodies) {
    if (!D.alive || D.group !== -1 || D.kind === 'spent') continue;   // spent light must be fetched (a deliberate bluff)
    let best = null, bd = 1e9;
    for (const T of targets) { if (!T.alive) continue; const d = Math.hypot(T.cx - D.cx, T.cy - D.cy) - T.r; if (d < bd) { bd = d; best = T; } }
    if (!best || bd > 240) { D.ax = 0; D.ay = 0; continue; }
    const dx = best.cx - D.cx, dy = best.cy - D.cy, d = Math.hypot(dx, dy) + 1;
    const s = (1 - bd / 240) * 900;
    D.ax = dx / d * s - D.vx * 1.5; D.ay = dy / d * s - D.vy * 1.5; D.gs = 0.4;
  }
}

export { TAU, MAT };
