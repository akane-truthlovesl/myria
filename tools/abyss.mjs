// Headless Abyss soak: node tools/abyss.mjs <out-prefix> [w] [h] [depths] [secondsPerRoom]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { abyssRoom, AXIOMS } from '../src/world/abyss.js';
const [out, w = '1280', h = '720', depths = '6', secs = '40'] = process.argv.slice(2);
const R = new Renderer(fakeCanvas(+w, +h)); R.maxPixels = 4e6; R.resize(true);
let mass = 40;
for (let d = 1; d <= +depths; d++) {
  const spec = abyssRoom(R.fb.w / R.fb.h, d, 12345, AXIOMS[0], Math.min(260, mass));
  const W = new World({}); W.load(spec, { mass: Math.min(260, mass) });
  const st = { done: false, dev: 0 };
  const rivals = () => W.colonies.filter(C => C !== W.player && C.kind !== 'oil' && C.kind !== 'thorn' && C.orgs.some(o => o.alive)).length;
  W.listener = { complete() { st.done = true; }, devour() { st.dev++; }, poreReady(p) { return spec.arena ? rivals() === 0 : W.stats.motes >= p.need || W.pickups.filter(q => q.isMote && !q.dead).length === 0; } };
  for (const e of W.ents) if (e.d.type === 'pore') e.need = spec.arena ? 0 : Math.ceil(W.stats.motesTotal * 0.55);
  R.setRoom(W.roomView(), true);
  let f = 0, deaths = 0, simMs = 0;
  for (; f < +secs * 60 && !st.done; f++) {
    const F = W.player.focus; const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false, darts: null };
    if (!W.player.orgs.some(o => o.alive)) { deaths++; W.player.spawn(spec.spawn.x, spec.spawn.y, 26); continue; }
    if (F && F.alive) {
      let best = null, bd = 1e9; for (const p of W.pickups) { if (p.dead || p.held) continue; const dd = Math.hypot(p.x - F.B.cx, p.y - F.B.cy); if (dd < bd) { bd = dd; best = p; } }
      if (spec.arena || !best) for (const C of W.colonies) for (const O of C.orgs) { if (C === W.player || !O.alive || C.kind === 'oil' || C.kind === 'thorn' || O.B.count > F.B.count * 0.85) continue; const dd = Math.hypot(O.B.cx - F.B.cx, O.B.cy - F.B.cy); if (dd < bd) { bd = dd; best = { x: O.B.cx, y: O.B.cy }; } }
      const pore = W.ents.find(e => e.d.type === 'pore'); if (pore && pore.open > 0.8 && (!best || W.roomTime > 25)) { best = pore; bd = Math.hypot(pore.x - F.B.cx, pore.y - F.B.cy); }
      if (best) { const dx = best.x - F.B.cx, dy = best.y - F.B.cy; ctl.intent.x = dx / (bd + 1); ctl.intent.y = dy / (bd + 1); ctl.aim = { x: best.x, y: best.y }; }
    }
    const t0 = process.cpuUsage(); W.step(1 / 60, ctl); const t1 = process.cpuUsage(t0); simMs += (t1.user + t1.system) / 1000;
    if (f === 420) { W.render(R); W.render(R); writePNG(`${out}_${d}.png`, R.fb.w, R.fb.h, R.fb.px); }
  }
  mass = Math.max(40, W.player.mass);
  console.log(`depth ${d}${spec.arena ? ' ARENA' : ''}: t=${(f / 60).toFixed(1)} done=${st.done} motes=${W.stats.motes}/${W.stats.motesTotal} mass=${W.player.mass} lost=${W.stats.lost} eaten=${W.stats.eaten || 0} devoured=${st.dev} rivalsLeft=${rivals()} deaths=${deaths} parts=${W.phys.count} simCpu=${(simMs / f).toFixed(2)}ms`);
}
