// ─────────────────────────────────────────────────────────────────────────────
//  Myriad — the last room has no door.
//  Everything you met on the way is here, and nothing here is hungry. You are
//  full of light: move, and it falls from you; they come and drink; and what
//  drinks enough of you takes your colour. When all of them wear it they come
//  home — and the one who began as a pearl asleep under a word is, at last,
//  what the word said: many.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { TAU } from '../core/util.js';
import { MAT, MATS } from '../sim/materials.js';
import { Brain } from '../life/brains.js';
import { ROOMS } from '../world/odyssey.js';
import { SKINS, unlockedSkins } from '../core/skins.js';

// the first room's water, with the sun in it
export const DAWN = { deep: [0.020, 0.066, 0.096], mid: [0.085, 0.250, 0.300], pool: [0.640, 0.500, 0.260], wall: [0.110, 0.270, 0.320], rim: [1.00, 0.94, 0.78], accent: [1.0, 0.82, 0.50] };
const CAST = [['grazer', 18], ['puffer', 20], ['grazer', 13], ['hunter', 26], ['thorn', 22], ['grazer', 20], ['puffer', 15], ['hunter', 22], ['grazer', 12], ['grazer', 16], ['puffer', 18]];
const TURN = 6, FLOOR = 44, NOBODY = -7;

// a neighbour with nothing to fear: it follows fallen light, and failing that, keeps you company
class Pilgrim extends Brain {
  constructor(rec, kind) { super(kind); this.rec = rec; this.sign = Math.random() < 0.5 ? -1 : 1; this.lag = 0.6 + Math.random() * 0.8; }
  think(O, dt) {
    const W = O.W, B = O.B, rec = this.rec; this.t += dt; let ix = 0, iy = 0;
    let best = null, bd = 560; if (!rec.turned) for (const p of W.pickups) { if (p.dead || p.held || !p.d.mine || p.spawnT < 0.3) continue; const d = Math.hypot(p.x - B.cx, p.y - B.cy); if (d < bd) { bd = d; best = p; } }
    const F = W.player && W.player.focus;
    if (best) { ix = (best.x - B.cx) / (bd + 1); iy = (best.y - B.cy) / (bd + 1); this.state = 'graze'; if (bd < B.r * 0.9 + best.r + 4) best.absorb(O, null); }
    else if (F && F.alive) {
      // company: a loose ring around you while they are strangers, a close procession once they are you
      const dx = F.B.cx - B.cx, dy = F.B.cy - B.cy, d = Math.hypot(dx, dy) + 1; const want = F.B.r + B.r + (rec.turned ? 34 + 40 * this.lag : 150);
      const e = Math.max(-1, Math.min(1, (d - want) / 90)); const sw = rec.turned ? 0.55 : 0.3;
      ix = dx / d * e - dy / d * sw * this.sign; iy = dy / d * e + dx / d * sw * this.sign; this.state = 'wander';
    }
    const sd = W.phys.sampleSDF(B.cx + ix * 60, B.cy + iy * 60); if (sd < B.r * 0.6) { const n = W.phys.sdfNormal(B.cx, B.cy, N2); ix += n[0] * 0.9; iy += n[1] * 0.9; }
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    O.intent.x += (ix - O.intent.x) * Math.min(1, dt * 4); O.intent.y += (iy - O.intent.y) * Math.min(1, dt * 4);
  }
}
const N2 = [0, 0];

export class Epilogue {
  constructor(app, o = {}) { this.app = app; this.mass = Math.max(150, Math.min(200, o.mass || 170)); this.result = o.result || null; this.t = 0; this.phase = 0; this.cast = []; this.next = 1.6; this.shedT = 0; this.turned = 0; this.pT = 0; this.pausable = true; this.isEpilogue = true; }
  enter() {
    const app = this.app;
    app.travel((aspect) => { const { W, H } = frame(aspect); return { name: 'Myriad', seed: 404, W, H, geo: dish(W, H, { r: Math.min(W, H) * 0.34 }), ents: [], spawn: { x: W / 2, y: H / 2, n: this.mass }, pal: DAWN, cap: 520, decor: 1.0 }; }, null, {
      minDark: this.result ? 2.6 : 0.5,
      onDark: () => { app.applyBudget(); if (this.result) app.hud.showResult(this.result); },
      onLoad: (W) => { W.massCosts = false; W.peace = true; W.dewReach = 320; },
      onReveal: () => { app.hud.hideResult(); app.hud.setTop(null); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('epilogue'); },
    });
  }
  exit() { this.app.hud.closePanel(); }
  restart() { this.app.setMode(new Epilogue(this.app, { mass: this.mass })); }
  pauseSub() { return 'Myriad'; }
  hue(W) { const t = W.player.tint; return t ? t.emit : MATS[MAT.LUMEN].emit; }

  // a neighbour drank light that was yours
  moteLost(m, O) { if (!m.d.mine) return; const rec = this.cast.find(r => r.C === O.colony); if (!rec || rec.turned) return; rec.fed++; O.joyT = 0.5; this.app.sound.mote((m.x / this.app.world.spec.W) * 1.6 - 0.8, rec.fed + this.turned * 2); if (rec.fed >= TURN) this.turn(rec); }
  turn(rec) {
    const W = this.app.world, C = rec.C, tint = W.player.tint, col = this.hue(W); rec.turned = true; this.turned++;
    C.tint = tint; C.crown = 'sun';
    for (const O of C.orgs) { if (!O.alive) continue; O.B.tint = tint; O.crownKind = 'sun'; O.crown.kind = 'sun'; O.canSwell = false; O.crown.joy(); W.morph(O.B, MAT.LUMEN, null); O.B.tint = tint; W.fx.ring(O.B.cx, O.B.cy, col, 150, 0.9); W.fx.burst(O.B.cx, O.B.cy, 14, col, 220, { size: 2.8, life: 0.9, drag: 1.8 }); }
    this.app.sound.star(Math.min(2, (this.turned - 1) % 3)); this.app.haptics.tick && this.app.haptics.tick(); W.hitStop = 0.05;
  }

  post(dt, W) {
    this.t += dt; const pl = W.player, F = pl && pl.focus, R = this.app.world.rand; if (!F || !F.alive) return;
    if (this.phase === 0) {
      // they arrive one at a time, from the rim
      this.next -= dt;
      if (this.next <= 0 && this.cast.length < CAST.length) {
        const k = this.cast.length, [kind, n] = CAST[k]; const a = k * 2.4 + 0.7, cx = W.spec.W / 2, cy = W.spec.H / 2; const x = cx + Math.cos(a) * (cx - 90), y = cy + Math.sin(a) * (cy - 90);
        const C = W.addRival(kind, x, y, n); const rec = { C, fed: 0, turned: false }; for (const O of C.orgs) O.brain = new Pilgrim(rec, kind); this.cast.push(rec);
        W.fx.ring(x, y, C.species.tint ? C.species.tint.emit : [1, 1, 1], 90, 0.7); this.next = k < 2 ? 3.4 : 2.5;
      }
      // light falls from you as you move — never below what you began the whole journey with
      const sp = Math.hypot(F.B.vx, F.B.vy); const hungry = this.cast.some(r => !r.turned); let live = 0; for (const p of W.pickups) if (p.d.mine && !p.dead) live++;
      if (sp > 60 && hungry && pl.mass > FLOOR && live < 16 && this.cast.length) {
        this.shedT += dt * Math.min(1.6, sp / 160);
        if (this.shedT > 0.27) { this.shedT = 0; this.drop(W, F, sp); }
      }
      for (const r of this.cast) if (!r.turned && r.C.orgs.length && r.C.orgs.some(o => o.alive && o.brain && !(o.brain instanceof Pilgrim))) for (const O of r.C.orgs) if (!(O.brain instanceof Pilgrim)) O.brain = new Pilgrim(r, r.C.kind);
      // nobody is left out: if you have nothing more to give, the last strangers turn by themselves
      const spent = pl.mass <= FLOOR + 1 && live === 0;
      if (this.cast.length === CAST.length && (spent || this.t > 150)) { this.pT += dt; if (this.pT > 1.2) { this.pT = 0; const r = this.cast.find(q => !q.turned); if (r) this.turn(r); } }
      if (this.cast.length === CAST.length && this.cast.every(r => r.turned)) { this.phase = 1; this.pT = 0; this.gT = 0; for (const p of W.pickups) if (p.d.mine) p.owner = null; }      // what nobody drank comes back to you
    } else if (this.phase === 1) {
      // a breath — then they come home
      this.pT += dt;
      if (this.pT > 1.4 && !this.joined) {
        this.joined = true; const P = W.phys;
        for (const r of this.cast) { for (const O of r.C.orgs) { if (!O.alive) continue; const B = O.B; O.dead = true; B.ctrl = null; B.kind = 'fragment'; const S = pl.adopt(B); S.phi = O.phi; B.fuseT = 0; } r.C.orgs = []; }
        void P; this.app.sound.bloom(); W.flash = 0.5;
      }
      if (this.joined) { W.callHome = 0.5; this.gT += dt; if (pl.orgs.filter(o => o.alive).length <= 1 || this.gT > 9) { this.phase = 2; this.pT = 0; this.finale(W); } }
    } else if (this.phase === 2) {
      this.pT += dt; W.callHome = 0.5;
      if (this.pT > 0.5 && this.pT < 3.2 && Math.floor(this.pT * 4) !== Math.floor((this.pT - dt) * 4)) { const a = R() * TAU, d = 60 + R() * 220; W.fx.ring(F.B.cx + Math.cos(a) * d, F.B.cy + Math.sin(a) * d, this.hue(W), 60 + R() * 80, 0.8); }
      if (this.pT > 3.4 && !this.carded) { this.carded = true; this.card(); }
    }
  }
  // one grain of you becomes a mote behind you
  drop(W, F, sp) {
    const P = W.phys, B = F.B; const ux = B.vx / sp, uy = B.vy / sp; let bi = -1, bs = 1e9;
    for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (!P.alive[i] || P.body[i] !== B.id) continue; const s = (P.x[i] - B.cx) * ux + (P.y[i] - B.cy) * uy; if (s < bs) { bs = s; bi = i; } }
    if (bi < 0) return; const x = P.x[bi], y = P.y[bi]; P.kill(bi);
    W.spawn({ type: 'mote', x, y, vx: -ux * 50 + (Math.random() - 0.5) * 60, vy: -uy * 50 + (Math.random() - 0.5) * 60, free: true, gift: true, mine: true, owner: NOBODY, value: 2, ttl: 40, col: this.hue(W) });
  }
  finale(W) {
    const app = this.app, F = W.player.focus, col = this.hue(W); app.save.set('awake', 1);
    W.flash = 1; W.hitStop = 0.14; W.shake = 0.6; for (const O of W.player.orgs) O.crown.joy();
    for (let k = 0; k < 4; k++) W.fx.ring(F.B.cx, F.B.cy, k % 2 ? [1, 1, 1] : col, 180 + k * 150, 1.0 + k * 0.25);
    W.fx.burst(F.B.cx, F.B.cy, 60, col, 460, { size: 3.4, life: 1.6, drag: 1.4 }); app.sound.portal(); app.sound.prism(); app.haptics.fuse && app.haptics.fuse();
    app.moment && app.moment('Myriad', 'the last room: everyone came home', 'myriad');
  }
  card() {
    const app = this.app, save = app.save; const lit = ROOMS.filter(r => save.room(r.id)).length; const tricks = Object.keys(save.data.tricks || {}).length; const hues = unlockedSkins(save).length;
    const stat = (v, l) => `<div class="ep-stat"><b>${v}</b><span>${l}</span></div>`;
    app.hud.panel('M Y R I A', 'the slide is awake &nbsp;·&nbsp; you are many', [
      { label: 'Stay a while', fn: () => { app.hud.closePanel(); } },
      { label: 'Return to the Atrium', cls: 'pri', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } },
    ], `<div class="ep-stats">${stat(`${save.stars()}<small> / ${ROOMS.length * 3}</small>`, 'stars')}${stat(`${lit}<small> / ${ROOMS.length}</small>`, 'chambers')}${stat(tricks, 'tricks found')}${stat(`${hues}<small> / ${SKINS.length}</small>`, 'hues')}</div>`);
  }
  frame() {}
}
