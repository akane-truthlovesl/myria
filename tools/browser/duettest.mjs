// Two players, one screen: player one follows the pointer, player two steers with W A S D and darts with Space
// (a tap darts, a held key lances) — and two on one phone: each half of the glass wakes its own stick (core/second.js).
// Checked in Duet (a round of Rain) and in a co-op dive.
import { open, sleep, errs } from './lib.mjs';
let allOk = true;
for (const mode of ['duet', 'coop']) {
  const { browser, page, logs } = await open(`/index.html?mode=${mode}${mode === 'duet' ? '&round=rain' : ''}&maxpx=900000`, { w: 1100, h: 700 });
  await sleep(500); await page.mouse.click(550, 350);
  for (let k = 0; k < 80 && await page.evaluate(() => window.__app.state) !== 'play'; k++) await sleep(150); await sleep(1000);
  const pos = () => page.evaluate(() => { const a = window.__app, F2 = a.mode.p2.focus, F1 = a.world.player.focus; return { p1: [Math.round(F1.B.cx), Math.round(F1.B.cy)], p2: [Math.round(F2.B.cx), Math.round(F2.B.cy)] }; });
  await page.mouse.move(300, 250); const a = await pos();
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS'); await sleep(1100); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS'); const b = await pos();
  await page.evaluate(() => { const F = window.__app.mode.p2.focus; window.__pw = []; const d = F.dart.bind(F); F.dart = (x, y, p) => { window.__pw.push(+p.toFixed(2)); return d(x, y, p); }; });
  await page.keyboard.down('Space'); await sleep(60); await page.keyboard.up('Space'); await sleep(600); await page.keyboard.down('Space'); await sleep(800); await page.keyboard.up('Space'); await sleep(300);
  const pw = await page.evaluate(() => window.__pw); const d2 = Math.hypot(b.p2[0] - a.p2[0], b.p2[1] - a.p2[1]), d1 = Math.hypot(b.p1[0] - a.p1[0], b.p1[1] - a.p1[1]);
  const ok = d2 > 60 && b.p2[0] < a.p2[0] && b.p2[1] > a.p2[1] && d1 > 30 && pw.length === 2 && pw[0] < 1.2 && pw[1] >= 1.25 && !errs(logs);
  console.log(`${mode}: player two moved ${d2.toFixed(0)} px down-left on A+S, player one ${d1.toFixed(0)} px toward the pointer; player two's dart powers (tap, hold) ${JSON.stringify(pw)} · ${errs(logs) || 'no console errors'}`);
  allOk = allOk && ok; await browser.close();
}
// two on one phone (portrait: Tide the top half, Ember the bottom): both thumbs at once, then a tap in the top half darts Tide only
for (const mode of ['duet', 'coop']) {
  const { browser, page, logs } = await open(`/index.html?mode=${mode}${mode === 'duet' ? '&round=rain' : ''}&maxpx=600000`, { w: 480, h: 860, touch: true });
  for (let k = 0; k < 120 && !(await page.evaluate(() => window.__app && window.__app.state === 'play' && !!window.__app.mode.p2 && !!window.__app.mode.p2.focus)); k++) await sleep(150); await sleep(800);
  const pos = () => page.evaluate(() => { const a = window.__app, F2 = a.mode.p2.focus, F1 = a.world.player.focus; return { p1: [Math.round(F1.B.cx), Math.round(F1.B.cy)], p2: [Math.round(F2.B.cx), Math.round(F2.B.cy)] }; });
  const a = await pos(); const t2 = await page.touchscreen.touchStart(240, 200), t1 = await page.touchscreen.touchStart(240, 660);
  for (let k = 1; k <= 10; k++) { await t2.move(240 + k * 7, 200); await t1.move(240 - k * 7, 660); await sleep(30); }
  const roles = await page.evaluate(() => [...window.__app.input.pointers.values()].map(p => p.role).sort().join(','));
  await sleep(1100); await t2.end(); await t1.end(); const b = await pos();
  await page.evaluate(() => { for (const [k, F] of [['d1', window.__app.world.player.focus], ['d2', window.__app.mode.p2.focus]]) { window['__' + k] = 0; const d = F.dart.bind(F); F.dart = (x, y, p) => { window['__' + k]++; return d(x, y, p); }; } });
  await sleep(700); const t3 = await page.touchscreen.touchStart(120, 120); await sleep(60); await t3.end(); await sleep(500);
  const darts = await page.evaluate(() => [window.__d1, window.__d2]), dx1 = b.p1[0] - a.p1[0], dx2 = b.p2[0] - a.p2[0];
  const ok = roles === 'stick,stick2' && dx2 > 40 && dx1 < -40 && darts[0] === 0 && darts[1] === 1 && !errs(logs);
  console.log(`${mode} on one phone: thumbs ${roles} · Tide ${dx2} px right, Ember ${dx1} px left · darts (Ember, Tide) after a tap in the top half ${JSON.stringify(darts)} · ${errs(logs) || 'no console errors'}`);
  allOk = allOk && ok; await browser.close();
}
console.log(allOk ? 'DUET OK' : 'DUET FAILED');
