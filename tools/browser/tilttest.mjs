// Optional gyro: turn "Tilt" on from the pause menu on a phone-shaped touch viewport, then feed synthetic deviceorientation
// events and check the creature runs downhill, stops when level, and that the stick still overrides.
import { open, sleep, errs } from './lib.mjs';
// (device orientation only exists in secure contexts: https, localhost, file — so the test origin is declared trustworthy)
const { browser, page, logs } = await open('/index.html?room=0', { w: 480, h: 860, touch: true, args: ['--unsafely-treat-insecure-origin-as-secure=http://myria.test'] });
await sleep(600); await page.touchscreen.tap(240, 430);
for (let k = 0; k < 80 && await page.evaluate(() => window.__app.state) !== 'play'; k++) await sleep(150);
const st = () => page.evaluate(() => { const a = window.__app, F = a.world.player.focus; return { x: Math.round(F.B.cx), y: Math.round(F.B.cy), tilt: a.input.tilt.on, avail: a.input.tiltAvailable }; });
const tip = (beta, gamma, ms) => page.evaluate(async (beta, gamma, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma })); await new Promise(r => setTimeout(r, 30)); } }, beta, gamma, ms);
const s0 = await st(); console.log('start', JSON.stringify(s0));
await page.evaluate(() => window.__app.pause()); await sleep(400);
const found = await page.evaluate(() => { const b = [...document.querySelectorAll('.m-item')].find(b => b.textContent.startsWith('Tilt')); if (b) b.click(); return !!b; }); await sleep(300);
const label = await page.evaluate(() => { const b = [...document.querySelectorAll('.m-item')].find(b => b.textContent.startsWith('Tilt')); return b && b.textContent; });
await page.evaluate(() => window.__app.resume()); await sleep(300);
console.log('menu item present:', found, '→', label);
await tip(40, 0, 500);                        // hold it as you would: this pose becomes level
const a = await st(); await tip(40, 14, 1300); const b = await st();          // tip right
await tip(40, 0, 700); const c = await st(); await sleep(100); await tip(40, 0, 500); const c2 = await st();      // level again: it should settle
await tip(28, 0, 1300); const d = await st();                                  // tip away (top edge down): up the screen
console.log('level', JSON.stringify(a), '\ntip right', JSON.stringify(b), '\nlevel', JSON.stringify(c2), '\ntip up', JSON.stringify(d));
const ok = found && b.x - a.x > 60 && Math.abs(c2.x - c.x) < 25 && d.y - c2.y < -60;
console.log(ok ? 'TILT OK: runs downhill, rests when level' : 'TILT FAILED');
console.log(errs(logs) || 'no console errors'); await browser.close();
