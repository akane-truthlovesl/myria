// A Duet match against the machine: every one of the four games is played in turn (the score is held at nil–nil
// between them so the match runs through the whole deck), the machine is seen to play each one (it moves, and goes
// for what that game is about), every round ends on its own clock, a card comes between rounds, and the match ends
// in a panel. node duetmatch.mjs [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const { browser, page, logs } = await open(`/index.html?mode=duet&ai&round=crown&maxpx=700000`, { w, h });
const until = async (fn, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(150); } return false; };
await sleep(600); await page.mouse.click(w / 2, h / 2);
const seen = {}, cards = [], why = []; let ok = true;
for (let r = 1; r <= 5; r++) {
  await until(() => window.__app.state === 'play' && !!window.__app.mode.p2 && !!window.__app.mode.p2.focus && !window.__app.mode.over, 40000);
  // (in Spark the machine is handed the spark: with it, it should hunt Ember down — without it and nobody near, keeping still in open water is right)
  await page.evaluate(() => { const m = window.__app.mode; if (m.game.id === 'spark') { m.st.holder = 2; m.st.immune = 0.3; } });
  const a = await page.evaluate(() => { const m = window.__app.mode, F = m.p2.focus, s = m.st; const far = s.far ? Math.hypot(F.B.cx - s.far.x, F.B.cy - s.far.y) : 0; return { round: m.round, game: m.game.id, p: [F.B.cx, F.B.cy], far, mass: m.p2.mass, d1: Math.hypot(F.B.cx - window.__app.world.player.focus.B.cx, F.B.cy - window.__app.world.player.focus.B.cy) }; });
  await sleep(3500);
  const b = await page.evaluate(() => { const m = window.__app.mode, F = m.p2.focus, s = m.st; const far = s.far ? Math.hypot(F.B.cx - s.far.x, F.B.cy - s.far.y) : 0; return { p: [F.B.cx, F.B.cy], far, mass: m.p2.mass, fill: s.fill ? s.fill[1] : 0, holder: s.holder || 0, touched: s.touched ? s.touched[1] : false, over: m.over, d1: Math.hypot(F.B.cx - window.__app.world.player.focus.B.cx, F.B.cy - window.__app.world.player.focus.B.cy) }; });
  const moved = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]);
  // what the machine went for, by game
  const purpose = a.game === 'crown' ? b.fill > 0.3 : a.game === 'race' ? (b.touched || b.far < a.far - 150 || b.over) : a.game === 'rain' ? b.mass > a.mass || moved > 80 : a.game === 'spark' ? b.holder === 1 || b.d1 < a.d1 - 60 : false;
  seen[a.game] = { moved: Math.round(moved), purpose, ...(a.game === 'crown' ? { fill: +b.fill.toFixed(1) } : a.game === 'race' ? { far: [Math.round(a.far), Math.round(b.far)], touched: b.touched } : a.game === 'rain' ? { mass: [a.mass, b.mass] } : { holder: b.holder }) };
  if (a.round !== r) why.push(`round ${a.round} seen as ${r}`); if (!(moved > 30)) why.push(`${a.game}: machine still`); if (!purpose) why.push(`${a.game}: no purpose`);
  ok = ok && a.round === r && moved > 30 && purpose;
  // the clock runs out (if the machine has not already won it); hold the match level until every game has been played
  await page.evaluate(() => { const m = window.__app.mode; if (!m.over) m.t = 0.05; });
  await until(() => window.__app.mode.over, 8000);
  if (r < 4) await page.evaluate(() => { window.__app.mode.score = [0, 0]; });
  if (r < 5) { const c = await until(() => !!document.querySelector('.h-result.on .d-win'), 9000); if (c) cards.push(await page.evaluate(() => document.querySelector('.h-result .d-win').textContent)); else if (r < 4) { ok = false; why.push(`no card after round ${r}`); } }
  if (await page.evaluate(() => !!document.querySelector('.h-veil.on'))) break;
}
const panel = await until(() => !!document.querySelector('.h-veil.on'), 12000) && await page.evaluate(() => document.querySelector('.h-veil h2').textContent);
if (Object.keys(seen).length !== 4) why.push(`games seen: ${Object.keys(seen).join(',')}`); if (!/takes the match|perfect tie/.test(panel || '')) why.push(`panel: ${panel}`);
console.log(JSON.stringify({ why, seen, cards, panel }));
ok = ok && Object.keys(seen).length === 4 && cards.length >= 3 && /takes the match|perfect tie/.test(panel || '');
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'DUET MATCH OK' : 'DUET MATCH FAILED'); await browser.close();
