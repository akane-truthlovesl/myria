// A stranger who has been told nothing.  No aim at any light, no knowledge of the rules: the pointer (or a thumb) just wanders the way an idle hand
// does — smooth random drifts, pauses, the odd click — on a brand-new save. For each of several such strangers we measure, from the first frame of play:
//   · how long until their first input visibly moves the creature          (the control is discovered)
//   · how long until the first light is eaten, without having aimed at it  (the reward is discovered)
//   · whether a word of instruction was on screen before that              (it must not be)
//   · how many lights they hold after twenty seconds                       (the first door needs six)
// node stranger.mjs [n strangers] [touch 0|1] [w] [h]
import { open, sleep, errs } from './lib.mjs';
const [n = '6', touch = '0', w = '1100', h = '700'] = process.argv.slice(2); const W = +w, H = +h;
const rnd = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const rows = []; let allErr = '';
for (let k = 0; k < +n; k++) {
  const R = rnd(1234 + k * 7919 + (+touch ? 99 : 0)); const { browser, page, logs } = await open('/index.html', { w: W, h: H, touch: !!+touch });
  const st = () => page.evaluate(() => { const a = window.__app, Wd = a && a.world, F = Wd && Wd.player && Wd.player.focus; return F ? { st: a.state, pos: [F.B.cx, F.B.cy], motes: Wd.stats.motes, words: ((document.querySelector('.h-hint.on') || {}).textContent || '').trim() } : null; });
  for (let q = 0; q < 120; q++) { const s = await st(); if (s && s.st === 'play') break; await sleep(100); }
  const s0 = await st(), T0 = Date.now(); let moved = null, first = null, words = '', firstInput = null, six = null;
  // an idle hand: pick somewhere, drift there over 0.4–1.4 s, sometimes rest, sometimes click
  let x = W * (0.2 + 0.6 * R()), y = H * (0.2 + 0.6 * R()), finger = null; const wait0 = 300 + R() * 900; await sleep(wait0);
  while ((Date.now() - T0) / 1000 < 20) {
    const tx = W * (0.08 + 0.84 * R()), ty = H * (0.1 + 0.8 * R()), dur = 400 + R() * 1000, steps = Math.max(4, Math.round(dur / 50));
    if (+touch && !finger) { finger = await page.touchscreen.touchStart(x, y); if (firstInput === null) firstInput = (Date.now() - T0) / 1000; }
    for (let q = 1; q <= steps; q++) {
      const u = q / steps, e = u * u * (3 - 2 * u), px = x + (tx - x) * e, py = y + (ty - y) * e;
      if (+touch) await finger.move(px, py); else { await page.mouse.move(px, py); if (firstInput === null) firstInput = (Date.now() - T0) / 1000; }
      const s = await st(), t = (Date.now() - T0) / 1000; if (!s) break;
      if (moved === null && Math.hypot(s.pos[0] - s0.pos[0], s.pos[1] - s0.pos[1]) > 12) moved = t;
      if (first === null) { if (s.words) words = s.words; if (s.motes >= 1) first = t; }
      if (six === null && s.motes >= 6) six = t;
      await sleep(40);
    }
    x = tx; y = ty; const r = R();
    if (r < 0.25) await sleep(300 + R() * 500); else if (r < 0.4 && !+touch) await page.mouse.click(x, y); else if (r < 0.4 && finger) { await finger.end(); finger = null; await sleep(200 + R() * 300); }
  }
  const s1 = await st(); if (finger) await finger.end();
  rows.push({ k, firstInput, moved, first, six, motes: s1 ? s1.motes : 0, words }); allErr += errs(logs); await browser.close();
  console.log(`stranger ${k + 1}: first touch of the ${+touch ? 'glass' : 'mouse'} at ${firstInput?.toFixed(2)} s · creature moves ${moved === null ? 'never' : (moved - firstInput).toFixed(2) + ' s later'} · first light ${first === null ? 'never' : (first - firstInput).toFixed(2) + ' s after first touch'} · six lights ${six === null ? '—' : six.toFixed(1) + ' s'} · holds ${s1 ? s1.motes : 0} after 20 s · words shown before first light: ${JSON.stringify(words)}`);
}
const lag = rows.filter(r => r.moved !== null).map(r => r.moved - r.firstInput), rew = rows.filter(r => r.first !== null).map(r => r.first - r.firstInput); const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
console.log(`${rows.length} strangers (${+touch ? 'touch' : 'mouse'}): all moved the creature: ${lag.length === rows.length} (median ${med(lag)?.toFixed(2)} s, worst ${Math.max(...lag).toFixed(2)} s after first input) · found light unaided: ${rew.length}/${rows.length} (median ${med(rew)?.toFixed(2)} s) · no words needed: ${rows.every(r => !r.words)}`);
const ok = lag.length === rows.length && Math.max(...lag) <= 3 && rew.length === rows.length && med(rew) <= 3.5 && rows.every(r => !r.words);
console.log(allErr || 'no console errors'); console.log(ok && !allErr ? 'STRANGER OK' : 'STRANGER FAILED');
