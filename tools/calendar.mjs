// Can each coming day's Daily dive actually be finished? The real Abyss mode, the real seed and mutations of each date, played by the Bot:
//   node tools/calendar.mjs [first day YYYY-MM-DD] [days] [depths] [w] [h] [seconds allowed per depth]
// A depth the Bot neither clears nor dies in within the time allowed is a STALL — look at it by hand (tools/browser/hands.mjs "/index.html?mode=daily").
import { World } from '../src/world/world.js';
import { Abyss } from '../src/modes/abyss.js';
import { dailyAxioms } from '../src/world/abyss.js';
import { hashStr } from '../src/core/util.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [d0 = new Date().toISOString().slice(0, 10), days = '14', depths = '4', w = '1280', h = '720', cap = '100'] = process.argv.slice(2);
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' ? false : k === 'muted' ? false : noop), apply: () => 0 });
const hud = new Proxy({ panel(t, s, opts) { opts[(Math.random() * opts.length) | 0].fn(); } }, { get: (t, k) => t[k] || noop });      // "what will you become": take one, like a player would
const world = new World({});
const app = { world, hud, sound: noop, haptics: noop, save, link: null, input: { keys: new Set(), keysOff: false }, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {}, copyText() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(+w / +h) : specFn; o.onDark && o.onDark(); world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null }); o.onReveal && o.onReveal(); } };
globalThis.setTimeout = () => 0;
let stalls = 0, ends = 0; const t0 = new Date(d0 + 'T12:00:00Z').getTime();
for (let k = 0; k < +days; k++) {
  const day = new Date(t0 + k * 864e5).toISOString().slice(0, 10); const mode = new Abyss(app, { daily: true });
  mode.day = day; mode.seed = hashStr('myria' + day); mode.axioms = dailyAxioms(day); mode.axiom = mode.axioms.length > 1 ? { id: mode.axioms.map(a => a.id).join('+'), name: mode.axioms.map(a => a.name).join(' + '), sub: '' } : mode.axioms[0];
  app.mode = mode; mode.enter(); const row = []; let verdict = 'ok';
  while (mode.depth <= +depths && !mode.over) {
    const W = world, depth = mode.depth, bot = new Bot(W, { greed: 1 }), ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false }; let f = 0;
    for (; f < +cap * 60 && !mode.finished && !mode.over; f++) { bot.step(1 / 60, ctl); W.step(1 / 60, ctl); }
    const pore = W.ents.find(e => e.d.type === 'pore'), left = W.pickups.filter(q => q.isMote && !q.dead);
    if (mode.finished) { row.push(`${depth}:${(f / 60).toFixed(0)}s`); mode.load({ x: pore.x, y: pore.y }); }
    else if (mode.over) { row.push(`${depth}:ended`); verdict = 'ENDED'; ends++; }
    else { row.push(`${depth}:STALL light ${W.stats.motes}/${W.stats.motesTotal} need ${pore.need} left ${left.length} [${left.slice(0, 4).map(m => `${m.x | 0},${m.y | 0} sdf${W.phys.sampleSDF(m.x, m.y) | 0}${m.held ? ' held' : ''}`).join(' · ')}] me ${W.player.mass}@${W.player.focus ? (W.player.focus.B.cx | 0) + ',' + (W.player.focus.B.cy | 0) : '-'} target ${bot.target ? bot.target.kind : '-'} rivals ${W.colonies.filter(C => C.kind).map(C => C.kind + C.orgs.filter(o => o.alive).reduce((a, o) => a + o.B.count, 0)).join(',')}`); verdict = 'STALL'; stalls++; break; }
  }
  console.log(`${day} ${mode.axiom.id.padEnd(14)} ${verdict.padEnd(5)} ${row.join('  ')}`);
}
console.log(`${days} days: ${stalls} stalled, ${ends} ended in the dark`);
