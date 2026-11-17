// Hands-on play, one decision at a time. A session process keeps a real browser open on the game, frozen between turns;
// each turn reads a small command file (where to point, what to press, for how long), lets the game run in real time for
// exactly that long, freezes it again and writes a frame + a few numbers. Whoever is playing looks at the frame and decides.
//   node hands.mjs <dir> "<url path>" [w] [h]          (session; file IPC only — no listener)
//   node hands.mjs <dir> turn <n> '<json acts>'         (one turn: writes cmd_n.json, waits for state_n.json, prints it)
// acts: [{ "to":[x,y], "ms":400, "click":true | "right":true | "hold":600 | "rhold":600 | "mid":600 | "key":"Space" | "keys":["KeyD"], "keyms":300 }]
import { open, sleep, errs } from './lib.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const [dir, a2, a3, a4] = process.argv.slice(2);
if (a2 === 'turn') {
  const n = +a3; writeFileSync(path.join(dir, `cmd_${n}.json`), a4 || '[]'); const f = path.join(dir, `state_${n}.json`);
  const t0 = Date.now(); while (!existsSync(f) && Date.now() - t0 < 60000) await sleep(100);
  console.log(existsSync(f) ? readFileSync(f, 'utf8') : 'timeout'); process.exit(0);
}
mkdirSync(dir, { recursive: true }); const w = +(a3 || 960), h = +(a4 || 540);
const { browser, page, logs } = await open(a2 + (a2.includes('?') ? '&' : '?') + 'maxpx=1200000', { w, h });
await sleep(500); await page.mouse.move(w / 2, h / 2); await page.mouse.click(w / 2, h / 2);
for (let k = 0; k < 100 && await page.evaluate(() => window.__app.state) !== 'play'; k++) await sleep(150);
const freeze = (on) => page.evaluate((on) => { const a = window.__app; a.paused = on; a.last = performance.now(); }, on);
const state = () => page.evaluate(() => { const a = window.__app, W = a.world, F = W.player && W.player.focus, v = a.R.view; const sc = (x, y) => [Math.round((x - v.ox) * v.z * innerWidth / a.R.fb.w), Math.round((y - v.oy) * v.z * innerHeight / a.R.fb.h)];
  return JSON.stringify({ t: +W.roomTime.toFixed(1), state: a.state, room: W.spec && W.spec.name, me: F ? sc(F.B.cx, F.B.cy) : null, mass: W.player ? W.player.mass : 0, bodies: W.player ? W.player.orgs.filter(o => o.alive).length : 0, light: `${W.stats.motes}/${W.stats.motesTotal}`, lost: W.stats.lost, flying: F ? F.flightT > 0 : false, mat: F ? F.B.mat : 0, toast: [...document.querySelectorAll('.h-toast, .toast')].map(e => e.textContent.trim()).filter(Boolean).slice(-3), hint: (document.querySelector('.h-hint') || {}).textContent || '', finished: !!(a.mode && a.mode.finished), dbg: a.mode && a.mode.dbg ? a.mode.dbg() : undefined }); });
await freeze(true); await page.screenshot({ path: path.join(dir, 'shot_0.jpg'), type: 'jpeg', quality: 62 }); writeFileSync(path.join(dir, 'state_0.json'), await state());
let mx = w / 2, my = h / 2;
for (let n = 1; n < 400; n++) {
  const f = path.join(dir, `cmd_${n}.json`); const t0 = Date.now(); while (!existsSync(f) && Date.now() - t0 < 30 * 60000) await sleep(100);
  if (!existsSync(f)) break; let acts; try { acts = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { acts = []; } if (acts === 'quit' || acts.quit) break;
  await freeze(false);
  for (const A of acts) {
    if (A.to) { const [tx, ty] = A.to; const steps = 6; for (let k = 1; k <= steps; k++) { await page.mouse.move(mx + (tx - mx) * k / steps, my + (ty - my) * k / steps); await sleep(18); } mx = tx; my = ty; }      // a hand does not teleport
    if (A.keys) for (const k of A.keys) await page.keyboard.down(k);
    if (A.click) await page.mouse.click(mx, my);
    if (A.right) await page.mouse.click(mx, my, { button: 'right' });
    if (A.hold) { await page.mouse.down(); await sleep(A.hold); await page.mouse.up(); }
    if (A.rhold) { await page.mouse.down({ button: 'right' }); await sleep(A.rhold); await page.mouse.up({ button: 'right' }); }
    if (A.mid) { await page.mouse.down({ button: 'middle' }); await sleep(A.mid); await page.mouse.up({ button: 'middle' }); }
    if (A.key) { await page.keyboard.down(A.key); await sleep(A.keyms || 60); await page.keyboard.up(A.key); }
    if (A.ms) await sleep(A.ms);
    if (A.keys) for (const k of A.keys) await page.keyboard.up(k);
  }
  await page.screenshot({ path: path.join(dir, `shot_${n}.jpg`), type: 'jpeg', quality: 62 }); await freeze(true);
  writeFileSync(path.join(dir, `state_${n}.json`), await state());
}
console.log(errs(logs) || 'no console errors'); await browser.close();
