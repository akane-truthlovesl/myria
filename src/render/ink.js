// ─────────────────────────────────────────────────────────────────────────────
//  Ink — tiny software rasteriser for everything that is not gel:
//  motes, irises, machines, sparks inside the body. Analytic, anti-aliased,
//  drawn straight into the framebuffer (so the gel can refract them) or into
//  the backdrop (static decals). Light adds with a "screen" blend, so glows
//  saturate softly instead of clipping.
// ─────────────────────────────────────────────────────────────────────────────
const LN = 256;
const mk = (f) => { const a = new Float32Array(LN + 1); for (let i = 0; i <= LN; i++) a[i] = f(i / LN); return a; };
// profiles over q = (d/R)²
export const PROF = {
  glow: mk(q => Math.exp(-5.2 * q) * (1 - q) * (1 - q)),          // soft light
  core: mk(q => Math.pow(1 - q, 6)),                              // tight hot centre
  halo: mk(q => Math.pow(1 - Math.sqrt(q), 2.2) * 0.9),           // broad, slow falloff
  dust: mk(q => (1 - q) * (1 - q)),
};
const INV255 = 1 / 255;

export class Ink {
  constructor(fb, view) { this.fb = fb; this.view = view; this.buf = null; this.markDirty = true; this.cx0 = 0; this.cy0 = 0; this.cx1 = 1e9; this.cy1 = 1e9; }
  clip(x0, y0, x1, y1) { this.cx0 = x0; this.cy0 = y0; this.cx1 = x1; this.cy1 = y1; }
  unclip() { this.cx0 = 0; this.cy0 = 0; this.cx1 = 1e9; this.cy1 = 1e9; }
  // draw into the live framebuffer (default) or the static backdrop
  target(back) { this.buf = back ? this.fb.back : this.fb.px; this.markDirty = !back; }

  // ── radial light: (world x,y,r) profile, colour 0..1, intensity ───────
  light(wx, wy, wr, prof, cr, cg, cb, a = 1) {
    const v = this.view, fb = this.fb;
    const cx = (wx - v.ox) * v.z, cy = (wy - v.oy) * v.z, R = wr * v.z;
    if (R < 0.6) return;
    let x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.floor(cy - R), y1 = Math.ceil(cy + R);
    if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
    if (x0 >= x1 || y0 >= y1) return;
    if (this.markDirty) fb.mark(x0, y0, x1, y1);
    const buf = this.buf, W = fb.w, k = LN / (R * R);
    const sr = cr * 255 * a, sg = cg * 255 * a, sb = cb * 255 * a;
    for (let y = y0; y < y1; y++) {
      const dy = y + 0.5 - cy, dy2 = dy * dy, o = y * W;
      for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - cx; const q = (dx * dx + dy2) * k;
        if (q >= LN) continue;
        const w = prof[q | 0]; if (w < 0.004) continue;
        const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
        let r = sr * w, g = sg * w, b = sb * w; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        buf[o + x] = 0xff000000 | ((db + b * (255 - db) * INV255) | 0) << 16 | ((dg + g * (255 - dg) * INV255) | 0) << 8 | ((dr + r * (255 - dr) * INV255) | 0);
      }
    }
  }

  // ── ring: radius r, half-thickness t (world), soft falloff `soft` (world), additive ──
  ring(wx, wy, wr, wt, cr, cg, cb, a = 1, soft = 0, arc0 = 0, arc1 = 0) {
    const v = this.view, fb = this.fb;
    const cx = (wx - v.ox) * v.z, cy = (wy - v.oy) * v.z, R = wr * v.z, T = Math.max(0.5, wt * v.z), S = soft * v.z;
    const E = R + T + S + 1;
    let x0 = Math.floor(cx - E), x1 = Math.ceil(cx + E), y0 = Math.floor(cy - E), y1 = Math.ceil(cy + E);
    if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
    if (x0 >= x1 || y0 >= y1) return;
    if (this.markDirty) fb.mark(x0, y0, x1, y1);
    const buf = this.buf, W = fb.w; const inner = R - T - S - 1, in2 = inner > 0 ? inner * inner : 0, out2 = E * E;
    const sr = cr * 255 * a, sg = cg * 255 * a, sb = cb * 255 * a; const iS = S > 0 ? 1 / S : 0;
    const arc = arc1 > arc0;
    for (let y = y0; y < y1; y++) {
      const dy = y + 0.5 - cy, dy2 = dy * dy, o = y * W;
      for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - cx; const d2 = dx * dx + dy2;
        if (d2 < in2 || d2 > out2) continue;
        const e = Math.abs(Math.sqrt(d2) - R) - T;
        let w = e <= -0.5 ? 1 : e < 0.5 ? 0.5 - e : 0;
        if (S > 0 && e > 0) { const g = 1 - e * iS; if (g > 0) w = Math.max(w, g * g * 0.55); }
        if (w <= 0.004) continue;
        if (arc) { let ang = Math.atan2(dy, dx); if (ang < arc0) ang += 6.2831853; if (ang > arc1) continue; }
        const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
        let r = sr * w, g = sg * w, b = sb * w; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        buf[o + x] = 0xff000000 | ((db + b * (255 - db) * INV255) | 0) << 16 | ((dg + g * (255 - dg) * INV255) | 0) << 8 | ((dr + r * (255 - dr) * INV255) | 0);
      }
    }
  }

  // ── disc: opaque-ish filled circle, alpha blended (dark machine parts, pupils, cores) ──
  disc(wx, wy, wr, cr, cg, cb, a = 1) {
    const v = this.view, fb = this.fb;
    const cx = (wx - v.ox) * v.z, cy = (wy - v.oy) * v.z, R = wr * v.z;
    let x0 = Math.floor(cx - R - 1), x1 = Math.ceil(cx + R + 1), y0 = Math.floor(cy - R - 1), y1 = Math.ceil(cy + R + 1);
    if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
    if (x0 >= x1 || y0 >= y1) return;
    if (this.markDirty) fb.mark(x0, y0, x1, y1);
    const buf = this.buf, W = fb.w; const sr = cr * 255, sg = cg * 255, sb = cb * 255; const R2 = (R + 0.5) * (R + 0.5), I2 = R > 1 ? (R - 0.5) * (R - 0.5) : 0;
    for (let y = y0; y < y1; y++) {
      const dy = y + 0.5 - cy, dy2 = dy * dy, o = y * W;
      for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - cx; const d2 = dx * dx + dy2; if (d2 >= R2) continue;
        const w = (d2 <= I2 ? 1 : R + 0.5 - Math.sqrt(d2)) * a;
        const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
        buf[o + x] = 0xff000000 | ((db + (sb - db) * w) | 0) << 16 | ((dg + (sg - dg) * w) | 0) << 8 | ((dr + (sr - dr) * w) | 0);
      }
    }
  }

  // ── capsule light: a glowing segment (beams, tethers, streaks) ────────
  beam(ax, ay, bx, by, wr, cr, cg, cb, a = 1, prof = PROF.glow) {
    const v = this.view, fb = this.fb;
    const x0f = (ax - v.ox) * v.z, y0f = (ay - v.oy) * v.z, x1f = (bx - v.ox) * v.z, y1f = (by - v.oy) * v.z, R = Math.max(0.8, wr * v.z);
    let x0 = Math.floor(Math.min(x0f, x1f) - R), x1 = Math.ceil(Math.max(x0f, x1f) + R), y0 = Math.floor(Math.min(y0f, y1f) - R), y1 = Math.ceil(Math.max(y0f, y1f) + R);
    if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
    if (x0 >= x1 || y0 >= y1) return;
    if (this.markDirty) fb.mark(x0, y0, x1, y1);
    const buf = this.buf, W = fb.w; const ex = x1f - x0f, ey = y1f - y0f; const il = 1 / (ex * ex + ey * ey + 1e-6); const k = LN / (R * R);
    const sr = cr * 255 * a, sg = cg * 255 * a, sb = cb * 255 * a;
    for (let y = y0; y < y1; y++) {
      const py = y + 0.5 - y0f, o = y * W;
      for (let x = x0; x < x1; x++) {
        const px = x + 0.5 - x0f; let t = (px * ex + py * ey) * il; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - ex * t, dy = py - ey * t; const q = (dx * dx + dy * dy) * k; if (q >= LN) continue;
        const w = prof[q | 0]; if (w < 0.004) continue;
        const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
        let r = sr * w, g = sg * w, b = sb * w; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
        buf[o + x] = 0xff000000 | ((db + b * (255 - db) * INV255) | 0) << 16 | ((dg + g * (255 - dg) * INV255) | 0) << 8 | ((dr + r * (255 - dr) * INV255) | 0);
      }
    }
  }

  // ── four-point glint: an axis-aligned diffraction cross, rasterised as two thin arms ──
  glint(wx, wy, wr, cr, cg, cb, a = 1) {
    const v = this.view, fb = this.fb;
    const cx = (wx - v.ox) * v.z, cy = (wy - v.oy) * v.z, R = wr * v.z;
    if (R < 2) return;
    const buf = this.buf, W = fb.w, iR = 1 / R; const hw = Math.max(1, Math.round(R * 0.07));
    const sr = cr * 255 * a, sg = cg * 255 * a, sb = cb * 255 * a;
    const arm = (x0, x1, y0, y1, horiz) => {
      if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
      if (x0 >= x1 || y0 >= y1) return;
      if (this.markDirty) fb.mark(x0, y0, x1, y1);
      for (let y = y0; y < y1; y++) {
        const dy = Math.abs(y + 0.5 - cy), o = y * W;
        for (let x = x0; x < x1; x++) {
          const dx = Math.abs(x + 0.5 - cx); const along = horiz ? dx : dy, across = horiz ? dy : dx;
          const t = 1 - along * iR; if (t <= 0) continue;
          const w = t * t * t / (1 + across * across * 1.4); if (w < 0.012) continue;
          const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
          let r = sr * w, g = sg * w, b = sb * w; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
          buf[o + x] = 0xff000000 | ((db + b * (255 - db) * INV255) | 0) << 16 | ((dg + g * (255 - dg) * INV255) | 0) << 8 | ((dr + r * (255 - dr) * INV255) | 0);
        }
      }
    };
    arm(Math.floor(cx - R), Math.ceil(cx + R), Math.floor(cy) - hw, Math.floor(cy) + hw + 1, true);
    arm(Math.floor(cx) - hw, Math.floor(cx) + hw + 1, Math.floor(cy - R), Math.ceil(cy + R), false);
  }

  // ── stamp a pre-shaded sprite at a world position with rotation (alpha blended, nearest sampling) ──
  blit(sp, wx, wy, rot = 0, alpha = 1) {
    const v = this.view, fb = this.fb;
    const cx = (wx - v.ox) * v.z, cy = (wy - v.oy) * v.z; const k = v.z / sp.z;
    const c = Math.cos(rot), s = Math.sin(rot); const hw = sp.w * 0.5 * k, hh = sp.h * 0.5 * k;
    const ex = Math.abs(c) * hw + Math.abs(s) * hh, ey = Math.abs(s) * hw + Math.abs(c) * hh;
    let x0 = Math.floor(cx - ex), x1 = Math.ceil(cx + ex), y0 = Math.floor(cy - ey), y1 = Math.ceil(cy + ey);
    if (x0 < this.cx0) x0 = this.cx0; if (y0 < this.cy0) y0 = this.cy0; if (x1 > fb.w) x1 = fb.w; if (y1 > fb.h) y1 = fb.h; if (x1 > this.cx1) x1 = this.cx1; if (y1 > this.cy1) y1 = this.cy1;
    if (x0 >= x1 || y0 >= y1) return;
    if (this.markDirty) fb.mark(x0, y0, x1, y1);
    const buf = this.buf, W = fb.w, ik = 1 / k, sw = sp.w, sh = sp.h, spx = sp.px, sal = sp.al; const a255 = alpha / 255;
    for (let y = y0; y < y1; y++) {
      const dy = y + 0.5 - cy, o = y * W;
      for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - cx;
        const u = ((dx * c + dy * s) * ik + sw * 0.5) | 0, w_ = ((-dx * s + dy * c) * ik + sh * 0.5) | 0;
        if (u < 0 || w_ < 0 || u >= sw || w_ >= sh) continue;
        const q = w_ * sw + u; const a = sal[q]; if (!a) continue;
        const sc = spx[q];
        if (a === 255 && alpha >= 1) { buf[o + x] = 0xff000000 | sc; continue; }
        const t = a * a255; const p = buf[o + x]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
        buf[o + x] = 0xff000000 | ((db + (((sc >> 16) & 255) - db) * t) | 0) << 16 | ((dg + (((sc >> 8) & 255) - dg) * t) | 0) << 8 | ((dr + ((sc & 255) - dr) * t) | 0);
      }
    }
  }

  // ── tiny points: inner-life specks, 1–3 px, bilinear-weighted so slow drift is smooth ──
  speck(wx, wy, cr, cg, cb, a = 1, size = 1) {
    const v = this.view, fb = this.fb;
    const fx = (wx - v.ox) * v.z - 0.5, fy = (wy - v.oy) * v.z - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy); const ax = fx - x0, ay = fy - y0;
    if (x0 < 1 || y0 < 1 || x0 >= fb.w - 2 || y0 >= fb.h - 2) return;
    const buf = this.buf, W = fb.w; const sr = cr * 255 * a, sg = cg * 255 * a, sb = cb * 255 * a;
    if (this.markDirty) fb.mark(x0 - 1, y0 - 1, x0 + 3, y0 + 3);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const w = (i ? ax : 1 - ax) * (j ? ay : 1 - ay) * size; if (w < 0.02) continue;
      const k = (y0 + j) * W + x0 + i; const p = buf[k]; const dr = p & 255, dg = (p >> 8) & 255, db = (p >> 16) & 255;
      let r = sr * w, g = sg * w, b = sb * w; if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
      buf[k] = 0xff000000 | ((db + b * (255 - db) * INV255) | 0) << 16 | ((dg + g * (255 - dg) * INV255) | 0) << 8 | ((dr + r * (255 - dr) * INV255) | 0);
    }
  }
}
