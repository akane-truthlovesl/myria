// Listen to every sound the game can make (through an analyser on the master bus) and report its peak level.
import { open, sleep, errs } from './lib.mjs';
const { browser, page, logs } = await open('/dev.html?room=0&awake', { w: 800, h: 600 });
await sleep(3000);
const r = await page.evaluate(async () => {
  const s = window.__app.sound; s.init(); await new Promise(r => setTimeout(r, 300));
  const out = { state: s.ctx.state, rate: s.ctx.sampleRate, sounds: {}, errors: [] };
  const an = s.ctx.createAnalyser(); an.fftSize = 2048; s.master.connect(an); const buf = new Float32Array(an.fftSize);
  const listen = async (ms) => { let peak = 0, nan = false; const t0 = performance.now(); while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v !== v) nan = true; if (v > peak) peak = v; } await new Promise(r => setTimeout(r, 20)); } return nan ? 'NaN' : +peak.toFixed(3); };
  const list = { mote: () => s.mote(0), prism: () => s.prism(), squish: () => s.squish(0.7), splat: () => s.splat(0.8), pop: () => s.pop(1), snap: () => s.snap(0.5), fuse: () => s.fuse(0.6), bud: () => s.bud(), dart: () => s.dart(1), grind: () => s.grind(), cut: () => s.cut(), bounce: () => s.bounce(0.8), bloom: () => s.bloom(), open: () => s.open(), portal: () => s.portal(), plate: () => s.plate(true), heal: () => s.heal(), hurt: () => s.hurt(0.8), morph: () => s.morph(), ui: () => s.ui(), trick: () => s.trick(), swallow: () => s.swallow(), boom: () => s.boom(), tickle: () => s.tickle(), star: () => s.star(1), whoosh: () => s.whoosh(), gulp: () => s.gulp() };
  out.silence = await listen(250);
  for (const [k, f] of Object.entries(list)) { try { f(); out.sounds[k] = await listen(k === 'portal' || k === 'bloom' ? 700 : 320); } catch (e) { out.errors.push(k + ': ' + e.message); } await new Promise(r => setTimeout(r, 380)); }
  s.setGlide(400, 0.8); s.setTension(0.8); out.glideTension = await listen(500); s.setGlide(0, 0); s.setTension(0);
  s.ambience('deep', 50); await new Promise(r => setTimeout(r, 2500)); out.ambience = await listen(600);
  // a chain of motes should climb a scale
  const notes = []; for (let k = 0; k < 6; k++) notes.push(s.note(k % 10, 1)); out.chainMidi = notes;
  return out;
});
console.log(JSON.stringify(r)); const e = errs(logs); console.log(e || 'no console errors');
await browser.close();
