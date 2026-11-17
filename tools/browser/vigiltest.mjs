// Vigil: an omen is announced, then lands; each does what its warning says — the drought's light keeps to one pool at a time and dry ground
// sears, frost freezes a body through and lets it go when it passes, glass flies edge-on along its seam and leaves light where it has been, the
// quake heaves the way it showed and shakes light loose at the rim, the maelstrom's light grows richer toward the dark heart, the eclipse
// puts the dish out; the light burns down by itself; an ember that eats nothing goes out, and the panel tells the story. node vigiltest.mjs [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const { browser, page, logs } = await open(`/index.html?mode=vigil&maxpx=600000`, { w, h });
const until = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(100); } return false; };
await sleep(500); await page.mouse.click(w / 2, h / 2);
await until(() => window.__app.state === 'play' && window.__app.mode && window.__app.mode.dbg);
await page.mouse.move(w / 2, h / 2);
const why = []; const r = {};
// (a hand on the clock: end whatever rages and announce the omen asked for, a breath from landing)
await page.evaluate(() => { window.__omen = (id) => { const m = window.__app.mode, W = window.__app.world, st = m.story[m.story.length - 1]; if (m.active.length) { for (const s of m.active) m._end(W, s); if (st && st.ok === null) { st.ok = true; m.seenN += st.ids.length; } } m.active = []; m.round = Math.max(1, m.round); m.queue = [[id]]; m._warn(W); m.pt = 2.75; }; });
const storm = (id) => until(`window.__app.mode.phase === 'storm' && window.__app.mode.active.some(s => s.id === '${id}')`, 4000);

// 1 · the first omen is announced at seven seconds, its warning in the title
await page.evaluate(() => { window.__app.mode.pt = 6.9; });
await until(() => window.__app.mode.phase === 'warn', 3000);
r.warn = await page.evaluate(() => ({ phase: window.__app.mode.phase, title: window.__app.hud.title.textContent }));
if (!(r.warn.phase === 'warn' && /omen 1/i.test(r.warn.title))) why.push(`announce: ${JSON.stringify(r.warn)}`);

// 2 · the light burns down by itself, and says so once
await until(() => window.__app.mode.burnt >= 2, 9000);
r.burn = await page.evaluate(() => ({ burnt: window.__app.mode.burnt, rate: +window.__app.mode.burnRate(window.__app.world.player.mass).toFixed(2), toast: [...document.querySelectorAll('.h-toast')].map(e => e.textContent).join(' / ') }));
if (!(r.burn.burnt >= 2 && /burns down/.test(r.burn.toast))) why.push(`burn: ${JSON.stringify(r.burn)}`);

// 3 · the drought: light falls in the live pool only; when the light moves on it moves to another pool; dry ground sears
await page.evaluate(() => window.__omen('drought')); await storm('drought');
r.drought = await page.evaluate(async () => {
  const m = window.__app.mode, W = window.__app.world, s = m.active.find(q => q.id === 'drought'), B = W.player.focus.B;
  const inLive = () => { const p = s.pools[s.live]; let ok = 0; for (let k = 0; k < 8; k++) { const e = m._light(W); if (e && Math.hypot(e.x - p.x, e.y - p.y) <= p.r * 0.72) ok++; } return ok; };
  const a = inLive(), live0 = s.live; s.swap = 0.01; await new Promise(res => setTimeout(res, 250)); const moved = s.live !== live0, b = inLive();
  for (const p of s.pools) { p.x = B.cx + 900; p.y = B.cy; }                // (the water goes elsewhere: the creature is left on dry ground)
  const lost0 = W.stats.lost; await new Promise(res => setTimeout(res, 1600)); return { pools: s.pools.length, inLive: a + b, moved, seared: W.stats.lost - lost0, cracks: s.cracks.length };
});
if (!(r.drought.pools === 3 && r.drought.inLive >= 14 && r.drought.moved && r.drought.seared >= 2 && r.drought.cracks > 20)) why.push(`drought: ${JSON.stringify(r.drought)}`);

// 4 · the frost: a field over the creature freezes it through (and says a dart cracks the ice); when the frost passes, it thaws
await page.evaluate(() => window.__omen('frost')); await storm('frost');
r.frost = await page.evaluate(async () => {
  const m = window.__app.mode, W = window.__app.world, s = m.active.find(q => q.id === 'frost'), F = W.player.focus;
  s.R1 = 2000; s.t = 17; for (const f of s.fields) { f.x = F.B.cx; f.y = F.B.cy; } s.spring.x = F.B.cx + 2000;
  let frozen = false; for (let k = 0; k < 50 && !frozen; k++) { for (const f of s.fields) { f.x = F.B.cx; f.y = F.B.cy; } await new Promise(res => setTimeout(res, 100)); frozen = F.heat < -0.92; }
  const toast = [...document.querySelectorAll('.h-toast')].map(e => e.textContent).join(' / '); const heat = F.heat;
  m.pt = 17.99; await new Promise(res => setTimeout(res, 300)); return { frozen, heat: +heat.toFixed(2), toast, after: +F.heat.toFixed(2), phase: m.phase };
});
if (!(r.frost.frozen && /dart cracks the ice/.test(r.frost.toast) && r.frost.after >= -0.31 && r.frost.phase === 'lull')) why.push(`frost: ${JSON.stringify(r.frost)}`);

// 5 · glass: the shard waits out its seam, then flies edge-on along it, and leaves light where it has been
await page.evaluate(() => window.__omen('glass')); await storm('glass');
await until(() => { const s = window.__app.mode.active.find(q => q.id === 'glass'); return s && s.shards.some(q => q.e); }, 4000);
r.glass = await page.evaluate(async () => {
  const m = window.__app.mode, s = m.active.find(q => q.id === 'glass'), q = s.shards.find(z => z.e), e = q.e;
  const seam = Math.atan2(q.dy, q.dx), dA = Math.abs(Math.atan2(Math.sin(e.S.angle - seam), Math.cos(e.S.angle - seam)));
  const drops0 = q.drops.length, x0 = e.x, y0 = e.y; await new Promise(res => setTimeout(res, 2600));
  const along = Math.abs((e.x - x0) * -q.dy + (e.y - y0) * q.dx);         // how far off its own seam it strayed
  return { edgeOn: +dA.toFixed(3), drops0, dropsLeft: q.drops.length, flew: +Math.hypot(e.x - x0, e.y - y0).toFixed(0), off: +along.toFixed(1), warn: q.warn };
});
if (!(r.glass.edgeOn < 0.01 && r.glass.drops0 >= 1 && r.glass.dropsLeft < r.glass.drops0 && r.glass.off < 2)) why.push(`glass: ${JSON.stringify(r.glass)}`);

// 6 · the quake: its way is shown first, then the ground heaves that way, and light is shaken loose at the rim it heaves toward
await page.evaluate(() => window.__omen('quake')); await storm('quake');
r.quake = await page.evaluate(async () => {
  const m = window.__app.mode, W = window.__app.world, s = m.active.find(q => q.id === 'quake'); s.next = 0.95;
  let shown = null; for (let k = 0; k < 30 && !shown; k++) { await new Promise(res => setTimeout(res, 50)); if (s.dir) shown = s.dir.slice(); }
  const motes0 = W.pickups.filter(p => p.isMote && !p.dead).length; let g = null;
  for (let k = 0; k < 40 && !g; k++) { await new Promise(res => setTimeout(res, 50)); if (s.jolt > 0) g = [W.phys.gx, W.phys.gy]; }
  const motes1 = W.pickups.filter(p => p.isMote && !p.dead).length; const same = shown && g ? (shown[0] * g[0] + shown[1] * g[1]) / Math.hypot(g[0], g[1]) : 0;
  return { shown: !!shown, heave: g ? Math.round(Math.hypot(g[0], g[1])) : 0, sameWay: +same.toFixed(2), gears: s.gears.length, shaken: motes1 - motes0 };
});
if (!(r.quake.shown && r.quake.heave > 1000 && r.quake.sameWay > 0.99 && r.quake.gears >= 3 && r.quake.shaken >= 1)) why.push(`quake: ${JSON.stringify(r.quake)}`);

// 7 · the maelstrom: a dark heart, and light grows richer as it is drawn toward it
await page.evaluate(() => window.__omen('maelstrom')); await storm('maelstrom');
r.mael = await page.evaluate(async () => {
  const m = window.__app.mode, W = window.__app.world, cx = W.spec.W / 2, cy = W.spec.H / 2, mn = Math.min(W.spec.W, W.spec.H);
  const near = W.spawn({ type: 'mote', x: cx + mn * 0.12, y: cy, free: true, value: 2 }), far = W.spawn({ type: 'mote', x: cx + mn * 0.58, y: cy + 4, free: true, value: 2 });
  await new Promise(res => setTimeout(res, 200)); return { well: W.ents.some(e => e.d.type === 'well' && !e.dead), near: near.value, far: far.value };
});
if (!(r.mael.well && r.mael.near >= 3 && r.mael.far <= 2)) why.push(`maelstrom: ${JSON.stringify(r.mael)}`);

// 8 · the eclipse: the dish goes dark, eyes at the rim
await page.evaluate(() => window.__omen('eclipse')); await storm('eclipse');
await until(() => window.__app.mode.dark > 0.6, 4000);
r.eclipse = await page.evaluate(() => ({ dark: +window.__app.mode.dark.toFixed(2), eyes: window.__app.world.ents.filter(e => e.watch && !e.dead).length, mael: window.__app.world.ents.some(e => e.d.type === 'well' && !e.dead) }));
if (!(r.eclipse.dark > 0.6 && r.eclipse.eyes >= 2 && !r.eclipse.mael)) why.push(`eclipse: ${JSON.stringify(r.eclipse)}`);

// 9 · an ember that eats nothing for eight seconds goes out — and the panel tells the story
await page.evaluate(() => {
  const m = window.__app.mode, W = window.__app.world, P = W.phys, st = m.story[m.story.length - 1]; for (const s of m.active) m._end(W, s); if (st && st.ok === null) st.ok = true; m.active = []; m.phase = 'lull'; m.pt = -60;
  for (const p of W.pickups) if (p.isMote) p.dead = true; m.lightT = 999;
  for (const O of W.player.orgs) { const B = O.B; let keep = O === W.player.focus ? 8 : 0; for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.alive[i] && P.body[i] === B.id) { if (keep > 0) keep--; else P.kill(i); } } }
});
await page.mouse.move(w * 0.05, h * 0.05);
const t0 = Date.now(); while (Date.now() - t0 < 16000) { const o = await page.evaluate(() => { const m = window.__app.mode; m.lightT = 999; for (const p of window.__app.world.pickups) if (p.isMote) p.dead = true; return m.over; }); if (o) break; await sleep(150); }
await until(() => !!document.querySelector('.h-veil.on .b-garden canvas'), 6000); await sleep(300);
r.end = await page.evaluate(() => { const v = document.querySelector('.h-veil.on'); if (!v) return null; const c = v.querySelector('.b-garden canvas'); return { title: v.querySelector('h2').textContent, sub: v.querySelector('.sub').textContent, rows: v.querySelectorAll('.v-story > div').length, early: ((v.querySelector('.v-early') || {}).textContent || '').trim().split(/\s+/).filter(Boolean).length, pic: c ? [c.width, c.height] : null, medals: v.querySelectorAll('.medals span').length, emberToast: [...document.querySelectorAll('.h-toast')].some(e => /an ember/.test(e.textContent)) }; });
if (!r.end || !/light went out|Spark|Lantern|Beacon|Sun/.test(r.end.title) || !(r.end.rows >= 4 && r.end.rows + r.end.early >= 6) || !r.end.pic || r.end.medals !== 4 || !/omens? seen through/.test(r.end.sub)) why.push(`end: ${JSON.stringify(r.end)}`);

console.log(JSON.stringify({ why, ...r }));
const e = errs(logs); console.log(e || 'no console errors'); console.log(!why.length && !e ? 'VIGIL OK' : 'VIGIL FAILED'); await browser.close();
