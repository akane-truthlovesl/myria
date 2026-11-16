// Asynchronous hauntings, end to end in a real page:
//   a dive ends → it leaves a haunting · the next dive finds the stain at that depth · stepping in it raises the revenant ·
//   devouring the revenant lays it to rest (light given back, haunting gone) · a stranger's haunting arrives as one line of text.
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/index.html?mode=abyss', { w: 1100, h: 700 });
const play = async () => { for (let k = 0; k < 80; k++) { const s = await page.evaluate(() => window.__app && window.__app.state); if (s === 'play') return; await sleep(250); } };
await sleep(500); await page.mouse.click(550, 350); await play(); await sleep(800);
// wait for a dive that is not run `id`, revealed and in play
const newDive = async (id) => { for (let k = 0; k < 120; k++) { const ok = await page.evaluate((id) => { const a = window.__app, m = a.mode; return !!m && m.runId && m.runId !== id && a.state === 'play' && a.world.listener === m && a.world.roomTime > 1.2; }, id); if (ok) return true; await sleep(250); } return false; };
const info = () => page.evaluate(() => { const a = window.__app, W = a.world, m = a.mode; const res = W.ents.find(e => e.d.type === 'residue'); const rev = W.colonies.find(C => C.kind === 'revenant');
  return { depth: m.depth, haunts: a.save.get('haunts', []).map(h => ({ id: h.id, depth: h.depth, guest: !!h.guest, n: h.n })), rested: a.save.get('rested', 0), haunting: m.haunting ? { id: m.haunting.id, guest: !!m.haunting.guest } : null, residue: res ? { css: a.R.worldToCss(res.x, res.y).map(Math.round), woke: res.woke, n: res.n } : null, revenant: rev ? rev.orgs.filter(o => o.alive).map(o => o.B.count) : null, mass: W.player.mass, toast: [...document.querySelectorAll('.h-toast')].map(e => e.textContent.trim()).join(' | '), gifts: W.ents.filter(e => e.d.gift && !e.dead).length, mimics: W.ents.filter(e => e.d.type === 'mimic').length }; });
const say = (l, s) => console.log(l, JSON.stringify(s)); const R = {};
// 1 · a dive ends somewhere in depth 1
await page.mouse.move(700, 420); await sleep(1500); await page.evaluate(() => { const m = window.__app.mode; m.marks.push([0.3, 0.3], [0.7, 0.6]); m.end(); }); await sleep(600);
R.left = await info(); say('a dive ended', R.left); const code = await page.evaluate(() => window.__haunt.packHaunt(window.__app.save.get('haunts', [])[0])); console.log('its line of text:', code);
// 2 · the next dive finds it
const again = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /Dive again/.test(q.textContent)), c = [...document.querySelectorAll('button')].find(q => /Copy my haunting/.test(q.textContent)); const a = window.__app; a.hud.closePanel(); a.extraModes.find(m => m.id === 'abyss').start(a, {}); return !!b && !!c; }); console.log('end panel offers "Dive again" and "Copy my haunting":', again); await newDive(R.left.haunts[0].id);
R.found = await info(); say('the next dive, same depth', R.found);
// 3 · step in the stain
if (R.found.residue) { const [x, y] = R.found.residue.css; await page.mouse.move(x, y, { steps: 6 }); for (let k = 0; k < 40; k++) { const s = await info(); if (s.revenant) break; await sleep(250); } }
R.woke = await info(); say('stepped in the stain', R.woke); await page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});
// 4 · lay it to rest (the test thins the revenant to a morsel first; the meal itself is real)
await page.evaluate(() => { const W = window.__app.world, P = W.phys, C = W.colonies.find(q => q.kind === 'revenant'); const F = W.player.focus; W.feed(F.B, 50, F.B.cx, F.B.cy, [1, 1, 1]); let keep = 8; for (const O of C.orgs) for (let q = 0; q < O.B.len; q++) { const i = P.bodyIdx[O.B.start + q]; if (P.alive[i] && P.body[i] === O.B.id) { if (keep-- > 0) continue; P.kill(i); } } });
for (let k = 0; k < 60; k++) { const s = await page.evaluate(() => { const a = window.__app, W = a.world, C = W.colonies.find(q => q.kind === 'revenant'), O = C && C.orgs.find(o => o.alive); return O ? a.R.worldToCss(O.B.cx, O.B.cy) : null; }); if (!s) break; await page.mouse.move(s[0], s[1]); if (k % 4 === 3) await page.mouse.click(s[0], s[1]); await sleep(200); }
await sleep(400); R.rest = await info(); say('devoured', R.rest);
// 5 · a stranger's haunting, pasted in
const guest = await page.evaluate(() => window.__haunt.packHaunt({ id: 123456789, depth: 1, u: 0.62, v: 0.4, n: 150, hue: 3, dec: [[0.3, 0.7]] }));
await page.evaluate((g) => { window.prompt = () => g; const a = window.__app; a.toHub({ awake: true }); }, guest); await sleep(800); await play(); await sleep(500);
await page.evaluate(() => window.__app.mode.inviteHaunt()); await sleep(500); R.invited = await info(); say('a stranger\'s line pasted in the Atrium', R.invited);
const prevRun = await page.evaluate(() => 0); await page.evaluate(() => { const a = window.__app; a.extraModes.find(m => m.id === 'abyss').start(a, {}); }); await newDive(prevRun);
R.guest = await info(); say('the next dive', R.guest);
const ok = again && R.left.haunts.length === 1 && R.left.haunts[0].depth === 1 && /^MYRIA-HAUNT\.[0-9a-z.]+$/.test(code) && R.found.haunting && !R.found.haunting.guest && R.found.residue && !R.found.residue.woke && /you ended here once/.test(R.found.toast) && R.found.mimics >= 1
  && R.woke.revenant && R.woke.residue.woke && R.rest.revenant === null && R.rest.rested === 1 && R.rest.haunts.length === 0 && /laid to rest/.test(R.rest.toast) && R.rest.gifts + (R.rest.mass - R.woke.mass) > 0
  && R.invited.haunts.some(h => h.guest && h.id === 123456789) && R.guest.haunting && R.guest.haunting.guest && /a stranger ended here/.test(R.guest.toast);
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'HAUNT OK' : 'HAUNT FAILED'); await browser.close();
