// ─────────────────────────────────────────────────────────────────────────────
//  FrameBuffer — a software canvas with tile-based dirty tracking.
//
//  The world is a static painted backdrop plus a few moving things. Each frame:
//    begin()    restore last frame's dirty tiles from the backdrop
//    …draw…     every draw marks the tiles it touches and writes pixels directly
//    present()  upload only the tiles that changed (this frame ∪ last frame)
//    …overlay…  Canvas2D glows/FX drawn on top (they mark tiles too)
//    end()      rotate dirty sets
//
//  Untouched pixels never change, so the page stays cheap to composite and to
//  stream — the engine costs what moves, not what exists.
// ─────────────────────────────────────────────────────────────────────────────
const TS = 5, TILE = 1 << TS;

export class FrameBuffer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.w = 0; this.h = 0;
    this.rects = [];
    this.fullNext = true;
  }

  resize(w, h) {
    w = Math.max(16, w | 0); h = Math.max(16, h | 0);
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
    this.back = new Uint32Array(w * h);
    this.back.fill(0xff000000); this.px.fill(0xff000000);
    this.tw = (w + TILE - 1) >> TS; this.th = (h + TILE - 1) >> TS;
    this.cur = new Uint8Array(this.tw * this.th);
    this.prev = new Uint8Array(this.tw * this.th);
    this.fullNext = true;
    return true;
  }

  // the backdrop changed wholesale (new room / repaint): next frame re-uploads everything
  invalidate() { this.fullNext = true; }

  // repaint a row band of the framebuffer from the backdrop right now (used while a room develops)
  restoreRows(y0, y1) {
    const w = this.w; const a = y0 * w, b = Math.min(this.h, y1) * w;
    this.px.set(this.back.subarray(a, b), a);
  }

  mark(x0, y0, x1, y1) {
    if (x1 <= 0 || y1 <= 0 || x0 >= this.w || y0 >= this.h) return;
    let tx0 = x0 >> TS, ty0 = y0 >> TS, tx1 = (x1 - 1) >> TS, ty1 = (y1 - 1) >> TS;
    if (tx0 < 0) tx0 = 0; if (ty0 < 0) ty0 = 0; if (tx1 >= this.tw) tx1 = this.tw - 1; if (ty1 >= this.th) ty1 = this.th - 1;
    const cur = this.cur, tw = this.tw;
    for (let ty = ty0; ty <= ty1; ty++) { const o = ty * tw; for (let tx = tx0; tx <= tx1; tx++) cur[o + tx] = 1; }
  }

  begin() {
    const { prev, tw, th, w, h, px, back } = this;
    if (this.fullNext) { px.set(back); prev.fill(0); return; }
    for (let ty = 0; ty < th; ty++) {
      const o = ty * tw;
      let tx = 0;
      while (tx < tw) {
        if (!prev[o + tx]) { tx++; continue; }
        let e = tx + 1; while (e < tw && prev[o + e]) e++;
        const x0 = tx << TS, x1 = Math.min(w, e << TS), y0 = ty << TS, y1 = Math.min(h, (ty + 1) << TS);
        for (let y = y0; y < y1; y++) { const r = y * w; for (let k = r + x0, ke = r + x1; k < ke; k++) px[k] = back[k]; }
        tx = e;
      }
    }
  }

  // upload changed tiles; returns number of dirty pixels (for the perf HUD)
  present() {
    const { cur, prev, tw, th, w, h, ctx, img } = this;
    if (this.fullNext) { ctx.putImageData(img, 0, 0); this.fullNext = false; this.dirtyPx = w * h; return this.dirtyPx; }
    // merge tile runs into rectangles (runs identical to the row above extend that rectangle)
    const open = this._open || (this._open = []); open.length = 0;
    let dirty = 0;
    const flush = (r) => { const x = r[0] << TS, y = r[1] << TS; const ww = Math.min(w, r[2] << TS) - x, hh = Math.min(h, r[3] << TS) - y; ctx.putImageData(img, 0, 0, x, y, ww, hh); dirty += ww * hh; };
    for (let ty = 0; ty < th; ty++) {
      const o = ty * tw;
      const next = this._next || (this._next = []); next.length = 0;
      let tx = 0;
      while (tx < tw) {
        if (!(cur[o + tx] | prev[o + tx])) { tx++; continue; }
        let e = tx + 1; while (e < tw && (cur[o + e] | prev[o + e])) e++;
        let found = null;
        for (let k = 0; k < open.length; k++) { const r = open[k]; if (r && r[0] === tx && r[2] === e) { found = r; open[k] = null; break; } }
        if (found) { found[3] = ty + 1; next.push(found); } else next.push([tx, ty, e, ty + 1]);
        tx = e;
      }
      for (let k = 0; k < open.length; k++) if (open[k]) flush(open[k]);
      open.length = 0; for (let k = 0; k < next.length; k++) open.push(next[k]);
    }
    for (let k = 0; k < open.length; k++) if (open[k]) flush(open[k]);
    this.dirtyPx = dirty;
    return dirty;
  }

  end() { const t = this.prev; this.prev = this.cur; this.cur = t; this.cur.fill(0); }
}
