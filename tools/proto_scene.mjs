// Shared prototype scene (browser bench + Node offline renderer).
import { Physics, SPACING, AREA_PER_P } from '../src/sim/physics.js';
import { buildSDF } from '../src/sim/sdf.js';
import { MAT, SURF } from '../src/sim/materials.js';

export function makeScene(R, opt = {}) {
  const aspect = Math.min(1.9, Math.max(0.6, R.fb.w / R.fb.h));
  const AREA = opt.area || 0.80e6; const W = Math.round(Math.sqrt(AREA * aspect)), H = Math.round(W / aspect);
  const P = new Physics(4096, 512);
  P.setBounds(-40, -40, W + 40, H + 40);
  const m = 40;
  const grid = buildSDF({ x0: -40, y0: -40, x1: W + 40, y1: H + 40, res: 4, base: 'solid', ops: [
    { op: 'carve', t: 'box', x: W / 2, y: H / 2, w: W - 2 * m, h: H - 2 * m, r: 130 },
    { op: 'add', t: 'circle', x: W * 0.27, y: H * 0.33, r: 66, k: 0 },
    { op: 'add', t: 'box', x: W * 0.72, y: H * 0.68, w: 210, h: 40, r: 20, a: -0.35, mat: SURF.GLASS },
    { op: 'add', t: 'cap', ax: W * 0.62, ay: H * 0.22, bx: W * 0.82, by: H * 0.3, r: 17, mat: SURF.RESIN },
    { op: 'add', t: 'circle', x: W * 0.2, y: H * 0.75, r: 40, mat: SURF.GRIT },
  ] });
  P.sdf = grid; P.gx = 0; P.gy = 0; P.drag = 1.6;
  const room = { W, H, sdf: grid, seed: 7, lights: [{ x: W * 0.8, y: H * 0.2, r: 200, col: [0.5, 0.85, 1.0], i: 0.8 }], wells: [] };
  function blob(cx, cy, n, mat, group) {
    const B = P.allocBody(group, 'player', mat); let k = 0;
    for (let r = 0; k < n; r++) { const mm = Math.max(1, Math.floor(2 * Math.PI * r)); for (let a = 0; a < mm && k < n; a++) { const ang = a / mm * Math.PI * 2 + r * 0.37; P.spawn(cx + Math.cos(ang) * r * SPACING, cy + Math.sin(ang) * r * SPACING, 0, 0, mat, B.id); k++; } }
    B.count = k; B.cx = cx; B.cy = cy; B.r = Math.sqrt(k * AREA_PER_P / Math.PI); B.alive = true; B.minx = cx - B.r; B.maxx = cx + B.r; B.miny = cy - B.r; B.maxy = cy + B.r;
    B.tonus = 30; B.waveA = 22; B.waveW = 1.6;
    return B;
  }
  const hero = blob(W * 0.5, H * 0.5, opt.n || 130, MAT.LUMEN, 0);
  const others = [blob(W * 0.5 + 130, H * 0.5 - 60, 26, MAT.LUMEN, 0), blob(W * 0.5 + 190, H * 0.5 + 10, 5, MAT.LUMEN, 0), blob(W * 0.5 + 220, H * 0.5 - 45, 1, MAT.LUMEN, 0),
    blob(W * 0.36, H * 0.62, 60, MAT.OIL, 5), blob(W * 0.6, H * 0.8, 40, MAT.RIVAL, 6), blob(W * 0.4, H * 0.2, 46, MAT.SILVER, 7), blob(W * 0.82, H * 0.5, 30, MAT.RESIN, 8), blob(W * 0.68, H * 0.42, 24, MAT.DEW, 9)];
  others[0].fuseT = 1e9; others[1].fuseT = 1e9; others[2].fuseT = 1e9; hero.fuseT = 1e9;
  for (let k = 0; k < (opt.warm ?? 90); k++) P.step(1 / 60);
  const S = { P, room, hero, others, W, H, target: null };
  S.step = () => {
    const t = S.target;
    if (t) { const dx = t[0] - hero.cx, dy = t[1] - hero.cy, d = Math.hypot(dx, dy) + 1; const sp = Math.min(1, d / 120) * 260; hero.ax = (dx / d * sp - hero.vx) * 6; hero.ay = (dy / d * sp - hero.vy) * 6; hero.lx = dx / d; hero.ly = dy / d; hero.lead = 1.3; }
    else { hero.ax = -hero.vx * 3; hero.ay = -hero.vy * 3; hero.lead = 0; }
    P.step(1 / 60);
  };
  S.build = () => {
    R.beginClusters();
    for (const B of P.bodies) { if (!B.alive || B.count <= 0) continue; const look = R.lookFor(B.mat); R.addBody(P, B, { key: B.group, look, order: B === hero ? 10 : B.group, heart: B.group === 0 ? [B.cx, B.cy, B.r * 0.75 + 6, 1.2] : null }); }
  };
  return S;
}
