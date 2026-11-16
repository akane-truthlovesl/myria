// ─────────────────────────────────────────────────────────────────────────────
//  Nav — a small A* over the room's distance field.
//
//  The bot plans with it; so does every sibling that is called home, so a piece
//  left behind a wall walks round it instead of leaning on the wall for ever.
//  Membranes are size-selective and may be one-way: the map is built for the
//  body that is going to walk it.
// ─────────────────────────────────────────────────────────────────────────────
import { shapeSDF } from '../sim/physics.js';
import { SURF } from '../sim/materials.js';

export const CS = 16;      // nav cell (world units)
const OUT = new Float32Array(3);

export class Nav {
  constructor(W) { this.W = W; const s = W.spec; this.w = Math.ceil(s.W / CS); this.h = Math.ceil(s.H / CS); const n = this.w * this.h; this.cost = new Float32Array(n); this.g = new Float32Array(n); this.from = new Int32Array(n); this.state = new Uint8Array(n); this.heap = []; this.wx = new Int8Array(n); this.wy = new Int8Array(n); this.sc = null; }
  // o.count: the size of the body that will walk this map (membranes are size-selective) · o.films: false → films are walls (a sibling coming home does not dart)
  build(avoid = 1, o = {}) {
    const W = this.W, P = W.phys, w = this.w, h = this.h, cost = this.cost; const out = OUT; const count = o.count ?? 1e9, films = o.films !== false;
    if (!this.sc) {         // the room's own walls never change: sample them once
      this.sc = new Float32Array(w * h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = P.sampleSDF((i + 0.5) * CS, (j + 0.5) * CS); this.sc[j * w + i] = d < 4.5 ? -1 : 1 + (d < 18 ? (18 - d) * 0.3 : 0); }
    }
    cost.set(this.sc); this.wx.fill(0); this.wy.fill(0);
    for (const S of P.shapes) {
      if (!S.active || S.cut) continue; const film = films && S.surf === SURF.BOUNCE && S.type === 1 && !S.tough;
      if (S.oneWay) {
        // a membrane: nothing at all to a body small enough; a wall to a big one if it is a pure sieve; otherwise a door that opens one way
        if (S.small && count <= S.small) continue;
        if (!S.sieve) { const ca = Math.cos(S.angle), sa = Math.sin(S.angle); const i0 = Math.max(0, Math.floor((S.bx0 - 10) / CS)), i1 = Math.min(w - 1, Math.floor((S.bx1 + 10) / CS)), j0 = Math.max(0, Math.floor((S.by0 - 10) / CS)), j1 = Math.min(h - 1, Math.floor((S.by1 + 10) / CS));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { shapeSDF(S, (i + 0.5) * CS, (j + 0.5) * CS, ca, sa, out); const k = j * w + i; if (cost[k] < 0 || out[0] > 12) continue; this.wx[k] = Math.round(S.passX * 100); this.wy[k] = Math.round(S.passY * 100); cost[k] += 1; }
          continue; }
      }
      const ca = Math.cos(S.angle), sa = Math.sin(S.angle);
      const i0 = Math.max(0, Math.floor((S.bx0 - 10) / CS)), i1 = Math.min(w - 1, Math.floor((S.bx1 + 10) / CS)), j0 = Math.max(0, Math.floor((S.by0 - 10) / CS)), j1 = Math.min(h - 1, Math.floor((S.by1 + 10) / CS));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { shapeSDF(S, (i + 0.5) * CS, (j + 0.5) * CS, ca, sa, out); const k = j * w + i; if (cost[k] < 0) continue; if (film) { if (out[0] < 8) cost[k] += 4; } else if (out[0] < 7) cost[k] = -1; else if (out[0] < 20) cost[k] += 2; }
    }
    for (const hz of W.hazards()) {
      const R = hz.r + 34; const i0 = Math.max(0, Math.floor((hz.x - R) / CS)), i1 = Math.min(w - 1, Math.floor((hz.x + R) / CS)), j0 = Math.max(0, Math.floor((hz.y - R) / CS)), j1 = Math.min(h - 1, Math.floor((hz.y + R) / CS));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot((i + 0.5) * CS - hz.x, (j + 0.5) * CS - hz.y); const k = j * w + i; if (cost[k] < 0) continue; if (d < hz.r + 8) cost[k] += 70 * avoid; else if (d < R) cost[k] += 14 * avoid * (1 - (d - hz.r) / 34); }
    }
    for (const e of W.ents) if (e.watch) {       // a watcher's cone is a place to cross quickly, not to linger
      for (let r = 40; r < e.range; r += CS) for (let a = -e.half; a <= e.half; a += 0.12) { const x = e.x + Math.cos(e.ang + a) * r, y = e.y + Math.sin(e.ang + a) * r; const i = Math.floor(x / CS), j = Math.floor(y / CS); if (i >= 0 && j >= 0 && i < w && j < h && cost[j * w + i] > 0) cost[j * w + i] += 5 * avoid; }
    }
  }
  free(x, y) { const i = Math.floor(x / CS), j = Math.floor(y / CS); return i >= 0 && j >= 0 && i < this.w && j < this.h && this.cost[j * this.w + i] > 0; }
  // nearest walkable cell to a point (targets often sit on pads/pores that are fine, but be safe)
  snap(x, y) { let i = Math.max(0, Math.min(this.w - 1, Math.floor(x / CS))), j = Math.max(0, Math.min(this.h - 1, Math.floor(y / CS))); if (this.cost[j * this.w + i] > 0) return j * this.w + i; for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < this.w && b < this.h && this.cost[b * this.w + a] > 0) return b * this.w + a; } return -1; }
  // A* → { pts:[[x,y]…], len } or null
  path(x0, y0, x1, y1) {
    const w = this.w, h = this.h, cost = this.cost, g = this.g, from = this.from, st = this.state; const s = this.snap(x0, y0), t = this.snap(x1, y1); if (s < 0 || t < 0) return null;
    st.fill(0); const heap = this.heap; heap.length = 0; g[s] = 0; from[s] = -1; st[s] = 1; const tx = t % w, ty = (t / w) | 0;
    const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const q = heap[p]; heap[p] = heap[c]; heap[c] = q; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = c * 2 + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; const q = heap[m]; heap[m] = heap[c]; heap[c] = q; c = m; } } return top; };
    push(s, 0); let found = false;
    while (heap.length) {
      const k = pop()[1]; if (st[k] === 2) continue; st[k] = 2; if (k === t) { found = true; break; }
      const i = k % w, j = (k / w) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w || b >= h) continue; const n = b * w + a; if (cost[n] < 0 || st[n] === 2) continue;
        if (di && dj && (cost[j * w + a] < 0 || cost[b * w + i] < 0)) continue;       // no corner cutting
        if ((this.wx[n] || this.wy[n]) && di * this.wx[n] + dj * this.wy[n] < 0 || (this.wx[k] || this.wy[k]) && di * this.wx[k] + dj * this.wy[k] < 0) continue;       // never against a one-way membrane
        const ng = g[k] + cost[n] * (di && dj ? 1.414 : 1);
        if (st[n] === 0 || ng < g[n]) { g[n] = ng; from[n] = k; st[n] = 1; push(n, ng + Math.hypot(a - tx, b - ty)); }
      }
    }
    if (!found) return null;
    const pts = []; let k = t, len = 0; while (k >= 0) { pts.push([(k % w + 0.5) * CS, (((k / w) | 0) + 0.5) * CS]); k = from[k]; } pts.reverse();
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pts.push([x1, y1]); return { pts, len, cost: g[t] };
  }
}
