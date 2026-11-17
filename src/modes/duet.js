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
//    Masks · ten strangers and the two of you, all alike: dart into the other one, or eat four lights
//            unseen — and a stranger darted into unmasks you for a moment
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
// each game its own plate, every one dark enough for both creatures to burn on it: Rain's deep water, Crown's violet and gold, Spark's smoke
const PALS = {
  rain: { deep: [0.012, 0.03, 0.06], mid: [0.04, 0.10, 0.18], pool: [0.06, 0.16, 0.24], wall: [0.07, 0.13, 0.21], rim: [0.6, 0.85, 1] },
  crown: { deep: [0.035, 0.018, 0.06], mid: [0.13, 0.07, 0.2], pool: [0.19, 0.11, 0.26], wall: [0.18, 0.11, 0.26], rim: [1, 0.84, 0.55], accent: [1, 0.8, 0.4] },
  spark: { deep: [0.02, 0.018, 0.026], mid: [0.085, 0.07, 0.095], pool: [0.13, 0.1, 0.12], wall: [0.13, 0.11, 0.14], rim: [1, 0.76, 0.5], accent: [1, 0.86, 0.6] },
  masks: { deep: [0.014, 0.02, 0.04], mid: [0.06, 0.075, 0.12], pool: [0.09, 0.11, 0.17], wall: [0.09, 0.1, 0.16], rim: [0.82, 0.88, 1], accent: [0.86, 0.9, 1] },
};
export const GAMES = [
  { id: 'rain', name: 'Rain', rule: 'drink the light · the larger drinks the smaller', short: 'the larger drinks the smaller', len: 45 },
  { id: 'crown', name: 'Crown', rule: 'hold the crown alone · it fills with your colour, and it is shy', short: 'hold the shy crown alone', len: 60 },
  { id: 'spark', name: 'Spark', rule: 'a touch passes the spark · it burns: whoever holds it runs hot · do not be holding it at the end', short: 'do not be holding it at the end', len: 40 },
  { id: 'race', name: 'Race', rule: 'touch the far light, then first one home', short: 'the far light, then home', len: 75 },
  { id: 'masks', name: 'Masks', rule: 'everyone looks alike · dart into the other one, or eat four lights unseen · a stranger darted into unmasks you', short: 'all alike · find the other one', len: 60 },
];
// …and its own music: Rain the duet's own, the Crown a warden's clock, the Spark the Iris's ticking breath, the Race Bloom's quick one
const MUSIC = { rain: 'duet', crown: 'warden', spark: 'iris', race: 'bloom', masks: 'abyss' };
// Masks: everyone wears the same moonlit opal; when it is over the strangers sleep where they stood
const MASK = { id: 'mask', absorb: [0.46, 0.28, 0.12], emit: [0.72, 0.82, 1.0], glow: 0.44, halo: 0.4, lit: [0.88, 0.94, 1] };
const ASLEEP = { id: 'asleep', absorb: [0.5, 0.46, 0.42], emit: [0.42, 0.48, 0.58], glow: 0.14, halo: 0.1 };
const CROWD = 10, MASS_M = 34, PACE = 0.74, FEED = 4, SHOWN = 3;
const TAU = Math.PI * 2;
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
    this.app = app; this.o = o; this.ai = !!o.ai; this.score = [0, 0]; this.round = 0; this.history = []; this.p2 = null; this.two = new Second(app); this.over = true; this.t = 0; this.st = {}; this.races = 0;
    const ids = shuffle(GAMES.map(g => g.id)); if (o.first && ids.includes(o.first)) { ids.splice(ids.indexOf(o.first), 1); ids.unshift(o.first); if (o.only) ids.length = 1; }
    this.deck = ids; this.course = Math.floor(Math.random() * COURSES.length);
  }
  get game() { return GAMES.find(g => g.id === this.deck[(this.round - 1) % this.deck.length]) || GAMES[0]; }
  enter() { this.two.enter(); this.next(null); }
  exit() { this.two.exit(); }
  pauseSub() { return `Duet · round ${this.round} · ${this.game.name} · ${NAMES[0]} ${this.score[0]} · ${this.score[1]} ${NAMES[1]}${this.ai ? ' (the machine)' : ''}`; }

  // ── a round: the dish (or the course), both creatures, and the round's own state ──
  next(card) {
    const app = this.app; this.round++; const G = this.game; this.over = true; this.p2 = null;
    app.travel((aspect) => this.build(G.id, aspect), { mass: G.id === 'rain' ? 40 : G.id === 'masks' ? MASS_M : 50 }, {
      minDark: card ? 2.8 : 0.5,
      onDark: () => { app.applyBudget(); if (card) app.hud.showResult(card); },
      onLoad: (W) => this.begin(W),
      onReveal: () => {
        app.hud.hideResult(); app.hud.showTitle(`round ${this.round}`, G.name, G.id === 'race' ? `${G.rule} · ${COURSES[this.courseNow].name}` : G.rule, 2.8); app.hud.setCorner(true, () => app.pause()); app.sound.ambience(MUSIC[G.id] || 'duet');
        if (this.round === 1 && !this.ai && app.input.device === 'touch') app.hud.toast('two on one glass · a half each', '◐', 'cool');
        // (Masks on one keyboard: the pointer would give Ember away — so Ember may take the arrows)
        app.input.keysSplit = G.id === 'masks' && !this.ai && app.input.device !== 'touch';
        if (app.input.keysSplit) app.hud.toast('Ember ← ↑ ↓ → Enter · Tide W A S D Space', '◐', 'cool');
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
    if (id === 'masks') { const reeds = [[0.3, 0.32], [0.7, 0.68], [0.52, 0.5]].map(([u, v]) => ({ ...at(u, v), r: 20 })); for (const q of reeds) geo.push({ op: 'add', t: 'circle', ...q, mat: SURF.GLASS }); this.places = scatter(W, H, 34, Math.min(W, H) * 0.3, reeds, CROWD + 2); }
    const sp = id === 'masks' ? this.places : this.spawns(W, H);
    return { name: this.game.name, seed: 21 + this.round, W, H, geo, ents: [], spawn: { x: sp[0].x, y: sp[0].y, n: 40 }, pal: PALS[id] || PALS.rain };
  }
  begin(W) {
    const G = this.game, sp = G.id === 'race' ? [W.spec.spawn, this.start2] : G.id === 'masks' ? this.places : this.spawns(W.spec.W, W.spec.H);
    const C = this.p2 = new Colony(W, 7, { tint: TINT2, crown: 'sun', isPlayer: true }); C.spawn(sp[1].x, sp[1].y, G.id === 'rain' ? 40 : G.id === 'masks' ? MASS_M : 50); W.colonies.push(C); W.massCosts = true; this.two.attach(C);
    this.brain = this.ai ? new Neighbour(this) : null; this.over = false; this.t = G.len; this.rain = 0; this.recs = [[], []]; this.recT = 0;
    // ready…: both asleep while the round's name is read, then woken together (the machine reads no faster than you do)
    this.hold = 1.7; for (const Q of [W.player, C]) for (const O of Q.orgs) O.dormant = true;
    if (G.id === 'crown') this.st = { x: W.spec.W / 2, y: W.spec.H / 2, hx: W.spec.W / 2, hy: W.spec.H / 2, r: 74, fill: [0, 0], beat: [0, 0], who: 0, tt: 0, streak: 0, contest: 0, hop: 0, from: null, to: null };
    else if (G.id === 'spark') { const [a, b] = this.score; this.st = { holder: a > b ? 1 : b > a ? 2 : 1 + Math.floor(Math.random() * 2), immune: 1.5, tick: 0 }; }
    else if (G.id === 'race') { this.races++; this.st = { pore: W.ents.find(e => e.d.type === 'pore'), far: this.far, touched: [false, false] }; }
    else if (G.id === 'masks') this.maskUp(W);
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
      const veil = this.game.id === 'masks';
      // (in Masks the pointer must not drag Ember out of the crowd before its player has even moved: it steers once the mouse does)
      if (veil) this.app.input.mouse.follow = false;
      for (const Q of W.colonies) { const col = veil ? [0.86, 0.9, 1] : Q === W.player ? EMBER : Q === this.p2 ? TIDE : null; if (col) for (const O of Q.orgs) { O.dormant = false; if (O.alive) W.fx.ring(O.B.cx, O.B.cy, col, 90, veil ? 0.35 : 0.8); } }
      this.app.sound.chime(7, 0); this.app.haptics.tick();
    }
    const G = this.game; this.t -= dt;
    // both paths, ten times a second, for the round's long exposure
    if ((this.recT += dt) >= 0.1 && this.recs[0].length < 900) { this.recT -= 0.1; const sp = W.spec, land = sp.W >= sp.H; [W.player, this.p2].forEach((C, k) => { const F = C.focus; if (F && F.alive) this.recs[k].push(land ? [F.B.cx / sp.W, F.B.cy / sp.H] : [F.B.cy / sp.H, F.B.cx / sp.W]); }); }
    if (G.id === 'rain' || G.id === 'crown') this.rainOn(dt, W, G.id === 'rain' ? 0.35 : 1.1, G.id === 'rain' ? 26 : 10);
    if (G.id === 'crown') this.crown(dt, W); else if (G.id === 'spark') this.spark(dt, W); else if (G.id === 'race') this.race(W); else if (G.id === 'masks') this.masked(dt, W);
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
      if (Math.hypot(o.B.cx - P.x, o.B.cy - P.y) < P.r * 0.9 + o.B.r * 0.3) { s.home = k; this.finish(k); return; }
    }
  }
  // ── Masks ──
  // everyone in the same opal, everyone the same size, every one of them a little curious about light; the counts are a secret
  maskUp(W) {
    W.masks = true; W.peace = true; W.massCosts = false; W.massCap = MASS_M; W.dartSpeed = 780;        // (a dart here is a question asked at arm's length: it reaches a little further)
    this.real = [W.player.tint, TINT2];
    const crowd = [];
    for (let k = 0; k < CROWD; k++) { const p = this.places[2 + k]; if (!p) break; const S = new Colony(W, 20 + k, { tint: MASK, crown: 'sun', isPlayer: true }); S.spawn(p.x, p.y, MASS_M); S.stranger = true; W.colonies.push(S); crowd.push({ C: S, g: new Gait() }); }
    // (and everyone's feelers reach half as far: a light is eaten by walking to it, not by standing near where it fell)
    for (const C of W.colonies) { C.tint = MASK; for (const O of C.orgs) { O.B.tint = MASK; O.speedMul = PACE; O.reachK = 0.5; O.dormant = true; } }
    this.st = { crowd, eats: [0, 0], strike: [null, null], shown: [0, 0], wrongs: [0, 0], why: '' };
  }
  // (the stick ring would point at you — but only another person could read it: against the machine it stays)
  get noStick() { return !!this.p2 && !this.over && this.game.id === 'masks' && !this.ai; }
  masked(dt, W) {
    const s = this.st; this.crowdF = W.colonies.map(C => C.focus).filter(O => O && O.alive);
    // the strangers stroll, stop, look about, drift toward light, start at nothing now and then
    for (const q of s.crowd) { const F = q.C.focus; if (!F || !F.alive) continue; const v = q.g.step(dt, W, F, this.crowdF, null); const P = q.C.pilot || (q.C.pilot = { x: 0, y: 0 }); P.x = v.x; P.y = v.y; if (v.dart) F.dart(v.dart[0], v.dart[1], 0.9); }
    this.rainOn(dt, W, 1.7, 4);
    // a dart is a question: the first body it meets answers it
    for (let k = 0; k < 2; k++) {
      const S = s.strike[k]; if (!S) continue; S.t -= dt; const O = S.O; if (S.t <= 0 || !O.alive) { s.strike[k] = null; continue; }
      const me = k ? this.p2 : W.player, foe = k ? W.player : this.p2;
      for (const C of W.colonies) { if (C === me || !s.strike[k]) continue; for (const Q of this.bodies(C)) {
        // (two membranes pressed together keep their centres about a radius-sum apart: touching is a little more than that)
        const dx = Q.B.cx - O.B.cx, dy = Q.B.cy - O.B.cy, d = Math.hypot(dx, dy); if (d > (Q.B.r + O.B.r) * 1.2 + 4 || dx * S.dx + dy * S.dy < 0) continue;
        s.strike[k] = null; if (C === foe) { s.why = 'tag'; this.finish(k + 1); return; } this.wrong(k, Q, W); break;
      } }
    }
    for (let k = 0; k < 2; k++) if (s.shown[k] > 0) { s.shown[k] -= dt; if (s.shown[k] <= 0) this.mask(k, true); }
  }
  // a stranger: it startles and shies away — and you are seen for what you are, for three seconds
  wrong(k, Q, W) {
    const B = Q.B; W.fx.ring(B.cx, B.cy, [0.9, 0.95, 1], 80, 0.6); W.fx.burst(B.cx, B.cy, 10, [0.85, 0.92, 1], 160, { life: 0.5, size: 2 }); Q.crown.startle(1); Q.excite = 1;
    const q = this.st.crowd.find(c => c.C === Q.colony); if (q) q.g.startle(B, (k ? this.p2 : this.app.world.player).focus);
    const b = k ? this.brain : this.bot1; if (b && b.cleared) b.cleared(Q.colony);
    this.st.shown[k] = SHOWN; this.st.wrongs[k]++; this.mask(k, false); this.app.sound.snap(0.2); this.app.haptics.tick();
  }
  mask(k, on) {
    const W = this.app.world, C = k ? this.p2 : W.player, t = on ? MASK : this.real[k]; C.tint = t;
    for (const O of C.orgs) if (O.alive) { O.B.tint = t; W.fx.ring(O.B.cx, O.B.cy, on ? [0.86, 0.9, 1] : k ? TIDE : EMBER, on ? 60 : 140, on ? 0.35 : 0.85); }
  }
  // the masks fall: the two of you in your own colours again, the strangers asleep where they stood
  unmask(W) {
    for (let k = 0; k < 2; k++) { const C = k ? this.p2 : W.player; C.tint = this.real[k]; for (const O of C.orgs) if (O.alive) O.B.tint = this.real[k]; }
    for (const q of this.st.crowd) { q.C.pilot = null; q.C.tint = ASLEEP; for (const O of q.C.orgs) if (O.alive) { O.dormant = true; O.B.tint = ASLEEP; } }
    const s = this.app.sound; if (s.bloom) s.bloom(); else s.chime(0, 0);          // (two chimes at once would be one: they are rate-limited)
  }
  // (world events) whoever ate, it looked and sounded the same; only the mode keeps count
  eaten(m, O) {
    const W = this.app.world; if (this.over || !this.p2 || this.game.id !== 'masks') return;
    this.app.sound.mote(m.x / W.spec.W * 1.6 - 0.8, 0); for (const b of [this.brain, this.bot1]) if (b) b.saw('eat', O.colony, O);
    if (O.colony) O.colony.pearls = (O.colony.pearls || 0) + 1;          // (what anyone eats stays in them, a pearl for everyone to see)
    const q = this.st.crowd.find(c => c.C === O.colony); if (q) q.g.sated = 6 + Math.random() * 8;          // a stranger rests after a meal (the one that keeps eating is no stranger)
    const k = O.colony === W.player ? 0 : O.colony === this.p2 ? 1 : -1; if (k < 0) return;
    if (++this.st.eats[k] >= FEED) { this.st.why = 'fed'; this.finish(k + 1); if (k === 0 && (this.ai || !this.app.bot)) this.unseen(); }
  }
  dart(O, dx, dy) {
    const W = this.app.world; if (this.over || !this.p2 || this.game.id !== 'masks' || !O.colony) return;
    for (const b of [this.brain, this.bot1]) if (b) b.saw('dart', O.colony, O, dx, dy);
    const k = O.colony === W.player ? 0 : O.colony === this.p2 ? 1 : -1; if (k >= 0 && O === O.colony.focus) this.st.strike[k] = { t: 0.5, O, dx, dy };
  }
  // ?bot: the machine plays Ember too (a match that plays itself — and a way to measure a game's balance)
  botCtl(c) {
    const W = this.app.world; c.aim = null; if (!this.p2 || this.over || this.hold > 0) return;
    if (!this.bot1 || this.bot1.round !== this.round) { this.bot1 = new Neighbour(this, 0); this.bot1.round = this.round; }
    const v = this.bot1.step(1 / 60, W, W.player, this.p2); c.intent.x = v.x; c.intent.y = v.y;
  }
  // (for hands-on playtests: what the round knows that the glass does not show)
  dbg() { const s = this.st, W = this.app.world; return { game: this.game.id, t: +this.t.toFixed(1), eats: s.eats, shown: s.shown, wrongs: s.wrongs, why: s.why, round: this.round, score: this.score, over: this.over, sus: this.brain && this.brain.sus ? [...this.brain.sus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([C, v]) => [C === W.player ? 'ME' : C.group, +v.toFixed(2)]) : null }; }
  // a trick: Ember ate its fill among strangers who all looked like it — and nobody knew
  unseen() { const app = this.app; if (!app.save.trick('Unseen')) return; app.hud.toast('Unseen', '✦'); app.sound.trick(); const T = TRICKS.find(q => q[0] === 'Unseen'); if (app.moment) app.moment('Unseen', T ? T[1] : '', 'trick:Unseen', this.shot); }
  // the line under who took it: how
  how(w) { const line = this.howLine(w); return line ? `<div class="d-how">${line}</div>` : ''; }
  howLine(w) {
    const G = this.game, s = this.st, W = this.app.world; let line = '';
    if (G.id === 'masks') line = s.why === 'tag' ? `${NAMES[w - 1]} found ${NAMES[2 - w]} among ten strangers` : s.why === 'fed' ? `${NAMES[w - 1]} ate ${FEED} lights unseen` : `lights eaten · ${NAMES[0]} ${s.eats[0]} · ${s.eats[1]} ${NAMES[1]}`;
    else if (G.id === 'rain' && W.player && this.p2) line = `${NAMES[0]} ${W.player.mass} grains · ${this.p2.mass} ${NAMES[1]}`;
    else if (G.id === 'crown' && s.fill) line = `held alone · ${NAMES[0]} ${s.fill[0].toFixed(1)} s · ${s.fill[1].toFixed(1)} s ${NAMES[1]}`;
    else if (G.id === 'spark' && s.holder) line = `${NAMES[s.holder - 1]} was left holding the spark`;
    else if (G.id === 'race') line = `${COURSES[this.courseNow].name} · ${s.home ? NAMES[s.home - 1] + ' home first' : w ? NAMES[w - 1] + ' nearer home at the bell' : 'nobody home in time'}`;
    return line;
  }
  // time is up: who has it
  verdict(W) {
    const G = this.game, cmp = (a, b) => (a > b ? 1 : b > a ? 2 : 0);
    if (G.id === 'rain') return cmp(W.player.mass, this.p2.mass);
    if (G.id === 'crown') return cmp(Math.round(this.st.fill[0] * 10), Math.round(this.st.fill[1] * 10));
    if (G.id === 'spark') return 3 - this.st.holder;
    if (G.id === 'masks') { this.st.why = 'time'; return cmp(this.st.eats[0], this.st.eats[1]); }
    const s = this.st, P = s.pore, Q = s.far; if (!P || !Q) return 0;
    const left = (C, k) => Math.min(1e9, ...this.bodies(C).map(o => (s.touched[k] ? 0 : Math.hypot(o.B.cx - Q.x, o.B.cy - Q.y) + Math.hypot(Q.x - P.x, Q.y - P.y)) + (s.touched[k] ? Math.hypot(o.B.cx - P.x, o.B.cy - P.y) : 0)));
    return cmp(-left(W.player, 0), -left(this.p2, 1));
  }
  finish(w) {
    if (this.over) return; this.over = true; const app = this.app, W = app.world; if (w) this.score[w - 1]++;
    const F = w === 1 ? W.player.focus : w === 2 ? this.p2.focus : null;
    // the round in one picture, taken before the celebration: Ember's way warm, Tide's cool, woven over the dish
    this.shot = exposure(app.R, W.spec, null, { zoom: app.hud.k || 1, runs: [{ rec: this.recs[0], from: [1, 0.5, 0.26], to: [1, 0.8, 0.52], home: w === 1 }, { rec: this.recs[1], from: [0.24, 0.62, 1], to: [0.6, 0.95, 1], home: w === 2 }] });
    this.history.push({ name: this.game.name, w, how: this.howLine(w) });
    if (this.game.id === 'masks') this.unmask(W);
    if (F && F.alive) { W.fx.ring(F.B.cx, F.B.cy, w === 1 ? EMBER : TIDE, 240, 0.9); W.fx.burst(F.B.cx, F.B.cy, 30, w === 1 ? EMBER : TIDE, 300, { life: 1, size: 3 }); }
    app.sound.portal(); app.haptics.fuse(); app.hud.setTop(null);
    const done = Math.max(...this.score) >= 2 || this.round >= 5;
    setTimeout(() => { if (app.mode !== this) return; if (done) this.end(w); else this.next(this.card(w)); }, 1500);
  }
  // between rounds: who took it, the match so far, and what comes next
  pips(k) { const n = this.score[k]; return `<span style="color:${CSS[k]}">${'●'.repeat(n)}<span style="opacity:.25">${'●'.repeat(Math.max(0, 2 - n))}</span></span>`; }
  card(w) {
    const G = this.game, nx = GAMES.find(g => g.id === this.deck[this.round % this.deck.length]);
    return { html: `<div class="r-name">round ${this.round} · ${G.name}</div><div class="d-win" style="color:${w ? CSS[w - 1] : '#dff8ff'}">${w ? NAMES[w - 1] + ' takes it' : 'a draw'}</div>${this.how(w)}`
      + `<div class="d-score">${this.pips(0)}<i>${NAMES[0]}</i><b>·</b><i>${NAMES[1]}</i>${this.pips(1)}</div><div class="r-next on">next · ${nx.name} — ${nx.short || nx.rule}</div>`, shot: this.shot };
  }
  end(w) {
    const app = this.app, [a, b] = this.score;
    // against the machine: a record kept (and the first match won is a trick, with the last round's picture in the Album)
    // (a trick found at the end is said in the panel itself — a toast would only show through it)
    let found = '';
    if (this.ai && a !== b) { const rec = app.save.get('duetAI', { w: 0, l: 0 }); if (a > b) rec.w++; else rec.l++; app.save.set('duetAI', rec);
      if (a > b && app.save.trick('Neighbourly')) { app.sound.trick(); const T = TRICKS.find(q => q[0] === 'Neighbourly'); found = `<div class="d-trick">✦ Neighbourly <span>${T ? T[1] : ''}</span></div>`; if (app.moment) app.moment('Neighbourly', T ? T[1] : '', 'trick:Neighbourly', this.shot); } }
    app.hud.panel(a === b ? 'A perfect tie' : `${NAMES[a > b ? 0 : 1]} takes the match`, `${a} · ${b}${this.ai ? ' · against the machine' : ''}`, [
      { label: 'Again', cls: 'pri', fn: () => { app.hud.closePanel(); app.setMode(new Duet(app, { ai: this.ai, ...(this.o.only ? { first: this.o.first, only: true } : {}) })); } },
      { label: 'Atrium', fn: () => { app.hud.closePanel(); app.toHub({ awake: true }); } }],
      `${(() => { try { return this.shot ? `<img class="d-shot" alt="" src="${this.shot.toDataURL('image/jpeg', 0.86)}" style="width:${this.shot.style.width}">` : ''; } catch (_) { return ''; } })()}`
      + `<div class="d-score" style="margin:6px 0 4px">${this.pips(0)}<i>${NAMES[0]}</i><b>·</b><i>${NAMES[1]}</i>${this.pips(1)}</div>`
      + found + `<div class="d-rounds">${this.history.map((h, i) => `<div><b>${i + 1} · ${h.name}</b><i style="color:${h.w ? CSS[h.w - 1] : '#dff8ff'}">${h.w ? NAMES[h.w - 1] : 'a draw'}</i><span>${h.how}</span></div>`).join('')}</div>`
      + `${this.ai ? (() => { const r = app.save.get('duetAI', { w: 0, l: 0 }); return `<div class="sub" style="margin-top:8px;opacity:.75">you ${r.w} · the machine ${r.l}</div>`; })() : ''}`);
  }
  onEvent(e) { if (this.app.state !== 'play') return false; return this.two.onEvent(e); }
  post(dt, W) {
    if (!this.p2) return; const sp = this.game.id === 'race' ? [W.spec.spawn, this.start2] : this.spawns(W.spec.W, W.spec.H);
    for (const [k, C] of [[0, W.player], [1, this.p2]]) if (!C.orgs.some(o => o.alive)) { C.spawn(sp[k].x, sp[k].y, 24); W.fx.ring(sp[k].x, sp[k].y, [1, 1, 1], 120, 0.8); }
  }
  frame() {
    const app = this.app, W = app.world; if (app.state !== 'play' || this.over || !this.p2) return; const G = this.game;
    const v = G.id === 'crown' ? this.st.fill.map(q => q.toFixed(1)) : G.id === 'masks' ? ['?', '?'] : [W.player.mass, this.p2.mass], hold = G.id === 'spark' ? this.st.holder : 0;
    app.hud.setTop({ raw: `<span class="du">${this.pips(0)}<b style="color:${CSS[0]}">${hold === 1 ? '✦ ' : ''}${v[0]}</b><span class="tm">${Math.max(0, Math.ceil(this.t))}</span><b style="color:${CSS[1]}">${v[1]}${hold === 2 ? ' ✦' : ''}</b>${this.pips(1)}</span>` });
  }
  // drawn on the glass: player two's stick; the crown and its two fills; the spark circling whoever holds it
  overlay(ov, R) {
    const W = this.app.world, G = this.game, t = performance.now() / 1000; if (!(G.id === 'masks' && !this.over)) this.two.overlay(ov, R); if (!this.p2 || this.over && (G.id === 'spark' || G.id === 'masks')) return;
    if (G.id === 'masks') {
      // every light eaten becomes a little moon that circles whoever ate it, for the rest of the round — a glutton, or someone one light from winning
      for (const C of W.colonies) { const n = Math.min(6, C.pearls || 0), F = C.focus; if (!n || !F || !F.alive) continue; const rr = F.B.r + 10; for (let i = 0; i < n; i++) { const a = t * 0.8 + i * TAU / n + C.group, x = F.B.cx + Math.cos(a) * rr, y = F.B.cy + Math.sin(a) * rr; ov.glow(x, y, 9, [1, 0.78, 0.4], 0.6); ov.glow(x, y, 3, [1, 0.97, 0.85], 1); } }
      // seen for what you are: your own colour, and a ring that will not let go of you until the mask is back on
      for (let k = 0; k < 2; k++) { const left = this.st.shown[k]; if (!(left > 0)) continue; const F = (k ? this.p2 : W.player).focus; if (!F || !F.alive) continue; const col = k ? TIDE : EMBER, a = Math.min(1, left / 0.5) * (0.6 + 0.4 * Math.sin(t * 9));
        ov.ring(F.B.cx, F.B.cy, F.B.r + 16, 2.6, col, 0.85 * a); ov.ring(F.B.cx, F.B.cy, F.B.r + 26, 1.2, col, 0.4 * a, -Math.PI / 2, -Math.PI / 2 + TAU * left / SHOWN); }
      return;
    }
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

// n places in the dish, well apart, clear of its rim and of the reeds (the dish is a rounded box: margin m, corner radius r)
function scatter(W, H, m, r, reeds, n) {
  const hw = W / 2 - m - 70, hh = H / 2 - m - 70, rr = Math.max(0, r - 70), out = [];
  const inside = (x, y) => { const ax = Math.abs(x - W / 2), ay = Math.abs(y - H / 2); if (ax > hw || ay > hh) return false; if (ax > hw - rr && ay > hh - rr) return Math.hypot(ax - (hw - rr), ay - (hh - rr)) <= rr; return true; };
  for (let gap = 150; out.length < n && gap > 40; gap -= 15) for (let k = 0; k < 600 && out.length < n; k++) {
    const x = W / 2 + (Math.random() * 2 - 1) * hw, y = H / 2 + (Math.random() * 2 - 1) * hh; if (!inside(x, y)) continue;
    if (reeds.some(q => Math.hypot(q.x - x, q.y - y) < q.r + 60) || out.some(q => Math.hypot(q.x - x, q.y - y) < gap)) continue; out.push({ x, y });
  }
  return out;
}

// ── a stranger's walk (and the machine's disguise): it strolls somewhere — the emptier of a few places it might go — along a
//    gently curving line, stops there to look about, and goes on; a light within its appetite turns it aside; it keeps a little
//    room from the others and from the rim, and now and then it starts at nothing ──
class Gait {
  constructor() { this.s = Math.random() < 0.55 ? 'pause' : 'walk'; this.t = Math.random() * 1.4; this.h = Math.random() * TAU; this.v = 0; this.vt = 0.7; this.ph = Math.random() * TAU; this.tw = 5 + Math.random() * 18; this.out = { x: 0, y: 0, dart: null }; this.app = 90 + Math.random() * 130; this.to = null; }      // (app: how far a light tempts this one — some are gluttons, some barely look)
  startle(B, from) { if (!from || !from.alive) return; this.h = Math.atan2(B.cy - from.B.cy, B.cx - from.B.cx); this.s = 'walk'; this.t = 1 + Math.random(); this.vt = 0.95; this.v = 0.9; this.to = { x: B.cx + Math.cos(this.h) * 220, y: B.cy + Math.sin(this.h) * 220 }; }
  // somewhere to stroll to: of three open places a few steps away, the one fewest others are near
  pick(W, B, others) {
    let best = null, bn = 1e9;
    for (let k = 0; k < 14 && (!best || k < 6); k++) {
      const a = Math.random() * TAU, d = 130 + Math.random() * 300, x = B.cx + Math.cos(a) * d, y = B.cy + Math.sin(a) * d; if (W.phys.sampleSDF(x, y) < 58) continue;      // (the field saturates near 70: never ask for more)
      let n = Math.random() * 0.5; for (const Q of others) if (Q.B !== B && Q.alive && Math.hypot(Q.B.cx - x, Q.B.cy - y) < 170) n++; if (n < bn) { bn = n; best = { x, y }; }
    }
    this.to = best || { x: W.spec.W / 2, y: W.spec.H / 2 };
  }
  // goal: {x, y} to make for instead (the machine's errands) · hurry: walk like nobody is watching
  step(dt, W, F, others, goal, hurry = 0) {
    const B = F.B, o = this.out; o.dart = null; this.t -= dt; this.tw -= dt; this.ph += dt;
    this.sated = Math.max(0, (this.sated || 0) - dt);
    if (!goal) { let bd = this.sated > 0 ? 40 : this.app; for (const p of W.pickups) { if (!p.isMote || p.dead || p.held || p.spawnT < 0) continue; const d = Math.hypot(p.x - B.cx, p.y - B.cy); if (d < bd) { bd = d; goal = p; } } }
    if (goal) { if (this.s === 'pause') { this.s = 'walk'; this.vt = 0.6 + Math.random() * 0.35; } this.t = Math.max(this.t, 0.6); }
    else if (this.s === 'walk' && (!this.to || this.t <= 0 || Math.hypot(this.to.x - B.cx, this.to.y - B.cy) < 50)) { this.s = 'pause'; this.t = 0.5 + Math.random() * 2.2; this.to = null; }
    else if (this.s === 'pause' && this.t <= 0) { this.s = 'walk'; this.t = 7; this.vt = 0.55 + Math.random() * 0.42; this.pick(W, B, others); }
    const to = goal || this.to;
    if (to && this.s === 'walk') { let d = Math.atan2(to.y - B.cy, to.x - B.cx) - this.h; d -= Math.round(d / TAU) * TAU; const turn = hurry ? 4 : 1.7; this.h += Math.max(-turn * dt, Math.min(turn * dt, d)) + Math.sin(this.ph * 0.9) * 0.35 * dt; }
    // the rim and the reeds: turn along them before touching
    const P = W.phys, cx = Math.cos(this.h), cy = Math.sin(this.h), ahead = P.sampleSDF(B.cx + cx * 70, B.cy + cy * 70);
    if (ahead < 46) { const e = 6, gx = P.sampleSDF(B.cx + e, B.cy) - P.sampleSDF(B.cx - e, B.cy), gy = P.sampleSDF(B.cx, B.cy + e) - P.sampleSDF(B.cx, B.cy - e); let d = Math.atan2(gy, gx) - this.h; d -= Math.round(d / TAU) * TAU; this.h += Math.max(-3 * dt, Math.min(3 * dt, d * (1 - Math.max(0, ahead) / 46) * 2)); }
    // a little room from the others
    let sx = 0, sy = 0; for (const Q of others) { if (Q === F || !Q.alive) continue; const dx = B.cx - Q.B.cx, dy = B.cy - Q.B.cy, d = Math.hypot(dx, dy) + 1e-3; if (d < 100) { const k = (1 - d / 100) / d; sx += dx * k; sy += dy * k; } }
    if (sx || sy) { let d = Math.atan2(sy, sx) - this.h; d -= Math.round(d / TAU) * TAU; this.h += Math.max(-2 * dt, Math.min(2 * dt, d * Math.min(1, Math.hypot(sx, sy) * 1.5))); }
    const want = this.s === 'walk' ? (hurry ? 1 : this.vt) : 0; this.v += (want - this.v) * Math.min(1, dt * 3.2);
    o.x = Math.cos(this.h) * this.v; o.y = Math.sin(this.h) * this.v;
    // a start at nothing — only into open water, and never into anyone
    if (this.tw <= 0 && this.s === 'walk' && this.v > 0.4) {
      this.tw = 9 + Math.random() * 16; const hx = Math.cos(this.h), hy = Math.sin(this.h);
      if (P.sampleSDF(B.cx + hx * 150, B.cy + hy * 150) > 50 && !others.some(Q => Q !== F && Q.alive && Math.hypot(Q.B.cx - B.cx - hx * 110, Q.B.cy - B.cy - hy * 110) < 90)) o.dart = [hx, hy];
    }
    return o;
  }
}

// ── the neighbour: when you play alone the machine plays Tide — the same verbs, a player's reach, a little patience ──
class Neighbour {
  // k: whose hands it lends — 1 Tide (you are alone), 0 Ember (?bot: the machine plays both sides, a match that plays itself)
  constructor(m, k = 1) { this.m = m; this.k = k; this.re = 0; this.cd = 1.2; this.nav = null; this.route = null; this.wp = 1; }
  step(dt, W, me, them) {
    const F = me.focus; if (!F || !F.alive || this.m.over) return { x: 0, y: 0 };
    const B = F.B, G = them.focus && them.focus.alive ? them.focus.B : null, id = this.m.game.id, mine = me.mass, theirs = them.mass;
    if (id === 'masks') return this.masks(dt, W, me, them);
    this.re -= dt; this.cd -= dt;
    let tx = B.cx, ty = B.cy, thr = 1, aim = null; const dG = G ? Math.hypot(G.cx - B.cx, G.cy - B.cy) : 1e9;
    if (id === 'race') {
      const s = this.m.st, P = s.touched && s.touched[this.k] ? s.pore : s.far;
      if (P) { if (P !== this.goal) { this.goal = P; this.route = null; } if (!this.nav) this.nav = new Nav(W); if (this.re <= 0 || !this.route) { this.re = 0.6; this.nav.build(1, { count: B.count }); this.route = this.nav.path(B.cx, B.cy, P.x, P.y); this.wp = 1; } [tx, ty] = this.follow(B, P); aim = [tx, ty]; }
    } else if (id === 'spark') {
      if (G && this.m.st.holder === this.k + 1) { tx = G.cx; ty = G.cy; if (dG < 230) aim = [tx, ty]; }
      else if (G && dG < 400) [tx, ty] = this.flee(W, B, G);
      else if (G) [tx, ty] = this.haven(W, G);             // nobody near: keep to open water, as far from the spark as the dish allows
    } else if (id === 'crown') {
      // (a player's eyes need a moment to see the crown leave: so does the machine's)
      const s = this.m.st, seen = s.hop > 0 && s.hop < HOP - 0.3; tx = seen ? s.to.x : s.hop > 0 ? s.from.x : s.x; ty = seen ? s.to.y : s.hop > 0 ? s.from.y : s.y; const d = Math.hypot(tx - B.cx, ty - B.cy);
      if ((s.who === 2 - this.k || s.who === 3) && theirs > mine * 1.35) { const m = this.forage(W, B, G, mine, theirs); if (m) { tx = m.x; ty = m.y; } }       // too big to shove off: grow first
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
  // ── Masks: the machine wears the same opal and walks the same walk. It sees only what you could see — who ate, who darted, who
  //    moved like nobody else (too fast, too sharp a turn, straight at a light from across the dish) — and it is wrong sometimes ──
  masks(dt, W, me, them) {
    const F = me.focus, B = F.B, s = this.m.st; if (!this.g) { this.g = new Gait(); this.sus = new Map(); this.seen = new Map(); this.re = 0; }
    this.watch(dt, W, me);
    let best = null, bs = 0, b2 = 0; for (const [C, v] of this.sus) { if (C === me || !C.focus || !C.focus.alive) continue; if (v > bs) { b2 = bs; bs = v; best = C; } else if (v > b2) b2 = v; }
    const shown = s.shown[1 - this.k] > 0 && them.focus && them.focus.alive; if (shown) { best = them; bs = 9; }
    // it feeds, unless someone is clearly not a stranger — or a likely one is close by
    const near = best ? Math.hypot(best.focus.B.cx - B.cx, best.focus.B.cy - B.cy) < 260 : false, stalk = best && (shown || (bs > 1.3 && bs > b2 * 1.3) || (bs > 1.0 && near));
    const T = stalk ? best.focus.B : null; let goal = T ? { x: T.cx, y: T.cy } : this.light(W, B, s);
    if (goal && !T && this.g.s === 'walk') this.g.vt = Math.max(this.g.vt, 0.86);          // (an errand: it walks a little briskly — a tell, for whoever is watching)
    const v = this.g.step(dt, W, F, this.m.crowdF || [], goal, shown ? 1 : 0);
    // the strike: sure enough, near enough — and a moment to make up its mind, as a player would
    if (T && bs > 1.5 && (bs > b2 * 1.4 || shown) && F.dartCD <= 0) { const d = Math.hypot(T.cx - B.cx, T.cy - B.cy) - T.r - B.r; if (d < 115 && d > -10) { this.re += dt; if (this.re > 0.3) { F.dart(T.cx - B.cx, T.cy - B.cy, 1); this.re = 0; this.sus.set(best, bs * 0.4); } } else this.re = 0; }
    else if (v.dart) F.dart(v.dart[0], v.dart[1], 0.9);          // a start at nothing, as the strangers do
    return { x: v.x, y: v.y };
  }
  // a light worth walking to: near-ish, and nobody right on top of it (it means to eat four before it is found)
  light(W, B, s) {
    let best = null, bd = 480; for (const p of W.pickups) { if (!p.isMote || p.dead || p.held || p.spawnT < 0) continue; const d = Math.hypot(p.x - B.cx, p.y - B.cy); if (d >= bd) continue; if ((this.m.crowdF || []).some(Q => Q.B !== B && Q.alive && Math.hypot(Q.B.cx - p.x, Q.B.cy - p.y) < d * 0.35)) continue; bd = d; best = p; }
    return best ? { x: best.x, y: best.y } : null;
  }
  // what it saw someone do: eat (strangers eat too) · dart — at nothing (strangers start at nothing too), or at someone (nobody but a player does that)
  saw(kind, C, O, dx, dy) {
    if (!this.sus || C === (this.k ? this.m.p2 : this.m.app.world.player)) return; let v = kind === 'eat' ? 0.3 : 0.3;
    if (kind === 'dart' && O) for (const Q of this.m.crowdF || []) { if (Q === O || !Q.alive) continue; const ex = Q.B.cx - O.B.cx, ey = Q.B.cy - O.B.cy, e = Math.hypot(ex, ey); if (e < 230 && (ex * dx + ey * dy) / e > 0.9) { v = 0.85; break; } }
    this.sus.set(C, (this.sus.get(C) || 0) + v);
  }
  cleared(C) { if (this.sus) this.sus.set(C, -1.5); }
  // the motion it can see: a walk faster than the crowd's, a turn sharper than a stroll, a straight line at a far light
  watch(dt, W, me) {
    const L = this.m.crowdF || []; let sp = []; for (const O of L) { const v = Math.hypot(O.B.vx, O.B.vy); if (v > 15) sp.push(v); } sp.sort((a, b) => a - b); const med = sp.length ? sp[sp.length >> 1] : 60;
    for (const O of L) {
      const C = O.colony; if (!C || C === me) continue; let v = Math.max((this.sus.get(C) || 0) * (1 - dt * 0.03), (C.pearls || 0) * 0.2);
      const vx = O.B.vx, vy = O.B.vy, sv = Math.hypot(vx, vy), q = this.seen.get(C) || { hx: vx, hy: vy, t: 0, cd: 0 };
      if (sv > med * 1.3 && sv > 50) v += dt * 0.3;
      q.t += dt; q.cd -= dt; if (q.t > 0.35) { const a = Math.hypot(q.hx, q.hy); if (a > 40 && sv > 40 && q.cd <= 0 && (q.hx * vx + q.hy * vy) / (a * sv) < -0.2) { v += 0.22; q.cd = 0.8; } q.hx = vx; q.hy = vy; q.t = 0; }
      if (sv > 40) for (const p of W.pickups) { if (!p.isMote || p.dead || p.spawnT < 0) continue; const dx = p.x - O.B.cx, dy = p.y - O.B.cy, d = Math.hypot(dx, dy); if (d > 300 && (dx * vx + dy * vy) / (d * sv) > 0.97) { v += dt * 0.22; break; } }
      this.seen.set(C, q); this.sus.set(C, v);
    }
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
