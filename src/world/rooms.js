// ─────────────────────────────────────────────────────────────────────────────
//  Room builders. A room is a single screen of the slide, laid out for whatever
//  shape the window has: builders work in a frame of world units W×H whose area
//  is constant, so a portrait phone and a wide monitor get the same density.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF } from '../sim/materials.js';
import { rng, TAU, clamp } from '../core/util.js';
import { moteTrail, moteRing } from './entities.js';

export const ROOM_AREA = 0.56e6;
export function frame(aspect, area = ROOM_AREA) { const a = clamp(aspect, 0.56, 1.9); const W = Math.round(Math.sqrt(area * a)); return { W, H: Math.round(W / a), a }; }

// the dish itself: a rounded basin carved from solid glass-stone, with an organically wobbling rim
export function dish(W, H, o = {}) {
  const m = o.margin ?? 34, r = o.r ?? Math.min(W, H) * 0.22;
  return [{ op: 'carve', t: 'box', x: W / 2, y: H / 2, w: W - 2 * m, h: H - 2 * m, r }];
}

export function testRoom(aspect, seed = 7) {
  const { W, H } = frame(aspect); const R = rng(seed);
  const geo = dish(W, H);
  geo.push({ op: 'add', t: 'circle', x: W * 0.30, y: H * 0.30, r: 58, k: 0 });
  geo.push({ op: 'add', t: 'box', x: W * 0.70, y: H * 0.66, w: 200, h: 38, r: 19, a: -0.35, mat: SURF.GLASS });
  geo.push({ op: 'add', t: 'cap', ax: W * 0.60, ay: H * 0.20, bx: W * 0.80, by: H * 0.27, r: 15, mat: SURF.RESIN });
  const ents = [
    ...moteRing(W * 0.30, H * 0.30, 92, 9),
    ...moteTrail([[W * 0.50, H * 0.58], [W * 0.62, H * 0.50], [W * 0.80, H * 0.48]], 6),
    ...moteTrail([[W * 0.22, H * 0.62], [W * 0.30, H * 0.80], [W * 0.50, H * 0.84]], 7),
    ...moteTrail([[W * 0.62, H * 0.82], [W * 0.84, H * 0.80]], 4, 3),
    { type: 'pore', x: W * 0.84, y: H * 0.16, need: 14 },
  ];
  void R;
  return { name: 'Test', seed, W, H, geo, ents, spawn: { x: W * 0.5, y: H * 0.42, n: 60 } };
}
