import { Physics, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT, SURF } from '../src/engine/materials.js';
const step = +(process.argv[2] || 27.6), rad = +(process.argv[3] || 8.5);
const phys = new Physics(6144);
phys.setBounds(0, 0, 1200, 1300);
const ops = [
  { op: 'carve', t: 'box', x: 600, y: 450, w: 1000, h: 400, r: 60 },
  { op: 'carve', t: 'box', x: 600, y: 700, w: 310, h: 120, r: 20 },
  { op: 'carve', t: 'box', x: 600, y: 960, w: 1000, h: 400, r: 60, k: 20 },
];
const n = Math.round((738 - 462) / step);
for (let k = 0; k <= n; k++) ops.push({ op: 'add', t: 'circle', x: 462 + (738 - 462) * k / n, y: 698, r: rad, mat: SURF.GLASS });
phys.sdf = buildSDF({ x0: 0, y0: 0, x1: 1200, y1: 1300, res: 4, base: 'solid', ops });
phys.gy = 600;
const B = phys.allocBody(0, 'player', MAT.LUMEN); let c = 0;
for (let r = 0; c < 170; r++) { const m = Math.max(1, Math.floor(2 * Math.PI * r)); for (let a = 0; a < m && c < 170; a++) { const ang = a / m * Math.PI * 2; phys.spawn(600 + Math.cos(ang) * r * SPACING, 600 + Math.sin(ang) * r * SPACING, 0, 0, MAT.LUMEN, B.id); c++; } }
B.tonus = 18;
for (let f = 1; f <= 600; f++) {
  // the player pushes down (lead tendril-ish): small downward drive on the body
  for (const b of phys.bodies) if (b.alive && b.group === 0) { b.ax = 0; b.ay = 300; b.tonus = 10; b.stiff = +(process.argv[4] || 1); }
  phys.step(1 / 60);
  if (f % 60 === 0) {
    let below = 0; for (let i = 0; i < phys.hi; i++) if (phys.alive[i] && phys.y[i] > 710) below++;
    const bodies = phys.bodies.filter(b => b.alive && b.group === 0).map(b => b.count);
    console.log(`t=${f / 60}s below=${below}/${phys.count} bodies=${JSON.stringify(bodies)}`);
  }
}
