// Contact sheet of the Bot playing one real Odyssey chamber:
//   node tools/film.mjs <out.png> <room> [w] [h] [every-secs] [cols] [maxShots] [scale-down]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { ROOMS } from '../src/world/odyssey.js';
import { Odyssey } from '../src/modes/odyssey.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [out, room = '0', w = '960', h = '540', every = '2', cols = '3', maxShots = '9', mass = '0'] = process.argv.slice(2);
const TW = +w, TH = +h; const R = new Renderer(fakeCanvas(TW, TH)); R.maxPixels = 4e6; R.resize(true);
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' || k === 'muted' ? false : noop), apply: () => 0 });
const world = new World({});
const app = { world, R, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(TW / TH) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); R.setRoom(world.roomView(), true); o.onReveal && o.onReveal(); } };
globalThis.setTimeout = () => 0;
const mode = new Odyssey(app, +room, { mass: +mass }); app.mode = mode; mode.enter();
const W = world; const bot = new Bot(W, { greed: 1 }); const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
const frames = []; const step = Math.round(+every * 60);
for (let f = 0; f < 60 * 240 && !mode.finished && frames.length < +maxShots; f++) {
  bot.step(1 / 60, ctl); W.step(1 / 60, ctl);
  if (f % step === step - 1) { W.render(R); W.render(R); frames.push(R.fb.px.slice()); }
}
if (frames.length < +maxShots) { W.render(R); W.render(R); frames.push(R.fb.px.slice()); }
const n = frames.length, C = Math.min(+cols, n), rows = Math.ceil(n / C); const sheet = new Uint32Array(C * TW * rows * TH);
frames.forEach((px, k) => { const col = k % C, row = (k / C) | 0; for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) sheet[(row * TH + y) * C * TW + col * TW + x] = (x === 0 || y === 0) ? 0xff000000 : px[y * TW + x]; });
writePNG(out, C * TW, rows * TH, sheet);
console.log(ROOMS[+room].name, 'shots', n, 't', W.roomTime.toFixed(1), 'finished', mode.finished, 'mass', W.player.mass, 'light', W.stats.motes + '/' + W.stats.motesTotal);
