import { fakeCanvas } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
const R = new Renderer(fakeCanvas(1905, 2260)); R.resize(true);
const W = new World({}); W.load(testRoom(R.fb.w / R.fb.h)); R.setRoom(W.roomView(), true);
for (let f = 0; f < 180; f++) { W.step(1 / 60, { intent: { x: 0, y: 0 } }); }
W.render(R); W.render(R);
const F = W.player.focus.B, v = R.view; const cx = Math.round((F.cx - v.ox) * v.z), cy = Math.round((F.cy - v.oy) * v.z); const rad = Math.round(F.r * v.z);
const fl = R.fluid, g = fl.g;
for (let y = cy - rad - 14; y < cy - rad + 26; y++) { const p = R.fb.px[y * R.fb.w + cx]; const j = (y - g.Y0) / g.c, i = (cx - g.X0) / g.c; const k = (j | 0) * g.gw + (i | 0);
  console.log(y - (cy - rad), 'rgb', p & 255, (p >> 8) & 255, (p >> 16) & 255, ' node F', fl.F[k].toFixed(2), 'H', fl.Hh[k].toFixed(2), 'sy', fl.Hy[k].toFixed(2), 'G', fl.G[k].toFixed(2), 'Ha', fl.Ha[k].toFixed(2), 'Lm', fl.Lm[k].toFixed(2)); }
