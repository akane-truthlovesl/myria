// Headless physics bench: stability + timing.
import { Physics, H, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT, SURF } from '../src/engine/materials.js';

const phys = new Physics(6144);
phys.setBounds(-100, -100, 1300, 900);
const t0 = performance.now();
phys.sdf = buildSDF({ x0: -100, y0: -100, x1: 1300, y1: 900, res: 4, base: 'solid', ops: [
  { op: 'carve', t: 'box', x: 600, y: 400, w: 1100, h: 700, r: 60 },
  { op: 'add', t: 'box', x: 600, y: 600, w: 300, h: 40, r: 18, mat: SURF.GLASS },
]});
console.log('sdf build ms', (performance.now() - t0).toFixed(1), phys.sdf.w, phys.sdf.h);
phys.gy = 900;
function blob(cx, cy, n, mat, group) {
  const B = phys.allocBody(group, 'player', mat);
  let k = 0; const s = SPACING;
  for (let r = 0; k < n; r++) {
    for (let a = 0; a < Math.max(1, Math.floor(2 * Math.PI * r)) && k < n; a++) {
      const ang = a / Math.max(1, Math.floor(2 * Math.PI * r)) * Math.PI * 2;
      phys.spawn(cx + Math.cos(ang) * r * s, cy + Math.sin(ang) * r * s, 0, 0, mat, B.id); k++;
    }
  }
  return B;
}
const A = blob(400, 300, 220, MAT.LUMEN, 0);
const B2 = blob(800, 300, 60, MAT.LUMEN, 0);
const C = blob(1000, 200, 3, MAT.LUMEN, 1);
let tt = 0, frames = 300;
for (let f = 0; f < frames; f++) {
  const s = performance.now();
  phys.step(1 / 60);
  tt += performance.now() - s;
  if (f % 60 === 59) {
    const bs = phys.bodies.filter(b => b.alive).map(b => `${b.id}:${b.count}@(${b.cx.toFixed(0)},${b.cy.toFixed(0)}) v=${Math.hypot(b.vx,b.vy).toFixed(1)} r=${b.r.toFixed(0)} h=${(b.maxy-b.miny).toFixed(0)} w=${(b.maxx-b.minx).toFixed(0)}`);
    console.log('frame', f + 1, 'np', phys.np, 'avg ms', (tt / (f + 1)).toFixed(2), bs.join(' | '));
  }
}
// mean neighbour distance in A
let sum = 0, cnt = 0;
for (let p = 0; p < phys.np; p++) { const i = phys.pi[p], j = phys.pj[p]; const d = Math.hypot(phys.x[i]-phys.x[j], phys.y[i]-phys.y[j]); if (d < 9) { sum += d; cnt++; } }
console.log('mean near spacing', (sum / cnt).toFixed(2), 'pairs/particle', (phys.np / phys.count).toFixed(1));
let maxv = 0; for (let i = 0; i < phys.hi; i++) if (phys.alive[i]) maxv = Math.max(maxv, Math.hypot(phys.vx[i], phys.vy[i]));
console.log('max particle speed at rest', maxv.toFixed(2));
