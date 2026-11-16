// CPU-profile the real page while the pointer wanders: node prof.mjs <urlPath> <w> <h> [secs]
import { open, sleep, errs } from './lib.mjs';
const [url, w = '1905', h = '2260', secs = '6'] = process.argv.slice(2);
const { browser, page, logs } = await open(url, { w: +w, h: +h });
await sleep(3000);
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
const pts = [[0.47, 0.4], [0.3, 0.31], [0.6, 0.33], [0.4, 0.36], [0.55, 0.3], [0.35, 0.28]];
const t0 = Date.now(); let k = 0;
while (Date.now() - t0 < +secs * 1000) { const p = pts[k++ % pts.length]; await page.mouse.move(p[0] * +w, p[1] * +h, { steps: 5 }); await sleep(900); }
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const dt = profile.timeDeltas; const idIdx = new Map(profile.nodes.map((n, i) => [n.id, i])); const time = new Float64Array(profile.nodes.length);
profile.samples.forEach((id, i) => { time[idIdx.get(id)] += dt[i] / 1000; });
let total = 0; const deopt = new Map();
profile.nodes.forEach((n, i) => { const f = n.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + time[i]); total += time[i]; if (n.deoptReason) deopt.set(key, n.deoptReason); });
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
console.log('total ms', total.toFixed(0)); for (const [k2, v] of top) console.log(v.toFixed(0).padStart(6), (v / total * 100).toFixed(1).padStart(5) + '%', k2, deopt.get(k2) ? ' DEOPT: ' + deopt.get(k2) : '');
for (const [k2, v] of deopt) if (!top.some(t => t[0] === k2)) console.log('deopt', k2, v);
const lines = new Map();
profile.nodes.forEach((n) => { const f = n.callFrame; const fn = f.url.split('/').pop(); if (!/renderer|fluid|fb\.js/.test(fn)) return; for (const pt of n.positionTicks || []) { const key = fn + ':' + pt.line; lines.set(key, (lines.get(key) || 0) + pt.ticks); } });
console.log('hot lines:', [...lines.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k2, v]) => `${k2}=${v}`).join('  '));
const st = await page.evaluate(() => { const a = window.__app; return { fb: [a.R.fb.w, a.R.fb.h], sim: +a.perf.sim.toFixed(2), ren: +a.perf.ren.toFixed(2), skip: a.skip }; });
console.log(JSON.stringify(st)); const e = errs(logs); if (e) console.log(e);
await browser.close();
