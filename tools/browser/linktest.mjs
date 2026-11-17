// Link: two separate browsers on this machine, paired by nothing but two lines of text (no server, no ICE server).
// The host plays Duet; the guest must receive a moving picture of it, and the guest's pointer and taps must steer and dart player two on the host.
import { open, sleep, errs } from './lib.mjs';
const args = ['--disable-features=WebRtcHideLocalIpsWithMdns'];
const H = await open('/index.html?mode=duet', { w: 960, h: 600, args }), G = await open('/index.html', { w: 800, h: 500, args });
const play = async (page) => { for (let k = 0; k < 100; k++) { const s = await page.evaluate(() => window.__app && window.__app.state); if (s === 'play') return; await sleep(250); } };
await sleep(500); await H.page.mouse.click(480, 300); await G.page.mouse.click(400, 250); await play(H.page); await play(G.page); await sleep(500);
console.log('available on both:', await H.page.evaluate(() => window.__app.link.available), await G.page.evaluate(() => window.__app.link.available));
const offer = await H.page.evaluate(() => window.__app.link.offer()); console.log(`host's line: ${offer.slice(0, 40)}… (${offer.length} characters)`);
const answer = await G.page.evaluate((c) => window.__app.link.join(c), offer); console.log(`guest's line: ${String(answer).slice(0, 40)}… (${String(answer).length} characters)`);
const acc = await H.page.evaluate((a) => window.__app.link.accept(a), answer);
let live = false; for (let k = 0; k < 80; k++) { const a = await H.page.evaluate(() => window.__app.link.state), b = await G.page.evaluate(() => window.__app.link.state); if (a === 'live' && b === 'live') { live = true; break; } await sleep(250); }
console.log('answer accepted:', acc, '· both ends live:', live);
// the picture
const vid = async () => G.page.evaluate(() => { const v = window.__app.link.video; return v ? { w: v.videoWidth, h: v.videoHeight, t: +v.currentTime.toFixed(2), paused: v.paused, guestFrozen: !!window.__app.linkGuest } : null; });
let v0 = null; for (let k = 0; k < 40; k++) { v0 = await vid(); if (v0 && v0.w > 0) break; await sleep(250); } await sleep(1500); const v1 = await vid();
console.log('guest sees:', JSON.stringify(v0), '→', JSON.stringify(v1)); await G.page.screenshot({ path: process.argv[2] || '/dev/null' }).catch(() => {});
// the hand: the guest points somewhere; player two on the host goes there
const p2 = () => H.page.evaluate(() => { const a = window.__app, F = a.mode.p2.focus; const [cx, cy] = a.R.worldToCss(F.B.cx, F.B.cy); return { u: +(cx / innerWidth).toFixed(3), v: +(cy / innerHeight).toFixed(3), got: a.link.got, mass: a.mode.p2.mass }; });
await H.page.evaluate(() => { const a = window.__app, F = a.mode.p2.focus; window.__darts = 0; const d0 = F.dart.bind(F); F.dart = (...q) => { window.__darts++; return d0(...q); }; });
const a0 = await p2(); const target = a0.u > 0.5 ? [0.22, 0.3] : [0.78, 0.7];
const gb = await G.page.evaluate(() => { const v = window.__app.link.video, b = v.getBoundingClientRect(), k = Math.min(b.width / v.videoWidth, b.height / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k; return [b.left + (b.width - w) / 2, b.top + (b.height - h) / 2, w, h]; });
await G.page.mouse.move(gb[0] + gb[2] * target[0], gb[1] + gb[3] * target[1], { steps: 8 });
// (give it up to eight seconds: under a full battery the host can run at a third of its frame rate — what matters is that it goes there)
const d0 = Math.hypot(a0.u - target[0], a0.v - target[1]); let a1 = null, d1 = 1; for (const t0 = Date.now(); Date.now() - t0 < 8000;) { await sleep(400); a1 = await p2(); d1 = Math.hypot(a1.u - target[0], a1.v - target[1]); if (Date.now() - t0 > 2600 && d1 < d0 * 0.35) break; }
console.log(`guest points at (${target}) · player two on the host: (${a0.u}, ${a0.v}) → (${a1.u}, ${a1.v}) · distance to the pointer ${d0.toFixed(2)} → ${d1.toFixed(2)} · inputs received ${a1.got}`);
await G.page.mouse.move(gb[0] + gb[2] * 0.5, gb[1] + gb[3] * 0.5, { steps: 4 }); await sleep(300); await G.page.mouse.down(); await sleep(80); await G.page.mouse.up(); await sleep(700);
const darts = await H.page.evaluate(() => window.__darts); console.log('guest taps · darts thrown by player two on the host:', darts);
// captions travel too
await H.page.evaluate(() => window.__app.hud.toast('a caption from the host', '✦')); await sleep(600); const cap = await G.page.evaluate(() => [...document.querySelectorAll('.h-toast')].map(e => e.textContent).join('|'));
console.log('host caption on the guest:', JSON.stringify(cap));
// …and the same through the menus a person would use (clipboard stands in for the messenger)
await G.page.evaluate(() => window.__app.link.close()); let noticed = false; for (let k = 0; k < 80; k++) { if (await H.page.evaluate(() => window.__app.link.state) === 'idle') { noticed = true; break; } await sleep(250); } console.log('guest leaves · host notices:', noticed); await sleep(1200);
const menu = await H.page.evaluate(async () => { const a = window.__app; window.__duet.duetPanel(a); const labels = [...document.querySelectorAll('.panel button')].map(b => b.textContent.trim()); a.hud.closePanel(); return labels; });
console.log('Duet door offers:', JSON.stringify(menu));
await H.page.evaluate(() => { window.__duet.linkHost(window.__app); }); let line = ''; for (let k = 0; k < 40 && !line; k++) { line = await H.page.evaluate(() => { const t = document.querySelector('.panel textarea'); return t ? t.value : ''; }); await sleep(250); }
await G.page.evaluate((l) => { window.prompt = () => l; window.__duet.linkJoin(window.__app); }, line); let back = ''; for (let k = 0; k < 40 && !back; k++) { back = await G.page.evaluate(() => { const t = document.querySelector('.panel textarea'); return t ? t.value : ''; }); await sleep(250); }
await H.page.evaluate((l) => { window.prompt = () => l; const b = [...document.querySelectorAll('.panel button')].find(q => /Paste their answer/.test(q.textContent)); b.click(); }, back);
let live2 = false; for (let k = 0; k < 80; k++) { const x = await H.page.evaluate(() => window.__app.link.state), y = await G.page.evaluate(() => window.__app.link.state); if (x === 'live' && y === 'live') { live2 = true; break; } await sleep(250); }
const after = await H.page.evaluate(() => [...document.querySelectorAll('.panel button')].map(b => b.textContent.trim()));
console.log('paired again through the menus:', live2, '· host is offered:', JSON.stringify(after));
await G.page.evaluate(() => window.__app.link.close()); let gone = false; for (let k = 0; k < 60; k++) { if (await H.page.evaluate(() => window.__app.link.state) === 'idle') { gone = true; break; } await sleep(250); }
console.log('guest leaves · host notices:', gone);
const ok = live && acc && v0 && v0.w > 0 && v1.t > v0.t + 0.5 && v1.guestFrozen && d1 < d0 * 0.5 && a1.got > 20 && darts >= 1 && /a caption from the host/.test(cap) && gone && noticed && menu.some(t => /Link · host/.test(t)) && menu.some(t => /Link · join/.test(t)) && live2 && after.some(t => /Unlink/.test(t));
const e = errs(H.logs) + errs(G.logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'LINK OK' : 'LINK FAILED'); await H.browser.close(); await G.browser.close();
