// ─────────────────────────────────────────────────────────────────────────────
//  Static world geometry as a signed-distance grid.
//  One grid feeds both the soft-body collider and the glass/stone shaders, so
//  what you see is exactly what you touch.
// ─────────────────────────────────────────────────────────────────────────────
import { SURF } from './materials.js';

const CLAMP = 72;

function rot(dx, dy, a) {
  if (!a) return [dx, dy];
  const c = Math.cos(a), s = Math.sin(a);
  return [dx * c + dy * s, -dx * s + dy * c];
}

export function sdShape(px, py, s) {
  switch (s.t) {
    case 'circle': return Math.hypot(px - s.x, py - s.y) - s.r;
    case 'ellipse': {
      let [dx, dy] = rot(px - s.x, py - s.y, s.a);
      // cheap but smooth ellipse approximation (scaled circle with gradient fix)
      const k0 = Math.hypot(dx / s.rx, dy / s.ry);
      const k1 = Math.hypot(dx / (s.rx * s.rx), dy / (s.ry * s.ry));
      return k1 > 1e-6 ? k0 * (k0 - 1) / k1 : -Math.min(s.rx, s.ry);
    }
    case 'box': {
      const [dx, dy] = rot(px - s.x, py - s.y, s.a);
      const r = s.r || 0;
      const qx = Math.abs(dx) - s.w / 2 + r, qy = Math.abs(dy) - s.h / 2 + r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    }
    case 'cap': {
      const ax = s.ax, ay = s.ay, bx = s.bx, by = s.by;
      const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
      const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
      return Math.hypot(pax - bax * h, pay - bay * h) - (s.r + (s.r2 !== undefined ? (s.r2 - s.r) * h : 0));
    }
    case 'ring': {
      const l = Math.hypot(px - s.x, py - s.y);
      return Math.abs(l - s.R) - s.r;
    }
    case 'poly': {
      const v = s.pts; const n = v.length;
      let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2, sg = 1;
      for (let i = 0, j = n - 1; i < n; j = i, i++) {
        const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1];
        const wx = px - v[i][0], wy = py - v[i][1];
        const h = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
        const bx = wx - ex * h, by = wy - ey * h;
        d = Math.min(d, bx * bx + by * by);
        const c1 = py >= v[i][1], c2 = py < v[j][1], c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sg = -sg;
      }
      return sg * Math.sqrt(d) - (s.r || 0);
    }
    case 'path': { // thick polyline (tunnel / vine), radius r
      const v = s.pts; let d = 1e9;
      for (let i = 0; i < v.length - 1; i++) {
        const ax = v[i][0], ay = v[i][1], bx = v[i + 1][0], by = v[i + 1][1];
        const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
        const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
        d = Math.min(d, Math.hypot(pax - bax * h, pay - bay * h));
      }
      return d - s.r;
    }
    default: return 1e9;
  }
}

function shapeBounds(s) {
  switch (s.t) {
    case 'circle': return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    case 'ellipse': { const m = Math.max(s.rx, s.ry); return [s.x - m, s.y - m, s.x + m, s.y + m]; }
    case 'box': { const m = s.a ? Math.hypot(s.w, s.h) / 2 : 0; const hw = s.a ? m : s.w / 2, hh = s.a ? m : s.h / 2; return [s.x - hw, s.y - hh, s.x + hw, s.y + hh]; }
    case 'cap': { const r = Math.max(s.r, s.r2 || 0); return [Math.min(s.ax, s.bx) - r, Math.min(s.ay, s.by) - r, Math.max(s.ax, s.bx) + r, Math.max(s.ay, s.by) + r]; }
    case 'ring': return [s.x - s.R - s.r, s.y - s.R - s.r, s.x + s.R + s.r, s.y + s.R + s.r];
    case 'poly': case 'path': {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const r = s.r || 0; return [x0 - r, y0 - r, x1 + r, y1 + r];
    }
  }
  return [-1e9, -1e9, 1e9, 1e9];
}

// smooth min / max (polynomial)
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

/**
 * build({x0,y0,x1,y1,res, base:'solid'|'empty', baseMat, ops:[{op:'carve'|'add', k, mat, ...shape}] , noise})
 */
export function buildSDF(spec) {
  const res = spec.res || 4;
  const x0 = spec.x0, y0 = spec.y0;
  const w = Math.ceil((spec.x1 - spec.x0) / res) + 2;
  const h = Math.ceil((spec.y1 - spec.y0) / res) + 2;
  const data = new Float32Array(w * h);
  const mat = new Uint8Array(w * h);
  const solid = spec.base === 'solid';
  data.fill(solid ? -CLAMP : CLAMP);
  mat.fill(spec.baseMat ?? SURF.STONE);
  for (const o of spec.ops) {
    const k = o.k || 0;
    const [bx0, by0, bx1, by1] = shapeBounds(o);
    const pad = CLAMP + k;
    const i0 = Math.max(0, Math.floor((bx0 - pad - x0) / res)), i1 = Math.min(w - 1, Math.ceil((bx1 + pad - x0) / res));
    const j0 = Math.max(0, Math.floor((by0 - pad - y0) / res)), j1 = Math.min(h - 1, Math.ceil((by1 + pad - y0) / res));
    const m = o.mat ?? (o.op === 'carve' ? (spec.baseMat ?? SURF.STONE) : SURF.STONE);
    const carve = o.op === 'carve';
    for (let j = j0; j <= j1; j++) {
      const py = y0 + j * res;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + i * res;
        const idx = j * w + i;
        const ds = sdShape(px, py, o);
        const d = data[idx];
        let nd;
        if (carve) {
          // subtract: d = max(d, -ds)
          nd = k > 0 ? -smin(-d, ds, k) : Math.max(d, -ds);
          if (-ds > d - 0.5 && o.mat !== undefined) mat[idx] = m;
          else if (o.lining !== undefined && Math.abs(ds) < 10) mat[idx] = o.lining;
        } else {
          nd = k > 0 ? smin(d, ds, k) : Math.min(d, ds);
          if (ds < d + 0.5 || ds < 2) mat[idx] = m;
        }
        data[idx] = nd < -CLAMP ? -CLAMP : nd > CLAMP ? CLAMP : nd;
      }
    }
  }
  // organic low-frequency relief (keeps silhouettes smooth — no static)
  if (spec.relief) {
    const a = spec.relief, f = spec.reliefFreq || 0.012;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const idx = j * w + i; const d = data[idx];
      if (Math.abs(d) > CLAMP - 4) continue;
      const px = x0 + i * res, py = y0 + j * res;
      data[idx] = d + a * (Math.sin(px * f + Math.sin(py * f * 0.7) * 2) * Math.cos(py * f * 1.3 + px * f * 0.4) * 0.5);
    }
  }
  return { data, mat, w, h, res, x0, y0, x1: x0 + (w - 1) * res, y1: y0 + (h - 1) * res };
}

// One-off point queries against the built grid (for spawning, AI, raycasts)
export function sdfAt(g, px, py) {
  let fx = (px - g.x0) / g.res, fy = (py - g.y0) / g.res;
  if (fx < 0 || fy < 0 || fx > g.w - 1.001 || fy > g.h - 1.001) return -CLAMP;
  const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
  const k = iy * g.w + ix, d = g.data;
  return (d[k] + (d[k + 1] - d[k]) * tx) * (1 - ty) + (d[k + g.w] + (d[k + g.w + 1] - d[k + g.w]) * tx) * ty;
}
