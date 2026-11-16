// ─────────────────────────────────────────────────────────────────────────────
//  Abyss chambers — a generative system instead of a list. A seed and a depth
//  choose the architecture, the light, the machines and the neighbours; every
//  rule a chamber may use was first taught, wordlessly, in the Odyssey.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF } from '../sim/materials.js';
import { rng, TAU } from '../core/util.js';
import { frame, dish } from './rooms.js';
import { moteRing, moteTrail } from './entities.js';
import { PAL } from './odyssey.js';

const PALS = [PAL.dew, PAL.glass, PAL.amber, PAL.abyss];
export const AXIOMS = [
  { id: 'still', name: 'Still Water', sub: 'the slide as you know it' },
  { id: 'thick', name: 'Thick Water', sub: 'everything drags', apply: (s) => { s.drag = 2.6; } },
  { id: 'hungry', name: 'Hungry Dark', sub: 'a well waits in every chamber', apply: (s, R, W, H) => { s.ents.push({ type: 'well', x: W * R.range(0.4, 0.6), y: H * R.range(0.4, 0.6), r: 18, reach: 210 }); } },
  { id: 'feast', name: 'Feast', sub: 'twice the light, twice the mouths', apply: (s) => { s.moteMul = 2; s.rivalMul = 2; } },
  { id: 'glass', name: 'Glass Storm', sub: 'blades in every chamber', apply: (s, R, W, H) => { s.ents.push({ type: 'blade', x: W * R.range(0.3, 0.7), y: H * R.range(0.3, 0.7), len: 130, spin: R.sign() * 1.4 }); } },
  { id: 'swift', name: 'Quick Tide', sub: 'you, and everything else, move faster', apply: (s) => { s.speedScale = 1.3; } },
];

export function abyssRoom(aspect, depth, seed, axiom, mass = 60) {
  const { W, H } = frame(aspect); const R = rng(seed + depth * 7919);
  const geo = dish(W, H, { r: Math.min(W, H) * R.range(0.16, 0.3) });
  const ents = [], rivals = []; const taken = [];
  const free = (x, y, r) => { if (x < 80 + r || y < 80 + r || x > W - 80 - r || y > H - 80 - r) return false; for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + r) return false; return true; };
  const place = (r, tries = 40) => { for (let k = 0; k < tries; k++) { const x = R.range(90, W - 90), y = R.range(90, H - 90); if (free(x, y, r)) { taken.push([x, y, r]); return { x, y }; } } return null; };
  const spawn = { x: W * 0.5, y: H * 0.5, n: 40 }; taken.push([spawn.x, spawn.y, 90]);
  const arena = depth % 5 === 0;
  // architecture: organic islands of different stuff
  const nIs = arena ? 2 : R.int(2, 4);
  for (let k = 0; k < nIs; k++) {
    const r = R.range(34, 64); const p = place(r + 46); if (!p) continue;
    const mat = R.pick([SURF.STONE, SURF.STONE, SURF.GLASS, SURF.RESIN]);
    if (R.chance(0.5)) geo.push({ op: 'add', t: 'circle', x: p.x, y: p.y, r, mat });
    else { const a = R.range(0, TAU), l = r * R.range(0.9, 1.6); geo.push({ op: 'add', t: 'cap', ax: p.x - Math.cos(a) * l, ay: p.y - Math.sin(a) * l, bx: p.x + Math.cos(a) * l, by: p.y + Math.sin(a) * l, r: r * 0.42, mat }); }
    if (!arena && R.chance(0.75)) ents.push(...moteRing(p.x, p.y, r + 34, R.int(5, 8), 2, { a0: R.range(0, 6) }));
  }
  const spec = { W, H, geo, ents, rivals, spawn, pal: PALS[(Math.floor((depth - 1) / 3)) % PALS.length], seed: seed + depth, moteMul: 1, rivalMul: 1, arena };
  // machines, by depth
  const haz = Math.min(4, Math.floor((depth + 1) / 2)) - (arena ? 1 : 0);
  for (let k = 0; k < haz; k++) {
    const kind = R.pick(depth < 3 ? ['grinder'] : depth < 5 ? ['grinder', 'blade', 'current', 'frost'] : ['grinder', 'blade', 'current', 'well', 'crusher', 'frost']);
    if (kind === 'grinder') { const r = R.range(30, 46); const p = place(r + 60); if (p) { ents.push({ type: 'grinder', ...p, r, spin: R.sign() * R.range(2, 3.2), orbit: R.chance(0.4) ? { x: p.x, y: p.y, r: 40, w: R.range(0.5, 1) } : null }); ents.push(...moteRing(p.x, p.y, r + 30, 5, 3, { col: [0.6, 0.95, 1] })); } }
    else if (kind === 'blade') { const p = place(100); if (p) { ents.push({ type: 'blade', ...p, len: R.range(110, 160), spin: R.sign() * R.range(1.1, 1.8) }); ents.push(...moteRing(p.x, p.y, 30, 4, 3)); } }
    else if (kind === 'current') { const p = place(60); if (p) { const horiz = R.chance(0.5); ents.push({ type: 'current', ...p, w: horiz ? 300 : 130, h: horiz ? 130 : 300, vx: horiz ? R.sign() * 190 : 0, vy: horiz ? 0 : R.sign() * 190 }); } }
    else if (kind === 'well') { const p = place(120); if (p) { ents.push({ type: 'well', ...p, r: 17, reach: 220 }); ents.push(...moteRing(p.x, p.y, 74, 7, 3, { col: [0.8, 0.7, 1] })); } }
    else if (kind === 'frost') { const p = place(110); if (p) { ents.push({ type: 'frost', ...p, r: 110 }, ...moteRing(p.x, p.y, 46, 6, 3, { col: [0.7, 0.92, 1] })); const v = place(60); if (v) ents.push({ type: 'vent', ...v }); } }
    else if (kind === 'crusher') { const p = place(120); if (p) ents.push({ type: 'crusher', ...p, w: 90, h: 110, travel: 110, period: R.range(2.4, 3.2), dir: R.chance(0.5) ? [0, 1] : [1, 0] }); }
  }
  // a vault: a ring of glass turning around a hoard of bright motes — worth the wait at its doorway
  if (!arena && depth >= 3 && R.chance(0.45)) { const rr = R.range(58, 74); const p = place(rr + 44, 60); if (p) { ents.push({ type: 'rotor', ...p, R: rr, r: 7, gap: R.range(0.5, 0.62), spin: R.sign() * R.range(0.5, 0.8), col: [1.0, 0.8, 0.5] }, ...moteRing(p.x, p.y, rr * 0.45, 5, 4, { col: [1.0, 0.8, 0.5] })); } }
  if (axiom && axiom.apply) axiom.apply(spec, R, W, H);
  // light
  if (!arena) {
    const nTr = Math.round(R.int(2, 3) * spec.moteMul);
    for (let k = 0; k < nTr; k++) { const a = place(30), b = place(30); if (a && b) ents.push(...moteTrail([[a.x, a.y], [(a.x + b.x) / 2 + R.range(-80, 80), (a.y + b.y) / 2 + R.range(-80, 80)], [b.x, b.y]], R.int(5, 8), 2)); }
    if (depth > 2) { const p = place(70); if (p) ents.push({ type: 'pool', kind: 'heal', ...p, r: 46, max: 30 }); }
  }
  // neighbours
  const nG = Math.round((arena ? 3 : Math.min(3, 1 + Math.floor(depth / 3))) * spec.rivalMul), nH = arena ? 1 + Math.floor(depth / 10) : depth >= 3 ? Math.min(2, Math.floor(depth / 4) + (R.chance(0.5) ? 1 : 0)) : 0;
  // neighbours are measured against you: grazers are always a meal, lancers hover around your own size —
  // and from the fourth depth on one of them is an apex, bigger than you, that only wit (a lance, a held breath) will answer
  const m = Math.max(40, Math.min(260, mass));
  for (let k = 0; k < nG; k++) { const p = place(50); if (p) rivals.push({ kind: 'grazer', ...p, n: Math.round(Math.max(18, Math.min(120, m * R.range(0.28, 0.6)))) }); }
  for (let k = 0; k < nH; k++) { const p = place(60); const apex = k === 0 && depth >= 4; if (p) rivals.push({ kind: 'hunter', ...p, n: Math.round(Math.max(40, Math.min(340, m * (apex ? R.range(1.25, 1.6) : R.range(0.6, 1.05))))) }); }
  if (depth >= 6 && R.chance(0.6)) { const p = place(60); if (p) rivals.push({ kind: 'thorn', ...p, n: R.int(40, 60) }); }
  if (depth >= 2 && R.chance(0.5)) { const p = place(50); if (p) rivals.push({ kind: 'oil', ...p, n: R.int(30, 60) }); }
  const pp = place(70, 80) || place(52, 80) || place(40, 120) || { x: W * 0.85, y: H * 0.5 }; ents.push({ type: 'pore', ...pp, r: 38, col: arena ? [1, 0.5, 0.62] : undefined });
  return spec;
}
