// ─────────────────────────────────────────────────────────────────────────────
//  BLOOM — the living dish. A daily-seeded petri reef, its tides, and the
//  mutated axioms that rewrite its physics.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MAT } from '../engine/materials.js';

export const DISH_R = 1420;

// ── seeded randomness ──────────────────────────────────────────────────────
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// ── tiers: names for how much light you hold ──────────────────────────────
export const TIERS = [
  { name: 'Mote', m: 0 },
  { name: 'Drop', m: 100 },
  { name: 'Pearl', m: 170 },
  { name: 'Bloom', m: 280 },
  { name: 'Tide', m: 430 },
  { name: 'Apex', m: 620 },
];
export function tierOf(m) { let k = 0; for (let i = 0; i < TIERS.length; i++) if (m >= TIERS[i].m) k = i; return k; }

// ── axioms: the daily mutation of the dish's laws ─────────────────────────
// Each axiom is pure data + a few hooks the mode calls.
export const AXIOMS = [
  { id: 'honey', name: 'Honey Tide', sub: 'all matter thickens', glyph: '≋',
    visc: 2.6, speed: 0.86, dartK: 0.85 },
  { id: 'counter', name: 'Counter-Gyre', sub: 'the current turns and quickens', glyph: '↺',
    gyre: -2.4 },
  { id: 'singularity', name: 'Black-Hole Bloom', sub: 'a hungry dark at the heart of the dish', glyph: '◉',
    singularity: true, centerClear: 380, moteRingNearHole: true },
  { id: 'oil', name: 'Oil Tide', sub: 'immiscible beads crowd the water', glyph: '◐',
    pop: { oil: 3.2 } },
  { id: 'ferro', name: 'Ferro Storm', sub: 'iron beads answer the pulsing poles', glyph: '✣',
    ferro: true, pop: { ferro: 1 } },
  { id: 'swarm', name: 'Swarm Spring', sub: 'the small ones teem', glyph: '❈',
    pop: { glimmer: 2.6, grazer: 1.4, hunter: 0.7 }, vents: 1.8 },
  { id: 'giants', name: 'Age of Giants', sub: 'everything is born larger', glyph: '⬤',
    sizeK: 1.55, moteK: 1.5 },
  { id: 'fasting', name: 'Fasting Moon', sub: 'light is scarce — but darting is free', glyph: '☾',
    moteRate: 0.35, freeDarts: true, devourK: 1.3 },
  { id: 'masquerade', name: 'Masquerade', sub: 'not every light is what it seems', glyph: '✧',
    pop: { mimic: 2.6, puffer: 2.0 } },
];
export function dailyAxiom(key = todayKey()) { return AXIOMS[hashStr('axiom:' + key) % AXIOMS.length]; }

// ── tides: the arc of a run ───────────────────────────────────────────────
// population targets per archetype (scaled by axiom pop multipliers)
export const TIDES = [
  { name: 'Spawning', sub: 'Tide I', until: 70, pop: { glimmer: 14, grazer: 4, oil: 2, hunter: 1, puffer: 1 } },
  { name: 'The Hunters Wake', sub: 'Tide II', until: 160, pop: { glimmer: 12, grazer: 4, oil: 3, hunter: 3, thorn: 2, puffer: 3 } },
  { name: 'Strangers', sub: 'Tide III', until: 270, pop: { glimmer: 10, grazer: 3, oil: 3, hunter: 3, thorn: 2, puffer: 2, siphon: 2, mimic: 2, rival: 2 } },
  { name: 'Leviathan', sub: 'Tide IV', until: 1e9, pop: { glimmer: 8, grazer: 2, oil: 2, hunter: 2, thorn: 1, puffer: 2, siphon: 1, mimic: 1, rival: 1 } },
];

// ── the reef: rim, organic islands, pore channels, mote vents ─────────────
export function buildDish(seed, axiom) {
  const R = rng(seed);
  const ops = [{ op: 'carve', t: 'circle', x: 0, y: 0, r: DISH_R, mat: SURF.GLASS }];
  const islands = [];
  const pores = [];
  const clear = axiom.centerClear || 300;
  const n = 6 + Math.floor(R() * 2);
  let tries = 0;
  while (islands.length < n && tries++ < 200) {
    const a = R() * Math.PI * 2, rad = clear + 140 + R() * (DISH_R - clear - 420);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    const s = 70 + R() * 110;
    if (islands.some(o => Math.hypot(o.x - x, o.y - y) < o.s + s + 230)) continue;
    islands.push({ x, y, s, a: R() * Math.PI });
  }
  for (const I of islands) {
    // organic blob: 3 overlapping lobes smoothly fused
    const lobes = 2 + Math.floor(R() * 2);
    for (let k = 0; k < lobes; k++) {
      const la = I.a + k * 2.1 + R() * 0.6, lr = I.s * (0.35 + R() * 0.35);
      ops.push({ op: 'add', t: 'ellipse', x: I.x + Math.cos(la) * lr, y: I.y + Math.sin(la) * lr, rx: I.s * (0.55 + R() * 0.3), ry: I.s * (0.4 + R() * 0.25), a: R() * Math.PI, mat: SURF.STONE, k: 36 });
    }
  }
  // pore channels: narrow refuges only the small can thread
  const withPores = islands.slice().sort((a, b) => b.s - a.s).slice(0, 2);
  for (const I of withPores) {
    const ca = I.a + Math.PI * 0.5;
    const L = I.s * 1.7;
    const ax = I.x - Math.cos(ca) * L, ay = I.y - Math.sin(ca) * L, bx = I.x + Math.cos(ca) * L, by = I.y + Math.sin(ca) * L;
    ops.push({ op: 'carve', t: 'cap', ax, ay, bx, by, r: 15, mat: SURF.GLASS, k: 10 });
    pores.push({ ax, ay, bx, by, x: I.x, y: I.y });
  }
  // little glass pillars near the rim for texture & cover
  for (let k = 0; k < 9; k++) {
    const a = R() * Math.PI * 2, rad = DISH_R - 120 - R() * 80;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (islands.some(o => Math.hypot(o.x - x, o.y - y) < o.s + 120)) continue;
    ops.push({ op: 'add', t: 'circle', x, y, r: 16 + R() * 18, mat: SURF.GLASS, k: 24 });
  }
  // vents: luminous nests at island shoulders (or open water)
  const vents = [];
  for (const I of islands.slice(0, 5)) {
    const a = Math.atan2(-I.y, -I.x) + (R() - 0.5) * 0.8; // facing the centre
    vents.push({ x: I.x + Math.cos(a) * (I.s + 46), y: I.y + Math.sin(a) * (I.s + 46), nx: Math.cos(a), ny: Math.sin(a), t: R() * 6 });
  }
  const B = DISH_R + 60;
  return {
    id: 'bloom', bounds: [-B, -B, B, B], view: 900, gravity: [0, 0], drag: 0.45, res: 5, cap: 950,
    palette: { p0: [0.002, 0.010, 0.013], p1: [0.005, 0.034, 0.040], p2: [0.04, 0.085, 0.085], p3: [0.45, 1.0, 0.85], sky: [0.5, 0.9, 0.85], grid: 0.85, bright: 1 },
    geo: ops, entities: [],
    islands, pores, vents,
  };
}

// gyre: a slow clockwise drift, strongest near the rim
export function gyreAt(x, y, k = 1) {
  const r = Math.hypot(x, y) + 1e-3;
  const s = k * (14 + 48 * Math.min(1, r / DISH_R) ** 1.5);
  return [-y / r * s, x / r * s];
}
