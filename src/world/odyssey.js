// ─────────────────────────────────────────────────────────────────────────────
//  The Odyssey — chambers that each teach one idea through physics alone.
//  Every builder lays itself out along the window's long axis (u) and across
//  it (v), so the same chamber reads naturally in portrait and in landscape.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MAT } from '../sim/materials.js';
import { TAU } from '../core/util.js';
import { frame, dish } from './rooms.js';
import { moteTrail, moteRing } from './entities.js';

// layout frame: u runs along the long axis, v across it
function L(aspect) {
  const { W, H } = frame(aspect); const land = W >= H;
  const p = (u, v) => (land ? [u * W, v * H] : [v * W, u * H]);
  const P = (u, v) => { const q = p(u, v); return { x: q[0], y: q[1] }; };
  // a box whose length runs along u (al) and across (ac), in world units
  const box = (u, v, al, ac, r, extra = {}) => { const q = p(u, v); return { op: 'add', t: 'box', x: q[0], y: q[1], w: land ? al : ac, h: land ? ac : al, r, ...extra }; };
  const vec = (du, dv) => (land ? [du, dv] : [dv, du]);          // a direction given along/across
  return { W, H, land, Lu: land ? W : H, Lv: land ? H : W, p, P, box, vec, ang: (a) => (land ? a : Math.PI / 2 - a) };
}
const trail = (f, uv, n, value, extra) => moteTrail(uv.map(q => f.p(q[0], q[1])), n, value, extra);
const PAL = {
  dew: { deep: [0.014, 0.050, 0.080], mid: [0.045, 0.170, 0.225], pool: [0.080, 0.250, 0.280], wall: [0.085, 0.215, 0.270], rim: [0.55, 0.92, 1.00] },
  glass: { deep: [0.030, 0.034, 0.105], mid: [0.105, 0.120, 0.320], pool: [0.150, 0.150, 0.360], wall: [0.135, 0.150, 0.350], rim: [0.72, 0.78, 1.00], accent: [1.0, 0.56, 0.78] },
  amber: { deep: [0.070, 0.040, 0.018], mid: [0.230, 0.135, 0.050], pool: [0.300, 0.200, 0.070], wall: [0.270, 0.175, 0.080], rim: [1.00, 0.86, 0.56], accent: [0.45, 0.95, 0.85] },
  lode: { deep: [0.016, 0.022, 0.036], mid: [0.070, 0.090, 0.135], pool: [0.115, 0.135, 0.185], wall: [0.120, 0.150, 0.215], rim: [0.70, 0.84, 1.00], accent: [1.0, 0.72, 0.36] },
  abyss: { deep: [0.034, 0.012, 0.060], mid: [0.130, 0.045, 0.180], pool: [0.150, 0.050, 0.200], wall: [0.185, 0.085, 0.240], rim: [0.92, 0.66, 1.00], accent: [0.40, 0.95, 1.00] },
};

export const ROOMS = [
  // ── I · DEW ─────────────────────────────────────────────────────────────
  { id: 'first-light', name: 'First Light', par: 30, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    const c = f.P(0.5, 0.5); geo.push({ op: 'add', t: 'circle', x: c.x, y: c.y, r: 62, k: 0 });
    const ents = [
      ...trail(f, [[0.20, 0.5], [0.27, 0.5]], 3),
      ...trail(f, [[0.30, 0.40], [0.40, 0.22], [0.50, 0.17], [0.60, 0.22], [0.70, 0.40]], 9),
      ...trail(f, [[0.30, 0.60], [0.40, 0.78], [0.50, 0.83], [0.60, 0.78], [0.70, 0.60]], 9),
      ...moteRing(f.P(0.86, 0.5).x, f.P(0.86, 0.5).y, 74, 5, 2, { a0: 0.3 }),
      { type: 'pore', ...f.P(0.86, 0.5) },
    ];
    return { W, H, geo, ents, pal: PAL.dew, spawn: { ...f.P(0.11, 0.5), n: 40 } };
  } },
  { id: 'narrows', name: 'The Narrows', par: 34, hint: 'push', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const gap = 30, th = 74;
    const half = (f.Lv - gap) / 2;
    geo.push(f.box(0.5, 0, th, half * 2 - 6, 30), f.box(0.5, 1, th, half * 2 - 6, 30));
    // a side pocket behind a second, tighter slot
    geo.push(f.box(0.78, 0.26, 150, 26, 13), f.box(0.69, 0.13, 26, 60, 13));
    const ents = [
      ...trail(f, [[0.16, 0.30], [0.30, 0.22], [0.40, 0.36]], 6), ...trail(f, [[0.16, 0.70], [0.30, 0.78], [0.40, 0.64]], 6),
      ...trail(f, [[0.455, 0.5], [0.545, 0.5]], 4),
      ...trail(f, [[0.60, 0.42], [0.72, 0.52], [0.66, 0.74], [0.80, 0.78]], 8),
      ...trail(f, [[0.74, 0.15], [0.84, 0.15]], 3, 4, { col: [0.6, 0.95, 1] }),
      { type: 'pore', ...f.P(0.88, 0.56) },
    ];
    return { W, H, geo, ents, pal: PAL.dew, spawn: { ...f.P(0.12, 0.5) } };
  } },
  { id: 'leap', name: 'Leap', par: 34, hint: 'dart', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const open = 170, th = 60; const half = (f.Lv - open) / 2;
    geo.push(f.box(0.44, 0, th, half * 2 - 6, 28), f.box(0.44, 1, th, half * 2 - 6, 28));
    geo.push(f.box(0.74, 0.5, 34, f.Lv * 0.34, 17, { mat: SURF.GLASS }));
    const fa = f.land ? Math.PI / 2 : 0;
    const ents = [
      ...trail(f, [[0.14, 0.26], [0.26, 0.20], [0.34, 0.34]], 5), ...trail(f, [[0.14, 0.74], [0.26, 0.80], [0.34, 0.66]], 5), ...trail(f, [[0.22, 0.5], [0.34, 0.5]], 3),
      { type: 'film', ...f.P(0.44, 0.5), len: open + 10, a: fa },
      ...trail(f, [[0.52, 0.5], [0.64, 0.5]], 4), ...trail(f, [[0.56, 0.24], [0.74, 0.16], [0.90, 0.26]], 6), ...trail(f, [[0.56, 0.76], [0.74, 0.84], [0.90, 0.74]], 6),
      { type: 'film', ...f.P(0.83, 0.5), len: f.Lv * 0.30, a: fa, speed: 400 }, ...moteRing(f.P(0.91, 0.5).x, f.P(0.91, 0.5).y, 26, 3, 4, { col: [0.6, 0.95, 1] }),
      { type: 'pore', ...f.P(0.62, 0.5), r: 38 },
    ];
    return { W, H, geo, ents, pal: PAL.dew, spawn: { ...f.P(0.10, 0.5) } };
  } },
  { id: 'two-hearts', name: 'Two Hearts', par: 38, hint: 'bud', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const th = 46, open = 120; const half = (f.Lv - open) / 2;
    geo.push(f.box(0.70, 0, th, half * 2 - 6, 22), f.box(0.70, 1, th, half * 2 - 6, 22));
    const gd = f.vec(0, 1), gs = f.land ? [th * 0.62, open + 26] : [open + 26, th * 0.62];
    const ents = [
      { type: 'pad', id: 'A', ...f.P(0.42, 0.17), need: 16 }, { type: 'pad', id: 'B', ...f.P(0.42, 0.83), need: 16 },
      { type: 'gate', ...f.P(0.70, 0.5), w: gs[0], h: gs[1], dx: gd[0] * (open + 30), dy: gd[1] * (open + 30), need: ['A', 'B'], latch: true },
      ...trail(f, [[0.18, 0.5], [0.30, 0.5]], 4), ...trail(f, [[0.20, 0.26], [0.34, 0.20]], 4), ...trail(f, [[0.20, 0.74], [0.34, 0.80]], 4),
      ...trail(f, [[0.52, 0.30], [0.58, 0.5], [0.52, 0.70]], 6), ...moteRing(f.P(0.86, 0.5).x, f.P(0.86, 0.5).y, 70, 6, 3),
      { type: 'pore', ...f.P(0.86, 0.5) },
    ];
    return { W, H, geo, ents, pal: PAL.dew, spawn: { ...f.P(0.10, 0.5), n: 70 }, minMass: 70 };
  } },
  { id: 'lock', name: 'The Lock', par: 52, boss: true, quota: 0.55, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H, { r: Math.min(W, H) * 0.34 }); const c = f.P(0.5, 0.5);
    // two rings of glass turning against each other around a heart of light: every doorway is a moment, not a place
    const R2 = Math.min(W, H) / 2 - 86, R1 = R2 * 0.52; const a0 = f.land ? Math.PI : -Math.PI / 2;
    const ents = [
      { type: 'rotor', x: c.x, y: c.y, R: R2, r: 8, gap: 0.27, spin: 0.36, a: a0 + 1.9, pulse: 0.5 },
      { type: 'rotor', x: c.x, y: c.y, R: R1, r: 8, gap: 0.42, spin: -0.52, a: a0 - 1.2, col: [1.0, 0.8, 0.5] },
      ...moteRing(c.x, c.y, (R1 + R2) / 2, 12, 2), ...moteRing(c.x, c.y, R1 * 0.52, 6, 4, { col: [1.0, 0.8, 0.5], a0: 0.4 }),
      ...trail(f, [[0.13, 0.26], [0.20, 0.5], [0.13, 0.74]], 5), ...trail(f, [[0.87, 0.26], [0.80, 0.5], [0.87, 0.74]], 5),
      { type: 'pore', x: c.x, y: c.y, r: 34, col: [1.0, 0.8, 0.5] },
    ];
    return { W, H, geo, ents, pal: PAL.dew, spawn: { ...f.P(0.09, 0.5), n: 70 }, minMass: 70, cap: 110, decor: 0.6 };
  } },
  // ── II · GLASSWORKS ────────────────────────────────────────────────────
  { id: 'comb', name: 'The Comb', par: 34, hint: 'rally', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    const n = Math.floor((f.Lv - 110) / 36);
    for (let k = 0; k < n; k++) { const q = f.p(0.47, (k + 0.5) / n * 0.86 + 0.07); geo.push({ op: 'add', t: 'circle', x: q[0], y: q[1], r: 11.5, mat: SURF.GLASS }); }
    const ents = [
      ...trail(f, [[0.18, 0.24], [0.34, 0.30], [0.36, 0.5], [0.34, 0.70], [0.18, 0.76]], 11),
      ...trail(f, [[0.56, 0.20], [0.56, 0.80]], 8), ...trail(f, [[0.70, 0.30], [0.78, 0.5], [0.70, 0.70]], 6, 3),
      { type: 'pore', ...f.P(0.88, 0.5) },
    ];
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.11, 0.5), n: 90 }, minMass: 90 };
  } },
  { id: 'shear', name: 'Shear', par: 38, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const th = 46, open = 120; const half = (f.Lv - open) / 2;
    geo.push(f.box(0.74, 0, th, half * 2 - 6, 22), f.box(0.74, 1, th, half * 2 - 6, 22));
    const gd = f.vec(0, 1), gs = f.land ? [th * 0.62, open + 26] : [open + 26, th * 0.62];
    const b1 = f.P(0.40, 0.34), b2 = f.P(0.40, 0.66);
    const ents = [
      { type: 'blade', ...b1, len: 150, spin: 1.5 }, { type: 'blade', ...b2, len: 150, spin: -1.5, a: 1.2 },
      { type: 'pad', id: 'A', ...f.P(0.60, 0.15), need: 14 }, { type: 'pad', id: 'B', ...f.P(0.60, 0.85), need: 14 },
      { type: 'gate', ...f.P(0.74, 0.5), w: gs[0], h: gs[1], dx: gd[0] * (open + 30), dy: gd[1] * (open + 30), need: ['A', 'B'], latch: true },
      ...moteRing(b1.x, b1.y, 36, 5, 3), ...moteRing(b2.x, b2.y, 36, 5, 3),
      ...trail(f, [[0.16, 0.2], [0.26, 0.14]], 3), ...trail(f, [[0.16, 0.8], [0.26, 0.86]], 3), ...trail(f, [[0.52, 0.42], [0.52, 0.58]], 3),
      ...moteRing(f.P(0.88, 0.5).x, f.P(0.88, 0.5).y, 64, 5, 3), { type: 'pore', ...f.P(0.88, 0.5) },
    ];
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.10, 0.5), n: 90 }, minMass: 90 };
  } },
  { id: 'grinder-row', name: 'Grinder Row', par: 34, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    const g1 = f.P(0.36, 0.34), g2 = f.P(0.58, 0.66), g3 = f.P(0.36, 0.72);
    const ents = [
      { type: 'grinder', ...g1, r: 44, spin: 2.6 }, { type: 'grinder', ...g2, r: 50, spin: -2.2 }, { type: 'grinder', ...g3, r: 30, spin: 3.4, orbit: { x: g3.x, y: g3.y, r: 46, w: 0.9 } },
      ...moteRing(g1.x, g1.y, 78, 8, 2), ...moteRing(g2.x, g2.y, 86, 9, 2), ...moteRing(g3.x, g3.y, 22, 3, 5, { col: [0.6, 0.95, 1] }),
      ...trail(f, [[0.18, 0.2], [0.24, 0.5], [0.18, 0.8]], 5), ...trail(f, [[0.74, 0.22], [0.80, 0.36]], 3),
      { type: 'pool', kind: 'heal', ...f.P(0.80, 0.22), r: 52, max: 50 },
      { type: 'pore', ...f.P(0.88, 0.62) },
    ];
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.10, 0.5), n: 100 }, minMass: 100 };
  } },
  { id: 'press', name: 'The Press', par: 44, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const lane = 170;
    // a long lane across the middle, three pistons taking turns
    const wallAc = (f.Lv - lane) / 2 - 20;
    geo.push(f.box(0.5, 0, f.Lu * 0.52, wallAc * 2, 40), f.box(0.5, 1, f.Lu * 0.52, wallAc * 2, 40));
    const ents = []; const dir = f.vec(0, 1);
    [0.34, 0.5, 0.66].forEach((u, k) => { const top = k % 2 === 0; const q = f.P(u, top ? 0.5 - (lane / 2 + 62) / f.Lv : 0.5 + (lane / 2 + 62) / f.Lv); const sz = f.land ? [92, 124] : [124, 92];
      ents.push({ type: 'crusher', x: q.x, y: q.y, w: sz[0], h: sz[1], travel: lane - 30, period: 2.8, phase: k * 0.33, dir: top ? dir : [-dir[0], -dir[1]] }); });
    ents.push(...trail(f, [[0.26, 0.5], [0.74, 0.5]], 13), ...trail(f, [[0.12, 0.24], [0.16, 0.5], [0.12, 0.76]], 5), ...trail(f, [[0.88, 0.24], [0.84, 0.40]], 3, 3),
      { type: 'lantern', id: 'L1', ...f.P(0.12, 0.14) }, { type: 'lantern', id: 'L2', ...f.P(0.88, 0.86) }, { type: 'pore', ...f.P(0.88, 0.5), key: ['L1', 'L2'] });
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.10, 0.5), n: 110 }, minMass: 110 };
  } },
  { id: 'centrifuge', name: 'The Centrifuge', par: 80, boss: true, quota: 0.5, build(a) {
    const f = L(a), { W, H } = f; const c = f.P(0.5, 0.5); const RR = Math.min(W, H) / 2 - 40;
    // a drum cut from solid glass, an antechamber at either end; three arms turn inside it, and you ride between them
    const geo = [{ op: 'carve', t: 'circle', x: c.x, y: c.y, r: RR }];
    const an = f.land ? [W * 0.115, H * 0.5, W * 0.17, H * 0.52] : [W * 0.5, H * 0.115, W * 0.52, H * 0.17];
    geo.push({ op: 'carve', t: 'box', x: an[0], y: an[1], w: an[2], h: an[3], r: 46 }, { op: 'carve', t: 'box', x: W - an[0], y: H - an[1], w: an[2], h: an[3], r: 46 });
    const ch = f.land ? [W * 0.5, H * 0.5, W * 0.80, 96] : [W * 0.5, H * 0.5, 96, H * 0.80];
    geo.push({ op: 'carve', t: 'box', x: ch[0], y: ch[1], w: ch[2], h: ch[3], r: 40 });
    const up = f.vec(0, -1), q = (ang, r) => ({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r }); const ua = Math.atan2(up[1], up[0]);
    const ents = [
      { type: 'spinner', x: c.x, y: c.y, n: 3, r0: 30, r1: RR - 14, w: 8, hub: 24, spin: 0.42, pulse: 0.37, a: ua + 0.5 },
      { type: 'lantern', id: 'L1', ...q(ua, RR - 30) }, { type: 'lantern', id: 'L2', ...q(ua + Math.PI, RR - 30) },
      { type: 'grinder', ...q(ua + 0.95, RR - 6), r: 22, spin: 3 }, { type: 'grinder', ...q(ua + Math.PI + 0.95, RR - 6), r: 22, spin: -3 },
      ...moteRing(c.x, c.y, RR * 0.50, 12, 2, { a0: 0.26 }), ...moteRing(c.x, c.y, RR * 0.80, 10, 3, { a0: ua + 0.2, col: [0.8, 0.75, 1] }).filter((m, k) => k !== 2 && k !== 7),
      ...trail(f, [[0.09, 0.36], [0.09, 0.64]], 3), ...trail(f, [[0.91, 0.36], [0.91, 0.64]], 3),
      { type: 'pore', ...f.P(0.905, 0.5), r: 34, key: ['L1', 'L2'] },
    ];
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.085, 0.5), n: 100 }, minMass: 100, decor: 0.5 };
  } },
  // ── III · CHEMISTRY ────────────────────────────────────────────────────
  { id: 'amber', name: 'Amber', par: 34, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    // a river crosses the chamber; only something sticky can hold the stepping stones
    [0.30, 0.5, 0.70].forEach((v, k) => { const q = f.p(0.5 + (k % 2 ? 0.04 : -0.04), v); geo.push({ op: 'add', t: 'circle', x: q[0], y: q[1], r: 26 }); });
    const cv = f.vec(0, 1), sz = f.land ? [150, f.Lv - 150] : [f.Lv - 150, 150];
    const ents = [
      { type: 'pool', kind: 'morph', mat: MAT.RESIN, morph: { speed: 0.82, tonus: 1.15, dart: 0.85 }, ...f.P(0.20, 0.72), r: 50 },
      { type: 'current', ...f.P(0.5, 0.5), w: sz[0], h: sz[1], vx: cv[0] * 250, vy: cv[1] * 250, k: 4.2 },
      { type: 'grinder', ...f.P(0.5, 0.93), r: 34, spin: 3 },
      ...trail(f, [[0.14, 0.24], [0.28, 0.30], [0.30, 0.52]], 6), ...trail(f, [[0.46, 0.22], [0.54, 0.40], [0.46, 0.60]], 7, 3, { col: [1, 0.75, 0.3] }),
      ...trail(f, [[0.70, 0.24], [0.80, 0.5], [0.70, 0.76]], 8), { type: 'pool', kind: 'rinse', ...f.P(0.80, 0.82), r: 40 },
      { type: 'pore', ...f.P(0.88, 0.30) },
    ];
    return { W, H, geo, ents, pal: PAL.amber, spawn: { ...f.P(0.11, 0.5), n: 80 }, minMass: 80 };
  } },
  { id: 'quicksilver', name: 'Quicksilver', par: 30, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    geo.push(f.box(0.5, 0.5, f.Lu * 0.36, 44, 22, { mat: SURF.GLASS }));
    const ents = [
      { type: 'pool', kind: 'morph', mat: MAT.SILVER, morph: { speed: 1.5, tonus: 0.8, dart: 1.25 }, ...f.P(0.22, 0.5), r: 48 },
      ...trail(f, [[0.30, 0.22], [0.50, 0.16], [0.70, 0.22]], 9), ...trail(f, [[0.30, 0.78], [0.50, 0.84], [0.70, 0.78]], 9), ...trail(f, [[0.36, 0.36], [0.64, 0.36]], 5, 3), ...trail(f, [[0.36, 0.64], [0.64, 0.64]], 5, 3),
      { type: 'pore', ...f.P(0.88, 0.5) },
    ];
    const h1 = f.P(0.62, 0.26), h2 = f.P(0.62, 0.74);
    return { W, H, geo, ents, pal: PAL.amber, spawn: { ...f.P(0.10, 0.5), n: 70 }, minMass: 70, cap: 120, rivals: [{ kind: 'hunter', ...h1, n: 150 }, { kind: 'hunter', ...h2, n: 150 }] };
  } },
  { id: 'oil-water', name: 'Oil & Water', par: 32, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const th = 60, gap = 96; const half = (f.Lv - gap) / 2;
    geo.push(f.box(0.38, 0, th, half * 2 - 6, 26), f.box(0.38, 1, th, half * 2 - 6, 26), f.box(0.66, 0, th, half * 2 - 6, 26), f.box(0.66, 1, th, half * 2 - 6, 26));
    const ents = [
      ...trail(f, [[0.16, 0.26], [0.26, 0.5], [0.16, 0.74]], 7), ...trail(f, [[0.46, 0.24], [0.52, 0.5], [0.58, 0.76]], 8, 3), ...trail(f, [[0.74, 0.74], [0.84, 0.5], [0.74, 0.26]], 7),
      { type: 'pore', ...f.P(0.88, 0.76) },
    ];
    const o1 = f.P(0.38, 0.5), o2 = f.P(0.66, 0.5), o3 = f.P(0.52, 0.5);
    return { W, H, geo, ents, pal: PAL.amber, spawn: { ...f.P(0.10, 0.5), n: 80 }, minMass: 80, rivals: [{ kind: 'oil', ...o1, n: 70 }, { kind: 'oil', ...o2, n: 70 }, { kind: 'oil', ...o3, n: 36 }] };
  } },
  { id: 'bastion', name: 'Bastion', par: 48, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    const g1 = f.P(0.52, 0.30), g2 = f.P(0.52, 0.70), g3 = f.P(0.70, 0.5);
    const ents = [
      { type: 'pool', kind: 'morph', mat: MAT.BASTION, morph: { speed: 0.82, tonus: 1.4, dart: 0.9 }, ...f.P(0.22, 0.5), r: 48 },
      { type: 'grinder', ...g1, r: 46, spin: 2.6 }, { type: 'grinder', ...g2, r: 46, spin: -2.6 }, { type: 'grinder', ...g3, r: 36, spin: 3.2 },
      ...moteRing(g1.x, g1.y, 24, 4, 4, { col: [0.8, 0.7, 1] }), ...moteRing(g2.x, g2.y, 24, 4, 4, { col: [0.8, 0.7, 1] }), ...trail(f, [[0.52, 0.44], [0.52, 0.56]], 3, 3),
      ...trail(f, [[0.14, 0.22], [0.30, 0.20]], 4), ...trail(f, [[0.14, 0.78], [0.30, 0.80]], 4), { type: 'lantern', id: 'L1', ...f.P(0.86, 0.16) }, { type: 'lantern', id: 'L2', ...f.P(0.86, 0.84) },
      { type: 'pore', ...f.P(0.88, 0.5), key: ['L1', 'L2'] },
    ];
    const t1 = f.P(0.80, 0.30), t2 = f.P(0.80, 0.70);
    return { W, H, geo, ents, pal: PAL.amber, spawn: { ...f.P(0.10, 0.5), n: 100 }, minMass: 100, rivals: [{ kind: 'thorn', ...t1, n: 46 }, { kind: 'thorn', ...t2, n: 46 }] };
  } },
  { id: 'iron-bloom', name: 'Iron Bloom', par: 54, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    // a river no swimmer crosses cleanly — but iron answers the poles that pulse across it, each one downstream of the last
    const cv = f.vec(0, 1), sz = f.land ? [f.Lu * 0.30, f.Lv - 110] : [f.Lv - 110, f.Lu * 0.30];
    const m = [[0.40, 0.24], [0.50, 0.50], [0.60, 0.74]];
    const ents = [
      { type: 'pool', kind: 'morph', mat: MAT.FERRO, morph: { speed: 1, tonus: 0.9, dart: 1 }, ...f.P(0.20, 0.26), r: 48 },
      { type: 'current', ...f.P(0.5, 0.5), w: sz[0], h: sz[1], vx: cv[0] * 320, vy: cv[1] * 320, k: 5 },
      { type: 'grinder', ...f.P(0.42, 0.93), r: 30, spin: 3 }, { type: 'grinder', ...f.P(0.58, 0.93), r: 30, spin: -3 },
      ...m.map((q, k) => ({ type: 'magnet', ...f.P(q[0], q[1]), reach: 200, power: 560, period: 4.4, phase: k * 0.34 })),
      ...m.flatMap(q => moteRing(f.P(q[0], q[1]).x, f.P(q[0], q[1]).y, 40, 5, 3, { col: [0.7, 0.8, 1] })),
      ...trail(f, [[0.12, 0.60], [0.24, 0.70], [0.14, 0.84]], 6), ...trail(f, [[0.76, 0.30], [0.86, 0.5], [0.76, 0.70]], 7),
      { type: 'pool', kind: 'rinse', ...f.P(0.82, 0.16), r: 38 }, { type: 'pore', ...f.P(0.88, 0.84), r: 36 },
    ];
    return { W, H, geo, ents, pal: PAL.amber, spawn: { ...f.P(0.09, 0.42), n: 80 }, minMass: 80 };
  } },
  { id: 'thaw', name: 'Thaw', par: 44, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const gap = 30, th = 64, half = (f.Lv - gap) / 2, open = 110, half2 = (f.Lv - open) / 2;
    geo.push(f.box(0.46, 0, th, half * 2 - 6, 28), f.box(0.46, 1, th, half * 2 - 6, 28), f.box(0.76, 0, 44, half2 * 2 - 6, 22), f.box(0.76, 1, 44, half2 * 2 - 6, 22));
    const ps = f.land ? [30, open + 20] : [open + 20, 30];
    const ents = [
      { type: 'vent', ...f.P(0.20, 0.74) }, { type: 'frost', ...f.P(0.46, 0.5), r: 150, rate: 0.62 }, { type: 'vent', ...f.P(0.62, 0.22) },
      { type: 'iceplug', id: 'ICE', ...f.P(0.76, 0.5), w: ps[0], h: ps[1] },
      ...trail(f, [[0.16, 0.24], [0.28, 0.30]], 4), ...trail(f, [[0.36, 0.40], [0.46, 0.5], [0.56, 0.60]], 7, 3, { col: [0.7, 0.92, 1] }), ...trail(f, [[0.58, 0.78], [0.68, 0.70]], 4), ...moteRing(f.P(0.88, 0.5).x, f.P(0.88, 0.5).y, 60, 5, 3),
      { type: 'pore', ...f.P(0.88, 0.5), r: 36 },
    ];
    return { W, H, geo, ents, pal: PAL.glass, spawn: { ...f.P(0.09, 0.4), n: 80 }, minMass: 80 };
  } },
  { id: 'twin-cores', name: 'Twin Cores', par: 50, boss: true, quota: 0.5, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const c = f.P(0.54, 0.5);
    // two poles circle one another; each draws iron in, flickers, and throws it — to its twin, unless you lean elsewhere.
    // Around them, the other way, runs a ring of gears: the inside is a dance, the crossing is a moment.
    const edge = f.Lv / 2 - 38, gr = Math.min(edge - 26, 214), orb = Math.min(gr - 104, 112), up = f.vec(0, -1), ua = Math.atan2(up[1], up[0]);
    const q = (ang, r) => ({ x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r });
    const ents = [
      { type: 'pool', kind: 'morph', mat: MAT.FERRO, morph: { speed: 1, tonus: 1.5, dart: 1 }, ...f.P(0.15, 0.5), r: 46 },
      { type: 'core', id: 'C1', cx: c.x, cy: c.y, orb, r: 25, need: 7, a: ua + Math.PI / 2 + Math.PI, w: 0.36, phase: 0.0 },
      { type: 'core', id: 'C2', cx: c.x, cy: c.y, orb, r: 25, need: 7, a: ua + Math.PI / 2, w: 0.36, phase: 0.5, track: false },
      { type: 'grinder', ...q(ua, gr), r: 24, spin: 3, orbit: { x: c.x, y: c.y, r: gr, w: -0.5, p: ua } }, { type: 'grinder', ...q(ua + Math.PI, gr), r: 24, spin: -3, orbit: { x: c.x, y: c.y, r: gr, w: -0.5, p: ua + Math.PI } },
      ...moteRing(c.x, c.y, orb, 12, 2, { a0: 0.26, col: [0.72, 0.82, 1] }), ...moteRing(c.x, c.y, 26, 4, 3, { col: [1, 0.86, 0.5] }),
      ...moteRing(c.x, c.y, gr, 8, 3, { a0: ua + 0.39, col: [1, 0.7, 0.5] }),
      ...trail(f, [[0.06, 0.26], [0.12, 0.36]], 3), ...trail(f, [[0.06, 0.74], [0.12, 0.64]], 3),
      { type: 'pool', kind: 'rinse', ...f.P(0.92, 0.22), r: 34 }, { type: 'pore', ...f.P(0.925, 0.68), r: 34, key: ['C1', 'C2'] },
    ];
    return { W, H, geo, ents, pal: PAL.lode, spawn: { ...f.P(0.06, 0.5), n: 100 }, minMass: 100, decor: 0.5 };
  } },
  // ── IV · ABYSS ─────────────────────────────────────────────────────────
  { id: 'veil', name: 'Veil', par: 40, hint: 'still', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    // pillars to hide behind, and walls to rest against: stillness is a verb
    [[0.30, 0.62], [0.46, 0.36], [0.62, 0.64], [0.76, 0.40]].forEach(q => { const p = f.p(q[0], q[1]); geo.push({ op: 'add', t: 'circle', x: p[0], y: p[1], r: 34 }); });
    const down = f.land ? Math.PI / 2 : 0, up = f.land ? -Math.PI / 2 : Math.PI;
    const ents = [
      { type: 'watcher', ...f.P(0.38, 0.09), a: down, sweep: 0.75, speed: 0.55, range: 300 }, { type: 'watcher', ...f.P(0.60, 0.91), a: up, sweep: 0.75, speed: 0.6, phase: 1.6, range: 300 }, { type: 'watcher', ...f.P(0.80, 0.09), a: down, sweep: 0.6, speed: 0.7, phase: 3, range: 280 },
      ...trail(f, [[0.16, 0.30], [0.24, 0.5], [0.16, 0.70]], 5), ...trail(f, [[0.34, 0.40], [0.40, 0.56], [0.52, 0.52]], 6), ...trail(f, [[0.54, 0.44], [0.66, 0.46], [0.70, 0.58]], 6, 3), ...trail(f, [[0.80, 0.56], [0.86, 0.70]], 3),
      { type: 'pore', ...f.P(0.90, 0.5), r: 36 },
    ];
    return { W, H, geo, ents, pal: PAL.abyss, spawn: { ...f.P(0.09, 0.5), n: 80 }, minMass: 80 };
  } },
  { id: 'tidepool', name: 'Tidepool', par: 38, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const c = f.P(0.5, 0.5);
    geo.push({ op: 'add', t: 'circle', x: c.x, y: c.y, r: 56 });
    // four rivers chasing each other round the island: ride the gyre or fight it
    const a1 = f.vec(1, 0), a2 = f.vec(0, 1); const lw = f.land ? [f.Lu * 0.46, 120] : [120, f.Lu * 0.46], lh = f.land ? [120, f.Lv * 0.5] : [f.Lv * 0.5, 120];
    const ents = [
      { type: 'current', ...f.P(0.5, 0.2), w: lw[0], h: lw[1], vx: a1[0] * 210, vy: a1[1] * 210 }, { type: 'current', ...f.P(0.5, 0.8), w: lw[0], h: lw[1], vx: -a1[0] * 210, vy: -a1[1] * 210 },
      { type: 'current', ...f.P(0.76, 0.5), w: lh[0], h: lh[1], vx: a2[0] * 210, vy: a2[1] * 210 }, { type: 'current', ...f.P(0.24, 0.5), w: lh[0], h: lh[1], vx: -a2[0] * 210, vy: -a2[1] * 210 },
      ...trail(f, [[0.30, 0.2], [0.70, 0.2]], 8), ...trail(f, [[0.76, 0.32], [0.76, 0.68]], 5), ...trail(f, [[0.70, 0.8], [0.30, 0.8]], 8), ...trail(f, [[0.24, 0.68], [0.24, 0.32]], 5),
      ...moteRing(c.x, c.y, 84, 6, 3, { col: [0.8, 0.7, 1] }), { type: 'pore', ...f.P(0.90, 0.88), r: 36 },
    ];
    return { W, H, geo, ents, pal: PAL.abyss, spawn: { ...f.P(0.09, 0.12), n: 90 }, minMass: 90 };
  } },
  { id: 'event-horizon', name: 'Event Horizon', par: 34, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H); const c = f.P(0.5, 0.5);
    const ents = [
      { type: 'well', x: c.x, y: c.y, r: 24, reach: 330, strength: 175000, swirl: 60000 },
      ...moteRing(c.x, c.y, 92, 8, 4, { col: [0.86, 0.72, 1] }), ...moteRing(c.x, c.y, 160, 12, 2, { a0: 0.3 }), ...moteRing(c.x, c.y, 230, 12, 2, { a0: 0.1 }),
      { type: 'pool', kind: 'heal', ...f.P(0.12, 0.84), r: 44, max: 40 }, { type: 'pore', ...f.P(0.90, 0.14), r: 36 },
    ].filter(e => e.type !== 'mote' || (e.x > 70 && e.y > 70 && e.x < W - 70 && e.y < H - 70));
    return { W, H, geo, ents, pal: PAL.abyss, spawn: { ...f.P(0.09, 0.14), n: 100 }, minMass: 100 };
  } },
  { id: 'bluff', name: 'Bluff', par: 64, hint: 'swell', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    geo.push(f.box(0.5, 0.26, f.Lu * 0.30, 36, 18), f.box(0.5, 0.74, f.Lu * 0.30, 36, 18));
    const ents = [...trail(f, [[0.18, 0.20], [0.30, 0.14]], 4), ...trail(f, [[0.18, 0.80], [0.30, 0.86]], 4), ...trail(f, [[0.36, 0.5], [0.64, 0.5]], 9, 3), ...trail(f, [[0.40, 0.12], [0.60, 0.12]], 5), ...trail(f, [[0.40, 0.88], [0.60, 0.88]], 5), ...moteRing(f.P(0.86, 0.5).x, f.P(0.86, 0.5).y, 62, 5, 2),
      { type: 'pore', ...f.P(0.88, 0.5), r: 36 }];
    return { W, H, geo, ents, pal: PAL.abyss, spawn: { ...f.P(0.09, 0.5), n: 56 }, minMass: 56, cap: 56, rivals: [{ kind: 'hunter', ...f.P(0.5, 0.5), n: 104 }, { kind: 'hunter', ...f.P(0.70, 0.30), n: 100 }, { kind: 'hunter', ...f.P(0.70, 0.72), n: 100 }] };
  } },
  { id: 'hunt', name: 'The Hunt', par: 110, quota: 0, hint: 'coil', build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H);
    geo.push({ op: 'add', t: 'circle', ...f.P(0.36, 0.34), r: 44 }, { op: 'add', t: 'circle', ...f.P(0.64, 0.66), r: 52 }, f.box(0.5, 0.5, 30, 150, 15, { mat: SURF.GLASS }));
    const ents = [...trail(f, [[0.2, 0.2], [0.5, 0.14], [0.8, 0.2]], 9), ...trail(f, [[0.2, 0.8], [0.5, 0.86], [0.8, 0.8]], 9), ...moteRing(f.P(0.36, 0.34).x, f.P(0.36, 0.34).y, 70, 6), ...moteRing(f.P(0.64, 0.66).x, f.P(0.64, 0.66).y, 78, 6),
      { type: 'pool', kind: 'heal', ...f.P(0.12, 0.14), r: 44, max: 70 },
      { type: 'pore', ...f.P(0.9, 0.5), key: { fn: (Wd) => !Wd.colonies.some(C => C.kind === 'hunter' && C.orgs.some(o => o.alive && o.B.count >= 20)) }, col: [1, 0.5, 0.62] }];
    const r = [{ kind: 'grazer', ...f.P(0.3, 0.7), n: 26 }, { kind: 'grazer', ...f.P(0.7, 0.3), n: 26 }, { kind: 'grazer', ...f.P(0.5, 0.82), n: 22 }, { kind: 'hunter', ...f.P(0.82, 0.74), n: 96 }, { kind: 'hunter', ...f.P(0.78, 0.22), n: 84 }];
    return { W, H, geo, ents, pal: PAL.abyss, spawn: { ...f.P(0.10, 0.5), n: 56 }, minMass: 56, cap: 56, rivals: r };
  } },
  { id: 'heart', name: 'The Heart', par: 60, quota: 0.5, build(a) {
    const f = L(a), { W, H } = f; const geo = dish(W, H, { r: Math.min(W, H) * 0.42 }); const c = f.P(0.5, 0.5);
    const dd = f.vec(-1, 0), a0 = Math.atan2(-dd[1], -dd[0]);          // the doorway faces where you arrive from
    geo.push({ op: 'add', t: 'ring', x: c.x, y: c.y, R: 150, r: 15, mat: SURF.GLASS });
    geo.push({ op: 'carve', t: 'box', x: c.x + dd[0] * 150, y: c.y + dd[1] * 150, w: dd[0] ? 44 : 120, h: dd[0] ? 120 : 44, r: 8 });
    const ents = [{ type: 'pore', x: c.x, y: c.y, r: 50, key: 'G', col: [1, 0.62, 0.5] }];
    // three pads around the heart: only a body in three places at once lifts the shell's door
    [0, 1, 2].forEach((k) => { const an = a0 + k * TAU / 3; const px = c.x + Math.cos(an) * 250, py = c.y + Math.sin(an) * 250; ents.push({ type: 'pad', id: 'ABC'[k], x: px, y: py, need: 14, r: 44 }, ...moteRing(px, py, 64, 6, 2)); });
    [1, -1].forEach((sg) => { const an = a0 + sg * TAU / 6; ents.push({ type: 'blade', x: c.x + Math.cos(an) * 215, y: c.y + Math.sin(an) * 215, len: 100, spin: sg * 1.3 }); });
    ents.push({ type: 'blade', x: c.x + dd[0] * 84, y: c.y + dd[1] * 84, len: 84, spin: 1.6 });
    ents.push({ type: 'gate', id: 'G', x: c.x + dd[0] * 150, y: c.y + dd[1] * 150, w: dd[0] ? 36 : 150, h: dd[0] ? 150 : 36, dx: dd[0] ? 0 : 116, dy: dd[0] ? 116 : 0, need: ['A', 'B', 'C'], latch: true, surf: SURF.GLASS }, ...moteRing(c.x, c.y, 100, 10, 3, { col: [1, 0.8, 0.6] }));
    const sd = Math.min(330, (f.Lu / 2) - 90);
    return { W, H, geo, ents: ents.filter(e => e.type !== 'mote' || (e.x > 60 && e.y > 60 && e.x < W - 60 && e.y < H - 60)), pal: PAL.abyss, spawn: { x: c.x + dd[0] * sd, y: c.y + dd[1] * sd, n: 120 }, minMass: 120 };
  } },
];
export { PAL, L as layout, MAT, TAU };

// the four strata, by the chamber that opens each
export const STRATA = [['Dew', 'first-light'], ['Glassworks', 'comb'], ['Chemistry', 'amber'], ['Abyss', 'veil']].map(([name, id]) => ({ name, from: ROOMS.findIndex(r => r.id === id) }));
export function stratumOf(i) { let k = 0; for (let q = 0; q < STRATA.length; q++) if (i >= STRATA[q].from) k = q; return k; }
