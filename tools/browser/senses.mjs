// What cannot be heard or felt from here, measured instead.
//   SOUND   every voice the game has is rendered through an analyser on the master bus: is it audible, does it clip, how long does it ring, where does
//           its energy sit (spectral centroid)? Voices that mean different things must not sound the same; the tension hum must rise as tension rises.
//   TOUCH   navigator.vibrate is replaced by a recorder: which pattern does each event send, are they different from one another, and do the
//           micro-tremors come faster as a strand nears its snap?
// node senses.mjs
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/package.json', { w: 800, h: 600 });      // (any page: the recorder below must be installed before the game's own scripts run)
await page.evaluateOnNewDocument(() => { window.__vib = []; try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: function (p) { window.__vib.push([performance.now(), Array.isArray(p) ? p.slice() : [p]]); return true; } }); } catch (e) { window.__vibErr = String(e); } });
await page.goto('http://myria.test/index.html?room=0', { waitUntil: 'load' }); await sleep(600); await page.mouse.click(400, 300);
for (let k = 0; k < 80; k++) { const s = await page.evaluate(() => window.__app && window.__app.state); if (s === 'play') break; await sleep(250); } await sleep(600);
const A = await page.evaluate(async () => {
  // isolate the voices: freeze the game (its world drives the continuous voices every frame) and take the room's ambience bed out
  const s = window.__app.sound; s.init(); window.__app.paused = true; await new Promise(r => setTimeout(r, 300)); for (const n of s.ambNodes || []) { try { n.g.gain.cancelScheduledValues(0); n.g.gain.value = 0; } catch (_) { /* ignore */ } } s.setGlide(0, 0); s.setTension(0); s.setDanger(0); await new Promise(r => setTimeout(r, 900));
  const an = s.ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; s.master.connect(an); const tb = new Float32Array(an.fftSize), fb = new Float32Array(an.frequencyBinCount); const hz = s.ctx.sampleRate / an.fftSize;
  const listen = async (ms) => { let peak = 0, nan = false, on = 0, cs = 0, cw = 0, e2 = 0, n = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(tb); let fp = 0; for (let i = 0; i < tb.length; i++) { const v = Math.abs(tb[i]); if (v !== v) nan = true; if (v > fp) fp = v; e2 += v * v; n++; } if (fp > peak) peak = fp; if (fp > 0.004) { on += 16; an.getFloatFrequencyData(fb); for (let i = 1; i < fb.length; i++) { const p = Math.pow(10, fb[i] / 10); cs += p * i * hz; cw += p; } } await new Promise(r => setTimeout(r, 16)); } return { peak: nan ? NaN : +peak.toFixed(3), rms: +Math.sqrt(e2 / Math.max(1, n)).toFixed(4), ms: on, hz: cw ? Math.round(cs / cw) : 0 }; };
  const V = { mote: () => s.mote(0), prism: () => s.prism(), squish: () => s.squish(0.7), splat: () => s.splat(0.8), pop: () => s.pop(1), snap: () => s.snap(0.5), fuse: () => s.fuse(0.6), bud: () => s.bud(), dart: () => s.dart(1), grind: () => s.grind(), fizz: () => s.fizz(), tick: () => s.tick(), clack: () => s.clack(0.8), ripe: () => s.ripe(), fuseTick: () => s.fuseTick(0.5), detonate: () => s.detonate(), cut: () => s.cut(), bounce: () => s.bounce(0.8), bloom: () => s.bloom(), open: () => s.open(), portal: () => s.portal(), plate: () => s.plate(true), heal: () => s.heal(), hurt: () => s.hurt(0.8), morph: () => s.morph(), ui: () => s.ui(), trick: () => s.trick(), swallow: () => s.swallow(), boom: () => s.boom(), tickle: () => s.tickle(), star: () => s.star(1), whoosh: () => s.whoosh(), gulp: () => s.gulp(), haunt: () => s.haunt() };
  const out = { rate: s.ctx.sampleRate, state: s.ctx.state, voices: {}, missing: [] }; out.silence = (await listen(300)).peak;
  for (const [k, f] of Object.entries(V)) { if (typeof s[k] !== 'function') { out.missing.push(k); continue; } f(); out.voices[k] = await listen(k === 'portal' || k === 'bloom' || k === 'haunt' || k === 'detonate' || k === 'prism' ? 1300 : 520); await new Promise(r => setTimeout(r, 420)); }
  // the hum of a strand under tension: does it climb as the strand nears its snap?
  out.tension = []; for (const x of [0.3, 0.6, 0.95]) { s.setTension(x); await new Promise(r => setTimeout(r, 450)); const q = await listen(350); out.tension.push({ x, hz: q.hz, rms: q.rms }); } s.setTension(0);
  out.glide = []; for (const v of [80, 300, 600]) { s.setGlide(v, 0.8); await new Promise(r => setTimeout(r, 400)); const q = await listen(300); out.glide.push({ v, hz: q.hz, rms: q.rms }); } s.setGlide(0, 0);
  window.__app.paused = false; return out;
});
const names = Object.keys(A.voices); const bad = names.filter(k => !(A.voices[k].peak > 0.01) || A.voices[k].peak >= 0.99);
console.log(`SOUND · ${names.length} voices at ${A.rate} Hz (context ${A.state}); silence floor ${A.silence}`);
console.log(names.map(k => `${k.padEnd(9)} peak ${String(A.voices[k].peak).padEnd(5)} ${String(A.voices[k].ms).padStart(4)} ms  ~${String(A.voices[k].hz).padStart(5)} Hz`).join('\n'));
// pairs that must be told apart by ear: (centroid ratio ≥ 1.25) or (length ratio ≥ 1.5)
const pairs = [['mote', 'hurt'], ['fuse', 'pop'], ['heal', 'hurt'], ['bud', 'dart'], ['tick', 'clack'], ['detonate', 'pop'], ['ripe', 'fuseTick'], ['haunt', 'bloom'], ['cut', 'bounce'], ['fizz', 'grind']];
const apart = pairs.map(([a, b]) => { const p = A.voices[a], q = A.voices[b]; if (!p || !q) return [a, b, false]; const hr = Math.max(p.hz, q.hz) / Math.max(1, Math.min(p.hz, q.hz)), lr = Math.max(p.ms, q.ms) / Math.max(1, Math.min(p.ms, q.ms)); return [a, b, hr >= 1.25 || lr >= 1.5, hr.toFixed(2), lr.toFixed(2)]; });
console.log('told apart (pitch-centre ratio / length ratio): ' + apart.map(p => `${p[0]}≠${p[1]} ${p[2] ? '✓' : '✗'} ${p[3]}/${p[4]}`).join(' · '));
console.log('tension hum: ' + A.tension.map(t => `tension ${t.x} → ~${t.hz} Hz, level ${t.rms}`).join(' · ')); console.log('glide voice: ' + A.glide.map(t => `${t.v} px/s → ~${t.hz} Hz, level ${t.rms}`).join(' · '));
const tensionUp = A.tension[2].hz > A.tension[0].hz * 1.08 || A.tension[2].rms > A.tension[0].rms * 1.5;
// ── touch ──
const Hp = await page.evaluate(async () => {
  const out = { err: window.__vibErr || '', active: !!(navigator.userActivation && navigator.userActivation.hasBeenActive), ev: {} }; const a = window.__app, h = a.haptics, W = a.world; const take = () => { const v = window.__vib.slice(); window.__vib.length = 0; return v; }; take();
  const each = { tick: () => h.tick(), 'thump soft': () => h.thump(0.1), 'thump hard': () => h.thump(1), snap: () => h.snap(), fuse: () => h.fuse(), dart: () => h.dart(), hurt: () => h.hurt() };
  for (const [k, f] of Object.entries(each)) { await new Promise(r => setTimeout(r, 260)); take(); f(); const v = take(); out.ev[k] = v.length ? v[0][1] : null; }
  out.tension = []; for (const x of [0.2, 0.5, 0.95]) { await new Promise(r => setTimeout(r, 200)); take(); const t0 = performance.now(); let last = t0; while (performance.now() - t0 < 1000) { const now = performance.now(); h.tension(x, (now - last) / 1000); last = now; await new Promise(r => setTimeout(r, 8)); } const v = take(); out.tension.push({ x, pulses: v.length, ms: v.length ? v[0][1][0] : 0 }); }
  // …and in real play: eat a light, dart
  await new Promise(r => setTimeout(r, 300)); take(); const F = W.player.focus; const m = W.pickups.find(p => !p.dead); if (m) m.absorb(F, null); await new Promise(r => setTimeout(r, 120)); out.play_mote = take().map(v => v[1]); F.dart(1, 0, 1); await new Promise(r => setTimeout(r, 120)); out.play_dart = take().map(v => v[1]);
  return out;
});
console.log(`TOUCH · vibration recorder ${Hp.err ? 'FAILED: ' + Hp.err : 'installed'}; page has a user gesture: ${Hp.active}`);
console.log(Object.entries(Hp.ev).map(([k, v]) => `${k}: ${v ? '[' + v.join(',') + '] ms' : '—'}`).join(' · '));
console.log('tension tremors per second: ' + Hp.tension.map(t => `tension ${t.x} → ${t.pulses} pulses of ${t.ms} ms`).join(' · '));
console.log(`in play: a light eaten → ${JSON.stringify(Hp.play_mote)} · a dart → ${JSON.stringify(Hp.play_dart)}`);
const pats = Object.values(Hp.ev).map(v => v ? v.join(',') : ''); const distinct = new Set(pats).size === pats.length && pats.every(Boolean);
const tremor = Hp.tension[0].pulses === 0 && Hp.tension[2].pulses > Hp.tension[1].pulses && Hp.tension[1].pulses > 0;
const ok = !bad.length && !A.missing.length && A.silence < 0.01 && apart.every(p => p[2]) && tensionUp && distinct && tremor && Hp.play_mote.length > 0 && Hp.play_dart.length > 0;
if (bad.length) console.log('inaudible or clipping: ' + bad.join(', ')); if (A.missing.length) console.log('missing voices: ' + A.missing.join(', '));
const e = errs(logs); console.log(e || 'no console errors'); console.log(ok && !e ? 'SENSES OK' : 'SENSES FAILED'); await browser.close();
