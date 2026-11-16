// ─────────────────────────────────────────────────────────────────────────────
//  Abyss — the endless descent. Chambers are generated, neighbours are hungry,
//  and every second chamber you choose how to change. Three embers: lose your
//  whole body and one rekindles you; lose the last and the dive is over.
//  (The Daily Abyss is the same dive on the day's seed, bent by one axiom.)
// ─────────────────────────────────────────────────────────────────────────────
import { abyssRoom, AXIOMS } from '../world/abyss.js';
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

export class Abyss {
  constructor(app, o = {}) {
    this.app = app; this.daily = !!o.daily; this.coop = !!o.coop; this.mass2 = 40;
    const day = new Date().toISOString().slice(0, 10);
    this.seed = this.daily ? hashStr('myria' + day) : (Math.random() * 1e9) | 0;
    this.axiom = this.daily ? AXIOMS[1 + (this.seed % (AXIOMS.length - 1))] : AXIOMS[0];
    this.depth = 1; this.embers = 3; this.T = {}; this.traits = []; this.light = 0; this.devoured = 0; this.mass = Math.max(40, o.mass || 40);
    this.R = rng(this.seed ^ 0x5bd1e995); this.over = false; this.pausable = true;
  }
  enter() { if (this.coop) this.app.input.keysOff = true; this.load(null); }
  exit() { this.app.hud.hint(''); this.app.input.keysOff = false; }
  onEvent(e) { if (!this.coop || this.app.state !== 'play') return false; if (e.type === 'dartKey') { const F = this.p2 && this.p2.focus; if (F && F.alive) F.dart(F.facing.x, F.facing.y, 1); return true; } return e.type === 'budKey' || e.type === 'cycle'; }
  update(dt, W) {
    if (!this.coop || !this.p2) return; const K = this.app.input.keys; let x = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0), y = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0); if (x && y) { x *= 0.707; y *= 0.707; }
    const F = this.p2.focus; if (F && F.alive) { F.intent.x += (x - F.intent.x) * Math.min(1, dt * 20); F.intent.y += (y - F.intent.y) * Math.min(1, dt * 20); F.swell = K.has('KeyF'); }
    for (const O of this.p2.orgs) if (O !== F && F) { O.rallyTo = F.B; O.B.fuseT = Math.min(O.B.fuseT, 0.05); }
  }
  pauseSub() { return `${this.daily ? 'Daily Abyss · ' + this.axiom.name : this.coop ? 'Abyss together · pointer + W A S D / Space / F' : 'Abyss'} · depth ${this.depth}`; }

  load(from) {
    const app = this.app; this.finished = false; this.roomLight = 0;
    app.travel((aspect) => (this.spec = abyssRoom(aspect, this.depth, this.seed, this.axiom, Math.min(260, this.mass))), () => ({ mass: Math.min(260, this.mass), mat: this.T.mat ?? MAT.LUMEN, crown: this.T.crown || 'sun' }), {
      from, minDark: from ? 0.6 : 0.4, hold: () => !this.choosing,
      onDark: () => { app.applyBudget(); if (from && this.depth % 2 === 1 && this.depth > 1) this.choose(); },
      onLoad: (W) => {
        W.speedScale = this.spec.speedScale || 1; W.massCosts = !this.T.freeDart; W.dartSpeed = 600 * (this.T.dart || 1); W.dewReach = this.T.dewReach || 200; W.moteBonus = this.T.moteBonus || 0;
        for (const O of W.player.orgs) { O.speedMul = this.T.speed || 1; O.reachK = this.T.reachK || 1; }
        W.player.orgOpts = { speedMul: this.T.speed || 1 };
        for (const e of W.ents) if (e.d.type === 'pore') e.need = this.spec.arena ? 0 : Math.ceil(W.stats.motesTotal * 0.55);
        if (this.coop) { const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(W.spec.spawn.x + 80, W.spec.spawn.y, Math.min(260, Math.max(40, this.mass2))); W.colonies.push(C); C.ally = W.player.ally = true; }
        const echo = app.save.get('echo', null);      // an echo of an earlier dive: the light you lost here is still here
        if (echo && echo.depth === this.depth && !this.daily) { const ex = echo.u * W.spec.W, ey = echo.v * W.spec.H; if (W.phys.sampleSDF(ex, ey) > 20) { for (let k = 0; k < 6; k++) W.spawn({ type: 'mote', x: ex + Math.cos(k) * 22, y: ey + Math.sin(k) * 22, value: 4, free: true, col: [0.86, 0.72, 1] }); this.echoAt = [ex, ey]; app.save.set('echo', null); } }
      },
      onReveal: () => { if (this.coop && this.depth === 1) app.hud.toast('touch to share mass · pointer + W A S D', '◌', 'cool'); if (this.echoAt) { app.hud.toast('an echo of you', '◌', 'cool'); this.echoAt = null; } app.hud.showTitle(this.daily ? this.axiom.name : '', this.spec.arena ? 'Predator Dish' : `Depth ${this.depth}`, this.spec.arena ? 'devour them all' : (this.depth === 1 && this.daily ? this.axiom.sub : ''), 2.4); app.hud.setCorner(true, () => app.pause()); },
    });
  }
  // every second chamber: three ways to change
  choose() {
    const app = this.app; this.choosing = true;
    const pool = TRAITS.filter(t => !this.traits.includes(t.id) && !(this.T.mat !== undefined && ['bastion', 'silver', 'thorn'].includes(t.id)));
    const opts = this.R.shuffle(pool.slice()).slice(0, 3);
    app.hud.panel('Change', 'the dark asks what you will become', opts.map(t => ({ label: `${t.name}<br><small style="opacity:.6;letter-spacing:.1em;text-transform:none">${t.sub}</small>`, fn: () => { t.on(this); this.traits.push(t.id); app.sound.morph(); app.hud.closePanel(); this.choosing = false; } })));
  }

  // ── world listener ────────────────────────────────────────────────────
  rivalsAlive(W) { return W.colonies.filter(C => C.kind && C.kind !== 'oil' && C.kind !== 'thorn' && C.orgs.some(o => o.alive && o.B.count >= 14)).length; }
  poreReady(p) { const W = this.app.world; if (this.spec.arena) return this.rivalsAlive(W) === 0; return W.stats.motes >= p.need || W.pickups.filter(q => q.isMote && !q.dead).length === 0; }
  poreProgress(p) { const W = this.app.world; if (this.spec.arena) return 0; return p.need ? Math.min(1, W.stats.motes / p.need) : 1; }
  tier(name) { this.app.hud.toast(name, '✺'); }
  ember(on) { this.app.hud.toast(on ? 'ember — nothing can drink you · light counts double' : 'whole again', '✺', on ? '' : 'cool'); }
  mote(m, O, chain) { this.light++; this.roomLight++; if (chain && chain % 8 === 0) this.app.hud.toast(`Chain ×${chain}`, '♪', 'cool'); }
  cleave() { if (!this.cleft) { this.cleft = true; this.app.hud.toast('Cleave', '✦'); } }
  devour(C) { this.devoured++; this.app.hud.toast(`${C.species ? C.species.name : 'Rival'} devoured`, '✦'); this.app.world.player.focus && this.app.world.player.focus.crown.joy(); }
  post(dt, W) {
    if (this.finished || this.over) return;
    { const F = W.player.focus; if (F && F.alive) this.lastPos = [F.B.cx, F.B.cy]; }
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
    { const W = app.world; save.set('echo', { depth: this.depth, u: this.lastPos ? this.lastPos[0] / W.spec.W : 0.5, v: this.lastPos ? this.lastPos[1] / W.spec.H : 0.5 }); }
    const key2 = this.coop ? 'coopBest' : key; const score = this.light + this.devoured * 10 + (this.depth - 1) * 15; const prev = save.get(key2, 0); if (score > prev) save.set(key2, score);
    if (this.daily) save.set('dailyDay', new Date().toISOString().slice(0, 10));
    app.sound.boom(); app.hud.setTop(null);
    app.hud.panel(this.daily ? 'The day\'s dive ends' : 'The dive ends', `depth ${this.depth} · ${this.light} light · ${this.devoured} devoured`, [
      { label: 'Dive again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Abyss(app, { daily: this.daily, coop: this.coop })); } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div style="font-size:44px;font-weight:200;letter-spacing:.1em;margin:6px 0 2px">${score}</div><div class="sub">${score > prev ? 'a new deepest light' : 'best ' + prev}</div>`);
  }
}
