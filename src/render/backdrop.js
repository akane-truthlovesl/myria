// ─────────────────────────────────────────────────────────────────────────────
//  Backdrop painter — the room, developed once like a photographic plate.
//
//  Because the camera rests while you play, the world behind the creature can be
//  painted per pixel with far more care than a per-frame budget allows: bevelled
//  glass walls lit by every lantern, contour-etched strata, a warped specimen
//  grid, wall shadows, ambient occlusion, dither. It also writes a reflectance
//  map so moving lights can later re-illuminate rims and grid lines.
// ─────────────────────────────────────────────────────────────────────────────
import { hash2, vnoise, fbm, cells, cellEdge, sat } from '../core/util.js';
import { SURF } from '../sim/materials.js';

export const DEFAULT_PAL = {
  deep: [0.016, 0.050, 0.078],     // far water
  mid: [0.050, 0.170, 0.225],      // near water
  pool: [0.085, 0.250, 0.290],     // the stage lamp's pool of light on the plate
  wall: [0.085, 0.215, 0.270],     // glass-stone body
  rim: [0.56, 0.90, 1.00],         // wet highlights, grid etching
  accent: [1.0, 0.62, 0.40],       // warm counter-light
  grid: 1.0, haze: 1.0,
};

const KEY = (() => { const k = [-0.45, -0.70, 0.56]; const l = Math.hypot(...k); return k.map(v => v / l); })();
const BEVEL = 10;       // world units of rounded lip on every wall

export class Backdrop {
  constructor() { this.room = null; this.neb = null; }

  // low-resolution noise layers, bilinearly upsampled per pixel
  prepare(room, fb, view) {
    this.room = room; this.view = view;
    const pal = this.pal = { ...DEFAULT_PAL, ...(room.pal || {}) };
    const s = 8; const nw = this.nw = ((fb.w / s) | 0) + 2, nh = this.nh = ((fb.h / s) | 0) + 2; this.ns = s;
    const neb = this.neb = new Float32Array(nw * nh);
    const seed = (room.seed || 1) % 1000;
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const wx = i * s / view.z + view.ox, wy = j * s / view.z + view.oy;
      neb[j * nw + i] = fbm(wx * 0.0032 + seed, wy * 0.0032 - seed * 0.37, 4);
    }
    // the water film's light network: bright filaments along the borders of two drifting cell layers (1/4 resolution)
    const cs = this.cs = 4, cw = this.cw = ((fb.w / cs) | 0) + 2, chh = ((fb.h / cs) | 0) + 2; const cau = this.cau = new Float32Array(cw * chh);
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) {
      const wx = i * cs / view.z + view.ox, wy = j * cs / view.z + view.oy;
      const ux = wx + 26 * Math.sin(wy * 0.011 + seed), uy = wy + 26 * Math.sin(wx * 0.013 - seed * 0.7);
      const e1 = cellEdge(ux * 0.0125 + seed * 0.11, uy * 0.0125), e2 = cellEdge(ux * 0.021 + 4.1, uy * 0.021 + seed * 0.07);
      const a = Math.exp(-e1 * e1 * 150), b = Math.exp(-e2 * e2 * 110);
      cau[j * cw + i] = a * 0.7 + b * 0.38 + a * b * 0.6;
    }
    // far light: the specimen lamp (upper left) and a handful of out-of-focus highlights, at 1/8 resolution
    const lum = this.lum = new Float32Array(nw * nh), lumW = this.lumW = new Float32Array(nw * nh);
    const R = (k) => hash2(seed * 13 + k, k * 7 + 3); const discs = [];
    for (let k = 0; k < 11; k++) discs.push({ x: R(k) * room.W, y: R(k + 40) * room.H, r: 26 + R(k + 80) * 90, a: 0.25 + 0.75 * R(k + 120), warm: R(k + 160) > 0.62 });
    const lx = room.W * 0.2, ly = room.H * 0.14, lr = Math.hypot(room.W, room.H) * 0.55;
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const wx = i * s / view.z + view.ox, wy = j * s / view.z + view.oy; let v = 0.9 * Math.exp(-((wx - lx) * (wx - lx) + (wy - ly) * (wy - ly)) / (lr * lr)), w = 0;
      for (const d of discs) { const q = Math.hypot(wx - d.x, wy - d.y) / d.r; if (q < 1.25) { const body = q < 0.86 ? 0.55 : q < 1 ? 0.55 + (q - 0.86) * 3.2 : Math.max(0, 1 - (q - 1) * 4); if (d.warm) w += body * d.a; else v += body * d.a * 0.8; } }
      lum[j * nw + i] = v; lumW[j * nw + i] = w;
    }
    this.reflect = new Uint8Array(fb.w * fb.h);
    this.lights = room.lights || [];
    this.wells = room.wells || [];
    void pal;
  }

  // paint rows [y0,y1) of the backdrop
  paint(fb, y0, y1) {
    const room = this.room, view = this.view, pal = this.pal;
    const g = room.sdf; const data = g.data, gmat = g.mat, sw = g.w, sh = g.h, ires = 1 / g.res, gx0 = g.x0, gy0 = g.y0;
    const W = fb.w, back = fb.back, refl = this.reflect;
    const iz = 1 / view.z, ox = view.ox, oy = view.oy, z = view.z;
    const { neb, cau, lum, lumW, nw, ns, cw } = this; const ins = 1 / ns, ics = 1 / this.cs;
    const lights = this.lights, nl = lights.length, wells = this.wells, nwell = wells.length;
    const deep = pal.deep, mid = pal.mid, pool = pal.pool, wallC = pal.wall, rim = pal.rim, acc = pal.accent;
    const gridK = pal.grid, RW = room.W, RH = room.H;
    const cxr = RW * 0.5, cyr = RH * 0.5, vr = 1 / (Math.hypot(RW, RH) * 0.62), ipw = 1 / (RW * 0.40), iph = 1 / (RH * 0.40);
    const sdf = (wx, wy) => {
      let fx = (wx - gx0) * ires, fy = (wy - gy0) * ires;
      if (fx < 0) fx = 0; else if (fx > sw - 1.001) fx = sw - 1.001; if (fy < 0) fy = 0; else if (fy > sh - 1.001) fy = sh - 1.001;
      const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy; const k = iy * sw + ix;
      const a = data[k], b = data[k + 1], c = data[k + sw], d = data[k + sw + 1];
      return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    };
    for (let y = y0; y < y1; y++) {
      const wy = y * iz + oy; const o = y * W;
      for (let x = 0; x < W; x++) {
        const wx = x * iz + ox;
        // ── signed distance & gradient (bilinear) ──
        let fx = (wx - gx0) * ires, fy = (wy - gy0) * ires;
        if (fx < 0) fx = 0; else if (fx > sw - 1.001) fx = sw - 1.001; if (fy < 0) fy = 0; else if (fy > sh - 1.001) fy = sh - 1.001;
        const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy; const k0 = iy * sw + ix;
        const d00 = data[k0], d10 = data[k0 + 1], d01 = data[k0 + sw], d11 = data[k0 + sw + 1];
        const d = (d00 + (d10 - d00) * tx) * (1 - ty) + (d01 + (d11 - d01) * tx) * ty;
        // ── low-res layers ──
        const nfx = x * ins, nfy = y * ins; const ni = nfx | 0, nj = nfy | 0, na = nfx - ni, nb = nfy - nj; const nk = nj * nw + ni;
        const n1 = (neb[nk] + (neb[nk + 1] - neb[nk]) * na) * (1 - nb) + (neb[nk + nw] + (neb[nk + nw + 1] - neb[nk + nw]) * na) * nb;
        let r = 0, gg = 0, b = 0, rf = 0;
        const cov = sat(0.5 - d * z);                    // wall coverage (1 px analytic edge)
        if (cov < 1) {
          // ── the plate: deep water, nebula, etched grid, caustic web ──
          const vg = Math.hypot(wx - cxr, wy - cyr) * vr;
          const vig = 1 - 0.50 * vg * vg;
          const t = sat(0.25 + 0.9 * (n1 - 0.25) + 0.25 * (1 - vg));
          r = deep[0] + (mid[0] - deep[0]) * t; gg = deep[1] + (mid[1] - deep[1]) * t; b = deep[2] + (mid[2] - deep[2]) * t;
          { const px_ = (wx - cxr) * ipw, py_ = (wy - cyr) * iph; const pv = Math.exp(-(px_ * px_ + py_ * py_)) * (0.72 + 0.56 * n1); r += pool[0] * pv; gg += pool[1] * pv; b += pool[2] * pv; }
          const cfx = x * ics, cfy = y * ics; const ci = cfx | 0, cj = cfy | 0, ca = cfx - ci, cb = cfy - cj; const ck0 = cj * cw + ci;
          const c1 = (cau[ck0] + (cau[ck0 + 1] - cau[ck0]) * ca) * (1 - cb) + (cau[ck0 + cw] + (cau[ck0 + cw + 1] - cau[ck0 + cw]) * ca) * cb;
          const ck = c1 * 0.075 * pal.haze * (0.35 + 1.0 * t);
          r += rim[0] * ck; gg += rim[1] * ck; b += rim[2] * ck;
          const lv = ((lum[nk] + (lum[nk + 1] - lum[nk]) * na) * (1 - nb) + (lum[nk + nw] + (lum[nk + nw + 1] - lum[nk + nw]) * na) * nb) * 0.055 * pal.haze;
          const lw = ((lumW[nk] + (lumW[nk + 1] - lumW[nk]) * na) * (1 - nb) + (lumW[nk + nw] + (lumW[nk + nw + 1] - lumW[nk + nw]) * na) * nb) * 0.060 * pal.haze;
          r += rim[0] * lv + acc[0] * lw; gg += rim[1] * lv + acc[1] * lw; b += rim[2] * lv + acc[2] * lw;
          // grid, bent by gravity wells
          let qx = wx, qy = wy;
          for (let w = 0; w < nwell; w++) {
            const we = wells[w]; const dx = qx - we.x, dy = qy - we.y; const rr2 = dx * dx + dy * dy; const R2 = we.r * we.r;
            const pull = we.s * R2 / (rr2 + R2 * 0.35); const sw_ = (we.swirl || 0) * Math.exp(-rr2 / (R2 * 2.2));
            const cs = Math.cos(sw_), sn = Math.sin(sw_);
            const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
            qx = we.x + rx * (1 + pull); qy = we.y + ry * (1 + pull);
          }
          const pw = iz;                                   // one pixel in world units
          const mx = Math.abs(((qx / 48) % 1 + 1.5) % 1 - 0.5) * 48, my = Math.abs(((qy / 48) % 1 + 1.5) % 1 - 0.5) * 48;
          const Mx = Math.abs(((qx / 192) % 1 + 1.5) % 1 - 0.5) * 192, My = Math.abs(((qy / 192) % 1 + 1.5) % 1 - 0.5) * 192;
          const minor = sat(1 - Math.min(mx, my) / (0.8 * pw + 0.35)), major = sat(1 - Math.min(Mx, My) / (1.1 * pw + 0.6));
          const cross = sat(1 - Math.max(Mx, My) / 7) * 0.9;     // registration ticks where majors meet
          const gl = (minor * 0.032 + major * 0.075 + cross * 0.14) * gridK * (0.45 + 1.0 * t);
          r += rim[0] * gl; gg += rim[1] * gl; b += rim[2] * gl;
          rf = 0.07 + (minor * 0.35 + major * 0.65 + cross * 0.5) * gridK * 0.55 + c1 * 0.22;
          // dust & micro-bubbles frozen in the glass
          const hx = Math.floor(wx / 9), hy = Math.floor(wy / 9); const hh = hash2(hx, hy);
          if (hh > 0.972) {
            const px = (hx + 0.2 + 0.6 * hash2(hx + 31, hy)) * 9, py = (hy + 0.2 + 0.6 * hash2(hx, hy + 17)) * 9;
            const dd = Math.hypot(wx - px, wy - py); const sz = 0.7 + 1.6 * hash2(hx + 5, hy + 9);
            const v = sat(1 - dd / (sz + pw * 0.6)) * (0.05 + 0.16 * hash2(hx + 3, hy + 3));
            r += rim[0] * v; gg += rim[1] * v; b += rim[2] * v; rf += v * 2;
          }
          r *= vig; gg *= vig; b *= vig;
          // static light pools
          for (let l = 0; l < nl; l++) {
            const Lg = lights[l]; const dx = wx - Lg.x, dy = wy - Lg.y; const q = (dx * dx + dy * dy) / (Lg.r * Lg.r);
            if (q < 4) { const v = Lg.i * Math.exp(-q * 2.4) * 0.16; r += Lg.col[0] * v; gg += Lg.col[1] * v; b += Lg.col[2] * v; }
          }
          // walls stand proud of the plate: contact shadow + a longer cast shadow away from the lamp
          const ao = 1 - 0.50 * Math.exp(-Math.max(d, 0) / 20);
          const ds = sdf(wx - 7, wy - 11);
          const cast = 1 - 0.42 * sat(0.5 - ds / 9);
          r *= ao * cast; gg *= ao * cast; b *= ao * cast;
          // wet film hugging every wall
          const film = Math.exp(-Math.max(d, 0) / 2.2) * 0.05;
          r += rim[0] * film; gg += rim[1] * film; b += rim[2] * film;
          rf += Math.exp(-Math.max(d, 0) / 5) * 0.25;
        }
        if (cov > 0) {
          // ── walls: bevelled, lit glass-stone ──
          let gx = (d10 - d00) * (1 - ty) + (d11 - d01) * ty, gy = (d01 - d00) * (1 - tx) + (d11 - d10) * tx;
          const gl = Math.hypot(gx, gy); if (gl > 1e-5) { gx /= gl; gy /= gl; } else { gx = 0; gy = -1; }
          const depth = -d > 0 ? -d : 0;
          const tb = sat(depth / BEVEL); const slope = (1 - tb) * (1 - tb) * 1.55;
          const il = 1 / Math.sqrt(slope * slope + 1);
          const Nx = gx * slope * il, Ny = gy * slope * il, Nz = il;
          const m = gmat[k0 + (ty > 0.5 ? sw : 0) + (tx > 0.5 ? 1 : 0)];
          let cr, cg, cb, gloss = 0.3, rimK = 1, glowR = 0, glowG = 0, glowB = 0;
          const strata = 0.5 + 0.5 * Math.sin(depth * 0.36 + n1 * 5);
          const band = Math.exp(-depth / 20);
          if (m === SURF.GLASS) {           // cold mirror: brighter, clean, diagonal streaks
            const streak = Math.pow(0.5 + 0.5 * Math.sin((wx + wy) * 0.045 + n1 * 3), 12);
            cr = 0.045 + 0.20 * band + 0.10 * streak; cg = 0.085 + 0.33 * band + 0.14 * streak; cb = 0.11 + 0.42 * band + 0.16 * streak;
            gloss = 1.0; rimK = 1.6;
          } else if (m === SURF.RESIN) {    // amber with clinging filaments
            const fil = Math.pow(0.5 + 0.5 * Math.sin(wx * 0.22 + Math.sin(wy * 0.06) * 3 + n1 * 7), 6);
            cr = 0.34 + 0.25 * fil; cg = 0.15 + 0.14 * fil; cb = 0.025;
            gloss = 0.7; glowR = 0.10 * band; glowG = 0.045 * band;
          } else if (m === SURF.GRIT) {     // abrasive: dark, toothed, sparking
            const tooth = cells(wx * 0.16, wy * 0.16);
            const sp = hash2(Math.floor(wx * 0.5), Math.floor(wy * 0.5)) > 0.94 ? 1 : 0;
            cr = 0.13 * (0.5 + tooth) + sp * 0.5 * band; cg = 0.10 * (0.5 + tooth) + sp * 0.24 * band; cb = 0.09 * (0.5 + tooth);
            gloss = 0.12; rimK = 0.5; glowR = 0.20 * Math.exp(-depth / 3); glowG = 0.08 * Math.exp(-depth / 3);
          } else if (m === SURF.BOUNCE) {   // elastic membrane
            cr = 0.03; cg = 0.30 + 0.12 * strata; cb = 0.36 + 0.12 * strata; gloss = 0.8;
            glowG = 0.5 * Math.exp(-depth / 3.5); glowB = 0.6 * Math.exp(-depth / 3.5);
          } else if (m === SURF.METAL) {    // brushed machine metal
            const brush = vnoise(wx * 0.55, wy * 0.03);
            cr = 0.17 * (0.7 + 0.5 * brush); cg = 0.20 * (0.7 + 0.5 * brush); cb = 0.24 * (0.7 + 0.5 * brush); gloss = 0.7;
          } else if (m === SURF.ICE) {      // frosted, cracked
            const crack = sat(1 - Math.abs(cells(wx * 0.028, wy * 0.028) - 0.5) * 22);
            cr = 0.34 + 0.25 * crack; cg = 0.50 + 0.3 * crack; cb = 0.62 + 0.3 * crack; gloss = 0.9; rimK = 1.4;
          } else if (m === SURF.WARM) {     // thermal plate with ember veins
            const vein = sat(1 - Math.abs(fbm(wx * 0.03, wy * 0.03, 3) - 0.5) * 14);
            cr = 0.15 + 0.8 * vein; cg = 0.06 + 0.26 * vein; cb = 0.04 + 0.05 * vein; gloss = 0.3;
            glowR = 0.22 * band; glowG = 0.07 * band;
          } else {                          // STONE: thick sea-glass — luminous at the skin, frosted and bubbled within
            const skin = 0.58 + 0.42 * band;
            const frost = 0.72 + 0.56 * n1;
            cr = wallC[0] * skin * frost; cg = wallC[1] * skin * frost; cb = wallC[2] * skin * frost;
            // the polished top catches the window: a broad diagonal sheen, broken by the glass's own waviness
            const sheen = Math.pow(0.5 + 0.5 * Math.sin((wx * 0.62 + wy) * 0.021 + n1 * 4.0), 6) * 0.055 * tb;
            cr += rim[0] * sheen; cg += rim[1] * sheen; cb += rim[2] * sheen;
            const line = Math.pow(strata, 10) * Math.exp(-depth / 60) * 0.050;     // contour etching
            cr += rim[0] * line; cg += rim[1] * line; cb += rim[2] * line;
            const bx = Math.floor(wx / 13), by = Math.floor(wy / 13); const bh = hash2(bx + 91, by + 17);
            if (bh > 0.90) {                // bubbles frozen in the glass
              const px = (bx + 0.25 + 0.5 * hash2(bx + 3, by)) * 13, py = (by + 0.25 + 0.5 * hash2(bx, by + 7)) * 13, br = 1.2 + 3.2 * hash2(bx + 11, by + 5);
              const dd = Math.hypot(wx - px, wy - py); const ringv = sat(1 - Math.abs(dd - br) / (0.7 + iz)) * 0.10 + sat(1 - Math.hypot(wx - px + br * 0.4, wy - py + br * 0.4) / (0.9 + iz)) * 0.16;
              cr += rim[0] * ringv; cg += rim[1] * ringv; cb += rim[2] * ringv;
            }
            gloss = 0.45;
          }
          const ndk = Nx * KEY[0] + Ny * KEY[1] + Nz * KEY[2];
          const diff = ndk > 0 ? ndk : 0;
          // half-vector specular toward the viewer
          let hx = KEY[0], hy = KEY[1], hz = KEY[2] + 1; const hl = 1 / Math.hypot(hx, hy, hz); hx *= hl; hy *= hl; hz *= hl;
          const ndh = Math.max(0, Nx * hx + Ny * hy + Nz * hz);
          const spec = Math.pow(ndh, 26) * gloss * 0.38;
          let lr = cr * (0.34 + 0.72 * diff) + rim[0] * spec, lg = cg * (0.34 + 0.72 * diff) + rim[1] * spec, lb = cb * (0.34 + 0.72 * diff) + rim[2] * spec;
          for (let l = 0; l < nl; l++) {
            const Lg = lights[l]; const dx = Lg.x - wx, dy = Lg.y - wy; const dz = 46;
            const q = (dx * dx + dy * dy) / (Lg.r * Lg.r);
            if (q < 6) {
              const il2 = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
              const nd = Math.max(0, (Nx * dx + Ny * dy + Nz * dz) * il2);
              const att = Lg.i / (1 + q * 3.2);
              const sp2 = Math.pow(nd, 14) * gloss * 0.5;
              lr += (cr * nd * 1.5 + sp2) * Lg.col[0] * att; lg += (cg * nd * 1.5 + sp2) * Lg.col[1] * att; lb += (cb * nd * 1.5 + sp2) * Lg.col[2] * att;
            }
          }
          // moisture-rich lip: a thin bright meniscus where wall meets water
          const lip = Math.exp(-depth / 1.6) * 0.085 * rimK * (0.45 + 0.9 * diff);
          lr += rim[0] * lip + glowR; lg += rim[1] * lip + glowG; lb += rim[2] * lip + glowB;
          const wrf = Math.exp(-depth / 2.6) * 0.95 * rimK + (1 - tb) * 0.35 + 0.05 + Math.pow(strata, 10) * Math.exp(-depth / 50) * 0.35;
          r += (lr - r) * cov; gg += (lg - gg) * cov; b += (lb - b) * cov; rf += (wrf - rf) * cov;
        }
        const dn = hash2(x, y) - 0.5;
        let R = r * 255 + dn, G = gg * 255 + dn, B = b * 255 + dn;
        R = R < 0 ? 0 : R > 255 ? 255 : R; G = G < 0 ? 0 : G > 255 ? 255 : G; B = B < 0 ? 0 : B > 255 ? 255 : B;
        back[o + x] = 0xff000000 | ((B + 0.5) | 0) << 16 | ((G + 0.5) | 0) << 8 | ((R + 0.5) | 0);
        refl[o + x] = rf >= 1 ? 255 : (rf * 255) | 0;
      }
    }
  }
}
