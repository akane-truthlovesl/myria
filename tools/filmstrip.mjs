// Contact sheet of a scripted moment, rendered headlessly through the real mode classes:
//   node tools/filmstrip.mjs <out.png> <scene> [cols] [tileW] [tileH]
// scenes: hook (the opening), dart, bud, cleave, swell, feed — each a tiny script of pointer positions and verbs.
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { Hub } from '../src/modes/hub.js';
import { Odyssey } from '../src/modes/odyssey.js';
import { save } from '../src/core/save.js';
const [out, scene = 'hook', cols = '4', tw = '480', th = '300'] = process.argv.slice(2);
const TW = +tw, TH = +th; const R = new Renderer(fakeCanvas(TW, TH)); R.maxPixels = 4e6; R.resize(true);
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' || k === 'muted' ? false : noop), apply: () => 0 });
const world = new World({});
const app = { world, R, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), input: { any: false, device: 'mouse', mouse: { inside: false }, keys: new Set() }, applyBudget() {}, pause() {}, toHub() {}, setMode() {}, extraModes: [],
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(TW / TH) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); R.setRoom(world.roomView(), true); o.onReveal && o.onReveal(); } };
globalThis.setTimeout = () => 0;
const S = {
  // t (s) → { aim:[u,v] (fraction of room), dart, lance, bud, swell, wake }
  hook: { mode: () => new Hub(app, {}), shots: [0.3, 0.9, 1.2, 1.6, 2.1, 2.8, 3.6, 4.6], script: (t) => ({ wake: t > 0.8, aim: t > 0.8 ? [0.5 - Math.min(0.2, (t - 0.8) * 0.12), 0.55 - Math.min(0.22, (t - 0.8) * 0.13)] : null }) },
  feed: { mode: () => new Odyssey(app, 0, {}), shots: [0.5, 1.2, 1.8, 2.4, 3.0, 3.6, 4.4, 5.2], script: (t) => ({ aim: [0.12 + t * 0.06, 0.5 - Math.sin(t * 0.9) * 0.22] }) },
  dart: { mode: () => new Odyssey(app, 2, {}), shots: [1.6, 1.9, 2.02, 2.1, 2.2, 2.35, 2.6, 3.2], script: (t) => ({ aim: [0.60, 0.5], dart: Math.abs(t - 2.0) < 0.009 }) },
  bud: { mode: () => new Odyssey(app, 3, {}), shots: [1.0, 1.52, 1.6, 1.75, 2.0, 2.6, 3.4, 4.6], script: (t) => ({ aim: t < 1.6 ? [0.3, 0.4] : [0.42, 0.83], bud: Math.abs(t - 1.5) < 0.009 ? [0.42, 0.17] : null }) },
  swell: { mode: () => new Odyssey(app, 17, {}), shots: [0.6, 1.2, 1.5, 1.9, 2.4, 2.52, 2.7, 3.2], script: (t) => ({ aim: [0.28, 0.5], swell: t > 1.1 && t < 2.45 }) },
  cleave: { mode: () => new Odyssey(app, 18, {}), shots: [0.5, 1.5, 2.5, 3.2, 3.5, 3.62, 3.8, 4.4], script: (t, W) => { const F = W.player.focus; let h = null, bd = 1e9; for (const C of W.colonies) if (C.kind === 'hunter') for (const O of C.orgs) { const d = Math.hypot(O.B.cx - F.B.cx, O.B.cy - F.B.cy); if (d < bd) { bd = d; h = O; } } return { aimW: h ? [h.B.cx, h.B.cy] : null, lance: h && bd < 150 && t > 1 }; } },
}[scene];
const mode = S.mode(); app.mode = mode; mode.enter();
const W = world; const n = S.shots.length, C = +cols, rows = Math.ceil(n / C); const sheet = new Uint32Array(C * TW * rows * TH); let k = 0, lanced = 0;
const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
for (let f = 0; f <= Math.ceil(S.shots[n - 1] * 60) + 1; f++) {
  const t = f / 60; const s = S.script(t, W); const F = W.player.focus;
  if (s.wake && mode.wake) mode.wake();
  ctl.darts = null; ctl.buds = null; ctl.swell = !!s.swell; ctl.intent.x = 0; ctl.intent.y = 0; ctl.aim = null;
  const aim = s.aimW || (s.aim ? [s.aim[0] * W.spec.W, s.aim[1] * W.spec.H] : null);
  if (aim && F && F.alive && !F.dormant) { const dx = aim[0] - F.B.cx, dy = aim[1] - F.B.cy, d = Math.hypot(dx, dy) + 1e-3; const thr = Math.min(1, Math.max(0, (d - F.B.r * 0.45) / 95)); ctl.intent.x = dx / d * thr; ctl.intent.y = dy / d * thr; ctl.aim = { x: aim[0], y: aim[1] };
    if (s.dart) ctl.darts = [{ x: dx, y: dy, power: 1 }]; if (s.lance && t - lanced > 2) { ctl.darts = [{ x: dx, y: dy, power: 1.5 }]; lanced = t; } }
  if (s.bud) ctl.buds = [{ x: s.bud[0] * W.spec.W, y: s.bud[1] * W.spec.H }];
  W.step(1 / 60, ctl);
  if (k < n && t >= S.shots[k]) { W.render(R); W.render(R); const col = k % C, row = (k / C) | 0; for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) sheet[(row * TH + y) * C * TW + col * TW + x] = (x === 0 || y === 0) ? 0xff302010 : R.fb.px[y * TW + x]; k++; }
}
writePNG(out, C * TW, rows * TH, sheet); console.log(scene, 'frames', k, 'mass', W.player.mass, 'orgs', W.player.orgs.length);
