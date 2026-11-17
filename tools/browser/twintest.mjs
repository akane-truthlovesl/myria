// A door for two (the dive together): from the second depth, a co-op room may carry two pads as far apart as it allows;
// the way on stays shut, whatever light is gathered, until both are held at once for a breath — then it opens for good.
// A solo dive's rooms are drawn exactly as before (no pads). node twintest.mjs [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const why = [], R = {};
const go = async (q) => { const o = await open(`/index.html?${q}&maxpx=500000`, { w, h }); await sleep(600); await o.page.mouse.click(w / 2, h / 2); const t0 = Date.now(); while (Date.now() - t0 < 40000) { if (await o.page.evaluate(() => window.__app.state === 'play' && !!window.__app.world.spec)) break; await sleep(150); } await sleep(800); return o; };
// solo, depth 2: no pads, nothing sealed
{ const { browser, page, logs } = await go('mode=abyss&depth=2'); R.solo = await page.evaluate(() => ({ twin: !!window.__app.world.spec.twin, pads: window.__app.world.ents.filter(e => e.d.type === 'pad').length, depth: window.__app.mode.depth })); if (R.solo.twin || R.solo.pads || R.solo.depth !== 2) why.push('solo: ' + JSON.stringify(R.solo)); const e = errs(logs); if (e) why.push(e); await browser.close(); }
// together, depth 2 (tried over a few seeds: a cramped chamber may have no room for a far-apart pair)
let page, browser, logs;
for (let k = 0; k < 4; k++) { ({ browser, page, logs } = await go('mode=coop&depth=2')); if (await page.evaluate(() => !!window.__app.world.spec.twin)) break; await browser.close(); browser = null; }
if (!browser) { why.push('no door for two in four co-op chambers'); }
else {
  R.pads = await page.evaluate(() => { const W = window.__app.world, A = W.entity('twinA'), B = W.entity('twinB'); return A && B ? Math.round(Math.hypot(A.x - B.x, A.y - B.y)) : 0; });
  // all the light in the world does not open it…
  R.sealed = await page.evaluate(() => { const W = window.__app.world, m = window.__app.mode, P = W.ents.find(e => e.d.type === 'pore'); W.stats.motes = 999; return m.poreReady(P); });
  if (R.sealed) why.push('the way on opened without the pads');
  // …one pad is not enough…
  const carry = (args) => page.evaluate(([who, id]) => { const W = window.__app.world, m = window.__app.mode, Ph = W.phys, F = who ? m.p2.focus : W.player.focus, T = W.entity(id); const dx = T.x - F.B.cx, dy = T.y - F.B.cy;
    for (let i = 0; i < Ph.hi; i++) if (Ph.alive[i] && Ph.body[i] === F.B.id) { Ph.x[i] += dx; Ph.y[i] += dy; Ph.ox[i] = Ph.x[i]; Ph.oy[i] = Ph.y[i]; Ph.vx[i] = 0; Ph.vy[i] = 0; } F.B.cx += dx; F.B.cy += dy; }, args);
  await page.evaluate(() => { const I = window.__app.input; I.enabled = false; });          // (hands off: nobody steers while the two are set down)
  await carry([0, 'twinA']); await sleep(1500); R.one = await page.evaluate(() => ({ a: window.__app.world.entity('twinA').on, b: window.__app.world.entity('twinB').on, open: window.__app.mode.twinOpen }));
  if (!R.one.a || R.one.b || R.one.open) why.push('one pad: ' + JSON.stringify(R.one));
  // …both, at once: it opens, and stays open when they let go
  await carry([1, 'twinB']); const opened = await (async () => { const t0 = Date.now(); while (Date.now() - t0 < 4000) { if (await page.evaluate(() => window.__app.mode.twinOpen)) return true; await sleep(100); } return false; })();
  R.both = await page.evaluate(() => { const W = window.__app.world, P = W.ents.find(e => e.d.type === 'pore'); return { a: W.entity('twinA').on, b: W.entity('twinB').on, open: window.__app.mode.twinOpen, ready: window.__app.mode.poreReady(P) }; });
  if (!opened || !R.both.ready) why.push('both pads: ' + JSON.stringify(R.both));
  await page.evaluate(() => { window.__app.input.enabled = true; });
  const e = errs(logs); if (e) why.push(e); await browser.close();
}
console.log(JSON.stringify({ why, ...R })); console.log(!why.length ? 'TWIN OK' : 'TWIN FAILED');
