// The Workshop, end to end in a real page, with a real mouse: paint a line of light, draw a wall, set down a blade and a door,
// erase, undo — then play the chamber (its wall really set into the plate), come home to seal it, copy it as a line of text, and play
// that line as a stranger would: same room, the maker's run racing beside you as a blue bead.
// node workshoptest.mjs [shot-prefix]
import { open, sleep, errs } from './lib.mjs';
const shot = process.argv[2] || '';
const { browser, page, logs } = await open('/index.html?mode=workshop', { w: 1280, h: 720 });
const state = () => page.evaluate(() => window.__app && window.__app.state);
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; };
await until(() => window.__app && window.__app.state === 'play' && window.__app.mode && window.__app.mode.isBench && document.querySelector('.h-tray.ws'));
await sleep(600);
const R = {};
const css = (u, v) => page.evaluate((u, v) => { const m = window.__app.mode, q = m.f.P(u, v); const [x, y] = window.__R.worldToCss(q.x, q.y); const r = document.getElementById('c').getBoundingClientRect(); return [r.left + x, r.top + y]; }, u, v);
const tool = (id) => page.click(`.h-tray button[data-id="${id}"]`);
const act = (id) => page.click(`.h-tray button[data-act="${id}"]`);
const drag = async (pts, steps = 8) => { const p0 = await css(...pts[0]); await page.mouse.move(p0[0], p0[1]); await page.mouse.down(); for (let i = 1; i < pts.length; i++) { const a = await css(...pts[i - 1]), b = await css(...pts[i]); for (let k = 1; k <= steps; k++) { await page.mouse.move(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps); await sleep(16); } } await sleep(40); await page.mouse.up(); await sleep(120); };
const tap = async (u, v) => { const p = await css(u, v); await page.mouse.click(p[0], p[1]); await sleep(150); };
const items = () => page.evaluate(() => window.__app.mode.D.items.map(it => it[0]).join(','));
R.fresh = await items();

// paint light: a drag lays a line of it, a light every few steps, each one alive at once
await tool('light'); await drag([[0.30, 0.25], [0.45, 0.22], [0.60, 0.25]], 10);
R.light = await page.evaluate(() => { const m = window.__app.mode, it = m.D.items[m.D.items.length - 1]; return { kind: it[0], n: (it.length - 1) / 2, live: window.__app.world.pickups.filter(p => p.isMote && p.free).length }; });
// a wall of glass across the middle (cut round nothing: it keeps off the sleeper and the way out)
await tool('pen1'); await drag([[0.50, 0.40], [0.50, 0.62], [0.52, 0.80]], 10);
R.wall = await page.evaluate(() => { const m = window.__app.mode, it = m.D.items[m.D.items.length - 1]; const rods = window.__app.world.ents.filter(e => e.d.type === 'rod'); return { kind: it[0], pen: it[1], pts: (it.length - 2) / 2, rods: rods.length, shapes: rods.reduce((n, r) => n + r.S.length, 0) }; });
// a blade, tapped; a door, dragged across the gap below the wall
await tool('blade'); await tap(0.72, 0.35);
await tool('door'); await drag([[0.62, 0.84], [0.62, 0.62]], 6);
R.after = await items();
R.door = await page.evaluate(() => { const g = window.__app.world.ents.find(e => e.d.type === 'gate'); return g ? { shut: g.k < 0.5 } : null; });
// erase the blade (a tap with the eraser), then undo it back, then erase it again
await act('erase'); await tap(0.72, 0.35); R.erased = await items(); await act('undo'); await sleep(200); R.undone = await items(); await tap(0.72, 0.35); R.erased2 = await items();
// move: take hold of the door and slide it along
await act('move'); const before = await page.evaluate(() => { const it = window.__app.mode.D.items.find(q => q[0] === 'D'); return [it[1], it[2]]; });
await drag([[0.62, 0.73], [0.75, 0.73]], 6);
R.moved = await page.evaluate((b) => { const it = window.__app.mode.D.items.find(q => q[0] === 'D'); return [it[1] - b[0], it[2] - b[1]]; }, before);
// the mirror: one blade set down, two on the bench, reflected across the middle; a stroke of stone drawn once, set twice
await act('mirror'); const n0 = await page.evaluate(() => window.__app.mode.D.items.length);
await tool('blade'); await tap(0.30, 0.36);
await tool('pen0'); await drag([[0.74, 0.12], [0.84, 0.26]], 6);
R.mirror = await page.evaluate((n0) => { const m = window.__app.mode, L = m.D.items.slice(n0); const bl = L.filter(q => q[0] === 'bl'), w = L.filter(q => q[0] === 'w');
  return { added: L.map(q => q[0]).join(','), sym: bl.length === 2 && bl[0][1] === bl[1][1] && Math.abs(bl[0][2] + bl[1][2] - 1000) <= 1, walls: w.length, saved: !!window.__ws.shelf.bench().mirror, on: document.querySelector('.h-tray button[data-act="mirror"]').classList.contains('on'), live: window.__app.world.ents.filter(e => e.d.type === 'blade').length, spins: window.__app.world.ents.filter(e => e.d.type === 'blade').map(e => Math.sign(e.d.spin)).join(','),
  toast: (() => { const t = document.querySelector('.h-toast'), tr = document.querySelector('.h-tray.ws'); return t && tr ? t.getBoundingClientRect().bottom <= tr.getBoundingClientRect().top + 1 : null; })() }; }, n0);
if (shot) await page.screenshot({ path: shot + '-mirror.png' });
await act('mirror'); R.mirrorOff = await page.evaluate(() => !window.__app.mode.mirror);
if (shot) await page.screenshot({ path: shot + '-bench.png' });

// play it: the wall is now glass in the plate (the room's own SDF), the light is the room's light
await act('play');
await until(() => window.__app.state === 'play' && window.__app.mode && window.__app.mode.D && !window.__app.mode.isBench);
await sleep(1600);
R.trial = await page.evaluate(() => { const a = window.__app, W = a.world, m = a.mode, it = m.D.items.find(q => q[0] === 'w'); const q = m.room && it ? W.spec : null; const f = window.__ws; const P = it ? (() => { const L = W.spec.W >= W.spec.H; const u = it[4] / 1000, v = it[5] / 1000; return L ? [u * W.spec.W, v * W.spec.H] : [v * W.spec.W, u * W.spec.H]; })() : [0, 0];
  return { name: m.room.name, sdfAtWall: +W.phys.sampleSDF(P[0], P[1]).toFixed(1), lights: W.stats.motesTotal, need: (W.ents.find(e => e.d.type === 'pore') || {}).need, rods: W.ents.filter(e => e.d.type === 'rod').length, rec: (m.rec || []).length, title: (document.querySelector('.h-title') || {}).textContent || '' }; });
if (shot) await page.screenshot({ path: shot + '-trial.png' });
// …and come home: the first run through seals it
await page.evaluate(() => { const a = window.__app, W = a.world, m = a.mode; W.stats.motes = W.ents.find(e => e.d.type === 'pore').need; m.complete(W.ents.find(e => e.d.type === 'pore')); });
await until(() => window.__app.state === 'play' && window.__app.mode && window.__app.mode.isBench, 25000); await sleep(500);
R.sealed = await page.evaluate(() => { const m = window.__app.mode, s = m.sealed; return s ? { t: s.t, run: !!s.p, stat: document.querySelector('.ws-stat').textContent } : null; });
R.maker = await page.evaluate(() => !!(window.__app.save.data.tricks || {}).Maker);
const code = await page.evaluate(() => { const m = window.__app.mode; return window.__ws.packChamber(m.D, m.sealed); });
R.code = { len: code.length, head: code.slice(0, 22) };
// the line, played as a stranger would play it
R.round = await page.evaluate((code) => { const c = window.__ws.unpackChamber(code); const m = window.__app.mode; return !!c && JSON.stringify(c.design.items) === JSON.stringify(m.D.items) && !!c.run && Math.abs(c.run.t - m.sealed.t) < 0.02; }, code);
await page.evaluate((code) => { localStorage.removeItem('myria.shelf.v1'); const c = window.__ws.unpackChamber(code); window.__app.setMode(new window.__ws.Trial(window.__app, { design: c.design, run: c.run })); }, code);
await until(() => window.__app.state === 'play' && window.__app.mode && window.__app.mode.D && !window.__app.mode.isBench && window.__app.world.roomTime > 0.3);
await sleep(500);
R.guest = await page.evaluate(() => { const a = window.__app, W = a.world; return { rival: W.ents.some(e => e.d.type === 'echo' && e.rival), gifts: window.__ws.shelf.gifts().length, par: a.mode.room.par }; });
// the Pool's door now asks which: knead, make, or play what someone made — and keeps what you were handed
R.panel = await page.evaluate(async () => { window.__ws.poolPanel(window.__app); await new Promise(r => setTimeout(r, 300)); const L = [...document.querySelectorAll('.m-item')].map(b => b.textContent.trim().split(/\s+/)[0]); window.__app.hud.closePanel(); return L.join(','); });
// …and its list: paste a line, the one chamber handed over above, the ones left on the bench, back
Object.assign(R, await page.evaluate(async () => { window.__ws.chambersPanel(window.__app); await new Promise(r => setTimeout(r, 300)); const n = document.querySelectorAll('.m-item').length; window.__app.hud.closePanel(); return { list: n, starters: window.__ws.STARTERS.length }; }));
// junk is refused, not half-built
R.junk = await page.evaluate(() => [window.__ws.unpackChamber('MYRIA-CHAMBER.bm90IGpzb24'), window.__ws.unpackChamber('MYRIA-CHAMBER.' + btoa(JSON.stringify([1, 0, -1, [100, 500], 60, [900, 500], [['zz', 1, 2], ['w', 0, 'x', 5], ['bl', 500, 500]]])).replace(/=+$/, ''))].map(c => c ? c.design.items.length : null));
console.log(JSON.stringify(R));
const ok = R.fresh === 'l' && R.light.kind === 'l' && R.light.n >= 4 && R.light.live >= 4 && R.wall.kind === 'w' && R.wall.pen === 1 && R.wall.rods >= 1 && R.wall.shapes >= 1
  && /bl/.test(R.after) && /D/.test(R.after) && R.door && R.door.shut && !/bl/.test(R.erased) && /bl/.test(R.undone) && !/bl/.test(R.erased2)
  && R.trial.sdfAtWall < 0 && R.trial.rods === 0 && R.trial.lights >= 10 && R.trial.need === Math.ceil(R.trial.lights * 0.6) && R.trial.rec >= 5
  && R.sealed && R.sealed.run && R.maker && /^MYRIA-CHAMBER\./.test(code) && R.round && R.guest.rival && R.guest.gifts === 1 && R.guest.par > 0
  && R.moved[0] > 90 && Math.abs(R.moved[1]) < 30 && R.mirror.added === 'bl,bl,w,w' && R.mirror.sym && R.mirror.saved && R.mirror.on && R.mirror.live === 2 && R.mirror.spins === '1,-1' && R.mirror.toast !== false && R.mirrorOff && R.junk[0] === null && R.junk[1] === 1 && /^Knead,Workshop,Play,Back$/.test(R.panel) && R.list === 1 + 1 + R.starters + 1;
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'WORKSHOP OK' : 'WORKSHOP FAILED'); await browser.close();
