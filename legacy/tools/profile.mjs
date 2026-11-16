import { Physics, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT } from '../src/engine/materials.js';
const P = new Physics(6144);
P.setBounds(-100, -100, 2100, 1300);
P.sdf = buildSDF({ x0: -100, y0: -100, x1: 2100, y1: 1300, res: 4, base: 'solid', ops: [{ op: 'carve', t: 'box', x: 1000, y: 600, w: 2000, h: 1200, r: 60 }] });
P.gy = 600;
const N = +(process.argv[2] || 1500);
let k = 0;
while (k < N) { const B = P.allocBody(k < 300 ? 0 : 5 + (k / 150 | 0), 'x', MAT.LUMEN); const cx = 150 + (k / 150 | 0) * 180, cy = 400; let c = 0; for (let r = 0; c < 150 && k < N; r++) { const m = Math.max(1, Math.floor(2 * Math.PI * r)); for (let a = 0; a < m && c < 150 && k < N; a++) { P.spawn(cx + Math.cos(a / m * 6.283) * r * SPACING, cy + Math.sin(a / m * 6.283) * r * SPACING, 0, 0, MAT.LUMEN, B.id); c++; k++; } } B.tonus = 28; }
const names = ['applyForces', 'buildGrid', 'buildPairs', 'viscosity', 'springs', 'relax', 'collide', 'xsph'];
const T = Object.fromEntries(names.map(n => [n, 0]));
for (const n of names) { const f = P[n].bind(P); P[n] = (...a) => { const t = performance.now(); const r = f(...a); T[n] += performance.now() - t; return r; }; }
let agg = 0; const fa = P.aggregate.bind(P); P.aggregate = (...a) => { const t = performance.now(); fa(...a); agg += performance.now() - t; };
for (let f = 0; f < 60; f++) P.step(1 / 60);
for (const n of names) T[n] = 0; agg = 0;
const t0 = performance.now(); const F = 120;
for (let f = 0; f < F; f++) P.step(1 / 60);
const tot = performance.now() - t0;
console.log(`N=${N} pairs=${P.np} total/frame=${(tot / F).toFixed(2)}ms`);
for (const n of names) console.log(n.padEnd(12), (T[n] / F).toFixed(3), 'ms', (T[n] / tot * 100).toFixed(1) + '%');
console.log('aggregate'.padEnd(12), (agg / F).toFixed(3), 'ms');
