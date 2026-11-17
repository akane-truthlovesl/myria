// Bloom, the rain and its garden: figures fall on threads; the autopilot draws some whole — each one etched into the plate and a step up
// the multiplier; a chain left hungry falls quiet (×1 again); walking into the blade cuts it; and the run ends on a panel with the garden as
// a picture and the figures tallied. node bloomtest.mjs [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const { browser, page, logs } = await open(`/index.html?mode=bloom&bot&maxpx=600000`, { w, h });
const until = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; };
await sleep(500); await page.mouse.click(w / 2, h / 2);
await until(() => window.__app.state === 'play');
const why = []; const r = {};
// 1 · figures fall on threads
await until(() => window.__app.mode.figs.length > 0, 8000);
r.thread = await page.evaluate(() => { const F = window.__app.mode.figs[0]; return F ? { kind: F.kind, stars: F.n, segs: F.segs.length } : null; });
if (!r.thread || r.thread.stars < 4 || r.thread.segs < 3) why.push('no figure on a thread');
// 2 · the autopilot draws figures whole: each etched into the plate, the multiplier stepping up
await until(() => window.__app.mode.drawnList.length >= 3, 30000);
r.drawn = await page.evaluate(() => { const m = window.__app.mode, W = window.__app.world, R = window.__app.R; return { n: m.drawnList.length, best: m.bestMult, etches: W.etches.length, onPlate: W.etches.filter(d => R.room.decals.includes(d) && d.baked).length, score: m.score }; });
if (!(r.drawn.n >= 3 && r.drawn.best >= 3 && r.drawn.etches === r.drawn.n && r.drawn.onPlate === r.drawn.n)) why.push(`drawing: ${JSON.stringify(r.drawn)}`);
// 3 · a chain left hungry falls quiet: the multiplier is gone with it
await page.evaluate(() => { window.__app.bot = false; const m = window.__app.mode, W = window.__app.world; m.lvl = 4; W.chain = 30; W.chainT = W.time; for (const p of W.pickups) p.dead = true; m.rain = 99; });
await page.mouse.move(w * 0.5, h * 0.5);
await until(() => window.__app.mode.quiet > 0, 6000);
r.quiet = await page.evaluate(() => { const m = window.__app.mode; return { quiet: m.quiet, mult: m.mult(), toast: [...document.querySelectorAll('.h-toast')].map(e => e.textContent).join(' / ') }; });
if (!(r.quiet.quiet >= 1 && r.quiet.mult === 1 && /fell quiet/.test(r.quiet.toast))) why.push(`quiet: ${JSON.stringify(r.quiet)}`);
// 4 · the blade wakes, and touching it cuts the chain
await page.mouse.move(w * 0.86, h * 0.84);
await page.evaluate(() => { const m = window.__app.mode; m.el = 18.2; m.t = 75 - 18.2; m.rain = 0.5; });
await until(() => window.__app.world.ents.some(e => e.d.type === 'blade'), 9000);
await page.evaluate(() => { const m = window.__app.mode, W = window.__app.world; m.lvl = 5; W.chain = 40; W.chainT = W.time; m.tearT = -9; m.cuts = 0; });
await page.mouse.move(w * 0.5, h * 0.5);
const t0 = Date.now(); while (Date.now() - t0 < 8000) { const c = await page.evaluate(() => { const m = window.__app.mode, W = window.__app.world; if (!m.cuts) W.chainT = W.time; return m.cuts; }); if (c) break; await sleep(60); }
r.cut = await page.evaluate(() => { const m = window.__app.mode, W = window.__app.world; return { cuts: m.cuts, mult: m.mult(), chain: W.chain, toast: [...document.querySelectorAll('.h-toast')].map(e => e.textContent).join(' / ') }; });
if (!(r.cut.cuts >= 1 && r.cut.mult === 1 && /blade cut the chain/.test(r.cut.toast))) why.push(`cut: ${JSON.stringify(r.cut)}`);
// 5 · the end: the garden as a picture, the figures tallied, the medals
await page.evaluate(() => { window.__app.mode.t = 0.05; });
await until(() => !!document.querySelector('.h-veil.on .b-garden canvas'), 8000);
await sleep(400);
r.end = await page.evaluate(() => { const v = document.querySelector('.h-veil.on'); if (!v) return null; const c = v.querySelector('.b-garden canvas'); return { title: v.querySelector('h2').textContent, sub: v.querySelector('.sub').textContent, pic: c ? [c.width, c.height] : null, glyphs: (v.querySelector('.b-glyphs') || {}).textContent || '', medals: v.querySelectorAll('.medals span').length, toastsHidden: getComputedStyle(document.querySelector('.h-toasts')).opacity === '0' }; });
if (!r.end || !r.end.pic || !(r.end.pic[0] > 100) || !/figures? drawn/.test(r.end.sub) || r.end.medals !== 4 || !r.end.glyphs) why.push(`end: ${JSON.stringify(r.end)}`);
console.log(JSON.stringify({ why, ...r }));
const e = errs(logs); console.log(e || 'no console errors'); console.log(!why.length && !e ? 'BLOOM OK' : 'BLOOM FAILED'); await browser.close();
