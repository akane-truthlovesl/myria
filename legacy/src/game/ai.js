// ─────────────────────────────────────────────────────────────────────────────
//  BLOOM ecology — minds for the other lights in the dish.
//  Each archetype has one readable personality and at least one honest tell,
//  so every hunt can be read, dodged, baited or turned around.
// ─────────────────────────────────────────────────────────────────────────────
import { MAT, M, PHASE } from '../engine/materials.js';

const TAU = Math.PI * 2;
const tmp = [0, 0];

// ── catalog ────────────────────────────────────────────────────────────────
// mass: [min,max] as a multiple of the player's mass (rel) or absolute (abs)
export const ARCH = {
  glimmer: { name: 'Glimmerling', plural: 'glimmerlings', mat: MAT.RIVAL, abs: [7, 20], capAbs: 28, speed: 1.25, tonus: 36,
    tint: { absorb: [0.85, 0.2, 0.04], emit: [0.25, 0.85, 1.0] }, ring: [0.6, 0.95, 1.0] },
  grazer: { name: 'Grazer', plural: 'grazers', mat: MAT.RIVAL, rel: [0.35, 0.8], min: 24, cap: 1.7, speed: 0.78, tonus: 30,
    tint: { absorb: [0.7, 0.05, 0.75], emit: [0.55, 1.0, 0.3] }, ring: [0.7, 1.0, 0.6] },
  hunter: { name: 'Lancer', plural: 'lancers', mat: MAT.RIVAL, rel: [0.75, 1.45], min: 40, cap: 2.2, speed: 1.16, tonus: 32, predator: true,
    tint: { absorb: [0.02, 1.2, 0.55], emit: [1.0, 0.16, 0.42] }, ring: [1.0, 0.35, 0.45] },
  oil: { name: 'Oilbead', plural: 'oilbeads', mat: MAT.OIL, rel: [0.5, 1.2], min: 30, cap: 1.3, speed: 0.55, tonus: 26, ring: [1.0, 0.8, 0.4] },
  thorn: { name: 'Bristleback', plural: 'bristlebacks', mat: MAT.THORN, rel: [0.7, 1.15], min: 45, cap: 1.8, speed: 0.95, tonus: 38, predator: true,
    tint: { absorb: [1.0, 0.12, 0.35], emit: [0.15, 1.0, 0.8] }, ring: [0.4, 1.0, 0.85] },
  puffer: { name: 'Puffer', plural: 'puffers', mat: MAT.RIVAL, rel: [0.2, 0.42], min: 14, cap: 1.5, speed: 0.72, tonus: 40,
    tint: { absorb: [0.05, 0.25, 1.0], emit: [1.0, 0.82, 0.25] }, ring: [1.0, 0.9, 0.5] },
  siphon: { name: 'Lamprey', plural: 'lampreys', mat: MAT.RIVAL, rel: [0.35, 0.65], min: 22, cap: 2.0, speed: 0.95, tonus: 28,
    tint: { absorb: [0.7, 1.0, 0.06], emit: [0.62, 0.25, 1.0] }, ring: [0.75, 0.5, 1.0] },
  mimic: { name: 'Mimic', plural: 'mimics', mat: MAT.RIVAL, rel: [0.6, 1.05], min: 36, cap: 1.8, speed: 1.12, tonus: 34, predator: true,
    tint: { absorb: [0.03, 0.4, 0.95], emit: [1.0, 0.7, 0.3] }, ring: [1.0, 0.75, 0.45] },
  rival: { name: 'Rival Myria', plural: 'rivals', mat: MAT.RIVAL, rel: [0.8, 1.3], min: 50, cap: 2.4, speed: 1.04, tonus: 30, predator: true, ring: [0.7, 0.85, 1.0] },
  ferro: { name: 'Iron Bead', plural: 'iron beads', mat: MAT.FERRO, rel: [0.4, 0.9], min: 30, cap: 1.3, speed: 0.6, tonus: 30, ring: [0.75, 0.8, 1.0] },
  leviathan: { name: 'Leviathan', plural: 'leviathans', mat: MAT.RIVAL, abs: [700, 900], speed: 0.62, tonus: 26,
    tint: { absorb: [1.0, 0.6, 0.08], emit: [0.2, 0.45, 1.0] }, ring: [0.5, 0.7, 1.0] },
  fragment: { name: 'Shard', plural: 'shards', mat: MAT.RIVAL, abs: [6, 30], cap: 1.4, speed: 1.0, tonus: 34, ring: [1, 1, 1] },
};

export const RIVAL_TINTS = [
  { absorb: [0.9, 0.2, 0.02], emit: [0.2, 0.8, 1.0] },     // cyan
  { absorb: [0.35, 0.95, 0.04], emit: [0.7, 0.35, 1.0] },  // violet
  { absorb: [0.75, 0.03, 0.8], emit: [0.45, 1.0, 0.3] },   // green
  { absorb: [0.02, 0.2, 1.1], emit: [1.0, 0.78, 0.2] },    // gold
];

export function phaseOf(B) { return M.phase[B.mat]; }

// ── steering helpers ───────────────────────────────────────────────────────
function norm(x, y, cap = 1) { const m = Math.hypot(x, y); if (m > cap) { x *= cap / m; y *= cap / m; } return [x, y]; }

export function avoidWalls(W, B, dx, dy, look = 120) {
  const P = W.G.phys;
  const m = Math.hypot(dx, dy) || 1; const ux = dx / m, uy = dy / m;
  let ax = 0, ay = 0;
  for (let k = -1; k <= 1; k++) {
    const c = Math.cos(k * 0.6), s = Math.sin(k * 0.6);
    const px = ux * c - uy * s, py = ux * s + uy * c;
    const L = B.r + look * (k === 0 ? 1 : 0.7);
    const sx = B.cx + px * L, sy = B.cy + py * L;
    const d = P.sampleSDF(sx, sy);
    if (d < 46) { P.sdfNormal(sx, sy, tmp); const w = (46 - d) / 46 * (k === 0 ? 1.4 : 0.9); ax += tmp[0] * w; ay += tmp[1] * w; }
  }
  // a black hole is a wall you cannot see the bottom of
  if (W.hole) { const hx = B.cx - W.hole.x, hy = B.cy - W.hole.y, hd = Math.hypot(hx, hy) + 1; if (hd < 360 + B.r) { const k = (360 + B.r - hd) / 360 * 2.2; ax += hx / hd * k; ay += hy / hd * k; } }
  // the rim of the dish: soft inward pressure
  const rr = Math.hypot(B.cx, B.cy);
  if (rr > W.dishR - 200 - B.r) { const k = (rr - (W.dishR - 200 - B.r)) / 200; ax -= B.cx / rr * k * 1.2; ay -= B.cy / rr * k * 1.2; }
  return [dx + ax, dy + ay];
}

class Brain {
  constructor(W, arch) { this.W = W; this.arch = arch; this.t = Math.random() * 10; this.wa = Math.random() * TAU; this.cd = 1 + Math.random() * 2; this.state = 'idle'; this.target = null; this.mood = 0; }
  fresh(a) { if (!a) return null; for (const b of this.W.agents) if (b.B === a.B) return b.B.alive ? b : null; return null; }
  wander(dt, rate = 1) { this.wa += (Math.sin(this.t * 0.7 + this.wa) * 0.6 + (Math.random() - 0.5) * 2.4) * rate * dt; return [Math.cos(this.wa), Math.sin(this.wa)]; }
  // aggregate flight vector from things that can eat me
  fear(O, range, k = 1.25) {
    const B = O.B; let fx = 0, fy = 0, worst = 0, who = null;
    for (const a of this.W.agents) {
      if (a.B === B || a.group === B.group || !this.W.canEatBody(a.B, B)) continue;
      if (a.am < B.count * k) continue;
      const ex = B.cx - a.x, ey = B.cy - a.y; const dc = Math.hypot(ex, ey) + 1e-3; const d = dc - a.r - B.r;
      if (d > range) continue;
      const w = Math.min(1.5, (range - d) / range * (a.lev ? 1.6 : 1) * (a.am / Math.max(1, B.count)) ** 0.25);
      fx += ex / dc * w; fy += ey / dc * w;
      if (w > worst) { worst = w; who = a; }
    }
    return { fx, fy, worst, who };
  }
  // best prey within range (value = mass / distance, player-weighted)
  prey(O, range, k = 0.85, pw = 1.3) {
    const B = O.B; let best = null, bv = 0;
    for (const a of this.W.agents) {
      if (a.B === B || a.group === B.group || a.disguised) continue;
      if (!this.W.canEatAgent(B, a)) continue;
      if (a.am > B.count * k) continue;
      const d = Math.hypot(a.x - B.cx, a.y - B.cy) - a.r - B.r;
      if (d > range) continue;
      const v = (a.m + 6) / (d + 120) * (a.isPlayer ? pw : 1) * (a.shell ? 0.1 : 1);
      if (v > bv) { bv = v; best = a; }
    }
    return best;
  }
  apply(O, dx, dy, mag = 1) {
    const B = O.B;
    [dx, dy] = avoidWalls(this.W, B, dx, dy);
    [dx, dy] = norm(dx, dy, 1);
    const m = Math.hypot(dx, dy) || 1;
    O.intent.x = dx / m * Math.min(1, mag); O.intent.y = dy / m * Math.min(1, mag);
  }
}

// ── Glimmerling: twitchy schooling prey ───────────────────────────────────
export class GlimmerBrain extends Brain {
  think(O, dt) {
    this.t += dt; this.cd -= dt;
    const W = this.W, B = O.B;
    const F = this.fear(O, 260, 1.15);
    let dx = 0, dy = 0, mag = 0.55;
    // schooling: cohesion, alignment, separation with kin
    let cx = 0, cy = 0, ax = 0, ay = 0, n = 0, sx = 0, sy = 0;
    for (const a of W.agents) {
      if (a.arch !== 'glimmer' || a.B === B) continue;
      const ex = a.x - B.cx, ey = a.y - B.cy; const d = Math.hypot(ex, ey);
      if (d > 220) continue;
      cx += ex; cy += ey; ax += a.vx; ay += a.vy; n++;
      if (d < B.r + a.r + 22) { sx -= ex / (d + 1); sy -= ey / (d + 1); }
    }
    const [wx, wy] = this.wander(dt, 1.6);
    dx = wx * 0.5; dy = wy * 0.5;
    if (n) { dx += cx / n * 0.004 + ax / n * 0.0025 + sx * 1.2; dy += cy / n * 0.004 + ay / n * 0.0025 + sy * 1.2; }
    if (F.worst < 0.25) { const m = W.nearestMote(B.cx, B.cy, 240); if (m) { const ex = m.x - B.cx, ey = m.y - B.cy, d = Math.hypot(ex, ey) + 1; dx += ex / d * 0.9; dy += ey / d * 0.9; mag = 0.7; } }
    if (F.worst > 0) { dx += F.fx * 2.4; dy += F.fy * 2.4; mag = 0.7 + F.worst * 0.5; }
    if (F.worst > 0.85 && this.cd <= 0 && B.count > 7) { O.dart(F.fx + (Math.random() - 0.5) * 0.6, F.fy + (Math.random() - 0.5) * 0.6, 0.8); this.cd = 2.2 + Math.random() * 1.5; }
    this.apply(O, dx, dy, mag);
  }
}

// ── Grazer: calm wanderer of mote meadows ─────────────────────────────────
export class GrazerBrain extends Brain {
  think(O, dt) {
    this.t += dt; this.cd -= dt;
    const W = this.W, B = O.B;
    const F = this.fear(O, 230, 1.35);
    let [dx, dy] = this.wander(dt, 0.7); let mag = 0.42;
    const m = W.nearestMote(B.cx, B.cy, 420);
    if (m) { const ex = m.x - B.cx, ey = m.y - B.cy, d = Math.hypot(ex, ey) + 1; dx = dx * 0.3 + ex / d; dy = dy * 0.3 + ey / d; mag = 0.55; }
    const p = this.prey(O, 140, 0.55, 1.0);
    if (p && F.worst < 0.3) { dx = p.x - B.cx; dy = p.y - B.cy; mag = 0.75; }
    if (F.worst > 0) { dx += F.fx * 2; dy += F.fy * 2; mag = 0.6 + F.worst * 0.4; if (F.worst > 0.9 && this.cd <= 0) { O.dart(F.fx, F.fy, 0.8); this.cd = 3.5; } }
    this.apply(O, dx, dy, mag);
  }
}

// ── Lancer: stalks, coils (honest tell), lunges, recovers ─────────────────
export class HunterBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.state = 'prowl'; this.coil = 0; this.recover = 0; }
  think(O, dt) {
    this.t += dt; this.cd -= dt; this.recover = Math.max(0, this.recover - dt);
    const W = this.W, B = O.B;
    const F = this.fear(O, 280, 1.3);
    if (F.worst > 0.45 && this.state !== 'lunge') { this.state = 'flee'; }
    if (this.state === 'flee') {
      this.apply(O, F.fx * 2 + Math.cos(this.wa) * 0.2, F.fy * 2 + Math.sin(this.wa) * 0.2, 0.95);
      if (F.worst > 1.0 && this.cd <= 0) { O.dart(F.fx, F.fy, 1); this.cd = 2.5; }
      if (F.worst < 0.15) this.state = 'prowl';
      this.coil = 0; return;
    }
    // reacquire prey (keep a fresh view of the current one)
    this.target = this.fresh(this.target);
    if (!this.target || this.t % 1.2 < dt) this.target = this.prey(O, 700, 0.88, 1.6);
    const T = this.target;
    if (!T || this.recover > 0) {
      const [wx, wy] = this.wander(dt, 0.8);
      const m = W.nearestMote(B.cx, B.cy, 300);
      if (m && !T) this.apply(O, m.x - B.cx + wx * 30, m.y - B.cy + wy * 30, 0.5);
      else this.apply(O, wx, wy, this.recover > 0 ? 0.3 : 0.5);
      this.state = 'prowl'; this.coil = 0; return;
    }
    const ex = T.x - B.cx, ey = T.y - B.cy; const dc = Math.hypot(ex, ey) + 1; const gap = dc - T.r - B.r;
    if (this.state === 'coil') {
      // tell: stop, tremble, brighten — then strike at the predicted point
      this.coil += dt;
      O.intent.x = 0; O.intent.y = 0; O.excite = 1; B.energy = Math.min(1.4, (B.energy || 0) + dt * 3);
      O.facing.x = ex / dc; O.facing.y = ey / dc;
      if (this.coil > 0.55) {
        const lead = Math.min(0.45, dc / 900);
        O.dart(ex + T.vx * lead, ey + T.vy * lead, 1.15);
        this.state = 'lunge'; this.coil = 0; this.lungeT = 0.6; this.cd = 1.4;
      }
      return;
    }
    if (this.state === 'lunge') { this.lungeT -= dt; this.apply(O, ex, ey, 1); if (this.lungeT <= 0) { this.state = 'stalk'; this.recover = 1.1; } return; }
    // stalk: close in while circling, then coil when in striking range
    const side = (this.t * 0.5 % 2 < 1) ? 1 : -1;
    let dx = ex / dc, dy = ey / dc;
    if (gap < 220) { dx += -ey / dc * 0.6 * side; dy += ex / dc * 0.6 * side; }
    this.apply(O, dx, dy, gap > 260 ? 0.85 : 0.55);
    this.state = 'stalk';
    if (gap < 300 && gap > 30 && this.cd <= 0 && O.dartCD <= 0) { this.state = 'coil'; this.coil = 0; }
  }
}

// ── Oilbead: heavy, immiscible, shoves gels around ────────────────────────
export class OilBrain extends Brain {
  think(O, dt) {
    this.t += dt;
    const W = this.W, B = O.B;
    let [dx, dy] = this.wander(dt, 0.35);
    // drawn to bump things — a living hazard rather than a hunter
    let best = null, bd = 260;
    for (const a of W.agents) { if (a.B === B || a.phase === PHASE.LIPID) continue; const d = Math.hypot(a.x - B.cx, a.y - B.cy) - a.r - B.r; if (d < bd) { bd = d; best = a; } }
    if (best && Math.sin(this.t * 0.4 + this.wa) > -0.2) { dx = dx * 0.4 + (best.x - B.cx) / (bd + B.r + best.r); dy = dy * 0.4 + (best.y - B.cy) / (bd + B.r + best.r); }
    this.apply(O, dx, dy, 0.42);
  }
}

// ── Bristleback: a breathing crown of thorns ──────────────────────────────
export class ThornBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.cycle = Math.random() * 3.4; this.ext = 1; this.spiky = true; }
  think(O, dt) {
    this.t += dt; this.cd -= dt;
    this.cycle = (this.cycle + dt) % 3.6;
    const was = this.spiky;
    // 0–2.3s bristled, 2.3–3.6s smooth (vulnerable)
    this.spiky = this.cycle < 2.3;
    const want = this.spiky ? 1 : 0;
    this.ext += (want - this.ext) * Math.min(1, dt * (want ? 9 : 5));
    if (this.spiky && !was) this.W.onBristle && this.W.onBristle(O);
    const W = this.W, B = O.B;
    const F = this.fear(O, 240, 1.5);
    const p = this.prey(O, 340, 1.4, 1.5); // with thorns out it bullies even slightly bigger
    let [dx, dy] = this.wander(dt, 0.6); let mag = 0.45;
    if (this.spiky && p) { dx = p.x - B.cx; dy = p.y - B.cy; mag = 0.9; if (this.cd <= 0 && Math.hypot(dx, dy) < 200 + B.r + p.r) { O.dart(dx, dy, 0.9); this.cd = 3; } }
    else if (!this.spiky && F.worst > 0) { dx = F.fx; dy = F.fy; mag = 0.9; }
    else if (!this.spiky) { const m = W.nearestMote(B.cx, B.cy, 260); if (m) { dx = m.x - B.cx; dy = m.y - B.cy; mag = 0.5; } }
    this.apply(O, dx, dy, mag);
  }
}

// ── Puffer: bluffs size with an iridescent air shell ──────────────────────
export class PufferBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.bluff = 1; this.target = 1; this.stun = 0; this.popped = false; }
  think(O, dt) {
    this.t += dt;
    const W = this.W, B = O.B;
    this.stun = Math.max(0, this.stun - dt);
    if (this.stun > 0) { O.intent.x = 0; O.intent.y = 0; this.target = 1; this.bluff += (1 - this.bluff) * Math.min(1, dt * 6); O.excite = 0.6; return; }
    // anything bigger nearby → puff up
    let threat = 0, tx = 0, ty = 0;
    for (const a of W.agents) {
      if (a.B === B || a.group === B.group || a.phase !== PHASE.AQUA) continue;
      if (a.am < B.count * 1.1) continue;
      const d = Math.hypot(a.x - B.cx, a.y - B.cy) - a.r - B.r;
      if (d < 300) { const w = 1 - d / 300; if (w > threat) { threat = w; tx = B.cx - a.x; ty = B.cy - a.y; } }
    }
    this.target = threat > 0.05 ? 2.7 : 1;
    this.bluff += (this.target - this.bluff) * Math.min(1, dt * (this.target > this.bluff ? 5 : 1.2));
    let [dx, dy] = this.wander(dt, 0.6); let mag = 0.4;
    if (threat > 0) { dx = tx; dy = ty; mag = 0.55; } // dignified retreat: bluffing beats running
    else { const m = W.nearestMote(B.cx, B.cy, 260); if (m) { dx = m.x - B.cx; dy = m.y - B.cy; mag = 0.5; } }
    this.apply(O, dx, dy, mag);
  }
}

// ── Lamprey: latches from range and siphons light along a strand ──────────
export class SiphonBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.latch = null; this.latchT = 0; this.cool = 1; }
  think(O, dt) {
    this.t += dt; this.cool = Math.max(0, this.cool - dt);
    const W = this.W, B = O.B;
    const F = this.fear(O, 200, 1.0);
    // a target turning on me while bigger → let go and flee
    if (this.latch) {
      const T = this.fresh(this.latch);
      if (!T) { this.release(); }
      else {
        const ex = T.x - B.cx, ey = T.y - B.cy; const d = Math.hypot(ex, ey);
        this.latchT += dt;
        const closing = -((T.vx - B.vx) * ex + (T.vy - B.vy) * ey) / (d + 1);
        this.latch = T;
        if (d > 340 || (T.am > B.count * 1.2 && closing > 160 && d < 200)) { this.release(T.dartT > 0 ? 'snap' : 'slip'); }
        else {
          // keep a hunting distance: close enough to drink, far enough to bolt
          const want = 170 + T.r;
          const k = (d - want) / 120;
          this.apply(O, ex / (d + 1) * k + F.fx, ey / (d + 1) * k + F.fy, Math.min(1, Math.abs(k) + 0.25));
          return;
        }
      }
    }
    if (F.worst > 0.3) { this.apply(O, F.fx, F.fy, 0.9); return; }
    // seek something juicy (bigger than me is fine — that's the point)
    let best = null, bv = 0;
    for (const a of W.agents) {
      if (a.B === B || a.group === B.group || a.phase !== PHASE.AQUA || a.disguised || a.arch === 'siphon') continue;
      const d = Math.hypot(a.x - B.cx, a.y - B.cy);
      if (d > 620) continue;
      const v = (a.m) / (d + 200) * (a.isPlayer ? 2.2 : 1);
      if (v > bv) { bv = v; best = a; }
    }
    if (best) {
      const ex = best.x - B.cx, ey = best.y - B.cy; const d = Math.hypot(ex, ey);
      if (d < 270 && this.cool <= 0) { this.latch = best; this.latchT = 0; W.onLatch && W.onLatch(O, best); }
      this.apply(O, ex, ey, 0.7);
    } else { const [wx, wy] = this.wander(dt, 0.8); this.apply(O, wx, wy, 0.45); }
  }
  release(kind) { if (this.latch && kind) this.W.onUnlatch && this.W.onUnlatch(this, kind); this.latch = null; this.cool = 2.6; }
}

// ── Mimic: hides as a cluster of motes; honest tell = motes pulse in unison ─
export class MimicBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.disguised = true; this.reveal = 0; this.hunt = 0; this.hideAt = null; }
  think(O, dt) {
    this.t += dt; this.cd -= dt;
    const W = this.W, B = O.B;
    if (this.disguised) {
      O.intent.x = 0; O.intent.y = 0; O.stealth = true;
      // spring when a smaller gel comes close
      for (const a of W.agents) {
        if (a.B === B || a.group === B.group || a.phase !== PHASE.AQUA) continue;
        const d = Math.hypot(a.x - B.cx, a.y - B.cy) - a.r - B.r;
        if (d < 95 && a.am < B.count * 1.1) { this.spring(O, a); break; }
      }
      return;
    }
    O.stealth = false;
    this.hunt -= dt;
    const T = this.target = this.fresh(this.target);
    if (T && this.hunt > 0) {
      const ex = T.x - B.cx, ey = T.y - B.cy;
      this.apply(O, ex, ey, 1);
      if (this.cd <= 0 && Math.hypot(ex, ey) < 260) { O.dart(ex, ey, 1); this.cd = 2.2; }
      return;
    }
    // slink away and re-hide in a quiet spot
    if (!this.hideAt) this.hideAt = W.quietSpot(B);
    const ex = this.hideAt.x - B.cx, ey = this.hideAt.y - B.cy; const d = Math.hypot(ex, ey);
    this.apply(O, ex, ey, 0.7);
    if (d < 50 || this.hunt < -9) { this.disguised = true; this.hideAt = null; W.onHide && W.onHide(O); }
  }
  spring(O, a, seen = false) {
    this.disguised = false; this.hunt = seen ? 0.5 : 4.5; this.target = a; this.cd = seen ? 2 : 0;
    O.stealth = false;
    if (!seen) { const B = O.B; O.dart(a.x - B.cx, a.y - B.cy, 1.1); }
    this.W.onReveal && this.W.onReveal(O, a, seen);
  }
}

// ── Rival Myria: plays like you — grazes, hunts, darts, buds decoys ───────
export class RivalBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.budCD = 6; }
  think(O, dt) {
    this.t += dt; this.cd -= dt; this.budCD -= dt;
    const W = this.W, B = O.B;
    const F = this.fear(O, 300, 1.2);
    let [dx, dy] = this.wander(dt, 0.7); let mag = 0.5;
    if (F.worst > 0.25) {
      dx = F.fx; dy = F.fy; mag = 1;
      if (F.worst > 0.9 && this.cd <= 0) { O.dart(F.fx, F.fy, 1); this.cd = 2.2; }
      // cornered: shed a decoy toward the predator
      if (F.worst > 1.1 && this.budCD <= 0 && B.count > 60 && F.who) { const NB = O.bud(F.who.x, F.who.y, 0.22); if (NB) W.adoptAIBud(O, NB, 'fragment'); this.budCD = 9; }
    } else {
      const p = this.prey(O, 520, 0.82, 1.5);
      if (p) {
        dx = p.x - B.cx; dy = p.y - B.cy; mag = 0.95;
        const d = Math.hypot(dx, dy) - p.r - B.r;
        if (d < 190 && d > 25 && this.cd <= 0) { O.dart(dx + p.vx * 0.25, dy + p.vy * 0.25, 1); this.cd = 2.4; }
      } else {
        const m = W.nearestMote(B.cx, B.cy, 420);
        if (m) { dx = m.x - B.cx; dy = m.y - B.cy; mag = 0.7; }
      }
    }
    this.apply(O, dx, dy, mag);
  }
}

// ── Iron bead: inert, yanked about by pulsing poles ───────────────────────
export class FerroBrain extends Brain {
  think(O, dt) { this.t += dt; const [dx, dy] = this.wander(dt, 0.3); this.apply(O, dx, dy, 0.25); }
}

// ── Leviathan: vast, slow to turn — its trailing flank is its weakness ────
export class LeviathanBrain extends Brain {
  constructor(W, arch) { super(W, arch); this.hx = 1; this.hy = 0; this.roarT = 4; this.state = 'arrive'; }
  think(O, dt) {
    this.t += dt; this.cd -= dt; this.roarT -= dt;
    const W = this.W, B = O.B;
    // choose prey: the player above all, otherwise the biggest edible thing
    let T = null, bv = 0;
    for (const a of W.agents) {
      if (a.B === B || a.group === B.group || a.phase !== PHASE.AQUA || a.am > B.count * 0.95) continue;
      const d = Math.hypot(a.x - B.cx, a.y - B.cy);
      const v = (a.m + 20) / (d + 300) * (a.isPlayer ? 3 : 1);
      if (v > bv) { bv = v; T = a; }
    }
    let wx, wy;
    if (T) { wx = T.x - B.cx; wy = T.y - B.cy; } else { [wx, wy] = this.wander(dt, 0.4); }
    const wm = Math.hypot(wx, wy) || 1; wx /= wm; wy /= wm;
    // ponderous turning (finite turn rate) — outmanoeuvre it to reach its flank
    const turn = 0.75 * dt;
    const cross = this.hx * wy - this.hy * wx, dot = this.hx * wx + this.hy * wy;
    let ang = Math.atan2(cross, dot); ang = Math.max(-turn, Math.min(turn, ang));
    const c = Math.cos(ang), s = Math.sin(ang);
    const nx = this.hx * c - this.hy * s, ny = this.hx * s + this.hy * c; this.hx = nx; this.hy = ny;
    O.facing.x = nx; O.facing.y = ny;
    this.apply(O, nx, ny, T ? 0.9 : 0.55);
    if (T && this.cd <= 0) {
      const d = Math.hypot(T.x - B.cx, T.y - B.cy) - T.r - B.r;
      if (d < 260 && dot > 0.85) { O.dart(nx, ny, 0.9); this.cd = 4.5; W.onRoar && W.onRoar(O); }
    }
    if (this.roarT <= 0) { this.roarT = 7 + Math.random() * 4; W.onRoar && W.onRoar(O, true); }
  }
}

// ── Shard: a torn-off piece that tries to rejoin its kin, else flees ─────
export class FragmentBrain extends Brain {
  constructor(W, arch, parentGroup) { super(W, arch); this.pg = parentGroup; }
  think(O, dt) {
    this.t += dt;
    const W = this.W, B = O.B;
    const F = this.fear(O, 220, 1.1);
    let kin = null, bd = 1e9;
    for (const a of W.agents) { if (a.B !== B && a.group === B.group) { const d = Math.hypot(a.x - B.cx, a.y - B.cy); if (d < bd) { bd = d; kin = a; } } }
    let dx, dy, mag = 0.8;
    if (F.worst > 0.2) { dx = F.fx; dy = F.fy; mag = 1; }
    else if (kin) { dx = kin.x - B.cx; dy = kin.y - B.cy; }
    else { [dx, dy] = this.wander(dt, 1); mag = 0.4; }
    this.apply(O, dx, dy, mag);
  }
}

export const BRAINS = { glimmer: GlimmerBrain, grazer: GrazerBrain, hunter: HunterBrain, oil: OilBrain, thorn: ThornBrain, puffer: PufferBrain, siphon: SiphonBrain, mimic: MimicBrain, rival: RivalBrain, ferro: FerroBrain, leviathan: LeviathanBrain, fragment: FragmentBrain };
