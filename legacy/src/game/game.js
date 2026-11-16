// ─────────────────────────────────────────────────────────────────────────────
//  Game — the frame pipeline and the glue between will, matter and light.
// ─────────────────────────────────────────────────────────────────────────────
import { Physics, H, PR, SPACING } from '../engine/physics.js';
import { buildSDF } from '../engine/sdf.js';
import { MAT, MATS, M } from '../engine/materials.js';
import { Renderer } from '../render/renderer.js';
import { Input } from '../engine/input.js';
import { FX } from './fx.js';
import { Camera } from './camera.js';
import { Colony } from './colony.js';
import { dewHoming } from './organism.js';
import { ENTITY_TYPES, Mote } from './entities.js';
import { sound } from '../audio/audio.js';
import { haptics } from '../engine/haptics.js';
import { currentTint } from './tints.js';

const TAU = Math.PI * 2;

// morph personalities (on top of the rheology table)
export const MORPH = {
  [MAT.LUMEN]: { speed: 1, tonus: 1, dart: 1 },
  [MAT.SILVER]: { speed: 1.55, tonus: 0.75, dart: 1.25 },
  [MAT.RESIN]: { speed: 0.75, tonus: 1.15, dart: 0.8 },
  [MAT.BASTION]: { speed: 0.8, tonus: 1.4, dart: 0.9 },
  [MAT.FERRO]: { speed: 1.0, tonus: 0.9, dart: 1 },
  [MAT.FOAM]: { speed: 1.1, tonus: 0.8, dart: 1.4 },
  [MAT.CRYO]: { speed: 0.6, tonus: 1.6, dart: 1 },
};

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.R = new Renderer(canvas);
    this.input = new Input(canvas);
    this.phys = new Physics(6144, 768);
    this.fx = new FX();
    this.cam = new Camera();
    this.hud = hud; hud.G = this;
    this.ents = [];
    this.colony = null; this.colonies = [];
    this.mode = null;
    this.t = 0; this.paused = false;
    this.lights = [];
    this.massCap = 520;
    this.checkpoint = null;
    this.level = null;
    this.timeScale = 1;
    this.slowmo = 0;
    this.pip = [];
    this.stats = { frames: 0, physMs: 0, renderMs: 0 };
    this.phys.onSplit = (p, c) => this._onSplit(p, c);
    this.phys.onMerge = (k, g, n) => this._onMerge(k, g, n);
    this.dartSpeed = 560;
    this.sound = sound;
    this.lightProxy = { ents: this.R.ents, fx: this.R.fx, fxTop: this.R.fxTop, light: (...a) => this.lights.push(a) };
    window.addEventListener('resize', () => this.R.resize());
  }

  // ── level lifecycle ───────────────────────────────────────────────────
  load(level, opts = {}) {
    const P = this.phys;
    P.clear();
    this.fx.clear();
    this.ents = [];
    this.colonies = []; this.colony = null;
    this.level = level;
    const [x0, y0, x1, y1] = level.bounds;
    P.setBounds(x0 - 40, y0 - 40, x1 + 40, y1 + 40);
    const t0 = performance.now();
    const grid = buildSDF({ x0: x0 - 40, y0: y0 - 40, x1: x1 + 40, y1: y1 + 40, res: level.res || 4, base: level.base || 'solid', baseMat: level.baseMat, ops: level.geo, relief: level.relief, reliefFreq: level.reliefFreq });
    this.buildMs = performance.now() - t0;
    P.sdf = grid; this.R.setLevel(grid);
    P.gx = level.gravity ? level.gravity[0] : 0; P.gy = level.gravity ? level.gravity[1] : 600;
    P.drag = level.drag || 0;
    if (level.palette) Object.assign(this.R.pal, level.palette);
    this.massCap = level.cap || 520;
    this.cam.bounds = [x0, y0, x1, y1];
    for (const d of level.entities || []) this.spawnEntity(d);
    this.checkpoint = level.spawn ? { x: level.spawn[0], y: level.spawn[1] } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    this.levelTime = 0;
  }

  spawnEntity(d) {
    const T = ENTITY_TYPES[d.type];
    if (!T) { console.warn('unknown entity', d.type); return null; }
    const e = new T(this, d);
    this.ents.push(e);
    return e;
  }
  entity(id) { return this.ents.find(e => e.id === id); }

  addColony(group, x, y, n, opts = {}) {
    if (opts.tint === undefined && group === 0) opts = { ...opts, tint: currentTint() };
    const C = new Colony(this, group, opts);
    C.spawn(x, y, n, opts.mat ?? MAT.LUMEN);
    this.colonies.push(C);
    if (!this.colony) this.colony = C;
    return C;
  }

  // ── queries used by entities & organisms ──────────────────────────────
  isPlayerBody(B) { return B && B.alive && B.group >= 0 && B.group < 4 && B.kind !== 'ai'; }
  *playerBodies() { for (const C of this.colonies) for (const O of C.orgs) if (O.alive) yield O.B; }
  nearestPlayerBody(x, y, range) {
    let best = null, bd = range;
    for (const B of this.playerBodies()) { const d = Math.hypot(B.cx - x, B.cy - y) - B.r; if (d < bd) { bd = d; best = B; } }
    return best;
  }
  playerBodyNear(x, y, r) {
    let hit = null; const P = this.phys;
    P.forEachNear(x, y, r, (i) => { if (!hit) { const B = P.bodies[P.body[i]]; if (this.isPlayerBody(B)) hit = B; } });
    return hit;
  }
  gravityAt(x, y) {
    const P = this.phys; let gx = P.gx, gy = P.gy;
    for (const Z of P.zones) {
      if (!Z.gravity || x < Z.x0 || x > Z.x1 || y < Z.y0 || y > Z.y1) continue;
      const w = Z.weight ? Z.weight(x, y) : 1; gx += (Z.gx - gx) * w; gy += (Z.gy - gy) * w;
    }
    return [gx, gy];
  }
  swimAt(x, y) { for (const Z of this.phys.zones) if (Z.swim && x >= Z.x0 && x <= Z.x1 && y >= Z.y0 && y <= Z.y1) return 1; return 0; }
  findCuriosity(O) {
    const B = O.B; let best = null, bd = 190 + B.r;
    for (const e of this.ents) {
      if (e.dead || !(e instanceof Mote || e.d.type === 'prism' || e.d.type === 'lantern' && !e.lit)) continue;
      const d = Math.hypot(e.x - B.cx, e.y - B.cy); if (d < bd && d > B.r * 0.8) { bd = d; best = e; }
    }
    if (best) return best;
    // otherwise idly probe a nearby wall
    if (Math.random() < 0.5) {
      const a = Math.random() * TAU; const out = {};
      if (this.phys.raycast(B.cx, B.cy, Math.cos(a), Math.sin(a), B.r + 120, out) && out.t > B.r * 0.9) return { x: out.x, y: out.y, pull: 0.4 };
    }
    return null;
  }
  check(c) {
    if (!c) return true;
    if (typeof c === 'string') { const e = this.entity(c); return e ? !!e.on : false; }
    if (Array.isArray(c)) return c.every(k => this.check(k));
    if (c.any) return c.any.some(k => this.check(k));
    if (c.not) return !this.check(c.not);
    if (c.mass) return this.colony && this.colony.mass >= c.mass;
    if (c.lanterns) return this.ents.filter(e => e.d.type === 'lantern' && e.lit).length >= c.lanterns;
    if (c.fn) return c.fn(this);
    return true;
  }

  // ── matter bookkeeping ────────────────────────────────────────────────
  feed(B, n, x, y, col = [1, 0.85, 0.55], quiet = false) {
    const P = this.phys;
    const C = this.colonyOf(B);
    let total = C ? C.mass : B.count;
    for (let k = 0; k < n; k++) {
      if (total >= this.massCap) { this.radiance = (this.radiance || 0) + 1; B.energy = Math.min(1.5, (B.energy || 0) + 0.15); continue; }
      const a = Math.random() * TAU, r = Math.random() * 5;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const dx = B.cx - px, dy = B.cy - py, d = Math.hypot(dx, dy) + 1;
      const i = P.spawn(px, py, dx / d * 160 + B.vx, dy / d * 160 + B.vy, B.mat, B.id);
      if (i >= 0) { P.glow[i] = 1.2; P.rr[i] = 0.2; total++; }
    }
    if (!quiet) {
      // intake pulse: light streams inward and the body flushes where it drank
      this.fx.add({ x, y, life: 0.35, size: 26, grow: -70, type: 5, r: col[0], g: col[1], b: col[2], a: 1.2, drag: 0 });
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * TAU, rr = 10 + Math.random() * 14;
        const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
        const dx = B.cx - sx, dy = B.cy - sy, d = Math.hypot(dx, dy) + 1;
        this.fx.add({ x: sx, y: sy, vx: dx / d * 260, vy: dy / d * 260, life: 0.3, size: 3, type: 0, r: col[0], g: col[1], b: col[2], a: 1, drag: 1 });
      }
    }
    B.energy = Math.min(1.2, (B.energy || 0) + 0.05 * n);
  }
  shed(i, fx, fy, col = [1, 0.6, 0.3], life = 4.5) {
    const P = this.phys;
    const D = P.allocBody(-1, 'dew', P.mat[i]);
    if (!D) { P.kill(i); return; }
    const src = P.bodies[P.body[i]];
    D.tint = src.tint; D.fuseT = 0.6;
    P.transfer(i, D.id);
    const dx = P.x[i] - fx, dy = P.y[i] - fy, d = Math.hypot(dx, dy) + 1;
    P.vx[i] += dx / d * 260 + (Math.random() - 0.5) * 120; P.vy[i] += dy / d * 260 + (Math.random() - 0.5) * 120;
    P.ox[i] = P.x[i] - P.vx[i] / 120; P.oy[i] = P.y[i] - P.vy[i] / 120;
    P.life[i] = life; P.glow[i] = 1.4;
    this.fx.sparks(P.x[i], P.y[i], 3, dx / d, dy / d, col, 300);
    if (this.colonyOf(src)) this.colonyOf(src).lost++;
  }
  morph(B, mat, col) {
    const P = this.phys;
    const C = this.colonyOf(B);
    const bodies = C ? C.orgs.map(o => o.B) : [B];
    for (const b of bodies) {
      if (!b.alive) continue;
      b.mat = mat;
      for (let k = 0; k < b.len; k++) { const i = P.bodyIdx[b.start + k]; if (P.body[i] === b.id) { P.mat[i] = mat; P.glow[i] = 1.8; } }
      const O = b.ctrl; if (O) { const m = MORPH[mat] || MORPH[MAT.LUMEN]; O.morphSpeed = m.speed; O.morphTonus = m.tonus; O.morphDart = m.dart; }
    }
    if (C) C.mat = mat;
    sound.morph();
    this.fx.ring(B.cx, B.cy, col || MATS[mat].emit, B.r * 2.5, 0.7);
    this.onMorph && this.onMorph(B, mat);
  }
  hazards() {
    const out = this._hz || (this._hz = []); out.length = 0;
    for (const e of this.ents) {
      const n = e.d.type;
      if (n === 'blade') out.push({ x: e.S.x, y: e.S.y, r: e.len * 0.5 });
      else if (n === 'grinder') out.push({ x: e.x, y: e.y, r: e.r + 10 });
      else if (n === 'singularity') out.push({ x: e.x, y: e.y, r: e.r * 4 });
    }
    return out;
  }
  veilNear(x, y) { for (const e of this.ents) if (e.d.type === 'sentinel' && Math.hypot(e.x - x, e.y - y) < e.range + 300) return true; return false; }
  onDartDenied(O) { if (O.focused) this.fx.add({ x: O.B.cx, y: O.B.cy, life: 0.25, size: O.B.r * 1.3, type: 4, r: 0.6, g: 0.7, b: 0.9, a: 0.25 }); }
  colonyOf(B) { if (!B) return null; for (const C of this.colonies) if (C.group === B.group) return C; return null; }
  setCheckpoint(x, y, src) { this.checkpoint = { x, y, src }; }
  shakeAt(x, y, amt) { const d = Math.hypot(x - this.cam.x, y - this.cam.y); this.cam.shake = Math.min(1.2, this.cam.shake + amt * Math.max(0, 1 - d / 900)); }

  // ── physics callbacks ────────────────────────────────────────────────
  _onSplit(parent, child) {
    const C = this.colonyOf(parent);
    if (C && parent.kind !== 'dew' && parent.kind !== 'spent') {
      if (child.count < 6 && child.kind !== 'player') {
        // a crumb, not a sibling: becomes homing dew
        child.group = -1; child.kind = 'dew';
        return;
      }
      C.onSplit(parent, child);
      if (this.phys.events.cuts > 0) { sound.cut(); haptics.hurt(); this.onCut && this.onCut(parent, child); }
      else { sound.snap(0.5); }
    } else if (parent.kind === 'ai' && parent.ctrl && parent.ctrl.onSplit) parent.ctrl.onSplit(child);
    this.mode && this.mode.onSplit && this.mode.onSplit(parent, child);
  }
  _onMerge(keep, gone, n) {
    const C = this.colonyOf(keep);
    if (C) {
      C.onMerge(keep, gone);
      if ((gone.kind === 'dew' || gone.kind === 'spent') && n > 0) { sound.pop(0.5); this.fx.add({ x: gone.cx, y: gone.cy, life: 0.3, size: 14, grow: -40, type: 5, r: 1, g: 0.85, b: 0.7, a: 0.9 }); }
      if (gone.kind === 'fragment' || gone.kind === 'player') { sound.fuse(Math.min(1, n / 120)); haptics.fuse(); this.fx.ring(keep.cx, keep.cy, [1, 0.8, 0.6], keep.r * 2, 0.5); this.onFuse && this.onFuse(keep, gone, n); }
    }
    if (gone.ctrl && gone.ctrl.colony && gone.ctrl.colony !== C) gone.ctrl.colony.onMerge(keep, gone);
    this.mode && this.mode.onMerge && this.mode.onMerge(keep, gone, n);
  }
  onImpact(O, jolt, nx, ny) {
    const v = Math.min(1, jolt / 900);
    if (O.colony) { sound.splat(v); this.shakeAt(O.B.cx, O.B.cy, v * 0.35); if (O.focused) haptics.thump(v); }
    if (jolt > 500) this.fx.burst(O.B.cx - nx * O.B.r, O.B.cy - ny * O.B.r, Math.floor(4 + v * 8), [0.9, 0.95, 1], 140 * v, { size: 2.5, life: 0.5, type: 1 });
  }
  onPeel(O) { sound.snap(0.3); if (O.focused) haptics.snap(); }
  onDart(O, dx, dy, cost) {
    sound.dart(1); haptics.dart();
    // wake: a soft displacement ripple behind and a spray of fine droplets
    this.fx.ring(O.B.cx - dx * O.B.r * 0.8, O.B.cy - dy * O.B.r * 0.8, [0.9, 0.8, 0.7], 34, 0.3, { a: 0.45 });
    for (let k = 0; k < 6; k++) { const a = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.2, sp = 120 + Math.random() * 160;
      this.fx.add({ x: O.B.cx - dx * O.B.r, y: O.B.cy - dy * O.B.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, size: 2.5, type: 1, r: 1, g: 0.9, b: 0.85, a: 0.6, drag: 3 }); }
    this.mode && this.mode.onDart && this.mode.onDart(O, dx, dy, cost);
  }
  onBud(O, NB, dx, dy) { sound.bud(); haptics.snap(); }
  onFocus(C, O) { if (O && O.B) { this.fx.ring(O.B.cx, O.B.cy, [1, 0.95, 0.85], O.B.r * 2.2, 0.45); haptics.tick(); } }

  // ── frame ────────────────────────────────────────────────────────────
  frame(dtReal, draw = true) {
    const dt = Math.min(1 / 20, dtReal) * this.timeScale;
    const events = this.input.poll();
    this.t += dtReal;
    if (this.mode && this.mode.events) this.mode.events(events);
    if (!this.paused) {
      this.levelTime += dt;
      if (this.mode && this.mode.update) this.mode.update(dt);
      for (const e of this.ents) if (!e.dead) e.update(dt);
      // dew homes toward living bodies
      dewHoming(this.phys, this.phys.bodies, dt, [...this.playerBodies()]);
      const t0 = performance.now();
      if (dt > 0) this.phys.step(dt);
      this.stats.physMs = this.stats.physMs * 0.9 + (performance.now() - t0) * 0.1;
      for (const e of this.ents) if (!e.dead) e.post(dt);
      this.ents = this.ents.filter(e => !e.dead);
      this.postPhysics(dt);
      if (this.mode && this.mode.post) this.mode.post(dt);
      this.fx.update(dt);
    }
    this.updateCamera(dtReal);
    const fl = this.R.post.flash; fl[3] = Math.max(0, fl[3] - dtReal * 1.8);
    if (draw) this.render();
    this.stats.frames++;
  }

  postPhysics(dt) {
    const P = this.phys;
    // trampoline bounces
    if (P.events.bounce.length) { sound.bounce(Math.min(1, P.events.bounce.length / 30)); }
    // continuous sound layers follow the focused body
    const F = this.colony && this.colony.focus;
    if (F && F.alive) {
      const sp = Math.hypot(F.B.vx, F.B.vy);
      sound.setGlide(sp, Math.min(1, F.B.contact / Math.max(1, F.B.count) * 6));
      // tension: how stretched is the focused body (strands about to snap)
      const tens = Math.max(0, (F.spread - 1.6) / 1.4);
      sound.setTension(tens); haptics.tension(tens, dt);
    } else { sound.setGlide(0, 0); sound.setTension(0); }
  }

  updateCamera(dt) {
    const cam = this.cam;
    if (this.mode && this.mode.camera) this.mode.camera(cam, dt);
    else {
      const F = this.colony && this.colony.focus;
      if (F && F.alive) {
        cam.tx = F.B.cx + F.B.vx * 0.22; cam.ty = F.B.cy + F.B.vy * 0.18 - 20;
        const z = this.baseZoom() * Math.pow(140 / Math.max(60, F.B.count), 0.18);
        cam.tz = z;
      }
    }
    cam.update(dt, this.canvas.clientWidth, this.canvas.clientHeight, this.t);
  }
  baseZoom() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    let target = this.level && this.level.view ? this.level.view : 1100;  // world units across the short-ish axis
    if (h > w * 1.15) target *= 0.74;   // portrait phones: come closer so the creature stays tactile
    return Math.min(w, h * 1.6) / target * (this.zoomMul || 1);
  }

  screenToWorld(sx, sy) { const c = this.cam.view(); return [c.x + (sx - this.canvas.clientWidth / 2) / c.zoom, c.y + (sy - this.canvas.clientHeight / 2) / c.zoom]; }
  worldToScreen(wx, wy) { const c = this.cam.view(); return [(wx - c.x) * c.zoom + this.canvas.clientWidth / 2, (wy - c.y) * c.zoom + this.canvas.clientHeight / 2]; }

  // ── render prep ──────────────────────────────────────────────────────
  render() {
    const R = this.R, P = this.phys;
    const t0 = performance.now();
    R.resize();
    R.ents.reset(); R.fx.reset(); R.fxTop.reset();
    const pre = this.lights.slice(); this.lights.length = 0; for (const l of pre) this.lights.push(l);
    // entity visuals
    for (const e of this.ents) e.draw(this.lightProxy);
    // bodies: light, heart, inner life
    for (const C of this.colonies) for (const O of C.orgs) if (O.alive) this.drawOrganism(O, C);
    if (this.mode && this.mode.draw) this.mode.draw(this.lightProxy);
    this.fx.draw(R);
    this.drawStick();
    this.drawPiP();
    // lights: nearest 16 to the camera, interior lights included
    const cx = this.cam.x, cy = this.cam.y;
    this.lights.sort((a, b) => ((a[0] - cx) ** 2 + (a[1] - cy) ** 2) - ((b[0] - cx) ** 2 + (b[1] - cy) ** 2));
    R.clearLights();
    for (let k = 0; k < Math.min(16, this.lights.length); k++) R.light(...this.lights[k]);
    this.lights.length = 0;
    R.setShapes(P.shapes);
    R.packParticles(P, B => (B.layer !== undefined ? B.layer : (this.isPlayerBody(B) || B.kind === 'spent' || B.kind === 'dew' && B.tint ? 0 : 1)), null, this.t);
    // danger rim when the focused body is hurt recently
    R.danger[3] = Math.max(0, (R.danger[3] || 0) - 0.03);
    R.frame(this.cam.view(), this.t);
    this.stats.renderMs = this.stats.renderMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  drawOrganism(O, C) {
    const R = this.R, P = this.phys, B = O.B;
    const m = MATS[B.mat];
    const tint = B.tint;
    const em = tint ? tint.emit : m.emit;
    // the creature lights its world
    const I = 0.45 + Math.sqrt(B.count) * 0.05 + (B.energy || 0) * 0.5;
    this.lights.push([B.cx, B.cy, 40, 140 + B.r * 3, em[0], em[1], em[2], -I]);
    if (O.dormant) return;
    const veil = B.veil || 0;
    // heart: luminous nucleus (brighter when focused → diegetic "you are here")
    const beat = 0.5 + 0.5 * Math.sin(this.t * (O.focused ? 2.6 : 1.4) + O.id);
    const hs = Math.max(6, B.r * (0.45 + 0.08 * beat));
    const hk = ((O.focused ? 0.55 : 0.25) + 0.25 * C.focusFlash * (O.focused ? 1 : 0)) * (1 - 0.8 * veil);
    R.fx.push(B.cx, B.cy, hs * 2.2, 5, em[0], em[1] * 0.95, em[2] * 0.9, hk * (0.7 + 0.3 * beat), B.layer === 1 ? 2 : 1, 0, 0, 0);
    // inner life: micro-bubbles and motes riding the internal flow
    const n = B.len;
    const step = n > 300 ? 2 : 1;
    if (veil > 0.6) return;
    for (let k = 0; k < n; k += step) {
      const i = P.bodyIdx[B.start + k];
      const h = (i * 2654435761 >>> 0) % 101;
      if (h > 9) continue;
      const mask = B.layer === 1 ? 2 : 1;
      const sp = Math.hypot(P.vx[i], P.vy[i]);
      if (h < 4) R.fx.push(P.x[i], P.y[i], 2.2 + (h % 3) * 0.8, 1, 1.0, 0.97, 0.9, 0.5, mask, 0, 0, 0);
      else if (h < 7) R.fx.push(P.x[i], P.y[i], 2.8 + sp * 0.004, 0, em[0], em[1], em[2], 0.55 + Math.min(0.6, sp / 600), mask, 0, 0, 0);
      else R.fx.push(P.x[i], P.y[i], 5, 0, 1, 0.9, 0.75, 0.12 + P.glow[i] * 0.3, mask, 0, 0, 0);
    }
  }

  drawStick() {
    const S = this.input.stick;
    if (!S.active || !this.input.enabled || this.input.device !== 'touch' && this.input.device !== 'mouse') return;
    const R = this.R;
    const z = this.cam.zoom;
    const [ax, ay] = this.screenToWorld(S.ax, S.ay);
    const [kx, ky] = this.screenToWorld(S.kx, S.ky);
    const rad = this.input.stickRadius / z;
    R.fxTop.push(ax, ay, rad, 4, 0.75, 0.9, 1.0, 0.22, 3, 0, 0, 0);
    R.fxTop.push(kx, ky, rad * 0.42, 5, 0.9, 0.95, 1.0, 0.35, 3, 0, 0, 0);
    R.fxTop.push(kx, ky, rad * 0.16, 0, 1, 1, 1, 0.5, 3, 0, 0, 0);
    // the creature notices the finger
    const F = this.colony && this.colony.focus;
    if (F) F.touchTarget = { x: kx, y: ky };
  }

  // off-screen siblings appear as picture-in-picture bubbles on the rim
  drawPiP() {
    this.pip.length = 0;
    const C = this.colony; if (!C) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const R = this.R;
    for (const O of C.orgs) {
      if (!O.alive || O === C.focus) continue;
      const [sx, sy] = this.worldToScreen(O.B.cx, O.B.cy);
      const m = 30;
      if (sx > -O.B.r * this.cam.zoom && sx < w + O.B.r * this.cam.zoom && sy > -O.B.r * this.cam.zoom && sy < h + O.B.r * this.cam.zoom) continue;
      const cx = Math.min(w - m, Math.max(m, sx)), cy = Math.min(h - m, Math.max(m, sy));
      this.pip.push({ x: cx, y: cy, O });
      const [wx, wy] = this.screenToWorld(cx, cy);
      const z = this.cam.zoom;
      const em = (O.B.tint || MATS[O.B.mat]).emit;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 3 + O.id);
      R.fxTop.push(wx, wy, 24 / z, 4, em[0], em[1], em[2], 0.5 * pulse, 0, 0, 0, 0);
      R.fxTop.push(wx, wy, Math.min(20, 6 + Math.sqrt(O.B.count)) / z, 5, em[0], em[1], em[2], 0.9, 0, 0, 0, 0);
    }
  }

  // tap → focus a droplet (generous hit areas, regardless of size)
  pickFocus(sx, sy) {
    const C = this.colony; if (!C) return false;
    for (const p of this.pip) if (Math.hypot(p.x - sx, p.y - sy) < 40) { C.setFocus(p.O); return true; }
    const [wx, wy] = this.screenToWorld(sx, sy);
    let best = null, bd = 1e9;
    for (const O of C.orgs) {
      if (!O.alive) continue;
      const d = Math.hypot(O.B.cx - wx, O.B.cy - wy) - O.B.r;
      const slack = 34 / this.cam.zoom;
      if (d < slack && d < bd) { bd = d; best = O; }
    }
    if (best && best !== C.focus) { C.setFocus(best); sound.ui(); return true; }
    if (best && best === C.focus) { best.poke(wx, wy); sound.bell(sound.note(4 + Math.floor(Math.random() * 3), 2), 0.25, 0.9, 1.4, 0.5); haptics.tick(); return true; }
    return false;
  }
}
