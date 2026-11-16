// Every hue side by side, at rest and mid-stride: node tools/hues.mjs <out.png> [crop]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
import { SKINS } from '../src/core/skins.js';
const [out, crop = '260'] = process.argv.slice(2); const CR = +crop, C = SKINS.length; const sheet = new Uint32Array(C * CR * 2 * CR);
SKINS.forEach((sk, col) => {
  const R = new Renderer(fakeCanvas(1600, 900)); R.maxPixels = 4e6; R.resize(true);
  const W = new World({ skin: () => sk.tint }); const spec = testRoom(R.fb.w / R.fb.h); spec.spawn.n = 110; W.load(spec);
  const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
  for (let k = 0; k < 100; k++) W.step(1 / 60, ctl); R.setRoom(W.roomView(), true);
  for (let row = 0; row < 2; row++) {
    if (row) for (let k = 0; k < 50; k++) { const F = W.player.focus; ctl.intent.x = 0.8; ctl.intent.y = -0.5; ctl.aim = { x: F.B.cx + 200, y: F.B.cy - 120 }; W.step(1 / 60, ctl); }
    W.render(R); W.render(R); const F = W.player.focus, v = R.view; const cx = Math.round((F.B.cx - v.ox) * v.z), cy = Math.round((F.B.cy - v.oy) * v.z);
    for (let y = 0; y < CR; y++) for (let x = 0; x < CR; x++) { const sx = Math.min(R.fb.w - 1, Math.max(0, cx - CR / 2 + x)), sy = Math.min(R.fb.h - 1, Math.max(0, cy - CR / 2 + y)); sheet[(row * CR + y) * C * CR + col * CR + x] = (x === 0 || y === 0) ? 0xff000000 : R.fb.px[sy * R.fb.w + sx]; }
  }
});
writePNG(out, C * CR, 2 * CR, sheet); console.log('hues ok');
