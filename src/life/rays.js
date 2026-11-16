// ─────────────────────────────────────────────────────────────────────────────
//  Rays — the creature's crown of living feelers.
//
//  Each ray is a short verlet filament rooted on the gel's skin. At rest they
//  breathe in a slow travelling wave (the silhouette of a little sun); in motion
//  they trail like a comet; given something to want, the nearest ray darts out,
//  touches, and carries it home. They are drawn into the same field as the body,
//  so root fillets melt into the gel and tips pearl like dew.
// ─────────────────────────────────────────────────────────────────────────────
import { TAU, clamp, hash2 } from '../core/util.js';

const NN = 7;                 // nodes per ray
const BINS = 32;              // angular bins of the body's radial profile
export const RAY = { IDLE: 0, REACH: 1, CARRY: 2, GRIP: 3, SNIFF: 4 };

export class Ray {
  constructor(k, n) {
    this.x = new Float32Array(NN); this.y = new Float32Array(NN); this.px = new Float32Array(NN); this.py = new Float32Array(NN);
    this.ang = (k + 0.5) / n * TAU + (hash2(k, n) - 0.5) * 0.35;        // irregular spacing: a hand-drawn sun, not a gear
    this.lk = 0.55 + 0.75 * hash2(k * 7 + 3, n);                         // relative rest length (long/short alternate irregularly)
    this.phase = hash2(k + 11, n * 3) * TAU;
    this.len = 0; this.mode = RAY.IDLE; this.t = 0;
    this.tx = 0; this.ty = 0; this.item = null; this.hold = 0; this.born = false; this.glow = 0;
    this.gx = 0; this.gy = 0;      // grip anchor
  }
}

export class Crown {
  constructor(org) {
    this.O = org; this.rays = []; this.prof = new Float32Array(BINS); this.tmp = new Float32Array(BINS);
    this.count = 0; this.flare = 0; this.furl = 0; this.shimmer = -1;
    this.kind = org.crownKind || 'sun';        // sun · cilia · whips · thorns · none
  }

  // how many rays this much gel grows
  wanted(mass) {
    const k = this.kind;
    if (k === 'none') return 0;
    if (k === 'cilia') return clamp(8 + Math.floor(Math.sqrt(mass) * 0.9), 8, 20);
    if (k === 'whips') return 2;
    if (k === 'thorns') return clamp(6 + Math.floor(Math.sqrt(mass) * 0.5), 6, 12);
    return clamp(4 + Math.floor(Math.sqrt(mass) * 0.62), 3, 13);
  }
  baseLen(R) {
    const k = this.kind;
    if (k === 'cilia') return 7 + R * 0.16;
    if (k === 'whips') return 22 + R * 0.95;
    if (k === 'thorns') return 9 + R * 0.34;
    return 13 + R * 0.74;
  }
  maxReach(R) { return (46 + R * 1.25) * (this.O.reachK || 1); }

  resize(n) {
    if (n === this.count) return;
    const old = this.rays; this.rays = [];
    for (let k = 0; k < n; k++) { const r = new Ray(k, n); if (old[k]) { r.len = Math.min(old[k].len, 6); } this.rays.push(r); }
    this.count = n;
  }

  // radial profile of the body: how far the gel extends in each direction from its centre
  profile() {
    const O = this.O, P = O.W.phys, B = O.B, prof = this.prof, tmp = this.tmp;
    const base = Math.max(3, B.r * 0.55);
    for (let b = 0; b < BINS; b++) tmp[b] = base;
    const idx = P.bodyIdx, x = P.x, y = P.y;
    for (let k = 0; k < B.len; k++) {
      const i = idx[B.start + k]; const dx = x[i] - B.cx, dy = y[i] - B.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = Math.atan2(dy, dx) * (BINS / TAU); if (a < 0) a += BINS;
      const b = a | 0; if (d > tmp[b % BINS]) tmp[b % BINS] = d;
    }
    for (let b = 0; b < BINS; b++) { const l = tmp[(b + BINS - 1) % BINS], m = tmp[b], r = tmp[(b + 1) % BINS]; prof[b] = Math.max(m, (l + m + r) / 3); }
  }
  radiusAt(ang) {
    let a = ang * (BINS / TAU); a = ((a % BINS) + BINS) % BINS; const b = a | 0, f = a - b;
    return this.prof[b] + (this.prof[(b + 1) % BINS] - this.prof[b]) * f;
  }

  // pick the idle ray whose root faces a direction best
  pick(dx, dy, allowBusy = false) {
    const O = this.O; const want = Math.atan2(dy, dx); let best = null, bd = 1e9;
    for (const r of this.rays) {
      if (!allowBusy && r.mode !== RAY.IDLE) continue;
      let d = Math.abs(((r.ang + O.phi - want) % TAU + TAU + Math.PI) % TAU - Math.PI);
      if (d < bd) { bd = d; best = r; }
    }
    return bd < 1.25 ? best : null;
  }

  // per frame, after physics
  update(dt) {
    const O = this.O, B = O.B, W = O.W, P = W.phys;
    const want = this.wanted(B.count) * (O.dormant ? 0 : 1);
    if (want !== this.count) this.resize(want);
    if (!this.count) return;
    this.profile();
    const R = B.r; const baseLen = this.baseLen(R);
    this.flare = Math.max(0, this.flare - dt * 1.6);
    const furlT = O.stealth ? 1 : Math.max(O.dartT > 0 ? 0.7 : 0, (O.coil || 0) * 0.8);
    this.furl += (furlT - this.furl) * Math.min(1, dt * (furlT > this.furl ? 10 : 4));
    if (this.shimmer >= 0) { this.shimmer += dt * 9; if (this.shimmer > TAU + 2) this.shimmer = -1; }
    const time = W.time;
    const speed = Math.hypot(B.vx, B.vy);
    const thorn = this.kind === 'thorns', whip = this.kind === 'whips';
    const stiffK = thorn ? 60 : whip ? 5 : 15;
    const drag = Math.exp(-dt * (whip ? 2.2 : 5.5));
    const maxReach = this.maxReach(R);
    for (const r of this.rays) {
      r.t += dt;
      const a = r.ang + O.phi;
      const rad = this.radiusAt(a) - 2.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = B.cx + ca * rad, ry = B.cy + sa * rad;
      if (!r.born) { for (let i = 0; i < NN; i++) { r.x[i] = r.px[i] = rx; r.y[i] = r.py[i] = ry; } r.born = true; }
      // ── length & intent of this ray ──
      let target = baseLen * r.lk * (1 + 0.55 * this.flare) * (1 - 0.94 * this.furl);
      // crown shimmer: a wave of joy runs once around the body
      if (this.shimmer >= 0) { let d = ((a - this.shimmer) % TAU + TAU) % TAU; if (d > Math.PI) d = TAU - d; target *= 1 + 0.7 * Math.exp(-d * d * 6); }
      // breathing: slow swell of the whole crown plus each ray's own little tide
      target *= 1 + 0.10 * Math.sin(time * 1.25 + r.phase) + 0.06 * Math.sin(time * 0.6);
      let dirx = ca, diry = sa, pull = 0, ext = 60;
      if (r.mode === RAY.REACH || r.mode === RAY.SNIFF) {
        if (r.item && (r.item.dead || r.item.held && r.item.held !== r)) { r.item = null; r.mode = RAY.IDLE; }
        else {
          if (r.item) { r.tx = r.item.x; r.ty = r.item.y; }
          const dx = r.tx - rx, dy = r.ty - ry; const d = Math.hypot(dx, dy) + 1e-3;
          if (d > maxReach * 1.15 || (r.hold -= dt) <= 0) { if (r.item) r.item.shy = W.time + 0.5; r.mode = RAY.IDLE; r.item = null; }
          else { target = Math.min(maxReach, d * 1.04); dirx = dx / d; diry = dy / d; pull = r.mode === RAY.SNIFF ? 30 : 95; ext = 520; }
        }
      } else if (r.mode === RAY.CARRY) {
        target = 0; ext = 330;
        if (r.len < 7 || !r.item || r.item.dead) { if (r.item && !r.item.dead) r.item.absorb(O, r); r.item = null; r.mode = RAY.IDLE; r.glow = 1; }
      } else if (r.mode === RAY.GRIP) {
        const dx = r.gx - rx, dy = r.gy - ry; const d = Math.hypot(dx, dy) + 1e-3;
        if (d > maxReach * 1.3 || (r.hold -= dt) <= 0) r.mode = RAY.IDLE;
        else { target = d; dirx = dx / d; diry = dy / d; pull = 0; ext = 600; }
      }
      r.len += clamp(target - r.len, -ext * dt * (r.mode === RAY.IDLE ? 0.55 : 1), ext * dt);
      r.glow = Math.max(0, r.glow - dt * 2.2);
      const seg = r.len / (NN - 1);
      // ── verlet with a pose spring: supple at rest, trailing in motion ──
      r.x[0] = rx; r.y[0] = ry;
      const sway = (thorn ? 0.03 : 0.16) * (1 - this.furl), lag = whip ? 0.9 : 0.55;
      for (let i = 1; i < NN; i++) {
        const u = i / (NN - 1);
        let vx = (r.x[i] - r.px[i]) * drag, vy = (r.y[i] - r.py[i]) * drag;
        r.px[i] = r.x[i]; r.py[i] = r.y[i];
        let x = r.x[i] + vx, y = r.y[i] + vy;
        // rest pose: a straight ray with a travelling ripple (stronger toward the tip)
        const wv = Math.sin(time * 2.1 + r.phase - u * 2.6) * sway * u;
        const px_ = rx + (dirx - diry * wv) * seg * i, py_ = ry + (diry + dirx * wv) * seg * i;
        const k = Math.min(1, stiffK * (1 - lag * u) * dt * (r.mode === RAY.IDLE ? 1 : 1.6));
        x += (px_ - x) * k; y += (py_ - y) * k;
        r.x[i] = x; r.y[i] = y;
      }
      if (pull > 0) {         // the tip wants its target (darting, then settling)
        const i = NN - 1; const k = Math.min(1, pull * dt * 0.2);
        r.x[i] += (r.tx - r.x[i]) * k; r.y[i] += (r.ty - r.y[i]) * k;
      }
      if (r.mode === RAY.GRIP) { r.x[NN - 1] = r.gx; r.y[NN - 1] = r.gy; }
      // length constraints, root outward (two sweeps keep it rope-true without killing the lag)
      for (let it = 0; it < 2; it++) for (let i = 1; i < NN; i++) {
        const dx = r.x[i] - r.x[i - 1], dy = r.y[i] - r.y[i - 1]; const d = Math.sqrt(dx * dx + dy * dy) + 1e-5;
        const f = seg / d; r.x[i] = r.x[i - 1] + dx * f; r.y[i] = r.y[i - 1] + dy * f;
      }
      // walls: feelers splay along surfaces instead of passing through
      if (P.sdf && r.len > 4) for (let i = 2; i < NN; i++) {
        const d = P.sampleSDF(r.x[i], r.y[i]);
        if (d < 2.5) { const n = P.sdfNormal(r.x[i], r.y[i], NRM); const push = 2.5 - d; r.x[i] += n[0] * push; r.y[i] += n[1] * push; }
      }
      // carried things ride the tip
      if (r.mode === RAY.CARRY && r.item) { r.item.x = r.x[NN - 1]; r.item.y = r.y[NN - 1]; }
      else if (r.mode === RAY.REACH && r.item) {
        const dx = r.item.x - r.x[NN - 1], dy = r.item.y - r.y[NN - 1];
        if (dx * dx + dy * dy < (r.item.r + 5) * (r.item.r + 5)) { r.item.held = r; r.mode = RAY.CARRY; r.glow = 1; O.onGrab && O.onGrab(r.item); }
      }
    }
  }

  // send the best-placed idle ray after something (item = pickup entity, or null for a bare point)
  reach(x, y, item = null, hold = 1.4, mode = RAY.REACH) {
    const B = this.O.B; const r = this.pick(x - B.cx, y - B.cy);
    if (!r) return null;
    r.mode = mode; r.tx = x; r.ty = y; r.item = item; r.hold = hold;
    return r;
  }
  startle(a = 1) { this.flare = Math.max(this.flare, a); }
  joy() { if (this.shimmer < 0) this.shimmer = 0; }

  // emit strokes into the creature's fluid cluster: each ray is a tapering arm of the same gel —
  // a broad root that melts into the body (so the silhouette is a soft star, never a ball with pins),
  // a long fine reach, and a dew-pearl at the tip that carries the light
  draw(Rn, C) {
    if (!this.count) return;
    const O = this.O, B = O.B;
    const R = B.r;
    const thorn = this.kind === 'thorns', cilia = this.kind === 'cilia', whip = this.kind === 'whips';
    const w0 = thorn ? 2.6 + R * 0.10 : cilia ? 1.6 + R * 0.03 : whip ? 3.2 + R * 0.09 : 2.4 + R * 0.165;
    const w1 = thorn ? 0.5 : cilia ? 1.0 : 1.25;
    const pw = thorn ? 1.25 : whip ? 1.5 : 2.1;                 // how quickly the arm slims
    const veil = O.veil || 0;
    const SUB = 3;
    for (const r of this.rays) {
      if (r.len < 2.5) continue;
      const busy = r.mode !== RAY.IDLE ? 1 : 0;
      const tipGlow = (0.95 + 0.9 * r.glow + 0.5 * busy) * (1 - veil);
      const full = Math.min(1, r.len / 14);                    // a ray being born or furled is slim all along
      const wr = w1 + (w0 - w1) * full;
      // the root: a short buried stroke from inside the body out to the first node
      const ix = B.cx + (r.x[0] - B.cx) * 0.72, iy = B.cy + (r.y[0] - B.cy) * 0.72;
      Rn.addStroke(C, ix, iy, r.x[0], r.y[0], wr * 1.12, wr, 0.18);
      // Catmull–Rom through the nodes
      let lx = r.x[0], ly = r.y[0], lw = wr, lu = 0;
      for (let i = 0; i < NN - 1; i++) {
        const i0 = i > 0 ? i - 1 : 0, i3 = i < NN - 2 ? i + 2 : NN - 1;
        for (let q = 1; q <= SUB; q++) {
          const t = q / SUB, t2 = t * t, t3 = t2 * t;
          const x = 0.5 * ((2 * r.x[i]) + (-r.x[i0] + r.x[i + 1]) * t + (2 * r.x[i0] - 5 * r.x[i] + 4 * r.x[i + 1] - r.x[i3]) * t2 + (-r.x[i0] + 3 * r.x[i] - 3 * r.x[i + 1] + r.x[i3]) * t3);
          const y = 0.5 * ((2 * r.y[i]) + (-r.y[i0] + r.y[i + 1]) * t + (2 * r.y[i0] - 5 * r.y[i] + 4 * r.y[i + 1] - r.y[i3]) * t2 + (-r.y[i0] + 3 * r.y[i] - 3 * r.y[i + 1] + r.y[i3]) * t3);
          const u = (i + t) / (NN - 1);
          const w = w1 + (wr - w1) * Math.pow(1 - u, pw);
          Rn.addStroke(C, lx, ly, x, y, lw, w, 0.18 + (tipGlow - 0.18) * lu * lu);
          lx = x; ly = y; lw = w; lu = u;
        }
      }
      // pearl at the tip (a thorn ends in a point instead)
      if (!thorn) { const pr = w1 * (cilia ? 1.25 : 1.75) + (r.mode === RAY.CARRY ? 1.3 : 0) + 0.6 * r.glow; Rn.addDot(C, r.x[NN - 1], r.y[NN - 1], pr * Math.min(1, r.len / 9), tipGlow * 1.5); }
    }
  }
}
const NRM = [0, 0];
export { NN };
