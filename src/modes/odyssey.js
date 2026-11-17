// ─────────────────────────────────────────────────────────────────────────────
//  Odyssey — chamber after chamber, carrying your light onward.
//  Three living stars per room: Radiance (all the light), Grace (lose almost
//  nothing), Swift (under par). The pore wakes at 60 % — the rest is appetite.
// ─────────────────────────────────────────────────────────────────────────────
import { ROOMS, STRATA, stratumOf } from '../world/odyssey.js';
import { packEcho, unpackEcho } from '../world/entities.js';
import { hashStr } from '../core/util.js';

const GRACE = 3;       // particles you may lose and still keep the Grace star
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX'];
const HINTS = {
  push: '<span class="mouse-ic m"></span> lean into the gap — the gel lets go and flows',
  dart: '<span class="mouse-ic"></span> <span class="key">Space</span> dart',
  bud: '<span class="mouse-ic r"></span> <span class="key">E</span> bud a sibling &nbsp;·&nbsp; <span class="key">Q</span> call it home',
  rally: '<span class="key">Q</span> gather yourself',
  still: 'rest against a wall and hold still — what does not move is not seen',
  coil: '<span class="mouse-ic"></span> hold to coil, release to lance — it cleaves what is bigger than you',
  fly: 'lean into a bright band — and let it throw you',
  jet: '<span class="mouse-ic"></span> <span class="key">Space</span> as foam every dart is a jet — and a jet skims',
  decoy: '<span class="mouse-ic r"></span> <span class="key">E</span> leave a piece of yourself in its path — and be somewhere else',
  sow: '<span class="mouse-ic r"></span> <span class="key">E</span> the mesh stops the whole of you — a part of you is small enough',
  swell: '<span class="key">F</span> or hold <span class="mouse-ic r"></span> — swell: they judge by size · let go to pop',
};

// …and the same nudges for a thumb
const HINTS_TOUCH = {
  push: 'lean into the gap — the gel lets go and flows',
  dart: '<b>tap</b> — dart',
  bud: 'second finger: <b>tap</b> to bud a sibling &nbsp;·&nbsp; <b>pinch</b> to call it home',
  rally: '<b>pinch</b> — gather yourself',
  still: HINTS.still,
  coil: 'a <b>hard flick</b> is a lance — it cleaves what is bigger than you',
  swell: '<b>hold a second finger</b> — swell: they judge by size · let go to pop',
  fly: HINTS.fly,
  jet: '<b>tap, tap, tap</b> — as foam every dart is a jet, and a jet skims',
  decoy: 'second-finger <b>tap</b>: leave a piece of yourself in its path — and be somewhere else',
  sow: 'second-finger <b>tap</b>: the mesh stops the whole of you — a part of you is small enough',
};
// every named trick, with the riddle the journal shows until you have found it
export const TRICKS = [
  ['Thread the Needle', 'pass a comb, lose nothing, be one again'], ['Surgical Shear', 'let a blade make two of you — and use both'],
  ['Ghost Wall', 'be a wall while something looks straight at you'], ['Paper Tiger', 'frighten a hunter with nothing but breath'],
  ['Cleave', 'part a giant in two'], ['Slingshot', 'be thrown by one pole and caught by the other'],
  ['Gravity Assist', 'go in among a well\'s nearest light, and leave having paid it nothing'], ['Comet', 'twenty-four lights without a pause'],
  ['Hole in One', 'leave two bands behind and do not land until you are home'],
  ['Bank Shot', 'open what no band is aimed at'],
  ['Go-Between', 'be on both sides of a wall that has no door'],
  ['Trojan Swallow', 'be swallowed — by something that will never swallow again'],
  ['Outrun', 'come home before your own echo does'],
  ['Phoenix', 'leave a chamber whole after being an ember in it'], ['Immaculate', 'all three stars in a single visit'],
  ['Net', 'four of a school inside one heartbeat'], ['Velvet', 'take a shy light that never knew you were there'],
  ['In Time', 'three fireflies in a single flash'], ['Harvest', 'every seed of a pod before it settles'],
];
// ── the Daily Sprint: one chamber a day, under one mutation of its water, against the clock (the same chamber and mutation for everyone, from the date alone) ──
export const SPRINTS = [
  { id: 'swift', name: 'Quick Tide', sub: 'you, and everything else, move faster', apply: (W) => { W.speedScale = 1.3; } },
  { id: 'thick', name: 'Thick Water', sub: 'everything drags', apply: (W) => { W.phys.drag = 2.6; } },
  { id: 'glide', name: 'Glass Water', sub: 'nothing slows you down — nothing', apply: (W) => { W.phys.drag = 0.6; } },
  { id: 'glean', name: 'Gleaner', sub: 'the way out opens only when every light is yours', apply: (W) => { for (const e of W.ents) if (e.d.type === 'pore') e.need = W.stats.motesTotal; } },
];
// every (chamber, mutation) pair the bot has finished — the day's sprint is only ever drawn from these (tools/sprint.mjs rebuilds the list)
export const SPRINT_OK = [["narrows","swift"],["leap","swift"],["two-hearts","swift"],["lock","swift"],["comb","swift"],["shear","swift"],["rebound","swift"],["grinder-row","swift"],["press","swift"],["centrifuge","swift"],["amber","swift"],["quicksilver","swift"],["fizz","swift"],["osmosis","swift"],["oil-water","swift"],["bastion","swift"],["iron-bloom","swift"],["thaw","swift"],["twin-cores","swift"],["veil","swift"],["tidepool","swift"],["event-horizon","swift"],["bluff","swift"],["trojan","swift"],["narrows","thick"],["leap","thick"],["two-hearts","thick"],["lock","thick"],["comb","thick"],["shear","thick"],["rebound","thick"],["grinder-row","thick"],["press","thick"],["centrifuge","thick"],["amber","thick"],["quicksilver","thick"],["fizz","thick"],["osmosis","thick"],["oil-water","thick"],["bastion","thick"],["iron-bloom","thick"],["thaw","thick"],["twin-cores","thick"],["veil","thick"],["tidepool","thick"],["event-horizon","thick"],["bluff","thick"],["trojan","thick"],["narrows","glide"],["leap","glide"],["two-hearts","glide"],["lock","glide"],["comb","glide"],["shear","glide"],["rebound","glide"],["grinder-row","glide"],["press","glide"],["centrifuge","glide"],["amber","glide"],["quicksilver","glide"],["fizz","glide"],["osmosis","glide"],["oil-water","glide"],["bastion","glide"],["iron-bloom","glide"],["thaw","glide"],["twin-cores","glide"],["veil","glide"],["tidepool","glide"],["event-horizon","glide"],["bluff","glide"],["trojan","glide"],["hunt","glide"],["narrows","glean"],["leap","glean"],["two-hearts","glean"],["lock","glean"],["shear","glean"],["press","glean"],["amber","glean"],["fizz","glean"],["oil-water","glean"],["bastion","glean"],["thaw","glean"],["veil","glean"],["event-horizon","glean"],["bluff","glean"],["trojan","glean"],["hunt","glean"]];
export function dailySprint(day) {
  let pairs = SPRINT_OK; if (!pairs) { pairs = []; for (const r of ROOMS) for (const m of SPRINTS) if (r.id !== 'first-light' && r.id !== 'heart') pairs.push([r.id, m.id]); }
  const pick = pairs[hashStr('sprint' + day) % pairs.length]; return { day, i: Math.max(0, ROOMS.findIndex(r => r.id === pick[0])), m: SPRINTS.find(q => q.id === pick[1]) || SPRINTS[0] };
}
export class Odyssey {
  constructor(app, index = 0, o = {}) { this.app = app; this.i = Math.max(0, Math.min(ROOMS.length - 1, index)); this.carryMass = o.mass || 0; this.single = !!o.single; this.sprint = o.sprint || null; this.tricks = []; }
  enter() { this.load(false); }
  exit() { this.app.hud.hint(''); }

  load(fromPore) {
    const app = this.app, room = this.room = ROOMS[this.i];
    this.finished = false; this.tricks = []; this.thrownTo = null; this.skim = null; this.wasEmber = false; this.hintT = 0; this.usedHint = false; this.combT = 0; this.air = 0; this.groundT = 0;
    app.travel((aspect) => { const s = room.build(aspect); s.name = room.name; s.no = this.i + 1; s.seed = s.seed || (this.i * 97 + 13); this.spec = s; return s; },
      (spec) => ({ mass: this.startMass = this.massFor(spec) }), {
        minDark: fromPore ? 1.9 : 0.5,
        onDark: () => app.applyBudget(),
        onLoad: (W) => { for (const e of W.ents) if (e.d.type === 'pore' && !e.need) e.need = Math.ceil(W.stats.motesTotal * (this.room.quota ?? this.spec.quota ?? 0.6)); if (this.sprint) this.sprint.m.apply(W); else this.wakeEcho(W); },
        onReveal: () => { app.hud.hideResult(); app.hud.showTitle(ROMAN[this.i] || '', room.name, this.titleSub()); app.hud.setCorner(true, () => app.pause()); this.music(); },
      });
  }
  // the music of a chamber: its stratum's piece (one piece across all the stratum's chambers, a cadence at every pore);
  // a warden's own, in the stratum's key; the Heart's, with a heartbeat under it
  music() { const s = this.app.sound, name = ['dew', 'glass', 'chem', 'abyss'][stratumOf(this.i)] || 'dew'; if (this.room.id === 'heart') s.ambience('heart'); else if (this.room.boss) s.ambience('warden', s.keyOf(name)); else s.ambience(name); }
  // ── echo: on a chamber you have already cleared, your best run comes back as a pale bead to race; a friend's echo (a pasted code) races beside it ──
  wakeEcho(W) {
    this.rec = []; this.recT = 0; this.echo = null; this.rival = null; this.air = 0; this.groundT = 0;
    const own = this.app.save.echo(this.room.id), fr = this.app.rivalEcho && this.app.rivalEcho.id === this.room.id ? this.app.rivalEcho : null;
    const skin = W.host && W.host.skin ? W.host.skin() : null; const hue = skin && skin.emit ? skin.emit : [1, 0.72, 0.5];
    if (own && own.p && this.app.save.room(this.room.id)) { const pts = unpackEcho(own.p); if (pts && pts.length > 4) this.echo = W.spawn({ type: 'echo', pts, time: own.t, col: [hue[0] * 0.5 + 0.5, hue[1] * 0.5 + 0.5, hue[2] * 0.5 + 0.5] }); }
    if (fr) { const pts = unpackEcho(fr.p); if (pts && pts.length > 4) this.rival = W.spawn({ type: 'echo', pts, time: fr.t, col: [0.55, 0.95, 1], rival: true }); }
  }
  echoCode() { const e = this.app.save.echo(this.room.id); return e ? `MYRIA-ECHO.${this.room.id}.${e.t.toFixed(2)}.${e.p}` : ''; }
  pauseItems() { return this.app.save.echo(this.room.id) ? [{ label: 'Copy my echo', fn: (b) => { this.app.copyText(this.echoCode()); b.textContent = 'Echo copied ✓'; } }] : []; }
  // carry: what you ended the last chamber with — never less than the chamber's own seed, never more than it can hold
  massFor(spec) { const base = spec.minMass || spec.spawn.n || 40; const carry = this.carryMass || base; return Math.round(Math.max(base, Math.min(spec.cap || base * 1.5, base + (carry - base) * 0.3))); }
  restart() { this.carryMass = this.startMass; this.load(false); }
  pauseSub() { return `${ROMAN[this.i]} · ${this.room.name}`; }
  // a stratum announces itself once, at its first chamber; a warden always does
  titleSub() { if (this.sprint) return `today's sprint · ${this.sprint.m.name} — ${this.sprint.m.sub}`; const k = stratumOf(this.i); return this.room.boss ? `warden of ${STRATA[k].name}` : STRATA[k].from === this.i ? STRATA[k].name : ''; }

  // ── world listener ────────────────────────────────────────────────────
  poreReady(p) { const W = this.app.world; return W.stats.motes >= p.need && (!p.d.key || W.check(p.d.key)); }
  poreProgress(p) { const W = this.app.world; return p.need ? Math.min(1, W.stats.motes / p.need) : 1; }
  tier(name) { this.app.hud.toast(name, '✺'); }
  ember(on) { if (on) this.wasEmber = true; this.app.hud.toast(on ? 'ember — nothing can drink you · light counts double' : 'whole again', '✺', on ? '' : 'cool'); }
  mote(m, O, chain) { this.hintT = 0; if (m.living) this.livingTaken(m); if (chain && chain % 8 === 0) this.app.hud.toast(`Chain ×${chain} <small>+${1 + Math.min(3, chain >> 3)}</small>`, '♪', 'cool'); if (chain === 24) this.trick('Comet'); }
  // living light, taken with wit (world/plankton.js)
  livingTaken(m) {
    const t = this.app.world.time, q = (this.lt || (this.lt = {})); const recent = (k, w) => { const a = (q[k] || (q[k] = [])); a.push(t); while (a.length && t - a[0] > w) a.shift(); return a.length; };
    if (m.kind === 'shoal' && recent('shoal', 1.0) >= 4) this.trick('Net');
    if (m.kind === 'shy' && !m.fled) this.trick('Velvet');
    if (m.kind === 'firefly' && recent('fire', 0.55) >= 3) this.trick('In Time');
    if (m.kind === 'seed' && m.from && t - m.burstT < 3.2 && m.from.seeds.length >= 4 && m.from.seeds.every(s => s.dead)) this.trick('Harvest');
  }
  moteLost() { for (const e of this.app.world.ents) if (e.d.type === 'pore' && e.need > 0) e.need--; }      // light a neighbour drank can no longer be asked of you
  film() { this.usedHint = this.room.hint === 'dart' || this.usedHint; }
  dart(O) { if (this.room.hint === 'jet' && O.morph && O.morph.jet) this.usedHint = true; }
  bud() { if (this.room.hint === 'bud') this.usedHint = true; }
  split(parent, child, cut) { if (cut && !this.tricks.includes('Surgical Shear')) this.pendingShear = this.app.world.time; }
  pad(p) { if (p.active && this.pendingShear && this.app.world.time - this.pendingShear < 12 && this.app.world.player.orgs.length > 1) this.trick('Surgical Shear'); }
  fuse(keep, gone, n) { const W = this.app.world; if (this.room.id === 'comb' && W.player.orgs.length === 1 && keep.cx > W.spec.W * 0.5 || this.room.id === 'comb' && keep.cy > W.spec.H * 0.5) { if (W.stats.lost <= GRACE) this.trick('Thread the Needle'); } if (this.room.hint === 'rally') this.usedHint = true; }
  trick(name) { if (this.tricks.includes(name)) return; this.tricks.push(name); const first = this.app.save.trick(name); this.app.hud.toast(name, '✦'); this.app.sound.trick(); void first; }
  veilT(dt, W) { const F = W.player.focus; if (F && F.stealth) { this.veiled = (this.veiled || 0) + dt; this.usedHint = this.room.hint === 'still' || this.usedHint; if (this.veiled > 1.5 && W.ents.some(e => e.watch && Math.hypot(e.x - F.B.cx, e.y - F.B.cy) < e.range)) this.trick('Ghost Wall'); } }
  pop(O) { if (this.room.hint === 'swell') this.usedHint = true; const W = this.app.world; if (W.colonies.some(C => C.kind === 'hunter' && C.orgs.some(o => o.alive && o.brain && o.brain.state === 'flee' && Math.hypot(o.B.cx - O.B.cx, o.B.cy - O.B.cy) < 260))) this.trick('Paper Tiger'); }
  bumper() { if (this.room.hint === 'fly') this.usedHint = true; this.air = (this.air || 0) + 1; this.groundT = 0; }      // bands touched in one unbroken flight
  trojan() { this.trick('Trojan Swallow'); if (this.room.hint === 'decoy') this.usedHint = true; }
  bank() { this.trick('Bank Shot'); }
  seeped(v, O) { if (this.room.hint === 'sow') this.usedHint = true; const F = this.app.world.player.focus; if (F && O !== F && F.B.count > v.S.small) this.trick('Go-Between'); }
  thrown(core) { this.thrownT = this.app.world.time; this.thrownTo = core.twin; }                    // a pole threw us: if its twin catches us out of the air, that is a Slingshot
  cleave() { this.trick('Cleave'); if (this.room.hint === 'coil') this.usedHint = true; }
  hurt(B, n, gone) { const W = this.app.world; if (W.stats.lost === GRACE + 1) this.app.hud.toast('grace lost', '◇', 'cool'); }

  post(dt, W) {
    if (this.finished) return; this.veilT(dt, W);
    if (this.rec && this.rec.length < 1500 && (this.recT += dt) >= 0.1) { this.recT -= 0.1; const F0 = W.player.focus; if (F0) { const sp = W.spec, land = sp.W >= sp.H; this.rec.push(land ? [F0.B.cx / sp.W, F0.B.cy / sp.H] : [F0.B.cy / sp.H, F0.B.cx / sp.W]); } }
    // Gravity Assist: go in among a well's nearest light and come out again having paid it nothing
    const Ff = W.player.focus; if (Ff && Ff.alive) for (const e of W.ents) { if (e.d.type !== 'well') continue; const d = Math.hypot(Ff.B.cx - e.x, Ff.B.cy - e.y);
      if (!this.skim && d < Math.max(e.r * 4.5, e.reach * 0.36)) this.skim = { e, lost: W.stats.lost, mass: W.player.mass };
      else if (this.skim && this.skim.e === e && d > e.reach * 0.72) { if (W.stats.lost === this.skim.lost && W.player.mass >= this.skim.mass) this.trick('Gravity Assist'); this.skim = null; } }
    if (this.air) { if (Ff && (Ff.flightT > 0 || Ff.flew > 0)) this.groundT = 0; else if ((this.groundT += dt) > 0.4) this.air = 0; }
    if (this.thrownTo) { const age = W.time - this.thrownT; if (age > 1.7) this.thrownTo = null; else if (age > 0.25 && this.thrownTo.coat >= 8) { this.thrownTo = null; this.trick('Slingshot'); } }
    // the unbreakable floor: if nothing of you is left, the chamber gives you back a seed of light
    if (!W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 24); W.stats.lost += GRACE + 1; W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 120, 0.9); this.app.sound.bloom(); this.app.hud.toast('rekindled', '✺'); }
    // wordless hint after a stall (eating is progress: every light taken resets the clock; squeezing through is what 'push' was asking for)
    if (this.room.hint === 'push' && Ff && Ff.alive && Ff.squeeze > 0.4) this.usedHint = true;
    if (this.room.hint && !this.usedHint) { this.hintT += dt; this.app.hud.hint(this.hintT > 7 ? (this.app.input && this.app.input.device === 'touch' ? HINTS_TOUCH : HINTS)[this.room.hint] : ''); } else this.app.hud.hint('');
  }
  stars(W) { const s = W.stats; return [s.motes >= s.motesTotal, s.lost <= GRACE, W.roomTime <= this.room.par]; }
  frame() {
    const app = this.app, W = app.world; if (this.finished || app.state !== 'play' && app.state !== 'in') return;
    const s = W.stats; const pore = W.ents.find(e => e.d.type === 'pore');
    app.hud.setTop({ light: s.motes, total: s.motesTotal, quota: pore ? pore.need : 0,
      stars: this.finished ? null : [s.motes >= s.motesTotal ? 1 : 0, s.lost <= GRACE ? 1 : -1, W.roomTime <= this.room.par ? 1 : -1], extra: W.chain >= 4 ? `♪ ${W.chain}` : '' });
  }
  complete(pore) {
    if (this.finished) return; this.finished = true;
    const app = this.app, W = app.world, s = W.stats; const stars = this.stars(W);
    if (this.air >= 2) this.trick('Hole in One');
    if (stars.every(Boolean)) this.trick('Immaculate'); if (this.wasEmber && W.player.mass >= this.startMass) this.trick('Phoenix');
    const beatOwn = this.echo && !this.echo.home, beatRival = this.rival && !this.rival.home, lostRival = this.rival && this.rival.home;
    if (beatOwn) this.trick('Outrun');
    if (beatRival) app.hud.toast(`echo beaten by ${(this.rival.T - W.roomTime).toFixed(1)} s`, '◷'); else if (lostRival) app.hud.toast(`the echo was ${(W.roomTime - this.rival.T).toFixed(1)} s ahead`, '◷', 'cool');
    // (a sprint is run in mutated water: its stars and its path are the day's, not the chamber's record)
    const rec = this.sprint ? { newBest: false, firstClear: false } : app.save.recordRoom(this.room.id, { stars, time: W.roomTime, light: s.motes });
    const had = app.save.echo(this.room.id); if (!this.sprint && this.rec && this.rec.length > 4 && this.rec.length < 1500 && (!had || W.roomTime < had.t - 0.01)) app.save.setEcho(this.room.id, { t: +W.roomTime.toFixed(2), p: packEcho(this.rec) });
    this.carryMass = W.player.mass;
    // celebration at the pore: the body pours in, the room exhales light
    const F = W.player.focus; if (F) { F.seek = { x: pore.x, y: pore.y, k: 1500 }; for (const O of W.player.orgs) O.rallyTo = F.B; }
    W.fx.ring(pore.x, pore.y, pore.col, 260, 0.9); W.fx.burst(pore.x, pore.y, 36, [1, 0.9, 0.7], 320, { life: 1.1, size: 3 }); W.flash = 1;
    app.sound.portal(); app.haptics.fuse();
    app.hud.hint(''); app.hud.setTop(null); app.hud.setCorner(false);
    const last = this.i >= ROOMS.length - 1;
    const result = { name: `${ROMAN[this.i]} · ${this.room.name}`, stars, light: s.motes, total: s.motesTotal, time: W.roomTime, par: this.room.par, mass: W.player.mass, chain: s.bestChain || 0, tricks: this.tricks, next: last ? 'one more room' : rec.newBest && !rec.firstClear ? 'new best' : '', onStar: (k) => app.sound.star(k) };
    if (this.sprint) { const save = app.save, t = +W.roomTime.toFixed(2), prev = save.get('sprintDay', '') === this.sprint.day ? save.get('sprintBest', 0) : 0; if (!prev || t < prev) save.set('sprintBest', t); save.set('sprintDay', this.sprint.day); result.next = prev && t >= prev ? `sprint · today's best ${prev.toFixed(1)} s` : `sprint · ${t.toFixed(1)} s is today's best`; }
    setTimeout(() => {
      if (app.mode !== this) return;
      if (last && !this.single) { app.toEpilogue({ result, mass: W.player.mass }); return; }           // the last room has no door
      if (this.single) { app.toHub({ result }); return; }
      this.i++; this.loadNext(result, pore);
    }, 650);
  }
  loadNext(result, pore) {
    const app = this.app; const room = this.room = ROOMS[this.i];
    this.finished = false; this.tricks = []; this.thrownTo = null; this.skim = null; this.wasEmber = false; this.hintT = 0; this.usedHint = false; this.pendingShear = 0;
    app.travel((aspect) => { const s = room.build(aspect); s.name = room.name; s.no = this.i + 1; s.seed = s.seed || (this.i * 97 + 13); this.spec = s; return s; }, (spec) => ({ mass: this.startMass = this.massFor(spec) }), {
      from: { x: pore.x, y: pore.y }, minDark: 2.3,
      onDark: () => { app.applyBudget(); app.hud.showResult(result); },
      onLoad: (W) => { for (const e of W.ents) if (e.d.type === 'pore' && !e.need) e.need = Math.ceil(W.stats.motesTotal * (this.room.quota ?? this.spec.quota ?? 0.6)); if (this.sprint) this.sprint.m.apply(W); else this.wakeEcho(W); },
      onReveal: () => { app.hud.hideResult(); app.hud.showTitle(ROMAN[this.i] || '', room.name, this.titleSub()); app.hud.setCorner(true, () => app.pause()); this.music(); },
    });
  }
}
