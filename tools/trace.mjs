// Follow the bot through one chamber, decision by decision, until a run stalls or is slow (prints that run's log):  node tools/trace.mjs <room> <w> <h> <tries>
import { World } from '../src/world/world.js';
import { ROOMS } from '../src/world/odyssey.js';
import { Odyssey } from '../src/modes/odyssey.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [room = '14', w = '900', h = '1060', tries = '6'] = process.argv.slice(2);
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' ? false : k === 'muted' ? false : noop), apply: () => 0 });
const world = new World({});
const app = { world, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(+w / +h) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); o.onReveal && o.onReveal(); } };
globalThis.setTimeout = () => 0;
for (let n = 0; n < +tries; n++) {
  const mode = new Odyssey(app, +room, { mass: 0 }); app.mode = mode; mode.enter();
  const W = world; const bot = new Bot(W, { greed: 1 }); const ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false }; const log = []; let ln = 0;
  let f = 0; for (; f < 60 * 80 && !mode.finished; f++) {
    bot.step(1 / 60, ctl); if (ctl.buds) log.push(`  ${(f / 60).toFixed(1)} BUD to ${ctl.buds[0].x | 0},${ctl.buds[0].y | 0} frac ${ctl.buds[0].frac.toFixed(2)} from ${W.player.focus.B.cx | 0},${W.player.focus.B.cy | 0}`);
    W.step(1 / 60, ctl);
    if (bot.notes.length !== ln) { log.push(`  ${(f / 60).toFixed(1)} note ${bot.notes.slice(ln).join(',')}`); ln = bot.notes.length; }
    if (f % 90 === 0) { const F = W.player.focus; log.push(`${(f / 60).toFixed(1)} F ${F.B.count}@${F.B.cx | 0},${F.B.cy | 0} tgt ${bot.target ? bot.target.kind + '@' + (bot.target.x | 0) + ',' + (bot.target.y | 0) : '-'} others [${W.player.orgs.filter(o => o.alive && o !== F).map(o => o.B.count + '@' + (o.B.cx | 0) + ',' + (o.B.cy | 0)).join(' ')}] loose [${W.phys.bodies.filter(b => b.alive && b.group === -1 && b.count > 0).map(b => b.count + '@' + (b.cx | 0) + ',' + (b.cy | 0)).join(' ')}] pads ${W.ents.filter(e => e.d.type === 'pad').map(p => p.count + (p.active ? '+' : '')).join('|')} gates ${W.ents.filter(e => e.d.type === 'gate').map(g => g.k.toFixed(1)).join('|')}`); }
  }
  console.log(`try ${n}: ${mode.finished ? 'done' : 'STALL'} t=${W.roomTime.toFixed(1)}`);
  if (!mode.finished || W.roomTime > 30) { console.log(log.slice(0, 70).join('\n')); const s = W.spec; console.log('ents', s.ents.filter(e => e.type !== 'mote').map(e => `${e.type}${e.id ? ':' + e.id : ''}@${e.x | 0},${e.y | 0}${e.from ? ' from ' + (e.from.x | 0) + ',' + (e.from.y | 0) : ''}`).join(' '), 'W', s.W, 'H', s.H); break; }
}
