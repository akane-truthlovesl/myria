// Close-up filmstrip of the creature under a scripted pointer: node tools/closeup.mjs <out.png> [scene] [cols] [crop] [everyFrames] [shots]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
const [out, scene = 'move', cols = '6', crop = '230', every = '6', shots = '18'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(1600, 900)); R.maxPixels = 4e6; R.resize(true);
const W = new World({}); const spec = testRoom(R.fb.w / R.fb.h); spec.spawn.n = 90; W.load(spec); for (let k = 0; k < 90; k++) W.step(1 / 60, { intent: null }); R.setRoom(W.roomView(), true);
const CR = +crop, N = +shots, C = +cols, rows = Math.ceil(N / C); const sheet = new Uint32Array(C * CR * rows * CR);
const S = {
  move: (t, F) => ({ aim: t < 0.4 ? null : t < 1.5 ? [F.B.cx + 200, F.B.cy] : t < 2.4 ? [F.B.cx, F.B.cy + 200] : null }),
  dart: (t, F) => ({ aim: [F.B.cx + 150, F.B.cy - 40], dart: Math.abs(t - 0.5) < 0.009 }),
  swell: (t) => ({ swell: t > 0.3 && t < 1.2 }),
  bud: (t, F) => ({ bud: Math.abs(t - 0.3) < 0.009 ? [F.B.cx + 160, F.B.cy + 30] : null, rally: t > 1.3 }),
}[scene];
let k = 0; const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
for (let f = 0; k < N; f++) {
  const t = f / 60; const F = W.player.focus; const s = S(t, F);
  ctl.darts = null; ctl.buds = null; ctl.swell = !!s.swell; ctl.rally = !!s.rally; ctl.intent.x = 0; ctl.intent.y = 0; ctl.aim = null;
  if (s.aim) { const dx = s.aim[0] - F.B.cx, dy = s.aim[1] - F.B.cy, d = Math.hypot(dx, dy) + 1e-3; const thr = Math.min(1, Math.max(0, (d - F.B.r * 0.45) / 95)); ctl.intent.x = dx / d * thr; ctl.intent.y = dy / d * thr; ctl.aim = { x: s.aim[0], y: s.aim[1] }; if (s.dart) ctl.darts = [{ x: dx, y: dy, power: 1 }]; }
  if (s.bud) ctl.buds = [{ x: s.bud[0], y: s.bud[1] }];
  W.step(1 / 60, ctl);
  if (f % +every === 0) {
    W.render(R); W.render(R); const v = R.view; const cx = Math.round((F.B.cx - v.ox) * v.z), cy = Math.round((F.B.cy - v.oy) * v.z);
    const col = k % C, row = (k / C) | 0;
    for (let y = 0; y < CR; y++) for (let x = 0; x < CR; x++) { const sx = Math.min(R.fb.w - 1, Math.max(0, cx - CR / 2 + x)), sy = Math.min(R.fb.h - 1, Math.max(0, cy - CR / 2 + y)); sheet[(row * CR + y) * C * CR + col * CR + x] = (x === 0 || y === 0) ? 0xff000000 : R.fb.px[sy * R.fb.w + sx]; }
    k++;
  }
}
writePNG(out, C * CR, rows * CR, sheet); console.log(scene, 'ok', 'z', R.view.z.toFixed(2));
