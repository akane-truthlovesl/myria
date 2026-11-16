import { Physics, SPACING } from './engine/physics.js';
import { buildSDF } from './engine/sdf.js';
import { MAT, SURF, M } from './engine/materials.js';
import { Renderer } from './render/renderer.js';
const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const R = new Renderer(canvas);
const phys = new Physics(6144);
for (const k of ['k','kn','rho0','sk','plast','yieldR','sigma','xsph']) if (params.get(k)) M[k][0] = +params.get(k);
const L = { x0: -100, y0: -100, x1: 1500, y1: 900 };
phys.setBounds(L.x0, L.y0, L.x1, L.y1);
const grid = buildSDF({ ...L, res: 4, base: 'solid', ops: [
  { op: 'carve', t: 'box', x: 700, y: 400, w: 1300, h: 700, r: 80, k: 0 },
  { op: 'add', t: 'box', x: 700, y: 560, w: 260, h: 36, r: 16, mat: SURF.GLASS },
  { op: 'add', t: 'circle', x: 1100, y: 640, r: 70, mat: SURF.STONE },
  { op: 'add', t: 'box', x: 300, y: 300, w: 40, h: 300, r: 18, mat: SURF.RESIN },
]});
phys.sdf = grid; R.setLevel(grid);
phys.gy = 600;
function blob(cx, cy, n, mat, group) {
  const B = phys.allocBody(group, 'player', mat); let k = 0;
  for (let r = 0; k < n; r++) { const m = Math.max(1, Math.floor(2*Math.PI*r)); for (let a = 0; a < m && k < n; a++) { const ang = a/m*Math.PI*2; phys.spawn(cx+Math.cos(ang)*r*SPACING, cy+Math.sin(ang)*r*SPACING, 0, 0, mat, B.id); k++; } }
  B.tonus = +(params.get('tonus') || 12); return B;
}
const A = blob(560, 300, 240, MAT.LUMEN, 0);
const Bb = blob(860, 300, 50, MAT.LUMEN, 0);
const C = blob(1000, 300, 6, MAT.LUMEN, 0);
const D = blob(1180, 300, 1, MAT.LUMEN, 0);
const E = blob(420, 600, 90, MAT.OIL, 5);
const cam = { x: 700, y: 420, zoom: 1 };
const warm = +(params.get('warm') || 0); for (let k = 0; k < warm; k++) phys.step(1/60);
let t0 = performance.now(), last = t0;
window.__stats = { frames: 0 };
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  phys.step(1/60);
  R.resize();
  cam.zoom = Math.min(R.canvas.clientWidth / 1400, R.canvas.clientHeight / 820) * (+(params.get('zoom')||1));
  if (params.get('cx')) { cam.x = +params.get('cx'); cam.y = +params.get('cy'); }
  R.packParticles(phys, B => B.group === 0 ? 0 : 1, null, (now - t0) / 1000);
  R.clearLights();
  R.light(A.cx, A.cy - 10, 60, 260, 1.0, 0.6, 0.35, -1.2);
  R.light(1300, 150, 200, 500, 0.4, 0.7, 1.0, 1.0);
  R.setShapes(phys.shapes);
  R.ents.reset();
  R.ents.push(1250, 500, 14, 0,  1.0, 0.85, 0.5, 1,  0.3, 0, 0, 0);
  R.ents.push(200, 200, 22, 1,  0.8, 0.9, 1.0, 1,  0.0, 0, 0, 0);
  R.fx.reset();
  // inner life: micro-bubbles & motes riding particles
  for (let i = 0; i < phys.hi; i += 1) { if (!phys.alive[i] || phys.body[i] < 0 || phys.bodies[phys.body[i]].group !== 0) continue; const h = (i * 2654435761 >>> 0) % 97;
    if (h < 5) R.fx.push(phys.x[i] + Math.sin(i + now * 0.001) * 2, phys.y[i], 2.6 + (h % 3), 1, 1.0, 0.95, 0.85, 0.55, 1, 0, 0, 0);
    else if (h < 11) R.fx.push(phys.x[i], phys.y[i], 3.2, 0, 1.0, 0.85, 0.6, 0.5, 1, 0, 0, 0); }
  if (params.get('dots')) for (let i = 0; i < phys.hi; i++) if (phys.alive[i]) R.fx.push(phys.x[i], phys.y[i], 2.2, 0, 0.2, 1, 0.4, 1, 0,0,0,0);
  R.frame(cam, (now - t0) / 1000);
  window.__stats.frames++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
