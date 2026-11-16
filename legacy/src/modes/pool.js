// ─────────────────────────────────────────────────────────────────────────────
//  KNEADING POOL — therapeutic crystal-slime play.
//  Touch the gel and it is in your fingers: pinch, stretch thinner and thinner,
//  knead with two hands, fling, watch it roll back into a pearl. Pour strange
//  fluids, drop contraptions, tilt the world, blow an iridescent dome.
// ─────────────────────────────────────────────────────────────────────────────
import { AREA_PER_P, makeShape, moveShape, updateShapeBounds } from '../engine/physics.js';
import { MAT, MATS, SURF, PHASE, M } from '../engine/materials.js';
import { sound } from '../audio/audio.js';
import { Tray, FLUIDS, THINGS } from '../game/pool_tray.js';
import { patchSplit, unpatchSplit } from '../game/pool_patch.js';

const TAU = Math.PI * 2;
const POUR_LIMIT = 2480;           // particle budget for pouring (hard budget ≈ 2600)
const GRAB_PX = 46;                // css-px reach of a fingertip
const GRAB_MAX = 46;               // particles one fingertip can hold

const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* ignore */ } };

const POOL = {
  id: 'pool', bounds: [-700, -420, 700, 420], view: 1300, gravity: [0, 600], drag: 0.08, cap: 2400,
  palette: { p0: [0.006, 0.004, 0.018], p1: [0.026, 0.016, 0.064], p2: [0.075, 0.062, 0.125], p3: [0.78, 0.7, 1.0], sky: [0.72, 0.66, 0.98], grid: 0.85, bright: 1 },
  geo: [
    { op: 'carve', t: 'box', x: 0, y: 0, w: 1300, h: 760, r: 250 },
  ],
  entities: [],
};

// a still glass-stone peg to drape gel over
class Peg {
  constructor(G, d) {
    this.G = G; this.x = d.x; this.y = d.y; this.r = d.r ?? 30; this.dead = false; this.t = 0; this.kind = 'peg';
    this.S = makeShape({ type: 0, x: d.x, y: d.y, r: this.r, surf: SURF.STONE });
    G.phys.shapes.push(this.S);
  }
  update(dt) { this.t += dt; }
  post() {}
  draw(R) { R.light(this.x, this.y - this.r, 40, 120, 0.7, 0.65, 1.0, -0.18); }
}

export class Mode {
  constructor(G, app, opts = {}) { this.G = G; this.app = app; this.opts = opts; }

  enter() {
    const G = this.G;
    G.input.enabled = true;
    G.load(POOL);
    G.massCap = 2400;
    patchSplit(G);
    this.C = G.addColony(0, 0, 200, 260, {});
    G.cam.snap(0, 0, this.fitZoom());
    this.tool = 'hand';
    this.grabs = new Map(); this.pours = new Map(); this.placing = null; this.erasing = null;
    this.things = [];
    this.grav = 'down'; this.swirlZone = null;
    this.swellBtn = false; this.bub = null; this.bubR = 0; this.bubBody = null;
    this.tok = 0; this.t = 0; this.grabbedOnce = false; this.tension = 0;
    this.tray = new Tray(G.hud.root, {
      tool: (id) => this.setTool(id === this.tool && id !== 'hand' ? 'hand' : id),
      gravity: () => this.cycleGravity(),
      swell: (on) => { this.swellBtn = on; this.tray.setSwell(on); },
      clear: () => this.clear(),
    });
    this.hintEl = document.createElement('div'); this.hintEl.className = 'kp-hint';
    this.hintEl.innerHTML = '<div class="kp-f"></div>';
    G.hud.root.appendChild(this.hintEl);
    G.hud.showTitle('Kneading Pool', 'touch the light', 2.8);
    G.hud.setCorner(true, () => this.pause());
    G.hud.hideCounter();
    sound.setKey(53, 'lydian'); sound.ambience('bright', 53);
  }

  exit() {
    const G = this.G;
    this.removeBubble();
    if (this.swirlZone) { const i = G.phys.zones.indexOf(this.swirlZone); if (i >= 0) G.phys.zones.splice(i, 1); }
    this.tray.destroy(); this.hintEl.remove();
    G.massCap = 520;
    unpatchSplit(G);
  }

  fitZoom() { const G = this.G; return Math.min(G.canvas.clientWidth / 1360, G.canvas.clientHeight / 820); }

  // ── tools ─────────────────────────────────────────────────────────────
  setTool(id) { this.tool = id; this.tray.setTool(id); sound.ui(); }

  cycleGravity() {
    const G = this.G, P = G.phys;
    const order = ['down', 'zero', 'swirl', 'up'];
    this.grav = order[(order.indexOf(this.grav) + 1) % order.length];
    if (this.swirlZone) { const i = P.zones.indexOf(this.swirlZone); if (i >= 0) P.zones.splice(i, 1); this.swirlZone = null; }
    if (this.grav === 'down') { P.gx = 0; P.gy = 600; P.drag = 0.08; }
    else if (this.grav === 'up') { P.gx = 0; P.gy = -600; P.drag = 0.08; }
    else if (this.grav === 'zero') { P.gx = 0; P.gy = 0; P.drag = 0.22; }
    else {
      P.gx = 0; P.gy = 0; P.drag = 0.1;
      const tmp = [0, 0];
      this.swirlZone = { x0: -720, x1: 720, y0: -440, y1: 440, flow: true, flowK: 0.9,
        flowAt: (px, py) => { const r = Math.hypot(px, py) + 1; const s = 210 * Math.min(1, r / 300); tmp[0] = -py / r * s - px / r * 18; tmp[1] = px / r * s - py / r * 18; return tmp; } };
      P.zones.push(this.swirlZone);
    }
    this.tray.setGravity(this.grav);
    sound.morph();
    const F = this.C.focus; if (F && F.alive) F.excite = 1;
    G.fx.ring(0, 0, [0.75, 0.68, 1.0], 600, 1.1, { a: 0.35 });
  }

  clear() {
    const G = this.G, P = G.phys;
    for (const e of this.things) this.removeThing(e, true);
    this.things = [];
    this.removeBubble();
    // keep the largest living body as the creature; everything else dissolves to light
    const live = this.C.orgs.filter(o => o.alive).sort((a, b) => b.B.count - a.B.count);
    const keep = live[0] ? live[0].B.id : -1;
    let k = 0;
    for (let i = 0; i < P.hi; i++) {
      if (!P.alive[i] || P.body[i] === keep) continue;
      if ((k++ & 3) === 0) G.fx.add({ x: P.x[i], y: P.y[i], vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 60, life: 0.8 + Math.random() * 0.6, size: 3, type: 0, r: 0.85, g: 0.8, b: 1, a: 0.7, drag: 0.6 });
      P.kill(i);
    }
    this.C.orgs = this.C.orgs.filter(o => o.B.id === keep);
    if (live[0]) this.C.setFocus(live[0]);
    sound.bloom();
    if (this.C.mass < 120) this.reborn();
  }

  reborn() {
    const G = this.G, P = G.phys;
    for (const O of this.C.orgs) for (let k = 0; k < O.B.len; k++) P.kill(P.bodyIdx[O.B.start + k]);
    this.C.orgs = []; this.C.focus = null;
    const y = this.grav === 'up' ? -200 : this.grav === 'down' ? 200 : 0;
    this.C.spawn(0, y, 260);
    G.fx.ring(0, y, [1, 0.8, 0.6], 200, 0.9);
    sound.bloom();
  }

  removeThing(e, quiet) {
    const P = this.G.phys;
    e.dead = true;
    if (e.S) { const i = P.shapes.indexOf(e.S); if (i >= 0) P.shapes.splice(i, 1); }
    if (e.Z) { const i = P.zones.indexOf(e.Z); if (i >= 0) P.zones.splice(i, 1); }
    this.things = this.things.filter(t => t !== e);
    if (!quiet) { this.G.fx.ring(e.x, e.y, [0.8, 0.75, 1.0], 80, 0.5); this.G.fx.burst(e.x, e.y, 10, [0.85, 0.8, 1.0], 160, { size: 3, life: 0.6 }); sound.pop(0.8); }
  }

  shapeCount() { return this.G.phys.shapes.length; }

  place(id, wx, wy) {
    const G = this.G;
    if (this.things.length >= 16 || this.shapeCount() >= 22) { sound.hurt(0.3); G.fx.ring(wx, wy, [1, 0.4, 0.4], 50, 0.4); return null; }
    let e = null;
    const d = { x: wx, y: wy };
    switch (id) {
      case 'peg': e = new Peg(G, { ...d, r: 30 }); G.ents.push(e); break;
      case 'bumper': e = G.spawnEntity({ type: 'bumper', ...d, len: 180, angle: 0, rest: 1.4 }); break;
      case 'blade': e = G.spawnEntity({ type: 'blade', ...d, len: 160, spin: 2.2 }); break;
      case 'grinder': e = G.spawnEntity({ type: 'grinder', ...d, r: 40, spin: 2.6 }); break;
      case 'magnet': e = G.spawnEntity({ type: 'magnet', ...d, power: 1.3, reach: 320 }); break;
      case 'singularity': e = G.spawnEntity({ type: 'singularity', ...d, r: 14, strength: 32000, reach: 300 }); break;
      case 'geyser': e = G.spawnEntity({ type: 'geyser', ...d, w: 80, h: 460, power: 700 }); break;
      case 'current': e = G.spawnEntity({ type: 'current', ...d, w: 380, h: 140, vx: 280, vy: 0, k: 2.4 }); break;
    }
    if (!e) return null;
    e.kind = id;
    this.things.push(e);
    sound.bud();
    G.fx.ring(wx, wy, [0.8, 0.75, 1.0], 90, 0.5);
    buzz(6);
    return e;
  }

  relocate(e, x, y, dt) {
    const k = e.kind;
    e.x = x; e.y = y;
    if (k === 'peg' || k === 'bumper') moveShape(e.S, x, y, e.S.angle, dt);
    if (k === 'singularity' || k === 'magnet') { const r = e.reach; Object.assign(e.Z, { x0: x - r, x1: x + r, y0: y - r, y1: y + r, ax: x, ay: y }); }
    if (k === 'geyser') Object.assign(e.Z, { x0: x - e.w / 2, x1: x + e.w / 2, y0: y - e.h, y1: y });
    if (k === 'current') Object.assign(e.Z, { x0: x - e.w / 2, x1: x + e.w / 2, y0: y - e.h / 2, y1: y + e.h / 2 });
  }

  orient(e, ang, dt) {
    const k = e.kind;
    if (k === 'bumper') moveShape(e.S, e.x, e.y, ang, dt);
    else if (k === 'blade') e.a = ang;
    else if (k === 'current') { const s = 300; e.vx = Math.cos(ang) * s; e.vy = Math.sin(ang) * s; e.Z.fvx = e.vx; e.Z.fvy = e.vy; }
  }

  eraseAt(wx, wy) {
    const G = this.G, P = G.phys;
    let best = null, bd = 95;
    for (const e of this.things) { const d = Math.hypot(e.x - wx, e.y - wy); if (d < bd) { bd = d; best = e; } }
    if (best) { this.removeThing(best); return; }
    const R = 40 / G.cam.zoom;
    const mass = this.C.mass;
    let killed = 0;
    P.forEachNear(wx, wy, R, (i) => {
      const B = P.bodies[P.body[i]];
      if (B.group === 0 && mass - killed < 60) return;
      if ((killed & 1) === 0) G.fx.add({ x: P.x[i], y: P.y[i], vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 50, life: 0.6 + Math.random() * 0.4, size: 3, type: 0, r: 0.9, g: 0.85, b: 1, a: 0.7, drag: 0.8 });
      P.kill(i); killed++;
    });
    if (killed) sound.pop(0.4);
  }

  // ── fingers ───────────────────────────────────────────────────────────
  claim(p, role) {
    p.role = role;
    const S = this.G.input.stick;
    if (S.id === p.id) S.active = false;
  }

  tryGrab(p, wx, wy) {
    const G = this.G, P = G.phys;
    const R = GRAB_PX / G.cam.zoom;
    const cand = [];
    P.forEachNear(wx, wy, R, (i, dx, dy) => cand.push([dx * dx + dy * dy, i, dx, dy]));
    if (!cand.length) return false;
    cand.sort((a, b) => a[0] - b[0]);
    const n = Math.min(GRAB_MAX, cand.length);
    const g = { pid: p.id, idx: new Int32Array(n), gen: new Uint16Array(n), ox: new Float32Array(n), oy: new Float32Array(n), w: new Float32Array(n),
      wx, wy, pvx: 0, pvy: 0, t: 0, body: P.body[cand[0][1]], n, press: [wx, wy] };
    const dMax = Math.sqrt(cand[n - 1][0]) + 1;
    for (let k = 0; k < n; k++) {
      const [d2, i, dx, dy] = cand[k];
      g.idx[k] = i; g.gen[k] = P.gen[i]; g.ox[k] = dx; g.oy[k] = dy;
      g.w[k] = 1 - 0.6 * Math.sqrt(d2) / dMax;
      P.glow[i] = Math.max(P.glow[i], 0.3);
    }
    this.grabs.set(p.id, g);
    this.claim(p, 'grab');
    const B = P.bodies[g.body];
    if (B.ctrl) B.ctrl.excite = Math.min(1, B.ctrl.excite + 0.35);
    sound.squish(0.35);
    G.fx.add({ x: wx, y: wy, life: 0.35, size: 34 / G.cam.zoom, grow: -40 / G.cam.zoom, type: 4, r: 0.85, g: 0.8, b: 1, a: 0.8, drag: 0, top: true, mask: 3 });
    buzz(8);
    if (!this.grabbedOnce) { this.grabbedOnce = true; setTimeout(() => this.tray && this.tray.beckon(true), 6000); }
    return true;
  }

  updateGrabs(dt) {
    const G = this.G, P = G.phys;
    let tension = 0;
    for (const [pid, g] of this.grabs) {
      const p = G.input.pointers.get(pid);
      if (!p) { this.releaseGrab(g); this.grabs.delete(pid); continue; }
      const [wx, wy] = G.screenToWorld(p.x, p.y);
      const ivx = (wx - g.wx) / Math.max(dt, 1e-3), ivy = (wy - g.wy) / Math.max(dt, 1e-3);
      g.pvx = g.pvx * 0.55 + ivx * 0.45; g.pvy = g.pvy * 0.55 + ivy * 0.45;
      g.wx = wx; g.wy = wy; g.t += dt;
      // kneading whispers: wet squelches follow quick finger work
      const fsp = Math.hypot(g.pvx, g.pvy);
      if (fsp > 260 && Math.random() < dt * 7) sound.squish(Math.min(1, fsp / 1400));
      // the grip tightens into a fingertip — strands draw out from a point
      const pinch = 0.45 + 0.55 * Math.exp(-g.t * 1.8);
      let cx = 0, cy = 0, n = 0;
      for (let k = 0; k < g.n; k++) {
        const i = g.idx[k];
        if (!P.alive[i] || P.gen[i] !== g.gen[k]) continue;
        const w = g.w[k];
        const tx = wx + g.ox[k] * pinch, ty = wy + g.oy[k] * pinch;
        const K = 560 * w, Cd = 30 * Math.sqrt(w);
        P.vx[i] += ((tx - P.x[i]) * K - (P.vx[i] - g.pvx) * Cd) * dt;
        P.vy[i] += ((ty - P.y[i]) * K - (P.vy[i] - g.pvy) * Cd) * dt;
        if (P.glow[i] < 0.12) P.glow[i] = 0.12;
        cx += P.x[i]; cy += P.y[i]; n++;
      }
      if (n === 0) { this.grabs.delete(pid); continue; }
      cx /= n; cy /= n;
      const B = P.bodies[P.body[g.idx[0]]] || P.bodies[g.body];
      if (B && B.alive && B.count > n) {
        const d = Math.hypot(cx - B.cx, cy - B.cy);
        tension = Math.max(tension, Math.min(1, Math.max(0, d - B.r * 0.9) / (B.r * 1.6 + 30)));
        if (B.ctrl) { B.tonus *= 0.4; B.ctrl.touchTarget = null; }
      }
    }
    this.tension += (tension - this.tension) * Math.min(1, dt * 8);
  }

  releaseGrab(g) {
    const G = this.G, P = G.phys;
    const p0 = g.press;
    if (g.t < 0.25 && p0 && Math.hypot(g.wx - p0[0], g.wy - p0[1]) < 10 / G.cam.zoom) {
      // a quick touch selects: that droplet becomes the one you steer
      const B = P.bodies[P.body[g.idx[0]]];
      if (B && B.ctrl && B.ctrl.colony === this.C && B.ctrl !== this.C.focus) { this.C.setFocus(B.ctrl); sound.ui(); }
    }
    const sp = Math.hypot(g.pvx, g.pvy);
    if (sp > 650) { sound.dart(0.6); G.fx.ring(g.wx, g.wy, [0.85, 0.8, 1], 40, 0.35, { top: true, mask: 3 }); buzz(10); }
    else sound.squish(0.15);
  }

  // pour a fluid from the fingertip — aqua gels become living siblings
  startPour(p, fl) {
    this.pours.set(p.id, { pid: p.id, mat: fl.mat, wx: 0, wy: 0, pvx: 0, pvy: 0, acc: 0, B: null, last: -1, lastGen: 0, started: false });
    this.claim(p, 'pour');
    sound.blip(260, 420, 0.1, 0.25, 'sine', 0.4);
  }
  pourBody(g) {
    const P = this.G.phys;
    if (g.B && g.last >= 0 && P.alive[g.last] && P.gen[g.last] === g.lastGen && P.body[g.last] === g.B.id) return g.B;
    const aqua = M.phase[g.mat] === PHASE.AQUA;
    const B = P.allocBody(aqua ? 0 : 7, aqua ? 'fragment' : 'loose', g.mat);
    if (!B) return null;
    B.layer = aqua ? 0 : 1; B.tint = null; B.fuseT = 0.2;
    if (g.B && g.B !== B) this.adoptPour(g);
    g.B = B; g.last = -1;
    return B;
  }
  updatePours(dt) {
    const G = this.G, P = G.phys;
    for (const [pid, g] of this.pours) {
      const p = G.input.pointers.get(pid);
      if (!p) { this.adoptPour(g); this.pours.delete(pid); continue; }
      const [wx, wy] = G.screenToWorld(p.x, p.y);
      if (g.started) { g.pvx = g.pvx * 0.6 + (wx - g.wx) / Math.max(dt, 1e-3) * 0.4; g.pvy = g.pvy * 0.6 + (wy - g.wy) / Math.max(dt, 1e-3) * 0.4; }
      g.wx = wx; g.wy = wy; g.started = true;
      if (P.count >= POUR_LIMIT) continue;
      g.acc += 150 * dt;
      while (g.acc >= 1) {
        g.acc -= 1;
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 9;
        const x = wx + Math.cos(a) * r, y = wy + Math.sin(a) * r;
        if (P.sampleSDF(x, y) < 7) continue;
        const B = this.pourBody(g); if (!B) break;
        const i = P.spawn(x, y, g.pvx * 0.55 + (Math.random() - 0.5) * 30, g.pvy * 0.55 + (Math.random() - 0.5) * 30, g.mat, B.id);
        if (i < 0) break;
        P.glow[i] = 0.9; P.rr[i] = 0.25;
        g.last = i; g.lastGen = P.gen[i];
      }
      if (Math.random() < dt * 9) sound.pop(0.25);
    }
  }
  adoptPour(g) {
    const G = this.G, P = G.phys, B = g.B;
    g.B = null;
    if (!B || !B.alive || B.group !== 0 || B.ctrl) return;
    // seed aggregates if no physics step has measured it yet
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < P.hi; i++) if (P.alive[i] && P.body[i] === B.id) { n++; sx += P.x[i]; sy += P.y[i]; }
    if (n < 3) return;
    B.count = n; B.cx = sx / n; B.cy = sy / n; B.r = Math.sqrt(n * AREA_PER_P / Math.PI);
    const O = this.C.adopt(B);
    B.tint = null;                       // keep the poured material's own colours
    O.baseTonus = 26;
  }

  // ── the swell: an iridescent air dome blown inside the creature ───────
  updateSwell(dt) {
    const G = this.G, P = G.phys, F = this.C.focus;
    const want = (this.swellBtn || G.input.swell) && F && F.alive && F.B.count > 40;
    if (want && !this.bub) {
      this.bubBody = F.B; this.bubR = 5;
      this.bub = makeShape({ type: 0, x: F.B.cx, y: F.B.cy, r: 5, surf: SURF.GLASS });
      P.shapes.push(this.bub);
      sound.blip(180, 300, 0.12, 0.4, 'sine', 0.5);
    }
    if (!this.bub) return;
    const B = this.bubBody;
    if (!B || !B.alive || B.count < 20) { this.removeBubble(); return; }
    const rmax = B.count * AREA_PER_P / (TAU * 8.6);
    if (want && F && F.B === B) this.bubR += (34 + this.bubR * 0.5) * dt;
    else this.bubR -= (70 + this.bubR * 1.4) * dt;
    if (this.bubR > rmax) { this.pop(); return; }
    if (this.bubR <= 3) { this.removeBubble(); return; }
    moveShape(this.bub, B.cx, B.cy, 0, dt);
    this.bub.r = this.bubR; updateShapeBounds(this.bub);
    // air is light: the dome floats; the film stays supple
    const frac = (Math.PI * this.bubR * this.bubR) / (B.count * AREA_PER_P);
    B.gs = (B.gs ?? 1) * Math.max(-0.35, 1 - frac * 0.75);
    B.tonus *= 1.25;
    this.bubFrac = this.bubR / rmax;
    if (Math.random() < dt * (2 + 10 * this.bubFrac)) G.fx.add({ x: B.cx + (Math.random() - 0.5) * this.bubR, y: B.cy + (Math.random() - 0.5) * this.bubR, life: 0.5, size: 3, type: 3, r: 0.9, g: 0.95, b: 1, a: 0.5, drag: 0 });
  }
  removeBubble() {
    if (!this.bub) return;
    const P = this.G.phys; const i = P.shapes.indexOf(this.bub); if (i >= 0) P.shapes.splice(i, 1);
    this.bub = null; this.bubR = 0; this.bubBody = null; this.bubFrac = 0;
  }
  pop() {
    const G = this.G, P = G.phys, B = this.bubBody, S = this.bub;
    const cx = S.x, cy = S.y, R = this.bubR;
    const ids = [];
    for (let k = 0; k < B.len; k++) { const i = P.bodyIdx[B.start + k]; if (P.alive[i] && P.body[i] === B.id) ids.push(i); }
    for (const i of ids) {
      const dx = P.x[i] - cx, dy = P.y[i] - cy, d = Math.hypot(dx, dy) + 1;
      const kick = Math.random() < 0.25 ? 260 + Math.random() * 220 : -120 - Math.random() * 60;   // spray out, film snaps in
      P.vx[i] += dx / d * kick; P.vy[i] += dy / d * kick;
      P.glow[i] = 1.2;
    }
    for (let k = 0; k < 6 && ids.length > 40; k++) { const i = ids[(Math.random() * ids.length) | 0]; G.shed(i, cx, cy, [0.9, 0.85, 1.0], 6); }
    this.removeBubble();
    sound.pop(1); setTimeout(() => sound.pop(0.8), 40); setTimeout(() => sound.pop(0.6), 95);
    sound.splat(0.6);
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * TAU; const c = 0.5 + 0.5 * Math.cos(a * 2 + this.t * 3);
      G.fx.add({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, vx: Math.cos(a) * (180 + Math.random() * 160), vy: Math.sin(a) * (180 + Math.random() * 160), life: 0.6 + Math.random() * 0.4, size: 3 + Math.random() * 3, type: Math.random() < 0.3 ? 3 : 0,
        r: 0.6 + 0.4 * c, g: 0.75 + 0.25 * Math.sin(a * 3), b: 1.0 - 0.3 * c, a: 1.1, drag: 2.5 });
    }
    G.fx.ring(cx, cy, [0.85, 0.9, 1.0], R * 1.6, 0.5);
    G.shakeAt(cx, cy, 0.35);
    buzz([6, 24, 10]);
    if (B.ctrl) B.ctrl.excite = 1;
  }

  // ── frame hooks ───────────────────────────────────────────────────────
  pause() {
    const G = this.G;
    if (G.hud.menuOpen) { G.hud.closeMenu(); G.paused = false; return; }
    G.paused = true; sound.ui();
    G.hud.openMenu('Kneading Pool', [
      { label: 'Resume', cls: 'primary', fn: () => { G.hud.closeMenu(); G.paused = false; } },
      { label: 'Clear the pool', fn: () => { G.hud.closeMenu(); G.paused = false; this.clear(); } },
      { label: sound.muted ? 'Sound: off' : 'Sound: on', fn: () => { sound.setMuted(!sound.muted); G.hud.closeMenu(); this.pause(); } },
      { label: 'Atrium', fn: () => { G.hud.closeMenu(); G.paused = false; this.app.hub(); } },
    ], 'knead · pour · play');
  }

  events(evs) {
    const G = this.G, C = this.C;
    for (const e of evs) {
      if (e.type === 'pause') { this.pause(); continue; }
      if (G.paused) continue;
      const F = C.focus;
      if (e.type === 'press') this.onPress(e);
      else if (e.type === 'dart' && F && F.alive) {
        let dx = e.x, dy = e.y;
        if (e.key) { const m = G.input.move; if (Math.hypot(m.x, m.y) > 0.2) { dx = m.x; dy = m.y; } else { dx = F.facing.x; dy = F.facing.y; } }
        F.dart(dx, dy, e.power || 1);
      } else if (e.type === 'bud' && F && F.alive) {
        let tx, ty;
        if (e.aimed) [tx, ty] = G.screenToWorld(e.x, e.y);
        else if (G.input.mouse.inside && performance.now() - G.input.mouse.t < 4000) [tx, ty] = G.screenToWorld(G.input.mouse.x, G.input.mouse.y);
        else { const d = F.facing; tx = F.B.cx + d.x * 200; ty = F.B.cy + d.y * 200; }
        F.bud(tx, ty, 0.35);
      } else if (e.type === 'tap') G.pickFocus(e.x, e.y);
      else if (e.type === 'focusNext') C.cycle(e.dir);
      else if (e.type === 'key') this.onKey(e.code);
    }
  }

  onKey(code) {
    if (code === 'KeyG') this.cycleGravity();
    else if (code === 'KeyC') this.clear();
    else if (code === 'KeyT') this.tray.toggle();
    else if (code === 'Digit0' || code === 'Backquote') this.setTool('hand');
    else if (/^Digit[1-8]$/.test(code)) { const f = FLUIDS[+code.slice(5) - 1]; if (f) this.setTool(f.id === this.tool ? 'hand' : f.id); }
  }

  onPress(e) {
    const G = this.G;
    const p = [...G.input.pointers.values()].find(q => q.x0 === e.x && q.y0 === e.y && !q._kp);
    if (!p) return;
    p._kp = true;
    if (p.role === 'bud' || p.role === 'rally') return;
    if (!p.touch && e.button !== 0) return;
    const [wx, wy] = G.screenToWorld(e.x, e.y);
    const t = this.tool;
    if (t === 'hand') { this.tryGrab(p, wx, wy); return; }   // else: the floating stick drives the creature
    const fl = FLUIDS.find(f => f.id === t);
    if (fl) { this.startPour(p, fl); return; }
    if (THINGS.find(x => x.id === t)) {
      // pressing on an existing contraption picks it up to move/turn it
      let hit = null; for (const th of this.things) if (Math.hypot(th.x - wx, th.y - wy) < 60) hit = th;
      const e2 = hit || this.place(t, wx, wy);
      if (e2) this.placing = { pid: p.id, e: e2, x: e2.x, y: e2.y, ox: e2.x - wx, oy: e2.y - wy, moved: !!hit };
      this.claim(p, 'place');
      return;
    }
    if (t === 'eraser') { this.eraseAt(wx, wy); this.erasing = { pid: p.id, acc: 0 }; this.claim(p, 'erase'); }
  }

  updatePlacing(dt) {
    const G = this.G, pl = this.placing;
    if (!pl) return;
    const p = G.input.pointers.get(pl.pid);
    if (!p) { this.placing = null; return; }
    const [wx, wy] = G.screenToWorld(p.x, p.y);
    const lineish = pl.e.kind === 'bumper' || pl.e.kind === 'blade' || pl.e.kind === 'current';
    if (lineish && !pl.moved) {
      const dx = wx - pl.x, dy = wy - pl.y;
      if (Math.hypot(dx, dy) > 22) this.orient(pl.e, Math.atan2(dy, dx), dt);
    } else this.relocate(pl.e, wx + pl.ox, wy + pl.oy, dt);
  }

  update(dt) {
    const G = this.G, C = this.C;
    this.t += dt;
    if (this.erasing) {
      const p = G.input.pointers.get(this.erasing.pid);
      if (!p) this.erasing = null;
      else { this.erasing.acc += dt; if (this.erasing.acc > 0.06) { this.erasing.acc = 0; const [wx, wy] = G.screenToWorld(p.x, p.y); this.eraseAt(wx, wy); } }
    }
    C.update(dt, G.input.move, G.input.rally);
    if (C.mass < 24 || !C.focus) this.reborn();
    this.updateGrabs(dt);
    this.updatePours(dt);
    this.updatePlacing(dt);
    this.updateSwell(dt);
    // the creature notices a hovering mouse in hand mode (curiosity, not control)
    const F = C.focus;
    if (F && F.alive && this.tool === 'hand' && !G.input.stick.active && !this.grabs.size && G.input.device === 'mouse' && performance.now() - G.input.mouse.t < 1500) {
      const [mx, my] = G.screenToWorld(G.input.mouse.x, G.input.mouse.y);
      F.touchTarget = { x: mx, y: my };
    }
    // wordless hint: a ghost fingertip stretching the gel
    const showHint = !this.grabbedOnce && this.t > 2.6 && this.t < 22 && F && F.alive;
    if (F && F.alive) {
      const [sx, sy] = G.worldToScreen(F.B.cx, F.B.cy - F.B.r * 0.2);
      this.hintEl.style.transform = `translate(${sx}px, ${sy}px)`;
      const f = this.hintEl.firstChild;
      if (f) f.classList.toggle('m', G.input.device !== 'touch');
    }
    this.hintEl.style.opacity = showHint ? '0.9' : '0';
  }

  post(dt) {
    const G = this.G, P = G.phys;
    sound.setTension(Math.max(this.tension, this.bub ? Math.max(0, (this.bubFrac || 0) - 0.55) * 2 : 0));
    this.tray.setFull(P.count >= POUR_LIMIT);
  }

  onSplit(parent, child) {
    if (!this.grabs.size) return;
    const G = this.G;
    G.fx.burst(child.cx || parent.cx, child.cy || parent.cy, 6, [1, 0.9, 0.8], 120, { size: 2.5, life: 0.4 });
    buzz(5);
  }

  draw(D) {
    const G = this.G, z = G.cam.zoom;
    // fingertip glows
    for (const g of this.grabs.values()) {
      D.fxTop.push(g.wx, g.wy, 30 / z, 5, 0.85, 0.8, 1.0, 0.35, 3, 0, 0, 0);
      D.fxTop.push(g.wx, g.wy, 22 / z, 4, 0.9, 0.85, 1.0, 0.25, 3, 0, 0, 0);
      D.light(g.wx, g.wy, 50, 160, 0.85, 0.8, 1.0, -0.4);
    }
    for (const g of this.pours.values()) {
      const e = MATS[g.mat].emit;
      D.fxTop.push(g.wx, g.wy, 26 / z, 5, e[0], e[1], e[2], 0.45, 3, 0, 0, 0);
      D.light(g.wx, g.wy, 50, 180, e[0], e[1], e[2], -0.5);
    }
    // placing guide for line-like contraptions
    const pl = this.placing;
    if (pl && !pl.moved) {
      const p = G.input.pointers.get(pl.pid);
      if (p && (pl.e.kind === 'bumper' || pl.e.kind === 'blade' || pl.e.kind === 'current')) {
        const [wx, wy] = G.screenToWorld(p.x, p.y);
        const n = 8; for (let k = 1; k <= n; k++) D.fxTop.push(pl.x + (wx - pl.x) * k / n, pl.y + (wy - pl.y) * k / n, 4 / z, 0, 0.85, 0.8, 1, 0.35, 3, 0, 0, 0);
      }
    }
    // tool cursor for mouse users
    if (this.tool !== 'hand' && G.input.device === 'mouse' && G.input.mouse.inside) {
      const [mx, my] = G.screenToWorld(G.input.mouse.x, G.input.mouse.y);
      const fl = FLUIDS.find(f => f.id === this.tool);
      const c = fl ? MATS[fl.mat].emit : this.tool === 'eraser' ? [1, 0.5, 0.5] : [0.8, 0.75, 1];
      D.fxTop.push(mx, my, 18 / z, 4, c[0], c[1], c[2], 0.35, 3, 0, 0, 0);
    }
    // the swell: thin-film iridescence on an air dome
    if (this.bub) {
      const S = this.bub, R = this.bubR, t = this.t;
      const pal = (u) => [0.55 + 0.45 * Math.cos(6.283 * (u + 0.0)), 0.55 + 0.45 * Math.cos(6.283 * (u + 0.33)), 0.55 + 0.45 * Math.cos(6.283 * (u + 0.67))];
      const thin = this.bubFrac || 0;
      const c0 = pal(t * 0.15 + thin * 0.8), c1 = pal(t * 0.15 + 0.3 + thin), c2 = pal(t * 0.2 + 0.6);
      D.fx.push(S.x, S.y, R * 1.15, 5, c0[0], c0[1], c0[2], 0.10 + 0.08 * thin, 0, 0, 0, 0);
      D.fx.push(S.x, S.y, R / 0.7 * 0.985, 1, c1[0], c1[1], c1[2], 0.55 + 0.4 * thin, 0, 0, 0, 0);
      D.fx.push(S.x, S.y, R / 0.7 * 0.9, 1, c2[0], c2[1], c2[2], 0.25, 0, 0, 0, 0);
      for (let k = 0; k < 7; k++) {
        const a = t * (0.6 + k * 0.07) + k * 0.9; const rr = R * (0.55 + 0.35 * Math.sin(t * 0.7 + k));
        const c = pal(k / 7 + t * 0.1);
        D.fx.push(S.x + Math.cos(a) * rr, S.y + Math.sin(a) * rr, R * 0.22, 5, c[0], c[1], c[2], 0.12, 0, 0, 0, 0);
      }
      D.fx.push(S.x - R * 0.42, S.y - R * 0.48, Math.max(8, R * 0.22), 3, 1, 1, 1, 0.55, 0, 0, 0, 0);
      D.light(S.x - R * 0.4, S.y - R * 0.6, 60, R * 2.4, c1[0], c1[1], c1[2], 0.6);
    }
  }

  camera(cam) {
    cam.tx = 0; cam.ty = 0; cam.tz = this.fitZoom();
  }
}
