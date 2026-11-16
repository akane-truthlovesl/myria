// ─────────────────────────────────────────────────────────────────────────────
//  BLOOM — the living dish.
//  Grow from a mote-sized pearl into the apex light of a petri reef teeming with
//  stranger lights. Eat what is smaller, read what is bigger, outwit what is
//  stranger. Size is power — but darts, flanks, bluffs, thorns, pores and
//  timing decide every duel. A new mutated axiom rewrites the dish each day.
// ─────────────────────────────────────────────────────────────────────────────
import { SPACING, AREA_PER_P, H } from '../engine/physics.js';
import { MAT, M, MATS, PHASE } from '../engine/materials.js';
import { Organism } from '../game/organism.js';
import { sound } from '../audio/audio.js';
import { save } from '../game/save.js';
import { ARCH, BRAINS, RIVAL_TINTS, FragmentBrain } from '../game/ai.js';
import { buildDish, dailyAxiom, AXIOMS, TIDES, TIERS, tierOf, gyreAt, hashStr, todayKey, DISH_R } from '../levels/bloom.js';

const TAU = Math.PI * 2;
const BUDGET = 2600;          // total live particles in the dish
const FLOOR = 22;             // survival floor → Last Light
const MAX_MOTES = 130;

const CSS = `
.bl-axiom{font-size:11.5px;letter-spacing:.32em;text-transform:uppercase;color:rgba(160,255,220,.78);margin:-8px 0 14px}
.bl-score{font-size:34px;font-weight:300;letter-spacing:.14em;margin:2px 0 0;text-shadow:0 0 22px rgba(140,255,210,.35);font-variant-numeric:tabular-nums}
.bl-best{font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:rgba(200,240,230,.5);margin-bottom:14px}
.bl-dev{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;margin:12px auto 2px;max-width:420px;font-size:11px;letter-spacing:.1em;color:rgba(220,240,255,.72)}
.bl-dev span{white-space:nowrap}
.bl-dev i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
.bl-tag{position:absolute;left:max(14px,env(safe-area-inset-left));top:max(14px,env(safe-area-inset-top));font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:rgba(170,255,225,.42);transition:opacity 1s}
.bl-tag b{font-weight:400;color:rgba(200,255,235,.7)}
`;

function rgbCss(c, a = 1) { return `rgba(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)},${a})`; }
function hsl(h, s, l) { const a = s * Math.min(l, 1 - l); const f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }

export class Mode {
  constructor(G, app, opts = {}) { this.G = G; this.app = app; this.opts = opts; }

  // ── lifecycle ────────────────────────────────────────────────────────
  enter() {
    const G = this.G, P = G.phys, o = this.opts;
    if (!document.getElementById('bl-style')) { const st = document.createElement('style'); st.id = 'bl-style'; st.textContent = CSS; document.head.appendChild(st); }
    this.dayKey = todayKey();
    this.daily = !o.axiom && !o.random;
    this.axiom = o.axiom ? (AXIOMS.find(a => a.id === o.axiom) || dailyAxiom()) : o.random ? AXIOMS[Math.floor(Math.random() * AXIOMS.length)] : dailyAxiom(this.dayKey);
    this.seed = o.seed ?? (this.daily ? hashStr('dish:' + this.dayKey) : (Math.random() * 4294967296) >>> 0);
    const L = this.L = buildDish(this.seed, this.axiom);
    G.load(L);
    this.dishR = DISH_R;
    // a slow gyre circles the dish (riding it is speed; fighting it is drag)
    this.gyreK = this.axiom.gyre ?? 1; this.surge = 1; this.surgeT = 0;
    this.gyre = { x0: -DISH_R, x1: DISH_R, y0: -DISH_R, y1: DISH_R, flow: true, flowK: 0.32, fvx: 0, fvy: 0, flowAt: (x, y) => gyreAt(x, y, this.gyreK * this.surge) };
    P.zones.push(this.gyre);
    this.hole = null;
    if (this.axiom.singularity) { this.hole = G.spawnEntity({ type: 'singularity', x: 0, y: 0, r: 26, strength: 52000, reach: 640, swirl: 26000 }); }
    if (this.axiom.ferro) {
      this.magnets = [0, 1, 2, 3].map(k => { const a = k / 4 * TAU + 0.4; return G.spawnEntity({ type: 'magnet', x: Math.cos(a) * 820, y: Math.sin(a) * 820, power: 2.2, reach: 760, pulse: 3.2 + k * 0.7 }); });
    }
    // the player: a small coral pearl near the heart of the dish
    const sp = this.hole ? [520, 0] : [0, 0];
    const C = this.C = G.addColony(0, sp[0], sp[1], 70, {});
    G.cam.snap(sp[0], sp[1], G.baseZoom() * 1.15);
    // per-mode hooks on the game (undone in exit)
    this.dartK = this.axiom.dartK ?? 1;
    G.dartSpeed = 600 * this.dartK;
    G.dartCost = (O) => {
      if (O.colony) return (this.axiom.freeDarts || this.shellT > 0) ? 0 : Math.max(2, Math.round(O.B.count * 0.045));
      return O.arch === 'hunter' || O.arch === 'leviathan' ? 0 : Math.max(1, Math.round(O.B.count * 0.015));
    };
    G.onDart = (O, dx, dy, cost) => this.onAnyDart(O, dx, dy, cost);
    G.onMote = (m, B, chain) => { this.stats.motes++; if (chain === 12) this.trick('Gathering Song'); };
    G.onHurt = null;
    G.speedScale = this.axiom.speed ?? 1;
    // state
    this.ai = []; this.agents = []; this.motes = []; this.beads = [];
    this.groupSeq = 10; this.time = 0; this.tide = -1; this.spawnT = 1.0; this.ventT = 2; this.pulseT = 38;
    this.drinkAcc = new Map(); this.duels = new Map(); this.pendingSplits = [];
    this.shellT = 0; this.shellCD = 0; this.usedShell = false;
    this.tier = tierOf(C.mass); this.over = false; this.won = false; this.overT = 0; this.lev = null; this.levSpawned = false; this.levMass = 0;
    this.stats = { motes: 0, devoured: {}, devouredN: 0, devouredMass: 0, biggest: 0, biggestName: '', darts: 0, lostToPredators: 0, peak: C.mass, peakTier: this.tier };
    this.tricks = new Set(); this.trickCount = 0; this.trickT = new Map();
    G.radiance = 0; this.lastHurtBy = null;
    this.recentKills = []; this.drainedBy = null; this.drainT = 0; this.drainLost = 0;
    this.hurtT = 0; this.gainT = 0; this.lastPlayerDart = -9; this.poreArmed = true; this.untouched = true;
    this.cam0 = { x: sp[0], y: sp[1] };
    // seed life: motes, small fry, a grazer or two
    for (let k = 0; k < 60; k++) this.spawnMote(null, true);
    for (let k = 0; k < 8; k++) this.spawnAI('glimmer');
    for (let k = 0; k < 3; k++) this.spawnAI('grazer');
    this.spawnAI('oil');
    // presentation
    G.hud.showTitle('Bloom', `${this.axiom.glyph}  ${this.axiom.name} · ${this.axiom.sub}`, 4.2);
    G.hud.setCorner(true, () => this.pause());
    this.tag = document.createElement('div'); this.tag.className = 'bl-tag';
    this.tag.innerHTML = `${this.daily ? 'daily dish' : 'wild dish'} · <b>${this.axiom.glyph} ${this.axiom.name}</b>`;
    G.hud.root.appendChild(this.tag);
    sound.setKey(47, 'dorian'); sound.ambience('deep', 47);
    this.updateCounter(true);
    // debug hooks (?ff=seconds fast-forward, ?bot=1 autopilot) — for screenshots & balance runs
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    this.autopilot = !!(q && q.get('bot'));
    const ff = q ? +(q.get('ff') || 0) : 0;
    if (ff > 0) setTimeout(() => { for (let k = 0; k < ff * 60 && G.mode === this; k++) G.frame(1 / 60, false); }, 0);
  }

  // a simple autopilot: graze, hunt smaller prey, flee bigger threats
  pilot(dt) {
    const G = this.G, F = this.C.focus; if (!F || !F.alive) return;
    const B = F.B; let dx = 0, dy = 0, fx = 0, fy = 0, worst = 0, best = null, bv = 0;
    for (const a of this.agents) {
      if (a.isPlayer) continue;
      if (this.canEatBody(a.B, B) && a.am > B.count * 1.05) { const ex = B.cx - a.x, ey = B.cy - a.y, d = Math.hypot(ex, ey) - a.r - B.r; if (d < 320) { const w = (320 - d) / 320; fx += ex / (d + a.r + B.r) * w; fy += ey / (d + a.r + B.r) * w; worst = Math.max(worst, w); } }
      else if (!a.disguised && this.canEatBody(B, a.B) && a.am < B.count * 0.9) { const v = a.m / (Math.hypot(a.x - B.cx, a.y - B.cy) + 150); if (v > bv) { bv = v; best = a; } }
    }
    const m = this.nearestMote(B.cx, B.cy, 500);
    if (best && bv > 0.04) { dx = best.x - B.cx; dy = best.y - B.cy; } else if (m) { dx = m.x - B.cx; dy = m.y - B.cy; }
    if (worst > 0.15) { dx = fx * 3 + dx * 0.1; dy = fy * 3 + dy * 0.1; }
    if (this.hole) { const hx = B.cx - this.hole.x, hy = B.cy - this.hole.y, hd = Math.hypot(hx, hy) + 1; if (hd < 520) { dx += hx / hd * 3; dy += hy / hd * 3; } }
    const mm = Math.hypot(dx, dy) || 1; G.input.move.x = dx / mm; G.input.move.y = dy / mm;
    this._pdc = (this._pdc || 0) - dt;
    if (worst > 0.7 && this._pdc <= 0) { F.dart(fx, fy, 1); this._pdc = 1.2; }
    else if (best && this._pdc <= 0) { const d = Math.hypot(best.x - B.cx, best.y - B.cy) - best.r - B.r; if (d < 140 && d > 20 && best.m > 15) { F.dart(best.x - B.cx, best.y - B.cy, 1); this._pdc = 2.2; } }
  }

  exit() {
    const G = this.G;
    delete G.dartCost; delete G.onDart;
    G.onMote = null; G.onHurt = null; G.speedScale = 1; G.timeScale = 1; G.dartSpeed = 560;
    if (this.tag) this.tag.remove();
    G.hud.hideCounter();
  }

  // ── input ────────────────────────────────────────────────────────────
  events(evs) {
    const G = this.G, C = this.C;
    for (const e of evs) {
      if (e.type === 'pause') { if (G.hud.menuOpen) { G.hud.closeMenu(); G.paused = false; } else if (!G.hud.cardOpen) this.pause(); continue; }
      if (G.paused || this.over || !C) continue;
      const F = C.focus;
      if (e.type === 'dart' && F) {
        let dx = e.x, dy = e.y;
        if (e.key) { const m = G.input.move; if (Math.hypot(m.x, m.y) > 0.2) { dx = m.x; dy = m.y; } else { dx = F.facing.x; dy = F.facing.y; } }
        F.dart(dx, dy, e.power || 1);
      } else if (e.type === 'bud' && F) {
        let tx, ty;
        if (e.aimed) [tx, ty] = G.screenToWorld(e.x, e.y);
        else if (G.input.mouse.inside && performance.now() - G.input.mouse.t < 4000 && G.input.device !== 'pad') [tx, ty] = G.screenToWorld(G.input.mouse.x, G.input.mouse.y);
        else { const m = G.input.move; const d = Math.hypot(m.x, m.y) > 0.2 ? m : F.facing; tx = F.B.cx + d.x * 200; ty = F.B.cy + d.y * 200; }
        const NB = F.bud(tx, ty, 0.35);
        if (NB) C.adopt(NB);
      } else if (e.type === 'focusNext') C.cycle(e.dir);
      else if (e.type === 'tap') G.pickFocus(e.x, e.y);
    }
  }

  pause() {
    const G = this.G; if (this.over) return;
    G.paused = true; sound.ui();
    G.hud.openMenu('Bloom', [
      { label: 'Resume', cls: 'primary', fn: () => { G.hud.closeMenu(); G.paused = false; } },
      { label: 'Restart this dish', fn: () => { G.hud.closeMenu(); G.paused = false; this.restart(false); } },
      { label: 'A wild axiom', fn: () => { G.hud.closeMenu(); G.paused = false; this.restart(true); } },
      { label: sound.muted ? 'Sound: off' : 'Sound: on', fn: () => { sound.setMuted(!sound.muted); this.pause(); } },
      { label: 'Atrium', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.hub(); } },
    ], `${this.axiom.glyph} ${this.axiom.name} — ${this.axiom.sub}`);
  }
  restart(wild) {
    if (wild) this.app.startBloom({ random: true });
    else this.app.startBloom(this.daily ? {} : { axiom: this.axiom.id, seed: this.seed });
  }

  // ── world knowledge for brains ───────────────────────────────────────
  canEatBody(E, V) {
    if (!E || !V || E.group === V.group || E.group < 0) return false;
    const pe = M.phase[E.mat];
    if (pe !== PHASE.AQUA || M.phase[V.mat] !== pe) return false;
    if (V.group === 0 && this.shellT > 0) return false;
    return true;
  }
  canEatAgent(E, a) { return this.canEatBody(E, a.B); }
  nearestMote(x, y, range) {
    let best = null, bd = range * range;
    for (const m of this.motes) { if (m.dead) continue; const d = (m.x - x) ** 2 + (m.y - y) ** 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }
  quietSpot(B) {
    const F = this.C.focus;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * TAU, r = 200 + Math.random() * (DISH_R - 380);
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (this.G.phys.sampleSDF(x, y) < 80) continue;
      if (F && Math.hypot(F.B.cx - x, F.B.cy - y) < 520) continue;
      if (this.hole && Math.hypot(x - this.hole.x, y - this.hole.y) < 520) continue;
      return { x, y };
    }
    return { x: B.cx * 0.5, y: B.cy * 0.5 };
  }
  get playerMass() { return this.C ? this.C.mass : 0; }
  get focusMass() { const F = this.C && this.C.focus; return F && F.alive ? F.B.count : this.playerMass; }

  buildAgents() {
    const A = this.agents; A.length = 0;
    const add = (O, isPlayer) => {
      const B = O.B, br = O.brain;
      const bluff = br && br.bluff ? br.bluff : 1;
      A.push({ O, B, x: B.cx, y: B.cy, vx: B.vx, vy: B.vy, r: B.r * bluff, rTrue: B.r, m: B.count, am: B.count * bluff * bluff,
        arch: O.arch || 'player', group: B.group, phase: M.phase[B.mat], isPlayer, disguised: !!(br && br.disguised),
        lev: O.arch === 'leviathan', shell: isPlayer && this.shellT > 0, dartT: O.dartT, spiky: !!(br && br.spiky && br.ext > 0.5) });
    };
    for (const O of this.C.orgs) if (O.alive) add(O, true);
    for (const O of this.ai) if (O.alive) add(O, false);
  }

  // ── spawning ─────────────────────────────────────────────────────────
  findSpot(r, minFromPlayer = 700) {
    const P = this.G.phys, F = this.C.focus;
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * TAU, rad = Math.sqrt(Math.random()) * (DISH_R - r - 120);
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (P.sampleSDF(x, y) < r + 40) continue;
      if (F && F.alive && Math.hypot(F.B.cx - x, F.B.cy - y) < minFromPlayer + r) continue;
      if (this.hole && Math.hypot(x - this.hole.x, y - this.hole.y) < 480 + r) continue;
      return [x, y];
    }
    return null;
  }

  spawnAI(arch, o = {}) {
    const G = this.G, P = G.phys, A = ARCH[arch];
    if (!A) return null;
    let n;
    if (o.n) n = o.n;
    else if (A.abs) n = A.abs[0] + Math.random() * (A.abs[1] - A.abs[0]);
    else n = Math.max(A.min || 10, this.playerMass * (A.rel[0] + Math.random() * (A.rel[1] - A.rel[0])));
    n = Math.round(n * (this.axiom.sizeK && arch !== 'leviathan' && arch !== 'glimmer' ? this.axiom.sizeK : 1));
    const room = BUDGET - P.count - 40;
    if (arch !== 'leviathan') n = Math.min(n, 700, Math.floor(room * 0.5));
    else n = Math.min(n, room);
    if (n < 6) return null;
    const r = Math.sqrt(n * AREA_PER_P / Math.PI);
    const at = o.at || this.findSpot(r, o.minFrom ?? 700);
    if (!at) return null;
    const [x, y] = at;
    const mat = A.mat;
    const B = P.allocBody(this.groupSeq++, 'ai', mat);
    if (!B) return null;
    let k = 0;
    for (let ring = 0; k < n; ring++) {
      const m = Math.max(1, Math.floor(TAU * ring));
      for (let a = 0; a < m && k < n; a++) { const ang = a / m * TAU + ring * 0.37; P.spawn(x + Math.cos(ang) * ring * SPACING * 0.98, y + Math.sin(ang) * ring * SPACING * 0.98, 0, 0, mat, B.id); k++; }
    }
    B.count = k; B.cx = x; B.cy = y; B.r = Math.sqrt(k * AREA_PER_P / Math.PI); B.alive = true;
    B.minx = x - B.r; B.maxx = x + B.r; B.miny = y - B.r; B.maxy = y + B.r;
    B.layer = 1; clearMarks(B);
    B.tint = arch === 'rival' ? RIVAL_TINTS[Math.floor(Math.random() * RIVAL_TINTS.length)] : (A.tint || null);
    const brain = new BRAINS[arch](this, arch);
    const O = new Organism(G, B, { brain, speedMul: A.speed, tonus: A.tonus });
    O.arch = arch; O.spawnMass = k; O.born = this.time;
    O.cap = A.capAbs || (A.cap ? Math.max(k * A.cap, (A.min || 10) * 1.5) : 1e9);
    this.ai.push(O);
    if (this.nearCam(x, y, 200)) G.fx.ring(x, y, (B.tint || MATS[mat]).emit, B.r * 2.2, 0.8, { a: 0.5 });
    return O;
  }

  adoptAIBud(O, NB, arch = 'fragment') {
    NB.kind = 'ai'; NB.layer = 1; NB.tint = O.B.tint; clearMarks(NB);
    const F = new Organism(this.G, NB, { brain: new FragmentBrain(this, 'fragment', O.B.group), speedMul: 1.05, tonus: 34 });
    F.arch = arch; F.spawnMass = NB.count; F.born = this.time; F.parentArch = O.arch; F.cap = NB.count * 1.4;
    this.ai.push(F);
  }

  // glimmerling mitosis: a full one divides into two independent lights
  divide(O) {
    const B = O.B;
    const a = Math.random() * TAU;
    const NB = O.bud(B.cx + Math.cos(a) * 100, B.cy + Math.sin(a) * 100, 0.5);
    if (!NB) return;
    NB.kind = 'ai'; NB.layer = 1; NB.tint = B.tint; NB.group = this.groupSeq++; NB.fuseT = 0; clearMarks(NB);
    const brain = new BRAINS.glimmer(this, 'glimmer');
    const C = new Organism(this.G, NB, { brain, speedMul: ARCH.glimmer.speed, tonus: ARCH.glimmer.tonus });
    C.arch = 'glimmer'; C.spawnMass = NB.count; C.born = this.time; C.cap = ARCH.glimmer.capAbs;
    this.ai.push(C);
    if (this.nearCam(B.cx, B.cy, 0)) { this.G.fx.ring(B.cx, B.cy, B.tint.emit, B.r * 2.4, 0.5, { a: 0.5 }); sound.bud(); }
  }

  // metabolism: overfed creatures radiate surplus light; full glimmerlings divide
  metabolism(dt) {
    const G = this.G, P = G.phys;
    this.metaT = (this.metaT || 0) + dt;
    if (this.metaT < 0.5) return;
    this.metaT = 0;
    for (const O of this.ai) {
      if (!O.alive || !O.cap || O.arch === 'leviathan') continue;
      const B = O.B;
      if (O.arch === 'glimmer' && B.count >= O.cap && this.aiCount('glimmer') < 34) { this.divide(O); continue; }
      if (B.count > O.cap * 1.12) {
        const n = Math.min(3, Math.ceil((B.count - O.cap) * 0.04));
        for (let k = 0, q = 0; k < B.len && q < n; k++) {
          const i = P.bodyIdx[B.start + k];
          if (P.body[i] !== B.id || P.surf[i] < 0.4) continue;
          if (this.nearCam(P.x[i], P.y[i], 0)) { const em = (B.tint || MATS[B.mat]).emit; G.fx.add({ x: P.x[i], y: P.y[i], vx: P.nx[i] * 40, vy: P.ny[i] * 40, life: 0.8, size: 4, type: 0, r: em[0], g: em[1], b: em[2], a: 0.7, grow: -3 }); }
          P.kill(i); q++;
        }
      }
    }
  }

  // threat director: there must always be something out there bigger than you
  director(dt) {
    this.dirT = (this.dirT || 0) - dt;
    if (this.dirT > 0) return;
    this.dirT = 2.5;
    const fm = this.focusMass, pm = this.playerMass;
    if (pm < 30 || this.shellT > 0) return;
    const want = this.tide <= 0 ? 1 : this.tide === 1 ? 2 : 3;
    let have = 0;
    for (const O of this.ai) if (O.alive && ARCH[O.arch] && ARCH[O.arch].predator && O.B.count >= fm * 1.05) have++;
    if (this.lev && this.lev.alive) have += 2;
    if (have >= want) return;
    const arch = this.tide >= 2 ? ['hunter', 'rival', 'thorn', 'mimic'][Math.floor(Math.random() * 4)] : this.tide === 1 ? (Math.random() < 0.6 ? 'hunter' : 'thorn') : 'hunter';
    const n = Math.round(Math.max(48, pm * (1.15 + Math.random() * 0.45)));
    this.spawnAI(arch, { n, minFrom: 750 });
  }

  spawnMote(at, initial = false) {
    if (this.motes.length >= MAX_MOTES) return null;
    let x, y;
    if (at) { x = at[0]; y = at[1]; }
    else {
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * TAU;
        const r = this.hole && this.axiom.moteRingNearHole && Math.random() < 0.45 ? 250 + Math.random() * 230 : Math.sqrt(Math.random()) * (DISH_R - 90);
        x = Math.cos(a) * r; y = Math.sin(a) * r;
        if (this.G.phys.sampleSDF(x, y) > 30) break;
      }
    }
    const small = this.playerMass < 110 ? 1.5 : 0;
    const value = Math.max(1, Math.round((2 + small) * (this.axiom.moteK || 1)));
    const m = this.G.spawnEntity({ type: 'mote', x, y, value, free: true });
    if (m) { this.motes.push(m); if (!initial) m.vx = (Math.random() - 0.5) * 60, m.vy = (Math.random() - 0.5) * 60; }
    return m;
  }

  aiCount(arch) { let n = 0; for (const O of this.ai) if (O.alive && O.arch === arch) n++; return n; }

  // ── per-frame (before physics) ───────────────────────────────────────
  update(dt) {
    const G = this.G, C = this.C, P = G.phys;
    this.time += this.over ? 0 : dt;
    // the player
    if (this.autopilot && !this.over && !this.won) { this.buildAgents(); this.pilot(dt); }
    const intent = this.over ? { x: 0, y: 0 } : G.input.move;
    C.update(dt, intent, G.input.rally && !this.over);
    for (const O of C.orgs) O.speedMul = this.shellT > 0 ? 1.45 : (C.mass < 40 ? 1.2 : 1);
    // the others
    this.buildAgents();
    for (const O of this.ai) if (O.alive) O.update(dt);
    this.ai = this.ai.filter(O => O.alive || this.markDead(O));
    // axiom rheology
    if (this.axiom.visc) for (const B of P.bodies) if (B.alive) B.visc = this.axiom.visc;
    // world rhythms
    this.surgeT = Math.max(0, this.surgeT - dt);
    this.surge += ((this.surgeT > 0 ? 2.6 : 1) - this.surge) * Math.min(1, dt * 1.5);
    if (!this.over && !this.won) { this.updateTides(dt); this.updateSpawns(dt); this.updatePulses(dt); this.director(dt); }
    this.metabolism(dt);
    this.updateMotes(dt);
    this.updateBeads(dt);
    // drifting streaks reveal the gyre
    const cam = G.cam; const vw = G.canvas.clientWidth / cam.zoom, vh = G.canvas.clientHeight / cam.zoom;
    if (Math.random() < 0.8) {
      const x = cam.x + (Math.random() - 0.5) * vw, y = cam.y + (Math.random() - 0.5) * vh;
      if (Math.hypot(x, y) < DISH_R - 30 && P.sampleSDF(x, y) > 10) {
        const [fx, fy] = gyreAt(x, y, this.gyreK * this.surge);
        G.fx.add({ x, y, vx: fx * 1.4, vy: fy * 1.4, life: 1.6, size: 3, type: 2, stretch: 3, r: 0.45, g: 1.0, b: 0.85, a: 0.12 + 0.12 * (this.surge - 1), drag: 0 });
      }
    }
    // Last Light shell timer
    if (this.shellT > 0) { this.shellT -= dt; if (this.shellT <= 0) G.timeScale = 1; }
    this.shellCD = Math.max(0, this.shellCD - dt);
    if (G.timeScale < 1 && this.shellT < 3.6 && !this.over) G.timeScale = Math.min(1, G.timeScale + dt * 1.2);
  }

  markDead(O) {
    // called once when an AI organism stops being alive — credit the devourer
    if (O._counted) return false;
    O._counted = true;
    const B = O.B;
    const E = B._lastEater;
    const rejoined = B._mergedInto && B._mergedInto.group === B.group;
    if (!rejoined && E && this.time - (B._lastEatT || 0) < 1.5 && E.group === 0) this.onDevour(O, B);
    if (O === this.lev) this.levDefeated();
    return false;
  }

  updateTides(dt) {
    let t = 0; while (t < TIDES.length - 1 && this.time >= TIDES[t].until) t++;
    if (this.tide !== t) {
      const first = this.tide < 0;
      this.tide = t;
      if (!first) {
        this.G.hud.showTitle(TIDES[t].name, TIDES[t].sub, 2.6);
        sound.open();
        if (t >= 2) sound.ambience('tense', 47);
      }
    }
    // the leviathan rises when you become the apex — or when its tide comes
    if (!this.levSpawned && (this.tier >= TIERS.length - 1 || this.tide >= 3)) this.summonLeviathan();
  }

  updateSpawns(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 0.55;
    const T = TIDES[Math.max(0, this.tide)];
    const mul = this.axiom.pop || {};
    const extra = Object.keys(mul).filter(k => !(k in T.pop));
    const want = [];
    for (const [arch, base] of Object.entries(T.pop)) want.push([arch, Math.round(base * (mul[arch] ?? 1))]);
    for (const arch of extra) want.push([arch, Math.round(2 * mul[arch])]);
    // find the most under-populated archetype and spawn one
    let pick = null, gap = 0;
    for (const [arch, n] of want) { const have = this.aiCount(arch); const g = (n - have) / Math.max(1, n); if (g > gap) { gap = g; pick = arch; } }
    if (pick && this.G.phys.count < BUDGET - 120) this.spawnAI(pick);
  }

  updatePulses(dt) {
    this.pulseT -= dt;
    if (this.pulseT > 0) return;
    this.pulseT = 40 + Math.random() * 18;
    const G = this.G;
    const r = Math.random();
    if (r < 0.45 && this.L.vents.length) {
      // bloom pulse: a vent exhales a ring of light
      const v = this.L.vents[Math.floor(Math.random() * this.L.vents.length)];
      for (let k = 0; k < 22; k++) { const m = this.spawnMote([v.x + (Math.random() - 0.5) * 30, v.y + (Math.random() - 0.5) * 30]); if (m) { const a = Math.atan2(v.ny, v.nx) + (Math.random() - 0.5) * 2.4; const s = 120 + Math.random() * 180; m.vx = Math.cos(a) * s; m.vy = Math.sin(a) * s; } }
      if (this.nearCam(v.x, v.y, 600)) G.fx.ring(v.x, v.y, [0.6, 1, 0.85], 160, 1.2);
      G.hud.toast('Bloom Pulse', '❀', 'cool'); sound.bloom();
    } else if (r < 0.75) {
      this.surgeT = 14; G.hud.toast('Current Surge', '≈', 'cool'); sound.dart(0.6);
    } else if (this.tide >= 1) {
      for (let k = 0; k < 2; k++) this.spawnAI('hunter');
      G.hud.toast('Hunting Moon', '☾'); sound.hurt(0.4);
    } else { this.pulseT = 8; }
  }

  updateMotes(dt) {
    this.motes = this.motes.filter(m => !m.dead);
    const rate = this.axiom.moteRate ?? 1;
    // steady drizzle so the dish never starves
    if (this.motes.length < 75 * rate && Math.random() < dt * 3.2 * rate) this.spawnMote();
    // vents breathe out little clusters
    this.ventT -= dt;
    if (this.ventT <= 0 && this.L.vents.length) {
      this.ventT = (5 + Math.random() * 3) / ((this.axiom.vents || 1) * Math.max(0.35, rate));
      const v = this.L.vents[Math.floor(Math.random() * this.L.vents.length)];
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) { const m = this.spawnMote([v.x, v.y]); if (m) { const a = Math.atan2(v.ny, v.nx) + (Math.random() - 0.5) * 1.6; m.vx = Math.cos(a) * 140; m.vy = Math.sin(a) * 140; } }
    }
    // motes ride the gyre & avoid stranding in walls
    for (const m of this.motes) {
      const [fx, fy] = gyreAt(m.x, m.y, this.gyreK * this.surge);
      m.x += fx * dt * 0.6; m.y += fy * dt * 0.6;
      const rr = Math.hypot(m.x, m.y); if (rr > DISH_R - 40) { m.x *= (DISH_R - 40) / rr; m.y *= (DISH_R - 40) / rr; }
    }
  }

  // ── after physics: duels, siphons, bluffs, camouflage, grazing ───────
  post(dt) {
    const G = this.G, P = G.phys;
    this.fixLayers();
    this.processSplits();
    this.absorption(dt);
    this.siphons(dt);
    this.puffers();
    this.mimics();
    this.aiGrazing();
    this.playerState(dt);
    this.updateCounter();
  }

  fixLayers() {
    const P = this.G.phys;
    for (const B of P.bodies) {
      if (!B.alive) continue;
      if (B.group === 0) B.layer = 0;
      else if (B.kind === 'ai' || B.group >= 4) B.layer = 1;
      else if (B.kind === 'dew' || B.kind === 'spent' || B.group === -1) B.layer = (B.mat === MAT.LUMEN && !B.tint) ? 0 : 1;
    }
  }

  onSplit(parent, child) {
    if (parent.kind === 'ai' || parent.group >= 4) this.pendingSplits.push([parent, child]);
  }
  processSplits() {
    const P = this.G.phys;
    for (const [parent, child] of this.pendingSplits) {
      if (!child.alive || child.count === 0) continue;
      child.layer = 1; child.tint = parent.tint; clearMarks(child);
      child._lastEater = parent._lastEater; child._lastEatT = parent._lastEatT;
      if (child.ctrl) continue;
      if (child.count < 10 || this.ai.length > 70) {
        // crumbs become neutral dew: food for whoever is quick
        child.group = -1; child.kind = 'dew';
        for (let k = 0; k < child.len; k++) { const i = P.bodyIdx[child.start + k]; if (P.body[i] === child.id) P.life[i] = 4 + Math.random() * 2.5; }
        continue;
      }
      child.kind = 'ai';
      const F = new Organism(this.G, child, { brain: new FragmentBrain(this, 'fragment', parent.group), speedMul: 1.05, tonus: 34 });
      F.arch = 'fragment'; F.spawnMass = child.count; F.born = this.time; F.parentArch = parent.ctrl && parent.ctrl.arch; F.cap = child.count * 1.4;
      this.ai.push(F);
    }
    this.pendingSplits.length = 0;
  }

  onMerge(keep, gone, n) {
    // swallowed matter takes on its new body's nature
    const P = this.G.phys;
    gone._mergedInto = keep;
    if (keep.group < 0) return;
    for (let k = 0; k < gone.len; k++) { const i = P.bodyIdx[gone.start + k]; if (P.alive[i] && P.body[i] === keep.id) P.mat[i] = keep.mat; }
  }

  isSpiky(B) { const O = B.ctrl; return !!(O && O.brain && O.brain.spiky && O.brain.ext > 0.5); }

  absorption(dt) {
    const G = this.G, P = G.phys, n = P.ncontacts;
    const duels = this.duels; duels.clear();
    for (let k = 0; k < n; k++) {
      const i = P.contactA[k], j = P.contactB[k];
      if (!P.alive[i] || !P.alive[j]) continue;
      const bi = P.body[i], bj = P.body[j];
      if (bi < 0 || bj < 0 || bi === bj) continue;
      const A = P.bodies[bi], B = P.bodies[bj];
      if (A.group === B.group || A.group < 0 || B.group < 0) continue;
      if (M.phase[A.mat] !== M.phase[B.mat]) continue;   // immiscible: slip past
      const key = bi < bj ? bi * 1024 + bj : bj * 1024 + bi;
      let d = duels.get(key);
      if (!d) { d = { A: bi < bj ? A : B, B: bi < bj ? B : A, pa: [], pb: [] }; duels.set(key, d); }
      if (A === d.A) { d.pa.push(i); d.pb.push(j); } else { d.pa.push(j); d.pb.push(i); }
    }
    for (const d of duels.values()) this.duel(d, dt);
  }

  // contact centroid of a particle list
  centroid(list) { const P = this.G.phys; let x = 0, y = 0; for (const i of list) { x += P.x[i]; y += P.y[i]; } return [x / list.length, y / list.length]; }

  power(E, V, cx, cy) {
    let p = E.count;
    const O = E.ctrl;
    const dx = V.cx - E.cx, dy = V.cy - E.cy, d = Math.hypot(dx, dy) + 1;
    // momentum bite: darting into the other
    if (O && O.dartT > 0) { const vd = (E.vx * dx + E.vy * dy) / d; if (vd > 140) p *= 1.65; }
    // flank: a bite on the trailing side of a moving body
    const VO = V.ctrl;
    let hx = V.vx, hy = V.vy; let hm = Math.hypot(hx, hy);
    if (hm < 45 && VO) { hx = VO.facing.x; hy = VO.facing.y; hm = 1; }
    if (hm > 1e-3) {
      const rx = cx - V.cx, ry = cy - V.cy, rm = Math.hypot(rx, ry) + 1e-3;
      const rear = (rx * hx + ry * hy) / (rm * hm);
      if (rear < -0.35) p *= VO && VO.arch === 'leviathan' ? 3.4 : 1.7;
    }
    // a stunned puffer has no fight in it; a coiled lancer is all spring and no grip
    if (VO && VO.brain && VO.brain.stun > 0) p *= 1.5;
    if (VO && VO.brain && VO.brain.state === 'coil') p *= 1.35;
    return p;
  }

  duel(d, dt) {
    const { A, B } = d;
    const sa = this.isSpiky(A), sb = this.isSpiky(B);
    if (sa && !sb) { this.shear(B, d.pb, A, dt); return; }
    if (sb && !sa) { this.shear(A, d.pa, B, dt); return; }
    const [cx, cy] = this.centroid(d.pa);
    const pa = this.power(A, B, cx, cy), pb = this.power(B, A, cx, cy);
    if (pa > pb * 1.08 && this.canEatBody(A, B)) this.drink(A, B, d.pb, pa / pb, dt, cx, cy, pa > A.count * 1.2);
    else if (pb > pa * 1.08 && this.canEatBody(B, A)) this.drink(B, A, d.pa, pb / pa, dt, cx, cy, pb > B.count * 1.2);
    else if (Math.random() < dt * 8) {
      // locked in a stalemate: the membranes spark
      this.G.fx.sparks(cx, cy, 2, (A.cx - B.cx), (A.cy - B.cy), [1, 0.9, 0.7], 160);
    }
  }

  drink(E, V, vParts, ratio, dt, cx, cy, skill) {
    const G = this.G, P = G.phys;
    const key = E.id * 1024 + V.id;
    const lev = E.ctrl && E.ctrl.arch === 'leviathan';
    const rate = 20 + 70 * Math.min(3.5, ratio - 1) + (lev ? 45 : 0) + (V.count < 16 ? 120 : 0);
    let acc = (this.drinkAcc.get(key) || 0) + rate * dt;
    let n = Math.floor(acc); this.drinkAcc.set(key, acc - n);
    if (n <= 0) return;
    const playerE = E.group === 0, playerV = V.group === 0;
    if (V._duelStart === undefined || this.time - (V._duelT || -9) > 1.5) { V._duelStart = V.count; V._duelEaterMass = E.count; }
    V._duelT = this.time;
    const em = (E.tint || MATS[E.mat]).emit;
    const capped = playerE && this.C.mass >= G.massCap;
    let took = 0;
    for (const j of vParts) {
      if (n <= 0) break;
      if (!P.alive[j] || P.body[j] !== V.id) continue;
      this.take(j, E, em, capped); n--; took++;
    }
    // tiny victims are swallowed whole
    if (V.count - took <= 6 && V.count > 0) {
      for (let k = 0; k < V.len; k++) { const j = P.bodyIdx[V.start + k]; if (P.alive[j] && P.body[j] === V.id) { this.take(j, E, em, capped); took++; } }
    }
    if (!took) return;
    V._lastEater = E; V._lastEatT = this.time;
    if (playerE) {
      this.gainT += took;
      if (this.gainT > 3) { this.gainT = 0; sound.pop(0.6); }
      if (skill && !this.tricks.has('Tail Bite') && V.count > E.count * 0.7) this.trick('Tail Bite');
      if (V.ctrl && V.ctrl.brain && V.ctrl.brain.state === 'coil') this.trick('Coil Breaker');
    }
    if (playerV) {
      this.lastHurtBy = E; this.lastHurtT = this.time;
      this.stats.lostToPredators += took; this.untouched = false;
      this.drainedBy = E; this.drainT = this.time; this.drainLost += took;
      G.R.danger[3] = Math.min(1, G.R.danger[3] + 0.08 * took);
      this.hurtT += took;
      if (this.hurtT > 4) { this.hurtT = 0; sound.hurt(Math.min(1, ratio / 3)); G.shakeAt(cx, cy, 0.18); }
    }
  }

  take(j, E, em, capped) {
    const G = this.G, P = G.phys;
    if (capped) {
      G.radiance = (G.radiance || 0) + 1;
      G.fx.add({ x: P.x[j], y: P.y[j], vx: 0, vy: -40, life: 0.5, size: 5, type: 0, r: em[0], g: em[1], b: em[2], a: 1, grow: -6 });
      P.kill(j); return;
    }
    P.transfer(j, E.id); P.mat[j] = E.mat; P.glow[j] = 1.6;
    const dx = E.cx - P.x[j], dy = E.cy - P.y[j], d = Math.hypot(dx, dy) + 1;
    P.vx[j] = E.vx + dx / d * 140; P.vy[j] = E.vy + dy / d * 140;
    P.ox[j] = P.x[j] - P.vx[j] / 120; P.oy[j] = P.y[j] - P.vy[j] / 120;
    if (Math.random() < 0.5) G.fx.add({ x: P.x[j], y: P.y[j], vx: dx / d * 220, vy: dy / d * 220, life: 0.28, size: 4, type: 2, stretch: 1.2, r: em[0], g: em[1], b: em[2], a: 1.1, drag: 2 });
  }

  // a bristled crown shears gel into flying dew
  shear(V, vParts, T, dt) {
    const G = this.G, P = G.phys;
    if (V.group === 0 && this.shellT > 0) return;
    const key = T.id * 1024 + V.id + 7;
    let acc = (this.drinkAcc.get(key) || 0) + dt * 36;
    let n = Math.floor(acc); this.drinkAcc.set(key, acc - n);
    let shed = 0;
    for (const j of vParts) {
      if (n <= 0) break;
      if (!P.alive[j] || P.body[j] !== V.id || V.count < 4) continue;
      G.shed(j, T.cx, T.cy, [1.0, 0.3, 0.6], 5);
      n--; shed++;
    }
    if (!shed) return;
    V._lastEater = T; V._lastEatT = this.time;
    if (V.group === 0) {
      this.lastHurtBy = T; this.lastHurtT = this.time;
      this.stats.lostToPredators += shed; this.untouched = false;
      G.R.danger[3] = Math.min(1, G.R.danger[3] + 0.12 * shed);
      if (Math.random() < 0.35) { sound.grind(); }
      this.hurtT += shed; if (this.hurtT > 4) { this.hurtT = 0; sound.hurt(0.6); }
    }
  }

  // lampreys drink along a strand: beads of light travel the tendril
  siphons(dt) {
    const G = this.G, P = G.phys;
    for (const O of this.ai) {
      if (!O.alive || O.arch !== 'siphon') continue;
      const br = O.brain, T = br.latch;
      if (!T || !T.B.alive) continue;
      const V = T.B;
      if (!this.canEatBody(O.B, V)) { br.release(); continue; }
      br.acc = (br.acc || 0) + dt * (7 + O.B.count * 0.05);
      while (br.acc >= 1) {
        br.acc -= 1;
        if (V.count < 5) { br.release(); break; }
        // the target's particle nearest the lamprey
        let best = -1, bd = 1e9;
        for (let k = 0; k < V.len; k++) { const i = P.bodyIdx[V.start + k]; if (P.body[i] !== V.id || !P.alive[i]) continue; const d = (P.x[i] - O.B.cx) ** 2 + (P.y[i] - O.B.cy) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best < 0) break;
        const em = (V.tint || MATS[V.mat]).emit;
        this.beads.push({ x: P.x[best], y: P.y[best], O, t: 0, dur: 0.5 + Math.sqrt(bd) / 900, col: em });
        P.kill(best);
        V._lastEater = O.B; V._lastEatT = this.time;
        if (V.group === 0) { this.lastHurtBy = O.B; this.lastHurtT = this.time; this.stats.lostToPredators++; this.untouched = false; G.R.danger[3] = Math.min(1, G.R.danger[3] + 0.06); if (Math.random() < 0.3) sound.hurt(0.25); }
      }
    }
  }
  updateBeads(dt) {
    const G = this.G, P = G.phys;
    for (const b of this.beads) {
      b.t += dt;
      const O = b.O;
      if (!O.alive) { b.done = true; continue; }
      const k = Math.min(1, b.t / b.dur);
      b.cx = b.x + (O.B.cx - b.x) * k; b.cy = b.y + (O.B.cy - b.y) * k;
      if (k >= 1) {
        b.done = true;
        if (P.count < BUDGET) { const i = P.spawn(O.B.cx + (Math.random() - 0.5) * 6, O.B.cy + (Math.random() - 0.5) * 6, 0, 0, O.B.mat, O.B.id); if (i >= 0) P.glow[i] = 1.5; }
      }
    }
    this.beads = this.beads.filter(b => !b.done);
  }
  onLatch(O, a) { if (a.isPlayer) { sound.blip(110, 330, 0.18, 0.5, 'triangle', 0.5); this.G.hud.toast('Latched', '⌁'); } }
  onUnlatch(br, kind) {
    const T = br.latch;
    if (T && T.isPlayer && kind === 'snap') this.trick('Siphon Snap');
    if (T && T.isPlayer) sound.snap(0.6);
  }

  // puffers: touch the shell → the bluff pops
  puffers() {
    const G = this.G;
    for (const O of this.ai) {
      if (!O.alive || O.arch !== 'puffer') continue;
      const br = O.brain; const B = O.B;
      if (br.bluff < 1.25 || br.stun > 0) continue;
      const R = B.r * br.bluff;
      for (const a of this.agents) {
        if (a.B === B || a.phase !== PHASE.AQUA || a.group === B.group) continue;
        const d = Math.hypot(a.x - B.cx, a.y - B.cy);
        if (d < R + a.rTrue * 0.55) {
          br.stun = 2.6; br.bluff = 1; br.target = 1;
          sound.pop(1); sound.blip(900, 240, 0.22, 0.25, 'sine', 0.4);
          for (let k = 0; k < 26; k++) { const ang = Math.random() * TAU; const c = hsl((k / 26 + this.time * 0.1) % 1, 0.8, 0.7); G.fx.add({ x: B.cx + Math.cos(ang) * R, y: B.cy + Math.sin(ang) * R, vx: Math.cos(ang) * 160, vy: Math.sin(ang) * 160, life: 0.6 + Math.random() * 0.4, size: 3 + Math.random() * 3, type: 3, r: c[0], g: c[1], b: c[2], a: 1, drag: 2.5 }); }
          if (a.isPlayer) this.trick('Bluff Called', '◌');
          break;
        }
      }
    }
  }

  // mimics: invisible flesh, honest synchronised lure motes
  mimics() {
    const P = this.G.phys;
    const F = this.C.focus;
    for (const O of this.ai) {
      if (!O.alive || O.arch !== 'mimic') continue;
      const br = O.brain, B = O.B;
      if (br.disguised) {
        for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.body[i] === B.id) P.rr[i] = 0.05; }
        // a dart straight into the lie unmasks it
        if (F && F.alive && F.dartT > 0 && Math.hypot(F.B.cx - B.cx, F.B.cy - B.cy) < F.B.r + B.r + 60) { br.spring(O, null, true); this.trick('Seen Through', '◎'); }
      }
    }
  }
  onReveal(O, a, seen) {
    const G = this.G, B = O.B;
    G.fx.ring(B.cx, B.cy, [1, 0.8, 0.45], B.r * 3, 0.5);
    G.fx.burst(B.cx, B.cy, 14, [1, 0.85, 0.5], 260, { size: 3, life: 0.6 });
    if (this.nearCam(B.cx, B.cy, 100)) { sound.splat(0.9); G.shakeAt(B.cx, B.cy, 0.3); }
  }
  onHide(O) {}

  aiGrazing() {
    const G = this.G, P = G.phys;
    for (const O of this.ai) {
      if (!O.alive || O.arch === 'oil' || O.arch === 'ferro' || (O.brain && O.brain.disguised)) continue;
      const B = O.B; const rr = B.r + 12;
      if (O.cap && B.count >= O.cap && O.arch !== 'glimmer') continue;
      for (const m of this.motes) {
        if (m.dead) continue;
        const dx = m.x - B.cx, dy = m.y - B.cy;
        if (dx * dx + dy * dy > rr * rr) continue;
        m.dead = true;
        for (let k = 0; k < m.value; k++) {
          if (P.count >= BUDGET) break;
          const i = P.spawn(m.x + (Math.random() - 0.5) * 6, m.y + (Math.random() - 0.5) * 6, -dx * 2, -dy * 2, B.mat, B.id);
          if (i >= 0) { P.glow[i] = 1.2; P.rr[i] = 0.2; }
        }
        if (this.nearCam(m.x, m.y, 0)) { const em = (B.tint || MATS[B.mat]).emit; G.fx.add({ x: m.x, y: m.y, life: 0.3, size: 20, grow: -60, type: 5, r: em[0], g: em[1], b: em[2], a: 0.8 }); }
      }
    }
  }

  // ── the player's arc: tiers, Last Light, escapes, the end ───────────
  playerState(dt) {
    const G = this.G, C = this.C;
    const mass = C.mass;
    if (mass > this.stats.peak) this.stats.peak = mass;
    // tiers
    const t = tierOf(mass);
    if (t > this.tier) {
      this.tier = t; if (t > this.stats.peakTier) {
        this.stats.peakTier = t;
        const F = C.focus;
        G.hud.toast(TIERS[t].name, '✺'); sound.bloom();
        if (F) { G.fx.ring(F.B.cx, F.B.cy, [1, 0.85, 0.6], F.B.r * 3.2, 1.0); G.R.post.flash = [1, 0.8, 0.6, 0.08]; }
        if (t >= 3 && this.untouched) this.trick('Untouchable', '✧');
      }
    } else if (t < this.tier) this.tier = t;
    if (this.usedShell && mass >= 90 && !this.tricks.has('Phoenix')) this.trick('Phoenix', '✹');
    // the leviathan unravels once most of it has been taken
    if (this.lev && this.lev.alive && !this.won && this.lev.B.count < this.levMass * 0.12) {
      const P = G.phys, LB = this.lev.B;
      if (LB._lastEater && LB._lastEater.group === 0) {
        for (let k = 0; k < LB.len; k++) { const i = P.bodyIdx[LB.start + k]; if (P.body[i] === LB.id) G.shed(i, LB.cx, LB.cy, [0.5, 0.75, 1], 6); }
        this.lev._counted = true; this.levDefeated();
      }
    }
    // clean escape: a drain broken by your own dart, losing little
    if (this.drainedBy && this.time - this.drainT > 0.35) {
      const pred = this.drainedBy;
      if (this.time - this.lastPlayerDart < 0.9 && pred.alive && pred.count > this.focusMass && this.drainLost < 14) this.trick('Clean Escape', '➶');
      this.drainedBy = null; this.drainLost = 0;
    }
    // pores: threading a refuge while hunted
    const F = C.focus;
    if (F && F.alive) {
      let inPore = false;
      for (const p of this.L.pores) { const d = segDist(F.B.cx, F.B.cy, p.ax, p.ay, p.bx, p.by); if (d < 20 && Math.hypot(F.B.cx - p.x, F.B.cy - p.y) < 90) inPore = true; }
      if (inPore && this.poreArmed) {
        const hunted = this.agents.some(a => !a.isPlayer && a.am > F.B.count * 1.1 && Math.hypot(a.x - F.B.cx, a.y - F.B.cy) < 480 && this.canEatBody(a.B, F.B));
        if (hunted) { this.trick('Pore Runner', '⟿'); this.poreArmed = false; }
      }
      if (!inPore && !this.poreArmed && Math.random() < dt * 0.05) this.poreArmed = true;
    }
    // survival floor → Last Light
    if (!this.over && !this.won && mass > 0 && mass < FLOOR && this.shellCD <= 0) {
      this.shellT = 4.5; this.shellCD = 32; this.usedShell = true;
      G.timeScale = 0.55;
      G.hud.toast('Last Light', '✹'); sound.bloom(); G.R.post.flash = [1, 0.95, 0.8, 0.12];
      for (const O of C.orgs) { O.B.fuseT = 0; }
    }
    // the end
    if (!this.over && !this.won && (mass === 0 || !C.focus)) {
      this.over = true; this.overT = 0;
      const killer = this.lastKiller();
      this.killerName = killer ? (ARCH[killer.ctrl && killer.ctrl.arch] || {}).name || 'the dish' : 'the dish';
      this.killerAt = killer && killer.alive ? killer : null;
      G.timeScale = 0.5; sound.boom();
      G.hud.toast(`Dissolved into ${this.killerName}`, '◌');
    }
    if (this.over) {
      this.overT += dt;
      if (this.overT > 1.5 && !this.resultsShown) { this.resultsShown = true; G.timeScale = 1; this.results(false); }
    }
    if (this.won) {
      this.wonT += dt;
      if (this.wonT < 2.5 && Math.random() < 0.6) this.spawnMote();
      if (this.wonT > 3.2 && !this.resultsShown) { this.resultsShown = true; this.results(true); }
    }
  }
  lastKiller() { return this.lastHurtBy && this.time - (this.lastHurtT || -9) < 4 ? this.lastHurtBy : null; }

  onDevour(O, B) {
    const G = this.G;
    const arch = O.arch === 'fragment' ? (O.parentArch || 'fragment') : O.arch;
    const A = ARCH[arch] || ARCH.fragment;
    const mass = Math.max(O.spawnMass || 0, B._duelStart || 0);
    this.stats.devouredN++;
    this.stats.devouredMass += mass;
    this.stats.devoured[arch] = (this.stats.devoured[arch] || 0) + 1;
    if (mass > this.stats.biggest) { this.stats.biggest = mass; this.stats.biggestName = A.name; }
    const em = (B.tint || MATS[B.mat]).emit;
    const x = B.cx, y = B.cy;
    G.fx.ring(x, y, em, Math.max(40, B.r * 2.6 + 30), 0.7);
    G.fx.burst(x, y, 10, em, 200, { size: 3, life: 0.6 });
    if (mass > 30) { sound.swallow(); }
    // feeding frenzy & giant slayer
    this.recentKills.push(this.time);
    this.recentKills = this.recentKills.filter(t => this.time - t < 12);
    if (this.recentKills.length >= 6) { this.trick('Feeding Frenzy', '❂'); this.recentKills.length = 0; }
    if (B._duelEaterMass && (B._duelStart || 0) > B._duelEaterMass * 1.4) this.trick('Giant Slayer', '⚔');
    if (arch !== 'glimmer' && arch !== 'fragment' && mass > 40) G.hud.toast(`${A.name} devoured`, '✦', 'cool');
  }

  // ── the leviathan ────────────────────────────────────────────────────
  summonLeviathan() {
    const G = this.G, P = G.phys;
    this.levSpawned = true;
    // make room: the small fry scatter into light
    let free = BUDGET - P.count;
    const need = 760;
    if (free < need) {
      const fry = this.ai.filter(O => O.alive && (O.arch === 'glimmer' || O.arch === 'fragment' || O.arch === 'grazer')).sort((a, b) => this.distToPlayer(b.B) - this.distToPlayer(a.B));
      for (const O of fry) {
        if (free >= need) break;
        for (let k = 0; k < O.B.len; k++) { const i = P.bodyIdx[O.B.start + k]; if (P.body[i] === O.B.id) { P.kill(i); free++; } }
        O._counted = true;
      }
    }
    const F = this.C.focus;
    const a0 = F ? Math.atan2(-F.B.cy, -F.B.cx) : Math.random() * TAU;
    const n = Math.max(380, Math.min(900, Math.round(Math.max(this.playerMass * 1.45, 560))));
    const rr = Math.sqrt(n * AREA_PER_P / Math.PI);
    // rise from open water on the far side of the dish
    let at = null, a = a0;
    for (let k = 0; k < 48 && !at; k++) {
      a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.13;
      for (const rad of [DISH_R - rr - 140, DISH_R - rr - 320, 700]) {
        const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (G.phys.sampleSDF(x, y) > rr + 30 && (!this.hole || Math.hypot(x, y) > 520 + rr)) { at = [x, y]; break; }
      }
    }
    if (!at) at = [Math.cos(a0) * 700, Math.sin(a0) * 700];
    const O = this.spawnAI('leviathan', { n, at, minFrom: 0 });
    if (!O) { this.levSpawned = false; return; }
    this.lev = O; this.levMass = O.B.count;
    O.brain.hx = -Math.cos(a); O.brain.hy = -Math.sin(a);
    G.hud.showTitle('Leviathan', 'its trailing flank is soft', 3.2);
    sound.boom(); sound.ambience('tense', 43);
    G.cam.shake = 0.9;
  }
  levDefeated() {
    if (this.won || this.over) return;
    this.won = true; this.wonT = 0; this.shellT = 99;
    const G = this.G;
    this.trick('Leviathan\'s Bane', '✺');
    sound.portal(); G.R.post.flash = [0.6, 1, 0.9, 0.25];
    const B = this.lev.B;
    G.fx.ring(B.cx, B.cy, [0.6, 0.9, 1], 600, 2.0);
    for (let k = 0; k < 40; k++) this.spawnMote([B.cx + (Math.random() - 0.5) * 300, B.cy + (Math.random() - 0.5) * 300]);
  }
  onRoar(O, ambient) {
    if (!this.nearCam(O.B.cx, O.B.cy, 600)) return;
    const G = this.G;
    G.fx.ring(O.B.cx, O.B.cy, [0.4, 0.6, 1.0], O.B.r * 3, 1.2, { a: 0.6 });
    if (!ambient) { sound.boom(); G.shakeAt(O.B.cx, O.B.cy, 0.5); }
    else sound.blip(60, 40, 0.25, 1.4, 'sine', 0.7);
  }
  onBristle(O) { if (this.nearCam(O.B.cx, O.B.cy, 0)) sound.snap(0.8); }

  onAnyDart(O, dx, dy, cost) {
    const G = this.G;
    if (O.colony) {
      sound.dart(1); this.stats.darts++; this.lastPlayerDart = this.time;
      G.fx.ring(O.B.cx - dx * O.B.r, O.B.cy - dy * O.B.r, [1, 0.8, 0.6], 40, 0.35);
    } else if (this.nearCam(O.B.cx, O.B.cy, 0)) {
      sound.dart(O.arch === 'leviathan' ? 1 : 0.35);
      const em = (O.B.tint || MATS[O.B.mat]).emit;
      G.fx.ring(O.B.cx - dx * O.B.r, O.B.cy - dy * O.B.r, em, 30, 0.3, { a: 0.6 });
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────
  nearCam(x, y, pad = 0) {
    const G = this.G, cam = G.cam; const hw = G.canvas.clientWidth / cam.zoom / 2 + pad, hh = G.canvas.clientHeight / cam.zoom / 2 + pad;
    return Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
  }
  distToPlayer(B) { const F = this.C.focus; return F ? Math.hypot(F.B.cx - B.cx, F.B.cy - B.cy) : 0; }
  trick(name, glyph = '✦') {
    const last = this.trickT.get(name);
    if (last !== undefined && this.time - last < 6) return;
    this.trickT.set(name, this.time);
    const first = !this.tricks.has(name);
    this.tricks.add(name); this.trickCount++;
    this.G.hud.toast(name, glyph);
    if (first) sound.trick();
  }
  updateCounter(force) {
    const m = this.playerMass;
    const t = Math.min(this.tier, TIERS.length - 1);
    const next = TIERS[Math.min(TIERS.length - 1, t + 1)].m;
    const label = TIERS[t].name + (this.shellT > 0 && !this.won ? ' · last light' : '');
    this.G.hud.setCounter(m, t >= TIERS.length - 1 ? m : next, 0, 0, label);
  }

  // ── drawing ──────────────────────────────────────────────────────────
  draw(D) {
    const G = this.G, P = G.phys, t = G.t;
    // vents: luminous nests
    for (const v of this.L.vents) {
      const p = 0.6 + 0.4 * Math.sin(t * 1.3 + v.t);
      D.ents.push(v.x, v.y, 26, 3, 0.45, 1.0, 0.8, 0.35 * p, v.t, 0, 0, 0);
      D.light(v.x, v.y, 30, 160, 0.4, 1.0, 0.8, -0.35 * p);
    }
    const F = this.C.focus;
    const fm = this.focusMass;
    for (const O of this.ai) if (O.alive) this.drawAI(D, O, F, fm);
    // siphon beads
    for (const b of this.beads) D.fx.push(b.cx, b.cy, 6, 0, b.col[0], b.col[1], b.col[2], 1.2, 0, 0, 0, 0);
    // Last Light: a slow shimmering crown around every piece of you
    if (this.shellT > 0 && !this.won) {
      for (const O of this.C.orgs) if (O.alive) {
        D.fx.push(O.B.cx, O.B.cy, (O.B.r + 18) / 0.8, 6, 1.0, 0.92, 0.75, 0.7, 0, 0, 0, 0);
        D.light(O.B.cx, O.B.cy, 50, 200, 1, 0.9, 0.7, -0.8);
      }
    }
    this.drawThreats(D, F, fm);
  }

  drawAI(D, O, F, fm) {
    const G = this.G, P = G.phys, B = O.B, br = O.brain, t = G.t;
    const tint = B.tint || MATS[B.mat];
    const em = tint.emit;
    if (br && br.disguised) {
      // the lie: a little cluster of "motes" that twinkle in perfect unison
      // identical to real motes in size and hue — only their shared heartbeat gives them away
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU + Math.sin(t * 0.3 + O.id) * 0.4, rr = B.r * 0.6 + 6 + Math.sin(t * 1.1 + k) * 3;
        D.ents.push(B.cx + Math.cos(a) * rr, B.cy + Math.sin(a) * rr + Math.sin(t * 2.3) * 2.2, 23, 0, 1.0, 0.86, 0.55, 1, 0.5, 0, 0, 0);
      }
      return;
    }
    const near = !F || Math.hypot(F.B.cx - B.cx, F.B.cy - B.cy) < 1500;
    D.light(B.cx, B.cy, 40, 110 + B.r * 2.4, em[0], em[1], em[2], -(0.25 + Math.sqrt(B.count) * 0.03));
    if (!near) return;
    // heart & inner life (only inside its own gel)
    const beat = 0.5 + 0.5 * Math.sin(t * 1.6 + O.id);
    const hs = Math.max(5, B.r * (0.42 + 0.06 * beat));
    D.fx.push(B.cx, B.cy, hs * 2.2, 5, em[0], em[1], em[2], 0.22 + 0.1 * beat + (O.arch === 'leviathan' ? 0.15 : 0), 2, 0, 0, 0);
    const step = B.len > 200 ? 3 : 2;
    for (let k = 0; k < B.len; k += step) {
      const i = P.bodyIdx[B.start + k];
      const h = (i * 2654435761 >>> 0) % 101;
      if (h > 7) continue;
      if (h < 3) D.fx.push(P.x[i], P.y[i], 2.2 + (h % 2), 1, 1, 0.97, 0.92, 0.45, 2, 0, 0, 0);
      else D.fx.push(P.x[i], P.y[i], 2.8, 0, em[0], em[1], em[2], 0.6, 2, 0, 0, 0);
    }
    // archetype tells
    const arch = O.arch;
    if (arch === 'thorn' && br.ext > 0.05) {
      for (let k = 0; k < B.len; k++) {
        const i = P.bodyIdx[B.start + k];
        if (P.surf[i] < 0.5 || ((i * 7) % 3)) continue;
        const L = 6 + 13 * br.ext;
        for (let s = 1; s <= 3; s++) D.fx.push(P.x[i] + P.nx[i] * L * s / 3, P.y[i] + P.ny[i] * L * s / 3, 4.2 - s, 0, 1.0, 0.3, 0.62, 0.9 * br.ext, 0, 0, 0, 0);
      }
      if (br.cycle > 3.25) D.fx.push(B.cx, B.cy, B.r + 16, 4, 1.0, 0.35, 0.6, (br.cycle - 3.25) * 1.6, 0, 0, 0, 0); // about to bristle
    }
    if (arch === 'hunter' && br.state === 'coil') {
      const k = Math.min(1, br.coil / 0.55);
      D.fx.push(B.cx, B.cy, (B.r + 30 - 18 * k) / 0.85, 4, 1.0, 0.3, 0.45, 0.35 + 0.5 * k, 0, 0, 0, 0);
      if (Math.random() < 0.7) { const a = Math.random() * TAU, rr = B.r + 40; G.fx.add({ x: B.cx + Math.cos(a) * rr, y: B.cy + Math.sin(a) * rr, vx: -Math.cos(a) * 160, vy: -Math.sin(a) * 160, life: 0.25, size: 3, type: 0, r: 1, g: 0.35, b: 0.5, a: 1 }); }
    }
    if (arch === 'puffer' && br.bluff > 1.08) {
      const R = B.r * br.bluff;
      const c = hsl((t * 0.12 + O.id * 0.13) % 1, 0.75, 0.72);
      D.fx.push(B.cx, B.cy, R / 0.7, 1, c[0], c[1], c[2], 0.75, 0, 0, 0, 0);
      const c2 = hsl((t * 0.12 + 0.33 + O.id * 0.13) % 1, 0.8, 0.75);
      D.fx.push(B.cx, B.cy, (R - 3) / 0.7, 1, c2[0], c2[1], c2[2], 0.3, 0, 0, 0, 0);
      const ga = t * 0.6 + O.id;
      D.fx.push(B.cx + Math.cos(ga) * R * 0.7, B.cy + Math.sin(ga) * R * 0.7 - R * 0.25, 7, 3, 1, 1, 1, 0.5, 0, 0, 0, 0);
    }
    if (arch === 'puffer' && br.stun > 0) {
      for (let k = 0; k < 3; k++) { const a = t * 3 + k * TAU / 3; D.fx.push(B.cx + Math.cos(a) * (B.r + 10), B.cy + Math.sin(a) * (B.r + 10) - 4, 4, 3, 1, 0.95, 0.7, 0.8, 0, 0, 0, 0); }
    }
    if (arch === 'siphon' && br.latch && br.latch.B.alive) {
      const T = br.latch.B;
      const ax = B.cx, ay = B.cy, bx = T.cx, by = T.cy;
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) + 1;
      const nx = -dy / d, ny = dx / d;
      const n = Math.ceil(d / 11);
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const wv = Math.sin(u * 9 - t * 7) * 7 * Math.sin(u * Math.PI);
        D.fx.push(ax + dx * u + nx * wv, ay + dy * u + ny * wv, 4.2, 0, em[0], em[1], em[2], 0.55 + 0.3 * Math.sin(u * 20 - t * 12), 0, 0, 0, 0);
      }
    }
    if (arch === 'leviathan') {
      // a soft golden flank: the honest weak point
      const fx = O.facing.x, fy = O.facing.y;
      const wx = B.cx - fx * B.r * 0.78, wy = B.cy - fy * B.r * 0.78;
      const p = 0.6 + 0.4 * Math.sin(t * 2.4);
      D.fx.push(wx, wy, B.r * 0.9, 5, 1.0, 0.85, 0.45, 0.35 * p, 2, 0, 0, 0);
      D.light(wx, wy, 60, 220, 1, 0.8, 0.45, -0.6 * p);
      // bioluminescent freckles
      for (let k = 0; k < B.len; k += 11) { const i = P.bodyIdx[B.start + k]; const ph = Math.sin(t * 1.7 + i); if (ph > 0.3) D.fx.push(P.x[i], P.y[i], 5, 0, 0.5, 0.75, 1.0, (ph - 0.3) * 1.2, 2, 0, 0, 0); }
      // maw glow
      D.fx.push(B.cx + fx * B.r * 0.75, B.cy + fy * B.r * 0.75, B.r * 0.6, 5, 0.4, 0.6, 1.0, 0.25, 2, 0, 0, 0);
    }
    // size reading: crimson halo = bigger than you, pale = edible
    if (F && F.alive && arch !== 'oil' && arch !== 'ferro' && M.phase[B.mat] === PHASE.AQUA) {
      const d = Math.hypot(F.B.cx - B.cx, F.B.cy - B.cy) - F.B.r - B.r;
      if (d < 700) {
        const am = B.count * (br && br.bluff ? br.bluff * br.bluff : 1);
        const prox = Math.max(0, 1 - d / 700);
        const rr = (B.r * (br && br.bluff ? br.bluff : 1) + 10) / 0.85;
        if (am > fm * 1.08) D.fx.push(B.cx, B.cy, rr, 4, 1.0, 0.22, 0.25, 0.1 + 0.3 * prox, 0, 0, 0, 0);
        else if (am < fm * 0.92) D.fx.push(B.cx, B.cy, rr, 4, 0.75, 1.0, 0.9, 0.05 + 0.13 * prox, 0, 0, 0, 0);
      }
    }
  }

  // off-screen predators announce themselves on the rim (never punish blindly)
  drawThreats(D, F, fm) {
    if (!F || !F.alive) return;
    const G = this.G; const w = G.canvas.clientWidth, h = G.canvas.clientHeight; const z = G.cam.zoom;
    for (const O of this.ai) {
      if (!O.alive || (O.brain && O.brain.disguised)) continue;
      const B = O.B;
      if (!this.canEatBody(B, F.B) || B.count < fm * 1.05) continue;
      const d = Math.hypot(F.B.cx - B.cx, F.B.cy - B.cy);
      if (d > 1400) continue;
      const [sx, sy] = G.worldToScreen(B.cx, B.cy);
      if (sx > -10 && sx < w + 10 && sy > -10 && sy < h + 10) continue;
      const m = 26;
      const cx = Math.min(w - m, Math.max(m, sx)), cy = Math.min(h - m, Math.max(m, sy));
      const [wx, wy] = G.screenToWorld(cx, cy);
      const k = Math.max(0.2, 1 - d / 1400);
      const lev = O.arch === 'leviathan';
      const pulse = 0.65 + 0.35 * Math.sin(G.t * (lev ? 5 : 3.5) + O.id);
      D.fxTop.push(wx, wy, (lev ? 34 : 18 + 10 * k) / z, 4, 1.0, 0.25, 0.3, 0.55 * k * pulse, 0, 0, 0, 0);
      D.fxTop.push(wx, wy, (lev ? 16 : 7 + 5 * k) / z, 5, 1.0, 0.3, 0.35, 0.9 * k, 0, 0, 0, 0);
    }
  }

  // ── camera ───────────────────────────────────────────────────────────
  camera(cam, dt) {
    const G = this.G, C = this.C;
    const w = G.canvas.clientWidth, h = G.canvas.clientHeight;
    const minZ = Math.min(w, h) / (DISH_R * 2 + 300);
    if (this.over && this.killerAt && this.killerAt.alive) { cam.tx = this.killerAt.cx; cam.ty = this.killerAt.cy; cam.tz = Math.max(minZ, cam.tz * 0.995); return; }
    const F = C.focus;
    if (!F || !F.alive) return;
    const m = F.B.count + 0.25 * (C.mass - F.B.count);
    cam.tx = F.B.cx + F.B.vx * 0.3; cam.ty = F.B.cy + F.B.vy * 0.3;
    let z = G.baseZoom() * Math.pow(85 / Math.max(50, m), 0.36);
    if (this.lev && this.lev.alive) { const d = Math.hypot(this.lev.B.cx - F.B.cx, this.lev.B.cy - F.B.cy); if (d < 1200) z *= 0.85; }
    cam.tz = Math.max(minZ, z);
  }

  // ── the end card ─────────────────────────────────────────────────────
  results(won) {
    const G = this.G, S = this.stats;
    const time = this.time;
    const score = Math.round(S.peak * 10 + S.devouredMass * 3 + S.motes * 5 + time * 2 + this.trickCount * 300 + (won ? 6000 : 0) + (G.radiance || 0) * 2);
    const rec = save.get('bloom', {}) || {};
    const best = Math.max(rec.best || 0, score);
    const newBest = score > (rec.best || 0);
    const daily = rec.daily && rec.daily.key === this.dayKey ? rec.daily : { key: this.dayKey, score: 0 };
    if (this.daily && score > daily.score) daily.score = score;
    save.set('bloom', { best, daily, runs: (rec.runs || 0) + 1 });
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const dev = Object.entries(S.devoured).sort((a, b) => b[1] - a[1]).map(([arch, n]) => {
      const A = ARCH[arch] || ARCH.fragment; const col = (A.tint && A.tint.emit) || (A.ring) || [1, 1, 1];
      return `<span><i style="background:${rgbCss(col)};box-shadow:0 0 8px ${rgbCss(col, 0.8)}"></i>${n} ${n === 1 ? A.name.toLowerCase() : A.plural}</span>`;
    }).join('');
    const tricks = [...this.tricks].map(t => `<span>${t}</span>`).join('');
    G.hud.showCard(`
      <div class="c-head">${won ? 'the dish blooms' : `dissolved into ${this.killerName ? this.killerName.toLowerCase() : 'the dish'}`}</div>
      <div class="c-name">${TIERS[S.peakTier].name}</div>
      <div class="bl-axiom">${this.axiom.glyph} ${this.axiom.name}${this.daily ? ' · daily' : ''}</div>
      <div class="bl-score">${score.toLocaleString()}</div>
      <div class="bl-best">${newBest ? 'new best' : `best ${best.toLocaleString()}`}${this.daily && daily.score ? ` · today ${daily.score.toLocaleString()}` : ''}</div>
      <div class="stats">
        <span>peak mass <b>${S.peak}</b></span><span>time <b>${fmt(time)}</b></span>
        <span>devoured <b>${S.devouredN}</b></span><span>light gathered <b>${S.motes}</b></span>
        <span>biggest meal <b>${S.biggest ? `${S.biggest}` : '—'}</b></span><span>darts <b>${S.darts}</b></span>
      </div>
      ${dev ? `<div class="bl-dev">${dev}</div>` : ''}
      ${tricks ? `<div class="tricks">${tricks}</div>` : ''}
    `, [
      { label: 'Again', cls: 'primary', fn: () => { G.hud.hideCard(); this.restart(false); } },
      { label: 'Wild axiom', fn: () => { G.hud.hideCard(); this.restart(true); } },
      { label: 'Atrium', fn: () => { G.hud.hideCard(); this.app.hub(); } },
    ]);
  }
}

function clearMarks(B) { B._lastEater = null; B._lastEatT = -9; B._duelStart = undefined; B._duelT = -9; B._duelEaterMass = 0; B._mergedInto = null; }

function segDist(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}
