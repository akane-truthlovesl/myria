// Play made chambers headlessly with the Bot, through the real Trial mode (modes/workshop.js) — the same path a pasted line takes:
//   node tools/chambers.mjs [w] [h] [tries]          plays every chamber in STARTERS (src/world/starters.js)
//   node tools/chambers.mjs [w] [h] [tries] <code>   plays one chamber line
// It prints each run and, for the fastest finished run, the chamber's line *with that run as its record* (STAMP=1 prints only those lines).
import { World } from '../src/world/world.js';
import { Trial } from '../src/modes/workshop.js';
import { unpackChamber, packChamber, chamberName, chamberHash } from '../src/world/workshop.js';
import { STARTERS } from '../src/world/starters.js';
import { packEcho } from '../src/world/entities.js';
import { Bot } from '../src/core/bot.js';
import { save } from '../src/core/save.js';
const [w = '1280', h = '720', tries = '1', one = ''] = process.argv.slice(2);
const noop = new Proxy(function () {}, { get: (t, k) => (k === 'ready' ? false : k === 'muted' ? false : noop), apply: () => 0 });
const world = new World({});
const app = { world, hud: noop, sound: noop, haptics: noop, save, state: 'play', params: new URLSearchParams(), applyBudget() {}, pause() {}, toHub() {}, setMode() {}, moment() {},
  travel(specFn, carryFn, o = {}) { const spec = typeof specFn === 'function' ? specFn(+w / +h) : specFn; world.load(spec, (typeof carryFn === 'function' ? carryFn(spec) : carryFn) || {}); world.listener = this.mode; o.onDark && o.onDark(); o.onLoad && o.onLoad(world); for (let k = 0; k < 20; k++) world.step(1 / 60, { intent: null, aim: null, rally: false }); o.onReveal && o.onReveal(); } };
const realTimeout = globalThis.setTimeout; globalThis.setTimeout = () => 0;
const list = one ? [one] : STARTERS; let fails = 0; const stamped = [];
for (const code of list) {
  const c = unpackChamber(code); if (!c) { console.log('?? not a chamber line'); fails++; continue; }
  const name = chamberName(chamberHash(c.design)); let best = null;
  for (let k = 0; k < +tries; k++) {
    const mode = new Trial(app, { design: c.design, run: c.run }); app.mode = mode; mode.enter();
    const W = world, bot = new Bot(W, { greed: 1 }), ctl = { intent: { x: 0, y: 0 }, aim: null, rally: false }; const limit = 150 * 60; let f = 0;
    // the run is recorded exactly as the mode records it (Odyssey.post, 10 Hz, along/across)
    for (; f < limit && !mode.finished; f++) { bot.step(1 / 60, ctl); W.step(1 / 60, ctl); }
    const s = W.stats; console.log(`${name.padEnd(24)} ${mode.finished ? 'DONE' : 'FAIL'} t=${W.roomTime.toFixed(1).padStart(5)} light=${s.motes}/${s.motesTotal} lost=${s.lost} bodies=${W.player.orgs.filter(o => o.alive).length}`);
    if (mode.finished && mode.rec && mode.rec.length > 4 && (!best || W.roomTime < best.t)) best = { t: +W.roomTime.toFixed(2), p: packEcho(mode.rec) };
  }
  if (!best) fails++; else stamped.push(packChamber(c.design, c.run && c.run.t <= best.t ? c.run : best));
}
if (process.env.STAMP) for (const s of stamped) console.log(s);
console.log(`total ${list.length} chambers, ${fails} unfinished`);
globalThis.setTimeout = realTimeout;
