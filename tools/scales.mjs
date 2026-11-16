// Every substance at every size, at true scale, on one sheet — the "jewel at any scale" check:
//   node tools/scales.mjs <out.png> [crop px] [sizes, comma list] [mats, comma list of names]
// Rows are materials, columns are grain counts. A second pass (the right half) shows the same bodies in motion.
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
import { MAT } from '../src/sim/materials.js';
const [out, crop = '250', sizes = '2,5,12,40,120,400', mats = 'LUMEN,SILVER,RESIN,FERRO,BASTION,FOAM,SPORE,CRYO'] = process.argv.slice(2);
const NS = sizes.split(',').map(Number), MS = mats.split(','), CR = +crop;
const cols = NS.length * 2, rows = MS.length; const sheet = new Uint32Array(cols * CR * rows * CR); const stats = [];
const R = new Renderer(fakeCanvas(1600, 900)); R.maxPixels = 4e6; R.resize(true);
function grab(W, col, row) {
  W.render(R); W.render(R); const F = W.player.focus, v = R.view; const cx = Math.round((F.B.cx - v.ox) * v.z), cy = Math.round((F.B.cy - v.oy) * v.z);
  let lit = 0, sat = 0, sum = 0;
  for (let y = 0; y < CR; y++) for (let x = 0; x < CR; x++) {
    const sx = Math.min(R.fb.w - 1, Math.max(0, cx - CR / 2 + x)), sy = Math.min(R.fb.h - 1, Math.max(0, cy - CR / 2 + y)); const p = R.fb.px[sy * R.fb.w + sx];
    sheet[(row * CR + y) * cols * CR + col * CR + x] = (x === 0 || y === 0) ? 0xff000000 : p;
    const r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255, l = Math.max(r, g, b); if (l > 110) { lit++; sum += l; if (r > 250 && g > 250 && b > 250) sat++; }
  }
  return { lit, sat, mean: lit ? sum / lit : 0 };
}
for (let m = 0; m < MS.length; m++) for (let k = 0; k < NS.length; k++) {
  const W = new World({}); const spec = testRoom(R.fb.w / R.fb.h); spec.spawn.n = NS[k]; spec.ents = []; spec.rivals = []; W.load(spec);
  const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
  W.step(1 / 60, ctl); if (MS[m] !== 'LUMEN') W.morph(W.player.focus.B, MAT[MS[m]], { speed: 1, tonus: 1, dart: 1 });
  for (let f = 0; f < 110; f++) W.step(1 / 60, ctl);
  R.setRoom(W.roomView(), true);
  const a = grab(W, k, m);
  // …and moving: a second and a half of travel, caught mid-stride
  ctl.intent.x = 0.9; ctl.intent.y = 0.3; for (let f = 0; f < 50; f++) W.step(1 / 60, ctl);
  const b = grab(W, NS.length + k, m);
  stats.push(`${MS[m].padEnd(8)} n=${String(NS[k]).padStart(3)} alive=${W.player.mass} bodies=${W.player.orgs.filter(o => o.alive).length} lit=${a.lit}px blown=${(100 * a.sat / Math.max(1, a.lit)).toFixed(1)}% mean=${a.mean.toFixed(0)} | moving lit=${b.lit}px blown=${(100 * b.sat / Math.max(1, b.lit)).toFixed(1)}%`);
}
writePNG(out, cols * CR, rows * CR, sheet); console.log(stats.join('\n')); console.log('zoom', R.view.z.toFixed(2), '→', out);
