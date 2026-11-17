// ─────────────────────────────────────────────────────────────────────────────
//  Abyss — the endless descent. Chambers are generated, neighbours are hungry,
//  and every second chamber you choose how to change. Three embers: lose your
//  whole body and one rekindles you; lose the last and the dive is over.
//  (The Daily Abyss is the same dive on the day's seed, bent by one axiom.)
// ─────────────────────────────────────────────────────────────────────────────
import { abyssRoom, AXIOMS, dailyAxioms } from '../world/abyss.js';
import { MAT } from '../sim/materials.js';
import { rng, hashStr } from '../core/util.js';
import { Colony } from '../life/colony.js';

const TINT2 = { id: 'duet2', absorb: [0.95, 0.30, 0.08], emit: [0.35, 0.9, 1.0], glow: 0.62, halo: 0.5 };

export const TRAITS = [
  { id: 'reach', name: 'Long Reach', sub: 'feelers stretch far further', on: (m) => { m.T.reachK = (m.T.reachK || 1) * 1.6; } },
  { id: 'quick', name: 'Quick', sub: 'a faster body', on: (m) => { m.T.speed = (m.T.speed || 1) * 1.2; } },
  { id: 'breath', name: 'Deep Breath', sub: 'darting costs no mass', on: (m) => { m.T.freeDart = true; } },
  { id: 'glutton', name: 'Glutton', sub: 'every mote feeds one more', on: (m) => { m.T.moteBonus = (m.T.moteBonus || 0) + 1; } },
  { id: 'heart', name: 'Second Heart', sub: 'one more ember', on: (m) => { m.embers = Math.min(5, m.embers + 1); } },
  { id: 'tide', name: 'Tidal Pull', sub: 'lost dew comes home from afar', on: (m) => { m.T.dewReach = 520; } },
  { id: 'lance', name: 'Lancer', sub: 'darts fly much further', on: (m) => { m.T.dart = (m.T.dart || 1) * 1.35; } },
  { id: 'bastion', name: 'Bastion Skin', sub: 'grinders and thorns rarely bite', on: (m) => { m.T.mat = MAT.BASTION; } },
  { id: 'silver', name: 'Quicksilver', sub: 'liquid metal: frictionless and fast', on: (m) => { m.T.mat = MAT.SILVER; m.T.speed = (m.T.speed || 1) * 1.25; } },
  { id: 'thorn', name: 'Thorn Crown', sub: 'your touch sheds your neighbours', on: (m) => { m.T.mat = MAT.THORN; m.T.crown = 'thorns'; } },
];

import { hauntName, packHaunt, ghostTint } from '../core/haunt.js';
import { SKINS } from '../core/skins.js';

export class Abyss {
  constructor(app, o = {}) {
    this.app = app; this.daily = !!o.daily; this.coop = !!o.coop; this.mass2 = 40;
    const day = this.day = new Date().toISOString().slice(0, 10);
    this.seed = this.daily ? hashStr('myria' + day) : (Math.random() * 1e9) | 0;
    // the day's dive is bent by the day's mutation of the world — two of them at once on a weekend (world/abyss.js dailyAxioms)
    this.axioms = this.daily ? dailyAxioms(day) : [AXIOMS[0]]; this.axiom = this.axioms.length > 1 ? { id: this.axioms.map(a => a.id).join('+'), name: this.axioms.map(a => a.name).join(' + '), sub: this.axioms.map(a => a.sub).join(' · ') } : this.axioms[0];
    this.depth = 1; this.embers = 3; this.T = {}; this.traits = []; this.light = 0; this.devoured = 0; this.mass = Math.max(40, o.mass || 40);
    this.R = rng(this.seed ^ 0x5bd1e995); this.over = false; this.pausable = true;
    this.runId = ((Math.random() * 0x7fffffff) | 0) + 1; this.marks = []; this.rested = 0;
  }
  enter() { if (this.coop) this.app.input.keysOff = true; this.load(null); }
  exit() { this.app.hud.hint(''); this.app.input.keysOff = false; }
  onEvent(e) { if (!this.coop || this.app.state !== 'play') return false; if (e.type === 'dartKey') { const F = this.p2 && this.p2.focus; if (F && F.alive) F.dart(F.facing.x, F.facing.y, 0.9 + Math.min(1, (e.hold || 0) / 0.7) * 0.7); return true; } return e.type === 'budKey' || e.type === 'cycle'; }
  update(dt, W) {
    if (!this.coop || !this.p2) return; const K = this.app.input.keys; let x = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0), y = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0); if (x && y) { x *= 0.707; y *= 0.707; }
    const F = this.p2.focus, V = this.p2.pilot || (this.p2.pilot = { x: 0, y: 0 }); const L = this.app.link && this.app.link.p2(this.p2); if (L) { x = L.x; y = L.y; for (const d of L.darts) F.dart(d.x, d.y, d.power); }
    V.x += (x - V.x) * Math.min(1, dt * 20); V.y += (y - V.y) * Math.min(1, dt * 20); if (F && F.alive) F.swell = L ? L.swell : K.has('KeyF');
    for (const O of this.p2.orgs) if (O !== F && F) { O.rallyTo = F.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }
  }
  pauseSub() { return `${this.daily ? 'Daily Abyss · ' + this.axiom.name : this.coop ? 'Abyss together · pointer + W A S D / Space / F' : 'Abyss'} · depth ${this.depth}`; }

  load(from) {
    const app = this.app; this.finished = false; this.roomLight = 0;
    app.travel((aspect) => (this.spec = abyssRoom(aspect, this.depth, this.seed, this.axioms, Math.min(260, this.mass))), () => ({ mass: Math.min(260, this.mass), mat: this.T.mat ?? MAT.LUMEN, crown: this.T.crown || 'sun' }), {
      from, minDark: from ? 0.6 : 0.4, hold: () => !this.choosing,
      onDark: () => { app.applyBudget(); if (from && this.depth % 2 === 1 && this.depth > 1) this.choose(); },
      onLoad: (W) => {
        W.speedScale = this.spec.speedScale || 1; W.massCosts = !this.T.freeDart; W.dartSpeed = 600 * (this.T.dart || 1); W.dewReach = this.T.dewReach || 200; W.moteBonus = this.T.moteBonus || 0;
        for (const O of W.player.orgs) { O.speedMul = this.T.speed || 1; O.reachK = this.T.reachK || 1; }
        W.player.orgOpts = { speedMul: this.T.speed || 1 };
        for (const e of W.ents) if (e.d.type === 'pore') e.need = this.spec.arena ? 0 : Math.ceil(W.stats.motesTotal * 0.55);
        if (this.coop) { const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(W.spec.spawn.x + 80, W.spec.spawn.y, Math.min(260, Math.max(40, this.mass2))); W.colonies.push(C); C.ally = W.player.ally = true; }
        this.marks = []; this.lostSeen = 0; this.layHaunt(W);
      },
      onReveal: () => { if (this.coop && this.depth === 1) app.hud.toast('touch to share mass · pointer + W A S D', '◌', 'cool'); if (this.haunting) { app.hud.toast(this.haunting.guest ? `a stranger ended here · ${hauntName(this.haunting.id)}` : `you ended here once · ${hauntName(this.haunting.id)}`, '☍', 'cool'); } app.hud.showTitle(this.daily ? this.axiom.name : '', this.spec.arena ? 'Predator Dish' : `Depth ${this.depth}`, this.spec.arena ? 'devour them all' : (this.depth === 1 && this.daily ? this.axiom.sub : ''), 2.4); app.hud.setCorner(true, () => app.pause()); this.music(); },
    });
  }
  // the deep changes its music every third depth, with its colours (dew, glass, chemistry, the abyss, round again); a predator dish has a warden's
  music() { const s = this.app.sound, name = ['dew', 'glass', 'chem', 'abyss'][Math.floor((this.depth - 1) / 3) % 4]; if (this.spec && this.spec.arena) s.ambience('warden', s.keyOf(name)); else s.ambience(name); }
  // ── hauntings (core/haunt.js) ──
  // a dive that reaches a depth where an earlier one ended — yours, or a stranger's you were handed — finds what it left: a stain, false lights, and what gets up out of the stain
  layHaunt(W) {
    this.haunting = null; this.rev = null; if (this.daily || this.coop) return;                 // the day's dive is the same for everyone; nothing of anyone lies in it
    const save = this.app.save, list = save.get('haunts', []); const h = list.filter(q => q.depth === this.depth && q.id !== this.runId).sort((a, b) => (b.guest ? 1 : 0) - (a.guest ? 1 : 0))[0]; if (!h) return;
    const P = W.phys, sp = W.spec; const free = (x, y, m) => P.sampleSDF(x, y) > m && Math.hypot(x - sp.spawn.x, y - sp.spawn.y) > 190 && !W.ents.some(e => (e.d.type === 'pore' || e.hazard) && Math.hypot(e.x - x, e.y - y) < (e.r || 40) + m);
    let x = h.u * sp.W, y = h.v * sp.H, ok = free(x, y, 46); for (let k = 1; k < 60 && !ok; k++) { const a = k * 2.4, r = 30 + k * 11; const qx = h.u * sp.W + Math.cos(a) * r, qy = h.v * sp.H + Math.sin(a) * r; if (free(qx, qy, 46)) { x = qx; y = qy; ok = true; } } if (!ok) return;      // (the room's distance field saturates near 70)
    const tint = ghostTint((SKINS[h.hue] || SKINS[0]).tint); const n = Math.round(Math.max(30, Math.min(h.n * 0.85, this.mass * 1.25)));          // it is the body it was — but never hopelessly more than you are
    this.residue = W.spawn({ type: 'residue', x, y, n, tint, col: tint.emit, haunt: h });
    for (const d of h.dec || []) { const dx = d[0] * sp.W, dy = d[1] * sp.H; if (P.sampleSDF(dx, dy) > 34 && Math.hypot(dx - x, dy - y) > 110 && Math.hypot(dx - sp.spawn.x, dy - sp.spawn.y) > 130) W.spawn({ type: 'mimic', x: dx, y: dy, col: tint.emit }); }
    this.haunting = h;
  }
  haunt(res, C) { this.rev = C; }
  // where this dive bled: the last few places it lost a real piece of itself (they become the false lights of its haunting)
  markLoss(W) { const lost = W.stats.lost; if (lost - (this.lostSeen || 0) >= 8) { const F = W.player.focus; if (F && F.alive) { this.marks.push([F.B.cx / W.spec.W, F.B.cy / W.spec.H]); if (this.marks.length > 3) this.marks.shift(); } this.lostSeen = lost; } }
  myHaunt() { const W = this.app.world, c = (v) => Math.max(0.06, Math.min(0.94, v)); return { id: this.runId, depth: this.depth, u: c(this.lastPos ? this.lastPos[0] / W.spec.W : 0.5), v: c(this.lastPos ? this.lastPos[1] / W.spec.H : 0.5), n: Math.round(Math.max(40, Math.min(320, this.peak || this.mass))), hue: this.app.save.get('skin', 0) | 0, dec: this.marks.slice(-3) }; }

  // every second chamber: three ways to change
  choose() {
    const app = this.app; this.choosing = true;
    const pool = TRAITS.filter(t => !this.traits.includes(t.id) && !(this.T.mat !== undefined && ['bastion', 'silver', 'thorn'].includes(t.id)));
    const opts = this.R.shuffle(pool.slice()).slice(0, 3);
    app.hud.panel('Change', 'the dark asks what you will become', opts.map(t => ({ label: `${t.name}<br><small style="opacity:.6;letter-spacing:.1em;text-transform:none">${t.sub}</small>`, fn: () => { t.on(this); this.traits.push(t.id); app.sound.morph(); app.hud.closePanel(); this.choosing = false; } })));
  }

  // ── world listener ────────────────────────────────────────────────────
  rivalsAlive(W) { return W.colonies.filter(C => C.kind && C.kind !== 'oil' && C.kind !== 'thorn' && C.orgs.some(o => o.alive && o.B.count >= 14)).length; }
  moteLost() { for (const e of this.app.world.ents) if (e.d.type === 'pore' && e.need > 0) e.need--; }      // light a neighbour drank can no longer be asked of you (as in the Odyssey)
  poreReady(p) { const W = this.app.world; if (!this.spec) return false; if (this.spec.arena) return this.rivalsAlive(W) === 0; return W.stats.motes >= p.need || W.pickups.filter(q => q.isMote && !q.dead).length === 0; }
  poreProgress(p) { const W = this.app.world; if (!this.spec || this.spec.arena) return 0; return p.need ? Math.min(1, W.stats.motes / p.need) : 1; }
  tier(name) { this.app.hud.toast(name, '✺'); }
  ember(on) { this.app.hud.toast(on ? 'ember — nothing can drink you · light counts double' : 'whole again', '✺', on ? '' : 'cool'); }
  mote(m, O, chain) { this.light++; this.roomLight++; if (chain && chain % 8 === 0) this.app.hud.toast(`Chain ×${chain}`, '♪', 'cool'); }
  wrung(sp, O, n) { if (n >= 8) this.app.hud.toast('Wrung out', '✦'); }
  unmask() { this.app.hud.toast('Unmasked', '✦'); const F = this.app.world.player.focus; F && F.crown.joy(); }
  cleave() { if (!this.cleft) { this.cleft = true; this.app.hud.toast('Cleave', '✦'); } }
  devour(C, Bi, Bj) {
    const app = this.app, W = app.world, F = W.player.focus;
    if (C.kind === 'revenant') {         // laid to rest: it gives back the light it died with, and it will not be waiting here again
      // (only when the last of it is swallowed: a revenant torn in two is not at rest while half of it still wanders — each half used to lay it to rest again)
      //  (a body's count is only refreshed between steps, so whether another piece still holds any of itself is asked of the particles)
      const P = W.phys, holds = (B) => { for (let q = 0; q < B.len; q++) { const i = P.bodyIdx[B.start + q]; if (P.alive[i] && P.body[i] === B.id) return true; } return false; };
      if (C.laid || C.orgs.some(o => o.alive && o.B !== Bj && holds(o.B))) return; C.laid = true;
      const h = C.haunt; this.rested++; this.rev = null; if (h) { app.save.set('haunts', app.save.get('haunts', []).filter(q => q.id !== h.id)); app.save.set('rested', app.save.get('rested', 0) + 1); }
      if (F) { for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; W.spawn({ type: 'mote', x: F.B.cx + Math.cos(a) * 70, y: F.B.cy + Math.sin(a) * 70, value: 4, free: true, gift: true, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, col: [0.92, 0.86, 1] }); } W.fx.ring(F.B.cx, F.B.cy, [0.92, 0.86, 1], 320, 1.1, { w: 3 }); F.crown.joy(); }
      this.light += 12; app.sound.bloom && app.sound.bloom(); app.hud.toast(`laid to rest${h ? ' · ' + hauntName(h.id) : ''}`, '☍'); return;
    }
    this.devoured++; app.hud.toast(`${C.species ? C.species.name : 'Rival'} devoured`, '✦'); F && F.crown.joy();
  }
  post(dt, W) {
    if (this.finished || this.over) return;
    { const F = W.player.focus; if (F && F.alive) { this.lastPos = [F.B.cx, F.B.cy]; this.peak = Math.max(this.peak || 0, W.player.mass); } this.markLoss(W); }
    if (this.coop && this.p2 && !this.p2.orgs.some(o => o.alive)) { this.embers--; if (this.embers <= 0) { this.end(); return; } const F = W.player.focus; const sp = F && F.alive ? { x: F.B.cx + 60, y: F.B.cy } : W.spec.spawn; this.p2.spawn(sp.x, sp.y, 26); this.app.sound.bloom(); this.app.hud.toast(`tide rekindled · ${this.embers} left`, '✺', 'cool'); }
    if (!W.player.orgs.some(o => o.alive)) {
      this.embers--;
      if (this.embers <= 0) { this.end(); return; }
      const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, 26, this.T.mat ?? MAT.LUMEN); W.fx.ring(sp.x, sp.y, [1, 0.8, 0.6], 140, 0.9); this.app.sound.bloom(); this.app.hud.toast(`rekindled · ${this.embers} ember${this.embers === 1 ? '' : 's'} left`, '✺');
    }
  }
  frame() {
    const app = this.app, W = app.world; if (this.finished || this.over || app.state !== 'play' && app.state !== 'in') return;
    const pore = W.ents.find(e => e.d.type === 'pore'); const s = W.stats;
    app.hud.setTop({ light: this.spec.arena ? this.rivalsAlive(W) : s.motes, total: this.spec.arena ? 0 : s.motesTotal, quota: pore ? pore.need : 0, extra: `${this.coop && this.p2 ? `<span style="color:#7fe6ff">● ${this.p2.mass}</span> &nbsp; ` : ''}depth ${this.depth} &nbsp; ${'●'.repeat(this.embers)}<span style="opacity:.3">${'●'.repeat(Math.max(0, 3 - this.embers))}</span>${this.spec.arena ? ' &nbsp; to devour' : ''}` });
  }
  complete(pore) {
    if (this.finished) return; this.finished = true; const app = this.app, W = app.world;
    this.mass = W.player.mass; this.depth++; if (this.p2) this.mass2 = this.p2.mass;
    const F = W.player.focus; if (F) { F.seek = { x: pore.x, y: pore.y, k: 1500 }; for (const O of W.player.orgs) O.rallyTo = F.B; }
    W.fx.ring(pore.x, pore.y, pore.col, 260, 0.9); W.fx.burst(pore.x, pore.y, 30, [1, 0.9, 0.7], 300, { life: 1, size: 3 });
    app.sound.portal(); app.hud.setTop(null); app.hud.setCorner(false);
    setTimeout(() => { if (app.mode === this) this.load({ x: pore.x, y: pore.y }); }, 550);
  }
  end() {
    this.over = true; const app = this.app, save = app.save; const key = this.daily ? 'dailyBest' : 'abyssBest';
    // what this dive leaves behind: one haunting per depth is kept (the latest), six in all — and it can be handed to anyone as a line of text
    const mine = !this.daily && !this.coop ? this.myHaunt() : null; if (mine) { const list = save.get('haunts', []).filter(q => q.depth !== mine.depth || q.guest); list.push(mine); while (list.filter(q => !q.guest).length > 6) list.splice(list.findIndex(q => !q.guest), 1); save.set('haunts', list); }
    if (this.daily && save.get('dailyDay', '') !== this.day) save.set('dailyBest', 0);       // the day's best is the day's, not all time's
    const key2 = this.coop ? 'coopBest' : key; const score = this.light + this.devoured * 10 + (this.depth - 1) * 15; const prev = save.get(key2, 0); if (score > prev) save.set(key2, score);
    if (this.daily) save.set('dailyDay', new Date().toISOString().slice(0, 10));
    app.sound.boom(); app.hud.setTop(null);
    app.hud.panel(this.daily ? 'The day\'s dive ends' : 'The dive ends', `depth ${this.depth} · ${this.light} light · ${this.devoured} devoured`, [
      { label: 'Dive again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Abyss(app, { daily: this.daily, coop: this.coop })); } },
      { label: 'Copy result', fn: (b) => { const names = this.traits.map(id => (TRAITS.find(t => t.id === id) || {}).name).filter(Boolean);
        app.copyText(`MYRIA · ${this.daily ? `Daily ${this.day} · ${this.axiom.name}` : this.coop ? 'Abyss, together' : 'Abyss'}\ndepth ${this.depth} · ${this.light} light · ${this.devoured} devoured · ✦ ${score}${names.length ? '\n' + names.join(' · ') : ''}`); b.textContent = 'Copied ✓'; } },
      ...(mine ? [{ label: 'Copy my haunting', fn: (b) => { app.copyText(packHaunt(mine)); b.textContent = 'Copied ✓ — give it to someone'; } }] : []),
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div style="font-size:44px;font-weight:200;letter-spacing:.1em;margin:6px 0 2px">${score}</div><div class="sub">${score > prev ? 'a new deepest light' : 'best ' + prev}</div>${mine ? `<div class="sub" style="margin-top:10px;opacity:.75">☍ ${hauntName(mine.id)} now waits at depth ${mine.depth}${this.rested ? ` · ${this.rested} laid to rest` : ''}</div>` : ''}`);
  }
}
