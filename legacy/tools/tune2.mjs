import { Physics, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT, M } from '../src/engine/materials.js';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')).map(([k,v]) => [k, +v]));
const phys = new Physics(6144);
phys.setBounds(-100, -100, 1300, 900);
phys.sdf = buildSDF({ x0: -100, y0: -100, x1: 1300, y1: 900, res: 4, base: 'solid', ops: [ { op: 'carve', t: 'box', x: 600, y: 400, w: 1100, h: 700, r: 60 } ]});
phys.gy = args.g ?? 600;
for (const k of ['k','kn','rho0','sk','plast','yieldR','sigma','xsph']) if (args[k] !== undefined) M[k][0] = args[k];
function blob(cx, cy, n) {
  const B = phys.allocBody(0, 'player', MAT.LUMEN); let k = 0;
  for (let r = 0; k < n; r++) { const m = Math.max(1, Math.floor(2*Math.PI*r)); for (let a = 0; a < m && k < n; a++) { const ang = a/m*Math.PI*2; phys.spawn(cx+Math.cos(ang)*r*SPACING, cy+Math.sin(ang)*r*SPACING, 0, 0, MAT.LUMEN, B.id); k++; } }
  return B;
}
const bodies = [240, 80].map((n, i) => { const B = blob(300 + i * 500, 400, n); B.tonus = args.tonus ?? 12; return B; });
let jit = 0;
for (let f = 0; f < 420; f++) { phys.step(1/60); if (f > 360) { let mv = 0; for (let i = 0; i < phys.hi; i++) if (phys.alive[i]) mv += Math.hypot(phys.vx[i], phys.vy[i]); jit += mv / phys.count; } }
function lump(B) {
  // top-surface profile in 16-unit bins → RMS residual from a quadratic fit (visible lumps)
  const bins = new Map();
  for (let k = 0; k < B.len; k++) { const i = phys.bodyIdx[B.start + k]; const bx = Math.round(phys.x[i] / 16); const y = phys.y[i]; if (!bins.has(bx) || bins.get(bx) > y) bins.set(bx, y); }
  const xs = [...bins.keys()].sort((a, b) => a - b).slice(1, -1); const ys = xs.map(x => bins.get(x));
  const n = xs.length; if (n < 4) return 0;
  // least squares quadratic
  let S = [0,0,0,0,0], T = [0,0,0];
  for (let i = 0; i < n; i++) { const x = xs[i] - xs[0], y = ys[i]; let p = 1; for (let k = 0; k < 5; k++) { S[k] += p; p *= x; } T[0] += y; T[1] += y * x; T[2] += y * x * x; }
  const A = [[S[0],S[1],S[2]],[S[1],S[2],S[3]],[S[2],S[3],S[4]]];
  const det = (m) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D = det(A); const c = [0,1,2].map(j => det(A.map((row, r) => row.map((v, k) => k === j ? T[r] : v))) / D);
  let s2 = 0; for (let i = 0; i < n; i++) { const x = xs[i] - xs[0]; const e = ys[i] - (c[0] + c[1] * x + c[2] * x * x); s2 += e * e; }
  return Math.sqrt(s2 / n);
}
const out = bodies.map(b => `${b.count}: ar=${((b.maxy-b.miny)/(b.maxx-b.minx)).toFixed(2)} lump=${lump(b).toFixed(2)}`);
console.log(JSON.stringify(args).padEnd(70), out.join(' | '), 'jitter', (jit / 59).toFixed(2), 'bodies', phys.bodies.filter(b=>b.alive).length);
