// ─────────────────────────────────────────────────────────────────────────────
//  Made chambers — a room anyone can build on the Workshop's bench and hand to
//  anyone else as one line of text. No server, no account: the line *is* the
//  room, and it carries the fastest run anyone has made through it, which comes
//  back as a pale bead to race.
//
//  A design lives in the chamber's own along/across frame (u along the window's
//  long axis, v across it, both 0‥1000 — the Odyssey's layout), so a room built
//  on a wide monitor plays on a phone held upright: it is seen turned over its
//  diagonal, the turning of its machines and its "down" included.
//
//  design = { pal, down, start:[u,v], mass, pore:[u,v], items:[[kind, …numbers]] }
//    'w' wall:   ['w', pen, u0,v0, u1,v1, …]      one point is a boulder
//    'l' light:  ['l', u0,v0, u1,v1, …]           one light per point
//    any other:  [kind, u, v, angle?, length?]     angle in milliradians, in the u/v frame
// ─────────────────────────────────────────────────────────────────────────────
import { SURF, MAT } from '../sim/materials.js';
import { dish } from './rooms.js';
import { layout, PAL } from './odyssey.js';
import { shoalOf, fireflyCloud } from './plankton.js';
import { hashStr } from '../core/util.js';

// the plate a chamber is made on: its light, and the music it is played to
export const PLATES = [['Dew', 'dew', 'dew'], ['Glass', 'glass', 'glass'], ['Amber', 'amber', 'chem'], ['Lode', 'lode', 'chem'], ['Abyss', 'abyss', 'abyss']].map(([name, pal, music]) => ({ name, pal: PAL[pal], music }));
// what walls can be drawn in — the periodic table of surfaces, every one a different answer to the same gel
export const PENS = [
  { surf: SURF.STONE, r: 15, name: 'stone', line: 'the gel can grip it, and climb' },
  { surf: SURF.GLASS, r: 12, name: 'glass', line: 'nothing holds to it — everything glides' },
  { surf: SURF.RESIN, r: 12, name: 'resin', line: 'it grabs, and strings as you pull away' },
  { surf: SURF.GRIT, r: 11, name: 'grit', line: 'it shears off whatever rubs against it' },
  { surf: SURF.BOUNCE, r: 8, name: 'membrane', line: 'it throws back whatever strikes it' },
  { surf: SURF.ICE, r: 12, name: 'ice', line: 'slick, and it chills' },
];
export const BOULDER = 2.6;             // a pen tapped (not drawn) leaves a round stone this many times its line's radius
export const LIMITS = { items: 160, pts: 48, lights: 240 };
const BATHS = { bI: [MAT.FERRO], bS: [MAT.SILVER], bA: [MAT.BASTION], bF: [MAT.FOAM, { speed: 1.1, tonus: 0.85, dart: 1, jet: 1 }], bP: [MAT.SPORE] };
const FLUID = { oi: MAT.OIL, qs: MAT.SILVER, rs: MAT.RESIN, fo: MAT.FOAM, fe: MAT.FERRO };
const RIVAL = { gz: ['grazer', 0.5], ln: ['hunter', 1.6], tb: ['thorn', 0.9] };

// every kind of thing a chamber can hold, and how it is laid into a room. (it, f, o): the item, the layout frame, the room being built
const at = (f, it, i = 1) => f.P(it[i] / 1000, it[i + 1] / 1000);
const ang = (f, it, dflt) => f.ang(it[3] !== undefined ? it[3] / 1000 : dflt);
const turn = (f) => (f.land ? 1 : -1);
const hand = (it) => (it[5] < 0 ? -1 : 1);                   // a wheel set down in the mirror turns the other way: [kind, u, v, angle, size, -1]                     // seen over its diagonal, a clockwise wheel turns the other way
export const KINDS = {
  w(it, f, o) {
    const pen = PENS[it[1]] || PENS[0]; const pts = []; for (let i = 2; i + 1 < it.length; i += 2) { const q = f.P(it[i] / 1000, it[i + 1] / 1000); pts.push([q.x, q.y]); }
    if (!pts.length) return; const r = pts.length === 1 ? pen.r * BOULDER : pen.r;
    if (o.bench) o.ents.push({ type: 'rod', surf: pen.surf, r, pts });               // on the bench: wet glass, not yet set into the plate
    else if (pts.length === 1) o.geo.push({ op: 'add', t: 'circle', x: pts[0][0], y: pts[0][1], r, mat: pen.surf });
    else o.geo.push({ op: 'add', t: 'path', pts, r, mat: pen.surf });
  },
  l(it, f, o) { for (let i = 1; i + 1 < it.length; i += 2) o.ents.push({ type: 'mote', ...f.P(it[i] / 1000, it[i + 1] / 1000), value: 2, ...(o.bench ? { free: true } : {}) }); },
  L(it, f, o) { const id = 'L' + o.keys.length; o.ents.push({ type: 'lantern', id, ...at(f, it) }); o.keys.push(id); },
  S(it, f, o) { const id = 'S' + o.pads.length; o.ents.push({ type: 'pad', id, ...at(f, it), need: 14, r: 40 }); o.pads.push(id); },
  D(it, f, o) { const c = at(f, it), a = ang(f, it, Math.PI / 2), len = it[4] ?? 130; o.doors.push({ type: 'gate', x: c.x, y: c.y, w: len, h: 24, a, dx: Math.cos(a) * (len + 18), dy: Math.sin(a) * (len + 18), latch: true }); },
  sc(it, f, o) { const c = at(f, it); o.ents.push(...shoalOf('made' + o.n++, c.x, c.y, 7, { range: 260 })); },
  ff(it, f, o) { const c = at(f, it); o.ents.push(...fireflyCloud(c.x, c.y, 8, 64, { period: 2.4 })); },
  sh(it, f, o) { const c = at(f, it); for (let k = 0; k < 3; k++) { const a = k / 3 * 6.2832 + 0.5; o.ents.push({ type: 'mote', kind: 'shy', x: c.x + Math.cos(a) * 34, y: c.y + Math.sin(a) * 34 }); } },
  dr(it, f, o) { const c = at(f, it); for (let k = 0; k < 3; k++) o.ents.push({ type: 'mote', kind: 'drift', x: c.x + (k - 1) * 30, y: c.y + (k - 1) * 9 }); },
  pd(it, f, o) { o.ents.push({ type: 'pod', ...at(f, it), a: ang(f, it, -Math.PI / 2), n: 6, regrow: o.bench ? 9 : 0 }); },
  gz(it, f, o) { const [kind, k] = RIVAL[it[0]]; o.rivals.push({ kind, ...at(f, it), n: Math.round(Math.max(14, o.mass * k)) }); },
  bl(it, f, o) { o.ents.push({ type: 'blade', ...at(f, it), len: 140, spin: 1.5 * turn(f) * hand(it) }); },
  gr(it, f, o) { o.ents.push({ type: 'grinder', ...at(f, it), r: 40, spin: 2.6 * turn(f) * hand(it) }); },
  wl(it, f, o) { o.ents.push({ type: 'well', ...at(f, it), r: 17, reach: 220 }); },
  hp(it, f, o) { o.ents.push({ type: 'pool', kind: 'heal', ...at(f, it), r: 50, max: 80 }); },
  fm(it, f, o) { o.ents.push({ type: 'film', ...at(f, it), len: it[4] ?? 170, a: ang(f, it, 0) }); },
  mg(it, f, o) { o.ents.push({ type: 'magnet', ...at(f, it), reach: 210, power: 620, period: 4.2 }); },
  ro(it, f, o) { o.ents.push({ type: 'rotor', ...at(f, it), R: it[4] ?? 96, gap: 0.5, spin: 0.5 * turn(f) * hand(it), a: ang(f, it, 0) }); },
  bd(it, f, o) { const c = at(f, it), a = ang(f, it, -Math.PI / 2); o.ents.push({ type: 'bumper', ...c, len: 130, to: { x: c.x + Math.cos(a) * 420, y: c.y + Math.sin(a) * 420 } }); },
  gy(it, f, o) { o.ents.push({ type: 'geyser', ...at(f, it), gifts: 30 }); },
  mm(it, f, o) { o.ents.push({ type: 'mimic', ...at(f, it) }); },
  sp(it, f, o) { o.ents.push({ type: 'sponge', ...at(f, it) }); },
  cu(it, f, o) { const a = ang(f, it, 0), ux = Math.cos(a), uy = Math.sin(a), along = Math.abs(ux) >= Math.abs(uy); o.ents.push({ type: 'current', ...at(f, it), w: along ? 260 : 110, h: along ? 110 : 260, vx: ux * 220, vy: uy * 220 }); },
  vt(it, f, o) { o.ents.push({ type: 'vent', ...at(f, it) }); },
  fr(it, f, o) { o.ents.push({ type: 'frost', ...at(f, it), r: 120, rate: 0.6 }); },
  wa(it, f, o) { o.ents.push({ type: 'watcher', ...at(f, it), a: ang(f, it, Math.PI / 2), range: 270 }); },
  bR(it, f, o) { o.ents.push({ type: 'pool', kind: 'rinse', ...at(f, it), r: 40 }); },
};
for (const k of ['oi', 'qs', 'rs', 'fo', 'fe']) KINDS[k] = (it, f, o) => { o.blobs.push({ mat: FLUID[k], ...at(f, it), n: 44 }); };
for (const k of ['ln', 'tb']) KINDS[k] = KINDS.gz;
for (const k of Object.keys(BATHS)) KINDS[k] = (it, f, o) => { const [mat, morph] = BATHS[k]; o.ents.push({ type: 'pool', kind: 'morph', ...at(f, it), mat, morph: morph || { speed: 1, tonus: 1, dart: 1 }, r: 44 }); };
const AIMED = new Set(['D', 'pd', 'fm', 'ro', 'bd', 'cu', 'wa']);
const SIZED = new Set(['D', 'fm', 'ro']);
const TURNS = new Set(['bl', 'gr', 'ro']);
export const isAimed = (k) => AIMED.has(k);
export const isSized = (k) => SIZED.has(k);
export const isTurning = (k) => TURNS.has(k);

export function freshDesign() {
  // a first bench is not empty: a sleeper, a way out, and a line of light between them — something to change rather than a blank to fill
  const items = [['l', 300, 500, 380, 470, 460, 455, 540, 455, 620, 470, 700, 500]];
  return { pal: 0, down: -1, start: [110, 500], mass: 60, pore: [890, 500], items };
}

// ── a design → a room spec (bench: a live preview whose plate never changes; otherwise the chamber itself, its walls set in glass) ──
export function buildChamber(D, aspect, bench = false) {
  const f = layout(aspect), { W, H } = f; const geo = dish(W, H);
  const o = { bench, geo, ents: [], rivals: [], blobs: [], keys: [], pads: [], doors: [], n: 0, mass: D.mass || 60 };
  for (const it of D.items) { const K = KINDS[it[0]]; if (K) K(it, f, o); }
  // doors open when every switch is held at once — or, in a room with no switch, when the way out has woken (gather first, then leave)
  const need = bench ? 'never' : o.pads.length ? o.pads.slice() : { fn: (Wd) => { const p = Wd.ents.find(e => e.d.type === 'pore'); return !!p && Wd.stats.motes >= (p.need || 0); } };
  for (const g of o.doors) { g.need = need; o.ents.push(g); }
  o.ents.push({ type: 'pore', ...f.P(D.pore[0] / 1000, D.pore[1] / 1000), ...(o.keys.length ? { key: o.keys.slice() } : {}) });
  const plate = PLATES[D.pal] || PLATES[0]; let gravity = null;
  if (D.down >= 0) { const a = f.ang(D.down / 1000); gravity = [Math.cos(a) * 520, Math.sin(a) * 520]; }
  return { name: bench ? 'Workshop' : chamberName(chamberHash(D)), seed: bench ? 77 : chamberHash(D) % 997 + 1, W, H, geo, ents: o.ents, rivals: o.rivals, blobs: o.blobs, pal: plate.pal,
    spawn: { ...f.P(D.start[0] / 1000, D.start[1] / 1000), n: o.mass }, minMass: o.mass, cap: Math.max(420, o.mass * 3), ...(gravity ? { gravity } : {}) };
}

// world ↔ design frame (the bench converts what a finger does into the design's along/across numbers)
export function toUV(f, x, y) { const u = f.land ? x / f.W : y / f.H, v = f.land ? y / f.H : x / f.W; return [Math.round(Math.max(0, Math.min(1, u)) * 1000), Math.round(Math.max(0, Math.min(1, v)) * 1000)]; }
export function angToUV(f, a) { let q = f.ang(a) % (Math.PI * 2); if (q < 0) q += Math.PI * 2; return Math.round(q * 1000); }

// ── names: every chamber has one of its own, made from nothing but its shape ──
const ADJ = ['Quiet', 'Amber', 'Hollow', 'Slow', 'Crooked', 'Little', 'Sleeping', 'Patient', 'Tidal', 'Silver', 'Hidden', 'Restless', 'Gentle', 'Distant', 'Narrow', 'Folded', 'Velvet', 'Hungry', 'Dreaming', 'Lantern', 'Salt', 'Second', 'Burning', 'Lost'];
const NOUN = ['Orchard', 'Gyre', 'Cellar', 'Choir', 'Loom', 'Harbour', 'Labyrinth', 'Nest', 'Lagoon', 'Aviary', 'Furnace', 'Chapel', 'Delta', 'Hive', 'Archive', 'Grotto', 'Garden', 'Well', 'Stair', 'Reliquary', 'Observatory', 'Kiln', 'Weir', 'Clockwork'];
export function chamberHash(D) { return hashStr(JSON.stringify([D.pal, D.down, D.start, D.mass, D.pore, D.items])); }
export function chamberName(h) { return `The ${ADJ[h % ADJ.length]} ${NOUN[Math.floor(h / ADJ.length) % NOUN.length]}`; }

// ── the line of text: MYRIA-CHAMBER.<design>[.<centiseconds>.<run>] — the run is the fastest anyone has made through it (an echo path) ──
const enc = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
export function packChamber(D, run) {
  const body = enc(JSON.stringify([1, D.pal, D.down, D.start, D.mass, D.pore, D.items]));
  return `MYRIA-CHAMBER.${body}` + (run && run.p ? `.${Math.round(run.t * 100)}.${run.p}` : '');
}
export function unpackChamber(text) {
  const m = /MYRIA-CHAMBER\.([A-Za-z0-9_-]+)(?:\.(\d+)\.([A-Za-z0-9_-]+))?/.exec(String(text || '')); if (!m) return null;
  let a; try { a = JSON.parse(dec(m[1])); } catch (_) { return null; }
  const D = checkDesign({ pal: a[1], down: a[2], start: a[3], mass: a[4], pore: a[5], items: a[6] }, a[0]); if (!D) return null;
  const t = m[2] ? +m[2] / 100 : 0; const run = t > 0.5 && t < 3600 && m[3] && m[3].length % 4 === 0 ? { t, p: m[3] } : null;
  return { design: D, run };
}
// anything that came from outside (a pasted line, an old save) is checked thing by thing: known kinds, numbers only, inside the frame, within limits
export function checkDesign(x, v = 1) {
  if (v !== 1 || !x || !Array.isArray(x.items)) return null;
  const n = (q, lo, hi, d) => (Number.isFinite(+q) ? Math.max(lo, Math.min(hi, Math.round(+q))) : d);
  const uv = (q) => (Array.isArray(q) && q.length >= 2 && Number.isFinite(+q[0]) && Number.isFinite(+q[1]) ? [n(q[0], 20, 980, 500), n(q[1], 20, 980, 500)] : null);
  const D = { pal: n(x.pal, 0, PLATES.length - 1, 0), down: Number.isFinite(+x.down) && +x.down >= 0 ? n(x.down, 0, 6283, -1) : -1, start: uv(x.start), mass: n(x.mass, 30, 200, 60), pore: uv(x.pore), items: [] };
  if (!D.start || !D.pore) return null; let lights = 0;
  for (const it of x.items.slice(0, LIMITS.items)) {
    if (!Array.isArray(it) || typeof it[0] !== 'string' || !Object.prototype.hasOwnProperty.call(KINDS, it[0])) continue; const k = it[0]; const nums = it.slice(1).map(Number); if (!nums.every(Number.isFinite)) continue;
    if (k === 'w' || k === 'l') {
      const head = k === 'w' ? [n(nums[0], 0, PENS.length - 1, 0)] : []; const raw = nums.slice(head.length); const pts = [];
      for (let i = 0; i + 1 < raw.length && pts.length < LIMITS.pts * 2; i += 2) pts.push(n(raw[i], 0, 1000, 500), n(raw[i + 1], 0, 1000, 500));
      if (k === 'l') { const room = Math.max(0, (LIMITS.lights - lights) * 2); pts.length = Math.min(pts.length, room); lights += pts.length / 2; }
      if (pts.length >= 2) D.items.push([k, ...head, ...pts]); continue;
    }
    if (nums.length < 2) continue; const q = [k, n(nums[0], 20, 980, 500), n(nums[1], 20, 980, 500)];
    if (nums.length >= 3) q.push(n(nums[2], 0, 6283, 0)); if (nums.length >= 4 && SIZED.has(k)) q.push(n(nums[3], 50, 360, 130));
    if (TURNS.has(k) && nums.length >= 5 && nums[4] < 0) { if (q.length < 4) q.push(0); if (q.length < 5) q.push(SIZED.has(k) ? 96 : 0); q.push(-1); }
    D.items.push(q);
  }
  return D;
}
