// Echo: clear a chamber (autopilot), replay it and check the ghost of the first run is there to race;
// then round-trip the share code as a "friend's" echo.
import { open, sleep, errs } from './lib.mjs';
const out = process.argv[2] || '';
const { browser, page, logs } = await open('/index.html?room=0&bot&maxpx=900000', { w: 1100, h: 700 });
await sleep(500); await page.mouse.click(550, 350);
const wait = async (fn, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; };
await wait(() => window.__app.state === 'play');
await wait(() => !!window.__app.save.echo('first-light'));
const first = await page.evaluate(() => { const e = window.__app.save.echo('first-light'); return { t: e.t, samples: e.p.length / 4 }; });
console.log('first clear recorded:', JSON.stringify(first));
await page.evaluate(() => window.__app.startOdyssey(0, { single: true })); await sleep(400);
await wait(() => window.__app.state === 'play' && window.__app.mode.room && window.__app.mode.room.id === 'first-light' && window.__app.world.roomTime > 1.5 && window.__app.world.roomTime < 6);
const mid = await page.evaluate(() => { const a = window.__app, m = a.mode, F = a.world.player.focus; return { ghost: !!m.echo, at: m.echo ? [Math.round(m.echo.x), Math.round(m.echo.y)] : null, me: [Math.round(F.B.cx), Math.round(F.B.cy)], t: +a.world.roomTime.toFixed(1), code: m.echoCode().slice(0, 40) + '…', menu: m.pauseItems().map(i => i.label) }; });
console.log('replay, mid-run:', JSON.stringify(mid)); if (out) await page.screenshot({ path: out + '_echo.png' });
const code = await page.evaluate(() => window.__app.mode.echoCode());
// a "friend" sends the same code: parse it the way the Atrium does and race it
const ok = await page.evaluate((code) => { const a = window.__app; const m = /MYRIA-ECHO\.([a-z0-9-]+)\.([0-9.]+)\.([A-Za-z0-9_-]+)/.exec(code); if (!m) return false; a.rivalEcho = { id: m[1], t: +m[2], p: m[3] }; a.startOdyssey(0, { single: true }); return true; }, code); await sleep(400);
await wait(() => window.__app.state === 'play' && window.__app.world.roomTime > 1.5 && window.__app.world.roomTime < 6);
const riv = await page.evaluate(() => { const m = window.__app.mode; return { parsed: true, own: !!m.echo, rival: !!m.rival, rivalT: m.rival && m.rival.T, ents: window.__app.world.ents.filter(e => e.d.type === 'echo').length }; });
console.log('friend\'s echo:', ok, JSON.stringify(riv)); if (out) await page.screenshot({ path: out + '_rival.png' });
console.log(mid.ghost && riv.rival && riv.ents === 2 ? 'ECHO OK' : 'ECHO FAILED');
console.log(errs(logs) || 'no console errors'); await browser.close();
