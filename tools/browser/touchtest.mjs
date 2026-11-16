// Drive the game with emulated touches on a phone-shaped viewport: stick, tap-dart, second-finger bud, hold-to-swell, pinch-rally.
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/dev.html?room=3', { w: 480, h: 860, touch: true });
await sleep(4000);
const st = () => page.evaluate(() => { const a = window.__app, W = a.world, F = W.player.focus; return { pos: [Math.round(F.B.cx), Math.round(F.B.cy)], mass: W.player.mass, orgs: W.player.orgs.length, darts: W.stats.darts, puff: +F.puff.toFixed(2), device: a.input.device, stick: a.input.stick.active }; });
const log = async (l) => console.log(l, JSON.stringify(await st()));
await log('start');
const t1 = await page.touchscreen.touchStart(240, 500); for (let k = 1; k <= 8; k++) { await t1.move(240, 500 + k * 9); await sleep(30); } await sleep(1400); await log('stick held down');
await t1.end(); await sleep(500); await log('released (should have stopped)');
const t2 = await page.touchscreen.touchStart(300, 300); await sleep(60); await t2.end(); await sleep(700); await log('tap → dart');
const a = await page.touchscreen.touchStart(240, 520); await sleep(150); const b = await page.touchscreen.touchStart(380, 380); await sleep(90); await b.end(); await sleep(900); await log('second-finger tap → bud');
const c = await page.touchscreen.touchStart(380, 420); await sleep(900); await log('second finger held → swell'); await c.end(); await sleep(400);
const d = await page.touchscreen.touchStart(420, 300); await sleep(60); for (let k = 1; k <= 6; k++) { await d.move(420 - k * 24, 300 + k * 30); await sleep(30); } await sleep(2600); await log('pinch → rally'); await d.end(); await a.end(); await sleep(300);
await page.screenshot({ path: '../touch.png' });
const e = errs(logs); console.log(e || 'no console errors'); await browser.close();
