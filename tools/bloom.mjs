// The Bot plays one Bloom run headlessly: node tools/bloom.mjs [out.png] [w] [h] [greed]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { Bloom } from '../src/modes/bloom.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [out = '', w = '960', h = '540', greed = '1'] = process.argv.slice(2);
const TW = +w, TH = +h; const R = new Renderer(fakeCanvas(TW, TH)); R.maxPixels = 4e6; R.resize(true);
const toasts = []; const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' || k === 'muted' ? false : k === 'toast' ? (s) => toasts.push(s) : noop), apply: () => 0 });
const world = new World({});
const app = { world, R, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {}, setMode() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(TW / TH) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); R.setRoom(world.roomView(), true); o.onReveal && o.onReveal(); } };
globalThis.setTimeout = () => 0;
const mode = new Bloom(app); app.mode = mode; mode.enter();
const W = world; const bot = new Bot(W, { greed: +greed }); const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
const frames = []; let f = 0, minMass = 1e9, sim = 0;
for (; f < 60 * 200 && !mode.over; f++) {
  bot.step(1 / 60, ctl); const a = process.cpuUsage(); W.step(1 / 60, ctl); const b = process.cpuUsage(a); sim += (b.user + b.system) / 1000;
  minMass = Math.min(minMass, W.player.mass);
  if (out && f % (60 * 12) === 60 * 6) { W.render(R); W.render(R); frames.push(R.fb.px.slice()); }
}
console.log(`score ${mode.score} motes ${mode.eaten} bestChain ${mode.bestChain} time ${(f / 60).toFixed(1)}s mass ${W.player.mass} (min ${minMass}) lost ${W.stats.lost} phase ${mode.phase} sim ${(sim / f).toFixed(2)}ms`);
console.log(toasts.join(' | ').replace(/<[^>]+>/g, ''));
if (out && frames.length) { const n = frames.length, C = Math.min(3, n), rows = Math.ceil(n / C); const sheet = new Uint32Array(C * TW * rows * TH); frames.forEach((px, k) => { const col = k % C, row = (k / C) | 0; for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) sheet[(row * TH + y) * C * TW + col * TW + x] = (x === 0 || y === 0) ? 0xff000000 : px[y * TW + x]; }); writePNG(out, C * TW, rows * TH, sheet); }
