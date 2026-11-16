import { Physics, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT, M } from '../src/engine/materials.js';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')).map(([k,v]) => [k, +v]));
const phys = new Physics(6144);
phys.poly = args.poly ?? 0;
phys.setBounds(-100, -100, 1300, 900);
phys.sdf = buildSDF({ x0: -100, y0: -100, x1: 1300, y1: 900, res: 4, base: 'solid', ops: [ { op: 'carve', t: 'box', x: 600, y: 400, w: 1100, h: 700, r: 60 } ]});
phys.gy = 0;
for (const k of ['k','kn','rho0','sk','plast','yieldR','sigma','xsph','creep']) if (args[k] !== undefined) M[k][0] = args[k];
const B = phys.allocBody(0, 'player', MAT.LUMEN);
let k = 0; for (let r = 0; k < 160; r++) { const m = Math.max(1, Math.floor(2*Math.PI*r)); for (let a = 0; a < m && k < 160; a++) { const ang = a/m*Math.PI*2; phys.spawn(600+Math.cos(ang)*r*SPACING*1.25, 400+Math.sin(ang)*r*SPACING*0.8, 0, 0, MAT.LUMEN, B.id); k++; } }
B.tonus = args.tonus ?? 30;
let res = [];
for (let f = 0; f < 600; f++) {
  phys.step(1/60);
  if (f % 150 === 149) {
    // outline radius per angle (64 bins), compare with its smooth (low-mode) version
    const NB = 20; const bins = new Float32Array(NB);
    for (let q = 0; q < B.len; q++) { const i = phys.bodyIdx[B.start + q]; const dx = phys.x[i]-B.cx, dy = phys.y[i]-B.cy; const a = Math.floor((Math.atan2(dy,dx)/(2*Math.PI)+0.5)*NB)%NB; bins[a] = Math.max(bins[a], Math.hypot(dx,dy)); }
    // smooth with circular box filter of 9
    let dev = 0, mean = 0; for (let a = 0; a < NB; a++) mean += bins[a]; mean /= NB;
    for (let a = 0; a < NB; a++) { let s = 0; for (let d = -2; d <= 2; d++) s += bins[(a+d+NB)%NB]; s /= 5; dev += (bins[a]-s)**2; }
    let lowdev = 0; for (let a = 0; a < NB; a++) lowdev += (bins[a]-mean)**2;
    res.push(`t${(f+1)/60|0}s facet=${Math.sqrt(dev/NB).toFixed(2)} ovality=${Math.sqrt(lowdev/NB).toFixed(2)}`);
  }
}
console.log(JSON.stringify(args).padEnd(40), res.join(' | '));
