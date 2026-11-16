// The eight foundational laws, measured — not asserted. Each test builds a tiny world, does one thing, and prints numbers.
//   node tools/axioms.mjs            (exit code 1 if any law fails)
import './node-env.mjs';
import { World } from '../src/world/world.js';
import { frame, dish } from '../src/world/rooms.js';
import { MAT, SURF } from '../src/sim/materials.js';
import { Odyssey } from '../src/modes/odyssey.js';
import { save } from '../src/core/save.js';

// the worlds below spawn with a little randomness; a fixed seed makes every run of this file the same run (pass a number to try another)
{ let a = (+process.argv[2] || 20261116) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const out = []; let fails = 0;
const law = (n, name, ok, detail) => { if (!ok) fails++; out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}. ${name}\n        ${detail}`); };
const { W: RW, H: RH } = frame(16 / 9);
function world(o = {}) {
  const spec = { name: 'lab', seed: 5, W: RW, H: RH, geo: [...dish(RW, RH), ...(o.geo || [])], ents: o.ents || [], rivals: o.rivals || [], spawn: { x: o.x ?? RW * 0.3, y: o.y ?? RH * 0.5, n: o.n ?? 90 } };
  const W = new World({}); W.load(spec, {}); W.listener = o.listener || {}; return W;
}
const ctl0 = () => ({ intent: { x: 0, y: 0 }, aim: null, rally: false, darts: null, buds: null, swell: false, cycle: 0, focusAt: null });
const run = (W, secs, ctl = ctl0(), each) => { for (let f = 0; f < Math.round(secs * 60); f++) { if (each) each(f / 60, ctl); W.step(1 / 60, ctl); ctl.darts = null; ctl.buds = null; ctl.cycle = 0; ctl.focusAt = null; } };
const grains = (W, B) => { const P = W.phys, a = []; for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.alive[i] && P.body[i] === B.id) a.push(i); } return a; };
// silhouette area: union of little discs around the grains, counted on a 4 px grid
function area(W, B) { const P = W.phys, S = new Set(), R = 6.5; for (const i of grains(W, B)) { const x = P.x[i], y = P.y[i]; for (let gy = Math.floor((y - R) / 4); gy <= (y + R) / 4; gy++) for (let gx = Math.floor((x - R) / 4); gx <= (x + R) / 4; gx++) { const dx = gx * 4 + 2 - x, dy = gy * 4 + 2 - y; if (dx * dx + dy * dy <= R * R) S.add(gy * 4096 + gx); } } return S.size * 16; }
// the outline as 24 spokes (furthest grain in each direction): its polygon area, and how much each spoke ripples in time
const spokes = (W, B) => { const P = W.phys, r = new Float32Array(24); for (const i of grains(W, B)) { const dx = P.x[i] - B.cx, dy = P.y[i] - B.cy, k = Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 24) % 24, d = Math.hypot(dx, dy) + 4; if (d > r[k]) r[k] = d; } return r; };
const hull = (W, B) => { const r = spokes(W, B); let a = 0; for (let k = 0; k < 24; k++) a += 0.5 * r[k] * r[(k + 1) % 24] * Math.sin(2 * Math.PI / 24); return a; };
const extent = (W, B, ux, uy) => { const P = W.phys; let lo = 1e9, hi = -1e9; for (const i of grains(W, B)) { const s = (P.x[i] - B.cx) * ux + (P.y[i] - B.cy) * uy; if (s < lo) lo = s; if (s > hi) hi = s; } return [lo, hi]; };
const pct = (a, b) => `${a >= b ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}%`;

// ── 1. area conservation — and the bluff ───────────────────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.5 }); run(W, 2); const F = W.player.focus, B = F.B; const n0 = B.count, a0 = area(W, B);
  const c = ctl0(); c.intent.y = 1; run(W, 2.2, c);                                   // lean hard into the floor: flattened
  const [lo, hi] = extent(W, B, 1, 0), [lo2, hi2] = extent(W, B, 0, 1); const a1 = area(W, B), flat = (hi - lo) / (hi2 - lo2);
  const W2 = world({ x: RW * 0.5 }); run(W2, 2); const B2 = W2.player.focus.B, b0 = hull(W2, B2); const s = ctl0(); s.swell = true; run(W2, 1.4, s); const b1 = hull(W2, B2), r1 = B2.count;
  law(1, 'Contextual 2D area conservation', Math.abs(a1 / a0 - 1) < 0.18 && flat > 1.25 && b1 / b0 > 1.5 && r1 === n0 && B.count === n0,
    `pressed flat against a wall the silhouette is ${flat.toFixed(2)}× wider than tall, its area ${pct(a1, a0)} (same ${n0} grains);  a held breath swells the silhouette ${pct(b1, b0)} with exactly ${r1} grains — volume bluffed, no mass added`);
}
// ── 2. breathing: smooth, and its amplitude reads the state ────────────────────────────────────────────────────────
{
  // ripple = how far each spoke of the outline moves about its own half-second average; (the waves are modes 2 and 3 of the outline: they move area around, never add any)
  const meas = (mode) => { const wall = mode === 'veil' || mode === 'wall'; const W = world({ x: RW * 0.5, y: wall ? RH - 80 : RH * 0.5 }); const F = W.player.focus, B = F.B; F.canVeil = mode === 'veil';
    if (wall) { const c = ctl0(); c.intent.y = 1; run(W, 1.2, c); } run(W, wall ? 12 : 3.5);       // (a veiling body first spreads thin against the wall: let it finish)
    const hist = []; let areaMin = 1e9, areaMax = 0, veil = 0, breath = 0, stir = 0, ns = 0; const P = W.phys;
    run(W, 6, ctl0(), () => { if (mode === 'startle') F.excite = 1; hist.push(spokes(W, B)); const a = area(W, B); areaMin = Math.min(areaMin, a); areaMax = Math.max(areaMax, a); veil = F.veil; breath = B.breath; for (const i of grains(W, B)) { stir += Math.hypot(P.vx[i] - B.vx, P.vy[i] - B.vy); ns++; } });
    // (slow settling is not breath: each spoke is detrended before its swing is measured)
    let rip = 0, jerk = 0; const N = hist.length; for (let k = 0; k < 24; k++) { let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let t = 0; t < N; t++) { sx += t; sy += hist[t][k]; sxx += t * t; sxy += t * hist[t][k]; } const sl = (N * sxy - sx * sy) / (N * sxx - sx * sx), a = (sy - sl * sx) / N; let v = 0; for (let t = 0; t < N; t++) { const e = hist[t][k] - a - sl * t; v += e * e; } rip += Math.sqrt(v / N) / 24; }
    return { rip, wob: areaMax / areaMin - 1, veil, breath, stir: stir / ns }; };
  const idle = meas('idle'), scared = meas('startle'), wall = meas('wall'), still = meas('veil');
  law(2, 'Smooth, state-dependent, area-conserving breathing', idle.rip > 0.3 && scared.rip > idle.rip * 1.5 && still.stir < wall.stir * 0.75 && still.veil > 0.7 && idle.wob < 0.08,
    `outline swing (each of 24 spokes about its own trend): idle ${idle.rip.toFixed(2)} px, startled ${scared.rip.toFixed(2)} px;  inner motion (grains against the body's own drift): idle ${idle.stir.toFixed(1)}, startled ${scared.stir.toFixed(1)}, resting on a wall ${wall.stir.toFixed(1)}, the same pose veiled ${still.stir.toFixed(1)} px/s (breath held: drive ${still.breath.toFixed(3)} against ${wall.breath.toFixed(3)});  while it breathes the idle body's area varies by only ${(idle.wob * 100).toFixed(1)}% — the wave moves area, it never makes any`);
}
// ── 3. force fields and near-field reactivity ──────────────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.34, ents: [{ type: 'well', x: RW * 0.56, y: RH * 0.5, r: 17, reach: 260 }] }); run(W, 0.6); const B = W.player.focus.B; const x0 = B.cx; let stretch = 0, gap0 = 0;
  run(W, 1.2, ctl0(), () => { const [lo, hi] = extent(W, B, 1, 0), [l2, h2] = extent(W, B, 0, 1); const s = (hi - lo) / (h2 - l2); if (s > stretch) { stretch = s; gap0 = RW * 0.56 - 17 - (B.cx + hi); } });
  law(3, 'Generalised force fields, pre-contact deformation', B.cx - x0 > 25 && stretch > 1.06 && gap0 > 10,
    `with no input a well ${Math.round(RW * 0.22)} px away drew the body ${(B.cx - x0).toFixed(0)} px in 1.2 s and stretched it ${stretch.toFixed(2)}× along the pull while still ${gap0.toFixed(0)} px short of touching`);
}
// ── 4. mass–energy: gliding is free, violence costs ────────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.2 }); run(W, 1); const pl = W.player; const n0 = pl.mass; const c = ctl0(); c.intent.x = 1; run(W, 2.5, c); const cruise = n0 - pl.mass;
  const d = ctl0(); d.darts = [{ x: 1, y: 0, power: 1 }]; run(W, 0.2, d); const afterDart = pl.mass;
  const f1 = ctl0(); f1.intent.x = -1; run(W, 1.5, f1); const fetched = pl.mass - afterDart;                       // the jet lies behind as dew for a couple of seconds: turn straight round for it
  run(W, 0.4); const beforeLance = pl.mass; const l = ctl0(); l.darts = [{ x: 1, y: 0, power: 1.5 }]; run(W, 0.25, l); const afterLance = pl.mass; run(W, 4); const left = pl.mass;
  law(4, 'Contextual mass–energy equivalence', cruise === 0 && afterDart < n0 && beforeLance - afterLance > n0 - afterDart && fetched >= 1 && left === afterLance,
    `2.5 s of cruising cost ${cruise} grains;  a dart cost ${n0 - afterDart} (a jet of dew thrown behind) — turning straight round fetched ${fetched} of it home;  a coiled lance cost ${beforeLance - afterLance}, and left alone that dew faded: ${left} grains remain of ${n0}`);
}
// ── 5. the unbreakable floor ───────────────────────────────────────────────────────────────────────────────────────
{
  const W = world({ n: 14, x: RW * 0.4, rivals: [{ kind: 'hunter', x: RW * 0.5, y: RH * 0.5, n: 120 }] }); let min = 1e9, ember = false; const c = ctl0();
  run(W, 12, c, () => { const F = W.player.focus, hunter = W.colonies.find(C => C.kind === 'hunter').orgs[0]; if (F && hunter) { const dx = hunter.B.cx - F.B.cx, dy = hunter.B.cy - F.B.cy, dd = Math.hypot(dx, dy) + 1; c.intent.x = dx / dd; c.intent.y = dy / dd; } min = Math.min(min, W.player.mass); ember = ember || W.ember; });      // walk straight into the predator's mouth, for twelve seconds
  // …and if every last grain is somehow gone, the chamber gives back a seed
  const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' || k === 'muted' ? false : noop), apply: () => 0 }); const world2 = new World({});
  const app = { world: world2, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {}, travel(specFn, carryFn, o = {}) { const spec = specFn(16 / 9); world2.load(spec, carryFn(spec) || {}); world2.listener = this.mode; o.onLoad && o.onLoad(world2); } };
  const st = globalThis.setTimeout; globalThis.setTimeout = () => 0; const mode = new Odyssey(app, 0, {}); app.mode = mode; mode.enter(); run(world2, 0.5); const P = world2.phys; for (let i = 0; i < P.hi; i++) if (P.alive[i] && world2.player.orgs.some(o => o.B.id === P.body[i])) P.kill(i); run(world2, 0.5); globalThis.setTimeout = st;
  law(5, 'Unbreakable non-zero survival floor', min >= 1 && ember && world2.player.mass >= 20,
    `fed head-first to a hunter nine times its size for 12 s, the body never fell below ${min} grains (ember form: ${ember});  with every grain deleted outright, the chamber rekindled a seed of ${world2.player.mass}`);
}
// ── 6. local actuation, global viscoelastic coupling ───────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.3, n: 140 }); run(W, 2); const F = W.player.focus, B = F.B, P = W.phys; const g = grains(W, B); const x0 = new Map(g.map(i => [i, P.x[i]])); const s0 = new Map(g.map(i => [i, P.x[i] - B.cx]));
  const c = ctl0(); c.intent.x = 1; run(W, 0.25, c); let front = 0, rear = 0, nf = 0, nr = 0; for (const i of g) { const d = P.x[i] - x0.get(i); if (s0.get(i) > B.r * 0.45) { front += d; nf++; } else if (s0.get(i) < -B.r * 0.45) { rear += d; nr++; } } front /= nf; rear /= nr;
  run(W, 1.2, c); const [lo, hi] = extent(W, B, 1, 0), [l2, h2] = extent(W, B, 0, 1); const stride = (hi - lo) / (h2 - l2);
  run(W, 1.5); const [lo3, hi3] = extent(W, B, 1, 0), [l4, h4] = extent(W, B, 0, 1); const rest = (hi3 - lo3) / (h4 - l4);
  law(6, 'Local actuation, global viscoelastic coupling', front > rear * 1.2 && front > 3 && Math.abs(rest - 1) < 0.2,
    `0.25 s into a push the leading third has moved ${front.toFixed(1)} px, the trailing third ${rear.toFixed(1)} px (a pseudopod leads, the rest follows);  mid-stride the body is ${stride.toFixed(2)}× long, and 1.5 s after letting go it has gathered back to ${rest.toFixed(2)}`);
}
// ── 7. one continuum: split, passivation, re-fusion ────────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.4, n: 120 }); run(W, 1.5); const pl = W.player; const n0 = pl.mass; const F = pl.focus;
  const b = ctl0(); b.buds = [{ x: F.B.cx + 150, y: F.B.cy, frac: 0.4 }]; run(W, 0.1, b); run(W, 0.25); const two = pl.orgs.filter(o => o.alive).length, sum = pl.mass;
  const c = ctl0(); c.intent.x = 1; let touchT = -1, fuseT = -1; run(W, 4, c, (t) => { const live = pl.orgs.filter(o => o.alive); if (live.length === 2 && touchT < 0) { const [p, q] = live; if (Math.hypot(p.B.cx - q.B.cx, p.B.cy - q.B.cy) < p.B.r + q.B.r + 4) touchT = t; } if (live.length === 1 && fuseT < 0) fuseT = t; });
  law(7, 'Single/multi-body continuum, contextual re-fusion', two === 2 && sum === n0 && fuseT > 0 && pl.mass === n0 && (touchT < 0 || fuseT - touchT > 0.1),
    `a bud made ${two} bodies holding ${sum}/${n0} grains;  driven back together they touched at ${touchT < 0 ? '—' : touchT.toFixed(2) + ' s'} and, the fresh cut still passivated, only knit into one at ${fuseT.toFixed(2)} s — again ${pl.mass} grains, none lost`);
}
// ── 8. many fragments, one will ────────────────────────────────────────────────────────────────────────────────────
{
  const W = world({ x: RW * 0.35, n: 150, geo: [{ op: 'add', t: 'circle', x: RW * 0.62, y: RH * 0.3, r: 30, mat: SURF.GLASS }] }); run(W, 1.5); const pl = W.player; let F = pl.focus;
  const b = ctl0(); b.buds = [{ x: F.B.cx + 190, y: F.B.cy - 20, frac: 0.3 }]; run(W, 0.1, b); run(W, 0.6); const b2 = ctl0(); b2.buds = [{ x: F.B.cx - 40, y: F.B.cy + 170, frac: 0.08 }]; run(W, 0.1, b2); run(W, 0.3);
  const live = () => pl.orgs.filter(o => o.alive); const n3 = live().length; const sizes = live().map(o => o.B.count).sort((p, q) => q - p);
  const tiny = live().slice().sort((p, q) => p.B.count - q.B.count)[0]; const t = ctl0(); t.focusAt = { x: tiny.B.cx, y: tiny.B.cy }; run(W, 0.05, t); const tapped = pl.focus === tiny; const tinyN = tiny.B.count;
  const cy = ctl0(); cy.cycle = 1; run(W, 0.05, cy); const cycled = pl.focus !== tiny;
  // an accident now: a splash of eight grains is knocked clean off the body. Nobody steers it — it should come home by itself.
  { const P = W.phys, Fb = pl.focus.B; const g = grains(W, Fb).sort((p, q) => P.x[q] - P.x[p]).slice(0, 8); for (const i of g) { P.x[i] += 70; P.ox[i] = P.x[i]; P.oy[i] = P.y[i]; P.vx[i] = 0; P.vy[i] = 0; for (let k = 0; k < 6; k++) P.sj[i * 6 + k] = -1; } P.forceComponents = true; }
  run(W, 0.15); const n4 = live().length; let strayHome = -1; run(W, 6, ctl0(), (tt) => { if (strayHome < 0 && live().length < n4) strayHome = tt; });
  const r = ctl0(); r.rally = true; let allHome = -1; run(W, 8, r, (tt) => { if (allHome < 0 && live().length === 1) allHome = tt; });
  law(8, 'Multi-fragment control', n3 === 3 && tapped && cycled && n4 === n3 + 1 && strayHome > 0 && allHome > 0 && pl.mass === 150,
    `three bodies of ${sizes.join(' / ')} grains on one fixed screen (nothing ever leaves the frame);  one tap focused the ${tinyN}-grain one, one key cycled on;  an eight-grain splash knocked off by accident rolled home by itself in ${strayHome < 0 ? '> 6' : strayHome.toFixed(1)} s, unpiloted;  a held rally gathered everything into one body of ${pl.mass} in ${allHome.toFixed(1)} s more`);
}
// ── bonus: the non-Newtonian promise (silky when caressed, armour when struck) ─────────────────────────────────────
{
  const wallX = RW - 34;
  const squash = (mat, speed) => { const W = world({ x: RW * (speed < 400 ? 0.84 : 0.74), n: 110 }); run(W, 1); const F = W.player.focus, B = F.B; if (mat) { W.morph(B, mat, { speed: 1, tonus: 1, dart: 1 }); run(W, 1); }
    F.launch(speed, 0, 0.9); let worst = 9; run(W, 1.3, ctl0(), () => { const [lo, hi] = extent(W, B, 1, 0), [l2, h2] = extent(W, B, 0, 1); if (B.cx + hi > wallX - 10) worst = Math.min(worst, (hi - lo) / (h2 - l2)); }); return worst; };
  const gelSlow = squash(0, 300), gelFast = squash(0, 620), armSlow = squash(MAT.BASTION, 300), armFast = squash(MAT.BASTION, 620);
  law('+', 'Shear-thickening armour', armFast > gelFast * 1.6 && armFast > 0.8 && Math.abs(armSlow - gelSlow) < 0.2,
    `thrown at a wall at 620 px/s plain gel pancakes to ${gelFast.toFixed(2)} of its width; armour keeps ${armFast.toFixed(2)} — it takes the blow as one piece and rebounds;  arriving at walking pace they give alike (${gelSlow.toFixed(2)} vs ${armSlow.toFixed(2)}) — soft to a caress, hard to a blow`);
}
console.log(out.join('\n')); console.log(fails ? `\n${fails} law(s) FAILED` : '\nall laws hold'); process.exit(fails ? 1 : 0);
