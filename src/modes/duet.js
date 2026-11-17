// ─────────────────────────────────────────────────────────────────────────────
//  Duet — two creatures, one dish: a match of short games, first to two.
//  Ember is played with the pointer (or the near half of a shared phone); Tide
//  with the keys (W A S D · Space · F), the far half of the phone, the far end of
//  a Link — or, when you are alone, by a neighbour the machine plays (with a
//  player's verbs and a player's limits).
//    Rain  · light rains into the dish; the larger membrane drinks the smaller
//    Crown · a crown of light wanders the dish; hold it alone and it fills with you
//    Spark · a touch passes the spark; whoever holds it when time runs out loses
//    Race  · a short course with a way out at the end; first one home
// ─────────────────────────────────────────────────────────────────────────────
import { frame, dish } from '../world/rooms.js';
import { SURF } from '../sim/materials.js';
import { Colony } from '../life/colony.js';
import { Nav } from '../core/nav.js';
import { buildChamber } from '../world/workshop.js';
import { layout } from '../world/odyssey.js';
import { Second } from '../core/second.js';
import { exposure } from '../ui/exposure.js';
import { TRICKS } from './odyssey.js';

const TINT2 = { id: 'duet2', absorb: [0.95, 0.30, 0.08], emit: [0.35, 0.9, 1.0], glow: 0.62, halo: 0.5 };
const EMBER = [1, 0.64, 0.38], TIDE = [0.42, 0.9, 1], NAMES = ['Ember', 'Tide'], CSS = ['#ffb48a', '#7fe6ff'];
const PAL = { deep: [0.012, 0.022, 0.05], mid: [0.04, 0.07, 0.14], wall: [0.07, 0.10, 0.18], rim: [0.6, 0.8, 1] };
export const GAMES = [
  { id: 'rain', name: 'Rain', rule: 'drink the light · the larger drinks the smaller', len: 45 },
  { id: 'crown', name: 'Crown', rule: 'hold the crown alone · it fills with your colour, and it is shy', len: 60 },
  { id: 'spark', name: 'Spark', rule: 'a touch passes the spark · it burns: whoever holds it runs hot · do not be holding it at the end', len: 40 },
  { id: 'race', name: 'Race', rule: 'touch the far light, then first one home', len: 75 },
];
const FILL = 10;              // seconds of holding the crown alone that win it
const HOLD = 3, HOP = 0.7;    // the crown is shy: held three seconds straight (or fought over for two) it hops across the dish
// the courses, written in the Workshop's own terms (world/workshop.js: along/across 0‥1000), so they run the long way in any window.
// Ember starts at `start`, Tide at its mirror image across the middle; the way home (the pore) waits between them, the light to touch at `far`.
export const COURSES = [
  { name: 'the Weir', far: [915, 500], D: { pal: 0, down: -1, start: [95, 260], mass: 50, pore: [95, 500], items: [
    ['w', 0, 280, 0, 280, 600], ['w', 0, 500, 1000, 500, 400], ['w', 0, 720, 0, 720, 600],
    ['cu', 390, 800, 0], ['cu', 610, 200, 3142], ['cu', 830, 800, 0],
    ['l', 390, 560, 430, 520], ['l', 610, 440, 650, 480], ['l', 830, 560, 860, 520]] } },
  { name: 'the Gauntlet', far: [915, 500], D: { pal: 1, down: -1, start: [95, 260], mass: 50, pore: [95, 500], items: [
    ['w', 1, 330, 0, 330, 240], ['w', 1, 330, 1000, 330, 760], ['bl', 330, 500],
    ['bl', 600, 255], ['bl', 600, 745], ['w', 1, 600, 430, 600, 570],
    ['gr', 800, 500],
    ['l', 470, 360, 470, 640], ['l', 720, 380, 730, 500, 720, 620]] } },
  { name: 'the Slings', far: [915, 500], D: { pal: 2, down: -1, start: [95, 260], mass: 50, pore: [95, 500], items: [
    ['bd', 260, 860, 5498], ['bd', 260, 140, 785], ['bd', 560, 860, 5498], ['bd', 560, 140, 785], ['bd', 850, 860, 3927], ['bd', 850, 140, 2356],
    ['w', 0, 410, 330, 410, 670], ['w', 0, 710, 330, 710, 670],
    ['l', 260, 380, 260, 500, 260, 620], ['l', 560, 380, 560, 500, 560, 620]] } },
];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Duet {
  // o.ai: the machine plays Tide · o.first: the game to open with
  constructor(app, o = {}) {
    this.app = app; this.o = o; this.ai = !!o.ai; this.score = [0, 0]; this.round = 0; this.p2 = null; this.two = new Second(app); this.over = true; this.t = 0; this.st = {}; this.races = 0;
    const ids = shuffle(GAMES.map(g => g.id)); if (o.first && ids.includes(o.first)) { ids.splice(ids.indexOf(o.first), 1); ids.unshift(o.first); }
    this.deck = ids; this.course = Math.floor(Math.random() * COURSES.length);
  }
  get game() { return GAMES.find(g => g.id === this.deck[(this.round - 1) % this.deck.length]) || GAMES[0]; }
  enter() { this.two.enter(); this.next(null); }
  exit() { this.two.exit(); }
  pauseSub() { return `Duet · round ${this.round} · ${this.game.name} · ${NAMES[0]} ${this.score[0]} · ${this.score[1]} ${NAMES[1]}${this.ai ? ' (the machine)' : ''}`; }

  // ── a round: the dish (or the course), both creatures, and the round's own state ──
  next(card) {
    const app = this.app; this.round++; const G = this.game; this.over = true; this.p2 = null;
    app.travel((aspect) => this.build(G.id, aspect), { mass: G.id === 'rain' ? 40 : 50 }, {
      minDark: card ? 2.8 : 0.5,
      onDark: () => { app.applyBudget(); if (card) app.hud.showResult(card); },
      onLoad: (W) => this.begin(W),
      onReveal: () => {
        app.hud.hideResult(); app.hud.showTitle(`round ${this.round}`, G.name, G.id === 'race' ? `${G.rule} · ${COURSES[this.courseNow].name}` : G.rule, 2.8); app.hud.setCorner(true, () => app.pause()); app.sound.ambience('duet');
        if (this.round === 1 && !this.ai && app.input.device === 'touch') app.hud.toast('two on one glass · a half each', '◐', 'cool');
      },
    });
  }
  // where each creature wakes: either end of a wide dish; the bottom (Ember) and the top (Tide) of a tall one — as two people hold one phone
  spawns(W, H) { return W >= H ? [{ x: W * 0.25, y: H * 0.5 }, { x: W * 0.75, y: H * 0.5 }] : [{ x: W * 0.5, y: H * 0.75 }, { x: W * 0.5, y: H * 0.25 }]; }
  build(id, aspect) {
    if (id === 'race') {
      this.courseNow = (this.course + this.races) % COURSES.length; const C = COURSES[this.courseNow], f = layout(aspect), s = buildChamber(C.D, aspect, false);
      const b = f.P(C.D.start[0] / 1000, 1 - C.D.start[1] / 1000), c = f.P(C.far[0] / 1000, C.far[1] / 1000); this.start2 = { x: b.x, y: b.y }; this.far = { x: c.x, y: c.y }; s.name = 'Race'; s.minMass = 0; return s;
    }
    const { W, H } = frame(aspect), land = W >= H, at = (u, v) => (land ? { x: u * W, y: v * H } : { x: v * W, y: u * H });
    const geo = dish(W, H, { r: Math.min(W, H) * 0.3 });
    if (id === 'rain') geo.push({ op: 'add', t: 'circle', x: W / 2, y: H / 2, r: 46, mat: SURF.GLASS });
    if (id === 'crown') for (const v of [0.2, 0.8]) geo.push({ op: 'add', t: 'circle', ...at(0.5, v), r: 34, mat: SURF.GLASS });
    if (id === 'spark') for (const [u, v] of [[0.38, 0.34], [0.62, 0.34], [0.5, 0.7]]) geo.push({ op: 'add', t: 'circle', ...at(u, v), r: 40 });
    const sp = this.spawns(W, H);
    return { name: this.game.name, seed: 21 + this.round, W, H, geo, ents: [], spawn: { x: sp[0].x, y: sp[0].y, n: 40 }, pal: PAL };
  }
  begin(W) {
    const G = this.game, sp = G.id === 'race' ? [W.spec.spawn, this.start2] : this.spawns(W.spec.W, W.spec.H);
    const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(sp[1].x, sp[1].y, G.id === 'rain' ? 40 : 50); W.colonies.push(C); W.massCosts = true; this.two.attach(C);
    this.brain = this.ai ? new Neighbour(this) : null; this.over = false; this.t = G.len; this.rain = 0; this.recs = [[], []]; this.recT = 0;
    // ready…: both asleep while the round's name is read, then woken together (the machine reads no faster than you do)
    this.hold = 1.7; for (const Q of [W.player, C]) for (const O of Q.orgs) O.dormant = true;
    if (G.id === 'crown') this.st = { x: W.spec.W / 2, y: W.spec.H / 2, hx: W.spec.W / 2, hy: W.spec.H / 2, r: 74, fill: [0, 0], beat: [0, 0], who: 0, tt: 0, streak: 0, contest: 0, hop: 0, from: null, to: null };
    else if (G.id === 'spark') { const [a, b] = this.score; this.st = { holder: a > b ? 1 : b > a ? 2 : 1 + Math.floor(Math.random() * 2), immune: 1.5, tick: 0 }; }
    else if (G.id === 'race') { this.races++; this.st = { pore: W.ents.find(e => e.d.type === 'pore'), far: this.far, touched: [false, false] }; }
    else this.st = {};
  }
  // the way home wakes once someone has touched the far light
  poreReady() { return !this.over && this.game.id === 'race' && this.st.touched && this.st.touched.some(Boolean); }

  // ── the round, frame by frame ──
  update(dt, W) {
    if (!this.p2) return;
    this.two.update(dt, this.brain && this.hold <= 0 ? this.brain.step(dt, W, this.p2, W.player) : null);
    if (this.over) return;
    if (this.hold > 0) {
      this.hold -= dt; if (this.hold > 0) return;
      for (const [Q, col] of [[W.player, EMBER], [this.p2, TIDE]]) for (const O of Q.orgs) { O.dormant = false; if (O.alive) W.fx.ring(O.B.cx, O.B.cy, col, 90, 0.8); }
      this.app.sound.chime(7, 0); this.app.haptics.tick();
    }
    const G = this.game; this.t -= dt;
    // both paths, ten times a second, for the round's long exposure
    if ((this.recT += dt) >= 0.1 && this.recs[0].length < 900) { this.recT -= 0.1; const sp = W.spec, land = sp.W >= sp.H; [W.player, this.p2].forEach((C, k) => { const F = C.focus; if (F && F.alive) this.recs[k].push(land ? [F.B.cx / sp.W, F.B.cy / sp.H] : [F.B.cy / sp.H, F.B.cx / sp.W]); }); }
    if (G.id === 'rain' || G.id === 'crown') this.rainOn(dt, W, G.id === 'rain' ? 0.35 : 1.1, G.id === 'rain' ? 26 : 10);
    if (G.id === 'crown') this.crown(dt, W); else if (G.id === 'spark') this.spark(dt, W); else if (G.id === 'race') this.race(W);
    if (!this.over && this.t <= 0) this.finish(this.verdict(W));
  }
  rainOn(dt, W, every, most) {
    this.rain -= dt; if (this.rain > 0 || W.pickups.length >= most) return; this.rain = every;
    for (let k = 0; k < 20; k++) { const px = 90 + Math.random() * (W.spec.W - 180), py = 90 + Math.random() * (W.spec.H - 180); if (W.phys.sampleSDF(px, py) > 30) { W.spawn({ type: 'mote', x: px, y: py, free: true, value: Math.random() < 0.15 ? 5 : 2 }); break; } }
  }
  // (a real share of you — fourteen grains — is you; a splash is not)
  bodies(C) { return C.orgs.filter(o => o.alive && o.B.count >= 14); }
  crown(dt, W) {
    const s = this.st, w = W.spec.W; s.tt += dt;
    if (s.hop > 0) {          // in the air: a small arc of light to its new place, held by nobody
      s.hop -= dt; const k = 1 - Math.max(0, s.hop) / HOP, e = k * k * (3 - 2 * k);
      s.x = s.from.x + (s.to.x - s.from.x) * e; s.y = s.from.y + (s.to.y - s.from.y) * e - Math.sin(k * Math.PI) * 70; s.who = 0;
      if (s.hop <= 0) { s.hx = s.x = s.to.x; s.hy = s.y = s.to.y; W.fx.ring(s.x, s.y, [1, 0.94, 0.78], s.r * 1.6, 0.8); this.app.sound.chime(12, s.x / w * 1.6 - 0.8); }
      return;
    }
    s.x = s.hx + Math.sin(s.tt * 0.5) * 20; s.y = s.hy + Math.sin(s.tt * 0.71) * 14;          // it breathes where it sits
    const inside = (C) => this.bodies(C).some(o => Math.hypot(o.B.cx - s.x, o.B.cy - s.y) < s.r);
    const p = inside(W.player), q = inside(this.p2); s.who = p && q ? 3 : p ? 1 : q ? 2 : 0;
    if (s.who === 1 || s.who === 2) {
      const k = s.who - 1; s.fill[k] += dt; s.streak += dt; s.contest = 0; const sec = Math.floor(s.fill[k]);
      if (sec > s.beat[k]) { s.beat[k] = sec; this.app.sound.chime(sec + (k ? 7 : 0), s.x / w * 1.6 - 0.8); this.app.haptics.tick(); }
      if (s.fill[k] >= FILL) { this.finish(s.who); return; }
      if (s.streak >= HOLD) this.hopCrown(W);
    } else if (s.who === 3) { s.contest += dt; s.streak = 0; if (s.contest >= 2) this.hopCrown(W); }
    else { s.streak = 0; s.contest = 0; }
  }
  // somewhere open and well away (never next to where it was): the chase begins again
  hopCrown(W) {
    const s = this.st, w = W.spec.W, h = W.spec.H, c = [];
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) { const x = w * i / 7, y = h * j / 7; if (W.phys.sampleSDF(x, y) < 60) continue; c.push({ x, y, d: Math.hypot(x - s.hx, y - s.hy) }); }
    const far = c.filter(q => q.d > 0.36 * Math.hypot(w, h)), L = far.length ? far : c; if (!L.length) return; const q = L[Math.floor(Math.random() * L.length)];
    s.from = { x: s.x, y: s.y }; s.to = { x: q.x, y: q.y }; s.hop = HOP; s.streak = 0; s.contest = 0; s.who = 0;
    W.fx.burst(s.x, s.y, 16, [1, 0.94, 0.78], 240, { life: 0.6, size: 2.4 }); this.app.sound.whoosh();
  }
  spark(dt, W) {
    const s = this.st; s.immune -= dt;
    // the spark burns: whoever holds it runs a little hotter (or a chase between equals would never end in a touch)
    for (const [k, C] of [[1, W.player], [2, this.p2]]) for (const O of C.orgs) O.speedMul = s.holder === k ? 1.2 : 1;
    if (s.immune <= 0) {
      const A = this.bodies(s.holder === 1 ? W.player : this.p2), B = this.bodies(s.holder === 1 ? this.p2 : W.player);
      for (const a of A) for (const b of B) if (Math.hypot(a.B.cx - b.B.cx, a.B.cy - b.B.cy) < (a.B.r + b.B.r) * 0.95) {
        s.holder = 3 - s.holder; s.immune = 1.4; const x = (a.B.cx + b.B.cx) / 2, y = (a.B.cy + b.B.cy) / 2;
        W.fx.ring(x, y, [1, 0.86, 0.5], 110, 0.85); W.fx.burst(x, y, 16, [1, 0.9, 0.6], 260, { life: 0.55, size: 2.4 }); this.app.sound.snap(0.8); this.app.haptics.snap(); return;
      }
    }
    const sec = Math.ceil(this.t); if (sec <= 5 && sec !== s.tick) { s.tick = sec; this.app.sound.tick(); }
  }
  race(W) {
    const s = this.st, P = s.pore, Q = s.far; if (!P || !Q) return;
    for (const [k, C] of [[1, W.player], [2, this.p2]]) for (const o of this.bodies(C)) {
      if (!s.touched[k - 1]) { if (Math.hypot(o.B.cx - Q.x, o.B.cy - Q.y) < 44 + o.B.r * 0.6) { s.touched[k - 1] = true; W.fx.ring(Q.x, Q.y, k === 1 ? EMBER : TIDE, 120, 0.9); W.fx.burst(Q.x, Q.y, 14, k === 1 ? EMBER : TIDE, 220, { life: 0.6, size: 2.4 }); this.app.sound.chime(k === 1 ? 4 : 9, 0); this.app.haptics.tick(); } continue; }
      if (Math.hypot(o.B.cx - P.x, o.B.cy - P.y) < P.r * 0.9 + o.B.r * 0.3) { this.finish(k); return; }
    }
  }
  // time is up: who has it
  verdict(W) {
    const G = this.game, cmp = (a, b) => (a > b ? 1 : b > a ? 2 : 0);
    if (G.id === 'rain') return cmp(W.player.mass, this.p2.mass);
    if (G.id === 'crown') return cmp(Math.round(this.st.fill[0] * 10), Math.round(this.st.fill[1] * 10));
    if (G.id === 'spark') return 3 - this.st.holder;
    const s = this.st, P = s.pore, Q = s.far; if (!P || !Q) return 0;
    const left = (C, k) => Math.min(1e9, ...this.bodies(C).map(o => (s.touched[k] ? 0 : Math.hypot(o.B.cx - Q.x, o.B.cy - Q.y) + Math.hypot(Q.x - P.x, Q.y - P.y)) + (s.touched[k] ? Math.hypot(o.B.cx - P.x, o.B.cy - P.y) : 0)));
    return cmp(-left(W.player, 0), -left(this.p2, 1));
  }
  finish(w) {
    if (this.over) return; this.over = true; const app = this.app, W = app.world; if (w) this.score[w - 1]++;
    const F = w === 1 ? W.player.focus : w === 2 ? this.p2.focus : null;
    // the round in one picture, taken before the celebration: Ember's way warm, Tide's cool, woven over the dish
    this.shot = exposure(app.R, W.spec, null, { zoom: app.hud.k || 1, runs: [{ rec: this.recs[0], from: [1, 0.5, 0.26], to: [1, 0.8, 0.52], home: w === 1 }, { rec: this.recs[1], from: [0.24, 0.62, 1], to: [0.6, 0.95, 1], home: w === 2 }] });
    if (F && F.alive) { W.fx.ring(F.B.cx, F.B.cy, w === 1 ? EMBER : TIDE, 240, 0.9); W.fx.burst(F.B.cx, F.B.cy, 30, w === 1 ? EMBER : TIDE, 300, { life: 1, size: 3 }); }
    app.sound.portal(); app.haptics.fuse(); app.hud.setTop(null);
    const done = Math.max(...this.score) >= 2 || this.round >= 5;
    setTimeout(() => { if (app.mode !== this) return; if (done) this.end(w); else this.next(this.card(w)); }, 1500);
  }
  // between rounds: who took it, the match so far, and what comes next
  pips(k) { const n = this.score[k]; return `<span style="color:${CSS[k]}">${'●'.repeat(n)}<span style="opacity:.25">${'●'.repeat(Math.max(0, 2 - n))}</span></span>`; }
  card(w) {
    const G = this.game, nx = GAMES.find(g => g.id === this.deck[this.round % this.deck.length]);
    return { html: `<div class="r-name">round ${this.round} · ${G.name}</div><div class="d-win" style="color:${w ? CSS[w - 1] : '#dff8ff'}">${w ? NAMES[w - 1] + ' takes it' : 'a draw'}</div>`
      + `<div class="d-score">${this.pips(0)}<i>${NAMES[0]}</i><b>·</b><i>${NAMES[1]}</i>${this.pips(1)}</div><div class="r-next on">next · ${nx.name} — ${nx.rule}</div>`, shot: this.shot };
  }
  end(w) {
    const app = this.app, [a, b] = this.score;
    // against the machine: a record kept (and the first match won is a trick, with the last round's picture in the Album)
    if (this.ai && a !== b) { const rec = app.save.get('duetAI', { w: 0, l: 0 }); if (a > b) rec.w++; else rec.l++; app.save.set('duetAI', rec);
      if (a > b && app.save.trick('Neighbourly')) { app.hud.toast('Neighbourly', '✦'); app.sound.trick(); const T = TRICKS.find(q => q[0] === 'Neighbourly'); if (app.moment) app.moment('Neighbourly', T ? T[1] : '', 'trick:Neighbourly', this.shot); } }
    app.hud.panel(a === b ? 'A perfect tie' : `${NAMES[a > b ? 0 : 1]} takes the match`, `${a} · ${b}${this.ai ? ' · against the machine' : ''}`, [
      { label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Duet(app, { ai: this.ai })); } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `<div class="d-score" style="margin:6px 0 4px">${this.pips(0)}<i>${NAMES[0]}</i><b>·</b><i>${NAMES[1]}</i>${this.pips(1)}</div>${this.ai ? (() => { const r = app.save.get('duetAI', { w: 0, l: 0 }); return `<div class="sub" style="margin-top:8px;opacity:.75">you ${r.w} · the machine ${r.l}</div>`; })() : ''}`);
  }
  onEvent(e) { if (this.app.state !== 'play') return false; return this.two.onEvent(e); }
  post(dt, W) {
    if (!this.p2) return; const sp = this.game.id === 'race' ? [W.spec.spawn, this.start2] : this.spawns(W.spec.W, W.spec.H);
    for (const [k, C] of [[0, W.player], [1, this.p2]]) if (!C.orgs.some(o => o.alive)) { C.spawn(sp[k].x, sp[k].y, 24); W.fx.ring(sp[k].x, sp[k].y, [1, 1, 1], 120, 0.8); }
  }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' || this.over || !this.p2) return; const G = this.game;
    const v = G.id === 'crown' ? this.st.fill.map(q => q.toFixed(1)) : [W.player.mass, this.p2.mass], hold = G.id === 'spark' ? this.st.holder : 0;
    app.hud.setTop({ raw: `<span class="du">${this.pips(0)}<b style="color:${CSS[0]}">${hold === 1 ? '✦ ' : ''}${v[0]}</b><span class="tm">${Math.max(0, Math.ceil(this.t))}</span><b style="color:${CSS[1]}">${v[1]}${hold === 2 ? ' ✦' : ''}</b>${this.pips(1)}</span>` });
  }
  // drawn on the glass: player two's stick; the crown and its two fills; the spark circling whoever holds it
  overlay(ov, R) {
    this.two.overlay(ov, R); const W = this.app.world; if (!this.p2 || this.over && this.game.id === 'spark') return; const G = this.game, t = performance.now() / 1000;
    if (G.id === 'crown' && this.st.hop > 0) {
      const s = this.st; ov.ring(s.to.x, s.to.y, s.r, 1.4, [1, 0.94, 0.78], 0.35); ov.glow(s.x, s.y, 46, [1, 0.92, 0.7], 0.5); ov.glow(s.x, s.y, 14, [1, 1, 0.95], 0.95);
    } else if (G.id === 'crown') {
      const s = this.st, col = s.who === 1 ? EMBER : s.who === 2 ? TIDE : [1, 0.94, 0.78], fl = s.who === 3 ? 0.55 + 0.45 * Math.sin(t * 28) : 1, top = -Math.PI / 2;
      const restless = Math.max(s.streak / HOLD, s.contest / 2), shake = restless > 0.6 ? Math.sin(t * 40) * (restless - 0.6) * 9 : 0;
      ov.glow(s.x, s.y, s.r * 1.3, col, 0.16 * fl); ov.ring(s.x + shake, s.y, s.r * (1 - 0.1 * restless), 2.2, col, 0.75 * fl);
      for (let k = 0; k < 7; k++) { const a = top + (k - 3) * 0.3; ov.glow(s.x + Math.cos(a) * (s.r + 17), s.y + Math.sin(a) * (s.r + 17), k === 3 ? 10 : 7, col, 0.62 * fl); }
      if (s.fill[0] > 0.02) ov.ring(s.x, s.y, s.r + 7, 4.5, EMBER, 0.95, top, top + s.fill[0] / FILL * Math.PI);
      if (s.fill[1] > 0.02) ov.ring(s.x, s.y, s.r + 7, 4.5, TIDE, 0.95, top - s.fill[1] / FILL * Math.PI, top);
    }
    if (G.id === 'spark') {
      const C = this.st.holder === 1 ? W.player : this.p2, F = C && C.focus; if (!F || !F.alive) return;
      const r = F.B.r + 16, hot = this.t < 5.5 ? 0.55 + 0.45 * Math.sin(t * 18) : 1, at = (q) => [F.B.cx + Math.cos(q) * r, F.B.cy + Math.sin(q) * r], a = t * 5.5;
      ov.glow(F.B.cx, F.B.cy, F.B.r * 1.9, [1, 0.62, 0.3], 0.16 * hot);                 // whoever holds it burns
      for (let k = 5; k >= 1; k--) { const [x, y] = at(a - k * 0.16); ov.glow(x, y, 16 - k * 2, [1, 0.8, 0.5], 0.36 - k * 0.055); }
      const [x, y] = at(a); ov.glow(x, y, 38, [1, 0.8, 0.45], 0.55 * hot); ov.glow(x, y, 12, [1, 1, 0.92], 1);
      for (let k = 0; k < 4; k++) { const b = a * 2 + k * Math.PI / 2; ov.line(x - Math.cos(b) * 19, y - Math.sin(b) * 19, x + Math.cos(b) * 19, y + Math.sin(b) * 19, 1.6, [1, 0.92, 0.65], 0.7); }
    }
    if (G.id === 'race' && this.st.far) {
      const Q = this.st.far, s = this.st, pulse = 0.8 + 0.2 * Math.sin(t * 3);
      ov.glow(Q.x, Q.y, 70, [1, 0.88, 0.6], 0.22 * pulse); ov.glow(Q.x, Q.y, 16, [1, 0.97, 0.85], 0.95); ov.ring(Q.x, Q.y, 44, 1.6, [1, 0.9, 0.7], 0.5 * pulse);
      // who has touched it: a mark of their colour on its ring
      if (s.touched[0]) ov.ring(Q.x, Q.y, 52, 4, EMBER, 0.9, Math.PI * 0.6, Math.PI * 1.4);
      if (s.touched[1]) ov.ring(Q.x, Q.y, 52, 4, TIDE, 0.9, -Math.PI * 0.4, Math.PI * 0.4);
    }
  }
}

// ── the neighbour: when you play alone the machine plays Tide — the same verbs, a player's reach, a little patience ──
class Neighbour {
  constructor(m) { this.m = m; this.re = 0; this.cd = 1.2; this.nav = null; this.route = null; this.wp = 1; }
  step(dt, W, me, them) {
    const F = me.focus; if (!F || !F.alive || this.m.over) return { x: 0, y: 0 };
    const B = F.B, G = them.focus && them.focus.alive ? them.focus.B : null, id = this.m.game.id, mine = me.mass, theirs = them.mass;
    this.re -= dt; this.cd -= dt;
    let tx = B.cx, ty = B.cy, thr = 1, aim = null; const dG = G ? Math.hypot(G.cx - B.cx, G.cy - B.cy) : 1e9;
    if (id === 'race') {
      const s = this.m.st, P = s.touched && s.touched[1] ? s.pore : s.far;
      if (P) { if (P !== this.goal) { this.goal = P; this.route = null; } if (!this.nav) this.nav = new Nav(W); if (this.re <= 0 || !this.route) { this.re = 0.6; this.nav.build(1, { count: B.count }); this.route = this.nav.path(B.cx, B.cy, P.x, P.y); this.wp = 1; } [tx, ty] = this.follow(B, P); aim = [tx, ty]; }
    } else if (id === 'spark') {
      if (G && this.m.st.holder === 2) { tx = G.cx; ty = G.cy; if (dG < 230) aim = [tx, ty]; }
      else if (G && dG < 400) [tx, ty] = this.flee(W, B, G);
      else if (G) [tx, ty] = this.haven(W, G);             // nobody near: keep to open water, as far from the spark as the dish allows
    } else if (id === 'crown') {
      // (a player's eyes need a moment to see the crown leave: so does the machine's)
      const s = this.m.st, seen = s.hop > 0 && s.hop < HOP - 0.3; tx = seen ? s.to.x : s.hop > 0 ? s.from.x : s.x; ty = seen ? s.to.y : s.hop > 0 ? s.from.y : s.y; const d = Math.hypot(tx - B.cx, ty - B.cy);
      if ((s.who === 1 || s.who === 3) && theirs > mine * 1.35) { const m = this.forage(W, B, G, mine, theirs); if (m) { tx = m.x; ty = m.y; } }       // too big to shove off: grow first
      else if (d > 210) aim = [tx, ty]; else if (d < s.r * 0.45) thr = 0.25;
    } else {
      const m = this.forage(W, B, G, mine, theirs);
      if (G && mine > theirs * 1.3 && dG < 380) { tx = G.cx; ty = G.cy; if (dG < 220) aim = [tx, ty]; }
      else if (G && theirs > mine * 1.2 && dG < 260) [tx, ty] = this.flee(W, B, G);
      else if (m) { tx = m.x; ty = m.y; if (Math.hypot(tx - B.cx, ty - B.cy) > 190) aim = [tx, ty]; }
    }
    let dx = tx - B.cx, dy = ty - B.cy; const d = Math.hypot(dx, dy) + 1e-3; dx /= d; dy /= d;
    if (id !== 'race' && W.phys.sampleSDF(B.cx + dx * 60, B.cy + dy * 60) < 24) { const g = this.grad(W, B.cx, B.cy); dx += g[0] * 0.8; dy += g[1] * 0.8; const n = Math.hypot(dx, dy) + 1e-3; dx /= n; dy /= n; }       // keep off the walls
    if (aim && this.cd <= 0 && F.dartCD <= 0 && B.count > 24) { const ex = aim[0] - B.cx, ey = aim[1] - B.cy, e = Math.hypot(ex, ey); if (e > 110 && e < 420 && !W.phys.blocked(B.cx, B.cy, aim[0], aim[1], 4)) { F.dart(ex, ey, 1); this.cd = 1.4 + Math.random() * 1.3; } }
    // a film across the way: through it
    for (const e of W.ents) if (e.d.type === 'film' && !e.tough && e.S && e.S.active && F.dartCD <= 0) { const fx = e.x - B.cx, fy = e.y - B.cy, al = fx * dx + fy * dy; if (al > 0 && al < 110 && Math.abs(fx * dy - fy * dx) < e.len * 0.5) { F.dart(dx, dy, 1.3); this.cd = 1; } }
    const k = 0.92 * Math.min(1, d / 60 + 0.2) * thr; return { x: dx * k, y: dy * k };
  }
  forage(W, B, G, mine, theirs) {
    let best = null, bs = 0;
    for (const m of W.pickups) { if (!m.isMote || m.dead || m.held || m.spawnT < 0) continue; const d = Math.hypot(m.x - B.cx, m.y - B.cy); let s = (m.value || 1) / (d + 70); if (G && theirs > mine * 1.15 && Math.hypot(m.x - G.cx, m.y - G.cy) < 180) s *= 0.3; if (s > bs) { bs = s; best = m; } }
    return best;
  }
  // away — but toward room: of five headings round "away", the one with the most open water ahead
  flee(W, B, G) {
    let ax = B.cx - G.cx, ay = B.cy - G.cy; const d = Math.hypot(ax, ay) + 1e-3; ax /= d; ay /= d; let best = [B.cx + ax * 150, B.cy + ay * 150], bs = -1e9;
    for (const t of [-1.3, -0.65, 0, 0.65, 1.3]) { const c = Math.cos(t), s = Math.sin(t), hx = ax * c - ay * s, hy = ax * s + ay * c; const room = W.phys.sampleSDF(B.cx + hx * 120, B.cy + hy * 120) + W.phys.sampleSDF(B.cx + hx * 60, B.cy + hy * 60) - Math.abs(t) * 16; if (room > bs) { bs = room; best = [B.cx + hx * 150, B.cy + hy * 150]; } }
    return best;
  }
  // of a ring of spots round the dish's middle, the one furthest from them (re-chosen now and then, so it is not a dither)
  haven(W, G) {
    if (this.hv && this.hvT > 0) { this.hvT -= 1 / 60; return this.hv; }
    const cx = W.spec.W / 2, cy = W.spec.H / 2, R = Math.min(W.spec.W, W.spec.H) * 0.32; let best = [cx, cy], bd = -1;
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = cx + Math.cos(a) * R * (W.spec.W > W.spec.H ? 1.5 : 1), y = cy + Math.sin(a) * R * (W.spec.H > W.spec.W ? 1.5 : 1); if (W.phys.sampleSDF(x, y) < 40) continue; const d = Math.hypot(x - G.cx, y - G.cy); if (d > bd) { bd = d; best = [x, y]; } }
    this.hv = best; this.hvT = 1.5; return best;
  }
  grad(W, x, y) { const e = 6, P = W.phys, gx = P.sampleSDF(x + e, y) - P.sampleSDF(x - e, y), gy = P.sampleSDF(x, y + e) - P.sampleSDF(x, y - e), n = Math.hypot(gx, gy) + 1e-6; return [gx / n, gy / n]; }
  follow(B, P) { const r = this.route; if (!r || !r.pts || !r.pts.length) return [P.x, P.y]; const pts = r.pts; let k = Math.min(this.wp, pts.length - 1); while (k < pts.length - 1 && Math.hypot(pts[k][0] - B.cx, pts[k][1] - B.cy) < 34) k++; this.wp = k; const q = pts[Math.min(pts.length - 1, k + 1)]; return [q[0], q[1]]; }
}
