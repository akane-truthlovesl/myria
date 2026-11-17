// ─────────────────────────────────────────────────────────────────────────────
//  Abyss chambers — a generative system instead of a list. A seed and a depth
//  choose the architecture, the light, the machines and the neighbours; every
//  rule a chamber may use was first taught, wordlessly, in the Odyssey.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MAT } from '../sim/materials.js';
import { rng, TAU, hashStr } from '../core/util.js';
import { frame, dish } from './rooms.js';
import { moteRing, moteTrail } from './entities.js';
import { PAL } from './odyssey.js';
import { shoalOf, fireflyCloud } from './plankton.js';

const PALS = [PAL.dew, PAL.glass, PAL.amber, PAL.abyss];
export const AXIOMS = [
  { id: 'still', name: 'Still Water', sub: 'the slide as you know it' },
  { id: 'thick', name: 'Thick Water', sub: 'everything drags', apply: (s) => { s.drag = 2.6; } },
  // (these used to be dropped anywhere near the middle — which is where a diver is born: a well 43 px from the newborn creature, a blade through it)
  { id: 'hungry', name: 'Hungry Dark', sub: 'a well waits in every chamber', apply: (s, R, W, H, place) => { const p = place && (place(160) || place(120)); if (p) s.ents.push({ type: 'well', ...p, r: 18, reach: 210 }); } },
  { id: 'feast', name: 'Feast', sub: 'twice the light, twice the mouths', apply: (s) => { s.moteMul = 2; s.rivalMul = 2; } },
  { id: 'glass', name: 'Glass Storm', sub: 'blades in every chamber', apply: (s, R, W, H, place) => { const p = place && (place(110) || place(90)); if (p) s.ents.push({ type: 'blade', ...p, len: 130, spin: R.sign() * 1.4 }); } },
  { id: 'white', name: 'White Tide', sub: 'a geyser breathes in every chamber', apply: (s, R, W, H, place) => { const p = place && (place(110) || place(80)); if (p) s.ents.push({ type: 'geyser', ...p, period: R.range(4.2, 5.6) }); } },
  { id: 'masks', name: 'Masquerade', sub: 'not every light is light', apply: (s, R, W, H) => { for (let k = 0; k < 2; k++) s.ents.push({ type: 'mimic', x: W * R.range(0.2, 0.8), y: H * R.range(0.22, 0.78) }); } },
  { id: 'swift', name: 'Quick Tide', sub: 'you, and everything else, move faster', apply: (s) => { s.speedScale = 1.3; } },
  { id: 'glide', name: 'Glass Water', sub: 'nothing slows you down — nothing', apply: (s) => { s.drag = 0.6; } },
  { id: 'winter', name: 'Long Winter', sub: 'frost in every chamber, and one warm breath', apply: (s, R, W, H, place) => { const a = place && place(120), b = place && place(60); if (a) s.ents.push({ type: 'frost', ...a, r: 120, rate: 0.6 }); if (b) s.ents.push({ type: 'vent', ...b }); } },
  { id: 'rapids', name: 'Rapids', sub: 'a current crosses every chamber', apply: (s, R, W, H) => { s.ents.push({ type: 'current', x: W * 0.5, y: H * R.range(0.32, 0.68), w: W * 0.62, h: 110, vx: R.sign() * 250, vy: 0, k: 5 }); } },
  { id: 'bands', name: 'Slingshot', sub: 'taut bands wait along the walls', apply: (s, R, W, H) => { for (const u of [0.11, 0.89]) s.ents.push({ type: 'bumper', x: W * u, y: H * R.range(0.34, 0.66), len: 130, to: { x: W / 2, y: H / 2 }, kick: 560 }); } },
  { id: 'famine', name: 'Famine', sub: 'half the light — the rest must be hunted', apply: (s) => { s.moteMul = 0.5; s.rivalMul = 1.6; } },
  { id: 'giants', name: 'Giants', sub: 'fewer neighbours, far bigger', apply: (s) => { s.rivalMul = 0.6; s.rivalBig = 1.45; } },
  { id: 'night', name: 'Firefly Night', sub: 'every light blinks — and the dark finds its rhythm', apply: (s) => { s.fireflies = true; } },
  { id: 'air', name: 'Champagne', sub: 'bubbles drift in every chamber — swallow one and they take you for a giant', apply: (s, R, W, H, place) => { for (let k = 0; k < 5; k++) { const p = place && place(34); if (p) s.ents.push({ type: 'bubble', ...p, r: R.range(15, 24), life: 900 }); } } },
];
// The day's mutation of the world: one on a weekday, two at once on a weekend (never a pair that cancels out). Same for everyone, from the date alone.
const CLASH = [['thick', 'swift'], ['thick', 'glide'], ['feast', 'famine'], ['feast', 'giants']];
export function dailyAxioms(day) {
  const h = hashStr('myria' + day), pool = AXIOMS.slice(1); const a = pool[h % pool.length]; const dow = new Date(day + 'T00:00:00Z').getUTCDay(); if (dow !== 0 && dow !== 6) return [a];
  let k = (h >>> 9) % pool.length, b = pool[k]; for (let q = 0; q < pool.length && (b === a || CLASH.some(c => c.includes(a.id) && c.includes(b.id))); q++) b = pool[k = (k + 1) % pool.length];
  return [a, b];
}

export function abyssRoom(aspect, depth, seed, axiom, mass = 60) {
  const { W, H } = frame(aspect); const R = rng(seed + depth * 7919);
  const geo = dish(W, H, { r: Math.min(W, H) * R.range(0.16, 0.3) });
  const ents = [], rivals = []; const taken = [];
  // (r is a footprint that already carries its own breathing room: asking for the whole of it again from every wall and neighbour
  //  meant nothing larger than a current ever found a place — the deep was emptier than it was written to be)
  const free = (x, y, r) => { const m = 46 + r * 0.7; if (x < m || y < m || x > W - m || y > H - m) return false; for (const t of taken) if (Math.hypot(t[0] - x, t[1] - y) < t[2] + r * 0.75) return false; return true; };
  const place = (r, tries = 60) => { for (let k = 0; k < tries; k++) { const x = R.range(80, W - 80), y = R.range(80, H - 80); if (free(x, y, r)) { taken.push([x, y, r]); return { x, y }; } } return null; };
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
    // (a predator dish is about its predators: nothing in it grinds, drinks or swallows — only things that move you)
    const kind = R.pick(arena ? ['current', 'sling', 'geyser', 'spinner'] : depth < 3 ? ['grinder'] : depth < 5 ? ['grinder', 'blade', 'current', 'frost'] : ['grinder', 'blade', 'current', 'well', 'crusher', 'frost', 'spinner', 'sling', 'geyser', 'sponge']);
    if (kind === 'grinder') { const r = R.range(30, 46); const p = place(r + 60); if (p) { ents.push({ type: 'grinder', ...p, r, spin: R.sign() * R.range(2, 3.2), orbit: R.chance(0.4) ? { x: p.x, y: p.y, r: 40, w: R.range(0.5, 1) } : null }); ents.push(...moteRing(p.x, p.y, r + 30, 5, 3, { col: [0.6, 0.95, 1] })); } }
    else if (kind === 'blade') { const p = place(100); if (p) { ents.push({ type: 'blade', ...p, len: R.range(110, 160), spin: R.sign() * R.range(1.1, 1.8) }); ents.push(...moteRing(p.x, p.y, 30, 4, 3)); } }
    else if (kind === 'current') { const p = place(60); if (p) { const horiz = R.chance(0.5); ents.push({ type: 'current', ...p, w: horiz ? 300 : 130, h: horiz ? 130 : 300, vx: horiz ? R.sign() * 190 : 0, vy: horiz ? 0 : R.sign() * 190 }); } }
    else if (kind === 'well') { const p = place(120); if (p) { ents.push({ type: 'well', ...p, r: 17, reach: 220 }); ents.push(...moteRing(p.x, p.y, 74, 7, 3, { col: [0.8, 0.7, 1] })); } }
    else if (kind === 'sling') { const p = place(70); if (p) { const dx = W / 2 - p.x, dy = H / 2 - p.y, d = Math.hypot(dx, dy) || 1, far = Math.max(d, 230), to = { x: p.x + dx / d * far, y: p.y + dy / d * far }; ents.push({ type: 'bumper', ...p, len: 120, to }); ents.push(...moteTrail([[p.x + dx / d * 70, p.y + dy / d * 70], [p.x + dx / d * Math.min(far, 330), p.y + dy / d * Math.min(far, 330)]], 5, 2, { col: [0.8, 1, 0.5] })); } }
    else if (kind === 'sponge') { const r = R.range(26, 36); const p = place(r + 40); if (p) { ents.push({ type: 'sponge', ...p, r, cap: R.int(28, 44) }); ents.push(...moteRing(p.x, p.y, r + 46, 5, 3, { col: [1, 0.9, 0.7] })); } }
    else if (kind === 'geyser') { const p = place(120); if (p) ents.push({ type: 'geyser', ...p, period: R.range(4.4, 6), phase: R.range(0, 4) }); }
    else if (kind === 'frost') { const p = place(110); if (p) { ents.push({ type: 'frost', ...p, r: 110 }, ...moteRing(p.x, p.y, 46, 6, 3, { col: [0.7, 0.92, 1] })); const v = place(60); if (v) ents.push({ type: 'vent', ...v }); } }
    else if (kind === 'spinner') { const r1 = R.range(78, 104); const p = place(r1 + 30); if (p) { ents.push({ type: 'spinner', ...p, n: R.int(2, 3), r0: 22, r1, w: 7, hub: 16, spin: R.sign() * R.range(0.5, 0.9) }); ents.push(...moteRing(p.x, p.y, r1 * 0.62, 5, 3, { a0: R.range(0, 6), col: [0.8, 0.75, 1] })); } }
    else if (kind === 'crusher') { const p = place(120); if (p) ents.push({ type: 'crusher', ...p, w: 90, h: 110, travel: 110, period: R.range(2.4, 3.2), dir: R.chance(0.5) ? [0, 1] : [1, 0] }); }
  }
  // a vault: a ring of glass turning around a hoard of bright motes — worth the wait at its doorway
  if (!arena && depth >= 3 && R.chance(0.45)) { const rr = R.range(58, 74); const p = place(rr + 44, 60); if (p) { ents.push({ type: 'rotor', ...p, R: rr, r: 7, gap: R.range(0.5, 0.62), spin: R.sign() * R.range(0.5, 0.8), col: [1.0, 0.8, 0.5] }, ...moteRing(p.x, p.y, rr * 0.45, 5, 4, { col: [1.0, 0.8, 0.5] })); } }
  // not every light is light: from the fourth depth on, something may be curled up among them, wearing a ring of it
  if (!arena && depth >= 4 && R.chance(0.4)) { const p = place(70); if (p) ents.push({ type: 'mimic', ...p }); }
  // a lodestone: an iron bath, and a pulsing pole wearing a crown of bright light — for one chamber, be iron and ride it
  if (!arena && depth >= 4 && R.chance(0.3)) { const q = place(96, 60), p = q && place(52, 60); if (p && q) ents.push({ type: 'pool', kind: 'morph', mat: MAT.FERRO, morph: { speed: 1, tonus: 1.3, dart: 1 }, ...p, r: 40 }, { type: 'magnet', ...q, reach: 190, power: 600, period: 4.2 }, ...moteRing(q.x, q.y, 40, 6, 3, { col: [0.7, 0.8, 1] })); }
  for (const ax of Array.isArray(axiom) ? axiom : axiom ? [axiom] : []) if (ax.apply) ax.apply(spec, R, W, H, place);
  // light
  if (!arena) {
    const nTr = Math.round(R.int(2, 3) * spec.moteMul);
    for (let k = 0; k < nTr; k++) { const a = place(30), b = place(30); if (a && b) ents.push(...moteTrail([[a.x, a.y], [(a.x + b.x) / 2 + R.range(-80, 80), (a.y + b.y) / 2 + R.range(-80, 80)], [b.x, b.y]], R.int(5, 8), 2)); }
    if (depth > 2) { const p = place(70); if (p) ents.push({ type: 'pool', kind: 'heal', ...p, r: 46, max: 30 }); }
  }
  // living light (world/plankton.js): every chamber of the deep has something alive in its water — a school, a cloud of fireflies, shy sparks, a pod or two
  const kinds = arena ? ['school'] : [R.pick(['school', 'school', 'fireflies', 'shy', 'pods']), ...(depth >= 3 && R.chance(0.5) ? [R.pick(['school', 'fireflies', 'shy', 'pods'])] : [])];
  kinds.forEach((kind, k) => {
    if (kind === 'school') { const p = place(60); if (p) ents.push(...shoalOf('deep' + k, p.x, p.y, arena ? 10 : R.int(6, 9), { range: Math.min(W, H) * 0.42 })); }
    else if (kind === 'fireflies') { const p = place(90); if (p) ents.push(...fireflyCloud(p.x, p.y, R.int(5, 8), R.range(70, 110), { period: R.range(2.2, 3) })); }
    else if (kind === 'shy') { for (let q = 0; q < R.int(2, 3); q++) { const p = place(36); if (p) ents.push({ type: 'mote', kind: 'shy', ...p }); } }
    else if (kind === 'pods') { for (let q = 0; q < R.int(1, 2); q++) { const p = place(40); if (p) ents.push({ type: 'pod', ...p, a: R.range(0, TAU), n: R.int(4, 6) }); } }
  });
  // whatever water runs through the chamber carries a little light
  for (const e of ents.slice()) if (e.type === 'current') for (let q = 0; q < 3; q++) ents.push({ type: 'mote', kind: 'drift', x: e.x + (R.range(-0.4, 0.4)) * e.w, y: e.y + (R.range(-0.4, 0.4)) * e.h });
  // Firefly Night: every still light blinks
  if (spec.fireflies) for (const e of ents) if (e.type === 'mote' && !e.kind) { e.kind = 'firefly'; e.period = 2.6; }
  // neighbours
  const nG = Math.round((arena ? 3 : Math.min(3, 1 + Math.floor(depth / 3))) * spec.rivalMul), nH = arena ? 1 + Math.floor(depth / 10) : depth >= 3 ? Math.min(2, Math.floor(depth / 4) + (R.chance(0.5) ? 1 : 0)) : 0;
  // neighbours are measured against you: grazers are always a meal, lancers hover around your own size —
  // and from the fourth depth on one of them is an apex, bigger than you, that only wit (a lance, a held breath) will answer
  const m = Math.max(40, Math.min(260, mass)) * (spec.rivalBig || 1);
  for (let k = 0; k < nG; k++) { const p = place(50); if (p) rivals.push({ kind: 'grazer', ...p, n: Math.round(Math.max(18, Math.min(120, m * R.range(0.28, 0.6)))) }); }
  for (let k = 0; k < nH; k++) { const p = place(60); const apex = k === 0 && depth >= 4; if (p) rivals.push({ kind: 'hunter', ...p, n: Math.round(Math.max(40, Math.min(340, m * (apex ? R.range(1.25, 1.6) : R.range(0.6, 1.05))))) }); }
  if (depth >= 6 && R.chance(0.6)) { const p = place(60); if (p) rivals.push({ kind: 'thorn', ...p, n: R.int(40, 60) }); }
  if (depth >= 2 && R.chance(0.5)) { const p = place(50); if (p) rivals.push({ kind: 'oil', ...p, n: R.int(30, 60) }); }
  const pp = place(70, 80) || place(52, 80) || place(40, 120) || { x: W * 0.85, y: H * 0.5 }; ents.push({ type: 'pore', ...pp, r: 38, col: arena ? [1, 0.5, 0.62] : undefined });
  return spec;
}
