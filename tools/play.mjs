// Headless playtest: node tools/play.mjs <out-prefix> [w] [h] [seconds] [shots e.g. 1,3,6] [zoom x,y,w,h,s]
import { fakeCanvas, writePNG, writeZoom, cpuMs } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { testRoom } from '../src/world/rooms.js';
const [out, w = '1280', h = '720', secs = '8', shots = '2,5,8', zoom = '', mode = 'forage'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(+w, +h)); R.resize(true);
const W = new World({});
W.load(testRoom(R.fb.w / R.fb.h));
R.setRoom(W.roomView(), true);
const shotAt = shots.split(',').map(s => Math.round(+s * 60));
let sim = 0, ren = 0, n = 0;
for (let f = 1; f <= +secs * 60; f++) {
  // bot: swim to the nearest free mote, then to the pore
  const F = W.player.focus; const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
  if (F && F.alive && mode === 'forage') {
    let best = null, bd = 1e9; for (const p of W.pickups) { if (p.dead || p.held) continue; const d = Math.hypot(p.x - F.B.cx, p.y - F.B.cy); if (d < bd) { bd = d; best = p; } }
    const pore = W.ents.find(e => e.d.type === 'pore'); if (!best && pore) { best = pore; bd = Math.hypot(pore.x - F.B.cx, pore.y - F.B.cy); }
    if (best) { const dx = best.x - F.B.cx, dy = best.y - F.B.cy; const t = Math.min(1, Math.max(0, (bd - F.B.r * 0.5) / 90)); ctl.intent.x = dx / bd * t; ctl.intent.y = dy / bd * t; ctl.aim = { x: best.x, y: best.y }; }
  }
  if (process.env.DBG && f % 30 === 0) console.log(f, "pos", F.B.cx | 0, F.B.cy | 0, "intent", ctl.intent.x.toFixed(2), ctl.intent.y.toFixed(2), "mode", mode, "rays", F.crown.rays.map(r => r.mode).join(""), "pick", W.pickups.length);
  const a = cpuMs(() => W.step(1 / 60, ctl)), b = cpuMs(() => W.render(R));
  if (f > +secs * 40) { sim += a; ren += b; n++; }
  if (shotAt.includes(f)) {
    const name = `${out}_${(f / 60).toFixed(0)}.png`; writePNG(name, R.fb.w, R.fb.h, R.fb.px);
    if (zoom) { const [zw, zh, s] = zoom.split(',').map(Number); const v = R.view; writeZoom(name.replace('.png', '_z.png'), R.fb.w, R.fb.h, R.fb.px, Math.round((F.B.cx - v.ox) * v.z - zw / 2), Math.round((F.B.cy - v.oy) * v.z - zh / 2), zw, zh, s); }
    console.log(`t=${(f / 60).toFixed(1)} mass=${W.player.mass} motes=${W.stats.motes}/${W.stats.motesTotal} orgs=${W.player.orgs.length} pos=${F.B.cx | 0},${F.B.cy | 0} dirty=${R.stats.dirty}`);
  }
}
const fs = R.lastFluid;
console.log(JSON.stringify({ fb: [R.fb.w, R.fb.h], z: +R.view.z.toFixed(2), simCpu: +(sim / n).toFixed(2), renderCpu: +(ren / n).toFixed(2), under: +R.stats.underMs.toFixed(2), fluid: +R.stats.fluidMs.toFixed(2), rest: +R.stats.presentMs.toFixed(2), fluidPx: fs.px, platePx: fs.plate, nodes: fs.nodes, done: W.done }));
