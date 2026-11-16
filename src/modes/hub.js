// ─────────────────────────────────────────────────────────────────────────────
//  The Atrium — title, opening hook and mode select in one living room.
//  The word MYRIA is written in motes: you wake a sleeping pearl, and it eats
//  the title. Pores lead onward; their names are the only words on screen.
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { ROOMS } from '../world/odyssey.js';
import { moteTrail } from '../world/entities.js';
import { Odyssey } from './odyssey.js';

// stroke font on a 4×6 grid
const GLYPH = {
  M: [[[0, 6], [0, 0], [2, 3.2], [4, 0], [4, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  R: [[[0, 6], [0, 0], [2.8, 0], [4, 1.1], [4, 2.1], [2.8, 3.2], [0, 3.2]], [[2.2, 3.2], [4, 6]]],
  I: [[[2, 0], [2, 6]], [[0.8, 0], [3.2, 0]], [[0.8, 6], [3.2, 6]]],
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4], [3, 4]]],
};
function wordMotes(word, cx, cy, width) {
  const n = word.length; const cell = width / (n * 4 + (n - 1) * 2.2); const out = [];
  const x0 = cx - width / 2, y0 = cy - cell * 3;
  [...word].forEach((ch, k) => {
    const ox = x0 + k * cell * 6.2;
    for (const st of GLYPH[ch]) {
      let len = 0; for (let i = 0; i < st.length - 1; i++) len += Math.hypot(st[i + 1][0] - st[i][0], st[i + 1][1] - st[i][1]);
      const pts = st.map(p => [ox + p[0] * cell, y0 + p[1] * cell]);
      out.push(...moteTrail(pts, Math.max(2, Math.round(len * cell / 17) + 1), 1));
    }
  });
  return out;
}

export class Hub {
  constructor(app, o = {}) { this.app = app; this.o = o; this.isHub = true; this.awake = !!o.result || !!o.awake; this.t = 0; }
  enter() {
    const app = this.app, save = app.save; const cleared = ROOMS.filter(r => save.room(r.id)).length;
    this.next = Math.min(ROOMS.length - 1, ROOMS.findIndex(r => !save.room(r.id)) < 0 ? 0 : ROOMS.findIndex(r => !save.room(r.id)));
    this.dests = [{ id: 'odyssey', name: 'Odyssey', sub: cleared ? `${cleared >= ROOMS.length ? 'all chambers lit' : 'continue · ' + ROOMS[this.next].name} · ${save.stars()} ✦` : 'begin', open: true }];
    for (const d of app.extraModes || []) this.dests.push({ ...d, open: d.unlock ? d.unlock(cleared, save) : true });
    app.travel((aspect) => {
      const { W, H } = frame(aspect); const geo = dish(W, H, { r: Math.min(W, H) * 0.3 });
      const ents = wordMotes('MYRIA', W / 2, H * 0.30, Math.min(W * 0.72, 760));
      const n = this.dests.length; this.pores = [];
      this.dests.forEach((d, k) => { const x = W * (n === 1 ? 0.5 : 0.16 + 0.68 * k / (n - 1)), y = H * (W < H * 1.2 && n > 3 ? (k % 2 ? 0.86 : 0.70) : 0.76); ents.push({ type: 'pore', x, y, r: 40, dest: d.id, col: d.col || (k === 0 ? [1.0, 0.72, 0.5] : [0.45, 0.95, 1.0]) }); });
      return { name: 'Atrium', seed: 3, W, H, geo, ents, spawn: { x: W / 2, y: H * 0.55, n: 14 }, pal: { grid: 0.8 } };
    }, null, {
      minDark: this.o.result ? 2.6 : 0.35,
      onDark: () => { app.applyBudget(); if (this.o.result) app.hud.showResult(this.o.result); },
      onLoad: (W) => { if (!this.awake) for (const O of W.player.orgs) O.dormant = true; this.lettersTotal = W.stats.motesTotal; },
      onReveal: () => { app.hud.hideResult(); app.hud.setCorner(true, () => app.pause()); app.sound.ready && app.sound.ambience('deep', 50); },
    });
  }
  exit() { this.app.hud.setLabels([]); }
  pauseItems() { return [{ label: 'Chambers', fn: () => this.chambers() }]; }
  chambers() {
    const app = this.app, save = app.save;
    const items = ROOMS.map((r, i) => { const rec = save.room(r.id); const open = i === 0 || save.room(ROOMS[i - 1].id) || app.params.has('all'); return { label: `${i + 1} · ${r.name} ${rec ? rec.stars.map(s => (s ? '◆' : '◇')).join('') : ''}`, cls: open ? '' : 'locked', fn: () => { if (!open) return; app.resume(); app.setMode(new Odyssey(app, i, { single: false })); } }; });
    app.hud.panel('Chambers', `${save.stars()} ✦ gathered`, [...items, { label: 'Back', cls: 'pri', fn: () => app.resume() }]);
  }
  wake() {
    if (this.awake) return; this.awake = true; const W = this.app.world;
    for (const O of W.player.orgs) { O.dormant = false; O.crown.joy(); O.excite = 1; W.fx.ring(O.B.cx, O.B.cy, [1, 0.8, 0.6], 160, 1.0); W.fx.burst(O.B.cx, O.B.cy, 14, [1, 0.85, 0.6], 150, { life: 0.9 }); }
    const snd = this.app.sound; snd.init(); if (snd.ready) { snd.bloom(); snd.ambience('deep', 50); }
  }
  onEvent(e) { if (!this.awake && (e.type === 'press' || e.type === 'key')) { this.wake(); return e.type === 'press'; } return false; }
  poreReady(p) { const d = this.dests.find(q => q.id === p.d.dest); return this.awake && d && d.open && (this.app.save.stars() > 0 || this.app.world.stats.motes >= 6 || p.d.dest !== 'odyssey'); }
  poreProgress(p) { const d = this.dests.find(q => q.id === p.d.dest); if (!d || !d.open) return 0; return p.d.dest === 'odyssey' && !this.app.save.stars() ? Math.min(1, this.app.world.stats.motes / 6) : 1; }
  complete(p) {
    const app = this.app, id = p.d.dest; const W = app.world;
    W.fx.ring(p.x, p.y, p.col, 240, 0.8); app.sound.portal();
    const mass = Math.min(60, W.player.mass);
    setTimeout(() => { if (app.mode !== this) return; if (id === 'odyssey') app.setMode(new Odyssey(app, this.next, { mass })); else { const d = this.dests.find(q => q.id === id); if (d && d.start) d.start(app, { mass }); } }, 450);
  }
  frame(dt) {
    const app = this.app, W = app.world, R = app.R; this.t += dt;
    if (!this.awake && app.input.any && app.input.device === 'mouse' && app.input.mouse.inside && this.t > 0.6 && app.state === 'play') this.wake();
    if (app.state !== 'play') { app.hud.setLabels([]); return; }
    const labels = [];
    for (const e of W.ents) { if (e.d.type !== 'pore') continue; const d = this.dests.find(q => q.id === e.d.dest); if (!d) continue; const [x, y] = R.worldToCss(e.x, e.y + e.r + 16); labels.push({ x, y, html: `${d.name}<small>${d.open ? d.sub || '' : d.lock || 'locked'}</small>`, cls: d.open ? '' : 'locked' }); }
    app.hud.setLabels(labels);
  }
}
