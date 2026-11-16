// Contact sheet of the epilogue under a wandering pointer: node tools/myriad.mjs <out.png> [w] [h] [every-secs] [cols] [maxShots]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { Epilogue } from '../src/modes/epilogue.js';
import { save } from '../src/core/save.js';
const [out, w = '800', h = '450', every = '6', cols = '4', maxShots = '12'] = process.argv.slice(2);
const TW = +w, TH = +h; const R = new Renderer(fakeCanvas(TW, TH)); R.maxPixels = 4e6; R.resize(true);
const log = []; const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' || k === 'muted' ? false : k === 'panel' ? (...a) => log.push('PANEL ' + a[0] + ' | ' + a[1]) : noop), apply: () => 0 });
const world = new World({});
const app = { world, R, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() { log.push('toHub'); }, setMode() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(TW / TH) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); R.setRoom(world.roomView(), true); o.onReveal && o.onReveal(); } };
const mode = new Epilogue(app, { mass: 180 }); app.mode = mode; mode.enter();
const W = world; const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
const frames = []; const step = Math.round(+every * 60); let lastPhase = -1;
for (let f = 0; f < 60 * 200 && frames.length < +maxShots && !mode.carded; f++) {
  const t = f / 60, F = W.player.focus; const cx = W.spec.W / 2, cy = W.spec.H / 2;
  // a lazy lissajous: the pointer strolls about the dish and the creature follows
  const tx = cx + Math.cos(t * 0.5) * (cx - 170), ty = cy + Math.sin(t * 0.83) * (cy - 150);
  const dx = tx - F.B.cx, dy = ty - F.B.cy, d = Math.hypot(dx, dy) + 1e-3; const thr = Math.min(1, Math.max(0, (d - F.B.r * 0.45) / 95)); ctl.intent.x = dx / d * thr; ctl.intent.y = dy / d * thr; ctl.aim = { x: tx, y: ty };
  W.step(1 / 60, ctl);
  if (mode.phase !== lastPhase) { lastPhase = mode.phase; log.push(`t=${t.toFixed(1)} phase ${mode.phase}`); }
  if (f % 300 === 299) log.push(`t=${t.toFixed(0)} mass ${W.player.mass} orgs ${W.player.orgs.length} cast ${mode.cast.map(r => (r.turned ? '*' : r.fed)).join('')} cols ${W.colonies.length}`);
  if (f % step === step - 1 || mode.phase === 2 && f % 45 === 0) { W.render(R); W.render(R); frames.push(R.fb.px.slice()); }
}
W.render(R); W.render(R); frames.push(R.fb.px.slice());
const n = frames.length, C = Math.min(+cols, n), rows = Math.ceil(n / C); const sheet = new Uint32Array(C * TW * rows * TH);
frames.forEach((px, k) => { const col = k % C, row = (k / C) | 0; for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) sheet[(row * TH + y) * C * TW + col * TW + x] = (x === 0 || y === 0) ? 0xff000000 : px[y * TW + x]; });
writePNG(out, C * TW, rows * TH, sheet); console.log(log.join('\n')); console.log('shots', n, 'carded', !!mode.carded, 'mass', W.player.mass);
