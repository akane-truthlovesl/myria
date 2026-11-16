// Browser driver: node drive.mjs <urlPath> <outPrefix> <w> <h> "<actions>"
// actions (comma separated): w<ms> wait · mm:x:y mouse move · click:x:y · rclick:x:y · k:Key press · kd:Key · ku:Key · s screenshot · st status · e:<js> eval · u:<js> wait until truthy
import { open, sleep, errs } from './lib.mjs';
const [url, out, w = '1280', h = '720', actions = ''] = process.argv.slice(2);
const { browser, page, logs } = await open(url, { w: +w, h: +h });
let shot = 0;
const status = `(() => { const a = window.__app; if (!a) return null; const W = a.world, pl = W.player, F = pl && pl.focus; return { state: a.state, mode: a.mode && a.mode.constructor.name, t: +W.roomTime.toFixed(1), mass: pl ? pl.mass : 0, orgs: pl ? pl.orgs.length : 0, pos: F ? [F.B.cx | 0, F.B.cy | 0] : null, motes: W.stats ? W.stats.motes + '/' + W.stats.motesTotal : '', lost: W.stats && W.stats.lost, fb: [a.R.fb.w, a.R.fb.h], sim: +a.perf.sim.toFixed(2), ren: +a.perf.ren.toFixed(2), ema: +(1 / a.perf.ema).toFixed(0), dirty: a.R.stats.dirty, frames: a.frames, skip: a.skip, st: [a.R.stats.underMs, a.R.stats.fluidMs, a.R.stats.presentMs].map(v => +v.toFixed(1)), fl: a.R.lastFluid && [a.R.lastFluid.clusters, a.R.lastFluid.nodes, a.R.lastFluid.px, a.R.lastFluid.plate, +a.R.lastFluid.tSplat.toFixed(1), +a.R.lastFluid.tDome.toFixed(1), +a.R.lastFluid.tShade.toFixed(1)], cell: a.R.fluid.cell }; })()`;
for (const a of actions.split(',').map(s => s.trim()).filter(Boolean)) {
  if (/^w\d+$/.test(a)) await sleep(+a.slice(1));
  else if (a.startsWith('mm:')) { const [x, y] = a.slice(3).split(':').map(Number); await page.mouse.move(x, y, { steps: 6 }); }
  else if (a.startsWith('click:')) { const [x, y] = a.slice(6).split(':').map(Number); await page.mouse.move(x, y); await page.mouse.down(); await sleep(40); await page.mouse.up(); }
  else if (a.startsWith('rclick:')) { const [x, y] = a.slice(7).split(':').map(Number); await page.mouse.move(x, y); await page.mouse.down({ button: 'right' }); await sleep(40); await page.mouse.up({ button: 'right' }); }
  else if (a.startsWith('kd:')) await page.keyboard.down(a.slice(3));
  else if (a.startsWith('ku:')) await page.keyboard.up(a.slice(3));
  else if (a.startsWith('k:')) await page.keyboard.press(a.slice(2));
  else if (a === 's') { await page.screenshot({ path: `${out}_${shot++}.png` }); console.log('shot', shot - 1, JSON.stringify(await page.evaluate(status))); }
  else if (a === 'q') console.log('q', await page.evaluate(() => { const a = window.__app, W = a.world, F = W.player.focus; const f = W.ents.find(e => e.d.type === 'film'); return [F ? Math.round(F.B.cx) + ',' + Math.round(F.B.cy) : '-', 'mass', W.player.mass, 'orgs', W.player.orgs.length, 'film', f ? f.S.active : null, 'darts', W.stats.darts, 'motes', W.stats.motes, 'pads', W.ents.filter(e => e.d.type === 'pad').map(p => p.count + ':' + p.active).join('|'), 'gate', W.ents.filter(e => e.d.type === 'gate').map(g => g.k.toFixed(2)).join('|'), 'state', a.state].join(' '); }));
  else if (a === 'st') console.log('status', JSON.stringify(await page.evaluate(status)));
  else if (a.startsWith('e:')) console.log('eval', JSON.stringify(await page.evaluate(a.slice(2))));
  else if (a.startsWith('u:')) { const t0 = Date.now(); let ok = false; while (Date.now() - t0 < 60000) { ok = await page.evaluate(`(() => { try { return !!(${a.slice(2)}); } catch (e) { return false; } })()`); if (ok) break; await sleep(100); } if (!ok) console.log('timeout waiting for', a.slice(2)); }
}
const e = errs(logs); if (e) console.log(e);
await browser.close();
