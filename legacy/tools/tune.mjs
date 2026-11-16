import { Physics, SPACING } from '../src/engine/physics.js';
import { buildSDF } from '../src/engine/sdf.js';
import { MAT, SURF, M } from '../src/engine/materials.js';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')).map(([k,v]) => [k, +v]));
const phys = new Physics(6144);
phys.setBounds(-100, -100, 1300, 900);
phys.sdf = buildSDF({ x0: -100, y0: -100, x1: 1300, y1: 900, res: 4, base: 'solid', ops: [ { op: 'carve', t: 'box', x: 600, y: 400, w: 1100, h: 700, r: 60 } ]});
phys.gy = args.g ?? 700;
for (const k of ['k','kn','rho0','sk','plast','yieldR','sigma','xsph']) if (args[k] !== undefined) M[k][0] = args[k];
function blob(cx, cy, n, mat, group) {
  const B = phys.allocBody(group, 'player', mat); let k = 0;
  for (let r = 0; k < n; r++) { const m = Math.max(1, Math.floor(2*Math.PI*r)); for (let a = 0; a < m && k < n; a++) { const ang = a/m*Math.PI*2; phys.spawn(cx+Math.cos(ang)*r*SPACING, cy+Math.sin(ang)*r*SPACING, 0, 0, mat, B.id); k++; } }
  return B;
}
const sizes = [220, 60, 12];
const bodies = sizes.map((n, i) => { const B = blob(250 + i * 350, 400, n, MAT.LUMEN, 0); B.tonus = args.tonus ?? 0; return B; });
let t = 0;
for (let f = 0; f < 240; f++) { const s = performance.now(); phys.step(1/60); t += performance.now() - s; }
const out = bodies.map(b => `${b.count}: w=${(b.maxx-b.minx).toFixed(0)} h=${(b.maxy-b.miny).toFixed(0)} ar=${((b.maxy-b.miny)/(b.maxx-b.minx)).toFixed(2)}`);
let sum=0,c=0; for (let p=0;p<phys.np;p++){const i=phys.pi[p],j=phys.pj[p];const d=Math.hypot(phys.x[i]-phys.x[j],phys.y[i]-phys.y[j]); if(d<10){sum+=d;c++;}}
let mv=0; for (let i=0;i<phys.hi;i++) if(phys.alive[i]) mv=Math.max(mv,Math.hypot(phys.vx[i],phys.vy[i]));
console.log(JSON.stringify(args), out.join(' | '), 'sp', (sum/c).toFixed(2), 'maxv', mv.toFixed(1), 'ms', (t/240).toFixed(2), 'bodies', phys.bodies.filter(b=>b.alive).length);
