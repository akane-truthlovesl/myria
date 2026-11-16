// Visit every Odyssey chamber in one page with the autopilot for a few seconds each; report errors and timings.
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/dev.html?room=0&bot&maxpx=900000', { w: 1100, h: 900 });
await sleep(3000);
for (let i = 0; i < 20; i++) {
  await page.evaluate((i) => window.__app.startOdyssey(i), i);
  const t0 = Date.now(); while (Date.now() - t0 < 15000) { if (await page.evaluate(() => window.__app.state === 'play')) break; await sleep(150); }
  await sleep(+(process.argv[2] || 5000));
  const r = await page.evaluate(() => { const a = window.__app, W = a.world; return `${a.mode.room.name.padEnd(14)} state=${a.state} t=${W.roomTime.toFixed(0)} motes=${W.stats.motes}/${W.stats.motesTotal} mass=${W.player.mass} orgs=${W.player.orgs.length} lost=${W.stats.lost} parts=${W.phys.count} sim=${a.perf.sim.toFixed(1)} ren=${a.perf.ren.toFixed(1)} skip=${a.skip}`; });
  console.log(i, r);
}
const e = errs(logs); console.log(e ? 'ERRORS:\n' + e : 'no console errors');
await browser.close();
