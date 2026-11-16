// Two players, one screen: player one follows the pointer, player two steers with W A S D and darts with Space
// (a tap darts, a held key lances). Checked in Duet and in a co-op dive.
import { open, sleep, errs } from './lib.mjs';
let allOk = true;
for (const mode of ['duet', 'coop']) {
  const { browser, page, logs } = await open(`/index.html?mode=${mode}&maxpx=900000`, { w: 1100, h: 700 });
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
console.log(allOk ? 'DUET OK' : 'DUET FAILED');
