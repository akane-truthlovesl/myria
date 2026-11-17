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
import { Second } from '../core/second.js';

const TINT2 = { id: 'duet2', absorb: [0.95, 0.30, 0.08], emit: [0.35, 0.9, 1.0], glow: 0.62, halo: 0.5 };
const TWIN = 0.8;          // seconds both pads of a door for two must be held together

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
    this.depth = Math.max(1, o.depth | 0 || 1); this.embers = 3; this.T = {}; this.traits = []; this.light = 0; this.devoured = 0; this.mass = Math.max(40, o.mass || 40);
    this.R = rng(this.seed ^ 0x5bd1e995); this.over = false; this.pausable = true;
    this.runId = ((Math.random() * 0x7fffffff) | 0) + 1; this.marks = []; this.rested = 0;
  }
  // (player two — keys, the far half of a shared phone, or a Link — is steered through core/second.js, as in Duet)
  enter() { if (this.coop) { this.two = new Second(this.app); this.two.enter(); } this.load(null); }
  exit() { this.app.hud.hint(''); if (this.two) this.two.exit(); }
  onEvent(e) { if (!this.coop || this.app.state !== 'play' || !this.two) return false; return this.two.onEvent(e); }
  update(dt, W) { if (this.coop && this.p2 && this.two) { if (this.two.C !== this.p2) this.two.attach(this.p2); this.two.update(dt); } if (this.spec && this.spec.twin) this.twins(dt, W); }
  // a door for two: both pads held at once, for a breath, and the seal on the way on breaks for good
  twins(dt, W) {
    if (this.twinOpen) { this.twinT = Math.max(0, this.twinT - dt * 0.6); return; }
    const A = W.entity('twinA'), B = W.entity('twinB'); if (!A || !B) return; this.tw = [A, B];
    if (!this.twinSaid && (A.fill > 0.3 || B.fill > 0.3)) { this.twinSaid = true; if (!this.app.save.get('twinSeen', 0)) { this.app.save.set('twinSeen', 1); this.app.hud.toast('a door for two · hold both at once', '◐', 'cool'); } }
    if (A.on && B.on) { this.twinT = (this.twinT || 0) + dt; if (this.twinT >= TWIN) { this.twinOpen = true; this.twinT = 1.5; const s = this.app.sound; s.open && s.open(); s.chime && (s.chime(4, -0.5), s.chime(11, 0.5)); this.app.haptics.fuse(); for (const P of [A, B]) { W.fx.ring(P.x, P.y, P.col, 160, 0.9); W.fx.burst(P.x, P.y, 18, P.col, 240, { life: 0.8, size: 2.6 }); } for (let k = 1; k < 10; k++) { const t = k / 10; W.fx.burst(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t, 3, [1, 0.95, 0.85], 120, { life: 0.6, size: 2 }); } } }
    else this.twinT = Math.max(0, (this.twinT || 0) - dt * 2);
  }
  overlay(ov, R) {
    if (this.two) this.two.overlay(ov, R);
    // the thread between the two pads: faint while it waits, lit from each end that is held, filling as both are, gone once it has opened the way
    const T = this.spec && this.spec.twin && this.tw; if (!T) return; const [A, B] = T, t = performance.now() / 1000;
    if (this.twinOpen) { if (this.twinT > 0) ov.line(A.x, A.y, B.x, B.y, 2.4, [1, 0.95, 0.85], 0.5 * this.twinT); return; }
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, x0 = A.x + ux * A.r, y0 = A.y + uy * A.r, span = L - A.r - B.r, n = Math.max(6, Math.floor(span / 26));
    for (let k = 0; k < n; k++) { const a = k / n, b = (k + 0.5) / n, mid = (a + b) / 2, lit = (A.on && mid < 0.5) || (B.on && mid >= 0.5), fill = (this.twinT || 0) / TWIN, hot = Math.abs(mid - 0.5) * 2 > 1 - fill;
      const col = hot ? [1, 0.95, 0.85] : mid < 0.5 ? A.col : B.col; ov.line(x0 + ux * span * a, y0 + uy * span * a, x0 + ux * span * b, y0 + uy * span * b, hot ? 2.6 : 1.4, col, hot ? 0.95 : lit ? 0.7 : 0.18 + 0.1 * Math.sin(t * 2 + k * 0.5)); }
    // …and the way on wears a seal until then
    const P = this.app.world.ents.find(e => e.d.type === 'pore'); if (P) for (let k = 0; k < 2; k++) ov.ring(P.x, P.y, P.r + 10 + k * 7, 1.6, k ? B.col : A.col, 0.5, t * (k ? -0.8 : 0.8), t * (k ? -0.8 : 0.8) + Math.PI * 1.2);
  }
  pauseSub() { return `${this.daily ? 'Daily Abyss · ' + this.axiom.name : this.coop ? 'Abyss together · pointer + W A S D / Space / F' : 'Abyss'} · depth ${this.depth}`; }

  load(from) {
    const app = this.app; this.finished = false; this.roomLight = 0;
    app.travel((aspect) => (this.spec = abyssRoom(aspect, this.depth, this.seed, this.axioms, Math.min(260, this.mass), { coop: this.coop })), () => ({ mass: Math.min(260, this.mass), mat: this.T.mat ?? MAT.LUMEN, crown: this.T.crown || 'sun' }), {
      from, minDark: from ? 0.6 : 0.4, hold: () => !this.choosing,
      onDark: () => { app.applyBudget(); if (from && this.depth % 2 === 1 && this.depth > 1) this.choose(); },
      onLoad: (W) => {
        W.speedScale = this.spec.speedScale || 1; W.massCosts = !this.T.freeDart; W.dartSpeed = 600 * (this.T.dart || 1); W.dewReach = this.T.dewReach || 200; W.moteBonus = this.T.moteBonus || 0;
        for (const O of W.player.orgs) { O.speedMul = this.T.speed || 1; O.reachK = this.T.reachK || 1; }
        W.player.orgOpts = { speedMul: this.T.speed || 1 };
        for (const e of W.ents) if (e.d.type === 'pore') e.need = this.spec.arena ? 0 : Math.ceil(W.stats.motesTotal * 0.55);
        if (this.coop) { const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(W.spec.spawn.x + 80, W.spec.spawn.y, Math.min(260, Math.max(40, this.mass2))); W.colonies.push(C); C.ally = W.player.ally = true; }
        this.twinOpen = false; this.twinT = 0; this.tw = null; this.twinSaid = false;
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
    // false lights where it bled — or, where it bled against a wall, by the stain or by the way in, at the nearest clear spot (a haunting with no false light is no haunting)
    const clear = (qx, qy) => P.sampleSDF(qx, qy) > 34 && Math.hypot(qx - x, qy - y) > 110 && Math.hypot(qx - sp.spawn.x, qy - sp.spawn.y) > 130 && !W.ents.some(e => e.d.type === 'mimic' && Math.hypot(e.x - qx, e.y - qy) < 70);
    for (const d of h.dec || []) { const dx = d[0] * sp.W, dy = d[1] * sp.H; let at = clear(dx, dy) ? [dx, dy] : null;
      for (let r = 40; !at && r <= 160; r += 40) for (let k = 0; k < 10 && !at; k++) { const a = k / 10 * 6.2832 + r * 0.01, qx = dx + Math.cos(a) * r, qy = dy + Math.sin(a) * r; if (clear(qx, qy)) at = [qx, qy]; }
      if (at) W.spawn({ type: 'mimic', x: at[0], y: at[1], col: tint.emit }); }
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
  poreReady(p) { const W = this.app.world; if (!this.spec) return false; if (this.spec.arena) return this.rivalsAlive(W) === 0; if (this.spec.twin && !this.twinOpen) return false; return W.stats.motes >= p.need || W.pickups.filter(q => q.isMote && !q.dead).length === 0; }
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
      this.light += 12; app.sound.bloom && app.sound.bloom(); app.hud.toast(`laid to rest${h ? ' · ' + hauntName(h.id) : ''}`, '☍');
      if (app.moment) app.moment('Laid to rest', `${h ? hauntName(h.id) + ', ' : ''}depth ${this.depth}`, h ? 'rest:' + h.id : ''); return;
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
