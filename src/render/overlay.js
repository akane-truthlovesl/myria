// ─────────────────────────────────────────────────────────────────────────────
//  Overlay — Canvas2D light painted over the presented frame: soft far-field
//  glows, sparks, ripples, guides. The browser's rasteriser blends these in
//  SIMD for almost nothing; every draw marks its tiles so the next frame
//  restores them from the framebuffer.
// ─────────────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;

export class Overlay {
  constructor(R) {
    this.R = R; this.ctx = R.ctx; this.fb = R.fb; this.sprites = new Map(); this.ok = typeof document !== 'undefined';
    this.tmp = null;
  }
  _sprite(r, g, b, kind) {
    const key = ((r * 15 + 0.5) | 0) << 12 | ((g * 15 + 0.5) | 0) << 8 | ((b * 15 + 0.5) | 0) << 4 | kind;
    let s = this.sprites.get(key);
    if (!s) {
      s = document.createElement('canvas'); s.width = s.height = 64; const c = s.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); const col = (a) => `rgba(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0},${a})`;
      if (kind === 0) { gr.addColorStop(0, col(1)); gr.addColorStop(0.18, col(0.55)); gr.addColorStop(0.5, col(0.14)); gr.addColorStop(1, col(0)); }       // glow
      else if (kind === 1) { gr.addColorStop(0, col(0.5)); gr.addColorStop(0.35, col(0.28)); gr.addColorStop(0.7, col(0.08)); gr.addColorStop(1, col(0)); }   // broad wash
      else { gr.addColorStop(0, col(0)); gr.addColorStop(0.55, col(0)); gr.addColorStop(0.8, col(0.5)); gr.addColorStop(0.9, col(0.1)); gr.addColorStop(1, col(0)); } // bubble
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      this.sprites.set(key, s);
    }
    return s;
  }
  // moving solids (gears, pistons, gates): stamped by the browser's own rasteriser, straight onto the presented frame
  solid(sp, wx, wy, rot = 0, alpha = 1) {
    if (!sp.cv) { const cv = document.createElement('canvas'); cv.width = sp.w; cv.height = sp.h; const c = cv.getContext('2d'); const im = c.createImageData(sp.w, sp.h); const d = new Uint32Array(im.data.buffer); const n = sp.w * sp.h; for (let i = 0; i < n; i++) d[i] = (sp.al[i] << 24) | (sp.px[i] & 0xffffff); c.putImageData(im, 0, 0); sp.cv = cv; }
    const v = this.R.view; const x = (wx - v.ox) * v.z, y = (wy - v.oy) * v.z, k = v.z / sp.z;
    const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)); const hw = sp.w * 0.5 * k, hh = sp.h * 0.5 * k; const ex = cs * hw + sn * hh + 1, ey = sn * hw + cs * hh + 1;
    if (x + ex < 0 || y + ey < 0 || x - ex > this.fb.w || y - ey > this.fb.h) return;
    this.fb.mark((x - ex) | 0, (y - ey) | 0, Math.ceil(x + ex) + 1, Math.ceil(y + ey) + 1);
    const c = this.ctx; c.globalAlpha = alpha > 1 ? 1 : alpha;
    if (rot === 0 && k === 1) { c.drawImage(sp.cv, Math.round(x - hw), Math.round(y - hh)); return; }
    c.setTransform(Math.cos(rot) * k, Math.sin(rot) * k, -Math.sin(rot) * k, Math.cos(rot) * k, x, y); c.drawImage(sp.cv, -sp.w * 0.5, -sp.h * 0.5); c.setTransform(1, 0, 0, 1, 0, 0);
  }
  solids(list) { if (!this.ok || !list.length) { list.length = 0; return; } const c = this.ctx; c.globalCompositeOperation = 'source-over'; c.imageSmoothingEnabled = true; for (let i = 0; i < list.length; i += 5) this.solid(list[i], list[i + 1], list[i + 2], list[i + 3], list[i + 4]); c.globalAlpha = 1; list.length = 0; }
  begin() { if (this.ok) this.ctx.globalCompositeOperation = 'lighter'; }
  end() { if (this.ok) { this.ctx.globalCompositeOperation = 'source-over'; this.ctx.globalAlpha = 1; } }

  // soft additive dot (world coords, world radius)
  glow(wx, wy, wr, col, a = 1, kind = 0) {
    if (!this.ok || a <= 0.003) return;
    const R = this.R, v = R.view; const x = (wx - v.ox) * v.z, y = (wy - v.oy) * v.z, r = wr * v.z;
    if (x + r < 0 || y + r < 0 || x - r > this.fb.w || y - r > this.fb.h) return;
    this.fb.mark((x - r) | 0, (y - r) | 0, Math.ceil(x + r) + 1, Math.ceil(y + r) + 1);
    const c = this.ctx; c.globalAlpha = a > 1 ? 1 : a; c.drawImage(this._sprite(col[0], col[1], col[2], kind), x - r, y - r, r * 2, r * 2);
  }
  // thin ring / arc
  ring(wx, wy, wr, wt, col, a = 1, a0 = 0, a1 = TAU) {
    if (!this.ok || a <= 0.003 || wr <= 0) return;
    const v = this.R.view; const x = (wx - v.ox) * v.z, y = (wy - v.oy) * v.z, r = wr * v.z, t = Math.max(1, wt * v.z);
    this.fb.mark((x - r - t) | 0, (y - r - t) | 0, Math.ceil(x + r + t) + 1, Math.ceil(y + r + t) + 1);
    const c = this.ctx; c.globalAlpha = a > 1 ? 1 : a; c.strokeStyle = `rgb(${(col[0] * 255) | 0},${(col[1] * 255) | 0},${(col[2] * 255) | 0})`; c.lineWidth = t;
    c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke();
  }
  line(ax, ay, bx, by, wt, col, a = 1) {
    if (!this.ok || a <= 0.003) return;
    const v = this.R.view; const x0 = (ax - v.ox) * v.z, y0 = (ay - v.oy) * v.z, x1 = (bx - v.ox) * v.z, y1 = (by - v.oy) * v.z, t = Math.max(1, wt * v.z);
    this.fb.mark((Math.min(x0, x1) - t) | 0, (Math.min(y0, y1) - t) | 0, Math.ceil(Math.max(x0, x1) + t) + 1, Math.ceil(Math.max(y0, y1) + t) + 1);
    const c = this.ctx; c.globalAlpha = a > 1 ? 1 : a; c.strokeStyle = `rgb(${(col[0] * 255) | 0},${(col[1] * 255) | 0},${(col[2] * 255) | 0})`; c.lineWidth = t; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
}
