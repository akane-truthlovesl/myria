// ─────────────────────────────────────────────────────────────────────────────
//  The Workshop — make a chamber on the bench and hand it to anyone.
//
//  The bench is a live room: whatever is set down starts living at once (gears
//  turn, schools swim, fireflies blink), the creature sleeps where it will wake,
//  and the walls you draw stand as wet glass until the chamber is played — then
//  they are set into the plate. Play it through once and it is sealed: your run
//  is its record, and the chamber, record and all, goes out as one line of text.
//  Whoever plays it races your run as a pale blue bead; beat it, and the line
//  they copy on carries *their* run instead.
// ─────────────────────────────────────────────────────────────────────────────
import { Odyssey } from './odyssey.js';
import { KINDS, PENS, PLATES, LIMITS, BOULDER, buildChamber, freshDesign, checkDesign, chamberHash, chamberName, packChamber, toUV, angToUV, isAimed, isSized, isTurning } from '../world/workshop.js';
import { layout } from '../world/odyssey.js';
import { packEcho, unpackEcho } from '../world/entities.js';
import { shelf } from '../core/shelf.js';

const PEN_G = ['▬', '▭', '▤', '▩', '◠', '▢'];
export const TOOLS = [
  { id: 'start', g: '☉', name: 'start · tap where the creature wakes · tap the sleeper to change its size' },
  { id: 'pore', g: '◎', name: 'way out · it wakes when six lights in ten are yours' },
  { id: 'light', g: '✦', k: 'l', name: 'light · tap for one · drag to paint a line of it' },
  { id: 'lantern', g: '✹', k: 'L', name: 'lantern · every lantern must be lit before the way out opens' },
  ...PENS.map((p, i) => ({ id: 'pen' + i, g: PEN_G[i], k: 'w', pen: i, name: `${p.name} · drag a wall, tap a stone · ${p.line}` })),
  { id: 'switch', g: '⊙', k: 'S', name: 'switch · rest part of yourself on it' },
  { id: 'door', g: '▮', k: 'D', name: 'door · drag across a passage · it opens when every switch is held at once — with no switch, when the way out wakes' },
  { id: 'blade', g: '／', k: 'bl', name: 'blade · it cuts — into siblings, never debris' }, { id: 'grinder', g: '⚙', k: 'gr', name: 'grinder · it chews whatever it touches' },
  { id: 'film', g: '⌇', k: 'fm', name: 'soap film · drag to stretch it · it turns back a drift and bursts for a dart' },
  { id: 'band', g: '⌒', k: 'bd', name: 'sling band · drag the way it throws' }, { id: 'rotor', g: '◔', k: 'ro', name: 'turning ring · drag out its size' },
  { id: 'current', g: '≋', k: 'cu', name: 'current · drag the way it flows' }, { id: 'well', g: '◉', k: 'wl', name: 'well · a hungry dark' },
  { id: 'magnet', g: '⊛', k: 'mg', name: 'pulsing pole · iron answers it' }, { id: 'geyser', g: '❂', k: 'gy', name: 'geyser · it breathes in, then throws' },
  { id: 'sponge', g: '❉', k: 'sp', name: 'sponge · it drinks what leans on it · strike it to wring it out' }, { id: 'mimic', g: '✣', k: 'mm', name: 'mimic · not every light is light' },
  { id: 'watcher', g: '◬', k: 'wa', name: 'watcher · drag where it looks · it burns what it sees move' }, { id: 'spring', g: '♨', k: 'hp', name: 'healing spring' },
  { id: 'vent', g: '♁', k: 'vt', name: 'warm vent' }, { id: 'frost', g: '❄', k: 'fr', name: 'frost' },
  { id: 'school', g: '⋙', k: 'sc', name: 'a school of light · it swims as one' }, { id: 'fireflies', g: '✧', k: 'ff', name: 'fireflies · they find one flash' },
  { id: 'shy', g: '✩', k: 'sh', name: 'shy sparks · come slowly, or they bolt' }, { id: 'drift', g: '≈', k: 'dr', name: 'drift · it rides the currents' }, { id: 'pod', g: '❦', k: 'pd', name: 'seed pod · drag the way it opens' },
  { id: 'oil', g: '●', k: 'oi', name: 'oil' }, { id: 'silver', g: '◍', k: 'qs', name: 'quicksilver' }, { id: 'resin', g: '◈', k: 'rs', name: 'resin' }, { id: 'foam', g: '○', k: 'fo', name: 'foam' }, { id: 'iron', g: '✺', k: 'fe', name: 'ferrofluid' },
  { id: 'grazer', g: '☼', k: 'gz', name: 'grazer · smaller than you, and hungry for your light' }, { id: 'lancer', g: '➶', k: 'ln', name: 'lancer · bigger than you, and hunting' }, { id: 'thorn', g: '✸', k: 'tb', name: 'thornback' },
  { id: 'b-iron', g: '⬡', k: 'bI', name: 'bath · become iron' }, { id: 'b-silver', g: '⬢', k: 'bS', name: 'bath · become quicksilver' }, { id: 'b-armour', g: '⬣', k: 'bA', name: 'bath · become armour' },
  { id: 'b-foam', g: '◌', k: 'bF', name: 'bath · become foam (every dart a jet)' }, { id: 'b-spore', g: '❋', k: 'bP', name: 'bath · become spore' }, { id: 'b-rinse', g: '◇', k: 'bR', name: 'rinse · be yourself again' },
];
const ACTS = [['play', '▶ play', 'play it — the first run through seals it'], ['undo', '↶', 'undo (Z)'], ['move', '✥', 'move · drag a thing to where it should be'], ['erase', '⌫', 'erase · tap a thing, or drag across things'], ['mirror', '◫', 'mirror · whatever you set down, paint or draw appears again across the middle'], ['plate', '◐', 'the plate: its light and its music'], ['down', '⇣', 'give the chamber a down'], ['copy', '⇪', 'copy the chamber as a line of text'], ['new', '✚', 'clear the bench']];
const SIZES = [40, 60, 90, 140];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const segD = (p, a, b) => { const bx = b[0] - a[0], by = b[1] - a[1], L = bx * bx + by * by || 1; const h = clamp(((p[0] - a[0]) * bx + (p[1] - a[1]) * by) / L, 0, 1); return Math.hypot(p[0] - a[0] - bx * h, p[1] - a[1] - by * h); };
// a hand-drawn stroke, its wobble taken out (Ramer–Douglas–Peucker), at most n points
function simplify(pts, eps, n) {
  if (pts.length < 3) return pts.slice(); const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; for (let i = a + 1; i < b; i++) { const d = segD(pts[i], pts[a], pts[b]); if (d > md) { md = d; mi = i; } } if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  let out = pts.filter((_, i) => keep[i]); if (out.length > n) { const k = (out.length - 1) / (n - 1); out = Array.from({ length: n }, (_, i) => out[Math.round(i * k)]); }
  return out;
}

export class Workshop {
  constructor(app, o = {}) {
    this.app = app; this.o = o; this.noStick = true; this.isBench = true;
    const b = shelf.bench(); this.D = (b && checkDesign(b.design)) || freshDesign(); this.seal = b && b.sealed ? b.sealed : null;
    this.tool = o.tool || 'light'; this.hist = o.hist || []; this.g = null; this.lastP = null; this.armNew = 0; this.mirror = o.mirror ?? !!(b && b.mirror);
  }
  get sealed() { return this.seal && this.seal.h === chamberHash(this.D) ? this.seal : null; }
  enter() {
    const app = this.app;
    app.travel((aspect) => this.spec(aspect), { mass: this.D.mass }, {
      minDark: this.o.result ? 2.4 : 0.4,
      onDark: () => { app.applyBudget(); if (this.o.result) app.hud.showResult(this.o.result); },
      onLoad: (W) => this.calm(W),
      onReveal: () => { app.hud.hideResult(); app.hud.showTitle('', 'The Workshop', this.sealed ? `${chamberName(chamberHash(this.D))} · sealed — ready to hand on` : 'make a chamber · play it through · hand it to anyone'); app.hud.setCorner(true, () => app.pause()); this.music(); this.tray(); },
    });
  }
  // the bench is laid out above the tray, never under it: the room is fitted into the window less the tray's height
  spec(aspect) { const pb = this.padB(), a = aspect / (1 - pb); this.f = layout(a); const s = buildChamber(this.D, a, true); s.padB = pb; return s; }
  padB() { const k = this.app.hud.k || 1, h = (typeof window !== 'undefined' && window.innerHeight) || 720; return Math.min(0.32, (184 * k + 8) / h); }
  music() { this.app.sound.ambience((PLATES[this.D.pal] || PLATES[0]).music); }
  exit() { if (this.el) this.el.remove(); this.el = null; this.app.hud.root.classList.remove('bench'); }
  // on the bench nothing hungers: everything alive sleeps where it was set down
  calm(W) { W.massCosts = false; for (const C of W.colonies) for (const O of C.orgs) O.dormant = true; }
  poreReady() { return false; }
  poreProgress() { return 0; }
  post(dt, W) { if (!W.player.orgs.some(o => o.alive)) { const sp = W.spec.spawn; W.player.spawn(sp.x, sp.y, this.D.mass); for (const O of W.player.orgs) O.dormant = true; } }
  pauseSub() { return this.sealed ? `${chamberName(chamberHash(this.D))} · sealed` : 'the Workshop'; }
  pauseItems() {
    const app = this.app; return [{ label: 'Play it', fn: () => { app.resume(); this.play(); } },
      ...(this.sealed ? [{ label: 'Copy this chamber', fn: (b) => { app.copyText(packChamber(this.D, this.sealed)); b.textContent = 'Copied ✓'; } }] : []),
      { label: 'Clear the bench', fn: () => { app.resume(); this.clearBench(); } }];
  }
  onEvent(e) {
    const app = this.app; if (app.state !== 'play' || app.paused) return false;
    if (e.type === 'key') { if (e.code === 'KeyZ') { this.undo(); return true; } return false; }
    if (e.type === 'confirm') { this.play(); return true; }
    // a quick click can come and go between two frames, never seen by the hand that watches the pointers: it is still a tap
    if ((e.type === 'click' || e.type === 'tap') && !this.g) { const [x, y] = app.R.cssToWorld(e.x, e.y); const G = { x0: x, y0: y, x, y, pts: [[x, y]], moved: 0, tool: this.tool, lit: [], doomed: [] }; if (G.tool === 'light') this.lightAt(G, x, y); this.finish(G); return true; }
    return e.type === 'click' || e.type === 'tap' || e.type === 'press' || e.type === 'dartDir' || e.type === 'dartKey' || e.type === 'budAt' || e.type === 'budKey' || e.type === 'cycle';
  }

  // ── the design ────────────────────────────────────────────────────────
  save() { shelf.setBench({ design: this.D, sealed: this.seal, mirror: this.mirror }); }
  // the mirror: across the room's long midline (v → 1000 − v), angles reflected with it; what sits on the midline is not doubled
  mirrorItem(it) {
    const m = (v) => 1000 - v; if (it[0] === 'w' || it[0] === 'l') { const head = it[0] === 'w' ? 2 : 1, q = it.slice(0, head); let near = true; for (let i = head; i + 1 < it.length; i += 2) { q.push(it[i], m(it[i + 1])); if (Math.abs(it[i + 1] - 500) > 22) near = false; } return near ? null : q; }
    if (Math.abs(it[2] - 500) < 22) return null; const q = [it[0], it[1], m(it[2])]; if (it.length > 3) q.push((6283 - it[3]) % 6283); if (it.length > 4) q.push(it[4]);
    // a wheel's mirror image turns the other way round
    if (isTurning(it[0])) { if (q.length < 4) q.push(0); if (it[5] < 0) q.length = isSized(it[0]) ? 5 : 4; else { if (q.length < 5) q.push(isSized(it[0]) ? 96 : 0); q.push(-1); } }
    return q;
  }
  mirrorXY(x, y) { const [u, v] = toUV(this.f, x, y), q = this.f.P(u / 1000, (1000 - v) / 1000); return [q.x, q.y]; }
  change(fn, relay = true) { this.hist.push(JSON.stringify(this.D)); if (this.hist.length > 80) this.hist.shift(); fn(); this.save(); if (relay) this.relay(); this.refresh(); }
  undo() { const s = this.hist.pop(); if (!s) { this.app.hud.toast('nothing to undo', '↶', 'cool'); return; } const pal = this.D.pal; this.D = JSON.parse(s); this.save(); this.app.sound.ui(); if (this.D.pal !== pal) { this.reenter(); return; } this.relay(); this.refresh(); }
  clearBench() { this.change(() => { const f = freshDesign(); f.pal = this.D.pal; this.D = f; }); this.app.hud.toast('a clean bench', '✚', 'cool'); }
  // the bench re-laid in place, without an iris: the plate is the same (walls are wet glass, not yet in it), everything on it is new
  relay() { const app = this.app; app.relay(this.spec(app.R.fb.w / app.R.fb.h), { mass: this.D.mass }, (W) => this.calm(W)); }
  reenter() { this.app.setMode(new Workshop(this.app, { tool: this.tool, hist: this.hist, mirror: this.mirror })); }
  play() { this.save(); this.app.sound.ui(); this.app.setMode(new Trial(this.app, { design: JSON.parse(JSON.stringify(this.D)), own: true })); }
  // one more thing on the bench, alive at once (no re-laying: a gear set down starts turning, a school starts swimming)
  liveAdd(it) {
    const app = this.app, W = app.world, R = app.R; const o = { bench: true, geo: [], ents: [], rivals: [], blobs: [], keys: [], pads: [], doors: [], n: 500 + this.D.items.length, mass: this.D.mass };
    KINDS[it[0]](it, this.f, o); for (const g of o.doors) { g.need = 'never'; o.ents.push(g); }
    let baked = false; for (const d of o.ents) { const e = W.spawn(d); if (e && e.bake && R.room) { R.room.decals.push(e); R.ink.target(true); e.bake(R.ink, R); R.ink.target(false); baked = true; } }
    if (baked) R.fb.invalidate();
    for (const r of o.rivals) { const C = W.addRival(r.kind, r.x, r.y, r.n); if (C) for (const O of C.orgs) O.dormant = true; }
    for (const b of o.blobs) W.blob(b.x, b.y, b.n, b.mat);
  }
  pts(it, from) { const out = []; for (let i = from; i + 1 < it.length; i += 2) { const q = this.f.P(it[i] / 1000, it[i + 1] / 1000); out.push([q.x, q.y]); } return out; }
  xy(q) { return this.f.P(q[0] / 1000, q[1] / 1000); }
  wallR(it) { const pen = PENS[it[1]] || PENS[0]; return (it.length <= 4 ? BOULDER : 1) * pen.r; }
  nearWall(x, y, clr) { for (const it of this.D.items) { if (it[0] !== 'w') continue; const P = this.pts(it, 2), r = this.wallR(it); if (P.length === 1) { if (Math.hypot(x - P[0][0], y - P[0][1]) - r < clr) return true; continue; } for (let i = 0; i + 1 < P.length; i++) if (segD([x, y], P[i], P[i + 1]) - r < clr) return true; } return false; }
  roomFor(x, y, clr) { return this.app.world.phys.sampleSDF(x, y) >= Math.min(clr, 60) && !this.nearWall(x, y, clr); }
  sleeperR() { const F = this.app.world.player && this.app.world.player.focus; return F ? F.B.r : Math.sqrt(this.D.mass) * 2.6; }
  lights() { let n = 0; for (const it of this.D.items) if (it[0] === 'l') n += (it.length - 1) >> 1; return n; }
  // what a finger is over: [item, j] (j: which light of a painted line; −1 for the whole thing)
  pickAt(x, y, reach) {
    let best = null, bd = reach;
    for (const it of this.D.items) {
      if (it[0] === 'w') { const P = this.pts(it, 2), r = this.wallR(it); let d = 1e9; if (P.length === 1) d = Math.hypot(x - P[0][0], y - P[0][1]); else for (let i = 0; i + 1 < P.length; i++) d = Math.min(d, segD([x, y], P[i], P[i + 1])); if (d - r < bd) { bd = d - r; best = [it, -1]; } }
      else if (it[0] === 'l') { for (let j = 1; j + 1 < it.length; j += 2) { const q = this.xy([it[j], it[j + 1]]); const d = Math.hypot(q.x - x, q.y - y) - 6; if (d < bd) { bd = d; best = [it, j]; } } }
      else { const q = this.xy([it[1], it[2]]); const d = Math.hypot(q.x - x, q.y - y) - 18; if (d < bd) { bd = d; best = [it, -1]; } }
    }
    return best;
  }
  remove(list) {
    const whole = new Set(list.filter(q => q[1] < 0).map(q => q[0])), some = new Map(); for (const [it, j] of list) if (j >= 0) { if (!some.has(it)) some.set(it, new Set()); some.get(it).add(j); }
    const out = []; for (const it of this.D.items) { if (whole.has(it)) continue; const js = some.get(it); if (!js) { out.push(it); continue; } const q = [it[0]]; for (let j = 1; j + 1 < it.length; j += 2) if (!js.has(j)) q.push(it[j], it[j + 1]); if (q.length >= 3) out.push(q); }
    this.D.items = out;
  }

  // ── hands on the bench: a press, perhaps a drag, a release ────────────
  frame() { const app = this.app; if (app.state !== 'play' || app.paused) { this.g = null; return; } this.gesture(); }
  gesture() {
    const inp = this.app.input; let p = null; for (const q of inp.pointers.values()) if (q.role === 'dart' || q.role === 'stick') { p = q; break; }
    const G = this.g; if (G) { if (p === G.p) this.track(G); else { this.g = null; this.finish(G); } }
    if (!this.g && p && p !== this.lastP) { this.lastP = p; this.g = this.begin(p); }
  }
  begin(p) { const [x, y] = this.app.R.cssToWorld(p.x0, p.y0); const G = { p, x0: x, y0: y, x, y, pts: [[x, y]], moved: 0, tool: this.tool, lit: [], doomed: [] }; if (G.tool === 'light') this.lightAt(G, x, y); if (G.tool === 'move') G.held = this.holdAt(x, y); return G; }
  // what the move tool takes hold of: the sleeper, the way out, or a thing ([item, j] as pickAt)
  holdAt(x, y) { const S = this.xy(this.D.start), Q = this.xy(this.D.pore); if (Math.hypot(x - S.x, y - S.y) < this.sleeperR() + 14) return 'start'; if (Math.hypot(x - Q.x, y - Q.y) < 40) return 'pore'; return this.pickAt(x, y, 30); }
  track(G) {
    const p = G.p, [x, y] = this.app.R.cssToWorld(p.x, p.y); G.x = x; G.y = y; G.moved = Math.max(G.moved, Math.hypot(p.x - p.x0, p.y - p.y0));
    const last = G.pts[G.pts.length - 1]; if (Math.hypot(x - last[0], y - last[1]) >= 5 && G.pts.length < 800) G.pts.push([x, y]);
    if (G.tool === 'light') { const q = G.lit[G.lit.length - 1]; if (!q || Math.hypot(x - q[0], y - q[1]) >= 36) this.lightAt(G, x, y); }
    if (G.tool === 'erase' && G.moved >= 10) { const h = this.pickAt(x, y, 16); if (h && !G.doomed.some(q => q[0] === h[0] && q[1] === h[1])) { G.doomed.push(h); this.app.sound.pop(0.3); } }
  }
  lightAt(G, x, y) {
    const app = this.app, W = app.world; if (W.phys.sampleSDF(x, y) < 14 || this.nearWall(x, y, 10)) return false;
    if (this.lights() + G.lit.length + (G.mlit ? G.mlit.length : 0) >= LIMITS.lights) { if (!G.full) { G.full = true; app.hud.toast('the bench holds no more light', '✦', 'cool'); } return false; }
    W.spawn({ type: 'mote', x, y, value: 2, free: true }); G.lit.push([x, y]); app.sound.chime && app.sound.chime(G.lit.length - 1, x / W.spec.W * 1.6 - 0.8);
    if (this.mirror) { const [mx, my] = this.mirrorXY(x, y); if (Math.hypot(mx - x, my - y) > 30 && W.phys.sampleSDF(mx, my) >= 14 && !this.nearWall(mx, my, 10)) { W.spawn({ type: 'mote', x: mx, y: my, value: 2, free: true }); (G.mlit || (G.mlit = [])).push([mx, my]); } }
    return true;
  }
  finish(G) {
    const app = this.app, W = app.world, f = this.f, tap = G.moved < 10, t = TOOLS.find(q => q.id === G.tool) || {};
    if (G.tool === 'erase') {
      const list = tap ? [this.pickAt(G.x0, G.y0, 30)].filter(Boolean) : G.doomed; if (!list.length) return;
      this.change(() => this.remove(list)); app.sound.pop(0.5); W.fx.ring(G.x, G.y, [1, 0.5, 0.4], 40, 0.35); return;
    }
    if (G.tool === 'move') {
      const h = G.held; if (!h || tap) return;
      if (h === 'start' || h === 'pore') { G.tool = h; return this.finish({ ...G, moved: 10, tool: h }); }
      const [u0, v0] = toUV(f, G.x0, G.y0), [u1, v1] = toUV(f, G.x, G.y), du = u1 - u0, dv = v1 - v0; const [it, j] = h, c = (q) => Math.max(20, Math.min(980, q));
      const from = it[0] === 'w' ? 2 : 1, to = it[0] === 'w' || it[0] === 'l' ? it.length : 3;
      if (it[0] !== 'w') { const q = it[0] === 'l' ? this.xy([it[j], it[j + 1]]) : this.xy([it[1], it[2]]), dx = G.x - G.x0, dy = G.y - G.y0; if (W.phys.sampleSDF(q.x + dx, q.y + dy) < 12) { app.hud.toast('that would be inside the stone', '✥', 'cool'); return; } }
      this.change(() => { if (j >= 0) { it[j] = c(it[j] + du); it[j + 1] = c(it[j + 1] + dv); } else for (let i = from; i + 1 < to; i += 2) { it[i] = c(it[i] + du); it[i + 1] = c(it[i + 1] + dv); } });
      app.sound.plate(true); return;
    }
    if (G.tool === 'start' || G.tool === 'pore') {
      const x = tap ? G.x0 : G.x, y = tap ? G.y0 : G.y, S = this.xy(this.D.start), Q = this.xy(this.D.pore);
      if (G.tool === 'start' && tap && Math.hypot(x - S.x, y - S.y) < this.sleeperR() + 18) { const k = (SIZES.indexOf(this.D.mass) + 1) % SIZES.length; this.change(() => { this.D.mass = SIZES[k]; }); app.hud.toast(`the sleeper · ${['small', 'as it was', 'large', 'great'][k]}`, '☉', 'cool'); return; }
      if (!this.roomFor(x, y, G.tool === 'start' ? this.sleeperR() + 14 : 52)) { app.hud.toast(G.tool === 'start' ? 'not enough room to wake there' : 'not enough room for the way out there', G.tool === 'start' ? '☉' : '◎', 'cool'); return; }
      const other = G.tool === 'start' ? Q : S; if (Math.hypot(x - other.x, y - other.y) < 150) { app.hud.toast('the sleeper and the way out need some room between them', '◎', 'cool'); return; }
      this.change(() => { if (G.tool === 'start') this.D.start = toUV(f, x, y); else this.D.pore = toUV(f, x, y); }); app.sound.plate(true); return;
    }
    if (!t.k) return;
    if (this.D.items.length >= LIMITS.items) { app.hud.toast('the bench is full — erase something first', '✚', 'cool'); return; }
    if (t.k === 'l') { if (!G.lit.length) return; const it = ['l']; for (const q of G.lit) it.push(...toUV(f, q[0], q[1])); const mi = G.mlit && G.mlit.length ? ['l', ...G.mlit.flatMap(q => toUV(f, q[0], q[1]))] : null; this.change(() => { this.D.items.push(it); if (mi) this.D.items.push(mi); }, false); this.refresh(); return; }
    if (t.k === 'w') { this.wall(G, t.pen, tap); return; }
    let x = G.x0, y = G.y0, a, len; const dx = G.x - G.x0, dy = G.y - G.y0, dist = Math.hypot(dx, dy);
    if (t.k === 'D' || t.k === 'fm') { if (tap) { a = f.land ? Math.PI / 2 : 0; len = t.k === 'D' ? 130 : 170; } else { x += dx / 2; y += dy / 2; a = Math.atan2(dy, dx); len = clamp(dist, 50, 360); } }
    else if (t.k === 'ro') { a = 0; len = tap ? 96 : clamp(dist, 50, 220); }
    else if (isAimed(t.k)) {
      if (!tap) a = Math.atan2(dy, dx);
      else if (t.k === 'cu') a = f.land ? 0 : Math.PI / 2;
      else if (t.k === 'pd') a = -Math.PI / 2;
      else { const cx = W.spec.W / 2 - x, cy = W.spec.H / 2 - y; a = Math.hypot(cx, cy) > 20 ? Math.atan2(cy, cx) : -Math.PI / 2; }
    }
    if (W.phys.sampleSDF(x, y) < 12) { app.hud.toast('that is inside the stone', '✕', 'cool'); return; }
    const it = [t.k, ...toUV(f, x, y)]; if (a !== undefined) it.push(angToUV(f, a)); if (len !== undefined) it.push(Math.round(len));
    let mi = this.mirror && this.D.items.length + 1 < LIMITS.items ? this.mirrorItem(it) : null; if (mi) { const q = this.xy([mi[1], mi[2]]); if (W.phys.sampleSDF(q.x, q.y) < 12) mi = null; }
    this.change(() => { this.D.items.push(it); if (mi) this.D.items.push(mi); }, false); this.liveAdd(it); W.fx.ring(x, y, [0.8, 0.9, 1], 50, 0.4);
    if (mi) { this.liveAdd(mi); const q = this.xy([mi[1], mi[2]]); W.fx.ring(q.x, q.y, [0.8, 0.9, 1], 50, 0.4); } app.sound.pop(0.6); this.refresh();
  }
  // a wall: the stroke, its wobble taken out, kept off the sleeper and the way out (a stroke across either is cut in two round it)
  wall(G, pen, tap) {
    const app = this.app, W = app.world, f = this.f, P = PENS[pen] || PENS[0], S = this.xy(this.D.start), Q = this.xy(this.D.pore), sr = this.sleeperR();
    const keep = (x, y, r) => Math.hypot(x - S.x, y - S.y) > r + sr + 30 && Math.hypot(x - Q.x, y - Q.y) > r + 46 && W.phys.sampleSDF(x, y) > -r;
    const items = [], strokes = [G.pts]; if (this.mirror) { const m = G.pts.map(q => this.mirrorXY(q[0], q[1])); if (m.some((q, i) => Math.hypot(q[0] - G.pts[i][0], q[1] - G.pts[i][1]) > 44)) strokes.push(m); }
    if (tap) { for (const S0 of strokes) if (keep(S0[0][0], S0[0][1], P.r * BOULDER)) items.push(['w', pen, ...toUV(f, S0[0][0], S0[0][1])]); }
    else for (const pts of strokes) { let run = []; const runs = []; for (const q of pts) { if (keep(q[0], q[1], P.r)) run.push(q); else { if (run.length >= 2) runs.push(run); run = []; } } if (run.length >= 2) runs.push(run);
      for (const r of runs) { const s = simplify(r, 2.5, LIMITS.pts); if (s.length >= 2) { const it = ['w', pen]; for (const q of s) it.push(...toUV(f, q[0], q[1])); items.push(it); } } }
    if (!items.length) { app.hud.toast('glass will not set on the sleeper or the way out', PEN_G[pen], 'cool'); return; }
    if (this.D.items.length + items.length > LIMITS.items) { app.hud.toast('the bench is full — erase something first', '✚', 'cool'); return; }
    this.change(() => this.D.items.push(...items), false); for (const it of items) this.liveAdd(it); app.sound.louvre(false); this.refresh();
  }

  // ── the tray ──────────────────────────────────────────────────────────
  tray() {
    if (this.el) this.el.remove();
    const el = this.el = document.createElement('div'); el.className = 'h-tray ws';
    el.innerHTML = `<div class="ws-stat"></div><div class="ws-acts">${ACTS.map(([id, g, tip]) => `<button data-act="${id}" title="${tip}"${id === 'play' ? ' class="go"' : ''}>${g}</button>`).join('')}</div>`
      + `<div class="row">${TOOLS.map(q => `<button data-id="${q.id}" title="${q.name}">${q.g}</button>`).join('')}</div><div class="tip"></div>`;
    { const row = el.querySelector('.row'); row.addEventListener('wheel', (e) => { row.scrollLeft += e.deltaY || e.deltaX; e.preventDefault(); }, { passive: false }); }
    // a tool answers the moment the finger lifts (a click can trail a touch by a good fraction of a second — long enough for the next touch on the glass
    // to be made with the old tool); a finger that slid is scrolling the row, not choosing. The click stays, for keys and for anything else.
    el.querySelectorAll('button').forEach(b => {
      const go = () => { if (b.dataset.act) this.act(b.dataset.act); else { this.tool = b.dataset.id; this.app.sound.ui(); this.refresh(); } };
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b._p = [e.clientX, e.clientY]; });
      b.addEventListener('pointerup', (e) => { e.stopPropagation(); const q = b._p; b._p = null; if (q && Math.hypot(e.clientX - q[0], e.clientY - q[1]) < 12) { b._t = performance.now(); go(); } });
      b.onclick = (e) => { e.stopPropagation(); if (performance.now() - (b._t || 0) < 700) return; go(); };
    });
    this.app.hud.root.appendChild(el); this.refresh();
    // what the bench says is said above the tray, never over it
    this.app.hud.root.classList.add('bench'); requestAnimationFrame(() => this.fitTray());
  }
  fitTray() { if (this.el && typeof innerHeight !== 'undefined') this.app.hud.root.style.setProperty('--tray', Math.max(0, innerHeight - this.el.getBoundingClientRect().top) + 'px'); }
  act(id) {
    const app = this.app; if (app.state !== 'play') return; app.sound.ui();
    if (id === 'play') return this.play();
    if (id === 'undo') return this.undo();
    if (id === 'erase' || id === 'move') { this.tool = id; this.refresh(); return; }
    if (id === 'mirror') { this.mirror = !this.mirror; this.save(); this.refresh(); app.hud.toast(this.mirror ? 'mirror · what you make appears again across the middle' : 'no mirror', '◫', 'cool'); return; }
    if (id === 'plate') { this.change(() => { this.D.pal = (this.D.pal + 1) % PLATES.length; }, false); app.hud.toast(`the plate · ${PLATES[this.D.pal].name}`, '◐', 'cool'); this.reenter(); return; }
    if (id === 'down') { this.change(() => { this.D.down = this.D.down >= 0 ? -1 : angToUV(this.f, Math.PI / 2); }); app.hud.toast(this.D.down >= 0 ? 'the chamber has a down' : 'weightless again', '⇣', 'cool'); return; }
    if (id === 'copy') { const s = this.sealed; if (!s) { app.hud.toast('play it through once — then it can be handed on', '⇪', 'cool'); return; } app.copyText(packChamber(this.D, s)); app.hud.toast(`${chamberName(chamberHash(this.D))} · copied <small>whoever plays it races your ${s.t.toFixed(1)} s</small>`, '⇪'); return; }
    if (id === 'new') { if (performance.now() - this.armNew > 3000) { this.armNew = performance.now(); app.hud.toast('tap ✚ again to clear the bench', '✚', 'cool'); return; } this.armNew = 0; this.clearBench(); }
  }
  refresh() {
    const el = this.el; if (!el) return; const t = TOOLS.find(q => q.id === this.tool); this.fitTray();
    el.querySelectorAll('button[data-id]').forEach(b => b.classList.toggle('on', b.dataset.id === this.tool));
    el.querySelectorAll('button[data-act]').forEach(b => { const a = b.dataset.act; b.classList.toggle('on', (a === 'erase' || a === 'move') && this.tool === a || a === 'down' && this.D.down >= 0 || a === 'mirror' && this.mirror); b.classList.toggle('dim', a === 'copy' && !this.sealed || a === 'undo' && !this.hist.length); });
    el.querySelector('.tip').textContent = this.tool === 'erase' ? 'erase · tap a thing, or drag across things' : this.tool === 'move' ? 'move · drag a thing — or the sleeper, or the way out — to where it should be' : t ? t.name : '';
    el.querySelector('.ws-stat').textContent = this.stat();
  }
  stat() {
    let L = 0, S = 0, Dn = 0; for (const it of this.D.items) { if (it[0] === 'L') L++; else if (it[0] === 'S') S++; else if (it[0] === 'D') Dn++; }
    const W = this.app.world, n = W && W.pickups ? W.pickups.filter(p => p.isMote && !p.dead && !p.d.gift).length : this.lights();
    const parts = [`${n} light${n === 1 ? '' : 's'}`, n ? `the way out at ${Math.ceil(n * 0.6)}` : 'the way out is open'];
    if (L) parts.push(`${L} lantern${L > 1 ? 's' : ''}`); if (Dn) parts.push(S ? `${Dn} door${Dn > 1 ? 's' : ''}, ${S} switch${S > 1 ? 'es' : ''}` : `${Dn} door${Dn > 1 ? 's' : ''} · open with the way out`);
    parts.push(this.sealed ? `✦ sealed · ${this.sealed.t.toFixed(1)} s` : 'play it through to seal it');
    return parts.join(' · ');
  }

  // ── what the hand is doing, drawn on the glass ────────────────────────
  overlay(ov, R) {
    const app = this.app, G = this.g; if (!this.f || app.paused) return;
    const cool = [0.62, 0.92, 1], warm = [1, 0.8, 0.55], red = [1, 0.42, 0.36];
    if (this.mirror) { const a = this.f.P(0.05, 0.5), b = this.f.P(0.95, 0.5); ov.line(a.x, a.y, b.x, b.y, 1.2, cool, 0.16); }
    const mark = (it, j, col, a) => { if (it[0] === 'w') { const P = this.pts(it, 2), r = this.wallR(it); if (P.length === 1) ov.ring(P[0][0], P[0][1], r + 5, 2, col, a); else for (let i = 0; i + 1 < P.length; i++) ov.line(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], r * 2 + 8, col, a * 0.35); } else if (it[0] === 'l') { const q = this.xy([it[j], it[j + 1]]); ov.ring(q.x, q.y, 13, 1.6, col, a); } else { const q = this.xy([it[1], it[2]]); ov.ring(q.x, q.y, 30, 1.8, col, a); } };
    if (G) {
      const t = TOOLS.find(q => q.id === G.tool) || {}, drag = G.moved >= 10;
      if (t.k === 'w' && drag) { const pen = PENS[t.pen]; for (let i = 1; i < G.pts.length; i++) { const a = G.pts[i - 1], b = G.pts[i]; ov.line(a[0], a[1], b[0], b[1], pen.r * 2, cool, 0.14); ov.line(a[0], a[1], b[0], b[1], 1.4, [0.92, 0.98, 1], 0.75);
        if (this.mirror) { const ma = this.mirrorXY(a[0], a[1]), mb = this.mirrorXY(b[0], b[1]); ov.line(ma[0], ma[1], mb[0], mb[1], pen.r * 2, cool, 0.08); ov.line(ma[0], ma[1], mb[0], mb[1], 1.2, [0.92, 0.98, 1], 0.4); } } }
      else if ((t.k === 'D' || t.k === 'fm') && drag) ov.line(G.x0, G.y0, G.x, G.y, t.k === 'D' ? 24 : 7, cool, 0.4);
      else if (t.k === 'ro' && drag) ov.ring(G.x0, G.y0, clamp(Math.hypot(G.x - G.x0, G.y - G.y0), 50, 220), 9, cool, 0.4);
      else if (t.k && isAimed(t.k) && drag) { const dx = G.x - G.x0, dy = G.y - G.y0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, L = Math.min(d, 160), hx = G.x0 + ux * L, hy = G.y0 + uy * L; ov.line(G.x0, G.y0, hx, hy, 2.2, warm, 0.85); ov.line(hx, hy, hx - ux * 14 - uy * 9, hy - uy * 14 + ux * 9, 2.2, warm, 0.85); ov.line(hx, hy, hx - ux * 14 + uy * 9, hy - uy * 14 - ux * 9, 2.2, warm, 0.85); }
      else if (G.tool === 'erase') for (const [it, j] of G.doomed) mark(it, j, red, 0.9);
      else if (G.tool === 'move' && G.held && drag) { const dx = G.x - G.x0, dy = G.y - G.y0, h = G.held; ov.line(G.x0, G.y0, G.x, G.y, 1.4, warm, 0.6);
        if (h === 'start' || h === 'pore') ov.ring(G.x, G.y, h === 'start' ? this.sleeperR() + 6 : 34, 1.8, warm, 0.8);
        else { const [it, j] = h; if (it[0] === 'w') { const P = this.pts(it, 2), r = this.wallR(it); if (P.length === 1) ov.ring(P[0][0] + dx, P[0][1] + dy, r, 2, warm, 0.8); else for (let i = 0; i + 1 < P.length; i++) ov.line(P[i][0] + dx, P[i][1] + dy, P[i + 1][0] + dx, P[i + 1][1] + dy, r * 2, warm, 0.3); } else { const q = it[0] === 'l' ? this.xy([it[j], it[j + 1]]) : this.xy([it[1], it[2]]); ov.ring(q.x + dx, q.y + dy, it[0] === 'l' ? 13 : 30, 1.8, warm, 0.8); } } }
      else if ((G.tool === 'start' || G.tool === 'pore') && drag) ov.ring(G.x, G.y, G.tool === 'start' ? this.sleeperR() + 6 : 34, 1.6, warm, 0.7);
      return;
    }
    const inp = app.input; if (inp.device !== 'mouse' || !inp.mouse.inside) return;
    const [x, y] = R.cssToWorld(inp.mouse.x, inp.mouse.y);
    if (this.tool === 'erase') { const h = this.pickAt(x, y, 30); if (h) mark(h[0], h[1], red, 0.75); return; }
    if (this.tool === 'move') { const h = this.holdAt(x, y); if (h === 'start' || h === 'pore') { const q = this.xy(h === 'start' ? this.D.start : this.D.pore); ov.ring(q.x, q.y, h === 'start' ? this.sleeperR() + 6 : 34, 1.6, warm, 0.7); } else if (h) mark(h[0], h[1], warm, 0.7); return; }
    const t = TOOLS.find(q => q.id === this.tool) || {};
    const r = t.k === 'w' ? PENS[t.pen].r : t.k === 'l' ? 8 : this.tool === 'start' ? this.sleeperR() : this.tool === 'pore' ? 34 : 26;
    ov.ring(x, y, r, 1.2, cool, 0.45);
  }
}

// ── a made chamber, played: the Odyssey's own rules (three stars, tricks, an echo to race), its own room, its own record ──
export class Trial extends Odyssey {
  constructor(app, o = {}) {
    super(app, 0, { single: true }); this.o = o; this.D = o.design; this.h = chamberHash(this.D); this.own = !!o.own; this.given = o.run || null; this.nameOf = chamberName(this.h);
    if (!this.own) shelf.addGift({ h: this.h, name: this.nameOf, code: packChamber(this.D, this.bestRun()) });
  }
  chamber() { const D = this.D; return { id: 'made-' + this.h.toString(36), name: this.nameOf, par: this.parTime(), quota: 0.6, build: (a) => buildChamber(D, a, false) }; }
  numeral() { return ''; }
  // the record to beat: the best run anyone has brought to this chamber (yours, or the one it was handed over with)
  bestRun() { const mine = shelf.run(this.h), g = this.given, b = this.own ? (shelf.bench() || {}).sealed : null; let best = null; for (const r of [mine, g, b && b.h === this.h ? b : null]) if (r && r.t > 0 && r.p && (!best || r.t < best.t)) best = r; return best ? { t: best.t, p: best.p } : null; }
  parTime() { const r = this.bestRun(); return r ? Math.ceil(r.t * 10) / 10 : 0; }
  titleSub() { const p = this.room.par; return (this.own ? 'a chamber of your own' : 'a chamber handed to you') + (p ? ` · ${p.toFixed(1)} s to beat` : this.own ? ' · play it through to seal it' : ''); }
  pauseSub() { return this.room.name; }
  music() { this.app.sound.ambience((PLATES[this.D.pal] || PLATES[0]).music); }
  isLast() { return false; }
  resultName() { return this.room.name; }
  pauseItems() {
    const app = this.app, items = [];
    if (this.own) items.push({ label: 'Back to the bench', fn: () => { app.resume(); app.setMode(new Workshop(app)); } });
    const sealed = !this.own || ((shelf.bench() || {}).sealed || {}).h === this.h;
    if (sealed) items.push({ label: 'Copy this chamber', fn: (b) => { app.copyText(packChamber(this.D, this.bestRun())); b.textContent = 'Copied ✓'; } });
    return items;
  }
  // your own best run comes back as a pale bead; the record the chamber was handed over with, as a blue one
  wakeEcho(W) {
    this.rec = []; this.recT = 0; this.echo = null; this.rival = null; this.air = 0; this.groundT = 0;
    const skin = W.host && W.host.skin ? W.host.skin() : null, hue = skin && skin.emit ? skin.emit : [1, 0.72, 0.5];
    const mine = shelf.run(this.h); if (mine && mine.p) { const pts = unpackEcho(mine.p); if (pts && pts.length > 4) this.echo = W.spawn({ type: 'echo', pts, time: mine.t, col: [hue[0] * 0.5 + 0.5, hue[1] * 0.5 + 0.5, hue[2] * 0.5 + 0.5] }); }
    const g = this.given; if (g && g.p && !(mine && mine.p === g.p)) { const pts = unpackEcho(g.p); if (pts && pts.length > 4) this.rival = W.spawn({ type: 'echo', pts, time: g.t, col: [0.55, 0.95, 1], rival: true }); }
  }
  record(stars, W) {
    const t = +W.roomTime.toFixed(2), mine = shelf.run(this.h), better = !mine || t < mine.t - 0.01, before = this.bestRun();
    const p = this.rec && this.rec.length > 4 && this.rec.length < 1500 ? packEcho(this.rec) : null;
    if (better && p) shelf.setRun(this.h, { t, p });
    this.note = '';
    if (this.own) {
      // the first time through seals it (now it may be handed on); a faster run becomes the record it carries
      const b = shelf.bench() || {}, seal = b.sealed && b.sealed.h === this.h ? b.sealed : null;
      if (!seal || t < seal.t - 0.01) { shelf.setBench({ ...b, design: b.design || this.D, sealed: { h: this.h, t, p: p || (seal && seal.p) || null } }); this.note = seal ? 'a new record for it' : 'sealed · ready to hand on';
        // a chamber of your own, sealed: the first ever is a trick found (and its picture); every one after keeps a picture of its own
        if (!seal) { if ((this.app.save.data.tricks || {}).Maker) this.app.moment && this.app.moment(this.nameOf, 'a chamber of your own, sealed', 'sealed:' + this.h, this.shot); this.trick('Maker'); } }
    } else {
      if (before && t < before.t - 0.01) this.note = `record beaten by ${(before.t - t).toFixed(1)} s`; else if (before) this.note = `the record is ${(t - before.t).toFixed(1)} s quicker`;
      shelf.addGift({ h: this.h, name: this.nameOf, code: packChamber(this.D, this.bestRun()) });
    }
    return { newBest: !!mine && better, firstClear: !mine };
  }
  after(result) {
    const app = this.app; if (this.note) result.next = this.note;
    if (this.own) app.setMode(new Workshop(app, { result })); else app.toHub({ result });
  }
}
