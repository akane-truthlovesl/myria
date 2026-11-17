// Every mode, opened in a real browser and left running for a few seconds with the autopilot (or a wandering pointer),
// plus the Atrium's menus: nothing may throw, time must pass, and each mode must show its own sign of life.
import { open, sleep, errs } from './lib.mjs';
const secs = +(process.argv[2] || 7); let allOk = true; const rows = [];
const life = () => window.__app && (() => { const a = window.__app, W = a.world; return { state: a.state, t: +W.time.toFixed(1), mass: W.player ? W.player.mass : 0, motes: W.stats ? W.stats.motes : 0, ents: W.ents.length, cols: W.colonies.length }; })();
for (const [name, url, sign] of [
  ['Atrium', '/index.html', s => s.mass > 0],
  ['Atrium (awake)', '/index.html?awake', s => s.mass > 0],
  ['Odyssey', '/index.html?room=4&bot', s => s.t > 2],
  ['Abyss', '/index.html?mode=abyss&bot', s => s.t > 2 && s.cols >= 1],
  ['Daily', '/index.html?mode=daily&bot', s => s.t > 2],
  ['Bloom', '/index.html?mode=bloom&bot', s => s.t > 2 && s.motes > 0],
  ['Pool', '/index.html?mode=pool', s => s.mass > 0],
  ['Workshop', '/index.html?mode=workshop', s => s.mass > 0 && s.ents > 3],
  ['Myriad', '/index.html?mode=myriad', s => s.cols >= 2],
  ['Duet', '/index.html?mode=duet', s => s.cols >= 2],
  ['Co-op dive', '/index.html?mode=coop', s => s.cols >= 2],
]) {
  const { browser, page, logs } = await open(url + (url.includes('?') ? '&' : '?') + 'maxpx=900000', { w: 1100, h: 700 });
  await sleep(500); await page.mouse.click(550, 350);
  for (let k = 0; k < 100 && await page.evaluate(() => window.__app.state) !== 'play'; k++) await sleep(150);
  for (let k = 0; k < secs * 2; k++) { await page.mouse.move(250 + 600 * ((k * 0.37) % 1), 200 + 300 * ((k * 0.61) % 1), { steps: 3 }); await sleep(500); }
  const s = await page.evaluate(life); const e = errs(logs); const ok = !!s && s.state === 'play' && sign(s) && !e; allOk = allOk && ok;
  rows.push(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(15)} ${JSON.stringify(s)}${e ? ' · ' + e.slice(0, 200) : ''}`);
  if (name === 'Atrium (awake)') {      // the menus: chambers map, journal, hue, echo paste with nothing to paste
    const menu = await page.evaluate(async () => { const a = window.__app, out = []; const click = (t) => { const b = [...document.querySelectorAll('.m-item')].find(b => b.textContent.trim().startsWith(t)); if (b) b.click(); return !!b; };
      a.pause(); await new Promise(r => setTimeout(r, 300)); out.push('items:' + [...document.querySelectorAll('.m-item')].length);
      out.push('chambers:' + (click('Chambers') && (await new Promise(r => setTimeout(r, 300)), document.querySelectorAll('.ch').length)));
      a.resume(); a.pause(); await new Promise(r => setTimeout(r, 300)); out.push('tricks:' + (click('Tricks') && (await new Promise(r => setTimeout(r, 300)), document.querySelectorAll('.tk').length)));
      a.resume(); a.pause(); await new Promise(r => setTimeout(r, 300)); out.push('hue:' + click('Hue'));
      window.prompt = () => ''; out.push('echo:' + click('Race an echo')); await new Promise(r => setTimeout(r, 400)); a.resume(); return out.join(' '); });
    const e2 = errs(logs); const ok2 = /chambers:28/.test(menu) && /tricks:22/.test(menu) && /hue:true/.test(menu) && /echo:true/.test(menu) && !e2; allOk = allOk && ok2;
    rows.push(`${ok2 ? 'ok  ' : 'FAIL'} ${'Atrium menus'.padEnd(15)} ${menu}${e2 ? ' · ' + e2.slice(0, 200) : ''}`);
  }
  await browser.close();
}
console.log(rows.join('\n')); console.log(allOk ? 'MODES OK' : 'MODES FAILED');
