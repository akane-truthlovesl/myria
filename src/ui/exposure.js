// ─────────────────────────────────────────────────────────────────────────────
//  The long exposure: a chamber's run in one picture, for the result card.
//  The room as it stood at the end, darkened like a plate left open, and on it
//  the way you went as a ribbon of light, cool where you woke and warm where you
//  went home. As in a real long exposure it is brightest where you lingered and
//  faint where you flew. Every light you took is a spark, every one you left a
//  dim ring (Radiance, at a glance), and the echo you raced is a pale thread.
//  On the card it develops: the run is drawn again from the start, a bead of
//  light at its head, the whole run in a breath and a half.
// ─────────────────────────────────────────────────────────────────────────────
const COOL = [0.42, 0.86, 1], WARM = [1, 0.76, 0.4];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const LAYERS = [[9, 0.06], [3.4, 0.2], [1.1, 0.85]];

// rec: [[u, v]] along/across, 10 a second (as Odyssey records a run) · o.lights: the room's lights as they lay ({x, y, dead}) · o.ghost: [[x, y]] the echo raced
// o.runs: several runs at once, each { rec, from, to, home } (Duet: two creatures' paths woven over one dish, each in its own colours)
// the room's own rectangle on the glass (a little margin round it), not the whole window, copied onto a small plate
// (the card lives inside the HUD, which is zoomed on large windows: sizes are in its units, pixels in the screen's)
function plate(R, spec, o) {
  const c = R.canvas, box = c.getBoundingClientRect(), cw = box.width || c.width, ch = box.height || c.height; if (!cw || !ch) return null;
  const [ax, ay] = R.worldToCss(0, 0), [bx, by] = R.worldToCss(spec.W, spec.H), mg = 0.03 * Math.max(bx - ax, by - ay);
  const x0 = Math.max(0, ax - mg), y0 = Math.max(0, ay - mg), x1 = Math.min(cw, bx + mg), y1 = Math.min(ch, by + mg); if (x1 - x0 < 20 || y1 - y0 < 20) return null;
  const vw = typeof innerWidth !== 'undefined' ? innerWidth : 800, vh = typeof innerHeight !== 'undefined' ? innerHeight : 600;
  const z = o.zoom || 1, maxW = Math.min(o.maxW || 360, vw * 0.84 / z), maxH = Math.min(o.maxH || (vh > vw ? 300 : 210), vh * 0.34 / z);
  const k = Math.min(maxW / (x1 - x0), maxH / (y1 - y0)), w = Math.max(1, Math.round((x1 - x0) * k)), h = Math.max(1, Math.round((y1 - y0) * k));
  const dpr = Math.min(3, ((typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1) * z);
  const mk = () => { const q = document.createElement('canvas'); q.width = Math.round(w * dpr); q.height = Math.round(h * dpr); const g = q.getContext('2d'); g.scale(dpr, dpr); g.lineCap = 'round'; g.lineJoin = 'round'; return [q, g]; };
  const P = (x, y) => { const q = R.worldToCss(x, y); return [(q[0] - x0) * k, (q[1] - y0) * k]; };
  const [base, gb] = mk(); const sx = c.width / cw, sy = c.height / ch;
  gb.drawImage(c, x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy, 0, 0, w, h);
  return { w, h, mk, P, base, gb };
}

export function exposure(R, spec, rec, o = {}) {
  const runs = (o.runs || [{ rec, from: COOL, to: WARM, home: true }]).filter(q => q.rec && q.rec.length >= 3);
  if (typeof document === 'undefined' || !R || !R.canvas || !spec || !runs.length) return null;
  try {
    const F = plate(R, spec, o); if (!F) return null; const { w, h, mk, P, base, gb } = F;
    const land = spec.W >= spec.H, at = ([u, v]) => P(land ? u * spec.W : v * spec.W, land ? v * spec.H : u * spec.H);
    for (const r of runs) r.pts = r.rec.map(at);
    const pts = runs[0].pts, n = pts.length;

    // the plate: the room darkened, a vignette, the echo's thread, the lights that were left, the ring where it woke
    gb.fillStyle = 'rgba(1,6,12,0.52)'; gb.fillRect(0, 0, w, h);
    { const r = gb.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,3,8,0.55)'); gb.fillStyle = r; gb.fillRect(0, 0, w, h); }
    if (o.ghost && o.ghost.length > 2) { gb.setLineDash([2, 3]); gb.strokeStyle = 'rgba(150,200,255,0.34)'; gb.lineWidth = 1; gb.beginPath(); o.ghost.forEach((q, i) => { const [x, y] = P(q[0], q[1]); if (i) gb.lineTo(x, y); else gb.moveTo(x, y); }); gb.stroke(); gb.setLineDash([]); }
    const taken = [];
    for (const m of o.lights || []) {
      // every light is a dim ring on the plate; the ones taken light up as the run passes them
      const [x, y] = P(m.x, m.y); if (m.dead) { let bi = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = (pts[i][0] - x) ** 2 + (pts[i][1] - y) ** 2; if (d < bd) { bd = d; bi = i; } } taken.push([x, y, bi]); }
      gb.strokeStyle = 'rgba(170,205,225,0.55)'; gb.lineWidth = 0.9; gb.beginPath(); gb.arc(x, y, 2.4, 0, Math.PI * 2); gb.stroke();
    }
    for (const r of runs) { const [x, y] = r.pts[0]; gb.strokeStyle = rgba(r.from, 0.8); gb.lineWidth = 1.2; gb.beginPath(); gb.arc(x, y, 4.5, 0, Math.PI * 2); gb.stroke(); }

    // the run: a curve through the midpoints, each little piece as bright as the creature was slow there (light adds, so order does not matter)
    for (const r of runs) {
      const p = r.pts, m = p.length, mid = (i) => [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2]; r.segs = [];
      for (let i = 1; i < m - 1; i++) { const a = i === 1 ? p[0] : mid(i - 1), b = i === m - 2 ? p[m - 1] : mid(i), L = Math.hypot(b[0] - a[0], b[1] - a[1]); r.segs.push({ a, b, q: p[i], glow: Math.min(1, Math.max(0.16, 2.4 / (L + 0.7))), col: mix(r.from, r.to, i / (m - 1)) }); }
    }
    const segs = runs[0].segs, most = Math.max(...runs.map(r => r.segs.length));
    const seg = (g, s) => { for (const [lw, a0] of LAYERS) { g.lineWidth = lw; g.strokeStyle = rgba(lw < 2 ? mix(s.col, [1, 1, 1], 0.45) : s.col, a0 * s.glow); g.beginPath(); g.moveTo(s.a[0], s.a[1]); g.quadraticCurveTo(s.q[0], s.q[1], s.b[0], s.b[1]); g.stroke(); } };
    const spark = (g, x, y) => { const r = g.createRadialGradient(x, y, 0, x, y, 5); r.addColorStop(0, 'rgba(255,236,190,0.9)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(x - 5, y - 5, 10, 10); g.strokeStyle = 'rgba(255,240,210,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - 3.2, y); g.lineTo(x + 3.2, y); g.moveTo(x, y - 3.2); g.lineTo(x, y + 3.2); g.stroke(); };
    const home = (g) => { for (const q of runs) { if (!q.home) continue; const [x, y] = q.pts[q.pts.length - 1], r = g.createRadialGradient(x, y, 0, x, y, 16); r.addColorStop(0, 'rgba(255,248,230,0.95)'); r.addColorStop(0.35, rgba(q.to, 0.5)); r.addColorStop(1, rgba(q.to, 0)); g.fillStyle = r; g.fillRect(x - 16, y - 16, 32, 32); } };
    const [trail, gt] = mk(); gt.globalCompositeOperation = 'lighter';
    const [out, go] = mk(); out.style.width = w + 'px'; out.style.height = h + 'px'; out.className = 'r-exposure';
    const compose = (head) => {
      go.globalCompositeOperation = 'source-over'; go.clearRect(0, 0, w, h); go.drawImage(base, 0, 0, w, h); go.globalCompositeOperation = 'lighter'; go.drawImage(trail, 0, 0, w, h);
      for (const [x, y, c] of head || []) { const r = go.createRadialGradient(x, y, 0, x, y, 9); r.addColorStop(0, 'rgba(255,252,240,1)'); r.addColorStop(0.3, rgba(c, 0.6)); r.addColorStop(1, rgba(c, 0)); go.fillStyle = r; go.fillRect(x - 9, y - 9, 18, 18); }
      go.globalCompositeOperation = 'source-over';
    };
    const byIdx = new Map(); for (const t of taken) { const j = Math.max(0, Math.min(segs.length - 1, t[2] - 1)); (byIdx.get(j) || byIdx.set(j, []).get(j)).push(t); }
    const all = () => { gt.clearRect(0, 0, w, h); for (const r of runs) for (const s of r.segs) seg(gt, s); for (const t of taken) spark(gt, t[0], t[1]); home(gt); compose(null); };
    const heads = (k) => runs.map(r => { const s = r.segs[Math.min(r.segs.length - 1, Math.max(0, k - 1))]; return s ? [s.b[0], s.b[1], r.to] : null; }).filter(Boolean);
    all();
    // develop: the run drawn again at its own pace (where it lingered, the bead lingers), in about a breath and a half
    out.develop = (dur = 1500, delay = 160) => {
      if (out.dev || typeof requestAnimationFrame === 'undefined') return; out.dev = true; gt.clearRect(0, 0, w, h); compose(heads(0));
      let drawn = 0, t0 = 0;
      const tick = (now) => {
        if (!t0) t0 = now + delay; const t = Math.max(0, Math.min(1, (now - t0) / dur)), want = Math.floor(t * most);
        for (; drawn < want; drawn++) { for (const r of runs) if (r.segs[drawn]) seg(gt, r.segs[drawn]); for (const q of byIdx.get(drawn) || []) spark(gt, q[0], q[1]); }
        if (t >= 1) { out.dev = false; all(); return; }
        compose(heads(drawn)); requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    return out;
  } catch (_) { return null; }
}

// Bloom's garden: the dish as the rain left it, dimmed, and on it every figure drawn whole, each in its own colour, in the
// order they were drawn. On the card the garden grows again: one figure after another, stroke by stroke, in about two breaths.
// figs: [{ pts: [[x, y]], segs: [[i, j]], col: [r, g, b] }] in world units
export function garden(R, spec, figs, o = {}) {
  if (typeof document === 'undefined' || !R || !R.canvas || !spec) return null;
  try {
    const F = plate(R, spec, o); if (!F) return null; const { w, h, mk, P, base, gb } = F;
    gb.fillStyle = 'rgba(4,2,12,0.62)'; gb.fillRect(0, 0, w, h);
    { const r = gb.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(3,0,8,0.5)'); gb.fillStyle = r; gb.fillRect(0, 0, w, h); }
    const list = figs.map(f => ({ col: f.col, segs: f.segs, pts: f.pts.map(([x, y]) => P(x, y)) }));
    // (a long rain leaves a crowded garden: the more figures, the lighter each one's hand, so they stay figures and do not melt into a white knot;
    //  each is laid over the last in its own colour rather than added to it)
    const dk = Math.max(0.4, Math.min(1, Math.sqrt(14 / Math.max(1, list.length))));
    const stroke = (g, f, i, j, u) => { const a = f.pts[i], b = f.pts[j], ex = a[0] + (b[0] - a[0]) * u, ey = a[1] + (b[1] - a[1]) * u;
      g.lineWidth = 3.6; g.strokeStyle = rgba(f.col, 0.13 * dk); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(ex, ey); g.stroke();
      g.lineWidth = 1; g.strokeStyle = rgba(mix(f.col, [1, 1, 1], 0.25), 0.8 * dk + 0.1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(ex, ey); g.stroke(); };
    const star = (g, f, x, y) => { g.fillStyle = rgba(mix(f.col, [1, 1, 1], 0.5), 0.85 * dk + 0.1); g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); };
    const whole = (g, f, u = 1) => { for (const [i, j] of f.segs) stroke(g, f, i, j, u); if (u >= 1) for (const [x, y] of f.pts) star(g, f, x, y); };
    const [out, go] = mk(); out.style.width = w + 'px'; out.style.height = h + 'px'; out.className = 'r-exposure';
    const [ink, gi] = mk();
    const compose = () => { go.clearRect(0, 0, w, h); go.drawImage(base, 0, 0, w, h); go.drawImage(ink, 0, 0, w, h); };
    const all = () => { gi.clearRect(0, 0, w, h); for (const f of list) whole(gi, f); compose(); };
    all();
    out.develop = (dur = 1900, delay = 220) => {
      if (out.dev || typeof requestAnimationFrame === 'undefined' || !list.length) return; out.dev = true; gi.clearRect(0, 0, w, h); compose();
      const n = list.length, each = 1 / n; let done = 0, t0 = 0;
      const tick = (now) => {
        if (!t0) t0 = now + delay; const t = Math.max(0, Math.min(1, (now - t0) / dur));
        for (; done < n && t >= (done + 1) * each; done++) whole(gi, list[done]);
        if (t >= 1) { out.dev = false; all(); return; }
        compose(); const f = list[done]; if (f) whole(go, f, (t - done * each) / each);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    return out;
  } catch (_) { return null; }
}
