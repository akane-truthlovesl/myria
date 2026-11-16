// The three-second promise, measured on a brand-new save: from the first frame of play, how long until
//   (1) the very first input moves the creature, (2) the first light is eaten, (3) the hub's first door opens?
// A naive hand is simulated: the pointer simply drifts toward the nearest bright thing, with human-ish lag.
import { open, sleep, errs } from './lib.mjs';
const [w = '1280', h = '720', touch = '0'] = process.argv.slice(2);
const { browser, page, logs } = await open('/index.html', { w: +w, h: +h, touch: !!+touch });
await sleep(400);
const state = () => page.evaluate(() => { const a = window.__app, W = a.world, F = W.player && W.player.focus; if (!F) return null; const v = a.R.view; const near = W.pickups.filter(p => !p.dead).map(p => ({ x: p.x, y: p.y, d: Math.hypot(p.x - F.B.cx, p.y - F.B.cy) })).sort((p, q) => p.d - q.d)[0]; const sc = (x, y) => [(x - v.ox) * v.z * innerWidth / a.R.fb.w, (y - v.oy) * v.z * innerHeight / a.R.fb.h]; return { st: a.state, t: W.time, pos: sc(F.B.cx, F.B.cy), wpos: [F.B.cx, F.B.cy], near: near ? sc(near.x, near.y) : null, motes: W.stats.motes, hint: (document.querySelector('.h-hint') || {}).textContent || '', mode: a.mode && a.mode.constructor.name }; });
for (let k = 0; k < 100; k++) { const s = await state(); if (s && s.st === 'play') break; await sleep(100); }
const s0 = await state(); const T0 = Date.now(); console.log('play begins · mode', s0.mode, '· words on screen:', JSON.stringify(s0.hint.trim().slice(0, 80)));
let moved = null, first = null, three = null; let target = s0.near || [+w * 0.7, +h * 0.5];
const start = s0.wpos; let finger = null;
if (+touch) finger = await page.touchscreen.touchStart(+w * 0.5, +h * 0.72);        // a thumb lands anywhere…
for (let k = 0; k < 120; k++) {
  const s = await state(); if (!s) break; const t = (Date.now() - T0) / 1000;
  if (s.near) target = s.near;
  if (+touch) { const dx = target[0] - s.pos[0], dy = target[1] - s.pos[1], d = Math.hypot(dx, dy) + 1; await finger.move(+w * 0.5 + dx / d * 60, +h * 0.72 + dy / d * 60); }      // …and leans toward the light
  else await page.mouse.move(target[0], target[1], { steps: 2 });
  if (moved === null && Math.hypot(s.wpos[0] - start[0], s.wpos[1] - start[1]) > 12) moved = t;
  if (first === null && s.motes >= 1) first = t;
  if (three === null && s.motes >= 3) three = t;
  if (three !== null && t > 3.2) break; await sleep(60);
}
console.log(`${+touch ? 'touch stick' : 'mouse'} ${w}x${h}: first movement ${moved?.toFixed(2)} s · first light ${first?.toFixed(2)} s · three lights ${three?.toFixed(2)} s after play began`);
console.log(moved !== null && moved <= 1.0 && first !== null && first <= 3.0 ? 'FTUE OK: moving within a second, rewarded within three' : 'FTUE SLOW');
console.log(errs(logs) || 'no console errors'); await browser.close();
