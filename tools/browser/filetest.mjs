// Open the built single file straight from disk (file://) — exactly what double-clicking it does.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 800 });
const logs = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); }); page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await page.goto('file:///home/xrdpuser/Desktop/game_3/index.html' + (process.argv[2] || ''), { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 3500));
await page.mouse.move(600, 300, { steps: 5 }); await new Promise(r => setTimeout(r, 2500));
console.log(JSON.stringify(await page.evaluate(() => { const a = window.__app; return { state: a.state, mode: a.mode.constructor.name, mass: a.world.player.mass, motes: a.world.stats.motes, fb: [a.R.fb.w, a.R.fb.h], ren: +a.perf.ren.toFixed(1) }; })));
await page.screenshot({ path: process.argv[3] || '/tmp/claude-1000/-home-xrdpuser-Desktop-game-3/66c855e1-e158-4c65-b95d-035846405afe/scratchpad/file.png' });
console.log(logs.slice(0, 8).join('\n')); await browser.close();
