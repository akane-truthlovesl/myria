// dump a horizontal cross-section of the last drawn cluster's lattice fields through the focus creature
import { fakeCanvas } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
const [w = '1905', h = '2260'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(+w, +h)); R.resize(true);
const W = new World({}); W.load(testRoom(R.fb.w / R.fb.h)); R.setRoom(W.roomView(), true);
for (let f = 0; f < 120; f++) { W.step(1 / 60, { intent: { x: 0, y: 0 } }); }
W.render(R);
const fl = R.fluid, g = fl.g, F = W.player.focus.B;
const j = Math.round(((F.cy - R.view.oy) * R.view.z - g.Y0) / g.c);
console.log('cell', g.c, 'gw', g.gw, 'gh', g.gh, 'row', j, 'z', R.view.z.toFixed(2));
let s = '';
for (let i = 0; i < g.gw; i++) { const k = j * g.gw + i; if (fl.F[k] < 0.05) continue; s += `${String(i).padStart(3)} F=${fl.F[k].toFixed(2)} D2=${fl.D2[k].toFixed(2)} D3=${fl.D3[k].toFixed(2)} H=${fl.Hh[k].toFixed(3)} sx=${fl.Hx[k].toFixed(2)}\n`; }
console.log(s);
