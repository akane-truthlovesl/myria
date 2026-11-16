// ─────────────────────────────────────────────────────────────────────────────
//  Decor — what lives on the slide when nobody is looking: diatoms, radiolaria,
//  phyllotaxis discs, frozen bubbles, fronds growing from the glass, and the
//  lab's own etched calibration marks. Each is a static decal baked once into
//  the backdrop (free at runtime), faint enough to stay scenery — yet the gel
//  refracts them as it passes, which is half of why it reads as glass.
// ─────────────────────────────────────────────────────────────────────────────
import { PROF } from '../render/ink.js';
import { rng, TAU } from '../core/util.js';

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function decal(x, y, r, draw) { return { x, y, bx: x, by: y, bakeR: r, decor: true, bake(ink) { draw(ink); } }; }

// a centric diatom: rim, inner ring, spokes, a bright hub
function diatom(x, y, r, n, c, a) {
  return decal(x, y, r + 3, (ink) => {
    ink.ring(x, y, r, 0.55, c[0], c[1], c[2], a * 1.2); ink.ring(x, y, r * 0.52, 0.4, c[0], c[1], c[2], a * 0.8);
    for (let k = 0; k < n; k++) { const t = k / n * TAU; const cs = Math.cos(t), sn = Math.sin(t); ink.beam(x + cs * r * 0.52, y + sn * r * 0.52, x + cs * r, y + sn * r, 0.6, c[0], c[1], c[2], a * 0.7, PROF.dust); }
    ink.light(x, y, r * 0.42, PROF.glow, c[0], c[1], c[2], a * 0.9); ink.light(x, y, r * 2.0, PROF.halo, c[0], c[1], c[2], a * 0.18);
  });
}
// a pennate diatom: a slim boat with ribs
function boat(x, y, len, ang, c, a) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return decal(x, y, len + 3, (ink) => {
    const w = len * 0.17;
    for (let s = -1; s <= 1; s += 2) { let px = x - cs * len, py = y - sn * len; for (let k = 1; k <= 8; k++) { const u = k / 8 * 2 - 1; const b = (1 - u * u) * w * s; const qx = x + cs * len * u - sn * b, qy = y + sn * len * u + cs * b; ink.beam(px, py, qx, qy, 0.55, c[0], c[1], c[2], a, PROF.dust); px = qx; py = qy; } }
    for (let k = -3; k <= 3; k++) { const u = k / 4; const b = (1 - u * u) * w * 0.8; ink.beam(x + cs * len * u - sn * b, y + sn * len * u + cs * b, x + cs * len * u + sn * b, y + sn * len * u - cs * b, 0.45, c[0], c[1], c[2], a * 0.6, PROF.dust); }
    ink.light(x, y, len * 1.3, PROF.halo, c[0], c[1], c[2], a * 0.14);
  });
}
// phyllotaxis: a sunflower of dots
function sunflower(x, y, r, n, c, a) {
  return decal(x, y, r + 3, (ink) => { for (let k = 1; k <= n; k++) { const q = Math.sqrt(k / n) * r, t = k * 2.39996; ink.light(x + Math.cos(t) * q, y + Math.sin(t) * q, 0.9 + 1.1 * k / n, PROF.core, c[0], c[1], c[2], a * (0.6 + 0.8 * k / n)); } ink.light(x, y, r * 1.6, PROF.halo, c[0], c[1], c[2], a * 0.2); });
}
// a little cousin of the creature: thin rays with dew at the tips
function radiolarian(x, y, r, n, c, a, R) {
  const rays = []; for (let k = 0; k < n; k++) rays.push([k / n * TAU + R.range(-0.2, 0.2), r * R.range(0.6, 1.15)]);
  return decal(x, y, r * 1.2 + 3, (ink) => {
    for (const [t, l] of rays) { const cs = Math.cos(t), sn = Math.sin(t); ink.beam(x + cs * r * 0.2, y + sn * r * 0.2, x + cs * l, y + sn * l, 0.5, c[0], c[1], c[2], a * 0.8, PROF.dust); ink.light(x + cs * l, y + sn * l, 1.4, PROF.core, c[0], c[1], c[2], a * 1.5); }
    ink.ring(x, y, r * 0.22, 0.5, c[0], c[1], c[2], a * 1.2); ink.light(x, y, r * 0.9, PROF.halo, c[0], c[1], c[2], a * 0.3);
  });
}
// bubbles caught under the cover glass
function bubbles(x, y, n, c, a, R) {
  const bs = []; for (let k = 0; k < n; k++) bs.push([x + R.range(-12, 12), y + R.range(-12, 12), R.range(1.6, 5.2)]);
  return decal(x, y, 22, (ink) => { for (const [bx, by, br] of bs) { ink.ring(bx, by, br, 0.45, c[0], c[1], c[2], a * 1.3, 0.6); ink.light(bx - br * 0.35, by - br * 0.38, Math.max(0.9, br * 0.3), PROF.core, 1, 1, 1, a * 2.2); ink.ring(bx, by, br * 0.62, 0.35, c[0], c[1], c[2], a * 0.5, 0, 0.5, 1.9); } });
}
// a frond growing from the glass into the water: a curling stem, alternate leaflets, a bud of light
function frond(x, y, nx, ny, len, c, c2, a, R) {
  const pts = []; let px = x, py = y, ang = Math.atan2(ny, nx) + R.range(-0.5, 0.5); const curl = R.range(-0.022, 0.022); const n = Math.max(6, Math.round(len / 7));
  for (let k = 0; k <= n; k++) { pts.push([px, py, ang]); ang += curl * 7 + Math.sin(k * 0.9 + x) * 0.07; px += Math.cos(ang) * 7; py += Math.sin(ang) * 7; }
  return decal(x + nx * len * 0.5, y + ny * len * 0.5, len * 0.75 + 12, (ink) => {
    for (let k = 0; k < n; k++) {
      const [ax, ay, aa] = pts[k], [bx, by] = pts[k + 1]; const u = k / n; const w = 1.5 * (1 - u) + 0.45; const col = mixc(c, c2, u);
      ink.beam(ax, ay, bx, by, w, col[0], col[1], col[2], a * (1.1 - 0.4 * u), PROF.dust);
      if (k > 1 && k < n - 1) { const s = k % 2 ? 1 : -1; const la = aa + s * 1.05, ll = (5 + 6 * (1 - u)) * (0.7 + 0.5 * Math.sin(k * 2.1 + y)); ink.beam(bx, by, bx + Math.cos(la) * ll, by + Math.sin(la) * ll, 0.9 * (1 - u) + 0.4, col[0], col[1], col[2], a * 0.7, PROF.dust); ink.light(bx + Math.cos(la) * ll, by + Math.sin(la) * ll, 1.2, PROF.core, c2[0], c2[1], c2[2], a * 0.9); }
    }
    const [tx, ty] = pts[n]; ink.light(tx, ty, 2.6, PROF.glow, c2[0], c2[1], c2[2], a * 2.4); ink.light(tx, ty, 11, PROF.halo, c2[0], c2[1], c2[2], a * 0.45);
  });
}
// the lab's hand: a calibration reticle engraved in the plate
function reticle(x, y, r, c, a) {
  return decal(x, y, r + 8, (ink) => {
    ink.ring(x, y, r, 0.4, c[0], c[1], c[2], a); ink.ring(x, y, r * 0.5, 0.35, c[0], c[1], c[2], a * 0.6);
    for (let k = 0; k < 36; k++) { const t = k / 36 * TAU, l = k % 9 === 0 ? 7 : k % 3 === 0 ? 4.5 : 2.5; const cs = Math.cos(t), sn = Math.sin(t); ink.beam(x + cs * (r - l), y + sn * (r - l), x + cs * r, y + sn * r, 0.45, c[0], c[1], c[2], a * 0.9, PROF.dust); }
    ink.beam(x - 5, y, x + 5, y, 0.4, c[0], c[1], c[2], a, PROF.dust); ink.beam(x, y - 5, x, y + 5, 0.4, c[0], c[1], c[2], a, PROF.dust);
  });
}

// scatter decor through a room's free water (seeded: the same chamber always grows the same garden)
export function growDecor(W, pal = {}) {
  const s = W.spec, P = W.phys; const R = rng((s.seed || 1) * 7919 + 17); const out = [];
  const c = pal.rim || [0.56, 0.9, 1.0], warm = pal.accent || [1.0, 0.62, 0.40], dens = s.decor ?? 1;
  if (dens <= 0) return out;
  const free = (x, y, m) => x > m && y > m && x < s.W - m && y < s.H - m && P.sampleSDF(x, y) > m;
  const busy = (x, y, m) => { for (const e of W.ents) { if (e.decor) continue; const dx = e.x - x, dy = e.y - y; const rr = (e.r || 8) + m; if (dx * dx + dy * dy < rr * rr) return true; } for (const d of out) { const dx = d.x - x, dy = d.y - y; const rr = d.bakeR + m; if (dx * dx + dy * dy < rr * rr) return true; } return false; };
  const area = s.W * s.H / 1e5;
  const place = (count, m, make) => { for (let k = 0, tries = 0; k < count && tries < count * 14; tries++) { const x = R.range(30, s.W - 30), y = R.range(30, s.H - 30); if (!free(x, y, m) || busy(x, y, m * 0.6)) continue; out.push(make(x, y)); k++; } };
  // one or two reticles, large and faint
  place(Math.round(R.range(0.6, 1.9)), 46, (x, y) => reticle(x, y, R.range(30, 44), c, 0.10));
  place(Math.round(area * 0.50 * dens), 18, (x, y) => diatom(x, y, R.range(5, 11), R.int(7, 14), mixc(c, warm, R() < 0.3 ? 0.7 : 0), R.range(0.14, 0.24)));
  place(Math.round(area * 0.45 * dens), 16, (x, y) => boat(x, y, R.range(7, 13), R.range(0, TAU), c, R.range(0.14, 0.22)));
  place(Math.round(area * 0.30 * dens), 22, (x, y) => sunflower(x, y, R.range(8, 14), R.int(16, 30), mixc(c, warm, R() < 0.4 ? 0.8 : 0.1), R.range(0.15, 0.24)));
  place(Math.round(area * 0.30 * dens), 18, (x, y) => radiolarian(x, y, R.range(7, 12), R.int(5, 9), mixc(c, warm, 0.5), R.range(0.14, 0.22), R));
  place(Math.round(area * 0.55 * dens), 14, (x, y) => bubbles(x, y, R.int(2, 6), c, R.range(0.13, 0.20), R));
  // fronds: walk the walls and let some of them sprout
  const N = [0, 0]; const want = Math.round(area * 2.0 * dens);
  for (let k = 0, tries = 0; k < want && tries < want * 30; tries++) {
    const x = R.range(10, s.W - 10), y = R.range(10, s.H - 10); const d = P.sampleSDF(x, y); if (d < 2 || d > 16) continue;
    P.sdfNormal(x, y, N); const wx = x - N[0] * (d - 0.5), wy = y - N[1] * (d - 0.5); const len = R.range(22, 62);
    if (!free(wx + N[0] * len * 0.8, wy + N[1] * len * 0.8, 8) || busy(wx + N[0] * len * 0.5, wy + N[1] * len * 0.5, 4)) continue;
    const g = mixc(c, [0.45, 1.0, 0.72], 0.55);
    out.push(frond(wx, wy, N[0], N[1], len, g, R() < 0.5 ? warm : c, R.range(0.13, 0.22), R)); k++;
  }
  return out;
}
