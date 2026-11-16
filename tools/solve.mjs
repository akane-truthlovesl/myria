// Play the real Odyssey mode headlessly with the Bot, chamber after chamber, and report what a run looks like:
//   node tools/solve.mjs [first] [last] [w] [h] [greed 0|1|2] [out-prefix for a mid-run PNG of each chamber]
import { fakeCanvas, writePNG } from './node-env.mjs';
import { Renderer } from '../src/render/renderer.js';
import { World } from '../src/world/world.js';
import { ROOMS } from '../src/world/odyssey.js';
import { Odyssey, SPRINTS } from '../src/modes/odyssey.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [first = '0', last = String(ROOMS.length - 1), w = '1280', h = '720', greed = '1', out = ''] = process.argv.slice(2);
const R = out ? new Renderer(fakeCanvas(+w, +h)) : null; if (R) { R.maxPixels = 4e6; R.resize(true); }
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' ? false : k === 'muted' ? false : noop), apply: () => 0 });
const world = new World({});
const app = { world, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(+w / +h) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); o.onReveal && o.onReveal(); } };
let mass = 0; const realTimeout = globalThis.setTimeout; globalThis.setTimeout = () => 0;      // the mode's own timers are driven by this loop instead
let tot = { t: 0, stars: 0, fails: 0 };
for (let i = +first; i <= Math.min(ROOMS.length - 1, +last); i++) {
  // SPRINT=<mutation id> plays every chamber as the Daily Sprint would: on its own, in mutated water
  const sprintM = process.env.SPRINT ? SPRINTS.find(q => q.id === process.env.SPRINT) : null;
  const mode = new Odyssey(app, i, sprintM ? { single: true, sprint: { day: 'test', i, m: sprintM } } : { mass }); app.mode = mode; mode.enter();
  const W = world; const bot = new Bot(W, { greed: +greed }); const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false };
  const limit = Math.max(90, ROOMS[i].par * 3) * 60; let f = 0, rekindled = 0, minMass = 1e9;
  for (; f < limit && !mode.finished; f++) {
    bot.step(1 / 60, ctl); W.step(1 / 60, ctl);
    if (W.player.mass < minMass) minMass = W.player.mass;
    if (R && f === Math.min(limit - 1, 60 * 7)) { R.setRoom(W.roomView(), true); W.render(R); W.render(R); writePNG(`${out}_${i}.png`, R.fb.w, R.fb.h, R.fb.px); }
  }
  const s = W.stats; const st = mode.stars(W); const F = W.player.focus;
  console.log(`${String(i).padStart(2)} ${ROOMS[i].name.padEnd(14)} ${mode.finished ? 'DONE' : 'FAIL'} t=${W.roomTime.toFixed(1).padStart(5)}/${String(ROOMS[i].par).padEnd(3)} light=${s.motes}/${s.motesTotal} lost=${String(s.lost).padStart(3)} mass=${mode.startMass}→${W.player.mass} (min ${minMass}) stars=${st.map(v => (v ? '◆' : '◇')).join('')} ${mode.tricks.join(',')} [${bot.notes.slice(-6).join(' ')}]${mode.finished ? '' : ' at ' + (F ? (F.B.cx | 0) + ',' + (F.B.cy | 0) : '-') + ' target=' + (bot.target ? bot.target.kind : '-')}`);
  if (!mode.finished) console.log('     colonies: ' + W.colonies.map(C => `${C.kind || 'player'}[${C.orgs.map(o => o.B.count + '@' + (o.B.cx | 0) + ',' + (o.B.cy | 0)).join(' ')}]`).join(' ') + ' pads=' + W.ents.filter(e => e.d.type === 'pad').map(p2 => p2.count + ':' + p2.active).join('|') + ' gates=' + W.ents.filter(e => e.d.type === 'gate').map(g => g.k.toFixed(1) + (g.latched ? 'L' : '')).join('|'));
  if (!mode.finished) { const pore = W.ents.find(e => e.d.type === 'pore'); console.log('     minds: ' + W.colonies.map(C => `${C.kind || 'player'}[${C.orgs.map(o => `${o.B.count}${o.focused ? '*' : ''} mat${o.B.mat}${o.ripe ? ' ripe' : ''}${o.brain ? ' ' + o.brain.kind + ':' + o.brain.state : ''}${o.B.spores ? ' spores' + o.B.spores : ''}${o.boomT > 0 ? ' boom' + o.boomT.toFixed(1) : ''}${o.stealth ? ' veiled' : ''}${o.B.inflate > 0.05 ? ' swollen' : ''}`).join(' | ')}]`).join(' ') + (pore ? ` pore open=${!!pore.open} need=${pore.need}` : '') + ' lights left: ' + (W.pickups.filter(m => m.isMote && !m.dead).map(m => `(${m.x | 0},${m.y | 0} sdf${W.phys.sampleSDF(m.x, m.y) | 0}${m.held ? ' held-by-' + (m.held.alive === false ? 'DEAD' : (m.held.colony && m.held.colony.kind) || 'player') : ''}${m.claim ? ' claimed' : ''}${m.baked ? ' baked' : ''}${m.free ? ' free' : ''}${m.d.gift ? ' gift' : ''})`).join(' ') || 'none')); }
  tot.t += W.roomTime; tot.stars += st.filter(Boolean).length; if (!mode.finished) tot.fails++;
  mass = mode.finished ? W.player.mass : 0;
}
console.log(`total ${tot.t.toFixed(0)}s, ${tot.stars} stars, ${tot.fails} unfinished`);
globalThis.setTimeout = realTimeout;
