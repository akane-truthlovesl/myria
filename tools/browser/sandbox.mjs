// The Kneading Pool as a sandbox, exercised with emulated fingers: two-finger stretch, bubbles (blow · swallow · breathe out),
// a "down" for the pool, a poured fluid and a dropped contraption.   node sandbox.mjs [shot.png]
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/index.html?mode=pool', { w: 900, h: 700, touch: true });
await sleep(600); const t0 = await page.touchscreen.touchStart(450, 150); await t0.end();
for (let k = 0; k < 60; k++) { const s = await page.evaluate(() => window.__app && window.__app.state); if (s === 'play') break; await sleep(250); } await sleep(1200);
const st = () => page.evaluate(() => { const a = window.__app, W = a.world, P = W.phys, F = W.player.focus, B = F.B; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < P.hi; i++) if (P.alive[i] && P.bodies[P.body[i]].group === 0) { x0 = Math.min(x0, P.x[i]); x1 = Math.max(x1, P.x[i]); y0 = Math.min(y0, P.y[i]); y1 = Math.max(y1, P.y[i]); }
  const [cx, cy] = a.R.worldToCss(B.cx, B.cy); return { css: [Math.round(cx), Math.round(cy)], w: Math.round(x1 - x0), h: Math.round(y1 - y0), r: Math.round(B.r), bodies: W.player.orgs.filter(o => o.alive).length, mass: W.player.mass, air: +(F.air || 0).toFixed(2), puff: +F.puff.toFixed(2), bubbles: W.ents.filter(e => e.d.type === 'bubble' && !e.dead).length, gy: Math.round(P.gy), y: Math.round(B.cy), H: W.spec.H, ents: W.ents.filter(e => !e.dead).map(e => e.d.type).filter(t => t !== 'bubble' && t !== 'mote').join(','), loose: P.bodies.filter(b => b && b.count > 0 && b.group < -1).length, kneads: +(a.mode.kneads || 0).toFixed(2) }; });
const tool = (id) => page.evaluate((id) => { const b = document.querySelector(`.h-tray button[data-id="${id}"]`); b.scrollIntoView({ inline: 'center', block: 'nearest' }); b.click(); return !!b; }, id);
const out = []; const say = (l, s) => { out.push(l); console.log(l, JSON.stringify(s)); };
await tool('hand'); await sleep(300); let s = await st(); say('rest', s); const rest = s; const [cx, cy] = s.css;
// 1. two fingers take hold of it and pull apart
const a = await page.touchscreen.touchStart(cx - 18, cy), b = await page.touchscreen.touchStart(cx + 18, cy); await sleep(200);
let strand = null; for (let k = 1; k <= 66; k++) { const q = k <= 36 ? k * 2.5 : 90 + (k - 36) * 6; await a.move(cx - 18 - q, cy); await b.move(cx + 18 + q, cy); await sleep(30); if (k === 24) {      // slowly first (a strand), then briskly (it parts)
 strand = await st(); say('…a strand between two fingers', strand); if (process.argv[2]) await page.screenshot({ path: process.argv[2].replace('.png', '_strand.png') }); } } await sleep(250);
s = await st(); say('two fingers pulled far apart', s); const stretched = s; if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
await a.end(); await b.end(); await sleep(6500); s = await st(); say('let go (it gathers itself)', s); const gathered = s;
// 2. bubbles: blow some beside it, then lead it into them
await tool('bubble'); const p1 = await page.touchscreen.touchStart(s.css[0] + 90, s.css[1]); await p1.end(); await sleep(300); s = await st(); say('bubbles blown', s); const blown = s;
await tool('hand'); await page.evaluate(() => { const a = window.__app, W = a.world, F = W.player.focus; for (const e of W.ents) if (e.d.type === 'bubble') { e.x = F.B.cx + 10; e.y = F.B.cy; e.safe = 0; } }); await sleep(900);
s = await st(); say('swallowed', s); const full = s; if (process.argv[2]) await page.screenshot({ path: process.argv[2].replace('.png', '_air.png') });
await page.keyboard.press('Space'); await sleep(500); s = await st(); say('a dart breathes it out', s); const out2 = s;
// 3. a down for the pool
await tool('weight'); await sleep(2600); s = await st(); say('weight on', s); const fell = s; await tool('weight'); await sleep(600);
// 4. pour a fluid, drop a contraption
await tool('oil'); const p2 = await page.touchscreen.touchStart(200, 250); await p2.end(); await sleep(300); await tool('grinder'); const p3 = await page.touchscreen.touchStart(700, 250); await p3.end(); await sleep(500);
s = await st(); say('poured and dropped', s);
const ok = strand.w > rest.w * 2.5 && strand.bodies === 1 && strand.h < rest.h && stretched.w > rest.w * 4 && stretched.bodies >= 2 && stretched.kneads > 0.5 && gathered.w < stretched.w * 0.4 && blown.bubbles >= 1 && full.air > 0.3 && full.puff > 0.3 && out2.air === 0 && out2.bubbles >= 1 && fell.gy > 400 && fell.y > rest.y + 60 && s.loose >= 1 && /grinder/.test(s.ents);
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'SANDBOX OK' : 'SANDBOX FAILED'); await browser.close();
