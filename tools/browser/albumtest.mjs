// The album, end to end in a real page: a trick found for the first time keeps a picture (once — finding it again keeps nothing),
// a warden passed keeps one, the pictures are real JPEGs of the glass, and the Atrium's pause menu shows them as an album.
// node albumtest.mjs [screenshot.png]
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/index.html?room=26', { w: 1100, h: 700 });
const play = async () => { for (let k = 0; k < 80; k++) { const s = await page.evaluate(() => window.__app && window.__app.state); if (s === 'play') return; await sleep(250); } };
await sleep(500); await page.mouse.click(550, 350); await play();
// the creature sleeps through the test: only the moments the test makes may be kept (left awake, it once caught three fireflies in one flash — a real In Time — inside the test's own window)
await page.evaluate(() => { for (const O of window.__app.world.player.orgs) O.dormant = true; }); await sleep(1500);
const count = () => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('myria.album.v1')) || []).length; } catch (_) { return -1; } });
const R = { start: await count() };
// a trick found for the first time …
await page.evaluate(() => window.__app.mode.trick('Net')); await sleep(900); R.trick = await count();
// … and found again (in another chamber, another day): nothing new
await page.evaluate(() => { const m = window.__app.mode; m.tricks = []; m.trick('Net'); }); await sleep(900); R.again = await count();
// a warden passed (The Iris is one): the pore taken for real
await page.evaluate(() => { const a = window.__app, W = a.world, m = a.mode; W.stats.motes = 15;      /* (enough to open the pore, not all the light: no Immaculate to keep as well) */ const pore = W.ents.find(e => e.d.type === 'pore'); m.complete(pore); }); await sleep(900); R.warden = await count();
const shot = await page.evaluate(() => { const L = JSON.parse(localStorage.getItem('myria.album.v1')) || []; return L.map(e => ({ caption: e.caption, sub: e.sub, jpeg: /^data:image\/jpeg;base64,/.test(e.src), kb: Math.round(e.src.length / 1024) })); });
console.log('kept:', JSON.stringify(shot));
// the Atrium shows them
await page.evaluate(() => window.__app.toHub({ awake: true })); await sleep(800); await play(); await sleep(800);
const menu = await page.evaluate(async () => { const a = window.__app; a.pause(); await new Promise(r => setTimeout(r, 300)); const b = [...document.querySelectorAll('.m-item')].find(q => /^Album/.test(q.textContent)); if (!b) return { item: null }; b.click(); await new Promise(r => setTimeout(r, 400));
  const figs = [...document.querySelectorAll('.al')]; const imgs = figs.map(f => f.querySelector('img')).filter(i => i && i.complete && i.naturalWidth > 0).length; if (figs[0]) figs[0].click(); await new Promise(r => setTimeout(r, 300));
  return { item: b.textContent, figs: figs.length, imgs, big: document.querySelectorAll('.al.big').length, first: figs[0] ? figs[0].querySelector('b').textContent : '' }; });
console.log('Atrium:', JSON.stringify(menu));
if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
const ok = R.start === 0 && R.trick === 1 && R.again === 1 && R.warden === 2 && shot.every(e => e.jpeg && e.kb > 2 && e.kb < 80) && menu.item === 'Album · 2' && menu.figs === 2 && menu.imgs === 2 && menu.big === 1 && /^The Iris$/i.test(menu.first);
console.log(JSON.stringify(R));
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'ALBUM OK' : 'ALBUM FAILED'); await browser.close();
