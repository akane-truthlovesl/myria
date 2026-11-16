// ─────────────────────────────────────────────────────────────────────────────
//  Small shared maths. Everything here is allocation-free in hot paths.
// ─────────────────────────────────────────────────────────────────────────────
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
export const sign = (v) => (v < 0 ? -1 : 1);
export const hypot = Math.hypot;
export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

// deterministic RNG (mulberry32) — rooms, dailies and replays all hang off seeds
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  f.sign = () => (f() < 0.5 ? -1 : 1);
  f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  return f;
}
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// integer lattice hashes → value noise → fbm (used by the backdrop painter and procedural sprites)
export function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y); const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { s += a * vnoise(x, y); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5; } return s; }
// smooth cellular distance (pores, caustic webs)
export function cells(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y); let d = 8;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ox = hash2(xi + i, yi + j), oy = hash2(xi + i + 57, yi + j - 113);
    const rx = i + ox - (x - xi), ry = j + oy - (y - yi); const q = rx * rx + ry * ry; if (q < d) d = q;
  }
  return Math.sqrt(d);
}

// distance between the two nearest cell sites (F2 − F1): zero along cell borders → light networks, cracks, membranes
export function cellEdge(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y); let d1 = 8, d2 = 8;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ox = hash2(xi + i, yi + j), oy = hash2(xi + i + 57, yi + j - 113);
    const rx = i + ox - (x - xi), ry = j + oy - (y - yi); const q = rx * rx + ry * ry;
    if (q < d1) { d2 = d1; d1 = q; } else if (q < d2) d2 = q;
  }
  return Math.sqrt(d2) - Math.sqrt(d1);
}

// colour helpers (linear-ish 0..1 triples)
export function hsl(h, s, l) {
  const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c, a = 1) => `rgba(${Math.round(sat(c[0]) * 255)},${Math.round(sat(c[1]) * 255)},${Math.round(sat(c[2]) * 255)},${a})`;

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
