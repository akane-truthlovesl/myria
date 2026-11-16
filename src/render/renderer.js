// ─────────────────────────────────────────────────────────────────────────────
//  Renderer — owns the framebuffer, the developed backdrop and the frame order:
//    backdrop (static) → under-sprites → fluid clusters → inner life → present
//    → Canvas2D overlay (soft lights, sparks, guides)
// ─────────────────────────────────────────────────────────────────────────────
import { FrameBuffer } from './fb.js';
import { Backdrop } from './backdrop.js';
import { Fluid, makeLook, PAD, KR } from './fluid.js';
import { MATS } from '../sim/materials.js';
import { Ink } from './ink.js';
import { Overlay } from './overlay.js';
const now = () => (globalThis.__cpuNow ? globalThis.__cpuNow() : performance.now());

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.fb = new FrameBuffer(canvas);
    this.ctx = this.fb.ctx;
    this.backdrop = new Backdrop();
    this.fluid = new Fluid();
    this.view = { z: 1, ox: 0, oy: 0 };
    this.ink = new Ink(this.fb, this.view);
    this.ov = new Overlay(this);
    this.scale = 1;              // internal pixels per CSS pixel
    this.maxPixels = 2.6e6;      // hard budget for the internal framebuffer
    this.room = null;
    this.looks = new Map();
    this.clusters = [];
    this.pool = [];
    this.developing = null;      // {y, done} while a backdrop is being painted in slices
    this.stats = { underMs: 0, fluidMs: 0, presentMs: 0, dirty: 0, frameMs: 0, backdropMs: 0 };
    this.time = 0;
  }

  // internal resolution: device pixels, capped by a pixel budget, times the adaptive scale
  resize(force) {
    const cw = Math.max(64, this.canvas.clientWidth), ch = Math.max(64, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let s = dpr * this.scale;
    const px = cw * ch * s * s; if (px > this.maxPixels) s *= Math.sqrt(this.maxPixels / px);
    const w = Math.round(cw * s), h = Math.round(ch * s);
    if (!force && w === this.fb.w && h === this.fb.h) return false;
    this.fb.resize(w, h);
    this.cssW = cw; this.cssH = ch; this.pxScale = w / cw;
    if (this.room) this.setRoom(this.room, true);
    return true;
  }

  // fit the room into the framebuffer (contain) and develop its backdrop
  setRoom(room, sync = false) {
    this.room = room; this.roomGen = (this.roomGen || 0) + 1;
    const fb = this.fb;
    const z = Math.min(fb.w / room.W, fb.h / room.H);
    this.view.z = z; this.view.ox = room.W / 2 - fb.w / (2 * z); this.view.oy = room.H / 2 - fb.h / (2 * z);
    const t0 = performance.now();
    this.backdrop.prepare(room, fb, this.view);
    fb.refl = this.backdrop.reflect;
    if (sync) { this.backdrop.paint(fb, 0, fb.h); this._bake(); fb.invalidate(); this.developing = null; this.stats.backdropMs = performance.now() - t0; }
    else this.developing = { y: 0, t0 };
  }
  // paint a few more rows of a developing backdrop (budget in ms); returns true when finished
  develop(budgetMs = 7) {
    const D = this.developing; if (!D) return true;
    const fb = this.fb; const t0 = performance.now();
    const rows = Math.max(4, Math.round(60000 / fb.w));
    while (D.y < fb.h && performance.now() - t0 < budgetMs) { const y1 = Math.min(fb.h, D.y + rows); this.backdrop.paint(fb, D.y, y1); D.y = y1; }
    if (D.y >= fb.h) { this._bake(); this.stats.backdropMs = performance.now() - D.t0; this.developing = null; fb.invalidate(); return true; }
    return false;
  }

  _bake() { const fb = this.fb; if (!this.base || this.base.length !== fb.back.length) this.base = new Uint32Array(fb.back.length); this.base.set(fb.back); const d = this.room && this.room.decals; if (!d) return; this.ink.target(true); for (const e of d) e.bake(this.ink, this); this.ink.target(false); }

  // lift one baked decal out of the backdrop: repaint its square from the pristine plate, then re-bake whatever else lives there
  unbake(e) {
    const fb = this.fb, v = this.view, r = e.bakeR || 30; const base = this.base; if (!base || !e.baked) return; e.baked = false;
    const x0 = Math.max(0, Math.floor((e.bx - r - v.ox) * v.z)), y0 = Math.max(0, Math.floor((e.by - r - v.oy) * v.z));
    const x1 = Math.min(fb.w, Math.ceil((e.bx + r - v.ox) * v.z)), y1 = Math.min(fb.h, Math.ceil((e.by + r - v.oy) * v.z));
    if (x1 <= x0 || y1 <= y0) return;
    for (let y = y0; y < y1; y++) { const o = y * fb.w; for (let x = x0; x < x1; x++) fb.back[o + x] = base[o + x]; }
    const ink = this.ink; ink.target(true); ink.clip(x0, y0, x1, y1);
    for (const d of this.room.decals) { if (d === e || d.baked === false) continue; const rr = (d.bakeR || 1e4) + r; if (Math.abs((d.bx ?? d.x) - e.bx) < rr && Math.abs((d.by ?? d.y) - e.by) < rr) d.bake(ink, this); }
    ink.unclip(); ink.target(false);
    for (let y = y0; y < y1; y++) { const o = y * fb.w; for (let x = x0; x < x1; x++) fb.px[o + x] = fb.back[o + x]; }
    fb.mark(x0, y0, x1, y1);
  }

  // world ↔ framebuffer / css
  wx2f(x) { return (x - this.view.ox) * this.view.z; }
  wy2f(y) { return (y - this.view.oy) * this.view.z; }
  cssToWorld(cx, cy) { const s = this.pxScale; return [cx * s / this.view.z + this.view.ox, cy * s / this.view.z + this.view.oy]; }
  worldToCss(wx, wy) { const s = this.pxScale; return [(wx - this.view.ox) * this.view.z / s, (wy - this.view.oy) * this.view.z / s]; }

  lookFor(mat, tint) {
    const key = tint ? tint.id : mat;
    let L = this.looks.get(key);
    if (!L) { const m = tint ? { ...MATS[mat], ...tint } : MATS[mat]; const warm = m.emit[0] > m.emit[2]; L = makeLook({ ...m, absorbB: warm ? [0.95, 0.30, 0.08] : [0.05, 0.62, 1.05], emitB: warm ? [0.35, 0.85, 1.0] : [1.0, 0.56, 0.36] }); this.looks.set(key, L); }
    return L;
  }

  // ── fluid clusters: bodies of one render-group whose skins may touch share a field ──
  beginClusters() { for (const c of this.clusters) this.pool.push(c); this.clusters.length = 0; }
  _cluster() {
    const c = this.pool.pop() || { idx: new Int32Array(256), stamps: new Float32Array(5 * 512), hearts: new Float32Array(4 * 16) };
    c.coarse = false; c.frost = 0; c.n = 0; c.ns = 0; c.nh = 0; c.x0 = 1e9; c.y0 = 1e9; c.x1 = -1e9; c.y1 = -1e9; c.veil = 0; c.hasMix = false; c.glowBoost = 1; c.bulge = 1; c.key = null; c.look = null; c.order = 0;
    return c;
  }
  // add one physics body; `o` = { key, look, veil, glowBoost, order, heart:[x,y,r,s] }
  addBody(P, B, o) {
    if (!B.alive || B.count <= 0) return null;
    const m = KR * 1.2;
    let C = null;
    for (const c of this.clusters) {
      if (c.key !== o.key || c.look !== o.look) continue;
      if (B.minx - m > c.x1 || B.maxx + m < c.x0 || B.miny - m > c.y1 || B.maxy + m < c.y0) continue;
      C = c; break;
    }
    if (!C) { C = this._cluster(); C.key = o.key; C.look = o.look; C.order = o.order || 0; C.coarse = !!o.coarse; this.clusters.push(C); }
    if (C.n + B.len > C.idx.length) { const n = new Int32Array((C.n + B.len) * 2); n.set(C.idx.subarray(0, C.n)); C.idx = n; }
    const idx = P.bodyIdx, alive = P.alive, body = P.body, mix = P.mix;
    for (let k = 0; k < B.len; k++) { const i = idx[B.start + k]; if (alive[i] && body[i] === B.id) { C.idx[C.n++] = i; if (mix[i] > 0.02) C.hasMix = true; } }
    if (B.minx < C.x0) C.x0 = B.minx; if (B.miny < C.y0) C.y0 = B.miny; if (B.maxx > C.x1) C.x1 = B.maxx; if (B.maxy > C.y1) C.y1 = B.maxy;
    C.veil = Math.max(C.veil, o.veil || 0); C.glowBoost = Math.max(C.glowBoost, o.glowBoost || 1);
    if (o.heart && C.nh < 16) { C.hearts.set(o.heart, C.nh * 4); C.nh++; }
    return C;
  }
  // a tendril segment as a run of small stamps: (x0,y0,w0) → (x1,y1,w1), w = visible half-width in world units
  addStroke(C, x0, y0, x1, y1, w0, w1, glow) {
    this.fluid.setZoom(this.view.z);
    const zc = this.view.z / Math.min(5, this.fluid.cell + (C.coarse ? 1 : 0));
    const len = Math.hypot(x1 - x0, y1 - y0);
    const wm = Math.max(w0, w1);
    const R = Math.max(wm * 2.1, 2.2 / zc);            // never thinner than ~2 lattice cells
    const step = R / 2.6; const n = Math.max(1, Math.ceil(len / step));
    if (C.ns + n + 1 > C.stamps.length / 5) { const s = new Float32Array((C.ns + n + 1) * 10); s.set(C.stamps.subarray(0, C.ns * 5)); C.stamps = s; }
    const st = C.stamps; const sp = len / n;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n; const w = w0 + (w1 - w0) * t;
      const q = 1 - (w * w) / (R * R); const A = 0.62 / Math.pow(q > 0.05 ? q : 0.05, 3.5);   // centre-line field for the wanted width
      const o = C.ns * 5; st[o] = x0 + (x1 - x0) * t; st[o + 1] = y0 + (y1 - y0) * t; st[o + 2] = R; st[o + 3] = A * (sp > 0 ? sp : step) * 35 / (32 * R); st[o + 4] = glow; C.ns++;
    }
    const lo = Math.min(x0, x1) - R, hi = Math.max(x0, x1) + R, lo2 = Math.min(y0, y1) - R, hi2 = Math.max(y0, y1) + R;
    if (lo < C.x0) C.x0 = lo; if (hi > C.x1) C.x1 = hi; if (lo2 < C.y0) C.y0 = lo2; if (hi2 > C.y1) C.y1 = hi2;
  }

  // ── the frame ────────────────────────────────────────────────────────────
  // scene: { phys, under(R), inner(R), overlay(R) }
  frame(scene, time) {
    const fb = this.fb; this.time = time;
    const t0 = now();
    fb.begin();
    this.ink.target(false);
    if (scene.under) scene.under(this);
    const t1 = now();
    { const fs = this.fluid.stats; this.lastFluid = { ...fs }; fs.px = 0; fs.plate = 0; fs.nodes = 0; fs.clusters = 0; fs.tSplat = 0; fs.tDome = 0; fs.tShade = 0; }
    this.fluid.setZoom(this.view.z);
    const cl = this.clusters; cl.sort((a, b) => a.order - b.order);
    for (const C of cl) if (C.n > 0 || C.ns > 0) this.fluid.draw(fb, this.view, scene.phys, C);
    const t2 = now();
    if (scene.inner) scene.inner(this);
    this.stats.dirty = fb.present();
    if (scene.overlay) scene.overlay(this);
    fb.end();
    const t3 = now();
    const S = this.stats; const k = 0.1;
    S.underMs += (t1 - t0 - S.underMs) * k; S.fluidMs += (t2 - t1 - S.fluidMs) * k; S.presentMs += (t3 - t2 - S.presentMs) * k; S.frameMs += (t3 - t0 - S.frameMs) * k;
  }
}

export { PAD };
