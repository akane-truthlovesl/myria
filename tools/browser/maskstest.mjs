// Masks, two people on one keyboard: everyone wears the same mask; Ember has the arrows and Enter, Tide W A S D and Space
// (and Tide's held Space coils Tide, never Ember); a dart into a stranger unmasks the darter for three seconds, then the mask
// goes back on; a dart into the other one wins the round; four lights eaten win it too. node maskstest.mjs [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [w = 1280, h = 720] = process.argv.slice(2).map(Number);
const { browser, page, logs } = await open(`/index.html?mode=duet&round=masks&only&maxpx=500000`, { w, h });
const until = async (fn, ms = 30000, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg)) return true; await sleep(120); } return false; };
const why = [], R = {};
await sleep(600); await page.mouse.click(w / 2, h / 2);
await until(() => window.__app.state === 'play' && !!window.__app.mode.p2 && !window.__app.mode.over && !(window.__app.mode.hold > 0), 40000);
const pos = () => page.evaluate(() => { const W = window.__app.world, m = window.__app.mode; return [W.player.focus.B, m.p2.focus.B].map(B => [B.cx, B.cy]); });
// everyone alike, the counts a secret, the keys split
R.alike = await page.evaluate(() => { const W = window.__app.world, m = window.__app.mode; return { cols: W.colonies.length, masks: W.colonies.every(C => C.focus && C.focus.B.tint && C.focus.B.tint.id === 'mask'), sizes: [...new Set(W.colonies.map(C => C.mass))], top: (document.querySelector('.h-top') || {}).textContent || '', split: window.__app.input.keysSplit, toast: (document.querySelector('.h-toasts') || {}).textContent || '' }; });
if (R.alike.cols !== 12 || !R.alike.masks || R.alike.sizes.length !== 1) why.push('not all alike: ' + JSON.stringify(R.alike));
if (!/\?/.test(R.alike.top)) why.push('counts shown: ' + R.alike.top); if (!R.alike.split || !/←/.test(R.alike.toast)) why.push('keys not split');
// the arrows move Ember only; W A S D move Tide only
let p0 = await pos(); await page.keyboard.down('ArrowRight'); await sleep(700); await page.keyboard.up('ArrowRight'); let p1 = await pos();
R.arrows = [Math.round(p1[0][0] - p0[0][0]), Math.round(Math.hypot(p1[1][0] - p0[1][0], p1[1][1] - p0[1][1]))];
p0 = await pos(); await page.keyboard.down('KeyA'); await sleep(700); await page.keyboard.up('KeyA'); p1 = await pos();
R.wasd = [Math.round(p1[1][0] - p0[1][0]), Math.round(Math.hypot(p1[0][0] - p0[0][0], p1[0][1] - p0[0][1]))];
if (!(R.arrows[0] > 30 && R.arrows[1] < 30)) why.push('arrows: ' + R.arrows); if (!(R.wasd[0] < -30 && R.wasd[1] < 30)) why.push('wasd: ' + R.wasd);
// Tide's held Space coils Tide — and not Ember
await page.keyboard.down('Space'); await sleep(650); R.coil = await page.evaluate(() => [window.__app.world.player.focus.coil || 0, window.__app.mode.p2.focus.coil || 0].map(v => +v.toFixed(2))); await page.keyboard.up('Space');
if (!(R.coil[0] === 0 && R.coil[1] > 0.3)) why.push('coil: ' + R.coil);
// Enter darts Ember
await sleep(500); await page.evaluate(() => { window.__d = []; const W = window.__app.world, f = W.onDart.bind(W); W.onDart = (O, ...a) => { window.__d.push(O.colony === W.player ? 'E' : O.colony === window.__app.mode.p2 ? 'T' : 's'); return f(O, ...a); }; });
await page.keyboard.press('Enter'); await sleep(250); R.enter = await page.evaluate(() => window.__d.filter(x => x !== 's').join(''));
if (R.enter !== 'E') why.push('enter dart: ' + R.enter);
// carry a body next to another (every grain moved alike), then dart into it
const carry = (args) => page.evaluate(([who, to]) => {
  const W = window.__app.world, m = window.__app.mode, P = W.phys, me = who ? m.p2.focus : W.player.focus, T = to < 0 ? m.st.crowd[0].C.focus : (to ? m.p2.focus : W.player.focus);
  for (const C of W.colonies) if (C.focus) C.focus.dormant = true;                     // (hold everyone still for the aim)
  const ax = T.B.cx - me.B.cx, ay = T.B.cy - me.B.cy, d = Math.hypot(ax, ay), want = me.B.r + T.B.r + 70, dx = ax - ax / d * want, dy = ay - ay / d * want;
  for (let i = 0; i < P.hi; i++) if (P.alive[i] && P.body[i] === me.B.id) { P.x[i] += dx; P.y[i] += dy; P.ox[i] = P.x[i]; P.oy[i] = P.y[i]; P.vx[i] = 0; P.vy[i] = 0; }
  me.B.cx += dx; me.B.cy += dy; for (const C of W.colonies) if (C.focus) C.focus.dormant = false; me.dartCD = 0; me.dart(ax, ay, 1); return Math.round(d);
}, args);
await sleep(300); R.strangerD = await carry([0, -1]);
const shown = await until(() => window.__app.mode.st.shown[0] > 0, 1500);
R.unmasked = await page.evaluate(() => { const W = window.__app.world; return W.player.focus.B.tint ? W.player.focus.B.tint.id : 'coral'; });
if (!shown || R.unmasked === 'mask') why.push('a stranger darted into did not unmask Ember: ' + R.unmasked);
const back = await until(() => { const W = window.__app.world; return window.__app.mode.st.shown[0] <= 0 && W.player.focus.B.tint && W.player.focus.B.tint.id === 'mask'; }, 6000);
if (!back) why.push('the mask did not go back on');
// a dart into the other one: the round is Ember's
await sleep(200); R.tagD = await carry([0, 1]);
await until(() => window.__app.mode.over, 3000); R.tag = await page.evaluate(() => ({ over: window.__app.mode.over, why: window.__app.mode.st.why, score: window.__app.mode.score, tide: window.__app.mode.p2.focus.B.tint.id, sleep: window.__app.mode.st.crowd.every(q => q.C.focus.dormant) }));
if (!(R.tag.over && R.tag.why === 'tag' && R.tag.score[0] === 1)) why.push('tag: ' + JSON.stringify(R.tag)); if (R.tag.tide === 'mask' || !R.tag.sleep) why.push('masks did not fall: ' + JSON.stringify(R.tag));
const card = await until(() => !!document.querySelector('.h-result.on .d-how'), 9000); R.card = card ? await page.evaluate(() => document.querySelector('.h-result .d-how').textContent) : '';
if (!/found Tide/.test(R.card)) why.push('card: ' + R.card);
// round two: four lights in Tide's mouth
await until(() => window.__app.state === 'play' && !!window.__app.mode.p2 && window.__app.mode.round === 2 && !window.__app.mode.over && !(window.__app.mode.hold > 0), 40000);
for (let k = 0; k < 4; k++) { await page.evaluate(() => { const W = window.__app.world, B = window.__app.mode.p2.focus.B; W.spawn({ type: 'mote', x: B.cx, y: B.cy, free: true, value: 2 }); }); await sleep(350); }
await until(() => window.__app.mode.over, 3000); R.fed = await page.evaluate(() => ({ over: window.__app.mode.over, why: window.__app.mode.st.why, eats: window.__app.mode.st.eats, score: window.__app.mode.score, mass: window.__app.mode.p2.mass }));
if (!(R.fed.why === 'fed' && R.fed.score[1] === 1 && R.fed.mass === 34)) why.push('fed: ' + JSON.stringify(R.fed));
console.log(JSON.stringify({ why, ...R }));
const e = errs(logs); console.log(e || 'no console errors'); console.log(!why.length && !e ? 'MASKS OK' : 'MASKS FAILED'); await browser.close();
