// ─────────────────────────────────────────────────────────────────────────────
//  Living light. Not every light in the dish is a dewdrop waiting to be drunk.
//
//   drift    rides the water — a current, a gyre, the slow breathing of still water,
//            the pull of a well — and so shows you where the water goes
//   shy      a skittish spark: whatever comes at it fast sends it darting away;
//            come slowly and a feeler can take it (what moves gently frightens nothing)
//   shoal    little lights that swim as one; they part round a rushing body and close
//            again behind it, and come to look at something that keeps still
//   firefly  blinks. Each one pulls its neighbours' rhythm toward its own until the whole
//            cloud flashes together; a feeler can only find one while it is lit
//   seed     sleeps inside a pod until something brushes the pod — then bursts out as drift
//
//  Every kind announces itself before contact: its colour, its motion, its rhythm.
//  All of it is ordinary Mote light underneath (worth mass, counted by the room, chained).
// ─────────────────────────────────────────────────────────────────────────────
import { PROF } from '../render/ink.js';
import { TAU } from '../core/util.js';

export const KINDS = {
  drift: { col: [0.70, 0.96, 1.00], value: 2 },
  shy: { col: [0.86, 0.80, 1.00], value: 3 },
  shoal: { col: [0.55, 1.00, 0.76], value: 1 },
  firefly: { col: [0.88, 1.00, 0.44], value: 2 },
  seed: { col: [1.00, 0.66, 0.76], value: 1 },
};
const STILL = { drift: 0, shy: 1, shoal: 0, firefly: 0, seed: 0 };            // kinds that sit in the plate (baked) while nothing troubles them

// ── per-frame list of moving bodies living light can feel: x, y, vx, vy, r, unseen, player (a grazer rushing a shoal scatters it too) ──
const TH = []; let thT = -1, thW = null;
function threats(W) {
  if (thT === W.time && thW === W) return TH; thT = W.time; thW = W; TH.length = 0;
  for (const C of W.colonies) for (const O of C.orgs) { if (!O.alive) continue; const B = O.B; TH.push(B.cx, B.cy, B.vx, B.vy, B.r, O.stealth || O.veil > 0.5 ? 1 : 0, C === W.player ? 1 : 0); }
  return TH;
}

// ── the water at a point: a current's velocity (summed over the zones it is in), a well's pull, and the slow breathing of still water ──
const WV = [0, 0, 0, 0];
export function water(W, x, y, out = WV) {
  let vx = 0, vy = 0, ax = 0, ay = 0; const Z = W.phys.zones;
  for (let z = 0; z < Z.length; z++) {
    const q = Z[z]; if (x < q.x0 || x > q.x1 || y < q.y0 || y > q.y1) continue; const w = q.weight ? q.weight(x, y) : 1; if (w <= 0) continue;
    if (q.flow) { let fx = q.fvx, fy = q.fvy; if (q.flowAt) { const f = q.flowAt(x, y); fx = f[0]; fy = f[1]; } vx += fx * w; vy += fy * w; }
    if (q.attract) { const dx = q.ax - x, dy = q.ay - y, r = Math.hypot(dx, dy) + 1e-3, s = q.soft || 60, f = q.strength * w / (r + s); ax += dx / r * f; ay += dy / r * f; if (q.swirl) { const g = q.swirl * w / (r + s); ax += -dy / r * g; ay += dx / r * g; } }
  }
  out[0] = vx; out[1] = vy; out[2] = ax; out[3] = ay; return out;
}
// a divergence-free swirl (two crossed cells drifting through each other): still water is never quite still
const AMB = [0, 0];
function ambient(x, y, t) {
  const a1 = 0.009 * x + 0.13 * t, b1 = 0.009 * y + 1.7, a2 = 0.0165 * x - 0.09 * t + 2.3, b2 = 0.0165 * y + 0.11 * t;
  AMB[0] = 15 * Math.sin(a1) * Math.cos(b1) + 8 * Math.sin(a2) * Math.cos(b2);
  AMB[1] = -(15 * Math.cos(a1) * Math.sin(b1) + 8 * Math.cos(a2) * Math.sin(b2));
  return AMB;
}

// keep off glass (and off machines): a soft cushion, a gentle bounce that keeps the glide along the wall, a step back out if a machine pushed it in
const NN = [0, 0];
function walls(m, W, dt, margin) {
  const P = W.phys; const d = P.solidAt(m.hx, m.hy); if (d >= margin) return d;
  P.solidNormal(m.hx, m.hy, NN); const nx = NN[0], ny = NN[1];
  if (d < 3) { m.hx += nx * (margin * 0.5 - d); m.hy += ny * (margin * 0.5 - d); }
  const vn = m.vx * nx + m.vy * ny; if (vn < 0) { m.vx -= nx * vn * 1.6; m.vy -= ny * vn * 1.6; }
  const k = (margin - d) / margin; m.vx += nx * k * 900 * dt; m.vy += ny * k * 900 * dt;
  return d;
}
// which way to run: straight away from the threat, unless glass is that way — then the most open water near it
const ES = [0, 0];
function escape(W, x, y, ux, uy) {
  const a0 = Math.atan2(uy, ux); let best = -1e9;
  for (const da of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) { const a = a0 + da, cx = Math.cos(a), cy = Math.sin(a); const s = Math.min(90, W.phys.solidAt(x + cx * 70, y + cy * 70)) - Math.abs(da) * 16; if (s > best) { best = s; ES[0] = cx; ES[1] = cy; } }
  return ES;
}

// ── birth ──────────────────────────────────────────────────────────────────
export function initKind(m, W, d) {
  const K = KINDS[m.kind]; if (!K) { m.kind = null; return; }
  if (!d.col) m.col = K.col; if (d.value === undefined) { m.value = K.value; m.r = 5 + m.value * 0.9; }
  m.living = true; m.free = !STILL[m.kind]; m.vx = d.vx || 0; m.vy = d.vy || 0; m.alarm = 0; m.nerveT = Math.random() * 0.05;
  if (m.kind === 'shoal') {
    const id = d.school || 'school'; let S = W.schools.get(id);
    if (!S) { S = { members: [], hx: d.home ? d.home.x : m.x, hy: d.home ? d.home.y : m.y, range: d.range || 220, path: d.path || null, pk: 0, tx: m.x, ty: m.y, tT: 0, cx: m.x, cy: m.y, cT: -1, scareT: -9, scareX: 0, scareY: 0 }; W.schools.set(id, S); }
    S.members.push(m); m.school = S; const a = Math.random() * TAU; m.vx = Math.cos(a) * 40; m.vy = Math.sin(a) * 40; m.r = 4.6;
  } else if (m.kind === 'firefly') {
    m.ox = m.x; m.oy = m.y; m.phase = d.phase ?? Math.random(); m.omega = m.omega0 = (1 / (d.period || 2.5)) * (0.95 + 0.1 * Math.random()); m.lit = 0; m.dim = true; m.beat = d.beat || 1; W.fireflies.push(m);
  } else if (m.kind === 'seed') {
    m.pod = d.pod || null; if (m.pod) m.spawnT = -1e9;          // asleep in its pod: neither seen nor eaten until the pod bursts
  }
}

// ── life ───────────────────────────────────────────────────────────────────
export function stepKind(m, dt) {
  const k = m.kind;
  if (k === 'drift' || k === 'seed') drift(m, dt);
  else if (k === 'shoal') shoal(m, dt);
  else if (k === 'shy') shy(m, dt);
  else if (k === 'firefly') firefly(m, dt);
}

function drift(m, dt) {
  const W = m.W; if (m.spawnT < 0) return;
  const w = water(W, m.hx, m.hy), a = ambient(m.hx, m.hy, W.time);
  const tvx = w[0] + a[0] + Math.sin(m.t * 0.8 + m.seed * 9) * 7, tvy = w[1] + a[1] + Math.cos(m.t * 0.7 + m.seed * 5) * 7;
  if (m.kick > 0) m.kick -= dt;
  const k = Math.min(1, dt * (m.kick > 0 ? 0.6 : 1.5));            // a seed thrown from its pod coasts a moment before the water takes it
  m.vx += (tvx - m.vx) * k + w[2] * dt * 0.6; m.vy += (tvy - m.vy) * k + w[3] * dt * 0.6;
  walls(m, W, dt, 15);
  m.hx += m.vx * dt; m.hy += m.vy * dt;
}

function shy(m, dt) {
  const W = m.W; m.alarm = Math.max(0, m.alarm - dt * 1.8);
  if (m.free) {
    const dr = Math.max(0, 1 - 2.4 * dt); m.vx *= dr; m.vy *= dr; walls(m, W, dt, 16); m.hx += m.vx * dt; m.hy += m.vy * dt;
    if (m.vx * m.vx + m.vy * m.vy < 160 && m.alarm < 0.15) { m.free = false; m.vx = 0; m.vy = 0; W.settle(m); }      // calm again: back into the plate
  }
  if ((m.nerveT -= dt) > 0) return; m.nerveT = 0.05;
  const T = threats(W);
  for (let i = 0; i < T.length; i += 7) {
    if (T[i + 5]) continue; const dx = m.hx - T[i], dy = m.hy - T[i + 1], d = Math.hypot(dx, dy) + 1, edge = d - T[i + 4]; if (edge > 200) continue;
    const closing = (dx * T[i + 2] + dy * T[i + 3]) / d, sp = Math.hypot(T[i + 2], T[i + 3]);          // (dx, dy) points from the body to the light
    // a body coming at it fast is seen from far off; one drifting past at a walk only up close; one that comes slowly, not at all
    const nerve = closing > 150 ? 175 : closing > 100 ? 120 : sp > 300 ? 64 : 0;
    if (edge < nerve) { startle(m, W, dx / d, dy / d); return; }
  }
}
function startle(m, W, ux, uy) {
  if (m.baked) W.release(m); m.free = true; const e = escape(W, m.hx, m.hy, ux, uy), s = 360 + Math.random() * 90; m.vx = e[0] * s; m.vy = e[1] * s; m.alarm = 1;
  if (m.claim) m.claim = null; m.fled = (m.fled || 0) + 1;
  W.fx.ring(m.hx, m.hy, m.col, 30, 0.32, { a: 0.75, w: 1.6 }); W.fx.sparks(m.hx, m.hy, 3, -e[0], -e[1], m.col, 120, { life: 0.28, size: 2 });
  if (W.sound && W.sound.skitter && (m.W.player && W.isPlayerNear(m.hx, m.hy, 320))) W.sound.skitter(m.hx / W.spec.W * 1.6 - 0.8);
  W.emit('startle', m);
}

function shoal(m, dt) {
  const W = m.W, S = m.school;
  if (S.cT !== W.time) {                                              // once a frame, the school as a whole: where it is, where it is going
    S.cT = W.time; let n = 0, cx = 0, cy = 0; for (const o of S.members) if (!o.dead) { n++; cx += o.hx; cy += o.hy; } if (n) { S.cx = cx / n; S.cy = cy / n; }
    if (S.tT <= W.time || Math.hypot(S.tx - S.cx, S.ty - S.cy) < 40) retarget(S, W);
  }
  let n = 0, cx = 0, cy = 0, avx = 0, avy = 0, sx = 0, sy = 0;
  for (const o of S.members) {
    if (o === m || o.dead) continue; const dx = o.hx - m.hx, dy = o.hy - m.hy, d2 = dx * dx + dy * dy; if (d2 > 8100) continue;
    n++; cx += dx; cy += dy; avx += o.vx; avy += o.vy; if (d2 < 360) { const d = Math.sqrt(d2) + 0.5; sx -= dx / d * (19 - d); sy -= dy / d * (19 - d); }
  }
  let ax = 0, ay = 0;
  if (n) { ax += cx / n * 1.4 + (avx / n - m.vx) * 1.8 + sx * 10; ay += cy / n * 1.4 + (avy / n - m.vy) * 1.8 + sy * 10; }
  const gx = S.tx - m.hx, gy = S.ty - m.hy, gd = Math.hypot(gx, gy) + 1; ax += gx / gd * 60; ay += gy / gd * 60;
  // fear of what rushes; curiosity about what keeps still
  let fear = 0; const T = threats(W);
  for (let i = 0; i < T.length; i += 7) {
    if (T[i + 5]) continue; const dx = m.hx - T[i], dy = m.hy - T[i + 1], d = Math.hypot(dx, dy) + 1, edge = d - T[i + 4]; if (edge > 260) continue;
    const sp = Math.hypot(T[i + 2], T[i + 3]), R = 24 + Math.min(150, sp * 0.62);
    if (edge < R) { const f = 1 - edge / R; ax += dx / d * f * 1700; ay += dy / d * f * 1700; if (f > fear) fear = f; }
    else if (sp < 40 && T[i + 6] && edge < 200) { ax -= dx / d * 26; ay -= dy / d * 26; }       // a creature holding still is interesting
  }
  // one of the school was taken: for a moment they all flee the place it happened
  const since = W.time - S.scareT; if (since < 1.1) { const dx = m.hx - S.scareX, dy = m.hy - S.scareY, d = Math.hypot(dx, dy) + 1; if (d < 200) { const f = (1 - since / 1.1) * (1 - d / 200); ax += dx / d * 1400 * f; ay += dy / d * 1400 * f; if (f > fear) fear = f; } }
  m.vx += ax * dt; m.vy += ay * dt; m.alarm = Math.max(m.alarm * (1 - dt * 3), fear);
  const sp = Math.hypot(m.vx, m.vy) + 1e-6, vmax = 78 + 330 * fear, vmin = 26;          // calm they cruise at a third of your pace; frightened, they outswim you — not a dart if (sp > vmax) { m.vx *= vmax / sp; m.vy *= vmax / sp; } else if (sp < vmin) { m.vx *= vmin / sp; m.vy *= vmin / sp; }
  walls(m, W, dt, 18);
  const w = water(W, m.hx, m.hy); m.hx += (m.vx + w[0] * 0.75) * dt; m.hy += (m.vy + w[1] * 0.75) * dt;          // they swim in the water, and the water moves
}
function retarget(S, W) {
  const P = W.phys; S.tT = W.time + 2.6 + Math.random() * 3.2;
  if (S.path && S.path.length) { S.pk = (S.pk + 1) % S.path.length; S.tx = S.path[S.pk].x; S.ty = S.path[S.pk].y; return; }
  for (let k = 0; k < 14; k++) { const a = Math.random() * TAU, r = S.range * Math.sqrt(Math.random()), x = S.hx + Math.cos(a) * r, y = S.hy + Math.sin(a) * r; if (P.solidAt(x, y) > 44 && !P.blocked(S.cx, S.cy, x, y, 8)) { S.tx = x; S.ty = y; return; } }
  S.tx = S.hx; S.ty = S.hy;
}

function firefly(m, dt) {
  const W = m.W, F = W.fireflies; let s = 0, n = 0;
  for (let i = 0; i < F.length; i++) { const o = F[i]; if (o === m || o.dead) continue; const dx = o.ox - m.ox, dy = o.oy - m.oy; if (dx * dx + dy * dy > 115600) continue; s += Math.sin(TAU * (o.phase - m.phase)); n++; }
  m.phase += dt * (m.omega + (n ? 0.075 * s / n : 0));                // weak coupling: a cloud takes a quarter of a minute to find one rhythm — long enough to be watched doing it
  // …and where music is playing, the cloud slowly finds *its* pulse (the one, two, four or eight beats nearest its own clock), so it flashes on the downbeat
  //  and its little bell falls in time. Found, not imposed: the clock retunes over seconds and the pull on the phase is gentle
  const pu = W.sound && W.sound.pulse ? W.sound.pulse(1 / m.omega0) : null;
  if (pu) { m.omega += ((0.98 + 0.04 * m.seed) / pu[1] - m.omega) * Math.min(1, dt * 0.25); m.phase += dt * 0.05 * Math.sin(TAU * (pu[0] - m.phase)); }
  else m.omega += (m.omega0 - m.omega) * Math.min(1, dt * 0.25);
  if (m.phase >= 1) { m.phase -= 1; flashed(W, m); }
  const p = m.phase; m.lit = m.beat === 2 ? (p < 0.17 ? Math.sin(p / 0.17 * Math.PI) : p > 0.24 && p < 0.42 ? 0.8 * Math.sin((p - 0.24) / 0.18 * Math.PI) : 0)      // a heart: lub-dub
    : p < 0.34 ? Math.pow(Math.sin(p / 0.34 * Math.PI), 0.75) : 0; m.dim = m.lit < 0.3;
  m.hx = m.ox + Math.sin(m.t * 0.6 + m.seed * 6.3) * 6; m.hy = m.oy + Math.sin(m.t * 0.83 + m.seed * 2.9) * 5;
}
// many flashing at once is a sound: the room's own little bell (only once the cloud has found its rhythm)
function flashed(W, m) {
  const t = W.time; if (t - (W.ffT || -9) > 0.22) { W.ffT = t; W.ffN = 0; W.ffX = 0; } W.ffN++; W.ffX += m.ox;
  if (W.ffN === 4 && t - (W.ffBell || -9) > 1.6) { W.ffBell = t; if (W.sound && W.sound.firefly && W.isPlayerNear(m.ox, m.oy, 700)) W.sound.firefly(W.ffX / W.ffN / W.spec.W * 1.6 - 0.8);
    // a creature resting beside a swarm that flashes as one shimmers with it
    const F = W.player && W.player.focus; if (F && F.alive && F.idleT > 1 && Math.hypot(F.B.cx - m.ox, F.B.cy - m.oy) < 320) { F.excite = Math.min(1, F.excite + 0.35); F.crown.joy(); } }
}

// ── what happens when one is taken ─────────────────────────────────────────
export function takenKind(m) {
  const W = m.W;
  if (m.kind === 'firefly') for (const o of W.fireflies) { if (o === m || o.dead) continue; const d = Math.hypot(o.ox - m.ox, o.oy - m.oy); if (d < 230) o.phase = (o.phase + 0.15 + Math.random() * 0.4 * (1 - d / 230)) % 1; }      // the neighbours lose the beat
  else if (m.kind === 'shoal') { const S = m.school; S.scareT = W.time; S.scareX = m.x; S.scareY = m.y; }
}

// ── light ──────────────────────────────────────────────────────────────────
export function drawKind(m, ink, s) {
  const c = m.col, k = m.kind;
  if (k === 'shoal') {
    const sp = Math.hypot(m.vx, m.vy) + 1e-3, ux = m.vx / sp, uy = m.vy / sp, L = (9 + Math.min(12, sp * 0.04)) * s, sw = Math.sin(m.t * 11 + m.seed * 9) * 2.2 * s;
    ink.light(m.x, m.y, 20 * s, PROF.halo, c[0], c[1], c[2], 0.22 + 0.16 * m.alarm);
    ink.beam(m.x - ux * L - uy * sw, m.y - uy * L + ux * sw, m.x, m.y, 3.4 * s, c[0], c[1], c[2], 0.95);           // a body with a tail that sways as it swims
    ink.light(m.x, m.y, 7 * s, PROF.glow, c[0], c[1], c[2], 0.9);
    ink.light(m.x, m.y, 4.4 * s, PROF.core, 1, 1, 0.95, 1);
    return;
  }
  if (k === 'firefly') {
    const b = m.lit, r = m.r * s;
    if (b < 0.04) { ink.light(m.x, m.y, r * 1.1, PROF.glow, c[0], c[1], c[2], 0.5); ink.light(m.x, m.y, r * 0.35, PROF.core, c[0], c[1], c[2], 0.5); return; }          // an ember between flashes: findable, not catchable
    ink.light(m.x, m.y, r * 4.4, PROF.halo, c[0], c[1], c[2], 0.30 * b);
    ink.light(m.x, m.y, r * 1.7, PROF.glow, c[0], c[1], c[2], 1.3 * b + 0.15);
    ink.light(m.x, m.y, r * 0.7, PROF.core, 1, 1, 0.9, b);
    return;
  }
  if (k === 'shy') {
    const r = m.r * s, sp = Math.hypot(m.vx, m.vy);
    if (sp > 30) { const ux = m.vx / sp, uy = m.vy / sp, L = Math.min(26, sp * 0.06); ink.beam(m.x - ux * L, m.y - uy * L, m.x, m.y, r * 0.5, c[0], c[1], c[2], 0.55); }
    ink.light(m.x, m.y, r * 3.0, PROF.halo, c[0], c[1], c[2], 0.20 + 0.3 * m.alarm);
    ink.light(m.x, m.y, r * 1.3, PROF.glow, c[0], c[1], c[2], 1.1);
    ink.light(m.x, m.y, r * 0.55, PROF.core, 1, 1, 1, 1);
    ink.ring(m.x, m.y, r * (1.5 + 0.9 * m.alarm), 1.1, c[0], c[1], c[2], 0.45 + 0.4 * m.alarm, 1);
    return;
  }
  // drift and seed: a soft light with the faintest wake
  const r = m.r * s, sp = Math.hypot(m.vx, m.vy);
  if (sp > 12) { const L = Math.min(18, sp * 0.1); ink.beam(m.x - m.vx / sp * L, m.y - m.vy / sp * L, m.x, m.y, r * 0.45, c[0], c[1], c[2], 0.32); }
  ink.light(m.x, m.y, r * 3.0, PROF.halo, c[0], c[1], c[2], 0.18);
  ink.light(m.x, m.y, r * 1.4, PROF.glow, c[0], c[1], c[2], 1.15);
  ink.light(m.x, m.y, r * 0.6, PROF.core, 1, 1, 0.95, 0.95);
}
// a shy light at rest is painted into the plate: a bright point in a thin ring — an eye that is watching you
export function bakeKind(m, ink) {
  const c = m.col, r = m.r;
  ink.light(m.hx, m.hy, r * 3.6, PROF.halo, c[0], c[1], c[2], 0.18);
  ink.light(m.hx, m.hy, r * 1.3, PROF.glow, c[0], c[1], c[2], 1.1);
  ink.light(m.hx, m.hy, r * 0.55, PROF.core, 1, 1, 1, 1);
  ink.ring(m.hx, m.hy, r * 1.5, 1.1, c[0], c[1], c[2], 0.5, 1);
}

// ── Pod: a bulb on a stalk that slowly fills with seeds of light. Brush it and it bursts. ──
export class Pod {
  constructor(W, d) {
    this.W = W; this.d = d; this.x = d.x || 0; this.y = d.y || 0; this.dead = false; this.t = Math.random() * 10; this.id = d.id;      // (an Entity in all but name: entities.js imports this file)
    this.r = d.r ?? 15; this.n = d.n ?? 6; this.col = d.col || KINDS.seed.col; this.curious = true; this.regrow = d.regrow || 0; this.regT = 0; this.open = false; this.full = d.full ?? 1;
    const a = d.a ?? -Math.PI / 2; this.ax = Math.cos(a); this.ay = Math.sin(a);
    this.seeds = []; this.sow(d.gift);
  }
  sow(gift) { this.seeds = []; for (let k = 0; k < this.n; k++) this.seeds.push(this.W.spawn({ type: 'mote', kind: 'seed', x: this.x, y: this.y, value: this.d.value ?? 1, pod: this, gift: !!gift })); this.open = false; }
  update(dt) {
    this.t += dt; const W = this.W;
    if (this.open) { if (this.regrow && (this.regT += dt) > this.regrow) { this.regT = 0; this.full = 0; this.sow(true); } return; }
    this.full = Math.min(1, this.full + dt / 3);
    if (this.full < 0.6) return;
    // brushed by a body, or by a feeler's tip
    const pl = W.player; if (!pl) return;
    for (const O of pl.orgs) {
      if (!O.alive) continue; const B = O.B; const d = Math.hypot(B.cx - this.x, B.cy - this.y);
      if (d < B.r + this.r + 6) { this.burst(B.cx, B.cy); return; }
      if (d < B.r + 140) for (const r of O.crown.rays) { if (r.len < 6) continue; const tx = r.x[r.x.length - 1], ty = r.y[r.y.length - 1]; if (Math.hypot(tx - this.x, ty - this.y) < this.r + 5) { this.burst(B.cx, B.cy); return; } }
    }
  }
  burst(fx, fy) {
    const W = this.W; this.open = true; const base = Math.atan2(this.ay, this.ax);
    this.seeds.forEach((m, k) => { if (m.dead) return; const a = base + (k / Math.max(1, this.seeds.length - 1) - 0.5) * 2.4 + (Math.random() - 0.5) * 0.3, s = 150 + Math.random() * 120;
      m.hx = m.x = this.x + Math.cos(a) * 6; m.hy = m.y = this.y + Math.sin(a) * 6; m.vx = Math.cos(a) * s; m.vy = Math.sin(a) * s; m.kick = 0.55; m.spawnT = 0.0001; m.pod = null; m.from = this; m.burstT = W.time; });
    W.fx.ring(this.x, this.y, this.col, this.r * 4, 0.5, { a: 0.8 }); W.fx.burst(this.x, this.y, 10, this.col, 160, { life: 0.6, size: 2.2 });
    if (W.sound && W.sound.podPop) W.sound.podPop(this.x / W.spec.W * 1.6 - 0.8);
    W.emit('podBurst', this);
  }
  post() {}
  get on() { return true; }
  under(ink) {
    const c = this.col, x = this.x, y = this.y, r = this.r, br = 0.5 + 0.5 * Math.sin(this.t * 2.1 + this.x * 0.01);
    ink.beam(x - this.ax * r * 2.0, y - this.ay * r * 2.0, x - this.ax * r * 0.7, y - this.ay * r * 0.7, 2.2, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, 0.45);       // the stalk
    if (this.open) { ink.ring(x, y, r * 0.8, 1, c[0], c[1], c[2], 0.28, 1); return; }                                                           // an empty husk
    const f = this.full; ink.light(x, y, r * (2.2 + 0.4 * br) * (0.5 + 0.5 * f), PROF.halo, c[0], c[1], c[2], 0.22 * f);
    ink.ring(x, y, r * (0.75 + 0.25 * f), 1.4, c[0], c[1], c[2], 0.55, 1);
    const n = this.seeds.length; for (let k = 0; k < n; k++) { const a = this.t * 0.9 + k / n * TAU, q = r * 0.42 * f; ink.light(x + Math.cos(a) * q, y + Math.sin(a) * q, 3.4, PROF.core, 1, 0.9, 0.92, 0.75 * f); }
  }
}

// ── for room builders ──────────────────────────────────────────────────────
// a school of n little lights around (x, y); o.path = [{x,y}, …] makes it swim a beat, else it wanders o.range around home
export function shoalOf(id, x, y, n, o = {}) { const out = []; for (let k = 0; k < n; k++) { const a = k / n * TAU, r = 14 + 10 * (k % 3); out.push({ type: 'mote', kind: 'shoal', school: id, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, home: { x, y }, range: o.range, path: o.path, ...(o.col ? { col: o.col } : {}) }); } return out; }
// a cloud of fireflies: n points scattered in a disc of radius r (golden-angle, so they never clump)
export function fireflyCloud(x, y, n, r, o = {}) { const out = []; for (let k = 0; k < n; k++) { const q = r * Math.sqrt((k + 0.5) / n), a = k * 2.39996; out.push({ type: 'mote', kind: 'firefly', x: x + Math.cos(a) * q, y: y + Math.sin(a) * q, period: o.period, ...(o.value ? { value: o.value } : {}) }); } return out; }
