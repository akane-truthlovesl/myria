// Render every Odyssey chamber (or a subset) to PNG and run a simple forage bot through it:
//   node tools/rooms.mjs <out-prefix> [w] [h] [first] [last] [seconds]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { ROOMS } from '../src/world/odyssey.js';
const [out, w = '1280', h = '720', first = '0', last = String(ROOMS.length - 1), secs = '0'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(+w, +h)); R.maxPixels = 4e6; R.resize(true);
for (let i = +first; i <= Math.min(ROOMS.length - 1, +last); i++) {
  const room = ROOMS[i]; const spec = room.build(R.fb.w / R.fb.h); spec.name = room.name; spec.seed = i * 97 + 13;
  const W = new World({}); W.load(spec, { mass: Math.max(spec.minMass || 40, spec.spawn.n || 40) });
  const done = { v: false }; W.listener = { complete() { done.v = true; }, poreReady(p) { return W.stats.motes >= p.need && (!p.d.key || W.check(p.d.key)); } };
  for (const e of W.ents) if (e.d.type === 'pore' && !e.need) e.need = Math.ceil(W.stats.motesTotal * 0.6);
  R.setRoom(W.roomView(), true);
  let t = 0; const N = +secs * 60; let stuck = 0, lastM = 0, lastChange = 0;
  for (let f = 0; f < Math.max(30, N); f++) {
    const F = W.player.focus; const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false, darts: null };
    if (N && F && F.alive && !done.v) {
      let best = null, bd = 1e9; for (const p of W.pickups) { if (p.dead || p.held) continue; const d = Math.hypot(p.x - F.B.cx, p.y - F.B.cy); if (d < bd) { bd = d; best = p; } }
      const pore = W.ents.find(e => e.d.type === 'pore'); if ((!best || pore.open > 0.8 && W.stats.motes >= W.stats.motesTotal) && pore) { best = pore; bd = Math.hypot(pore.x - F.B.cx, pore.y - F.B.cy); }
      if (best) { const dx = best.x - F.B.cx, dy = best.y - F.B.cy; const tt = Math.min(1, Math.max(0.15, (bd - F.B.r * 0.4) / 90)); ctl.intent.x = dx / bd * tt; ctl.intent.y = dy / bd * tt; ctl.aim = { x: best.x, y: best.y };
        if (f % 50 === 0 && Math.hypot(F.B.vx, F.B.vy) < 60) ctl.darts = [{ x: dx, y: dy, power: 1.3 }]; }
      if (W.stats.motes !== lastM) { lastM = W.stats.motes; lastChange = f; }
    }
    W.step(1 / 60, ctl); t += 1 / 60;
    if (done.v) break;
  }
  W.render(R); W.render(R);
  writePNG(`${out}_${i}.png`, R.fb.w, R.fb.h, R.fb.px);
  const F = W.player.focus;
  console.log(`${i} ${room.name.padEnd(14)} ${spec.W}x${spec.H} ents=${W.ents.length} motes=${W.stats.motes}/${W.stats.motesTotal} mass=${W.player.mass} orgs=${W.player.orgs.length} lost=${W.stats.lost} t=${t.toFixed(1)} done=${done.v} pos=${F ? (F.B.cx | 0) + ',' + (F.B.cy | 0) : '-'} lastGain=${(lastChange / 60).toFixed(1)}s backdropMs=${R.stats.backdropMs | 0}`);
}
